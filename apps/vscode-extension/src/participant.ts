import type { AgentTurnRequest, AgentTurnResult } from "@ai-assist/agent-runtime";

import { classifyAnalyzeIntent, type TaAnalyzeIntent } from "./analyze-intent.js";

export interface ParticipantRequest {
  readonly prompt: string;
  readonly command: string | undefined;
  readonly model?: unknown;
}

export interface ParticipantContext {
  readonly history: readonly unknown[];
}

export interface ParticipantStream {
  progress(message: string): void;
  markdown(markdown: string): void;
  button(button: { readonly command: string; readonly title: string; readonly arguments: unknown[] }): void;
}

export interface ParticipantCancellation {
  readonly isCancellationRequested: boolean;
}

export interface ParticipantDependencies {
  readonly sessionId?: string;
  readonly commandId: () => string;
  readonly handleAnalyzeIntent?: (intent: TaAnalyzeIntent) => Promise<string>;
  readonly handleTurn: (request: AgentTurnRequest, dependencies: { readonly model?: unknown }) => Promise<AgentTurnResult>;
}

export async function handleParticipant(
  request: ParticipantRequest,
  _context: ParticipantContext,
  stream: ParticipantStream,
  cancellation: ParticipantCancellation,
  dependencies: ParticipantDependencies,
): Promise<void> {
  if (cancellation.isCancellationRequested) return;
  const handledAnalyzeIntent = await handleAnalyzeIntent(request, stream, cancellation, dependencies);
  if (handledAnalyzeIntent) return;
  if (dependencies.sessionId === undefined) {
    stream.markdown("请先使用 `/analyze` 或 `/resume <session-id>` 绑定 TA Assist session。");
    return;
  }
  stream.progress("正在读取 TA Assist session...");
  const result = await dependencies.handleTurn({
    text: request.prompt,
    sessionId: dependencies.sessionId,
    commandId: dependencies.commandId(),
    source: "vscode",
  }, request.model === undefined ? {} : { model: request.model });
  if (cancellation.isCancellationRequested) return;
  stream.markdown(result.responseText);
  for (const action of result.actions) {
    if (action.type === "open_report" && action.target === "/report/current") {
      stream.button({ command: "ta-assist.openCurrentReport", title: "Feature6-Report.md", arguments: [] });
      continue;
    }
    stream.button({ command: "ta-assist.openAction", title: action.label, arguments: [action.target] });
  }
}

async function handleAnalyzeIntent(
  request: ParticipantRequest,
  stream: ParticipantStream,
  cancellation: ParticipantCancellation,
  dependencies: ParticipantDependencies,
): Promise<boolean> {
  const classification = classifyParticipantAnalyzeIntent(request);
  if (classification === undefined) return false;
  if (classification.kind === "invalid_analyze_ta") {
    stream.markdown(classification.reason === "multiple_paths"
      ? "Provide exactly one Windows absolute .xlsx workbook path or one exact .xlsx workbook file name, or omit it and upload in TA Assist Workbench."
      : "TA Assist analyze accepts one Windows absolute .xlsx workbook path, one exact .xlsx workbook file name, or no path.");
    return true;
  }
  if (dependencies.handleAnalyzeIntent === undefined) return false;
  stream.progress("正在准备 TA Assist Workbench...");
  const response = await dependencies.handleAnalyzeIntent(classification);
  if (cancellation.isCancellationRequested) return true;
  stream.markdown(response);
  return true;
}

function classifyParticipantAnalyzeIntent(request: ParticipantRequest): ReturnType<typeof classifyAnalyzeIntent> {
  if (request.command === "analyze") {
    const prompt = request.prompt.trim();
    return classifyAnalyzeIntent(prompt.length === 0 ? "analyze TA workbook" : `analyze TA workbook ${prompt}`);
  }
  return request.command === undefined ? classifyAnalyzeIntent(request.prompt) : undefined;
}
