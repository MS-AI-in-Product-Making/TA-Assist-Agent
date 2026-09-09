# System Architecture (V1)

> V1 end-to-end architecture of AI Assist Agent.
> Scope: no extraction of drawing truth and no 3D VA for now. F5 may record review-gated observations from F1-owned images, but data-to-drawing linking remains anchored by DIM ID.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph IN["1 Input Layer"]
        U["User<br/>PD / DM / ID / DFx / Supplier"]
        XLSX["One or more TA .xlsx files<br/>manual upload · unique file names"]
        U --> XLSX
    end
    subgraph SEL["2 Worksheet Selection & Confirmation (F1)"]
        SEL1["Scan all worksheets<br/>detect sheets containing TA content"]
        SEL2["Prompt user to confirm<br/>select worksheets for Agent interpretation"]
        SEL1 --> SEL2
    end
    subgraph EXT["3 Parse / Extract Layer (F1)"]
        P1["XLSX parser<br/>read factor tables and retain normalized JSON + processing trace"]
        P2["Image extractor<br/>export Loop screenshots with source labels and version"]
        P3["Knowledge-base loader<br/>Part_Sub Required Dims"]
    end
    subgraph KB["4 Knowledge Base / References (F0 · 3 classes)"]
        KBA["Lib 1 Classified Capability Library<br/>reasonable tolerance band + process capability (source tiers T0-T3) + recommended distribution"]
        KBB["Lib 2 Engineering Rules Library<br/>CTS=6-sigma · CTF=4-sigma · Cpk&ge;1.33"]
        KBC["Lib 3 Terminology / Ontology Library<br/>part category · subsystem (ME/PCBA/Glass) · datum"]
    end
    subgraph LINK["5 DIM ID Anchor + Active Drawing Loop (F3)"]
        L1["Anchor each factor to a drawing dimension<br/>DIM ID &lt;-&gt; factor &lt;-&gt; (future) measurement"]
        L2["Validate DIM ID / PN completeness<br/>missing IDs are governed after Lib 3 grouping"]
        L3["Dimension-chain list by Lib 3 category / drawing<br/>part name / join number / DIM ID / exact location"]
        L1 --> L2 --> L3
    end
    subgraph ORCH["9b Post-Report Optional ADO Governance (F3 · shared substrate)"]
        G1["Optional ADO work item after F6 report validation<br/>when linked, resolve owner from ADO owner / Request By"]
        G2["Surface MCP capability gate<br/>read work item and Comment 0<br/>resolve Owner, then Request By"]
        G3["For grouped governance items<br/>prepare diff · user confirms · update Comment 0<br/>without ADO/capability, save the same list locally"]
        G2 --> G3
    end
    subgraph ENG["6 Core Calculation Engine (F4 · 1D · strictly consistent with Excel)"]
        E0["Validated, user-filled analysis inputs<br/>nominal / tolerance / safety factor / sigma / distribution"]
        E1["Auto-computed table<br/>Mean / Tol / 1-sigma / % contribution"]
        E2["System level: RSS sqrt(sum R^2) · Worst Case sum Q"]
        E3["Capability: Cp / Cpk / Z / DPM / Yield"]
        E0 --> E1 --> E2 --> E3
    end
    subgraph MODE["7 Output Modes"]
        M1["Prompt · Data cleansing (F2)<br/>required-field check + DIM ID/PN completeness<br/>vs Lib 1: tolerance range + distribution"]
        M2["Assign · Method recommendation (F4)<br/>&lt;4 WC · 4-10 RSS · &gt;10 notify DM for 3D VA<br/>both WC / RSS computed"]
        M3["Interpret · Sections 1-3 (F5)<br/>loop validity · capability vs specification · top contributors<br/>FACT/RULE cite F0 · SIGNAL/OPTION remain governed"]
        M4["Optimize after F5 (F6)<br/>deterministic options · reverse solve · RSS apportionment<br/>feasibility · impact ranking · final report"]
    end
    subgraph LOOP["8 Closed Loop (F7)"]
        CL["Ingest measured yield / Cpk by DIM ID<br/>manual import from centralized store (SharePoint / platform)<br/>real gap vs initial estimate · upgrade Lib 1 T3 -&gt; T1"]
    end
    subgraph OUT["9 Interaction / Output (F8)"]
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
    M4 --> G1
    L3 -.-> G2
    G3 --> OUT
    MODE --> OUT
    M1 --> O1
    M3 --> O2
    M3 --> O3
    M4 --> O3
    OUT --> LOOP
    L1 -.-> CL
    CL -->|measured Cpk feeds back| KBA
    CL -->|deviation to adjustment| M4
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

| Layer | Feature | Responsibility | Key points |
|---|---|---|---|
| 1 Input | — | Receive one or more manually uploaded `.xlsx` files | File names must be unique; files may contain multiple TA worksheets |
| 2 Worksheet selection | F1 | Auto-detect worksheets with TA content and ask the user to confirm | Manual selection as a fallback |
| 3 Parse & extract | F1 | Read factor tables, extract Loop screenshots, and load the knowledge base | Retain normalized JSON, source labels, version, and processing trace |
| 4 Knowledge base | **F0** | Capability Library (Lib 1), Rules Library (Lib 2), Terminology Library (Lib 3) | Human-maintained; each entry carries source, confidence, and coverage; fed back by F7 |
| 5 DIM ID linking | **F3** | Link each factor to a drawing dimension and produce a drawing-governance list | Part Number currently equals Drawing Number. The formal key is `(Drawing Number, DIM ID)`; the same DIM ID may occur on different drawings, while duplicates on one drawing are conflicts. A one-digit numeric DIM ID is `suspected_invalid` and does not block TA. |
| 9b Post-report ADO governance | **F3** | Optional ADO link, owner assignment, Comment 0 update, and local-list fallback after F6 report validation | Every validated F3 result reaches this gate only after F6. It uses only Surface MCP and every write follows `prepare -> confirm -> execute`; without ADO or required capabilities, the same confidential list is saved locally and TA continues to review. F3 does not read dates, evaluate deadline proximity, or run a scheduler. |
| 6 Calculation engine | F4 | One-dimensional calculation, fully consistent with Excel formulas | Validates only user-filled fields |
| 7 Output modes | F2/F4/F5/F6 | Cleansing, method recommendation, objective interpretation, and governed optimization | `<4` recommends WC; `4-10` recommends RSS; `>10` notifies DM for 3D VA while the engine still computes WC/RSS. F5 owns baseline evidence and delegates its last two sections; F6 owns options, reverse solve, RSS apportionment, feasibility, impact ranking, and the final report. |
| 8 Closed loop | **F7** | Backfill measured Cpk by DIM ID, compare the real gap, and feed back into F0 | Manual import from a centralized store (SharePoint / platform) at first; auto-capture and write-back come later |
| 9 Interaction & output | **F8** | Read-only evidence pane, citable dialogue, structured report | Includes the Loop image; traceable and reproducible item by item |

### F8 Workbench Runtime

F8 is a confidential local application composed of a loopback Fastify server, transactional SessionStore/ConversationStore, a React workbench, CLI Agent entry points, and the VS Code `@ta-assist` participant. Web, CLI, and VS Code share only TA Assist-owned turns and session state; native Copilot history is temporary request context and is never imported. Browser commands use cookie/CSRF, while the Extension Host uses action-scoped credentials issued over local Node IPC.

The source workbook and governed F0-F6 artifacts remain immutable. One worksheet-scoped What-if Draft may call the F4 kernel; only tolerance changes can be promoted through `f6-optimization-targets-v1`. F4-F6 complete before Surface ADO begins; ADO remains `validate -> independent write`, and a terminal publish or local-only outcome proceeds to review. F7 remains an unavailable placeholder with no measured result controls.

### F5 and F6 governance boundary

F5 directly consumes controlled F0/F1/F3/F4 artifacts; a workbook-started run must first pass the F2 handoff gate. It owns baseline `FACT`/`RULE`/`SIGNAL`, clarifications, and optional v2 image evidence, while retaining v1 read-only compatibility. Sections 4 and 5 remain `delegated_to_f6` in the detailed F5 report.

F6 then binds exact F2/F3/F4/F5 roots and selected worksheets. It generates target-driven scenarios only from caller-authorized targets, review-gated mean centering, target-Cpk reverse solves, four governed RSS allocation policies, feasibility, Highest Impact, and cost-gated ROI. Supplier, datum, or cost claims without bound evidence remain `insufficient_evidence`; ROI is computed only when every supported ranked option has known positive governed cost. F6 atomically publishes `Feature6-Report.md`, `Feature6-Optimization.json/.md`, `Feature6-Run-Summary.json`, and `manifest.json`; Run Summary owns structured Workbook/Worksheet dispositions, and blocked worksheets appear only in workbook Input Validation.

The direct CLI and trusted app CLI publish six run-scoped artifacts under the controlled publish root. All artifacts are `confidential`; inputs stay read-only, with no ADO, network, or workbook write. Schema, workbook/worksheet association, identity/hash, staging boundary, atomic rename, and committed-file identity gates fail closed. The legacy comparison placeholder remains `feature_not_available` as a separate compatibility API; the governed optimization workflow is `available` per the [Feature Register](governance/feature-register.md).

> **Out of scope for now:** automatic extraction of drawing truth, DM-owned 3D variation analysis, automatic capture of measured data, and automatically writing suggested specs back into Excel.

---
**Related docs:** [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
