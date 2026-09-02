import { open } from "node:fs/promises";
import { resolve } from "node:path";

import { createTypedError, f2UserReportSchema, f8PublicSessionCommandSchema, f8SessionCommandSchema } from "@ai-assist/contracts";
import { openSessionStore } from "@ai-assist/workbench";
import type { FastifyPluginAsync } from "fastify";

import { errorStatusCode, safeErrorResponse } from "../security.js";
import type { WorkbenchServerContext } from "../server.js";

type PublicSessionCommand = ReturnType<typeof f8PublicSessionCommandSchema.parse>;
type DownstreamScopePayload = {
  readonly workbookHash: string;
  readonly worksheetNames: readonly string[];
};
type ConfirmDownstreamScopeCommand = PublicSessionCommand & {
  readonly command: "confirm_downstream_scope";
  readonly payload: DownstreamScopePayload;
};

export const commandsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions/:sessionId/commands", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    const publicCommand = f8PublicSessionCommandSchema.safeParse(request.body);
    if (!publicCommand.success || publicCommand.data.sessionId !== sessionId) {
      return reply.code(400).send({ error: "command_schema_rejected" });
    }

    const receipt = await context.sessions.readCommandReceipt(sessionId, publicCommand.data.commandId);
    if (receipt !== undefined) {
      const committedCommand = await context.sessions.readCommittedCommand(sessionId, publicCommand.data.commandId);
      if (committedCommand === undefined) return reply.code(409).send({ error: "command_receipt_mismatch" });
      await context.recoverCommittedCommand(receipt, committedCommand);
      return reply.code(202).send((await context.sessions.read(sessionId)) ?? receipt);
    }

    try {
      const parsed = f8SessionCommandSchema.safeParse(await createInternalCommand(publicCommand.data, context));
      if (!parsed.success) return reply.code(400).send({ error: "command_schema_rejected" });
      const snapshot = await context.sessions.applyCommand(parsed.data);
      bindUploadedWorkbook(publicCommand.data, context);
      await context.createPendingHostAction(snapshot, parsed.data);
      await context.enqueueActiveAttempt(snapshot);
      await context.syncSessionRecord(sessionId);
      return reply.code(202).send((await context.sessions.read(sessionId)) ?? snapshot);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};

async function createInternalCommand(command: PublicSessionCommand, context: WorkbenchServerContext): Promise<unknown> {
  if (command.command === "reset_ado_decision") {
    const snapshot = await context.sessions.read(command.sessionId);
    if (snapshot?.state !== "ado_action_pending" || snapshot.revision !== command.expectedRevision) return command;
    const validation = await context.hostActions.readRecord(command.sessionId, `ado-validation:${command.sessionId}:${snapshot.revision}`);
    const write = await context.hostActions.readRecord(command.sessionId, `ado-write:${command.sessionId}:${snapshot.revision}`);
    if (write !== undefined || validation?.status !== "pending") {
      throw createTypedError({ code: "policy_denied", summary: "ADO target cannot be changed after Surface validation starts.", suggestedAction: "Complete or review the current ADO action.", affectedInputReferences: [command.sessionId] });
    }
  }
  if (command.command === "upload_workbook" && typeof command.sessionId === "string" && typeof command.payload === "object" && command.payload !== null && "artifactId" in command.payload) {
    const artifactId = (command.payload as { readonly artifactId?: unknown }).artifactId;
    if (typeof artifactId !== "string") return command;
    const managedWorkbook = await context.resolveManagedWorkbook(command.sessionId, artifactId);
    return { ...command, payload: { fileName: managedWorkbook.fileName, workbookBytes: managedWorkbook.workbookBytes, inputClassification: "confidential", managedArtifactId: artifactId } };
  }
  if (command.command === "save_what_if_draft") {
    const payload = command.payload as { readonly draftId: string; readonly worksheetName: string; readonly inputRevision: number; readonly factorOverrides?: readonly unknown[]; readonly systemSpecification?: unknown; readonly tableId?: string; readonly sourceRow?: number; readonly patch?: { readonly nominalValue?: number; readonly upperTolerance?: number; readonly lowerTolerance?: number; readonly additionalMeanShift?: number } };
    const draft = payload.factorOverrides !== undefined || payload.systemSpecification !== undefined
      ? await context.calculateWorksheetWhatIf(command.sessionId, payload as Parameters<WorkbenchServerContext["calculateWorksheetWhatIf"]>[1])
      : await context.calculateWhatIf(command.sessionId, payload as Parameters<WorkbenchServerContext["calculateWhatIf"]>[1]);
    return { ...command, payload: { draft: { ...draft, status: "saved" } } };
  }
  if (command.command === "confirm_what_if_tolerance_promotion") {
    const payload = command.payload as { readonly draftId: string; readonly confirmed: true };
    const { promotionPreview } = await context.createWhatIfPromotion(command.sessionId, payload.draftId);
    return { ...command, payload: { ...payload, promotionPreview } };
  }
  if (isConfirmDownstreamScopeCommand(command)) {
    await validateDownstreamScopeReadiness(command, context);
  }
  return command;
}

async function validateDownstreamScopeReadiness(
  command: ConfirmDownstreamScopeCommand,
  context: WorkbenchServerContext,
): Promise<void> {
  const snapshot = await context.sessions.read(command.sessionId);
  if (snapshot === undefined) {
    return;
  }

  const f2References = snapshot.artifactRefs?.filter((reference) =>
    reference.kind === "f2_report" && reference.validated && reference.revision === snapshot.inputRevision,
  ) ?? [];
  if (f2References.length !== 1) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "Downstream confirmation requires exactly one current validated F2 report.",
      suggestedAction: "Rerun F2 for the current workbook revision and retry downstream confirmation.",
      affectedInputReferences: [snapshot.sessionId],
    });
  }

  const store = await openSessionStore({ rootDir: context.rootDir, sessionId: command.sessionId });
  try {
    const persisted = await store.readArtifactReference(f2References[0]!.artifactId);
    if (persisted?.contentHash === undefined) {
      return;
    }

    const handle = await open(resolve(context.rootDir, persisted.relativePath), "r");
    let report: ReturnType<typeof f2UserReportSchema.parse>;
    try {
      const bytes = await handle.readFile();
      report = f2UserReportSchema.parse(JSON.parse(bytes.toString("utf8")) as unknown);
    } finally {
      await handle.close();
    }

    if (report.status === "inputRejected") {
      throw createTypedError({
        code: "evidence_mismatch",
        summary: "Downstream confirmation requires a current accepted F2 report.",
        suggestedAction: "Resolve F2 input issues and rerun F1/F2 before confirming downstream worksheets.",
        affectedInputReferences: [persisted.artifactId],
      });
    }

    if (command.payload.workbookHash !== report.workbook.contentHash) {
      throw createTypedError({
        code: "evidence_mismatch",
        summary: "Downstream confirmation workbook hash does not match the current F2 report.",
        suggestedAction: "Refresh the session and confirm downstream worksheets for the current workbook.",
        affectedInputReferences: [persisted.artifactId],
      });
    }

    const worksheetStatus = new Map(report.worksheets.map((worksheet) => [worksheet.worksheetName, worksheet.status]));
    for (const worksheetName of command.payload.worksheetNames) {
      const status = worksheetStatus.get(worksheetName);
      if (status === undefined) {
        throw createTypedError({
          code: "evidence_mismatch",
          summary: "Downstream confirmation worksheet set drifted from the current F2 report.",
          suggestedAction: "Reconfirm downstream worksheets from the current F2 ready worksheet list.",
          affectedInputReferences: [worksheetName, persisted.artifactId],
        });
      }
      if (status !== "ready") {
        throw createTypedError({
          code: "validation_error",
          summary: "Downstream confirmation includes blocked worksheets from the current F2 report.",
          suggestedAction: "Select only F2-ready worksheets for downstream confirmation.",
          affectedInputReferences: [worksheetName, persisted.artifactId],
        });
      }
    }
  } finally {
    await store.close();
  }
}

function bindUploadedWorkbook(command: PublicSessionCommand, context: WorkbenchServerContext): void {
  if (command.command !== "upload_workbook" || typeof command.payload !== "object" || command.payload === null || !("artifactId" in command.payload)) return;
  const artifactId = command.payload.artifactId;
  if (typeof artifactId === "string") context.bindManagedWorkbook(command.sessionId, artifactId);
}

function isConfirmDownstreamScopeCommand(command: PublicSessionCommand): command is ConfirmDownstreamScopeCommand {
  if (command.command !== "confirm_downstream_scope") return false;
  return isDownstreamScopePayload(command.payload);
}

function isDownstreamScopePayload(payload: unknown): payload is DownstreamScopePayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as { readonly workbookHash?: unknown; readonly worksheetNames?: unknown };
  return typeof candidate.workbookHash === "string"
    && Array.isArray(candidate.worksheetNames)
    && candidate.worksheetNames.every((value) => typeof value === "string");
}