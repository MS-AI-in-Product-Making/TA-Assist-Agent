import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdoWorkspaceDecision } from "./AdoWorkspaceDecision.js";

afterEach(cleanup);

describe("AdoWorkspaceDecision", () => {
  it("requires a complete Azure DevOps URL for an existing target", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<AdoWorkspaceDecision visible onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox", { name: "Existing work item" });
    expect(input).toHaveAttribute("data-user-input-id", "existing_work_item");
    expect(input).toHaveAttribute("aria-describedby", "existing_work_item-guidance");
    expect(screen.getByText("Work item 12345")).toBeVisible();
    fireEvent.change(input, { target: { value: "123" } });
    expect(screen.getByRole("button", { name: "Validate existing work item" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/123" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate existing work item" }));
    expect(onSubmit).toHaveBeenCalledWith("use_existing", "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/123");
  });

  it("prefills the governed title and requires a sponsor email before creating a work item", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<AdoWorkspaceDecision visible workbookFileName="Gearbox TA.xlsx" onSubmit={onSubmit} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create work item" }));

    const title = screen.getByRole("textbox", { name: "Work item title" });
    const sponsorEmail = screen.getByRole("textbox", { name: "Sponsor email" });
    const create = screen.getByRole("button", { name: "Create and validate work item" });
    expect(title).toHaveValue("[TA Requirement][Project][Phase] Update Drawing Requirements for Gearbox TA.xlsx");
    expect(screen.getByRole("textbox", { name: "Title example" })).toHaveValue("[TA Requirement][Project][Phase] Update Drawing Requirements for <TA Excel Name>");
    expect(screen.getByRole("textbox", { name: "Title example" })).toHaveAttribute("readonly");
    expect(create).toBeDisabled();

    fireEvent.change(sponsorEmail, { target: { value: "invalid" } });
    expect(create).toBeDisabled();
    fireEvent.change(sponsorEmail, { target: { value: "sponsor@example.com" } });
    fireEvent.click(create);

    expect(onSubmit).toHaveBeenCalledWith("create_new", undefined, {
      title: "[TA Requirement][Project][Phase] Update Drawing Requirements for Gearbox TA.xlsx",
      sponsorEmail: "sponsor@example.com",
    });
  });

  it("renders the complete preview and requires a separate Web confirmation", async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(<AdoWorkspaceDecision visible projection={{ contractVersion: "f8-ado-projection-v1", sessionId: "session-1", state: "preview_ready", actionId: "validation-1", expectedRevision: 2, target: { mode: "existing", workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42" }, markdown: "# Complete governance preview", contentHash: "c".repeat(64), confirmation: { status: "confirmation_required", workItemReference: "WI-42", ownerReference: "owner@example.com", commentReference: "C0", expectedVersion: "7", beforeContentHash: "a".repeat(64), nextContent: "# Complete governance preview", factorCount: 2, confirmationHash: "b".repeat(64), diff: [{ before: "old", after: "new", changed: true }] } }} onSubmit={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText("# Complete governance preview")).toBeVisible();
    expect(screen.getByText(/owner@example.com/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm ADO write" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ validationActionId: "validation-1", expectedRevision: 2, target: { mode: "existing", workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42" }, contentHash: "c".repeat(64), confirmationHash: "b".repeat(64), confirmed: true }));
  });

  it("reminds the user that the new task is assigned to the sponsor before confirmation", () => {
    render(<AdoWorkspaceDecision visible projection={{ contractVersion: "f8-ado-projection-v1", sessionId: "session-1", state: "preview_ready", actionId: "validation-1", expectedRevision: 2, target: { mode: "create", title: "[TA Requirement][Project][Phase] Update Drawing Requirements for Gearbox.xlsx", sponsorEmail: "sponsor@example.com" }, markdown: "# Complete governance preview", contentHash: "c".repeat(64), confirmation: { status: "confirmation_required", workItemReference: "WI-42", ownerReference: "sponsor@example.com", commentReference: "C0", expectedVersion: "7", beforeContentHash: "a".repeat(64), nextContent: "# Complete governance preview", factorCount: 2, confirmationHash: "b".repeat(64), diff: [{ before: "old", after: "new", changed: true }] } }} onSubmit={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Sponsor email is required. This task is assigned to sponsor@example.com.");
    expect(screen.getByRole("button", { name: "Confirm ADO write" })).toBeEnabled();
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

  it("requires a new validation generation after reconciled_absent instead of direct write", () => {
    const onStartNewWriteGeneration = vi.fn(async () => undefined);
    render(
      <AdoWorkspaceDecision
        visible
        projection={{
          contractVersion: "f8-ado-projection-v1",
          sessionId: "session-1",
          state: "reconciled_absent",
          actionId: "ado-reconcile:session-1:3",
          writeActionId: "ado-write:session-1:3",
          validationActionId: "ado-validation:session-1:3",
          expectedRevision: 3,
          executionPhase: "reconcile",
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
        }}
        onSubmit={vi.fn(async () => undefined)}
        onStartNewWriteGeneration={onStartNewWriteGeneration}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/prepare a new validated preview/i);
    expect(screen.queryByRole("button", { name: "Confirm ADO write" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prepare a new validated preview" }));
    expect(onStartNewWriteGeneration).toHaveBeenCalledOnce();
  });
});
