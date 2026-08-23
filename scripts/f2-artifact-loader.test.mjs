import { afterEach, describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadF1ArtifactBundle } from "./f2-artifact-loader.mjs";

const roots = [];
const actualFields = {
  factorName: "factor",
  partName: "part",
  drawingNumber: null,
  dimCharacteristicId: null,
  partCategory: "CNC",
  nominalValue: 3.145,
  upperTolerance: 0.1,
  lowerTolerance: -0.1,
  longTermSafetyFactor: 1,
  sigmaLevel: 4,
  distribution: "Normal",
  mean: 3.145,
  tolerance: 0.1,
  oneSigma: 0.025,
  percentContributionToSigma: 0.043,
  notes: null,
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createBundle({ artifactContractVersion } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "f2-artifacts-"));
  roots.push(root);
  const workbookName = "anonymous.xlsx";
  const workbookHash = "a".repeat(64);
  const imageBytes = Buffer.from([1, 2, 3]);
  const imageHash = createHash("sha256").update(imageBytes).digest("hex");
  const sheetRoot = path.join(root, "sheets", workbookName);
  mkdirSync(path.join(sheetRoot, "json"), { recursive: true });
  mkdirSync(path.join(sheetRoot, "md"), { recursive: true });
  mkdirSync(path.join(sheetRoot, "images"), { recursive: true });
  const jsonRelative = `sheets/${workbookName}/json/Analysis-A.json`;
  const mdRelative = `sheets/${workbookName}/md/Analysis-A.md`;
  const imageRelative = `sheets/${workbookName}/images/Analysis-A.png`;
  writeFileSync(path.join(root, imageRelative), imageBytes);
  writeFileSync(path.join(root, mdRelative), "# Analysis-A\n");
  writeFileSync(path.join(sheetRoot, "README.md"), "# Manifest\n");
  writeFileSync(path.join(root, jsonRelative), JSON.stringify({
    taskId: "1.5-1.6",
    generatedAt: "2026-08-03T00:00:00.000Z",
    workbook: { fileName: workbookName, contentHash: workbookHash },
    worksheetName: "Analysis-A",
    toleranceLoopDescription: "Anonymous device gap",
    ...(artifactContractVersion === "f1-semantic-v2" ? {
      systemSpecification: {
        status: "available",
        lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
        upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
        targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
        additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
      },
    } : {}),
    factorTables: [{
      tableId: "table-a",
      headerRow: 1,
      dataRange: { startRow: 2, endRow: 2 },
      columns: [],
      rows: [{ sourceRow: 2, fields: {}, actualFields }],
    }],
    imageAssets: [{ contentHash: imageHash, mediaType: "image/png", byteLength: imageBytes.length, outputFile: imageRelative }],
    tolerancePathImage: { status: "available", labelSourceCell: "Analysis-A!A55", imageContentHash: imageHash, imageAnchor: { from: "A56", to: "K71" } },
  }));
  writeFileSync(path.join(root, "Feature1-Report.md"), "# Feature 1\n");
  writeFileSync(path.join(root, "Feature1-Report.json"), JSON.stringify({
    contractVersion: "v1",
    ...(artifactContractVersion ? { artifactContractVersion } : {}),
    feature: "F1",
    generatedAt: "2026-08-03T00:00:00.000Z",
    workbooks: [{
      workbook: { fileName: workbookName, contentHash: workbookHash },
      task15_factor_table_and_debug_json: { sheets: [{ worksheetName: "Analysis-A", jsonPath: jsonRelative }] },
      task16_loop_screenshot_and_run_record: { sheets: [{ worksheetName: "Analysis-A", mdPath: mdRelative }] },
      sheetReadmePath: `sheets/${workbookName}/README.md`,
    }],
  }));
  return { root, imageHash };
}

describe("loadF1ArtifactBundle", () => {
  it("loads JSON, Markdown and image artifacts without a workbook", () => {
    const { root, imageHash } = createBundle();

    const loaded = loadF1ArtifactBundle(root);

    expect(loaded.status).toBe("accepted");
    expect(loaded.input.workbook.fileName).toBe("anonymous.xlsx");
    expect(loaded.input.worksheets[0].toleranceLoopDescription).toBe("Anonymous device gap");
    expect(loaded.input.worksheets[0].tolerancePathImage).toEqual({
      status: "available",
      imagePath: "sheets/anonymous.xlsx/images/Analysis-A.png",
      contentHash: imageHash,
      mediaType: "image/png",
    });
    expect(loaded.input.worksheets[0].factorTables[0].rows[0].actualFields).toEqual(actualFields);
    expect(loaded.input.worksheets[0].systemSpecification).toEqual({
      status: "unavailable",
      reasonCode: "legacy_artifact_missing_system_specification",
    });
    expect(Object.hasOwn(loaded.input, "workbookBytes")).toBe(false);
    expect(Object.hasOwn(loaded.input, "workbookPath")).toBe(false);
  });

  it("loads v2 system specification into the canonical input", () => {
    const { root } = createBundle({ artifactContractVersion: "f1-semantic-v2" });

    expect(loadF1ArtifactBundle(root)).toMatchObject({
      status: "accepted",
      input: {
        worksheets: [{
          systemSpecification: {
            status: "available",
            lowerSpecLimit: { actualValue: -0.15 },
            upperSpecLimit: { actualValue: 0.05 },
            targetSigmaLevel: { actualValue: 3 },
          },
        }],
      },
    });
  });

  it("propagates the F1 Title Page revision into the canonical workbook identity", () => {
    const { root } = createBundle({ artifactContractVersion: "f1-semantic-v2" });
    const reportPath = path.join(root, "Feature1-Report.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    report.workbooks[0].workbook.metadata = { revision: "D" };
    writeFileSync(reportPath, JSON.stringify(report));

    const loaded = loadF1ArtifactBundle(root);

    expect(loaded.status).toBe("accepted");
    expect(loaded.input.workbook.revision).toBe("D");
  });

  it("rejects a v2 artifact without a system specification source label", () => {
    const { root } = createBundle({ artifactContractVersion: "f1-semantic-v2" });
    const worksheetPath = path.join(root, "sheets/anonymous.xlsx/json/Analysis-A.json");
    const worksheet = JSON.parse(readFileSync(worksheetPath, "utf8"));
    delete worksheet.systemSpecification.lowerSpecLimit.sourceLabel;
    writeFileSync(worksheetPath, JSON.stringify(worksheet));

    expect(loadF1ArtifactBundle(root).report.artifactIssues).toContainEqual({
      reasonCode: "invalid_contract",
      artifactPath: "Feature1-Report.json",
      issuePath: "worksheets[0].systemSpecification.lowerSpecLimit.sourceLabel",
    });
  });

  it("returns an actionable report when the root Markdown is missing", () => {
    const { root } = createBundle();
    rmSync(path.join(root, "Feature1-Report.md"));

    expect(loadF1ArtifactBundle(root)).toEqual({
      status: "inputRejected",
      report: expect.objectContaining({
        status: "inputRejected",
        artifactIssues: [{ reasonCode: "root_md_missing", artifactPath: "Feature1-Report.md" }],
      }),
    });
  });

  it("rejects worksheet paths outside the artifact root", () => {
    const { root } = createBundle();
    const reportPath = path.join(root, "Feature1-Report.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    report.workbooks[0].task15_factor_table_and_debug_json.sheets[0].jsonPath = "../outside.json";
    writeFileSync(reportPath, JSON.stringify(report));

    expect(loadF1ArtifactBundle(root).report.artifactIssues).toContainEqual({ reasonCode: "path_outside_root", artifactPath: "../outside.json" });
  });

  it("rejects a worksheet JSON without a tolerance loop description", () => {
    const { root } = createBundle();
    const worksheetPath = path.join(root, "sheets/anonymous.xlsx/json/Analysis-A.json");
    const worksheet = JSON.parse(readFileSync(worksheetPath, "utf8"));
    delete worksheet.toleranceLoopDescription;
    writeFileSync(worksheetPath, JSON.stringify(worksheet));

    expect(loadF1ArtifactBundle(root).report.artifactIssues).toContainEqual({
      reasonCode: "invalid_contract",
      artifactPath: "sheets/anonymous.xlsx/json/Analysis-A.json",
    });
  });

  it("rejects empty image artifacts", () => {
    const { root } = createBundle();
    writeFileSync(path.join(root, "sheets/anonymous.xlsx/images/Analysis-A.png"), Buffer.alloc(0));

    expect(loadF1ArtifactBundle(root).report.artifactIssues).toContainEqual({ reasonCode: "image_empty", artifactPath: "sheets/anonymous.xlsx/images/Analysis-A.png" });
  });

  it("rejects a factor row missing any E:T actual field", () => {
    const { root } = createBundle();
    const worksheetPath = path.join(root, "sheets/anonymous.xlsx/json/Analysis-A.json");
    const worksheet = JSON.parse(readFileSync(worksheetPath, "utf8"));
    delete worksheet.factorTables[0].rows[0].actualFields.notes;
    writeFileSync(worksheetPath, JSON.stringify(worksheet));

    expect(loadF1ArtifactBundle(root).report.artifactIssues).toContainEqual({
      reasonCode: "invalid_contract",
      artifactPath: "Feature1-Report.json",
      issuePath: "worksheets[0].factorTables[0].rows[0].actualFields.notes",
    });
  });
});