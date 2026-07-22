import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    expect(manifest.skillHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(manifest.configurationHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(manifest.inputHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(manifest.outputHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));

    await expect(store.verify()).resolves.toEqual({ valid: true, failures: [] });
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

it("detects altered artifacts and rejects manifest path traversal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-assist-audit-"));
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

    const missingArtifactPath = join(directory, "missing.txt");
    await writeFile(missingArtifactPath, "present", "utf8");
    await store.writeManifest({
      runId: "00000000-0000-4000-8000-000000000001",
      artifacts: [{ path: "missing.txt" }],
    });
    await rm(missingArtifactPath);
    await expect(store.verify()).resolves.toMatchObject({
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
  }
});