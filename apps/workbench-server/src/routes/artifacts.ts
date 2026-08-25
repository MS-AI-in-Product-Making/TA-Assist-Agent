import { lstat, open, realpath, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import type { FastifyPluginAsync } from "fastify";
import { openSessionStore } from "@ai-assist/workbench";

import type { WorkbenchServerContext } from "../server.js";

export const artifactsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.get("/api/sessions/:sessionId/artifacts/:artifactId", async (request, reply) => {
    const auth = context.requireBrowserSession(request, reply);
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

    const artifact = context.artifacts.read(sessionId, artifactId) ?? await readPersistedArtifact(context.rootDir, sessionId, artifactId);
    if (artifact === undefined) {
      return reply.code(404).send({ error: "artifact_not_found" });
    }

    if (!ALLOWED_MIME_TYPES.has(artifact.mimeType)) {
      return reply.code(415).send({ error: "artifact_mime_rejected" });
    }

    const artifactPath = resolve(context.rootDir, artifact.relativePath);
    const bytes = await readManagedArtifact(context.rootDir, artifactPath);
    if (bytes === undefined) {
      return reply.code(403).send({ error: "artifact_path_rejected" });
    }

    reply.header("content-disposition", `attachment; filename="${artifact.fileName.replace(/"/g, "_")}"`);
    reply.type(artifact.mimeType);
    return reply.send(bytes);
  });
};

const ALLOWED_MIME_TYPES = new Set(["text/plain", "application/json", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg"]);
const JSON_ARTIFACT_KINDS = new Set(["f1_image", "f3_report", "f4_calculation", "f5_report", "f6_optimization"]);

async function readPersistedArtifact(rootDir: string, sessionId: string, artifactId: string) {
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    const reference = await store.readArtifactReference(artifactId);
    if (reference === undefined || (!JSON_ARTIFACT_KINDS.has(reference.kind) && reference.kind !== "f6_report")) return undefined;
    const fileName = reference.relativePath.split(/[\\/]/).at(-1);
    if (fileName === undefined) return undefined;
    return {
      relativePath: reference.relativePath,
      fileName,
      classification: "confidential" as const,
      mimeType: JSON_ARTIFACT_KINDS.has(reference.kind) ? "application/json" : "text/plain",
    };
  } finally {
    await store.close();
  }
}

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

async function readManagedArtifact(rootDir: string, targetPath: string): Promise<Buffer | undefined> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(targetPath, "r");
    const handleStat = await handle.stat();
    if (!handleStat.isFile() || handleStat.isBlockDevice() || handleStat.isCharacterDevice() || !await isSafeManagedPath(rootDir, targetPath)) return undefined;
    const pathStat = await stat(targetPath);
    if (handleStat.dev !== pathStat.dev || handleStat.ino !== pathStat.ino) return undefined;
    return await handle.readFile();
  } catch {
    return undefined;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}