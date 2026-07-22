import { mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
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

it("initializes an audit events file and rejects malformed read queries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));

  try {
    const store = await createAuditStore(directory);
    await expect(readFile(join(directory, "events.jsonl"), "utf8")).resolves.toBe("");
    await writeFile(join(directory, "events.jsonl"), "not-json\n", "utf8");
    await expect(store.hasEventType("purge_completed")).rejects.toThrow("validation_error");
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

it("atomically seals a manifest when independent stores share an audit root", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));

  try {
    const firstStore = await createAuditStore(directory);
    const secondStore = await createAuditStore(directory);
    const seals = await Promise.allSettled([
      firstStore.writeManifest({
        runId: "00000000-0000-4000-8000-000000000005",
        artifacts: [],
      }),
      secondStore.writeManifest({
        runId: "00000000-0000-4000-8000-000000000006",
        artifacts: [],
      }),
    ]);

    expect(seals.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(seals.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(Promise.all(seals.filter((result) => result.status === "rejected").map(async (result) => {
      if (result.status === "rejected") {
        throw result.reason;
      }
    }))).rejects.toThrow("validation_error");

    const sealedManifest = await readFile(join(directory, "manifest.json"));
    const manifest = JSON.parse(sealedManifest.toString()) as Record<string, unknown>;
    expect(manifest.runId).toBeOneOf([
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000006",
    ]);
    await expect(readFile(join(directory, "manifest.json"))).resolves.toEqual(sealedManifest);
    await expect(readdir(directory)).resolves.not.toContainEqual(expect.stringMatching(/^manifest\..*\.tmp$/));
    await expect(firstStore.verify()).resolves.toEqual({ valid: true, failures: [] });
    await expect(secondStore.verify()).resolves.toEqual({ valid: true, failures: [] });
  } finally {
    await rm(directory, { recursive: true, force: true });
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

it("rejects secret classifications before creating audit events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const secret = "must-not-enter-audit";

  try {
    const store = await createAuditStore(directory);

    await expect(store.append({
      type: "policy_evaluated",
      classification: "secret" as "public",
      payload: { secret },
    })).rejects.toThrow("policy_denied");
    await expect(readFile(join(directory, "events.jsonl"), "utf8")).resolves.toBe("");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("holds an unsealed transaction against concurrent sealing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  let releaseTransaction!: () => void;
  const transactionBlocked = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });
  let transactionStarted!: () => void;
  const transactionReady = new Promise<void>((resolve) => {
    transactionStarted = resolve;
  });

  try {
    const transactionStore = await createAuditStore(directory);
    const sealingStore = await createAuditStore(directory);
    const transaction = transactionStore.runUnsealedTransaction(async (audit) => {
      await audit.append({
        type: "purge_completed",
        classification: "internal",
        payload: { run: "transaction" },
      });
      transactionStarted();
      await transactionBlocked;
    });

    await transactionReady;
    let sealingSettled = false;
    const sealing = sealingStore.writeManifest({
      runId: "00000000-0000-4000-8000-000000000007",
      artifacts: [],
    }).finally(() => {
      sealingSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(sealingSettled).toBe(false);

    releaseTransaction();
    await transaction;
    await sealing;
    await expect(transactionStore.hasEventType("purge_completed")).resolves.toBe(true);
    await expect(transactionStore.verify()).resolves.toEqual({ valid: true, failures: [] });
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

it("coordinates concurrent appends and sealing across independent stores sharing an audit root", async () => {
  const attempts = 8;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));

    try {
      const sealingStore = await createAuditStore(directory);
      const appendingStore = await createAuditStore(directory);
      const preSealAppends = Array.from({ length: 10 }, (_, index) => appendingStore.append({
        type: "skill_started",
        classification: "internal",
        payload: { attempt, index },
      }));
      const sealing = sealingStore.writeManifest({
        runId: `00000000-0000-4000-8000-${String(attempt + 100).padStart(12, "0")}`,
        artifacts: [],
      });
      const concurrentAppends = Array.from({ length: 40 }, (_, index) => appendingStore.append({
        type: "skill_completed",
        classification: "internal",
        payload: { attempt, index },
      }));

      const [preSealResults, sealingResult, concurrentAppendResults] = await Promise.all([
        Promise.allSettled(preSealAppends),
        sealing.then(
          () => "fulfilled" as const,
          (error: unknown) => error,
        ),
        Promise.allSettled(concurrentAppends),
      ]);

      expect(sealingResult).toBe("fulfilled");
      expect([...preSealResults, ...concurrentAppendResults].every((result) => result.status === "fulfilled" ||
        (result.status === "rejected" && String(result.reason).includes("validation_error")))).toBe(true);
      await expect(sealingStore.verify()).resolves.toEqual({ valid: true, failures: [] });
      await expect(appendingStore.verify()).resolves.toEqual({ valid: true, failures: [] });
      await expect(readdir(directory)).resolves.not.toContainEqual(expect.stringMatching(/^audit\.lock$|^manifest\..*\.tmp$/));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

it("fails closed when an existing audit lock blocks append and manifest writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
  const lockPath = join(directory, "audit.lock");
  const staleLock = JSON.stringify({
    lockId: "abandoned",
    processId: 2_147_483_647,
    createdAt: "2026-07-22T00:00:00.000Z",
  });

  try {
    await writeFile(lockPath, staleLock, "utf8");
    const store = await createAuditStore(directory);

    await expect(store.append({
      type: "run_created",
      classification: "public",
      payload: { blocked: true },
    })).rejects.toThrow("dependency_error: audit root is locked; controlled maintenance must verify and remove stale lock");
    await expect(store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000099",
      artifacts: [],
    })).rejects.toThrow("dependency_error: audit root is locked; controlled maintenance must verify and remove stale lock");
    await expect(readFile(lockPath, "utf8")).resolves.toBe(staleLock);

    await unlink(lockPath);
    await expect(store.append({
      type: "run_created",
      classification: "public",
      payload: { unblocked: true },
    })).resolves.toBeUndefined();
    await expect(store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000099",
      artifacts: [],
    })).resolves.toBeUndefined();
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