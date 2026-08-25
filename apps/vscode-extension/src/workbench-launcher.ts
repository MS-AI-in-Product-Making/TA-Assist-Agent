export interface WorkbenchProcessLauncher {
  launch(args: readonly string[]): Promise<{ readonly sessionId?: string; readonly url: string }>;
  issueHostBearer?(input: { readonly sessionId: string; readonly actionId: string; readonly hostInstanceId: string; readonly scopes: readonly ("host-actions:claim" | "host-actions:result")[] }): Promise<string>;
}

export async function launchNewWorkbench(rootDir: string, process: WorkbenchProcessLauncher): Promise<{ readonly url: string }> {
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
