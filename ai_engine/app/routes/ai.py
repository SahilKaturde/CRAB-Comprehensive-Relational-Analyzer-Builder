import os
import io
import uuid
import time
import sqlite3
import pandas as pd
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.core.config import SESSION_DIR, ANALYSIS_HISTORY
from app.services.agent import run_chat_agent
from app.services.discovery import detect_enterprise_schema, generate_architectural_summary
from app.services.profiler import run_data_profiling
from app.services.dictionary import save_to_dictionary, get_session_dictionary

router = APIRouter()

# ════════════════════════════════════════════════════════
#  ENDPOINT: History
# ════════════════════════════════════════════════════════

@router.get("/history")
async def get_analysis_history():
    """Returns the in-memory history of analysis sessions."""
    return ANALYSIS_HISTORY

@router.delete("/history")
async def clear_analysis_history():
    """Clears the in-memory history, the persistent data dictionary database, and session files."""
    global ANALYSIS_HISTORY
    ANALYSIS_HISTORY.clear()
    
    # Clear the database
    from app.services.dictionary import get_connection
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM data_dictionary")
        cursor.execute("DELETE FROM sessions")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to clear database: {e}")
    
    # Clear session files
    import shutil
    try:
        for filename in os.listdir(SESSION_DIR):
            file_path = os.path.join(SESSION_DIR, filename)
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
    except Exception as e:
        print(f"Failed to clear session directory: {e}")
        
    return {"status": "history_db_and_sessions_cleared"}

# ════════════════════════════════════════════════════════
#  ENDPOINT: Chat (LangGraph + Pandas CSV Agent)
# ════════════════════════════════════════════════════════

@router.post("/chat")
async def chat_interaction(query: str, session_id: str, graph_context: Optional[str] = ""):
    """Natural language interface for data analysis. Returns text + optional chart images + optional exports."""
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID is required for chat context.")
    
    try:
        result = await run_chat_agent(query, session_id, graph_context)
        return {
            "response": result.get("text", ""),
            "images": result.get("images", []),
            "exports": result.get("exports", []),
            "status": "ok"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

# ════════════════════════════════════════════════════════
#  ENDPOINT: Relationship Discovery (Step 3)
# ════════════════════════════════════════════════════════

@router.post("/relationships")
async def discovery_engine(files: List[UploadFile] = File(...), session_id: Optional[str] = None):
    total_start = time.time()
    if not session_id:
        session_id = str(uuid.uuid4())
    
    session_path = os.path.join(SESSION_DIR, session_id)
    os.makedirs(session_path, exist_ok=True)
    
    tables = {}
    file_names = []
    
    for file in files:
        filename = file.filename
        file_names.append(filename)
        content = await file.read()
        with open(os.path.join(session_path, filename), "wb") as f:
            f.write(content)
            
        file_ext = filename.split('.')[-1].lower()
        if file_ext == "csv":
            tables[filename.replace(".csv", "")] = pd.read_csv(io.BytesIO(content), low_memory=False)
        elif file_ext in ["db", "sqlite"]:
            with sqlite3.connect(os.path.join(session_path, filename)) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                db_tables = [row[0] for row in cursor.fetchall()]
                for t_name in db_tables:
                    tables[t_name] = pd.read_sql(f'SELECT * FROM "{t_name}"', conn)
        elif file_ext == "sql":
            conn = sqlite3.connect(":memory:")
            try:
                conn.executescript(content.decode("utf-8"))
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                db_tables = [row[0] for row in cursor.fetchall()]
                for t_name in db_tables:
                    tables[t_name] = pd.read_sql(f'SELECT * FROM "{t_name}"', conn)
            except:
                pass
            finally:
                conn.close()

    if not tables:
        raise HTTPException(status_code=400, detail="No valid tables found.")

    # AUTO-SAVE all tables as CSVs for the chat agent to use later
    for t_name, df in tables.items():
        csv_path = os.path.join(session_path, f"{t_name}.csv")
        if not os.path.exists(csv_path):
            df.to_csv(csv_path, index=False)

    try:
        # Deterministic Relationship Detection (BID Algorithm)
        discovery_result = detect_enterprise_schema(tables)
        detected_rels = discovery_result["relationships"]
        pks = discovery_result["pks"]
        
        # AI Architectural Summary
        summary = await generate_architectural_summary(detected_rels)

        total_time = time.time() - total_start

        # AUTO-RECORD TO RAM HISTORY
        display_name = ", ".join(file_names[:2]) + ("..." if len(file_names) > 2 else "")
        analysis_record = {
            "id": str(uuid.uuid4())[:8],
            "session_id": session_id,
            "filename": display_name,
            "file_type": "Multi-Table" if len(file_names) > 1 else file_names[0].split('.')[-1].upper(),
            "table_count": len(tables),
            "relationship_count": len(detected_rels),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "status": "ready"
        }
        ANALYSIS_HISTORY.insert(0, analysis_record)

        return {
            "session_id": session_id,
            "entities": list(tables.keys()),
            "relationships": detected_rels,
            "pks": pks,
            "summary": summary,
            "status": "ready",
            "process_time": f"{total_time:.2f}s"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")

# ════════════════════════════════════════════════════════
#  ENDPOINT: Data Quality Profiling (Step 4)
# ════════════════════════════════════════════════════════

@router.post("/profile")
async def data_profile(session_id: str):
    """Computes per-table data quality metrics for the given session."""
    result = run_data_profiling(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session or data not found.")
    
    profile = result["profile"]
    summary = result["summary"]

    # AUTO-SAVE TO PERSISTENT DATA DICTIONARY
    try:
        filename = "Unknown Session"
        for item in ANALYSIS_HISTORY:
            if item["session_id"] == session_id:
                filename = item["filename"]
                break
        
        save_to_dictionary(session_id, filename, "Session Profiling Complete", profile)
    except Exception as e:
        print(f"FAILED to save to data dictionary: {e}")

    return {
        "session_id": session_id,
        "tables": profile,
        "summary": summary
    }

# ════════════════════════════════════════════════════════
#  ENDPOINT: Data Dictionary Retrieval
# ════════════════════════════════════════════════════════

@router.get("/dictionary")
async def get_dict(session_id: str):
    """Retrieves the saved data dictionary for a session."""
    data = get_session_dictionary(session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Data dictionary not found for this session.")
    return data

@router.get("/dictionary/download")
async def download_dict(session_id: str):
    """Returns the data dictionary as a downloadable JSON file."""
    data = get_session_dictionary(session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Data dictionary not found.")
    
    filename = f"data_dictionary_{session_id[:8]}.json"
    return {
        "filename": filename,
        "content": data
    }
