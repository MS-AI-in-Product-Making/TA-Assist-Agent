# Issue #106 Language, Triggering, and Input Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the workflow language, route user requests to an explicit product workflow, and give every user input complete localized guidance.

**Architecture:** `@ai-assist/product-language` owns canonical language, capability labels, top-level intent, and input metadata. The F8 session snapshot is the single source of truth for locked language; VS Code, server, runtime, and Web consume it instead of detecting language per turn. The participant classifies the product workflow before invoking workbook path parsing.

**Tech Stack:** TypeScript, Zod, VS Code Extension API, React, Vitest, Testing Library, repository `.mjs` tests.

**Spec:** `docs/superpowers/specs/2026-09-07-issue-106-ux-agent-triggering-design.md`

## Global Constraints

- The first valid workflow request locks the session language; confirmations, paths, worksheet names, artifacts, tool output, and model output cannot change it.
- Fixed UI has complete `en` and `zh` catalogs; other BCP 47 languages use English fixed UI while model replies and reports retain the locked language tag.
- User-visible surfaces use exact catalog capability names and never expose bare internal stage identifiers.
- Unknown or ambiguous requests cannot default to workbook analysis.
- Every user-provided value control has registry metadata for content, purpose, example, validation, consequence, next step, and recovery where applicable.
- Historical snapshots remain readable through an explicit legacy fallback; new sessions always persist the language lock.

---

### Task 1: Product Language, Capability, and Input Registries

**Files:**
- Create: `packages/product-language/src/interaction-language.ts`
- Create: `packages/product-language/src/interaction-language.test.ts`
- Create: `packages/product-language/src/input-metadata.ts`
- Create: `packages/product-language/src/input-metadata.test.ts`
- Modify: `packages/product-language/src/ta-workbook-language.ts`
- Modify: `packages/product-language/src/ta-workbook-language.test.ts`
- Modify: `packages/product-language/src/index.ts`

**Interfaces:**
- Produces: `InteractionLanguage`, `resolveInteractionLanguage()`, `changeInteractionLanguage()`, `inputMetadata()`, and the canonical capability-name catalog.
- Consumed by: Tasks 2, 4, 5, and every later Issue #106 plan.

- [ ] **Step 1: Write failing language and catalog tests**

```ts
it("locks a Japanese request while falling fixed UI back to English", () => {
  expect(resolveInteractionLanguage({ text: "公差解析を開始", turnId: "turn-1", explicitLanguageTag: "ja-JP" })).toEqual({
    languageTag: "ja-JP",
    uiCatalogLanguage: "en",
    lockedAtTurnId: "turn-1",
    source: "workflow_start",
    fallbackUsed: true,
  });
});

it("returns the exact Chinese calculation capability name", () => {
  expect(productCapabilityLabel("ta_calculation", "zh")).toBe("公差分析计算");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run packages/product-language/src/interaction-language.test.ts packages/product-language/src/input-metadata.test.ts packages/product-language/src/ta-workbook-language.test.ts`

Expected: FAIL because the new modules and complete metadata registry do not exist.

- [ ] **Step 3: Implement the canonical types and registries**

```ts
export type UiCatalogLanguage = "en" | "zh";
export type LanguageLockSource = "workflow_start" | "explicit_user_change" | "legacy_fallback";

export interface InteractionLanguage {
  readonly languageTag: string;
  readonly uiCatalogLanguage: UiCatalogLanguage;
  readonly lockedAtTurnId: string;
  readonly source: LanguageLockSource;
  readonly fallbackUsed: boolean;
}

export type UserInputKind = "text" | "number" | "file" | "radio" | "checkbox" | "combobox";

export interface LocalizedInputMetadata {
  readonly kind: UserInputKind;
  readonly title: string;
  readonly whatToEnter: string;
  readonly purpose: string;
  readonly example: string;
  readonly validationHint: string;
  readonly consequence?: string;
  readonly nextStep?: string;
  readonly recovery?: string;
}
```

Use a closed `UserInputId` union and `satisfies Record<UserInputId, ...>` so missing catalog entries fail TypeScript compilation.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx vitest run packages/product-language/src/interaction-language.test.ts packages/product-language/src/input-metadata.test.ts packages/product-language/src/ta-workbook-language.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/product-language/src
git commit -m "feat(language): add workflow language and input catalogs"
```

### Task 2: Persist the Session Language Lock

**Files:**
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`
- Modify: `packages/workbench/src/session-store.ts`
- Modify: `packages/workbench/src/session-store.test.ts`
- Modify: `packages/workbench/src/state-machine.ts`
- Modify: `packages/workbench/src/state-machine.test.ts`

**Interfaces:**
- Consumes: `InteractionLanguage` from Task 1.
- Produces: `snapshot.interactionLanguage` and a revision-checked `set_interaction_language` command used only for explicit user changes.

- [ ] **Step 1: Add failing contract and persistence tests**

```ts
it("reopens a session with the original interaction language", async () => {
  const created = await store.create({ interactionLanguage: englishLock });
  const reopened = await store.get(created.sessionId);
  expect(reopened.interactionLanguage).toEqual(englishLock);
});

it("does not change language during workbook replacement", () => {
  const next = reduceSessionCommand(snapshot, replaceWorkbookCommand);
  expect(next.interactionLanguage).toEqual(snapshot.interactionLanguage);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run packages/contracts/src/f8-contracts.test.ts packages/workbench/src/session-store.test.ts packages/workbench/src/state-machine.test.ts`

Expected: FAIL because snapshots do not store `interactionLanguage`.

- [ ] **Step 3: Add compatible schema and reducer behavior**

Make the persisted schema accept missing language only during legacy read. Materialize a legacy value with `source: "legacy_fallback"`; require an explicit lock on every new session. Bind explicit changes to `expectedRevision` and `turnId`.

- [ ] **Step 4: Re-run focused tests**

Run: `npx vitest run packages/contracts/src/f8-contracts.test.ts packages/workbench/src/session-store.test.ts packages/workbench/src/state-machine.test.ts`

Expected: PASS, including legacy fixture coverage.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/f8-contracts* packages/workbench/src/session-store* packages/workbench/src/state-machine*
git commit -m "feat(workbench): persist interaction language"
```

### Task 3: Add the Top-Level Product Workflow Router

**Files:**
- Create: `packages/product-language/src/workflow-intent.ts`
- Create: `packages/product-language/src/workflow-intent.test.ts`
- Modify: `packages/product-language/src/index.ts`
- Modify: `apps/vscode-extension/src/analyze-intent.ts`
- Modify: `apps/vscode-extension/src/analyze-intent.test.ts`
- Modify: `apps/vscode-extension/src/participant.ts`
- Modify: `apps/vscode-extension/src/participant.test.ts`
- Create: `scripts/agent-triggering-surface.test.mjs`
- Modify: `.github/skills/ta-real-measurement-analysis/SKILL.md`
- Modify: `.github/skills/feedback-application/SKILL.md`
- Modify: `scripts/product-skills.test.mjs`

**Interfaces:**
- Produces: `classifyTopLevelWorkflowIntent(text): TopLevelWorkflowIntent`.
- Preserves: `classifyAnalyzeIntent()` as the workbook-path parser invoked only after `workbook_analysis` is selected.

- [ ] **Step 1: Write the intent corpus and participant failures**

```ts
it.each([
  ["Analyze actual measurements for these factors", "measured_analysis"],
  ["Explain what Cpk means", "knowledge_question"],
  ["Help me with this", "clarification_required"],
  ["Analyze TA.xlsx", "workbook_analysis"],
])("classifies %s", (text, kind) => {
  expect(classifyTopLevelWorkflowIntent(text).kind).toBe(kind);
});
```

Add negative corpus for generic Monte Carlo programming and non-TA measurement analysis.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/product-language/src/workflow-intent.test.ts apps/vscode-extension/src/analyze-intent.test.ts apps/vscode-extension/src/participant.test.ts scripts/agent-triggering-surface.test.mjs`

Expected: FAIL because unknown input still falls into the existing analyze path and the trigger corpus has overlapping owners.

- [ ] **Step 3: Implement the pure router and participant branching**

```ts
export type TopLevelWorkflowIntent =
  | { readonly kind: "workbook_analysis" }
  | { readonly kind: "measured_analysis" }
  | { readonly kind: "session_operation"; readonly operation: "resume" | "status" | "change_language" }
  | { readonly kind: "knowledge_question" }
  | { readonly kind: "clarification_required"; readonly candidates: readonly ProductWorkflowId[] }
  | { readonly kind: "unsupported" };
```

Do not add a default `workbook_analysis` branch. Return a localized clarification with product capability names when evidence is insufficient.

- [ ] **Step 4: Tighten Skill descriptions and pass the corpus**

Keep real-measurement triggers explicit and exclude generic Cpk/Monte Carlo questions. Keep feedback application scoped to importing reviewed feedback into an existing analysis.

Run: `npx vitest run packages/product-language/src/workflow-intent.test.ts apps/vscode-extension/src/analyze-intent.test.ts apps/vscode-extension/src/participant.test.ts scripts/agent-triggering-surface.test.mjs scripts/product-skills.test.mjs`

Expected: PASS with one unambiguous owner per positive trigger.

- [ ] **Step 5: Commit**

```powershell
git add packages/product-language apps/vscode-extension/src .github/skills scripts/agent-triggering-surface.test.mjs scripts/product-skills.test.mjs
git commit -m "feat(agent): route explicit product workflows"
```

### Task 4: Carry Locked Language from VS Code into Model Responses

**Files:**
- Modify: `apps/vscode-extension/src/workbench-launcher.ts`
- Modify: `apps/vscode-extension/src/workbench-launcher.test.ts`
- Modify: `apps/cli/src/commands/agent.ts`
- Modify: `apps/cli/src/commands/agent-launcher.ts`
- Modify: `apps/cli/src/commands/agent.test.ts`
- Modify: `packages/agent-runtime/src/runtime.ts`
- Modify: `packages/agent-runtime/src/runtime.test.ts`
- Modify: `apps/workbench-server/src/model-prompt.ts`
- Modify: `apps/workbench-server/src/model-prompt.test.ts`
- Modify: `apps/workbench-server/src/routes/conversation.ts`
- Modify: `apps/workbench-server/src/routes/conversation.test.ts`
- Modify: `apps/workbench-server/src/routes/host-actions.ts`

**Interfaces:**
- Consumes: persisted `InteractionLanguage` from Task 2.
- Changes: `buildEvidenceLabeledModelPrompt(userText, context, interactionLanguage)`.

- [ ] **Step 1: Write cross-turn language failures**

Test an English initial request followed by a Chinese worksheet name, and a Chinese session receiving English model output. Assert prompt instruction, assistant projection, and capability labels remain locked.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/vscode-extension/src/workbench-launcher.test.ts apps/cli/src/commands/agent.test.ts packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/model-prompt.test.ts apps/workbench-server/src/routes/conversation.test.ts`

Expected: FAIL where components re-detect the current text or model response.

- [ ] **Step 3: Propagate and consume the lock**

Add an internal launch argument carrying the serialized lock into session creation. Remove per-turn `detectUserLanguage()` from runtime, model prompt, and host result projection. Keep detection only at workflow start or explicit change.

- [ ] **Step 4: Re-run focused tests**

Run the same command from Step 2.

Expected: PASS for cross-turn, resume, and replacement scenarios.

- [ ] **Step 5: Commit**

```powershell
git add apps/vscode-extension apps/cli packages/agent-runtime apps/workbench-server
git commit -m "feat(agent): enforce session language across hosts"
```

### Task 5: Apply Input Metadata and Exact Product Names to User Surfaces

**Files:**
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `apps/vscode-extension/src/extension.test.ts`
- Modify: `apps/workbench-web/src/web-projection.ts`
- Modify: `apps/workbench-web/src/web-projection.test.ts`
- Modify: `apps/workbench-web/src/app.tsx`
- Modify: `apps/workbench-web/src/app.test.tsx`
- Modify: `apps/workbench-web/src/components/UploadPanel.tsx`
- Create: `apps/workbench-web/src/components/UploadPanel.test.tsx`
- Modify: `apps/workbench-web/src/components/WorksheetSelection.tsx`
- Create: `apps/workbench-web/src/components/WorksheetSelection.test.tsx`
- Modify: `apps/workbench-web/src/components/ConversationPane.tsx`
- Modify: `apps/workbench-web/src/components/F6InputGate.tsx`
- Modify: `apps/workbench-web/src/components/F6InputGate.test.tsx`
- Modify: `apps/workbench-web/src/components/AdoWorkspaceDecision.tsx`
- Modify: `scripts/product-language-surface.test.mjs`

**Interfaces:**
- Consumes: `inputMetadata()` and capability catalog from Task 1; `snapshot.interactionLanguage` from Task 2.
- Produces: accessible, localized prompts and labels on all mounted user inputs.

- [ ] **Step 1: Add registry coverage and accessibility failures**

```tsx
expect(screen.getByRole("textbox", { name: metadata.title })).toHaveAttribute(
  "aria-describedby",
  `${inputId}-guidance`,
);
expect(screen.getByText(metadata.example)).toBeVisible();
```

Add a test that compares mounted `data-user-input-id` values with the applicable registry IDs.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/vscode-extension/src/extension.test.ts apps/workbench-web/src/app.test.tsx apps/workbench-web/src/components/UploadPanel.test.tsx apps/workbench-web/src/components/WorksheetSelection.test.tsx apps/workbench-web/src/components/F6InputGate.test.tsx scripts/product-language-surface.test.mjs`

Expected: FAIL because existing controls use ad hoc labels and placeholders.

- [ ] **Step 3: Render metadata and exact catalog labels**

Use persistent helper text in Web; use VS Code `title`, `prompt`, and `placeHolder` for their defined roles. Hide developer-only Host action IDs from normal user flows. Do not add nested cards or duplicate input descriptions.

- [ ] **Step 4: Run Web and surface validation**

Run: `npm test --workspace @ai-assist/workbench-web`

Run: `npx vitest run apps/vscode-extension/src/extension.test.ts scripts/product-language-surface.test.mjs`

Expected: PASS in both English and Chinese fixtures.

- [ ] **Step 5: Commit**

```powershell
git add apps/vscode-extension/src apps/workbench-web/src scripts/product-language-surface.test.mjs
git commit -m "feat(ux): localize and explain user inputs"
```

### Task 6: Phase Verification

**Files:**
- Test only; no source edits unless a failure is caused by this phase.

**Interfaces:**
- Produces: a stable language and intent foundation for the remaining Issue #106 plans.

- [ ] **Step 1: Run all phase tests**

```powershell
npx vitest run packages/product-language/src packages/contracts/src/f8-contracts.test.ts packages/workbench/src/session-store.test.ts packages/workbench/src/state-machine.test.ts packages/agent-runtime/src/runtime.test.ts apps/vscode-extension/src/analyze-intent.test.ts apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.test.ts apps/workbench-server/src/model-prompt.test.ts apps/workbench-server/src/routes/conversation.test.ts scripts/agent-triggering-surface.test.mjs scripts/product-language-surface.test.mjs scripts/product-skills.test.mjs
npm test --workspace @ai-assist/workbench-web
npm run build -- --force
```

Expected: every command exits 0.

- [ ] **Step 2: Commit generated lockfile changes only if dependency declarations changed**

```powershell
git status --short
git add package-lock.json apps/cli/package.json apps/vscode-extension/package.json
git commit -m "build: wire product language dependencies"
```

Skip this commit when those files are unchanged.