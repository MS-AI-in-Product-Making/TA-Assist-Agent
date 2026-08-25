import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import type { FastifyPluginAsync } from "fastify";

import type { WorkbenchServerContext } from "../server.js";

export const artifactsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.get("/api/sessions/:sessionId/artifacts/:artifactId", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId, artifactId } = request.params as { readonly sessionId: string; readonly artifactId: string };
    if (request.headers.range !== undefined) {
      return reply.code(416).send({ error: "range_not_supported" });
    }

    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    const artifact = context.artifacts.read(sessionId, artifactId);
    if (artifact === undefined) {
      return reply.code(404).send({ error: "artifact_not_found" });
    }

    if (!ALLOWED_MIME_TYPES.has(artifact.mimeType)) {
      return reply.code(415).send({ error: "artifact_mime_rejected" });
    }

    const artifactPath = resolve(context.rootDir, artifact.relativePath);
    if (!await isSafeManagedPath(context.rootDir, artifactPath)) {
      return reply.code(403).send({ error: "artifact_path_rejected" });
    }

    reply.header("content-disposition", `attachment; filename="${artifact.fileName.replace(/"/g, "_")}"`);
    reply.type(artifact.mimeType);
    return reply.send(createReadStream(artifactPath));
  });
};

const ALLOWED_MIME_TYPES = new Set(["text/plain", "application/json", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg"]);

async function isSafeManagedPath(rootDir: string, targetPath: string): Promise<boolean> {
  try {
    const rootReal = await realpath(rootDir);
    const pathDelta = relative(rootReal, targetPath);
    if (pathDelta.length === 0 || pathDelta.startsWith("..") || pathDelta.split(/[\\/]/).includes("..")) return false;

    let current = rootReal;
    for (const segment of pathDelta.split(/[\\/]/).filter(Boolean)) {
      current = join(current, segment);
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || stat.isBlockDevice() || stat.isCharacterDevice()) return false;
    }

    const targetReal = await realpath(targetPath);
    const realDelta = relative(rootReal, targetReal);
    return realDelta.length > 0 && !realDelta.startsWith("..") && !realDelta.split(/[\\/]/).includes("..");
  } catch {
    return false;
  }
}