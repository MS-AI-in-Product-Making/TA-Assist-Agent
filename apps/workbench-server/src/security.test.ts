import { describe, expect, it } from "vitest";

import { buildWorkbenchServer } from "./server.js";
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

      const first = await server.inject({ method: "POST", url: "/api/bootstrap", headers: { host: "127.0.0.1:0" }, payload: { nonce } });
      expect(first.statusCode).toBe(204);
      expect(first.cookies.some((cookie) => cookie.name === "ta_session" && cookie.httpOnly)).toBe(true);

      await expect(server.inject({ method: "POST", url: "/api/bootstrap", headers: { host: "127.0.0.1:0" }, payload: { nonce } }))
        .resolves.toMatchObject({ statusCode: 401 });
    } finally {
      await server.close();
    }
  });
});