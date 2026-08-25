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
  readonly factor: {
    readonly worksheetName: string;
    readonly tableId: string;
    readonly sourceRow: number;
  };
  readonly patch: F4WhatIfPatch;
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
  };
  readonly traceReferences: readonly {
    readonly outputField: string;
    readonly formulaId: string;
    readonly formulaVersion: string;
  }[];
};

export function runF4WhatIfCalculation(request: F4WhatIfRequest): F4WhatIfResult {
  if ((request.patch.nominalValue !== undefined || request.patch.additionalMeanShift !== undefined)
    && request.signedDirectionEvidence !== true) {
    return { status: "calculation_not_possible", reasonCode: "DIRECTION_EVIDENCE_REQUIRED" };
  }

  const factorOverride = {
    ...request.factor,
    ...(request.patch.nominalValue === undefined ? {} : { nominalValue: request.patch.nominalValue }),
    ...(request.patch.upperTolerance === undefined ? {} : { upperTolerance: request.patch.upperTolerance }),
    ...(request.patch.lowerTolerance === undefined ? {} : { lowerTolerance: request.patch.lowerTolerance }),
  };
  const hasFactorOverride = request.patch.nominalValue !== undefined
    || request.patch.upperTolerance !== undefined
    || request.patch.lowerTolerance !== undefined;
  const calculation = calculateF6Scenario({
    baselineRequest: request.baselineRequest,
    scenario: {
      scenarioId: `what-if:${request.draftId}`,
      optionKind: "improve_supplier_capability",
      factorOverrides: hasFactorOverride ? [factorOverride] : [],
      ...(request.patch.additionalMeanShift === undefined
        ? {}
        : { systemSpecification: { additionalMeanShift: request.patch.additionalMeanShift } }),
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
    },
    traceReferences: scenario.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
  };
}
