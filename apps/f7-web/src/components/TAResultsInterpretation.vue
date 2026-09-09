<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import { formatF7NarrativeEvidenceValue } from "@ai-assist/product-language/f7-engineering-narrative";
import type { F7SessionSnapshot } from "../api/f7-client";
import { buildAssumptionResultsInterpretation } from "../assumption-results-interpretation";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
}>();

const interpretation = computed(() => buildAssumptionResultsInterpretation(props.session));

function formatEvidenceValue(key: string, value: number | string): string {
  if (typeof value !== "number") return value;
  const formattedValue = formatF7NarrativeEvidenceValue(value);
  return /percent/i.test(key) ? `${formattedValue}%` : formattedValue;
}

function evidenceLabel(item: { quantitativeEvidenceLabels?: Readonly<Record<string, string>> }, key: string): string {
  return item.quantitativeEvidenceLabels?.[key] ?? key;
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
          <h3>{{ interpretation.narrative.resultJudgment.headline }}</h3>
          <p class="capability-line">
            <span>
              <strong>Cpk</strong> {{ interpretation.narrative.resultJudgment.display.cpk }}
            </span>
            <span>
              <strong>Target</strong> {{ interpretation.narrative.resultJudgment.display.targetCpk }}
            </span>
            <span>
              <strong>Margin</strong> {{ interpretation.narrative.resultJudgment.display.margin }}
            </span>
          </p>
          <p>{{ interpretation.narrative.resultJudgment.judgment }}</p>
        </section>

        <section
          class="narrative-section"
          data-engineering-summary
        >
          <h3>Engineering Summary</h3>
          <p>{{ interpretation.narrative.engineeringSummary }}</p>
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

        <section
          class="narrative-section assumption-disclosure"
          data-assumption-disclosure
        >
          <h3>Verification Requirements</h3>
          <ul data-validation-requirements>
            <li
              v-for="requirement in interpretation.narrative.validationRequirements"
              :key="requirement"
            >
              {{ requirement }}
            </li>
          </ul>
          <h3>Evidence Disclosure</h3>
          <p data-evidence-disclosure>
            {{ interpretation.narrative.evidenceDisclosure }}
          </p>
          <h3>Assumption Disclosure</h3>
          <p
            v-for="assumption in interpretation.assumptions"
            :key="assumption"
          >
            {{ assumption }}
          </p>
          <p class="provenance">
            <strong>Rule provenance</strong>
            <span data-f0-provenance>{{ interpretation.provenance }}</span>
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

    <div
      class="input-readiness"
      data-input-readiness
    >
      <h3>Input Readiness</h3>
      <p
        v-if="interpretation.inputReadiness.unevaluatedFactorNames.length > 0"
        class="unevaluated-factors"
      >
        <strong>Not evaluated</strong> for factors: {{ interpretation.inputReadiness.unevaluatedFactorNames.join(", ") }}.
      </p>
      <div
        v-if="interpretation.inputReadiness.evaluatedFactorCount > 0"
        class="validation-columns"
      >
        <div>
          <h4>Blocking</h4>
          <ul>
            <li
              v-for="entry in interpretation.inputReadiness.blockingIssues"
              :key="entry.key"
              class="validation-issue"
              :data-factor-id="entry.factorId"
            >
              <strong class="factor-name">{{ entry.factorName }} {{ entry.label }}</strong>
              <span v-if="entry.rowNumbers.length"> rows: {{ entry.rowNumbers.join(",") }}</span>
            </li>
            <li
              v-if="interpretation.inputReadiness.blockingIssues.length === 0 && interpretation.inputReadiness.evaluatedFactorCount > 0"
              class="subtle"
            >
              {{ interpretation.inputReadiness.unevaluatedFactorNames.length > 0 ? "No blocking issues in evaluated datasets." : "No blocking issues." }}
            </li>
          </ul>
        </div>
        <div>
          <h4>Advisory</h4>
          <ul>
            <li
              v-for="entry in interpretation.inputReadiness.advisoryIssues"
              :key="entry.key"
              class="validation-issue"
              :data-factor-id="entry.factorId"
            >
              <strong class="factor-name">{{ entry.factorName }} {{ entry.label }}</strong>
              <span v-if="entry.rowNumbers.length"> rows: {{ entry.rowNumbers.join(",") }}</span>
            </li>
            <li
              v-if="interpretation.inputReadiness.advisoryIssues.length === 0 && interpretation.inputReadiness.evaluatedFactorCount > 0"
              class="subtle"
            >
              {{ interpretation.inputReadiness.unevaluatedFactorNames.length > 0 ? "No advisory issues in evaluated datasets." : "No advisory issues." }}
            </li>
          </ul>
        </div>
      </div>
    </div>
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

.narrative-flow > *,
.validation-columns > *,
.capability-line > * {
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

.capability-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.narrative-list,
.input-readiness ul {
  margin-bottom: 0;
  padding-left: 18px;
}

.narrative-item {
  margin-bottom: 10px;
}

.narrative-item-header,
.provenance {
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

.factor-name,
.validation-issue,
.unevaluated-factors {
  overflow-wrap: anywhere;
}

.assumption-disclosure,
.input-readiness {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

.assumption-disclosure p {
  margin-bottom: 5px;
}

.provenance {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  color: var(--ink-soft);
}

.interpretation-unavailable {
  margin-bottom: 0;
  border-left: 3px solid var(--pending);
  padding-left: 10px;
  color: var(--ink-soft);
}

.input-readiness h4 {
  margin-bottom: 4px;
  font-size: 0.9rem;
}

@media (max-width: 720px) {
  .evidence-grid {
    grid-template-columns: 1fr;
  }
}
</style>