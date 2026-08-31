import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationPane } from "./ConversationPane.js";

describe("ConversationPane", () => {
  it("renders pending assistant state in English and labels governed evidence references", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(
      <ConversationPane
        disabled={false}
        onSubmit={onSubmit}
        turns={[
          {
            contractVersion: "ta-conversation-turn-v1",
            turnId: "turn-user-1",
            sessionId: "session-1",
            sequence: 0,
            source: "web",
            role: "user",
            content: [{ kind: "text", text: "Summarize the governed evidence." }],
            createdAt: "2026-08-31T00:00:00.000Z",
            relatedArtifactIds: ["f2-current", "f4-current"],
          },
          {
            contractVersion: "ta-conversation-turn-v1",
            turnId: "turn-assistant-1",
            sessionId: "session-1",
            sequence: 1,
            source: "system",
            role: "assistant",
            content: [
              { kind: "text", text: "等待 VS Code 模型回答…" },
              { kind: "artifact_reference", artifactId: "f2-current", label: "F2 factor table" },
              { kind: "decision_reference", decisionReference: "review:current" },
            ],
            createdAt: "2026-08-31T00:00:05.000Z",
            relatedArtifactIds: ["f2-current", "f4-current"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Waiting for VS Code model response...")).toBeVisible();
    expect(screen.getByText("Pending model response")).toBeVisible();
    expect(screen.getByText("Evidence: F2 factor table")).toBeVisible();
    expect(screen.getByText("Decision record: review:current")).toBeVisible();

    fireEvent.change(screen.getByRole("textbox", { name: "Ask TA Assist from governed evidence" }), {
      target: { value: "Compare the baseline and Scenario." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Compare the baseline and Scenario."));
  });
});