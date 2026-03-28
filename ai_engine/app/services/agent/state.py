"""
CRAB Agent — State Definition
═════════════════════════════
Shared TypedDict that flows through every LangGraph node.
"""

import operator
from typing import TypedDict, Annotated, List
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    session_id: str
    graph_context: str
    intent: str           # router decision
    tool_output: str      # intermediate results from tools
    images: list          # base64 encoded images from plotter
    exports: list         # downloadable file payloads from exporter
    tables_info: str      # cached table schemas
    error: str            # error tracking
