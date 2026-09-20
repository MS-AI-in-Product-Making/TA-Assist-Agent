<script setup lang="ts">
import { FileDown, LoaderCircle } from "lucide-vue-next";
import { computed, type DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import {
  buildMonteCarloSetupComparison,
  deriveMonteCarloSetupSummary,
} from "../monte-carlo-setup-comparison";
import MonteCarloHistogram from "./MonteCarloHistogram.vue";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly busy: boolean;
  readonly running: boolean;
  readonly reportPdfBusy: boolean;
  readonly reportPdfError: string;
}>();

const emit = defineEmits<{
  close: [];
  downloadReportPdf: [];
}>();
const result = computed(() => props.session.monteCarloResult);
const setupSummary = computed(() => {
  const systemSpecification = props.session.systemSpecification;
  return deriveMonteCarloSetupSummary({
    factors: props.session.factors,
    ...(systemSpecification?.status === "available" ? { systemSpecification } : {}),
  });
});
const setupComparison = computed(() => {
  if (!result.value) return { available: false } as const;
  return buildMonteCarloSetupComparison({
    setup: setupSummary.value,
    monteCarlo: {
      mean: result.value.mean,
      standardDeviation: result.value.standardDeviation,
    },
  });
});
const decision = computed(() => {
  const capability = result.value?.capability;
  if (!capability || capability.status === "not_available") {
    return {
      status: "not-evaluable",
      label: "Not evaluable",
      details: ["Variation evidence is insufficient for a capability decision."],
    };
  }
  const meanWarning = setupComparison.value.available
    && setupComparison.value.mean.direction !== "same";
  const cpkDetail = capability.targetStatus === "meets_target"
    ? `Cpk ${formatDecisionValue(capability.cpk)} meets the target Cpk ${formatDecisionValue(capability.targetCpk)}.`
    : `Cpk ${formatDecisionValue(capability.cpk)} is below the target Cpk ${formatDecisionValue(capability.targetCpk)}.`;
  const meanDetail = meanWarning
    ? `Mean ${formatDecisionValue(setupComparison.value.mean.monteCarlo)} differs from Factor Setup Mean ${formatDecisionValue(setupComparison.value.mean.setup)}.`
    : undefined;
  const attentionRequired = capability.targetStatus === "below_target" || meanWarning;
  return {
    status: attentionRequired ? "below-target" : "meets-target",
    label: attentionRequired ? "Attention required" : "Target met",
    details: meanDetail ? [meanDetail, cpkDetail] : [cpkDetail],
  };
});

function format(value: number, maximumFractionDigits = 3): string {
  return value.toLocaleString("en-US", { maximumFractionDigits });
}

function formatDecisionValue(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}
</script>

<template>
  <section class="workbench-panel monte-carlo-panel" aria-labelledby="monte-carlo-title">
    <header class="factor-workspace-header">
      <div>
        <p class="workspace-eyebrow">Step 3 · Results and report</p>
        <h2 id="monte-carlo-title">Tolerance Analysis Results</h2>
        <p class="subtle">Measured-data Monte Carlo engineering assessment</p>
      </div>
      <div class="monte-carlo-header-actions">
        <button type="button" class="workspace-close-button" @click="emit('close')">Back to factors</button>
        <button
          v-if="result"
          type="button"
          class="action-button report-pdf-button"
          data-download-report-pdf
          :disabled="busy || reportPdfBusy"
          @click="emit('downloadReportPdf')"
        >
          <LoaderCircle v-if="reportPdfBusy" :size="16" aria-hidden="true" class="button-spinner" />
          <FileDown v-else :size="16" aria-hidden="true" />
          {{ reportPdfBusy ? "Generating PDF..." : "Download PDF Report" }}
        </button>
      </div>
    </header>
    <p v-if="reportPdfError" class="report-pdf-error" role="alert">{{ reportPdfError }}</p>

    <div
      v-if="running"
      class="automatic-analysis-feedback monte-carlo-progress"
      data-monte-carlo-progress
      role="status"
      aria-live="polite"
    >
      <p>
        <LoaderCircle class="automatic-analysis-spinner" :size="14" aria-hidden="true" />
        <span>Running Monte Carlo simulation</span>
        <span
          class="monte-carlo-progress-dots"
          data-monte-carlo-progress-dots
          aria-hidden="true"
        ><span>.</span><span>.</span><span>.</span></span>
      </p>
      <div
        class="automatic-analysis-bar"
        data-monte-carlo-progress-bar
        role="progressbar"
        aria-label="Monte Carlo simulation in progress"
      ><span /></div>
    </div>

    <section v-if="result" class="monte-carlo-results" data-monte-carlo-results aria-live="polite">
      <div
        class="monte-carlo-decision"
        :class="`decision-${decision.status}`"
        data-monte-carlo-decision
        :data-status="decision.status"
      >
        <div>
          <p class="workspace-eyebrow">Governed result</p>
          <h3>{{ decision.label }}</h3>
        </div>
        <div class="monte-carlo-decision-details">
          <p
            v-for="detail in decision.details"
            :key="detail"
            data-monte-carlo-decision-detail
          >
            {{ detail }}
          </p>
        </div>
      </div>

      <dl class="monte-carlo-kpis" aria-label="Key simulation results">
        <div data-monte-carlo-kpi>
          <dt>Yield</dt>
          <dd>{{ format(result.yield * 100, 2) }}%</dd>
          <span>{{ format(result.ppm) }} PPM out of spec</span>
        </div>
        <div data-monte-carlo-kpi>
          <dt>Cpk</dt>
          <dd>{{ result.capability.status === "available" ? format(result.capability.cpk) : "—" }}</dd>
          <span>Target {{ format(result.capability.targetCpk) }}</span>
        </div>
        <div data-monte-carlo-kpi>
          <dt>Mean</dt>
          <dd>{{ format(result.mean) }}</dd>
          <span>Simulated output center</span>
        </div>
        <div data-monte-carlo-kpi>
          <dt>Std Dev</dt>
          <dd>{{ format(result.standardDeviation) }}</dd>
          <span>Measured output spread</span>
        </div>
      </dl>

      <div class="distribution-section-heading">
        <div>
          <p class="workspace-eyebrow">Output distribution</p>
          <h3>Monte Carlo response</h3>
        </div>
        <span>{{ result.iterations.toLocaleString("en-US") }} iterations</span>
      </div>
      <MonteCarloHistogram
        :result="result"
        v-bind="setupSummary.available ? { setup: setupSummary } : {}"
      />
    </section>
  </section>
</template>
