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

## Balanced Compact-Card Layout

The workflow adopts the approved balanced interpretation of the supplied visual reference while compressing each card to approximately one third of the original tall-card height. It uses restrained state-specific surfaces suitable for an engineering tool. All visible interface copy remains English.

Each card uses a compact hierarchy:

1. The circular step number, phase Lucide icon, and uppercase state badge share the top row.
2. A centered step title and smaller supporting status remain visible below it, including actionable lock reasons.
3. A bottom-aligned action area uses centered controls sized to their icon-and-text content.

Cards use the approved balanced proportions: 296px wide with shared content-driven height. The three-card grid is centered within the workflow rail with a maximum width sized to the cards and connectors, rather than stretching across the full viewport. The most content-heavy step determines the shared row height, and all three cards stretch to that height without a fixed or minimum card height.

Step titles remain on one line at the desktop card width. The 296px outer width provides enough usable content width for the longest current English title without reducing its 1rem type size. At narrower viewports, the workflow changes to a single column before the three cards and connector gaps can overflow.

Typography keeps the existing font families and text colors. Only size and spacing change for readability:

- Step number: 0.8rem.
- State badge: 0.69rem.
- Step title: 1rem.
- Supporting status: 0.81rem.
- Action label: 0.81rem.

Action controls remain centered and sized to their icon-and-text content. Step 2 stacks its two full English mode actions vertically so neither label is reduced, clipped, or forced outside the card.

The card surfaces are:

- Current: pale blue gradient, strong blue outline, and a subtle outer focus ring.
- Complete: pale green gradient with a green border and completion accents.
- Pending: white to light blue-gray surface with a neutral border.
- Locked: light gray gradient with muted content and a dashed neutral border.

Cards use restrained shadows and a maximum corner radius of 8px. Action buttons use icon-and-text labels, a stable compact height, content-driven widths, centered placement, and the existing green available/selected treatment. Disabled actions remain gray. The active card may be visually elevated but must not shift the grid or alter adjacent card dimensions.

Directional connectors remain centered between cards. They use a clear line and arrowhead, become green after a completed step, and rotate vertically at the single-column breakpoint.

## Responsive Behavior

The workflow remains a three-column row when at least 1040px of viewport width is available. Below 1040px it becomes a centered single-column sequence in numerical order, implemented with a `1039.98px` maximum-width query to avoid device-pixel rounding gaps. Cards use `min(296px, 100%)` in the single-column layout, with reduced outer container padding below 340px, so narrow mobile viewports remain free of horizontal overflow. Step titles remain on one line; status and button labels may wrap only when required by the available mobile width.

## Accessibility

- Keep the ordered list and workflow navigation landmark.
- Keep `aria-current="step"` on the current phase and `aria-disabled` on unavailable phases.
- Use actual disabled buttons for unavailable actions.
- Preserve the Step 2 tab semantics and keyboard navigation for its two mutually exclusive entry modes.
- Provide visible focus treatment for every enabled action.

## Implementation Boundary

Update the workflow markup and state-derived labels in `App.vue`, with presentation rules in `style.css`. Import icons from the existing `lucide-vue-next` dependency. Reuse the existing event handlers and state predicates. Do not introduce a new component unless implementation reveals meaningful duplicated behavior.

## Verification

- Extend `App.test.ts` to assert that each step has an action area and that enabled, disabled, current, and completed states map to the correct controls.
- Assert that each card renders the intended phase icon and state badge without changing accessible step names or tab semantics.
- Preserve tests for workbook replacement confirmation, Step 2 mode switching, and Monte Carlo navigation.
- Run the focused F7 Web unit tests and lint checks.
- Verify the workflow visually at desktop and narrow viewport widths, including single-line titles, equal content-driven card heights, keyboard focus, connector placement, and absence of overlap.