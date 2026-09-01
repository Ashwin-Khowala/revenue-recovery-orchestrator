# 🛠️ Audit Remediation Changelog (DIFF.md)

| Phase | Component | File | Changes Made |
|---|---|---|---|
| **Phase 5** | Queue & Race Arbitrator | `orchestrator/recovery_queue.py` | Created persistent multi-key recovery queue with disk persistence (`data/pending_recovery_queue.json`) indexed by `event_id`, `order_id`, `payment_id`, and `customer_id`. |
| **Phase 5** | Webhook Receiver | `orchestrator/webhook.py` | Removed immediate `pop` on invoke; wired `cancel_recovery_by_webhook` into `razorpay_webhook_listener`. |
| **Phase 5** | Pre-Send Gate | `orchestrator/nodes/executor.py` | Added pre-send gate checking `is_recovery_cancelled` before dispatching messages. |
| **Phase 5** | Verification | `scripts/verify_razorpay_testmode_race.py` | Created end-to-end Test Mode verification generating `evals/testmode_captured_cancel.json`. |
| **Phase 1** | String & Metric Purge | `orchestrator/webhook.py` | Removed hardcoded ₹2,45,998; created dynamic summary builder with `data/demo_cast.json` fallback. |
| **Phase 1** | Chatbot UI | `dashboard/src/components/AIChatBot.tsx` | Replaced hardcoded strings with dynamic financial status and contextual calculations. |
| **Phase 1** | Telegram Bot | `orchestrator/channels/telegram_bot.py` | Replaced hardcoded fallback metrics with dynamic loaders from `evals/last_run.json`. |
| **Phase 1** | Tools & Optimizer | `merchant_tools.py`, `optimizer/page.tsx` | Removed hardcoded figures, fixed duplicate JSX block, removed 75.8% fallback. |
| **Phase 1** | DB Model Name | `scripts/db_setup.py` | Fixed model name from fictitious `gpt-54-mini` to `azure/gpt-4o-mini`. |
| **Phase 7** | API Zero Invariant | `orchestrator/webhook.py` | Enriched incidents with `duplicateContactBreaches` dynamically computed; added `dataSource` tag. |
| **Phase 2** | 4-Arm Benchmark | `evals/run_batch.py` | Implemented 4-arm runner (Organic, Naive, Rules, Orchestrator) + Counterfactual row; exported `exceptions.json`. |
| **Phase 2** | Documentation Test | `tests/test_benchmark_docs_consistency.py` | Created test verifying all documentation ₹ metrics match `evals/last_run.json`. |
| **Phase 2** | Concise README | `README.md` | Rewrote to concise 40-line specification grounded strictly in `last_run.json`. |
| **Phase 3** | Sidecar Touches | `orchestrator/governance.py` | Added JSON sidecar persistence to `CrossTrackThrottler` (`customer_contact_history.json`) and `OmnichannelConsentRegistry` (`omnichannel_optouts.json`). |
| **Phase 4** | Audit Chain Boot | `orchestrator/audit.py` | Added startup head initialization from DB/sidecar (`audit_ledger.json`) and storage verification helpers. |
| **Phase 4** | Audit Tests | `tests/test_audit_chain.py` | Added storage loading and persistence test cases. |
| **Phase 6** | Stopping Rules | `tests/test_stopping_rules.py` | Created comprehensive test suite formally covering all 8 stopping rules. |
| **Phase 8** | Demo Script | `VIDEO.md` | Created tight 4-scene 3-minute demo script. |
