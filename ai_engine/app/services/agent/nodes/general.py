"""
CRAB Agent Node — General
═════════════════════════
Handles general questions about the data schema, greetings, and help.
"""

from langchain_core.messages import HumanMessage

from ..llm import get_llm
from ..data_loader import get_session_dataframes, get_tables_info
from ..state import AgentState


def general_node(state: AgentState) -> dict:
    """Handles general questions about the data schema."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)

    if not dfs_dict:
        return {"tool_output": "No data loaded. Please upload data through the Analyzer pipeline first."}

    tables_info = get_tables_info(dfs_dict)
    history = state["messages"][:-1]
    last_msg = state["messages"][-1].content

    llm = get_llm()

    history_str = "\n".join([f"{m.type}: {m.content}" for m in history[-5:]])

    prompt = f"""You are a helpful data assistant for the CRAB Analysis Engine.

AVAILABLE DATA:
{tables_info}

Relationship Context: {state.get('graph_context', 'Not provided')}

CONVERSATION HISTORY:
{history_str}

NEW USER MESSAGE: "{last_msg}"

Answer the question based on the available data and the conversation history. Be concise and helpful.
If the user asks what they can do, tell them they can:
- Ask data questions (e.g., "How many rows in users?", "Show me the top 5...")
- Request charts (e.g., "Plot a bar chart of sales by region", "Line graph of revenue over time")
- Get statistics (e.g., "What's the correlation between X and Y?", "Distribution of ages")
- Detect anomalies (e.g., "Find outliers in the price column", "Any unusual values?")
- Export data (e.g., "Export filtered results as CSV", "Download the top 10 rows")
- Compare tables (e.g., "Compare orders and customers", "What's the overlap between A and B?")
- Explore relationships (e.g., "How are these tables connected?")"""

    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        return {"tool_output": response.content}
    except Exception as e:
        return {"tool_output": f"Error: {str(e)}", "error": str(e)}
