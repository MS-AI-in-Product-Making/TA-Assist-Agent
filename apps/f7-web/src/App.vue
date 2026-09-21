<script setup lang="ts">
import { ChartNoAxesCombined, Dices, FileSpreadsheet, Globe2, LoaderCircle, Play, TableProperties } from "lucide-vue-next";
import { computed, markRaw, nextTick, ref, shallowRef, watch, type ComponentPublicInstance } from "vue";
import { createF7Client, type AssumptionResultsPdfRequest, type F7Client, type F7MeasurementStructure, type F7MsaStatus, type F7RationalSubgroupConfig, type F7SetupDistribution, type F7SourceMode, type F7SystemSpecificationInput } from "./api/f7-client";
import WorksheetConfirmation from "./components/WorksheetConfirmation.vue";
import FactorInputTable from "./components/FactorInputTable.vue";
import MeasurementImportPanel from "./components/MeasurementImportPanel.vue";
import MeasurementPastePanel from "./components/MeasurementPastePanel.vue";
import MonteCarloPanel from "./components/MonteCarloPanel.vue";
import ReportPanel from "./components/ReportPanel.vue";
import FactorDistributionAppendix from "./components/FactorDistributionAppendix.vue";
import TAResultsInterpretation from "./components/TAResultsInterpretation.vue";
import {
  type AssumptionResultsEngineeringEvidence,
  type DimensionChainVisual,
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
const measurementEntryMode = ref<"import" | "individual">("import");
const measurementImportOpenRequest = ref(0);
const measurementImportSuccessMessage = ref("");
const blockedMeasurementFactors = ref<readonly { readonly factorId: string; readonly message: string }[]>([]);
const automaticAnalysisProgress = ref<{
  readonly factorIds: readonly string[];
  readonly activeFactorId: string;
  readonly completedCount: number;
}>();
let measurementTemplateDownloadRequestToken = 0;
const reportRetryAvailable = ref(false);
const reportPdfBusy = ref(false);
const reportPdfError = ref("");
const includeFactorDistributionAppendix = ref(false);
const workbookInput = ref<HTMLInputElement>();
const measurementImportTab = ref<globalThis.HTMLButtonElement>();
const measurementIndividualTab = ref<globalThis.HTMLButtonElement>();

function setMeasurementImportTab(element: globalThis.Element | ComponentPublicInstance | null): void {
  measurementImportTab.value = element instanceof globalThis.HTMLButtonElement ? element : undefined;
}

function setMeasurementIndividualTab(element: globalThis.Element | ComponentPublicInstance | null): void {
  measurementIndividualTab.value = element instanceof globalThis.HTMLButtonElement ? element : undefined;
}
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
let reportPdfRequestToken = 0;

interface SessionEngineeringEvidence {
  readonly sessionId: string;
  readonly workbookIdentity: EngineeringEvidenceWorkbookIdentity;
  readonly evidence: AssumptionResultsEngineeringEvidence;
}

const cachedEngineeringEvidence = shallowRef<Readonly<SessionEngineeringEvidence> | undefined>();
const factorInputTable = ref<{
  captureDimensionChainVisual: () => DimensionChainVisual | Promise<DimensionChainVisual>;
  scrollSourceModeIntoView: () => void;
}>();
const cachedDimensionChainVisual = shallowRef<DimensionChainVisual>();

async function captureDimensionChainVisual(): Promise<DimensionChainVisual> {
  return await factorInputTable.value?.captureDimensionChainVisual()
    ?? cachedDimensionChainVisual.value
    ?? { status: "empty" };
}

async function generateAssumptionResultsPdf(request: Omit<AssumptionResultsPdfRequest, "dimensionChainVisual">): Promise<globalThis.Blob> {
  return await client.generateAssumptionResultsPdf({
    ...request,
    dimensionChainVisual: await captureDimensionChainVisual(),
  });
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
  cachedDimensionChainVisual.value = undefined;
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

function reportPdfFileName(workbookName: string, worksheetName: string): string {
  const workbookBase = workbookName.replace(/\.[^.]+$/, "");
  const safePart = (value: string): string => value
    .normalize("NFKC")
    .split("")
    .map((character) => character.charCodeAt(0) < 32 ? "-" : character)
    .join("")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/[\s._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "report";
  return `${safePart(workbookBase)}-${safePart(worksheetName)}-f7-monte-carlo-report.pdf`;
}

async function downloadReportPdf(): Promise<void> {
  const session = store.session.value;
  if (!session?.monteCarloResult || store.isBusy.value || reportPdfBusy.value) return;
  const requestToken = ++reportPdfRequestToken;
  const sessionId = session.sessionId;
  reportPdfBusy.value = true;
  reportPdfError.value = "";
  try {
    if (!store.report.value) await store.generateReport();
    const report = store.report.value;
    if (requestToken !== reportPdfRequestToken || store.session.value?.sessionId !== sessionId) return;
    if (!report || report.sessionId !== sessionId) throw new Error("The governed report is unavailable.");
    const pdf = await client.generateReportPdf({
      sessionId,
      report,
      dimensionChainVisual: await captureDimensionChainVisual(),
      includeFactorDistributionAppendix: includeFactorDistributionAppendix.value,
    });
    if (requestToken !== reportPdfRequestToken || store.session.value?.sessionId !== sessionId) return;
    const objectUrl = globalThis.URL.createObjectURL(pdf);
    const anchor = globalThis.document.createElement("a");
    try {
      anchor.href = objectUrl;
      anchor.download = reportPdfFileName(report.workbook.fileName, report.workbook.worksheetName);
      globalThis.document.body.append(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      globalThis.URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    if (requestToken !== reportPdfRequestToken) return;
    const summary = error && typeof error === "object" && "summary" in error && typeof error.summary === "string"
      ? error.summary
      : "Unable to generate the PDF report.";
    reportPdfError.value = summary;
  } finally {
    if (requestToken === reportPdfRequestToken) reportPdfBusy.value = false;
  }
}

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
  return session?.status === "phase_1_ready"
    && session.systemSpecification?.status === "available"
    && session.factors.every((factor) => (
    factor.sourceMode === "BASELINE_ASSUMPTION"
    || (factor.sourceMode === "MEASURED" && factor.distributionApproval !== undefined)
  ));
});

const pendingMeasuredFitCount = computed(() => store.session.value?.factors.filter((factor) => (
  factor.sourceMode === "MEASURED" && factor.distributionApproval === undefined
)).length ?? 0);

const measuredDatasetPresent = computed(() => store.session.value?.factors.some((factor) => factor.measurementPasteResult?.dataset !== undefined) ?? false);

const measurementImportPanelVisible = computed(() => {
  const session = store.session.value;
  if (!session) return false;
  if (editingFactorSetup.value || activeMeasurementFactorId.value) return false;
  if (activeMeasurementStage.value !== "measurement" && activeMeasurementStage.value !== "capability" && activeMeasurementStage.value !== "distribution") return false;
  return session.status === "measurement_entry" || session.status === "phase_1_ready";
});

const measurementImportAvailable = computed(() => measurementImportPanelVisible.value);
const activeMeasurementEntryMode = computed<"import" | "individual">(() => (
  measurementEntryMode.value === "import" && !measurementImportAvailable.value
    ? "individual"
    : measurementEntryMode.value
));

watch(() => store.session.value?.sessionId ?? "", (nextSessionId, previousSessionId) => {
  if (!nextSessionId || nextSessionId === previousSessionId) return;
  if (previousSessionId) blockedMeasurementFactors.value = [];
  measurementEntryMode.value = measuredDatasetPresent.value ? "individual" : "import";
}, { immediate: true });

const workflowSteps = [
  { id: 1, label: "Select worksheet", icon: TableProperties },
  { id: 2, label: "Measurement Data Import & Analysis", icon: ChartNoAxesCombined },
  { id: 3, label: "Monte Carlo Calculation & Report", icon: Dices },
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
  if (state === "locked") {
    if (stepId === 3 && store.session.value?.status !== "worksheet_selection" && store.session.value?.systemSpecification?.status === "unavailable") {
      return "System specification evidence is unavailable";
    }
    return stepId === 2
      ? "Complete worksheet selection to continue"
      : "Complete measurement analysis to continue";
  }
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
  measurementTemplateDownloadRequestToken += 1;
  reportPdfRequestToken += 1;
  reportPdfBusy.value = false;
  reportPdfError.value = "";
  includeFactorDistributionAppendix.value = false;
  importingWorkbookFileName.value = file.name;
  try {
    await store.importWorkbook(file);
    measurementImportSuccessMessage.value = "";
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
  readonly partNumber: string | null;
  readonly dimId: string | null;
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
  reportPdfRequestToken += 1;
  reportPdfBusy.value = false;
  reportPdfError.value = "";
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

function onMeasurementEntryModeChange(mode: "import" | "individual"): void {
  if (activeMeasurementStage.value === "monteCarlo") closeMonteCarlo();
  if (mode !== measurementEntryMode.value) {
    store.cancelMeasurementImport();
    measurementImportSuccessMessage.value = "";
    measurementTemplateDownloadRequestToken += 1;
    measurementEntryMode.value = mode;
  }
  if (mode === "import") measurementImportOpenRequest.value += 1;
  if (mode === "individual") {
    void nextTick(() => factorInputTable.value?.scrollSourceModeIntoView());
  }
}

function onMeasurementEntryModeKeydown(event: globalThis.KeyboardEvent): void {
  if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "End") {
    event.preventDefault();
    onMeasurementEntryModeChange("individual");
    void nextTick(() => measurementIndividualTab.value?.focus());
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home") {
    event.preventDefault();
    if (!measurementImportAvailable.value) {
      onMeasurementEntryModeChange("individual");
      void nextTick(() => measurementIndividualTab.value?.focus());
      return;
    }
    onMeasurementEntryModeChange("import");
    void nextTick(() => measurementImportTab.value?.focus());
  }
}

function selectWorkbook(): void {
  if (!store.isBusy.value) workbookInput.value?.click();
}

async function onDownloadMeasurementTemplate(): Promise<void> {
  const requestToken = ++measurementTemplateDownloadRequestToken;
  await swallowHandledError(async () => {
    const download = await store.downloadMeasurementTemplate().catch((error: unknown) => {
      if (requestToken !== measurementTemplateDownloadRequestToken) store.clearError();
      throw error;
    });
    if (requestToken !== measurementTemplateDownloadRequestToken) return;
    const blob = new globalThis.Blob([Uint8Array.from(download.bytes).buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = globalThis.document.createElement("a");
      anchor.href = url;
      anchor.download = download.fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}

function onCloseMeasurementImport(): void {
  store.cancelMeasurementImport();
  measurementImportSuccessMessage.value = "";
  measurementTemplateDownloadRequestToken += 1;
}

async function onPreviewMeasurementImport(file: File): Promise<void> {
  measurementImportSuccessMessage.value = "";
  await swallowHandledError(async () => {
    await store.previewMeasurementImport(file);
    const preview = store.measurementImportPreview.value;
    if (!preview) return;
    const blockedFactors = preview.factors.flatMap((factor) => factor.status === "blocked"
      ? [{
          factorId: factor.factorId,
          message: factor.diagnostics[0]?.displayMessage ?? "Measurement validation is blocked.",
        }]
      : []);
    if (blockedFactors.length > 0) {
      blockedMeasurementFactors.value = blockedFactors;
      return;
    }
    const previewFactorIds = new Set(preview.factors.map((factor) => factor.factorId));
    blockedMeasurementFactors.value = blockedMeasurementFactors.value.filter((factor) => !previewFactorIds.has(factor.factorId));
  });
}

async function onCommitMeasurementImport(): Promise<void> {
  const replacementCount = store.measurementImportPreview.value?.replacementCount ?? 0;
  const factorCount = store.measurementImportPreview.value?.factorCount ?? 0;
  const previewFactorIds = new Set(store.measurementImportPreview.value?.factors.map((factor) => factor.factorId) ?? []);
  await swallowHandledError(async () => {
    await store.commitMeasurementImport();
    blockedMeasurementFactors.value = blockedMeasurementFactors.value.filter((factor) => !previewFactorIds.has(factor.factorId));
    const label = factorCount === 1 ? "dataset" : "datasets";
    measurementImportSuccessMessage.value = `Ready. Imported ${factorCount} measured ${label} with ${replacementCount} replacement${replacementCount === 1 ? "" : "s"}.`;
    const factorIds = store.session.value?.factors.flatMap((factor) => (
      factor.sourceMode === "MEASURED"
      && factor.measurementPasteResult?.status === "ready"
      && factor.distributionApproval === undefined
      && factor.evidence
        ? [factor.evidence.factorId]
        : []
    )) ?? [];
    try {
      for (const [index, factorId] of factorIds.entries()) {
        automaticAnalysisProgress.value = {
          factorIds,
          activeFactorId: factorId,
          completedCount: index,
        };
        await store.fitDistribution(factorId);
      }
    } finally {
      automaticAnalysisProgress.value = undefined;
    }
    await nextTick();
    measurementImportTab.value?.focus();
  });
}

function onCancelMeasurementImport(): void {
  store.cancelMeasurementImport();
  measurementImportSuccessMessage.value = "";
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
    blockedMeasurementFactors.value = blockedMeasurementFactors.value.filter((factor) => factor.factorId !== payload.factorId);
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
  cachedDimensionChainVisual.value = undefined;
  const dimensionChainVisual = factorInputTable.value?.captureDimensionChainVisual() ?? { status: "empty" };
  try {
    if (dimensionChainVisual instanceof Promise) {
      cachedDimensionChainVisual.value = await dimensionChainVisual;
    } else {
      cachedDimensionChainVisual.value = dimensionChainVisual;
    }
  } catch {
    cachedDimensionChainVisual.value = undefined;
    return;
  }
  activeMeasurementFactorId.value = "";
  activeMeasurementStage.value = "monteCarlo";
  const session = store.session.value;
  if (session?.monteCarloResult) {
    await openReport();
    return;
  }
  const specification = session?.systemSpecification;
  if (specification?.status !== "available") return;
  await onRunMonteCarlo({
    lowerSpecLimit: specification.lowerSpecLimit.actualValue,
    upperSpecLimit: specification.upperSpecLimit.actualValue,
    targetSigmaLevel: specification.targetSigmaLevel.actualValue,
    iterations: 1_000_000,
    runSeed: BigInt(12_345).toString(16).padStart(64, "0"),
    correlationMode: "INDEPENDENT",
  });
}

async function onRunMonteCarlo(request: {
  lowerSpecLimit: number;
  upperSpecLimit: number;
  targetSigmaLevel: number;
  iterations: 10_000 | 100_000 | 1_000_000;
  runSeed: string;
  correlationMode: "INDEPENDENT";
}): Promise<void> {
  reportPdfRequestToken += 1;
  reportPdfBusy.value = false;
  reportPdfError.value = "";
  let completed = false;
  reportRetryAvailable.value = false;
  await swallowHandledError(async () => {
    await store.runMonteCarlo(request);
    completed = true;
  });
  if (completed) await openReport();
}

function closeMonteCarlo(): void {
  reportPdfRequestToken += 1;
  reportPdfBusy.value = false;
  reportPdfError.value = "";
  activeMeasurementStage.value = "measurement";
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
      <nav class="workflow-rail" aria-label="Analysis workflow">
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
            <component
              :is="step.icon"
              class="workflow-step-icon"
              :size="24"
              :stroke-width="2"
              aria-hidden="true"
            />
            <span class="workflow-step-state">{{ workflowStepState(step.id).toUpperCase() }}</span>
            <h3 class="step-label workflow-step-heading">{{ step.label }}</h3>
            <span class="step-status">{{ workflowStepStatusText(step.id, workflowStepState(step.id)) }}</span>
            <div
              v-if="step.id === 1"
              class="workflow-step-actions"
            >
              <button
                type="button"
                class="workflow-step-action"
                :data-workflow-restart="workflowStepState(step.id) === 'complete' ? '' : undefined"
                :data-workflow-select-worksheet="workflowStepState(step.id) !== 'complete' ? '' : undefined"
                :disabled="store.isBusy.value"
                @click="workflowStepState(step.id) === 'complete' ? restartFromWorksheetSelection($event) : selectWorkbook()"
              >
                <FileSpreadsheet
                  :size="15"
                  aria-hidden="true"
                />
                {{ workflowStepState(step.id) === 'complete' ? 'Change selection' : 'Select worksheet' }}
              </button>
            </div>
            <div
              v-else-if="step.id === 2"
              class="workflow-step-actions measurement-entry-tabs"
              role="tablist"
              aria-label="Choose one measurement input mode"
            >
              <button
                id="measurement-entry-import-tab"
                :ref="setMeasurementImportTab"
                type="button"
                role="tab"
                class="measurement-entry-tab"
                :class="activeMeasurementEntryMode === 'import' ? 'is-selected' : ''"
                :aria-selected="activeMeasurementEntryMode === 'import' ? 'true' : 'false'"
                aria-controls="measurement-entry-import-panel"
                :tabindex="activeMeasurementEntryMode === 'import' ? 0 : -1"
                :disabled="store.isBusy.value || !measurementImportAvailable"
                @click="onMeasurementEntryModeChange('import')"
                @keydown="onMeasurementEntryModeKeydown"
              >
                <FileSpreadsheet
                  :size="15"
                  aria-hidden="true"
                />
                Excel Bulk Import
              </button>
              <span
                class="measurement-mode-choice-separator"
                data-measurement-mode-choice-separator
                role="separator"
                aria-label="or"
              >OR</span>
              <button
                id="measurement-entry-individual-tab"
                :ref="setMeasurementIndividualTab"
                type="button"
                role="tab"
                class="measurement-entry-tab"
                :class="activeMeasurementEntryMode === 'individual' ? 'is-selected' : ''"
                :aria-selected="activeMeasurementEntryMode === 'individual' ? 'true' : 'false'"
                aria-controls="measurement-entry-individual-panel"
                :tabindex="activeMeasurementEntryMode === 'individual' ? 0 : -1"
                :disabled="store.isBusy.value || workflowStepState(step.id) === 'locked'"
                @click="onMeasurementEntryModeChange('individual')"
                @keydown="onMeasurementEntryModeKeydown"
              >
                <Globe2
                  :size="15"
                  aria-hidden="true"
                />
                Individual Factor Entry
              </button>
            </div>
            <div
              v-else
              class="workflow-step-actions"
            >
              <button
                type="button"
                class="workflow-step-action"
                data-open-monte-carlo
                data-workflow-open-monte-carlo
                :disabled="store.isBusy.value || !simulationReady"
                @click="openMonteCarlo"
              >
                <Play
                  :size="15"
                  aria-hidden="true"
                />
                {{ store.session.value?.monteCarloResult ? 'View results' : 'Run Monte Carlo' }}
              </button>
            </div>
            <span
              v-if="step.id < workflowSteps.length"
              class="workflow-step-connector"
              data-workflow-step-connector
              aria-hidden="true"
            >
              <span></span>
              <span></span>
              <span></span>
            </span>
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
      </nav>
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

        <MeasurementImportPanel
          v-if="measurementImportPanelVisible"
          :session="store.session.value"
          :preview="store.measurementImportPreview.value"
          :busy="store.isBusy.value"
          :action="store.busyAction.value === 'downloadMeasurementTemplate' || store.busyAction.value === 'previewMeasurementImport' || store.busyAction.value === 'commitMeasurementImport' ? store.busyAction.value : null"
          :mode="measurementEntryMode"
          :open-request="measurementImportOpenRequest"
          :success-message="measurementImportSuccessMessage || null"
          @download="onDownloadMeasurementTemplate"
          @upload="onPreviewMeasurementImport"
          @confirm="onCommitMeasurementImport"
          @cancel="onCancelMeasurementImport"
          @close-import="onCloseMeasurementImport"
        />

        <div
          v-if="(activeMeasurementStage === 'measurement' || activeMeasurementStage === 'capability' || activeMeasurementStage === 'distribution') && (store.session.value.status === 'factor_setup' || store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready')"
          id="measurement-entry-individual-panel"
          class="measurement-entry-individual-panel"
          role="tabpanel"
          aria-labelledby="measurement-entry-individual-tab"
        >
          <FactorInputTable
            ref="factorInputTable"
            v-if="!activeMeasurementFactorId"
            :session="store.session.value"
            :busy="store.isBusy.value"
            :editing-setup="editingFactorSetup"
            :measurement-entry-mode="measurementEntryMode"
            :blocked-measurement-factors="blockedMeasurementFactors"
            :automatic-analysis-progress="automaticAnalysisProgress"
            @confirm-factors="onConfirmFactors"
            @edit-setup="onEditFactorSetup"
            @set-mode="onSetMode"
            @open-measurement="onOpenMeasurement"
            @engineering-evidence-change="onEngineeringEvidenceChange"
          />

          <MeasurementPastePanel
            v-if="!editingFactorSetup && activeMeasurementFactorId && (store.session.value.status === 'measurement_entry' || store.session.value.status === 'phase_1_ready')"
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
        </div>

        <MonteCarloPanel
          v-if="activeMeasurementStage === 'monteCarlo' && simulationReady"
          :session="store.session.value"
          :busy="store.isBusy.value"
          :running="store.busyAction.value === 'runMonteCarlo'"
          :report-pdf-busy="reportPdfBusy"
          :report-pdf-error="reportPdfError"
          @download-report-pdf="downloadReportPdf"
          @close="closeMonteCarlo"
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

        <FactorDistributionAppendix
          v-if="activeMeasurementStage === 'monteCarlo' && store.report.value"
          v-model:include-in-pdf="includeFactorDistributionAppendix"
          :session="store.session.value"
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
              ? "All factor models are governed. Use Workflow Step 3 to run the system simulation and generate the report."
              : `Complete Distribution Fit for each measured factor to automatically select its final Monte Carlo distribution. ${pendingMeasuredFitCount} measured factor${pendingMeasuredFitCount === 1 ? "" : "s"} remain.` }}
          </p>
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
