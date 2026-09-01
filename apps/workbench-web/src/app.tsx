import { useState } from "react";

import type { F2UserReport } from "@ai-assist/contracts";
import type { WorkbenchApi } from "./api.js";
import { EngineeringWorkspace } from "./components/EngineeringWorkspace.js";
import { WorksheetSelection, type WorksheetOption } from "./components/WorksheetSelection.js";
import { useWorkbenchSession, type UseWorkbenchSessionResult } from "./use-session.js";
import { projectActionQueue, projectFeatureLedger, projectTaProductStages, type F8SessionSnapshot } from "./workbench-session.js";
import { projectEngineeringWorkspace } from "./workspace-model.js";
import { projectWorkspaceIssue } from "./business-status.js";

export interface AppProps {
  readonly api?: WorkbenchApi;
  readonly preloadedState?: Partial<UseWorkbenchSessionResult> & { readonly snapshot: F8SessionSnapshot };
  readonly initialWorksheetOptions?: readonly WorksheetOption[];
  readonly downstreamWorksheetOptions?: readonly WorksheetOption[];
}

export function App({ api, preloadedState, initialWorksheetOptions, downstreamWorksheetOptions }: AppProps) {
  const liveSession = useWorkbenchSession(api, { enabled: preloadedState === undefined });
  const session = preloadedState === undefined ? liveSession : createPreloadedSession(liveSession, preloadedState);
  const [selectedWorksheetName, setSelectedWorksheetName] = useState<string>();
  const initialOptions: WorksheetOption[] = (initialWorksheetOptions ?? session.snapshot?.worksheetCapabilities)?.map((option) => "status" in option
    ? option
    : {
      worksheetName: option.worksheetName,
      status: "available",
      detail: option.whatIfAvailable ? "What-if available" : "What-if pending",
    }) ?? [];
  const downstreamOptions = downstreamWorksheetOptions !== undefined
    ? [...downstreamWorksheetOptions]
    : createDownstreamOptions(session.f2Report);
  const canSubmitInitialScope = session.pendingWorkbookHash !== undefined;
  const canSubmitDownstreamScope = session.snapshot?.initialScopeSelection?.workbookContentHash !== undefined;
  const model = projectEngineeringWorkspace({
    snapshot: session.snapshot,
    f2Report: session.f2Report,
    f4Report: session.f4Report,
    f5Report: session.f5Report,
    f6Report: session.f6Report,
    ...(selectedWorksheetName === undefined ? {} : { selectedWorksheetName }),
  });

  return (
    <>
      {session.snapshot?.state !== "initial_scope_required" ? null : (
        <WorksheetSelection
          title="Initial worksheet selection"
          description="Your first selection uses the current governed workbook upload context. If this stage is restored without a local workbook hash, submission stays blocked."
          actionLabel="Confirm initial scope"
          options={initialOptions}
          blockedReason={!canSubmitInitialScope ? "The current workbook identity is missing, so the initial selection cannot be submitted. Upload the workbook again." : undefined}
          onSubmit={(worksheetNames) => session.submitCommand("confirm_initial_scope", {
            workbookHash: session.pendingWorkbookHash,
            worksheetNames,
          })}
        />
      )}
      {session.snapshot?.state !== "downstream_scope_required" ? null : (
        <WorksheetSelection
          title="Downstream worksheet selection"
             description="The second selection only allows worksheets that passed input validation. Blocked worksheets stay in the status panel and do not enter engineering analysis."
          actionLabel="Confirm engineering scope"
          options={downstreamOptions}
          blockedReason={!canSubmitDownstreamScope ? "The previously confirmed workbook identity is missing, so the downstream selection cannot be sent." : undefined}
          onSubmit={(worksheetNames) => session.submitCommand("confirm_downstream_scope", {
            workbookHash: session.snapshot?.initialScopeSelection?.workbookContentHash,
            worksheetNames,
          })}
        />
      )}
      <EngineeringWorkspace
        model={model}
        loading={session.loading}
        connected={session.connected}
        featureLedger={session.featureLedger}
        productStages={session.productStages}
        snapshot={session.snapshot}
        {...(session.runnerProgress === undefined ? {} : { runnerProgress: session.runnerProgress })}
        {...(session.snapshot?.activeAttempt?.startedAt === undefined ? {} : { activeAttemptStartedAt: session.snapshot.activeAttempt.startedAt })}
        conversation={session.conversation}
        api={session.api}
        sessionId={session.sessionId}
        inputRevision={session.snapshot?.inputRevision}
        onSaveScenario={(payload) => session.submitCommand("save_what_if_draft", payload)}
        scenarioDrafts={session.snapshot?.scenarioDrafts}
        issue={projectWorkspaceIssue(session.snapshot, session.error)}
        onUpload={session.uploadWorkbook}
        onSelectWorksheet={setSelectedWorksheetName}
        onSubmitConversation={session.appendConversation}
        f4Report={session.f4Report}
        f6Report={session.f6Report}
        f2Report={session.f2Report}
        f3Report={session.f3Report}
        adoDecisionRequired={session.snapshot?.state === "ado_decision_required"}
        adoProjection={session.adoProjection}
        onAdoDecision={(decision, workItemReference) => session.submitCommand("confirm_ado_decision", decision === "use_existing" ? { decision, workItemReference } : { decision })}
        onAdoConfirm={session.confirmAdoWrite}
        onAdoReconcile={session.reconcileAdoWrite}
        onAdoReset={() => session.submitCommand("reset_ado_decision", {})}
      />
    </>
  );
}

function createDownstreamOptions(report: F2UserReport | undefined): WorksheetOption[] {
  if (report === undefined || report.status === "inputRejected") {
    return [];
  }

  return report.worksheets.map((worksheet) => ({
    worksheetName: worksheet.worksheetName,
    status: worksheet.status,
    disabled: worksheet.status !== "ready",
    detail: worksheet.toleranceLoopDescription ?? worksheet.systemSpecification.status,
  }));
}

function createPreloadedSession(
  liveSession: UseWorkbenchSessionResult,
  preloadedState: Partial<UseWorkbenchSessionResult> & { readonly snapshot: F8SessionSnapshot },
): UseWorkbenchSessionResult {
  return {
    ...liveSession,
    ...preloadedState,
    api: preloadedState.api ?? liveSession.api,
    snapshot: preloadedState.snapshot,
    sessionId: preloadedState.sessionId ?? preloadedState.snapshot.sessionId,
    conversation: preloadedState.conversation ?? [],
    loading: preloadedState.loading ?? false,
    connected: preloadedState.connected ?? true,
    actionQueue: preloadedState.actionQueue ?? projectActionQueue(preloadedState.snapshot),
    featureLedger: preloadedState.featureLedger ?? projectFeatureLedger(preloadedState.snapshot),
    productStages: preloadedState.productStages ?? projectTaProductStages(preloadedState.snapshot, preloadedState.runnerProgress),
    uploadWorkbook: preloadedState.uploadWorkbook ?? liveSession.uploadWorkbook,
    submitCommand: preloadedState.submitCommand ?? liveSession.submitCommand,
    appendConversation: preloadedState.appendConversation ?? liveSession.appendConversation,
    clearError: preloadedState.clearError ?? liveSession.clearError,
  };
}
