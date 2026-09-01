import { afterEach, describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { f2UserReportSchema } from "../packages/contracts/dist/contracts.js";
import { resolveFeature2OutputLayout } from "./f2-output-layout.mjs";

const cleanup = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function field(sourceCell, displayValue, numericValue) {
  return { status: "available", sourceCell, displayValue, actualValue: numericValue ?? displayValue, valueOrigin: numericValue === undefined ? "text_literal" : "numeric_literal", ...(numericValue === undefined ? {} : { numericValue }) };
}

function actualFields() {
  return {
    factorName: "outside-library factor", partName: "component", drawingNumber: null, dimCharacteristicId: null, partCategory: "unknown-category",
    nominalValue: 1, upperTolerance: 0.2, lowerTolerance: -0.2, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "Normal",
    mean: 1, tolerance: 0.4, oneSigma: 0.1, percentContributionToSigma: 1, notes: null,
  };
}

function createArtifactBundle() {
  const root = mkdtempSync(path.join(tmpdir(), "f2-flow-"));
  cleanup.push(root);
  const workbookName = "anonymous.xlsx";
  const workbookHash = "a".repeat(64);
  const imageBytes = Buffer.from([1, 2, 3]);
  const imageHash = createHash("sha256").update(imageBytes).digest("hex");
  const sheetRoot = path.join(root, "sheets", workbookName);
  const jsonRelative = `sheets/${workbookName}/json/Analysis-A.json`;
  const mdRelative = `sheets/${workbookName}/md/Analysis-A.md`;
  const imageRelative = `sheets/${workbookName}/images/Analysis-A.png`;
  for (const folder of ["json", "md", "images"]) mkdirSync(path.join(sheetRoot, folder), { recursive: true });
  writeFileSync(path.join(root, imageRelative), imageBytes);
  writeFileSync(path.join(root, mdRelative), "# Analysis-A\n");
  writeFileSync(path.join(sheetRoot, "README.md"), "# Manifest\n");
  writeFileSync(path.join(root, jsonRelative), JSON.stringify({
    taskId: "1.5-1.6",
    generatedAt: "2026-08-03T00:00:00.000Z",
    workbook: { fileName: workbookName, contentHash: workbookHash },
    worksheetName: "Analysis-A",
    toleranceLoopDescription: "Anonymous device gap",
    systemSpecification: {
      status: "available",
      designNominal: { status: "available", actualValue: -0.05, displayValue: "-0.05", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53", valueOrigin: "numeric_literal" },
      lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
      additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
    },
    factorTables: [{
      tableId: "table-a", headerRow: 1, dataRange: { startRow: 2, endRow: 2 }, columns: [],
      rows: [{ sourceRow: 2, actualFields: actualFields(), fields: {
        factorName: field("Analysis-A!A2", "outside-library factor"), partName: field("Analysis-A!B2", "component"), partCategory: field("Analysis-A!C2", "unknown-category"),
        nominalValue: field("Analysis-A!D2", "1", 1), upperTolerance: field("Analysis-A!E2", "0.2", 0.2), lowerTolerance: field("Analysis-A!F2", "-0.2", -0.2),
        longTermSafetyFactor: field("Analysis-A!G2", "1", 1), standardDeviation: field("Analysis-A!H2", "0.01", 0.01), distribution: field("Analysis-A!I2", "Normal"),
      } }],
    }],
    imageAssets: [{ contentHash: imageHash, mediaType: "image/png", byteLength: imageBytes.length, outputFile: imageRelative }],
    tolerancePathImage: { status: "available", labelSourceCell: "Analysis-A!A55", imageContentHash: imageHash, imageAnchor: { from: "A56", to: "K71" } },
  }));
  writeFileSync(path.join(root, "Feature1-Report.md"), "# Feature 1\n");
  writeFileSync(path.join(root, "Feature1-Report.json"), JSON.stringify({
    contractVersion: "v1", artifactContractVersion: "f1-semantic-v2", feature: "F1", generatedAt: "2026-08-03T00:00:00.000Z",
    workbooks: [{ workbook: { fileName: workbookName, contentHash: workbookHash }, task15_factor_table_and_debug_json: { sheets: [{ worksheetName: "Analysis-A", jsonPath: jsonRelative }] }, task16_loop_screenshot_and_run_record: { sheets: [{ worksheetName: "Analysis-A", mdPath: mdRelative }] }, sheetReadmePath: `sheets/${workbookName}/README.md` }],
  }));
  return root;
}

describe("F2 artifact-only CLI flow", () => {
  it("writes JSON and Markdown without an Excel workbook", { timeout: 15_000 }, () => {
    const artifactRoot = createArtifactBundle();
    const output = resolveFeature2OutputLayout([artifactRoot]).outRoot;
    cleanup.push(output);

    execFileSync(process.execPath, ["scripts/run-f2-full-validation.mjs", artifactRoot], { cwd: process.cwd(), stdio: "pipe" });

    const report = f2UserReportSchema.parse(JSON.parse(readFileSync(path.join(output, "Feature2-Report.json"), "utf8")));
    const markdown = readFileSync(path.join(output, "Feature2-Report.md"), "utf8");
    expect(report.status).toBe("completed");
    expect(report.summary.factorRowCount).toBe(1);
    expect(report.knowledgeBaseVersions).toEqual(["v1", "internal-v1"]);
    expect(report.summary.nonF0ProcessCategoryCount).toBe(1);
    expect(markdown).toContain("非 F0 制程分类");
    const reference = report.worksheets[0].rows[0].imageReference;
    const expectedHref = path.relative(output, path.join(artifactRoot, reference.relativePath)).split(path.sep).join("/");
    expect(markdown).toContain(`[outside-library factor](${expectedHref})`);
    expect(existsSync(path.join(output, "images"))).toBe(false);
    expect(readFileSync(path.join(artifactRoot, reference.relativePath))).toEqual(Buffer.from([1, 2, 3]));
  });
});