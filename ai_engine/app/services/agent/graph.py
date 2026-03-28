"""
CRAB Agent — Graph Construction & Public API
══════════════════════════════════════════════
Builds the LangGraph StateGraph, wires all nodes, compiles with checkpointing,
and exposes the public `run_chat_agent` function.
"""

import re
import traceback

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state import AgentState
from .nodes import (
    router_node,
    route_by_intent,
    ROUTE_MAP,
    analyst_node,
    plotter_node,
    statistician_node,
    general_node,
    responder_node,
    anomaly_detector_node,
    exporter_node,
    comparator_node,
)

# ════════════════════════════════════════════════════════
#  BUILD THE LANGGRAPH
# ════════════════════════════════════════════════════════

workflow = StateGraph(AgentState)

# Add all nodes
workflow.add_node("router", router_node)
workflow.add_node("analyst", analyst_node)
workflow.add_node("plotter", plotter_node)
workflow.add_node("statistician", statistician_node)
workflow.add_node("general", general_node)
workflow.add_node("anomaly_detector", anomaly_detector_node)
workflow.add_node("exporter", exporter_node)
workflow.add_node("comparator", comparator_node)
workflow.add_node("responder", responder_node)

# Entry point
workflow.set_entry_point("router")

# Conditional routing from router → specialist node
workflow.add_conditional_edges(
    "router",
    route_by_intent,
    {v: v for v in ROUTE_MAP.values()},   # all specialist node names
)

# All specialist nodes → responder → END
for node_name in ROUTE_MAP.values():
    workflow.add_edge(node_name, "responder")
workflow.add_edge("responder", END)

# Compile with checkpointing
checkpointer = MemorySaver()
chat_graph = workflow.compile(checkpointer=checkpointer)

print("✅ CRAB Agent Graph compiled with 9 nodes + checkpointing")


# ════════════════════════════════════════════════════════
#  PUBLIC API
# ════════════════════════════════════════════════════════

async def run_chat_agent(query: str, session_id: str, graph_context: str = "") -> dict:
    """
    Interface for the FastAPI endpoint.
    Returns: { "text": str, "images": list[str], "exports": list[dict] }
    """
    inputs = {
        "messages": [HumanMessage(content=query)],
        "session_id": session_id,
        "graph_context": graph_context,
        "intent": "",
        "tool_output": "",
        "images": [],
        "exports": [],
        "tables_info": "",
        "error": "",
    }

    config = {"configurable": {"thread_id": session_id}}

    try:
        result = await chat_graph.ainvoke(inputs, config=config)

        text = (
            result["messages"][-1].content
            if result["messages"]
            else "No response generated."
        )
        images = result.get("images", [])
        exports = result.get("exports", [])

        # Clean text — remove image markers (frontend handles images separately)
        text = re.sub(r"\[CHART_IMAGE:.*?\]", "", text).strip()

        return {"text": text, "images": images, "exports": exports}
    except Exception as e:
        traceback.print_exc()
        return {"text": f"Agent error: {str(e)}", "images": [], "exports": []}
