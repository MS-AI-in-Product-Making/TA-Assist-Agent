import { describe, expect, it } from "vitest";
import { buildMeasurementDiagnostics } from "./measurement-diagnostics";

describe("buildMeasurementDiagnostics", () => {
  it("summarizes range, sample-size readiness, missing entries, and a stable unimodal sample", () => {
    const values = Array.from({ length: 30 }, (_, index) => 10 + Math.sin(index * 1.7));
    const result = buildMeasurementDiagnostics(values, 0);

    expect(result.sampleSize).toBe(30);
    expect(result.sampleSizeStatus).toBe("acceptable");
    expect(result.minimum).toBeCloseTo(Math.min(...values));
    expect(result.maximum).toBeCloseTo(Math.max(...values));
    expect(result.range).toBeCloseTo(Math.max(...values) - Math.min(...values));
    expect(result.missingCount).toBe(0);
    expect(result.threeSigmaOutlierIndexes).toEqual([]);
    expect(result.iqrOutlierIndexes).toEqual([]);
    expect(result.histogram.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(30);
    expect(result.shape).not.toBe("insufficient_data");
  });

  it("flags extreme values independently with the 3 sigma and Tukey 1.5 IQR methods", () => {
    const values = [...Array.from({ length: 30 }, (_, index) => 10 + (index % 5) * 0.1), 100];
    const result = buildMeasurementDiagnostics(values, 0);

    expect(result.threeSigmaOutlierIndexes).toContain(30);
    expect(result.iqrOutlierIndexes).toContain(30);
    expect(result.outlierIndexes).toEqual([30]);
  });

  it("reports internal missing entries without counting trailing input placeholders", () => {
    const result = buildMeasurementDiagnostics([1, 2, 3], 2);

    expect(result.sampleSizeStatus).toBe("limited");
    expect(result.missingCount).toBe(2);
  });

  it("labels clearly separated clusters as possibly multimodal", () => {
    const values = [-5.2, -5.1, -5, -4.9, -4.8, 4.8, 4.9, 5, 5.1, 5.2];
    expect(buildMeasurementDiagnostics(values, 0).shape).toBe("possibly_multimodal");
  });

  it("uses zero-width Tukey fences when most values are identical", () => {
    expect(buildMeasurementDiagnostics([1, 1, 1, 1, 1, 10], 0).iqrOutlierIndexes).toEqual([5]);
  });

  it("labels two repeated and clearly separated clusters as possibly multimodal", () => {
    expect(buildMeasurementDiagnostics([0, 0, 0, 0, 10, 10, 10, 10], 0).shape)
      .toBe("possibly_multimodal");
  });

  it("preserves source indexes after filtering non-finite entries", () => {
    expect(buildMeasurementDiagnostics([1, Number.NaN, 1, 1, 1, 10], 1).iqrOutlierIndexes)
      .toEqual([5]);
  });

  it("uses nearest-rank quartiles without flagging the borderline minimum in an odd-sized sample", () => {
    const values = [
      0.543, 0.549, 0.553, 0.560, 0.562, 0.565, 0.567, 0.569,
      0.570, 0.571, 0.572, 0.573, 0.574, 0.575, 0.576, 0.577,
      0.578, 0.579, 0.580, 0.582, 0.583, 0.584, 0.586, 0.588,
      0.590, 0.592, 0.594, 0.596, 0.599, 0.603, 0.609,
    ];

    expect(buildMeasurementDiagnostics(values, 1).iqrOutlierIndexes).toEqual([]);
  });
});