import { randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { join } from "node:path";

import { createConversationStore } from "@ai-assist/conversation";
import { handleAgentTurn } from "@ai-assist/agent-runtime";
import { openSessionStore } from "@ai-assist/workbench";
import * as vscode from "vscode";

import { syncConversationUnread } from "./conversation-sync.js";
import { createVsCodeLanguageModelAdapter } from "./language-model.js";
import { handleParticipant } from "./participant.js";
import { launchNewWorkbench, resumeWorkbench, type WorkbenchProcessLauncher } from "./workbench-launcher.js";
import { createSurfaceHostClient } from "./surface-host-client.js";
import { inspectSurfaceMcpCapabilities } from "@ai-assist/adapters";
import { pumpOneHostAction } from "./host-action-pump.js";

let activeSessionId: string | undefined;
let activeWorkbenchUrl: string | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot === undefined) return;
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.text = "TA Assist";
  status.command = "ta-assist.workbench";
  status.show();
  context.subscriptions.push(status);
  const processLauncher = createCliProcessLauncher(workspaceRoot);
  context.subscriptions.push({ dispose: () => processLauncher.dispose() });
  const conversation = await createConversationStore({ rootDir: join(workspaceRoot, "runtime", "workbench") });
  context.subscriptions.push({ dispose: () => { void conversation.close(); } });

  const openNew = async () => {
    const launched = await launchNewWorkbench(workspaceRoot, processLauncher);
    activeWorkbenchUrl = launched.url;
  };
  const resume = async (sessionId?: string) => {
    const selected = sessionId ?? await vscode.window.showInputBox({ prompt: "TA Assist session ID", ignoreFocusOut: true });
    if (selected === undefined || selected.trim().length === 0) return;
    const launched = await resumeWorkbench(workspaceRoot, selected.trim(), processLauncher);
    activeSessionId = launched.sessionId;
    activeWorkbenchUrl = launched.url;
    const sync = await syncConversationUnread({ sessionId: launched.sessionId, consumerId: `vscode:${vscode.env.machineId}`, store: conversation, status });
    await sync.markRead();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("ta-assist.analyze", openNew),
    vscode.commands.registerCommand("ta-assist.workbench", async () => activeWorkbenchUrl === undefined ? openNew() : vscode.env.openExternal(vscode.Uri.parse(activeWorkbenchUrl))),
    vscode.commands.registerCommand("ta-assist.resume", resume),
    vscode.commands.registerCommand("ta-assist.openAction", async (target: string) => {
      if (activeWorkbenchUrl === undefined) return;
      const url = new URL(activeWorkbenchUrl);
      url.hash = target;
      await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
    }),
    vscode.commands.registerCommand("ta-assist.executeHostAction", async () => {
      if (activeSessionId === undefined || activeWorkbenchUrl === undefined) {
        await vscode.window.showErrorMessage("请先绑定 TA Assist session。");
        return;
      }
      const actionId = await vscode.window.showInputBox({ prompt: "Host action ID", ignoreFocusOut: true });
      if (actionId === undefined || actionId.trim().length === 0) return;
      const hostInstanceId = `vscode-${vscode.env.machineId}`;
      const surface = createSurfaceHostClient({
        tools: vscode.lm.tools,
        async invoke(name, input) {
          const result = await vscode.lm.invokeTool(name, { input, toolInvocationToken: undefined });
          const text = result.content.map((part) => part instanceof vscode.LanguageModelTextPart ? part.value : "").join("");
          return { text };
        },
      });
      const claimBearer = await processLauncher.issueHostBearer!({ sessionId: activeSessionId, actionId: actionId.trim(), hostInstanceId, scopes: ["host-actions:claim"] });
      const resultBearer = await processLauncher.issueHostBearer!({ sessionId: activeSessionId, actionId: actionId.trim(), hostInstanceId, scopes: ["host-actions:result"] });
        await pumpOneHostAction({ sessionId: activeSessionId, actionId: actionId.trim() }, {
        hostInstanceId,
        claim: async (sessionId, targetActionId, hostId) => hostRequest(activeWorkbenchUrl!, sessionId, targetActionId, "claim", claimBearer, { hostInstanceId: hostId }),
        async execute(claim) {
          if (claim.request.kind === "surface_validate") {
            const capabilities = await inspectSurfaceMcpCapabilities(surface);
            if (!capabilities.ready) return { status: "blocked", reason: `Missing Surface MCP capabilities: ${capabilities.missing.join(", ")}` };
            const prepared = await (await import("@ai-assist/adapters")).createSurfaceMcpDrawingGovernanceAdapter(surface).prepare(claim.request.prepareRequest);
            return prepared.status === "blocked"
              ? { status: "blocked", reason: prepared.reasonCode }
              : { status: "completed", outcome: { kind: "surface_validation", confirmation: prepared } };
          }
          if (claim.request.kind === "surface_write") {
            const receipt = await (await import("@ai-assist/adapters")).createSurfaceMcpDrawingGovernanceAdapter(surface).execute(claim.request.confirmation);
            return { status: "completed", outcome: { kind: "surface_write", receipt } };
          }
          return { status: "blocked", reason: "Unsupported HostAction kind." };
        },
        submit: async (result) => { await hostRequest(activeWorkbenchUrl!, activeSessionId!, actionId.trim(), "result", resultBearer, { contractVersion: "f8-host-action-result-v1", ...result }); },
        });
      await vscode.window.showInformationMessage("Surface HostAction 已提交。Validation 后请再次执行生成的 ado-write action 完成独立确认。", { modal: false });
    }),
  );

  const participant = vscode.chat.createChatParticipant("ta-assist", async (request, chatContext, response, token) => {
    if (request.command === "analyze" || request.command === "workbench") {
      await openNew();
      response.markdown("TA Assist Workbench 已打开。完成 bootstrap 后可使用 `/resume` 绑定生成的 session ID。");
      return;
    }
    if (request.command === "resume") {
      await resume(request.prompt.trim() || undefined);
      response.markdown(activeSessionId === undefined ? "未绑定 session。" : `已绑定 TA Assist session ${activeSessionId}。`);
      return;
    }
    if (activeSessionId === undefined) {
      response.markdown("请先使用 `/analyze` 或 `/resume <session-id>` 绑定 TA Assist session。");
      return;
    }
    await handleParticipant(request, chatContext, response, token, {
      sessionId: activeSessionId,
      commandId: randomUUID,
      handleTurn: async (turn) => handleAgentTurn(turn, {
        snapshotStore: { async readSnapshot(sessionId) {
          const store = await openSessionStore({ rootDir: workspaceRoot, sessionId: sessionId ?? activeSessionId! });
          try { return await store.readSnapshot(); } finally { await store.close(); }
        } },
        conversationStore: conversation,
        ...(request.model === undefined ? {} : { model: createVsCodeLanguageModelAdapter({ model: request.model, token, createUserMessage: vscode.LanguageModelChatMessage.User }) }),
      }),
    });
  });
  context.subscriptions.push(participant);
}


export function deactivate(): void {}

function createCliProcessLauncher(workspaceRoot: string): WorkbenchProcessLauncher & { dispose(): void } {
  let child: ChildProcess | undefined;
  let origin: string | undefined;
  return {
    async launch(args) {
      const action = args[1];
      const requestedSession = args[args.indexOf("--session") + 1];
      if (origin !== undefined && child !== undefined && child.exitCode === null) {
        const url = action === "resume" && requestedSession !== undefined ? `${origin}/?session=${encodeURIComponent(requestedSession)}` : origin;
        return { ...(requestedSession === undefined ? {} : { sessionId: requestedSession }), url };
      }
      const cliPath = join(workspaceRoot, "apps", "cli", "dist", "index.js");
      const started = await startCliHost(process.execPath, [cliPath, "agent", "workbench", "--root", workspaceRoot], workspaceRoot);
      child = started.child;
      origin = new URL(started.url).origin;
      await assertWorkbenchReady(origin);
      const url = action === "resume" && requestedSession !== undefined ? `${origin}/?session=${encodeURIComponent(requestedSession)}` : origin;
      return { ...(requestedSession === undefined ? {} : { sessionId: requestedSession }), url };
    },
    async issueHostBearer(input) {
      if (child === undefined || child.connected !== true) throw new Error("Workbench host IPC is unavailable.");
      const requestId = randomUUID();
      return new Promise<string>((resolve, reject) => {
        const onMessage = (value: unknown) => {
          const response = value as { readonly type?: unknown; readonly requestId?: unknown; readonly token?: unknown };
          if (response.type !== "hostBearer" || response.requestId !== requestId || typeof response.token !== "string") return;
          child!.off("message", onMessage);
          resolve(response.token);
        };
        child!.on("message", onMessage);
        child!.send({ type: "issueHostBearer", requestId, ...input }, (error) => {
          if (error !== null) { child!.off("message", onMessage); reject(error); }
        });
      });
    },
    dispose() { child?.kill(); child = undefined; origin = undefined; },
  };
}

function startCliHost(command: string, args: readonly string[], cwd: string): Promise<{ readonly child: ChildProcess; readonly url: string }> {
  return new Promise((resolve, reject) => {
    const [modulePath, ...moduleArgs] = args;
    const child = fork(modulePath!, moduleArgs, { cwd, silent: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    child.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (!settled && /^url: .+$/m.test(stdout)) {
        settled = true;
        resolve({ child, url: outputUrl(stdout) });
      }
    });
    child.stderr!.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("error", (error) => { if (!settled) reject(error); });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      return reject(new Error(stderr || `CLI exited before readiness with ${code}.`));
    });
  });
}

async function hostRequest(originValue: string, sessionId: string, actionId: string, operation: "claim" | "result", bearer: string, body: unknown): Promise<any> {
  const origin = new URL(originValue).origin;
  const response = await fetch(`${origin}/api/sessions/${encodeURIComponent(sessionId)}/host-actions/${encodeURIComponent(actionId)}/${operation}`, {
    method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HostAction ${operation} was rejected (${response.status}).`);
  return response.status === 204 ? undefined : response.json();
}

function outputUrl(stdout: string): string {
  const value = stdout.match(/^url: (.+)$/m)?.[1];
  if (value === undefined) throw new Error("CLI did not return a Workbench URL.");
  return value;
}

async function assertWorkbenchReady(origin: string): Promise<void> {
  const response = await fetch(`${origin}/workbench.js`, { headers: { host: new URL(origin).host } });
  if (!response.ok) throw new Error("Workbench host failed its readiness probe.");
}
