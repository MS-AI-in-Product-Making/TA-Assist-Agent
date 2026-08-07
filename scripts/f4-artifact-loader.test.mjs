import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadF4Handoffs } from "./f4-artifact-loader.mjs";
import { f2UserReportSchema } from "../packages/contracts/dist/contracts.js";

const MAX_REPORT_BYTES = 5 * 1024 * 1024;

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
      actualFields: { ...row.actualFields },
      sourceCells: { ...row.sourceCells },
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

function buildNestedObject(depth) {
  let current = { leaf: "end" };
  for (let index = 0; index < depth; index += 1) {
    current = { nested: current };
  }
  return current;
}

function expectSanitizedF2ReportInvalid(value) {
  expect(value).toEqual({
    status: "inputRejected",
    reasonCode: "f2_report_invalid",
    artifactReference: "Feature2-Report.json",
  });
  expect(value).not.toHaveProperty("path");
  expect(value).not.toHaveProperty("raw");
  expect(value).not.toHaveProperty("error");
  expect(value).not.toHaveProperty("rawError");
}

describe("loadF4Handoffs", () => {
  it("accepts a valid Feature2 report and preserves F4 handoff order", () => {
    const { reportPath } = writeReportToTemp();

    const loaded = loadF4Handoffs(reportPath);

    expect(loaded.status).toBe("accepted");
    expect(loaded.handoffs.map((handoff) => handoff.worksheetName)).toEqual(["Analysis-B", "Analysis-A"]);
    expect(loaded.workbook.contentHash).toBe("a".repeat(64));
    expect(loaded.reportPath).toBe("Feature2-Report.json");
    expect(loaded.reportPath.startsWith(reportPath)).toBe(false);
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

    expectSanitizedF2ReportInvalid(loadF4Handoffs(workbookPath));
  });

  it("rejects malformed Feature2 JSON with controlled artifact reference only", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f4-loader-"));
    roots.push(root);
    const reportPath = path.join(root, "Feature2-Report.json");
    writeFileSync(reportPath, "{ this is not valid JSON");

    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });

  it("rejects malformed schema-invalid objects before business classification", () => {
    const { reportPath } = writeReportToTemp({});

    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });

  it("rejects oversized Feature2 reports before parsing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f4-loader-"));
    roots.push(root);
    const reportPath = path.join(root, "Feature2-Report.json");
    writeFileSync(reportPath, " ".repeat(MAX_REPORT_BYTES + 1));

    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });

  it("rejects deeply nested unknown JSON without uncaught errors", () => {
    const report = buildValidF2Report();
    const nested = buildNestedObject(2000);
    report.worksheets[0].rows[0].actualFields.deepUnknown = nested;
    report.f4Handoffs[1].factors[0].actualFields.deepUnknown = nested;
    const { reportPath } = writeReportToTemp(report);

    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });

  it("rejects schema-valid F2 inputRejected reports as invalid handoff input", () => {
    const report = f2UserReportSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      status: "inputRejected",
      artifactRoot: "controlled/f1",
      artifactIssues: [{
        reasonCode: "root_md_missing",
        artifactPath: "Feature1-Report.md",
      }],
    });
    const { reportPath } = writeReportToTemp(report);

    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });

  it("treats attacker-crafted inputRejected-shaped JSON as untrusted and sanitizes output", () => {
    const { reportPath } = writeReportToTemp({
      status: "inputRejected",
      reasonCode: "attacker_controlled",
      path: "C:\\sensitive\\source.xlsx",
      raw: "unexpected",
      artifactReference: "Feature2-Report.json",
    });

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "f2_report_invalid",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects empty F4 handoffs", () => {
    const report = buildValidF2Report();
    report.f4Handoffs = [];
    const { reportPath } = writeReportToTemp(report);

    // Distinction: this fixture is rejected by f2UserReportSchema (ready worksheet must bind to one handoff)
    // before loader-level evidence comparison runs.
    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });

  it("rejects duplicate handoff worksheet names", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[1].worksheetName = "Analysis-B";
    const { reportPath } = writeReportToTemp(report);

    // Distinction: duplicate worksheet names violate report schema constraints first.
    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });

  it("rejects workbook hash mismatch between report and handoff", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].workbookContentHash = "b".repeat(64);
    const { reportPath } = writeReportToTemp(report);

    // Distinction: schema superRefine enforces workbook hash consistency.
    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });

  it("rejects a handoff without a matching ready worksheet", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].worksheetName = "Analysis-C";
    const { reportPath } = writeReportToTemp(report);

    // Distinction: schema requires each ready worksheet to have exactly one handoff.
    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
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

  it("rejects handoff with empty factors as evidence mismatch", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].factors = [];
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "evidence_mismatch",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects handoff with duplicate factors as evidence mismatch", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].factors.push({ ...report.f4Handoffs[0].factors[0] });
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "evidence_mismatch",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects handoff with omitted worksheet factor as evidence mismatch", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].factors = [];
    report.f4Handoffs[1].factors = [];
    report.f4Handoffs[1].factors.push({ ...f4Handoff("Analysis-A", "Loop A", enhancedRow("Analysis-A", "factor-table-1", 14)).factors[0] });
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "evidence_mismatch",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects mutated system specification additionalMeanShift evidence", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].systemSpecification.additionalMeanShift.displayValue = "0.01";
    report.f4Handoffs[0].systemSpecification.additionalMeanShift.actualValue = 0.01;
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "evidence_mismatch",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects source cell mutation as evidence mismatch", () => {
    const report = buildValidF2Report();
    report.f4Handoffs[0].factors[0].sourceCells.factorName = "Analysis-B!E999";
    const { reportPath } = writeReportToTemp(report);

    expect(loadF4Handoffs(reportPath)).toEqual({
      status: "inputRejected",
      reasonCode: "evidence_mismatch",
      artifactReference: "Feature2-Report.json",
    });
  });

  it("rejects ready worksheet and handoff count mismatch", () => {
    const report = buildValidF2Report();
    report.f4Handoffs.splice(0, 1);
    const { reportPath } = writeReportToTemp(report);

    // Distinction: schema-level one-to-one requirement fails before evidence compare.
    expectSanitizedF2ReportInvalid(loadF4Handoffs(reportPath));
  });
});
