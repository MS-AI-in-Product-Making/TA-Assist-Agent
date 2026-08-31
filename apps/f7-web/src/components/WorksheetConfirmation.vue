<script setup lang="ts">
import { computed, ref, type DeepReadonly } from "vue";
import { LoaderCircle } from "lucide-vue-next";
import type { F7SessionSnapshot } from "../api/f7-client";

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly busy: boolean;
}>();

const emit = defineEmits<{
  confirm: [worksheetName: string];
}>();

const selected = ref("");

const options = computed(() => {
  return props.session.worksheetOptions.map((item) => item.worksheetName);
});

const hasOptions = computed(() => options.value.length > 0);

function submit(): void {
  if (!hasOptions.value || !selected.value || props.busy) return;
  emit("confirm", selected.value);
}
</script>

<template>
  <section
    class="workbench-panel worksheet-confirmation"
    :class="{ 'worksheet-confirmation-busy': busy }"
    aria-label="Worksheet confirmation"
    :aria-busy="busy ? 'true' : 'false'"
  >
    <header class="worksheet-selection-header">
      <div>
        <h2>Worksheet Selection</h2>
        <p class="subtle">Select exactly one worksheet before factor setup.</p>
      </div>
      <button type="button" class="action-button" :disabled="busy || !hasOptions || !selected" @click="submit">
        <LoaderCircle v-if="busy" class="worksheet-analysis-spinner" :size="16" aria-hidden="true" />
        {{ busy ? "Analyzing worksheet…" : "Confirm selection" }}
      </button>
    </header>
    <div v-if="busy" class="worksheet-analysis-feedback">
      <div
        class="worksheet-analysis-progress"
        data-worksheet-analysis-progress
        role="progressbar"
        aria-label="Worksheet analysis in progress"
      ><span /></div>
      <p data-worksheet-analysis-status role="status" aria-live="polite">Analyzing worksheet…</p>
    </div>
    <fieldset class="worksheet-options-fieldset">
      <legend>Worksheet options</legend>
      <div class="worksheet-options-grid">
        <label v-for="option in options" :key="option" class="row-line">
          <input v-model="selected" type="radio" name="worksheet-option" :value="option" :disabled="busy">
          <span>{{ option }}</span>
        </label>
      </div>
      <p v-if="!hasOptions" class="subtle">No worksheet options available</p>
    </fieldset>
  </section>
</template>