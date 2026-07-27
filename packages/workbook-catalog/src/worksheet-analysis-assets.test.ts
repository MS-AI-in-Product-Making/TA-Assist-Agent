import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createWorkbookCatalog } from "./workbook-catalog.js";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { createWorksheetAnalysisAssets, readWorksheetImageAsset } from "./worksheet-analysis-assets.js";

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

  it("marks duplicate long-term/safety factor columns unavailable and retains zero-row tables", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Factor</t></is></c><c r="B1" t="inlineStr"><is><t>Safety Factor</t></is></c><c r="C1" t="inlineStr"><is><t>Long Term Factor</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>anonymous-factor</t></is></c><c r="B2"><v>1.5</v></c><c r="C2"><v>2</v></c></row><row r="5"><c r="D5" t="inlineStr"><is><t>Factor</t></is></c></row></sheetData></worksheet>',
    } });
    const contentHash = createHash("sha256").update(workbookBytes).digest("hex");
    const result = createWorksheetAnalysisAssets({
      contractVersion: "v1", inputClassification: "confidential", workbookBytes,
      workbookCatalog: { contractVersion: "v1", workbook: { fileName: "anonymous.xlsx", classification: "confidential", contentHash, metadata: { documentNo: "DOC", revision: "R", date: { value: "2026-07-27", sourceCell: "Title Page!A1" } } }, analyses: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "anonymous", source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis-A!A1" } }] },
    });

    expect(result.worksheets[0]!.factorTables).toHaveLength(2);
    expect(result.worksheets[0]!.factorTables[0]!.rows[0]!.fields.longTermSafetyFactor).toEqual({ status: "unavailable", reasonCode: "duplicate_mapping" });
    expect(result.worksheets[0]!.factorTables[1]).toMatchObject({ headerRow: 5, dataRange: { startRow: 6, endRow: 6 }, rows: [] });
  });
});