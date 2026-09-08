# Standalone F6 Model Materializer Implementation Plan

**Goal:** 在不修改 contracts、Workbench、Web、CLI app 或 VS Code extension 的前提下，为独立 TA Assist Agent 补齐严格 v3 模型解释物化入口。

**Boundary:** 仅修改 `scripts/`、根 `package.json`、`.github/skills/design-optimization/SKILL.md` 和对应技能测试。

## Task 1: 命令级 RED

- 新增脚本测试，使用现有 F6 fixture 调用 `workflow:f6:model-interpretation`。
- 断言当前因命令不存在而失败。
- 测试目标行为：生成请求模板；消费逐工作表模型 response；输出严格 `f5-multimodal-artifact-v3`。

## Task 2: 最小 materializer

- 新增 CLI 参数解析和 schema 验证。
- 从当前 F2/F3/F4/F5 读取完整 worksheet/Factor/image identity。
- `prepare` 模式生成不可变请求模板。
- `materialize` 模式验证精简模型 response，扩展 field-identical row mappings，计算 request/factor hashes。
- 使用 UUID 目录、exclusive create、readback 和 `validateF5MultimodalArtifactV3` 写入最终文件。
- 不接受历史最终 artifact，不调用外部模型，不修改任何共享架构。

## Task 3: 技能接入与回归

- 在 Design Optimization W8 中调用本地 materializer，而不是要求 agent 手工拼装完整 v3 JSON。
- agent 仍逐工作表查看已验证图片并创建精简 response；materializer 负责 deterministic identity 和 hash。
- 更新允许命令和技能测试。
- 运行聚焦测试、build、repository check 和 `git diff --check`。
