import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { typedErrorSchema, workbookCatalogResultSchema } from "@ai-assist/contracts";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { createWorkbookCatalog } from "./workbook-catalog.js";

const readerInstrumentation = vi.hoisted(() => ({
  hashComputed: false,
  assertHashBeforeRead: false,
  throwOnHashDigest: false,
  readerCalled: false,
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    createHash(...arguments_: Parameters<typeof actual.createHash>) {
      const hash = actual.createHash(...arguments_);
      return new Proxy(hash, {
        get(target, property, receiver) {
          if (property === "digest") {
            return (...arguments_: Parameters<typeof hash.digest>) => {
              if (readerInstrumentation.throwOnHashDigest) {
                throw new Error("hash-private-marker");
              }
              readerInstrumentation.hashComputed = true;
              return target.digest(...arguments_);
            };
          }
          return Reflect.get(target, property, receiver);
        },
      });
    },
  };
});

vi.mock("./ooxml-reader.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ooxml-reader.js")>();
  return {
    ...actual,
    readOoxmlWorkbook(...arguments_: Parameters<typeof actual.readOoxmlWorkbook>) {
      readerInstrumentation.readerCalled = true;
      if (readerInstrumentation.assertHashBeforeRead && !readerInstrumentation.hashComputed) {
        throw new Error("hash was not computed before the reader");
      }
      return actual.readOoxmlWorkbook(...arguments_);
    },
  };
});

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const MARKER = "anonymous-private-marker";

function worksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

function cell(reference: string, value: string, formula?: string): string {
  return `<c r="${reference}">${formula ? `<f>${formula}</f>` : ""}<v>${value}</v></c>`;
}

function catalogWorkbook(options: {
  readonly dateValue?: string;
  readonly dateFormula?: string;
  readonly dateCache?: boolean;
  readonly titlePage?: boolean;
  readonly autoSummary?: boolean;
  readonly titleRows?: string;
  readonly headers?: "valid" | "missing" | "duplicate";
  readonly description?: string;
  readonly analysisName?: string;
  readonly secondAnalysisName?: string;
  readonly summaryAnalysisName?: string;
  readonly summarySecondAnalysisName?: string;
  readonly emptySummary?: boolean;
  readonly partialSummary?: boolean;
  readonly malformedSecondWorksheet?: boolean;
} = {}): Uint8Array {
  const dateFormula = options.dateFormula;
  const dateCache = options.dateCache === false ? "" : `<v>${options.dateValue ?? "2026-07-23"}</v>`;
  const title = options.titlePage === false ? "Cover" : "Title Page";
  const summary = options.autoSummary === false ? "Summary" : "Auto Summary";
  const headers = options.headers ?? "valid";
  const headerCells = headers === "missing"
    ? `${cell("A9", "Device Level Dim")}`
    : headers === "duplicate"
      ? `${cell("A9", "Device Level Dim")}${cell("B9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}`
      : `${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}${cell("D9", "Cpk")}${cell("E9", "Pass/Fail")}${cell("F9", "Milestone")}`;
  const analysisName = options.analysisName ?? "Analysis-A";
  const secondAnalysisName = options.secondAnalysisName ?? "Analysis-B";
  const summaryAnalysisName = options.summaryAnalysisName ?? analysisName;
  const summarySecondAnalysisName = options.summarySecondAnalysisName ?? secondAnalysisName;
  const titleRows = options.titleRows ?? `<row r="2">${cell("A2", " Document   No. ")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}<c r="B6">${dateFormula ? `<f>${dateFormula}</f>` : ""}${dateCache}</c></row>`;
  const summaryRows = options.emptySummary
    ? `<row r="9">${headerCells}</row>`
    : `<row r="9">${headerCells}</row><row r="10">${cell("A10", summaryAnalysisName)}${cell("C10", options.description ?? "First tolerance loop")}${cell("D10", "0.1")}${cell("E10", "Fail")}${cell("F10", "anonymous-status-marker")}</row>${options.partialSummary ? "" : `<row r="11">${cell("A11", summarySecondAnalysisName)}${cell("C11", "Second tolerance loop")}${cell("D11", "9.9")}${cell("E11", "Pass")}${cell("F11", "anonymous-milestone-marker")}</row>`}`;
  const workbookXml = `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${title}" sheetId="1" r:id="rId1"/><sheet name="${summary}" sheetId="2" r:id="rId2"/><sheet name="${analysisName}" sheetId="3" r:id="rId3"/><sheet name="${secondAnalysisName}" sheetId="4" r:id="rId4"/></sheets></workbook>`;
  return createAnonymousWorkbookZip({ xmlParts: {
    "xl/workbook.xml": workbookXml,
    "xl/worksheets/sheet1.xml": worksheet(titleRows),
    "xl/worksheets/sheet2.xml": worksheet(summaryRows),
    ...(options.emptySummary ? {
      "xl/worksheets/sheet3.xml": worksheet(`<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Scanned tolerance loop")}</row><row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("L13", "Design Nominal")}</row><row r="14">${cell("G14", "Scanned factor")}${cell("L14", "1")}</row>`),
    } : {}),
    ...(options.partialSummary ? {
      "xl/worksheets/sheet4.xml": worksheet(`<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Second scanned tolerance loop")}</row><row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("L13", "Design Nominal")}</row><row r="14">${cell("G14", "Scanned factor")}${cell("L14", "1")}</row>`),
    } : {}),
    ...(options.malformedSecondWorksheet ? {
      "xl/worksheets/sheet4.xml": worksheet('<row r="3"><c><v>unrelated</v></c></row>'),
    } : {}),
  } });
}

function request(workbookBytes = catalogWorkbook()): unknown {
  return { contractVersion: "v1", fileName: "anonymous-ta.xlsx", inputClassification: "confidential", workbookBytes };
}

function expectCatalogError(action: () => unknown, code = "validation_error", summary = "Workbook-catalog request is invalid.", reference = "workbook-request"): void {
  try {
    action();
  } catch (error) {
    expect(typedErrorSchema.safeParse(error).success).toBe(true);
    expect(error).toMatchObject({ code, summary, affectedInputReferences: [reference] });
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen((error as { affectedInputReferences: unknown }).affectedInputReferences)).toBe(true);
    expect(JSON.stringify(error)).not.toContain(MARKER);
    return;
  }
  throw new Error("Expected workbook catalog error.");
}

describe("workbook catalog", () => {
  it("exports createWorkbookCatalog from the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        'import { createWorkbookCatalog } from "@ai-assist/workbook-catalog"; process.stdout.write(typeof createWorkbookCatalog);',
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output).toBe("function");
  });

  it("catalogs all populated Auto Summary rows without inspecting status fields", () => {
    const workbookBytes = catalogWorkbook({ dateFormula: "TODAY()" });
    const result = createWorkbookCatalog(request(workbookBytes));

    expect(result.workbook.metadata).toEqual({ documentNo: "DOC-007", revision: "R2", date: { value: "2026-07-23", formula: "=TODAY()", sourceCell: "Title Page!B6" } });
    expect(result.workbook.contentHash).toBe(createHash("sha256").update(workbookBytes).digest("hex"));
    expect(result.analyses).toEqual([
      { worksheetName: "Analysis-A", toleranceLoopDescription: "First tolerance loop", source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" } },
      { worksheetName: "Analysis-B", toleranceLoopDescription: "Second tolerance loop", source: { summarySheet: "Auto Summary", summaryRow: 11, worksheetAnchor: "Analysis-B!A1" } },
    ]);
    expect(workbookCatalogResultSchema.safeParse(result).success).toBe(true);
  });

  it("records every workbook worksheet without widening the TA analysis list", () => {
    const result = createWorkbookCatalog(request(catalogWorkbook()));

    expect(result.workbook.worksheetInventory).toEqual([
      { worksheetName: "Title Page", worksheetIndex: 0, visibility: "visible", worksheetKind: "title_page", isTaAnalysis: false, sourcePart: "xl/worksheets/sheet1.xml" },
      { worksheetName: "Auto Summary", worksheetIndex: 1, visibility: "visible", worksheetKind: "summary", isTaAnalysis: false, sourcePart: "xl/worksheets/sheet2.xml" },
      { worksheetName: "Analysis-A", worksheetIndex: 2, visibility: "visible", worksheetKind: "analysis", isTaAnalysis: true, sourcePart: "xl/worksheets/sheet3.xml" },
      { worksheetName: "Analysis-B", worksheetIndex: 3, visibility: "visible", worksheetKind: "analysis", isTaAnalysis: true, sourcePart: "xl/worksheets/sheet4.xml" },
    ]);
    expect(result.analyses.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
  });

  it("scans supported TA worksheets when Auto Summary has no analysis rows", () => {
    const result = createWorkbookCatalog(request(catalogWorkbook({ emptySummary: true })));

    expect(result.analyses).toEqual([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Scanned tolerance loop",
        source: {
          discoveryMethod: "worksheet_scan",
          descriptionCell: "Analysis-A!H11",
          worksheetAnchor: "Analysis-A!A1",
        },
      },
    ]);
  });

  it("skips malformed unrelated worksheets while scanning for TA worksheets", () => {
    const result = createWorkbookCatalog(request(catalogWorkbook({
      emptySummary: true,
      malformedSecondWorksheet: true,
    })));

    expect(result.analyses.map((analysis) => analysis.worksheetName)).toEqual(["Analysis-A"]);
  });

  it("adds supported TA worksheets omitted from a partially populated Auto Summary", () => {
    const result = createWorkbookCatalog(request(catalogWorkbook({ partialSummary: true })));

    expect(result.analyses).toEqual([
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "First tolerance loop",
        source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
      },
      {
        worksheetName: "Analysis-B",
        toleranceLoopDescription: "Second scanned tolerance loop",
        source: {
          discoveryMethod: "worksheet_scan",
          descriptionCell: "Analysis-B!H11",
          worksheetAnchor: "Analysis-B!A1",
        },
      },
    ]);
  });

  it("accepts Title Page metadata labels with optional trailing colons", () => {
    const workbookBytes = catalogWorkbook({
      titleRows: `<row r="2">${cell("A2", "Document No.:")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date")}${cell("B6", "2026-07-23")}</row>`,
    });
    const result = createWorkbookCatalog(request(workbookBytes));

    expect(result.workbook.metadata).toEqual({
      documentNo: "DOC-007",
      revision: "R2",
      date: { value: "2026-07-23", sourceCell: "Title Page!B6" },
    });
  });

  it.each([
    ["ISO", "2026-07-23"],
    ["Excel serial", "46226"],
    ["parseable text", "July 23, 2026 00:00:00 UTC"],
  ])("normalizes a fixed %s date", (_kind, dateValue) => {
    const result = createWorkbookCatalog(request(catalogWorkbook({ dateValue })));
    expect(result.workbook.metadata.date).toEqual({ value: "2026-07-23", sourceCell: "Title Page!B6" });
  });

  it("computes the raw byte hash before invoking the OOXML reader", () => {
    readerInstrumentation.hashComputed = false;
    readerInstrumentation.assertHashBeforeRead = true;
    try {
      expect(createWorkbookCatalog(request()).workbook.contentHash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      readerInstrumentation.assertHashBeforeRead = false;
    }
  });

  it("normalizes a hash failure after request validation before reader execution", () => {
    const rawMarker = "hash-private-marker";
    readerInstrumentation.readerCalled = false;
    readerInstrumentation.throwOnHashDigest = true;
    try {
      try {
        createWorkbookCatalog(request());
      } catch (error) {
        expect(typedErrorSchema.safeParse(error).success).toBe(true);
        expect(error).toMatchObject({
          code: "validation_error",
          summary: "Workbook-catalog request is invalid.",
          affectedInputReferences: ["workbook-request"],
        });
        expect(Object.isFrozen(error)).toBe(true);
        expect(Object.isFrozen((error as { affectedInputReferences: unknown }).affectedInputReferences)).toBe(true);
        expect((error as { affectedInputReferences: string[] }).affectedInputReferences).toEqual(["workbook-request"]);
        expect(error.message).not.toContain(rawMarker);
        expect(JSON.stringify(error)).not.toContain(rawMarker);
        expect(readerInstrumentation.readerCalled).toBe(false);
        return;
      }
      throw new Error("Expected workbook catalog error.");
    } finally {
      readerInstrumentation.throwOnHashDigest = false;
    }
  });

  it("requires a cached date value for formulas", () => {
    expectCatalogError(() => createWorkbookCatalog(request(catalogWorkbook({ dateFormula: "TODAY()", dateCache: false }))), "validation_error", "Workbook-catalog request is invalid.", "title-page");
  });

  it.each([
    ["Title Page", catalogWorkbook({ titlePage: false }), "title-page"],
    ["Auto Summary", catalogWorkbook({ autoSummary: false }), "auto-summary"],
    ["missing header", catalogWorkbook({ headers: "missing" }), "auto-summary"],
    ["duplicate header", catalogWorkbook({ headers: "duplicate" }), "auto-summary"],
    ["empty description", catalogWorkbook({ description: "" }), "auto-summary"],
    ["duplicate worksheet", catalogWorkbook({ summarySecondAnalysisName: "Analysis-A" }), "auto-summary"],
    ["missing worksheet", catalogWorkbook({ summaryAnalysisName: "Not-A-Worksheet" }), "auto-summary"],
  ])("rejects invalid %s structure without leaking workbook data", (_case, workbookBytes, reference) => {
    expectCatalogError(() => createWorkbookCatalog(request(workbookBytes)), "validation_error", "Workbook-catalog request is invalid.", reference);
  });

  it.each([
    ["missing Document No.", `<row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`],
    ["duplicate Document No.", `<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}${cell("C2", "Document No.")}${cell("D2", "DOC-008")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`],
    ["Document No. without a populated right-hand cell", `<row r="2">${cell("A2", "Document No.")}${cell("B2", " ")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`],
    ["missing Revision", `<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`],
    ["duplicate Revision", `<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}${cell("C4", "Revision:")}${cell("D4", "R3")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`],
    ["Revision without a populated right-hand cell", `<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", " ")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`],
    ["missing Date", `<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row>`],
    ["duplicate Date", `<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}${cell("C6", "Date:")}${cell("D6", "2026-07-24")}</row>`],
    ["Date without a populated right-hand cell", `<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", " ")}</row>`],
  ])("rejects %s with the request-invalid Title Page error", (_case, titleRows) => {
    expectCatalogError(() => createWorkbookCatalog(request(catalogWorkbook({ titleRows }))), "validation_error", "Workbook-catalog request is invalid.", "title-page");
  });

  it("reads a fixed shared-string Title Page date", () => {
    const result = createWorkbookCatalog(request(createAnonymousWorkbookZip({ xmlParts: {
      "xl/sharedStrings.xml": `<?xml version="1.0"?><sst xmlns="${NS}"><si><t>Document No.</t></si><si><t>DOC-007</t></si><si><t>Revision:</t></si><si><t>R2</t></si><si><t>Date:</t></si><si><t>2026-07-23</t></si><si><t>Device Level Dim</t></si><si><t>Tolerance Loop Description</t></si><si><t>Analysis-A</t></si><si><t>First tolerance loop</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c></row><row r="4"><c r="A4" t="s"><v>2</v></c><c r="B4" t="s"><v>3</v></c></row><row r="6"><c r="A6" t="s"><v>4</v></c><c r="B6" t="s"><v>5</v></c></row></sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData><row r="9"><c r="A9" t="s"><v>6</v></c><c r="C9" t="s"><v>7</v></c></row><row r="10"><c r="A10" t="s"><v>8</v></c><c r="C10" t="s"><v>9</v></c></row></sheetData></worksheet>`,
    } })));
    expect(result.workbook.metadata.date).toEqual({ value: "2026-07-23", sourceCell: "Title Page!B6" });
  });

  it("normalizes a final output schema failure without leaking a bad worksheet name", () => {
    const marker = "Invalid!Anchor";
    expectCatalogError(() => createWorkbookCatalog(request(catalogWorkbook({ analysisName: marker }))), "validation_error", "Workbook-catalog request is invalid.", "auto-summary");
    try {
      createWorkbookCatalog(request(catalogWorkbook({ analysisName: marker })));
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(marker);
    }
  });

  it("safely rejects unknown and proxy requests", () => {
    expectCatalogError(() => createWorkbookCatalog({ private: MARKER }));
    expectCatalogError(() => createWorkbookCatalog(new Proxy({}, { get() { throw new Error(MARKER); } })));
  });

  it("retains only the frozen safe archive error when the reader rejects workbook bytes", () => {
    const marker = "reader-private-marker";
    const archive = createAnonymousWorkbookZip({ xmlParts: {
      "xl/workbook.xml": `<workbook><${marker}></workbook>`,
    } });
    expectCatalogError(() => createWorkbookCatalog(request(archive)), "validation_error", "Workbook-catalog archive cannot be processed.", "workbook-structure");
    try {
      createWorkbookCatalog(request(archive));
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(marker);
    }
  });

  it("denies hostile non-confidential requests before reading workbookBytes", () => {
    let bytesRead = false;
    const hostile = { contractVersion: "v1", fileName: "anonymous-ta.xlsx", inputClassification: "public" };
    Object.defineProperty(hostile, "workbookBytes", { get() { bytesRead = true; throw new Error(MARKER); } });

    expectCatalogError(() => createWorkbookCatalog(hostile), "policy_denied", "Workbook-catalog input is not permitted.", "workbook-request");
    expect(bytesRead).toBe(false);
  });

  it("returns a frozen clone that cannot affect later calls", () => {
    const first = createWorkbookCatalog(request());
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.workbook)).toBe(true);
    expect(Object.isFrozen(first.workbook.metadata)).toBe(true);
    expect(Object.isFrozen(first.workbook.metadata.date)).toBe(true);
    expect(Object.isFrozen(first.analyses)).toBe(true);
    expect(Object.isFrozen(first.analyses[0]!)).toBe(true);
    expect(Object.isFrozen(first.analyses[0]!.source)).toBe(true);
    expect(() => { (first.analyses as unknown as { push: (value: unknown) => void }).push(MARKER); }).toThrow();

    const second = createWorkbookCatalog(request());
    expect(second.analyses).toHaveLength(2);
    expect(second).not.toBe(first);
  });
});