const DISPLAY_DECIMALS = 6;
const DISPLAY_SCALE = 10 ** DISPLAY_DECIMALS;

interface SpecificationFallbackValues {
  readonly currentLowerSpecLimit: number;
  readonly currentUpperSpecLimit: number;
  readonly calculatedLowerSpecLimit: number;
  readonly calculatedUpperSpecLimit: number;
}

interface SpecificationDisplayRow {
  readonly current: string;
  readonly recommended: string;
  readonly adjustment: string;
}

export interface SpecificationFallbackDisplay {
  readonly lower: SpecificationDisplayRow;
  readonly upper: SpecificationDisplayRow;
}

function roundOutward(value: number, boundary: "lower" | "upper"): number {
  if (value !== 0 && (Math.abs(value) < 1 / DISPLAY_SCALE || Math.abs(value) >= 1e21)) {
    return value;
  }

  const scaled = value * DISPLAY_SCALE;
  if (!Number.isFinite(scaled)) return value;
  return (boundary === "lower" ? Math.floor(scaled) : Math.ceil(scaled)) / DISPLAY_SCALE;
}

function formatSpecificationValue(value: number): string {
  if (Object.is(value, -0) || value === 0) return "0";
  if (Math.abs(value) < 1 / DISPLAY_SCALE || Math.abs(value) >= 1e21) {
    return String(value).replace("e+", "e");
  }
  return value.toFixed(DISPLAY_DECIMALS).replace(/\.?0+$/, "");
}

function formatAdjustment(value: number): string {
  const formatted = formatSpecificationValue(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function formatAdjustmentBetween(recommended: number, current: number): string {
  const difference = recommended - current;
  if (Number.isFinite(difference)) {
    const normalizedDifference = difference !== 0 && Math.abs(difference) < 1 / DISPLAY_SCALE
      ? Number(difference.toPrecision(15))
      : difference;
    return formatAdjustment(normalizedDifference);
  }

  const exponent = Math.max(
    Math.floor(Math.log10(Math.abs(recommended))),
    Math.floor(Math.log10(Math.abs(current))),
  );
  const scale = 10 ** exponent;
  const scaledDifference = recommended / scale - current / scale;
  const mantissa = scaledDifference.toFixed(DISPLAY_DECIMALS).replace(/\.?0+$/, "");
  return `${scaledDifference > 0 ? "+" : ""}${mantissa}e${exponent}`;
}

export function buildSpecificationFallbackDisplay(
  values: SpecificationFallbackValues,
): SpecificationFallbackDisplay {
  const recommendedLower = roundOutward(values.calculatedLowerSpecLimit, "lower");
  const recommendedUpper = roundOutward(values.calculatedUpperSpecLimit, "upper");
  const displayedCurrentLower = Number(formatSpecificationValue(values.currentLowerSpecLimit));
  const displayedCurrentUpper = Number(formatSpecificationValue(values.currentUpperSpecLimit));

  return {
    lower: {
      current: formatSpecificationValue(displayedCurrentLower),
      recommended: formatSpecificationValue(recommendedLower),
      adjustment: formatAdjustmentBetween(recommendedLower, displayedCurrentLower),
    },
    upper: {
      current: formatSpecificationValue(displayedCurrentUpper),
      recommended: formatSpecificationValue(recommendedUpper),
      adjustment: formatAdjustmentBetween(recommendedUpper, displayedCurrentUpper),
    },
  };
}
