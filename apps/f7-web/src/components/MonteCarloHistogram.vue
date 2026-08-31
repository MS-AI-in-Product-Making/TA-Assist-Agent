<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import { buildMonteCarloPlot, type MonteCarloReferenceId } from "../monte-carlo-plot";
import type { MonteCarloSetupSummary } from "../monte-carlo-setup-comparison";

type MonteCarloResult = NonNullable<F7SessionSnapshot["monteCarloResult"]>;
type AvailableSetupSummary = Extract<MonteCarloSetupSummary, { readonly available: true }>;

const props = defineProps<{
  readonly result: DeepReadonly<MonteCarloResult>;
  readonly setup?: DeepReadonly<AvailableSetupSummary>;
}>();
const model = computed(() => buildMonteCarloPlot({
  bins: props.result.histogram.bins,
  expectedBinCounts: props.result.normalFit.expectedBinCounts,
  lowerSpecLimit: props.result.lowerSpecLimit,
  upperSpecLimit: props.result.upperSpecLimit,
  mean: props.result.mean,
  standardDeviation: props.result.standardDeviation,
  targetSigmaLevel: props.result.targetSigmaLevel,
  ...(props.setup === undefined ? {} : {
    setup: {
      mean: props.setup.mean,
      std: props.setup.standardDeviation,
      iterations: props.result.iterations,
    },
  }),
}));

const labels: Record<MonteCarloReferenceId, string> = {
  "lower-spec-limit": "LSL",
  "upper-spec-limit": "USL",
  target: "Target",
  mean: "Mean",
  "minus-target-sigma": "−Target σ",
  "plus-target-sigma": "+Target σ",
};
const chartAriaLabel = computed(() => props.setup === undefined
  ? "Monte Carlo observed histogram and moment-fitted Normal curve"
  : "Monte Carlo observed histogram with Monte Carlo and Factor Setup Normal curves");
const chartDescription = computed(() => {
  const base = "In-spec bins are blue, out-of-spec bins are red, and bins crossing a specification limit are gray.";
  return props.setup === undefined
    ? `${base} The chart includes the Monte Carlo fitted Normal curve and specification, target, mean, and target sigma references.`
    : `${base} The chart includes the Monte Carlo fitted Normal curve, the Factor Setup TA Normal expected-count curve, and specification, target, Monte Carlo mean, Setup Mean, and target sigma references.`;
});

function xPosition(value: number): number {
  const range = model.value.domainMaximum / 2 - model.value.domainMinimum / 2;
  return range > 0
    ? 56 + ((value / 2 - model.value.domainMinimum / 2) / range) * 724
    : 418;
}

function yPosition(value: number): number {
  return 72 + (1 - value / model.value.maximumCount) * 206;
}

function formatTick(value: number): string {
  return value.toLocaleString("en-US", { maximumSignificantDigits: 4, useGrouping: false });
}
</script>

<template>
  <figure class="monte-carlo-histogram" :aria-label="chartAriaLabel">
    <div class="monte-carlo-chart-viewport">
      <svg viewBox="0 0 800 320" role="img" aria-labelledby="monte-carlo-chart-title monte-carlo-chart-description">
        <title id="monte-carlo-chart-title">Monte Carlo output distribution</title>
        <desc id="monte-carlo-chart-description">{{ chartDescription }}</desc>
        <g v-for="(tick, index) in model.yTicks" :key="`y-${index}`">
          <line class="plot-grid" x1="56" x2="780" :y1="yPosition(tick)" :y2="yPosition(tick)" />
          <text class="plot-tick-label" x="50" :y="yPosition(tick) + 4" text-anchor="end">{{ formatTick(tick) }}</text>
        </g>
        <line class="plot-axis" x1="56" x2="780" y1="278" y2="278" />
        <line class="plot-axis" x1="56" x2="56" y1="72" y2="278" />
        <rect
        v-for="(bar, index) in model.bars"
        :key="index"
        data-monte-carlo-bin
        :data-specification-status="bar.specificationStatus"
        :class="['monte-carlo-bin', `monte-carlo-bin-${bar.specificationStatus}`]"
        :x="bar.x"
        :y="bar.y"
        :width="bar.width"
        :height="bar.height"
        />
        <g
        v-for="reference in model.references"
        :key="reference.id"
        data-monte-carlo-reference
        :data-reference-id="reference.id"
      >
        <line
          :class="['monte-carlo-reference', `reference-${reference.id}`]"
          :x1="reference.x"
          :x2="reference.x"
          y1="72"
          y2="278"
        />
        <text class="monte-carlo-reference-label" :x="reference.x" :y="16 + reference.labelRow * 15" text-anchor="middle">
          {{ labels[reference.id] }}
        </text>
        </g>
        <path data-monte-carlo-fit class="monte-carlo-fit" :d="model.curvePath" />
        <path
          v-if="model.setupCurvePath"
          data-factor-setup-fit
          class="factor-setup-fit"
          :d="model.setupCurvePath"
        />
        <g
          v-if="model.setupMeanReference"
          data-factor-setup-mean
          class="factor-setup-mean"
        >
          <line
            :x1="model.setupMeanReference.x"
            :x2="model.setupMeanReference.x"
            y1="72"
            y2="278"
          />
          <text
            class="monte-carlo-reference-label"
            :x="model.setupMeanReference.x"
            :y="16 + model.setupMeanReference.labelRow * 15"
            text-anchor="middle"
          >Setup Mean</text>
        </g>
        <g v-for="(tick, index) in model.xTicks" :key="`x-${index}`">
          <line class="plot-tick" :x1="xPosition(tick)" :x2="xPosition(tick)" y1="278" y2="283" />
          <text class="plot-tick-label" :x="xPosition(tick)" y="298" text-anchor="middle">{{ formatTick(tick) }}</text>
        </g>
        <text class="plot-axis-label" x="418" y="316" text-anchor="middle">Simulated system output</text>
        <text class="plot-axis-label" transform="translate(15 175) rotate(-90)" text-anchor="middle">Count</text>
      </svg>
    </div>
    <figcaption class="monte-carlo-legend" data-monte-carlo-legend>
      <span><i class="monte-carlo-in-spec-legend" />In specification</span>
      <span><i class="monte-carlo-out-of-spec-legend" />Out of specification</span>
      <span><i class="monte-carlo-mixed-legend" />Crosses specification limit</span>
      <span><i class="monte-carlo-fit-legend" />Moment-fitted Normal expected count</span>
      <span v-if="model.setupCurvePath"><i class="factor-setup-fit-legend" />Factor Setup TA Normal expected count</span>
      <span v-if="model.setupMeanReference"><i class="factor-setup-mean-legend" />Setup Mean</span>
      <span><i class="monte-carlo-spec-legend" />Specification limits</span>
      <span><i class="monte-carlo-center-target-legend" />Target (specification midpoint)</span>
      <span><i class="monte-carlo-target-legend" />Target sigma range</span>
    </figcaption>
  </figure>
</template>