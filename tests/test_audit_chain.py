"""
Unit Tests for Cryptographic SHA-256 Audit Trail Chaining & Verification
"""

import os
import json
import pytest
from orchestrator.audit import (
    log_audit_entry,
    create_audit_entry,
    verify_audit_chain,
    load_audit_chain_from_storage,
    verify_audit_chain_from_storage,
    AUDIT_FILE_PATH,
)


def test_audit_chain_validity():
    """Verify that sequentially logged audit entries form a mathematically valid SHA-256 chain."""
    e1 = log_audit_entry("evt_001", "memory_enrichment", "Priors Loaded", {"reliability": 0.95})
    e2 = log_audit_entry("evt_001", "classify_root_cause", "Diagnosed subscription_failed", {"confidence": 0.98})
    e3 = log_audit_entry("evt_001", "score_policy_options", "Ranked WhatsApp Payment Link", {"ev": 4500.0})
    e4 = log_audit_entry("evt_001", "check_guardrails", "Guardrail ALLOW (RULE_ALL_GUARDRAILS_PASSED)", {"result": "ALLOW"})
    
    entries = [e1, e2, e3, e4]
    assert len(entries) == 4
    assert all("entry_hash" in e for e in entries)
    assert verify_audit_chain(entries) is True


def test_audit_chain_tamper_detection():
    """Verify that tampering with any audit entry breaks the cryptographic chain."""
    e1 = log_audit_entry("evt_002", "memory_enrichment", "Priors Loaded", {"reliability": 0.80})
    e2 = log_audit_entry("evt_002", "check_guardrails", "Guardrail BLOCK", {"result": "BLOCK"})
    
    # Tamper with e2's action_taken
    tampered_e2 = dict(e2)
    tampered_e2["action_taken"] = "Guardrail ALLOW (TAMPERED)"
    
    assert verify_audit_chain([e1, e2]) is True
    assert verify_audit_chain([e1, tampered_e2]) is False


def test_create_audit_entry_alias():
    """Verify create_audit_entry alias works identically."""
    entry = create_audit_entry("evt_003", "executor", "WhatsApp Sent", {"status": "delivered"})
    assert entry["event_id"] == "evt_003"
    assert "entry_hash" in entry


def test_audit_sidecar_persistence_and_loading():
    """Verify that entries persist to JSON sidecar and can be verified from storage."""
    event_id = "evt_storage_test_001"
    e1 = log_audit_entry(event_id, "memory_enrichment", "Priors Loaded", {"reliability": 0.90})
    e2 = log_audit_entry(event_id, "check_guardrails", "Guardrail ALLOW", {"result": "ALLOW"})

    stored = load_audit_chain_from_storage(event_id=event_id)
    assert len(stored) >= 2
    assert stored[-1]["event_id"] == event_id
    assert stored[-1]["action_taken"] == "Guardrail ALLOW"
    assert verify_audit_chain_from_storage() is True
