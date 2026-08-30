import type { F7MeasurementStructure } from "./api/f7-client";

export type RationalSubgroupEstimator = "RANGE_D2" | "S_C4";

const D2_BY_SUBGROUP_SIZE = [
  1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.97,
  3.078, 3.173, 3.258, 3.336, 3.407, 3.472, 3.532, 3.588,
  3.64, 3.689, 3.735, 3.778, 3.819, 3.858, 3.895, 3.931,
] as const;

const C4_BY_SUBGROUP_SIZE = [
  0.7979, 0.8862, 0.9213, 0.94, 0.9515, 0.9594, 0.965, 0.9693,
  0.9727, 0.9754, 0.9776, 0.9794, 0.981, 0.9823, 0.9835, 0.9845,
  0.9854, 0.9862, 0.9869, 0.9876, 0.9882, 0.9887, 0.9892, 0.9896,
] as const;

export function rationalSubgroupConstant(
  subgroupSize: number,
  estimator: RationalSubgroupEstimator,
): number {
  if (!Number.isInteger(subgroupSize) || subgroupSize < 2 || subgroupSize > 25) {
    throw new RangeError("Subgroup size must be an integer between 2 and 25.");
  }
  return (estimator === "RANGE_D2" ? D2_BY_SUBGROUP_SIZE : C4_BY_SUBGROUP_SIZE)[subgroupSize - 2]!;
}

export function buildMeasurementRowMetadata(
  rowIndex: number,
  structure: F7MeasurementStructure,
  subgroupSize: number,
): { readonly subgroup?: string; readonly position?: number; readonly sequence?: number } {
  if (structure === "RATIONAL_SUBGROUP") {
    return {
      subgroup: String(Math.floor(rowIndex / subgroupSize) + 1),
      position: rowIndex % subgroupSize + 1,
    };
  }
  if (structure === "ORDERED_INDIVIDUALS") return { sequence: rowIndex + 1 };
  return {};
}

export function calculateRationalSubgroupStandardDeviation(
  values: readonly number[],
  subgroupSize: number,
  estimator: RationalSubgroupEstimator,
): number {
  const constant = rationalSubgroupConstant(subgroupSize, estimator);
  if (values.length === 0 || values.length % subgroupSize !== 0) {
    throw new RangeError("Rational subgroup data must contain complete subgroups.");
  }

  const dispersions: number[] = [];
  for (let index = 0; index < values.length; index += subgroupSize) {
    const subgroup = values.slice(index, index + subgroupSize);
    if (estimator === "RANGE_D2") {
      dispersions.push(Math.max(...subgroup) - Math.min(...subgroup));
      continue;
    }
    const mean = subgroup.reduce((sum, value) => sum + value, 0) / subgroup.length;
    const squaredDeviationSum = subgroup.reduce((sum, value) => sum + (value - mean) ** 2, 0);
    dispersions.push(Math.sqrt(squaredDeviationSum / (subgroup.length - 1)));
  }

  return dispersions.reduce((sum, value) => sum + value, 0) / dispersions.length / constant;
}