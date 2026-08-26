<script setup lang="ts">
import { computed, reactive, type DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import MonteCarloHistogram from "./MonteCarloHistogram.vue";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly busy: boolean;
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
  openReport: [];
  close: [];
}>();

function initialSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function initialEvidenceValue(field: "lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel"): string {
  const evidence = props.session.systemSpecification?.[field];
  return evidence?.status === "available" ? String(evidence.actualValue) : "";
}

const form = reactive({
  lowerSpecLimit: initialEvidenceValue("lowerSpecLimit"),
  upperSpecLimit: initialEvidenceValue("upperSpecLimit"),
  targetSigmaLevel: initialEvidenceValue("targetSigmaLevel"),
  iterations: 100_000 as 10_000 | 100_000,
  runSeed: initialSeed(),
});

const limitsValid = computed(() => {
  if (form.lowerSpecLimit.trim() === "" || form.upperSpecLimit.trim() === "") return false;
  const lower = Number(form.lowerSpecLimit);
  const upper = Number(form.upperSpecLimit);
  return Number.isFinite(lower) && Number.isFinite(upper) && lower < upper;
});
const seedValid = computed(() => /^[a-f0-9]{64}$/.test(form.runSeed));
const targetSigmaValid = computed(() => form.targetSigmaLevel.trim() !== ""
  && Number.isFinite(Number(form.targetSigmaLevel))
  && Number(form.targetSigmaLevel) > 0);
const canRun = computed(() => limitsValid.value && targetSigmaValid.value && seedValid.value && !props.busy);
const result = computed(() => props.session.monteCarloResult);

function sourceCell(field: "lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel"): string | undefined {
  const evidence = props.session.systemSpecification?.[field];
  return evidence?.status === "available" ? evidence.sourceCell : undefined;
}

function valueStatus(field: "lowerSpecLimit" | "upperSpecLimit" | "targetSigmaLevel", value: string): string {
  const evidence = props.session.systemSpecification?.[field];
  if (evidence?.status !== "available") return "Manual entry";
  return Number(value) === evidence.actualValue ? "Excel default" : "Override";
}

function submit(): void {
  if (!canRun.value) return;
  emit("run", {
    lowerSpecLimit: Number(form.lowerSpecLimit),
    upperSpecLimit: Number(form.upperSpecLimit),
    targetSigmaLevel: Number(form.targetSigmaLevel),
    iterations: form.iterations,
    runSeed: form.runSeed,
    correlationMode: "INDEPENDENT",
  });
}

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
      <button type="button" class="workspace-close-button" @click="emit('close')">Back to factors</button>
    </header>

    <form class="monte-carlo-form" @submit.prevent="submit">
      <label>
        System LSL
        <input v-model="form.lowerSpecLimit" data-monte-carlo-lsl inputmode="decimal" required>
        <small data-monte-carlo-lsl-source>{{ sourceCell("lowerSpecLimit") ?? "No Excel source" }}</small>
        <small>{{ valueStatus("lowerSpecLimit", form.lowerSpecLimit) }}</small>
      </label>
      <label>
        System USL
        <input v-model="form.upperSpecLimit" data-monte-carlo-usl inputmode="decimal" required>
        <small data-monte-carlo-usl-source>{{ sourceCell("upperSpecLimit") ?? "No Excel source" }}</small>
        <small>{{ valueStatus("upperSpecLimit", form.upperSpecLimit) }}</small>
      </label>
      <label>
        Target Sigma Level
        <input v-model="form.targetSigmaLevel" data-monte-carlo-target-sigma inputmode="decimal" required>
        <small data-monte-carlo-target-sigma-source>{{ sourceCell("targetSigmaLevel") ?? "No Excel source" }}</small>
        <small data-monte-carlo-target-sigma-status>{{ valueStatus("targetSigmaLevel", form.targetSigmaLevel) }}</small>
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
        <input v-model.trim="form.runSeed" data-monte-carlo-seed pattern="[a-f0-9]{64}" required>
      </label>
      <p class="subtle correlation-note">Correlation mode: Independent factors</p>
      <button type="submit" class="action-button" data-run-monte-carlo :disabled="!canRun">
        {{ busy ? "Running simulation..." : "Run simulation" }}
      </button>
    </form>

    <section v-if="result" class="monte-carlo-results" data-monte-carlo-results aria-live="polite">
      <p class="workspace-eyebrow">Governed result</p>
      <h3>{{ format(result.yield * 100) }}% predicted yield</h3>
      <MonteCarloHistogram :result="result" />
      <h4>Process Outputs</h4>
      <dl class="result-metrics">
        <div><dt>Iterations</dt><dd>{{ result.iterations.toLocaleString() }}</dd></div>
        <div><dt>Mean</dt><dd>{{ format(result.mean) }}</dd></div>
        <div><dt>Std. deviation</dt><dd>{{ format(result.standardDeviation) }}</dd></div>
        <div><dt>Median</dt><dd>{{ format(result.quantiles.p50) }}</dd></div>
        <div><dt>LSL</dt><dd>{{ format(result.lowerSpecLimit) }}</dd></div>
        <div><dt>USL</dt><dd>{{ format(result.upperSpecLimit) }}</dd></div>
        <div><dt>Target Sigma</dt><dd>{{ format(result.targetSigmaLevel) }}</dd></div>
      </dl>
      <h4>Normal Model Statistics</h4>
      <dl class="result-metrics" data-normal-model-statistics>
        <template v-if="result.normalModel.status === 'available'">
          <div><dt>Expected DPM</dt><dd>{{ format(result.normalModel.totalDpm) }}</dd></div>
          <div><dt>Expected yield</dt><dd>{{ format(result.normalModel.expectedYield * 100) }}%</dd></div>
        </template>
        <div v-if="result.capability.status === 'available'"><dt>Cp</dt><dd>{{ format(result.capability.cp) }}</dd></div>
        <div v-if="result.capability.status === 'available'"><dt>Cpk</dt><dd>{{ format(result.capability.cpk) }}</dd></div>
        <div><dt>Target Cpk</dt><dd>{{ format(result.capability.targetCpk) }}</dd></div>
      </dl>
      <h4>Observed Defect Statistics</h4>
      <dl class="result-metrics" data-observed-defect-statistics>
        <div><dt>Out-of-spec count</dt><dd>{{ result.outOfSpecCount.toLocaleString() }}</dd></div>
        <div><dt>Observed PPM</dt><dd>{{ format(result.ppm) }}</dd></div>
        <div><dt>Observed yield</dt><dd>{{ format(result.yield * 100) }}%</dd></div>
      </dl>
      <p class="subtle">{{ result.iterations.toLocaleString() }} iterations · seed {{ result.runSeed }}</p>
      <button
        type="button"
        class="action-button"
        data-open-report
        :disabled="busy"
        @click="emit('openReport')"
      >
        {{ busy ? "Generating report..." : "Open report" }}
      </button>
    </section>
  </section>
</template>
