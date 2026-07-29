import { createHash } from "node:crypto";
import * as xlsx from "xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  importCapabilityMatrix,
  type ApprovedCapabilityMatrixSource,
} from "./import-capability-matrices.js";
import * as publicApi from "../index.js";
import { typedErrorSchema } from "@ai-assist/contracts";
import { contentHash, createInternalKnowledgeSnapshot } from "./validation.js";
import { createReviewedInternalV1SeedPackage } from "./data/internal-v1.js";

const approvedSources = vi.hoisted(() => new Map<string, ApprovedCapabilityMatrixSource>());

vi.mock("./data/approved-capability-sources.js", () => ({
  getApprovedCapabilityMatrixSource: (sourceId: string) => approvedSources.get(sourceId),
}));

const headers = [
  "Process",
  "Feature Type",
  "Nominal Min (mm)",
  "Nominal Max (mm)",
  "Maximum Recommended Total Band (mm)",
  "Material",
  "Fallback Entry ID",
];

function workbookBytes(
  rows: unknown[][],
  options?: {
    mergeDataCell?: boolean;
    bookType?: "biff8" | "xlsx";
    cellOverrides?: Readonly<Record<string, xlsx.CellObject>>;
  },
): Uint8Array {
  const sheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
  if (options?.mergeDataCell) sheet["!merges"] = [xlsx.utils.decode_range("A2:B2")];
  Object.assign(sheet, options?.cellOverrides);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, "Capabilities");
  return new Uint8Array(xlsx.write(workbook, { type: "array", bookType: options?.bookType ?? "xlsx" }));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function approvedSource(bytes: Uint8Array, sourceFile = "controlled-cnc-matrix.xlsx"): ApprovedCapabilityMatrixSource {
  return {
    sourceId: "approved-cnc-matrix",
    sourceFile,
    sourceFileHash: sha256(bytes),
    sourceVersion: "2026-q3",
    sheetName: "Capabilities",
    classification: "internal",
    entryIdPrefix: "approved-cnc",
    owner: "internal-knowledge-steward",
    confidence: 0.8,
    effectiveVersion: "internal-v1",
    capabilityTier: "T2",
    changeSummary: "Approved controlled matrix import.",
  };
}

function approveSource(bytes: Uint8Array, sourceFile?: string): void {
  const source = approvedSource(bytes, sourceFile);
  approvedSources.set(source.sourceId, source);
}

describe("importCapabilityMatrix", () => {
  beforeEach(() => {
    approvedSources.clear();
  });

  it.each([
    null,
    "not-an-object",
    {},
    { sourceId: 1, workbookBytes: new Uint8Array([1]) },
    { sourceId: "approved-cnc-matrix" },
    { sourceId: "approved-cnc-matrix", workbookBytes: [1] },
    { sourceId: "approved-cnc-matrix", workbookBytes: new Uint8Array([1]), extra: true },
  ])("rejects malformed request input without exposing raw details: %j", (request) => {
    let error: unknown;
    try {
      importCapabilityMatrix(request);
    } catch (caught) {
      error = caught;
    }

    expect(typedErrorSchema.safeParse(error)).toMatchObject({ success: true });
    expect(error).toMatchObject({
      code: "validation_error",
      summary: "Capability matrix import is invalid.",
      affectedInputReferences: ["capability-matrix-import"],
    });
  });

  it("imports an approved hashed in-memory workbook with derived source ranges", () => {
    const bytes = workbookBytes([["CNC", "hole-diameter", 5, 10, 0.2, "aluminum", "fallback-cnc-hole"]]);
    approveSource(bytes);

    expect(importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes })).toEqual({
      sources: [
        expect.objectContaining({ sourceId: "approved-cnc-matrix:row-2", sourceRange: "A2:G2" }),
      ],
      entries: [{
        entryId: "approved-cnc-2",
        processFamily: "cnc-machining",
        featureType: "hole-diameter",
        material: "aluminum",
        nominalRange: { min: 5, max: 10, unit: "mm" },
        maximumRecommendedTotalBand: { value: 0.2, unit: "mm" },
        fallbackPriority: 0,
        fallbackEntryId: "fallback-cnc-hole",
        capabilityTier: "T2",
        provenance: {
          sourceId: "approved-cnc-matrix:row-2",
          sourceFile: "controlled-cnc-matrix.xlsx",
          sourceFileHash: sha256(bytes),
          sourceVersion: "2026-q3",
          sheetName: "Capabilities",
          sourceRange: "A2:G2",
          classification: "internal",
          owner: "internal-knowledge-steward",
          confidence: 0.8,
          effectiveVersion: "internal-v1",
          changeSummary: "Approved controlled matrix import.",
        },
      }],
    });
  });

  it("rejects bytes paired with self-declared but unregistered source metadata", () => {
    const bytes = workbookBytes([["CNC", "hole-diameter", 5, 10, 0.2]]);

    expect(() => importCapabilityMatrix({ sourceId: "unregistered-cnc-matrix", workbookBytes: bytes }))
      .toThrowError(expect.objectContaining({ code: "validation_error" }));
  });

  it.each(["https://example.test/matrix.xlsx", "C:/controlled/matrix.xlsx", "..\\matrix.xlsx", "matrix\u0000.xlsx"])(
    "rejects an unsafe logical source filename %j",
    (sourceFile) => {
      const bytes = workbookBytes([["CNC", "hole-diameter", 5, 10, 0.2]]);
      approvedSources.set("approved-cnc-matrix", { ...approvedSource(bytes), sourceFile });

      expect(() => importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes })).toThrowError(
        expect.objectContaining({ code: "validation_error" }),
      );
    },
  );

  it("creates one matching source record per imported row for snapshot validation", () => {
    const bytes = workbookBytes([
      ["CNC", "hole-diameter", 5, 10, 0.2],
      ["CNC", "slot-width", 11, 20, 0.3],
    ]);
    approveSource(bytes);
    const result = importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes });
    const snapshot = createInternalKnowledgeSnapshot({
      manifest: {
        contractVersion: "v1",
        knowledgeBaseVersion: "internal-v1",
        classification: "internal",
        releasedAt: "2026-07-28",
        changeSummary: "Imported controlled matrix.",
        sourceCount: result.sources.length,
        entryCount: result.entries.length,
        sourcesContentHash: contentHash(result.sources),
        entriesContentHash: contentHash(result.entries),
      },
      sources: result.sources,
      entries: result.entries,
    });

    expect(snapshot.sources.map((source) => source.sourceId)).toEqual([
      "approved-cnc-matrix:row-2",
      "approved-cnc-matrix:row-3",
    ]);
    expect(snapshot.entries.map((entry) => entry.provenance.sourceRange)).toEqual(["A2:G2", "A3:G3"]);
  });

  it("accepts either optional header independently", () => {
    const sheet = xlsx.utils.aoa_to_sheet([
      [...headers.slice(0, 5), "Fallback Entry ID"],
      ["CNC", "hole-diameter", 5, 10, 0.2, "fallback-cnc-hole"],
    ]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, "Capabilities");
    const bytes = new Uint8Array(xlsx.write(workbook, { type: "array", bookType: "xlsx" }));
    approveSource(bytes);

    expect(importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes }).entries[0]).toMatchObject({
      fallbackEntryId: "fallback-cnc-hole",
      provenance: { sourceRange: "A2:F2" },
    });
  });

  it("imports optional condition columns into nested entry conditions", () => {
    const conditionHeaders = [
      ...headers,
      "Process Method",
      "Material Family",
      "Thickness Min (mm)",
      "Thickness Max (mm)",
      "Tolerance Grade",
      "Dimension Type",
    ];
    const sheet = xlsx.utils.aoa_to_sheet([
      conditionHeaders,
      ["Sheet Metal", "bend", 5, 10, 0.2, "carbon-steel", undefined, "formed", "steel", 0.8, 1.2, "TG6", "W"],
    ]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, "Capabilities");
    const bytes = new Uint8Array(xlsx.write(workbook, { type: "array", bookType: "xlsx" }));
    approveSource(bytes);

    expect(importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes }).entries[0])
      .toMatchObject({
        processFamily: "sheet-metal",
        conditions: {
          processMethod: "formed",
          materialFamily: "steel",
          thicknessMm: { min: 0.8, max: 1.2 },
          toleranceGrade: "TG6",
          dimensionType: "W",
        },
      });
  });

  it.each([
    ["Process Method", 7],
    ["Material Family", 8],
    ["Tolerance Grade", 11],
    ["Dimension Type", 12],
  ])("rejects a numeric nonblank %s condition cell", (_header, columnIndex) => {
    const conditionHeaders = [
      ...headers,
      "Process Method",
      "Material Family",
      "Thickness Min (mm)",
      "Thickness Max (mm)",
      "Tolerance Grade",
      "Dimension Type",
    ];
    const row = ["Sheet Metal", "bend", 5, 10, 0.2, "carbon-steel", undefined, "formed", "steel", 0.8, 1.2, "TG6", "W"];
    row[columnIndex] = 42;
    const sheet = xlsx.utils.aoa_to_sheet([conditionHeaders, row]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, "Capabilities");
    const bytes = new Uint8Array(xlsx.write(workbook, { type: "array", bookType: "xlsx" }));
    approveSource(bytes);

    expect(() => importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes })).toThrowError(
      expect.objectContaining({
        code: "validation_error",
        summary: "Capability matrix import is invalid.",
        affectedInputReferences: ["capability-matrix-import"],
      }),
    );
  });

  it("accepts blank optional string condition cells", () => {
    const conditionHeaders = [
      ...headers,
      "Process Method",
      "Material Family",
      "Tolerance Grade",
      "Dimension Type",
    ];
    const sheet = xlsx.utils.aoa_to_sheet([
      conditionHeaders,
      ["Sheet Metal", "bend", 5, 10, 0.2, "carbon-steel", undefined, "", "   ", "", "   "],
    ]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, "Capabilities");
    const bytes = new Uint8Array(xlsx.write(workbook, { type: "array", bookType: "xlsx" }));
    approveSource(bytes);

    expect(importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes }).entries[0])
      .not.toHaveProperty("conditions");
  });

  it.each([
    ["Material", 5, "F2", "numeric", { t: "n", v: 42 }],
    ["Material", 5, "F2", "boolean", { t: "b", v: true }],
    ["Material", 5, "F2", "object", { t: "s", v: { unexpected: true } }],
    ["Material", 5, "F2", "formula numeric", { t: "n", f: "21 * 2", v: 42 }],
    ["Fallback Entry ID", 6, "G2", "numeric", { t: "n", v: 42 }],
    ["Fallback Entry ID", 6, "G2", "boolean", { t: "b", v: true }],
    ["Fallback Entry ID", 6, "G2", "object", { t: "s", v: { unexpected: true } }],
    ["Fallback Entry ID", 6, "G2", "formula numeric", { t: "n", f: "21 * 2", v: 42 }],
  ] as const)("rejects a %s %s cell", (header, columnIndex, cellAddress, valueKind, cell) => {
    const baseRow = ["CNC", "hole-diameter", 5, 10, 0.2, "aluminum", "fallback-cnc-hole"];
    const row = [...baseRow];
    row[columnIndex] = undefined;
    const bytes = workbookBytes([row], { cellOverrides: { [cellAddress]: cell as xlsx.CellObject } });
    approveSource(bytes);
    const sheetToJson = valueKind === "object"
      ? vi.spyOn(xlsx.utils, "sheet_to_json").mockReturnValueOnce([headers, [...baseRow.slice(0, columnIndex), cell.v]])
      : undefined;

    expect(() => importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes })).toThrowError(
      expect.objectContaining({ code: "validation_error" }),
    );
    sheetToJson?.mockRestore();
  });

  it.each([
    ["Material", 5],
    ["Fallback Entry ID", 6],
  ] as const)("allows blank %s cells to omit the optional value", (header, columnIndex) => {
    const row = ["CNC", "hole-diameter", 5, 10, 0.2, "aluminum", "fallback-cnc-hole"];
    row[columnIndex] = "   ";
    const bytes = workbookBytes([row]);
    approveSource(bytes);

    expect(importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes }).entries[0])
      .not.toHaveProperty(header === "Material" ? "material" : "fallbackEntryId");
  });

  it.each([
    ["a mismatched source hash", (bytes: Uint8Array) => ({ ...approvedSource(bytes), sourceFileHash: "0".repeat(64) })],
    ["a source without a matching registry record", () => undefined],
  ])("rejects %s before parsing", (_name, sourceFactory) => {
    const bytes = workbookBytes([["CNC", "hole-diameter", 5, 10, 0.2]]);

    const source = sourceFactory(bytes);
    if (source === undefined) approveSource(bytes);
    else approvedSources.set(source.sourceId, source);
    const sourceId = source === undefined ? "unregistered-cnc-matrix" : source.sourceId;
    expect(() => importCapabilityMatrix({ sourceId, workbookBytes: bytes })).toThrowError(
      expect.objectContaining({ code: "validation_error" }),
    );
  });

  it.each([
    ["missing headers", ["CNC", "hole-diameter", 5, 10, 0.2], { headers: headers.slice(1) }],
    ["a duplicate header", ["CNC", "hole-diameter", 5, 10, 0.2], { headers: [...headers.slice(0, 5), headers[4]!] }],
    ["a merged data cell", ["CNC", "hole-diameter", 5, 10, 0.2], { mergeDataCell: true }],
    ["a blank threshold", ["CNC", "hole-diameter", 5, 10, ""], {}],
    ["a non-numeric nominal bound", ["CNC", "hole-diameter", "5 mm", 10, 0.2], {}],
    ["an explicit non-millimetre threshold", ["CNC", "hole-diameter", 5, 10, "0.2 in"], {}],
    ["an unsupported process", ["Laser", "hole-diameter", 5, 10, 0.2], {}],
  ])("rejects %s", (_name, row, options) => {
    const activeHeaders = "headers" in options ? options.headers! : headers;
    const sheet = xlsx.utils.aoa_to_sheet([activeHeaders, row]);
    if ("mergeDataCell" in options && options.mergeDataCell) sheet["!merges"] = [xlsx.utils.decode_range("A2:B2")];
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, "Capabilities");
    const bytes = new Uint8Array(xlsx.write(workbook, { type: "array", bookType: "xlsx" }));
    approveSource(bytes);

    expect(() => importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes })).toThrowError(
      expect.objectContaining({ code: "validation_error" }),
    );
  });

  it("imports a hashed approved legacy .xls workbook", () => {
    const bytes = workbookBytes([["CNC", "hole-diameter", 5, 10, 0.2]], { bookType: "biff8" });
    approveSource(bytes, "controlled-cnc-matrix.xls");

    expect(importCapabilityMatrix({ sourceId: "approved-cnc-matrix", workbookBytes: bytes }).entries).toHaveLength(1);
  });

  it("does not expose source registry construction or injection from the public index", () => {
    expect(publicApi).not.toHaveProperty("createApprovedCapabilityMatrixRegistry");
    expect(publicApi).not.toHaveProperty("approvedCapabilityMatrixRegistry");
    expect(() => importCapabilityMatrix({ sourceId: "unknown-source", workbookBytes: new Uint8Array([1]) }))
      .toThrowError(expect.objectContaining({ code: "validation_error" }));
  });

  it("provides the reviewed internal-v1 snapshot with one internal source record per published rule", () => {
    const snapshot = createReviewedInternalV1SeedPackage();

    expect(snapshot.manifest).toMatchObject({
      knowledgeBaseVersion: "internal-v1",
      classification: "internal",
      sourceCount: 110,
      entryCount: 110,
    });
    expect(snapshot.sources).toHaveLength(110);
    expect(snapshot.entries).toHaveLength(110);
    expect(snapshot.sources.every((source) => source.classification === "internal")).toBe(true);
    expect(snapshot.entries.every((entry) => entry.provenance.sourceId.startsWith("cnc-")
      || entry.provenance.sourceId.startsWith("dieCast-")
      || entry.provenance.sourceId.startsWith("dieCut-")
      || entry.provenance.sourceId.startsWith("pcbFpc-")
      || entry.provenance.sourceId.startsWith("plastic-")
      || entry.provenance.sourceId.startsWith("sheetMetal-"))).toBe(true);
  });
});