import { describe, expect, it } from "vitest";
import {
  f8SessionCommandSchema,
  f8SessionSnapshotSchema,
  f8SessionEventSchema,
  conversationTurnSchema,
  hostActionRequestSchema,
  hostActionClaimSchema,
  hostActionResultSchema,
  f8ScenarioDraftSchema,
} from "./index.js";

const SESSION_ID = "session-8d2a2d73-7f55-4f7d-8fa1-b4f6d2f66d31";
const COMMAND_ID = "command-5a9fba33-2c18-4a74-9d4d-6f8b21efc01d";
const WORKBOOK_HASH = "a".repeat(64);
const CANONICAL_NAVIGATE_ACTIONS = [
  { type: "navigate", target: "/scope", label: "选择 Worksheets" },
  { type: "navigate", target: "/scope/downstream", label: "确认下游 Worksheets" },
  { type: "navigate", target: "/ado/preview", label: "查看 ADO 预览" },
  { type: "navigate", target: "/images/decision", label: "确认图片上下文" },
  { type: "navigate", target: "/analysis/context", label: "确认 Analysis Context" },
  { type: "navigate", target: "/optimization/targets", label: "确认 Optimization Targets" },
  { type: "navigate", target: "/review", label: "完成评审" },
  { type: "navigate", target: "/status", label: "查看运行状态" },
] as const;

function conversationTurnWithActions(actions: readonly unknown[]) {
  return {
    contractVersion: "ta-conversation-turn-v1",
    turnId: "turn-actions-1",
    sessionId: SESSION_ID,
    sequence: 8,
    source: "system",
    role: "assistant",
    content: [
      { kind: "text", text: "动作已准备。" },
      {
        kind: "tool_result",
        actions,
        commands: [],
      },
    ],
    createdAt: "2026-08-24T00:00:00.000Z",
    relatedArtifactIds: [],
  };
}

describe("F8 session and host contracts", () => {
  it("accepts an idempotent command and rejects unknown fields", () => {
    const command = {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: COMMAND_ID,
      expectedRevision: 3,
      command: "confirm_initial_scope",
      payload: { worksheetNames: ["AJ_GAP"], workbookHash: WORKBOOK_HASH },
    };

    expect(f8SessionCommandSchema.parse(command)).toEqual(command);
    expect(() => f8SessionCommandSchema.parse({ ...command, outputRoot: "C:/arbitrary" })).toThrow();
  });

  it("keeps the session snapshot and event surfaces strict", () => {
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: SESSION_ID,
      revision: 4,
      inputRevision: 2,
      state: "review_required",
      activeAttempt: null,
      priorRunReferences: [],
      artifactRefs: [
        {
          artifactId: "artifact-report-1",
          kind: "f6_report",
          revision: 4,
          validated: true,
          reviewContextId: "a".repeat(64),
        },
      ],
      worksheetCapabilities: [
        {
          worksheetName: "AJ_GAP",
          whatIfAvailable: true,
        },
      ],
      scenarioDrafts: [],
    };

    const event = {
      contractVersion: "f8-session-event-v1",
      sessionId: SESSION_ID,
      revision: 4,
      eventId: "event-1",
      kind: "snapshot_updated",
      timestamp: "2026-08-24T00:00:00.000Z",
      snapshot,
    };

    expect(f8SessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(f8SessionEventSchema.parse(event)).toEqual(event);
    expect(() => f8SessionSnapshotSchema.parse({ ...snapshot, outputRoot: "C:/arbitrary" })).toThrow();
    expect(() => f8SessionEventSchema.parse({ ...event, outputRoot: "C:/arbitrary" })).toThrow();
  });

  it("allows only one active WHAT_IF draft in a session snapshot", () => {
    const draft = {
      contractVersion: "f8-scenario-draft-v1",
      draftId: "draft-a",
      sessionId: SESSION_ID,
      worksheetName: "AJ_GAP",
      inputRevision: 2,
      status: "draft",
      mode: "WHAT_IF",
      change: { upperTolerance: 0.04 },
    } as const;
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: SESSION_ID,
      revision: 4,
      inputRevision: 2,
      state: "review_required",
      activeAttempt: null,
      priorRunReferences: [],
      scenarioDrafts: [draft, { ...draft, draftId: "draft-b", worksheetName: "B_STACK" }],
    };

    expect(() => f8SessionSnapshotSchema.parse(snapshot)).toThrow(/one active/i);
    expect(f8SessionSnapshotSchema.parse({
      ...snapshot,
      scenarioDrafts: [draft, { ...draft, draftId: "draft-old", status: "superseded" }],
    }).scenarioDrafts).toHaveLength(2);
  });

  it("accepts typed artifact refs, worksheet capabilities, and strict tool receipts", () => {
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: SESSION_ID,
      revision: 6,
      inputRevision: 2,
      state: "review_required",
      activeAttempt: null,
      priorRunReferences: [],
      artifactRefs: [
        {
          artifactId: "artifact-report-2",
          kind: "f6_report",
          revision: 6,
          validated: true,
          reviewContextId: "b".repeat(64),
          sourceReferenceId: "f6-current",
        },
      ],
      worksheetCapabilities: [
        {
          worksheetName: "AJ_GAP",
          whatIfAvailable: false,
        },
      ],
    };

    const toolTurn = {
      contractVersion: "ta-conversation-turn-v1",
      turnId: "turn-tool-1",
      sessionId: SESSION_ID,
      sequence: 8,
      source: "system",
      role: "assistant",
      content: [
        { kind: "text", text: "已准备好报告。" },
        {
          kind: "tool_result",
          actions: [{ type: "open_report", target: "/report/current", label: "打开当前报告" }],
          commands: [],
        },
      ],
      createdAt: "2026-08-24T00:00:00.000Z",
      relatedArtifactIds: [],
    };

    expect(f8SessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(conversationTurnSchema.parse(toolTurn)).toEqual(toolTurn);
    expect(() => f8SessionSnapshotSchema.parse({
      ...snapshot,
      artifactRefs: [{ artifactId: "artifact-report-2", revision: 6, validated: true }],
    })).toThrow();
    expect(() => f8SessionSnapshotSchema.parse({
      ...snapshot,
      artifactRefs: [{ artifactId: "artifact-report-2", kind: "f6_report", revision: 6, validated: true }],
    })).toThrow();
    expect(f8SessionSnapshotSchema.parse({
      ...snapshot,
      artifactRefs: [{ artifactId: "artifact-f2", kind: "f2_report", revision: 6, validated: true }],
    }).artifactRefs).toEqual([{ artifactId: "artifact-f2", kind: "f2_report", revision: 6, validated: true }]);
    expect(() => conversationTurnSchema.parse({
      ...toolTurn,
      content: [
        toolTurn.content[0],
        {
          kind: "tool_result",
          actions: [{ type: "open_report", target: "/report/current", label: "打开当前报告", extra: true }],
          commands: [],
        },
      ],
    })).toThrow();
    expect(() => conversationTurnSchema.parse({
      ...toolTurn,
      content: [
        toolTurn.content[0],
        {
          kind: "tool_result",
          actions: [{ type: "open_report", target: "https://evil.invalid/phish", label: "外部 URL" }],
          commands: [],
        },
      ],
    })).toThrow();
    expect(() => conversationTurnSchema.parse({
      ...toolTurn,
      content: [
        toolTurn.content[0],
        {
          kind: "tool_result",
          actions: [{ type: "open_report", target: "/report/current", label: "打开当前报告" }],
          commands: [{ id: "cmd-1", kind: "surprise_write" }],
        },
      ],
    })).toThrow();
  });

  it("accepts only canonical navigate target and label pairs", () => {
    for (const action of CANONICAL_NAVIGATE_ACTIONS) {
      expect(conversationTurnSchema.parse(conversationTurnWithActions([action])).content[1]).toEqual({
        kind: "tool_result",
        actions: [action],
        commands: [],
      });
    }

    const representativeCrossPairs = CANONICAL_NAVIGATE_ACTIONS.map((action, index) => ({
      ...action,
      label: CANONICAL_NAVIGATE_ACTIONS[(index + 1) % CANONICAL_NAVIGATE_ACTIONS.length].label,
    }));

    for (const action of representativeCrossPairs) {
      expect(() => conversationTurnSchema.parse(conversationTurnWithActions([action]))).toThrow();
    }
    expect(() => conversationTurnSchema.parse(conversationTurnWithActions([
      { type: "navigate", target: "/status", label: "查看失败状态" },
    ]))).toThrow();
  });

  it("keeps report and what-if actions as strict canonical objects", () => {
    expect(conversationTurnSchema.parse(conversationTurnWithActions([
      { type: "open_report", target: "/report/current", label: "打开当前报告" },
    ])).content[1]).toEqual({
      kind: "tool_result",
      actions: [{ type: "open_report", target: "/report/current", label: "打开当前报告" }],
      commands: [],
    });
    expect(conversationTurnSchema.parse(conversationTurnWithActions([
      { type: "open_what_if", target: "/what-if", label: "打开 What-if Draft" },
    ])).content[1]).toEqual({
      kind: "tool_result",
      actions: [{ type: "open_what_if", target: "/what-if", label: "打开 What-if Draft" }],
      commands: [],
    });

    expect(() => conversationTurnSchema.parse(conversationTurnWithActions([
      { type: "open_report", target: "/report/current", label: "打开 What-if Draft" },
    ]))).toThrow();
    expect(() => conversationTurnSchema.parse(conversationTurnWithActions([
      { type: "open_what_if", target: "/what-if", label: "打开当前报告" },
    ]))).toThrow();
  });

  it("keeps conversation turns, host actions, and drafts strict", () => {
    const conversationTurn = {
      contractVersion: "ta-conversation-turn-v1",
      turnId: "turn-1",
      sessionId: SESSION_ID,
      sequence: 7,
      source: "web",
      role: "assistant",
      content: [{ kind: "text", text: "Proceed with the initial scope." }],
      createdAt: "2026-08-24T00:00:00.000Z",
      relatedStage: "F1",
      relatedArtifactIds: ["artifact-1"],
      decisionReference: "decision-1",
    };

    const hostActionRequest = {
      contractVersion: "f8-host-action-request-v1",
      actionId: "action-1",
      sessionId: SESSION_ID,
      expectedRevision: 4,
      kind: "surface_write",
      expiresAt: "2026-08-24T00:10:00.000Z",
      validationActionId: "action-validate-1",
      confirmationHash: WORKBOOK_HASH,
      expectedTargetVersion: "f4-handoff-v1",
    };

    const hostActionClaim = {
      contractVersion: "f8-host-action-claim-v1",
      actionId: "action-1",
      hostInstanceId: "host-1",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-08-24T00:11:00.000Z",
    };

    const hostActionResult = {
      contractVersion: "f8-host-action-result-v1",
      actionId: "action-1",
      hostInstanceId: "host-1",
      leaseId: "lease-1",
      status: "completed",
      resultHash: WORKBOOK_HASH,
      payload: { status: "completed" },
    };

    const failedHostActionResult = {
      contractVersion: "f8-host-action-result-v1",
      actionId: "action-2",
      hostInstanceId: "host-2",
      leaseId: "lease-2",
      status: "failed",
      resultHash: WORKBOOK_HASH,
      payload: {
        status: "failed",
        error: {
          code: "internal_error",
          runId: "00000000-0000-4000-8000-000000000001",
          summary: "Host action failed.",
          retryable: false,
          suggestedAction: "Retry the host action.",
          affectedInputReferences: [],
        },
      },
    };

    const draft = {
      contractVersion: "f8-scenario-draft-v1",
      draftId: "draft-1",
      sessionId: SESSION_ID,
      worksheetName: "AJ_GAP",
      inputRevision: 2,
      status: "draft",
      mode: "WHAT_IF",
      nominalValue: 3.145,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      additionalMeanShift: 0,
    };

    expect(conversationTurnSchema.parse(conversationTurn)).toEqual(conversationTurn);
    expect(hostActionRequestSchema.parse(hostActionRequest)).toEqual(hostActionRequest);
    expect(hostActionClaimSchema.parse(hostActionClaim)).toEqual(hostActionClaim);
    expect(hostActionResultSchema.parse(hostActionResult)).toEqual(hostActionResult);
    expect(hostActionResultSchema.parse(failedHostActionResult)).toEqual(failedHostActionResult);
    expect(f8ScenarioDraftSchema.parse(draft)).toEqual(draft);

    expect(() => conversationTurnSchema.parse({ ...conversationTurn, outputRoot: "C:/arbitrary" })).toThrow();
    expect(() => conversationTurnSchema.parse({
      ...conversationTurn,
      content: [{
        kind: "error",
        error: {
          code: "policy_denied",
          runId: "00000000-0000-4000-8000-000000000001",
          summary: "Denied.",
          retryable: false,
          suggestedAction: "Review the policy.",
          affectedInputReferences: [],
          unexpected: true,
        },
      }],
    })).toThrow();
    expect(() => hostActionRequestSchema.parse({ ...hostActionRequest, outputRoot: "C:/arbitrary" })).toThrow();
    expect(() => hostActionRequestSchema.parse({
      ...hostActionRequest,
      validationActionId: undefined,
    })).toThrow();
    expect(() => hostActionRequestSchema.parse({
      ...hostActionRequest,
      kind: "surface_validate",
      validationActionId: "action-validate-1",
    })).toThrow();
    expect(() => hostActionRequestSchema.parse({
      contractVersion: "f8-host-action-request-v1",
      actionId: "action-model",
      sessionId: SESSION_ID,
      expectedRevision: 4,
      kind: "model_request",
      expiresAt: "2026-08-24T00:10:00.000Z",
      confirmationHash: WORKBOOK_HASH,
    })).toThrow();
    expect(() => hostActionClaimSchema.parse({ ...hostActionClaim, outputRoot: "C:/arbitrary" })).toThrow();
    expect(() => hostActionResultSchema.parse({ ...hostActionResult, outputRoot: "C:/arbitrary" })).toThrow();
    expect(() => hostActionResultSchema.parse({
      ...hostActionResult,
      hostInstanceId: undefined,
    })).toThrow();
    expect(() => hostActionResultSchema.parse({
      ...failedHostActionResult,
      payload: {
        ...failedHostActionResult.payload,
        error: { ...failedHostActionResult.payload.error, nested: "nope" },
      },
    })).toThrow();
    expect(() => hostActionResultSchema.parse({
      ...hostActionResult,
      payload: { status: "completed", unexpected: true },
    })).toThrow();
    expect(() => f8ScenarioDraftSchema.parse({ ...draft, outputRoot: "C:/arbitrary" })).toThrow();
  });
});