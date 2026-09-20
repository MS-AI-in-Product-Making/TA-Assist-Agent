<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import {
  buildDistributionFitPlot,
  buildReferenceLabelRows,
  canonicalSigmaLevel,
  type FactorSetupAssumption,
  type DistributionFitObservedDomain,
  type DistributionFitPlotCandidate,
  type DistributionFitReferenceLine,
  type DistributionFitReferenceLineId,
  type DistributionFitReferences,
} from "../distribution-fit-plot";

type SigmaLevel = string;

interface SigmaLevelOption {
  readonly value: SigmaLevel;
  readonly numericValue: number;
  readonly idFragment: "3" | "4" | "4-5" | "6" | "setup";
}

const props = defineProps<{
  readonly candidate: DistributionFitPlotCandidate;
  readonly observedDomain: DistributionFitObservedDomain;
  readonly references: DistributionFitReferences;
  readonly assumption: FactorSetupAssumption | undefined;
  readonly selectableSigmaLevels?: boolean;
  readonly idPrefix?: string;
}>();

const standardSigmaLevels: readonly SigmaLevelOption[] = [
  { value: "3", numericValue: 3, idFragment: "3" },
  { value: "4", numericValue: 4, idFragment: "4" },
  { value: "4.5", numericValue: 4.5, idFragment: "4-5" },
  { value: "6", numericValue: 6, idFragment: "6" },
];
const sigmaLevels = computed<readonly SigmaLevelOption[]>(() => {
  const setupSigma = props.assumption?.sigmaLevel;
  if (!(setupSigma && Number.isFinite(setupSigma) && setupSigma > 0)) {
    return standardSigmaLevels;
  }
  const setupValue = canonicalSigmaLevel(setupSigma);
  if (standardSigmaLevels.some(({ value }) => value === setupValue)) return standardSigmaLevels;
  return [...standardSigmaLevels, {
    value: setupValue,
    numericValue: setupSigma,
    idFragment: "setup" as const,
  }].toSorted((left, right) => left.numericValue - right.numericValue);
});
const sigmaVisibility = reactive<Record<SigmaLevel, boolean>>({});

watch(
  () => [props.selectableSigmaLevels, props.assumption?.sigmaLevel] as const,
  ([selectable, setupSigmaLevel]) => {
    if (!selectable) return;
    const setupValue = setupSigmaLevel && Number.isFinite(setupSigmaLevel) && setupSigmaLevel > 0
      ? canonicalSigmaLevel(setupSigmaLevel)
      : "3";
    const defaultLevel = sigmaLevels.value.find(({ value }) => value === setupValue)?.value ?? "3";
    for (const value of Object.keys(sigmaVisibility)) delete sigmaVisibility[value];
    for (const { value } of sigmaLevels.value) sigmaVisibility[value] = value === defaultLevel;
  },
  { immediate: true },
);

const width = 800;
const height = 332;
const margin = { top: 60, right: 18, bottom: 42, left: 62 } as const;
const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;
const effectiveObservedDomain = computed(() => {
  if (!props.selectableSigmaLevels) return props.observedDomain;
  const maximumSigma = Math.max(6, props.assumption?.sigmaLevel ?? 0);
  const radius = maximumSigma * props.references.sampleStandardDeviation;
  return {
    ...props.observedDomain,
    minimum: Math.min(props.observedDomain.minimum, props.references.mean - radius),
    maximum: Math.max(props.observedDomain.maximum, props.references.mean + radius),
  };
});
const model = computed(() => buildDistributionFitPlot(props.candidate, effectiveObservedDomain.value, props.assumption));
const selectableReferenceLines = computed<readonly DistributionFitReferenceLine[]>(() => {
  if (!props.selectableSigmaLevels) return props.references.lines;
  const fixedLines = props.references.lines.filter((line) => referenceSigma(line.id) === undefined);
  const sigmaLines = sigmaLevels.value.flatMap(({ numericValue, idFragment }) => ([
    {
      id: `minus-${idFragment}-sigma` as DistributionFitReferenceLineId,
      value: props.references.mean - numericValue * props.references.sampleStandardDeviation,
    },
    {
      id: `plus-${idFragment}-sigma` as DistributionFitReferenceLineId,
      value: props.references.mean + numericValue * props.references.sampleStandardDeviation,
    },
  ]));
  return [...fixedLines, ...sigmaLines];
});
const visibleReferenceLines = computed(() => selectableReferenceLines.value.filter((line) => {
  if (!props.selectableSigmaLevels) return true;
  const sigmaLevel = referenceSigma(line.id);
  return sigmaLevel === undefined || sigmaVisibility[sigmaLevel];
}));
const displayedSigmaLevels = computed(() => props.selectableSigmaLevels
  ? sigmaLevels.value.filter(({ value }) => sigmaVisibility[value])
  : standardSigmaLevels.slice(0, 2));
const referenceLabelRows = computed(() => buildReferenceLabelRows(
  visibleReferenceLines.value,
  model.value.domainMinimum,
  model.value.domainMaximum,
  plotWidth,
));
const visibleReferences = computed(() => {
  const references = visibleReferenceLines.value.map((line) => ({
    ...line,
    labelWidth: referenceLabelWidth(line),
    labelX: xPosition(line.value),
    labelY: referenceLabelY(line),
  }));
  if (!props.selectableSigmaLevels) return references;

  const labelGap = 3;
  for (const labelY of [18, 39]) {
    const row = references
      .filter((reference) => reference.labelY === labelY)
      .sort((left, right) => left.labelX - right.labelX);
    let rightEdge = margin.left;
    for (const reference of row) {
      reference.labelX = Math.max(reference.labelX, rightEdge + reference.labelWidth / 2);
      rightEdge = reference.labelX + reference.labelWidth / 2 + labelGap;
    }
    let leftEdge = width - margin.right;
    for (const reference of row.toReversed()) {
      reference.labelX = Math.min(reference.labelX, leftEdge - reference.labelWidth / 2);
      leftEdge = reference.labelX - reference.labelWidth / 2 - labelGap;
    }
  }
  return references;
});
const titleId = computed(() => `${props.idPrefix ?? `distribution-fit-${props.candidate.family}`}-title`);

function xFraction(value: number): number {
  const minimum = model.value.domainMinimum;
  const maximum = model.value.domainMaximum;
  const range = maximum - minimum;
  if (Number.isFinite(range) && range > 0) return (value - minimum) / range;
  const scaledRange = maximum / 2 - minimum / 2;
  return scaledRange > 0 ? (value / 2 - minimum / 2) / scaledRange : 0.5;
}

function xPosition(value: number): number {
  return margin.left + Math.max(0, Math.min(1, xFraction(value))) * plotWidth;
}

function yPosition(frequency: number): number {
  return margin.top + plotHeight * (1 - frequency / model.value.maximumFrequency);
}

const curvePath = computed(() => model.value.curve
  .map((point, index) => `${index === 0 ? "M" : "L"}${xPosition(point.x).toFixed(2)},${yPosition(point.expectedFrequency).toFixed(2)}`)
  .join(" "));
const assumptionCurvePath = computed(() => model.value.assumptionCurve
  .map((point, index) => `${index === 0 ? "M" : "L"}${xPosition(point.x).toFixed(2)},${yPosition(point.expectedFrequency).toFixed(2)}`)
  .join(" "));

function formatAxis(value: number): string {
  return value.toLocaleString("en-US", { maximumSignificantDigits: 6, useGrouping: false });
}

function formatXAxis(value: number): string {
  const decimalPlaces = props.references.specificationDecimalPlaces;
  const scale = 10 ** decimalPlaces;
  const normalized = Math.round((value + Math.sign(value || 1) * 1e-12) * scale) / scale;
  return normalized.toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    useGrouping: false,
  });
}

function formatReferenceValue(value: number): string {
  const magnitude = Math.abs(value);
  return magnitude >= 1_000_000 || (magnitude > 0 && magnitude < 0.001)
    ? value.toExponential(3)
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
        useGrouping: false,
      });
}

function referenceLabel(line: DistributionFitReferenceLine): string {
  const sigmaLevel = referenceSigma(line.id);
  if (line.id === "minus-setup-sigma") return `−${sigmaLevel}σ ${formatReferenceValue(line.value)}`;
  if (line.id === "plus-setup-sigma") return `+${sigmaLevel}σ ${formatReferenceValue(line.value)}`;
  const labels: Record<DistributionFitReferenceLine["id"], string> = {
    "lower-spec-limit": "LSL",
    "upper-spec-limit": "USL",
    target: "Target",
    mean: "Mean",
    "minus-3-sigma": "−3σ",
    "plus-3-sigma": "+3σ",
    "minus-4-sigma": "−4σ",
    "plus-4-sigma": "+4σ",
    "minus-4-5-sigma": "−4.5σ",
    "plus-4-5-sigma": "+4.5σ",
    "minus-6-sigma": "−6σ",
    "plus-6-sigma": "+6σ",
    "minus-setup-sigma": "−σ",
    "plus-setup-sigma": "+σ",
  };
  return `${labels[line.id]} ${formatReferenceValue(line.value)}`;
}

function referenceLabelWidth(line: DistributionFitReferenceLine): number {
  const textWidth = Array.from(referenceLabel(line)).reduce((width, character) => {
    if (character === " " || character === "." || character === ",") return width + 2.5;
    if (character === "+" || character === "−" || character === "-") return width + 4;
    return width + 4.5;
  }, 0);
  return Math.min(100, Math.max(48, Math.ceil(textWidth + 10)));
}

function referenceSigma(id: DistributionFitReferenceLineId): SigmaLevel | undefined {
  if (id.includes("-setup-sigma")) {
    const setupSigma = props.assumption?.sigmaLevel;
    return setupSigma && Number.isFinite(setupSigma) && setupSigma > 0
      ? canonicalSigmaLevel(setupSigma)
      : undefined;
  }
  if (id.includes("-3-sigma")) return "3";
  if (id.includes("-4-5-sigma")) return "4.5";
  if (id.includes("-4-sigma")) return "4";
  if (id.includes("-6-sigma")) return "6";
  return undefined;
}

function referenceClass(line: DistributionFitReferenceLine): string {
  if (line.id.includes("spec-limit")) return "reference-spec";
  if (line.id === "target" || line.id === "mean") return `reference-${line.id}`;
  const sigmaLevel = referenceSigma(line.id);
  return standardSigmaLevels.some(({ value }) => value === sigmaLevel)
    ? `reference-${sigmaLevel?.replace(".", "-")}-sigma`
    : "reference-sigma";
}

function referenceLabelY(line: DistributionFitReferenceLine): number {
  if (props.selectableSigmaLevels) {
    return line.id === "lower-spec-limit" || line.id === "target" || line.id === "upper-spec-limit"
      ? 18
      : 39;
  }
  return 18 + (referenceLabelRows.value[line.id] ?? 0) * 17;
}
</script>

<template>
  <figure
    class="distribution-fit-plot"
    :data-distribution-plot="candidate.family"
    :aria-label="`${candidate.family.charAt(0).toUpperCase()}${candidate.family.slice(1)} frequency histogram and fitted expected frequency curve`"
  >
    <fieldset
      v-if="selectableSigmaLevels"
      class="distribution-fit-sigma-controls response-sigma-controls"
      data-distribution-sigma-controls
    >
      <legend class="sr-only">Visible sample sigma levels</legend>
      <label v-for="level in sigmaLevels" :key="level.value">
        <input
          v-model="sigmaVisibility[level.value]"
          type="checkbox"
          :data-distribution-sigma-level="level.value"
        >
        ±{{ level.value }}σ
      </label>
    </fieldset>
    <div class="distribution-fit-plot-graphic" data-distribution-plot-graphic>
      <svg viewBox="0 0 800 332" role="img" :aria-labelledby="titleId">
      <title :id="titleId">{{ candidate.family }} observed frequency histogram and fitted expected frequency curve</title>
      <g v-for="(tick, index) in model.frequencyTicks" :key="`frequency-${index}`" data-frequency-axis-tick>
        <line class="plot-grid" :x1="margin.left" :x2="width - margin.right" :y1="yPosition(tick)" :y2="yPosition(tick)" />
        <line class="plot-tick" :x1="margin.left - 5" :x2="margin.left" :y1="yPosition(tick)" :y2="yPosition(tick)" />
        <text class="plot-tick-label" :x="margin.left - 8" :y="yPosition(tick) + 4" text-anchor="end">{{ formatAxis(tick) }}</text>
      </g>
      <line class="plot-axis" :x1="margin.left" :x2="width - margin.right" :y1="height - margin.bottom" :y2="height - margin.bottom" />
      <line class="plot-axis" :x1="margin.left" :x2="margin.left" :y1="margin.top" :y2="height - margin.bottom" />
      <rect
        v-for="(bin, index) in model.bins"
        :key="index"
        data-histogram-bin
        class="histogram-bin"
        :x="xPosition(bin.minimum)"
        :y="yPosition(bin.frequency)"
        :width="Math.max(1, xPosition(bin.maximum) - xPosition(bin.minimum) - 1)"
        :height="height - margin.bottom - yPosition(bin.frequency)"
      />
      <g
        v-for="line in visibleReferences"
        :key="line.id"
        data-reference-line
        :data-reference-line-id="line.id"
        :data-reference-sigma-level="referenceSigma(line.id)"
      >
        <rect
          data-reference-label-background
          class="plot-reference-label-background"
          :x="line.labelX - line.labelWidth / 2"
          :y="line.labelY - 12"
          :width="line.labelWidth"
          height="16"
          rx="3"
        />
        <line
          :class="['plot-reference-line', referenceClass(line)]"
          :x1="xPosition(line.value)"
          :x2="xPosition(line.value)"
          :y1="margin.top"
          :y2="height - margin.bottom"
        />
        <text
          data-reference-label
          :class="['plot-reference-label', referenceClass(line)]"
          :x="line.labelX"
          :y="line.labelY"
          text-anchor="middle"
        >{{ referenceLabel(line) }}</text>
      </g>
      <path
        v-if="assumption"
        data-factor-setup-assumption-curve
        class="factor-setup-assumption-curve"
        :d="assumptionCurvePath"
      />
      <path data-fitted-density-curve class="fitted-density-curve" :d="curvePath" />
      <g v-for="(tick, index) in model.ticks" :key="index" data-axis-tick>
        <line class="plot-tick" :x1="xPosition(tick)" :x2="xPosition(tick)" :y1="height - margin.bottom" :y2="height - margin.bottom + 5" />
        <text class="plot-tick-label" :x="xPosition(tick)" :y="height - 18" text-anchor="middle">{{ formatXAxis(tick) }}</text>
      </g>
      <text class="plot-axis-label" :x="margin.left + plotWidth / 2" :y="height - 2" text-anchor="middle">Observed value</text>
        <text class="plot-axis-label" transform="translate(14 157) rotate(-90)" text-anchor="middle">Frequency (pcs)</text>
      </svg>
    </div>
    <figcaption class="distribution-fit-plot-explanation" data-distribution-plot-explanation>
      <section class="plot-explanation-group" data-plot-legend aria-label="Plot legend">
        <h4>Legend</h4>
        <span><i class="histogram-legend" /> Observed frequency</span>
        <span><i class="curve-legend" /> Fitted {{ candidate.family }} expected frequency</span>
        <span v-if="assumption"><i class="assumption-curve-legend" /> Factor Setup assumption</span>
        <span>n = {{ candidate.qqPoints.length }}</span>
      </section>
      <section
        v-if="assumption"
        class="plot-explanation-group"
        data-factor-setup-assumption-details
        aria-label="Factor Setup assumption parameters"
      >
        <h4>Factor Setup</h4>
        <p>
          {{ assumption.distribution }} · |Mean| {{ formatAxis(assumption.mean) }} ·
          1σ {{ formatAxis(assumption.standardDeviation) }} · LTSF {{ formatAxis(assumption.longTermSafetyFactor) }} ·
          σ Level {{ formatAxis(assumption.sigmaLevel) }}
        </p>
      </section>
      <section class="plot-explanation-group" aria-label="Plot references">
        <h4>References</h4>
        <dl class="plot-reference-values" data-plot-references>
          <dt>LSL</dt>
          <dd>{{ formatAxis(references.lowerSpecificationLimit) }}</dd>
          <dt>USL</dt>
          <dd>{{ formatAxis(references.upperSpecificationLimit) }}</dd>
          <dt>Target</dt>
          <dd>{{ formatAxis(references.target) }} (midpoint-derived)</dd>
          <dt>Mean</dt>
          <dd>{{ formatAxis(references.mean) }}</dd>
          <template v-for="level in displayedSigmaLevels" :key="level.value">
            <dt>±{{ level.value }}σ (sample)</dt>
            <dd>{{ formatAxis(level.numericValue * references.sampleStandardDeviation) }}</dd>
          </template>
        </dl>
      </section>
    </figcaption>
  </figure>
</template>