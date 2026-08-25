import { describe, expect, it } from "vitest";

import { buildWorkbenchServer } from "./server.js";

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
      const form = new FormData();
      form.set("kind", "workbook");
      form.set("file", new Blob(["not a zip"], { type: "text/plain" }), "bad.txt");

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/files`,
        headers: auth.headers,
        payload: form,
      });

      expect(response.statusCode).toBe(415);
    } finally {
      await server.close();
    }
  });
});