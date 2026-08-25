import { describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import * as xlsx from "xlsx";

import { buildWorkbenchServer } from "./server.js";

function multipartUpload(kind: string, fileName: string, mimeType: string, bytes: Uint8Array): { readonly headers: Record<string, string>; readonly payload: Buffer } {
  const boundary = "workbench-upload-boundary";
  const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([prefix, Buffer.from(bytes), suffix]),
  };
}

describe("workbench uploads", () => {
  it("accepts a managed workbook reference instead of browser-provided bytes", async () => {
    const rootDir = ".tmp/workbench-server-upload-managed-reference";
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, runner: async () => ({ status: "ok" }) });
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
    const rootDir = ".tmp/workbench-server-upload-public-bytes";
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
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-upload-path" });
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
    }
  });

  it("rejects non-OOXML workbook uploads by MIME and signature", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-upload-ooxml" });
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
    }
  });
});

function createLargeWorkbook(): Uint8Array {
  const workbook = xlsx.utils.book_new();
  const rows = Array.from({ length: 2 }, (_, index) => [Array.from({ length: 32767 }, (_value, characterIndex) => String.fromCharCode(65 + ((index + characterIndex) % 26))).join("")]);
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(rows), "Large");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx", compression: false }) as Buffer;
}