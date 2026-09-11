import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createWorkbookCatalog } from "./workbook-catalog.js";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { createWorksheetAnalysisAssets, createWorksheetAnalysisAssetsParallel, readWorksheetImageAsset } from "./worksheet-analysis-assets.js";

function selectionWorkbook(): Uint8Array {
  return createAnonymousWorkbookZip({ xmlParts: {
    "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="A2"><v>Document No.</v></c><c r="B2"><v>DOC-007</v></c></row><row r="4"><c r="A4"><v>Revision:</v></c><c r="B4"><v>R2</v></c></row><row r="6"><c r="A6"><v>Date:</v></c><c r="B6"><v>2026-07-23</v></c></row></sheetData></worksheet>',
    "xl/worksheets/sheet2.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="9"><c r="A9"><v>Device Level Dim</v></c><c r="C9"><v>Tolerance Loop Description</v></c></row><row r="10"><c r="A10"><v>Analysis-A</v></c><c r="C10"><v>First tolerance loop</v></c></row><row r="11"><c r="A11"><v>Analysis-B</v></c><c r="C11"><v>Second tolerance loop</v></c></row></sheetData></worksheet>',
    "xl/worksheets/sheet3.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>only-a</t></is></c></row></sheetData></worksheet>',
    "xl/worksheets/sheet4.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>only-b</t></is></c></row></sheetData></worksheet>',
  } });
}

function largeWorksheetWorkbook(): Uint8Array {
  const header = '<row r="5"><c r="A5" t="inlineStr"><is><t>Factor</t></is></c><c r="B5" t="inlineStr"><is><t>Nominal Value</t></is></c><c r="C5" t="inlineStr"><is><t>Unit</t></is></c></row>';
  const firstDataRow = '<row r="6"><c r="A6" t="inlineStr"><is><t>region-factor</t></is></c><c r="B6"><v>1.25</v></c><c r="C6" t="inlineStr"><is><t>mm</t></is></c></row>';
  let fillerRows = "";
  for (let row = 300; row <= 999; row += 1) {
    fillerRows += `<row r="${row}"><c r="AA${row}"><v>1</v></c></row>`;
  }
  const analysisSheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${header}${firstDataRow}${fillerRows}</sheetData></worksheet>`;
  return createAnonymousWorkbookZip({ xmlParts: { "xl/worksheets/sheet3.xml": analysisSheet } });
}

describe("worksheet analysis assets", () => {
  it("extracts assets only for worksheets confirmed by the matching catalog", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="A2"><v>Document No.</v></c><c r="B2"><v>DOC-007</v></c></row><row r="4"><c r="A4"><v>Revision:</v></c><c r="B4"><v>R2</v></c></row><row r="6"><c r="A6"><v>Date:</v></c><c r="B6"><v>2026-07-23</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet2.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="9"><c r="A9"><v>Device Level Dim</v></c><c r="C9"><v>Tolerance Loop Description</v></c></row><row r="10"><c r="A10"><v>Analysis-A</v></c><c r="C10"><v>First tolerance loop</v></c></row><row r="11"><c r="A11"><v>Analysis-B</v></c><c r="C11"><v>Second tolerance loop</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet3.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c><c r="B1" t="inlineStr"><is><t>Nominal Value</t></is></c><c r="C1" t="inlineStr"><is><t>Unit</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="B2" t="inlineStr"><is><t>1.25</t></is></c><c r="C2" t="inlineStr"><is><t>mm</t></is></c></row></sheetData></worksheet>',
    } });
    const workbookCatalog = createWorkbookCatalog({
      contractVersion: "v1",
      inputClassification: "confidential",
      fileName: "anonymous.xlsx",
      workbookBytes,
    });

    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
    });

    expect(result.worksheets).toHaveLength(2);
    expect(result.worksheets[0]).toMatchObject({ worksheetName: "Analysis-A" });
    expect(result.worksheets[0]?.factorTables[0]).toMatchObject({
      headerRow: 1,
      dataRange: { startRow: 2, endRow: 2 },
      rows: [{ sourceRow: 2, fields: { factorName: { status: "available", rawText: "anonymous-factor", sourceCell: "Analysis-A!A2" }, nominalValue: { status: "available", rawText: "1.25", numericValue: 1.25, sourceCell: "Analysis-A!B2" } } }],
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("stops the factor table at the first blank user-input row", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="A2"><v>Document No.</v></c><c r="B2"><v>DOC-007</v></c></row><row r="4"><c r="A4"><v>Revision:</v></c><c r="B4"><v>R2</v></c></row><row r="6"><c r="A6"><v>Date:</v></c><c r="B6"><v>2026-07-23</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet2.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="9"><c r="A9"><v>Device Level Dim</v></c><c r="C9"><v>Tolerance Loop Description</v></c></row><row r="10"><c r="A10"><v>Analysis-A</v></c><c r="C10"><v>First tolerance loop</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet3.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>Factor</v></c><c r="B1"><v>Mean</v></c></row><row r="2"><c r="A2"><v>first-factor</v></c><c r="B2"><v>1</v></c></row><row r="3"><c r="B3"><f>0</f><v>0</v></c></row><row r="4"><c r="A4"><v>second-factor</v></c><c r="B4"><v>2</v></c></row></sheetData></worksheet>',
    } });
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
    });

    expect(result.worksheets[0]?.factorTables[0]).toMatchObject({
      dataRange: { startRow: 2, endRow: 2 },
      rows: [
        { sourceRow: 2, fields: { factorName: { status: "available", rawText: "first-factor" } } },
      ],
    });
  });

  it("retains a partially populated input row when the factor name is blank", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>Factor</v></c><c r="B1"><v>Part Name</v></c><c r="C1"><v>Mean</v></c></row><row r="2"><c r="B2"><v>Bracket</v></c><c r="C2"><f>0</f><v>0</v></c></row><row r="3"><c r="C3"><f>0</f><v>0</v></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-08-03", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(result.worksheets[0]?.factorTables[0]?.rows).toEqual([
      expect.objectContaining({
        sourceRow: 2,
        fields: expect.objectContaining({
          factorName: expect.objectContaining({ status: "unavailable", reasonCode: "missing" }),
          partName: expect.objectContaining({ status: "available", rawText: "Bracket" }),
        }),
      }),
    ]);
  });

  it("extracts Part Number independently from Drawing Number", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>Factor</v></c><c r="B1"><v>Drawing Number</v></c><c r="C1"><v>Part Number</v></c></row><row r="2"><c r="A2"><v>anonymous-factor</v></c><c r="B2"><v>DWG-100</v></c><c r="C2"><v>PN-200</v></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-08-03", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(result.worksheets[0]?.factorTables[0]?.rows[0]?.fields).toEqual(expect.objectContaining({
      drawingNumber: expect.objectContaining({ status: "available", rawText: "DWG-100" }),
      partNumber: expect.objectContaining({ status: "available", rawText: "PN-200" }),
    }));
  });

  it("reports missing tolerance-path labels as semantic image evidence", () => {
    const workbookBytes = selectionWorkbook();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-A"] },
    });

    expect(result.worksheets[0]).toMatchObject({
      tolerancePathImage: { status: "unavailable", reasonCode: "label_missing" },
    });
  });

  it("binds the nearest supported image below the tolerance-path label", () => {
    const imageBytes = new Uint8Array([1, 2, 3]);
    const workbookBytes = createAnonymousWorkbookZip({
      xmlParts: {
        "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1"><v>Factor</v></c></row><row r="2"><c r="A2"><v>anonymous-factor</v></c></row><row r="55"><c r="A55"><v>Include the tolerance path (screen shot) below:</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
        "xl/worksheets/_rels/sheet3.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
        "xl/drawings/drawing1.xml": '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>55</xdr:row></xdr:from><xdr:to><xdr:col>10</xdr:col><xdr:row>70</xdr:row></xdr:to><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>',
        "xl/drawings/_rels/drawing1.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>',
      },
      binaryParts: { "xl/media/image1.png": imageBytes },
    });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const imageContentHash = createHash("sha256").update(imageBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-08-03", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(result.worksheets[0]?.tolerancePathImage).toEqual({
      status: "available",
      labelSourceCell: "Analysis-A!A55",
      imageContentHash,
      imageAnchor: { from: "A56", to: "K71" },
    });
  });

  it("supports selecting a single worksheet before asset extraction", () => {
    const workbookBytes = selectionWorkbook();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-B"] },
    });

    expect(result.worksheets).toHaveLength(1);
    expect(result.worksheets[0]?.worksheetName).toBe("Analysis-B");
  });

  it("supports selecting multiple worksheets in catalog order", () => {
    const workbookBytes = selectionWorkbook();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-B", "Analysis-A"] },
    });

    expect(result.worksheets.map((worksheet) => worksheet.worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
  });

  it("supports explicit all mode selection", () => {
    const workbookBytes = selectionWorkbook();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "all" },
    });

    expect(result.worksheets).toHaveLength(workbookCatalog.analyses.length);
  });

  it("rejects selecting worksheets outside the detected catalog", () => {
    const workbookBytes = selectionWorkbook();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    expect(() => createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: ["Unknown-Sheet"] },
    })).toThrow("Worksheet-analysis assets request is invalid.");
  });

  it("processes selected worksheets in parallel mode with independent review pages", async () => {
    const workbookBytes = selectionWorkbook();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    const result = await createWorksheetAnalysisAssetsParallel({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-B", "Analysis-A"] },
    });

    expect(result.processingMode).toBe("parallel");
    expect(result.assets.worksheets.map((worksheet) => worksheet.worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
    expect(result.pages).toHaveLength(2);
    expect(result.pages).toEqual([
      expect.objectContaining({ worksheetName: "Analysis-A", status: "processed" }),
      expect.objectContaining({ worksheetName: "Analysis-B", status: "processed" }),
    ]);
    expect(result.pages.every((page) => page.durationMs >= 0)).toBe(true);
    expect(Object.isFrozen(result.pages)).toBe(true);
    expect(Object.isFrozen(result.pages[0]!)).toBe(true);
  });

  it("keeps sync and parallel extraction outputs equivalent for all-mode selection", async () => {
    const workbookBytes = selectionWorkbook();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    const syncResult = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "all" },
    });
    const parallelResult = await createWorksheetAnalysisAssetsParallel({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "all" },
    });

    expect(parallelResult.assets).toEqual(syncResult);
  });

  it("extracts factor tables from sparse worksheets beyond the legacy analysis window", async () => {
    const workbookBytes = largeWorksheetWorkbook();
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const request = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1" as const,
        workbook: { fileName: "anonymous.xlsx", classification: "confidential" as const, contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-28", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "window-target", source: { summarySheet: "Auto Summary" as const, summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
      worksheetSelection: { mode: "selected" as const, worksheetNames: ["Analysis-A"] },
    };

    const sync = createWorksheetAnalysisAssets(request);
    const parallel = await createWorksheetAnalysisAssetsParallel(request);

    expect(sync.worksheets[0]?.factorTables[0]?.rows[0]).toMatchObject({
      sourceRow: 6,
      fields: {
        factorName: { status: "available", rawText: "region-factor" },
        nominalValue: { status: "available", numericValue: 1.25 },
      },
    });
    expect(parallel.pages[0]).toMatchObject({
      worksheetName: "Analysis-A",
      status: "processed",
    });
  });

  it("marks failed parallel pages with workbook_archive reasonCode", async () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c></row><row r="2"><c r="A2" t="b"><v>1</v></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");

    const result = await createWorksheetAnalysisAssetsParallel({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-28", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-A"] },
    });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toMatchObject({
      worksheetName: "Analysis-A",
      status: "failed",
      reasonCode: "workbook_archive",
    });
    expect(result.assets.worksheets[0]).toMatchObject({
      worksheetName: "Analysis-A",
      factorTables: [],
      formulaCells: [],
      imageAssets: [],
    });
  });

  it("marks image-fallback pages with image_extraction_skipped reasonCode", async () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
      "xl/worksheets/_rels/sheet3.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
      "xl/drawings/drawing1.xml": '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>',
      "xl/drawings/_rels/drawing1.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://anonymous.invalid/image.png" TargetMode="External"/></Relationships>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");

    const result = await createWorksheetAnalysisAssetsParallel({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-28", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-A"] },
    });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toMatchObject({
      worksheetName: "Analysis-A",
      status: "processed",
      reasonCode: "image_extraction_skipped",
      imageAssetCount: 0,
      errorSummary: "image extraction skipped for this worksheet",
    });
  });

  it("keeps synchronous worksheet analysis available when image extraction is rejected", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
      "xl/worksheets/_rels/sheet3.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
      "xl/drawings/drawing1.xml": '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>',
      "xl/drawings/_rels/drawing1.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://anonymous.invalid/image.png" TargetMode="External"/></Relationships>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");

    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-28", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-A"] },
    });

    expect(result.worksheets[0]).toMatchObject({
      worksheetName: "Analysis-A",
      factorTables: [{ rows: [{ fields: { factorName: { status: "available", rawText: "anonymous-factor" } } }] }],
      imageAssets: [],
      tolerancePathImage: { status: "unavailable", reasonCode: "label_missing" },
    });
  });

  it("keeps table evidence bounded by blank rows and marks invalid formula evidence per field", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="A2"><v>Document No.</v></c><c r="B2"><v>DOC-007</v></c></row><row r="4"><c r="A4"><v>Revision:</v></c><c r="B4"><v>R2</v></c></row><row r="6"><c r="A6"><v>Date:</v></c><c r="B6"><v>2026-07-23</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet2.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="9"><c r="A9"><v>Device Level Dim</v></c><c r="C9"><v>Tolerance Loop Description</v></c></row><row r="10"><c r="A10"><v>Analysis-A</v></c><c r="C10"><v>First tolerance loop</v></c></row><row r="11"><c r="A11"><v>Analysis-B</v></c><c r="C11"><v>Second tolerance loop</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="3"><c r="H3"><f>SUM(A1:A1)</f><v>1.25</v></c></row><row r="5"><c r="B5" t="inlineStr"><is><t>Factor Name</t></is></c><c r="C5" t="inlineStr"><is><t>Nominal</t></is></c></row><row r="6"><c r="B6" t="inlineStr"><is><t>anonymous-first</t></is></c><c r="C6"><f>SUM(A1:A1)</f><v>1.25</v></c></row><row r="7"/><row r="10"><c r="D10" t="inlineStr"><is><t>Factor</t></is></c><c r="E10" t="inlineStr"><is><t>Nominal Value</t></is></c></row><row r="11"><c r="D11" t="inlineStr"><is><t>anonymous-second</t></is></c><c r="E11"><f>SUM(A1:A1)</f></c></row><row r="12"><c r="D12" t="inlineStr"><is><t>anonymous-invalid</t></is></c><c r="E12" t="inlineStr"><is><t>not-a-number</t></is></c></row></sheetData></worksheet>',
    } });
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", inputClassification: "confidential", fileName: "anonymous.xlsx", workbookBytes });

    const result = createWorksheetAnalysisAssets({ contractVersion: "v1", inputClassification: "confidential", workbookBytes, workbookCatalog });
    const tables = result.worksheets[0]!.factorTables;

    expect(tables).toHaveLength(2);
    expect(tables[0]).toMatchObject({ headerRow: 5, dataRange: { startRow: 6, endRow: 6 } });
    expect(tables[1]?.rows).toMatchObject([
      { sourceRow: 11, fields: { nominalValue: { status: "unavailable", reasonCode: "missing_cached_value", sourceCell: "Analysis-A!E11" } } },
      { sourceRow: 12, fields: { nominalValue: { status: "unavailable", reasonCode: "invalid_format", sourceCell: "Analysis-A!E12" } } },
    ]);
    expect(result.worksheets[0]?.formulaCells).toContainEqual({ sourceCell: "Analysis-A!H3", formula: "=SUM(A1:A1)", cachedValue: { status: "available", rawText: "1.25" } });
  });

  it("parses scientific-notation cached values from factor formulas", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="13"><c r="A13" t="inlineStr"><is><t>Factor</t></is></c><c r="T13" t="inlineStr"><is><t>1σ</t></is></c><c r="U13" t="inlineStr"><is><t>% Cont. to σ</t></is></c></row><row r="14"><c r="A14" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="T14"><f>1/80</f><v>1.2500000000000001E-2</v></c><c r="U14"><f>T14^2</f><v>7.6923076923076913E-2</v></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-08-06", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(result.worksheets[0]?.factorTables[0]?.rows[0]?.fields).toMatchObject({
      oneSigma: {
        status: "available",
        rawText: "1.2500000000000001E-2",
        numericValue: 0.0125,
        formula: "=1/80",
        cachedValue: "1.2500000000000001E-2",
      },
      percentContributionToSigma: {
        status: "available",
        rawText: "7.6923076923076913E-2",
        numericValue: 0.07692307692307691,
        formula: "=T14^2",
        cachedValue: "7.6923076923076913E-2",
      },
    });
  });

  it("marks non-finite scientific-notation cached values as invalid", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="13"><c r="A13" t="inlineStr"><is><t>Factor</t></is></c><c r="T13" t="inlineStr"><is><t>1σ</t></is></c></row><row r="14"><c r="A14" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="T14"><f>1E309</f><v>1E309</v></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-08-06", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(result.worksheets[0]?.factorTables[0]?.rows[0]?.fields.oneSigma).toEqual({
      status: "unavailable",
      reasonCode: "invalid_format",
      sourceCell: "Analysis-A!T14",
    });
  });

  it("returns a defensive image byte copy only when both hashes match uniquely", () => {
    const imageBytes = new Uint8Array([9, 8, 7]);
    const workbookBytes = createAnonymousWorkbookZip({
      xmlParts: {
        "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="2"><c r="A2"><v>2</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
        "xl/worksheets/_rels/sheet3.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
        "xl/drawings/drawing1.xml": '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>',
        "xl/drawings/_rels/drawing1.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>',
      },
      binaryParts: { "xl/media/image1.png": imageBytes },
    });
    const workbookContentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const imageContentHash = createHash("sha256").update(imageBytes).digest("hex");

    const result = readWorksheetImageAsset({ contractVersion: "v1", inputClassification: "confidential", workbookBytes, workbookContentHash, imageContentHash });
    expect(result).toMatchObject({ classification: "confidential", workbookContentHash, imageContentHash, mediaType: "image/png", bytes: new Uint8Array([9, 8, 7]) });
    expect(result.bytes).not.toBe(imageBytes);
    result.bytes[0] = 0;
    expect(readWorksheetImageAsset({ contractVersion: "v1", inputClassification: "confidential", workbookBytes, workbookContentHash, imageContentHash }).bytes).toEqual(new Uint8Array([9, 8, 7]));
  });

  it("rejects image reads when the supplied workbook hash does not match", () => {
    const workbookBytes = createAnonymousWorkbookZip();

    expect(() => readWorksheetImageAsset({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookContentHash: "a".repeat(64),
      imageContentHash: "b".repeat(64),
    })).toThrow("Worksheet-analysis assets request is invalid.");
  });

  it("denies non-confidential assets requests before workbook processing", () => {
    expect(() => createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "secret",
      workbookBytes: new Uint8Array([1]),
      workbookCatalog: {},
    })).toThrow("Worksheet-analysis assets input is not permitted.");
  });

  it("does not parse an unapproved worksheet with an unsafe drawing", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet4.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="1"><c r="A1"><v>4</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
      "xl/worksheets/_rels/sheet4.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="https://anonymous.invalid/drawing.xml" TargetMode="External"/></Relationships>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");

    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-24", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(result.worksheets).toHaveLength(1);
    expect(result.worksheets[0]?.worksheetName).toBe("Analysis-A");
  });

  it("marks an empty formula cache as unavailable evidence", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c><c r="B1" t="inlineStr"><is><t>Nominal Value</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="B2"><f>SUM(A1:A1)</f><v></v></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-24", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(result.worksheets[0]?.factorTables[0]?.rows[0]?.fields.nominalValue).toEqual({ status: "unavailable", reasonCode: "missing_cached_value", sourceCell: "Analysis-A!B2" });
  });

  it("keeps returned image evidence metadata-only and deeply immutable", () => {
    const workbookBytes = createAnonymousWorkbookZip();
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: {
          fileName: "anonymous.xlsx",
          classification: "confidential",
          contentHash: createHash("sha256").update(workbookBytes).digest("hex"),
          metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-24", sourceCell: "Title Page!A1" } },
        },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(JSON.stringify(result)).not.toContain("bytes");
    expect(Object.isFrozen(result.worksheets)).toBe(true);
    expect(Object.isFrozen(result.worksheets[0]!)).toBe(true);
  });

  it("extracts F2.1 required and advisory evidence using only controlled header aliases", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor Description</t></is></c><c r="B1" t="inlineStr"><is><t>Part Name</t></is></c><c r="C1" t="inlineStr"><is><t>Part Category</t></is></c><c r="D1" t="inlineStr"><is><t>Design Nominal</t></is></c><c r="E1" t="inlineStr"><is><t>+ Tolerence</t></is></c><c r="F1" t="inlineStr"><is><t>- Tolerence</t></is></c><c r="G1" t="inlineStr"><is><t>Long Term/Safety Factor</t></is></c><c r="H1" t="inlineStr"><is><t>Sigma Level</t></is></c><c r="I1" t="inlineStr"><is><t>Distribution</t></is></c><c r="J1" t="inlineStr"><is><t>Drawing Number</t></is></c><c r="K1" t="inlineStr"><is><t>DIM/Characteristic ID</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="B2" t="inlineStr"><is><t>anonymous-part</t></is></c><c r="C2" t="inlineStr"><is><t>anonymous-category</t></is></c><c r="D2"><v>10</v></c><c r="E2"><v>0.5</v></c><c r="F2"><v>0.5</v></c><c r="G2"><v>1.5</v></c><c r="H2"><v>3</v></c><c r="I2" t="inlineStr"><is><t>normal</t></is></c><c r="J2" t="inlineStr"><is><t>DWG-001</t></is></c><c r="K2" t="inlineStr"><is><t>DIM-001</t></is></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog: {
        contractVersion: "v1",
        workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-27", sourceCell: "Title Page!A1" } } },
        analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }],
      },
    });

    expect(result.worksheets[0]!.factorTables[0]!.rows[0]!.fields).toMatchObject({
      factorName: { status: "available", rawText: "anonymous-factor" },
      partName: { status: "available", rawText: "anonymous-part" },
      partCategory: { status: "available", rawText: "anonymous-category" },
      nominalValue: { status: "available", numericValue: 10 },
      upperTolerance: { status: "available", numericValue: 0.5 },
      lowerTolerance: { status: "available", numericValue: 0.5 },
      longTermSafetyFactor: { status: "available", numericValue: 1.5 },
      standardDeviation: { status: "available", numericValue: 3 },
      distribution: { status: "available", rawText: "normal" },
      drawingNumber: { status: "available", rawText: "DWG-001" },
      dimCharacteristicId: { status: "available", rawText: "DIM-001" },
    });
  });

  it.each(["Long Term Factor", "Safety Factor", "Long Term/Safety Factor"])("maps %s to longTermSafetyFactor", (factorHeader) => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c><c r="B1" t="inlineStr"><is><t>${factorHeader}</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="B2"><v>1.5</v></c></row></sheetData></worksheet>`,
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1", inputClassification: "confidential", workbookBytes,
      workbookCatalog: { contractVersion: "v1", workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-27", sourceCell: "Title Page!A1" } } }, analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }] },
    });

    expect(result.worksheets[0]!.factorTables[0]!.rows[0]!.fields.longTermSafetyFactor).toMatchObject({ status: "available", numericValue: 1.5 });
  });

  it("maps the template σ Level header to standardDeviation", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c><c r="B1" t="inlineStr"><is><t>σ Level</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="B2"><v>4</v></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1", inputClassification: "confidential", workbookBytes,
      workbookCatalog: { contractVersion: "v1", workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-08-03", sourceCell: "Title Page!A1" } } }, analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }] },
    });

    expect(result.worksheets[0]!.factorTables[0]!.rows[0]!.fields.standardDeviation).toMatchObject({ status: "available", numericValue: 4 });
  });

  it("maps Factor Description (TA Loop) to factorName", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor Description (TA Loop)</t></is></c><c r="B1" t="inlineStr"><is><t>Nominal Value</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>tp-loop-factor</t></is></c><c r="B2"><v>2.5</v></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1", inputClassification: "confidential", workbookBytes,
      workbookCatalog: { contractVersion: "v1", workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-28", sourceCell: "Title Page!A1" } } }, analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }] },
    });

    expect(result.worksheets[0]!.factorTables[0]!.rows[0]!.fields.factorName).toMatchObject({ status: "available", rawText: "tp-loop-factor" });
  });

  it("preserves Factor ordinals from the cell immediately left of Factor Description", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="AB1" t="inlineStr"><is><t>Factor Description</t></is></c></row><row r="2"><c r="AA2" t="inlineStr"><is><t>A</t></is></c><c r="AB2" t="inlineStr"><is><t>first</t></is></c></row><row r="3"><c r="AB3" t="inlineStr"><is><t>blank</t></is></c></row><row r="4"><c r="AA4" t="inlineStr"><is><t>AA</t></is></c><c r="AB4" t="inlineStr"><is><t>multi</t></is></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1", inputClassification: "confidential", workbookBytes,
      workbookCatalog: { contractVersion: "v1", workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-09-07", sourceCell: "Title Page!A1" } } }, analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }] },
    });

    expect(result.worksheets[0]!.factorTables[0]!.rows.map((row) => row.factorOrdinal)).toEqual([
      { value: "A", rawText: "A", sourceCell: "Analysis-A!AA2" },
      { value: "", rawText: "", sourceCell: "Analysis-A!AA3" },
      { value: "AA", rawText: "AA", sourceCell: "Analysis-A!AA4" },
    ]);
  });

  it("fails closed for duplicate factor headers and retains independent zero-row tables", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c><c r="B1" t="inlineStr"><is><t>Safety Factor</t></is></c><c r="C1" t="inlineStr"><is><t>Long Term Factor</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="B2"><v>1.5</v></c><c r="C2"><v>2</v></c></row><row r="5"><c r="D5" t="inlineStr"><is><t>Factor</t></is></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1", inputClassification: "confidential", workbookBytes,
      workbookCatalog: { contractVersion: "v1", workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-27", sourceCell: "Title Page!A1" } } }, analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }] },
    });

    expect(result.worksheets[0]!.factorTables).toHaveLength(1);
    expect(result.worksheets[0]!.factorTables[0]).toMatchObject({ headerRow: 5, dataRange: { startRow: 6, endRow: 6 }, rows: [] });
  });
});