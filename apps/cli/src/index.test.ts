import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRunStore } from "@ai-assist/memory";
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

it("inspects only safe metadata and exports a public smoke run", async () => {
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
    expect(exported).toMatchObject({ exitCode: 0, stderr: "" });
    expect(exported.stdout).toContain("classification: public");
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