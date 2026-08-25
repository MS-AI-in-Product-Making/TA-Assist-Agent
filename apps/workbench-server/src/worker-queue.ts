import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { createTypedError } from "@ai-assist/contracts";

export type StageJobKind = "excel" | "calculation" | "host";

export interface StageJob {
  readonly jobId: string;
  readonly attemptId: string;
  readonly kind: StageJobKind;
  readonly stage: string;
  readonly payload: unknown;
}

export interface QueueReceipt {
  readonly jobId: string;
  readonly attemptId: string;
  readonly status: "queued" | "running" | "completed" | "failed" | "cancelled";
}

export interface QueueSessionStore {
  persistAttempt(attempt: { readonly attemptId: string; readonly status: "queued" | "running"; readonly jobId: string; readonly stage?: string }): Promise<void>;
  markAttemptResult(attemptId: string, result: unknown, expectedStatus: "running", job?: StageJob): Promise<boolean>;
  markDependencyFailure(attemptId: string, reason: string, job?: StageJob): Promise<void>;
}

export interface PersistentWorkerQueueOptions {
  readonly rootDir: string;
  readonly sessionStore: QueueSessionStore;
  readonly worker?: (job: StageJob) => Promise<unknown>;
  readonly calculationConcurrency?: number;
}

export interface EnqueueOptions {
  readonly deferDrain?: boolean;
}

interface PersistedJob extends StageJob {
  status: QueueReceipt["status"];
  readonly sequence: number;
  result?: unknown;
  error?: { readonly code: "dependency_error"; readonly message: string };
}

export interface PersistentWorkerQueue {
  enqueue(job: StageJob, options?: EnqueueOptions): Promise<QueueReceipt>;
  cancel(jobId: string): Promise<boolean>;
  reconcile(): Promise<void>;
}

const QUEUE_FILE = "worker-queue.json";

export async function createPersistentWorkerQueue(options: PersistentWorkerQueueOptions): Promise<PersistentWorkerQueue> {
  await mkdir(options.rootDir, { recursive: true });
  const queue = new FileBackedWorkerQueue(options);
  await queue.load();
  return queue;
}

class FileBackedWorkerQueue implements PersistentWorkerQueue {
  private readonly jobs = new Map<string, PersistedJob>();

  private readonly terminalPromises = new Map<string, Promise<void>>();

  private draining = false;

  private activeExcelJobs = 0;

  private activeCalculationJobs = 0;

  private sequence = 0;

  private operations: Promise<void> = Promise.resolve();

  constructor(private readonly options: PersistentWorkerQueueOptions) {}

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.queuePath, "utf8");
      const jobs = parsePersistedJobs(JSON.parse(raw));
      const sequences = new Set<number>();
      for (const job of jobs) {
        if (this.jobs.has(job.jobId) || sequences.has(job.sequence)) {
          throw createTypedError({
            code: "dependency_error",
            summary: "Worker queue state is invalid.",
            suggestedAction: "Preserve the queue file and repair it before restarting the workbench.",
            affectedInputReferences: [this.queuePath],
          });
        }
        this.jobs.set(job.jobId, job);
        sequences.add(job.sequence);
        this.sequence = Math.max(this.sequence, job.sequence);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }

      if ((error as { code?: unknown }).code === "dependency_error") throw error;
      throw createTypedError({
        code: "dependency_error",
        summary: "Worker queue state could not be read.",
        suggestedAction: "Preserve the queue file and repair it before restarting the workbench.",
        affectedInputReferences: [this.queuePath],
      });
    }
  }

  async enqueue(job: StageJob, options?: EnqueueOptions): Promise<QueueReceipt> {
    assertStageJob(job);
    const persisted = await this.serialize(async () => {
      if (job.jobId && this.jobs.has(job.jobId)) {
        throw createTypedError({
          code: "validation_error",
          summary: "Duplicate worker job rejected.",
          suggestedAction: "Submit each worker job with a unique jobId.",
          affectedInputReferences: [job.jobId],
        });
      }

      const next: PersistedJob = { ...job, jobId: job.jobId || randomUUID(), status: "queued", sequence: ++this.sequence };
      this.jobs.set(next.jobId, next);
      await this.options.sessionStore.persistAttempt({ attemptId: next.attemptId, status: "queued", jobId: next.jobId, stage: next.stage });
      if (options?.deferDrain === true) {
        next.status = "running";
        await this.options.sessionStore.persistAttempt({ attemptId: next.attemptId, status: "running", jobId: next.jobId, stage: next.stage });
      }
      await this.persist();
      return next;
    });
    let drain: Promise<void> | undefined;
    if (options?.deferDrain !== true) {
      drain = this.drain();
      await new Promise((resolve) => setImmediate(resolve));
    }

    if (options?.deferDrain !== true) await this.waitForTerminal(persisted.jobId, drain);

    return { jobId: persisted.jobId, attemptId: persisted.attemptId, status: this.jobs.get(persisted.jobId)?.status ?? "queued" };
  }

  async cancel(jobId: string): Promise<boolean> {
    return this.serialize(async () => {
      const job = this.jobs.get(jobId);
      if (job === undefined || job.status === "completed" || job.status === "failed" || job.status === "cancelled") return false;
      job.status = "cancelled";
      await this.persist();
      return true;
    });
  }

  async reconcile(): Promise<void> {
    const queuedJobIds: string[] = [];
    await this.serialize(async () => {
      for (const job of this.jobs.values()) {
        if (job.status === "running") {
          job.status = "failed";
          const reason = "Worker stopped before terminal callback; retry is required.";
          job.error = { code: "dependency_error", message: reason };
          await this.options.sessionStore.markDependencyFailure(job.attemptId, reason, job);
        } else if (job.status === "queued") {
          if (this.options.worker === undefined) {
            const reason = "No worker executor is configured; retry is required.";
            job.status = "failed";
            job.error = { code: "dependency_error", message: reason };
            await this.options.sessionStore.markDependencyFailure(job.attemptId, reason, job);
          } else {
            queuedJobIds.push(job.jobId);
          }
        }
      }
      await this.persist();
    });
    if (queuedJobIds.length > 0) {
      const drain = this.drain();
      await drain;
      await Promise.all(queuedJobIds.map((jobId) => this.waitForTerminal(jobId, drain)));
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      return;
    }

    this.draining = true;
    try {
      let scheduled = true;
      while (scheduled) {
        scheduled = false;
        for (const job of [...this.jobs.values()].filter((candidate) => candidate.status === "queued").sort((left, right) => left.sequence - right.sequence)) {
          if (!this.canStart(job)) continue;
          if (await this.startJob(job)) {
            scheduled = true;
            this.terminalPromises.set(job.jobId, this.runJob(job));
          }
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private canStart(job: PersistedJob): boolean {
    if (job.kind === "excel") return this.activeExcelJobs < 1;
    if (job.kind === "calculation") return this.activeCalculationJobs < (this.options.calculationConcurrency ?? 2);
    return true;
  }

  private async runJob(job: PersistedJob): Promise<void> {
    try {
      if (this.options.worker === undefined) throw new Error("worker executor unavailable");
      const result = await this.options.worker(job);
      assertJsonSafe(result, "Worker result");
      await this.serialize(async () => {
        const accepted = await this.options.sessionStore.markAttemptResult(job.attemptId, result, "running", job);
        job.status = accepted ? "completed" : "failed";
        if (accepted) {
          job.result = result;
        } else {
          job.error = { code: "dependency_error", message: "Attempt result was rejected by the session store." };
        }
        await this.persist();
      });
    } catch {
      await this.serialize(async () => {
        job.status = "failed";
        const reason = this.options.worker === undefined ? "No worker executor is configured; retry is required." : "Worker failed.";
        job.error = { code: "dependency_error", message: reason };
        await this.options.sessionStore.markDependencyFailure(job.attemptId, reason, job);
        await this.persist();
      });
    } finally {
      await this.serialize(async () => {
        this.decrementActive(job);
        await this.persist();
      });
      void this.drain();
    }
  }

  private async startJob(job: PersistedJob): Promise<boolean> {
    return this.serialize(async () => {
      if (job.status !== "queued") return false;
      this.incrementActive(job);
      job.status = "running";
      await this.options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
      await this.persist();
      return true;
    });
  }

  private async waitForTerminal(jobId: string, drain: Promise<void> | undefined): Promise<void> {
    while (true) {
      const terminal = this.terminalPromises.get(jobId);
      if (terminal !== undefined) {
        await terminal;
        return;
      }

      const status = this.jobs.get(jobId)?.status;
      if (status === "completed" || status === "failed" || status === "cancelled") return;
      if (drain !== undefined) await drain;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  private incrementActive(job: PersistedJob): void {
    if (job.kind === "excel") this.activeExcelJobs += 1;
    if (job.kind === "calculation") this.activeCalculationJobs += 1;
  }

  private decrementActive(job: PersistedJob): void {
    if (job.kind === "excel") this.activeExcelJobs -= 1;
    if (job.kind === "calculation") this.activeCalculationJobs -= 1;
  }

  private async persist(): Promise<void> {
    const temporaryPath = `${this.queuePath}.${randomUUID()}.tmp`;
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify([...this.jobs.values()], null, 2));
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporaryPath, this.queuePath);
      const directory = await open(this.options.rootDir, "r");
      try {
        await directory.sync();
      } catch {
        // Windows does not support syncing a directory handle.
      } finally {
        await directory.close();
      }
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(operation, operation);
    this.operations = next.then(() => undefined, () => undefined);
    return next;
  }

  private get queuePath(): string {
    return join(this.options.rootDir, QUEUE_FILE);
  }
}

function parsePersistedJobs(value: unknown): PersistedJob[] {
  if (!Array.isArray(value)) throw invalidQueueState();
  return value.map((candidate) => {
    if (!isRecord(candidate)) throw invalidQueueState();
    const allowed = new Set(["jobId", "attemptId", "kind", "stage", "payload", "status", "sequence", "result", "error"]);
    if (Object.keys(candidate).some((key) => !allowed.has(key))) throw invalidQueueState();
    const { jobId, attemptId, kind, stage, payload, status, sequence, result, error } = candidate;
    if (!isSafeId(jobId)
      || !isSafeId(attemptId)
      || (kind !== "excel" && kind !== "calculation" && kind !== "host")
      || !isSafeId(stage)
      || !isJsonObject(payload)
      || (status !== "queued" && status !== "running" && status !== "completed" && status !== "failed" && status !== "cancelled")
      || !Number.isSafeInteger(sequence) || (sequence as number) < 1) {
      throw invalidQueueState();
    }
    if ((status === "queued" || status === "running" || status === "cancelled") && ("result" in candidate || "error" in candidate)) throw invalidQueueState();
    if (status === "completed" && (!("result" in candidate) || "error" in candidate)) throw invalidQueueState();
    if (status === "failed" && (!("error" in candidate) || "result" in candidate || !isDependencyError(error))) throw invalidQueueState();
    const job: PersistedJob = { jobId, attemptId, kind, stage, payload, status, sequence: sequence as number };
    if (status === "completed") {
      if (!isJsonSafe(result)) throw invalidQueueState();
      job.result = result;
    }
    if (status === "failed" && isDependencyError(error)) job.error = error;
    return job;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDependencyError(value: unknown): value is { readonly code: "dependency_error"; readonly message: string } {
  return isRecord(value) && Object.keys(value).length === 2 && value.code === "dependency_error" && typeof value.message === "string" && value.message.length > 0;
}

function invalidQueueState(): Error {
  return createTypedError({
    code: "dependency_error",
    summary: "Worker queue state is invalid.",
    suggestedAction: "Preserve the queue file and repair it before restarting the workbench.",
    affectedInputReferences: [QUEUE_FILE],
  });
}

function assertStageJob(job: StageJob): void {
  if (!isSafeId(job.jobId) || !isSafeId(job.attemptId) || !isSafeId(job.stage)
    || (job.kind !== "excel" && job.kind !== "calculation" && job.kind !== "host") || !isJsonObject(job.payload)) {
    throw createTypedError({ code: "validation_error", summary: "Worker job is invalid.", suggestedAction: "Provide safe nonempty identifiers and JSON-safe payload data.", affectedInputReferences: [] });
  }
}

function assertJsonSafe(value: unknown, label: string): void {
  if (!isJsonSafe(value)) {
    throw createTypedError({ code: "validation_error", summary: `${label} is not JSON-safe.`, suggestedAction: "Return defined JSON-compatible data only.", affectedInputReferences: [] });
  }
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256
    && [...value].every((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    });
}

function isJsonSafe(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonSafe);
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => item !== undefined && isJsonSafe(item));
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && isJsonSafe(value);
}