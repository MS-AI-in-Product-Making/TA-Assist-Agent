<script setup lang="ts">
import { computed } from "vue";
import type { F7DatasetValidationIssue, F7SessionSnapshot } from "../api/f7-client";

const props = defineProps<{
  readonly session: F7SessionSnapshot;
}>();

const reasonLabels: Record<string, string> = {
  subgroup_too_small: "Subgroup too small",
  ordered_sequence_invalid: "Ordered sequence invalid",
  sample_count_below_minimum: "Sample count below minimum",
  exploratory_only: "Exploratory only",
  fit_uncertainty: "Fit uncertainty",
  unit_mismatch: "Unit mismatch",
  specification_missing: "Specification missing",
  non_finite_measurement: "Non-finite measurement",
  duplicate_measurement: "Duplicate measurement",
  msa_evidence_missing: "MSA evidence missing",
  mixed_batch_conditions: "Mixed batch conditions",
  outlier_candidate: "Outlier candidate",
  invalid_rows_rejected: "Invalid rows rejected",
};

const blockingIssues = computed(() => props.session.factors.flatMap((factor) => factor.datasetValidation?.blockingIssues ?? []));
const advisoryIssues = computed(() => props.session.factors.flatMap((factor) => factor.datasetValidation?.advisoryIssues ?? []));

function issueLabel(issue: F7DatasetValidationIssue): string {
  return reasonLabels[issue.reason] ?? "Validation issue";
}
</script>

<template>
  <section class="workbench-panel" aria-label="Validation summary" aria-live="polite">
    <h2>Validation Summary</h2>
    <div class="validation-columns">
      <div>
        <h3>Blocking</h3>
        <ul>
          <li v-for="(issue, index) in blockingIssues" :key="`b-${index}`">
            <strong>{{ issueLabel(issue) }}</strong>
            <span v-if="issue.rowNumbers?.length"> rows: {{ issue.rowNumbers.join(",") }}</span>
          </li>
          <li v-if="blockingIssues.length === 0" class="subtle">No blocking issues.</li>
        </ul>
      </div>
      <div>
        <h3>Advisory</h3>
        <ul>
          <li v-for="(issue, index) in advisoryIssues" :key="`a-${index}`">
            <strong>{{ issueLabel(issue) }}</strong>
            <span v-if="issue.rowNumbers?.length"> rows: {{ issue.rowNumbers.join(",") }}</span>
          </li>
          <li v-if="advisoryIssues.length === 0" class="subtle">No advisory issues.</li>
        </ul>
      </div>
    </div>
  </section>
</template>