import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrawingGovernanceResultV2, F8SessionSnapshot } from "@ai-assist/contracts";
import type { EngineeringWorkspaceModel } from "../workspace-model.js";
import { EngineeringWorkspace } from "./EngineeringWorkspace.js";

const handlers = {
  loading: false,
  connected: true,
  featureLedger: ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"].map((featureId) => ({ featureId, status: featureId === "F7" ? "feature_not_available" : "pending", lifecycle: featureId === "F7" ? "in_development" : undefined, actions: [] })) as never,
  conversation: [],
  onUpload: vi.fn(async () => undefined),
  onSelectWorksheet: vi.fn(),
  onSubmitConversation: vi.fn(async () => undefined),
};

afterEach(cleanup);

describe("EngineeringWorkspace", () => {
  it("shows preparation and the full feature progress track", () => {
    render(<EngineeringWorkspace {...handlers} model={{ worksheets: [], preparationMessage: "Preparing TA workspace..." }} />);

    expect(screen.getByText("Preparing TA workspace...")).toBeVisible();
    expect(screen.getByRole("region", { name: "Analysis progress" })).toBeVisible();
    expect(screen.getByText("F0")).toBeVisible();
    expect(screen.getByText("F7")).toBeVisible();
  }, 15_000);

  it("renders a searchable worksheet picker with business statuses", () => {
    const onSelectWorksheet = vi.fn();
    render(<EngineeringWorkspace {...handlers} model={readyModel()} onSelectWorksheet={onSelectWorksheet} />);

    const picker = screen.getByRole("combobox", { name: "Worksheet" });
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: "Analysis" } });
    const options = screen.getByRole("listbox", { name: "Worksheet options" });
    expect(within(options).getByText("Analysis-A")).toBeVisible();
    expect(within(options).getByText("Ready")).toBeVisible();
    fireEvent.keyDown(picker, { key: "Escape" });
    expect(picker).toHaveAttribute("aria-expanded", "false");
    expect(options).not.toBeVisible();
    fireEvent.keyDown(picker, { key: "ArrowDown" });
    fireEvent.keyDown(picker, { key: "Enter" });
    expect(onSelectWorksheet).toHaveBeenCalledWith("Analysis-A");
    expect(screen.getByRole("button", { name: "Open TA Assistant" })).toHaveAttribute("aria-expanded", "false");
  }, 15_000);

  it("explains why a selected worksheet has no F4 analysis", () => {
    const model = { ...readyModel(), selectedWorksheetName: "Blocked-B" };
    render(<EngineeringWorkspace {...handlers} model={model} />);

    expect(screen.getByRole("status", { name: "Worksheet blocking reasons" })).toHaveTextContent("Required field missing");
  }, 15_000);

  it("shows a read-only mean offset and removes the editable additional mean shift control", () => {
    render(<EngineeringWorkspace {...handlers} model={readyModelWithFactor()} />);

    fireEvent.click(screen.getByRole("spinbutton", { name: "Gap factor nominalValue" }));

    expect(screen.queryByRole("spinbutton", { name: "Additional Mean Shift" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Mean Offset").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Mean Offset source values").some((element) => element.textContent?.includes("Calculated Mean 1.627 minus Target Nominal 1.500") ?? false)).toBe(true);
  }, 15_000);

  it("keeps ADO controls inside the F3 workspace without hiding the engineering worksheet", () => {
    render(<EngineeringWorkspace {...handlers} model={readyModel()} f3Report={governanceReport()} adoDecisionRequired />);

    expect(screen.getByRole("heading", { name: "Analysis-A" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: /ADO/i })).not.toBeInTheDocument();

    const adoWorkspace = screen.getByRole("region", { name: "ADO workspace" });
    expect(within(adoWorkspace).getByRole("button", { name: "Local analysis only" })).toBeVisible();
    expect(within(adoWorkspace).getByRole("button", { name: "Create work item" })).toBeVisible();
    expect(within(adoWorkspace).getByRole("button", { name: "Validate existing work item" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Local analysis only" })).toHaveLength(1);
  }, 15_000);

  it("submits governed source identity and the current saved Scenario reference", async () => {
    const onSubmitConversation = vi.fn(async () => undefined);
    render(
      <EngineeringWorkspace
        {...handlers}
        model={readyModelWithFactor()}
        onSubmitConversation={onSubmitConversation}
        sessionId="session-1"
        inputRevision={1}
        snapshot={reviewSnapshot()}
        scenarioDrafts={reviewSnapshot().scenarioDrafts}
        f4Report={{
          source: { workbookFileName: "anonymous.xlsx" },
          calculations: [{
            worksheetSelection: { worksheetName: "Analysis-A", tableId: "table" },
            runReference: "f4-run-current",
            workbookContentHash: "a".repeat(64),
            factors: [{
              factorName: "Gap factor",
              unit: "mm",
              source: { worksheetName: "Analysis-A", tableId: "table", sourceRow: 1 },
              input: { nominalValue: 1, upperTolerance: 0.2, lowerTolerance: -0.2 },
              mean: 1.627,
            }],
            system: { mean: 1.627, rssSigma: 0.05, additionalMeanShift: 0.02, worstCaseLower: 1.3, worstCaseUpper: 1.9 },
            capability: { lowerSpecLimit: 1.4, upperSpecLimit: 1.6, cp: 1.4, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
          }],
        } as never}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gap factor", description: "间隙因子" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Ask TA Assist from governed evidence" }), { target: { value: "Compare baseline and scenario." } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(onSubmitConversation).toHaveBeenCalledWith("Compare baseline and scenario.", {
      worksheetName: "Analysis-A",
      tableId: "table",
      sourceRow: 1,
      factorName: "间隙因子",
      calculationReference: "what-if:current",
    }));
  }, 15_000);
});

function reviewSnapshot(): F8SessionSnapshot {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: "session-1",
    revision: 3,
    inputRevision: 1,
    state: "review_required",
    activeAttempt: null,
    priorRunReferences: [],
    downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true },
    scenarioDrafts: [{
      contractVersion: "f8-scenario-draft-v1",
      draftId: "draft-unsaved",
      sessionId: "session-1",
      worksheetName: "Analysis-A",
      inputRevision: 1,
      status: "calculated",
      mode: "WHAT_IF",
      baselineWorkbookHash: "a".repeat(64),
      baselineRunReference: "f4-run-current",
      calculationReference: "what-if:unsaved",
      calculationMetrics: { mean: 1.62, rssSigma: 0.051, cp: 1.35, cpkL: 1.16, cpkU: 1.28, cpk: 1.16, statisticalMargin: 0.18, worstCaseMargin: 0.08 },
      factorOverrides: [],
    }, {
      contractVersion: "f8-scenario-draft-v1",
      draftId: "draft-current",
      sessionId: "session-1",
      worksheetName: "Analysis-A",
      inputRevision: 1,
      status: "saved",
      mode: "WHAT_IF",
      baselineWorkbookHash: "a".repeat(64),
      baselineRunReference: "f4-run-current",
      calculationReference: "what-if:current",
      calculationMetrics: { mean: 1.61, rssSigma: 0.049, cp: 1.42, cpkL: 1.21, cpkU: 1.33, cpk: 1.21, statisticalMargin: 0.19, worstCaseMargin: 0.09 },
      factorOverrides: [],
    }, {
      contractVersion: "f8-scenario-draft-v1",
      draftId: "draft-stale",
      sessionId: "session-1",
      worksheetName: "Analysis-A",
      inputRevision: 1,
      status: "saved",
      mode: "WHAT_IF",
      baselineWorkbookHash: "b".repeat(64),
      baselineRunReference: "f4-run-stale",
      calculationReference: "what-if:stale",
      calculationMetrics: { mean: 1.7, rssSigma: 0.06, cp: 1.2, cpkL: 1.0, cpkU: 1.2, cpk: 1.0, statisticalMargin: 0.12, worstCaseMargin: 0.05 },
      factorOverrides: [],
    }],
  };
}

function readyModel(): EngineeringWorkspaceModel {
  return {
    workbookName: "anonymous.xlsx",
    selectedWorksheetName: "Analysis-A",
    worksheets: [
      {
        worksheetName: "Analysis-A",
        status: "ready",
        analysisTarget: { description: "Analysis-A loop", nominal: -0.05, nominalDisplay: "-0.050", upperTolerance: 0.1, upperToleranceDisplay: "0.100", lowerTolerance: -0.1, lowerToleranceDisplay: "-0.100", unit: "mm" },
        factors: [],
        issues: [],
      },
      {
        worksheetName: "Blocked-B",
        status: "blocked",
        analysisTarget: { description: "Blocked-B loop", nominalDisplay: "Not available", nominalReason: "Worksheet system specification is unavailable.", upperToleranceDisplay: "Not available", upperToleranceReason: "Worksheet system specification is unavailable.", lowerToleranceDisplay: "Not available", lowerToleranceReason: "Worksheet system specification is unavailable.", unit: "mm" },
        factors: [],
        issues: ["required_field_missing"],
      },
    ],
  };
}

function readyModelWithFactor(): EngineeringWorkspaceModel {
  return {
    workbookName: "anonymous.xlsx",
    selectedWorksheetName: "Analysis-A",
    worksheets: [{
      worksheetName: "Analysis-A",
      status: "ready",
      analysisTarget: { description: "Analysis-A loop", nominal: 1.5, nominalDisplay: "1.500", upperTolerance: 0.1, upperToleranceDisplay: "0.100", lowerTolerance: -0.1, lowerToleranceDisplay: "-0.100", unit: "mm" },
      factors: [{
        key: "Analysis-A\u0000table\u00001",
        worksheetName: "Analysis-A",
        tableId: "table",
        sourceRow: 1,
        factorName: { displayText: "Gap factor", sourceText: "间隙因子", translated: true },
        partName: { displayText: "Bracket", sourceText: "支架", translated: true },
        partCategory: "CNC",
        unit: "mm",
        nominalValue: 1,
        nominalDisplay: "1.000",
        upperTolerance: 0.2,
        upperToleranceDisplay: "0.200",
        lowerTolerance: -0.2,
        lowerToleranceDisplay: "-0.200",
        longTermSafetyFactorDisplay: "1.0",
        sigmaLevelDisplay: "4.0",
        distribution: "Normal",
        mean: 1.627,
        meanDisplay: "1.627",
        toleranceDisplay: "0.200",
        oneSigmaDisplay: "0.050",
        contributionDisplay: "50.0%",
        capabilityResult: "ready",
        editable: true,
        additionalMeanShift: 0.02,
        directionLabel: "positive",
        directionAvailable: true,
        contribution: 0.5,
        status: "pass",
      }],
      metrics: {
        mean: 1.627,
        meanOffset: 0.127,
        rssSigma: 0.05,
        cp: 1.4,
        cpkL: 1.2,
        cpkU: 1.3,
        cpk: 1.2,
        statisticalMargin: 0.2,
        worstCaseMargin: 0.1,
        lowerSpecLimit: 1.4,
        upperSpecLimit: 1.6,
        meanShift: 0.02,
        yield: 0.999,
        dpm: 1,
        statisticalLower: 1.427,
        statisticalUpper: 1.827,
        worstCaseLower: 1.3,
        worstCaseUpper: 1.9,
      },
      issues: [],
    }],
  };
}

function governanceReport(): DrawingGovernanceResultV2 {
  return {
    contractVersion: "ta-contracts-v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "governance_required",
    artifactRoot: "runtime/session/f3",
    workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "Analysis-A loop", rows: [governanceRow()] }],
    ado: { status: "draft_ready" },
    summary: { worksheetCount: 1, factorCount: 1, completeCount: 0, governanceRequiredCount: 1, duplicateConflictCount: 0 },
  };
}

function governanceRow(): Exclude<DrawingGovernanceResultV2, { status: "input_rejected" }>["worksheets"][number]["rows"][number] {
  return {
    factorInstanceId: "4".repeat(64),
    deviceLevelDim: "Analysis-A loop",
    dimensionDescription: "Gap factor dimension",
    partCategory: "CNC",
    partSubsystem: "Bracket",
    drawingNumber: null,
    dimId: null,
    factorDescription: "Gap factor",
    nominal: 1,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    sigmaLevel: 3,
    dimIdStatus: "missing",
    qualitySignals: ["drawing_number_missing", "dim_id_missing"],
    governanceStatus: "needs_governance",
    imageReference: { worksheetName: "Analysis-A", imageArtifactId: "image-a", contentHash: "b".repeat(64) },
    source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 1, sourceCells: {} },
  };
}
