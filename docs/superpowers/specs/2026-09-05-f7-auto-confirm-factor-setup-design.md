# F7 Automatic Factor Setup Confirmation

## Goal

After the user confirms a worksheet, automatically persist the imported Factor setup and enter the read-only setup state. The primary path should immediately expose Source Mode controls so the user can select `MEASURED` and open the real-measurement workspace without manually clicking `Save setup`.

## Interaction

- After worksheet confirmation returns a valid `factor_setup` session, submit the imported Factor values and system specification through the existing Factor confirmation flow.
- While automatic confirmation is running, retain the existing busy state.
- On success, show the Factor table as read-only, display `Edit setup`, and expose Source Mode controls.
- Clicking `Edit setup` enables Factor editing and changes the primary action to `Save setup`.
- Saving manual edits continues to use the existing confirmation flow and returns to the read-only state.
- On automatic confirmation failure, preserve the editable Factor setup and expose the existing controlled UI error so the user can correct or retry manually.

## Architecture

Reuse the existing `confirmFactors` client/store operation and the same payload construction used by the Factor table. Keep the lifecycle orchestration in the F7 Web application and avoid API contract changes. Factor setup serialization should have one shared implementation so automatic and manual confirmation cannot drift.

## Validation

- A component test proves worksheet confirmation automatically calls `confirmFactors` with imported Factor and system-specification values.
- The success case shows `Edit setup`, hides editable Factor inputs, and exposes Source Mode controls.
- The failure case remains editable and displays the controlled error.
- Existing Edit setup to Save setup behavior remains covered.
- Run the focused F7 Web test, F7 Web build, and a browser regression against the local stack.
