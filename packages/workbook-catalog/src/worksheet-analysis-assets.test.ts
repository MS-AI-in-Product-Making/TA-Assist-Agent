import { describe, expect, it } from "vitest";
import { createWorkbookCatalog } from "./workbook-catalog.js";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { createWorksheetAnalysisAssets } from "./worksheet-analysis-assets.js";

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
});