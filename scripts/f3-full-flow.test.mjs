import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function f2Report() {
  const row = {
    worksheetName: "Analysis-A",
    tableId: "factor-table-1",
    sourceRow: 14,
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
    sourceCells: { factorName: "Analysis-A!E14" },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "non_f0_process_category",
    adoReminderRequested: false,
  };
  const systemSpecification = {
    status: "available",
    lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
  };
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "controlled/f1",
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous device gap",
      status: "ready",
      tolerancePathImageStatus: "available",
      systemSpecification,
      systemSpecificationIssues: [],
      rows: [row],
      missingFieldSummary: [],
    }],
    f4Handoffs: [{
      contractVersion: "v1", handoffVersion: "f4-handoff-v1", inputClassification: "confidential", status: "ready",
      workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", toleranceLoopDescription: "Anonymous device gap",
      systemSpecification: {
        designNominal: -0.05, lowerSpecLimit: systemSpecification.lowerSpecLimit, upperSpecLimit: systemSpecification.upperSpecLimit,
        targetSigmaLevel: systemSpecification.targetSigmaLevel, targetCpk: 1, additionalMeanShift: systemSpecification.additionalMeanShift,
      },
      factors: [{ tableId: row.tableId, sourceRow: row.sourceRow, unit: "mm", actualFields: row.actualFields, sourceCells: row.sourceCells }],
    }],
    adoEvents: [],
    summary: {
      worksheetsChecked: 1,
      blockedWorksheetCount: 0,
      readyWorksheetCount: 1,
      factorRowCount: 1,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: 1,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  };
}

describe("Feature 3 local artifact flow", () => {
  it("writes matching Feature 3 JSON and Markdown reports", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f3-flow-"));
    roots.push(root);
    const f2Root = path.join(root, "f2");
    const outputRoot = path.join(root, "f3");
    mkdirSync(f2Root);
    writeFileSync(path.join(f2Root, "Feature2-Report.json"), JSON.stringify(f2Report()));

    const stdout = execFileSync(process.execPath, ["scripts/run-f3-full-validation.mjs", f2Root], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, AI_TVA_F3_OUTPUT_ROOT: outputRoot },
    });
    const result = JSON.parse(stdout);
    const json = JSON.parse(readFileSync(result.reportJsonPath, "utf8"));
    const markdown = readFileSync(result.reportMdPath, "utf8");

    expect(result.status).toBe("governance_required");
    expect(json.modelVersion).toBe("drawing-governance-v2");
    expect(json.ado.status).toBe("not_requested");
    expect(markdown).toContain("Dimension Description");
    expect(markdown).toContain(json.worksheets[0].toleranceLoopDescription);
  });
});