import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  F3AdoMarkdownLengthError,
  F3_ADO_MARKDOWN_MAX_LENGTH,
  F3_ADO_MARKDOWN_TABLE_HEADER,
  renderF3AdoMarkdown,
} from "./f3-ado-markdown.js";
import { governanceIssue } from "@ai-assist/contracts";
import { renderF3AdoReminder } from "./f3.js";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    factorInstanceId: "b".repeat(64),
    drawingDimensionKey: "c".repeat(64),
    deviceLevelDim: "TP_Gap_X",
    dimensionDescription: "Display | Gap\\Critical\nPrimary",
    partCategory: "Display",
    partSubsystem: "Panel Subsystem",
    drawingNumber: "DWG-1",
    dimId: "307",
    factorDescription: "A|B\\C\nD",
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

function acceptedReportWithWorksheets(
  worksheets: Array<{ worksheetName: string; toleranceLoopDescription: string; rows: Array<Record<string, unknown>> }>,
) {
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
      duplicateConflictCount: allRows.filter((row) => Array.isArray(row.qualitySignals) && row.qualitySignals.includes("duplicate_conflict")).length,
    },
  };
}

function worksheetRow(
  worksheetName: string,
  factorInstanceId: string,
  sourceRow: number,
  partSubsystem: string | null | undefined,
  factorDescription: string,
  overrides: Record<string, unknown> = {},
) {
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
    ...overrides,
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

describe("renderF3AdoMarkdown", () => {
  it("renders canonical grouped markdown with deterministic group order and stable row order", () => {
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

    const rendered = renderF3AdoMarkdown(report);

    expect(rendered.markdown).toContain("## F3 DIM ID / Drawing Governance Reminder");
    expect(rendered.markdown).toContain("### Workbook Summary");
    expect(rendered.markdown).toContain("### Part / Subsystem: Bracket (3 factors)");
    expect(rendered.markdown).toContain("### Part / Subsystem: Panel (1 factors)");
    expect(rendered.markdown).toContain("### Part / Subsystem: (missing Part / Subsystem) (1 factors)");
    expect(rendered.markdown).not.toContain("Worksheet:");
    expect(rendered.markdown).toContain(F3_ADO_MARKDOWN_TABLE_HEADER);

    expect(rendered.groups.map((group) => group.partSubsystem)).toEqual([
      "Bracket",
      "Panel",
      "(missing Part / Subsystem)",
    ]);
    expect(rendered.groups.map((group) => group.factorCount)).toEqual([3, 1, 1]);
    expect(rendered.groups[0]?.rows.map((row) => row.factorDescription)).toEqual(["Factor-A1", "Factor-A3", "Factor-B1"]);
    expect(rendered.groups[2]).toMatchObject({ missingDrawingNumberCount: 0, missingDimIdCount: 0 });

    const bracketIndex = rendered.markdown.indexOf("Factor-A1");
    const secondBracketIndex = rendered.markdown.indexOf("Factor-A3");
    const thirdBracketIndex = rendered.markdown.indexOf("Factor-B1");
    expect(bracketIndex).toBeLessThan(secondBracketIndex);
    expect(secondBracketIndex).toBeLessThan(thirdBracketIndex);
  });

  it("escapes pipes, backslashes, and newlines, preserves only headings tables and br tags, and fills missing values", () => {
    const rendered = renderF3AdoMarkdown(acceptedReportWithWorksheets([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Anonymous device gap A",
        rows: [
          worksheetRow("Analysis-A", "1".repeat(64), 11, "(missing)", "Factor|One\\Two\nThree", {
            drawingDimensionKey: undefined,
            dimensionDescription: "Desc|Value\\Segment\nNext",
            drawingNumber: null,
            dimId: null,
            qualitySignals: ["drawing_number_missing", "dim_id_missing"],
            governanceStatus: "needs_governance",
          }),
        ],
      },
    ]));

    expect(rendered.markdown).toContain("Desc\\|Value\\\\Segment<br>Next");
    expect(rendered.markdown).toContain("Factor\\|One\\\\Two<br>Three");
    expect(rendered.markdown).toContain("| (missing) | (missing) |");
    expect(rendered.markdown).not.toContain("- Fill in");
    expect(rendered.markdown).not.toContain("<ul>");
    expect(rendered.markdown).not.toContain("<li>");
    expect(rendered.markdown).not.toContain("<p>");
    expect(rendered.markdown).toMatch(/^## /m);
    expect(rendered.markdown).toMatch(/^### /m);
    expect(rendered.markdown).not.toMatch(/<(?!br\s*\/?>)/i);
  });

  it("redacts Windows absolute paths and Authorization tokens before escaping", () => {
    const rendered = renderF3AdoMarkdown(acceptedReportWithWorksheets([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Anonymous device gap A",
        rows: [
          worksheetRow("Analysis-A", "1".repeat(64), 11, "C:\\Users\\xumax\\secret\\file.xlsx Authorization: Bearer token123", "A|B", {
            qualitySignals: ["dim_id_needs_confirmation"],
            governanceStatus: "needs_governance",
          }),
        ],
      },
    ]));

    expect(rendered.markdown).toContain("[redacted-local-path]");
    expect(rendered.markdown).toContain("Authorization: [redacted]");
    expect(rendered.markdown).not.toContain("C:\\Users\\xumax\\secret\\file.xlsx");
    expect(rendered.markdown).not.toContain("token123");
  });

  it("returns a stable content hash for the exact markdown bytes", () => {
    const report = acceptedReportWithWorksheets([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Anonymous device gap A",
        rows: [worksheetRow("Analysis-A", "1".repeat(64), 11, "Bracket", "Factor-A1")],
      },
    ]);

    const rendered = renderF3AdoMarkdown(report);

    expect(rendered.contentHash).toBe(createHash("sha256").update(rendered.markdown).digest("hex"));
  });

  it("fails closed with a typed validation error when markdown exceeds the governed length limit", () => {
    const veryLongText = "X".repeat(F3_ADO_MARKDOWN_MAX_LENGTH);
    const report = acceptedReportWithWorksheets([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Anonymous device gap A",
        rows: [
          worksheetRow("Analysis-A", "1".repeat(64), 11, "Bracket", veryLongText, {
            dimensionDescription: veryLongText,
            governanceStatus: "needs_governance",
            qualitySignals: ["drawing_number_missing"],
          }),
        ],
      },
    ]);

    expect(() => renderF3AdoMarkdown(report)).toThrow(F3AdoMarkdownLengthError);
    expect(() => renderF3AdoMarkdown(report)).toThrow(expect.objectContaining({
      code: "validation_error",
      retryable: false,
      summary: expect.stringMatching(/exceeds governed length limit/i),
    }));
  });

  it("rejects input_rejected reports", () => {
    expect(() => renderF3AdoMarkdown({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "input_rejected",
      artifactIssues: [{ reasonCode: "description_missing", artifactReference: "worksheet:TP_Gap_X" }],
    })).toThrow(/input_rejected/i);
  });
});

describe("renderF3AdoReminder", () => {
  it("routes the public reminder renderer through the canonical formatter", () => {
    const report = acceptedReportWithWorksheets([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Anonymous device gap A",
        rows: [worksheetRow("Analysis-A", "1".repeat(64), 11, "Bracket", "Factor-A1")],
      },
    ]);

    expect(renderF3AdoReminder(report)).toBe(renderF3AdoMarkdown(report).markdown);
  });
});