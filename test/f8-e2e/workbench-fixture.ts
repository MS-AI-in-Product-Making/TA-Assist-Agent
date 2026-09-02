import { createHash, randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { readFile, rm } from "node:fs/promises";

import { test as base, expect, type BrowserContext } from "@playwright/test";
import { ANONYMOUS_WORKBOOK_RELATIVE_PATH, ensureAnonymousWorkbookFixture } from "./fixtures/anonymous-workbook-fixture.ts";

interface Fixtures {
  workbench: { readonly child: ChildProcess; readonly origin: string; readonly sessionId: string; readonly rootDir: string; readonly sourceWorkbook: string; issueBootstrap(sessionId?: string): Promise<string>; issueHostBearer(input: HostBearerInput): Promise<string>; seedConversationTurn(input: SeedConversationInput): Promise<void> };
}

interface HostBearerInput {
  readonly sessionId: string;
  readonly scopes: readonly string[];
  readonly actionId?: string;
  readonly hostInstanceId?: string;
}

interface SeedConversationInput {
  readonly sessionId: string;
  readonly turnId: string;
  readonly sequence: number;
}

interface WorkerFixtures {
  workbenchServer: { readonly child: ChildProcess; readonly origin: string; readonly sessionId: string; readonly rootDir: string };
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  workbenchServer: [async ({}, use) => {
    await ensureAnonymousWorkbookFixture();
    const child = fork("test/f8-e2e/server.mjs", [], { cwd: process.cwd(), silent: true });
    const started = await readStartup(child);
    try {
      await use({ child, ...started });
    } finally {
      await stopChild(child);
      await rm(started.rootDir, { recursive: true, force: true });
    }
  }, { scope: "worker" }],
  workbench: async ({ context, workbenchServer }, use) => {
    await installBrowserCookie(context, workbenchServer.origin, await readCookie(workbenchServer.child));
    await use({
      ...workbenchServer,
      sourceWorkbook: ANONYMOUS_WORKBOOK_RELATIVE_PATH,
      issueBootstrap: (sessionId) => issueBootstrap(workbenchServer.child, sessionId),
      issueHostBearer: (input) => issueHostBearer(workbenchServer.child, input),
      seedConversationTurn: (input) => seedConversationTurn(workbenchServer.child, input),
    });
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

async function readCookie(child: ChildProcess, sessionId?: string): Promise<string> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (value: unknown) => {
      const message = value as { type?: unknown; requestId?: unknown; cookie?: unknown };
      if (message.type !== "cookie" || message.requestId !== requestId || typeof message.cookie !== "string") return;
      child.off("message", onMessage);
      resolve(message.cookie);
    };
    child.on("message", onMessage);
    child.send?.({ type: "readCookie", requestId, ...(sessionId === undefined ? {} : { sessionId }) }, (error) => { if (error !== null) { child.off("message", onMessage); reject(error); } });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill();
  await exited;
}

async function issueBootstrap(child: ChildProcess, sessionId?: string): Promise<string> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (value: unknown) => {
      const message = value as { type?: unknown; requestId?: unknown; nonce?: unknown };
      if (message.type !== "bootstrap" || message.requestId !== requestId || typeof message.nonce !== "string") return;
      child.off("message", onMessage);
      resolve(message.nonce);
    };
    child.on("message", onMessage);
    child.send?.({ type: "issueBootstrap", requestId, ...(sessionId === undefined ? {} : { sessionId }) }, (error) => { if (error !== null) { child.off("message", onMessage); reject(error); } });
  });
}

async function issueHostBearer(child: ChildProcess, input: HostBearerInput): Promise<string> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (value: unknown) => {
      const message = value as { type?: unknown; requestId?: unknown; token?: unknown };
      if (message.type !== "hostBearer" || message.requestId !== requestId || typeof message.token !== "string") return;
      child.off("message", onMessage);
      resolve(message.token);
    };
    child.on("message", onMessage);
    child.send?.({ type: "issueHostBearer", requestId, ...input }, (error) => { if (error !== null) { child.off("message", onMessage); reject(error); } });
  });
}

async function seedConversationTurn(child: ChildProcess, input: SeedConversationInput): Promise<void> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (value: unknown) => {
      const message = value as { type?: unknown; requestId?: unknown; error?: unknown };
      if (message.type !== "seedConversationTurn" || message.requestId !== requestId) return;
      child.off("message", onMessage);
      if (typeof message.error === "string") reject(new Error(message.error));
      else resolve();
    };
    child.on("message", onMessage);
    child.send?.({ type: "seedConversationTurn", requestId, ...input }, (error) => { if (error !== null) { child.off("message", onMessage); reject(error); } });
  });
}

export async function installSessionCookie(context: BrowserContext, origin: string, child: ChildProcess, sessionId: string) {
  await installBrowserCookie(context, origin, await readCookie(child, sessionId));
}

async function installBrowserCookie(context: BrowserContext, origin: string, cookieHeader: string) {
  const value = cookieHeader.match(/ta_session=([^;]+)/)?.[1];
  if (value === undefined) throw new Error("test browser cookie missing");
  await context.addCookies([{ name: "ta_session", value, url: origin, httpOnly: true, sameSite: "Strict" }]);
}

export async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
