import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createComparisonPlaceholder,
  createF6Optimization,
} from "../packages/workbook-catalog/dist/index.js";
import { calculateF6Scenario } from "../packages/workbook-catalog/dist/f6-scenario-adapter.js";
import {
  createF6ArtifactBundleFixture,
  installF6V2Evidence,
  rewriteFixtureJson,
} from "./f6-artifact-test-fixture.mjs";
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

function createRealBundle(options) {
  const bundle = createF6ArtifactBundleFixture(options);
  cleanup.push(bundle.root);
  return bundle;
}

function runRealF6(bundle, runId, dependencyOverrides = {}, parsedOverrides = {}) {
  const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
  const result = runF6FullValidation({}, {
    parseArgs: () => ({ ...bundle, ...parsedOverrides }),
    resolveLayout: () => ({
      runId,
      runRoot,
      publishRoot: bundle.publishRoot,
      optimizationJsonName: "Feature6-Optimization.json",
      optimizationMdName: "Feature6-Optimization.md",
      composedReportJsonName: "Feature6-Composed-Report.json",
      composedReportMdName: "Feature6-Composed-Report.md",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    }),
    ...dependencyOverrides,
  });
  return { result, runRoot };
}

function artifactHash(filePath) {
  return sha256(readFileSync(filePath));
}

describe("runF6FullValidation", () => {
  it("rejects four roots from the direct CLI without creating artifacts", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f6-direct-cli-"));
    cleanup.push(root);
    const publishRoot = path.join(root, "publish");
    const roots = ["f2", "f3", "f4", "f5"].map((name) => path.join(publishRoot, name));
    const outputRoot = path.join(publishRoot, "f6-runs", "run");
    for (const artifactRoot of roots) mkdirSync(artifactRoot, { recursive: true });

    const result = spawnSync(process.execPath, [
      path.join(process.cwd(), "scripts", "run-f6-full-validation.mjs"),
      ...roots,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_TVA_F6_OUTPUT_ROOT: outputRoot,
        AI_TVA_F6_PUBLISH_ROOT: publishRoot,
      },
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      status: "failed",
      reasonCode: "invalid_arguments_or_output_root",
    });
    expect(existsSync(outputRoot)).toBe(false);
  });

  it("rejects a direct CLI command with four roots before creating artifacts", () => {
    const lines = [];
    const resolveLayout = vi.fn(() => { throw new Error("layout must not be resolved"); });

    expect(runF6Cli(
      { args: ["f2 run", "f3 run", "f4 run", "f5 run"] },
      { resolveLayout },
      { log: (line) => lines.push(line) },
    )).toBe(1);
    expect(resolveLayout).not.toHaveBeenCalled();
    expect(JSON.parse(lines.join("\n"))).toEqual({
      status: "failed",
      reasonCode: "invalid_arguments_or_output_root",
    });
  });

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

describe("F6 real artifact full flow", () => {
  it("selects only ready F2 worksheets and keeps blocked worksheets out of numeric sections", () => {
    const bundle = createRealBundle({ blockedWorksheetNames: ["Blocked-A"] });
    const { result, runRoot } = runRealF6(bundle, "mixed-ready-blocked");
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const composed = readJson(path.join(runRoot, "Feature6-Composed-Report.json"));

    expect(result.status).toBe("completed");
    expect(readdirSync(runRoot).sort()).toEqual([
      "Feature6-Composed-Report.json",
      "Feature6-Composed-Report.md",
      "Feature6-Optimization.json",
      "Feature6-Optimization.md",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(optimization.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(composed.blockedWorksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Blocked-A"]);
    expect(composed.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(JSON.stringify(composed.blockedWorksheets)).not.toMatch(/capabilityAssessment|options|whatIfAnalysis/);
  });

  it("publishes valid hashes and conservative results when optional evidence is absent", () => {
    const bundle = createRealBundle();
    const { result, runRoot } = runRealF6(bundle, "no-optional-evidence");
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    const worksheet = optimization.worksheets[0];
    const optionsByKind = new Map(worksheet.options.map((option) => [option.optionKind, option]));

    expect(result.status).toBe("completed");
    expect(readdirSync(runRoot)).toHaveLength(6);
    expect(optionsByKind.get("improve_supplier_capability")).toMatchObject({
      status: "insufficient_evidence",
      predictedImprovement: "insufficient_evidence",
    });
    expect(optionsByKind.get("tighten_datum_strategy")).toMatchObject({
      status: "insufficient_evidence",
      predictedImprovement: "insufficient_evidence",
    });
    expect(worksheet.roiStatus).toBe("not_computed");
    expect(worksheet.options.filter(({ status }) => status === "completed").every(({ roiScore }) =>
      roiScore === "not_computed")).toBe(true);
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.json")),
      optimizationMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.md")),
      composedReportJsonSha256: artifactHash(path.join(runRoot, "Feature6-Composed-Report.json")),
      composedReportMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Composed-Report.md")),
    });
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "completed",
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        optimizationMarkdown: "Feature6-Optimization.md",
        composedReportJson: "Feature6-Composed-Report.json",
        composedReportMarkdown: "Feature6-Composed-Report.md",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
  });

  it("rejects explicitly supplied invalid F5 v2 evidence without successful report artifacts", () => {
    const bundle = createRealBundle();
    const evidence = installF6V2Evidence(bundle);
    cleanup.push(evidence.evidenceArtifactRoot);
    const evidencePath = path.join(evidence.evidenceArtifactRoot, evidence.imageObservationArtifact);
    rewriteFixtureJson(evidencePath, (artifact) => {
      artifact.worksheets[0].contextSnapshot.dimensionDescription = "Other loop";
    });

    const { result, runRoot } = runRealF6(bundle, "invalid-v2-evidence", {}, {
      imageObservationArtifact: evidencePath,
    });

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(runRoot)).toEqual(["manifest.json"]);
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      reasonCode: "input_rejected",
      artifacts: {},
    });
  });

  it("retains other options and all report artifacts when one real scenario calculation fails", () => {
    const bundle = createRealBundle();
    const { result, runRoot } = runRealF6(bundle, "one-option-failed", {
      createOptimization(request) {
        return createF6Optimization(request, {
          calculateScenario(input) {
            if (input.scenario.optionKind === "reduce_top_contributor_20") {
              throw { code: "controlled_calculation_failed", privateValue: "DO-NOT-LEAK" };
            }
            return calculateF6Scenario(input);
          },
        });
      },
    });
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const composed = readJson(path.join(runRoot, "Feature6-Composed-Report.json"));
    const worksheet = optimization.worksheets[0];

    expect(result.status).toBe("partially_completed");
    expect(readdirSync(runRoot)).toHaveLength(6);
    expect(worksheet.options.find(({ optionKind }) => optionKind === "reduce_top_contributor_20")).toMatchObject({
      status: "calculation_failed",
      reasonCode: "controlled_calculation_failed",
    });
    expect(worksheet.options.filter(({ status }) => status === "completed")).toHaveLength(6);
    expect(composed.worksheets[0].sections.whatIfAnalysis.options.find(({ optionKind }) =>
      optionKind === "reduce_top_contributor_20")).toMatchObject({ status: "calculation_failed" });
    expect(JSON.stringify({ optimization, composed })).not.toContain("DO-NOT-LEAK");
  });

  it.each([
    ["workbook", "f3", (report) => { report.workbook.contentHash = "c".repeat(64); }],
    ["run", "f4", (report) => { report.runId = "other-run"; }],
    ["source", "f2", (report) => { report.worksheets[0].rows[0].sourceRow = 99; }],
  ])("rejects an actual %s identity mutation", (identity, artifactKey, mutate) => {
    const bundle = createRealBundle();
    rewriteFixtureJson(bundle.paths[artifactKey], mutate);

    const { result, runRoot } = runRealF6(bundle, `identity-${identity}`);

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(runRoot)).toEqual(["manifest.json"]);
  });

  it("keeps the legacy comparison placeholder unavailable", () => {
    expect(createComparisonPlaceholder({
      contractVersion: "v1",
      inputClassification: "confidential",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      worksheetReferences: ["controlled-worksheet-reference"],
    })).toMatchObject({
      featureId: "F6",
      status: "feature_not_available",
      requiredPrerequisites: ["approved-knowledge-base"],
    });
  });

  it("publishes a calculation_failed optimization when every real scenario calculation fails", () => {
    const bundle = createRealBundle();
    const { result, runRoot } = runRealF6(bundle, "all-options-failed", {
      createOptimization(request) {
        return createF6Optimization(request, {
          calculateScenario() {
            throw { code: "controlled_calculation_failed" };
          },
        });
      },
    });
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));

    expect(result.status).toBe("calculation_failed");
    expect(readdirSync(runRoot)).toHaveLength(6);
    expect(optimization).toMatchObject({
      status: "calculation_failed",
      summary: {
        completedOptionCount: 0,
        calculationFailedOptionCount: 7,
        insufficientEvidenceOptionCount: 2,
      },
    });
    expect(optimization.worksheets[0].options.filter(({ status }) =>
      status === "calculation_failed")).toHaveLength(7);
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "calculation_failed",
      artifacts: { optimizationJson: "Feature6-Optimization.json" },
    });
  });
});