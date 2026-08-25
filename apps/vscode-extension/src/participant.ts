import type { AgentTurnRequest, AgentTurnResult } from "@ai-assist/agent-runtime";

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
  readonly sessionId: string;
  readonly commandId: () => string;
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
    stream.button({ command: "ta-assist.openAction", title: action.label, arguments: [action.target] });
  }
}
