import { createHash, randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { readFile, rm } from "node:fs/promises";

import { test as base, expect, type BrowserContext } from "@playwright/test";

interface Fixtures {
  workbench: { readonly child: ChildProcess; readonly origin: string; readonly sessionId: string; readonly rootDir: string; readonly sourceWorkbook: string; issueBootstrap(): Promise<string> };
}

export const test = base.extend<Fixtures>({
  workbench: async ({ context }, use) => {
    const child = fork("test/f8-e2e/server.mjs", [], { cwd: process.cwd(), silent: true });
    const started = await readStartup(child);
    await installBrowserCookie(context, started.origin, await readCookie(child));
    try {
      await use({ child, ...started, sourceWorkbook: "test/f8-e2e/fixtures/anonymous-ta-workbook.xlsx", issueBootstrap: () => issueBootstrap(child) });
    } finally {
      await stopChild(child);
      await rm(started.rootDir, { recursive: true, force: true });
    }
  },
});

export { expect };

async function readStartup(child: ChildProcess): Promise<{ origin: string; sessionId: string; rootDir: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      const line = stdout.split(/\r?\n/).find((candidate) => candidate.startsWith("{"));
      if (line !== undefined) resolve(JSON.parse(line));
    });
    child.stderr!.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("exit", (code) => reject(new Error(stderr || `E2E server exited before readiness (${code}).`)));
    child.once("error", reject);
  });
}

async function readCookie(child: ChildProcess): Promise<string> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (value: unknown) => {
      const message = value as { type?: unknown; requestId?: unknown; cookie?: unknown };
      if (message.type !== "cookie" || message.requestId !== requestId || typeof message.cookie !== "string") return;
      child.off("message", onMessage);
      resolve(message.cookie);
    };
    child.on("message", onMessage);
    child.send?.({ type: "readCookie", requestId }, (error) => { if (error !== null) { child.off("message", onMessage); reject(error); } });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill();
  await exited;
}

async function issueBootstrap(child: ChildProcess): Promise<string> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (value: unknown) => {
      const message = value as { type?: unknown; requestId?: unknown; nonce?: unknown };
      if (message.type !== "bootstrap" || message.requestId !== requestId || typeof message.nonce !== "string") return;
      child.off("message", onMessage);
      resolve(message.nonce);
    };
    child.on("message", onMessage);
    child.send?.({ type: "issueBootstrap", requestId }, (error) => { if (error !== null) { child.off("message", onMessage); reject(error); } });
  });
}

async function installBrowserCookie(context: BrowserContext, origin: string, cookieHeader: string) {
  const value = cookieHeader.match(/ta_session=([^;]+)/)?.[1];
  if (value === undefined) throw new Error("test browser cookie missing");
  await context.addCookies([{ name: "ta_session", value, url: origin, httpOnly: true, sameSite: "Strict" }]);
}

export async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
