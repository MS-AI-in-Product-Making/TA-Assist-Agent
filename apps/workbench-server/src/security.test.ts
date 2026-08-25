import { createHash } from "node:crypto";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { get } from "node:http";
import { dirname, join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";
import { buildWorkbenchServer, startWorkbenchServer } from "./server.js";
import { createBrowserBootstrapRendezvous } from "./bootstrap.js";

describe("workbench server security boundary", () => {
  it("binds loopback and rejects hostile Host or missing CSRF", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-security" });
    try {
      expect(server.listenOptions.host).toBe("127.0.0.1");

      await expect(server.inject({ method: "POST", url: "/api/sessions", headers: { host: "evil.test" } }))
        .resolves.toMatchObject({ statusCode: 403 });

      await expect(server.inject({ method: "POST", url: "/api/sessions", headers: { host: "127.0.0.1:0" } }))
        .resolves.toMatchObject({ statusCode: 403 });
    } finally {
      await server.close();
    }
  });

  it("does not emit CORS and applies browser containment headers", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-headers" });
    try {
      const response = await server.inject({ method: "GET", url: "/", headers: { host: "127.0.0.1:0" } });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
      expect(response.headers["content-security-policy"]).not.toContain("'unsafe-inline'");
      expect(response.headers["x-frame-options"]).toBe("DENY");
    } finally {
      await server.close();
    }
  });

  it("consumes a fragment bootstrap nonce once and never returns it", async () => {
    const rendezvous = createBrowserBootstrapRendezvous({ now: () => new Date("2026-08-25T00:00:00.000Z") });
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-bootstrap", bootstrap: rendezvous });
    try {
      const nonce = await rendezvous.issueBrowserBootstrap();
      const page = await server.inject({ method: "GET", url: "/", headers: { host: "127.0.0.1:0" } });
      expect(page.body).not.toContain(nonce);
      expect(page.body).not.toContain("<script>");
      const scriptResponse = await server.inject({ method: "GET", url: "/bootstrap.js", headers: { host: "127.0.0.1:0" } });
      expect(scriptResponse.statusCode).toBe(200);
      expect(scriptResponse.headers["content-type"]).toContain("javascript");
      expect(scriptResponse.body).toContain("history.replaceState");
      expect(scriptResponse.body.indexOf("history.replaceState")).toBeLessThan(scriptResponse.body.indexOf("fetch('/api/bootstrap'"));

      const first = await server.inject({ method: "POST", url: "/api/bootstrap", headers: { host: "127.0.0.1:0" }, payload: { nonce } });
      expect(first.statusCode).toBe(204);
      expect(first.cookies.some((cookie) => cookie.name === "ta_session" && cookie.httpOnly)).toBe(true);

      await expect(server.inject({ method: "POST", url: "/api/bootstrap", headers: { host: "127.0.0.1:0" }, payload: { nonce } }))
        .resolves.toMatchObject({ statusCode: 401 });
    } finally {
      await server.close();
    }
  });

  it("rejects stale and disallowed session commands through the public route", async () => {
    const rootDir = ".tmp/workbench-server-session-cas";
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate("33333333-3333-4333-8333-333333333333");

      const disallowed = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "command-disallowed",
          expectedRevision: 0,
          command: "confirm_initial_scope",
          payload: { workbookHash: "0".repeat(64), worksheetNames: ["Analysis-A"] },
        },
      });
      expect(disallowed.statusCode).toBe(409);
      expect(disallowed.json()).toMatchObject({ error: { code: "validation_error" } });

      const accepted = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "command-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([1]), inputClassification: "confidential" },
        },
      });
      expect(accepted.statusCode).toBe(202);

      const stale = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "command-stale",
          expectedRevision: 0,
          command: "cancel",
          payload: { reason: "stale" },
        },
      });
      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toMatchObject({ error: { code: "evidence_mismatch" } });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("binds host bearer leases to session, action, host instance, expiry, and one terminal result", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-host-action-binding" });
    try {
      const auth = await server.testAuthenticate("44444444-4444-4444-8444-444444444444");
      await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/host-actions`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-host-action-request-v1",
          actionId: "action-binding",
          sessionId: auth.sessionId,
          expectedRevision: 0,
          kind: "model_request",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });

      const claimToken = server.issueHostBearer(auth.sessionId, ["host-actions:claim"], { hostInstanceId: "host-a", actionId: "action-binding" });
      const claimResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/host-actions/action-binding/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      const claim = claimResponse.json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(auth.sessionId, ["host-actions:result"], { hostInstanceId: "host-a", actionId: "action-binding" });
      const payload = { status: "completed" };
      const resultBody = {
        contractVersion: "f8-host-action-result-v1",
        actionId: "action-binding",
        hostInstanceId: "host-a",
        leaseId: claim.leaseId,
        status: "completed",
        resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
        payload,
      };
      expect((await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/host-actions/action-binding/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: { ...resultBody, hostInstanceId: "host-b" },
      })).statusCode).toBe(400);
      expect((await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/host-actions/action-binding/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: resultBody,
      })).statusCode).toBe(204);
      expect((await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/host-actions/action-binding/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: resultBody,
      })).statusCode).toBe(409);
    } finally {
      await server.close();
    }
  });

  it("rejects expired host bearer credentials", async () => {
    const server = await buildWorkbenchServer({ rootDir: ".tmp/workbench-server-host-bearer-expired" });
    try {
      const auth = await server.testAuthenticate("55555555-5555-4555-8555-555555555555");
      const token = server.issueHostBearer(auth.sessionId, ["host-actions:claim"], { expiresAt: new Date(Date.now() - 1).toISOString() });
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/host-actions/missing/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${token}` },
        payload: { hostInstanceId: "host-a" },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await server.close();
    }
  });

  it("rejects unknown multipart fields and malformed workbook content without leaking filesystem errors", async () => {
    const rootDir = ".tmp/workbench-server-upload-security";
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate();
      const form = new FormData();
      form.set("kind", "workbook");
      form.set("outputRoot", "C:/escape");
      form.set("file", new Blob([createAnonymousWorkbookZip()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "book.xlsx");
      expect((await server.inject({ method: "POST", url: `/api/sessions/${auth.sessionId}/files`, headers: auth.headers, payload: form })).statusCode).toBe(400);

      await rm(join(rootDir, "uploads"), { recursive: true, force: true });
      await writeFile(join(rootDir, "uploads"), "not a directory");
      const badForm = new FormData();
      badForm.set("kind", "workbook");
      badForm.set("file", new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "bad.xlsx");
      const response = await server.inject({ method: "POST", url: `/api/sessions/${auth.sessionId}/files`, headers: auth.headers, payload: badForm });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.body).not.toContain("ENOTDIR");
      expect(response.json()).toMatchObject({ error: { code: expect.any(String) } });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("revalidates artifact registry paths and rejects range reads, symlinks, and cross-session access", async () => {
    const rootDir = ".tmp/workbench-server-artifact-security";
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate("66666666-6666-4666-8666-666666666666");
      const other = await server.testAuthenticate("77777777-7777-4777-8777-777777777777");
      const artifactDir = join(rootDir, "artifacts", auth.sessionId);
      await mkdir(artifactDir, { recursive: true });
      await writeFile(join(artifactDir, "safe.txt"), "safe");
      server.registerArtifactForTest(auth.sessionId, "safe", "artifacts/66666666-6666-4666-8666-666666666666/safe.txt", "safe.txt", "public", "text/plain");

      const ranged = await server.inject({ method: "GET", url: `/api/sessions/${auth.sessionId}/artifacts/safe`, headers: { ...auth.headers, range: "bytes=0-1" } });
      expect(ranged.statusCode).toBe(416);

      const crossSession = await server.inject({ method: "GET", url: `/api/sessions/${other.sessionId}/artifacts/safe`, headers: other.headers });
      expect(crossSession.statusCode).toBe(404);

      await mkdir(join(rootDir, "links"), { recursive: true });
      await symlink(dirname(join(process.cwd(), "package.json")), join(rootDir, "links", "escape"), "junction");
      server.registerArtifactForTest(auth.sessionId, "link", "links/escape/package.json", "package.json", "public", "application/json");
      const linked = await server.inject({ method: "GET", url: `/api/sessions/${auth.sessionId}/artifacts/link`, headers: auth.headers });
      expect(linked.statusCode).toBe(403);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps authenticated session event streams open with ids, heartbeat, Last-Event-ID replay, and live delivery", async () => {
    const started = await startWorkbenchServer({ rootDir: ".tmp/workbench-server-events" });
    const { server } = started;
    try {
      const auth = await server.testAuthenticate("88888888-8888-4888-8888-888888888888");
      server.publishEventForTest(auth.sessionId, "snapshot", { token: "abc\nxyz", missing: undefined });
      server.publishEventForTest(auth.sessionId, "snapshot", { ok: true });

      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const request = get(`${started.url.replace(/\/#.*$/, "")}/api/sessions/${auth.sessionId}/events`, {
          headers: { cookie: auth.headers.cookie, "last-event-id": "1" },
        }, resolve);
        request.once("error", reject);
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      let stream = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { stream += chunk; });
      await vi.waitFor(() => {
        expect(stream).toContain("id: 2");
        expect(stream).toContain(": heartbeat");
        expect(stream).not.toContain("abc\nxyz");
      });

      server.publishEventForTest(auth.sessionId, "snapshot", { live: true });
      await vi.waitFor(() => expect(stream).toContain('"live":true'));
      response.destroy();
    } finally {
      server.server.closeAllConnections();
      await server.close();
    }
  });
});