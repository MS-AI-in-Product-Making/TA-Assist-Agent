<script setup lang="ts">
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { computed, ref, type DeepReadonly } from "vue";
import type { F7DistributionApproval } from "@ai-assist/contracts";
import type { F7DistributionFitResult, F7SessionSnapshot } from "../api/f7-client";
import { resolveSelectedDistribution } from "../distribution-guidance";
import {
  buildDistributionFitReferences,
  buildFactorSetupAssumption,
  distributionFitObservedDomain,
} from "../distribution-fit-plot";
import SelectedDistributionSummary from "./SelectedDistributionSummary.vue";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly includeInPdf: boolean;
}>();
const emit = defineEmits<{
  "update:includeInPdf": [value: boolean];
}>();
const expanded = ref(false);

const appendixFactors = computed(() => props.session.factors.flatMap((factor) => {
  const result = factor.distributionFitResult;
  const evidence = factor.evidence;
  if (!result || !evidence) return [];

  const approval = factor.distributionApproval;
  const selected = resolveSelectedDistribution(
    result as F7DistributionFitResult,
    approval as F7DistributionApproval | undefined,
  );
  if (!selected.available) return [];

  const setupAssumption = buildFactorSetupAssumption({
    signedMean: evidence.calculatedMean,
    oneSigma: evidence.oneSigma,
    distribution: evidence.distribution,
    longTermSafetyFactor: evidence.longTermSafetyFactor,
    sigmaLevel: evidence.sigmaLevel,
  });
  const plotReferences = buildDistributionFitReferences(
    result.candidates,
    evidence.lowerSpecLimit,
    evidence.upperSpecLimit,
  );

  return [{
    factorId: evidence.factorId,
    factorName: factor.factorCandidate.factorName,
    result,
    approval,
    setupAssumption,
    plotReferences,
    plotDomain: distributionFitObservedDomain(result.candidates, plotReferences, setupAssumption),
  }];
}));
</script>

<template>
  <section
    v-if="appendixFactors.length"
    class="factor-distribution-appendix"
    data-factor-distribution-appendix
    aria-labelledby="factor-distribution-appendix-title"
  >
    <header class="factor-distribution-appendix-header">
      <div>
        <p class="workspace-eyebrow">Factor distribution references</p>
        <h2 id="factor-distribution-appendix-title">Appendix</h2>
      </div>
      <div class="factor-distribution-appendix-actions">
        <label class="factor-distribution-appendix-pdf-option">
          <input
            type="checkbox"
            data-include-factor-distribution-appendix
            :checked="includeInPdf"
            @change="emit('update:includeInPdf', ($event.target as HTMLInputElement).checked)"
          />
          Include in PDF Report
        </label>
        <button
          type="button"
          class="factor-distribution-appendix-toggle"
          data-factor-distribution-appendix-toggle
          :aria-expanded="expanded"
          aria-controls="factor-distribution-appendix-content"
          :aria-label="`${expanded ? 'Collapse' : 'Expand'} Factor distribution references`"
          :title="expanded ? 'Collapse Appendix' : 'Expand Appendix'"
          @click="expanded = !expanded"
        >
          <ChevronDown v-if="expanded" :size="20" aria-hidden="true" />
          <ChevronRight v-else :size="20" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div
      v-if="expanded"
      id="factor-distribution-appendix-content"
      data-factor-distribution-appendix-content
    >
      <section
        v-for="(factor, index) in appendixFactors"
        :key="factor.factorId"
        class="factor-distribution-appendix-item"
        data-factor-distribution-appendix-item
      >
        <header>
          <span>Factor {{ index + 1 }}</span>
          <h3>{{ factor.factorName }}</h3>
        </header>
        <SelectedDistributionSummary
          :result="factor.result"
          :approval="factor.approval"
          :plot-domain="factor.plotDomain"
          :plot-references="factor.plotReferences"
          :setup-assumption="factor.setupAssumption"
          :fit-loading="false"
          :fit-error="null"
          :plot-id-prefix="`appendix-${factor.factorId}`"
          :show-heading="false"
          selectable-sigma-levels
          display="plot"
        />
      </section>
    </div>
  </section>
</template>