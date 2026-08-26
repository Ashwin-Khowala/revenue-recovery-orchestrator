"""
RecoveryState Schema Definition
Defines the complete state machine representation for LangGraph.
"""

from typing import TypedDict, Literal, Optional, List, Dict, Any


class CandidateAction(TypedDict):
    action_type: str  # e.g., 'whatsapp_link', 'email_invoice', 'silent_reroute', 'schedule_ptp_check', 'do_nothing'
    target_channel: str  # 'whatsapp', 'email', 'reroute', 'scheduled_check', 'none'
    cost: float
    estimated_p_recovery: float
    expected_value: float
    description: str
    incentive_applied: Optional[str]  # e.g., '10% discount', 'instant_payment_link'


class AuditEntry(TypedDict):
    timestamp: str
    node_name: str
    action_taken: str
    details: Dict[str, Any]
    reasoning: Optional[str]


class RecoveryState(TypedDict, total=False):
    # --- Ingestion Metadata ---
    event_id: str
    event_type: Literal[
        "subscription_failed",
        "checkout_abandoned",
        "receivable_overdue",
        "payment_degraded",
        "mandate_auth_failed",
        "promise_to_pay"
    ]
    amount: float
    currency: str
    merchant_id: str
    customer_id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    created_at: str
    razorpay_ref: Optional[str]
    
    # --- Context & History ---
    history: Dict[str, Any]  # enriched by memory_enrichment with full behavioral signals
    metadata: Dict[str, Any] # { failure_bank, failure_route, cart_items, mandate_amount, afa_step }

    # --- Memory Layer (Node 0 output) ---
    customer_profile: Optional[Dict[str, Any]]    # full profile from customer_profiles table
    episodic_history: Optional[List[Dict]]        # last N episodes from customer_episodes
    merchant_policy: Optional[Dict[str, Any]]     # merchant's configured contact/escalation policy
    channel_capacity: Optional[Dict[str, int]]    # remaining daily slots per channel
    memory_context: Optional[str]                 # plain-text narrative for LLM injection

    # --- Step 1: Root Cause Classification Output ---
    root_cause: Optional[str]
    confidence: Optional[float]
    classification_reasoning: Optional[str]
    candidate_actions: Optional[List[Dict[str, Any]]]
    
    # --- Step 2: Policy Engine (EV Calculation) Output ---
    chosen_action: Optional[Dict[str, Any]]
    expected_value: Optional[float]
    ev_breakdown: Optional[Dict[str, Any]]
    
    # --- Step 3: Guardrail Output ---
    guardrail_result: Optional[Literal["ALLOW", "ESCALATE", "BLOCK"]]
    guardrail_rule_fired: Optional[str]
    
    # --- Step 4: Execution Output ---
    contact_count: int
    channel_used: Optional[Literal["whatsapp", "email", "reroute", "scheduled_check", "none"]]
    execution_result: Optional[Dict[str, Any]]
    
    # --- Step 5: Promise-To-Pay Context ---
    promised_pay_date: Optional[str]
    
    # --- Step 6: Outcome & Reconciliation Tracking ---
    payment_status: Literal["unresolved", "recovered", "cancelled_by_webhook", "failed", "blocked"]
    recovered_amount: float
    recovered_at: Optional[str]
    
    # --- Traceability & Audit ---
    audit_trail: List[Dict[str, Any]]
