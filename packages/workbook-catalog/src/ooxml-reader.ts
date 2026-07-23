import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import { createTypedError } from "@ai-assist/contracts";
import { MAX_XML_PART_BYTES, readSafeZip } from "./zip-security.js";

export interface OoxmlCell { readonly reference: string; readonly value: string; readonly formula?: string; readonly cachedValue?: string; }
export interface OoxmlWorksheet { readonly name: string; readonly partName: string; readonly cells: readonly OoxmlCell[]; }
export interface OoxmlWorkbook { readonly worksheets: ReadonlyMap<string, OoxmlWorksheet>; }

const ARCHIVE_SUMMARY = "Workbook-catalog archive cannot be processed.";
export const MAX_DOM_NODES_PER_PART = 50_000;
export const MAX_DOM_DEPTH = 128;
export const MAX_SHARED_STRINGS = 10_000;
export const MAX_ROWS_PER_WORKSHEET = 10_000;
export const MAX_CELLS_PER_WORKSHEET = 10_000;
export const MAX_TOTAL_CELLS = 50_000;
const utf8 = new TextDecoder("utf-8", { fatal: true });
const PACKAGE_RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";
const WORKBOOK_CHILDREN = ["fileVersion", "fileSharing", "workbookPr", "workbookProtection", "bookViews", "sheets", "functionGroups", "externalReferences", "definedNames", "calcPr", "oleSize", "customWorkbookViews", "pivotCaches", "smartTagPr", "smartTagTypes", "webPublishing", "fileRecoveryPr", "webPublishObjects", "extLst"];
const WORKSHEET_CHILDREN = ["sheetPr", "dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData", "sheetCalcPr", "sheetProtection", "protectedRanges", "scenarios", "autoFilter", "sortState", "dataConsolidate", "customSheetViews", "mergeCells", "phoneticPr", "conditionalFormatting", "dataValidations", "hyperlinks", "printOptions", "pageMargins", "pageSetup", "pageSetupPr", "headerFooter", "rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors", "smartTags", "drawing", "legacyDrawing", "legacyDrawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"];
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

function richText(element: Element, family: OoxmlNamespaceFamily): string {
  const children = allowedChildren(element, family.spreadsheetml, ["t", "r"]);
  const textNodes = children.filter((child) => child.localName === "t");
  const runs = children.filter((child) => child.localName === "r");
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

function parseXml(bytes: Uint8Array): Document {
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
  assertDomBudget(document);
  return document;
}

function assertDomBudget(document: Document): void {
  const root = document.documentElement;
  if (!root) throw archiveError();
  const pending = [{ node: root, depth: 1 }];
  let count = 1;
  for (let index = 0; index < pending.length; index += 1) {
    const { node, depth } = pending[index]!;
    if (depth > MAX_DOM_DEPTH) throw archiveError();
    count += node.attributes?.length ?? 0;
    if (count > MAX_DOM_NODES_PER_PART) throw archiveError();
    for (let childIndex = 0; childIndex < node.childNodes.length; childIndex += 1) {
      const child = node.childNodes.item(childIndex);
      if (!child) continue;
      count += 1;
      if (count > MAX_DOM_NODES_PER_PART) throw archiveError();
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

function readCells(document: Document, strings: readonly string[], family: OoxmlNamespaceFamily, budget: CellBudget): OoxmlCell[] {
  const cells: OoxmlCell[] = [];
  const rows = new Set<string>();
  const references = new Set<string>();
  const root = document.documentElement;
  if (!isElement(root, family.spreadsheetml, "worksheet")) throw archiveError();
  const sheetData = allowedChildren(root, family.spreadsheetml, WORKSHEET_CHILDREN).filter((child) => child.localName === "sheetData");
  const sheetDataElement = sheetData[0];
  if (sheetData.length !== 1 || !sheetDataElement) throw archiveError();
  for (const row of onlyChildren(sheetDataElement, family.spreadsheetml, "row")) {
    if (rows.size >= MAX_ROWS_PER_WORKSHEET) throw archiveError();
    const rowNumber = row.getAttribute("r");
    if (!rowNumber || rows.has(rowNumber)) throw archiveError();
    rows.add(rowNumber);
    for (const cell of onlyChildren(row, family.spreadsheetml, "c")) {
      if (cells.length >= MAX_CELLS_PER_WORKSHEET || budget.total >= MAX_TOTAL_CELLS) throw archiveError();
      const reference = cell.getAttribute("r");
      if (!reference || references.has(reference)) throw archiveError();
      references.add(reference);
      const type = cell.getAttribute("t") || undefined;
      const children = allowedChildren(cell, family.spreadsheetml, ["f", "v", "is"]);
      const formulaNodes = children.filter((child) => child.localName === "f");
      const valueNodes = children.filter((child) => child.localName === "v");
      const inlineStringNodes = children.filter((child) => child.localName === "is");
      const formulaNode = formulaNodes[0];
      const valueNode = valueNodes[0];
      if (formulaNodes.length > 1 || valueNodes.length > 1 || inlineStringNodes.length > 1 || ![undefined, "n", "str", "s", "inlineStr"].includes(type ?? undefined)) throw archiveError();
      if (formulaNode) {
        if (type === "s" || type === "inlineStr" || inlineStringNodes.length !== 0) throw archiveError();
      } else if (type === "inlineStr") {
        if (inlineStringNodes.length !== 1 || valueNode) throw archiveError();
      } else if (inlineStringNodes.length !== 0) {
        throw archiveError();
      } else if (valueNode) {
        if (type !== undefined && type !== "n" && type !== "str" && type !== "s") throw archiveError();
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

export function readOoxmlWorkbook(bytes: Uint8Array): OoxmlWorkbook {
  try {
    const parts = readSafeZip(bytes);
    const workbook = parseXml(parts.get("xl/workbook.xml")!);
    const relationships = parseXml(parts.get("xl/_rels/workbook.xml.rels")!);
    const workbookRoot = workbook.documentElement;
    const family = OOXML_NAMESPACE_FAMILIES.find((candidate) => isElement(workbookRoot, candidate.spreadsheetml, "workbook"));
    if (!workbookRoot || !family || !isElement(relationships.documentElement, PACKAGE_RELATIONSHIPS_NAMESPACE, "Relationships")) throw archiveError();
    const relationshipTargets = new Map<string, { readonly target: string; readonly type: string }>();
    for (const relationship of onlyChildren(relationships.documentElement, PACKAGE_RELATIONSHIPS_NAMESPACE, "Relationship")) {
      const id = relationship.getAttribute("Id");
      const target = safeTarget(relationship.getAttribute("Target") ?? "");
      if (!id || !target || relationship.getAttribute("TargetMode") === "External" || relationshipTargets.has(id)) throw archiveError();
      relationshipTargets.set(id, { target, type: relationship.getAttribute("Type") ?? "" });
    }
    const strings = sharedStrings(parts.has("xl/sharedStrings.xml") ? parseXml(parts.get("xl/sharedStrings.xml")!) : undefined, family);
    const worksheets = new Map<string, OoxmlWorksheet>();
    const sheets = allowedChildren(workbookRoot, family.spreadsheetml, WORKBOOK_CHILDREN).filter((child) => child.localName === "sheets");
    const sheetsElement = sheets[0];
    if (sheets.length !== 1 || !sheetsElement) throw archiveError();
    const cellBudget: CellBudget = { total: 0 };
    for (const sheet of onlyChildren(sheetsElement, family.spreadsheetml, "sheet")) {
      const name = sheet.getAttribute("name");
      const relationshipId = sheet.getAttributeNS(family.officeRelationships, "id");
      const relationship = relationshipId ? relationshipTargets.get(relationshipId) : undefined;
      const partName = relationship?.type === family.worksheetRelationshipType ? relationship.target : undefined;
      if (!name || worksheets.has(name) || !partName || !parts.has(partName)) throw archiveError();
      worksheets.set(name, { name, partName, cells: readCells(parseXml(parts.get(partName)!), strings, family, cellBudget) });
    }
    return { worksheets };
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === ARCHIVE_SUMMARY) throw error;
    throw archiveError();
  }
}