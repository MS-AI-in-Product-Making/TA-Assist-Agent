import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildWorkbenchServer } from "../server.js";

function testRoot(name: string): string {
  return join(".tmp", `${name}-${randomUUID()}`);
}

describe("product export route", () => {
  it("rejects client-forged source/provenance/hash fields in request body", async () => {
    const rootDir = testRoot("workbench-server-product-export-forgery");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate();
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/product-export`,
        headers: browser.headers,
        payload: {
          contractVersion: "ta-product-export-command-v1",
          sessionId: browser.sessionId,
          expectedRevision: 0,
          idempotencyKey: "product-export-1",
          sourceRunReference: "forged-client-run",
          verificationStatus: "verified",
          workbook: { fileName: "forged.xlsx", contentHash: "a".repeat(64) },
          finalReport: "# forged\n",
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "product_export_schema_rejected" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
