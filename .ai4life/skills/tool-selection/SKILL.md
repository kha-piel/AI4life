---
name: tool-selection
description: Select the simplest adequate technical approach for an AI or software problem. Use when deciding among rules, search, APIs, statistics, ML, computer vision, RAG, LLMs, agents, or no AI.
---

# Tool Selection

Choose from requirements and evidence, not trend or familiarity. Prefer the least complex option that can meet the success threshold.

## Decision Guide

- Exact, stable logic: deterministic code or rules.
- Text generation, extraction, classification, or summarization with fuzzy language: LLM, often with structured output.
- Private or current domain knowledge: retrieval or an authoritative API before fine-tuning.
- Images or video: computer vision or a multimodal model.
- Structured historical data and measurable prediction target: statistics or ML.
- Current external facts or system state: search, database, or API tool.
- Multi-step action with branching and tool use: workflow first; agent only when fixed orchestration is insufficient.
- Small volume or high judgment with poor data: human process may be better.

## Workflow

1. Start from input type, required output, accuracy threshold, latency, cost, explainability, privacy, and available data.
2. Establish a non-AI or simplest-system baseline.
3. Compare viable options on quality, build time, operational burden, failure impact, and vendor dependency.
4. Prototype the highest-risk unknown with representative examples.
5. Select one option and record why alternatives were rejected.

Do not prescribe an agent when a bounded workflow works. Do not prescribe RAG when the answer is already in structured data or an API. Do not fine-tune before demonstrating a repeatable gap that prompting, retrieval, or tooling cannot solve.

## Output

Return a recommendation, a compact trade-off comparison, assumptions, the smallest validation experiment, and a fallback plan.
