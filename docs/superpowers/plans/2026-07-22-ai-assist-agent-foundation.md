# AI Assist Agent 工程基座实施计划

> **供 Agentic Worker 使用：**必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行本计划。步骤以 checkbox（`- [ ]`）跟踪。

**目标：**构建本地优先、可审计、契约驱动的 TypeScript Monorepo，为 AI Assist Agent 的 F0-F8 功能提供安全可扩展的工程基座。

**架构：**CLI 通过编排器创建 `run_id`，策略门检查已注册 Skill 的 manifest、输入分类和权限。Skill 只能经由类型化 adapter 访问外部能力。审计与记忆模块将每次运行保存到 Git 忽略的本地运行目录；默认 adapter 拒绝外部访问，测试仅使用显式 mock。未来 Python/Windows Excel Worker 只通过版本化 calculation adapter 接入。

**技术栈：**Node.js 24、npm workspaces、TypeScript、Zod、Vitest、ESLint、Node `crypto` 与 `fs/promises`、PowerShell。

---

## 文件结构

- Create: `package.json`、`tsconfig.base.json`、`vitest.workspace.ts`：npm workspace、严格编译与测试入口。
- Modify: `.gitignore`：排除 Node 依赖、构建产物、runtime、`.env` 与导出包。
- Create: `packages/contracts/`：版本化请求、结果、错误、事件和 calculation 契约。
- Create: `packages/governance/`：数据分类、策略门和 F0-F8 Feature Register。
- Create: `packages/audit/`、`packages/memory/`：JSONL 审计、manifest、哈希、记录、导出和清理。
- Create: `packages/skill-sdk/`、`packages/skills/`、`packages/adapters/`：受控 Skill、匿名 fixture 和 deny/mock/calculation adapter。
- Create: `packages/orchestrator/`、`apps/cli/`：run 生命周期和本地命令入口。
- Create: `fixtures/public/`、`.github/`、`docs/governance/`、`scripts/verify-repository.mjs`：匿名测试、协作规范与本地质量门。

## 任务 1：初始化 Monorepo 与本地安全基线

**文件：**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `apps/cli/package.json`
- Create: `apps/cli/tsconfig.json`
- Modify: `.gitignore`
- Create: `scripts/verify-repository.mjs`
- Test: `scripts/verify-repository.test.mjs`

- [ ] **步骤 1：编写仓库安全检查的失败测试**

```js
import { describe, expect, it } from "vitest";
import { isForbiddenRepositoryPath } from "./verify-repository.mjs";

describe("isForbiddenRepositoryPath", () => {
  it.each([".env", "runtime/projects/a/run.json", "sample.xlsx", "sample.xlsm"])(
    "rejects %s",
    (path) => expect(isForbiddenRepositoryPath(path)).toBe(true),
  );
  it("allows public fixtures", () => {
    expect(isForbiddenRepositoryPath("fixtures/public/smoke-request.json")).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

Run:

```powershell
npm test -- scripts/verify-repository.test.mjs
```

Expected: FAIL，因为 workspace 脚本和 `verify-repository.mjs` 尚未创建。

- [ ] **步骤 3：创建 workspace、严格编译设置和安全检查实现**

Create `package.json`：

```json
{
  "name": "ai-assist-agent",
  "private": true,
  "version": "0.1.0",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "tsc -b",
    "lint": "eslint .",
    "test": "vitest run --workspace vitest.workspace.ts",
    "check:repository": "node scripts/verify-repository.mjs"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "@types/node": "^24.0.0",
    "eslint": "^9.0.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

Append these entries to `.gitignore`：

```gitignore
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
runtime/
exports/
*.runbundle.zip
```

Create `scripts/verify-repository.mjs`：

```js
import { execFileSync } from "node:child_process";

const forbiddenPatterns = [/(^|\/)\.env(?:\..+)?$/, /(^|\/)runtime\//, /(^|\/)exports\//, /\.(xlsx|xlsm)$/i];
export function isForbiddenRepositoryPath(path) {
  return forbiddenPatterns.some((pattern) => pattern.test(path.replaceAll("\\", "/")));
}
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const violations = tracked.filter(isForbiddenRepositoryPath);
if (violations.length > 0) {
  console.error(`Forbidden tracked paths:\n${violations.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Repository classified-path check passed.");
}
```

- [ ] **步骤 4：安装依赖并使测试通过**

```powershell
npm install
npm test -- scripts/verify-repository.test.mjs
npm run check:repository
```

Expected: PASS；输出 `Repository classified-path check passed.`。

- [ ] **步骤 5：提交基础脚手架**

```powershell
git add package.json package-lock.json tsconfig.base.json vitest.workspace.ts apps/cli .gitignore scripts
git commit -m "chore: initialize TypeScript monorepo"
```

## 任务 2：建立版本化契约与统一错误模型

**文件：**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/contracts.ts`
- Create: `packages/contracts/src/errors.ts`
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/contracts.test.ts`

- [ ] **步骤 1：编写契约 schema 的失败测试**

```ts
import { describe, expect, it } from "vitest";
import { runRequestSchema, typedErrorSchema } from "./index.js";

describe("Phase 0 contracts", () => {
  it("accepts a classified run request", () => {
    expect(runRequestSchema.parse({
      contractVersion: "v1", projectId: "demo-project", userId: "demo-user",
      sessionId: "demo-session", inputClassification: "public", retainConfidentialArtifacts: false,
    }).projectId).toBe("demo-project");
  });
  it("rejects an error without run_id", () => {
    expect(() => typedErrorSchema.parse({ code: "policy_denied" })).toThrow();
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

```powershell
npm test -- packages/contracts/src/contracts.test.ts
```

Expected: FAIL，因为 `packages/contracts` 尚未实现。

- [ ] **步骤 3：实现 Zod 契约与稳定错误代码**

Install dependency:

```powershell
npm install --workspace @ai-assist/contracts zod@^3.24.0
```

Create `packages/contracts/src/contracts.ts`：

```ts
import { z } from "zod";

export const contractVersionSchema = z.literal("v1");
export const dataClassificationSchema = z.enum(["public", "internal", "confidential", "secret"]);
export const runRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  projectId: z.string().min(1), userId: z.string().min(1), sessionId: z.string().min(1),
  inputClassification: dataClassificationSchema, retainConfidentialArtifacts: z.boolean(),
});
export const skillResultSchema = z.object({
  contractVersion: contractVersionSchema, skillId: z.string().min(1),
  outputClassification: dataClassificationSchema, evidenceReferences: z.array(z.string()),
  output: z.record(z.string(), z.unknown()),
});
export type DataClassification = z.infer<typeof dataClassificationSchema>;
export type RunRequest = z.infer<typeof runRequestSchema>;
```

Create `packages/contracts/src/errors.ts`：

```ts
import { z } from "zod";

export const errorCodeSchema = z.enum([
  "validation_error", "policy_denied", "feature_not_available", "dependency_error", "transient_error", "internal_error",
]);
export const typedErrorSchema = z.object({
  code: errorCodeSchema, runId: z.string().uuid(), summary: z.string().min(1), retryable: z.boolean(),
  suggestedAction: z.string().min(1), affectedInputReferences: z.array(z.string()),
});
export type TypedError = z.infer<typeof typedErrorSchema>;
```

Export both modules from `packages/contracts/src/index.ts`.

- [ ] **步骤 4：运行契约测试、类型检查和构建**

```powershell
npm test -- packages/contracts/src/contracts.test.ts
npm run build
```

Expected: PASS；TypeScript 无错误。

- [ ] **步骤 5：提交契约层**

```powershell
git add packages/contracts package.json package-lock.json
git commit -m "feat: add versioned run contracts"
```

## 任务 3：实现数据治理、策略门与 Feature Register

**文件：**
- Create: `packages/governance/package.json`
- Create: `packages/governance/src/index.ts`
- Create: `packages/governance/src/policy-gate.ts`
- Create: `packages/governance/src/feature-register.ts`
- Test: `packages/governance/src/policy-gate.test.ts`
- Create: `docs/governance/feature-register.md`
- Create: `docs/governance/data-classification.md`

- [ ] **步骤 1：编写策略门和 Feature 状态的失败测试**

```ts
import { describe, expect, it } from "vitest";
import { evaluatePolicy, getFeatureStatus } from "./index.js";

describe("policy gate", () => {
  it("denies secret persistence", () => {
    expect(evaluatePolicy({ inputClassification: "secret", permission: "persist" }).allowed).toBe(false);
  });
  it("reports F4 as unavailable", () => {
    expect(getFeatureStatus("F4").status).toBe("unavailable");
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

```powershell
npm test -- packages/governance/src/policy-gate.test.ts
```

Expected: FAIL，因为策略门和 Register 尚未创建。

- [ ] **步骤 3：实现策略门和 F0-F8 Register**

`evaluatePolicy` 必须对 `secret + persist`、未声明网络权限和默认 deny adapter 返回
`{ allowed: false, reason: "policy_denied" }`。每个 F0-F8 条目必须包含 `featureId`、
`title`、`status`、`dependsOn`、`inputContractId`、`outputContractId`、
`maximumClassification`、`acceptanceChecks`、`externalPrerequisites` 与 `disableBehavior`。

F4 条目必须为：

```ts
{
  featureId: "F4", title: "方法推荐与 Excel 一致性计算", status: "unavailable",
  dependsOn: ["calculation-worker-v1"], inputContractId: "calculation-request-v1",
  outputContractId: "calculation-result-v1", maximumClassification: "confidential",
  acceptanceChecks: ["approved-template-regression"],
  externalPrerequisites: ["approved-windows-excel-worker"],
  disableBehavior: "return feature_not_available",
}
```

用中文创建两个治理文档，分别说明 F0-F8 条目和四级数据分类的存储、输出、提交和导出限制。

- [ ] **步骤 4：运行治理测试**

```powershell
npm test -- packages/governance/src/policy-gate.test.ts
npm run build
```

Expected: PASS；F0-F8 均可查询，且策略门默认拒绝高风险动作。

- [ ] **步骤 5：提交治理基线**

```powershell
git add packages/governance docs/governance/feature-register.md docs/governance/data-classification.md package.json package-lock.json
git commit -m "feat: add policy gate and feature register"
```

## 任务 4：实现审计事件、manifest 和 run bundle 完整性

**文件：**
- Create: `packages/audit/package.json`
- Create: `packages/audit/src/index.ts`
- Create: `packages/audit/src/hash.ts`
- Create: `packages/audit/src/audit-store.ts`
- Test: `packages/audit/src/audit-store.test.ts`

- [ ] **步骤 1：编写 JSONL 事件和哈希校验的失败测试**

```ts
import { expect, it } from "vitest";
import { createAuditStore } from "./index.js";

it("appends events and verifies manifest hashes", async () => {
  const store = await createAuditStore("./runtime-test/audit-run");
  await store.append({ type: "run_created", classification: "public", payload: { key: "value" } });
  await store.writeManifest({ runId: "00000000-0000-4000-8000-000000000001", artifacts: [] });
  await expect(store.verify()).resolves.toEqual({ valid: true, failures: [] });
});
```

- [ ] **步骤 2：运行测试并确认失败**

```powershell
npm test -- packages/audit/src/audit-store.test.ts
```

Expected: FAIL，因为 audit store 尚未实现。

- [ ] **步骤 3：实现追加式审计和 SHA-256 manifest**

`hash.ts` 使用 `createHash("sha256")` 对 UTF-8 内容生成十六进制哈希。`append`
每次写入一行 JSONL，至少包含 `eventId`、`timestamp`、`type`、`classification` 和
`payloadHash`。`writeManifest` 保存 schema、Skill、配置、输入和输出哈希及工件引用，
不得保存原始机密输入。`verify` 必须对 manifest 引用的工件逐项重新计算哈希。

事件类型固定为：`run_created`、`policy_evaluated`、`skill_started`、`skill_completed`、
`skill_failed`、`export_created`、`purge_planned` 和 `purge_completed`。

- [ ] **步骤 4：运行审计模块测试**

```powershell
npm test -- packages/audit/src/audit-store.test.ts
```

Expected: PASS；篡改 manifest 所引用的文件后，`verify` 返回 `{ valid: false }`。

- [ ] **步骤 5：提交审计模块**

```powershell
git add packages/audit package.json package-lock.json
git commit -m "feat: add auditable run manifests"
```

## 任务 5：实现本地记忆、导出和两阶段清理

**文件：**
- Create: `packages/memory/package.json`
- Create: `packages/memory/src/index.ts`
- Create: `packages/memory/src/run-store.ts`
- Create: `packages/memory/src/export.ts`
- Create: `packages/memory/src/purge.ts`
- Test: `packages/memory/src/run-store.test.ts`

- [ ] **步骤 1：编写保留和清理的失败测试**

```ts
import { expect, it } from "vitest";
import { createRunStore } from "./index.js";

it("does not retain confidential artifacts without opt-in", async () => {
  const store = await createRunStore({ rootDir: "./runtime-test", retainConfidentialArtifacts: false });
  await store.recordArtifact({ name: "ta.xlsx", classification: "confidential", content: "redacted" });
  expect(await store.listArtifacts()).toEqual([]);
});

it("purges scoped artifacts while retaining cleanup evidence", async () => {
  const store = await createRunStore({ rootDir: "./runtime-test", retainConfidentialArtifacts: true });
  const plan = await store.planPurge();
  await store.executePurge(plan.confirmationToken);
  expect(await store.listArtifacts()).toEqual([]);
  expect(await store.hasEvent("purge_completed")).toBe(true);
});
```

- [ ] **步骤 2：运行测试并确认失败**

```powershell
npm test -- packages/memory/src/run-store.test.ts
```

Expected: FAIL，因为 run store 尚未实现。

- [ ] **步骤 3：实现受作用域约束的记录、导出和清理**

`createRunStore` 必须在 `runtime/projects/<projectId>/sessions/<sessionId>/runs/<runId>/`
创建 `transcript.jsonl`、`decisions.jsonl`、`events.jsonl` 和 `artifacts/`。事件只能经由
audit store 写入。`recordArtifact` 必须拒绝 `secret`；当
`retainConfidentialArtifacts` 为 `false` 时，`confidential` 只保存哈希元数据。

`createExport` 必须生成分类 manifest；包含 `confidential` 工件时要求
`confirmConfidential: true`，任何含 `secret` 的请求均返回 `policy_denied`。`planPurge`
必须返回一次性 token；`executePurge` 只删除当前 run 的记录和工件，再写入
`purge_completed`。

- [ ] **步骤 4：运行记忆模块测试**

```powershell
npm test -- packages/memory/src/run-store.test.ts
```

Expected: PASS；未显式选择时机密输入不落盘，清理后保留清理审计证据。

- [ ] **步骤 5：提交记忆模块**

```powershell
git add packages/memory package.json package-lock.json
git commit -m "feat: add local run memory lifecycle"
```

## 任务 6：实现 Skill SDK、匿名 Skill 与 adapter 边界

**文件：**
- Create: `packages/skill-sdk/src/index.ts`
- Create: `packages/skill-sdk/src/registry.ts`
- Create: `packages/skill-sdk/src/skill-runner.ts`
- Test: `packages/skill-sdk/src/skill-runner.test.ts`
- Create: `packages/skills/src/echo-skill.ts`
- Create: `packages/skills/src/classification-skill.ts`
- Create: `packages/skills/src/feature-placeholder-skill.ts`
- Create: `packages/adapters/src/deny-adapter.ts`
- Create: `packages/adapters/src/mock-adapter.ts`
- Create: `packages/adapters/src/calculation-adapter.ts`

- [ ] **步骤 1：编写 Skill 权限拒绝和 mock 执行的失败测试**

```ts
import { expect, it } from "vitest";
import { runRegisteredSkill } from "./index.js";

it("denies undeclared network access", async () => {
  await expect(runRegisteredSkill({ skillId: "network-test", requestedPermission: "network" }))
    .rejects.toMatchObject({ code: "policy_denied" });
});
it("runs the public echo Skill through a mock adapter", async () => {
  await expect(runRegisteredSkill({ skillId: "public-echo", input: { message: "hello" } }))
    .resolves.toMatchObject({ skillId: "public-echo", output: { message: "hello" } });
});
```

- [ ] **步骤 2：运行测试并确认失败**

```powershell
npm test -- packages/skill-sdk/src/skill-runner.test.ts
```

Expected: FAIL，因为注册表和执行包装尚未实现。

- [ ] **步骤 3：实现 manifest、Skill 和 adapter**

Skill manifest 最小结构必须为：

```ts
{
  skillId: "public-echo", version: "v1", featureId: "F8",
  inputClassification: ["public"], permissions: ["persist"],
  idempotent: true, retryable: false,
  auditEventTypes: ["skill_started", "skill_completed"],
}
```

`public-echo` 返回输入消息；`classification-check` 返回输入分类和允许的保留行为。
`feature-placeholder-skill` 对未启用 Feature 返回 `feature_not_available`，包含 Feature
ID、依赖和启用要求。

`deny-adapter.ts` 对所有外部动作抛出 `policy_denied`。`mock-adapter.ts` 只返回测试
中传入的确定性响应。`calculation-adapter.ts` 定义 `CalculationRequestV1` 和
`CalculationResultV1` Zod schema，并在 Worker 未配置时返回 F4 的
`feature_not_available`；不得读取或写入 workbook。

- [ ] **步骤 4：运行 Skill 与 adapter 测试**

```powershell
npm test -- packages/skill-sdk/src/skill-runner.test.ts
npm run build
```

Expected: PASS；默认外部调用被拒绝，两个匿名 Skill 通过 mock 路径返回确定性结果。

- [ ] **步骤 5：提交 Skill 和 adapter 边界**

```powershell
git add packages/skill-sdk packages/skills packages/adapters package.json package-lock.json
git commit -m "feat: add governed Skill runtime"
```

## 任务 7：实现编排器与端到端 smoke workflow

**文件：**
- Create: `packages/orchestrator/src/index.ts`
- Create: `packages/orchestrator/src/run-orchestrator.ts`
- Test: `packages/orchestrator/src/run-orchestrator.test.ts`
- Create: `fixtures/public/smoke-request.json`
- Create: `fixtures/public/smoke-expected.json`

- [ ] **步骤 1：编写 smoke workflow 的失败测试**

```ts
import { expect, it } from "vitest";
import { runSmokeWorkflow } from "./index.js";

it("creates a verifiable public run with two Skills", async () => {
  const result = await runSmokeWorkflow({ rootDir: "./runtime-test" });
  expect(result.skillResults).toHaveLength(2);
  expect(result.manifestValid).toBe(true);
  expect(result.runId).toMatch(/^[0-9a-f-]{36}$/);
});
```

- [ ] **步骤 2：运行测试并确认失败**

```powershell
npm test -- packages/orchestrator/src/run-orchestrator.test.ts
```

Expected: FAIL，因为编排器尚未实现。

- [ ] **步骤 3：实现 run 生命周期和失败分类**

状态只能为 `created`、`policy_checked`、`running`、`completed`、`failed` 和 `purged`。
`runSmokeWorkflow` 必须创建 public run、执行 `public-echo` 与 `classification-check`、
写入每个状态事件、写入 manifest、校验 bundle，并返回
`{ runId, skillResults, manifestValid }`。

当 Skill 返回 `policy_denied`、`feature_not_available`、`dependency_error`、
`transient_error` 或 `internal_error` 时，编排器写入 `skill_failed` 并原样返回错误。
仅当 Skill manifest 的 `retryable` 为 `true` 且错误码为 `transient_error` 时，最多重试两次。

- [ ] **步骤 4：运行编排器测试**

```powershell
npm test -- packages/orchestrator/src/run-orchestrator.test.ts
```

Expected: PASS；运行记录包含两个 Skill 结果，manifest 可验证。

- [ ] **步骤 5：提交编排器**

```powershell
git add packages/orchestrator fixtures/public package.json package-lock.json
git commit -m "feat: add auditable smoke orchestration"
```

## 任务 8：实现 CLI 与用户可执行的 run 操作

**文件：**
- Modify: `apps/cli/package.json`
- Create: `apps/cli/src/index.ts`
- Create: `apps/cli/src/commands/smoke.ts`
- Create: `apps/cli/src/commands/inspect.ts`
- Create: `apps/cli/src/commands/export.ts`
- Create: `apps/cli/src/commands/purge.ts`
- Test: `apps/cli/src/index.test.ts`

- [ ] **步骤 1：编写 CLI smoke 与 purge 确认的失败测试**

```ts
import { expect, it } from "vitest";
import { executeCli } from "./index.js";

it("prints the run id for smoke", async () => {
  const result = await executeCli(["smoke", "--root", "./runtime-test"]);
  expect(result.stdout).toMatch(/runId:/);
});
it("requires a confirmation token before purge", async () => {
  const result = await executeCli(["purge", "--run-id", "00000000-0000-4000-8000-000000000001"]);
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("confirmation token");
});
```

- [ ] **步骤 2：运行测试并确认失败**

```powershell
npm test -- apps/cli/src/index.test.ts
```

Expected: FAIL，因为 CLI 命令尚未实现。

- [ ] **步骤 3：实现最小 CLI 命令**

CLI 仅提供以下命令：

```text
ai-assist smoke --root <runtime-root>
ai-assist inspect --run-id <uuid> --root <runtime-root>
ai-assist export --run-id <uuid> --root <runtime-root> [--confirm-confidential]
ai-assist purge-plan --run-id <uuid> --root <runtime-root>
ai-assist purge --run-id <uuid> --root <runtime-root> --confirmation-token <token>
```

`smoke` 输出 `runId`、Skill 结果计数和 manifest 校验。`inspect` 只显示 manifest
元数据与事件摘要，默认不得显示 confidential 工件内容。`export` 显示分类清单；
`purge-plan` 显示删除作用域和 token；`purge` 缺少或错误 token 时以 exit code `2` 退出。

- [ ] **步骤 4：运行 CLI 测试和手工 smoke**

```powershell
npm test -- apps/cli/src/index.test.ts
npm run build
node apps/cli/dist/index.js smoke --root ./runtime-test
```

Expected: PASS；命令输出有效 `runId`、`skillResults: 2` 和 `manifestValid: true`。

- [ ] **步骤 5：提交 CLI**

```powershell
git add apps/cli package.json package-lock.json
git commit -m "feat: add local run management CLI"
```

## 任务 9：添加 GitHub 协作工件与本地质量门

**文件：**
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/governance-change.yml`
- Create: `.github/pull_request_template.md`
- Create: `.github/CODEOWNERS.example`
- Create: `.github/ci.example.yml`
- Create: `docs/governance/development-standard.md`
- Create: `docs/governance/github-admin-checklist.md`
- Create: `eslint.config.mjs`
- Modify: `scripts/verify-repository.test.mjs`

- [ ] **步骤 1：编写协作标准验收检查**

```js
import { existsSync } from "node:fs";

it.each([
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/pull_request_template.md",
  "docs/governance/development-standard.md",
  "docs/governance/github-admin-checklist.md",
])("requires %s", (path) => {
  expect(existsSync(path)).toBe(true);
});
```

- [ ] **步骤 2：运行测试并确认失败**

```powershell
npm test -- scripts/verify-repository.test.mjs
```

Expected: FAIL，因为 GitHub 模板和协作标准尚未创建。

- [ ] **步骤 3：创建中文协作规范和 GitHub 模板**

`docs/governance/development-standard.md` 必须明确：所有 Feature 从 GitHub Issue 开始；
禁止直接在 `main` 开发；必须从最新 `main` 建立 `feature/`、`fix/` 或 `docs/` 分支；
每个 Pull Request 必须关联 Issue、说明契约与隐私影响、提供测试证据并声明回滚方式；
计划、实施、执行和验收说明默认使用中文。

`docs/governance/github-admin-checklist.md` 必须列出仓库管理员后续启用的保护：要求
Pull Request、至少一名审查者、必需检查、禁止 force push、限制 bypass 和可选
CODEOWNERS；必须明确这些不是 Phase 0 自动执行内容。

`feature.yml` 必须要求 Feature ID、用户故事、输入/输出契约、数据分类、依赖、验收
检查和外部前置条件。PR 模板必须要求 Issue 链接、变更摘要、测试命令及结果、隐私
检查和回滚说明。`.github/ci.example.yml` 是非活动模板；仅在管理员明确复制为
`.github/workflows/ci.yml` 后才启用。模板不能包含触发器，且只能包含以下命令：

```yaml
- run: npm ci
- run: npm run lint
- run: npm run build
- run: npm test
- run: npm run check:repository
```

Create `eslint.config.mjs`，使用 `@eslint/js` 推荐规则和 TypeScript parser，并排除
`dist/`、`coverage/`、`runtime/` 与 `exports/`。

- [ ] **步骤 4：运行质量门**

```powershell
npm test -- scripts/verify-repository.test.mjs
npm run lint
npm run check:repository
```

Expected: PASS；协作工件存在，lint 与机密路径检查通过。

- [ ] **步骤 5：提交协作治理工件**

```powershell
git add .github docs/governance eslint.config.mjs scripts/verify-repository.test.mjs
git commit -m "docs: add Chinese collaboration standards"
```

## 任务 10：执行完整验收与发布工程基座

**文件：**
- Modify: `README.md`
- Modify: `docs/README.md`
- Create: `docs/governance/phase-0-acceptance.md`
- Test: `apps/cli/src/phase-0.acceptance.test.ts`

- [ ] **步骤 1：编写 Phase 0 端到端验收测试**

```ts
import { expect, it } from "vitest";
import { executeCli } from "./index.js";

it("completes smoke and exports a public run", async () => {
  const smoke = await executeCli(["smoke", "--root", "./runtime-test"]);
  const runId = smoke.stdout.match(/runId: ([0-9a-f-]{36})/)?.[1];
  expect(runId).toBeDefined();
  expect(smoke.stdout).toContain("manifestValid: true");
  const exported = await executeCli(["export", "--run-id", runId, "--root", "./runtime-test"]);
  expect(exported.exitCode).toBe(0);
  expect(smoke.stdout).toContain("F4: feature_not_available");
});
```

- [ ] **步骤 2：运行验收测试并确认失败**

```powershell
npm test -- apps/cli/src/phase-0.acceptance.test.ts
```

Expected: FAIL，直到 CLI、导出和 Feature 占位逻辑完成。

- [ ] **步骤 3：补齐最小行为与中文使用说明**

修正 CLI 或存储实现，使验收测试能够运行匿名 smoke、导出 public run、显示 F4 的
`feature_not_available`、生成 purge plan 并仅以正确 token 清理。不得添加真实外部
adapter、真实 workbook 或模型调用。

更新 `README.md` 与 `docs/README.md`，链接工程基座设计、中文协作标准、Feature
Register 和 Phase 0 验收说明。`docs/governance/phase-0-acceptance.md` 必须用中文列出
每项完成定义对应的测试命令和预期结果。

- [ ] **步骤 4：运行完整验证**

```powershell
npm run lint
npm run build
npm test
npm run check:repository
git diff --check
git status --short
```

Expected: 所有命令退出码为 `0`；不存在已跟踪的 `runtime/`、`.env`、`.xlsx` 或 `.xlsm` 文件。

- [ ] **步骤 5：提交 Phase 0 验收与文档入口**

```powershell
git add README.md docs/README.md docs/governance/phase-0-acceptance.md apps/cli/src/phase-0.acceptance.test.ts
git commit -m "docs: document Phase 0 acceptance"
```