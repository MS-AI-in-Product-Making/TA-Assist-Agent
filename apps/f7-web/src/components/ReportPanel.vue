<script setup lang="ts">
/* global Blob, document */
import { computed, toRaw, type DeepReadonly } from "vue";
import type { F7ReportProjection } from "../api/f7-client";
import MonteCarloHistogram from "./MonteCarloHistogram.vue";

const props = defineProps<{
  readonly report: DeepReadonly<F7ReportProjection>;
}>();

const emit = defineEmits<{
  close: [];
}>();

const assessmentContent = computed(() => ({
  MEETS_TARGET: {
    title: "Meets target",
    detail: "The simulated capability meets the governed target.",
  },
  BELOW_TARGET: {
    title: "Below target",
    detail: "The simulated capability is below the governed target.",
  },
  NOT_EVALUABLE: {
    title: "Not evaluable",
    detail: "Capability cannot be evaluated because the simulation has zero variance.",
  },
}[props.report.assessment]));

const simulation = computed(() => toRaw(props.report.simulation));

function formatScientific(value: number): string {
  return value.toExponential(2)
    .replace(/\.0+(?=e)/, "")
    .replace(/(\.\d*?)0+(?=e)/, "$1")
    .replace("e+", "e");
}

function formatNumber(value: number): string {
  if (value !== 0 && Number.isFinite(value) && Math.abs(value) < 0.000001) {
    return formatScientific(value);
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatPercent(value: number): string {
  const percentage = value * 100;
  const distanceFromHundred = (1 - value) * 100;
  if (value < 1 && distanceFromHundred > 0 && distanceFromHundred < 0.000001) {
    return `100% - ${formatScientific(distanceFromHundred)}%`;
  }
  return `${formatNumber(percentage)}%`;
}

function formatReason(reason: string): string {
  const readable = reason.toLowerCase().replaceAll("_", " ");
  return `${readable[0]?.toUpperCase() ?? ""}${readable.slice(1)}`;
}

function specificationSource(
  label: string,
  field: keyof F7ReportProjection["evidence"]["specificationInputOrigins"],
): string {
  const origin = props.report.evidence.specificationInputOrigins[field];
  if (origin === "manual_override") return `${label}: Manual override`;
  if (origin === "manual_entry") return `${label}: Manual entry`;
  const sourceCell = props.report.evidence.specificationSourceCells[field];
  return `${label}: Excel source ${sourceCell!}`;
}

function safeDownloadBase(fileName: string): string {
  const basename = fileName.split(/[\\/]/).pop() ?? "";
  const withoutExtension = basename.replace(/\.[^.]*$/, "");
  const safeBase = withoutExtension
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return safeBase || "f7";
}

function downloadMarkdown(): void {
  const blob = new Blob([props.report.markdown], { type: "text/markdown;charset=utf-8" });
  let objectUrl: string | undefined;
  let appended = false;
  const anchor = document.createElement("a");

  try {
    objectUrl = URL.createObjectURL(blob);
    anchor.href = objectUrl;
    anchor.download = `${safeDownloadBase(props.report.workbook.fileName)}-f7-report.md`;
    document.body.append(anchor);
    appended = true;
    anchor.click();
  } finally {
    try {
      if (appended) anchor.remove();
    } finally {
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
    }
  }
}
</script>

<template>
  <section class="workbench-panel report-panel" aria-labelledby="report-title">
    <header class="factor-workspace-header report-header">
      <div>
        <p class="workspace-eyebrow">Step 6</p>
        <h2 id="report-title">F7 analysis report</h2>
        <p class="subtle">{{ report.workbook.fileName }} · {{ report.workbook.worksheetName }}</p>
      </div>
      <div class="report-actions">
        <button type="button" class="action-button" data-download-report @click="downloadMarkdown">
          Download Markdown
        </button>
        <button type="button" class="workspace-close-button" data-report-back @click="emit('close')">
          Back to Monte Carlo
        </button>
      </div>
    </header>

    <section
      class="assessment-banner"
      :class="`assessment-${report.assessment.toLowerCase()}`"
      data-report-assessment
      :data-assessment="report.assessment"
      role="status"
      aria-live="polite"
    >
      <div>
        <p class="assessment-label">Governed assessment</p>
        <h3>{{ assessmentContent.title }}</h3>
        <p>{{ assessmentContent.detail }}</p>
      </div>
      <p class="assessment-disclaimer">
        This statistical assessment is not a design or production Release/Hold decision.
      </p>
    </section>

    <section aria-labelledby="report-metrics-title">
      <h3 id="report-metrics-title">Review summary</h3>
      <dl class="result-metrics report-metrics" data-report-metrics>
        <div><dt>Predicted yield</dt><dd>{{ formatPercent(report.summary.yield) }}</dd></div>
        <div><dt>Std. deviation</dt><dd>{{ formatNumber(report.summary.standardDeviation) }}</dd></div>
        <div v-if="report.summary.cp !== undefined" data-metric-cp>
          <dt>Cp</dt><dd>{{ formatNumber(report.summary.cp) }}</dd>
        </div>
        <div v-if="report.summary.cpk !== undefined" data-metric-cpk>
          <dt>Cpk</dt><dd>{{ formatNumber(report.summary.cpk) }}</dd>
        </div>
        <div><dt>Target Cpk</dt><dd>{{ formatNumber(report.summary.targetCpk) }}</dd></div>
        <div><dt>Observed PPM</dt><dd>{{ formatNumber(report.summary.ppm) }}</dd></div>
        <div v-if="report.simulation.capability.status === 'not_available'" class="capability-status">
          <dt>Capability status</dt>
          <dd>Not evaluable · {{ formatReason(report.simulation.capability.reason) }}</dd>
        </div>
      </dl>
    </section>

    <section class="distribution-section" aria-labelledby="report-distribution-title">
      <h3 id="report-distribution-title">Monte Carlo distribution</h3>
      <MonteCarloHistogram :result="simulation" />
    </section>

    <section aria-labelledby="simulation-summary-title">
      <h3 id="simulation-summary-title">Monte Carlo summary</h3>
      <dl class="simulation-summary">
        <div><dt>Mean</dt><dd>{{ formatNumber(report.simulation.mean) }}</dd></div>
        <div><dt>P0.135</dt><dd>{{ formatNumber(report.simulation.quantiles.p00135) }}</dd></div>
        <div><dt>P1</dt><dd>{{ formatNumber(report.simulation.quantiles.p01) }}</dd></div>
        <div><dt>P5</dt><dd>{{ formatNumber(report.simulation.quantiles.p05) }}</dd></div>
        <div><dt>Median (P50)</dt><dd>{{ formatNumber(report.simulation.quantiles.p50) }}</dd></div>
        <div><dt>P95</dt><dd>{{ formatNumber(report.simulation.quantiles.p95) }}</dd></div>
        <div><dt>P99</dt><dd>{{ formatNumber(report.simulation.quantiles.p99) }}</dd></div>
        <div><dt>P99.865</dt><dd>{{ formatNumber(report.simulation.quantiles.p99865) }}</dd></div>
        <div><dt>Lower limit</dt><dd>{{ formatNumber(report.simulation.lowerSpecLimit) }}</dd></div>
        <div><dt>Upper limit</dt><dd>{{ formatNumber(report.simulation.upperSpecLimit) }}</dd></div>
        <div><dt>Iterations</dt><dd>{{ report.simulation.iterations.toLocaleString("en-US") }}</dd></div>
        <div><dt>Correlation</dt><dd>{{ formatReason(report.simulation.correlationMode) }}</dd></div>
      </dl>
    </section>

    <section aria-labelledby="factor-models-title">
      <h3 id="factor-models-title">Factor models</h3>
      <div class="report-table-scroll">
        <table class="report-table" aria-label="Factor models">
          <caption>Factor models and governed source references</caption>
          <thead>
            <tr>
              <th scope="col">Factor</th>
              <th scope="col">Coefficient</th>
              <th scope="col">Source mode</th>
              <th scope="col">Distribution</th>
              <th scope="col">Source references</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="factor in report.factors" :key="factor.factorId">
              <th scope="row">{{ factor.factorName }}</th>
              <td>{{ factor.loopCoefficient }}</td>
              <td>{{ factor.sourceMode }}</td>
              <td>{{ factor.approvedDistribution }}</td>
              <td>{{ factor.sourceReferences.join(", ") }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <details class="evidence-details" data-report-evidence>
      <summary>Evidence chain</summary>
      <dl class="evidence-list">
        <div><dt>Workbook hash</dt><dd class="evidence-value long-value">{{ report.evidence.workbookContentHash }}</dd></div>
        <div><dt>Worksheet</dt><dd class="evidence-value">{{ report.evidence.worksheetName }}</dd></div>
        <div>
          <dt>Specification source cells</dt>
          <dd class="evidence-value">
            {{ specificationSource("LSL", "lowerSpecLimit") }};
            {{ specificationSource("USL", "upperSpecLimit") }};
            {{ specificationSource("Target sigma", "targetSigmaLevel") }}
          </dd>
        </div>
        <div>
          <dt>Method IDs</dt>
          <dd class="evidence-value">
            {{ report.evidence.methodIds.simulation }};
            {{ report.evidence.methodIds.histogram }};
            {{ report.evidence.methodIds.normalFit }}
          </dd>
        </div>
        <div><dt>Seed</dt><dd class="evidence-value long-value">{{ report.evidence.seed }}</dd></div>
        <div><dt>Iterations</dt><dd class="evidence-value">{{ report.evidence.iterations.toLocaleString("en-US") }}</dd></div>
        <div>
          <dt>Factor manifest</dt>
          <dd class="evidence-value">
            <ul class="manifest-list">
              <li v-for="factor in report.evidence.factorManifest" :key="factor.factorId">
                <span class="long-value">{{ factor.factorId }}</span> · {{ factor.family }} · {{ factor.sourceMode }}
              </li>
            </ul>
          </dd>
        </div>
        <div><dt>Generated at</dt><dd class="evidence-value">{{ report.generatedAt }}</dd></div>
      </dl>
    </details>
  </section>
</template>

<style scoped>
.report-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  border-top: 4px solid var(--accent);
}

.report-header,
.report-header > div,
.report-header h2,
.report-header .subtle {
  min-width: 0;
}

.report-header,
.report-header h2,
.report-header .subtle {
  overflow-wrap: anywhere;
}

.report-header h2,
.assessment-banner h3,
.report-panel section > h3 {
  margin: 0;
}

.report-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.report-actions button {
  margin-top: 0;
}

.assessment-banner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.8fr);
  gap: 16px;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--line);
  border-left: 6px solid var(--pending);
  padding: 14px 16px;
  background: #f4f5f6;
}

.assessment-banner p {
  margin: 4px 0 0;
}

.assessment-meets_target {
  border-left-color: var(--success);
  background: #edf7f4;
}

.assessment-below_target {
  border-left-color: var(--danger);
  background: #fbeceb;
}

.assessment-label {
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.assessment-disclaimer {
  border-left: 1px solid var(--line);
  padding-left: 16px;
  color: var(--ink-soft);
  font-weight: 700;
}

.report-metrics,
.simulation-summary {
  margin: 8px 0 0;
}

.capability-status {
  grid-column: span 2;
}

.distribution-section {
  min-width: 0;
}

.simulation-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.simulation-summary div {
  min-width: 0;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 8px 10px;
}

.simulation-summary dt,
.evidence-list dt {
  color: var(--ink-soft);
  font-size: 0.78rem;
}

.simulation-summary dd,
.evidence-list dd {
  margin: 3px 0 0;
  font-weight: 700;
}

.report-table-scroll {
  width: 100%;
  overflow-x: auto;
  margin-top: 8px;
}

.report-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  text-align: left;
}

.report-table caption {
  text-align: left;
  color: var(--ink-soft);
  padding-bottom: 6px;
}

.report-table th,
.report-table td {
  border: 1px solid var(--line);
  padding: 8px;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.report-table thead th {
  background: #edf0f3;
}

.evidence-details {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f7f8f7;
}

.evidence-details summary {
  cursor: pointer;
  padding: 11px 12px;
  font-weight: 700;
}

.evidence-details[open] summary {
  border-bottom: 1px solid var(--line);
}

.evidence-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  margin: 0;
  padding: 12px;
}

.evidence-list div {
  min-width: 0;
}

.evidence-value {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.long-value {
  min-width: 0;
  font-family: "Cascadia Mono", "Consolas", monospace;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.manifest-list {
  margin: 0;
  padding-left: 18px;
}

@media (max-width: 720px) {
  .report-header {
    align-items: stretch;
    flex-direction: column;
  }

  .assessment-banner {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .report-actions {
    justify-content: flex-start;
  }

  .assessment-disclaimer {
    border-top: 1px solid var(--line);
    border-left: 0;
    padding-top: 12px;
    padding-left: 0;
  }

  .evidence-list {
    grid-template-columns: 1fr;
  }

  .capability-status {
    grid-column: auto;
  }
}
</style>