import { createHash } from "node:crypto";

import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { conversationTurnSchema, taModelContextEnvelopeSchema, type TaModelContextEnvelope } from "@ai-assist/contracts";

import { adoRoutes } from "./ado.js";
import { conversationRoutes } from "./conversation.js";
import { hostActionsRoutes } from "./host-actions.js";
import { buildEvidenceLabeledModelPrompt } from "../model-prompt.js";
import type { WorkbenchServerContext } from "../server.js";

const SESSION_ID = "68686868-6868-4868-8868-686868686868";
const REVIEW_CONTEXT_ID = "c".repeat(64);

describe("conversation routes", () => {
  it("rejects client-composed prompt context payloads", async () => {
    const app = await routeHarness();
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/conversation`,
        payload: { turn: turn(), context: { worksheetName: "Analysis-A", relatedArtifactIds: ["stale-f4"] } },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "conversation_schema_rejected" });
    } finally {
      await app.close();
    }
  });

  it("rejects crafted client turn related artifact ids that contain local paths", async () => {
    const app = await routeHarness();
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/conversation`,
        payload: { turn: { ...turn(), relatedArtifactIds: ["C:\\sensitive\\f4.json"] }, selection: { worksheetName: "Analysis-A" } },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "conversation_schema_rejected" });
    } finally {
      await app.close();
    }
  });

  it("creates the model host action with the server-built context envelope", async () => {
    const modelContext = richContext();
    const app = await routeHarness(modelContext);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/conversation`,
        payload: { turn: turn(), selection: { worksheetName: "Analysis-A" } },
      });

      expect(response.statusCode).toBe(201);
      expect(app.capturedPrompt()).toBe(buildEvidenceLabeledModelPrompt("Explain the current risk.", modelContext));
      expect(app.capturedPrompt()).toContain("Governed evidence");
      expect(app.capturedPrompt()).toContain("Open interpretation");
      expect(app.capturedPrompt()).toContain("Missing evidence");
      expect(app.capturedPrompt()).toContain("Suggested checks");
      expect(response.json()).toMatchObject({ role: "assistant", relatedArtifactIds: ["f2-current", "f4-current", "f1-current-image"] });
    } finally {
      await app.close();
    }
  });

  it("uses server-built related artifact ids instead of client-supplied turn ids", async () => {
    const modelContext = richContext();
    const app = await routeHarness(modelContext);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/conversation`,
        payload: { turn: { ...turn(), relatedArtifactIds: ["stale-f4"] }, selection: { worksheetName: "Analysis-A" } },
      });

      expect(response.statusCode).toBe(201);
      expect(app.capturedPrompt()).toBe(buildEvidenceLabeledModelPrompt("Explain the current risk.", modelContext));
      expect(response.json()).toMatchObject({ role: "assistant", relatedArtifactIds: ["f2-current", "f4-current", "f1-current-image"] });
      expect(app.turns()).toMatchObject([
        { turnId: "turn-route-1", role: "user", relatedArtifactIds: ["f2-current", "f4-current", "f1-current-image"] },
        { turnId: "turn-route-1:assistant", role: "assistant", relatedArtifactIds: ["f2-current", "f4-current", "f1-current-image"] },
      ]);
      expect(app.createdActions()).toMatchObject([
        { actionId: "model:turn-route-1", turnId: "turn-route-1" },
      ]);
    } finally {
      await app.close();
    }
  });

  it("assigns persisted next sequences when the web turn has a stale local sequence", async () => {
    const modelContext = richContext();
    const app = await routeHarness(modelContext, {
      turns: [externalTurn(1)],
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/conversation`,
        payload: { turn: { ...turn(), sequence: 0 }, selection: { worksheetName: "Analysis-A" } },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ turnId: "turn-route-1:assistant", sequence: 3, role: "assistant" });
      expect(app.turns().map(({ turnId, sequence, source }) => ({ turnId, sequence, source }))).toEqual([
        { turnId: "external-1", sequence: 1, source: "vscode" },
        { turnId: "turn-route-1", sequence: 2, source: "web" },
        { turnId: "turn-route-1:assistant", sequence: 3, source: "system" },
      ]);
    } finally {
      await app.close();
    }
  });

  it("keeps duplicate turn id conflicts controlled after server sequence assignment", async () => {
    const modelContext = richContext();
    const app = await routeHarness(modelContext, {
      turns: [{ ...turn(), sequence: 1, relatedArtifactIds: modelContext.relatedArtifactIds }],
    });
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/conversation`,
        payload: { turn: { ...turn(), sequence: 0 }, selection: { worksheetName: "Analysis-A" } },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: "conversation_turn_conflict" });
      expect(app.turns()).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("surfaces the pending model request from /ado/pending using the persisted user turn id", async () => {
    const modelContext = taModelContextEnvelopeSchema.parse({
      contractVersion: "ta-model-context-envelope-v1",
      session: { sessionId: SESSION_ID, revision: 5 },
      inputRevision: 2,
      worksheet: { worksheetName: "Analysis-A" },
      f0Knowledge: [],
      factorTable: [],
      relatedArtifactIds: ["f2-current", "f4-current"],
    });
    const app = await routeHarness(modelContext);
    try {
      const createResponse = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/conversation`,
        payload: { turn: turn(), selection: { worksheetName: "Analysis-A" } },
      });

      expect(createResponse.statusCode).toBe(201);

      const pendingResponse = await app.inject({
        method: "GET",
        url: `/api/sessions/${SESSION_ID}/ado/pending`,
        headers: { authorization: "Bearer host-read" },
      });

      expect(pendingResponse.statusCode).toBe(200);
      expect(pendingResponse.json()).toEqual({ actionId: "model:turn-route-1", kind: "vscode_model_request" });

      const claimResponse = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/model:turn-route-1/claim`,
        headers: { authorization: "Bearer host-claim" },
        payload: { hostInstanceId: "host-a" },
      });

      expect(claimResponse.statusCode).toBe(200);
      expect(claimResponse.json()).toMatchObject({
        actionId: "model:turn-route-1",
        request: { kind: "vscode_model_request", turnId: "turn-route-1" },
      });

      const modelPayload = {
        status: "completed" as const,
        outcome: { kind: "model_response" as const, turnId: "turn-route-1", responseText: "Review the F6 recommendation." },
      };
      const resultResponse = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/model:turn-route-1/result`,
        headers: { authorization: "Bearer host-result" },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "model:turn-route-1",
          hostInstanceId: "host-a",
          leaseId: claimResponse.json<{ leaseId: string }>().leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(modelPayload)).digest("hex"),
          payload: modelPayload,
        },
      });

      expect(resultResponse.statusCode).toBe(204);
      expect(app.turns()).toMatchObject([
        { turnId: "turn-route-1", role: "user", relatedArtifactIds: ["f2-current", "f4-current"] },
        { turnId: "turn-route-1:assistant", role: "assistant", relatedArtifactIds: ["f2-current", "f4-current"] },
        { turnId: "turn-route-1:model", role: "assistant", content: [{ kind: "text", text: "Review the Design Optimization recommendation." }] },
      ]);
    } finally {
      await app.close();
    }
  });

  it("persists canonical current report reference/action on host-action model result writes", async () => {
    const modelContext = taModelContextEnvelopeSchema.parse({
      contractVersion: "ta-model-context-envelope-v1",
      session: { sessionId: SESSION_ID, revision: 5 },
      inputRevision: 2,
      worksheet: { worksheetName: "Analysis-A" },
      f0Knowledge: [],
      factorTable: [],
      relatedArtifactIds: ["f2-current", "f4-current"],
    });
    const app = await routeHarness(modelContext, { snapshot: reviewReadySnapshot() });
    try {
      const createResponse = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/conversation`,
        payload: { turn: turn(), selection: { worksheetName: "Analysis-A" } },
      });
      expect(createResponse.statusCode).toBe(201);

      const claimResponse = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/model:turn-route-1/claim`,
        headers: { authorization: "Bearer host-claim" },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);

      const modelPayload = {
        status: "completed" as const,
        outcome: { kind: "model_response" as const, turnId: "turn-route-1", responseText: "Review complete." },
      };
      const resultResponse = await app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/model:turn-route-1/result`,
        headers: { authorization: "Bearer host-result" },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "model:turn-route-1",
          hostInstanceId: "host-a",
          leaseId: claimResponse.json<{ leaseId: string }>().leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(modelPayload)).digest("hex"),
          payload: modelPayload,
        },
      });

      expect(resultResponse.statusCode).toBe(204);
      const modelTurn = app.turns().find((entry) => entry.turnId === "turn-route-1:model");
      expect(modelTurn).toBeDefined();
      expect(modelTurn).toMatchObject({
        role: "assistant",
        relatedArtifactIds: ["f6-report:7"],
      });
      expect(modelTurn?.content).toContainEqual({
        kind: "artifact_reference",
        artifactId: "f6-report:7",
        label: "Feature6-Report.md",
      });
      expect(modelTurn?.content).toContainEqual({
        kind: "tool_result",
        actions: [{ type: "open_report", target: "/report/current", label: "打开当前报告" }],
        commands: [],
      });
    } finally {
      await app.close();
    }
  });
});

async function routeHarness(
  modelContext: TaModelContextEnvelope = minimalContext(),
  options: { readonly turns?: readonly unknown[]; readonly snapshot?: Record<string, unknown> } = {},
) {
  let prompt = "";
  const turns: unknown[] = [...(options.turns ?? [])];
  const actions = new Map<string, {
    readonly actionId: string;
    readonly sessionId: string;
    status: "pending" | "completed";
    readonly turnId?: string;
    readonly kind?: string;
    readonly prompt?: string;
    readonly request: unknown;
    leaseId?: string;
    result?: unknown;
  }>();
  const createdActions: Array<{ readonly actionId: string; readonly turnId?: string; readonly prompt?: string }> = [];
  const buildConversationContext = vi.fn(async () => modelContext);
  const sessionSnapshot = options.snapshot ?? { sessionId: SESSION_ID, revision: 5, state: "review_required" };
  const app = Fastify({ logger: false }) as ReturnType<typeof Fastify> & {
    capturedPrompt(): string;
    turns(): unknown[];
    createdActions(): Array<{ readonly actionId: string; readonly turnId?: string; readonly prompt?: string }>;
  };
  app.decorate("capturedPrompt", () => prompt);
  app.decorate("turns", () => turns.map((value) => conversationTurnSchema.parse(value)));
  app.decorate("createdActions", () => createdActions);
  const authenticateHost = (request: { headers: Record<string, string | undefined> }) => {
    switch (request.headers.authorization) {
      case "Bearer host-read":
        return { kind: "host", sessionId: SESSION_ID, scopes: ["sessions:read"] } as const;
      case "Bearer host-claim":
        return { kind: "host", sessionId: SESSION_ID, scopes: ["host-actions:claim"], actionId: "model:turn-route-1", hostInstanceId: "host-a" } as const;
      case "Bearer host-result":
        return { kind: "host", sessionId: SESSION_ID, scopes: ["host-actions:result"], actionId: "model:turn-route-1", hostInstanceId: "host-a" } as const;
      default:
        return undefined;
    }
  };
  const readConversation = async () => turns.map((value) => conversationTurnSchema.parse(value));
  await app.register(conversationRoutes, { context: {
    requireBrowserSession: () => ({ kind: "browser", sessionId: SESSION_ID }),
    requireBrowserMutation: () => ({ kind: "browser", sessionId: SESSION_ID }),
    requireAuthenticated: authenticateHost,
    sessions: { read: async () => sessionSnapshot },
    conversation: {
      append: async (value: unknown) => {
        const parsed = conversationTurnSchema.parse(value);
        const maxSequence = Math.max(0, ...turns.map((candidate) => conversationTurnSchema.parse(candidate).sequence));
        if (parsed.sequence <= maxSequence) throw new Error(`sequence ${parsed.sequence} is not greater than ${maxSequence}`);
        if (turns.some((candidate) => conversationTurnSchema.parse(candidate).turnId === parsed.turnId)) throw new Error(`turn ${parsed.turnId} already exists`);
        turns.push(parsed);
        return parsed;
      },
      read: readConversation,
    },
    hostActions: {
      create: async (request: { readonly actionId: string; readonly sessionId: string; readonly prompt?: string; readonly turnId?: string; readonly kind?: string }) => {
        prompt = request.prompt ?? "";
        createdActions.push({ actionId: request.actionId, turnId: request.turnId, prompt: request.prompt });
        actions.set(request.actionId, { actionId: request.actionId, sessionId: request.sessionId, status: "pending", turnId: request.turnId, kind: request.kind, prompt: request.prompt, request });
        return request;
      },
      readRecord: async (sessionId: string, actionId: string) => {
        const action = actions.get(actionId);
        return action?.sessionId === sessionId ? action : undefined;
      },
    },
    buildConversationContext,
    syncSessionRecord: async () => undefined,
  } as unknown as WorkbenchServerContext });
  await app.register(adoRoutes, { context: {
    requireBrowserSession: () => ({ kind: "browser", sessionId: SESSION_ID }),
    requireBrowserMutation: () => ({ kind: "browser", sessionId: SESSION_ID }),
    requireAuthenticated: authenticateHost,
    sessions: { read: async () => sessionSnapshot },
    conversation: {
      append: async (value: unknown) => conversationTurnSchema.parse(value),
      read: readConversation,
    },
    hostActions: {
      readRecord: async (sessionId: string, actionId: string) => {
        const action = actions.get(actionId);
        return action?.sessionId === sessionId ? action : undefined;
      },
    },
  } as unknown as WorkbenchServerContext });
  await app.register(hostActionsRoutes, { context: {
    requireBrowserMutation: () => ({ kind: "browser", sessionId: SESSION_ID }),
    requireAuthenticated: authenticateHost,
    sessions: { read: async () => sessionSnapshot },
    conversation: {
      append: async (value: unknown) => {
        const parsed = conversationTurnSchema.parse(value);
        turns.push(parsed);
        return parsed;
      },
      read: readConversation,
    },
    hostActions: {
      create: async (request: unknown) => request,
      claim: async (sessionId: string, actionId: string, hostInstanceId: string) => {
        const action = actions.get(actionId);
        if (action?.sessionId !== sessionId || action.status !== "pending") return undefined;
        const leaseId = `${actionId}:lease`;
        action.leaseId = leaseId;
        return { contractVersion: "f8-host-action-claim-v1", actionId, hostInstanceId, leaseId, leaseExpiresAt: "2026-08-31T00:15:00.000Z", request: action.request };
      },
      complete: async (sessionId: string, result: { readonly actionId: string; readonly leaseId: string; readonly payload: unknown }) => {
        const action = actions.get(result.actionId);
        if (action?.sessionId !== sessionId || action.leaseId !== result.leaseId || action.status !== "pending") return "rejected" as const;
        action.status = "completed";
        action.result = result;
        return "accepted" as const;
      },
      read: async (sessionId: string, actionId: string) => {
        const action = actions.get(actionId);
        return action?.sessionId === sessionId ? action.request : undefined;
      },
      readRecord: async (sessionId: string, actionId: string) => {
        const action = actions.get(actionId);
        return action?.sessionId === sessionId ? action : undefined;
      },
    },
    events: { publish: () => undefined },
    syncSessionRecord: async () => undefined,
  } as unknown as WorkbenchServerContext });
  return app;
}

function turn() {
  return {
    contractVersion: "ta-conversation-turn-v1",
    turnId: "turn-route-1",
    sessionId: SESSION_ID,
    sequence: 1,
    source: "web",
    role: "user",
    content: [{ kind: "text", text: "Explain the current risk." }],
    createdAt: "2026-08-31T00:00:00.000Z",
    relatedArtifactIds: [],
  };
}

function externalTurn(sequence: number) {
  return {
    contractVersion: "ta-conversation-turn-v1",
    turnId: `external-${sequence}`,
    sessionId: SESSION_ID,
    sequence,
    source: "vscode",
    role: "assistant",
    content: [{ kind: "text", text: `External turn ${sequence}` }],
    createdAt: "2026-08-31T00:00:01.000Z",
    relatedArtifactIds: [],
  };
}

function minimalContext(): TaModelContextEnvelope {
  return taModelContextEnvelopeSchema.parse({
    contractVersion: "ta-model-context-envelope-v1",
    session: { sessionId: SESSION_ID, revision: 5 },
    inputRevision: 2,
    worksheet: { worksheetName: "Analysis-A" },
    f0Knowledge: [],
    factorTable: [],
    relatedArtifactIds: [],
  });
}

function richContext(): TaModelContextEnvelope {
  return taModelContextEnvelopeSchema.parse({
    contractVersion: "ta-model-context-envelope-v1",
    session: { sessionId: SESSION_ID, revision: 5 },
    inputRevision: 2,
    worksheet: {
      worksheetName: "Analysis-A",
      tableId: "factor-table-1",
      sourceRow: 14,
      factorName: "Gap X",
      calculationReference: "what-if:current",
    },
    f0Knowledge: [{
      inputRevision: 2,
      worksheetName: "Analysis-A",
      tableId: "factor-table-1",
      sourceRow: 14,
      factorName: "Gap X",
      capabilityStatus: "in_library_recommended",
      f0KnowledgeBaseVersion: "v1",
      summary: "F0 public guidance in_library_recommended for Gap X.",
      recommendation: { kind: "public", capabilityEntryId: "cap-gap-x", toleranceMin: 0.1, toleranceMax: 0.4, unit: "mm", distribution: "normal" },
    }],
    toleranceLoopImage: {
      artifactId: "f1-current-image",
      kind: "f1_image",
      inputRevision: 2,
      worksheetName: "Analysis-A",
      contentHash: "b".repeat(64),
      mediaType: "image/png",
      description: "Tolerance loop image for Analysis-A",
    },
    factorTable: [{
      inputRevision: 2,
      worksheetName: "Analysis-A",
      tableId: "factor-table-1",
      sourceRow: 14,
      factorName: "Gap X",
      partName: "Display cover",
      unit: "mm",
      nominalValue: 1.2,
      upperTolerance: 0.2,
      lowerTolerance: -0.2,
      distribution: "normal",
      mean: 1.2,
      tolerance: 0.4,
      oneSigma: 0.05,
      contribution: 0.42,
    }],
    baselineMetrics: {
      inputRevision: 2,
      calculationReference: "f4-run-current",
      mean: 1.2,
      rssSigma: 0.08,
      cp: 1.4,
      cpkL: 1.2,
      cpkU: 1.5,
      cpk: 1.2,
      statisticalMargin: 0.3,
      worstCaseMargin: 0.2,
      lowerSpecLimit: 0.6,
      upperSpecLimit: 1.8,
      yield: 0.999,
      dpm: 1000,
      statisticalLower: 0.96,
      statisticalUpper: 1.44,
      worstCaseLower: 1,
      worstCaseUpper: 1.4,
    },
    scenarioMetrics: {
      inputRevision: 2,
      calculationReference: "what-if:current",
      mean: 1.25,
      rssSigma: 0.07,
      cp: 1.5,
      cpkL: 1.3,
      cpkU: 1.6,
      cpk: 1.3,
      statisticalMargin: 0.35,
      worstCaseMargin: 0.25,
    },
    relatedArtifactIds: ["f2-current", "f4-current", "f1-current-image"],
  });
}

function reviewReadySnapshot() {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: SESSION_ID,
    revision: 5,
    inputRevision: 2,
    state: "review_required",
    activeAttempt: null,
    priorRunReferences: [],
    downstreamScopeSelection: {
      workbookContentHash: "d".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
      confirmed: true,
      provenance: "user",
    },
    artifactRefs: [
      { artifactId: "f4-calculation:7", kind: "f4_calculation", revision: 2, validated: true, reviewContextId: REVIEW_CONTEXT_ID },
      { artifactId: "f5-report:7", kind: "f5_report", revision: 2, validated: true, reviewContextId: REVIEW_CONTEXT_ID },
      { artifactId: "f6-report:7", kind: "f6_report", revision: 2, validated: true, reviewContextId: REVIEW_CONTEXT_ID },
    ],
    worksheetCapabilities: [],
  };
}