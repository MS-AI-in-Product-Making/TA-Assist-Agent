<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch, type DeepReadonly } from "vue";
import type { F7MeasurementStructure, F7SessionSnapshot, F7UiError } from "../api/f7-client";
import { calculateF7Capability } from "../f7-capability";
import { buildDistributionFitReferences, distributionFitObservedDomain } from "../distribution-fit-plot";
import DistributionFitPlot from "./DistributionFitPlot.vue";
import SelectedFactorSetup from "./SelectedFactorSetup.vue";

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
    sourceReference: string;
    msaStatus: "unknown";
    text: string;
  }];
  close: [];
  fit: [factorId: string];
  approve: [factorId: string, family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform"];
  stageChange: [stage: "measurement" | "capability" | "distribution"];
}>();

const form = reactive({
  structure: "UNORDERED_SAMPLE" as F7MeasurementStructure,
});

const selectedFactor = computed(() => props.session.factors.find((factor) => factor.evidence?.factorId === props.factorId));

function measurementValues(factorId: string): string[] {
  return props.session.factors
    .find((factor) => factor.evidence?.factorId === factorId)
    ?.measurementPasteResult?.dataset?.observations
    .filter((observation) => observation.disposition === "included")
    .sort((left, right) => left.originalRow - right.originalRow)
    .map((observation) => String(observation.value)) ?? [];
}

const measurementRows = ref([...measurementValues(props.factorId), ""]);
const measurementGrid = ref<HTMLElement | null>(null);
const measurementCount = computed(() => measurementRows.value.filter((value) => value.trim().length > 0).length);
const activeStage = ref<"measurement" | "capability" | "distribution">("measurement");
const confirmationPending = ref(false);
const measurementReady = computed(() => selectedFactor.value?.measurementPasteResult?.status === "ready");
const specificationUnit = computed(() => {
  const unit = selectedFactor.value?.evidence?.unit;
  return unit && unit !== "unspecified" ? unit : "";
});
const capabilityResult = computed(() => {
  const evidence = selectedFactor.value?.evidence;
  const dataset = selectedFactor.value?.measurementPasteResult?.dataset;
  if (!evidence || !dataset) return undefined;

  const values = dataset.observations
    .filter((observation) => observation.disposition === "included")
    .map((observation) => observation.value);
  return calculateF7Capability(values, evidence.lowerSpecLimit, evidence.upperSpecLimit);
});
const distributionFitResult = computed(() => selectedFactor.value?.distributionFitResult);
const distributionFitResultKey = computed(() => JSON.stringify(distributionFitResult.value ?? null));
const distributionPlotReferences = computed(() => {
  const result = distributionFitResult.value;
  const evidence = selectedFactor.value?.evidence;
  return result && evidence
    ? buildDistributionFitReferences(result.candidates, evidence.lowerSpecLimit, evidence.upperSpecLimit)
    : undefined;
});
const distributionPlotDomain = computed(() => distributionFitResult.value
  ? distributionFitObservedDomain(distributionFitResult.value.candidates, distributionPlotReferences.value)
  : undefined);
const selectionDecision = computed(() => distributionFitResult.value?.selectionDecision);
const distributionApproval = computed(() => selectedFactor.value?.distributionApproval);
const proposedCandidateIsAcceptable = computed(() => {
  const family = selectionDecision.value?.proposedFinalFamily;
  return distributionFitResult.value?.candidates.some((candidate) => (
    candidate.family === family && candidate.bootstrap.status === "acceptable"
  )) ?? false;
});
const sortedCandidates = computed(() => {
  const candidates = distributionFitResult.value?.candidates ?? [];
  const proposedFamily = selectionDecision.value?.proposedFinalFamily;
  if (!proposedFamily) return candidates;
  return [...candidates].sort((left, right) => (
    Number(right.family === proposedFamily) - Number(left.family === proposedFamily)
  ));
});
const selectionConclusionStatements = computed(() => {
  const decision = selectionDecision.value;
  if (!decision) return [];
  const statements: string[] = [];
  if (decision.reasonCodes.includes("MULTIPLE_COMPETITIVE_MODELS")) {
    statements.push(`${familyList(decision.competitiveFamilies)} are statistically competitive for this sample.`);
  } else if (decision.reasonCodes.includes("SINGLE_ACCEPTABLE_COMPETITOR") && decision.numericBestFamily) {
    statements.push(`${familyLabel(decision.numericBestFamily)} is the only acceptable model within ΔAICc ≤ 2.`);
  }
  if (decision.numericBestFamily) {
    statements.push(`${familyLabel(decision.numericBestFamily)} has the numerically lowest AICc among acceptable candidates.`);
  }
  if (decision.reasonCodes.includes("NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT") && decision.engineeringDefaultFamily) {
    statements.push(`${familyLabel(decision.engineeringDefaultFamily)} is the engineering default.`);
  }
  const alternativeFamilies = decision.competitiveFamilies.filter((family) => (
    family !== decision.engineeringDefaultFamily && family !== decision.numericBestFamily
  ));
  if (alternativeFamilies.length === 1) {
    statements.push(`${familyList(alternativeFamilies)} is a plausible alternative.`);
  } else if (alternativeFamilies.length > 1) {
    statements.push(`${familyList(alternativeFamilies)} are plausible alternatives.`);
  }
  return statements;
});
const expandedPlotFamily = ref<string>();
const fitWarnings = computed(() => distributionFitResult.value?.candidates.flatMap((candidate) =>
  candidate.warnings.map((warning) => ({ family: candidate.family, warning }))) ?? []);
const failedCandidates = computed(() => distributionFitResult.value?.failedCandidates ?? []);

function showProposedDistributionPlot(): void {
  expandedPlotFamily.value = selectionDecision.value?.proposedFinalFamily;
}

function ensureTrailingEmptyRow(): void {
  while (
    measurementRows.value.length > 1
    && measurementRows.value.at(-1)?.trim() === ""
    && measurementRows.value.at(-2)?.trim() === ""
  ) {
    measurementRows.value.pop();
  }
  if (measurementRows.value.at(-1)?.trim() !== "") measurementRows.value.push("");
}

function removeRow(index: number): void {
  measurementRows.value.splice(index, 1);
  if (measurementRows.value.length === 0) measurementRows.value.push("");
  ensureTrailingEmptyRow();
}

async function clearMeasurements(): Promise<void> {
  if (measurementCount.value === 0) return;
  measurementRows.value = [""];
  confirmationPending.value = false;
  await nextTick();
  measurementGrid.value?.querySelector<HTMLInputElement>("input[data-measurement-row='1']")?.focus();
}

function pasteRows(index: number, event: ClipboardEvent): void {
  const pastedValues = event.clipboardData?.getData("text/plain")
    .split(/\r?\n|\t/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0) ?? [];
  if (pastedValues.length === 0) return;
  event.preventDefault();
  measurementRows.value.splice(index, 1, ...pastedValues);
  ensureTrailingEmptyRow();
}

function submitPaste(): void {
  const values = measurementRows.value.map((value) => value.trim()).filter((value) => value.length > 0);
  if (props.busy || !selectedFactor.value || values.length === 0) return;
  confirmationPending.value = true;
  const text = form.structure === "ORDERED_INDIVIDUALS"
    ? ["value\tsequence", ...values.map((value, index) => `${value}\t${index + 1}`)].join("\n")
    : values.join("\n");
  emit("paste", {
    factorId: props.factorId,
    structure: form.structure,
    sourceReference: "local-workbench-entry",
    msaStatus: "unknown",
    text,
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

function approveProposedDistribution(): void {
  const family = selectionDecision.value?.proposedFinalFamily;
  if (!family || !proposedCandidateIsAcceptable.value || props.busy) return;
  emit("approve", props.factorId, family);
}

function formatMetric(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6, useGrouping: false });
}

function formatParameters(parameters: Readonly<Record<string, number>>): string {
  return Object.entries(parameters)
    .map(([name, value]) => `${name}=${formatMetric(value)}`)
    .join(", ");
}

function familyLabel(family: string): string {
  return `${family.charAt(0).toUpperCase()}${family.slice(1)}`;
}

function modelSpecificationLabel(specification: string): string {
  if (specification === "normal_location_scale") return "Location fitted";
  if (specification.endsWith("_location_zero")) return "Location fixed at 0";
  if (specification === "uniform_boundary_mle") return "Boundary MLE";
  return specification;
}

function candidateDecisionLabels(family: string): string[] {
  const decision = selectionDecision.value;
  if (!decision) return [];
  const labels: string[] = [];
  if (decision.proposedFinalFamily === family) labels.push("Proposed final selection");
  if (decision.numericBestFamily === family) labels.push("Numerically lowest AICc");
  if (decision.engineeringDefaultFamily === family) labels.push("Engineering default");
  if (decision.competitiveFamilies.includes(family as typeof decision.competitiveFamilies[number])
    && decision.engineeringDefaultFamily !== family) {
    labels.push("Plausible alternative");
  }
  return labels;
}

function familyList(families: readonly string[]): string {
  const labels = families.map(familyLabel);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function hasSelectionReason(reasonCode: string): boolean {
  return selectionDecision.value?.reasonCodes.includes(
    reasonCode as NonNullable<typeof selectionDecision.value>["reasonCodes"][number],
  ) ?? false;
}

function failureReason(reasonCode: string): string {
  return reasonCode === "numerical_fit_failed" ? "numerical fit failed" : reasonCode;
}

function toggleDistributionPlot(family: string): void {
  expandedPlotFamily.value = expandedPlotFamily.value === family ? undefined : family;
}

function closeMeasurementWorkspace(): void {
  expandedPlotFamily.value = undefined;
  emit("close");
}

function specificationSource(bound: "lowerSpecLimit" | "upperSpecLimit"): string {
  const evidence = selectedFactor.value?.evidence;
  if (!evidence) return "";
  const nominalValueSource = evidence.sourceCells.nominalValue;
  const toleranceSource = evidence.sourceCells[bound === "lowerSpecLimit" ? "lowerTolerance" : "upperTolerance"];
  if (nominalValueSource && toleranceSource) return `ABS(${nominalValueSource}) + ${toleranceSource}`;
  return evidence.sourceCells[bound] ?? "";
}

function formatSpecificationLimit(value: number | undefined): string {
  if (value === undefined) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 12, useGrouping: false });
}

watch(
  () => [props.busy, selectedFactor.value?.measurementPasteResult?.status] as const,
  ([busy, status]) => {
    if (busy || !confirmationPending.value) return;
    confirmationPending.value = false;
    if (status === "ready") activeStage.value = "capability";
  },
);

watch(
  distributionFitResultKey,
  (resultKey, previousResultKey) => {
    if (activeStage.value === "distribution" && resultKey !== previousResultKey) {
      showProposedDistributionPlot();
    }
  },
);

watch(
  () => props.factorId,
  (factorId) => {
    measurementRows.value = [...measurementValues(factorId), ""];
    form.structure = selectedFactor.value?.measurementPasteResult?.dataset?.structure ?? "UNORDERED_SAMPLE";
    activeStage.value = "measurement";
    expandedPlotFamily.value = undefined;
    confirmationPending.value = false;
  },
);

watch(activeStage, (stage) => emit("stageChange", stage));
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
      <h4>Factor Specification Limits (Excel)</h4>
      <dl>
        <div>
          <dt>LSL</dt>
          <dd>{{ formatSpecificationLimit(selectedFactor?.evidence?.lowerSpecLimit) }} {{ specificationUnit }}</dd>
          <small>{{ specificationSource("lowerSpecLimit") }}</small>
        </div>
        <div>
          <dt>USL</dt>
          <dd>{{ formatSpecificationLimit(selectedFactor?.evidence?.upperSpecLimit) }} {{ specificationUnit }}</dd>
          <small>{{ specificationSource("upperSpecLimit") }}</small>
        </div>
      </dl>
    </section>
    <div v-if="activeStage === 'measurement'" class="measurement-workspace-body">
      <div class="measurement-section-heading">
        <h3>Measurement Data</h3>
        <div class="measurement-heading-actions">
          <strong>{{ measurementCount }} values</strong>
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
          <select v-model="form.structure">
            <option value="RATIONAL_SUBGROUP">RATIONAL_SUBGROUP</option>
            <option value="ORDERED_INDIVIDUALS">ORDERED_INDIVIDUALS</option>
            <option value="UNORDERED_SAMPLE">UNORDERED_SAMPLE</option>
          </select>
        </label>
      </div>
      <div ref="measurementGrid" class="measurement-grid-scroll">
        <table class="measurement-grid">
          <thead>
            <tr>
              <th>No.</th>
              <th>Measured Value</th>
              <th><span class="sr-only">Row actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(value, index) in measurementRows" :key="index">
              <td>{{ index + 1 }}</td>
              <td>
                <input
                  v-model="measurementRows[index]"
                  :data-measurement-row="index + 1"
                  inputmode="decimal"
                  :aria-label="`Measurement value ${index + 1}`"
                  @input="ensureTrailingEmptyRow"
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
      <button
        type="button"
        class="action-button"
        data-confirm-measurements
        :disabled="busy || measurementCount === 0"
        @click="submitPaste"
      >
        Confirm Measurement Data
      </button>
    </div>
    <div v-else-if="activeStage === 'capability'" class="measurement-workspace-body capability-analysis">
      <p class="workspace-eyebrow">Measurement data confirmed</p>
      <h3>Capability Analysis</h3>
      <dl v-if="capabilityResult?.status === 'ready'" class="capability-metrics">
        <div>
          <dt>Sample Size</dt>
          <dd>{{ capabilityResult.sampleSize }}</dd>
        </div>
        <div>
          <dt>Mean</dt>
          <dd>{{ capabilityResult.mean.toFixed(4) }}</dd>
        </div>
        <div>
          <dt>Sample Std Dev</dt>
          <dd>{{ capabilityResult.sampleStandardDeviation.toFixed(4) }}</dd>
        </div>
        <div>
          <dt>Cp</dt>
          <dd>{{ capabilityResult.cp.toFixed(3) }}</dd>
        </div>
        <div>
          <dt>Cpk</dt>
          <dd>{{ capabilityResult.cpk.toFixed(3) }}</dd>
        </div>
      </dl>
      <p v-else-if="capabilityResult?.status === 'insufficient_data'" class="error-banner">
        At least two included measurements are required for capability analysis.
      </p>
      <p v-else-if="capabilityResult?.status === 'zero_variation'" class="error-banner">
        Capability cannot be calculated when all included measurements are identical.
      </p>
      <button type="button" class="workspace-close-button" @click="activeStage = 'measurement'">
        Review Measurement Data
      </button>
    </div>
    <div v-else class="measurement-workspace-body distribution-fit-analysis">
      <p class="workspace-eyebrow">Candidate model comparison</p>
      <h3>Distribution Fit</h3>
      <p v-if="fitLoading" data-distribution-fit-loading role="status" aria-live="polite">
        Fitting candidate distributions with 10,000 deterministic Bootstrap replicates...
      </p>
      <p v-else-if="fitError && !distributionFitResult" data-distribution-fit-error class="error-banner" role="alert">
        {{ fitError.summary }}
      </p>
      <div v-else-if="distributionFitResult" class="distribution-fit-table-scroll">
        <table class="distribution-fit-table">
          <caption>
            Candidate distributions for {{ selectedFactor?.factorCandidate.factorName }}; sample size {{ distributionFitResult.sampleSize }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Distribution</th>
              <th scope="col">Model / location</th>
              <th scope="col">k</th>
              <th scope="col">Parameters</th>
              <th scope="col">AIC</th>
              <th scope="col">AICc</th>
              <th scope="col">ΔAICc</th>
              <th scope="col">BIC</th>
              <th scope="col">ΔBIC</th>
              <th scope="col">AD Bootstrap GOF</th>
              <th scope="col">Status</th>
              <th scope="col">Plot</th>
              <th scope="col">Q-Q evidence</th>
            </tr>
          </thead>
          <tbody>
            <template
              v-for="candidate in sortedCandidates"
              :key="candidate.family"
            >
              <tr :class="selectionDecision?.proposedFinalFamily === candidate.family
                ? 'fit-proposed-final'
                : candidateDecisionLabels(candidate.family).length > 0 ? 'fit-governed' : undefined">
                <th scope="row">
                  {{ familyLabel(candidate.family) }}
                  <span
                    v-for="label in candidateDecisionLabels(candidate.family)"
                    :key="label"
                    class="fit-decision-mark"
                  >{{ label }}</span>
                </th>
                <td>{{ modelSpecificationLabel(candidate.modelSpecification) }}</td>
                <td>{{ candidate.parameterCount }}</td>
                <td class="fit-parameters">{{ formatParameters(candidate.parameters) }}</td>
                <td>{{ formatMetric(candidate.aic) }}</td>
                <td>{{ formatMetric(candidate.aicc) }}</td>
                <td>{{ formatMetric(candidate.deltaAicc) }}</td>
                <td>{{ formatMetric(candidate.bic) }}</td>
                <td>{{ formatMetric(candidate.deltaBic) }}</td>
                <td class="fit-gof-audit">
                  <span>{{ candidate.bootstrap.methodId }}</span>
                  <span>candidate={{ candidate.bootstrap.candidateMethodId }}</span>
                  <span>{{ candidate.bootstrap.refitEachReplicate ? "Refit each replicate" : "No replicate refit" }}</span>
                  <span>comparison={{ candidate.bootstrap.comparisonDirection }}</span>
                  <span>AD={{ formatMetric(candidate.ad) }}</span>
                  <span>p={{ formatMetric(candidate.bootstrap.pValue) }}</span>
                  <span>B={{ candidate.bootstrap.replicates }}</span>
                  <span>
                    95% CI [{{ formatMetric(candidate.bootstrap.confidenceInterval.lower) }},
                    {{ formatMetric(candidate.bootstrap.confidenceInterval.upper) }}]
                  </span>
                  <span>extreme={{ candidate.bootstrap.extremeReplicateCount }}</span>
                </td>
                <td><span :class="`fit-status fit-status-${candidate.bootstrap.status}`">{{ candidate.bootstrap.status }}</span></td>
                <td>
                  <button
                    type="button"
                    class="fit-plot-toggle"
                    :data-fit-plot-family="candidate.family"
                    :aria-expanded="expandedPlotFamily === candidate.family"
                    @click="toggleDistributionPlot(candidate.family)"
                  >{{ expandedPlotFamily === candidate.family ? "Hide plot" : "Show plot" }}</button>
                </td>
                <td>
                  <details class="qq-evidence" :data-qq-family="candidate.family">
                    <summary>{{ candidate.qqPoints.length }} points</summary>
                    <div class="qq-point-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Point</th>
                            <th scope="col">Observed</th>
                            <th scope="col">Theoretical</th>
                            <th scope="col">Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(point, index) in candidate.qqPoints" :key="index">
                            <th scope="row">{{ index + 1 }}</th>
                            <td>{{ formatMetric(point.observed) }}</td>
                            <td>{{ formatMetric(point.theoretical) }}</td>
                            <td>{{ formatMetric(point.observed - point.theoretical) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </details>
                </td>
              </tr>
              <tr v-if="expandedPlotFamily === candidate.family && distributionPlotDomain && distributionPlotReferences" class="distribution-plot-row">
                <td colspan="13">
                  <DistributionFitPlot
                    :candidate="candidate"
                    :observed-domain="distributionPlotDomain"
                    :references="distributionPlotReferences"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <ul v-if="fitWarnings.length > 0" class="fit-warnings" aria-label="Distribution fit warnings">
          <li v-for="entry in fitWarnings" :key="`${entry.family}-${entry.warning}`">
            <strong>{{ familyLabel(entry.family) }}:</strong> {{ entry.warning }}
          </li>
        </ul>
        <section
          v-if="failedCandidates.length > 0"
          class="fit-failures"
          data-failed-candidates
          role="status"
          aria-label="Failed distribution candidates"
        >
          <h4>Failed candidates</h4>
          <ul>
            <li v-for="failure in failedCandidates" :key="failure.family">
              <strong>{{ familyLabel(failure.family) }}:</strong> {{ failureReason(failure.reasonCode) }}
            </li>
          </ul>
          <p data-recommendation-withheld>
            Conclusion withheld because one or more eligible candidates could not be fitted numerically.
          </p>
        </section>
        <p
          v-else-if="selectionDecision?.status === 'no_acceptable_model'"
          class="fit-no-recommendation"
          data-no-fit-recommendation
          role="status"
        >
          No candidate met the acceptable Bootstrap threshold; the data do not support a governed model preference.
        </p>
        <section v-else-if="selectionDecision" class="fit-conclusion" data-fit-conclusion aria-label="Distribution fit conclusion">
          <p class="workspace-eyebrow">Governed conclusion</p>
          <h4 v-if="selectionDecision.status === 'no_unique_preference'">No unique distribution preference</h4>
          <h4 v-else>Unique statistical preference: {{ familyLabel(selectionDecision.numericBestFamily ?? "") }}</h4>
          <p v-for="statement in selectionConclusionStatements" :key="statement">{{ statement }}</p>
          <p v-if="selectionDecision.proposedFinalFamily" class="fit-proposed-summary">
            <strong>Proposed final distribution: {{ familyLabel(selectionDecision.proposedFinalFamily) }}.</strong>
            <span v-if="distributionApproval">
              Approved for Monte Carlo at {{ distributionApproval.approvedAt }}.
            </span>
            <span v-else>Requires engineer confirmation before Monte Carlo.</span>
          </p>
          <button
            v-if="selectionDecision.proposedFinalFamily && !distributionApproval"
            type="button"
            class="action-button"
            data-approve-distribution
            :disabled="busy || !proposedCandidateIsAcceptable"
            @click="approveProposedDistribution"
          >
            Approve {{ familyLabel(selectionDecision.proposedFinalFamily) }} for Monte Carlo
          </button>
          <p class="fit-confidence"><strong>{{ selectionDecision.confidence.toUpperCase() }} confidence</strong></p>
          <p v-if="hasSelectionReason('SMALL_SAMPLE_UNCERTAINTY')" class="fit-small-sample-warning">
            Small sample (n={{ distributionFitResult.sampleSize }}): model-selection uncertainty remains material.
          </p>
          <p class="fit-conclusion-note">
            Compatibility with the observed sample does not prove that the measurements follow any candidate distribution.
          </p>
        </section>
      </div>
      <button type="button" class="workspace-close-button" @click="activeStage = 'capability'">
        Review Capability Analysis
      </button>
    </div>
  </section>
</template>