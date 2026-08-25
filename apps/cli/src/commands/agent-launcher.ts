import { startWorkbenchServer } from "@ai-assist/workbench-server";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { runAgentCommand, type AgentCliRequest, type AgentLauncher } from "./agent.js";

export async function runDefaultAgentCommand(request: AgentCliRequest): Promise<string> {
  return runAgentCommand(request, createLauncher());
}

function createLauncher(): AgentLauncher {
  const start = async (rootDir: string) => {
    const started = await startWorkbenchServer({ rootDir, port: 0 });
    registerHostCredentialIpc(started.server);
    openBrowser(started.url);
    return { sessionId: "pending", url: new URL(started.url).origin };
  };
  const resume = async (rootDir: string, sessionId: string) => {
    const started = await startWorkbenchServer({ rootDir, port: 0 });
    registerHostCredentialIpc(started.server);
    const origin = new URL(started.url).origin;
    const url = `${origin}/?session=${encodeURIComponent(sessionId)}`;
    openBrowser(url);
    return { sessionId, url };
  };
  return {
    analyze: start,
    workbench: start,
    resume,
    status: resume,
  };
}

function registerHostCredentialIpc(server: Awaited<ReturnType<typeof startWorkbenchServer>>["server"]): void {
  if (typeof process.send !== "function") return;
  process.on("message", (value: unknown) => {
    const request = value as { readonly type?: unknown; readonly requestId?: unknown; readonly sessionId?: unknown; readonly actionId?: unknown; readonly hostInstanceId?: unknown; readonly scopes?: unknown };
    if (request.type !== "issueHostBearer" || typeof request.requestId !== "string" || typeof request.sessionId !== "string" || typeof request.actionId !== "string" || typeof request.hostInstanceId !== "string" || !Array.isArray(request.scopes)) return;
    const scopes = request.scopes.filter((scope): scope is "host-actions:claim" | "host-actions:result" => scope === "host-actions:claim" || scope === "host-actions:result");
    if (scopes.length !== request.scopes.length || scopes.length === 0) return;
    const token = server.issueHostBearer(request.sessionId, scopes, { actionId: request.actionId, hostInstanceId: request.hostInstanceId });
    process.send?.({ type: "hostBearer", requestId: request.requestId, token });
  });
}

function openBrowser(url: string): void {
  const command = resolveBrowserCommand(process.platform, existsSync);
  const args = resolveBrowserArgs(process.platform, command, url);
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

export function resolveBrowserArgs(platform: NodeJS.Platform, command: string, url: string): string[] {
  return platform === "win32" && command !== "explorer.exe" ? ["--new-window", url] : [url];
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
