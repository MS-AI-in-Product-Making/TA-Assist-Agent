import path from "node:path";

export const FEATURE1_WORKBOOK_READ_OPTIONS = {
  cellFormula: true,
  cellText: true,
  raw: true,
  bookFiles: true,
};

function fileContentUtf8(file) {
  if (!file?.content) return "";
  if (typeof file.content === "string") return file.content;
  return Buffer.from(file.content).toString("utf8");
}

function parseRelationships(xml) {
  const rows = [];
  for (const tagMatch of xml.matchAll(/<Relationship\b[^>]*>/gi)) {
    const tag = tagMatch[0];
    const attrs = {};
    for (const attrMatch of tag.matchAll(/([A-Za-z_:][A-Za-z0-9_:.\-]*)="([^"]*)"/g)) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    rows.push({
      id: attrs.Id,
      target: attrs.Target,
      type: attrs.Type,
    });
  }
  return rows;
}

export function parseWorkbookSheetPathMap(dualWorkbook) {
  const workbookXml = fileContentUtf8(dualWorkbook.files?.["xl/workbook.xml"]);
  const workbookRelsXml = fileContentUtf8(dualWorkbook.files?.["xl/_rels/workbook.xml.rels"]);

  const relMap = new Map();
  for (const row of parseRelationships(workbookRelsXml)) {
    if (row.id && row.target) {
      relMap.set(row.id, row.target);
    }
  }

  const bySheetName = new Map();
  for (const match of workbookXml.matchAll(/<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/gi)) {
    const sheetName = match[1];
    const relId = match[2];
    const target = relMap.get(relId);
    if (!target) continue;
    const normalized = target.replace(/^\/?/, "").replace(/^\.\//, "");
    const sheetPath = normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
    bySheetName.set(sheetName, sheetPath);
  }

  return bySheetName;
}

function resolveRelationshipTarget(basePartPath, target) {
  if (!target) return undefined;
  if (target.startsWith("/")) return target.replace(/^\//, "");
  const baseDir = basePartPath.split("/").slice(0, -1).join("/");
  const joined = path.posix.normalize(path.posix.join(baseDir, target));
  return joined.replace(/^\/+/, "");
}

export function worksheetNeedsComposedSnapshot(dualWorkbook, sheetPath) {
  if (!sheetPath) return false;

  const sheetXml = fileContentUtf8(dualWorkbook.files?.[sheetPath]);
  const drawingRelMatch = sheetXml.match(/<drawing\s+[^>]*r:id="([^"]+)"/i);
  if (!drawingRelMatch) return false;

  const sheetFileName = sheetPath.split("/").pop();
  const relPath = `xl/worksheets/_rels/${sheetFileName}.rels`;
  const relsXml = fileContentUtf8(dualWorkbook.files?.[relPath]);
  const drawingRelationship = parseRelationships(relsXml)
    .find((item) => item.id === drawingRelMatch[1] || (typeof item.type === "string" && item.type.includes("/drawing")));
  if (!drawingRelationship?.target) return false;

  const drawingPart = resolveRelationshipTarget(sheetPath, drawingRelationship.target);
  const drawingXml = fileContentUtf8(dualWorkbook.files?.[drawingPart]);
  if (!drawingXml) return false;

  const picCount = (drawingXml.match(/<xdr:pic\b/gi) ?? []).length;
  const hasOverlayShape = /<xdr:sp\b/i.test(drawingXml)
    || /<xdr:cxnSp\b/i.test(drawingXml)
    || /<xdr:grpSp\b/i.test(drawingXml)
    || /<a:t\b/i.test(drawingXml)
    || /<a:ln\b/i.test(drawingXml);

  return picCount > 1 || (picCount >= 1 && hasOverlayShape);
}