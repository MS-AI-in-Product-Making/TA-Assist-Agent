import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath, rm, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import { createTypedError } from "@ai-assist/contracts";
import { readOoxmlWorkbook } from "@ai-assist/workbook-catalog";

export type UploadKind = "workbook" | "f7_feedback" | "image_evidence";

export interface StoredUpload {
  readonly artifactId: string;
  readonly kind: UploadKind;
  readonly classification: "confidential";
  readonly mimeType: string;
  readonly fileName: string;
  readonly relativePath: string;
  readonly contentHash: string;
  readonly size: number;
}

export interface UploadValidationInput {
  readonly rootDir: string;
  readonly sessionId: string;
  readonly kind: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

const MAX_UPLOAD_BYTES_BY_KIND: Record<UploadKind, number> = {
  workbook: 50 * 1024 * 1024,
  f7_feedback: 25 * 1024 * 1024,
  image_evidence: 10 * 1024 * 1024,
};

const MIME_BY_KIND: Record<UploadKind, readonly string[]> = {
  workbook: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
  f7_feedback: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
  image_evidence: ["image/png", "image/jpeg"],
};

export async function storeUpload(input: UploadValidationInput): Promise<StoredUpload> {
  const kind = parseUploadKind(input.kind);
  const fileName = sanitizeFileName(input.fileName);
  const bytes = Buffer.from(input.bytes);

  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES_BY_KIND[kind]) {
    throw safeUploadError("upload_size_rejected", 413);
  }

  if (!MIME_BY_KIND[kind].includes(input.mimeType)) {
    throw safeUploadError("upload_mime_rejected", 415);
  }

  if ((kind === "workbook" || kind === "f7_feedback") && !isOoxmlZip(bytes)) {
    throw safeUploadError("upload_ooxml_rejected", 415);
  }

  if (kind === "workbook" || kind === "f7_feedback") {
    try {
      readOoxmlWorkbook(bytes, undefined, false);
    } catch {
      throw safeUploadError("upload_ooxml_rejected", 415);
    }
  }

  const sessionUploadRoot = join(input.rootDir, "uploads", input.sessionId, kind);
  await mkdir(sessionUploadRoot, { recursive: true });
  await assertContainedPath(input.rootDir, sessionUploadRoot);

  const artifactId = randomUUID();
  const storageName = `${artifactId}-${fileName}`;
  const outputPath = join(sessionUploadRoot, storageName);
  await assertNoSymlinkAncestors(input.rootDir, sessionUploadRoot);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(outputPath, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    const handleStat = await handle.stat();
    if (!handleStat.isFile() || handleStat.size !== bytes.length) throw safeUploadError("upload_handle_rejected", 400);
    await assertContainedPath(input.rootDir, outputPath);
    await assertNoSymlinkAncestors(input.rootDir, sessionUploadRoot);
    const pathStat = await stat(outputPath);
    if (handleStat.dev !== pathStat.dev || handleStat.ino !== pathStat.ino) throw safeUploadError("upload_identity_rejected", 400);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(outputPath, { force: true }).catch(() => undefined);
    throw error;
  }
  await handle.close();

  return {
    artifactId,
    kind,
    classification: "confidential",
    mimeType: input.mimeType,
    fileName,
    relativePath: relative(input.rootDir, outputPath).replace(/\\/g, "/"),
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
  };
}

export function rejectClientOutputPath(payload: unknown): boolean {
  return typeof payload === "object" && payload !== null && "outputRoot" in payload;
}

function parseUploadKind(kind: string): UploadKind {
  if (kind === "workbook" || kind === "f7_feedback" || kind === "image_evidence") {
    return kind;
  }

  throw safeUploadError("upload_kind_rejected", 400);
}

function sanitizeFileName(fileName: string): string {
  const clean = basename(fileName).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160);
  if (clean.length === 0 || clean === "." || clean === "..") {
    throw safeUploadError("upload_name_rejected", 400);
  }

  return clean;
}

function isOoxmlZip(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

async function assertContainedPath(rootDir: string, targetPath: string): Promise<void> {
  const [rootRealPath, targetRealPath] = await Promise.all([realpath(rootDir), realpath(targetPath)]);
  const pathDelta = relative(rootRealPath, targetRealPath);
  if (pathDelta.startsWith("..") || pathDelta === "") {
    if (pathDelta !== "") {
      throw safeUploadError("path_escape_rejected", 400);
    }
  }
}

async function assertNoSymlinkAncestors(rootDir: string, targetDir: string): Promise<void> {
  const rootRealPath = await realpath(rootDir);
  const targetRealPath = await realpath(targetDir);
  const segments = relative(rootRealPath, targetRealPath).split(/[\\/]/).filter(Boolean);
  let current = rootRealPath;
  for (const segment of segments) {
    current = join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) {
      throw safeUploadError("symlink_ancestor_rejected", 400);
    }
  }
}

function safeUploadError(reference: string, statusCode: number): Error {
  const typedError = createTypedError({
    code: statusCode === 413 ? "policy_denied" : "validation_error",
    summary: "Upload rejected.",
    suggestedAction: "Provide a supported workbook or evidence file.",
    affectedInputReferences: [reference],
  });
  return Object.assign(new Error(typedError.summary), typedError, { statusCode });
}