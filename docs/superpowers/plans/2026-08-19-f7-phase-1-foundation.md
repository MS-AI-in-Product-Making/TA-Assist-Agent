# F7 Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local F7.0/F7.1 workbench foundation for safe workbook selection, explicit factor direction, per-factor measured/baseline mode, measurement paste, validation, and provenance without implementing capability, distribution fit, Monte Carlo, or recommendations.

**Architecture:** Add strict Phase 1 contracts, an Excel-neutral factor model with an interim OOXML adapter, pure measurement parsing/validation services, a loopback-only in-memory session API, and a Vue workbench. Existing `cpk-request-v1`/`cpk-result-v1` placeholder contracts and F7 governance registration remain unchanged, so F7 stays `unavailable`.

**Tech Stack:** TypeScript, Zod, existing secure OOXML reader, Node HTTP, Vue 3, Vite, Vitest, Vue Test Utils, jsdom, ESLint, SHA-256.

**Approved design:** `docs/superpowers/specs/2026-08-19-f7-real-measurement-monte-carlo-ta-design.md`

---

## Delivery Boundary

Phase 1 ends with a usable local workflow:

1. Import workbook bytes.
2. Confirm one TA worksheet against its workbook hash.
3. Review extracted factors and explicitly confirm loop coefficients.
4. Select `MEASURED` or `BASELINE_ASSUMPTION` for every factor.
5. Paste measured values with optional sequence, timestamp, subgroup, and batch metadata.
6. Validate dataset shape, sample count, unit, specifications, and provenance.
7. Display readiness without calculating Cp/Cpk, fitting a distribution, or starting a simulation.

The following routes and UI actions must not exist in Phase 1: capability, fit, Monte Carlo, recommendation, knowledge-base write, workbook write-back, ADO publish, and remote persistence.

## File Structure

### Create

- `packages/contracts/src/f7-contracts.ts`: strict F7 Phase 1 schemas and inferred types.
- `packages/contracts/src/f7-contracts.test.ts`: schema and invariant tests.
- `packages/workbook-catalog/src/f7-factor-normalization.ts`: signed Excel contribution to physical-coordinate conversion.
- `packages/workbook-catalog/src/f7-factor-normalization.test.ts`: coefficient and double-sign regression tests.
- `packages/workbook-catalog/src/f7-excel-adapter.ts`: selected worksheet to F7 factor evidence adapter.
- `packages/workbook-catalog/src/f7-excel-adapter.test.ts`: anonymous OOXML extraction tests.
- `packages/workbook-catalog/src/f7-measurement-parser.ts`: deterministic paste parser.
- `packages/workbook-catalog/src/f7-measurement-parser.test.ts`: parsing and confidential error tests.
- `packages/workbook-catalog/src/f7-dataset-validation.ts`: structure and evidence validation only.
- `packages/workbook-catalog/src/f7-dataset-validation.test.ts`: three measurement structures and readiness tests.
- `scripts/f7-project-wiring.test.mjs`: workspace, script, test-project, and route-boundary checks.
- `apps/f7-local-api/package.json`: local API workspace metadata.
- `apps/f7-local-api/tsconfig.json`: composite Node project.
- `apps/f7-local-api/src/f7-session-service.ts`: in-memory session state machine.
- `apps/f7-local-api/src/f7-session-service.test.ts`: lifecycle and provenance tests.
- `apps/f7-local-api/src/server.ts`: loopback HTTP adapter.
- `apps/f7-local-api/src/main.ts`: local API development entrypoint.
- `apps/f7-local-api/src/server.test.ts`: routing, limits, and leak tests.
- `apps/f7-local-api/src/index.ts`: public API exports.
- `apps/f7-web/package.json`: Vue/Vite workspace metadata.
- `apps/f7-web/tsconfig.json`: Vue typecheck configuration.
- `apps/f7-web/vite.config.ts`: Vite and test configuration.
- `apps/f7-web/index.html`: application host.
- `apps/f7-web/src/main.ts`: Vue bootstrap.
- `apps/f7-web/src/App.vue`: workbench composition.
- `apps/f7-web/src/style.css`: responsive workbench styling.
- `apps/f7-web/src/vite-env.d.ts`: Vite types.
- `apps/f7-web/src/api/f7-client.ts`: typed API boundary.
- `apps/f7-web/src/state/f7-session.ts`: client session state.
- `apps/f7-web/src/components/WorksheetConfirmation.vue`: worksheet gate.
- `apps/f7-web/src/components/FactorInputTable.vue`: factor mode and direction review.
- `apps/f7-web/src/components/MeasurementPastePanel.vue`: paste editor.
- `apps/f7-web/src/components/ValidationSummary.vue`: blocking/advisory results.
- `apps/f7-web/src/App.test.ts`: workbench flow tests.

### Modify

- `package.json`: F7 scripts and Web tooling dependencies.
- `package-lock.json`: locked dependencies.
- `tsconfig.json`: local API project reference.
- `vitest.config.ts`: Node and Vue/jsdom projects without the deprecated workspace file.
- `eslint.config.mjs`: Vue SFC lint support.
- `packages/contracts/src/index.ts`: export F7 contracts.
- `packages/workbook-catalog/src/index.ts`: export F7 Phase 1 services.
- `README.md`: document experimental local F7 workbench and its limits.

### Deliberately unchanged

- `packages/workbook-catalog/src/cpk-placeholder.ts`
- Existing `cpk-request-v1` and `cpk-result-v1` schemas
- `packages/governance/src/feature-register.ts` F7 registration
- F4, F5, and F6 calculation or interpretation implementations

---

### Task 1: Add F7 Workspaces and Tooling

**Files:**
- Create: `apps/f7-local-api/package.json`
- Create: `apps/f7-local-api/tsconfig.json`
- Create: `apps/f7-local-api/src/index.ts`
- Create: `apps/f7-web/package.json`
- Create: `apps/f7-web/tsconfig.json`
- Create: `apps/f7-web/vite.config.ts`
- Create: `apps/f7-web/index.html`
- Create: `apps/f7-web/src/main.ts`
- Create: `apps/f7-web/src/App.vue`
- Create: `scripts/f7-project-wiring.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Create: `vitest.config.ts`
- Delete: `vitest.workspace.ts`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Write the failing project-wiring test**

Create `scripts/f7-project-wiring.test.mjs`. Read root and workspace JSON/config files and assert:

```js
expect(rootPackage.scripts).toMatchObject({
  "dev:f7": expect.stringContaining("concurrently"),
  "dev:f7:api": expect.any(String),
  "dev:f7:web": expect.any(String),
  "build:f7:web": expect.any(String),
});
expect(localApiPackage.name).toBe("@ai-assist/f7-local-api");
expect(webPackage.name).toBe("@ai-assist/f7-web");
expect(rootTsconfig.references).toContainEqual({ path: "./apps/f7-local-api" });
expect(vitestConfigSource).toContain('name: "f7-web"');
expect(vitestConfigSource).toContain('environment: "jsdom"');
expect(existsSync(path.join(root, "vitest.workspace.ts"))).toBe(false);
expect(rootPackage.scripts.test).toBe("npm run build -- --force && vitest run");
expect(rootPackage.scripts.test).not.toContain("--workspace");
```

- [ ] **Step 2: Run the wiring test to verify RED**

```powershell
npx vitest run --testTimeout=15000 scripts/f7-project-wiring.test.mjs
```

Expected: FAIL because the F7 workspace manifests and scripts do not exist.

- [ ] **Step 3: Create workspace manifests and project references**

Create `apps/f7-local-api/package.json`:

```json
{
  "name": "@ai-assist/f7-local-api",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "dev": "tsx watch src/main.ts" },
  "dependencies": {
    "@ai-assist/contracts": "0.1.0",
    "@ai-assist/workbook-catalog": "0.1.0"
  }
}
```

Create `apps/f7-local-api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": true, "rootDir": "src", "outDir": "dist" },
  "references": [
    { "path": "../../packages/contracts" },
    { "path": "../../packages/workbook-catalog" }
  ],
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

Create `apps/f7-web/package.json`:

```json
{
  "name": "@ai-assist/f7-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build"
  },
  "dependencies": { "vue": "^3.5.0" },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^26.0.0",
    "vite": "^7.0.0",
    "vue-tsc": "^3.0.0"
  }
}
```

Create `apps/f7-web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

Create `apps/f7-web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5177,
    strictPort: true,
    proxy: { "/f7": "http://127.0.0.1:4317" },
  },
});
```

Create `apps/f7-web/index.html` with `<div id="app"></div>` and a module script for `/src/main.ts`.

Create the minimal `apps/f7-web/src/main.ts`:

```ts
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

Create the buildable Task 1 stub `apps/f7-web/src/App.vue`:

```vue
<template><main><h1>F7 Measurement Workbench</h1></main></template>
```

Create `apps/f7-local-api/src/index.ts` as a temporary build stub:

```ts
export {};
```

Add `{ "path": "./apps/f7-local-api" }` to root `tsconfig.json`. Do not add the Vue app to TypeScript project references; `vue-tsc` owns its build.

- [ ] **Step 4: Install and lock Web lint dependencies**

Run:

```powershell
npm install
npm install --save-dev eslint-plugin-vue@^10.0.0 vue-eslint-parser@^10.0.0 concurrently@^9.0.0 tsx@^4.0.0
```

Expected: `package-lock.json` records the two new workspaces and Vue tooling without peer dependency errors.

- [ ] **Step 5: Migrate to Vitest projects and add Vue linting**

Delete `vitest.workspace.ts`. Create `vitest.config.ts`:

```ts
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["apps/**/*.test.ts", "scripts/**/*.test.mjs", "packages/**/*.test.ts"],
          exclude: ["apps/f7-web/**/*.test.ts", "scripts/f4-excel-regression.test.mjs"],
        },
      },
      {
        plugins: [vue()],
        test: {
          name: "f7-web",
          include: ["apps/f7-web/**/*.test.ts"],
          environment: "jsdom",
        },
      },
    ],
  },
});
```

Update the root test script to remove `--workspace`:

```json
"test": "npm run build -- --force && vitest run"
```

Add imports for `eslint-plugin-vue` and `vue-eslint-parser`, spread `pluginVue.configs["flat/recommended"]`, and add this Vue override to `eslint.config.mjs`:

```js
{
  files: ["**/*.vue"],
  languageOptions: {
    parser: vueParser,
    parserOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
}
```

Add root scripts:

```json
"dev:f7": "concurrently --kill-others-on-fail --names api,web \"npm run dev:f7:api\" \"npm run dev:f7:web\"",
"dev:f7:api": "npm run dev --workspace @ai-assist/f7-local-api",
"dev:f7:web": "npm run dev --workspace @ai-assist/f7-web",
"build:f7:web": "npm run build --workspace @ai-assist/f7-web"
```

- [ ] **Step 6: Verify project wiring and GREEN**

Run:

```powershell
npm run build -- --force
npm run build:f7:web
npm run lint
npx vitest run --testTimeout=15000 scripts/f7-project-wiring.test.mjs
npm test
```

Expected: all commands exit `0`; the Web build contains only the empty host until Task 9.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json tsconfig.json vitest.config.ts vitest.workspace.ts eslint.config.mjs apps/f7-local-api apps/f7-web scripts/f7-project-wiring.test.mjs
git commit -m "build(f7): add local workbench projects"
```

---

### Task 2: Define Strict Phase 1 Contracts

**Files:**
- Create: `packages/contracts/src/f7-contracts.ts`
- Create: `packages/contracts/src/f7-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write failing contract tests**

Cover these exact invariants:

```ts
expect(f7FactorEvidenceSchema.parse(factor).signedContributionMean)
  .toBe(factor.loopCoefficient * factor.physicalMean);
expect(() => f7FactorEvidenceSchema.parse({ ...factor, loopCoefficient: 0 })).toThrow();
expect(() => f7FactorEvidenceSchema.parse({ ...factor, unknown: true })).toThrow();
expect(f7FactorInputSchema.parse({ mode: "MEASURED" })).toEqual({ mode: "MEASURED" });
expect(f7FactorInputSchema.parse({ mode: "BASELINE_ASSUMPTION", baselineSampler: normalSampler }))
  .toMatchObject({ mode: "BASELINE_ASSUMPTION" });
expect(f7MeasurementDatasetSchema.parse(orderedDataset).structure).toBe("ORDERED_INDIVIDUALS");
expect(() => f7MeasurementDatasetSchema.parse({ ...orderedDataset, contentHash: "A".repeat(64) })).toThrow();
```

Also assert `cpkRequestSchema` and `cpkResultSchema` still accept only the existing placeholder shapes.

Assert every HTTP wrapper rejects unknown outer fields, and worksheet confirmation also rejects unknown nested fields:

```ts
expect(() => f7WorksheetConfirmRouteRequestSchema.parse({
  sessionId: "session-1",
  confirmation: { workbookContentHash: HASH, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
  unknown: true,
})).toThrow();
expect(() => f7WorksheetConfirmRouteRequestSchema.parse({
  sessionId: "session-1",
  confirmation: {
    workbookContentHash: HASH,
    selectedWorksheetNames: ["Anonymous_TA"],
    confirmed: true,
    unknown: true,
  },
})).toThrow();
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npx vitest run --testTimeout=15000 packages/contracts/src/f7-contracts.test.ts
```

Expected: FAIL because `f7-contracts.js` does not exist.

- [ ] **Step 3: Implement contracts**

Define and export:

```ts
export const f7LoopCoefficientSchema = z.union([z.literal(-1), z.literal(1)]);
export const f7FactorSourceModeSchema = z.enum(["MEASURED", "BASELINE_ASSUMPTION"]);
export const f7MeasurementStructureSchema = z.enum([
  "RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE",
]);
export const f7BaselineSamplerSchema = z.discriminatedUnion("samplerId", [
  z.object({
    samplerId: z.literal("NORMAL_LOCATION_SCALE_V1"),
    physicalMean: z.number().finite(),
    standardDeviation: z.number().finite().positive(),
    support: z.literal("REAL"),
  }).strict(),
]);
```

`f7FactorCandidateSchema` contains workbook hash, worksheet, table ID, source row/cells, candidate ID, optional workbook unit evidence, Excel signed mean, standard deviation, distribution, and two-sided specifications. `f7FactorSetupConfirmationSchema` requires candidate ID, coefficient, non-empty unit, and `confirmed: true`; unit must be supplied by the user when workbook evidence is absent.

`f7FactorEvidenceSchema` must contain workbook hash, worksheet, table ID, source row/cells, factor ID, unit plus `unitSource: workbook | user_confirmed`, coefficient, physical mean, signed contribution mean, baseline sampler, and two-sided specifications. Add `.superRefine()` to require:

```ts
Math.abs(value.signedContributionMean - value.loopCoefficient * value.physicalMean) <= 1e-12
value.lowerSpecLimit < value.upperSpecLimit
```

`f7FactorInputSchema` is a discriminated union. `MEASURED` permits an optional dataset so mode selection can precede paste; readiness is derived separately. `BASELINE_ASSUMPTION` requires a baseline sampler.

`f7MeasurementObservationSchema` contains a finite value, original row number, `included | excluded` disposition, and optional non-empty sequence, ISO timestamp, subgroup, and batch fields. `f7MeasurementDatasetSchema` contains factor ID, unit, structure, source reference, `importedAt`, MSA status `available | not_available | unknown`, observations, missing row count, rejection summaries, original row count, user dispositions, analyzed count, and lowercase SHA-256 content hash. Require all counts to reconcile. Excluded observations require a non-empty reason, confirmation flag, and controlled operator reference; changing a disposition changes the content hash.

Define and export `F7MeasurementPasteResult`, `F7DatasetValidationResult`, `F7FactorCandidate`, `F7SessionSnapshot`, and `F7SessionService` so Tasks 4–9 consume types introduced here rather than creating local variants. Lock the service interface here:

```ts
export interface F7SessionService {
  importWorkbook(request: F7WorkbookImportRequest): F7SessionSnapshot;
  confirmWorksheet(request: { sessionId: string; confirmation: WorksheetSelectionConfirmation }): F7SessionSnapshot;
  confirmFactorSetup(request: { sessionId: string; confirmations: readonly F7FactorSetupConfirmation[] }): F7SessionSnapshot;
  setFactorMode(request: { sessionId: string; factorId: string; mode: F7FactorSourceMode }): F7SessionSnapshot;
  pasteMeasurements(request: F7MeasurementPasteRequest & { sessionId: string }): F7SessionSnapshot;
  applyMeasurementDisposition(request: F7MeasurementDispositionRequest & { sessionId: string }): F7SessionSnapshot;
  getSession(sessionId: string): F7SessionSnapshot;
}
```

Define seven strict API boundary schemas. Nested objects reuse strict domain schemas rather than widening them:

```ts
export const f7WorkbookImportRouteRequestSchema = z.object({
  fileName: z.string().min(1),
  workbookBase64: z.string().min(1).max(22_369_624),
}).strict();
export const f7WorksheetConfirmRouteRequestSchema = z.object({
  sessionId: z.string().min(1),
  confirmation: worksheetSelectionConfirmationSchema,
}).strict();
export const f7FactorConfirmRouteRequestSchema = z.object({
  sessionId: z.string().min(1),
  confirmations: z.array(f7FactorSetupConfirmationSchema).min(1),
}).strict();
export const f7FactorModeRouteRequestSchema = z.object({
  params: z.object({ factorId: z.string().min(1) }).strict(),
  body: z.object({
    sessionId: z.string().min(1),
    mode: f7FactorSourceModeSchema,
  }).strict(),
}).strict();
export const f7MeasurementPasteRouteRequestSchema = z.object({
  params: z.object({ factorId: z.string().min(1) }).strict(),
  body: z.object({
    sessionId: z.string().min(1),
    structure: f7MeasurementStructureSchema,
    sourceReference: z.string().min(1),
    msaStatus: z.enum(["available", "not_available", "unknown"]),
    text: z.string().min(1).max(1_048_576),
  }).strict(),
}).strict();
export const f7MeasurementDispositionRouteRequestSchema = z.object({
  params: z.object({ factorId: z.string().min(1) }).strict(),
  body: z.object({
    sessionId: z.string().min(1),
    rowNumbers: z.array(z.number().int().positive()).min(1),
    action: z.enum(["EXCLUDE", "RESTORE"]),
    reason: z.string().min(1),
    operatorReference: z.string().min(1),
    confirmed: z.literal(true),
  }).strict(),
}).strict();
export const f7SessionRouteParamsSchema = z.object({ sessionId: z.string().min(1) }).strict();
```

`f7AnalysisRequestSchema` and `f7AnalysisResultSchema` use contract IDs `f7-analysis-request-v1` and `f7-analysis-result-v1`, classification `confidential`, and Phase 1 status `worksheet_selection | factor_setup | measurement_entry | phase_1_ready`. They must not expose capability, fit, simulation, or recommendation fields.

- [ ] **Step 4: Export and verify GREEN**

Add `export * from "./f7-contracts.js";` to `packages/contracts/src/index.ts`.

Run:

```powershell
npx vitest run --testTimeout=15000 packages/contracts/src/f7-contracts.test.ts packages/contracts/src/contracts.test.ts
npm exec -- tsc -b packages/contracts --force
```

Expected: PASS; old Cpk contract tests remain unchanged.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/f7-contracts.ts packages/contracts/src/f7-contracts.test.ts packages/contracts/src/index.ts
git commit -m "feat(f7): define phase one contracts"
```

---

### Task 3: Normalize Factor Direction Exactly Once

**Files:**
- Create: `packages/workbook-catalog/src/f7-factor-normalization.ts`
- Create: `packages/workbook-catalog/src/f7-factor-normalization.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write the double-sign regression test**

```ts
expect(normalizeF7Factor({ excelSignedMean: -0.57, loopCoefficient: -1, standardDeviation: 0.0125 }))
  .toMatchObject({ physicalMean: 0.57, signedContributionMean: -0.57 });
expect(normalizeF7Factor({ excelSignedMean: 0.22, loopCoefficient: 1, standardDeviation: 0.0125 }))
  .toMatchObject({ physicalMean: 0.22, signedContributionMean: 0.22 });
expect(() => normalizeF7Factor({ excelSignedMean: 0.57, loopCoefficient: -1, standardDeviation: 0.0125 }))
  .toThrow("F7 factor direction is inconsistent with the Excel contribution mean.");
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --testTimeout=15000 packages/workbook-catalog/src/f7-factor-normalization.test.ts
```

Expected: FAIL because `f7-factor-normalization.js` does not exist.

- [ ] **Step 3: Implement the pure normalizer**

```ts
export function normalizeF7Factor(input: {
  readonly excelSignedMean: number;
  readonly loopCoefficient: -1 | 1;
  readonly standardDeviation: number;
}): { readonly physicalMean: number; readonly signedContributionMean: number } {
  if (!Number.isFinite(input.excelSignedMean) || !Number.isFinite(input.standardDeviation) || input.standardDeviation <= 0) {
    throw factorError("F7 factor numeric evidence is invalid.");
  }
  const physicalMean = input.loopCoefficient * input.excelSignedMean;
  if (physicalMean < 0) throw factorError("F7 factor direction is inconsistent with the Excel contribution mean.");
  return Object.freeze({ physicalMean, signedContributionMean: input.loopCoefficient * physicalMean });
}
```

Use `createTypedError`; do not include the numeric input in error text.

- [ ] **Step 4: Verify GREEN and export**

Add the export to `packages/workbook-catalog/src/index.ts`, then run:

```powershell
npx vitest run --testTimeout=15000 packages/workbook-catalog/src/f7-factor-normalization.test.ts
npm exec -- tsc -b packages/workbook-catalog --force
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f7-factor-normalization* packages/workbook-catalog/src/index.ts
git commit -m "feat(f7): normalize factor loop direction"
```

---

### Task 4: Build the Interim Excel Adapter

**Files:**
- Create: `packages/workbook-catalog/src/f7-excel-adapter.ts`
- Create: `packages/workbook-catalog/src/f7-excel-adapter.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Build an anonymous seven-factor golden workbook test**

Use `createAnonymousWorkbookZip` from `test-support.ts` to create Title Page, Auto Summary, and `Anonymous_TA` XML parts. Do not commit the user's workbook. The anonymous fixture reproduces only the approved non-confidential structure and values:

| Row | Factor | Excel signed mean | One sigma | Confirmed coefficient | Physical mean | Mean cell | Sigma cell |
|---:|---|---:|---:|---:|---:|---|---|
| 14 | Fabric thickness | -0.57 | 0.0125 | -1 | 0.57 | R14 | T14 |
| 15 | C-cover height | -1.94 | 0.025 | -1 | 1.94 | R15 | T15 |
| 16 | Shim thickness | 0.22 | 0.0125 | 1 | 0.22 | R16 | T16 |
| 17 | Switch height | 0.75 | 0.025 | 1 | 0.75 | R17 | T17 |
| 18 | TP PCB thickness | 0.44 | 0.0125 | 1 | 0.44 | R18 | T18 |
| 19 | HAF thickness | 0.05 | 0.0125 | 1 | 0.05 | R19 | T19 |
| 20 | Glass thickness | 1.00 | 0.0125 | 1 | 1.00 | R20 | T20 |

Use LSL `-0.15` from `P54`, USL `0.05` from `P55`, and the row-13 headers `Factor Description (TA Loop)`, `Design Nominal`, `+ Tolerance`, `- Tolerance`, `Long Term/Safety Factor`, `Sigma level`, `Distribution`, `Mean`, `Tolerance`, and `1 Sigma`.

Assert the two-stage flow:

```ts
const imported = createF7WorkbookImport({
  contractVersion: "v1",
  inputClassification: "confidential",
  fileName: "anonymous.xlsx",
  workbookBytes,
});
expect(imported.prompt.options.map(({ worksheetName }) => worksheetName)).toEqual(["Anonymous_TA"]);

const extracted = extractF7FactorCandidates({
  workbookBytes,
  importResult: imported,
  confirmation: {
    workbookContentHash: imported.workbook.contentHash,
    selectedWorksheetNames: ["Anonymous_TA"],
    confirmed: true,
  },
});
expect(extracted.candidates.map(({ factorName, excelSignedMean, standardDeviation }) =>
  [factorName, excelSignedMean, standardDeviation])).toEqual([
    ["Fabric thickness", -0.57, 0.0125],
    ["C-cover height", -1.94, 0.025],
    ["Shim thickness", 0.22, 0.0125],
    ["Switch height", 0.75, 0.025],
    ["TP PCB thickness", 0.44, 0.0125],
    ["HAF thickness", 0.05, 0.0125],
    ["Glass thickness", 1, 0.0125],
  ]);

const result = confirmF7FactorSetup({
  extractionResult: extracted,
  confirmations: extracted.candidates.map((candidate, index) => ({
    factorCandidateId: candidate.factorCandidateId,
    loopCoefficient: index < 2 ? -1 : 1,
    unit: "mm",
    confirmed: true,
  })),
});
expect(result.factors.reduce((sum, factor) => sum + factor.signedContributionMean, 0))
  .toBeCloseTo(-0.05, 12);
expect(result.factors.every(({ lowerSpecLimit, upperSpecLimit }) =>
  lowerSpecLimit === -0.15 && upperSpecLimit === 0.05)).toBe(true);
```

Assert exact factor IDs and source cells so row movement changes the golden result. Assert all seven units are `mm` with `unitSource: "user_confirmed"`. Add cases for stale hash, invalid worksheet DTO, missing factor confirmation, missing unit confirmation, duplicate confirmation, coefficient mismatch, missing two-sided specification, ambiguous factor header, archive budget rejection, and errors that do not serialize workbook cell values.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --testTimeout=15000 packages/workbook-catalog/src/f7-excel-adapter.test.ts
```

Expected: FAIL because `f7-excel-adapter.js` does not exist.

- [ ] **Step 3: Implement import and confirmation boundaries**

`createF7WorkbookImport` must call `readSafeZip(bytes)` before parsing, then use `createWorkbookCatalog` and `createWorksheetSelectionPrompt`. It returns only workbook identity and prompt; it does not expose raw bytes.

`extractF7FactorCandidates` must:

1. Recompute SHA-256 from `workbookBytes` and require it to match `importResult.workbook.contentHash`.
2. Call `validateWorksheetSelectionConfirmation` and require exactly one selected worksheet.
3. Call `readOoxmlWorkbook(workbookBytes, [worksheetName], false, { maxRow: 1000, maxColumn: "BN" })`.
4. Locate one factor header cluster with `resolveFactorHeaderCluster`.
5. Read consecutive factor rows until the factor-name column is empty.
6. Require Normal baseline in Phase 1 and reject other distributions with `baseline_sampler_not_defined`.
7. Build `factorCandidateId` as SHA-256 of length-prefixed workbook hash, worksheet, table ID, and row.
8. Return candidate evidence with Excel signed mean, sigma, specifications, optional unit evidence, and source cells but no confirmed coefficient, physical mean, or invented default unit.

`confirmF7FactorSetup` must require exactly one explicit confirmation for every candidate, reject unknown/duplicate candidate IDs, require a user-confirmed unit when workbook unit evidence is absent, call `normalizeF7Factor`, derive the final factor ID from candidate ID plus confirmed coefficient and normalized unit, and validate each result with `f7FactorEvidenceSchema`.

Keep cell lookup helpers local and return source cell references, never formulas containing workbook values.

- [ ] **Step 4: Verify GREEN and security regressions**

Run:

```powershell
npx vitest run --testTimeout=15000 `
  packages/workbook-catalog/src/f7-excel-adapter.test.ts `
  packages/workbook-catalog/src/worksheet-selection.test.ts `
  packages/workbook-catalog/src/factor-header-resolver.test.ts `
  packages/workbook-catalog/src/zip-security.test.ts `
  packages/workbook-catalog/src/ooxml-reader.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f7-excel-adapter* packages/workbook-catalog/src/index.ts
git commit -m "feat(f7): extract confirmed workbook factors"
```

---

### Task 5: Parse Measurement Paste Deterministically

**Files:**
- Create: `packages/workbook-catalog/src/f7-measurement-parser.ts`
- Create: `packages/workbook-catalog/src/f7-measurement-parser.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write parser tests**

Lock these formats:

```text
value
0.571
0.569
```

```text
value<TAB>sequence<TAB>timestamp<TAB>subgroup<TAB>batch
0.571<TAB>1<TAB>2026-08-19T08:00:00.000Z<TAB>A<TAB>lot-1
```

Assert comma, tab, semicolon, CRLF, and one-value-per-line parsing; explicit headers; stable row numbers; separate missing and rejected row counts; non-finite rejection reason; source reference; injected import timestamp; MSA status; a 1 MiB UTF-8 byte limit; and error JSON that does not contain pasted values.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --testTimeout=15000 packages/workbook-catalog/src/f7-measurement-parser.test.ts
```

Expected: FAIL because `f7-measurement-parser.js` does not exist.

- [ ] **Step 3: Implement parser**

Export:

```ts
export function parseF7MeasurementPaste(request: {
  readonly factorId: string;
  readonly unit: string;
  readonly structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
  readonly sourceReference: string;
  readonly importedAt: string;
  readonly msaStatus: "available" | "not_available" | "unknown";
  readonly text: string;
}): F7MeasurementPasteResult;
```

Rules:

- Normalize CRLF to LF and remove one UTF-8 BOM.
- Detect delimiter from the header only; reject mixed delimiters.
- For a single-column payload without a header, treat every non-empty row as `value`.
- Parse numbers with JavaScript invariant decimal syntax; reject locale commas as numeric separators.
- Preserve sequence/timestamp/subgroup/batch strings after trimming.
- Hash canonical metadata, accepted rows, missing counts, rejection reason codes, and dispositions using SHA-256 over field presence and length-prefixed UTF-8 values.
- Return accepted observations, missing row count, and row-scoped rejection reason codes, but never echo rejected raw text.

- [ ] **Step 4: Verify GREEN and export**

Add the export, then run:

```powershell
npx vitest run --testTimeout=15000 packages/workbook-catalog/src/f7-measurement-parser.test.ts
npm exec -- tsc -b packages/workbook-catalog --force
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f7-measurement-parser* packages/workbook-catalog/src/index.ts
git commit -m "feat(f7): parse measurement paste data"
```

---

### Task 6: Validate Measurement Dataset Readiness

**Files:**
- Create: `packages/workbook-catalog/src/f7-dataset-validation.ts`
- Create: `packages/workbook-catalog/src/f7-dataset-validation.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write validation matrix tests**

Test exact outcomes:

| Structure | Evidence | Outcome |
|---|---|---|
| Rational subgroup | subgroup IDs, at least 2 observations each | valid structure |
| Rational subgroup | any subgroup has 1 observation | blocking `subgroup_too_small` |
| Ordered individuals | unique contiguous numeric sequence | valid structure |
| Ordered individuals | missing/duplicate sequence | blocking `ordered_sequence_invalid` |
| Unordered sample | no ordering metadata | valid structure |
| Any | fewer than 20 accepted observations | blocking `sample_count_below_minimum` |
| Any | 20–29 accepted observations | advisory `exploratory_only` |
| Any | 30–49 accepted observations | advisory `fit_uncertainty` |
| Any | unit mismatch | blocking `unit_mismatch` |
| Any | missing LSL/USL association | blocking `specification_missing` |
| Any | any `non_finite_value` rejection | blocking `non_finite_measurement` |
| Any | duplicate accepted value | advisory `duplicate_measurement` |
| Any | MSA unknown/not available | advisory `msa_evidence_missing` |
| Any | more than one non-empty batch | advisory `mixed_batch_conditions` |
| Any | Tukey outer-fence candidate | advisory `outlier_candidate` |

Assert support diagnostics are advisory/candidate-scoped, not dataset blocking. Add disposition tests: exclusion without reason/operator/confirmation is rejected; confirmed exclusion changes analyzed count and hash; restoring the row changes the hash again; original observations remain present and immutable.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --testTimeout=15000 packages/workbook-catalog/src/f7-dataset-validation.test.ts
```

Expected: FAIL because `f7-dataset-validation.js` does not exist.

- [ ] **Step 3: Implement pure validation**

Export `validateF7MeasurementDataset({ factor, dataset })` and `applyF7MeasurementDisposition({ dataset, rowNumbers, action, reason, operatorReference, confirmed })`. Validation returns:

```ts
{
  status: blockingIssues.length === 0 ? "ready" : "blocked",
  blockingIssues,
  advisoryIssues,
  candidateEligibility: {
    normal: "eligible",
    lognormal: allPositive ? "eligible" : "ineligible_nonpositive",
    weibull: allPositive ? "eligible" : "ineligible_nonpositive",
    gamma: allPositive ? "eligible" : "ineligible_nonpositive",
    uniform: "eligible_with_boundary_warning"
  }
}
```

Issue objects contain reason code, factor ID, and row numbers only. They must not contain raw measured values.

Use deterministic Tukey outer fences: sort included values, calculate Q1/Q3 by linear interpolation at index `(n - 1) × p`, and flag values below `Q1 - 3 × IQR` or above `Q3 + 3 × IQR`. If `IQR === 0`, emit no outlier candidates. Outliers remain included unless the user applies a confirmed disposition. `applyF7MeasurementDisposition` preserves original values and rows, changes only inclusion metadata, recomputes counts/hash, and returns a frozen dataset.

- [ ] **Step 4: Verify GREEN and export**

Add the export, then run:

```powershell
npx vitest run --testTimeout=15000 `
  packages/workbook-catalog/src/f7-dataset-validation.test.ts `
  packages/workbook-catalog/src/f7-measurement-parser.test.ts `
  packages/contracts/src/f7-contracts.test.ts
npm exec -- tsc -b packages/workbook-catalog --force
```

Expected: all tests and the build PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f7-dataset-validation* packages/workbook-catalog/src/index.ts
git commit -m "feat(f7): validate measurement readiness"
```

---

### Task 7: Implement the In-Memory Session State Machine

**Files:**
- Create: `apps/f7-local-api/src/f7-session-service.ts`
- Create: `apps/f7-local-api/src/f7-session-service.test.ts`
- Modify: `apps/f7-local-api/src/index.ts`

- [ ] **Step 1: Write lifecycle tests**

Assert transitions:

```text
empty -> worksheet_selection -> factor_setup -> measurement_entry -> phase_1_ready
```

Test stale workbook hash, worksheet confirmation producing unconfirmed factor candidates, factor setup requiring one coefficient and unit confirmation per candidate, unknown/duplicate candidate IDs, unknown factor, mode switch removing obsolete measurement state, measured mode without a dataset remaining in `measurement_entry`, baseline sampler readiness, measured mode requiring a ready dataset for `phase_1_ready`, disposition application, immutable response snapshots, injected timestamps, and no raw workbook bytes in `getSession()`.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --testTimeout=15000 apps/f7-local-api/src/f7-session-service.test.ts
```

Expected: FAIL because `f7-session-service.js` does not exist.

- [ ] **Step 3: Implement session service**

Export a factory with injected ID generator:

```ts
export function createF7SessionService(dependencies: {
  readonly createId: () => string;
  readonly now: () => string;
}): F7SessionService {
  const sessions = new Map<string, InternalSession>();
  return Object.freeze({
    importWorkbook,
    confirmWorksheet,
    confirmFactorSetup,
    setFactorMode,
    pasteMeasurements,
    applyMeasurementDisposition,
    getSession,
  });
}
```

Store workbook bytes only in private `InternalSession`; public snapshots expose hashes and provenance. `confirmWorksheet` calls `extractF7FactorCandidates` and moves to `factor_setup` without assigning coefficients. `confirmFactorSetup` calls the adapter's explicit confirmation boundary and then exposes normalized factors. Every mutation revalidates the complete snapshot with F7 contracts. `setFactorMode(BASELINE_ASSUMPTION)` deletes measurement observations and validation for that factor. `setFactorMode(MEASURED)` is valid without a dataset and remains `measurement_entry`. `pasteMeasurements` uses injected `now()` and is allowed only in `MEASURED` mode. `applyMeasurementDisposition` calls the pure disposition function and revalidates readiness.

- [ ] **Step 4: Verify GREEN and typecheck**

```powershell
npx vitest run --testTimeout=15000 apps/f7-local-api/src/f7-session-service.test.ts
npm exec -- tsc -b apps/f7-local-api --force
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-local-api/src/f7-session-service* apps/f7-local-api/src/index.ts
git commit -m "feat(f7): add local analysis session state"
```

---

### Task 8: Expose a Loopback-Only HTTP API

**Files:**
- Create: `apps/f7-local-api/src/server.ts`
- Create: `apps/f7-local-api/src/main.ts`
- Create: `apps/f7-local-api/src/server.test.ts`
- Modify: `apps/f7-local-api/src/index.ts`

- [ ] **Step 1: Write HTTP security and routing tests**

Start the server on `127.0.0.1` with port `0`. Assert:

- Address family is loopback.
- `POST /f7/workbook/import` accepts JSON `{ fileName, workbookBase64 }` up to 16 MiB decoded.
- `POST /f7/workbook/worksheet-confirm` returns unconfirmed factor candidates.
- `POST /f7/factors/confirm` accepts explicit coefficient confirmations.
- `POST /f7/factors/:factorId/mode` changes source mode.
- `POST /f7/factors/:factorId/measurements/paste` parses and validates measurements.
- `POST /f7/factors/:factorId/measurements/disposition` confirms exclusion/restoration.
- `GET /f7/session/:sessionId` returns the controlled snapshot.
- Unknown routes return 404.
- Bodies above route limits return 413.
- Invalid JSON returns a fixed 400 response.
- Unknown fields at the outer route DTO or nested confirmation level return the same fixed 400 response.
- A factor route whose JSON body includes `factorId` returns 400; only the decoded URL parameter supplies factor identity.
- CORS is absent by default.
- Responses and captured logs do not contain workbook base64 or measured values.
- `/capability`, `/fit`, `/monte-carlo`, and `/recommendation` return 404.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --testTimeout=15000 apps/f7-local-api/src/server.test.ts
```

Expected: FAIL because `server.js` does not exist.

- [ ] **Step 3: Implement server factory**

```ts
export function createF7LocalServer(options: {
  readonly service: F7SessionService;
  readonly onEvent?: (event: { readonly kind: string; readonly status: number }) => void;
}): Server {
  return createServer(async (request, response) => {
    // Parse method/path, apply byte limits, validate route DTO, call service,
    // and serialize only controlled snapshots or typed error envelopes.
  });
}

export function listenF7LocalServer(server: Server, port = 4317): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server.address() as AddressInfo));
  });
}
```

Each route must parse its body and path parameters together with the exact strict route schema from Task 2 before calling the service. Factor IDs come only from decoded URL params; the three factor-route bodies must reject a body-level `factorId` as an unknown field. Do not accept host from request or environment in Phase 1. Log only route kind and status.

Create `main.ts` as the only process entrypoint:

```ts
import { randomUUID } from "node:crypto";
import { createF7SessionService } from "./f7-session-service.js";
import { createF7LocalServer, listenF7LocalServer } from "./server.js";

const service = createF7SessionService({ createId: randomUUID, now: () => new Date().toISOString() });
const server = createF7LocalServer({ service });
await listenF7LocalServer(server, 4317);
```

- [ ] **Step 4: Verify GREEN and API build**

```powershell
npx vitest run --testTimeout=15000 `
  apps/f7-local-api/src/server.test.ts `
  apps/f7-local-api/src/f7-session-service.test.ts
npm exec -- tsc -b apps/f7-local-api --force
```

Expected: all tests and the build PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-local-api/src/server* apps/f7-local-api/src/main.ts apps/f7-local-api/src/index.ts
git commit -m "feat(f7): expose loopback setup API"
```

---

### Task 9: Build the Vue Workbench Shell

**Files:**
- Create: `apps/f7-web/src/vite-env.d.ts`
- Modify: `apps/f7-web/src/main.ts`
- Modify: `apps/f7-web/src/App.vue`
- Create: `apps/f7-web/src/style.css`
- Create: `apps/f7-web/src/api/f7-client.ts`
- Create: `apps/f7-web/src/state/f7-session.ts`
- Create: `apps/f7-web/src/components/WorksheetConfirmation.vue`
- Create: `apps/f7-web/src/components/FactorInputTable.vue`
- Create: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Create: `apps/f7-web/src/components/ValidationSummary.vue`
- Create: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Write component flow tests**

Using Vue Test Utils, mock `F7Client` and assert:

1. Initial screen is workbook import, not a landing page.
2. Imported workbook displays worksheet options and requires explicit confirmation.
3. Worksheet confirmation displays candidate signed means/source cells plus coefficient and unit controls before physical means are available.
4. Explicit factor confirmation displays coefficient, confirmed unit, physical mean, source mode, sample count, and readiness.
5. Changing a factor to measured opens paste input.
6. Paste calls the API and renders blocking/advisory issues without raw rejected values.
7. Outlier exclusion requires reason plus confirmation and retains original row count.
8. Phase 1 ready state states that capability and Monte Carlo are not yet executed.
9. No capability/fit/simulation button exists.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx vitest run --testTimeout=15000 apps/f7-web/src/App.test.ts
```

Expected: missing Vue components.

- [ ] **Step 3: Implement typed client and state**

`f7-client.ts` exports typed methods matching the seven exact server routes: import, worksheet confirmation, factor confirmation, mode selection, paste, disposition, and session retrieval. It maps non-2xx responses to a fixed UI error object. `f7-session.ts` owns `session`, `busyAction`, and `error`; use Vue `ref` and expose readonly state plus action functions.

- [ ] **Step 4: Implement the workbench components**

Use a six-step vertical workflow rail with only steps 1 and 2 active. Show factor candidate evidence and coefficient confirmation before source-mode controls. Use native radio controls for measured/baseline mode, a table for factors, a drawer/panel for pasted values, disposition confirmation controls, and a validation summary grouped by blocking and advisory issues. Do not nest cards.

Accessibility requirements:

- Every input has a label.
- Radio groups use `fieldset` and `legend`.
- Validation summary uses `aria-live="polite"`.
- Busy actions set `aria-busy` and disable duplicate submission.
- Factor table remains horizontally scrollable under 800 px without overlapping text.

- [ ] **Step 5: Add responsive visual system**

In `style.css`, define a neutral work-focused palette with distinct status colors, 4–8 px radii, fixed factor-column minimum widths, and responsive grid breakpoints. Do not use purple gradients, dark-mode defaults, marketing hero sections, nested cards, or viewport-scaled font sizes.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
npx vitest run --testTimeout=15000 apps/f7-web/src/App.test.ts
npm run build:f7:web
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/f7-web
git commit -m "feat(f7): add measurement setup workbench"
```

---

### Task 10: Add Phase 1 End-to-End Acceptance and Documentation

**Files:**
- Create: `apps/f7-local-api/src/f7-phase-1-flow.test.ts`
- Create: `scripts/f7-phase-1-docs.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write failing documentation and phase-boundary acceptance**

Create `scripts/f7-phase-1-docs.test.mjs`. Assert README contains the local commands, `experimental`, `ephemeral`, `F7 remains unavailable`, and explicit exclusions for capability, fit, Monte Carlo, recommendation, write-back, and upload. Read `server.ts` and assert it contains factor confirmation and disposition routes but no implementation route for excluded Phase 2–4 capabilities.

Run:

```powershell
npx vitest run --testTimeout=15000 scripts/f7-phase-1-docs.test.mjs
```

Expected: FAIL because the README does not yet document F7 Phase 1.

- [ ] **Step 2: Write the end-to-end API flow test**

Use an anonymous workbook fixture and drive the service through all Phase 1 steps. Include two factors:

- Factor A: `MEASURED`, 32 ordered values.
- Factor B: `BASELINE_ASSUMPTION`.

Build Factor A paste data with an explicit contiguous sequence:

```ts
const orderedPaste = [
  "value\tsequence",
  ...Array.from({ length: 32 }, (_, index) => `${(0.57 + index / 10000).toFixed(4)}\t${index + 1}`),
].join("\n");
```

Paste `orderedPaste` with structure `ORDERED_INDIVIDUALS`, source reference `manual-paste-fixture`, and MSA status `unknown`. Assert worksheet confirmation first returns candidates, explicit coefficient/unit confirmation produces normalized factors, final status is `phase_1_ready`, Factor A accepted count is `32` with sequences exactly `1..32`, Factor B has no measurement dataset, both factors retain workbook/worksheet/source-row provenance, and no capability/fit/simulation fields exist anywhere in serialized output.

- [ ] **Step 3: Run the flow test**

Run:

```powershell
npx vitest run --testTimeout=15000 apps/f7-local-api/src/f7-phase-1-flow.test.ts
```

Expected: PASS using the already TDD-tested service boundaries from Tasks 7–8. If it fails, repair only the integration boundary exposed by the test and rerun.

- [ ] **Step 4: Document the experimental workflow**

Add a README section with exact commands:

```powershell
npm run build -- --force
npm run dev:f7
```

Document that Phase 1 is local-only, F7 governance remains unavailable, data is ephemeral, only Normal Excel baseline sampling metadata is accepted, and no capability, fit, Monte Carlo, recommendation, write-back, or upload occurs.

- [ ] **Step 5: Verify documentation GREEN and run focused acceptance**

```powershell
npm run build -- --force
npx vitest run --testTimeout=15000 `
  scripts/f7-project-wiring.test.mjs `
  scripts/f7-phase-1-docs.test.mjs `
  packages/contracts/src/f7-contracts.test.ts `
  packages/workbook-catalog/src/f7-factor-normalization.test.ts `
  packages/workbook-catalog/src/f7-excel-adapter.test.ts `
  packages/workbook-catalog/src/f7-measurement-parser.test.ts `
  packages/workbook-catalog/src/f7-dataset-validation.test.ts `
  apps/f7-local-api/src/f7-session-service.test.ts `
  apps/f7-local-api/src/server.test.ts `
  apps/f7-local-api/src/f7-phase-1-flow.test.ts `
  apps/f7-web/src/App.test.ts
npm run build:f7:web
npm run lint
```

Expected: all commands exit `0` with no failed tests.

- [ ] **Step 6: Run required regressions**

```powershell
npx vitest run --testTimeout=15000 `
  packages/contracts/src/contracts.test.ts `
  packages/governance/src/policy-gate.test.ts `
  packages/workbook-catalog/src/worksheet-selection.test.ts `
  packages/workbook-catalog/src/factor-header-resolver.test.ts `
  packages/workbook-catalog/src/zip-security.test.ts `
  packages/workbook-catalog/src/ooxml-reader.test.ts `
  packages/workbook-catalog/src/cpk-placeholder.test.ts
```

Expected: PASS; F7 remains `unavailable`, and the old placeholder output remains unchanged.

- [ ] **Step 7: Browser verification**

Start the local API and Vite server. Use Playwright at desktop `1440×900` and mobile `390×844` to verify workbook selection, factor mode switching, paste validation, keyboard focus, no overlap, and no capability/fit/simulation controls. Capture screenshots and verify the page is nonblank.

- [ ] **Step 8: Commit**

```powershell
git add apps/f7-local-api/src/f7-phase-1-flow.test.ts scripts/f7-phase-1-docs.test.mjs README.md
git commit -m "test(f7): verify phase one local workflow"
```

---

## Completion Gate

Phase 1 is complete only when:

- All ten task commits exist.
- Full focused and required regression commands pass from a clean build.
- Browser verification passes at desktop and mobile sizes.
- `git diff origin/main...HEAD -- packages/governance/src/feature-register.ts packages/workbook-catalog/src/cpk-placeholder.ts` shows no Phase 1 changes to F7 availability or placeholder behavior.
- Serialized API and UI state contain no workbook bytes, raw rejected values, capability metrics, fit results, simulation settings/results, or recommendations.
- The branch is reviewed before starting the separate Phase 2 statistical analysis plan.