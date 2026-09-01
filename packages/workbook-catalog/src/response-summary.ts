import type { OoxmlCell } from "./ooxml-reader.js";

const CELL_REFERENCE = /^([A-Z]+)([1-9]\d*)$/;
const RESPONSE_SUMMARY_ANCHORS = new Set(["response summary", "response summary table"]);
const LABELS = {
  designNominal: new Set(["design nominal"]),
  lowerSpecLimit: new Set(["lower spec limit", "lsl"]),
  upperSpecLimit: new Set(["upper spec limit", "usl"]),
  targetSigmaLevel: new Set(["target σ level", "target sigma level"]),
  additionalMeanShift: new Set(["additional mean shift"]),
  volume: new Set(["volume"]),
} as const;

type EvidenceNumber =
  | { readonly status: "available"; readonly actualValue: number; readonly displayValue: string; readonly sourceLabel: string; readonly sourceCell?: string; readonly valueOrigin: "numeric_literal" | "formula_cached" | "defaulted" }
  | { readonly status: "unavailable"; readonly reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid"; readonly sourceCell?: string };

export type WorksheetSystemSpecification =
  | { readonly status: "available"; readonly designNominal: EvidenceNumber; readonly lowerSpecLimit: EvidenceNumber; readonly upperSpecLimit: EvidenceNumber; readonly targetSigmaLevel: EvidenceNumber; readonly additionalMeanShift: EvidenceNumber; readonly volume?: EvidenceNumber }
  | { readonly status: "unavailable"; readonly reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "system_specification_range_invalid"; readonly designNominal?: EvidenceNumber; readonly lowerSpecLimit?: EvidenceNumber; readonly upperSpecLimit?: EvidenceNumber; readonly targetSigmaLevel?: EvidenceNumber; readonly additionalMeanShift?: EvidenceNumber; readonly volume?: EvidenceNumber };

function normalize(value: string): string {
  return value.replace(/[▼►*:]/g, " ").trim().replace(/\s+/g, " ").toLowerCase();
}

function location(reference: string): { readonly column: number; readonly row: number } | undefined {
  const match = CELL_REFERENCE.exec(reference);
  if (!match) return undefined;
  let column = 0;
  for (const character of match[1]!) column = column * 26 + character.charCodeAt(0) - 64;
  return { column, row: Number(match[2]) };
}

function evidence(worksheetName: string, labelCells: readonly OoxmlCell[], rowCells: readonly OoxmlCell[]): EvidenceNumber {
  if (labelCells.length === 0) return { status: "unavailable", reasonCode: "response_summary_label_missing" };
  if (labelCells.length !== 1) return { status: "unavailable", reasonCode: "response_summary_label_ambiguous" };
  const label = labelCells[0]!;
  const labelLocation = location(label.reference)!;
  const valueCell = rowCells
    .filter((cell) => location(cell.reference)!.row === labelLocation.row && location(cell.reference)!.column > labelLocation.column)
    .filter((cell) => String(cell.cachedValue ?? cell.value ?? "").trim().length > 0)
    .sort((left, right) => location(left.reference)!.column - location(right.reference)!.column)[0];
  if (!valueCell) return { status: "unavailable", reasonCode: "response_summary_value_missing" };
  const displayValue = String(valueCell.cachedValue ?? valueCell.value).trim();
  const actualValue = Number(displayValue.replace(/σ$/i, "").trim());
  const sourceCell = `${worksheetName}!${valueCell.reference}`;
  if (!Number.isFinite(actualValue)) return { status: "unavailable", reasonCode: "response_summary_value_invalid", sourceCell };
  return { status: "available", actualValue, displayValue, sourceLabel: label.value, sourceCell, valueOrigin: valueCell.formula ? "formula_cached" : "numeric_literal" };
}

export function extractResponseSummarySystemSpecification(worksheetName: string, cells: readonly OoxmlCell[]): WorksheetSystemSpecification {
  const located = cells.filter((cell) => location(cell.reference) !== undefined);
  const anchors = located.filter((cell) => RESPONSE_SUMMARY_ANCHORS.has(normalize(cell.value)));
  if (anchors.length === 0) return { status: "unavailable", reasonCode: "response_summary_label_missing" };
  if (anchors.length !== 1) return { status: "unavailable", reasonCode: "response_summary_label_ambiguous" };
  const anchorRow = location(anchors[0]!.reference)!.row;
  const suggestedRows = located.filter((cell) => location(cell.reference)!.row > anchorRow && normalize(cell.value) === "suggested spec").map((cell) => location(cell.reference)!.row);
  const endRow = suggestedRows.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...suggestedRows);
  const sectionCells = located.filter((cell) => {
    const row = location(cell.reference)!.row;
    return row > anchorRow && row < endRow;
  });
  const labels = (key: keyof typeof LABELS) => sectionCells.filter((cell) => LABELS[key].has(normalize(cell.value)));
  const designNominal = evidence(worksheetName, labels("designNominal"), sectionCells);
  const lowerSpecLimit = evidence(worksheetName, labels("lowerSpecLimit"), sectionCells);
  const upperSpecLimit = evidence(worksheetName, labels("upperSpecLimit"), sectionCells);
  const targetSigmaLevel = evidence(worksheetName, labels("targetSigmaLevel"), sectionCells);
  const volumeLabels = labels("volume");
  const volume = volumeLabels.length === 0 ? undefined : evidence(worksheetName, volumeLabels, sectionCells);

  const meanShiftLabels = located.filter((cell) => location(cell.reference)!.row < anchorRow && LABELS.additionalMeanShift.has(normalize(cell.value)));
  const additionalMeanShift = meanShiftLabels.length === 0
    ? { status: "available" as const, actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" as const }
    : evidence(worksheetName, meanShiftLabels, located);
  const values = { designNominal, lowerSpecLimit, upperSpecLimit, targetSigmaLevel, additionalMeanShift, ...(volume ? { volume } : {}) };
  if (lowerSpecLimit.status === "available" && upperSpecLimit.status === "available" && lowerSpecLimit.actualValue >= upperSpecLimit.actualValue) {
    return { status: "unavailable", reasonCode: "system_specification_range_invalid", ...values };
  }
  if ([designNominal, lowerSpecLimit, upperSpecLimit, targetSigmaLevel, additionalMeanShift].some((value) => value.status === "unavailable")) {
    return { status: "unavailable", reasonCode: "system_specification_range_invalid", ...values };
  }
  return { status: "available", ...values };
}