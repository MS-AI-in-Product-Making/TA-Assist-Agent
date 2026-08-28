<script setup lang="ts">
import { computed, ref } from "vue";
import { createF7Client, type F7Client, type F7MeasurementStructure, type F7MsaStatus, type F7SetupDistribution, type F7SourceMode, type F7SystemSpecificationInput } from "./api/f7-client";
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
const activeMeasurementStage = ref<"measurement" | "capability" | "distribution" | "monteCarlo" | "report">("measurement");
const editingFactorSetup = ref(false);
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
  { id: 2, label: "Measurement data" },
  { id: 3, label: "Capability analysis" },
  { id: 4, label: "Distribution fit" },
  { id: 5, label: "Monte Carlo" },
  { id: 6, label: "Report" },
] as const;

const currentPhaseStep = computed(() => {
  if (activeMeasurementStage.value === "report") return 6;
  if (activeMeasurementStage.value === "monteCarlo") return 5;
  if (activeMeasurementStage.value === "distribution") return 4;
  if (activeMeasurementStage.value === "capability") return 3;
  const status = store.session.value?.status;
  if (!status || status === "worksheet_selection") return 1;
  if (status === "factor_setup" || status === "measurement_entry" || status === "phase_1_ready") return 2;
  return 1;
});

function workflowStepState(stepId: number): "current" | "complete" | "pending" | "locked" {
  if (stepId === 6 && !store.session.value?.monteCarloResult) return "locked";
  if (stepId === 5 && !simulationReady.value) return "locked";
  if (
    stepId === 4
    && activeMeasurementStage.value !== "distribution"
    && activeMeasurementStage.value !== "monteCarlo"
    && activeMeasurementStage.value !== "report"
  ) return "locked";
  if (stepId === 3 && activeMeasurementStage.value === "measurement") return "locked";
  if (stepId < currentPhaseStep.value) return "complete";
  if (stepId === currentPhaseStep.value) return "current";
  return "pending";
}

function workflowStepStatusText(stepId: number, state: "current" | "complete" | "pending" | "locked"): string {
  if (state === "locked") return "Locked";
  if (state === "complete") return "Complete";
  if (state === "pending") return stepId === 6 ? "Available" : "Available in Phase 1";
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

async function onFitDistribution(factorId: string): Promise<void> {
  await swallowHandledError(async () => {
    await store.fitDistribution(factorId);
  });
}

async function onApproveDistribution(
  factorId: string,
  family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform",
): Promise<void> {
  await swallowHandledError(async () => {
    await store.approveDistribution(factorId, family);
  });
}

function openMonteCarlo(): void {
  if (!simulationReady.value || store.isBusy.value) return;
  activeMeasurementFactorId.value = "";
  activeMeasurementStage.value = "monteCarlo";
}

async function onRunMonteCarlo(request: {
  lowerSpecLimit: number;
  upperSpecLimit: number;
  targetSigmaLevel: number;
  iterations: 10_000 | 100_000;
  runSeed: string;
  correlationMode: "INDEPENDENT";
}): Promise<void> {
  await swallowHandledError(async () => {
    await store.runMonteCarlo(request);
  });
}

async function openReport(): Promise<void> {
  if (store.isBusy.value || !store.session.value?.monteCarloResult) return;
  const requestToken = ++reportRequestToken;
  activeMeasurementFactorId.value = "";
  await swallowHandledError(async () => {
    await store.generateReport();
    if (requestToken === reportRequestToken && activeMeasurementStage.value === "monteCarlo") {
      activeMeasurementStage.value = "report";
    }
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
          :fit-loading="store.busyAction.value === 'fitDistribution'"
          :fit-error="store.error.value"
          :factor-id="activeMeasurementFactorId"
          @paste="onPaste"
          @fit="onFitDistribution"
          @approve="onApproveDistribution"
          @stage-change="activeMeasurementStage = $event"
          @close="onCloseMeasurement"
        />

        <MonteCarloPanel
          v-if="activeMeasurementStage === 'monteCarlo' && simulationReady"
          :session="store.session.value"
          :busy="store.isBusy.value"
          @run="onRunMonteCarlo"
          @open-report="openReport"
          @close="activeMeasurementStage = 'measurement'"
        />

        <ReportPanel
          v-if="activeMeasurementStage === 'report' && store.report.value"
          :report="store.report.value"
          @close="activeMeasurementStage = 'monteCarlo'"
        />

        <ValidationSummary
          v-if="!editingFactorSetup && !activeMeasurementFactorId && activeMeasurementStage !== 'monteCarlo' && activeMeasurementStage !== 'report' && (store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready')"
          :session="store.session.value"
        />

        <section
          v-if="!editingFactorSetup && !activeMeasurementFactorId && activeMeasurementStage !== 'monteCarlo' && activeMeasurementStage !== 'report' && store.session.value.status === 'phase_1_ready'"
          class="workbench-panel ready-panel"
        >
          <h2>Phase 1 setup ready</h2>
          <p>
            {{ simulationReady
              ? "All factor models are governed and ready for system simulation."
              : "Approve the proposed distribution for each measured factor to unlock Monte Carlo." }}
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
