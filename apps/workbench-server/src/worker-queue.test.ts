import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPersistentWorkerQueue, type QueueSessionStore } from "./worker-queue.js";

class MemoryQueueSessionStore implements QueueSessionStore {
  readonly attempts = new Map<string, { status: string; result?: unknown }>();

  async persistAttempt(attempt: { readonly attemptId: string; readonly status: "queued" | "running"; readonly jobId: string }): Promise<void> {
    this.attempts.set(attempt.attemptId, { status: attempt.status, result: attempt.jobId });
  }

  async markAttemptResult(attemptId: string, result: unknown, expectedStatus: "running"): Promise<boolean> {
    const attempt = this.attempts.get(attemptId);
    if (attempt?.status !== expectedStatus) {
      return false;
    }

    this.attempts.set(attemptId, { status: "completed", result });
    return true;
  }

  async markDependencyFailure(attemptId: string, reason: string): Promise<void> {
    this.attempts.set(attemptId, { status: "failed", result: reason });
  }
}

describe("persistent workbench worker queue", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "workbench-queue-"));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("persists attempts before execution and commits only matching running attempts", async () => {
    const store = new MemoryQueueSessionStore();
    const queue = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => ({ ok: true }) });

    const receipt = await queue.enqueue({ jobId: "job-1", attemptId: "attempt-1", kind: "calculation", stage: "f4_running", payload: {} });

    expect(receipt.attemptId).toBe("attempt-1");
    expect(store.attempts.get("attempt-1")?.status).toBe("completed");
  });

  it("reconciles orphaned running jobs as retryable dependency failures", async () => {
    const store = new MemoryQueueSessionStore();
    const first = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => new Promise(() => undefined) });
    await first.enqueue({ jobId: "job-2", attemptId: "attempt-2", kind: "excel", stage: "f1_f2_running", payload: {} }, { deferDrain: true });

    const second = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => ({ ok: true }) });
    await second.reconcile();

    expect(store.attempts.get("attempt-2")).toMatchObject({ status: "failed" });
  });
});