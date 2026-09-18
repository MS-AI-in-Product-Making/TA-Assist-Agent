import { describe, expect, it } from "vitest";
import type { AssumptionResultsPdfRouteRequest } from "./assumption-results-pdf-contract.js";
import { renderAssumptionResultsPdfEvidenceHtml } from "./assumption-results-pdf-evidence-renderer.js";

type EngineeringEvidence = AssumptionResultsPdfRouteRequest["engineeringEvidence"];

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function buildEvidence(overrides: Partial<EngineeringEvidence> = {}): EngineeringEvidence {
  const base: EngineeringEvidence = {
    factorSetup: {
      rows: [
        {
          itemNumber: 1,
          factorName: "A-Factor",
          designNominal: 10,
          upperTolerance: 0.3,
          lowerTolerance: -0.2,
          longTermSafetyFactor: 1.2,
          sigmaLevel: 4,
          distribution: "Normal",
          mean: 10.1,
          tolerance: 0.3,
          oneSigma: 0.075,
          contributionPercent: 55,
        },
        {
          itemNumber: 2,
          factorName: "B-Factor",
          designNominal: 12,
          upperTolerance: 0.2,
          lowerTolerance: -0.2,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Uniform",
          mean: 12,
          tolerance: 0.2,
          oneSigma: 0.05,
          contributionPercent: 45,
        },
      ],
      footer: {
        designNominalTotal: 22,
        upperWorstCaseTolerance: 0.5,
        lowerWorstCaseTolerance: -0.4,
        meanResponse: 22.1,
        rssTolerance: 0.36,
        rssSigma: 0.09,
        contributionTotalPercent: 100,
        additionalMeanShift: 0.07,
        adjustedMean: 22.17,
      },
    },
    dimensionChain: {
      status: "generated",
      sourceSignature: JSON.stringify({ workbookName: "W", worksheetName: "S", factorIds: [HASH_A, HASH_B] }),
      orientation: "horizontal",
      factors: [
        {
          id: HASH_A,
          itemNumber: 1,
          name: "A-Factor",
          designNominal: 10,
          upperTolerance: 0.3,
          lowerTolerance: -0.2,
          longTermSafetyFactor: 1.2,
          sigmaLevel: 4,
          distribution: "Normal",
        },
        {
          id: HASH_B,
          itemNumber: 2,
          name: "B-Factor",
          designNominal: 12,
          upperTolerance: 0.2,
          lowerTolerance: -0.2,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Uniform",
        },
      ],
      manualLayout: {
        boundaryOffsets: { [`${HASH_A}::${HASH_B}`]: 0 },
        laneOffsets: { [HASH_A]: 0, [HASH_B]: 0 },
        closureStartOffset: 0,
        closureEndOffset: 0,
        closureLaneOffset: 0,
      },
      reversedFactorIds: [],
      closureDirection: "start-to-end",
    },
    responseDistribution: {
      mean: 22.17,
      standardDeviation: 0.09,
      lowerSpecLimit: 21.9,
      upperSpecLimit: 22.4,
      target: 22,
    },
    responseSummary: {
      rssAndWorstCase: {
        sigmaBands: [
          { sigma: 1, tolerance: 0.09, upper: 22.26, lower: 22.08 },
          { sigma: 3, tolerance: 0.27, upper: 22.44, lower: 21.9 },
        ],
        worstCase: { tolerance: 0.5, upper: 22.6, lower: 21.7 },
      },
      responseAndSpecifications: {
        designNominal: 22,
        meanResponse: 22.1,
        additionalMeanShift: 0.07,
        adjustedMean: 22.17,
        lowerSpecLimit: 21.9,
        upperSpecLimit: 22.4,
        targetSigmaLevel: 4,
        targetCpk: 1.33,
      },
      sigmaLevelAndCapability: {
        lowerZ: { value: 3.5, status: "PASS" },
        upperZ: { value: 2.6, status: "FAIL" },
        calculatedSigmaLevel: { value: 2.6, status: "FAIL" },
        cp: { value: 0.93, status: "FAIL" },
        lowerCpk: { value: 1.2, status: "PASS" },
        upperCpk: { value: 0.87, status: "FAIL" },
        calculatedCpk: { value: 0.87, status: "FAIL" },
      },
      defectsPerMillion: {
        lowerDpm: 120,
        upperDpm: 140,
        totalDpm: 260,
        outOfSpecPercent: 0.026,
        yieldPercent: 99.974,
        volume: 100000,
        failuresOverVolume: 260,
      },
    },
  };

  return {
    ...base,
    ...overrides,
    factorSetup: {
      ...base.factorSetup,
      ...overrides.factorSetup,
      rows: overrides.factorSetup?.rows ?? base.factorSetup.rows,
      footer: {
        ...base.factorSetup.footer,
        ...overrides.factorSetup?.footer,
      },
    },
    dimensionChain: overrides.dimensionChain ?? base.dimensionChain,
    responseDistribution: {
      ...base.responseDistribution,
      ...overrides.responseDistribution,
    },
    responseSummary: {
      ...base.responseSummary,
      ...overrides.responseSummary,
      rssAndWorstCase: {
        ...base.responseSummary.rssAndWorstCase,
        ...overrides.responseSummary?.rssAndWorstCase,
        sigmaBands: overrides.responseSummary?.rssAndWorstCase?.sigmaBands
          ?? base.responseSummary.rssAndWorstCase.sigmaBands,
        worstCase: {
          ...base.responseSummary.rssAndWorstCase.worstCase,
          ...overrides.responseSummary?.rssAndWorstCase?.worstCase,
        },
      },
      responseAndSpecifications: {
        ...base.responseSummary.responseAndSpecifications,
        ...overrides.responseSummary?.responseAndSpecifications,
      },
      sigmaLevelAndCapability: {
        ...base.responseSummary.sigmaLevelAndCapability,
        ...overrides.responseSummary?.sigmaLevelAndCapability,
      },
      defectsPerMillion: {
        ...base.responseSummary.defectsPerMillion,
        ...overrides.responseSummary?.defectsPerMillion,
      },
    },
  };
}

function extractNumberAttribute(html: string, marker: string, name: string): number {
  const pattern = new RegExp(`${marker}[^>]*\\s${name}="([^"]+)"`);
  const match = html.match(pattern);
  if (!match?.[1]) throw new Error(`Missing ${name} for ${marker}`);
  return Number(match[1]);
}

function countMatches(html: string, pattern: RegExp): number {
  return [...html.matchAll(pattern)].length;
}

function parsePair(pair: string): { x: number; y: number } {
  const [xText, yText] = pair.split(",");
  return {
    x: Number.parseFloat(xText ?? "NaN"),
    y: Number.parseFloat(yText ?? "NaN"),
  };
}

function expectSamePoint(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe("renderAssumptionResultsPdfEvidenceHtml", () => {
  it("uses the captured Web visual instead of reconstructing a Dimension Chain", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence(), {
      status: "image",
      mediaType: "image/png",
      dataUrl,
      width: 1,
      height: 1,
    });

    expect(html).toContain("data-dimension-chain-visual");
    expect(html).not.toContain("<svg data-dimension-chain");
  });

  it("renders no image or reconstructed chain for an empty Web visual", () => {
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence(), { status: "empty" });

    expect(html).toContain("data-dimension-chain-visual-empty");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<svg data-dimension-chain");
  });

  it("renders fallback dimension labels from factorSetup rows", () => {
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      dimensionChain: {
        status: "fallback",
        sourceSignature: JSON.stringify({ workbookName: "W", worksheetName: "S", factorIds: [] }),
      },
    }));

    expect(html).toContain("Fallback from factorSetup rows");
    expect(html).toContain("A-Factor");
    expect(html).toContain("B-Factor");
  });

  it("uses generated orientation/manual/reversed/closure to change chain coordinates and directions", () => {
    const horizontalHtml = renderAssumptionResultsPdfEvidenceHtml(buildEvidence());
    const verticalReversedHtml = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      dimensionChain: {
        status: "generated",
        sourceSignature: JSON.stringify({ workbookName: "W", worksheetName: "S", factorIds: [HASH_A, HASH_B] }),
        orientation: "vertical",
        factors: [
          {
            id: HASH_A,
            itemNumber: 1,
            name: "A-Factor",
            designNominal: 10,
            upperTolerance: 0.3,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1.2,
            sigmaLevel: 4,
            distribution: "Normal",
          },
          {
            id: HASH_B,
            itemNumber: 2,
            name: "B-Factor",
            designNominal: 12,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Uniform",
          },
        ],
        manualLayout: {
          boundaryOffsets: { [`${HASH_A}::${HASH_B}`]: 16 },
          laneOffsets: { [HASH_A]: 12, [HASH_B]: -8 },
          closureStartOffset: -6,
          closureEndOffset: 10,
          closureLaneOffset: 18,
        },
        reversedFactorIds: [HASH_A],
        closureDirection: "end-to-start",
      },
    }));

    const horizontalFirstSegment = horizontalHtml.match(/data-chain-segment="0"[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"/);
    const verticalFirstSegment = verticalReversedHtml.match(/data-chain-segment="0"[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"/);
    expect(horizontalFirstSegment).not.toBeNull();
    expect(verticalFirstSegment).not.toBeNull();

    const horizontalYDelta = Math.abs(Number(horizontalFirstSegment?.[2]) - Number(horizontalFirstSegment?.[4]));
    const verticalYDelta = Math.abs(Number(verticalFirstSegment?.[2]) - Number(verticalFirstSegment?.[4]));
    expect(horizontalYDelta).toBeCloseTo(0, 6);
    expect(verticalYDelta).toBeGreaterThan(0);
  });

  it("does not emit bare points strings and renders finite polyline coordinates", () => {
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence());
    expect(html).not.toMatch(/>\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?(?:\s+-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?)+\s*</);

    const polylineMatch = html.match(/data-normal-curve-line[^>]*points="([^"]+)"/);
    expect(polylineMatch?.[1]).toBeDefined();
    const points = (polylineMatch?.[1] ?? "").trim().split(/\s+/);
    expect(points.length).toBeGreaterThan(10);
    for (const point of points) {
      const [x, y] = point.split(",");
      expect(Number.isFinite(Number(x))).toBe(true);
      expect(Number.isFinite(Number(y))).toBe(true);
    }
  });

  it("maps LSL/USL/Target/Mean/±3sigma markers from numeric domain", () => {
    const base = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      responseDistribution: {
        mean: 100,
        standardDeviation: 2,
        lowerSpecLimit: 96,
        upperSpecLimit: 104,
        target: 100,
      },
    }));
    const shifted = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      responseDistribution: {
        mean: 500,
        standardDeviation: 1,
        lowerSpecLimit: 497.8,
        upperSpecLimit: 501,
        target: 499.5,
      },
    }));

    const baseLsl = extractNumberAttribute(base, "data-curve-lsl", "x1");
    const shiftedLsl = extractNumberAttribute(shifted, "data-curve-lsl", "x1");
    const baseTarget = extractNumberAttribute(base, "data-curve-target", "x1");
    const shiftedTarget = extractNumberAttribute(shifted, "data-curve-target", "x1");

    expect(baseLsl).not.toBe(shiftedLsl);
    expect(baseTarget).not.toBe(shiftedTarget);
    expect(base).toContain("\u00b13\u03c3");
  });

  it("renders complete factor footer and all four response summary groups with status emphasis", () => {
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence());

    expect(html).toContain("Additional Mean Shift");
    expect(html).toContain("Adjusted Mean");
    expect(html).toContain("RSS and Worst Case");
    expect(html).toContain("Response and Specifications");
    expect(html).toContain("Sigma Level and Capability");
    expect(html).toContain("Defects Per Million");
    expect(html).toContain("summary-value--pass");
    expect(html).toContain("summary-value--fail");
  });

  it("escapes malicious factor/source text and does not render script/img/http payloads", () => {
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      factorSetup: {
        rows: [
          {
            itemNumber: 1,
            factorName: "bad <script>alert(1)</script> <img src=x> http://evil.invalid",
            designNominal: 1,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: 1,
            tolerance: 0.1,
            oneSigma: 0.025,
            contributionPercent: 100,
          },
        ],
        footer: {
          designNominalTotal: 1,
          upperWorstCaseTolerance: 0.1,
          lowerWorstCaseTolerance: -0.1,
          meanResponse: 1,
          rssTolerance: 0.1,
          rssSigma: 0.025,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: 1,
        },
      },
      dimensionChain: {
        status: "fallback",
        sourceSignature: "{\"note\":\"<img src=x> http://evil.invalid <script>alert(1)</script>\"}",
      },
    }));

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).not.toMatch(/<script|<img/i);
    expect(html).not.toMatch(/http:\/\//i);
  });

  it("renders one factor-segment arrow per factor with direction from signed design nominal", () => {
    const factorIds = ["c".repeat(64), "d".repeat(64), "e".repeat(64)];
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      factorSetup: {
        rows: [
          {
            itemNumber: 1,
            factorName: "Positive",
            designNominal: 10,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: 10,
            tolerance: 0.2,
            oneSigma: 0.05,
            contributionPercent: 60,
          },
          {
            itemNumber: 2,
            factorName: "Negative",
            designNominal: -8,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: -8,
            tolerance: 0.2,
            oneSigma: 0.05,
            contributionPercent: 30,
          },
          {
            itemNumber: 3,
            factorName: "Small",
            designNominal: 1,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: 1,
            tolerance: 0.1,
            oneSigma: 0.025,
            contributionPercent: 10,
          },
        ],
        footer: {
          designNominalTotal: 3,
          upperWorstCaseTolerance: 0.5,
          lowerWorstCaseTolerance: -0.5,
          meanResponse: 3,
          rssTolerance: 0.25,
          rssSigma: 0.06,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: 3,
        },
      },
      dimensionChain: {
        status: "generated",
        sourceSignature: JSON.stringify({ workbookName: "W", worksheetName: "S", factorIds }),
        orientation: "horizontal",
        factors: [
          {
            id: factorIds[0]!,
            itemNumber: 1,
            name: "Positive",
            designNominal: 10,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
          },
          {
            id: factorIds[1]!,
            itemNumber: 2,
            name: "Negative",
            designNominal: -8,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
          },
          {
            id: factorIds[2]!,
            itemNumber: 3,
            name: "Small",
            designNominal: 1,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
          },
        ],
        manualLayout: {
          boundaryOffsets: {},
          laneOffsets: {},
          closureStartOffset: 0,
          closureEndOffset: 0,
          closureLaneOffset: 0,
        },
        reversedFactorIds: [],
        closureDirection: "start-to-end",
      },
    }));

    const segments = [...html.matchAll(/<line[^>]*data-factor-segment="([^"]+)"[^>]*x1="([^"]+)"[^>]*x2="([^"]+)"/g)];
    expect(segments).toHaveLength(3);

    const positive = segments.find((segment) => segment[1] === factorIds[0]!.slice(0, 8));
    const negative = segments.find((segment) => segment[1] === factorIds[1]!.slice(0, 8));
    const small = segments.find((segment) => segment[1] === factorIds[2]!.slice(0, 8));
    expect(positive).toBeDefined();
    expect(negative).toBeDefined();
    expect(small).toBeDefined();

    const positiveX1 = Number(positive?.[2]);
    const positiveX2 = Number(positive?.[3]);
    const negativeX1 = Number(negative?.[2]);
    const negativeX2 = Number(negative?.[3]);
    const smallX1 = Number(small?.[2]);
    const smallX2 = Number(small?.[3]);

    expect(positiveX2).toBeGreaterThan(positiveX1);
    expect(negativeX2).toBeLessThan(negativeX1);
    expect(Math.abs(positiveX2 - positiveX1)).toBeGreaterThan(Math.abs(smallX2 - smallX1));
    expect(html).toContain("Item 1");
    expect(html).toContain("DN +10");
    expect(html).toContain("Tol +0.2 / -0.2");
  });

  it("builds fallback chain segments from factorSetup rows for N and single-factor cases", () => {
    const fallbackThree = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      factorSetup: {
        rows: [
          {
            itemNumber: 1,
            factorName: "F1",
            designNominal: 2,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: 2,
            tolerance: 0.1,
            oneSigma: 0.025,
            contributionPercent: 34,
          },
          {
            itemNumber: 2,
            factorName: "F2",
            designNominal: -1,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: -1,
            tolerance: 0.1,
            oneSigma: 0.025,
            contributionPercent: 33,
          },
          {
            itemNumber: 3,
            factorName: "F3",
            designNominal: 0.5,
            upperTolerance: 0.05,
            lowerTolerance: -0.05,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: 0.5,
            tolerance: 0.05,
            oneSigma: 0.0125,
            contributionPercent: 33,
          },
        ],
        footer: {
          designNominalTotal: 1.5,
          upperWorstCaseTolerance: 0.25,
          lowerWorstCaseTolerance: -0.25,
          meanResponse: 1.5,
          rssTolerance: 0.15,
          rssSigma: 0.04,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: 1.5,
        },
      },
      dimensionChain: {
        status: "fallback",
        sourceSignature: JSON.stringify({ workbookName: "W", worksheetName: "S", factorIds: [] }),
      },
    }));

    expect(countMatches(fallbackThree, /data-factor-segment="/g)).toBe(3);
    expect(fallbackThree).toContain('data-factor-segment="fallback-1"');
    expect(fallbackThree).toContain('data-factor-segment="fallback-2"');
    expect(fallbackThree).toContain('data-factor-segment="fallback-3"');

    const fallbackSingle = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      factorSetup: {
        rows: [
          {
            itemNumber: 1,
            factorName: "Only",
            designNominal: -3,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: -3,
            tolerance: 0.2,
            oneSigma: 0.05,
            contributionPercent: 100,
          },
        ],
        footer: {
          designNominalTotal: -3,
          upperWorstCaseTolerance: 0.2,
          lowerWorstCaseTolerance: -0.2,
          meanResponse: -3,
          rssTolerance: 0.2,
          rssSigma: 0.05,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: -3,
        },
      },
      dimensionChain: {
        status: "fallback",
        sourceSignature: JSON.stringify({ workbookName: "W", worksheetName: "S", factorIds: [] }),
      },
    }));

    expect(countMatches(fallbackSingle, /data-factor-segment="/g)).toBe(1);
    expect(fallbackSingle).toContain('data-factor-segment="fallback-1"');
  });

  it("renders cumulative physical vertices with contiguous chain segments and directional closure", () => {
    const factorIds = ["f".repeat(64), "a".repeat(64), "b".repeat(64)];
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      factorSetup: {
        rows: [
          {
            itemNumber: 1,
            factorName: "Long",
            designNominal: 12,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: 12,
            tolerance: 0.2,
            oneSigma: 0.05,
            contributionPercent: 50,
          },
          {
            itemNumber: 2,
            factorName: "Short",
            designNominal: 3,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: 3,
            tolerance: 0.1,
            oneSigma: 0.025,
            contributionPercent: 30,
          },
          {
            itemNumber: 3,
            factorName: "Reverse",
            designNominal: 6,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
            mean: 6,
            tolerance: 0.1,
            oneSigma: 0.025,
            contributionPercent: 20,
          },
        ],
        footer: {
          designNominalTotal: 21,
          upperWorstCaseTolerance: 0.4,
          lowerWorstCaseTolerance: -0.4,
          meanResponse: 21,
          rssTolerance: 0.25,
          rssSigma: 0.06,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: 21,
        },
      },
      dimensionChain: {
        status: "generated",
        sourceSignature: JSON.stringify({ workbookName: "W", worksheetName: "S", factorIds }),
        orientation: "horizontal",
        factors: [
          {
            id: factorIds[0]!,
            itemNumber: 1,
            name: "Long",
            designNominal: 12,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
          },
          {
            id: factorIds[1]!,
            itemNumber: 2,
            name: "Short",
            designNominal: 3,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
          },
          {
            id: factorIds[2]!,
            itemNumber: 3,
            name: "Reverse",
            designNominal: 6,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "Normal",
          },
        ],
        manualLayout: {
          boundaryOffsets: {},
          laneOffsets: {},
          closureStartOffset: 0,
          closureEndOffset: 0,
          closureLaneOffset: 0,
        },
        reversedFactorIds: [factorIds[2]!],
        closureDirection: "end-to-start",
      },
    }));

    const segmentMatches = [...html.matchAll(/<line[^>]*data-chain-segment="(\d+)"[^>]*data-physical-start="([^"]+)"[^>]*data-physical-end="([^"]+)"[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"/g)];
    expect(segmentMatches).toHaveLength(3);

    for (let index = 1; index < segmentMatches.length; index += 1) {
      const previousEnd = parsePair(segmentMatches[index - 1]?.[3] ?? "");
      const currentStart = parsePair(segmentMatches[index]?.[2] ?? "");
      expectSamePoint(previousEnd, currentStart);
    }

    for (const segment of segmentMatches) {
      const physicalStart = parsePair(segment[2] ?? "");
      const physicalEnd = parsePair(segment[3] ?? "");
      const renderedStart = { x: Number(segment[4]), y: Number(segment[5]) };
      const renderedEnd = { x: Number(segment[6]), y: Number(segment[7]) };
      const forward = Math.abs(renderedStart.x - physicalStart.x) < 1e-6
        && Math.abs(renderedStart.y - physicalStart.y) < 1e-6;
      expectSamePoint(renderedStart, forward ? physicalStart : physicalEnd);
      expectSamePoint(renderedEnd, forward ? physicalEnd : physicalStart);
    }

    const firstStart = parsePair(segmentMatches[0]?.[2] ?? "");
    const finalEnd = parsePair(segmentMatches[segmentMatches.length - 1]?.[3] ?? "");
    const closure = html.match(/<polyline[^>]*data-chain-closure[^>]*points="([^"]+)"[^>]*data-physical-start="([^"]+)"[^>]*data-physical-end="([^"]+)"/);
    expect(closure).not.toBeNull();
    const closurePhysicalStart = parsePair(closure?.[2] ?? "");
    const closurePhysicalEnd = parsePair(closure?.[3] ?? "");
    expectSamePoint(closurePhysicalStart, finalEnd);
    expectSamePoint(closurePhysicalEnd, firstStart);
    const closurePoints = (closure?.[1] ?? "").split(" ").map(parsePair);
    expectSamePoint(closurePoints[0] ?? { x: NaN, y: NaN }, finalEnd);
    expectSamePoint(closurePoints.at(-1) ?? { x: NaN, y: NaN }, firstStart);
    expect(closurePoints.length).toBeGreaterThan(2);

    expect(html).toContain("data-chain-origin");
    expect(html).toContain("data-chain-closure-label");
    expect(html).toContain("Closure");
    expect(html).toContain("stroke=\"#176b3a\"");
    expect(html).toContain("stroke=\"#a3342d\"");
    expect(html).toMatch(/<text[^>]*data-chain-label="0"[^>]*>[\s\S]*<tspan/);

    const segmentsByColor = [...html.matchAll(/<line[^>]*data-chain-segment="\d+"[^>]*stroke="([^"]+)"/g)].map((match) => match[1]);
    expect(segmentsByColor).toContain("#176b3a");
  });

  it("applies closure guide and lane offsets to actual intermediate points without disconnecting endpoints", () => {
    const base = buildEvidence();
    const generated = base.dimensionChain.status === "generated" ? base.dimensionChain : undefined;
    if (!generated) throw new Error("Expected generated dimension chain fixture");

    const baselineHtml = renderAssumptionResultsPdfEvidenceHtml(base);
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      dimensionChain: {
        ...generated,
        manualLayout: {
          ...generated.manualLayout,
          closureStartOffset: 18,
          closureEndOffset: -12,
          closureLaneOffset: 20,
        },
      },
    }));
    const closure = html.match(/<polyline[^>]*data-chain-closure[^>]*points="([^"]+)"[^>]*data-start-offset="([^"]+)"[^>]*data-end-offset="([^"]+)"[^>]*data-lane-offset="([^"]+)"/);

    expect(closure).not.toBeNull();
    expect(Number(closure?.[2])).toBe(18);
    expect(Number(closure?.[3])).toBe(-12);
    expect(Number(closure?.[4])).toBe(20);
    const baselinePoints = (baselineHtml.match(/<polyline[^>]*data-chain-closure[^>]*points="([^"]+)"/)?.[1] ?? "")
      .split(" ").map(parsePair);
    const offsetPoints = (closure?.[1] ?? "").split(" ").map(parsePair);
    expect(offsetPoints).toHaveLength(4);
    expectSamePoint(offsetPoints[0] ?? { x: NaN, y: NaN }, baselinePoints[0] ?? { x: NaN, y: NaN });
    expectSamePoint(offsetPoints[3] ?? { x: NaN, y: NaN }, baselinePoints[3] ?? { x: NaN, y: NaN });
    expect(offsetPoints[1]).not.toEqual(baselinePoints[1]);
    expect(offsetPoints[2]).not.toEqual(baselinePoints[2]);
  });

  it.each([
    { direction: "end-to-start" as const, firstEndpoint: "physicalStart", lastEndpoint: "physicalEnd" },
    { direction: "start-to-end" as const, firstEndpoint: "physicalEnd", lastEndpoint: "physicalStart" },
  ])("renders $direction closure point order from its physical endpoints", ({
    direction,
    firstEndpoint,
    lastEndpoint,
  }) => {
    const base = buildEvidence();
    const generated = base.dimensionChain.status === "generated" ? base.dimensionChain : undefined;
    if (!generated) throw new Error("Expected generated dimension chain fixture");
    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      dimensionChain: { ...generated, closureDirection: direction },
    }));
    const closure = html.match(/<polyline[^>]*data-chain-closure[^>]*points="([^"]+)"[^>]*data-physical-start="([^"]+)"[^>]*data-physical-end="([^"]+)"/);
    expect(closure).not.toBeNull();
    const points = (closure?.[1] ?? "").split(" ").map(parsePair);
    const endpoints = {
      physicalStart: parsePair(closure?.[2] ?? ""),
      physicalEnd: parsePair(closure?.[3] ?? ""),
    };
    expectSamePoint(points[0] ?? { x: NaN, y: NaN }, endpoints[firstEndpoint]);
    expectSamePoint(points.at(-1) ?? { x: NaN, y: NaN }, endpoints[lastEndpoint]);
  });

  it("fits cumulative chain vertices inside the SVG viewBox for vertical positive factors", () => {
    const base = buildEvidence();
    const generated = base.dimensionChain.status === "generated" ? base.dimensionChain : undefined;
    if (!generated) throw new Error("Expected generated dimension chain fixture");

    const html = renderAssumptionResultsPdfEvidenceHtml(buildEvidence({
      dimensionChain: {
        ...generated,
        orientation: "vertical",
      },
    }));
    const endpoints = [...html.matchAll(/data-physical-(?:start|end)="([^"]+)"/g)]
      .map((match) => parsePair(match[1] ?? ""));

    expect(endpoints.length).toBeGreaterThan(0);
    for (const endpoint of endpoints) {
      expect(endpoint.x).toBeGreaterThanOrEqual(24);
      expect(endpoint.x).toBeLessThanOrEqual(596);
      expect(endpoint.y).toBeGreaterThanOrEqual(24);
      expect(endpoint.y).toBeLessThanOrEqual(144);
    }
    const labels = [...html.matchAll(/data-chain-label="\d+"[^>]*x="([^"]+)"[^>]*y="([^"]+)"/g)];
    for (const label of labels) {
      expect(Number(label[1])).toBeGreaterThanOrEqual(24);
      expect(Number(label[1])).toBeLessThanOrEqual(596);
      expect(Number(label[2])).toBeGreaterThanOrEqual(24);
      expect(Number(label[2])).toBeLessThanOrEqual(133);
    }
  });
});