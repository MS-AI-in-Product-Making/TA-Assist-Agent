import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createAuditStore } from "@ai-assist/audit";
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

it("does not persist confidential transcript or decision contents without opt-in", async () => {
  const rootDir = await createTemporaryRoot();
  const transcriptMarker = "confidential-transcript-marker";
  const decisionMarker = "confidential-decision-marker";

  try {
    const store = await createRunStore({ rootDir, retainConfidentialArtifacts: false });
    await expect(store.recordTranscript("confidential", { transcriptMarker })).rejects.toThrow("policy_denied");
    await expect(store.recordDecision("confidential", { decisionMarker })).rejects.toThrow("policy_denied");

    const diskContents = await readAllFiles(rootDir);
    expect(diskContents).not.toContain(transcriptMarker);
    expect(diskContents).not.toContain(decisionMarker);
    expect(await readFile(join(store.runDirectory, "transcript.jsonl"), "utf8")).not.toContain(transcriptMarker);
    expect(await readFile(join(store.runDirectory, "decisions.jsonl"), "utf8")).not.toContain(decisionMarker);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("persists public and internal text records for an unpurged run", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir });
    await store.recordTranscript("public", { marker: "public-transcript" });
    await store.recordDecision("internal", { marker: "internal-decision" });

    await expect(readFile(join(store.runDirectory, "transcript.jsonl"), "utf8"))
      .resolves.toContain("public-transcript");
    await expect(readFile(join(store.runDirectory, "decisions.jsonl"), "utf8"))
      .resolves.toContain("internal-decision");
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

it("rejects initializing a purged run without recreating scoped data", async () => {
  const rootDir = await createTemporaryRoot();
  const options = {
    rootDir,
    projectId: "project",
    sessionId: "session",
    runId: "00000000-0000-4000-8000-000000000011",
  };

  try {
    const store = await createRunStore(options);
    const plan = await store.planPurge();
    await store.executePurge(plan.confirmationToken);
    const eventsPath = join(store.runDirectory, "events.jsonl");
    const events = await readFile(eventsPath);

    await expect(readdir(store.runDirectory)).resolves.toEqual(["events.jsonl"]);
    await expect(createRunStore(options)).rejects.toThrow("dependency_error: run has been purged");
    await expect(readdir(store.runDirectory)).resolves.toEqual(["events.jsonl"]);
    await expect(readFile(eventsPath)).resolves.toEqual(events);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("rejects stale public writes after purge without recreating records", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir });
    const plan = await store.planPurge();
    await store.executePurge(plan.confirmationToken);
    const eventsPath = join(store.runDirectory, "events.jsonl");
    const events = await readFile(eventsPath);

    await expect(store.recordArtifact({ name: "after-purge.txt", classification: "public", content: "after-purge" }))
      .rejects.toThrow("dependency_error: run has been purged");
    await expect(store.recordTranscript("public", { marker: "after-purge" }))
      .rejects.toThrow("dependency_error: run has been purged");
    await expect(store.recordDecision("internal", { marker: "after-purge" }))
      .rejects.toThrow("dependency_error: run has been purged");
    await expect(store.createExport()).rejects.toThrow("dependency_error: run has been purged");

    await expect(readdir(store.runDirectory)).resolves.toEqual(["events.jsonl"]);
    await expect(readFile(eventsPath)).resolves.toEqual(events);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("rejects concurrent initialization of a purged run without recreation", async () => {
  const rootDir = await createTemporaryRoot();
  const options = {
    rootDir,
    projectId: "project",
    sessionId: "session",
    runId: "00000000-0000-4000-8000-000000000012",
  };

  try {
    const store = await createRunStore(options);
    const plan = await store.planPurge();
    await store.executePurge(plan.confirmationToken);
    const eventsPath = join(store.runDirectory, "events.jsonl");
    const events = await readFile(eventsPath);

    await expect(Promise.all([createRunStore(options), createRunStore(options)]))
      .rejects.toThrow("dependency_error: run has been purged");
    await expect(readdir(store.runDirectory)).resolves.toEqual(["events.jsonl"]);
    await expect(readFile(eventsPath)).resolves.toEqual(events);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("fails closed before planning or deleting a sealed run", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({
      rootDir,
      projectId: "project",
      sessionId: "session",
      runId: "00000000-0000-4000-8000-000000000001",
      retainConfidentialArtifacts: true,
    });
    await store.recordArtifact({ name: "ta.xlsx", classification: "confidential", content: "retained" });
    const plan = await store.planPurge();
    const auditStore = await createAuditStore(store.runDirectory);
    await auditStore.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [],
    });

    await expect(store.planPurge()).rejects.toThrow("dependency_error");
    await expect(store.executePurge(plan.confirmationToken)).rejects.toThrow("dependency_error");
    await expect(readFile(join(store.runDirectory, "artifacts", "ta.xlsx"), "utf8")).resolves.toBe("retained");
    expect(await store.listArtifacts()).toEqual([{ name: "ta.xlsx", classification: "confidential" }]);
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

it("serializes concurrent artifacts into complete metadata without orphan files", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir });
    await Promise.all([
      store.recordArtifact({ name: "first.txt", classification: "public", content: "first" }),
      store.recordArtifact({ name: "second.txt", classification: "internal", content: "second" }),
      store.recordArtifact({ name: "third.txt", classification: "public", content: "third" }),
    ]);

    expect(await store.listArtifacts()).toEqual(expect.arrayContaining([
      { name: "first.txt", classification: "public" },
      { name: "second.txt", classification: "internal" },
      { name: "third.txt", classification: "public" },
    ]));
    const metadata = await store.listArtifactMetadata();
    expect(metadata).toHaveLength(3);
    expect(JSON.parse(await readFile(join(store.runDirectory, "artifact-metadata.json"), "utf8"))).toHaveLength(3);
    expect((await readdir(join(store.runDirectory, "artifacts"))).sort()).toEqual(metadata.map(({ name }) => name).sort());
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("coordinates independent stores sharing one run during initialization and artifact writes", async () => {
  const rootDir = await createTemporaryRoot();
  const options = {
    rootDir,
    projectId: "project",
    sessionId: "session",
    runId: "00000000-0000-4000-8000-000000000008",
  };

  try {
    const [firstStore, secondStore] = await Promise.all([
      createRunStore(options),
      createRunStore(options),
    ]);
    await Promise.all([
      firstStore.recordArtifact({ name: "first.txt", classification: "public", content: "first" }),
      secondStore.recordArtifact({ name: "second.txt", classification: "internal", content: "second" }),
    ]);

    const metadataPath = join(firstStore.runDirectory, "artifact-metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as Array<{ name: string }>;
    expect(metadata.map(({ name }) => name).sort()).toEqual(["first.txt", "second.txt"]);
    expect((await firstStore.listArtifacts()).map(({ name }) => name).sort()).toEqual(["first.txt", "second.txt"]);
    expect((await readdir(join(firstStore.runDirectory, "artifacts"))).sort()).toEqual(["first.txt", "second.txt"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("never deletes scoped data from a run sealed by a concurrent store", async () => {
  const rootDir = await createTemporaryRoot();
  const options = {
    rootDir,
    projectId: "project",
    sessionId: "session",
    runId: "00000000-0000-4000-8000-000000000009",
  };

  try {
    const store = await createRunStore(options);
    await store.recordArtifact({ name: "purge.txt", classification: "public", content: "purge" });
    const plan = await store.planPurge();
    const sealingStore = await createAuditStore(store.runDirectory);
    const purge = store.executePurge(plan.confirmationToken);
    const sealing = sealingStore.writeManifest({
      runId: options.runId,
      artifacts: [],
    });

    const [purgeResult, sealingResult] = await Promise.allSettled([purge, sealing]);
    expect(sealingResult.status).toBe("fulfilled");
    if (purgeResult.status === "fulfilled") {
      await expect(readFile(join(store.runDirectory, "artifacts", "purge.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect(await store.hasEvent("purge_completed")).toBe(true);
    } else {
      expect(String(purgeResult.reason)).toContain("dependency_error");
      await expect(readFile(join(store.runDirectory, "artifacts", "purge.txt"), "utf8")).resolves.toBe("purge");
    }
    await expect(sealingStore.verify()).resolves.toEqual({ valid: true, failures: [] });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("coordinates purge and artifact writes across independent stores without recreating purged data", async () => {
  const rootDir = await createTemporaryRoot();
  const options = {
    rootDir,
    projectId: "project",
    sessionId: "session",
    runId: "00000000-0000-4000-8000-000000000010",
  };

  try {
    const [purgingStore, writingStore] = await Promise.all([
      createRunStore(options),
      createRunStore(options),
    ]);
    const plan = await purgingStore.planPurge();
    const memoryLockPath = join(purgingStore.runDirectory, "memory.lock");
    await writeFile(memoryLockPath, JSON.stringify({ lockId: "test-lock" }), "utf8");

    const purge = purgingStore.executePurge(plan.confirmationToken);
    await waitForPath(join(purgingStore.runDirectory, "audit.lock"));
    const artifact = writingStore.recordArtifact({
      name: "late.txt",
      classification: "public",
      content: "must-not-survive-purge",
    });
    await rm(memoryLockPath);

    await expect(artifact).rejects.toThrow("dependency_error: run has been purged");
    await purge;
    expect(await purgingStore.listArtifactMetadata()).toEqual([]);
    expect(await purgingStore.listArtifacts()).toEqual([]);
    await expect(readdir(join(purgingStore.runDirectory, "artifacts"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await purgingStore.hasEvent("purge_completed")).toBe(true);
    await expect(readdir(purgingStore.runDirectory)).resolves.not.toContainEqual(expect.stringMatching(/^(audit|memory)\.lock$/));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("coordinates purge and text writes across independent stores without recreating records", async () => {
  const rootDir = await createTemporaryRoot();
  const options = {
    rootDir,
    projectId: "project",
    sessionId: "session",
    runId: "00000000-0000-4000-8000-000000000013",
  };

  try {
    const [purgingStore, writingStore] = await Promise.all([
      createRunStore(options),
      createRunStore(options),
    ]);
    const plan = await purgingStore.planPurge();
    const memoryLockPath = join(purgingStore.runDirectory, "memory.lock");
    await writeFile(memoryLockPath, JSON.stringify({ lockId: "test-lock" }), "utf8");

    const purge = purgingStore.executePurge(plan.confirmationToken);
    await waitForPath(join(purgingStore.runDirectory, "audit.lock"));
    const transcript = writingStore.recordTranscript("public", { marker: "must-not-survive-purge" });
    const decision = writingStore.recordDecision("internal", { marker: "must-not-survive-purge" });
    await rm(memoryLockPath);

    await expect(transcript).rejects.toThrow("dependency_error: run has been purged");
    await expect(decision).rejects.toThrow("dependency_error: run has been purged");
    await purge;
    await expect(readdir(purgingStore.runDirectory)).resolves.toEqual(["events.jsonl"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("rejects Windows-unsafe artifact names and allows a normal basename", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir });
    for (const name of ["report.txt:shadow", "C:\\report.txt", "../report.txt", "dir/report.txt", "report. ", "CON", "nul.txt", "COM1.log", "Lpt9"]) {
      await expect(store.recordArtifact({ name, classification: "public", content: "content" })).rejects.toThrow("validation_error");
    }
    await expect(store.recordArtifact({ name: "report.txt", classification: "public", content: "content" })).resolves.toBeUndefined();
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

it("uses the run root as the audit ledger and rejects corrupted audit queries", async () => {
  const rootDir = await createTemporaryRoot();

  try {
    const store = await createRunStore({ rootDir, projectId: "project", sessionId: "session", runId: "run" });
    await expect(readdir(store.runDirectory)).resolves.toEqual(expect.arrayContaining([
      "transcript.jsonl",
      "decisions.jsonl",
      "events.jsonl",
      "artifacts",
    ]));
    await expect(readdir(store.runDirectory)).resolves.not.toContain("audit");
    await writeFile(join(store.runDirectory, "events.jsonl"), "not-json\n", "utf8");
    await expect(store.hasEvent("purge_completed")).rejects.toThrow("validation_error");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

async function readAllFiles(directory: string): Promise<string> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const contents = await Promise.all(entries
    .filter((entry) => entry.isFile())
    .map((entry) => readFile(join(entry.parentPath, entry.name), "utf8")));
  return contents.join("\n");
}

async function waitForPath(path: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1));
    }
  }
  throw new Error(`test setup failed: ${path} was not created`);
}