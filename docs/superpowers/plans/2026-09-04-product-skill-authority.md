# Product Skill Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eight product capability Skills the only authoritative analysis Skills while preserving every internal runner and artifact contract.

**Architecture:** Product Skills own agent workflow and user communication. Existing internal command, schema, artifact, manifest, and hash identifiers remain machine contracts behind product-named execution aliases and centralized text projection. Legacy stage input is recognized by code, projected immediately to a product capability name, and never echoed to user-visible surfaces.

**Tech Stack:** Agent Skills Markdown, Node.js npm scripts, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-product-skill-authority-design.md`

## Global Constraints

- Keep exactly eight product capability Skills as the public analysis Skill set.
- Preserve internal runner arguments, TypeScript contracts, schema versions, artifact identities, manifests, hashes, calculations, confirmations, and governance ordering.
- Use the language of the current user request for every response, question, progress update, and action description.
- Keep legacy stage-name recognition implicit; never echo legacy names after routing.
- Do not overwrite user changes or commit without explicit user instruction.
- Use test-first RED-GREEN-REFACTOR for every behavior change.

---

### Task 1: Enforce the Skill authority boundary

**Files:**
- Modify: `scripts/product-skills.test.mjs`
- Test: `scripts/product-skills.test.mjs`

**Interfaces:**
- Consumes: `.github/skills/*/SKILL.md` and directory names.
- Produces: structural assertions defining the only allowed product Skill set and required protocol ownership markers.

- [ ] **Step 1: Write the failing structure tests**

Add assertions that:

```js
const retiredSkills = ["f3-analysis", "f5-analysis", "f6-analysis"];

it.each(retiredSkills)("retires the legacy %s skill", (name) => {
  expect(existsSync(join(root, ".github", "skills", name))).toBe(false);
});

it.each(skills)("does not delegate %s to a legacy skill", (name) => {
  const skill = readFileSync(join(root, ".github", "skills", name, "SKILL.md"), "utf8");
  expect(skill).not.toMatch(/\.\.\/f[356]-analysis/u);
  expect(skill).not.toContain("remains authoritative");
});
```

Also require the three migrated Skills to contain their own entry routing, allowed operations, validation, safety, and user-language sections.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run scripts/product-skills.test.mjs`

Expected: FAIL because the three legacy directories exist and the product Skills delegate to them.

- [ ] **Step 3: Keep the failure focused**

Confirm the failure names only retired directories, delegation references, or missing ownership markers. Fix test syntax only if the test errors instead of failing.

---

### Task 2: Make Drawing Governance authoritative

**Files:**
- Modify: `.github/skills/drawing-governance/SKILL.md`
- Create: `.github/skills/drawing-governance/references/ado-publishing.md`
- Delete: `.github/skills/f3-analysis/SKILL.md`
- Delete: `.github/skills/f3-analysis/references/ado-publishing.md`
- Test: `scripts/product-skills.test.mjs`
- Test: `scripts/f3-skill.test.mjs`

**Interfaces:**
- Consumes: workbook or accepted governance artifact; current parsing/cleaning output; Surface MCP ADO tools.
- Produces: governed Drawing Number and DIM ID report plus terminal ADO publication outcome.

- [ ] **Step 1: Add Drawing Governance protocol assertions**

Require the product Skill to contain exact governed concepts:

```js
expect(skill).toContain("Create a new ADO work item");
expect(skill).toContain("Use an existing ADO work item");
expect(skill).toContain("Do not publish to ADO");
expect(skill).toContain("Confirm write");
expect(skill).toContain("write exactly once");
expect(skill).toContain("read back exactly once");
```

Update `scripts/f3-skill.test.mjs` to read the product Skill and its product-owned ADO reference while keeping all existing protocol assertions.

- [ ] **Step 2: Run both tests and verify RED**

Run: `npx vitest run scripts/product-skills.test.mjs scripts/f3-skill.test.mjs`

Expected: FAIL because Drawing Governance is still a forwarding shell and the product-owned reference does not exist.

- [ ] **Step 3: Migrate the complete protocol**

Move the historical governance and ADO content into the product Skill directory. Rewrite planning headings and user-facing prose around Data Parsing, Data Cleaning, and Drawing Governance. Keep internal command strings, artifact basenames, status codes, HTML markers, and Surface MCP request shapes unchanged in an `Internal executor contract` section.

- [ ] **Step 4: Delete the historical governance Skill directory**

Delete only the two files listed above and remove the empty directory. Do not alter runner or contract source files.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run scripts/product-skills.test.mjs scripts/f3-skill.test.mjs`

Expected: Drawing Governance protocol assertions pass; failures for the two other legacy Skills may remain until their tasks.

---

### Task 3: Make Result Interpretation authoritative

**Files:**
- Modify: `.github/skills/result-interpretation/SKILL.md`
- Delete: `.github/skills/f5-analysis/SKILL.md`
- Test: `scripts/product-skills.test.mjs`
- Test: `scripts/f5-skill.test.mjs`

**Interfaces:**
- Consumes: current parsed workbook assets, governance results, calculations, and optional verified image observations.
- Produces: validated interpretation artifact with FACT, RULE, SIGNAL, OPTION, assumptions, and clarifications kept distinct.

- [ ] **Step 1: Redirect existing protocol tests to the product Skill**

Change only the Skill path under test. Preserve assertions for worksheet selection gates, exact image scopes, immutable observation creation, deterministic fallback, allowed internal commands, containment, hashes, and existing-artifact validation.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run scripts/product-skills.test.mjs scripts/f5-skill.test.mjs`

Expected: FAIL because Result Interpretation does not yet own the complete protocol.

- [ ] **Step 3: Migrate the complete interpretation protocol**

Move the historical Skill body into `result-interpretation`. Organize its agent workflow using product capability names and business gates. Keep machine-only command strings, artifact basenames, schema names, reason codes, and observation versions unchanged in the internal executor sections.

- [ ] **Step 4: Delete the historical interpretation Skill**

Delete `.github/skills/f5-analysis/SKILL.md` and its empty directory.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run scripts/product-skills.test.mjs scripts/f5-skill.test.mjs`

Expected: all Result Interpretation assertions pass; only Design Optimization retirement assertions may remain red.

---

### Task 4: Make Design Optimization authoritative

**Files:**
- Modify: `.github/skills/design-optimization/SKILL.md`
- Delete: `.github/skills/f6-analysis/SKILL.md`
- Test: `scripts/product-skills.test.mjs`
- Create or modify: `scripts/f6-skill.test.mjs`

**Interfaces:**
- Consumes: one TA workbook or accepted optimization artifact; validated outputs from all prerequisite product capabilities.
- Produces: complete governed optimization, final report, run summary, manifest, and product-named ledger.

- [ ] **Step 1: Write Design Optimization ownership tests**

Require workbook and existing-artifact routing, two worksheet gates, governed publication delegation to Drawing Governance by Skill name, optional image evaluation, two independent optional-input confirmations, built-in policy, five-file validation, four-state disposition, and final product ledger.

```js
expect(skill).toContain("Analysis Context");
expect(skill).toContain("Optimization Targets");
expect(skill).toContain("f6-top3-tolerance-policy-v1");
expect(skill).toContain("PASS");
expect(skill).toContain("CONDITIONAL_PASS");
expect(skill).toContain("INCOMPLETE");
expect(skill).toContain("FAIL");
expect(skill).toContain("Drawing Governance");
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run scripts/product-skills.test.mjs scripts/f6-skill.test.mjs`

Expected: FAIL because Design Optimization is a forwarding shell.

- [ ] **Step 3: Migrate the complete optimization protocol**

Move the historical end-to-end workflow into the product Skill. Rename agent phases to business gates such as workbook validation, worksheet selection, parsing and cleaning, drawing governance, calculation, interpretation, optional context, optional targets, optimization, and final presentation. Preserve all internal runner contracts and policy constants.

- [ ] **Step 4: Delete the historical optimization Skill**

Delete `.github/skills/f6-analysis/SKILL.md` and its empty directory.

- [ ] **Step 5: Run all Skill tests and verify GREEN**

Run: `npx vitest run scripts/product-skills.test.mjs scripts/f3-skill.test.mjs scripts/f5-skill.test.mjs scripts/f6-skill.test.mjs`

Expected: PASS and `.github/skills` contains only the eight product analysis Skills.

---

### Task 5: Preserve implicit legacy-input compatibility

**Files:**
- Modify: `packages/product-language/src/ta-workbook-language.ts`
- Modify: `packages/product-language/src/index.ts`
- Modify: `packages/product-language/src/ta-workbook-language.test.ts`
- Modify: `the retired F8 server app/src/model-prompt.ts`
- Modify: `apps/vscode-extension/src/model-host-prompt.ts`

**Interfaces:**
- Produces: `resolveProductCapabilityReference(text: string): TaProductCapabilityId | undefined` and projected user text that never echoes a legacy stage name.
- Consumes: raw user request text.

- [ ] **Step 1: Write failing compatibility tests**

Add cases proving historical stage input resolves to the matching product capability while ordinary engineering text returns `undefined`. Add prompt tests proving the raw historical token is absent and the localized product name is present after projection.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run packages/product-language/src/ta-workbook-language.test.ts the retired F8 server app/src/model-prompt.test.ts apps/vscode-extension/src/model-host-prompt.test.ts`

Expected: FAIL because the resolver is not exported or raw user text is still passed through.

- [ ] **Step 3: Implement minimal parsing and projection**

Implement the resolver with anchored legacy stage forms and reuse `productCapabilityLabel`. Do not expose a public reverse map or change `TaProductCapabilityId`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same focused command. Expected: PASS in Chinese and English cases.

---

### Task 6: Close remaining user-visible leakage paths

**Files:**
- Modify: `the retired F8 server app/src/routes/host-actions.ts`
- Modify: `the retired F8 server app/src/routes/conversation.test.ts`
- Modify: `the retired F8 web app/src/components/ActionQueue.tsx`
- Create or modify: `the retired F8 web app/src/components/ActionQueue.test.tsx`
- Modify: `the retired F8 web app/src/components/ConversationPane.tsx`
- Modify: `the retired F8 web app/src/components/ConversationPane.test.tsx`
- Modify: `the retired F8 web app/src/web-projection.ts`
- Modify: `the retired F8 web app/src/web-projection.test.ts`

**Interfaces:**
- Consumes: internal assistant response, action, decision, command, feature, and artifact references.
- Produces: localized product-safe display strings or a safe fallback.

- [ ] **Step 1: Write failing server and Web tests**

Cover an assistant response containing a historical stage label, action queue items containing internal feature/action values, and command/decision conversation parts containing internal identifiers. Assert rendered/persisted user text contains product names and no prohibited identifier.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run the retired F8 server app/src/routes/conversation.test.ts the retired F8 web app/src/components/ActionQueue.test.tsx the retired F8 web app/src/components/ConversationPane.test.tsx the retired F8 web app/src/web-projection.test.ts`

Expected: FAIL at direct response persistence or raw UI rendering.

- [ ] **Step 3: Apply the centralized projection at each exit**

Reuse product-language and Web projection helpers. Reject or replace unsafe model text before persistence. Render product labels and human action descriptions rather than raw action/state values. Keep raw values in DTOs for command execution.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same command. Expected: PASS with no DTO or command contract changes.

---

### Task 7: Add product-named execution aliases

**Files:**
- Modify: `package.json`
- Modify: `scripts/product-skills.test.mjs`

**Interfaces:**
- Produces npm aliases for `data-parsing`, `data-cleaning`, `drawing-governance`, `ta-calculation`, `result-interpretation`, and `design-optimization`.
- Consumes the same runner files as the existing internal scripts.

- [ ] **Step 1: Write failing alias identity tests**

Read `package.json` and assert each product alias points to exactly the same runner command as its internal counterpart. Parsing and cleaning may share the same runner and differ only by supplied invocation arguments.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run scripts/product-skills.test.mjs`

Expected: FAIL because product aliases are absent.

- [ ] **Step 3: Add aliases without deleting existing scripts**

Add only npm script keys; do not wrap, fork, or modify runner files.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npx vitest run scripts/product-skills.test.mjs`

Expected: PASS and both old automation calls and new product-named calls resolve to identical executors.

---

### Task 8: Full regression and compatibility review

**Files:**
- Review only: all files changed by Tasks 1-7.

**Interfaces:**
- Consumes all implementation changes.
- Produces verification evidence and a compatibility assessment.

- [ ] **Step 1: Run targeted Skill and product-language tests**

Run: `npx vitest run scripts/product-skills.test.mjs scripts/f3-skill.test.mjs scripts/f5-skill.test.mjs scripts/f6-skill.test.mjs packages/product-language/src/ta-workbook-language.test.ts`

Expected: PASS.

- [ ] **Step 2: Run TypeScript build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 3: Run the complete Vitest suite**

Run: `npm test -- --run`

Expected: all tests pass; record unrelated pre-existing failures without changing unrelated code.

- [ ] **Step 4: Run Playwright**

Run: `npx playwright test`

Expected: all configured browser tests pass.

- [ ] **Step 5: Verify governed output compatibility**

Run the workspace task `Verify current governed F6 output`.

Expected: `status: accepted` for the existing artifact, proving schema, file set, hashes, decisions, and disposition remain compatible.

- [ ] **Step 6: Inspect the final diff**

Confirm no runner, calculation, schema, artifact identity, manifest, hash, ADO write, or confirmation behavior changed. Confirm unrelated user modifications remain intact.

