import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import {
  confirmDownstreamScopeInternalPayloadSchema,
  f8SessionCommandSchema,
  f8PublicSessionCommandSchema,
  f8SessionSnapshotSchema,
  f8SessionEventSchema,
  conversationTurnSchema,
  hostActionRequestSchema,
  hostActionClaimSchema,
  hostActionResultSchema,
  f8PendingF6InputDraftSchema,
  f6InputProposalSchema,
  f8ScenarioDraftSchema,
  f8AdoProjectionSchema,
  f8AdoWriteConfirmationSchema,
  taModelContextEnvelopeSchema,
  type TaModelContextEnvelope,
} from "./index.js";

const SESSION_ID = "session-8d2a2d73-7f55-4f7d-8fa1-b4f6d2f66d31";
const COMMAND_ID = "command-5a9fba33-2c18-4a74-9d4d-6f8b21efc01d";
const WORKBOOK_HASH = "a".repeat(64);
const ENGLISH_LOCK = {
  languageTag: "en-US",
  uiCatalogLanguage: "en",
  lockedAtTurnId: "turn-start-en",
  source: "workflow_start",
  fallbackUsed: false,
} as const;
const CANONICAL_NAVIGATE_ACTIONS = [
  { type: "navigate", target: "/scope", label: "选择 Worksheets" },
  { type: "navigate", target: "/scope/downstream", label: "确认下游 Worksheets" },
  { type: "navigate", target: "/ado/preview", label: "查看 ADO 预览" },
  { type: "navigate", target: "/images/decision", label: "确认图片上下文" },
  { type: "navigate", target: "/analysis/context", label: "补充/确认分析背景" },
  { type: "navigate", target: "/optimization/targets", label: "补充/确认优化方向" },
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

function validTaModelContextEnvelope(): TaModelContextEnvelope {
  return {
    contractVersion: "ta-model-context-envelope-v1",
    session: {
      sessionId: SESSION_ID,
      revision: 7,
    },
    inputRevision: 5,
    worksheet: {
      worksheetName: "Analysis-A",
      tableId: "table-a",
      sourceRow: 2,
      factorName: "factor-a",
      calculationReference: "calc-1",
    },
    f0Knowledge: [
      {
        inputRevision: 5,
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
        factorName: "factor-a",
        capabilityStatus: "internal_within_guidance",
        f0KnowledgeBaseVersion: "internal-v1",
        summary: "Total band stays within the matched internal guidance entry.",
        recommendation: {
          kind: "internal-guidance",
          assessedTotalBand: 0.12,
          maximumRecommendedTotalBand: 0.2,
          unit: "mm",
          matchedEntryId: "internal-entry-1",
          sourceFileHash: "d".repeat(64),
        },
      },
      {
        inputRevision: 5,
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 3,
        factorName: "factor-b",
        capabilityStatus: "in_library_recommended",
        f0KnowledgeBaseVersion: "v1",
        summary: "Public capability guidance aligns with the observed factor.",
        recommendation: {
          kind: "public",
          capabilityEntryId: "capability-1",
          toleranceMin: -0.08,
          toleranceMax: 0.08,
          unit: "mm",
          distribution: "normal",
        },
      },
    ],
    toleranceLoopImage: {
      artifactId: "artifact-f1-image",
      kind: "f1_image",
      inputRevision: 5,
      worksheetName: "Analysis-A",
      contentHash: "e".repeat(64),
      mediaType: "image/png",
      description: "Tolerance loop crop for the active worksheet.",
    },
    factorTable: [
      {
        inputRevision: 5,
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
        factorName: "factor-a",
        partName: "Panel",
        unit: "mm",
        nominalValue: 3.145,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        distribution: "normal",
        mean: 3.13,
        tolerance: 0.2,
        oneSigma: 0.03,
        contribution: 0.45,
        notes: "Primary gap contributor.",
      },
      {
        inputRevision: 5,
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 3,
        factorName: "factor-b",
        partName: "Bracket",
        unit: "mm",
        nominalValue: 1.2,
        upperTolerance: 0.05,
        lowerTolerance: -0.04,
        distribution: "normal",
        mean: 1.19,
        tolerance: 0.09,
        oneSigma: 0.02,
        contribution: 0.21,
      },
    ],
    baselineMetrics: {
      inputRevision: 5,
      calculationReference: "f4-baseline-1",
      mean: 3.15,
      rssSigma: 0.018,
      cp: 1.7,
      cpkL: 1.6,
      cpkU: 1.8,
      cpk: 1.6,
      statisticalMargin: 0.1,
      worstCaseMargin: 0.05,
      lowerSpecLimit: 3,
      upperSpecLimit: 3.3,
      meanShift: 0,
      yield: 0.99,
      dpm: 1200,
      statisticalLower: 3.096,
      statisticalUpper: 3.204,
      worstCaseLower: 3.05,
      worstCaseUpper: 3.25,
    },
    scenarioMetrics: {
      inputRevision: 5,
      calculationReference: "calc-1",
      mean: 3.11,
      rssSigma: 0.016,
      cp: 1.9,
      cpkL: 1.85,
      cpkU: 1.95,
      cpk: 1.85,
      statisticalMargin: 0.12,
      worstCaseMargin: 0.07,
      lowerSpecLimit: 3,
      upperSpecLimit: 3.3,
      meanShift: -0.04,
      yield: 0.995,
      dpm: 800,
      statisticalLower: 3.062,
      statisticalUpper: 3.158,
      worstCaseLower: 3.03,
      worstCaseUpper: 3.21,
    },
    relatedArtifactIds: ["artifact-f2-current", "artifact-f4-current", "artifact-f1-image"],
  };
}

describe("F8 session and host contracts", () => {
  it("accepts a strict TA model context envelope and keeps optional evidence optional", () => {
    const envelope = validTaModelContextEnvelope();
    expect(taModelContextEnvelopeSchema.parse(envelope)).toEqual(envelope);

    const withoutOptionalEvidence: TaModelContextEnvelope = {
      ...envelope,
      worksheet: { worksheetName: "Analysis-A" },
      f0Knowledge: [],
      factorTable: [],
      toleranceLoopImage: undefined,
      baselineMetrics: undefined,
      scenarioMetrics: undefined,
      relatedArtifactIds: [],
    };

    expect(taModelContextEnvelopeSchema.parse(withoutOptionalEvidence)).toEqual(withoutOptionalEvidence);
  });

  it("rejects partial worksheet factor identity", () => {
    const envelope: TaModelContextEnvelope = {
      ...validTaModelContextEnvelope(),
      worksheet: {
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
      },
    };

    expect(() => taModelContextEnvelopeSchema.parse(envelope)).toThrow(/identity/i);
  });

  it("rejects duplicate factor rows in the same envelope", () => {
    const envelope: TaModelContextEnvelope = {
      ...validTaModelContextEnvelope(),
      factorTable: [
        ...validTaModelContextEnvelope().factorTable,
        { ...validTaModelContextEnvelope().factorTable[0]! },
      ],
    };

    expect(() => taModelContextEnvelopeSchema.parse(envelope)).toThrow(/duplicate/i);
  });

  it("rejects invalid evidence hashes", () => {
    const withBadImageHash: TaModelContextEnvelope = {
      ...validTaModelContextEnvelope(),
      toleranceLoopImage: {
        ...validTaModelContextEnvelope().toleranceLoopImage!,
        contentHash: "not-a-sha256",
      },
    };
    expect(() => taModelContextEnvelopeSchema.parse(withBadImageHash)).toThrow();

    const withBadKnowledgeHash: TaModelContextEnvelope = {
      ...validTaModelContextEnvelope(),
      f0Knowledge: [
        {
          ...validTaModelContextEnvelope().f0Knowledge[0]!,
          recommendation: {
            kind: "internal-guidance",
            assessedTotalBand: 0.12,
            maximumRecommendedTotalBand: 0.2,
            unit: "mm",
            matchedEntryId: "internal-entry-1",
            sourceFileHash: "bad-hash",
          },
        },
      ],
    };
    expect(() => taModelContextEnvelopeSchema.parse(withBadKnowledgeHash)).toThrow();
  });

  it("rejects cross-revision evidence references", () => {
    const envelope: TaModelContextEnvelope = {
      ...validTaModelContextEnvelope(),
      factorTable: [
        {
          ...validTaModelContextEnvelope().factorTable[0]!,
          inputRevision: 4,
        },
      ],
    };

    expect(() => taModelContextEnvelopeSchema.parse(envelope)).toThrow(/revision/i);
  });

  it("rejects text that leaks a local filesystem path", () => {
    const envelope: TaModelContextEnvelope = {
      ...validTaModelContextEnvelope(),
      f0Knowledge: [
        {
          ...validTaModelContextEnvelope().f0Knowledge[0]!,
          summary: "See C:\\Users\\xumax\\private\\evidence.png for the unmanaged source.",
        },
      ],
    };

    expect(() => taModelContextEnvelopeSchema.parse(envelope)).toThrow(/path/i);
  });

  it.each([
    {
      name: "F0 summary",
      build: () => ({
        ...validTaModelContextEnvelope(),
        f0Knowledge: [{
          ...validTaModelContextEnvelope().f0Knowledge[0]!,
          summary: "Observed password=demo-value in the source note.",
        }],
      }),
    },
    {
      name: "F1 image description",
      build: () => ({
        ...validTaModelContextEnvelope(),
        toleranceLoopImage: {
          ...validTaModelContextEnvelope().toleranceLoopImage!,
          description: "api key: demo-key",
        },
      }),
    },
    {
      name: "F2 factor note",
      build: () => ({
        ...validTaModelContextEnvelope(),
        factorTable: [{
          ...validTaModelContextEnvelope().factorTable[0]!,
          notes: "Authorization: Bearer demo-token",
        }],
      }),
    },
  ])("rejects credential-like free-form text in %s", ({ build }) => {
    expect(() => taModelContextEnvelopeSchema.parse(build())).toThrow(/credential/i);
  });

  it("rejects unsupported F1 image media types in the model context envelope", () => {
    const octetStreamEnvelope: TaModelContextEnvelope = {
      ...validTaModelContextEnvelope(),
      toleranceLoopImage: {
        ...validTaModelContextEnvelope().toleranceLoopImage!,
        mediaType: "application/octet-stream",
      },
    };
    expect(() => taModelContextEnvelopeSchema.parse(octetStreamEnvelope)).toThrow(/media type/i);

    const svgEnvelope: TaModelContextEnvelope = {
      ...validTaModelContextEnvelope(),
      toleranceLoopImage: {
        ...validTaModelContextEnvelope().toleranceLoopImage!,
        mediaType: "image/svg+xml",
      },
    };
    expect(() => taModelContextEnvelopeSchema.parse(svgEnvelope)).toThrow(/media type/i);
  });

  it.each([
    {
      name: "ta model worksheet name",
      build: () => ({
        ...validTaModelContextEnvelope(),
        worksheet: {
          ...validTaModelContextEnvelope().worksheet,
          worksheetName: "C:\\Users\\xumax\\sheet.xlsx",
        },
      }),
    },
    {
      name: "ta model table id",
      build: () => ({
        ...validTaModelContextEnvelope(),
        worksheet: {
          ...validTaModelContextEnvelope().worksheet,
          tableId: "C:\\Users\\xumax\\table-id",
        },
      }),
    },
    {
      name: "ta model factor name",
      build: () => ({
        ...validTaModelContextEnvelope(),
        worksheet: {
          ...validTaModelContextEnvelope().worksheet,
          factorName: "C:\\Users\\xumax\\factor-name",
        },
      }),
    },
    {
      name: "ta model calculation reference",
      build: () => ({
        ...validTaModelContextEnvelope(),
        worksheet: {
          ...validTaModelContextEnvelope().worksheet,
          calculationReference: "file:///C:/Users/xumax/calc-ref",
        },
      }),
    },
    {
      name: "ta model artifact id",
      build: () => ({
        ...validTaModelContextEnvelope(),
        toleranceLoopImage: {
          ...validTaModelContextEnvelope().toleranceLoopImage!,
          artifactId: "\\\\server\\share\\artifact-id",
        },
      }),
    },
    {
      name: "ta model related artifact id",
      build: () => ({
        ...validTaModelContextEnvelope(),
        relatedArtifactIds: ["artifact-f2-current", "C:/Users/xumax/related-artifact"],
      }),
    },
    {
      name: "ta model knowledge identity",
      build: () => ({
        ...validTaModelContextEnvelope(),
        f0Knowledge: [
          {
            ...validTaModelContextEnvelope().f0Knowledge[0]!,
            recommendation: {
              kind: "internal-guidance",
              assessedTotalBand: 0.12,
              maximumRecommendedTotalBand: 0.2,
              unit: "mm",
              matchedEntryId: "C:/Users/xumax/internal-entry",
              sourceFileHash: "d".repeat(64),
            },
          },
        ],
      }),
    },
    {
      name: "scenario draft identity",
      build: () => ({
        ...f8ScenarioDraftSchema.parse({
          contractVersion: "f8-scenario-draft-v1",
          draftId: "draft-1",
          sessionId: SESSION_ID,
          worksheetName: "AJ_GAP",
          inputRevision: 2,
          status: "draft",
          mode: "WHAT_IF",
          nominalValue: 3.145,
        }),
        sessionId: "C:/Users/xumax/session-id",
      }),
    },
    {
      name: "conversation turn artifact label",
      build: () => ({
        contractVersion: "ta-conversation-turn-v1",
        turnId: "turn-1",
        sessionId: SESSION_ID,
        sequence: 7,
        source: "web",
        role: "assistant",
        content: [{ kind: "artifact_reference", artifactId: "artifact:ref:alpha", label: "C:/Users/xumax/label" }],
        createdAt: "2026-08-24T00:00:00.000Z",
        relatedArtifactIds: ["artifact:ref:alpha"],
      }),
    },
  ])("rejects embedded local paths in %s", ({ build }) => {
    expect(() => {
      const value = build();
      if ("contractVersion" in value && value.contractVersion === "ta-conversation-turn-v1") {
        conversationTurnSchema.parse(value);
        return;
      }
      if ("contractVersion" in value && value.contractVersion === "f8-scenario-draft-v1") {
        f8ScenarioDraftSchema.parse(value);
        return;
      }
      taModelContextEnvelopeSchema.parse(value as TaModelContextEnvelope);
    }).toThrow(/path/i);
  });

  it.each([
    {
      name: "ta model worksheet name",
      build: () => ({
        ...(() => {
          const envelope = validTaModelContextEnvelope();
          const worksheetName = "f2-report:1:id";
          return {
            ...envelope,
            worksheet: {
              ...envelope.worksheet,
              worksheetName,
            },
            f0Knowledge: envelope.f0Knowledge.map((item) => ({
              ...item,
              worksheetName,
            })),
            toleranceLoopImage: envelope.toleranceLoopImage === undefined ? undefined : {
              ...envelope.toleranceLoopImage,
              worksheetName,
            },
            factorTable: envelope.factorTable.map((row) => ({
              ...row,
              worksheetName,
            })),
          };
        })(),
      }),
    },
    {
      name: "conversation artifact label",
      build: () => ({
        contractVersion: "ta-conversation-turn-v1",
        turnId: "turn:1:id",
        sessionId: SESSION_ID,
        sequence: 7,
        source: "web",
        role: "assistant",
        content: [{ kind: "artifact_reference", artifactId: "artifact:ref:alpha", label: "knowledge:label:2026" }],
        createdAt: "2026-08-24T00:00:00.000Z",
        relatedArtifactIds: ["artifact:ref:alpha", "knowledge:label:2026"],
      }),
    },
  ])("accepts opaque IDs with colons in %s", ({ build }) => {
    const value = build();
    if ("contractVersion" in value && value.contractVersion === "ta-conversation-turn-v1") {
      expect(conversationTurnSchema.parse(value)).toEqual(value);
      return;
    }
    expect(taModelContextEnvelopeSchema.parse(value as TaModelContextEnvelope)).toEqual(value);
  });

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

  it("accepts an explicit interaction language change command with revision and turn binding", () => {
    const command = {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "set-language-1",
      expectedRevision: 3,
      command: "set_interaction_language",
      payload: {
        turnId: "turn-language-2",
        explicitLanguageTag: "zh-CN",
      },
    } as const;

    expect(f8SessionCommandSchema.parse(command)).toEqual(command);
    expect(f8PublicSessionCommandSchema.parse(command)).toEqual(command);
    expect(() => f8SessionCommandSchema.parse({
      ...command,
      payload: {
        explicitLanguageTag: "zh-CN",
      },
    })).toThrow();
  });

  it("accepts pending F6 context draft snapshots and rejects client-governed fields", () => {
    const pendingAnalysisContextDraft = {
      draftId: "f6-context-draft-1",
      kind: "analysis_context",
      inputRevision: 7,
      reviewContextId: "a".repeat(64),
      artifactId: "f6-context-draft:7",
      contentHash: "b".repeat(64),
      status: "preview_required",
    } as const;

    expect(f8PendingF6InputDraftSchema.parse(pendingAnalysisContextDraft)).toEqual(pendingAnalysisContextDraft);
    expect(f8PendingF6InputDraftSchema.safeParse({
      ...pendingAnalysisContextDraft,
      artifactPath: "artifacts/f6/context.md",
    }).success).toBe(false);
    expect(f8PendingF6InputDraftSchema.safeParse({
      ...pendingAnalysisContextDraft,
      decisionReference: "decision-1",
    }).success).toBe(false);
  });

  it("requires dedicated context/targets confirm payload with matching draft identity", () => {
    const confirmContext = {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "confirm-context-draft",
      expectedRevision: 9,
      command: "confirm_analysis_context",
      payload: {
        decision: "confirm",
        draftId: "f6-context-draft-1",
        draftHash: "c".repeat(64),
      },
    } as const;

    expect(f8PublicSessionCommandSchema.parse(confirmContext)).toEqual(confirmContext);
    expect(f8PublicSessionCommandSchema.parse({
      ...confirmContext,
      payload: { decision: "not_provided" },
    })).toEqual({
      ...confirmContext,
      payload: { decision: "not_provided" },
    });
    expect(f8PublicSessionCommandSchema.parse({
      ...confirmContext,
      payload: { decision: "decline" },
    })).toEqual({
      ...confirmContext,
      payload: { decision: "decline" },
    });
    expect(() => f8PublicSessionCommandSchema.parse({
      ...confirmContext,
      payload: {
        ...confirmContext.payload,
        artifactPath: "artifacts/f6/context.md",
      },
    })).toThrow();
    expect(() => f8PublicSessionCommandSchema.parse({
      ...confirmContext,
      payload: {
        ...confirmContext.payload,
        decisionReference: "decision-1",
      },
    })).toThrow();

    const confirmTargets = {
      ...confirmContext,
      commandId: "confirm-targets-draft",
      command: "confirm_optimization_targets",
      payload: {
        decision: "confirm",
        draftId: "f6-targets-draft-1",
        draftHash: "d".repeat(64),
      },
    } as const;
    expect(f8PublicSessionCommandSchema.parse(confirmTargets)).toEqual(confirmTargets);
  });

  it("allows model outcomes to carry proposals but never session commands", () => {
    const proposal = {
      proposalVersion: "f6-analysis-context-proposal-v1",
      userText: "请确认 analysis context。",
      worksheetSelectors: ["gap w rubber_TPoverload500g"],
      analysisObjectKind: "GAP",
      clarifications: [],
    } as const;
    expect(f6InputProposalSchema.parse(proposal)).toEqual(proposal);

    const result = {
      contractVersion: "f8-host-action-result-v1",
      actionId: "action-model-1",
      hostInstanceId: "host-1",
      leaseId: "lease-1",
      status: "completed",
      resultHash: "e".repeat(64),
      payload: {
        status: "completed",
        outcome: {
          kind: "model_response",
          turnId: "turn-model-1",
          responseText: "已生成 proposal。",
          proposal,
        },
      },
    } as const;

    expect(hostActionResultSchema.parse(result)).toEqual(result);
    expect(() => hostActionResultSchema.parse({
      ...result,
      payload: {
        ...result.payload,
        outcome: {
          ...result.payload.outcome,
          command: {
            contractVersion: "f8-session-command-v1",
            sessionId: SESSION_ID,
            commandId: "bad-inline-command",
            expectedRevision: 9,
            command: "confirm_analysis_context",
            payload: {
              decision: "confirm",
              draftId: "f6-context-draft-1",
              draftHash: "f".repeat(64),
            },
          },
        },
      },
    })).toThrow();
  });

  it("requires an explicit existing Work Item reference and keeps Surface write acceptance internal", () => {
    const existing = { contractVersion: "f8-session-command-v1", sessionId: SESSION_ID, commandId: COMMAND_ID, expectedRevision: 3, command: "confirm_ado_decision", payload: { decision: "use_existing", workItemReference: "WI-123" } };
    expect(f8SessionCommandSchema.parse(existing)).toEqual(existing);
    expect(() => f8SessionCommandSchema.parse({ ...existing, payload: { decision: "use_existing" } })).toThrow();
    const internal = { contractVersion: "f8-session-command-v1", sessionId: SESSION_ID, commandId: "host-result", expectedRevision: 4, command: "accept_surface_write", payload: { actionId: "ado-write-1" } };
    expect(f8SessionCommandSchema.parse(internal).command).toBe("accept_surface_write");
    expect(() => f8PublicSessionCommandSchema.parse(internal)).toThrow();
  });

  it("keeps automatic initial scope confirmation internal", () => {
    const internal = { contractVersion: "f8-session-command-v1", sessionId: SESSION_ID, commandId: "auto-scope", expectedRevision: 4, command: "auto_confirm_initial_scope", payload: { worksheetNames: ["AJ_GAP"], workbookHash: WORKBOOK_HASH } };
    expect(f8SessionCommandSchema.parse(internal).command).toBe("auto_confirm_initial_scope");
    expect(() => f8PublicSessionCommandSchema.parse(internal)).toThrow();
  });

  it("accepts internal worksheet decision provenance and blocks public injection", () => {
    const internal = {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "internal-downstream",
      expectedRevision: 4,
      command: "confirm_downstream_scope",
      payload: {
        decision: "continue_ready",
        worksheetNames: ["AJ_GAP"],
        workbookHash: WORKBOOK_HASH,
        inputRevision: 2,
        f2ReportArtifactId: "f2-report-2",
        f2ReportContentHash: "b".repeat(64),
        findingDigest: "c".repeat(64),
        provenance: "internal_fixture",
      },
    } as const;

    expect(f8SessionCommandSchema.parse(internal)).toEqual(internal);
    expect(() => f8PublicSessionCommandSchema.parse(internal)).toThrow();
    expect(() => f8SessionCommandSchema.parse({
      ...internal,
      payload: { ...internal.payload, provenance: "external" },
    })).toThrow();
  });

  it("rejects a downstream internal decision without revision-bound evidence", () => {
    expect(() => confirmDownstreamScopeInternalPayloadSchema.parse({
      decision: "continue_ready",
    })).toThrow();
  });

  it("keeps the session snapshot and event surfaces strict", () => {
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: SESSION_ID,
      revision: 4,
      inputRevision: 2,
      state: "review_required",
      activeAttempt: null,
      interactionLanguage: ENGLISH_LOCK,
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

  it("accepts legacy_unverified only on stored snapshot selections", () => {
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: SESSION_ID,
      revision: 4,
      inputRevision: 2,
      state: "downstream_scope_required",
      activeAttempt: null,
      interactionLanguage: ENGLISH_LOCK,
      priorRunReferences: [],
      initialScopeSelection: {
        workbookContentHash: WORKBOOK_HASH,
        selectedWorksheetNames: ["AJ_GAP"],
        confirmed: true,
        provenance: "legacy_unverified",
      },
      downstreamScopeSelection: {
        workbookContentHash: WORKBOOK_HASH,
        selectedWorksheetNames: ["AJ_GAP"],
        confirmed: true,
        provenance: "legacy_unverified",
      },
    } as const;

    expect(f8SessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);

    const command = {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "invalid-legacy-provenance",
      expectedRevision: 4,
      command: "confirm_downstream_scope",
      payload: {
        worksheetNames: ["AJ_GAP"],
        workbookHash: WORKBOOK_HASH,
        provenance: "legacy_unverified",
      },
    };

    expect(() => f8SessionCommandSchema.parse(command)).toThrow();
    expect(() => f8PublicSessionCommandSchema.parse(command)).toThrow();
  });

  it("persists revision-bound evidence on governed downstream selections", () => {
    const snapshot = f8SessionSnapshotSchema.parse({
      contractVersion: "f8-session-snapshot-v1",
      sessionId: SESSION_ID,
      revision: 5,
      inputRevision: 2,
      state: "f3_running",
      activeAttempt: null,
      interactionLanguage: ENGLISH_LOCK,
      priorRunReferences: [],
      downstreamScopeSelection: {
        workbookContentHash: WORKBOOK_HASH,
        selectedWorksheetNames: ["AJ_GAP"],
        confirmed: true,
        provenance: "user",
        decision: "continue_ready",
        inputRevision: 2,
        f2ReportArtifactId: "f2-report-2",
        f2ReportContentHash: "b".repeat(64),
        findingDigest: "c".repeat(64),
      },
    });

    expect(snapshot.downstreamScopeSelection).toMatchObject({
      decision: "continue_ready",
      inputRevision: 2,
      f2ReportArtifactId: "f2-report-2",
      f2ReportContentHash: "b".repeat(64),
      findingDigest: "c".repeat(64),
    });
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
      interactionLanguage: ENGLISH_LOCK,
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
      interactionLanguage: ENGLISH_LOCK,
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

  it("accepts non-review F6 artifacts as distinct kinds without expanding review kinds", () => {
    const snapshot = {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: SESSION_ID,
      revision: 6,
      inputRevision: 2,
      state: "review_required",
      activeAttempt: null,
      interactionLanguage: ENGLISH_LOCK,
      priorRunReferences: [],
      artifactRefs: [
        {
          artifactId: "artifact-f6-markdown-1",
          kind: "f6_optimization_markdown",
          revision: 6,
          validated: true,
        },
        {
          artifactId: "artifact-f6-summary-1",
          kind: "f6_run_summary",
          revision: 6,
          validated: true,
        },
        {
          artifactId: "artifact-f6-manifest-1",
          kind: "f6_manifest",
          revision: 6,
          validated: true,
        },
      ],
    } as const;

    expect(f8SessionSnapshotSchema.parse(snapshot).artifactRefs).toEqual(snapshot.artifactRefs);
    expect(() => f8SessionSnapshotSchema.parse({
      ...snapshot,
      artifactRefs: [
        {
          artifactId: "artifact-f6-markdown-1",
          kind: "f6_optimization_markdown",
          revision: 6,
          validated: true,
          reviewContextId: "a".repeat(64),
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

  it("requires ADO preview identity on projection and final confirmation", () => {
    const target = { mode: "existing", workItemReference: "https://dev.azure.com/org/project/_workitems/edit/42" } as const;
    const markdown = "## F3 DIM ID / Drawing Governance Reminder\n\n| Field | Value |\n| --- | --- |\n| Factor count | 1 |\n";
    const contentHash = createHash("sha256").update(markdown).digest("hex");
    const projection = {
      contractVersion: "f8-ado-projection-v1",
      sessionId: SESSION_ID,
      state: "preview_ready",
      actionId: "ado-validation:session:3",
      expectedRevision: 3,
      target,
      markdown,
      contentHash,
      confirmation: {
        status: "confirmation_required",
        workItemReference: "WI-42",
        ownerReference: "owner-1",
        commentReference: "C0",
        expectedVersion: "7",
        beforeContentHash: "b".repeat(64),
        nextContent: markdown,
        factorCount: 1,
        confirmationHash: "c".repeat(64),
        diff: [{ before: "old", after: markdown, changed: true }],
      },
    };

    expect(f8AdoProjectionSchema.parse(projection)).toEqual(projection);
    expect(f8AdoWriteConfirmationSchema.parse({
      contractVersion: "f8-ado-write-confirmation-v1",
      validationActionId: projection.actionId,
      expectedRevision: projection.expectedRevision,
      target,
      contentHash,
      confirmationHash: projection.confirmation.confirmationHash,
      confirmed: true,
    })).toMatchObject({ target, contentHash });
    expect(() => f8AdoProjectionSchema.parse({ ...projection, contentHash: "not-a-hash" })).toThrow();
    expect(() => f8AdoWriteConfirmationSchema.parse({
      contractVersion: "f8-ado-write-confirmation-v1",
      validationActionId: projection.actionId,
      expectedRevision: projection.expectedRevision,
      confirmationHash: projection.confirmation.confirmationHash,
      confirmed: true,
    })).toThrow();

    const pending = {
      contractVersion: "f8-ado-projection-v1" as const,
      sessionId: "session-1",
      state: "validation_pending" as const,
      actionId: "ado-validation:session-1:3",
      expectedRevision: 3,
      startedAt: "2026-08-31T10:00:00.000Z",
      expiresAt: "2026-08-31T10:15:00.000Z",
    };
    expect(f8AdoProjectionSchema.parse(pending)).toEqual(pending);

    const writeOutcomeUnknown = {
      contractVersion: "f8-ado-projection-v1" as const,
      sessionId: SESSION_ID,
      state: "write_outcome_unknown" as const,
      actionId: "ado-write:session:3",
      validationActionId: "ado-validation:session:3",
      expectedRevision: 3,
      executionPhase: "readback" as const,
      previewIdentity: {
        targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
        previewHash: contentHash,
        previewMarker: "preview-marker:ado:session:3",
      },
      writeDispatchedAt: "2026-09-01T00:00:00.000Z",
      confirmation: projection.confirmation,
    };
    expect(f8AdoProjectionSchema.parse(writeOutcomeUnknown)).toEqual(writeOutcomeUnknown);
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
      confirmation: {
        status: "confirmation_required",
        workItemReference: "WI-1",
        ownerReference: "owner-1",
        commentReference: "C0",
        expectedVersion: "1",
        beforeContentHash: "b".repeat(64),
        nextContent: "next content",
        factorCount: 1,
        confirmationHash: WORKBOOK_HASH,
        diff: [{ before: "before", after: "next content", changed: true }],
      },
    };

    const reconcileRequest = {
      contractVersion: "f8-host-action-request-v1",
      actionId: "action-reconcile-1",
      sessionId: SESSION_ID,
      expectedRevision: 4,
      kind: "surface_reconcile",
      expiresAt: "2026-08-24T00:10:00.000Z",
      writeActionId: "action-1",
      validationActionId: "action-validate-1",
      confirmationHash: WORKBOOK_HASH,
      expectedTargetVersion: "f4-handoff-v1",
      previewIdentity: {
        targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
        previewHash: WORKBOOK_HASH,
        previewMarker: "preview-marker:ado:session:3",
      },
      confirmation: hostActionRequest.confirmation,
    };

    const hostActionClaim = {
      contractVersion: "f8-host-action-claim-v1",
      actionId: "action-1",
      hostInstanceId: "host-1",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-08-24T00:11:00.000Z",
      request: hostActionRequest,
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

    const reconcileResult = {
      contractVersion: "f8-host-action-result-v1",
      actionId: "action-reconcile-1",
      hostInstanceId: "host-1",
      leaseId: "lease-1",
      status: "completed",
      resultHash: WORKBOOK_HASH,
      payload: {
        status: "completed",
        outcome: {
          kind: "surface_reconcile",
          state: "matching",
          receipt: {
            status: "updated",
            workItemReference: "https://dev.azure.com/MSFTDEVICES/Project%20A/_workitems/edit/42",
            commentReference: "11",
            version: "2",
            contentHash: WORKBOOK_HASH,
          },
          observedCommentReference: "11",
          observedCommentVersion: "2",
        },
      },
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
    const promotionPreviewV2 = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v2" as const,
      workbookContentHash: WORKBOOK_HASH,
      worksheets: [
        {
          worksheetName: "AJ_GAP",
          tableId: "table-a",
          baselineIdentity: {
            calculationVersion: "excel-ta-v1" as const,
            projectReference: "project-a",
            runReference: "run-a",
            workbookContentHash: WORKBOOK_HASH,
            worksheetName: "AJ_GAP",
            tableId: "table-a",
          },
          targets: [
            {
              targetId: "factor-nominal-1",
              targetType: "factor_nominal" as const,
              factor: {
                worksheetName: "AJ_GAP",
                tableId: "table-a",
                sourceRow: 12,
                factorName: "Gap contributor A",
                unit: "mm",
              },
              nominalValue: 1.25,
              unit: "mm",
            },
            {
              targetId: "system-mean-1",
              targetType: "system_mean_shift" as const,
              systemIdentity: {
                baselineIdentity: {
                  calculationVersion: "excel-ta-v1" as const,
                  projectReference: "project-a",
                  runReference: "run-a",
                  workbookContentHash: WORKBOOK_HASH,
                  worksheetName: "AJ_GAP",
                  tableId: "table-a",
                },
                designNominal: 0,
                mean: 0,
                rssSigma: 0.04,
                lowerSpecLimit: -0.1,
                upperSpecLimit: 0.2,
                targetCpk: 1,
                traceReferences: [],
              },
              target: {
                targetMean: 0.02,
                unit: "mm",
              },
            },
            {
              targetId: "system-spec-1",
              targetType: "system_specification" as const,
              systemIdentity: {
                baselineIdentity: {
                  calculationVersion: "excel-ta-v1" as const,
                  projectReference: "project-a",
                  runReference: "run-a",
                  workbookContentHash: WORKBOOK_HASH,
                  worksheetName: "AJ_GAP",
                  tableId: "table-a",
                },
                designNominal: 0,
                mean: 0,
                rssSigma: 0.04,
                lowerSpecLimit: -0.1,
                upperSpecLimit: 0.2,
                targetCpk: 1,
                traceReferences: [],
              },
              lowerSpecLimit: -0.1,
              upperSpecLimit: 0.2,
              unit: "mm",
            },
          ],
        },
      ],
    };
    const draftWithPromotionPreviewV2 = {
      ...draft,
      promotionPreview: promotionPreviewV2,
    };

    expect(conversationTurnSchema.parse(conversationTurn)).toEqual(conversationTurn);
    expect(hostActionRequestSchema.parse(hostActionRequest)).toEqual(hostActionRequest);
    expect(hostActionRequestSchema.parse(reconcileRequest)).toEqual(reconcileRequest);
    expect(hostActionClaimSchema.parse(hostActionClaim)).toEqual(hostActionClaim);
    expect(hostActionResultSchema.parse(hostActionResult)).toEqual(hostActionResult);
    expect(hostActionResultSchema.parse(reconcileResult)).toEqual(reconcileResult);
    expect(hostActionResultSchema.parse(failedHostActionResult)).toEqual(failedHostActionResult);
    expect(f8ScenarioDraftSchema.parse(draft)).toEqual(draft);
    expect(f8ScenarioDraftSchema.parse(draftWithPromotionPreviewV2)).toEqual(draftWithPromotionPreviewV2);

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