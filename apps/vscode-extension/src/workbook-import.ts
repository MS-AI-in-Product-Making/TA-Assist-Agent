import { randomUUID } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, parse, resolve } from "node:path";

import type { WorkbenchProcessLauncher, WorkbookImportReceipt } from "./workbench-launcher.js";

const MAX_WORKBOOK_BYTES = 50 * 1024 * 1024;

interface WorkbookImportInput {
  readonly sessionId: string;
  readonly workbookPath: string;
}

interface WorkbookFileStat {
  isFile(): boolean;
  isSymbolicLink(): boolean;
  readonly size: number;
  readonly dev?: number;
  readonly ino?: number;
}

interface WorkbookFileHandle {
  stat(): Promise<WorkbookFileStat>;
  readFile(): Promise<Uint8Array>;
  close(): Promise<void>;
}

export interface WorkbookImportDependencies {
  readonly lstat: (path: string) => Promise<WorkbookFileStat>;
  readonly realpath: (path: string) => Promise<string>;
  readonly openFile: (path: string) => Promise<WorkbookFileHandle>;
  readonly requestId: () => string;
}

const defaultDependencies: WorkbookImportDependencies = {
  lstat: (path) => lstat(path),
  realpath: (path) => realpath(path),
  openFile: (path) => open(path, "r"),
  requestId: randomUUID,
};

export async function importWorkbook(input: WorkbookImportInput, process: WorkbenchProcessLauncher, dependencies: WorkbookImportDependencies = defaultDependencies): Promise<WorkbookImportReceipt> {
  if (process.importWorkbook === undefined) throw safeImportError("host_import_unavailable");
  if (!isAbsolute(input.workbookPath) || extname(input.workbookPath).toLowerCase() !== ".xlsx") throw safeImportError("workbook_path_rejected");
  const resolvedWorkbookPath = resolve(input.workbookPath);

  let stats: WorkbookFileStat;
  try {
    stats = await dependencies.lstat(input.workbookPath);
  } catch {
    throw safeImportError("workbook_path_unavailable");
  }

  if (!stats.isFile()) throw safeImportError("workbook_file_required");
  if (stats.isSymbolicLink()) throw safeImportError("workbook_symlink_rejected");
  if (stats.size <= 0 || stats.size > MAX_WORKBOOK_BYTES) throw safeImportError("workbook_size_rejected", 413);
  await rejectSymlinkAncestry(resolvedWorkbookPath, dependencies);

  let realWorkbookPath: string;
  try {
    realWorkbookPath = await dependencies.realpath(input.workbookPath);
  } catch {
    throw safeImportError("workbook_path_unavailable");
  }
  if (normalizePhysicalPath(realWorkbookPath) !== normalizePhysicalPath(resolvedWorkbookPath)) {
    throw safeImportError("workbook_identity_rejected");
  }

  const bytes = await readValidatedWorkbookBytes(input.workbookPath, resolvedWorkbookPath, stats, realWorkbookPath, dependencies);
  if (bytes.length <= 0 || bytes.length > MAX_WORKBOOK_BYTES) throw safeImportError("workbook_size_rejected", 413);

  return process.importWorkbook({ requestId: dependencies.requestId(), sessionId: input.sessionId, fileName: basename(input.workbookPath), bytes });
}

async function rejectSymlinkAncestry(resolvedWorkbookPath: string, dependencies: Pick<WorkbookImportDependencies, "lstat">): Promise<void> {
  const root = parse(resolvedWorkbookPath).root;
  let current = dirname(resolvedWorkbookPath);
  while (normalizePhysicalPath(current) !== normalizePhysicalPath(root)) {
    let stats: WorkbookFileStat;
    try {
      stats = await dependencies.lstat(current);
    } catch {
      throw safeImportError("workbook_path_unavailable");
    }
    if (stats.isSymbolicLink()) throw safeImportError("workbook_symlink_rejected");
    current = dirname(current);
  }
}

async function readValidatedWorkbookBytes(
  workbookPath: string,
  resolvedWorkbookPath: string,
  validatedStats: WorkbookFileStat,
  validatedRealPath: string,
  dependencies: Pick<WorkbookImportDependencies, "openFile" | "realpath">,
): Promise<Uint8Array> {
  let handle: WorkbookFileHandle | undefined;
  let pendingError: unknown;
  let bytes: Uint8Array | undefined;

  try {
    handle = await dependencies.openFile(workbookPath);
    const openedStats = await handle.stat();
    if (!openedStats.isFile() || openedStats.isSymbolicLink()) throw safeImportError("workbook_file_required");
    if (!isSamePhysicalFile(validatedStats, openedStats)) throw safeImportError("workbook_identity_rejected");

    const reopenedRealPath = await dependencies.realpath(workbookPath);
    if (normalizePhysicalPath(reopenedRealPath) !== normalizePhysicalPath(validatedRealPath) || normalizePhysicalPath(reopenedRealPath) !== normalizePhysicalPath(resolvedWorkbookPath)) {
      throw safeImportError("workbook_identity_rejected");
    }

    bytes = new Uint8Array(await handle.readFile());
  } catch (error) {
    pendingError = isSafeImportError(error) ? error : safeImportError("workbook_read_rejected");
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        pendingError ??= safeImportError("workbook_read_rejected");
      }
    }
  }

  if (pendingError !== undefined) throw pendingError;
  return bytes ?? new Uint8Array();
}

function isSamePhysicalFile(left: WorkbookFileStat, right: WorkbookFileStat): boolean {
  if (typeof left.dev !== "number" || typeof left.ino !== "number" || typeof right.dev !== "number" || typeof right.ino !== "number") {
    return false;
  }
  return left.dev === right.dev && left.ino === right.ino;
}

function normalizePhysicalPath(value: string): string {
  const resolved = resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isSafeImportError(error: unknown): error is Error {
  return error instanceof Error && "affectedInputReferences" in error;
}

function safeImportError(reference: string, statusCode = 400): Error {
  return Object.assign(new Error("Workbook import rejected."), {
    code: statusCode === 413 ? "policy_denied" : "validation_error",
    summary: "Workbook import rejected.",
    suggestedAction: "Provide an existing non-symlink .xlsx workbook file.",
    affectedInputReferences: [reference],
    statusCode,
  });
}