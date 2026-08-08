import { describe, expect, it } from "vitest";
import path from "node:path";
import { renderF3Report } from "./f3-report.mjs";

const outputRoot = path.join("controlled", "f3");

function renderAccepted(report) {
  return renderF3Report(report, { outputRoot });
}

function governanceReport(factorDescription = "Anonymous display offset") {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "completed",
    artifactRoot: path.join("controlled", "f1"),
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [{
      worksheetName: "TP_Gap_X",
      toleranceLoopDescription: "Anonymous device gap",
      rows: [{
        factorInstanceId: "b".repeat(64),
        drawingDimensionKey: "c".repeat(64),
        deviceLevelDim: "TP_Gap_X",
        dimensionDescription: "Anonymous device gap",
        partCategory: "Display",
        partSubsystem: "Anonymous bracket",
        drawingNumber: "DRAW-A",
        dimId: "307",
        factorDescription,
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
      }],
    }],
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: 1,
      factorCount: 1,
      completeCount: 1,
      governanceRequiredCount: 0,
      duplicateConflictCount: 0,
    },
  };
}

describe("renderF3Report", () => {
  it("renders grouped drawing governance tables", () => {
    const report = governanceReport();
    const markdown = renderAccepted(report);
    const href = path.relative(
      path.resolve(outputRoot),
      path.resolve(report.artifactRoot, report.worksheets[0].rows[0].imageReference.relativePath),
    ).split(path.sep).join("/");

    expect(markdown).toContain("# Feature 3 DIM ID 与图纸治理报告");
    expect(markdown).toContain("## Display / DRAW-A");
    expect(markdown).toContain("| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Source Evidence |");
    expect(markdown).toContain(`[TP_Gap_X](${href})`);
    expect(markdown).toContain(`[Anonymous device gap](${href})`);
    expect(markdown).toContain(`[Anonymous display offset](${href})`);
    expect(markdown).toContain("Worksheet: TP_Gap_X; Table: factor-table-1; Row: 14; Fields: factorName=TP_Gap_X!E14");
    expect(markdown).toContain("ADO 状态：`not_requested`");
  });

  it("sorts source evidence fields and renders an empty fallback", () => {
    const report = governanceReport();
    report.worksheets[0].rows[0].source.sourceCells = {
      nominalValue: "TP_Gap_X!F14",
      factorName: "TP_Gap_X!E14",
    };
    const sortedMarkdown = renderAccepted(report);
    expect(sortedMarkdown).toContain("Fields: factorName=TP_Gap_X!E14, nominalValue=TP_Gap_X!F14");

    report.worksheets[0].rows[0].source.sourceCells = {};
    expect(renderAccepted(report)).toContain("Fields: none");
  });

  it("uses relative image hrefs without exposing an absolute artifact root", () => {
    const report = governanceReport();
    report.artifactRoot = path.resolve("controlled", "f1");

    const markdown = renderAccepted(report);

    expect(markdown).not.toContain(report.artifactRoot);
    expect(markdown).toContain("tolerance-path.png)");
  });

  it("renders optional ADO work item reference and reason code without comment body", () => {
    const report = governanceReport();
    report.ado = {
      status: "blocked",
      workItemReference: "1102392",
      reasonCode: "surface_mcp_comment_body_unsupported",
    };

    const markdown = renderAccepted(report);

    expect(markdown).toContain("ADO 状态：`blocked`");
    expect(markdown).toContain("ADO Work Item：`1102392`");
    expect(markdown).toContain("ADO 原因：surface_mcp_comment_body_unsupported");
    expect(markdown).not.toContain("comment body");
  });

  it.each([
    "surface_mcp_unavailable",
    "surface_mcp_authentication_failed",
  ])("renders pre-validation Surface MCP reason %s without sensitive content", (reasonCode) => {
    const report = governanceReport();
    report.ado = { status: "blocked", reasonCode };

    const markdown = renderAccepted(report);

    expect(markdown).toContain("ADO 状态：`blocked`");
    expect(markdown).toContain(`ADO 原因：${reasonCode}`);
    expect(markdown).not.toContain("comment body");
    expect(markdown).not.toContain("Authorization");
  });

  it("sanitizes ADO work item reference before inline-code rendering", () => {
    const report = governanceReport();
    report.ado = {
      status: "blocked",
      workItemReference: "ticket`42 Authorization=token C:\\Users\\secret\\file",
      reasonCode: "surface_mcp_comment_body_unsupported",
    };

    const markdown = renderAccepted(report);

    expect(markdown).toContain("ADO Work Item：`ticket'42 Authorization: [redacted] [redacted-local-path]`");
    expect(markdown).not.toContain("Authorization=token");
    expect(markdown).not.toContain("C:\\Users\\secret\\file");
  });

  it("redacts full authorization bearer values in common formats", () => {
    const report = governanceReport();
    report.ado = {
      status: "blocked",
      workItemReference: "Authorization: Bearer very-secret-token | next=keep Authorization=Bearer very-secret-token-2 then",
      reasonCode: "surface_mcp_comment_body_unsupported",
    };

    const markdown = renderAccepted(report);

    expect(markdown).toContain("Authorization: [redacted]");
    expect(markdown).not.toContain("very-secret-token");
    expect(markdown).not.toContain("very-secret-token-2");
    expect(markdown).not.toContain("Bearer very-secret-token");
    expect(markdown).toContain("next=keep");
    expect(markdown).toContain("then");
  });

  it("escapes table text and does not expose local or authorization data", () => {
    const markdown = renderAccepted(governanceReport("A|B\nC"));

    expect(markdown).toContain("A\\|B<br>C");
    expect(markdown).not.toContain("C:\\Users\\");
    expect(markdown).not.toContain("Authorization");
  });

  it("redacts Windows absolute paths with spaces in work item and source fields", () => {
    const report = governanceReport("source C:\\Users\\Name\\AI Project\\ado repro\\Feature3-Report.md");
    report.ado = {
      status: "failed",
      workItemReference: "\"C:\\Users\\Name\\AI Project\\ado repro\\Feature3-Report.md\" and 'C:\\Users\\Name\\AI Project\\ado repro\\Feature3-Report.md'",
      reasonCode: "project_not_found",
    };

    const markdown = renderAccepted(report);

    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).not.toContain("AI Project");
    expect(markdown).not.toContain("ado repro");
    expect(markdown).not.toContain("Feature3-Report.md");
    expect(markdown).toContain("project_not_found");
  });

  it("renders structured input rejection issues", () => {
    const markdown = renderF3Report({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "input_rejected",
      artifactIssues: [{ reasonCode: "description_missing", artifactReference: "worksheet:TP_Gap_X" }],
    });

    expect(markdown).toContain("状态：`input_rejected`");
    expect(markdown).toContain("description_missing");
    expect(markdown).toContain("worksheet:TP_Gap_X");
  });
});