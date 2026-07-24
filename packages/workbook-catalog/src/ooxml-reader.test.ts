import { describe, expect, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { readOoxmlWorkbook } from "./ooxml-reader.js";

function expectArchiveError(action: () => unknown, rawMarker = "anonymous-private-marker"): void {
  try {
    action();
  } catch (error) {
    expect(typedErrorSchema.safeParse(error).success).toBe(true);
    expect(error).toMatchObject({ code: "validation_error", summary: "Workbook-catalog archive cannot be processed." });
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen((error as { affectedInputReferences: unknown }).affectedInputReferences)).toBe(true);
    expect((error as Error).message).not.toContain(rawMarker);
    expect(JSON.stringify(error)).not.toContain(rawMarker);
    return;
  }
  throw new Error("Expected archive validation error.");
}

function worksheetXml(rows: number, cellsPerRow: number, marker: string): string {
  let sheetData = "";
  for (let rowIndex = 1; rowIndex <= rows; rowIndex += 1) {
    let cells = "";
    for (let cellIndex = 1; cellIndex <= cellsPerRow; cellIndex += 1) {
      cells += `<c r="C${rowIndex}-${cellIndex}"><v>${marker}</v></c>`;
    }
    sheetData += `<row r="${rowIndex}">${cells}</row>`;
  }
  return `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`;
}

function markerFor(marker: string, index: number): string {
  return `${marker}-${index.toString(36)}`;
}

function multiSheetXml(sheetCount: number): { workbook: string; relationships: string } {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<sheet name="Budget-${index + 1}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const relationships = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return {
    workbook: `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`,
    relationships: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
  };
}

describe("OOXML workbook reader", () => {
  it("rejects a parsed XML part with more than 50,000 nodes and attributes", () => {
    const marker = "dom-node-private-marker";
    const nodes = Array.from({ length: 25_001 }, (_, index) => `<extLst marker="${markerFor(marker, index)}"/>`).join("");
    const xml = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets>${nodes}</workbook>`;

    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: { "xl/workbook.xml": xml } })), marker);
  });

  it("rejects a parsed XML part deeper than 128 levels", () => {
    const marker = "dom-depth-private-marker";
    const depth = 129;
    const xml = `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets><extLst marker="${marker}">${"<node>".repeat(depth)}</node>${"</node>".repeat(depth - 1)}</extLst></workbook>`;

    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: { "xl/workbook.xml": xml } })), marker);
  });

  it("rejects more than 10,000 shared strings before materializing them", () => {
    const marker = "shared-strings-private-marker";
    const items = Array.from({ length: 10_001 }, (_, index) => `<si><t>${markerFor(marker, index)}</t></si>`).join("");
    const xml = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${items}</sst>`;

    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: { "xl/sharedStrings.xml": xml } })), marker);
  });

  it("rejects more than 10,000 worksheet rows before processing them", () => {
    const marker = "worksheet-rows-private-marker";
    const rows = Array.from({ length: 10_001 }, (_, index) => `<row r="${index + 1}" marker="${marker}"/>`).join("");
    const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;

    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: { "xl/worksheets/sheet1.xml": xml } })), marker);
  });

  it("rejects more than 10,000 cells in one worksheet before pushing them", () => {
    const marker = "worksheet-cells-private-marker";
    const cells = Array.from({ length: 10_001 }, (_, index) => `<c r="A${index + 1}"><v>${marker}</v></c>`).join("");
    const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`;

    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: { "xl/worksheets/sheet1.xml": xml } })), marker);
  });

  it("rejects more than 50,000 cells across worksheets before pushing the excess", () => {
    const marker = "total-cells-private-marker";
    const layout = multiSheetXml(6);
    const xmlParts: Record<string, string> = {
      "xl/workbook.xml": layout.workbook,
      "xl/_rels/workbook.xml.rels": layout.relationships,
    };
    for (let index = 1; index <= 6; index += 1) xmlParts[`xl/worksheets/sheet${index}.xml`] = worksheetXml(1, 9_000, marker);

    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts })), marker);
  });

  it("resolves worksheets through workbook relationships and reads supported cell values", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip());
    expect(workbook.worksheets.get("Title Page")?.partName).toBe("xl/worksheets/sheet1.xml");
    expect(workbook.worksheets.get("Auto Summary")?.partName).toBe("xl/worksheets/sheet2.xml");
    expect(workbook.worksheets.get("Title Page")?.cells).toContainEqual({ reference: "A1", value: "anonymous-title-marker" });
    expect(workbook.worksheets.get("Title Page")?.cells).toContainEqual({ reference: "B1", value: "anonymous-inline-marker" });
    expect(workbook.worksheets.get("Analysis-A")?.cells).toContainEqual({ reference: "C2", value: "3", formula: "=SUM(B2:B2)", cachedValue: "3" });
  });

  it("reads internal worksheet drawing media with safe anchors", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({
      xmlParts: {
        "xl/worksheets/_rels/sheet3.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
        "xl/worksheets/sheet3.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="2"><c r="A2" t="s"><v>2</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
        "xl/drawings/drawing1.xml": '<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor><xdr:from><xdr:col>2</xdr:col><xdr:row>2</xdr:row></xdr:from><xdr:to><xdr:col>10</xdr:col><xdr:row>19</xdr:row></xdr:to><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage1"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:twoCellAnchor><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage2"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>',
        "xl/drawings/_rels/drawing1.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/><Relationship Id="rIdImage2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image2.jpeg"/></Relationships>',
      },
      binaryParts: {
        "xl/media/image1.png": new Uint8Array([1, 2, 3]),
        "xl/media/image2.jpeg": new Uint8Array([4, 5, 6]),
      },
    }));

    expect(workbook.worksheets.get("Analysis-A")?.images).toEqual([
      expect.objectContaining({ mediaType: "image/png", byteLength: 3, anchor: { from: "C3", to: "K20" } }),
      expect.objectContaining({ mediaType: "image/jpeg", byteLength: 3, anchor: { from: "A1", to: "A1" } }),
    ]);
  });

  it("retains image metadata when its drawing anchor cannot be parsed", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({
      xmlParts: {
        "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="2"><c r="A2"><v>2</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
        "xl/worksheets/_rels/sheet3.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
        "xl/drawings/drawing1.xml": '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>',
        "xl/drawings/_rels/drawing1.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.gif"/></Relationships>',
      },
      binaryParts: { "xl/media/image1.gif": new Uint8Array([7, 8]) },
    }));

    const image = workbook.worksheets.get("Analysis-A")?.images[0];
    expect(image).toMatchObject({ mediaType: "image/gif", byteLength: 2 });
    expect(image).not.toHaveProperty("anchor");
  });

  it.each([
    ["external drawing relationship", "<Relationship Id=\"rIdDrawing\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing\" Target=\"https://anonymous-private-marker.invalid/drawing.xml\" TargetMode=\"External\"/>"],
    ["escaping drawing relationship", "<Relationship Id=\"rIdDrawing\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing\" Target=\"../../../anonymous-private-marker.xml\"/>"],
  ])("rejects %s without leaking drawing markers", (_name, relationship) => {
    const archive = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="2"><c r="A2"><v>2</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
      "xl/worksheets/_rels/sheet3.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationship}</Relationships>`,
    } });

    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it("rejects duplicated image media targets in one drawing", () => {
    const archive = createAnonymousWorkbookZip({
      xmlParts: {
        "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="2"><c r="A2"><v>2</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
        "xl/worksheets/_rels/sheet3.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
        "xl/drawings/drawing1.xml": '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage1"/><a:blip r:embed="rIdImage2"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>',
        "xl/drawings/_rels/drawing1.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/><Relationship Id="rIdImage2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>',
      },
      binaryParts: { "xl/media/image1.png": new Uint8Array([1]) },
    });

    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it("rejects a worksheet with more than 64 embedded images", () => {
    const anchors = Array.from({ length: 65 }, (_, index) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${index}</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage${index}"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join("");
    const relationships = Array.from({ length: 65 }, (_, index) => `<Relationship Id="rIdImage${index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index}.png"/>`).join("");
    const binaryParts = Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`xl/media/image${index}.png`, new Uint8Array([index]) ]));
    const archive = createAnonymousWorkbookZip({
      xmlParts: {
        "xl/worksheets/sheet3.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row r="2"><c r="A2"><v>2</v></c></row></sheetData><drawing r:id="rIdDrawing"/></worksheet>',
        "xl/worksheets/_rels/sheet3.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDrawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
        "xl/drawings/drawing1.xml": `<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`,
        "xl/drawings/_rels/drawing1.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
      },
      binaryParts,
    });

    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it("reads direct SpreadsheetML metadata around workbook sheets and worksheet sheetData", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Analysis-A" sheetId="3" r:id="rId3"/><sheet name="Analysis-B" sheetId="4" r:id="rId4"/></sheets><calcPr/></workbook>',
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr/><dimension ref="A1:B1"/><sheetViews/><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>anonymous-inline-marker</t></is></c></row></sheetData><mergeCells/><pageMargins/></worksheet>',
      "xl/worksheets/sheet2.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr/><dimension ref="A1"/><sheetViews/><sheetData><row r="1"><c r="A1" t="s"><v>1</v></c></row></sheetData><mergeCells/><pageMargins/></worksheet>',
      "xl/worksheets/sheet3.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr/><dimension ref="A2:C2"/><sheetViews/><sheetData><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>2</v></c><c r="C2"><f>SUM(B2:B2)</f><v>3</v></c></row></sheetData><mergeCells/><pageMargins/></worksheet>',
      "xl/worksheets/sheet4.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr/><dimension ref="A1"/><sheetViews/><sheetData><row r="1"><c r="A1" t="s"><v>3</v></c></row></sheetData><mergeCells/><pageMargins/></worksheet>',
    } }));

    expect(workbook.worksheets.get("Title Page")?.cells).toContainEqual({ reference: "A1", value: "anonymous-title-marker" });
    expect(workbook.worksheets.get("Analysis-A")?.cells).toContainEqual({ reference: "C2", value: "3", formula: "=SUM(B2:B2)", cachedValue: "3" });
  });

  it.each([
    ["workbook", {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><unexpected/><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
    }],
    ["worksheet", {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><unexpected/><sheetData><row r="1"><c r="A1"><v>anonymous-private-marker</v></c></row></sheetData></worksheet>',
    }],
    ["shared strings", {
      "xl/sharedStrings.xml": '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><unexpected/><si><t>anonymous-private-marker</t></si></sst>',
    }],
  ])("rejects an unexpected same-namespace direct child in %s", (_container, xmlParts) => {
    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts })));
  });

  it("reads rich shared and inline strings with supported run properties", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: {
      "xl/sharedStrings.xml": '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><r><rPr><b/><color rgb="FF000000"/></rPr><t>anonymous-rich-</t></r><r><rPr><sz val="11"/><u/></rPr><t>shared-marker</t></r></si><si><t>anonymous-summary-marker</t></si><si><t>Analysis-A</t></si><si><t>Analysis-B</t></si></sst>',
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><r><rPr><i/><rFont val="Aptos"/></rPr><t>anonymous-rich-</t></r><r><t>inline-marker</t></r></is></c></row></sheetData></worksheet>',
    } }));

    expect(workbook.worksheets.get("Title Page")?.cells).toContainEqual({ reference: "A1", value: "anonymous-rich-shared-marker" });
    expect(workbook.worksheets.get("Title Page")?.cells).toContainEqual({ reference: "B1", value: "anonymous-rich-inline-marker" });
  });

  it.each([
    ["mixed text and runs", '<t>anonymous-private-marker</t><r><t>more</t></r>'],
    ["phonetic run", '<rPh><t>anonymous-private-marker</t></rPh>'],
    ["phonetic properties", '<phoneticPr/>'],
    ["extension list", '<extLst/>'],
    ["unknown direct child", '<unexpected/>'],
    ["foreign direct child", '<foreign xmlns="urn:anonymous-private-marker"/>'],
    ["run without text", '<r><rPr><b/></rPr></r>'],
    ["run with multiple text nodes", '<r><t>anonymous-private-marker</t><t>more</t></r>'],
    ["run with multiple properties", '<r><rPr><b/></rPr><rPr><i/></rPr><t>anonymous-private-marker</t></r>'],
    ["unknown run properties child", '<r><rPr><unexpected/></rPr><t>anonymous-private-marker</t></r>'],
    ["foreign run properties child", '<r><rPr><foreign xmlns="urn:anonymous-private-marker"/></rPr><t>anonymous-private-marker</t></r>'],
    ["text with child element", '<r><t><unexpected/></t></r>'],
  ])("rejects malformed shared rich text: %s without leaking reader markers", (_name, content) => {
    const archive = createAnonymousWorkbookZip({ xmlParts: {
      "xl/sharedStrings.xml": `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si>${content}</si></sst>`,
    } });

    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it.each([
    ["mixed text and runs", '<t>anonymous-private-marker</t><r><t>more</t></r>'],
    ["unknown direct child", '<unexpected/>'],
    ["foreign direct child", '<foreign xmlns="urn:anonymous-private-marker"/>'],
    ["run without text", '<r><rPr><b/></rPr></r>'],
    ["run with multiple text nodes", '<r><t>anonymous-private-marker</t><t>more</t></r>'],
    ["run with multiple properties", '<r><rPr><b/></rPr><rPr><i/></rPr><t>anonymous-private-marker</t></r>'],
  ])("rejects malformed inline rich text: %s without leaking reader markers", (_name, content) => {
    const archive = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is>${content}</is></c></row></sheetData></worksheet>`,
    } });

    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it("preserves formula cells without a cached value", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({ missingCachedCellValue: true }));
    expect(workbook.worksheets.get("Analysis-A")?.cells).toContainEqual({ reference: "C2", value: "", formula: "=SUM(B2:B2)" });
  });

  it("rejects a sheet relationship whose type is chartsheet", () => {
    const archive = createAnonymousWorkbookZip({ xmlParts: {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet" Target="chartsheets/chart1.xml"/></Relationships>',
      "xl/chartsheets/chart1.xml": '<?xml version="1.0"?><chartsheet/>',
    } });

    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it("reads string cells with t='str'", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="str"><v>anonymous-string-marker</v></c></row></sheetData></worksheet>',
    } }));

    expect(workbook.worksheets.get("Title Page")?.cells).toContainEqual({ reference: "A1", value: "anonymous-string-marker" });
  });

  it.each([
    ["wrong workbook root", {
      "xl/workbook.xml": '<?xml version="1.0"?><notworkbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></notworkbook>',
    }],
    ["wrong relationships root", {
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><notRelationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></notRelationships>',
    }],
    ["wrong worksheet root", {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><notworksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></notworksheet>',
    }],
    ["wrong shared strings root", {
      "xl/sharedStrings.xml": '<?xml version="1.0"?><notsst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>anonymous-private-marker</t></si></notsst>',
    }],
    ["foreign nested sheet", {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><foreign xmlns="urn:anonymous-private-marker"><sheet name="Title Page" sheetId="1" r:id="rId1"/></foreign></workbook>',
    }],
    ["foreign nested relationship", {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><foreign xmlns="urn:anonymous-private-marker"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></foreign></Relationships>',
    }],
    ["foreign nested row", {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><foreign xmlns="urn:anonymous-private-marker"><row r="1"><c r="A1" t="inlineStr"><is><t>anonymous-private-marker</t></is></c></row></foreign></worksheet>',
    }],
    ["foreign direct workbook child", {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><foreign xmlns="urn:anonymous-private-marker"/><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
    }],
    ["foreign direct worksheet child", {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><foreign xmlns="urn:anonymous-private-marker"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>anonymous-private-marker</t></is></c></row></sheetData></worksheet>',
    }],
  ])("rejects %s", (_name, xmlParts) => {
    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts })));
  });

  it.each([
    ["fatal malformed XML diagnostics", createAnonymousWorkbookZip({ xmlParts: { "xl/workbook.xml": '<workbook><anonymous-private-marker></workbook>' } })],
    ["unsafe relationship target", createAnonymousWorkbookZip({ xmlParts: { "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="../anonymous-private-marker.xml"/></Relationships>' } })],
    ["duplicate relationship IDs", createAnonymousWorkbookZip({ xmlParts: { "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' } })],
    ["unknown sheet relationship ID", createAnonymousWorkbookZip({ xmlParts: { "xl/workbook.xml": '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="anonymous-private-marker" sheetId="1" r:id="missing"/></sheets></workbook>' } })],
  ])("rejects %s without leaking reader markers", (_name, archive) => {
    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it.each([
    ["duplicate sheet", createAnonymousWorkbookZip({ duplicateSheet: true })],
    ["missing relationship target", createAnonymousWorkbookZip({ xmlParts: { "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/missing.xml"/></Relationships>' } })],
    ["duplicate row", createAnonymousWorkbookZip({ duplicateRow: true })],
    ["wrapper around sheet", createAnonymousWorkbookZip({ xmlParts: {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><wrapper><sheet name="Title Page" sheetId="1" r:id="rId1"/></wrapper></sheets></workbook>',
    } })],
    ["wrapper around row", createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><wrapper><row r="1"><c r="A1"><v>1</v></c></row></wrapper></sheetData></worksheet>',
    } })],
    ["duplicate direct sheets", createAnonymousWorkbookZip({ xmlParts: {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets><sheets><sheet name="Auto Summary" sheetId="2" r:id="rId2"/></sheets></workbook>',
    } })],
    ["duplicate direct sheetData", createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData><sheetData><row r="2"><c r="A2"><v>2</v></c></row></sheetData></worksheet>',
    } })],
  ])("rejects %s", (_name, archive) => {
    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it("reads a fully ISO/IEC 29500 Strict workbook with the same values as Transitional OOXML", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({ namespaceFamily: "strict" }));

    expect(workbook.worksheets.get("Title Page")?.cells).toContainEqual({ reference: "A1", value: "anonymous-title-marker" });
    expect(workbook.worksheets.get("Title Page")?.cells).toContainEqual({ reference: "B1", value: "anonymous-inline-marker" });
    expect(workbook.worksheets.get("Analysis-A")?.cells).toContainEqual({ reference: "C2", value: "3", formula: "=SUM(B2:B2)", cachedValue: "3" });
  });

  it.each([
    ["Strict workbook with non-normative package relationship root", createAnonymousWorkbookZip({ namespaceFamily: "strict", xmlParts: {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://purl.oclc.org/ooxml/spreadsheetml/main" xmlns:r="http://purl.oclc.org/ooxml/officeDocument/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://purl.oclc.org/ooxml/package/relationships"><Relationship Id="rId1" Type="http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    } })],
    ["Strict workbook with non-normative package relationship child", createAnonymousWorkbookZip({ namespaceFamily: "strict", xmlParts: {
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship xmlns="http://purl.oclc.org/ooxml/package/relationships" Id="rId1" Type="http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    } })],
    ["Transitional workbook with non-normative package relationship root", createAnonymousWorkbookZip({ xmlParts: {
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://purl.oclc.org/ooxml/package/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    } })],
    ["Transitional workbook with non-normative package relationship child", createAnonymousWorkbookZip({ xmlParts: {
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship xmlns="http://purl.oclc.org/ooxml/package/relationships" Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    } })],
    ["workbook relationship namespace", {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://purl.oclc.org/ooxml/spreadsheetml/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
    }],
    ["worksheet relationship type", {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://purl.oclc.org/ooxml/spreadsheetml/main" xmlns:r="http://purl.oclc.org/ooxml/officeDocument/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    }],
    ["worksheet SpreadsheetML namespace", {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://purl.oclc.org/ooxml/spreadsheetml/main" xmlns:r="http://purl.oclc.org/ooxml/officeDocument/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    }],
    ["shared-string SpreadsheetML namespace", {
      "xl/workbook.xml": '<?xml version="1.0"?><workbook xmlns="http://purl.oclc.org/ooxml/spreadsheetml/main" xmlns:r="http://purl.oclc.org/ooxml/officeDocument/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/sharedStrings.xml": '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>anonymous-private-marker</t></si></sst>',
    }],
  ])("rejects mixed OOXML namespace families in %s", (_name, xmlParts) => {
    expectArchiveError(() => readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts })));
  });

  it.each([
    ["formula", '<c r="A1"><f>anonymous-private-marker<child/></f></c>'],
    ["formula foreign child", '<c r="A1"><f>anonymous-private-marker<child xmlns="urn:anonymous-private-marker"/></f></c>'],
    ["cached formula value", '<c r="A1"><f>1+1</f><v>anonymous-private-marker<child/></v></c>'],
    ["cached formula value foreign child", '<c r="A1"><f>1+1</f><v>anonymous-private-marker<child xmlns="urn:anonymous-private-marker"/></v></c>'],
    ["numeric value", '<c r="A1"><v>anonymous-private-marker<child/></v></c>'],
    ["numeric value foreign child", '<c r="A1"><v>anonymous-private-marker<child xmlns="urn:anonymous-private-marker"/></v></c>'],
    ["string value", '<c r="A1" t="str"><v>anonymous-private-marker<child/></v></c>'],
    ["string value foreign child", '<c r="A1" t="str"><v>anonymous-private-marker<child xmlns="urn:anonymous-private-marker"/></v></c>'],
    ["shared string index", '<c r="A1" t="s"><v>0<child/></v></c>'],
    ["shared string index foreign child", '<c r="A1" t="s"><v>0<child xmlns="urn:anonymous-private-marker"/></v></c>'],
  ])("rejects a %s with nested element content without leaking reader markers", (_name, cell) => {
    const archive = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cell}</row></sheetData></worksheet>`,
    } });

    expectArchiveError(() => readOoxmlWorkbook(archive));
  });

  it("supports each allowed non-formula and formula cell structure", () => {
    const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"/><c r="B1"><v>1</v></c><c r="C1" t="n"><v>2</v></c><c r="D1" t="str"><v>anonymous-string-marker</v></c><c r="E1" t="s"><v>0</v></c><c r="F1" t="inlineStr"><is><t>anonymous-inline-marker</t></is></c><c r="G1"><f>1+1</f></c><c r="H1" t="n"><f>1+2</f><v>3</v></c><c r="I1" t="str"><f>CONCAT(&quot;a&quot;,&quot;b&quot;)</f><v>ab</v></c></row></sheetData></worksheet>',
    } }));

    expect(workbook.worksheets.get("Title Page")?.cells).toEqual([
      { reference: "A1", value: "" }, { reference: "B1", value: "1" }, { reference: "C1", value: "2" },
      { reference: "D1", value: "anonymous-string-marker" }, { reference: "E1", value: "anonymous-title-marker" },
      { reference: "F1", value: "anonymous-inline-marker" }, { reference: "G1", value: "", formula: "=1+1" },
      { reference: "H1", value: "3", formula: "=1+2", cachedValue: "3" },
      { reference: "I1", value: "ab", formula: '=CONCAT("a","b")', cachedValue: "ab" },
    ]);
  });

  it.each([
    ["unsupported boolean type", '<c r="A1" t="b"><v>1</v></c>'], ["unsupported date type", '<c r="A1" t="d"><v>2026-07-23</v></c>'],
    ["unsupported error type", '<c r="A1" t="e"><v>#VALUE!</v></c>'], ["duplicate formula", '<c r="A1"><f>1</f><f>2</f></c>'],
    ["duplicate value", '<c r="A1"><v>1</v><v>2</v></c>'], ["duplicate inline string", '<c r="A1" t="inlineStr"><is><t>anonymous-private-marker</t></is><is><t>two</t></is></c>'],
    ["value and inline string", '<c r="A1"><v>1</v><is><t>anonymous-private-marker</t></is></c>'], ["inline string for numeric type", '<c r="A1"><is><t>anonymous-private-marker</t></is></c>'],
    ["inline string with value", '<c r="A1" t="inlineStr"><is><t>anonymous-private-marker</t></is><v>1</v></c>'], ["inline string with formula", '<c r="A1" t="inlineStr"><f>1</f><is><t>anonymous-private-marker</t></is></c>'],
    ["formula with inline string", '<c r="A1"><f>1</f><is><t>anonymous-private-marker</t></is></c>'],
    ["string cell without value", '<c r="A1" t="str"/>'], ["shared string without value", '<c r="A1" t="s"/>'],
  ])("rejects malformed cell structure: %s without leaking reader markers", (_name, cell) => {
    const archive = createAnonymousWorkbookZip({ xmlParts: {
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cell}</row></sheetData></worksheet>`,
    } });
    expectArchiveError(() => readOoxmlWorkbook(archive));
  });
});