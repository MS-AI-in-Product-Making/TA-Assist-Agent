import { describe, expect, it } from "vitest";

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