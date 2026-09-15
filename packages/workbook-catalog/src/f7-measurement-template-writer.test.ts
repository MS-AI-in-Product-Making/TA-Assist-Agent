import { describe, expect, it } from "vitest";
import type { F7FactorEvidence } from "@ai-assist/contracts";
import { readOoxmlWorkbook, readSafeZip } from "./index.js";
import { createF7MeasurementImportAuthority } from "./f7-measurement-template.js";
import { generateF7MeasurementTemplate } from "./f7-measurement-template-writer.js";

const FACTOR_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("generateF7MeasurementTemplate", () => {
  it("writes the governed authority at fixed manifest coordinates and warns for cross-zero factors", () => {
    const authority = createF7MeasurementImportAuthority({
      sessionId: "session-1",
      templateId: "template-1",
      workbookContentHash: FACTOR_ID,
      worksheetName: "TA",
      worksheetStableId: "worksheet-1",
      measurementImportRevision: 0,
      factors: [makeEvidence()],
    });

    const archive = generateF7MeasurementTemplate(authority);
    const workbook = readOoxmlWorkbook(archive);
    expect(workbook.worksheets.get("_F7_MANIFEST")?.cells).toEqual(expect.arrayContaining([
      { reference: "B2", value: authority.manifest.contractId },
      { reference: "B3", value: "1" },
      { reference: "B4", value: authority.manifest.templateId },
      { reference: "B5", value: authority.manifest.workbookContentHash },
      { reference: "B6", value: authority.manifest.worksheetName },
      { reference: "B7", value: authority.manifest.worksheetStableId },
      { reference: "B8", value: authority.manifest.factorSetDigest },
      { reference: "B9", value: authority.manifest.factorsDigest },
      { reference: "B10", value: authority.manifest.lockedValueDigest },
      { reference: "B11", value: authority.manifest.lockedCoordinateDigest },
      { reference: "B12", value: authority.sessionStateDigest },
      { reference: "B13", value: authority.authorityDigest },
    ]));

    const sheet1 = new TextDecoder().decode(readSafeZip(archive).get("xl/worksheets/sheet1.xml")!);
    expect(sheet1).toContain('<c r="B2" t="inlineStr" s="3"><is><t>Width</t></is></c>');
  });

  it("is deterministic for the same authority", () => {
    const authority = makeAuthority();
    expect(generateF7MeasurementTemplate(authority)).toEqual(generateF7MeasurementTemplate(authority));
  });

  it("produces only allowlisted OOXML parts and no external artifacts", () => {
    const archive = generateF7MeasurementTemplate(makeAuthority());

    const parts = readSafeZip(archive);
    expect(Array.from(parts.keys()).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);

    const text = Array.from(parts.values()).map((part) => new TextDecoder().decode(part)).join("\n");
    expect(text).not.toContain("vbaProject");
    expect(text).not.toContain("externalLink");
    expect(text).not.toContain("customXml");
    expect(text).not.toContain("<drawing");
    expect(text).not.toContain("image");
  });

  it("exposes the expected workbook inventory and locked visible metadata layout", () => {
    const archive = generateF7MeasurementTemplate(makeAuthority());

    const workbook = readOoxmlWorkbook(archive);
    expect(workbook.worksheetInventory).toEqual([
      { worksheetName: "Measurements", worksheetIndex: 0, visibility: "visible", relationshipId: "rId1", partName: "xl/worksheets/sheet1.xml" },
      { worksheetName: "_F7_MANIFEST", worksheetIndex: 1, visibility: "veryHidden", relationshipId: "rId2", partName: "xl/worksheets/sheet2.xml" },
    ]);

    const worksheet = workbook.worksheets.get("Measurements");
    expect(worksheet?.cells).toEqual(expect.arrayContaining([
      { reference: "A2", value: "Factor Name" },
      { reference: "A3", value: "Part Number" },
      { reference: "A4", value: "DIM ID" },
      { reference: "A5", value: "Design Nominal |abs|" },
      { reference: "A6", value: "+ Tol" },
      { reference: "A7", value: "- Tol" },
      { reference: "A8", value: "Factor LSL" },
      { reference: "A9", value: "Factor USL" },
      { reference: "A10", value: "Specification Source" },
      { reference: "A11", value: "Limit Status" },
      { reference: "A12", value: "Measurement Structure" },
      { reference: "A13", value: "Subgroup Size" },
      { reference: "A14", value: "Estimator" },
      { reference: "B2", value: "Width" },
      { reference: "B5", value: "0.05" },
      { reference: "B6", value: "0.1" },
      { reference: "B7", value: "-0.1" },
      { reference: "B8", value: "0" },
      { reference: "B9", value: "0.15" },
      { reference: "B10", value: "Derived" },
      { reference: "B11", value: "CROSSES_ZERO" },
      { reference: "B12", value: "UNORDERED_SAMPLE" },
      { reference: "B14", value: "RANGE_D2" },
    ]));
    expect(worksheet?.cells).not.toContainEqual(expect.objectContaining({ reference: "B3" }));
    expect(worksheet?.cells).not.toContainEqual(expect.objectContaining({ reference: "B4" }));
    expect(worksheet?.cells).not.toContainEqual(expect.objectContaining({ reference: "B13" }));

    const sheet1 = new TextDecoder().decode(readSafeZip(archive).get("xl/worksheets/sheet1.xml")!);
    expect(sheet1).toContain('<row r="15"/>');
    expect(sheet1).toContain('<row r="514"/>');
  });

  it("writes locked manifest fields and factor digests into the hidden manifest sheet", () => {
    const authority = makeAuthority([
      makeEvidence(),
      makeEvidence({
        factorCandidateId: "d".repeat(64),
        factorId: "e".repeat(64),
        factorName: "Height",
        partNumber: "PN-200",
        dimId: "DIM-200",
        sourceRow: 15,
      }),
    ]);
    const archive = generateF7MeasurementTemplate(authority);

    const worksheet = readOoxmlWorkbook(archive).worksheets.get("_F7_MANIFEST");
    expect(worksheet?.cells).toEqual(expect.arrayContaining([
      { reference: "B2", value: authority.manifest.contractId },
      { reference: "B4", value: authority.manifest.templateId },
      { reference: "A16", value: "c".repeat(64) },
      { reference: "B16", value: "Width" },
      { reference: "C16", value: "" },
      { reference: "D16", value: "" },
      { reference: "E16", value: "mm" },
      { reference: "F16", value: "-0.05" },
      { reference: "M16", value: authority.manifest.factors[0]!.immutableValueDigest },
      { reference: "N16", value: authority.manifest.factors[0]!.immutableCoordinateDigest },
      { reference: "A17", value: "e".repeat(64) },
      { reference: "C17", value: "PN-200" },
      { reference: "D17", value: "DIM-200" },
    ]));
  });

  it("marks worksheet protection, freeze panes, validations, and unlocked measurement controls in raw XML", () => {
    const archive = generateF7MeasurementTemplate(makeAuthority());
    const parts = readSafeZip(archive);
    const sheet1 = new TextDecoder().decode(parts.get("xl/worksheets/sheet1.xml")!);
    const styles = new TextDecoder().decode(parts.get("xl/styles.xml")!);

    expect(sheet1).toContain('<sheetProtection sheet="1" objects="1" scenarios="1" password="DA7A"/>');
    expect(sheet1).toContain('<pane state="frozen" ySplit="14" topLeftCell="A15" activePane="bottomLeft"/>');
    expect(sheet1).toContain('sqref="B12:B12"');
    expect(sheet1).toContain('sqref="B14:B14"');
    expect(sheet1).toContain('<c r="B12" t="inlineStr" s="1"><is><t>UNORDERED_SAMPLE</t></is></c>');
    expect(sheet1).toContain('<c r="B14" t="inlineStr" s="1"><is><t>RANGE_D2</t></is></c>');
    expect(sheet1).toContain('<row r="15"/>');
    expect(sheet1).toContain('<row r="514"/>');
    expect(styles).toContain('<protection locked="0"/>');
    expect(styles).toContain('<protection locked="1"/>');
  });

  it("rejects invalid XML controls and accepts XML escaping safely", () => {
    const invalidAuthority = structuredClone(makeAuthority());
    invalidAuthority.manifest.worksheetName = "A\u0001B";
    expect(() => generateF7MeasurementTemplate(invalidAuthority)).toThrow();

    const archive = generateF7MeasurementTemplate(makeAuthority([makeEvidence({ factorName: 'Name & <>",\'' })]));
    const sheet1 = new TextDecoder().decode(readSafeZip(archive).get("xl/worksheets/sheet1.xml")!);
    expect(sheet1).toContain("Name &amp; &lt;&gt;&quot;,&apos;");
  });

  it("supports representative 100-factor generation within the reader budgets", () => {
    const archive = generateF7MeasurementTemplate(makeAuthority(Array.from({ length: 100 }, (_, index) => makeEvidence({
      factorCandidateId: `${(index + 1).toString(16).padStart(64, "0")}`.slice(-64),
      factorId: `${(index + 101).toString(16).padStart(64, "0")}`.slice(-64),
      factorName: `Factor ${index + 1}`,
      partNumber: index % 2 === 0 ? `PN-${index + 1}` : undefined,
      dimId: index % 3 === 0 ? `DIM-${index + 1}` : undefined,
      sourceRow: index + 14,
    }))));

    const parts = readSafeZip(archive);
    expect(parts.size).toBe(7);
    const workbook = readOoxmlWorkbook(archive);
    expect(workbook.worksheets.get("Measurements")?.cells).toEqual(expect.arrayContaining([
      { reference: "CW2", value: "Factor 100" },
    ]));
  });
});

function makeAuthority(factors: readonly F7FactorEvidence[] = [makeEvidence()]) {
  return createF7MeasurementImportAuthority({
    sessionId: "session-1",
    templateId: "template-1",
    workbookContentHash: FACTOR_ID,
    worksheetName: "TA",
    worksheetStableId: "worksheet-1",
    measurementImportRevision: 0,
    factors,
  });
}

function makeEvidence(overrides: Partial<F7FactorEvidence> = {}): F7FactorEvidence {
  return {
    workbookContentHash: FACTOR_ID,
    worksheetName: "TA",
    tableId: "table-1",
    sourceRow: 14,
    factorCandidateId: "b".repeat(64),
    factorId: "c".repeat(64),
    factorName: "Width",
    unit: "mm",
    unitSource: "user_confirmed",
    designNominal: -0.05,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    calculatedMean: -0.05,
    tolerance: 0.1,
    oneSigma: 0.025,
    percentContributionToSigma: 1,
    loopCoefficient: -1,
    physicalMean: 0.05,
    signedContributionMean: -0.05,
    specificationSource: "Derived",
    lowerSpecLimit: 0,
    upperSpecLimit: 0.15,
    ...overrides,
    sourceCells: {
      factorName: "TA!G14",
      distribution: "TA!Q14",
      excelSignedMean: "TA!R14",
      standardDeviation: "TA!T14",
      factorLowerSpecLimit: "TA!J14",
      factorUpperSpecLimit: "TA!K14",
      lowerSpecLimit: "TA!J14",
      upperSpecLimit: "TA!K14",
      ...(overrides.sourceCells ?? {}),
    },
    baselineSampler: {
      samplerId: "NORMAL_LOCATION_SCALE_V1",
      physicalMean: 0.05,
      standardDeviation: 0.025,
      support: "REAL",
      ...(overrides.baselineSampler ?? {}),
    },
  };
}