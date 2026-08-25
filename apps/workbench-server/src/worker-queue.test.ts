import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function deferred<T>(): { readonly promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
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

  it("fails orphaned running jobs and resumes surviving queued jobs after restart", async () => {
    const queuePath = join(rootDir, "worker-queue.json");
    await writeFile(queuePath, JSON.stringify([
      { jobId: "running", attemptId: "attempt-running", kind: "excel", stage: "f1_f2_running", payload: {}, status: "running", sequence: 1 },
      { jobId: "queued", attemptId: "attempt-queued", kind: "calculation", stage: "f4_running", payload: {}, status: "queued", sequence: 2 },
    ]));
    const store = new MemoryQueueSessionStore();
    store.attempts.set("attempt-running", { status: "running" });
    store.attempts.set("attempt-queued", { status: "queued" });
    const starts: string[] = [];
    const queue = await createPersistentWorkerQueue({
      rootDir,
      sessionStore: store,
      worker: async (job) => {
        starts.push(job.jobId);
        return { ok: true };
      },
    });

    await queue.reconcile();

    await vi.waitFor(() => expect(store.attempts.get("attempt-queued")?.status).toBe("completed"));
    expect(store.attempts.get("attempt-running")?.status).toBe("failed");
    expect(starts).toEqual(["queued"]);
  });

  it("fails surviving queued jobs on restart when no executor is configured", async () => {
    const queuePath = join(rootDir, "worker-queue.json");
    await writeFile(queuePath, JSON.stringify([
      { jobId: "queued", attemptId: "attempt-queued", kind: "host", stage: "ado_action_pending", payload: {}, status: "queued", sequence: 1 },
    ]));
    const store = new MemoryQueueSessionStore();
    store.attempts.set("attempt-queued", { status: "queued" });
    const queue = await createPersistentWorkerQueue({ rootDir, sessionStore: store });

    await queue.reconcile();

    expect(store.attempts.get("attempt-queued")).toMatchObject({ status: "failed" });
  });

  it("rejects duplicate job IDs before persisting a second attempt", async () => {
    const store = new MemoryQueueSessionStore();
    const queue = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => ({ ok: true }) });

    await queue.enqueue({ jobId: "job-duplicate", attemptId: "attempt-1", kind: "calculation", stage: "f4_running", payload: {} });
    await expect(queue.enqueue({ jobId: "job-duplicate", attemptId: "attempt-2", kind: "calculation", stage: "f4_running", payload: {} }))
      .rejects.toMatchObject({ code: "validation_error" });
    expect(store.attempts.has("attempt-2")).toBe(false);
  });

  it("rejects malformed jobs and converts an undefined worker result into a failed attempt", async () => {
    const store = new MemoryQueueSessionStore();
    const queue = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => undefined });

    await expect(queue.enqueue({ jobId: "", attemptId: "attempt-invalid", kind: "calculation", stage: "f4_running", payload: {} }))
      .rejects.toMatchObject({ code: "validation_error" });
    const receipt = await queue.enqueue({ jobId: "job-invalid-result", attemptId: "attempt-invalid-result", kind: "calculation", stage: "f4_running", payload: {} });

    expect(receipt.status).toBe("failed");
    expect(store.attempts.get("attempt-invalid-result")?.status).toBe("failed");
  });

  it("runs Excel jobs one at a time and calculation jobs at configured concurrency", async () => {
    const store = new MemoryQueueSessionStore();
    const gates = new Map([
      ["excel-1", deferred<unknown>()],
      ["excel-2", deferred<unknown>()],
      ["calc-1", deferred<unknown>()],
      ["calc-2", deferred<unknown>()],
    ]);
    const starts: string[] = [];
    const queue = await createPersistentWorkerQueue({
      rootDir,
      sessionStore: store,
      calculationConcurrency: 2,
      worker: async (job) => {
        starts.push(job.jobId);
        return gates.get(job.jobId)!.promise;
      },
    });

    const excel1 = queue.enqueue({ jobId: "excel-1", attemptId: "excel-attempt-1", kind: "excel", stage: "f1_f2_running", payload: {} });
    const excel2 = queue.enqueue({ jobId: "excel-2", attemptId: "excel-attempt-2", kind: "excel", stage: "f1_f2_running", payload: {} });
    const calc1 = queue.enqueue({ jobId: "calc-1", attemptId: "calc-attempt-1", kind: "calculation", stage: "f4_running", payload: {} });
    const calc2 = queue.enqueue({ jobId: "calc-2", attemptId: "calc-attempt-2", kind: "calculation", stage: "f5_running", payload: {} });

    await vi.waitFor(() => {
      expect(starts).toContain("excel-1");
      expect(starts).not.toContain("excel-2");
      expect(starts).toEqual(expect.arrayContaining(["calc-1", "calc-2"]));
      expect(starts).toHaveLength(3);
    });
    gates.get("excel-1")!.resolve({ ok: true });
    await vi.waitFor(() => expect(starts).toContain("excel-2"));
    gates.get("calc-1")!.resolve({ ok: true });
    gates.get("calc-2")!.resolve({ ok: true });
    gates.get("excel-2")!.resolve({ ok: true });
    await Promise.all([excel1, excel2, calc1, calc2]);
  });

  it("preserves both concurrent calculation completions across restart", async () => {
    const store = new MemoryQueueSessionStore();
    const gates = new Map([["calc-a", deferred<unknown>()], ["calc-b", deferred<unknown>()]]);
    const queue = await createPersistentWorkerQueue({
      rootDir,
      sessionStore: store,
      calculationConcurrency: 2,
      worker: async (job) => gates.get(job.jobId)!.promise,
    });

    const first = queue.enqueue({ jobId: "calc-a", attemptId: "attempt-a", kind: "calculation", stage: "f4_running", payload: {} });
    const second = queue.enqueue({ jobId: "calc-b", attemptId: "attempt-b", kind: "calculation", stage: "f5_running", payload: {} });
    await vi.waitFor(() => expect(store.attempts.get("attempt-b")?.status).toBe("running"));
    gates.get("calc-a")!.resolve({ id: "a" });
    gates.get("calc-b")!.resolve({ id: "b" });
    await Promise.all([first, second]);

    const persisted = JSON.parse(await readFile(join(rootDir, "worker-queue.json"), "utf8")) as Array<{ jobId: string; status: string }>;
    expect(persisted).toEqual(expect.arrayContaining([
      expect.objectContaining({ jobId: "calc-a", status: "completed" }),
      expect.objectContaining({ jobId: "calc-b", status: "completed" }),
    ]));
  });

  it("does not execute a queued job cancelled before capacity is available", async () => {
    const store = new MemoryQueueSessionStore();
    const firstGate = deferred<unknown>();
    const starts: string[] = [];
    const queue = await createPersistentWorkerQueue({
      rootDir,
      sessionStore: store,
      worker: async (job) => {
        starts.push(job.jobId);
        return job.jobId === "excel-running" ? firstGate.promise : { ok: true };
      },
    });

    const running = queue.enqueue({ jobId: "excel-running", attemptId: "attempt-running", kind: "excel", stage: "f1_f2_running", payload: {} });
    await vi.waitFor(() => expect(starts).toEqual(["excel-running"]));
    const cancelled = queue.enqueue({ jobId: "excel-cancelled", attemptId: "attempt-cancelled", kind: "excel", stage: "f1_f2_running", payload: {} });
    await vi.waitFor(async () => expect(await queue.cancel("excel-cancelled")).toBe(true));
    firstGate.resolve({ ok: true });

    await Promise.all([running, cancelled]);
    expect(starts).toEqual(["excel-running"]);
  });

  it("fails closed and preserves corrupt queue state", async () => {
    const queuePath = join(rootDir, "worker-queue.json");
    await writeFile(queuePath, "{not-json");
    const store = new MemoryQueueSessionStore();

    await expect(createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => ({}) }))
      .rejects.toMatchObject({ code: "dependency_error" });
    await expect(readFile(queuePath, "utf8")).resolves.toBe("{not-json");
  });

  it.each([
    ["unknown field", { jobId: "job", attemptId: "attempt", kind: "excel", stage: "f1_f2_running", payload: {}, status: "queued", sequence: 1, extra: true }],
    ["invalid kind", { jobId: "job", attemptId: "attempt", kind: "shell", stage: "f1_f2_running", payload: {}, status: "queued", sequence: 1 }],
    ["non-object payload", { jobId: "job", attemptId: "attempt", kind: "excel", stage: "f1_f2_running", payload: [], status: "queued", sequence: 1 }],
    ["invalid sequence", { jobId: "job", attemptId: "attempt", kind: "excel", stage: "f1_f2_running", payload: {}, status: "queued", sequence: 0 }],
    ["queued result", { jobId: "job", attemptId: "attempt", kind: "excel", stage: "f1_f2_running", payload: {}, status: "queued", sequence: 1, result: {} }],
    ["failed without error", { jobId: "job", attemptId: "attempt", kind: "excel", stage: "f1_f2_running", payload: {}, status: "failed", sequence: 1 }],
  ])("rejects valid JSON queue records with %s without overwriting the file", async (_caseName, record) => {
    const queuePath = join(rootDir, "worker-queue.json");
    const original = JSON.stringify([record]);
    await writeFile(queuePath, original);

    await expect(createPersistentWorkerQueue({ rootDir, sessionStore: new MemoryQueueSessionStore(), worker: async () => ({}) }))
      .rejects.toMatchObject({ code: "dependency_error" });
    await expect(readFile(queuePath, "utf8")).resolves.toBe(original);
  });

  it("rejects duplicate persisted queue sequences without overwriting the file", async () => {
    const queuePath = join(rootDir, "worker-queue.json");
    const original = JSON.stringify([
      { jobId: "job-1", attemptId: "attempt-1", kind: "excel", stage: "f1_f2_running", payload: {}, status: "queued", sequence: 1 },
      { jobId: "job-2", attemptId: "attempt-2", kind: "calculation", stage: "f4_running", payload: {}, status: "queued", sequence: 1 },
    ]);
    await writeFile(queuePath, original);

    await expect(createPersistentWorkerQueue({ rootDir, sessionStore: new MemoryQueueSessionStore(), worker: async () => ({}) }))
      .rejects.toMatchObject({ code: "dependency_error" });
    await expect(readFile(queuePath, "utf8")).resolves.toBe(original);
  });
});