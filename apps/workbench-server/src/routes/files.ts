import type { FastifyPluginAsync } from "fastify";

import { rejectClientOutputPath, storeUpload } from "../uploads.js";
import type { WorkbenchServerContext } from "../server.js";
import { errorStatusCode, safeErrorResponse } from "../security.js";

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
        continue;
      }

      if (part.type === "file" && part.fieldname === "file") {
        fileName = part.filename;
        mimeType = part.mimetype;
        bytes = await part.toBuffer();
        continue;
      }

      return reply.code(400).send(safeErrorResponse(Object.assign(new Error("Unexpected upload field."), { code: "validation_error" })));
    }

    if (kind === undefined || fileName === undefined || mimeType === undefined || bytes === undefined) {
      return reply.code(400).send({ error: "upload_parts_required" });
    }

    try {
      const artifact = await storeUpload({ rootDir: context.rootDir, sessionId, kind, fileName, mimeType, bytes });
      context.artifacts.authorize(sessionId, artifact.artifactId, artifact.relativePath, artifact.fileName, artifact.classification, artifact.mimeType);
      return reply.code(201).send(artifact);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};