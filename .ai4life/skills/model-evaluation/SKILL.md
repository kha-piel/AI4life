---
name: model-evaluation
description: Design and run evidence-based evaluations for LLM, RAG, conversational, vision, or agent systems. Use to compare variants, validate quality claims, prevent regressions, or answer how well an AI system works.
---

# Model Evaluation

Tie evaluation to the product claim and real failure costs. A single aggregate score is rarely sufficient.

## Workflow

1. Define the claim, unit of evaluation, target population, baseline, and release threshold before inspecting results.
2. Build a representative dataset with normal, difficult, boundary, multilingual, and adversarial cases as relevant. Keep test examples separate from prompt development.
3. Select metrics by failure mode: task success, correctness, groundedness, retrieval recall, citation quality, tool success, latency, cost, safety, or user preference.
4. Prefer deterministic graders for objective properties. Calibrate model judges against human labels and document judge prompts and models.
5. Run the current system, simplest baseline, and candidate under equivalent conditions. Preserve raw outputs and configuration.
6. Report uncertainty, per-slice results, and error categories; inspect failures rather than relying only on averages.
7. Convert confirmed failures into regression cases.

Never tune directly on the held-out test set. Do not claim production quality from a tiny convenient dataset. Record model, prompt, retrieval index, tools, parameters, code version, and run date needed to reproduce results.

## Output

Provide an evaluation card containing claim, dataset, metrics, thresholds, baselines, configuration, results by slice, representative failures, limitations, and release recommendation.
