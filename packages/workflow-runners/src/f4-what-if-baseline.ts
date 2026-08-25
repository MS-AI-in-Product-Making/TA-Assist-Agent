import { isDeepStrictEqual } from "node:util";

import {
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  type CalculationRequest,
} from "@ai-assist/contracts";
import {
  createCalculation,
  createCalculationRequestFromF4Handoff,
} from "@ai-assist/workbook-catalog";

export function createF4WhatIfBaselineRequest(input: {
  readonly f2Report: unknown;
  readonly f4Result: unknown;
  readonly worksheetName: string;
}): CalculationRequest {
  const f2 = f2UserReportSchema.parse(input.f2Report);
  const f4 = f4WorkflowCalculationResultSchema.parse(input.f4Result);
  const handoffs = f2.status === "completed"
    ? f2.f4Handoffs.filter((handoff) => handoff.worksheetName === input.worksheetName)
    : [];
  const calculations = f4.calculations
    .map((calculation, index) => ({ calculation, index }))
    .filter(({ calculation }) => calculation.worksheetSelection.worksheetName === input.worksheetName);
  if (handoffs.length !== 1 || calculations.length !== 1) {
    throw new Error("What-if baseline requires one matching F2 handoff and F4 calculation.");
  }
  const handoff = handoffs[0]!;
  const { calculation, index } = calculations[0]!;
  const expectedProjectReference = `f4-${f4.source.workbookContentHash.slice(0, 16)}`;
  const expectedRunReference = `${f4.runId}-${index}`;
  if (handoff.workbookContentHash !== f4.source.workbookContentHash
    || calculation.projectReference !== expectedProjectReference
    || calculation.runReference !== expectedRunReference
    || calculation.recommendation.criticality !== "none") {
    throw new Error("What-if baseline identity does not match governed F2/F4 lineage.");
  }
  const request = createCalculationRequestFromF4Handoff({
    handoff,
    projectReference: expectedProjectReference,
    runReference: expectedRunReference,
    criticality: "none",
  });
  if (!isDeepStrictEqual(createCalculation(request), calculation)) {
    throw new Error("What-if baseline does not replay to the governed F4 calculation.");
  }
  return request;
}
