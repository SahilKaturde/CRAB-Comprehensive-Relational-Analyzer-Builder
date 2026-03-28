"""
CRAB Agent Node — Router
═════════════════════════
Classifies user intent into one of 7 categories and routes accordingly.
"""

import os
import traceback
from langchain_core.messages import HumanMessage

from ..llm import get_llm
from ..state import AgentState


VALID_INTENTS = [
    "plot", "statistics", "analyze", "anomaly", "export", "compare", "general"
]

ROUTE_MAP = {
    "analyze":    "analyst",
    "plot":       "plotter",
    "statistics": "statistician",
    "anomaly":    "anomaly_detector",
    "export":     "exporter",
    "compare":    "comparator",
    "general":    "general",
}


def router_node(state: AgentState) -> dict:
    """Uses LLM to classify the user's intent, considering conversation history."""
    history = state["messages"][:-1]
    last_msg = state["messages"][-1].content

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ ROUTER ERROR: OPENROUTER_API_KEY is not set!")
        return {"intent": "analyze", "error": "missing_api_key"}

    llm = get_llm()

    history_str = "\n".join([f"{m.type}: {m.content[:200]}" for m in history[-3:]])

    classification_prompt = f"""Given the conversation history and the new user message, classify the intent into ONE of these categories:
- "plot" — user wants a chart, graph, visualization, plot, histogram, scatter, bar chart, pie chart, line graph
- "statistics" — user wants statistical analysis, correlations, distributions, mean/median/mode, p-values
- "analyze" — user wants to query data, filter, sort, find specific values, count, aggregate, explore data
- "anomaly" — user wants outlier detection, anomaly finding, unusual values, data quality issues
- "export" — user wants to download, export, save data as CSV/JSON/Excel
- "compare" — user wants to compare two tables, columns, or datasets, find overlap, diff, differences
- "general" — general question about the schema, greeting, or anything else

CONVERSATION HISTORY:
{history_str}

NEW USER MESSAGE: "{last_msg}"

Reply with ONLY the category word, nothing else."""

    try:
        response = llm.invoke([HumanMessage(content=classification_prompt)])
        intent = response.content.strip().lower().replace('"', '').replace("'", "")

        # Validate
        if intent not in VALID_INTENTS:
            for v in VALID_INTENTS:
                if v in intent:
                    intent = v
                    break
            else:
                intent = "analyze"

        print(f"🔀 ROUTER → Intent: {intent}")
        return {"intent": intent}
    except Exception as e:
        print(f"❌ ROUTER ERROR: {str(e)}")
        traceback.print_exc()
        return {"intent": "analyze", "error": str(e)}


def route_by_intent(state: AgentState) -> str:
    """Routes to the appropriate node based on classified intent."""
    intent = state.get("intent", "general")
    destination = ROUTE_MAP.get(intent, "general")
    print(f"🔀 ROUTING → {destination}")
    return destination
