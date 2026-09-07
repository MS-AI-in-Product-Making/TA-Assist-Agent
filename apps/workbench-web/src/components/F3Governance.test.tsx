import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrawingGovernanceResultV2 } from "@ai-assist/contracts";
import { F3Governance, projectGovernanceGroups } from "./F3Governance.js";

afterEach(cleanup);

describe("F3Governance", () => {
  it("groups rows by Part / Subsystem with counts that match the F3 report rows exactly", () => {
    const report = governanceReport();
    report.worksheets[0]!.rows[0] = { ...report.worksheets[0]!.rows[0]!, source: { ...report.worksheets[0]!.rows[0]!.source, worksheetName: "Source-A" } };
    report.worksheets[1]!.rows[0] = { ...report.worksheets[1]!.rows[0]!, source: { ...report.worksheets[1]!.rows[0]!.source, worksheetName: "Source-B" } };

    expect(projectGovernanceGroups(report)).toEqual([
      expect.objectContaining({ partSubsystem: "Bracket", factorCount: 2, rows: expect.arrayContaining([expect.objectContaining({ factorDescription: "Gap factor" }), expect.objectContaining({ factorDescription: "Stack factor" })]), missingDrawingNumberCount: 1, missingDimIdCount: 1 }),
      expect.objectContaining({ partSubsystem: "Cover", factorCount: 1, rows: [expect.objectContaining({ factorDescription: "Cover factor" })], missingDrawingNumberCount: 1, missingDimIdCount: 1 }),
    ]);

    render(<F3Governance report={report} />);

    const section = screen.getByRole("region", { name: "ADO workspace" });
    expect(within(section).getByText("3 Factors")).toBeVisible();
    expect(within(section).getByText("2 Groups")).toBeVisible();

    const bracketGroup = [...section.querySelectorAll("details")].find((details) => details.querySelector("summary strong")?.textContent === "Bracket");
    expect(bracketGroup).not.toBeNull();
    fireEvent.click(bracketGroup!.querySelector("summary")!);
    expect(within(bracketGroup!).getAllByRole("columnheader")).toHaveLength(12);
    expect(within(bracketGroup!).getAllByRole("columnheader")[0]).toHaveTextContent("Worksheet Source");
    expect(within(within(bracketGroup!).getByText("Gap factor").closest("tr")!).getByText("Source-A")).toBeVisible();
    expect(within(within(bracketGroup!).getByText("Stack factor").closest("tr")!).getByText("Source-B")).toBeVisible();
    expect(within(bracketGroup!).getByText("2 Factors")).toBeVisible();
    expect(within(bracketGroup!).getByText("Drawing missing 1")).toBeVisible();
    expect(within(bracketGroup!).getByText("DIM ID missing 1")).toBeVisible();
    expect(within(bracketGroup!).getByText("Gap factor")).toBeInTheDocument();
    expect(within(bracketGroup!).getByText("Stack factor")).toBeInTheDocument();
  });

  it("derives the visible factor total from rendered grouped rows instead of the report summary", () => {
    const report = governanceReport({ factorCount: 99 });

    render(<F3Governance report={report} />);

    const section = screen.getByRole("region", { name: "ADO workspace" });

    expect(within(section).getByText("3 Factors")).toBeVisible();
    expect(within(section).queryByText("99 Factors")).not.toBeInTheDocument();
  });

  it("renders canonical F3 ADO reminder groups and status text", () => {
    const report = governanceReport();
    report.worksheets[0]!.rows[0] = {
      ...report.worksheets[0]!.rows[0]!,
      partSubsystem: " ",
      drawingNumber: " ",
      dimId: "",
      qualitySignals: [],
      governanceStatus: "needs_governance",
    };

    render(<F3Governance report={report} />);

    const section = screen.getByRole("region", { name: "ADO workspace" });
    const missingGroup = [...section.querySelectorAll("details")].find((details) => details.querySelector("summary strong")?.textContent === "(missing Part / Subsystem)");
    expect(missingGroup).not.toBeNull();
    fireEvent.click(missingGroup!.querySelector("summary")!);

    expect(within(missingGroup!).getByText("Drawing missing 1")).toBeVisible();
    expect(within(missingGroup!).getByText("DIM ID missing 1")).toBeVisible();
    expect(within(missingGroup!).getByText("Device Level Dim")).toBeVisible();
    expect(within(missingGroup!).getByText("Dimension Description")).toBeVisible();
    expect(within(missingGroup!).getByText("σ Level")).toBeVisible();
    expect(within(missingGroup!).getByText("Governance issue")).toBeVisible();
    expect(within(missingGroup!).getAllByText("(missing)")).toHaveLength(2);
    expect(within(missingGroup!).getByText("Complete")).toBeVisible();
    expect(within(missingGroup!).queryByText("needs_governance")).not.toBeInTheDocument();
  });

  it("keeps Local only, Create, and Update existing controls inside the F3 ADO workspace", () => {
    const onSubmit = vi.fn(async () => undefined);

    render(<F3Governance report={governanceReport()} adoDecisionRequired onAdoDecision={onSubmit} />);

    const section = screen.getByRole("region", { name: "ADO workspace" });
    const localOnly = within(section).getByRole("button", { name: "Local analysis only" });
    const create = within(section).getByRole("button", { name: "Create work item" });
    const update = within(section).getByRole("button", { name: "Validate existing work item" });

    expect(screen.getAllByRole("button", { name: "Local analysis only" })).toEqual([localOnly]);
    expect(screen.getAllByRole("button", { name: "Create work item" })).toEqual([create]);
    expect(screen.getAllByRole("button", { name: "Validate existing work item" })).toEqual([update]);

    fireEvent.click(localOnly);
    fireEvent.click(create);
    fireEvent.change(within(section).getByRole("textbox", { name: "Existing work item" }), { target: { value: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/123" } });
    fireEvent.click(update);

    expect(onSubmit).toHaveBeenCalledWith("local_only");
    expect(onSubmit).toHaveBeenCalledWith("create_new");
    expect(onSubmit).toHaveBeenCalledWith("use_existing", "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/123");
  });

  it("uses start_new_ado_write_generation callback from reconciled_absent and never falls back to reset", () => {
    const onStartNewWriteGeneration = vi.fn(async () => undefined);
    const onReset = vi.fn(async () => undefined);
    render(
      <F3Governance
        report={governanceReport()}
        adoProjection={{
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
        onAdoReset={onReset}
        onStartNewAdoWriteGeneration={onStartNewWriteGeneration}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prepare a new validated preview" }));
    expect(onStartNewWriteGeneration).toHaveBeenCalledOnce();
    expect(onReset).not.toHaveBeenCalled();
  });
});

function governanceReport(summaryOverrides: Partial<DrawingGovernanceResultV2["summary"]> = {}): DrawingGovernanceResultV2 {
  const rows = [
    row("1".repeat(64), "Bracket", "Gap factor", "DRW-1", null, "AJ_GAP", 12),
    row("2".repeat(64), "Bracket", "Stack factor", null, "DIM-2", "B_STACK", 4),
    row("3".repeat(64), "Cover", "Cover factor", null, null, "AJ_GAP", 18),
  ];

  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "governance_required",
    artifactRoot: "runtime/session/f3",
    workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [
      { worksheetName: "AJ_GAP", toleranceLoopDescription: "Gap", rows: [rows[0]!, rows[2]!] },
      { worksheetName: "B_STACK", toleranceLoopDescription: "Stack", rows: [rows[1]!] },
    ],
    ado: { status: "draft_ready" },
    summary: { worksheetCount: 2, factorCount: 3, completeCount: 0, governanceRequiredCount: 3, duplicateConflictCount: 0, ...summaryOverrides },
  };
}

function row(factorInstanceId: string, partSubsystem: string, factorDescription: string, drawingNumber: string | null, dimId: string | null, worksheetName: string, sourceRow: number): Exclude<DrawingGovernanceResultV2, { status: "input_rejected" }>["worksheets"][number]["rows"][number] {
  return {
    factorInstanceId,
    deviceLevelDim: "Device gap",
    dimensionDescription: `${factorDescription} dimension`,
    partCategory: "CNC",
    partSubsystem,
    drawingNumber,
    dimId,
    factorDescription,
    nominal: 1,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    sigmaLevel: 3,
    dimIdStatus: dimId === null ? "missing" : "valid",
    qualitySignals: [...(drawingNumber === null ? ["drawing_number_missing" as const] : []), ...(dimId === null ? ["dim_id_missing" as const] : [])],
    governanceStatus: "needs_governance",
    imageReference: { artifact: "f1", worksheetName, relativePath: `images/${worksheetName}.png`, contentHash: "b".repeat(64) },
    source: { worksheetName, tableId: "table-a", sourceRow, sourceCells: {} },
  };
}