import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runF2ExcelWorkflow } from "./f2-excel-runner.mjs";

const cleanup = [];
const fixedNow = () => new Date("2026-08-05T01:02:03.000Z");

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function setup() {
  const repositoryRoot = mkdtempSync(path.join(tmpdir(), "f2-runner-"));
  cleanup.push(repositoryRoot);
  const workbookPath = path.join(repositoryRoot, "Demo.xlsx");
  writeFileSync(workbookPath, "xlsx fixture");
  return { repositoryRoot, workbookPath };
}

function validF2Report(artifactRoot) {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-05T01:02:03.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot,
    worksheets: [{ worksheetName: "Analysis-A", status: "ready", tolerancePathImageStatus: "available", rows: [], missingFieldSummary: [] }],
    adoEvents: [],
    summary: {
      worksheetsChecked: 1, blockedWorksheetCount: 0, readyWorksheetCount: 1, factorRowCount: 0,
      rowsWithRequiredMissing: 0, requiredMissingFieldCount: 0, missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 0, internalGuidanceExceededCount: 0, f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0, nonF0ProcessCategoryCount: 0, unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0, publicDistributionDifferenceCount: 0, missingDimIdCount: 0, missingPartNumberCount: 0,
    },
  };
}

describe("runF2ExcelWorkflow", () => {
  it("requires one explicit existing xlsx workbook", () => {
    const setupResult = setup();
    expect(() => runF2ExcelWorkflow({ ...setupResult, workbookPath: path.join(setupResult.repositoryRoot, "Demo.xlsm"), now: fixedNow })).toThrow("exactly one .xlsx workbook");
    expect(() => runF2ExcelWorkflow({ ...setupResult, workbookPath: path.join(setupResult.repositoryRoot, "Missing.xlsx"), now: fixedNow })).toThrow("does not exist");
  });

  it("runs F1, F2, and validation in one isolated UTC run", () => {
    const setupResult = setup();
    const executeStage = vi.fn(({ stage, args, env }) => {
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
      } else {
        mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      }
      return { stdout: `${stage} complete`, stderr: "" };
    });

    const result = runF2ExcelWorkflow({ ...setupResult, now: fixedNow, executeStage });

    expect(result.runRoot.replace(/\\/g, "/").endsWith("/Demo/2026-08-05T01-02-03-000Z")).toBe(true);
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1", "f2"]);
    expect(result.validationRoot).toBe(path.join(result.runRoot, "validation"));
    expect(JSON.parse(readFileSync(result.manifestPath, "utf8"))).toMatchObject({ status: "completed", stages: { f1: { status: "completed" }, f2: { status: "completed" }, validation: { status: "completed" } } });
    expect(JSON.parse(readFileSync(path.join(result.validationRoot, "Feature2-Validation.json"), "utf8"))).toMatchObject({ status: "valid" });
  });

  it("keeps the manifest and completed F1 output when F2 fails", () => {
    const setupResult = setup();
    const executeStage = ({ stage, env }) => {
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
        return { stdout: "f1 complete", stderr: "" };
      }
      throw new Error("F2 failed");
    };

    expect(() => runF2ExcelWorkflow({ ...setupResult, now: fixedNow, executeStage })).toThrow("F2 failed");

    const runRoot = path.join(setupResult.repositoryRoot, "test", "demo-output", "f2-runs", "Demo", "2026-08-05T01-02-03-000Z");
    expect(readFileSync(path.join(runRoot, "f1", "Feature1-Report.json"), "utf8")).toBe("{}");
    expect(JSON.parse(readFileSync(path.join(runRoot, "manifest.json"), "utf8"))).toMatchObject({ status: "failed", stages: { f1: { status: "completed" }, f2: { status: "failed" }, validation: { status: "pending" } } });
  });
});