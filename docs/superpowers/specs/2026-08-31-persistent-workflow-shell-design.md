# Persistent Workflow Shell Design

## Goal

Show the complete three-step Workflow from the first screen through the final report, with step 1 content rendered in the right-hand workspace.

## Layout

- Render the existing two-column `layout-grid` even when no session exists.
- Keep the Workflow rail on the left for every application state.
- Render `Import Workbook` inside the right `workflow-content` area while no workbook has been imported and while the session is at Worksheet Selection.
- After import, render `Worksheet Selection` directly below the import controls in the same right-hand step-1 workspace.
- Keep the current responsive behavior: desktop uses a narrow rail plus flexible content; mobile stacks the rail above content.

## Workflow State

- Before import: step 1 is Current; steps 2 and 3 are Locked.
- After import but before worksheet confirmation: step 1 remains Current; worksheet choices appear in the right-hand content.
- During steps 2 and 3: the Workflow rail remains visible and continues to show complete/current/locked state.
- Session metadata is hidden before import and shown below the steps after a session exists.

## Interaction

- The existing Workbook file input and import behavior are reused unchanged.
- The completed step-1 restart action and its warning dialog remain available in steps 2 and 3.
- Errors remain visible above the right-hand content so they stay associated with the active workflow action.

## Testing

- Verify the initial screen contains the complete Workflow rail with step 1 current and steps 2 and 3 locked.
- Verify Import Workbook is inside the right workflow content rather than above the two-column shell.
- Verify import reveals Worksheet Selection beneath the import controls without removing the Workflow rail.
- Run the complete App test suite, production build, and desktop/mobile browser layout checks.
