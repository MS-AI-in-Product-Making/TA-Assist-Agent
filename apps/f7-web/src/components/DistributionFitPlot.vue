<script setup lang="ts">
import { computed } from "vue";
import {
  buildDistributionFitPlot,
  buildReferenceLabelRows,
  type FactorSetupAssumption,
  type DistributionFitObservedDomain,
  type DistributionFitPlotCandidate,
  type DistributionFitReferenceLine,
  type DistributionFitReferences,
} from "../distribution-fit-plot";

const props = defineProps<{
  readonly candidate: DistributionFitPlotCandidate;
  readonly observedDomain: DistributionFitObservedDomain;
  readonly references: DistributionFitReferences;
  readonly assumption: FactorSetupAssumption | undefined;
}>();

const width = 800;
const height = 332;
const margin = { top: 88, right: 18, bottom: 42, left: 62 } as const;
const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;
const model = computed(() => buildDistributionFitPlot(props.candidate, props.observedDomain, props.assumption));
const referenceLabelRows = computed(() => buildReferenceLabelRows(
  props.references.lines,
  model.value.domainMinimum,
  model.value.domainMaximum,
  plotWidth,
));
const titleId = computed(() => `distribution-fit-${props.candidate.family}-title`);

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

function referenceLabel(line: DistributionFitReferenceLine): string {
  const labels: Record<DistributionFitReferenceLine["id"], string> = {
    "lower-spec-limit": "LSL",
    "upper-spec-limit": "USL",
    target: "Target",
    mean: "Mean",
    "minus-3-sigma": "−3σ",
    "plus-3-sigma": "+3σ",
    "minus-4-sigma": "−4σ",
    "plus-4-sigma": "+4σ",
  };
  return labels[line.id];
}

function referenceClass(line: DistributionFitReferenceLine): string {
  if (line.id.includes("spec-limit")) return "reference-spec";
  if (line.id === "target" || line.id === "mean") return `reference-${line.id}`;
  return line.id.includes("3-sigma") ? "reference-3-sigma" : "reference-4-sigma";
}

function referenceLabelY(line: DistributionFitReferenceLine): number {
  return 18 + (referenceLabelRows.value[line.id] ?? 0) * 17;
}
</script>

<template>
  <figure
    class="distribution-fit-plot"
    :data-distribution-plot="candidate.family"
    :aria-label="`${candidate.family.charAt(0).toUpperCase()}${candidate.family.slice(1)} frequency histogram and fitted expected frequency curve`"
  >
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
        v-for="line in references.lines"
        :key="line.id"
        data-reference-line
        :data-reference-line-id="line.id"
      >
        <rect
          data-reference-label-background
          class="plot-reference-label-background"
          :x="xPosition(line.value) - 24"
          :y="referenceLabelY(line) - 12"
          width="48"
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
          :x="xPosition(line.value)"
          :y="referenceLabelY(line)"
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
          <dt>±3σ (sample)</dt>
          <dd>{{ formatAxis(3 * references.sampleStandardDeviation) }}</dd>
          <dt>±4σ (sample)</dt>
          <dd>{{ formatAxis(4 * references.sampleStandardDeviation) }}</dd>
        </dl>
      </section>
    </figcaption>
  </figure>
</template>