<script setup lang="ts">
import { reactive } from "vue";
import type { F7LoopCoefficient, F7SessionSnapshot, F7SourceMode } from "../api/f7-client";

const props = defineProps<{
  readonly session: F7SessionSnapshot;
  readonly busy: boolean;
}>();

const emit = defineEmits<{
  confirmFactors: [
    confirmations: ReadonlyArray<{ readonly factorCandidateId: string; readonly loopCoefficient: F7LoopCoefficient; readonly unit: string }>,
  ];
  setMode: [factorId: string, mode: F7SourceMode];
}>();

const setupDraft = reactive<Record<string, { coefficient: F7LoopCoefficient; unit: string }>>({});

function draftFor(candidateId: string, defaultCoefficient: F7LoopCoefficient, defaultUnit = ""): {
  coefficient: F7LoopCoefficient;
  unit: string;
} {
  if (!setupDraft[candidateId]) {
    setupDraft[candidateId] = {
      coefficient: defaultCoefficient,
      unit: defaultUnit,
    };
  }
  return setupDraft[candidateId]!;
}

function submitSetup(): void {
  if (props.busy) return;
  const payload = props.session.factors.map((factor) => {
    const draft = draftFor(
      factor.factorCandidate.factorCandidateId,
      factor.factorCandidate.excelSignedMean < 0 ? -1 : 1,
      factor.factorCandidate.workbookUnitEvidence ?? "",
    );
    return {
      factorCandidateId: factor.factorCandidate.factorCandidateId,
      loopCoefficient: draft.coefficient,
      unit: draft.unit.trim(),
    };
  });
  if (payload.some((entry) => entry.unit.length === 0)) return;
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
            <th>Source Cells</th>
            <th>Signed Mean</th>
            <th>Coefficient</th>
            <th>Unit</th>
            <th>Physical Mean</th>
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
            <td class="mono">
              <div v-for="(cell, key) in factor.factorCandidate.sourceCells" :key="`${factor.factorCandidate.factorCandidateId}-${key}`">
                {{ key }}: {{ cell }}
              </div>
            </td>
            <td>{{ factor.factorCandidate.excelSignedMean }}</td>
            <td>
              <template v-if="!factor.setup">
                <fieldset>
                  <legend class="sr-only">{{ factor.factorCandidate.factorName }} Loop coefficient</legend>
                  <label>
                    <input
                      :name="`coef-${factor.factorCandidate.factorCandidateId}`"
                      type="radio"
                      value="-1"
                      :checked="draftFor(factor.factorCandidate.factorCandidateId, factor.factorCandidate.excelSignedMean < 0 ? -1 : 1).coefficient === -1"
                      @change="draftFor(factor.factorCandidate.factorCandidateId, factor.factorCandidate.excelSignedMean < 0 ? -1 : 1).coefficient = -1"
                    > -1
                  </label>
                  <label>
                    <input
                      :name="`coef-${factor.factorCandidate.factorCandidateId}`"
                      type="radio"
                      value="1"
                      :checked="draftFor(factor.factorCandidate.factorCandidateId, factor.factorCandidate.excelSignedMean < 0 ? -1 : 1).coefficient === 1"
                      @change="draftFor(factor.factorCandidate.factorCandidateId, factor.factorCandidate.excelSignedMean < 0 ? -1 : 1).coefficient = 1"
                    > +1
                  </label>
                </fieldset>
              </template>
              <template v-else>
                {{ factor.setup.loopCoefficient }}
              </template>
            </td>
            <td>
              <template v-if="!factor.setup">
                <label :for="`unit-${factor.factorCandidate.factorCandidateId}`" class="sr-only">Unit</label>
                <input
                  :id="`unit-${factor.factorCandidate.factorCandidateId}`"
                  :value="draftFor(factor.factorCandidate.factorCandidateId, factor.factorCandidate.excelSignedMean < 0 ? -1 : 1, factor.factorCandidate.workbookUnitEvidence ?? '').unit"
                  required
                  @input="draftFor(factor.factorCandidate.factorCandidateId, factor.factorCandidate.excelSignedMean < 0 ? -1 : 1).unit = ($event.target as HTMLInputElement).value"
                >
              </template>
              <template v-else>
                {{ factor.evidence?.unit ?? factor.setup.unit }}
              </template>
            </td>
            <td>{{ factor.evidence?.physicalMean ?? "-" }}</td>
            <td>
              <fieldset v-if="factor.evidence">
                <legend>Source mode</legend>
                <label>
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
                <label>
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
              </fieldset>
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
      type="button"
      class="action-button"
      :disabled="busy"
      @click="submitSetup"
    >
      Confirm factor setup
    </button>
  </section>
</template>