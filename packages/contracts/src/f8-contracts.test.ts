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
      kind: "surface_validate",
      expiresAt: "2026-08-24T00:10:00.000Z",
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
      leaseId: "lease-1",
      status: "completed",
      resultHash: WORKBOOK_HASH,
      payload: { status: "completed" },
    };

    const failedHostActionResult = {
      contractVersion: "f8-host-action-result-v1",
      actionId: "action-2",
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
    expect(() => hostActionClaimSchema.parse({ ...hostActionClaim, outputRoot: "C:/arbitrary" })).toThrow();
    expect(() => hostActionResultSchema.parse({ ...hostActionResult, outputRoot: "C:/arbitrary" })).toThrow();
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