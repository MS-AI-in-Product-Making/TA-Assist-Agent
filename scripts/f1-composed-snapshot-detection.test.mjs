import { describe, expect, it } from "vitest";
import {
  FEATURE1_WORKBOOK_READ_OPTIONS,
  parseWorkbookSheetPathMap,
  worksheetNeedsComposedSnapshot,
} from "./f1-composed-snapshot-detection.mjs";

function workbookWithDrawing(drawingXml) {
  return {
    files: {
      "xl/workbook.xml": {
        content: '<workbook><sheets><sheet name="Mag_C_Z_misalign" r:id="rId1"/></sheets></workbook>',
      },
      "xl/_rels/workbook.xml.rels": {
        content: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/></Relationships>',
      },
      "xl/worksheets/sheet1.xml": {
        content: '<worksheet><drawing r:id="rIdDrawing"/></worksheet>',
      },
      "xl/worksheets/_rels/sheet1.xml.rels": {
        content: '<Relationships><Relationship Id="rIdDrawing" Target="../drawings/drawing1.xml" Type="drawing"/></Relationships>',
      },
      "xl/drawings/drawing1.xml": { content: drawingXml },
    },
  };
}

describe("Feature 1 composed snapshot detection", () => {
  it("loads OOXML package files for drawing inspection", () => {
    expect(FEATURE1_WORKBOOK_READ_OPTIONS.bookFiles).toBe(true);
  });

  it("requires a composed snapshot for an image with inserted text", () => {
    const workbook = workbookWithDrawing(
      '<xdr:wsDr><xdr:pic/><xdr:sp><xdr:txBody><a:p><a:r><a:t>Inserted label</a:t></a:r></a:p></xdr:txBody></xdr:sp></xdr:wsDr>',
    );
    const sheetPath = parseWorkbookSheetPathMap(workbook).get("Mag_C_Z_misalign");

    expect(worksheetNeedsComposedSnapshot(workbook, sheetPath)).toBe(true);
  });

  it("skips a composed snapshot for a base image without overlays", () => {
    const workbook = workbookWithDrawing('<xdr:wsDr><xdr:pic/></xdr:wsDr>');
    const sheetPath = parseWorkbookSheetPathMap(workbook).get("Mag_C_Z_misalign");

    expect(worksheetNeedsComposedSnapshot(workbook, sheetPath)).toBe(false);
  });
});