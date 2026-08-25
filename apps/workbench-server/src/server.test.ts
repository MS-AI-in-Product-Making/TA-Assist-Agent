import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";

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

  it("reconciles a default runner dependency failure after committing the active attempt", async () => {
    const rootDir = ".tmp/workbench-server-default-queue";
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate("12121212-1212-4212-8212-121212121212");
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "missing-runner-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: [1], inputClassification: "confidential" },
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ state: "failed", activeAttempt: { status: "failed" } });
      expect(response.json()).not.toMatchObject({ state: "completed" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
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

      const claimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: "action-1", hostInstanceId: "host-a" });
      const claimResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      const claim = claimResponse.json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: "action-1", hostInstanceId: "host-a" });
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
      const claimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: "action-2", hostInstanceId: "host-a" });
      const claim = (await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-2/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      })).json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: "action-2", hostInstanceId: "host-a" });
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

  it("persists host action claims across restart and isolates duplicate action IDs by session", async () => {
    const rootDir = ".tmp/workbench-server-durable-host-actions";
    await rm(rootDir, { recursive: true, force: true });
    const first = await buildWorkbenchServer({ rootDir });
    const firstSessionId = "23232323-2323-4232-8232-232323232323";
    const secondSessionId = "24242424-2424-4242-8242-242424242424";
    try {
      const firstBrowser = await first.testAuthenticate(firstSessionId);
      const secondBrowser = await first.testAuthenticate(secondSessionId);
      for (const browser of [firstBrowser, secondBrowser]) {
        const response = await first.inject({
          method: "POST",
          url: `/api/sessions/${browser.sessionId}/host-actions`,
          headers: browser.headers,
          payload: {
            contractVersion: "f8-host-action-request-v1",
            actionId: "shared-action",
            sessionId: browser.sessionId,
            expectedRevision: 0,
            kind: "model_request",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        });
        expect(response.statusCode).toBe(201);
      }

      const claimToken = first.issueHostBearer(firstSessionId, ["host-actions:claim"], { actionId: "shared-action", hostInstanceId: "host-a" });
      const claimResponse = await first.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
    } finally {
      await first.close();
    }

    const second = await buildWorkbenchServer({ rootDir });
    try {
      const replayToken = second.issueHostBearer(firstSessionId, ["host-actions:claim"], { actionId: "shared-action", hostInstanceId: "host-a" });
      expect((await second.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${replayToken}` },
        payload: { hostInstanceId: "host-a" },
      })).statusCode).toBe(409);

      const isolatedToken = second.issueHostBearer(secondSessionId, ["host-actions:claim"], { actionId: "shared-action", hostInstanceId: "host-b" });
      expect((await second.inject({
        method: "POST",
        url: `/api/sessions/${secondSessionId}/host-actions/shared-action/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${isolatedToken}` },
        payload: { hostInstanceId: "host-b" },
      })).statusCode).toBe(200);
    } finally {
      await second.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});