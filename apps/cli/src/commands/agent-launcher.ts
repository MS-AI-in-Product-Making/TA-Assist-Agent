import type { AnalysisRequestContext } from "@ai-assist/contracts";
import { createSessionStore } from "@ai-assist/workbench";
import { startWorkbenchServer, type StartWorkbenchServerOptions } from "@ai-assist/workbench-server";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runAgentCommand, type AgentCliRequest, type AgentLauncher } from "./agent.js";
import type { InteractionLanguage } from "@ai-assist/product-language";

export async function runDefaultAgentCommand(request: AgentCliRequest): Promise<string> {
  return runAgentCommand(request, createLauncher());
}

function createLauncher(): AgentLauncher {
  return createLauncherForTest({
    startWorkbenchServer,
    openBrowser,
  });
}

export function createLauncherForTest(dependencies: {
  readonly startWorkbenchServer: (options: StartWorkbenchServerOptions) => ReturnType<typeof startWorkbenchServer>;
  readonly openBrowser: (url: string) => void;
}): AgentLauncher {
  const start = async (rootDir: string, interactionLanguage: InteractionLanguage) => {
    const started = await dependencies.startWorkbenchServer({ rootDir, port: 0, interactionLanguage });
    registerHostCredentialIpc(started.server);
    dependencies.openBrowser(started.url);
    return { sessionId: "pending", url: new URL(started.url).origin };
  };
  const analyze = async (rootDir: string, interactionLanguage: InteractionLanguage, analysisRequestContext: AnalysisRequestContext) => {
    const sessionId = randomUUID();
    const store = await createSessionStore({
      rootDir,
      sessionId,
      interactionLanguage,
      analysisRequestContext,
    });
    await store.close();
    const started = await dependencies.startWorkbenchServer({ rootDir, port: 0, resumeSessionId: sessionId });
    registerHostCredentialIpc(started.server);
    dependencies.openBrowser(started.url);
    return { sessionId, url: started.url };
  };
  const resume = async (rootDir: string, sessionId: string) => {
    const started = await dependencies.startWorkbenchServer({ rootDir, port: 0, resumeSessionId: sessionId });
    registerHostCredentialIpc(started.server);
    const origin = new URL(started.url).origin;
    const url = `${origin}/?session=${encodeURIComponent(sessionId)}#bootstrap=${started.bootstrapNonce}`;
    dependencies.openBrowser(url);
    return { sessionId, url };
  };
  return {
    analyze,
    workbench: start,
    resume,
    status: resume,
  };
}

function registerHostCredentialIpc(server: Awaited<ReturnType<typeof startWorkbenchServer>>["server"]): void {
  if (typeof process.send !== "function") return;
  process.on("message", (value: unknown) => { void handleWorkbenchHostIpcMessage(server, value, process.send!.bind(process)); });
}

export async function handleWorkbenchHostIpcMessage(server: Awaited<ReturnType<typeof startWorkbenchServer>>["server"], value: unknown, send: (message: unknown) => void): Promise<void> {
  const request = value as { readonly type?: unknown; readonly requestId?: unknown; readonly sessionId?: unknown; readonly actionId?: unknown; readonly hostInstanceId?: unknown; readonly scopes?: unknown; readonly fileName?: unknown; readonly bytes?: unknown; readonly workbookPath?: unknown };
  if (request.type === "issueHostBearer" && typeof request.requestId === "string" && typeof request.sessionId === "string" && Array.isArray(request.scopes)) {
    const scopes = request.scopes.filter((scope): scope is "host-actions:claim" | "host-actions:result" | "sessions:read" => scope === "host-actions:claim" || scope === "host-actions:result" || scope === "sessions:read");
    if (scopes.length !== request.scopes.length || scopes.length === 0) return;
    const actionBound = scopes.some((scope) => scope === "host-actions:claim" || scope === "host-actions:result");
    if (actionBound && (typeof request.actionId !== "string" || typeof request.hostInstanceId !== "string")) return;
    const token = server.issueHostBearer(request.sessionId, scopes, actionBound ? { actionId: request.actionId as string, hostInstanceId: request.hostInstanceId as string } : {});
    send({ type: "hostBearer", requestId: request.requestId, token });
    return;
  }

  if (request.type !== "importWorkbook" || typeof request.requestId !== "string") return;
  try {
    if (typeof request.sessionId !== "string" || typeof request.fileName !== "string" || !(request.bytes instanceof Uint8Array) || request.workbookPath !== undefined) {
      throw Object.assign(new Error("Host workbook import rejected."), { code: "validation_error", summary: "Host workbook import rejected.", suggestedAction: "Retry the workbook import from the VS Code host.", affectedInputReferences: ["host_import_rejected"] });
    }
    const receipt = await server.importHostWorkbook({ requestId: request.requestId, sessionId: request.sessionId, fileName: request.fileName, bytes: request.bytes });
    send({ type: "importWorkbookResult", requestId: request.requestId, ok: true, receipt });
  } catch (error) {
    send({ type: "importWorkbookResult", requestId: request.requestId, ok: false, error: sanitizedIpcError(error) });
  }
}

function sanitizedIpcError(error: unknown): { readonly code: string; readonly summary: string; readonly suggestedAction: string; readonly affectedInputReferences: readonly string[] } {
  const typed = error as { readonly code?: unknown; readonly summary?: unknown; readonly suggestedAction?: unknown; readonly affectedInputReferences?: unknown };
  return {
    code: typeof typed.code === "string" ? typed.code : "dependency_error",
    summary: typeof typed.summary === "string" ? typed.summary : "Host workbook import failed.",
    suggestedAction: typeof typed.suggestedAction === "string" ? typed.suggestedAction : "Retry the workbook import from the VS Code host.",
    affectedInputReferences: Array.isArray(typed.affectedInputReferences) ? typed.affectedInputReferences.filter((value): value is string => typeof value === "string" && !value.includes(":\\")) : [],
  };
}

function openBrowser(url: string): void {
  const command = resolveBrowserCommand(process.platform, existsSync);
  const profileRoot = process.platform === "win32" && command !== "explorer.exe" ? mkdtempSync(join(tmpdir(), "ta-assist-browser-")) : undefined;
  const args = resolveBrowserArgs(process.platform, command, url, profileRoot);
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

export function resolveBrowserArgs(platform: NodeJS.Platform, command: string, url: string, profileRoot?: string): string[] {
  return platform === "win32" && command !== "explorer.exe"
    ? ["--new-window", "--no-first-run", ...(profileRoot === undefined ? [] : [`--user-data-dir=${profileRoot}`]), url]
    : [url];
}

export function resolveBrowserCommand(platform: NodeJS.Platform, exists: (path: string) => boolean): string {
  if (platform !== "win32") return platform === "darwin" ? "open" : "xdg-open";
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  return candidates.find(exists) ?? "explorer.exe";
}
