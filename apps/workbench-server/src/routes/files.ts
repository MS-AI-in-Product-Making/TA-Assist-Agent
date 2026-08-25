import type { FastifyPluginAsync } from "fastify";

import { rejectClientOutputPath, storeUpload } from "../uploads.js";
import type { WorkbenchServerContext } from "../server.js";

export const filesRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions/:sessionId/files", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    if (rejectClientOutputPath(request.body)) {
      return reply.code(400).send({ error: "client_output_path_rejected" });
    }

    if (request.headers["content-type"]?.includes("application/json") === true) {
      return reply.code(400).send({ error: "multipart_required" });
    }

    if (!request.isMultipart()) {
      return reply.code(400).send({ error: "multipart_required" });
    }

    let kind: string | undefined;
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let bytes: Buffer | undefined;

    for await (const part of request.parts()) {
      if (part.type === "field" && part.fieldname === "kind") {
        kind = String(part.value);
      }

      if (part.type === "file" && part.fieldname === "file") {
        fileName = part.filename;
        mimeType = part.mimetype;
        bytes = await part.toBuffer();
      }
    }

    if (kind === undefined || fileName === undefined || mimeType === undefined || bytes === undefined) {
      return reply.code(400).send({ error: "upload_parts_required" });
    }

    try {
      const artifact = await storeUpload({ rootDir: context.rootDir, sessionId, kind, fileName, mimeType, bytes });
      context.artifacts.authorize(sessionId, artifact.artifactId, artifact.relativePath, artifact.fileName);
      return reply.code(201).send(artifact);
    } catch (error) {
      return reply.code(readStatusCode(error)).send({ error: error instanceof Error ? error.message : "upload_rejected" });
    }
  });
};

function readStatusCode(error: unknown): number {
  const statusCode = (error as { readonly statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : 400;
}