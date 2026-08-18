const EVIDENCE_LABELS = Object.freeze({
  INPUT_FACT: "【输入事实 Fact】",
  CALCULATED: "【计算结果 Calculated】",
  DERIVED: "【数学推导 Derived】",
  ASSUMPTION: "【工程假设 Assumption】",
  INFERENCE: "【工程推断 Inference】",
  MISSING: "【数据缺口 Missing】",
});

function validateDecimals(decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) {
    throw new Error("decimals must be an integer between 0 and 12");
  }
}

export function formatEngineering(value, unit, decimals) {
  if (!Number.isFinite(value)) throw new Error("engineering value must be finite");
  if (typeof unit !== "string" || unit.length === 0) throw new Error("engineering unit is required");
  validateDecimals(decimals);
  return `${value.toFixed(decimals)} ${unit}`;
}

export function formatPercent(value, decimals = 1) {
  if (!Number.isFinite(value)) throw new Error("percentage value must be finite");
  validateDecimals(decimals);
  return `${value.toFixed(decimals)}%`;
}

export function evidenceLabel(type) {
  const label = EVIDENCE_LABELS[type];
  if (label === undefined) throw new Error("unsupported evidence type");
  return label;
}
