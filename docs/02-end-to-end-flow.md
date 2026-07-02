# End-to-End Flow (V1)

> The complete runtime flow from the user uploading `.xlsx` to producing a structured interpretation report.
> The `(Fx)` labels on nodes map to the Feature IDs in the [Feature Breakdown](04-feature-breakdown.md).

## Flow Chart

```mermaid
flowchart TD
    A["User uploads .xlsx report"] --> A1["Scan multiple worksheets<br/>detect sheets with TA content"]
    A1 --> A2{"User confirmation<br/>select worksheets for TA analysis"}
    A2 --> B["Parse each selected worksheet<br/>read user-filled factor specs"]
    B --> C["Extract the dimension-chain Loop screenshot"]
    C --> D{"Mode 1: Data cleansing (F2)<br/>1 missing required-field check<br/>2 classified library: tolerance range + distribution"}
    D --> E{"Consistent?"}
    E -->|"Inconsistent"| E1["Flag differences<br/>prompt user to review and confirm"]
    E1 --> E2{"How to handle the difference?"}
    E2 -->|"User edits Excel"| E3a["User updates the sheet and re-uploads"]
    E2 -->|"Agent edits data and recomputes"| E3b["Agent adjusts data<br/>re-analyzes"]
    E3a --> F
    E3b --> F
    E -->|"Consistent"| F["Proceed to method recommendation"]
    F --> G{"Mode 2: Method recommendation (F3)<br/>recommend the most suitable<br/>tolerance-definition method by factor count"}
    G -->|"&lt; 4 factors"| H1["Recommend Worst Case<br/>sum of Tolerance"]
    G -->|"4 - 10 factors"| H2["Recommend 1D RSS statistical<br/>sqrt(sum R^2)"]
    G -->|"&gt; 10 factors"| H3["Suggest 3D VA<br/>(not in V1 -&gt; refer to DM team)"]
    H1 --> I["Core engine calculation<br/>(both WC and RSS output results)"]
    H2 --> I
    I --> J["Capability analysis<br/>Cp · Cpk · Z · DPM · Yield"]
    J --> K{"Target judgment<br/>Cpk&ge;1.33 / sigma met?"}
    K -->|"PASS"| CC{"Uncertain items?<br/>assembly datum face / cross-subsystem attribution"}
    K -->|"FAIL"| CC
    CC -->|"Ambiguous -&gt; clarification card"| CQ["Stop and ask the user<br/>dependent conclusions unlock after confirmation (fail-closed)"]
    CQ --> L
    CC -->|"Evidence sufficient"| L["Mode 3: Objective 5-section (F5)"]
    L --> M1["1 Loop validity<br/>closed loop / datum / assembly datum face"]
    L --> M2["2 Capability vs Spec<br/>Cpk judgment · 6-sigma feasibility"]
    L --> M3["3 Top contributors<br/>ranking + causes"]
    L --> M4["4 Structural risk (SIGNAL)<br/>cross-subsystem / non-geometric / long stack · flag only"]
    L --> M5["5 Options (OPTION)<br/>A keep / B adjust Spec / C optimize · not ranked · judgment left to user"]
    L --> M6["What-if / Spec reverse-solve / centering (F6)<br/>2-3 reverse-solve options · over-capability -&gt; RED warning"]
    M1 & M2 & M3 & M4 & M5 & M6 --> N["Structured TA interpretation report + Loop image (F7)<br/>per-item traceable · reproducible"]
    H3 --> N
    classDef start fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef proc fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef dec fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    classDef v2 fill:#fffde7,stroke:#f9a825,color:#f57f17
    classDef done fill:#c8e6c9,stroke:#2e7d32,color:#1b5e20
    class A,B,C start
    class A2,D,E,E2,G,K,CC dec
    class A1 proc
    class F,H1,H2,I,J,L,M1,M2,M3,M4,M5,M6,E3a,E3b proc
    class E1,CQ warn
    class H3 v2
    class N done
```

## Key Decision Points

| Node | Decision | Branches |
|---|---|---|
| Worksheet confirmation | Which sheets to interpret | User confirms / manual fallback selection |
| Cleansing consistency | Required fields + Classified Capability Library match | Consistent -> continue; inconsistent -> flag differences (in-library / out-of-library evidenced) |
| Difference handling | Who fixes it | User edits Excel / Agent edits data and recomputes |
| Method recommendation | Factor count | `<4` WC · `4-10` RSS · `>10` refer to DM |
| Target judgment | Cpk&ge;1.33 / sigma met | Both PASS / FAIL proceed to interpretation |
| Uncertainty confirmation | Assembly datum face / cross-subsystem attribution ambiguous | Stop and raise clarification card; dependent conclusions unlock after confirmation (fail-closed) |

> Multi-sheet reports can be **processed in parallel for speed**, but review is still per-page and human-gated.
> Interpretation only states `FACT`/`RULE`; `SIGNAL`/`OPTION` are presented in parallel, not ranked — **judgment is left to the user**.

---
**Related docs:** [Architecture](01-architecture.md) · [Differentiation](03-differentiation.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
