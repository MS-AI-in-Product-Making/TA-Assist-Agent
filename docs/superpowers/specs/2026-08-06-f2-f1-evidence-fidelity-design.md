# F2 对 F1 证据保真优化设计

**日期：** 2026-08-06

## 目标

优化 F1 到 F2 的证据传递，确保 F2 只消费并引用 F1 已生成的 artifact，不复制图片、不改写来源标签，也不丢失因子表中的计算结果列。

本设计解决三个已复现问题：

1. F2 将 F1 图片复制到自己的 `images/` 目录，造成同一证据出现两份文件。
2. F2 将来源标签改写为 `LSL`、`USL`、`Target σ`，与 F1/Excel 的原始命名不一致。
3. 实际表头 `1σ` 与 `% Cont. to σ` 未命中语义 alias，导致 F1 semantic JSON 中相应字段不可用，F2 显示为空。

## 已确认的产品决策

1. F2 不再复制或重新生成 F1 图片。
2. F2 JSON 保存 F1 image artifact 的相对路径、content hash 和来源 worksheet；F2 Markdown 直接链接该 F1 文件。
3. F2 报告依赖同一次 workflow run 中的 F1 artifact，不承诺脱离 F1 目录后仍可独立显示图片。
4. 系统规格名称使用 F1 提取的原始 label，不在 F2 中缩写、翻译或重新命名。
5. `1σ` 与 `% Cont. to σ` 由 F1 semantic header resolver 识别并从公式 cached value 投影，F2 不重新计算这些值。
6. F4 继续消费 canonical 数值字段，不消费显示标签，因此本优化不得改变 F4 计算语义。

## 根因与证据

### 图片重复

`scripts/f2-image-materializer.mjs` 当前使用 `copyFileSync`，将 `f2ArtifactInput.worksheets[].tolerancePathImage.imagePath` 指向的 F1 文件复制到 F2 `images/<hash>.png`。F2 没有重新读取 Excel 或截图，但确实生成了第二份物理文件。

### 系统规格名称被改写

F1 已从 worksheet 提取规格值与 source cell，但 evidence contract 没有保存原始 label。`scripts/f2-report.mjs` 因此硬编码输出 `LSL`、`USL`、`Target σ` 和 `Additional Mean Shift`。

真实来源名称为：

- `*Lower Spec Limit ►`
- `*Upper Spec Limit ►`
- `*Target σ Level ►`
- `Additional Mean Shift ►`

### 计算列为空

真实 factor header 使用 `1σ` 与 `% Cont. to σ`。resolver 当前 alias 仅包含 `1 sigma`、`one sigma`、`% contribution to sigma` 和 `percent contribution to sigma`，因此未创建 `oneSigma` 与 `percentContributionToSigma` fields。F1 Markdown 的 dual-grid exporter 能显示这些单元格，不代表 semantic artifact 已识别它们。

## 方案比较

### 方案 A：继续复制图片，仅在报告中标注 F1 来源

优点是 F2 目录保持自包含。缺点是仍存在两份物理 artifact，无法满足“统一以 F1 输出图片为锚点”的要求。

### 方案 B：F2 直接引用 F1 artifact（采用）

F2 JSON 保存受校验的 F1 相对路径与 hash；Markdown 从 F2 输出目录计算到 F1 图片的相对链接。优点是单一证据源、hash 可追溯、实现边界清晰。代价是移动 F2 目录时必须同时保留 F1 artifact。

### 方案 C：建立 run 级共享 asset registry

将 F1/F2 图片统一放到 run 根目录。长期可扩展，但需要修改 output layout、manifest 和历史 artifact 兼容规则，超出本次问题范围。

## 数据契约

### F1 图片引用

F2 row 中的 `imageTarget` 替换为 `imageReference`：

```ts
interface F1ImageReference {
  artifact: "f1";
  relativePath: string;
  contentHash: string;
  worksheetName: string;
}
```

规则：

- `relativePath` 相对于 `report.artifactRoot`，即 F1 artifact root。
- loader 必须继续执行 root containment、文件存在、非空、media type 和 SHA-256 校验。
- F2 report 只能引用 loader 已验证的路径，不能接受调用方直接提供的任意路径。
- 同一 worksheet 的所有 factor row 可引用同一 `F1ImageReference`，不产生复制操作。
- `scripts/run-f2-full-validation.mjs` 移除 image materialization 步骤；`scripts/f2-image-materializer.mjs` 及其专用测试删除。

### 系统规格原始标签

available evidence 增加必填 `sourceLabel`：

```ts
interface AvailableWorksheetEvidenceNumber {
  status: "available";
  actualValue: number;
  displayValue: string;
  sourceLabel: string;
  sourceCell?: string;
  valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
}
```

提取规则：

- `lowerSpecLimit`、`upperSpecLimit`、`targetSigmaLevel` 保存匹配到的 label cell 原文。
- `additionalMeanShift` 有来源 label 时保存原文；缺失并采用默认值时，`sourceLabel` 使用 canonical fallback `Additional Mean Shift`，同时保持 `valueOrigin: "defaulted"`，不得伪造 source cell。
- label normalization 只用于匹配，不得覆盖 evidence 中的 `sourceLabel`。
- F2 renderer 第一列直接使用 `sourceLabel`，不再维护 `LSL`、`USL` 等显示别名。
- F4 handoff 保留 source label evidence，但计算仍只读取 `actualValue`。

## F2 Markdown 图片路径

`renderF2Report` 增加渲染上下文：

```ts
renderF2Report(report, { outputRoot })
```

对每个 `imageReference`：

1. 以 `report.artifactRoot` 解析 F1 图片绝对路径。
2. 以 `outputRoot` 为起点计算相对路径。
3. 将 Windows separator 归一为 `/` 后写入 Markdown。
4. 不复制、不改名、不重新编码图片。

在标准 F2 Excel workflow 中，链接形态类似：

```text
../f1/sheets/<workbook>/images/<f1-image-name>.png
```

artifact-only workflow 允许产生更深的 `../` 相对链接，但目标必须已由 loader 证明位于 F1 artifact root 内。

## Factor Header 修复

在现有语义 resolver 中扩展精确 alias：

```text
oneSigma:
  - 1σ

percentContributionToSigma:
  - % cont. to σ
```

继续使用当前 normalize 规则处理大小写、换行与 `▼`。不使用固定 R/S 列，也不按列距离猜测。

成功识别后：

1. F1 fields 保存公式、cached value、source cell 和 numeric value。
2. `projectFactorActualFields` 从 canonical fields 投影 `oneSigma` 与 `percentContributionToSigma`。
3. F2 report 直接输出 actual value。
4. F4 handoff 接收相同 canonical 数值，不重新计算。

## 兼容与迁移

本次修改保持 `contractVersion: "v1"`，但生产者和仓库内消费者必须原子迁移：

- F1 新生成 evidence 必须包含 `sourceLabel`。
- F2 report row 使用 `imageReference`，不再生成 `imageTarget`。
- 仓库内 fixtures、F3 loader fixtures 和 report tests 同步升级。
- 旧落盘 F1 artifact 缺少 `sourceLabel` 时，F2 loader 应返回精确 `invalid_contract` issue path，要求重新运行 F1；不得从 Markdown 猜测标签。
- 旧 F2 report 的 `imageTarget` 不作为新 F3 输入兼容路径。F3 只消费结构化 factor 与 identifier 数据，不依赖图片文件，因此升级 fixture 即可。

## 错误处理

- F1 image path 越界、文件缺失、空文件或 hash 不一致：F2 `inputRejected`，不得生成悬空链接。
- 系统规格 label 缺失或歧义：沿用 worksheet 级 blocking。
- `1σ` 或 `% Cont. to σ` 缺少 cached value：字段保留 unavailable evidence；这两个计算列不升级为 F2 业务必填，不额外阻断 worksheet。
- renderer 缺少 `outputRoot`：视为编程错误并在测试中 fail fast，不回退到伪造的 `images/` 路径。

## 测试与验收

### TDD 回归

1. `factor-header-resolver`：真实 `1σ` 与 `% Cont. to σ` 表头解析到唯一 semantic fields。
2. `worksheet-analysis-assets`：公式 cached values、source cells 与 numeric values 完整保留。
3. `f1-factor-actuals`：`oneSigma` 与 `percentContributionToSigma` 从 canonical fields 投影。
4. `response-summary`：原始 source labels 原样保存，包括 `*`、`σ` 和 `►`。
5. `f2-user-report`：row 携带 F1 `imageReference`，不创建 F2 target。
6. `f2-report`：系统规格名称与 F1 label 完全相同，图片链接指向 F1 artifact。
7. F2 full flow：F2 输出目录中不存在复制的图片文件。
8. F3/F4：现有结构化消费与计算结果不变。

### 真实 workbook 验收

对 `test/Test_TP_Step_202600805.xlsx` 的 `TP_C_Step_TA` 验收：

- F2 `completed`，worksheet `ready`，7 factors，1 个 F4 handoff。
- 系统规格名称显示为 F1 原文，不显示 `LSL`、`USL`、`Target σ` 等 F2 自定义名称。
- 行 14 的 `1σ = 0.0125`，`% Cont. to σ = 0.0769230769230769`；其余行与 F1 actual values 一致。
- F2 Markdown 图片链接可打开 F1 已提取图片。
- F2 输出目录没有 `images/` 副本。
- F1/F2 image reference 的 content hash 完全一致。

## 非目标

- 不重新计算 `1σ` 或贡献率。
- 不修改 Excel 数值、公式或格式。
- 不改变 F0 capability 判断。
- 不改变 F4 calculation kernel。
- 不建立跨 run 的全局 asset registry。
- 不保证单独移动 F2 目录后图片链接仍有效。