import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createAuditStore } from "./index.js";

it("appends events and verifies manifest hashes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));

  try {
    const store = await createAuditStore(directory);
    await store.append({
      type: "run_created",
      classification: "public",
      payload: { key: "value" },
    });
    await store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [],
    });
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(manifest).toMatchObject({
      runId: "00000000-0000-4000-8000-000000000001",
    });
    expect(manifest.schemaHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(manifest.eventsHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(manifest.skillHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(manifest.configurationHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(manifest.inputHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(manifest.outputHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));

    await expect(store.verify()).resolves.toEqual({ valid: true, failures: [] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("seals events in the manifest and detects events tampering", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const eventsPath = join(directory, "events.jsonl");

  try {
    const store = await createAuditStore(directory);
    await store.append({
      type: "run_created",
      classification: "public",
      payload: { id: "run-1" },
    });
    await store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [],
    });

    await expect(
      store.append({
        type: "skill_started",
        classification: "internal",
        payload: { name: "extract" },
      }),
    ).rejects.toThrow("validation_error");

    for (const replacement of ["tampered\n", "", "replaced\n"]) {
      await writeFile(eventsPath, replacement, "utf8");
      await expect(store.verify()).resolves.toMatchObject({
        valid: false,
        failures: expect.arrayContaining([expect.stringContaining("events")]),
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("keeps a sealed manifest immutable across sequential and concurrent reseal attempts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const concurrentDirectory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));

  try {
    const store = await createAuditStore(directory);
    await store.append({
      type: "run_created",
      classification: "public",
      payload: { id: "run-1" },
    });
    await store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [],
    });
    const sealedManifest = await readFile(join(directory, "manifest.json"));

    await expect(
      store.writeManifest({
        runId: "00000000-0000-4000-8000-000000000002",
        artifacts: [],
      }),
    ).rejects.toThrow("validation_error");
    await expect(readFile(join(directory, "manifest.json"))).resolves.toEqual(sealedManifest);
    await expect(store.verify()).resolves.toEqual({ valid: true, failures: [] });

    const concurrentStore = await createAuditStore(concurrentDirectory);
    const concurrentSeals = await Promise.allSettled([
      concurrentStore.writeManifest({
        runId: "00000000-0000-4000-8000-000000000003",
        artifacts: [],
      }),
      concurrentStore.writeManifest({
        runId: "00000000-0000-4000-8000-000000000004",
        artifacts: [],
      }),
    ]);

    expect(concurrentSeals.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrentSeals.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(concurrentStore.verify()).resolves.toEqual({ valid: true, failures: [] });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(concurrentDirectory, { recursive: true, force: true });
  }
});

it("stores only payload hashes and rejects invalid event input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const payload = { token: "must-not-be-persisted" };

  try {
    const store = await createAuditStore(directory);
    await store.append({
      type: "policy_evaluated",
      classification: "internal",
      payload,
    });

    const events = await readFile(join(directory, "events.jsonl"), "utf8");
    const event = JSON.parse(events) as Record<string, unknown>;
    expect(event).toMatchObject({
      type: "policy_evaluated",
      classification: "internal",
    });
    expect(event).toHaveProperty("eventId");
    expect(event).toHaveProperty("timestamp");
    expect(event).toHaveProperty("payloadHash");
    expect(events).not.toContain(payload.token);
    expect(event).not.toHaveProperty("payload");

    await expect(
      store.append({
        type: "unknown_event" as "run_created",
        classification: "public",
        payload: {},
      }),
    ).rejects.toThrow("validation_error");
    await expect(
      store.append({
        type: "run_created",
        classification: "untrusted" as "public",
        payload: {},
      }),
    ).rejects.toThrow("validation_error");
    await expect(
      store.append({
        type: "run_created",
        classification: "public",
        payload: undefined,
      }),
    ).rejects.toThrow("validation_error");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("detects altered artifacts and rejects manifest path traversal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const missingArtifactDirectory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const artifactPath = join(directory, "result.txt");

  try {
    await writeFile(artifactPath, "original", "utf8");
    const store = await createAuditStore(directory);
    await store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [{ path: "result.txt" }],
    });
    await expect(store.verify()).resolves.toEqual({ valid: true, failures: [] });

    await writeFile(artifactPath, "altered", "utf8");
    await expect(store.verify()).resolves.toMatchObject({
      valid: false,
      failures: [expect.stringContaining("result.txt")],
    });

    const missingArtifactPath = join(missingArtifactDirectory, "missing.txt");
    await writeFile(missingArtifactPath, "present", "utf8");
    const missingArtifactStore = await createAuditStore(missingArtifactDirectory);
    await missingArtifactStore.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [{ path: "missing.txt" }],
    });
    await rm(missingArtifactPath);
    await expect(missingArtifactStore.verify()).resolves.toMatchObject({
      valid: false,
      failures: [expect.stringContaining("missing.txt")],
    });

    await expect(
      store.writeManifest({
        runId: "00000000-0000-4000-8000-000000000001",
        artifacts: [{ path: "../outside.txt" }],
      }),
    ).rejects.toThrow("validation_error");
    await expect(
      store.writeManifest({
        runId: "00000000-0000-4000-8000-000000000001",
        inputHash: "raw-confidential-input",
        artifacts: [],
      }),
    ).rejects.toThrow("validation_error");

    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify({
        runId: "00000000-0000-4000-8000-000000000001",
        schemaHash: "0".repeat(64),
        skillHash: "0".repeat(64),
        configurationHash: "0".repeat(64),
        inputHash: "0".repeat(64),
        outputHash: "0".repeat(64),
        eventsHash: "0".repeat(64),
        artifacts: [{ path: "../outside.txt", sha256: "0".repeat(64) }],
      }),
      "utf8",
    );
    await expect(store.verify()).resolves.toMatchObject({
      valid: false,
      failures: expect.arrayContaining([expect.stringContaining("unsafe")]),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(missingArtifactDirectory, { recursive: true, force: true });
  }
});

it("detects replacement of an invalid UTF-8 artifact byte", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const artifactPath = join(directory, "binary.bin");

  try {
    await writeFile(artifactPath, Buffer.from([0x80]));
    const store = await createAuditStore(directory);
    await store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [{ path: "binary.bin" }],
    });
    await expect(store.verify()).resolves.toEqual({ valid: true, failures: [] });

    await writeFile(artifactPath, Buffer.from([0x81]));
    await expect(store.verify()).resolves.toMatchObject({
      valid: false,
      failures: [expect.stringContaining("binary.bin")],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("serializes concurrent appends and sealing into a valid audit bundle", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));

  try {
    const store = await createAuditStore(directory);
    const beforeSeal = Array.from({ length: 100 }, (_, index) => store.append({
      type: "skill_started",
      classification: "internal",
      payload: { index },
    }));
    const sealing = store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [],
    });
    const afterSeal = Array.from({ length: 100 }, (_, index) => store.append({
      type: "skill_completed",
      classification: "internal",
      payload: { index },
    }));

    const beforeResults = await Promise.allSettled(beforeSeal);
    await expect(sealing).resolves.toBeUndefined();
    const afterResults = await Promise.allSettled(afterSeal);

    expect(beforeResults.filter((result) => result.status === "fulfilled")).toHaveLength(100);
    expect(afterResults.filter((result) => result.status === "rejected")).toHaveLength(100);
    await expect(store.verify()).resolves.toEqual({ valid: true, failures: [] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects invalid manifest input and safely rejects malformed manifest files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));

  try {
    const store = await createAuditStore(directory);
    await expect(
      store.writeManifest({
        runId: "not-a-uuid",
        artifacts: [],
      }),
    ).rejects.toThrow("validation_error");
    await expect(
      store.writeManifest({
        runId: "00000000-0000-4000-8000-000000000001",
        skillHash: "A".repeat(64),
        artifacts: [],
      }),
    ).rejects.toThrow("validation_error");
    await expect(
      store.writeManifest({
        runId: "00000000-0000-4000-8000-000000000001",
        artifacts: [null] as unknown as { path: string }[],
      }),
    ).rejects.toThrow("validation_error");

    for (const manifest of [
      null,
      {
        runId: "not-a-uuid",
        schemaHash: "0".repeat(64),
        skillHash: "0".repeat(64),
        configurationHash: "0".repeat(64),
        inputHash: "0".repeat(64),
        outputHash: "0".repeat(64),
        eventsHash: "0".repeat(64),
        artifacts: [],
      },
      {
        runId: "00000000-0000-4000-8000-000000000001",
        schemaHash: "A".repeat(64),
        skillHash: "0".repeat(64),
        configurationHash: "0".repeat(64),
        inputHash: "0".repeat(64),
        outputHash: "0".repeat(64),
        eventsHash: "0".repeat(64),
        artifacts: [],
      },
      {
        runId: "00000000-0000-4000-8000-000000000001",
        schemaHash: "0".repeat(64),
        skillHash: "0".repeat(64),
        configurationHash: "0".repeat(64),
        inputHash: "0".repeat(64),
        outputHash: "0".repeat(64),
        eventsHash: "0".repeat(64),
        artifacts: [null],
      },
    ]) {
      await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest), "utf8");
      await expect(store.verify()).resolves.toMatchObject({
        valid: false,
        failures: expect.any(Array),
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects artifact paths that resolve through a directory symlink", async ({ skip }) => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const outsideDirectory = await mkdtemp(join(tmpdir(), "ai-assist-audit-outside-"));

  try {
    await writeFile(join(outsideDirectory, "secret.txt"), "test-only-secret", "utf8");
    try {
      await symlink(outsideDirectory, join(directory, "linked-dir"), "dir");
    } catch (error: unknown) {
      if (isLinkPermissionError(error)) {
        skip("directory symlinks are unavailable in this environment");
        return;
      }
      throw error;
    }

    const store = await createAuditStore(directory);
    await expect(
      store.writeManifest({
        runId: "00000000-0000-4000-8000-000000000001",
        artifacts: [{ path: "linked-dir/secret.txt" }],
      }),
    ).rejects.toThrow("validation_error");
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(outsideDirectory, { recursive: true, force: true });
  }
});

it.skipIf(process.platform !== "win32")("rejects artifact paths that resolve through a junction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const outsideDirectory = await mkdtemp(join(tmpdir(), "ai-assist-audit-outside-"));

  try {
    await writeFile(join(outsideDirectory, "secret.txt"), "test-only-secret", "utf8");
    await symlink(outsideDirectory, join(directory, "linked-dir"), "junction");
    const store = await createAuditStore(directory);

    await expect(
      store.writeManifest({
        runId: "00000000-0000-4000-8000-000000000001",
        artifacts: [{ path: "linked-dir/secret.txt" }],
      }),
    ).rejects.toThrow("validation_error");

    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify({
        runId: "00000000-0000-4000-8000-000000000001",
        schemaHash: "0".repeat(64),
        skillHash: "0".repeat(64),
        configurationHash: "0".repeat(64),
        inputHash: "0".repeat(64),
        outputHash: "0".repeat(64),
        eventsHash: "0".repeat(64),
        artifacts: [{ path: "linked-dir/secret.txt", sha256: "0".repeat(64) }],
      }),
      "utf8",
    );
    await expect(store.verify()).resolves.toMatchObject({
      valid: false,
      failures: expect.arrayContaining([expect.stringContaining("unreadable")]),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(outsideDirectory, { recursive: true, force: true });
  }
});

function isLinkPermissionError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && (error.code === "EPERM" || error.code === "EACCES");
}