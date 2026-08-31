import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openSessionStore } from "@ai-assist/workbench";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runAgentCommand } from "./agent.js";
import { createLauncherForTest, handleWorkbenchHostIpcMessage, resolveBrowserArgs, resolveBrowserCommand } from "./agent-launcher.js";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agent-launcher-"));
  tempRoots.push(root);
  return root;
}

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

  it("creates a real SessionStore snapshot before analyze launches the browser", async () => {
    const rootDir = await tempRoot();
    const startedServers: { close(): Promise<void> }[] = [];
    const openedUrls: string[] = [];
    const launcher = createLauncherForTest({
      startWorkbenchServer: async (options) => {
        expect(options.resumeSessionId).toEqual(expect.any(String));
        const store = await openSessionStore({ rootDir, sessionId: options.resumeSessionId! });
        try {
          const snapshot = await store.readSnapshot();
          expect(snapshot).toMatchObject({ sessionId: options.resumeSessionId, revision: 0, state: "created" });
        } finally {
          await store.close();
        }
        const server = { close: vi.fn(async () => undefined) };
        startedServers.push(server);
        return { server, url: `http://127.0.0.1:4317/?session=${options.resumeSessionId}#bootstrap=nonce`, bootstrapNonce: "nonce" };
      },
      openBrowser: (url) => { openedUrls.push(url); },
    });

    const result = await runAgentCommand({ action: "analyze", rootDir }, launcher);
    const sessionId = result.match(/^session: (.+)$/m)?.[1];

    expect(sessionId).toMatch(/[0-9a-f-]{36}/);
    expect(sessionId).not.toBe("pending");
    expect(result).toContain(`url: http://127.0.0.1:4317/?session=${sessionId}`);
    expect(openedUrls).toEqual([`http://127.0.0.1:4317/?session=${sessionId}#bootstrap=nonce`]);
    await Promise.all(startedServers.map((server) => server.close()));
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
    expect(resolveBrowserArgs("win32", edge, "http://127.0.0.1:4317/#bootstrap=nonce", "C:\\Temp\\profile")).toEqual(["--new-window", "--no-first-run", "--user-data-dir=C:\\Temp\\profile", "http://127.0.0.1:4317/#bootstrap=nonce"]);
  });

  it("dispatches byte-only host workbook imports over IPC without accepting local paths", async () => {
    const server = {
      importHostWorkbook: vi.fn(async () => ({ artifactId: "artifact-1", contentHash: "a".repeat(64), snapshotRevision: 1, state: "f0_validating" })),
    };
    const send = vi.fn();

    await handleWorkbenchHostIpcMessage(server as never, {
      type: "importWorkbook",
      requestId: "request-1",
      sessionId: SESSION_ID,
      fileName: "report.xlsx",
      bytes: new Uint8Array([80, 75, 3, 4]),
    }, send);

    expect(server.importHostWorkbook).toHaveBeenCalledWith({ requestId: "request-1", sessionId: SESSION_ID, fileName: "report.xlsx", bytes: new Uint8Array([80, 75, 3, 4]) });
    expect(send).toHaveBeenCalledWith({ type: "importWorkbookResult", requestId: "request-1", ok: true, receipt: { artifactId: "artifact-1", contentHash: "a".repeat(64), snapshotRevision: 1, state: "f0_validating" } });
  });

  it("rejects host workbook IPC messages that include a path and returns a sanitized error", async () => {
    const server = { importHostWorkbook: vi.fn() };
    const send = vi.fn();

    await handleWorkbenchHostIpcMessage(server as never, {
      type: "importWorkbook",
      requestId: "request-1",
      sessionId: SESSION_ID,
      fileName: "report.xlsx",
      workbookPath: "C:\\secret\\report.xlsx",
      bytes: new Uint8Array([80, 75, 3, 4]),
    }, send);

    expect(server.importHostWorkbook).not.toHaveBeenCalled();
    expect(JSON.stringify(send.mock.calls)).not.toContain("C:\\secret");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "importWorkbookResult", requestId: "request-1", ok: false }));
  });
});
