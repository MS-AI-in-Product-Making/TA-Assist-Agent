import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runF6Cli, runF6FullValidation } from "./run-f6-full-validation.mjs";

const cleanup = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function setup({ status = "completed" } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "f6-full-flow-"));
  cleanup.push(root);
  const publishRoot = path.join(root, "publish");
  const runRoot = path.join(publishRoot, "f6-runs", "run-1");
  mkdirSync(publishRoot);
  const optimization = { featureId: "F6", status, summary: { worksheetCount: 2, completedOptionCount: 7 } };
  const composed = { reportVersion: "f6-composed-engineering-report-v1", overallStatus: status === "partially_completed" ? "RISK" : "PASS" };
  const renameCalls = [];
  const deps = {
    parseArgs: vi.fn(() => ({
      f2ArtifactRoot: path.join(publishRoot, "f2"),
      f3ArtifactRoot: path.join(publishRoot, "f3"),
      f4ArtifactRoot: path.join(publishRoot, "f4"),
      f5ArtifactRoot: path.join(publishRoot, "f5"),
      selectedWorksheetNames: ["Analysis-A"],
    })),
    resolveLayout: vi.fn(() => ({
      runId: "2026-08-17T01-02-03-456Z",
      runRoot,
      publishRoot,
      optimizationJsonName: "Feature6-Optimization.json",
      optimizationMdName: "Feature6-Optimization.md",
      composedReportJsonName: "Feature6-Composed-Report.json",
      composedReportMdName: "Feature6-Composed-Report.md",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    })),
    loadBundle: vi.fn(() => ({
      status: "accepted",
      request: { request: true },
      f2Report: { f2: true },
      f5Report: { f5: true },
      blockedWorksheets: [{ worksheetName: "Blocked-A", findings: [] }],
      sourceReferences: {
        f2: { artifact: "Feature2-Report.json", contentHash: "a".repeat(64) },
        f3: { artifact: "Feature3-Report.json", contentHash: "b".repeat(64) },
        f4: { artifact: "Feature4-Calculation.json", contentHash: "c".repeat(64) },
        f5: { artifact: "Feature5-Report.json", contentHash: "d".repeat(64) },
      },
    })),
    createOptimization: vi.fn(() => optimization),
    createComposedReport: vi.fn(() => composed),
    renderOptimization: vi.fn(() => "# F6 optimization\n"),
    renderComposedReport: vi.fn(() => "# F5 + F6 report\n"),
    rename: (from, to) => {
      renameCalls.push(path.basename(to));
      renameSync(from, to);
    },
  };
  return { root, publishRoot, runRoot, optimization, composed, renameCalls, deps };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

describe("runF6FullValidation", () => {
  it("writes all six fixed artifacts and passes validated reports to the composed model", () => {
    const context = setup();
    const result = runF6FullValidation({ args: ["ignored"] }, context.deps);

    expect(result.status).toBe("completed");
    expect(readdirSync(context.runRoot).sort()).toEqual([
      "Feature6-Composed-Report.json",
      "Feature6-Composed-Report.md",
      "Feature6-Optimization.json",
      "Feature6-Optimization.md",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(context.deps.createComposedReport).toHaveBeenCalledWith({
      f2Report: { f2: true },
      f5Report: { f5: true },
      f6Result: context.optimization,
    });
  });

  it("hashes the exact four serialized report contents", () => {
    const context = setup();
    runF6FullValidation({}, context.deps);
    const summary = readJson(path.join(context.runRoot, "Feature6-Run-Summary.json"));
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: sha256(`${JSON.stringify(context.optimization, null, 2)}\n`),
      optimizationMarkdownSha256: sha256("# F6 optimization\n"),
      composedReportJsonSha256: sha256(`${JSON.stringify(context.composed, null, 2)}\n`),
      composedReportMarkdownSha256: sha256("# F5 + F6 report\n"),
    });
  });

  it("atomically renames every artifact and commits manifest last", () => {
    const context = setup();
    runF6FullValidation({}, context.deps);
    expect(context.renameCalls).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Optimization.md",
      "Feature6-Composed-Report.json",
      "Feature6-Composed-Report.md",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(readdirSync(context.runRoot).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("preserves partial option failure as a successful partially completed run", () => {
    const context = setup({ status: "partially_completed" });
    const result = runF6FullValidation({}, context.deps);
    expect(result.status).toBe("partially_completed");
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      status: "partially_completed",
      artifacts: { optimizationJson: "Feature6-Optimization.json" },
    });
  });

  it("writes only a failed manifest when governed input is rejected", () => {
    const context = setup();
    context.deps.loadBundle = () => ({ status: "inputRejected", reasonCode: "artifact_identity_mismatch" });
    const result = runF6FullValidation({}, context.deps);
    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(context.runRoot)).toEqual(["manifest.json"]);
  });

  it("does not leak exception details through the CLI", () => {
    const context = setup();
    context.deps.createOptimization = () => { throw new Error("sensitive workbook path"); };
    const lines = [];
    expect(runF6Cli({}, context.deps, { log: (line) => lines.push(line) })).toBe(1);
    expect(lines.join("\n")).not.toContain("sensitive workbook path");
    expect(lines.join("\n")).toContain("optimization_failed");
  });

  it("removes an owned temporary file when an atomic rename fails", () => {
    const context = setup();
    let calls = 0;
    context.deps.rename = (from, to) => {
      calls += 1;
      if (calls === 2) throw new Error("disk failure");
      renameSync(from, to);
    };
    const result = runF6FullValidation({}, context.deps);
    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readdirSync(context.runRoot).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("fails closed when the run root identity changes after creation", () => {
    const context = setup();
    const originalRealpath = context.deps.realpath;
    let runRootChecks = 0;
    context.deps.realpath = (target) => {
      const resolved = (originalRealpath ?? ((value) => path.resolve(value)))(target);
      if (path.resolve(target) === path.resolve(context.runRoot) && ++runRootChecks > 1) {
        return path.join(context.publishRoot, "replaced-run");
      }
      return resolved;
    };
    const result = runF6FullValidation({}, context.deps);
    expect(result.status).toBe("failed");
    expect(existsSync(path.join(context.runRoot, "Feature6-Optimization.json"))).toBe(false);
  });
});