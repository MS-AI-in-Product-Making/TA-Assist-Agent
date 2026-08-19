<script setup lang="ts">
import { computed } from "vue";
import { createF7Client, type F7Client, type F7ExclusionReason, type F7LoopCoefficient, type F7MeasurementStructure, type F7MsaStatus, type F7SourceMode } from "./api/f7-client";
import WorksheetConfirmation from "./components/WorksheetConfirmation.vue";
import FactorInputTable from "./components/FactorInputTable.vue";
import MeasurementPastePanel from "./components/MeasurementPastePanel.vue";
import ValidationSummary from "./components/ValidationSummary.vue";
import { createF7SessionStore } from "./state/f7-session";

const props = defineProps<{
  readonly client?: F7Client;
}>();

const store = createF7SessionStore(props.client ?? createF7Client());

const workflowSteps = [
  { id: 1, label: "Select worksheet" },
  { id: 2, label: "Measurement data" },
  { id: 3, label: "Capability analysis" },
  { id: 4, label: "Distribution fit" },
  { id: 5, label: "Monte Carlo" },
  { id: 6, label: "Report" },
] as const;

const currentPhaseStep = computed(() => {
  const status = store.session.value?.status;
  if (!status || status === "worksheet_selection") return 1;
  if (status === "factor_setup" || status === "measurement_entry" || status === "phase_1_ready") return 2;
  return 1;
});

function workflowStepState(stepId: number): "current" | "complete" | "pending" | "locked" {
  if (stepId >= 3) return "locked";
  if (stepId < currentPhaseStep.value) return "complete";
  if (stepId === currentPhaseStep.value) return "current";
  return "pending";
}

function workflowStepStatusText(stepId: number, state: "current" | "complete" | "pending" | "locked"): string {
  if (state === "locked") return "Locked (Phase 2)";
  if (state === "complete") return "Complete";
  if (state === "pending") return "Available in Phase 1";
  if (stepId === 2 && store.session.value?.status === "phase_1_ready") return "Current (ready summary)";
  return "Current";
}

const statusText = computed(() => {
  if (!store.session.value) return "No workbook imported";
  return store.session.value.status;
});

async function swallowHandledError(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch {
    // Store already captures and exposes a controlled UI error.
  }
}

async function onImportFile(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    await swallowHandledError(async () => {
      await store.importWorkbook(file);
    });
  } finally {
    target.value = "";
  }
}

async function onConfirmWorksheet(worksheetName: string): Promise<void> {
  await swallowHandledError(async () => {
    await store.confirmWorksheet(worksheetName);
  });
}

async function onConfirmFactors(confirmations: ReadonlyArray<{ readonly factorCandidateId: string; readonly loopCoefficient: F7LoopCoefficient; readonly unit: string }>): Promise<void> {
  await swallowHandledError(async () => {
    await store.confirmFactors(confirmations);
  });
}

async function onSetMode(factorId: string, mode: F7SourceMode): Promise<void> {
  await swallowHandledError(async () => {
    await store.setFactorMode(factorId, mode);
  });
}

async function onPaste(payload: {
  factorId: string;
  structure: F7MeasurementStructure;
  sourceReference: string;
  msaStatus: F7MsaStatus;
  text: string;
}): Promise<void> {
  await swallowHandledError(async () => {
    await store.pasteMeasurements(payload);
  });
}

async function onDisposition(payload: {
  factorId: string;
  rowNumbers: readonly number[];
  action: "EXCLUDE" | "RESTORE";
  reason: F7ExclusionReason;
  operatorReference: string;
}): Promise<void> {
  await swallowHandledError(async () => {
    await store.applyMeasurementDisposition(payload);
  });
}
</script>

<template>
  <main class="workbench-root" :aria-busy="store.isBusy.value ? 'true' : 'false'">
    <header class="workbench-header">
      <div>
        <h1>F7 Measurement Workbench</h1>
        <p class="subtle">Industrial metrology phase 1 setup shell</p>
      </div>
      <div class="header-meta">
        <span class="status-chip chip-pending">{{ statusText }}</span>
      </div>
    </header>

    <section class="workbench-panel">
      <h2>Import Workbook</h2>
      <label for="workbook-file">Workbook file</label>
      <input
        id="workbook-file"
        type="file"
        accept=".xlsx"
        :disabled="store.isBusy.value"
        @change="onImportFile"
      >
      <p class="subtle">Workbook bytes are uploaded only for local session parsing.</p>
    </section>

    <p v-if="store.error.value" class="error-banner" role="status" aria-live="polite">
      {{ store.error.value.summary }}
    </p>

    <div v-if="store.session.value" class="layout-grid">
      <aside class="workflow-rail">
        <h2 class="rail-title">Workflow</h2>
        <ol class="workflow-steps">
          <li
            v-for="step in workflowSteps"
            :key="step.id"
            :class="`step-${workflowStepState(step.id)}`"
            :aria-current="workflowStepState(step.id) === 'current' ? 'step' : undefined"
            :aria-disabled="workflowStepState(step.id) === 'locked' ? 'true' : undefined"
          >
            <span class="step-index" aria-hidden="true">{{ step.id }}</span>
            <span class="step-label">{{ step.label }}</span>
            <span class="step-status">{{ workflowStepStatusText(step.id, workflowStepState(step.id)) }}</span>
          </li>
        </ol>
        <p><strong>Session</strong> {{ store.session.value.sessionId }}</p>
        <p><strong>Classification</strong> {{ store.session.value.outputClassification }}</p>
        <p><strong>Workbook</strong> {{ store.session.value.workbook.fileName }}</p>
      </aside>
      <section class="workflow-content">
        <WorksheetConfirmation
          v-if="store.session.value.status === 'worksheet_selection'"
          :session="store.session.value"
          :busy="store.isBusy.value"
          @confirm="onConfirmWorksheet"
        />

        <FactorInputTable
          v-if="store.session.value.status === 'factor_setup' || store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready'"
          :session="store.session.value"
          :busy="store.isBusy.value"
          @confirm-factors="onConfirmFactors"
          @set-mode="onSetMode"
        />

        <MeasurementPastePanel
          v-if="store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready'"
          :session="store.session.value"
          :busy="store.isBusy.value"
          @paste="onPaste"
          @disposition="onDisposition"
        />

        <ValidationSummary
          v-if="store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready'"
          :session="store.session.value"
        />

        <section v-if="store.session.value.status === 'phase_1_ready'" class="workbench-panel ready-panel">
          <h2>Phase 1 setup ready</h2>
          <p>
            Setup ready. Capability analysis and Monte Carlo are not executed in this phase.
          </p>
        </section>
      </section>
    </div>
  </main>
</template>
