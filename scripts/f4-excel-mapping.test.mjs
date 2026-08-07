import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { buildF4ExcelMapping } from "./f4-excel-mapping.mjs";

function createCalculation({ worksheetName = "Analysis-A", factorRows = [14, 20] } = {}) {
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
    contribution: index === 0 ? 0.6 : 0.4,
    trace: {
      formulaIds: ["factor-mean-v1", "factor-half-tolerance-v1", "factor-sigma-v1", "contribution-v1"],
      sourceCells: [`${worksheetName}!E${sourceRow}`],
    },
  }));

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
    recommendation: {
      method: "worst_case",
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    },
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
    traceRecords: [
      { outputField: "system.mean", formulaVersion: "excel-ta-v1", formulaId: "system-mean-v1", sourceCells: ["factors[0].mean", "factors[1].mean", "request:systemSpecification.additionalMeanShift"] },
      { outputField: "system.worstCaseUpper", formulaVersion: "excel-ta-v1", formulaId: "worst-case-v1", sourceCells: ["x"] },
      { outputField: "system.worstCaseLower", formulaVersion: "excel-ta-v1", formulaId: "worst-case-v1", sourceCells: ["x"] },
      { outputField: "system.rssSigma", formulaVersion: "excel-ta-v1", formulaId: "rss-v1", sourceCells: ["x"] },
      { outputField: "capability.lowerZ", formulaVersion: "excel-ta-v1", formulaId: "z-lower-v1", sourceCells: ["x"] },
      { outputField: "capability.upperZ", formulaVersion: "excel-ta-v1", formulaId: "z-upper-v1", sourceCells: ["x"] },
      { outputField: "capability.lowerDpm", formulaVersion: "excel-ta-v1", formulaId: "dpm-lower-v1", sourceCells: ["x"] },
      { outputField: "capability.upperDpm", formulaVersion: "excel-ta-v1", formulaId: "dpm-upper-v1", sourceCells: ["x"] },
      { outputField: "capability.totalDpm", formulaVersion: "excel-ta-v1", formulaId: "dpm-total-v1", sourceCells: ["x"] },
      { outputField: "capability.outOfSpecRatio", formulaVersion: "excel-ta-v1", formulaId: "dpm-total-v1", sourceCells: ["x"] },
      { outputField: "capability.cp", formulaVersion: "excel-ta-v1", formulaId: "cp-v1", sourceCells: ["x"] },
      { outputField: "capability.yield", formulaVersion: "excel-ta-v1", formulaId: "yield-v1", sourceCells: ["x"] },
      { outputField: "capability.lowerCpk", formulaVersion: "excel-ta-v1", formulaId: "cpk-lower-v1", sourceCells: ["x"] },
      { outputField: "capability.upperCpk", formulaVersion: "excel-ta-v1", formulaId: "cpk-upper-v1", sourceCells: ["x"] },
      { outputField: "capability.cpk", formulaVersion: "excel-ta-v1", formulaId: "cpk-v1", sourceCells: ["x"] },
      { outputField: "capability.status", formulaVersion: "excel-ta-v1", formulaId: "status-v1", sourceCells: ["x"] },
    ],
    scenarios: [],
  };
}

function makeWorkbookBytes({
  worksheetName = "Analysis-A",
  factorRows = [14, 20],
  shiftRow = 0,
  shiftColumn = 0,
  includeFormulaForDesignNominal = true,
  includeFormulaForAdjustedMean = true,
  includeResponseSummaryAnchor = true,
  addSecondFactorHeaderCluster = false,
  placeLowerZAfterSuggestedSpec = false,
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
    ws[`${col(20)}${r}`] = { t: "n", v: index === 0 ? 0.6 : 0.4, f: `=D${r}/SUM(D:D)` };
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

  setText(16, 45, "Additional Mean Shift");
  setNumber(17, 45, 0.01);

  setText(16, 46, "Adjusted Mean");
  setNumber(17, 46, 10.02, includeFormulaForAdjustedMean ? "=SUM(R14:R20)+R45" : undefined);

  setText(12, 43, "+ Tolerance Total");
  setNumber(12, 44, 0.2, "=SUM(S14:S20)");

  setText(13, 43, "- Tolerance Total");
  setNumber(13, 44, -0.2, "=-SUM(S14:S20)");

  setText(19, 43, "RSS Total");
  setNumber(19, 44, 0.033, "=SQRT(SUMSQ(T14:T20))");

  if (includeResponseSummaryAnchor) {
    setText(10, 48, "Response Summary Table");
  }

  const suggestedSpecRow = row(59);
  const lowerZRow = placeLowerZAfterSuggestedSpec ? 61 : 50;

  setText(18, lowerZRow, "Lower Z (Sigma Level):");
  setNumber(19, lowerZRow, 4.53, "=T57*3");

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

  setText(18, 55, "Lower Cpk:");
  setNumber(19, 55, 1.51, "=(R46-LSL)/(3*T44)");

  setText(18, 56, "Upper Cpk:");
  setNumber(19, 56, 1.87, "=(USL-R46)/(3*T44)");

  setText(18, 57, "Cpk:");
  setNumber(19, 57, 1.51, "=MIN(T55,T56)");

  setText(20, 57, "Status");
  setFormulaText(20, 57, "PASS", "=IF(T57>=1,\"PASS\",\"FAIL\")");

  setText(10, 20, "Suggested Spec");
  setText(10, 59, "Suggested Spec");
  setText(10, 80, "Suggested Spec");

  ws["!ref"] = `A1:${col(30)}${Math.max(120, suggestedSpecRow + 1)}`;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, worksheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function outputByName(mapping) {
  return new Map(mapping.outputs.map((item) => [item.name, item]));
}

describe("buildF4ExcelMapping", () => {
  it("maps sample-like controlled targets to excel-ta-v1 outputs", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A", factorRows: [14, 20] });
    const workbookBytes = makeWorkbookBytes({ worksheetName: "Analysis-A", factorRows: [14, 20] });

    const mapping = buildF4ExcelMapping({ workbookBytes, calculation });

    expect(mapping.version).toBe("excel-ta-v1");
    expect(mapping.inputs).toEqual([]);

    const metrics = outputByName(mapping);

    expect(metrics.get("factors[0].mean")).toMatchObject({ cell: "R14", expected: 10.01, tolerance: 1e-12, formulaId: "factor-mean-v1" });
    expect(metrics.get("factors[0].halfTolerance")).toMatchObject({ cell: "S14", expected: 0.1, tolerance: 1e-12, formulaId: "factor-half-tolerance-v1" });
    expect(metrics.get("factors[0].sigma")).toMatchObject({ cell: "T14", expected: 0.025, tolerance: 1e-12, formulaId: "factor-sigma-v1" });
    expect(metrics.get("factors[0].contribution")).toMatchObject({ cell: "U14", expected: 0.6, tolerance: 1e-12, formulaId: "contribution-v1" });

    expect(metrics.get("factors[1].mean")).toMatchObject({ cell: "R20", expected: 11.01, tolerance: 1e-12, formulaId: "factor-mean-v1" });

    expect(metrics.get("system.designNominal")).toMatchObject({ cell: "L44", expected: 10, tolerance: 1e-12 });
    expect(metrics.get("system.additionalMeanShift")).toMatchObject({ cell: "R45", expected: 0.01, tolerance: 1e-12 });
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

    expect(metrics.has("capability.status")).toBe(false);
  });

  it("supports moved rows/columns and ignores extra Suggested Spec labels", () => {
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

    const missingAdjustedFormula = makeWorkbookBytes({
      worksheetName: "Analysis-A",
      includeFormulaForAdjustedMean: false,
    });
    expect(() => buildF4ExcelMapping({ workbookBytes: missingAdjustedFormula, calculation })).toThrow("F4 excel mapping failed.");

    const missingDesignFormula = makeWorkbookBytes({
      worksheetName: "Analysis-A",
      includeFormulaForDesignNominal: false,
    });
    expect(() => buildF4ExcelMapping({ workbookBytes: missingDesignFormula, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects metrics that would cross Suggested Spec boundary", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({
      worksheetName: "Analysis-A",
      placeLowerZAfterSuggestedSpec: true,
    });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });

  it("rejects unsafe workbook paths without leaking local path details", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "f4-mapping-"));
    const dangerousPath = join(tempRoot, "..", "..", "sensitive.xlsx");

    try {
      expect(() => buildF4ExcelMapping({ workbookPath: dangerousPath, calculation: createCalculation() })).toThrow("F4 excel mapping failed.");
      try {
        buildF4ExcelMapping({ workbookPath: dangerousPath, calculation: createCalculation() });
      } catch (error) {
        expect(String(error)).toBe("Error: F4 excel mapping failed.");
        expect(String(error)).not.toContain(dangerousPath);
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects missing response summary anchor", () => {
    const calculation = createCalculation({ worksheetName: "Analysis-A" });
    const workbookBytes = makeWorkbookBytes({
      worksheetName: "Analysis-A",
      includeResponseSummaryAnchor: false,
    });

    expect(() => buildF4ExcelMapping({ workbookBytes, calculation })).toThrow("F4 excel mapping failed.");
  });
});
