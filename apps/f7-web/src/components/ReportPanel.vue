<script setup lang="ts">
/* global Blob, document */
import { computed, toRaw, type DeepReadonly } from "vue";
import type { F7ReportProjection } from "../api/f7-client";
import { classifyActualValueSeverity, type ActualValueMetric } from "../actual-value-severity";

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

function standardNormalCdf(value: number): number {
  const absolute = Math.abs(value);
  const scale = 1 / (1 + 0.2316419 * absolute);
  const density = Math.exp(-0.5 * absolute * absolute) / Math.sqrt(2 * Math.PI);
  const tail = density * scale * (
    0.319381530
    + scale * (-0.356563782 + scale * (1.781477937 + scale * (-1.821255978 + scale * 1.330274429)))
  );
  return Math.min(1, Math.max(0, value >= 0 ? 1 - tail : tail));
}

const comparisonRows = computed(() => {
  if (analysis.value?.status !== "available") return [];
  const comparison = analysis.value.comparison;
  const { lowerSpecLimit, upperSpecLimit } = props.report.summary;
  const setupCpl = (comparison.setup.mean - lowerSpecLimit) / (3 * comparison.setup.standardDeviation);
  const setupCpu = (upperSpecLimit - comparison.setup.mean) / (3 * comparison.setup.standardDeviation);
  const setupLowerDpm = standardNormalCdf(-setupCpl * 3) * 1_000_000;
  const setupUpperDpm = standardNormalCdf(-setupCpu * 3) * 1_000_000;
  const setupTotalDpm = setupLowerDpm + setupUpperDpm;
  const capability = props.report.simulation.capability;
  const normalModel = props.report.simulation.normalModel;
  const rows: Array<{
    key: string;
    label: string;
    metric: ActualValueMetric;
    setup: number;
    actual: number | undefined;
    format?: "dpm" | "percent";
    percentageDenominator?: number;
    maximumFractionDigits: number;
  }> = [
    {
      key: "mean",
      label: "Mean",
      metric: "mean",
      setup: comparison.setup.mean,
      actual: comparison.monteCarlo.mean,
      percentageDenominator: upperSpecLimit - lowerSpecLimit,
      maximumFractionDigits: 3,
    },
    { key: "standardDeviation", label: "Standard deviation", metric: "oneSigma", setup: comparison.setup.standardDeviation, actual: comparison.monteCarlo.standardDeviation, maximumFractionDigits: 3 },
    { key: "cp", label: "Cp", metric: "cp", setup: comparison.setup.cp, actual: comparison.monteCarlo.cp, maximumFractionDigits: 3 },
    { key: "cpk", label: "Cpk", metric: "cpk", setup: comparison.setup.cpk, actual: comparison.monteCarlo.cpk, maximumFractionDigits: 3 },
    { key: "cpl", label: "CPL", metric: "cpk", setup: setupCpl, actual: capability.status === "available" ? capability.lowerCpk : undefined, maximumFractionDigits: 3 },
    { key: "cpu", label: "CPU", metric: "cpk", setup: setupCpu, actual: capability.status === "available" ? capability.upperCpk : undefined, maximumFractionDigits: 3 },
    { key: "lowerDpm", label: "Lower DPM", metric: "tolerance", setup: setupLowerDpm, actual: normalModel.status === "available" ? normalModel.lowerTailDpm : undefined, format: "dpm", maximumFractionDigits: 0 },
    { key: "upperDpm", label: "Upper DPM", metric: "tolerance", setup: setupUpperDpm, actual: normalModel.status === "available" ? normalModel.upperTailDpm : undefined, format: "dpm", maximumFractionDigits: 0 },
    { key: "totalDpm", label: "Total DPM", metric: "tolerance", setup: setupTotalDpm, actual: normalModel.status === "available" ? normalModel.totalDpm : undefined, format: "dpm", maximumFractionDigits: 0 },
    { key: "outOfSpec", label: "% Out of Spec", metric: "tolerance", setup: setupTotalDpm / 1_000_000, actual: props.report.simulation.outOfSpecProbability, format: "percent", maximumFractionDigits: 2 },
  ];
  return rows.map((row) => ({
    ...row,
    delta: row.actual === undefined ? undefined : row.actual - row.setup,
    severity: classifyActualValueSeverity({
      metric: row.metric,
      setup: row.setup,
      actual: row.actual,
      normalizationFallback: props.report.summary.upperSpecLimit - props.report.summary.lowerSpecLimit,
    })?.severity ?? "normal",
  }));
});
const contributors = computed(() => [...props.report.factors]
  .sort((left, right) => right.percentContributionToSigma - left.percentContributionToSigma)
  .slice(0, 5));
const recommendedActions = computed(() => {
  if (analysis.value?.status !== "available") return [];
  const { mean, standardDeviation, lowerSpecLimit, upperSpecLimit, targetCpk } = props.report.summary;
  const targetMean = (lowerSpecLimit + upperSpecLimit) / 2;
  const meanAdjustment = targetMean - mean;
  const nearestClearance = Math.min(mean - lowerSpecLimit, upperSpecLimit - mean);
  const maximumStandardDeviation = nearestClearance / (3 * targetCpk);
  const standardDeviationReduction = Math.max(0, standardDeviation - maximumStandardDeviation);
  const reductionPercentage = standardDeviation > 0 ? standardDeviationReduction / standardDeviation * 100 : 0;
  const requiredHalfRange = 3 * targetCpk * standardDeviation;

  return analysis.value.optimizationDirections.map((title) => {
    const normalized = title.toLowerCase();
    if (normalized.includes("center") && normalized.includes("mean")) {
      return {
        title,
        metrics: [
          ["Current mean", formatNumber(mean)],
          ["Target mean", formatNumber(targetMean)],
          ["Required adjustment", formatSigned(meanAdjustment)],
        ],
      };
    }
    if (normalized.includes("variation")) {
      return {
        title,
        metrics: [
          ["Current σ", formatNumber(standardDeviation)],
          ["Maximum σ", formatNumber(maximumStandardDeviation)],
          ["Required reduction", `${formatNumber(standardDeviationReduction)} (${formatNumber(reductionPercentage, 2)}%)`],
        ],
      };
    }
    if (normalized.includes("specification")) {
      return {
        title,
        metrics: [
          ["Current limits", `${formatNumber(lowerSpecLimit)} / ${formatNumber(upperSpecLimit)}`],
          ["Required LSL", `≤ ${formatNumber(mean - requiredHalfRange)}`],
          ["Required USL", `≥ ${formatNumber(mean + requiredHalfRange)}`],
        ],
      };
    }
    return { title, metrics: [] };
  });
});

function formatScientific(value: number): string {
  return value.toExponential(2)
    .replace(/\.0+(?=e)/, "")
    .replace(/(\.\d*?)0+(?=e)/, "$1")
    .replace("e+", "e");
}

function formatNumber(value: number, maximumFractionDigits = 3): string {
  if (value !== 0 && Number.isFinite(value) && Number(value.toFixed(maximumFractionDigits)) === 0) {
    return formatScientific(value);
  }
  return value.toLocaleString("en-US", { maximumFractionDigits });
}

function formatPercent(value: number, maximumFractionDigits = 2): string {
  const percentage = value * 100;
  const distanceFromHundred = (1 - value) * 100;
  if (value < 1 && distanceFromHundred > 0 && distanceFromHundred < 0.000001) {
    return `100% - ${formatScientific(distanceFromHundred)}%`;
  }
  return `${formatNumber(percentage, maximumFractionDigits)}%`;
}

function formatSigned(value: number, maximumFractionDigits = 3): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${formatNumber(value, maximumFractionDigits)}`;
}

function formatDifference(
  delta: number,
  setup: number,
  format?: "dpm" | "percent",
  denominator = Math.abs(setup),
  maximumFractionDigits = 3,
): string {
  const percentageDenominator = Math.abs(denominator);
  const relative = percentageDenominator === 0
    ? "N/A"
    : `${formatSigned(delta / percentageDenominator * 100, 2)}%`;
  const formattedDelta = format === "dpm"
    ? `${delta > 0 ? "+" : ""}${Math.round(delta).toLocaleString("en-US")}`
    : formatSigned(delta, maximumFractionDigits);
  return `${formattedDelta} (${relative})`;
}

function formatMetricValue(value: number | undefined, format?: "dpm" | "percent", maximumFractionDigits = 3): string {
  if (value === undefined) return "—";
  if (format === "dpm") return `${Math.round(value).toLocaleString("en-US")} DPM`;
  if (format === "percent") return formatPercent(value, maximumFractionDigits);
  return formatNumber(value, maximumFractionDigits);
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
        <p class="workspace-eyebrow">Governed engineering report</p>
        <h2 id="report-title">Engineering Analysis</h2>
        <p class="subtle">{{ report.workbook.fileName }} · {{ report.workbook.worksheetName }}</p>
      </div>
      <div class="report-actions">
        <button type="button" class="action-button" data-download-report @click="downloadMarkdown">
          Download Markdown
        </button>
      </div>
    </header>

    <section v-if="analysis?.status === 'available'" class="executive-summary" data-executive-summary>
      <div
        class="report-decision"
        :class="`report-decision-${analysis.narrative.resultJudgment.status}`"
        data-report-decision
        :data-assessment="report.assessment"
      >
        <p class="workspace-eyebrow">Executive Summary</p>
        <h3>{{ analysis.narrative.resultJudgment.headline }}</h3>
        <p>{{ analysis.narrative.resultJudgment.judgment }}</p>
      </div>
      <p>{{ analysis.narrative.engineeringSummary }}</p>
    </section>

    <section v-if="analysis?.status === 'available'" class="report-section" data-report-ta-comparison aria-labelledby="report-comparison-title">
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
            <tr v-for="row in comparisonRows" :key="row.key" :data-report-metric="row.key">
              <th scope="row">{{ row.label }}</th>
              <td>{{ formatMetricValue(row.setup, row.format, row.maximumFractionDigits) }}</td>
              <td data-monte-carlo-value>{{ formatMetricValue(row.actual, row.format, row.maximumFractionDigits) }}</td>
              <td
                class="report-difference"
                :class="`actual-value-severity-${row.severity}`"
                :data-report-difference="row.key"
                :data-actual-severity="row.severity"
              >
                {{ row.delta === undefined
                  ? "—"
                  : formatDifference(row.delta, row.setup, row.format, row.percentageDenominator, row.maximumFractionDigits) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="analysis?.status === 'available'" class="report-guidance-stack" data-report-f0-guidance>
    <section class="report-insight-grid" aria-labelledby="report-guidance-title">
      <article class="report-section" data-report-top-contributors>
        <div class="report-section-heading">
          <div>
            <p class="workspace-eyebrow">Variation ownership</p>
            <h3>Top Contributors</h3>
          </div>
        </div>
        <ol class="contributor-list">
          <li v-for="factor in contributors" :key="factor.factorId">
            <div><strong>{{ factor.factorName }}</strong><span>{{ formatPercent(factor.percentContributionToSigma) }}</span></div>
            <span class="contributor-track"><span :style="{ width: `${factor.percentContributionToSigma * 100}%` }"></span></span>
          </li>
        </ol>
      </article>

      <article class="report-section" data-report-risk-summary>
        <div class="report-section-heading">
          <div>
            <p class="workspace-eyebrow">Decision context · F0 {{ analysis.provenance.knowledgeBaseVersion }} / {{ analysis.provenance.ruleId }}</p>
            <h3 id="report-guidance-title">Engineering Risks &amp; Recommended Actions</h3>
          </div>
          <span class="status-chip" :class="report.assessment === 'MEETS_TARGET' ? 'chip-success' : 'chip-blocked'">
            {{ assessmentContent.title }}
          </span>
        </div>
        <ul>
          <li v-for="item in analysis.interpretations" :key="item">{{ item }}</li>
        </ul>
        <div class="embedded-actions">
          <h4>Recommended Actions</h4>
          <ol class="action-list">
            <li v-for="item in recommendedActions" :key="item.title" data-recommended-action>
              <strong>{{ item.title }}</strong>
              <dl v-if="item.metrics.length" class="action-metrics">
                <div v-for="metric in item.metrics" :key="metric[0]">
                  <dt>{{ metric[0] }}</dt>
                  <dd>{{ metric[1] }}</dd>
                </div>
              </dl>
            </li>
          </ol>
        </div>
      </article>
    </section>
    </div>

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
  </section>
</template>

<style scoped>
.report-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  border-top: 4px solid var(--accent);
}

.executive-summary {
  display: grid;
  grid-template-columns: minmax(250px, 0.8fr) minmax(0, 1.2fr);
  align-items: center;
  gap: 18px;
  border: 1px solid var(--line);
  background: #f7f8f9;
}

.executive-summary > p {
  margin: 0;
  padding: 16px 18px 16px 0;
  color: var(--ink-soft);
  line-height: 1.55;
}

.report-decision {
  align-self: stretch;
  border-left: 5px solid var(--attention);
  padding: 14px 16px;
  background: #fff8ed;
}

.report-decision-meets-target {
  border-left-color: var(--success);
  background: #edf7f4;
}

.report-decision h3,
.report-decision p {
  margin: 0;
}

.report-decision h3 {
  margin: 3px 0 5px;
}

.report-section {
  min-width: 0;
  border: 1px solid var(--line);
  padding: 16px;
  background: var(--panel);
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

.report-section-heading h3 {
  margin: 2px 0 0;
}

.report-section-heading > p {
  max-width: 52ch;
  color: var(--ink-soft);
  font-size: 0.82rem;
  text-align: right;
}

.report-insight-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
}

.report-guidance-stack {
  display: grid;
  gap: 16px;
}

.contributor-list,
.action-list {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.contributor-list li + li {
  margin-top: 12px;
}

.contributor-list li > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 5px;
  font-size: 0.86rem;
}

.contributor-track {
  display: block;
  height: 7px;
  overflow: hidden;
  background: #e4e8eb;
}

.contributor-track > span {
  display: block;
  height: 100%;
  background: var(--accent);
}

.report-insight-grid ul {
  margin: 12px 0 0;
  padding-left: 20px;
}

.embedded-actions {
  margin-top: 16px;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}

.embedded-actions h4 {
  margin: 0;
  font-size: 0.86rem;
}

.action-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  counter-reset: action;
  gap: 1px;
  background: var(--line);
}

.action-list li {
  position: relative;
  min-height: 58px;
  padding: 13px 14px 13px 48px;
  background: #f7f8f9;
  counter-increment: action;
}

.action-metrics {
  display: grid;
  gap: 5px;
  margin: 10px 0 0;
  font-size: 0.76rem;
}

.action-metrics > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding-top: 5px;
}

.action-metrics dt {
  color: var(--ink-soft);
}

.action-metrics dd {
  margin: 0;
  font-weight: 800;
  text-align: right;
}

.action-list li::before {
  position: absolute;
  top: 12px;
  left: 13px;
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  background: var(--accent);
  color: white;
  content: counter(action);
  font-size: 0.78rem;
  font-weight: 800;
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
  background: #e9edf0;
  color: var(--ink);
  font-size: 0.78rem;
  text-transform: uppercase;
}

.report-table tbody tr:nth-child(even) {
  background: #fafbfb;
}

.report-difference {
  border-left-width: 3px !important;
  background: #fff;
  font-weight: 800;
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

  .report-section-heading > p {
    text-align: left;
  }

  .guidance-grid,
  .executive-summary,
  .report-insight-grid {
    grid-template-columns: 1fr;
  }

  .executive-summary > p {
    padding: 0 16px 16px;
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

}
</style>