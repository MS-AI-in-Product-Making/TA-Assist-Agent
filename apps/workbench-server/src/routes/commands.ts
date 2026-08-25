import { f8PublicSessionCommandSchema, f8SessionCommandSchema } from "@ai-assist/contracts";
import type { FastifyPluginAsync } from "fastify";

import { errorStatusCode, safeErrorResponse } from "../security.js";
import type { WorkbenchServerContext } from "../server.js";

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

    const parsed = f8SessionCommandSchema.safeParse(await createInternalCommand(publicCommand.data, context));
    if (!parsed.success) return reply.code(400).send({ error: "command_schema_rejected" });

    try {
      const snapshot = await context.sessions.applyCommand(parsed.data);
      await context.createPendingHostAction(snapshot, parsed.data);
      await context.enqueueActiveAttempt(snapshot);
      return reply.code(202).send((await context.sessions.read(sessionId)) ?? snapshot);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};

async function createInternalCommand(command: ReturnType<typeof f8PublicSessionCommandSchema.parse>, context: WorkbenchServerContext): Promise<unknown> {
  if (command.command === "upload_workbook" && typeof command.sessionId === "string" && typeof command.payload === "object" && command.payload !== null && "artifactId" in command.payload) {
    const artifactId = (command.payload as { readonly artifactId?: unknown }).artifactId;
    if (typeof artifactId !== "string") return command;
    const managedWorkbook = await context.resolveManagedWorkbook(command.sessionId, artifactId);
    return { ...command, payload: { fileName: managedWorkbook.fileName, workbookBytes: managedWorkbook.workbookBytes, inputClassification: "confidential" } };
  }
  return command;
}