# F6 报告布局、动态命名与完整路径输出设计

## 背景

当前 F6 工程报告存在四个用户可见问题：

1. 优化流程卡片中的紫色标题与 `STEP 1/2/3` 会因面板宽度不足而换行，标题层级被破坏。
2. `DOCUMENT OVERVIEW` 与 `WORKBOOK SUMMARY` 的蓝色表头右上角为直角，与报告卡片的圆角语言不一致。
3. 新生成的 Markdown 和 PDF 使用固定名称 `Feature6-Report.md` 与 `Feature6-Report.pdf`，无法从文件名识别源工作簿。
4. TA Assist Agent 成功消息只提供 workspace-relative 链接，用户还需要手动定位磁盘目录。

本设计只调整 F6 报告发布和呈现，不改变计算、优化、绘图治理、模型解读或源工作簿内容。

## 目标

- 三个紫色优化标题与对应 `STEP` 标签始终位于同一行。
- 两个首页摘要表的蓝色表头具有右上圆角过渡。
- 新发布报告使用 `<validated workbook basename> - TA ENGINEERING ANALYSIS REPORT.md/.pdf`。
- Agent 成功消息仅呈现验证器确认的 Markdown 与 PDF 完整绝对路径。
- 历史 F6 产物保持只读可验证，不重命名、不迁移、不重写。
- Markdown、PDF、run summary 与 manifest 继续保持原子发布和 SHA-256 绑定。

## 非目标

- 不改变报告英文内容、章节结构、颜色系统或计算结果。
- 不改变 `Feature6-Optimization.json`、`Feature6-Run-Summary.json` 和 `manifest.json` 的文件名。
- 不为历史运行补发或重命名报告。
- 不改变源工作簿 basename，也不从运行目录名推断文件名。

## 方案

### 1. 优化步骤标题单行布局

`F6PdfRenderer.heading()` 继续在一个 `h2` 中输出标题和 `step-label`。CSS 将标题容器改为单行 flex 布局：

- `display: flex`
- `align-items: baseline`
- `white-space: nowrap`
- 标题文本允许在必要时使用受控的较小字号适配现有三列宽度
- `step-label` 使用 `flex: 0 0 auto`，不单独换行

不使用横向滚动、文本裁切或负字距。标题仍保持紫色，`STEP` 标签保持现有黑色元信息样式。

### 2. 首页蓝色表头右上圆角

仅针对 `.document-overview` 和 `.workbook-summary`：

- 最后一个 `th` 增加与卡片轮廓协调的 `border-top-right-radius`
- 保留现有标题 caption、表格边框和整体圆角裁切
- 不影响报告内其他蓝色表头

实际 PDF 截图必须显示蓝色区域在右上角平滑过渡，且不露出白色尖角或遮挡边框。

### 3. 新版动态报告文件名契约

新增当前写入 artifact-set 版本，旧 `f6-artifact-set-v3` 保持只读兼容。新版写入规则：

```text
<workbook basename without final .xlsx> - TA ENGINEERING ANALYSIS REPORT.md
<workbook basename without final .xlsx> - TA ENGINEERING ANALYSIS REPORT.pdf
```

命名来源只能是已验证 F2/F4/F6 工作簿身份中的 `fileName`：

1. 要求扩展名为 `.xlsx`，大小写不敏感。
2. 仅移除末尾 `.xlsx`。
3. 拒绝路径分隔符、`.`、`..`、设备名或其他不能作为安全 basename 的输入。
4. 不从用户显示文本、目录 slug、运行 ID 或源路径重新拼接 workbook 名称。

新版 manifest 记录实际动态文件名。run summary 中的 Markdown/PDF SHA-256 字段继续绑定实际文件字节。PDF 仍由同一 Markdown 报告投影生成，并要求 `%PDF-` 签名。

### 4. 历史兼容与验证

验证器按 `artifactSetVersion` 分支：

- 历史 `f6-artifact-set-v3`：继续要求 `Feature6-Report.md` 和 `Feature6-Report.pdf`。
- 新版：从已验证 workbook identity 计算唯一预期动态 basename，并要求 manifest、目录文件集合、run summary 哈希和实际文件名全部匹配。

不得仅信任 manifest 中的任意文件名，也不得扫描目录后选择“看起来像报告”的文件。历史产物只读，不自动升级到新版。

CLI、Workbench artifact route、host action 和当前输出验证脚本使用同一命名 helper 或同一明确规则，避免多处手写字符串产生漂移。

### 5. Agent 完整路径输出

TA Assist Agent 和 Design Optimization 的成功呈现规则改为：

- 只输出验证器确认的最终 Markdown 与 PDF。
- 对两个路径执行受控 containment、存在性、非链接路径和哈希验证。
- 输出完整绝对路径，不输出根据 run ID 猜测的路径。
- 不把 Optimization JSON、run summary 或 manifest 当作用户报告。

CLI 已能返回 canonical absolute report paths；Agent 使用这些已验证路径，而不是将其转换为 workspace-relative links。

## 数据流

1. F6 loader 验证源工作簿身份。
2. 动态命名 helper 从已验证 `fileName` 生成 Markdown/PDF basename。
3. output layout 使用动态 basename 创建 staging 和最终目标。
4. runner 写入 Optimization、Markdown、PDF、run summary，最后写 manifest。
5. validator 根据 artifact-set 版本和 workbook identity 验证文件集合、名称、签名及哈希。
6. CLI/Workbench 暴露同一对已验证报告路径。
7. Agent 成功消息打印这两个 canonical absolute paths。

任何动态名称、路径 containment、PDF 渲染、文件集合或哈希验证失败都必须 fail closed，不得回退为固定文件名或只发布 Markdown。

## 测试策略

严格采用测试驱动开发，每项先观察预期失败，再写最小实现。

### 布局测试

- 断言优化标题容器使用单行布局，`step-label` 不换行。
- 断言三个长标题仍与 `STEP` 标签位于同一标题行。
- 断言两个首页摘要表的最后表头单元格具有右上圆角。
- Playwright 渲染代表性报告，在桌面 PDF 尺寸进行截图和元素边界检查，确认无换行、重叠或裁切。

### 命名契约测试

- 从 `Meara TP TA_20241030-v0 - test0918.xlsx` 得到：
  - `Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT.md`
  - `Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT.pdf`
- 新版 runner 发布且 manifest 记录动态名称。
- 新版 validator 拒绝固定名、篡改 basename、额外文件和哈希不匹配。
- 历史 v3 固定名产物继续通过只读验证。
- CLI 与 Workbench 下载名使用动态 basename。

### Agent 输出测试

- 成功消息包含两个已验证绝对路径。
- 不包含 workspace-relative 报告链接或额外内部产物路径。
- 任一报告缺失、过期、越界、链接或哈希失败时不输出成功报告路径。

### 回归验证

- TypeScript build。
- 受影响的 Vitest 与 Node 测试。
- ESLint。
- F6 PDF Playwright E2E。
- 使用真实 Meara 工作簿产物生成新版报告，运行治理验证器并检查 PDF 截图。

## 安全与治理

- 源工作簿保持只读。
- 动态文件名只来自验证后的 workbook identity。
- 禁止路径遍历、绝对路径重置、链接祖先和覆盖历史运行。
- manifest 保持最后发布。
- 新版报告必须同时包含 Markdown 和 PDF，且两个哈希都通过。
- Agent 仅输出最终验证通过的两个完整报告路径。

## 验收标准

1. 紫色标题与 `STEP 1/2/3` 在代表性 PDF 中均为同一行，无重叠或裁切。
2. `DOCUMENT OVERVIEW` 和 `WORKBOOK SUMMARY` 蓝色表头右上角均有可见圆弧。
3. 新运行目录包含动态命名的 Markdown/PDF，不包含 `Feature6-Report.md/.pdf`。
4. 新版 manifest 和 run summary 对动态文件名及实际字节验证通过。
5. 历史 v3 运行仍可只读验证。
6. Agent 成功输出提供两个完整绝对路径。
7. 构建、聚焦测试、ESLint、PDF E2E 和真实报告治理验证全部通过。
