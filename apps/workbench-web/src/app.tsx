import { useEffect, useState } from "react";

import type { WorkbenchApi } from "./api.js";
import { EngineeringWorkspace } from "./components/EngineeringWorkspace.js";
import { F2FindingsDecisionDialog } from "./components/F2FindingsDecisionDialog.js";
import { WorksheetSelection, type WorksheetOption } from "./components/WorksheetSelection.js";
import { useWorkbenchSession, type UseWorkbenchSessionResult } from "./use-session.js";
import { projectActionQueue, projectFeatureLedger, projectTaProductStages, type F8SessionSnapshot } from "./workbench-session.js";
import { projectEngineeringWorkspace } from "./workspace-model.js";
import { projectWorkspaceIssue } from "./business-status.js";

export interface AppProps {
  readonly api?: WorkbenchApi;
  readonly preloadedState?: Partial<UseWorkbenchSessionResult> & { readonly snapshot: F8SessionSnapshot };
  readonly initialWorksheetOptions?: readonly WorksheetOption[];
}

export function App({ api, preloadedState, initialWorksheetOptions }: AppProps) {
  const liveSession = useWorkbenchSession(api, { enabled: preloadedState === undefined });
  const session = preloadedState === undefined ? liveSession : createPreloadedSession(liveSession, preloadedState);
  const [selectedWorksheetName, setSelectedWorksheetName] = useState<string>();
  const [findingsDialogOpen, setFindingsDialogOpen] = useState(true);
  const language = session.snapshot?.interactionLanguage.uiCatalogLanguage ?? "en";
  const scopeCopy = language === "zh" ? {
    initialTitle: "初始工作表选择",
    initialDescription: "首次选择使用当前受治理的工作簿上传上下文。如果恢复此阶段时没有本地工作簿哈希，提交将保持阻止状态。",
    initialAction: "确认初始范围",
    initialBlocked: "当前工作簿标识缺失，无法提交初始选择。请重新上传工作簿。",
  } : {
    initialTitle: "Initial worksheet selection",
    initialDescription: "Your first selection uses the current governed workbook upload context. If this stage is restored without a local workbook hash, submission stays blocked.",
    initialAction: "Confirm initial scope",
    initialBlocked: "The current workbook identity is missing, so the initial selection cannot be submitted. Upload the workbook again.",
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
  const canSubmitInitialScope = session.pendingWorkbookHash !== undefined;
  const model = projectEngineeringWorkspace({
    snapshot: session.snapshot,
    f2Report: session.f2Report,
    f4Report: session.f4Report,
    f5Report: session.f5Report,
    f6Report: session.f6Report,
    ...(selectedWorksheetName === undefined ? {} : { selectedWorksheetName }),
  });

  useEffect(() => {
    if (session.snapshot?.state === "downstream_scope_required" && session.f2Findings !== undefined) setFindingsDialogOpen(true);
  }, [session.f2Findings?.findingDigest, session.snapshot?.state]);

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
      {session.snapshot?.state !== "downstream_scope_required" || session.f2Findings === undefined || !findingsDialogOpen ? null : (
        <F2FindingsDecisionDialog
          projection={session.f2Findings}
          language={language}
          onContinue={(worksheetNames) => session.submitCommand("confirm_downstream_scope", {
            workbookHash: session.f2Findings?.workbookHash,
            worksheetNames,
          })}
          onReplace={session.replaceWorkbook}
          onCancel={() => setFindingsDialogOpen(false)}
        />
      )}
      {session.snapshot?.state !== "downstream_scope_required" || session.f2Findings === undefined || findingsDialogOpen ? null : (
        <div className="findings-reopen">
          <button type="button" className="button button--primary" onClick={() => setFindingsDialogOpen(true)}>
            {language === "zh" ? "检查工作簿发现" : "Review workbook findings"}
          </button>
        </div>
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
    replaceWorkbook: preloadedState.replaceWorkbook ?? liveSession.replaceWorkbook,
    submitCommand: preloadedState.submitCommand ?? liveSession.submitCommand,
    appendConversation: preloadedState.appendConversation ?? liveSession.appendConversation,
    clearError: preloadedState.clearError ?? liveSession.clearError,
  };
}
