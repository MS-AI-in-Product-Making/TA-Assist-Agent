# Dimension Chain Visibility Toggle Design

## Goal

Add an icon control that hides or shows the generated dimension-chain annotations while leaving the imported background image and view controls available.

## Design

- Add an `Eye`/`EyeOff` toggle to the title-bar view controls.
- Default to visible and expose the state with `aria-pressed`, a dynamic accessible label, and a matching tooltip.
- Treat component arrows, labels, shared guides, and the Closure loop as one SVG overlay group.
- Hide the accessible component list with the visual overlay so assistive technology receives the same state.
- Preserve generated geometry and manual layout while hidden. Cancel any active pointer interaction when visibility changes.
- Disable the toggle until geometry has been generated.

## Testing

A component test will generate the chain, verify the visible default, hide it while retaining the background image, then restore it and confirm the same geometry is rendered again.