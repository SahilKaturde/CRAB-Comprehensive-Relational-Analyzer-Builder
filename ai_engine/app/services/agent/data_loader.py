"""
CRAB Agent — Data Loading Utilities
════════════════════════════════════
Session-based DataFrame loading and schema introspection.
"""

import os
import pandas as pd

SESSION_DIR = os.path.join(os.getcwd(), "sessions")


def get_session_dataframes(session_id: str) -> dict:
    """Loads all CSVs from a session into a dict of DataFrames."""
    session_path = os.path.join(SESSION_DIR, session_id)
    dfs = {}
    if os.path.exists(session_path):
        for file in os.listdir(session_path):
            if file.endswith(".csv"):
                df_name = file.replace(".csv", "")
                try:
                    dfs[df_name] = pd.read_csv(
                        os.path.join(session_path, file), low_memory=False
                    )
                except Exception:
                    pass
    return dfs


def get_tables_info(dfs_dict: dict) -> str:
    """Generates a concise schema summary for LLM context."""
    info_parts = []
    for name, df in dfs_dict.items():
        cols = []
        for c in df.columns:
            dtype = str(df[c].dtype)
            nulls = int(df[c].isnull().sum())
            uniq = int(df[c].nunique())
            cols.append(f"    {c} ({dtype}, {nulls} nulls, {uniq} unique)")
        info_parts.append(
            f"TABLE: {name} ({len(df)} rows, {len(df.columns)} cols)\n"
            + "\n".join(cols)
        )
    return "\n\n".join(info_parts)
