<script lang="ts">
interface MeanCenteringAdjustment {
  readonly requiredAdjustment: number;
  readonly direction: string;
  readonly display: {
    readonly requiredAdjustment: string;
  };
}

export function formatMeanAdjustment(meanCentering: MeanCenteringAdjustment): string {
  if (meanCentering.requiredAdjustment === 0 || meanCentering.direction === "balanced") {
    return "No adjustment required";
  }

  return `${meanCentering.display.requiredAdjustment} toward ${meanCentering.direction}`;
}
</script>

<script setup lang="ts">
import { FileDown } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch, type DeepReadonly } from "vue";
import { formatF7NarrativeEvidenceValue } from "@ai-assist/product-language/f7-engineering-narrative";
import type { AssumptionResultsPdfRequest, F7SessionSnapshot } from "../api/f7-client";
import { buildAssumptionResultsInterpretation } from "../assumption-results-interpretation";
import { buildSpecificationFallbackDisplay } from "../specification-fallback-display";
import ContributorParetoChart from "./ContributorParetoChart.vue";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly generatePdf?: (request: AssumptionResultsPdfRequest) => Promise<globalThis.Blob>;
}>();

const generatingPdf = ref(false);
const pdfError = ref("");
const pdfStatus = ref("");
let disposed = false;
let generationToken = 0;
const resultSummaryCaption = "Comparison of assumption-based RSS results with system specifications and derived targets";
const processGuidanceContext = "Evaluated against the current TA worksheet and analysis state.";
const outcomeLabel = "Expected result";
const meanCenteringOutcomeContext = "after applying the recommended adjustment";
const specificationOutcomeContext = "after applying both recommended limits";
const interpretation = computed(() => buildAssumptionResultsInterpretation(props.session));
const processGuidanceEntries = computed(() => (
  interpretation.value.processGuidance.status === "available"
    ? interpretation.value.processGuidance.entries
    : []
));
const shouldRenderProcessGuidance = computed(() => (
  interpretation.value.processGuidance.status === "available"
  && interpretation.value.processGuidance.entries.length > 0
));
const specificationFallbackDisplay = computed(() => (
  interpretation.value.status === "available"
    ? buildSpecificationFallbackDisplay(interpretation.value.specificationFallback)
    : undefined
));
const displayedRootCauseAnalysis = computed(() => (
  interpretation.value.status === "available"
    ? interpretation.value.narrative.rootCauseAnalysis.filter((item) => (
        item.ruleId !== "root-cause-contributor-concentration"
      ))
    : []
));
const selectedWorksheetName = computed(() => props.session.selectedWorksheetNames[0] ?? "");
const canGeneratePdf = computed(() => (
  interpretation.value.status === "available"
  && props.generatePdf !== undefined
  && props.session.sessionId.length > 0
  && props.session.workbook.fileName.length > 0
  && selectedWorksheetName.value.length > 0
));

watch(() => props.session.sessionId, () => {
  generationToken += 1;
  generatingPdf.value = false;
  pdfError.value = "";
  pdfStatus.value = "";
});

onBeforeUnmount(() => {
  disposed = true;
  generationToken += 1;
});

function formatEvidenceValue(key: string, value: number | string): string {
  if (typeof value !== "number") return value;
  const formattedValue = formatF7NarrativeEvidenceValue(value);
  return /percent/i.test(key) ? `${formattedValue}%` : formattedValue;
}

function evidenceLabel(item: { quantitativeEvidenceLabels?: Readonly<Record<string, string>> }, key: string): string {
  return item.quantitativeEvidenceLabels?.[key] ?? key;
}

type PdfActionOptionId = AssumptionResultsPdfRequest["actionItems"][number]["optionId"];

function isPdfActionOptionId(value: string): value is PdfActionOptionId {
  return value === "improvement-center-mean"
    || value === "improvement-reduce-variation"
    || value === "improvement-reduce-contributor"
    || value === "improvement-relax-final-specification";
}

function buildPdfRequest(): AssumptionResultsPdfRequest | undefined {
  const current = interpretation.value;
  if (current.status !== "available" || !canGeneratePdf.value) return undefined;
  const fallbackDisplay = specificationFallbackDisplay.value;

  return {
    sessionId: props.session.sessionId,
    workbookName: props.session.workbook.fileName,
    worksheetName: selectedWorksheetName.value,
    resultJudgment: {
      status: current.narrative.resultJudgment.status,
      headline: current.narrative.resultJudgment.headline,
    },
    resultSummaryCaption,
    summaryRows: current.resultSummary.map((row) => ({
      metric: row.metric,
      result: row.result,
      reference: row.reference,
      ...(row.referenceDetail ? { referenceDetail: row.referenceDetail } : {}),
      difference: row.difference,
      assessment: row.assessment,
      performanceContext: row.performanceContext,
      ...(row.tone === "pass" || row.tone === "fail" || row.tone === "warning" ? { tone: row.tone } : {}),
    })),
    overallAssessment: current.overallAssessment,
    rootCauseItems: displayedRootCauseAnalysis.value.map((item) => ({
      title: item.title,
      narrative: item.narrative,
      hypothesisStatus: item.hypothesisStatus,
      incompleteEvidence: !item.completeEvidence,
      quantitativeEvidence: Object.entries(item.quantitativeEvidence ?? {}).map(([key, value]) => ({
        label: evidenceLabel(item, key),
        value: formatEvidenceValue(key, value),
      })),
    })),
    actionItems: current.narrative.suggestedActionSequence
      .flatMap<AssumptionResultsPdfRequest["actionItems"][number]>((item) => {
      if (!isPdfActionOptionId(item.optionId)) return [];
      const base = {
        title: item.title,
        narrative: item.optionId === "improvement-center-mean" && item.meanCentering
          ? item.meanCentering.feasibilityNarrative
          : item.narrative,
      };
      if (item.optionId === "improvement-center-mean") {
        if (!item.meanCentering) return [];
        return [{
          ...base,
          optionId: item.optionId,
          meanCenteringAdjustment: {
            current: item.meanCentering.display.currentMean,
            recommended: item.meanCentering.display.targetMean,
            adjustment: formatMeanAdjustment(item.meanCentering),
          },
          outcome: {
            label: outcomeLabel,
            value: `Mean ${item.meanCentering.display.targetMean}`,
            context: meanCenteringOutcomeContext,
          },
        }];
      }
      if (item.optionId === "improvement-relax-final-specification") {
        if (!fallbackDisplay) return [];
        return [{
          ...base,
          optionId: item.optionId,
          specificationAdjustment: {
            lower: fallbackDisplay.lower,
            upper: fallbackDisplay.upper,
          },
          outcome: {
            label: outcomeLabel,
            value: `Cpk ${formatEvidenceValue("targetCpk", current.specificationFallback.targetCpk)}`,
            context: specificationOutcomeContext,
          },
        }];
      }
        return [{ ...base, optionId: item.optionId }];
      }),
    contributors: current.contributorPriorities.map((item) => ({
      factorName: item.factorName,
      reference: item.reference,
      designNominal: item.designNominal,
      upperTolerance: item.upperTolerance,
      lowerTolerance: item.lowerTolerance,
      contributionPercent: item.contributionPercent,
      cumulativePercent: item.cumulativePercent,
    })),
    processGuidanceContext,
    processGuidance: current.processGuidance.status === "available"
      ? current.processGuidance.entries.map(({ state, title, message }) => ({ state, title, message }))
      : [],
  };
}

function safeFileNamePart(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || (codePoint >= 127 && codePoint <= 159) || /[<>:"/\\|?*]/u.test(character)
        ? "-"
        : character;
    })
    .join("")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^[.-]+|[.-]+$/gu, "");
}

function pdfFileName(workbookName: string, worksheetName: string): string {
  const workbookBase = workbookName.replace(/\.[^.]+$/u, "");
  const stem = [safeFileNamePart(workbookBase), safeFileNamePart(worksheetName)]
    .filter(Boolean)
    .join("-") || "ta-results";
  const suffix = "-assumption-results.pdf";
  return `${[...stem].slice(0, 180 - suffix.length).join("").replace(/[.-]+$/u, "")}${suffix}`;
}

function exportErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Unable to generate the assumption-results PDF. Retry the action.";
  }
  const value = error as { readonly summary?: unknown; readonly suggestedAction?: unknown };
  const summary = typeof value.summary === "string" ? value.summary : "Unable to generate the assumption-results PDF.";
  const suggestedAction = typeof value.suggestedAction === "string" ? value.suggestedAction : "Retry the action.";
  return `${summary} ${suggestedAction}`;
}

async function handleGeneratePdf(): Promise<void> {
  const request = buildPdfRequest();
  const generatePdf = props.generatePdf;
  if (!request || !generatePdf || generatingPdf.value) return;

  const sessionId = request.sessionId;
  const downloadFileName = pdfFileName(request.workbookName, request.worksheetName);
  const startedAt = performance.now();
  const currentToken = ++generationToken;
  const isCurrentGeneration = (): boolean => (
    !disposed
    && generationToken === currentToken
    && props.session.sessionId === sessionId
  );

  generatingPdf.value = true;
  pdfError.value = "";
  pdfStatus.value = "";
  let objectUrl: string | undefined;
  let anchor: globalThis.HTMLAnchorElement | undefined;
  try {
    const blob = await generatePdf(request);
    if (!isCurrentGeneration()) return;
    objectUrl = URL.createObjectURL(blob);
    anchor = globalThis.document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = downloadFileName;
    anchor.hidden = true;
    globalThis.document.body.append(anchor);
    anchor.click();
    const elapsedSeconds = (performance.now() - startedAt) / 1_000;
    pdfStatus.value = `PDF downloaded in ${elapsedSeconds.toFixed(1)} seconds.`;
  } catch (error) {
    if (isCurrentGeneration()) pdfError.value = exportErrorMessage(error);
  } finally {
    anchor?.remove();
    if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
    if (isCurrentGeneration()) generatingPdf.value = false;
  }
}

</script>

<template>
  <section
    class="workbench-panel ta-results-interpretation"
    aria-label="TA results interpretation based on assumptions"
  >
    <header class="interpretation-header">
      <h2>TA Results Interpretation (based on Assumptions)</h2>
      <button
        type="button"
        class="action-button generate-pdf-action"
        data-generate-assumption-results-pdf
        :disabled="!canGeneratePdf || generatingPdf"
        :aria-busy="generatingPdf"
        :title="interpretation.status === 'available'
          ? 'Download assumption results as PDF'
          : 'PDF generation requires available assumption results'"
        @click="handleGeneratePdf"
      >
        <FileDown
          :size="17"
          aria-hidden="true"
        />
        <span>{{ generatingPdf ? "Generating PDF…" : "Generate PDF" }}</span>
      </button>
    </header>

    <p
      v-if="pdfError"
      class="pdf-export-error"
      data-assumption-results-pdf-error
      aria-live="polite"
    >
      {{ pdfError }}
    </p>

    <p
      v-if="pdfStatus"
      class="pdf-export-status"
      data-assumption-results-pdf-status
      aria-live="polite"
    >
      {{ pdfStatus }}
    </p>

    <template v-if="interpretation.status === 'available'">
      <div class="narrative-flow">
        <section
          class="narrative-section emphasis-card"
          data-result-judgment
        >
          <div class="result-summary-heading">
            <h3>TA Result Summary</h3>
            <span
              class="result-status"
              :class="`result-status--${interpretation.narrative.resultJudgment.status}`"
            >
              {{ interpretation.narrative.resultJudgment.headline }}
            </span>
          </div>
          <div
            class="result-summary-scroll"
            data-result-summary-scroll
            role="region"
            aria-label="TA result summary metrics"
            tabindex="0"
          >
            <table class="result-summary-table">
              <caption data-result-summary-caption>
                {{ resultSummaryCaption }}
              </caption>
              <thead>
                <tr>
                  <th data-result-summary-header>
                    Metric
                  </th>
                  <th data-result-summary-header>
                    Result
                  </th>
                  <th data-result-summary-header>
                    Specification / Reference
                  </th>
                  <th data-result-summary-header>
                    Difference
                  </th>
                  <th data-result-summary-header>
                    Assessment
                  </th>
                  <th data-result-summary-header>
                    Performance Context
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in interpretation.resultSummary"
                  :key="row.key"
                  data-result-summary-row
                  :data-metric="row.key"
                  :data-row-kind="row.kind"
                >
                  <th scope="row">
                    {{ row.metric }}
                  </th>
                  <td
                    class="numeric-value"
                    data-label="Result"
                    data-result-value
                  >
                    {{ row.result }}
                  </td>
                  <td
                    class="reference-value"
                    data-label="Specification / Reference"
                  >
                    <span>{{ row.reference }}</span>
                    <small
                      v-if="row.referenceDetail"
                      data-reference-detail
                    >{{ row.referenceDetail }}</small>
                  </td>
                  <td
                    class="numeric-difference"
                    data-label="Difference"
                  >
                    {{ row.difference }}
                  </td>
                  <td data-label="Assessment">
                    <span
                      class="result-assessment"
                      data-assessment
                      :data-tone="row.tone"
                    >{{ row.assessment }}</span>
                  </td>
                  <td
                    class="performance-context"
                    data-label="Performance Context"
                    data-performance-context
                  >
                    {{ row.performanceContext }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            class="overall-assessment"
            data-overall-assessment
          >
            <strong>Overall assessment</strong>
            <span>{{ interpretation.overallAssessment }}</span>
          </div>
        </section>

        <section class="narrative-section">
          <h3>Root Cause Analysis</h3>
          <ol
            v-if="displayedRootCauseAnalysis.length > 0"
            class="narrative-list"
            data-root-cause-list
          >
            <li
              v-for="item in displayedRootCauseAnalysis"
              :key="item.ruleId"
              class="narrative-item"
              data-root-cause-item
            >
              <div class="narrative-item-header">
                <strong>{{ item.title }}</strong>
              </div>
              <p>{{ item.narrative }}</p>
              <p class="subtle">
                <strong>State</strong> {{ item.hypothesisStatus }}<span v-if="!item.completeEvidence"> · Incomplete evidence</span>
              </p>
              <dl
                v-if="item.quantitativeEvidence"
                class="evidence-grid"
              >
                <template
                  v-for="(value, key) in item.quantitativeEvidence"
                  :key="`${item.ruleId}-${key}`"
                >
                  <dt>{{ evidenceLabel(item, key) }}</dt>
                  <dd>{{ formatEvidenceValue(key, value) }}</dd>
                </template>
              </dl>
            </li>
          </ol>
          <p
            v-else
            class="subtle"
          >
            No controlled root-cause signal.
          </p>
        </section>

        <section class="narrative-section">
          <h3>Suggested Action Sequence</h3>
          <ol
            v-if="interpretation.narrative.suggestedActionSequence.length > 0"
            class="narrative-list action-sequence"
          >
            <li
              v-for="item in interpretation.narrative.suggestedActionSequence"
              :key="item.optionId"
              class="narrative-item"
              data-action-sequence-item
              :data-option-id="item.optionId"
            >
              <div class="narrative-item-header">
                <strong>{{ item.title }}</strong>
                <span class="rule-id">{{ item.optionId }}</span>
              </div>
              <p>
                {{ item.optionId === 'improvement-center-mean' && item.meanCentering
                  ? item.meanCentering.feasibilityNarrative
                  : item.narrative }}
              </p>
              <div
                v-if="item.optionId === 'improvement-center-mean' && item.meanCentering"
                class="specification-fallback"
                data-mean-centering-adjustment
              >
                <div
                  class="specification-adjustments-scroll"
                  role="region"
                  aria-label="Required mean change"
                  tabindex="0"
                >
                  <table data-mean-centering-table>
                    <caption>Required mean change</caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          Parameter
                        </th>
                        <th scope="col">
                          Current
                        </th>
                        <th scope="col">
                          Recommended
                        </th>
                        <th scope="col">
                          Adjustment
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr data-mean-centering-row>
                        <th scope="row">
                          Mean
                        </th>
                        <td>{{ item.meanCentering.display.currentMean }}</td>
                        <td class="recommended-specification">
                          <span aria-hidden="true">→</span>
                          {{ item.meanCentering.display.targetMean }}
                        </td>
                        <td class="specification-adjustment">
                          {{ formatMeanAdjustment(item.meanCentering) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="specification-outcome">
                  <span data-mean-centering-outcome-label>{{ outcomeLabel }}</span>
                  <strong data-mean-centering-outcome-value>
                    Mean {{ item.meanCentering.display.targetMean }}
                  </strong>
                  <small>{{ meanCenteringOutcomeContext }}</small>
                </div>
              </div>
              <template v-if="item.optionId === 'improvement-reduce-variation' && interpretation.contributorPriorities.length > 0">
                <div class="narrative-item-header">
                  <strong>Tolerance Adjustment Priority (% Cont. to σ)</strong>
                </div>
                <ContributorParetoChart :contributors="interpretation.contributorPriorities" />
              </template>
              <div
                v-if="item.optionId === 'improvement-relax-final-specification'"
                class="specification-fallback"
                data-specification-fallback
              >
                <div
                  class="specification-adjustments-scroll"
                  role="region"
                  aria-label="Recommended specification limit changes"
                  tabindex="0"
                >
                  <table data-specification-adjustments>
                    <caption>Required specification change</caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          Limit
                        </th>
                        <th scope="col">
                          Current
                        </th>
                        <th scope="col">
                          Recommended
                        </th>
                        <th scope="col">
                          Adjustment
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr data-specification-row>
                        <th scope="row">
                          LSL
                        </th>
                        <td>{{ specificationFallbackDisplay?.lower.current }}</td>
                        <td class="recommended-specification">
                          <span aria-hidden="true">→</span>
                          {{ specificationFallbackDisplay?.lower.recommended }}
                        </td>
                        <td class="specification-adjustment">
                          {{ specificationFallbackDisplay?.lower.adjustment }}
                        </td>
                      </tr>
                      <tr data-specification-row>
                        <th scope="row">
                          USL
                        </th>
                        <td>{{ specificationFallbackDisplay?.upper.current }}</td>
                        <td class="recommended-specification">
                          <span aria-hidden="true">→</span>
                          {{ specificationFallbackDisplay?.upper.recommended }}
                        </td>
                        <td class="specification-adjustment">
                          {{ specificationFallbackDisplay?.upper.adjustment }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="specification-outcome">
                  <span data-specification-outcome-label>{{ outcomeLabel }}</span>
                  <strong data-specification-outcome-value>
                    Cpk {{ formatEvidenceValue('targetCpk', interpretation.specificationFallback.targetCpk) }}
                  </strong>
                  <small>{{ specificationOutcomeContext }}</small>
                </div>
              </div>
            </li>
          </ol>
          <p
            v-else
            class="subtle"
          >
            No controlled improvement option.
          </p>
        </section>
      </div>
    </template>

    <p
      v-else
      class="interpretation-unavailable"
      data-interpretation-unavailable
      aria-live="polite"
      role="status"
    >
      {{ interpretation.reason }}
    </p>

    <section
      v-if="shouldRenderProcessGuidance"
      class="narrative-section process-guidance-section"
      data-process-guidance
    >
      <div class="process-guidance-heading">
        <h3>TA Process and Requirements</h3>
      </div>
      <p
        class="process-guidance-context"
        data-process-guidance-context
      >
        {{ processGuidanceContext }}
      </p>
      <ol class="process-guidance-list action-sequence">
        <li
          v-for="entry in processGuidanceEntries"
          :key="entry.entryId"
          class="narrative-item process-guidance-entry"
          data-process-guidance-entry
          :data-guidance-state="entry.state"
        >
          <div class="process-guidance-entry-header">
            <span
              v-if="entry.state === 'warning'"
              class="process-guidance-warning"
              data-process-guidance-warning
            >Warning</span>
            <strong data-process-guidance-entry-title>
              {{ entry.title }}
            </strong>
          </div>
          <p data-process-guidance-entry-message>
            {{ entry.message }}
          </p>
        </li>
      </ol>
    </section>
  </section>
</template>

<style scoped>
.ta-results-interpretation {
  display: grid;
  gap: 12px;
}

.interpretation-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.interpretation-header h2 {
  min-width: min(100%, 280px);
  margin-bottom: 0;
}

.generate-pdf-action {
  display: inline-flex;
  min-width: 142px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;
}

.generate-pdf-action svg {
  flex: 0 0 17px;
}

.pdf-export-error {
  margin-bottom: 0;
  border-left: 3px solid var(--danger);
  padding-left: 10px;
  color: var(--danger);
}

.pdf-export-status {
  margin-bottom: 0;
  border-left: 3px solid var(--success, #34785f);
  padding-left: 10px;
  color: var(--success, #34785f);
}

.narrative-flow {
  display: grid;
  gap: 12px;
}

.ta-results-interpretation h2,
.ta-results-interpretation h3,
.ta-results-interpretation h4,
.ta-results-interpretation p,
.ta-results-interpretation ul {
  margin-top: 0;
}

.narrative-flow > * {
  min-width: 0;
}

.narrative-section {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

.narrative-section:first-child {
  border-top: none;
  padding-top: 0;
}

.emphasis-card {
  border-left: 3px solid var(--pending);
  padding-left: 10px;
}

.result-summary-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 10px;
}

.result-summary-heading h3 {
  margin-bottom: 0;
}

.result-status {
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 3px 8px;
  font-size: 0.78rem;
  font-weight: 700;
}

.result-status--below-target {
  border-color: var(--pending);
  color: var(--pending);
}

.result-status--meets-target {
  border-color: var(--success, #34785f);
  color: var(--success, #34785f);
}

.result-summary-scroll {
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
}

.result-summary-scroll:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.result-summary-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.result-summary-table caption {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 0.76rem;
  text-align: left;
}

.result-summary-table th,
.result-summary-table td {
  border-right: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
  padding: 9px 12px;
  text-align: left;
  vertical-align: middle;
}

.result-summary-table th:last-child,
.result-summary-table td:last-child {
  border-right: none;
}

.result-summary-table tbody tr:last-child > * {
  border-bottom: none;
}

.result-summary-table thead th {
  background: #eef2f4;
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  white-space: nowrap;
}

.result-summary-table tbody th {
  background: #f8faf9;
  font-weight: 700;
}

.result-summary-table tbody tr:hover > * {
  background: #f7faf8;
}

.numeric-value,
.numeric-difference {
  text-align: right !important;
  white-space: nowrap;
}

.numeric-value {
  color: #172d39;
  font-size: 0.96rem;
  font-weight: 750;
}

.reference-value {
  min-width: 210px;
}

.performance-context {
  min-width: 210px;
  color: var(--ink-soft);
  font-size: 0.8rem;
  line-height: 1.35;
}

.reference-value small {
  display: block;
  margin-top: 2px;
  color: var(--ink-soft);
  font-size: 0.72rem;
  line-height: 1.3;
}

.result-assessment {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 2px 7px;
  font-size: 0.75rem;
  font-weight: 750;
  line-height: 1.2;
  white-space: nowrap;
}

.result-assessment[data-tone="pass"] {
  background: #edf8f4;
  color: var(--success);
}

.result-assessment[data-tone="fail"] {
  background: #fff1ef;
  color: var(--danger);
}

.result-assessment[data-tone="warning"] {
  background: #fff7e8;
  color: #9a5b08;
}

.result-assessment[data-tone="info"] {
  background: #eef3f7;
  color: var(--ink-soft);
}

.overall-assessment {
  display: grid;
  grid-template-columns: minmax(130px, auto) minmax(0, 1fr);
  gap: 8px 16px;
  margin-top: 10px;
  padding-top: 10px;
}

@media (max-width: 640px) {
  .result-summary-scroll {
    border: none;
    overflow: visible;
  }

  .result-summary-table {
    min-width: 0;
  }

  .result-summary-table caption {
    border: 1px solid var(--line);
    border-radius: 4px 4px 0 0;
  }

  .result-summary-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .result-summary-table tbody,
  .result-summary-table tr,
  .result-summary-table th,
  .result-summary-table td {
    display: block;
  }

  .result-summary-table tbody {
    display: grid;
    gap: 8px;
    margin-top: 8px;
  }

  .result-summary-table tbody tr {
    display: grid;
    grid-template-columns: minmax(90px, 0.8fr) minmax(0, 1.2fr);
    border: 1px solid var(--line);
    border-radius: 4px;
    background: #fff;
  }

  .result-summary-table tbody th {
    grid-column: 1 / -1;
    border-right: none;
    padding: 8px 10px;
  }

  .result-summary-table tbody td {
    display: grid;
    grid-template-columns: minmax(90px, 0.8fr) minmax(0, 1.2fr);
    grid-column: 1 / -1;
    gap: 8px;
    border-right: none;
    padding: 7px 10px;
    text-align: left !important;
    white-space: normal;
  }

  .result-summary-table tbody td::before {
    color: var(--ink-soft);
    content: attr(data-label);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .reference-value small {
    grid-column: 2;
  }

  .overall-assessment {
    grid-template-columns: 1fr;
  }
}

.narrative-list,
.process-guidance-list {
  margin-bottom: 0;
  padding-left: 18px;
}

.narrative-item {
  margin-bottom: 10px;
}

.narrative-item-header {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.rule-id,
.evidence-grid,
.narrative-item {
  font-variant-numeric: tabular-nums;
}

.evidence-grid {
  display: grid;
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
}

.evidence-grid dt {
  color: var(--ink-soft);
}

.evidence-grid dd {
  margin: 0;
}

.specification-fallback {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 0.24fr);
  gap: 12px;
  align-items: stretch;
  margin: 10px 0 0;
  font-variant-numeric: tabular-nums;
}

.specification-adjustments-scroll {
  min-width: 0;
  overflow-x: auto;
}

.specification-adjustments-scroll table {
  width: 100%;
  min-width: 480px;
  border-collapse: collapse;
  text-align: right;
}

.specification-adjustments-scroll caption {
  border-bottom: 1px solid var(--line);
  padding: 0 0 6px;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 750;
  text-align: left;
}

.specification-adjustments-scroll th,
.specification-adjustments-scroll td {
  border-bottom: 1px solid var(--line);
  padding: 7px 10px;
  white-space: nowrap;
}

.specification-adjustments-scroll thead th {
  color: var(--ink-soft);
  font-size: 0.72rem;
  font-weight: 700;
}

.specification-adjustments-scroll th:first-child {
  padding-left: 0;
  text-align: left;
}

.recommended-specification,
.specification-adjustment {
  color: var(--accent);
  font-weight: 750;
}

.recommended-specification span {
  margin-right: 5px;
  color: var(--ink-soft);
}

.specification-outcome {
  display: flex;
  min-width: 0;
  border-left: 3px solid var(--success);
  background: #edf8f4;
  padding: 10px 12px;
  flex-direction: column;
  justify-content: center;
}

.specification-outcome span,
.specification-outcome small {
  color: var(--ink-soft);
  font-size: 0.7rem;
  line-height: 1.3;
}

.specification-outcome strong {
  margin: 2px 0;
  color: var(--success);
  font-size: 1.05rem;
}

.process-guidance-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 6px;
}

.process-guidance-context {
  margin-bottom: 10px;
  color: var(--ink-soft);
  font-size: 0.82rem;
  line-height: 1.4;
}

.process-guidance-list {
  padding-left: 20px;
}

.process-guidance-entry {
  min-width: 0;
  padding-left: 1px;
}

.process-guidance-entry-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  min-width: 0;
}

.process-guidance-entry-header strong,
.process-guidance-entry p {
  overflow-wrap: anywhere;
}

.process-guidance-warning {
  display: inline-flex;
  align-items: center;
  border: 1px solid currentColor;
  border-radius: 3px;
  background: #fff1ef;
  padding: 2px 7px;
  font-size: 0.74rem;
  font-weight: 750;
  line-height: 1.2;
}

.process-guidance-entry[data-guidance-state="warning"] {
  color: var(--danger);
}

.interpretation-unavailable {
  margin-bottom: 0;
  border-left: 3px solid var(--pending);
  padding-left: 10px;
  color: var(--ink-soft);
}

@media (max-width: 720px) {
  .evidence-grid {
    grid-template-columns: 1fr;
  }

  .specification-fallback {
    grid-template-columns: 1fr;
  }
}
</style>