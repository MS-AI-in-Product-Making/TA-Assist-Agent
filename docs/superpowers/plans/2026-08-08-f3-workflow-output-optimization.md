# F3 Workflow and Output Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require an explicit F3 worksheet selection, validate existing ADO targets from a URL, link three F3 report columns to the original F1 image, and replace ambiguous source locations with structured source evidence.

**Architecture:** The F3 skill owns user prompts and passes selected ready worksheet names to the local workflow. The loader validates and filters that selection, while the F3 contract carries F1 image provenance and the report renderer resolves links relative to the F3 output directory. Existing ADO URL data remains ephemeral; only the parsed and validated work item ID enters the existing reminder contract.

**Tech Stack:** TypeScript, JavaScript ES modules, Zod, Vitest, Node.js CLI, Markdown, VS Code `vscode_askQuestions`, Surface MCP governance protocol.

---

### Task 1: Carry F1 Image Provenance Through F3 Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Test: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing F3 contract tests**

Add an F1 image reference to the accepted F3 request/result fixtures and assert that a result row without it is rejected:

```ts
const imageReference = {
  artifact: "f1" as const,
  relativePath: "worksheets/Analysis-A/tolerance-path.png",
  contentHash: "d".repeat(64),
  worksheetName: "Analysis-A",
};

expect(() => drawingGovernanceResultV2Schema.parse({
  ...acceptedResult,
  worksheets: acceptedResult.worksheets.map((worksheet) => ({
    ...worksheet,
    rows: worksheet.rows.map(({ imageReference: _removed, ...row }) => row),
  })),
})).toThrow();
```

Also assert that `artifact: "f2"` and a mismatched `worksheetName` fail validation.

- [ ] **Step 2: Run the focused contract test and verify RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts -t "F3 v2"`

Expected: FAIL because `f3GovernanceRowSchema` does not require `imageReference`, and no worksheet-name consistency refinement exists.

- [ ] **Step 3: Add a shared F1 image-reference schema and F3 refinements**

Extract the current F2 inline schema into `f1ImageReferenceSchema`, keep F2 compatibility optional, and require it on F3 result rows:

```ts
const f1ImageReferenceSchema = z.object({
  artifact: z.literal("f1"),
  relativePath: relativeArtifactPathSchema,
  contentHash: sha256Schema,
  worksheetName: z.string().min(1),
}).strict();

// f2EnhancedRowSchema
imageReference: f1ImageReferenceSchema.optional(),

// f3GovernanceRowSchema
imageReference: f1ImageReferenceSchema,
```

Refine each F3 request and result worksheet so every row has an image reference and its `worksheetName` matches the containing worksheet. Add `artifactRoot: z.string().min(1)` to accepted F3 request/result provenance so ADO reminder rewrites can reconstruct links.

- [ ] **Step 4: Run the focused contract test and verify GREEN**

Run: `npx vitest run packages/contracts/src/contracts.test.ts -t "F3 v2"`

Expected: PASS.

- [ ] **Step 5: Commit the contract change**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(f3): carry F1 image provenance"
```

### Task 2: Validate Selection and Build the F3 Request

**Files:**
- Modify: `scripts/f3-artifact-loader.mjs`
- Test: `scripts/f3-artifact-loader.test.mjs`

- [ ] **Step 1: Extend fixtures and write failing selection tests**

Give every ready row an F1 image reference, add a second ready worksheet, and cover the option contract:

```js
const loaded = loadF2ArtifactBundle(root, {
  selectedWorksheetNames: ["Analysis-B"],
});
expect(loaded.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-B"]);
expect(loaded.request.artifactRoot).toBe(report.artifactRoot);
```

Add separate tests for `undefined` selecting all ready worksheets, `[]`, duplicate names, unknown names, and a blocked worksheet name. Empty/invalid selections must return `inputRejected` with `reasonCode: "worksheet_selection_invalid"` and a deterministic `artifactReference` containing invalid names.

- [ ] **Step 2: Run loader tests and verify RED**

Run: `npx vitest run scripts/f3-artifact-loader.test.mjs`

Expected: FAIL because the loader ignores a second argument, does not expose `artifactRoot`, and the rejection schema lacks `worksheet_selection_invalid`.

- [ ] **Step 3: Implement fail-closed ready worksheet filtering**

Change the API to:

```js
export function loadF2ArtifactBundle(artifactRoot, { selectedWorksheetNames } = {})
```

Build a `Map` of ready worksheets, reject empty/duplicate/unknown selections, preserve the user selection order, and map only selected rows. Include the F2 report's `artifactRoot` in the F3 request. Extend the F3 artifact issue reason-code enum with `worksheet_selection_invalid`.

- [ ] **Step 4: Run loader and contract tests and verify GREEN**

Run: `npx vitest run scripts/f3-artifact-loader.test.mjs packages/contracts/src/contracts.test.ts -t "F3|loadF2ArtifactBundle"`

Expected: PASS.

- [ ] **Step 5: Commit loader filtering**

```powershell
git add packages/contracts/src/contracts.ts scripts/f3-artifact-loader.mjs scripts/f3-artifact-loader.test.mjs
git commit -m "feat(f3): filter selected ready worksheets"
```

### Task 3: Preserve Image References in Governance Results

**Files:**
- Modify: `packages/workbook-catalog/src/f3-drawing-governance.ts`
- Test: `packages/workbook-catalog/src/f3-drawing-governance.test.ts`

- [ ] **Step 1: Write a failing provenance mapping test**

Add `artifactRoot` and `imageReference` to the request fixture, then assert exact identity in the parsed result:

```ts
expect(result.artifactRoot).toBe(request.artifactRoot);
expect(result.worksheets[0].rows[0].imageReference).toEqual(
  request.worksheets[0].rows[0].imageReference,
);
```

- [ ] **Step 2: Run the governance test and verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f3-drawing-governance.test.ts`

Expected: FAIL because `createF3DrawingGovernance` currently drops both fields.

- [ ] **Step 3: Pass provenance through without rewriting it**

Add `imageReference: row.imageReference` to each composed row and `artifactRoot: input.artifactRoot` to the accepted result. Do not calculate, normalize, or replace F1 paths in the governance package.

- [ ] **Step 4: Run governance tests and verify GREEN**

Run: `npx vitest run packages/workbook-catalog/src/f3-drawing-governance.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit governance mapping**

```powershell
git add packages/workbook-catalog/src/f3-drawing-governance.ts packages/workbook-catalog/src/f3-drawing-governance.test.ts
git commit -m "feat(f3): preserve report image references"
```

### Task 4: Add Deterministic CLI Worksheet Filtering

**Files:**
- Create: `scripts/f3-cli-args.mjs`
- Create: `scripts/f3-cli-args.test.mjs`
- Modify: `scripts/run-f3-full-validation.mjs`
- Modify: `scripts/f3-full-flow.test.mjs`

- [ ] **Step 1: Write failing CLI parser tests**

Define one repeatable flag per worksheet so names containing commas remain unambiguous:

```js
expect(parseF3CliArgs([
  "controlled/f2",
  "--worksheet", "Analysis-A",
  "--worksheet", "Analysis-B",
])).toEqual({
  artifactRoot: "controlled/f2",
  selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
});
```

Test no flags, missing flag values, unknown flags, and extra positional arguments.

- [ ] **Step 2: Run parser tests and verify RED**

Run: `npx vitest run scripts/f3-cli-args.test.mjs`

Expected: FAIL because `f3-cli-args.mjs` does not exist.

- [ ] **Step 3: Implement the minimal parser and runner wiring**

Export `parseF3CliArgs(args)` with exactly one artifact directory and zero or more `--worksheet <name>` pairs. In the runner, pass `[artifactRoot]` to `resolveFeature3OutputLayout` and pass `selectedWorksheetNames` to `loadF2ArtifactBundle`.

- [ ] **Step 4: Add and run an end-to-end subset test**

Extend the full-flow fixture to two ready worksheets, execute:

```js
execFileSync(process.execPath, [
  "scripts/run-f3-full-validation.mjs",
  f2Root,
  "--worksheet", "Analysis-B",
], options);
```

Assert the JSON contains only `Analysis-B`, with `worksheetCount === 1`, and the Markdown excludes `Analysis-A`.

Run: `npx vitest run scripts/f3-cli-args.test.mjs scripts/f3-full-flow.test.mjs scripts/f3-output-layout.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit CLI selection support**

```powershell
git add scripts/f3-cli-args.mjs scripts/f3-cli-args.test.mjs scripts/run-f3-full-validation.mjs scripts/f3-full-flow.test.mjs
git commit -m "feat(f3): accept worksheet selections"
```

### Task 5: Render F1 Links and Structured Source Evidence

**Files:**
- Modify: `scripts/f3-report.mjs`
- Modify: `scripts/run-f3-full-validation.mjs`
- Modify: `scripts/write-f3-ado-reminder.mjs`
- Test: `scripts/f3-report.test.mjs`
- Test: `scripts/f3-full-flow.test.mjs`
- Test: `scripts/write-f3-ado-reminder.test.mjs`

- [ ] **Step 1: Write failing report tests**

Add `artifactRoot` and `imageReference` to fixtures. Call `renderF3Report(report, { outputRoot })` and assert:

```js
const href = path.relative(
  path.resolve(outputRoot),
  path.resolve(report.artifactRoot, row.imageReference.relativePath),
).split(path.sep).join("/");

expect(markdown).toContain(`[TP_Gap_X](${href})`);
expect(markdown).toContain(`[Anonymous device gap](${href})`);
expect(markdown).toContain(`[Anonymous display offset](${href})`);
expect(markdown).toContain("| Source Evidence |");
expect(markdown).toContain(
  "Worksheet: TP_Gap_X; Table: factor-table-1; Row: 14; Fields: factorName=TP_Gap_X!E14",
);
```

Add a multiple-cell test proving field names sort alphabetically and a no-cells test producing `Fields: none`.

- [ ] **Step 2: Run report tests and verify RED**

Run: `npx vitest run scripts/f3-report.test.mjs`

Expected: FAIL because the renderer has no output context, no links, and still emits `Source Location`.

- [ ] **Step 3: Implement renderer context and deterministic evidence**

Add `path` import, `imageHref`, and `imageLink` helpers matching F2 behavior. Change the public signature to:

```js
export function renderF3Report(report, { outputRoot } = {})
```

Require `outputRoot` only for accepted reports. Compute links from `report.artifactRoot` and each row's F1 reference. Replace `sourceLocation` with `sourceEvidence`, rendering worksheet, table, row, and alphabetically sorted `field=cell` pairs. Apply existing redaction and Markdown table escaping to the final evidence string.

- [ ] **Step 4: Wire both render call sites and verify reminder stability**

Pass `outputLayout.outRoot` from `run-f3-full-validation.mjs` and `resolvedRoot` from `write-f3-ado-reminder.mjs`. Add a reminder test that writes an ADO outcome and verifies all three links remain unchanged after Markdown regeneration.

Run: `npx vitest run scripts/f3-report.test.mjs scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit report improvements**

```powershell
git add scripts/f3-report.mjs scripts/f3-report.test.mjs scripts/run-f3-full-validation.mjs scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.mjs scripts/write-f3-ado-reminder.test.mjs
git commit -m "feat(f3): link F1 evidence in reports"
```

### Task 6: Enforce Skill Prompts and Existing ADO URL Validation

**Files:**
- Modify: `.github/skills/f3-analysis/SKILL.md`
- Modify: `.github/skills/f3-analysis/references/ado-publishing.md`
- Modify: `scripts/f3-skill.test.mjs`

- [ ] **Step 1: Write failing skill contract assertions**

Add assertions that the skill contains three distinct interaction gates in this order: worksheet multi-select, publishing mode, final write confirmation. Require the worksheet question to use `multiSelect: true`, list only F2 ready worksheets, stop on empty selection, and run the exact repeatable command shape:

```text
npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]
```

For existing mode, assert a separate ADO URL question, `_workitems/edit/<id>` parsing, organization/project extraction, positive integer ID validation, Surface readback, target confirmation, and no URL persistence.

- [ ] **Step 2: Run skill tests and verify RED**

Run: `npx vitest run scripts/f3-skill.test.mjs`

Expected: FAIL because the skill has no worksheet gate or ADO URL collection contract.

- [ ] **Step 3: Update the skill workflow**

Insert a worksheet selection phase after input resolution and before F3 execution. Renumber publishing interactions without weakening the existing Surface capability gate or exact `Confirm write` requirement. In existing mode, require URL input, parse organization/project/ID, validate through Surface, and explicitly forbid accepting an independently entered ID.

- [ ] **Step 4: Update the publishing reference**

Document the accepted HTTPS Azure DevOps URL shape, fail-closed parsing, target mismatch behavior, ephemeral URL treatment, and the unchanged status/reason fallback matrix. Keep REST/browser/shell HTTP prohibited.

- [ ] **Step 5: Run skill tests and verify GREEN**

Run: `npx vitest run scripts/f3-skill.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit skill governance changes**

```powershell
git add .github/skills/f3-analysis/SKILL.md .github/skills/f3-analysis/references/ado-publishing.md scripts/f3-skill.test.mjs
git commit -m "feat(f3): require worksheet and ADO target prompts"
```

### Task 7: Full Verification and Documentation Alignment

**Files:**
- Modify if assertions require alignment: `docs/02-end-to-end-flow.md`
- Modify if assertions require alignment: `docs/02-端到端流程.md`
- Modify if assertions require alignment: `docs/governance/feature-register.md`

- [ ] **Step 1: Run the complete F3-focused suite**

Run:

```powershell
npx vitest run packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f3-drawing-governance.test.ts scripts/f3-cli-args.test.mjs scripts/f3-artifact-loader.test.mjs scripts/f3-output-layout.test.mjs scripts/f3-report.test.mjs scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.test.mjs scripts/f3-ado-reminder.test.mjs scripts/f3-skill.test.mjs
```

Expected: all tests PASS with no unhandled errors.

- [ ] **Step 2: Run build and repository verification**

Run:

```powershell
npm run build -- --force
npm run check:repository
```

Expected: both commands exit 0.

- [ ] **Step 3: Run the full workspace test suite**

Run: `npm test`

Expected: all workspace tests PASS.

- [ ] **Step 4: Inspect final scope and commit required documentation alignment**

Run:

```powershell
git diff --check
git status --short
git diff --stat HEAD~6..HEAD
```

If repository verification requires flow/register text changes, update only the F3 interaction, F1 image ownership, and `Source Evidence` wording, rerun Steps 1-3, then commit:

```powershell
git add docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/governance/feature-register.md
git commit -m "docs(f3): align optimized workflow guidance"
```

- [ ] **Step 5: Request code review**

Use the `superpowers:requesting-code-review` skill against the branch diff. Resolve only findings within this design's scope, rerun the focused suite and build after any fix, and report unrelated pre-existing failures separately.