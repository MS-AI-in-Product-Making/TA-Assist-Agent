import { describe, expect, it } from "vitest";
import { calculateToleranceAnalysis } from "@ai-assist/workbook-catalog/calculation-kernel";
import { createF7SessionService } from "./f7-session-service.js";
import type { AssumptionResultsPdfRouteRequest } from "./assumption-results-pdf-contract.js";
import { validateAssumptionResultsPdfRequestAgainstSession } from "./assumption-results-pdf-session-validation.js";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const HASH_C = "c".repeat(64);

function worksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

function cell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function sheetRows(firstFactorName = "Fabric thickness"): string {
  const factors = [
    [firstFactorName, "-0.57", "0.0125", "-1", "0.57"],
    ["C-cover height", "-1.94", "0.025", "-1", "1.94"],
  ] as const;
  const factorRows = factors.map((factor, index) => {
    const row = 14 + index;
    return `<row r="${row}">${cell(`G${row}`, factor[0])}${cell(`L${row}`, "0")}${cell(`M${row}`, "0")}${cell(`N${row}`, "0")}${cell(`O${row}`, "1")}${cell(`P${row}`, "0")}${cell(`Q${row}`, "Normal")}${cell(`R${row}`, factor[1])}${cell(`S${row}`, factor[4])}${cell(`T${row}`, factor[2])}</row>`;
  }).join("");

  return `<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Anonymous loop")}</row><row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("L13", "Design Nominal")}${cell("M13", "+ Tolerance")}${cell("N13", "- Tolerance")}${cell("O13", "Long Term/Safety Factor")}${cell("P13", "Sigma level")}${cell("Q13", "Distribution")}${cell("R13", "Mean")}${cell("S13", "Tolerance")}${cell("T13", "1 Sigma")}</row>${factorRows}<row r="50">${cell("O50", "Additional Mean Shift")}${cell("P50", "0.01")}</row><row r="53">${cell("O53", "Response Summary")}</row><row r="54">${cell("O54", "Design Nominal")}${cell("P54", "1.627")}</row><row r="55">${cell("O55", "LSL")}${cell("P55", "-0.15")}</row><row r="56">${cell("O56", "USL")}${cell("P56", "0.05")}${cell("W56", "Volume")}${cell("X56", "1000")}</row><row r="57">${cell("O57", "Target Sigma Level")}${cell("P57", "4")}</row>`;
}

const DISTRIBUTION_BY_LABEL = {
  Normal: "normal",
  Uniform: "uniform",
  Triangular: "triangular",
  Trapezoidal: "trapezoidal",
  Elliptical: "elliptical",
  Beta: "beta",
} as const;

function buildWorkbook(firstFactorName = "Fabric thickness"): Uint8Array {
  const workbookXml = `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const xmlParts: Record<string, string> = {
    "xl/workbook.xml": workbookXml,
    "xl/worksheets/sheet1.xml": worksheet(`<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`),
    "xl/worksheets/sheet2.xml": worksheet(`<row r="9">${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}</row><row r="10">${cell("A10", "Anonymous_TA")}${cell("C10", "First loop")}</row>`),
    "xl/worksheets/sheet3.xml": worksheet(sheetRows(firstFactorName)),
  };
  return createAnonymousWorkbookZip({ xmlParts });
}

function createService() {
  return createF7SessionService({
    createId: (() => {
      let next = 1;
      return () => `session-${next++}`;
    })(),
    now: () => "2026-08-19T08:00:00.000Z",
  });
}

function createReadySession(fileName = "Session-A.xlsx", firstFactorName?: string) {
  const service = createService();
  const imported = service.importWorkbook({
    contractId: "f7-analysis-request-v1",
    inputClassification: "confidential",
    fileName,
    workbookBytes: buildWorkbook(firstFactorName),
  });
  const worksheet = service.confirmWorksheet({
    sessionId: imported.sessionId,
    confirmation: {
      workbookContentHash: imported.workbook.workbookContentHash,
      selectedWorksheetNames: ["Anonymous_TA"],
      confirmed: true,
    },
  });
  const ready = service.confirmFactorSetup({
    sessionId: imported.sessionId,
    confirmations: worksheet.factors.map((factor) => ({
      factorCandidateId: factor.factorCandidate.factorCandidateId,
      designNominal: factor.factorCandidate.designNominal,
      upperTolerance: factor.factorCandidate.upperTolerance,
      lowerTolerance: factor.factorCandidate.lowerTolerance,
      confirmed: true,
    })),
  });
  return { ready };
}

function buildSessionBoundRequest(snapshot: ReturnType<ReturnType<typeof createService>["getSession"]>): AssumptionResultsPdfRouteRequest {
  const evidenceRows = snapshot.factors
    .map((factorState) => factorState.evidence)
    .filter((evidence): evidence is NonNullable<typeof evidence> => evidence !== undefined);
  const firstEvidence = evidenceRows[0];
  if (!firstEvidence) throw new Error("Expected confirmed factor evidence in test fixture session.");

  const specification = snapshot.systemSpecification;
  if (
    specification?.status !== "available"
    || specification.lowerSpecLimit.status !== "available"
    || specification.upperSpecLimit.status !== "available"
    || specification.targetSigmaLevel.status !== "available"
    || specification.additionalMeanShift.status !== "available"
  ) {
    throw new Error("Expected available system specification in test fixture session.");
  }

  const additionalMeanShift = specification.additionalMeanShift.valueOrigin === "defaulted"
    ? 0
    : specification.additionalMeanShift.actualValue;
  const kernelFactors = evidenceRows.map((evidence) => ({
    source: {
      worksheetName: evidence.worksheetName,
      tableId: evidence.tableId,
      sourceRow: evidence.sourceRow,
    },
    name: evidence.factorName,
    unit: evidence.unit,
    input: {
      nominalValue: evidence.designNominal,
      upperTolerance: evidence.upperTolerance,
      lowerTolerance: evidence.lowerTolerance,
      longTermSafetyFactor: evidence.longTermSafetyFactor,
      sigmaLevel: evidence.sigmaLevel,
      distribution: DISTRIBUTION_BY_LABEL[evidence.distribution],
    },
  }));
  const calculation = calculateToleranceAnalysis({
    factors: kernelFactors,
    system: {
      designNominal: kernelFactors.reduce((sum, factor) => sum + factor.input.nominalValue, 0),
      lowerSpecLimit: specification.lowerSpecLimit.actualValue,
      upperSpecLimit: specification.upperSpecLimit.actualValue,
      targetSigmaLevel: specification.targetSigmaLevel.actualValue,
      targetCpk: specification.targetSigmaLevel.actualValue / 3,
      shift: additionalMeanShift,
    },
  });

  const calculationByKey = new Map(calculation.factors.map((factor) => [
    JSON.stringify([factor.source.worksheetName, factor.source.tableId, factor.source.sourceRow, factor.name]),
    factor,
  ]));
  const sigmaBands = [1, 3, 4, 4.5, 6] as const;
  const volume = specification.volume?.status === "available" ? specification.volume.actualValue : undefined;
  const failuresOverVolume = volume === undefined
    ? undefined
    : calculation.capability.totalDpm / 1_000_000 * volume;

  return {
    sessionId: snapshot.sessionId,
    workbookName: snapshot.workbook.fileName,
    worksheetName: firstEvidence.worksheetName,
    resultJudgment: { status: "below-target", headline: "Capability is below target" },
    resultSummaryCaption: "Summary",
    summaryRows: [{
      metric: "Mean",
      result: "1.20",
      reference: "1.00",
      difference: "+0.20",
      assessment: "Below target",
      performanceContext: "80% of target",
      tone: "fail",
    }],
    overallAssessment: "Assessment",
    rootCauseItems: [{
      title: "Root",
      narrative: "Narrative",
      hypothesisStatus: "hypothesis",
      incompleteEvidence: false,
      quantitativeEvidence: [{ label: "Gap", value: "1" }],
    }],
    actionItems: [{
      optionId: "improvement-reduce-variation",
      title: "Action",
      narrative: "Narrative",
    }],
    contributors: [],
    processGuidanceContext: "Context",
    processGuidance: [],
    engineeringEvidence: {
      factorSetup: {
        rows: evidenceRows.map((evidence, index) => ({
          ...(() => {
            const factor = calculationByKey.get(JSON.stringify([
              evidence.worksheetName,
              evidence.tableId,
              evidence.sourceRow,
              evidence.factorName,
            ]));
            if (!factor) throw new Error("Expected matched kernel factor in test fixture session.");
            return {
              mean: factor.mean,
              tolerance: factor.halfTolerance,
              oneSigma: factor.sigma,
              contributionPercent: factor.contribution * 100,
            };
          })(),
          itemNumber: index + 1,
          factorName: evidence.factorName,
          designNominal: evidence.designNominal,
          upperTolerance: evidence.upperTolerance,
          lowerTolerance: evidence.lowerTolerance,
          longTermSafetyFactor: evidence.longTermSafetyFactor,
          sigmaLevel: evidence.sigmaLevel,
          distribution: evidence.distribution,
        })),
        footer: {
          designNominalTotal: calculation.system.designNominal,
          upperWorstCaseTolerance: calculation.system.responseUpperTolerance,
          lowerWorstCaseTolerance: calculation.system.responseLowerTolerance,
          meanResponse: calculation.system.mean - calculation.system.shift,
          rssTolerance: calculation.system.rssSigma * 3,
          rssSigma: calculation.system.rssSigma,
          contributionTotalPercent: calculation.factors.reduce((sum, factor) => sum + factor.contribution, 0) * 100,
          additionalMeanShift: calculation.system.shift,
          adjustedMean: calculation.system.mean,
        },
      },
      dimensionChain: {
        status: "generated",
        sourceSignature: JSON.stringify(evidenceRows.map((evidence, index) => ({
          id: evidence.factorId,
          itemNumber: index + 1,
          name: evidence.factorName,
          designNominal: evidence.designNominal,
          upperTolerance: evidence.upperTolerance,
          lowerTolerance: evidence.lowerTolerance,
          longTermSafetyFactor: evidence.longTermSafetyFactor,
          sigmaLevel: evidence.sigmaLevel,
          distribution: evidence.distribution,
        }))),
        orientation: "horizontal",
        factors: evidenceRows.map((evidence, index) => ({
          id: evidence.factorId,
          itemNumber: index + 1,
          name: evidence.factorName,
          designNominal: evidence.designNominal,
          upperTolerance: evidence.upperTolerance,
          lowerTolerance: evidence.lowerTolerance,
          longTermSafetyFactor: evidence.longTermSafetyFactor,
          sigmaLevel: evidence.sigmaLevel,
          distribution: evidence.distribution,
        })),
        manualLayout: {
          boundaryOffsets: Object.fromEntries(evidenceRows.slice(1).map((evidence, index) => ([
            `${evidenceRows[index]!.factorId}::${evidence.factorId}`,
            0,
          ]))),
          laneOffsets: Object.fromEntries(evidenceRows.map((evidence) => [evidence.factorId, 0])),
          closureStartOffset: 0,
          closureEndOffset: 0,
          closureLaneOffset: 0,
        },
        reversedFactorIds: evidenceRows.length > 1 ? [evidenceRows[1]!.factorId] : [],
        closureDirection: "start-to-end",
      },
      responseDistribution: {
        mean: calculation.system.mean,
        standardDeviation: calculation.system.rssSigma,
        lowerSpecLimit: calculation.capability.lowerSpecLimit,
        upperSpecLimit: calculation.capability.upperSpecLimit,
        target: calculation.system.designNominal,
      },
      responseSummary: {
        rssAndWorstCase: {
          sigmaBands: sigmaBands.map((sigma) => ({
            sigma,
            tolerance: calculation.system.rssSigma * sigma,
            upper: calculation.system.mean + calculation.system.rssSigma * sigma,
            lower: calculation.system.mean - calculation.system.rssSigma * sigma,
          })),
          worstCase: {
            tolerance: calculation.system.worstCaseTolerance,
            upper: calculation.system.worstCaseUpperBound,
            lower: calculation.system.worstCaseLowerBound,
          },
        },
        responseAndSpecifications: {
          designNominal: calculation.system.designNominal,
          meanResponse: calculation.system.mean - calculation.system.shift,
          additionalMeanShift: calculation.system.shift,
          adjustedMean: calculation.system.mean,
          lowerSpecLimit: calculation.capability.lowerSpecLimit,
          upperSpecLimit: calculation.capability.upperSpecLimit,
          targetSigmaLevel: calculation.capability.targetSigmaLevel,
          targetCpk: calculation.capability.targetCpk,
        },
        sigmaLevelAndCapability: {
          lowerZ: { value: calculation.capability.lowerZ, status: calculation.capability.lowerCpkStatus },
          upperZ: { value: calculation.capability.upperZ, status: calculation.capability.upperCpkStatus },
          calculatedSigmaLevel: { value: calculation.capability.z, status: calculation.capability.status },
          cp: { value: calculation.capability.cp, status: calculation.capability.cpStatus },
          lowerCpk: { value: calculation.capability.lowerCpk, status: calculation.capability.lowerCpkStatus },
          upperCpk: { value: calculation.capability.upperCpk, status: calculation.capability.upperCpkStatus },
          calculatedCpk: { value: calculation.capability.cpk, status: calculation.capability.status },
        },
        defectsPerMillion: {
          lowerDpm: calculation.capability.lowerDpm,
          upperDpm: calculation.capability.upperDpm,
          totalDpm: calculation.capability.totalDpm,
          outOfSpecPercent: calculation.capability.outOfSpecRatio * 100,
          yieldPercent: calculation.capability.yield * 100,
          ...(volume === undefined ? {} : { volume }),
          ...(failuresOverVolume === undefined ? {} : { failuresOverVolume }),
        },
      },
    },
  };
}

function cloneRequest(request: AssumptionResultsPdfRouteRequest): AssumptionResultsPdfRouteRequest {
  return JSON.parse(JSON.stringify(request)) as AssumptionResultsPdfRouteRequest;
}

describe("validateAssumptionResultsPdfRequestAgainstSession", () => {
  it("fails closed when request evidence contains Infinity/NaN even if counterpart is also non-finite", () => {
    const { ready } = createReadySession();
    const baseline = buildSessionBoundRequest(ready);
    expect(validateAssumptionResultsPdfRequestAgainstSession(baseline, ready)).toEqual({ ok: true });

    const bothInfinity = cloneRequest(baseline);
    bothInfinity.engineeringEvidence.responseSummary.sigmaLevelAndCapability.calculatedCpk.value = Number.POSITIVE_INFINITY;
    expect(validateAssumptionResultsPdfRequestAgainstSession(bothInfinity, ready)).toEqual({ ok: false });

    const bothNaN = cloneRequest(baseline);
    bothNaN.engineeringEvidence.responseSummary.sigmaLevelAndCapability.calculatedCpk.value = Number.NaN;
    expect(validateAssumptionResultsPdfRequestAgainstSession(bothNaN, ready)).toEqual({ ok: false });
  });

  it("fails closed when extreme but finite inputs produce non-finite kernel outputs", () => {
    const { ready } = createReadySession();
    const baseline = buildSessionBoundRequest(ready);
    expect(validateAssumptionResultsPdfRequestAgainstSession(baseline, ready)).toEqual({ ok: true });

    const extremeRequest = cloneRequest(baseline);
    extremeRequest.engineeringEvidence.factorSetup.rows[0]!.designNominal = Number.MAX_VALUE;
    extremeRequest.engineeringEvidence.factorSetup.rows[0]!.upperTolerance = Number.MAX_VALUE;
    extremeRequest.engineeringEvidence.factorSetup.rows[0]!.lowerTolerance = -Number.MAX_VALUE;

    const extremeReady = {
      ...ready,
      factors: ready.factors.map((factorState) => {
        if (!factorState.evidence) {
          return factorState;
        }
        return {
          ...factorState,
          evidence: {
            ...factorState.evidence,
            designNominal: Number.MAX_VALUE,
            calculatedMean: Number.MAX_VALUE,
            upperTolerance: Number.MAX_VALUE,
            lowerTolerance: -Number.MAX_VALUE,
            tolerance: Number.MAX_VALUE,
            oneSigma: Number.MAX_VALUE,
            physicalMean: Number.MAX_VALUE,
            signedContributionMean: Number.MAX_VALUE,
            lowerSpecLimit: 0,
            upperSpecLimit: Number.MAX_VALUE,
            baselineSampler: {
              samplerId: "NORMAL_LOCATION_SCALE_V1",
              physicalMean: Number.MAX_VALUE,
              standardDeviation: Number.MAX_VALUE,
              support: "REAL",
            },
          },
        };
      }),
      systemSpecification: {
        status: "available" as const,
        designNominal: {
          status: "available" as const,
          actualValue: Number.MAX_VALUE,
          displayValue: String(Number.MAX_VALUE),
          sourceLabel: "Design nominal",
          valueOrigin: "numeric_literal" as const,
        },
        lowerSpecLimit: {
          status: "available" as const,
          actualValue: -Number.MAX_VALUE,
          displayValue: String(-Number.MAX_VALUE),
          sourceLabel: "Lower specification limit",
          valueOrigin: "numeric_literal" as const,
        },
        upperSpecLimit: {
          status: "available" as const,
          actualValue: Number.MAX_VALUE,
          displayValue: String(Number.MAX_VALUE),
          sourceLabel: "Upper specification limit",
          valueOrigin: "numeric_literal" as const,
        },
        targetSigmaLevel: {
          status: "available" as const,
          actualValue: 6,
          displayValue: "6",
          sourceLabel: "Target sigma level",
          valueOrigin: "numeric_literal" as const,
        },
        additionalMeanShift: {
          status: "available" as const,
          actualValue: 1e9,
          displayValue: "1000000000",
          sourceLabel: "Additional mean shift",
          valueOrigin: "numeric_literal" as const,
        },
        volume: {
          status: "available" as const,
          actualValue: 1000,
          displayValue: "1000",
          sourceLabel: "Volume",
          valueOrigin: "numeric_literal" as const,
        },
      },
    };
    expect(validateAssumptionResultsPdfRequestAgainstSession(extremeRequest, extremeReady)).toEqual({ ok: false });
  });

  it("accepts itemNumber by session order even when sourceRow is not 1..N", () => {
    const { ready } = createReadySession();
    const request = buildSessionBoundRequest(ready);

    expect(request.engineeringEvidence.factorSetup.rows[0]?.itemNumber).toBe(1);
    expect(ready.factors[0]?.evidence?.sourceRow).not.toBe(1);
    expect(validateAssumptionResultsPdfRequestAgainstSession(request, ready)).toEqual({ ok: true });
  });

  it("accepts generated sourceSignature JSON without workbook/worksheet/factorIds assumptions", () => {
    const { ready } = createReadySession();
    const request = buildSessionBoundRequest(ready);
    request.engineeringEvidence.dimensionChain = {
      ...request.engineeringEvidence.dimensionChain,
      sourceSignature: JSON.stringify({
        workbookName: "other.xlsx",
        worksheetName: "other-sheet",
        factorIds: [HASH_C],
      }),
    };

    expect(validateAssumptionResultsPdfRequestAgainstSession(request, ready)).toEqual({ ok: true });
  });

  it("rejects generated chain when factor ids are duplicated or incomplete", () => {
    const { ready } = createReadySession();
    const request = buildSessionBoundRequest(ready);
    request.engineeringEvidence.dimensionChain = {
      ...request.engineeringEvidence.dimensionChain,
      factors: [
        request.engineeringEvidence.dimensionChain.factors[0]!,
        {
          ...request.engineeringEvidence.dimensionChain.factors[0]!,
          itemNumber: 2,
        },
      ],
    };

    expect(validateAssumptionResultsPdfRequestAgainstSession(request, ready)).toEqual({ ok: false });
  });

  it("rejects generated chain when reversed ids or manual layout keys are outside factor set", () => {
    const { ready } = createReadySession();
    const request = buildSessionBoundRequest(ready);
    request.engineeringEvidence.dimensionChain = {
      ...request.engineeringEvidence.dimensionChain,
      manualLayout: {
        ...request.engineeringEvidence.dimensionChain.manualLayout,
        boundaryOffsets: {
          [`${request.engineeringEvidence.dimensionChain.factors[0]!.id}::${HASH_C}`]: 0,
        },
        laneOffsets: {
          ...request.engineeringEvidence.dimensionChain.manualLayout.laneOffsets,
          [HASH_C]: 1,
        },
      },
      reversedFactorIds: [HASH_C],
    };

    expect(validateAssumptionResultsPdfRequestAgainstSession(request, ready)).toEqual({ ok: false });
  });

  it("skips generated-only factor-id/layout checks when chain status is fallback", () => {
    const { ready } = createReadySession();
    const request = buildSessionBoundRequest(ready);
    request.engineeringEvidence.dimensionChain = {
      status: "fallback",
      sourceSignature: JSON.stringify([{ id: HASH_C, sourceRow: 999 }]),
    };

    expect(validateAssumptionResultsPdfRequestAgainstSession(request, ready)).toEqual({ ok: true });
  });

  it("rejects any tampered derived engineering evidence field", () => {
    const { ready } = createReadySession();
    const baseline = buildSessionBoundRequest(ready);
    expect(validateAssumptionResultsPdfRequestAgainstSession(baseline, ready)).toEqual({ ok: true });

    const tamperedContribution = cloneRequest(baseline);
    tamperedContribution.engineeringEvidence.factorSetup.rows[0]!.contributionPercent += 0.123;
    expect(validateAssumptionResultsPdfRequestAgainstSession(tamperedContribution, ready)).toEqual({ ok: false });

    const tamperedFooterShift = cloneRequest(baseline);
    tamperedFooterShift.engineeringEvidence.factorSetup.footer.additionalMeanShift += 0.01;
    expect(validateAssumptionResultsPdfRequestAgainstSession(tamperedFooterShift, ready)).toEqual({ ok: false });

    const tamperedCurve = cloneRequest(baseline);
    tamperedCurve.engineeringEvidence.responseDistribution.standardDeviation += 0.001;
    expect(validateAssumptionResultsPdfRequestAgainstSession(tamperedCurve, ready)).toEqual({ ok: false });

    const tamperedCapability = cloneRequest(baseline);
    tamperedCapability.engineeringEvidence.responseSummary.sigmaLevelAndCapability.calculatedCpk.value += 0.01;
    expect(validateAssumptionResultsPdfRequestAgainstSession(tamperedCapability, ready)).toEqual({ ok: false });

    const tamperedDpm = cloneRequest(baseline);
    tamperedDpm.engineeringEvidence.responseSummary.defectsPerMillion.totalDpm += 1;
    expect(validateAssumptionResultsPdfRequestAgainstSession(tamperedDpm, ready)).toEqual({ ok: false });

    if (baseline.engineeringEvidence.responseSummary.defectsPerMillion.failuresOverVolume !== undefined) {
      const tamperedFailures = cloneRequest(baseline);
      tamperedFailures.engineeringEvidence.responseSummary.defectsPerMillion.failuresOverVolume += 0.5;
      expect(validateAssumptionResultsPdfRequestAgainstSession(tamperedFailures, ready)).toEqual({ ok: false });
    }
  });

  it("returns ok false for known calculation kernel invalid-input errors", () => {
    const { ready } = createReadySession();
    const baseline = buildSessionBoundRequest(ready);

    const result = validateAssumptionResultsPdfRequestAgainstSession(baseline, ready, {
      calculateToleranceAnalysis: () => {
        throw {
          code: "calculation_not_possible",
          summary: "known-kernel-invalid",
        };
      },
    });

    expect(result).toEqual({ ok: false });
  });

  it("rethrows unknown errors from derived evidence calculation", () => {
    const { ready } = createReadySession();
    const baseline = buildSessionBoundRequest(ready);
    const unknown = new Error("unknown-kernel-failure");

    expect(() => validateAssumptionResultsPdfRequestAgainstSession(baseline, ready, {
      calculateToleranceAnalysis: () => {
        throw unknown;
      },
    })).toThrow(unknown);
  });

  it("rejects large absolute drift for huge derived values and accepts tiny floating drift", () => {
    const { ready } = createReadySession();
    const baseline = buildSessionBoundRequest(ready);

    const hugeDrift = cloneRequest(baseline);
    hugeDrift.engineeringEvidence.responseSummary.defectsPerMillion.totalDpm = 1_000_000_000;
    hugeDrift.engineeringEvidence.responseSummary.defectsPerMillion.lowerDpm = 500_000_000;
    hugeDrift.engineeringEvidence.responseSummary.defectsPerMillion.upperDpm = 500_000_000;
    hugeDrift.engineeringEvidence.responseSummary.defectsPerMillion.outOfSpecPercent = 100_000;
    hugeDrift.engineeringEvidence.responseSummary.defectsPerMillion.yieldPercent = -99_900;
    expect(validateAssumptionResultsPdfRequestAgainstSession(hugeDrift, ready)).toEqual({ ok: false });

    const tinyDrift = cloneRequest(baseline);
    tinyDrift.engineeringEvidence.responseSummary.sigmaLevelAndCapability.calculatedCpk.value += 1e-12;
    expect(validateAssumptionResultsPdfRequestAgainstSession(tinyDrift, ready)).toEqual({ ok: true });
  });

  it("rejects derived comparison when value is 1e9 and request differs by 1", () => {
    const { ready } = createReadySession();
    const baseline = buildSessionBoundRequest(ready);

    const strictAbsoluteCap = cloneRequest(baseline);
    strictAbsoluteCap.engineeringEvidence.responseSummary.defectsPerMillion.totalDpm = 1_000_000_001;
    strictAbsoluteCap.engineeringEvidence.responseSummary.defectsPerMillion.lowerDpm = 400_000_000;
    strictAbsoluteCap.engineeringEvidence.responseSummary.defectsPerMillion.upperDpm = 600_000_000;
    strictAbsoluteCap.engineeringEvidence.responseSummary.defectsPerMillion.outOfSpecPercent = 25;
    strictAbsoluteCap.engineeringEvidence.responseSummary.defectsPerMillion.yieldPercent = 75;

    expect(validateAssumptionResultsPdfRequestAgainstSession(strictAbsoluteCap, ready, {
      calculateToleranceAnalysis: (input) => {
        const kernel = calculateToleranceAnalysis(input);
        return {
          ...kernel,
          capability: {
            ...kernel.capability,
            lowerDpm: 400_000_000,
            upperDpm: 600_000_000,
            totalDpm: 1_000_000_000,
            outOfSpecRatio: 0.25,
            yield: 0.75,
          },
        };
      },
    })).toEqual({ ok: false });
  });

  it("rejects workbook/worksheet mismatch and cross-session factor evidence", () => {
    const { ready: readyA } = createReadySession("Session-A.xlsx");
    const { ready: readyB } = createReadySession("Session-B.xlsx", "Fabric thickness B");

    const requestA = buildSessionBoundRequest(readyA);
    expect(validateAssumptionResultsPdfRequestAgainstSession(
      { ...requestA, workbookName: "Session-B.xlsx" },
      readyA,
    )).toEqual({ ok: false });
    expect(validateAssumptionResultsPdfRequestAgainstSession(
      { ...requestA, worksheetName: "Session-B-Sheet" },
      readyA,
    )).toEqual({ ok: false });

    const requestB = buildSessionBoundRequest(readyB);
    expect(validateAssumptionResultsPdfRequestAgainstSession(
      { ...requestA, engineeringEvidence: requestB.engineeringEvidence },
      readyA,
    )).toEqual({ ok: false });
  });

  it("requires both volume and failuresOverVolume when session volume is available", () => {
    const { ready } = createReadySession();
    const baseline = buildSessionBoundRequest(ready);
    expect(validateAssumptionResultsPdfRequestAgainstSession(baseline, ready)).toEqual({ ok: true });

    const missingVolume = cloneRequest(baseline);
    delete missingVolume.engineeringEvidence.responseSummary.defectsPerMillion.volume;
    expect(validateAssumptionResultsPdfRequestAgainstSession(missingVolume, ready)).toEqual({ ok: false });

    const missingFailuresOverVolume = cloneRequest(baseline);
    delete missingFailuresOverVolume.engineeringEvidence.responseSummary.defectsPerMillion.failuresOverVolume;
    expect(validateAssumptionResultsPdfRequestAgainstSession(missingFailuresOverVolume, ready)).toEqual({ ok: false });

    const missingBoth = cloneRequest(baseline);
    delete missingBoth.engineeringEvidence.responseSummary.defectsPerMillion.volume;
    delete missingBoth.engineeringEvidence.responseSummary.defectsPerMillion.failuresOverVolume;
    expect(validateAssumptionResultsPdfRequestAgainstSession(missingBoth, ready)).toEqual({ ok: false });
  });

  it("requires both volume fields to be absent when session volume is unavailable", () => {
    const { ready } = createReadySession();
    const volumeUnavailable = {
      ...ready,
      systemSpecification: {
        ...ready.systemSpecification,
        status: "available" as const,
        volume: {
          status: "unavailable" as const,
          reasonCode: "response_summary_value_missing" as const,
        },
      },
    };
    const baseline = buildSessionBoundRequest(volumeUnavailable);
    expect(validateAssumptionResultsPdfRequestAgainstSession(baseline, volumeUnavailable)).toEqual({ ok: true });

    const withVolumeOnly = cloneRequest(baseline);
    withVolumeOnly.engineeringEvidence.responseSummary.defectsPerMillion.volume = 1000;
    expect(validateAssumptionResultsPdfRequestAgainstSession(withVolumeOnly, volumeUnavailable)).toEqual({ ok: false });

    const withFailuresOnly = cloneRequest(baseline);
    withFailuresOnly.engineeringEvidence.responseSummary.defectsPerMillion.failuresOverVolume = 0.5;
    expect(validateAssumptionResultsPdfRequestAgainstSession(withFailuresOnly, volumeUnavailable)).toEqual({ ok: false });

    const withBoth = cloneRequest(baseline);
    withBoth.engineeringEvidence.responseSummary.defectsPerMillion.volume = 1000;
    withBoth.engineeringEvidence.responseSummary.defectsPerMillion.failuresOverVolume = 0.5;
    expect(validateAssumptionResultsPdfRequestAgainstSession(withBoth, volumeUnavailable)).toEqual({ ok: false });
  });
});
