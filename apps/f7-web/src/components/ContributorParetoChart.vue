<script setup lang="ts">
import { computed } from "vue";

export interface ContributorPriority {
  readonly factorName: string;
  readonly reference: string;
  readonly designNominal: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly contributionPercent: number;
  readonly cumulativePercent: number;
}

const props = defineProps<{
  readonly contributors: readonly ContributorPriority[];
}>();

const chartWidth = computed(() => Math.max(560, props.contributors.length * 88 + 72));
const plotWidth = computed(() => chartWidth.value - 72);
const barWidth = computed(() => Math.min(46, plotWidth.value / Math.max(props.contributors.length, 1) * 0.58));

function xFor(index: number): number {
  return 48 + (index + 0.5) * (plotWidth.value / props.contributors.length);
}

function yFor(percent: number): number {
  return 176 - Math.min(100, Math.max(0, percent)) * 1.36;
}

const cumulativePoints = computed(() => props.contributors
  .map((contributor, index) => `${xFor(index)},${yFor(contributor.cumulativePercent)}`)
  .join(" "));

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDimension(value: number): string {
  return value.toLocaleString("en-US", { maximumSignificantDigits: 6, useGrouping: false });
}

function formatUpperTolerance(value: number): string {
  const formatted = formatDimension(value);
  return value > 0 ? `+${formatted}` : formatted;
}
</script>

<template>
  <figure
    class="contributor-pareto"
    data-contributor-pareto
  >
    <div
      class="pareto-layout"
      data-pareto-layout
    >
      <div
        class="pareto-chart-pane"
        data-pareto-chart-pane
      >
        <div class="pareto-chart-scroll">
          <svg
            :viewBox="`0 0 ${chartWidth} 220`"
            :style="{ width: `${chartWidth}px` }"
            role="img"
            aria-labelledby="contributor-pareto-title contributor-pareto-description"
          >
            <title id="contributor-pareto-title">Contributor priority Pareto chart</title>
            <desc id="contributor-pareto-description">
              Contributors are ranked from highest to lowest percent contribution to sigma. Bars show individual contribution and the line shows cumulative contribution.
            </desc>
            <g
              class="pareto-grid"
              aria-hidden="true"
            >
              <line
                v-for="tick in [0, 25, 50, 75, 100]"
                :key="tick"
                x1="48"
                :x2="chartWidth - 24"
                :y1="yFor(tick)"
                :y2="yFor(tick)"
              />
              <text
                v-for="tick in [0, 25, 50, 75, 100]"
                :key="`label-${tick}`"
                x="40"
                :y="yFor(tick) + 4"
                text-anchor="end"
              >{{ tick }}%</text>
            </g>
            <g aria-hidden="true">
              <rect
                v-for="(contributor, index) in contributors"
                :key="contributor.reference"
                data-pareto-bar
                :data-factor-name="contributor.factorName"
                :data-contribution="contributor.contributionPercent"
                class="pareto-bar"
                :x="xFor(index) - barWidth / 2"
                :y="yFor(contributor.contributionPercent)"
                :width="barWidth"
                :height="176 - yFor(contributor.contributionPercent)"
                rx="2"
              />
              <text
                v-for="(contributor, index) in contributors"
                :key="`bar-label-${contributor.reference}`"
                data-pareto-bar-label
                :data-factor-name="contributor.factorName"
                class="pareto-bar-label"
                :x="xFor(index)"
                :y="Math.max(12, yFor(contributor.contributionPercent) - 6)"
                text-anchor="middle"
              >{{ formatPercent(contributor.contributionPercent) }}</text>
              <polyline
                data-pareto-cumulative-line
                class="pareto-line"
                :points="cumulativePoints"
              />
              <circle
                v-for="(contributor, index) in contributors"
                :key="`point-${contributor.reference}`"
                class="pareto-point"
                :cx="xFor(index)"
                :cy="yFor(contributor.cumulativePercent)"
                r="3.5"
              />
              <text
                v-for="(contributor, index) in contributors"
                :key="`rank-${contributor.reference}`"
                :x="xFor(index)"
                y="201"
                text-anchor="middle"
              >{{ index + 1 }}</text>
            </g>
          </svg>
        </div>
        <div
          class="pareto-legend"
          aria-hidden="true"
        >
          <span><i class="legend-bar" />% Cont. to σ</span>
          <span><i class="legend-line" />Cumulative %</span>
        </div>
      </div>
      <div
        class="pareto-table-scroll"
        data-pareto-table-pane
        role="region"
        aria-label="Contributor priority details"
        tabindex="0"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">
                Priority
              </th>
              <th scope="col">
                Contributor
              </th>
              <th scope="col">
                Design Nominal
              </th>
              <th scope="col">
                + Tol
              </th>
              <th scope="col">
                - Tol
              </th>
              <th scope="col">
                % Cont. to σ
              </th>
              <th scope="col">
                Cumulative
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(contributor, index) in contributors"
              :key="`row-${contributor.reference}`"
              data-pareto-rank-row
            >
              <td>{{ index + 1 }}</td>
              <th scope="row">
                {{ contributor.factorName }}
              </th>
              <td>{{ formatDimension(contributor.designNominal) }}</td>
              <td>{{ formatUpperTolerance(contributor.upperTolerance) }}</td>
              <td>{{ formatDimension(contributor.lowerTolerance) }}</td>
              <td>{{ formatPercent(contributor.contributionPercent) }}</td>
              <td>{{ formatPercent(contributor.cumulativePercent) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.contributor-pareto {
  margin: 8px 0 2px;
}

.pareto-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(560px, 1.15fr);
  gap: 14px;
  align-items: start;
}

.pareto-chart-scroll,
.pareto-table-scroll {
  max-width: 100%;
  overflow-x: auto;
}

svg {
  display: block;
  min-width: 560px;
  max-width: none;
  height: auto;
  border-bottom: 1px solid var(--line);
}

.pareto-grid line {
  stroke: color-mix(in srgb, var(--line) 72%, transparent);
  stroke-width: 1;
}

.pareto-grid text,
svg text {
  fill: var(--ink-soft);
  font-size: 10px;
}

.pareto-bar {
  fill: var(--accent);
  opacity: 0.82;
}

.pareto-bar-label {
  fill: var(--ink);
  font-weight: 700;
}

.pareto-line {
  fill: none;
  stroke: var(--danger);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.5;
}

.pareto-point {
  fill: #fff;
  stroke: var(--danger);
  stroke-width: 2;
}

.pareto-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 6px 0 0;
  color: var(--ink-soft);
  font-size: 0.76rem;
}

.pareto-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pareto-legend i {
  display: inline-block;
  width: 18px;
}

.legend-bar {
  height: 8px;
  border-radius: 2px;
  background: var(--accent);
  opacity: 0.82;
}

.legend-line {
  height: 0;
  border-top: 2px solid var(--danger);
}

table {
  width: 100%;
  min-width: 650px;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 900px) {
  .pareto-layout {
    grid-template-columns: 1fr;
  }
}

th,
td {
  padding: 5px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 65%, transparent);
  text-align: left;
}

thead th {
  color: var(--ink-soft);
  font-size: 0.74rem;
  font-weight: 700;
}

tbody th,
tbody td {
  font-size: 0.8rem;
}

td:first-child {
  width: 58px;
}
</style>