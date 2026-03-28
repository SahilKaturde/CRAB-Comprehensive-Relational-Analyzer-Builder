"""
CRAB Agent Node — Plotter
═════════════════════════
Generates matplotlib / seaborn charts and returns them as base64 images.
"""

import io
import re
import base64
import builtins
import traceback

import pandas as pd
import numpy as np

try:
    import seaborn as sns
    sns.set_theme(
        style="whitegrid",
        palette=["#FF3B30", "#4DA6FF", "#34C759", "#1A1A1A", "#FF9500", "#8B5CF6"],
    )
except Exception:
    sns = None

from langchain_core.messages import HumanMessage

from ..llm import get_llm
from ..data_loader import get_session_dataframes, get_tables_info
from ..state import AgentState

# Modules that are BLOCKED inside chart-generation sandbox
BLOCKED_MODULES = frozenset({
    "os", "subprocess", "sys", "shutil", "pathlib",
    "socket", "http", "urllib", "requests",
    "ftplib", "smtplib", "ctypes", "webbrowser",
})


def _clean_code(code: str) -> str:
    """Strip markdown fences and remove dangerous calls."""
    code = re.sub(r"^```(?:python)?\n?", "", code)
    code = re.sub(r"\n?```$", "", code)
    code = code.strip()

    code = re.sub(r"(?:plt|fig|ax|figure)\.savefig\s*\([^)]*\)", "# savefig removed", code)
    code = re.sub(r"plt\.show\s*\(\s*\)", "# show removed", code)
    code = re.sub(r"fig\.show\s*\(\s*\)", "# show removed", code)

    code = re.sub(r"import\s+os\b", "# blocked import", code)
    code = re.sub(r"import\s+subprocess\b", "# blocked import", code)
    code = re.sub(r"import\s+sys\b", "# blocked import", code)
    code = re.sub(r"import\s+shutil\b", "# blocked import", code)

    return code


def plotter_node(state: AgentState) -> dict:
    """Generates charts using matplotlib/seaborn based on user request."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)

    if not dfs_dict:
        return {"tool_output": "No data found for plotting.", "images": []}

    last_msg = state["messages"][-1].content
    history = state["messages"][:-1]
    llm = get_llm()

    tables_info = get_tables_info(dfs_dict)
    history_str = "\n".join([f"{m.type}: {m.content[:300]}" for m in history[-3:]])

    # Build variable-mapping instructions
    df_names = list(dfs_dict.keys())
    if len(df_names) == 1:
        var_instructions = f"The DataFrame is loaded as: {df_names[0]}"
    else:
        var_instructions = "The DataFrames are loaded as:\n" + chr(10).join(
            [
                f"  {name}  # pd.DataFrame, {len(df)} rows, columns: {list(df.columns)[:8]}"
                for name, df in dfs_dict.items()
            ]
        )

    code_prompt = f"""Generate matplotlib/seaborn Python code to visualize data. Output ONLY raw Python code.

DATA SCHEMA:
{tables_info[:3000]}

{var_instructions}

CONVERSATION HISTORY:
{history_str}

NEW REQUEST: "{last_msg}"

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

Output RAW Python code only. No markdown. No ``` fences. No explanation text."""

    try:
        response = llm.invoke([HumanMessage(content=code_prompt)])
        code = _clean_code(response.content.strip())

        print(f"🎨 PLOTTER → Generated code:\n{code[:300]}...")

        plt.close("all")

        # ─── Sandboxed execution ───
        _real_import = __import__

        def safe_import(name, *args, **kwargs):
            root_module = name.split(".")[0]
            if root_module in BLOCKED_MODULES:
                raise ImportError(f"Import of '{name}' is not allowed in chart generation.")
            return _real_import(name, *args, **kwargs)

        safe_builtins = {k: v for k, v in vars(builtins).items()}
        safe_builtins["__import__"] = safe_import
        safe_builtins.pop("open", None)
        safe_builtins.pop("exec", None)
        safe_builtins.pop("compile", None)

        exec_globals = {
            "__builtins__": safe_builtins,
            "pd": pd,
            "np": np,
            "plt": plt,
        }
        if sns is not None:
            exec_globals["sns"] = sns
        exec_locals = {**dfs_dict}

        exec(code, exec_globals, exec_locals)

        # Capture the figure as base64
        buf = io.BytesIO()
        fig = plt.gcf()
        if fig.get_axes():
            fig.tight_layout()
            fig.savefig(
                buf, format="png", dpi=150, bbox_inches="tight",
                facecolor="white", edgecolor="none",
            )
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode("utf-8")
            plt.close("all")

            print(f"🎨 PLOTTER → Chart generated ({len(img_base64)} chars)")
            return {
                "tool_output": f"Here's the chart for: '{last_msg}'",
                "images": [img_base64],
            }
        else:
            plt.close("all")
            return {
                "tool_output": "The chart code ran but didn't produce a visible figure. Try being more specific about what to plot.",
                "images": [],
            }

    except Exception as e:
        plt.close("all")
        error_trace = traceback.format_exc()
        print(f"❌ PLOTTER ERROR: {error_trace}")
        return {
            "tool_output": f"Chart generation failed: {str(e)}. Try something like 'plot a bar chart of [column] from [table]'.",
            "images": [],
            "error": str(e),
        }
