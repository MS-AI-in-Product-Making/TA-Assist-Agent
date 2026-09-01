import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { createTypedError } from "@ai-assist/contracts";

export interface ProductExportFile {
  readonly relativePath: string;
  readonly content: string;
}

export interface ProductExportRequest {
  readonly managedRoot: string;
  readonly exportId: string;
  readonly files: readonly ProductExportFile[];
}

export interface ProductExportFileRecord {
  readonly relativePath: string;
  readonly byteSize: number;
  readonly sha256: string;
}

export interface ProductExportManifest {
  readonly contractVersion: "atomic-product-export-v1";
  readonly exportId: string;
  readonly generatedAt: string;
  readonly files: readonly ProductExportFileRecord[];
}

export interface PreparedProductExport {
  readonly request: ProductExportRequest;
  readonly exportRoot: string;
  readonly stagingRoot: string;
}

export interface ProductExportResult {
  readonly root: string;
  readonly manifest: ProductExportManifest;
}

function sha256Bytes(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.length === 0 || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
    throw new Error("Export file path must be relative.");
  }
  const clean = path.posix.normalize(normalized);
  if (clean === "." || clean.startsWith("../") || clean.includes("/../")) {
    throw new Error("Export file path escaped the managed export root.");
  }
  return clean;
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function ensureNoSymlinkAncestors(target: string): Promise<void> {
  const resolved = path.resolve(target);
  const parts = resolved.split(path.sep);
  const first = parts[0] ?? "";
  let current = first.endsWith(":") ? `${first}${path.sep}` : first === "" ? path.sep : first;
  for (const part of parts.slice(1)) {
    if (part.length === 0) {
      continue;
    }
    current = current === path.sep ? `${current}${part}` : path.join(current, part);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) {
        throw createTypedError({
          code: "policy_denied",
          summary: "Product export path contains a symbolic-link ancestor.",
          suggestedAction: "Use a physical managed output directory for export.",
          affectedInputReferences: [target],
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

async function enumerateFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  const walk = async (directory: string) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        output.push(path.relative(root, absolute).replaceAll("\\", "/"));
      }
    }
  };
  await walk(root);
  output.sort((left, right) => left.localeCompare(right));
  return output;
}

async function expectedBusinessRecords(request: ProductExportRequest): Promise<ProductExportFileRecord[]> {
  const dedupe = new Set<string>();
  const records: ProductExportFileRecord[] = [];
  for (const file of request.files) {
    const relativePath = normalizeRelativePath(file.relativePath);
    if (dedupe.has(relativePath)) {
      throw new Error(`Duplicate export file path: ${relativePath}`);
    }
    dedupe.add(relativePath);
    const bytes = Buffer.from(file.content, "utf8");
    records.push({
      relativePath,
      byteSize: bytes.byteLength,
      sha256: sha256Bytes(bytes),
    });
  }
  return records;
}

function evidenceMismatch(summary: string, reference: string): Error {
  return createTypedError({
    code: "evidence_mismatch",
    summary,
    suggestedAction: "Regenerate a fresh validated export from the current source artifacts.",
    affectedInputReferences: [reference],
  });
}

async function computeCommittedManifest(exportRoot: string, request: ProductExportRequest): Promise<ProductExportManifest> {
  const manifestPath = path.join(exportRoot, "export-manifest.json");
  const manifestBytes = await readFile(manifestPath);
  const parsed = JSON.parse(manifestBytes.toString("utf8")) as ProductExportManifest;
  const expectedBusiness = await expectedBusinessRecords(request);
  if (JSON.stringify(parsed.files) !== JSON.stringify(expectedBusiness)) {
    throw evidenceMismatch("Existing export manifest content does not match the expected source files.", request.exportId);
  }

  const allFiles = await enumerateFiles(exportRoot);
  const expectedAll = [...expectedBusiness.map((record) => record.relativePath), "export-manifest.json"].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(allFiles) !== JSON.stringify(expectedAll)) {
    throw evidenceMismatch("Existing export file set drifted from the controlled manifest.", request.exportId);
  }

  for (const record of expectedBusiness) {
    const bytes = await readFile(path.join(exportRoot, record.relativePath));
    const hash = sha256Bytes(bytes);
    if (hash !== record.sha256) {
      throw evidenceMismatch("Existing export file hash does not match the expected source evidence.", record.relativePath);
    }
  }

  return {
    ...parsed,
    files: [
      ...expectedBusiness,
      {
        relativePath: "export-manifest.json",
        byteSize: manifestBytes.byteLength,
        sha256: sha256Bytes(manifestBytes),
      },
    ],
  };
}

export async function prepareProductExport(request: ProductExportRequest): Promise<PreparedProductExport> {
  const managedRoot = path.resolve(request.managedRoot);
  const exportId = normalizeRelativePath(request.exportId).replaceAll("/", "_");
  await mkdir(managedRoot, { recursive: true });
  await ensureNoSymlinkAncestors(managedRoot);
  const realManagedRoot = await realpath(managedRoot);
  const exportRoot = path.join(realManagedRoot, exportId);
  const stagingBase = path.join(realManagedRoot, ".product-export-staging");
  await mkdir(stagingBase, { recursive: true });
  await ensureNoSymlinkAncestors(stagingBase);
  const stagingRoot = path.join(stagingBase, `${exportId}-${randomUUID()}`);
  await mkdir(stagingRoot, { recursive: false });

  for (const file of request.files) {
    const relativePath = normalizeRelativePath(file.relativePath);
    const absolute = path.join(stagingRoot, relativePath);
    const parent = path.dirname(absolute);
    await mkdir(parent, { recursive: true });
    await writeFile(absolute, file.content, "utf8");
  }

  const expected = new Set((await expectedBusinessRecords(request)).map((record) => record.relativePath));
  const staged = await enumerateFiles(stagingRoot);
  if (staged.some((entry) => !expected.has(entry))) {
    throw new Error("Staging contained unmanaged files.");
  }

  return {
    request: { ...request, managedRoot: realManagedRoot, exportId },
    exportRoot,
    stagingRoot,
  };
}

export async function commitProductExport(prepared: PreparedProductExport): Promise<ProductExportResult> {
  await ensureNoSymlinkAncestors(prepared.request.managedRoot);
  const exportRoot = path.resolve(prepared.exportRoot);
  if (!isContained(path.resolve(prepared.request.managedRoot), exportRoot)) {
    throw new Error("Export root escaped managed root containment.");
  }

  try {
    await stat(exportRoot);
    const manifest = await computeCommittedManifest(exportRoot, prepared.request);
    await rm(prepared.stagingRoot, { recursive: true, force: true });
    return { root: exportRoot, manifest };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const businessRecords = await expectedBusinessRecords(prepared.request);
  const diskManifest = {
    contractVersion: "atomic-product-export-v1",
    exportId: prepared.request.exportId,
    generatedAt: new Date().toISOString(),
    files: businessRecords,
  } as const;
  const manifestContent = `${JSON.stringify(diskManifest, null, 2)}\n`;
  await writeFile(path.join(prepared.stagingRoot, "export-manifest.json"), manifestContent, "utf8");

  const stagedFiles = await enumerateFiles(prepared.stagingRoot);
  const expectedStaged = [...businessRecords.map((record) => record.relativePath), "export-manifest.json"].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(stagedFiles) !== JSON.stringify(expectedStaged)) {
    throw new Error("Staging file set changed before commit.");
  }

  const realManagedRoot = await realpath(prepared.request.managedRoot);
  const realStagingRoot = await realpath(prepared.stagingRoot);
  if (!isContained(realManagedRoot, realStagingRoot)) {
    throw new Error("Staging root escaped managed root containment.");
  }
  await rename(prepared.stagingRoot, exportRoot);

  const manifest = await computeCommittedManifest(exportRoot, prepared.request);
  return { root: exportRoot, manifest };
}

export async function verifyExistingProductExport(request: ProductExportRequest): Promise<ProductExportResult> {
  const requestedManagedRoot = path.resolve(request.managedRoot);
  try {
    await stat(requestedManagedRoot);
  } catch {
    throw evidenceMismatch("Existing export is not found for retry verification.", request.exportId);
  }
  const managedRoot = await realpath(requestedManagedRoot);
  const exportId = normalizeRelativePath(request.exportId).replaceAll("/", "_");
  const exportRoot = path.join(managedRoot, exportId);
  await ensureNoSymlinkAncestors(exportRoot);
  try {
    await stat(exportRoot);
  } catch {
    throw evidenceMismatch("Existing export is not found for retry verification.", exportId);
  }
  const manifest = await computeCommittedManifest(exportRoot, {
    ...request,
    managedRoot,
    exportId,
  });
  return { root: exportRoot, manifest };
}

export function contentSha256(content: string): string {
  return sha256Text(content);
}
