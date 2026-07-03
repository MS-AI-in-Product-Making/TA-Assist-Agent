# System Architecture (V1)

> Surface T/VA Analysis Agent — V1 end-to-end system architecture.
> Scope: no drawing-content **image** reading, no 3D VA (see V2 backlog). Data-to-drawing linking in V1 is metadata-only via DIM ID.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph IN["1 Input Layer"]
        U["User<br/>PD / DM / ID / DFx / Supplier"]
        XLSX["T/VA report .xlsx<br/>(may contain multiple TA worksheets)"]
        U --> XLSX
    end
    subgraph SEL["2 Worksheet Selection & Confirmation (F1)"]
        S1["Scan all worksheets<br/>detect sheets containing TA content"]
        S2["Prompt user to confirm<br/>select worksheets for Agent interpretation"]
        S1 --> S2
    end
    subgraph EXT["3 Parse / Extract Layer (F1)"]
        P1["XLSX parser<br/>read factor table E14:T26"]
        P2["Image extractor<br/>export the Loop screenshot separately"]
        P3["Knowledge-base loader<br/>Part_Sub Required Dims"]
    end
    subgraph KB["4 Knowledge Base / References (F0 · 3 classes · the soul)"]
        KBA["Lib 1 Classified Capability Library<br/>reasonable tolerance band + process capability (source tiers T0-T3) + recommended distribution"]
        KBB["Lib 2 Engineering Rules Library<br/>CTS=6-sigma · CTF=4-sigma · Cpk&ge;1.33"]
        KBC["Lib 3 Terminology / Ontology Library<br/>part category · subsystem (ME/PCBA/Glass) · datum"]
    end
    subgraph LINK["5 DIM ID Anchor Layer (F3)"]
        L1["Anchor each factor to a drawing dimension<br/>DIM ID &lt;-&gt; factor &lt;-&gt; (future) measurement"]
        L2["Placeholder-first / backfill-later<br/>naming-convention governance"]
        L1 --> L2
    end
    subgraph ENG["6 Core Calculation Engine (F5 · 1D · strictly consistent with Excel)"]
        E0["Validate user-filled fields only<br/>nominal / tolerance / sigma / distribution"]
        E1["Auto-computed table<br/>Mean / Tol / 1-sigma / % contribution"]
        E2["System level: RSS sqrt(sum R^2) · Worst Case sum Q"]
        E3["Capability: Cp / Cpk / Z / DPM / Yield"]
        E0 --> E1 --> E2 --> E3
    end
    subgraph MODE["7 Output Modes"]
        M1["Prompt · Data cleansing (F2)<br/>missing-field check + DIM ID completeness<br/>vs Lib 1: tolerance range + distribution"]
        M2["Assign · Method recommendation (F4)<br/>recommend by factor count · both WC / RSS computed"]
        M3["Interpret · Objective 5-section (F6)<br/>FACT/RULE asserted (cite F0) · SIGNAL/OPTION presented<br/>uncertain -&gt; clarification card · judgment left to user"]
        M4["Optimize · What-if / reverse-solve / centering (F7)<br/>mean-shift + contribution economics + RSS apportionment<br/>over-capability -&gt; RED warning"]
    end
    subgraph LOOP["8 Closed Loop (F8)"]
        CL["Ingest measured yield / Cpk by DIM ID<br/>upgrade Lib 1 tier T3 -&gt; T1, recompute sigma"]
    end
    subgraph OUT["9 Interaction / Output (F9)"]
        O1["Read-only evidence pane<br/>faithful copy + Loop image"]
        O2["Cited dialogue<br/>click-to-highlight linkage"]
        O3["Structured TA interpretation report + Loop image<br/>reproducible · actionable · traceable"]
    end
    IN --> SEL --> EXT
    EXT --> LINK
    LINK --> ENG
    ENG --> MODE
    P3 --> KBA
    KBB --> ENG
    KBA -.-> M1
    KBB -.-> M2
    KBB -.-> M3
    KBC -.-> M3
    KBA -.-> M4
    MODE --> OUT
    M1 --> O1
    M3 --> O2
    M3 --> O3
    M4 --> O3
    OUT --> LOOP
    L1 -.-> CL
    CL ==>|"measured Cpk feeds back"| KBA
    classDef in fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef sel fill:#ede7f6,stroke:#5e35b1,color:#311b92
    classDef ext fill:#f3e5f5,stroke:#8e24aa,color:#4a148c
    classDef kb fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef link fill:#e8eaf6,stroke:#3949ab,color:#1a237e
    classDef eng fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef mode fill:#fce4ec,stroke:#c2185b,color:#880e4f
    classDef loop fill:#f1f8e9,stroke:#558b2f,color:#33691e
    classDef out fill:#e0f7fa,stroke:#00838f,color:#006064
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class U,XLSX in
    class S1 sel
    class S2 warn
    class P1,P2,P3 ext
    class KBA,KBB,KBC kb
    class L1,L2 link
    class E0,E1,E2,E3 eng
    class M1,M2,M3,M4 mode
    class CL loop
    class O1,O2,O3 out
```

## Layer Notes

| Layer | Feature | Responsibility | Key points |
|---|---|---|---|
| 1 Input | — | Receive the user-uploaded `.xlsx` | May contain multiple TA worksheets |
| 2 Worksheet selection | F1 | Auto-detect sheets with TA content, ask user to confirm | Manual fallback selection |
| 3 Parse / Extract | F1 | Read factor table, extract Loop screenshot, load knowledge base | Factor table region `E14:T26` |
| 4 Knowledge base (soul) | **F0** | Lib 1 Classified Capability + Lib 2 Engineering Rules + Lib 3 Terminology / Ontology | Human-curated; source tier / confidence; coverage published; **fed by F8** |
| 5 DIM ID anchor | **F3** | Link each factor to a drawing dimension via DIM ID | Metadata, not image reading; placeholder-first |
| 6 Core engine | F5 | 1D calculation, **strictly consistent with Excel formulas** | Validates user-filled fields only |
| 7 Output modes | F2/F4/F6/F7 | Cleansing / method / objective interpretation / optimization | Interpretation cites F0, judgment left to user; uncertain → clarification card |
| 8 Closed loop | **F8** | Ingest measured Cpk by DIM ID, feed back into F0 | V1 read-in side only; write-back to Excel is V2 |
| 9 Interaction / Output | **F9** | Read-only evidence pane + cited dialogue + structured report | Includes Loop image, per-item traceable, reproducible |

> **V2 backlog (out of scope this cycle):** Drawing-content **image** reading → three-way consistency check (user value ⇄ drawing ⇄ knowledge base); auto write-back of suggested spec to Excel.

---
**Related docs:** [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
