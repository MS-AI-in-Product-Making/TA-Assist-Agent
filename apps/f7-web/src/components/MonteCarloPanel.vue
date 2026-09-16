<script setup lang="ts">
import { FileDown, LoaderCircle } from "lucide-vue-next";
import { computed, reactive, type DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import {
  buildMonteCarloSetupComparison,
  deriveMonteCarloSetupSummary,
} from "../monte-carlo-setup-comparison";
import MonteCarloHistogram from "./MonteCarloHistogram.vue";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly busy: boolean;
  readonly reportPdfBusy: boolean;
  readonly reportPdfError: string;
}>();

const emit = defineEmits<{
  run: [request: {
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    iterations: 10_000 | 100_000;
    runSeed: string;
    correlationMode: "INDEPENDENT";
  }];
  close: [];
  downloadReportPdf: [];
}>();

function initialEvidenceValue(field: "lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel"): string {
  const evidence = props.session.systemSpecification?.[field];
  return evidence?.status === "available" ? String(evidence.actualValue) : "";
}

const form = reactive({
  lowerSpecLimit: initialEvidenceValue("lowerSpecLimit"),
  upperSpecLimit: initialEvidenceValue("upperSpecLimit"),
  targetSigmaLevel: initialEvidenceValue("targetSigmaLevel"),
  iterations: 100_000 as 10_000 | 100_000,
  runSeed: "12345",
});

const limitsValid = computed(() => {
  if (form.lowerSpecLimit.trim() === "" || form.upperSpecLimit.trim() === "") return false;
  const lower = Number(form.lowerSpecLimit);
  const upper = Number(form.upperSpecLimit);
  return Number.isFinite(lower) && Number.isFinite(upper) && lower < upper;
});
const seedValid = computed(() => /^\d{1,15}$/.test(form.runSeed));
const targetSigmaValid = computed(() => form.targetSigmaLevel.trim() !== ""
  && Number.isFinite(Number(form.targetSigmaLevel))
  && Number(form.targetSigmaLevel) > 0);
const canRun = computed(() => limitsValid.value && targetSigmaValid.value && seedValid.value && !props.busy);
const result = computed(() => props.session.monteCarloResult);
const setupSummary = computed(() => {
  const systemSpecification = props.session.systemSpecification;
  return deriveMonteCarloSetupSummary({
    factors: props.session.factors,
    ...(systemSpecification?.status === "available" ? { systemSpecification } : {}),
  });
});
const setupComparison = computed(() => buildMonteCarloSetupComparison({
  setup: setupSummary.value,
  monteCarlo: {
    mean: result.value?.mean ?? Number.NaN,
    standardDeviation: result.value?.standardDeviation ?? Number.NaN,
  },
}));
const setupCapability = computed(() => {
  if (!setupSummary.value.available || !result.value) return undefined;
  const standardDeviation = setupSummary.value.standardDeviation;
  const cp = (result.value.upperSpecLimit - result.value.lowerSpecLimit) / (6 * standardDeviation);
  const cpk = Math.min(
    (result.value.upperSpecLimit - setupSummary.value.mean) / (3 * standardDeviation),
    (setupSummary.value.mean - result.value.lowerSpecLimit) / (3 * standardDeviation),
  );
  return { cp, cpk };
});

function encodedSeed(seed: string): string {
  return BigInt(seed).toString(16).padStart(64, "0");
}

function displayedSeed(seed: string): string {
  return /^0{49,63}[a-f0-9]{1,15}$/.test(seed) ? BigInt(`0x${seed}`).toString(10) : seed;
}

function submit(): void {
  if (!canRun.value) return;
  emit("run", {
    lowerSpecLimit: Number(form.lowerSpecLimit),
    upperSpecLimit: Number(form.upperSpecLimit),
    targetSigmaLevel: Number(form.targetSigmaLevel),
    iterations: form.iterations,
    runSeed: encodedSeed(form.runSeed),
    correlationMode: "INDEPENDENT",
  });
}

function format(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatFixed(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatSigned(value: number, digits: number): string {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;
}

function comparisonDirection(delta: number, improvementWhenHigher = false): string {
  if (Math.abs(delta) < 0.5e-3) return "No material change";
  if (improvementWhenHigher) return delta > 0 ? "Improved" : "Decreased";
  return delta > 0 ? "Higher" : "Lower";
}

const comparisonInterpretation = computed(() => {
  const comparison = setupComparison.value;
  if (!comparison.available) return "";
  const mean = comparison.mean.direction === "same"
    ? "No displayed mean shift"
    : `Monte Carlo mean shifted ${comparison.mean.direction}`;
  const spread = comparison.standardDeviation.direction === "same"
    ? "no displayed spread change"
    : `Monte Carlo spread is ${comparison.standardDeviation.direction}`;
  return `${mean}; ${spread}.`;
});
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

    <form class="monte-carlo-form" @submit.prevent="submit">
      <label>
        System LSL
        <input v-model="form.lowerSpecLimit" data-monte-carlo-lsl inputmode="decimal" required>
      </label>
      <label>
        System USL
        <input v-model="form.upperSpecLimit" data-monte-carlo-usl inputmode="decimal" required>
      </label>
      <label>
        Target Sigma Level
        <input v-model="form.targetSigmaLevel" data-monte-carlo-target-sigma inputmode="decimal" required>
      </label>
      <label>
        Iterations
        <select v-model="form.iterations" data-monte-carlo-iterations>
          <option :value="10000">10,000</option>
          <option :value="100000">100,000</option>
        </select>
      </label>
      <label class="seed-field">
        Run seed
        <input v-model.trim="form.runSeed" data-monte-carlo-seed inputmode="numeric" pattern="\d{1,15}" maxlength="15" required>
      </label>
      <p class="subtle correlation-note">Correlation mode: Independent factors</p>
      <button type="submit" class="action-button" data-run-monte-carlo :disabled="!canRun">
        {{ busy ? "Running simulation..." : "Run simulation" }}
      </button>
    </form>

    <section v-if="result" class="monte-carlo-results" data-monte-carlo-results aria-live="polite">
      <p class="workspace-eyebrow">Governed result</p>
      <h3>{{ format(result.yield * 100) }}% predicted yield</h3>
      <MonteCarloHistogram
        :result="result"
        v-bind="setupSummary.available ? { setup: setupSummary } : {}"
      />
      <section class="ta-comparison" data-setup-comparison>
        <div class="ta-comparison-heading">
          <div>
            <p class="workspace-eyebrow">Factor Setup vs governed simulation</p>
            <h4>TA Comparison Matrix</h4>
          </div>
          <p v-if="setupComparison.available" data-setup-comparison-interpretation>{{ comparisonInterpretation }}</p>
          <p v-else data-setup-comparison-unavailable>Factor Setup comparison unavailable because evidence is incomplete; Monte Carlo outputs remain available.</p>
        </div>
        <div class="ta-comparison-scroll">
          <table data-ta-comparison-matrix>
            <caption>Factor Setup and Monte Carlo TA results</caption>
            <thead>
              <tr>
                <th scope="col">TA metric</th>
                <th scope="col">Factor Setup TA</th>
                <th scope="col">Monte Carlo output</th>
                <th scope="col">Difference</th>
                <th scope="col">Reading</th>
              </tr>
            </thead>
            <tbody>
              <tr data-setup-mean-comparison>
                <th scope="row">Mean</th>
                <td>{{ setupSummary.available ? formatFixed(setupSummary.mean, 4) : "Unavailable" }}</td>
                <td>{{ formatFixed(result.mean, 4) }}</td>
                <td>{{ setupComparison.available ? formatSigned(setupComparison.mean.delta, 4) : "—" }}</td>
                <td>{{ setupComparison.available ? `Shifted ${setupComparison.mean.direction}` : "Comparison unavailable" }}</td>
              </tr>
              <tr data-setup-standard-deviation-comparison>
                <th scope="row">Standard deviation</th>
                <td>{{ setupSummary.available ? formatFixed(setupSummary.standardDeviation, 4) : "Unavailable" }}</td>
                <td>{{ formatFixed(result.standardDeviation, 4) }}</td>
                <td>{{ setupComparison.available ? `${formatSigned(setupComparison.standardDeviation.relativeChange * 100, 1)}%` : "—" }}</td>
                <td>{{ setupComparison.available ? `Spread is ${setupComparison.standardDeviation.direction}` : "Comparison unavailable" }}</td>
              </tr>
              <tr v-if="result.capability.status === 'available'">
                <th scope="row">Cp</th>
                <td>{{ setupCapability ? format(setupCapability.cp) : "Unavailable" }}</td>
                <td>{{ format(result.capability.cp) }}</td>
                <td>{{ setupCapability ? formatSigned(result.capability.cp - setupCapability.cp, 4) : "—" }}</td>
                <td>{{ setupCapability ? comparisonDirection(result.capability.cp - setupCapability.cp, true) : "Comparison unavailable" }}</td>
              </tr>
              <tr v-if="result.capability.status === 'available'">
                <th scope="row">Cpk</th>
                <td>{{ setupCapability ? format(setupCapability.cpk) : "Unavailable" }}</td>
                <td>{{ format(result.capability.cpk) }}</td>
                <td>{{ setupCapability ? formatSigned(result.capability.cpk - setupCapability.cpk, 4) : "—" }}</td>
                <td>{{ setupCapability ? (result.capability.targetStatus === "below_target" ? "Below target" : "Meets target") : "Comparison unavailable" }}</td>
              </tr>
              <tr v-if="result.normalModel.status === 'available'">
                <th scope="row">Yield</th>
                <td>Not independently estimated</td>
                <td>Fitted Normal {{ format(result.normalModel.expectedYield * 100) }}% · Empirical {{ format(result.yield * 100) }}%</td>
                <td>{{ formatSigned((result.yield - result.normalModel.expectedYield) * 100, 3) }} pp</td>
                <td>Expected model vs observed simulation</td>
              </tr>
              <tr v-if="result.normalModel.status === 'available'">
                <th scope="row">Defect rate</th>
                <td>Not independently estimated</td>
                <td>Fitted Normal {{ format(result.normalModel.totalDpm) }} PPM · Empirical {{ format(result.ppm) }} PPM</td>
                <td>{{ formatSigned(result.ppm - result.normalModel.totalDpm, 0) }}</td>
                <td>Lower is better</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl class="ta-run-metadata">
          <div><dt>Iterations</dt><dd>{{ result.iterations.toLocaleString() }}</dd></div>
          <div><dt>Median</dt><dd>{{ format(result.quantiles.p50) }}</dd></div>
          <div><dt>LSL / USL</dt><dd>{{ format(result.lowerSpecLimit) }} / {{ format(result.upperSpecLimit) }}</dd></div>
          <div><dt>Target σ / Cpk</dt><dd>{{ format(result.targetSigmaLevel) }} / {{ format(result.capability.targetCpk) }}</dd></div>
          <div><dt>Run seed</dt><dd>{{ displayedSeed(result.runSeed) }}</dd></div>
        </dl>
      </section>
    </section>
  </section>
</template>
