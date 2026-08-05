const FACTOR_COLUMNS = Object.freeze({
  factorName: "E",
  partName: "F",
  drawingNumber: "G",
  dimCharacteristicId: "H",
  partCategory: "I",
  nominalValue: "J",
  upperTolerance: "K",
  lowerTolerance: "L",
  longTermSafetyFactor: "M",
  sigmaLevel: "N",
  distribution: "O",
  mean: "P",
  tolerance: "Q",
  oneSigma: "R",
  percentContributionToSigma: "S",
  notes: "T",
});

function actualValue(cell) {
  if (!cell || cell.t === "e" || cell.v === undefined || cell.v === null) return null;
  if (typeof cell.v === "number") {
    return Number.isFinite(cell.v) ? Number(cell.v.toPrecision(15)) : null;
  }
  const value = String(cell.v).trim();
  return value.length === 0 ? null : value;
}

export function extractFactorActualFields(worksheet, sourceRow) {
  return Object.fromEntries(Object.entries(FACTOR_COLUMNS).map(
    ([fieldName, sourceColumn]) => [fieldName, actualValue(worksheet?.[`${sourceColumn}${sourceRow}`])],
  ));
}
