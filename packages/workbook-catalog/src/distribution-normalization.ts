import type { Distribution } from "@ai-assist/contracts";

const DISTRIBUTION_ALIASES = new Map<string, Distribution>([
  ["normal", "normal"], ["gaussian", "normal"], ["正态分布", "normal"],
  ["uniform", "uniform"], ["均匀分布", "uniform"],
  ["triangular", "triangular"], ["三角分布", "triangular"],
  ["trapezoidal", "trapezoidal"], ["梯形分布", "trapezoidal"],
  ["elliptical", "elliptical"], ["椭圆分布", "elliptical"],
  ["beta", "beta"], ["贝塔分布", "beta"],
]);

export function normalizeDistribution(value: string | undefined): Distribution | undefined {
  return value === undefined ? undefined : DISTRIBUTION_ALIASES.get(value.trim().toLowerCase());
}