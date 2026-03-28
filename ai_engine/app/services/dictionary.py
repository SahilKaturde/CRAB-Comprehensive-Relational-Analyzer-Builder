import sqlite3
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# Path for SQLite fallback
SQLITE_DB_PATH = os.path.join(os.getcwd(), "sessions", "data_dictionary.db")

# PostgreSQL connection string from environment
POSTGRES_URL = os.getenv("POSTGRES_URL") 

def get_connection():
    """Returns a connection to Postgres if URL is provided, else SQLite."""
    if POSTGRES_URL:
        try:
            return psycopg2.connect(POSTGRES_URL)
        except Exception as e:
            print(f"Postgres connection failed, falling back to SQLite: {e}")
    
    # SQLite Fallback
    os.makedirs(os.path.dirname(SQLITE_DB_PATH), exist_ok=True)
    return sqlite3.connect(SQLITE_DB_PATH)

def init_dict_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if we are using Postgres or SQLite
    is_postgres = hasattr(conn, 'tpc_prepare') # Simple check for psycopg2
    
    # Sessions table
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            filename TEXT,
            timestamp {"TIMESTAMP DEFAULT CURRENT_TIMESTAMP" if is_postgres else "DATETIME DEFAULT CURRENT_TIMESTAMP"},
            summary TEXT
        )
    """)
    
    # Data Dictionary table with more details
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS data_dictionary (
            id {"SERIAL" if is_postgres else "INTEGER"} PRIMARY KEY {"" if is_postgres else "AUTOINCREMENT"},
            session_id TEXT,
            table_name TEXT,
            column_name TEXT,
            dtype TEXT,
            null_pct REAL,
            unique_count INTEGER,
            min_val TEXT,
            max_val TEXT,
            mean_val REAL,
            std_dev REAL,
            sample_values TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id)
        )
    """)
    
    conn.commit()
    conn.close()

def save_to_dictionary(session_id, filename, summary, profile_data):
    conn = get_connection()
    cursor = conn.cursor()
    
    # Insert session
    if hasattr(conn, 'tpc_prepare'): # Postgres
        cursor.execute("INSERT INTO sessions (session_id, filename, summary) VALUES (%s, %s, %s) ON CONFLICT (session_id) DO UPDATE SET filename = EXCLUDED.filename, summary = EXCLUDED.summary",
                       (session_id, filename, summary))
    else: # SQLite
        cursor.execute("INSERT OR REPLACE INTO sessions (session_id, filename, summary) VALUES (?, ?, ?)",
                       (session_id, filename, summary))
    
    # Clear old dictionary for this session
    param_char = "%s" if hasattr(conn, 'tpc_prepare') else "?"
    cursor.execute(f"DELETE FROM data_dictionary WHERE session_id = {param_char}", (session_id,))
    
    # Insert columns with enhanced details
    for t_name, t_data in profile_data.items():
        for col in t_data.get("columns", []):
            query = f"""
                INSERT INTO data_dictionary 
                (session_id, table_name, column_name, dtype, null_pct, unique_count, min_val, max_val, mean_val, std_dev, sample_values)
                VALUES ({param_char}, {param_char}, {param_char}, {param_char}, {param_char}, {param_char}, {param_char}, {param_char}, {param_char}, {param_char}, {param_char})
            """
            cursor.execute(query, (
                session_id,
                t_name,
                col["name"],
                col["dtype"],
                col["null_pct"],
                col["unique_count"],
                str(col.get("min", "")),
                str(col.get("max", "")),
                col.get("mean"),
                col.get("std"),
                json.dumps(col.get("sample_values", []))
            ))
            
    conn.commit()
    conn.close()

def get_session_dictionary(session_id):
    conn = get_connection()
    # Use RealDictCursor for Postgres, or row_factory for SQLite
    if hasattr(conn, 'tpc_prepare'):
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        param_char = "%s"
    else:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        param_char = "?"
    
    cursor.execute(f"SELECT * FROM data_dictionary WHERE session_id = {param_char}", (session_id,))
    rows = cursor.fetchall()
    
    result = {}
    for row in rows:
        d_row = dict(row)
        t_name = d_row["table_name"]
        if t_name not in result:
            result[t_name] = []
        result[t_name].append(d_row)
        
    conn.close()
    return result
