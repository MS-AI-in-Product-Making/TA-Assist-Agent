# Dimension Chain Disable Wheel Zoom Design

## Goal

Disable mouse-wheel zoom while the pointer is inside the Dimension Chain canvas.

## Behavior

- The wheel does not change the Dimension Chain viewport zoom.
- The wheel event is not canceled, so the surrounding page can scroll normally.
- Toolbar zoom, fit-to-view, area selection, and pan controls remain unchanged.

## Implementation

Remove the canvas `wheel` listener and its now-unused handler. Update the viewport interaction test to assert that wheel input leaves zoom unchanged and is not prevented, then verify toolbar zoom still works.