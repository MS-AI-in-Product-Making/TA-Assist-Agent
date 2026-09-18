import { strToU8, zipSync } from "fflate";
import {
  createTypedError,
  f7MeasurementImportAuthoritySchema,
  type F7MeasurementImportAuthority,
} from "@ai-assist/contracts";
import { F7_MEASUREMENT_TEMPLATE_LAYOUT } from "./f7-measurement-template.js";

const FIXED_ZIP_MTIME = new Date("2026-01-01T00:00:00.000Z");
const XML_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NAMESPACE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";
const FIXED_PASSWORD_HASH = "DA7A";
const { measurementCapacity: FACTOR_ROWS, firstMeasurementRow: DATA_START_ROW } = F7_MEASUREMENT_TEMPLATE_LAYOUT;
const MEASUREMENTS_SHEET_NAME = F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName;
const MANIFEST_SHEET_NAME = F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName;
const WORKBOOK_TITLE = "TA Measurement Import Template";
const ARCHIVE_SUMMARY = "F7 measurement template cannot be generated.";

function archiveError(): Error {
  return createTypedError({
    code: "validation_error",
    summary: ARCHIVE_SUMMARY,
    suggestedAction: "Provide a valid F7 measurement import manifest.",
    affectedInputReferences: ["f7-measurement-import-manifest"],
  });
}

function validateAuthority(input: F7MeasurementImportAuthority): F7MeasurementImportAuthority {
  const parsed = f7MeasurementImportAuthoritySchema.safeParse(input);
  if (!parsed.success) throw archiveError();
  return parsed.data;
}

function rejectInvalidXml(value: string): string {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const isValid = codePoint === 0x09
      || codePoint === 0x0a
      || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (!isValid || codePoint === 0xfffe || codePoint === 0xffff) throw archiveError();
  }
  return value;
}

function escapeXml(value: string): string {
  return rejectInvalidXml(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeAttr(value: string): string {
  return escapeXml(value).replace(/\r/g, "&#13;").replace(/\n/g, "&#10;").replace(/\t/g, "&#9;");
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) throw archiveError();
  return Object.is(value, -0) ? "0" : String(value);
}

function columnName(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function buildContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
}

function buildRootRelationships(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE_REL_NAMESPACE}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function buildWorkbookXml(title: string): string {
  rejectInvalidXml(title);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${XML_NAMESPACE}" xmlns:r="${REL_NAMESPACE}"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${escapeAttr(MEASUREMENTS_SHEET_NAME)}" sheetId="1" r:id="rId1"/><sheet name="${escapeAttr(MANIFEST_SHEET_NAME)}" sheetId="2" state="veryHidden" r:id="rId2"/></sheets></workbook>`;
}

function buildWorkbookRelationships(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE_REL_NAMESPACE}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function _buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${XML_NAMESPACE}"><fonts count="4"><font><sz val="11"/><name val="Arial"/><color rgb="FF1F2937"/></font><font><sz val="11"/><name val="Arial"/><color rgb="FF9C0006"/><b/></font><font><sz val="14"/><name val="Arial"/><color rgb="FFFFFFFF"/><b/></font><font><sz val="11"/><name val="Arial"/><color rgb="FF153E35"/><b/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6B5C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F3EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7D6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="1"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyProtection="1"><alignment horizontal="center" vertical="center"/><protection locked="0"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment vertical="center"/><protection locked="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="1"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment horizontal="center" vertical="center" wrapText="1"/><protection locked="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyProtection="1"><alignment horizontal="center" vertical="center"/><protection locked="1"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="1"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7D6"/><bgColor indexed="64"/></patternFill></fill><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom></border></dxf></dxfs></styleSheet>`;
}

function buildEnglishTemplateStylesXmlBase(): string {
  const border = '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>';
  const locked = '<protection locked="1"/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${XML_NAMESPACE}"><fonts count="4"><font><sz val="11"/><name val="Arial"/><color rgb="FF1F2937"/></font><font><sz val="11"/><name val="Arial"/><color rgb="FF9C0006"/><b/></font><font><sz val="14"/><name val="Arial"/><color rgb="FFFFFFFF"/><b/></font><font><sz val="11"/><name val="Arial"/><color rgb="FF374151"/><b/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6B5C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${border}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyProtection="1"><alignment vertical="center" wrapText="1"/>${locked}</xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyProtection="1"><alignment horizontal="center" vertical="center"/><protection locked="0"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment horizontal="left" vertical="center"/>${locked}</xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment vertical="center" wrapText="1"/>${locked}</xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment horizontal="center" vertical="center" wrapText="1"/>${locked}</xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyProtection="1"><alignment horizontal="center" vertical="center"/>${locked}</xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment vertical="center" wrapText="1"/>${locked}</xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="1"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>${border}</dxf></dxfs></styleSheet>`;
}

function buildMeasurementsSheet(authority: F7MeasurementImportAuthority): string {
  const manifest = authority.manifest;
  const measurementCapacity = FACTOR_ROWS;
  const metadataRows = [
    [2, "Factor Name"],
    [3, "Part Number"],
    [4, "DIM ID"],
    [5, "Design Nominal |abs|"],
    [6, "+ Tol"],
    [7, "- Tol"],
    [8, "Factor LSL"],
    [9, "Factor USL"],
    [10, "Specification Source"],
    [11, "Limit Status"],
  ] as const;
  const rows = [
    `<row r="1" ht="24" customHeight="1"><c r="A1" t="inlineStr" s="2"><is><t>${WORKBOOK_TITLE}</t></is></c></row>`,
    ...metadataRows.map(([rowNumber, label]) => {
      const cells = manifest.factors.map((factor, factorIndex) => {
        const column = columnName(factorIndex + 2);
        const warningStyle = factor.limitStatus === "CROSSES_ZERO" ? "3" : "0";
        if (rowNumber === 2) return `<c r="${column}${rowNumber}" t="inlineStr" s="${warningStyle}"><is><t>${escapeXml(factor.factorName)}</t></is></c>`;
        if (rowNumber === 3) return `<c r="${column}${rowNumber}" t="inlineStr" s="0"><is><t>${escapeXml(factor.partNumber ?? "")}</t></is></c>`;
        if (rowNumber === 4) return `<c r="${column}${rowNumber}" t="inlineStr" s="0"><is><t>${escapeXml(factor.dimId ?? "")}</t></is></c>`;
        if (rowNumber === 5) return `<c r="${column}${rowNumber}" s="0"><v>${numberText(Math.abs(factor.designNominal))}</v></c>`;
        if (rowNumber === 6) return `<c r="${column}${rowNumber}" s="0"><v>${numberText(factor.upperTolerance)}</v></c>`;
        if (rowNumber === 7) return `<c r="${column}${rowNumber}" s="0"><v>${numberText(factor.lowerTolerance)}</v></c>`;
        if (rowNumber === 8) return `<c r="${column}${rowNumber}" s="${warningStyle}"><v>${numberText(factor.lowerSpecLimit)}</v></c>`;
        if (rowNumber === 9) return `<c r="${column}${rowNumber}" s="${warningStyle}"><v>${numberText(factor.upperSpecLimit)}</v></c>`;
        if (rowNumber === 10) return `<c r="${column}${rowNumber}" t="inlineStr" s="0"><is><t>${escapeXml(factor.specificationSource)}</t></is></c>`;
        if (rowNumber === 11) return `<c r="${column}${rowNumber}" t="inlineStr" s="${warningStyle}"><is><t>${factor.limitStatus}</t></is></c>`;
        return "";
      }).join("");
      return `<row r="${rowNumber}" ht="20" customHeight="1"><c r="A${rowNumber}" t="inlineStr" s="6"><is><t>${escapeXml(label)}</t></is></c>${cells}</row>`;
    }),
    `<row r="${F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementHeaderRow}" ht="24" customHeight="1"><c r="A${F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementHeaderRow}" t="inlineStr" s="4"><is><t>Sequence</t></is></c>${manifest.factors.map((factor, factorIndex) => {
      const column = columnName(factorIndex + 2);
      return `<c r="${column}${F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementHeaderRow}" t="inlineStr" s="4"><is><t>${escapeXml(`${factor.factorName} Measurement`)}</t></is></c>`;
    }).join("")}</row>`,
    ...Array.from({ length: measurementCapacity }, (_, index) => {
      const rowNumber = DATA_START_ROW + index;
      const inputCells = manifest.factors.map((_, factorIndex) =>
        `<c r="${columnName(factorIndex + 2)}${rowNumber}" s="1"/>`
      ).join("");
      return `<row r="${rowNumber}" ht="19" customHeight="1"><c r="A${rowNumber}" s="5"><v>${index + 1}</v></c>${inputCells}</row>`;
    }),
  ];
  const lastFactorColumn = columnName(manifest.factors.length + F7_MEASUREMENT_TEMPLATE_LAYOUT.firstFactorColumn - 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${XML_NAMESPACE}" xmlns:r="${REL_NAMESPACE}"><dimension ref="A1:${lastFactorColumn}${DATA_START_ROW + FACTOR_ROWS - 1}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane state="frozen" ySplit="${F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementHeaderRow}" topLeftCell="A${DATA_START_ROW}" activePane="bottomLeft"/><selection pane="bottomLeft"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols><col min="1" max="1" width="24" customWidth="1"/>${Array.from({ length: manifest.factors.length }, (_, index) => `<col min="${index + 2}" max="${index + 2}" width="18" customWidth="1"/>`).join("")}</cols><sheetData>${rows.join("")}</sheetData><sheetProtection sheet="1" objects="1" scenarios="1" password="${FIXED_PASSWORD_HASH}"/><protectedRanges><protectedRange name="MeasurementsInput" sqref="B${DATA_START_ROW}:${lastFactorColumn}${DATA_START_ROW + FACTOR_ROWS - 1}"/></protectedRanges><autoFilter ref="A${F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementHeaderRow}:${lastFactorColumn}${F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementHeaderRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function buildEnglishMeasurementsSheet(authority: F7MeasurementImportAuthority): string {
  const lastFactorColumn = columnName(authority.manifest.factors.length + F7_MEASUREMENT_TEMPLATE_LAYOUT.firstFactorColumn - 1);
  const autoFilter = `<autoFilter ref="A${F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementHeaderRow}:${lastFactorColumn}${F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementHeaderRow}"/>`;
  const mergedTitle = `<mergeCells count="1"><mergeCell ref="A1:${lastFactorColumn}1"/></mergeCells>`;
  const generated = buildMeasurementsSheet(authority);
  if (!generated.includes(autoFilter)) throw archiveError();
  return generated.replace(autoFilter, `${autoFilter}${mergedTitle}`);
}

function buildManifestSheet(authority: F7MeasurementImportAuthority): string {
  const manifest = authority.manifest;
  const factorRows = manifest.factors.map((factor, index) => {
    const rowNumber = index + 16;
    return `<row r="${rowNumber}"><c r="A${rowNumber}" t="inlineStr"><is><t>${factor.factorId}</t></is></c><c r="B${rowNumber}" t="inlineStr"><is><t>${escapeXml(factor.factorName)}</t></is></c><c r="C${rowNumber}" t="inlineStr"><is><t>${escapeXml(factor.partNumber ?? "")}</t></is></c><c r="D${rowNumber}" t="inlineStr"><is><t>${escapeXml(factor.dimId ?? "")}</t></is></c><c r="E${rowNumber}" t="inlineStr"><is><t>${escapeXml(factor.unit)}</t></is></c><c r="F${rowNumber}"><v>${numberText(factor.designNominal)}</v></c><c r="G${rowNumber}"><v>${numberText(factor.upperTolerance)}</v></c><c r="H${rowNumber}"><v>${numberText(factor.lowerTolerance)}</v></c><c r="I${rowNumber}"><v>${numberText(factor.lowerSpecLimit)}</v></c><c r="J${rowNumber}"><v>${numberText(factor.upperSpecLimit)}</v></c><c r="K${rowNumber}" t="inlineStr"><is><t>${factor.specificationSource}</t></is></c><c r="L${rowNumber}" t="inlineStr"><is><t>${factor.limitStatus}</t></is></c><c r="M${rowNumber}" t="inlineStr"><is><t>${factor.immutableValueDigest}</t></is></c><c r="N${rowNumber}" t="inlineStr"><is><t>${factor.immutableCoordinateDigest}</t></is></c></row>`;
  }).join("");
  const governedFactorRows = factorRows.replace(
    /<row r="(\d+)">([\s\S]*?)<\/row>/g,
    '<row r="$1">$2<c r="O$1" t="inlineStr"><is><t>UNORDERED_SAMPLE</t></is></c><c r="P$1"/><c r="Q$1" t="inlineStr"><is><t>RANGE_D2</t></is></c></row>',
  );
  const fields = [
    ["contractId", manifest.contractId],
    ["contractVersion", String(manifest.contractVersion)],
    ["templateId", manifest.templateId],
    ["workbookContentHash", manifest.workbookContentHash],
    ["worksheetName", manifest.worksheetName],
    ["worksheetStableId", manifest.worksheetStableId],
    ["factorSetDigest", manifest.factorSetDigest],
    ["factorsDigest", manifest.factorsDigest],
    ["lockedValueDigest", manifest.lockedValueDigest],
    ["lockedCoordinateDigest", manifest.lockedCoordinateDigest],
    ["sessionStateDigest", authority.sessionStateDigest],
    ["authorityDigest", authority.authorityDigest],
  ] as const;
  const authorityRows = fields.map(([label, value], index) => {
    const rowNumber = index + 2;
    return `<row r="${rowNumber}"><c r="A${rowNumber}" t="inlineStr"><is><t>${label}</t></is></c><c r="B${rowNumber}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c></row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${XML_NAMESPACE}"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>${authorityRows}${governedFactorRows}</sheetData><sheetProtection sheet="1" objects="1" scenarios="1" password="${FIXED_PASSWORD_HASH}"/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

export function generateF7MeasurementTemplate(input: F7MeasurementImportAuthority): Uint8Array {
  const authority = validateAuthority(input);
  const parts: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(buildContentTypes()),
    "_rels/.rels": strToU8(buildRootRelationships()),
    "xl/workbook.xml": strToU8(buildWorkbookXml(WORKBOOK_TITLE)),
    "xl/_rels/workbook.xml.rels": strToU8(buildWorkbookRelationships()),
    "xl/styles.xml": strToU8(buildEnglishTemplateStylesXml()),
    "xl/worksheets/sheet1.xml": strToU8(buildEnglishMeasurementsSheet(authority)),
    "xl/worksheets/sheet2.xml": strToU8(buildManifestSheet(authority)),
  };
  return zipSync(parts, { level: 0, mtime: FIXED_ZIP_MTIME });
}

function buildEnglishTemplateStylesXml(): string {
  return buildEnglishTemplateStylesXmlBase()
    .replace(
      '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyProtection="1"><alignment vertical="center" wrapText="1"/>',
      '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyProtection="1"><alignment horizontal="center" vertical="center" wrapText="1"/>',
    )
    .replace(
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment vertical="center" wrapText="1"/>',
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyProtection="1"><alignment horizontal="center" vertical="center" wrapText="1"/>',
    )
    .replace(/<dxfs count="1">[\s\S]*?<\/dxfs>/, '<dxfs count="0"/>');
}