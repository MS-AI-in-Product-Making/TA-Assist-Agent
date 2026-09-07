import { describe, expect, it } from "vitest";
import {
  ADO_TABLE_HEADER,
  governanceIssue,
  normalizeAdoHistoryHtmlForVerification,
  renderF3AdoReminder,
  renderF3AdoHistoryHtml,
} from "./f3-ado-reminder.mjs";

function baseRow(overrides = {}) {
  return {
    factorInstanceId: "b".repeat(64),
    drawingDimensionKey: "c".repeat(64),
    deviceLevelDim: "TP_Gap_X",
    dimensionDescription: "Display | Gap\nCritical",
    partCategory: "Display",
    partSubsystem: "Panel Subsystem",
    drawingNumber: "DWG-1",
    dimId: "307",
    factorDescription: "A|B\nC",
    nominal: 3.145,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    sigmaLevel: 4,
    dimIdStatus: "valid",
    qualitySignals: [],
    governanceStatus: "complete",
    imageReference: {
      artifact: "f1",
      relativePath: "worksheets/TP_Gap_X/tolerance-path.png",
      contentHash: "d".repeat(64),
      worksheetName: "TP_Gap_X",
    },
    source: {
      worksheetName: "TP_Gap_X",
      tableId: "factor-table-1",
      sourceRow: 14,
      sourceCells: { factorName: "TP_Gap_X!E14" },
    },
    ...overrides,
  };
}

function acceptedReport(rows) {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: rows.some((row) => row.governanceStatus !== "complete")
      ? "governance_required"
      : "completed",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [{
      worksheetName: "TP_Gap_X",
      toleranceLoopDescription: "Anonymous device gap",
      rows,
    }],
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: 1,
      factorCount: rows.length,
      completeCount: rows.filter((row) => row.governanceStatus === "complete").length,
      governanceRequiredCount: rows.filter((row) => row.governanceStatus !== "complete").length,
      duplicateConflictCount: rows.filter((row) => row.qualitySignals.includes("duplicate_conflict")).length,
    },
  };
}

function acceptedReportWithWorksheets(worksheets) {
  const allRows = worksheets.flatMap((worksheet) => worksheet.rows);
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: allRows.some((row) => row.governanceStatus !== "complete")
      ? "governance_required"
      : "completed",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets,
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: worksheets.length,
      factorCount: allRows.length,
      completeCount: allRows.filter((row) => row.governanceStatus === "complete").length,
      governanceRequiredCount: allRows.filter((row) => row.governanceStatus !== "complete").length,
      duplicateConflictCount: allRows.filter((row) => row.qualitySignals.includes("duplicate_conflict")).length,
    },
  };
}

function worksheetRow(worksheetName, factorInstanceId, sourceRow, partSubsystem, factorDescription) {
  return baseRow({
    factorInstanceId,
    partSubsystem,
    factorDescription,
    source: {
      ...baseRow().source,
      worksheetName,
      sourceRow,
    },
    imageReference: {
      ...baseRow().imageReference,
      worksheetName,
      relativePath: `worksheets/${worksheetName}/tolerance-path.png`,
    },
  });
}

describe("governanceIssue", () => {
  it("maps all governance signals and complete fallback", () => {
    expect(governanceIssue(baseRow({ qualitySignals: ["drawing_number_missing"] }))).toBe("Drawing Number missing");
    expect(governanceIssue(baseRow({ qualitySignals: ["dim_id_missing"] }))).toBe("DIM ID missing");
    expect(governanceIssue(baseRow({ qualitySignals: ["dim_id_suspected_invalid"] }))).toBe("DIM ID suspected invalid");
    expect(governanceIssue(baseRow({ qualitySignals: ["dim_id_needs_confirmation"] }))).toBe("DIM ID needs confirmation");
    expect(governanceIssue(baseRow({ qualitySignals: ["duplicate_conflict"] }))).toBe("Duplicate Drawing Number and DIM ID conflict");
    expect(governanceIssue(baseRow({ qualitySignals: [] }))).toBe("Complete");
  });
});

describe("renderF3AdoReminder", () => {
  it("groups markdown rows globally by Part / Subsystem while preserving factor uniqueness", () => {
    const report = acceptedReportWithWorksheets([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Anonymous device gap A",
        rows: [
          worksheetRow("Analysis-A", "1".repeat(64), 11, "Bracket", "Factor-A1"),
          worksheetRow("Analysis-A", "2".repeat(64), 12, "Panel", "Factor-A2"),
          worksheetRow("Analysis-A", "3".repeat(64), 13, "Bracket", "Factor-A3"),
        ],
      },
      {
        worksheetName: "Analysis-B",
        toleranceLoopDescription: "Anonymous device gap B",
        rows: [
          worksheetRow("Analysis-B", "4".repeat(64), 21, "Bracket", "Factor-B1"),
          worksheetRow("Analysis-B", "5".repeat(64), 22, "(missing)", "Factor-B2"),
        ],
      },
    ]);

    const markdown = renderF3AdoReminder(report);

    expect(markdown).not.toContain("Worksheet:");
    expect(markdown).toContain("### Part / Subsystem: Bracket (3 factors)");
    expect(markdown).toContain("### Part / Subsystem: Panel (1 factors)");
    expect(markdown).toContain("### Part / Subsystem: (missing Part / Subsystem) (1 factors)");

    for (const factorName of ["Factor-A1", "Factor-A2", "Factor-A3", "Factor-B1", "Factor-B2"]) {
      expect(markdown.split(factorName)).toHaveLength(2);
    }
  });

  it("renders deterministic English reminder with exact 12-column table header and all records", () => {
    const rows = [
      baseRow({ qualitySignals: ["drawing_number_missing"], governanceStatus: "needs_governance" }),
      baseRow({ factorInstanceId: "d".repeat(64), drawingDimensionKey: undefined, drawingNumber: null, dimId: null, qualitySignals: ["dim_id_missing"], governanceStatus: "needs_governance" }),
      baseRow({ factorInstanceId: "e".repeat(64), qualitySignals: ["duplicate_conflict"], governanceStatus: "blocked_for_reminder" }),
    ];

    const markdown = renderF3AdoReminder(acceptedReport(rows));

    expect(markdown).toContain("## F3 DIM ID / Drawing Governance Reminder");
    expect(ADO_TABLE_HEADER).toBe("| Worksheet Source | Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |");
    expect(markdown).toContain(ADO_TABLE_HEADER);
    expect(markdown).not.toContain("Source Location");

    const rowLines = markdown
      .split("\n")
      .filter((line) => line.startsWith("| TP_Gap_X | TP_Gap_X |"));
    expect(rowLines).toHaveLength(3);

    expect(markdown).toContain("Workbook: Anonymous.xlsx");
    expect(markdown).toContain("Worksheet count: 1");
    expect(markdown).toContain("Factor count: 3");
    expect(markdown).toContain("Governance required count: 3");
    expect(markdown).toContain("Duplicate conflict count: 1");
    expect(markdown).toContain("Requested actions:");
  });

  it("escapes markdown pipes/newlines and redacts local path plus Authorization leakage", () => {
    const markdown = renderF3AdoReminder(acceptedReport([
      baseRow({
        factorDescription: "A|B\nC",
        partSubsystem: "C:\\Users\\xumax\\secret\\file.xlsx Authorization: Bearer token123",
        source: { ...baseRow().source, worksheetName: "Source|A\nSheet" },
        qualitySignals: ["dim_id_needs_confirmation"],
        governanceStatus: "needs_governance",
      }),
    ]));

    expect(markdown).toContain("A\\|B<br>C");
    expect(markdown).toContain("Source\\|A<br>Sheet");
    expect(markdown).toContain("Display \\| Gap<br>Critical");
    expect(markdown).not.toContain("C:\\Users\\xumax\\secret\\file.xlsx");
    expect(markdown).not.toContain("Bearer token123");
    expect(markdown).not.toContain("token123");
    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).toContain("Authorization: [redacted]");
  });

  it("redacts quoted Windows absolute paths with spaces without leaking suffix tokens", () => {
    const markdown = renderF3AdoReminder(acceptedReport([
      baseRow({
        partSubsystem: "\"C:\\Users\\Name\\AI Project\\ado repro\\Feature3-Report.md\" and 'C:\\Users\\Name\\AI Project\\ado repro\\Feature3-Report.md'",
        factorDescription: "from C:\\Users\\Name\\AI Project\\ado repro\\Feature3-Report.md",
        qualitySignals: ["dim_id_missing"],
        governanceStatus: "needs_governance",
      }),
    ]));

    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).not.toContain("AI Project");
    expect(markdown).not.toContain("ado repro");
    expect(markdown).not.toContain("Feature3-Report.md");
    expect(markdown).toContain("DIM ID missing");
  });

  it("rejects input_rejected reports", () => {
    expect(() => renderF3AdoReminder({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "input_rejected",
      artifactIssues: [{ reasonCode: "description_missing", artifactReference: "worksheet:TP_Gap_X" }],
    })).toThrow(/input_rejected/i);
  });
});

describe("renderF3AdoHistoryHtml", () => {
  it("renders one 12-column header with global Part / Subsystem groups and marked factor rows", () => {
    const report = acceptedReportWithWorksheets([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Anonymous device gap A",
        rows: [
          worksheetRow("Analysis-A", "1".repeat(64), 11, "Bracket", "Factor-A1"),
          worksheetRow("Analysis-A", "2".repeat(64), 12, "Panel", "Factor-A2"),
          worksheetRow("Analysis-A", "3".repeat(64), 13, "Bracket", "Factor-A3"),
        ],
      },
      {
        worksheetName: "Analysis-B",
        toleranceLoopDescription: "Anonymous device gap B",
        rows: [
          worksheetRow("Analysis-B", "4".repeat(64), 21, "Bracket", "Factor-B1"),
          worksheetRow("Analysis-B", "5".repeat(64), 22, "(missing)", "Factor-B2"),
        ],
      },
    ]);

    const html = renderF3AdoHistoryHtml(report);

    expect(html.match(/<thead>/g)).toHaveLength(1);
    expect(html.match(/<th>/g)).toHaveLength(12);
    expect(html).toContain("<thead><tr><th>Worksheet Source</th><th>Device Level Dim</th>");
    expect(html).not.toContain("Worksheet:");
    expect(html).toContain("<tr data-f3-group-row=true><td colspan=12>Part / Subsystem: Bracket (3 factors)</td></tr>");
    expect(html).toContain("<tr data-f3-group-row=true><td colspan=12>Part / Subsystem: (missing Part / Subsystem) (1 factors)</td></tr>");
    expect(html).toContain("<td>Analysis-B</td><td>TP_Gap_X</td>");

    const factorRowMatches = html.match(/<tr data-f3-factor-row=true>/g) ?? [];
    expect(factorRowMatches).toHaveLength(report.summary.factorCount);
    expect(html).not.toMatch(/(?:data-f3-(?:factor|group)-row|colspan)="(?:true|12)"/);

    const bracketIndex = html.indexOf("Part / Subsystem: Bracket (3 factors)");
    const panelIndex = html.indexOf("Part / Subsystem: Panel (1 factors)");
    const missingIndex = html.indexOf("Part / Subsystem: (missing Part / Subsystem) (1 factors)");
    expect(bracketIndex).toBeLessThan(panelIndex);
    expect(panelIndex).toBeLessThan(missingIndex);
  });

  it("renders a deterministic 12-column HTML table with every record", () => {
    const rows = [
      baseRow({ factorDescription: "A&B <critical> \"quoted\" 'single'\nnext", qualitySignals: ["drawing_number_missing"], governanceStatus: "needs_governance" }),
      baseRow({ factorInstanceId: "d".repeat(64), drawingDimensionKey: undefined, drawingNumber: null, dimId: null, qualitySignals: ["dim_id_missing"], governanceStatus: "needs_governance" }),
      baseRow({ factorInstanceId: "e".repeat(64), qualitySignals: ["duplicate_conflict"], governanceStatus: "blocked_for_reminder" }),
    ];

    const html = renderF3AdoHistoryHtml(acceptedReport(rows));

    expect(html).toContain("<h2>F3 DIM ID / Drawing Governance Reminder</h2>");
    expect(html).toContain("<table>");
    expect(html).toContain("<thead><tr><th>Worksheet Source</th><th>Device Level Dim</th>");
    expect(html.match(/<th>/g)).toHaveLength(12);
    expect(html.match(/<tr data-f3-factor-row=true>/g)).toHaveLength(3);
    expect(html).toContain("<td>A&amp;B &lt;critical&gt; &quot;quoted&quot; &#39;single&#39;<br>next</td>");
    expect(html).not.toContain("A&B <critical>");
    expect(html).toContain("Drawing Number missing");
    expect(html).toContain("DIM ID missing");
    expect(html).toContain("Duplicate Drawing Number and DIM ID conflict");
  });

  it("redacts sensitive text before HTML escaping", () => {
    const html = renderF3AdoHistoryHtml(acceptedReport([
      baseRow({
        partSubsystem: "C:\\Users\\xumax\\secret\\file.xlsx Authorization: Bearer token123",
        qualitySignals: ["dim_id_needs_confirmation"],
        governanceStatus: "needs_governance",
      }),
    ]));

    expect(html).toContain("[redacted-local-path]");
    expect(html).toContain("Authorization: [redacted]");
    expect(html).not.toContain("C:\\Users\\xumax\\secret\\file.xlsx");
    expect(html).not.toContain("token123");
  });

  it("rejects input_rejected reports", () => {
    expect(() => renderF3AdoHistoryHtml({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "input_rejected",
      artifactIssues: [{ reasonCode: "description_missing", artifactReference: "worksheet:TP_Gap_X" }],
    })).toThrow(/input_rejected/i);
  });
});

describe("normalizeAdoHistoryHtmlForVerification", () => {
  it("removes only ADO-injected whitespace before controlled closing tags", () => {
    const expected = "<h2>Title</h2><p>Text</p><ul><li>Action</li></ul><table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>\n";
    const adoReadback = "<h2>Title </h2><p>Text </p><ul><li>Action </li> </ul><table><thead><tr><th>Header </th></tr></thead><tbody><tr><td>Value </td></tr></tbody></table>";

    expect(normalizeAdoHistoryHtmlForVerification(adoReadback)).toBe(
      normalizeAdoHistoryHtmlForVerification(expected),
    );
  });

  it("preserves whitespace outside the controlled closing-tag boundary", () => {
    expect(normalizeAdoHistoryHtmlForVerification("<td>A  B</td><div>C </div>"))
      .toBe("<td>A  B</td><div>C </div>");
  });
});
