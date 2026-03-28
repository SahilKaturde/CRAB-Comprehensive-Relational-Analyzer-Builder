"""
CRAB Agent Node — Anomaly Detector
════════════════════════════════════
Detects outliers using IQR and Z-score methods across all numeric columns.
"""

import numpy as np
import pandas as pd
from langchain_core.messages import HumanMessage

from ..llm import get_llm
from ..data_loader import get_session_dataframes, get_tables_info
from ..state import AgentState


def _detect_outliers_iqr(series: pd.Series, factor: float = 1.5):
    """Returns boolean mask of outliers using IQR method."""
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    lower = q1 - factor * iqr
    upper = q3 + factor * iqr
    return (series < lower) | (series > upper), lower, upper


def _detect_outliers_zscore(series: pd.Series, threshold: float = 3.0):
    """Returns boolean mask of outliers using Z-score method."""
    mean = series.mean()
    std = series.std()
    if std == 0:
        return pd.Series([False] * len(series), index=series.index), mean, std
    z_scores = ((series - mean) / std).abs()
    return z_scores > threshold, mean, std


def anomaly_detector_node(state: AgentState) -> dict:
    """Detects outliers and anomalies across all numeric columns."""
    session_id = state["session_id"]
    dfs_dict = get_session_dataframes(session_id)

    if not dfs_dict:
        return {"tool_output": "No data found for anomaly detection."}

    last_msg = state["messages"][-1].content
    history = state["messages"][:-1]
    llm = get_llm()

    history_str = "\n".join([f"{m.type}: {m.content[:200]}" for m in history[-3:]])

    # ── Run anomaly detection on all numeric columns ──
    anomaly_reports = []

    for table_name, df in dfs_dict.items():
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not numeric_cols:
            anomaly_reports.append(f"**{table_name}**: No numeric columns for anomaly detection.")
            continue

        table_anomalies = []
        for col in numeric_cols:
            clean = df[col].dropna()
            if len(clean) < 10:
                continue

            # IQR method
            iqr_mask, iqr_lower, iqr_upper = _detect_outliers_iqr(clean)
            iqr_count = int(iqr_mask.sum())

            # Z-score method
            z_mask, z_mean, z_std = _detect_outliers_zscore(clean)
            z_count = int(z_mask.sum())

            if iqr_count > 0 or z_count > 0:
                outlier_vals = clean[iqr_mask | z_mask].head(5).tolist()
                outlier_vals_str = ", ".join([str(round(v, 2)) for v in outlier_vals])

                table_anomalies.append({
                    "column": col,
                    "iqr_outliers": iqr_count,
                    "zscore_outliers": z_count,
                    "iqr_bounds": f"[{round(iqr_lower, 2)}, {round(iqr_upper, 2)}]",
                    "mean": round(float(z_mean), 2),
                    "std": round(float(z_std), 2),
                    "sample_outliers": outlier_vals_str,
                    "total_rows": len(clean),
                })

        if table_anomalies:
            report_lines = [f"\n### 🔍 Table: **{table_name}** ({len(df)} rows)\n"]
            report_lines.append("| Column | IQR Outliers | Z-Score Outliers | IQR Bounds | Mean ± Std | Sample Values |")
            report_lines.append("|--------|-------------|-----------------|------------|-----------|---------------|")
            for a in table_anomalies:
                pct = round(a["iqr_outliers"] / a["total_rows"] * 100, 1)
                report_lines.append(
                    f"| {a['column']} | {a['iqr_outliers']} ({pct}%) | {a['zscore_outliers']} "
                    f"| {a['iqr_bounds']} | {a['mean']} ± {a['std']} | {a['sample_outliers']} |"
                )
            anomaly_reports.append("\n".join(report_lines))
        else:
            anomaly_reports.append(f"**{table_name}**: No significant outliers detected. Data looks clean! ✅")

    raw_report = "\n\n".join(anomaly_reports)

    # ── Ask LLM to interpret the anomaly report ──
    interpretation_prompt = f"""You are a data quality expert analyzing anomaly detection results.

CONVERSATION HISTORY:
{history_str}

USER QUESTION: "{last_msg}"

ANOMALY DETECTION RESULTS:
{raw_report}

Provide:
1. A brief summary of the most critical anomalies found
2. Which columns have the most concerning outliers and why
3. Potential business impact or data quality concerns
4. Recommended actions (e.g., investigate, clean, keep)

Keep the raw table in your response — it's useful for the user. Add your interpretation after."""

    try:
        response = llm.invoke([HumanMessage(content=interpretation_prompt)])
        output = response.content
        print(f"🔍 ANOMALY DETECTOR → Output length: {len(output)}")
        return {"tool_output": output}
    except Exception as e:
        # Fall back to raw report if LLM fails
        print(f"⚠️ ANOMALY DETECTOR → LLM interpretation failed, using raw report")
        return {"tool_output": f"## Anomaly Detection Report\n\n{raw_report}"}
