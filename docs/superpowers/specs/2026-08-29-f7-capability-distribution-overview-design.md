# F7 Capability and Distribution Overview Design

## Goal

Let users review measurement data, capability results, and the complete distribution-fit analysis from the Capability page without losing the existing dedicated Distribution Fit workflow.

## User Experience

### Capability page order

1. `Review Measurement Data` appears above the Capability Analysis heading.
2. Capability Analysis retains the existing sample size, mean, variation, Cp, Cpk, and change summary.
3. A complete Distribution Fit section appears directly below Capability Analysis.

### Embedded Distribution Fit

The embedded section contains the same governed content and actions as the dedicated Distribution Fit stage:

- every eligible candidate distribution;
- model specification, parameter count, fitted parameters, AIC, AICc, delta AICc, BIC, and delta BIC;
- Anderson-Darling Bootstrap details and fit status;
- expandable fitted-distribution plots with Factor Setup assumptions and specification references;
- complete Q-Q evidence tables;
- fit warnings and failed-candidate explanations;
- governed conclusion, confidence, small-sample warning, and approval action.

The existing Distribution Fit stage button remains available for focused review. Both surfaces show the same state and invoke the same actions.

## Behavior

When capability results become available and no distribution-fit result exists, the workbench automatically requests distribution fitting. The embedded section shows the existing loading and controlled error states while fitting runs. Existing results are reused and are not requested again.

Approving a distribution from either surface updates the shared factor state, so approval is immediately reflected in both surfaces.

## Component Design

Extract the Distribution Fit presentation from `MeasurementPastePanel.vue` into a reusable component. The component receives prepared fit state and display data through props and emits plot-toggle and approval events. It owns presentation and presentation-derived transforms, including candidate sorting, labels, conclusion statements, and formatting. `MeasurementPastePanel.vue` owns session state, API calls, expanded plot state, and governance validation before emitting approval to the parent application.

Use the shared component in:

- the Capability page, beneath Capability Analysis;
- the existing dedicated Distribution Fit stage.

This avoids duplicated markup and ensures both views remain behaviorally identical.

## Responsive Layout

The candidate table remains horizontally scrollable inside its own container. The page itself must not gain horizontal overflow. Plot and Q-Q detail layouts retain their existing mobile adaptations. The Review Measurement Data action remains visible before the Capability heading on desktop and mobile.

## Accessibility

- Preserve table captions, headers, row scopes, live loading status, alerts, and existing ARIA labels.
- Keep approval and plot controls as native buttons.
- Give the embedded section a distinct accessible heading.
- Do not render duplicate IDs.

## Validation

Automated tests will verify:

- Review Measurement Data precedes the Capability Analysis heading;
- entering Capability automatically requests fitting only when no result exists;
- the Capability page renders all distribution candidates and the complete fit evidence;
- plot toggles and approval actions work from the embedded section;
- the dedicated Distribution Fit stage remains available and shares result state;
- loading, error, no-acceptable-model, and failed-candidate states remain controlled;
- existing measurement, capability, and distribution-fit tests continue to pass.

Browser checks will cover desktop and 390-pixel mobile viewports, including horizontal overflow and action visibility.
