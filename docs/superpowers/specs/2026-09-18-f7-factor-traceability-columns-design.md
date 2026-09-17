# F7 Factor Traceability Columns Design

## Goal

Replace the Factor Setup `Component category` column with `Part Number` and `DIM ID` columns immediately after `Factor`. Values originate from workbook parsing and remain editable during Edit Setup.

## Table Behavior

The Factor table column order begins:

1. Item
2. Factor
3. Part Number
4. DIM ID
5. Design Nominal

`Component category` is removed from the table and from Factor Setup confirmation UI. In read-only mode, missing Part Number or DIM ID displays `Missing`. During Edit Setup, both columns render text inputs for imported and user-added Factors.

## Data Flow

F7 continues using its existing `partNumber` and `dimId` fields. No duplicate `drawingNumber` field is introduced. Parsed workbook values initialize the editable drafts.

Factor Setup confirmation accepts optional nullable traceability overrides:

- A non-empty trimmed string replaces the parsed value.
- `null` clears the value.
- An omitted property preserves the parsed value for backward-compatible callers.

Confirmed Factor evidence stores the resolved values so downstream measurement templates and reports continue using the same traceability identifiers.

## Validation

Part Number and DIM ID inputs are trimmed and limited to the existing controlled traceability length. Empty input is serialized as `null`. Invalid oversized values block confirmation through the existing controlled validation path.

## Tests

Coverage will verify:

- Component category is absent from the Factor table.
- Part Number and DIM ID appear immediately after Factor.
- Parsed values display in read-only mode.
- Missing values display `Missing`.
- Edit Setup exposes both inputs.
- Edited values and explicit clears are sent in confirmation DTOs and persist in confirmed Factor evidence.
- Legacy confirmations that omit the new overrides preserve parsed values.
- User-added Factors can receive both identifiers.
