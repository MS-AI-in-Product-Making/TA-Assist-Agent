# Feature 1 单工作簿独立输出设计

## 目标

单工作簿命令仍使用现有入口：

```powershell
npm run workflow:f1 -- "test/Mauna_Loa_TP_Step_20260611.xlsx"
```

但输出不再写入共享的 `test/demo-output/feature1-validation`，而是写入按工作簿名隔离的固定目录：

```text
test/demo-output/feature1-output/Mauna_Loa_TP_Step_20260611/
```

该目录包含本次完整 Feature 1 Task 1.1 至 1.6 结果，避免与历史批量验证报告混放。

## 输出布局

单工作簿模式生成：

```text
Feature1-Report.md
Feature1-Report.json
sheets/
_tmp/
```

每次运行前只清理目标工作簿对应的生成目录，确保目录内没有上一次运行遗留的报告、工作表或图片。不得清理其他工作簿目录，也不得清理共享批量验证目录。

无命令行工作簿参数时维持当前批量验证行为：输出继续写入 `test/demo-output/feature1-validation`，保留带时间戳报告和 `latest.md`、`latest.json`。

## 实现边界

- 提取纯输出布局解析函数，根据是否存在单工作簿参数返回运行模式、输出根目录和报告文件名。
- 主工作流使用解析后的路径创建报告、逐表 JSON/Markdown、图片和临时捕获文件。
- 工作簿解析、worksheet 发现、因子表抽取、实际值/显示值双轨标记及图片链接行为保持不变。
- 控制台仅打印当前模式真实生成的报告路径。

## 错误与清理

- 单工作簿路径不存在时沿用现有失败行为，不创建伪成功报告。
- 清理范围必须由固定的 `feature1-output` 根目录和安全化工作簿名共同确定。
- 工作簿名为空或无法安全化时明确失败，不允许清理输出根目录本身。

## 测试与验收

- 单元测试证明批量模式仍使用 `feature1-validation` 及原报告命名。
- 单元测试证明单工作簿模式使用 `feature1-output/<工作簿名>` 及固定报告命名。
- 单元测试证明扩展名被移除，文件名中的非法路径字符被安全化。
- 实际运行 Mauna Loa 工作簿，确认命令退出码为 0。
- 确认独立目录包含完整报告、8 个 worksheet 输出及相关图片。
- 确认共享 `feature1-validation/latest.*` 未被本次单工作簿运行覆盖。

## 非目标

- 不删除或迁移已有历史验证结果。
- 不增加自定义 `--output-dir` 参数。
- 不改变报告数据契约和 Feature 1 计算结果。