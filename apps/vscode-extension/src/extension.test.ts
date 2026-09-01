import { afterEach, describe, expect, it, vi } from "vitest";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";
const WORKBENCH_URL = `http://127.0.0.1:4317/?session=${SESSION_ID}`;
const WORKBOOK_PATH = "C:\\TA Reports\\report.xlsx";

const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
const globalStateValues = new Map<string, unknown>();
const findFilesMock = vi.fn(async () => [] as Array<{ fsPath: string }>);
const showQuickPickMock = vi.fn();
const showOpenDialogMock = vi.fn();
const launchNewWorkbenchMock = vi.fn(async () => ({ sessionId: SESSION_ID, url: WORKBENCH_URL }));
const launchWorkbenchMock = vi.fn(async () => ({ url: "http://127.0.0.1:4317/" }));
const resumeWorkbenchMock = vi.fn(async (_rootDir: string, sessionId: string) => ({ sessionId, url: `http://127.0.0.1:4317/?session=${sessionId}` }));
const importWorkbookMock = vi.fn(async () => ({ artifactId: "artifact-1", contentHash: "a".repeat(64), snapshotRevision: 1, state: "f0_validating" }));
const handleAgentTurnMock = vi.fn(async () => ({ responseText: "Session is active.", actions: [], commands: [] }));
let participantHandler: ((request: { readonly prompt: string; readonly command?: string; readonly model?: unknown }, context: { readonly history: readonly unknown[] }, response: { readonly markdown: (text: string) => void }, token: { readonly isCancellationRequested: boolean }) => Promise<void>) | undefined;

vi.mock("vscode", () => ({
  StatusBarAlignment: { Left: 1 },
  Uri: { file: (fsPath: string) => ({ fsPath }), parse: (value: string) => ({ value }) },
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
  env: { machineId: "machine", openExternal: vi.fn() },
  lm: { tools: {}, invokeTool: vi.fn(), selectChatModels: vi.fn(async () => []) },
  window: {
    createStatusBarItem: vi.fn(() => ({ text: "", command: "", show: vi.fn(), dispose: vi.fn() })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showInputBox: vi.fn(),
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
vi.mock("@ai-assist/workbench", () => ({ openSessionStore: vi.fn() }));
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
  importWorkbookMock.mockReset();
  importWorkbookMock.mockResolvedValue({ artifactId: "artifact-1", contentHash: "a".repeat(64), snapshotRevision: 1, state: "f0_validating" });
  handleAgentTurnMock.mockClear();
  participantHandler = undefined;
  vi.resetModules();
});

function extensionContext() {
  return {
    subscriptions: [] as { dispose(): void }[],
    globalState: {
      get: vi.fn((key: string) => globalStateValues.get(key)),
      update: vi.fn(async (key: string, value: unknown) => { globalStateValues.set(key, value); }),
    },
  };
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
  it("stores active session and URL immediately when analyze opens a new workbench", async () => {
    const context = await activateExtension();

    await registeredCommands.get("ta-assist.analyze")!();

    expect(launchNewWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object));
    expect(context.globalState.update).toHaveBeenCalledWith("ta-assist.hostBinding", { sessionId: SESSION_ID, workbenchUrl: WORKBENCH_URL });
    expect(globalStateValues.get("ta-assist.hostBinding")).toEqual({ sessionId: SESSION_ID, workbenchUrl: WORKBENCH_URL });
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("preserves pure workbench command launch without writing a session binding", async () => {
    const context = await activateExtension();

    await registeredCommands.get("ta-assist.workbench")!();

    expect(launchWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object));
    expect(context.globalState.update).not.toHaveBeenCalled();
    expect(globalStateValues.get("ta-assist.hostBinding")).toBeUndefined();
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("creates, binds, imports, and returns the running response for natural analyze with a path", async () => {
    const context = await activateExtension();

    const response = await invokeParticipant({ prompt: `帮我分析 "${WORKBOOK_PATH}"` });

    expect(launchNewWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object));
    expect(importWorkbookMock).toHaveBeenCalledWith({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, expect.any(Object));
    expect(context.globalState.update).toHaveBeenCalledWith("ta-assist.hostBinding", { sessionId: SESSION_ID, workbenchUrl: WORKBENCH_URL });
    expect(response.markdown).toHaveBeenCalledWith(`Workbook accepted. Session ${SESSION_ID} is running in TA Assist Workbench.`);
    expect(JSON.stringify(response.markdown.mock.calls)).not.toContain(WORKBOOK_PATH);
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("creates and binds a real session for natural analyze without a path", async () => {
    const context = await activateExtension();

    const response = await invokeParticipant({ prompt: "帮我分析这份 TA 报告" });

    expect(launchNewWorkbenchMock).toHaveBeenCalledWith("repo", expect.any(Object));
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

    const response = await invokeParticipant({ prompt: "请帮我分析 report.xlsx 的 TA" });

    expect(findFilesMock).toHaveBeenCalled();
    expect(importWorkbookMock).toHaveBeenCalledWith({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, expect.any(Object));
    expect(response.markdown).toHaveBeenCalledWith(`Workbook accepted. Session ${SESSION_ID} is running in TA Assist Workbench.`);
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("requires manual selection when duplicate workbook names are found", async () => {
    const context = await activateExtension();
    findFilesMock.mockResolvedValueOnce([{ fsPath: "C:\\A\\report.xlsx" }, { fsPath: WORKBOOK_PATH }]);
    showQuickPickMock.mockResolvedValueOnce({ label: WORKBOOK_PATH, uri: { fsPath: WORKBOOK_PATH } });

    await invokeParticipant({ prompt: "Analyze report.xlsx" });

    expect(showQuickPickMock).toHaveBeenCalled();
    expect(importWorkbookMock).toHaveBeenCalledWith({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, expect.any(Object));
    context.subscriptions.forEach((subscription) => subscription.dispose());
  });
});