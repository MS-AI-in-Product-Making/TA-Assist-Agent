# Feature 1 单报告命令行输入设计

## 目标

允许调用者向 `scripts/run-f1-full-validation.mjs` 传入一个 Excel 报告路径，仅对该报告执行现有 Feature 1 Task 1.1 至 1.6 流程。未传入路径时，继续执行当前三份默认样例，保持现有行为兼容。

目标报告为 `test/Maera_cosmetic_critical_TA - Rev E_0110.xlsx`。

## 设计

从脚本中提取一个纯函数，根据命令行参数和默认 job 列表生成本次执行的 job 列表：

- 有一个路径参数时，生成只包含该路径的单个 job，不继承样例报告的 worksheet manifest。
- 无参数时，返回当前默认 job 列表。
- 多于一个路径参数时明确失败，避免调用语义含糊。
- 后续文件存在性筛选、Feature 1 解析、图片导出和 Markdown/JSON 输出逻辑保持不变。

命令形式：

```powershell
npm run workflow:f1 -- "test/Maera_cosmetic_critical_TA - Rev E_0110.xlsx"
```

## 错误处理

- 路径不存在时沿用现有 `No configured workbook exists for Feature 1 workflow.` 失败行为。
- 参数过多时返回清晰的单文件参数错误，不启动解析。
- Excel 解析和 worksheet 处理错误继续由现有 Feature 1 流程记录或抛出。

## 测试与验收

- 单元测试证明无参数时保留默认 jobs。
- 单元测试证明传入一个路径时只生成该报告的 job。
- 单元测试证明多个路径参数被拒绝。
- 执行目标命令，确认退出码为 0。
- 检查 `test/demo-output/feature1-validation/latest.json` 仅包含目标报告，并汇总 worksheet、factor table、factor row、formula、image 和 composed snapshot 结果。

## 非目标

- 不改变 Feature 1 的工作簿解析算法、字段契约或输出格式。
- 不新增多文件 CLI 批处理语法。
- 不把目标报告加入默认样例列表。