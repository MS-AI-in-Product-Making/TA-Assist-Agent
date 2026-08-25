import { describe, expect, it, vi } from "vitest";

import { SseEventParser, createWorkbenchApi } from "./api.js";

describe("SseEventParser", () => {
  it("parses event, id, and data across chunk boundaries", () => {
    const parser = new SseEventParser();

    expect(parser.push("id: 17\nevent: snapshot\ndata: {\"revision\":")).toEqual([]);
    expect(parser.push("2}\n\n")).toEqual([{ id: "17", event: "snapshot", data: '{"revision":2}' }]);
  });

  it("preserves split CRLF delimiters and concatenates multiline data", () => {
    const parser = new SseEventParser();

    expect(parser.push("id: 18\r")).toEqual([]);
    expect(parser.push("\nevent: snapshot\r\ndata: {\"revision\":\r\ndata: 3}\r\n\r")).toEqual([]);
    expect(parser.push("\n")).toEqual([{ id: "18", event: "snapshot", data: '{"revision":\n3}' }]);
  });

  it("accepts fragmented UTF-8 decoded through TextDecoder streaming", () => {
    const parser = new SseEventParser();
    const decoder = new TextDecoder();
    const bytes = new TextEncoder().encode("event: snapshot\ndata: {\"label\":\"\u4e2d\u6587\"}\n\n");
    const splitAt = bytes.indexOf(0xe4) + 1;

    expect(parser.push(decoder.decode(bytes.slice(0, splitAt), { stream: true }))).toEqual([]);
    expect(parser.push(decoder.decode(bytes.slice(splitAt), { stream: true }) + decoder.decode())).toEqual([
      { event: "snapshot", data: '{"label":"\u4e2d\u6587"}' },
    ]);
  });
});

describe("workbench browser API", () => {
  it("uploads a multipart workbook then submits only its managed artifact reference", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ artifactId: "managed-workbook", contentHash: "a".repeat(64) }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot()), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createWorkbenchApi();

    await api.uploadWorkbook("session-1", 3, new File(["workbook"], "book.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));

    const uploadRequest = fetchMock.mock.calls[1]![1] as RequestInit;
    expect(uploadRequest.body).toBeInstanceOf(FormData);
    const commandRequest = fetchMock.mock.calls[2]![1] as RequestInit;
    expect(JSON.parse(String(commandRequest.body))).toMatchObject({
      command: "upload_workbook",
      payload: { artifactId: "managed-workbook", inputClassification: "confidential" },
    });
  });

  it("reconnects fetch SSE with Last-Event-ID and refreshes after replay truncation", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(streamResponse("id: 8\nevent: replay_truncated\ndata: {}\n\n"))
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot({ revision: 8 })), { status: 200 }))
      .mockResolvedValueOnce(streamResponse("id: 9\nevent: snapshot\ndata: " + JSON.stringify(snapshot({ revision: 9 })) + "\n\n"));
    vi.stubGlobal("fetch", fetchMock);
    const snapshots: number[] = [];
    const api = createWorkbenchApi();
    const dispose = api.subscribe("session-1", { onSnapshot: (next) => snapshots.push(next.revision), onError: vi.fn() });

    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    dispose();

    expect(fetchMock.mock.calls[1]![0]).toBe("/api/sessions/session-1");
    expect(fetchMock.mock.calls[2]![1]).toMatchObject({ headers: { "last-event-id": "8" }, credentials: "same-origin" });
    expect(snapshots).toEqual([8, 9]);
    vi.useRealTimers();
  });
});

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: "session-1",
    revision: 1,
    inputRevision: 0,
    state: "created",
    activeAttempt: null,
    priorRunReferences: [],
    ...overrides,
  };
}

function streamResponse(text: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}