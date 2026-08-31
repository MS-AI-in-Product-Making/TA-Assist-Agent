import type { CalculationRequest } from "@ai-assist/contracts";
import { calculateF6Scenario } from "@ai-assist/workbook-catalog";

export interface F4WhatIfPatch {
  readonly nominalValue?: number;
  readonly upperTolerance?: number;
  readonly lowerTolerance?: number;
  readonly additionalMeanShift?: number;
}

export interface F4WhatIfRequest {
  readonly draftId: string;
  readonly baselineRequest: CalculationRequest;
  readonly factor?: {
    readonly worksheetName: string;
    readonly tableId: string;
    readonly sourceRow: number;
  };
  readonly patch?: F4WhatIfPatch;
  readonly factorOverrides?: readonly ({ readonly worksheetName: string; readonly tableId: string; readonly sourceRow: number } & Omit<F4WhatIfPatch, "additionalMeanShift">)[];
  readonly systemSpecification?: { readonly lowerSpecLimit?: number; readonly upperSpecLimit?: number; readonly additionalMeanShift?: number };
  readonly signedDirectionEvidence?: true;
}

export type F4WhatIfResult = {
  readonly status: "calculation_not_possible";
  readonly reasonCode: "DIRECTION_EVIDENCE_REQUIRED";
} | {
  readonly status: "completed";
  readonly calculationReference: string;
  readonly metrics: {
    readonly mean: number;
    readonly rssSigma: number;
    readonly cp: number;
    readonly cpkL: number;
    readonly cpkU: number;
    readonly cpk: number;
    readonly statisticalMargin: number;
    readonly worstCaseMargin: number;
    readonly lowerSpecLimit: number;
    readonly upperSpecLimit: number;
    readonly meanShift: number;
    readonly yield: number;
    readonly dpm: number;
    readonly statisticalLower: number;
    readonly statisticalUpper: number;
    readonly worstCaseLower: number;
    readonly worstCaseUpper: number;
  };
  readonly factors: readonly { readonly worksheetName: string; readonly tableId: string; readonly sourceRow: number; readonly mean: number; readonly tolerance: number; readonly oneSigma: number; readonly contribution: number }[];
  readonly traceReferences: readonly {
    readonly outputField: string;
    readonly formulaId: string;
    readonly formulaVersion: string;
  }[];
};

export function runF4WhatIfCalculation(request: F4WhatIfRequest): F4WhatIfResult {
  const legacyOverride = request.factor === undefined || request.patch === undefined ? [] : [{
    ...request.factor,
    ...(request.patch.nominalValue === undefined ? {} : { nominalValue: request.patch.nominalValue }),
    ...(request.patch.upperTolerance === undefined ? {} : { upperTolerance: request.patch.upperTolerance }),
    ...(request.patch.lowerTolerance === undefined ? {} : { lowerTolerance: request.patch.lowerTolerance }),
  }];
  const factorOverrides = request.factorOverrides ?? legacyOverride;
  if (factorOverrides.some((override) => override.nominalValue !== undefined)
    && request.signedDirectionEvidence !== true) {
    return { status: "calculation_not_possible", reasonCode: "DIRECTION_EVIDENCE_REQUIRED" };
  }

  const legacyMeanShift = request.patch?.additionalMeanShift;
  const systemSpecification = { ...request.systemSpecification, ...(legacyMeanShift === undefined ? {} : { additionalMeanShift: legacyMeanShift }) };
  const calculation = calculateF6Scenario({
    baselineRequest: request.baselineRequest,
    scenario: {
      scenarioId: `what-if:${request.draftId}`,
      optionKind: "improve_supplier_capability",
      factorOverrides: [...factorOverrides],
      ...(Object.keys(systemSpecification).length === 0 ? {} : { systemSpecification }),
    },
  });
  const scenario = calculation.scenarios.at(-1)?.calculation;
  if (scenario === undefined) {
    throw new Error("Governed F4 scenario result is missing.");
  }
  const statisticalLowerMargin = scenario.system.mean - scenario.capability.lowerSpecLimit;
  const statisticalUpperMargin = scenario.capability.upperSpecLimit - scenario.system.mean;
  const worstCaseLowerMargin = scenario.system.worstCaseLower - scenario.capability.lowerSpecLimit;
  const worstCaseUpperMargin = scenario.capability.upperSpecLimit - scenario.system.worstCaseUpper;
  return {
    status: "completed",
    calculationReference: `what-if:${request.draftId}`,
    metrics: {
      mean: scenario.system.mean,
      rssSigma: scenario.system.rssSigma,
      cp: scenario.capability.cp,
      cpkL: scenario.capability.lowerCpk,
      cpkU: scenario.capability.upperCpk,
      cpk: scenario.capability.cpk,
      statisticalMargin: Math.min(statisticalLowerMargin, statisticalUpperMargin),
      worstCaseMargin: Math.min(worstCaseLowerMargin, worstCaseUpperMargin),
      lowerSpecLimit: scenario.capability.lowerSpecLimit,
      upperSpecLimit: scenario.capability.upperSpecLimit,
      meanShift: scenario.system.additionalMeanShift,
      yield: scenario.capability.yield,
      dpm: scenario.capability.totalDpm,
      statisticalLower: scenario.system.mean - scenario.system.rssSigma * scenario.capability.targetSigmaLevel,
      statisticalUpper: scenario.system.mean + scenario.system.rssSigma * scenario.capability.targetSigmaLevel,
      worstCaseLower: scenario.system.worstCaseLower,
      worstCaseUpper: scenario.system.worstCaseUpper,
    },
    factors: scenario.factors.map((factor) => ({ worksheetName: factor.source.worksheetName, tableId: factor.source.tableId, sourceRow: factor.source.sourceRow, mean: factor.mean, tolerance: factor.halfTolerance, oneSigma: factor.sigma, contribution: factor.contribution })),
    traceReferences: scenario.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
  };
}
