<script setup lang="ts">
import { computed, reactive, type DeepReadonly } from "vue";
import type { F7SessionSnapshot, F7SourceMode } from "../api/f7-client";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly busy: boolean;
}>();

const emit = defineEmits<{
  confirmFactors: [
    confirmations: ReadonlyArray<{
      readonly factorCandidateId: string;
      readonly designNominal: number;
      readonly upperTolerance: number;
      readonly lowerTolerance: number;
    }>,
  ];
  setMode: [factorId: string, mode: F7SourceMode];
  openMeasurement: [factorId: string];
}>();

interface FactorSpecificationDraft {
  designNominal: number;
  upperTolerance: number;
  lowerTolerance: number;
}

const setupDraft = reactive<Record<string, FactorSpecificationDraft>>({});

function draftFor(
  candidateId: string,
  defaults: FactorSpecificationDraft,
): FactorSpecificationDraft {
  if (!setupDraft[candidateId]) {
    setupDraft[candidateId] = { ...defaults };
  }
  return setupDraft[candidateId]!;
}

function candidateDraft(factor: DeepReadonly<F7SessionSnapshot["factors"][number]>): FactorSpecificationDraft {
  return draftFor(factor.factorCandidate.factorCandidateId, {
    designNominal: factor.factorCandidate.designNominal,
    upperTolerance: factor.factorCandidate.upperTolerance,
    lowerTolerance: factor.factorCandidate.lowerTolerance,
  });
}

function specificationError(draft: FactorSpecificationDraft): string {
  if (!Number.isFinite(draft.designNominal) || draft.designNominal === 0) {
    return "Design Nominal must be non-zero.";
  }
  if (!Number.isFinite(draft.upperTolerance) || draft.upperTolerance < 0) {
    return "+Tolerance must be zero or positive.";
  }
  if (!Number.isFinite(draft.lowerTolerance) || draft.lowerTolerance > 0) {
    return "-Tolerance must be zero or negative.";
  }
  if (draft.lowerTolerance >= draft.upperTolerance) {
    return "-Tolerance must be less than +Tolerance.";
  }
  return "";
}

const setupIsValid = computed(() => props.session.factors.every((factor) => (
  specificationError(candidateDraft(factor)) === ""
)));

function nominalClass(value: number): "nominal-negative" | "nominal-positive" | "" {
  if (value < 0) return "nominal-negative";
  if (value > 0) return "nominal-positive";
  return "";
}

function submitSetup(): void {
  if (props.busy) return;
  const payload = props.session.factors.map((factor) => {
    const draft = candidateDraft(factor);
    return {
      factorCandidateId: factor.factorCandidate.factorCandidateId,
      designNominal: draft.designNominal,
      upperTolerance: draft.upperTolerance,
      lowerTolerance: draft.lowerTolerance,
    };
  });
  emit("confirmFactors", payload);
}

function onModeChange(factorId: string, event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target.value !== "MEASURED" && target.value !== "BASELINE_ASSUMPTION") return;
  emit("setMode", factorId, target.value);
}
</script>

<template>
  <section class="workbench-panel" aria-label="Factor setup and source mode">
    <h2>Factor Setup</h2>
    <div class="table-scroll">
      <table class="data-table factor-table">
        <thead>
          <tr>
            <th>Factor</th>
            <th>Design Nominal</th>
            <th>+Tolerance</th>
            <th>-Tolerance</th>
            <th>Source Mode</th>
            <th>Sample Count</th>
            <th>Readiness</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="factor in session.factors" :key="factor.factorCandidate.factorCandidateId">
            <td>
              <div>{{ factor.factorCandidate.factorName }}</div>
              <small class="subtle mono">{{ factor.factorCandidate.factorCandidateId.slice(0, 12) }}</small>
            </td>
            <td>
              <input
                v-if="!factor.setup"
                v-model.number="candidateDraft(factor).designNominal"
                type="number"
                step="any"
                class="factor-spec-input"
                :class="nominalClass(candidateDraft(factor).designNominal)"
                :aria-label="`${factor.factorCandidate.factorName} Design Nominal`"
                :disabled="busy"
              >
              <span v-else :class="nominalClass(factor.setup.designNominal)">{{ factor.setup.designNominal }}</span>
            </td>
            <td>
              <input
                v-if="!factor.setup"
                v-model.number="candidateDraft(factor).upperTolerance"
                type="number"
                min="0"
                step="any"
                class="factor-spec-input"
                :aria-label="`${factor.factorCandidate.factorName} +Tolerance`"
                :disabled="busy"
              >
              <span v-else>{{ factor.setup.upperTolerance }}</span>
            </td>
            <td>
              <input
                v-if="!factor.setup"
                v-model.number="candidateDraft(factor).lowerTolerance"
                type="number"
                max="0"
                step="any"
                class="factor-spec-input"
                :aria-label="`${factor.factorCandidate.factorName} -Tolerance`"
                :disabled="busy"
              >
              <span v-else>{{ factor.setup.lowerTolerance }}</span>
              <small v-if="!factor.setup && specificationError(candidateDraft(factor))" class="factor-spec-error" role="alert">
                {{ specificationError(candidateDraft(factor)) }}
              </small>
            </td>
            <td>
              <fieldset v-if="factor.evidence" class="source-mode-options">
                <legend>Source mode</legend>
                <label class="source-mode-option">
                  <input
                    :name="`mode-${factor.evidence.factorId}`"
                    type="radio"
                    value="BASELINE_ASSUMPTION"
                    :checked="factor.sourceMode === 'BASELINE_ASSUMPTION'"
                    :disabled="busy"
                    @change="onModeChange(factor.evidence.factorId, $event)"
                  >
                  BASELINE_ASSUMPTION
                </label>
                <label class="source-mode-option">
                  <input
                    :name="`mode-${factor.evidence.factorId}`"
                    type="radio"
                    value="MEASURED"
                    :checked="factor.sourceMode === 'MEASURED'"
                    :disabled="busy"
                    @change="onModeChange(factor.evidence.factorId, $event)"
                  >
                  MEASURED
                </label>
              </fieldset>
              <button
                v-if="factor.sourceMode === 'MEASURED'"
                type="button"
                class="factor-workspace-button"
                :data-open-measurement="factor.evidence?.factorId"
                :disabled="busy"
                @click="factor.evidence && emit('openMeasurement', factor.evidence.factorId)"
              >
                Open workspace
              </button>
            </td>
            <td>{{ factor.measurementPasteResult?.dataset?.analyzedCount ?? "-" }}</td>
            <td>
              <span class="status-chip" :class="factor.measurementPasteResult?.status === 'ready' ? 'chip-ready' : 'chip-pending'">
                {{ factor.measurementPasteResult?.status ?? "pending" }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button
      v-if="session.status === 'factor_setup'"
      id="confirm-factor-setup"
      type="button"
      class="action-button"
      :disabled="busy || !setupIsValid"
      @click="submitSetup"
    >
      Confirm factor setup
    </button>
  </section>
</template>