# F5.1 Objective Interpretation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an available F5.1 service that converts completed F4 results into immutable, traceable FACT/RULE/SIGNAL/OPTION statements by invoking F0 `interpretation-rules-v1`.

**Architecture:** Extend the existing strict F5 placeholder contracts into a completed F5.1 request/result union while retaining the legacy unavailable result for compatibility. Replace the placeholder implementation with a deterministic interpreter that projects F4 facts, calls the F0 rule engine only for RSS, classifies matched entries without ranking, and emits scoped clarifications. Register F5.1 independently while leaving root F5 unavailable.

**Tech Stack:** TypeScript strict ESM, Zod v3, Vitest v3, `@ai-assist/contracts`, `@ai-assist/knowledge-base`.

---

### Task 1: Define strict F5.1 contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add tests that construct a valid `calculationCompletedResultSchema` fixture and require:

```ts
const request = {
  contractVersion: "v1",
  inputClassification: "confidential",
  calculationResult: completedCalculation,
};
const result = {
  contractVersion: "v1",
  outputClassification: "confidential",
  featureId: "F5.1",
  status: "completed",
  interpretationVersion: "objective-interpretation-v1",
  projectReference: completedCalculation.projectReference,
  runReference: completedCalculation.runReference,
  workbookContentHash: completedCalculation.workbookContentHash,
  worksheetSelection: completedCalculation.worksheetSelection,
  calculationVersion: "excel-ta-v1",
  knowledgeBaseVersion: "interpretation-rules-v1",
  ruleEvaluationStatus: "matched",
  statements: [],
  clarifications: [],
};
expect(interpretationRequestSchema.parse(request)).toEqual(request);
expect(interpretationResultSchema.parse(result)).toEqual(result);
```

Also require rejection of public classification, unknown fields, `feature_not_available` calculation input, RULE without evidence, SIGNAL without `requiresEngineeringReview: true`, and OPTION with a numeric rank.

- [ ] **Step 2: Run the focused contract test and verify RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL because the current interpretation schemas accept only controlled references and an unavailable F5 result.

- [ ] **Step 3: Implement the strict schemas and inferred types**

In `contracts.ts`:

- Export `calculationCompletedResultSchema` input through `interpretationRequestSchema`.
- Define strict FACT, RULE, SIGNAL, OPTION and clarification schemas.
- Define `interpretationCompletedResultSchema` with `featureId: "F5.1"`.
- Preserve `interpretationLegacyUnavailableResultSchema` and export `interpretationResultSchema` as a union.
- Keep `InterpretationRequest` and `InterpretationResult` inferred from the new schemas.

FACT content must contain a controlled metric enum, finite value, optional unit, F4 output field and trace records. Rule-derived statements must contain `entryId`, related fact references and full F0 evidence. OPTION must use `rank: null`.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run the command from Step 2. Expected: all contract tests pass.

- [ ] **Step 5: Commit contracts**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(f5.1): define objective interpretation contracts"
```

### Task 2: Implement the F0-driven interpreter

**Files:**
- Modify: `packages/workbook-catalog/src/interpretation-placeholder.test.ts`
- Modify: `packages/workbook-catalog/src/interpretation-placeholder.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write failing RSS below-target service test**

Build an F4 result with 4 factors and assert `createInterpretation` returns:

```ts
expect(result).toMatchObject({
  featureId: "F5.1",
  status: "completed",
  knowledgeBaseVersion: "interpretation-rules-v1",
  ruleEvaluationStatus: "matched",
});
expect(result.statements.some((entry) => entry.type === "FACT" && entry.content.metric === "cpk")).toBe(true);
expect(result.statements.some((entry) => entry.type === "RULE" && entry.content.entryId === "performance-cpk-below-target")).toBe(true);
expect(result.statements.some((entry) => entry.type === "SIGNAL" && entry.content.entryId === "root-cause-contributor-concentration")).toBe(true);
expect(result.statements.some((entry) => entry.type === "OPTION" && entry.content.rank === null)).toBe(true);
```

Assert every rule-derived statement has F0 evidence and the result is deeply frozen.

- [ ] **Step 2: Run the focused service test and verify RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/interpretation-placeholder.test.ts
```

Expected: FAIL because `createInterpretation` is not exported and the placeholder returns unavailable.

- [ ] **Step 3: Implement minimal RSS interpretation**

Export `createInterpretation(request: unknown): InterpretationResult`. Validate the confidential request, project F4 FACT statements, call:

```ts
const rules = loadInterpretationRules({ version: "interpretation-rules-v1" });
const evaluation = rules.evaluateInterpretationRules({
  analysisDimension: "one-dimensional",
  method: "rss",
  facts: {
    cpk: calculation.capability.cpk,
    targetCpk: { value: calculation.capability.targetCpk, source: "project" },
    achievedSigma: Math.min(calculation.capability.lowerZ, calculation.capability.upperZ),
    targetSigma: { value: calculation.capability.targetSigmaLevel, source: "project" },
    contributors: calculation.factors.map((factor) => ({
      reference: `${factor.source.worksheetName}/${factor.source.tableId}/${factor.source.sourceRow}`,
      contributionPercent: factor.contribution * 100,
    })),
  },
});
```

Map performance rules to RULE, root-cause signals to SIGNAL, and improvement options to OPTION. Add the drawing evidence clarification and return a schema-validated cloned frozen result.

- [ ] **Step 4: Run service test and verify GREEN**

Run Step 2 command. Expected: RSS below-target test and existing privacy/ESM tests pass.

- [ ] **Step 5: Add failing applicability and privacy tests**

Require:

- RSS meeting target does not emit root-cause SIGNAL or OPTION.
- WC retains FACT, returns `not-applicable`, and emits `rule_method_not_applicable`.
- 3D referral emits `three_dimensional_follow_up_required` and no RSS rule statements.
- Public input returns `policy_denied`.
- Invalid values do not appear in typed errors.
- Built ESM package exports `createInterpretation`.

- [ ] **Step 6: Run tests and verify RED for unsupported paths**

Run Step 2 command. Expected: at least WC/3D or ESM export assertion fails before implementation.

- [ ] **Step 7: Implement applicability and clarification paths**

For `rss_1d`, invoke F0. For other methods, synthesize a contract-valid `not-applicable` evaluation state without calling F0. Always emit deterministic FACT statements. Add method and 3D clarifications as specified; keep rule-derived statements absent.

Retain `createInterpretationPlaceholder` as a compatibility alias to `createInterpretation` only if existing consumers require it; otherwise export both names with the placeholder marked deprecated by naming, not by runtime behavior.

- [ ] **Step 8: Run focused service and contract tests**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/interpretation-placeholder.test.ts packages/knowledge-base/src/interpretation/query.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 9: Commit service**

```powershell
git add packages/workbook-catalog/src/interpretation-placeholder.ts packages/workbook-catalog/src/interpretation-placeholder.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f5.1): interpret F4 results with F0 rules"
```

### Task 3: Register and document F5.1 availability

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/feature-register.md`

- [ ] **Step 1: Write failing governance tests**

Require `getFeatureStatus("F5.1")` to return:

```ts
{
  featureId: "F5.1",
  status: "available",
  inputContractId: "interpretation-request-v1",
  outputContractId: "interpretation-result-v1",
  maximumClassification: "confidential",
}
```

Also assert root F5 remains unavailable and F5.1 lists `anonymous-interpretation-fixture`, `interpretation-rule-traceability-check`, and `interpretation-privacy-check`.

- [ ] **Step 2: Run governance test and verify RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
```

Expected: FAIL because F5.1 is not registered.

- [ ] **Step 3: Add F5.1 to feature IDs and register it**

Extend the governed feature ID schema/type where defined and add an available F5.1 entry with dependencies and checks from the design. Do not alter root F5 availability.

- [ ] **Step 4: Update the Feature Register document**

Add F5.1 to the status summary and table. State that F5.1 covers F4/F0-backed capability and contribution interpretation only, while root F5 remains unavailable for drawing and structural interpretation.

- [ ] **Step 5: Run governance tests and verify GREEN**

Run Step 2 command. Expected: all governance tests pass.

- [ ] **Step 6: Run focused build and validation**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/knowledge-base/src/interpretation/query.test.ts packages/workbook-catalog/src/interpretation-placeholder.test.ts packages/governance/src/policy-gate.test.ts
npm run lint
npm run check:repository
git diff --check
```

Expected: every command exits 0. If the complete suite is run, report the pre-existing CLI fixture and audit lock failures separately unless they disappear.

- [ ] **Step 7: Commit governance and docs**

```powershell
git add packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts docs/governance/feature-register.md
git commit -m "feat(governance): expose F5.1 interpretation capability"
```

### Task 4: Final review

**Files:**
- Review all changed files against `docs/superpowers/specs/2026-07-31-f5-1-objective-interpretation-design.md`.

- [ ] **Step 1: Inspect branch diff and run diagnostics**

```powershell
git diff main...HEAD --check
git status --short
```

Use VS Code diagnostics for all changed TypeScript files. Expected: no diagnostics and a clean worktree after commits.

- [ ] **Step 2: Request code review**

Dispatch the `code-reviewer` agent with the approved design, implementation plan, branch diff, and validation results. Fix any high or medium severity finding using a new RED/GREEN cycle.

- [ ] **Step 3: Re-run final verification**

Repeat Task 3 Step 6 after review fixes. Expected: all focused validation commands exit 0.
