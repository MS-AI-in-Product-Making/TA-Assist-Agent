import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPersistentWorkerQueue, type QueueSessionStore } from "./sqlite-worker-queue.js";

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

function insertQueueJob(rootDir: string, job: {
  readonly jobId: string;
  readonly attemptId: string;
  readonly kind: "excel" | "calculation" | "host";
  readonly stage: string;
  readonly status: "queued" | "running";
}): void {
  const database = new DatabaseSync(join(rootDir, "worker-queue.sqlite"));
  try {
    const now = new Date().toISOString();
    database.prepare(`
      INSERT INTO worker_jobs(job_id, attempt_id, kind, stage, payload_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, '{}', ?, ?, ?)
    `).run(job.jobId, job.attemptId, job.kind, job.stage, job.status, now, now);
  } finally {
    database.close();
  }
}

function readQueueJobs(rootDir: string): Array<{ readonly jobId: string; readonly status: string; readonly sequence: number }> {
  const database = new DatabaseSync(join(rootDir, "worker-queue.sqlite"));
  try {
    return (database.prepare("SELECT job_id, status, sequence FROM worker_jobs ORDER BY sequence").all() as Array<{
      job_id: string;
      status: string;
      sequence: number;
    }>).map((row) => ({ jobId: row.job_id, status: row.status, sequence: row.sequence }));
  } finally {
    database.close();
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

  it("fails orphaned running jobs and resumes surviving queued jobs after restart", async () => {
    const store = new MemoryQueueSessionStore();
    await createPersistentWorkerQueue({ rootDir, sessionStore: store });
    insertQueueJob(rootDir, { jobId: "running", attemptId: "attempt-running", kind: "excel", stage: "f1_f2_running", status: "running" });
    insertQueueJob(rootDir, { jobId: "queued", attemptId: "attempt-queued", kind: "calculation", stage: "f4_running", status: "queued" });
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
    const store = new MemoryQueueSessionStore();
    const queue = await createPersistentWorkerQueue({ rootDir, sessionStore: store });
    insertQueueJob(rootDir, { jobId: "queued", attemptId: "attempt-queued", kind: "host", stage: "ado_action_pending", status: "queued" });
    store.attempts.set("attempt-queued", { status: "queued" });

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

  it.each([
    ["Date", new Date()],
    ["custom toJSON", { toJSON: () => undefined }],
    ["NaN", Number.NaN],
    ["undefined", { value: undefined }],
    ["bigint", { value: 1n }],
    ["function", { value: () => undefined }],
    ["symbol", { value: Symbol("unsafe") }],
    ["Map", { value: new Map() }],
    ["custom prototype", Object.create({ inherited: true })],
    ["unsafe key", { constructor: "unsafe" }],
    ["sparse array", { value: Object.assign(Array<unknown>(2), { 1: "unsafe" }) }],
    ["cyclic object", (() => { const value: { self?: unknown } = {}; value.self = value; return value; })()],
  ])("rejects %s payloads before persisting any queue state", async (_caseName, payload) => {
    const store = new MemoryQueueSessionStore();
    const queue = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => ({ ok: true }) });

    await expect(queue.enqueue({ jobId: "unsafe-job", attemptId: "unsafe-attempt", kind: "calculation", stage: "f4_running", payload }))
      .rejects.toMatchObject({ code: "validation_error" });
    expect(store.attempts.has("unsafe-attempt")).toBe(false);
  });

  it.each([
    ["Date", new Date()],
    ["custom toJSON", { toJSON: () => undefined }],
    ["NaN", Number.NaN],
    ["undefined", { value: undefined }],
    ["bigint", { value: 1n }],
    ["function", { value: () => undefined }],
    ["symbol", { value: Symbol("unsafe") }],
    ["Map", { value: new Map() }],
    ["custom prototype", Object.create({ inherited: true })],
    ["unsafe key", { constructor: "unsafe" }],
    ["sparse array", { value: Object.assign(Array<unknown>(2), { 1: "unsafe" }) }],
    ["cyclic object", (() => { const value: { self?: unknown } = {}; value.self = value; return value; })()],
  ])("converts invalid %s worker output into a safe failed attempt", async (_caseName, result) => {
    const store = new MemoryQueueSessionStore();
    const queue = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => result });

    const receipt = await queue.enqueue({ jobId: `invalid-result-${_caseName}`, attemptId: `invalid-attempt-${_caseName}`, kind: "calculation", stage: "f4_running", payload: {} });

    expect(receipt.status).toBe("failed");
    expect(store.attempts.get(`invalid-attempt-${_caseName}`)?.status).toBe("failed");
  });

  it("roundtrips null-prototype payloads into canonical plain JSON", async () => {
    const store = new MemoryQueueSessionStore();
    let receivedPayload: unknown;
    const queue = await createPersistentWorkerQueue({
      rootDir,
      sessionStore: store,
      worker: async (job) => {
        receivedPayload = job.payload;
        return { ok: true };
      },
    });
    const payload = Object.assign(Object.create(null) as Record<string, unknown>, { nested: [null, true, 1, "text"] });

    await queue.enqueue({ jobId: "null-prototype", attemptId: "null-prototype-attempt", kind: "calculation", stage: "f4_running", payload });

    expect(receivedPayload).toEqual({ nested: [null, true, 1, "text"] });
    expect(Object.getPrototypeOf(receivedPayload)).toBe(Object.prototype);
  });

  it("preserves concurrent enqueues from separate queue instances across restart", async () => {
    const firstStore = new MemoryQueueSessionStore();
    const secondStore = new MemoryQueueSessionStore();
    const first = await createPersistentWorkerQueue({ rootDir, sessionStore: firstStore });
    const second = await createPersistentWorkerQueue({ rootDir, sessionStore: secondStore });

    await Promise.all([
      first.enqueue({ jobId: "cross-process-a", attemptId: "cross-attempt-a", kind: "calculation", stage: "f4_running", payload: {} }, { deferDrain: true }),
      second.enqueue({ jobId: "cross-process-b", attemptId: "cross-attempt-b", kind: "calculation", stage: "f5_running", payload: {} }, { deferDrain: true }),
    ]);

    const restartedStore = new MemoryQueueSessionStore();
    restartedStore.attempts.set("cross-attempt-a", { status: "running" });
    restartedStore.attempts.set("cross-attempt-b", { status: "running" });
    const restarted = await createPersistentWorkerQueue({ rootDir, sessionStore: restartedStore, worker: async () => ({ ok: true }) });
    await restarted.reconcile();

    expect(restartedStore.attempts.get("cross-attempt-a")?.status).toBe("failed");
    expect(restartedStore.attempts.get("cross-attempt-b")?.status).toBe("failed");
  });

  it("claims and executes a shared queued job exactly once across queue instances", async () => {
    const store = new MemoryQueueSessionStore();
    const seeder = await createPersistentWorkerQueue({ rootDir, sessionStore: store });
    await seeder.enqueue({ jobId: "shared-job", attemptId: "shared-attempt", kind: "calculation", stage: "f4_running", payload: {} }, { deferDrain: true });
    const database = new DatabaseSync(join(rootDir, "worker-queue.sqlite"));
    database.prepare("UPDATE worker_jobs SET status = 'queued' WHERE job_id = 'shared-job'").run();
    database.close();
    store.attempts.set("shared-attempt", { status: "queued" });
    let executions = 0;
    const worker = async () => {
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { ok: true };
    };
    const first = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker });
    const second = await createPersistentWorkerQueue({ rootDir, sessionStore: store, worker });

    await Promise.all([first.reconcile(), second.reconcile()]);

    expect(executions).toBe(1);
    expect(store.attempts.get("shared-attempt")?.status).toBe("completed");
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

    const persisted = readQueueJobs(rootDir);
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

  it("fails closed and preserves a corrupt SQLite queue", async () => {
    const queuePath = join(rootDir, "worker-queue.sqlite");
    await writeFile(queuePath, "not-a-sqlite-database");
    const store = new MemoryQueueSessionStore();

    await expect(createPersistentWorkerQueue({ rootDir, sessionStore: store, worker: async () => ({}) })).rejects.toThrow();
  });

  it("keeps globally unique IDs and monotonic sequences across queue instances and restart", async () => {
    const first = await createPersistentWorkerQueue({ rootDir, sessionStore: new MemoryQueueSessionStore() });
    const second = await createPersistentWorkerQueue({ rootDir, sessionStore: new MemoryQueueSessionStore() });
    await first.enqueue({ jobId: "sequence-a", attemptId: "sequence-attempt-a", kind: "host", stage: "ado_action_pending", payload: {} }, { deferDrain: true });
    await second.enqueue({ jobId: "sequence-b", attemptId: "sequence-attempt-b", kind: "host", stage: "ado_action_pending", payload: {} }, { deferDrain: true });
    const restarted = await createPersistentWorkerQueue({ rootDir, sessionStore: new MemoryQueueSessionStore() });
    await restarted.enqueue({ jobId: "sequence-c", attemptId: "sequence-attempt-c", kind: "host", stage: "ado_action_pending", payload: {} }, { deferDrain: true });

    expect(readQueueJobs(rootDir).map((job) => job.sequence)).toEqual([1, 2, 3]);
    await expect(restarted.enqueue({ jobId: "sequence-a", attemptId: "duplicate", kind: "host", stage: "ado_action_pending", payload: {} }, { deferDrain: true }))
      .rejects.toMatchObject({ code: "validation_error" });
  });
});