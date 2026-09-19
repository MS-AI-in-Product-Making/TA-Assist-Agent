<script setup lang="ts">
import { CheckCircle2, Download, FileSpreadsheet, TriangleAlert, Upload, X } from "lucide-vue-next";
import { computed, nextTick, ref, watch, type DeepReadonly } from "vue";
import type { F7MeasurementImportPreviewResponse, F7SessionSnapshot } from "../api/f7-client";

type MeasurementEntryMode = "import" | "individual";
type MeasurementImportAction = "downloadMeasurementTemplate" | "previewMeasurementImport" | "commitMeasurementImport" | null;

type PreviewFactor = {
  readonly factorId: string;
  readonly factorName: string;
  readonly structure: string;
  readonly sampleCount: number;
  readonly status: "ready" | "blocked";
  readonly replacesExistingFactor: boolean;
  readonly rationalSubgroupConfig?: {
    readonly subgroupSize: number;
    readonly estimator: string;
  };
  readonly diagnostics: readonly {
    readonly factorName?: string;
    readonly sheetCell?: string;
    readonly displayMessage: string;
  }[];
  readonly warnings: readonly {
    readonly factorName?: string;
    readonly sheetCell?: string;
    readonly displayMessage: string;
  }[];
};

const props = withDefaults(defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly preview: DeepReadonly<F7MeasurementImportPreviewResponse> | null;
  readonly busy: boolean;
  readonly action: MeasurementImportAction;
  readonly mode: MeasurementEntryMode;
  readonly openRequest?: number;
  readonly successMessage: string | null;
}>(), {
  openRequest: 0,
});

const emit = defineEmits<{
  download: [];
  upload: [file: File];
  confirm: [];
  cancel: [];
  "close-import": [];
}>();

const fileInput = ref<HTMLInputElement>();
const reviewHeading = ref<globalThis.HTMLElement>();
const importDialogOpen = ref(props.preview !== null);
const closeDialogButton = ref<globalThis.HTMLButtonElement>();
const importDialog = ref<globalThis.HTMLElement>();

const factorCountLabel = computed(() => `${props.session.factors.length} Factor${props.session.factors.length === 1 ? "" : "s"}`);
const selectedWorksheetName = computed(() => props.session.selectedWorksheetNames[0] ?? "No worksheet selected");
const previewIsBlocked = computed(() => props.preview === null || props.preview.status === "blocked");
const confirmDisabled = computed(() => props.busy || props.preview === null || previewIsBlocked.value);
const reviewRows = computed<readonly PreviewFactor[]>(() => (props.preview?.factors ?? []) as readonly PreviewFactor[]);
const globalDiagnostics = computed(() => props.preview?.diagnostics.filter((diagnostic) => diagnostic.factorId === undefined) ?? []);

watch(() => props.preview?.previewId, async (nextPreviewId, previousPreviewId) => {
  if (!nextPreviewId || nextPreviewId === previousPreviewId) return;
  importDialogOpen.value = true;
  await nextTick();
  reviewHeading.value?.focus();
});

watch(() => props.successMessage, async (nextMessage, previousMessage) => {
  if (!nextMessage || nextMessage === previousMessage) return;
  importDialogOpen.value = false;
});

watch(() => props.openRequest, async (nextRequest, previousRequest) => {
  if (nextRequest === previousRequest || props.mode !== "import") return;
  importDialogOpen.value = true;
  await nextTick();
  closeDialogButton.value?.focus();
});

watch(() => props.mode, (mode) => {
  if (mode === "individual") importDialogOpen.value = false;
});

function openFilePicker(): void {
  if (props.busy) return;
  fileInput.value?.click();
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || props.busy) {
    input.value = "";
    return;
  }
  emit("upload", file);
  input.value = "";
}

function closeImportDialog(): void {
  if (props.busy) return;
  importDialogOpen.value = false;
  emit("close-import");
}

function trapImportDialogFocus(event: globalThis.KeyboardEvent): void {
  const focusable = [...(importDialog.value?.querySelectorAll<globalThis.HTMLElement>(
    "button:not(:disabled), input:not(:disabled):not([tabindex='-1'])",
  ) ?? [])];
  if (focusable.length === 0) {
    event.preventDefault();
    importDialog.value?.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && globalThis.document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && globalThis.document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function isCrossZeroWarning(displayMessage: string): boolean {
  return displayMessage.toLocaleLowerCase().includes("lsl is below 0");
}

function structureSummary(factor: PreviewFactor): string {
  if (factor.structure !== "RATIONAL_SUBGROUP" || !factor.rationalSubgroupConfig) return factor.structure;
  return `${factor.structure} · n=${factor.rationalSubgroupConfig.subgroupSize} · ${factor.rationalSubgroupConfig.estimator}`;
}

function replacementCopy(count: number): string {
  return `${count} replacement${count === 1 ? "" : "s"}`;
}
</script>

<template>
  <section class="workbench-panel measurement-import-panel" aria-label="Measurement input">
    <div
      v-if="!importDialogOpen"
      id="measurement-entry-import-panel"
      role="tabpanel"
      aria-labelledby="measurement-entry-import-tab"
      hidden
    />

    <div
      v-if="mode === 'import' && importDialogOpen"
      class="confirmation-backdrop"
      @click.self="closeImportDialog"
      @keydown.esc.prevent="closeImportDialog"
      @keydown.tab="trapImportDialogFocus"
    >
      <section
        ref="importDialog"
        class="confirmation-dialog measurement-import-dialog"
        data-measurement-import-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="measurement-import-dialog-title"
        tabindex="-1"
      >
        <div class="measurement-import-dialog-header">
          <div>
            <h2 id="measurement-import-dialog-title">Excel Bulk Import</h2>
            <p>Complete both steps using a template generated from the current Factor setup.</p>
          </div>
          <button
            ref="closeDialogButton"
            type="button"
            class="measurement-import-dialog-close"
            data-close-measurement-import
            aria-label="Close Excel bulk import"
            :disabled="busy"
            @click="closeImportDialog"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
        <div
          id="measurement-entry-import-panel"
          role="tabpanel"
          aria-labelledby="measurement-entry-import-tab"
          data-measurement-import-surface
        >
    <div class="measurement-import-toolbar">
      <div class="measurement-import-identity">
        <p><strong>{{ session.workbook.fileName }}</strong></p>
        <p class="subtle">{{ selectedWorksheetName }} · {{ factorCountLabel }}</p>
      </div>
      <div class="measurement-import-actions">
        <div class="measurement-import-step">
          <strong>Step 1</strong>
          <span>Download the template generated from the current Factors.</span>
          <button
            type="button"
            class="measurement-import-action-button"
            data-download-measurement-template
            aria-label="Download measurement template"
            title="Download measurement template"
            :disabled="busy"
            @click="emit('download')"
          >
            <Download :size="16" aria-hidden="true" />
            <span>Download Template</span>
          </button>
        </div>
        <div class="measurement-import-step is-ready">
          <strong>Step 2</strong>
          <span>Upload a completed .xlsx based on the Step 1 template.</span>
          <button
            type="button"
            class="measurement-import-action-button"
            data-upload-measurement-workbook
            aria-label="Upload completed measurement workbook"
            title="Upload completed measurement workbook"
            :disabled="busy"
            @click="openFilePicker"
          >
            <Upload :size="16" aria-hidden="true" />
            <span>Upload Completed File</span>
          </button>
        </div>
        <input
          ref="fileInput"
          data-measurement-import-file
          type="file"
          class="sr-only"
          tabindex="-1"
          accept=".xlsx"
          :disabled="busy"
          @change="onFileChange"
        >
      </div>
    </div>

    <div class="measurement-import-meta subtle">
      <span><FileSpreadsheet :size="15" aria-hidden="true" /> Completed workbook import supports .xlsx only.</span>
      <span v-if="action === 'previewMeasurementImport'">Uploading workbook for preview…</span>
      <span v-else-if="action === 'downloadMeasurementTemplate'">Preparing download…</span>
      <span v-else-if="action === 'commitMeasurementImport'">Committing measured datasets…</span>
    </div>

    <p v-if="successMessage" class="measurement-import-success" data-measurement-import-success role="status" aria-live="polite">
      <CheckCircle2 :size="16" aria-hidden="true" />
      <span>{{ successMessage }}</span>
    </p>

    <section v-if="preview" class="measurement-import-review" data-measurement-import-review="" aria-label="Measurement import preview review">
      <div class="measurement-import-review-heading-row">
        <h2
          ref="reviewHeading"
          data-measurement-import-review-heading
          tabindex="-1"
          class="measurement-import-review-heading"
        >
          Review import preview
        </h2>
        <p class="subtle">
          {{ preview.factorCount }} factor{{ preview.factorCount === 1 ? '' : 's' }} ·
          {{ preview.readyFactorCount }} ready ·
          {{ preview.blockedFactorCount }} blocked ·
          {{ replacementCopy(preview.replacementCount) }}
        </p>
      </div>

      <div class="measurement-import-review-list">
        <article v-for="factor in reviewRows" :key="factor.factorId" class="measurement-import-factor-row">
          <div class="measurement-import-factor-header">
            <h3>{{ factor.factorName }}</h3>
            <span class="status-chip" :class="factor.status === 'ready' ? 'chip-ready' : 'chip-pending'">{{ factor.status }}</span>
          </div>
          <dl class="measurement-import-factor-metrics">
            <div>
              <dt>Samples</dt>
              <dd>{{ factor.sampleCount }}</dd>
            </div>
            <div>
              <dt>Structure</dt>
              <dd>{{ structureSummary(factor) }}</dd>
            </div>
            <div>
              <dt>Replacement</dt>
              <dd>{{ factor.replacesExistingFactor ? 'Replaces existing factor' : 'New measured dataset' }}</dd>
            </div>
          </dl>

          <p
            v-for="warning in factor.warnings"
            :key="`${factor.factorId}-${warning.displayMessage}-${warning.sheetCell ?? ''}`"
            class="measurement-import-warning is-danger"
            :data-import-warning="isCrossZeroWarning(warning.displayMessage) ? 'cross-zero' : 'advisory'"
          >
            <TriangleAlert :size="16" aria-hidden="true" />
            <span>
              <strong>{{ warning.factorName ?? factor.factorName }}</strong>
              <span v-if="warning.sheetCell"> {{ warning.sheetCell }}</span>
              <span v-if="isCrossZeroWarning(warning.displayMessage)"> Factor LSL is below 0. Review Factor Setup.</span>
              <span v-else> {{ warning.displayMessage }}</span>
            </span>
          </p>

          <ul v-if="factor.diagnostics.length > 0" class="measurement-import-diagnostics">
            <li
              v-for="diagnostic in factor.diagnostics"
              :key="`${factor.factorId}-${diagnostic.displayMessage}-${diagnostic.sheetCell ?? ''}`"
              class="is-danger"
              data-import-diagnostic="blocking"
            >
              <TriangleAlert :size="16" aria-hidden="true" />
              <span>
                <strong>{{ diagnostic.factorName ?? factor.factorName }}</strong>
                <span v-if="diagnostic.sheetCell"> {{ diagnostic.sheetCell }}</span>
                <span> {{ diagnostic.displayMessage }}</span>
              </span>
            </li>
          </ul>
        </article>
      </div>

      <ul v-if="globalDiagnostics.length > 0" class="measurement-import-diagnostics measurement-import-diagnostics-global">
        <li
          v-for="diagnostic in globalDiagnostics"
          :key="`${diagnostic.displayMessage}-${diagnostic.sheetCell ?? ''}`"
          class="is-danger"
          data-import-diagnostic="blocking"
        >
          <TriangleAlert :size="16" aria-hidden="true" />
          <span>
            <strong>{{ diagnostic.factorName ?? 'Import diagnostic' }}</strong>
            <span v-if="diagnostic.sheetCell"> {{ diagnostic.sheetCell }}</span>
            <span> {{ diagnostic.displayMessage }}</span>
          </span>
        </li>
      </ul>

      <div class="measurement-import-footer">
        <button
          type="button"
          class="confirmation-cancel"
          data-cancel-measurement-import
          :disabled="busy"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="action-button"
          data-confirm-measurement-import
          :disabled="confirmDisabled"
          @click="emit('confirm')"
        >
          Confirm import · {{ replacementCopy(preview.replacementCount) }}
        </button>
      </div>
    </section>
        </div>
      </section>
    </div>
  </section>
</template>