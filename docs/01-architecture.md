# System Architecture (V1) · 系统架构图

> Surface T/VA Analysis Agent — V1 端到端系统架构。
> 范围：不含图纸读取、不含 3D VA（见 V2 规划）。

## Architecture Diagram

```mermaid
flowchart TB
    subgraph IN["① 输入层"]
        U["用户<br/>PD / DM / ID / DFx / Supplier"]
        XLSX["T/VA 报告 .xlsx<br/>(可能含多个 TA worksheet)"]
        U --> XLSX
    end
    subgraph SEL["② Worksheet 选择确认"]
        S1["扫描所有 worksheet<br/>识别含 TA 内容的页"]
        S2["⚠ 提示用户确认<br/>选择需 Agent 解读的 worksheet"]
        S1 --> S2
    end
    subgraph EXT["③ 解析 / 抽取层"]
        P1["XLSX 解析器<br/>读取 factor 表 E14:T26"]
        P2["图片抽取器<br/>单独导出 Loop 截图"]
        P3["知识库加载器<br/>Part_Sub Required Dims"]
    end
    subgraph KB["④ 知识库 / 参考源"]
        KBA["按零件分类公差规格知识库<br/>(当前为 example，待拓展)<br/>标称 / 公差 / σ 范围 / 分布"]
        KBB["规则库<br/>CTS=6σ · CTF=4σ · Cpk≥1.33"]
    end
    subgraph ENG["⑤ 核心计算引擎 (1D · 与 Excel 公式严格一致)"]
        E0["仅校验用户填写项<br/>标称 / 公差 / σ / 分布"]
        E1["表格自动计算<br/>Mean / Tol / 1σ / %贡献度"]
        E2["系统级: RSS √ΣR² · Worst Case ΣQ"]
        E3["能力分析: Cp / Cpk / Z / DPM / Yield"]
        E0 --> E1 --> E2 --> E3
    end
    subgraph MODE["⑥ 输出模式（对齐 F2 / F3 / F5 · F6）"]
        M1["提示 · 数据清洗 (F2)<br/>①必填项缺失校验<br/>②对照分类规范库: 公差范围 + 分布合理性"]
        M2["分配 · 方法推荐 (F3)<br/>按 factor 数推荐目标公差参考<br/>WC / RSS 均计算并解读"]
        M3["解读 · 标准化 5 段式 (F5)<br/>①Loop合理性 ②能力vsSpec ③Top贡献者<br/>④结构级风险 ⑤决策 A/B/C"]
        M4["增值 · What-if & 居中 (F6)<br/>收紧件→Cpk 变化 · nominal 居中收益"]
    end
    subgraph OUT["⑦ 输出层 (F7)"]
        O1["审核确认提示<br/>差异高亮"]
        O2["方法建议 + 目标公差参考"]
        O3["结构化 TA 解读报告 + Loop 图<br/>可复现 · 可执行工程决策"]
    end
    IN --> SEL --> EXT
    EXT --> ENG
    ENG --> MODE
    P3 --> KBA
    KBB --> ENG
    KBA -.-> M1
    KBB -.-> M2
    KBB -.-> M3
    M1 --> O1
    M2 --> O2
    M3 --> O3
    M4 --> O3
    classDef in fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef sel fill:#ede7f6,stroke:#5e35b1,color:#311b92
    classDef ext fill:#f3e5f5,stroke:#8e24aa,color:#4a148c
    classDef kb fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef eng fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef mode fill:#fce4ec,stroke:#c2185b,color:#880e4f
    classDef out fill:#e0f7fa,stroke:#00838f,color:#006064
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class U,XLSX in
    class S1 sel
    class S2 warn
    class P1,P2,P3 ext
    class KBA,KBB kb
    class E0,E1,E2,E3 eng
    class M1,M2,M3,M4 mode
    class O1,O2,O3 out
```

## Layer Notes · 分层说明

| 层 | 职责 | 关键点 |
|---|---|---|
| ① 输入层 | 接收用户上传的 `.xlsx` | 可能含多个 TA worksheet |
| ② Worksheet 选择确认 | 自动识别含 TA 内容的页，提示用户确认 | 兜底人工选择 |
| ③ 解析 / 抽取层 | 读取 factor 表、抽取 Loop 截图、加载知识库 | factor 表区域 `E14:T26` |
| ④ 知识库 / 参考源 | 按零件分类规范库 + 规则库 | 规范库当前为 example，待拓展 |
| ⑤ 核心计算引擎 | 1D 计算，**与 Excel 公式严格一致** | 仅校验用户填写项，自动量不重算 |
| ⑥ 输出模式 | F2 清洗 / F3 方法推荐 / F5 解读 / F6 增值 | 对齐功能分解 |
| ⑦ 输出层 | 审核提示 / 方法建议 / 结构化解读报告 | 含 Loop 图，可复现可执行 |

> **V2 规划（本期不做）：** 图纸信息读取 → 三方一致性比对（用户值 ⇄ 图纸 ⇄ 知识库）。

---
**相关文档：** [端到端流程图](02-end-to-end-flow.md) · [差异化对比](03-differentiation.md) · [功能分解](04-feature-breakdown.md)
