import { conversationTurnSchema, f5MultimodalWorksheetPairV3Schema, hostActionClaimSchema, hostActionRequestSchema, hostActionResultSchema } from "@ai-assist/contracts";
import { projectProductCapabilityReferences } from "@ai-assist/product-language";
import { selectCompleteReviewContext, type F8SessionSnapshot } from "@ai-assist/workbench";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { FastifyPluginAsync } from "fastify";

import { hasScope, hostBearerMatches } from "../auth.js";
import { errorStatusCode, safeErrorResponse } from "../security.js";
import type { WorkbenchServerContext } from "../server.js";

export const hostActionsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.get("/api/sessions/:sessionId/host-actions/pending", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth === undefined || !hasScope(auth, "sessions:read") || auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }
    let requests;
    try {
      requests = await context.buildWorksheetInterpretationRequests(sessionId);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
    for (const candidate of requests) {
      const actionId = `multimodal:${candidate.requestHash}`;
      let record = await context.hostActions.readRecord(sessionId, actionId);
      if (record === undefined) {
        const created = await context.hostActions.create({
          contractVersion: "f8-host-action-request-v1",
          actionId,
          sessionId,
          expectedRevision: candidate.revision,
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
          kind: "vscode_worksheet_multimodal_request",
          confirmationHash: candidate.requestHash,
          expectedTargetVersion: "vscode-worksheet-multimodal-v3",
          request: candidate,
        });
        if (created !== undefined) record = await context.hostActions.readRecord(sessionId, actionId);
      }
      if (record?.status === "pending" && record.request.kind === "vscode_worksheet_multimodal_request") {
        return reply.send({ actionId, kind: record.request.kind });
      }
    }
    return reply.code(204).send();
  });

  app.get("/api/sessions/:sessionId/host-actions/:actionId/leases/:leaseId/image", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined || !hasScope(auth, "host-actions:image:read")) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }
    const { sessionId, actionId, leaseId } = request.params as { readonly sessionId: string; readonly actionId: string; readonly leaseId: string };
    if (auth.sessionId !== sessionId
      || auth.hostInstanceId === undefined
      || !hostBearerMatches(auth, actionId, auth.hostInstanceId)) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }
    try {
      const image = await context.readClaimedWorksheetImage({ sessionId, actionId, hostInstanceId: auth.hostInstanceId, leaseId });
      reply.type(image.mediaType);
      return reply.send(Buffer.from(image.bytes));
    } catch {
      return reply.code(403).send({ error: "worksheet_image_read_rejected" });
    }
  });

  app.post("/api/sessions/:sessionId/host-actions", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    const parsed = hostActionRequestSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.sessionId !== sessionId || auth.sessionId !== sessionId) {
      return reply.code(400).send({ error: "host_action_schema_rejected" });
    }
    if (parsed.data.kind === "vscode_worksheet_multimodal_request"
      && (parsed.data.actionId !== `multimodal:${parsed.data.request.requestHash}`
        || !await context.validateWorksheetInterpretationRequest(sessionId, parsed.data.request))) {
      return reply.code(409).send({ error: "worksheet_interpretation_request_stale" });
    }

    const created = await context.hostActions.create(parsed.data);
    return created === undefined
      ? reply.code(409).send({ error: "host_action_id_conflict" })
      : reply.code(201).send(created);
  });

  app.post("/api/sessions/:sessionId/host-actions/:actionId/claim", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined && request.headers.authorization !== undefined) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }

    if (auth === undefined || !hasScope(auth, "host-actions:claim")) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }

    const { sessionId, actionId } = request.params as { readonly sessionId: string; readonly actionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    const hostInstanceId = readHostInstanceId(request.body);
    if (!hostBearerMatches(auth, actionId, hostInstanceId)) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }

    const pending = await context.hostActions.read(sessionId, actionId);
    if (pending?.kind === "vscode_worksheet_multimodal_request"
      && !await context.validateWorksheetInterpretationRequest(sessionId, pending.request)) {
      return reply.code(409).send({ error: "worksheet_interpretation_request_stale" });
    }

    const claim = await context.hostActions.claim(sessionId, actionId, hostInstanceId);
    const parsed = hostActionClaimSchema.safeParse(claim);
    return parsed.success ? reply.send(parsed.data) : reply.code(409).send({ error: "host_action_not_claimable" });
  });

  app.post("/api/sessions/:sessionId/host-actions/:actionId/result", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined || !hasScope(auth, "host-actions:result")) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }

    const { sessionId, actionId } = request.params as { readonly sessionId: string; readonly actionId: string };
    const parsed = hostActionResultSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.actionId !== actionId || auth.sessionId !== sessionId) {
      return reply.code(400).send({ error: "host_action_result_rejected" });
    }

    if (!hostBearerMatches(auth, actionId, parsed.data.hostInstanceId)) {
      return reply.code(400).send({ error: "host_action_result_rejected" });
    }

    if (parsed.data.resultHash !== createHash("sha256").update(JSON.stringify(parsed.data.payload)).digest("hex")) {
      return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
    }

    const actionRecord = await context.hostActions.readRecord(sessionId, actionId);
    const action = actionRecord?.request;
    const submittedOutcome = parsed.data.payload.status === "completed" ? parsed.data.payload.outcome : undefined;
    if (parsed.data.status === "completed" && action?.kind === "surface_validate" && submittedOutcome?.kind !== "surface_validation") {
      return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
    }
    if (parsed.data.status === "completed" && action?.kind === "surface_write" && submittedOutcome?.kind !== "surface_write") {
      return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
    }
    if (parsed.data.status === "completed" && action?.kind === "vscode_model_request" && submittedOutcome?.kind !== "model_response") return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
    if (parsed.data.status === "completed" && action?.kind === "vscode_worksheet_multimodal_request") {
      if (submittedOutcome?.kind !== "worksheet_multimodal_response"
        || !f5MultimodalWorksheetPairV3Schema.safeParse({ request: action.request, result: submittedOutcome.result }).success
        || !await context.validateWorksheetInterpretationRequest(sessionId, action.request)) {
        return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
      }
    }
    if (action?.kind === "surface_validate" && submittedOutcome?.kind === "surface_validation") {
      const confirmation = submittedOutcome.confirmation;
      const expectedConfirmationHash = createHash("sha256").update(JSON.stringify([
        confirmation.workItemReference,
        confirmation.commentReference,
        confirmation.expectedVersion,
        confirmation.nextContent,
      ])).digest("hex");
      if (confirmation.confirmationHash !== expectedConfirmationHash
        || confirmation.nextContent !== action.prepareRequest.nextContent
        || confirmation.factorCount !== action.prepareRequest.factorCount
        || (action.prepareRequest.mode === "create"
          && confirmation.ownerReference.trim().toLowerCase() !== action.prepareRequest.sponsorEmail.trim().toLowerCase())) {
        return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
      }
    }
    if (action?.kind === "surface_write" && submittedOutcome?.kind === "surface_write") {
      const expectedTargetIdentity = targetIdentityFromWorkItemReference(action.confirmation.workItemReference);
      const actualTargetIdentity = submittedOutcome.receipt.targetIdentity;
      if (actualTargetIdentity.organization !== expectedTargetIdentity.organization
        || actualTargetIdentity.project !== expectedTargetIdentity.project
        || actualTargetIdentity.workItemId !== expectedTargetIdentity.workItemId) {
        return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
      }
    }
    const modelSnapshot = action?.kind === "vscode_model_request" && submittedOutcome?.kind === "model_response"
      ? await context.sessions.read(sessionId)
      : undefined;
    if (action?.kind === "vscode_model_request" && submittedOutcome?.kind === "model_response" && modelSnapshot === undefined) {
      return reply.code(409).send({ error: "host_action_session_stale" });
    }
    const completion = await context.hostActions.complete(sessionId, parsed.data);
    const completedRecord = completion === "duplicate"
      ? await context.hostActions.readRecord(sessionId, actionId)
      : actionRecord;
    const resumableDuplicate = completion === "duplicate"
      && isDeepStrictEqual(completedRecord?.result, parsed.data);
    if (completion === "accepted" || resumableDuplicate) {
      const outcome = parsed.data.payload.status === "completed" ? parsed.data.payload.outcome : undefined;
      if (action?.kind === "surface_write" && outcome?.kind === "surface_write") {
        const snapshot = await context.sessions.read(sessionId);
        if (snapshot?.state !== "ado_action_pending" || snapshot.revision !== action.expectedRevision) {
          return reply.code(409).send({ error: "host_action_session_stale" });
        }
        const next = await context.sessions.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: `host-result:${actionId}`,
          expectedRevision: snapshot.revision,
          command: "accept_surface_write",
          payload: { actionId },
        });
        await context.enqueueActiveAttempt(next);
      }
      if (action?.kind === "vscode_model_request" && outcome?.kind === "model_response") {
        if (outcome.turnId !== action.turnId) return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
        const existingTurns = await context.conversation.read(sessionId);
        if (existingTurns.some((turn) => turn.turnId === `${action.turnId}:model`)) {
          await context.syncSessionRecord(sessionId);
          return reply.code(204).send();
        }
        if (outcome.proposal !== undefined) {
          try {
            await context.materializeF6InputDraftFromProposal(sessionId, {
              expectedRevision: action.expectedRevision,
              proposal: outcome.proposal,
            });
          } catch {
            // The model response remains deliverable; the user can retry draft materialization from the current gate.
          }
        }
        const snapshot = modelSnapshot!;
        const report = selectCanonicalReportReference(snapshot);
        const turns = await context.conversation.read(sessionId);
        const responseText = projectProductCapabilityReferences(outcome.responseText, snapshot.interactionLanguage.uiCatalogLanguage);
        const turn = await context.conversation.append(conversationTurnSchema.parse({
          contractVersion: "ta-conversation-turn-v1",
          turnId: `${action.turnId}:model`,
          sessionId,
          sequence: nextConversationSequence(turns),
          source: "vscode",
          role: "assistant",
          content: [
            { kind: "text", text: responseText },
            ...(report === undefined ? [] : [{ kind: "artifact_reference" as const, artifactId: report.artifactId, label: report.label }]),
            ...(report === undefined ? [] : [{ kind: "tool_result" as const, actions: [report.action], commands: [] }]),
          ],
          createdAt: new Date().toISOString(),
          relatedArtifactIds: report === undefined ? [] : [report.artifactId],
        }));
        context.events.publish(sessionId, "conversation_turn_appended", turn);
        await context.syncSessionRecord(sessionId);
      }
      if (action?.kind === "vscode_worksheet_multimodal_request") {
        const snapshot = await context.sessions.read(sessionId);
        if (snapshot?.state === "f5_running" && snapshot.revision === action.expectedRevision) {
          await context.enqueueActiveAttempt(snapshot);
        }
      }
      return reply.code(204).send();
    }
    if (completion === "duplicate") return reply.code(409).send({ error: "host_action_result_replayed" });
    return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
  });
};

function readHostInstanceId(body: unknown): string {
  const candidate = (body as { readonly hostInstanceId?: unknown } | undefined)?.hostInstanceId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : "host";
}

function nextConversationSequence(turns: readonly { readonly sequence: number }[]): number {
  return Math.max(0, ...turns.map((turn) => turn.sequence)) + 1;
}

function targetIdentityFromWorkItemReference(workItemReference: string): {
  readonly organization: string;
  readonly project: string;
  readonly workItemId: number;
} {
  let organization = "unknown-organization";
  let project = "unknown-project";
  let workItemId = 1;
  try {
    const url = new URL(workItemReference);
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const markerIndex = segments.findIndex((segment, index) => segment.toLowerCase() === "_workitems" && segments[index + 1]?.toLowerCase() === "edit");
    const parsedId = markerIndex < 0 ? Number.NaN : Number(segments[markerIndex + 2]);
    const parsedOrganization = url.hostname.toLowerCase() === "dev.azure.com" ? segments[0] : url.hostname.split(".")[0];
    const parsedProject = url.hostname.toLowerCase() === "dev.azure.com" ? segments[1] : segments[0];
    organization = typeof parsedOrganization === "string" && parsedOrganization.length > 0 ? parsedOrganization : organization;
    project = typeof parsedProject === "string" && parsedProject.length > 0 ? parsedProject : project;
    workItemId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : workItemId;
  } catch {
    // Non-URL references are allowed in fixtures; keep a deterministic fallback identity.
  }
  return { organization, project, workItemId };
}

function selectCanonicalReportReference(snapshot: F8SessionSnapshot): { readonly artifactId: string; readonly label: "Feature6-Report.md"; readonly action: { readonly type: "open_report"; readonly target: "/report/current"; readonly label: "打开当前报告" } } | undefined {
  const reviewContext = selectCompleteReviewContext(snapshot);
  if (reviewContext === undefined) return undefined;
  const report = reviewContext.artifacts.get("f6_report");
  if (report === undefined || !report.validated || report.revision !== snapshot.inputRevision) return undefined;
  return {
    artifactId: report.artifactId,
    label: "Feature6-Report.md",
    action: { type: "open_report", target: "/report/current", label: "打开当前报告" },
  };
}