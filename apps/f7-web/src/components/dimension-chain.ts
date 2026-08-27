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

export type DimensionChainOrientation = "horizontal" | "vertical";

export interface DimensionChainManualLayout {
  readonly boundaryOffsets: Readonly<Record<string, number>>;
  readonly laneOffsets: Readonly<Record<string, number>>;
}

export interface DimensionChainDisplaySegment extends DimensionChainSegment {
  readonly displayStart: number;
  readonly displayEnd: number;
  readonly laneOffset: number;
  readonly displayDirection: "additive" | "subtractive" | "zero";
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

export function boundaryKey(previousId: string, nextId: string): string {
  return `${previousId}::${nextId}`;
}

export function buildDisplaySegments(
  geometry: DimensionChainGeometry,
  layout: DimensionChainManualLayout,
): readonly DimensionChainDisplaySegment[] {
  return geometry.segments.map((segment, index, segments) => {
    const previous = segments[index - 1];
    const next = segments[index + 1];
    const displayStart = segment.start + (previous
      ? (layout.boundaryOffsets[boundaryKey(previous.id, segment.id)] ?? 0)
      : 0);
    const displayEnd = segment.end + (next
      ? (layout.boundaryOffsets[boundaryKey(segment.id, next.id)] ?? 0)
      : 0);
    const displaySign = Math.sign(displayEnd - displayStart);

    return {
      ...segment,
      displayStart,
      displayEnd,
      laneOffset: layout.laneOffsets[segment.id] ?? 0,
      displayDirection: displaySign > 0
        ? "additive"
        : displaySign < 0
          ? "subtractive"
          : "zero",
    };
  });
}

export function signChangesForDisplay(
  segments: readonly DimensionChainDisplaySegment[],
): ReadonlyArray<{ readonly factorId: string; readonly sign: 1 | -1 }> {
  return segments.flatMap((segment) => {
    const designSign = Math.sign(segment.designNominal);
    const displaySign = Math.sign(segment.displayEnd - segment.displayStart);

    return designSign !== 0 && displaySign !== 0 && designSign !== displaySign
      ? [{ factorId: segment.id, sign: displaySign as 1 | -1 }]
      : [];
  });
}

export function pruneManualLayout(
  layout: DimensionChainManualLayout,
  factors: readonly DimensionChainFactor[],
): DimensionChainManualLayout {
  const factorIds = new Set(factors.map(({ id }) => id));
  const boundaryKeys = new Set(factors.slice(1).map((factor, index) => (
    boundaryKey(factors[index]!.id, factor.id)
  )));

  return {
    boundaryOffsets: Object.fromEntries(
      Object.entries(layout.boundaryOffsets).filter(([key]) => boundaryKeys.has(key)),
    ),
    laneOffsets: Object.fromEntries(
      Object.entries(layout.laneOffsets).filter(([id]) => factorIds.has(id)),
    ),
  };
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
