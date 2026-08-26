export interface DimensionChainFactor {
  readonly id: string;
  readonly itemNumber: number;
  readonly name: string;
  readonly designNominal: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly longTermSafetyFactor: number;
  readonly sigmaLevel: number;
  readonly distribution: string;
}

export interface DimensionChainSegment extends DimensionChainFactor {
  readonly direction: "additive" | "subtractive" | "zero";
  readonly start: number;
  readonly end: number;
  readonly length: number;
}

export interface DimensionChainGeometry {
  readonly segments: readonly DimensionChainSegment[];
  readonly closure: {
    readonly start: number;
    readonly end: 0;
  };
  readonly minPosition: number;
  readonly maxPosition: number;
  readonly compressed: boolean;
}

const MIN_ARROW_LENGTH = 36;
const MAX_ARROW_LENGTH = 180;
const COMPRESSION_RATIO = 8;

export function dimensionChainSignature(factors: readonly DimensionChainFactor[]): string {
  return JSON.stringify(factors);
}

export function buildDimensionChainGeometry(
  factors: readonly DimensionChainFactor[],
): DimensionChainGeometry {
  const nonZeroMagnitudes = factors
    .map(({ designNominal }) => Math.abs(designNominal))
    .filter((value) => value > 0);
  const maximum = Math.max(0, ...nonZeroMagnitudes);
  const minimum = nonZeroMagnitudes.length > 0 ? Math.min(...nonZeroMagnitudes) : 0;
  const compressed = nonZeroMagnitudes.length > 1 && maximum / minimum > COMPRESSION_RATIO;
  let cursor = 0;
  const positions = [cursor];

  const segments = factors.map((factor): DimensionChainSegment => {
    const magnitude = Math.abs(factor.designNominal);
    const normalized = maximum === 0 ? 0 : magnitude / maximum;
    const length = magnitude === 0
      ? 0
      : Math.max(
          MIN_ARROW_LENGTH,
          (compressed ? Math.sqrt(normalized) : normalized) * MAX_ARROW_LENGTH,
        );
    const start = cursor;
    cursor += Math.sign(factor.designNominal) * length;
    positions.push(cursor);

    return {
      ...factor,
      direction: factor.designNominal > 0
        ? "additive"
        : factor.designNominal < 0
          ? "subtractive"
          : "zero",
      start,
      end: cursor,
      length,
    };
  });

  return {
    segments,
    closure: { start: cursor, end: 0 },
    minPosition: Math.min(...positions),
    maxPosition: Math.max(...positions),
    compressed,
  };
}
