"""
CRAB Agent Package
═══════════════════
Re-exports the public API so existing imports continue to work:
    from app.services.agent import run_chat_agent
"""

from .graph import run_chat_agent, chat_graph

__all__ = ["run_chat_agent", "chat_graph"]
