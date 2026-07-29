import { describe, expect, it } from "vitest";
import { createWorkbookCatalog } from "./workbook-catalog.js";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { createSemanticTableDetection } from "./semantic-table-detection.js";

function workbookWithAnalysisSheet(analysisSheetXml: string): Uint8Array {
  return createAnonymousWorkbookZip({
    xmlParts: {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="A2"><v>Document No.</v></c><c r="B2"><v>DOC-007</v></c></row><row r="4"><c r="A4"><v>Revision:</v></c><c r="B4"><v>R2</v></c></row><row r="6"><c r="A6"><v>Date:</v></c><c r="B6"><v>2026-07-29</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet2.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="9"><c r="A9"><v>Device Level Dim</v></c><c r="C9"><v>Tolerance Loop Description</v></c></row><row r="10"><c r="A10"><v>Analysis-A</v></c><c r="C10"><v>First tolerance loop</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet3.xml": analysisSheetXml,
      "xl/worksheets/sheet4.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>',
    },
  });
}

function runDetection(workbookBytes: Uint8Array, manualConfirmations?: readonly { worksheetName: string; candidateId: string; action: "confirm_as_is" | "remap_fields" | "select_another_candidate" | "skip_sheet" }[]) {
  const workbookCatalog = createWorkbookCatalog({
    contractVersion: "v1",
    fileName: "anonymous.xlsx",
    inputClassification: "confidential",
    workbookBytes,
  });

  return createSemanticTableDetection({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookBytes,
    workbookCatalog,
    worksheetSelection: { mode: "selected", worksheetNames: ["Analysis-A"] },
    ...(manualConfirmations ? { manualConfirmations } : {}),
  });
}

describe("semantic table detection", () => {
  it("auto-confirms a high-confidence worksheet candidate", () => {
    const workbookBytes = workbookWithAnalysisSheet(
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="8"><c r="A8" t="inlineStr"><is><t>Factor</t></is></c><c r="B8" t="inlineStr"><is><t>Nominal Value</t></is></c><c r="C8" t="inlineStr"><is><t>+ Tolerance</t></is></c><c r="D8" t="inlineStr"><is><t>- Tolerance</t></is></c><c r="E8" t="inlineStr"><is><t>Distribution</t></is></c></row><row r="9"><c r="A9" t="inlineStr"><is><t>factor-a</t></is></c><c r="B9"><v>1.20</v></c><c r="C9"><v>0.10</v></c><c r="D9"><v>-0.10</v></c><c r="E9" t="inlineStr"><is><t>normal</t></is></c></row></sheetData></worksheet>',
    );

    const result = runDetection(workbookBytes);
    expect(result.worksheets[0]).toMatchObject({
      worksheetName: "Analysis-A",
      recognitionStatus: "auto_confirmed",
      requiresUserConfirmation: false,
    });
    expect(result.summary.autoConfirmedCount).toBe(1);
  });

  it("returns pending_confirmation for medium-confidence structural candidates", () => {
    const workbookBytes = workbookWithAnalysisSheet(
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="8"><c r="A8" t="inlineStr"><is><t>Factor</t></is></c><c r="B8" t="inlineStr"><is><t>Nominal Value</t></is></c><c r="C8" t="inlineStr"><is><t>+ Tolerance</t></is></c><c r="D8" t="inlineStr"><is><t>- Tolerance</t></is></c><c r="E8" t="inlineStr"><is><t>Distribution</t></is></c></row><row r="9"><c r="A9" t="inlineStr"><is><t> </t></is></c><c r="B9" t="inlineStr"><is><t> </t></is></c><c r="C9" t="inlineStr"><is><t> </t></is></c><c r="D9" t="inlineStr"><is><t> </t></is></c><c r="E9" t="inlineStr"><is><t> </t></is></c></row></sheetData></worksheet>',
    );

    const result = runDetection(workbookBytes);
    expect(result.worksheets[0]).toMatchObject({
      recognitionStatus: "pending_confirmation",
      requiresUserConfirmation: true,
      confirmationPayload: expect.objectContaining({ recommendedAction: "confirm_as_is" }),
    });
    expect(result.worksheets[0]?.uncertaintyReasons).toEqual([]);
    expect(result.summary.pendingConfirmationCount).toBe(1);
  });

  it("blocks when required field mappings are duplicated", () => {
    const workbookBytes = workbookWithAnalysisSheet(
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="8"><c r="A8" t="inlineStr"><is><t>Factor</t></is></c><c r="B8" t="inlineStr"><is><t>Factor Name</t></is></c><c r="C8" t="inlineStr"><is><t>Nominal Value</t></is></c><c r="D8" t="inlineStr"><is><t>+ Tolerance</t></is></c><c r="E8" t="inlineStr"><is><t>- Tolerance</t></is></c><c r="F8" t="inlineStr"><is><t>Distribution</t></is></c></row><row r="9"><c r="A9" t="inlineStr"><is><t>factor-a</t></is></c><c r="B9" t="inlineStr"><is><t>factor-b</t></is></c><c r="C9"><v>1.20</v></c><c r="D9"><v>0.10</v></c><c r="E9"><v>-0.10</v></c><c r="F9" t="inlineStr"><is><t>normal</t></is></c></row></sheetData></worksheet>',
    );

    const result = runDetection(workbookBytes);
    expect(result.worksheets[0]).toMatchObject({
      recognitionStatus: "blocked",
      requiresUserConfirmation: true,
    });
    expect(result.worksheets[0]?.uncertaintyReasons).toContain("duplicate_mapping");
    expect(result.summary.blockedCount).toBe(1);
  });

  it("applies manual confirmation to pending candidates", () => {
    const workbookBytes = workbookWithAnalysisSheet(
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="8"><c r="A8" t="inlineStr"><is><t>Factor</t></is></c><c r="B8" t="inlineStr"><is><t>Nominal Value</t></is></c><c r="C8" t="inlineStr"><is><t>+ Tolerance</t></is></c><c r="D8" t="inlineStr"><is><t>- Tolerance</t></is></c><c r="E8" t="inlineStr"><is><t>Distribution</t></is></c></row><row r="9"><c r="A9" t="inlineStr"><is><t> </t></is></c><c r="B9" t="inlineStr"><is><t> </t></is></c><c r="C9" t="inlineStr"><is><t> </t></is></c><c r="D9" t="inlineStr"><is><t> </t></is></c><c r="E9" t="inlineStr"><is><t> </t></is></c></row></sheetData></worksheet>',
    );

    const pending = runDetection(workbookBytes);
    const candidateId = pending.worksheets[0]?.confirmationPayload?.candidateId;
    expect(candidateId).toBeDefined();

    const confirmed = runDetection(workbookBytes, [{
      worksheetName: "Analysis-A",
      candidateId: candidateId!,
      action: "confirm_as_is",
    }]);

    expect(confirmed.worksheets[0]).toMatchObject({
      recognitionStatus: "manual_confirmed",
      requiresUserConfirmation: false,
    });
    expect(confirmed.summary.manualConfirmedCount).toBe(1);
  });
});
