import { describe, expect, it } from "vitest";
import type { F7FactorEvidence, F7MeasurementDataset } from "@ai-assist/contracts";
import { parseF7MeasurementPaste } from "./f7-measurement-parser.js";
import {
  applyF7MeasurementDisposition,
  validateF7MeasurementDataset,
} from "./f7-dataset-validation.js";

const FACTOR_ID = "a".repeat(64);
const CANDIDATE_ID = "b".repeat(64);
const WORKBOOK_HASH = "c".repeat(64);

function makeFactor(overrides: Partial<F7FactorEvidence> = {}): F7FactorEvidence {
  return {
    workbookContentHash: WORKBOOK_HASH,
    worksheetName: "Analysis-A",
    tableId: "table-1",
    sourceRow: 2,
    sourceCells: { mean: "Analysis-A!D2" },
    factorCandidateId: CANDIDATE_ID,
    factorId: FACTOR_ID,
    factorName: "Gap",
    unit: "mm",
    unitSource: "user_confirmed",
    designNominal: 1,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 3,
    distribution: "Normal",
    calculatedMean: 1,
    tolerance: 0.2,
    oneSigma: 0.2,
    percentContributionToSigma: 1,
    loopCoefficient: 1,
    physicalMean: 1,
    signedContributionMean: 1,
    baselineSampler: {
      samplerId: "NORMAL_LOCATION_SCALE_V1",
      physicalMean: 1,
      standardDeviation: 0.2,
      support: "REAL",
    },
    lowerSpecLimit: 0.9,
    upperSpecLimit: 1.1,
    ...overrides,
  };
}

function makeDataset(options: {
  count: number;
  structure?: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
  msaStatus?: "available" | "not_available" | "unknown";
  withSequence?: boolean;
  withSubgroup?: boolean;
  withBatch?: boolean;
  nonFiniteRow?: number;
  invalidRow?: number;
  missingRow?: number;
  constantValue?: number;
  outlierAtRow?: number;
  outlierValue?: number;
}): F7MeasurementDataset {
  const structure = options.structure ?? "ORDERED_INDIVIDUALS";
  const header = ["value"];
  if (options.withSequence) header.push("sequence");
  if (options.withSubgroup) header.push("subgroup");
  if (options.withBatch) header.push("batch");

  const lines: string[] = [header.join("\t")];

  for (let index = 1; index <= options.count; index += 1) {
    if (options.nonFiniteRow === index) {
      const row = ["NaN"];
      if (options.withSequence) row.push(String(index));
      if (options.withSubgroup) row.push(`SG-${Math.ceil(index / 2)}`);
      if (options.withBatch) row.push("batch-a");
      lines.push(row.join("\t"));
      continue;
    }

    if (options.invalidRow === index) {
      const row = ["invalid"];
      if (options.withSequence) row.push(String(index));
      if (options.withSubgroup) row.push(`SG-${Math.ceil(index / 2)}`);
      if (options.withBatch) row.push("batch-a");
      lines.push(row.join("\t"));
      continue;
    }

    if (options.missingRow === index) {
      lines.push("   ");
      continue;
    }

    const rowValue = options.constantValue
      ?? (options.outlierAtRow === index ? (options.outlierValue ?? 999) : index / 10 + 1);
    const row = [String(rowValue)];
    if (options.withSequence) row.push(String(index));
    if (options.withSubgroup) row.push(`SG-${Math.ceil(index / 2)}`);
    if (options.withBatch) row.push("batch-a");
    lines.push(row.join("\t"));
  }

  const parsed = parseF7MeasurementPaste({
    factorId: FACTOR_ID,
    unit: "mm",
    structure,
    sourceReference: "clipboard",
    importedAt: "2026-08-19T08:05:00.000Z",
    msaStatus: options.msaStatus ?? "available",
    text: lines.join("\n"),
  });

  if (!parsed.dataset) throw new Error("expected parser to return dataset");
  return structuredClone(parsed.dataset);
}

function makeDatasetWithExplicitMissingValue(): F7MeasurementDataset {
  const parsed = parseF7MeasurementPaste({
    factorId: FACTOR_ID,
    unit: "mm",
    structure: "UNORDERED_SAMPLE",
    sourceReference: "clipboard",
    importedAt: "2026-08-19T08:05:00.000Z",
    msaStatus: "available",
    text: [
      "value\tbatch",
      "1.1\tbatch-a",
      "\tbatch-a",
      "invalid\tbatch-a",
      "1.2\tbatch-a",
    ].join("\n"),
  });

  if (!parsed.dataset) throw new Error("expected parser to return dataset");
  return structuredClone(parsed.dataset);
}

function reasons(issues: ReadonlyArray<{ reason: string }>): string[] {
  return issues.map((issue) => issue.reason);
}

function issueByReason(
  issues: ReadonlyArray<{ reason: string; rowNumbers?: readonly number[] }>,
  reason: string,
): { reason: string; rowNumbers?: readonly number[] } | undefined {
  return issues.find((issue) => issue.reason === reason);
}

describe("validateF7MeasurementDataset", () => {
  it("accepts rational subgroup when each subgroup has at least 2 observations", () => {
    const factor = makeFactor();
    const dataset = makeDataset({
      count: 50,
      structure: "RATIONAL_SUBGROUP",
      withSubgroup: true,
    });

    const result = validateF7MeasurementDataset({ factor, dataset });

    expect(result.status).toBe("ready");
    expect(reasons(result.blockingIssues)).not.toContain("subgroup_too_small");
  });

  it("blocks rational subgroup when a subgroup has only one observation", () => {
    const factor = makeFactor();
    const dataset = makeDataset({
      count: 50,
      structure: "RATIONAL_SUBGROUP",
      withSubgroup: true,
    });

    const target = dataset.observations.find((entry) => entry.originalRow === 2);
    if (!target) throw new Error("expected row 2");
    target.subgroup = "SG-single";

    const result = validateF7MeasurementDataset({ factor, dataset });

    expect(result.status).toBe("blocked");
    expect(result.blockingIssues).toContainEqual({
      reason: "subgroup_too_small",
      factorId: FACTOR_ID,
      rowNumbers: [2, 3],
    });
  });

  it("blocks rational subgroup when subgroup metadata is missing", () => {
    const factor = makeFactor();
    const dataset = makeDataset({
      count: 50,
      structure: "RATIONAL_SUBGROUP",
      withSubgroup: true,
    });

    const target = dataset.observations.find((entry) => entry.originalRow === 2);
    if (!target) throw new Error("expected row 2");
    delete (target as { subgroup?: string }).subgroup;

    const result = validateF7MeasurementDataset({ factor, dataset });

    expect(result.status).toBe("blocked");
    expect(result.blockingIssues).toContainEqual({
      reason: "subgroup_too_small",
      factorId: FACTOR_ID,
      rowNumbers: [2, 3],
    });
  });

  it("validates ordered individuals with global contiguous sequence 1..n", () => {
    const factor = makeFactor();
    const dataset = makeDataset({
      count: 50,
      structure: "ORDERED_INDIVIDUALS",
      withSequence: true,
      withBatch: true,
    });

    const result = validateF7MeasurementDataset({ factor, dataset });

    expect(result.status).toBe("ready");
    expect(reasons(result.blockingIssues)).not.toContain("ordered_sequence_invalid");
  });

  it("blocks ordered individuals when sequence is missing, duplicate, or gapped", () => {
    const factor = makeFactor();
    const missingSequence = makeDataset({
      count: 50,
      structure: "ORDERED_INDIVIDUALS",
      withSequence: true,
    });
    const duplicateSequence = makeDataset({
      count: 50,
      structure: "ORDERED_INDIVIDUALS",
      withSequence: true,
    });
    const gappedSequence = makeDataset({
      count: 50,
      structure: "ORDERED_INDIVIDUALS",
      withSequence: true,
    });

    const row2 = missingSequence.observations.find((entry) => entry.originalRow === 2);
    const row4 = duplicateSequence.observations.find((entry) => entry.originalRow === 4);
    const row5 = gappedSequence.observations.find((entry) => entry.originalRow === 5);
    if (!row2 || !row4 || !row5) throw new Error("expected rows");

    delete (row2 as { sequence?: string }).sequence;
    row4.sequence = "2";
    row5.sequence = "9";

    const missingResult = validateF7MeasurementDataset({ factor, dataset: missingSequence });
    const duplicateResult = validateF7MeasurementDataset({ factor, dataset: duplicateSequence });
    const gappedResult = validateF7MeasurementDataset({ factor, dataset: gappedSequence });

    expect(missingResult.status).toBe("blocked");
    expect(missingResult.blockingIssues).toContainEqual({
      reason: "ordered_sequence_invalid",
      factorId: FACTOR_ID,
      rowNumbers: [2],
    });

    expect(duplicateResult.status).toBe("blocked");
    expect(duplicateResult.blockingIssues).toContainEqual({
      reason: "ordered_sequence_invalid",
      factorId: FACTOR_ID,
      rowNumbers: [3, 4],
    });

    expect(gappedResult.status).toBe("blocked");
    expect(gappedResult.blockingIssues).toContainEqual({
      reason: "ordered_sequence_invalid",
      factorId: FACTOR_ID,
      rowNumbers: [5, 10],
    });
  });

  it("allows unordered sample without ordering metadata and ignores optional ordering metadata", () => {
    const factor = makeFactor();
    const withoutOrdering = makeDataset({
      count: 50,
      structure: "UNORDERED_SAMPLE",
    });
    const withOrdering = makeDataset({
      count: 50,
      structure: "UNORDERED_SAMPLE",
      withSequence: true,
    });

    const noOrderingResult = validateF7MeasurementDataset({ factor, dataset: withoutOrdering });
    const withOrderingResult = validateF7MeasurementDataset({ factor, dataset: withOrdering });

    expect(noOrderingResult.status).toBe("ready");
    expect(withOrderingResult.status).toBe("ready");
  });

  it("enforces sample count thresholds", () => {
    const factor = makeFactor();
    const below20 = makeDataset({ count: 19, structure: "UNORDERED_SAMPLE" });
    const count20 = makeDataset({ count: 20, structure: "UNORDERED_SAMPLE" });
    const count30 = makeDataset({ count: 30, structure: "UNORDERED_SAMPLE" });
    const count50 = makeDataset({ count: 50, structure: "UNORDERED_SAMPLE" });

    const resultBelow20 = validateF7MeasurementDataset({ factor, dataset: below20 });
    const result20 = validateF7MeasurementDataset({ factor, dataset: count20 });
    const result30 = validateF7MeasurementDataset({ factor, dataset: count30 });
    const result50 = validateF7MeasurementDataset({ factor, dataset: count50 });

    expect(resultBelow20.status).toBe("blocked");
    expect(reasons(resultBelow20.blockingIssues)).toContain("sample_count_below_minimum");
    expect(result20.status).toBe("ready");
    expect(reasons(result20.advisoryIssues)).toContain("exploratory_only");
    expect(result30.status).toBe("ready");
    expect(reasons(result30.advisoryIssues)).toContain("fit_uncertainty");
    expect(reasons(result50.advisoryIssues)).not.toContain("exploratory_only");
    expect(reasons(result50.advisoryIssues)).not.toContain("fit_uncertainty");
  });

  it("blocks on unit mismatch and missing/invalid factor specifications", () => {
    const dataset = makeDataset({ count: 50 });
    const mismatchedUnit = makeFactor({ unit: "um" });
    const missingSpecFactor = {
      factorId: FACTOR_ID,
      unit: "mm",
      lowerSpecLimit: 0,
    };

    const mismatchResult = validateF7MeasurementDataset({ factor: mismatchedUnit, dataset });
    const unknownVariantResult = validateF7MeasurementDataset({
      factor: { factorId: FACTOR_ID, unit: "mm" },
      dataset,
    });
    const missingSpecResult = validateF7MeasurementDataset({
      factor: missingSpecFactor,
      dataset,
    });

    expect(mismatchResult.status).toBe("blocked");
    expect(reasons(mismatchResult.blockingIssues)).toContain("unit_mismatch");
    expect(unknownVariantResult.status).toBe("blocked");
    expect(reasons(unknownVariantResult.blockingIssues)).toContain("specification_missing");
    expect(missingSpecResult.status).toBe("blocked");
    expect(reasons(missingSpecResult.blockingIssues)).toContain("specification_missing");
  });

  it("maps parser rejections to non_finite_measurement blocking and grouped invalid_rows_rejected advisory", () => {
    const factor = makeFactor();
    const nonFiniteDataset = makeDataset({
      count: 50,
      structure: "UNORDERED_SAMPLE",
      nonFiniteRow: 4,
      invalidRow: 6,
    });
    const missingValueDataset = makeDatasetWithExplicitMissingValue();

    const result = validateF7MeasurementDataset({ factor, dataset: nonFiniteDataset });
    const missingValueResult = validateF7MeasurementDataset({ factor, dataset: missingValueDataset });

    expect(result.status).toBe("blocked");
    expect(result.blockingIssues).toContainEqual({
      reason: "non_finite_measurement",
      factorId: FACTOR_ID,
      rowNumbers: [5],
    });
    expect(result.advisoryIssues).toContainEqual({
      reason: "invalid_rows_rejected",
      factorId: FACTOR_ID,
      rowNumbers: [7],
    });

    expect(missingValueResult.advisoryIssues).toContainEqual({
      reason: "invalid_rows_rejected",
      factorId: FACTOR_ID,
      rowNumbers: [3, 4],
    });
  });

  it("ignores MSA status while retaining duplicate and mixed-batch advisories", () => {
    const factor = makeFactor();
    const dataset = makeDataset({
      count: 50,
      structure: "UNORDERED_SAMPLE",
      msaStatus: "unknown",
      withBatch: true,
    });

    const row2 = dataset.observations.find((entry) => entry.originalRow === 2);
    const row3 = dataset.observations.find((entry) => entry.originalRow === 3);
    const row4 = dataset.observations.find((entry) => entry.originalRow === 4);
    if (!row2 || !row3 || !row4) throw new Error("expected rows");

    row3.value = row2.value;
    row4.batch = "batch-b";

    const result = validateF7MeasurementDataset({ factor, dataset });

    expect(result.status).toBe("ready");
    expect(result.advisoryIssues).toContainEqual({
      reason: "duplicate_measurement",
      factorId: FACTOR_ID,
      rowNumbers: [2, 3],
    });
    expect(reasons(result.advisoryIssues)).not.toContain("msa_evidence_missing");
    const mixedBatchIssue = issueByReason(result.advisoryIssues, "mixed_batch_conditions");
    expect(mixedBatchIssue).toBeDefined();
    expect(mixedBatchIssue?.rowNumbers).toEqual(expect.arrayContaining([2, 4]));
  });

  it("flags deterministic Tukey outer-fence candidates by row references only and handles IQR=0", () => {
    const factor = makeFactor();
    const outlierDataset = makeDataset({
      count: 50,
      structure: "UNORDERED_SAMPLE",
      outlierAtRow: 25,
      outlierValue: 500,
    });
    const flatDataset = makeDataset({ count: 50, structure: "UNORDERED_SAMPLE", constantValue: 2 });

    const outlierResult = validateF7MeasurementDataset({ factor, dataset: outlierDataset });
    const flatResult = validateF7MeasurementDataset({ factor, dataset: flatDataset });

    expect(outlierResult.status).toBe("ready");
    expect(outlierResult.advisoryIssues).toContainEqual({
      reason: "outlier_candidate",
      factorId: FACTOR_ID,
      rowNumbers: [26],
    });
    expect(flatResult.advisoryIssues).not.toContainEqual(
      expect.objectContaining({ reason: "outlier_candidate", rowNumbers: expect.any(Array) }),
    );
  });

  it("computes candidate eligibility without blocking dataset by candidate support", () => {
    const factor = makeFactor();
    const allPositive = makeDataset({ count: 50, structure: "UNORDERED_SAMPLE" });
    const hasNonPositive = makeDataset({ count: 50, structure: "UNORDERED_SAMPLE" });
    const row2 = hasNonPositive.observations.find((entry) => entry.originalRow === 2);
    if (!row2) throw new Error("expected row 2");
    row2.value = 0;

    const positiveResult = validateF7MeasurementDataset({ factor, dataset: allPositive });
    const nonPositiveResult = validateF7MeasurementDataset({ factor, dataset: hasNonPositive });

    expect(positiveResult.candidateEligibility).toEqual({
      normal: "eligible",
      lognormal: "eligible",
      weibull: "eligible",
      gamma: "eligible",
      uniform: "eligible_with_boundary_warning",
    });
    expect(nonPositiveResult.candidateEligibility).toEqual({
      normal: "eligible",
      lognormal: "ineligible_nonpositive",
      weibull: "ineligible_nonpositive",
      gamma: "ineligible_nonpositive",
      uniform: "eligible_with_boundary_warning",
    });
  });

  it("returns a frozen validation result", () => {
    const result = validateF7MeasurementDataset({
      factor: makeFactor(),
      dataset: makeDataset({ count: 50, structure: "UNORDERED_SAMPLE" }),
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.blockingIssues)).toBe(true);
    expect(Object.isFrozen(result.advisoryIssues)).toBe(true);
    expect(Object.isFrozen(result.candidateEligibility)).toBe(true);
    expect(() => {
      (result as { status: string }).status = "blocked";
    }).toThrow();
  });
});

describe("applyF7MeasurementDisposition", () => {
  it("rejects unknown rows with fixed validation error", () => {
    const dataset = makeDataset({ count: 50, structure: "UNORDERED_SAMPLE" });

    expect(() => applyF7MeasurementDisposition({
      dataset,
      rowNumbers: [999],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    })).toThrow(/measurement disposition/i);
  });

  it("requires non-empty reason, operatorReference, and confirmed=true for exclusion", () => {
    const dataset = makeDataset({ count: 50, structure: "UNORDERED_SAMPLE" });

    expect(() => applyF7MeasurementDisposition({
      dataset,
      rowNumbers: [2],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "",
      confirmed: true,
    })).toThrow();

    expect(() => applyF7MeasurementDisposition({
      dataset,
      rowNumbers: [2],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: false,
    })).toThrow();
  });

  it("excludes included rows, preserves original observations, recomputes counts/hash, and freezes result", () => {
    const dataset = makeDataset({ count: 50, structure: "UNORDERED_SAMPLE" });

    const before = structuredClone(dataset);
    const next = applyF7MeasurementDisposition({
      dataset,
      rowNumbers: [2, 3],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    });

    expect(next.originalRowCount).toBe(before.originalRowCount);
    expect(next.observations.length).toBe(before.observations.length);
    expect(next.analyzedCount).toBe(before.analyzedCount - 2);
    expect(next.contentHash).not.toBe(before.contentHash);

    const row2 = next.observations.find((entry) => entry.originalRow === 2);
    const beforeRow2 = before.observations.find((entry) => entry.originalRow === 2);
    if (!row2 || !beforeRow2) throw new Error("expected rows");

    expect(row2.value).toBe(beforeRow2.value);
    expect(row2.disposition).toBe("excluded");
    expect((row2 as { reason?: string }).reason).toBe("OUTLIER");
    expect((row2 as { operatorReference?: string }).operatorReference).toBe("op-1");

    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.observations)).toBe(true);
  });

  it("restores excluded rows, removes exclusion-only fields, and changes hash again", () => {
    const dataset = makeDataset({ count: 50, structure: "UNORDERED_SAMPLE" });

    const excluded = applyF7MeasurementDisposition({
      dataset,
      rowNumbers: [2],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    });
    const restored = applyF7MeasurementDisposition({
      dataset: excluded,
      rowNumbers: [2],
      action: "RESTORE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    });

    expect(restored.analyzedCount).toBe(dataset.analyzedCount);
    expect(restored.contentHash).not.toBe(excluded.contentHash);

    const row2 = restored.observations.find((entry) => entry.originalRow === 2);
    if (!row2) throw new Error("expected row 2");

    expect(row2.disposition).toBe("included");
    expect(row2).not.toHaveProperty("reason");
    expect(row2).not.toHaveProperty("operatorReference");
    expect(row2).not.toHaveProperty("confirmed");
  });

  it("rejects duplicate rows and invalid state transitions", () => {
    const dataset = makeDataset({ count: 50 });
    const excluded = applyF7MeasurementDisposition({
      dataset,
      rowNumbers: [2],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    });

    expect(() => applyF7MeasurementDisposition({
      dataset,
      rowNumbers: [2, 2],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    })).toThrow();

    expect(() => applyF7MeasurementDisposition({
      dataset: excluded,
      rowNumbers: [2],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    })).toThrow(/transition/i);

    expect(() => applyF7MeasurementDisposition({
      dataset,
      rowNumbers: [2],
      action: "RESTORE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    })).toThrow(/transition/i);
  });
});
