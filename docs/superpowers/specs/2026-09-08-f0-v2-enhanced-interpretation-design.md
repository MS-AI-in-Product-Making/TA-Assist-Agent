# F0 V2 Enhanced Interpretation Design

## Goal

Extend `interpretation-rules-v2` with user-approved deterministic rules that turn one-dimensional RSS capability facts into a governed result judgment, root-cause hypotheses, optimization options, and validation requirements for F5, F6, and F7.

## Governance

The added rules are approved by the user on 2026-09-08. Their source alias is `user-approved-f0-v2-rules-2026-09-08`; they do not claim to originate from the unavailable V4.2 workbook. The package remains `internal`, read-only, immutable, and engineering-review gated. V1 remains unchanged and loadable.

## Facts

V2 accepts the existing `cpk`, `targetCpk`, and contributor facts plus `cp`, `mean`, `lowerSpecLimit`, and `upperSpecLimit`. Specification limits must satisfy `lowerSpecLimit < upperSpecLimit`.

## Controlled Rules

- Result judgment: Cpk greater than or equal to the resolved Target Cpk meets target; otherwise it is below target.
- RC01 Excessive Variation: when Cpk is below target and Cp is below Target Cpk, total variation is a root-cause hypothesis.
- RC02 Mean Shift: when Cpk is below target, Cp is greater than Cpk by more than a numerical tolerance, and the mean differs from the specification midpoint, process off-centering is a root-cause hypothesis.
- RC03 Dominant Contributor: when Cpk is below target and the maximum contributor is at least 30%, contributor concentration is a root-cause hypothesis.

RC01, RC02, and RC03 may all match because variation, centering, and concentration can coexist.

## Options And Validation

- RC01 produces a variation-reduction option. Validate by updating representative variation evidence, rerunning the same RSS or Monte Carlo method, and comparing Cp/Cpk with the unchanged resolved target.
- RC02 produces a mean-centering option. Validate physical feasibility through ME review, center toward `(LSL + USL) / 2`, rerun the same method, and compare Cpk with the unchanged target.
- RC03 produces a dominant-contributor option. Validate the contributor evidence, recalculate the stack, and confirm the improvement with representative data.

F0 does not calculate optimized tolerances or choose a final recommendation. Quantified scenario solving remains owned by F6.

## Consumer Behavior

F5 and F7 submit all available V2 facts. F7 displays matched root signals, controlled options, and validation requirements with V2 provenance. Missing facts fail closed for only the rules that require them; the basic Cpk judgment remains available. F6 records and consumes V2 provenance without duplicating F0 thresholds.

## Verification

Contract tests cover accepted facts and invalid specification bounds. Query tests cover each root cause independently, combined matches, non-matches, deterministic ordering, V1 compatibility, and immutable provenance. F7 tests cover displayed RC01/RC02/RC03 and validation requirements. Full TypeScript build, focused Vitest suites, repository policy checks, and the extension runtime build are release gates.