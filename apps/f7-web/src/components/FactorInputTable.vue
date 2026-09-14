<script setup lang="ts">
/* global PointerEvent, window */
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch, type DeepReadonly } from "vue";
import { ArrowLeftRight, ArrowRightLeft } from "lucide-vue-next";
import { calculateToleranceAnalysis, type KernelCalculationResult } from "@ai-assist/workbook-catalog/calculation-kernel";
import type { Distribution } from "@ai-assist/contracts";
import type { F7FactorState, F7SessionSnapshot, F7SetupDistribution, F7SourceMode, F7SystemSpecificationInput } from "../api/f7-client";
import {
  buildConfirmedEngineeringEvidence,
  type AssumptionResultsEngineeringEvidence,
  type AssumptionResultsCurrentCalculationInput,
  type DimensionChainReportProjection,
} from "../assumption-results-pdf-evidence";
import DimensionChainPanel from "./DimensionChainPanel.vue";
import ResponseDistributionCurve from "./ResponseDistributionCurve.vue";
import type { DimensionChainFactor } from "./dimension-chain";

const DISTRIBUTION_OPTIONS: readonly F7SetupDistribution[] = [
  "Normal",
  "Uniform",
  "Triangular",
  "Trapezoidal",
  "Elliptical",
  "Beta",
];

const F4_DISTRIBUTION_BY_LABEL: Readonly<Record<F7SetupDistribution, Distribution>> = {
  Normal: "normal",
  Uniform: "uniform",
  Triangular: "triangular",
  Trapezoidal: "trapezoidal",
  Elliptical: "elliptical",
  Beta: "beta",
};

const props = defineProps<{
  readonly session: DeepReadonly<F7SessionSnapshot>;
  readonly busy: boolean;
  readonly editingSetup: boolean;
}>();

const emit = defineEmits<{
  confirmFactors: [
    confirmations: ReadonlyArray<{
      readonly factorCandidateId: string;
      readonly designNominal: number;
      readonly upperTolerance: number;
      readonly lowerTolerance: number;
      readonly longTermSafetyFactor: number;
      readonly sigmaLevel: number;
      readonly distribution: F7SetupDistribution;
      readonly factorName?: string;
      readonly userAdded?: true;
    }>,
    systemSpecification: F7SystemSpecificationInput,
  ];
  editSetup: [];
  setMode: [factorId: string, mode: F7SourceMode];
  openMeasurement: [factorId: string];
  "engineering-evidence-change": [evidence: AssumptionResultsEngineeringEvidence | undefined];
}>();

interface FactorSpecificationDraft {
  designNominal: number | "";
  upperTolerance: number | "";
  lowerTolerance: number | "";
  longTermSafetyFactor: number | "";
  sigmaLevel: number | "";
  distribution: F7SetupDistribution | "";
}

interface CompleteFactorSpecificationDraft {
  designNominal: number;
  upperTolerance: number;
  lowerTolerance: number;
  longTermSafetyFactor: number;
  sigmaLevel: number;
  distribution: F7SetupDistribution;
}

type FactorSpecificationField = keyof FactorSpecificationDraft;

interface SystemSpecificationDraft {
  lowerSpecLimit: number | "";
  upperSpecLimit: number | "";
  targetSigmaLevel: number | "";
}

const DEFAULT_TARGET_SIGMA_LEVEL = 3;

function importedSystemSpecificationDraft(): SystemSpecificationDraft {
  const specification = props.session.systemSpecification;
  return specification?.status === "available"
    ? {
        lowerSpecLimit: specification.lowerSpecLimit.status === "available"
          ? specification.lowerSpecLimit.actualValue
          : "",
        upperSpecLimit: specification.upperSpecLimit.status === "available"
          ? specification.upperSpecLimit.actualValue
          : "",
        targetSigmaLevel: specification.targetSigmaLevel.status === "available"
          ? specification.targetSigmaLevel.actualValue
          : DEFAULT_TARGET_SIGMA_LEVEL,
      }
    : {
        lowerSpecLimit: "",
        upperSpecLimit: "",
        targetSigmaLevel: DEFAULT_TARGET_SIGMA_LEVEL,
      };
}

const setupDraft = reactive<Record<string, FactorSpecificationDraft>>({});
const systemSpecificationDraft = reactive<SystemSpecificationDraft>(importedSystemSpecificationDraft());
const factorNames = reactive<Record<string, string>>({});
const removedFactorIds = reactive(new Set<string>());
const addedFactors = reactive<F7FactorState[]>([]);
const factorOrder = reactive(props.session.factors.map((factor) => factor.factorCandidate.factorCandidateId));
const dimensionChainResetRevision = ref(0);
let addedFactorSequence = 0;
const setupEditable = computed(() => props.editingSetup);

const activeFactors = computed(() => {
  if (!setupEditable.value) return props.session.factors;
  const factorsById = new Map(
    [...props.session.factors, ...addedFactors].map((factor) => [factor.factorCandidate.factorCandidateId, factor]),
  );
  return factorOrder.flatMap((factorId) => {
    const factor = factorsById.get(factorId);
    return factor && !removedFactorIds.has(factorId) ? [factor] : [];
  });
});

const baseColumns = [
  { key: "index", label: "Item", lines: ["Item"], defaultWidth: 64, minWidth: 58 },
  { key: "factor", label: "Factor", lines: ["Factor"], defaultWidth: 150, minWidth: 105 },
  { key: "designNominal", label: "Design Nominal", lines: ["Design", "Nominal"], defaultWidth: 88, minWidth: 78 },
  { key: "upperTolerance", label: "+ Tolerance", lines: ["+", "Tol"], defaultWidth: 72, minWidth: 66 },
  { key: "lowerTolerance", label: "- Tolerance", lines: ["-", "Tol"], defaultWidth: 72, minWidth: 66 },
  { key: "longTermSafetyFactor", label: "Long Term/Safety Factor", lines: ["Long Term/", "Safety Factor"], defaultWidth: 96, minWidth: 88 },
  { key: "sigmaLevel", label: "σ Level", lines: ["σ", "Level"], defaultWidth: 58, minWidth: 54 },
  { key: "distribution", label: "Distribution", lines: ["Distribution"], defaultWidth: 88, minWidth: 80 },
  { key: "mean", label: "Mean", lines: ["Mean"], defaultWidth: 68, minWidth: 62 },
  { key: "tolerance", label: "Tolerance", lines: ["Tolerance"], defaultWidth: 72, minWidth: 66 },
  { key: "oneSigma", label: "1σ", lines: ["1σ"], defaultWidth: 60, minWidth: 56 },
  { key: "contribution", label: "% Cont. to σ", lines: ["% Cont. to σ"], defaultWidth: 80, minWidth: 72 },
  { key: "sourceMode", label: "Source Mode", lines: ["Source Mode"], defaultWidth: 250, minWidth: 220 },
  { key: "sampleCount", label: "Sample Count", lines: ["Sample Count"], defaultWidth: 70, minWidth: 64 },
  { key: "readiness", label: "Readiness", lines: ["Readiness"], defaultWidth: 72, minWidth: 68 },
] as const;

const visibleColumns = computed(() => [...baseColumns]);
const columnWidths = reactive<Record<string, number>>(Object.fromEntries(
  baseColumns.map((column) => [column.key, column.defaultWidth]),
));
const tableWidth = computed(() => visibleColumns.value.reduce(
  (total, column) => total + columnWidths[column.key]!,
  0,
));

let resizeState: { readonly key: string; readonly startX: number; readonly startWidth: number; readonly minWidth: number } | undefined;

function onColumnPointerMove(event: PointerEvent): void {
  if (!resizeState) return;
  columnWidths[resizeState.key] = Math.max(
    resizeState.minWidth,
    resizeState.startWidth + event.clientX - resizeState.startX,
  );
}

function stopColumnResize(): void {
  resizeState = undefined;
  window.removeEventListener("pointermove", onColumnPointerMove);
  window.removeEventListener("pointerup", stopColumnResize);
}

function startColumnResize(column: typeof baseColumns[number], event: PointerEvent): void {
  event.preventDefault();
  resizeState = {
    key: column.key,
    startX: event.clientX,
    startWidth: columnWidths[column.key]!,
    minWidth: column.minWidth,
  };
  window.addEventListener("pointermove", onColumnPointerMove);
  window.addEventListener("pointerup", stopColumnResize);
}

function resetColumnWidth(column: typeof baseColumns[number]): void {
  columnWidths[column.key] = column.defaultWidth;
}

onBeforeUnmount(stopColumnResize);

function factorNameFor(factor: DeepReadonly<F7FactorState>): string {
  return factorNames[factor.factorCandidate.factorCandidateId] ?? factor.factorCandidate.factorName;
}

function isUserAdded(factor: DeepReadonly<F7FactorState>): boolean {
  return factor.factorCandidate.userAdded === true;
}

function nextUserFactorId(): string {
  addedFactorSequence += 1;
  return `${props.session.workbook.workbookContentHash.slice(0, 56)}${addedFactorSequence.toString(16).padStart(8, "0")}`;
}

function addFactor(afterFactor?: DeepReadonly<F7FactorState>): void {
  const factorCandidateId = nextUserFactorId();
  const sourceRow = Math.max(0, ...activeFactors.value.map((factor) => factor.factorCandidate.sourceRow)) + 1;
  factorNames[factorCandidateId] = "";
  setupDraft[factorCandidateId] = {
    designNominal: "",
    upperTolerance: "",
    lowerTolerance: "",
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
  };
  addedFactors.push({
    factorCandidate: {
      workbookContentHash: props.session.workbook.workbookContentHash,
      worksheetName: props.session.selectedWorksheetNames[0] ?? "User Added",
      tableId: "user-added-factors",
      sourceRow,
      sourceCells: {},
      factorCandidateId,
      factorName: "New factor",
      userAdded: true,
      excelSignedMean: 1,
      designNominal: 1,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      standardDeviation: 0.025,
      distribution: "Normal",
      lowerSpecLimit: 0.9,
      upperSpecLimit: 1.1,
    },
  });
  const afterIndex = afterFactor
    ? factorOrder.indexOf(afterFactor.factorCandidate.factorCandidateId)
    : factorOrder.length - 1;
  factorOrder.splice(afterIndex + 1, 0, factorCandidateId);
}

function removeFactor(factor: DeepReadonly<F7FactorState>): void {
  const candidateId = factor.factorCandidate.factorCandidateId;
  const addedIndex = addedFactors.findIndex((item) => item.factorCandidate.factorCandidateId === candidateId);
  if (addedIndex >= 0) addedFactors.splice(addedIndex, 1);
  else removedFactorIds.add(candidateId);
  const orderIndex = factorOrder.indexOf(candidateId);
  if (orderIndex >= 0) factorOrder.splice(orderIndex, 1);
  delete setupDraft[candidateId];
  delete factorNames[candidateId];
}

function moveFactor(factor: DeepReadonly<F7FactorState>, offset: -1 | 1): void {
  const currentIndex = factorOrder.indexOf(factor.factorCandidate.factorCandidateId);
  const nextIndex = currentIndex + offset;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= factorOrder.length) return;
  const [factorId] = factorOrder.splice(currentIndex, 1);
  if (factorId) factorOrder.splice(nextIndex, 0, factorId);
}

function draftFor(
  candidateId: string,
  defaults: FactorSpecificationDraft,
): FactorSpecificationDraft {
  if (!setupDraft[candidateId]) {
    setupDraft[candidateId] = { ...defaults };
  }
  return setupDraft[candidateId]!;
}

function candidateDraft(factor: DeepReadonly<F7SessionSnapshot["factors"][number]>): FactorSpecificationDraft {
  return draftFor(factor.factorCandidate.factorCandidateId, {
    designNominal: factor.setup?.designNominal ?? factor.factorCandidate.designNominal,
    upperTolerance: factor.setup?.upperTolerance ?? factor.factorCandidate.upperTolerance,
    lowerTolerance: factor.setup?.lowerTolerance ?? factor.factorCandidate.lowerTolerance,
    longTermSafetyFactor: factor.setup?.longTermSafetyFactor ?? factor.evidence?.longTermSafetyFactor ?? factor.factorCandidate.longTermSafetyFactor ?? 1,
    sigmaLevel: factor.setup?.sigmaLevel ?? factor.evidence?.sigmaLevel ?? factor.factorCandidate.sigmaLevel ?? 4,
    distribution: factor.setup?.distribution ?? factor.evidence?.distribution ?? factor.factorCandidate.distribution,
  });
}

interface FactorEditSnapshot {
  readonly order: readonly string[];
  readonly removedFactorIds: readonly string[];
  readonly addedFactors: readonly F7FactorState[];
  readonly drafts: Readonly<Record<string, FactorSpecificationDraft>>;
  readonly names: Readonly<Record<string, string>>;
  readonly systemSpecification: SystemSpecificationDraft;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

for (const factor of props.session.factors) candidateDraft(factor);

function captureEditSnapshot(): FactorEditSnapshot {
  return cloneValue({
    order: [...factorOrder],
    removedFactorIds: [...removedFactorIds],
    addedFactors: [...addedFactors],
    drafts: { ...setupDraft },
    names: { ...factorNames },
    systemSpecification: { ...systemSpecificationDraft },
  });
}

function importedSnapshot(): FactorEditSnapshot {
  const importedFactors = props.session.factors.filter((factor) => !isUserAdded(factor));
  return {
    order: importedFactors.map((factor) => factor.factorCandidate.factorCandidateId),
    removedFactorIds: [],
    addedFactors: [],
    drafts: Object.fromEntries(importedFactors.map((factor) => [
      factor.factorCandidate.factorCandidateId,
      {
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        longTermSafetyFactor: factor.factorCandidate.longTermSafetyFactor ?? 1,
        sigmaLevel: factor.factorCandidate.sigmaLevel ?? 4,
        distribution: factor.factorCandidate.distribution,
      } satisfies FactorSpecificationDraft,
    ])),
    names: {},
    systemSpecification: importedSystemSpecificationDraft(),
  };
}

function replaceRecord<T>(target: Record<string, T>, source: Readonly<Record<string, T>>): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, cloneValue(source));
}

function restoreEditSnapshot(snapshot: FactorEditSnapshot): void {
  factorOrder.splice(0, factorOrder.length, ...snapshot.order);
  removedFactorIds.clear();
  for (const factorId of snapshot.removedFactorIds) removedFactorIds.add(factorId);
  addedFactors.splice(0, addedFactors.length, ...cloneValue(snapshot.addedFactors));
  replaceRecord(setupDraft, snapshot.drafts);
  replaceRecord(factorNames, snapshot.names);
  Object.assign(systemSpecificationDraft, cloneValue(snapshot.systemSpecification));
}

const undoStack = ref<FactorEditSnapshot[]>([]);
const redoStack = ref<FactorEditSnapshot[]>([]);
let applyingHistory = false;
const editSnapshotKey = computed(() => JSON.stringify(captureEditSnapshot()));

watch(editSnapshotKey, (_current, previous) => {
  if (applyingHistory || previous === undefined) return;
  undoStack.value.push(JSON.parse(previous) as FactorEditSnapshot);
  redoStack.value = [];
}, { flush: "post" });

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);
const canReverseFactors = computed(() => activeFactors.value.some((factor) => {
  const value = candidateDraft(factor).designNominal;
  return typeof value === "number" && Number.isFinite(value) && value !== 0;
}));

function applyFactorSigns(changes: readonly { factorId: string; sign: 1 | -1 }[]): void {
  if (!setupEditable.value || props.busy) return;
  const signs = new Map(changes.map((change) => [change.factorId, change.sign]));
  for (const factor of activeFactors.value) {
    const sign = signs.get(factor.factorCandidate.factorCandidateId);
    const draft = candidateDraft(factor);
    if (sign && typeof draft.designNominal === "number" && Number.isFinite(draft.designNominal) && draft.designNominal !== 0) {
      draft.designNominal = Math.abs(draft.designNominal) * sign;
    }
  }
}

function reverseAllFactors(): void {
  if (!setupEditable.value || props.busy) return;
  applyFactorSigns(activeFactors.value.flatMap((factor) => {
    const value = candidateDraft(factor).designNominal;
    return typeof value === "number" && Number.isFinite(value) && value !== 0
      ? [{ factorId: factor.factorCandidate.factorCandidateId, sign: (value > 0 ? -1 : 1) as 1 | -1 }]
      : [];
  }));
  const { lowerSpecLimit, upperSpecLimit } = systemSpecificationDraft;
  if (
    typeof lowerSpecLimit === "number"
    && Number.isFinite(lowerSpecLimit)
    && typeof upperSpecLimit === "number"
    && Number.isFinite(upperSpecLimit)
  ) {
    systemSpecificationDraft.lowerSpecLimit = -upperSpecLimit;
    systemSpecificationDraft.upperSpecLimit = -lowerSpecLimit;
  }
}

function toggleFactorSign(factor: DeepReadonly<F7FactorState>): void {
  const draft = candidateDraft(factor);
  if (typeof draft.designNominal === "number" && Number.isFinite(draft.designNominal) && draft.designNominal !== 0) {
    draft.designNominal = -draft.designNominal;
  }
}

function applyHistorySnapshot(snapshot: FactorEditSnapshot): void {
  applyingHistory = true;
  restoreEditSnapshot(snapshot);
  void nextTick(() => {
    applyingHistory = false;
  });
}

function undoEdit(): void {
  const snapshot = undoStack.value.pop();
  if (!snapshot) return;
  redoStack.value.push(captureEditSnapshot());
  applyHistorySnapshot(snapshot);
}

function redoEdit(): void {
  const snapshot = redoStack.value.pop();
  if (!snapshot) return;
  undoStack.value.push(captureEditSnapshot());
  applyHistorySnapshot(snapshot);
}

function resetImportedFactors(): void {
  restoreEditSnapshot(importedSnapshot());
}

function clearAllFactors(): void {
  if (!window.confirm("Clear all Factor rows and reset the System Specification? You can undo this action.")) return;
  factorOrder.splice(0, factorOrder.length);
  removedFactorIds.clear();
  for (const factor of props.session.factors) {
    removedFactorIds.add(factor.factorCandidate.factorCandidateId);
  }
  addedFactors.splice(0, addedFactors.length);
  replaceRecord(setupDraft, {});
  replaceRecord(factorNames, {});
  Object.assign(systemSpecificationDraft, {
    lowerSpecLimit: "",
    upperSpecLimit: "",
    targetSigmaLevel: DEFAULT_TARGET_SIGMA_LEVEL,
  });
  dimensionChainResetRevision.value += 1;
  addFactor();
}

function specificationErrors(draft: FactorSpecificationDraft): Partial<Record<FactorSpecificationField, string>> {
  const errors: Partial<Record<FactorSpecificationField, string>> = {};
  if (typeof draft.designNominal !== "number" || !Number.isFinite(draft.designNominal)) {
    errors.designNominal = "Design Nominal must be a finite number.";
  }
  if (typeof draft.upperTolerance !== "number" || !Number.isFinite(draft.upperTolerance)) {
    errors.upperTolerance = "+Tolerance must be a finite number.";
  } else if (draft.upperTolerance < 0) {
    errors.upperTolerance = "+Tolerance must be non-negative.";
  }
  if (typeof draft.lowerTolerance !== "number" || !Number.isFinite(draft.lowerTolerance)) {
    errors.lowerTolerance = "-Tolerance must be a finite number.";
  } else if (draft.lowerTolerance > 0) {
    errors.lowerTolerance = "-Tolerance must be non-positive.";
  }
  if (
    typeof draft.lowerTolerance === "number"
    && Number.isFinite(draft.lowerTolerance)
    && typeof draft.upperTolerance === "number"
    && Number.isFinite(draft.upperTolerance)
    && draft.lowerTolerance >= draft.upperTolerance
  ) {
    errors.lowerTolerance = "-Tolerance must be less than +Tolerance.";
  }
  if (typeof draft.longTermSafetyFactor !== "number" || !Number.isFinite(draft.longTermSafetyFactor) || draft.longTermSafetyFactor <= 0) {
    errors.longTermSafetyFactor = "Long Term/Safety Factor must be positive.";
  }
  if (typeof draft.sigmaLevel !== "number" || !Number.isFinite(draft.sigmaLevel) || draft.sigmaLevel <= 0) {
    errors.sigmaLevel = "σ Level must be positive.";
  }
  if (!DISTRIBUTION_OPTIONS.includes(draft.distribution as F7SetupDistribution)) errors.distribution = "Distribution is required.";
  return errors;
}

function specificationFieldError(draft: FactorSpecificationDraft, field: FactorSpecificationField): string {
  return specificationErrors(draft)[field] ?? "";
}

function specificationError(draft: FactorSpecificationDraft): string {
  return Object.values(specificationErrors(draft))[0] ?? "";
}

function isCompleteSpecification(draft: FactorSpecificationDraft): draft is CompleteFactorSpecificationDraft {
  return specificationError(draft) === "";
}

function isBlankSpecification(draft: FactorSpecificationDraft): boolean {
  return draft.designNominal === ""
    && draft.upperTolerance === ""
    && draft.lowerTolerance === "";
}

function completeSystemSpecification(): F7SystemSpecificationInput | undefined {
  const { lowerSpecLimit, upperSpecLimit, targetSigmaLevel } = systemSpecificationDraft;
  if (typeof lowerSpecLimit !== "number" || !Number.isFinite(lowerSpecLimit)
    || typeof upperSpecLimit !== "number" || !Number.isFinite(upperSpecLimit)
    || lowerSpecLimit >= upperSpecLimit
    || typeof targetSigmaLevel !== "number" || !Number.isFinite(targetSigmaLevel)
    || targetSigmaLevel <= 0) return undefined;
  return { lowerSpecLimit, upperSpecLimit, targetSigmaLevel };
}

const setupIsValid = computed(() => completeSystemSpecification() !== undefined
  && activeFactors.value.length > 0
  && activeFactors.value.every((factor) => (
    factorNameFor(factor).trim().length > 0 && specificationError(candidateDraft(factor)) === ""
  )));

const dimensionChainFactors = computed<DimensionChainFactor[]>(() => activeFactors.value.map((factor, index) => {
  const draft = candidateDraft(factor);
  return {
    id: factor.factorCandidate.factorCandidateId,
    itemNumber: index + 1,
    name: factorNameFor(factor).trim(),
    designNominal: numericDraftValue(draft.designNominal),
    upperTolerance: numericDraftValue(draft.upperTolerance),
    lowerTolerance: numericDraftValue(draft.lowerTolerance),
    longTermSafetyFactor: numericDraftValue(draft.longTermSafetyFactor),
    sigmaLevel: numericDraftValue(draft.sigmaLevel),
    distribution: draft.distribution,
  };
}));

const dimensionChainSourceSignature = computed(() => JSON.stringify(activeFactors.value.map((factor, index) => ({
  id: factor.factorCandidate.factorCandidateId,
  itemNumber: index + 1,
  name: factorNameFor(factor).trim(),
  ...candidateDraft(factor),
}))));

function specificationFor(
  factor: DeepReadonly<F7SessionSnapshot["factors"][number]>,
): Pick<FactorSpecificationDraft, "designNominal" | "upperTolerance" | "lowerTolerance"> {
  return setupEditable.value ? candidateDraft(factor) : factor.setup ?? candidateDraft(factor);
}

const specificationTotals = computed(() => {
  const specifications = activeFactors.value.map(specificationFor);
  const sum = (field: "designNominal" | "upperTolerance" | "lowerTolerance"): number => specifications.reduce(
    (total, specification) => total + numericDraftValue(specification[field]),
    0,
  );
  const rss = (field: "upperTolerance" | "lowerTolerance"): number => Math.sqrt(specifications.reduce(
    (total, specification) => total + numericDraftValue(specification[field]) ** 2,
    0,
  ));
  return {
    arithmetic: {
      designNominal: sum("designNominal"),
      upperTolerance: sum("upperTolerance"),
      lowerTolerance: sum("lowerTolerance"),
    },
    rss: {
      upperTolerance: rss("upperTolerance"),
      lowerTolerance: -rss("lowerTolerance"),
    },
  };
});

function numericDraftValue(value: number | ""): number {
  return typeof value === "number" ? value : 0;
}

function calculatedValues(factor: DeepReadonly<F7SessionSnapshot["factors"][number]>) {
  if (!setupEditable.value && factor.evidence) {
    return {
      mean: factor.evidence.calculatedMean,
      tolerance: factor.evidence.tolerance,
      oneSigma: factor.evidence.oneSigma,
    };
  }
  const kernelFactor = f4Calculation.value?.factors.find((result) => (
    result.source.tableId === factor.factorCandidate.tableId
    && result.source.sourceRow === factor.factorCandidate.sourceRow
  ));
  if (kernelFactor) {
    return {
      mean: kernelFactor.mean,
      tolerance: kernelFactor.halfTolerance,
      oneSigma: kernelFactor.sigma,
    };
  }
  if (factor.evidence) {
    return {
      mean: factor.evidence.calculatedMean,
      tolerance: factor.evidence.tolerance,
      oneSigma: factor.evidence.oneSigma,
    };
  }
  const draft = candidateDraft(factor);
  const designNominal = numericDraftValue(draft.designNominal);
  const upperTolerance = numericDraftValue(draft.upperTolerance);
  const lowerTolerance = numericDraftValue(draft.lowerTolerance);
  const longTermSafetyFactor = numericDraftValue(draft.longTermSafetyFactor);
  const sigmaLevel = numericDraftValue(draft.sigmaLevel);
  const tolerance = (upperTolerance - lowerTolerance) / 2;
  const mean = designNominal < 0
    ? designNominal - (upperTolerance + lowerTolerance) / 2
    : designNominal + (upperTolerance + lowerTolerance) / 2;
  return {
    mean,
    tolerance,
    oneSigma: sigmaLevel > 0 ? tolerance * (longTermSafetyFactor / sigmaLevel) : 0,
  };
}

const sumOfSigmaSquares = computed(() => activeFactors.value.reduce((total, factor) => (
  total + calculatedValues(factor).oneSigma ** 2
), 0));

const additionalMeanShift = ref(0);

const responseSummary = computed(() => {
  const factors = activeFactors.value;
  const meanResponse = factors.reduce((total, factor) => total + calculatedValues(factor).mean, 0);
  const tolerance = factors.reduce((total, factor) => total + calculatedValues(factor).tolerance, 0);
  const contribution = factors.reduce((total, factor) => total + percentContribution(factor), 0);
  return {
    designNominal: specificationTotals.value.arithmetic.designNominal,
    upperTolerance: specificationTotals.value.arithmetic.upperTolerance,
    lowerTolerance: specificationTotals.value.arithmetic.lowerTolerance,
    meanResponse,
    tolerance,
    rssSigma: Math.sqrt(sumOfSigmaSquares.value),
    contribution,
    adjustedMean: meanResponse + additionalMeanShift.value,
  };
});

const f4Calculation = computed<KernelCalculationResult | undefined>(() => {
  const lowerSpecLimit = systemSpecificationDraft.lowerSpecLimit;
  const upperSpecLimit = systemSpecificationDraft.upperSpecLimit;
  const targetSigmaLevel = systemSpecificationDraft.targetSigmaLevel;
  if (typeof lowerSpecLimit !== "number" || !Number.isFinite(lowerSpecLimit)
    || typeof upperSpecLimit !== "number" || !Number.isFinite(upperSpecLimit)
    || typeof targetSigmaLevel !== "number" || !Number.isFinite(targetSigmaLevel)
    || targetSigmaLevel <= 0) return undefined;
  const factors = activeFactors.value.flatMap((factor) => {
    const draft = candidateDraft(factor);
    if (!isCompleteSpecification(draft)) return [];
    return [{
      source: {
        worksheetName: factor.factorCandidate.worksheetName,
        tableId: factor.factorCandidate.tableId,
        sourceRow: factor.factorCandidate.sourceRow,
      },
      name: factorNameFor(factor),
      unit: factor.factorCandidate.workbookUnitEvidence ?? "",
      input: {
        nominalValue: draft.designNominal,
        upperTolerance: draft.upperTolerance,
        lowerTolerance: draft.lowerTolerance,
        longTermSafetyFactor: draft.longTermSafetyFactor,
        sigmaLevel: draft.sigmaLevel,
        distribution: F4_DISTRIBUTION_BY_LABEL[draft.distribution],
      },
    }];
  });
  if (factors.length === 0) return undefined;
  try {
    return calculateToleranceAnalysis({
      factors,
      system: {
        designNominal: specificationTotals.value.arithmetic.designNominal,
        lowerSpecLimit,
        upperSpecLimit,
        targetSigmaLevel,
        targetCpk: targetSigmaLevel / 3,
        shift: additionalMeanShift.value,
      },
    });
  } catch {
    return undefined;
  }
});

const displayedResponseSummary = computed(() => {
  const calculation = f4Calculation.value;
  if (!calculation) return responseSummary.value;
  return {
    designNominal: calculation.system.designNominal,
    upperTolerance: calculation.system.responseUpperTolerance,
    lowerTolerance: calculation.system.responseLowerTolerance,
    meanResponse: calculation.system.mean - calculation.system.shift,
    tolerance: calculation.system.worstCaseTolerance,
    rssSigma: calculation.system.rssSigma,
    contribution: responseSummary.value.contribution,
    adjustedMean: calculation.system.mean,
  };
});

const f4Volume = computed(() => {
  const volume = props.session.systemSpecification?.volume;
  return volume?.status === "available" ? volume.actualValue : undefined;
});

interface DimensionChainProjectionCacheEntry {
  readonly sessionKey: string;
  readonly projection: DimensionChainReportProjection;
}

const currentSessionKey = computed(() => JSON.stringify({
  sessionId: props.session.sessionId,
  workbookContentHash: props.session.workbook.workbookContentHash,
  workbookFileName: props.session.workbook.fileName,
  worksheetNames: props.session.selectedWorksheetNames,
}));

const latestDimensionChainProjection = ref<DimensionChainProjectionCacheEntry | undefined>();

const currentSessionProjection = computed<DimensionChainReportProjection | undefined>(() => {
  const cached = latestDimensionChainProjection.value;
  return cached?.sessionKey === currentSessionKey.value ? cached.projection : undefined;
});

watch(currentSessionKey, (nextKey, previousKey) => {
  if (previousKey === undefined || previousKey === nextKey) return;
  latestDimensionChainProjection.value = undefined;
});

const currentCalculationInput = computed<AssumptionResultsCurrentCalculationInput | undefined>(() => {
  const calculation = f4Calculation.value;
  if (!calculation) return undefined;
  return {
    additionalMeanShift: additionalMeanShift.value,
    calculation,
  };
});

const engineeringEvidence = computed<AssumptionResultsEngineeringEvidence | undefined>(() => {
  if (props.editingSetup) return undefined;
  const chain = currentSessionProjection.value;
  if (!chain) return undefined;
  const input = currentCalculationInput.value;
  if (!input) return undefined;
  return buildConfirmedEngineeringEvidence(props.session, chain, input);
});

watch(engineeringEvidence, (evidence) => {
  emit("engineering-evidence-change", evidence);
}, { immediate: true });

function onReportProjectionChange(projection: DimensionChainReportProjection): void {
  if (projection.sourceSignature !== dimensionChainSourceSignature.value) return;
  latestDimensionChainProjection.value = {
    sessionKey: currentSessionKey.value,
    projection,
  };
}

function formatFixed(value: number | undefined, digits: number): string {
  return value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatInteger(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? "—" : Math.round(value).toLocaleString("en-US");
}

function formatF4Percent(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? "—" : `${formatFixed(value * 100, 2)}%`;
}

function sigmaMargin(multiplier: number): number | undefined {
  const sigma = f4Calculation.value?.system.rssSigma;
  return sigma === undefined ? undefined : sigma * multiplier;
}

function sigmaBound(multiplier: number, direction: -1 | 1): number | undefined {
  const calculation = f4Calculation.value;
  return calculation ? calculation.system.mean + direction * calculation.system.rssSigma * multiplier : undefined;
}

function failuresOverVolume(): number | undefined {
  const totalDpm = f4Calculation.value?.capability.totalDpm;
  return totalDpm === undefined || f4Volume.value === undefined
    ? undefined
    : totalDpm / 1_000_000 * f4Volume.value;
}

function percentContribution(factor: DeepReadonly<F7SessionSnapshot["factors"][number]>): number {
  if (sumOfSigmaSquares.value === 0) return 0;
  return calculatedValues(factor).oneSigma ** 2 / sumOfSigmaSquares.value;
}

function formatSummary(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toLocaleString("en-US", { maximumFractionDigits: 4, useGrouping: false });
}

function formatPercent(value: number): string {
  return `${formatSummary(value * 100)}%`;
}

function formatSigned(value: number): string {
  return value > 0 ? `+${formatSummary(value)}` : formatSummary(value);
}

function hideDraftCalculation(factor: DeepReadonly<F7SessionSnapshot["factors"][number]>): boolean {
  return isUserAdded(factor) && !isCompleteSpecification(candidateDraft(factor));
}

function formatFactorCalculation(
  factor: DeepReadonly<F7SessionSnapshot["factors"][number]>,
  value: number,
): string {
  return hideDraftCalculation(factor) ? "" : formatSummary(value);
}

function formatFactorTolerance(
  factor: DeepReadonly<F7SessionSnapshot["factors"][number]>,
  value: number,
): string {
  const formattedValue = formatFactorCalculation(factor, value);
  return formattedValue ? `± ${formattedValue}` : "";
}

function formatFactorContribution(
  factor: DeepReadonly<F7SessionSnapshot["factors"][number]>,
  value: number,
): string {
  return hideDraftCalculation(factor) ? "" : formatPercent(value);
}

function nominalClass(value: number | ""): "nominal-negative" | "nominal-neutral" | "nominal-positive" | "" {
  if (typeof value !== "number") return "";
  if (value < 0) return "nominal-negative";
  if (value > 0) return "nominal-positive";
  return "nominal-neutral";
}

function factorReadiness(factor: DeepReadonly<F7SessionSnapshot["factors"][number]>): "ready" | "pending" {
  return factor.sourceMode === "BASELINE_ASSUMPTION"
    || factor.measurementPasteResult?.status === "ready"
    ? "ready"
    : "pending";
}

function submitSetup(): void {
  if (props.busy) return;
  const systemSpecification = completeSystemSpecification();
  if (!systemSpecification) throw new Error("System specification is incomplete or invalid.");
  const payload = activeFactors.value.map((factor) => {
    const draft = candidateDraft(factor);
    if (!isCompleteSpecification(draft)) throw new Error("Factor specification is incomplete.");
    return {
      factorCandidateId: factor.factorCandidate.factorCandidateId,
      designNominal: draft.designNominal,
      upperTolerance: draft.upperTolerance,
      lowerTolerance: draft.lowerTolerance,
      longTermSafetyFactor: draft.longTermSafetyFactor,
      sigmaLevel: draft.sigmaLevel,
      distribution: draft.distribution,
      ...(isUserAdded(factor) ? {
        factorName: factorNameFor(factor).trim(),
        userAdded: true as const,
      } : {}),
    };
  });
  emit("confirmFactors", payload, systemSpecification);
}

const automaticConfirmationRequested = ref(false);
watch(
  () => [props.session.status, props.busy, props.editingSetup] as const,
  ([status, busy, editingSetup]) => {
    if (automaticConfirmationRequested.value || status !== "factor_setup" || busy || editingSetup) return;
    automaticConfirmationRequested.value = true;
    if (!setupIsValid.value) {
      emit("editSetup");
      return;
    }
    submitSetup();
  },
  { immediate: true },
);

function onModeChange(factorId: string, event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target.value !== "MEASURED" && target.value !== "BASELINE_ASSUMPTION") return;
  emit("setMode", factorId, target.value);
}
</script>

<template>
  <section class="workbench-panel" aria-label="Factor setup and source mode">
    <div class="factor-setup-heading">
      <h2>Factor Setup</h2>
      <div class="factor-setup-actions">
        <div v-if="setupEditable" class="factor-edit-toolbar" role="toolbar" aria-label="Factor table editing tools">
          <button type="button" data-factor-undo title="Undo" aria-label="Undo" :disabled="busy || !canUndo" @click="undoEdit">↶</button>
          <button type="button" data-factor-redo title="Redo" aria-label="Redo" :disabled="busy || !canRedo" @click="redoEdit">↷</button>
          <button
            type="button"
            data-factor-reverse-all
            title="Reverse all factors"
            aria-label="Reverse all factors"
            :disabled="busy || !canReverseFactors"
            @click="reverseAllFactors"
          >
            <ArrowLeftRight :size="15" aria-hidden="true" />
            <span>Reverse signs</span>
          </button>
          <button type="button" data-factor-reset title="Restore imported factors" :disabled="busy" @click="resetImportedFactors">Reset</button>
          <button type="button" data-factor-clear-all title="Delete all Factor rows" :disabled="busy || activeFactors.length === 0" @click="clearAllFactors">Clear all</button>
        </div>
        <button
          v-if="setupEditable && activeFactors.length === 0"
          type="button"
          class="factor-add-button"
          data-add-factor
          :disabled="busy"
          @click="addFactor()"
        >
          + Add Factor
        </button>
        <button
          v-if="!setupEditable"
          type="button"
          class="secondary-button"
          data-edit-factor-setup
          :disabled="busy"
          @click="emit('editSetup')"
        >
          Edit setup
        </button>
        <button
          v-else
          id="confirm-factor-setup"
          type="button"
          class="action-button"
          :disabled="busy || !setupIsValid"
          @click="submitSetup"
        >
          Save setup
        </button>
      </div>
    </div>
    <p v-if="setupEditable && activeFactors.length === 0" class="subtle" data-empty-factor-setup>
      No factors. Add a Factor, restore imported factors, or undo the last action.
    </p>
    <div class="table-scroll">
      <table
        id="factor-setup-table"
        class="data-table factor-table factor-table-centered"
        :style="{ width: '100%', minWidth: `${tableWidth}px` }"
      >
        <colgroup>
          <col
            v-for="(column, columnIndex) in visibleColumns"
            :key="column.key"
            :data-factor-column-index="columnIndex"
            :data-column-key="column.key"
            :style="{ width: `${columnWidths[column.key]}px` }"
          >
        </colgroup>
        <thead>
          <tr>
            <th
              v-for="column in visibleColumns"
              :key="column.key"
              :class="{
                'factor-index-column': column.key === 'index',
                'factor-header-multiline': column.lines.length > 1,
              }"
              :data-column-key="column.key"
              :aria-label="column.label"
            >
              <span class="factor-header-label" aria-hidden="true">
                <span v-for="line in column.lines" :key="line" class="factor-header-line">{{ line }}</span>
              </span>
              <span
                class="column-resize-handle"
                role="separator"
                aria-orientation="vertical"
                :aria-label="`Resize ${column.label} column`"
                title="Drag to resize; double-click to reset"
                @pointerdown="startColumnResize(column, $event)"
                @dblclick="resetColumnWidth(column)"
              ></span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(factor, index) in activeFactors" :key="factor.factorCandidate.factorCandidateId">
            <td class="factor-index-cell">
              <div v-if="setupEditable" class="factor-item-controls">
                <span class="factor-item-number">{{ index + 1 }}</span>
                <div class="factor-item-actions">
                  <button
                    type="button"
                    class="factor-row-control factor-delete-control"
                    :aria-label="`Delete ${factorNameFor(factor) || 'new factor'}`"
                    :title="`Delete ${factorNameFor(factor) || 'new factor'}`"
                    :disabled="busy"
                    @click="removeFactor(factor)"
                  >−</button>
                  <button
                    type="button"
                    class="factor-row-control factor-insert-control"
                    :aria-label="`Add factor after ${factorNameFor(factor) || 'new factor'}`"
                    :title="`Add factor after ${factorNameFor(factor) || 'new factor'}`"
                    :disabled="busy"
                    @click="addFactor(factor)"
                  >+</button>
                </div>
              </div>
              <span v-else>{{ index + 1 }}</span>
            </td>
            <td>
              <div class="factor-name-cell">
                <div v-if="setupEditable" class="factor-move-controls">
                  <button
                    type="button"
                    class="factor-row-control"
                    :aria-label="`Move ${factorNameFor(factor) || 'new factor'} up`"
                    :title="`Move ${factorNameFor(factor) || 'new factor'} up`"
                    :disabled="busy || index === 0"
                    @click="moveFactor(factor, -1)"
                  >↑</button>
                  <button
                    type="button"
                    class="factor-row-control"
                    :aria-label="`Move ${factorNameFor(factor) || 'new factor'} down`"
                    :title="`Move ${factorNameFor(factor) || 'new factor'} down`"
                    :disabled="busy || index === activeFactors.length - 1"
                    @click="moveFactor(factor, 1)"
                  >↓</button>
                </div>
                <input
                  v-if="setupEditable && isUserAdded(factor)"
                  v-model.trim="factorNames[factor.factorCandidate.factorCandidateId]"
                  type="text"
                  class="factor-name-input"
                  aria-label="New factor name"
                  :disabled="busy"
                >
                <div v-else>{{ factorNameFor(factor) }}</div>
              </div>
            </td>
            <td>
              <div class="factor-field" data-factor-field="designNominal">
                <div v-if="setupEditable" class="factor-nominal-input">
                  <input
                    v-model.number="candidateDraft(factor).designNominal"
                    type="number"
                    step="any"
                    data-factor-design-nominal
                    class="factor-spec-input factor-number-input"
                    :class="nominalClass(candidateDraft(factor).designNominal)"
                    :aria-label="`${factorNameFor(factor)} Design Nominal`"
                    :disabled="busy"
                  >
                  <button
                    type="button"
                    class="factor-sign-toggle"
                    :aria-label="`Toggle ${factorNameFor(factor)} Design Nominal sign`"
                    title="Toggle positive/negative"
                    :disabled="busy || !candidateDraft(factor).designNominal"
                    @click="toggleFactorSign(factor)"
                  ><ArrowRightLeft :size="13" aria-hidden="true" /></button>
                </div>
                <span v-else :class="nominalClass(numericDraftValue(factor.setup?.designNominal ?? candidateDraft(factor).designNominal))">{{ formatSummary(numericDraftValue(factor.setup?.designNominal ?? candidateDraft(factor).designNominal)) }}</span>
                <small
                  v-if="setupEditable && !isBlankSpecification(candidateDraft(factor)) && specificationFieldError(candidateDraft(factor), 'designNominal')"
                  class="factor-spec-error"
                  role="alert"
                >{{ specificationFieldError(candidateDraft(factor), "designNominal") }}</small>
              </div>
            </td>
            <td>
              <div class="factor-field" data-factor-field="upperTolerance">
                <input
                  v-if="setupEditable"
                  v-model.number="candidateDraft(factor).upperTolerance"
                  type="number"
                  step="any"
                  class="factor-spec-input factor-number-input"
                  :aria-label="`${factorNameFor(factor)} +Tolerance`"
                  :disabled="busy"
                >
                <span v-else>{{ formatSummary(numericDraftValue(factor.setup?.upperTolerance ?? candidateDraft(factor).upperTolerance)) }}</span>
                <small
                  v-if="setupEditable && !isBlankSpecification(candidateDraft(factor)) && specificationFieldError(candidateDraft(factor), 'upperTolerance')"
                  class="factor-spec-error"
                  role="alert"
                >{{ specificationFieldError(candidateDraft(factor), "upperTolerance") }}</small>
              </div>
            </td>
            <td>
              <div class="factor-field" data-factor-field="lowerTolerance">
                <input
                  v-if="setupEditable"
                  v-model.number="candidateDraft(factor).lowerTolerance"
                  type="number"
                  step="any"
                  class="factor-spec-input factor-number-input"
                  :aria-label="`${factorNameFor(factor)} -Tolerance`"
                  :disabled="busy"
                >
                <span v-else>{{ formatSummary(numericDraftValue(factor.setup?.lowerTolerance ?? candidateDraft(factor).lowerTolerance)) }}</span>
                <small
                  v-if="setupEditable && !isBlankSpecification(candidateDraft(factor)) && specificationFieldError(candidateDraft(factor), 'lowerTolerance')"
                  class="factor-spec-error"
                  role="alert"
                >{{ specificationFieldError(candidateDraft(factor), "lowerTolerance") }}</small>
              </div>
            </td>
            <td data-column-key="longTermSafetyFactor">
              <div class="factor-field" data-factor-field="longTermSafetyFactor">
                <input
                  v-if="setupEditable"
                  v-model.number="candidateDraft(factor).longTermSafetyFactor"
                  type="number"
                  min="0"
                  step="any"
                  class="factor-spec-input factor-control-input factor-number-input"
                  :aria-label="`${factorNameFor(factor)} Long Term/Safety Factor`"
                  :disabled="busy"
                >
                <span v-else>{{ formatSummary(factor.setup?.longTermSafetyFactor ?? factor.evidence?.longTermSafetyFactor ?? 0) }}</span>
                <small
                  v-if="setupEditable && !isBlankSpecification(candidateDraft(factor)) && specificationFieldError(candidateDraft(factor), 'longTermSafetyFactor')"
                  class="factor-spec-error"
                  role="alert"
                >{{ specificationFieldError(candidateDraft(factor), "longTermSafetyFactor") }}</small>
              </div>
            </td>
            <td data-column-key="sigmaLevel">
              <div class="factor-field" data-factor-field="sigmaLevel">
                <input
                  v-if="setupEditable"
                  v-model.number="candidateDraft(factor).sigmaLevel"
                  type="number"
                  min="0"
                  step="any"
                  class="factor-spec-input factor-control-input factor-number-input"
                  :aria-label="`${factorNameFor(factor)} Sigma Level`"
                  :disabled="busy"
                >
                <span v-else>{{ formatSummary(factor.setup?.sigmaLevel ?? factor.evidence?.sigmaLevel ?? 0) }}</span>
                <small
                  v-if="setupEditable && !isBlankSpecification(candidateDraft(factor)) && specificationFieldError(candidateDraft(factor), 'sigmaLevel')"
                  class="factor-spec-error"
                  role="alert"
                >{{ specificationFieldError(candidateDraft(factor), "sigmaLevel") }}</small>
              </div>
            </td>
            <td>
              <div class="factor-field" data-factor-field="distribution">
                <select
                  v-if="setupEditable"
                  v-model="candidateDraft(factor).distribution"
                  class="factor-distribution-select"
                  :aria-label="`${factorNameFor(factor)} Distribution`"
                  :disabled="busy"
                >
                  <option v-for="distribution in DISTRIBUTION_OPTIONS" :key="distribution" :value="distribution">
                    {{ distribution }}
                  </option>
                </select>
                <span v-else>{{ factor.setup?.distribution ?? factor.evidence?.distribution }}</span>
                <small
                  v-if="setupEditable && !isBlankSpecification(candidateDraft(factor)) && specificationFieldError(candidateDraft(factor), 'distribution')"
                  class="factor-spec-error"
                  role="alert"
                >{{ specificationFieldError(candidateDraft(factor), "distribution") }}</small>
              </div>
            </td>
            <td><output :aria-label="`${factorNameFor(factor)} Mean`">{{ formatFactorCalculation(factor, calculatedValues(factor).mean) }}</output></td>
            <td><output :aria-label="`${factorNameFor(factor)} Tolerance`">{{ formatFactorTolerance(factor, calculatedValues(factor).tolerance) }}</output></td>
            <td><output :aria-label="`${factorNameFor(factor)} 1 Sigma`">{{ formatFactorCalculation(factor, calculatedValues(factor).oneSigma) }}</output></td>
            <td><output :aria-label="`${factorNameFor(factor)} Percent Contribution`">{{ formatFactorContribution(factor, percentContribution(factor)) }}</output></td>
            <td data-column-key="sourceMode">
              <div v-if="factor.evidence && !setupEditable" class="source-mode-control">
                <fieldset class="source-mode-options">
                  <legend>Source mode</legend>
                  <label class="source-mode-option">
                    <input
                      :name="`mode-${factor.evidence.factorId}`"
                      type="radio"
                      value="BASELINE_ASSUMPTION"
                      :checked="factor.sourceMode === 'BASELINE_ASSUMPTION'"
                      :disabled="busy"
                      @change="onModeChange(factor.evidence.factorId, $event)"
                    >
                    BASELINE_ASSUMPTION
                  </label>
                  <div class="measured-workspace-row">
                    <label class="source-mode-option">
                      <input
                        :name="`mode-${factor.evidence.factorId}`"
                        type="radio"
                        value="MEASURED"
                        :checked="factor.sourceMode === 'MEASURED'"
                        :disabled="busy"
                        @change="onModeChange(factor.evidence.factorId, $event)"
                      >
                      MEASURED
                    </label>
                    <button
                      type="button"
                      class="factor-workspace-button"
                      :data-open-measurement="factor.evidence.factorId"
                      :disabled="busy || factor.sourceMode !== 'MEASURED'"
                      @click="emit('openMeasurement', factor.evidence.factorId)"
                    >
                      Open workspace
                    </button>
                  </div>
                </fieldset>
              </div>
            </td>
            <td data-column-key="sampleCount">{{ factor.measurementPasteResult?.dataset?.analyzedCount ?? "-" }}</td>
            <td data-column-key="readiness">
              <span class="status-chip" :class="factorReadiness(factor) === 'ready' ? 'chip-ready' : 'chip-pending'">
                {{ factorReadiness(factor) }}
              </span>
            </td>
          </tr>
        </tbody>
        <tfoot data-factor-response-summary aria-label="F4 response summary">
          <tr class="factor-response-summary-row" data-summary-design-row>
            <th colspan="2">Design Nominal:</th>
            <td data-factor-column="design-nominal"><output data-summary-design-nominal>{{ formatSummary(displayedResponseSummary.designNominal) }}</output></td>
            <td data-factor-column="upper-tolerance"><output data-summary-upper-tolerance>{{ formatSigned(displayedResponseSummary.upperTolerance) }}</output></td>
            <td data-factor-column="lower-tolerance"><output data-summary-lower-tolerance>{{ formatSummary(displayedResponseSummary.lowerTolerance) }}</output></td>
            <th colspan="3">Mean Response:</th>
            <td data-factor-column="mean"><output data-summary-mean-response>{{ formatSummary(displayedResponseSummary.meanResponse) }}</output></td>
            <td data-factor-column="tolerance"><output data-summary-tolerance>± {{ formatSummary(displayedResponseSummary.tolerance) }}</output></td>
            <td data-factor-column="one-sigma"><output data-summary-rss-sigma>{{ formatSummary(displayedResponseSummary.rssSigma) }}</output></td>
            <td data-factor-column="contribution"><output data-summary-contribution>{{ formatPercent(displayedResponseSummary.contribution) }}</output></td>
            <td colspan="3"></td>
          </tr>
          <tr class="factor-response-summary-row factor-mean-shift-row">
            <th colspan="8"><label for="additional-mean-shift">Additional Mean Shift ▸</label></th>
            <td data-factor-column="mean">
              <input
                id="additional-mean-shift"
                v-model.number="additionalMeanShift"
                type="number"
                step="any"
                class="factor-number-input"
                aria-label="Additional Mean Shift"
                :disabled="busy"
              >
            </td>
            <td colspan="6"></td>
          </tr>
          <tr class="factor-response-summary-row factor-adjusted-mean-row">
            <th colspan="8">Adjusted Mean:</th>
            <td data-factor-column="mean"><output data-summary-adjusted-mean>{{ formatSummary(displayedResponseSummary.adjustedMean) }}</output></td>
            <td colspan="6"></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="factor-output-layout" data-factor-output-layout>
      <section class="f4-response-summary" data-f4-response-summary aria-labelledby="f4-response-summary-title">
      <h3 id="f4-response-summary-title">Response Summary Table</h3>
      <div class="f4-summary-grid">
        <section class="f4-summary-panel">
          <h4>Calculated RSS and Worst Case</h4>
          <table class="f4-summary-table">
            <thead>
              <tr><th>Range</th><th>Tolerance</th><th>Upper</th><th>Lower</th></tr>
            </thead>
            <tbody>
              <tr>
                <th>1σ</th>
                <td>± <span data-f4-rss-sigma>{{ formatFixed(sigmaMargin(1), 4) }}</span></td>
                <td>{{ formatFixed(sigmaBound(1, 1), 4) }}</td>
                <td>{{ formatFixed(sigmaBound(1, -1), 4) }}</td>
              </tr>
              <tr v-for="multiplier in [3, 4, 4.5, 6]" :key="multiplier">
                <th>{{ multiplier }}σ</th>
                <td>± {{ formatFixed(sigmaMargin(multiplier), 4) }}</td>
                <td>{{ formatFixed(sigmaBound(multiplier, 1), 4) }}</td>
                <td>{{ formatFixed(sigmaBound(multiplier, -1), 4) }}</td>
              </tr>
              <tr>
                <th>Worst Case</th>
                <td data-f4-worst-case-tolerance>± {{ formatFixed(f4Calculation?.system.worstCaseTolerance, 4) }}</td>
                <td data-f4-worst-case-upper>{{ formatFixed(f4Calculation?.system.worstCaseUpperBound, 4) }}</td>
                <td data-f4-worst-case-lower>{{ formatFixed(f4Calculation?.system.worstCaseLowerBound, 4) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="f4-summary-panel">
          <h4>Response and Specifications</h4>
          <dl class="f4-metric-list">
            <div><dt>Design Nominal</dt><dd>{{ formatFixed(f4Calculation?.system.designNominal, 4) }}</dd></div>
            <div><dt>Adjusted Mean</dt><dd>{{ formatFixed(f4Calculation?.system.mean, 4) }}</dd></div>
            <div><dt>Additional Mean Shift</dt><dd>{{ formatFixed(f4Calculation?.system.shift, 4) }}</dd></div>
            <div><dt>LSL</dt><dd class="f4-excel-evidence" data-f4-lsl>
              <input v-if="setupEditable" v-model.number="systemSpecificationDraft.lowerSpecLimit" data-f4-lsl-input class="f4-readonly-field f4-compact-value" type="number" step="any" aria-label="Lower Specification Limit" :disabled="busy">
              <output v-else class="f4-readonly-field f4-compact-value is-readonly" aria-disabled="true">{{ formatFixed(f4Calculation?.capability.lowerSpecLimit, 2) }}</output>
            </dd></div>
            <div><dt>USL</dt><dd class="f4-excel-evidence" data-f4-usl>
              <input v-if="setupEditable" v-model.number="systemSpecificationDraft.upperSpecLimit" data-f4-usl-input class="f4-readonly-field f4-compact-value" type="number" step="any" aria-label="Upper Specification Limit" :disabled="busy">
              <output v-else class="f4-readonly-field f4-compact-value is-readonly" aria-disabled="true">{{ formatFixed(f4Calculation?.capability.upperSpecLimit, 2) }}</output>
            </dd></div>
            <div><dt>Target Sigma Level</dt><dd class="f4-excel-evidence" data-f4-target-sigma>
              <input v-if="setupEditable" v-model.number="systemSpecificationDraft.targetSigmaLevel" data-f4-target-sigma-input class="f4-readonly-field f4-compact-value" type="number" min="0.000001" step="any" aria-label="Target Sigma Level" :disabled="busy">
              <output v-else class="f4-readonly-field f4-compact-value is-readonly" aria-disabled="true">{{ typeof systemSpecificationDraft.targetSigmaLevel === "number" ? `${formatFixed(systemSpecificationDraft.targetSigmaLevel, 0)}σ` : "—" }}</output>
            </dd></div>
            <div><dt>Target Cpk</dt><dd>{{ formatFixed(f4Calculation?.capability.targetCpk, 2) }}</dd></div>
          </dl>
        </section>

        <section class="f4-summary-panel">
          <h4>Calculated Sigma Level / Cpk</h4>
          <dl class="f4-metric-list">
            <div><dt>Lower Z</dt><dd>{{ formatFixed(f4Calculation?.capability.lowerZ, 2) }} <span v-if="f4Calculation" class="f4-status" :class="f4Calculation.capability.lowerCpkStatus === 'PASS' ? 'f4-status-pass' : 'f4-status-fail'">{{ f4Calculation.capability.lowerCpkStatus }}</span></dd></div>
            <div><dt>Upper Z</dt><dd>{{ formatFixed(f4Calculation?.capability.upperZ, 2) }} <span v-if="f4Calculation" class="f4-status" :class="f4Calculation.capability.upperCpkStatus === 'PASS' ? 'f4-status-pass' : 'f4-status-fail'">{{ f4Calculation.capability.upperCpkStatus }}</span></dd></div>
            <div><dt>Calculated Sigma Level</dt><dd>{{ formatFixed(f4Calculation?.capability.z, 2) }} <span v-if="f4Calculation" class="f4-status" :class="f4Calculation.capability.status === 'PASS' ? 'f4-status-pass' : 'f4-status-fail'">{{ f4Calculation.capability.status }}</span></dd></div>
            <div><dt>Cp</dt><dd>{{ formatFixed(f4Calculation?.capability.cp, 2) }} <span v-if="f4Calculation" class="f4-status" :class="f4Calculation.capability.cpStatus === 'PASS' ? 'f4-status-pass' : 'f4-status-fail'">{{ f4Calculation.capability.cpStatus }}</span></dd></div>
            <div><dt>Lower Cpk</dt><dd>{{ formatFixed(f4Calculation?.capability.lowerCpk, 2) }} <span v-if="f4Calculation" class="f4-status" :class="f4Calculation.capability.lowerCpkStatus === 'PASS' ? 'f4-status-pass' : 'f4-status-fail'">{{ f4Calculation.capability.lowerCpkStatus }}</span></dd></div>
            <div><dt>Upper Cpk</dt><dd>{{ formatFixed(f4Calculation?.capability.upperCpk, 2) }} <span v-if="f4Calculation" class="f4-status" :class="f4Calculation.capability.upperCpkStatus === 'PASS' ? 'f4-status-pass' : 'f4-status-fail'">{{ f4Calculation.capability.upperCpkStatus }}</span></dd></div>
            <div><dt>Calculated Cpk</dt><dd><span data-f4-cpk>{{ formatFixed(f4Calculation?.capability.cpk, 2) }}</span> <span v-if="f4Calculation" class="f4-status" :class="f4Calculation.capability.status === 'PASS' ? 'f4-status-pass' : 'f4-status-fail'">{{ f4Calculation.capability.status }}</span></dd></div>
          </dl>
        </section>

        <section class="f4-summary-panel">
          <h4>Defects Per Million</h4>
          <dl class="f4-metric-list">
            <div><dt>Lower DPM</dt><dd>{{ formatInteger(f4Calculation?.capability.lowerDpm) }}</dd></div>
            <div><dt>Upper DPM</dt><dd>{{ formatInteger(f4Calculation?.capability.upperDpm) }}</dd></div>
            <div><dt>Total DPM</dt><dd data-f4-total-dpm>{{ formatInteger(f4Calculation?.capability.totalDpm) }}</dd></div>
            <div><dt>% Out of Spec</dt><dd>{{ formatF4Percent(f4Calculation?.capability.outOfSpecRatio) }}</dd></div>
            <div><dt>Yield</dt><dd data-f4-yield>{{ formatF4Percent(f4Calculation?.capability.yield) }}</dd></div>
            <div><dt>Volume</dt><dd class="f4-excel-evidence" data-f4-volume><output class="f4-readonly-field f4-compact-value">{{ formatInteger(f4Volume) }}</output></dd></div>
            <div><dt>Failures Over Vol.</dt><dd>{{ formatInteger(failuresOverVolume()) }}</dd></div>
          </dl>
        </section>
        </div>
      </section>
      <DimensionChainPanel
        :key="dimensionChainResetRevision"
        :factors="dimensionChainFactors"
        :valid="setupIsValid"
        :empty-state-action-enabled="dimensionChainResetRevision > 0"
        :source-signature="dimensionChainSourceSignature"
        :default-background-image-url="session.dimensionChainImage?.url"
        :editable="setupEditable && !busy"
        @reverse-all="reverseAllFactors"
        @factor-sign-change="applyFactorSigns"
        @report-projection-change="onReportProjectionChange"
      />
      <ResponseDistributionCurve
        :calculation="f4Calculation"
      />
    </div>
    <p v-if="editingSetup" class="subtle" data-factor-setup-reset-notice>
      Confirming changes resets source modes, measurement data, distribution fits, and simulation results.
    </p>
  </section>
</template>