import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createRunStore, openRunStore } from "@ai-assist/memory";
import { expect, it, vi } from "vitest";
import { formatF4Status } from "./commands/smoke.js";
import { executeCli } from "./index.js";

const execFileAsync = promisify(execFile);
const ENGLISH_LOCK = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-1", source: "workflow_start", fallbackUsed: false } as const;

it("parses the internal interaction language for a new Agent session", async () => {
  const runAgent = vi.fn(async () => "started");
  const result = await executeCli(["agent", "analyze", "--root", "repo", "--interaction-language", JSON.stringify(ENGLISH_LOCK)], {
    cwd: () => "ignored",
    now: () => new Date("2026-09-16T00:00:00.000Z"),
    runFeature2: async () => "unused",
    runAgent,
    utcOffsetMinutes: () => 480,
  });

  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(runAgent).toHaveBeenCalledWith({
    action: "analyze",
    rootDir: "repo",
    interactionLanguage: ENGLISH_LOCK,
    analysisRequestContext: {
      requestedAt: "2026-09-16T00:00:00.000Z",
      utcOffsetMinutes: 480,
      source: "cli",
    },
  });
});

it("parses explicit analysis request context only for a new Agent analysis", async () => {
  const runAgent = vi.fn(async () => "started");

  const analyzeResult = await executeCli([
    "agent",
    "analyze",
    "--root",
    "repo",
    "--interaction-language",
    JSON.stringify(ENGLISH_LOCK),
    "--analysis-request-context",
    '{"requestedAt":"2026-09-16T15:30:12.000Z","utcOffsetMinutes":-420,"source":"cli"}',
  ], {
    cwd: () => "ignored",
    runFeature2: async () => "unused",
    runAgent,
  });

  expect(analyzeResult).toMatchObject({ exitCode: 0, stderr: "" });
  expect(runAgent).toHaveBeenCalledWith({
    action: "analyze",
    rootDir: "repo",
    interactionLanguage: ENGLISH_LOCK,
    analysisRequestContext: {
      requestedAt: "2026-09-16T15:30:12.000Z",
      utcOffsetMinutes: -420,
      source: "cli",
    },
  });

  const resumeResult = await executeCli([
    "agent",
    "resume",
    "--root",
    "repo",
    "--session",
    "session-a",
    "--analysis-request-context",
    "{}",
  ], {
    cwd: () => "ignored",
    runFeature2: async () => "unused",
    runAgent,
  });

  expect(resumeResult).toMatchObject({ exitCode: 2, stdout: "" });
  expect(resumeResult.stderr).toContain("analysis-request-context");
});

it("routes the CLI Agent to the same workbench session", async () => {
  const resume = vi.fn(async () => "resumed");
  const result = await executeCli(["agent", "resume", "--root", "repo", "--session", "session-a"], {
    cwd: () => "ignored",
    runFeature2: async () => "unused",
    runAgent: async (request) => { await resume(request.sessionId); return "session: session-a\nurl: http://127.0.0.1:4317/?session=session-a\n"; },
  });

  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(resume).toHaveBeenCalledWith("session-a");
});

async function createTemporaryRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ai-assist-cli-"));
}

it("runs a public smoke workflow and prints safe result metadata", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const result = await executeCli(["smoke", "--root", rootDir]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/runId: [0-9a-f-]{36}/i);
    expect(result.stdout).toContain("skillResults: 2");
    expect(result.stdout).toContain("manifestValid: true");
    expect(result.stdout).toContain("F4: available");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("reports a missing F4 registration as unavailable", () => {
  expect(formatF4Status(undefined)).toBe("feature_not_available");
  expect(formatF4Status("available")).toBe("available");
});

it("requires a purge confirmation token", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const result = await executeCli([
      "purge",
      "--run-id", "00000000-0000-4000-8000-000000000001",
      "--root", rootDir,
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("confirmation token");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("inspects only safe metadata and rejects exporting a sealed smoke run", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const smoke = await executeCli(["smoke", "--root", rootDir]);
    const runId = smoke.stdout.match(/runId: ([0-9a-f-]{36})/i)?.[1];
    expect(runId).toBeDefined();

    const inspected = await executeCli(["inspect", "--run-id", runId ?? "", "--root", rootDir]);
    const exported = await executeCli(["export", "--run-id", runId ?? "", "--root", rootDir]);

    expect(inspected).toMatchObject({ exitCode: 0, stderr: "" });
    expect(inspected.stdout).toContain(`runId: ${runId}`);
    expect(inspected.stdout).toContain("manifestValid: true");
    expect(inspected.stdout).toContain("eventCount:");
    expect(inspected.stdout).not.toContain("public smoke");
    expect(exported).toMatchObject({ exitCode: 2, stdout: "" });
    expect(exported.stderr).toContain("dependency_error: sealed audit runs cannot be modified");
    await expect(readdir((await openRunStore({ rootDir, runId: runId ?? "" })).runDirectory)).resolves.not.toContain("exports");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("uses a persisted hash-only purge confirmation across CLI calls", async () => {
  const rootDir = await createTemporaryRoot();
  const runId = "00000000-0000-4000-8000-000000000001";

  try {
    const store = await createRunStore({ rootDir, projectId: "project", sessionId: "session", runId });
    await store.recordArtifact({ name: "scope.txt", classification: "public", content: "purge this" });

    const plan = await executeCli(["purge-plan", "--run-id", runId, "--root", rootDir]);
    const token = plan.stdout.match(/confirmationToken: ([A-Za-z0-9_-]+)/)?.[1];
    expect(plan.exitCode).toBe(0);
    expect(token).toBeDefined();

    await expect(executeCli(["purge", "--run-id", runId, "--root", rootDir])).resolves.toMatchObject({ exitCode: 2 });
    await expect(executeCli([
      "purge", "--run-id", runId, "--root", rootDir, "--confirmation-token", "wrong-token",
    ])).resolves.toMatchObject({ exitCode: 2 });
    await expect(executeCli([
      "purge", "--run-id", runId, "--root", rootDir, "--confirmation-token", token ?? "",
    ])).resolves.toMatchObject({ exitCode: 0 });
    expect(await store.hasEvent("purge_completed")).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("rejects unknown flags, duplicated flags, and malformed run ids", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    await expect(executeCli(["smoke", "--root", rootDir, "--unexpected"])).resolves.toMatchObject({ exitCode: 2 });
    await expect(executeCli(["smoke", "--root", rootDir, "--root", rootDir])).resolves.toMatchObject({ exitCode: 2 });
    await expect(executeCli(["inspect", "--run-id", "../unsafe", "--root", rootDir])).resolves.toMatchObject({ exitCode: 2 });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("renders operational filesystem failures without exposing a root path or raw OS error", async () => {
  const rootDir = join(tmpdir(), "ai assist cli invalid root");

  try {
    await writeFile(rootDir, "not-a-directory", "utf8");
    const result = await executeCli(["smoke", "--root", rootDir]);

    expect(result).toEqual({ exitCode: 2, stdout: "", stderr: "internal_error: operation failed\n" });
    expect(result.stderr).not.toContain(rootDir);
    expect(result.stderr).not.toContain("ENOTDIR");
  } finally {
    await rm(rootDir, { force: true });
  }
});

it("rejects a redirected managed runs directory before CLI operations read or mutate it", async () => {
  const rootDir = await createTemporaryRoot();
  const outsideRoot = await createTemporaryRoot();
  const runId = "00000000-0000-4000-8000-000000000021";
  const outsideRuns = join(outsideRoot, "projects", "project", "sessions", "session", "runs");
  const sentinelPath = join(outsideRuns, "sentinel.txt");

  try {
    const externalStore = await createRunStore({
      rootDir: outsideRoot,
      projectId: "project",
      sessionId: "session",
      runId,
    });
    await externalStore.recordArtifact({ name: "scope.txt", classification: "public", content: "outside-content" });
    await writeFile(sentinelPath, "outside-sentinel", "utf8");

    const redirectedRuns = join(rootDir, "projects", "project", "sessions", "session", "runs");
    await mkdir(join(rootDir, "projects", "project", "sessions", "session"), { recursive: true });
    await symlink(outsideRuns, redirectedRuns, process.platform === "win32" ? "junction" : "dir");

    await expect(openRunStore({ rootDir, runId })).rejects.toThrow("policy_denied");
    for (const command of [
      ["inspect", "--run-id", runId, "--root", rootDir],
      ["export", "--run-id", runId, "--root", rootDir],
      ["purge", "--run-id", runId, "--root", rootDir, "--confirmation-token", "unused-token"],
    ]) {
      await expect(executeCli(command)).resolves.toMatchObject({ exitCode: 2, stderr: expect.stringContaining("policy_denied") });
    }
    await expect(readFile(sentinelPath, "utf8")).resolves.toBe("outside-sentinel");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

it("rejects creating a run through a redirected managed hierarchy", async () => {
  const rootDir = await createTemporaryRoot();
  const outsideRuns = await createTemporaryRoot();

  try {
    const redirectedRuns = join(rootDir, "projects", "project", "sessions", "session", "runs");
    await mkdir(join(rootDir, "projects", "project", "sessions", "session"), { recursive: true });
    await symlink(outsideRuns, redirectedRuns, process.platform === "win32" ? "junction" : "dir");

    await expect(createRunStore({
      rootDir,
      projectId: "project",
      sessionId: "session",
      runId: "00000000-0000-4000-8000-000000000022",
    })).rejects.toThrow("policy_denied");
    await expect(readFile(join(outsideRuns, "00000000-0000-4000-8000-000000000022", "events.jsonl"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
    await rm(outsideRuns, { recursive: true, force: true });
  }
});

it("runs Feature 1 workflow via explicit feature1 command", async () => {
  const roots: string[] = [];
  const runFeature1 = async (rootDir: string) => {
    roots.push(rootDir);
    return "Feature 1 workflow completed.\nreport: feature1-validation/latest.md";
  };
  const result = await executeCli(["feature1", "--root", "repo-root"], {
    cwd: () => "ignored",
    runFeature1,
    runFeature2: async () => "unused",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Feature 1 workflow completed.");
  expect(result.stdout).toContain("feature1-validation/latest.md");
  expect(roots).toEqual(["repo-root"]);
});

it("runs Feature 1 workflow via phrase alias", async () => {
  const roots: string[] = [];
  const runFeature1 = async (rootDir: string) => {
    roots.push(rootDir);
    return "Feature 1 workflow completed.";
  };
  const result = await executeCli(["用feature 1来解析报告"], {
    cwd: () => "phrase-root",
    runFeature1,
    runFeature2: async () => "unused",
  });

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Feature 1 workflow completed.");
  expect(roots).toEqual(["phrase-root"]);
});

it("routes explicit Feature 2 command with one workbook", async () => {
  const runFeature2 = async (rootDir: string, workbookPath: string, selection: { mode: string }) => `selection: ${selection.mode}\nrunRoot: ${rootDir}/runs\nworkbook: ${workbookPath}`;
  const result = await executeCli(["feature2", "--root", "repo", "--workbook", "Demo.xlsx"], { cwd: () => "ignored", runFeature2 });

  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(result.stdout).toContain("selection: prompt");
  expect(result.stdout).toContain("runRoot: repo/runs");
  expect(result.stdout).toContain("workbook: Demo.xlsx");
});

it("routes the Feature 2 phrase alias without scanning for a workbook", async () => {
  const runFeature2 = async (rootDir: string, workbookPath: string, selection: { mode: string }) => `root: ${rootDir}\nworkbook: ${workbookPath}\nselection: ${selection.mode}`;
  const dependencies = { cwd: () => "repo", runFeature2 };

  await expect(executeCli(["帮我用F2分析下excel", "Demo.xlsx"], dependencies)).resolves.toMatchObject({ exitCode: 0, stderr: "" });
  await expect(executeCli(["use F2 to analyze Excel"], dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringContaining("workbook is required") });
});

it("routes explicit Feature 3 command with one Feature 2 artifact directory", async () => {
  const runFeature3 = async (rootDir: string, f2ArtifactRoot: string) => `Feature 3 workflow completed.\nf3: ${rootDir}/f3\ninput: ${f2ArtifactRoot}`;
  const result = await executeCli(
    ["feature3", "--root", "repo", "--f2-artifacts", "runs/demo/f2"],
    { cwd: () => "ignored", runFeature2: async () => "unused", runFeature3 },
  );

  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(result.stdout).toContain("f3: repo/f3");
  expect(result.stdout).toContain("input: runs/demo/f2");
});

it("routes the Feature 3 phrase alias without scanning for artifacts", async () => {
  const runFeature3 = async (rootDir: string, f2ArtifactRoot: string) => `root: ${rootDir}\nf2: ${f2ArtifactRoot}`;
  const dependencies = { cwd: () => "repo", runFeature2: async () => "unused", runFeature3 };

  await expect(executeCli(["帮我用F3治理DIM ID", "runs/demo/f2"], dependencies)).resolves.toMatchObject({ exitCode: 0, stderr: "" });
  await expect(executeCli(["use F3 to govern DIM IDs"], dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringContaining("artifact directory is required") });
});

it("routes explicit Feature 5 command with three artifact roots and options", async () => {
  const calls: unknown[] = [];
  const runFeature5 = async (...args: unknown[]) => {
    calls.push(args);
    return "Feature 5 workflow completed.\nf5: runs/demo/f5\nstatus: completed";
  };
  const result = await executeCli([
    "feature5", "--root", "repo",
    "--f1-artifacts", "runs/demo/f1",
    "--f3-artifacts", "runs/demo/f3",
    "--f4-artifacts", "runs/demo/f4",
    "--worksheets", "Overview, Details",
    "--image-observations", "observations.json",
  ], { cwd: () => "ignored", runFeature2: async () => "unused", runFeature5 });

  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(calls).toEqual([["repo", "runs/demo/f1", "runs/demo/f3", "runs/demo/f4", {
    selectedWorksheetNames: ["Overview", "Details"],
    imageObservationsPath: "observations.json",
  }]]);
});

it("routes explicit Feature 6 with four artifact roots, repeated worksheets, and optional evidence", async () => {
  const calls: unknown[] = [];
  const runFeature6 = async (...args: unknown[]) => {
    calls.push(args);
    return "Feature 6 workflow completed.\nfullReportPath: C:/repo/test/demo-output/f6-runs/demo/run-1/Feature6-Report.md\nstatus: completed";
  };
  const result = await executeCli([
    "feature6", "--root", " repo ",
    "--f2-artifacts", " f2 ",
    "--f3-artifacts", " f3 ",
    "--f4-artifacts", " f4 ",
    "--f5-artifacts", " f5 ",
    "--worksheet", " Overview ",
    "--worksheet", " Details ",
    "--language", " en-US ",
    "--model-interpretation", " model.json ",
    "--supplier-capability", " supplier.json ",
    "--datum-strategy", " datum.json ",
    "--cost", " cost.json ",
    "--image-observations", " images.json ",
    "--analysis-context", " context.json ",
    "--optimization-targets", " targets.json ",
  ], { cwd: () => "ignored", runFeature2: async () => "unused", runFeature6 });

  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(calls).toEqual([["repo", "f2", "f3", "f4", "f5", {
    selectedWorksheetNames: ["Overview", "Details"],
    languageTag: "en-US",
    modelInterpretationPath: "model.json",
    supplierCapabilityPath: "supplier.json",
    datumStrategyPath: "datum.json",
    costPath: "cost.json",
    imageObservationsPath: "images.json",
    analysisContextPath: "context.json",
    optimizationTargetsPath: "targets.json",
  }]]);
});

it("runs Feature 6 through the default wrapper with workbook-derived report paths", async () => {
  const repoRoot = process.cwd();
  const fixtureId = randomUUID();
  const f5Stem = `f5-cli-${fixtureId}`;
  const fixtureRoot = join(repoRoot, "test", "demo-output", `.feature6-cli-${fixtureId}`);
  const inputsRoot = join(fixtureRoot, "inputs");
  const outputRoot = join(repoRoot, "test", "demo-output", "f6-runs", f5Stem);
  const fixtureModule = pathToFileURL(join(repoRoot, "scripts", "f6-artifact-test-fixture.mjs")).href;
  const setupCode = `
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createF6ArtifactBundleFixture, installRequiredMultimodalV3 } from ${JSON.stringify(fixtureModule)};
const [targetRoot, f5Stem] = process.argv.slice(1);
const bundle = createF6ArtifactBundleFixture({ worksheetNames: ["Analysis-A"] });
installRequiredMultimodalV3(bundle);
for (const [source, target] of [
  [bundle.f2ArtifactRoot, join(targetRoot, "f2")],
  [bundle.f3ArtifactRoot, join(targetRoot, "f3")],
  [bundle.f4ArtifactRoot, join(targetRoot, "f4")],
  [bundle.f5ArtifactRoot, join(targetRoot, f5Stem)],
]) cpSync(source, target, { recursive: true });
for (const relativeReport of [join("f2", "Feature2-Report.json"), join("f3", "Feature3-Report.json")]) {
  const reportPath = join(targetRoot, relativeReport);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  report.artifactRoot = join(targetRoot, "f2");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\\n", "utf8");
}
cpSync(join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact), join(targetRoot, "model-interpretation.json"));
rmSync(bundle.root, { recursive: true, force: true });
`;

  try {
    await mkdir(inputsRoot, { recursive: true });
    await execFileAsync(process.execPath, ["--input-type=module", "-e", setupCode, inputsRoot, f5Stem], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    vi.stubEnv("AI_TVA_F6_OUTPUT_ROOT", join(tmpdir(), "forbidden-f6-output"));
    vi.stubEnv("AI_TVA_F6_PUBLISH_ROOT", tmpdir());

    const result = await executeCli([
      "feature6", "--root", repoRoot,
      "--f2-artifacts", join(inputsRoot, "f2"),
      "--f3-artifacts", join(inputsRoot, "f3"),
      "--f4-artifacts", join(inputsRoot, "f4"),
      "--f5-artifacts", join(inputsRoot, f5Stem),
      "--worksheet", "Analysis-A",
      "--language", "en-US",
      "--model-interpretation", join(inputsRoot, "model-interpretation.json"),
    ]);

    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
    expect(result.stdout).toContain("Feature 6 workflow completed.");
    expect(result.stdout).toMatch(new RegExp(`fullReportPath: .*test[\\\\/]demo-output[\\\\/]f6-runs[\\\\/]${f5Stem}[\\\\/][^\\r\\n]*Anonymous - TA ENGINEERING ANALYSIS REPORT\\.md`));
    expect(result.stdout).toMatch(new RegExp(`fullPdfReportPath: .*test[\\\\/]demo-output[\\\\/]f6-runs[\\\\/]${f5Stem}[\\\\/][^\\r\\n]*Anonymous - TA ENGINEERING ANALYSIS REPORT\\.pdf`));
    expect(result.stdout).not.toContain(tmpdir());
  } finally {
    vi.unstubAllEnvs();
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(outputRoot, { recursive: true, force: true });
  }
}, 240_000);

it("requires exactly four Feature 6 artifact flags and at least one worksheet", async () => {
  const runFeature6 = async () => "unused";
  const dependencies = { cwd: () => "repo", runFeature2: async () => "unused", runFeature6 };
  const complete = [
    "feature6", "--root", "repo",
    "--f2-artifacts", "f2", "--f3-artifacts", "f3", "--f4-artifacts", "f4", "--f5-artifacts", "f5",
    "--worksheet", "Overview",
    "--language", "en-US", "--model-interpretation", "model.json",
  ];

  for (const flag of ["--f2-artifacts", "--f3-artifacts", "--f4-artifacts", "--f5-artifacts", "--worksheet"]) {
    const args = [...complete];
    args.splice(args.indexOf(flag), 2);
    await expect(executeCli(args, dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "" });
  }
  await expect(executeCli([...complete, "--f2-artifacts", "other"], dependencies))
    .resolves.toMatchObject({ exitCode: 2, stderr: expect.stringContaining("duplicate option") });
});

it("rejects blank, missing, and duplicate-after-trim Feature 6 values", async () => {
  const dependencies = { cwd: () => "repo", runFeature2: async () => "unused", runFeature6: async () => "unused" };
  const complete = [
    "feature6", "--root", "repo",
    "--f2-artifacts", "f2", "--f3-artifacts", "f3", "--f4-artifacts", "f4", "--f5-artifacts", "f5",
    "--worksheet", "Overview",
    "--language", "en-US", "--model-interpretation", "model.json",
  ];

  for (const flag of ["--root", "--f2-artifacts", "--f3-artifacts", "--f4-artifacts", "--f5-artifacts", "--worksheet"]) {
    const args = [...complete];
    args[args.indexOf(flag) + 1] = "   ";
    await expect(executeCli(args, dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "" });
  }
  await expect(executeCli([...complete, "--worksheet", " Overview "], dependencies))
    .resolves.toMatchObject({ exitCode: 2, stderr: expect.stringContaining("unique worksheet") });
  await expect(executeCli([...complete, "--cost"], dependencies))
    .resolves.toMatchObject({ exitCode: 2, stderr: expect.stringContaining("option value is missing") });
  await expect(executeCli([...complete, "--cost", "   "], dependencies))
    .resolves.toMatchObject({ exitCode: 2, stdout: "" });
});

it("keeps Feature 6 flags command-specific and provides no phrase alias", async () => {
  const dependencies = { cwd: () => "repo", runFeature2: async () => "unused", runFeature6: async () => "unused" };

  await expect(executeCli([
    "feature5", "--root", "repo", "--f1-artifacts", "f1", "--f3-artifacts", "f3", "--f4-artifacts", "f4",
    "--supplier-capability", "supplier.json",
  ], dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "" });
  await expect(executeCli(["use f6 analysis report"], dependencies))
    .resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringContaining("command is invalid") });
});

it("trims Feature 5 root, artifact, and image-observation paths consistently", async () => {
  const calls: unknown[] = [];
  const runFeature5 = async (...args: unknown[]) => {
    calls.push(args);
    return "completed";
  };

  const result = await executeCli([
    "feature5", "--root", " repo ",
    "--f1-artifacts", " f1 ",
    "--f3-artifacts", " f3 ",
    "--f4-artifacts", " f4 ",
    "--image-observations", " observations.json ",
  ], { cwd: () => "ignored", runFeature2: async () => "unused", runFeature5 });

  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(calls).toEqual([["repo", "f1", "f3", "f4", { imageObservationsPath: "observations.json" }]]);
});

it("rejects whitespace-only required Feature 5 paths", async () => {
  const dependencies = { cwd: () => "repo", runFeature2: async () => "unused", runFeature5: async () => "unused" };

  for (const [flag, value] of [
    ["--root", "   "],
    ["--f1-artifacts", "\t"],
    ["--f3-artifacts", "\r\n"],
    ["--f4-artifacts", "   "],
    ["--image-observations", "\t"],
  ]) {
    const args = [
      "feature5", "--root", "repo",
      "--f1-artifacts", "f1", "--f3-artifacts", "f3", "--f4-artifacts", "f4",
    ];
    const existingIndex = args.indexOf(flag);
    if (existingIndex >= 0) args[existingIndex + 1] = value;
    else args.push(flag, value);

    await expect(executeCli(args, dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "" });
  }
});

it("routes the exact Feature 5 phrase with three roots and rejects other arities", async () => {
  const calls: unknown[] = [];
  const runFeature5 = async (...args: unknown[]) => {
    calls.push(args);
    return "Feature 5 workflow completed.\nf5: runs/demo/f5\nstatus: completed";
  };
  const dependencies = { cwd: () => "repo", runFeature2: async () => "unused", runFeature5 };

  await expect(executeCli([
    "使用 F5 分析报告", "runs/demo/f1", "runs/demo/f3", "runs/demo/f4",
  ], dependencies)).resolves.toMatchObject({ exitCode: 0, stderr: "" });
  await expect(executeCli([
    "use f5 analysis report", "runs/demo/f1", "runs/demo/f3",
  ], dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringContaining("three artifact directories are required") });
  await expect(executeCli([
    "use f5 analysis report", "runs/demo/f1", "runs/demo/f3", "runs/demo/f4", "extra",
  ], dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringContaining("three artifact directories are required") });
  expect(calls).toEqual([["repo", "runs/demo/f1", "runs/demo/f3", "runs/demo/f4"]]);
});

it("requires all Feature 5 roots and rejects Feature 5 flags on other commands", async () => {
  const dependencies = { cwd: () => "repo", runFeature2: async () => "unused", runFeature5: async () => "unused" };

  await expect(executeCli([
    "feature5", "--root", "repo", "--f1-artifacts", "f1", "--f3-artifacts", "f3",
  ], dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringContaining("--f4-artifacts is required") });
  await expect(executeCli([
    "feature5", "--root", "repo", "--f1-artifacts", "f1", "--f3-artifacts", "f3", "--f4-artifacts", "f4", "--unknown", "value",
  ], dependencies)).resolves.toMatchObject({ exitCode: 2, stdout: "", stderr: expect.stringContaining("unknown option") });
  await expect(executeCli([
    "feature3", "--root", "repo", "--f2-artifacts", "f2", "--f1-artifacts", "f1",
  ], dependencies)).resolves.toMatchObject({ exitCode: 2 });
});

it("allows --workbook only for Feature 2", async () => {
  await expect(executeCli(["smoke", "--root", "repo", "--workbook", "Demo.xlsx"])).resolves.toMatchObject({ exitCode: 2 });
});

it("allows --f2-artifacts only for Feature 3", async () => {
  await expect(executeCli(["smoke", "--root", "repo", "--f2-artifacts", "runs/demo/f2"])).resolves.toMatchObject({ exitCode: 2 });
});

it("passes complete Feature 2 worksheet confirmation and rejects partial flags", async () => {
  const calls: unknown[] = [];
  const runFeature2 = async (...args: unknown[]) => {
    calls.push(args);
    return "confirmed";
  };
  const complete = [
    "feature2", "--root", "repo", "--workbook", "Demo.xlsx",
    "--worksheets", "Analysis-A,Analysis-B", "--workbook-hash", "a".repeat(64), "--confirm",
  ];

  await expect(executeCli(complete, { cwd: () => "ignored", runFeature2 })).resolves.toMatchObject({ exitCode: 0 });
  expect(calls[0]).toEqual(["repo", "Demo.xlsx", {
    mode: "confirmed",
    workbookContentHash: "a".repeat(64),
    selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
  }]);
  await expect(executeCli([
    "feature2", "--root", "repo", "--workbook", "Demo.xlsx", "--confirm",
  ], { cwd: () => "ignored", runFeature2 })).resolves.toMatchObject({ exitCode: 2 });
  expect(calls).toHaveLength(1);
});