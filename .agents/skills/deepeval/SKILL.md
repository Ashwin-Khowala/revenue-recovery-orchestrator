---
name: deepeval
description: "INVOKE THIS SKILL when running LLM evaluations, testing agent outputs with DeepEval metrics (G-Eval, Hallucination, Conversational, Toxicity, Role Adherence, Tool Correctness, Financial PII Leakage), configuring LLM-as-judge models (Azure GPT-5.4 Mini, GPT-5.4 Nano, GPT-4o, Gemini), or pushing evaluation results to Confident AI."
---

# DeepEval & Confident AI Evaluation Skill

This skill provides testing guidelines, metric definitions, and execution commands for evaluating autonomous agent reasoning, policy formulation, tool execution, and conversational quality using DeepEval (v4.1.10) and Confident AI.

## Quick Reference Commands

```bash
# 1. Run Unified CI Test Runner across all 4 suites (emits formatted ASCII table & JSON report)
python evals/run_deepeval_ci.py

# 2. Run specific test suites via runner
python evals/run_deepeval_ci.py --suite conversational
python evals/run_deepeval_ci.py --suite tools
python evals/run_deepeval_ci.py --suite pii

# 3. Direct pytest executions
pytest evals/test_deepeval.py -v
pytest evals/test_conversational_multiturn_deepeval.py -v
pytest evals/test_agent_tools_deepeval.py -v
pytest evals/test_pii_compliance_deepeval.py -v

# 4. Multi-model latency and cost benchmark
python evals/benchmark_models.py

# 5. Push test runs directly to Confident AI cloud dashboard
deepeval test run evals/test_deepeval.py
deepeval test run evals/test_conversational_multiturn_deepeval.py
```

---

## The 4 Evaluation Suites

1. **Core Node & Policy Engine (`evals/test_deepeval.py`)**:
   - `G-Eval (Classification Correctness)` ($\ge 0.70$): Diagnoses true root causes across 6 failure modes.
   - `G-Eval (Intervention Appropriateness)` ($\ge 0.70$): Evaluates recovery action EV alignment.
   - `G-Eval (Do-Nothing Awareness)` ($\ge 0.70$): Verifies silent handling for reliable customers ($P \ge 0.90$).
   - `HallucinationMetric` ($\le 0.50$): Prohibits fabricated amounts, bank error codes, or invoices.
   - `Guardrail Enforcement`: Deterministically tests ₹1L cap, 2-contact ceiling, and 24h cooldown.

2. **Multi-Turn Conversational Quality (`evals/test_conversational_multiturn_deepeval.py`)**:
   - `RoleAdherenceMetric` ($\ge 0.50$): Evaluates empathy, courteous tone, and specialist persona.
   - `ConversationCompletenessMetric` ($\ge 0.70$): Verifies goal completion (settlement or PTP commitment).
   - `TurnRelevancyMetric` ($\ge 0.70$): Measures dialogue alignment and question responsiveness.
   - `ToxicityMetric` ($\le 0.30$): Strict zero-tolerance dunning anti-harassment filter.

3. **Agent Tool Correctness (`evals/test_agent_tools_deepeval.py`)**:
   - Concession discount tool respects merchant ceiling ($\le 15\%$).
   - Promise-to-Pay (PTP) tool validates calendar dates and freezes automated outreach.
   - High-value ($\ge \text{₹1L}$) invoice approval tool verifies admin authorization.

4. **Financial Data Privacy & PII Compliance (`evals/test_pii_compliance_deepeval.py`)**:
   - `Financial Privacy GEval` ($\ge 0.70$): Ensures zero card numbers, CVVs, or unmasked PANs in customer messages.
   - Pre-LLM PII Sanitizer (`sanitize_pii_for_llm`): Strips sensitive tokens before reasoning.

---

## Configuring the LLM-as-Judge

DeepEval tests evaluate using custom enterprise judges via `evals/deepeval_model.py`:

```python
from evals.deepeval_model import AzureDeepEvalModel, GeminiDeepEvalModel, get_judge_model

# 1. Primary enterprise judge: Azure OpenAI (GPT-5.4 Mini / Nano)
judge = AzureDeepEvalModel(temperature=0.0)

# 2. Cross-vendor judge: Google GenAI (Gemini Flash)
gemini_judge = GeminiDeepEvalModel(model_name="gemini-2.5-flash")

# 3. Dynamic factory lookup
dynamic_judge = get_judge_model()  # Reads DEEPEVAL_JUDGE_MODEL or AZURE_OPENAI_DEPLOYMENT_NAME
```

---

## DeepEval Tracing (`orchestrator.deepeval_tracer`)

The orchestrator instrumenter records node spans, LLM calls, and tools into DeepEval traces:

```python
from orchestrator.deepeval_tracer import traced_run_event
from orchestrator.graph import build_recovery_graph

graph = build_recovery_graph()
# Automatically creates DeepEval LLM, Tool, and Retriever spans
result = traced_run_event(graph, event, thread_id="eval_run_01")
```
