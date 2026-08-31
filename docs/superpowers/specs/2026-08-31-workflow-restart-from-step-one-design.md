# Workflow Restart From Step One Design

## Goal

Allow users in Workflow step 2 or 3 to restart at step 1 without closing the application.

## Design

- Render the completed `Select worksheet` label as a button.
- Clicking it opens an in-app `alertdialog` warning that the current worksheet data and analysis results will be discarded.
- Cancel preserves the current workflow state. Confirm opens the existing Workbook file picker.
- The Continue button directly triggers the file input from its own trusted click event, avoiding browser blocking after a native `window.confirm` dialog.
- Clear the file input value before opening it so selecting the same workbook triggers import again.
- Reuse the existing workbook import path. A successful import returns the session to Worksheet Selection and clears local measurement, Monte Carlo, and report view state.
- Keep step 1 as a non-clickable label while it is already current, and disable the restart action while another request is busy.
- Show `Change workbook or worksheet` as the completed step subtitle.

## Testing

Verify that step 1 becomes actionable during step 2, Cancel preserves the current file input, Confirm clears and opens it, and step 1 remains non-actionable while it is current.