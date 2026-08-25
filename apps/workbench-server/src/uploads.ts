import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";

export type UploadKind = "workbook" | "f7_feedback" | "image_evidence";

export interface StoredUpload {
  readonly artifactId: string;
  readonly kind: UploadKind;
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
    throw Object.assign(new Error("upload_size_rejected"), { statusCode: 413 });
  }

  if (!MIME_BY_KIND[kind].includes(input.mimeType)) {
    throw Object.assign(new Error("upload_mime_rejected"), { statusCode: 415 });
  }

  if ((kind === "workbook" || kind === "f7_feedback") && !isOoxmlZip(bytes)) {
    throw Object.assign(new Error("upload_ooxml_rejected"), { statusCode: 415 });
  }

  const sessionUploadRoot = join(input.rootDir, "uploads", input.sessionId, kind);
  await mkdir(sessionUploadRoot, { recursive: true });
  await assertContainedPath(input.rootDir, sessionUploadRoot);

  const artifactId = randomUUID();
  const storageName = `${artifactId}-${fileName}`;
  const outputPath = join(sessionUploadRoot, storageName);
  await assertNoSymlinkAncestors(input.rootDir, sessionUploadRoot);
  await writeFile(outputPath, bytes, { flag: "wx" });
  await assertContainedPath(input.rootDir, outputPath);

  return {
    artifactId,
    kind,
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

  throw Object.assign(new Error("upload_kind_rejected"), { statusCode: 400 });
}

function sanitizeFileName(fileName: string): string {
  const clean = basename(fileName).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160);
  if (clean.length === 0 || clean === "." || clean === "..") {
    throw Object.assign(new Error("upload_name_rejected"), { statusCode: 400 });
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
      throw Object.assign(new Error("path_escape_rejected"), { statusCode: 400 });
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
      throw Object.assign(new Error("symlink_ancestor_rejected"), { statusCode: 400 });
    }
  }
}