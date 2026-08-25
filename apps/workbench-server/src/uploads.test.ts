import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import * as xlsx from "xlsx";

import { buildWorkbenchServer } from "./server.js";

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

describe("workbench uploads", () => {
  it("accepts a managed workbook reference instead of browser-provided bytes", async () => {
    const rootDir = testRoot("workbench-server-upload-managed-reference");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, runner: async () => ({ status: "ok" }) });
    try {
      const auth = await server.testAuthenticate();
      const form = multipartUpload("workbook", "large.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", createLargeWorkbook());
      expect(form.payload.byteLength).toBeGreaterThan(1_048_576);
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
});

function createLargeWorkbook(): Uint8Array {
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([["valid"]]), "Workbook");
  return appendStoredMediaEntry(xlsx.write(workbook, { type: "buffer", bookType: "xlsx", compression: false }) as Buffer, "xl/media/padding.bin", 1_048_576);
}

function appendStoredMediaEntry(zip: Buffer, name: string, size: number): Buffer {
  const eocdOffset = zip.lastIndexOf(Buffer.from("PK\x05\x06"));
  const centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = zip.readUInt32LE(eocdOffset + 12);
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const nameBytes = Buffer.from(name, "utf8");
  const padding = Buffer.alloc(size, 0x5a);
  const crc32 = calculateCrc32(padding);
  const localHeader = Buffer.alloc(30 + nameBytes.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt32LE(crc32, 14);
  localHeader.writeUInt32LE(size, 18);
  localHeader.writeUInt32LE(size, 22);
  localHeader.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(localHeader, 30);
  const centralHeader = Buffer.alloc(46 + nameBytes.length);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt32LE(crc32, 16);
  centralHeader.writeUInt32LE(size, 20);
  centralHeader.writeUInt32LE(size, 24);
  centralHeader.writeUInt16LE(nameBytes.length, 28);
  centralHeader.writeUInt32LE(centralDirectoryOffset, 42);
  nameBytes.copy(centralHeader, 46);
  const eocd = Buffer.from(zip.subarray(eocdOffset, eocdOffset + 22));
  eocd.writeUInt16LE(entryCount + 1, 8);
  eocd.writeUInt16LE(entryCount + 1, 10);
  eocd.writeUInt32LE(centralDirectorySize + centralHeader.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset + localHeader.length + padding.length, 16);
  return Buffer.concat([zip.subarray(0, centralDirectoryOffset), localHeader, padding, zip.subarray(centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize), centralHeader, eocd]);
}

function calculateCrc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}