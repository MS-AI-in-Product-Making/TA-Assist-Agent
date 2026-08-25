import { f8SessionCommandSchema } from "@ai-assist/contracts";
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

    const parsed = f8SessionCommandSchema.safeParse(normalizeCommandBody(request.body));
    if (!parsed.success || parsed.data.sessionId !== sessionId) {
      return reply.code(400).send({ error: "command_schema_rejected" });
    }

    try {
      const snapshot = await context.sessions.applyCommand(parsed.data);
      await context.enqueueActiveAttempt(snapshot);
      return reply.code(202).send((await context.sessions.read(sessionId)) ?? snapshot);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};

function normalizeCommandBody(body: unknown): unknown {
  if (typeof body !== "object" || body === null || !("payload" in body)) {
    return body;
  }

  const command = body as { readonly payload?: unknown };
  if (typeof command.payload !== "object" || command.payload === null || !("workbookBytes" in command.payload)) {
    return body;
  }

  const payload = command.payload as { readonly workbookBytes?: unknown };
  const workbookBytes = normalizeBytes(payload.workbookBytes);
  return workbookBytes === undefined ? body : { ...command, payload: { ...payload, workbookBytes } };
}

function normalizeBytes(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value) && value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)) return new Uint8Array(value);
  if (typeof value === "object" && value !== null && "data" in value && Array.isArray((value as { readonly data?: unknown }).data)) {
    const data = (value as { readonly data: unknown[] }).data;
    if (data.every(isByte)) return new Uint8Array(data);
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    if (entries.length > 0 && entries.every(([key, entry]) => /^(0|[1-9]\d*)$/.test(key) && isByte(entry))) {
      const indexedBytes = entries.map(([key, entry]) => [Number(key), entry] as const).sort(([left], [right]) => left - right);
      if (indexedBytes.every(([index], position) => index === position)) return new Uint8Array(indexedBytes.map(([, entry]) => entry));
    }
  }
  return undefined;
}

function isByte(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}