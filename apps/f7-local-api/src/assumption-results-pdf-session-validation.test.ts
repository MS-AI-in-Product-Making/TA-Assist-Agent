import { describe, expect, it } from "vitest";
import { createF7SessionService } from "./f7-session-service.js";
import { validateAssumptionResultsPdfRequestAgainstSession } from "./assumption-results-pdf-session-validation.js";
import type { AssumptionResultsPdfRouteRequest } from "./assumption-results-pdf-contract.js";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function worksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

function cell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function sheetRows(): string {
  const factors = [
    ["Fabric thickness", "-0.57", "0.0125", "-1", "0.57"],
    ["C-cover height", "-1.94", "0.025", "-1", "1.94"],
  ] as const;
  const factorRows = factors.map((factor, index) => {
    const row = 14 + index;
    return `<row r="${row}">${cell(`G${row}`, factor[0])}${cell(`L${row}`, "0")}${cell(`M${row}`, "0")}${cell(`N${row}`, "0")}${cell(`O${row}`, "1")}${cell(`P${row}`, "0")}${cell(`Q${row}`, "Normal")}${cell(`R${row}`, factor[1])}${cell(`S${row}`, factor[4])}${cell(`T${row}`, factor[2])}</row>`;
  }).join("");

  return `<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Anonymous loop")}</row><row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("L13", "Design Nominal")}${cell("M13", "+ Tolerance")}${cell("N13", "- Tolerance")}${cell("O13", "Long Term/Safety Factor")}${cell("P13", "Sigma level")}${cell("Q13", "Distribution")}${cell("R13", "Mean")}${cell("S13", "Tolerance")}${cell("T13", "1 Sigma")}</row>${factorRows}<row r="54">${cell("O54", "LSL")}${cell("P54", "-0.15")}</row><row r="55">${cell("O55", "USL")}${cell("P55", "0.05")}</row>`;
}

function buildWorkbook(): Uint8Array {
  const workbookXml = `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const xmlParts: Record<string, string> = {
    "xl/workbook.xml": workbookXml,
    "xl/worksheets/sheet1.xml": worksheet(`<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`),
    "xl/worksheets/sheet2.xml": worksheet(`<row r="9">${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}</row><row r="10">${cell("A10", "Anonymous_TA")}${cell("C10", "First loop")}</row>`),
    "xl/worksheets/sheet3.xml": worksheet(sheetRows()),
  };
  return createAnonymousWorkbookZip({ xmlParts });
}

function createService() {
  return createF7SessionService({
    createId: () => `session-${Math.random().toString(16).slice(2)}`,
    now: () => "2026-08-19T08:00:00.000Z",
  });
}

function buildSessionBoundRequest(snapshot: ReturnType<ReturnType<typeof createService>["getSession"]>): AssumptionResultsPdfRouteRequest {
  const evidenceRows = snapshot.factors
    .map((factorState) => factorState.evidence)
    .filter((evidence): evidence is NonNullable<typeof evidence> => evidence !== undefined);
  const firstEvidence = evidenceRows[0];
  if (!firstEvidence) throw new Error("Expected confirmed factor evidence in test fixture session.");

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
          itemNumber: evidence.sourceRow,
          factorName: evidence.factorName,
          designNominal: evidence.designNominal,
          upperTolerance: evidence.upperTolerance,
          lowerTolerance: evidence.lowerTolerance,
          longTermSafetyFactor: evidence.longTermSafetyFactor,
          sigmaLevel: evidence.sigmaLevel,
          distribution: evidence.distribution,
          mean: evidence.calculatedMean,
          tolerance: evidence.tolerance,
          oneSigma: evidence.oneSigma,
          contributionPercent: index === 0 ? 100 : 0,
        })),
        footer: {
          designNominalTotal: 0,
          upperWorstCaseTolerance: 0,
          lowerWorstCaseTolerance: 0,
          meanResponse: 0,
          rssTolerance: 0,
          rssSigma: 0,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: 0,
        },
      },
      dimensionChain: {
        status: "generated",
        sourceSignature: JSON.stringify({
          workbookName: snapshot.workbook.fileName,
          worksheetName: firstEvidence.worksheetName,
          factorIds: evidenceRows.map((evidence) => evidence.factorId),
        }),
        orientation: "horizontal",
        factors: evidenceRows.map((evidence) => ({
          id: evidence.factorId,
          itemNumber: evidence.sourceRow,
          name: evidence.factorName,
          designNominal: evidence.designNominal,
          upperTolerance: evidence.upperTolerance,
          lowerTolerance: evidence.lowerTolerance,
          longTermSafetyFactor: evidence.longTermSafetyFactor,
          sigmaLevel: evidence.sigmaLevel,
          distribution: evidence.distribution,
        })),
        manualLayout: {
          boundaryOffsets: Object.fromEntries(evidenceRows.map((evidence) => [evidence.factorId, 0])),
          laneOffsets: Object.fromEntries(evidenceRows.map((evidence) => [evidence.factorId, 0])),
          closureStartOffset: 0,
          closureEndOffset: 0,
          closureLaneOffset: 0,
        },
        reversedFactorIds: [],
        closureDirection: "start-to-end",
      },
      responseDistribution: {
        mean: 0,
        standardDeviation: 0.1,
        lowerSpecLimit: -1,
        upperSpecLimit: 1,
        target: 0,
      },
      responseSummary: {
        rssAndWorstCase: {
          sigmaBands: [{ sigma: 1, tolerance: 0.1, upper: 0.1, lower: -0.1 }],
          worstCase: { tolerance: 0.2, upper: 0.2, lower: -0.2 },
        },
        responseAndSpecifications: {
          designNominal: 0,
          meanResponse: 0,
          additionalMeanShift: 0,
          adjustedMean: 0,
          lowerSpecLimit: -1,
          upperSpecLimit: 1,
          targetSigmaLevel: 4,
          targetCpk: 1.33,
        },
        sigmaLevelAndCapability: {
          lowerZ: { value: 4, status: "PASS" },
          upperZ: { value: 4, status: "PASS" },
          calculatedSigmaLevel: { value: 4, status: "PASS" },
          cp: { value: 1.33, status: "PASS" },
          lowerCpk: { value: 1.33, status: "PASS" },
          upperCpk: { value: 1.33, status: "PASS" },
          calculatedCpk: { value: 1.33, status: "PASS" },
        },
        defectsPerMillion: {
          lowerDpm: 0,
          upperDpm: 0,
          totalDpm: 0,
          outOfSpecPercent: 0,
          yieldPercent: 100,
          volume: 100,
          failuresOverVolume: 0.5,
        },
      },
    },
  };
}

describe("validateAssumptionResultsPdfRequestAgainstSession", () => {
  it("accepts session-aligned workbook, worksheet, and factor evidence rows", () => {
    const service = createService();
    const imported = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "Session-A.xlsx",
      workbookBytes: buildWorkbook(),
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

    const request = buildSessionBoundRequest(ready);
    expect(validateAssumptionResultsPdfRequestAgainstSession(request, ready)).toEqual({ ok: true });
  });

  it("rejects workbook/worksheet mismatch and cross-session factor evidence", () => {
    const service = createService();
    const importedA = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "Session-A.xlsx",
      workbookBytes: buildWorkbook(),
    });
    const worksheetA = service.confirmWorksheet({
      sessionId: importedA.sessionId,
      confirmation: {
        workbookContentHash: importedA.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    const readyA = service.confirmFactorSetup({
      sessionId: importedA.sessionId,
      confirmations: worksheetA.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });

    const importedB = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "Session-B.xlsx",
      workbookBytes: buildWorkbook(),
    });
    const worksheetB = service.confirmWorksheet({
      sessionId: importedB.sessionId,
      confirmation: {
        workbookContentHash: importedB.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    const readyB = service.confirmFactorSetup({
      sessionId: importedB.sessionId,
      confirmations: worksheetB.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });

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
});
