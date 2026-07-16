# System Architecture (V1)

> V1 end-to-end architecture of the Surface TA Analysis Agent.
> Scope: no drawing image recognition and no 3D VA for now. Data-to-drawing linking is done through DIM ID.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph IN["1 Input Layer"]
        U["User<br/>PD / DM / ID / DFx / Supplier"]
        XLSX["TA report .xlsx<br/>(may contain multiple TA worksheets)"]
        U --> XLSX
    end
    subgraph SEL["2 Worksheet Selection & Confirmation (F1)"]
        SEL1["Scan all worksheets<br/>detect sheets containing TA content"]
        SEL2["Prompt user to confirm<br/>select worksheets for Agent interpretation"]
        SEL1 --> SEL2
    end
    subgraph EXT["3 Parse / Extract Layer (F1)"]
        P1["XLSX parser<br/>read factor table E14:T26"]
        P2["Image extractor<br/>export the Loop screenshot separately"]
        P3["Knowledge-base loader<br/>Part_Sub Required Dims"]
    end
    subgraph KB["4 Knowledge Base / References (F0 · 3 classes)"]
        KBA["Lib 1 Classified Capability Library<br/>reasonable tolerance band + process capability (source tiers T0-T3) + recommended distribution"]
        KBB["Lib 2 Engineering Rules Library<br/>CTS=6-sigma · CTF=4-sigma · Cpk&ge;1.33"]
        KBC["Lib 3 Terminology / Ontology Library<br/>part category · subsystem (ME/PCBA/Glass) · datum"]
    end
    subgraph LINK["5 DIM ID Anchor + Active Drawing Loop (F3)"]
        L1["Anchor each factor to a drawing dimension<br/>DIM ID &lt;-&gt; factor &lt;-&gt; (future) measurement"]
        L2["Placeholder-first / backfill-later<br/>MS &lt;-&gt; supplier ID alias / crosswalk"]
        L3["Dimension-chain list per part<br/>part name / join number / DIM ID"]
        L1 --> L2 --> L3
    end
    subgraph ORCH["5b Optional ADO Governance (F3 · shared substrate)"]
        G1["Optional ADO work item<br/>manual .xlsx upload starts analysis<br/>when linked, resolve owner from ADO owner / Request By"]
        G2["Server-side scheduled service (weekly / monthly)<br/>surface-mcp GetProgramMilestones + workiq"]
        G3["Before key milestone (e.g. EV1) with missing DIM ID<br/>@mention owner on ADO · remind: put chain on drawing"]
        G2 --> G3
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
        CL["Ingest measured yield / Cpk by DIM ID<br/>manual import from centralized store (SharePoint / platform)<br/>real gap vs initial estimate · upgrade Lib 1 T3 -&gt; T1"]
    end
    subgraph OUT["9 Interaction / Output (F9)"]
        O1["Read-only evidence pane<br/>faithful copy + Loop image"]
        O2["Cited dialogue<br/>click-to-highlight linkage"]
        O3["Structured TA interpretation report + Loop image<br/>reproducible · actionable · traceable"]
    end
    IN --> SEL --> EXT
    EXT --> LINK
    LINK --> ENG
    G1 --> SEL
    L3 -.-> G3
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
    CL -.->|"deviation -> adjustment"| M4
    classDef in fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef sel fill:#ede7f6,stroke:#5e35b1,color:#311b92
    classDef ext fill:#f3e5f5,stroke:#8e24aa,color:#4a148c
    classDef kb fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef link fill:#e8eaf6,stroke:#3949ab,color:#1a237e
    classDef orch fill:#fff8e1,stroke:#f9a825,color:#f57f17
    classDef eng fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef mode fill:#fce4ec,stroke:#c2185b,color:#880e4f
    classDef loop fill:#f1f8e9,stroke:#558b2f,color:#33691e
    classDef out fill:#e0f7fa,stroke:#00838f,color:#006064
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class U,XLSX in
    class SEL1 sel
    class SEL2 warn
    class P1,P2,P3 ext
    class KBA,KBB,KBC kb
    class L1,L2,L3 link
    class G1,G2,G3 orch
    class E0,E1,E2,E3 eng
    class M1,M2,M3,M4 mode
    class CL loop
    class O1,O2,O3 out
```

## Layer Notes

| Layer | User Story | Responsibility | Key points |
|---|---|---|---|
| 1 Input | — | Receive the user-uploaded `.xlsx` | May contain multiple TA worksheets |
| 2 Worksheet selection | F1 | Auto-detect worksheets with TA content and ask the user to confirm | Manual selection as a fallback |
| 3 Parse & extract | F1 | Read the factor table, extract the Loop screenshot, load the knowledge base | Factor table region is `E14:T26` |
| 4 Knowledge base | **F0** | Capability Library (Lib 1), Rules Library (Lib 2), Terminology Library (Lib 3) | Human-maintained; each entry carries source, confidence, and coverage; fed back by F8 |
| 5 DIM ID linking | **F3** | Link each factor to a drawing dimension via DIM ID and output a per-part dimension-chain list | Identifier-only linking, no image recognition; placeholder first, backfill later; grouped by category; locatable to the exact position |
| 5b ADO governance | **F3** | Optional ADO task link, owner assignment, server-side scheduled reminders, drawing reminders | Manual upload starts analysis; when ADO is linked, reminders use `surface-mcp` milestones and `workiq`, independent of the analysis |
| 6 Calculation engine | F5 | One-dimensional calculation, fully consistent with Excel formulas | Validates only user-filled fields |
| 7 Output modes | F2/F4/F6/F7 | Cleansing, method recommendation, objective interpretation, optimization | Interpretation must cite knowledge-base evidence; judgment left to the user; raises a clarification card when in doubt |
| 8 Closed loop | **F8** | Backfill measured Cpk by DIM ID, compare the real gap, and feed back into F0 | Manual import from a centralized store (SharePoint / platform) at first; auto-capture and write-back come later |
| 9 Interaction & output | **F9** | Read-only evidence pane, citable dialogue, structured report | Includes the Loop image; traceable and reproducible item by item |

> **Out of scope for now (may be merged into V1 later):** drawing image recognition and three-way consistency checks (user-filled values, drawing, knowledge base); automatic capture of measured data; automatically writing suggested specs back into Excel.

---
**Related docs:** [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
