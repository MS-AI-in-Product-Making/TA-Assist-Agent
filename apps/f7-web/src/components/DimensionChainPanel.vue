<script setup lang="ts">
/* global ClipboardEvent, HTMLElement, Image, KeyboardEvent, PointerEvent, WheelEvent, window */
import { computed, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from "vue";
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ImagePlus,
  Maximize2,
  RotateCcw,
  ScanSearch,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-vue-next";
import {
  boundaryKey,
  buildDisplaySegments,
  buildDimensionChainGeometry,
  dimensionChainSignature,
  pruneManualLayout,
  signChangesForDisplay,
  type DimensionChainDisplaySegment,
  type DimensionChainFactor,
  type DimensionChainManualLayout,
  type DimensionChainOrientation,
} from "./dimension-chain";

const props = withDefaults(defineProps<{
  readonly factors: readonly DimensionChainFactor[];
  readonly valid: boolean;
  readonly sourceSignature?: string;
  readonly editable?: boolean;
}>(), {
  editable: false,
});

const emit = defineEmits<{
  "reverse-all": [];
  "factor-sign-change": [changes: readonly { factorId: string; sign: 1 | -1 }[]];
}>();

const AXIS_PADDING = 64;
const LANE_SIZE = 58;
const MIN_CANVAS_SIZE = 360;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.2;
const PAN_STEP = 24;
const CLOSURE_GUIDE_MIN_GAP = 1;
const BACKGROUND_PADDING = 16;
const SUPPORTED_BACKGROUND_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const orientation = ref<DimensionChainOrientation>("horizontal");
const generatedFactors = ref<readonly DimensionChainFactor[]>();
const generatedSourceSignature = ref("");
const backgroundInput = ref<HTMLInputElement>();
const backgroundUrl = ref("");
const backgroundNaturalWidth = ref(0);
const backgroundNaturalHeight = ref(0);
const backgroundOpacity = ref(0.6);
const backgroundError = ref("");
const revokedBackgroundUrls = new Set<string>();
let backgroundImportRevision = 0;
let pendingBackgroundUrl = "";
const manualLayouts = reactive<Record<DimensionChainOrientation, DimensionChainManualLayout>>({
  horizontal: { boundaryOffsets: {}, laneOffsets: {} },
  vertical: { boundaryOffsets: {}, laneOffsets: {} },
});
const layoutRevision = ref(0);
let pendingSignSync: {
  readonly factorIds: ReadonlySet<string>;
  readonly expectedSigns: ReadonlyMap<string, 1 | -1>;
  readonly sourceSignature: string;
  readonly canAcknowledgeSource: boolean;
  readonly preserveClosurePositions: boolean;
} | undefined;
const markerSuffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
const additiveMarkerId = `dimension-chain-additive-arrow-${markerSuffix}`;
const subtractiveMarkerId = `dimension-chain-subtractive-arrow-${markerSuffix}`;
const closureMarkerId = `dimension-chain-closure-${markerSuffix}`;

const currentSignature = computed(() => props.sourceSignature ?? dimensionChainSignature(props.factors));
const stale = computed(() => (
  generatedFactors.value !== undefined && currentSignature.value !== generatedSourceSignature.value
));
const geometry = computed(() => (
  generatedFactors.value ? buildDimensionChainGeometry(generatedFactors.value) : undefined
));
const logicalDisplaySegments = computed(() => {
  const value = geometry.value;
  return value ? buildDisplaySegments(value, manualLayouts[orientation.value]) : [];
});
const displaySegments = computed<readonly DimensionChainDisplaySegment[]>(() => {
  const segments = logicalDisplaySegments.value;
  const lastIndex = segments.length - 1;
  return segments.map((segment, index) => {
    const displayStart = index === 0
      ? segment.displayStart + closureEndOffset()
      : segment.displayStart;
    const displayEnd = index === lastIndex
      ? segment.displayEnd + closureStartOffset()
      : segment.displayEnd;
    const displaySign = Math.sign(displayEnd - displayStart);
    return {
      ...segment,
      displayStart,
      displayEnd,
      displayDirection: displaySign > 0
        ? "additive"
        : displaySign < 0
          ? "subtractive"
          : "zero",
    };
  });
});
const positionSpan = computed(() => {
  const value = geometry.value;
  return value ? value.maxPosition - value.minPosition : 0;
});
const canvasWidth = computed(() => orientation.value === "horizontal"
  ? Math.max(MIN_CANVAS_SIZE, positionSpan.value + AXIS_PADDING * 2)
  : Math.max(MIN_CANVAS_SIZE, (geometry.value?.segments.length ?? 0) * LANE_SIZE + 150));
const canvasHeight = computed(() => orientation.value === "horizontal"
  ? Math.max(190, ((geometry.value?.segments.length ?? 0) + 1) * LANE_SIZE + 68)
  : Math.max(MIN_CANVAS_SIZE, positionSpan.value + AXIS_PADDING * 2));
const backgroundOpacityPercent = computed({
  get: () => Math.round(backgroundOpacity.value * 100),
  set: (value: number | string) => {
    backgroundOpacity.value = Number(value) / 100;
  },
});
const backgroundLayout = computed(() => {
  if (!backgroundUrl.value || backgroundNaturalWidth.value <= 0 || backgroundNaturalHeight.value <= 0) {
    return undefined;
  }
  const availableWidth = Math.max(1, canvasWidth.value - BACKGROUND_PADDING * 2);
  const availableHeight = Math.max(1, canvasHeight.value - BACKGROUND_PADDING * 2);
  const scale = Math.min(
    availableWidth / backgroundNaturalWidth.value,
    availableHeight / backgroundNaturalHeight.value,
  );
  const width = backgroundNaturalWidth.value * scale;
  const height = backgroundNaturalHeight.value * scale;
  return {
    x: (canvasWidth.value - width) / 2,
    y: canvasHeight.value - BACKGROUND_PADDING - height,
    width,
    height,
  };
});
const actionLabel = computed(() => {
  if (!generatedFactors.value) return "Generate";
  return stale.value ? "Update" : "Generated";
});
const viewX = ref(0);
const viewY = ref(0);
const viewZoom = ref(1);
const selectionMode = ref(false);
const canvasElement = ref<HTMLElement>();
type DimensionChainInteraction =
  | { readonly kind: "pan" | "select"; readonly pointerId: number }
  | {
    readonly kind: "guide";
    readonly pointerId: number;
    readonly orientation: DimensionChainOrientation;
    readonly key: string;
    readonly initialLayout: DimensionChainManualLayout;
    readonly clientX: number;
    readonly clientY: number;
  }
  | {
    readonly kind: "closure-guide";
    readonly pointerId: number;
    readonly orientation: DimensionChainOrientation;
    readonly endpoint: "start" | "end";
    readonly initialLayout: DimensionChainManualLayout;
    readonly clientX: number;
    readonly clientY: number;
  }
  | {
    readonly kind: "closure-arrow";
    readonly pointerId: number;
    readonly orientation: DimensionChainOrientation;
    readonly initialLayout: DimensionChainManualLayout;
    readonly clientX: number;
    readonly clientY: number;
  }
  | {
    readonly kind: "arrow";
    readonly pointerId: number;
    readonly orientation: DimensionChainOrientation;
    readonly factorId: string;
    readonly initialLayout: DimensionChainManualLayout;
    readonly clientX: number;
    readonly clientY: number;
  };
const interaction = ref<DimensionChainInteraction>();
const pointerStart = ref<{ clientX: number; clientY: number; viewX: number; viewY: number }>();
const selectionStart = ref<{ x: number; y: number }>();
const selectionEnd = ref<{ x: number; y: number }>();
const viewWidth = computed(() => canvasWidth.value / viewZoom.value);
const viewHeight = computed(() => canvasHeight.value / viewZoom.value);
const viewBox = computed(() => `${viewX.value} ${viewY.value} ${viewWidth.value} ${viewHeight.value}`);
const selectionBox = computed(() => {
  if (!selectionStart.value || !selectionEnd.value) return undefined;
  return {
    x: Math.min(selectionStart.value.x, selectionEnd.value.x),
    y: Math.min(selectionStart.value.y, selectionEnd.value.y),
    width: Math.abs(selectionEnd.value.x - selectionStart.value.x),
    height: Math.abs(selectionEnd.value.y - selectionStart.value.y),
  };
});

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function resetView(): void {
  finishInteraction(true);
  viewX.value = 0;
  viewY.value = 0;
  viewZoom.value = 1;
  selectionMode.value = false;
}

function zoomTo(nextValue: number, anchorX = 0.5, anchorY = 0.5): void {
  const nextZoom = clampZoom(nextValue);
  if (nextZoom === viewZoom.value) return;
  const oldWidth = viewWidth.value;
  const oldHeight = viewHeight.value;
  const nextWidth = canvasWidth.value / nextZoom;
  const nextHeight = canvasHeight.value / nextZoom;
  viewX.value += (oldWidth - nextWidth) * anchorX;
  viewY.value += (oldHeight - nextHeight) * anchorY;
  viewZoom.value = nextZoom;
}

function panView(deltaX: number, deltaY: number): void {
  viewX.value += deltaX / viewZoom.value;
  viewY.value += deltaY / viewZoom.value;
}

function setOrientation(nextOrientation: DimensionChainOrientation): void {
  orientation.value = nextOrientation;
  resetView();
}

function parsedSignature(signature: string): unknown {
  try {
    return JSON.parse(signature);
  } catch {
    return undefined;
  }
}

function differsOnlyByPendingSigns(
  previousSignature: string,
  nextSignature: string,
  pendingFactorIds: ReadonlySet<string>,
): boolean {
  const previous = parsedSignature(previousSignature);
  const next = parsedSignature(nextSignature);
  if (!Array.isArray(previous) || !Array.isArray(next) || previous.length !== next.length) return false;

  return previous.every((previousFactor: unknown, index) => {
    const nextFactor = next[index];
    if (
      typeof previousFactor !== "object"
      || previousFactor === null
      || typeof nextFactor !== "object"
      || nextFactor === null
    ) return false;
    const previousRecord = previousFactor as Record<string, unknown>;
    const nextRecord = nextFactor as Record<string, unknown>;
    if (previousRecord.id !== nextRecord.id) return false;

    const previousComparable = { ...previousRecord };
    const nextComparable = { ...nextRecord };
    if (typeof previousRecord.id === "string" && pendingFactorIds.has(previousRecord.id)) {
      if (
        typeof previousRecord.designNominal !== "number"
        || typeof nextRecord.designNominal !== "number"
        || Math.abs(previousRecord.designNominal) !== Math.abs(nextRecord.designNominal)
      ) return false;
      previousComparable.designNominal = Math.abs(previousRecord.designNominal);
      nextComparable.designNominal = Math.abs(nextRecord.designNominal);
    }
    return JSON.stringify(previousComparable) === JSON.stringify(nextComparable);
  });
}

function reverseAllFactors(): void {
  if (!props.editable || !props.valid) return;
  pendingSignSync = undefined;
  if (generatedFactors.value) {
    const currentById = new Map(props.factors.map((factor) => [factor.id, factor]));
    const expectedSigns = new Map<string, 1 | -1>();
    for (const generatedFactor of generatedFactors.value) {
      const currentFactor = currentById.get(generatedFactor.id);
      const expectedSign = currentFactor ? -Math.sign(currentFactor.designNominal) : 0;
      if (generatedFactor.designNominal !== 0 && (expectedSign === 1 || expectedSign === -1)) {
        expectedSigns.set(generatedFactor.id, expectedSign);
      }
    }
    if (expectedSigns.size > 0) {
      pendingSignSync = {
        factorIds: new Set(props.factors.map(({ id }) => id)),
        expectedSigns,
        sourceSignature: currentSignature.value,
        canAcknowledgeSource: !stale.value,
        preserveClosurePositions: false,
      };
    }
  }
  emit("reverse-all");
}

function setPendingSignTransaction(
  changes: readonly { readonly factorId: string; readonly sign: 1 | -1 }[],
): void {
  if (changes.length === 0) return;
  pendingSignSync = {
    factorIds: new Set(props.factors.map(({ id }) => id)),
    expectedSigns: new Map(changes.map(({ factorId, sign }) => [factorId, sign])),
    sourceSignature: currentSignature.value,
    canAcknowledgeSource: !stale.value,
    preserveClosurePositions: true,
  };
}

function resetLayout(): void {
  manualLayouts.horizontal = { boundaryOffsets: {}, laneOffsets: {} };
  manualLayouts.vertical = { boundaryOffsets: {}, laneOffsets: {} };
  layoutRevision.value += 1;
}

function revokeBackgroundUrl(url: string): void {
  if (revokedBackgroundUrls.has(url)) return;
  URL.revokeObjectURL(url);
  revokedBackgroundUrls.add(url);
}

function cancelPendingBackgroundImport(): number {
  const revision = ++backgroundImportRevision;
  if (pendingBackgroundUrl) {
    revokeBackgroundUrl(pendingBackgroundUrl);
    pendingBackgroundUrl = "";
  }
  return revision;
}

function decodeBackgroundImage(url: string): Promise<{ readonly width: number; readonly height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Error("Image has no natural dimensions."));
        return;
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => reject(new Error("Image decode failed."));
    image.src = url;
  });
}

async function importBackgroundFile(file: File): Promise<void> {
  const revision = cancelPendingBackgroundImport();
  if (!SUPPORTED_BACKGROUND_TYPES.has(file.type)) {
    backgroundError.value = "Choose a PNG, JPEG, or WebP image.";
    return;
  }

  backgroundError.value = "";
  const candidateUrl = URL.createObjectURL(file);
  pendingBackgroundUrl = candidateUrl;
  try {
    const dimensions = await decodeBackgroundImage(candidateUrl);
    if (revision !== backgroundImportRevision) {
      revokeBackgroundUrl(candidateUrl);
      return;
    }
    pendingBackgroundUrl = "";
    const previousUrl = backgroundUrl.value;
    backgroundUrl.value = candidateUrl;
    backgroundNaturalWidth.value = dimensions.width;
    backgroundNaturalHeight.value = dimensions.height;
    if (previousUrl && previousUrl !== candidateUrl) revokeBackgroundUrl(previousUrl);
  } catch {
    if (pendingBackgroundUrl === candidateUrl) pendingBackgroundUrl = "";
    revokeBackgroundUrl(candidateUrl);
    if (revision !== backgroundImportRevision) return;
    backgroundError.value = "The selected image could not be decoded.";
  }
}

async function onBackgroundInput(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) await importBackgroundFile(file);
}

function openBackgroundInput(): void {
  backgroundInput.value?.click();
}

function removeBackground(): void {
  cancelPendingBackgroundImport();
  const currentUrl = backgroundUrl.value;
  backgroundUrl.value = "";
  backgroundNaturalWidth.value = 0;
  backgroundNaturalHeight.value = 0;
  backgroundError.value = "";
  if (currentUrl) revokeBackgroundUrl(currentUrl);
}

function isTextEntryTarget(target: unknown): boolean {
  return target instanceof HTMLElement && (
    target.matches("input, textarea, select") || target.isContentEditable
  );
}

function onPaste(event: ClipboardEvent): void {
  if (isTextEntryTarget(event.target)) return;
  const itemFiles = Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  const files = itemFiles.length > 0
    ? itemFiles
    : Array.from(event.clipboardData?.files ?? []);
  const imageFile = files.find((file) => SUPPORTED_BACKGROUND_TYPES.has(file.type));
  if (!imageFile) {
    backgroundError.value = "The clipboard does not contain a PNG, JPEG, or WebP image.";
    return;
  }
  event.preventDefault();
  void importBackgroundFile(imageFile);
}

watch(() => props.factors, (nextFactors) => {
  manualLayouts.horizontal = pruneManualLayout(manualLayouts.horizontal, nextFactors);
  manualLayouts.vertical = pruneManualLayout(manualLayouts.vertical, nextFactors);
  const pending = pendingSignSync;
  const snapshot = generatedFactors.value;
  if (!pending || !snapshot) return;
  if (
    nextFactors.length !== pending.factorIds.size
    || nextFactors.some(({ id }) => !pending.factorIds.has(id))
  ) {
    pendingSignSync = undefined;
    return;
  }
  const nextById = new Map(nextFactors.map((factor) => [factor.id, factor]));
  const allSignsMatch = [...pending.expectedSigns].every(([factorId, expectedSign]) => {
    const nextFactor = nextById.get(factorId);
    return nextFactor && Math.sign(nextFactor.designNominal) === expectedSign;
  });
  if (!allSignsMatch) return;

  const previousGeometry = geometry.value;
  const closurePositions = pending.preserveClosurePositions && previousGeometry
    ? Object.fromEntries((["horizontal", "vertical"] as const).map((key) => {
        const layout = manualLayouts[key];
        return [key, {
          start: previousGeometry.closure.start + (layout.closureStartOffset ?? 0),
          end: previousGeometry.closure.end + (layout.closureEndOffset ?? 0),
        }];
      })) as Record<DimensionChainOrientation, { readonly start: number; readonly end: number }>
    : undefined;

  generatedFactors.value = snapshot.map((factor) => {
    const expectedSign = pending.expectedSigns.get(factor.id);
    if (expectedSign === undefined) return factor;
    return {
      ...factor,
      designNominal: Math.abs(factor.designNominal) * expectedSign,
    };
  });

  const nextGeometry = geometry.value;
  if (closurePositions && nextGeometry) {
    for (const key of ["horizontal", "vertical"] as const) {
      const layout = manualLayouts[key];
      manualLayouts[key] = {
        ...layout,
        closureStartOffset: closurePositions[key].start - nextGeometry.closure.start,
        closureEndOffset: closurePositions[key].end - nextGeometry.closure.end,
      };
    }
  }

  if (
    pending.canAcknowledgeSource
    && differsOnlyByPendingSigns(
      pending.sourceSignature,
      currentSignature.value,
      new Set(pending.expectedSigns.keys()),
    )
  ) {
    generatedSourceSignature.value = currentSignature.value;
  }
  pendingSignSync = undefined;
}, { deep: true });

function pointInView(event: PointerEvent, element: HTMLElement): { x: number; y: number } {
  const bounds = element.getBoundingClientRect();
  const width = bounds.width || 1;
  const height = bounds.height || 1;
  return {
    x: viewX.value + ((event.clientX - bounds.left) / width) * viewWidth.value,
    y: viewY.value + ((event.clientY - bounds.top) / height) * viewHeight.value,
  };
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
  const element = event.currentTarget as HTMLElement;
  const bounds = element.getBoundingClientRect();
  const anchorX = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;
  const anchorY = bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0.5;
  zoomTo(viewZoom.value * (event.deltaY < 0 ? 1.15 : 1 / 1.15), anchorX, anchorY);
}

function onPointerDown(event: PointerEvent): void {
  if (interaction.value) return;
  const element = event.currentTarget as HTMLElement;
  if (selectionMode.value && event.button === 0) {
    element.setPointerCapture?.(event.pointerId);
    interaction.value = { kind: "select", pointerId: event.pointerId };
    selectionStart.value = pointInView(event, element);
    selectionEnd.value = selectionStart.value;
    return;
  }
  if (event.button !== 1) return;
  event.preventDefault();
  element.setPointerCapture?.(event.pointerId);
  interaction.value = { kind: "pan", pointerId: event.pointerId };
  pointerStart.value = {
    clientX: event.clientX,
    clientY: event.clientY,
    viewX: viewX.value,
    viewY: viewY.value,
  };
}

function startHandleInteraction(
  event: PointerEvent,
  handle:
    | { readonly kind: "guide"; readonly key: string }
    | { readonly kind: "arrow"; readonly factorId: string }
    | { readonly kind: "closure-guide"; readonly endpoint: "start" | "end" }
    | { readonly kind: "closure-arrow" },
): void {
  if (event.button !== 0) return;
  if (selectionMode.value) return;
  event.stopPropagation();
  if (!props.editable || interaction.value) return;
  event.preventDefault();
  const activeOrientation = orientation.value;
  const layout = manualLayouts[activeOrientation];
  canvasElement.value?.setPointerCapture?.(event.pointerId);
  if (handle.kind === "guide") {
    interaction.value = {
      kind: "guide",
      pointerId: event.pointerId,
      orientation: activeOrientation,
      key: handle.key,
      initialLayout: layout,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  } else if (handle.kind === "arrow") {
    interaction.value = {
      kind: "arrow",
      pointerId: event.pointerId,
      orientation: activeOrientation,
      factorId: handle.factorId,
      initialLayout: layout,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  } else if (handle.kind === "closure-guide") {
    interaction.value = {
      kind: "closure-guide",
      pointerId: event.pointerId,
      orientation: activeOrientation,
      endpoint: handle.endpoint,
      initialLayout: layout,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  } else {
    interaction.value = {
      kind: "closure-arrow",
      pointerId: event.pointerId,
      orientation: activeOrientation,
      initialLayout: layout,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }
}

function onGuidePointerDown(event: PointerEvent, key: string): void {
  startHandleInteraction(event, { kind: "guide", key });
}

function onArrowPointerDown(event: PointerEvent, factorId: string): void {
  startHandleInteraction(event, { kind: "arrow", factorId });
}

function onClosureGuidePointerDown(event: PointerEvent, endpoint: "start" | "end"): void {
  startHandleInteraction(event, { kind: "closure-guide", endpoint });
}

function onClosureArrowPointerDown(event: PointerEvent): void {
  startHandleInteraction(event, { kind: "closure-arrow" });
}

function updateHandleInteraction(
  event: PointerEvent,
  activeInteraction: Extract<DimensionChainInteraction, { kind: "guide" | "arrow" | "closure-guide" | "closure-arrow" }>,
): void {
  const bounds = canvasElement.value?.getBoundingClientRect();
  if (!bounds) return;
  const deltaX = (event.clientX - activeInteraction.clientX) * (viewWidth.value / (bounds.width || 1));
  const deltaY = (event.clientY - activeInteraction.clientY) * (viewHeight.value / (bounds.height || 1));
  const layout = activeInteraction.initialLayout;

  if (activeInteraction.kind === "closure-guide") {
    const delta = activeInteraction.orientation === "horizontal" ? deltaX : deltaY;
    const basePosition = activeInteraction.endpoint === "start"
      ? (geometry.value?.closure.start ?? 0)
      : (geometry.value?.closure.end ?? 0);
    const initialOffset = activeInteraction.endpoint === "start"
      ? (layout.closureStartOffset ?? 0)
      : (layout.closureEndOffset ?? 0);
    const position = clampClosureGuidePosition(
      activeInteraction.endpoint,
      basePosition + initialOffset + delta,
      layout,
    );
    manualLayouts[activeInteraction.orientation] = activeInteraction.endpoint === "start"
      ? { ...layout, closureStartOffset: position - basePosition }
      : { ...layout, closureEndOffset: position - basePosition };
    return;
  }

  if (activeInteraction.kind === "closure-arrow") {
    const delta = activeInteraction.orientation === "horizontal" ? deltaY : deltaX;
    manualLayouts[activeInteraction.orientation] = {
      ...layout,
      closureLaneOffset: (layout.closureLaneOffset ?? 0) + delta,
    };
    return;
  }

  if (activeInteraction.kind === "guide") {
    const delta = activeInteraction.orientation === "horizontal" ? deltaX : deltaY;
    manualLayouts[activeInteraction.orientation] = {
      ...layout,
      boundaryOffsets: {
        ...layout.boundaryOffsets,
        [activeInteraction.key]: (layout.boundaryOffsets[activeInteraction.key] ?? 0) + delta,
      },
    };
    return;
  }

  const delta = activeInteraction.orientation === "horizontal" ? deltaY : deltaX;
  manualLayouts[activeInteraction.orientation] = {
    ...layout,
    laneOffsets: {
      ...layout.laneOffsets,
      [activeInteraction.factorId]: (layout.laneOffsets[activeInteraction.factorId] ?? 0) + delta,
    },
  };
}

function onPointerMove(event: PointerEvent): void {
  const activeInteraction = interaction.value;
  if (!activeInteraction || event.pointerId !== activeInteraction.pointerId) return;
  if (event.button === -1 && event.buttons === 0) {
    finishInteraction(true);
    return;
  }
  if (
    activeInteraction.kind === "guide"
    || activeInteraction.kind === "arrow"
    || activeInteraction.kind === "closure-guide"
    || activeInteraction.kind === "closure-arrow"
  ) {
    updateHandleInteraction(event, activeInteraction);
    return;
  }
  const element = event.currentTarget as HTMLElement;
  if (activeInteraction.kind === "select") {
    selectionEnd.value = pointInView(event, element);
    return;
  }
  if (!pointerStart.value) return;
  const bounds = element.getBoundingClientRect();
  viewX.value = pointerStart.value.viewX - (event.clientX - pointerStart.value.clientX) * (viewWidth.value / (bounds.width || 1));
  viewY.value = pointerStart.value.viewY - (event.clientY - pointerStart.value.clientY) * (viewHeight.value / (bounds.height || 1));
}

function finishInteraction(cancel = false, release = true): void {
  const activeInteraction = interaction.value;
  if (!activeInteraction) return;
  if (
    cancel
    && (
      activeInteraction.kind === "guide"
      || activeInteraction.kind === "arrow"
      || activeInteraction.kind === "closure-guide"
      || activeInteraction.kind === "closure-arrow"
    )
  ) {
    manualLayouts[activeInteraction.orientation] = activeInteraction.initialLayout;
  }
  if (
    !cancel
    && (activeInteraction.kind === "guide" || activeInteraction.kind === "closure-guide")
  ) {
    const changes = signChangesForDisplay(
      activeInteraction.kind === "closure-guide"
        ? displaySegments.value
        : logicalDisplaySegments.value,
    );
    if (changes.length > 0) {
      setPendingSignTransaction(changes);
      emit("factor-sign-change", changes);
    }
  }
  if (!cancel && activeInteraction.kind === "select" && selectionBox.value && selectionBox.value.width > 4 && selectionBox.value.height > 4) {
    const box = selectionBox.value;
    const nextZoom = clampZoom(Math.min(canvasWidth.value / box.width, canvasHeight.value / box.height));
    const nextWidth = canvasWidth.value / nextZoom;
    const nextHeight = canvasHeight.value / nextZoom;
    viewX.value = box.x + (box.width - nextWidth) / 2;
    viewY.value = box.y + (box.height - nextHeight) / 2;
    viewZoom.value = nextZoom;
  }
  interaction.value = undefined;
  pointerStart.value = undefined;
  selectionStart.value = undefined;
  selectionEnd.value = undefined;
  if (activeInteraction.kind === "select") selectionMode.value = false;
  if (release) canvasElement.value?.releasePointerCapture?.(activeInteraction.pointerId);
}

function onPointerUp(event: PointerEvent): void {
  if (event.pointerId !== interaction.value?.pointerId) return;
  finishInteraction();
}

function onPointerCancel(event: PointerEvent): void {
  if (event.pointerId !== interaction.value?.pointerId) return;
  finishInteraction(true);
}

function onLostPointerCapture(event: PointerEvent): void {
  if (event.pointerId !== interaction.value?.pointerId) return;
  finishInteraction(true, false);
}

function onWindowKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  const activeInteraction = interaction.value;
  if (
    activeInteraction?.kind !== "guide"
    && activeInteraction?.kind !== "arrow"
    && activeInteraction?.kind !== "closure-guide"
    && activeInteraction?.kind !== "closure-arrow"
  ) return;
  event.preventDefault();
  finishInteraction(true);
}

onMounted(() => window.addEventListener("keydown", onWindowKeyDown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeyDown);
  finishInteraction(true);
  cancelPendingBackgroundImport();
  if (backgroundUrl.value) {
    revokeBackgroundUrl(backgroundUrl.value);
    backgroundUrl.value = "";
  }
});

function generate(): void {
  pendingSignSync = undefined;
  if (!props.valid) return;
  manualLayouts.horizontal = pruneManualLayout(manualLayouts.horizontal, props.factors);
  manualLayouts.vertical = pruneManualLayout(manualLayouts.vertical, props.factors);
  generatedFactors.value = props.factors.map((factor) => ({ ...factor }));
  generatedSourceSignature.value = currentSignature.value;
  resetView();
}

function axisPosition(position: number): number {
  return AXIS_PADDING + position - (geometry.value?.minPosition ?? 0);
}

function lanePosition(index: number, offset = 0): number {
  return 48 + index * LANE_SIZE + offset;
}

function closureStartOffset(): number {
  return manualLayouts[orientation.value].closureStartOffset ?? 0;
}

function closureEndOffset(): number {
  return manualLayouts[orientation.value].closureEndOffset ?? 0;
}

function closureLaneOffset(): number {
  return manualLayouts[orientation.value].closureLaneOffset ?? 0;
}

function closureStartPosition(): number {
  return (geometry.value?.closure.start ?? 0) + closureStartOffset();
}

function closureEndPosition(): number {
  return (geometry.value?.closure.end ?? 0) + closureEndOffset();
}

function closureLanePosition(): number {
  return lanePosition(geometry.value?.segments.length ?? 0, closureLaneOffset());
}

function closurePositionForLayout(
  endpoint: "start" | "end",
  layout: DimensionChainManualLayout,
): number {
  return endpoint === "start"
    ? (geometry.value?.closure.start ?? 0) + (layout.closureStartOffset ?? 0)
    : (geometry.value?.closure.end ?? 0) + (layout.closureEndOffset ?? 0);
}

function clampClosureGuidePosition(
  endpoint: "start" | "end",
  candidate: number,
  layout: DimensionChainManualLayout,
): number {
  const start = closurePositionForLayout("start", layout);
  const end = closurePositionForLayout("end", layout);
  const moving = endpoint === "start" ? start : end;
  const stationary = endpoint === "start" ? end : start;
  const generatedStart = geometry.value?.closure.start ?? 0;
  const generatedEnd = geometry.value?.closure.end ?? 0;
  const generatedSide = endpoint === "start"
    ? Math.sign(generatedStart - generatedEnd)
    : Math.sign(generatedEnd - generatedStart);
  const side = Math.sign(moving - stationary) || generatedSide || (endpoint === "start" ? 1 : -1);
  return side > 0
    ? Math.max(candidate, stationary + CLOSURE_GUIDE_MIN_GAP)
    : Math.min(candidate, stationary - CLOSURE_GUIDE_MIN_GAP);
}

function signedValue(value: number): string {
  if (value > 0) return `+${formatValue(value)}`;
  return formatValue(value);
}

function formatValue(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toLocaleString("en-US", { maximumFractionDigits: 4, useGrouping: false });
}

function segmentLabel(segment: DimensionChainDisplaySegment): string {
  const role = segment.displayDirection === "additive"
    ? "additive"
    : segment.displayDirection === "subtractive"
      ? "subtractive"
      : "zero";
  return `Item ${segment.itemNumber}, ${segment.name}, ${signedValue(segment.designNominal)}, ${role}`;
}

function displayName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

function componentMarkerId(segment: DimensionChainDisplaySegment): string {
  return segment.displayDirection === "subtractive" ? subtractiveMarkerId : additiveMarkerId;
}
</script>

<template>
  <section class="dimension-chain-panel" data-dimension-chain-panel aria-labelledby="dimension-chain-title">
    <header class="dimension-chain-titlebar">
      <h3 id="dimension-chain-title">Dimension Chain</h3>
      <div class="dimension-chain-view-tools" role="toolbar" aria-label="Dimension chain view controls">
        <button type="button" aria-label="Pan left" title="Pan left" @click="panView(-PAN_STEP, 0)"><ArrowLeft :size="16" /></button>
        <button type="button" aria-label="Pan up" title="Pan up" @click="panView(0, -PAN_STEP)"><ArrowUp :size="16" /></button>
        <button type="button" aria-label="Pan down" title="Pan down" @click="panView(0, PAN_STEP)"><ArrowDown :size="16" /></button>
        <button type="button" aria-label="Pan right" title="Pan right" @click="panView(PAN_STEP, 0)"><ArrowRight :size="16" /></button>
        <span class="dimension-chain-tool-separator" aria-hidden="true"></span>
        <button type="button" aria-label="Zoom in" title="Zoom in" :disabled="viewZoom >= MAX_ZOOM" @click="zoomTo(viewZoom * ZOOM_STEP)"><ZoomIn :size="16" /></button>
        <button type="button" aria-label="Zoom out" title="Zoom out" :disabled="viewZoom <= MIN_ZOOM" @click="zoomTo(viewZoom / ZOOM_STEP)"><ZoomOut :size="16" /></button>
        <button type="button" aria-label="Select area to zoom" title="Select area to zoom" :aria-pressed="selectionMode" :class="{ 'is-active': selectionMode }" @click="selectionMode = !selectionMode"><ScanSearch :size="16" /></button>
        <button type="button" aria-label="Fit full dimension chain" title="Fit full dimension chain" @click="resetView"><Maximize2 :size="16" /></button>
      </div>
    </header>
    <div class="dimension-chain-toolbar">
      <button
        type="button"
        class="action-button dimension-chain-action"
        data-generate-dimension-chain
        :disabled="!valid || (generatedFactors !== undefined && !stale)"
        @click="generate"
      >{{ actionLabel }}</button>
      <div class="dimension-chain-orientation" aria-label="Dimension chain orientation">
        <button
          type="button"
          aria-label="Horizontal dimension chain"
          :aria-pressed="orientation === 'horizontal'"
          :class="{ 'is-active': orientation === 'horizontal' }"
          @click="setOrientation('horizontal')"
        >Horizontal</button>
        <button
          type="button"
          aria-label="Vertical dimension chain"
          :aria-pressed="orientation === 'vertical'"
          :class="{ 'is-active': orientation === 'vertical' }"
          @click="setOrientation('vertical')"
        >Vertical</button>
      </div>
      <button
        type="button"
        aria-label="Reverse all factors"
        title="Reverse all factors"
        :disabled="!editable || !valid"
        @click="reverseAllFactors"
      ><ArrowLeftRight :size="16" aria-hidden="true" /></button>
      <button
        type="button"
        aria-label="Reset layout"
        title="Reset layout"
        :data-layout-revision="layoutRevision"
        :disabled="!editable"
        @click="resetLayout"
      ><RotateCcw :size="16" aria-hidden="true" /></button>
      <div class="dimension-chain-background-controls">
        <input
          ref="backgroundInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          @change="onBackgroundInput"
        />
        <button
          type="button"
          aria-label="Import background image"
          title="Import background image"
          @click="openBackgroundInput"
        ><ImagePlus :size="16" aria-hidden="true" /></button>
        <label v-if="backgroundUrl" class="dimension-chain-background-opacity">
          <span>Opacity</span>
          <input
            v-model="backgroundOpacityPercent"
            type="range"
            min="10"
            max="100"
            aria-label="Background image opacity"
          />
          <output>{{ backgroundOpacityPercent }}%</output>
        </label>
        <button
          v-if="backgroundUrl"
          type="button"
          aria-label="Remove background image"
          title="Remove background image"
          @click="removeBackground"
        ><Trash2 :size="16" aria-hidden="true" /></button>
      </div>
    </div>

    <p v-if="stale" class="dimension-chain-stale" data-dimension-chain-stale role="status">
      Factor Setup changed. Select Update to refresh the dimension chain.
    </p>
    <p
      v-if="backgroundError"
      class="dimension-chain-background-error"
      data-dimension-chain-background-error
      role="status"
      aria-live="polite"
    >{{ backgroundError }}</p>

    <div
      v-if="backgroundUrl || geometry"
      ref="canvasElement"
      class="dimension-chain-canvas"
      :class="{ 'is-panning': interaction?.kind === 'pan', 'is-selecting': selectionMode }"
      data-dimension-chain-canvas
      tabindex="0"
      @wheel="onWheel"
      @paste="onPaste"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @lostpointercapture="onLostPointerCapture"
    >
      <svg
        data-dimension-chain-svg
        :data-orientation="orientation"
        :data-view-x="viewX"
        :data-view-y="viewY"
        :data-view-zoom="viewZoom"
        :viewBox="viewBox"
        :width="canvasWidth"
        :height="canvasHeight"
        role="img"
      >
        <title>Dimension chain</title>
        <desc v-if="geometry">{{ geometry.segments.length }} component loops in {{ orientation }} orientation. Filled dots mark starts and arrowheads mark ends.</desc>
        <desc v-else>Imported section image. Generate the dimension chain to add component loops.</desc>
        <defs>
          <marker
            :id="additiveMarkerId"
            data-dimension-component-marker
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="dimension-chain-additive-head" />
          </marker>
          <marker
            :id="subtractiveMarkerId"
            data-dimension-component-marker
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="dimension-chain-subtractive-head" />
          </marker>
          <marker
            :id="closureMarkerId"
            data-dimension-closure-marker
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="dimension-chain-closure-head" />
          </marker>
        </defs>

        <image
          v-if="backgroundLayout"
          data-dimension-chain-background
          class="dimension-chain-background-image"
          :href="backgroundUrl"
          :x="backgroundLayout.x"
          :y="backgroundLayout.y"
          :width="backgroundLayout.width"
          :height="backgroundLayout.height"
          :opacity="backgroundOpacity"
          preserveAspectRatio="xMidYMax meet"
          :data-natural-width="backgroundNaturalWidth"
          :data-natural-height="backgroundNaturalHeight"
          :data-image-x="backgroundLayout.x"
          :data-image-y="backgroundLayout.y"
          :data-image-width="backgroundLayout.width"
          :data-image-height="backgroundLayout.height"
        />

        <template v-if="geometry">
        <g v-for="(segment, index) in displaySegments" :key="segment.id">
          <line
            v-if="index > 0 && orientation === 'horizontal'"
            :data-dimension-guide-handle="boundaryKey(displaySegments[index - 1]!.id, segment.id)"
            class="dimension-chain-guide-handle"
            :class="{ 'is-selected': interaction?.kind === 'guide' && interaction.key === boundaryKey(displaySegments[index - 1]!.id, segment.id) }"
            :x1="axisPosition(segment.displayStart)"
            :x2="axisPosition(segment.displayStart)"
            :y1="lanePosition(index - 1, displaySegments[index - 1]!.laneOffset)"
            :y2="lanePosition(index, segment.laneOffset)"
            role="button"
            tabindex="0"
            :aria-disabled="!editable"
            :aria-label="`Move shared guide between ${displaySegments[index - 1]!.name} and ${segment.name}`"
            @pointerdown="onGuidePointerDown($event, boundaryKey(displaySegments[index - 1]!.id, segment.id))"
          />
          <line
            v-if="index > 0 && orientation === 'horizontal'"
            class="dimension-chain-guide"
            :x1="axisPosition(segment.displayStart)"
            :x2="axisPosition(segment.displayStart)"
            :y1="lanePosition(index - 1, displaySegments[index - 1]!.laneOffset)"
            :y2="lanePosition(index, segment.laneOffset)"
          />
          <line
            v-if="index > 0 && orientation === 'vertical'"
            :data-dimension-guide-handle="boundaryKey(displaySegments[index - 1]!.id, segment.id)"
            class="dimension-chain-guide-handle"
            :class="{ 'is-selected': interaction?.kind === 'guide' && interaction.key === boundaryKey(displaySegments[index - 1]!.id, segment.id) }"
            :x1="lanePosition(index - 1, displaySegments[index - 1]!.laneOffset)"
            :x2="lanePosition(index, segment.laneOffset)"
            :y1="axisPosition(segment.displayStart)"
            :y2="axisPosition(segment.displayStart)"
            role="button"
            tabindex="0"
            :aria-disabled="!editable"
            :aria-label="`Move shared guide between ${displaySegments[index - 1]!.name} and ${segment.name}`"
            @pointerdown="onGuidePointerDown($event, boundaryKey(displaySegments[index - 1]!.id, segment.id))"
          />
          <line
            v-if="index > 0 && orientation === 'vertical'"
            class="dimension-chain-guide"
            :x1="lanePosition(index - 1, displaySegments[index - 1]!.laneOffset)"
            :x2="lanePosition(index, segment.laneOffset)"
            :y1="axisPosition(segment.displayStart)"
            :y2="axisPosition(segment.displayStart)"
          />
          <g
            :data-dimension-segment="segment.itemNumber"
            :data-direction="segment.displayDirection"
            :data-value="segment.designNominal"
            :data-length="segment.length"
            :data-display-start="segment.displayStart"
            :data-display-end="segment.displayEnd"
            :data-lane-offset="segment.laneOffset"
            :class="`dimension-chain-${segment.displayDirection}`"
            role="img"
            :aria-label="segmentLabel(segment)"
          >
            <title>{{ segmentLabel(segment) }}</title>
            <template v-if="orientation === 'horizontal'">
              <line
                :data-dimension-arrow-handle="segment.id"
                class="dimension-chain-arrow-handle"
                :class="{ 'is-selected': interaction?.kind === 'arrow' && interaction.factorId === segment.id }"
                :x1="axisPosition(segment.displayStart)"
                :x2="axisPosition(segment.displayEnd)"
                :y1="lanePosition(index, segment.laneOffset)"
                :y2="lanePosition(index, segment.laneOffset)"
                role="button"
                tabindex="0"
                :aria-disabled="!editable"
                :aria-label="`Move ${segment.name} arrow lane`"
                @pointerdown="onArrowPointerDown($event, segment.id)"
              />
              <circle
                data-dimension-start
                class="dimension-chain-start"
                :cx="axisPosition(segment.displayStart)"
                :cy="lanePosition(index, segment.laneOffset)"
                r="4.5"
              />
              <line
                v-if="segment.displayDirection !== 'zero'"
                class="dimension-chain-component"
                :x1="axisPosition(segment.displayStart)"
                :x2="axisPosition(segment.displayEnd)"
                :y1="lanePosition(index, segment.laneOffset)"
                :y2="lanePosition(index, segment.laneOffset)"
                :marker-end="`url(#${componentMarkerId(segment)})`"
              />
              <line
                v-else
                data-dimension-zero
                class="dimension-chain-zero"
                :x1="axisPosition(segment.displayStart)"
                :x2="axisPosition(segment.displayStart)"
                :y1="lanePosition(index, segment.laneOffset) - 9"
                :y2="lanePosition(index, segment.laneOffset) + 9"
              />
              <text
                class="dimension-chain-label"
                :x="(axisPosition(segment.displayStart) + axisPosition(segment.displayEnd)) / 2"
                :y="lanePosition(index, segment.laneOffset) - 13"
                text-anchor="middle"
              >Item {{ segment.itemNumber }} · {{ signedValue(segment.designNominal) }}</text>
              <text
                class="dimension-chain-factor-name"
                :x="(axisPosition(segment.displayStart) + axisPosition(segment.displayEnd)) / 2"
                :y="lanePosition(index, segment.laneOffset) + 20"
                text-anchor="middle"
              >{{ displayName(segment.name) }}</text>
            </template>
            <template v-else>
              <line
                :data-dimension-arrow-handle="segment.id"
                class="dimension-chain-arrow-handle"
                :class="{ 'is-selected': interaction?.kind === 'arrow' && interaction.factorId === segment.id }"
                :x1="lanePosition(index, segment.laneOffset)"
                :x2="lanePosition(index, segment.laneOffset)"
                :y1="axisPosition(segment.displayStart)"
                :y2="axisPosition(segment.displayEnd)"
                role="button"
                tabindex="0"
                :aria-disabled="!editable"
                :aria-label="`Move ${segment.name} arrow lane`"
                @pointerdown="onArrowPointerDown($event, segment.id)"
              />
              <circle
                data-dimension-start
                class="dimension-chain-start"
                :cx="lanePosition(index, segment.laneOffset)"
                :cy="axisPosition(segment.displayStart)"
                r="4.5"
              />
              <line
                v-if="segment.displayDirection !== 'zero'"
                class="dimension-chain-component"
                :x1="lanePosition(index, segment.laneOffset)"
                :x2="lanePosition(index, segment.laneOffset)"
                :y1="axisPosition(segment.displayStart)"
                :y2="axisPosition(segment.displayEnd)"
                :marker-end="`url(#${componentMarkerId(segment)})`"
              />
              <line
                v-else
                data-dimension-zero
                class="dimension-chain-zero"
                :x1="lanePosition(index, segment.laneOffset) - 9"
                :x2="lanePosition(index, segment.laneOffset) + 9"
                :y1="axisPosition(segment.displayStart)"
                :y2="axisPosition(segment.displayStart)"
              />
              <text
                class="dimension-chain-label"
                :x="lanePosition(index, segment.laneOffset) + 13"
                :y="(axisPosition(segment.displayStart) + axisPosition(segment.displayEnd)) / 2 - 4"
              >Item {{ segment.itemNumber }} · {{ signedValue(segment.designNominal) }}</text>
              <text
                class="dimension-chain-factor-name"
                :x="lanePosition(index, segment.laneOffset) + 13"
                :y="(axisPosition(segment.displayStart) + axisPosition(segment.displayEnd)) / 2 + 13"
              >{{ displayName(segment.name) }}</text>
            </template>
          </g>
        </g>

        <g
          aria-label="Closure loop"
          data-dimension-closure-loop
          :data-start-offset="closureStartOffset()"
          :data-end-offset="closureEndOffset()"
          :data-lane-offset="closureLaneOffset()"
        >
          <template v-if="orientation === 'horizontal'">
            <line
              data-dimension-closure-guide-handle="start"
              class="dimension-chain-guide-handle"
              :class="{ 'is-selected': interaction?.kind === 'closure-guide' && interaction.endpoint === 'start' }"
              :x1="axisPosition(displaySegments[displaySegments.length - 1]!.displayEnd)"
              :x2="axisPosition(closureStartPosition())"
              :y1="lanePosition(geometry.segments.length - 1, displaySegments[displaySegments.length - 1]?.laneOffset)"
              :y2="closureLanePosition()"
              role="button"
              tabindex="0"
              :aria-disabled="!editable"
              aria-label="Move Closure start guide"
              @pointerdown="onClosureGuidePointerDown($event, 'start')"
            />
            <line
              class="dimension-chain-closure-guide"
              :x1="axisPosition(displaySegments[displaySegments.length - 1]!.displayEnd)"
              :x2="axisPosition(closureStartPosition())"
              :y1="lanePosition(geometry.segments.length - 1, displaySegments[displaySegments.length - 1]?.laneOffset)"
              :y2="closureLanePosition()"
            />
            <line
              data-dimension-closure-guide-handle="end"
              class="dimension-chain-guide-handle"
              :class="{ 'is-selected': interaction?.kind === 'closure-guide' && interaction.endpoint === 'end' }"
              :x1="axisPosition(displaySegments[0]!.displayStart)"
              :x2="axisPosition(closureEndPosition())"
              :y1="lanePosition(0, displaySegments[0]?.laneOffset)"
              :y2="closureLanePosition()"
              role="button"
              tabindex="0"
              :aria-disabled="!editable"
              aria-label="Move Closure end guide"
              @pointerdown="onClosureGuidePointerDown($event, 'end')"
            />
            <line
              class="dimension-chain-closure-guide"
              :x1="axisPosition(displaySegments[0]!.displayStart)"
              :x2="axisPosition(closureEndPosition())"
              :y1="lanePosition(0, displaySegments[0]?.laneOffset)"
              :y2="closureLanePosition()"
            />
            <circle
              data-dimension-closure-start
              class="dimension-chain-closure-start"
              :cx="axisPosition(closureStartPosition())"
              :cy="closureLanePosition()"
              r="4.5"
            />
            <path
              v-if="closureStartPosition() === closureEndPosition()"
              data-dimension-closure-arrow-handle
              class="dimension-chain-arrow-handle"
              :class="{ 'is-selected': interaction?.kind === 'closure-arrow' }"
              :d="`M ${axisPosition(closureEndPosition())} ${closureLanePosition()} c 28 -24 28 24 0 0`"
              role="button"
              tabindex="0"
              :aria-disabled="!editable"
              aria-label="Move Closure arrow lane"
              fill="none"
              @pointerdown="onClosureArrowPointerDown"
            />
            <line
              v-else
              data-dimension-closure-arrow-handle
              class="dimension-chain-arrow-handle"
              :class="{ 'is-selected': interaction?.kind === 'closure-arrow' }"
              :x1="axisPosition(closureStartPosition())"
              :x2="axisPosition(closureEndPosition())"
              :y1="closureLanePosition()"
              :y2="closureLanePosition()"
              role="button"
              tabindex="0"
              :aria-disabled="!editable"
              aria-label="Move Closure arrow lane"
              @pointerdown="onClosureArrowPointerDown"
            />
            <path
              v-if="closureStartPosition() === closureEndPosition()"
              data-dimension-closure
              class="dimension-chain-closure"
              :d="`M ${axisPosition(closureEndPosition())} ${closureLanePosition()} c 28 -24 28 24 0 0`"
              :marker-end="`url(#${closureMarkerId})`"
              fill="none"
            />
            <line
              v-else
              data-dimension-closure
              class="dimension-chain-closure"
              :x1="axisPosition(closureStartPosition())"
              :x2="axisPosition(closureEndPosition())"
              :y1="closureLanePosition()"
              :y2="closureLanePosition()"
              :marker-end="`url(#${closureMarkerId})`"
            />
            <text
              class="dimension-chain-closure-label"
              :x="(axisPosition(closureStartPosition()) + axisPosition(closureEndPosition())) / 2"
              :y="closureLanePosition() - 13"
              text-anchor="middle"
            >Closure</text>
          </template>
          <template v-else>
            <line
              data-dimension-closure-guide-handle="start"
              class="dimension-chain-guide-handle"
              :class="{ 'is-selected': interaction?.kind === 'closure-guide' && interaction.endpoint === 'start' }"
              :x1="lanePosition(geometry.segments.length - 1, displaySegments[displaySegments.length - 1]?.laneOffset)"
              :x2="closureLanePosition()"
              :y1="axisPosition(displaySegments[displaySegments.length - 1]!.displayEnd)"
              :y2="axisPosition(closureStartPosition())"
              role="button"
              tabindex="0"
              :aria-disabled="!editable"
              aria-label="Move Closure start guide"
              @pointerdown="onClosureGuidePointerDown($event, 'start')"
            />
            <line
              class="dimension-chain-closure-guide"
              :x1="lanePosition(geometry.segments.length - 1, displaySegments[displaySegments.length - 1]?.laneOffset)"
              :x2="closureLanePosition()"
              :y1="axisPosition(displaySegments[displaySegments.length - 1]!.displayEnd)"
              :y2="axisPosition(closureStartPosition())"
            />
            <line
              data-dimension-closure-guide-handle="end"
              class="dimension-chain-guide-handle"
              :class="{ 'is-selected': interaction?.kind === 'closure-guide' && interaction.endpoint === 'end' }"
              :x1="lanePosition(0, displaySegments[0]?.laneOffset)"
              :x2="closureLanePosition()"
              :y1="axisPosition(displaySegments[0]!.displayStart)"
              :y2="axisPosition(closureEndPosition())"
              role="button"
              tabindex="0"
              :aria-disabled="!editable"
              aria-label="Move Closure end guide"
              @pointerdown="onClosureGuidePointerDown($event, 'end')"
            />
            <line
              class="dimension-chain-closure-guide"
              :x1="lanePosition(0, displaySegments[0]?.laneOffset)"
              :x2="closureLanePosition()"
              :y1="axisPosition(displaySegments[0]!.displayStart)"
              :y2="axisPosition(closureEndPosition())"
            />
            <circle
              data-dimension-closure-start
              class="dimension-chain-closure-start"
              :cx="closureLanePosition()"
              :cy="axisPosition(closureStartPosition())"
              r="4.5"
            />
            <path
              v-if="closureStartPosition() === closureEndPosition()"
              data-dimension-closure-arrow-handle
              class="dimension-chain-arrow-handle"
              :class="{ 'is-selected': interaction?.kind === 'closure-arrow' }"
              :d="`M ${closureLanePosition()} ${axisPosition(closureEndPosition())} c -24 28 24 28 0 0`"
              role="button"
              tabindex="0"
              :aria-disabled="!editable"
              aria-label="Move Closure arrow lane"
              fill="none"
              @pointerdown="onClosureArrowPointerDown"
            />
            <line
              v-else
              data-dimension-closure-arrow-handle
              class="dimension-chain-arrow-handle"
              :class="{ 'is-selected': interaction?.kind === 'closure-arrow' }"
              :x1="closureLanePosition()"
              :x2="closureLanePosition()"
              :y1="axisPosition(closureStartPosition())"
              :y2="axisPosition(closureEndPosition())"
              role="button"
              tabindex="0"
              :aria-disabled="!editable"
              aria-label="Move Closure arrow lane"
              @pointerdown="onClosureArrowPointerDown"
            />
            <path
              v-if="closureStartPosition() === closureEndPosition()"
              data-dimension-closure
              class="dimension-chain-closure"
              :d="`M ${closureLanePosition()} ${axisPosition(closureEndPosition())} c -24 28 24 28 0 0`"
              :marker-end="`url(#${closureMarkerId})`"
              fill="none"
            />
            <line
              v-else
              data-dimension-closure
              class="dimension-chain-closure"
              :x1="closureLanePosition()"
              :x2="closureLanePosition()"
              :y1="axisPosition(closureStartPosition())"
              :y2="axisPosition(closureEndPosition())"
              :marker-end="`url(#${closureMarkerId})`"
            />
            <text
              class="dimension-chain-closure-label"
              :x="closureLanePosition() + 13"
              :y="(axisPosition(closureStartPosition()) + axisPosition(closureEndPosition())) / 2"
            >Closure</text>
          </template>
        </g>
        </template>
        <rect
          v-if="selectionBox"
          data-dimension-chain-selection
          class="dimension-chain-selection"
          :x="selectionBox.x"
          :y="selectionBox.y"
          :width="selectionBox.width"
          :height="selectionBox.height"
        />
      </svg>
      <p
        v-if="backgroundUrl && !geometry"
        class="dimension-chain-image-only-hint"
        data-dimension-chain-image-only-hint
      >Generate to overlay the dimension chain.</p>
      <ol v-if="geometry" class="sr-only" data-dimension-chain-accessible-list aria-label="Dimension chain components">
        <li v-for="segment in displaySegments" :key="segment.id">{{ segmentLabel(segment) }}</li>
        <li>Closure, final cumulative position to origin</li>
      </ol>
    </div>
    <p v-else class="dimension-chain-empty">Generate a dimension chain from the current Factor Setup.</p>
  </section>
</template>
