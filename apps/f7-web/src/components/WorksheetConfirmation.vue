<script setup lang="ts">
import { computed, ref, type DeepReadonly } from "vue";
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
  <section class="workbench-panel" aria-label="Worksheet confirmation">
    <h2>Worksheet Selection</h2>
    <p class="subtle">Select exactly one worksheet before factor setup.</p>
    <fieldset>
      <legend>Worksheet options</legend>
      <label v-for="option in options" :key="option" class="row-line">
        <input v-model="selected" type="radio" name="worksheet-option" :value="option">
        <span>{{ option }}</span>
      </label>
      <p v-if="!hasOptions" class="subtle">No worksheet options available</p>
    </fieldset>
    <button type="button" class="action-button" :disabled="busy || !hasOptions || !selected" @click="submit">
      Confirm worksheet
    </button>
  </section>
</template>