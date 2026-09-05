# F7 Interactive Dimension Chain Design

## Goal

Turn Dimension Chain into a locally editable overlay for aligning a tolerance chain with a pasted or imported section image, while keeping Factor Setup Design Nominal signs as the sole source of additive/subtractive truth.

## Scope

This work adds:

- Reverse-all controls in Factor Setup and Dimension Chain.
- Sign synchronization between Factor Setup and arrow direction/color.
- Middle-button-only viewport panning with a default arrow cursor.
- Editable shared guide positions and perpendicular arrow lane positions.
- Manual layout preservation and reset.
- Local image import, clipboard paste, opacity, replacement, and removal.

It does not persist images or manual layout to the API or workbook, change Factor magnitude, modify tolerances, or replace the existing Generate/Update snapshot workflow.

## Source Of Truth And Data Flow

`FactorInputTable.vue` remains the sole owner of editable Factor drafts. `designNominal` magnitude is never changed by diagram editing; only its sign may change.

Both reverse-all controls call the same parent method. The Factor Setup button invokes it directly. The Dimension Chain button emits a reverse-all intent to `FactorInputTable.vue`. The method negates every nonzero Design Nominal in one synchronous draft mutation, so the existing snapshot watcher records one Undo/Redo history entry.

When a guide drag crosses one or both adjacent arrow endpoints, `DimensionChainPanel.vue` previews the resulting direction and color locally. On pointer release it emits the affected Factor IDs and required signs. `FactorInputTable.vue` applies only sign changes to the corresponding drafts as one history operation.

A sign change initiated from Dimension Chain updates the generated chart snapshot's matching signs immediately after the parent confirms the new props. This keeps the visible arrow and Factor Setup synchronized. Other Factor edits retain existing stale-snapshot behavior and require `Update`.

Sign-changing controls are enabled only while Factor Setup is editable and not busy. `Generate`/`Update`, `Horizontal`, and `Vertical` follow the same edit-state boundary: they are disabled while Factor Setup is locked and become available only after the user selects `Edit setup`. Generate/Update continues to apply its existing validity and stale-snapshot constraints after editing is enabled. Image and viewport controls remain available in read-only states.

## Reverse Controls

Factor Setup receives a text-and-icon button in its existing editing toolbar, adjacent to Reset and Clear all. Dimension Chain receives the same icon and tooltip in the Generate/Horizontal/Vertical row near the orientation control.

The controls use the accessible label `Reverse all factors`. Activation:

1. Negates every nonzero Design Nominal.
2. Recalculates Factor Setup summaries and F4 outputs through existing computed state.
3. Reverses each generated component arrow and switches additive/subtractive color.
4. Preserves tolerances, sigma, distribution, names, row order, image, manual layout, and viewport.
5. Is undoable and redoable as one Factor edit.

## Editable Geometry Model

Automatic geometry remains the initial layout. Manual display state is stored separately from Factor values:

- Shared node axis offsets keyed by the boundary between adjacent segments.
- Per-segment lane offsets keyed by Factor ID.
- Separate offset maps for horizontal and vertical orientations.

A rendered segment uses automatic geometry plus the active orientation's manual offsets. Display length may therefore differ from magnitude-derived automatic length. Factor magnitude remains unchanged.

Manual offsets survive Generate/Update, Factor sign changes, and orientation switches. Removed Factor IDs and boundaries are pruned. Newly added Factors use automatic positions. A `Reset layout` button clears both orientation offset maps but does not change Factor values, image, viewport, or generated snapshot.

## Pointer Interaction

The canvas and noninteractive background use the normal system arrow cursor.

### Viewport Pan

Only the middle mouse button starts viewport panning. Left-button dragging on empty canvas does nothing. During middle-button movement, the cursor changes to the standard move/grabbing cursor. Pointer capture keeps the operation stable when the pointer leaves the canvas.

Wheel zoom, directional pan buttons, zoom buttons, area zoom, and Fit Full remain unchanged. Area selection continues to use the left button only while selection mode is active.

### Guide Drag

Each clickable dashed guide receives a transparent hit target wider than the visible stroke. Left click selects and highlights the shared boundary. Dragging is constrained to the dimension axis:

- Horizontal chain: guide moves horizontally.
- Vertical chain: guide moves vertically.

The endpoint of the preceding arrow and the start of the following arrow move with the boundary. Labels remain attached to their arrows. Crossing an adjacent arrow's opposite endpoint previews that arrow with its reversed direction and correct additive blue or subtractive red color.

No Factor state changes during pointer movement. Pointer release commits all previewed sign changes once. Escape or pointer cancellation restores the pre-drag preview and emits nothing.

Origin and closure-only guides are not sign-editable unless they are also a shared component boundary.

### Arrow Drag

Each component arrow receives a transparent hit target and selected highlight. Left-button drag moves the arrow only perpendicular to its direction:

- Horizontal chain: vertical movement only.
- Vertical chain: horizontal movement only.

The arrow, start dot, arrowhead, Factor label, value label, and relevant guide span follow the lane offset. Axis endpoints, display length, direction, Factor value, and color do not change.

Keyboard focus and visible focus styling are provided for guide and arrow hit targets. Pointer editing remains the primary interaction; buttons provide reset and global reversal alternatives.

## Image Overlay

The Dimension Chain toolbar receives an image button backed by a hidden file input accepting PNG, JPEG, and WebP. The focused canvas also handles paste events and `Ctrl+V` clipboard images.

Image handling is local-only:

- Use an Object URL for selected or pasted image blobs.
- Revoke the previous URL on replacement, removal, and component unmount.
- Never include image bytes or paths in API requests, snapshots, logs, or workbook output.

The image is rendered as the first SVG visual layer with preserved aspect ratio, horizontally centered and bottom-aligned inside the canvas's base coordinate space. Guides, arrows, dots, labels, selections, and interaction hit targets render above it. The image follows viewport pan and zoom with the SVG.

Image controls appear only when an image exists:

- Opacity range from 10% to 100%, default 60%.
- Replace image through the same import button.
- Remove image.

An image may be added before Generate. In that state the canvas remains available with the image and an empty-chain message. Generate/Update, orientation changes, Reset layout, and Factor sign changes preserve the image.

If pasted content has no supported image, show a concise inline status and preserve the existing image. File decoding failures follow the same behavior.

## Snapshot Behavior

Generated Factor data remains a snapshot. Ordinary edits to magnitude, tolerance, safety factor, sigma, distribution, name, identity, count, or order keep the current chart visible and mark it stale until Update.

The two explicit diagram sign operations are exceptions because their purpose is immediate bidirectional synchronization:

- Reverse all.
- Guide crossing committed on pointer release.

For those operations, only signs in the generated snapshot are synchronized. Magnitudes and all other snapshot fields remain unchanged. If the chart was already stale for another reason, it remains stale.

## Accessibility

- All toolbar actions are real buttons with Lucide icons, `aria-label`, and `title`.
- Toggle and mode controls expose `aria-pressed` where applicable.
- The file input has an accessible label and supports keyboard activation through its button.
- Selected guides and arrows expose selection state and meaningful accessible names containing Factor identity.
- Image errors use a polite live region.
- Color is not the only sign cue: signed text and arrow direction remain visible.

## Error Handling And Cleanup

- Unsupported clipboard/file content does not replace the current image.
- Pointer cancellation and Escape discard uncommitted guide sign previews.
- Blur, component unmount, or lost pointer capture ends active dragging safely.
- Object URLs are always revoked.
- Invalid or zero Factor drafts disable sign-changing diagram actions through existing setup validity/editability rules.

## Tests

### Pure Geometry/Layout

- Manual shared-node offsets change only display endpoints, not Factor magnitude.
- Lane offsets move arrows perpendicular to orientation.
- Boundary crossing reports only Factors whose display direction changed.
- Separate horizontal and vertical offset maps remain independent.
- Reset clears offsets without changing factors.

### Component

- Canvas default cursor and left-button empty drag do not pan.
- Middle-button drag pans and releases pointer capture.
- Guide drag previews adjacent endpoints, commits sign changes only on release, and cancels cleanly.
- Arrow drag changes only lane offset.
- Reverse-all emits once and preserves viewport/manual layout.
- Generate/Update preserves manual offsets; Reset layout clears them.
- Import and clipboard image paths render a bottom-centered background beneath chain graphics.
- Opacity, replace, remove, unsupported paste, URL revocation, and pre-Generate image state.

### Integration

- Factor Setup and Dimension Chain reverse buttons produce identical draft signs and calculations.
- Generate/Update and both orientation buttons are disabled in locked Factor Setup and enabled in Edit setup, while viewport and visibility controls remain usable.
- Diagram sign commits update Factor inputs and arrow colors/directions.
- Undo/Redo treats each reverse-all or guide-release commit as one operation.
- Read-only setup disables sign edits but permits image and viewport controls.
- Existing confirmation payload, snapshot stale behavior, 50/50 output layout, compact Response Summary, and all current F7 flows remain valid.

### Browser

Verify with desktop and narrow viewports using an imported image and clipboard screenshot. Check middle-button pan, wheel zoom, guide crossing, arrow lane drag, overlay layering, labels, selection states, no incoherent overlap, and no page-level horizontal overflow.
