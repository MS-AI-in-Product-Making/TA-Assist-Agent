import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
  readonly status: QueueReceipt["status"] | "pending";
  readonly sequence: number;
  readonly ownerId: string | null;
  readonly ownerPid: number | null;
}

interface QueueRow {
  readonly job_id: string;
  readonly attempt_id: string;
  readonly kind: StageJobKind;
  readonly stage: string;
  readonly payload_json: string;
  readonly status: QueueReceipt["status"] | "pending";
  readonly sequence: number;
  readonly owner_id: string | null;
  readonly owner_pid: number | null;
}

export interface PersistentWorkerQueue {
  enqueue(job: StageJob, options?: EnqueueOptions): Promise<QueueReceipt>;
  cancel(jobId: string): Promise<boolean>;
  reconcile(): Promise<void>;
}

const QUEUE_DATABASE = "worker-queue.sqlite";
const TERMINAL_STATUSES = new Set<QueueReceipt["status"]>(["completed", "failed", "cancelled"]);
const liveOwners = new Set<string>();

export async function createPersistentWorkerQueue(options: PersistentWorkerQueueOptions): Promise<PersistentWorkerQueue> {
  await mkdir(options.rootDir, { recursive: true });
  const queue = new SqliteWorkerQueue(options);
  queue.initialize();
  return queue;
}

class SqliteWorkerQueue implements PersistentWorkerQueue {
  private readonly ownerId = randomUUID();
  private readonly terminalPromises = new Map<string, Promise<void>>();
  private draining = false;

  constructor(private readonly options: PersistentWorkerQueueOptions) {
    liveOwners.add(this.ownerId);
  }

  initialize(): void {
    this.withDatabase((database) => database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS worker_jobs (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL UNIQUE,
        attempt_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('excel', 'calculation', 'host')),
        stage TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled')),
        result_json TEXT,
        error_code TEXT,
        error_message TEXT,
        owner_id TEXT,
        owner_pid INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (status IN ('pending', 'queued', 'cancelled') AND result_json IS NULL AND error_code IS NULL AND error_message IS NULL)
          OR (status = 'running' AND result_json IS NULL AND error_code IS NULL AND error_message IS NULL)
          OR (status = 'completed' AND result_json IS NOT NULL AND error_code IS NULL AND error_message IS NULL)
          OR (status = 'failed' AND result_json IS NULL AND error_code = 'dependency_error' AND error_message IS NOT NULL)
        )
      ) STRICT;
      CREATE INDEX IF NOT EXISTS worker_jobs_claim_order ON worker_jobs(status, sequence);
      CREATE INDEX IF NOT EXISTS worker_jobs_running_kind ON worker_jobs(status, kind);
    `));
  }

  async enqueue(job: StageJob, options?: EnqueueOptions): Promise<QueueReceipt> {
    const canonicalJob = canonicalizeStageJob(job);
    const initialStatus = options?.deferDrain === true ? "running" : "queued";
    let sequence: number;
    try {
      sequence = this.transaction((database) => {
        const now = new Date().toISOString();
        const row = database.prepare(`
          INSERT INTO worker_jobs(job_id, attempt_id, kind, stage, payload_json, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING sequence
        `).get(canonicalJob.jobId, canonicalJob.attemptId, canonicalJob.kind, canonicalJob.stage,
          JSON.stringify(canonicalJob.payload), "pending", now, now) as { sequence: number };
        return row.sequence;
      });
    } catch (error) {
      if (String((error as Error).message).includes("UNIQUE constraint failed: worker_jobs.job_id")) {
        throw createTypedError({
          code: "validation_error",
          summary: "Duplicate worker job rejected.",
          suggestedAction: "Submit each worker job with a unique jobId.",
          affectedInputReferences: [canonicalJob.jobId],
        });
      }
      throw error;
    }

    try {
      await this.options.sessionStore.persistAttempt({
        attemptId: canonicalJob.attemptId,
        status: initialStatus,
        jobId: canonicalJob.jobId,
        stage: canonicalJob.stage,
      });
    } catch (error) {
      this.transaction((database) => {
        database.prepare("DELETE FROM worker_jobs WHERE job_id = ? AND sequence = ? AND status = 'pending'")
          .run(canonicalJob.jobId, sequence);
      });
      throw error;
    }

    const published = this.transaction((database) => database.prepare(`
      UPDATE worker_jobs SET status = ?, updated_at = ?
      WHERE job_id = ? AND sequence = ? AND status = 'pending'
    `).run(initialStatus, new Date().toISOString(), canonicalJob.jobId, sequence).changes === 1);
    if (!published) {
      throw createTypedError({
        code: "dependency_error",
        summary: "Worker job reservation could not be published.",
        suggestedAction: "Retry the job with a new jobId.",
        affectedInputReferences: [canonicalJob.jobId],
      });
    }

    if (options?.deferDrain !== true && this.options.worker === undefined) {
      const persisted = this.readJobs("queued").find((candidate) => candidate.jobId === canonicalJob.jobId);
      if (persisted !== undefined) {
        await this.failJob(persisted, "No worker executor is configured; retry is required.", null);
      }
      return this.readReceipt(canonicalJob.jobId) ?? {
        jobId: canonicalJob.jobId,
        attemptId: canonicalJob.attemptId,
        status: "failed",
      };
    }

    if (options?.deferDrain !== true) {
      const drain = this.drain();
      await new Promise((resolve) => setImmediate(resolve));
      await this.waitForTerminal(canonicalJob.jobId, drain);
    }

    return this.readReceipt(canonicalJob.jobId) ?? {
      jobId: canonicalJob.jobId,
      attemptId: canonicalJob.attemptId,
      status: "failed",
    };
  }

  async cancel(jobId: string): Promise<boolean> {
    if (!isSafeId(jobId)) return false;
    return this.transaction((database) => database.prepare(`
      UPDATE worker_jobs SET status = 'cancelled', updated_at = ?
      WHERE job_id = ? AND status = 'queued'
    `).run(new Date().toISOString(), jobId).changes === 1);
  }

  async reconcile(): Promise<void> {
    for (const job of this.readJobs("pending")) {
      await this.failJob(job, "Worker stopped before enqueue completed; retry is required.", null);
    }
    for (const job of this.readJobs("running")) {
      if (!isOwnerAlive(job.ownerId, job.ownerPid)) {
        await this.failJob(job, "Worker stopped before terminal callback; retry is required.", job.ownerId);
      }
    }

    const queued = this.readJobs("queued");
    if (queued.length === 0) return;
    if (this.options.worker === undefined) {
      for (const job of queued) {
        await this.failJob(job, "No worker executor is configured; retry is required.", null);
      }
      return;
    }

    const drain = this.drain();
    await drain;
    await Promise.all(queued.map((job) => this.waitForTerminal(job.jobId, drain)));
  }

  private async drain(): Promise<void> {
    if (this.draining || this.options.worker === undefined) return;
    this.draining = true;
    try {
      while (true) {
        const claimed = this.claimNextJob();
        if (claimed === undefined) return;
        try {
          await this.options.sessionStore.persistAttempt({
            attemptId: claimed.attemptId,
            status: "running",
            jobId: claimed.jobId,
            stage: claimed.stage,
          });
        } catch {
          await this.failJob(claimed, "Attempt could not be marked running.", this.ownerId);
          continue;
        }
        const terminal = this.runJob(claimed);
        this.terminalPromises.set(claimed.jobId, terminal);
      }
    } finally {
      this.draining = false;
    }
  }

  private claimNextJob(): PersistedJob | undefined {
    return this.transaction((database) => {
      const row = database.prepare(`
        SELECT job_id, attempt_id, kind, stage, payload_json, status, sequence, owner_id, owner_pid
        FROM worker_jobs
        WHERE status = 'queued'
          AND (kind <> 'excel' OR (SELECT COUNT(*) FROM worker_jobs WHERE status = 'running' AND kind = 'excel') < 1)
          AND (kind <> 'calculation' OR (SELECT COUNT(*) FROM worker_jobs WHERE status = 'running' AND kind = 'calculation') < ?)
        ORDER BY sequence ASC
        LIMIT 1
      `).get(this.options.calculationConcurrency ?? 2) as QueueRow | undefined;
      if (row === undefined) return undefined;
      const changed = database.prepare(`
        UPDATE worker_jobs SET status = 'running', owner_id = ?, owner_pid = ?, updated_at = ?
        WHERE job_id = ? AND status = 'queued'
      `).run(this.ownerId, process.pid, new Date().toISOString(), row.job_id).changes;
      return changed === 1 ? rowToJob({ ...row, status: "running", owner_id: this.ownerId, owner_pid: process.pid }) : undefined;
    });
  }

  private async runJob(job: PersistedJob): Promise<void> {
    try {
      const result = await this.options.worker!(job);
      const canonicalResult = canonicalizeJson(result, "Worker result");
      const accepted = await this.options.sessionStore.markAttemptResult(job.attemptId, canonicalResult, "running", job);
      if (!accepted) {
        await this.failJob(job, "Attempt result was rejected by the session store.", this.ownerId);
      } else if (!this.completeJob(job, canonicalResult)) {
        await this.options.sessionStore.markDependencyFailure(job.attemptId, "Worker terminal state was rejected.", job);
      }
    } catch {
      await this.failJob(job, "Worker failed.", this.ownerId);
    } finally {
      this.terminalPromises.delete(job.jobId);
      void this.drain();
    }
  }

  private completeJob(job: PersistedJob, result: unknown): boolean {
    return this.transaction((database) => database.prepare(`
      UPDATE worker_jobs
      SET status = 'completed', result_json = ?, owner_id = NULL, owner_pid = NULL, updated_at = ?
      WHERE job_id = ? AND status = 'running' AND owner_id = ?
    `).run(JSON.stringify(result), new Date().toISOString(), job.jobId, this.ownerId).changes === 1);
  }

  private async failJob(job: PersistedJob, reason: string, expectedOwner: string | null): Promise<void> {
    const changed = this.transaction((database) => database.prepare(`
      UPDATE worker_jobs
      SET status = 'failed', error_code = 'dependency_error', error_message = ?,
          owner_id = NULL, owner_pid = NULL, updated_at = ?
      WHERE job_id = ? AND status = ? AND owner_id IS ?
    `).run(reason, new Date().toISOString(), job.jobId, job.status, expectedOwner).changes === 1);
    if (changed) await this.options.sessionStore.markDependencyFailure(job.attemptId, reason, job);
  }

  private async waitForTerminal(jobId: string, drain: Promise<void>): Promise<void> {
    while (true) {
      const local = this.terminalPromises.get(jobId);
      if (local !== undefined) await local;
      const receipt = this.readReceipt(jobId);
      if (receipt === undefined || TERMINAL_STATUSES.has(receipt.status)) return;
      await drain;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  private readReceipt(jobId: string): QueueReceipt | undefined {
    const row = this.withDatabase((database) => database.prepare(
      "SELECT job_id, attempt_id, status FROM worker_jobs WHERE job_id = ?",
    ).get(jobId) as { job_id: string; attempt_id: string; status: QueueReceipt["status"] } | undefined);
    return row === undefined ? undefined : { jobId: row.job_id, attemptId: row.attempt_id, status: row.status };
  }

  private readJobs(status: "pending" | "queued" | "running"): PersistedJob[] {
    return this.withDatabase((database) => (database.prepare(`
      SELECT job_id, attempt_id, kind, stage, payload_json, status, sequence, owner_id, owner_pid
      FROM worker_jobs WHERE status = ? ORDER BY sequence ASC
    `).all(status) as unknown as QueueRow[]).map(rowToJob));
  }

  private transaction<T>(operation: (database: DatabaseSync) => T): T {
    return this.withDatabase((database) => {
      database.exec("BEGIN IMMEDIATE");
      try {
        const result = operation(database);
        database.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          database.exec("ROLLBACK");
        } catch {
          // The transaction was already closed by SQLite.
        }
        throw error;
      }
    });
  }

  private withDatabase<T>(operation: (database: DatabaseSync) => T): T {
    const database = new DatabaseSync(join(this.options.rootDir, QUEUE_DATABASE), { timeout: 5_000 });
    try {
      return operation(database);
    } finally {
      database.close();
    }
  }
}

function rowToJob(row: QueueRow): PersistedJob {
  return {
    jobId: row.job_id,
    attemptId: row.attempt_id,
    kind: row.kind,
    stage: row.stage,
    payload: JSON.parse(row.payload_json),
    status: row.status,
    sequence: row.sequence,
    ownerId: row.owner_id,
    ownerPid: row.owner_pid,
  };
}

function canonicalizeStageJob(job: StageJob): StageJob {
  if (!isSafeId(job.jobId) || !isSafeId(job.attemptId) || !isSafeId(job.stage)
    || (job.kind !== "excel" && job.kind !== "calculation" && job.kind !== "host")) {
    throw invalidJob();
  }
  const payload = canonicalizeJson(job.payload, "Worker payload");
  if (!isPlainObject(payload)) throw invalidJob();
  return { jobId: job.jobId, attemptId: job.attemptId, kind: job.kind, stage: job.stage, payload };
}

function canonicalizeJson(value: unknown, label: string): unknown {
  if (!isJsonSafe(value, new Set())) {
    throw createTypedError({
      code: "validation_error",
      summary: `${label} is not JSON-safe.`,
      suggestedAction: "Provide canonical JSON without unsafe keys, custom prototypes, cycles, or conversion hooks.",
      affectedInputReferences: [],
    });
  }
  return JSON.parse(JSON.stringify(value));
}

function isJsonSafe(value: unknown, ancestors: Set<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      const dataKeys = ownKeys.filter((key) => key !== "length");
      if (dataKeys.length !== value.length
        || dataKeys.some((key, index) => key !== String(index))) return false;
      for (const key of dataKeys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return false;
      }
      return value.every((item) => isJsonSafe(item, ancestors));
    }
    if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length > 0) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || key === "__proto__" || key === "prototype" || key === "constructor") return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor) || descriptor.value === undefined
        || !isJsonSafe(descriptor.value, ancestors)) return false;
    }
    return true;
  } finally {
    ancestors.delete(value);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256
    && [...value].every((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    });
}

function invalidJob(): Error {
  return createTypedError({
    code: "validation_error",
    summary: "Worker job is invalid.",
    suggestedAction: "Provide safe nonempty identifiers and a canonical JSON object payload.",
    affectedInputReferences: [],
  });
}

function isOwnerAlive(ownerId: string | null, ownerPid: number | null): boolean {
  if (ownerId === null || ownerPid === null) return false;
  if (ownerPid === process.pid) return liveOwners.has(ownerId);
  try {
    process.kill(ownerPid, 0);
    return true;
  } catch {
    return false;
  }
}
