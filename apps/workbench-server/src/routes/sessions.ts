import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { SESSION_COOKIE_NAME } from "../auth.js";
import { errorStatusCode, safeErrorResponse } from "../security.js";
import type { WorkbenchServerContext } from "../server.js";

const createSessionRequestSchema = z.object({
  utcOffsetMinutes: z.number().int().min(-840).max(840),
  source: z.literal("web"),
}).strict();

export const sessionsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const parsed = createSessionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "session_schema_rejected" });
    }

    try {
      const sessionId = randomUUID();
      const snapshot = await context.sessions.create(sessionId, {
        requestedAt: context.now().toISOString(),
        utcOffsetMinutes: parsed.data.utcOffsetMinutes,
        source: parsed.data.source,
      });
      const cookies = request.cookies as Record<string, string | undefined> | undefined;
      const session = context.auth.rotateBrowserSession(cookies?.[SESSION_COOKIE_NAME], sessionId);
      return reply
        .setCookie(SESSION_COOKIE_NAME, session.cookieValue, {
          httpOnly: true,
          sameSite: "strict",
          path: "/",
          secure: false,
        })
        .code(201)
        .send(snapshot);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });

  app.get("/api/sessions/:sessionId", async (request, reply) => {
    const auth = context.requireBrowserSession(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    return (await context.sessions.read(sessionId)) ?? reply.code(404).send({ error: "session_not_found" });
  });
};