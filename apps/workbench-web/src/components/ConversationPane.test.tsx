import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationPane } from "./ConversationPane.js";

afterEach(cleanup);

describe("ConversationPane", () => {
  it("renders pending assistant state in English and labels governed evidence references", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(
      <ConversationPane
        disabled={false}
        sessionId="session-1"
        api={{ artifactUrl: (sessionId: string, artifactId: string) => `/api/sessions/${sessionId}/artifacts/${artifactId}` } as never}
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
              { kind: "decision_reference", decisionReference: "f6-review:current" },
              { kind: "command", command: "npm run workflow:f6" },
            ],
            createdAt: "2026-08-31T00:00:05.000Z",
            relatedArtifactIds: ["f2-current", "f4-current"],
          },
          {
            contractVersion: "ta-conversation-turn-v1",
            turnId: "turn-model-1",
            sessionId: "session-1",
            sequence: 2,
            source: "vscode",
            role: "assistant",
            content: [
              { kind: "text", text: "The governed report is ready." },
              { kind: "artifact_reference", artifactId: "artifact-report-1", label: "../../Feature6-Report.md" },
              { kind: "tool_result", actions: [{ type: "open_report", target: "/report/current", label: "打开当前报告" }], commands: [] },
            ],
            createdAt: "2026-08-31T00:00:06.000Z",
            relatedArtifactIds: ["artifact-report-1"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Waiting for VS Code model response...")).toBeVisible();
    expect(screen.getByText("Pending model response")).toBeVisible();
    expect(screen.getByRole("link", { name: "Data Cleaning factor table" })).toHaveAttribute("href", "/api/sessions/session-1/artifacts/f2-current");
    expect(screen.getByText("Decision record available.")).toBeVisible();
    expect(screen.getByText("Governed command available.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Design Optimization Report" })).toHaveAttribute("href", "/api/sessions/session-1/artifacts/artifact-report-1");
    expect(screen.getByRole("link", { name: "Design Optimization Report" })).toHaveAttribute("download", "Design Optimization-Report.md");
    expect(screen.queryByText(/f6-review|workflow:f6/i)).not.toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "Conversation input" });
    expect(input).toHaveAttribute("data-user-input-id", "conversation_input");
    expect(input).toHaveAttribute("aria-describedby", "conversation_input-guidance");
    expect(screen.getByText("Analyze this workbook in Chinese.")).toBeVisible();
    fireEvent.change(input, {
      target: { value: "Compare the baseline and Scenario." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Compare the baseline and Scenario."));
  });

  it("does not treat an unrelated lone artifact as a report", () => {
    render(
      <ConversationPane
        sessionId="session-1"
        api={{ artifactUrl: () => "/artifact" } as never}
        onSubmit={vi.fn(async () => undefined)}
        turns={[{
          contractVersion: "ta-conversation-turn-v1",
          turnId: "turn-tool-1",
          sessionId: "session-1",
          sequence: 0,
          source: "vscode",
          role: "assistant",
          content: [
            { kind: "artifact_reference", artifactId: "factor-table-1", label: "Factor table" },
            { kind: "tool_result", actions: [{ type: "open_report", target: "/report/current", label: "Open report" }], commands: [] },
          ],
          createdAt: "2026-08-31T00:00:06.000Z",
          relatedArtifactIds: ["factor-table-1"],
        }]}
      />,
    );

    expect(screen.queryByRole("link", { name: "Design Optimization Report" })).not.toBeInTheDocument();
  });
});