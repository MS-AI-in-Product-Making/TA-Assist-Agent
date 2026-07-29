import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRunStore, openRunStore } from "@ai-assist/memory";
import { expect, it } from "vitest";
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
    expect(result.stdout).toContain("F4: feature_not_available");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
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