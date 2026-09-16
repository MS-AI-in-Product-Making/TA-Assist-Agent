import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { F7FactorEvidence } from "@ai-assist/contracts";
import { createF7MeasurementImportAuthority } from "./f7-measurement-template.js";
import { parseF7MeasurementTemplate } from "./f7-measurement-template-parser.js";
import { generateF7MeasurementTemplate } from "./f7-measurement-template-writer.js";
import { readSafeZip } from "./zip-security.js";

const HASH = "a".repeat(64);
const IMPORTED_AT = "2026-09-16T08:00:00.000Z";
const FIXED_ZIP_MTIME = new Date("2026-01-01T00:00:00.000Z");

describe("parseF7MeasurementTemplate", () => {
  it("parses all three structures while preserving physical rows and controlled grouping", () => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = sheet;
      edited = replaceCell(edited, "B12", inlineCell("B12", "UNORDERED_SAMPLE", 1));
      edited = replaceCell(edited, "C12", inlineCell("C12", "ORDERED_INDIVIDUALS", 1));
      edited = replaceCell(edited, "D12", inlineCell("D12", "RATIONAL_SUBGROUP", 1));
      edited = insertCell(edited, 13, numberCell("D13", 5, 1));
      edited = replaceCell(edited, "D14", inlineCell("D14", "S_C4", 1));
      for (let offset = 0; offset < 20; offset += 1) {
        const row = 15 + offset;
        edited = insertCell(edited, row, numberCell(`B${row}`, offset === 0 ? 0 : 1 + offset / 100, 1));
        edited = insertCell(edited, row, numberCell(`C${row}`, 2 + offset / 100, 1));
        edited = insertCell(edited, row, numberCell(`D${row}`, 3 + offset / 100, 1));
      }
      edited = insertCell(edited, 36, numberCell("C36", 9.99, 1));
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    if (result.status !== "ready") {
      expect(result.diagnostics).toEqual([]);
      return;
    }
    expect(result.datasets).toHaveLength(3);
    expect(result.datasets[0]?.observations).toHaveLength(20);
    expect(result.datasets[0]?.observations[0]).toMatchObject({ originalRow: 15, value: 0 });
    expect(result.datasets[1]?.observations.slice(0, 2)).toMatchObject([
      { originalRow: 15, sequence: "1", value: 2 },
      { originalRow: 16, sequence: "2", value: 2.01 },
    ]);
    expect(result.datasets[1]?.observations.at(-1)).toMatchObject({ originalRow: 36, sequence: "21", value: 9.99 });
    expect(result.datasets[2]?.rationalSubgroupConfig).toEqual({ subgroupSize: 5, estimator: "S_C4" });
    expect(result.datasets[2]?.observations.map(({ subgroup }) => subgroup)).toEqual([
      ...Array(5).fill("1"),
      ...Array(5).fill("2"),
      ...Array(5).fill("3"),
      ...Array(5).fill("4"),
    ]);
  });

  it("blocks negative values and sorts diagnostics by authority Factor then physical row", () => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamples(sheet);
      edited = replaceCell(edited, "C18", numberCell("C18", -2, 1));
      edited = replaceCell(edited, "B17", numberCell("B17", -1, 1));
      edited = replaceCell(edited, "C16", numberCell("C16", -3, 1));
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [
        { reason: "negative_physical_measurement", factorId: "c".repeat(64), rowNumber: 17, sheetCell: "Measurements!B17", value: -1 },
        { reason: "negative_physical_measurement", factorId: "e".repeat(64), rowNumber: 16, sheetCell: "Measurements!C16", value: -3 },
        { reason: "negative_physical_measurement", factorId: "e".repeat(64), rowNumber: 18, sheetCell: "Measurements!C18", value: -2 },
      ],
    });
  });

  it.each([
    ["formula", '<c r="B15" s="1"><f>1+1</f><v>2</v></c>'],
    ["date", '<c r="B15" t="d" s="1"><v>2026-09-16T00:00:00Z</v></c>'],
    ["boolean", '<c r="B15" t="b" s="1"><v>1</v></c>'],
    ["error", '<c r="B15" t="e" s="1"><v>#VALUE!</v></c>'],
    ["string", inlineCell("B15", "1.25", 1)],
    ["nonfinite NaN", '<c r="B15" s="1"><v>NaN</v></c>'],
    ["nonfinite Infinity", '<c r="B15" s="1"><v>Infinity</v></c>'],
  ])("blocks %s measurement cells", (_label, invalidCell) => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamples(sheet);
      edited = replaceCell(edited, "B15", invalidCell);
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "non_finite_measurement", factorId: "c".repeat(64), rowNumber: 15, sheetCell: "Measurements!B15" }],
    });
  });

  it.each([
    ["invalid structure", "B12", inlineCell("B12", "FREEFORM", 1), "invalid_enum"],
    ["invalid estimator", "B14", inlineCell("B14", "MEDIAN", 1), "missing_structure_configuration"],
    ["invalid subgroup size", "B13", numberCell("B13", 1, 1), "missing_structure_configuration"],
  ])("blocks %s", (_label, reference, replacement, reason) => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamples(sheet);
      edited = replaceCell(edited, "B12", inlineCell("B12", "RATIONAL_SUBGROUP", 1));
      edited = insertCell(edited, 13, numberCell("B13", 5, 1));
      return replaceOrInsertCell(edited, reference, replacement);
    });

    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason, factorId: "c".repeat(64) }],
    });
  });

  it("blocks incomplete rational subgroup blocks", () => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamples(sheet);
      edited = replaceCell(edited, "B12", inlineCell("B12", "RATIONAL_SUBGROUP", 1));
      edited = insertCell(edited, 13, numberCell("B13", 3, 1));
      return edited;
    });

    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "incomplete_subgroup", factorId: "c".repeat(64), rowNumber: 33 }],
    });
  });

  it("maps governed dataset validation failures to sample_validation_failure", () => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamples(sheet);
      for (let row = 16; row <= 34; row += 1) edited = removeCell(edited, `B${row}`);
      return edited;
    });

    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "sample_validation_failure", factorId: "c".repeat(64), requiredMinimum: 20 }],
    });
  });

  it.each([
    ["wrong contract", "B2", "wrong-contract", "invalid_template_identity"],
    ["wrong template", "B4", "wrong-template", "invalid_template_identity"],
    ["stale workbook", "B5", "f".repeat(64), "stale_template"],
    ["stale authority", "B13", "f".repeat(64), "stale_template"],
  ])("blocks %s manifest identity", (_label, reference, value, reason) => {
    const authority = makeAuthority();
    const bytes = editPart(authority, "xl/worksheets/sheet2.xml", (sheet) => replaceCell(sheet, reference, inlineCell(reference, value)));
    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({ status: "blocked", diagnostics: [{ reason }] });
  });

  it("detects every immutable visible and manifest Factor cell", () => {
    const authority = makeAuthority();
    const visibleReferences = [
      "A1", ...Array.from({ length: 13 }, (_, index) => `A${index + 2}`),
      ...["B", "C", "D"].flatMap((column) => Array.from({ length: 10 }, (_, index) => `${column}${index + 2}`)),
    ];
    const manifestReferences = [
      ...Array.from({ length: 12 }, (_, index) => `A${index + 2}`),
      ...Array.from({ length: 12 }, (_, index) => `B${index + 2}`),
      ...[16, 17, 18].flatMap((row) => Array.from({ length: 14 }, (_, index) => `${String.fromCharCode(65 + index)}${row}`)),
    ];

    for (const reference of visibleReferences) {
      const bytes = editPart(authority, "xl/worksheets/sheet1.xml", (sheet) => replaceOrInsertCell(sheet, reference, inlineCell(reference, "tampered")));
      expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({ status: "blocked", diagnostics: [{ reason: "changed_locked_cell" }] });
    }
    for (const reference of manifestReferences) {
      const bytes = editPart(authority, "xl/worksheets/sheet2.xml", (sheet) => replaceCell(sheet, reference, inlineCell(reference, "tampered")));
      const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);
      expect(result.status).toBe("blocked");
      const row = Number(reference.slice(1));
      const expectedReason = reference.startsWith("B") && row <= 4
        ? "invalid_template_identity"
        : reference.startsWith("B") && row <= 13
          ? "stale_template"
          : "changed_locked_cell";
      if (result.status === "blocked") expect(result.diagnostics.map(({ reason }) => reason)).toContain(expectedReason);
    }
  });

  it.each([
    ["renamed visible sheet", (parts: Record<string, Uint8Array>) => mutateTextPart(parts, "xl/workbook.xml", (xml) => xml.replace('name="Measurements"', 'name="Renamed"'))],
    ["deleted manifest sheet", (parts: Record<string, Uint8Array>) => mutateTextPart(parts, "xl/workbook.xml", (xml) => xml.replace(/<sheet name="_F7_MANIFEST"[^>]*\/>/, ""))],
  ])("blocks %s", (_label, mutate) => {
    const authority = makeAuthority();
    expect(parseF7MeasurementTemplate(editParts(authority, mutate), authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "invalid_template_identity" }],
    });
  });

  it.each([
    ["missing", "", "missing_factor"],
    ["extra", "9".repeat(64), "extra_factor"],
    ["duplicate", "c".repeat(64), "duplicate_factor"],
  ])("blocks %s Factor manifest rows", (_label, factorId, reason) => {
    const authority = makeAuthority();
    const bytes = editPart(authority, "xl/worksheets/sheet2.xml", (sheet) => replaceCell(sheet, "A17", inlineCell("A17", factorId)));
    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.diagnostics.map((diagnostic) => diagnostic.reason)).toContain(reason);
  });

  it.each(["xl/vbaProject.bin", "xl/externalLinks/externalLink1.xml", "xl/embeddings/oleObject1.bin"])("blocks unsupported part %s", (partName) => {
    const authority = makeAuthority();
    const bytes = editParts(authority, (parts) => { parts[partName] = strToU8("unsupported"); });
    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content" }],
    });
  });

  it("blocks hidden manifest foreign namespace content outside the semantic reader window", () => {
    const authority = makeAuthority();
    const bytes = editParts(authority, (parts) => {
      mutateTextPart(parts, "xl/worksheets/sheet1.xml", (sheet) => withTwentySamples(sheet));
      mutateTextPart(
        parts,
        "xl/worksheets/sheet2.xml",
        (sheet) => sheet.replace(
          "</sheetData>",
          '<row r="99"><x:c xmlns:x="urn:evil" r="A99"><x:v>bad</x:v></x:c></row></sheetData>',
        ),
      );
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content" }],
    });
    expect("datasets" in result).toBe(false);
  });

  it("blocks nonblank content outside the reserved 500-row measurement area", () => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => sheet.replace("</sheetData>", `<row r="515">${numberCell("B515", 1, 1)}</row></sheetData>`));
    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content", factorId: "c".repeat(64), rowNumber: 515, sheetCell: "Measurements!B515" }],
    });
  });

  it.each([
    ["label column measurement row content", (sheet: string) => insertCell(sheet, 15, inlineCell("A15", "tampered", 1)), "Measurements!A15", 15],
    ["far metadata column content", (sheet: string) => insertSyntheticCell(sheet, 2, inlineCell("Z2", "tampered", 1)), "Measurements!Z2", 2],
    ["far measurement column content", (sheet: string) => insertSyntheticCell(sheet, 15, numberCell("Z15", 1, 1)), "Measurements!Z15", 15],
    ["foreign namespace metadata cell", (sheet: string) => insertSyntheticCell(sheet, 2, '<x:c xmlns:x="urn:evil" r="B2"><x:is><x:t>tampered</x:t></x:is></x:c>'), "Measurements!B2", 2],
    ["foreign namespace far measurement cell", (sheet: string) => insertSyntheticCell(sheet, 515, '<x:c xmlns:x="urn:evil" r="B515"><x:v>1</x:v></x:c>'), "Measurements!B515", 515],
  ])("blocks unauthorized raw worksheet content: %s", (_label, mutateSheet, sheetCell, rowNumber) => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => mutateSheet(withTwentySamplesForColumns(sheet, ["B"])));

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content", sheetCell, rowNumber }],
    });
    expect("datasets" in result).toBe(false);
  });

  it("accepts a negative design nominal that crosses zero when observations are nonnegative", () => {
    const authority = makeNegativeCrossZeroAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = sheet;
      for (let offset = 0; offset < 20; offset += 1) {
        const row = 15 + offset;
        edited = insertCell(edited, row, numberCell(`B${row}`, offset / 100, 1));
      }
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0]?.observations).toHaveLength(20);
    expect(result.datasets[0]?.observations[0]).toMatchObject({ originalRow: 15, value: 0 });
    expect(result.datasets[0]?.observations.at(-1)).toMatchObject({ originalRow: 34, value: 0.19 });
  });

  it("accepts the full governed 500-observation capacity", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = sheet;
      for (let row = 15; row <= 514; row += 1) edited = insertCell(edited, row, numberCell(`B${row}`, 1 + (row - 15) / 1000, 1));
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.datasets[0]?.observations).toHaveLength(500);
    expect(result.datasets[0]?.observations[0]).toMatchObject({ originalRow: 15, value: 1 });
    expect(result.datasets[0]?.observations.at(-1)).toMatchObject({ originalRow: 514, value: 1.499 });
  });

  it("retains nonnegative observations outside factor specification limits", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = sheet;
      for (let offset = 0; offset < 20; offset += 1) {
        const row = 15 + offset;
        const value = offset % 2 === 0 ? 0.2 : 1.8;
        edited = insertCell(edited, row, numberCell(`B${row}`, value, 1));
      }
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.datasets[0]?.observations).toHaveLength(20);
    expect(result.datasets[0]?.observations[0]).toMatchObject({ originalRow: 15, value: 0.2 });
    expect(result.datasets[0]?.observations[1]).toMatchObject({ originalRow: 16, value: 1.8 });
  });

  it("caps diagnostics at 2000 after deterministic Factor and row sorting", () => {
    const authority = makeAuthorityWithFactorCount(5);
    const bytes = editTemplate(authority, (sheet) => {
      let edited = sheet;
      for (let row = 15; row <= 514; row += 1) {
        for (const column of ["B", "C", "D", "E", "F"]) edited = insertCell(edited, row, numberCell(`${column}${row}`, -1, 1));
      }
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.diagnostics).toHaveLength(2000);
    expect(result.diagnostics[0]).toMatchObject({ factorId: "c".repeat(64), rowNumber: 15 });
    expect(result.diagnostics.at(-1)).toMatchObject({ factorId: "7".repeat(64), rowNumber: 514 });
  });
});

function makeAuthority() {
  return createF7MeasurementImportAuthority({
    sessionId: "session-1",
    templateId: "template-1",
    workbookContentHash: HASH,
    worksheetName: "TA",
    worksheetStableId: "worksheet-1",
    measurementImportRevision: 0,
    factors: [
      makeEvidence("b", "c", "Width", 14),
      makeEvidence("d", "e", "Height", 15),
      makeEvidence("f", "1", "Depth", 16),
    ],
  });
}

function makeAuthorityWithFactorCount(count: number) {
  const identities = [
    ["b", "c"], ["d", "e"], ["f", "1"], ["2", "7"], ["8", "9"],
  ] as const;
  return createF7MeasurementImportAuthority({
    sessionId: "session-1",
    templateId: "template-1",
    workbookContentHash: HASH,
    worksheetName: "TA",
    worksheetStableId: "worksheet-1",
    measurementImportRevision: 0,
    factors: identities.slice(0, count).map(([candidate, factor], index) => makeEvidence(candidate, factor, `Factor ${index + 1}`, index + 14)),
  });
}

function makeNegativeCrossZeroAuthority() {
  return createF7MeasurementImportAuthority({
    sessionId: "session-1",
    templateId: "template-1",
    workbookContentHash: HASH,
    worksheetName: "TA",
    worksheetStableId: "worksheet-1",
    measurementImportRevision: 0,
    factors: [
      makeEvidence("b", "c", "Cross Zero", 14, {
        designNominal: -0.05,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        calculatedMean: -0.05,
        tolerance: 0.1,
        oneSigma: 0.025,
        loopCoefficient: -1,
        physicalMean: 0.05,
        signedContributionMean: -0.05,
        lowerSpecLimit: 0,
        upperSpecLimit: 0.15,
        baselineSampler: {
          samplerId: "NORMAL_LOCATION_SCALE_V1",
          physicalMean: 0.05,
          standardDeviation: 0.025,
          support: "REAL",
        },
      }),
    ],
  });
}

function makeSingleFactorAuthority() {
  return createF7MeasurementImportAuthority({
    sessionId: "session-1",
    templateId: "template-1",
    workbookContentHash: HASH,
    worksheetName: "TA",
    worksheetStableId: "worksheet-1",
    measurementImportRevision: 0,
    factors: [makeEvidence("b", "c", "Width", 14)],
  });
}

function makeEvidence(
  candidate: string,
  factor: string,
  factorName: string,
  sourceRow: number,
  overrides: Partial<F7FactorEvidence> = {},
): F7FactorEvidence {
  const baselineSampler = overrides.baselineSampler ?? {
    samplerId: "NORMAL_LOCATION_SCALE_V1",
    physicalMean: 1,
    standardDeviation: 0.025,
    support: "REAL",
  };
  return {
    workbookContentHash: HASH,
    worksheetName: "TA",
    tableId: "table-1",
    sourceRow,
    factorCandidateId: candidate.repeat(64),
    factorId: factor.repeat(64),
    factorName,
    unit: "mm",
    unitSource: "user_confirmed",
    designNominal: 1,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    calculatedMean: 1,
    tolerance: 0.1,
    oneSigma: 0.025,
    percentContributionToSigma: 1,
    loopCoefficient: 1,
    physicalMean: 1,
    signedContributionMean: 1,
    specificationSource: "Derived",
    lowerSpecLimit: 0.9,
    upperSpecLimit: 1.1,
    sourceCells: {
      factorName: `TA!G${sourceRow}`,
      distribution: `TA!Q${sourceRow}`,
      excelSignedMean: `TA!R${sourceRow}`,
      standardDeviation: `TA!T${sourceRow}`,
      factorLowerSpecLimit: `TA!J${sourceRow}`,
      factorUpperSpecLimit: `TA!K${sourceRow}`,
      lowerSpecLimit: `TA!J${sourceRow}`,
      upperSpecLimit: `TA!K${sourceRow}`,
    },
    baselineSampler,
    ...overrides,
  };
}

function editTemplate(authority: ReturnType<typeof makeAuthority>, edit: (sheet: string) => string): Uint8Array {
  return editPart(authority, "xl/worksheets/sheet1.xml", edit);
}

function editPart(authority: ReturnType<typeof makeAuthority>, partName: string, edit: (part: string) => string): Uint8Array {
  return editParts(authority, (parts) => mutateTextPart(parts, partName, edit));
}

function editParts(authority: ReturnType<typeof makeAuthority>, edit: (parts: Record<string, Uint8Array>) => void): Uint8Array {
  const parts = Object.fromEntries(readSafeZip(generateF7MeasurementTemplate(authority)));
  edit(parts);
  return zipSync(parts, { level: 0, mtime: FIXED_ZIP_MTIME });
}

function mutateTextPart(parts: Record<string, Uint8Array>, partName: string, edit: (part: string) => string): void {
  parts[partName] = strToU8(edit(new TextDecoder().decode(parts[partName])));
}

function replaceCell(sheet: string, reference: string, cell: string): string {
  const pattern = new RegExp(`<c r="${reference}"[^>]*>[\\s\\S]*?<\\/c>`);
  if (!pattern.test(sheet)) throw new Error(`Missing cell ${reference}`);
  return sheet.replace(pattern, cell);
}

function insertCell(sheet: string, row: number, cell: string): string {
  const emptyRow = `<row r="${row}"/>`;
  if (sheet.includes(emptyRow)) return sheet.replace(emptyRow, `<row r="${row}">${cell}</row>`);
  const closingRow = `</row>`;
  const rowPattern = new RegExp(`(<row r="${row}"[^>]*>[\\s\\S]*?)${closingRow}`);
  if (!rowPattern.test(sheet)) throw new Error(`Missing row ${row}`);
  return sheet.replace(rowPattern, `$1${cell}${closingRow}`);
}

function insertSyntheticCell(sheet: string, row: number, cell: string): string {
  const emptyRow = `<row r="${row}"/>`;
  if (sheet.includes(emptyRow)) return sheet.replace(emptyRow, `<row r="${row}">${cell}</row>`);
  const closingRow = `</row>`;
  const rowPattern = new RegExp(`(<row r="${row}"[^>]*>[\\s\\S]*?)${closingRow}`);
  if (rowPattern.test(sheet)) return sheet.replace(rowPattern, `$1${cell}${closingRow}`);
  return sheet.replace("</sheetData>", `<row r="${row}">${cell}</row></sheetData>`);
}

function replaceOrInsertCell(sheet: string, reference: string, cell: string): string {
  const pattern = new RegExp(`<c r="${reference}"[^>]*>[\\s\\S]*?<\\/c>`);
  return pattern.test(sheet) ? sheet.replace(pattern, cell) : insertCell(sheet, Number(reference.match(/\d+$/)?.[0]), cell);
}

function removeCell(sheet: string, reference: string): string {
  return sheet.replace(new RegExp(`<c r="${reference}"[^>]*>[\\s\\S]*?<\\/c>`), "");
}

function withTwentySamples(sheet: string): string {
  let edited = sheet;
  for (let offset = 0; offset < 20; offset += 1) {
    const row = 15 + offset;
    for (const column of ["B", "C", "D"]) edited = insertCell(edited, row, numberCell(`${column}${row}`, 1 + offset / 100, 1));
  }
  return edited;
}

function withTwentySamplesForColumns(sheet: string, columns: readonly string[]): string {
  let edited = sheet;
  for (let offset = 0; offset < 20; offset += 1) {
    const row = 15 + offset;
    for (const column of columns) edited = insertCell(edited, row, numberCell(`${column}${row}`, 1 + offset / 100, 1));
  }
  return edited;
}

function inlineCell(reference: string, value: string, style = 0): string {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t>${value}</t></is></c>`;
}

function numberCell(reference: string, value: number, style = 1): string {
  return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
}
