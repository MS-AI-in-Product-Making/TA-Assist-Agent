import { useEffect, useMemo, useRef, useState } from "react";

import { createTypedError, type ConversationTurn, type DrawingGovernanceResultV2, type F2UserReport, type TypedError } from "@ai-assist/contracts";

import { createWorkbenchApi, type WorkbenchApi } from "./api.js";
import { projectActionQueue, projectFeatureLedger, type F8CommandKind, type F8SessionSnapshot } from "./workbench-session.js";

export interface UseWorkbenchSessionResult {
  readonly api: WorkbenchApi;
  readonly sessionId?: string;
  readonly snapshot?: F8SessionSnapshot;
  readonly conversation: readonly ConversationTurn[];
  readonly pendingWorkbookHash?: string;
  readonly f2Report?: F2UserReport;
  readonly f3Report?: DrawingGovernanceResultV2;
  readonly loading: boolean;
  readonly connected: boolean;
  readonly error?: TypedError;
  readonly actionQueue: ReturnType<typeof projectActionQueue>;
  readonly featureLedger: ReturnType<typeof projectFeatureLedger>;
  readonly uploadWorkbook: (file: File) => Promise<void>;
  readonly submitCommand: (command: F8CommandKind, payload: Record<string, unknown>) => Promise<void>;
  readonly appendConversation: (message: string) => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<TypedError>();
  const lastEventIdRef = useRef<string>();

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
        setConnected(true);
        setError((current) => current?.code === "transient_error" ? undefined : current);
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
        setError(toTypedError(bootstrapError, "工作台初始化失败。", "刷新页面后重试。"));
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
    if (!enabled) {
      setF2Report(undefined);
      setF3Report(undefined);
      return () => undefined;
    }

    let cancelled = false;

    const loadArtifacts = async () => {
      if (snapshot === undefined) {
        setF2Report(undefined);
        setF3Report(undefined);
        return;
      }

      const refs = snapshot.artifactRefs ?? [];
      const f2Artifact = [...refs].reverse().find((artifact) => artifact.kind === "f2_report" && artifact.validated);
      const f3Artifact = [...refs].reverse().find((artifact) => artifact.kind === "f3_report" && artifact.validated);

      try {
        const [nextF2, nextF3] = await Promise.all([
          f2Artifact === undefined ? Promise.resolve(undefined) : api.loadArtifactJson(snapshot.sessionId, f2Artifact.artifactId, "f2_report"),
          f3Artifact === undefined ? Promise.resolve(undefined) : api.loadArtifactJson(snapshot.sessionId, f3Artifact.artifactId, "f3_report"),
        ]);
        if (cancelled) return;
        setF2Report(nextF2 as F2UserReport | undefined);
        setF3Report(nextF3 as DrawingGovernanceResultV2 | undefined);
      } catch (artifactError) {
        if (cancelled) return;
        setError(toTypedError(artifactError, "受控 artifact 读取失败。", "刷新会话快照后重试。"));
      }
    };

    void loadArtifacts();
    return () => {
      cancelled = true;
    };
  }, [api, enabled, snapshot]);

  const actionQueue = snapshot === undefined ? [] : projectActionQueue(snapshot);
  const featureLedger = snapshot === undefined ? [] : projectFeatureLedger(snapshot);

  return {
    api,
    sessionId,
    snapshot,
    conversation,
    pendingWorkbookHash,
    f2Report,
    f3Report,
    loading,
    connected,
    error,
    actionQueue,
    featureLedger,
    async uploadWorkbook(file) {
      if (snapshot === undefined || sessionId === undefined) {
        setError(createTypedError({
          code: "prerequisite_not_ready",
          summary: "会话尚未准备好，暂时不能上传 workbook。",
          suggestedAction: "等待工作台完成初始化后重试。",
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
        setError(toTypedError(uploadError, "workbook 上传失败。", "确认文件有效后重试。"));
      }
    },
    async submitCommand(command, payload) {
      if (snapshot === undefined || sessionId === undefined) {
        setError(createTypedError({
          code: "prerequisite_not_ready",
          summary: "会话尚未准备好，暂时不能提交命令。",
          suggestedAction: "等待工作台完成初始化后重试。",
          affectedInputReferences: [command],
        }));
        return;
      }

      try {
        const nextSnapshot = await api.submitCommand(sessionId, snapshot.revision, command, payload);
        setSnapshot(nextSnapshot);
        setError(undefined);
      } catch (commandError) {
        setError(toTypedError(commandError, `命令 ${command} 被拒绝。`, "刷新快照并检查当前状态后重试。"));
      }
    },
    async appendConversation(message) {
      if (sessionId === undefined) {
        setError(createTypedError({
          code: "prerequisite_not_ready",
          summary: "会话尚未准备好，暂时不能发送消息。",
          suggestedAction: "等待工作台完成初始化后重试。",
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
        const appended = await api.appendConversationTurn(turn);
        setConversation((current) => [...current, appended]);
        setError(undefined);
      } catch (conversationError) {
        setError(toTypedError(conversationError, "消息发送失败。", "检查会话状态后重试。"));
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
