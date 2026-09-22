# System Architecture (Current)

> Current end-to-end architecture for TA Assist Agent after F8 and participant retirement.
> Supported product entry uses Copilot Skills or direct governed workflow scripts; no Workbench runtime or participant surface is required.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph IN["1 Input Layer"]
        U["User / Engineer"]
        XLSX["One or more TA .xlsx files\nmanual selection · unique file names"]
        U --> XLSX
    end
    subgraph ENTRY["2 Product Entry Surfaces"]
        S1["Copilot Skills\nta-assist-agent · design-optimization\nresult-interpretation · drawing-governance\nta-real-measurement-analysis · pdf-report-export"]
        S2["Direct governed workflows\nworkflow:f2:excel · workflow:f3 · workflow:f4\nworkflow:f5 · workflow:f6 · dev:f7:api · dev:f7:web"]
        S1 --> S2
    end
    subgraph EXT["3 Parse / Extract Layer (F1)"]
        P1["XLSX parser\nread factor tables and retain normalized JSON + processing trace"]
        P2["Image extractor\nexport Loop screenshots with source labels and version"]
        P3["Knowledge-base loader\nPart_Sub Required Dims"]
    end
    subgraph KB["4 Knowledge Base / References (F0 · 3 classes)"]
        KBA["Lib 1 Capability Library\nreasonable tolerance band + process capability + distribution"]
        KBB["Lib 2 Engineering Rules Library\nCTS=6-sigma · CTF=4-sigma · Cpk≥1.33"]
        KBC["Lib 3 Terminology / Ontology Library\npart category · subsystem · datum"]
    end
    subgraph GOV["5 Drawing Governance (F3)"]
        L1["Anchor each factor to a drawing dimension\n(Drawing Number, DIM ID)"]
        L2["Validate DIM ID / PN completeness\nflag but do not over-block TA"]
        L3["Prepare optional ADO publishing list\nor local-only fallback"]
        L1 --> L2 --> L3
    end
    subgraph ENG["6 Core Calculation Engine (F4)"]
        E1["Validated worksheet inputs"]
        E2["Excel-consistent factor and system metrics"]
        E3["Cp / Cpk / Z / DPM / Yield"]
        E1 --> E2 --> E3
    end
    subgraph INTERP["7 Interpretation And Optimization"]
        M1["F5 objective interpretation\nFACT / RULE / SIGNAL / OPTION"]
        M2["F6 design optimization\nadjusted mean shift · contributor ranking\nspecification proposals · final report"]
        M1 --> M2
    end
    subgraph OUT["8 Published Outputs"]
        O1["Validated Markdown and PDF engineering reports"]
        O2["Structured governance artifacts\nJSON summaries · manifests · reminders"]
    end
    subgraph LOOP["9 Measured Feedback (F7)"]
        CL["Measured samples and capability review\nmanual import / F7 apps / governed follow-up"]
    end

    IN --> ENTRY --> EXT
    EXT --> GOV --> ENG --> INTERP --> OUT --> LOOP
    P3 --> KBA
    KBA -.-> EXT
    KBA -.-> INTERP
    KBB -.-> ENG
    KBB -.-> INTERP
    KBC -.-> GOV
    LOOP -->|measured evidence| KBA
```

## Layer Notes

| Layer | Capability | Responsibility | Key points |
|---|---|---|---|
| 1 Input | — | Receive one or more manually provided `.xlsx` files | File names must be unique; files may contain multiple TA worksheets |
| 2 Entry surfaces | Skills + workflows | Start the governed product flow or a direct engineering phase | Supported product entry is Copilot Skills plus direct workflow scripts |
| 3 Parse & extract | F1 | Read factor tables, extract Loop screenshots, and retain worksheet evidence | Preserve normalized JSON, source labels, version, and processing trace |
| 4 Knowledge base | F0 | Capability, rules, and terminology libraries | Human-maintained; versioned; read-only during analysis |
| 5 Drawing governance | F3 | Link each factor to drawing evidence and manage optional ADO publication | Formal key is `(Drawing Number, DIM ID)`; missing IDs stay visible without rewriting workbook data |
| 6 Calculation engine | F4 | One-dimensional calculation fully consistent with Excel formulas | Validates only user-filled fields; computes both WC and RSS where in scope |
| 7 Interpretation and optimization | F5 / F6 | Governed interpretation, clarification gates, and optimization options | F5 owns baseline evidence; F6 owns ranked improvement outputs and final report publication |
| 8 Published outputs | Reports + artifacts | Publish validated Markdown/PDF plus governed summaries and manifests | Inputs remain read-only; fail-closed validation stays in place |
| 9 Measured feedback | F7 | Backfill measured capability by DIM ID and compare against baseline | Remains a separate follow-up workflow and application surface |

## Product Entry Surfaces

- **Complete workbook product run:** `ta-assist-agent` skill, which delegates to `design-optimization` and `pdf-report-export`.
- **Capability-specific skill entry:** `result-interpretation`, `drawing-governance`, `ta-real-measurement-analysis`, and related governed skills.
- **Direct engineering entry:** deterministic `workflow:f2:excel`, `workflow:f3`, `workflow:f4`, `workflow:f5`, `workflow:f6`, and the independent F7 applications.

No active documentation path requires a retired participant or F8 runtime.

## F5 and F6 Governance Boundary

F5 directly consumes controlled F0/F1/F3/F4 artifacts; a workbook-started run must first pass the F2 handoff gate. It owns baseline `FACT`/`RULE`/`SIGNAL`, clarifications, and optional v2 image evidence while retaining v1 read-only compatibility. Sections 4 and 5 remain `delegated_to_f6` in the detailed F5 report.

F6 then binds exact F2/F3/F4/F5 roots and selected worksheets. It generates target-driven scenarios only from caller-authorized targets, review-gated mean centering, target-Cpk reverse solves, governed RSS allocation policies, feasibility, impact ranking, and cost-gated ROI. Supplier, datum, or cost claims without bound evidence remain `insufficient_evidence`. F6 atomically publishes `Feature6-Report.md`, `Feature6-Optimization.json/.md`, `Feature6-Run-Summary.json`, and `manifest.json`; blocked worksheets appear only in workbook input validation.

> **Out of scope for now:** automatic extraction of drawing truth, DM-owned 3D variation analysis, automatic measured-data capture, and automatic workbook write-back.
