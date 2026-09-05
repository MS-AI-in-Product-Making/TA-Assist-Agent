import { describe, expect, it } from "vitest";
import { normalizeF7Factor } from "./f7-factor-normalization.js";

describe("F7 factor normalization", () => {
  it("normalizes Excel signed mean to positive physical mean when loop coefficient is -1", () => {
    expect(normalizeF7Factor({ excelSignedMean: -0.57, loopCoefficient: -1, standardDeviation: 0.0125 }))
      .toMatchObject({ physicalMean: 0.57, signedContributionMean: -0.57 });
  });

  it("keeps means unchanged when loop coefficient is 1", () => {
    expect(normalizeF7Factor({ excelSignedMean: 0.22, loopCoefficient: 1, standardDeviation: 0.0125 }))
      .toMatchObject({ physicalMean: 0.22, signedContributionMean: 0.22 });
  });

  it("normalizes a zero-mean Assembly Shift with neutral loop coefficient", () => {
    expect(normalizeF7Factor({ excelSignedMean: 0, loopCoefficient: 0, standardDeviation: 0.0125 }))
      .toMatchObject({ physicalMean: 0, signedContributionMean: 0 });
  });

  it("rejects a neutral loop coefficient with a nonzero contribution mean", () => {
    expect(() => normalizeF7Factor({ excelSignedMean: 0.2, loopCoefficient: 0, standardDeviation: 0.0125 }))
      .toThrow("F7 factor direction is inconsistent with the Excel contribution mean.");
  });

  it("rejects inconsistent factor direction when physical mean would be negative", () => {
    expect(() => normalizeF7Factor({ excelSignedMean: 0.57, loopCoefficient: -1, standardDeviation: 0.0125 }))
      .toThrow("F7 factor direction is inconsistent with the Excel contribution mean.");
  });

  it("rejects non-finite mean", () => {
    expect(() => normalizeF7Factor({ excelSignedMean: Number.NaN, loopCoefficient: 1, standardDeviation: 0.0125 }))
      .toThrow("F7 factor input is invalid.");
    expect(() => normalizeF7Factor({ excelSignedMean: Number.POSITIVE_INFINITY, loopCoefficient: 1, standardDeviation: 0.0125 }))
      .toThrow("F7 factor input is invalid.");
  });

  it("rejects non-finite, zero, and negative standard deviation", () => {
    expect(() => normalizeF7Factor({ excelSignedMean: 0.2, loopCoefficient: 1, standardDeviation: Number.NaN }))
      .toThrow("F7 factor input is invalid.");
    expect(() => normalizeF7Factor({ excelSignedMean: 0.2, loopCoefficient: 1, standardDeviation: Number.POSITIVE_INFINITY }))
      .toThrow("F7 factor input is invalid.");
    expect(() => normalizeF7Factor({ excelSignedMean: 0.2, loopCoefficient: 1, standardDeviation: 0 }))
      .toThrow("F7 factor input is invalid.");
    expect(() => normalizeF7Factor({ excelSignedMean: 0.2, loopCoefficient: 1, standardDeviation: -0.1 }))
      .toThrow("F7 factor input is invalid.");
  });

  it("rejects runtime-invalid loop coefficient via unknown cast", () => {
    expect(() => normalizeF7Factor({
      excelSignedMean: 0.2,
      loopCoefficient: 2 as unknown as -1 | 0 | 1,
      standardDeviation: 0.0125,
    })).toThrow("F7 factor input is invalid.");
  });

  it("normalizes negative zero to stable zero", () => {
    const result = normalizeF7Factor({ excelSignedMean: -0, loopCoefficient: -1, standardDeviation: 0.0125 });

    expect(Object.is(result.physicalMean, -0)).toBe(false);
    expect(Object.is(result.signedContributionMean, -0)).toBe(false);
    expect(result).toMatchObject({ physicalMean: 0, signedContributionMean: 0 });
  });

  it("returns a frozen object", () => {
    const result = normalizeF7Factor({ excelSignedMean: -0.57, loopCoefficient: -1, standardDeviation: 0.0125 });

    expect(Object.isFrozen(result)).toBe(true);
    expect(() => {
      (result as { physicalMean: number }).physicalMean = 1;
    }).toThrow();
  });

  it("does not leak input numeric values through typed error serialization", () => {
    const marker = 987654321.12345;
    let error: unknown;
    try {
      normalizeF7Factor({
        excelSignedMean: marker,
        loopCoefficient: 2 as unknown as -1 | 0 | 1,
        standardDeviation: 0.0125,
      });
      expect.unreachable();
    } catch (caught) {
      error = caught;
    }

    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain(String(marker));
    expect(error).toMatchObject({
      code: "validation_error",
      summary: "F7 factor input is invalid.",
      suggestedAction: "Provide finite factor statistics, a positive standard deviation, and a valid loop direction coefficient.",
      affectedInputReferences: ["f7-factor-normalization-input"],
    });
  });
});