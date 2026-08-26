"""
LangGraph StateGraph Definition — Revenue Recovery Orchestrator
Implements supervisor-dispatcher pattern with conditional routing and replay-safe HITL.
"""

import os
import logging
from typing import Literal, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from orchestrator.state import RecoveryState
from orchestrator.nodes import (
    classify_root_cause,
    score_policy_options,
    check_guardrails,
    hitl_escalation,
    execute_action,
    outcome_tracker_node,
)
from orchestrator.nodes.memory_enrichment import memory_enrichment

logger = logging.getLogger("orchestrator.graph")


def route_after_guardrails(state: RecoveryState) -> Literal["hitl_escalation", "execute_action"]:
    """
    Conditional routing edge based on deterministic guardrail outcome.
    """
    guardrail_result = state.get("guardrail_result", "ALLOW")
    if guardrail_result == "ESCALATE":
        logger.info(f"Routing event {state.get('event_id')} to HITL Escalation.")
        return "hitl_escalation"
    return "execute_action"


def build_recovery_graph(checkpointer=None):
    """
    Constructs and compiles the complete LangGraph StateGraph.
    """
    builder = StateGraph(RecoveryState)

    # 1. Register Graph Nodes
    builder.add_node("memory_enrichment", memory_enrichment)  # Node 0: always first
    builder.add_node("classify_root_cause", classify_root_cause)
    builder.add_node("score_policy_options", score_policy_options)
    builder.add_node("check_guardrails", check_guardrails)
    builder.add_node("hitl_escalation", hitl_escalation)
    builder.add_node("execute_action", execute_action)
    builder.add_node("outcome_tracker", outcome_tracker_node)

    # 2. Define Deterministic Edges
    builder.add_edge(START, "memory_enrichment")           # Memory first
    builder.add_edge("memory_enrichment", "classify_root_cause")
    builder.add_edge("classify_root_cause", "score_policy_options")
    builder.add_edge("score_policy_options", "check_guardrails")

    # 3. Define Conditional Guardrail Branch
    builder.add_conditional_edges(
        "check_guardrails",
        route_after_guardrails,
        {
            "hitl_escalation": "hitl_escalation",
            "execute_action": "execute_action",
        },
    )

    # 4. Reconnect HITL to Downstream Executor
    builder.add_edge("hitl_escalation", "execute_action")
    builder.add_edge("execute_action", "outcome_tracker")
    builder.add_edge("outcome_tracker", END)

    # 5. Compile with Checkpointer (MemorySaver by default for fast in-memory replay safety)
    if checkpointer is None:
        checkpointer = MemorySaver()

    compiled_graph = builder.compile(checkpointer=checkpointer)
    return compiled_graph


# Pre-instantiated graph singleton
orchestrator_graph = build_recovery_graph()
