import type { ConversationTurn } from "@ai-assist/conversation";
import { useState } from "react";

import type { EngineeringWorkspaceModel } from "../workspace-model.js";
import { buildWorksheetBoundF1ImageArtifactUrl, type TaConversationSelection, type WorkbenchApi } from "../api.js";
import { useScenarioWorkspace } from "../hooks/use-scenario-workspace.js";
import { FactorTable } from "./FactorTable.js";
import { EngineeringCharts } from "./EngineeringCharts.js";
import { TaAssistantPanel, type RequestContextChip } from "./TaAssistantPanel.js";
import type { WorkspaceIssue } from "../business-status.js";
import { WorkspaceIssuePanel } from "./WorkspaceIssuePanel.js";
import { WorkspacePreparation } from "./WorkspacePreparation.js";
import { WorkspaceToolbar } from "./WorkspaceToolbar.js";
import type { DrawingGovernanceResultV2, F2UserReport, F4WorkflowCalculationResult, F6OptimizationResultV2, F8AdoProjection, F8AdoWriteConfirmation, F8ScenarioDraft } from "@ai-assist/contracts";
import type { F8SessionSnapshot } from "@ai-assist/workbench";
import { selectCompleteReviewContext } from "@ai-assist/workbench/review";
import { F6Summary } from "./F6Summary.js";
import { EvidenceImagePane } from "./EvidenceImagePane.js";
import { WorkbookHealth } from "./WorkbookHealth.js";
import { projectWorkbookHealth } from "../workbook-health.js";
import { F3Governance } from "./F3Governance.js";
import { AnalysisProgress } from "./AnalysisProgress.js";
import { SourceText } from "./SourceText.js";
import type { FeatureLedgerEntry, ProductStageEntry } from "../workbench-session.js";
import type { RunnerProgressEvent } from "../api.js";
import { ReportLink } from "./ReportLink.js";

export interface EngineeringWorkspaceProps {
  readonly model: EngineeringWorkspaceModel;
  readonly loading: boolean;
  readonly connected: boolean;
  readonly featureLedger: readonly FeatureLedgerEntry[];
  readonly productStages: readonly ProductStageEntry[];
  readonly runnerProgress?: RunnerProgressEvent;
  readonly activeAttemptStartedAt?: string;
  readonly conversation: readonly ConversationTurn[];
  readonly api?: WorkbenchApi;
  readonly sessionId?: string;
  readonly inputRevision?: number;
  readonly onSaveScenario?: (payload: Record<string, unknown>) => Promise<void>;
  readonly scenarioDrafts?: readonly F8ScenarioDraft[];
  readonly snapshot?: F8SessionSnapshot;
  readonly issue?: WorkspaceIssue;
  readonly onUpload: (file: File) => Promise<void>;
  readonly onSelectWorksheet: (worksheetName: string) => void;
  readonly onSubmitConversation: (message: string, selection: TaConversationSelection) => Promise<void>;
  readonly onSubmitCommand?: (command: "confirm_analysis_context" | "confirm_optimization_targets", payload: Record<string, unknown>) => Promise<void>;
  readonly f6Report?: F6OptimizationResultV2;
  readonly f2Report?: F2UserReport;
  readonly f4Report?: F4WorkflowCalculationResult;
  readonly f3Report?: DrawingGovernanceResultV2;
  readonly adoDecisionRequired?: boolean;
  readonly adoProjection?: F8AdoProjection;
  readonly onAdoDecision?: (decision: "local_only" | "create_new" | "use_existing", workItemReference?: string) => Promise<void>;
  readonly onAdoConfirm?: (confirmation: F8AdoWriteConfirmation) => Promise<void>;
  readonly onAdoReconcile?: () => Promise<void>;
  readonly onAdoStartNewWriteGeneration?: () => Promise<void>;
  readonly onAdoReset?: () => Promise<void>;
}

export function EngineeringWorkspace(props: EngineeringWorkspaceProps) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [selectedFactorKey, setSelectedFactorKey] = useState<string>();
  const worksheet = props.model.worksheets.find(({ worksheetName }) => worksheetName === props.model.selectedWorksheetName);
  const language = props.snapshot?.interactionLanguage.uiCatalogLanguage ?? "en";
  const initialScenarioDraft = selectCurrentWorksheetScenarioDraft(props.scenarioDrafts, props.sessionId, props.inputRevision, worksheet?.worksheetName);
  const scenario = useScenarioWorkspace({ api: props.api ?? unavailableApi(), sessionId: props.sessionId, inputRevision: props.inputRevision, factors: worksheet?.factors ?? [], baselineSystem: worksheet?.metrics, initialScenarioDraft, onSave: props.onSaveScenario ?? (async () => undefined) });
  const selectedFactor = worksheet?.factors.find(({ key }) => key === selectedFactorKey);
  const selectedCalculation = props.f4Report?.calculations.find((candidate) => candidate.worksheetSelection.worksheetName === worksheet?.worksheetName);
  const savedScenario = resolveCurrentSavedScenario(props.snapshot, props.scenarioDrafts, worksheet?.worksheetName, selectedCalculation?.runReference);
  const evidenceFactor = selectedFactor ?? worksheet?.factors.find(({ imageReference }) => imageReference !== undefined);
  const worksheetBoundImage = evidenceFactor?.imageReference !== undefined && evidenceFactor.imageReference.worksheetName === worksheet?.worksheetName
    ? evidenceFactor.imageReference
    : undefined;
  const evidenceUrl = props.api !== undefined && props.sessionId !== undefined && worksheetBoundImage !== undefined
    ? buildWorksheetBoundF1ImageArtifactUrl({
        sessionId: props.sessionId,
        contentHash: worksheetBoundImage.contentHash,
        worksheetName: worksheetBoundImage.worksheetName,
        relativePath: worksheetBoundImage.relativePath,
      })
    : undefined;
  const scenarioResult = scenario.scenarioResult ?? [...scenario.factorStates.values()].find(({ lastValidResult }) => lastValidResult !== undefined)?.lastValidResult;
  const scenarioContributions = new Map([...scenario.factorStates].flatMap(([key, state]) => state.calculated === undefined ? [] : [[key, state.calculated.contribution] as const]));
  const preparing = props.loading || props.model.preparationMessage !== undefined;
  const requestContextChips = buildAssistantRequestContextChips({
    snapshot: props.snapshot,
    worksheetName: worksheet?.worksheetName,
    selectedFactorSourceRow: selectedFactor?.sourceRow,
    f2Report: props.f2Report,
    f4Report: props.f4Report,
    scenarioDrafts: props.scenarioDrafts,
  });
  const currentReport = props.snapshot === undefined
    ? undefined
    : (() => {
        const report = selectCompleteReviewContext(props.snapshot)?.artifacts.get("f6_report");
        return report === undefined ? undefined : { artifactId: report.artifactId, label: "Design Optimization Report" };
      })();

  return (
    <main className="engineering-shell">
      <WorkspaceToolbar model={props.model} loading={props.loading} language={language} onUpload={props.onUpload} onSelectWorksheet={props.onSelectWorksheet} onUndo={scenario.undo} onReset={() => scenario.reset()} onSave={() => { void scenario.save(selectedFactor?.key); }} canUndo={scenario.canUndo} canSave={scenario.dirty && scenarioResult !== undefined} />
      <AnalysisProgress stages={props.productStages} connected={props.connected} {...(props.runnerProgress === undefined ? {} : { progress: props.runnerProgress })} {...(props.adoProjection === undefined ? {} : { adoProjection: props.adoProjection })} {...(props.activeAttemptStartedAt === undefined ? {} : { activeAttemptStartedAt: props.activeAttemptStartedAt })} />
      <WorkspaceIssuePanel issue={props.issue} />
      <div className="engineering-layout">
        <section className="engineering-layout__workbench">
          {preparing ? <WorkspacePreparation message={props.model.preparationMessage} /> : worksheet === undefined ? (
            <WorkspacePreparation message="Open a workbook to start analysis" />
          ) : (
            <>
              <section className="workbook-overview" aria-label="Workbook overview">
                <WorkbookHealth model={projectWorkbookHealth(props.f2Report)} onNavigate={props.onSelectWorksheet} />
                <F6Summary report={props.f6Report} selectedWorksheetName={worksheet.worksheetName} />
                {props.sessionId === undefined ? null : <ReportLink sessionId={props.sessionId} report={currentReport} />}
              </section>
              <header className="worksheet-heading">
                <div><span>Current worksheet</span><h1>{worksheet.worksheetName}</h1></div>
                <span className={`worksheet-status worksheet-status--${worksheet.status}`}>{worksheet.status}</span>
              </header>
              {worksheet.status !== "blocked" || worksheet.issues.length === 0 ? null : (
                <div className="worksheet-blocked-reasons" role="status" aria-label="Worksheet blocking reasons">
                  <strong>This worksheet did not enter tolerance calculation</strong>
                  <span>{worksheet.issues.map(issueLabel).join("; ")}</span>
                </div>
              )}
              <EvidenceImagePane worksheetName={worksheet.worksheetName} imageUrl={evidenceUrl} focusedLabel={evidenceFactor === undefined ? undefined : `${evidenceFactor.factorName.displayText} · ${evidenceFactor.partName.displayText}`} analysisTarget={worksheet.analysisTarget} />
              <div className="analysis-cockpit">
                <FactorTable factors={worksheet.factors} states={scenario.factorStates} onEdit={scenario.edit} onCommit={scenario.commit} onSelect={setSelectedFactorKey} onEvidenceFocus={setSelectedFactorKey} />
                <section className="analysis-cockpit__live" aria-label="Live analysis panel">
                  {selectedFactor === undefined ? null : <section className="selected-factor-strip"><SourceText value={selectedFactor.factorName} /><button type="button" className="button" onClick={() => scenario.reset(selectedFactor.key)}>Reset</button><button type="button" className="button button--primary" disabled={scenario.factorStates.get(selectedFactor.key)?.lastValidResult === undefined} onClick={() => { void scenario.save(selectedFactor.key); }}>Save scenario</button></section>}
                  <EngineeringCharts worksheet={worksheet} scenario={scenarioResult} scenarioContributions={scenarioContributions} systemValues={scenario.systemValues} systemSpecificationError={scenario.systemSpecificationError} onSystemEdit={scenario.editSystem} onSystemCommit={scenario.commitSystemSpecification} />
                </section>
              </div>
              <F3Governance report={props.f3Report} language={language} adoDecisionRequired={props.adoDecisionRequired} adoProjection={props.adoProjection} onAdoDecision={props.onAdoDecision} onAdoConfirm={props.onAdoConfirm} onAdoReconcile={props.onAdoReconcile} onStartNewAdoWriteGeneration={props.onAdoStartNewWriteGeneration} onAdoReset={props.onAdoReset} />
            </>
          )}
        </section>
      </div>
      {assistantOpen ? (
        <aside className="assistant-drawer" aria-label="TA Assistant drawer">
          <button type="button" className="assistant-drawer__close" aria-label="Close TA Assistant" onClick={() => setAssistantOpen(false)}>×</button>
          <TaAssistantPanel worksheetName={worksheet?.worksheetName} factorName={selectedFactor?.factorName.displayText} turns={props.conversation} api={props.api} sessionId={props.sessionId} disabled={props.loading} onSubmit={(message) => props.onSubmitConversation(message, {
            ...(worksheet === undefined ? {} : { worksheetName: worksheet.worksheetName }),
            ...(selectedFactor === undefined ? {} : { tableId: selectedFactor.tableId, sourceRow: selectedFactor.sourceRow, factorName: selectedFactor.factorName.sourceText }),
            ...(savedScenario?.calculationReference === undefined ? {} : { calculationReference: savedScenario.calculationReference }),
          })}
          snapshot={props.snapshot}
          language={language}
          onSubmitCommand={props.onSubmitCommand}
          requestContextChips={requestContextChips}
          />
        </aside>
      ) : null}
      <button type="button" className="assistant-drawer__open icon-button" aria-label="Open TA Assistant" aria-expanded={assistantOpen} onClick={() => setAssistantOpen(true)}>?</button>
      <div className={`connection-indicator ${props.connected ? "connection-indicator--online" : ""}`}>{props.connected ? "Connected" : "Reconnecting"}</div>
    </main>
  );
}

function selectCurrentWorksheetScenarioDraft(drafts: readonly F8ScenarioDraft[] | undefined, sessionId: string | undefined, inputRevision: number | undefined, worksheetName: string | undefined): F8ScenarioDraft | undefined {
  if (drafts === undefined || sessionId === undefined || inputRevision === undefined || worksheetName === undefined) return undefined;
  return drafts.findLast((draft) => draft.status === "saved" && draft.sessionId === sessionId && draft.inputRevision === inputRevision && draft.worksheetName === worksheetName);
}

function unavailableApi(): WorkbenchApi {
  return { calculateWhatIf: async () => { throw new Error("Scenario calculation is unavailable."); } } as WorkbenchApi;
}

function issueLabel(issue: string): string {
  if (issue === "required_field_missing") return "Required field missing";
  const issueLabels: Record<string, string> = { tolerance_path_image_unavailable: "Tolerance loop image missing", factor_tables_missing: "Factor table missing", factor_table_has_no_rows: "Factor table has no rows", factor_tolerance_range_invalid: "Factor tolerance range is invalid", long_term_safety_factor_invalid: "Long Term / Safety Factor is invalid", sigma_level_invalid: "Sigma Level is invalid", f4_calculation_not_possible: "The current input cannot run tolerance calculation" };
  if (issueLabels[issue] !== undefined) return issueLabels[issue];
  const fieldLabels: Record<string, string> = { factorName: "Factor Description", partName: "Part Name", nominalValue: "Design Nominal", upperTolerance: "+ Tolerance", lowerTolerance: "- Tolerance" };
  return fieldLabels[issue] === undefined ? issue : `Required field missing: ${fieldLabels[issue]}`;
}

function buildAssistantRequestContextChips(input: {
  readonly snapshot?: F8SessionSnapshot;
  readonly worksheetName?: string;
  readonly selectedFactorSourceRow?: number;
  readonly f2Report?: F2UserReport;
  readonly f4Report?: F4WorkflowCalculationResult;
  readonly scenarioDrafts?: readonly F8ScenarioDraft[];
}): RequestContextChip[] {
  const worksheet = input.f2Report !== undefined && input.f2Report.status !== "inputRejected"
    ? input.f2Report.worksheets.find((candidate) => candidate.worksheetName === input.worksheetName)
    : undefined;
  const validFactorRows = worksheet?.rows.filter((row) => hasConversationFactorContext(row.actualFields.factorName, row.actualFields.nominalValue, row.actualFields.upperTolerance, row.actualFields.lowerTolerance)) ?? [];
  const knowledgeCount = worksheet?.rows.filter((row) => typeof row.actualFields.factorName === "string" && row.actualFields.factorName.trim().length > 0).length ?? 0;
  const calculation = input.f4Report?.calculations.find((candidate) => candidate.worksheetSelection.worksheetName === input.worksheetName);
  const imageRow = input.selectedFactorSourceRow === undefined
    ? worksheet?.rows.find((row) => row.imageReference !== undefined)
    : worksheet?.rows.find((row) => row.sourceRow === input.selectedFactorSourceRow && row.imageReference !== undefined);
  const savedScenario = resolveCurrentSavedScenario(input.snapshot, input.scenarioDrafts, input.worksheetName, calculation?.runReference);

  return [
    {
      key: "knowledge",
      label: "Knowledge",
      value: countLabel(knowledgeCount, "item"),
      included: knowledgeCount > 0,
      detail: knowledgeCount > 0 ? `${countLabel(knowledgeCount, "governed knowledge item")} are available for validation.` : "No governed knowledge items are available for validation.",
    },
    {
      key: "loop-image",
      label: "Loop image",
      value: imageRow !== undefined ? "Requested" : "Not requested",
      included: imageRow !== undefined,
      detail: imageRow !== undefined ? "The tolerance loop image is requested for the next request." : "The tolerance loop image is not requested for the next request.",
    },
    {
      key: "factor-table",
      label: "Factor table",
      value: countLabel(validFactorRows.length, "row"),
      included: validFactorRows.length > 0,
      detail: validFactorRows.length > 0 ? `${countLabel(validFactorRows.length, "governed factor row")} are available for validation.` : "No governed factor rows are available for validation.",
    },
    {
      key: "baseline",
      label: "Baseline",
      value: calculation === undefined ? "Not requested" : "Available for validation",
      included: calculation !== undefined,
      detail: calculation === undefined ? "No current baseline metrics are requested for the next request." : `Current baseline run ${calculation.runReference} is available for validation.`,
    },
    {
      key: "scenario",
      label: "Scenario",
      value: savedScenario === undefined ? "Not requested" : "Requested",
      included: savedScenario !== undefined,
      detail: savedScenario === undefined ? "No saved current-lineage Scenario is requested for the next request." : `Saved Scenario ${savedScenario.calculationReference} is requested for the next request.`,
    },
  ];
}

function hasConversationFactorContext(factorName: unknown, nominalValue: unknown, upperTolerance: unknown, lowerTolerance: unknown): boolean {
  return typeof factorName === "string"
    && factorName.trim().length > 0
    && typeof nominalValue === "number"
    && Number.isFinite(nominalValue)
    && typeof upperTolerance === "number"
    && Number.isFinite(upperTolerance)
    && typeof lowerTolerance === "number"
    && Number.isFinite(lowerTolerance);
}

function countLabel(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function resolveCurrentSavedScenario(
  snapshot: F8SessionSnapshot | undefined,
  drafts: readonly F8ScenarioDraft[] | undefined,
  worksheetName: string | undefined,
  baselineRunReference: string | undefined,
): F8ScenarioDraft | undefined {
  if (snapshot === undefined || drafts === undefined || worksheetName === undefined || baselineRunReference === undefined) return undefined;
  const workbookHash = snapshot.downstreamScopeSelection?.workbookContentHash ?? snapshot.initialScopeSelection?.workbookContentHash;
  if (workbookHash === undefined) return undefined;

  return drafts.findLast((draft) => (
    draft.status === "saved"
    && draft.sessionId === snapshot.sessionId
    && draft.inputRevision === snapshot.inputRevision
    && draft.worksheetName === worksheetName
    && draft.baselineWorkbookHash === workbookHash
    && draft.baselineRunReference === baselineRunReference
  ));
}
