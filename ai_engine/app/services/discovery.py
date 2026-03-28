import json
import itertools
import pandas as pd
from langchain_core.messages import HumanMessage
from app.core.config import llm

def detect_enterprise_schema(tables):
    """
    Deterministic Relationship Discovery using Bidirectional Inclusion Dependency.
    Identifies PKs, FKs, and Junction tables for M:M mapping.
    """
    pks = {}
    fks = []
    
    # STEP 1: Identify Primary Keys (PKs)
    for t_name, df in tables.items():
        found_pk = False
        for col in df.columns:
            if str(col).lower().endswith("_id"):
                base_col = str(col).lower().replace("_id", "")
                possible_plurals = [base_col, base_col + "s", base_col + "es", base_col[:-1] + "ies"]
                if t_name.lower() in possible_plurals and df[col].is_unique:
                    pks[t_name] = col
                    found_pk = True
                    break
        if not found_pk and "id" in df.columns and df["id"].is_unique:
            pks[t_name] = "id"

    # STEP 2: Inclusion Dependency (Find Foreign Keys & Cardinality)
    for child_t, df_child in tables.items():
        for parent_t, pk_col in pks.items():
            if child_t == parent_t:
                continue
            for child_col in df_child.columns:
                is_name_match = False
                if str(child_col).lower().endswith("_id"):
                    base_col = str(child_col).lower().replace("_id", "")
                    possible_plurals = [base_col, base_col + "s", base_col + "es", base_col[:-1] + "ies"]
                    if parent_t.lower() in possible_plurals:
                        is_name_match = True
                if child_col == pk_col and pk_col != 'id':
                    is_name_match = True
                
                if is_name_match:
                    if pks.get(child_t) == child_col:
                        continue
                    set_fk = set(df_child[child_col].dropna())
                    set_pk = set(tables[parent_t][pk_col].dropna())
                    if not set_fk or not set_pk:
                        continue
                    
                    intersection = set_fk.intersection(set_pk)
                    inclusion_ratio = len(intersection) / len(set_fk) if len(set_fk) > 0 else 0
                    
                    if inclusion_ratio > 0.05: 
                        is_one_to_one = df_child[child_col].dropna().is_unique
                        rel_type = "1 : 1" if is_one_to_one else "1 : MANY"
                        fks.append({
                            "child_table": child_t, "child_col": child_col,
                            "parent_table": parent_t, "parent_col": pk_col,
                            "type": rel_type
                        })

    # STEP 3: Graph Enumeration (Identify M:M Junctions)
    relationships = []
    junction_map = {}
    for fk in fks:
        child, parent = fk["child_table"], fk["parent_table"]
        relationships.append({
            "Entity A": parent, "Entity B": child,
            "Relationship": fk["type"],
            "Connecting Key": f"{fk['parent_col']} -> {fk['child_col']}",
            "PK": fk['parent_col'],
            "FK": fk['child_col']
        })
        if fk["type"] == "1 : MANY":
            if child not in junction_map:
                junction_map[child] = []
            junction_map[child].append(parent)

    for junction_table, parents in junction_map.items():
        if len(parents) >= 2:
            for p1, p2 in itertools.combinations(parents, 2):
                relationships.append({
                    "Entity A": p1, "Entity B": p2,
                    "Relationship": "MANY : MANY",
                    "Connecting Key": f"Resolved via: [{junction_table}]"
                })
    return {"relationships": relationships, "pks": pks}

async def generate_architectural_summary(detected_rels):
    summary = "No significant relationships detected for architectural analysis."
    if detected_rels:
        prompt = f"""
        Identify and summarize the core architecture of these verified database relationships:
        {json.dumps(detected_rels[:30], indent=2)}

        Identify the central entity, the junction tables, and the overall business purpose.
        Keep it strictly under 3 paragraphs.
        """
        response = llm.invoke([HumanMessage(content=prompt)])
        summary = response.content
    return summary
