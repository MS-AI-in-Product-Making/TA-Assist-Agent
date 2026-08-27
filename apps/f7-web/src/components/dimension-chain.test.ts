import { describe, expect, it } from "vitest";
import {
  boundaryKey,
  buildDisplaySegments,
  buildDimensionChainGeometry,
  dimensionChainSignature,
  pruneManualLayout,
  signChangesForDisplay,
  type DimensionChainFactor,
  type DimensionChainOrientation,
} from "./dimension-chain";

function factor(itemNumber: number, designNominal: number): DimensionChainFactor {
  return {
    id: `factor-${itemNumber}`,
    itemNumber,
    name: `Factor ${itemNumber}`,
    designNominal,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
  };
}

describe("dimension chain geometry", () => {
  it("builds cumulative additive and subtractive arrows with closure", () => {
    const result = buildDimensionChainGeometry([factor(1, 2), factor(2, -1), factor(3, 0.5)]);

    expect(result.segments.map(({ direction }) => direction)).toEqual(["additive", "subtractive", "additive"]);
    expect(result.segments[0]!.end).toBeGreaterThan(result.segments[0]!.start);
    expect(result.segments[1]!.end).toBeLessThan(result.segments[1]!.start);
    expect(result.segments[2]!.start).toBe(result.segments[1]!.end);
    expect(result.closure.start).toBe(result.segments[2]!.end);
    expect(result.closure.end).toBe(0);
  });

  it("compresses extreme ratios while retaining visible short arrows", () => {
    const result = buildDimensionChainGeometry([factor(1, 100), factor(2, 0.01)]);

    expect(result.compressed).toBe(true);
    expect(result.segments[1]!.length).toBeGreaterThanOrEqual(36);
    expect(result.segments[0]!.length).toBe(180);
  });

  it("uses linear scaling for comparable values", () => {
    const result = buildDimensionChainGeometry([factor(1, 4), factor(2, 2)]);

    expect(result.compressed).toBe(false);
    expect(result.segments.map(({ length }) => length)).toEqual([180, 90]);
  });

  it("keeps zero items visible without moving the cumulative position", () => {
    const result = buildDimensionChainGeometry([factor(1, 0)]);

    expect(result.segments[0]).toMatchObject({ direction: "zero", start: 0, end: 0, length: 0 });
    expect(result.minPosition).toBe(0);
    expect(result.maxPosition).toBe(0);
  });

  it("changes the signature for every Factor Setup field", () => {
    const original = factor(1, 2);
    const changes: DimensionChainFactor[] = [
      { ...original, itemNumber: 2 },
      { ...original, name: "Changed" },
      { ...original, designNominal: 3 },
      { ...original, upperTolerance: 0.2 },
      { ...original, lowerTolerance: -0.2 },
      { ...original, longTermSafetyFactor: 2 },
      { ...original, sigmaLevel: 6 },
      { ...original, distribution: "Uniform" },
    ];

    for (const changed of changes) {
      expect(dimensionChainSignature([original])).not.toBe(dimensionChainSignature([changed]));
    }
  });
});

describe("dimension chain display layout", () => {
  it("defines horizontal and vertical orientations and stable boundary keys", () => {
    const orientations: readonly DimensionChainOrientation[] = ["horizontal", "vertical"];

    expect(orientations).toEqual(["horizontal", "vertical"]);
    expect(boundaryKey("factor-1", "factor-2")).toBe("factor-1::factor-2");
  });

  it("applies offsets only to shared boundaries and lanes independently", () => {
    const geometry = buildDimensionChainGeometry([factor(1, 2), factor(2, 2), factor(3, 2)]);
    const segments = buildDisplaySegments(geometry, {
      boundaryOffsets: {
        [boundaryKey("factor-1", "factor-2")]: 20,
        [boundaryKey("factor-2", "factor-3")]: -30,
      },
      laneOffsets: { "factor-2": 14 },
    });

    expect(segments.map(({ displayStart, displayEnd, laneOffset }) => ({
      displayStart,
      displayEnd,
      laneOffset,
    }))).toEqual([
      { displayStart: 0, displayEnd: 200, laneOffset: 0 },
      { displayStart: 200, displayEnd: 330, laneOffset: 14 },
      { displayStart: 330, displayEnd: 540, laneOffset: 0 },
    ]);
    expect(geometry.segments.map(({ start, end }) => ({ start, end }))).toEqual([
      { start: 0, end: 180 },
      { start: 180, end: 360 },
      { start: 360, end: 540 },
    ]);
  });

  it("reports only reversed nonzero factors using the displayed sign", () => {
    const geometry = buildDimensionChainGeometry([factor(1, 2), factor(2, -1), factor(3, 0)]);
    const segments = buildDisplaySegments(geometry, {
      boundaryOffsets: {
        [boundaryKey("factor-1", "factor-2")]: -200,
        [boundaryKey("factor-2", "factor-3")]: -200,
      },
      laneOffsets: {},
    });

    expect(segments.map(({ displayDirection }) => displayDirection)).toEqual([
      "subtractive",
      "subtractive",
      "additive",
    ]);
    expect(signChangesForDisplay(segments)).toEqual([{ factorId: "factor-1", sign: -1 }]);
  });

  it("prunes stale lanes and boundaries that are no longer adjacent", () => {
    const layout = {
      boundaryOffsets: {
        [boundaryKey("factor-1", "factor-2")]: 10,
        [boundaryKey("factor-2", "factor-3")]: 20,
        [boundaryKey("factor-1", "factor-3")]: 30,
        [boundaryKey("stale", "factor-1")]: 40,
      },
      laneOffsets: {
        "factor-1": 5,
        "factor-3": 15,
        stale: 25,
      },
    };

    expect(pruneManualLayout(layout, [factor(1, 2), factor(2, 2), factor(3, 2)])).toEqual({
      boundaryOffsets: {
        [boundaryKey("factor-1", "factor-2")]: 10,
        [boundaryKey("factor-2", "factor-3")]: 20,
      },
      laneOffsets: {
        "factor-1": 5,
        "factor-3": 15,
      },
    });
  });
});
