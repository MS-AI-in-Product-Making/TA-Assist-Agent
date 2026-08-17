import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRunStore, openRunStore } from "@ai-assist/memory";
import { expect, it } from "vitest";
import { formatF4Status } from "./commands/smoke.js";
import { executeCli } from "./index.js";

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
  const repoRoot = process.cwd();
  const result = await executeCli(["feature1", "--root", repoRoot]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Feature 1 workflow completed.");
  expect(result.stdout).toContain("feature1-validation/latest.md");
}, 120_000);

it("runs Feature 1 workflow via phrase alias", async () => {
  const result = await executeCli(["用feature 1来解析报告"]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Feature 1 workflow completed.");
}, 120_000);

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
    return "Feature 6 workflow completed.\nf6: runs/demo/f6\nstatus: completed";
  };
  const result = await executeCli([
    "feature6", "--root", " repo ",
    "--f2-artifacts", " f2 ",
    "--f3-artifacts", " f3 ",
    "--f4-artifacts", " f4 ",
    "--f5-artifacts", " f5 ",
    "--worksheet", " Overview ",
    "--worksheet", " Details ",
    "--supplier-capability", " supplier.json ",
    "--datum-strategy", " datum.json ",
    "--cost", " cost.json ",
    "--image-observations", " images.json ",
  ], { cwd: () => "ignored", runFeature2: async () => "unused", runFeature6 });

  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(calls).toEqual([["repo", "f2", "f3", "f4", "f5", {
    selectedWorksheetNames: ["Overview", "Details"],
    supplierCapabilityPath: "supplier.json",
    datumStrategyPath: "datum.json",
    costPath: "cost.json",
    imageObservationsPath: "images.json",
  }]]);
});

it("requires exactly four Feature 6 artifact flags and at least one worksheet", async () => {
  const runFeature6 = async () => "unused";
  const dependencies = { cwd: () => "repo", runFeature2: async () => "unused", runFeature6 };
  const complete = [
    "feature6", "--root", "repo",
    "--f2-artifacts", "f2", "--f3-artifacts", "f3", "--f4-artifacts", "f4", "--f5-artifacts", "f5",
    "--worksheet", "Overview",
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