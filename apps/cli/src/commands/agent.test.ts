import { describe, expect, it, vi } from "vitest";

import { runAgentCommand } from "./agent.js";
import { resolveBrowserArgs, resolveBrowserCommand } from "./agent-launcher.js";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";

describe("runAgentCommand", () => {
  it("resumes the same Workbench session without printing bootstrap credentials", async () => {
    const resume = vi.fn(async () => ({ sessionId: SESSION_ID, url: `http://127.0.0.1:4317/?session=${SESSION_ID}` }));
    const result = await runAgentCommand({ action: "resume", rootDir: "repo", sessionId: SESSION_ID }, { resume });

    expect(resume).toHaveBeenCalledWith("repo", SESSION_ID);
    expect(result).toContain(`session: ${SESSION_ID}`);
    expect(result).toContain(`http://127.0.0.1:4317/?session=${SESSION_ID}`);
    expect(result).not.toMatch(/bootstrap|token|nonce/i);
  });

  it("starts analyze and workbench through the shared launcher", async () => {
    const analyze = vi.fn(async () => ({ sessionId: SESSION_ID, url: "http://127.0.0.1:4317/" }));
    const workbench = vi.fn(async () => ({ sessionId: SESSION_ID, url: "http://127.0.0.1:4317/" }));

    await runAgentCommand({ action: "analyze", rootDir: "repo" }, { analyze, workbench });
    await runAgentCommand({ action: "workbench", rootDir: "repo" }, { analyze, workbench });

    expect(analyze).toHaveBeenCalledWith("repo");
    expect(workbench).toHaveBeenCalledWith("repo");
  });

  it("does not print the browser-created pending marker as a session query", async () => {
    const result = await runAgentCommand({ action: "workbench", rootDir: "repo" }, { workbench: async () => ({ sessionId: "pending", url: "http://127.0.0.1:4317/" }) });
    expect(result).toContain("session: created-in-browser");
    expect(result).toContain("url: http://127.0.0.1:4317/");
    expect(result).not.toContain("session=pending");
  });

  it("launches Chromium directly on Windows so the bootstrap fragment is preserved", () => {
    const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    expect(resolveBrowserCommand("win32", (path) => path === edge)).toBe(edge);
    expect(resolveBrowserCommand("win32", () => false)).toBe("explorer.exe");
    expect(resolveBrowserArgs("win32", edge, "http://127.0.0.1:4317/#bootstrap=nonce")).toEqual(["--new-window", "http://127.0.0.1:4317/#bootstrap=nonce"]);
  });
});
