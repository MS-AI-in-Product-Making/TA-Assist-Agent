# F7 Workbook Replacement Confirmation Design

## Goal

Prevent accidental loss of the current workbook, worksheet selection, and analysis state when a user selects another workbook.

## Scope

- The first workbook selection imports immediately.
- If any F7 session already exists, selecting another workbook requires confirmation in every workflow stage.
- The existing workflow restart entry continues to request confirmation before opening the file picker.
- No backend or session-store contract changes are required.

## Interaction

When a user selects a replacement file, the application retains the current session and stages the selected `File` without calling the import API. It opens the existing modal pattern with the title `Replace current workbook?` and explains that continuing discards the current workbook, worksheet selection, and analysis results.

`Cancel` closes the dialog, clears the staged file and native file input, and preserves the current session unchanged. Clearing the input allows the same file to be selected again later.

`Continue` closes the dialog and imports the staged file directly. The existing workbook parsing busy state, disabled controls, progress indicator, success transition, and controlled error handling remain authoritative.

While the replacement is being parsed, the application presents a fresh import state: the status reads `Importing workbook`, workflow step 1 is current, later steps are locked, and all metadata, worksheet choices, and analysis surfaces from the previous session are hidden. The previous session remains only as an internal rollback value and becomes visible again if the replacement import fails.

## State And Data Flow

`App.vue` owns one optional staged replacement file. The file input change handler follows this decision:

1. No selected file: do nothing.
2. No current session: import immediately.
3. Current session exists: stage the file and open the confirmation dialog.

The confirmation handler distinguishes a staged-file replacement from the existing workflow restart action. A replacement imports the staged file; a workflow restart clears and opens the native file picker.

## Accessibility

- Keep the existing `alertdialog`, modal labeling, Escape handling, and initial focus on the primary action.
- Use action-specific title and description text for workbook replacement.
- Disable confirmation actions while an import is busy.

## File Selection Presentation

Replace the browser-rendered file input presentation with an accessible custom row backed by the existing native input. The `Choose File` button keeps a stable width while the selected filename uses all remaining panel width. The filename wraps only when it cannot fit, may break long unspaced names, and exposes the complete value through its title tooltip. On narrow screens the button and filename stack vertically. The button remains disabled throughout workbook parsing, and the native input remains the source of file selection and change events.

## Error Handling

Cancellation never mutates the current session. If confirmed import fails, the store's controlled error remains visible and the previous session remains available according to existing store behavior. The staged file and native input are cleared after the import attempt.

## Tests

Component tests must verify:

- First import bypasses replacement confirmation.
- Selecting a new file with an existing session does not call the import API before confirmation.
- Cancel preserves the current workbook and permits selecting the same file again.
- Continue imports exactly the staged file once and then uses the existing busy feedback.
- The workflow restart confirmation continues to open the picker rather than importing a staged file.