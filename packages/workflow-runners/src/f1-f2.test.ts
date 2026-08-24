import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runF1F2Confirmed, runF1F2Selection } from "./index.js";

const cleanup = [] as string[];

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

const HASH = "a".repeat(64);
const fixedNow = () => new Date("2026-08-05T01:02:03.000Z");

function setupRepo() {
  const repositoryRoot = mkdtempSync(path.join(tmpdir(), "workflow-runners-f2-"));
  cleanup.push(repositoryRoot);
  const workbookPath = path.join(repositoryRoot, "Demo.xlsx");
  writeFileSync(workbookPath, "xlsx fixture");
  return { repositoryRoot, workbookPath };
}

function context(repositoryRoot: string) {
  return {
    repositoryRoot,
    managedOutputRoot: path.join(repositoryRoot, "managed-output"),
    attemptId: "attempt-1",
    signal: new AbortController().signal,
    emit: vi.fn(),
  };
}

function selectionPrompt() {
  return {
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
  };
}

function validF2Report(artifactRoot: string) {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "Demo.xlsx", contentHash: HASH, f1GeneratedAt: "2026-08-05T01:02:03.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot,
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "First loop",
      status: "ready",
      tolerancePathImageStatus: "available",
      systemSpecification: {
        status: "available",
        lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
        upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
        targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
        additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
      },
      systemSpecificationIssues: [],
      rows: [],
      missingFieldSummary: [],
    }],
    f4Handoffs: [{
      contractVersion: "v1",
      handoffVersion: "f4-handoff-v1",
      inputClassification: "confidential",
      status: "ready",
      workbookContentHash: HASH,
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "First loop",
      systemSpecification: {
        designNominal: -0.05,
        lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
        upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
        targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
        targetCpk: 1,
        additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
      },
      factors: [],
    }],
    adoEvents: [],
    summary: {
      worksheetsChecked: 1,
      blockedWorksheetCount: 0,
      readyWorksheetCount: 1,
      factorRowCount: 0,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: 0,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  };
}

describe("runF1F2Selection", () => {
  it("returns the validated worksheet selection prompt and no F2 artifact", async () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ env }) => {
      mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
      return { stdout: "ok", stderr: "" };
    });

    const result = await runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });

    expect(result).toMatchObject({
      status: "selectionRequired",
      workbookContentHash: HASH,
      selectedWorksheetNames: [],
      runRoot: path.join(setup.repositoryRoot, "managed-output", "f2-runs", "Demo", "2026-08-05T01-02-03-000Z"),
      f2Root: path.join(result.runRoot, "f2"),
    });
    expect(result.selectionReference).toMatchObject({
      runId: result.runId,
      runRoot: result.runRoot,
      manifestPath: result.manifestPath,
      promptPath: result.promptPath,
    });
  });

  it("fails with a typed transient error when the signal is already aborted", async () => {
    const setup = setupRepo();
    const controller = new AbortController();
    controller.abort();

    expect(() => runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, {
      repositoryRoot: setup.repositoryRoot,
      managedOutputRoot: path.join(setup.repositoryRoot, "managed-output"),
      attemptId: "attempt-1",
      signal: controller.signal,
      emit: vi.fn(),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "transient_error",
      retryable: true,
    }));
  });
});

describe("runF1F2Confirmed", () => {
  it("continues in the original selection run and validates manifest, prompt, and workbook identity", async () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ stage, env, args }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
        return { stdout: "selection complete", stderr: "" };
      }
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
        return { stdout: "f1 complete", stderr: "" };
      }

      mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      return { stdout: "f2 complete", stderr: "" };
    });

    const selection = await runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });

    const result = await runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage });

    expect(result).toMatchObject({
      status: "completed",
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      runId: selection.runId,
      runRoot: selection.runRoot,
    });
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1-selection", "f1", "f2"]);
    expect(JSON.parse(readFileSync(path.join(result.validationRoot, "Feature2-Validation.json"), "utf8"))).toMatchObject({ status: "valid" });
  });

  it("rejects stale or cross-run confirmations before executing F1", async () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ stage, env }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
        return { stdout: "selection complete", stderr: "" };
      }
      return { stdout: "unexpected", stderr: "" };
    });
    const selection = await runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: "b".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage })).toThrow(expect.objectContaining({
      name: "Error",
      code: "evidence_mismatch",
      retryable: false,
    }));
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1-selection"]);
  });

  it("normalizes ordinary and unknown stage failures to typed errors", async () => {
    const setup = setupRepo();
    const selectionExecuteStage = vi.fn(({ env }) => {
      mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
      return { stdout: "selection complete", stderr: "" };
    });
    const selection = await runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage: selectionExecuteStage });

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), {
      executeStage: vi.fn(({ stage }) => {
        if (stage === "f1") throw new Error("spawn python ENOENT");
        return { stdout: "ok", stderr: "" };
      }),
    })).toThrow(expect.objectContaining({ name: "Error", code: "dependency_error" }));

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), {
      executeStage: vi.fn(({ stage }) => {
        if (stage === "f1") throw "secret=abc";
        return { stdout: "ok", stderr: "" };
      }),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "internal_error",
      summary: "Workflow runner failed unexpectedly.",
    }));
  });
});