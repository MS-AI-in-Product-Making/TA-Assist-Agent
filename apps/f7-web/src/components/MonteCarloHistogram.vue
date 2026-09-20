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
  "minus-target-sigma": `−${props.result.targetSigmaLevel}σ`,
  "plus-target-sigma": `+${props.result.targetSigmaLevel}σ`,
};
const topReferenceIds = new Set<MonteCarloReferenceId>([
  "lower-spec-limit",
  "target",
  "upper-spec-limit",
]);
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
  return 82 + (1 - value / model.value.maximumCount) * 196;
}

function formatTick(value: number): string {
  return value.toLocaleString("en-US", { maximumSignificantDigits: 4, useGrouping: false });
}

function formatReference(value: number): string {
  return value.toFixed(4);
}

function referenceText(reference: { readonly id: MonteCarloReferenceId; readonly value: number }): string {
  return `${labels[reference.id]} ${formatReference(reference.value)}`;
}

function referenceRow(referenceId: MonteCarloReferenceId): "top" | "bottom" {
  return topReferenceIds.has(referenceId) ? "top" : "bottom";
}

function referenceRowY(row: "top" | "middle" | "bottom"): number {
  if (row === "top") return 5;
  if (row === "middle") return 31;
  return 57;
}

function referenceLabelWidth(text: string): number {
  return Math.min(160, Math.max(64, text.length * 6.3 + 12));
}

function referenceTextLength(text: string): number | undefined {
  return text.length * 6.3 + 12 > 160 ? 148 : undefined;
}

function referenceLabelX(x: number, text: string): number {
  const halfWidth = referenceLabelWidth(text) / 2;
  return Math.min(780 - halfWidth, Math.max(56 + halfWidth, x));
}

interface LabelLayoutItem {
  readonly id: string;
  readonly x: number;
  readonly text: string;
}

function layoutLabelRow(items: readonly LabelLayoutItem[]): ReadonlyMap<string, number> {
  const positioned = [...items]
    .sort((left, right) => left.x - right.x)
    .map((item) => ({ ...item, width: referenceLabelWidth(item.text), positionedX: referenceLabelX(item.x, item.text) }));
  for (let index = 1; index < positioned.length; index += 1) {
    const previous = positioned[index - 1]!;
    const current = positioned[index]!;
    current.positionedX = Math.max(current.positionedX, previous.positionedX + previous.width / 2 + current.width / 2);
  }
  for (let index = positioned.length - 1; index >= 0; index -= 1) {
    const current = positioned[index]!;
    const maximumX = index === positioned.length - 1
      ? 780 - current.width / 2
      : positioned[index + 1]!.positionedX - positioned[index + 1]!.width / 2 - current.width / 2;
    current.positionedX = Math.min(current.positionedX, maximumX);
  }
  return new Map(positioned.map((item) => [item.id, item.positionedX]));
}

const referenceLabelPositions = computed(() => {
  const rows = model.value.references.reduce<Record<"top" | "middle" | "bottom", LabelLayoutItem[]>>((result, reference) => {
    result[referenceRow(reference.id)].push({ id: reference.id, x: reference.x, text: referenceText(reference) });
    return result;
  }, { top: [], middle: [], bottom: [] });
  if (model.value.setupMeanReference !== undefined) {
    const setupReference = model.value.setupMeanReference;
    rows.middle.push({
      id: "setup-mean",
      x: setupReference.x,
      text: `Setup Mean ${formatReference(setupReference.value)}`,
    });
  }
  return new Map([
    ...layoutLabelRow(rows.top),
    ...layoutLabelRow(rows.middle),
    ...layoutLabelRow(rows.bottom),
  ]);
});

function positionedReferenceLabelX(reference: { readonly id: MonteCarloReferenceId; readonly x: number }): number {
  return referenceLabelPositions.value.get(reference.id) ?? reference.x;
}

function setupMeanLabelX(): number {
  return referenceLabelPositions.value.get("setup-mean") ?? 418;
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
        <line class="plot-axis" x1="56" x2="56" y1="82" y2="278" />
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
        :data-reference-row="referenceRow(reference.id)"
      >
        <line
          :class="['monte-carlo-reference', `reference-${reference.id}`]"
          :x1="reference.x"
          :x2="reference.x"
          y1="82"
          y2="278"
        />
        <g
          class="monte-carlo-reference-badge"
          :transform="`translate(${positionedReferenceLabelX(reference)} ${referenceRowY(referenceRow(reference.id))})`"
        >
          <rect
            :x="-referenceLabelWidth(referenceText(reference)) / 2"
            y="0"
            :width="referenceLabelWidth(referenceText(reference))"
            height="18"
            rx="2"
          />
          <text
            class="monte-carlo-reference-label"
            x="0"
            y="13"
            text-anchor="middle"
            :textLength="referenceTextLength(referenceText(reference))"
            :lengthAdjust="referenceTextLength(referenceText(reference)) === undefined ? undefined : 'spacingAndGlyphs'"
          >
            {{ referenceText(reference) }}
          </text>
        </g>
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
          data-reference-row="middle"
          class="factor-setup-mean"
        >
          <line
            :x1="model.setupMeanReference.x"
            :x2="model.setupMeanReference.x"
            y1="82"
            y2="278"
          />
          <g
            class="monte-carlo-reference-badge setup-mean-badge"
            :transform="`translate(${setupMeanLabelX()} ${referenceRowY('middle')})`"
          >
            <rect
              :x="-referenceLabelWidth(`Setup Mean ${formatReference(model.setupMeanReference.value)}`) / 2"
              y="0"
              :width="referenceLabelWidth(`Setup Mean ${formatReference(model.setupMeanReference.value)}`)"
              height="18"
              rx="2"
            />
            <text
              class="monte-carlo-reference-label"
              x="0"
              y="13"
              text-anchor="middle"
              :textLength="referenceTextLength(`Setup Mean ${formatReference(model.setupMeanReference.value)}`)"
              :lengthAdjust="referenceTextLength(`Setup Mean ${formatReference(model.setupMeanReference.value)}`) === undefined ? undefined : 'spacingAndGlyphs'"
            >
              Setup Mean {{ formatReference(model.setupMeanReference.value) }}
            </text>
          </g>
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