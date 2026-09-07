import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";
import { buildWorkbenchServer } from "./server.js";
import type { PersistentWorkerQueueOptions, StageJob } from "./sqlite-worker-queue.js";

function testRoot(name: string): string {
  return `.tmp/${name}-${randomUUID()}`;
}

function multipartUpload(kind: string, fileName: string, mimeType: string, bytes: Uint8Array): { readonly headers: Record<string, string>; readonly payload: Buffer } {
  const boundary = "workbench-upload-boundary";
  const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([prefix, Buffer.from(bytes), suffix]),
  };
}

async function immediateQueue(options: PersistentWorkerQueueOptions) {
  return {
    async enqueue(job: StageJob) {
      await options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
      if (options.worker === undefined) {
        await options.sessionStore.markDependencyFailure(job.attemptId, "No worker executor is configured; retry is required.", job);
        return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
      }
      try {
        const result = await options.worker(job);
        const accepted = await options.sessionStore.markAttemptResult(job.attemptId, result, "running", job);
        if (!accepted) {
          await options.sessionStore.markDependencyFailure(job.attemptId, "Attempt result was rejected by the session store.", job);
          return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
        }
        return { jobId: job.jobId, attemptId: job.attemptId, status: "completed" as const };
      } catch {
        await options.sessionStore.markDependencyFailure(job.attemptId, "Worker failed.", job);
        return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
      }
    },
    async cancel() { return false; },
    async discardForExternalGate() { return false; },
    async assertNoUnreconciledExternalGateJobs() {},
    async reconcile() {},
  };
}

describe("workbench uploads", () => {
  it("accepts a managed workbook reference instead of browser-provided bytes", async () => {
    const rootDir = testRoot("workbench-server-upload-managed-reference");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, runner: async () => ({ status: "ok" }), queueFactory: immediateQueue, skipWebAssets: true });
    try {
      const auth = await server.testAuthenticate();
      const form = multipartUpload("workbook", "large.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", createLargeWorkbook());
      const upload = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/files`,
        headers: { ...auth.headers, ...form.headers },
        payload: form.payload,
      });

      expect(upload.statusCode).toBe(201);
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "managed-workbook-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { artifactId: upload.json<{ artifactId: string }>().artifactId, inputClassification: "confidential" },
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ state: "initial_scope_required" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects public command payloads that supply workbook bytes", async () => {
    const rootDir = testRoot("workbench-server-upload-public-bytes");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, runner: async () => ({ status: "ok" }) });
    try {
      const auth = await server.testAuthenticate();
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "public-workbook-bytes",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: [1], inputClassification: "confidential" },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "command_schema_rejected" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("never accepts a client supplied output path", async () => {
    const rootDir = testRoot("workbench-server-upload-path");
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate();
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/files`,
        headers: auth.headers,
        payload: { kind: "workbook", outputRoot: "C:/escape" },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects non-OOXML workbook uploads by MIME and signature", async () => {
    const rootDir = testRoot("workbench-server-upload-ooxml");
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate();
      const form = multipartUpload("workbook", "bad.txt", "text/plain", Buffer.from("not a zip"));

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/files`,
        headers: { ...auth.headers, ...form.headers },
        payload: form.payload,
      });

      expect(response.statusCode).toBe(415);
      expect(response.json()).toMatchObject({ error: { code: "validation_error" } });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("accepts a valid formatted workbook larger than the full worksheet cell budget", async () => {
    const rootDir = testRoot("workbench-server-upload-formatted-ta");
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const auth = await server.testAuthenticate();
      const form = multipartUpload("workbook", "formatted-ta.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", createFormattedWorkbook());
      const response = await server.inject({ method: "POST", url: `/api/sessions/${auth.sessionId}/files`, headers: { ...auth.headers, ...form.headers }, payload: form.payload });
      expect(response.statusCode).toBe(201);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

function createLargeWorkbook(): Uint8Array {
  return createAnonymousWorkbookZip();
}

function createFormattedWorkbook(): Uint8Array {
  const rows = Array.from({ length: 102 }, (_, rowIndex) => {
    const row = rowIndex + 1;
    const cells = Array.from({ length: 100 }, (_, columnIndex) => `<c r="${columnName(columnIndex + 1)}${row}" s="1"><v>1</v></c>`).join("");
    return `<row r="${row}">${cells}</row>`;
  }).join("");
  return createAnonymousWorkbookZip({
    xmlParts: {
      "xl/worksheets/sheet3.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
    },
  });
}

function columnName(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}