import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadF4Handoffs } from "./f4-artifact-loader.mjs";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function enhancedRow(worksheetName, tableId, sourceRow) {
  return {
    worksheetName,
    tableId,
    sourceRow,
    actualFields: {
      factorName: "Anonymous offset",
      partName: "Anonymous bracket",
      drawingNumber: "DRAW-A",
      dimCharacteristicId: "1",
      partCategory: "Display",
      nominalValue: 3.145,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      distribution: "Normal",
      mean: 3.145,
      tolerance: 0.1,
      oneSigma: 0.025,
      percentContributionToSigma: 1,
      notes: null,
    },
    sourceCells: { factorName: `${worksheetName}!E${sourceRow}` },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "non_f0_process_category",
    adoReminderRequested: false,
  };
}

function readySystemSpecification(worksheetName) {
  return {
    status: "available",
    lowerSpecLimit: {
      status: "available",
      actualValue: -0.15,
      displayValue: "-0.15",
      sourceLabel: "*Lower Spec Limit ->",
      sourceCell: `${worksheetName}!P54`,
      valueOrigin: "numeric_literal",
    },
    upperSpecLimit: {
      status: "available",
      actualValue: 0.05,
      displayValue: "0.05",
      sourceLabel: "*Upper Spec Limit ->",
      sourceCell: `${worksheetName}!P55`,
      valueOrigin: "numeric_literal",
    },
    targetSigmaLevel: {
      status: "available",
      actualValue: 3,
      displayValue: "3.0sigma",
      sourceLabel: "*Target sigma Level ->",
      sourceCell: `${worksheetName}!P56`,
      valueOrigin: "numeric_literal",
    },
    additionalMeanShift: {
      status: "available",
      actualValue: 0,
      displayValue: "0",
      sourceLabel: "Additional Mean Shift",
      valueOrigin: "defaulted",
    },
  };
}

function f4Handoff(worksheetName, toleranceLoopDescription, row) {
  const spec = readySystemSpecification(worksheetName);
  return {
    contractVersion: "v1",
    handoffVersion: "f4-handoff-v1",
    inputClassification: "confidential",
    status: "ready",
    workbookContentHash: "a".repeat(64),
    worksheetName,
    toleranceLoopDescription,
    systemSpecification: {
      designNominal: -0.05,
      lowerSpecLimit: spec.lowerSpecLimit,
      upperSpecLimit: spec.upperSpecLimit,
      targetSigmaLevel: spec.targetSigmaLevel,
      targetCpk: 1,
      additionalMeanShift: spec.additionalMeanShift,
    },
    factors: [{
      tableId: row.tableId,
      sourceRow: row.sourceRow,
      unit: "mm",
      actualFields: row.actualFields,
      sourceCells: row.sourceCells,
    }],
  };
}

function buildValidF2Report() {
  const rowA = enhancedRow("Analysis-A", "factor-table-1", 14);
  const rowB = enhancedRow("Analysis-B", "factor-table-2", 22);

  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: {
      fileName: "Anonymous.xlsx",
      contentHash: "a".repeat(64),
      f1GeneratedAt: "2026-08-03T00:00:00.000Z",
    },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "controlled/f1",
    worksheets: [
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Loop A",
        status: "ready",
        tolerancePathImageStatus: "available",
        systemSpecification: readySystemSpecification("Analysis-A"),
        systemSpecificationIssues: [],
        rows: [rowA],
        missingFieldSummary: [],
      },
      {
        worksheetName: "Analysis-B",
        toleranceLoopDescription: "Loop B",
        status: "ready",
        tolerancePathImageStatus: "available",
        systemSpecification: readySystemSpecification("Analysis-B"),
        systemSpecificationIssues: [],
        rows: [rowB],
        missingFieldSummary: [],
      },
    ],
    f4Handoffs: [
      f4Handoff("Analysis-B", "Loop B", rowB),
      f4Handoff("Analysis-A", "Loop A", rowA),
    ],
    adoEvents: [],
    summary: {
      worksheetsChecked: 2,
      blockedWorksheetCount: 0,
      readyWorksheetCount: 2,
      factorRowCount: 2,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: 2,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  };
}

function writeReportToTemp(report = buildValidF2Report()) {
  const root = mkdtempSync(path.join(tmpdir(), "f4-loader-"));
  roots.push(root);
  const reportPath = path.join(root, "Feature2-Report.json");
  writeFileSync(reportPath, JSON.stringify(report));
  writeFileSync(path.join(root, "Feature2-Report.md"), "# Feature 2");
  return { root, reportPath };
}

describe("loadF4Handoffs", () => {
  it("accepts a valid Feature2 report and preserves F4 handoff order", () => {
    const { reportPath } = writeReportToTemp();

    const loaded = loadF4Handoffs(reportPath);

    expect(loaded.status).toBe("accepted");
    expect(loaded.handoffs.map((handoff) => handoff.worksheetName)).toEqual(["Analysis-B", "Analysis-A"]);
    expect(loaded.workbook.contentHash).toBe("a".repeat(64));
  });

  it("does not recover from Markdown when Feature2 JSON is missing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f4-loader-"));
    roots.push(root);
    writeFileSync(path.join(root, "Feature2-Report.md"), "Loop details");

    expect(loadF4Handoffs(path.join(root, "Feature2-Report.json"))).toEqual({
      status: "inputRejected",
      reasonCode: "f2_report_missing",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects non-JSON report paths such as xlsx", () => {
    const { root } = writeReportToTemp();
    const workbookPath = path.join(root, "Anonymous.xlsx");
    writeFileSync(workbookPath, "dummy");

    expect(loadF4Handoffs(workbookPath)).toEqual({
      status: "inputRejected",
      reasonCode: "f2_report_invalid",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects empty F4 handoffs", () => {
    const report = buildValidF2Report();
    report.f4Handoffs = [];
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "no_ready_handoff",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects duplicate handoff worksheet names", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[1].worksheetName = "Analysis-B";
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "evidence_mismatch",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects workbook hash mismatch between report and handoff", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].workbookContentHash = "b".repeat(64);
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "evidence_mismatch",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects a handoff without a matching ready worksheet", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].worksheetName = "Analysis-C";
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "no_ready_handoff",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects handoff factor evidence that does not match ready worksheet rows", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].factors[0].tableId = "factor-table-999";
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "evidence_mismatch",
      artifactReference: "Feature2-Report.json",
    });
  });
});
