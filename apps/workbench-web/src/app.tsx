import { useState } from "react";

import type { ConversationTurn, F2UserReport } from "@ai-assist/contracts";
import { projectWorksheetReview } from "@ai-assist/workbench";

import { AnalysisProgress } from "./components/AnalysisProgress.js";
import { ConversationPane } from "./components/ConversationPane.js";
import { UploadPanel } from "./components/UploadPanel.js";
import { WorksheetSelection, type WorksheetOption } from "./components/WorksheetSelection.js";
import { F0Status } from "./components/F0Status.js";
import { F2WorksheetStatus } from "./components/F2WorksheetStatus.js";
import { F3Governance } from "./components/F3Governance.js";
import { AdoDecision } from "./components/AdoDecision.js";
import { ActionQueue } from "./components/ActionQueue.js";
import { ErrorPanel } from "./components/ErrorPanel.js";
import { F7Placeholder } from "./components/F7Placeholder.js";
import { WorksheetReview } from "./components/WorksheetReview.js";
import type { WorkbenchApi } from "./api.js";
import { useWorkbenchSession, type UseWorkbenchSessionResult } from "./use-session.js";
import { projectActionQueue, projectFeatureLedger, type F8SessionSnapshot } from "./workbench-session.js";

export interface AppProps {
  readonly api?: WorkbenchApi;
  readonly preloadedState?: Partial<UseWorkbenchSessionResult> & {
    readonly snapshot: F8SessionSnapshot;
  };
  readonly initialWorksheetOptions?: readonly WorksheetOption[];
  readonly downstreamWorksheetOptions?: readonly WorksheetOption[];
}

export function App({ api, preloadedState, initialWorksheetOptions, downstreamWorksheetOptions }: AppProps) {
  const liveSession = useWorkbenchSession(api, { enabled: preloadedState === undefined });
  const session = preloadedState === undefined ? liveSession : createPreloadedSession(liveSession, preloadedState);
  const [selectedReviewWorksheet, setSelectedReviewWorksheet] = useState<string>();
  const [selectedReviewFinding, setSelectedReviewFinding] = useState<string>();

  const initialOptions: WorksheetOption[] = initialWorksheetOptions !== undefined ? [...initialWorksheetOptions] : (session.snapshot?.worksheetCapabilities ?? []).map((capability) => ({
    worksheetName: capability.worksheetName,
    status: "available",
    detail: capability.whatIfAvailable ? "What-if available" : "What-if pending",
  }));
  const downstreamOptions = downstreamWorksheetOptions !== undefined ? [...downstreamWorksheetOptions] : createDownstreamOptions(session.f2Report);
  const canSubmitInitialScope = session.pendingWorkbookHash !== undefined;
  const canSubmitDownstreamScope = session.snapshot?.initialScopeSelection?.workbookContentHash !== undefined;
  const reviewWorksheetNames = collectReviewWorksheetNames(session);
  const effectiveReviewWorksheet = selectedReviewWorksheet !== undefined && reviewWorksheetNames.includes(selectedReviewWorksheet)
    ? selectedReviewWorksheet
    : reviewWorksheetNames[0];
  const review = session.snapshot !== undefined && effectiveReviewWorksheet !== undefined
    ? projectWorksheetReview({
      sessionId: session.snapshot.sessionId,
      snapshot: session.snapshot,
      f4Report: session.f4Report,
      f5Report: session.f5Report,
      f6Report: session.f6Report,
    }, { selectedWorksheetName: effectiveReviewWorksheet, selectedFindingId: selectedReviewFinding })
    : undefined;
  const f7Status = session.featureLedger.find((entry) => entry.featureId === "F7");

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">TA Assist Workbench</p>
          <h1>F0 - F3 Guided Workbench</h1>
          <p className="hero__copy">紧凑、只读、受治理。浏览器只负责 bootstrap、对话、选择和治理决定，不复制计算和治理逻辑。</p>
        </div>
        <div className="hero__metrics" aria-label="session metrics">
          <div>
            <span>Session</span>
            <strong>{session.sessionId ?? "pending"}</strong>
          </div>
          <div>
            <span>Revision</span>
            <strong>{session.snapshot?.revision ?? 0}</strong>
          </div>
          <div>
            <span>State</span>
            <strong>{session.snapshot?.state ?? "loading"}</strong>
          </div>
        </div>
      </header>

      <ErrorPanel error={session.error} onDismiss={session.clearError} />

      <div className="layout-grid">
        <section className="layout-grid__primary">
          <UploadPanel disabled={session.loading} onUpload={session.uploadWorkbook} />
          <F0Status stateLabel={session.snapshot?.state ?? "loading"} entries={session.featureLedger} connected={session.connected} />
          <AnalysisProgress entries={session.featureLedger} />
          <WorksheetSelection
            title="初始 Worksheet 选择"
            description="第一次选择基于本次受控 workbook 上传上下文。恢复到该阶段但没有本地 workbook hash 时，会保持阻塞。"
            actionLabel="确认初始分析范围"
            options={initialOptions}
            disabled={session.snapshot?.state !== "initial_scope_required"}
            blockedReason={session.snapshot?.state === "initial_scope_required" && !canSubmitInitialScope ? "缺少当前 workbook identity，无法合法提交初次选择。请重新上传 workbook。" : undefined}
            onSubmit={(worksheetNames) => session.submitCommand("confirm_initial_scope", {
              workbookHash: session.pendingWorkbookHash,
              worksheetNames,
            })}
          />
          <F2WorksheetStatus report={session.f2Report} />
          <WorksheetSelection
            title="下游 Worksheet 选择"
            description="第二次选择只允许 F2 ready worksheets。blocked worksheets 保留在状态面板，但不会进入工程分析。"
            actionLabel="确认进入工程分析"
            options={downstreamOptions}
            disabled={session.snapshot?.state !== "downstream_scope_required"}
            blockedReason={session.snapshot?.state === "downstream_scope_required" && !canSubmitDownstreamScope ? "上一次已确认的 workbook identity 缺失，不能发送下游选择。" : undefined}
            onSubmit={(worksheetNames) => session.submitCommand("confirm_downstream_scope", {
              workbookHash: session.snapshot?.initialScopeSelection?.workbookContentHash,
              worksheetNames,
            })}
          />
          <F3Governance report={session.f3Report} />
          <AdoDecision
            visible={session.snapshot?.state === "ado_decision_required" && session.f3Report?.status === "governance_required"}
            onSubmit={(decision, rationale) => session.submitCommand("confirm_ado_decision", {
              decision,
              rationale: rationale.length === 0 ? undefined : rationale,
            })}
          />
          {review !== undefined ? <WorksheetReview review={review} onSelectWorksheet={(worksheetName) => {
            setSelectedReviewWorksheet(worksheetName);
            setSelectedReviewFinding(undefined);
          }} onSelectFinding={setSelectedReviewFinding} /> : null}
          <ActionQueue items={session.actionQueue} />
          {f7Status !== undefined ? <F7Placeholder status={f7Status} /> : null}
        </section>

        <aside className="layout-grid__secondary">
          <ConversationPane turns={session.conversation} disabled={session.loading} onSubmit={session.appendConversation} />
        </aside>
      </div>
    </main>
  );
}

function collectReviewWorksheetNames(session: UseWorkbenchSessionResult): string[] {
  const names = new Set<string>();
  for (const worksheet of session.f6Report?.worksheets ?? []) {
    if (typeof worksheet.worksheetName === "string" && worksheet.worksheetName.length > 0) names.add(worksheet.worksheetName);
  }
  for (const worksheet of session.f5Report?.worksheets ?? []) {
    if (typeof worksheet.worksheetName === "string" && worksheet.worksheetName.length > 0) names.add(worksheet.worksheetName);
  }
  for (const calculation of session.f4Report?.calculations ?? []) {
    if (typeof calculation.worksheetSelection?.worksheetName === "string" && calculation.worksheetSelection.worksheetName.length > 0) {
      names.add(calculation.worksheetSelection.worksheetName);
    }
  }
  for (const worksheetName of session.snapshot?.downstreamScopeSelection?.selectedWorksheetNames ?? []) {
    if (typeof worksheetName === "string" && worksheetName.length > 0) names.add(worksheetName);
  }
  return [...names];
}

function createDownstreamOptions(report: F2UserReport | undefined): WorksheetOption[] {
  if (report === undefined || report.status === "input_rejected") {
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
  const sessionId = preloadedState.sessionId ?? preloadedState.snapshot.sessionId;
  const conversation = preloadedState.conversation ?? [];

  return {
    ...liveSession,
    ...preloadedState,
    sessionId,
    conversation,
    loading: preloadedState.loading ?? false,
    connected: preloadedState.connected ?? true,
    actionQueue: preloadedState.actionQueue ?? projectActionQueue(preloadedState.snapshot),
    featureLedger: preloadedState.featureLedger ?? projectFeatureLedger(preloadedState.snapshot),
    async uploadWorkbook(file) {
      await liveSession.api.uploadWorkbook(sessionId, preloadedState.snapshot.revision, file);
    },
    async submitCommand(command, payload) {
      await liveSession.api.submitCommand(sessionId, preloadedState.snapshot.revision, command, payload);
    },
    async appendConversation(message) {
      await liveSession.api.appendConversationTurn(createConversationTurn(sessionId, conversation, message));
    },
  };
}

function createConversationTurn(sessionId: string, conversation: readonly ConversationTurn[], message: string): ConversationTurn {
  const sequence = conversation.length === 0 ? 0 : conversation[conversation.length - 1]!.sequence + 1;
  return {
    contractVersion: "ta-conversation-turn-v1",
    turnId: globalThis.crypto.randomUUID(),
    sessionId,
    sequence,
    source: "web",
    role: "user",
    content: [{ kind: "text", text: message }],
    createdAt: new Date().toISOString(),
    relatedArtifactIds: [],
  };
}
