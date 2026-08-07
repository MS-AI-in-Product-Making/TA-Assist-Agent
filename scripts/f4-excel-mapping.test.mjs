import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { TextEncoder } from "node:util";
import { buildF4ExcelMapping } from "./f4-excel-mapping.mjs";
import { MAX_ARCHIVE_BYTES } from "../packages/workbook-catalog/dist/zip-security.js";

const FIXED_TRACE_FORMULA_IDS = {
  "system.mean": "system-mean-v1",
  "system.worstCaseUpper": "worst-case-v1",
  "system.worstCaseLower": "worst-case-v1",
  "system.rssSigma": "rss-v1",
  "capability.cp": "cp-v1",
  "capability.lowerCpk": "cpk-lower-v1",
  "capability.upperCpk": "cpk-upper-v1",
  "capability.cpk": "cpk-v1",
  "capability.lowerZ": "z-lower-v1",
  "capability.upperZ": "z-upper-v1",
  "capability.lowerDpm": "dpm-lower-v1",
  "capability.upperDpm": "dpm-upper-v1",
  "capability.totalDpm": "dpm-total-v1",
  "capability.outOfSpecRatio": "dpm-total-v1",
  "capability.yield": "yield-v1",
  "capability.status": "status-v1",
};

function createCalculation({ worksheetName = "Analysis-A", factorRows = [14, 15, 16, 17, 18, 19, 20] } = {}) {
  const factors = factorRows.map((sourceRow, index) => ({
    factorName: `Factor-${index + 1}`,
    unit: "mm",
    source: {
      worksheetName,
      tableId: "table-1",
      sourceRow,
    },
    input: {
      nominalValue: 10 + index,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      distribution: "normal",
    },
    mean: 10.01 + index,
    halfTolerance: 0.1,
    sigma: 0.025,
    contribution: Number((1 / factorRows.length).toFixed(6)),
    trace: {
      formulaIds: ["factor-mean-v1", "factor-half-tolerance-v1", "factor-sigma-v1", "contribution-v1"],
      sourceCells: [`${worksheetName}!E${sourceRow}`],
    },
  }));

  const traceRecords = Object.entries(FIXED_TRACE_FORMULA_IDS).map(([outputField, formulaId]) => ({
    outputField,
    formulaVersion: "excel-ta-v1",
    formulaId,
    sourceCells: ["x"],
  }));

  const recommendation = factorRows.length <= 3
    ? {
      method: "worst_case",
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    }
    : {
      method: "rss_1d",
      reason: "factor_count_4_to_10",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    };

  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "proj-1",
    runReference: "run-1",
    workbookContentHash: "a".repeat(64),
    worksheetSelection: {
      worksheetName,
      tableId: "table-1",
    },
    factorCount: factors.length,
    recommendation,
    factors,
    system: {
      designNominal: 10,
      mean: 10.02,
      additionalMeanShift: 0.01,
      worstCaseUpper: 0.2,
      worstCaseLower: -0.2,
      rssSigma: 0.033,
    },
    capability: {
      lowerSpecLimit: 9.8,
      upperSpecLimit: 10.2,
      targetSigmaLevel: 4,
      targetCpk: 1,
      cp: 2.02,
      lowerCpk: 1.51,
      upperCpk: 1.87,
      cpk: 1.51,
      lowerZ: 4.53,
      upperZ: 5.61,
      lowerDpm: 2.1,
      upperDpm: 0.9,
      totalDpm: 3,
      outOfSpecRatio: 0.000003,
      yield: 0.999997,
      status: "PASS",
    },
    traceRecords,
    scenarios: [],
  };
}

function makeWorkbookBytes({
  worksheetName = "Analysis-A",
  factorRows = [14, 15, 16, 17, 18, 19, 20],
  shiftRow = 0,
  shiftColumn = 0,
  includeFormulaForDesignNominal = true,
  includeFormulaForAdjustedMean = true,
  includeResponseSummaryAnchor = true,
  addSecondFactorHeaderCluster = false,
  includeStatusFormula = true,
  includeStatusCell = true,
  duplicatePreBoundaryCpLabel = false,
  duplicatePreAnchorDesignNominalLabel = false,
  addPostAnchorDuplicateSystemLabels = false,
  addStealFormulaNearAdjustedMean = false,
  makeYieldAdjacentAmbiguous = false,
  hugeRef = false,
} = {}) {
  const ws = XLSX.utils.aoa_to_sheet([[]]);

  const col = (index) => XLSX.utils.encode_col(index + shiftColumn);
  const row = (index) => index + shiftRow;
  const ref = (c, r) => `${col(c)}${row(r)}`;
  const setText = (c, r, value) => {
    ws[ref(c, r)] = { t: "s", v: value };
  };
  const setNumber = (c, r, value, formula) => {
    const cell = { t: "n", v: value };
    if (formula) cell.f = formula;
    ws[ref(c, r)] = cell;
  };
  const setFormulaText = (c, r, value, formula) => {
    ws[ref(c, r)] = { t: "s", v: value, f: formula };
  };

  setText(17, 13, "Mean");
  setText(18, 13, "Tolerance");
  setText(19, 13, "One Sigma");
  setText(20, 13, "% Contribution to Sigma");

  for (const [index, sourceRow] of factorRows.entries()) {
    const r = row(sourceRow);
    ws[`${col(17)}${r}`] = { t: "n", v: 10.01 + index, f: `=A${r}+0.01` };
    ws[`${col(18)}${r}`] = { t: "n", v: 0.1, f: `=ABS(B${r})` };
    ws[`${col(19)}${r}`] = { t: "n", v: 0.025, f: `=C${r}/4` };
    ws[`${col(20)}${r}`] = { t: "n", v: Number((1 / factorRows.length).toFixed(6)), f: `=D${r}/SUM(D:D)` };
  }

  if (addSecondFactorHeaderCluster) {
    setText(1, 30, "Mean");
    setText(2, 30, "Tolerance");
    setText(3, 30, "One Sigma");
    setText(4, 30, "% Contribution to Sigma");
    for (const sourceRow of factorRows) {
      setNumber(1, sourceRow, 99, "=1+1");
      setNumber(2, sourceRow, 99, "=1+1");
      setNumber(3, sourceRow, 99, "=1+1");
      setNumber(4, sourceRow, 99, "=1+1");
    }
  }

  setText(10, 44, "Design Nominal");
  setNumber(11, 44, 10, includeFormulaForDesignNominal ? "=AVERAGE(B1:B2)" : undefined);
  setNumber(12, 44, 0.2, "=SUM(S14:S20)");
  setNumber(13, 44, -0.2, "=-SUM(S14:S20)");
  setNumber(19, 44, 0.033, "=SQRT(SUMSQ(T14:T20))");

  setText(16, 45, "Additional Mean Shift");
  setNumber(17, 45, 0.01);

  setText(16, 46, "Adjusted Mean");
  if (addStealFormulaNearAdjustedMean) {
    setText(17, 46, "");
    setNumber(18, 46, 10.02, "=SUM(R14:R20)+R45");
  } else {
    setNumber(17, 46, 10.02, includeFormulaForAdjustedMean ? "=SUM(R14:R20)+R45" : undefined);
  }

  if (duplicatePreAnchorDesignNominalLabel) {
    setText(14, 43, "Design Nominal");
    setNumber(15, 43, 9.99, "=AVERAGE(B1:B2)");
  }

  if (includeResponseSummaryAnchor) {
    setText(10, 48, "Response Summary Table");
  }

  if (addPostAnchorDuplicateSystemLabels) {
    setText(14, 52, "Adjusted Mean");
    setNumber(15, 52, 10.2, "=1+1");
    setText(14, 53, "Design Nominal");
    setNumber(15, 53, 9.8, "=1+1");
  }

  setText(18, 50, "Lower Z (Sigma Level):");
  setNumber(19, 50, 4.53, "=T57*3");

  setText(18, 51, "Upper Z (Sigma Level):");
  setNumber(19, 51, 5.61, "=T56*3");

  setText(22, 50, "DPM, Lower:");
  setNumber(23, 50, 2.1, "=NORM.S.DIST(-T50,TRUE)*1000000");

  setText(22, 51, "DPM, Upper:");
  setNumber(23, 51, 0.9, "=NORM.S.DIST(-T51,TRUE)*1000000");

  setText(22, 52, "Total DPM:");
  setNumber(23, 52, 3, "=X50+X51");

  setText(22, 53, "% Out of Spec:");
  setNumber(23, 53, 0.000003, "=X52/1000000");

  setText(18, 54, "Cp:");
  setNumber(19, 54, 2.02, "=(USL-LSL)/(6*T44)");

  setText(22, 54, "Yield:");
  setNumber(23, 54, 0.999997, "=1-X52/1000000");
  if (makeYieldAdjacentAmbiguous) {
    setNumber(22, 55, 0.999998, "=1-X52/900000");
  }

  setText(18, 55, "Lower Cpk:");
  setNumber(19, 55, 1.51, "=(R46-LSL)/(3*T44)");

  setText(18, 56, "Upper Cpk:");
  setNumber(19, 56, 1.87, "=(USL-R46)/(3*T44)");

  setText(18, 57, "Cpk:");
  setNumber(19, 57, 1.51, "=MIN(T55,T56)");

  if (includeStatusCell) {
    setText(20, 57, "Status");
    if (includeStatusFormula) {
      setFormulaText(20, 57, "PASS", "=IF(T57>=1,\"PASS\",\"FAIL\")");
    } else {
      setText(20, 57, "PASS");
    }
  }

  if (duplicatePreBoundaryCpLabel) {
    setText(18, 58, "Cp:");
    setNumber(19, 58, 9.9, "=1+1");
  }

  setText(10, 20, "Suggested Spec");
  setText(10, 59, "Suggested Spec");
  setText(10, 80, "Suggested Spec");

  if (hugeRef) {
    ws["!ref"] = "A1:ZZ6000";
  } else {
    ws["!ref"] = `A1:${col(30)}${Math.max(120, row(60))}`;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, worksheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: false });
}

function outputByName(mapping) {
  return new Map(mapping.outputs.map((item) => [item.name, item]));
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function forgeCalculation(calculation, mutate) {
  const cloned = cloneValue(calculation);
  mutate(cloned);
  return cloned;
}

describe("buildF4ExcelMapping", () => {
  it("maps sample-like 7-factor semantic targets and capability.status", () => {
    const factorRows = [14, 15, 16, 17, 18, 19, 20];
    const calculation = createCalculation({ worksheetName: "Analysis-A", factorRows });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", factorRows });

    const mapping = buildF4ExcelMapping({ workbookBytes, calculation });

    expect(mapping.version).toBe("excel-ta-v1");
    expect(mapping.inputs).toEqual([]);

    const metrics = outputByName(mapping);

    expect(metrics.get("factors[0].mean")).toMatchObject({ cell: "R14", expected: 10.01, tolerance: 1e-12, formulaId: "factor-mean-v1" });
    expect(metrics.get("factors[6].contribution")).toMatchObject({ cell: "U20", tolerance: 1e-12, formulaId: "contribution-v1" });

    expect(metrics.get("system.designNominal")).toMatchObject({ cell: "L44", expected: 10, tolerance: 1e-12, formulaId: "input-design-nominal-v1" });
    expect(metrics.get("system.additionalMeanShift")).toMatchObject({ cell: "R45", expected: 0.01, tolerance: 1e-12, formulaId: "input-additional-mean-shift-v1" });
    expect(metrics.get("system.mean")).toMatchObject({ cell: "R46", expected: 10.02, tolerance: 1e-12, formulaId: "system-mean-v1" });
    expect(metrics.get("system.worstCaseUpper")).toMatchObject({ cell: "M44", expected: 0.2, tolerance: 1e-12, formulaId: "worst-case-v1" });
    expect(metrics.get("system.worstCaseLower")).toMatchObject({ cell: "N44", expected: -0.2, tolerance: 1e-12, formulaId: "worst-case-v1" });
    expect(metrics.get("system.rssSigma")).toMatchObject({ cell: "T44", expected: 0.033, tolerance: 1e-12, formulaId: "rss-v1" });

    expect(metrics.get("capability.lowerZ")).toMatchObject({ cell: "T50", expected: 4.53, tolerance: 1e-12, formulaId: "z-lower-v1" });
    expect(metrics.get("capability.upperZ")).toMatchObject({ cell: "T51", expected: 5.61, tolerance: 1e-12, formulaId: "z-upper-v1" });
    expect(metrics.get("capability.lowerDpm")).toMatchObject({ cell: "X50", expected: 2.1, tolerance: 1e-12, formulaId: "dpm-lower-v1" });
    expect(metrics.get("capability.upperDpm")).toMatchObject({ cell: "X51", expected: 0.9, tolerance: 1e-12, formulaId: "dpm-upper-v1" });
    expect(metrics.get("capability.totalDpm")).toMatchObject({ cell: "X52", expected: 3, tolerance: 1e-12, formulaId: "dpm-total-v1" });
    expect(metrics.get("capability.outOfSpecRatio")).toMatchObject({ cell: "X53", expected: 0.000003, tolerance: 1e-12, formulaId: "dpm-total-v1" });
    expect(metrics.get("capability.cp")).toMatchObject({ cell: "T54", expected: 2.02, tolerance: 1e-12, formulaId: "cp-v1" });
    expect(metrics.get("capability.yield")).toMatchObject({ cell: "X54", expected: 0.999997, tolerance: 1e-12, formulaId: "yield-v1" });
    expect(metrics.get("capability.lowerCpk")).toMatchObject({ cell: "T55", expected: 1.51, tolerance: 1e-12, formulaId: "cpk-lower-v1" });
    expect(metrics.get("capability.upperCpk")).toMatchObject({ cell: "T56", expected: 1.87, tolerance: 1e-12, formulaId: "cpk-upper-v1" });
    expect(metrics.get("capability.cpk")).toMatchObject({ cell: "T57", expected: 1.51, tolerance: 1e-12, formulaId: "cpk-v1" });
    expect(metrics.get("capability.status")).toMatchObject({ cell: "U57", expected: "PASS", tolerance: 1e-12, formulaId: "status-v1" });
  });

  it("ignores post-anchor duplicate Design Nominal and Adjusted Mean labels in real-template positions", () => {
    const factorRows = [14, 15, 16, 17, 18, 19, 20];
    const calculation = createCalculation({ worksheetName: "Analysis-A", factorRows });
    const workbookBytes = makeWorkbookBytes({
      worksheetName: "Analysis-A",
      factorRows,
      addPostAnchorDuplicateSystemLabels: true,
    });

    const mapping = buildF4ExcelMapping({ workbookBytes, calculation });
    const metrics = outputByName(mapping);

    expect(metrics.get("system.designNominal")).toMatchObject({ cell: "L44" });
    expect(metrics.get("system.mean")).toMatchObject({ cell: "R46" });
    expect(metrics.get("system.worstCaseUpper")).toMatchObject({ cell: "M44" });
    expect(metrics.get("system.worstCaseLower")).toMatchObject({ cell: "N44" });
    expect(metrics.get("system.rssSigma")).toMatchObject({ cell: "T44" });
    expect(metrics.get("capability.cpk")).toMatchObject({ cell: "T57" });
  });

  it("supports moved rows/columns and ignores extra Suggested Spec labels after boundary", () => {
    const calculation = createCalculation({ worksheetName: "Shifted", factorRows: [33, 38] });
    const workbookBytes = makeWorkbookBytes({
      worksheetName: "Shifted",
      factorRows: [26, 31],
      shiftRow: 7,
      shiftColumn: 3,
    });

    const mapping = buildF4ExcelMapping({ workbookBytes, calculation });
    const metrics = outputByName(mapping);

    expect(metrics.get("factors[0].mean").cell).toBe("U33");
    expect(metrics.get("system.mean").cell).toBe("U53");
    expect(metrics.get("capability.cpk").cell).toBe("W64");
    expect(metrics.get("capability.status").cell).toBe("X64");
  });

  it("rejects unknown worksheet selections", () => {
    const calculation = createCalculation({ worksheetName: "MissingSheet" });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "ActualSheet" });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects ambiguous factor header clusters", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", addSecondFactorHeaderCluster: true });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects missing or invalid formula requirements inside controlled cells", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });

    const missingAdjustedFormula = makeWorkbookBytes({ worksheetName: "Analysis-A", includeFormulaForAdjustedMean: false });
    expect(() => buildF4ExcelMapping({ workbookBytes: missingAdjustedFormula, calculation })).toThrow("F4 excel mapping failed.");

    const missingDesignFormula = makeWorkbookBytes({ worksheetName: "Analysis-A", includeFormulaForDesignNominal: false });
    expect(() => buildF4ExcelMapping({ workbookBytes: missingDesignFormula, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects response summary labels that do not have exact adjacent value cells", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", addStealFormulaNearAdjustedMean: true });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects ambiguous adjacent target candidates", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", makeYieldAdjacentAmbiguous: true });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects duplicate controlled labels before first Suggested Spec boundary", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", duplicatePreBoundaryCpLabel: true });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects duplicate pre-anchor Design Nominal labels", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", duplicatePreAnchorDesignNominalLabel: true });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects missing response summary anchor", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", includeResponseSummaryAnchor: false });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects huge worksheet !ref ranges and avoids sparse key overrun", { timeout: 15_000 }, () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", hugeRef: true });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects workbook bytes larger than MAX_ARCHIVE_BYTES", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const tooLarge = new Uint8Array(MAX_ARCHIVE_BYTES + 1);

    expect(() => buildF4ExcelMapping({ workbookBytes: tooLarge, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects invalid zip bytes before SheetJS parsing", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const invalidZip = new TextEncoder().encode("not-a-zip-archive");

    expect(() => buildF4ExcelMapping({ workbookBytes: invalidZip, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects missing, duplicate, and wrong trace formula records", () => {
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A" });
    const base = createCalculation({ worksheetName: "Analysis-A" });

    const missing = forgeCalculation(base, (calculation) => {
      calculation.traceRecords = calculation.traceRecords.filter((record) => record.outputField !== "capability.status");
    });
    expect(() => buildF4ExcelMapping({ workbookBytes, calculation: missing })).toThrow("F4 excel mapping failed.");

    const duplicate = forgeCalculation(base, (calculation) => {
      const target = calculation.traceRecords.find((record) => record.outputField === "capability.cp");
      calculation.traceRecords.push(cloneValue(target));
    });
    expect(() => buildF4ExcelMapping({ workbookBytes, calculation: duplicate })).toThrow("F4 excel mapping failed.");

    const wrong = forgeCalculation(base, (calculation) => {
      const target = calculation.traceRecords.find((record) => record.outputField === "capability.cpk");
      target.formulaId = "wrong-formula-id";
    });
    expect(() => buildF4ExcelMapping({ workbookBytes, calculation: wrong })).toThrow("F4 excel mapping failed.");
  });

  it("rejects missing status cell and status cell without formula", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });

    const missingStatus = makeWorkbookBytes({ worksheetName: "Analysis-A", includeStatusCell: false });
    expect(() => buildF4ExcelMapping({ workbookBytes: missingStatus, calculation })).toThrow("F4 excel mapping failed.");

    const nonFormulaStatus = makeWorkbookBytes({ worksheetName: "Analysis-A", includeStatusFormula: false });
    expect(() => buildF4ExcelMapping({ workbookBytes: nonFormulaStatus, calculation })).toThrow("F4 excel mapping failed.");
  });
});
