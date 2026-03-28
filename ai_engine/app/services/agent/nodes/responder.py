"""
CRAB Agent Node — Responder
════════════════════════════
Formats the final response message with text, images, and exports.
"""

import re
from langchain_core.messages import AIMessage

from ..state import AgentState


def responder_node(state: AgentState) -> dict:
    """Formats the final response message."""
    tool_output = state.get("tool_output", "")
    intent = state.get("intent", "general")
    images = state.get("images", [])
    exports = state.get("exports", [])

    # Bold common tool names for visual clarity
    tool_output = re.sub(
        r"(python_repl_ast|router_node|analyst_node|plotter_node|statistician_node|general_node|anomaly_detector_node|exporter_node|comparator_node)",
        r"**\1**",
        tool_output,
    )

    # Construct response with metadata
    response_text = tool_output
    if images:
        response_text += "\n\n" + "\n".join(
            [f"[CHART_IMAGE:{img[:20]}...]" for img in images]
        )

    print(
        f"✅ RESPONDER → Intent: {intent}, Images: {len(images)}, "
        f"Exports: {len(exports)}, Output: {len(response_text)} chars"
    )

    return {"messages": [AIMessage(content=response_text)]}
