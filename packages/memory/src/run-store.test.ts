import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createRunStore } from "./index.js";

async function createTemporaryRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ai-assist-memory-"));
}

it("does not retain confidential artifacts without opt-in", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir, retainConfidentialArtifacts: false });
    await store.recordArtifact({ name: "ta.xlsx", classification: "confidential", content: "redacted" });

    expect(await store.listArtifacts()).toEqual([]);
    expect(await store.listArtifactMetadata()).toMatchObject([
      { classification: "confidential", name: "ta.xlsx", retention: "metadata_only" },
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("purges scoped artifacts while retaining cleanup evidence", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir, retainConfidentialArtifacts: true });
    await store.recordArtifact({ name: "ta.xlsx", classification: "confidential", content: "retained" });

    const plan = await store.planPurge();
    await store.executePurge(plan.confirmationToken);

    expect(await store.listArtifacts()).toEqual([]);
    expect(await store.hasEvent("purge_completed")).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("rejects secrets without writing their contents to disk", async () => {
  const rootDir = await createTemporaryRoot();
  const secret = "never-persist-this-token";

  try {
    const store = await createRunStore({ rootDir });
    await expect(store.recordArtifact({ name: "token.txt", classification: "secret", content: secret }))
      .rejects.toThrow("policy_denied");
    await expect(store.recordTranscript("secret", { secret })).rejects.toThrow("policy_denied");
    await expect(store.recordDecision("secret", { secret })).rejects.toThrow("policy_denied");
    await expect(readdir(rootDir, { recursive: true })).resolves.not.toContain("token.txt");
    await expect(readFile(join(store.runDirectory, "artifact-metadata.json"), "utf8"))
      .resolves.not.toContain(secret);
    await expect(readFile(join(store.runDirectory, "transcript.jsonl"), "utf8")).resolves.not.toContain(secret);
    await expect(readFile(join(store.runDirectory, "decisions.jsonl"), "utf8")).resolves.not.toContain(secret);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("retains opted-in confidential content and safe metadata", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir, retainConfidentialArtifacts: true });
    await store.recordArtifact({ name: "input.bin", classification: "confidential", content: Buffer.from([0x80]) });

    expect(await store.listArtifacts()).toEqual([{ name: "input.bin", classification: "confidential" }]);
    expect(await store.listArtifactMetadata()).toMatchObject([
      { classification: "confidential", name: "input.bin", retention: "retained", hash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("requires confidential export confirmation and rejects secret export requests", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir, retainConfidentialArtifacts: true });
    await store.recordArtifact({ name: "ta.xlsx", classification: "confidential", content: "retained" });

    await expect(store.createExport()).rejects.toThrow("policy_denied");
    await expect(store.createExport({ confirmConfidential: true, includeSecret: true })).rejects.toThrow("policy_denied");
    const exported = await store.createExport({ confirmConfidential: true });
    expect(exported.manifest.artifacts).toEqual([{ name: "ta.xlsx", classification: "confidential" }]);
    await expect(readFile(exported.path, "utf8")).resolves.not.toContain("retained");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("rejects invalid and reused purge tokens without touching another run", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const first = await createRunStore({ rootDir, projectId: "project", sessionId: "session", runId: "run-one" });
    const second = await createRunStore({ rootDir, projectId: "project", sessionId: "session", runId: "run-two" });
    await first.recordArtifact({ name: "first.txt", classification: "public", content: "first" });
    await second.recordArtifact({ name: "second.txt", classification: "public", content: "second" });

    const plan = await first.planPurge();
    await expect(first.executePurge("wrong-token")).rejects.toThrow("policy_denied");
    await first.executePurge(plan.confirmationToken);
    await expect(first.executePurge(plan.confirmationToken)).rejects.toThrow("policy_denied");
    expect(await second.listArtifacts()).toEqual([{ name: "second.txt", classification: "public" }]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("writes lifecycle events only through the dedicated audit ledger", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir, projectId: "project", sessionId: "session", runId: "run" });
    const plan = await store.planPurge();
    await store.executePurge(plan.confirmationToken);

    await expect(readdir(store.runDirectory)).resolves.not.toContain("events.jsonl");
    const ledger = await readFile(join(store.runDirectory, "audit", "events.jsonl"), "utf8");
    expect(ledger).toContain("purge_completed");
    expect(await store.hasEvent("purge_completed")).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});