<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, type DeepReadonly } from "vue";
import type {
  F7MeasurementStructure,
  F7RationalSubgroupConfig,
  F7SessionSnapshot,
  F7UiError,
} from "../api/f7-client";
import { calculateF7Capability } from "../f7-capability";
import { buildMeasurementDiagnostics } from "../measurement-diagnostics";
import { buildCapabilityComparison } from "../capability-comparison";
import {
  buildDistributionFitReferences,
  buildFactorSetupAssumption,
  distributionFitObservedDomain,
} from "../distribution-fit-plot";
import { buildMeasuredDistributionInterpretation } from "../distribution-guidance";
import DistributionFitAnalysis from "./DistributionFitAnalysis.vue";
import SelectedDistributionSummary from "./SelectedDistributionSummary.vue";
import SelectedFactorSetup from "./SelectedFactorSetup.vue";
import {
  buildMeasurementRowMetadata,
  calculateRationalSubgroupStandardDeviation,
  rationalSubgroupConstant,
  type RationalSubgroupEstimator,
} from "../measurement-structure";
import { defaultCpkRule } from '../capability-guidance';
import { buildCapabilityGuidance as builder } from '../capability-guidance';

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly busy: boolean;
  readonly fitLoading: boolean;
  readonly fitError: F7UiError | null;
  readonly factorId: string;
}>();

const emit = defineEmits<{
  paste: [payload: {
    factorId: string;
    structure: F7MeasurementStructure;
    rationalSubgroupConfig?: F7RationalSubgroupConfig;
    sourceReference: string;
    msaStatus: "unknown";
    text: string;
  }, onSaved: (saved: boolean) => void];
  close: [];
  clear: [factorId: string, onCleared: () => void];
  fit: [factorId: string];
  stageChange: [stage: "measurement" | "capability" | "distribution"];
}>();

const form = reactive({
  structure: "UNORDERED_SAMPLE" as F7MeasurementStructure,
  subgroupSize: 5,
  subgroupEstimator: "RANGE_D2" as RationalSubgroupEstimator,
});

const selectedFactor = computed(() => props.session.factors.find((factor) => factor.evidence?.factorId === props.factorId));

function measurementValues(factorId: string): string[] {
  const dataset = props.session.factors
    .find((factor) => factor.evidence?.factorId === factorId)
    ?.measurementPasteResult?.dataset;
  if (!dataset) return [];
  const maximumSourceRow = Math.max(
    0,
    ...dataset.observations.map((observation) => observation.originalRow),
    ...dataset.rejectionSummaries.map((summary) => summary.rowNumber),
  );
  const headerRows = maximumSourceRow > dataset.originalRowCount ? 1 : 0;
  const values = Array<string>(dataset.originalRowCount).fill("");
  for (const observation of dataset.observations) {
    if (observation.disposition !== "included") continue;
    const rowIndex = observation.originalRow - headerRows - 1;
    if (rowIndex >= 0 && rowIndex < values.length) values[rowIndex] = String(observation.value);
  }
  while (values.at(-1) === "") values.pop();
  return values;
}

const VISIBLE_EMPTY_MEASUREMENT_ROWS = 5;

function rowsWithEmptyEntries(values: readonly string[]): string[] {
  return [...values, ...Array<string>(VISIBLE_EMPTY_MEASUREMENT_ROWS).fill("")];
}

const measurementRows = ref(rowsWithEmptyEntries(measurementValues(props.factorId)));
const measurementGrid = ref<globalThis.HTMLElement | null>(null);
const measurementCount = computed(() => measurementRows.value.filter((value) => value.trim().length > 0).length);
const populatedMeasurementRows = computed(() => {
  const lastPopulatedIndex = measurementRows.value.findLastIndex((value) => value.trim().length > 0);
  return measurementRows.value.slice(0, lastPopulatedIndex + 1);
});
const numericMeasurementRows = computed(() => populatedMeasurementRows.value
  .map((value, rowIndex) => ({ value: Number(value.trim()), rowIndex }))
  .filter((entry) => entry.value !== 0 || populatedMeasurementRows.value[entry.rowIndex]?.trim() !== "")
  .filter((entry) => Number.isFinite(entry.value)));
const measurementDiagnostics = computed(() => buildMeasurementDiagnostics(
  numericMeasurementRows.value.map((entry) => entry.value),
  populatedMeasurementRows.value.filter((value) => value.trim() === "").length,
));
const measurementMissingRows = computed(() => new Set(
  populatedMeasurementRows.value
    .map((value, rowIndex) => value.trim() === "" ? rowIndex : undefined)
    .filter((rowIndex): rowIndex is number => rowIndex !== undefined),
));
const measurementOutlierRows = computed(() => new Set(
  measurementDiagnostics.value.outlierIndexes
    .map((index) => numericMeasurementRows.value[index]?.rowIndex)
    .filter((index): index is number => index !== undefined),
));
const subgroupConstant = computed(() => rationalSubgroupConstant(form.subgroupSize, form.subgroupEstimator));
const incompleteSubgroupCount = computed(() => form.structure === "RATIONAL_SUBGROUP"
  ? measurementCount.value % form.subgroupSize
  : 0);
const measurementsNeededForCompleteSubgroup = computed(() => incompleteSubgroupCount.value === 0
  ? 0
  : form.subgroupSize - incompleteSubgroupCount.value);
const automaticSaveEnabled = computed(() => (
  !props.busy
  && measurementCount.value > 0
  && measurementsNeededForCompleteSubgroup.value === 0
));
const activeStage = ref<"measurement" | "capability" | "distribution">("measurement");
const automaticSavePending = ref(false);
const automaticSaveTimer = ref<ReturnType<typeof globalThis.setTimeout>>();
let measurementRevision = 0;
const measurementReady = computed(() => selectedFactor.value?.measurementPasteResult?.status === "ready");
const specificationUnit = computed(() => {
  const unit = selectedFactor.value?.evidence?.unit;
  return unit && unit !== "unspecified" ? unit : "";
});

function formatDiagnostic(value: number | undefined): string {
  return value === undefined ? "-" : value.toLocaleString("en-US", { maximumSignificantDigits: 6, useGrouping: false });
}

const capabilityResult = computed(() => {
  const evidence = selectedFactor.value?.evidence;
  const dataset = selectedFactor.value?.measurementPasteResult?.dataset;
  if (!evidence || !dataset) return undefined;

  const values = dataset.observations
    .filter((observation) => observation.disposition === "included")
    .sort((left, right) => left.originalRow - right.originalRow)
    .map((observation) => observation.value);
  const withinSubgroupStandardDeviation = dataset.structure === "RATIONAL_SUBGROUP" && dataset.rationalSubgroupConfig
    ? calculateRationalSubgroupStandardDeviation(
        values,
        dataset.rationalSubgroupConfig.subgroupSize,
        dataset.rationalSubgroupConfig.estimator,
      )
    : undefined;
  return calculateF7Capability(
    values,
    evidence.lowerSpecLimit,
    evidence.upperSpecLimit,
    withinSubgroupStandardDeviation,
  );
});
const capabilityComparison = computed(() => {
  const evidence = selectedFactor.value?.evidence;
  const capability = capabilityResult.value;
  if (!evidence || capability?.status !== "ready") return undefined;
  return buildCapabilityComparison({
    measured: {
      mean: capability.mean,
      standardDeviation: capability.sampleStandardDeviation,
      cp: capability.cp,
      cpk: capability.cpk,
    },
    setup: {
      signedMean: evidence.calculatedMean,
      standardDeviation: evidence.oneSigma,
    },
    lowerSpecLimit: evidence.lowerSpecLimit,
    upperSpecLimit: evidence.upperSpecLimit,
  });
});
const guidance = computed(() => {
  const comp = capabilityComparison.value;
  if (!comp || !defaultCpkRule) return undefined;
  return builder({
    mean: comp.mean,
    standardDeviation: comp.standardDeviation,
    cp: comp.cp,
    cpk: comp.cpk,
    ruleResult: defaultCpkRule,
  });
});
const distributionFitResult = computed(() => selectedFactor.value?.distributionFitResult);
const distributionFitResultKey = computed(() => JSON.stringify(distributionFitResult.value ?? null));
const factorSetupAssumption = computed(() => {
  const evidence = selectedFactor.value?.evidence;
  return evidence
    ? buildFactorSetupAssumption({
        signedMean: evidence.calculatedMean,
        oneSigma: evidence.oneSigma,
        distribution: evidence.distribution,
        longTermSafetyFactor: evidence.longTermSafetyFactor,
        sigmaLevel: evidence.sigmaLevel,
      })
    : undefined;
});
const distributionPlotReferences = computed(() => {
  const result = distributionFitResult.value;
  const evidence = selectedFactor.value?.evidence;
  return result && evidence
    ? buildDistributionFitReferences(result.candidates, evidence.lowerSpecLimit, evidence.upperSpecLimit)
    : undefined;
});
const distributionPlotDomain = computed(() => distributionFitResult.value
  ? distributionFitObservedDomain(
      distributionFitResult.value.candidates,
      distributionPlotReferences.value,
      factorSetupAssumption.value,
    )
  : undefined);
const selectionDecision = computed(() => distributionFitResult.value?.selectionDecision);
const distributionApproval = computed(() => selectedFactor.value?.distributionApproval);
const measuredDistributionInterpretation = computed(() => {
  const result = distributionFitResult.value;
  const comparison = capabilityComparison.value;
  if (!result || !comparison) return undefined;
  const approval = distributionApproval.value;
  return buildMeasuredDistributionInterpretation({
    fitResult: result as F7SessionSnapshot["factors"][number]["distributionFitResult"] & {},
    ...(approval ? { approval: approval as NonNullable<F7SessionSnapshot["factors"][number]["distributionApproval"]> } : {}),
    setup: {
      mean: comparison.mean.setup,
      standardDeviation: comparison.standardDeviation.setup,
    },
    sample: {
      mean: comparison.mean.measured,
      standardDeviation: comparison.standardDeviation.measured,
    },
  });
});
const expandedPlotFamily = ref<string>();

function showProposedDistributionPlot(): void {
  expandedPlotFamily.value = selectionDecision.value?.proposedFinalFamily;
}

function ensureTrailingEmptyRow(): void {
  while (measurementRows.value.length > VISIBLE_EMPTY_MEASUREMENT_ROWS) {
    const trailingRows = measurementRows.value.slice(-VISIBLE_EMPTY_MEASUREMENT_ROWS - 1);
    if (trailingRows.some((value) => value.trim() !== "")) break;
    measurementRows.value.pop();
  }
  while (
    measurementRows.value.length < VISIBLE_EMPTY_MEASUREMENT_ROWS
    || measurementRows.value.slice(-VISIBLE_EMPTY_MEASUREMENT_ROWS).some((value) => value.trim() !== "")
  ) {
    measurementRows.value.push("");
  }
}

function scheduleAutomaticAnalysis(): void {
  ensureTrailingEmptyRow();
  measurementRevision += 1;
  automaticSavePending.value = measurementCount.value > 0;
  if (automaticSaveTimer.value) globalThis.clearTimeout(automaticSaveTimer.value);
  if (!automaticSaveEnabled.value) return;
  const scheduledRevision = measurementRevision;
  automaticSaveTimer.value = globalThis.setTimeout(() => submitPaste(scheduledRevision), 500);
}

function removeRow(index: number): void {
  measurementRows.value.splice(index, 1);
  scheduleAutomaticAnalysis();
}

async function clearMeasurements(): Promise<void> {
  if (measurementCount.value === 0) return;
  emit("clear", props.factorId, () => {
    measurementRevision += 1;
    if (automaticSaveTimer.value) globalThis.clearTimeout(automaticSaveTimer.value);
    measurementRows.value = rowsWithEmptyEntries([]);
    automaticSavePending.value = false;
    void nextTick(() => {
      measurementGrid.value?.querySelector<HTMLInputElement>("input[data-measurement-row='1']")?.focus();
    });
  });
}

type PasteLikeEvent = { clipboardData?: { getData?: (format: string) => string } | null; preventDefault: () => void };

function pasteRows(index: number, event: PasteLikeEvent): void {
  const rawText = event.clipboardData?.getData?.("text/plain") ?? "";
  const pastedValues = rawText
    ? rawText.split(/\r?\n|\t/).map((value) => value.trim())
    : [];
  while (pastedValues.at(-1) === "") pastedValues.pop();
  if (pastedValues.length === 0) return;
  event.preventDefault();
  measurementRows.value.splice(index, 1, ...pastedValues);
  scheduleAutomaticAnalysis();
}

function submitPaste(scheduledRevision: number): void {
  const values = populatedMeasurementRows.value.map((value) => value.trim());
  if (scheduledRevision !== measurementRevision || !automaticSaveEnabled.value || !selectedFactor.value) return;
  automaticSavePending.value = true;
  const text = form.structure === "ORDERED_INDIVIDUALS"
    ? ["value\tsequence", ...values.map((value, index) => value === "" ? "" : `${value}\t${index + 1}`)].join("\n")
    : form.structure === "RATIONAL_SUBGROUP"
      ? [
          "value\tsubgroup",
          ...values.map((value, index) => value === "" ? "" : `${value}\t${buildMeasurementRowMetadata(index, form.structure, form.subgroupSize).subgroup}`),
        ].join("\n")
      : values.join("\n");
  emit("paste", {
    factorId: props.factorId,
    structure: form.structure,
    ...(form.structure === "RATIONAL_SUBGROUP"
      ? { rationalSubgroupConfig: { subgroupSize: form.subgroupSize, estimator: form.subgroupEstimator } }
      : {}),
    sourceReference: "local-workbench-entry",
    msaStatus: "unknown",
    text,
  }, (saved) => {
    if (scheduledRevision !== measurementRevision) return;
    automaticSavePending.value = false;
    if (saved) emit("fit", props.factorId);
  });
}

function openDistributionFit(): void {
  if (!measurementReady.value || props.busy) return;
  activeStage.value = "distribution";
  if (distributionFitResult.value) {
    showProposedDistributionPlot();
  } else {
    emit("fit", props.factorId);
  }
}

function formatSigned(value: number, fractionDigits: number): string {
  const magnitude = Math.abs(value).toFixed(fractionDigits);
  if (value > 0) return `+${magnitude}`;
  if (value < 0) return `−${magnitude}`;
  return magnitude;
}

function formatChangePercent(value: number): string {
  return `${formatSigned(value * 100, 1)}%`;
}

function changeAssessmentClass(assessment: "better" | "worse" | "unchanged"): string {
  return `capability-change-${assessment}`;
}


function toggleDistributionPlot(family: string): void {
  expandedPlotFamily.value = expandedPlotFamily.value === family ? undefined : family;
}

function closeMeasurementWorkspace(): void {
  expandedPlotFamily.value = undefined;
  emit("close");
}

function formatSpecificationLimit(value: number | undefined): string {
  if (value === undefined) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 12, useGrouping: false });
}

watch(
  distributionFitResultKey,
  (resultKey, previousResultKey) => {
    if (
      (activeStage.value === "capability" || activeStage.value === "distribution")
      && resultKey !== previousResultKey
    ) {
      showProposedDistributionPlot();
    }
  },
);

watch(
  () => props.factorId,
  (factorId) => {
    measurementRows.value = rowsWithEmptyEntries(measurementValues(factorId));
    const dataset = selectedFactor.value?.measurementPasteResult?.dataset;
    form.structure = dataset?.structure ?? "UNORDERED_SAMPLE";
    form.subgroupSize = dataset?.rationalSubgroupConfig?.subgroupSize ?? 5;
    form.subgroupEstimator = dataset?.rationalSubgroupConfig?.estimator ?? "RANGE_D2";
    activeStage.value = "measurement";
    expandedPlotFamily.value = undefined;
    automaticSavePending.value = false;
    measurementRevision += 1;
    if (automaticSaveTimer.value) globalThis.clearTimeout(automaticSaveTimer.value);
  },
  { immediate: true },
);

watch(activeStage, (stage) => {
  emit("stageChange", stage);
  if (
    stage === "capability"
    && measurementReady.value
    && !props.busy
    && !props.fitLoading
    && !props.fitError
    && !distributionFitResult.value
  ) {
    emit("fit", props.factorId);
  }
});

onBeforeUnmount(() => {
  if (automaticSaveTimer.value) globalThis.clearTimeout(automaticSaveTimer.value);
});
</script>

<template>
  <section
    class="workbench-panel factor-workspace"
    aria-label="Factor measurement workspace"
  >
    <header class="factor-workspace-header">
      <div>
        <p class="workspace-eyebrow">Measured factor workspace</p>
        <h2>{{ selectedFactor?.factorCandidate.factorName }}</h2>
      </div>
      <button
        type="button"
        class="workspace-close-button"
        data-close-measurement
        @click="closeMeasurementWorkspace"
      >
        Back to factor setup
      </button>
    </header>
    <SelectedFactorSetup :session="session" :factor-id="factorId" />
    <ol class="analysis-stage-list" aria-label="Factor analysis stages">
      <li :class="activeStage === 'measurement' ? 'stage-current' : 'stage-complete'">
        <span>1</span>
        <strong>Measurement Data</strong>
        <small>{{ measurementReady ? "Confirmed" : activeStage === "measurement" ? "Current" : "Complete" }}</small>
      </li>
      <li :class="measurementReady ? (activeStage === 'capability' ? 'stage-current' : 'stage-available') : 'stage-locked'">
        <span>2</span>
        <button
          type="button"
          data-stage="capability"
          :disabled="!measurementReady"
          @click="activeStage = 'capability'"
        >Capability Analysis</button>
        <small>{{ measurementReady ? activeStage === "capability" ? "Current" : "Available" : "Locked" }}</small>
      </li>
      <li :class="measurementReady ? (activeStage === 'distribution' ? 'stage-current' : 'stage-available') : 'stage-locked'">
        <span>3</span>
        <button
          type="button"
          data-stage="distribution"
          :disabled="!measurementReady || busy"
          @click="openDistributionFit"
        >Distribution Fit</button>
        <small>{{ measurementReady ? activeStage === "distribution" ? "Current" : "Available" : "Locked" }}</small>
      </li>
    </ol>
    <section class="specification-evidence" aria-label="Excel specification limits">
      <div class="specification-evidence-header">
        <div class="specification-evidence-summary">
          <h4>Factor Specification Limits</h4>
          <dl class="specification-limit-values">
            <div>
              <dt>LSL</dt>
              <dd>{{ formatSpecificationLimit(selectedFactor?.evidence?.lowerSpecLimit) }} {{ specificationUnit }}</dd>
            </div>
            <div>
              <dt>USL</dt>
              <dd>{{ formatSpecificationLimit(selectedFactor?.evidence?.upperSpecLimit) }} {{ specificationUnit }}</dd>
            </div>
          </dl>
        </div>
        <button
          v-if="activeStage === 'capability'"
          type="button"
          class="workspace-close-button"
          data-review-measurements
          @click="activeStage = 'measurement'"
        >
          Review Measurement Data
        </button>
      </div>
    </section>
    <div
      v-if="activeStage !== 'distribution'"
      class="measurement-capability-layout"
      data-measurement-capability-layout
    >
    <div class="measurement-workspace-body measurement-entry-column" data-measurement-entry-column>
      <div class="measurement-section-heading">
        <h3>Measurement Data</h3>
        <div class="measurement-heading-actions">
          <strong>{{ measurementCount }} values</strong>
          <small class="measurement-auto-save-status" data-measurement-auto-save-status>
            {{ automaticSavePending || busy ? "Saving and updating analysis..." : "Changes save automatically" }}
          </small>
          <button
            type="button"
            class="clear-measurements-button"
            data-clear-measurements
            :disabled="busy || measurementCount === 0"
            title="Clear measurement data"
            aria-label="Clear measurement data"
            @click="clearMeasurements"
          >Clear</button>
        </div>
      </div>
      <div class="measurement-structure-control">
        <label>
          Structure
          <select v-model="form.structure" data-measurement-structure @change="scheduleAutomaticAnalysis">
            <option value="UNORDERED_SAMPLE">UNORDERED_SAMPLE</option>
            <option value="ORDERED_INDIVIDUALS">ORDERED_INDIVIDUALS</option>
            <option value="RATIONAL_SUBGROUP">RATIONAL_SUBGROUP</option>
          </select>
        </label>
        <div v-if="form.structure === 'RATIONAL_SUBGROUP'" class="rational-subgroup-controls" data-rational-subgroup-controls>
          <label>
            Observations per subgroup
            <select v-model.number="form.subgroupSize" aria-label="Observations per subgroup" @change="scheduleAutomaticAnalysis">
              <option v-for="size in 24" :key="size + 1" :value="size + 1">{{ size + 1 }}</option>
            </select>
          </label>
          <label>
            Within-subgroup estimator
            <select v-model="form.subgroupEstimator" aria-label="Within-subgroup estimator" @change="scheduleAutomaticAnalysis">
              <option value="RANGE_D2">Average range / d2</option>
              <option value="S_C4">Average standard deviation / c4</option>
            </select>
          </label>
          <output data-subgroup-constant>
            {{ form.subgroupEstimator === "RANGE_D2" ? "d2" : "c4" }} = {{ subgroupConstant }}
          </output>
        </div>
      </div>
      <div ref="measurementGrid" class="measurement-grid-scroll">
        <table class="measurement-grid">
          <thead>
            <tr>
              <th v-if="form.structure === 'RATIONAL_SUBGROUP'">Subgroup</th>
              <th v-if="form.structure === 'RATIONAL_SUBGROUP'">Position</th>
              <th v-else>{{ form.structure === "ORDERED_INDIVIDUALS" ? "Sequence" : "No." }}</th>
              <th>Measured Value</th>
              <th><span class="sr-only">Row actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(value, index) in measurementRows"
              :key="index"
              :class="{
                'subgroup-start-row': form.structure === 'RATIONAL_SUBGROUP' && index > 0 && index % form.subgroupSize === 0,
                'measurement-missing-row': measurementMissingRows.has(index),
                'measurement-outlier-row': measurementOutlierRows.has(index),
              }"
              :data-missing-value="measurementMissingRows.has(index) || undefined"
              :data-outlier-candidate="measurementOutlierRows.has(index) || undefined"
            >
              <td v-if="form.structure === 'RATIONAL_SUBGROUP'" data-subgroup-id>
                {{ buildMeasurementRowMetadata(index, form.structure, form.subgroupSize).subgroup }}
              </td>
              <td v-if="form.structure === 'RATIONAL_SUBGROUP'" data-subgroup-position>
                {{ buildMeasurementRowMetadata(index, form.structure, form.subgroupSize).position }}
              </td>
              <td v-else>{{ index + 1 }}</td>
              <td>
                <input
                  v-model="measurementRows[index]"
                  :data-measurement-row="index + 1"
                  inputmode="decimal"
                  :aria-label="`Measurement value ${index + 1}${measurementMissingRows.has(index) ? ', missing value' : measurementOutlierRows.has(index) ? ', outlier candidate' : ''}`"
                  @input="scheduleAutomaticAnalysis"
                  @paste="pasteRows(index, $event)"
                >
              </td>
              <td>
                <button
                  v-if="measurementRows.length > 1"
                  type="button"
                  class="remove-measurement-button"
                  :aria-label="`Remove measurement row ${index + 1}`"
                  title="Remove row"
                  @click="removeRow(index)"
                >×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="measurementsNeededForCompleteSubgroup > 0" class="measurement-structure-warning" data-incomplete-subgroup-warning>
        Add {{ measurementsNeededForCompleteSubgroup }} more measurement{{ measurementsNeededForCompleteSubgroup === 1 ? "" : "s" }} to complete the final subgroup.
      </p>
    </div>
    <aside class="measurement-workspace-body capability-analysis" data-live-capability-column aria-live="polite">
      <div v-if="distributionFitResult" class="selected-distribution-plot" data-selected-distribution-plot>
        <SelectedDistributionSummary
          :result="distributionFitResult"
          :approval="distributionApproval"
          :fit-loading="fitLoading"
          :fit-error="fitError"
          :plot-domain="distributionPlotDomain"
          :plot-references="distributionPlotReferences"
          :setup-assumption="factorSetupAssumption"
          :show-heading="false"
          selectable-sigma-levels
          display="plot"
        />
      </div>
      <p class="workspace-eyebrow">Measurement data confirmed</p>
      <h3>Capability Analysis</h3>
      <div class="measurement-metrics-board" data-measurement-metrics-board>
        <section class="measurement-metric-group quality-metric-group" data-metric-group="quality">
          <h4>Data Quality</h4>
          <dl class="measurement-diagnostics" data-measurement-diagnostics>
        <div>
          <dt>Sample Size</dt>
          <dd>{{ measurementDiagnostics.sampleSize }}</dd>
          <span :class="['diagnostic-status', measurementDiagnostics.sampleSizeStatus]">
            {{ measurementDiagnostics.sampleSizeStatus === "acceptable" ? "Acceptable (n ≥ 30)" : "Limited (n < 30)" }}
          </span>
        </div>
        <div><dt>Minimum</dt><dd>{{ formatDiagnostic(measurementDiagnostics.minimum) }}</dd></div>
        <div><dt>Maximum</dt><dd>{{ formatDiagnostic(measurementDiagnostics.maximum) }}</dd></div>
        <div><dt>Range</dt><dd>{{ formatDiagnostic(measurementDiagnostics.range) }}</dd></div>
        <div>
          <dt>Missing Values</dt>
          <dd :class="{ 'diagnostic-alert': measurementDiagnostics.missingCount > 0 }">{{ measurementDiagnostics.missingCount }}</dd>
        </div>
        <div>
          <dt>3σ Rule</dt>
          <dd :class="{ 'diagnostic-alert': measurementDiagnostics.threeSigmaOutlierIndexes.length > 0 }">
            {{ measurementDiagnostics.threeSigmaOutlierIndexes.length }} candidate{{ measurementDiagnostics.threeSigmaOutlierIndexes.length === 1 ? "" : "s" }}
          </dd>
          <span>|x − Mean| &gt; 3σ</span>
        </div>
        <div>
          <dt>IQR Method</dt>
          <dd :class="{ 'diagnostic-alert': measurementDiagnostics.iqrOutlierIndexes.length > 0 }">
            {{ measurementDiagnostics.iqrOutlierIndexes.length }} candidate{{ measurementDiagnostics.iqrOutlierIndexes.length === 1 ? "" : "s" }}
          </dd>
          <span>Tukey 1.5 × IQR fences</span>
        </div>
          </dl>
        </section>
        <section class="measurement-metric-group capability-metric-group" data-metric-group="capability">
          <h4>Capability Comparison</h4>
          <dl v-if="capabilityResult?.status === 'ready'" class="capability-metrics">
        <div>
          <dt>Mean</dt>
          <dd v-if="capabilityComparison" class="capability-comparison" data-capability-comparison="mean">
            <div class="capability-comparison-row setup-row" data-comparison-row>
              <span data-comparison-source>Setup</span>
              <strong>|Mean| {{ capabilityComparison.mean.setup.toFixed(4) }}</strong>
            </div>
            <div class="capability-comparison-row sample-row" data-comparison-row>
              <span data-comparison-source>Sample</span>
              <strong>{{ capabilityComparison.mean.measured.toFixed(4) }}</strong>
              <span class="capability-change-badge" data-comparison-change>Change {{ formatSigned(capabilityComparison.mean.delta, 4) }} · {{ formatChangePercent(capabilityComparison.mean.relativeChange) }}</span>
            </div>
          </dd>
        </div>
        <div>
          <dt>{{ selectedFactor?.measurementPasteResult?.dataset?.structure === "RATIONAL_SUBGROUP" ? "Within-subgroup Std Dev" : "Sample Std Dev" }}</dt>
          <dd
            v-if="capabilityComparison"
            :class="['capability-comparison', changeAssessmentClass(capabilityComparison.standardDeviation.assessment)]"
            data-capability-comparison="standard-deviation"
          >
            <div class="capability-comparison-row setup-row" data-comparison-row>
              <span data-comparison-source>Setup</span>
              <strong>1σ {{ capabilityComparison.standardDeviation.setup.toFixed(4) }}</strong>
            </div>
            <div class="capability-comparison-row sample-row" data-comparison-row>
              <span data-comparison-source>Sample</span>
              <strong>{{ capabilityComparison.standardDeviation.measured.toFixed(4) }}</strong>
              <span class="capability-change-badge" data-comparison-change>Change {{ formatSigned(capabilityComparison.standardDeviation.delta, 4) }} · {{ formatChangePercent(capabilityComparison.standardDeviation.relativeChange) }} · {{ capabilityComparison.standardDeviation.ratio.toFixed(2) }}×</span>
            </div>
          </dd>
        </div>
        <div>
          <dt>Cp</dt>
          <dd
            v-if="capabilityComparison"
            :class="['capability-comparison', changeAssessmentClass(capabilityComparison.cp.assessment)]"
            data-capability-comparison="cp"
          >
            <div class="capability-comparison-row setup-row" data-comparison-row>
              <span data-comparison-source>Setup</span>
              <strong>{{ capabilityComparison.cp.setup.toFixed(3) }}</strong>
            </div>
            <div class="capability-comparison-row sample-row" data-comparison-row>
              <span data-comparison-source>Sample</span>
              <strong>{{ capabilityComparison.cp.measured.toFixed(3) }}</strong>
              <span class="capability-change-badge" data-comparison-change>Change {{ formatSigned(capabilityComparison.cp.delta, 3) }} · {{ formatChangePercent(capabilityComparison.cp.relativeChange) }}</span>
            </div>
          </dd>
        </div>
        <div>
          <dt>Cpk</dt>
          <dd
            v-if="capabilityComparison"
            :class="['capability-comparison', changeAssessmentClass(capabilityComparison.cpk.assessment)]"
            data-capability-comparison="cpk"
          >
            <div class="capability-comparison-row setup-row" data-comparison-row>
              <span data-comparison-source>Setup</span>
              <strong>{{ capabilityComparison.cpk.setup.toFixed(3) }}</strong>
            </div>
            <div class="capability-comparison-row sample-row" data-comparison-row>
              <span data-comparison-source>Sample</span>
              <strong>{{ capabilityComparison.cpk.measured.toFixed(3) }}</strong>
              <span class="capability-change-badge" data-comparison-change>Change {{ formatSigned(capabilityComparison.cpk.delta, 3) }} · {{ formatChangePercent(capabilityComparison.cpk.relativeChange) }}</span>
            </div>
          </dd>
        </div>
          </dl>
          <p v-else class="metric-group-empty">Capability requires at least two measurements with variation.</p>
        </section>
        <p v-if="capabilityComparison" class="capability-change-summary" data-capability-change-summary>
          Mean shifted {{ capabilityComparison.mean.delta >= 0 ? "higher" : "lower" }} by {{ Math.abs(capabilityComparison.mean.delta).toFixed(4) }}.
          Variation {{ capabilityComparison.standardDeviation.delta >= 0 ? "increased" : "decreased" }} by {{ Math.abs(capabilityComparison.standardDeviation.relativeChange * 100).toFixed(1) }}%.
          Cp {{ capabilityComparison.cp.delta >= 0 ? "increased" : "decreased" }} by {{ Math.abs(capabilityComparison.cp.delta).toFixed(3) }};
          Cpk {{ capabilityComparison.cpk.delta >= 0 ? "increased" : "decreased" }} by {{ Math.abs(capabilityComparison.cpk.delta).toFixed(3) }}.
        </p>
      </div>
      <p v-if="measurementDiagnostics.outlierIndexes.length > 0" class="outlier-advisory" data-outlier-advisory>
        Red rows are candidate outliers only. Values remain included in all calculations.
      </p>
      <section
        v-if="guidance"
        class="capability-guidance compact semantic"
        data-capability-guidance
      >
        <template v-if="guidance.available">
          <h4 data-capability-guidance-title>
            Factor Capability Guidance
          </h4>
          <p data-capability-guidance-assessment>
            {{ guidance.targetAssessment }}
          </p>
          <p data-capability-guidance-provenance>
            F0 target rule: {{ guidance.provenanceLabel }}
          </p>
          <p
            v-if="guidance.applicability"
            data-capability-guidance-applicability
          >
            Applicability: {{ guidance.applicability }}
          </p>
          <h5>Interpretation</h5>
          <ul data-capability-guidance-interpretations>
            <li
              v-for="interpretation in guidance.interpretations"
              :key="interpretation"
            >
              {{ interpretation }}
            </li>
          </ul>
          <h5>Recommended review</h5>
          <ul data-capability-guidance-recommendations>
            <li
              v-for="recommendation in guidance.recommendations"
              :key="recommendation"
            >
              {{ recommendation }}
            </li>
          </ul>
        </template>
        <template v-else>
          <h4 data-capability-guidance-title>
            Factor Capability Guidance unavailable
          </h4>
          <p data-capability-guidance-unavailable>
            A controlled Cpk target could not be resolved. No target assessment is shown.
          </p>
        </template>
      </section>
      <section class="measured-distribution-interpretation" data-measured-distribution-interpretation>
        <h4>Measured Distribution Interpretation</h4>
        <div class="capability-distribution-fit" data-capability-distribution-fit>
          <SelectedDistributionSummary
            :result="distributionFitResult"
            :approval="distributionApproval"
            :fit-loading="fitLoading"
            :fit-error="fitError"
            :plot-domain="distributionPlotDomain"
            :plot-references="distributionPlotReferences"
            :setup-assumption="factorSetupAssumption"
            :show-heading="false"
            display="summary"
          />
        </div>
        <template v-if="measuredDistributionInterpretation?.available">
          <h5>Controlled statements</h5>
          <ul data-distribution-controlled-statements>
            <li v-for="statement in measuredDistributionInterpretation.controlledStatements" :key="statement">
              {{ statement }}
            </li>
          </ul>
          <h5>Setup / sample facts</h5>
          <ul data-distribution-factual-comparisons>
            <li v-for="comparison in measuredDistributionInterpretation.factualComparisons" :key="comparison">
              {{ comparison }}
            </li>
          </ul>
          <p data-distribution-provenance>F0 provenance: {{ measuredDistributionInterpretation.provenanceLabel }}</p>
          <p data-distribution-rule-ids>Rule IDs: {{ measuredDistributionInterpretation.ruleIds.join(", ") }}</p>
        </template>
        <template v-else>
          <p data-measured-distribution-unavailable>
            A governed selected distribution or the required Setup and Sample comparison is unavailable.
          </p>
        </template>
      </section>
      <p v-if="capabilityResult?.status === 'insufficient_data'" class="error-banner">
        At least two included measurements are required for capability analysis.
      </p>
      <p v-else-if="capabilityResult?.status === 'zero_variation'" class="error-banner">
        Capability cannot be calculated when all included measurements are identical.
      </p>
    </aside>
    </div>
    <div v-else class="measurement-workspace-body distribution-fit-analysis">
      <DistributionFitAnalysis
        heading-eyebrow="Candidate model comparison"
        :result="distributionFitResult"
        :approval="distributionApproval"
        :fit-loading="fitLoading"
        :fit-error="fitError"
        :factor-name="selectedFactor?.factorCandidate.factorName"
        :expanded-plot-family="expandedPlotFamily"
        :plot-domain="distributionPlotDomain"
        :plot-references="distributionPlotReferences"
        :setup-assumption="factorSetupAssumption"
        @toggle-plot="toggleDistributionPlot"
      />
      <button type="button" class="workspace-close-button" @click="activeStage = 'capability'">
        Review Capability Analysis
      </button>
    </div>
  </section>
</template>