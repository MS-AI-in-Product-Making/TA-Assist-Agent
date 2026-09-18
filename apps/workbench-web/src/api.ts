import {
  conversationTurnSchema,
  createTypedError,
  drawingGovernanceResultV2Schema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f6ReadableOptimizationResultSchema,
  f2UserReportSchema,
  f2FindingsDecisionProjectionSchema,
  f8SessionEventSchema,
  f8ScenarioDraftSchema,
  f8AdoProjectionSchema,
  typedErrorSchema,
  type ConversationTurn,
  type DrawingGovernanceResultV2,
  type F4WorkflowCalculationResult,
  type F5DataInterpretationResult,
  type F6ReadableOptimizationResult,
  type F2UserReport,
  type F2FindingsDecisionProjection,
  type F8ScenarioDraft,
  type F8AdoProjection,
  type F8AdoWriteConfirmation,
  type F6InputProposal,
  type F8PendingF6InputDraft,
  type F8WorksheetWhatIfCalculationRequest,
  type TypedError,
} from "@ai-assist/contracts";
import { f8SessionSnapshotSchema } from "../../../packages/contracts/src/f8-contracts.js";
import type { F8CommandKind, F8PublicSessionCommand, F8SessionSnapshot } from "./workbench-session.js";

export interface BootstrapResult {
  readonly sessionId: string;
  readonly snapshot: F8SessionSnapshot;
  readonly conversation: readonly ConversationTurn[];
  readonly pendingWorkbookHash?: string;
}

export interface WorkbenchSubscriptionHandlers {
  readonly onSnapshot: (snapshot: F8SessionSnapshot, eventId?: string) => void;
  readonly onProgress?: (progress: RunnerProgressEvent, eventId?: string) => void;
  readonly onError: (error: TypedError) => void;
}

export interface RunnerProgressEvent {
  readonly kind: "stage_started" | "stage_completed" | "stage_failed" | "artifact_written";
  readonly featureId: "F0" | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";
  readonly stage: string;
  readonly timestamp: string;
}

export interface ParsedSseEvent {
  readonly id?: string;
  readonly event: string;
  readonly data: string;
}

export class SseEventParser {
  private buffer = "";

  private pendingCarriageReturn = false;

  push(chunk: string): readonly ParsedSseEvent[] {
    const normalized = this.normalizeLineEndings(chunk);
    this.buffer += normalized;
    const events: ParsedSseEvent[] = [];
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const event = parseSseBlock(block);
      if (event !== undefined) events.push(event);
      boundary = this.buffer.indexOf("\n\n");
    }
    return events;
  }

  private normalizeLineEndings(chunk: string): string {
    let input = chunk;
    if (this.pendingCarriageReturn) {
      input = `\r${input}`;
      this.pendingCarriageReturn = false;
    }
    if (input.endsWith("\r")) {
      input = input.slice(0, -1);
      this.pendingCarriageReturn = true;
    }
    return input.replace(/\r\n|\r/g, "\n");
  }
}

export interface WorkbenchApi {
  bootstrap(): Promise<BootstrapResult>;
  subscribe(sessionId: string, handlers: WorkbenchSubscriptionHandlers, lastEventId?: string): () => void;
  uploadWorkbook(sessionId: string, expectedRevision: number, file: File): Promise<{ readonly snapshot: F8SessionSnapshot; readonly workbookHash: string }>;
  replaceWorkbook(sessionId: string, expectedRevision: number, previousWorkbookHash: string, file: File): Promise<{ readonly snapshot: F8SessionSnapshot; readonly workbookHash: string }>;
  readF2Findings(sessionId: string): Promise<F2FindingsDecisionProjection>;
  submitCommand<TPayload extends F8PublicSessionCommand["payload"]>(
    sessionId: string,
    expectedRevision: number,
    command: F8CommandKind,
    payload: TPayload,
  ): Promise<F8SessionSnapshot>;
  calculateWhatIf(sessionId: string, input: { readonly draftId: string; readonly worksheetName: string; readonly tableId: string; readonly sourceRow: number; readonly inputRevision: number; readonly patch: NonNullable<F8ScenarioDraft["change"]>; readonly signedDirectionEvidence?: true }): Promise<F8ScenarioDraft>;
  calculateWorksheetWhatIf(sessionId: string, input: F8WorksheetWhatIfCalculationRequest): Promise<F8ScenarioDraft>;
  createF6InputDraft(
    sessionId: string,
    input: { readonly expectedRevision: number; readonly kind: "analysis_context" | "optimization_targets"; readonly proposal: F6InputProposal },
  ): Promise<F6InputDraftCreateResult>;
  readF6InputDraft(sessionId: string, draftId: string): Promise<F6InputDraftReadResult>;
  appendConversationTurn(turn: ConversationTurn, selection: TaConversationSelection): Promise<ConversationTurn>;
  readConversation(sessionId: string): Promise<readonly ConversationTurn[]>;
  readAdoProjection(sessionId: string): Promise<F8AdoProjection>;
  confirmAdoWrite(sessionId: string, confirmation: F8AdoWriteConfirmation): Promise<void>;
  reconcileAdoWrite(sessionId: string): Promise<void>;
  startNewAdoWriteGeneration(sessionId: string): Promise<F8SessionSnapshot>;
  artifactUrl(sessionId: string, artifactId: string, disposition?: "inline" | "attachment"): string;
  loadArtifactJson(
    sessionId: string,
    artifactId: string,
    kind: "f2_report" | "f3_report" | "f4_calculation" | "f4_report" | "f5_report" | "f6_optimization" | "f6_report",
  ): Promise<F2UserReport | DrawingGovernanceResultV2 | F4WorkflowCalculationResult | F5DataInterpretationResult | F6ReadableOptimizationResult | undefined>;
}

export interface TaConversationSelection { readonly worksheetName: string; readonly tableId?: string; readonly sourceRow?: number; readonly factorName?: string; readonly calculationReference?: string }

export interface F6InputDraftCreateResult {
  readonly status: string;
  readonly pendingDraft?: F8PendingF6InputDraft;
  readonly preview?: unknown;
  readonly snapshotRevision?: number;
  readonly clarifications?: readonly {
    readonly clarificationId: string;
    readonly reasonCode: string;
    readonly question: string;
    readonly requiredFields: readonly string[];
  }[];
}

export interface F6InputDraftReadResult {
  readonly pendingDraft: F8PendingF6InputDraft;
  readonly materialization: {
    readonly proposal: F6InputProposal;
    readonly preview?: unknown;
  };
  readonly confirmed: boolean;
}

const SESSION_QUERY_KEY = "session";

export function buildWorksheetBoundF1ImageArtifactUrl(input: {
  readonly sessionId: string;
  readonly contentHash: string;
  readonly worksheetName: string;
  readonly relativePath: string;
}): string {
  const params = new URLSearchParams({
    disposition: "inline",
    worksheet: input.worksheetName,
    path: input.relativePath,
  });
  return `/api/sessions/${encodeURIComponent(input.sessionId)}/artifacts/${encodeURIComponent(`f1-image:${input.contentHash}`)}?${params.toString()}`;
}

export function createWorkbenchApi(): WorkbenchApi {
  let csrfToken: string | undefined;

  return {
    async bootstrap() {
      const requestedSessionId = readSessionIdFromUrl();
      const snapshot = requestedSessionId === undefined
        ? await createSession()
        : await readSession(requestedSessionId);
      persistSessionId(snapshot.sessionId);
      const conversation = await readConversation(snapshot.sessionId);
      return { sessionId: snapshot.sessionId, snapshot, conversation };
    },
    subscribe(sessionId, handlers, lastEventId) {
      const controller = new AbortController();
      let cursor = lastEventId;
      const run = async (): Promise<void> => {
        while (!controller.signal.aborted) {
          try {
            const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/events`, {
              credentials: "same-origin",
              headers: cursor === undefined ? {} : { "last-event-id": cursor },
              signal: controller.signal,
            });
            if (!response.ok || response.body === null) throw new Error(`SSE request rejected (${response.status}).`);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const parser = new SseEventParser();
            while (!controller.signal.aborted) {
              const { done, value } = await reader.read();
              if (done) break;
              for (const event of parser.push(decoder.decode(value, { stream: true }))) {
                if (event.id !== undefined) cursor = event.id;
                if (event.event === "replay_truncated") {
                  handlers.onSnapshot(await readSession(sessionId), cursor);
                  continue;
                }
                deliverSsePayload(event, handlers);
              }
            }
          } catch (error) {
            if (controller.signal.aborted) return;
            handlers.onError(normalizeError(error, "transient_error", "The workspace event stream was interrupted.", "Wait for automatic reconnection or refresh the workspace."));
          }
          if (!controller.signal.aborted) await delay(250, controller.signal);
        }
      };
      void run();
      return () => {
        controller.abort();
      };
    },
    async uploadWorkbook(sessionId, expectedRevision, file) {
      const form = new FormData();
      form.set("kind", "workbook");
      form.set("file", file);
      const uploadResponse = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/files`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": await readCsrfToken() },
        body: form,
      });
      const upload = await parseJsonResponse(uploadResponse) as { readonly artifactId?: unknown; readonly contentHash?: unknown };
      if (typeof upload.artifactId !== "string" || typeof upload.contentHash !== "string") {
        throw createTypedError({ code: "validation_error", summary: "The server did not return a governed workbook reference.", suggestedAction: "Upload the workbook again.", affectedInputReferences: [sessionId] });
      }
      const snapshot = await submitCommandInternal({
        sessionId,
        expectedRevision,
        command: "upload_workbook",
        payload: {
          artifactId: upload.artifactId,
          inputClassification: "confidential",
        } as F8PublicSessionCommand["payload"],
      });
      return { snapshot, workbookHash: upload.contentHash };
    },
    async replaceWorkbook(sessionId, expectedRevision, previousWorkbookHash, file) {
      const form = new FormData();
      form.set("kind", "workbook");
      form.set("file", file);
      const uploadResponse = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/files`, {
        method: "POST", credentials: "same-origin", headers: { "x-csrf-token": await readCsrfToken() }, body: form,
      });
      const upload = await parseJsonResponse(uploadResponse) as { readonly artifactId?: unknown; readonly contentHash?: unknown };
      if (typeof upload.artifactId !== "string" || typeof upload.contentHash !== "string") {
        throw createTypedError({ code: "validation_error", summary: "The server did not return a governed replacement workbook reference.", suggestedAction: "Upload the replacement workbook again.", affectedInputReferences: [sessionId] });
      }
      const snapshot = await submitCommandInternal({
        sessionId, expectedRevision, command: "replace_workbook",
        payload: { artifactId: upload.artifactId, previousWorkbookHash, inputClassification: "confidential" },
      });
      return { snapshot, workbookHash: upload.contentHash };
    },
    async readF2Findings(sessionId) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/findings/f2`, { credentials: "same-origin" });
      return f2FindingsDecisionProjectionSchema.parse(await parseJsonResponse(response));
    },
    async submitCommand(sessionId, expectedRevision, command, payload) {
      return submitCommandInternal({ sessionId, expectedRevision, command, payload });
    },
    async calculateWhatIf(sessionId, input) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/what-if/calculate`, {
        method: "POST",
        credentials: "same-origin",
        headers: await mutationHeaders(),
        body: JSON.stringify(input),
      });
      return f8ScenarioDraftSchema.parse(await parseJsonResponse(response));
    },
    async calculateWorksheetWhatIf(sessionId, input) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/what-if/calculate-worksheet`, {
        method: "POST", credentials: "same-origin", headers: await mutationHeaders(), body: JSON.stringify(input),
      });
      return f8ScenarioDraftSchema.parse(await parseJsonResponse(response));
    },
    async createF6InputDraft(sessionId, input) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/f6-input-drafts`, {
        method: "POST",
        credentials: "same-origin",
        headers: await mutationHeaders(),
        body: JSON.stringify(input),
      });
      return await parseJsonResponse(response) as F6InputDraftCreateResult;
    },
    async readF6InputDraft(sessionId, draftId) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/f6-input-drafts/${encodeURIComponent(draftId)}`, {
        credentials: "same-origin",
      });
      return await parseJsonResponse(response) as F6InputDraftReadResult;
    },
    async appendConversationTurn(turn, selection) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(turn.sessionId)}/conversation`, {
        method: "POST",
        credentials: "same-origin",
        headers: await mutationHeaders(),
        body: JSON.stringify({ turn, selection }),
      });
      return conversationTurnSchema.parse(await parseJsonResponse(response));
    },
    readConversation,
    async readAdoProjection(sessionId) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/ado`, { credentials: "same-origin" });
      return f8AdoProjectionSchema.parse(await parseJsonResponse(response));
    },
    async confirmAdoWrite(sessionId, confirmation) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/ado/confirm`, {
        method: "POST",
        credentials: "same-origin",
        headers: await mutationHeaders(),
        body: JSON.stringify(confirmation),
      });
      await parseJsonResponse(response);
    },
    async reconcileAdoWrite(sessionId) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/ado/reconcile`, {
        method: "POST",
        credentials: "same-origin",
        headers: await mutationHeaders(),
      });
      await parseJsonResponse(response);
    },
    async startNewAdoWriteGeneration(sessionId) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/ado/start-new-write-generation`, {
        method: "POST",
        credentials: "same-origin",
        headers: await mutationHeaders(),
      });
      return f8SessionSnapshotSchema.parse(await parseJsonResponse(response));
    },
    artifactUrl(sessionId, artifactId, disposition = "attachment") {
      return `/api/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifactId)}?disposition=${disposition}`;
    },
    async loadArtifactJson(sessionId, artifactId, kind) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifactId)}`, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      if (response.status === 404) {
        return undefined;
      }
      const data = JSON.parse(await response.text()) as unknown;
      switch (kind) {
        case "f2_report":
          return f2UserReportSchema.parse(data);
        case "f3_report":
          return drawingGovernanceResultV2Schema.parse(data);
        case "f4_calculation":
        case "f4_report":
          return f4WorkflowCalculationResultSchema.parse(data);
        case "f5_report":
          return f5DataInterpretationResultSchema.parse(data);
        case "f6_optimization":
        case "f6_report":
          return f6ReadableOptimizationResultSchema.parse(data);
        default:
          return undefined;
      }
    },
  };

  async function createSession(): Promise<F8SessionSnapshot> {
    const response = await fetch("/api/sessions", {
      method: "POST",
      credentials: "same-origin",
      headers: await mutationHeaders(),
      body: JSON.stringify({
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
        source: "web",
      }),
    });
    const snapshot = f8SessionSnapshotSchema.parse(await parseJsonResponse(response));
    csrfToken = undefined;
    return snapshot;
  }

  async function readSession(sessionId: string): Promise<F8SessionSnapshot> {
    const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { credentials: "same-origin" });
    return f8SessionSnapshotSchema.parse(await parseJsonResponse(response));
  }

  async function readConversation(sessionId: string): Promise<readonly ConversationTurn[]> {
    const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/conversation`, { credentials: "same-origin" });
    const data = await parseJsonResponse(response) as { readonly turns?: unknown };
    if (!Array.isArray(data.turns)) {
      return [];
    }
    return data.turns.map((turn) => conversationTurnSchema.parse(turn));
  }

  async function submitCommandInternal<TPayload extends F8PublicSessionCommand["payload"]>(
    options: { readonly sessionId: string; readonly expectedRevision: number; readonly command: F8CommandKind; readonly payload: TPayload },
  ): Promise<F8SessionSnapshot> {
    const response = await fetch(`/api/sessions/${encodeURIComponent(options.sessionId)}/commands`, {
      method: "POST",
      credentials: "same-origin",
      headers: await mutationHeaders(),
      body: JSON.stringify({
        contractVersion: "f8-session-command-v1",
        sessionId: options.sessionId,
        commandId: globalThis.crypto.randomUUID(),
        expectedRevision: options.expectedRevision,
        command: options.command,
        payload: options.payload,
      }),
    });
    return f8SessionSnapshotSchema.parse(await parseJsonResponse(response));
  }

  async function mutationHeaders(): Promise<Record<string, string>> {
    const token = await readCsrfToken();
    return {
      "content-type": "application/json",
      "x-csrf-token": token,
    };
  }

  async function readCsrfToken(): Promise<string> {
    if (csrfToken !== undefined) {
      return csrfToken;
    }

    const response = await fetch("/api/csrf", { credentials: "same-origin" });
    const data = await parseJsonResponse(response) as { readonly csrfToken?: unknown };
    if (typeof data.csrfToken !== "string" || data.csrfToken.length === 0) {
      throw createTypedError({
        code: "policy_denied",
        summary: "The workspace did not receive a CSRF token.",
        suggestedAction: "Refresh the workspace to re-establish the governed browser session.",
        affectedInputReferences: ["csrf"],
      });
    }

    csrfToken = data.csrfToken;
    return csrfToken;
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  const data = text.length === 0 ? undefined : JSON.parse(text) as unknown;
  if (response.ok) {
    return data;
  }

  const parsedError = typedErrorSchema.safeParse((data as { readonly error?: unknown } | undefined)?.error);
  throw parsedError.success
    ? createTypedError(parsedError.data)
    : normalizeError(data, "validation_error", "The workspace request was rejected.", "Review the current state and try again.", response.status);
}

function normalizeError(
  error: unknown,
  code: TypedError["code"],
  summary: string,
  suggestedAction: string,
  statusCode?: number,
): TypedError {
  const typed = typeof error === "object" && error !== null ? error as Partial<TypedError> : undefined;
  return createTypedError({
    code: typed?.code ?? code,
    runId: typed?.runId,
    retryable: typed?.retryable,
    summary: typeof typed?.summary === "string" && typed.summary.length > 0 ? typed.summary : summary,
    suggestedAction: typeof typed?.suggestedAction === "string" && typed.suggestedAction.length > 0 ? typed.suggestedAction : suggestedAction,
    affectedInputReferences: Array.isArray(typed?.affectedInputReferences)
      ? typed.affectedInputReferences.filter((value): value is string => typeof value === "string")
      : statusCode === undefined ? [] : [String(statusCode)],
  });
}

function parseSseBlock(block: string): ParsedSseEvent | undefined {
  if (block.length === 0) return undefined;
  let id: string | undefined;
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "id") id = value;
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  return data.length === 0 ? undefined : { id, event, data: data.join("\n") };
}

function deliverSsePayload(event: ParsedSseEvent, handlers: WorkbenchSubscriptionHandlers): void {
  try {
    const payload = JSON.parse(event.data) as unknown;
    const progress = parseRunnerProgress(payload);
    if (event.event === "runner_progress" && progress !== undefined) {
      handlers.onProgress?.(progress, event.id);
      return;
    }
    const parsedSnapshot = f8SessionSnapshotSchema.safeParse(payload);
    if (parsedSnapshot.success) {
      handlers.onSnapshot(parsedSnapshot.data, event.id);
      return;
    }
    const parsedEvent = f8SessionEventSchema.safeParse(payload);
    if (parsedEvent.success && "snapshot" in parsedEvent.data && parsedEvent.data.snapshot !== undefined) {
      handlers.onSnapshot(parsedEvent.data.snapshot, event.id ?? parsedEvent.data.eventId);
    }
  } catch (error) {
    handlers.onError(normalizeError(error, "transient_error", "Browser event stream parsing failed.", "Refresh the workspace and try again."));
  }
}

function parseRunnerProgress(value: unknown): RunnerProgressEvent | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<RunnerProgressEvent>;
  if (!["stage_started", "stage_completed", "stage_failed", "artifact_written"].includes(candidate.kind ?? "")) return undefined;
  if (!["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"].includes(candidate.featureId ?? "")) return undefined;
  if (typeof candidate.stage !== "string" || candidate.stage.length === 0 || typeof candidate.timestamp !== "string" || Number.isNaN(Date.parse(candidate.timestamp))) return undefined;
  return candidate as RunnerProgressEvent;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function readSessionIdFromUrl(): string | undefined {
  const url = new URL(globalThis.location.href);
  const sessionId = url.searchParams.get(SESSION_QUERY_KEY);
  return sessionId === null || sessionId.length === 0 || sessionId === "pending" || sessionId === "created-in-browser" ? undefined : sessionId;
}

function persistSessionId(sessionId: string): void {
  const url = new URL(globalThis.location.href);
  url.searchParams.set(SESSION_QUERY_KEY, sessionId);
  globalThis.history.replaceState({}, "", url);
}
