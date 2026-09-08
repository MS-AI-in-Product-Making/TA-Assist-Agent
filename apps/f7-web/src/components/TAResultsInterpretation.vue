<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import { buildAssumptionResultsInterpretation } from "../assumption-results-interpretation";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
}>();

const interpretation = computed(() => buildAssumptionResultsInterpretation(props.session));

function formatCapability(value: number): string {
  return value.toFixed(4);
}

function formatContribution(value: number): string {
  return `${value.toFixed(2)}%`;
}
</script>

<template>
  <section
    class="workbench-panel ta-results-interpretation"
    aria-label="TA results interpretation based on assumptions"
  >
    <h2>TA Results Interpretation (based on Assumptions)</h2>

    <template v-if="interpretation.status === 'available'">
      <div class="interpretation-grid">
        <div data-capability-assessment>
          <h3>Capability Assessment</h3>
          <p class="capability-line">
            <span>
              <strong>Cpk</strong> {{ formatCapability(interpretation.capability.cpk) }}
            </span>
            <span>
              <strong>Target</strong> {{ formatCapability(interpretation.capability.targetCpk) }}
            </span>
            <strong
              class="capability-status"
              :class="`status-${interpretation.capability.status}`"
              aria-live="polite"
              role="status"
            >
              {{ interpretation.capability.status === "meets-target" ? "Meets target" : "Below target" }}
            </strong>
          </p>
          <p class="subtle">
            {{ interpretation.capability.statement }}
          </p>
        </div>

        <div
          v-if="interpretation.dominantContributors.length > 0"
          data-dominant-contributors
        >
          <h3>Dominant Contributors</h3>
          <ul>
            <li
              v-for="contributor in interpretation.dominantContributors"
              :key="contributor.reference"
            >
              <strong>{{ contributor.factorName }}</strong>
              <span>{{ formatContribution(contributor.contributionPercent) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="engineering-interpretation"
        data-engineering-interpretation
      >
        <div>
          <h3>Controlled Root Signal</h3>
          <ul v-if="interpretation.engineeringInterpretations.length > 0">
            <li
              v-for="signal in interpretation.engineeringInterpretations"
              :key="signal"
            >
              {{ signal }}
            </li>
          </ul>
          <p
            v-else
            class="subtle"
          >
            No controlled root-cause signal.
          </p>
        </div>
        <div>
          <h3>Controlled Improvement Option</h3>
          <ul v-if="interpretation.improvementOptions.length > 0">
            <li
              v-for="option in interpretation.improvementOptions"
              :key="option"
            >
              {{ option }}
            </li>
          </ul>
          <p
            v-else
            class="subtle"
          >
            No controlled improvement option.
          </p>
        </div>
      </div>

      <div
        class="assumption-disclosure"
        data-assumption-disclosure
      >
        <h3>Verification Requirements</h3>
        <ul data-validation-requirements>
          <li
            v-for="requirement in interpretation.validationRequirements"
            :key="requirement"
          >
            {{ requirement }}
          </li>
        </ul>
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

.ta-results-interpretation h2,
.ta-results-interpretation h3,
.ta-results-interpretation h4,
.ta-results-interpretation p,
.ta-results-interpretation ul {
  margin-top: 0;
}

.interpretation-grid,
.engineering-interpretation {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.interpretation-grid > *,
.engineering-interpretation > *,
.validation-columns > *,
.capability-line > * {
  min-width: 0;
}

.capability-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.capability-status {
  color: var(--danger);
}

.capability-status.status-meets-target {
  color: var(--success);
}

[data-dominant-contributors] ul,
.engineering-interpretation ul,
.input-readiness ul {
  margin-bottom: 0;
  padding-left: 18px;
}

[data-dominant-contributors] li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-variant-numeric: tabular-nums;
}

.factor-name,
.validation-issue,
.unevaluated-factors {
  overflow-wrap: anywhere;
}

.engineering-interpretation,
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
  .interpretation-grid,
  .engineering-interpretation {
    grid-template-columns: 1fr;
  }
}
</style>