# AI Assist Agent 路线图更新设计

## 目的

将面向产品的项目名称从 TA 专用的工作名称更改为 **AI Assist Agent**，并使 GitHub 规划工件与 `docs/04-feature-breakdown.md` 中的产品定义保持一致。

## 唯一事实来源

- 产品名称：**AI Assist Agent**。
- V1 路线图结构：一个 Epic、四个 ME User Story，以及 F0-F8 Feature。
- 应尽可能保留现有 GitHub issue 编号，以免破坏链接。
- TA 领域术语仍然有效：TA workbook、DIM ID、Cpk、RSS、WC、CTS/CTF、measured Cpk 和 evidence pane 等术语不应被泛化。

## 仓库命名更新

将面向用户的仓库文档中的 **AI TA Analysis Agent** / **Surface TA Analysis Agent** 更新为 **AI Assist Agent**。

保持详细产品范围不变：

- V1 产品仍用于辅助公差分析工作流。
- Feature 文档仍描述 TA 专用工作流。
- 除非与新产品名称冲突，否则不移除机密工程说明和公式引用。

## GitHub Issue 更新

使用文档定义的结构作为规划模型：

1. **User Story 1 - 可靠的首次 TA 结果与摘要**
   - 覆盖 F0、F1、F2、F4 和 F8。
2. **User Story 2 - 关键里程碑之前的 DIM ID 与图纸治理**
   - 覆盖 F3。
3. **User Story 3 - 客观结论与可比较选项**
   - 覆盖 F5 和 F6。
4. **User Story 4 - Measured Cpk 反馈与持续准确性改进**
   - 覆盖 F7。

保留现有 Feature issue 编号，并更新其正文和检查清单，使之符合 `docs/04-feature-breakdown.md`。

将现有 S0-S9 User Story issue 视为历史迁移记录，而不是删除它们。如果可以安全关闭，请以说明指向新的四个故事结构后关闭；否则更新其正文和标题以标记为已迁移。

## GitHub Project 更新

将 Project #1 重命名为 **AI Assist Agent Roadmap**。

更新项目简短描述/readme，说明看板按以下结构跟踪 V1 路线图：

- 4 个 User Story
- F0-F8 Feature
- Feature issue 检查清单中的实现任务

将 `User Story` 单选项目字段从 S0-S9 选项更新为文档定义的四个 User Story，然后将每个 Feature issue 分配给正确的选项。

## 安全性与验证

- 不删除 issue。
- 不破坏现有 issue 链接。
- 尽可能保留旧 issue 编号。
- 更新后验证 Project #1 标题和项目分组。
- 验证仓库文档包含新的面向产品的名称。
- 验证 Feature issue 正文包含与文档一致的具体任务检查清单。

