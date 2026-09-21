import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runF2ExcelWorkflow } from "./f2-excel-runner.mjs";

const cleanup = [];
const fixedNow = () => new Date("2026-08-05T01:02:03.000Z");
const HASH = createHash("sha256").update("xlsx fixture").digest("hex");
const runnerPath = fileURLToPath(new URL("./f2-excel-runner.mjs", import.meta.url));

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
  const evidence = (actualValue, sourceCell, displayValue = String(actualValue)) => ({
    status: "available",
    actualValue,
    displayValue,
    sourceLabel: sourceCell.endsWith("P54") ? "*Lower Spec Limit ►" : sourceCell.endsWith("P55") ? "*Upper Spec Limit ►" : "*Target σ Level ►",
    sourceCell,
    valueOrigin: "numeric_literal",
  });
  const systemSpecification = {
    status: "available",
    designNominal: evidence(-0.05, "Analysis-A!P53"),
    lowerSpecLimit: evidence(-0.15, "Analysis-A!P54"),
    upperSpecLimit: evidence(0.05, "Analysis-A!P55"),
    targetSigmaLevel: evidence(3, "Analysis-A!P56", "3.0σ"),
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
  };
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "Demo.xlsx", contentHash: HASH, f1GeneratedAt: "2026-08-05T01:02:03.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot,
    worksheets: [{ worksheetName: "Analysis-A", status: "ready", tolerancePathImageStatus: "available", systemSpecification, systemSpecificationIssues: [], rows: [], missingFieldSummary: [] }],
    f4Handoffs: [{
      contractVersion: "v1",
      handoffVersion: "f4-handoff-v1",
      inputClassification: "confidential",
      status: "ready",
      workbookContentHash: HASH,
      worksheetName: "Analysis-A",
      systemSpecification: {
        designNominal: -0.05,
        lowerSpecLimit: systemSpecification.lowerSpecLimit,
        upperSpecLimit: systemSpecification.upperSpecLimit,
        targetSigmaLevel: systemSpecification.targetSigmaLevel,
        targetCpk: 1,
        additionalMeanShift: systemSpecification.additionalMeanShift,
      },
      factors: [],
    }],
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

  it("returns selectionRequired without running F2 when confirmation is absent", () => {
    const setupResult = setup();
    const executeStage = vi.fn(({ stage, env }) => {
      mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify({
        contractVersion: "v1",
        inputClassification: "confidential",
        status: "selectionRequired",
        workbook: { fileName: "Demo.xlsx", contentHash: HASH },
        options: [{
          selectionIndex: 1,
          worksheetName: "Analysis-A",
          toleranceLoopDescription: "First loop",
          worksheetKind: "analysis",
          source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
        }],
      }));
      return { stdout: `${stage} complete`, stderr: "" };
    });

    const result = runF2ExcelWorkflow({ ...setupResult, now: fixedNow, executeStage });

    expect(result.status).toBe("selectionRequired");
    expect(result.runRoot).toBe(path.join(setupResult.repositoryRoot, "test", "20260805 - Demo"));
    expect(result.f1Root).toBe(path.join(result.runRoot, "01 - F1 Data Parsing"));
    expect(result.f2Root).toBe(path.join(result.runRoot, "02 - F2 Data Cleaning"));
    expect(result.validationRoot).toBe(result.f1Root);
    expect(result.runRoot).not.toContain(`${path.sep}f2-runs${path.sep}`);
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1-selection"]);
    expect(result.promptPath).toBe(path.join(result.f1Root, "Feature1-Selection.json"));
    expect(result.selectionReference).toMatchObject({ manifestPath: result.manifestPath, promptPath: result.promptPath });
    expect(JSON.parse(readFileSync(result.manifestPath, "utf8"))).toMatchObject({
      status: "selectionRequired",
      selection: { status: "selectionRequired", promptPath: result.promptPath, selectedWorksheetNames: [] },
      stages: { "f1-selection": { status: "completed" }, f1: { status: "pending" }, f2: { status: "pending" } },
    });
    expect(readFileSync(path.join(result.f1Root, "f1-selection.stdout.log"), "utf8")).toContain("f1-selection complete");
    expect(existsSync(path.join(result.f2Root, "Feature1-Selection.json"))).toBe(false);
    expect(existsSync(path.join(result.f2Root, "f1-selection.stdout.log"))).toBe(false);
    expect(existsSync(path.join(setupResult.repositoryRoot, "test", "demo-output", "f2-runs"))).toBe(false);
  });

  it("runs F1, F2, and validation after explicit confirmation in the original selection run", () => {
    const setupResult = setup();
    const executeStage = vi.fn(({ stage, args, env }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify({
          contractVersion: "v1",
          inputClassification: "confidential",
          status: "selectionRequired",
          workbook: { fileName: "Demo.xlsx", contentHash: HASH },
          options: [{
            selectionIndex: 1,
            worksheetName: "Analysis-A",
            toleranceLoopDescription: "First loop",
            worksheetKind: "analysis",
            source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
          }],
        }));
      } else if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
      } else {
        mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      }
      return { stdout: `${stage} complete`, stderr: "" };
    });

    const selection = runF2ExcelWorkflow({ ...setupResult, now: fixedNow, executeStage });

    const result = runF2ExcelWorkflow({
      ...setupResult,
      now: fixedNow,
      executeStage,
      worksheetSelection: {
        workbookContentHash: HASH,
        selectedWorksheetNames: ["Analysis-A"],
        selectionReference: selection.selectionReference,
        confirmed: true,
      },
    });

    expect(result.runRoot).toBe(selection.runRoot);
    expect(result.runRoot).toBe(path.join(setupResult.repositoryRoot, "test", "20260805 - Demo"));
    expect(result.f1Root).toBe(path.join(result.runRoot, "01 - F1 Data Parsing"));
    expect(result.f2Root).toBe(path.join(result.runRoot, "02 - F2 Data Cleaning"));
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1-selection", "f1", "f2"]);
    expect(executeStage.mock.calls[1][0].args).toEqual([
      "scripts/run-f1-full-validation.mjs",
      setupResult.workbookPath,
      "--workbook-hash",
      HASH,
      "--worksheets",
      "Analysis-A",
      "--confirm",
      "--analysis-root",
      selection.runRoot,
    ]);
    expect(result.validationRoot).toBe(result.f1Root);
    expect(JSON.parse(readFileSync(result.manifestPath, "utf8"))).toMatchObject({
      status: "completed",
      selection: { status: "confirmed", selectedWorksheetNames: ["Analysis-A"] },
      stages: { f1: { status: "completed" }, f2: { status: "completed" }, validation: { status: "completed" } },
    });
    expect(JSON.parse(readFileSync(path.join(result.f2Root, "Feature2-Validation.json"), "utf8"))).toMatchObject({ status: "valid" });
    expect(readFileSync(path.join(result.f1Root, "Feature1-Selection.json"), "utf8")).toContain("\"selectionRequired\"");
    expect(readFileSync(path.join(result.f1Root, "f1-selection.stdout.log"), "utf8")).toContain("f1-selection complete");
    expect(readFileSync(path.join(result.f1Root, "f1.stdout.log"), "utf8")).toContain("f1 complete");
    expect(existsSync(path.join(result.f2Root, "Feature1-Selection.json"))).toBe(false);
    expect(existsSync(path.join(result.f2Root, "f1-selection.stdout.log"))).toBe(false);
    expect(existsSync(path.join(result.f2Root, "f1.stdout.log"))).toBe(false);
    expect(existsSync(path.join(result.f1Root, "Feature2-Report.json"))).toBe(false);
    expect(existsSync(path.join(result.f1Root, "Feature2-Validation.json"))).toBe(false);
    expect(existsSync(path.join(result.f1Root, "f2.stdout.log"))).toBe(false);
    expect(existsSync(path.join(setupResult.repositoryRoot, "test", "demo-output", "f2-runs"))).toBe(false);
  });

  it("keeps the manifest and completed F1 output when F2 fails", () => {
    const setupResult = setup();
    const executeStage = ({ stage, env }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify({
          contractVersion: "v1",
          inputClassification: "confidential",
          status: "selectionRequired",
          workbook: { fileName: "Demo.xlsx", contentHash: HASH },
          options: [{
            selectionIndex: 1,
            worksheetName: "Analysis-A",
            toleranceLoopDescription: "First loop",
            worksheetKind: "analysis",
            source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
          }],
        }));
        return { stdout: "f1-selection complete", stderr: "" };
      }
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
        return { stdout: "f1 complete", stderr: "" };
      }
      throw new Error("F2 failed");
    };

    const selection = runF2ExcelWorkflow({ ...setupResult, now: fixedNow, executeStage });

    expect(() => runF2ExcelWorkflow({
      ...setupResult,
      now: fixedNow,
      executeStage,
      worksheetSelection: {
        workbookContentHash: HASH,
        selectedWorksheetNames: ["Analysis-A"],
        selectionReference: selection.selectionReference,
        confirmed: true,
      },
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "internal_error",
      summary: "Workflow runner failed unexpectedly.",
    }));

    const runRoot = path.join(setupResult.repositoryRoot, "test", "20260805 - Demo");
    expect(readFileSync(path.join(runRoot, "01 - F1 Data Parsing", "Feature1-Report.json"), "utf8")).toBe("{}");
    expect(JSON.parse(readFileSync(path.join(runRoot, "manifest.json"), "utf8"))).toMatchObject({ status: "failed", stages: { f1: { status: "completed" }, f2: { status: "failed" }, validation: { status: "pending" } } });
  });

  it("allows a wrapper retry after F2 fails by resolving the same confirmed selection internally", () => {
    const setupResult = setup();
    const f1Payload = '{"artifact":"f1"}';
    const executeStage = ({ stage, env }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify({
          contractVersion: "v1",
          inputClassification: "confidential",
          status: "selectionRequired",
          workbook: { fileName: "Demo.xlsx", contentHash: HASH },
          options: [{
            selectionIndex: 1,
            worksheetName: "Analysis-A",
            toleranceLoopDescription: "First loop",
            worksheetKind: "analysis",
            source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
          }],
        }));
        return { stdout: "f1-selection complete", stderr: "" };
      }
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), f1Payload);
        return { stdout: "f1 complete", stderr: "" };
      }
      throw new Error("F2 failed");
    };

    runF2ExcelWorkflow({ ...setupResult, now: fixedNow, executeStage });

    expect(() => runF2ExcelWorkflow({
      ...setupResult,
      now: fixedNow,
      executeStage,
      worksheetSelection: {
        workbookContentHash: HASH,
        selectedWorksheetNames: ["Analysis-A"],
        confirmed: true,
      },
    })).toThrow();

    const retryExecuteStage = vi.fn(({ stage, args, env }) => {
      if (stage === "f1") throw new Error("wrapper retry should not rerun F1");
      mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      return { stdout: `${stage} complete`, stderr: "" };
    });

    const result = runF2ExcelWorkflow({
      ...setupResult,
      now: fixedNow,
      executeStage: retryExecuteStage,
      worksheetSelection: {
        workbookContentHash: HASH,
        selectedWorksheetNames: ["Analysis-A"],
        confirmed: true,
      },
    });

    expect(result.status).toBe("completed");
    expect(retryExecuteStage.mock.calls.map(([request]) => request.stage)).toEqual(["f2"]);
    expect(readFileSync(path.join(result.f1Root, "Feature1-Report.json"), "utf8")).toBe(f1Payload);
  });

  it("requires an existing pending selection before confirmation", () => {
    const setupResult = setup();

    expect(() => runF2ExcelWorkflow({
      ...setupResult,
      now: fixedNow,
      worksheetSelection: { workbookContentHash: HASH, selectedWorksheetNames: ["Analysis-A"], confirmed: true },
    })).toThrow(expect.objectContaining({ code: "evidence_mismatch" }));
  });

  it("resolves the uniquely matching completed selection when other completed scopes share the workbook hash", () => {
    const setupResult = setup();
    const managedOutputRoot = path.join(setupResult.repositoryRoot, "test");
    const createCompletedSelection = (runId, selectedWorksheetNames) => {
      const runRoot = path.join(managedOutputRoot, "f2-runs", "Demo", runId);
      const f1Root = path.join(runRoot, "f1");
      const f2Root = path.join(runRoot, "f2");
      const validationRoot = path.join(runRoot, "validation");
      const manifestPath = path.join(runRoot, "manifest.json");
      const promptPath = path.join(validationRoot, "Feature1-Selection.json");
      mkdirSync(f1Root, { recursive: true });
      mkdirSync(f2Root, { recursive: true });
      mkdirSync(validationRoot, { recursive: true });
      writeFileSync(promptPath, JSON.stringify({
        contractVersion: "v1",
        inputClassification: "confidential",
        status: "selectionRequired",
        workbook: { fileName: "Demo.xlsx", contentHash: HASH },
        options: ["Analysis-A", "Analysis-B"].map((worksheetName, index) => ({
          selectionIndex: index + 1,
          worksheetName,
          toleranceLoopDescription: worksheetName,
          worksheetKind: "analysis",
          source: { summarySheet: "Auto Summary", summaryRow: index + 10, worksheetAnchor: `${worksheetName}!A1` },
        })),
      }));
      writeFileSync(manifestPath, JSON.stringify({
        contractVersion: "v1",
        runId,
        status: "completed",
        workbookPath: setupResult.workbookPath,
        repositoryRoot: setupResult.repositoryRoot,
        runRoot,
        startedAt: "2026-08-05T01:02:03.000Z",
        updatedAt: "2026-08-05T01:02:03.000Z",
        outputs: { f1Root, f2Root, validationRoot },
        selection: { status: "confirmed", promptPath, workbookContentHash: HASH, selectedWorksheetNames },
        execution: { status: "completed" },
        stages: { "f1-selection": { status: "completed" }, f1: { status: "completed" }, f2: { status: "completed" }, validation: { status: "completed" } },
      }));
      return { runId, runRoot, manifestPath, promptPath, workbookPath: setupResult.workbookPath, workbookContentHash: HASH, status: "completed" };
    };
    const matchingSelection = createCompletedSelection("2026-08-05T01-02-03-000Z", ["Analysis-A"]);
    const otherSelection = createCompletedSelection("2026-08-04T01-02-03-000Z", ["Analysis-B"]);
    writeFileSync(path.join(matchingSelection.runRoot, "f2", "Feature2-Report.json"), JSON.stringify(validF2Report(path.join(matchingSelection.runRoot, "f1"))));
    writeFileSync(path.join(managedOutputRoot, "f2-selection-registry.json"), JSON.stringify({
      contractVersion: "v1",
      selections: [otherSelection, matchingSelection],
    }));

    const result = runF2ExcelWorkflow({
      ...setupResult,
      now: fixedNow,
      worksheetSelection: { workbookContentHash: HASH, selectedWorksheetNames: ["Analysis-A"], confirmed: true },
    });

    expect(result.status).toBe("completed");
    expect(result.runId).toBe(matchingSelection.runId);
  });

  it("accepts the documented README confirmation command without a selection manifest flag", () => {
    const setupResult = setup();
    const repositoryRoot = setupResult.repositoryRoot;
    const managedOutputRoot = path.join(repositoryRoot, "test");
    const selectionRoot = path.join(repositoryRoot, "test", "20260805 - Demo");
    mkdirSync(path.join(repositoryRoot, "scripts"), { recursive: true });
    mkdirSync(path.join(selectionRoot, "01 - F1 Data Parsing"), { recursive: true });
    mkdirSync(path.join(selectionRoot, "02 - F2 Data Cleaning"), { recursive: true });
    writeFileSync(path.join(repositoryRoot, "scripts", "run-f1-full-validation.mjs"), `
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputRoot = process.env.AI_TVA_F1_OUTPUT_ROOT;
mkdirSync(outputRoot, { recursive: true });
writeFileSync(path.join(outputRoot, "Feature1-Report.json"), "{}");
`, "utf8");
    writeFileSync(path.join(repositoryRoot, "scripts", "run-f2-full-validation.mjs"), `
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputRoot = process.env.AI_TVA_F2_OUTPUT_ROOT;
mkdirSync(outputRoot, { recursive: true });
writeFileSync(path.join(outputRoot, "Feature2-Report.json"), ${JSON.stringify(JSON.stringify(validF2Report(path.join(selectionRoot, "01 - F1 Data Parsing"))))});
`, "utf8");
    writeFileSync(path.join(selectionRoot, "01 - F1 Data Parsing", "Feature1-Selection.json"), JSON.stringify({
      contractVersion: "v1",
      inputClassification: "confidential",
      status: "selectionRequired",
      workbook: { fileName: "Demo.xlsx", contentHash: HASH },
      options: [{
        selectionIndex: 1,
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "First loop",
        worksheetKind: "analysis",
        source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
      }],
    }));
    writeFileSync(path.join(selectionRoot, "manifest.json"), `${JSON.stringify({
      contractVersion: "v1",
      runId: "20260805 - Demo",
      status: "selectionRequired",
      workbookPath: setupResult.workbookPath,
      repositoryRoot,
      runRoot: selectionRoot,
      startedAt: "2026-08-05T01:02:03.000Z",
      updatedAt: "2026-08-05T01:02:03.000Z",
      outputs: {
        f1Root: path.join(selectionRoot, "01 - F1 Data Parsing"),
        f2Root: path.join(selectionRoot, "02 - F2 Data Cleaning"),
        validationRoot: path.join(selectionRoot, "01 - F1 Data Parsing"),
      },
      selection: {
        status: "selectionRequired",
        promptPath: path.join(selectionRoot, "01 - F1 Data Parsing", "Feature1-Selection.json"),
        workbookContentHash: HASH,
        selectedWorksheetNames: [],
      },
      stages: {
        "f1-selection": { status: "completed" },
        f1: { status: "pending" },
        f2: { status: "pending" },
        validation: { status: "pending" },
      },
    }, null, 2)}\n`);
    writeFileSync(path.join(managedOutputRoot, "f2-selection-registry.json"), `${JSON.stringify({
      contractVersion: "v1",
      selections: [{
        runId: "20260805 - Demo",
        runRoot: selectionRoot,
        manifestPath: path.join(selectionRoot, "manifest.json"),
        promptPath: path.join(selectionRoot, "01 - F1 Data Parsing", "Feature1-Selection.json"),
        workbookPath: setupResult.workbookPath,
        workbookContentHash: HASH,
        status: "selectionRequired",
      }],
    }, null, 2)}\n`);

    const output = execFileSync(process.execPath, [
      runnerPath,
      setupResult.workbookPath,
      "--worksheets",
      "Analysis-A",
      "--workbook-hash",
      HASH,
      "--confirm",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        AI_TVA_F1_OUTPUT_ROOT: path.join(selectionRoot, "01 - F1 Data Parsing"),
        AI_TVA_F2_OUTPUT_ROOT: path.join(selectionRoot, "02 - F2 Data Cleaning"),
      },
    });

    expect(JSON.parse(output)).toMatchObject({ status: "completed", runRoot: selectionRoot });
  });
});