<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { F7ExclusionReason, F7MeasurementStructure, F7MsaStatus, F7SessionSnapshot } from "../api/f7-client";

const props = defineProps<{
  readonly session: F7SessionSnapshot;
  readonly busy: boolean;
}>();

const emit = defineEmits<{
  paste: [payload: {
    factorId: string;
    structure: F7MeasurementStructure;
    sourceReference: string;
    msaStatus: F7MsaStatus;
    text: string;
  }];
  disposition: [payload: {
    factorId: string;
    rowNumbers: readonly number[];
    action: "EXCLUDE" | "RESTORE";
    reason: F7ExclusionReason;
    operatorReference: string;
  }];
}>();

const form = reactive({
  selectedFactorId: "",
  structure: "UNORDERED_SAMPLE" as F7MeasurementStructure,
  sourceReference: "",
  msaStatus: "unknown" as F7MsaStatus,
  text: "",
  dispositionRows: "",
  dispositionReason: "OUTLIER" as F7ExclusionReason,
  dispositionOperatorReference: "",
});

const dispositionRowsError = ref("");

const measuredFactors = computed(() => props.session.factors.filter((factor) => factor.sourceMode === "MEASURED" && factor.evidence));

const selectedFactor = computed(() => measuredFactors.value.find((factor) => factor.evidence?.factorId === form.selectedFactorId));

function submitPaste(): void {
  if (props.busy || !form.selectedFactorId || !form.sourceReference.trim() || !form.text.trim()) return;
  emit("paste", {
    factorId: form.selectedFactorId,
    structure: form.structure,
    sourceReference: form.sourceReference.trim(),
    msaStatus: form.msaStatus,
    text: form.text,
  });
}

function parseRowNumbers(raw: string): number[] | null {
  const tokens = raw.split(",").map((value) => value.trim());
  if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
    return null;
  }

  const numbers: number[] = [];
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) {
      return null;
    }
    const parsed = Number(token);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    numbers.push(parsed);
  }

  return [...new Set(numbers)].sort((left, right) => left - right);
}

function submitDisposition(): void {
  const rows = parseRowNumbers(form.dispositionRows);
  if (rows === null || rows.length === 0) {
    dispositionRowsError.value = "Enter valid positive integer row numbers";
    return;
  }
  dispositionRowsError.value = "";
  if (props.busy || !form.selectedFactorId || !form.dispositionOperatorReference.trim()) return;
  emit("disposition", {
    factorId: form.selectedFactorId,
    rowNumbers: rows,
    action: "EXCLUDE",
    reason: form.dispositionReason,
    operatorReference: form.dispositionOperatorReference.trim(),
  });
}
</script>

<template>
  <section class="workbench-panel" aria-label="Measurement paste panel">
    <h2>Measurement Input</h2>
    <div class="form-grid">
      <label>
        Factor
        <select v-model="form.selectedFactorId">
          <option value="">Select factor</option>
          <option v-for="factor in measuredFactors" :key="factor.evidence?.factorId" :value="factor.evidence?.factorId">
            {{ factor.factorCandidate.factorName }}
          </option>
        </select>
      </label>
      <label>
        Structure
        <select v-model="form.structure">
          <option value="RATIONAL_SUBGROUP">RATIONAL_SUBGROUP</option>
          <option value="ORDERED_INDIVIDUALS">ORDERED_INDIVIDUALS</option>
          <option value="UNORDERED_SAMPLE">UNORDERED_SAMPLE</option>
        </select>
      </label>
      <label>
        Source reference
        <input v-model="form.sourceReference" type="text">
      </label>
      <label>
        MSA status
        <select v-model="form.msaStatus">
          <option value="available">available</option>
          <option value="not_available">not_available</option>
          <option value="unknown">unknown</option>
        </select>
      </label>
    </div>
    <label>
      Measurement text
      <textarea v-model="form.text" rows="7" />
    </label>
    <button type="button" class="action-button" :disabled="busy" @click="submitPaste">Paste measurements</button>

    <div class="divider" />
    <h3>Outlier disposition</h3>
    <p class="subtle">
      Original row count: {{ selectedFactor?.measurementPasteResult?.dataset?.originalRowCount ?? "-" }}
    </p>
    <div class="form-grid">
      <label>
        Row numbers
        <input v-model="form.dispositionRows" type="text" placeholder="e.g. 5,8,10">
        <span v-if="dispositionRowsError" role="alert" aria-live="polite" class="subtle">{{ dispositionRowsError }}</span>
      </label>
      <label>
        Reason
        <select v-model="form.dispositionReason">
          <option value="OUTLIER">OUTLIER</option>
          <option value="MEASUREMENT_SYSTEM_ERROR">MEASUREMENT_SYSTEM_ERROR</option>
          <option value="TRANSCRIPTION_ERROR">TRANSCRIPTION_ERROR</option>
          <option value="PROCESS_INTERRUPTION">PROCESS_INTERRUPTION</option>
          <option value="OTHER">OTHER</option>
        </select>
      </label>
      <label>
        Operator reference
        <input v-model="form.dispositionOperatorReference" type="text">
      </label>
    </div>
    <button type="button" class="warn-button" :disabled="busy" @click="submitDisposition">
      Confirm exclusion
    </button>
  </section>
</template>