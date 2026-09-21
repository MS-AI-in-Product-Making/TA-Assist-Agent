# Issue #106 F2 Findings and ADO Worksheet Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present revision-bound F2 findings as an explicit user decision and add a reliable worksheet source column to every governed ADO row.

**Architecture:** F2 remains the source of worksheet readiness. A new projection materializes findings, exact downstream-ready scope, artifact identity, and a stable digest; server and reducer both validate the decision. ADO renderers project existing `row.source.worksheetName` into a twelfth column without changing engineering records or write governance.

**Tech Stack:** TypeScript, Zod, React, Vitest, deterministic Markdown/HTML renderers, Surface MCP governance protocol.

**Spec:** `docs/superpowers/specs/2026-09-07-issue-106-ux-agent-triggering-design.md`

## Global Constraints

- Drawing Number and DIM ID findings are warnings and do not remove a worksheet from the downstream-ready set.
- Missing calculation-required fields or the tolerance-stack image blocks only that worksheet.
- Continue submits the exact downstream-ready set for the current revision; replace creates a new revision and invalidates the old decision.
- UI disabling is not a governance boundary; server materialization and reducer invariants both enforce the decision.
- ADO `Worksheet Source` comes only from `row.source.worksheetName`.
- ADO remains complete preview, separate confirmation, one write, one readback, and exact canonical body/hash verification.

---

### Task 1: Version F2 Identifier Findings and Decision Evidence

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`

**Interfaces:**
- Produces: `F2FindingsDecisionProjection`, `F2WorksheetFindingProjection`, and `ConfirmDownstreamScopeInternalPayload`.
- Consumed by: Tasks 2 through 5.

- [ ] **Step 1: Write failing schema tests**

```ts
it("accepts Drawing Number and DIM ID warnings without blocking", () => {
  const parsed = f2WorksheetFindingProjectionSchema.parse({
    worksheetName: "Gap",
    readiness: "downstream_ready",
    identifierWarnings: ["drawing_number_missing", "dim_id_missing"],
    blockers: [],
    sourceRows: [12],
  });
  expect(parsed.readiness).toBe("downstream_ready");
});

it("rejects a downstream decision without revision-bound evidence", () => {
  expect(() => confirmDownstreamScopeInternalPayloadSchema.parse({ decision: "continue_ready" })).toThrow();
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts`

Expected: FAIL because the finding projection and evidence fields do not exist.

- [ ] **Step 3: Add versioned schemas**

```ts
export interface ConfirmDownstreamScopeInternalPayload {
  readonly decision: "continue_ready";
  readonly workbookHash: string;
  readonly inputRevision: number;
  readonly worksheetNames: readonly string[];
  readonly f2ReportArtifactId: string;
  readonly f2ReportContentHash: string;
  readonly findingDigest: string;
  readonly provenance?: "user" | "internal_fixture";
}
```

Accept legacy `partNumber` identifier findings only in the historical reader; new emitters write `drawingNumber` and `dimCharacteristicId` semantics.

- [ ] **Step 4: Run schema tests**

Run: `npx vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts`

Expected: PASS for new and legacy fixtures.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/contracts* packages/contracts/src/f8-contracts*
git commit -m "feat(contracts): add F2 findings decision evidence"
```

### Task 2: Emit Warning-Only Identifiers and Stable F2 Findings

**Files:**
- Modify: `packages/workbook-catalog/src/f2-user-report.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`
- Modify: `packages/workbench/src/projections.ts`
- Modify: `packages/workbench/src/projections.test.ts`
- Modify: `apps/workbench-web/src/workbook-health.ts`
- Modify: `apps/workbench-web/src/workbook-health.test.ts`

**Interfaces:**
- Produces: `projectF2FindingsDecision(report, evidence): F2FindingsDecisionProjection`.
- Digest input: canonical projection JSON excluding localized labels.

- [ ] **Step 1: Add failing F2 and projection tests**

Cover identifier-only, missing image, multiple missing fields, mixed ready/blocked, and all blocked. Assert the exact downstream-ready set follows report order and does not alphabetically sort.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f2-user-report.test.ts packages/workbench/src/projections.test.ts apps/workbench-web/src/workbook-health.test.ts`

Expected: FAIL because per-worksheet findings and digest are not projected.

- [ ] **Step 3: Implement deterministic projection**

Map calculation-required fields and image absence to `blockers`; map Drawing Number/DIM ID to `identifierWarnings`. Generate `findingDigest` from canonical machine values and source identities, not translated UI copy.

- [ ] **Step 4: Run focused tests**

Run the command from Step 2.

Expected: PASS with identifier-only worksheets still downstream-ready.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f2-user-report* packages/workbook-catalog/src/index.ts packages/workbench/src/projections* apps/workbench-web/src/workbook-health*
git commit -m "feat(f2): project governed worksheet findings"
```

### Task 3: Enforce Revision-Bound Continue or Replace Decisions

**Files:**
- Modify: `packages/workbench/src/state-machine.ts`
- Modify: `packages/workbench/src/state-machine.test.ts`
- Modify: `packages/workbench/src/session-store.ts`
- Modify: `packages/workbench/src/session-store.test.ts`
- Modify: `apps/workbench-server/src/routes/commands.ts`
- Modify: `apps/workbench-server/src/server.test.ts`

**Interfaces:**
- Consumes: `F2FindingsDecisionProjection` from Task 2.
- Produces: persisted `downstreamScopeSelection` carrying decision, revision, report identity, digest, and exact worksheet set.

- [ ] **Step 1: Write state and server failures**

```ts
it("rejects an omitted downstream-ready worksheet", () => {
  expect(() => reduceSessionCommand(snapshotWithReadyAAndB, confirmOnlyA)).toThrow(/exact downstream-ready set/i);
});

it("invalidates the old F2 decision after workbook replacement", () => {
  const replaced = reduceSessionCommand(snapshot, replaceWorkbookCommand);
  expect(replaced.downstreamScopeSelection).toBeUndefined();
});
```

Also test wrong revision, report hash mismatch, digest mismatch, altered artifact bytes, empty all-blocked submission, and stale action generation.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/workbench/src/state-machine.test.ts packages/workbench/src/session-store.test.ts apps/workbench-server/src/server.test.ts -t "downstream"`

Expected: FAIL because current validation only proves selected rows are ready.

- [ ] **Step 3: Materialize trusted evidence in the server**

Read and hash current F2 bytes, validate the artifact registry identity, project findings, and build the internal payload. Never accept report hash, digest, or ready set directly from Web.

- [ ] **Step 4: Enforce the same invariants in the reducer**

Require exact set equality while preserving F2 worksheet order. Persist the evidence. Keep immutable command history when `replace_workbook` clears current selection.

- [ ] **Step 5: Run focused tests**

Run the command from Step 2.

Expected: PASS for continue, replace, cancel, stale revision, and tampered artifact paths.

- [ ] **Step 6: Commit**

```powershell
git add packages/workbench/src/state-machine* packages/workbench/src/session-store* apps/workbench-server/src/routes/commands.ts apps/workbench-server/src/server.test.ts
git commit -m "feat(workbench): govern F2 findings decisions"
```

### Task 4: Build the Newcomer-Friendly Findings Dialog

**Files:**
- Create: `apps/workbench-web/src/components/F2FindingsDecisionDialog.tsx`
- Create: `apps/workbench-web/src/components/F2FindingsDecisionDialog.test.tsx`
- Modify: `apps/workbench-web/src/app.tsx`
- Modify: `apps/workbench-web/src/app.test.tsx`
- Modify: `apps/workbench-web/src/components/WorksheetSelection.tsx`

**Interfaces:**
- Consumes: server-projected findings and input metadata from the first Issue #106 plan.
- Emits: only `confirm_downstream_scope` or `replace_workbook`; cancel emits no command.

- [ ] **Step 1: Write dialog behavior tests**

Test mixed ready/blocked, identifier-only, all blocked, replace, continue, and cancel. Assert each worksheet shows missing content, consequence, next step, and recovery. Assert continue is disabled when no downstream-ready worksheet exists.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/workbench-web/src/components/F2FindingsDecisionDialog.test.tsx apps/workbench-web/src/app.test.tsx`

Expected: FAIL because downstream selection is currently a generic section.

- [ ] **Step 3: Implement the focused dialog**

Keep `WorksheetSelection` for initial scope only. Render warning and blocker semantics distinctly without exposing source rows by default; allow an accessible details disclosure for provenance.

- [ ] **Step 4: Run component tests**

Run the command from Step 2.

Expected: PASS in English and Chinese fixtures.

- [ ] **Step 5: Commit**

```powershell
git add apps/workbench-web/src/components/F2FindingsDecisionDialog* apps/workbench-web/src/components/WorksheetSelection.tsx apps/workbench-web/src/app*
git commit -m "feat(ux): add worksheet findings decision dialog"
```

### Task 5: Add Worksheet Source to Canonical ADO Renderers

**Files:**
- Modify: `packages/workflow-runners/src/f3-ado-markdown.ts`
- Modify: `packages/workflow-runners/src/f3-ado-markdown.test.ts`
- Modify: `packages/workflow-runners/src/f3-ado-html.ts`
- Modify: `packages/workflow-runners/src/f3-ado-html.test.ts`
- Modify: `apps/workbench-web/src/components/F3Governance.tsx`
- Modify: `apps/workbench-web/src/components/F3Governance.test.tsx`
- Modify: `scripts/f3-ado-reminder.mjs`
- Modify: `scripts/f3-ado-reminder.test.mjs`

**Interfaces:**
- Consumes: existing `row.source.worksheetName`.
- Produces: 12-column Markdown, HTML, and preview with `Worksheet Source` as column one.

- [ ] **Step 1: Write 12-column renderer failures**

Use two worksheets sharing one subsystem. Assert 12 headers, each row's own worksheet, `colspan=12`, escaping, global group order, and stable output hash.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/workflow-runners/src/f3-ado-markdown.test.ts packages/workflow-runners/src/f3-ado-html.test.ts apps/workbench-web/src/components/F3Governance.test.tsx scripts/f3-ado-reminder.test.mjs`

Expected: FAIL with current 11-column output.

- [ ] **Step 3: Update all canonical projections together**

Insert the column without changing any existing field value or sort key. Update group colspan and renderer constants. Do not modify F3 source schemas or infer worksheet from group names.

- [ ] **Step 4: Run renderer tests**

Run the command from Step 2.

Expected: PASS with deterministic 12-column bodies.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/f3-ado-* apps/workbench-web/src/components/F3Governance* scripts/f3-ado-reminder*
git commit -m "feat(ado): include worksheet source in governance tables"
```

### Task 6: Update ADO Protocol and Readback Verification

**Files:**
- Modify: `.github/skills/drawing-governance/SKILL.md`
- Modify: `.github/skills/drawing-governance/references/ado-publishing.md`
- Modify: `scripts/f3-skill.test.mjs`
- Modify: `scripts/f3-full-flow.test.mjs`
- Modify: `scripts/write-f3-ado-reminder.test.mjs`

**Interfaces:**
- Consumes: canonical 12-column body from Task 5.
- Preserves: write-once/readback protocol and restricted canonical HTML normalization.

- [ ] **Step 1: Change protocol tests to require 12 columns**

Assert `Worksheet Source`, 12 headers, `colspan=12`, exact marked factor row count, and canonical body/hash equality after readback.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f3-skill.test.mjs scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.test.mjs`

Expected: FAIL while protocol text and verification expect 11 columns.

- [ ] **Step 3: Update protocol wording and verifier constants**

Do not broaden canonicalization or add a write retry. Invalidate any pending preview produced from an 11-column body through the existing action revision/hash mechanism.

- [ ] **Step 4: Run F3 flow tests**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add .github/skills/drawing-governance scripts/f3-skill.test.mjs scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.test.mjs
git commit -m "docs(governance): require ADO worksheet source"
```

### Task 7: Phase Verification

**Files:**
- Test only; do not hand-edit generated `dist` output.

**Interfaces:**
- Produces: governed downstream scope and stable 12-column ADO output for later plans.

- [ ] **Step 1: Run all focused suites**

```powershell
npx vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts packages/workbook-catalog/src/f2-user-report.test.ts packages/workbench/src/projections.test.ts packages/workbench/src/state-machine.test.ts packages/workbench/src/session-store.test.ts apps/workbench-server/src/server.test.ts apps/workbench-web/src/workbook-health.test.ts apps/workbench-web/src/components/F2FindingsDecisionDialog.test.tsx packages/workflow-runners/src/f3-ado-markdown.test.ts packages/workflow-runners/src/f3-ado-html.test.ts apps/workbench-web/src/components/F3Governance.test.tsx scripts/f3-ado-reminder.test.mjs scripts/f3-skill.test.mjs scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.test.mjs
npm run build -- --force
```

Expected: every command exits 0.

- [ ] **Step 2: Confirm source governance remained intact**

Run: `git diff --check`

Verify no source workbook writes, REST fallback, extra ADO write, or expanded HTML normalization were introduced.