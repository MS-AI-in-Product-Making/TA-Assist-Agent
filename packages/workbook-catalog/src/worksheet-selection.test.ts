import { describe, expect, it } from "vitest";
import { createWorkbookCatalog } from "./workbook-catalog.js";
import { createAnonymousWorkbookZip } from "./test-support.js";
import {
  createWorksheetSelectionPrompt,
  createWorksheetSelectionView,
  validateWorksheetSelectionConfirmation,
} from "./worksheet-selection.js";

describe("worksheet selection view", () => {
  it("builds a selection-ready worksheet view from a verified workbook catalog", () => {
    const workbookBytes = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": "<?xml version=\"1.0\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row r=\"2\"><c r=\"A2\"><v>Document No.</v></c><c r=\"B2\"><v>DOC-007</v></c></row><row r=\"4\"><c r=\"A4\"><v>Revision:</v></c><c r=\"B4\"><v>R2</v></c></row><row r=\"6\"><c r=\"A6\"><v>Date:</v></c><c r=\"B6\"><v>2026-07-23</v></c></row></sheetData></worksheet>",
      "xl/worksheets/sheet2.xml": "<?xml version=\"1.0\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData><row r=\"9\"><c r=\"A9\"><v>Device Level Dim</v></c><c r=\"C9\"><v>Tolerance Loop Description</v></c></row><row r=\"10\"><c r=\"A10\"><v>Analysis-A</v></c><c r=\"C10\"><v>First tolerance loop</v></c></row><row r=\"11\"><c r=\"A11\"><v>Analysis-B</v></c><c r=\"C11\"><v>Second tolerance loop</v></c></row></sheetData></worksheet>",
    } });

    const workbookCatalog = createWorkbookCatalog({
      contractVersion: "v1",
      inputClassification: "confidential",
      fileName: "anonymous.xlsx",
      workbookBytes,
    });

    const result = createWorksheetSelectionView({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookCatalog,
    });

    expect(result.workbook).toEqual({
      fileName: "anonymous.xlsx",
      classification: "confidential",
      contentHash: workbookCatalog.workbook.contentHash,
      revision: "R2",
      date: { value: "2026-07-23", sourceCell: "Title Page!B6" },
    });
    expect(result.worksheets).toEqual([
      {
        selectionIndex: 1,
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "First tolerance loop",
        source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
      },
      {
        selectionIndex: 2,
        worksheetName: "Analysis-B",
        toleranceLoopDescription: "Second tolerance loop",
        source: { summarySheet: "Auto Summary", summaryRow: 11, worksheetAnchor: "Analysis-B!A1" },
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worksheets)).toBe(true);
    expect(Object.isFrozen(result.worksheets[0]!)).toBe(true);

    const prompt = createWorksheetSelectionPrompt({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookCatalog: {
        ...workbookCatalog,
        analyses: [
          {
            ...workbookCatalog.analyses[0]!,
            worksheetName: "Example_TA",
            source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Example_TA!A1" },
          },
          workbookCatalog.analyses[1]!,
        ],
      },
    });
    expect(prompt.status).toBe("selectionRequired");
    expect(prompt.options.map((option) => ({ name: option.worksheetName, kind: option.worksheetKind }))).toEqual([
      { name: "Example_TA", kind: "example_or_template" },
      { name: "Analysis-B", kind: "analysis" },
    ]);
    expect(Object.isFrozen(prompt.options)).toBe(true);

    expect(validateWorksheetSelectionConfirmation({
      prompt,
      confirmation: {
        workbookContentHash: workbookCatalog.workbook.contentHash,
        selectedWorksheetNames: ["Analysis-B"],
        confirmed: true,
      },
    })).toEqual({
      status: "confirmed",
      workbookContentHash: workbookCatalog.workbook.contentHash,
      selectedWorksheetNames: ["Analysis-B"],
    });
    expect(validateWorksheetSelectionConfirmation({
      prompt,
      confirmation: {
        workbookContentHash: workbookCatalog.workbook.contentHash,
        selectedWorksheetNames: [],
        confirmed: true,
      },
    })).toEqual({ status: "cancelled", reasonCode: "worksheet_selection_empty" });
    expect(validateWorksheetSelectionConfirmation({
      prompt,
      confirmation: {
        workbookContentHash: "f".repeat(64),
        selectedWorksheetNames: ["Analysis-B"],
        confirmed: true,
      },
    })).toEqual({ status: "rejected", reasonCode: "stale_worksheet_selection" });
    expect(validateWorksheetSelectionConfirmation({
      prompt,
      confirmation: {
        workbookContentHash: workbookCatalog.workbook.contentHash,
        selectedWorksheetNames: ["Unknown"],
        confirmed: true,
      },
    })).toEqual({ status: "rejected", reasonCode: "invalid_worksheet_selection" });
  });

  it("denies non-confidential input before processing catalog content", () => {
    expect(() => createWorksheetSelectionView({
      contractVersion: "v1",
      inputClassification: "public",
      workbookCatalog: {},
    })).toThrow("Worksheet-selection view input is not permitted.");
  });

  it("rejects malformed requests", () => {
    expect(() => createWorksheetSelectionView({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookCatalog: { analyses: [] },
    })).toThrow("Worksheet-selection view request is invalid.");
  });
});
