import { useState } from "react";

import type { ConversationTurn, F2UserReport } from "@ai-assist/contracts";
import { projectWorksheetReview } from "@ai-assist/workbench/review";

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
import { WhatIfEditor, type WhatIfBaseline, type WhatIfValues } from "./components/WhatIfEditor.js";
import { PromotionPreview } from "./components/PromotionPreview.js";
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
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfDraftId] = useState(() => globalThis.crypto.randomUUID());
  const [whatIfFactorKey, setWhatIfFactorKey] = useState<string>();

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
  const whatIfBaselines = effectiveReviewWorksheet === undefined ? [] : createWhatIfBaselines(session.f4Report, effectiveReviewWorksheet);
  const whatIfBaseline = whatIfBaselines.find((candidate) => `${candidate.tableId}\u0000${candidate.sourceRow}` === whatIfFactorKey) ?? whatIfBaselines[0];
  const savedDraft = session.snapshot?.scenarioDrafts?.find((draft) => draft.status === "saved" && draft.worksheetName === effectiveReviewWorksheet);

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
            onSubmit={(decision, rationale, workItemReference) => session.submitCommand("confirm_ado_decision", decision === "use_existing" ? {
              decision,
              workItemReference: workItemReference!,
              ...(rationale.length === 0 ? {} : { rationale }),
            } : {
              decision,
              ...(rationale.length === 0 ? {} : { rationale }),
            })}
          />
          {review !== undefined ? <WorksheetReview review={review} onSelectWorksheet={(worksheetName) => {
            setSelectedReviewWorksheet(worksheetName);
            setSelectedReviewFinding(undefined);
          }} onSelectFinding={setSelectedReviewFinding} /> : null}
          {session.snapshot?.state === "review_required" && whatIfBaseline !== undefined ? (
            whatIfOpen ? <WhatIfEditor baseline={whatIfBaseline} factors={whatIfBaselines} onSelectFactor={setWhatIfFactorKey} api={{
              async calculate(values) {
                const patch = createWhatIfPatch(whatIfBaseline, values);
                const draft = await session.api.calculateWhatIf(session.snapshot!.sessionId, {
                  draftId: whatIfDraftId,
                  worksheetName: whatIfBaseline.worksheetName,
                  tableId: whatIfBaseline.tableId!,
                  sourceRow: whatIfBaseline.sourceRow!,
                  inputRevision: session.snapshot!.inputRevision,
                  patch,
                });
                if (draft.calculationReference === undefined || draft.calculationMetrics === undefined) throw new Error("What-if calculation result is incomplete.");
                return { status: "completed", calculationReference: draft.calculationReference, metrics: draft.calculationMetrics };
              },
              async save(_result, values) {
                const patch = createWhatIfPatch(whatIfBaseline, values);
                await session.submitCommand("save_what_if_draft", {
                  draftId: whatIfDraftId,
                  worksheetName: whatIfBaseline.worksheetName,
                  tableId: whatIfBaseline.tableId!,
                  sourceRow: whatIfBaseline.sourceRow!,
                  inputRevision: session.snapshot!.inputRevision,
                  patch,
                });
              },
            }} /> : <button type="button" className="button button--primary" onClick={() => setWhatIfOpen(true)}>打开公差试算</button>
          ) : null}
          {session.snapshot?.state === "review_required" && savedDraft?.change !== undefined
            && savedDraft.change.nominalValue === undefined && savedDraft.change.additionalMeanShift === undefined
            && whatIfBaseline !== undefined ? <PromotionPreview changes={[{
              factorName: whatIfBaseline.factorName,
              baselineUpperTolerance: whatIfBaseline.upperTolerance,
              baselineLowerTolerance: whatIfBaseline.lowerTolerance,
              draftUpperTolerance: savedDraft.change.upperTolerance ?? whatIfBaseline.upperTolerance,
              draftLowerTolerance: savedDraft.change.lowerTolerance ?? whatIfBaseline.lowerTolerance,
            }]} onConfirm={() => session.submitCommand("confirm_what_if_tolerance_promotion", { draftId: savedDraft.draftId, confirmed: true })} /> : null}
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

function createWhatIfBaselines(report: UseWorkbenchSessionResult["f4Report"], worksheetName: string): WhatIfBaseline[] {
  const calculation = report?.calculations.find((candidate) => candidate.worksheetSelection.worksheetName === worksheetName);
  if (calculation === undefined) return [];
  const statisticalMargin = Math.min(calculation.system.mean - calculation.capability.lowerSpecLimit, calculation.capability.upperSpecLimit - calculation.system.mean);
  const worstCaseMargin = Math.min(calculation.system.worstCaseLower - calculation.capability.lowerSpecLimit, calculation.capability.upperSpecLimit - calculation.system.worstCaseUpper);
  return calculation.factors.map((factor) => ({
    worksheetName,
    tableId: factor.source.tableId,
    sourceRow: factor.source.sourceRow,
    factorName: factor.factorName,
    nominalValue: factor.input.nominalValue,
    upperTolerance: factor.input.upperTolerance,
    lowerTolerance: factor.input.lowerTolerance,
    additionalMeanShift: calculation.system.additionalMeanShift,
    metrics: {
      mean: calculation.system.mean,
      rssSigma: calculation.system.rssSigma,
      cp: calculation.capability.cp,
      cpkL: calculation.capability.lowerCpk,
      cpkU: calculation.capability.upperCpk,
      cpk: calculation.capability.cpk,
      statisticalMargin,
      worstCaseMargin,
    },
  }));
}

function createWhatIfPatch(baseline: WhatIfBaseline, values: WhatIfValues): NonNullable<import("@ai-assist/contracts").F8ScenarioDraft["change"]> {
  const patch: Partial<WhatIfValues> = {};
  if (values.nominalValue !== baseline.nominalValue) patch.nominalValue = values.nominalValue;
  if (values.upperTolerance !== baseline.upperTolerance) patch.upperTolerance = values.upperTolerance;
  if (values.lowerTolerance !== baseline.lowerTolerance) patch.lowerTolerance = values.lowerTolerance;
  if (values.additionalMeanShift !== baseline.additionalMeanShift) patch.additionalMeanShift = values.additionalMeanShift;
  if (Object.keys(patch).length === 0) throw new Error("What-if values do not differ from baseline.");
  return patch;
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
