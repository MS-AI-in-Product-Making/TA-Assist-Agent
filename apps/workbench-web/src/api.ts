import {
  conversationTurnSchema,
  createTypedError,
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f8SessionEventSchema,
  f8SessionSnapshotSchema,
  typedErrorSchema,
  type ConversationTurn,
  type DrawingGovernanceResultV2,
  type F2UserReport,
  type TypedError,
} from "@ai-assist/contracts";
import type { F8CommandKind, F8SessionCommand, F8SessionSnapshot } from "./workbench-session.js";

export interface BootstrapResult {
  readonly sessionId: string;
  readonly snapshot: F8SessionSnapshot;
  readonly conversation: readonly ConversationTurn[];
  readonly pendingWorkbookHash?: string;
}

export interface WorkbenchSubscriptionHandlers {
  readonly onSnapshot: (snapshot: F8SessionSnapshot, eventId?: string) => void;
  readonly onError: (error: TypedError) => void;
}

export interface ParsedSseEvent {
  readonly id?: string;
  readonly event: string;
  readonly data: string;
}

export class SseEventParser {
  private buffer = "";

  push(chunk: string): readonly ParsedSseEvent[] {
    this.buffer += chunk.replace(/\r\n/g, "\n");
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
}

export interface WorkbenchApi {
  bootstrap(): Promise<BootstrapResult>;
  subscribe(sessionId: string, handlers: WorkbenchSubscriptionHandlers, lastEventId?: string): () => void;
  uploadWorkbook(sessionId: string, expectedRevision: number, file: File): Promise<{ readonly snapshot: F8SessionSnapshot; readonly workbookHash: string }>;
  submitCommand<TPayload extends F8SessionCommand["payload"]>(
    sessionId: string,
    expectedRevision: number,
    command: F8CommandKind,
    payload: TPayload,
  ): Promise<F8SessionSnapshot>;
  appendConversationTurn(turn: ConversationTurn): Promise<ConversationTurn>;
  loadArtifactJson(sessionId: string, artifactId: string, kind: "f2_report" | "f3_report"): Promise<F2UserReport | DrawingGovernanceResultV2 | undefined>;
}

const SESSION_QUERY_KEY = "session";

export function createWorkbenchApi(): WorkbenchApi {
  let csrfToken: string | undefined;

  return {
    async bootstrap() {
      const requestedSessionId = readSessionIdFromUrl();
      const snapshot = requestedSessionId === undefined
        ? await createSession()
        : await readSession(requestedSessionId).catch(async () => createSession());
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
            handlers.onError(normalizeError(error, "transient_error", "工作台事件流已中断。", "等待自动重连，或刷新工作台。"));
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
        throw createTypedError({ code: "validation_error", summary: "服务器未返回受管 workbook 引用。", suggestedAction: "重新上传 workbook。", affectedInputReferences: [sessionId] });
      }
      const snapshot = await submitCommandInternal({
        sessionId,
        expectedRevision,
        command: "upload_workbook",
        payload: {
          artifactId: upload.artifactId,
          inputClassification: "confidential",
        } as F8SessionCommand["payload"],
      });
      return { snapshot, workbookHash: upload.contentHash };
    },
    async submitCommand(sessionId, expectedRevision, command, payload) {
      return submitCommandInternal({ sessionId, expectedRevision, command, payload });
    },
    async appendConversationTurn(turn) {
      const response = await fetch(`/api/sessions/${encodeURIComponent(turn.sessionId)}/conversation`, {
        method: "POST",
        credentials: "same-origin",
        headers: await mutationHeaders(),
        body: JSON.stringify(turn),
      });
      return conversationTurnSchema.parse(await parseJsonResponse(response));
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
      return kind === "f2_report" ? f2UserReportSchema.parse(data) : drawingGovernanceResultV2Schema.parse(data);
    },
  };

  async function createSession(): Promise<F8SessionSnapshot> {
    const response = await fetch("/api/sessions", {
      method: "POST",
      credentials: "same-origin",
      headers: await mutationHeaders(),
    });
    return f8SessionSnapshotSchema.parse(await parseJsonResponse(response));
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

  async function submitCommandInternal<TPayload extends F8SessionCommand["payload"]>(
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
        summary: "工作台未获取到 CSRF token。",
        suggestedAction: "刷新工作台以重新建立受控浏览器会话。",
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
    : normalizeError(data, "validation_error", "工作台请求被拒绝。", "检查当前状态后重试。", response.status);
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
    handlers.onError(normalizeError(error, "transient_error", "浏览器事件流解析失败。", "刷新工作台后重试。"));
  }
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
  return sessionId === null || sessionId.length === 0 ? undefined : sessionId;
}

function persistSessionId(sessionId: string): void {
  const url = new URL(globalThis.location.href);
  url.searchParams.set(SESSION_QUERY_KEY, sessionId);
  globalThis.history.replaceState({}, "", url);
}
