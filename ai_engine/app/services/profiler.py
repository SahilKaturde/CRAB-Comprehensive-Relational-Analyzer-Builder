import os
import pandas as pd
from app.core.config import SESSION_DIR
from app.services.discovery import detect_enterprise_schema

def run_data_profiling(session_id):
    """Computes per-table data quality metrics for the given session."""
    session_path = os.path.join(SESSION_DIR, session_id)
    if not os.path.exists(session_path):
        return None
    
    # Load all CSVs from the session
    tables = {}
    for file in os.listdir(session_path):
        if file.endswith(".csv"):
            t_name = file.replace(".csv", "")
            tables[t_name] = pd.read_csv(os.path.join(session_path, file), low_memory=False)
    
    if not tables:
        return None
    
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
            
            col_min = ""
            col_max = ""
            col_mean = None
            col_std = None
            
            if pd.api.types.is_numeric_dtype(df[col]):
                col_min = str(df[col].min())
                col_max = str(df[col].max())
                col_mean = float(df[col].mean()) if not df[col].isnull().all() else None
                col_std = float(df[col].std()) if not df[col].isnull().all() else None
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                col_min = str(df[col].min())
                col_max = str(df[col].max())

            column_profiles.append({
                "name": col,
                "dtype": str(df[col].dtype),
                "null_count": null_count,
                "null_pct": round(null_count / rows * 100, 1) if rows > 0 else 0,
                "unique_count": unique_count,
                "unique_pct": round(unique_count / rows * 100, 1) if rows > 0 else 0,
                "min": col_min,
                "max": col_max,
                "mean": col_mean,
                "std": col_std,
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
    
    # Compute depth code
    depth_code = 0
    try:
        discovery_result = detect_enterprise_schema(tables)
        rels = discovery_result["relationships"]
        graph = {}
        for r in rels:
            a, b = r["Entity A"], r["Entity B"]
            if a not in graph: graph[a] = []
            graph[a].append(b)
        
        def max_depth(node, visited=None):
            if visited is None: visited = set()
            if node in visited or node not in graph: return 0
            visited.add(node)
            return 1 + max((max_depth(n, visited.copy()) for n in graph[node]), default=0)
        
        for node in graph:
            d = max_depth(node)
            if d > depth_code: depth_code = d
    except:
        depth_code = 0
    
    return {
        "profile": profile,
        "summary": {
            "total_tables": len(tables),
            "total_rows": total_rows,
            "total_columns": total_columns,
            "overall_completeness": overall_completeness,
            "depth_code": depth_code
        }
    }
