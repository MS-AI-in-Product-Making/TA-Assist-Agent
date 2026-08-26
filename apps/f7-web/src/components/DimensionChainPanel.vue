<script setup lang="ts">
import { computed, ref, useId } from "vue";
import {
  buildDimensionChainGeometry,
  dimensionChainSignature,
  type DimensionChainFactor,
  type DimensionChainSegment,
} from "./dimension-chain";

const props = defineProps<{
  readonly factors: readonly DimensionChainFactor[];
  readonly valid: boolean;
  readonly sourceSignature?: string;
}>();

const AXIS_PADDING = 64;
const LANE_SIZE = 58;
const MIN_CANVAS_SIZE = 360;
const orientation = ref<"horizontal" | "vertical">("horizontal");
const generatedFactors = ref<readonly DimensionChainFactor[]>();
const generatedSourceSignature = ref("");
const markerSuffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
const additiveMarkerId = `dimension-chain-additive-arrow-${markerSuffix}`;
const subtractiveMarkerId = `dimension-chain-subtractive-arrow-${markerSuffix}`;
const closureMarkerId = `dimension-chain-closure-${markerSuffix}`;

const currentSignature = computed(() => props.sourceSignature ?? dimensionChainSignature(props.factors));
const stale = computed(() => (
  generatedFactors.value !== undefined && currentSignature.value !== generatedSourceSignature.value
));
const geometry = computed(() => (
  generatedFactors.value ? buildDimensionChainGeometry(generatedFactors.value) : undefined
));
const positionSpan = computed(() => {
  const value = geometry.value;
  return value ? value.maxPosition - value.minPosition : 0;
});
const canvasWidth = computed(() => orientation.value === "horizontal"
  ? Math.max(MIN_CANVAS_SIZE, positionSpan.value + AXIS_PADDING * 2)
  : Math.max(MIN_CANVAS_SIZE, (geometry.value?.segments.length ?? 0) * LANE_SIZE + 150));
const canvasHeight = computed(() => orientation.value === "horizontal"
  ? Math.max(190, ((geometry.value?.segments.length ?? 0) + 1) * LANE_SIZE + 68)
  : Math.max(MIN_CANVAS_SIZE, positionSpan.value + AXIS_PADDING * 2));
const actionLabel = computed(() => {
  if (!generatedFactors.value) return "Generate";
  return stale.value ? "Update" : "Generated";
});

function generate(): void {
  if (!props.valid) return;
  generatedFactors.value = props.factors.map((factor) => ({ ...factor }));
  generatedSourceSignature.value = currentSignature.value;
}

function axisPosition(position: number): number {
  return AXIS_PADDING + position - (geometry.value?.minPosition ?? 0);
}

function lanePosition(index: number): number {
  return 48 + index * LANE_SIZE;
}

function signedValue(value: number): string {
  if (value > 0) return `+${formatValue(value)}`;
  return formatValue(value);
}

function formatValue(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toLocaleString("en-US", { maximumFractionDigits: 4, useGrouping: false });
}

function segmentLabel(segment: DimensionChainSegment): string {
  const role = segment.direction === "additive"
    ? "additive"
    : segment.direction === "subtractive"
      ? "subtractive"
      : "zero";
  return `Item ${segment.itemNumber}, ${segment.name}, ${signedValue(segment.designNominal)}, ${role}`;
}

function displayName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

function componentMarkerId(segment: DimensionChainSegment): string {
  return segment.direction === "subtractive" ? subtractiveMarkerId : additiveMarkerId;
}
</script>

<template>
  <section class="dimension-chain-panel" data-dimension-chain-panel aria-labelledby="dimension-chain-title">
    <h3 id="dimension-chain-title">Dimension Chain</h3>
    <div class="dimension-chain-toolbar">
      <button
        type="button"
        class="action-button dimension-chain-action"
        data-generate-dimension-chain
        :disabled="!valid || (generatedFactors !== undefined && !stale)"
        @click="generate"
      >{{ actionLabel }}</button>
      <div class="dimension-chain-orientation" aria-label="Dimension chain orientation">
        <button
          type="button"
          aria-label="Horizontal dimension chain"
          :aria-pressed="orientation === 'horizontal'"
          :class="{ 'is-active': orientation === 'horizontal' }"
          @click="orientation = 'horizontal'"
        >Horizontal</button>
        <button
          type="button"
          aria-label="Vertical dimension chain"
          :aria-pressed="orientation === 'vertical'"
          :class="{ 'is-active': orientation === 'vertical' }"
          @click="orientation = 'vertical'"
        >Vertical</button>
      </div>
    </div>

    <p v-if="stale" class="dimension-chain-stale" data-dimension-chain-stale role="status">
      Factor Setup changed. Select Update to refresh the dimension chain.
    </p>

    <div v-if="geometry" class="dimension-chain-canvas">
      <svg
        data-dimension-chain-svg
        :data-orientation="orientation"
        :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
        :width="canvasWidth"
        :height="canvasHeight"
        role="img"
      >
        <title>Dimension chain</title>
        <desc>{{ geometry.segments.length }} component loops in {{ orientation }} orientation. Filled dots mark starts and arrowheads mark ends.</desc>
        <defs>
          <marker
            :id="additiveMarkerId"
            data-dimension-component-marker
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="dimension-chain-additive-head" />
          </marker>
          <marker
            :id="subtractiveMarkerId"
            data-dimension-component-marker
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="dimension-chain-subtractive-head" />
          </marker>
          <marker
            :id="closureMarkerId"
            data-dimension-closure-marker
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="dimension-chain-closure-head" />
          </marker>
        </defs>

        <line
          v-if="orientation === 'horizontal'"
          data-dimension-origin-guide
          class="dimension-chain-origin-guide"
          :x1="axisPosition(0)"
          :x2="axisPosition(0)"
          :y1="lanePosition(0)"
          :y2="lanePosition(geometry.segments.length)"
        />
        <line
          v-else
          data-dimension-origin-guide
          class="dimension-chain-origin-guide"
          :x1="lanePosition(0)"
          :x2="lanePosition(geometry.segments.length)"
          :y1="axisPosition(0)"
          :y2="axisPosition(0)"
        />

        <g v-for="(segment, index) in geometry.segments" :key="segment.id">
          <line
            v-if="index > 0 && orientation === 'horizontal'"
            class="dimension-chain-guide"
            :x1="axisPosition(segment.start)"
            :x2="axisPosition(segment.start)"
            :y1="lanePosition(index - 1)"
            :y2="lanePosition(index)"
          />
          <line
            v-if="index > 0 && orientation === 'vertical'"
            class="dimension-chain-guide"
            :x1="lanePosition(index - 1)"
            :x2="lanePosition(index)"
            :y1="axisPosition(segment.start)"
            :y2="axisPosition(segment.start)"
          />
          <g
            :data-dimension-segment="segment.itemNumber"
            :data-direction="segment.direction"
            :data-value="segment.designNominal"
            :data-length="segment.length"
            :class="`dimension-chain-${segment.direction}`"
            role="img"
            :aria-label="segmentLabel(segment)"
          >
            <title>{{ segmentLabel(segment) }}</title>
            <template v-if="orientation === 'horizontal'">
              <circle
                data-dimension-start
                class="dimension-chain-start"
                :cx="axisPosition(segment.start)"
                :cy="lanePosition(index)"
                r="4.5"
              />
              <line
                v-if="segment.direction !== 'zero'"
                class="dimension-chain-component"
                :x1="axisPosition(segment.start)"
                :x2="axisPosition(segment.end)"
                :y1="lanePosition(index)"
                :y2="lanePosition(index)"
                :marker-end="`url(#${componentMarkerId(segment)})`"
              />
              <line
                v-else
                data-dimension-zero
                class="dimension-chain-zero"
                :x1="axisPosition(segment.start)"
                :x2="axisPosition(segment.start)"
                :y1="lanePosition(index) - 9"
                :y2="lanePosition(index) + 9"
              />
              <text
                class="dimension-chain-label"
                :x="(axisPosition(segment.start) + axisPosition(segment.end)) / 2"
                :y="lanePosition(index) - 13"
                text-anchor="middle"
              >Item {{ segment.itemNumber }} · {{ signedValue(segment.designNominal) }}</text>
              <text
                class="dimension-chain-factor-name"
                :x="(axisPosition(segment.start) + axisPosition(segment.end)) / 2"
                :y="lanePosition(index) + 20"
                text-anchor="middle"
              >{{ displayName(segment.name) }}</text>
            </template>
            <template v-else>
              <circle
                data-dimension-start
                class="dimension-chain-start"
                :cx="lanePosition(index)"
                :cy="axisPosition(segment.start)"
                r="4.5"
              />
              <line
                v-if="segment.direction !== 'zero'"
                class="dimension-chain-component"
                :x1="lanePosition(index)"
                :x2="lanePosition(index)"
                :y1="axisPosition(segment.start)"
                :y2="axisPosition(segment.end)"
                :marker-end="`url(#${componentMarkerId(segment)})`"
              />
              <line
                v-else
                data-dimension-zero
                class="dimension-chain-zero"
                :x1="lanePosition(index) - 9"
                :x2="lanePosition(index) + 9"
                :y1="axisPosition(segment.start)"
                :y2="axisPosition(segment.start)"
              />
              <text
                class="dimension-chain-label"
                :x="lanePosition(index) + 13"
                :y="(axisPosition(segment.start) + axisPosition(segment.end)) / 2 - 4"
              >Item {{ segment.itemNumber }} · {{ signedValue(segment.designNominal) }}</text>
              <text
                class="dimension-chain-factor-name"
                :x="lanePosition(index) + 13"
                :y="(axisPosition(segment.start) + axisPosition(segment.end)) / 2 + 13"
              >{{ displayName(segment.name) }}</text>
            </template>
          </g>
        </g>

        <g aria-label="Closure loop">
          <template v-if="orientation === 'horizontal'">
            <line
              class="dimension-chain-guide"
              :x1="axisPosition(geometry.closure.start)"
              :x2="axisPosition(geometry.closure.start)"
              :y1="lanePosition(geometry.segments.length - 1)"
              :y2="lanePosition(geometry.segments.length)"
            />
            <circle
              data-dimension-closure-start
              class="dimension-chain-closure-start"
              :cx="axisPosition(geometry.closure.start)"
              :cy="lanePosition(geometry.segments.length)"
              r="4.5"
            />
            <path
              v-if="geometry.closure.start === geometry.closure.end"
              data-dimension-closure
              class="dimension-chain-closure"
              :d="`M ${axisPosition(0)} ${lanePosition(geometry.segments.length)} c 28 -24 28 24 0 0`"
              :marker-end="`url(#${closureMarkerId})`"
              fill="none"
            />
            <line
              v-else
              data-dimension-closure
              class="dimension-chain-closure"
              :x1="axisPosition(geometry.closure.start)"
              :x2="axisPosition(geometry.closure.end)"
              :y1="lanePosition(geometry.segments.length)"
              :y2="lanePosition(geometry.segments.length)"
              :marker-end="`url(#${closureMarkerId})`"
            />
            <text
              class="dimension-chain-closure-label"
              :x="(axisPosition(geometry.closure.start) + axisPosition(geometry.closure.end)) / 2"
              :y="lanePosition(geometry.segments.length) - 13"
              text-anchor="middle"
            >Closure</text>
          </template>
          <template v-else>
            <line
              class="dimension-chain-guide"
              :x1="lanePosition(geometry.segments.length - 1)"
              :x2="lanePosition(geometry.segments.length)"
              :y1="axisPosition(geometry.closure.start)"
              :y2="axisPosition(geometry.closure.start)"
            />
            <circle
              data-dimension-closure-start
              class="dimension-chain-closure-start"
              :cx="lanePosition(geometry.segments.length)"
              :cy="axisPosition(geometry.closure.start)"
              r="4.5"
            />
            <path
              v-if="geometry.closure.start === geometry.closure.end"
              data-dimension-closure
              class="dimension-chain-closure"
              :d="`M ${lanePosition(geometry.segments.length)} ${axisPosition(0)} c -24 28 24 28 0 0`"
              :marker-end="`url(#${closureMarkerId})`"
              fill="none"
            />
            <line
              v-else
              data-dimension-closure
              class="dimension-chain-closure"
              :x1="lanePosition(geometry.segments.length)"
              :x2="lanePosition(geometry.segments.length)"
              :y1="axisPosition(geometry.closure.start)"
              :y2="axisPosition(geometry.closure.end)"
              :marker-end="`url(#${closureMarkerId})`"
            />
            <text
              class="dimension-chain-closure-label"
              :x="lanePosition(geometry.segments.length) + 13"
              :y="(axisPosition(geometry.closure.start) + axisPosition(geometry.closure.end)) / 2"
            >Closure</text>
          </template>
        </g>
      </svg>
      <ol class="sr-only" data-dimension-chain-accessible-list aria-label="Dimension chain components">
        <li v-for="segment in geometry.segments" :key="segment.id">{{ segmentLabel(segment) }}</li>
        <li>Closure, final cumulative position to origin</li>
      </ol>
    </div>
    <p v-else class="dimension-chain-empty">Generate a dimension chain from the current Factor Setup.</p>
  </section>
</template>
