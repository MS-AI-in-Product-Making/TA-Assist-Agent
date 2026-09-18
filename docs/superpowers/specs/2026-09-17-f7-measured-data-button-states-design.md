# F7 Measured Data Button States Design

**Date:** 2026-09-17
**Status:** Approved
**Target:** `apps/f7-web`

## Goal

Use the `Measured Data` button color to communicate whether each measured Factor has no data, usable data, usable data with an advisory warning, or data that blocks the next calculation.

## State Model

Each measured Factor resolves to exactly one button state with this precedence:

1. `blocked`: the latest bulk-import preview for the Factor is blocked, or the persisted `measurementPasteResult.status` is `blocked`.
2. `warning`: a ready persisted dataset has at least one message from `measurementWorkspaceWarnings`.
3. `ready`: `measurementPasteResult.status` is `ready` and no workspace warning exists.
4. `empty`: no ready or blocked measurement result exists.

Distribution fitting and approval are not part of this color model. A missing distribution approval may require a fit decision, but does not mean the measurements must be uploaded again.

## Visual Design

Use subtle semantic fills with dark text and matching borders:

| State | Background | Border | Text | Meaning |
| --- | --- | --- | --- | --- |
| `empty` | `#ffffff` | `#5f6d80` | `#16253d` | No measured data has been accepted. |
| `ready` | `#f0f7f5` | `#0d7a69` | `#0d6a5c` | Measured data passed validation. |
| `warning` | `#fff8e8` | `#b54708` | `#694600` | Data is usable, but engineering review is advised. |
| `blocked` | `#fff1ef` | `#b5392f` | `#9f2f28` | Data validation blocks the next calculation and requires correction or re-upload. |

The visible button text remains `Measured Data`. Existing advisory rows keep the red `Warning` label to avoid relying on color alone. Blocked rows show `Action required` in the same right-hand status position. All four states keep the button clickable so users can inspect or repair the Factor data.

The button receives a stable `data-measured-state` attribute plus a state-aware `aria-label` and `title`. Hover styling stays in the same semantic color family.

## Bulk Import State Retention

Blocked bulk-import previews are not committed to the session. `App.vue` therefore retains the latest blocked diagnostics by Factor ID in Web-only state and passes them to `FactorInputTable` as an optional prop.

The retained blocked state is replaced when a later preview reports a new blocked result, cleared for Factors after a successful bulk commit or successful Web Factor Entry repair, and cleared when the session changes. A failed save keeps the blocked state, and repairing one Factor does not clear unrelated blocked Factors. Closing the import dialog does not clear it. No backend or contract change is required.

Persisted blocked results from individual entry remain authoritative without additional state.

## Verification

Component tests cover all four button states, precedence, visible `Warning` and `Action required` labels, accessible labels, and clickability. App tests cover retention after a blocked bulk preview, clearing after successful commit, and clearing on session replacement. Browser verification confirms semantic colors, aligned button positions, status labels to the right, and desktop/mobile fit.