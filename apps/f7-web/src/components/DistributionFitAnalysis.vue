<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import type {
  F7DistributionFitResult,
  F7SessionSnapshot,
  F7UiError,
} from "../api/f7-client";
import type {
  DistributionFitObservedDomain,
  DistributionFitReferences,
  FactorSetupAssumption,
} from "../distribution-fit-plot";
import DistributionFitPlot from "./DistributionFitPlot.vue";

type DistributionApproval = NonNullable<
  F7SessionSnapshot["factors"][number]["distributionApproval"]
>;

const props = defineProps<{
  readonly headingEyebrow: string;
  readonly result: DeepReadonly<F7DistributionFitResult> | undefined;
  readonly approval: DeepReadonly<DistributionApproval> | undefined;
  readonly fitLoading: boolean;
  readonly fitError: F7UiError | null;
  readonly factorName: string | undefined;
  readonly expandedPlotFamily: string | undefined;
  readonly plotDomain: DistributionFitObservedDomain | undefined;
  readonly plotReferences: DistributionFitReferences | undefined;
  readonly setupAssumption: FactorSetupAssumption | undefined;
}>();

const emit = defineEmits<{
  togglePlot: [family: string];
}>();

const selectionDecision = computed(() => props.result?.selectionDecision);
const sortedCandidates = computed(() => {
  const candidates = props.result?.candidates ?? [];
  const proposedFamily = selectionDecision.value?.proposedFinalFamily;
  return [...candidates].sort((left, right) => {
    const proposedOrder = Number(right.family === proposedFamily) - Number(left.family === proposedFamily);
    return proposedOrder || left.family.localeCompare(right.family);
  });
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
const fitWarnings = computed(() => props.result?.candidates.flatMap((candidate) =>
  candidate.warnings.map((warning) => ({ family: candidate.family, warning }))) ?? []);
const failedCandidates = computed(() => props.result?.failedCandidates ?? []);

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
    && decision.engineeringDefaultFamily !== family
    && decision.numericBestFamily !== family) {
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
</script>

<template>
  <div class="distribution-fit-heading" data-distribution-fit-heading>
    <div>
      <p class="workspace-eyebrow">{{ headingEyebrow }}</p>
      <h3>Distribution Fit</h3>
    </div>
  </div>
  <p v-if="fitLoading" data-distribution-fit-loading role="status" aria-live="polite">
    Fitting candidate distributions with 10,000 deterministic Bootstrap replicates...
  </p>
  <p v-else-if="fitError && !result" data-distribution-fit-error class="error-banner" role="alert">
    {{ fitError.summary }}
  </p>
  <div v-else-if="result" class="distribution-fit-table-scroll">
    <table class="distribution-fit-table">
      <caption>
        Candidate distributions for {{ factorName }}; sample size {{ result.sampleSize }}
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
                @click="emit('togglePlot', candidate.family)"
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
          <tr v-if="expandedPlotFamily === candidate.family && plotDomain && plotReferences" class="distribution-plot-row">
            <td colspan="13">
              <DistributionFitPlot
                :candidate="candidate"
                :observed-domain="plotDomain"
                :references="plotReferences"
                :assumption="setupAssumption"
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
    <section v-if="selectionDecision" class="fit-conclusion" data-fit-conclusion aria-label="Distribution fit conclusion">
      <div
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
      </div>
      <p
        v-else-if="selectionDecision.status === 'no_acceptable_model'"
        class="fit-no-recommendation"
        data-no-fit-recommendation
        role="status"
      >
        No candidate met the acceptable Bootstrap threshold; the data do not support a governed model preference.
      </p>
      <template v-else>
        <p class="workspace-eyebrow">Governed conclusion</p>
        <h4 v-if="selectionDecision.status === 'no_unique_preference'">No unique distribution preference</h4>
        <h4 v-else>Unique statistical preference: {{ familyLabel(selectionDecision.numericBestFamily ?? "") }}</h4>
        <p v-for="statement in selectionConclusionStatements" :key="statement">{{ statement }}</p>
        <p v-if="selectionDecision.proposedFinalFamily" class="fit-proposed-summary">
          <strong>Proposed final distribution: {{ familyLabel(selectionDecision.proposedFinalFamily) }}.</strong>
          <span v-if="approval">
            Automatically selected for Monte Carlo at {{ approval.approvedAt }}.
          </span>
          <span v-else>Automatic selection unavailable.</span>
        </p>
      </template>
      <p class="fit-confidence"><strong>{{ selectionDecision.confidence.toUpperCase() }} confidence</strong></p>
      <p v-if="hasSelectionReason('SMALL_SAMPLE_UNCERTAINTY')" class="fit-small-sample-warning">
        Small sample (n={{ result.sampleSize }}): model-selection uncertainty remains material.
      </p>
      <p class="fit-conclusion-note">
        Compatibility with the observed sample does not prove that the measurements follow any candidate distribution.
      </p>
    </section>
  </div>
</template>