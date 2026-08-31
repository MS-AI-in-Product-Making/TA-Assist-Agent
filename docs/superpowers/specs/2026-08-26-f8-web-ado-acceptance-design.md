# F8 Web ADO Acceptance Design

## Goal

Complete the governed ADO workflow from the Workbench Web UI. The user selects and validates an ADO target, reviews the complete deterministic governance preview, explicitly authorizes the write in Web, and sees the verified receipt in Web. VS Code Extension remains the only Surface MCP execution host.

## Security boundary

- The browser never receives host bearer tokens, lease IDs, claim data, credentials, or raw internal HostAction records.
- The browser may read only a strict, session-scoped projection of ADO validation/write actions.
- Completing Surface validation must not create a claimable write action.
- A claimable `surface_write` action is created only after a CSRF-protected browser confirmation whose session, action ID, confirmation hash, target version, and current session revision all match.
- The Extension performs every Surface MCP read/write and submits integrity-bound results to Server.
- The source Workbook remains immutable.

## User flow

1. At `ado_decision_required`, Web offers local, create, and existing modes.
2. Create mode collects organization, project, Work Item type, and title. Existing mode accepts a complete HTTPS Azure DevOps URL containing `_workitems/edit/<id>`.
3. Web submits `confirm_ado_decision`; Server creates `surface_validate`.
4. Extension discovers and executes the pending validation action through Surface MCP.
5. Web reads a sanitized action projection and shows status, target identity, owner, version, complete deterministic content, factor count, and diff.
6. Web presents a separate `确认写入 ADO` command. This is not combined with target selection.
7. Server verifies the browser confirmation and creates `surface_write` only then.
8. Extension discovers and executes the write action exactly once.
9. Server verifies the receipt, advances F4-F6, and Web shows the receipt and downstream progress.

## Components

### Contracts

Add strict browser projection schemas for ADO action status, validation preview, receipt, and browser write confirmation. Projection fields are allow-listed and cannot contain lease or bearer material.

### Server

Add session-scoped browser routes:

- `GET /api/sessions/:sessionId/ado`
- `POST /api/sessions/:sessionId/ado/confirm`

`GET` projects the deterministic validation/write action IDs for the current ADO decision revision and sanitizes stored results. `POST` requires browser mutation auth and creates the write action from a completed validation result after checking the confirmation hash.

Host validation completion persists its result but no longer creates `surface_write` automatically. Host write completion retains existing receipt integrity checks and advances the session.

### Web

Replace the initial-only ADO dialog with a staged panel:

- target selection
- validation pending / host unavailable
- complete preview and diff
- independent final confirmation
- write pending
- verified receipt / failure

The panel polls the small ADO projection while the session is in `ado_action_pending`; existing session SSE continues to carry workflow snapshots.

### Extension

Add pending ADO action discovery. The active Extension periodically asks Server for the next executable action for its bound session and pumps validation/write actions. A write action cannot be discovered before Web authorization because it does not exist.

## Error handling

- Missing Extension: Web shows `等待 VS Code Surface MCP Host` and keeps the action pending.
- Expired, blocked, or failed validation/write: Web shows the typed reason and does not advance.
- Stale revision or confirmation hash: Server returns conflict and creates no write action.
- Surface authentication remains native to VS Code/browser; credentials never enter Web or Chat.
- A failed write is never retried automatically.

## Acceptance

- Both create-new and use-existing modes are operable from Web.
- Existing mode rejects IDs and non-ADO URLs; it requires a full validated URL.
- Validation preview is visible in Web before write authorization.
- No `surface_write` action exists before Web final confirmation.
- After Web confirmation, Extension performs one write and Server verifies the receipt.
- Web displays the receipt and F4-F6 continues.
- Browser routes do not expose claim, lease, bearer, or host instance data.
