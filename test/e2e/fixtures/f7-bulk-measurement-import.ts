import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.ts";

const FIRST_FACTOR_COLUMN = 1;
const FACTOR_COUNT = 7;
const FIRST_MEASUREMENT_ROW = 14;
const SAMPLE_COUNT = 20;
const SPREADSHEET_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

export const F7_BULK_IMPORT_OUTPUT_DIRECTORY = resolve("local-test/F7_Test_Finetune_05/f7-bulk-import-e2e");
export const F7_ANONYMOUS_SOURCE_WORKBOOK = resolve(F7_BULK_IMPORT_OUTPUT_DIRECTORY, "anonymous-seven-factor.xlsx");

const FACTORS = [
  ["Fabric thickness", -0.02, 0.0125, 0.05, 0, 0.8],
  ["C-cover height", -1.94, 0.025, 0.1, 0.1, 2.5],
  ["Shim thickness", 0.22, 0.0125, 0.05, 0.1, 2.5],
  ["Switch height", 0.75, 0.025, 0.1, 0.1, 2.5],
  ["TP PCB thickness", 0.44, 0.0125, 0.05, 0.1, 2.5],
  ["HAF thickness", 0.05, 0.0125, 0.05, 0.1, 2.5],
  ["Glass thickness", 1, 0.0125, 0.05, 0.1, 2.5],
] as const;

export interface CompletedMeasurementWorkbookOptions {
  readonly negativeCell?: string;
  readonly baseValue?: number;
}

export async function createCompletedMeasurementWorkbook(
  templatePath: string,
  outputFileName: string,
  options: CompletedMeasurementWorkbookOptions = {},
): Promise<string> {
  const outputPath = resolve(F7_BULK_IMPORT_OUTPUT_DIRECTORY, outputFileName);
  await mkdir(dirname(outputPath), { recursive: true });

  const parts = unzipSync(await readFile(templatePath));
  const worksheetBytes = parts["xl/worksheets/sheet1.xml"];
  if (!worksheetBytes) throw new Error("Downloaded F7 template is missing the Measurements worksheet.");
  let worksheetXml = strFromU8(worksheetBytes);
  const baseValue = options.baseValue ?? 1;

  for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
    const rowNumber = FIRST_MEASUREMENT_ROW + sampleIndex + 1;
    const cells = Array.from({ length: FACTOR_COUNT }, (_, factorIndex) => {
      const column = String.fromCharCode(65 + FIRST_FACTOR_COLUMN + factorIndex);
      const address = `${column}${rowNumber}`;
      if (new RegExp(`<c r="${address}"(?:\\s|>)`).test(worksheetXml)) {
        throw new Error(`Downloaded F7 template measurement cell ${address} is not empty.`);
      }
      const value = address === options.negativeCell
        ? -0.125
        : Number((baseValue + factorIndex * 0.1 + sampleIndex * 0.001).toFixed(6));
      return `<c r="${address}" s="1"><v>${value}</v></c>`;
    }).join("");
    const populatedRowPattern = new RegExp(`(<row r="${rowNumber}"[^>]*>)(.*?)(</row>)`);
    const emptyRowPattern = new RegExp(`<row r="${rowNumber}"([^>]*)/>`);
    if (populatedRowPattern.test(worksheetXml)) {
      worksheetXml = worksheetXml.replace(populatedRowPattern, `$1$2${cells}$3`);
    } else if (emptyRowPattern.test(worksheetXml)) {
      worksheetXml = worksheetXml.replace(emptyRowPattern, `<row r="${rowNumber}"$1>${cells}</row>`);
    } else {
      throw new Error(`Downloaded F7 template is missing measurement row ${rowNumber}.`);
    }
  }

  parts["xl/worksheets/sheet1.xml"] = strToU8(worksheetXml);
  await writeFile(outputPath, zipSync(parts));
  return outputPath;
}

export async function createAnonymousSevenFactorWorkbook(): Promise<string> {
  await mkdir(F7_BULK_IMPORT_OUTPUT_DIRECTORY, { recursive: true });
  const workbookXml = `<?xml version="1.0"?><workbook xmlns="${SPREADSHEET_NAMESPACE}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const titlePageRows = `<row r="2">${xmlCell("A2", "Document No.")}${xmlCell("B2", "DOC-007")}</row><row r="4">${xmlCell("A4", "Revision:")}${xmlCell("B4", "R2")}</row><row r="6">${xmlCell("A6", "Date:")}${xmlCell("B6", "2026-09-16")}</row>`;
  const autoSummaryRows = `<row r="9">${xmlCell("A9", "Device Level Dim")}${xmlCell("C9", "Tolerance Loop Description")}</row><row r="10">${xmlCell("A10", "Anonymous_TA")}${xmlCell("C10", "First loop")}</row>`;
  const factorRows = FACTORS.map(([name, mean, standardDeviation, tolerance, lowerSpecLimit, upperSpecLimit], index) => {
    const row = 14 + index;
    void lowerSpecLimit;
    void upperSpecLimit;
    return `<row r="${row}">${xmlCell(`G${row}`, name)}${xmlCell(`L${row}`, String(mean))}${xmlCell(`M${row}`, String(tolerance))}${xmlCell(`N${row}`, String(-tolerance))}${xmlCell(`O${row}`, "1")}${xmlCell(`P${row}`, "4")}${xmlCell(`Q${row}`, "Normal")}${xmlCell(`R${row}`, String(mean))}${xmlCell(`S${row}`, String(Math.abs(mean)))}${xmlCell(`T${row}`, String(standardDeviation))}</row>`;
  }).join("");
  const headerRow = `<row r="13">${xmlCell("G13", "Factor Description (TA Loop)")}${xmlCell("L13", "Design Nominal")}${xmlCell("M13", "+ Tolerance")}${xmlCell("N13", "- Tolerance")}${xmlCell("O13", "Long Term/Safety Factor")}${xmlCell("P13", "Sigma level")}${xmlCell("Q13", "Distribution")}${xmlCell("R13", "Mean")}${xmlCell("S13", "Tolerance")}${xmlCell("T13", "1 Sigma")}</row>`;
  const responseSummaryRows = `<row r="53">${xmlCell("O53", "Response Summary")}</row><row r="54">${xmlCell("O54", "Design Nominal")}${xmlCell("P54", "1.627")}</row><row r="55">${xmlCell("O55", "LSL")}${xmlCell("P55", "-0.15")}</row><row r="56">${xmlCell("O56", "USL")}${xmlCell("P56", "0.05")}</row><row r="57">${xmlCell("O57", "Target Sigma Level")}${xmlCell("P57", "3")}</row>`;
  const analysisRows = `<row r="11">${xmlCell("G11", "Tolerance Loop Description")}${xmlCell("H11", "Anonymous loop")}</row>${headerRow}${factorRows}${responseSummaryRows}`;
  const bytes = createAnonymousWorkbookZip({
    xmlParts: {
      "xl/workbook.xml": workbookXml,
      "xl/worksheets/sheet1.xml": xmlWorksheet(titlePageRows),
      "xl/worksheets/sheet2.xml": xmlWorksheet(autoSummaryRows),
      "xl/worksheets/sheet3.xml": xmlWorksheet(analysisRows),
    },
  });
  await writeFile(F7_ANONYMOUS_SOURCE_WORKBOOK, bytes);
  return F7_ANONYMOUS_SOURCE_WORKBOOK;
}

function xmlWorksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${SPREADSHEET_NAMESPACE}"><sheetData>${rows}</sheetData></worksheet>`;
}

function xmlCell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}
