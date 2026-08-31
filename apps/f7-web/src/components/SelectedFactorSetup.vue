<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "../api/f7-client";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly factorId: string;
}>();

const selectedFactor = computed(() => props.session.factors.find((factor) => factor.evidence?.factorId === props.factorId));
const itemNumber = computed(() => props.session.factors.findIndex((factor) => factor.evidence?.factorId === props.factorId) + 1);
const totalVariance = computed(() => props.session.factors.reduce(
  (total, factor) => total + (factor.evidence?.oneSigma ?? 0) ** 2,
  0,
));
const contribution = computed(() => {
  const oneSigma = selectedFactor.value?.evidence?.oneSigma ?? 0;
  return totalVariance.value > 0 ? (oneSigma ** 2 / totalVariance.value) * 100 : 0;
});

function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return Number(value.toFixed(4)).toString();
}
</script>

<template>
  <div v-if="selectedFactor" class="table-scroll selected-factor-setup">
    <table class="data-table factor-table factor-table-centered selected-factor-setup-table" aria-label="Selected factor setup">
      <thead>
        <tr>
          <th>Item</th>
          <th>Factor</th>
          <th>Design Nominal</th>
          <th>+ Tol</th>
          <th>- Tol</th>
          <th>Long Term/Safety Factor</th>
          <th>σ Level</th>
          <th>Distribution</th>
          <th>Mean</th>
          <th>Tolerance</th>
          <th>1σ</th>
          <th>% Cont. to σ</th>
          <th>Source Mode</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{ itemNumber }}</td>
          <td>{{ selectedFactor.factorCandidate.factorName }}</td>
          <td>{{ formatNumber(selectedFactor.setup?.designNominal) }}</td>
          <td>{{ formatNumber(selectedFactor.setup?.upperTolerance) }}</td>
          <td>{{ formatNumber(selectedFactor.setup?.lowerTolerance) }}</td>
          <td>{{ formatNumber(selectedFactor.setup?.longTermSafetyFactor ?? selectedFactor.evidence?.longTermSafetyFactor) }}</td>
          <td>{{ formatNumber(selectedFactor.setup?.sigmaLevel ?? selectedFactor.evidence?.sigmaLevel) }}</td>
          <td>{{ selectedFactor.setup?.distribution ?? selectedFactor.evidence?.distribution }}</td>
          <td>{{ formatNumber(selectedFactor.evidence?.calculatedMean) }}</td>
          <td>{{ formatNumber(selectedFactor.evidence?.tolerance) }}</td>
          <td>{{ formatNumber(selectedFactor.evidence?.oneSigma) }}</td>
          <td>{{ contribution.toFixed(4) }}%</td>
          <td>
            <span class="selected-factor-source-mode">{{ selectedFactor.sourceMode ?? "Not selected" }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
