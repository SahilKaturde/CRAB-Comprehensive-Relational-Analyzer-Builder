"""
CRAB Agent Node — Comparator
═════════════════════════════
Compares two tables or columns for overlap, differences, and reconciliation.
"""

import numpy as np
import pandas as pd
from langchain_core.messages import HumanMessage

from ..llm import get_llm
from ..data_loader import get_session_dataframes, get_tables_info
from ..state import AgentState


def comparator_node(state: AgentState) -> dict:
    """Compares two tables or columns for overlap, differences, and reconciliation."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)

    if not dfs_dict:
        return {"tool_output": "No data found for comparison."}

    if len(dfs_dict) < 2:
        return {
            "tool_output": (
                "⚠️ **Comparison requires at least 2 tables.**\n\n"
                "You currently have only 1 table loaded. Upload additional data "
                "to use the comparison feature.\n\n"
                "For single-table analysis, try asking me to:\n"
                "- Find duplicate rows\n"
                "- Compare columns within the table\n"
                "- Detect anomalies"
            )
        }

    last_msg = state["messages"][-1].content
    history = state["messages"][:-1]
    llm = get_llm()
    tables_info = get_tables_info(dfs_dict)

    history_str = "\n".join([f"{m.type}: {m.content[:300]}" for m in history[-3:]])

    table_names = list(dfs_dict.keys())

    # ── Structural comparison ──
    comparison_parts = []

    # Schema comparison
    comparison_parts.append("## 📊 Schema Comparison\n")
    comparison_parts.append("| Property | " + " | ".join(table_names) + " |")
    comparison_parts.append("|----------|" + "|".join(["-------"] * len(table_names)) + "|")

    comparison_parts.append(
        "| Rows | "
        + " | ".join([f"{len(dfs_dict[t]):,}" for t in table_names])
        + " |"
    )
    comparison_parts.append(
        "| Columns | "
        + " | ".join([str(len(dfs_dict[t].columns)) for t in table_names])
        + " |"
    )
    comparison_parts.append(
        "| Null % | "
        + " | ".join([
            f"{round(dfs_dict[t].isnull().sum().sum() / (len(dfs_dict[t]) * len(dfs_dict[t].columns)) * 100, 1)}%"
            for t in table_names
        ])
        + " |"
    )

    # Find shared columns
    all_col_sets = [set(dfs_dict[t].columns) for t in table_names]
    shared_cols = all_col_sets[0]
    for s in all_col_sets[1:]:
        shared_cols = shared_cols.intersection(s)

    comparison_parts.append(f"\n### 🔗 Shared Columns ({len(shared_cols)})")
    if shared_cols:
        comparison_parts.append(", ".join(f"`{c}`" for c in sorted(shared_cols)))

        # Value overlap analysis for shared columns
        comparison_parts.append("\n### 🔀 Value Overlap on Shared Columns\n")
        comparison_parts.append("| Column | " + " | ".join([f"{t} Unique" for t in table_names[:2]]) + " | Overlap | Overlap % |")
        comparison_parts.append("|--------|" + "|".join(["-------"] * (len(table_names[:2]) + 2)) + "|")

        t1, t2 = table_names[0], table_names[1]
        for col in sorted(shared_cols):
            vals1 = set(dfs_dict[t1][col].dropna().unique())
            vals2 = set(dfs_dict[t2][col].dropna().unique())
            overlap = vals1.intersection(vals2)
            total_unique = len(vals1.union(vals2))
            overlap_pct = round(len(overlap) / total_unique * 100, 1) if total_unique > 0 else 0

            comparison_parts.append(
                f"| {col} | {len(vals1):,} | {len(vals2):,} | {len(overlap):,} | {overlap_pct}% |"
            )
    else:
        comparison_parts.append("No shared columns found between tables.")

    # Unique columns per table
    for i, t in enumerate(table_names):
        others = set()
        for j, t2 in enumerate(table_names):
            if i != j:
                others.update(dfs_dict[t2].columns)
        unique = set(dfs_dict[t].columns) - others
        if unique:
            comparison_parts.append(f"\n### Columns unique to `{t}`: {', '.join(f'`{c}`' for c in sorted(unique))}")

    raw_comparison = "\n".join(comparison_parts)

    # ── Ask LLM to interpret ──
    interpretation_prompt = f"""You are a data reconciliation expert. Analyze this comparison and answer the user's question.

CONVERSATION HISTORY:
{history_str}

USER QUESTION: "{last_msg}"

TABLE COMPARISON DATA:
{raw_comparison}

Provide:
1. Key differences between the tables
2. How they might relate to each other (potential join keys)
3. Data quality observations
4. Recommendations for merging or reconciliation

Keep the comparison tables in your response. Add your interpretation afterward."""

    try:
        response = llm.invoke([HumanMessage(content=interpretation_prompt)])
        output = response.content
        print(f"🔄 COMPARATOR → Output length: {len(output)}")
        return {"tool_output": output}
    except Exception:
        print("⚠️ COMPARATOR → LLM interpretation failed, using raw report")
        return {"tool_output": raw_comparison}
