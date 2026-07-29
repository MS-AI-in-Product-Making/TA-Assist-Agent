import { expect, it } from "vitest";
import {
  internalToleranceGuidanceResultSchema,
  typedErrorSchema,
} from "@ai-assist/contracts";
import { loadInternalToleranceGuidance } from "../index.js";
import {
  contentHash,
  createInternalKnowledgeSnapshot,
} from "./validation.js";
import {
  createInternalToleranceGuidance,
  createInternalToleranceGuidanceFromEntries,
  createInternalSeedPackage,
} from "./test-support.js";

const cncSlotRequest = {
  processFamily: "cnc-machining",
  featureType: "slot",
  nominalValue: 4,
  nominalUnit: "mm",
  material: "steel",
  tolerance: { representation: "bilateral", value: 0.08, unit: "mm" },
};

function captureTypedError(invoke: () => unknown) {
  try {
    invoke();
  } catch (error) {
    const parsed = typedErrorSchema.safeParse(error);
    expect(parsed.success).toBe(true);
    if (parsed.success) return parsed.data;
  }
  throw new Error("expected a typed error");
}

function createTestGuidance() {
  return createInternalToleranceGuidance(createInternalKnowledgeSnapshot(createInternalSeedPackage()));
}

function createEntryTestGuidance(seed = createInternalSeedPackage()) {
  return createInternalToleranceGuidanceFromEntries(seed.entries);
}

it.each([
  ["CNC", { processFamily: "cnc-machining", featureType: "linear-dimension", nominalValue: 12, nominalUnit: "mm", tolerance: { representation: "total-band", value: 0.4, unit: "mm" } }],
  ["die casting", { processFamily: "die-casting", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "pressure-die-casting", toleranceGrade: "DCTG6" }, tolerance: { representation: "total-band", value: 0.52, unit: "mm" } }],
  ["die cutting", { processFamily: "die-cutting", featureType: "outline-profile", nominalValue: 10, nominalUnit: "mm", conditions: { materialFamily: "foam" }, tolerance: { representation: "total-band", value: 0.4, unit: "mm" } }],
  ["PCB/FPC", { processFamily: "pcb-fpc", featureType: "outline", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "pcb" }, tolerance: { representation: "total-band", value: 0.2, unit: "mm" } }],
  ["plastic injection molding", { processFamily: "plastic-injection-molding", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "injection-molding", toleranceGrade: "TG6", dimensionType: "NW" }, tolerance: { representation: "total-band", value: 0.44, unit: "mm" } }],
  ["sheet metal", { processFamily: "sheet-metal", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "formed-stamping", toleranceGrade: "m", thicknessMm: 3 }, tolerance: { representation: "total-band", value: 0.8, unit: "mm" } }],
])("loads reviewed internal-v1 guidance for %s", (_process, request) => {
  expect(loadInternalToleranceGuidance({ version: "internal-v1" }).assessToleranceGuidance(request)).toMatchObject({
    status: "within-guidance",
    knowledgeBaseVersion: "internal-v1",
  });
});

it.each([
  ["CNC", { processFamily: "cnc-machining", featureType: "linear-dimension", nominalValue: 12, nominalUnit: "mm", tolerance: { representation: "total-band", value: 0.41, unit: "mm" } }],
  ["die casting", { processFamily: "die-casting", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "pressure-die-casting", toleranceGrade: "DCTG6" }, tolerance: { representation: "total-band", value: 0.53, unit: "mm" } }],
  ["die cutting", { processFamily: "die-cutting", featureType: "outline-profile", nominalValue: 10, nominalUnit: "mm", conditions: { materialFamily: "foam" }, tolerance: { representation: "total-band", value: 0.41, unit: "mm" } }],
  ["PCB/FPC", { processFamily: "pcb-fpc", featureType: "outline", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "pcb" }, tolerance: { representation: "total-band", value: 0.21, unit: "mm" } }],
  ["plastic injection molding", { processFamily: "plastic-injection-molding", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "injection-molding", toleranceGrade: "TG6", dimensionType: "NW" }, tolerance: { representation: "total-band", value: 0.45, unit: "mm" } }],
  ["sheet metal", { processFamily: "sheet-metal", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "formed-stamping", toleranceGrade: "m", thicknessMm: 3 }, tolerance: { representation: "total-band", value: 0.81, unit: "mm" } }],
])("reports guidance-exceeded for reviewed internal-v1 %s guidance", (_process, request) => {
  expect(loadInternalToleranceGuidance({ version: "internal-v1" }).assessToleranceGuidance(request)).toMatchObject({
    status: "guidance-exceeded",
    knowledgeBaseVersion: "internal-v1",
  });
});

it.each([
  ["CNC outside its published nominal ranges", { processFamily: "cnc-machining", featureType: "linear-dimension", nominalValue: 4001, nominalUnit: "mm", tolerance: { representation: "total-band", value: 0.1, unit: "mm" } }],
  ["die casting without grade", { processFamily: "die-casting", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "pressure-die-casting" }, tolerance: { representation: "total-band", value: 0.1, unit: "mm" } }],
  ["die cutting without material family", { processFamily: "die-cutting", featureType: "outline-profile", nominalValue: 10, nominalUnit: "mm", tolerance: { representation: "total-band", value: 0.1, unit: "mm" } }],
  ["PCB/FPC without process method", { processFamily: "pcb-fpc", featureType: "outline", nominalValue: 10, nominalUnit: "mm", tolerance: { representation: "total-band", value: 0.1, unit: "mm" } }],
  ["plastic injection molding without dimension type", { processFamily: "plastic-injection-molding", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "injection-molding", toleranceGrade: "TG6" }, tolerance: { representation: "total-band", value: 0.1, unit: "mm" } }],
  ["sheet metal without thickness", { processFamily: "sheet-metal", featureType: "linear-dimension", nominalValue: 10, nominalUnit: "mm", conditions: { processMethod: "formed-stamping", toleranceGrade: "m" }, tolerance: { representation: "total-band", value: 0.1, unit: "mm" } }],
])("fails closed for reviewed internal-v1 %s", (_process, request) => {
  expect(loadInternalToleranceGuidance({ version: "internal-v1" }).assessToleranceGuidance(request)).toEqual({
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  });
});

it("assesses an exact CNC entry using an explicitly supplied test snapshot", () => {
  const guidance = createTestGuidance();

  expect(guidance.assessToleranceGuidance(cncSlotRequest)).toEqual({
    status: "guidance-exceeded",
    knowledgeBaseVersion: "internal-v1",
    matchedEntryId: "internal-cnc-slot-steel",
    assessedTotalBand: { value: 0.16, unit: "mm" },
    maximumRecommendedTotalBand: { value: 0.15, unit: "mm" },
    fallbackApplied: false,
    evidence: {
      sourceFile: "anonymized-cnc-capability-source-a",
      sourceFileHash: expect.any(String),
      sheetName: "capability-data",
      sourceRange: "A1:H12",
    },
  });
});

it("routes a validated same-priority fallback root to its terminal entry", () => {
  const seed = createInternalSeedPackage();
  const fallbackRoot = structuredClone(seed.entries[0]!);
  const terminalEntry = structuredClone(fallbackRoot);
  fallbackRoot.fallbackEntryId = "internal-cnc-diameter-terminal";
  terminalEntry.entryId = "internal-cnc-diameter-terminal";
  terminalEntry.material = undefined;
  terminalEntry.nominalRange = undefined;
  terminalEntry.fallbackEntryId = undefined;
  seed.entries = [fallbackRoot, terminalEntry];
  seed.manifest.entryCount = seed.entries.length;
  seed.manifest.entriesContentHash = contentHash(seed.entries);
  const result = createInternalToleranceGuidance(
    createInternalKnowledgeSnapshot(seed),
  ).assessToleranceGuidance({
    processFamily: "cnc-machining",
    featureType: "diameter",
    nominalValue: 8,
    nominalUnit: "mm",
    material: "aluminum",
    tolerance: { representation: "total-band", value: 0.21, unit: "mm" },
  });

  expect(result).toMatchObject({
    status: "guidance-exceeded",
    matchedEntryId: "internal-cnc-diameter-terminal",
    maximumRecommendedTotalBand: { value: 0.2, unit: "mm" },
    fallbackApplied: true,
  });
});

it("prefers a standalone exact terminal rule over an exact fallback root", () => {
  const seed = createInternalSeedPackage();
  const fallbackRoot = structuredClone(seed.entries[0]!);
  const fallbackTerminal = structuredClone(fallbackRoot);
  fallbackRoot.fallbackEntryId = "internal-cnc-diameter-fallback-terminal";
  fallbackTerminal.entryId = "internal-cnc-diameter-fallback-terminal";
  fallbackTerminal.material = undefined;
  fallbackTerminal.nominalRange = undefined;
  fallbackTerminal.fallbackEntryId = undefined;
  const directTerminal = structuredClone(fallbackRoot);
  directTerminal.entryId = "internal-cnc-diameter-direct-terminal";
  directTerminal.fallbackEntryId = undefined;
  seed.entries = [fallbackRoot, fallbackTerminal, directTerminal];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance({
    processFamily: "cnc-machining",
    featureType: "diameter",
    nominalValue: 8,
    nominalUnit: "mm",
    material: "aluminum",
    tolerance: { representation: "total-band", value: 0.21, unit: "mm" },
  })).toMatchObject({
    matchedEntryId: "internal-cnc-diameter-direct-terminal",
    fallbackApplied: false,
  });
});

it("prefers an exact material rule over a higher-priority generic rule", () => {
  const seed = createInternalSeedPackage();
  const genericEntry = structuredClone(seed.entries[1]!);
  genericEntry.entryId = "internal-cnc-slot-generic-higher-priority";
  genericEntry.material = undefined;
  genericEntry.fallbackPriority = 1;
  seed.entries.push(genericEntry);

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toMatchObject({
    matchedEntryId: "internal-cnc-slot-steel",
    fallbackApplied: false,
  });
});

it("returns unknown when an explicit fallback root has a different material", () => {
  const seed = createInternalSeedPackage();
  const directEntry = seed.entries[1]!;
  directEntry.material = "aluminum";
  const fallbackEntry = structuredClone(directEntry);
  fallbackEntry.entryId = "internal-cnc-slot-steel-explicit-fallback";
  fallbackEntry.material = undefined;
  fallbackEntry.nominalRange = undefined;
  fallbackEntry.fallbackPriority = 0;
  const unrelatedEntry = structuredClone(fallbackEntry);
  unrelatedEntry.entryId = "internal-cnc-slot-unrelated-generic";
  unrelatedEntry.fallbackPriority = 1;
  unrelatedEntry.nominalRange = { min: 9, max: 10, unit: "mm" };
  directEntry.fallbackEntryId = fallbackEntry.entryId;
  seed.entries.push(fallbackEntry, unrelatedEntry);

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toEqual({
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  });
});

it("returns the explicit generic fallback from a material-compatible fallback root", () => {
  const seed = createInternalSeedPackage();
  const fallbackRoot = seed.entries[1]!;
  fallbackRoot.material = undefined;
  const fallbackEntry = structuredClone(fallbackRoot);
  fallbackEntry.entryId = "internal-cnc-slot-steel-explicit-fallback";
  fallbackEntry.material = undefined;
  fallbackEntry.nominalRange = undefined;
  fallbackEntry.fallbackPriority = 0;
  fallbackRoot.fallbackEntryId = fallbackEntry.entryId;
  const unrelatedEntry = structuredClone(fallbackRoot);
  unrelatedEntry.entryId = "internal-cnc-slot-unrelated-explicit-fallback-root";
  unrelatedEntry.featureType = "diameter";
  unrelatedEntry.fallbackEntryId = fallbackRoot.entryId;
  seed.entries = [fallbackRoot, fallbackEntry, unrelatedEntry];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toMatchObject({
    matchedEntryId: "internal-cnc-slot-steel-explicit-fallback",
    fallbackApplied: true,
  });
});

it("fails closed when a context-specific fallback root references a missing fallback target", () => {
  const seed = createInternalSeedPackage();
  seed.entries[1]!.material = "aluminum";
  seed.entries[1]!.fallbackEntryId = "missing-entry";

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toEqual({
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  });
});

it("returns unknown for tied eligible explicit fallback roots", () => {
  const seed = createInternalSeedPackage();
  const firstFallbackRoot = seed.entries[1]!;
  firstFallbackRoot.material = "aluminum";
  const secondFallbackRoot = structuredClone(firstFallbackRoot);
  secondFallbackRoot.entryId = "internal-cnc-slot-second-tied-root";
  secondFallbackRoot.material = "brass";
  const firstFallback = structuredClone(firstFallbackRoot);
  firstFallback.entryId = "internal-cnc-slot-first-tied-fallback";
  firstFallback.material = undefined;
  firstFallback.nominalRange = undefined;
  const secondFallback = structuredClone(firstFallback);
  secondFallback.entryId = "internal-cnc-slot-second-tied-fallback";
  firstFallbackRoot.fallbackEntryId = firstFallback.entryId;
  secondFallbackRoot.fallbackEntryId = secondFallback.entryId;
  seed.entries.push(secondFallbackRoot, firstFallback, secondFallback);

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toEqual({
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  });
});

it("returns unknown when an intermediate fallback is context-invalid even if its successor is valid", () => {
  const seed = createInternalSeedPackage();
  const fallbackRoot = seed.entries[1]!;
  fallbackRoot.material = "aluminum";
  const invalidIntermediate = structuredClone(fallbackRoot);
  invalidIntermediate.entryId = "internal-cnc-slot-invalid-intermediate";
  invalidIntermediate.material = "brass";
  invalidIntermediate.fallbackPriority = 0;
  const validSuccessor = structuredClone(invalidIntermediate);
  validSuccessor.entryId = "internal-cnc-slot-valid-successor";
  validSuccessor.material = undefined;
  fallbackRoot.fallbackEntryId = invalidIntermediate.entryId;
  invalidIntermediate.fallbackEntryId = validSuccessor.entryId;
  seed.entries.push(invalidIntermediate, validSuccessor);

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toEqual({
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  });
});

it("selects a generic range rule directly when the query omits material", () => {
  const seed = createInternalSeedPackage();
  const genericEntry = structuredClone(seed.entries[1]!);
  genericEntry.entryId = "internal-cnc-slot-generic-without-fallback";
  genericEntry.material = undefined;
  genericEntry.fallbackEntryId = undefined;
  seed.entries = [genericEntry];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance({
    ...cncSlotRequest,
    material: undefined,
  })).toMatchObject({
    matchedEntryId: "internal-cnc-slot-generic-without-fallback",
    fallbackApplied: false,
  });
});

it("excludes an open nominal lower endpoint while retaining its inclusive upper endpoint", () => {
  const seed = createInternalSeedPackage();
  const rangeRule = structuredClone(seed.entries[1]!);
  rangeRule.entryId = "internal-cnc-slot-over-three-to-six";
  rangeRule.nominalRange = { min: 3, minInclusive: false, max: 6, maxInclusive: true, unit: "mm" };
  rangeRule.fallbackEntryId = undefined;
  seed.entries = [rangeRule];
  const guidance = createEntryTestGuidance(seed);

  expect(guidance.assessToleranceGuidance({ ...cncSlotRequest, nominalValue: 3 }))
    .toMatchObject({ status: "unknown", capabilityTier: "T0" });
  expect(guidance.assessToleranceGuidance({ ...cncSlotRequest, nominalValue: 6 }))
    .toMatchObject({ matchedEntryId: rangeRule.entryId });
});

it("selects a generic feature rule directly when no range rule matches", () => {
  const seed = createInternalSeedPackage();
  const genericFeatureEntry = structuredClone(seed.entries[1]!);
  genericFeatureEntry.entryId = "internal-cnc-slot-generic-feature";
  genericFeatureEntry.material = undefined;
  genericFeatureEntry.nominalRange = undefined;
  genericFeatureEntry.fallbackEntryId = undefined;
  seed.entries = [genericFeatureEntry];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toMatchObject({
    matchedEntryId: "internal-cnc-slot-generic-feature",
    fallbackApplied: false,
  });
});

it("selects a formed sheet-metal rule whose inclusive thickness band contains the request", () => {
  const seed = createInternalSeedPackage();
  const thicknessRule = structuredClone(seed.entries[2]!);
  thicknessRule.entryId = "internal-sheet-bend-formed-thickness";
  thicknessRule.conditions = { processMethod: "formed", thicknessMm: { min: 0.8, max: 1.2 } };
  seed.entries = [thicknessRule];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance({
    processFamily: "sheet-metal",
    featureType: "bend",
    nominalValue: 10,
    nominalUnit: "mm",
    material: "carbon-steel",
    conditions: { processMethod: "formed", thicknessMm: 1.2 },
    tolerance: { representation: "total-band", value: 0.4, unit: "mm" },
  })).toMatchObject({ matchedEntryId: thicknessRule.entryId, fallbackApplied: false });
});

it("excludes an open thickness lower endpoint while retaining its inclusive upper endpoint", () => {
  const seed = createInternalSeedPackage();
  const thicknessRule = structuredClone(seed.entries[2]!);
  thicknessRule.entryId = "internal-sheet-bend-formed-over-one-to-three";
  thicknessRule.conditions = {
    processMethod: "formed",
    thicknessMm: { min: 1, minInclusive: false, max: 3, maxInclusive: true },
  };
  seed.entries = [thicknessRule];
  const guidance = createEntryTestGuidance(seed);
  const request = {
    processFamily: "sheet-metal",
    featureType: "bend",
    nominalValue: 10,
    nominalUnit: "mm",
    material: "carbon-steel",
    conditions: { processMethod: "formed", thicknessMm: 1 },
    tolerance: { representation: "total-band", value: 0.4, unit: "mm" },
  };

  expect(guidance.assessToleranceGuidance(request)).toMatchObject({ status: "unknown", capabilityTier: "T0" });
  expect(guidance.assessToleranceGuidance({ ...request, conditions: { processMethod: "formed", thicknessMm: 3 } }))
    .toMatchObject({ matchedEntryId: thicknessRule.entryId });
});

it("prefers a matching condition-specific rule over a generic rule in the same direct tier", () => {
  const seed = createInternalSeedPackage();
  const genericEntry = structuredClone(seed.entries[2]!);
  genericEntry.entryId = "internal-sheet-bend-generic";
  const specificEntry = structuredClone(genericEntry);
  specificEntry.entryId = "internal-sheet-bend-formed";
  specificEntry.conditions = { processMethod: "formed" };
  genericEntry.fallbackPriority = 100;
  specificEntry.fallbackPriority = 0;
  seed.entries = [genericEntry, specificEntry];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance({
    processFamily: "sheet-metal",
    featureType: "bend",
    nominalValue: 10,
    nominalUnit: "mm",
    material: "carbon-steel",
    conditions: { processMethod: "formed" },
    tolerance: { representation: "total-band", value: 0.4, unit: "mm" },
  })).toMatchObject({ matchedEntryId: specificEntry.entryId, fallbackApplied: false });
});

it("returns unknown when a thickness-specific rule is queried without thickness", () => {
  const seed = createInternalSeedPackage();
  const thicknessRule = structuredClone(seed.entries[2]!);
  thicknessRule.entryId = "internal-sheet-bend-thickness-only";
  thicknessRule.conditions = { thicknessMm: { min: 0.8, max: 1.2 } };
  seed.entries = [thicknessRule];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance({
    processFamily: "sheet-metal",
    featureType: "bend",
    nominalValue: 10,
    nominalUnit: "mm",
    material: "carbon-steel",
    tolerance: { representation: "total-band", value: 0.4, unit: "mm" },
  })).toMatchObject({ status: "unknown", capabilityTier: "T0" });
});

it("selects only the matching injection-molding dimension type and rejects other required conditions", () => {
  const seed = createInternalSeedPackage();
  const widthRule = structuredClone(seed.entries[1]!);
  widthRule.entryId = "internal-injection-wall-width";
  widthRule.processFamily = "plastic-injection-molding";
  widthRule.featureType = "wall";
  widthRule.material = undefined;
  widthRule.nominalRange = undefined;
  widthRule.conditions = { processMethod: "injection", dimensionType: "W", toleranceGrade: "TG6" };
  const nonWidthRule = structuredClone(widthRule);
  nonWidthRule.entryId = "internal-injection-wall-non-width";
  nonWidthRule.conditions = { processMethod: "injection", dimensionType: "NW", toleranceGrade: "TG6" };
  seed.entries = [widthRule, nonWidthRule];
  const guidance = createEntryTestGuidance(seed);
  const baseRequest = {
    processFamily: "plastic-injection-molding" as const,
    featureType: "wall",
    nominalValue: 2,
    nominalUnit: "mm" as const,
    tolerance: { representation: "total-band" as const, value: 0.1, unit: "mm" as const },
  };

  expect(guidance.assessToleranceGuidance({
    ...baseRequest,
    conditions: { processMethod: "injection", dimensionType: "W", toleranceGrade: "TG6" },
  })).toMatchObject({ matchedEntryId: widthRule.entryId });
  expect(guidance.assessToleranceGuidance({
    ...baseRequest,
    conditions: { processMethod: "injection", dimensionType: "NW", toleranceGrade: "TG6" },
  })).toMatchObject({ matchedEntryId: nonWidthRule.entryId });
  expect(guidance.assessToleranceGuidance({
    ...baseRequest,
    conditions: { processMethod: "injection", dimensionType: "W", toleranceGrade: "TG7" },
  })).toMatchObject({ status: "unknown", capabilityTier: "T0" });
  expect(guidance.assessToleranceGuidance({
    ...baseRequest,
    conditions: { processMethod: "compression", dimensionType: "W", toleranceGrade: "TG6" },
  })).toMatchObject({ status: "unknown", capabilityTier: "T0" });
});

it("returns unknown for tied best condition-specific candidates", () => {
  const seed = createInternalSeedPackage();
  const first = structuredClone(seed.entries[2]!);
  first.entryId = "internal-sheet-bend-formed-first";
  first.conditions = { processMethod: "formed" };
  const second = structuredClone(first);
  second.entryId = "internal-sheet-bend-formed-second";
  seed.entries = [first, second];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance({
    processFamily: "sheet-metal",
    featureType: "bend",
    nominalValue: 10,
    nominalUnit: "mm",
    material: "carbon-steel",
    conditions: { processMethod: "formed" },
    tolerance: { representation: "total-band", value: 0.4, unit: "mm" },
  })).toMatchObject({ status: "unknown", capabilityTier: "T0" });
});

it("returns unknown for tied top-priority generic range candidates", () => {
  const seed = createInternalSeedPackage();
  const firstGenericRange = structuredClone(seed.entries[1]!);
  firstGenericRange.entryId = "internal-cnc-slot-generic-range-first";
  firstGenericRange.material = undefined;
  firstGenericRange.fallbackEntryId = undefined;
  const secondGenericRange = structuredClone(firstGenericRange);
  secondGenericRange.entryId = "internal-cnc-slot-generic-range-second";
  seed.entries = [firstGenericRange, secondGenericRange];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toEqual({
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  });
});

it("returns unknown for tied top-priority generic feature candidates", () => {
  const seed = createInternalSeedPackage();
  const firstGenericFeature = structuredClone(seed.entries[1]!);
  firstGenericFeature.entryId = "internal-cnc-slot-generic-feature-first";
  firstGenericFeature.material = undefined;
  firstGenericFeature.nominalRange = undefined;
  firstGenericFeature.fallbackEntryId = undefined;
  const secondGenericFeature = structuredClone(firstGenericFeature);
  secondGenericFeature.entryId = "internal-cnc-slot-generic-feature-second";
  seed.entries = [firstGenericFeature, secondGenericFeature];

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toEqual({
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  });
});

it("treats equal guidance as within and normalizes unilateral tolerances", () => {
  const guidance = createTestGuidance();
  const result = guidance.assessToleranceGuidance({
    ...cncSlotRequest,
    tolerance: {
      representation: "unilateral",
      value: 0.15,
      upperValue: 0.15,
      lowerValue: 0,
      unit: "mm",
    },
  });

  expect(result).toMatchObject({
    status: "within-guidance",
    assessedTotalBand: { value: 0.15, unit: "mm" },
  });
});

it("returns the exact unknown T0 DTO for unavailable guidance", () => {
  const guidance = createTestGuidance();
  const expected = {
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  };

  for (const request of [
    { ...cncSlotRequest, featureType: "missing-feature" },
    { ...cncSlotRequest, nominalValue: 9 },
  ]) {
    expect(guidance.assessToleranceGuidance(request)).toEqual(expected);
  }
});

it("rejects tied-priority matching entries rather than permitting arbitrary selection", () => {
  const seed = createInternalSeedPackage();
  const tiedEntry = structuredClone(seed.entries[1]!);
  tiedEntry.entryId = "internal-cnc-slot-steel-tied";
  seed.entries.push(tiedEntry);
  seed.manifest.entriesContentHash = contentHash(seed.entries);
  seed.manifest.entryCount = seed.entries.length;

  expect(captureTypedError(() => createInternalKnowledgeSnapshot(seed)).code).toBe("validation_error");
});

it("returns unknown when a loaded snapshot presents tied top-priority candidates", () => {
  const seed = createInternalSeedPackage();
  const tiedEntry = structuredClone(seed.entries[1]!);
  tiedEntry.entryId = "internal-cnc-slot-steel-runtime-tied";
  seed.entries.push(tiedEntry);

  expect(createEntryTestGuidance(seed).assessToleranceGuidance(cncSlotRequest)).toEqual({
    status: "unknown",
    knowledgeBaseVersion: "internal-v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  });
});

it("rejects invalid versions and non-mm request units with typed validation errors", () => {
  expect(captureTypedError(() => loadInternalToleranceGuidance({ version: "v1" })).code).toBe("validation_error");

  const guidance = createTestGuidance();
  expect(captureTypedError(() => guidance.assessToleranceGuidance({
    ...cncSlotRequest,
    tolerance: { representation: "total-band", value: 0.1, unit: "in" },
  })).code).toBe("validation_error");
});

it("returns fresh deeply frozen DTOs that satisfy the internal result contract", () => {
  const guidance = createTestGuidance();
  const first = guidance.assessToleranceGuidance(cncSlotRequest);
  const second = guidance.assessToleranceGuidance(cncSlotRequest);

  expect(internalToleranceGuidanceResultSchema.safeParse(first).success).toBe(true);
  expect(Object.isFrozen(first)).toBe(true);
  expect(first.status).not.toBe("unknown");
  if (first.status === "unknown") throw new Error("expected a matched result");
  expect(Object.isFrozen(first.assessedTotalBand)).toBe(true);
  expect(Object.isFrozen(first.evidence)).toBe(true);
  expect(() => { first.evidence.sheetName = "mutated"; }).toThrow(TypeError);
  expect(second).not.toBe(first);
  expect(second.status).not.toBe("unknown");
  if (second.status === "unknown") throw new Error("expected a matched result");
  expect(second.evidence.sheetName).toBe("capability-data");
  expect(Object.keys(first)).not.toContain("feasible");
  expect(Object.keys(first)).not.toContain("pass");
  expect(Object.keys(first)).not.toContain("fail");
  expect(Object.keys(first)).not.toContain("tooTight");
  expect(Object.keys(first)).not.toContain("minimumAchievable");
});