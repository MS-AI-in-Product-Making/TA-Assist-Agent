import { describe, expect, it } from "vitest";

import { createBrowserBootstrapRendezvous, renderBootstrapPage, renderBootstrapScript } from "./bootstrap.js";

describe("browser bootstrap rendezvous", () => {
  it("issues 128-bit one-time nonces with expiry", async () => {
    let now = new Date("2026-08-25T00:00:00.000Z");
    const rendezvous = createBrowserBootstrapRendezvous({ ttlMs: 1_000, now: () => now });
    const nonce = await rendezvous.issueBrowserBootstrap();

    expect(Buffer.from(nonce, "base64url")).toHaveLength(16);
    expect(await rendezvous.consumeBrowserBootstrap(nonce)).toBe(true);
    expect(await rendezvous.consumeBrowserBootstrap(nonce)).toBe(false);

    const expired = await rendezvous.issueBrowserBootstrap();
    now = new Date("2026-08-25T00:00:02.000Z");
    expect(await rendezvous.consumeBrowserBootstrap(expired)).toBe(false);
  });

  it("bootstrap script removes the fragment before posting without inline CSP exceptions", () => {
    const page = renderBootstrapPage();
    const script = renderBootstrapScript();

    expect(page).toContain('<script src="/bootstrap.js"></script>');
    expect(page).not.toContain("<script>");
    expect(script).toContain("location.hash");
    expect(script).toContain("history.replaceState");
    expect(script.indexOf("history.replaceState")).toBeLessThan(script.indexOf("fetch('/api/bootstrap'"));
    expect(page).not.toContain("localStorage");
    expect(script).not.toContain("localStorage");
  });
});