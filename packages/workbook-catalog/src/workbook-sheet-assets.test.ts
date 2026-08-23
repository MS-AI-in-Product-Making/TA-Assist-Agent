import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { workbookCatalogResultSchema } from "@ai-assist/contracts";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { createWorkbookSheetAssets } from "./workbook-sheet-assets.js";
import { createWorksheetAnalysisAssets } from "./worksheet-analysis-assets.js";

describe("workbook sheet assets", () => {
  it("extracts every worksheet while TA assets remain selection scoped", () => {
    const workbookBytes = createAnonymousWorkbookZip();
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const workbookCatalog = workbookCatalogResultSchema.parse({
      contractVersion: "v1",
      workbook: {
        fileName: "anonymous-ta.xlsx",
        classification: "confidential",
        contentHash,
        metadata: { documentNo: "DOC-1", revision: "A", date: { value: "2026-08-21", sourceCell: "Title Page!B6" } },
        worksheetInventory: [
          { worksheetName: "Title Page", worksheetIndex: 0, visibility: "visible", worksheetKind: "title_page", isTaAnalysis: false, sourcePart: "xl/worksheets/sheet1.xml" },
          { worksheetName: "Auto Summary", worksheetIndex: 1, visibility: "visible", worksheetKind: "summary", isTaAnalysis: false, sourcePart: "xl/worksheets/sheet2.xml" },
          { worksheetName: "Analysis-A", worksheetIndex: 2, visibility: "visible", worksheetKind: "analysis", isTaAnalysis: true, sourcePart: "xl/worksheets/sheet3.xml" },
        ],
      },
      analyses: [
        { worksheetName: "Analysis-A", toleranceLoopDescription: "Anonymous loop", source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" } },
      ],
    });

    const allSheets = createWorkbookSheetAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
    });
    const taAssets = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-A"] },
    });

    expect(allSheets.workbookContentHash).toBe(contentHash);
    expect(allSheets.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Title Page", "Auto Summary", "Analysis-A"]);
    expect(allSheets.worksheets.every(({ cells, markdown }) => cells.length > 0 && markdown.includes("| Cell | Value | Formula |"))).toBe(true);
    expect(taAssets.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
  });

  it("reads each inventory worksheet independently without relaxing per-sheet limits", () => {
    const sheetCount = 6;
    const cellsPerSheet = 9_000;
    const sheets = Array.from({ length: sheetCount }, (_, index) => `<sheet name="Sheet-${index + 1}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
    const relationships = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
    const cells = Array.from({ length: cellsPerSheet }, (_, index) => `<c r="A${index + 1}"><v>${index + 1}</v></c>`).join("");
    const xmlParts: Record<string, string> = {
      "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
    };
    for (let index = 0; index < sheetCount; index += 1) {
      xmlParts[`xl/worksheets/sheet${index + 1}.xml`] = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`;
    }
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const workbookCatalog = workbookCatalogResultSchema.parse({
      contractVersion: "v1",
      workbook: {
        fileName: "anonymous-large.xlsx",
        classification: "confidential",
        contentHash,
        metadata: { documentNo: "DOC-1", revision: "A", date: { value: "2026-08-21", sourceCell: "Title Page!B6" } },
        worksheetInventory: Array.from({ length: sheetCount }, (_, index) => ({
          worksheetName: `Sheet-${index + 1}`,
          worksheetIndex: index,
          visibility: "visible",
          worksheetKind: "other",
          isTaAnalysis: false,
          sourcePart: `xl/worksheets/sheet${index + 1}.xml`,
        })),
      },
      analyses: [
        { worksheetName: "Sheet-1", toleranceLoopDescription: "Anonymous loop", source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Sheet-1!A1" } },
      ],
    });

    const result = createWorkbookSheetAssets({ contractVersion: "v1", inputClassification: "confidential", workbookBytes, workbookCatalog });

    expect(result.worksheets).toHaveLength(sheetCount);
    expect(result.worksheets.every((worksheet) => worksheet.cells.length === cellsPerSheet)).toBe(true);
  }, 20_000);

  it("preserves worksheet cells and records a failed unsupported drawing extraction", () => {
    const workbookBytes = createAnonymousWorkbookZip({
      xmlParts: {
        "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1"><v>safe-cell</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
        "xl/worksheets/_rels/sheet1.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" TargetMode="External" Target="https://invalid.example/drawing.xml"/></Relationships>',
      },
    });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const workbookCatalog = workbookCatalogResultSchema.parse({
      contractVersion: "v1",
      workbook: {
        fileName: "anonymous-drawing.xlsx",
        classification: "confidential",
        contentHash,
        metadata: { documentNo: "DOC-1", revision: "A", date: { value: "2026-08-21", sourceCell: "Title Page!B6" } },
        worksheetInventory: [
          { worksheetName: "Title Page", worksheetIndex: 0, visibility: "visible", worksheetKind: "title_page", isTaAnalysis: false, sourcePart: "xl/worksheets/sheet1.xml" },
          { worksheetName: "Auto Summary", worksheetIndex: 1, visibility: "visible", worksheetKind: "summary", isTaAnalysis: false, sourcePart: "xl/worksheets/sheet2.xml" },
          { worksheetName: "Analysis-A", worksheetIndex: 2, visibility: "visible", worksheetKind: "analysis", isTaAnalysis: true, sourcePart: "xl/worksheets/sheet3.xml" },
        ],
      },
      analyses: [
        { worksheetName: "Analysis-A", toleranceLoopDescription: "Anonymous loop", source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" } },
      ],
    });

    const result = createWorkbookSheetAssets({ contractVersion: "v1", inputClassification: "confidential", workbookBytes, workbookCatalog });

    expect(result.worksheets[0]).toMatchObject({
      worksheetName: "Title Page",
      imageExtractionStatus: "failed",
      cells: [{ reference: "A1", value: "safe-cell" }],
      images: [],
    });
  });
});