import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadF2ArtifactBundle } from "./f3-artifact-loader.mjs";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function enhancedRow() {
  return {
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
}

function systemSpecification() {
  return {
    status: "available",
    lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", valueOrigin: "defaulted" },
  };
}

function f4Handoff(row) {
  const specification = systemSpecification();
  return {
    contractVersion: "v1", handoffVersion: "f4-handoff-v1", inputClassification: "confidential", status: "ready",
    workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", toleranceLoopDescription: "Anonymous device gap",
    systemSpecification: {
      designNominal: -0.05, lowerSpecLimit: specification.lowerSpecLimit, upperSpecLimit: specification.upperSpecLimit,
      targetSigmaLevel: specification.targetSigmaLevel, targetCpk: 1, additionalMeanShift: specification.additionalMeanShift,
    },
    factors: [{ tableId: row.tableId, sourceRow: row.sourceRow, unit: "mm", actualFields: row.actualFields, sourceCells: row.sourceCells }],
  };
}

function f2Report(options = {}) {
  const description = Object.hasOwn(options, "description") ? options.description : "Anonymous device gap";
  const worksheetStatus = options.worksheetStatus ?? "ready";
  const row = enhancedRow();
  const blocked = worksheetStatus === "blocked";
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: blocked ? "blocked" : "completed",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "controlled/f1",
    worksheets: [{
      worksheetName: "Analysis-A",
      ...(description === undefined ? {} : { toleranceLoopDescription: description }),
      status: worksheetStatus,
      tolerancePathImageStatus: blocked ? "unavailable" : "available",
      systemSpecification: systemSpecification(),
      systemSpecificationIssues: [],
      rows: [row],
      missingFieldSummary: blocked ? [{ field: "tolerancePathImage", factorCount: 0, sourceRows: [] }] : [],
    }],
    f4Handoffs: blocked ? [] : [f4Handoff(row)],
    adoEvents: [],
    summary: {
      worksheetsChecked: 1,
      blockedWorksheetCount: blocked ? 1 : 0,
      readyWorksheetCount: blocked ? 0 : 1,
      factorRowCount: 1,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: blocked ? 1 : 0,
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

function createF2Output(report = f2Report()) {
  const root = mkdtempSync(path.join(tmpdir(), "f3-loader-"));
  roots.push(root);
  writeFileSync(path.join(root, "Feature2-Report.json"), JSON.stringify(report));
  writeFileSync(path.join(root, "Feature2-Report.md"), "# Feature 2\n");
  return root;
}

describe("loadF2ArtifactBundle", () => {
  it("loads only a structured Feature 2 JSON report", () => {
    const loaded = loadF2ArtifactBundle(createF2Output());

    expect(loaded.status).toBe("accepted");
    expect(loaded.request.worksheets[0].toleranceLoopDescription).toBe("Anonymous device gap");
    expect(loaded.request.worksheets[0].f2Status).toBe("ready");
  });

  it("does not recover descriptions from Markdown", () => {
    const root = createF2Output(f2Report({ description: undefined }));
    writeFileSync(path.join(root, "Feature2-Report.md"), "Anonymous device gap");

    expect(loadF2ArtifactBundle(root)).toMatchObject({
      status: "inputRejected",
      report: { artifactIssues: [{ reasonCode: "description_missing" }] },
    });
  });

  it("rejects a report without a ready worksheet", () => {
    expect(loadF2ArtifactBundle(createF2Output(f2Report({ worksheetStatus: "blocked" })))).toMatchObject({
      status: "inputRejected",
      report: { artifactIssues: [{ reasonCode: "no_ready_worksheet" }] },
    });
  });
});