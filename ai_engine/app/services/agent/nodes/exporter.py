"""
CRAB Agent Node — Exporter
═══════════════════════════
Exports session data as downloadable CSV or JSON payloads.
"""

import io
import json
import base64

import pandas as pd
from langchain_core.messages import HumanMessage

from ..llm import get_llm
from ..data_loader import get_session_dataframes, get_tables_info
from ..state import AgentState


def exporter_node(state: AgentState) -> dict:
    """Exports data as downloadable CSV/JSON based on user request."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)

    if not dfs_dict:
        return {"tool_output": "No data found to export.", "exports": []}

    last_msg = state["messages"][-1].content
    history = state["messages"][:-1]
    llm = get_llm()
    tables_info = get_tables_info(dfs_dict)
    history_str = "\n".join([f"{m.type}: {m.content[:200]}" for m in history[-3:]])

    # ── Ask LLM which table/filter/format to export ──
    export_prompt = f"""Given the conversation history and the user's latest request, determine what to export.

AVAILABLE TABLES:
{tables_info[:2000]}

CONVERSATION HISTORY:
{history_str}

USER REQUEST: "{last_msg}"

Reply in this EXACT JSON format (no markdown fences):
{{
    "table": "<table_name or 'all'>",
    "format": "<csv or json>",
    "limit": <number of rows or null for all>,
    "columns": [<list of column names or empty list for all>],
    "description": "<brief description of what's being exported>"
}}"""

    try:
        response = llm.invoke([HumanMessage(content=export_prompt)])
        raw_response = response.content.strip()
        # Clean markdown fences if LLM adds them
        raw_response = raw_response.replace("```json", "").replace("```", "").strip()
        config = json.loads(raw_response)
    except Exception:
        # Default: export first table as CSV
        first_table = list(dfs_dict.keys())[0]
        config = {
            "table": first_table,
            "format": "csv",
            "limit": None,
            "columns": [],
            "description": f"Full export of {first_table}",
        }

    exports = []
    tables_to_export = list(dfs_dict.keys()) if config["table"] == "all" else [config["table"]]

    for table_name in tables_to_export:
        if table_name not in dfs_dict:
            continue

        df = dfs_dict[table_name].copy()

        # Apply column filter
        if config.get("columns"):
            valid_cols = [c for c in config["columns"] if c in df.columns]
            if valid_cols:
                df = df[valid_cols]

        # Apply row limit
        if config.get("limit") and isinstance(config["limit"], int):
            df = df.head(config["limit"])

        # Generate the file content
        fmt = config.get("format", "csv").lower()
        if fmt == "json":
            content = df.to_json(orient="records", indent=2)
            filename = f"{table_name}_export.json"
            mime = "application/json"
        else:
            buf = io.StringIO()
            df.to_csv(buf, index=False)
            content = buf.getvalue()
            filename = f"{table_name}_export.csv"
            mime = "text/csv"

        encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        exports.append({
            "filename": filename,
            "mime": mime,
            "data": encoded,
            "rows": len(df),
            "columns": len(df.columns),
        })

    # Build summary text
    description = config.get("description", "Data export")
    total_rows = sum(e["rows"] for e in exports)
    total_files = len(exports)

    summary = (
        f"📦 **Export Ready:** {description}\n\n"
        f"- **Files:** {total_files}\n"
        f"- **Total Rows:** {total_rows:,}\n"
        f"- **Format:** {config.get('format', 'csv').upper()}\n\n"
        f"Click the download button below to save your data."
    )

    print(f"📦 EXPORTER → {total_files} files, {total_rows} rows")
    return {"tool_output": summary, "exports": exports}
