import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrawingGovernanceResultV2, F8SessionSnapshot } from "@ai-assist/contracts";
import type { EngineeringWorkspaceModel } from "../workspace-model.js";
import { EngineeringWorkspace } from "./EngineeringWorkspace.js";

const handlers = {
  loading: false,
  connected: true,
  featureLedger: ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"].map((featureId) => ({ featureId, status: featureId === "F7" ? "feature_not_available" : "pending", lifecycle: featureId === "F7" ? "in_development" : undefined, actions: [] })) as never,
  productStages: [
    { stageId: "prepare_workbook", label: "Prepare workbook", status: "pending", displayStatus: "Pending" },
    { stageId: "validate_analysis_inputs", label: "Validate analysis inputs", status: "pending", displayStatus: "Pending" },
    { stageId: "review_dimension_traceability", label: "Review dimension traceability", status: "pending", displayStatus: "Pending" },
    { stageId: "calculate_and_interpret", label: "Calculate and interpret tolerance performance", status: "pending", displayStatus: "Pending" },
    { stageId: "evaluate_and_publish", label: "Evaluate improvement options and publish report", status: "pending", displayStatus: "Pending" },
  ] as never,
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
    expect(screen.getByText("Prepare workbook")).toBeVisible();
    expect(screen.getByText("Evaluate improvement options and publish report")).toBeVisible();
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

  it("shows Mean Response and Additional Mean Shift and removes Mean Offset", () => {
    render(<EngineeringWorkspace {...handlers} model={readyModelWithFactor()} />);

    fireEvent.click(screen.getByRole("spinbutton", { name: "Gap factor nominalValue" }));

    expect(screen.queryByRole("spinbutton", { name: "Additional Mean Shift" })).not.toBeInTheDocument();
    expect(screen.queryByText("Mean Offset")).toBeNull();
    expect(screen.getByText("Mean Response")).toBeVisible();
    expect(screen.getByText("Additional Mean Shift")).toBeVisible();
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

  it("shows live ADO host progress with elapsed and remaining time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T10:05:00.000Z"));
    try {
      render(<EngineeringWorkspace
        {...handlers}
        model={readyModel()}
        f3Report={governanceReport()}
        adoProjection={{
          contractVersion: "f8-ado-projection-v1",
          sessionId: "session-1",
          state: "validation_pending",
          actionId: "ado-validation:session-1:7",
          expectedRevision: 7,
          startedAt: "2026-08-31T10:00:00.000Z",
          expiresAt: "2026-08-31T10:15:00.000Z",
        }}
      />);

      expect(screen.getByText("Waiting for VS Code host")).toBeVisible();
      expect(screen.getByText("Elapsed 05:00 · timeout in 10:00")).toBeVisible();
      expect(screen.getByRole("status")).toHaveTextContent("Surface MCP host");
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  it("distinguishes validation and write blocked or failed summary labels", () => {
    const cases = [
      { state: "blocked", actionId: "ado-validation:session-1:7", expected: "ADO validation blocked" },
      { state: "blocked", actionId: "ado-write:session-1:7", expected: "ADO write blocked" },
      { state: "failed", actionId: "ado-validation:session-1:7", expected: "ADO validation failed" },
      { state: "failed", actionId: "ado-write:session-1:7", expected: "ADO write failed" },
    ] as const;

    for (const sample of cases) {
      const { unmount } = render(
        <EngineeringWorkspace
          {...handlers}
          model={readyModel()}
          f3Report={governanceReport()}
          adoProjection={{
            contractVersion: "f8-ado-projection-v1",
            sessionId: "session-1",
            state: sample.state,
            actionId: sample.actionId,
            expectedRevision: 7,
            startedAt: "2026-08-31T10:00:00.000Z",
            expiresAt: "2026-08-31T10:15:00.000Z",
          }}
        />,
      );

      expect(screen.getByText(sample.expected)).toBeVisible();
      unmount();
    }
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
    fireEvent.click(screen.getByRole("button", { name: "Open TA Assistant" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Describe your request in natural language" }), { target: { value: "Compare baseline and scenario." } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(onSubmitConversation).toHaveBeenCalledWith("Compare baseline and scenario.", {
      worksheetName: "Analysis-A",
      tableId: "table",
      sourceRow: 1,
      factorName: "间隙因子",
      calculationReference: "what-if:current",
    }));
  }, 15_000);

  it("does not use a cross-worksheet image reference for F1 evidence", () => {
    render(
      <EngineeringWorkspace
        {...handlers}
        model={readyModelWithCrossWorksheetImage()}
        api={{} as any}
        sessionId="session-1"
      />,
    );

    expect(screen.queryByRole("img", { name: "Analysis-A tolerance loop stack-up" })).not.toBeInTheDocument();
    expect(screen.getByText("This worksheet is missing a tolerance loop stack-up image")).toBeVisible();
  }, 15_000);

  it("renders workbook overview before the current worksheet region without duplicating F6 summary", () => {
    render(
      <EngineeringWorkspace
        {...handlers}
        model={readyModelWithFactor()}
        f2Report={f2ReportForOverview() as never}
        f6Report={f6ReportForOverview() as never}
      />,
    );

    const workbookOverview = screen.getByRole("region", { name: "Workbook overview" });
  const worksheetHeading = screen.getByRole("heading", { name: "Analysis-A", level: 1 });
    const f6Summary = screen.getByRole("region", { name: "Optimization summary" });

    expect(workbookOverview.compareDocumentPosition(worksheetHeading) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(f6Summary).toBeVisible();
    expect(screen.getAllByRole("region", { name: "Optimization summary" })).toHaveLength(1);
  }, 15_000);

  it("shows the current validated report link in workbook overview and avoids synthetic links", () => {
    const api = {
      artifactUrl: (sessionId: string, artifactId: string) => `/api/sessions/${sessionId}/artifacts/${artifactId}`,
    } as never;
    render(
      <EngineeringWorkspace
        {...handlers}
        model={readyModelWithFactor()}
        api={api}
        sessionId="session-1"
        snapshot={reviewSnapshotWithCanonicalReport()}
      />,
    );

    expect(screen.getByRole("link", { name: "Design Optimization Report" })).toHaveAttribute("href", "/api/sessions/session-1/artifacts/f6-report-current");

    cleanup();
    render(
      <EngineeringWorkspace
        {...handlers}
        model={readyModelWithFactor()}
        api={api}
        sessionId="session-1"
        snapshot={reviewSnapshotWithoutCanonicalReport()}
      />,
    );
    expect(screen.queryByRole("link", { name: "Design Optimization Report" })).not.toBeInTheDocument();
  }, 15_000);

  it("keeps workbook full name accessible in the toolbar", () => {
    const workbookName = "anonymous-workbook-with-a-very-long-name-for-layout-verification-v2026-09-01.xlsx";
    render(<EngineeringWorkspace {...handlers} model={{ ...readyModelWithFactor(), workbookName }} />);

    const workbookNameNode = screen.getByText(workbookName);
    expect(workbookNameNode).toHaveAttribute("title", workbookName);
  }, 15_000);

  it("uses a content wrapper for each progress step", () => {
    const { container } = render(<EngineeringWorkspace {...handlers} model={readyModelWithFactor()} />);
    const firstStep = container.querySelector(".analysis-progress__step");

    expect(firstStep).not.toBeNull();
    expect(firstStep?.querySelector(".analysis-progress__content")).not.toBeNull();
  }, 15_000);

  it("keeps TA Assistant closed by default and toggles it from the floating control", () => {
    render(<EngineeringWorkspace {...handlers} model={readyModelWithFactor()} />);

    const openButton = screen.getByRole("button", { name: "Open TA Assistant" });
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "TA Assistant" })).not.toBeInTheDocument();

    fireEvent.click(openButton);
    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "TA Assistant" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Close TA Assistant" }));
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "TA Assistant" })).not.toBeInTheDocument();
  }, 15_000);

  it("renders an analysis cockpit with factor table and a live analysis panel", () => {
    const { container } = render(<EngineeringWorkspace {...handlers} model={readyModelWithFactor()} />);
    const cockpit = container.querySelector(".analysis-cockpit");

    expect(cockpit).not.toBeNull();
    expect(within(cockpit as HTMLElement).getByRole("region", { name: "TA Factor Table" })).toBeVisible();
    expect(within(cockpit as HTMLElement).getByRole("region", { name: "Engineering analysis charts" })).toBeVisible();
    expect(cockpit?.querySelector(".analysis-cockpit__live")).not.toBeNull();
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

function reviewSnapshotWithCanonicalReport(): F8SessionSnapshot {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: "session-1",
    revision: 5,
    inputRevision: 2,
    state: "review_required",
    activeAttempt: null,
    priorRunReferences: [],
    downstreamScopeSelection: {
      workbookContentHash: "d".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
      confirmed: true,
      provenance: "user",
    },
    artifactRefs: [
      { artifactId: "f4-current", kind: "f4_calculation", revision: 2, validated: true, reviewContextId: "context-review-1" },
      { artifactId: "f5-current", kind: "f5_report", revision: 2, validated: true, reviewContextId: "context-review-1" },
      { artifactId: "f6-report-current", kind: "f6_report", revision: 2, validated: true, reviewContextId: "context-review-1" },
    ],
    worksheetCapabilities: [],
  };
}

function reviewSnapshotWithoutCanonicalReport(): F8SessionSnapshot {
  const snapshot = reviewSnapshotWithCanonicalReport();
  return {
    ...snapshot,
    artifactRefs: snapshot.artifactRefs?.map((reference) => reference.kind === "f6_report" ? { ...reference, revision: 1 } : reference),
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
        analysisTarget: {
          description: "Analysis-A loop",
          designNominal: { actual: -0.05, display: "-0.050", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53" },
          lowerSpecLimit: { actual: -0.15, display: "-0.150", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54" },
          upperSpecLimit: { actual: 0.05, display: "0.050", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55" },
          unit: "mm",
        },
        factors: [],
        issues: [],
      },
      {
        worksheetName: "Blocked-B",
        status: "blocked",
        analysisTarget: {
          description: "Blocked-B loop",
          designNominal: { display: "Not available", reason: "Worksheet system specification is unavailable." },
          lowerSpecLimit: { display: "Not available", reason: "Worksheet system specification is unavailable." },
          upperSpecLimit: { display: "Not available", reason: "Worksheet system specification is unavailable." },
          unit: "mm",
        },
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
      analysisTarget: {
        description: "Analysis-A loop",
        designNominal: { actual: 1.5, display: "1.500", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53" },
        lowerSpecLimit: { actual: 1.4, display: "1.400", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54" },
        upperSpecLimit: { actual: 1.6, display: "1.600", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55" },
        unit: "mm",
      },
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

function readyModelWithCrossWorksheetImage(): EngineeringWorkspaceModel {
  return {
    workbookName: "anonymous.xlsx",
    selectedWorksheetName: "Analysis-A",
    worksheets: [{
      worksheetName: "Analysis-A",
      status: "ready",
      analysisTarget: {
        description: "Analysis-A loop",
        designNominal: { actual: 1.5, display: "1.500", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53" },
        lowerSpecLimit: { actual: 1.4, display: "1.400", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54" },
        upperSpecLimit: { actual: 1.6, display: "1.600", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55" },
        unit: "mm",
      },
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
        imageReference: {
          worksheetName: "Analysis-B",
          relativePath: "worksheets/Analysis-B/loop.png",
          contentHash: "b".repeat(64),
        },
      }],
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

function f2ReportForOverview() {
  return {
    status: "completed",
    worksheets: [{
      worksheetName: "Analysis-A",
      status: "ready",
      toleranceLoopDescription: "Gap",
      tolerancePathImageStatus: "available",
      systemSpecification: { status: "available" },
      systemSpecificationIssues: [],
      missingFieldSummary: [],
      f4CalculabilityIssues: [],
      rows: [],
    }],
    summary: {
      worksheetsChecked: 1,
      readyWorksheetCount: 1,
      blockedWorksheetCount: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
      f0InformationInsufficientCount: 0,
      nonF0ProcessCategoryCount: 0,
    },
    f4Handoffs: [],
    adoEvents: [],
  };
}

function f6ReportForOverview() {
  return {
    runStatus: "completed",
    summary: {
      candidateOptionCount: 1,
      worksheetCount: 1,
      completedWorksheetCount: 1,
      partiallyCompletedWorksheetCount: 0,
      insufficientEvidenceOptionCount: 0,
      calculationFailedOptionCount: 0,
    },
    worksheets: [{
      worksheetName: "Analysis-A",
      runStatus: "completed",
      baselineMetrics: { cpk: 1.2, rssSigma: 0.05, dpm: 1 },
      options: [{
        optionId: "opt:1",
        status: "completed",
        resultMetrics: {
          cp: 1.3,
          lowerCpk: 1.2,
          upperCpk: 1.4,
          cpk: 1.2,
          rssSigma: 0.04,
          dpm: 0.5,
        },
      }],
    }],
  };
}
