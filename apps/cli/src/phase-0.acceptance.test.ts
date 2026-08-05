import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRunStore, openRunStore } from "@ai-assist/memory";
import { expect, it } from "vitest";
import { executeCli } from "./index.js";

it("accepts the sealed smoke workflow and safely purges a separate public run", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-phase-0-"));
  const purgeRootDir = await mkdtemp(join(tmpdir(), "ai-assist-phase-0-purge-"));
  const acceptanceDocument = new URL("../../../docs/governance/phase-0-acceptance.md", import.meta.url);

  try {
    const smoke = await executeCli(["smoke", "--root", rootDir]);
    const runId = smoke.stdout.match(/runId: ([0-9a-f-]{36})/)?.[1];

    expect(runId).toBeDefined();
    expect(smoke.stdout).toContain("manifestValid: true");
    expect(smoke.stdout).toContain("F4: available");

    const sealedExport = await executeCli(["export", "--run-id", runId ?? "", "--root", rootDir]);
    expect(sealedExport.exitCode).toBe(2);
    expect(sealedExport.stderr).toContain("dependency_error: sealed audit runs cannot be modified");
    await expect(readdir((await openRunStore({ rootDir, runId: runId ?? "" })).runDirectory)).resolves.not.toContain("exports");
    expect((await executeCli(["purge-plan", "--run-id", runId ?? "", "--root", rootDir])).exitCode).toBe(2);

    const purgeRunId = "00000000-0000-4000-8000-000000000101";
    const purgeStore = await createRunStore({
      rootDir: purgeRootDir,
      projectId: "phase-0",
      sessionId: "acceptance",
      runId: purgeRunId,
    });

    const exported = await executeCli(["export", "--run-id", purgeRunId, "--root", purgeRootDir]);
    expect(exported.exitCode).toBe(0);
    expect(exported.stderr).toBe("");
    expect(exported.stdout).toContain("classification: public");
    expect(exported.stdout).toContain("artifactCount: 0");
    expect(exported.stdout).not.toContain("public smoke");

    await purgeStore.recordArtifact({ name: "public-fixture.txt", classification: "public", content: "anonymous" });

    const purgePlan = await executeCli(["purge-plan", "--run-id", purgeRunId, "--root", purgeRootDir]);
    const confirmationToken = purgePlan.stdout.match(/confirmationToken: ([A-Za-z0-9_-]+)/)?.[1];
    expect(purgePlan.stderr).toBe("");
    expect(purgePlan.exitCode).toBe(0);
    expect(confirmationToken).toBeDefined();
    expect((await executeCli([
      "purge", "--run-id", purgeRunId, "--root", purgeRootDir, "--confirmation-token", "wrong-token",
    ])).exitCode).toBe(2);

    const purged = await executeCli([
      "purge", "--run-id", purgeRunId, "--root", purgeRootDir, "--confirmation-token", confirmationToken ?? "",
    ]);
    expect(purged.exitCode).toBe(0);
    expect(await purgeStore.hasEvent("purge_completed")).toBe(true);
    expect(await (await openRunStore({ rootDir: purgeRootDir, runId: purgeRunId })).listArtifacts()).toEqual([]);

    const inspected = await executeCli(["inspect", "--run-id", purgeRunId, "--root", purgeRootDir]);
    expect(inspected.exitCode).toBe(0);
    expect(inspected.stdout).toContain("artifactCount: 0");
    await expect(readFile(acceptanceDocument, "utf8")).resolves.toContain("Phase 0 验收");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
    await rm(purgeRootDir, { recursive: true, force: true });
  }
});