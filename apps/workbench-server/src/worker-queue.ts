import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  markAttemptResult(attemptId: string, result: unknown, expectedStatus: "running"): Promise<boolean>;
  markDependencyFailure(attemptId: string, reason: string): Promise<void>;
}

export interface PersistentWorkerQueueOptions {
  readonly rootDir: string;
  readonly sessionStore: QueueSessionStore;
  readonly worker: (job: StageJob) => Promise<unknown>;
  readonly calculationConcurrency?: number;
}

export interface EnqueueOptions {
  readonly deferDrain?: boolean;
}

interface PersistedJob extends StageJob {
  status: QueueReceipt["status"];
  readonly sequence: number;
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

  constructor(private readonly options: PersistentWorkerQueueOptions) {}

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.queuePath, "utf8");
      const jobs = JSON.parse(raw) as PersistedJob[];
      for (const job of jobs) {
        this.jobs.set(job.jobId, job);
        this.sequence = Math.max(this.sequence, job.sequence);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async enqueue(job: StageJob, options?: EnqueueOptions): Promise<QueueReceipt> {
    if (job.jobId && this.jobs.has(job.jobId)) {
      throw createTypedError({
        code: "validation_error",
        summary: "Duplicate worker job rejected.",
        suggestedAction: "Submit each worker job with a unique jobId.",
        affectedInputReferences: [job.jobId],
      });
    }

    const persisted: PersistedJob = { ...job, jobId: job.jobId || randomUUID(), status: "queued", sequence: ++this.sequence };
    this.jobs.set(persisted.jobId, persisted);
    await this.options.sessionStore.persistAttempt({ attemptId: persisted.attemptId, status: "queued", jobId: persisted.jobId, stage: persisted.stage });
    await this.persist();
    let drain: Promise<void> | undefined;
    if (options?.deferDrain !== true) {
      drain = this.drain();
      await new Promise((resolve) => setImmediate(resolve));
    } else {
      persisted.status = "running";
      await this.options.sessionStore.persistAttempt({ attemptId: persisted.attemptId, status: "running", jobId: persisted.jobId, stage: persisted.stage });
      await this.persist();
    }

    const terminal = this.terminalPromises.get(persisted.jobId);
    if (terminal !== undefined && options?.deferDrain !== true) {
      await terminal;
    } else if (drain !== undefined) {
      await drain;
    }

    return { jobId: persisted.jobId, attemptId: persisted.attemptId, status: this.jobs.get(persisted.jobId)?.status ?? "queued" };
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (job === undefined || job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return false;
    }

    job.status = "cancelled";
    await this.persist();
    return true;
  }

  async reconcile(): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.status === "running") {
        job.status = "failed";
        await this.options.sessionStore.markDependencyFailure(job.attemptId, "Worker stopped before terminal callback; retry is required.");
      }
    }

    await this.persist();
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
          scheduled = true;
          this.terminalPromises.set(job.jobId, this.runJob(job));
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
    this.incrementActive(job);
    job.status = "running";
    await this.options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
    await this.persist();
    try {
      const result = await this.options.worker(job);
      const accepted = await this.options.sessionStore.markAttemptResult(job.attemptId, result, "running");
      job.status = accepted ? "completed" : "failed";
    } catch (error) {
      job.status = "failed";
      await this.options.sessionStore.markDependencyFailure(job.attemptId, "Worker failed.");
    } finally {
      this.decrementActive(job);
      await this.persist();
      void this.drain();
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
    await writeFile(this.queuePath, JSON.stringify([...this.jobs.values()], null, 2));
  }

  private get queuePath(): string {
    return join(this.options.rootDir, QUEUE_FILE);
  }
}