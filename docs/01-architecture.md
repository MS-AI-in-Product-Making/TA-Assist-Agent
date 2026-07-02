# System Architecture (V1)

> Surface T/VA Analysis Agent — V1 end-to-end system architecture.
> Scope: no drawing-content reading, no 3D VA (see V2 backlog).

## Architecture Diagram

```mermaid
flowchart TB
    subgraph IN["1 Input Layer"]
        U["User<br/>PD / DM / ID / DFx / Supplier"]
        XLSX["T/VA report .xlsx<br/>(may contain multiple TA worksheets)"]
        U --> XLSX
    end
    subgraph SEL["2 Worksheet Selection & Confirmation"]
        S1["Scan all worksheets<br/>detect sheets containing TA content"]
        S2["Prompt user to confirm<br/>select worksheets for Agent interpretation"]
        S1 --> S2
    end
    subgraph EXT["3 Parse / Extract Layer"]
        P1["XLSX parser<br/>read factor table E14:T26"]
        P2["Image extractor<br/>export the Loop screenshot separately"]
        P3["Knowledge-base loader<br/>Part_Sub Required Dims"]
    end
    subgraph KB["4 Knowledge Base / References (3 classes, controlled curation)"]
        KBA["Lib 1 Classified Capability Library<br/>reasonable tolerance band + process capability (source tiers T0-T3) + recommended distribution"]
        KBB["Lib 2 Engineering Rules Library<br/>CTS=6-sigma · CTF=4-sigma · Cpk&ge;1.33"]
        KBC["Lib 3 Terminology / Ontology Library<br/>part category · subsystem (ME/PCBA/Glass) · datum"]
    end
    subgraph ENG["5 Core Calculation Engine (1D, strictly consistent with Excel formulas)"]
        E0["Validate user-filled fields only<br/>nominal / tolerance / sigma / distribution"]
        E1["Auto-computed table<br/>Mean / Tol / 1-sigma / % contribution"]
        E2["System level: RSS sqrt(sum R^2) · Worst Case sum Q"]
        E3["Capability: Cp / Cpk / Z / DPM / Yield"]
        E0 --> E1 --> E2 --> E3
    end
    subgraph MODE["6 Output Modes (aligned with F2 / F3 / F5 · F6)"]
        M1["Prompt · Data cleansing (F2)<br/>1 missing required-field check<br/>2 vs Lib 1: tolerance range + distribution, flag in-library / out-of-library (evidenced)"]
        M2["Assign · Method recommendation (F3)<br/>recommend target-tolerance reference by factor count<br/>both WC / RSS computed and interpreted"]
        M3["Interpret · Objective 5-section (F5)<br/>FACT/RULE asserted · SIGNAL/OPTION presented<br/>uncertain -&gt; clarification card (assembly datum face) · judgment left to user"]
        M4["Value-add · What-if / Spec reverse-solve / centering (F6)<br/>2-3 parallel reverse-solve options · over-capability -&gt; RED warning"]
    end
    subgraph OUT["7 Output Layer (F7)"]
        O1["Review-confirmation prompt<br/>difference highlighting"]
        O2["Method recommendation + target-tolerance reference"]
        O3["Structured TA interpretation report + Loop image<br/>reproducible · actionable engineering decisions"]
    end
    IN --> SEL --> EXT
    EXT --> ENG
    ENG --> MODE
    P3 --> KBA
    KBB --> ENG
    KBA -.-> M1
    KBB -.-> M2
    KBB -.-> M3
    KBC -.-> M3
    KBA -.-> M4
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
    class KBA,KBB,KBC kb
    class E0,E1,E2,E3 eng
    class M1,M2,M3,M4 mode
    class O1,O2,O3 out
```

## Layer Notes

| Layer | Responsibility | Key points |
|---|---|---|
| 1 Input | Receive the user-uploaded `.xlsx` | May contain multiple TA worksheets |
| 2 Worksheet selection | Auto-detect sheets with TA content, ask user to confirm | Manual fallback selection |
| 3 Parse / Extract | Read factor table, extract Loop screenshot, load knowledge base | Factor table region `E14:T26` |
| 4 Knowledge base | Lib 1 Classified Capability Library + Lib 2 Engineering Rules Library + Lib 3 Terminology / Ontology Library | Human-curated; entries carry source tier / confidence; coverage published |
| 5 Core engine | 1D calculation, **strictly consistent with Excel formulas** | Validates user-filled fields only; auto-computed quantities not recomputed |
| 6 Output modes | F2 cleansing / F3 method recommendation / F5 objective interpretation / F6 value-add reverse-solve | Interpretation only states evidence, judgment left to user; uncertain -> clarification card |
| 7 Output | Review prompt / method recommendation / structured interpretation report | Includes Loop image, per-item traceable, reproducible |

> **V2 backlog (out of scope this cycle):** Drawing-content reading -> three-way consistency check (user value ⇄ drawing ⇄ knowledge base); closed-loop knowledge-base feedback (feed measured Cpk back into Lib 1).

---
**Related docs:** [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
