<script setup lang="ts">
import { computed, ref } from "vue";
import { createF7Client, type F7Client, type F7MeasurementStructure, type F7MsaStatus, type F7RationalSubgroupConfig, type F7SetupDistribution, type F7SourceMode, type F7SystemSpecificationInput } from "./api/f7-client";
import WorksheetConfirmation from "./components/WorksheetConfirmation.vue";
import FactorInputTable from "./components/FactorInputTable.vue";
import MeasurementPastePanel from "./components/MeasurementPastePanel.vue";
import MonteCarloPanel from "./components/MonteCarloPanel.vue";
import ReportPanel from "./components/ReportPanel.vue";
import ValidationSummary from "./components/ValidationSummary.vue";
import { createF7SessionStore } from "./state/f7-session";

const props = defineProps<{
  readonly client?: F7Client;
}>();

const store = createF7SessionStore(props.client ?? createF7Client());
const activeMeasurementFactorId = ref("");
const fitActionFactorId = ref("");
const activeMeasurementStage = ref<"measurement" | "capability" | "distribution" | "monteCarlo">("measurement");
const editingFactorSetup = ref(false);
const reportRetryAvailable = ref(false);
let reportRequestToken = 0;

const simulationReady = computed(() => {
  const session = store.session.value;
  return session?.status === "phase_1_ready" && session.factors.every((factor) => (
    factor.sourceMode === "BASELINE_ASSUMPTION"
    || (factor.sourceMode === "MEASURED" && factor.distributionApproval !== undefined)
  ));
});

const workflowSteps = [
  { id: 1, label: "Select worksheet" },
  { id: 2, label: "Measurement analysis" },
  { id: 3, label: "Monte Carlo & Report" },
] as const;

const currentPhaseStep = computed(() => {
  if (activeMeasurementStage.value === "monteCarlo") return 3;
  const status = store.session.value?.status;
  if (!status || status === "worksheet_selection") return 1;
  if (status === "factor_setup" || status === "measurement_entry" || status === "phase_1_ready") return 2;
  return 1;
});

function workflowStepState(stepId: number): "current" | "complete" | "pending" | "locked" {
  if (stepId === 3 && !simulationReady.value) return "locked";
  if (stepId === 2 && store.session.value?.status === "worksheet_selection") return "locked";
  if (stepId < currentPhaseStep.value) return "complete";
  if (stepId === currentPhaseStep.value) return "current";
  return "pending";
}

function workflowStepStatusText(stepId: number, state: "current" | "complete" | "pending" | "locked"): string {
  if (state === "locked") return "Locked";
  if (state === "complete") return "Complete";
  if (state === "pending") return stepId === 3 ? "Available when analysis is ready" : "Available";
  if (stepId === 2) return "Measure · Capability · Fit";
  if (stepId === 3) return "Simulation · Automatic report";
  return "Current";
}

const statusText = computed(() => {
  if (!store.session.value) return "No workbook imported";
  return store.session.value.status;
});

async function swallowHandledError(operation: () => Promise<void>): Promise<void> {
  fitActionFactorId.value = "";
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
  fitActionFactorId.value = "";
  try {
    await store.importWorkbook(file);
    reportRequestToken += 1;
    activeMeasurementFactorId.value = "";
    activeMeasurementStage.value = "measurement";
    editingFactorSetup.value = false;
  } catch {
    // Store already captures and exposes a controlled UI error.
  } finally {
    target.value = "";
  }
}

async function onConfirmWorksheet(worksheetName: string): Promise<void> {
  await swallowHandledError(async () => {
    await store.confirmWorksheet(worksheetName);
  });
}

async function onConfirmFactors(confirmations: ReadonlyArray<{
  readonly factorCandidateId: string;
  readonly designNominal: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly longTermSafetyFactor: number;
  readonly sigmaLevel: number;
  readonly distribution: F7SetupDistribution;
  readonly factorName?: string;
  readonly userAdded?: true;
}>, systemSpecification: F7SystemSpecificationInput): Promise<void> {
  await swallowHandledError(async () => {
    await store.confirmFactors(confirmations, systemSpecification);
    editingFactorSetup.value = false;
  });
}

function onEditFactorSetup(): void {
  reportRequestToken += 1;
  activeMeasurementFactorId.value = "";
  activeMeasurementStage.value = "measurement";
  editingFactorSetup.value = true;
}

async function onSetMode(factorId: string, mode: F7SourceMode): Promise<void> {
  await swallowHandledError(async () => {
    await store.setFactorMode(factorId, mode);
    if (mode !== "MEASURED" && activeMeasurementFactorId.value === factorId) {
      activeMeasurementFactorId.value = "";
    }
  });
}

function onOpenMeasurement(factorId: string): void {
  activeMeasurementFactorId.value = factorId;
  activeMeasurementStage.value = "measurement";
}

function onCloseMeasurement(): void {
  activeMeasurementFactorId.value = "";
  activeMeasurementStage.value = "measurement";
}

async function onClearMeasurements(factorId: string, onCleared: () => void): Promise<void> {
  let cleared = false;
  await swallowHandledError(async () => {
    await store.setFactorMode(factorId, "MEASURED");
    cleared = true;
  });
  if (!cleared) return;
  fitActionFactorId.value = "";
  onCleared();
}

async function onPaste(payload: {
  factorId: string;
  structure: F7MeasurementStructure;
  rationalSubgroupConfig?: F7RationalSubgroupConfig;
  sourceReference: string;
  msaStatus: F7MsaStatus;
  text: string;
}, onSaved: (saved: boolean) => void): Promise<void> {
  let saved = false;
  await swallowHandledError(async () => {
    await store.pasteMeasurements(payload);
    saved = true;
  });
  onSaved(saved);
}

async function onFitDistribution(factorId: string): Promise<void> {
  fitActionFactorId.value = factorId;
  try {
    await store.fitDistribution(factorId);
    fitActionFactorId.value = "";
  } catch {
    // Store already captures and exposes a controlled UI error.
  }
}

async function openMonteCarlo(): Promise<void> {
  if (!simulationReady.value || store.isBusy.value) return;
  activeMeasurementFactorId.value = "";
  activeMeasurementStage.value = "monteCarlo";
  if (store.session.value?.monteCarloResult) await openReport();
}

async function onRunMonteCarlo(request: {
  lowerSpecLimit: number;
  upperSpecLimit: number;
  targetSigmaLevel: number;
  iterations: 10_000 | 100_000;
  runSeed: string;
  correlationMode: "INDEPENDENT";
}): Promise<void> {
  let completed = false;
  reportRetryAvailable.value = false;
  await swallowHandledError(async () => {
    await store.runMonteCarlo(request);
    completed = true;
  });
  if (completed) await openReport();
}

async function openReport(): Promise<void> {
  if (store.isBusy.value || !store.session.value?.monteCarloResult) return;
  if (store.report.value) {
    reportRetryAvailable.value = false;
    activeMeasurementFactorId.value = "";
    return;
  }
  const requestToken = ++reportRequestToken;
  activeMeasurementFactorId.value = "";
  try {
    await store.generateReport();
    reportRetryAvailable.value = false;
    if (requestToken !== reportRequestToken) return;
  } catch {
    if (requestToken === reportRequestToken) reportRetryAvailable.value = true;
  }
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
            <span
              class="step-index"
              aria-hidden="true"
            >{{ step.id }}</span>
            <button
              v-if="step.id === 3 && simulationReady"
              type="button"
              class="step-label step-link"
              data-workflow-open-monte-carlo
              :disabled="store.isBusy.value"
              @click="openMonteCarlo"
            >
              {{ step.label }}
            </button>
            <span
              v-else
              class="step-label"
            >{{ step.label }}</span>
            <span class="step-status">{{ workflowStepStatusText(step.id, workflowStepState(step.id)) }}</span>
          </li>
        </ol>
        <div class="workflow-metadata">
          <p><strong>Classification</strong> {{ store.session.value.outputClassification }}</p>
          <p><strong>Workbook</strong> <span data-workbook-name>{{ store.session.value.workbook.fileName }}</span></p>
          <p>
            <strong>Worksheet Selection</strong>
            <span data-worksheet-selection>
              {{ store.session.value.selectedWorksheetNames.length > 0
                ? store.session.value.selectedWorksheetNames.join(", ")
                : "Not selected" }}
            </span>
          </p>
        </div>
      </aside>
      <section class="workflow-content">
        <WorksheetConfirmation
          v-if="store.session.value.status === 'worksheet_selection'"
          :session="store.session.value"
          :busy="store.isBusy.value"
          @confirm="onConfirmWorksheet"
        />

        <FactorInputTable
          v-if="!activeMeasurementFactorId && (activeMeasurementStage === 'measurement' || activeMeasurementStage === 'capability' || activeMeasurementStage === 'distribution') && (store.session.value.status === 'factor_setup' || store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready')"
          :session="store.session.value"
          :busy="store.isBusy.value"
          :editing-setup="editingFactorSetup"
          @confirm-factors="onConfirmFactors"
          @edit-setup="onEditFactorSetup"
          @set-mode="onSetMode"
          @open-measurement="onOpenMeasurement"
        />

        <MeasurementPastePanel
          v-if="!editingFactorSetup && (activeMeasurementStage === 'measurement' || activeMeasurementStage === 'capability' || activeMeasurementStage === 'distribution') && activeMeasurementFactorId && (store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready')"
          :session="store.session.value"
          :busy="store.isBusy.value"
          :fit-loading="store.busyAction.value === 'fitDistribution' && fitActionFactorId === activeMeasurementFactorId"
          :fit-error="fitActionFactorId === activeMeasurementFactorId ? store.error.value : null"
          :factor-id="activeMeasurementFactorId"
          @paste="onPaste"
          @clear="onClearMeasurements"
          @fit="onFitDistribution"
          @stage-change="activeMeasurementStage = $event"
          @close="onCloseMeasurement"
        />

        <MonteCarloPanel
          v-if="activeMeasurementStage === 'monteCarlo' && simulationReady"
          :session="store.session.value"
          :busy="store.isBusy.value"
          @run="onRunMonteCarlo"
          @close="activeMeasurementStage = 'measurement'"
        />

        <button
          v-if="activeMeasurementStage === 'monteCarlo' && reportRetryAvailable"
          type="button"
          class="action-button"
          data-retry-report
          :disabled="store.isBusy.value"
          @click="openReport"
        >
          Retry report
        </button>

        <ReportPanel
          v-if="activeMeasurementStage === 'monteCarlo' && store.report.value"
          :report="store.report.value"
        />

        <ValidationSummary
          v-if="!editingFactorSetup && !activeMeasurementFactorId && activeMeasurementStage !== 'monteCarlo' && (store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready')"
          :session="store.session.value"
        />

        <section
          v-if="!editingFactorSetup && !activeMeasurementFactorId && activeMeasurementStage !== 'monteCarlo' && store.session.value.status === 'phase_1_ready'"
          class="workbench-panel ready-panel"
        >
          <h2>Phase 1 setup ready</h2>
          <p>
            {{ simulationReady
              ? "All factor models are governed and ready for system simulation."
              : "Complete Distribution Fit for each measured factor to automatically select its final Monte Carlo distribution." }}
          </p>
          <button
            v-if="simulationReady"
            type="button"
            class="action-button"
            data-open-monte-carlo
            :disabled="store.isBusy.value"
            @click="openMonteCarlo"
          >
            Open Monte Carlo
          </button>
        </section>
      </section>
    </div>
  </main>
</template>
