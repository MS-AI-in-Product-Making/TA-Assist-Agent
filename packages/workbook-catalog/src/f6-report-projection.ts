import type { CalculationCompletedResult } from "@ai-assist/contracts";

export interface ProjectionQuantity {
  readonly value: number;
  readonly unit: string;
}

export interface ProjectionRange {
  readonly lower: number;
  readonly upper: number;
  readonly unit: string;
}

export interface ProjectionFormulaCheck {
  readonly outputField: string;
  readonly formulaId: string;
  readonly formulaVersion: "excel-ta-v1";
  readonly expression: string;
  readonly inputs: ReadonlyArray<{
    readonly name: string;
    readonly value: number;
    readonly unit: string;
    readonly source: string;
  }>;
  readonly result: ProjectionQuantity;
  readonly sourceCells: readonly string[];
  readonly recomputable: true;
}

export interface ProjectionConsistencyCheck {
  readonly checkId: string;
  readonly calculated: ProjectionQuantity;
  readonly reported: ProjectionQuantity;
  readonly difference: ProjectionQuantity;
  readonly tolerance: ProjectionQuantity;
  readonly toleranceBasis: string;
  readonly result: "PASS" | "FAIL";
  readonly formulaCheckIds: readonly string[];
}

export interface ProjectionMarginSide {
  readonly sigmaLevel?: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly lowerMargin: number;
  readonly upperMargin: number;
  readonly minimumMargin: number;
  readonly formulaReferences: ReadonlyArray<{
    readonly outputField: string;
    readonly formulaId: string;
    readonly formulaVersion: string;
  }>;
}

export interface F6ReportProjection {
  readonly formulaChecks: readonly ProjectionFormulaCheck[];
  readonly statisticalRanges: ReadonlyArray<{
    readonly sigmaLevel: number;
    readonly range: ProjectionRange;
    readonly formulaCheckId: string;
  }>;
  readonly margins: {
    readonly statistical: ProjectionMarginSide;
    readonly worstCase: ProjectionMarginSide;
  };
  readonly selfChecks: {
    readonly mean: ProjectionConsistencyCheck;
    readonly rss: ProjectionConsistencyCheck;
    readonly worstCase: ProjectionConsistencyCheck;
    readonly worstCaseUpper: ProjectionConsistencyCheck;
    readonly worstCaseLower: ProjectionConsistencyCheck;
    readonly ranges: readonly ProjectionConsistencyCheck[];
  };
}

const FORMULA_EXPRESSIONS: Readonly<Record<string, string>> = Object.freeze({
  "system-mean-v1": "mu = sum(mean_i) + additionalMeanShift",
  "worst-case-v1": "WC_upper = sum(U_i); WC_lower = sum(L_i)",
  "rss-v1": "sigma_RSS = sqrt(sum(sigma_i^2))",
  "cp-v1": "Cp = (USL - LSL) / (6 * sigma)",
  "cpk-lower-v1": "Cpk_L = (mean - LSL) / (3 * sigma)",
  "cpk-upper-v1": "Cpk_U = (USL - mean) / (3 * sigma)",
  "cpk-v1": "Cpk = min(Cpk_L, Cpk_U)",
});

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function quantity(value: number, unit: string): ProjectionQuantity {
  return { value, unit };
}

function finite(value: number, field: string): number {
  if (!Number.isFinite(value)) throw new Error(`${field} must be finite`);
  return value;
}

function comparison(
  checkId: string,
  calculated: number,
  reported: number,
  tolerance: number,
  unit: string,
  formulaCheckIds: readonly string[],
): ProjectionConsistencyCheck {
  const difference = calculated - reported;
  return {
    checkId,
    calculated: quantity(calculated, unit),
    reported: quantity(reported, unit),
    difference: quantity(difference, unit),
    tolerance: quantity(tolerance, unit),
    toleranceBasis: "input resolution",
    result: Math.abs(difference) <= tolerance ? "PASS" : "FAIL",
    formulaCheckIds,
  };
}

function traceFor(calculation: CalculationCompletedResult, outputField: string) {
  const matches = calculation.traceRecords.filter((trace) => trace.outputField === outputField);
  if (matches.length !== 1) throw new Error(`required F4 trace is missing: ${outputField}`);
  return matches[0]!;
}

function formulaInputs(calculation: CalculationCompletedResult, outputField: string, unit: string) {
  const factorInput = (field: "mean" | "sigma" | "upperTolerance" | "lowerTolerance") => calculation.factors.map((factor) => ({
    name: `${factor.factorName} ${field}`,
    value: field === "upperTolerance" || field === "lowerTolerance" ? factor.input[field] : factor[field],
    unit,
    source: `${factor.source.worksheetName}:${factor.source.tableId}:${factor.source.sourceRow}:${field}`,
  }));
  switch (outputField) {
    case "system.mean":
      return [...factorInput("mean"), { name: "additionalMeanShift", value: calculation.system.additionalMeanShift, unit, source: "system.additionalMeanShift" }];
    case "system.worstCaseUpper": return factorInput("upperTolerance");
    case "system.worstCaseLower": return factorInput("lowerTolerance");
    case "system.rssSigma": return factorInput("sigma");
    case "capability.cp":
      return [
        { name: "LSL", value: calculation.capability.lowerSpecLimit, unit, source: "capability.lowerSpecLimit" },
        { name: "USL", value: calculation.capability.upperSpecLimit, unit, source: "capability.upperSpecLimit" },
        { name: "rssSigma", value: calculation.system.rssSigma, unit, source: "system.rssSigma" },
      ];
    case "capability.lowerCpk":
      return [
        { name: "mean", value: calculation.system.mean, unit, source: "system.mean" },
        { name: "LSL", value: calculation.capability.lowerSpecLimit, unit, source: "capability.lowerSpecLimit" },
        { name: "rssSigma", value: calculation.system.rssSigma, unit, source: "system.rssSigma" },
      ];
    case "capability.upperCpk":
      return [
        { name: "mean", value: calculation.system.mean, unit, source: "system.mean" },
        { name: "USL", value: calculation.capability.upperSpecLimit, unit, source: "capability.upperSpecLimit" },
        { name: "rssSigma", value: calculation.system.rssSigma, unit, source: "system.rssSigma" },
      ];
    case "capability.cpk":
      return [
        { name: "lowerCpk", value: calculation.capability.lowerCpk, unit: "ratio", source: "capability.lowerCpk" },
        { name: "upperCpk", value: calculation.capability.upperCpk, unit: "ratio", source: "capability.upperCpk" },
      ];
    default: throw new Error(`unsupported projection output: ${outputField}`);
  }
}

function outputValue(calculation: CalculationCompletedResult, outputField: string): number {
  const values: Readonly<Record<string, number>> = {
    "system.mean": calculation.system.mean,
    "system.worstCaseUpper": calculation.system.worstCaseUpper,
    "system.worstCaseLower": calculation.system.worstCaseLower,
    "system.rssSigma": calculation.system.rssSigma,
    "capability.cp": calculation.capability.cp,
    "capability.lowerCpk": calculation.capability.lowerCpk,
    "capability.upperCpk": calculation.capability.upperCpk,
    "capability.cpk": calculation.capability.cpk,
  };
  const value = values[outputField];
  if (value === undefined) throw new Error(`unsupported projection output: ${outputField}`);
  return value;
}

export function createF6ReportProjection(input: {
  readonly calculation: CalculationCompletedResult;
  readonly inputResolution: number;
}): F6ReportProjection {
  const { calculation, inputResolution } = input;
  if (!Number.isFinite(inputResolution) || inputResolution <= 0) {
    throw new Error("inputResolution must be a finite positive number");
  }
  const units = new Set(calculation.factors.map(({ unit }) => unit));
  if (units.size !== 1) throw new Error("F6 report projection requires one consistent factor unit");
  const unit = calculation.factors[0]!.unit;
  const outputFields = [
    "system.mean",
    "system.worstCaseUpper",
    "system.worstCaseLower",
    "system.rssSigma",
    "capability.cp",
    "capability.lowerCpk",
    "capability.upperCpk",
    "capability.cpk",
  ] as const;
  const formulaChecks = outputFields.map((outputField): ProjectionFormulaCheck => {
    const trace = traceFor(calculation, outputField);
    const expression = FORMULA_EXPRESSIONS[trace.formulaId];
    if (expression === undefined) throw new Error(`unsupported F4 formula: ${trace.formulaId}`);
    const resultUnit = outputField.startsWith("capability.") ? "ratio" : unit;
    return {
      outputField,
      formulaId: trace.formulaId,
      formulaVersion: trace.formulaVersion,
      expression,
      inputs: formulaInputs(calculation, outputField, unit),
      result: quantity(outputValue(calculation, outputField), resultUnit),
      sourceCells: [...trace.sourceCells],
      recomputable: true,
    };
  });

  const mean = finite(calculation.system.mean, "system.mean");
  const rssSigma = finite(calculation.system.rssSigma, "system.rssSigma");
  const sigmaLevels = [...new Set([1, 3, 4, 6, calculation.capability.targetSigmaLevel])]
    .sort((left, right) => left - right);
  const statisticalRanges = sigmaLevels.map((sigmaLevel) => ({
    sigmaLevel,
    range: { lower: mean - sigmaLevel * rssSigma, upper: mean + sigmaLevel * rssSigma, unit },
    formulaCheckId: "statistical-bound-v1",
  }));
  const selectedRange = statisticalRanges.find(({ sigmaLevel }) => sigmaLevel === calculation.capability.targetSigmaLevel)!;
  const statisticalLowerMargin = selectedRange.range.lower - calculation.capability.lowerSpecLimit;
  const statisticalUpperMargin = calculation.capability.upperSpecLimit - selectedRange.range.upper;
  const worstCaseLowerBound = mean + calculation.system.worstCaseLower;
  const worstCaseUpperBound = mean + calculation.system.worstCaseUpper;
  const worstCaseLowerMargin = worstCaseLowerBound - calculation.capability.lowerSpecLimit;
  const worstCaseUpperMargin = calculation.capability.upperSpecLimit - worstCaseUpperBound;

  const calculatedMean = calculation.factors.reduce((sum, factor) => sum + factor.mean, 0) + calculation.system.additionalMeanShift;
  const calculatedRss = Math.hypot(...calculation.factors.map(({ sigma }) => sigma));
  const calculatedWorstCaseUpper = calculation.factors.reduce((sum, factor) => sum + factor.input.upperTolerance, 0);
  const calculatedWorstCaseLower = calculation.factors.reduce((sum, factor) => sum + factor.input.lowerTolerance, 0);
  const worstCaseDifference = Math.max(
    Math.abs(calculatedWorstCaseUpper - calculation.system.worstCaseUpper),
    Math.abs(calculatedWorstCaseLower - calculation.system.worstCaseLower),
  );

  return deepFreeze({
    formulaChecks,
    statisticalRanges,
    margins: {
      statistical: {
        sigmaLevel: selectedRange.sigmaLevel,
        lowerBound: selectedRange.range.lower,
        upperBound: selectedRange.range.upper,
        lowerMargin: statisticalLowerMargin,
        upperMargin: statisticalUpperMargin,
        minimumMargin: Math.min(statisticalLowerMargin, statisticalUpperMargin),
        formulaReferences: [{ outputField: "system.rssSigma", formulaId: "statistical-margin-v1", formulaVersion: "f6-report-projection-v1" }],
      },
      worstCase: {
        lowerBound: worstCaseLowerBound,
        upperBound: worstCaseUpperBound,
        lowerMargin: worstCaseLowerMargin,
        upperMargin: worstCaseUpperMargin,
        minimumMargin: Math.min(worstCaseLowerMargin, worstCaseUpperMargin),
        formulaReferences: [{ outputField: "system.worstCaseUpper", formulaId: "worst-case-margin-v1", formulaVersion: "f6-report-projection-v1" }],
      },
    },
    selfChecks: {
      mean: comparison("mean", calculatedMean, calculation.system.mean, inputResolution, unit, ["system.mean"]),
      rss: comparison("rss", calculatedRss, calculation.system.rssSigma, inputResolution, unit, ["system.rssSigma"]),
      worstCase: comparison("worst-case", worstCaseDifference, 0, inputResolution, unit, ["system.worstCaseUpper", "system.worstCaseLower"]),
      worstCaseUpper: comparison(
        "worst-case-upper",
        calculatedWorstCaseUpper,
        calculation.system.worstCaseUpper,
        inputResolution,
        unit,
        ["system.worstCaseUpper"],
      ),
      worstCaseLower: comparison(
        "worst-case-lower",
        calculatedWorstCaseLower,
        calculation.system.worstCaseLower,
        inputResolution,
        unit,
        ["system.worstCaseLower"],
      ),
      ranges: statisticalRanges.map(({ sigmaLevel }) => comparison(`range-${sigmaLevel}`, mean + sigmaLevel * rssSigma, mean + sigmaLevel * calculation.system.rssSigma, inputResolution, unit, ["system.mean", "system.rssSigma"])),
    },
  });
}
