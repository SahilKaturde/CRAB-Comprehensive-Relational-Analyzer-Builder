"""
CRAB Agent — LLM Factory
═════════════════════════
Shared LLM instance builder used by every node.
"""

import os
from langchain_openai import ChatOpenAI


def get_llm():
    """Returns a configured ChatOpenAI instance via OpenRouter."""
    return ChatOpenAI(
        model="openai/gpt-4o-mini",
        temperature=0,
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
    )
