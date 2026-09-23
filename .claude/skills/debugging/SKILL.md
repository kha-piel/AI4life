---
name: debugging
description: Diagnose and fix reproducible failures in software or AI pipelines. Use for bugs, incorrect outputs, flaky behavior, performance regressions, failed integrations, and model workflow failures.
---

# Debugging

Find the earliest point where observed behavior diverges from expected behavior, then make the smallest justified fix.

## Workflow

1. Capture expected behavior, actual behavior, environment, inputs, logs, and a minimal reproduction.
2. Determine whether the failure is deterministic, intermittent, data-dependent, or model-dependent.
3. Trace boundaries in order: input, transformation, retrieval, prompt, model response, parser, tool call, state, persistence, and presentation as applicable.
4. Form a falsifiable hypothesis and run the cheapest discriminating test. Change one variable at a time.
5. Fix the root cause without unrelated refactoring.
6. Add a regression test or evaluation case that fails before the fix and passes after it.
7. Run focused checks, then broader relevant checks. Document residual uncertainty.

For probabilistic failures, preserve exact inputs and configuration, sample multiple runs, and compare distributions or error categories. Do not treat prompt edits as proven fixes without evaluation.

## Output

Report root cause, evidence, changed behavior, verification performed, and any remaining risk. If only a hypothesis is supported, label it as such.
