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
    const bytes = editTemplateAndManifest(authority, (sheet) => {
      let edited = sheet;
      for (let offset = 0; offset < 20; offset += 1) {
        const row = 13 + offset;
        edited = insertCell(edited, row, numberCell(`B${row}`, offset === 0 ? 0 : 1 + offset / 100, 1));
        edited = insertCell(edited, row, numberCell(`C${row}`, 2 + offset / 100, 1));
        edited = insertCell(edited, row, numberCell(`D${row}`, 3 + offset / 100, 1));
      }
      edited = insertCell(edited, 33, numberCell("C33", 9.99, 1));
      return edited;
    }, (sheet) => {
      let edited = replaceCell(sheet, "O17", inlineCell("O17", "ORDERED_INDIVIDUALS"));
      edited = replaceCell(edited, "O18", inlineCell("O18", "RATIONAL_SUBGROUP"));
      edited = replaceCell(edited, "P18", numberCell("P18", 5));
      return replaceCell(edited, "Q18", inlineCell("Q18", "S_C4"));
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    if (result.status !== "ready") {
      expect(result.diagnostics).toEqual([]);
      return;
    }
    expect(result.datasets).toHaveLength(3);
    expect(result.datasets[0]?.observations).toHaveLength(20);
    expect(result.datasets[0]?.observations[0]).toMatchObject({ originalRow: 13, value: 0 });
    expect(result.datasets[1]?.observations.slice(0, 2)).toMatchObject([
      { originalRow: 13, sequence: "1", value: 2 },
      { originalRow: 14, sequence: "2", value: 2.01 },
    ]);
    expect(result.datasets[1]?.observations.at(-1)).toMatchObject({ originalRow: 33, sequence: "21", value: 9.99 });
    expect(result.datasets[2]?.rationalSubgroupConfig).toEqual({ subgroupSize: 5, estimator: "S_C4" });
    expect(result.datasets[2]?.observations.map(({ subgroup }) => subgroup)).toEqual([
      ...Array(5).fill("1"),
      ...Array(5).fill("2"),
      ...Array(5).fill("3"),
      ...Array(5).fill("4"),
    ]);
  });

  it("accepts the generated all-English locked template structure", () => {
    const authority = makeAuthority();
    const result = parseF7MeasurementTemplate(generateF7MeasurementTemplate(authority), authority, IMPORTED_AT);

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.diagnostics).toHaveLength(authority.manifest.factors.length);
    expect(result.diagnostics.every((diagnostic) => diagnostic.reason === "sample_validation_failure")).toBe(true);
  });

  it("parses completed legacy templates by exact Factor metadata correspondence", () => {
    const authority = makeAuthority();
    const bytes = editTemplateAndManifest(authority, (sheet) => {
      let edited = toLegacyVisibleLayout(sheet);
      for (let offset = 0; offset < 20; offset += 1) {
        const row = 15 + offset;
        for (const column of ["B", "C", "D"]) {
          edited = insertCell(edited, row, numberCell(`${column}${row}`, 1 + offset / 100, 1));
        }
      }
      return edited;
    }, (sheet) => {
      let edited = sheet;
      for (const row of [9, 11, 12, 13]) {
        edited = replaceCell(edited, `B${row}`, inlineCell(`B${row}`, String(row).repeat(64).slice(0, 64)));
      }
      for (let row = 16; row <= 18; row += 1) {
        edited = replaceCell(edited, `N${row}`, inlineCell(`N${row}`, "9".repeat(64)));
        edited = removeCell(removeCell(removeCell(edited, `O${row}`), `P${row}`), `Q${row}`);
      }
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT, undefined, {
      allowPriorSessionIdentity: true,
    });

    expect(result.status, JSON.stringify(result)).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.datasets.every((dataset) => dataset.observations.length === 20)).toBe(true);
    expect(result.datasets[0]?.observations[0]?.originalRow).toBe(15);
    expect(result.datasets[0]?.sourceReference).toBe("Measurements!B15:B514");
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
    ["formula", '<c r="B16" s="1"><f>1+1</f><v>2</v></c>'],
    ["date", '<c r="B16" t="d" s="1"><v>2026-09-16T00:00:00Z</v></c>'],
    ["boolean", '<c r="B16" t="b" s="1"><v>1</v></c>'],
    ["error", '<c r="B16" t="e" s="1"><v>#VALUE!</v></c>'],
    ["string", inlineCell("B16", "1.25", 1)],
    ["nonfinite NaN", '<c r="B16" s="1"><v>NaN</v></c>'],
    ["nonfinite Infinity", '<c r="B16" s="1"><v>Infinity</v></c>'],
  ])("blocks %s measurement cells", (_label, invalidCell) => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamples(sheet);
      edited = replaceCell(edited, "B16", invalidCell);
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "non_finite_measurement", factorId: "c".repeat(64), rowNumber: 16, sheetCell: "Measurements!B16" }],
    });
  });

  it.each([
    ["invalid structure", "O16", inlineCell("O16", "FREEFORM"), "invalid_enum"],
    ["invalid estimator", "Q16", inlineCell("Q16", "MEDIAN"), "missing_structure_configuration"],
    ["invalid subgroup size", "P16", numberCell("P16", 1), "missing_structure_configuration"],
  ])("blocks %s", (_label, reference, replacement, reason) => {
    const authority = makeAuthority();
    const bytes = editTemplateAndManifest(authority, withTwentySamples, (sheet) => {
      let edited = replaceCell(sheet, "P16", numberCell("P16", 5));
      edited = replaceCell(edited, "O16", reference === "O16" ? replacement : inlineCell("O16", "RATIONAL_SUBGROUP"));
      return reference === "O16" ? edited : replaceCell(edited, reference, replacement);
    });

    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason, factorId: "c".repeat(64) }],
    });
  });

  it("blocks incomplete rational subgroup blocks", () => {
    const authority = makeAuthority();
    const bytes = editTemplateAndManifest(authority, withTwentySamples, (sheet) => {
      const edited = replaceCell(sheet, "O16", inlineCell("O16", "RATIONAL_SUBGROUP"));
      return replaceCell(edited, "P16", numberCell("P16", 3));
    });

    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "incomplete_subgroup", factorId: "c".repeat(64), rowNumber: 31 }],
    });
  });

  it("maps governed dataset validation failures to sample_validation_failure", () => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamples(sheet);
      for (let row = 13; row <= 31; row += 1) edited = removeCell(edited, `B${row}`);
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

  it("accepts a prior session digest when current Factor authority still matches", () => {
    const authority = makeAuthority();
    const bytes = editPart(authority, "xl/worksheets/sheet2.xml", (sheet) => {
      let edited = replaceCell(sheet, "B12", inlineCell("B12", "f".repeat(64)));
      edited = replaceCell(edited, "B13", inlineCell("B13", "e".repeat(64)));
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT, undefined, {
      allowPriorSessionIdentity: true,
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.diagnostics.every((diagnostic) => diagnostic.reason === "sample_validation_failure")).toBe(true);
  });

  it("detects every immutable visible and manifest Factor cell", () => {
    const authority = makeAuthority();
    const visibleReferences = [
      "A1", ...Array.from({ length: 10 }, (_, index) => `A${index + 2}`), "A12", "B12", "C12", "D12",
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

  it("blocks a changed protected measurement sequence number", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => replaceCell(sheet, "A13", numberCell("A13", 99, 5)));

    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "changed_locked_cell", rowNumber: 13, sheetCell: "Measurements!A13" }],
    });
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

  it("accepts standard metadata, shared-string, and theme parts added by Excel save", () => {
    const authority = makeAuthority();
    const bytes = editParts(authority, (parts) => {
      mutateTextPart(parts, "xl/worksheets/sheet1.xml", (sheet) => withTwentySamples(sheet));
      for (const partName of [
        "docMetadata/LabelInfo.xml",
        "docProps/app.xml",
        "docProps/core.xml",
        "xl/theme/theme1.xml",
      ]) {
        parts[partName] = strToU8('<?xml version="1.0" encoding="UTF-8"?><root/>');
      }
      parts["xl/sharedStrings.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}" count="0" uniqueCount="0"/>`);
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);
    expect(result.status, JSON.stringify(result)).toBe("ready");
  });

  it("accepts locked numeric metadata rewritten to equivalent IEEE-754 text by Excel", () => {
    const authority = makeAuthority();
    const bytes = editTemplateAndManifest(authority, (sheet) => {
      let edited = withTwentySamples(sheet);
      edited = replaceCell(edited, "B6", '<c r="B6"><v>0.10000000000000001</v></c>');
      return replaceCell(edited, "B8", '<c r="B8"><v>0.90000000000000002</v></c>');
    }, (sheet) => {
      let edited = replaceCell(sheet, "G16", '<c r="G16"><v>0.10000000000000001</v></c>');
      return replaceCell(edited, "I16", '<c r="I16"><v>0.90000000000000002</v></c>');
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);
    expect(result.status, JSON.stringify(result)).toBe("ready");
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

  it("blocks a spoofed worksheet row number when the cell reference points at a valid measurement row", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      const populated = withTwentySamplesForColumns(sheet, ["B"]);
      return populated.replace(
        /<row r="16"[^>]*>[\s\S]*?<\/row>/,
        `<row r="999">${numberCell("B16", 1, 1)}</row>`,
      );
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content", sheetCell: "Measurements!B16" }],
    });
    expect("datasets" in result).toBe(false);
  });

  it("blocks same-namespace nested wrapper content inside a controlled measurement cell", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamplesForColumns(sheet, ["B"]);
      edited = replaceCell(
        edited,
        "B16",
        '<c r="B16" s="1"><foo xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><v>1</v></foo></c>',
      );
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content", sheetCell: "Measurements!B16", rowNumber: 16 }],
    });
    expect("datasets" in result).toBe(false);
  });

  it.each(["0", "-16", "+16", "016", "16.0", " 16", "16 "])(
    "blocks non-canonical visible worksheet row reference %s",
    (rowReference) => {
      const authority = makeSingleFactorAuthority();
      const bytes = editTemplate(authority, (sheet) => {
        const populated = withTwentySamplesForColumns(sheet, ["B"]);
        return populated.replace(/<row r="16"/g, `<row r="${rowReference}"`);
      });

      const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

      expect(result).toMatchObject({
        status: "blocked",
        diagnostics: [{ reason: "unsupported_workbook_content", rowNumber: 16 }],
      });
      expect("datasets" in result).toBe(false);
    },
  );

  it("blocks duplicate visible worksheet row references even when cell references are unique", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      const populated = withTwentySamplesForColumns(sheet, ["B"]);
      return populated.replace("</sheetData>", '<row r="16"/></sheetData>');
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content", rowNumber: 16 }],
    });
    expect("datasets" in result).toBe(false);
  });

  it("blocks direct child cells whose row coordinate does not match the enclosing row", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = withTwentySamplesForColumns(sheet, ["B"]);
      edited = replaceCell(edited, "B16", "");
      return insertSyntheticCell(edited, 17, numberCell("B16", 1, 1));
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content", sheetCell: "Measurements!B16" }],
    });
    expect("datasets" in result).toBe(false);
  });

  it("blocks nonblank content outside the reserved 500-row measurement area", () => {
    const authority = makeAuthority();
    const bytes = editTemplate(authority, (sheet) => sheet.replace("</sheetData>", `<row r="516">${numberCell("B516", 1, 1)}</row></sheetData>`));
    expect(parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT)).toMatchObject({
      status: "blocked",
      diagnostics: [{ reason: "unsupported_workbook_content", factorId: "c".repeat(64), rowNumber: 516, sheetCell: "Measurements!B516" }],
    });
  });

  it.each([
    ["label column content below measurements", (sheet: string) => insertSyntheticCell(sheet, 516, inlineCell("A516", "tampered", 1)), "Measurements!A516", 516],
    ["far metadata column content", (sheet: string) => insertSyntheticCell(sheet, 2, inlineCell("Z2", "tampered", 1)), "Measurements!Z2", 2],
    ["far measurement column content", (sheet: string) => insertSyntheticCell(sheet, 16, numberCell("Z16", 1, 1)), "Measurements!Z16", 16],
    ["foreign namespace metadata cell", (sheet: string) => insertSyntheticCell(sheet, 2, '<x:c xmlns:x="urn:evil" r="B2"><x:is><x:t>tampered</x:t></x:is></x:c>'), "Measurements!B2", 2],
    ["foreign namespace far measurement cell", (sheet: string) => insertSyntheticCell(sheet, 516, '<x:c xmlns:x="urn:evil" r="B516"><x:v>1</x:v></x:c>'), "Measurements!B516", 516],
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
        const row = 16 + offset;
        edited = insertCell(edited, row, numberCell(`B${row}`, offset / 100, 1));
      }
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0]?.observations).toHaveLength(20);
    expect(result.datasets[0]?.observations[0]).toMatchObject({ originalRow: 16, value: 0 });
    expect(result.datasets[0]?.observations.at(-1)).toMatchObject({ originalRow: 35, value: 0.19 });
  });

  it("accepts the full governed 500-observation capacity", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = sheet;
      for (let row = 13; row <= 512; row += 1) edited = insertCell(edited, row, numberCell(`B${row}`, 1 + (row - 13) / 1000, 1));
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.datasets[0]?.observations).toHaveLength(500);
    expect(result.datasets[0]?.observations[0]).toMatchObject({ originalRow: 13, value: 1 });
    expect(result.datasets[0]?.observations.at(-1)).toMatchObject({ originalRow: 512, value: 1.499 });
  });

  it("accepts the governed maximum of 100 Factors with 500 observations each", () => {
    const authority = makeAuthorityWithFactorCount(100);
    const bytes = editTemplate(authority, (sheet) => {
      const columns = Array.from({ length: 100 }, (_, index) => columnName(index + 2));
      let edited = sheet;
      for (let row = 13; row <= 512; row += 1) {
        const measurements = columns.map((column) => numberCell(`${column}${row}`, 1, 1)).join("");
        edited = edited.replace(
          new RegExp(`<row r="${row}"[^>]*>[\\s\\S]*?<\\/row>`),
          `<row r="${row}">${numberCell(`A${row}`, row - 12, 5)}${measurements}</row>`,
        );
      }
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.datasets).toHaveLength(100);
    expect(result.datasets.every((dataset) => dataset.observations.length === 500)).toBe(true);
  });

  it("retains nonnegative observations outside factor specification limits", () => {
    const authority = makeSingleFactorAuthority();
    const bytes = editTemplate(authority, (sheet) => {
      let edited = sheet;
      for (let offset = 0; offset < 20; offset += 1) {
        const row = 16 + offset;
        const value = offset % 2 === 0 ? 0.2 : 1.8;
        edited = insertCell(edited, row, numberCell(`B${row}`, value, 1));
      }
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.datasets[0]?.observations).toHaveLength(20);
    expect(result.datasets[0]?.observations[0]).toMatchObject({ originalRow: 16, value: 0.2 });
    expect(result.datasets[0]?.observations[1]).toMatchObject({ originalRow: 17, value: 1.8 });
  });

  it("caps diagnostics at 2000 after deterministic Factor and row sorting", () => {
    const authority = makeAuthorityWithFactorCount(5);
    const bytes = editTemplate(authority, (sheet) => {
      let edited = sheet;
      for (let row = 13; row <= 512; row += 1) {
        for (const column of ["B", "C", "D", "E", "F"]) edited = insertCell(edited, row, numberCell(`${column}${row}`, -1, 1));
      }
      return edited;
    });

    const result = parseF7MeasurementTemplate(bytes, authority, IMPORTED_AT);

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.diagnostics).toHaveLength(2000);
    expect(result.diagnostics[0]).toMatchObject({ factorId: "c".repeat(64), rowNumber: 13 });
    expect(result.diagnostics.at(-1)).toMatchObject({ factorId: "7".repeat(64), rowNumber: 512 });
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
  const fixedIdentities = [
    ["b", "c"], ["d", "e"], ["f", "1"], ["2", "7"], ["8", "9"],
  ] as const;
  return createF7MeasurementImportAuthority({
    sessionId: "session-1",
    templateId: "template-1",
    workbookContentHash: HASH,
    worksheetName: "TA",
    worksheetStableId: "worksheet-1",
    measurementImportRevision: 0,
    factors: Array.from({ length: count }, (_, index) => {
      const identity = fixedIdentities[index];
      return makeEvidence(
        identity?.[0] ?? index.toString(16).padStart(64, "0"),
        identity?.[1] ?? (index + count).toString(16).padStart(64, "0"),
        `Factor ${index + 1}`,
        index + 14,
      );
    }),
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
    factorCandidateId: candidate.length === 64 ? candidate : candidate.repeat(64),
    factorId: factor.length === 64 ? factor : factor.repeat(64),
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

function editTemplateAndManifest(
  authority: ReturnType<typeof makeAuthority>,
  editVisible: (sheet: string) => string,
  editManifest: (sheet: string) => string,
): Uint8Array {
  return editParts(authority, (parts) => {
    mutateTextPart(parts, "xl/worksheets/sheet1.xml", editVisible);
    mutateTextPart(parts, "xl/worksheets/sheet2.xml", editManifest);
  });
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
  const pattern = new RegExp(`<c r="${reference}"(?:[^>]*)\\/>|<c r="${reference}"[^>]*>[\\s\\S]*?<\\/c>`);
  if (!pattern.test(sheet)) throw new Error(`Missing cell ${reference}`);
  return sheet.replace(pattern, cell);
}

function insertCell(sheet: string, row: number, cell: string): string {
  const reference = /<c r="([A-Z]+[1-9]\d*)"/.exec(cell)?.[1];
  if (reference && new RegExp(`<c r="${reference}"(?:[^>]*)\\/>|<c r="${reference}"[^>]*>[\\s\\S]*?<\\/c>`).test(sheet)) {
    return replaceCell(sheet, reference, cell);
  }
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
    const row = 13 + offset;
    for (const column of ["B", "C", "D"]) edited = insertCell(edited, row, numberCell(`${column}${row}`, 1 + offset / 100, 1));
  }
  return edited;
}

function toLegacyVisibleLayout(sheet: string): string {
  let edited = sheet.replace("TA Measurement Import Template", "F7 Measurement Import Template");
  for (let row = 512; row >= 13; row -= 1) {
    const pattern = new RegExp(`<row r="${row}"[^>]*>[\\s\\S]*?<\\/row>`);
    const match = pattern.exec(edited);
    if (!match) throw new Error(`Missing current measurement row ${row}`);
    const shifted = match[0].replace(new RegExp(`r="([A-Z]*)${row}"`, "g"), `r="$1${row + 2}"`);
    edited = edited.replace(pattern, shifted);
  }
  const headerPattern = /<row r="12"[^>]*>[\s\S]*?<\/row>/;
  if (!headerPattern.test(edited)) throw new Error("Missing current measurement header row");
  edited = edited.replace(headerPattern, [
    `<row r="12"><c r="A12" t="inlineStr"><is><t>Measurement Structure</t></is></c>${["B", "C", "D"].map((column) => inlineCell(`${column}12`, "UNORDERED_SAMPLE", 1)).join("")}</row>`,
    '<row r="13"><c r="A13" t="inlineStr"><is><t>Subgroup Size</t></is></c></row>',
    `<row r="14"><c r="A14" t="inlineStr"><is><t>Estimator</t></is></c>${["B", "C", "D"].map((column) => inlineCell(`${column}14`, "RANGE_D2", 1)).join("")}</row>`,
  ].join(""));
  return edited;
}

function withTwentySamplesForColumns(sheet: string, columns: readonly string[]): string {
  let edited = sheet;
  for (let offset = 0; offset < 20; offset += 1) {
    const row = 13 + offset;
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
