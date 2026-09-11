# F7 Readonly Specification Gray-Out Design

## Goal

Make LSL, USL, and Target Sigma Level visibly non-editable when Factor Setup is locked.

## Design

- Keep the existing semantic `output` elements in the non-editable state.
- Add a dedicated `is-readonly` class only to those three outputs.
- Use a neutral gray background, gray border and text, and a not-allowed cursor while preserving readable contrast.
- Keep editable inputs visually unchanged; do not gray out Volume or other calculated outputs.

## Verification

- Locked LSL, USL, and Target Sigma Level outputs have the `is-readonly` class.
- Editable inputs do not have the class.
- CSS defines the gray-out appearance.