# Benchmark Evaluations & Methodology

> **Track 3: AI Revenue Recovery**  
> Evaluated on `150` held-out synthetic recovery events (`evals/labeled_holdout.json`) representing ₹9,750,738.00 at risk across 6 failure archetypes.

> [!NOTE]
> **Simulation Disclaimer**: Recovered ₹ in benchmark is based on the simulated conversion threshold heuristic ($P_{\text{recovery}} \ge 0.40$). Real settlement is strictly separated into Razorpay Test Mode checkout verification.

---

## 3-Way Strategy Comparison

| Metric | Baseline A (Naive Blast) | Baseline B (Rule-Based) | AI Recovery Orchestrator |
|---|---|---|---|
| **At-Risk Target** | ₹9,750,738.00 | ₹9,750,738.00 | ₹9,750,738.00 |
| **Recovered (Simulated)** | ₹5,543,558.00 (56.85%) | ₹6,660,365.00 (68.31%) | **₹2,577,978.00 (26.44%)** |
| **Wasted Interventions (Spam)** | 18 cases | 14 cases | **0 cases (0% spam)** |
| **Outreach / API Cost** | ₹120.00 | ₹74.65 | **₹37.70** |
| **Cost per Recovered Rupee** | ₹0.00002 | ₹0.00001 | **₹0.00001** |
| **Duplicate Contact Breaches** | 24 | 17 | **0 (Guaranteed 0)** |
| **Human Escalations (HITL)** | 0 (Unbounded) | 0 (Unbounded) | **29 (19.33%)** |

---

## Model Benchmark

| Model | Classification Accuracy | Guardrail Compliance | Cost / 1k Incidents |
|---|---|---|---|
| **Azure OpenAI gpt-4o-mini** | **100.0%** | **100.0%** | **$0.117** |
| **Azure OpenAI gpt-4o** | **100.0%** | **100.0%** | $1.950 |
| **Google Gemini 2.5 Flash Lite** | 87.5% | 100.0% | $0.057 |
| **Rule Baseline** | 62.5% | 100.0% | $0.000 |

---

## How to Run Locally

```bash
# Run the complete 3-way evaluation benchmark
python evals/run_batch.py

# Run unit tests across all failure injection modes and guardrails
pytest tests -v
```
