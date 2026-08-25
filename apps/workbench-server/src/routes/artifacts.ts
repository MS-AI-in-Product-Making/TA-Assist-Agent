import { createReadStream } from "node:fs";
import { join } from "node:path";

import type { FastifyPluginAsync } from "fastify";

import type { WorkbenchServerContext } from "../server.js";

export const artifactsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.get("/api/sessions/:sessionId/artifacts/:artifactId", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId, artifactId } = request.params as { readonly sessionId: string; readonly artifactId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    const artifact = context.artifacts.read(sessionId, artifactId);
    if (artifact === undefined) {
      return reply.code(404).send({ error: "artifact_not_found" });
    }

    reply.header("content-disposition", `attachment; filename="${artifact.fileName.replace(/"/g, "_")}"`);
    return reply.send(createReadStream(join(context.rootDir, artifact.relativePath)));
  });
};