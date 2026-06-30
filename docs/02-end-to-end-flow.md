# End-to-End Flow (V1) · 端到端流程图

> 从用户上传 `.xlsx` 到产出结构化解读报告的完整运行时流程。
> 节点标签中的 `(Fx)` 对应[功能分解](04-feature-breakdown.md)中的 Feature 编号。

## Flow Chart

```mermaid
flowchart TD
    A["用户上传 .xlsx 报告"] --> A1["扫描多个 worksheet<br/>识别含 TA 内容的页"]
    A1 --> A2{"⚠ 用户确认<br/>选择需做 TA 分析的 worksheet"}
    A2 --> B["逐个解析选中 worksheet<br/>读取用户填写的 factor 规范"]
    B --> C["抽取尺寸链 Loop 截图"]
    C --> D{"模式 1：数据清洗 (F2)<br/>①必填项缺失校验<br/>②分类规范库: 公差范围+分布"}
    D --> E{"是否一致?"}
    E -->|"不一致"| E1["⚠ 标记差异<br/>提示用户审核并确认"]
    E1 --> E2{"如何处理差异?"}
    E2 -->|"用户自行修改 Excel"| E3a["用户更新表格后重新上传"]
    E2 -->|"Agent 修改数据并重算"| E3b["Agent 调整数据<br/>重新分析"]
    E3a --> F
    E3b --> F
    E -->|"一致"| F["进入方法推荐"]
    F --> G{"模式 2：方法推荐 (F3)<br/>按 factor 数量推荐<br/>最合适的公差定义方法"}
    G -->|"&lt; 4 factors"| H1["推荐 Worst Case 法<br/>ΣTolerance"]
    G -->|"4 – 10 factors"| H2["推荐 1D RSS 统计法<br/>√ΣR²"]
    G -->|"&gt; 10 factors"| H3["建议 3D VA<br/>(V1不开发→提示转 DM 团队)"]
    H1 --> I["核心引擎计算<br/>(WC 与 RSS 均输出结果)"]
    H2 --> I
    I --> J["能力分析<br/>Cp · Cpk · Z · DPM · Yield"]
    J --> K{"目标判定<br/>Cpk≥1.33 / σ达标?"}
    K -->|"PASS"| L["模式 3：标准化解读 (F5)"]
    K -->|"FAIL"| L
    L --> M1["① Loop 合理性<br/>闭环/datum/方向"]
    L --> M2["② 能力 vs Spec<br/>Cpk 判定 · 6σ 可行性"]
    L --> M3["③ Top 贡献者<br/>排序 + 原因"]
    L --> M4["④ 结构级风险<br/>跨体系/非几何/长stack"]
    L --> M5["⑤ 决策建议<br/>A保持/B调Spec/C优化 · CTS/CTF"]
    L --> M6["What-if 敏感度 + 均值居中 (F6)<br/>收紧件→Cpk变化 · nominal居中收益"]
    M1 & M2 & M3 & M4 & M5 & M6 --> N["结构化 TA 解读报告 + Loop 图 (F7)<br/>可复现 · 可执行工程决策"]
    H3 --> N
    classDef start fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef proc fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef dec fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    classDef v2 fill:#fffde7,stroke:#f9a825,color:#f57f17
    classDef done fill:#c8e6c9,stroke:#2e7d32,color:#1b5e20
    class A,B,C start
    class A2,D,E,E2,G,K dec
    class A1 proc
    class F,H1,H2,I,J,L,M1,M2,M3,M4,M5,M6,E3a,E3b proc
    class E1 warn
    class H3 v2
    class N done
```

## Key Decision Points · 关键判定

| 节点 | 判定 | 分支 |
|---|---|---|
| Worksheet 确认 | 哪些页需解读 | 用户确认 / 兜底人工选择 |
| 数据清洗一致性 | 必填项 + 分类规范库匹配 | 一致 → 继续；不一致 → 标记差异 |
| 差异处理 | 由谁修正 | 用户改 Excel / Agent 改数据重算 |
| 方法推荐 | factor 数量 | `<4` WC · `4–10` RSS · `>10` 转 DM |
| 目标判定 | Cpk≥1.33 / σ 达标 | PASS / FAIL 均进入解读 |

> 多页报告可**并行加速处理**，但审核仍逐页人工把关。

---
**相关文档：** [系统架构图](01-architecture.md) · [差异化对比](03-differentiation.md) · [功能分解](04-feature-breakdown.md)
