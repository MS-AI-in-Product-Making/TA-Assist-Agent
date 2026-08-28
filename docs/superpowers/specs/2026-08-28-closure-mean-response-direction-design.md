# Closure Closed-Loop Direction Design

## Requirement

The Dimension Chain Closure is the final link that closes the chain:

- Its start is the endpoint of the final dimension.
- Its end is the start point of the first dimension.
- Factor Setup Mean Response does not control or reverse the Closure arrow.

The rule applies in horizontal and vertical orientations. Closure remains red.

## Data Flow

`DimensionChainPanel.vue` derives both Closure endpoints from the generated dimension-chain geometry and manual Closure guide offsets. No response-summary value is required.

## Drag Constraint

Closure start and end guides retain their connected dimension-chain endpoints. During a guide drag, the moving guide is clamped to its original side of the other guide with a one-SVG-unit minimum gap. A guide therefore cannot cross the other guide or reverse the Closure arrow.

Existing connected-factor sign synchronization remains active when a constrained guide movement reverses a connected dimension arrow.

## Verification

- Component tests verify the Closure start matches the final-dimension guide and the Closure end matches the first-dimension guide in horizontal and vertical orientations.
- Component tests cover start/end guide crossing attempts in horizontal and vertical orientations.
- Existing F7 Web tests and production build must pass.