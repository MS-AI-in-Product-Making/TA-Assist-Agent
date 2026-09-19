<script setup lang="ts">
import { FileDown, LoaderCircle } from "lucide-vue-next";
import { computed, type DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import { deriveMonteCarloSetupSummary } from "../monte-carlo-setup-comparison";
import MonteCarloHistogram from "./MonteCarloHistogram.vue";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly busy: boolean;
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

function format(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
</script>

<template>
  <section class="workbench-panel monte-carlo-panel" aria-labelledby="monte-carlo-title">
    <header class="factor-workspace-header">
      <div>
        <p class="workspace-eyebrow">Step 5</p>
        <h2 id="monte-carlo-title">Monte Carlo simulation</h2>
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

    <section v-if="result" class="monte-carlo-results" data-monte-carlo-results aria-live="polite">
      <p class="workspace-eyebrow">Governed result</p>
      <h3>{{ format(result.yield * 100) }}% predicted yield</h3>
      <MonteCarloHistogram
        :result="result"
        v-bind="setupSummary.available ? { setup: setupSummary } : {}"
      />
    </section>
  </section>
</template>
