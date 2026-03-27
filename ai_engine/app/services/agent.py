"""
CRAB Advanced Agentic Data Analysis Engine
═══════════════════════════════════════════
Multi-node LangGraph with:
  • Router → classifies intent
  • Analyst → pandas queries and data exploration  
  • Plotter → generates matplotlib/seaborn charts (returned as base64)
  • Statistician → deep statistical analysis
  • Responder → synthesizes final answer

Checkpointing via MemorySaver for conversation memory.
"""

import os
import io
import re
import json
import base64
import traceback
import builtins
import pandas as pd
import numpy as np
import seaborn as sns
try:
    sns.set_theme(style="whitegrid", palette=["#FF3B30", "#4DA6FF", "#34C759", "#1A1A1A", "#FF9500", "#8B5CF6"])
except Exception:
    pass
from typing import TypedDict, Annotated, List, Optional, Literal
from langchain_openai import ChatOpenAI
from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
import operator

# ════════════════════════════════════════════════════════
#  CONSTANTS
# ════════════════════════════════════════════════════════

SESSION_DIR = os.path.join(os.getcwd(), "sessions")

def get_llm():
    return ChatOpenAI(
        model="openai/gpt-4o-mini",
        temperature=0,
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY")
    )

# ════════════════════════════════════════════════════════
#  STATE DEFINITION
# ════════════════════════════════════════════════════════

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    session_id: str
    graph_context: str
    intent: str           # router decision: "analyze", "plot", "statistics", "general"
    tool_output: str      # intermediate results from tools
    images: list          # base64 encoded images from plotter
    tables_info: str      # cached table schemas
    error: str            # error tracking

# ════════════════════════════════════════════════════════
#  DATA LOADING UTILITIES
# ════════════════════════════════════════════════════════

def get_session_dataframes(session_id: str) -> dict:
    """Loads all CSVs from a session into a dict of DataFrames."""
    session_path = os.path.join(SESSION_DIR, session_id)
    dfs = {}
    if os.path.exists(session_path):
        for file in os.listdir(session_path):
            if file.endswith(".csv"):
                df_name = file.replace(".csv", "")
                try:
                    dfs[df_name] = pd.read_csv(os.path.join(session_path, file))
                except Exception:
                    pass
    return dfs

def get_tables_info(dfs_dict: dict) -> str:
    """Generates a concise schema summary for LLM context."""
    info_parts = []
    for name, df in dfs_dict.items():
        cols = []
        for c in df.columns:
            dtype = str(df[c].dtype)
            nulls = int(df[c].isnull().sum())
            uniq = int(df[c].nunique())
            cols.append(f"    {c} ({dtype}, {nulls} nulls, {uniq} unique)")
        info_parts.append(f"TABLE: {name} ({len(df)} rows, {len(df.columns)} cols)\n" + "\n".join(cols))
    return "\n\n".join(info_parts)

# ════════════════════════════════════════════════════════
#  NODE 1: ROUTER — Classifies user intent
# ════════════════════════════════════════════════════════

def router_node(state: AgentState) -> dict:
    """Uses LLM to classify the user's intent."""
    last_msg = state["messages"][-1].content
    
    llm = get_llm()
    
    classification_prompt = f"""Classify this user message into ONE of these categories:
- "plot" — user wants a chart, graph, visualization, plot, histogram, scatter, bar chart, pie chart, line graph
- "statistics" — user wants statistical analysis, correlations, distributions, outliers, mean/median/mode
- "analyze" — user wants to query data, filter, sort, find specific values, count, aggregate, explore data
- "general" — general question about the schema, greeting, or anything else

User message: "{last_msg}"

Reply with ONLY the category word, nothing else."""

    try:
        response = llm.invoke([HumanMessage(content=classification_prompt)])
        intent = response.content.strip().lower().replace('"', '').replace("'", "")
        
        # Validate
        valid = ["plot", "statistics", "analyze", "general"]
        if intent not in valid:
            # Fuzzy match
            for v in valid:
                if v in intent:
                    intent = v
                    break
            else:
                intent = "analyze"
        
        print(f"🔀 ROUTER → Intent: {intent}")
        return {"intent": intent}
    except Exception as e:
        print(f"Router error: {e}")
        return {"intent": "analyze"}

# ════════════════════════════════════════════════════════
#  NODE 2: ANALYST — Pandas Agent for data queries
# ════════════════════════════════════════════════════════

def analyst_node(state: AgentState) -> dict:
    """Uses create_pandas_dataframe_agent for powerful data queries."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)
    
    if not dfs_dict:
        return {"tool_output": "No data files found in this session.", "error": "no_data"}
    
    llm = get_llm()
    
    # Create the pandas agent with all dataframes
    agent = create_pandas_dataframe_agent(
        llm,
        list(dfs_dict.values()),
        verbose=True,
        allow_dangerous_code=True,
        max_iterations=100000,
        handle_parsing_errors=True,
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
    
    last_msg = state["messages"][-1].content
    
    try:
        result = agent.invoke({"input": last_msg})
        output = result.get("output", "Analysis complete but no output generated.")
        print(f"📊 ANALYST → Output length: {len(output)}")
        return {"tool_output": output}
    except Exception as e:
        error_msg = f"Analysis error: {str(e)}"
        print(f"❌ ANALYST ERROR: {error_msg}")
        return {"tool_output": error_msg, "error": str(e)}

# ════════════════════════════════════════════════════════
#  NODE 3: PLOTTER — Generates matplotlib/seaborn charts
# ════════════════════════════════════════════════════════

def plotter_node(state: AgentState) -> dict:
    """Generates charts using matplotlib/seaborn based on user request."""
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)
    
    if not dfs_dict:
        return {"tool_output": "No data found for plotting.", "images": []}
    
    last_msg = state["messages"][-1].content
    llm = get_llm()
    
    # Build context about available data
    tables_info = get_tables_info(dfs_dict)
    
    # Build variable mapping instructions
    df_names = list(dfs_dict.keys())
    if len(df_names) == 1:
        var_instructions = f"The DataFrame is loaded as: {df_names[0]}"
    else:
        var_instructions = "The DataFrames are loaded as:\n" + chr(10).join(
            [f'  {name}  # pd.DataFrame, {len(df)} rows, columns: {list(df.columns)[:8]}' for name, df in dfs_dict.items()]
        )
    
    code_prompt = f"""Generate matplotlib/seaborn Python code to visualize data. Output ONLY raw Python code.

DATA SCHEMA:
{tables_info[:3000]}

{var_instructions}

REQUEST: "{last_msg}"

ALREADY IMPORTED & AVAILABLE:
- matplotlib.pyplot as plt
- pandas as pd
- numpy as np
- seaborn as sns
- All DataFrames are already loaded by their table names listed above.

STRICT RULES - FOLLOW ALL:
1. Start with: plt.figure(figsize=(10, 6))
2. NEVER use plt.savefig(), fig.savefig() - FORBIDDEN
3. NEVER use plt.show() - FORBIDDEN
4. NEVER use open(), write(), or any file operations - FORBIDDEN
5. NEVER import os, subprocess, sys, shutil - FORBIDDEN
6. You CAN import from: sklearn, scipy, collections, itertools, math, datetime
7. Just create the figure with plt/sns commands, it is captured automatically
8. Use these brand colors: #FF3B30, #4DA6FF, #34C759, #1A1A1A, #FF9500, #8B5CF6
9. Always add a descriptive title and axis labels
10. Use plt.tight_layout() at the end
11. For categorical data with many labels, rotate x-ticks: plt.xticks(rotation=45, ha='right')

CHART TYPE GUIDANCE (pick the BEST one for the request):
- Bar chart: comparisons between categories
- Line chart: trends over time or sequences
- Scatter plot: correlations between two numeric columns
- Histogram: distribution of a single column
- Pie chart: proportions of categories (use plt.pie with autopct='%1.1f%%')
- Box plot: distribution comparison across groups
- Heatmap: correlation matrix (sns.heatmap)
- Violin plot: distribution shape comparison (sns.violinplot)
- Pair plot: multi-variable relationships (sns.pairplot - returns fig directly)

Output RAW Python code only. No markdown. No ``` fences. No explanation text."""
    
    try:
        response = llm.invoke([HumanMessage(content=code_prompt)])
        code = response.content.strip()
        
        # Aggressive cleanup of LLM output
        code = re.sub(r'^```(?:python)?\n?', '', code)
        code = re.sub(r'\n?```$', '', code)
        code = code.strip()
        
        # Remove ANY savefig/show calls the LLM might sneak in
        code = re.sub(r'(?:plt|fig|ax|figure)\.savefig\s*\([^)]*\)', '# savefig removed', code)
        code = re.sub(r'plt\.show\s*\(\s*\)', '# show removed', code)
        code = re.sub(r'fig\.show\s*\(\s*\)', '# show removed', code)
        
        # Remove dangerous imports via regex
        code = re.sub(r'import\s+os\b', '# blocked import', code)
        code = re.sub(r'import\s+subprocess\b', '# blocked import', code)
        code = re.sub(r'import\s+sys\b', '# blocked import', code)
        code = re.sub(r'import\s+shutil\b', '# blocked import', code)
        
        print(f"🎨 PLOTTER → Generated code:\n{code[:300]}...")
        
        # Clear any existing figures
        plt.close('all')
        
        # - Controlled sandbox: allow imports except dangerous ones -
        BLOCKED_MODULES = {
            'os', 'subprocess', 'sys', 'shutil', 'pathlib',
            'socket', 'http', 'urllib', 'requests',
            'ftplib', 'smtplib', 'ctypes', 'webbrowser'
        }
        
        _real_import = __import__
        
        def safe_import(name, *args, **kwargs):
            root_module = name.split('.')[0]
            if root_module in BLOCKED_MODULES:
                raise ImportError(f"Import of '{name}' is not allowed in chart generation.")
            return _real_import(name, *args, **kwargs)
        
        # Copy full builtins but replace import and remove file ops
        safe_builtins = {k: v for k, v in vars(builtins).items()}
        safe_builtins['__import__'] = safe_import
        safe_builtins.pop('open', None)
        safe_builtins.pop('exec', None)       # no nested exec
        safe_builtins.pop('compile', None)     # no compile
        
        exec_globals = {
            '__builtins__': safe_builtins,
            'pd': pd,
            'np': np,
            'plt': plt,
        }
        if sns is not None:
            exec_globals['sns'] = sns
        exec_locals = {**dfs_dict}
        
        exec(code, exec_globals, exec_locals)
        
        # Capture the figure as base64
        buf = io.BytesIO()
        fig = plt.gcf()
        if fig.get_axes():
            fig.tight_layout()
            fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='white', edgecolor='none')
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            plt.close('all')
            
            print(f"🎨 PLOTTER → Chart generated ({len(img_base64)} chars)")
            return {
                "tool_output": f"Here's the chart for: '{last_msg}'",
                "images": [img_base64]
            }
        else:
            plt.close('all')
            return {
                "tool_output": "The chart code ran but didn't produce a visible figure. Try being more specific about what to plot.",
                "images": []
            }
        
    except Exception as e:
        plt.close('all')
        error_trace = traceback.format_exc()
        print(f"❌ PLOTTER ERROR: {error_trace}")
        return {
            "tool_output": f"Chart generation failed: {str(e)}. Try something like 'plot a bar chart of [column] from [table]'.",
            "images": [],
            "error": str(e)
        }

# ════════════════════════════════════════════════════════
#  NODE 4: STATISTICIAN — Deep statistical analysis
# ════════════════════════════════════════════════════════

def statistician_node(state: AgentState) -> dict:
    """Performs deep statistical analysis on the data."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)
    
    if not dfs_dict:
        return {"tool_output": "No data found for statistical analysis."}
    
    last_msg = state["messages"][-1].content
    llm = get_llm()
    
    # Build a comprehensive stats context
    stats_parts = []
    for name, df in dfs_dict.items():
        # Basic describe
        desc = df.describe(include='all').to_string()
        
        # Correlation matrix for numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        corr_str = ""
        if len(numeric_cols) >= 2:
            corr = df[numeric_cols].corr().round(3).to_string()
            corr_str = f"\nCorrelation Matrix:\n{corr}"
        
        # Null analysis
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
    
    analysis_prompt = f"""You are a senior data statistician. Analyze this data based on the user's question.

STATISTICAL CONTEXT:
{full_stats[:4000]}

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

# ════════════════════════════════════════════════════════
#  NODE 5: GENERAL — Schema info and general questions
# ════════════════════════════════════════════════════════

def general_node(state: AgentState) -> dict:
    """Handles general questions about the data schema."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)
    
    if not dfs_dict:
        return {"tool_output": "No data loaded. Please upload data through the Analyzer pipeline first."}
    
    tables_info = get_tables_info(dfs_dict)
    last_msg = state["messages"][-1].content
    
    llm = get_llm()
    
    prompt = f"""You are a helpful data assistant for the CRAB Analysis Engine.

AVAILABLE DATA:
{tables_info}

Relationship Context: {state.get('graph_context', 'Not provided')}

USER: "{last_msg}"

Answer the question based on the available data. Be concise and helpful.
If the user asks what they can do, tell them they can:
- Ask data questions (e.g., "How many rows in users?", "Show me the top 5...")
- Request charts (e.g., "Plot a bar chart of sales by region", "Line graph of revenue over time")
- Get statistics (e.g., "What's the correlation between X and Y?", "Distribution of ages")
- Explore relationships (e.g., "How are these tables connected?")"""

    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        return {"tool_output": response.content}
    except Exception as e:
        return {"tool_output": f"Error: {str(e)}", "error": str(e)}

# ════════════════════════════════════════════════════════
#  NODE 6: RESPONDER — Formats the final response
# ════════════════════════════════════════════════════════

def responder_node(state: AgentState) -> dict:
    """Formats the final response message."""
    tool_output = state.get("tool_output", "")
    intent = state.get("intent", "general")
    images = state.get("images", [])
    
    # Bold common tool names/addresses for visual clarity
    tool_output = re.sub(r'(python_repl_ast|router_node|analyst_node|plotter_node|statistician_node|general_node)', r'**\1**', tool_output)
    
    # Construct response with metadata
    if images:
        response_text = tool_output + "\n\n" + "\n".join([f"[CHART_IMAGE:{img[:20]}...]" for img in images])
    else:
        response_text = tool_output
    
    print(f"✅ RESPONDER → Intent: {intent}, Images: {len(images)}, Output: {len(response_text)} chars")
    
    return {
        "messages": [AIMessage(content=response_text)]
    }

# ════════════════════════════════════════════════════════
#  ROUTING LOGIC
# ════════════════════════════════════════════════════════

def route_by_intent(state: AgentState) -> str:
    """Routes to the appropriate node based on classified intent."""
    intent = state.get("intent", "general")
    route_map = {
        "analyze": "analyst",
        "plot": "plotter",
        "statistics": "statistician",
        "general": "general"
    }
    destination = route_map.get(intent, "general")
    print(f"🔀 ROUTING → {destination}")
    return destination

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
workflow.add_node("responder", responder_node)

# Entry point
workflow.set_entry_point("router")

# Conditional routing from router
workflow.add_conditional_edges(
    "router",
    route_by_intent,
    {
        "analyst": "analyst",
        "plotter": "plotter",
        "statistician": "statistician",
        "general": "general"
    }
)

# All specialist nodes lead to responder
workflow.add_edge("analyst", "responder")
workflow.add_edge("plotter", "responder")
workflow.add_edge("statistician", "responder")
workflow.add_edge("general", "responder")

# Responder leads to END
workflow.add_edge("responder", END)

# Compile with checkpointing
checkpointer = MemorySaver()
chat_graph = workflow.compile(checkpointer=checkpointer)

print("✅ CRAB Agent Graph compiled with 6 nodes + checkpointing")

# ════════════════════════════════════════════════════════
#  PUBLIC API
# ════════════════════════════════════════════════════════

async def run_chat_agent(query: str, session_id: str, graph_context: str = "") -> dict:
    """
    Interface for the FastAPI endpoint.
    Returns: { "text": str, "images": list[str] }
    """
    inputs = {
        "messages": [HumanMessage(content=query)],
        "session_id": session_id,
        "graph_context": graph_context,
        "intent": "",
        "tool_output": "",
        "images": [],
        "tables_info": "",
        "error": ""
    }
    
    # Use session_id as thread_id for conversation memory
    config = {"configurable": {"thread_id": session_id}}
    
    try:
        result = await chat_graph.ainvoke(inputs, config=config)
        
        text = result["messages"][-1].content if result["messages"] else "No response generated."
        images = result.get("images", [])
        
        # Clean text — remove image markers (frontend handles images separately)
        text = re.sub(r'\[CHART_IMAGE:.*?\]', '', text).strip()
        
        return {
            "text": text,
            "images": images
        }
    except Exception as e:
        traceback.print_exc()
        return {
            "text": f"Agent error: {str(e)}",
            "images": []
        }
