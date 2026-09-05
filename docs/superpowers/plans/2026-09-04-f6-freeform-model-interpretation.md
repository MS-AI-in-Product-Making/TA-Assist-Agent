# F6 Freeform Model Interpretation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deterministic F6 section 4 template with a governed, immutable, model-authored engineering narrative built from verified image, Factor, F4, and F5 evidence.

**Architecture:** The Design Optimization agent creates one strict `f6-model-interpretation-v1` input artifact before deterministic F6 execution. The loader validates containment, identities, source hashes, calculation claims, and Markdown safety; the runner records provenance and passes accepted prose only to the final-report renderer. F6 never invokes a model, and rejected or missing model interpretation produces an explicit unavailable section without blocking optimization.

**Tech Stack:** TypeScript 5.7, Node.js ESM, Zod, Marked lexer, Vitest 3, npm workspaces, Markdown Agent Skills.

**Spec:** `docs/superpowers/specs/2026-09-04-f6-freeform-model-interpretation-design.md`

## Global Constraints

- Keep the F6 runner local, network-free, deterministic, and hash-bound.
- Use only the same worksheet's verified image, complete Factor rows, F4 calculation, and F5 evidence.
- Do not recalculate RSS, Cpk, Yield, DPM, contribution, nominal, tolerance, specification, or sigma in F6.
- Require every engineering value in model prose to use a validated `{{calc:<claimId>}}` placeholder.
- Keep image FACT, model INFERENCE/SIGNAL, and CLARIFICATION semantics distinct.
- Never upgrade A-H labels, arrows, or visible geometry to Drawing Number, DIM ID, or Factor identity without a structured link.
- Keep section 3.3 image-and-link only; do not restore the old F5 model-reference subsection or traceability appendix.
- Missing or rejected model interpretation must render `模型解读 unavailable` and must not block deterministic F6 output.
- Preserve the exact five-file F6 output contract; the model artifact remains an external immutable input.
- Preserve historical `f6-optimization-v2` readability when all three legacy surfaces omit the new decision; all new runs must write it.
- Do not overwrite user changes or commit without explicit user instruction.
- Use test-first RED-GREEN-REFACTOR for every behavior change.

## File Structure

- `packages/contracts/src/contracts.ts`: Own the model artifact schema, calculation claim vocabulary, exported type, and backward-compatible optimization provenance field.
- `scripts/f6-cli-args.mjs`: Parse the new optional artifact path.
- `scripts/run-f6-full-validation.mjs`: Give the model artifact its own governed root and forward it to the runner.
- `packages/workflow-runners/src/types.ts`: Define the request/result interface additions.
- `scripts/f6-artifact-loader.mjs`: Own soft-reject loading, cross-artifact identity/hash checks, claim verification, and accepted bundle projection.
- `scripts/f6-markdown-sanitizer.mjs`: Own structural Markdown validation and claim placeholder substitution.
- `packages/workbook-catalog/src/f6-optimization.ts`: Record the input decision without exposing prose to the optimization algorithm.
- `packages/workflow-runners/src/f6.ts`: Preserve the decision/source ledger and pass accepted prose only to the final report.
- `scripts/f6-final-report.mjs`: Render accepted freeform prose or unavailable fallback.
- `scripts/f6-report.mjs`: Include the new decision in Optimization Markdown provenance.
- `packages/workflow-runners/src/existing-f6.ts` and `scripts/verify-current-f6.mjs`: Verify three-surface decision and source consistency.
- `.github/skills/design-optimization/SKILL.md`: Define agent generation, immutable write, read-back, and failure fallback.

---

### Task 1: Define the model interpretation contract

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

**Interfaces:**
- Produces: `f6ModelInterpretationArtifactSchema` and `F6ModelInterpretationArtifact`.
- Produces: optional `provenance.modelInterpretationDecision` for historical-read compatibility.
- Consumes: existing `f6InputBaselineIdentitySchema`, `f6ArtifactReferenceSchema`, `f6F4ReferenceSchema`, `f6F5ReferenceSchema`, `f6InputDecisionSchema`, and SHA-256 schema.

- [x] **Step 1: Write the failing accepted-artifact test**

Create a fixture with this public shape and assert parse equality:

```ts
const modelInterpretation = {
  contractVersion: "v1" as const,
  inputClassification: "confidential" as const,
  interpretationVersion: "f6-model-interpretation-v1" as const,
  workbookContentHash: "a".repeat(64),
  generatedAt: "2026-09-04T12:00:00.000Z",
  worksheets: [{
    worksheetName: "Analysis-A",
    tableId: "table-a",
    baselineIdentity,
    sourceReferences: {
      f2: artifactReference("Feature2-Report.json"),
      f4: { ...artifactReference("Feature4-Calculation.json"), runId: "run-a", calculationVersion: "excel-ta-v1" },
      f5: { ...artifactReference("Feature5-Report.json"), interpretationVersion: "f5-data-interpretation-v1" },
      image: { ...artifactReference("Analysis-A.png"), worksheetName: "Analysis-A" },
    },
    narrativeMarkdown: "主要风险由 {{calc:top-contribution}} 主导。",
    calculationClaims: [{
      claimId: "top-contribution",
      outputField: "factors[0].contribution",
      rawValue: 0.72,
      displayFormat: "percent",
      unit: null,
    }],
    reviewStatus: "ME_REVIEW_REQUIRED" as const,
  }],
};

expect(f6ModelInterpretationArtifactSchema.parse(modelInterpretation)).toEqual(modelInterpretation);
```

- [x] **Step 2: Write strict rejection tests**

Add separate assertions for unknown fields, empty narrative, duplicate worksheet, duplicate claim ID, unreferenced claim, unknown placeholder, baseline/workbook/table mismatch, cross-worksheet image reference, unsupported `outputField`, invalid ISO timestamp, and review status other than `ME_REVIEW_REQUIRED`.

Use the existing F4 output-field vocabulary:

```text
factors[n].mean | factors[n].halfTolerance | factors[n].sigma | factors[n].contribution
system.designNominal | system.mean | system.additionalMeanShift | system.worstCaseUpper | system.worstCaseLower | system.rssSigma
capability.lowerSpecLimit | capability.upperSpecLimit | capability.targetSigmaLevel | capability.targetCpk | capability.cp | capability.lowerCpk | capability.upperCpk | capability.cpk | capability.lowerZ | capability.upperZ | capability.lowerDpm | capability.upperDpm | capability.totalDpm | capability.outOfSpecRatio | capability.yield
```

- [x] **Step 3: Run contract tests and verify RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts`

Expected: FAIL because `f6ModelInterpretationArtifactSchema` is not exported.

- [x] **Step 4: Implement the strict Zod schema**

Use `.strict().superRefine()` and exact placeholder extraction:

```ts
const claimReferences = [...worksheet.narrativeMarkdown.matchAll(/\{\{calc:([a-z][a-z0-9-]*)\}\}/g)]
  .map((match) => match[1]);
const claimIds = worksheet.calculationClaims.map((claim) => claim.claimId);
```

Require both sets to be equal and unique. Keep F4 raw-value truth checking out of this pure schema; Task 3 performs that cross-artifact validation.

- [x] **Step 5: Add backward-compatible provenance parsing**

Add `modelInterpretationDecision: f6InputDecisionSchema.optional()` to the v2 provenance schema. Update `createF6Optimization` tests later to require new outputs to emit the field.

- [x] **Step 6: Build and verify GREEN**

Run: `npx tsc -b packages/contracts --force`

Run: `npx vitest run packages/contracts/src/contracts.test.ts`

Expected: PASS.

---

### Task 2: Add the independent CLI input boundary

**Files:**
- Modify: `scripts/f6-cli-args.mjs`
- Modify: `scripts/f6-cli-args.test.mjs`
- Modify: `scripts/run-f6-full-validation.mjs`
- Modify: `scripts/run-f6-full-validation.test.mjs`
- Modify: `packages/workflow-runners/src/types.ts`

**Interfaces:**
- Produces: CLI field `modelInterpretationArtifact`.
- Produces: runner request field `modelInterpretationPath?: string`.
- Produces: loader fields `modelInterpretationArtifactRoot` and `modelInterpretationArtifact`.

- [x] **Step 1: Write failing CLI tests**

Assert that `--model-interpretation C:\evidence\run-id\Feature6-Model-Interpretation.json` produces `modelInterpretationArtifact`, and that missing values and duplicate flags throw the same style of errors as existing optional paths.

- [x] **Step 2: Write the failing independent-root test**

In `run-f6-full-validation.test.mjs`, provide Analysis Context and model interpretation files under different parent directories. Capture the loader request and assert:

```js
expect(loaderRequest.evidenceArtifactRoot).toBe(contextRoot);
expect(loaderRequest.modelInterpretationArtifactRoot).toBe(modelRoot);
expect(loaderRequest.modelInterpretationArtifact).toBe("Feature6-Model-Interpretation.json");
```

- [x] **Step 3: Run focused tests and verify RED**

Run: `npx vitest run scripts/f6-cli-args.test.mjs scripts/run-f6-full-validation.test.mjs`

Expected: FAIL because the option and independent root are absent.

- [x] **Step 4: Implement parsing and forwarding**

Add the flag to `OPTIONAL_PATHS`. Keep it out of the existing shared-parent `fields` list in `loaderOptions()` and derive its root/basename separately. Forward it through `runF6Optimization` as `modelInterpretationPath`.

- [x] **Step 5: Verify GREEN and typecheck**

Run: `npx vitest run scripts/f6-cli-args.test.mjs scripts/run-f6-full-validation.test.mjs`

Run: `npx tsc -b packages/workflow-runners --force`

Expected: PASS.

---

### Task 3: Validate and soft-reject the model artifact

**Files:**
- Modify: `scripts/f6-artifact-loader.mjs`
- Modify: `scripts/f6-artifact-loader.test.mjs`
- Modify: `scripts/f6-artifact-test-fixture.mjs`

**Interfaces:**
- Consumes: `modelInterpretationArtifactRoot`, basename, validated F2/F4/F5 reports, selected worksheet scope, and optional v2 image observation.
- Produces on success: `modelInterpretation`, `sourceReferences.modelInterpretation`, and `inputDecisions.modelInterpretation.outcome === "CALLER_AUTHORIZED"`.
- Produces on failure: accepted bundle with `inputDecisions.modelInterpretation.outcome === "REJECTED"` and no `modelInterpretation`.
- Produces when absent: `NOT_PROVIDED`.

- [x] **Step 1: Extend the fixture with a valid model artifact**

Build claims directly from fixture F4 values and write the artifact under its own UUID-like directory. Return its root and basename separately from the shared evidence root.

- [x] **Step 2: Write the accepted/not-provided tests**

Assert exact worksheet scope, artifact reference/hash, F2/F4/F5/image identities, accepted narrative, and default `NOT_PROVIDED`.

- [x] **Step 3: Write soft-reject tests**

Cover malformed JSON/schema, path escape, symlink or junction ancestry, workbook/table/baseline drift, selected-scope mismatch, F2/F4/F5/image hash drift, observation-reference drift, unknown factor index, raw value mismatch, unit mismatch, and unsafe literal engineering numbers.

Every case must assert:

```js
expect(result.status).toBe("accepted");
expect(result.modelInterpretation).toBeUndefined();
expect(result.inputDecisions.modelInterpretation.outcome).toBe("REJECTED");
```

- [x] **Step 4: Run loader tests and verify RED**

Run: `npx vitest run scripts/f6-artifact-loader.test.mjs`

Expected: FAIL because the loader ignores the new input.

- [x] **Step 5: Implement bounded read and cross-artifact validation**

Reuse `validatedGovernedRoot`, `inspectPathWithoutLinks`, `readVerifiedBytes`, descriptor identity checks, and SHA-256 calculation. Add a dedicated model-input branch that catches only model-artifact validation failures and converts them to `REJECTED`; do not change fail-closed behavior for Analysis Context or Optimization Targets.

Resolve each claim's `outputField` against the already parsed F4 worksheet:

```js
function calculationClaimValue(calculation, outputField) {
  const factor = /^factors\[(\d+)\]\.(mean|halfTolerance|sigma|contribution)$/.exec(outputField);
  if (factor) return calculation.factors[Number(factor[1])]?.[factor[2]];
  const [group, field] = outputField.split(".");
  return calculation[group]?.[field];
}
```

Compare with `Object.is` or the repository's existing finite-number equality policy; do not recompute derived values.

- [x] **Step 6: Verify GREEN**

Run: `npx vitest run scripts/f6-artifact-loader.test.mjs`

Expected: PASS, including existing fail-closed optional-input tests.

---

### Task 4: Propagate decision and provenance through catalog and runner

**Files:**
- Modify: `packages/workbook-catalog/src/f6-optimization.ts`
- Modify: `packages/workbook-catalog/src/f6-optimization.test.ts`
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `packages/workflow-runners/src/f6.test.ts`
- Modify: `scripts/f6-full-flow.test.mjs`

**Interfaces:**
- Consumes: `inputDecisions.modelInterpretation` and optional accepted artifact.
- Produces: `optimization.provenance.modelInterpretationDecision`, matching run-summary/manifest decisions, optional summary source, and final-report input `modelInterpretation`.

- [ ] **Step 1: Write failing catalog tests**

Assert new outputs always include the decision:

```ts
expect(result.provenance.modelInterpretationDecision).toEqual({ outcome: "NOT_PROVIDED" });
```

Add a `CALLER_AUTHORIZED` case and confirm the model artifact does not change options, metrics, counts, or disposition.

- [ ] **Step 2: Write failing runner and full-flow tests**

Assert the same decision object appears in Optimization provenance, run summary, and manifest. Assert accepted prose is passed only to `createFinalReport`; rejected prose is absent while five outputs still publish.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-optimization.test.ts packages/workflow-runners/src/f6.test.ts scripts/f6-full-flow.test.mjs`

Expected: FAIL on the missing decision/prose forwarding.

- [ ] **Step 4: Implement minimal propagation**

Extend `F6OptimizationV2Inputs.inputDecisions`, runner defaults, `safeSources`, summary, manifest, result interface, and final-report call. Do not pass model prose into `createF6Optimization`.

- [ ] **Step 5: Build and verify GREEN**

Run: `npx tsc -b packages/contracts packages/workbook-catalog packages/workflow-runners --force`

Run: `npx vitest run packages/workbook-catalog/src/f6-optimization.test.ts packages/workflow-runners/src/f6.test.ts scripts/f6-full-flow.test.mjs`

Expected: PASS.

---

### Task 5: Validate Markdown and render freeform section 4

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/f6-markdown-sanitizer.mjs`
- Create: `scripts/f6-markdown-sanitizer.test.mjs`
- Modify: `scripts/f6-final-report.mjs`
- Modify: `scripts/f6-final-report.test.mjs`
- Modify: `scripts/f6-report.mjs`
- Modify: `scripts/f6-report.test.mjs`

**Interfaces:**
- Produces: `validateModelMarkdown(markdown, declaredLinks)` returning the unchanged validated Markdown.
- Produces: `renderCalculationClaims(markdown, claims)` replacing only known calculation placeholders using `engineering-format.mjs`.
- Consumes: accepted model artifact and `inputDecisions.modelInterpretation`.

- [ ] **Step 1: Add failing sanitizer tests**

Accept headings, paragraphs, lists, tables, emphasis, and declared relative links while preserving byte-for-byte Markdown. Reject HTML, code blocks, images, external URLs, protocol-relative URLs, `javascript:`, `data:`, absolute/UNC paths, parent traversal, undeclared links, unknown placeholders, and literal decimal/percentage engineering values.

- [ ] **Step 2: Add failing renderer tests**

Replace current seven-part expectations with:

```js
expect(report).toContain("# 4. TA 总结性分析");
expect(report).toContain("模型生成的自由段落标题");
expect(report).toContain("ME 复核");
expect(report).not.toContain("### 4.1.1 输出边界");
expect(report).not.toContain("### 4.1.7 初步工程判断");
```

Add cases for claim formatting, two-worksheet isolation, blocked worksheet, `NOT_PROVIDED`, and `REJECTED`. Both absent cases must contain `模型解读 unavailable` and must keep sections 1-3 intact.

- [ ] **Step 3: Run tests and verify RED**

Run: `npx vitest run scripts/f6-markdown-sanitizer.test.mjs scripts/f6-final-report.test.mjs scripts/f6-report.test.mjs`

Expected: FAIL because structured Markdown validation and model projection do not exist.

- [ ] **Step 4: Install the Markdown lexer**

Run: `npm install marked --save-exact`

Use `marked.lexer()` plus token walking only for validation. Do not render HTML and do not rewrite accepted source Markdown.

- [ ] **Step 5: Implement structural validation and claim substitution**

Allow only paragraph, text, space, heading, list, list item, table, table row/cell, strong, emphasis, codespan, line break, and declared relative link tokens. Validate resolved links remain under the F6 report root. Replace each claim exactly once using `formatEngineering` or `formatPercent`; throw on leftovers or duplicates.

- [ ] **Step 6: Replace only `renderAnalysisSummary(context)` behavior**

Delete the deterministic `renderSummaryBoundary`, `renderSummaryImageFacts`, `renderSummaryCalculations`, `renderSummaryInference`, `renderSummaryAnomalies`, `renderSummaryClarifications`, and `renderSummaryJudgment` call path. Keep section 3.3 and all disposition logic unchanged.

- [ ] **Step 7: Add the Optimization Markdown ledger row**

Render `Model Interpretation decision` beside existing Context/Targets decisions without exposing narrative content in `Feature6-Optimization.md`.

- [ ] **Step 8: Verify GREEN**

Run: `npx vitest run scripts/f6-markdown-sanitizer.test.mjs scripts/f6-final-report.test.mjs scripts/f6-report.test.mjs`

Expected: PASS.

---

### Task 6: Verify current and historical F6 artifacts

**Files:**
- Modify: `packages/workflow-runners/src/existing-f6.ts`
- Modify: `packages/workflow-runners/src/existing-f6.test.ts`
- Modify: `scripts/verify-current-f6.mjs`
- Modify: `scripts/verify-current-f6.test.mjs`

**Interfaces:**
- Consumes: Optimization provenance, run-summary decisions/sources, manifest decisions, and five-file hashes.
- Produces: accepted result only when the three decision surfaces and optional source are consistent.

- [ ] **Step 1: Write failing new-run consistency tests**

Add `modelInterpretation` to `DECISION_PROVENANCE_FIELDS`, `SOURCE_DECISION_FIELDS`, and fixture decision/source maps. Test accepted `CALLER_AUTHORIZED`, `REJECTED`, and `NOT_PROVIDED` runs plus mismatched decision/hash rejection.

- [ ] **Step 2: Write historical compatibility tests**

Assert a legacy v2 artifact is accepted only when Optimization provenance, run summary, and manifest all omit model interpretation. Assert one- or two-surface omission is rejected.

- [ ] **Step 3: Run verifier tests and verify RED**

Run: `npx vitest run packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.test.mjs`

Expected: FAIL because the maps do not know the new decision.

- [ ] **Step 4: Implement mirrored validation**

Keep script and TypeScript validator policies equivalent. Normalize the all-absent historical case to an internal legacy `NOT_PROVIDED` comparison only; do not mutate artifact bytes or report a fabricated source.

- [ ] **Step 5: Build and verify GREEN**

Run: `npx tsc -b packages/workflow-runners --force`

Run: `npx vitest run packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.test.mjs`

Expected: PASS.

---

### Task 7: Govern model generation in Design Optimization

**Files:**
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `scripts/f6-skill.test.mjs`

**Interfaces:**
- Consumes: verified worksheet image, complete Factor snapshot, F4 calculation, and F5 evidence.
- Produces: immutable `Feature6-Model-Interpretation.json` under `test/demo-output/f6-model-interpretations/<workbook-hash>/<uuid>/`.
- Produces: optional CLI argument `--model-interpretation <artifact-path>` only after read-back validation.

- [ ] **Step 1: Write failing Skill contract tests**

Require exact markers for worksheet isolation, `f6-model-interpretation-v1`, UUID target, no overwrite/reuse, read-back schema validation, calculation placeholders, ME review, soft rejection, unavailable fallback, and the new allowed CLI option.

- [ ] **Step 2: Run the Skill test and verify RED**

Run: `npx vitest run scripts/f6-skill.test.mjs`

Expected: FAIL because the Skill still requires deterministic section-4 assembly and forbids a model-authored input.

- [ ] **Step 3: Replace the W9 deterministic-summary contract**

Insert a model-generation phase after validated F5. Instruct the agent to create one artifact for the exact downstream worksheet set, derive claims from F4 values, preserve FACT/INFERENCE/CLARIFICATION boundaries, validate immutable read-back, and omit the CLI flag on any failure.

Keep Analysis Context and Optimization Targets as the only two separately confirmed caller inputs. The model artifact is generated under the already authorized workflow and receives no extra confirmation.

- [ ] **Step 4: Update the command allowlist and final ledger**

Permit `--model-interpretation` independently from the two caller input pairs. Add model interpretation mode, decision, path/hash, and unavailable reason to the final product ledger.

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run scripts/f6-skill.test.mjs`

Expected: PASS and no Skill text instructs the renderer to build the old seven-part summary.

---

### Task 8: Run full regression and produce the manual-acceptance artifact

**Files:**
- Create at runtime: `test/demo-output/f6-model-interpretations/<workbook-hash>/<uuid>/Feature6-Model-Interpretation.json`
- Create at runtime: new immutable F6 five-file run directory
- Do not modify: source workbook or historical run directories

**Interfaces:**
- Consumes: current governed F2-F5 artifacts and one newly generated model interpretation artifact.
- Produces: verified `Feature6-Report.md` for user review.

- [ ] **Step 1: Run the complete focused regression**

Run:

```powershell
npm run build -- --force
npx vitest run packages/contracts/src/contracts.test.ts scripts/f6-cli-args.test.mjs scripts/f6-artifact-loader.test.mjs packages/workbook-catalog/src/f6-optimization.test.ts packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts scripts/f6-markdown-sanitizer.test.mjs scripts/f6-final-report.test.mjs scripts/f6-report.test.mjs scripts/run-f6-full-validation.test.mjs scripts/f6-full-flow.test.mjs scripts/verify-current-f6.test.mjs scripts/f6-skill.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run existing F5/F6 regression**

Run: `npx vitest run scripts/f5-report.test.mjs scripts/f5-skill.test.mjs scripts/f6-final-report.test.mjs scripts/f6-skill.test.mjs`

Expected: PASS; user-facing datum/stack exclusions and section 3.3 image-only behavior remain intact.

- [ ] **Step 3: Generate a new immutable model artifact**

Read only the current verified worksheet image, Factor rows, F4 calculation, and F5 evidence. Author freeform engineering Markdown with claim placeholders, write to a new UUID directory, read it back, validate with `f6ModelInterpretationArtifactSchema`, and compute SHA-256. Never edit a failed target; use a new UUID for a corrected artifact.

- [ ] **Step 4: Generate a new F6 run**

Run the current governed F6 command with the existing four roots, exact repeated worksheet selections, and `--model-interpretation` pointing to the accepted artifact. Do not add Analysis Context or Optimization Targets unless they were separately authorized for this run.

- [ ] **Step 5: Verify the five-file output**

Run: `node scripts/verify-current-f6.mjs`

Expected: accepted five-file set, matching hashes, exact worksheet scope, consistent decision/source ledgers, and unchanged disposition derivation.

- [ ] **Step 6: Inspect the manual-acceptance report**

Confirm section 4 uses the model's natural structure, contains formatted F4 claim values, includes ME review and model-limitation warnings, contains no old fixed seven-part headings, and displays no datum/stack user-facing summary. Provide the report path and verifier result to the user.