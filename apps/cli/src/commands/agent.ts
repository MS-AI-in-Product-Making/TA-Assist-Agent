export type AgentCliAction = "analyze" | "resume" | "status" | "workbench";

export type AgentCliRequest = {
  readonly action: "resume" | "status";
  readonly rootDir: string;
  readonly sessionId: string;
} | {
  readonly action: "analyze" | "workbench";
  readonly rootDir: string;
};

export interface AgentLauncher {
  analyze(rootDir: string): Promise<{ readonly sessionId: string; readonly url: string }>;
  resume(rootDir: string, sessionId: string): Promise<{ readonly sessionId: string; readonly url: string }>;
  status(rootDir: string, sessionId: string): Promise<{ readonly sessionId: string; readonly url: string }>;
  workbench(rootDir: string): Promise<{ readonly sessionId: string; readonly url: string }>;
}

export async function runAgentCommand(request: AgentCliRequest, launcher: Partial<AgentLauncher>): Promise<string> {
  let result: { readonly sessionId: string; readonly url: string };
  switch (request.action) {
    case "analyze":
      if (launcher.analyze === undefined) throw new Error("dependency_error: Workbench launcher is unavailable");
      result = await launcher.analyze(request.rootDir);
      break;
    case "workbench":
      if (launcher.workbench === undefined) throw new Error("dependency_error: Workbench launcher is unavailable");
      result = await launcher.workbench(request.rootDir);
      break;
    case "resume":
      if (launcher.resume === undefined) throw new Error("dependency_error: Workbench launcher is unavailable");
      result = await launcher.resume(request.rootDir, request.sessionId);
      break;
    case "status":
      if (launcher.status === undefined) throw new Error("dependency_error: Workbench launcher is unavailable");
      result = await launcher.status(request.rootDir, request.sessionId);
      break;
  }
  const browserCreatesSession = result.sessionId === "pending";
  const url = sanitizeWorkbenchUrl(result.url, browserCreatesSession ? undefined : result.sessionId);
  return `session: ${browserCreatesSession ? "created-in-browser" : result.sessionId}\nurl: ${url}\n`;
}

function sanitizeWorkbenchUrl(value: string, sessionId: string | undefined): string {
  const parsed = new URL(value);
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("policy_denied: Workbench URL must be loopback");
  }
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (key !== "session") parsed.searchParams.delete(key);
  }
  if (sessionId !== undefined) parsed.searchParams.set("session", sessionId);
  return parsed.toString();
}
