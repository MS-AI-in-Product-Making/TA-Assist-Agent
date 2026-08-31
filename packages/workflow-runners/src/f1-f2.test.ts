import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

function selectionPromptWithNames(worksheetNames: readonly string[]) {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "selectionRequired",
    workbook: { fileName: "Demo.xlsx", contentHash: HASH },
    options: worksheetNames.map((worksheetName, index) => ({
      selectionIndex: index + 1,
      worksheetName,
      toleranceLoopDescription: `Loop ${index + 1}`,
      worksheetKind: "analysis",
      source: { summarySheet: "Auto Summary", summaryRow: 10 + index, worksheetAnchor: `${worksheetName}!A1` },
    })),
  };
}

function selectionManifest(selection: ReturnType<typeof runF1F2Selection>) {
  return JSON.parse(readFileSync(selection.manifestPath, "utf8")) as {
    selection: { promptPath?: string };
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

  it("resolves an unambiguous pending selection from the managed registry without an explicit selection reference", async () => {
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

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });

    const result = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage });

    expect(result.runRoot).toBe(selection.runRoot);
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1-selection", "f1", "f2"]);
  });

  it("retries from F1 when confirmation failed before F1 side effects", async () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ stage, env, args }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
        return { stdout: "selection complete", stderr: "" };
      }
      if (stage === "f1") throw new Error("F1 unavailable before writing artifacts");
      mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      return { stdout: "f2 complete", stderr: "" };
    });

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage })).toThrow();

    const retryExecuteStage = vi.fn(({ stage, env, args }) => {
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
        return { stdout: "f1 complete", stderr: "" };
      }
      mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      return { stdout: "f2 complete", stderr: "" };
    });

    const result = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage: retryExecuteStage });

    expect(result.status).toBe("completed");
    expect(retryExecuteStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1", "f2"]);
  });

  it("retries from F2 without overwriting completed F1 artifacts", async () => {
    const setup = setupRepo();
    const f1Payload = '{"artifact":"f1"}';
    const executeStage = vi.fn(({ stage, env }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
        return { stdout: "selection complete", stderr: "" };
      }
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), f1Payload);
        return { stdout: "f1 complete", stderr: "" };
      }
      throw new Error("F2 failed");
    });

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage })).toThrow();

    const retryExecuteStage = vi.fn(({ stage, env, args }) => {
      if (stage === "f1") throw new Error("retry should reuse completed F1");
      mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      return { stdout: "f2 complete", stderr: "" };
    });

    const result = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage: retryExecuteStage });

    expect(result.status).toBe("completed");
    expect(retryExecuteStage.mock.calls.map(([request]) => request.stage)).toEqual(["f2"]);
    expect(readFileSync(path.join(result.f1Root, "Feature1-Report.json"), "utf8")).toBe(f1Payload);
  });

  it("identifies F1 and F2 stages precisely in progress events", () => {
    const setup = setupRepo();
    const emit = vi.fn();
    const executeStage = vi.fn(({ stage, env, args }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
      } else if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
      } else {
        mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      }
      return { stdout: "complete", stderr: "" };
    });
    const runContext = { ...context(setup.repositoryRoot), emit };
    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, runContext, { executeStage });
    runF1F2Confirmed({ workbookPath: setup.workbookPath, workbookContentHash: HASH, selectedWorksheetNames: ["Analysis-A"], selectionReference: selection.selectionReference, now: fixedNow }, runContext, { executeStage });

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_started", featureId: "F1", stage: "f1-selection" }));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_started", featureId: "F1", stage: "f1" }));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ kind: "stage_started", featureId: "F2", stage: "f2" }));
  });

  it("returns the same structured result when confirmation is repeated after completion", async () => {
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

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });
    const completed = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage });

    const duplicateExecuteStage = vi.fn(() => {
      throw new Error("duplicate confirm should be idempotent");
    });

    const duplicate = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage: duplicateExecuteStage });

    expect(duplicate).toEqual(completed);
    expect(duplicateExecuteStage).not.toHaveBeenCalled();
  });

  it("refreshes completed F2 into a new run without rerunning F1 or overwriting prior artifacts", () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ stage, env, args }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
      } else if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), '{"artifact":"f1"}');
      } else {
        mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      }
      return { stdout: `${stage} complete`, stderr: "" };
    });
    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });
    const completed = runF1F2Confirmed({ workbookPath: setup.workbookPath, workbookContentHash: HASH, selectedWorksheetNames: ["Analysis-A"], selectionReference: selection.selectionReference, now: fixedNow }, context(setup.repositoryRoot), { executeStage });
    const priorReport = readFileSync(path.join(completed.f2Root, "Feature2-Report.json"), "utf8");
    const refreshExecuteStage = vi.fn(({ stage, env, args }) => {
      if (stage !== "f2") throw new Error("refresh should only execute F2");
      mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      return { stdout: "f2 refreshed", stderr: "" };
    });

    const refreshed = runF1F2Confirmed({ workbookPath: setup.workbookPath, workbookContentHash: HASH, selectedWorksheetNames: ["Analysis-A"], selectionReference: selection.selectionReference, refreshF2: true, now: () => new Date("2026-08-04T00:00:00.000Z") }, context(setup.repositoryRoot), { executeStage: refreshExecuteStage });

    expect(refreshExecuteStage.mock.calls.map(([request]) => request.stage)).toEqual(["f2"]);
    expect(refreshed.f1Root).toBe(completed.f1Root);
    expect(refreshed.f2Root).not.toBe(completed.f2Root);
    expect(readFileSync(path.join(completed.f2Root, "Feature2-Report.json"), "utf8")).toBe(priorReport);
  });

  it("prefers a fresh waiting selection over an older completed run for the same workbook hash", () => {
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

    const completedSelection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });
    runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: completedSelection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage });
    const freshSelection = runF1F2Selection({ workbookPath: setup.workbookPath, now: () => new Date("2026-08-05T01:02:04.000Z") }, context(setup.repositoryRoot), { executeStage });

    executeStage.mockClear();
    const result = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage });

    expect(result.runRoot).toBe(freshSelection.runRoot);
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1", "f2"]);
  });

  it("prefers a fresh waiting selection over an older retryable run for the same workbook hash", () => {
    const setup = setupRepo();
    const failedExecuteStage = vi.fn(({ stage, env }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
        return { stdout: "selection complete", stderr: "" };
      }
      throw new Error(`${stage} failed`);
    });

    const retryableSelection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage: failedExecuteStage });
    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: retryableSelection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage: failedExecuteStage })).toThrow();

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
    const freshSelection = runF1F2Selection({ workbookPath: setup.workbookPath, now: () => new Date("2026-08-05T01:02:04.000Z") }, context(setup.repositoryRoot), { executeStage });

    executeStage.mockClear();
    const result = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage });

    expect(result.runRoot).toBe(freshSelection.runRoot);
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1", "f2"]);
  });

  it("resolves a unique completed run only when no waiting selection matches", () => {
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

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });
    const completed = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage });

    executeStage.mockClear();
    const duplicate = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage });

    expect(duplicate).toEqual(completed);
    expect(executeStage).not.toHaveBeenCalled();
  });

  it("resolves a unique retryable run only when no waiting selection matches", () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ stage, env }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
        return { stdout: "selection complete", stderr: "" };
      }
      throw new Error(`${stage} failed`);
    });

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });
    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage })).toThrow();

    const retryExecuteStage = vi.fn(({ stage, env, args }) => {
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
        return { stdout: "f1 complete", stderr: "" };
      }
      mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      return { stdout: "f2 complete", stderr: "" };
    });

    const result = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage: retryExecuteStage });

    expect(result.runRoot).toBe(selection.runRoot);
    expect(retryExecuteStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1", "f2"]);
  });

  it("rejects changed confirmed worksheet sets after a retryable failure", async () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ stage, env }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPromptWithNames(["Analysis-A", "Analysis-B"])));
        return { stdout: "selection complete", stderr: "" };
      }
      throw new Error("F1 failed before artifacts");
    });

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage })).toThrow();

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-B"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage })).toThrow(expect.objectContaining({
      code: "evidence_mismatch",
      retryable: false,
    }));
  });

  it("rejects ambiguous pending selections when more than one candidate matches the workbook hash", async () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ env }) => {
      mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
      return { stdout: "selection complete", stderr: "" };
    });

    const first = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });
    const second = runF1F2Selection({ workbookPath: setup.workbookPath, now: () => new Date("2026-08-05T01:02:04.000Z") }, context(setup.repositoryRoot), { executeStage });

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage })).toThrow(expect.objectContaining({ code: "evidence_mismatch" }));
    expect(first.runRoot).not.toBe(second.runRoot);
  });

  it("rejects stale registry candidates whose prompt path no longer resolves", async () => {
    const setup = setupRepo();
    const executeStage = vi.fn(({ env }) => {
      mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
      return { stdout: "selection complete", stderr: "" };
    });

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot), { executeStage });
    const manifest = selectionManifest(selection);
    rmSync(manifest.selection.promptPath ?? "", { force: true });

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      now: fixedNow,
    }, context(setup.repositoryRoot), { executeStage })).toThrow(expect.objectContaining({ code: "evidence_mismatch" }));
  });

  it("rejects a managed output junction that redirects selection lookup outside the controlled root", ({ skip }) => {
    if (process.platform !== "win32") skip();

    const setup = setupRepo();
    const outside = mkdtempSync(path.join(tmpdir(), "workflow-runners-f2-outside-"));
    cleanup.push(outside);
    mkdirSync(path.join(setup.repositoryRoot, "managed-output"), { recursive: true });
    rmSync(path.join(setup.repositoryRoot, "managed-output"), { recursive: true, force: true });
    try {
      symlinkSync(outside, path.join(setup.repositoryRoot, "managed-output"), "junction");
    } catch {
      skip();
    }

    expect(() => runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, context(setup.repositoryRoot))).toThrow(/managed output|invalid|root/i);
  });

  it("stops before starting F2 when cancellation is observed after F1 commits", () => {
    const setup = setupRepo();
    const controller = new AbortController();
    const executeStage = vi.fn(({ stage, env, args }) => {
      if (stage === "f1-selection") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Selection.json"), JSON.stringify(selectionPrompt()));
        return { stdout: "selection complete", stderr: "" };
      }
      if (stage === "f1") {
        mkdirSync(env.AI_TVA_F1_OUTPUT_ROOT, { recursive: true });
        writeFileSync(path.join(env.AI_TVA_F1_OUTPUT_ROOT, "Feature1-Report.json"), "{}");
        controller.abort();
        return { stdout: "f1 complete", stderr: "" };
      }
      mkdirSync(env.AI_TVA_F2_OUTPUT_ROOT, { recursive: true });
      writeFileSync(path.join(env.AI_TVA_F2_OUTPUT_ROOT, "Feature2-Report.json"), JSON.stringify(validF2Report(args[1])));
      return { stdout: "f2 complete", stderr: "" };
    });

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, {
      ...context(setup.repositoryRoot),
      signal: controller.signal,
    }, { executeStage });

    expect(() => runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, {
      ...context(setup.repositoryRoot),
      signal: controller.signal,
    }, { executeStage })).toThrow(expect.objectContaining({ code: "transient_error" }));
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1-selection", "f1"]);
    expect(readFileSync(path.join(selection.f1Root, "Feature1-Report.json"), "utf8")).toBe("{}");
  });

  it("returns a completed result when cancellation flips after F2 side effects commit", () => {
    const setup = setupRepo();
    const controller = new AbortController();
    const emit = vi.fn();
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
      controller.abort();
      return { stdout: "f2 complete", stderr: "" };
    });

    const selection = runF1F2Selection({ workbookPath: setup.workbookPath, now: fixedNow }, {
      ...context(setup.repositoryRoot),
      signal: controller.signal,
      emit,
    }, { executeStage });

    const result = runF1F2Confirmed({
      workbookPath: setup.workbookPath,
      workbookContentHash: HASH,
      selectedWorksheetNames: ["Analysis-A"],
      selectionReference: selection.selectionReference,
      now: fixedNow,
    }, {
      ...context(setup.repositoryRoot),
      signal: controller.signal,
      emit,
    }, { executeStage });

    expect(result.status).toBe("completed");
    expect(executeStage.mock.calls.map(([request]) => request.stage)).toEqual(["f1-selection", "f1", "f2"]);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ kind: "artifact_written", featureId: "F2", stage: "validation" }));
  });
});