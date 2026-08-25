import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import { get } from "node:http";

import { buildWorkbenchServer } from "./server.js";

describe("workbench server routes", () => {
  it("exchanges a one-time bootstrap nonce for a browser cookie and CSRF-protected session", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-bootstrap-session" });
    try {
      const nonce = await server.bootstrap.issueBrowserBootstrap();
      const bootstrap = await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } });
      const cookie = bootstrap.headers["set-cookie"];

      expect(bootstrap.statusCode).toBe(204);
      expect(cookie).toContain("HttpOnly");
      expect((await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } })).statusCode).toBe(401);
      const csrf = await server.inject({ method: "GET", url: "/api/csrf", headers: { host: "127.0.0.1:0", cookie } });
      expect(csrf.statusCode).toBe(200);
      const created = await server.inject({
        method: "POST",
        url: "/api/sessions",
        headers: { host: "127.0.0.1:0", cookie, "x-csrf-token": csrf.json<{ csrfToken: string }>().csrfToken },
      });
      expect(created.statusCode).toBe(201);
    } finally {
      await server.close();
    }
  });

  it("serves only the configured built workbench assets after bootstrap", async () => {
    const rootDir = ".tmp/workbench-server-web-assets";
    const webAssetsRoot = join(rootDir, "web-assets");
    await rm(rootDir, { recursive: true, force: true });
    await mkdir(webAssetsRoot, { recursive: true });
    await Promise.all([
      writeFile(join(webAssetsRoot, "workbench.js"), "export {}\n"),
      writeFile(join(webAssetsRoot, "workbench.css"), "body {}\n"),
    ]);
    const server = await buildWorkbenchServer({ rootDir, webAssetsRoot });
    try {
      expect((await server.inject({ method: "GET", url: "/" })).body).toContain('id="app"');
      expect((await server.inject({ method: "GET", url: "/" })).body).toContain('src="/bootstrap.js"');
      expect((await server.inject({ method: "GET", url: "/workbench.js" })).body).toBe("export {}\n");
      expect((await server.inject({ method: "GET", url: "/workbench.css" })).body).toBe("body {}\n");
      expect((await server.inject({ method: "GET", url: "/assets/unknown.js" })).statusCode).toBe(404);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("resolves the production workbench bundle by default and fails safely when it is absent", async () => {
    const rootDir = ".tmp/workbench-server-default-web-assets";
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const response = await server.inject({ method: "GET", url: "/workbench.js" });

      expect([200, 503]).toContain(response.statusCode);
      if (response.statusCode === 503) {
        expect(response.json()).toEqual({ error: expect.objectContaining({ code: "dependency_error" }) });
      }
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

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
      const artifactId = "managed-workbook";
      server.registerArtifactForTest(auth.sessionId, artifactId, `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`, "book.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const workbookPath = join(rootDir, `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`);
      await mkdir(dirname(workbookPath), { recursive: true });
      await writeFile(workbookPath, Buffer.from([80, 75, 3, 4]));
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
          payload: { artifactId, inputClassification: "confidential" },
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

  it("projects ADO validation as a host action without enqueuing a generic worker", async () => {
    const rootDir = ".tmp/workbench-server-ado-host-action";
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, runner: async () => ({ status: "worker-ran" }) });
    try {
      const browser = await server.testAuthenticate("28282828-2828-4282-8282-282828282828");
      const session = await (await import("@ai-assist/workbench")).openSessionStore({ rootDir, sessionId: browser.sessionId });
      try {
        await session.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId: browser.sessionId,
          commandId: "seed-ado-decision",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({ snapshot: { ...snapshot, state: "ado_decision_required", revision: snapshot.revision + 1, activeAttempt: null } }));
      } finally {
        await session.close();
      }
      const snapshot = (await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json<{ revision: number }>();
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: browser.sessionId,
          commandId: "request-ado-validation",
          expectedRevision: snapshot.revision,
          command: "confirm_ado_decision",
          payload: { decision: "create_new" },
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ state: "ado_action_pending", activeAttempt: null });
      const actionId = `ado-validation:${browser.sessionId}:${response.json<{ revision: number }>().revision}`;
      const token = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId, hostInstanceId: "host-a" });
      expect((await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${token}` },
        payload: { hostInstanceId: "host-a" },
      })).statusCode).toBe(200);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("requires scoped host bearer credentials for host action claim and result", async () => {
    const rootDir = ".tmp/workbench-server-host-actions";
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
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
      await rm(rootDir, { recursive: true, force: true });
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

  it("rejects duplicate host action IDs in the same or another session without replacing terminal state", async () => {
    const rootDir = ".tmp/workbench-server-durable-host-actions";
    await rm(rootDir, { recursive: true, force: true });
    const first = await buildWorkbenchServer({ rootDir });
    const firstSessionId = "23232323-2323-4232-8232-232323232323";
    const secondSessionId = "24242424-2424-4242-8242-242424242424";
    try {
      const firstBrowser = await first.testAuthenticate(firstSessionId);
      const secondBrowser = await first.testAuthenticate(secondSessionId);
      const create = async (browser: typeof firstBrowser) => first.inject({
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
      expect((await create(firstBrowser)).statusCode).toBe(201);
      expect((await create(firstBrowser)).statusCode).toBe(409);
      expect((await create(secondBrowser)).statusCode).toBe(409);

      const claimToken = first.issueHostBearer(firstSessionId, ["host-actions:claim"], { actionId: "shared-action", hostInstanceId: "host-a" });
      const claimResponse = await first.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      const claim = claimResponse.json<{ leaseId: string }>();
      const resultToken = first.issueHostBearer(firstSessionId, ["host-actions:result"], { actionId: "shared-action", hostInstanceId: "host-a" });
      const payload = { status: "completed" };
      expect((await first.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "shared-action",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
          payload,
        },
      })).statusCode).toBe(204);
      expect((await create(firstBrowser)).statusCode).toBe(409);
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

      const replayResultToken = second.issueHostBearer(firstSessionId, ["host-actions:result"], { actionId: "shared-action", hostInstanceId: "host-a" });
      expect((await second.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${replayResultToken}` },
        payload: {},
      })).statusCode).toBe(400);
    } finally {
      await second.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps event IDs monotonic after retention rollover and marks an expired replay cursor", async () => {
    const rootDir = ".tmp/workbench-server-event-rollover";
    await rm(rootDir, { recursive: true, force: true });
    const started = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await started.server.testAuthenticate("25252525-2525-4252-8252-252525252525");
      for (let index = 1; index <= 301; index += 1) {
        started.server.publishEventForTest(auth.sessionId, "progress", { index });
      }

      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const request = get(`${started.url.replace(/\/#.*$/, "")}/api/sessions/${auth.sessionId}/events`, {
          headers: { cookie: auth.headers.cookie, "last-event-id": "1" },
        }, resolve);
        request.once("error", reject);
      });
      let stream = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { stream += chunk; });
      await vi.waitFor(() => {
        expect(stream).toContain("event: replay_truncated");
        expect(stream).toContain("id: 301");
      });

      started.server.publishEventForTest(auth.sessionId, "progress", { index: 302 });
      await vi.waitFor(() => expect(stream).toContain("id: 302"));
      response.destroy();
    } finally {
      started.server.server.closeAllConnections();
      await started.server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("replays persisted session events after a new server instance starts", async () => {
    const rootDir = ".tmp/workbench-server-event-restart";
    const sessionId = "26262626-2626-4262-8262-262626262626";
    await rm(rootDir, { recursive: true, force: true });
    const first = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await first.server.testAuthenticate(sessionId);
      first.server.publishEventForTest(auth.sessionId, "progress", { sequence: 1 });
      first.server.publishEventForTest(auth.sessionId, "progress", { sequence: 2 });
    } finally {
      first.server.server.closeAllConnections();
      await first.server.close();
    }

    const second = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await second.server.testAuthenticate(sessionId);
      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const request = get(`${second.url.replace(/\/#.*$/, "")}/api/sessions/${sessionId}/events`, {
          headers: { cookie: auth.headers.cookie, "last-event-id": "1" },
        }, resolve);
        request.once("error", reject);
      });
      let stream = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { stream += chunk; });
      await vi.waitFor(() => expect(stream).toContain("id: 2"));
      expect(stream).toContain('data: {"sequence":2}');
      response.destroy();
    } finally {
      second.server.server.closeAllConnections();
      await second.server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});