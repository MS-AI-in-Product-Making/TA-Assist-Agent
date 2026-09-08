const ACTUAL_FIELD_BY_SEMANTIC_FIELD = Object.freeze({
  factorName: "factorName",
  partName: "partName",
  drawingNumber: "drawingNumber",
  dimCharacteristicId: "dimCharacteristicId",
  partCategory: "partCategory",
  nominalValue: "nominalValue",
  upperTolerance: "upperTolerance",
  lowerTolerance: "lowerTolerance",
  longTermSafetyFactor: "longTermSafetyFactor",
  sigmaLevel: "standardDeviation",
  distribution: "distribution",
  mean: "mean",
  tolerance: "tolerance",
  oneSigma: "oneSigma",
  percentContributionToSigma: "percentContributionToSigma",
  notes: "notes",
});

export function projectFactorActualFields(fields) {
  return Object.fromEntries(Object.entries(ACTUAL_FIELD_BY_SEMANTIC_FIELD).map(([targetField, semanticField]) => {
    const field = fields?.[semanticField];
    return [targetField, field?.status === "available" ? field.actualValue : null];
  }));
}

export function projectFactorOrdinalEvidence(evidence) {
  return {
    value: typeof evidence?.value === "string" ? evidence.value : "",
    rawText: typeof evidence?.rawText === "string" ? evidence.rawText : "",
    ...(typeof evidence?.sourceCell === "string" ? { sourceCell: evidence.sourceCell } : {}),
  };
}
