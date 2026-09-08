# F7 Governed Engineering Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace F7's rule-title-only assumption interpretation with one shared, deterministic, conclusion-first engineering narrative used by Web and the local report.

**Architecture:** Add a pure `@ai-assist/product-language/f7-engineering-narrative` builder that accepts validated calculation facts and matched F0 V2 rules, then returns immutable structured narrative sections. F7 Web and F7 local report remain responsible for calculation and F0 evaluation; both project the same evaluator result into the shared builder. F0 continues to own rule activation and F6 continues to own quantified optimization.

**Tech Stack:** TypeScript, Vitest, Zod, Vue 3, Vite

---

### Task 1: Build The Shared Deterministic Narrative

**Files:**
- Create: `packages/product-language/src/f7-engineering-narrative.ts`
- Create: `packages/product-language/src/f7-engineering-narrative.test.ts`
- Modify: `packages/product-language/src/index.ts`
- Modify: `packages/product-language/package.json`

- [ ] **Step 1: Write failing tests for the complete combined-cause narrative**

Create `f7-engineering-narrative.test.ts` with a fixture containing Cpk `0.92`, target `1.33`, Cp `1.18`, mean `0.08`, limits `-0.5/0.5`, RC01/RC02/RC03, a 46% contributor, and all three controlled options. Assert:

```ts
const narrative = buildF7EngineeringNarrative(combinedCauseInput());

expect(narrative.resultJudgment).toMatchObject({
  status: "below-target",
  headline: "Capability is below target",
  cpk: 0.92,
  targetCpk: 1.33,
  margin: -0.41,
  nearerSpecificationSide: "USL",
});
expect(narrative.rootCauseAnalysis.map(({ ruleId }) => ruleId)).toEqual([
  "root-cause-excessive-variation",
  "root-cause-mean-shift",
  "root-cause-contributor-concentration",
]);
expect(narrative.rootCauseAnalysis[1]?.quantitativeEvidence).toMatchObject({
  cpCpkGap: 0.26,
  specificationMidpoint: 0,
  meanOffset: 0.08,
  direction: "USL",
});
expect(narrative.rootCauseAnalysis[2]?.quantitativeEvidence).toMatchObject({
  contributorName: "Factor A",
  contributionPercent: 46,
});
expect(narrative.suggestedActionSequence.map(({ optionId }) => ({ optionId }))).toEqual([
  { optionId: "improvement-center-mean" },
  { optionId: "improvement-reduce-variation" },
  { optionId: "improvement-reduce-contributor" },
]);
expect(narrative.evidenceDisclosure).toContain("Assumption-based RSS evidence; this is not measured capability evidence.");
```

- [ ] **Step 2: Add edge-case tests**

Cover meets-target output with no causes, equal mean-to-limit distances as `balanced`, missing enhanced facts producing `completeEvidence: false`, deterministic validation-step deduplication, input arrays remaining unmodified, and recursively frozen output. Assert no output text matches `/optimized tolerance|release|hold|ranked recommendation/i`.

- [ ] **Step 3: Run the shared tests and verify RED**

Run:

```powershell
node_modules/.bin/vitest.cmd run packages/product-language/src/f7-engineering-narrative.test.ts
```

Expected: FAIL because the module and builder do not exist.

- [ ] **Step 4: Implement the shared types and builder**

Create these public input/output shapes:

```ts
export type F7NarrativeMethod = "rss" | "monte-carlo";

export interface F7NarrativeRule {
  readonly ruleId: string;
  readonly title: string;
}

export interface F7NarrativeOption extends F7NarrativeRule {
  readonly validationSteps: readonly string[];
}

export interface F7NarrativeContributor {
  readonly name: string;
  readonly reference: string;
  readonly contributionPercent: number;
}

export interface BuildF7EngineeringNarrativeInput {
  readonly evidenceBasis: "assumption" | "measured";
  readonly method: F7NarrativeMethod;
  readonly cpk: number;
  readonly targetCpk: number;
  readonly cp?: number;
  readonly mean?: number;
  readonly lowerSpecLimit?: number;
  readonly upperSpecLimit?: number;
  readonly rootCauseRules: readonly F7NarrativeRule[];
  readonly controlledOptions: readonly F7NarrativeOption[];
  readonly contributors: readonly F7NarrativeContributor[];
  readonly knowledgeBaseVersion: "interpretation-rules-v2";
}
```

Return structured `resultJudgment`, `engineeringSummary`, `rootCauseAnalysis`, `engineeringRisk`, `suggestedActionSequence`, `validationRequirements`, and `evidenceDisclosure`. Use rule-ID maps for RC display order and option sequence. Round only rendered prose; preserve raw finite numbers in quantitative evidence. Determine the nearer side from `mean - LSL` and `USL - mean`, using `Number.EPSILON * 32 * max(1, magnitudes)` as the balanced-distance tolerance.

Use deterministic templates:

```ts
const headline = margin >= 0 ? "Capability meets target" : "Capability is below target";
const judgment = `Cpk ${format(cpk)} is ${format(Math.abs(margin))} ${margin >= 0 ? "above" : "below"} the resolved target of ${format(targetCpk)}.`;
const centering = `Cp exceeds Cpk by ${format(cp - cpk)} and the mean is ${formatSigned(mean - midpoint)} from the specification midpoint toward ${direction}, indicating a centering-loss hypothesis that requires validation.`;
```

When required facts are absent, emit `Evidence is incomplete for this matched hypothesis.` and `completeEvidence: false`; do not substitute values. Recursively freeze a fresh result before returning it.

- [ ] **Step 5: Export the module**

Add root exports in `src/index.ts` and this package subpath in `package.json`:

```json
"./f7-engineering-narrative": {
  "types": "./dist/f7-engineering-narrative.d.ts",
  "import": "./dist/f7-engineering-narrative.js"
}
```

- [ ] **Step 6: Build and rerun the shared tests to GREEN**

Run:

```powershell
node_modules/.bin/tsc.cmd -b packages/product-language --force
node_modules/.bin/vitest.cmd run packages/product-language/src/f7-engineering-narrative.test.ts
```

Expected: all shared narrative tests pass.

- [ ] **Step 7: Commit Task 1**

```powershell
git add packages/product-language
git commit -m "feat: add governed F7 narrative builder"
```

### Task 2: Integrate The Narrative Into F7 Web

**Files:**
- Modify: `apps/f7-web/package.json`
- Modify: `apps/f7-web/src/assumption-results-interpretation.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.test.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Create: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [ ] **Step 1: Extend the assumption interpretation test with narrative assertions**

For the existing combined RC01/RC02/RC03 snapshot, assert:

```ts
expect(result.narrative.resultJudgment.headline).toBe("Capability is below target");
expect(result.narrative.resultJudgment.margin).toBeLessThan(0);
expect(result.narrative.rootCauseAnalysis.map(({ ruleId }) => ruleId)).toEqual([
  "root-cause-excessive-variation",
  "root-cause-mean-shift",
  "root-cause-contributor-concentration",
]);
expect(result.narrative.engineeringRisk).toMatch(/requires validation/i);
expect(result.narrative.suggestedActionSequence.map(({ optionId }) => optionId)).toEqual([
  "improvement-center-mean",
  "improvement-reduce-variation",
  "improvement-reduce-contributor",
]);
```

Keep the existing legacy arrays during this task for source compatibility, but assert the component no longer uses them as its main presentation.

- [ ] **Step 2: Write a failing component hierarchy test**

Mount `TAResultsInterpretation.vue` with the existing F7 session fixture and assert the visible sequence and data hooks:

```ts
expect(wrapper.get("[data-result-judgment]").text()).toContain("Capability is below target");
expect(wrapper.get("[data-engineering-summary]").text()).toContain("Cpk");
expect(wrapper.findAll("[data-root-cause-item]")).toHaveLength(3);
expect(wrapper.get("[data-engineering-risk]").text()).toContain("requires validation");
expect(wrapper.findAll("[data-action-sequence-item]")).toHaveLength(3);
expect(wrapper.get("[data-evidence-disclosure]").text()).toContain("not measured capability evidence");
expect(wrapper.find("[data-engineering-interpretation]").exists()).toBe(false);
```

- [ ] **Step 3: Run both F7 Web tests and verify RED**

```powershell
node_modules/.bin/vitest.cmd run apps/f7-web/src/assumption-results-interpretation.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts
```

Expected: FAIL because `narrative` and the new hierarchy are absent.

- [ ] **Step 4: Project the F0 evaluation into the shared builder**

Add `@ai-assist/product-language` to F7 Web dependencies. In `buildAssumptionResultsInterpretation`, call `buildF7EngineeringNarrative` only after the current evaluator consistency checks succeed:

```ts
const narrative = buildF7EngineeringNarrative({
  evidenceBasis: "assumption",
  method: "rss",
  cp: calculation.capability.cp,
  cpk: calculation.capability.cpk,
  targetCpk,
  mean: calculation.system.mean,
  lowerSpecLimit: calculation.capability.lowerSpecLimit,
  upperSpecLimit: calculation.capability.upperSpecLimit,
  rootCauseRules: rootCauseRules.map((rule) => ({ ruleId: rule.entryId, title: rule.title })),
  controlledOptions: improvementRules.map((rule) => ({
    ruleId: rule.entryId,
    title: rule.title,
    validationSteps: rule.validationSteps ?? [],
  })),
  contributors: contributors.map(({ factorName, reference, contributionPercent }) => ({
    name: factorName,
    reference,
    contributionPercent,
  })),
  knowledgeBaseVersion: evaluation.knowledgeBaseVersion,
});
```

Return `narrative` on the available result. Do not call it on unavailable paths.

- [ ] **Step 5: Replace the visual hierarchy**

Update `TAResultsInterpretation.vue` to render, in order:

1. `[data-result-judgment]` with headline, Cpk, Target, and signed margin.
2. `[data-engineering-summary]`.
3. Root causes as `[data-root-cause-item]`, each with title, explanation, rule ID, and incomplete-evidence marker when applicable.
4. `[data-engineering-risk]`.
5. Suggested actions as `[data-action-sequence-item]`, labeled as a sequence rather than ranking.
6. Existing verification requirements and new `[data-evidence-disclosure]`.
7. Existing Input Readiness section.

Use a single-column reading flow for narrative sections, restrained left-border emphasis for judgment/risk, tabular numbers, and the existing responsive breakpoint. Remove the old equal-weight `data-engineering-interpretation` list container.

- [ ] **Step 6: Run F7 Web tests and build to GREEN**

```powershell
node_modules/.bin/vitest.cmd run apps/f7-web/src/assumption-results-interpretation.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts apps/f7-web/src/App.test.ts
npm run build:f7:web
```

Expected: all tests pass and Vite build succeeds without type errors.

- [ ] **Step 7: Commit Task 2**

```powershell
git add apps/f7-web package-lock.json
git commit -m "feat: present F7 engineering narrative"
```

### Task 3: Reuse The Narrative In The Local Report

**Files:**
- Modify: `apps/f7-local-api/package.json`
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `apps/f7-local-api/src/f7-report.ts`
- Modify: `apps/f7-local-api/src/f7-report.test.ts`

- [ ] **Step 1: Add failing report contract and projection tests**

Extend the report fixture assertions so available analysis includes structured `narrative`. Require judgment, root causes, engineering risk, suggested actions, validation requirements, evidence disclosure, rule IDs, and raw quantitative evidence. Assert Markdown headings in this order:

```ts
const headings = [
  "### Result Judgment",
  "### Root Cause Analysis",
  "### Engineering Risk",
  "### Suggested Action Sequence",
  "### Verification Requirements",
  "### Evidence Disclosure",
];
for (let index = 1; index < headings.length; index += 1) {
  expect(report.markdown.indexOf(headings[index]!)).toBeGreaterThan(report.markdown.indexOf(headings[index - 1]!));
}
```

Assert the report does not contain `/ranked recommendation|release decision|optimized tolerance/i`.

- [ ] **Step 2: Run contracts and report tests and verify RED**

```powershell
node_modules/.bin/vitest.cmd run packages/contracts/src/contracts.test.ts apps/f7-local-api/src/f7-report.test.ts
```

Expected: FAIL because the report schema and projection lack `narrative`.

- [ ] **Step 3: Add the structured report narrative schema**

In `f7-contracts.ts`, define strict schemas corresponding to the shared output. Keep finite numeric evidence as numbers, use enums for statuses/directions, require rule IDs and titles, and add `narrative` to the available `f7ReportAnalysisSchema`. Do not add narrative to unavailable analysis.

The root-cause item schema must include:

```ts
z.object({
  ruleId: z.string().min(1),
  title: z.string().min(1),
  hypothesis: z.literal(true),
  explanation: z.string().min(1),
  completeEvidence: z.boolean(),
  quantitativeEvidence: z.record(z.string(), z.union([z.string(), finiteNumberSchema])).optional(),
}).strict()
```

- [ ] **Step 4: Build the report narrative from the same evaluator result**

Add `@ai-assist/product-language` to local API dependencies. In `createF0Analysis`, call the shared builder with `evidenceBasis: "measured"`, `method: "monte-carlo"`, Monte Carlo capability/specification facts, evaluator rules/options, and available contributor facts. Store the returned structure as `analysis.narrative`.

Do not reuse setup-versus-Monte-Carlo comparison heuristics to create root-cause claims. Retain factual comparison lines only as a separate comparison section.

- [ ] **Step 5: Render Markdown from structured narrative fields**

Replace the current generic F0 interpretation block with the six approved headings. Render root-cause explanations and IDs, action titles and option IDs, deduplicated validation steps, and every disclosure line. Do not parse prose to reconstruct evidence.

- [ ] **Step 6: Build and rerun report tests to GREEN**

```powershell
node_modules/.bin/tsc.cmd -b packages/contracts packages/product-language apps/f7-local-api --force
node_modules/.bin/vitest.cmd run packages/contracts/src/contracts.test.ts packages/product-language/src/f7-engineering-narrative.test.ts apps/f7-local-api/src/f7-report.test.ts
```

Expected: all contract, shared builder, and report tests pass.

- [ ] **Step 7: Commit Task 3**

```powershell
git add apps/f7-local-api packages/contracts package-lock.json
git commit -m "feat: add governed narrative to F7 report"
```

### Task 4: Cross-Consumer Verification And Runtime Build

**Files:**
- Generated: `packages/product-language/dist/*`
- Generated: `packages/contracts/dist/f7-contracts.d.ts`
- Generated: `apps/vscode-extension/runtime/cli/index.mjs`

- [ ] **Step 1: Run full TypeScript build**

```powershell
npm run build -- --force
```

Expected: exit code 0.

- [ ] **Step 2: Run focused F0/F7 regression suites**

```powershell
node_modules/.bin/vitest.cmd run packages/contracts/src/contracts.test.ts packages/knowledge-base/src/interpretation packages/product-language/src/f7-engineering-narrative.test.ts apps/f7-web/src apps/f7-local-api/src
```

Expected: all selected test files pass.

- [ ] **Step 3: Run repository and lint gates**

```powershell
npm run lint
npm run check:repository
```

Expected: both commands exit 0.

- [ ] **Step 4: Build Web and beta runtime**

```powershell
npm run build:f7:web
npm run build:beta
```

Expected: both commands exit 0, and the runtime bundle contains `buildF7EngineeringNarrative`, `root-cause-excessive-variation`, `root-cause-mean-shift`, and `root-cause-contributor-concentration`.

- [ ] **Step 5: Review generated and source diff**

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors, no workbook assets, and only planned source, test, package metadata, generated declaration, runtime, spec, and plan paths.

- [ ] **Step 6: Request independent code review**

Review against the approved spec with emphasis on deterministic templates, incomplete-evidence behavior, F0/F6 ownership, Web/report semantic parity, and prohibited optimization/release claims. Resolve blocking findings and rerun the affected tests.

- [ ] **Step 7: Commit remaining generated artifacts and push**

```powershell
git add packages/product-language/dist packages/contracts/dist/f7-contracts.d.ts apps/vscode-extension/runtime/cli/index.mjs
git commit -m "build: refresh F7 narrative runtime artifacts"
git push origin User/Ralf_F0_KnoledgeBase_Update_01
```

Expected: local HEAD equals `origin/User/Ralf_F0_KnoledgeBase_Update_01` and the worktree is clean.