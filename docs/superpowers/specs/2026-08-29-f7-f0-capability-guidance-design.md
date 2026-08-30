# F7 F0 Capability Guidance Design

## Goal

Extend the existing Capability change summary with concise, traceable guidance grounded in the public F0 Knowledge Base.

## Governance Boundary

- Keep the current mean, variation, Cp, and Cpk comparison as measured facts.
- Resolve the Cpk target from F0 engineering rule `default-cpk-target`; do not duplicate `1.33` in F7 code.
- State whether measured Cpk meets the controlled target.
- Interpret the Factor's Setup/Sample differences for mean, standard deviation, Cp, and Cpk.
- Keep recommendations scoped to the current Factor's centering, within-factor variation, and capability re-evaluation.
- Do not include contributor interpretation because this view already analyzes one selected Factor.
- Do not apply the existing F0 interpretation engine directly because its current applicability is `one-dimensional` plus `rss`, not F7 measured capability.

## Architecture

Add a browser-safe Knowledge Base subpath that exposes immutable public engineering-rule lookup without importing the Node-only snapshot validation path. The canonical F0 seed and F7 consume the same rule collection. A pure F7 guidance builder combines a capability comparison with the resolved F0 Cpk target and returns display-ready structured guidance.

`MeasurementPastePanel.vue` renders the result below the factual summary as `Factor Capability Guidance`. Only the Cpk target assessment identifies `F0 v1` and the controlled rule ID; the four Setup/Sample difference interpretations and Factor-specific recommendations are clearly labeled as review guidance rather than F0 rules.

## Failure Behavior

If the controlled Cpk rule cannot be resolved, the guidance builder returns an unavailable result. F7 must not substitute a numeric target or present a governed target assessment.

## Testing

- Unit-test rule resolution and below-target/meets-target guidance.
- Unit-test unavailable behavior when no controlled target is supplied.
- Extend the existing Capability integration test to verify the guidance, provenance, and evidence-boundary text.
- Run the focused web tests, web build, and full repository build.