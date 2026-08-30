<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import type { F7DistributionApproval } from "@ai-assist/contracts";
import type {
  F7DistributionFitResult,
  F7SessionSnapshot,
  F7UiError,
} from "../api/f7-client";
import { resolveSelectedDistribution } from "../distribution-guidance";
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
  readonly result: DeepReadonly<F7DistributionFitResult> | undefined;
  readonly approval: DeepReadonly<DistributionApproval> | undefined;
  readonly fitLoading: boolean;
  readonly fitError: F7UiError | null;
  readonly plotDomain: DistributionFitObservedDomain | undefined;
  readonly plotReferences: DistributionFitReferences | undefined;
  readonly setupAssumption: FactorSetupAssumption | undefined;
}>();

const selected = computed(() => props.result
  ? resolveSelectedDistribution(
      props.result as F7DistributionFitResult,
      props.approval as F7DistributionApproval | undefined,
    )
  : undefined);
const selectedCandidate = computed(() => selected.value?.available ? selected.value.candidate : undefined);

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
</script>

<template>
  <div class="selected-distribution-heading" data-selected-distribution-heading>
    <div>
      <p class="workspace-eyebrow">Selected model only</p>
      <h4>Selected Distribution Fit</h4>
    </div>
  </div>
  <p v-if="fitLoading" data-distribution-fit-loading role="status" aria-live="polite">
    Fitting candidate distributions with 10,000 deterministic Bootstrap replicates...
  </p>
  <p v-else-if="fitError && !result" data-distribution-fit-error class="error-banner" role="alert">
    {{ fitError.summary }}
  </p>
  <p
    v-else-if="selected && !selected.available"
    class="selected-distribution-unavailable"
    data-selected-distribution-unavailable
    role="status"
  >
    Selected Distribution Fit unavailable. No governed family is available for Capability interpretation.
  </p>
  <div v-else-if="result && selectedCandidate" data-selected-distribution-summary>
    <dl class="selected-distribution-metrics">
      <div>
        <dt>Selected family</dt>
        <dd data-selected-distribution-family>{{ familyLabel(selectedCandidate.family) }}</dd>
      </div>
      <div>
        <dt>Model specification</dt>
        <dd data-selected-model-specification>{{ selectedCandidate.modelSpecification }}</dd>
      </div>
      <div>
        <dt>Parameters</dt>
        <dd data-selected-distribution-parameters>{{ formatParameters(selectedCandidate.parameters) }}</dd>
      </div>
      <div>
        <dt>Bootstrap status / p value</dt>
        <dd data-selected-bootstrap>
          <span :class="`fit-status fit-status-${selectedCandidate.bootstrap.status}`">{{ selectedCandidate.bootstrap.status }}</span>
          · p={{ formatMetric(selectedCandidate.bootstrap.pValue) }}
        </dd>
      </div>
      <div>
        <dt>AICc</dt>
        <dd data-selected-aicc>{{ formatMetric(selectedCandidate.aicc) }}</dd>
      </div>
      <div>
        <dt>Sample size</dt>
        <dd data-selected-sample-size>{{ result.sampleSize }}</dd>
      </div>
      <div>
        <dt>Selection confidence</dt>
        <dd data-selected-confidence>{{ familyLabel(result.selectionDecision.confidence) }}</dd>
      </div>
      <div>
        <dt>Approval state</dt>
        <dd data-selected-approval-state>
          {{ selected?.available && selected.source === "approved"
            ? `Automatically selected for Monte Carlo at ${approval?.approvedAt}`
            : "Automatic selection unavailable" }}
        </dd>
      </div>
    </dl>
    <DistributionFitPlot
      v-if="plotDomain && plotReferences"
      :candidate="selectedCandidate"
      :observed-domain="plotDomain"
      :references="plotReferences"
      :assumption="setupAssumption"
    />
  </div>
</template>