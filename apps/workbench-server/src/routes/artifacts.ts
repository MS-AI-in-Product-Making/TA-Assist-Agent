import { lstat, open, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import type { FastifyPluginAsync } from "fastify";
import { openSessionStore, selectCompleteReviewContext } from "@ai-assist/workbench";
import { f2UserReportSchema } from "@ai-assist/contracts";

import type { WorkbenchServerContext } from "../server.js";

export const artifactsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.get("/api/sessions/:sessionId/artifacts/:artifactId", async (request, reply) => {
    const auth = context.requireBrowserSession(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId, artifactId } = request.params as { readonly sessionId: string; readonly artifactId: string };
    const query = request.query as { readonly disposition?: unknown; readonly worksheet?: unknown; readonly path?: unknown };
    if (request.headers.range !== undefined) {
      return reply.code(416).send({ error: "range_not_supported" });
    }

    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    const artifact = context.artifacts.read(sessionId, artifactId) ?? await readPersistedArtifact(context.rootDir, sessionId, artifactId, query);
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
    if ("contentHash" in artifact && artifact.contentHash !== undefined && createHash("sha256").update(bytes).digest("hex") !== artifact.contentHash) {
      return reply.code(409).send({ error: "artifact_hash_mismatch" });
    }

    const disposition = query.disposition === "inline" && artifact.mimeType.startsWith("image/") ? "inline" : "attachment";
    reply.header("content-disposition", `${disposition}; filename="${artifact.fileName.replace(/"/g, "_")}"`);
    reply.type(artifact.mimeType);
    return reply.send(bytes);
  });
};

const ALLOWED_MIME_TYPES = new Set(["text/plain", "text/markdown; charset=utf-8", "application/json", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg"]);
const JSON_ARTIFACT_KINDS = new Set(["f2_report", "f3_report", "f4_calculation", "f4_report", "f5_report", "f6_optimization", "engineering_summary_projection"]);

async function readPersistedArtifact(
  rootDir: string,
  sessionId: string,
  artifactId: string,
  query: { readonly worksheet?: unknown; readonly path?: unknown },
) {
  if (artifactId.startsWith("f1-image:")) {
    return readF1ImageArtifact(
      rootDir,
      sessionId,
      artifactId.slice("f1-image:".length),
      typeof query.worksheet === "string" ? query.worksheet : undefined,
      typeof query.path === "string" ? query.path : undefined,
    );
  }
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    const reference = await store.readArtifactReference(artifactId);
    if (reference === undefined) return undefined;
    if (reference.kind === "f6_report") {
      const snapshot = await store.readSnapshot();
      const report = selectCompleteReviewContext(snapshot)?.artifacts.get("f6_report");
      if (report === undefined || report.artifactId !== reference.artifactId || report.revision !== snapshot.inputRevision) return undefined;
      if (reference.contentHash === undefined || !/^[a-f0-9]{64}$/.test(reference.contentHash)) return undefined;
      return {
        relativePath: reference.relativePath,
        fileName: "Feature6-Report.md",
        classification: "confidential" as const,
        mimeType: "text/markdown; charset=utf-8",
        contentHash: reference.contentHash,
      };
    }
    if (!JSON_ARTIFACT_KINDS.has(reference.kind)) return undefined;
    const fileName = reference.relativePath.split(/[\\/]/).at(-1);
    if (fileName === undefined) return undefined;
    return {
      relativePath: reference.relativePath,
      fileName,
      classification: "confidential" as const,
      mimeType: "application/json",
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

export async function readManagedArtifact(rootDir: string, targetPath: string): Promise<Buffer | undefined> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    if (!await isSafeManagedPath(rootDir, targetPath)) return undefined;
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

async function readF1ImageArtifact(
  rootDir: string,
  sessionId: string,
  contentHash: string,
  worksheetName: string | undefined,
  requestedRelativePath: string | undefined,
) {
  if (!/^[a-f0-9]{64}$/.test(contentHash)) return undefined;
  if (worksheetName === undefined || worksheetName.length === 0) return undefined;
  if (requestedRelativePath === undefined || requestedRelativePath.length === 0) return undefined;
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    const snapshot = await store.readSnapshot();
    const references = snapshot.artifactRefs?.filter((reference) => reference.kind === "f2_report" && reference.validated && reference.revision === snapshot.inputRevision) ?? [];
    if (references.length !== 1) return undefined;
    const reference = await store.readArtifactReference(references[0]!.artifactId);
    if (reference?.contentHash === undefined) return undefined;
    const reportPath = resolve(rootDir, reference.relativePath);
    const reportBytes = await readManagedArtifact(rootDir, reportPath);
    if (reportBytes === undefined || createHash("sha256").update(reportBytes).digest("hex") !== reference.contentHash) return undefined;
    const report = f2UserReportSchema.parse(JSON.parse(reportBytes.toString("utf8")) as unknown);
    if (report.status === "inputRejected") return undefined;

    const worksheets = report.worksheets.filter((worksheet) => worksheet.worksheetName === worksheetName);
    if (worksheets.length !== 1) return undefined;
    const paths = [...new Set(worksheets[0]!.rows.flatMap((row) => {
      const image = row.imageReference;
      return image !== undefined
        && image.worksheetName === worksheetName
        && image.relativePath === requestedRelativePath
        && image.contentHash === contentHash
        ? [image.relativePath]
        : [];
    }))];
    if (paths.length !== 1) return undefined;
    const relativePath = join(dirname(dirname(reference.relativePath)), "f1", paths[0]!);
    const extension = extname(relativePath).toLowerCase();
    const mimeType = extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : undefined;
    if (mimeType === undefined) return undefined;
    return { relativePath, fileName: basename(relativePath), classification: "confidential" as const, mimeType, contentHash };
  } finally {
    await store.close();
  }
}