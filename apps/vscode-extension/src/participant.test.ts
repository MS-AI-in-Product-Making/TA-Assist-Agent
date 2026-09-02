import { describe, expect, it, vi } from "vitest";

import { handleParticipant } from "./participant.js";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";

describe("handleParticipant", () => {
  it("persists the current participant request but never imports native chat history", async () => {
    const handleTurn = vi.fn(async () => ({ responseText: "继续选择 worksheets。", actions: [{ type: "navigate" as const, target: "/scope", label: "选择 Worksheets" }], commands: [] }));
    const stream = { progress: vi.fn(), markdown: vi.fn(), button: vi.fn() };

    await handleParticipant({ prompt: "继续分析", command: "resume", model: {} }, {
      history: [{ prompt: "unrelated copilot turn" }],
    }, stream, { isCancellationRequested: false }, { sessionId: SESSION_ID, handleTurn, commandId: () => "participant-command" });

    expect(handleTurn).toHaveBeenCalledWith({ text: "继续分析", sessionId: SESSION_ID, commandId: "participant-command", source: "vscode" }, expect.objectContaining({ model: {} }));
    expect(JSON.stringify(handleTurn.mock.calls)).not.toContain("unrelated copilot turn");
    expect(stream.markdown).toHaveBeenCalledWith("继续选择 worksheets。");
    expect(stream.button).toHaveBeenCalledWith({ command: "ta-assist.openAction", title: "选择 Worksheets", arguments: ["/scope"] });
  });

  it("forwards only the current prompt even when native history contains stale evidence text or local paths", async () => {
    const handleTurn = vi.fn(async () => ({ responseText: "等待当前 session。", actions: [], commands: [] }));

    await handleParticipant({ prompt: "Explain the governed evidence.", command: undefined, model: {} }, {
      history: [{ prompt: "Governed evidence\n- Session: stale\n- Local path: C:\\sensitive\\worksheet.xlsx" }],
    }, { progress: vi.fn(), markdown: vi.fn(), button: vi.fn() }, { isCancellationRequested: false }, { sessionId: SESSION_ID, handleTurn, commandId: () => "participant-current-only" });

    expect(handleTurn).toHaveBeenCalledWith({ text: "Explain the governed evidence.", sessionId: SESSION_ID, commandId: "participant-current-only", source: "vscode" }, expect.objectContaining({ model: {} }));
    expect(JSON.stringify(handleTurn.mock.calls)).not.toContain("C:\\sensitive\\worksheet.xlsx");
    expect(JSON.stringify(handleTurn.mock.calls)).not.toContain("Session: stale");
  });

  it("routes natural-language TA analyze before ordinary participant conversation", async () => {
    const handleTurn = vi.fn(async () => ({ responseText: "should not run", actions: [], commands: [] }));
    const handleAnalyzeIntent = vi.fn(async () => "TA Assist Workbench is ready. Upload a workbook to begin.");
    const stream = { progress: vi.fn(), markdown: vi.fn(), button: vi.fn() };

    await handleParticipant({ prompt: "帮我分析 \"C:\\TA Reports\\report.xlsx\"", command: undefined, model: {} }, {
      history: [{ prompt: "stale session text" }],
    }, stream, { isCancellationRequested: false }, {
      sessionId: SESSION_ID,
      handleTurn,
      handleAnalyzeIntent,
      commandId: () => "participant-analyze-intent",
    });

    expect(handleAnalyzeIntent).toHaveBeenCalledWith({ kind: "analyze_ta", workbookPath: "C:\\TA Reports\\report.xlsx" });
    expect(handleTurn).not.toHaveBeenCalled();
    expect(stream.markdown).toHaveBeenCalledWith("TA Assist Workbench is ready. Upload a workbook to begin.");
  });

  it("prioritizes current-session continuation over natural-language analyze", async () => {
    const handleTurn = vi.fn(async () => ({ responseText: "继续沿用当前 session。", actions: [], commands: [] }));
    const handleAnalyzeIntent = vi.fn(async () => "should not run");
    const stream = { progress: vi.fn(), markdown: vi.fn(), button: vi.fn() };

    await handleParticipant({ prompt: "继续分析当前 session 的 factor table", command: undefined, model: {} }, {
      history: [],
    }, stream, { isCancellationRequested: false }, {
      sessionId: SESSION_ID,
      handleTurn,
      handleAnalyzeIntent,
      commandId: () => "participant-current-session-priority",
    });

    expect(handleAnalyzeIntent).not.toHaveBeenCalled();
    expect(handleTurn).toHaveBeenCalledWith({
      text: "继续分析当前 session 的 factor table",
      sessionId: SESSION_ID,
      commandId: "participant-current-session-priority",
      source: "vscode",
    }, expect.objectContaining({ model: {} }));
  });

  it("rejects malformed natural-language analyze requests before ordinary conversation handling", async () => {
    const handleTurn = vi.fn(async () => ({ responseText: "should not run", actions: [], commands: [] }));
    const stream = { progress: vi.fn(), markdown: vi.fn(), button: vi.fn() };

    await handleParticipant({ prompt: "Analyze C:\\TA\\first.xlsx and C:\\TA\\second.xlsx", command: undefined, model: {} }, {
      history: [],
    }, stream, { isCancellationRequested: false }, {
      sessionId: SESSION_ID,
      handleTurn,
      commandId: () => "participant-invalid-analyze-intent",
    });

    expect(handleTurn).not.toHaveBeenCalled();
    expect(stream.markdown).toHaveBeenCalledWith("Provide exactly one Windows absolute .xlsx workbook path or one exact .xlsx workbook file name, or omit it and upload in TA Assist Workbench.");
  });

  it("uses the current request model and returns without persistence when cancelled", async () => {
    const handleTurn = vi.fn();
    await handleParticipant({ prompt: "继续", command: undefined, model: { id: "current" } }, { history: [] }, { progress: vi.fn(), markdown: vi.fn(), button: vi.fn() }, { isCancellationRequested: true }, { sessionId: SESSION_ID, handleTurn, commandId: () => "cancelled" });
    expect(handleTurn).not.toHaveBeenCalled();
  });
});
