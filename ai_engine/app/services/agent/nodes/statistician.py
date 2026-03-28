"""
CRAB Agent Node — Statistician
═══════════════════════════════
Deep statistical analysis with correlations, distributions, and insights.
"""

import numpy as np
from langchain_core.messages import HumanMessage

from ..llm import get_llm
from ..data_loader import get_session_dataframes
from ..state import AgentState


def statistician_node(state: AgentState) -> dict:
    """Performs deep statistical analysis on the data."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)

    if not dfs_dict:
        return {"tool_output": "No data found for statistical analysis."}

    last_msg = state["messages"][-1].content
    history = state["messages"][:-1]
    llm = get_llm()

    history_str = "\n".join([f"{m.type}: {m.content[:300]}" for m in history[-3:]])

    # Build a comprehensive stats context
    stats_parts = []
    for name, df in dfs_dict.items():
        desc = df.describe(include="all").to_string()

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        corr_str = ""
        if len(numeric_cols) >= 2:
            corr = df[numeric_cols].corr().round(3).to_string()
            corr_str = f"\nCorrelation Matrix:\n{corr}"

        null_info = df.isnull().sum()
        null_str = null_info[null_info > 0].to_string() if null_info.any() else "No nulls"

        stats_parts.append(f"""
═══ TABLE: {name} ({len(df)} rows, {len(df.columns)} cols) ═══
Descriptive Statistics:
{desc}
{corr_str}
Null Values:
{null_str}
""")

    full_stats = "\n".join(stats_parts)

    analysis_prompt = f"""You are a senior data statistician. Analyze this data based on the user's question and conversation history.

STATISTICAL CONTEXT:
{full_stats[:4000]}

CONVERSATION HISTORY:
{history_str}

USER QUESTION: "{last_msg}"

Provide a thorough statistical analysis. Include:
- Key findings with exact numbers
- Statistical significance observations
- Distribution characteristics
- Correlation insights (if relevant)
- Outlier observations
- Actionable conclusions

Format your response clearly with bullet points and sections."""

    try:
        response = llm.invoke([HumanMessage(content=analysis_prompt)])
        output = response.content
        print(f"📈 STATISTICIAN → Output length: {len(output)}")
        return {"tool_output": output}
    except Exception as e:
        return {"tool_output": f"Statistical analysis error: {str(e)}", "error": str(e)}
