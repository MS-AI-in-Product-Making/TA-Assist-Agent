<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import { formatF7NarrativeEvidenceValue } from "@ai-assist/product-language/f7-engineering-narrative";
import type { F7SessionSnapshot } from "../api/f7-client";
import { buildAssumptionResultsInterpretation } from "../assumption-results-interpretation";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
}>();

const interpretation = computed(() => buildAssumptionResultsInterpretation(props.session));
const processGuidanceEntries = computed(() => (
  interpretation.value.processGuidance.status === "available"
    ? interpretation.value.processGuidance.entries
    : []
));
const processGuidanceVersion = computed(() => (
  interpretation.value.processGuidance.status === "available"
    ? interpretation.value.processGuidance.version
    : ""
));
const shouldRenderProcessGuidance = computed(() => (
  interpretation.value.processGuidance.status === "available"
  && interpretation.value.processGuidance.entries.length > 0
));

function formatEvidenceValue(key: string, value: number | string): string {
  if (typeof value !== "number") return value;
  const formattedValue = formatF7NarrativeEvidenceValue(value);
  return /percent/i.test(key) ? `${formattedValue}%` : formattedValue;
}

function evidenceLabel(item: { quantitativeEvidenceLabels?: Readonly<Record<string, string>> }, key: string): string {
  return item.quantitativeEvidenceLabels?.[key] ?? key;
}

function processGuidanceEntryTypeLabel(entryType: string): string {
  switch (entryType) {
    case "escalation":
      return "Escalation";
    case "warning":
      return "Warning";
    case "requirement":
      return "Requirement";
    case "milestone":
      return "Milestone";
    case "instruction":
      return "Instruction";
    default:
      return entryType;
  }
}
</script>

<template>
  <section
    class="workbench-panel ta-results-interpretation"
    aria-label="TA results interpretation based on assumptions"
  >
    <h2>TA Results Interpretation (based on Assumptions)</h2>

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
                Comparison of assumption-based RSS results with system specifications and derived targets
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
          <ul
            v-if="interpretation.narrative.rootCauseAnalysis.length > 0"
            class="narrative-list"
          >
            <li
              v-for="item in interpretation.narrative.rootCauseAnalysis"
              :key="item.ruleId"
              class="narrative-item"
              data-root-cause-item
            >
              <div class="narrative-item-header">
                <strong>{{ item.title }}</strong>
                <span class="rule-id">{{ item.ruleId }}</span>
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
          </ul>
          <p
            v-else
            class="subtle"
          >
            No controlled root-cause signal.
          </p>
        </section>

        <section
          class="narrative-section emphasis-card"
          data-engineering-risk
        >
          <h3>Engineering Risk</h3>
          <p>{{ interpretation.narrative.engineeringRisk }}</p>
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
            >
              <div class="narrative-item-header">
                <strong>{{ item.title }}</strong>
                <span class="rule-id">{{ item.optionId }}</span>
              </div>
              <p>{{ item.narrative }}</p>
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
        <h3>F0 Process Guidance</h3>
        <span
          class="process-guidance-version"
          data-process-guidance-version
        >{{ processGuidanceVersion }}</span>
      </div>
      <p
        class="process-guidance-context"
        data-process-guidance-context
      >
        Triggered by the current TA worksheet and analysis state.
      </p>
      <ol class="process-guidance-list">
        <li
          v-for="entry in processGuidanceEntries"
          :key="entry.entryId"
          class="process-guidance-entry"
          data-process-guidance-entry
          :data-entry-type="entry.entryType"
        >
          <div class="process-guidance-entry-header">
            <span
              class="process-guidance-type-label"
              data-process-guidance-entry-type-label
            >{{ processGuidanceEntryTypeLabel(entry.entryType) }}</span>
            <strong data-process-guidance-entry-title>
              {{ entry.title }}
            </strong>
          </div>
          <p
            class="process-guidance-entry-meta"
            data-process-guidance-entry-id
          >
            {{ entry.entryId }}
          </p>
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

.process-guidance-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 6px;
}

.process-guidance-version {
  color: var(--ink-soft);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.process-guidance-context {
  margin-bottom: 10px;
  color: var(--ink-soft);
  font-size: 0.82rem;
  line-height: 1.4;
}

.process-guidance-list {
  display: grid;
  gap: 10px;
  list-style: none;
  padding-left: 0;
}

.process-guidance-entry {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 0;
  border-top: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
}

.process-guidance-entry:first-child {
  padding-top: 0;
  border-top: none;
}

.process-guidance-entry-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  min-width: 0;
}

.process-guidance-entry-header strong,
.process-guidance-entry-meta,
.process-guidance-entry p {
  overflow-wrap: anywhere;
}

.process-guidance-type-label {
  display: inline-flex;
  align-items: center;
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 2px 7px;
  font-size: 0.74rem;
  font-weight: 750;
  line-height: 1.2;
}

.process-guidance-entry[data-entry-type="escalation"] .process-guidance-type-label {
  background: #fff1ef;
  color: var(--danger);
}

.process-guidance-entry[data-entry-type="warning"] .process-guidance-type-label {
  background: #fff7e8;
  color: #9a5b08;
}

.process-guidance-entry[data-entry-type="requirement"] .process-guidance-type-label {
  background: #eef3f7;
  color: #31556b;
}

.process-guidance-entry[data-entry-type="milestone"] .process-guidance-type-label {
  background: #eff6ef;
  color: #4d6a4e;
}

.process-guidance-entry[data-entry-type="instruction"] .process-guidance-type-label {
  background: #f5f2ee;
  color: #6d5844;
}

.process-guidance-entry-meta {
  margin-bottom: 0;
  color: var(--ink-soft);
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.74rem;
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
}
</style>