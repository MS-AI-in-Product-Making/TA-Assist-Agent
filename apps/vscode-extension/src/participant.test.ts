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

  it("uses the current request model and returns without persistence when cancelled", async () => {
    const handleTurn = vi.fn();
    await handleParticipant({ prompt: "继续", command: undefined, model: { id: "current" } }, { history: [] }, { progress: vi.fn(), markdown: vi.fn(), button: vi.fn() }, { isCancellationRequested: true }, { sessionId: SESSION_ID, handleTurn, commandId: () => "cancelled" });
    expect(handleTurn).not.toHaveBeenCalled();
  });
});
