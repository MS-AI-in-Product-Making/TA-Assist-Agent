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
  const language = session.snapshot?.interactionLanguage.uiCatalogLanguage ?? "en";
  const scopeCopy = language === "zh" ? {
    initialTitle: "初始工作表选择",
    initialDescription: "首次选择使用当前受治理的工作簿上传上下文。如果恢复此阶段时没有本地工作簿哈希，提交将保持阻止状态。",
    initialAction: "确认初始范围",
    initialBlocked: "当前工作簿标识缺失，无法提交初始选择。请重新上传工作簿。",
    downstreamTitle: "后续工作表选择",
    downstreamDescription: "第二次选择仅允许已通过输入校验的工作表。被阻止的工作表会保留在状态面板中，不会进入工程分析。",
    downstreamAction: "确认工程范围",
    downstreamBlocked: "此前确认的工作簿标识缺失，无法发送后续选择。",
  } : {
    initialTitle: "Initial worksheet selection",
    initialDescription: "Your first selection uses the current governed workbook upload context. If this stage is restored without a local workbook hash, submission stays blocked.",
    initialAction: "Confirm initial scope",
    initialBlocked: "The current workbook identity is missing, so the initial selection cannot be submitted. Upload the workbook again.",
    downstreamTitle: "Downstream worksheet selection",
    downstreamDescription: "The second selection only allows worksheets that passed input validation. Blocked worksheets stay in the status panel and do not enter engineering analysis.",
    downstreamAction: "Confirm engineering scope",
    downstreamBlocked: "The previously confirmed workbook identity is missing, so the downstream selection cannot be sent.",
  };
  const initialOptions: WorksheetOption[] = (initialWorksheetOptions ?? session.snapshot?.worksheetCapabilities)?.map((option) => "status" in option
    ? option
    : {
      worksheetName: option.worksheetName,
      status: "available",
      detail: option.whatIfAvailable
        ? (language === "zh" ? "What-if 可用" : "What-if available")
        : (language === "zh" ? "What-if 待处理" : "What-if pending"),
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
          title={scopeCopy.initialTitle}
          description={scopeCopy.initialDescription}
          actionLabel={scopeCopy.initialAction}
          options={initialOptions}
          blockedReason={!canSubmitInitialScope ? scopeCopy.initialBlocked : undefined}
          language={language}
          onSubmit={(worksheetNames) => session.submitCommand("confirm_initial_scope", {
            workbookHash: session.pendingWorkbookHash,
            worksheetNames,
          })}
        />
      )}
      {session.snapshot?.state !== "downstream_scope_required" ? null : (
        <WorksheetSelection
           title={scopeCopy.downstreamTitle}
           description={scopeCopy.downstreamDescription}
           actionLabel={scopeCopy.downstreamAction}
          options={downstreamOptions}
          blockedReason={!canSubmitDownstreamScope ? scopeCopy.downstreamBlocked : undefined}
          language={language}
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
        onSubmitCommand={(command, payload) => session.submitCommand(command, payload)}
        f4Report={session.f4Report}
        f6Report={session.f6Report}
        f2Report={session.f2Report}
        f3Report={session.f3Report}
        adoDecisionRequired={session.snapshot?.state === "ado_decision_required"}
        adoProjection={session.adoProjection}
        onAdoDecision={(decision, workItemReference) => session.submitCommand("confirm_ado_decision", decision === "use_existing" ? { decision, workItemReference } : { decision })}
        onAdoConfirm={session.confirmAdoWrite}
        onAdoReconcile={session.reconcileAdoWrite}
        onAdoStartNewWriteGeneration={session.startNewAdoWriteGeneration}
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
