import { describe, expect, it, vi } from "vitest";

import { SseEventParser, buildWorksheetBoundF1ImageArtifactUrl, createWorkbenchApi } from "./api.js";

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
  it("encodes worksheet-bound F1 image artifact URLs with URLSearchParams", () => {
    const url = buildWorksheetBoundF1ImageArtifactUrl({
      sessionId: "session 1",
      contentHash: "a".repeat(64),
      worksheetName: "Analysis A (rev 2)",
      relativePath: "worksheets/Analysis A\\loop image (1).png",
    });

    expect(url).toContain("/api/sessions/session%201/artifacts/f1-image%3A");
    expect(url).toContain("disposition=inline");
    expect(url).toContain("worksheet=Analysis+A+%28rev+2%29");
    expect(url).toContain("path=worksheets%2FAnalysis+A%5Cloop+image+%281%29.png");
  });

  it("creates a session with a valid empty JSON request body", async () => {
    vi.stubGlobal("location", { href: "http://127.0.0.1/" });
    vi.stubGlobal("history", { replaceState: vi.fn() });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot()), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ turns: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createWorkbenchApi().bootstrap();

    expect(fetchMock.mock.calls[1]).toEqual(["/api/sessions", expect.objectContaining({ method: "POST", body: "{}" })]);
  });

  it("never replaces a requested session with a random new session when authentication fails", async () => {
    vi.stubGlobal("location", { href: "http://127.0.0.1/?session=expected-session" });
    vi.stubGlobal("history", { replaceState: vi.fn() });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "session_scope_rejected" }), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createWorkbenchApi().bootstrap()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/sessions/expected-session", expect.anything());
  });

  it("validates F4 calculation artifacts instead of silently discarding them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    await expect(createWorkbenchApi().loadArtifactJson("session-1", "f4-current", "f4_calculation")).rejects.toThrow();
  });

  it("reads the sanitized ADO projection and confirms a preview with CSRF", async () => {
    const projection = {
      contractVersion: "f8-ado-projection-v1",
      sessionId: "session-1",
      state: "validation_pending",
      actionId: "ado-validation:session-1:2",
      expectedRevision: 2,
      startedAt: "2026-08-31T00:00:00.000Z",
      expiresAt: "2026-08-31T00:15:00.000Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(projection), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ actionId: "ado-write:session-1:2" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createWorkbenchApi();

    expect(await api.readAdoProjection("session-1")).toEqual(projection);
    await api.confirmAdoWrite("session-1", {
      contractVersion: "f8-ado-write-confirmation-v1",
      validationActionId: "ado-validation:session-1:2",
      expectedRevision: 2,
      target: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com" },
      contentHash: "c".repeat(64),
      confirmationHash: "b".repeat(64),
      confirmed: true,
    });

    expect(fetchMock.mock.calls[2]).toEqual(["/api/sessions/session-1/ado/confirm", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-csrf-token": "csrf" }) })]);
  });

  it("requests readback reconciliation with CSRF and without retry-write payload", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ actionId: "ado-reconcile:session-1:2" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createWorkbenchApi();

    await api.reconcileAdoWrite("session-1");

    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/sessions/session-1/ado/reconcile",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-csrf-token": "csrf" }) }),
    ]);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).body).toBeUndefined();
  });

  it("starts a new ADO write generation through the dedicated browser mutation with CSRF", async () => {
    const nextSnapshot = snapshot({ revision: 9, state: "ado_action_pending" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(nextSnapshot), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createWorkbenchApi();

    await api.startNewAdoWriteGeneration("session-1");

    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/sessions/session-1/ado/start-new-write-generation",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-csrf-token": "csrf" }) }),
    ]);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).body).toBeUndefined();
  });

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

  it("reads and validates the governed current F2 findings projection", async () => {
    const projection = {
      contractVersion: "f2-findings-decision-projection-v1",
      workbookHash: "a".repeat(64), inputRevision: 2, f2ReportArtifactId: "f2-current", f2ReportContentHash: "b".repeat(64), findingDigest: "c".repeat(64),
      worksheetFindings: [{ contractVersion: "f2-worksheet-finding-projection-v1", worksheetName: "Analysis-A", readiness: "downstream_ready", identifierWarnings: [], blockers: [], sourceRows: [] }],
      downstreamReadyWorksheetNames: ["Analysis-A"],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(projection), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await createWorkbenchApi().readF2Findings("session-1")).toEqual(projection);
    expect(fetchMock).toHaveBeenCalledWith("/api/sessions/session-1/findings/f2", { credentials: "same-origin" });
  });

  it("replaces a workbook through managed upload without sending browser file bytes in JSON", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ artifactId: "managed-replacement", contentHash: "d".repeat(64) }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot({ revision: 4 })), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createWorkbenchApi();

    await api.replaceWorkbook("session-1", 3, "a".repeat(64), new File(["replacement"], "replacement.xlsx"));

    expect((fetchMock.mock.calls[1]![1] as RequestInit).body).toBeInstanceOf(FormData);
    expect(JSON.parse(String((fetchMock.mock.calls[2]![1] as RequestInit).body))).toMatchObject({
      command: "replace_workbook",
      payload: { artifactId: "managed-replacement", previousWorkbookHash: "a".repeat(64), inputClassification: "confidential" },
    });
  });

  it("refreshes CSRF after browser session rotation before the first upload", async () => {
    vi.stubGlobal("location", { href: "http://127.0.0.1/" });
    vi.stubGlobal("history", { replaceState: vi.fn() });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "bootstrap-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot()), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ turns: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "session-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ artifactId: "managed-workbook", contentHash: "a".repeat(64) }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot()), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createWorkbenchApi();
    await api.bootstrap();
    await api.uploadWorkbook("session-1", 1, new File(["workbook"], "book.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(fetchMock.mock.calls[3]?.[0]).toBe("/api/csrf");
    expect((fetchMock.mock.calls[4]?.[1] as RequestInit).headers).toMatchObject({ "x-csrf-token": "session-csrf" });
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

  it("delivers governed runner progress from the session event stream", async () => {
    const progress = { kind: "stage_started", featureId: "F2", stage: "report", timestamp: "2026-08-28T00:00:00.000Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(streamResponse(`id: 3\nevent: runner_progress\ndata: ${JSON.stringify(progress)}\n\n`)));
    const onProgress = vi.fn();
    const api = createWorkbenchApi();
    const dispose = api.subscribe("session-1", { onSnapshot: vi.fn(), onProgress, onError: vi.fn() });

    await Promise.resolve();
    await Promise.resolve();
    dispose();

    expect(onProgress).toHaveBeenCalledWith(progress, "3");
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
    interactionLanguage: {
      languageTag: "en-US",
      uiCatalogLanguage: "en",
      lockedAtTurnId: "turn-en",
      source: "workflow_start",
      fallbackUsed: false,
    },
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