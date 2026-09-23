---
name: architecture
description: Design or review an implementable architecture for an AI-enabled product. Use when components, data flow, model boundaries, integrations, deployment, reliability, cost, or trade-offs must be decided.
---

# Architecture

Design the smallest architecture that satisfies the problem brief and can evolve if the prototype succeeds.

## Workflow

1. Confirm users, critical journeys, quality attributes, constraints, and expected scale.
2. Define system boundaries and authoritative data sources.
3. Map the end-to-end data flow, including ingestion, retrieval, model calls, tool calls, storage, and user feedback.
4. Put deterministic checks around probabilistic components. Define timeouts, retries, fallbacks, and human escalation where impact warrants it.
5. Address authentication, authorization, secrets, data retention, observability, latency, and cost.
6. Identify single points of failure and graceful degradation behavior.
7. Record important trade-offs and rejected alternatives.

Keep vendor-specific choices replaceable unless a concrete requirement justifies coupling. Avoid distributed components, autonomous agents, queues, or vector databases without a demonstrated need.

## Output

Provide:

- context and component diagram when relationships benefit from a visual;
- main request and data flows;
- interfaces and ownership boundaries;
- deployment and operational model;
- security, privacy, reliability, and cost considerations;
- architecture decisions, risks, and validation spikes.

The design passes when an implementer can build a vertical slice and an operator can explain how it fails, recovers, and is observed.
