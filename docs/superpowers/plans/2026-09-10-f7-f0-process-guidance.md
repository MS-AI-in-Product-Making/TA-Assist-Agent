# F7 Dynamic F0 Process Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static F7 disclosure and input-readiness UI with notices matched by F0 `process-requirements-v1` against supported worksheet and capability facts.

**Architecture:** Add a focused F7 builder that maps controlled session facts into the existing F0 evaluator and returns matched entries without copying rules. Add the result to both branches of the assumption interpretation model, then render one semantic guidance list after the current interpretation flow.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils, `@ai-assist/knowledge-base`, `@ai-assist/contracts`

---

### Task 1: Build the F0 Process Guidance Model

**Files:**
- Create: `apps/f7-web/src/f0-process-guidance.ts`
- Create: `apps/f7-web/src/f0-process-guidance.test.ts`

- [ ] **Step 1: Write failing worksheet-fact tests**

Create a snapshot factory and assert the threshold, universal matches, capability gap, and
fail-closed behavior:

```ts
it("matches only F0 entries supported by current worksheet facts", () => {
  const seven = buildF0ProcessGuidance(snapshotWithFactorCount(7));
  const eleven = buildF0ProcessGuidance(snapshotWithFactorCount(11));
  expect(seven.status).toBe("available");
  expect(seven.entries.map(({ entryId }) => entryId)).not.toContain("method-escalation-complex-stack");
  expect(seven.entries.map(({ entryId }) => entryId)).toContain("requirement-input-completeness");
  expect(eleven.entries.map(({ entryId }) => entryId)).toContain("method-escalation-complex-stack");
});

it.each([[true, true], [false, false]] as const)(
  "maps requirement gap %s without inventing a match",
  (gap, expected) => {
    const result = buildF0ProcessGuidance(snapshotWithFactorCount(1), gap);
    expect(result.entries.some(({ entryId }) => entryId === "requirement-gap-ado-notice")).toBe(expected);
  },
);

it("fails closed when F0 is unavailable", () => {
  const result = buildF0ProcessGuidance(snapshotWithFactorCount(1), undefined, {
    load: () => { throw new Error("unavailable"); },
  });
  expect(result).toEqual({ status: "unavailable", entries: [] });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npx vitest run --project f7-web apps/f7-web/src/f0-process-guidance.test.ts
```

Expected: FAIL because `f0-process-guidance.ts` does not exist.

- [ ] **Step 3: Implement the minimal governed builder**

```ts
import type { DeepReadonly } from "vue";
import type { ProcessRequirementMatchedEntry } from "@ai-assist/contracts";
import { loadProcessRequirements } from "@ai-assist/knowledge-base";
import type { F7SessionSnapshot } from "./api/f7-client";

const VERSION = "process-requirements-v1" as const;

export type F0ProcessGuidance =
  | { readonly status: "available"; readonly version: typeof VERSION; readonly entries: readonly ProcessRequirementMatchedEntry[] }
  | { readonly status: "unavailable"; readonly entries: readonly [] };

interface Dependencies { readonly load?: typeof loadProcessRequirements }

export function buildF0ProcessGuidance(
  session: DeepReadonly<F7SessionSnapshot>,
  requirementGapPresent?: boolean,
  dependencies: Dependencies = {},
): F0ProcessGuidance {
  try {
    const evaluation = (dependencies.load ?? loadProcessRequirements)({ version: VERSION })
      .evaluateProcessRequirements({
        actor: "all",
        analysisMethod: "one-dimensional-rss",
        toleranceCount: session.factors.length,
        ...(requirementGapPresent === undefined ? {} : { requirementGapPresent }),
      });
    return { status: "available", version: VERSION, entries: evaluation.matchedEntries };
  } catch {
    return { status: "unavailable", entries: [] };
  }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command again. Expected: all tests PASS.

- [ ] **Step 5: Commit the builder**

```powershell
git add apps/f7-web/src/f0-process-guidance.ts apps/f7-web/src/f0-process-guidance.test.ts
git commit -m "feat(f7-web): evaluate F0 process guidance"
```

### Task 2: Attach Guidance to Assumption Interpretation

**Files:**
- Modify: `apps/f7-web/src/assumption-results-interpretation.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.test.ts`

- [ ] **Step 1: Write failing integration tests**

```ts
it("adds the governed capability gap to F0 process guidance", () => {
  const result = buildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
  expect(result.processGuidance.entries.map(({ entryId }) => entryId))
    .toContain("requirement-gap-ado-notice");
});

it("retains worksheet-supported F0 guidance before calculation is available", () => {
  const snapshot = { ...enhancedInterpretationSnapshot(), systemSpecification: { status: "unavailable" } };
  const result = buildAssumptionResultsInterpretation(snapshot as F7SessionSnapshot);
  expect(result.status).toBe("unavailable");
  expect(result.processGuidance.entries.map(({ entryId }) => entryId))
    .toContain("requirement-input-completeness");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npx vitest run --project f7-web apps/f7-web/src/assumption-results-interpretation.test.ts
```

Expected: FAIL because `processGuidance` is absent from the interpretation union.

- [ ] **Step 3: Add guidance to both union branches**

Import `buildF0ProcessGuidance` and `F0ProcessGuidance`. Add
`readonly processGuidance: F0ProcessGuidance` to both union branches. Build base guidance before
prerequisite checks, pass it through every `unavailable(...)` result, and reevaluate after governed
capability status is known:

```ts
const processGuidance = buildF0ProcessGuidance(session);
// prerequisite failures include processGuidance

const governedProcessGuidance = buildF0ProcessGuidance(
  session,
  capabilityStatus === "below-target",
);
// available result includes processGuidance: governedProcessGuidance
```

Keep calculation, interpretation-rule, narrative, and non-rendered readiness fields unchanged.

- [ ] **Step 4: Run focused interpretation tests and verify GREEN**

Run the Step 2 command again. Expected: all tests PASS.

- [ ] **Step 5: Commit the integration**

```powershell
git add apps/f7-web/src/assumption-results-interpretation.ts apps/f7-web/src/assumption-results-interpretation.test.ts
git commit -m "feat(f7-web): attach F0 guidance to interpretation"
```

### Task 3: Replace Static Disclosure UI

**Files:**
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [ ] **Step 1: Write failing component expectations**

Replace old disclosure/readiness expectations with these assertions. Add a mocked interpretation
containing all five displayed entry types and assert their `data-entry-type` order. Add an empty
entries case and assert the complete section is omitted.

```ts
expect(wrapper.find("[data-assumption-disclosure]").exists()).toBe(false);
expect(wrapper.find("[data-input-readiness]").exists()).toBe(false);
expect(wrapper.text()).not.toContain("Verification Requirements");
expect(wrapper.text()).not.toContain("Evidence Disclosure");
expect(wrapper.text()).not.toContain("Assumption Disclosure");
expect(wrapper.get("[data-process-guidance]").text()).toContain("F0 Process Guidance");
expect(wrapper.get("[data-guidance-version]").text()).toBe("process-requirements-v1");
expect(wrapper.findAll("[data-guidance-entry]").length).toBeGreaterThan(0);
expect(wrapper.text()).not.toContain("missingFacts");
```

- [ ] **Step 2: Run the focused component test and verify RED**

```powershell
npx vitest run --project f7-web apps/f7-web/src/components/TAResultsInterpretation.test.ts
```

Expected: FAIL because old sections still render and process guidance does not.

- [ ] **Step 3: Render the dynamic guidance section**

Remove the static disclosure and Input Readiness blocks. Render only available, non-empty guidance
after the available/unavailable interpretation content:

```vue
<section
  v-if="interpretation.processGuidance.status === 'available' && interpretation.processGuidance.entries.length > 0"
  class="process-guidance"
  data-process-guidance
>
  <div class="process-guidance-heading">
    <div>
      <h3>F0 Process Guidance</h3>
      <p>Triggered by the current TA worksheet and analysis state.</p>
    </div>
    <span data-guidance-version>{{ interpretation.processGuidance.version }}</span>
  </div>
  <ul class="process-guidance-list">
    <li
      v-for="entry in interpretation.processGuidance.entries"
      :key="entry.entryId"
      class="process-guidance-entry"
      data-guidance-entry
      :data-entry-type="entry.entryType"
    >
      <div class="process-guidance-entry-heading">
        <span class="process-guidance-type">{{ entry.entryType }}</span>
        <strong>{{ entry.title }}</strong>
        <span class="rule-id">{{ entry.entryId }}</span>
      </div>
      <p>{{ entry.message }}</p>
    </li>
  </ul>
</section>
```

Add scoped red escalation, amber warning, and restrained distinct labels for remaining types. Keep
the section unframed, allow all headings/messages to wrap, and remove styles used only by deleted
DOM.

- [ ] **Step 4: Run focused component tests and verify GREEN**

Run the Step 2 command again. Expected: all tests PASS.

- [ ] **Step 5: Commit the presentation change**

```powershell
git add apps/f7-web/src/components/TAResultsInterpretation.vue apps/f7-web/src/components/TAResultsInterpretation.test.ts
git commit -m "feat(f7-web): render dynamic F0 process guidance"
```

### Task 4: Validate Behavior and Responsive Presentation

**Files:**
- Verify only; modify Task 1-3 files only when a check exposes a local defect.

- [ ] **Step 1: Run complete F7 tests**

```powershell
npx vitest run --project f7-web
```

Expected: all F7 Web test files PASS.

- [ ] **Step 2: Run production typecheck and build**

```powershell
npm run build:f7:web
```

Expected: `vue-tsc --noEmit` and Vite build complete successfully.

- [ ] **Step 3: Run focused lint and patch validation**

```powershell
npx eslint apps/f7-web/src/f0-process-guidance.ts apps/f7-web/src/f0-process-guidance.test.ts apps/f7-web/src/assumption-results-interpretation.ts apps/f7-web/src/assumption-results-interpretation.test.ts apps/f7-web/src/components/TAResultsInterpretation.vue apps/f7-web/src/components/TAResultsInterpretation.test.ts
git diff --check HEAD~3 HEAD
```

Expected: both commands exit 0 without diagnostics.

- [ ] **Step 4: Verify browser presentation**

Reload `http://127.0.0.1:5177`, import the controlled test workbook through the existing picker,
confirm a worksheet, and inspect desktop and mobile widths. Verify no overlap, wrapping labels,
absence of old headings, and agreement between displayed entries and current F0 evaluation.

- [ ] **Step 5: Review final state**

```powershell
git status --short --branch
git log -5 --oneline --decorate
```

Expected: clean worktree with the design, plan, and focused implementation commits.