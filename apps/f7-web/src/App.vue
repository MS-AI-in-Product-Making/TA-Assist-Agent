<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
import { computed, markRaw, nextTick, ref, shallowRef, watch } from "vue";
import { createF7Client, type AssumptionResultsPdfRequest, type F7Client, type F7MeasurementStructure, type F7MsaStatus, type F7RationalSubgroupConfig, type F7SetupDistribution, type F7SourceMode, type F7SystemSpecificationInput } from "./api/f7-client";
import WorksheetConfirmation from "./components/WorksheetConfirmation.vue";
import FactorInputTable from "./components/FactorInputTable.vue";
import MeasurementPastePanel from "./components/MeasurementPastePanel.vue";
import MonteCarloPanel from "./components/MonteCarloPanel.vue";
import ReportPanel from "./components/ReportPanel.vue";
import TAResultsInterpretation from "./components/TAResultsInterpretation.vue";
import {
  type AssumptionResultsEngineeringEvidence,
  type EngineeringEvidenceEnvelope,
  type EngineeringEvidenceWorkbookIdentity,
  snapshotPlainDto,
} from "./assumption-results-pdf-evidence";
import { createF7SessionStore } from "./state/f7-session";

const props = defineProps<{
  readonly client?: F7Client;
}>();

const client = props.client ?? createF7Client();
const store = createF7SessionStore(client);
const activeMeasurementFactorId = ref("");
const fitActionFactorId = ref("");
const activeMeasurementStage = ref<"measurement" | "capability" | "distribution" | "monteCarlo">("measurement");
const editingFactorSetup = ref(false);
const reportRetryAvailable = ref(false);
const workbookInput = ref<HTMLInputElement>();
const pendingWorkbookFile = ref<File>();
const importingWorkbookFileName = ref("");
const restartConfirmationVisible = ref(false);
const restartConfirmationMode = ref<"replaceWorkbook" | "openPicker">();
const restartCancelButton = ref<globalThis.HTMLButtonElement>();
const restartContinueButton = ref<globalThis.HTMLButtonElement>();
let restartDialogOpener: globalThis.HTMLElement | undefined;
let restartConfirmationPending = false;
let workbookReplacementAuthorized = false;
let reportRequestToken = 0;

interface SessionEngineeringEvidence {
  readonly sessionId: string;
  readonly workbookIdentity: EngineeringEvidenceWorkbookIdentity;
  readonly evidence: AssumptionResultsEngineeringEvidence;
}

const cachedEngineeringEvidence = shallowRef<Readonly<SessionEngineeringEvidence> | undefined>();

function generateAssumptionResultsPdf(request: AssumptionResultsPdfRequest): Promise<globalThis.Blob> {
  return client.generateAssumptionResultsPdf(request);
}

function workbookIdentityForSession(session: { readonly workbook: { readonly workbookContentHash: string; readonly fileName: string }; readonly selectedWorksheetNames: readonly string[] }): EngineeringEvidenceWorkbookIdentity {
  return {
    workbookContentHash: session.workbook.workbookContentHash,
    workbookFileName: session.workbook.fileName,
    worksheetName: session.selectedWorksheetNames[0] ?? "",
  };
}

function sameWorkbookIdentity(left: EngineeringEvidenceWorkbookIdentity, right: EngineeringEvidenceWorkbookIdentity): boolean {
  return left.workbookContentHash === right.workbookContentHash
    && left.workbookFileName === right.workbookFileName
    && left.worksheetName === right.worksheetName;
}

function clearCachedEngineeringEvidence(): void {
  cachedEngineeringEvidence.value = undefined;
}

function onEngineeringEvidenceChange(envelope: EngineeringEvidenceEnvelope | undefined): void {
  const session = store.session.value;
  if (!session || envelope === undefined) {
    clearCachedEngineeringEvidence();
    return;
  }
  const currentIdentity = workbookIdentityForSession(session);
  if (envelope.sessionId !== session.sessionId) return;
  if (!sameWorkbookIdentity(envelope.workbookIdentity, currentIdentity)) return;
  if (envelope.evidence === undefined) {
    clearCachedEngineeringEvidence();
    return;
  }
  cachedEngineeringEvidence.value = markRaw(snapshotPlainDto({
    sessionId: envelope.sessionId,
    workbookIdentity: envelope.workbookIdentity,
    evidence: envelope.evidence,
  }));
}

const currentEngineeringEvidence = computed<AssumptionResultsEngineeringEvidence | undefined>(() => {
  const session = store.session.value;
  const cached = cachedEngineeringEvidence.value;
  if (!session || !cached) return undefined;
  if (cached.sessionId !== session.sessionId) return undefined;
  if (!sameWorkbookIdentity(cached.workbookIdentity, workbookIdentityForSession(session))) return undefined;
  return cached.evidence;
});

watch(() => {
  const session = store.session.value;
  if (!session) return "";
  const worksheetName = session.selectedWorksheetNames[0] ?? "";
  return `${session.sessionId}|${session.workbook.workbookContentHash}|${session.workbook.fileName}|${worksheetName}`;
}, (nextKey, previousKey) => {
  if (previousKey !== undefined && previousKey !== nextKey) clearCachedEngineeringEvidence();
});

const workbookImportBusy = computed(() => store.busyAction.value === "importWorkbook");
const workbookReplacementBusy = computed(() => workbookImportBusy.value && pendingWorkbookFile.value !== undefined);
const displayedWorkbookFileName = computed(() => (
  pendingWorkbookFile.value?.name
  || importingWorkbookFileName.value
  || store.session.value?.workbook.fileName
  || "No file chosen"
));

const simulationReady = computed(() => {
  if (workbookReplacementBusy.value) return false;
  const session = store.session.value;
  return session?.status === "phase_1_ready" && session.factors.every((factor) => (
    factor.sourceMode === "BASELINE_ASSUMPTION"
    || (factor.sourceMode === "MEASURED" && factor.distributionApproval !== undefined)
  ));
});

const workflowSteps = [
  { id: 1, label: "Select worksheet" },
  { id: 2, label: "Measurement Data Import & Analysis" },
  { id: 3, label: "Monte Carlo Calculation & Report" },
] as const;

const currentPhaseStep = computed(() => {
  if (workbookReplacementBusy.value) return 1;
  if (activeMeasurementStage.value === "monteCarlo") return 3;
  const status = store.session.value?.status;
  if (!status || status === "worksheet_selection") return 1;
  if (status === "factor_setup" || status === "measurement_entry" || status === "phase_1_ready") return 2;
  return 1;
});

function workflowStepState(stepId: number): "current" | "complete" | "pending" | "locked" {
  if (workbookReplacementBusy.value && stepId > 1) return "locked";
  if (stepId === 3 && !simulationReady.value) return "locked";
  if (stepId === 2 && (!store.session.value || store.session.value.status === "worksheet_selection")) return "locked";
  if (stepId < currentPhaseStep.value) return "complete";
  if (stepId === currentPhaseStep.value) return "current";
  return "pending";
}

function workflowStepStatusText(stepId: number, state: "current" | "complete" | "pending" | "locked"): string {
  if (state === "locked") return "Locked";
  if (state === "complete" && stepId === 1) return "Change workbook or worksheet";
  if (state === "complete") return "Complete";
  if (state === "pending") return stepId === 3 ? "Available when analysis is ready" : "Available";
  if (stepId === 2) return "Import · Capability · Fit";
  if (stepId === 3) return "Simulation · Automatic report";
  return "Current";
}

const statusText = computed(() => {
  if (workbookReplacementBusy.value) return "Importing workbook";
  if (!store.session.value) return "No workbook imported";
  return store.session.value.status;
});

function asFocusableElement(candidate: unknown): globalThis.HTMLElement | undefined {
  return candidate instanceof globalThis.HTMLElement ? candidate : undefined;
}

function captureRestartDialogOpener(fallback: unknown): void {
  const activeElement = asFocusableElement(globalThis.document.activeElement);
  restartDialogOpener = activeElement && activeElement !== globalThis.document.body
    ? activeElement
    : asFocusableElement(fallback);
}

async function swallowHandledError(operation: () => Promise<void>): Promise<void> {
  fitActionFactorId.value = "";
  try {
    await operation();
  } catch {
    // Store already captures and exposes a controlled UI error.
  }
}

async function importWorkbookFile(file: File): Promise<void> {
  fitActionFactorId.value = "";
  importingWorkbookFileName.value = file.name;
  try {
    await store.importWorkbook(file);
    reportRequestToken += 1;
    activeMeasurementFactorId.value = "";
    activeMeasurementStage.value = "measurement";
    editingFactorSetup.value = false;
  } catch {
    // Store already captures and exposes a controlled UI error.
  } finally {
    importingWorkbookFileName.value = "";
    if (workbookInput.value) workbookInput.value.value = "";
  }
}

async function onImportFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (workbookReplacementAuthorized) {
    workbookReplacementAuthorized = false;
    await importWorkbookFile(file);
    return;
  }
  if (store.session.value) {
    captureRestartDialogOpener(event.target);
    pendingWorkbookFile.value = file;
    restartConfirmationMode.value = "replaceWorkbook";
    restartConfirmationVisible.value = true;
    void nextTick(() => restartContinueButton.value?.focus());
    return;
  }
  await importWorkbookFile(file);
}

function onWorkbookPickerCancel(): void {
  workbookReplacementAuthorized = false;
}

function restartFromWorksheetSelection(event: Event): void {
  if (store.isBusy.value) return;
  captureRestartDialogOpener(event.currentTarget);
  restartConfirmationMode.value = "openPicker";
  restartConfirmationVisible.value = true;
  void nextTick(() => restartContinueButton.value?.focus());
}

function cancelWorksheetRestart(): void {
  const opener = restartDialogOpener;
  restartConfirmationVisible.value = false;
  restartConfirmationMode.value = undefined;
  pendingWorkbookFile.value = undefined;
  restartDialogOpener = undefined;
  if (workbookInput.value) workbookInput.value.value = "";
  void nextTick(() => {
    if (opener?.isConnected) opener.focus();
  });
}

function trapRestartDialogFocus(event: { readonly shiftKey: boolean }): void {
  const cancelButton = restartCancelButton.value;
  const continueButton = restartContinueButton.value;
  if (!cancelButton || !continueButton) return;
  if (event.shiftKey) {
    (globalThis.document.activeElement === cancelButton ? continueButton : cancelButton).focus();
    return;
  }
  (globalThis.document.activeElement === continueButton ? cancelButton : continueButton).focus();
}

async function confirmWorksheetRestart(): Promise<void> {
  if (store.isBusy.value || restartConfirmationPending) return;
  const confirmationMode = restartConfirmationMode.value;
  if (!confirmationMode) return;
  const pendingFile = pendingWorkbookFile.value;
  restartConfirmationPending = true;
  restartConfirmationVisible.value = false;
  restartConfirmationMode.value = undefined;
  restartDialogOpener = undefined;
  if (confirmationMode === "replaceWorkbook" && pendingFile) {
    try {
      await importWorkbookFile(pendingFile);
    } finally {
      if (!restartConfirmationVisible.value) pendingWorkbookFile.value = undefined;
      restartConfirmationPending = false;
      await nextTick();
      workbookInput.value?.focus();
    }
    return;
  }
  pendingWorkbookFile.value = undefined;
  const input = workbookInput.value;
  try {
    if (!input) return;
    input.value = "";
    workbookReplacementAuthorized = true;
    input.click();
  } finally {
    restartConfirmationPending = false;
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
  fitActionFactorId.value = "";
  try {
    await store.confirmFactors(confirmations, systemSpecification);
    editingFactorSetup.value = false;
  } catch {
    editingFactorSetup.value = true;
  }
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
        <h1>Closed-Loop TA Intelligence</h1>
        <p class="subtle">From Measured Data to Engineer Decisions.</p>
      </div>
      <div class="header-meta">
        <span class="status-chip chip-pending">{{ statusText }}</span>
      </div>
    </header>

    <div class="layout-grid">
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
              v-if="step.id === 1 && workflowStepState(step.id) === 'complete'"
              type="button"
              class="step-label step-link"
              data-workflow-restart
              :disabled="store.isBusy.value"
              @click="restartFromWorksheetSelection"
            >
              {{ step.label }}
            </button>
            <button
              v-else-if="step.id === 3 && simulationReady"
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
        <div v-if="store.session.value && !workbookReplacementBusy" class="workflow-metadata">
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
        <section
          v-show="workbookImportBusy || !store.session.value || store.session.value.status === 'worksheet_selection'"
          class="workbench-panel"
          :class="{ 'workbook-import-busy': workbookImportBusy }"
          data-workbook-import
          :aria-busy="workbookImportBusy ? 'true' : 'false'"
        >
          <h2>Import Workbook</h2>
          <label for="workbook-file">Workbook file</label>
          <div class="workbook-file-control">
            <input
              id="workbook-file"
              ref="workbookInput"
              class="sr-only"
              type="file"
              accept=".xlsx"
              :disabled="store.isBusy.value"
              @change="onImportFile"
              @cancel="onWorkbookPickerCancel"
            >
            <label
              class="workbook-file-button"
              for="workbook-file"
              :aria-disabled="store.isBusy.value ? 'true' : undefined"
            >Choose File</label>
            <span
              class="workbook-file-name"
              data-workbook-file-name
              :title="displayedWorkbookFileName"
            >{{ displayedWorkbookFileName }}</span>
          </div>
          <div
            v-if="workbookImportBusy"
            class="workbook-import-feedback"
            data-workbook-import-status
          >
            <p><LoaderCircle class="workbook-import-spinner" :size="16" aria-hidden="true" /> Reading and parsing workbook…</p>
            <div
              class="workbook-import-progress"
              data-workbook-import-progress
              role="progressbar"
              aria-label="Workbook import in progress"
            ><span /></div>
            <p class="subtle">Large workbooks may take a moment.</p>
          </div>
          <p class="subtle">Workbook bytes are uploaded only for local session parsing.</p>
        </section>

        <p v-if="store.error.value" class="error-banner" role="status" aria-live="polite">
          {{ store.error.value.summary }}
        </p>

        <template v-if="store.session.value && !workbookReplacementBusy">
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
          @engineering-evidence-change="onEngineeringEvidenceChange"
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

        <TAResultsInterpretation
          v-if="!editingFactorSetup && !activeMeasurementFactorId && activeMeasurementStage !== 'monteCarlo' && (store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready')"
          :session="store.session.value"
          :generate-pdf="generateAssumptionResultsPdf"
          v-bind="currentEngineeringEvidence === undefined ? {} : { engineeringEvidence: currentEngineeringEvidence }"
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
        </template>
      </section>
    </div>
    <div
      v-if="restartConfirmationVisible"
      class="confirmation-backdrop"
      @click.self="cancelWorksheetRestart"
      @keydown.esc.prevent="cancelWorksheetRestart"
      @keydown.tab.prevent="trapRestartDialogFocus"
    >
      <section
        class="confirmation-dialog"
        data-workflow-restart-confirmation
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="workflow-restart-title"
        aria-describedby="workflow-restart-description"
      >
        <h2 id="workflow-restart-title">
          {{ restartConfirmationMode === "replaceWorkbook" ? "Replace current workbook?" : "Open another worksheet?" }}
        </h2>
        <p id="workflow-restart-description">
          {{ restartConfirmationMode === "replaceWorkbook"
            ? "Continuing will discard the current workbook, worksheet selection, and analysis results."
            : "Opening another workbook or worksheet will discard the current worksheet data and analysis results." }}
        </p>
        <div class="confirmation-dialog-actions">
          <button ref="restartCancelButton" type="button" class="confirmation-cancel" data-workflow-restart-cancel :disabled="store.isBusy.value" @click="cancelWorksheetRestart">Cancel</button>
          <button ref="restartContinueButton" type="button" class="action-button" data-workflow-restart-continue :disabled="store.isBusy.value" @click="confirmWorksheetRestart">Continue</button>
        </div>
      </section>
    </div>
    <Teleport to="body">
      <p
        v-if="workbookImportBusy"
        class="sr-only"
        data-workbook-import-announcement
        role="status"
        aria-live="polite"
      >
        Reading and parsing workbook… Large workbooks may take a moment.
      </p>
    </Teleport>
  </main>
</template>
