<script setup lang="ts">
/* global Blob, document */
import { computed, toRaw, type DeepReadonly } from "vue";
import type { F7ReportProjection } from "../api/f7-client";

const props = defineProps<{
  readonly report: DeepReadonly<F7ReportProjection>;
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

const analysis = computed(() => toRaw(props.report.analysis));

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
        <p class="workspace-eyebrow">Step 5 · F0 interpretation</p>
        <h2 id="report-title">TA interpretation and optimization report</h2>
        <p class="subtle">{{ report.workbook.fileName }} · {{ report.workbook.worksheetName }}</p>
      </div>
      <div class="report-actions">
        <button type="button" class="action-button" data-download-report @click="downloadMarkdown">
          Download Markdown
        </button>
      </div>
    </header>

    <section v-if="analysis?.status === 'available'" data-report-ta-comparison aria-labelledby="report-comparison-title">
      <div class="report-section-heading">
        <div>
          <p class="workspace-eyebrow">Assumption vs measured evidence</p>
          <h3 id="report-comparison-title">Factor Setup vs Monte Carlo TA</h3>
        </div>
        <p>{{ analysis.targetAssessment }}</p>
      </div>
      <div class="report-table-scroll">
        <table class="report-table">
          <caption>Factor Setup assumption and measured-data Monte Carlo comparison</caption>
          <thead>
            <tr>
              <th scope="col">TA parameter</th>
              <th scope="col">Factor Setup assumption</th>
              <th scope="col">Measured-data Monte Carlo</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Mean</th>
              <td>{{ formatNumber(analysis.comparison.setup.mean) }}</td>
              <td>{{ formatNumber(analysis.comparison.monteCarlo.mean) }}</td>
              <td>{{ formatNumber(analysis.comparison.monteCarlo.mean - analysis.comparison.setup.mean) }}</td>
            </tr>
            <tr>
              <th scope="row">Standard deviation</th>
              <td>{{ formatNumber(analysis.comparison.setup.standardDeviation) }}</td>
              <td>{{ formatNumber(analysis.comparison.monteCarlo.standardDeviation) }}</td>
              <td>{{ formatPercent(analysis.comparison.monteCarlo.standardDeviation / analysis.comparison.setup.standardDeviation - 1) }}</td>
            </tr>
            <tr>
              <th scope="row">Cp</th>
              <td>{{ formatNumber(analysis.comparison.setup.cp) }}</td>
              <td>{{ formatNumber(analysis.comparison.monteCarlo.cp) }}</td>
              <td>{{ formatNumber(analysis.comparison.monteCarlo.cp - analysis.comparison.setup.cp) }}</td>
            </tr>
            <tr>
              <th scope="row">Cpk</th>
              <td>{{ formatNumber(analysis.comparison.setup.cpk) }}</td>
              <td>{{ formatNumber(analysis.comparison.monteCarlo.cpk) }}</td>
              <td>{{ formatNumber(analysis.comparison.monteCarlo.cpk - analysis.comparison.setup.cpk) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="analysis?.status === 'available'" class="f0-guidance" data-report-f0-guidance aria-labelledby="report-guidance-title">
      <div class="report-section-heading">
        <div>
          <p class="workspace-eyebrow">F0 {{ analysis.provenance.knowledgeBaseVersion }} / {{ analysis.provenance.ruleId }}</p>
          <h3 id="report-guidance-title">Interpretation and optimization direction</h3>
        </div>
        <span class="status-chip" :class="report.assessment === 'MEETS_TARGET' ? 'chip-success' : 'chip-blocked'">
          {{ assessmentContent.title }}
        </span>
      </div>
      <div class="guidance-grid">
        <article>
          <h4>Interpretation</h4>
          <ul>
            <li v-for="item in analysis.interpretations" :key="item">{{ item }}</li>
          </ul>
        </article>
        <article>
          <h4>Optimization direction</h4>
          <ol>
            <li v-for="item in analysis.optimizationDirections" :key="item">{{ item }}</li>
          </ol>
        </article>
      </div>
      <p class="f0-applicability">Applicability: {{ analysis.provenance.applicability }}</p>
    </section>

    <section v-else class="assessment-banner assessment-not_evaluable" data-report-analysis-unavailable>
      <div>
        <p class="assessment-label">F0 analysis unavailable</p>
        <h3>Complete governed evidence</h3>
        <p>{{ analysis?.reason ?? "The generated report does not contain F0 analysis evidence." }}</p>
        <ul v-if="analysis?.optimizationDirections.length">
          <li v-for="item in analysis.optimizationDirections" :key="item">{{ item }}</li>
        </ul>
      </div>
    </section>

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

.report-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.report-section-heading p {
  margin: 0;
}

.guidance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 12px;
}

.guidance-grid article {
  border-left: 4px solid var(--line-strong);
  padding: 12px 16px;
  background: #f4f5f6;
}

.guidance-grid article:last-child {
  border-left-color: var(--accent);
  background: #eef5f7;
}

.guidance-grid h4,
.guidance-grid ul,
.guidance-grid ol {
  margin: 0;
}

.guidance-grid ul,
.guidance-grid ol {
  margin-top: 8px;
  padding-left: 20px;
}

.guidance-grid li + li {
  margin-top: 8px;
}

.f0-applicability {
  margin: 10px 0 0;
  color: var(--ink-soft);
  font-size: 0.82rem;
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

.evidence-list dt {
  color: var(--ink-soft);
  font-size: 0.78rem;
}

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

  .report-section-heading {
    flex-direction: column;
  }

  .guidance-grid {
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

}
</style>