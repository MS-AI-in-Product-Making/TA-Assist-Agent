import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { f2UserReportSchema } from "../packages/contracts/dist/contracts.js";
import { loadF2ArtifactBundle } from "./f3-artifact-loader.mjs";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function enhancedRow(worksheetName = "Analysis-A") {
  return {
    worksheetName,
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
    sourceCells: { factorName: `${worksheetName}!E14` },
    imageReference: {
      artifact: "f1",
      relativePath: `worksheets/${worksheetName}/tolerance-path.png`,
      contentHash: "b".repeat(64),
      worksheetName,
    },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "non_f0_process_category",
    adoReminderRequested: false,
  };
}

function systemSpecification() {
  return {
    status: "available",
    lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
  };
}

function f4Handoff(row, worksheetName = "Analysis-A", toleranceLoopDescription = "Anonymous device gap") {
  const specification = systemSpecification();
  return {
    contractVersion: "v1", handoffVersion: "f4-handoff-v1", inputClassification: "confidential", status: "ready",
    workbookContentHash: "a".repeat(64), worksheetName, toleranceLoopDescription,
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
  const secondRow = enhancedRow("Analysis-B");
  const worksheets = [{
    worksheetName: "Analysis-A",
    ...(description === undefined ? {} : { toleranceLoopDescription: description }),
    status: worksheetStatus,
    tolerancePathImageStatus: blocked ? "unavailable" : "available",
    systemSpecification: systemSpecification(),
    systemSpecificationIssues: [],
    rows: [row],
    missingFieldSummary: blocked ? [{ field: "tolerancePathImage", factorCount: 0, sourceRows: [] }] : [],
  }];
  if (options.secondReady) worksheets.push({
    worksheetName: "Analysis-B",
    toleranceLoopDescription: "Anonymous device gap Analysis-B",
    status: "ready",
    tolerancePathImageStatus: "available",
    systemSpecification: systemSpecification(),
    systemSpecificationIssues: [],
    rows: [secondRow],
    missingFieldSummary: [],
  });
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: blocked ? (options.secondReady ? "partiallyBlocked" : "blocked") : "completed",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "controlled/f1",
    worksheets,
    f4Handoffs: [
      ...(!blocked ? [f4Handoff(row, "Analysis-A", description)] : []),
      ...(options.secondReady ? [f4Handoff(secondRow, "Analysis-B", "Anonymous device gap Analysis-B")] : []),
    ],
    adoEvents: [],
    summary: {
      worksheetsChecked: worksheets.length,
      blockedWorksheetCount: blocked ? 1 : 0,
      readyWorksheetCount: blocked ? worksheets.length - 1 : worksheets.length,
      factorRowCount: worksheets.length,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: blocked ? 1 : 0,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: worksheets.length,
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
  it("uses a valid F2 report fixture", () => {
    const parsed = f2UserReportSchema.safeParse(f2Report({ secondReady: true }));
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });

  it("loads only a structured Feature 2 JSON report", () => {
    const loaded = loadF2ArtifactBundle(createF2Output());

    expect(loaded.status).toBe("accepted");
    expect(loaded.request.worksheets[0].toleranceLoopDescription).toBe("Anonymous device gap");
    expect(loaded.request.worksheets[0].f2Status).toBe("ready");
    expect(loaded.request.artifactRoot).toBe("controlled/f1");
  });

  it("filters ready worksheets in the requested order", () => {
    const loaded = loadF2ArtifactBundle(createF2Output(f2Report({ secondReady: true })), {
      selectedWorksheetNames: ["Analysis-B"],
    });

    expect(loaded.status).toBe("accepted");
    expect(loaded.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-B"]);
  });

  it("keeps all ready worksheets when no selection is provided", () => {
    const loaded = loadF2ArtifactBundle(createF2Output(f2Report({ secondReady: true })));

    expect(loaded.status).toBe("accepted");
    expect(loaded.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
  });

  it.each([
    { selection: [], reference: "empty" },
    { selection: ["Analysis-A", "Analysis-A"], reference: "Analysis-A" },
    { selection: ["Unknown"], reference: "Unknown" },
  ])("rejects an invalid worksheet selection: $reference", ({ selection, reference }) => {
    expect(loadF2ArtifactBundle(createF2Output(f2Report({ secondReady: true })), {
      selectedWorksheetNames: selection,
    })).toMatchObject({
      status: "inputRejected",
      report: {
        artifactIssues: [{
          reasonCode: "worksheet_selection_invalid",
          artifactReference: expect.stringContaining(reference),
        }],
      },
    });
  });

  it("rejects selecting a blocked worksheet", () => {
    expect(loadF2ArtifactBundle(createF2Output(f2Report({ worksheetStatus: "blocked", secondReady: true })), {
      selectedWorksheetNames: ["Analysis-A"],
    })).toMatchObject({
      status: "inputRejected",
      report: { artifactIssues: [{ reasonCode: "worksheet_selection_invalid" }] },
    });
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