"""
CRAB Agent Node — Analyst
═════════════════════════
Uses create_pandas_dataframe_agent for powerful data queries.
"""

from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent

from ..llm import get_llm
from ..data_loader import get_session_dataframes
from ..state import AgentState


def analyst_node(state: AgentState) -> dict:
    """Uses create_pandas_dataframe_agent for powerful data queries."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)

    if not dfs_dict:
        return {"tool_output": "No data files found in this session.", "error": "no_data"}

    llm = get_llm()

    # Get history excluding the current message
    history = state["messages"][:-1]
    last_msg = state["messages"][-1].content

    agent = create_pandas_dataframe_agent(
        llm,
        list(dfs_dict.values()),
        verbose=True,
        allow_dangerous_code=True,
        max_iterations=100000,
        handle_parsing_errors=True,
        agent_type="openai-tools", # Use tools for better memory handling
        prefix=f"""You are a master data analyst for the CRAB engine.
You have access to {len(dfs_dict)} DataFrames: {list(dfs_dict.keys())}
The DataFrames are mapped to variables df, df1, df2... in that exact order.

{state.get('graph_context', '')}

STRICT FORMATTING RULES:
1. You must only use the 'python_repl_ast' tool.
2. The 'Action Input' must contain ONLY valid Python code. NEVER append text or thoughts after the code.
3. If you get an error, rethink and try a different approach.
4. Do not output anything other than Thought: [your thought], Action: python_repl_ast, Action Input: [code].

The user wants clear, formatted answers with markdown tables. 
CRITICAL: Even if you provide a table, you MUST also provide a 2-3 sentence textual summary or interpretation of the results to provide context. Relate the numbers back to the user's question.
Whenever you mention the tool you used, refer to it as **python_repl_ast**."""
    )

    try:
        # Pass history as part of the agent input if supported, or manually inject into prompt
        # For simplicity and robustness with this specific agent, we'll summarize history or just pass it
        history_str = "\n".join([f"{m.type}: {m.content}" for m in history[-5:]]) # last 5 messages
        prompt_with_history = f"CONVERSATION HISTORY:\n{history_str}\n\nUSER QUESTION: {last_msg}"
        
        result = agent.invoke({"input": prompt_with_history})
        output = result.get("output", "Analysis complete but no output generated.")
        print(f"📊 ANALYST → Output length: {len(output)}")
        return {"tool_output": output}
    except Exception as e:
        error_msg = f"Analysis error: {str(e)}"
        print(f"❌ ANALYST ERROR: {error_msg}")
        return {"tool_output": error_msg, "error": str(e)}
