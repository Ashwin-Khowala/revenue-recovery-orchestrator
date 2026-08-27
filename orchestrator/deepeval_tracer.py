"""
orchestrator/deepeval_tracer.py
================================
DeepEval tracing instrumentation for the Revenue Recovery Orchestrator.

Instruments the AI components of the LangGraph graph so every run is
visible span-by-span in Confident AI's Observatory.

  - LLM nodes (classify_root_cause, score_policy_options)   -> type="llm"
  - Tool / action nodes (execute_action, outcome_tracker)   -> type="tool"
  - Memory / enrichment node (memory_enrichment)            -> type="retriever"
  - Top-level orchestrator runner                           -> type="agent"

USAGE
-----
From test code or the FastAPI app, replace bare graph.invoke() calls with:

    from orchestrator.deepeval_tracer import traced_run_event
    result = traced_run_event(graph, state, thread_id)

Or instrument the graph at build time:

    from orchestrator.deepeval_tracer import instrument_graph
    graph = instrument_graph(build_recovery_graph(checkpointer=MemorySaver()))

DATA HYGIENE
------------
Metadata logged: event_id, event_type, amount (no PII beyond event context).
Phone numbers, email addresses, and API keys are never traced.
"""

from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv

# Load credentials so CONFIDENT_API_KEY is available for tracing upload
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=False)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"), override=True)

from deepeval.tracing import (
    observe,
    update_current_trace,
    update_current_span,
)


# ─── Public API ──────────────────────────────────────────────────────────────


@observe(type="agent")
def traced_run_event(graph: Any, event: dict, thread_id: str) -> dict:
    """
    Top-level agent span wrapping a full orchestrator graph.invoke() run.
    Builds RecoveryState from the raw event dict, then invokes the graph.
    Every LangGraph node call inside the graph becomes a child span.

    Args:
        graph:      Compiled LangGraph graph (with MemorySaver checkpointer).
        event:      Raw event dict (event_id, event_type, amount, metadata, history, ...).
        thread_id:  Unique ID for this conversation thread.

    Returns:
        Final orchestrator state dict after all nodes complete.
    """
    from orchestrator.state import RecoveryState  # local import to avoid circular

    state: RecoveryState = {
        "event_id":       event["event_id"],
        "event_type":     event["event_type"],
        "amount":         float(event["amount"]),
        "currency":       event.get("currency", "INR"),
        "merchant_id":    event.get("merchant_id", "merch_01"),
        "customer_id":    event.get("customer_id", "cust_01"),
        "customer_name":  event.get("customer_name", "Customer"),
        "customer_email": event.get("customer_email", "test@example.com"),
        "customer_phone": event.get("customer_phone", "+919876543210"),
        "razorpay_ref":   event.get("razorpay_ref"),
        "history":        event.get("history", {}),
        "metadata":       event.get("metadata", {}),
        "customer_profile":  None,
        "episodic_history":  None,
        "merchant_policy":   None,
        "channel_capacity":  None,
        "memory_context":    None,
        "contact_count":     0,
        "payment_status":    "unresolved",
        "recovered_amount":  0.0,
        "audit_trail":       [],
    }

    event_id   = state["event_id"]
    event_type = state["event_type"]
    amount     = state["amount"]

    # Trace-level metadata for Observatory grouping
    update_current_trace(
        input=json.dumps({
            "event_id":   event_id,
            "event_type": event_type,
            "amount":     amount,
        }),
        tags=[event_type, "recovery-orchestrator"],
        metadata={
            "merchant_id":  state.get("merchant_id", "unknown"),
            "event_type":   event_type,
            "amount_inr":   amount,
            "thread_id":    thread_id,
        },
    )

    config = {"configurable": {"thread_id": thread_id}}
    try:
        result = graph.invoke(state, config=config)
    except Exception:
        snapshot = graph.get_state(config)
        if snapshot and snapshot.values:
            result = dict(snapshot.values)
        else:
            raise

    update_current_trace(
        output=json.dumps({
            "root_cause":      result.get("root_cause"),
            "chosen_action":   (result.get("chosen_action") or {}).get("action_type"),
            "guardrail":       result.get("guardrail_result"),
            "channel_used":    result.get("channel_used"),
            "expected_value":  result.get("expected_value"),
        }),
    )

    return result


def make_llm_span(node_fn):
    """
    Decorator factory to wrap an LLM-calling LangGraph node as a
    DeepEval llm span. Use this on classify_root_cause and
    score_policy_options nodes when composing the graph.
    """
    @observe(type="llm")
    def _wrapped(state: dict) -> dict:
        update_current_span(
            input=json.dumps({
                "event_type": state.get("event_type"),
                "amount":     state.get("amount"),
                "metadata":   state.get("metadata", {}),
            }),
        )
        result = node_fn(state)
        update_current_span(
            output=json.dumps({
                "root_cause":  result.get("root_cause"),
                "confidence":  result.get("confidence"),
                "reasoning":   result.get("classification_reasoning", ""),
                "action_type": (result.get("chosen_action") or {}).get("action_type"),
            }),
            metadata={
                "node": node_fn.__name__,
                "model": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini"),
            },
        )
        return result

    _wrapped.__name__ = node_fn.__name__
    _wrapped.__qualname__ = node_fn.__qualname__
    return _wrapped


def make_tool_span(node_fn):
    """
    Decorator factory to wrap an action/executor LangGraph node as a
    DeepEval tool span (execute_action, outcome_tracker).
    """
    @observe(type="tool")
    def _wrapped(state: dict) -> dict:
        chosen = state.get("chosen_action") or {}
        update_current_span(
            input=json.dumps({
                "action_type":  chosen.get("action_type"),
                "channel":      chosen.get("channel"),
                "guardrail":    state.get("guardrail_result"),
            }),
        )
        result = node_fn(state)
        update_current_span(
            output=json.dumps({
                "channel_used":    result.get("channel_used"),
                "payment_status":  result.get("payment_status"),
                "recovered_amount":result.get("recovered_amount"),
            }),
            metadata={"node": node_fn.__name__},
        )
        return result

    _wrapped.__name__ = node_fn.__name__
    _wrapped.__qualname__ = node_fn.__qualname__
    return _wrapped


def make_retriever_span(node_fn):
    """
    Decorator factory to wrap the memory/enrichment node as a
    DeepEval retriever span (memory_enrichment).
    """
    @observe(type="retriever")
    def _wrapped(state: dict) -> dict:
        update_current_span(
            input=json.dumps({
                "customer_id":  state.get("customer_id"),
                "merchant_id":  state.get("merchant_id"),
                "event_type":   state.get("event_type"),
            }),
        )
        result = node_fn(state)
        profile = result.get("customer_profile") or {}
        update_current_span(
            output=json.dumps({
                "prior_payment_success_rate": profile.get("prior_payment_success_rate"),
                "prior_contacts":             profile.get("prior_contacts"),
                "language_preference":        profile.get("language_preference", "en"),
            }),
            metadata={
                "node":   node_fn.__name__,
                "source": "supabase:customer_profiles",
            },
        )
        return result

    _wrapped.__name__ = node_fn.__name__
    _wrapped.__qualname__ = node_fn.__qualname__
    return _wrapped
