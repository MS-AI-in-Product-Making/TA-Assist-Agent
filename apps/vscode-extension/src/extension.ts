import { randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { join } from "node:path";

import { createConversationStore } from "@ai-assist/conversation";
import { handleAgentTurn } from "@ai-assist/agent-runtime";
import { openSessionStore } from "@ai-assist/workbench";
import { detectExplicitLanguageTag, inputMetadata, resolveInteractionLanguage, type InteractionLanguage, type UiCatalogLanguage } from "@ai-assist/product-language";
import * as vscode from "vscode";

import { syncConversationUnread } from "./conversation-sync.js";
import { createVsCodeLanguageModelAdapter } from "./language-model.js";
import { buildVsCodeModelUserMessage } from "./model-host-prompt.js";
import { handleParticipant } from "./participant.js";
import { launchNewWorkbench, launchWorkbench, resumeWorkbench, type WorkbenchProcessLauncher } from "./workbench-launcher.js";
import { importWorkbook } from "./workbook-import.js";
import type { TaAnalyzeIntent } from "./analyze-intent.js";
import { createSurfaceHostClient, reconcileSurfaceWrite } from "./surface-host-client.js";
import { pumpOneHostAction, type ClaimedHostAction } from "./host-action-pump.js";
import { executeSurfaceValidation } from "./surface-validation.js";
import { resolveWorkspaceWorkbook } from "./workspace-workbook-resolver.js";

let activeSessionId: string | undefined;
let activeWorkbenchUrl: string | undefined;
const HOST_BINDING_KEY = "ta-assist.hostBinding";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot === undefined) return;
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.text = "TA Assist";
  status.command = "ta-assist.workbench";
  status.show();
  context.subscriptions.push(status);
  const cliUri = vscode.Uri.joinPath(context.extensionUri, "runtime", "cli", "index.cjs");
  const processLauncher = createCliProcessLauncher(workspaceRoot, cliUri.fsPath);
  context.subscriptions.push({ dispose: () => processLauncher.dispose() });
  const conversation = await createConversationStore({ rootDir: join(workspaceRoot, "runtime", "workbench") });
  context.subscriptions.push({ dispose: () => { void conversation.close(); } });
  const restoredBinding = context.globalState.get<{ readonly sessionId: string; readonly workbenchUrl: string }>(HOST_BINDING_KEY);
  if (restoredBinding !== undefined && isLoopbackWorkbenchUrl(restoredBinding.workbenchUrl)) {
    activeSessionId = restoredBinding.sessionId;
    activeWorkbenchUrl = restoredBinding.workbenchUrl;
  }
  let activeInteractionLanguage: InteractionLanguage | undefined;
  let hostPumpRunning = false;

  const readSessionLanguage = async (sessionId: string): Promise<InteractionLanguage> => {
    const store = await openSessionStore({ rootDir: workspaceRoot, sessionId });
    const snapshot = await store.readSnapshot().finally(async () => store.close());
    return snapshot.interactionLanguage;
  };

  const executeHostAction = async (actionId: string) => {
    if (activeSessionId === undefined || activeWorkbenchUrl === undefined) return;
    const sessionId = activeSessionId;
    const workbenchUrl = activeWorkbenchUrl;
    const hostInstanceId = `vscode-${vscode.env.machineId}`;
    const surface = createSurfaceHostClient({
      tools: vscode.lm.tools,
      async invoke(name, input) {
        const result = await vscode.lm.invokeTool(name, { input, toolInvocationToken: undefined });
        const text = result.content.map((part) => part instanceof vscode.LanguageModelTextPart ? part.value : "").join("");
        return { text };
      },
    });
    const claimBearer = await processLauncher.issueHostBearer!({ sessionId, actionId, hostInstanceId, scopes: ["host-actions:claim"] });
    const resultBearer = await processLauncher.issueHostBearer!({ sessionId, actionId, hostInstanceId, scopes: ["host-actions:result"] });
    await pumpOneHostAction({ sessionId, actionId }, {
      hostInstanceId,
      claim: async (targetSessionId, targetActionId, hostId) => hostRequest<ClaimedHostAction>(workbenchUrl, targetSessionId, targetActionId, "claim", claimBearer, { hostInstanceId: hostId }),
      async execute(claim) {
        if (claim.request.kind === "surface_validate") {
          return executeSurfaceValidation(surface, claim.request.prepareRequest);
        }
        if (claim.request.kind === "surface_write") {
          const receipt = await (await import("@ai-assist/adapters")).createSurfaceMcpDrawingGovernanceAdapter(surface).execute(claim.request.confirmation);
          return { status: "completed", outcome: { kind: "surface_write", receipt } };
        }
        if (claim.request.kind === "surface_reconcile") {
          const reconciliation = await reconcileSurfaceWrite(surface, {
            workItemReference: claim.request.confirmation.workItemReference,
            previewMarker: claim.request.previewIdentity.previewMarker,
            previewHash: claim.request.previewIdentity.previewHash,
            expectedTarget: claim.request.previewIdentity.targetIdentity,
          });
          if (reconciliation.state === "completed") {
            return {
              status: "completed",
              outcome: {
                kind: "surface_reconcile",
                state: "matching",
                receipt: {
                  status: "updated",
                  workItemReference: claim.request.confirmation.workItemReference,
                  commentReference: reconciliation.observedCommentReference,
                  version: reconciliation.observedCommentVersion,
                  contentHash: claim.request.previewIdentity.previewHash,
                },
                observedCommentReference: reconciliation.observedCommentReference,
                observedCommentVersion: reconciliation.observedCommentVersion,
              },
            };
          }
          if (reconciliation.state === "absent") {
            return { status: "completed", outcome: { kind: "surface_reconcile", state: "absent" } };
          }
          return { status: "blocked", reason: reconciliation.reason };
        }
        if (claim.request.kind === "vscode_model_request") {
          const models = await vscode.lm.selectChatModels();
          const model = models[0];
          if (model === undefined) return { status: "blocked", reason: "No VS Code language model is available." };
          const response = await model.sendRequest([vscode.LanguageModelChatMessage.User(buildVsCodeModelUserMessage(claim.request.prompt))], {});
          let responseText = "";
          for await (const chunk of response.text) responseText += chunk;
          return responseText.trim().length === 0 ? { status: "failed", error: new Error("VS Code model returned an empty response.") } : { status: "completed", outcome: { kind: "model_response", turnId: claim.request.turnId, responseText } };
        }
        return { status: "blocked", reason: "Unsupported HostAction kind." };
      },
      submit: async (result) => { await hostRequest<void>(workbenchUrl, sessionId, actionId, "result", resultBearer, { contractVersion: "f8-host-action-result-v1", ...result }); },
    });
  };

  const pollHostActions = async () => {
    if (hostPumpRunning || activeSessionId === undefined || activeWorkbenchUrl === undefined) return;
    hostPumpRunning = true;
    try {
      const bearer = await processLauncher.issueHostBearer!({ sessionId: activeSessionId, scopes: ["sessions:read"] });
      const pending = await readPendingHostAction(activeWorkbenchUrl, activeSessionId, bearer);
      if (pending !== undefined) await executeHostAction(pending.actionId);
    } catch {
      // The Web projection remains pending and surfaces host availability without automatic write retries.
    } finally {
      hostPumpRunning = false;
    }
  };
  const hostPumpHandle = setInterval(() => { void pollHostActions(); }, 1_000);
  context.subscriptions.push({ dispose: () => clearInterval(hostPumpHandle) });

  const bindNewSession = async (requestedLanguage?: ReturnType<typeof resolveInteractionLanguage>) => {
    const interactionLanguage = requestedLanguage ?? resolveInteractionLanguage({ text: "", turnId: randomUUID(), hostLocale: vscode.env.language });
    const launched = await launchNewWorkbench(workspaceRoot, processLauncher, interactionLanguage);
    activeSessionId = launched.sessionId;
    activeWorkbenchUrl = launched.url;
    activeInteractionLanguage = interactionLanguage;
    await context.globalState.update(HOST_BINDING_KEY, { sessionId: launched.sessionId, workbenchUrl: launched.url });
    return launched;
  };
  const openNew = async () => {
    await bindNewSession();
  };
  const handleAnalyzeIntent = async (intent: TaAnalyzeIntent, requestText: string): Promise<string> => {
    const explicitLanguageTag = detectExplicitLanguageTag(requestText);
    const interactionLanguage = resolveInteractionLanguage({
      text: requestText,
      turnId: randomUUID(),
      hostLocale: vscode.env.language,
      ...(explicitLanguageTag === undefined ? {} : { explicitLanguageTag }),
    });
    const launched = await bindNewSession(interactionLanguage);
    const resolvedWorkbookPath = await resolveAnalyzeWorkbookPath(intent, interactionLanguage.uiCatalogLanguage);
    const copy = interactionLanguage.uiCatalogLanguage === "zh"
      ? { ready: "TA Assist Workbench 已就绪。请上传工作簿以开始分析。", accepted: "工作簿已接受" }
      : { ready: "TA Assist Workbench is ready. Upload a workbook to begin.", accepted: "Workbook accepted" };
    if (resolvedWorkbookPath === undefined) return copy.ready;
    try {
      await importWorkbook({ sessionId: launched.sessionId, workbookPath: resolvedWorkbookPath }, processLauncher);
      return interactionLanguage.uiCatalogLanguage === "zh"
        ? `${copy.accepted}。Session ${launched.sessionId} 正在 TA Assist Workbench 中运行。`
        : `${copy.accepted}. Session ${launched.sessionId} is running in TA Assist Workbench.`;
    } catch (error) {
      return formatWorkbookImportFailure(error, interactionLanguage.uiCatalogLanguage);
    }
  };
  const openPureWorkbench = async () => {
    const interactionLanguage = resolveInteractionLanguage({ text: "", turnId: randomUUID(), hostLocale: vscode.env.language });
    const launched = await launchWorkbench(workspaceRoot, processLauncher, interactionLanguage);
    activeWorkbenchUrl = launched.url;
  };
  const resume = async (sessionId?: string) => {
    const selected = sessionId ?? await vscode.window.showInputBox({ prompt: "TA Assist session ID", ignoreFocusOut: true });
    if (selected === undefined || selected.trim().length === 0) return;
    const launched = await resumeWorkbench(workspaceRoot, selected.trim(), processLauncher);
    activeSessionId = launched.sessionId;
    activeWorkbenchUrl = launched.url;
    activeInteractionLanguage = await readSessionLanguage(launched.sessionId);
    await context.globalState.update(HOST_BINDING_KEY, { sessionId: launched.sessionId, workbenchUrl: launched.url });
    const sync = await syncConversationUnread({ sessionId: launched.sessionId, consumerId: `vscode:${vscode.env.machineId}`, store: conversation, status });
    await sync.markRead();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("ta-assist.analyze", openNew),
    vscode.commands.registerCommand("ta-assist.workbench", async () => activeWorkbenchUrl === undefined ? openPureWorkbench() : vscode.env.openExternal(vscode.Uri.parse(activeWorkbenchUrl))),
    vscode.commands.registerCommand("ta-assist.resume", resume),
    vscode.commands.registerCommand("ta-assist.openKnowledgeLibrary", async () => {
      await vscode.commands.executeCommand("workbench.action.chat.open", { query: "Use Knowledge Library to answer my TA question." });
    }),
    vscode.commands.registerCommand("ta-assist.openRealMeasurementAnalysis", async () => {
      await vscode.commands.executeCommand("workbench.action.chat.open", { query: "Use TA Real-Measurement Analysis for my measured data." });
    }),
    vscode.commands.registerCommand("ta-assist.openSessionRecord", async () => {
      const sessionId = activeSessionId ?? await vscode.window.showInputBox({ prompt: "TA Assist session ID", ignoreFocusOut: true });
      if (sessionId === undefined || sessionId.trim().length === 0) return;
      const recordUri = vscode.Uri.file(join(workspaceRoot, "runtime", "workbench", "session-records", sessionId.trim()));
      await vscode.commands.executeCommand("revealFileInOS", recordUri);
    }),
    vscode.commands.registerCommand("ta-assist.openAction", async (target: string) => {
      const origin = requireActiveLoopbackWorkbench(activeWorkbenchUrl);
      if (origin === undefined || !isAllowedWorkbenchRoute(target)) return;
      const url = new URL(origin);
      url.hash = target;
      await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
    }),
    vscode.commands.registerCommand("ta-assist.openCurrentReport", async () => {
      const origin = requireActiveLoopbackWorkbench(activeWorkbenchUrl);
      if (origin === undefined) return;
      const url = new URL(origin);
      url.hash = "/report/current";
      await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
    }),
    vscode.commands.registerCommand("ta-assist.executeHostAction", async (actionId?: string) => {
      if (activeSessionId === undefined || activeWorkbenchUrl === undefined) {
        await vscode.window.showErrorMessage("请先绑定 TA Assist session。");
        return;
      }
      if (actionId === undefined || actionId.trim().length === 0) {
        await vscode.window.showInformationMessage("Host actions run automatically from the bound Web session. Return to TA Assist Workbench to continue.", { modal: false });
        return;
      }
      await executeHostAction(actionId.trim());
      await vscode.window.showInformationMessage("Surface HostAction 已提交。后续确认与结果请返回 Web 查看。", { modal: false });
    }),
  );

  const participant = vscode.chat.createChatParticipant("ta-assist", async (request, chatContext, response, token) => {
    if (request.command === "workbench") {
      await openNew();
      response.markdown(activeInteractionLanguage?.uiCatalogLanguage === "zh"
        ? "TA Assist Workbench 已就绪。请上传工作簿以开始分析。"
        : "TA Assist Workbench is ready. Upload a workbook to begin.");
      return;
    }
    if (request.command === "resume") {
      await resume(request.prompt.trim() || undefined);
      response.markdown(activeSessionId === undefined
        ? (vscode.env.language.toLowerCase().startsWith("zh") ? "未绑定 session。" : "No session is bound.")
        : activeInteractionLanguage?.uiCatalogLanguage === "zh" ? `已绑定 TA Assist session ${activeSessionId}。` : `TA Assist session ${activeSessionId} is bound.`);
      return;
    }
    if (activeSessionId !== undefined && activeInteractionLanguage === undefined) {
      activeInteractionLanguage = await readSessionLanguage(activeSessionId);
    }
    await handleParticipant(request, chatContext, response, token, {
      commandId: randomUUID,
      handleAnalyzeIntent,
      uiCatalogLanguage: activeInteractionLanguage?.uiCatalogLanguage ?? (vscode.env.language.toLowerCase().startsWith("zh") ? "zh" : "en"),
      ...(activeSessionId === undefined ? {} : { sessionId: activeSessionId }),
      handleTurn: async (turn) => {
        const store = await openSessionStore({ rootDir: workspaceRoot, sessionId: turn.sessionId });
        const snapshot = await store.readSnapshot().finally(async () => store.close());
        return handleAgentTurn(turn, {
          snapshotStore: { async readSnapshot() { return snapshot; } },
          conversationStore: conversation,
          ...(request.model === undefined ? {} : { model: createVsCodeLanguageModelAdapter({ model: request.model, token, createUserMessage: vscode.LanguageModelChatMessage.User, interactionLanguage: snapshot.interactionLanguage }) }),
        });
      },
    });
  });
  context.subscriptions.push(participant);
}

function isLoopbackWorkbenchUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

function requireActiveLoopbackWorkbench(workbenchUrl: string | undefined): string | undefined {
  if (workbenchUrl === undefined || !isLoopbackWorkbenchUrl(workbenchUrl)) return undefined;
  return new URL(workbenchUrl).origin;
}

function isAllowedWorkbenchRoute(target: string): boolean {
  return [
    "/scope",
    "/scope/downstream",
    "/ado/preview",
    "/images/decision",
    "/analysis/context",
    "/optimization/targets",
    "/review",
    "/status",
    "/report/current",
    "/what-if",
  ].includes(target);
}


export function deactivate(): void {}

async function resolveAnalyzeWorkbookPath(intent: TaAnalyzeIntent, language: UiCatalogLanguage): Promise<string | undefined> {
  if (intent.workbookPath !== undefined) return intent.workbookPath;
  if (intent.workbookFileName === undefined) return undefined;

  const resolution = await resolveWorkspaceWorkbook(intent.workbookFileName, (pattern) => vscode.workspace.findFiles(pattern));
  const metadata = inputMetadata(language).workbook_file;
  if (resolution.kind === "unique") return resolution.uri.fsPath;
  if (resolution.kind === "ambiguous") {
    const picked = await vscode.window.showQuickPick(resolution.candidates.map((candidate) => ({ label: candidate.fsPath, uri: candidate })), {
      title: metadata.title,
      placeHolder: `${metadata.whatToEnter} ${metadata.example}`,
      ignoreFocusOut: true,
      canPickMany: false,
    });
    return picked?.uri.fsPath;
  }

  const selected = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: metadata.title,
    title: `${metadata.whatToEnter} ${metadata.validationHint}`,
    filters: { "Excel Workbook": ["xlsx"] },
  });
  return selected?.[0]?.fsPath;
}

function formatWorkbookImportFailure(error: unknown, language: UiCatalogLanguage): string {
  const typed = error as { readonly summary?: unknown; readonly suggestedAction?: unknown };
  const summary = safeChatFailureText(typed.summary, language === "zh" ? "工作簿导入失败。" : "Workbook import failed.");
  const suggestedAction = safeChatFailureText(typed.suggestedAction, language === "zh" ? "请打开 TA Assist Workbench 并重新上传工作簿。" : "Open TA Assist Workbench and upload the workbook again.");
  return `${trimTerminalPeriod(summary)}. ${trimTerminalPeriod(suggestedAction)}.`;
}

function safeChatFailureText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (/[A-Za-z]:\\|(?:file|https?):\/\//i.test(value) || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  const trimmed = value.trim();
  return trimmed.length === 0 ? fallback : trimmed;
}

function trimTerminalPeriod(value: string): string {
  return value.trim().replace(/[.。]+$/u, "");
}

function createCliProcessLauncher(workspaceRoot: string, cliPath: string): WorkbenchProcessLauncher & { dispose(): void } {
  let child: ChildProcess | undefined;
  let origin: string | undefined;
  const children = new Set<ChildProcess>();
  return {
    async launch(args) {
      const action = args[1];
      const requestedSession = args[args.indexOf("--session") + 1];
      if (action !== "analyze" && origin !== undefined && child !== undefined && child.exitCode === null) {
        const url = action === "resume" && requestedSession !== undefined ? `${origin}/?session=${encodeURIComponent(requestedSession)}` : origin;
        return { ...(requestedSession === undefined ? {} : { sessionId: requestedSession }), url };
      }
      const started = await startCliHost(process.execPath, [cliPath, ...args], workspaceRoot);
      child = started.child;
      children.add(child);
      origin = new URL(started.url).origin;
      await assertWorkbenchReady(origin);
      const url = action === "resume" && requestedSession !== undefined ? `${origin}/?session=${encodeURIComponent(requestedSession)}` : origin;
      const sessionId = started.sessionId ?? requestedSession;
      return { ...(sessionId === undefined ? {} : { sessionId }), url: action === "analyze" && sessionId !== undefined ? `${origin}/?session=${encodeURIComponent(sessionId)}` : url };
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
    async importWorkbook(input) {
      if (child === undefined || child.connected !== true) throw new Error("Workbench host IPC is unavailable.");
      return new Promise((resolve, reject) => {
        const onMessage = (value: unknown) => {
          const response = value as { readonly type?: unknown; readonly requestId?: unknown; readonly ok?: unknown; readonly receipt?: unknown; readonly error?: unknown };
          if (response.type !== "importWorkbookResult" || response.requestId !== input.requestId) return;
          child!.off("message", onMessage);
          if (response.ok === true) resolve(response.receipt as Awaited<ReturnType<NonNullable<WorkbenchProcessLauncher["importWorkbook"]>>>);
          else reject(importErrorFromResponse(response.error));
        };
        child!.on("message", onMessage);
        child!.send({ type: "importWorkbook", ...input }, (error) => {
          if (error !== null) { child!.off("message", onMessage); reject(error); }
        });
      });
    },
    dispose() { children.forEach((tracked) => tracked.kill()); children.clear(); child = undefined; origin = undefined; },
  };
}

function importErrorFromResponse(error: unknown): Error {
  const value = error as { readonly code?: unknown; readonly summary?: unknown; readonly suggestedAction?: unknown; readonly affectedInputReferences?: unknown };
  return Object.assign(new Error(typeof value.summary === "string" ? value.summary : "Workbook import failed."), {
    code: typeof value.code === "string" ? value.code : "dependency_error",
    summary: typeof value.summary === "string" ? value.summary : "Workbook import failed.",
    suggestedAction: typeof value.suggestedAction === "string" ? value.suggestedAction : "Retry the workbook import.",
    affectedInputReferences: Array.isArray(value.affectedInputReferences) ? value.affectedInputReferences.filter((item): item is string => typeof item === "string" && !item.includes(":\\")) : [],
  });
}

function startCliHost(command: string, args: readonly string[], cwd: string): Promise<{ readonly child: ChildProcess; readonly sessionId?: string; readonly url: string }> {
  return new Promise((resolve, reject) => {
    const [modulePath, ...moduleArgs] = args;
    const child = fork(modulePath!, moduleArgs, { cwd, silent: true, serialization: "advanced" });
    let stdout = "";
    let stderr = "";
    let settled = false;
    child.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (!settled && /^url: .+$/m.test(stdout)) {
        settled = true;
        const sessionId = outputSessionId(stdout);
        resolve({ child, ...(sessionId === undefined ? {} : { sessionId }), url: outputUrl(stdout) });
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

async function hostRequest<Result>(originValue: string, sessionId: string, actionId: string, operation: "claim" | "result", bearer: string, body: unknown): Promise<Result> {
  const origin = new URL(originValue).origin;
  const response = await fetch(`${origin}/api/sessions/${encodeURIComponent(sessionId)}/host-actions/${encodeURIComponent(actionId)}/${operation}`, {
    method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HostAction ${operation} was rejected (${response.status}).`);
  return (response.status === 204 ? undefined : await response.json()) as Result;
}

async function readPendingHostAction(originValue: string, sessionId: string, bearer: string): Promise<{ readonly actionId: string; readonly kind: "surface_validate" | "surface_write" | "surface_reconcile" | "vscode_model_request" } | undefined> {
  const origin = new URL(originValue).origin;
  const response = await fetch(`${origin}/api/sessions/${encodeURIComponent(sessionId)}/ado/pending`, { headers: { authorization: `Bearer ${bearer}` } });
  if (response.status === 204) return undefined;
  if (!response.ok) throw new Error(`Pending ADO HostAction discovery was rejected (${response.status}).`);
  return await response.json() as { readonly actionId: string; readonly kind: "surface_validate" | "surface_write" | "surface_reconcile" | "vscode_model_request" };
}

function outputUrl(stdout: string): string {
  const value = stdout.match(/^url: (.+)$/m)?.[1];
  if (value === undefined) throw new Error("CLI did not return a Workbench URL.");
  return value;
}

function outputSessionId(stdout: string): string | undefined {
  const value = stdout.match(/^session: (.+)$/m)?.[1];
  return value === undefined || value === "created-in-browser" ? undefined : value;
}

async function assertWorkbenchReady(origin: string): Promise<void> {
  const response = await fetch(`${origin}/workbench.js`, { headers: { host: new URL(origin).host } });
  if (!response.ok) throw new Error("Workbench host failed its readiness probe.");
}
