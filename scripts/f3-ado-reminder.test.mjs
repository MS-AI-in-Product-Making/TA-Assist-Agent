import { describe, expect, it } from "vitest";
import {
  ADO_TABLE_HEADER,
  governanceIssue,
  renderF3AdoReminder,
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
  it("renders deterministic English reminder with exact 11-column table header and all records", () => {
    const rows = [
      baseRow({ qualitySignals: ["drawing_number_missing"], governanceStatus: "needs_governance" }),
      baseRow({ factorInstanceId: "d".repeat(64), drawingDimensionKey: undefined, drawingNumber: null, dimId: null, qualitySignals: ["dim_id_missing"], governanceStatus: "needs_governance" }),
      baseRow({ factorInstanceId: "e".repeat(64), qualitySignals: ["duplicate_conflict"], governanceStatus: "blocked_for_reminder" }),
    ];

    const markdown = renderF3AdoReminder(acceptedReport(rows));

    expect(markdown).toContain("## F3 DIM ID / Drawing Governance Reminder");
    expect(ADO_TABLE_HEADER).toBe("| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |");
    expect(markdown).toContain(ADO_TABLE_HEADER);
    expect(markdown).not.toContain("Source Location");

    const rowLines = markdown
      .split("\n")
      .filter((line) => line.startsWith("| TP_Gap_X |"));
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
        qualitySignals: ["dim_id_needs_confirmation"],
        governanceStatus: "needs_governance",
      }),
    ]));

    expect(markdown).toContain("A\\|B<br>C");
    expect(markdown).toContain("Display \\| Gap<br>Critical");
    expect(markdown).not.toContain("C:\\Users\\xumax\\secret\\file.xlsx");
    expect(markdown).not.toContain("Bearer token123");
    expect(markdown).not.toContain("token123");
    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).toContain("Authorization: [redacted]");
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
