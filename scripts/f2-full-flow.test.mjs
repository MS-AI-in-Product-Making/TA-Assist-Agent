import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "@ai-assist/knowledge-base";
import {
  createF2InitialWorkflow,
  createWorkbookCatalog,
  createWorksheetAnalysisAssetsParallel,
  createWorksheetSelectionView,
} from "@ai-assist/workbook-catalog";
import { createAnonymousWorkbookZip } from "../packages/workbook-catalog/src/test-support.ts";

const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRelNs = "http://schemas.openxmlformats.org/package/2006/relationships";

function factorSheet(worksheetName, includeCategory, includeImage) {
  const categoryCell = includeCategory ? `<c r="C2" t="inlineStr"><is><t>demo-bracket</t></is></c>` : "";
  const drawing = includeImage ? '<drawing r:id="rIdDrawing"/>' : "";
  return `<?xml version="1.0"?><worksheet xmlns="${ns}" xmlns:r="${relNs}"><sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Factor Description</t></is></c><c r="B1" t="inlineStr"><is><t>Part Name</t></is></c><c r="C1" t="inlineStr"><is><t>Part Category</t></is></c><c r="D1" t="inlineStr"><is><t>Design Nominal</t></is></c><c r="E1" t="inlineStr"><is><t>+ Tolerence</t></is></c><c r="F1" t="inlineStr"><is><t>- Tolerence</t></is></c><c r="G1" t="inlineStr"><is><t>Long Term/Safety Factor</t></is></c><c r="H1" t="inlineStr"><is><t>Sigma Level</t></is></c><c r="I1" t="inlineStr"><is><t>Distribution</t></is></c><c r="J1" t="inlineStr"><is><t>Drawing Number</t></is></c><c r="K1" t="inlineStr"><is><t>DIM/Characteristic ID</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>bracket arm</t></is></c><c r="B2" t="inlineStr"><is><t>component</t></is></c>${categoryCell}<c r="D2"><v>1</v></c><c r="E2"><v>0.3</v></c><c r="F2"><v>0</v></c><c r="G2"><v>1</v></c><c r="H2"><v>0.01</v></c><c r="I2" t="inlineStr"><is><t>normal</t></is></c><c r="J2" t="inlineStr"><is><t>DWG-1</t></is></c><c r="K2" t="inlineStr"><is><t>DIM-1</t></is></c></row>
    ${includeImage ? `<row r="55"><c r="M55" t="inlineStr"><is><t>Include the tolerance path (screen shot) below:</t></is></c></row>` : ""}
  </sheetData>${drawing}</worksheet>`;
}

function fullFlowWorkbook() {
  return createAnonymousWorkbookZip({
    xmlParts: {
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="${ns}"><sheetData><row r="2"><c r="A2"><v>Document No.</v></c><c r="B2"><v>DOC-ANON</v></c></row><row r="4"><c r="A4"><v>Revision:</v></c><c r="B4"><v>R1</v></c></row><row r="6"><c r="A6"><v>Date:</v></c><c r="B6"><v>2026-08-03</v></c></row></sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<?xml version="1.0"?><worksheet xmlns="${ns}"><sheetData><row r="9"><c r="A9"><v>Device Level Dim</v></c><c r="C9"><v>Tolerance Loop Description</v></c></row><row r="10"><c r="A10"><v>Analysis-A</v></c><c r="C10"><v>Passing anonymous loop</v></c></row><row r="11"><c r="A11"><v>Analysis-B</v></c><c r="C11"><v>Blocked anonymous loop</v></c></row></sheetData></worksheet>`,
      "xl/worksheets/sheet3.xml": factorSheet("Analysis-A", true, true),
      "xl/worksheets/sheet4.xml": factorSheet("Analysis-B", false, false),
      "xl/worksheets/_rels/sheet3.xml.rels": `<Relationships xmlns="${packageRelNs}"><Relationship Id="rIdDrawing" Type="${relNs}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
      "xl/drawings/drawing1.xml": `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${relNs}"><xdr:twoCellAnchor><xdr:from><xdr:col>12</xdr:col><xdr:row>55</xdr:row></xdr:from><xdr:to><xdr:col>15</xdr:col><xdr:row>70</xdr:row></xdr:to><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`,
      "xl/drawings/_rels/drawing1.xml.rels": `<Relationships xmlns="${packageRelNs}"><Relationship Id="rIdImage" Type="${relNs}/image" Target="../media/image1.png"/></Relationships>`,
    },
    binaryParts: { "xl/media/image1.png": new Uint8Array([1, 2, 3]) },
  });
}

describe("F0 F1 F2 full flow", () => {
  it("isolates one blocked worksheet while a uniquely mapped worksheet continues", async () => {
    expect(loadKnowledgeBase({ version: "v1" }).getKnowledgeBaseManifest().knowledgeBaseVersion).toBe("v1");
    const workbookBytes = fullFlowWorkbook();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", fileName: "anonymous.xlsx", inputClassification: "confidential", workbookBytes });
    const selectionView = createWorksheetSelectionView({ contractVersion: "v1", inputClassification: "confidential", workbookCatalog });
    const parallelAssets = await createWorksheetAnalysisAssetsParallel({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: selectionView.worksheets.map((worksheet) => worksheet.worksheetName) },
    });
    expect(parallelAssets.pages.every((page) => page.status === "processed")).toBe(true);

    const result = createF2InitialWorkflow({
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: "v1",
      mappingRuleVersion: "v1",
      toleranceUnitAssumption: "mm",
      worksheetAnalysisAssets: parallelAssets.assets,
    });

    expect(result.status, JSON.stringify(result, null, 2)).toBe("partiallyBlocked");
    expect(result.mappingRuleVersion).toBe("v1");
    expect(result.worksheets).toEqual(expect.arrayContaining([
      expect.objectContaining({ worksheetName: "Analysis-A", status: "readyForNextFeature", capabilityChecks: [expect.objectContaining({ status: "tolerance_and_distribution_match", sourceRow: 2, sourceCells: expect.objectContaining({ upperTolerance: "Analysis-A!E2" }) })] }),
      expect.objectContaining({ worksheetName: "Analysis-B", status: "blocked", blockingIssues: expect.arrayContaining([expect.objectContaining({ issueCode: "required_field_unavailable", sourceRow: 2 })]) }),
    ]));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worksheets)).toBe(true);
  });
});