import { createHash } from "node:crypto";
import {
  createTypedError,
  workbookCatalogResultSchema,
  type WorkbookCatalogResult,
} from "@ai-assist/contracts";
import { readOoxmlWorkbook, type OoxmlCell, type OoxmlImage } from "./ooxml-reader.js";

const REQUEST_SUMMARY = "Workbook sheet assets request is invalid.";
const POLICY_SUMMARY = "Workbook sheet assets input is not permitted.";
const CELL_WINDOW = { maxRow: 10_000, maxColumn: "XFD" } as const;

export interface WorkbookSheetAssetsRequest {
  readonly contractVersion: "v1";
  readonly inputClassification: "confidential";
  readonly workbookBytes: Uint8Array;
  readonly workbookCatalog: WorkbookCatalogResult;
}

export interface WorkbookSheetAsset {
  readonly worksheetName: string;
  readonly worksheetIndex: number;
  readonly visibility: "visible" | "hidden" | "veryHidden";
  readonly worksheetKind: "title_page" | "summary" | "analysis" | "example_or_template" | "other";
  readonly isTaAnalysis: boolean;
  readonly sourcePart: string;
  readonly cells: readonly OoxmlCell[];
  readonly images: readonly OoxmlImage[];
  readonly imageExtractionStatus: "completed" | "failed";
  readonly markdown: string;
}

export interface WorkbookSheetAssetsResult {
  readonly contractVersion: "v1";
  readonly inputClassification: "confidential";
  readonly workbookContentHash: string;
  readonly worksheets: readonly WorkbookSheetAsset[];
}

function sheetAssetsError(summary: string, reference: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide a supported confidential workbook sheet assets request.",
    affectedInputReferences: [reference],
  });
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function sheetMarkdown(worksheetName: string, cells: readonly OoxmlCell[]): string {
  const lines = [
    `# Worksheet: ${markdownEscape(worksheetName)}`,
    "",
    "| Cell | Value | Formula |",
    "|---|---|---|",
  ];
  for (const cell of cells) {
    lines.push(`| ${cell.reference} | ${markdownEscape(cell.value)} | ${markdownEscape(cell.formula ?? "")} |`);
  }
  lines.push("");
  return lines.join("\n");
}

export function createWorkbookSheetAssets(request: unknown): WorkbookSheetAssetsResult {
  let inputClassification: unknown;
  try {
    inputClassification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw sheetAssetsError(REQUEST_SUMMARY, "workbook-request");
  }
  if (typeof inputClassification === "string" && inputClassification !== "confidential") {
    throw sheetAssetsError(POLICY_SUMMARY, "workbook-request", "policy_denied");
  }
  const candidate = request as Partial<WorkbookSheetAssetsRequest> | undefined;
  const catalog = workbookCatalogResultSchema.safeParse(candidate?.workbookCatalog);
  if (candidate?.contractVersion !== "v1"
    || candidate.inputClassification !== "confidential"
    || !(candidate.workbookBytes instanceof Uint8Array)
    || candidate.workbookBytes.byteLength === 0
    || !catalog.success) {
    throw sheetAssetsError(REQUEST_SUMMARY, "workbook-request");
  }
  const workbookBytes = candidate.workbookBytes;
  const workbookContentHash = createHash("sha256").update(workbookBytes).digest("hex");
  if (workbookContentHash !== catalog.data.workbook.contentHash) {
    throw sheetAssetsError(REQUEST_SUMMARY, "workbook-catalog");
  }
  const inventory = catalog.data.workbook.worksheetInventory;
  if (!inventory) throw sheetAssetsError(REQUEST_SUMMARY, "worksheet-inventory");
  try {
    const worksheets = inventory.map((worksheetInventory) => {
      let workbook;
      let imageExtractionStatus: "completed" | "failed" = "completed";
      try {
        workbook = readOoxmlWorkbook(workbookBytes, [worksheetInventory.worksheetName], true, CELL_WINDOW);
      } catch {
        workbook = readOoxmlWorkbook(workbookBytes, [worksheetInventory.worksheetName], false, CELL_WINDOW);
        imageExtractionStatus = "failed";
      }
      const worksheet = workbook.worksheets.get(worksheetInventory.worksheetName);
      if (!worksheet || worksheet.partName !== worksheetInventory.sourcePart) {
        throw sheetAssetsError(REQUEST_SUMMARY, "worksheet-inventory");
      }
      return {
        ...worksheetInventory,
        cells: worksheet.cells,
        images: worksheet.images,
        imageExtractionStatus,
        markdown: sheetMarkdown(worksheetInventory.worksheetName, worksheet.cells),
      };
    });
    return {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash,
      worksheets,
    };
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === REQUEST_SUMMARY) throw error;
    throw sheetAssetsError(REQUEST_SUMMARY, "workbook-archive");
  }
}