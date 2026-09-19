# F7 Guided Workflow Navigation Design

## Goal

Make the three-step F7 workflow easier to scan and operate by giving every step the same visual structure: step number, title, concise status guidance, and explicit action buttons.

## Scope

This change is limited to the F7 Web workflow navigation in `apps/f7-web`. It does not change API contracts, session state transitions, workbook processing, measurement analysis, Monte Carlo calculations, or report generation.

## Interaction Design

Each step uses a consistent card structure:

1. A numbered circular marker.
2. A fixed title describing the workflow phase.
3. A concise status or next-action hint.
4. A bottom-aligned action area.

The actions are:

- Step 1: show a worksheet-selection action before selection and `Change selection` after selection.
- Step 2: retain the two direct entry actions, `Excel Bulk Import` and `Web Factor Entry`.
- Step 3: show a Monte Carlo action when analysis is ready and a disabled action before readiness. When results already exist, the action reopens the results.

Existing confirmation behavior for replacing a workbook remains unchanged.

## Visual States

- Available actions use a dark background with white text.
- The selected Step 2 entry mode may use a dark primary treatment while the other available mode uses a clearly interactive outlined treatment.
- Unavailable actions remain visible but disabled, using a gray background and muted text.
- The current step uses a stronger border and filled number marker.
- Completed steps retain the existing restrained green completion treatment.
- Status text explains why a step is unavailable or what action is expected next.

The workflow cards use clearly differentiated state surfaces:

- Completed steps use a pale green background with a green border and green step marker.
- The current step uses a pale blue-gray background with a strong dark border and filled dark step marker.
- Pending or locked steps use a neutral light-gray background, muted text, and a gray dashed border.

On layouts with three horizontal columns, a directional arrow is centered in each gap between consecutive cards. The arrow after a completed step is green; other arrows are gray. At the narrow single-column breakpoint, the connectors rotate downward and sit between the stacked cards. Connectors are decorative and hidden from assistive technology.

Cards keep equal structural rhythm without nesting additional cards. Buttons remain stable in height and do not resize when status text changes.

## Responsive Behavior

The workflow remains a three-column row when sufficient width is available. At narrow widths it becomes a single-column sequence in numerical order. Titles, hints, and button labels wrap without overlap or horizontal overflow.

## Accessibility

- Keep the ordered list and workflow navigation landmark.
- Keep `aria-current="step"` on the current phase and `aria-disabled` on unavailable phases.
- Use actual disabled buttons for unavailable actions.
- Preserve the Step 2 tab semantics and keyboard navigation for its two mutually exclusive entry modes.
- Provide visible focus treatment for every enabled action.

## Implementation Boundary

Update the workflow markup and state-derived labels in `App.vue`, with presentation rules in `style.css`. Reuse the existing event handlers and state predicates. Do not introduce a new component unless implementation reveals meaningful duplicated behavior.

## Verification

- Extend `App.test.ts` to assert that each step has an action area and that enabled, disabled, current, and completed states map to the correct controls.
- Preserve tests for workbook replacement confirmation, Step 2 mode switching, and Monte Carlo navigation.
- Run the focused F7 Web unit tests and lint checks.
- Verify the workflow visually at desktop and narrow viewport widths, including keyboard focus and absence of overlap.