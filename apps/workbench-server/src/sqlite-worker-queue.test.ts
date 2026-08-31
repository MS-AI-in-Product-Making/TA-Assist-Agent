import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createPersistentWorkerQueue, type QueueSessionStore, type StageJob } from "./sqlite-worker-queue.js";

class RecordingSessionStore implements QueueSessionStore {
  readonly results: string[] = [];
  onResult: ((attemptId: string) => void) | undefined;

  async persistAttempt(): Promise<void> {}

  async markAttemptResult(attemptId: string): Promise<boolean> {
    this.results.push(attemptId);
    this.onResult?.(attemptId);
    return true;
  }

  async markDependencyFailure(): Promise<void> {}
}

describe("persistent worker queue follow-up", () => {
  it("drains a deferred successor enqueued while the first worker is completing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "f8-worker-follow-up-"));
    const sessionStore = new RecordingSessionStore();
    let queue: Awaited<ReturnType<typeof createPersistentWorkerQueue>>;
    let resolveSecond!: () => void;
    const secondCompleted = new Promise<void>((resolve) => { resolveSecond = resolve; });
    sessionStore.onResult = (attemptId) => { if (attemptId === "second") resolveSecond(); };
    const worker = async (job: StageJob) => {
      if (job.jobId === "first") {
        await queue.enqueue(jobFor("second"), { deferStart: true });
      }
      return { jobId: job.jobId };
    };
    queue = await createPersistentWorkerQueue({ rootDir, sessionStore, worker });

    try {
      await queue.enqueue(jobFor("first"));
      await secondCompleted;
      expect(sessionStore.results).toEqual(["first", "second"]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("recovers one missing active-attempt job idempotently", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "f8-worker-recovery-"));
    const sessionStore = new RecordingSessionStore();
    let resolveCompleted!: () => void;
    const completed = new Promise<void>((resolve) => { resolveCompleted = resolve; });
    sessionStore.onResult = (attemptId) => { if (attemptId === "recovered") resolveCompleted(); };
    const queue = await createPersistentWorkerQueue({ rootDir, sessionStore, worker: async (job) => ({ jobId: job.jobId }) });

    try {
      await queue.recover(jobFor("recovered"));
      await completed;
      const duplicate = await queue.recover(jobFor("recovered"));
      expect(duplicate.status).toBe("completed");
      expect(sessionStore.results).toEqual(["recovered"]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

function jobFor(id: string): StageJob {
  return { jobId: id, attemptId: id, kind: "calculation", stage: "f0_validating", payload: { sessionId: "session" } };
}
