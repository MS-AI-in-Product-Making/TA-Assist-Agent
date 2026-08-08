# F3 Surface MCP 自动连接与认证实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当用户选择 ADO 发布时，让 F3 Skill 通过首个只读 organization listing 按需连接 Surface MCP、触发 VS Code 原生认证，并准确区分服务不可用、认证失败和 comment body schema 不支持。

**Architecture:** 交互编排继续由项目级 F3 Skill 和发布协议承担，不在本地 TypeScript core 中实现 OAuth 或网络调用。VS Code/Suface MCP 负责认证 UI 与凭据存储；仓库只增加确定性的顺序契约、失败状态持久化和测试。连接或认证失败发生在 Work Item 验证前，因此 writer 必须拒绝这两种 outcome 携带 `workItemReference`。

**Tech Stack:** GitHub Copilot Agent Skill Markdown、Node.js ESM、Vitest 3、Zod 3、VS Code MCP HTTP server configuration。

---

## 文件职责

- `.github/skills/f3-analysis/SKILL.md`：定义发布模式之后的工具发现、只读连接/认证触发、实体校验、schema gate 与写入顺序。
- `.github/skills/f3-analysis/references/ado-publishing.md`：定义认证契约、错误分类、状态矩阵和凭据禁令。
- `scripts/f3-skill.test.mjs`：锁定 Skill/reference 文本协议、阶段顺序和合法 fallback 命令。
- `scripts/write-f3-ado-reminder.mjs`：校验受控 status/reasonCode 组合并持久化 F3 ADO outcome。
- `scripts/write-f3-ado-reminder.test.mjs`：覆盖新增 reason code 和 pre-validation reference 禁令。
- `scripts/f3-report.test.mjs`：验证新增 reason code 能安全渲染到 Markdown 且不泄露 comment body。
- `docs/superpowers/specs/2026-08-08-f3-surface-mcp-authentication-design.md`：已确认设计依据。

### Task 1: 锁定 Skill 认证顺序契约

**Files:**
- Modify: `scripts/f3-skill.test.mjs`
- Modify: `.github/skills/f3-analysis/SKILL.md`
- Modify: `.github/skills/f3-analysis/references/ado-publishing.md`

- [ ] **Step 1: 写入失败的 Skill 顺序测试**

在 `scripts/f3-skill.test.mjs` 增加测试，使用以下固定 marker：

```js
it("connects and authenticates Surface MCP after publishing mode and before entity validation", () => {
  const skill = readUtf8(skillPath);
  const reference = readUtf8(referencePath);
  const publishGate = "Question call 1 - publishing mode: vscode_askQuestions";
  const connectionPhase = "## Phase 3 - Surface connection and authentication";
  const readOnlyTrigger = "read-only organization listing";
  const validationPhase = "## Phase 4 - Surface validation flow";

  expect(skill.indexOf(connectionPhase)).toBeGreaterThan(skill.indexOf(publishGate));
  expect(skill.indexOf(readOnlyTrigger)).toBeGreaterThan(skill.indexOf(connectionPhase));
  expect(skill.indexOf(validationPhase)).toBeGreaterThan(skill.indexOf(readOnlyTrigger));
  expect(skill).toContain("VS Code native authentication");
  expect(skill).toContain("wait for the tool call to return");
  expect(skill).toContain("Never request passwords, PATs, tokens, verification codes, or MFA responses");
  expect(reference).toContain("configured -> connected -> authenticated -> entity validated");
});
```

同时扩展命令样例和 status matrix 断言，加入：

```text
--status blocked --reason-code surface_mcp_unavailable
--status blocked --reason-code surface_mcp_authentication_failed
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: FAIL，缺少 connection/authentication phase、新 reason matrix 和 fallback 命令。

- [ ] **Step 3: 最小更新 Skill**

在发布模式之后新增 Phase 3，要求：

```text
tool discovery
-> read-only organization listing
-> VS Code native authentication
-> wait for tool result
-> entity validation
```

新增两个合法 fallback 命令；将原 validation/preview/write phase 顺延。明确 `Do not publish` 不连接 MCP，且不得通过 chat、askQuestions、CLI 或 terminal relay 收集秘密。

- [ ] **Step 4: 最小更新 reference**

新增连接/认证章节、固定状态顺序和六行 status matrix。明确：

```text
surface_mcp_unavailable = no tools/server start/network availability
surface_mcp_authentication_failed = cancelled/denied/failed native authentication
surface_mcp_comment_body_unsupported = authenticated tool schema lacks full Markdown body
```

- [ ] **Step 5: 运行 Skill 测试确认 GREEN**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: 所有 `f3-skill` 测试 PASS。

### Task 2: 扩展本地 fallback reason contract

**Files:**
- Modify: `scripts/write-f3-ado-reminder.test.mjs`
- Modify: `scripts/write-f3-ado-reminder.mjs`

- [ ] **Step 1: 写入失败的 writer 测试**

增加两个成功案例：

```js
for (const reasonCode of ["surface_mcp_unavailable", "surface_mcp_authentication_failed"]) {
  const result = writeF3AdoReminder({
    f3OutputRoot: outputRoot,
    adoOutcome: { status: "blocked", reasonCode },
  });
  expect(result.report.ado).toEqual({ status: "blocked", reasonCode });
}
```

增加 pre-validation reference 拒绝案例：

```js
expect(() => writeF3AdoReminder({
  f3OutputRoot: outputRoot,
  adoOutcome: {
    status: "blocked",
    reasonCode: "surface_mcp_authentication_failed",
    workItemReference: "1102392",
  },
})).toThrow(/cannot include work item reference/i);
```

`surface_mcp_unavailable` 使用相同断言。

- [ ] **Step 2: 运行测试确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/write-f3-ado-reminder.test.mjs
```

Expected: FAIL，新增 reason code 尚未被白名单接受。

- [ ] **Step 3: 最小更新 writer**

将以下值加入 `CONTROLLED_REASON_CODES`：

```js
"surface_mcp_unavailable",
"surface_mcp_authentication_failed",
```

在 `validateAdoOutcome` 中增加：

```js
const preValidationReasonCodes = new Set([
  "surface_mcp_unavailable",
  "surface_mcp_authentication_failed",
]);
if (workItemReference !== undefined && preValidationReasonCodes.has(reasonCode)) {
  throw new Error("Pre-validation Surface MCP failures cannot include work item reference.");
}
```

- [ ] **Step 4: 运行 writer 测试确认 GREEN**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/write-f3-ado-reminder.test.mjs
```

Expected: 所有 writer 测试 PASS。

### Task 3: 覆盖报告渲染与协议一致性

**Files:**
- Modify: `scripts/f3-report.test.mjs`
- Modify: `scripts/f3-skill.test.mjs`

- [ ] **Step 1: 增加报告渲染测试**

为 `surface_mcp_unavailable` 和 `surface_mcp_authentication_failed` 各构造一个 F3 result，断言：

```js
expect(markdown).toContain("ADO 状态：`blocked`");
expect(markdown).toContain(`ADO 原因：${reasonCode}`);
expect(markdown).not.toContain("comment body");
expect(markdown).not.toContain("Authorization");
```

- [ ] **Step 2: 运行最窄测试**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-report.test.mjs scripts/f3-skill.test.mjs scripts/write-f3-ado-reminder.test.mjs
```

Expected: 全部 PASS；若仅 fixture 与新增矩阵不一致，更新相同测试文件中的精确期望，不改变生产语义。

- [ ] **Step 3: 检查 MCP 配置保持无凭据**

验证 `.vscode/mcp.json` 仍只有 `type` 和 `url`，且没有 `Authorization`、token、PAT 或静态 secret。

Run:

```powershell
Select-String -Path .vscode/mcp.json -Pattern 'Authorization|token|PAT|secret' -CaseSensitive:$false
```

Expected: 无匹配。

### Task 4: 全量验证与人工验收说明

**Files:**
- Verify only: all changed files

- [ ] **Step 1: 运行 TypeScript build**

Run:

```powershell
npm run build -- --force
```

Expected: exit code 0。

- [ ] **Step 2: 运行完整测试**

Run:

```powershell
npm test
```

Expected: exit code 0，所有 Vitest workspace 测试通过。

- [ ] **Step 3: 检查 diff 和诊断**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: 无 whitespace error；变更仅覆盖设计、计划、Skill/reference、writer 和对应测试。

- [ ] **Step 4: 记录真实环境验收边界**

最终说明必须明确：自动化测试验证编排和本地 fallback；真实 OAuth 弹窗仍需在 Surface MCP 可用的 VS Code 环境中，以首次只读 organization listing 进行人工验收。不得声称本地测试模拟了真实 OAuth。
