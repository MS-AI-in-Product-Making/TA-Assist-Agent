import { describe, expect, it, vi } from "vitest";

import { importWorkbook, type WorkbookImportDependencies } from "./workbook-import.js";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";
const WORKBOOK_PATH = "C:\\TA Reports\\report.xlsx";
const WORKBOOK_BYTES = new Uint8Array([80, 75, 3, 4]);

function fileStats(input: { readonly file?: boolean; readonly symlink?: boolean; readonly size?: number }) {
  return {
    isFile: () => input.file ?? true,
    isSymbolicLink: () => input.symlink ?? false,
    size: input.size ?? WORKBOOK_BYTES.length,
    dev: 1,
    ino: 100,
  };
}

function workbookHandle(input: { readonly stats?: ReturnType<typeof fileStats>; readonly bytes?: Uint8Array; readonly readError?: Error } = {}) {
  return {
    stat: vi.fn(async () => input.stats ?? fileStats({})),
    readFile: vi.fn(async () => {
      if (input.readError !== undefined) throw input.readError;
      return Buffer.from(input.bytes ?? WORKBOOK_BYTES);
    }),
    close: vi.fn(async () => undefined),
  };
}

function dependencies(overrides: Partial<WorkbookImportDependencies> = {}): WorkbookImportDependencies {
  return {
    lstat: vi.fn(async () => fileStats({})),
    realpath: vi.fn(async () => WORKBOOK_PATH),
    openFile: vi.fn(async () => workbookHandle()),
    requestId: () => "import-request-1",
    ...overrides,
  };
}

describe("importWorkbook", () => {
  it("validates an explicit absolute xlsx path and sends only filename plus bytes over the launcher", async () => {
    const process = { launch: vi.fn(), importWorkbook: vi.fn(async () => ({ artifactId: "artifact-1", contentHash: "a".repeat(64), snapshotRevision: 1, state: "f0_validating" })) };

    const receipt = await importWorkbook({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, process, dependencies());

    expect(receipt).toMatchObject({ artifactId: "artifact-1", state: "f0_validating" });
    expect(process.importWorkbook).toHaveBeenCalledWith({
      requestId: "import-request-1",
      sessionId: SESSION_ID,
      fileName: "report.xlsx",
      bytes: WORKBOOK_BYTES,
    });
    expect(JSON.stringify(process.importWorkbook.mock.calls)).not.toContain("TA Reports");
    expect(JSON.stringify(process.importWorkbook.mock.calls)).not.toContain(WORKBOOK_PATH);
  });

  it("rejects a different inode opened after validation without leaking the path", async () => {
    const process = { launch: vi.fn(), importWorkbook: vi.fn() };
    const handle = workbookHandle({ stats: { ...fileStats({}), ino: 200 } });

    await expect(importWorkbook({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, process, dependencies({ openFile: vi.fn(async () => handle) }))).rejects.toSatisfy((error: unknown) => {
      const text = JSON.stringify(error);
      return text.includes("Workbook import rejected.") && !text.includes("TA Reports") && !text.includes(WORKBOOK_PATH);
    });

    expect(handle.readFile).not.toHaveBeenCalled();
    expect(handle.close).toHaveBeenCalledTimes(1);
    expect(process.importWorkbook).not.toHaveBeenCalled();
  });

  it("rejects a symlink target introduced before handle read without leaking the path", async () => {
    const process = { launch: vi.fn(), importWorkbook: vi.fn() };
    const handle = workbookHandle();
    const realpath = vi.fn(async () => realpath.mock.calls.length === 1 ? WORKBOOK_PATH : "C:\\secret\\report.xlsx");

    await expect(importWorkbook({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, process, dependencies({ realpath, openFile: vi.fn(async () => handle) }))).rejects.toSatisfy((error: unknown) => {
      const text = JSON.stringify(error);
      return text.includes("Workbook import rejected.") && !text.includes("TA Reports") && !text.includes(WORKBOOK_PATH);
    });

    expect(handle.readFile).not.toHaveBeenCalled();
    expect(handle.close).toHaveBeenCalledTimes(1);
    expect(process.importWorkbook).not.toHaveBeenCalled();
  });

  it("rejects symlink ancestors before opening the workbook without leaking the path", async () => {
    const process = { launch: vi.fn(), importWorkbook: vi.fn() };
    const openFile = vi.fn(async () => workbookHandle());

    await expect(importWorkbook({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, process, dependencies({
      lstat: vi.fn(async (path: string) => fileStats({ symlink: path === "C:\\TA Reports" })),
      openFile,
    }))).rejects.toSatisfy((error: unknown) => {
      const text = JSON.stringify(error);
      return text.includes("Workbook import rejected.") && !text.includes("TA Reports") && !text.includes(WORKBOOK_PATH);
    });

    expect(openFile).not.toHaveBeenCalled();
    expect(process.importWorkbook).not.toHaveBeenCalled();
  });

  it("reads workbook bytes from the same validated handle", async () => {
    const process = { launch: vi.fn(), importWorkbook: vi.fn(async () => ({ artifactId: "artifact-1", contentHash: "a".repeat(64), snapshotRevision: 1, state: "f0_validating" })) };
    const handle = workbookHandle({ bytes: new Uint8Array([80, 75, 3, 4, 42]) });

    await importWorkbook({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, process, dependencies({ openFile: vi.fn(async () => handle) }));

    expect(handle.readFile).toHaveBeenCalledTimes(1);
    expect(handle.close).toHaveBeenCalledTimes(1);
    expect(process.importWorkbook).toHaveBeenCalledWith(expect.objectContaining({ bytes: new Uint8Array([80, 75, 3, 4, 42]) }));
  });

  it.each([
    ["missing", { lstat: vi.fn(async () => { throw Object.assign(new Error("ENOENT C:\\secret\\missing.xlsx"), { code: "ENOENT" }); }) }],
    ["directory", { lstat: vi.fn(async () => fileStats({ file: false })) }],
    ["symlink", { lstat: vi.fn(async () => fileStats({ symlink: true })) }],
    ["realpath alias", { realpath: vi.fn(async () => "C:\\TA Reports\\other.xlsx") }],
    ["oversized", { lstat: vi.fn(async () => fileStats({ size: 50 * 1024 * 1024 + 1 })) }],
  ])("rejects %s workbook paths without leaking the path", async (_name, override) => {
    const process = { launch: vi.fn(), importWorkbook: vi.fn() };

    await expect(importWorkbook({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, process, dependencies(override))).rejects.toSatisfy((error: unknown) => {
      const text = JSON.stringify(error);
      return !text.includes("TA Reports") && !text.includes(WORKBOOK_PATH);
    });
    expect(process.importWorkbook).not.toHaveBeenCalled();
  });

  it.each([
    ["realpath failure", { realpath: vi.fn(async () => { throw new Error("EPERM C:\\TA Reports\\report.xlsx"); }) }],
    ["read failure", { openFile: vi.fn(async () => workbookHandle({ readError: new Error("EACCES C:\\TA Reports\\report.xlsx") })) }],
  ])("sanitizes %s after preflight validation", async (_name, override) => {
    const process = { launch: vi.fn(), importWorkbook: vi.fn() };

    await expect(importWorkbook({ sessionId: SESSION_ID, workbookPath: WORKBOOK_PATH }, process, dependencies(override))).rejects.toSatisfy((error: unknown) => {
      const text = JSON.stringify(error);
      return text.includes("Workbook import rejected.") && !text.includes("TA Reports") && !text.includes(WORKBOOK_PATH);
    });

    expect(process.importWorkbook).not.toHaveBeenCalled();
  });

  it("rejects non-xlsx paths before reading bytes", async () => {
    const process = { launch: vi.fn(), importWorkbook: vi.fn() };
    const deps = dependencies({ openFile: vi.fn(async () => workbookHandle()) });

    await expect(importWorkbook({ sessionId: SESSION_ID, workbookPath: "C:\\TA Reports\\report.xlsm" }, process, deps)).rejects.toMatchObject({ code: "validation_error" });

    expect(deps.openFile).not.toHaveBeenCalled();
    expect(process.importWorkbook).not.toHaveBeenCalled();
  });
});