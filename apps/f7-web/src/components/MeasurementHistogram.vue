<script setup lang="ts">
import { computed } from "vue";
import type { MeasurementDiagnostics } from "../measurement-diagnostics";

const props = defineProps<{
  readonly diagnostics: MeasurementDiagnostics;
}>();

const maximumCount = computed(() => Math.max(1, ...props.diagnostics.histogram.bins.map((bin) => bin.count)));
const shapeLabel = computed(() => ({
  insufficient_data: "Not enough data for a shape indication",
  approximately_symmetric: "Approximately symmetric",
  right_skewed: "Right-skewed",
  left_skewed: "Left-skewed",
  possibly_multimodal: "Possibly multimodal",
})[props.diagnostics.shape]);

function barX(index: number): number {
  return 36 + index * (520 / Math.max(1, props.diagnostics.histogram.bins.length));
}

function barWidth(): number {
  return Math.max(2, 520 / Math.max(1, props.diagnostics.histogram.bins.length) - 3);
}

function barHeight(count: number): number {
  return count / maximumCount.value * 150;
}

function format(value: number | undefined): string {
  return value === undefined ? "-" : value.toLocaleString("en-US", { maximumSignificantDigits: 6, useGrouping: false });
}
</script>

<template>
  <figure class="measurement-histogram" data-measurement-histogram>
    <div class="measurement-histogram-heading">
      <div>
        <p class="workspace-eyebrow">Live distribution view</p>
        <h4>Measurement Histogram</h4>
      </div>
      <strong data-measurement-shape>{{ shapeLabel }}</strong>
    </div>
    <svg viewBox="0 0 592 210" role="img" :aria-label="`Measurement histogram. ${shapeLabel}.`">
      <line x1="36" y1="174" x2="556" y2="174" class="histogram-axis" />
      <rect
        v-for="(bin, index) in diagnostics.histogram.bins"
        :key="`${bin.minimum}-${bin.maximum}`"
        :x="barX(index)"
        :y="174 - barHeight(bin.count)"
        :width="barWidth()"
        :height="barHeight(bin.count)"
        class="measurement-histogram-bar"
        :data-bin-count="bin.count"
      >
        <title>{{ format(bin.minimum) }} to {{ format(bin.maximum) }}: {{ bin.count }}</title>
      </rect>
      <text x="36" y="198" text-anchor="start">{{ format(diagnostics.minimum) }}</text>
      <text x="556" y="198" text-anchor="end">{{ format(diagnostics.maximum) }}</text>
    </svg>
    <figcaption>
      Shape indication is descriptive only. Normality is determined by the governed Distribution Fit analysis.
      <span class="sr-only" data-histogram-bin-summary>
        Histogram bins:
        <template v-for="bin in diagnostics.histogram.bins" :key="`${bin.minimum}-${bin.maximum}`">
          {{ format(bin.minimum) }} to {{ format(bin.maximum) }}: {{ bin.count }} measurements.
        </template>
      </span>
    </figcaption>
  </figure>
</template>
