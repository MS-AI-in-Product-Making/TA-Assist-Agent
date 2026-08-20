import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { readOoxmlWorkbook } from "./ooxml-reader.js";
import {
  confirmF7FactorSetup,
  createF7WorkbookImport,
  extractF7FactorCandidates,
} from "./f7-excel-adapter.js";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const GOLDEN_CANDIDATE_IDS = [
  "4e091b2bc1d3f252875372c06f9491b7c71983e8843c47f4746200d57a7581de",
  "17892cab7485f4d5c377ccaa9582049e99cbb4688afde235c06151f2a367fb6a",
  "c95771a48c4c9a693d905be212e20aa9f853f09f760dd125af6aa4f88daae355",
  "246a2741cf227efd4e80c19782cca44e737e69fe8aa36dbde31e038b74add458",
  "20c3b2418809a2397ba87f9fb7765a8620e300fb98203271e766371de991b935",
  "1286a186be3d425406c173bc970efea7af7b862a21eb563cfb41d2fdc558847e",
  "5422b9c10f1f8f1b7881cc13d5097cae1b1733331137b6a0e03625298fc776f7",
] as const;
const GOLDEN_FACTOR_IDS = [
  "fd8e65042c8fb209f837a30bc414e3af6f574cd8360bf611d06dafa8e518ce64",
  "984ba1315bf2a06a3dc2fbf80c4bb827690a1fd7a2bd77ea2a2ef0629c9f356c",
  "2b304a0b6ecc8ea51e15f5682d507931313e2d7bd3c84b83758fcca27e959c38",
  "d58489e8363c5f24c4eb98ac109c416e9471f498b2d27cc00e88275e6f562d29",
  "0e1eb094555e880791a87bf150e388bbf36dc73bac65f400a6d6c456534b6dca",
  "8ed098e446829c251fc6acb4d92b5b73ec5e41894fae7a988cce2008e3a0978a",
  "107f10f16a722a307c32fde24a267e7082afcc9d013238fd78fd44a77b9ca8d5",
] as const;

function worksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

function cell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function formulaCell(reference: string, formula: string, cachedValue: string): string {
  return `<c r="${reference}" t="n"><f>${formula}</f><v>${cachedValue}</v></c>`;
}

function sheetRows(options: { readonly startRow?: number; readonly headerRow?: number; readonly distributionOverride?: string; readonly duplicateFactorHeader?: boolean; readonly includeUpperSpec?: boolean; readonly includeSecondFactorTable?: boolean; readonly markerInCell?: string; readonly formulaCachedInFirstFactor?: boolean; readonly specRowsXml?: string; readonly tailRowsXml?: string } = {}): string {
  const headerRow = options.headerRow ?? 13;
  const start = options.startRow ?? headerRow + 1;
  const factors = [
    ["Fabric thickness", "-0.57", "0.0125", "-1", "0.57"],
    ["C-cover height", "-1.94", "0.025", "-1", "1.94"],
    ["Shim thickness", "0.22", "0.0125", "+1", "0.22"],
    ["Switch height", "0.75", "0.025", "+1", "0.75"],
    ["TP PCB thickness", "0.44", "0.0125", "+1", "0.44"],
    ["HAF thickness", "0.05", "0.0125", "+1", "0.05"],
    ["Glass thickness", "1", "0.0125", "+1", "1"],
  ] as const;

  const header = `<row r="${headerRow}">${cell(`G${headerRow}`, "Factor Description (TA Loop)")}${cell(`L${headerRow}`, "Design Nominal")}${cell(`M${headerRow}`, "+ Tolerance")}${cell(`N${headerRow}`, "- Tolerance")}${cell(`O${headerRow}`, "Long Term/Safety Factor")}${cell(`P${headerRow}`, "Sigma level")}${cell(`Q${headerRow}`, "Distribution")}${cell(`R${headerRow}`, "Mean")}${cell(`S${headerRow}`, "Tolerance")}${cell(`T${headerRow}`, "1 Sigma")}${options.duplicateFactorHeader ? cell(`W${headerRow}`, "Factor Description (TA Loop)") : ""}</row>`;
  const dataRows = factors.map((factor, index) => {
    const row = start + index;
    const distribution = index === 0 && options.distributionOverride ? options.distributionOverride : "Normal";
    const meanCell = index === 0 && options.formulaCachedInFirstFactor
      ? formulaCell(`R${row}`, "ABS(-0.57)*-1", "-0.57")
      : cell(`R${row}`, factor[1]);
    const sigmaCell = index === 0 && options.formulaCachedInFirstFactor
      ? formulaCell(`T${row}`, "1/80", ".0125")
      : cell(`T${row}`, factor[2]);
    return `<row r="${row}">${cell(`G${row}`, index === 0 && options.markerInCell ? options.markerInCell : factor[0])}${cell(`L${row}`, "0")}${cell(`M${row}`, "0")}${cell(`N${row}`, "0")}${cell(`O${row}`, "1")}${cell(`P${row}`, "0")}${cell(`Q${row}`, distribution)}${meanCell}${cell(`S${row}`, factor[4])}${sigmaCell}</row>`;
  }).join("");

  const specRows = options.specRowsXml
    ?? `<row r="54">${cell("O54", "LSL")}${cell("P54", "-0.15")}</row><row r="55">${cell("O55", "USL")}${options.includeUpperSpec === false ? "" : cell("P55", "0.05")}</row>`;
  const secondHeader = options.includeSecondFactorTable
    ? `<row r="113">${cell("G113", "Factor Description (TA Loop)")}${cell("L113", "Design Nominal")}</row><row r="114">${cell("G114", "Other")}${cell("R114", "0.1")}${cell("Q114", "Normal")}${cell("T114", "0.01")}</row>`
    : "";

  return `<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Anonymous loop")}</row>${header}${dataRows}${specRows}${secondHeader}${options.tailRowsXml ?? ""}`;
}

function buildWorkbook(options: { readonly startRow?: number; readonly headerRow?: number; readonly distributionOverride?: string; readonly duplicateFactorHeader?: boolean; readonly includeUpperSpec?: boolean; readonly includeSecondWorksheet?: boolean; readonly includeSecondFactorTable?: boolean; readonly markerInCell?: string; readonly formulaCachedInFirstFactor?: boolean; readonly specRowsXml?: string; readonly tailRowsXml?: string } = {}): Uint8Array {
  const workbookXml = options.includeSecondWorksheet
    ? `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/><sheet name="Anonymous_TA_2" sheetId="4" r:id="rId4"/></sheets></workbook>`
    : `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/></sheets></workbook>`;

  const autoSummaryRows = options.includeSecondWorksheet
    ? `<row r="9">${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}</row><row r="10">${cell("A10", "Anonymous_TA")}${cell("C10", "First loop")}</row><row r="11">${cell("A11", "Anonymous_TA_2")}${cell("C11", "Second loop")}</row>`
    : `<row r="9">${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}</row><row r="10">${cell("A10", "Anonymous_TA")}${cell("C10", "First loop")}</row>`;

  const xmlParts: Record<string, string> = {
    "xl/workbook.xml": workbookXml,
    "xl/worksheets/sheet1.xml": worksheet(`<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`),
    "xl/worksheets/sheet2.xml": worksheet(autoSummaryRows),
    "xl/worksheets/sheet3.xml": worksheet(sheetRows(options)),
  };
  if (options.includeSecondWorksheet) {
    xmlParts["xl/worksheets/sheet4.xml"] = worksheet(`<row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("Q13", "Distribution")}${cell("R13", "Mean")}${cell("T13", "1 Sigma")}</row><row r="14">${cell("G14", "Second")}${cell("Q14", "Normal")}${cell("R14", "1")}${cell("T14", "0.1")}</row><row r="54">${cell("O54", "LSL")}${cell("P54", "-0.15")}</row><row r="55">${cell("O55", "USL")}${cell("P55", "0.05")}</row>`);
  }
  return createAnonymousWorkbookZip({ xmlParts });
}

function importWorkbook(workbookBytes: Uint8Array) {
  return createF7WorkbookImport({
    contractId: "f7-analysis-request-v1",
    inputClassification: "confidential",
    fileName: "anonymous.xlsx",
    workbookBytes,
  });
}

describe("F7 interim excel adapter", () => {
  it("imports workbook and prompts for Anonymous_TA without exposing bytes", () => {
    const workbookBytes = buildWorkbook();
    const imported = importWorkbook(workbookBytes);

    expect(imported.workbook.contentHash).toBe(createHash("sha256").update(workbookBytes).digest("hex"));
    expect(imported.prompt.options.map(({ worksheetName }) => worksheetName)).toEqual(["Anonymous_TA"]);
    expect((imported as { workbookBytes?: Uint8Array }).workbookBytes).toBeUndefined();
    expect(Object.isFrozen(imported)).toBe(true);
    expect(Object.isFrozen(imported.prompt)).toBe(true);
  });

  it("extracts seven factor candidates with stable identities and controlled evidence", () => {
    const workbookBytes = buildWorkbook();
    const imported = importWorkbook(workbookBytes);
    const extracted = extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: {
        workbookContentHash: imported.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });

    expect(extracted.candidates.map(({ factorName, excelSignedMean, standardDeviation }) => [factorName, excelSignedMean, standardDeviation])).toEqual([
      ["Fabric thickness", -0.57, 0.0125],
      ["C-cover height", -1.94, 0.025],
      ["Shim thickness", 0.22, 0.0125],
      ["Switch height", 0.75, 0.025],
      ["TP PCB thickness", 0.44, 0.0125],
      ["HAF thickness", 0.05, 0.0125],
      ["Glass thickness", 1, 0.0125],
    ]);
    expect(extracted.candidates.map((candidate) => candidate.factorCandidateId)).toEqual(GOLDEN_CANDIDATE_IDS);
    expect(extracted.candidates[0]?.sourceCells).toMatchObject({
      factorName: "Anonymous_TA!G14",
      excelSignedMean: "Anonymous_TA!R14",
      standardDeviation: "Anonymous_TA!T14",
      distribution: "Anonymous_TA!Q14",
      lowerSpecLimit: "Anonymous_TA!P54",
      upperSpecLimit: "Anonymous_TA!P55",
    });
    expect(Object.isFrozen(extracted)).toBe(true);
    expect(Object.isFrozen(extracted.candidates)).toBe(true);
    expect(Object.isFrozen(extracted.candidates[0])).toBe(true);
    expect(Object.isFrozen(extracted.candidates[0]?.sourceCells)).toBe(true);
  });

  it("uses cached formula values for mean and sigma cells in the anonymous fixture", () => {
    const workbookBytes = buildWorkbook({ formulaCachedInFirstFactor: true });
    const workbook = readOoxmlWorkbook(workbookBytes, ["Anonymous_TA"], false, { maxRow: 1000, maxColumn: "BN" });
    const worksheet = workbook.worksheets.get("Anonymous_TA");
    expect(worksheet?.cells).toContainEqual({ reference: "R14", value: "-0.57", formula: "=ABS(-0.57)*-1", cachedValue: "-0.57" });
    expect(worksheet?.cells).toContainEqual({ reference: "T14", value: ".0125", formula: "=1/80", cachedValue: ".0125" });

    const imported = importWorkbook(workbookBytes);
    const extracted = extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: {
        workbookContentHash: imported.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });

    expect(extracted.candidates[0]?.excelSignedMean).toBe(-0.57);
    expect(extracted.candidates[0]?.standardDeviation).toBe(0.0125);
  });

  it("keeps candidate IDs deterministic and sensitive to source-row movement", () => {
    const workbookA = buildWorkbook();
    const workbookB = buildWorkbook({ headerRow: 14, startRow: 15 });
    const importA = importWorkbook(workbookA);
    const importB = importWorkbook(workbookB);
    const extractA1 = extractF7FactorCandidates({
      workbookBytes: workbookA,
      importResult: importA,
      confirmation: { workbookContentHash: importA.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    });
    const extractA2 = extractF7FactorCandidates({
      workbookBytes: workbookA,
      importResult: importA,
      confirmation: { workbookContentHash: importA.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    });
    const extractB = extractF7FactorCandidates({
      workbookBytes: workbookB,
      importResult: importB,
      confirmation: { workbookContentHash: importB.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    });

    expect(extractA1.candidates.map((candidate) => candidate.factorCandidateId)).toEqual(
      extractA2.candidates.map((candidate) => candidate.factorCandidateId),
    );
    expect(extractB.candidates[0]?.factorCandidateId).not.toBe(extractA1.candidates[0]?.factorCandidateId);
  });

  it("confirms factor setup with explicit coefficients and mm user-confirmed units", () => {
    const workbookBytes = buildWorkbook();
    const imported = importWorkbook(workbookBytes);
    const extracted = extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: { workbookContentHash: imported.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    });
    const result = confirmF7FactorSetup({
      extractionResult: extracted,
      confirmations: extracted.candidates.map((candidate, index) => ({
        factorCandidateId: candidate.factorCandidateId,
        loopCoefficient: index < 2 ? -1 : 1,
        unit: "mm",
        confirmed: true,
      })),
    });

    expect(result.factors.reduce((sum, factor) => sum + factor.signedContributionMean, 0)).toBeCloseTo(-0.05, 12);
    expect(result.factors.every((factor) => factor.lowerSpecLimit === -0.15 && factor.upperSpecLimit === 0.05)).toBe(true);
    expect(result.factors.every((factor) => factor.unit === "mm" && factor.unitSource === "user_confirmed")).toBe(true);
    expect(result.factors.map((factor) => factor.factorId)).toEqual(GOLDEN_FACTOR_IDS);
    expect(result.factors.every((factor, index) => factor.loopCoefficient === (index < 2 ? -1 : 1))).toBe(true);
    expect(result.factors[0]?.sourceCells.excelSignedMean).toBe("Anonymous_TA!R14");
    expect(result.factors[0]?.sourceCells.standardDeviation).toBe("Anonymous_TA!T14");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.factors)).toBe(true);
    expect(Object.isFrozen(result.factors[0])).toBe(true);
    expect(Object.isFrozen(result.factors[0]?.sourceCells)).toBe(true);
    expect(Object.isFrozen(result.factors[0]?.baselineSampler)).toBe(true);
  });

  it("rejects stale workbook hash and invalid strict worksheet confirmation payloads", () => {
    const workbookBytes = buildWorkbook();
    const imported = importWorkbook(workbookBytes);

    expect(() => extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: { workbookContentHash: "f".repeat(64), selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    })).toThrow("F7 factor extraction request is invalid.");

    expect(() => extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: {
        workbookContentHash: imported.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
        extraField: "x",
      },
    })).toThrow("F7 factor extraction request is invalid.");
  });

  it("rejects zero or multiple selected worksheets", () => {
    const oneSheetBytes = buildWorkbook();
    const oneSheetImport = importWorkbook(oneSheetBytes);
    expect(() => extractF7FactorCandidates({
      workbookBytes: oneSheetBytes,
      importResult: oneSheetImport,
      confirmation: {
        workbookContentHash: oneSheetImport.workbook.contentHash,
        selectedWorksheetNames: [],
        confirmed: true,
      },
    })).toThrow("F7 factor extraction request is invalid.");

    const twoSheetsBytes = buildWorkbook({ includeSecondWorksheet: true });
    const twoSheetsImport = importWorkbook(twoSheetsBytes);
    expect(() => extractF7FactorCandidates({
      workbookBytes: twoSheetsBytes,
      importResult: twoSheetsImport,
      confirmation: {
        workbookContentHash: twoSheetsImport.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA", "Anonymous_TA_2"],
        confirmed: true,
      },
    })).toThrow("F7 factor extraction request is invalid.");
  });

  it("rejects missing, duplicate, unknown, and unit-missing factor confirmations", () => {
    const workbookBytes = buildWorkbook();
    const imported = importWorkbook(workbookBytes);
    const extracted = extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: { workbookContentHash: imported.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    });
    const full = extracted.candidates.map((candidate, index) => ({
      factorCandidateId: candidate.factorCandidateId,
      loopCoefficient: index < 2 ? -1 : 1,
      unit: "mm",
      confirmed: true as const,
    }));

    expect(() => confirmF7FactorSetup({
      extractionResult: extracted,
      confirmations: full.slice(1),
    })).toThrow("F7 factor setup confirmation is invalid.");

    expect(() => confirmF7FactorSetup({
      extractionResult: extracted,
      confirmations: [full[0]!, full[0]!, ...full.slice(1)],
    })).toThrow("F7 factor setup confirmation is invalid.");

    expect(() => confirmF7FactorSetup({
      extractionResult: extracted,
      confirmations: [...full, { ...full[0]!, factorCandidateId: "a".repeat(64) }],
    })).toThrow("F7 factor setup confirmation is invalid.");

    expect(() => confirmF7FactorSetup({
      extractionResult: extracted,
      confirmations: full.map((confirmation) => ({ ...confirmation, unit: " " })),
    })).toThrow("F7 factor setup confirmation is invalid.");
  });

  it("rejects coefficient mismatch that violates signed/physical direction consistency", () => {
    const workbookBytes = buildWorkbook();
    const imported = importWorkbook(workbookBytes);
    const extracted = extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: { workbookContentHash: imported.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    });

    expect(() => confirmF7FactorSetup({
      extractionResult: extracted,
      confirmations: extracted.candidates.map((candidate) => ({
        factorCandidateId: candidate.factorCandidateId,
        loopCoefficient: 1,
        unit: "mm",
        confirmed: true,
      })),
    })).toThrow("F7 factor direction is inconsistent with the Excel contribution mean.");
  });

  it("rejects missing specs, ambiguous headers, non-Normal baseline, and multiple factor-header tables", () => {
    const missingSpecBytes = buildWorkbook({ includeUpperSpec: false });
    const missingSpecImport = importWorkbook(missingSpecBytes);
    expect(() => extractF7FactorCandidates({
      workbookBytes: missingSpecBytes,
      importResult: missingSpecImport,
      confirmation: { workbookContentHash: missingSpecImport.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    })).toThrow("F7 factor extraction request is invalid.");

    const ambiguousHeaderBytes = buildWorkbook({ duplicateFactorHeader: true });
    const ambiguousHeaderImport = importWorkbook(ambiguousHeaderBytes);
    expect(() => extractF7FactorCandidates({
      workbookBytes: ambiguousHeaderBytes,
      importResult: ambiguousHeaderImport,
      confirmation: { workbookContentHash: ambiguousHeaderImport.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    })).toThrow("F7 factor extraction request is invalid.");

    const multipleTablesBytes = buildWorkbook({ includeSecondFactorTable: true });
    const multipleTablesImport = importWorkbook(multipleTablesBytes);
    expect(() => extractF7FactorCandidates({
      workbookBytes: multipleTablesBytes,
      importResult: multipleTablesImport,
      confirmation: { workbookContentHash: multipleTablesImport.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
    })).toThrow("F7 factor extraction request is invalid.");

    const distributionBytes = buildWorkbook({ distributionOverride: "Lognormal" });
    const distributionImport = importWorkbook(distributionBytes);
    try {
      extractF7FactorCandidates({
        workbookBytes: distributionBytes,
        importResult: distributionImport,
        confirmation: { workbookContentHash: distributionImport.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
      });
      expect.unreachable();
    } catch (error) {
      expect(typedErrorSchema.safeParse(error).success).toBe(true);
      expect(error).toMatchObject({ reasonCode: "baseline_sampler_not_defined" });
    }
  });

  it("RED: chooses the earliest adjacent strong lower/upper specification pair after factor rows", () => {
    const workbookBytes = buildWorkbook({
      specRowsXml: [
        `<row r="54">${cell("O54", "*Lower Spec Limit ►")}${cell("P54", "-0.15")}</row>`,
        `<row r="55">${cell("O55", "*Upper Spec Limit ►")}${cell("P55", "0.05")}</row>`,
        `<row r="62">${cell("O62", "*Lower Spec Limit ►")}${cell("P62", "-0.25")}</row>`,
        `<row r="63">${cell("O63", "*Upper Spec Limit ►")}${cell("P63", ".15")}</row>`,
      ].join(""),
      tailRowsXml: [
        `<row r="134">${cell("AO134", "LSL")}${cell("AH134", "USL")}</row>`,
        `<row r="145">${cell("AO145", "LSL")}${cell("AH145", "USL")}</row>`,
      ].join(""),
    });
    const imported = importWorkbook(workbookBytes);

    const extracted = extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: {
        workbookContentHash: imported.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });

    expect(extracted.candidates.every((candidate) => candidate.lowerSpecLimit === -0.15 && candidate.upperSpecLimit === 0.05)).toBe(true);
    expect(extracted.candidates.every((candidate) => candidate.sourceCells.lowerSpecLimit === "Anonymous_TA!P54" && candidate.sourceCells.upperSpecLimit === "Anonymous_TA!P55")).toBe(true);
  });

  it("RED: chooses earliest structurally valid strong pair even when moved to a different row/column", () => {
    const workbookBytes = buildWorkbook({
      specRowsXml: [
        `<row r="40">${cell("J40", "*Lower Specification Limit ►")}${cell("K40", "-0.11")}</row>`,
        `<row r="41">${cell("J41", "*Upper Specification Limit ►")}${cell("K41", "0.09")}</row>`,
        `<row r="54">${cell("O54", "*Lower Spec Limit ►")}${cell("P54", "-0.15")}</row>`,
        `<row r="55">${cell("O55", "*Upper Spec Limit ►")}${cell("P55", "0.05")}</row>`,
      ].join(""),
    });
    const imported = importWorkbook(workbookBytes);
    const extracted = extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: {
        workbookContentHash: imported.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });

    expect(extracted.candidates.every((candidate) => candidate.lowerSpecLimit === -0.11 && candidate.upperSpecLimit === 0.09)).toBe(true);
    expect(extracted.candidates.every((candidate) => candidate.sourceCells.lowerSpecLimit === "Anonymous_TA!K40" && candidate.sourceCells.upperSpecLimit === "Anonymous_TA!K41")).toBe(true);
  });

  it("RED: fails with controlled ambiguity when multiple columns share the same earliest lower-row pair", () => {
    const workbookBytes = buildWorkbook({
      specRowsXml: [
        `<row r="54">${cell("O54", "*Lower Spec Limit ►")}${cell("P54", "-0.15")}${cell("Q54", "*Lower Spec Limit ►")}${cell("R54", "-0.2")}</row>`,
        `<row r="55">${cell("O55", "*Upper Spec Limit ►")}${cell("P55", "0.05")}${cell("Q55", "*Upper Spec Limit ►")}${cell("R55", "0.1")}</row>`,
      ].join(""),
    });
    const imported = importWorkbook(workbookBytes);
    expect(() => extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: {
        workbookContentHash: imported.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    })).toThrow("F7 factor extraction request is invalid.");
  });

  it("RED: fail-closed when earliest strong pair bounds are invalid even if a later valid pair exists", () => {
    const workbookBytes = buildWorkbook({
      specRowsXml: [
        `<row r="54">${cell("O54", "*Lower Spec Limit ►")}${cell("P54", "0.2")}</row>`,
        `<row r="55">${cell("O55", "*Upper Spec Limit ►")}${cell("P55", "0.1")}</row>`,
        `<row r="62">${cell("O62", "*Lower Spec Limit ►")}${cell("P62", "-0.25")}</row>`,
        `<row r="63">${cell("O63", "*Upper Spec Limit ►")}${cell("P63", "0.15")}</row>`,
      ].join(""),
    });
    const imported = importWorkbook(workbookBytes);
    expect(() => extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: {
        workbookContentHash: imported.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    })).toThrow("F7 factor extraction request is invalid.");
  });

  it("RED: supports anonymous real-like structure with repeated strong and report labels", () => {
    const workbookBytes = buildWorkbook({
      headerRow: 13,
      startRow: 14,
      specRowsXml: [
        `<row r="54">${cell("O54", "*Lower Spec Limit ►")}${cell("P54", "-0.15")}</row>`,
        `<row r="55">${cell("O55", "*Upper Spec Limit ►")}${cell("P55", "0.05")}</row>`,
        `<row r="62">${cell("O62", "*Lower Spec Limit ►")}${cell("P62", "-0.25")}</row>`,
        `<row r="63">${cell("O63", "*Upper Spec Limit ►")}${cell("P63", ".15")}</row>`,
      ].join(""),
      tailRowsXml: [
        `<row r="134">${cell("AO134", "LSL")}${cell("AH134", "USL")}</row>`,
        `<row r="145">${cell("AO145", "LSL")}${cell("AH145", "USL")}</row>`,
      ].join(""),
    });
    const imported = importWorkbook(workbookBytes);
    const extracted = extractF7FactorCandidates({
      workbookBytes,
      importResult: imported,
      confirmation: {
        workbookContentHash: imported.workbook.contentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });

    expect(extracted.candidates.length).toBe(7);
    expect(extracted.candidates[0]?.sourceCells.lowerSpecLimit).toBe("Anonymous_TA!P54");
    expect(extracted.candidates[0]?.sourceCells.upperSpecLimit).toBe("Anonymous_TA!P55");
  });

  it("propagates archive safety rejection and does not leak cell values in typed errors", () => {
    expect(() => importWorkbook(createAnonymousWorkbookZip({ highlyCompressibleEntry: true }))).toThrow("Workbook-catalog archive cannot be processed.");

    const marker = "ANON_PRIVATE_CELL_MARKER";
    const workbookBytes = buildWorkbook({ distributionOverride: "Gamma", markerInCell: marker });
    const imported = importWorkbook(workbookBytes);
    let caught: unknown;
    try {
      extractF7FactorCandidates({
        workbookBytes,
        importResult: imported,
        confirmation: { workbookContentHash: imported.workbook.contentHash, selectedWorksheetNames: ["Anonymous_TA"], confirmed: true },
      });
      expect.unreachable();
    } catch (error) {
      caught = error;
    }
    const serialized = JSON.stringify(caught);
    expect(typedErrorSchema.safeParse(caught).success).toBe(true);
    expect(serialized).not.toContain(marker);
    expect(serialized).not.toContain("Gamma");
  });

  it("rejects unsafe filenames with typed errors and no filename leakage", () => {
    const workbookBytes = buildWorkbook();
    expect(() => createF7WorkbookImport({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "ANONYMOUS.XLSX",
      workbookBytes,
    })).not.toThrow();

    const invalidFileNames = [
      "../x.xlsx",
      "C:\\x.xlsx",
      "safe\u0000.xlsx",
      "anonymous.csv",
    ];

    for (const fileName of invalidFileNames) {
      let caught: unknown;
      try {
        createF7WorkbookImport({
          contractId: "f7-analysis-request-v1",
          inputClassification: "confidential",
          fileName,
          workbookBytes,
        });
        expect.unreachable();
      } catch (error) {
        caught = error;
      }
      expect(typedErrorSchema.safeParse(caught).success).toBe(true);
      expect(caught).toMatchObject({ summary: "F7 workbook import request is invalid." });
      const serialized = JSON.stringify(caught);
      expect(serialized).not.toContain(fileName);
    }
  });
});