import { DOMParser, type Element } from "@xmldom/xmldom";
import {
  F7_MEASUREMENT_IMPORT_MAX_DIAGNOSTICS,
  f7MeasurementDatasetSchema,
  f7MeasurementImportAuthoritySchema,
  f7MeasurementImportDiagnosticSchema,
  type F7MeasurementDataset,
  type F7MeasurementImportAuthority,
  type F7MeasurementImportDiagnostic,
} from "@ai-assist/contracts";
import { validateF7MeasurementDataset } from "./f7-dataset-validation.js";
import { hashF7MeasurementDatasetContent } from "./f7-measurement-parser.js";
import { F7_MEASUREMENT_TEMPLATE_LAYOUT } from "./f7-measurement-template.js";
import { MAX_DOM_DEPTH, MAX_TOTAL_CELLS, readOoxmlWorkbook, type OoxmlCell } from "./ooxml-reader.js";
import { MAX_XML_PART_BYTES, readSafeZip } from "./zip-security.js";

const ALLOWED_PARTS = new Set([
  "[Content_Types].xml",
  "_rels/.rels",
  "xl/_rels/workbook.xml.rels",
  "xl/styles.xml",
  "xl/workbook.xml",
  "xl/worksheets/sheet1.xml",
  "xl/worksheets/sheet2.xml",
]);
const STRUCTURES = new Set(["UNORDERED_SAMPLE", "ORDERED_INDIVIDUALS", "RATIONAL_SUBGROUP"]);
const ESTIMATORS = new Set(["RANGE_D2", "S_C4"]);
const NUMERIC_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const XML_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const MAX_RAW_DOM_NODES = 250_000;

type ParsedAuthority = ReturnType<typeof f7MeasurementImportAuthoritySchema.parse>;
type Structure = "UNORDERED_SAMPLE" | "ORDERED_INDIVIDUALS" | "RATIONAL_SUBGROUP";
type Estimator = "RANGE_D2" | "S_C4";
type DiagnosticReason = F7MeasurementImportDiagnostic["reason"];

export type F7MeasurementTemplateParseResult =
  | { readonly status: "ready"; readonly datasets: readonly F7MeasurementDataset[] }
  | { readonly status: "blocked"; readonly diagnostics: readonly F7MeasurementImportDiagnostic[] };

interface RawCell {
  readonly reference: string;
  readonly type?: string;
  readonly hasFormula: boolean;
  readonly value: string;
}

interface PendingDiagnostic {
  readonly diagnostic: F7MeasurementImportDiagnostic;
  readonly factorOrder: number;
  readonly row: number;
  readonly insertion: number;
}

export function parseF7MeasurementTemplate(
  bytes: Uint8Array,
  authorityInput: F7MeasurementImportAuthority,
  importedAt: string,
): F7MeasurementTemplateParseResult {
  const authority = f7MeasurementImportAuthoritySchema.parse(authorityInput);
  const diagnostics: PendingDiagnostic[] = [];
  let insertion = 0;
  const addDiagnostic = (
    reason: DiagnosticReason,
    displayMessage: string,
    options: {
      factorIndex?: number;
      sheetCell?: string;
      rowNumber?: number;
      value?: number;
      requiredMinimum?: number;
    } = {},
  ): void => {
    const factor = options.factorIndex === undefined ? undefined : authority.manifest.factors[options.factorIndex];
    const diagnostic = f7MeasurementImportDiagnosticSchema.parse({
      reason,
      ...(factor ? { factorId: factor.factorId, factorName: factor.factorName } : {}),
      ...(options.sheetCell ? { sheetCell: options.sheetCell } : {}),
      ...(options.rowNumber ? { rowNumber: options.rowNumber } : {}),
      ...(options.value !== undefined && Number.isFinite(options.value) ? { value: options.value } : {}),
      ...(options.requiredMinimum ? { requiredMinimum: options.requiredMinimum } : {}),
      displayMessage,
    });
    diagnostics.push({
      diagnostic,
      factorOrder: options.factorIndex ?? Number.MAX_SAFE_INTEGER,
      row: options.rowNumber ?? 0,
      insertion: insertion++,
    });
  };

  let parts: ReadonlyMap<string, Uint8Array>;
  try {
    parts = readSafeZip(bytes);
  } catch {
    addDiagnostic("unsupported_workbook_content", "Workbook archive is not a supported F7 measurement template.");
    return blocked(diagnostics);
  }
  if (parts.size !== ALLOWED_PARTS.size || Array.from(parts.keys()).some((part) => !ALLOWED_PARTS.has(part))) {
    addDiagnostic("unsupported_workbook_content", "Workbook contains parts outside the controlled F7 template allowlist.");
    return blocked(diagnostics);
  }

  let rawCells: ReadonlyMap<string, RawCell>;
  try {
    rawCells = parseRawCells(parts.get("xl/worksheets/sheet1.xml")!);
  } catch {
    addDiagnostic("unsupported_workbook_content", "Visible worksheet XML cannot be inspected safely.");
    return blocked(diagnostics);
  }
  for (const [reference, cell] of rawCells) {
    const location = splitReference(reference);
    const factorIndex = location.column ? columnIndex(location.column) - F7_MEASUREMENT_TEMPLATE_LAYOUT.firstFactorColumn : -1;
    const inMeasurementArea = factorIndex >= 0
      && factorIndex < authority.manifest.factors.length
      && location.row >= F7_MEASUREMENT_TEMPLATE_LAYOUT.firstMeasurementRow
      && location.row <= F7_MEASUREMENT_TEMPLATE_LAYOUT.lastMeasurementRow;
    const afterMeasurementArea = factorIndex >= 0
      && factorIndex < authority.manifest.factors.length
      && location.row > F7_MEASUREMENT_TEMPLATE_LAYOUT.lastMeasurementRow;
    if (afterMeasurementArea && !isBlank(cell.value)) {
      addDiagnostic("unsupported_workbook_content", "Nonblank measurement content exists outside the reserved 500-row area.", {
        factorIndex,
        sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${reference}`,
        rowNumber: location.row,
      });
      continue;
    }
    if (!inMeasurementArea || isBlank(cell.value)) continue;
    if (cell.hasFormula || cell.type === "b" || cell.type === "e" || cell.type === "d") {
      addDiagnostic("non_finite_measurement", "Measurement cell must contain a finite numeric literal.", {
        factorIndex,
        sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${reference}`,
        rowNumber: location.row,
      });
    }
  }
  if (diagnostics.length > 0) return blocked(diagnostics);

  let workbook: ReturnType<typeof readOoxmlWorkbook>;
  try {
    workbook = readOoxmlWorkbook(
      bytes,
      [F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName, F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName],
      false,
      {
        maxRow: Math.max(14, F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.factorsStartRow + authority.manifest.factors.length - 1),
        maxColumn: columnName(Math.max(14, authority.manifest.factors.length + 2)),
      },
    );
  } catch {
    addDiagnostic("unsupported_workbook_content", "Workbook OOXML cannot be read safely.");
    return blocked(diagnostics);
  }

  const expectedInventory = [
    { name: F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName, state: "visible" },
    { name: F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName, state: "veryHidden" },
  ];
  if (workbook.worksheetInventory.length !== 2 || workbook.worksheetInventory.some((sheet, index) =>
    sheet.worksheetName !== expectedInventory[index]?.name || sheet.visibility !== expectedInventory[index]?.state)) {
    addDiagnostic("invalid_template_identity", "Required template worksheets were renamed, deleted, added, or made visible.");
    return blocked(diagnostics);
  }

  const visible = workbook.worksheets.get(F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName);
  const manifestSheet = workbook.worksheets.get(F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName);
  if (!visible || !manifestSheet) {
    addDiagnostic("invalid_template_identity", "Required template worksheets are missing.");
    return blocked(diagnostics);
  }

  const visibleCells = cellMap(visible.cells);
  const manifestCells = cellMap(manifestSheet.cells);
  checkManifestLabels(manifestCells, addDiagnostic);
  checkManifestIdentity(authority, manifestCells, addDiagnostic);
  checkFactorManifest(authority, manifestCells, addDiagnostic);
  checkImmutableVisibleCells(authority, visibleCells, addDiagnostic);
  checkFactorColumns(authority, visibleCells, addDiagnostic);
  checkOutsideMeasurementArea(authority, visibleCells, addDiagnostic);
  if (diagnostics.length > 0) return blocked(diagnostics);

  const datasets: F7MeasurementDataset[] = [];
  authority.manifest.factors.forEach((factor, factorIndex) => {
    const column = factor.coordinates.measurementColumn;
    const structureCell = visibleCells.get(`${column}${F7_MEASUREMENT_TEMPLATE_LAYOUT.factorRows.measurementStructure}`);
    const structure = structureCell?.value as Structure | undefined;
    if (!structure || !STRUCTURES.has(structure)) {
      addDiagnostic("invalid_enum", "Measurement Structure must use a controlled template value.", {
        factorIndex,
        sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}12`,
        rowNumber: 12,
      });
      return;
    }

    const subgroupCell = visibleCells.get(`${column}${F7_MEASUREMENT_TEMPLATE_LAYOUT.factorRows.subgroupSize}`);
    const estimatorCell = visibleCells.get(`${column}${F7_MEASUREMENT_TEMPLATE_LAYOUT.factorRows.estimator}`);
    let rationalSubgroupConfig: { subgroupSize: number; estimator: Estimator } | undefined;
    if (structure === "RATIONAL_SUBGROUP") {
      const subgroupSize = subgroupCell ? Number(subgroupCell.value) : Number.NaN;
      const estimator = estimatorCell?.value as Estimator | undefined;
      if (!Number.isInteger(subgroupSize) || subgroupSize < 2 || subgroupSize > 25 || !estimator || !ESTIMATORS.has(estimator)) {
        addDiagnostic("missing_structure_configuration", "Rational subgroup requires subgroup size 2-25 and a controlled estimator.", {
          factorIndex,
          sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}13`,
          rowNumber: 13,
        });
        return;
      }
      rationalSubgroupConfig = { subgroupSize, estimator };
    } else if (subgroupCell || (estimatorCell?.value && estimatorCell.value !== "RANGE_D2")) {
      addDiagnostic("missing_structure_configuration", "Subgroup configuration is allowed only for rational subgroup data.", {
        factorIndex,
        sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}13`,
        rowNumber: 13,
      });
      return;
    }

    const observations: Array<{
      value: number;
      originalRow: number;
      disposition: "included";
      sequence?: string;
      subgroup?: string;
    }> = [];
    const diagnosticCountBeforeMeasurements = diagnostics.length;
    for (let row = F7_MEASUREMENT_TEMPLATE_LAYOUT.firstMeasurementRow; row <= F7_MEASUREMENT_TEMPLATE_LAYOUT.lastMeasurementRow; row += 1) {
      const reference = `${column}${row}`;
      const cell = rawCells.get(reference);
      if (!cell || isBlank(cell.value)) continue;
      if (cell.hasFormula || cell.type === "b" || cell.type === "e" || cell.type === "d" || cell.type === "str" || cell.type === "s" || cell.type === "inlineStr") {
        addDiagnostic("non_finite_measurement", "Measurement cell must contain a finite numeric literal.", {
          factorIndex,
          sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${reference}`,
          rowNumber: row,
        });
        continue;
      }
      if (!NUMERIC_LITERAL.test(cell.value)) {
        addDiagnostic("non_finite_measurement", "Measurement cell must contain a finite numeric literal.", {
          factorIndex,
          sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${reference}`,
          rowNumber: row,
        });
        continue;
      }
      const value = Number(cell.value);
      if (!Number.isFinite(value)) {
        addDiagnostic("non_finite_measurement", "Measurement cell must contain a finite numeric literal.", {
          factorIndex,
          sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${reference}`,
          rowNumber: row,
        });
        continue;
      }
      if (value < 0) {
        addDiagnostic("negative_physical_measurement", "Physical measurement values cannot be negative.", {
          factorIndex,
          sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${reference}`,
          rowNumber: row,
          value,
        });
        continue;
      }
      const observation: {
        value: number;
        originalRow: number;
        disposition: "included";
        sequence?: string;
        subgroup?: string;
      } = { value: Object.is(value, -0) ? 0 : value, originalRow: row, disposition: "included" };
      if (structure === "ORDERED_INDIVIDUALS") observation.sequence = String(observations.length + 1);
      if (structure === "RATIONAL_SUBGROUP" && rationalSubgroupConfig) {
        observation.subgroup = String(Math.floor(observations.length / rationalSubgroupConfig.subgroupSize) + 1);
      }
      observations.push(observation);
    }

    if (diagnostics.length > diagnosticCountBeforeMeasurements) return;

    if (structure === "RATIONAL_SUBGROUP" && rationalSubgroupConfig && observations.length % rationalSubgroupConfig.subgroupSize !== 0) {
      const firstIncompleteIndex = observations.length - (observations.length % rationalSubgroupConfig.subgroupSize);
      const row = observations[firstIncompleteIndex]?.originalRow ?? F7_MEASUREMENT_TEMPLATE_LAYOUT.firstMeasurementRow;
      addDiagnostic("incomplete_subgroup", "Rational subgroup measurements must form complete contiguous blocks.", {
        factorIndex,
        sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${row}`,
        rowNumber: row,
        requiredMinimum: rationalSubgroupConfig.subgroupSize,
      });
      return;
    }

    const datasetWithoutHash = {
      factorId: factor.factorId,
      unit: factor.unit,
      structure,
      ...(rationalSubgroupConfig ? { rationalSubgroupConfig } : {}),
      sourceReference: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${F7_MEASUREMENT_TEMPLATE_LAYOUT.firstMeasurementRow}:${column}${F7_MEASUREMENT_TEMPLATE_LAYOUT.lastMeasurementRow}`,
      importedAt,
      msaStatus: "unknown" as const,
      observations,
      missingRowCount: 0,
      rejectionSummaries: [],
      originalRowCount: observations.length,
      analyzedCount: observations.length,
    };
    const dataset = f7MeasurementDatasetSchema.safeParse({
      ...datasetWithoutHash,
      contentHash: hashF7MeasurementDatasetContent(datasetWithoutHash),
    });
    if (!dataset.success) {
      addDiagnostic("sample_validation_failure", "Measurement dataset does not satisfy the governed dataset contract.", { factorIndex });
      return;
    }
    const validation = validateF7MeasurementDataset({ factor: factorEvidence(authority, factorIndex), dataset: dataset.data });
    if (validation.status === "blocked") {
      const rows = validation.blockingIssues.flatMap((issue) => issue.rowNumbers ?? []);
      addDiagnostic("sample_validation_failure", "Measurement dataset failed governed sample validation.", {
        factorIndex,
        ...(rows[0] ? { rowNumber: rows[0] } : {}),
        requiredMinimum: 20,
      });
      return;
    }
    datasets.push(dataset.data);
  });

  if (diagnostics.length > 0 || datasets.length !== authority.manifest.factors.length) return blocked(diagnostics);
  return Object.freeze({ status: "ready", datasets: Object.freeze(datasets.map((dataset) => Object.freeze(dataset))) });
}

function blocked(diagnostics: readonly PendingDiagnostic[]): F7MeasurementTemplateParseResult {
  const sorted = [...diagnostics]
    .sort((left, right) => left.factorOrder - right.factorOrder || left.row - right.row || left.insertion - right.insertion)
    .slice(0, F7_MEASUREMENT_IMPORT_MAX_DIAGNOSTICS)
    .map(({ diagnostic }) => diagnostic);
  return Object.freeze({ status: "blocked", diagnostics: Object.freeze(sorted) });
}

function cellMap(cells: readonly OoxmlCell[]): ReadonlyMap<string, OoxmlCell> {
  return new Map(cells.map((cell) => [cell.reference, cell]));
}

function checkManifestIdentity(
  authority: ParsedAuthority,
  cells: ReadonlyMap<string, OoxmlCell>,
  add: (reason: DiagnosticReason, message: string, options?: { sheetCell?: string; rowNumber?: number }) => void,
): void {
  const expected = [
    ["B2", authority.manifest.contractId],
    ["B3", String(authority.manifest.contractVersion)],
    ["B4", authority.manifest.templateId],
    ["B5", authority.manifest.workbookContentHash],
    ["B6", authority.manifest.worksheetName],
    ["B7", authority.manifest.worksheetStableId],
    ["B8", authority.manifest.factorSetDigest],
    ["B9", authority.manifest.factorsDigest],
    ["B10", authority.manifest.lockedValueDigest],
    ["B11", authority.manifest.lockedCoordinateDigest],
    ["B12", authority.sessionStateDigest],
    ["B13", authority.authorityDigest],
  ] as const;
  expected.forEach(([reference, value], index) => {
    if (cells.get(reference)?.value === value) return;
    add(index <= 2 ? "invalid_template_identity" : "stale_template", "Template manifest does not match current server authority.", {
      sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName}!${reference}`,
      rowNumber: Number(reference.slice(1)),
    });
  });
}

function checkManifestLabels(
  cells: ReadonlyMap<string, OoxmlCell>,
  add: (reason: DiagnosticReason, message: string, options?: { sheetCell?: string; rowNumber?: number }) => void,
): void {
  const labels = [
    "contractId", "contractVersion", "templateId", "workbookContentHash", "worksheetName", "worksheetStableId",
    "factorSetDigest", "factorsDigest", "lockedValueDigest", "lockedCoordinateDigest", "sessionStateDigest", "authorityDigest",
  ];
  labels.forEach((label, index) => {
    const row = index + 2;
    if (cells.get(`A${row}`)?.value !== label) add("changed_locked_cell", "A locked manifest label was changed.", {
      sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName}!A${row}`,
      rowNumber: row,
    });
  });
}

function checkFactorManifest(
  authority: ParsedAuthority,
  cells: ReadonlyMap<string, OoxmlCell>,
  add: (reason: DiagnosticReason, message: string, options?: { factorIndex?: number; sheetCell?: string; rowNumber?: number }) => void,
): void {
  const seen = new Map<string, number>();
  for (let index = 0; index < authority.manifest.factors.length; index += 1) {
    const row = F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.factorsStartRow + index;
    const actualId = cells.get(`A${row}`)?.value;
    const expected = authority.manifest.factors[index]!;
    if (!actualId) add("missing_factor", "Expected Factor is missing from the manifest.", { factorIndex: index, sheetCell: `_F7_MANIFEST!A${row}`, rowNumber: row });
    else if (actualId !== expected.factorId) add("extra_factor", "Manifest contains a Factor outside current authority.", { factorIndex: index, sheetCell: `_F7_MANIFEST!A${row}`, rowNumber: row });
    if (actualId) {
      const previous = seen.get(actualId);
      if (previous !== undefined) add("duplicate_factor", "Manifest contains a duplicate Factor.", { factorIndex: index, sheetCell: `_F7_MANIFEST!A${row}`, rowNumber: row });
      seen.set(actualId, index);
    }
    const expectedValues = [
      expected.factorId,
      expected.factorName,
      expected.partNumber ?? "",
      expected.dimId ?? "",
      expected.unit,
      String(expected.designNominal),
      String(expected.upperTolerance),
      String(expected.lowerTolerance),
      String(expected.lowerSpecLimit),
      String(expected.upperSpecLimit),
      expected.specificationSource,
      expected.limitStatus,
      expected.immutableValueDigest,
      expected.immutableCoordinateDigest,
    ];
    expectedValues.forEach((value, columnIndex) => {
      const reference = `${columnName(columnIndex + 1)}${row}`;
      if (cells.get(reference)?.value !== value) add("changed_locked_cell", "A locked manifest cell was changed.", { factorIndex: index, sheetCell: `_F7_MANIFEST!${reference}`, rowNumber: row });
    });
  }
  for (const cell of cells.values()) {
    const location = splitReference(cell.reference);
    if (location.column === "A" && location.row >= F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.factorsStartRow + authority.manifest.factors.length && !isBlank(cell.value)) {
      add("extra_factor", "Manifest contains an extra Factor row.", { sheetCell: `_F7_MANIFEST!${cell.reference}`, rowNumber: location.row });
    }
  }
}

function checkImmutableVisibleCells(
  authority: ParsedAuthority,
  cells: ReadonlyMap<string, OoxmlCell>,
  add: (reason: DiagnosticReason, message: string, options?: { factorIndex?: number; sheetCell?: string; rowNumber?: number }) => void,
): void {
  if (cells.get("A1")?.value !== "F7 Measurement Import Template") add("changed_locked_cell", "The locked template title was changed.", {
    sheetCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!A1`,
    rowNumber: 1,
  });
  const labels = ["Factor Name", "Part Number", "DIM ID", "Design Nominal |abs|", "+ Tol", "- Tol", "Factor LSL", "Factor USL", "Specification Source", "Limit Status", "Measurement Structure", "Subgroup Size", "Estimator"];
  labels.forEach((label, index) => {
    const row = index + 2;
    if (cells.get(`A${row}`)?.value !== label) add("changed_locked_cell", "A locked template label was changed.", { sheetCell: `Measurements!A${row}`, rowNumber: row });
  });
  authority.manifest.factors.forEach((factor, factorIndex) => {
    const column = factor.coordinates.measurementColumn;
    const expected = new Map<number, string>([
      [2, factor.factorName], [3, factor.partNumber ?? ""], [4, factor.dimId ?? ""],
      [5, String(Math.abs(factor.designNominal))], [6, String(factor.upperTolerance)], [7, String(factor.lowerTolerance)],
      [8, String(factor.lowerSpecLimit)], [9, String(factor.upperSpecLimit)], [10, factor.specificationSource], [11, factor.limitStatus],
    ]);
    expected.forEach((value, row) => {
      if (cells.get(`${column}${row}`)?.value !== value) add("changed_locked_cell", "A locked Factor metadata cell was changed.", { factorIndex, sheetCell: `Measurements!${column}${row}`, rowNumber: row });
    });
  });
}

function checkFactorColumns(
  authority: ParsedAuthority,
  cells: ReadonlyMap<string, OoxmlCell>,
  add: (reason: DiagnosticReason, message: string, options?: { factorIndex?: number; sheetCell?: string; rowNumber?: number }) => void,
): void {
  const lastAllowed = authority.manifest.factors.length + F7_MEASUREMENT_TEMPLATE_LAYOUT.firstFactorColumn - 1;
  const names = new Map<string, number>();
  authority.manifest.factors.forEach((factor, index) => {
    const actualName = cells.get(`${factor.coordinates.measurementColumn}2`)?.value;
    if (actualName) {
      const previous = names.get(actualName);
      if (previous !== undefined) add("duplicate_factor", "Visible worksheet contains a duplicate Factor column.", { factorIndex: index, sheetCell: `Measurements!${factor.coordinates.measurementColumn}2`, rowNumber: 2 });
      names.set(actualName, index);
    }
  });
  for (const cell of cells.values()) {
    const location = splitReference(cell.reference);
    if (columnIndex(location.column) > lastAllowed && !isBlank(cell.value)) add("extra_factor", "Visible worksheet contains an extra Factor column.", { sheetCell: `Measurements!${cell.reference}`, rowNumber: location.row });
  }
}

function checkOutsideMeasurementArea(
  authority: ParsedAuthority,
  cells: ReadonlyMap<string, OoxmlCell>,
  add: (reason: DiagnosticReason, message: string, options?: { factorIndex?: number; sheetCell?: string; rowNumber?: number }) => void,
): void {
  const factorIndexByColumn = new Map(authority.manifest.factors.map((factor, index) => [factor.coordinates.measurementColumn, index]));
  for (const cell of cells.values()) {
    const location = splitReference(cell.reference);
    const factorIndex = factorIndexByColumn.get(location.column);
    if (factorIndex !== undefined && location.row > F7_MEASUREMENT_TEMPLATE_LAYOUT.lastMeasurementRow && !isBlank(cell.value)) {
      add("unsupported_workbook_content", "Nonblank measurement content exists outside the reserved 500-row area.", { factorIndex, sheetCell: `Measurements!${cell.reference}`, rowNumber: location.row });
    }
  }
}

function factorEvidence(authority: ParsedAuthority, index: number): unknown {
  const factor = authority.manifest.factors[index]!;
  return {
    workbookContentHash: authority.manifest.workbookContentHash,
    worksheetName: authority.manifest.worksheetName,
    tableId: "f7-measurement-template",
    sourceRow: index + 1,
    factorCandidateId: factor.factorId,
    factorId: factor.factorId,
    factorName: factor.factorName,
    ...(factor.partNumber ? { partNumber: factor.partNumber } : {}),
    ...(factor.dimId ? { dimId: factor.dimId } : {}),
    unit: factor.unit,
    unitSource: "user_confirmed",
    designNominal: factor.designNominal,
    upperTolerance: factor.upperTolerance,
    lowerTolerance: factor.lowerTolerance,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    calculatedMean: factor.designNominal,
    tolerance: Math.max(Math.abs(factor.upperTolerance), Math.abs(factor.lowerTolerance)),
    oneSigma: Math.max(Math.abs(factor.upperTolerance), Math.abs(factor.lowerTolerance)) / 4,
    percentContributionToSigma: 1,
    loopCoefficient: 1,
    physicalMean: Math.abs(factor.designNominal),
    signedContributionMean: factor.designNominal,
    specificationSource: factor.specificationSource,
    lowerSpecLimit: factor.lowerSpecLimit,
    upperSpecLimit: factor.upperSpecLimit,
    sourceCells: {
      factorName: factor.coordinates.factorNameCell,
      distribution: factor.coordinates.factorNameCell,
      excelSignedMean: factor.coordinates.designNominalCell,
      standardDeviation: factor.coordinates.upperToleranceCell,
      factorLowerSpecLimit: factor.coordinates.lowerSpecLimitCell,
      factorUpperSpecLimit: factor.coordinates.upperSpecLimitCell,
      lowerSpecLimit: factor.coordinates.lowerSpecLimitCell,
      upperSpecLimit: factor.coordinates.upperSpecLimitCell,
    },
    baselineSampler: {
      samplerId: "NORMAL_LOCATION_SCALE_V1",
      physicalMean: Math.abs(factor.designNominal),
      standardDeviation: Math.max(Math.abs(factor.upperTolerance), Math.abs(factor.lowerTolerance)) / 4,
      support: "REAL",
    },
  };
}

function parseRawCells(bytes: Uint8Array): ReadonlyMap<string, RawCell> {
  if (bytes.byteLength > MAX_XML_PART_BYTES) throw new Error("XML part budget exceeded");
  const diagnostics: string[] = [];
  const document = new DOMParser({ locator: false, onError: (_level, message) => diagnostics.push(message) })
    .parseFromString(new TextDecoder("utf-8", { fatal: true }).decode(bytes), "application/xml");
  const root = document.documentElement;
  if (diagnostics.length > 0 || !root || root.localName === "parsererror") throw new Error("Invalid XML");
  const pending: Array<{ node: Element; depth: number }> = [{ node: root, depth: 1 }];
  let nodeCount = 0;
  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index]!;
    if (current.depth > MAX_DOM_DEPTH) throw new Error("XML depth budget exceeded");
    nodeCount += 1 + (current.node.attributes?.length ?? 0);
    if (nodeCount > MAX_RAW_DOM_NODES) throw new Error("XML node budget exceeded");
    for (let childIndex = 0; childIndex < current.node.childNodes.length; childIndex += 1) {
      const child = current.node.childNodes.item(childIndex);
      if (child) pending.push({ node: child as Element, depth: current.depth + 1 });
    }
  }
  const result = new Map<string, RawCell>();
  const cells = Array.from(document.getElementsByTagNameNS(XML_NAMESPACE, "c")) as Element[];
  if (cells.length > MAX_TOTAL_CELLS) throw new Error("Cell budget exceeded");
  for (const cell of cells) {
    const reference = cell.getAttribute("r");
    if (!reference || result.has(reference)) throw new Error("Invalid or duplicate cell reference");
    const formula = cell.getElementsByTagNameNS(XML_NAMESPACE, "f");
    const values = cell.getElementsByTagNameNS(XML_NAMESPACE, "v");
    const texts = cell.getElementsByTagNameNS(XML_NAMESPACE, "t");
    result.set(reference, {
      reference,
      ...(cell.getAttribute("t") ? { type: cell.getAttribute("t")! } : {}),
      hasFormula: formula.length > 0,
      value: texts.item(0)?.textContent ?? values.item(0)?.textContent ?? "",
    });
  }
  return result;
}

function splitReference(reference: string): { column: string; row: number } {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(reference);
  return { column: match?.[1] ?? "", row: Number(match?.[2] ?? 0) };
}

function columnIndex(column: string): number {
  let result = 0;
  for (const character of column) result = result * 26 + character.charCodeAt(0) - 64;
  return result;
}

function columnName(index: number): string {
  let current = index;
  let result = "";
  while (current > 0) {
    result = String.fromCharCode(65 + (current - 1) % 26) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}
