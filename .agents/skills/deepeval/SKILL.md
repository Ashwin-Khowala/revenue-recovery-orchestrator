---
name: deepeval
description: "INVOKE THIS SKILL when running LLM evaluations, testing agent outputs with DeepEval metrics (G-Eval, Hallucination, Conversational, Toxicity, Role Adherence), configuring LLM-as-judge models (Azure GPT-5.4 Mini, GPT-5.4 Nano, GPT-4o, Gemini), or pushing evaluation results to Confident AI."
---

# DeepEval & Confident AI Evaluation Skill

This skill provides testing guidelines, metric definitions, and execution commands for evaluating autonomous agent reasoning, policy formulation, and conversational quality using DeepEval and Confident AI.

## Quick Reference Commands

```bash
# 1. Run full DeepEval unit test suite (local pytest)
pytest evals/test_deepeval.py -v

# 2. Run multi-turn conversational evaluation (Role Adherence, Completeness, Toxicity)
pytest evals/test_conversational_multiturn_deepeval.py -v

# 3. Run single-turn golden dataset regression
pytest evals/test_confident_regression.py -v

# 4. Run model benchmark across Azure GPT-5.4 Mini/Nano, GPT-4o, and Gemini
python evals/benchmark_models.py

# 5. Push test runs directly to Confident AI cloud dashboard
deepeval test run evals/test_deepeval.py
deepeval test run evals/test_conversational_multiturn_deepeval.py
```

---

## Core Evaluation Metrics

| Metric | Target / Threshold | Purpose |
|---|---|---|
| **G-Eval (Classification)** | $\ge 0.70$ | Evaluates whether the agent diagnosed the true root cause (e.g. `payment_degraded` vs `subscription_failed`). |
| **G-Eval (Intervention)** | $\ge 0.70$ | Assesses whether the chosen action matches expected value and compliance criteria. |
| **G-Eval (Do-Nothing)** | $\ge 0.70$ | Verifies the agent remains silent for reliable customers ($P \ge 0.90$) to eliminate brand fatigue. |
| **HallucinationMetric** | $\le 0.50$ | Verifies zero fabricated amounts, bank error codes, or invoice numbers. |
| **ToxicityMetric** | $\le 0.30$ | Strict zero-tolerance against aggressive dunning or coercive recovery messages. |
| **RoleAdherenceMetric** | $\ge 0.70$ | Evaluates empathy, polite tone, and assigned financial specialist persona. |
| **TurnRelevancyMetric** | $\ge 0.70$ | Assesses turn-by-turn conversational alignment in multi-turn dialogues. |

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

---

## Writing a New DeepEval Test Case

```python
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import GEval
from evals.deepeval_model import AzureDeepEvalModel

judge = AzureDeepEvalModel(temperature=0.0)

metric = GEval(
    name="Payment Policy Appropriateness",
    criteria="Determine if the suggested action appropriately addresses the failure without customer friction.",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    model=judge,
    threshold=0.7,
)

test_case = LLMTestCase(
    input="Event: payment route degraded for HDFC UPI gateway",
    actual_output="Action: silent payment reroute; zero customer contact",
)

assert_test(test_case, [metric])
```
