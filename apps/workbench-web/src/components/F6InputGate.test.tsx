import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { F6InputGate } from "./F6InputGate.js";

afterEach(cleanup);

describe("F6InputGate", () => {
  it("shows natural-language prompts and never exposes JSON/path/hash guidance", () => {
    render(
      <F6InputGate
        kind="analysis_context"
        snapshot={{
          contractVersion: "f8-session-snapshot-v1",
          sessionId: "session-1",
          revision: 8,
          inputRevision: 3,
          state: "analysis_context_decision_required",
          activeAttempt: null,
          priorRunReferences: [],
        } as never}
        onSendMessage={vi.fn(async () => undefined)}
        onSubmitDecision={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("heading", { name: "补充/确认分析背景" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "补充分析背景" })).toHaveAttribute("placeholder", "直接描述产品功能、装配关系、工况、功能边界或关注点");
    expect(screen.queryByText(/json|artifact path|runtime\/workbench|sha256|C:\\/i)).not.toBeInTheDocument();
  });

  it("loads preview, enables confirmation only when preview-ready, and keeps one gate active", async () => {
    const onSubmitDecision = vi.fn(async () => undefined);
    const readF6InputDraft = vi.fn(async () => ({
      pendingDraft: {
        draftId: "draft-opt-1",
        kind: "optimization_targets",
        inputRevision: 3,
        reviewContextId: "a".repeat(64),
        artifactId: "f6-input-draft:optimization_targets:draft-opt-1",
        contentHash: "b".repeat(64),
        status: "preview_required",
      },
      materialization: {
        proposal: {
          proposalVersion: "f6-optimization-targets-proposal-v1",
          userText: "Prioritize tightening gap tolerance.",
          directions: [],
          clarifications: [{ clarificationId: "c1", reasonCode: "proposal_ambiguous", question: "Specify the target factor.", requiredFields: ["factorSelector"] }],
        },
        preview: {
          artifact: {
            worksheets: [{
              worksheetName: "Analysis-A",
              targets: [{
                targetType: "factor_tolerance",
                factor: { factorName: "Gap" },
                lowerTolerance: -0.03,
                upperTolerance: 0.04,
                unit: "mm",
              }],
            }],
          },
        },
      },
      confirmed: false,
    }));

    const snapshot = {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: "session-1",
      revision: 8,
      inputRevision: 3,
      state: "optimization_targets_decision_required",
      activeAttempt: null,
      priorRunReferences: [],
      pendingOptimizationTargetsDraft: {
        draftId: "draft-opt-1",
        kind: "optimization_targets",
        inputRevision: 3,
        reviewContextId: "a".repeat(64),
        artifactId: "f6-input-draft:optimization_targets:draft-opt-1",
        contentHash: "b".repeat(64),
        status: "preview_required",
      },
    } as never;

    render(
      <>
        <F6InputGate
          kind="analysis_context"
          snapshot={snapshot}
          api={{ readF6InputDraft } as never}
          sessionId="session-1"
          onSendMessage={vi.fn(async () => undefined)}
          onSubmitDecision={onSubmitDecision}
        />
        <F6InputGate
          kind="optimization_targets"
          snapshot={snapshot}
          api={{ readF6InputDraft } as never}
          sessionId="session-1"
          onSendMessage={vi.fn(async () => undefined)}
          onSubmitDecision={onSubmitDecision}
        />
      </>,
    );

    expect(screen.queryByRole("heading", { name: "补充/确认分析背景" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "补充/确认优化方向" })).toBeVisible();

    const confirmButton = screen.getByRole("button", { name: "确认优化方向" });
    expect(confirmButton).toBeDisabled();

    await waitFor(() => expect(readF6InputDraft).toHaveBeenCalledWith("session-1", "draft-opt-1"));
    await waitFor(() => expect(confirmButton).toBeEnabled());

    expect(screen.getByText("Specify the target factor.")).toBeVisible();
    expect(screen.getByText(/Analysis-A \| Gap \| Requirement change: factor_tolerance \| \[-0.03, 0.04\] mm/)).toBeVisible();

    fireEvent.click(confirmButton);
    await waitFor(() => expect(onSubmitDecision).toHaveBeenCalledWith("confirm_optimization_targets", {
      decision: "confirm",
      draftId: "draft-opt-1",
      draftHash: "b".repeat(64),
    }));
  });
});
