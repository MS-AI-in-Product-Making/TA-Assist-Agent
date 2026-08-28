<script setup lang="ts">
import { computed, reactive, type DeepReadonly, useId } from "vue";
import type { KernelCalculationResult } from "@ai-assist/workbook-catalog/calculation-kernel";
import {
  buildResponseDistributionPlot,
  type ResponseDistributionReferenceId,
} from "../response-distribution-plot";

type SigmaLevel = "3" | "4" | "4.5" | "6";

const props = defineProps<{
  readonly calculation?: DeepReadonly<KernelCalculationResult> | undefined;
}>();

const accessibleId = useId();
const sigmaVisibility = reactive<Record<SigmaLevel, boolean>>({
  "3": false,
  "4": true,
  "4.5": false,
  "6": true,
});

const model = computed(() => {
  const calculation = props.calculation;
  return calculation ? buildResponseDistributionPlot({
    mean: calculation.system.mean,
    standardDeviation: calculation.system.rssSigma,
    lowerSpecLimit: calculation.capability.lowerSpecLimit,
    upperSpecLimit: calculation.capability.upperSpecLimit,
  }) : undefined;
});

const referenceLabels: Readonly<Record<ResponseDistributionReferenceId, string>> = {
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
};

const sigmaLevels: readonly { readonly value: SigmaLevel; readonly label: string }[] = [
  { value: "3", label: "±3σ" },
  { value: "4", label: "±4σ" },
  { value: "4.5", label: "±4.5σ" },
  { value: "6", label: "±6σ" },
];

const visibleSigmaLevels = computed(() => sigmaLevels.filter(({ value }) => sigmaVisibility[value]));

const visibleReferences = computed(() => {
  const currentModel = model.value;
  if (!currentModel) return [];

  const badgeRows = [39, 24, 9] as const;
  const badgeGap = 3;
  const rowRightEdges: number[] = [];
  return currentModel.references
    .filter((reference) => {
      const sigma = referenceSigma(reference.id);
      return sigma === undefined || sigmaVisibility[sigma];
    })
    .map((reference) => {
      const badgeText = `${referenceLabels[reference.id]} ${formatBadgeValue(reference.value)}`;
      const badgeWidth = estimateBadgeWidth(badgeText);
      return {
        ...reference,
        badgeText,
        badgeWidth,
        badgeLeft: reference.x - badgeWidth / 2,
      };
    })
    .sort((left, right) => left.badgeLeft - right.badgeLeft)
    .map((reference) => {
      const row = rowRightEdges.findIndex(
        (rightEdge) => reference.badgeLeft >= rightEdge + badgeGap,
      );
      const badgeRow = row >= 0 ? row : rowRightEdges.length;
      rowRightEdges[badgeRow] = reference.badgeLeft + reference.badgeWidth;
      return {
        ...reference,
        badgeX: reference.x,
        badgeY: badgeRows[badgeRow] ?? badgeRows.at(-1)!,
      };
    });
});

const accessibleDescription = computed(() => {
  const calculation = props.calculation;
  return calculation ? [
    `Mean ${formatValue(calculation.system.mean)}`,
    `sigma ${formatValue(calculation.system.rssSigma)}`,
    `LSL ${formatValue(calculation.capability.lowerSpecLimit)}`,
    `USL ${formatValue(calculation.capability.upperSpecLimit)}`,
  ].join("; ") : "Normal distribution data is unavailable.";
});

function referenceSigma(id: ResponseDistributionReferenceId): SigmaLevel | undefined {
  if (id.includes("-3-sigma")) return "3";
  if (id.includes("-4-5-sigma")) return "4.5";
  if (id.includes("-4-sigma")) return "4";
  if (id.includes("-6-sigma")) return "6";
  return undefined;
}

function referenceClass(id: ResponseDistributionReferenceId): string {
  if (id === "lower-spec-limit" || id === "upper-spec-limit") return "response-reference-specification";
  if (id === "target") return "response-reference-target";
  if (id === "mean") return "response-reference-mean";
  const sigma = referenceSigma(id);
  return sigma === "4.5"
    ? "response-reference-sigma-4-5"
    : `response-reference-sigma-${sigma}`;
}

function formatValue(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatTick(value: number): string {
  return value.toLocaleString("en-US", {
    maximumSignificantDigits: 4,
    useGrouping: false,
  });
}

function formatBadgeValue(value: number): string {
  const magnitude = Math.abs(value);
  return magnitude >= 1_000_000 || (magnitude > 0 && magnitude < 0.001)
    ? value.toExponential(3)
    : formatValue(value);
}

function estimateBadgeWidth(text: string): number {
  const textWidth = Array.from(text).reduce((width, character) => {
    if (character === " " || character === "." || character === ",") return width + 2.5;
    if (character === "+" || character === "−" || character === "-") return width + 4;
    return width + 4.5;
  }, 0);
  return Math.min(82, Math.max(48, Math.ceil(textWidth + 10)));
}

function xPosition(value: number): number {
  const currentModel = model.value;
  if (!currentModel) return 398;
  const { minimum, maximum } = currentModel.domain;
  const range = maximum / 2 - minimum / 2;
  const fraction = range > 0 ? (value / 2 - minimum / 2) / range : 0.5;
  return currentModel.plotBounds.left
    + fraction * (currentModel.plotBounds.right - currentModel.plotBounds.left);
}
</script>

<template>
  <section
    class="response-distribution-curve"
    data-response-distribution-curve
  >
    <header class="response-distribution-header">
      <h3>Normal Distribution Curve</h3>
      <fieldset
        v-if="model"
        class="response-sigma-controls"
        data-response-sigma-controls
      >
        <legend>Sigma references</legend>
        <label
          v-for="level in sigmaLevels"
          :key="level.value"
        >
          <input
            v-model="sigmaVisibility[level.value]"
            type="checkbox"
            :value="level.value"
          >
          <span>{{ level.label }}</span>
        </label>
      </fieldset>
    </header>

    <figure
      v-if="model"
      class="response-distribution-figure"
    >
      <figcaption
        class="response-distribution-legend"
        data-response-legend
      >
        <span><i class="response-legend-normal" />Normal</span>
        <span><i class="response-legend-specification" />LSL / USL</span>
        <span><i class="response-legend-target" />Target</span>
        <span><i class="response-legend-mean" />Mean</span>
        <span
          v-for="level in visibleSigmaLevels"
          :key="level.value"
        >
          <i :class="`response-legend-sigma-${level.value.replace('.', '-')}`" />{{ level.label }}
        </span>
      </figcaption>

      <div
        class="response-distribution-viewport"
        tabindex="0"
        aria-label="Scrollable Normal distribution plot"
      >
        <svg
          viewBox="0 0 760 300"
          role="img"
          :aria-labelledby="`${accessibleId}-title ${accessibleId}-description`"
        >
          <title :id="`${accessibleId}-title`">Normal Distribution Curve</title>
          <desc :id="`${accessibleId}-description`">{{ accessibleDescription }}</desc>

          <line
            class="response-plot-axis"
            :x1="model.plotBounds.left"
            :x2="model.plotBounds.right"
            :y1="model.plotBounds.bottom"
            :y2="model.plotBounds.bottom"
          />

          <g
            data-response-reference-lines
          >
            <line
              v-for="reference in visibleReferences"
              :key="reference.id"
              :class="['response-reference-line', referenceClass(reference.id)]"
              :data-response-reference="reference.id"
              :data-response-sigma="referenceSigma(reference.id)"
              :data-value="formatValue(reference.value)"
              :x1="reference.x"
              :x2="reference.x"
              :y1="model.plotBounds.top"
              :y2="model.plotBounds.bottom"
            />
          </g>

          <g data-response-curve-layer>
            <path
              data-response-normal-curve
              class="response-normal-curve"
              :d="model.curvePath"
            />
          </g>

          <g
            v-for="(tick, index) in model.xTicks"
            :key="`tick-${index}`"
            data-response-tick
          >
            <line
              class="response-plot-tick"
              :x1="xPosition(tick)"
              :x2="xPosition(tick)"
              :y1="model.plotBounds.bottom"
              :y2="model.plotBounds.bottom + 5"
            />
            <text
              class="response-plot-tick-label"
              :x="xPosition(tick)"
              :y="model.plotBounds.bottom + 20"
              text-anchor="middle"
            >{{ formatTick(tick) }}</text>
          </g>
          <text
            class="response-axis-label"
            x="398"
            y="292"
            text-anchor="middle"
          >System response</text>

          <g data-response-reference-badges>
            <g
              v-for="reference in visibleReferences"
              :key="reference.id"
              class="response-reference-badge"
              :data-response-badge="reference.id"
              :transform="`translate(${reference.badgeX} ${reference.badgeY})`"
            >
              <rect
                :x="-reference.badgeWidth / 2"
                y="-8"
                :width="reference.badgeWidth"
                height="12"
                rx="2"
              />
              <text text-anchor="middle">{{ reference.badgeText }}</text>
            </g>
          </g>
        </svg>
      </div>
    </figure>

    <p
      v-else
      class="response-distribution-unavailable"
      data-response-distribution-unavailable
      role="status"
    >
      Normal distribution curve unavailable because system sigma is zero or invalid.
    </p>
  </section>
</template>