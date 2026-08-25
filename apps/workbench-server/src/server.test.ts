import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildWorkbenchServer } from "./server.js";

describe("workbench server routes", () => {
  it("returns CSRF only to the authenticated browser session", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-csrf" });
    try {
      const auth = await server.testAuthenticate();

      const response = await server.inject({ method: "GET", url: "/api/csrf", headers: { host: "127.0.0.1:0", cookie: auth.headers.cookie } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ csrfToken: auth.csrfToken });
    } finally {
      await server.close();
    }
  });

  it("requires scoped host bearer credentials for host action claim and result", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-host-actions" });
    try {
      const browser = await server.testAuthenticate("11111111-1111-4111-8111-111111111111");
      const request = {
        contractVersion: "f8-host-action-request-v1",
        actionId: "action-1",
        sessionId: browser.sessionId,
        expectedRevision: 0,
        kind: "model_request",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions`, headers: browser.headers, payload: request })).statusCode).toBe(201);

      const wrongToken = server.issueHostBearer(browser.sessionId, ["host-actions:read"]);
      expect((await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${wrongToken}` },
        payload: { hostInstanceId: "host-a" },
      })).statusCode).toBe(403);

      const claimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"]);
      const claimResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      const claim = claimResponse.json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"]);
      const payload = { status: "completed" };
      const resultResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "action-1",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
          payload,
        },
      });

      expect(resultResponse.statusCode).toBe(204);
    } finally {
      await server.close();
    }
  });

  it("rejects host action results whose hash does not match the result payload", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-host-action-hash" });
    try {
      const browser = await server.testAuthenticate("22222222-2222-4222-8222-222222222222");
      await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-host-action-request-v1",
          actionId: "action-2",
          sessionId: browser.sessionId,
          expectedRevision: 0,
          kind: "model_request",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });
      const claimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"]);
      const claim = (await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-2/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      })).json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"]);
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-2/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "action-2",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: "0".repeat(64),
          payload: { status: "completed" },
        },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await server.close();
    }
  });
});