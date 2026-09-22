---
name: rapid-prototyping
description: Build the fastest credible vertical slice that tests a product or AI hypothesis. Use for hackathons, proofs of concept, demos, and time-boxed experiments where learning speed matters.
---

# Rapid Prototyping

Optimize for validated learning and a reliable demo, not feature count.

## Workflow

1. State the hypothesis and observable pass condition.
2. Choose one end-to-end user journey that demonstrates the core value.
3. Time-box the build and freeze non-goals.
4. Reuse stable services, templates, APIs, or workflow tools when they reduce risk. Mock non-critical integrations transparently.
5. Build the thinnest vertical slice: input, core intelligence, result, and visible feedback.
6. Add representative fixtures, basic logging, failure states, and a deterministic demo path.
7. Test with real target examples early; cut features that do not improve the hypothesis test.

Do not hide hard-coded demo data or simulated behavior. Label shortcuts and leave an explicit path from prototype to production.

## Output

Maintain a short prototype brief with hypothesis, scope, architecture sketch, demo script, success evidence, known shortcuts, risks, and next step.

## Quality Gate

The prototype must run through the core journey, fail understandably, and produce evidence related to the success criterion. A polished interface without tested core value does not pass.
