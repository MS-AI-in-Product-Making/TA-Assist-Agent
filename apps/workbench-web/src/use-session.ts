import { useEffect, useMemo, useRef, useState } from "react";

import {
  createTypedError,
  type DrawingGovernanceResultV2,
  type F2UserReport,
  type F4WorkflowCalculationResult,
  type F5DataInterpretationResult,
  type F6OptimizationResultV2,
  type TypedError,
  type F8AdoProjection,
  type F8AdoWriteConfirmation,
} from "@ai-assist/contracts";
import type { ConversationTurn } from "@ai-assist/conversation";
import { selectCompleteReviewContext } from "@ai-assist/workbench/review";

import { createWorkbenchApi, type RunnerProgressEvent, type TaConversationContext, type WorkbenchApi } from "./api.js";
import { projectActionQueue, projectFeatureLedger, projectTaProductStages, type F8CommandKind, type F8SessionSnapshot } from "./workbench-session.js";

export interface UseWorkbenchSessionResult {
  readonly api: WorkbenchApi;
  readonly sessionId?: string;
  readonly snapshot?: F8SessionSnapshot;
  readonly conversation: readonly ConversationTurn[];
  readonly pendingWorkbookHash?: string;
  readonly f2Report?: F2UserReport;
  readonly f3Report?: DrawingGovernanceResultV2;
  readonly f4Report?: F4WorkflowCalculationResult;
  readonly f5Report?: F5DataInterpretationResult;
  readonly f6Report?: F6OptimizationResultV2;
  readonly adoProjection?: F8AdoProjection;
  readonly loading: boolean;
  readonly connected: boolean;
  readonly runnerProgress?: RunnerProgressEvent;
  readonly error?: TypedError;
  readonly actionQueue: ReturnType<typeof projectActionQueue>;
  readonly featureLedger: ReturnType<typeof projectFeatureLedger>;
  readonly productStages: ReturnType<typeof projectTaProductStages>;
  readonly uploadWorkbook: (file: File) => Promise<void>;
  readonly submitCommand: (command: F8CommandKind, payload: Record<string, unknown>) => Promise<void>;
  readonly appendConversation: (message: string, context?: TaConversationContext) => Promise<void>;
  readonly confirmAdoWrite: (confirmation: F8AdoWriteConfirmation) => Promise<void>;
  readonly clearError: () => void;
}

export interface UseWorkbenchSessionOptions {
  readonly enabled?: boolean;
}

export function useWorkbenchSession(apiOverride?: WorkbenchApi, options: UseWorkbenchSessionOptions = {}): UseWorkbenchSessionResult {
  const api = useMemo(() => apiOverride ?? createWorkbenchApi(), [apiOverride]);
  const enabled = options.enabled ?? true;
  const [sessionId, setSessionId] = useState<string>();
  const [snapshot, setSnapshot] = useState<F8SessionSnapshot>();
  const [conversation, setConversation] = useState<readonly ConversationTurn[]>([]);
  const [pendingWorkbookHash, setPendingWorkbookHash] = useState<string>();
  const [f2Report, setF2Report] = useState<F2UserReport>();
  const [f3Report, setF3Report] = useState<DrawingGovernanceResultV2>();
  const [f4Report, setF4Report] = useState<F4WorkflowCalculationResult>();
  const [f5Report, setF5Report] = useState<F5DataInterpretationResult>();
  const [f6Report, setF6Report] = useState<F6OptimizationResultV2>();
  const [adoProjection, setAdoProjection] = useState<F8AdoProjection>();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [runnerProgress, setRunnerProgress] = useState<RunnerProgressEvent>();
  const [error, setError] = useState<TypedError>();
  const lastEventIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setConnected(false);
      return () => undefined;
    }

    let cancelled = false;
    let dispose = (): void => undefined;
    let reconnectHandle: ReturnType<typeof setTimeout> | undefined;

    const subscribe = (activeSessionId: string) => api.subscribe(activeSessionId, {
      onSnapshot(nextSnapshot, eventId) {
        if (cancelled) return;
        lastEventIdRef.current = eventId;
        setSnapshot(nextSnapshot);
        if (nextSnapshot.activeAttempt === null) setRunnerProgress(undefined);
        setConnected(true);
        setError((current) => current?.code === "transient_error" ? undefined : current);
      },
      onProgress(progress, eventId) {
        if (cancelled) return;
        lastEventIdRef.current = eventId;
        setRunnerProgress(progress);
        setConnected(true);
      },
      onError(nextError) {
        if (cancelled) return;
        setConnected(false);
        setError(nextError);
        if (reconnectHandle !== undefined) {
          clearTimeout(reconnectHandle);
        }
        reconnectHandle = setTimeout(() => {
          dispose();
          dispose = subscribe(activeSessionId);
        }, 1500);
      },
    }, lastEventIdRef.current);

    const connect = async () => {
      try {
        setLoading(true);
        const bootstrap = await api.bootstrap();
        if (cancelled) return;
        setSessionId(bootstrap.sessionId);
        setSnapshot(bootstrap.snapshot);
        setConversation(bootstrap.conversation);
        setPendingWorkbookHash(bootstrap.pendingWorkbookHash);
        setConnected(true);
        setLoading(false);
        dispose = subscribe(bootstrap.sessionId);
      } catch (bootstrapError) {
        if (cancelled) return;
        setConnected(false);
        setLoading(false);
        setError(toTypedError(bootstrapError, "Workspace initialization failed.", "Refresh the page and try again."));
      }
    };

    void connect();
    return () => {
      cancelled = true;
      if (reconnectHandle !== undefined) clearTimeout(reconnectHandle);
      dispose();
    };
  }, [api, enabled]);

  useEffect(() => {
    if (!enabled || sessionId === undefined) return () => undefined;
    let cancelled = false;
    const refresh = async () => {
      try { const turns = await api.readConversation(sessionId); if (!cancelled) setConversation(turns); } catch { /* SSE connection indicator owns connectivity feedback. */ }
    };
    const handle = setInterval(() => { void refresh(); }, 1_000);
    return () => { cancelled = true; clearInterval(handle); };
  }, [api, enabled, sessionId]);

  useEffect(() => {
    if (!enabled) {
      setF2Report(undefined);
      setF3Report(undefined);
      setF4Report(undefined);
      setF5Report(undefined);
      setF6Report(undefined);
      return () => undefined;
    }

    let cancelled = false;

    const loadArtifacts = async () => {
      if (snapshot === undefined) {
        setF2Report(undefined);
        setF3Report(undefined);
        setF4Report(undefined);
        setF5Report(undefined);
        setF6Report(undefined);
        return;
      }

      const refs = snapshot.artifactRefs ?? [];
      const f2Artifact = [...refs].reverse().find((artifact) => artifact.kind === "f2_report" && artifact.validated);
      const reviewContext = selectCompleteReviewContext(snapshot);
      const f3Artifact = reviewContext?.artifacts.get("f3_report")
        ?? [...refs].reverse().find((artifact) => artifact.kind === "f3_report" && artifact.validated && artifact.revision === snapshot.inputRevision);
      const f4Artifact = reviewContext?.artifacts.get("f4_calculation")
        ?? [...refs].reverse().find((artifact) => artifact.kind === "f4_calculation" && artifact.validated && artifact.revision === snapshot.inputRevision);
      const f5Artifact = reviewContext?.artifacts.get("f5_report");
      const f6Artifact = reviewContext?.artifacts.get("f6_optimization");

      const results = await Promise.allSettled([
          f2Artifact === undefined ? Promise.resolve(undefined) : api.loadArtifactJson(snapshot.sessionId, f2Artifact.artifactId, "f2_report"),
          f3Artifact === undefined ? Promise.resolve(undefined) : api.loadArtifactJson(snapshot.sessionId, f3Artifact.artifactId, "f3_report"),
          f4Artifact === undefined ? Promise.resolve(undefined) : api.loadArtifactJson(snapshot.sessionId, f4Artifact.artifactId, "f4_calculation"),
          f5Artifact === undefined ? Promise.resolve(undefined) : api.loadArtifactJson(snapshot.sessionId, f5Artifact.artifactId, "f5_report"),
          f6Artifact === undefined ? Promise.resolve(undefined) : api.loadArtifactJson(snapshot.sessionId, f6Artifact.artifactId, "f6_optimization"),
        ]);
      if (cancelled) return;
      const [nextF2, nextF3, nextF4, nextF5, nextF6] = results.map((result) => result.status === "fulfilled" ? result.value : undefined);
      setF2Report(nextF2 as F2UserReport | undefined);
      setF3Report(nextF3 as DrawingGovernanceResultV2 | undefined);
      setF4Report(nextF4 as F4WorkflowCalculationResult | undefined);
      setF5Report(nextF5 as F5DataInterpretationResult | undefined);
      setF6Report(nextF6 as F6OptimizationResultV2 | undefined);
      const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failed !== undefined) setError(toTypedError(failed.reason, "Governed artifact read failed.", "Refresh the session snapshot and try again."));
      else setError((current) => current?.summary === "Governed artifact read failed." ? undefined : current);
    };

    void loadArtifacts();
    return () => {
      cancelled = true;
    };
  }, [api, enabled, snapshot]);

  useEffect(() => {
    if (!enabled || sessionId === undefined || snapshot?.state !== "ado_action_pending") {
      setAdoProjection(undefined);
      return () => undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const projection = await api.readAdoProjection(sessionId);
        if (!cancelled) {
          setAdoProjection(projection);
          setError((current) => current?.summary === "ADO status read failed." ? undefined : current);
        }
      } catch (projectionError) {
        if (!cancelled) setError(toTypedError(projectionError, "ADO status read failed.", "Wait for automatic retry or refresh the workspace."));
      }
    };
    void load();
    const handle = setInterval(() => { void load(); }, 1_000);
    return () => { cancelled = true; clearInterval(handle); };
  }, [api, enabled, sessionId, snapshot?.state]);

  const actionQueue = snapshot === undefined ? [] : projectActionQueue(snapshot);
  const featureLedger = snapshot === undefined ? [] : projectFeatureLedger(snapshot);
  const stageProgress = runnerProgress === undefined
    ? undefined
    : {
        kind: runnerProgress.kind,
        featureId: runnerProgress.featureId,
      };
  const productStages = snapshot === undefined ? [] : projectTaProductStages(snapshot, stageProgress);

  return {
    api,
    sessionId,
    snapshot,
    conversation,
    pendingWorkbookHash,
    f2Report,
    f3Report,
    f4Report,
    f5Report,
    f6Report,
    adoProjection,
    loading,
    connected,
    ...(runnerProgress === undefined ? {} : { runnerProgress }),
    error,
    actionQueue,
    featureLedger,
    productStages,
    async uploadWorkbook(file) {
      if (snapshot === undefined || sessionId === undefined) {
        setError(createTypedError({
          code: "prerequisite_not_ready",
          summary: "The session is not ready to upload a workbook yet.",
          suggestedAction: "Wait for workspace initialization to finish and try again.",
          affectedInputReferences: ["session"],
        }));
        return;
      }

      try {
        const result = await api.uploadWorkbook(sessionId, snapshot.revision, file);
        setSnapshot(result.snapshot);
        setPendingWorkbookHash(result.workbookHash);
        setError(undefined);
      } catch (uploadError) {
        setError(toTypedError(uploadError, "Workbook upload failed.", "Confirm the file is valid and try again."));
      }
    },
    async submitCommand(command, payload) {
      if (snapshot === undefined || sessionId === undefined) {
        setError(createTypedError({
          code: "prerequisite_not_ready",
          summary: "The session is not ready to submit commands yet.",
          suggestedAction: "Wait for workspace initialization to finish and try again.",
          affectedInputReferences: [command],
        }));
        return;
      }

      try {
        const nextSnapshot = await api.submitCommand(sessionId, snapshot.revision, command, payload);
        setSnapshot(nextSnapshot);
        setError(undefined);
      } catch (commandError) {
        setError(toTypedError(commandError, `Command ${command} was rejected.`, "Refresh the snapshot, review the current state, and try again."));
      }
    },
    async appendConversation(message, context) {
      if (sessionId === undefined) {
        setError(createTypedError({
          code: "prerequisite_not_ready",
          summary: "The session is not ready to send messages yet.",
          suggestedAction: "Wait for workspace initialization to finish and try again.",
          affectedInputReferences: ["conversation"],
        }));
        return;
      }

      const sequence = conversation.length === 0 ? 0 : conversation[conversation.length - 1]!.sequence + 1;
      const turn: ConversationTurn = {
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

      try {
        setConversation((current) => [...current, turn]);
        const appended = await api.appendConversationTurn(turn, context);
        setConversation((current) => [...current, appended]);
        setError(undefined);
      } catch (conversationError) {
        setError(toTypedError(conversationError, "Message send failed.", "Check the session state and try again."));
      }
    },
    async confirmAdoWrite(confirmation) {
      if (sessionId === undefined) return;
      try {
        await api.confirmAdoWrite(sessionId, confirmation);
        setAdoProjection(await api.readAdoProjection(sessionId));
        setError(undefined);
      } catch (confirmationError) {
        setError(toTypedError(confirmationError, "ADO write confirmation was rejected.", "Refresh the preview and confirm again."));
      }
    },
    clearError() {
      setError(undefined);
    },
  };
}

function toTypedError(error: unknown, summary: string, suggestedAction: string): TypedError {
  if (typeof error === "object" && error !== null && "code" in error && "summary" in error) {
    return error as TypedError;
  }

  return createTypedError({
    code: "validation_error",
    summary,
    suggestedAction,
    affectedInputReferences: [],
  });
}
