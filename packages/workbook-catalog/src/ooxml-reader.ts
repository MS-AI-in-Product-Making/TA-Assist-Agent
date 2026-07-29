import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import { createHash } from "node:crypto";
import { createTypedError } from "@ai-assist/contracts";
import { MAX_XML_PART_BYTES, readSafeZip } from "./zip-security.js";

export interface OoxmlCell { readonly reference: string; readonly value: string; readonly formula?: string; readonly cachedValue?: string; }
export interface OoxmlImage { readonly contentHash: string; readonly mediaType: string; readonly byteLength: number; readonly sourcePart: string; readonly drawingSourcePart: string; readonly anchor?: { readonly from: string; readonly to: string }; readonly bytes: Uint8Array; }
export interface OoxmlWorksheet { readonly name: string; readonly partName: string; readonly cells: readonly OoxmlCell[]; readonly images: readonly OoxmlImage[]; }
export interface OoxmlWorkbook { readonly worksheets: ReadonlyMap<string, OoxmlWorksheet>; readonly worksheetNames: ReadonlySet<string>; }
export interface OoxmlCellWindow { readonly maxRow: number; readonly maxColumn: string; }

const ARCHIVE_SUMMARY = "Workbook-catalog archive cannot be processed.";
export const MAX_DOM_NODES_PER_PART = 50_000;
export const MAX_DOM_DEPTH = 128;
export const MAX_IMAGES_PER_WORKSHEET = 64;
export const MAX_IMAGES_PER_WORKBOOK = 256;
export const MAX_SHARED_STRINGS = 10_000;
export const MAX_ROWS_PER_WORKSHEET = 10_000;
const MAX_WINDOW_DOM_NODES_PER_PART = 250_000;
const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const SPREADSHEET_DRAWING_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const OFFICE_RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MARKUP_COMPATIBILITY_NAMESPACE = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const REVISION_NAMESPACE = "http://schemas.microsoft.com/office/spreadsheetml/2014/revision";
export const MAX_CELLS_PER_WORKSHEET = 10_000;
export const MAX_TOTAL_CELLS = 50_000;
const utf8 = new TextDecoder("utf-8", { fatal: true });
const PACKAGE_RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";
const WORKBOOK_CHILDREN = ["fileVersion", "fileSharing", "workbookPr", "workbookProtection", "bookViews", "sheets", "functionGroups", "externalReferences", "definedNames", "calcPr", "oleSize", "customWorkbookViews", "pivotCaches", "smartTagPr", "smartTagTypes", "webPublishing", "fileRecoveryPr", "webPublishObjects", "extLst"];
const WORKSHEET_CHILDREN = ["sheetPr", "dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData", "sheetCalcPr", "sheetProtection", "protectedRanges", "scenarios", "autoFilter", "sortState", "dataConsolidate", "customSheetViews", "mergeCells", "phoneticPr", "conditionalFormatting", "dataValidations", "hyperlinks", "printOptions", "pageMargins", "pageSetup", "pageSetupPr", "headerFooter", "rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors", "smartTags", "drawing", "legacyDrawing", "legacyDrawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"];
function relationshipPartName(partName: string): string {
  const index = partName.lastIndexOf("/");
  if (index < 0) throw archiveError();
  return `${partName.slice(0, index)}/_rels/${partName.slice(index + 1)}.rels`;
}

function resolveTarget(sourcePart: string, target: string): string | undefined {
  if (!target || target.includes("\\") || target.startsWith("/") || /^[A-Za-z]:/.test(target)) return undefined;
  const resolved = sourcePart.split("/");
  resolved.pop();
  for (const component of target.split("/")) {
    if (!component || component === ".") continue;
    if (component === "..") {
      if (resolved.length <= 1) return undefined;
      resolved.pop();
    } else resolved.push(component);
  }
  const name = resolved.join("/");
  return name.startsWith("xl/") ? name : undefined;
}

interface Relationship { readonly target: string; readonly type: string; }

function relationships(document: Document, sourcePart: string): ReadonlyMap<string, Relationship> {
  const root = document.documentElement;
  if (!isElement(root, PACKAGE_RELATIONSHIPS_NAMESPACE, "Relationships")) throw archiveError();
  const result = new Map<string, Relationship>();
  for (const relationship of onlyChildren(root, PACKAGE_RELATIONSHIPS_NAMESPACE, "Relationship")) {
    const id = relationship.getAttribute("Id");
    const target = resolveTarget(sourcePart, relationship.getAttribute("Target") ?? "");
    if (!id || !target || relationship.getAttribute("TargetMode") === "External" || result.has(id)) throw archiveError();
    result.set(id, { target, type: relationship.getAttribute("Type") ?? "" });
  }
  return result;
}
const RICH_TEXT_RUN_PROPERTIES = ["rFont", "charset", "family", "b", "i", "strike", "outline", "shadow", "condense", "extend", "color", "sz", "u", "vertAlign", "scheme"];

interface OoxmlNamespaceFamily {
  readonly spreadsheetml: string;
  readonly officeRelationships: string;
  readonly worksheetRelationshipType: string;
}

const OOXML_NAMESPACE_FAMILIES: readonly OoxmlNamespaceFamily[] = [
  {
    spreadsheetml: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    officeRelationships: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    worksheetRelationshipType: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
  },
  {
    spreadsheetml: "http://purl.oclc.org/ooxml/spreadsheetml/main",
    officeRelationships: "http://purl.oclc.org/ooxml/officeDocument/relationships",
    worksheetRelationshipType: "http://purl.oclc.org/ooxml/officeDocument/relationships/worksheet",
  },
];

function archiveError(): Error {
  return createTypedError({ code: "validation_error", summary: ARCHIVE_SUMMARY, suggestedAction: "Provide a supported workbook archive.", affectedInputReferences: ["workbook-structure"] });
}

function isElement(element: Element | null | undefined, namespace: string, localName: string): element is Element {
  return element?.namespaceURI === namespace && element.localName === localName;
}

function onlyChildren(element: Element, namespace: string, localName: string): Element[] {
  const children = Array.from(element.childNodes).filter((node): node is Element => node.nodeType === 1) as Element[];
  if (children.some((child) => !isElement(child, namespace, localName))) throw archiveError();
  return children;
}

function allowedChildren(element: Element, namespace: string, localNames: readonly string[]): Element[] {
  const children = Array.from(element.childNodes).filter((node): node is Element => node.nodeType === 1) as Element[];
  if (children.some((child) => child.namespaceURI !== namespace || !child.localName || !localNames.includes(child.localName))) throw archiveError();
  return children;
}

function workbookChildren(root: Element, family: OoxmlNamespaceFamily): Element[] {
  const children = Array.from(root.childNodes).filter((node): node is Element => node.nodeType === 1) as Element[];
  for (const child of children) {
    const localName = child.localName ?? "";
    const isSpreadsheetmlWorkbookChild = child.namespaceURI === family.spreadsheetml && localName.length > 0 && WORKBOOK_CHILDREN.includes(localName);
    const isKnownCompatibilityChild =
      (child.namespaceURI === MARKUP_COMPATIBILITY_NAMESPACE && child.localName === "AlternateContent")
      || (child.namespaceURI === REVISION_NAMESPACE && child.localName === "revisionPtr");
    if (!isSpreadsheetmlWorkbookChild && !isKnownCompatibilityChild) throw archiveError();
  }
  return children;
}

function richText(element: Element, family: OoxmlNamespaceFamily): string {
  const children = allowedChildren(element, family.spreadsheetml, ["t", "r", "rPh", "phoneticPr"]);
  const textNodes = children.filter((child) => child.localName === "t");
  const runs = children.filter((child) => child.localName === "r");
  const phoneticRuns = children.filter((child) => child.localName === "rPh");
  const phoneticProperties = children.filter((child) => child.localName === "phoneticPr");
  if (phoneticProperties.length > 1) throw archiveError();
  for (const phoneticRun of phoneticRuns) {
    const phoneticTexts = allowedChildren(phoneticRun, family.spreadsheetml, ["t"]);
    if (phoneticTexts.length !== 1 || allowedChildren(phoneticTexts[0]!, family.spreadsheetml, []).length !== 0) throw archiveError();
  }
  if (textNodes.length > 0) {
    if (textNodes.length !== 1 || runs.length !== 0 || allowedChildren(textNodes[0]!, family.spreadsheetml, []).length !== 0) throw archiveError();
    return text(textNodes[0]);
  }
  if (runs.length === 0) throw archiveError();
  return runs.map((run) => {
    const runChildren = allowedChildren(run, family.spreadsheetml, ["rPr", "t"]);
    const runProperties = runChildren.filter((child) => child.localName === "rPr");
    const runTexts = runChildren.filter((child) => child.localName === "t");
    if (runProperties.length > 1 || runTexts.length !== 1 || allowedChildren(runTexts[0]!, family.spreadsheetml, []).length !== 0) throw archiveError();
    if (runProperties[0]) allowedChildren(runProperties[0], family.spreadsheetml, RICH_TEXT_RUN_PROPERTIES);
    return text(runTexts[0]);
  }).join("");
}

function text(element: Element | undefined): string {
  if (element && Array.from(element.childNodes).some((node) => node.nodeType === 1)) throw archiveError();
  return element?.textContent ?? "";
}

function parseXml(bytes: Uint8Array, budget?: { readonly maxNodes?: number; readonly maxDepth?: number }): Document {
  if (bytes.byteLength > MAX_XML_PART_BYTES) throw archiveError();
  let source: string;
  try {
    source = utf8.decode(bytes);
  } catch {
    throw archiveError();
  }
  const diagnostics: string[] = [];
  const document = new DOMParser({ locator: false, onError: (_level, message) => diagnostics.push(message) }).parseFromString(source, "application/xml");
  if (diagnostics.length > 0 || document.documentElement?.localName === "parsererror") throw archiveError();
  assertDomBudget(document, budget);
  return document;
}

function assertDomBudget(document: Document, budget?: { readonly maxNodes?: number; readonly maxDepth?: number }): void {
  const root = document.documentElement;
  if (!root) throw archiveError();
  const maxNodes = budget?.maxNodes ?? MAX_DOM_NODES_PER_PART;
  const maxDepth = budget?.maxDepth ?? MAX_DOM_DEPTH;
  const pending = [{ node: root, depth: 1 }];
  let count = 1;
  for (let index = 0; index < pending.length; index += 1) {
    const { node, depth } = pending[index]!;
    if (depth > maxDepth) throw archiveError();
    count += node.attributes?.length ?? 0;
    if (count > maxNodes) throw archiveError();
    for (let childIndex = 0; childIndex < node.childNodes.length; childIndex += 1) {
      const child = node.childNodes.item(childIndex);
      if (!child) continue;
      count += 1;
      pending.push({ node: child as Element, depth: depth + 1 });
    }
  }
}

function safeTarget(target: string): string | undefined {
  if (!target || target.includes("\\") || target.startsWith("/") || /^[A-Za-z]:/.test(target) || target.split("/").some((part) => !part || part === "..")) return undefined;
  return `xl/${target}`;
}

function sharedStrings(document: Document | undefined, family: OoxmlNamespaceFamily): string[] {
  if (!document) return [];
  const root = document.documentElement;
  if (!isElement(root, family.spreadsheetml, "sst")) throw archiveError();
  const strings: string[] = [];
  for (const child of allowedChildren(root, family.spreadsheetml, ["si", "extLst"])) {
    if (child.localName !== "si") continue;
    if (strings.length >= MAX_SHARED_STRINGS) throw archiveError();
    strings.push(richText(child, family));
  }
  return strings;
}

interface CellBudget { total: number; }

function columnIndex(letters: string): number {
  let value = 0;
  for (const char of letters) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) throw archiveError();
    value = value * 26 + (code - 64);
  }
  return value;
}

function splitCellReference(reference: string): { readonly column: string; readonly row: number } {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(reference);
  if (!match) throw archiveError();
  return { column: match[1]!, row: Number(match[2]) };
}

function readCells(document: Document, strings: readonly string[], family: OoxmlNamespaceFamily, budget: CellBudget, cellWindow?: OoxmlCellWindow): OoxmlCell[] {
  const cells: OoxmlCell[] = [];
  const rows = new Set<string>();
  const references = new Set<string>();
  const root = document.documentElement;
  if (!isElement(root, family.spreadsheetml, "worksheet")) throw archiveError();
  const sheetData = allowedChildren(root, family.spreadsheetml, WORKSHEET_CHILDREN).filter((child) => child.localName === "sheetData");
  const sheetDataElement = sheetData[0];
  if (sheetData.length !== 1 || !sheetDataElement) throw archiveError();
  const maxRow = cellWindow?.maxRow;
  const maxColumnIndex = cellWindow ? columnIndex(cellWindow.maxColumn) : undefined;
  const supportsErrorCells = cellWindow !== undefined;
  for (const row of onlyChildren(sheetDataElement, family.spreadsheetml, "row")) {
    if (rows.size >= MAX_ROWS_PER_WORKSHEET) throw archiveError();
    const rowNumber = row.getAttribute("r");
    if (!rowNumber || rows.has(rowNumber)) throw archiveError();
    rows.add(rowNumber);
    const rowValue = Number(rowNumber);
    if (!Number.isInteger(rowValue) || rowValue <= 0) throw archiveError();
    if (maxRow !== undefined && rowValue > maxRow) continue;
    for (const cell of onlyChildren(row, family.spreadsheetml, "c")) {
      if (cells.length >= MAX_CELLS_PER_WORKSHEET || budget.total >= MAX_TOTAL_CELLS) throw archiveError();
      const reference = cell.getAttribute("r");
      if (!reference || references.has(reference)) throw archiveError();
      references.add(reference);
      const location = splitCellReference(reference);
      if (maxColumnIndex !== undefined && columnIndex(location.column) > maxColumnIndex) continue;
      const type = cell.getAttribute("t") || undefined;
      const children = allowedChildren(cell, family.spreadsheetml, ["f", "v", "is"]);
      const formulaNodes = children.filter((child) => child.localName === "f");
      const valueNodes = children.filter((child) => child.localName === "v");
      const inlineStringNodes = children.filter((child) => child.localName === "is");
      const formulaNode = formulaNodes[0];
      const valueNode = valueNodes[0];
      if (formulaNodes.length > 1 || valueNodes.length > 1 || inlineStringNodes.length > 1 || ![undefined, "n", "str", "s", "inlineStr", ...(supportsErrorCells ? ["e"] : [])].includes(type ?? undefined)) throw archiveError();
      if (formulaNode) {
        if (type === "s" || type === "inlineStr" || inlineStringNodes.length !== 0) throw archiveError();
      } else if (type === "inlineStr") {
        if (inlineStringNodes.length !== 1 || valueNode) throw archiveError();
      } else if (inlineStringNodes.length !== 0) {
        throw archiveError();
      } else if (valueNode) {
        if (type !== undefined && type !== "n" && type !== "str" && type !== "s" && (!supportsErrorCells || type !== "e")) throw archiveError();
      } else if (type === "n" || type === "str" || type === "s" || children.length !== 0) {
        throw archiveError();
      }
      const cached = text(valueNode);
      const formula = formulaNode ? `=${text(formulaNode)}` : undefined;
      let value = cached;
      if (!formula && type === "s") {
        const index = Number(cached);
        if (!Number.isInteger(index) || index < 0 || strings[index] === undefined) throw archiveError();
        value = strings[index];
      } else if (!formula && type === "inlineStr") {
        value = richText(inlineStringNodes[0]!, family);
      }
      cells.push({ reference, value, ...(formula ? { formula, ...(valueNode ? { cachedValue: cached } : {}) } : {}) });
      budget.total += 1;
    }
  }
  return cells;
}

function anchorCell(anchor: Element, name: "from" | "to"): string | undefined {
  const marker = Array.from(anchor.childNodes)
    .filter((node): node is Element => node.nodeType === 1)
    .find((child) => child.namespaceURI === SPREADSHEET_DRAWING_NAMESPACE && child.localName === name);
  if (!marker) return undefined;
  const values = new Map<string, number>();
  for (const value of allowedChildren(marker, SPREADSHEET_DRAWING_NAMESPACE, ["col", "colOff", "row", "rowOff"])) {
    const localName = value.localName;
    if (!localName || localName === "colOff" || localName === "rowOff") continue;
    const number = Number(text(value));
    if (!Number.isInteger(number) || number < 0 || values.has(localName)) throw archiveError();
    values.set(localName, number);
  }
  const column = values.get("col");
  const row = values.get("row");
  if (column === undefined || row === undefined) throw archiveError();
  let letters = "";
  for (let value = column + 1; value > 0; value = Math.floor((value - 1) / 26)) letters = String.fromCharCode(65 + (value - 1) % 26) + letters;
  return `${letters}${row + 1}`;
}

function imageIds(anchor: Element): string[] {
  const pending: Element[] = [anchor];
  const ids: string[] = [];
  for (let index = 0; index < pending.length; index += 1) {
    for (const node of Array.from(pending[index]!.childNodes)) {
      if (node.nodeType !== 1) continue;
      const child = node as Element;
      if (child.namespaceURI === DRAWINGML_NAMESPACE && child.localName === "blip") {
        const id = child.getAttributeNS(OFFICE_RELATIONSHIPS_NAMESPACE, "embed");
        if (!id) throw archiveError();
        ids.push(id);
      }
      if (child.namespaceURI === SPREADSHEET_DRAWING_NAMESPACE || child.namespaceURI === DRAWINGML_NAMESPACE) pending.push(child);
    }
  }
  return ids;
}

function imageMediaType(partName: string): string {
  const extension = partName.slice(partName.lastIndexOf(".") + 1).toLowerCase();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff", emf: "image/emf", wmf: "image/wmf" } as Record<string, string>)[extension] ?? "application/octet-stream";
}

function readImages(document: Document, worksheetPart: string, parts: ReadonlyMap<string, Uint8Array>, family: OoxmlNamespaceFamily, total: { value: number }): OoxmlImage[] {
  const root = document.documentElement;
  if (!root) throw archiveError();
  const drawings = allowedChildren(root, root.namespaceURI ?? "", WORKSHEET_CHILDREN).filter((child) => child.localName === "drawing");
  if (drawings.length === 0) return [];
  if (drawings.length !== 1) throw archiveError();
  const worksheetRels = parts.get(relationshipPartName(worksheetPart));
  const drawingId = drawings[0]!.getAttributeNS(OFFICE_RELATIONSHIPS_NAMESPACE, "id");
  const drawing = worksheetRels && drawingId ? relationships(parseXml(worksheetRels), worksheetPart).get(drawingId) : undefined;
  if (!drawing || drawing.type !== `${family.officeRelationships}/drawing` || !parts.has(drawing.target)) throw archiveError();
  const drawingDocument = parseXml(parts.get(drawing.target)!);
  if (!isElement(drawingDocument.documentElement, SPREADSHEET_DRAWING_NAMESPACE, "wsDr")) throw archiveError();
  const drawingRels = parts.get(relationshipPartName(drawing.target));
  if (!drawingRels) throw archiveError();
  const drawingRelationships = relationships(parseXml(drawingRels), drawing.target);
  const images: OoxmlImage[] = [];
  const anchors = Array.from(drawingDocument.documentElement.childNodes)
    .filter((node): node is Element => node.nodeType === 1)
    .filter((node) => node.namespaceURI === SPREADSHEET_DRAWING_NAMESPACE)
    .filter((node) => node.localName === "twoCellAnchor" || node.localName === "oneCellAnchor");
  for (const anchor of anchors) {
    const from = anchorCell(anchor, "from");
    const to = anchor.localName === "twoCellAnchor" ? anchorCell(anchor, "to") : from;
    const coordinates = from && to ? { from, to } : undefined;
    for (const id of imageIds(anchor)) {
      const relationship = drawingRelationships.get(id);
      if (!relationship || relationship.type !== `${family.officeRelationships}/image` || !parts.has(relationship.target) || images.length >= MAX_IMAGES_PER_WORKSHEET || total.value >= MAX_IMAGES_PER_WORKBOOK) throw archiveError();
      const bytes = parts.get(relationship.target)!;
      images.push({ contentHash: createHash("sha256").update(bytes).digest("hex"), mediaType: imageMediaType(relationship.target), byteLength: bytes.byteLength, sourcePart: relationship.target, drawingSourcePart: drawing.target, ...(coordinates ? { anchor: coordinates } : {}), bytes: bytes.slice() });
      total.value += 1;
    }
  }
  return images;
}

export function readOoxmlWorkbook(bytes: Uint8Array, worksheetNames?: readonly string[], includeImages = true, cellWindow?: OoxmlCellWindow): OoxmlWorkbook {
  try {
    const parts = readSafeZip(bytes);
    const workbook = parseXml(parts.get("xl/workbook.xml")!);
    const relationships = parseXml(parts.get("xl/_rels/workbook.xml.rels")!);
    const workbookRoot = workbook.documentElement;
    const family = OOXML_NAMESPACE_FAMILIES.find((candidate) => isElement(workbookRoot, candidate.spreadsheetml, "workbook"));
    if (!workbookRoot || !family || !isElement(relationships.documentElement, PACKAGE_RELATIONSHIPS_NAMESPACE, "Relationships")) throw archiveError();
    const relationshipTargets = new Map<string, { readonly target: string; readonly type: string }>();
    const relationshipIds = new Set<string>();
    for (const relationship of onlyChildren(relationships.documentElement, PACKAGE_RELATIONSHIPS_NAMESPACE, "Relationship")) {
      const id = relationship.getAttribute("Id");
      const type = relationship.getAttribute("Type") ?? "";
      if (!id || relationshipIds.has(id)) throw archiveError();
      relationshipIds.add(id);
      if (type !== family.worksheetRelationshipType) continue;
      const target = safeTarget(relationship.getAttribute("Target") ?? "");
      if (!target || relationship.getAttribute("TargetMode") === "External") throw archiveError();
      relationshipTargets.set(id, { target, type });
    }
    const strings = sharedStrings(parts.has("xl/sharedStrings.xml") ? parseXml(parts.get("xl/sharedStrings.xml")!) : undefined, family);
    const worksheets = new Map<string, OoxmlWorksheet>();
    const sheets = workbookChildren(workbookRoot, family).filter((child) => child.namespaceURI === family.spreadsheetml && child.localName === "sheets");
    const sheetsElement = sheets[0];
    if (sheets.length !== 1 || !sheetsElement) throw archiveError();
    const cellBudget: CellBudget = { total: 0 };
    const imageBudget = { value: 0 };
    const worksheetDomBudget = cellWindow ? { maxNodes: MAX_WINDOW_DOM_NODES_PER_PART, maxDepth: MAX_DOM_DEPTH } : undefined;
    const requestedWorksheets = worksheetNames ? new Set(worksheetNames) : undefined;
    const workbookWorksheetNames = new Set<string>();
    for (const sheet of onlyChildren(sheetsElement, family.spreadsheetml, "sheet")) {
      const name = sheet.getAttribute("name");
      const relationshipId = sheet.getAttributeNS(family.officeRelationships, "id");
      const relationship = relationshipId ? relationshipTargets.get(relationshipId) : undefined;
      const partName = relationship?.type === family.worksheetRelationshipType ? relationship.target : undefined;
      if (!name || worksheets.has(name) || !partName || !parts.has(partName)) throw archiveError();
      workbookWorksheetNames.add(name);
      if (requestedWorksheets && !requestedWorksheets.has(name)) continue;
      const worksheet = parseXml(parts.get(partName)!, worksheetDomBudget);
      worksheets.set(name, {
        name,
        partName,
        cells: readCells(worksheet, strings, family, cellBudget, cellWindow),
        images: includeImages ? readImages(worksheet, partName, parts, family, imageBudget) : [],
      });
    }
    return { worksheets, worksheetNames: workbookWorksheetNames };
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === ARCHIVE_SUMMARY) throw error;
    throw archiveError();
  }
}