import { cellDisplayText } from "./f1-dual-grid.mjs";

const specificationFields = ["lowerSpecLimit", "upperSpecLimit", "targetSigmaLevel", "additionalMeanShift"];

export function withSystemSpecificationDisplayValues(specification, worksheetSheet) {
  let result = specification;
  for (const fieldName of specificationFields) {
    const evidence = specification[fieldName];
    if (evidence?.status !== "available" || typeof evidence.sourceCell !== "string") continue;
    const cellReference = evidence.sourceCell.slice(evidence.sourceCell.lastIndexOf("!") + 1);
    const displayValue = cellDisplayText(worksheetSheet?.[cellReference]);
    if (!displayValue || displayValue === evidence.displayValue) continue;
    if (result === specification) result = { ...specification };
    result[fieldName] = { ...evidence, displayValue };
  }
  return result;
}