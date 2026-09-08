# F7 Assumption Results Interpretation Design

## Scope

Replace the Factor Setup `Validation Summary` presentation with `TA Results Interpretation (based on Assumptions)`. Interpret only confirmed Factor Setup assumptions. Do not present measured-data or Monte Carlo conclusions before those analyses run.

## Architecture

Add a pure F7 Web interpretation builder that:

1. Converts confirmed factor evidence and system specification into the existing F4 tolerance calculation input.
2. Uses the calculated RSS Cpk, resolved target Cpk, and factor contribution percentages as facts for the repository-backed `interpretation-rules-v1` evaluator.
3. Returns a strict view model with capability assessment, dominant contributor signals, engineering interpretation, assumptions, provenance, and existing input-readiness issues.

The Vue component consumes only this view model. It does not embed thresholds or recreate knowledge rules.

## Data Flow

`F7SessionSnapshot` -> existing F4 calculation kernel -> Cpk/contribution facts -> F0 interpretation rule evaluator -> presentation view model -> `TAResultsInterpretation.vue`.

The Cpk target comes from the confirmed system target sigma as `targetSigmaLevel / 3`. Contributor facts use each final evidence row's `percentContributionToSigma * 100` and stable factor identity.

## Presentation

The section contains four compact, unframed areas:

- Capability assessment: achieved assumption-based Cpk versus the resolved project target.
- Dominant contributors: ordered factor names and contribution percentages; concentration is explicitly a hypothesis requiring engineering review.
- Engineering interpretation: matched F0 performance statements and improvement directions.
- Assumptions and provenance: baseline/confirmed setup qualifier, RSS method, F0 rule version, and input-readiness issues.

The existing Blocking and Advisory issue lists remain available under Input readiness rather than occupying the primary section.

## Error Handling

If factor evidence, specifications, calculation, or F0 rules are unavailable, show a controlled unavailable interpretation with missing prerequisites. Never substitute a default target, invent a conclusion, or silently treat unsupported rules as matched.

## Testing

- Pure builder tests for below-target, meets-target, dominant-contributor activation, no dominant signal, and unavailable facts.
- Component tests for title, assumption qualifier, capability result, contributor ordering, provenance, and readiness issues.
- App test confirming the replacement component is rendered at the existing workflow location.
