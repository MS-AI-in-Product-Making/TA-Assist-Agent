import { access, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  assumptionResultsPdfRouteRequestSchema,
  encodeRfc5987FileName,
  safePdfDownloadFileName,
  safeUnicodePdfDownloadFileName,
  type AssumptionResultsPdfRouteRequest,
} from "./assumption-results-pdf-contract.js";
import {
  AssumptionResultsPdfQueueFullError,
  createAssumptionResultsPdfRenderer,
  executePdfBrowser,
  renderAssumptionResultsPdfHtml,
} from "./assumption-results-pdf-renderer.js";

const INJECTED_TEXT = `<img src=x onerror="alert('unsafe')"> & analysis`;
const HASH_B = "b".repeat(64);

function validRequest(): AssumptionResultsPdfRouteRequest {
  return {
    sessionId: "session-1",
    workbookName: `Workbook ${INJECTED_TEXT}.xlsx`,
    worksheetName: `Sheet ${INJECTED_TEXT}`,
    resultJudgment: {
      status: "below-target",
      headline: `Capability ${INJECTED_TEXT}`,
    },
    resultSummaryCaption: `Comparison ${INJECTED_TEXT}`,
    summaryRows: [{
      metric: `Mean ${INJECTED_TEXT}`,
      result: "1.20",
      reference: "1.00",
      referenceDetail: `Nominal ${INJECTED_TEXT}`,
      difference: "+0.20",
      assessment: "Below target",
      performanceContext: "80% of target",
      tone: "fail",
    }],
    overallAssessment: `Fail ${INJECTED_TEXT}`,
    rootCauseItems: [{
      title: `Variation ${INJECTED_TEXT}`,
      narrative: `Root ${INJECTED_TEXT}`,
      hypothesisStatus: "hypothesis",
      incompleteEvidence: true,
      quantitativeEvidence: [{
        label: `Cp-Cpk gap ${INJECTED_TEXT}`,
        value: `0.42 ${INJECTED_TEXT}`,
      }],
    }],
    actionItems: [{
      optionId: "improvement-center-mean",
      title: `Center ${INJECTED_TEXT}`,
      narrative: `Action ${INJECTED_TEXT}`,
      meanCenteringAdjustment: {
        current: `+0.03 ${INJECTED_TEXT}`,
        recommended: `0 ${INJECTED_TEXT}`,
        adjustment: `-0.03 toward LSL ${INJECTED_TEXT}`,
      },
      outcome: {
        label: `Expected result ${INJECTED_TEXT}`,
        value: `Mean 0 ${INJECTED_TEXT}`,
        context: `after applying the recommended adjustment ${INJECTED_TEXT}`,
      },
    }, {
      optionId: "improvement-relax-final-specification",
      title: `Relax ${INJECTED_TEXT}`,
      narrative: `Fallback ${INJECTED_TEXT}`,
      specificationAdjustment: {
        lower: {
          current: `-0.1 ${INJECTED_TEXT}`,
          recommended: `-0.37 ${INJECTED_TEXT}`,
          adjustment: `-0.27 ${INJECTED_TEXT}`,
        },
        upper: {
          current: `0.1 ${INJECTED_TEXT}`,
          recommended: `0.43 ${INJECTED_TEXT}`,
          adjustment: `+0.33 ${INJECTED_TEXT}`,
        },
      },
      outcome: {
        label: `Expected result ${INJECTED_TEXT}`,
        value: `Cpk 1.33 ${INJECTED_TEXT}`,
        context: `after applying both recommended limits ${INJECTED_TEXT}`,
      },
    }],
    contributors: [{
      factorName: `Factor ${INJECTED_TEXT}`,
      reference: `G10 ${INJECTED_TEXT}`,
      designNominal: 1,
      upperTolerance: 0.2,
      lowerTolerance: -0.2,
      contributionPercent: 62.5,
      cumulativePercent: 62.5,
    }, {
      factorName: `Second ${INJECTED_TEXT}`,
      reference: `G11 ${INJECTED_TEXT}`,
      designNominal: 2,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      contributionPercent: 37.5,
      cumulativePercent: 100,
    }],
    processGuidanceContext: `Evaluated ${INJECTED_TEXT}`,
    processGuidance: [{
      state: "warning",
      title: `Review ${INJECTED_TEXT}`,
      message: `Process ${INJECTED_TEXT}`,
    }],
    engineeringEvidence: {
      factorSetup: {
        rows: [{
          itemNumber: 1,
          factorName: "C-cover height",
          designNominal: -1.94,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
          mean: -1.94,
          tolerance: 0.1,
          oneSigma: 0.025,
          contributionPercent: 100,
        }],
        footer: {
          designNominalTotal: -1.94,
          upperWorstCaseTolerance: 0.1,
          lowerWorstCaseTolerance: -0.1,
          meanResponse: -1.94,
          rssTolerance: 0.1,
          rssSigma: 0.025,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: -1.94,
        },
      },
      dimensionChain: {
        status: "generated",
        sourceSignature: JSON.stringify({
          workbookName: "Workbook source",
          worksheetName: "Anonymous_TA",
          factorIds: [HASH_B],
        }),
        orientation: "horizontal",
        factors: [{
          id: HASH_B,
          itemNumber: 1,
          name: "C-cover height",
          designNominal: -1.94,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        }],
        manualLayout: {
          boundaryOffsets: { [`${HASH_B}::${HASH_B}`]: 0 },
          laneOffsets: { [HASH_B]: 0 },
          closureStartOffset: 0,
          closureEndOffset: 0,
          closureLaneOffset: 0,
        },
        reversedFactorIds: [HASH_B],
        closureDirection: "start-to-end",
      },
      responseDistribution: {
        mean: -1.94,
        standardDeviation: 0.025,
        lowerSpecLimit: -2.04,
        upperSpecLimit: -1.84,
        target: -1.94,
      },
      responseSummary: {
        rssAndWorstCase: {
          sigmaBands: [{ sigma: 1, tolerance: 0.025, upper: -1.915, lower: -1.965 }],
          worstCase: { tolerance: 0.1, upper: -1.84, lower: -2.04 },
        },
        responseAndSpecifications: {
          designNominal: -1.94,
          meanResponse: -1.94,
          additionalMeanShift: 0,
          adjustedMean: -1.94,
          lowerSpecLimit: -2.04,
          upperSpecLimit: -1.84,
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
          lowerDpm: 31.67,
          upperDpm: 31.67,
          totalDpm: 63.34,
          outOfSpecPercent: 0.006334,
          yieldPercent: 99.993666,
          volume: 1000,
          failuresOverVolume: 0,
        },
      },
    },
  };
}

function representativeCurrentUiRequest(): AssumptionResultsPdfRouteRequest {
  const request = validRequest();
  return {
    ...request,
    summaryRows: Array.from({ length: 6 }, (_, index) => ({
      ...request.summaryRows[0],
      metric: `Summary metric ${index + 1}`,
    })),
    rootCauseItems: [
      request.rootCauseItems[0],
      {
        ...request.rootCauseItems[0],
        title: "Mean shift hypothesis",
        quantitativeEvidence: [
          { label: "Mean offset", value: "+0.03" },
          { label: "Cp-Cpk gap", value: "0.42" },
        ],
      },
    ],
    actionItems: [
      request.actionItems[0],
      {
        optionId: "improvement-reduce-variation",
        title: "Reduce total variation",
        narrative: "Reduce total variation after representative evidence confirms the modeled shortfall.",
      },
      {
        optionId: "improvement-reduce-contributor",
        title: "Reduce the dominant contributor",
        narrative: "Prioritize the leading contributor after validating its measured distribution.",
      },
      request.actionItems[1],
    ],
    contributors: Array.from({ length: 7 }, (_, index) => ({
      factorName: `Factor ${index + 1}`,
      reference: `G${index + 10}`,
      designNominal: Number((1 + index / 10).toFixed(2)),
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      contributionPercent: Number((100 / 7).toFixed(2)),
      cumulativePercent: index === 6 ? 100 : Number(((index + 1) * 100 / 7).toFixed(2)),
    })),
    processGuidance: [
      request.processGuidance[0],
      {
        state: "guidance",
        title: "Confirm measurement readiness",
        message: "Collect representative measured samples before replacing assumption-based distributions.",
      },
      {
        state: "guidance",
        title: "Record the release decision",
        message: "Document the approved response and evidence in the governed engineering record.",
      },
    ],
  };
}

function outputPathFrom(args: readonly string[]): string {
  const flag = args.find((arg) => arg.startsWith("--print-to-pdf="));
  if (flag === undefined) throw new Error("Missing print-to-pdf flag.");
  return flag.slice("--print-to-pdf=".length);
}

async function expectMissing(path: string): Promise<void> {
  await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
}

describe("assumption results PDF contract", () => {
  it("accepts additionalMeanShift within ±1e9 and rejects out-of-bound finite values", () => {
    const request = validRequest();
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        factorSetup: {
          ...request.engineeringEvidence.factorSetup,
          footer: {
            ...request.engineeringEvidence.factorSetup.footer,
            additionalMeanShift: 1_000_000_000,
          },
        },
      },
    }).success).toBe(true);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          responseAndSpecifications: {
            ...request.engineeringEvidence.responseSummary.responseAndSpecifications,
            additionalMeanShift: -1_000_000_000,
          },
        },
      },
    }).success).toBe(true);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        factorSetup: {
          ...request.engineeringEvidence.factorSetup,
          footer: {
            ...request.engineeringEvidence.factorSetup.footer,
            additionalMeanShift: 1_000_000_000.000_001,
          },
        },
      },
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          responseAndSpecifications: {
            ...request.engineeringEvidence.responseSummary.responseAndSpecifications,
            additionalMeanShift: -1_000_000_000.000_001,
          },
        },
      },
    }).success).toBe(false);
  });

  it("accepts only bounded structured data with finite contributor numbers", () => {
    expect(assumptionResultsPdfRouteRequestSchema.safeParse(validRequest()).success).toBe(true);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      unexpectedHtml: "<strong>unsafe</strong>",
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      contributors: [{ ...validRequest().contributors[0], contributionPercent: Number.NaN }],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      summaryRows: Array.from({ length: 21 }, () => validRequest().summaryRows[0]),
    }).success).toBe(false);
  });

  it("rejects unbounded or unsupported structured interpretation fields", () => {
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      resultJudgment: { status: "unknown", headline: "Unsupported" },
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      rootCauseItems: [{
        ...validRequest().rootCauseItems[0],
        quantitativeEvidence: Array.from({ length: 31 }, (_, index) => ({
          label: `Evidence ${index}`,
          value: String(index),
        })),
      }],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      actionItems: [{
        title: "Unsupported action",
        narrative: "Unsupported action narrative.",
        optionId: "arbitrary-action",
      }],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      engineeringEvidence: {
        ...validRequest().engineeringEvidence,
        dimensionChain: {
          ...validRequest().engineeringEvidence.dimensionChain,
          sourceSignature: "not-json-signature",
        },
      },
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      engineeringEvidence: {
        ...validRequest().engineeringEvidence,
        responseSummary: {
          ...validRequest().engineeringEvidence.responseSummary,
          defectsPerMillion: {
            ...validRequest().engineeringEvidence.responseSummary.defectsPerMillion,
            failuresOverVolume: -0.01,
          },
        },
      },
    }).success).toBe(false);
  });

  it("enforces the optionId-discriminated adjustment and outcome contract", () => {
    const request = validRequest();
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      actionItems: [{
        optionId: "improvement-reduce-variation",
        title: "Reduce variation",
        narrative: "Reduce variation at the dominant contributor.",
      }],
    }).success).toBe(true);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      actionItems: [{
        optionId: "improvement-center-mean",
        title: "Center mean",
        narrative: "Center the process mean.",
      }],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      actionItems: [{
        optionId: "improvement-relax-final-specification",
        title: "Relax specification",
        narrative: "Relax the final specification.",
        specificationAdjustment: request.actionItems[1]?.specificationAdjustment,
      }],
    }).success).toBe(false);
  });

  it("rejects contributor percentages outside zero through one hundred", () => {
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      contributors: [{
        ...validRequest().contributors[0],
        contributionPercent: -0.01,
        cumulativePercent: 100.01,
      }],
    }).success).toBe(false);
  });

  it("rejects decreasing cumulative contributor percentages", () => {
    const contributor = validRequest().contributors[0];
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      contributors: [
        { ...contributor, cumulativePercent: 60 },
        { ...contributor, factorName: "Factor B", cumulativePercent: 59.99 },
      ],
    }).success).toBe(false);
  });

  it("accepts required engineeringEvidence and rejects strict invalid variants", () => {
    const request = validRequest();
    expect(assumptionResultsPdfRouteRequestSchema.safeParse(request).success).toBe(true);

    const webSourceSignature = JSON.stringify({
      workbookName: request.workbookName,
      worksheetName: request.worksheetName,
      factorIds: request.engineeringEvidence.dimensionChain.status === "generated"
        ? request.engineeringEvidence.dimensionChain.factors.map((factor) => factor.id)
        : [],
      orientation: request.engineeringEvidence.dimensionChain.status === "generated"
        ? request.engineeringEvidence.dimensionChain.orientation
        : "fallback",
    });
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        dimensionChain: {
          ...request.engineeringEvidence.dimensionChain,
          sourceSignature: webSourceSignature,
        },
      },
    }).success).toBe(true);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        factorSetup: {
          ...request.engineeringEvidence.factorSetup,
          rows: Array.from({ length: 101 }, (_, index) => ({
            ...request.engineeringEvidence.factorSetup.rows[0],
            itemNumber: index + 1,
            factorName: `Factor ${index + 1}`,
          })),
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseDistribution: {
          ...request.engineeringEvidence.responseDistribution,
          standardDeviation: Number.POSITIVE_INFINITY,
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          sigmaLevelAndCapability: {
            ...request.engineeringEvidence.responseSummary.sigmaLevelAndCapability,
            cp: { value: Number.NaN, status: "PASS" },
          },
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseDistribution: {
          ...request.engineeringEvidence.responseDistribution,
          svg: "<svg></svg>",
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        dimensionChain: {
          ...(request.engineeringEvidence.dimensionChain.status === "generated"
            ? request.engineeringEvidence.dimensionChain
            : {
              status: "generated" as const,
              sourceSignature: HASH_A,
              orientation: "horizontal" as const,
              factors: [],
              manualLayout: { boundaryOffsets: {}, laneOffsets: {} },
              reversedFactorIds: [],
              closureDirection: "start-to-end" as const,
            }),
          manualLayout: {
            ...(request.engineeringEvidence.dimensionChain.status === "generated"
              ? request.engineeringEvidence.dimensionChain.manualLayout
              : { boundaryOffsets: {}, laneOffsets: {} }),
            boundaryOffsets: { [`${HASH_B}::${HASH_B}`]: 10001 },
          },
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          rssAndWorstCase: request.engineeringEvidence.responseSummary.rssAndWorstCase,
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          defectsPerMillion: {
            ...request.engineeringEvidence.responseSummary.defectsPerMillion,
            volume: -1,
          },
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          defectsPerMillion: {
            ...request.engineeringEvidence.responseSummary.defectsPerMillion,
            volume: 1.5,
          },
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          defectsPerMillion: {
            ...request.engineeringEvidence.responseSummary.defectsPerMillion,
            failuresOverVolume: 12.75,
          },
        },
      },
    }).success).toBe(true);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          defectsPerMillion: {
            ...request.engineeringEvidence.responseSummary.defectsPerMillion,
            failuresOverVolume: 250000,
          },
        },
      },
    }).success).toBe(true);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          defectsPerMillion: {
            ...request.engineeringEvidence.responseSummary.defectsPerMillion,
            failuresOverVolume: Number.NaN,
          },
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        responseSummary: {
          ...request.engineeringEvidence.responseSummary,
          defectsPerMillion: {
            ...request.engineeringEvidence.responseSummary.defectsPerMillion,
            failuresOverVolume: Number.POSITIVE_INFINITY,
          },
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        dimensionChain: {
          ...request.engineeringEvidence.dimensionChain,
          status: "invalid-discriminator",
        },
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        imageUrl: "https://example.invalid/image.png",
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        dataUrl: "data:text/plain;base64,Zm9v",
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        path: "C:/tmp/unsafe",
      },
    }).success).toBe(false);
  });

  it("builds a filesystem-safe PDF download name", () => {
    expect(safePdfDownloadFileName("Design<>.xlsx", "TA / Result"))
      .toBe("Design-TA-Result-assumption-results.pdf");
  });

  it("builds an ASCII fallback without splitting Unicode surrogate pairs", () => {
    const fileName = safePdfDownloadFileName(
      `Design-${"😀".repeat(100)}-装配.xlsx`,
      "结果-📈-TA",
    );

    expect(fileName).toMatch(/^[\x20-\x7e]+$/);
    expect(fileName.length).toBeLessThanOrEqual(180);
    expect(fileName).not.toMatch(/[\uD800-\uDFFF]/u);
    expect(fileName).toBe("Design-TA-assumption-results.pdf");
  });

  it("builds a safe Unicode PDF name from workbook and worksheet names", () => {
    expect(safeUnicodePdfDownloadFileName(
      "Design \"装配\"/😀.xlsx",
      "TA\\结果\u0000?",
    )).toBe("Design-装配-😀-TA-结果-assumption-results.pdf");
  });

  it("limits a Unicode PDF name without splitting a surrogate pair", () => {
    const fileName = safeUnicodePdfDownloadFileName(
      `Design-${"😀".repeat(100)}.xlsx`,
      "结果",
    );

    expect(fileName.length).toBeLessThanOrEqual(180);
    expect(fileName).not.toMatch(/[\uD800-\uDFFF]$/u);
    expect(fileName).toMatch(/-assumption-results\.pdf$/u);
  });

  it("encodes a Unicode filename as an RFC5987 UTF-8 value", () => {
    expect(encodeRfc5987FileName("装配😀 results'()*.pdf"))
      .toBe("%E8%A3%85%E9%85%8D%F0%9F%98%80%20results%27%28%29%2A.pdf");
  });
});

describe("renderAssumptionResultsPdfHtml", () => {
  it("renders exactly three pages in strict evidence/decision/action order with explicit page breaks", () => {
    const html = renderAssumptionResultsPdfHtml(validRequest());

    const pages = [...html.matchAll(/class="report-page report-page--([a-z-]+)"/g)].map((match) => match[1]);
    expect(pages).toEqual(["evidence", "decision", "action"]);
    expect(pages).toHaveLength(3);

    const evidenceStart = html.indexOf('class="report-page report-page--evidence"');
    const decisionStart = html.indexOf('class="report-page report-page--decision"');
    const actionStart = html.indexOf('class="report-page report-page--action"');
    expect(evidenceStart).toBeGreaterThan(-1);
    expect(decisionStart).toBeGreaterThan(evidenceStart);
    expect(actionStart).toBeGreaterThan(decisionStart);

    expect(html).toMatch(/\.report-page--evidence\s*{[^}]*break-after:\s*page;/);
    expect(html).toMatch(/\.report-page--action\s*{[^}]*break-before:\s*page;/);
  });

  it("uses compact page-two grids for a representative current UI payload", () => {
    const html = renderAssumptionResultsPdfHtml(representativeCurrentUiRequest());
    const nonEvidenceHtml = html.replace(/<div class="report-page report-page--evidence">[\s\S]*?<div class="report-page report-page--decision">/, "<div class=\"report-page report-page--decision\">");

    expect(nonEvidenceHtml.match(/<tr>/g)).toHaveLength(20);
    expect(html.match(/data-pareto-bar/g)).toHaveLength(7);
    expect(html).toMatch(/<div class="report-page report-page--decision">/);
    expect(html).toMatch(/<div class="report-page report-page--action">/);
    expect(html).toMatch(/<ol class="narrative-list action-grid">[\s\S]*?<\/ol>/);
    expect(html).toMatch(/<div class="priority-grid">[\s\S]*?data-pareto-chart[\s\S]*?<table class="priority-table">/);
    expect(html).toMatch(/<ol class="narrative-list guidance-grid">[\s\S]*?<\/ol>/);
    expect(html).toMatch(/\.action-grid\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,/);
    expect(html).toMatch(/\.priority-grid\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, \.78fr\) minmax\(0, 1\.22fr\);/);
    expect(html).toMatch(/\.guidance-grid\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,/);
    expect(html).toMatch(/\.priority-table\s*{[^}]*font-size:\s*8pt;/);
    expect(html).toMatch(/html\s*{[^}]*font-size:\s*8pt;/);
    expect(html).not.toMatch(/overflow:\s*hidden;/);
  });

  it("defines page-one evidence printable box and compact readable 2x2 response summary structure", () => {
    const html = renderAssumptionResultsPdfHtml(representativeCurrentUiRequest());

    expect(html).toMatch(/\.report-page--evidence\s*{[^}]*height:\s*180mm;[^}]*box-sizing:\s*border-box;[^}]*display:\s*grid;[^}]*grid-template-rows:\s*76mm\s+minmax\(0,\s*1fr\);[^}]*gap:\s*2mm;[^}]*break-after:\s*page;/);
    expect(html).not.toMatch(/\.report-page--evidence\s*{[^}]*overflow:\s*visible;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.evidence-top\s*{[^}]*min-height:\s*0;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.evidence-lower-grid\s*{[^}]*min-height:\s*0;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.evidence-right-stack\s*{[^}]*display:\s*grid;[^}]*min-height:\s*0;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.evidence-panel\s*{[^}]*padding:\s*2mm;[^}]*min-height:\s*0;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.factor-setup-panel\s+table\s*{[^}]*table-layout:\s*fixed;[^}]*font-size:\s*7\.4pt;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.response-summary-grid\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(html).toMatch(/\.report-page--evidence\s+\.response-summary-grid\s*>\s*\.response-summary-table\s*{[^}]*margin-top:\s*0;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.response-summary-table\s+th,\s*\.report-page--evidence\s+\.response-summary-table\s+td\s*{[^}]*padding:\s*0\.9mm\s+1\.2mm;[^}]*line-height:\s*1\.2;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.response-summary-table\s*{[^}]*font-size:\s*7\.6pt;/);
    expect(html).toMatch(/<div class="response-summary-grid">[\s\S]*?<table class="response-summary-table">[\s\S]*?RSS and Worst Case[\s\S]*?<table class="response-summary-table">[\s\S]*?Response and Specifications[\s\S]*?<table class="response-summary-table">[\s\S]*?Sigma Level and Capability[\s\S]*?<table class="response-summary-table">[\s\S]*?Defects Per Million[\s\S]*?<\/div>/);
  });

  it("renders an escaped, self-contained A4 landscape report with all required sections", () => {
    const html = renderAssumptionResultsPdfHtml(validRequest());

    const reportPageGroups = [...html.matchAll(/class="report-page report-page--(decision|action)"/g)].map((match) => match[1]);
    expect(reportPageGroups).toEqual(["decision", "action"]);
    expect(reportPageGroups).toHaveLength(2);

    const decisionPageMatch = html.match(/<div class="report-page report-page--decision">([\s\S]*?)<\/div>\s*<div class="report-page report-page--action">/);
    expect(decisionPageMatch).not.toBeNull();
    const decisionPage = decisionPageMatch?.[1] ?? "";
    const decisionOrder = [
      "TA Results Interpretation (based on Assumptions)",
      '<div class="source">',
      "TA Result Summary",
      "Overall Assessment",
      "Root Cause Analysis",
    ];
    let lastDecisionIndex = -1;
    for (const marker of decisionOrder) {
      const markerIndex = decisionPage.indexOf(marker);
      expect(markerIndex).toBeGreaterThan(lastDecisionIndex);
      lastDecisionIndex = markerIndex;
    }

    const actionPageMatch = html.match(/<div class="report-page report-page--action">([\s\S]*?)<\/div>\s*<\/main>/);
    expect(actionPageMatch).not.toBeNull();
    const actionPage = actionPageMatch?.[1] ?? "";
    const actionOrder = [
      "Suggested Action Sequence",
      "Tolerance Adjustment Priority",
      "TA Process and Requirements",
    ];
    let lastActionIndex = -1;
    for (const marker of actionOrder) {
      const markerIndex = actionPage.indexOf(marker);
      expect(markerIndex).toBeGreaterThan(lastActionIndex);
      lastActionIndex = markerIndex;
    }
    expect(actionPage).toContain("data-pareto-chart");
    expect(actionPage).toContain("<th>Priority</th>");

    expect(html).toContain("TA Result Summary");
    expect(html).toContain("Comparison &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Capability &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("below-target");
    expect(html).toContain("Overall Assessment");
    expect(html).toContain("Root Cause Analysis");
    expect(html).toContain("State: hypothesis · Incomplete evidence");
    expect(html).toContain("Cp-Cpk gap &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("0.42 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Suggested Action Sequence");
    expect(html).toContain("improvement-center-mean");
    expect(html).toContain("Required mean change");
    expect(html).toContain("-0.03 toward LSL &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Mean 0 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("after applying the recommended adjustment &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Required specification change");
    expect(html).toContain("-0.37 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("+0.33 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Cpk 1.33 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("after applying both recommended limits &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Tolerance Adjustment Priority");
    expect(html).toContain("Evaluated &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("TA Process and Requirements");
    expect(html).toContain("Factor &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("<td>1</td>");
    expect(html).toContain("<td>-0.2</td>");
    expect(html).toContain("<td>0.2</td>");
    expect(html).toContain("<td>62.50%</td>");
    expect(html).toContain("<th>Priority</th>");
    expect(html).toMatch(/<svg[^>]*data-pareto-chart[^>]*viewBox="0 0 760 220"/);
    expect(html).toMatch(/<rect[^>]*data-pareto-bar[^>]*data-contribution="62\.5"[^>]*x="197"[^>]*y="91"[^>]*width="46"[^>]*height="85"/);
    expect(html).toContain('<polyline data-pareto-cumulative-line points="220,91 564,40"');
    expect(html).toContain('<circle data-pareto-cumulative-point data-cumulative="100" cx="564" cy="40"');
    expect(html).toContain("% Cont. to σ");
    expect(html).toContain("Cumulative %");
    expect(html).toMatch(/@page\s*{[^}]*size:\s*A4 landscape;/);
    expect(html).toMatch(/thead\s*{[^}]*display:\s*table-header-group;/);
    expect(html).toMatch(/\.pareto-chart\s*{[^}]*break-inside:\s*avoid;/);
    expect(html).toMatch(/\.report-page--action\s*{[^}]*break-before:\s*page;/);
    expect(html).toContain("Workbook &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis.xlsx");
    expect(html).not.toContain(INJECTED_TEXT);
    expect(html).not.toMatch(/<script|<img|https?:\/\//i);
  });

  it("adds print-safe wrapping rules for long report text", () => {
    const html = renderAssumptionResultsPdfHtml(validRequest());

    expect(html).toMatch(/html\s*{[^}]*overflow-wrap:\s*anywhere;/);
    expect(html).toMatch(/\.source\s*{[^}]*flex-wrap:\s*wrap;[^}]*min-width:\s*0;/);
    expect(html).toMatch(/\.source\s*>\s*span\s*{[^}]*min-width:\s*0;/);
    expect(html).toMatch(/th, td\s*{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/);
    expect(html).toMatch(/\.pareto-chart\s+svg\s*{[^}]*max-width:\s*100%;/);
  });

  it("sets explicit decision page break-before while preserving action page break-before", () => {
    const html = renderAssumptionResultsPdfHtml(validRequest());

    expect(html).toMatch(/\.report-page--decision\s*{[^}]*break-before:\s*page;/);
    expect(html).toMatch(/\.report-page--action\s*{[^}]*break-before:\s*page;/);
    expect(html).toMatch(/\.report-page--evidence\s*{[^}]*height:\s*180mm;[^}]*box-sizing:\s*border-box;[^}]*display:\s*grid;[^}]*grid-template-rows:\s*76mm\s+minmax\(0,\s*1fr\);[^}]*gap:\s*2mm;[^}]*break-after:\s*page;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.evidence-top\s*{[^}]*min-height:\s*0;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.evidence-lower-grid\s*{[^}]*display:\s*grid;[^}]*min-height:\s*0;/);
    expect(html).toMatch(/\.report-page--evidence\s+\.response-summary-grid\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(html).toMatch(/\.report-page--evidence\s+\.response-summary-table\s*{[^}]*font-size:\s*7\.6pt;/);
  });

  it("keeps evidence page direct children as evidence-top and evidence-lower-grid, with 7 body rows and 2 footer rows", () => {
    const request = representativeCurrentUiRequest();
    const sevenRows = Array.from({ length: 7 }, (_, index) => ({
      itemNumber: index + 1,
      factorName: `Factor ${index + 1}`,
      designNominal: 1 + index,
      upperTolerance: 0.2,
      lowerTolerance: -0.2,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      distribution: "Normal" as const,
      mean: 1 + index,
      tolerance: 0.2,
      oneSigma: 0.05,
      contributionPercent: Number((100 / 7).toFixed(2)),
    }));
    const html = renderAssumptionResultsPdfHtml({
      ...request,
      engineeringEvidence: {
        ...request.engineeringEvidence,
        factorSetup: {
          ...request.engineeringEvidence.factorSetup,
          rows: sevenRows,
        },
      },
    });
    const evidencePageMatch = html.match(/<div class="report-page report-page--evidence">([\s\S]*?)<div class="report-page report-page--decision">/);
    expect(evidencePageMatch).not.toBeNull();
    const evidencePage = evidencePageMatch?.[1] ?? "";

    expect(evidencePage).toMatch(/^\s*<div class="evidence-top">[\s\S]*?<\/div>\s*<div class="evidence-lower-grid">[\s\S]*?<\/div>\s*$/);
    const factorSetupTable = evidencePage.match(/<section class="factor-setup-panel">[\s\S]*?<table>[\s\S]*?<\/table>/)?.[0] ?? "";
    expect((factorSetupTable.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr>/g) ?? []).length).toBe(7);
    expect((evidencePage.match(/<tfoot>[\s\S]*?<\/tfoot>/)?.[0].match(/<tr/g) ?? []).length).toBe(2);
    expect(evidencePage).toContain("data-footer-core-total");
    expect(evidencePage).toContain("data-footer-derived-total");
    expect(evidencePage).toContain("data-footer-field=\"design-nominal-total\"");
    expect(evidencePage).toContain("data-footer-field=\"upper-worst-case-tolerance\"");
    expect(evidencePage).toContain("data-footer-field=\"lower-worst-case-tolerance\"");
    expect(evidencePage).toContain("data-footer-field=\"contribution-total\"");
    expect(evidencePage).toContain("data-footer-field=\"mean-response\"");
    expect(evidencePage).toContain("data-footer-field=\"rss-tolerance\"");
    expect(evidencePage).toContain("data-footer-field=\"rss-sigma\"");
    expect(evidencePage).toContain("data-footer-field=\"additional-mean-shift\"");
    expect(evidencePage).toContain("data-footer-field=\"adjusted-mean\"");
  });
});

describe("createAssumptionResultsPdfRenderer", () => {
  it("prints through an isolated Playwright browser and closes it", async () => {
    const page = {
      goto: vi.fn(async () => undefined),
      pdf: vi.fn(async () => undefined),
    };
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    };
    const launchBrowser = vi.fn(async () => browser);

    await executePdfBrowser(
      "browser.exe",
      ["--disable-extensions", "--print-to-pdf=C:\\temp\\report.pdf", "file:///C:/temp/report.html"],
      launchBrowser as never,
      5_000,
    );

    expect(launchBrowser).toHaveBeenCalledWith({
      executablePath: "browser.exe",
      headless: true,
      args: ["--disable-extensions"],
      timeout: 5_000,
    });
    expect(page.goto).toHaveBeenCalledWith("file:///C:/temp/report.html", {
      waitUntil: "load",
      timeout: expect.any(Number),
    });
    const gotoTimeout = page.goto.mock.calls[0]?.[1].timeout ?? 0;
    expect(gotoTimeout).toBeGreaterThan(0);
    expect(gotoTimeout).toBeLessThanOrEqual(5_000);
    expect(page.pdf).toHaveBeenCalledWith({
      path: "C:\\temp\\report.pdf",
      preferCSSPageSize: true,
      printBackground: true,
    });
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("propagates a Playwright browser launch failure", async () => {
    const launchBrowser = vi.fn(async () => { throw new Error("launch failed"); });

    await expect(executePdfBrowser(
      "browser.exe",
      ["--print-to-pdf=C:\\temp\\report.pdf", "file:///C:/temp/report.html"],
      launchBrowser,
    )).rejects.toThrow("launch failed");
  });

  it("times out a stalled Playwright browser launch", async () => {
    const launchBrowser = vi.fn(async () => await new Promise<never>(() => undefined));

    await expect(executePdfBrowser(
      "browser.exe",
      ["--print-to-pdf=C:\\temp\\report.pdf", "file:///C:/temp/report.html"],
      launchBrowser,
      10,
    )).rejects.toThrow("PDF browser timed out after 10 ms.");
  });

  it.each([
    "file://server/share/report.html",
    "file:////server/share/report.html",
  ])("rejects a remote file URL: %s", async (remoteUrl) => {
    const launchBrowser = vi.fn();

    await expect(executePdfBrowser(
      "browser.exe",
      ["--print-to-pdf=C:\\temp\\report.pdf", remoteUrl],
      launchBrowser,
    )).rejects.toThrow("PDF browser requires controlled output and local source paths.");
    expect(launchBrowser).not.toHaveBeenCalled();
  });

  it("handles a close failure from a browser that resolves after launch timeout", async () => {
    let resolveLaunch: ((browser: PdfBrowserFixture) => void) | undefined;
    type PdfBrowserFixture = {
      newPage(): Promise<never>;
      close(): Promise<void>;
    };
    const launchBrowser = vi.fn(async () => await new Promise<PdfBrowserFixture>((resolve) => {
      resolveLaunch = resolve;
    }));
    const browser = {
      newPage: vi.fn(async () => await new Promise<never>(() => undefined)),
      close: vi.fn(async () => { throw new Error("late close failed"); }),
    };

    await expect(executePdfBrowser(
      "browser.exe",
      ["--print-to-pdf=C:\\temp\\report.pdf", "file:///C:/temp/report.html"],
      launchBrowser,
      10,
    )).rejects.toThrow("PDF browser timed out after 10 ms.");
    resolveLaunch?.(browser);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("closes the Playwright browser when PDF generation fails", async () => {
    const browser = {
      newPage: vi.fn(async () => ({
        goto: vi.fn(async () => undefined),
        pdf: vi.fn(async () => { throw new Error("pdf failed"); }),
      })),
      close: vi.fn(async () => undefined),
    };

    await expect(executePdfBrowser(
      "browser.exe",
      ["--print-to-pdf=C:\\temp\\report.pdf", "file:///C:/temp/report.html"],
      vi.fn(async () => browser),
    )).rejects.toThrow("pdf failed");
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("times out a stalled Playwright PDF operation and closes the browser", async () => {
    const browser = {
      newPage: vi.fn(async () => ({
        goto: vi.fn(async () => undefined),
        pdf: vi.fn(async () => await new Promise<never>(() => undefined)),
      })),
      close: vi.fn(async () => undefined),
    };

    await expect(executePdfBrowser(
      "browser.exe",
      ["--print-to-pdf=C:\\temp\\report.pdf", "file:///C:/temp/report.html"],
      vi.fn(async () => browser),
      10,
    )).rejects.toThrow("PDF browser timed out after 10 ms.");
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("does not wait indefinitely for Playwright browser close", async () => {
    const browser = {
      newPage: vi.fn(async () => ({
        goto: vi.fn(async () => undefined),
        pdf: vi.fn(async () => undefined),
      })),
      close: vi.fn(async () => await new Promise<never>(() => undefined)),
    };

    await expect(executePdfBrowser(
      "browser.exe",
      ["--print-to-pdf=C:\\temp\\report.pdf", "file:///C:/temp/report.html"],
      vi.fn(async () => browser),
      10,
    )).resolves.toBeUndefined();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("preserves the PDF error when browser close also fails", async () => {
    const browser = {
      newPage: vi.fn(async () => ({
        goto: vi.fn(async () => undefined),
        pdf: vi.fn(async () => { throw new Error("pdf failed"); }),
      })),
      close: vi.fn(async () => { throw new Error("close failed"); }),
    };

    await expect(executePdfBrowser(
      "browser.exe",
      ["--print-to-pdf=C:\\temp\\report.pdf", "file:///C:/temp/report.html"],
      vi.fn(async () => browser),
    )).rejects.toThrow("pdf failed");
  });

  it("retries removal of the temporary directory", async () => {
    const removeDirectory = vi.fn(async (
      path: string,
      options: Parameters<typeof rm>[1],
    ) => rm(path, options));
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async (_executable, args) => {
        await writeFile(outputPathFrom(args), Buffer.from("%PDF-1.7\nfixture"));
      },
      removeDirectory,
    });

    await renderer.render(validRequest());

    expect(removeDirectory).toHaveBeenCalledOnce();
    expect(removeDirectory.mock.calls[0]?.[1]).toEqual({
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  });

  it("runs one render at a time, queues three in order, and rejects excess work", async () => {
    const releaseRender: Array<() => Promise<void>> = [];
    const temporaryDirectories: string[] = [];
    const executionOrder: string[] = [];
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async (_executable, args) => {
        const htmlPath = fileURLToPath(args.at(-1) ?? "");
        const temporaryDirectory = dirname(htmlPath);
        const html = await readFile(htmlPath, "utf8");
        executionOrder.push(/Workbook (\d)\.xlsx/u.exec(html)?.[1] ?? "unknown");
        temporaryDirectories.push(temporaryDirectory);
        await new Promise<void>((resolve) => {
          releaseRender.push(async () => {
            await writeFile(outputPathFrom(args), Buffer.from("%PDF-1.7\nfixture"));
            resolve();
          });
        });
      },
    });

    const renders = Array.from({ length: 4 }, (_, index) => renderer.render({
      ...validRequest(),
      sessionId: `session-${index + 1}`,
      workbookName: `Workbook ${index + 1}.xlsx`,
    }));
    await vi.waitFor(() => expect(executionOrder).toHaveLength(1));

    await expect(renderer.render({
      ...validRequest(),
      sessionId: "session-over-limit",
    })).rejects.toBeInstanceOf(AssumptionResultsPdfQueueFullError);

    for (let index = 0; index < renders.length; index += 1) {
      expect(executionOrder).toHaveLength(index + 1);
      await releaseRender[index]?.();
      await expect(renders[index]).resolves.toEqual(expect.any(Buffer));
      if (index + 1 < renders.length) {
        await vi.waitFor(() => expect(executionOrder).toHaveLength(index + 2));
      }
    }

    expect(new Set(temporaryDirectories).size).toBe(4);
    expect(executionOrder).toEqual(["1", "2", "3", "4"]);
    for (const directory of temporaryDirectories) await expectMissing(directory);
  });

  it("releases the active slot after failure so the next queued render continues", async () => {
    let rejectFirst: ((error: Error) => void) | undefined;
    let executionCount = 0;
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async (_executable, args) => {
        executionCount += 1;
        if (executionCount === 1) {
          await new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
          return;
        }
        await writeFile(outputPathFrom(args), Buffer.from("%PDF-1.7\nfixture"));
      },
    });

    const failedRender = renderer.render(validRequest());
    const queuedRender = renderer.render({ ...validRequest(), sessionId: "session-queued" });
    await vi.waitFor(() => expect(executionCount).toBe(1));
    rejectFirst?.(new Error("browser failed"));

    await expect(failedRender).rejects.toThrow("browser failed");
    await expect(queuedRender).resolves.toEqual(expect.any(Buffer));
    expect(executionCount).toBe(2);
  });

  it("preserves the primary render error when cleanup also fails", async () => {
    const removeDirectory = vi.fn(async () => {
      throw new Error("cleanup failed");
    });
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async () => {
        throw new Error("browser failed");
      },
      removeDirectory,
    });

    await expect(renderer.render(validRequest())).rejects.toThrow("browser failed");
    expect(removeDirectory).toHaveBeenCalledOnce();
  });

  it("reports when no controlled browser is installed", async () => {
    const executeFile = vi.fn(async () => undefined);
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => [],
      executeFile,
    });

    await expect(renderer.render(validRequest())).rejects.toThrow(
      "No supported local Microsoft Edge or Google Chrome installation was found.",
    );
    expect(executeFile).not.toHaveBeenCalled();
  });

  it("reports when the browser produces no PDF output", async () => {
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async () => undefined,
    });

    await expect(renderer.render(validRequest())).rejects.toThrow(
      "Browser did not produce a PDF document.",
    );
  });

  it("rejects browser output without a PDF signature", async () => {
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async (_executable, args) => {
        await writeFile(outputPathFrom(args), Buffer.from("not-a-pdf"));
      },
    });

    await expect(renderer.render(validRequest())).rejects.toThrow(
      "Browser output is not a valid PDF document.",
    );
  });

  it("prints with controlled browser flags, validates the PDF, and removes temporary files", async () => {
    let htmlPath = "";
    let pdfPath = "";
    let temporaryDirectory = "";
    const executeFile = vi.fn(async (_executable: string, args: readonly string[]) => {
      pdfPath = outputPathFrom(args);
      htmlPath = fileURLToPath(args.at(-1) ?? "");
      temporaryDirectory = dirname(htmlPath);
      await writeFile(pdfPath, Buffer.from("%PDF-1.7\nfixture"));
    });
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"],
      executeFile,
    });

    const bytes = await renderer.render(validRequest());

    expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(executeFile).toHaveBeenCalledOnce();
    expect(executeFile.mock.calls[0]?.[0]).toBe("C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe");
    expect(executeFile.mock.calls[0]?.[1]).toEqual(expect.arrayContaining([
      "--headless=new",
      "--disable-background-networking",
      "--disable-extensions",
      "--disable-default-apps",
      "--no-first-run",
      "--no-pings",
    ]));
    expect(executeFile.mock.calls[0]?.[1].at(-1)).toMatch(/^file:\/\//);
    await expectMissing(htmlPath);
    await expectMissing(pdfPath);
    await expectMissing(temporaryDirectory);
  });

  it("removes temporary files when browser execution fails", async () => {
    let htmlPath = "";
    let pdfPath = "";
    let temporaryDirectory = "";
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"],
      executeFile: async (_executable, args) => {
        pdfPath = outputPathFrom(args);
        htmlPath = fileURLToPath(args.at(-1) ?? "");
        temporaryDirectory = dirname(htmlPath);
        throw new Error("browser failed");
      },
    });

    await expect(renderer.render(validRequest())).rejects.toThrow("browser failed");
    await expectMissing(htmlPath);
    await expectMissing(pdfPath);
    await expectMissing(temporaryDirectory);
  });
});