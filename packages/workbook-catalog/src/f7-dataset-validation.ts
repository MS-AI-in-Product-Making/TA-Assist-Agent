import {
  createTypedError,
  f7DatasetValidationResultSchema,
  f7FactorEvidenceSchema,
  f7MeasurementDatasetSchema,
  f7MeasurementDispositionRequestSchema,
  type F7DatasetValidationResult,
} from "@ai-assist/contracts";
import { z } from "zod";
import { hashF7MeasurementDatasetContent } from "./f7-measurement-parser.js";

type F7DatasetValidationIssue = F7DatasetValidationResult["blockingIssues"][number];
type F7MeasurementDataset = z.infer<typeof f7MeasurementDatasetSchema>;
type F7FactorEvidence = z.infer<typeof f7FactorEvidenceSchema>;

const VALIDATION_SUMMARY = "F7 measurement dataset validation input is invalid.";
const DISPOSITION_SUMMARY = "F7 measurement disposition request is invalid.";
const TRANSITION_SUMMARY = "F7 measurement disposition transition is invalid.";
const SUGGESTED_ACTION = "Provide valid F7 factor evidence, dataset, and disposition parameters.";

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function dispositionError(summary: string): Error {
  return createTypedError({
    code: "validation_error",
    summary,
    suggestedAction: SUGGESTED_ACTION,
    affectedInputReferences: ["f7-dataset-validation"],
  });
}

const validationReasonOrder = [
  "subgroup_too_small",
  "ordered_sequence_invalid",
  "sample_count_below_minimum",
  "exploratory_only",
  "fit_uncertainty",
  "unit_mismatch",
  "specification_missing",
  "non_finite_measurement",
  "duplicate_measurement",
  "msa_evidence_missing",
  "mixed_batch_conditions",
  "outlier_candidate",
  "invalid_rows_rejected",
] as const;

const validationReasonPriority = new Map<string, number>(
  validationReasonOrder.map((reason, index) => [reason, index]),
);

function normalizeRowNumbers(rowNumbers: readonly number[] | undefined): number[] | undefined {
  if (rowNumbers === undefined || rowNumbers.length === 0) return undefined;
  return [...new Set(rowNumbers)].sort((left, right) => left - right);
}

function rowNumbersSortKey(issue: F7DatasetValidationIssue): string {
  return (issue.rowNumbers ?? []).join(",");
}

function issueSort(left: F7DatasetValidationIssue, right: F7DatasetValidationIssue): number {
  const reasonDelta = (validationReasonPriority.get(left.reason) ?? Number.MAX_SAFE_INTEGER)
    - (validationReasonPriority.get(right.reason) ?? Number.MAX_SAFE_INTEGER);
  if (reasonDelta !== 0) return reasonDelta;
  const factorDelta = (left.factorId ?? "").localeCompare(right.factorId ?? "");
  if (factorDelta !== 0) return factorDelta;
  const rowsDelta = rowNumbersSortKey(left).localeCompare(rowNumbersSortKey(right));
  if (rowsDelta !== 0) return rowsDelta;
  return 0;
}

function uniqueIssues(issues: readonly F7DatasetValidationIssue[]): F7DatasetValidationIssue[] {
  const seen = new Set<string>();
  const unique: F7DatasetValidationIssue[] = [];
  for (const issue of issues) {
    const normalizedIssue = {
      ...issue,
      rowNumbers: normalizeRowNumbers(issue.rowNumbers),
    };
    const key = `${normalizedIssue.reason}|${normalizedIssue.factorId ?? ""}|${rowNumbersSortKey(normalizedIssue)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalizedIssue);
  }
  unique.sort(issueSort);
  return unique;
}

function parsePositiveIntegerString(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  return Number(value);
}

function quantile(sorted: readonly number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const lowValue = sorted[low];
  const highValue = sorted[high];
  if (lowValue === undefined || highValue === undefined) return Number.NaN;
  if (low === high) return lowValue;
  return lowValue + (index - low) * (highValue - lowValue);
}

function validateStructure(
  factorId: string,
  dataset: F7MeasurementDataset,
  blockingIssues: F7DatasetValidationIssue[],
): void {
  const included = dataset.observations
    .filter((observation) => observation.disposition === "included")
    .sort((left, right) => left.originalRow - right.originalRow);

  if (dataset.structure === "RATIONAL_SUBGROUP") {
    const subgroupRows = new Map<string, number[]>();
    const insufficientRows = new Set<number>();
    for (const observation of included) {
      if (observation.subgroup === undefined || observation.subgroup.trim().length === 0) {
        insufficientRows.add(observation.originalRow);
        continue;
      }
      const rows = subgroupRows.get(observation.subgroup) ?? [];
      rows.push(observation.originalRow);
      subgroupRows.set(observation.subgroup, rows);
    }

    for (const rows of subgroupRows.values()) {
      if (rows.length >= 2) continue;
      for (const rowNumber of rows) insufficientRows.add(rowNumber);
    }

    if (insufficientRows.size > 0) {
      blockingIssues.push({
        reason: "subgroup_too_small",
        factorId,
        rowNumbers: [...insufficientRows].sort((left, right) => left - right),
      });
    }
  }

  if (dataset.structure === "ORDERED_INDIVIDUALS") {
    const sequenceRows = new Map<number, number[]>();
    const invalidRows = new Set<number>();

    for (const observation of included) {
      const sequence = parsePositiveIntegerString(observation.sequence);
      if (sequence === undefined) {
        invalidRows.add(observation.originalRow);
        continue;
      }

      const rows = sequenceRows.get(sequence) ?? [];
      rows.push(observation.originalRow);
      sequenceRows.set(sequence, rows);
    }

    for (const rows of sequenceRows.values()) {
      if (rows.length < 2) continue;
      for (const rowNumber of rows) invalidRows.add(rowNumber);
    }

    for (let index = 0; index < included.length; index += 1) {
      const observation = included[index]!;
      const expected = index + 1;
      const sequence = parsePositiveIntegerString(observation.sequence);
      if (sequence !== expected) invalidRows.add(observation.originalRow);
    }

    if (invalidRows.size > 0) {
      blockingIssues.push({
        reason: "ordered_sequence_invalid",
        factorId,
        rowNumbers: [...invalidRows].sort((left, right) => left - right),
      });
    }
  }
}

function buildBaseResult(): F7DatasetValidationResult {
  return {
    status: "ready",
    blockingIssues: [],
    advisoryIssues: [],
    candidateEligibility: {
      normal: "eligible",
      lognormal: "eligible",
      weibull: "eligible",
      gamma: "eligible",
      uniform: "eligible_with_boundary_warning",
    },
  };
}

export function validateF7MeasurementDataset(input: {
  readonly factor: unknown;
  readonly dataset: unknown;
}): F7DatasetValidationResult {
  void VALIDATION_SUMMARY;
  const factorParsed = f7FactorEvidenceSchema.safeParse(input.factor);
  const datasetParsed = f7MeasurementDatasetSchema.safeParse(input.dataset);

  const result = buildBaseResult();
  const blockingIssues: F7DatasetValidationIssue[] = [];
  const advisoryIssues: F7DatasetValidationIssue[] = [];

  const factorId = factorParsed.success
    ? factorParsed.data.factorId
    : (datasetParsed.success ? datasetParsed.data.factorId : undefined);

  if (!factorParsed.success) {
    blockingIssues.push({ reason: "specification_missing", ...(factorId ? { factorId } : {}) });
  }

  if (!datasetParsed.success) {
    blockingIssues.push({ reason: "invalid_rows_rejected", ...(factorId ? { factorId } : {}) });
    result.status = "blocked";
    result.blockingIssues = uniqueIssues(blockingIssues);
    result.advisoryIssues = uniqueIssues(advisoryIssues);
    return deepFreeze(f7DatasetValidationResultSchema.parse(structuredClone(result)));
  }

  const dataset = datasetParsed.data;
  const included = dataset.observations.filter((observation) => observation.disposition === "included");
  const includedValues = included.map((observation) => observation.value);
  const resolvedFactorId = dataset.factorId;

  if (!factorParsed.success) {
    // Keep validator running from dataset-only evidence but preserve blocking spec issue above.
  } else {
    const factor: F7FactorEvidence = factorParsed.data;
    if (factor.factorId !== dataset.factorId) {
      blockingIssues.push({ reason: "specification_missing", factorId: resolvedFactorId });
    }

    if (factor.unit.trim() !== dataset.unit.trim()) {
      blockingIssues.push({ reason: "unit_mismatch", factorId: resolvedFactorId });
    }
  }

  validateStructure(resolvedFactorId, dataset, blockingIssues);

  if (included.length < 20) {
    blockingIssues.push({ reason: "sample_count_below_minimum", factorId: resolvedFactorId });
  } else if (included.length < 30) {
    advisoryIssues.push({ reason: "exploratory_only", factorId: resolvedFactorId });
  } else if (included.length < 50) {
    advisoryIssues.push({ reason: "fit_uncertainty", factorId: resolvedFactorId });
  }

  const nonFiniteRows: number[] = [];
  const invalidRejectedRows: number[] = [];
  for (const rejection of dataset.rejectionSummaries) {
    if (rejection.reason === "non_finite_value") {
      nonFiniteRows.push(rejection.rowNumber);
      continue;
    }

    invalidRejectedRows.push(rejection.rowNumber);
  }

  if (nonFiniteRows.length > 0) {
    blockingIssues.push({
      reason: "non_finite_measurement",
      factorId: resolvedFactorId,
      rowNumbers: nonFiniteRows,
    });
  }

  if (invalidRejectedRows.length > 0) {
    advisoryIssues.push({
      reason: "invalid_rows_rejected",
      factorId: resolvedFactorId,
      rowNumbers: invalidRejectedRows,
    });
  }

  const seenValueRows = new Map<string, number[]>();
  for (const observation of included.sort((left, right) => left.originalRow - right.originalRow)) {
    const key = String(observation.value);
    const rows = seenValueRows.get(key) ?? [];
    rows.push(observation.originalRow);
    seenValueRows.set(key, rows);
  }

  const duplicateRows = new Set<number>();
  for (const rows of seenValueRows.values()) {
    if (rows.length < 2) continue;
    for (const rowNumber of rows) duplicateRows.add(rowNumber);
  }
  if (duplicateRows.size > 0) {
    advisoryIssues.push({
      reason: "duplicate_measurement",
      factorId: resolvedFactorId,
      rowNumbers: [...duplicateRows].sort((left, right) => left - right),
    });
  }

  if (dataset.msaStatus !== "available") {
    advisoryIssues.push({ reason: "msa_evidence_missing", factorId: resolvedFactorId });
  }

  const nonEmptyBatchObservations = included
    .filter((observation) => typeof observation.batch === "string" && observation.batch.trim().length > 0)
    .map((observation) => ({
      rowNumber: observation.originalRow,
      batch: observation.batch!.trim(),
    }));
  const nonEmptyBatches = new Set(nonEmptyBatchObservations.map((entry) => entry.batch));
  if (nonEmptyBatches.size > 1) {
    advisoryIssues.push({
      reason: "mixed_batch_conditions",
      factorId: resolvedFactorId,
      rowNumbers: nonEmptyBatchObservations.map((entry) => entry.rowNumber),
    });
  }

  if (includedValues.length >= 4) {
    const sortedValues = [...includedValues].sort((left, right) => left - right);
    const q1 = quantile(sortedValues, 0.25);
    const q3 = quantile(sortedValues, 0.75);
    const iqr = q3 - q1;
    if (Number.isFinite(iqr) && iqr > 0) {
      const lower = q1 - 3 * iqr;
      const upper = q3 + 3 * iqr;
      const outlierRows: number[] = [];
      for (const observation of included) {
        if (observation.value < lower || observation.value > upper) {
          outlierRows.push(observation.originalRow);
        }
      }

      if (outlierRows.length > 0) {
        advisoryIssues.push({
          reason: "outlier_candidate",
          factorId: resolvedFactorId,
          rowNumbers: outlierRows,
        });
      }
    }
  }

  const allPositive = included.every((observation) => observation.value > 0);
  result.candidateEligibility = {
    normal: "eligible",
    lognormal: allPositive ? "eligible" : "ineligible_nonpositive",
    weibull: allPositive ? "eligible" : "ineligible_nonpositive",
    gamma: allPositive ? "eligible" : "ineligible_nonpositive",
    uniform: "eligible_with_boundary_warning",
  };

  result.blockingIssues = uniqueIssues(blockingIssues);
  result.advisoryIssues = uniqueIssues(advisoryIssues);
  result.status = result.blockingIssues.length === 0 ? "ready" : "blocked";

  return deepFreeze(f7DatasetValidationResultSchema.parse(structuredClone(result)));
}

export function applyF7MeasurementDisposition(input: {
  readonly dataset: unknown;
  readonly rowNumbers: readonly number[];
  readonly action: "EXCLUDE" | "RESTORE";
  readonly reason: "OUTLIER" | "MEASUREMENT_SYSTEM_ERROR" | "TRANSCRIPTION_ERROR" | "PROCESS_INTERRUPTION" | "OTHER";
  readonly operatorReference: string;
  readonly confirmed: boolean;
}): F7MeasurementDataset {
  const datasetParsed = f7MeasurementDatasetSchema.safeParse(input.dataset);
  if (!datasetParsed.success) throw dispositionError(DISPOSITION_SUMMARY);

  const requestParsed = f7MeasurementDispositionRequestSchema.safeParse({
    factorId: datasetParsed.data.factorId,
    rowNumbers: input.rowNumbers,
    action: input.action,
    reason: input.reason,
    operatorReference: input.operatorReference,
    confirmed: input.confirmed,
  });
  if (!requestParsed.success) throw dispositionError(DISPOSITION_SUMMARY);

  const dataset = structuredClone(datasetParsed.data);
  const observationByRow = new Map<number, number>();
  dataset.observations.forEach((observation, index) => {
    observationByRow.set(observation.originalRow, index);
  });

  const targetRows = [...requestParsed.data.rowNumbers].sort((left, right) => left - right);
  for (const rowNumber of targetRows) {
    if (!observationByRow.has(rowNumber)) throw dispositionError(DISPOSITION_SUMMARY);
  }

  for (const rowNumber of targetRows) {
    const index = observationByRow.get(rowNumber);
    if (index === undefined) throw dispositionError(DISPOSITION_SUMMARY);
    const observation = dataset.observations[index]!;

    if (requestParsed.data.action === "EXCLUDE" && observation.disposition === "excluded") {
      throw dispositionError(TRANSITION_SUMMARY);
    }

    if (requestParsed.data.action === "RESTORE" && observation.disposition === "included") {
      throw dispositionError(TRANSITION_SUMMARY);
    }
  }

  for (const rowNumber of targetRows) {
    const index = observationByRow.get(rowNumber);
    if (index === undefined) throw dispositionError(DISPOSITION_SUMMARY);
    const observation = dataset.observations[index]!;

    if (requestParsed.data.action === "EXCLUDE") {
      dataset.observations[index] = {
        value: observation.value,
        originalRow: observation.originalRow,
        sequence: observation.sequence,
        timestamp: observation.timestamp,
        subgroup: observation.subgroup,
        batch: observation.batch,
        disposition: "excluded",
        reason: requestParsed.data.reason,
        operatorReference: requestParsed.data.operatorReference,
        confirmed: true,
      };
      continue;
    }

    dataset.observations[index] = {
      value: observation.value,
      originalRow: observation.originalRow,
      sequence: observation.sequence,
      timestamp: observation.timestamp,
      subgroup: observation.subgroup,
      batch: observation.batch,
      disposition: "included",
    };
  }

  dataset.analyzedCount = dataset.observations.filter((observation) => observation.disposition === "included").length;
  dataset.contentHash = hashF7MeasurementDatasetContent(dataset);

  const parsed = f7MeasurementDatasetSchema.parse(dataset);
  return deepFreeze(structuredClone(parsed));
}
