import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdoWorkspaceDecision } from "./AdoWorkspaceDecision.js";

afterEach(cleanup);

describe("AdoWorkspaceDecision", () => {
  it("requires a complete Azure DevOps URL for an existing target", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<AdoWorkspaceDecision visible onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox", { name: "Existing work item URL" });
    fireEvent.change(input, { target: { value: "123" } });
    expect(screen.getByRole("button", { name: "Validate existing work item" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/123" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate existing work item" }));
    expect(onSubmit).toHaveBeenCalledWith("use_existing", "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/123");
  });

  it("submits a create work item decision from the inline F3 workspace controls", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<AdoWorkspaceDecision visible onSubmit={onSubmit} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create work item" }));

    expect(onSubmit).toHaveBeenCalledWith("create_new");
  });

  it("renders the complete preview and requires a separate Web confirmation", async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(<AdoWorkspaceDecision visible projection={{ contractVersion: "f8-ado-projection-v1", sessionId: "session-1", state: "preview_ready", actionId: "validation-1", expectedRevision: 2, target: { mode: "existing", workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42" }, markdown: "# Complete governance preview", contentHash: "c".repeat(64), confirmation: { status: "confirmation_required", workItemReference: "WI-42", ownerReference: "owner@example.com", commentReference: "C0", expectedVersion: "7", beforeContentHash: "a".repeat(64), nextContent: "# Complete governance preview", factorCount: 2, confirmationHash: "b".repeat(64), diff: [{ before: "old", after: "new", changed: true }] } }} onSubmit={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText("# Complete governance preview")).toBeVisible();
    expect(screen.getByText(/owner@example.com/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm ADO write" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ validationActionId: "validation-1", expectedRevision: 2, target: { mode: "existing", workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42" }, contentHash: "c".repeat(64), confirmationHash: "b".repeat(64), confirmed: true }));
  });

  it("shows write outcome unknown messaging without a generic retry-write button", () => {
    const onReconcile = vi.fn(async () => undefined);
    render(
      <AdoWorkspaceDecision
        visible
        projection={{
          contractVersion: "f8-ado-projection-v1",
          sessionId: "session-1",
          state: "write_outcome_unknown",
          actionId: "ado-write:session-1:3",
          validationActionId: "ado-validation:session-1:3",
          expectedRevision: 3,
          executionPhase: "readback",
          previewIdentity: {
            targetIdentity: { organization: "MSFTDEVICES", project: "Project", workItemId: 42 },
            previewHash: "c".repeat(64),
            previewMarker: "preview-marker:ado:session-1:3",
          },
          confirmation: {
            status: "confirmation_required",
            workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42",
            ownerReference: "owner@example.com",
            commentReference: "C0",
            expectedVersion: "7",
            beforeContentHash: "a".repeat(64),
            nextContent: "# Complete governance preview\n\n<!-- preview-marker:ado:session-1:3 -->",
            factorCount: 1,
            confirmationHash: "b".repeat(64),
            diff: [{ before: "old", after: "new", changed: true }],
          },
          writeDispatchedAt: "2026-09-01T00:00:00.000Z",
        }}
        onSubmit={vi.fn(async () => undefined)}
        onReconcile={onReconcile}
      />,
    );

    expect(screen.getByText(/write outcome is unknown/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /retry write/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run readback reconciliation" }));
    expect(onReconcile).toHaveBeenCalledOnce();
  });
});
