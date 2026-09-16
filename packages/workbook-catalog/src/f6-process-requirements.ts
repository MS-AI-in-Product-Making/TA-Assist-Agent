import type {
  AdoTraceabilityV3,
  CalculationCompletedResult,
  DrawingGovernanceResultV3,
  F2UserReport,
  F6AnalysisContext,
} from "@ai-assist/contracts";

export type F6ProcessCheckId =
  | "analysis-method"
  | "input-completeness"
  | "output-completeness"
  | "tolerance-validity"
  | "drawing-dim-governance"
  | "ado-traceability"
  | "target-sigma";

export type F6ProcessCheckStatus = "COMPLETE" | "WARNING" | "MISSING";

export interface F6ProcessCheck {
  readonly checkId: F6ProcessCheckId;
  readonly status: F6ProcessCheckStatus;
  readonly summary: string;
  readonly details: readonly string[];
}

export interface F6WorksheetDomainClassification {
  readonly kind: "battery" | "gap" | "step" | "other" | "ambiguous";
  readonly source: "analysis-object" | "deterministic-text" | "default" | "ambiguous";
  readonly matchedField?: string;
}

type AcceptedF2UserReport = Extract<F2UserReport, { readonly status: "completed" | "blocked" | "partiallyBlocked" }>;
type F2Worksheet = AcceptedF2UserReport["worksheets"][number];
type F3Worksheet = Extract<DrawingGovernanceResultV3, { status: "completed" | "governance_required" }>["worksheets"][number];
type ProcessInput = {
  readonly worksheetName: string;
  readonly toleranceLoopDescription: string;
  readonly f2Worksheet: F2Worksheet;
  readonly f3Worksheet: F3Worksheet;
  readonly f3Ado: AdoTraceabilityV3;
  readonly calculation: CalculationCompletedResult;
  readonly analysisContext?: F6AnalysisContext;
};

const CHECK_ORDER: readonly F6ProcessCheckId[] = Object.freeze([
  "analysis-method",
  "input-completeness",
  "output-completeness",
  "tolerance-validity",
  "drawing-dim-governance",
  "ado-traceability",
  "target-sigma",
]);

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function immutableChecks(checks: readonly F6ProcessCheck[]): readonly F6ProcessCheck[] {
  return deepFreeze(structuredClone(checks));
}

function check(checkId: F6ProcessCheckId, status: F6ProcessCheckStatus, summary: string, details: readonly string[] = []): F6ProcessCheck {
  return { checkId, status, summary, details: [...details] };
}

function priorityStatus(statuses: readonly F6ProcessCheckStatus[]): F6ProcessCheckStatus {
  if (statuses.includes("MISSING")) return "MISSING";
  if (statuses.includes("WARNING")) return "WARNING";
  return "COMPLETE";
}

function ordinal(row: unknown, sourceRow: number): string {
  const value = (row as { readonly factorOrdinal?: { readonly value?: string } | undefined }).factorOrdinal?.value?.trim();
  return value === undefined || value.length === 0 ? `row ${sourceRow}` : value;
}

function rowsByOrdinal<Row>(rows: readonly Row[], sourceRow: (row: Row) => number): readonly Row[] {
  return [...rows].sort((left, right) => {
    const leftValue = (left as { readonly factorOrdinal?: { readonly value?: string } | undefined }).factorOrdinal?.value;
    const rightValue = (right as { readonly factorOrdinal?: { readonly value?: string } | undefined }).factorOrdinal?.value;
    const leftOrdinal = Number(leftValue);
    const rightOrdinal = Number(rightValue);
    if (Number.isFinite(leftOrdinal) && Number.isFinite(rightOrdinal) && leftOrdinal !== rightOrdinal) return leftOrdinal - rightOrdinal;
    const leftSourceRow = sourceRow(left);
    const rightSourceRow = sourceRow(right);
    if (leftSourceRow !== rightSourceRow) return leftSourceRow - rightSourceRow;
    return (leftValue ?? "").localeCompare(rightValue ?? "");
  });
}

function rowOrdinalSortKey(row: { readonly factorOrdinal?: { readonly value?: string } | undefined } | undefined, sourceRow: number): readonly [number, number, string] {
  const value = row?.factorOrdinal?.value;
  const numeric = Number(value);
  return [Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY, sourceRow, value ?? ""];
}

function compareRowOrdinal(left: readonly [number, number, string], right: readonly [number, number, string]): number {
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] - right[1];
  return left[2].localeCompare(right[2]);
}

function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${token.replace(/ /g, "\\s+")}([^a-z0-9]|$)`, "iu").test(text);
}

function textDomain(input: ProcessInput): F6WorksheetDomainClassification | undefined {
  const fields = [
    ["worksheetName", input.worksheetName],
    ["toleranceLoopDescription", input.toleranceLoopDescription],
    ["f2Worksheet.toleranceLoopDescription", input.f2Worksheet.toleranceLoopDescription],
    ["f3Worksheet.toleranceLoopDescription", input.f3Worksheet.toleranceLoopDescription],
  ] as const;
  for (const [field, value] of fields) {
    if (value !== undefined && (hasToken(value, "battery") || hasToken(value, "battery pack"))) {
      return { kind: "battery", source: "deterministic-text", matchedField: field };
    }
  }
  for (const [field, value] of fields) {
    if (value !== undefined && hasToken(value, "gap")) return { kind: "gap", source: "deterministic-text", matchedField: field };
    if (value !== undefined && hasToken(value, "step")) return { kind: "step", source: "deterministic-text", matchedField: field };
  }
  return undefined;
}

function analysisObjectDomain(input: ProcessInput): F6WorksheetDomainClassification | undefined {
  const firstTableId = input.f2Worksheet.rows[0]?.tableId;
  const worksheet = input.analysisContext?.worksheets.find((candidate) => (
    candidate.worksheetName === input.worksheetName
    && (firstTableId === undefined || candidate.tableId === firstTableId)
  ));
  const kind = worksheet?.analysisObject?.kind;
  if (kind === "GAP") return { kind: "gap", source: "analysis-object", matchedField: "analysisContext.worksheets[0].analysisObject.kind" };
  if (kind === "STEP") return { kind: "step", source: "analysis-object", matchedField: "analysisContext.worksheets[0].analysisObject.kind" };
  if (kind !== undefined) return { kind: "other", source: "analysis-object", matchedField: "analysisContext.worksheets[0].analysisObject.kind" };
  return undefined;
}

export function classifyWorksheetDomain(input: ProcessInput): F6WorksheetDomainClassification {
  const text = textDomain(input);
  if (text?.kind === "battery") return text;
  const analysisObject = analysisObjectDomain(input);
  if (analysisObject !== undefined) return analysisObject;
  if (text !== undefined) return text;
  return input.analysisContext === undefined
    ? { kind: "ambiguous", source: "ambiguous" }
    : { kind: "other", source: "default" };
}

function createAnalysisMethodCheck(calculation: CalculationCompletedResult): F6ProcessCheck {
  if (calculation.factorCount < 4) {
    return check("analysis-method", "WARNING", `Worst Case method is recommended for ${calculation.factorCount} factors.`, [
      "Use RSS/Monte Carlo only when engineering review accepts the low factor-count assumption.",
    ]);
  }
  if (calculation.factorCount <= 10) {
    return check("analysis-method", "COMPLETE", `Monte Carlo/RSS analysis is suitable for ${calculation.factorCount} factors.`, [
      "Factor count is within the governed 4-10 deterministic range.",
    ]);
  }
  return check("analysis-method", "WARNING", `3D Variation Analysis is recommended for ${calculation.factorCount} factors.`, [
    "Escalate high-dimensional stacks to governed 3D variation analysis review.",
  ]);
}

function createInputCompletenessCheck(worksheet: F2Worksheet): F6ProcessCheck {
  const details = rowsByOrdinal(worksheet.rows, (row) => row.sourceRow)
    .filter((row) => row.missingRequiredFields.length > 0)
    .map((row) => `Factor ${ordinal(row, row.sourceRow)} row ${row.sourceRow} missing required fields: ${row.missingRequiredFields.join(", ")}.`);
  return details.length === 0
    ? check("input-completeness", "COMPLETE", "All required F2 input fields are present.")
    : check("input-completeness", "MISSING", `${details.length} factor row(s) are missing required input fields.`, details);
}

function createOutputCompletenessCheck(calculation: CalculationCompletedResult): F6ProcessCheck {
  const details: string[] = [];
  if (calculation.factors.length !== calculation.factorCount) details.push("Calculation factorCount does not match factor output count.");
  if (calculation.factors.length === 0) details.push("Calculation has no factor outputs.");
  for (const field of ["mean", "rssSigma", "worstCaseUpper", "worstCaseLower"] as const) {
    if (!Number.isFinite(calculation.system[field])) details.push(`Calculation system.${field} is missing.`);
  }
  for (const field of ["cp", "cpk", "targetSigmaLevel", "targetCpk"] as const) {
    if (!Number.isFinite(calculation.capability[field])) details.push(`Calculation capability.${field} is missing.`);
  }
  return details.length === 0
    ? check("output-completeness", "COMPLETE", "F4 calculation outputs are complete.")
    : check("output-completeness", "MISSING", "F4 calculation outputs are incomplete.", details);
}

function createToleranceValidityCheck(worksheet: F2Worksheet): F6ProcessCheck {
  const details: string[] = [];
  const specification = worksheet.systemSpecification;
  for (const field of ["lowerSpecLimit", "upperSpecLimit", "targetSigmaLevel"] as const) {
    if (specification[field]?.status !== "available") details.push(`System specification missing ${field}.`);
  }
  const rowsBySourceRow = new Map(worksheet.rows.map((row) => [row.sourceRow, row]));
  const sortedIssues = [...worksheet.f4CalculabilityIssues].sort((left, right) => {
    const leftSourceRow = left.sourceRow ?? Number.POSITIVE_INFINITY;
    const rightSourceRow = right.sourceRow ?? Number.POSITIVE_INFINITY;
    return compareRowOrdinal(rowOrdinalSortKey(rowsBySourceRow.get(leftSourceRow), leftSourceRow), rowOrdinalSortKey(rowsBySourceRow.get(rightSourceRow), rightSourceRow));
  });
  for (const issue of sortedIssues) {
    if (issue.reasonCode === "factor_tolerance_range_invalid") {
      const sourceRow = issue.sourceRow ?? Number.POSITIVE_INFINITY;
      const row = rowsBySourceRow.get(sourceRow);
      details.push(row === undefined
        ? `Factor row ${issue.sourceRow ?? "unknown"} has invalid tolerance range.`
        : `Factor ${ordinal(row, sourceRow)} row ${sourceRow} has invalid tolerance range.`);
    }
  }
  const guidanceWarnings = rowsByOrdinal(worksheet.rows, (row) => row.sourceRow)
    .filter((row) => row.capabilityStatus === "internal_guidance_exceeded")
    .map((row) => `Factor ${ordinal(row, row.sourceRow)} row ${row.sourceRow} exceeds internal tolerance guidance.`);
  const status = priorityStatus([details.length > 0 ? "MISSING" : "COMPLETE", guidanceWarnings.length > 0 ? "WARNING" : "COMPLETE"]);
  if (status === "COMPLETE") return check("tolerance-validity", "COMPLETE", "Specification limits, target sigma, and factor tolerance ranges are valid.");
  return check("tolerance-validity", status, status === "MISSING" ? "Tolerance evidence is missing or invalid." : "Tolerance guidance requires review.", [...details, ...guidanceWarnings]);
}

function createDrawingGovernanceCheck(worksheet: F3Worksheet): F6ProcessCheck {
  const details = rowsByOrdinal(worksheet.rows, (row) => row.source.sourceRow).flatMap((row) => {
    const rowDetails: string[] = [];
    const sourceRow = row.source.sourceRow;
    const missing = [
      ...(row.drawingNumber === null ? ["drawingNumber"] : []),
      ...(row.dimId === null ? ["dimCharacteristicId"] : []),
    ];
    if (missing.length > 0) rowDetails.push(`Factor ${ordinal(row, sourceRow)} row ${sourceRow} missing identifiers: ${missing.join(", ")}.`);
    if (row.dimIdStatus === "suspected_invalid") {
      rowDetails.push(`Factor ${ordinal(row, sourceRow)} row ${sourceRow} DIM ID suspected invalid: single-digit DIM ID ${row.dimId ?? "unknown"}; quality signals: ${row.qualitySignals.join(", ") || "none"}.`);
    } else if (row.dimIdStatus !== "valid" && missing.length === 0) {
      rowDetails.push(`Factor ${ordinal(row, sourceRow)} row ${sourceRow} DIM ID status: ${row.dimIdStatus}; quality signals: ${row.qualitySignals.join(", ") || "none"}.`);
    } else if (row.qualitySignals.length > 0 && missing.length === 0) {
      rowDetails.push(`Factor ${ordinal(row, sourceRow)} row ${sourceRow} quality signals: ${row.qualitySignals.join(", ")}.`);
    }
    if (row.governanceStatus !== "complete") rowDetails.push(`Factor ${ordinal(row, sourceRow)} row ${sourceRow} governance status: ${row.governanceStatus}.`);
    return rowDetails;
  });
  return details.length === 0
    ? check("drawing-dim-governance", "COMPLETE", "Drawing Number and DIM ID governance are complete.")
    : check("drawing-dim-governance", "WARNING", "Drawing/DIM governance requires review.", details);
}

function createAdoTraceabilityCheck(ado: AdoTraceabilityV3, worksheet: F3Worksheet): F6ProcessCheck {
  if (ado.status === "updated") {
    return check("ado-traceability", "COMPLETE", `ADO traceability ${ado.operation}.`, [
      `ADO work item ${ado.operation}: ${ado.organization}/${ado.project}#${ado.workItemId}.`,
    ]);
  }
  if (ado.status === "blocked" || ado.status === "failed") {
    return check("ado-traceability", "WARNING", `ADO traceability ${ado.status}.`, [
      ado.reasonCode === undefined ? `ADO traceability ${ado.status} without reason code.` : `ADO traceability ${ado.status}: ${ado.reasonCode}.`,
    ]);
  }
  const pendingRows = rowsByOrdinal(worksheet.rows, (row) => row.source.sourceRow)
    .filter((row) => row.governanceStatus !== "complete" || row.drawingNumber === null || row.dimId === null)
    .map((row) => `Factor ${ordinal(row, row.source.sourceRow)} row ${row.source.sourceRow}`);
  return check("ado-traceability", "MISSING", "ADO traceability has not been recorded.", pendingRows.length === 0
    ? ["No ADO work item requested for the governed worksheet."]
    : [`Pending ADO traceability dimensions: ${pendingRows.join(", ")}.`]);
}

function recommendedSigma(domain: F6WorksheetDomainClassification): number {
  if (domain.kind === "battery") return 6;
  if (domain.kind === "gap" || domain.kind === "step") return 3;
  return 4;
}

function currentSigma(calculation: CalculationCompletedResult): number | undefined {
  const levels = [...new Set(calculation.factors.map((factor) => factor.input.sigmaLevel))];
  return levels.length === 1 ? levels[0] : undefined;
}

function createTargetSigmaCheck(input: ProcessInput): F6ProcessCheck {
  const domain = classifyWorksheetDomain(input);
  const recommended = recommendedSigma(domain);
  const current = currentSigma(input.calculation);
  const details = [`Worksheet domain classified as ${domain.kind} from ${domain.source}.`];
  if (current === undefined) {
    return check("target-sigma", "WARNING", `Target sigma is ambiguous; recommended ${recommended} sigma cannot be compared to mixed factor sigma levels.`, details);
  }
  if (domain.kind === "ambiguous") {
    return check("target-sigma", "WARNING", `Worksheet classification evidence missing; default recommendation is ${recommended} sigma and requires engineering confirmation.`, details);
  }
  if (domain.source === "default") {
    return check("target-sigma", "WARNING", `Worksheet classification evidence missing; default recommendation is ${recommended} sigma for Other worksheets and requires engineering confirmation.`, details);
  }
  if (current !== recommended) {
    return check("target-sigma", "WARNING", `Current ${current} sigma differs from recommended ${recommended} sigma for ${domain.kind} worksheets.`, details);
  }
  return check("target-sigma", "COMPLETE", `Current ${current} sigma matches recommended ${recommended} sigma for ${domain.kind} worksheets.`, details);
}

export function createF6ProcessChecks(input: ProcessInput): readonly F6ProcessCheck[] {
  const checks = [
    createAnalysisMethodCheck(input.calculation),
    createInputCompletenessCheck(input.f2Worksheet),
    createOutputCompletenessCheck(input.calculation),
    createToleranceValidityCheck(input.f2Worksheet),
    createDrawingGovernanceCheck(input.f3Worksheet),
    createAdoTraceabilityCheck(input.f3Ado, input.f3Worksheet),
    createTargetSigmaCheck(input),
  ];
  if (checks.some((entry, index) => entry.checkId !== CHECK_ORDER[index])) {
    throw new Error("F6 process checks must be emitted in governed order.");
  }
  return immutableChecks(checks);
}