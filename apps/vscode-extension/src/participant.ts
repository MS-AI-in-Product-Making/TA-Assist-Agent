import type { AgentTurnRequest, AgentTurnResult } from "@ai-assist/agent-runtime";
import {
  classifyTopLevelWorkflowIntent,
  detectUserLanguage,
  productWorkflowLabel,
  type ProductWorkflowId,
} from "@ai-assist/product-language";

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
      stream.button({ command: "ta-assist.openCurrentReport", title: "Design Optimization Report", arguments: [] });
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
  const workflowIntent = classifyParticipantWorkflowIntent(request);
  if (workflowIntent === undefined) return false;

  if (workflowIntent.kind === "measured_analysis") {
    stream.markdown(buildMeasuredAnalysisMessage(request.prompt));
    stream.button({ command: "ta-assist.openRealMeasurementAnalysis", title: "TA Real-Measurement Analysis", arguments: [] });
    return true;
  }

  if (workflowIntent.kind === "knowledge_question") {
    stream.markdown(buildKnowledgeLibraryMessage(request.prompt));
    stream.button({ command: "ta-assist.openKnowledgeLibrary", title: "Knowledge Library", arguments: [] });
    return true;
  }

  if (workflowIntent.kind === "clarification_required") {
    stream.markdown(buildClarificationMessage(request.prompt, workflowIntent.candidates));
    return true;
  }

  if (workflowIntent.kind !== "workbook_analysis") return false;

  const classification = classifyParticipantAnalyzeIntent(request);
  if (classification?.kind === "invalid_analyze_ta") {
    stream.markdown(classification.reason === "multiple_paths"
      ? "Provide exactly one Windows absolute .xlsx workbook path or one exact .xlsx workbook file name, or omit it and upload in TA Assist Workbench."
      : "TA Assist analyze accepts one Windows absolute .xlsx workbook path, one exact .xlsx workbook file name, or no path.");
    return true;
  }
  if (dependencies.handleAnalyzeIntent === undefined) return false;
  stream.progress("正在准备 TA Assist Workbench...");
  const response = await dependencies.handleAnalyzeIntent(classification ?? { kind: "analyze_ta" });
  if (cancellation.isCancellationRequested) return true;
  stream.markdown(response);
  return true;
}

function classifyParticipantWorkflowIntent(request: ParticipantRequest) {
  if (request.command === "analyze") return { kind: "workbook_analysis" } as const;
  if (request.command !== undefined) return undefined;
  return classifyTopLevelWorkflowIntent(request.prompt);
}

function classifyParticipantAnalyzeIntent(request: ParticipantRequest): ReturnType<typeof classifyAnalyzeIntent> {
  if (request.command === "analyze") {
    const prompt = request.prompt.trim();
    return prompt.length === 0 ? undefined : classifyAnalyzeIntent(`analyze ${prompt}`);
  }
  return request.command === undefined ? classifyAnalyzeIntent(request.prompt) : undefined;
}

function buildMeasuredAnalysisMessage(prompt: string): string {
  const language = detectUserLanguage(prompt);
  return language === "zh"
    ? "TA Real-Measurement Analysis 已识别为本次请求的正确入口。"
    : "TA Real-Measurement Analysis is the correct entry for this request.";
}

function buildKnowledgeLibraryMessage(prompt: string): string {
  return detectUserLanguage(prompt) === "zh"
    ? "Knowledge Library 已识别为本次请求的正确入口。"
    : "Knowledge Library is the correct entry for this request.";
}

function buildClarificationMessage(prompt: string, candidates: readonly ProductWorkflowId[]): string {
  const language = detectUserLanguage(prompt);
  const names = candidates.map((candidate) => productWorkflowLabel(candidate, language));
  return language === "zh"
    ? `当前请求还不足以确定顶层产品 workflow。请明确你要进入以下哪一个：${names.join("、")}。`
    : `This request is not specific enough to choose a product workflow. Please clarify which one you want: ${names.join(", ")}.`;
}
