const CELL_REFERENCE = /^([A-Z]+)[1-9]\d*$/;

export const FACTOR_FIELD_ORDER = [
  "factorName",
  "partName",
  "partNumber",
  "drawingNumber",
  "dimCharacteristicId",
  "factorLowerSpecLimit",
  "factorUpperSpecLimit",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "sigmaLevel",
  "standardDeviation",
  "distribution",
  "mean",
  "tolerance",
  "oneSigma",
  "percentContributionToSigma",
  "notes",
] as const;

export type FactorFieldName = typeof FACTOR_FIELD_ORDER[number];

export interface HeaderCell {
  readonly reference: string;
  readonly value: string;
}

export interface ResolvedHeaderColumn {
  readonly semanticField: FactorFieldName;
  readonly sourceColumn: string;
  readonly headerText: string;
}

export type FactorHeaderResolution =
  | {
      readonly status: "resolved";
      readonly anchorColumn: string;
      readonly columns: Readonly<Partial<Record<FactorFieldName, ResolvedHeaderColumn>>>;
    }
  | { readonly status: "unavailable"; readonly reasonCode: "factor_header_missing" | "ambiguous_factor_header" };

const HEADER_ALIASES: Readonly<Record<FactorFieldName, readonly string[]>> = {
  factorName: ["factor", "factor name", "factor description", "factor description (ta loop)"],
  partName: ["part name"],
  partNumber: ["part number", "part no", "part no."],
  drawingNumber: ["drawing number"],
  dimCharacteristicId: ["dim id", "characteristic id", "dim/characteristic id"],
  factorLowerSpecLimit: ["factor lsl", "factor lower spec limit"],
  factorUpperSpecLimit: ["factor usl", "factor upper spec limit"],
  partCategory: ["part category"],
  nominalValue: ["nominal", "nominal value", "design nominal"],
  upperTolerance: ["upper tol", "upper tolerance", "+ tolerance", "+ tolerence"],
  lowerTolerance: ["lower tol", "lower tolerance", "- tolerance", "- tolerence"],
  longTermSafetyFactor: ["long term factor", "safety factor", "long term/safety factor"],
  sigmaLevel: ["sigma level", "σ level"],
  standardDeviation: ["standard deviation", "sigma"],
  distribution: ["distribution"],
  mean: ["mean"],
  tolerance: ["tolerance"],
  oneSigma: ["1 sigma", "one sigma", "1σ"],
  percentContributionToSigma: ["% contribution to sigma", "percent contribution to sigma", "% cont. to σ"],
  notes: ["notes", "note"],
};

function normalize(value: string): string {
  return value.replace(/[▼►]/g, " ").replace(/\s*\/\s*/g, "/").trim().replace(/\s+/g, " ").toLowerCase();
}

function columnNumber(column: string): number {
  let result = 0;
  for (const character of column) result = result * 26 + character.charCodeAt(0) - 64;
  return result;
}

function parsedCell(cell: HeaderCell): (HeaderCell & { readonly column: string; readonly columnNumber: number; readonly semanticField?: FactorFieldName }) | undefined {
  const match = CELL_REFERENCE.exec(cell.reference);
  if (!match) return undefined;
  const normalized = normalize(cell.value);
  const semanticField = FACTOR_FIELD_ORDER.find((fieldName) => HEADER_ALIASES[fieldName].includes(normalized));
  return {
    ...cell,
    column: match[1]!,
    columnNumber: columnNumber(match[1]!),
    ...(semanticField === undefined ? {} : { semanticField }),
  };
}

export function resolveFactorHeaderCluster(rowCells: readonly HeaderCell[]): FactorHeaderResolution {
  const cells = rowCells.map(parsedCell).filter((cell): cell is NonNullable<typeof cell> => cell !== undefined);
  const anchors = cells.filter((cell) => cell.semanticField === "factorName");
  if (anchors.length === 0) return { status: "unavailable", reasonCode: "factor_header_missing" };
  if (anchors.length !== 1) return { status: "unavailable", reasonCode: "ambiguous_factor_header" };

  const anchor = anchors[0]!;
  const clusterCells = cells.filter((cell) => cell.columnNumber >= anchor.columnNumber && cell.semanticField !== undefined);
  const columns: Partial<Record<FactorFieldName, ResolvedHeaderColumn>> = {};
  for (const fieldName of FACTOR_FIELD_ORDER) {
    const candidates = clusterCells.filter((cell) => cell.semanticField === fieldName);
    if (candidates.length > 1) return { status: "unavailable", reasonCode: "ambiguous_factor_header" };
    if (candidates.length === 0) continue;
    const candidate = candidates[0]!;
    columns[fieldName] = {
      semanticField: fieldName,
      sourceColumn: candidate.column,
      headerText: candidate.value,
    };
  }
  return { status: "resolved", anchorColumn: anchor.column, columns };
}