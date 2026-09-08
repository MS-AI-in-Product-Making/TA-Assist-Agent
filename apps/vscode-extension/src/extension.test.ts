import { afterEach, describe, expect, it, vi } from "vitest";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";
const WORKBENCH_URL = `http://127.0.0.1:4317/?session=${SESSION_ID}`;
const WORKBOOK_PATH = "C:\\TA Reports\\report.xlsx";

const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
const globalStateValues = new Map<string, unknown>();
const findFilesMock = vi.fn(async () => [] as Array<{ fsPath: string }>);
const showQuickPickMock = vi.fn();
const showOpenDialogMock = vi.fn();
const showInputBoxMock = vi.fn();
const showInformationMessageMock = vi.fn();
const launchNewWorkbenchMock = vi.fn(async () => ({ sessionId: SESSION_ID, url: WORKBENCH_URL }));
const launchWorkbenchMock = vi.fn(async () => ({ url: "http://127.0.0.1:4317/" }));
const resumeWorkbenchMock = vi.fn(async (_rootDir: string, sessionId: string) => ({ sessionId, url: `http://127.0.0.1:4317/?session=${sessionId}` }));
const importWorkbookMock = vi.fn(async () => ({ artifactId: "artifact-1", contentHash: "a".repeat(64), snapshotRevision: 1, state: "f0_validating" }));
const handleAgentTurnMock = vi.fn(async () => ({ responseText: "Session is active.", actions: [], commands: [] }));
let participantHandler: ((request: { readonly prompt: string; readonly command?: string; readonly model?: unknown }, context: { readonly history: readonly unknown[] }, response: { readonly markdown: (text: string) => void }, token: { readonly isCancellationRequested: boolean }) => Promise<void>) | undefined;
const joinPathMock = vi.fn((base: { fsPath: string }, ...segments: string[]) => ({ fsPath: `${base.fsPath}/${segments.join("/")}`.replace(/\\/g, "/") }));

vi.mock("vscode", () => ({
  StatusBarAlignment: { Left: 1 },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    parse: (value: string) => ({ value }),
    joinPath: joinPathMock,
  },
  chat: { createChatParticipant: vi.fn((_id: string, callback: NonNullable<typeof participantHandler>) => {
    participantHandler = callback;
    return { dispose: vi.fn() };
  }) },
  commands: {
    registerCommand: vi.fn((command: string, callback: (...args: unknown[]) => unknown) => {
      registeredCommands.set(command, callback);
      return { dispose: vi.fn() };
    }),
    executeCommand: vi.fn(),
  },
  env: { machineId: "machine", language: "en-US", openExternal: vi.fn() },
  lm: { tools: {}, invokeTool: vi.fn(), selectChatModels: vi.fn(async () => []) },
  window: {
    createStatusBarItem: vi.fn(() => ({ text: "", command: "", show: vi.fn(), dispose: vi.fn() })),
    showErrorMessage: vi.fn(),
    showInformationMessage: showInformationMessageMock,
    showInputBox: showInputBoxMock,
    showQuickPick: showQuickPickMock,
    showOpenDialog: showOpenDialogMock,
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "repo" } }],
    findFiles: findFilesMock,
  },
}));

vi.mock("@ai-assist/conversation", () => ({
  createConversationStore: vi.fn(async () => ({ close: vi.fn() })),
}));
vi.mock("@ai-assist/agent-runtime", () => ({ handleAgentTurn: handleAgentTurnMock }));
vi.mock("@ai-assist/workbench", () => ({
  openSessionStore: vi.fn(async () => ({
    readSnapshot: async () => ({
      sessionId: SESSION_ID,
      interactionLanguage: { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-en", source: "workflow_start", fallbackUsed: false },
    }),
    close: vi.fn(async () => undefined),
  })),
}));
vi.mock("./conversation-sync.js", () => ({ syncConversationUnread: vi.fn(async () => ({ markRead: vi.fn() })) }));
vi.mock("./language-model.js", () => ({ createVsCodeLanguageModelAdapter: vi.fn() }));
vi.mock("./workbench-launcher.js", () => ({ launchNewWorkbench: launchNewWorkbenchMock, launchWorkbench: launchWorkbenchMock, resumeWorkbench: resumeWorkbenchMock }));
vi.mock("./workbook-import.js", () => ({ importWorkbook: importWorkbookMock }));
vi.mock("./surface-host-client.js", () => ({ createSurfaceHostClient: vi.fn() }));
vi.mock("./host-action-pump.js", () => ({ pumpOneHostAction: vi.fn() }));
vi.mock("./surface-validation.js", () => ({ executeSurfaceValidation: vi.fn() }));

afterEach(() => {
  registeredCommands.clear();
  globalStateValues.clear();
  launchNewWorkbenchMock.mockClear();
  launchWorkbenchMock.mockClear();
  resumeWorkbenchMock.mockClear();
  findFilesMock.mockReset();
  findFilesMock.mockResolvedValue([]);
  showQuickPickMock.mockReset();
  showOpenDialogMock.mockReset();
  showInputBoxMock.mockReset();
  showInformationMessageMock.mockReset();
  importWorkbookMock.mockReset();
  importWorkbookMock.mockResolvedValue({ artifactId: "artifact-1", contentHash: "a".repeat(64), snapshotRevision: 1, state: "f0_validating" });
  handleAgentTurnMock.mockClear();
  joinPathMock.mockClear();
  participantHandler = undefined;
  vi.resetModules();
});

function extensionContext() {
  return {
    subscriptions: [] as { dispose(): void }[],
    extensionUri: { fsPath: "repo/apps/vscode-extension" },
    globalState: {
      get: vi.fn((key: string) => globalStateValues.get(key)),
      update: vi.fn(async (key: string, value: unknown) => { globalStateValues.set(key, value); }),
    },
  };
}

async function bindSessionThroughAnalyze() {
  await registeredCommands.get("ta-assist.analyze")!();
}

function chatResponse() {
  return { progress: vi.fn(), markdown: vi.fn(), button: vi.fn() };
}

async function activateExtension() {
  const { activate } = await import("./extension.js");
  const context = extensionContext();
  await activate(context as never);
  return context;
}

async function invokeParticipant(request: { readonly prompt: string; readonly command?: string; readonly model?: unknown }) {
  const response = chatResponse();
  if (participantHandler === undefined) throw new Error("participant was not registered");
  await participantHandler(request, { history: [] }, response, { isCancellationRequested: false });
  return response;
}

describe("extension workbench binding", () => {
  it("derives CLI entrypoint from extensionUri runtime folder", async () => {
    const context = await activateExtension();

    expect(joinPathMock).toHaveBeenCalledWith(context.extensionUri, "runtime", "cli", "index.cjs");
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("stores active session and URL immediately when analyze opens a new workbench", async () => {
    const context = await activateExtension();

    await registeredCommands.get("ta-assist.analyze")!();

    expect(launchNewWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object), expect.objectContaining({ languageTag: "en-US", uiCatalogLanguage: "en", source: "workflow_start" }));
    expect(context.globalState.update).toHaveBeenCalledWith("ta-assist.hostBinding", { sessionId: SESSION_ID, workbenchUrl: WORKBENCH_URL });
    expect(globalStateValues.get("ta-assist.hostBinding")).toEqual({ sessionId: SESSION_ID, workbenchUrl: WORKBENCH_URL });
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("preserves pure workbench command launch without writing a session binding", async () => {
    const context = await activateExtension();

    await registeredCommands.get("ta-assist.workbench")!();

    expect(launchWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object), expect.objectContaining({ languageTag: "en-US", uiCatalogLanguage: "en", source: "workflow_start" }));
    expect(context.globalState.update).not.toHaveBeenCalled();
    expect(globalStateValues.get("ta-assist.hostBinding")).toBeUndefined();
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("creates, binds, imports, and returns the running response for natural analyze with a path", async () => {
    const context = await activateExtension();

    const response = await invokeParticipant({ prompt: `帮我分析 "${WORKBOOK_PATH}"` });

    expect(launchNewWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object), expect.objectContaining({ languageTag: "en-US", uiCatalogLanguage: "en", source: "workflow_start" }));
    expect(importWorkbookMock).toHaveBeenCalledWith({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, expect.any(Object));
    expect(context.globalState.update).toHaveBeenCalledWith("ta-assist.hostBinding", { sessionId: SESSION_ID, workbenchUrl: WORKBENCH_URL });
    expect(response.markdown).toHaveBeenCalledWith(`Workbook accepted. Session ${SESSION_ID} is running in TA Assist Workbench.`);
    expect(JSON.stringify(response.markdown.mock.calls)).not.toContain(WORKBOOK_PATH);
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("creates and binds a real session for natural analyze without a path", async () => {
    const context = await activateExtension();

    const response = await invokeParticipant({ prompt: "帮我分析这份 Excel 工作簿" });

    expect(launchNewWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object), expect.objectContaining({ languageTag: "en-US", uiCatalogLanguage: "en", source: "workflow_start" }));
    expect(importWorkbookMock).not.toHaveBeenCalled();
    expect(context.globalState.update).toHaveBeenCalledWith("ta-assist.hostBinding", { sessionId: SESSION_ID, workbenchUrl: WORKBENCH_URL });
    expect(response.markdown).toHaveBeenCalledWith("TA Assist Workbench is ready. Upload a workbook to begin.");
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("keeps the new session bound and recoverable when import fails", async () => {
    importWorkbookMock.mockRejectedValueOnce(Object.assign(new Error("Workbook import rejected."), {
      summary: "Workbook import rejected.",
      suggestedAction: "Provide an existing non-symlink .xlsx workbook file.",
      affectedInputReferences: ["workbook_path_unavailable"],
    }));
    const context = await activateExtension();

    const response = await invokeParticipant({ prompt: `Analyze "${WORKBOOK_PATH}"` });

    expect(context.globalState.update).toHaveBeenCalledWith("ta-assist.hostBinding", { sessionId: SESSION_ID, workbenchUrl: WORKBENCH_URL });
    expect(response.markdown).toHaveBeenCalledWith("Workbook import rejected. Provide an existing non-symlink .xlsx workbook file.");
    expect(JSON.stringify(response.markdown.mock.calls)).not.toContain(WORKBOOK_PATH);

    await invokeParticipant({ prompt: "What is the current status?" });
    expect(handleAgentTurnMock).toHaveBeenCalledWith(expect.objectContaining({ text: "What is the current status?", sessionId: SESSION_ID }), expect.any(Object));
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("handles explicit analyze command with a workbook path consistently", async () => {
    const context = await activateExtension();

    const response = await invokeParticipant({ prompt: WORKBOOK_PATH, command: "analyze" });

    expect(importWorkbookMock).toHaveBeenCalledWith({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, expect.any(Object));
    expect(response.markdown).toHaveBeenCalledWith(`Workbook accepted. Session ${SESSION_ID} is running in TA Assist Workbench.`);
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("resolves a unique workspace workbook name before import", async () => {
    const context = await activateExtension();
    findFilesMock.mockResolvedValueOnce([{ fsPath: WORKBOOK_PATH }]);

    const response = await invokeParticipant({ prompt: "请用中文分析 report.xlsx 的 TA" });

    expect(findFilesMock).toHaveBeenCalled();
    expect(launchNewWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object), expect.objectContaining({ languageTag: "zh-CN", uiCatalogLanguage: "zh" }));
    expect(importWorkbookMock).toHaveBeenCalledWith({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, expect.any(Object));
    expect(response.markdown).toHaveBeenCalledWith(`工作簿已接受。Session ${SESSION_ID} 正在 TA Assist Workbench 中运行。`);
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("requires manual selection when duplicate workbook names are found", async () => {
    const context = await activateExtension();
    findFilesMock.mockResolvedValueOnce([{ fsPath: "C:\\A\\report.xlsx" }, { fsPath: WORKBOOK_PATH }]);
    showQuickPickMock.mockResolvedValueOnce({ label: WORKBOOK_PATH, uri: { fsPath: WORKBOOK_PATH } });

    await invokeParticipant({ prompt: "Analyze report.xlsx" });

    expect(showQuickPickMock).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      title: "Workbook file",
      placeHolder: expect.stringContaining("TA.xlsx"),
    }));
    expect(importWorkbookMock).toHaveBeenCalledWith({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, expect.any(Object));
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("returns without import when duplicate-name Quick Pick is cancelled", async () => {
    const context = await activateExtension();
    findFilesMock.mockResolvedValueOnce([{ fsPath: "C:\\A\\report.xlsx" }, { fsPath: WORKBOOK_PATH }]);
    showQuickPickMock.mockResolvedValueOnce(undefined);

    const response = await invokeParticipant({ prompt: "Analyze report.xlsx" });

    expect(launchNewWorkbenchMock).toHaveBeenCalledTimes(1);
    expect(showQuickPickMock).toHaveBeenCalledTimes(1);
    expect(importWorkbookMock).not.toHaveBeenCalled();
    expect(response.markdown).toHaveBeenCalledWith("TA Assist Workbench is ready. Upload a workbook to begin.");
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("returns without import when Open Dialog is cancelled", async () => {
    const context = await activateExtension();
    findFilesMock.mockResolvedValueOnce([]);
    showOpenDialogMock.mockResolvedValueOnce(undefined);

    const response = await invokeParticipant({ prompt: "Analyze report.xlsx" });

    expect(launchNewWorkbenchMock).toHaveBeenCalledTimes(1);
    expect(showOpenDialogMock).toHaveBeenCalledTimes(1);
    expect(importWorkbookMock).not.toHaveBeenCalled();
    expect(response.markdown).toHaveBeenCalledWith("TA Assist Workbench is ready. Upload a workbook to begin.");
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("routes Open Dialog selection through importWorkbook even when selected URI is non-xlsx", async () => {
    const context = await activateExtension();
    findFilesMock.mockResolvedValueOnce([]);
    showOpenDialogMock.mockResolvedValueOnce([{ fsPath: "C:\\TA Reports\\report.csv" }]);
    importWorkbookMock.mockRejectedValueOnce(Object.assign(new Error("unsafe"), {
      summary: "Workbook import failed for C:\\TA Reports\\report.csv",
      suggestedAction: "Open TA Assist Workbench and upload the workbook again.",
    }));

    const response = await invokeParticipant({ prompt: "Analyze report.xlsx" });

    expect(importWorkbookMock).toHaveBeenCalledWith({ sessionId: SESSION_ID, workbookPath: "C:\\TA Reports\\report.csv" }, expect.any(Object));
    expect(response.markdown).toHaveBeenCalledWith("Workbook import failed. Open TA Assist Workbench and upload the workbook again.");
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("opens current report only through the controlled loopback command", async () => {
    const context = await activateExtension();
    const vscode = await import("vscode");
    await bindSessionThroughAnalyze();

    await registeredCommands.get("ta-assist.openCurrentReport")!("https://evil.test/ignored");

    expect(vscode.env.openExternal).toHaveBeenCalledWith(expect.objectContaining({ value: expect.stringContaining("#/report/current") }));
    expect(vscode.env.openExternal).not.toHaveBeenCalledWith(expect.objectContaining({ value: expect.stringContaining("evil.test") }));
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("does not expose internal HostAction IDs in the normal command flow", async () => {
    const context = await activateExtension();
    await bindSessionThroughAnalyze();

    await registeredCommands.get("ta-assist.executeHostAction")!();

    expect(showInputBoxMock).not.toHaveBeenCalled();
    expect(showInformationMessageMock).toHaveBeenCalledWith(expect.stringContaining("run automatically"), { modal: false });
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("uses governed session recovery metadata for the resume input", async () => {
    const context = await activateExtension();
    showInputBoxMock.mockResolvedValueOnce(undefined);

    await registeredCommands.get("ta-assist.resume")!();

    expect(showInputBoxMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Session recovery",
      placeHolder: "Resume the saved session.",
    }));
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("rejects arbitrary URL targets for action navigation", async () => {
    const context = await activateExtension();
    const vscode = await import("vscode");
    await bindSessionThroughAnalyze();
    vi.mocked(vscode.env.openExternal).mockClear();

    await registeredCommands.get("ta-assist.openAction")!("https://evil.test/path");

    expect(vscode.env.openExternal).not.toHaveBeenCalled();
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("opens explicit chat handoffs for knowledge and real-measurement workflows", async () => {
    const context = await activateExtension();
    const vscode = await import("vscode");
    vi.mocked(vscode.commands.executeCommand).mockClear();

    await registeredCommands.get("ta-assist.openKnowledgeLibrary")!();
    await registeredCommands.get("ta-assist.openRealMeasurementAnalysis")!();

    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(1, "workbench.action.chat.open", {
      query: "Use Knowledge Library to answer my TA question.",
    });
    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(2, "workbench.action.chat.open", {
      query: "Use TA Real-Measurement Analysis for my measured data.",
    });
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });
});