import type { InteractionLanguage } from "@ai-assist/product-language";

export interface WorkbookImportIpcRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface WorkbookImportReceipt {
  readonly artifactId: string;
  readonly contentHash: string;
  readonly snapshotRevision: number;
  readonly state: string;
}

export interface WorkbenchProcessLauncher {
  launch(args: readonly string[]): Promise<{ readonly sessionId?: string; readonly url: string }>;
  importWorkbook?(input: WorkbookImportIpcRequest): Promise<WorkbookImportReceipt>;
  issueHostBearer?(input: { readonly sessionId: string; readonly actionId?: string; readonly hostInstanceId?: string; readonly scopes: readonly ("host-actions:claim" | "host-actions:result" | "sessions:read")[] }): Promise<string>;
}

export async function launchNewWorkbench(rootDir: string, process: WorkbenchProcessLauncher, interactionLanguage: InteractionLanguage): Promise<{ readonly sessionId: string; readonly url: string }> {
  const result = await process.launch(["agent", "analyze", "--root", rootDir, "--interaction-language", JSON.stringify(interactionLanguage)]);
  assertLoopbackUrl(result.url);
  if (result.sessionId === undefined || result.sessionId === "pending") throw new Error("Workbench launcher did not return a real session.");
  const url = new URL(result.url);
  if (url.searchParams.get("session") !== result.sessionId) throw new Error("Workbench launcher returned an unbound session URL.");
  return { sessionId: result.sessionId, url: result.url };
}

export async function launchWorkbench(rootDir: string, process: WorkbenchProcessLauncher): Promise<{ readonly url: string }> {
  const result = await process.launch(["agent", "workbench", "--root", rootDir]);
  assertLoopbackUrl(result.url);
  return { url: result.url };
}

export async function resumeWorkbench(rootDir: string, sessionId: string, process: WorkbenchProcessLauncher): Promise<{ readonly sessionId: string; readonly url: string }> {
  const result = await process.launch(["agent", "resume", "--root", rootDir, "--session", sessionId]);
  assertLoopbackUrl(result.url);
  if (result.sessionId !== sessionId) throw new Error("Workbench launcher returned a different session.");
  return { sessionId, url: result.url };
}

function assertLoopbackUrl(value: string): void {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new Error("Workbench launcher returned a non-loopback URL.");
}
