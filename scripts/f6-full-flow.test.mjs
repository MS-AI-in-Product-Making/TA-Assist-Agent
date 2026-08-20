import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createComparisonPlaceholder,
  createF6Optimization,
} from "../packages/workbook-catalog/dist/index.js";
import {
  createF6ArtifactBundleFixture,
  fixtureFileSha256,
  installF6V2Evidence,
  rewriteFixtureJson,
} from "./f6-artifact-test-fixture.mjs";
import { runF6Cli, runF6FullValidation } from "./run-f6-full-validation.mjs";

const cleanup = [];
const deprecatedF6ReportArtifactName = ["Feature6", "Composed", "Report"].join("-");

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
  const reportSummary = {
    workbookDisposition: status === "partially_completed" ? "CONDITIONAL_PASS" : "PASS",
    worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "PASS" }],
  };
  const finalReport = { markdown: "# F6 final report\n", reportSummary };
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
      finalReportMdName: "Feature6-Report.md",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    })),
    loadBundle: vi.fn(() => ({
      status: "accepted",
      request: { request: true },
      f2Report: { f2: true },
      f3Report: { f3: true },
      f4Report: { f4: true },
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
    createFinalReport: vi.fn(() => finalReport),
    renderOptimization: vi.fn(() => "# F6 optimization\n"),
    rename: (from, to) => {
      renameCalls.push(path.basename(to));
      renameSync(from, to);
    },
  };
  return { root, publishRoot, runRoot, optimization, finalReport, reportSummary, renameCalls, deps };
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
      finalReportMdName: "Feature6-Report.md",
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

function temporaryFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith(".tmp"));
}

const committedArtifacts = [
  ["optimizationJson", "Feature6-Optimization.json"],
  ["optimizationMarkdown", "Feature6-Optimization.md"],
  ["finalReportMarkdown", "Feature6-Report.md"],
  ["runSummary", "Feature6-Run-Summary.json"],
];

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

  it("writes all five fixed artifacts and passes validated reports to the final report projection", () => {
    const context = setup();
    const result = runF6FullValidation({ args: ["ignored"] }, context.deps);

    expect(result.status).toBe("completed");
    expect(readdirSync(context.runRoot).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Optimization.md",
      "Feature6-Report.md",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(context.deps.createFinalReport).toHaveBeenCalledWith({
      f2Report: { f2: true },
      f3Report: { f3: true },
      f4Report: { f4: true },
      f5Report: { f5: true },
      f6Optimization: context.optimization,
      generatedAt: "2026-08-17T01:02:03.456Z",
    }, {
      outputRoot: context.runRoot,
      f1ArtifactRoot: undefined,
      publishRoot: context.publishRoot,
    });
    expect(result.finalReportMdPath).toBe(path.join(context.runRoot, "Feature6-Report.md"));
    expect(result).not.toHaveProperty("composedReportJsonPath");
    expect(result).not.toHaveProperty("composedReportMdPath");
    expect(context.deps.createOptimization).toHaveBeenCalledWith({ request: true }, {
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "NOT_PROVIDED" },
      },
    });
  });

  it("passes V2 optional inputs and records identical input decisions in summary and manifest", () => {
    const context = setup();
    const inputDecisions = {
      analysisContext: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "context.json", contentHash: "e".repeat(64) } },
      optimizationTargets: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "targets.json", contentHash: "f".repeat(64) } },
    };
    const analysisContext = { contextVersion: "f6-analysis-context-v1" };
    const optimizationTargets = { targetVersion: "f6-optimization-targets-v1" };
    context.deps.loadBundle.mockReturnValue({
      ...context.deps.loadBundle(),
      analysisContext,
      optimizationTargets,
      inputDecisions,
      sourceReferences: {
        ...context.deps.loadBundle().sourceReferences,
        analysisContext: inputDecisions.analysisContext.artifactReference,
        optimizationTargets: inputDecisions.optimizationTargets.artifactReference,
      },
    });

    runF6FullValidation({}, context.deps);

    expect(context.deps.createOptimization).toHaveBeenCalledWith(
      { request: true },
      { analysisContext, optimizationTargets, inputDecisions },
    );
    expect(context.deps.createFinalReport).toHaveBeenCalledWith({
      f2Report: { f2: true },
      f3Report: { f3: true },
      f4Report: { f4: true },
      f5Report: { f5: true },
      f6Optimization: context.optimization,
      generatedAt: "2026-08-17T01:02:03.456Z",
      analysisContext,
    }, {
      outputRoot: context.runRoot,
      f1ArtifactRoot: undefined,
      publishRoot: context.publishRoot,
    });
    const summary = readJson(path.join(context.runRoot, "Feature6-Run-Summary.json"));
    const manifest = readJson(path.join(context.runRoot, "manifest.json"));
    expect(summary.inputDecisions).toEqual(inputDecisions);
    expect(summary.reportSummary).toEqual(context.reportSummary);
    expect(manifest.inputDecisions).toEqual(inputDecisions);
  });

  it("hashes the exact three serialized content artifacts and records the report summary", () => {
    const context = setup();
    runF6FullValidation({}, context.deps);
    const summary = readJson(path.join(context.runRoot, "Feature6-Run-Summary.json"));
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: sha256(`${JSON.stringify(context.optimization, null, 2)}\n`),
      optimizationMarkdownSha256: sha256("# F6 optimization\n"),
      finalReportMarkdownSha256: sha256(context.finalReport.markdown),
    });
    expect(summary.reportSummary).toEqual(context.reportSummary);
  });

  it("atomically renames every artifact and commits manifest last", () => {
    const context = setup();
    runF6FullValidation({}, context.deps);
    expect(context.renameCalls).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Optimization.md",
      "Feature6-Report.md",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(readdirSync(context.runRoot).some((name) => name.endsWith(".tmp"))).toBe(false);
    expect(existsSync(path.join(context.publishRoot, ".f6-staging"))).toBe(false);
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

  it.each([1, 2, 3, 4, 5])(
    "records exactly the postchecked artifacts when rename %i fails",
    (failurePosition) => {
    const context = setup();
    let calls = 0;
    context.deps.rename = (from, to) => {
      calls += 1;
      if (calls === failurePosition) throw new Error("disk failure");
      renameSync(from, to);
    };
    const result = runF6FullValidation({}, context.deps);
    const expectedArtifacts = Object.fromEntries(committedArtifacts.slice(0, failurePosition - 1));
    const expectedFiles = [
      ...committedArtifacts.slice(0, failurePosition - 1).map(([, fileName]) => fileName),
      "manifest.json",
    ].sort();

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readdirSync(context.runRoot).sort()).toEqual(expectedFiles);
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      reasonCode: "workflow_output_failed",
      artifacts: expectedArtifacts,
    });
    expect(temporaryFiles(context.runRoot)).toEqual([]);
    expect(temporaryFiles(path.join(context.publishRoot, ".f6-staging"))).toEqual([]);
    expect(existsSync(path.join(context.publishRoot, ".f6-staging"))).toBe(false);
  });

  it("does not return a manifest when every manifest rename fails", () => {
    const context = setup();
    context.deps.rename = (from, to) => {
      if (path.basename(to) === "manifest.json") throw new Error("manifest disk failure");
      renameSync(from, to);
    };

    const result = runF6FullValidation({}, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(result).not.toHaveProperty("manifestPath");
    expect(readdirSync(context.runRoot).sort()).toEqual(committedArtifacts.map(([, fileName]) => fileName).sort());
    expect(temporaryFiles(context.runRoot)).toEqual([]);
    expect(temporaryFiles(path.join(context.publishRoot, ".f6-staging"))).toEqual([]);
  });

  it.each([
    ...[1, 2, 3, 4, 5].map((position) => ["before", position]),
    ...[1, 2, 3, 4, 5].map((position) => ["after", position]),
  ])("fails closed when the run root is swapped %s rename %i", (phase, swapPosition) => {
    const context = setup();
    const parkedRoot = path.join(context.root, `parked-${phase}-${swapPosition}`);
    const outsideRoot = path.join(context.root, `outside-${phase}-${swapPosition}`);
    mkdirSync(outsideRoot);
    let renamePosition = 0;
    const swapRunRoot = () => {
      renameSync(context.runRoot, parkedRoot);
      symlinkSync(outsideRoot, context.runRoot, process.platform === "win32" ? "junction" : "dir");
    };
    context.deps.beforeRename = () => {
      renamePosition += 1;
      if (phase === "before" && renamePosition === swapPosition) swapRunRoot();
    };
    context.deps.afterRename = () => {
      if (phase === "after" && renamePosition === swapPosition) swapRunRoot();
    };

    const result = runF6FullValidation({}, context.deps);

    expect(result).toEqual({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(temporaryFiles(parkedRoot)).toEqual([]);
    expect(temporaryFiles(context.runRoot)).toEqual([]);
    expect(temporaryFiles(path.join(context.publishRoot, ".f6-staging"))).toEqual([]);
    expect(readdirSync(outsideRoot)).toEqual([]);
    expect(result).not.toHaveProperty("manifestPath");
    for (const [, fileName] of committedArtifacts) {
      expect(existsSync(path.join(outsideRoot, fileName))).toBe(false);
      expect(Object.values(result)).not.toContain(path.join(outsideRoot, fileName));
    }
  });

  it("rejects a staging junction without writing through it", () => {
    const context = setup();
    const stagingRoot = path.join(context.publishRoot, ".f6-staging");
    const outsideRoot = path.join(context.root, "outside-staging");
    mkdirSync(outsideRoot);
    symlinkSync(outsideRoot, stagingRoot, process.platform === "win32" ? "junction" : "dir");

    const result = runF6FullValidation({}, context.deps);

    expect(result).toEqual({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readdirSync(outsideRoot)).toEqual([]);
    expect(existsSync(context.runRoot)).toBe(true);
    expect(readdirSync(context.runRoot)).toEqual([]);
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
  it("runs the real CLI and layout without changing any governed input artifact", () => {
    const bundle = createRealBundle({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    const evidence = installF6V2Evidence(bundle);
    const outputRoot = path.join(bundle.publishRoot, "f6-runs", "real-cli");
    const fixedNow = () => new Date("2026-08-17T01:02:03.456Z");
    const runRoot = path.join(outputRoot, "2026-08-17T01-02-03-456Z");
    const inputSnapshots = Object.fromEntries(Object.entries(bundle.paths).map(([key, filePath]) => [key, {
      bytes: readFileSync(filePath),
      sha256: fixtureFileSha256(filePath),
    }]));
    const lines = [];
    const previousOutputRoot = process.env.AI_TVA_F6_OUTPUT_ROOT;
    const previousPublishRoot = process.env.AI_TVA_F6_PUBLISH_ROOT;
    process.env.AI_TVA_F6_OUTPUT_ROOT = outputRoot;
    process.env.AI_TVA_F6_PUBLISH_ROOT = bundle.publishRoot;

    let exitCode;
    try {
      exitCode = runF6Cli({
        args: [
          bundle.f2ArtifactRoot,
          bundle.f3ArtifactRoot,
          bundle.f4ArtifactRoot,
          bundle.f5ArtifactRoot,
          "--worksheet", "Analysis-B",
          "--worksheet", "Analysis-A",
          "--image-observations", path.join(evidence.evidenceArtifactRoot, evidence.imageObservationArtifact),
        ],
        now: fixedNow,
      }, {}, { log: (line) => lines.push(line) });
    } finally {
      if (previousOutputRoot === undefined) delete process.env.AI_TVA_F6_OUTPUT_ROOT;
      else process.env.AI_TVA_F6_OUTPUT_ROOT = previousOutputRoot;
      if (previousPublishRoot === undefined) delete process.env.AI_TVA_F6_PUBLISH_ROOT;
      else process.env.AI_TVA_F6_PUBLISH_ROOT = previousPublishRoot;
    }

    expect(exitCode, lines.join("\n")).toBe(0);
    expect(readdirSync(runRoot).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Optimization.md",
      "Feature6-Report.md",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    const cliResult = JSON.parse(lines.join("\n"));
    expect(summary.status).toBe("completed");
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.json")),
      optimizationMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.md")),
      finalReportMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Report.md")),
    });
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const finalMarkdown = readFileSync(path.join(runRoot, "Feature6-Report.md"), "utf8");

    expect(optimization.worksheets.every(({ options }) =>
      options.every(({ status }) => status === "candidate"))).toBe(true);
    expect(summary.reportSummary).toEqual(expect.objectContaining({
      workbookDisposition: expect.any(String),
      worksheetDispositions: expect.arrayContaining([
        expect.objectContaining({ worksheetName: "Analysis-A", disposition: expect.any(String) }),
      ]),
    }));
    expect(finalMarkdown).toContain("Analysis-A");
    expect(finalMarkdown).toContain("NOT_PROVIDED");
    expect(finalMarkdown).not.toContain(deprecatedF6ReportArtifactName);
    expect(cliResult.finalReportMdPath).toBe(path.join(runRoot, "Feature6-Report.md"));
    expect(cliResult).not.toHaveProperty("composedReportJsonPath");
    expect(cliResult).not.toHaveProperty("composedReportMdPath");
    expect(readJson(path.join(runRoot, "manifest.json"))).toEqual({
      contractVersion: "v1",
      featureId: "F6",
      status: "completed",
      runId: "2026-08-17T01-02-03-456Z",
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "NOT_PROVIDED" },
      },
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        optimizationMarkdown: "Feature6-Optimization.md",
        finalReportMarkdown: "Feature6-Report.md",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
    for (const [key, filePath] of Object.entries(bundle.paths)) {
      expect(readFileSync(filePath).equals(inputSnapshots[key].bytes)).toBe(true);
      expect(fixtureFileSha256(filePath)).toBe(inputSnapshots[key].sha256);
    }
  });

  it("runs the package workflow:f6 script with an isolated successful fixture", () => {
    const bundle = createRealBundle();
    const evidence = installF6V2Evidence(bundle);
    const outputRoot = path.join(bundle.publishRoot, "f6-runs", "package-script");
    const f5Bytes = readFileSync(bundle.paths.f5);
    const f5Sha256 = fixtureFileSha256(bundle.paths.f5);
    const npmExecutable = process.platform === "win32" ? process.execPath : "npm";
    const npmPrefixArgs = process.platform === "win32" ? [process.env.npm_execpath] : [];

    const child = spawnSync(npmExecutable, [
      ...npmPrefixArgs,
      "run",
      "--silent",
      "workflow:f6",
      "--",
      bundle.f2ArtifactRoot,
      bundle.f3ArtifactRoot,
      bundle.f4ArtifactRoot,
      bundle.f5ArtifactRoot,
      "--worksheet", "Analysis-A",
      "--image-observations", path.join(evidence.evidenceArtifactRoot, evidence.imageObservationArtifact),
    ], {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_TVA_F6_OUTPUT_ROOT: outputRoot,
        AI_TVA_F6_PUBLISH_ROOT: bundle.publishRoot,
        npm_config_update_notifier: "false",
      },
      shell: false,
    });

    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr || child.stdout).toBe(0);
    expect(child.stderr).toBe("");
    const result = JSON.parse(child.stdout);
    expect(result.status).toBe("completed");
    expect(readdirSync(result.outputDirectory).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Optimization.md",
      "Feature6-Report.md",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(result.finalReportMdPath).toBe(path.join(result.outputDirectory, "Feature6-Report.md"));
    expect(result).not.toHaveProperty("composedReportJsonPath");
    expect(result).not.toHaveProperty("composedReportMdPath");
    expect(readFileSync(bundle.paths.f5).equals(f5Bytes)).toBe(true);
    expect(fixtureFileSha256(bundle.paths.f5)).toBe(f5Sha256);
  });

  it("rejects an out-of-bound core root when layout validation is bypassed", () => {
    const bundle = createRealBundle();
    const outsideF2Root = path.join(bundle.root, "outside", "f2");
    mkdirSync(path.dirname(outsideF2Root), { recursive: true });
    renameSync(bundle.f2ArtifactRoot, outsideF2Root);
    bundle.f2ArtifactRoot = outsideF2Root;

    const { result, runRoot } = runRealF6(bundle, "outside-core-root");

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(runRoot)).toEqual(["manifest.json"]);
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      reasonCode: "input_rejected",
      artifacts: {},
    });
  });

  it("selects only ready F2 worksheets and keeps blocked worksheets out of numeric sections", () => {
    const bundle = createRealBundle({ blockedWorksheetNames: ["Blocked-A"] });
    const { result, runRoot } = runRealF6(bundle, "mixed-ready-blocked");
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const finalMarkdown = readFileSync(path.join(runRoot, "Feature6-Report.md"), "utf8");

    expect(result.status).toBe("completed");
    expect(readdirSync(runRoot).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Optimization.md",
      "Feature6-Report.md",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(optimization.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(finalMarkdown).toContain("Blocked-A");
    expect(finalMarkdown).toContain("Analysis-A");
    expect(finalMarkdown).not.toContain("whatIfAnalysis");
    expect(finalMarkdown).not.toContain(deprecatedF6ReportArtifactName);
  });

  it("publishes valid hashes and conservative results when optional evidence is absent", () => {
    const bundle = createRealBundle();
    const { result, runRoot } = runRealF6(bundle, "no-optional-evidence");
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    const worksheet = optimization.worksheets[0];

    expect(result.status).toBe("completed");
    expect(readdirSync(runRoot)).toHaveLength(5);
    expect(optimization.optimizationVersion).toBe("f6-optimization-v2");
    expect(worksheet.options).toEqual([
      expect.objectContaining({ status: "candidate", reasonCode: "target_not_provided", impactRank: null }),
    ]);
    expect(worksheet.highestImpactAction).toBeNull();
    expect(summary.inputDecisions).toEqual({
      analysisContext: { outcome: "NOT_PROVIDED" },
      optimizationTargets: { outcome: "NOT_PROVIDED" },
    });
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.json")),
      optimizationMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.md")),
      finalReportMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Report.md")),
    });
    expect(summary.reportSummary.workbookDisposition).toBeDefined();
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "completed",
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        optimizationMarkdown: "Feature6-Optimization.md",
        finalReportMarkdown: "Feature6-Report.md",
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

  it("does not invoke scenario calculation or quantify improvement without targets", () => {
    const bundle = createRealBundle();
    const calculateScenario = vi.fn(() => { throw new Error("scenario must not run"); });
    const { result, runRoot } = runRealF6(bundle, "no-target-no-scenario", {
      createOptimization(request, inputs) {
        return createF6Optimization(request, inputs, { calculateScenario });
      },
    });
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));

    expect(result.status).toBe("completed");
  expect(readdirSync(runRoot)).toHaveLength(5);
    expect(calculateScenario).not.toHaveBeenCalled();
    expect(optimization.worksheets[0].options[0]).toMatchObject({ status: "candidate" });
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

});