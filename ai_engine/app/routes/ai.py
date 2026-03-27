import os
import io
import json
import uuid
import time
import sqlite3
import itertools
import pandas as pd
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv
from app.services.agent import run_chat_agent

router = APIRouter()
load_dotenv()

# Workspace-local session storage
SESSION_DIR = os.path.join(os.getcwd(), "sessions")
os.makedirs(SESSION_DIR, exist_ok=True)

# Initialize LLM via OpenRouter
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
llm = ChatOpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    model="openai/gpt-4o-mini",
    temperature=0
)

# Global RAM History Store (Cleared on server restart)
ANALYSIS_HISTORY = []

# ════════════════════════════════════════════════════════
#  ENDPOINT: History
# ════════════════════════════════════════════════════════

@router.get("/history")
async def get_analysis_history():
    """Returns the in-memory history of analysis sessions."""
    return ANALYSIS_HISTORY

# ════════════════════════════════════════════════════════
#  ENDPOINT: Chat (LangGraph + Pandas CSV Agent)
# ════════════════════════════════════════════════════════

@router.post("/chat")
async def chat_interaction(query: str, session_id: str, graph_context: Optional[str] = ""):
    """Natural language interface for data analysis. Returns text + optional chart images."""
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID is required for chat context.")
    
    try:
        result = await run_chat_agent(query, session_id, graph_context)
        # result is now { "text": str, "images": list[str] }
        return {
            "response": result.get("text", ""),
            "images": result.get("images", []),
            "status": "ok"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

# ════════════════════════════════════════════════════════
#  CORE: Deterministic BID Algorithm
# ════════════════════════════════════════════════════════

def detect_enterprise_schema(tables):
    """
    Deterministic Relationship Discovery using Bidirectional Inclusion Dependency.
    Identifies PKs, FKs, and Junction tables for M:M mapping.
    """
    pks = {}
    fks = []
    
    # STEP 1: Identify Primary Keys (PKs)
    for t_name, df in tables.items():
        found_pk = False
        for col in df.columns:
            if str(col).lower().endswith("_id"):
                base_col = str(col).lower().replace("_id", "")
                possible_plurals = [base_col, base_col + "s", base_col + "es", base_col[:-1] + "ies"]
                if t_name.lower() in possible_plurals and df[col].is_unique:
                    pks[t_name] = col
                    found_pk = True
                    break
        if not found_pk and "id" in df.columns and df["id"].is_unique:
            pks[t_name] = "id"

    # STEP 2: Inclusion Dependency (Find Foreign Keys & Cardinality)
    for child_t, df_child in tables.items():
        for parent_t, pk_col in pks.items():
            if child_t == parent_t:
                continue
            for child_col in df_child.columns:
                is_name_match = False
                if str(child_col).lower().endswith("_id"):
                    base_col = str(child_col).lower().replace("_id", "")
                    possible_plurals = [base_col, base_col + "s", base_col + "es", base_col[:-1] + "ies"]
                    if parent_t.lower() in possible_plurals:
                        is_name_match = True
                if child_col == pk_col and pk_col != 'id':
                    is_name_match = True
                
                if is_name_match:
                    if pks.get(child_t) == child_col:
                        continue
                    set_fk = set(df_child[child_col].dropna())
                    set_pk = set(tables[parent_t][pk_col].dropna())
                    if not set_fk or not set_pk:
                        continue
                    
                    intersection = set_fk.intersection(set_pk)
                    inclusion_ratio = len(intersection) / len(set_fk) if len(set_fk) > 0 else 0
                    
                    if inclusion_ratio > 0.05: 
                        is_one_to_one = df_child[child_col].dropna().is_unique
                        rel_type = "1 : 1" if is_one_to_one else "1 : MANY"
                        fks.append({
                            "child_table": child_t, "child_col": child_col,
                            "parent_table": parent_t, "parent_col": pk_col,
                            "type": rel_type
                        })

    # STEP 3: Graph Enumeration (Identify M:M Junctions)
    relationships = []
    junction_map = {}
    for fk in fks:
        child, parent = fk["child_table"], fk["parent_table"]
        relationships.append({
            "Entity A": parent, "Entity B": child,
            "Relationship": fk["type"],
            "Connecting Key": f"{fk['parent_col']} -> {fk['child_col']}"
        })
        if fk["type"] == "1 : MANY":
            if child not in junction_map:
                junction_map[child] = []
            junction_map[child].append(parent)

    for junction_table, parents in junction_map.items():
        if len(parents) >= 2:
            for p1, p2 in itertools.combinations(parents, 2):
                relationships.append({
                    "Entity A": p1, "Entity B": p2,
                    "Relationship": "MANY : MANY",
                    "Connecting Key": f"Resolved via: [{junction_table}]"
                })
    return relationships

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
            tables[filename.replace(".csv", "")] = pd.read_csv(io.BytesIO(content))
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
        detected_rels = detect_enterprise_schema(tables)
        
        # AI Architectural Summary
        summary = "No significant relationships detected for architectural analysis."
        if detected_rels:
            prompt = f"""
            Identify and summarize the core architecture of these verified database relationships:
            {json.dumps(detected_rels[:30], indent=2)}

            Identify the central entity, the junction tables, and the overall business purpose.
            Keep it strictly under 3 paragraphs.
            """
            response = llm.invoke([HumanMessage(content=prompt)])
            summary = response.content

        total_time = time.time() - total_start
        print(f"DEBUG: TOTAL Discovery Time: {total_time:.2f}s")

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
    session_path = os.path.join(SESSION_DIR, session_id)
    if not os.path.exists(session_path):
        raise HTTPException(status_code=404, detail="Session not found.")
    
    # Load all CSVs from the session
    tables = {}
    for file in os.listdir(session_path):
        if file.endswith(".csv"):
            t_name = file.replace(".csv", "")
            tables[t_name] = pd.read_csv(os.path.join(session_path, file))
    
    if not tables:
        raise HTTPException(status_code=400, detail="No CSV data found in session.")
    
    profile = {}
    total_cells = 0
    total_non_null = 0
    total_rows = 0
    total_columns = 0
    
    for t_name, df in tables.items():
        rows = len(df)
        cols = len(df.columns)
        total_rows += rows
        total_columns += cols
        
        column_profiles = []
        for col in df.columns:
            null_count = int(df[col].isnull().sum())
            unique_count = int(df[col].nunique())
            total_cells += rows
            total_non_null += (rows - null_count)
            
            column_profiles.append({
                "name": col,
                "dtype": str(df[col].dtype),
                "null_count": null_count,
                "null_pct": round(null_count / rows * 100, 1) if rows > 0 else 0,
                "unique_count": unique_count,
                "unique_pct": round(unique_count / rows * 100, 1) if rows > 0 else 0,
                "sample_values": df[col].dropna().head(3).tolist()
            })
        
        table_nulls = int(df.isnull().sum().sum())
        table_total = rows * cols
        completeness = round((1 - table_nulls / table_total) * 100, 1) if table_total > 0 else 100
        
        profile[t_name] = {
            "row_count": rows,
            "column_count": cols,
            "completeness": completeness,
            "columns": column_profiles
        }
    
    overall_completeness = round(total_non_null / total_cells * 100, 1) if total_cells > 0 else 100
    
    # Compute depth code (max FK chain length)
    depth_code = 0
    try:
        rels = detect_enterprise_schema(tables)
        # Build adjacency for depth calculation
        graph = {}
        for r in rels:
            a, b = r["Entity A"], r["Entity B"]
            if a not in graph:
                graph[a] = []
            graph[a].append(b)
        
        # BFS for longest path
        def max_depth(node, visited=None):
            if visited is None:
                visited = set()
            if node in visited or node not in graph:
                return 0
            visited.add(node)
            return 1 + max((max_depth(n, visited.copy()) for n in graph[node]), default=0)
        
        for node in graph:
            d = max_depth(node)
            if d > depth_code:
                depth_code = d
    except:
        depth_code = 0
    
    return {
        "session_id": session_id,
        "tables": profile,
        "summary": {
            "total_tables": len(tables),
            "total_rows": total_rows,
            "total_columns": total_columns,
            "overall_completeness": overall_completeness,
            "depth_code": depth_code
        }
    }