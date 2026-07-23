import { strToU8, zipSync } from "fflate";

export interface AnonymousWorkbookOptions {
  readonly namespaceFamily?: "transitional" | "strict";
  readonly xmlParts?: Readonly<Record<string, string>>;
  readonly binaryParts?: Readonly<Record<string, Uint8Array>>;
  readonly omittedParts?: readonly string[];
  readonly unsafeEntryName?: string;
  readonly missingCachedCellValue?: boolean;
  readonly duplicateSheet?: boolean;
  readonly duplicateRow?: boolean;
  readonly duplicateEntryName?: boolean;
  readonly zip64?: boolean;
  readonly highlyCompressibleEntry?: boolean;
}

const NAMESPACE_FAMILIES = {
  transitional: {
    spreadsheetml: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    officeRelationships: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  },
  strict: {
    spreadsheetml: "http://purl.oclc.org/ooxml/spreadsheetml/main",
    officeRelationships: "http://purl.oclc.org/ooxml/officeDocument/relationships",
  },
} as const;

const PACKAGE_RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";

const workbookXml = (duplicateSheet: boolean, namespaceFamily: (typeof NAMESPACE_FAMILIES)[keyof typeof NAMESPACE_FAMILIES]) => `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="${namespaceFamily.spreadsheetml}" xmlns:r="${namespaceFamily.officeRelationships}"><sheets>
  <sheet name="Title Page" sheetId="1" r:id="rId1"/>
  <sheet name="Auto Summary" sheetId="2" r:id="rId2"/>
  <sheet name="Analysis-A" sheetId="3" r:id="rId3"/>
  <sheet name="Analysis-B" sheetId="4" r:id="rId4"/>
  ${duplicateSheet ? '<sheet name="Title Page" sheetId="5" r:id="rId3"/>' : ""}
</sheets></workbook>`;

function addDuplicateCentralEntry(bytes: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBufferLike> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = bytes.length - 22;
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const nameLength = view.getUint16(centralOffset + 28, true);
  const extraLength = view.getUint16(centralOffset + 30, true);
  const commentLength = view.getUint16(centralOffset + 32, true);
  const recordLength = 46 + nameLength + extraLength + commentLength;
  const duplicate = bytes.slice(centralOffset, centralOffset + recordLength);
  const result = new Uint8Array(bytes.length + duplicate.length);
  result.set(bytes.slice(0, eocdOffset), 0);
  result.set(duplicate, eocdOffset);
  result.set(bytes.slice(eocdOffset), eocdOffset + duplicate.length);
  const resultView = new DataView(result.buffer);
  const resultEocdOffset = eocdOffset + duplicate.length;
  resultView.setUint16(resultEocdOffset + 8, view.getUint16(eocdOffset + 8, true) + 1, true);
  resultView.setUint16(resultEocdOffset + 10, view.getUint16(eocdOffset + 10, true) + 1, true);
  resultView.setUint32(resultEocdOffset + 12, centralSize + duplicate.length, true);
  return result;
}

function markZip64(bytes: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBufferLike> {
  const result = bytes.slice();
  const view = new DataView(result.buffer);
  const eocdOffset = result.length - 22;
  view.setUint16(eocdOffset + 8, 0xffff, true);
  return result;
}

export function createAnonymousWorkbookZip(options: AnonymousWorkbookOptions = {}): Uint8Array {
  const namespaceFamily = NAMESPACE_FAMILIES[options.namespaceFamily ?? "transitional"];
  const cache = options.missingCachedCellValue ? "" : "<v>3</v>";
  const duplicateRow = options.duplicateRow ? '<row r="2"><c r="D2"><v>4</v></c></row>' : "";
  const parts: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "_rels/.rels": strToU8(`<?xml version="1.0"?><Relationships xmlns="${PACKAGE_RELATIONSHIPS_NAMESPACE}"/>`),
    "xl/workbook.xml": strToU8(workbookXml(options.duplicateSheet === true, namespaceFamily)),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0"?><Relationships xmlns="${PACKAGE_RELATIONSHIPS_NAMESPACE}"><Relationship Id="rId1" Type="${namespaceFamily.officeRelationships}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${namespaceFamily.officeRelationships}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${namespaceFamily.officeRelationships}/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="${namespaceFamily.officeRelationships}/worksheet" Target="worksheets/sheet4.xml"/></Relationships>`),
    "xl/sharedStrings.xml": strToU8(`<?xml version="1.0"?><sst xmlns="${namespaceFamily.spreadsheetml}"><si><t>anonymous-title-marker</t></si><si><t>anonymous-summary-marker</t></si><si><t>Analysis-A</t></si><si><t>Analysis-B</t></si></sst>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0"?><worksheet xmlns="${namespaceFamily.spreadsheetml}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>anonymous-inline-marker</t></is></c></row></sheetData></worksheet>`),
    "xl/worksheets/sheet2.xml": strToU8(`<?xml version="1.0"?><worksheet xmlns="${namespaceFamily.spreadsheetml}"><sheetData><row r="1"><c r="A1" t="s"><v>1</v></c></row></sheetData></worksheet>`),
    "xl/worksheets/sheet3.xml": strToU8(`<?xml version="1.0"?><worksheet xmlns="${namespaceFamily.spreadsheetml}"><sheetData>${duplicateRow}<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>2</v></c><c r="C2"><f>SUM(B2:B2)</f>${cache}</c></row></sheetData></worksheet>`),
    "xl/worksheets/sheet4.xml": strToU8(`<?xml version="1.0"?><worksheet xmlns="${namespaceFamily.spreadsheetml}"><sheetData><row r="1"><c r="A1" t="s"><v>3</v></c></row></sheetData></worksheet>`),
  };
  for (const [partName, xml] of Object.entries(options.xmlParts ?? {})) parts[partName] = strToU8(xml);
  for (const [partName, content] of Object.entries(options.binaryParts ?? {})) parts[partName] = content;
  for (const partName of options.omittedParts ?? []) delete parts[partName];
  if (options.unsafeEntryName) parts[options.unsafeEntryName] = strToU8("anonymous-private-marker");
  if (options.highlyCompressibleEntry) parts["xl/repeated.xml"] = strToU8("0".repeat(200_000));

  let archive: Uint8Array<ArrayBufferLike> = zipSync(parts, { level: 9 });
  if (options.duplicateEntryName) archive = addDuplicateCentralEntry(archive);
  if (options.zip64) archive = markZip64(archive);
  return archive;
}