import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  knowledgeBaseManifestResponseSchema,
  knowledgeBaseQueryResultSchema,
  typedErrorSchema,
} from "@ai-assist/contracts";
import {
  createKnowledgeSnapshot,
  createSeedPackage,
  loadKnowledgeBase,
} from "./index.js";

const validCapabilityQuery = {
  partCategory: "demo-bracket",
  tolerance: 0.2,
  unit: "mm",
  subsystem: "mechanical-demo",
  datum: "primary-demo-datum",
};

function captureTypedError(invoke: () => unknown) {
  try {
    invoke();
  } catch (error) {
    const parsed = typedErrorSchema.safeParse(error);
    expect(parsed.success).toBe(true);
    if (parsed.success) return { error, typedError: parsed.data };
  }
  throw new Error("expected a typed error");
}

it("loads v1 and returns positive capability, rule, and terminology matches", () => {
  const knowledgeBase = loadKnowledgeBase({ version: "v1" });

  expect(knowledgeBase.getKnowledgeBaseManifest()).toMatchObject({
    knowledgeBaseVersion: "v1",
    classification: "public",
  });
  expect(knowledgeBase.findCapability(validCapabilityQuery)).toMatchObject({
    queryType: "capability",
    contractVersion: "v1",
    status: "matched",
    knowledgeBaseVersion: "v1",
    entry: { entryId: "cap-demo-bracket" },
  });
  expect(knowledgeBase.getEngineeringRule({ ruleId: "cts-sigma" })).toMatchObject({
    queryType: "rule",
    contractVersion: "v1",
    status: "matched",
    knowledgeBaseVersion: "v1",
    entry: { ruleId: "cts-sigma" },
  });
  expect(
    knowledgeBase.resolveTerminology({
      termType: "part-category",
      value: "DEMONSTRATION BRACKET",
    }),
  ).toMatchObject({
    queryType: "terminology",
    contractVersion: "v1",
    status: "matched",
    knowledgeBaseVersion: "v1",
    entry: { entryId: "demo-bracket" },
  });
});

it("returns the mandatory T0 response without feasibility fields for unavailable capabilities", () => {
  const knowledgeBase = loadKnowledgeBase({ version: "v1" });
  const expected = {
    queryType: "capability",
    status: "unknown",
    contractVersion: "v1",
    knowledgeBaseVersion: "v1",
    capabilityTier: "T0",
    message: "制程能力未知，请与供应商确认",
  };

  for (const request of [
    { ...validCapabilityQuery, partCategory: "unknown-category" },
    { ...validCapabilityQuery, tolerance: 0.31 },
    { ...validCapabilityQuery, subsystem: undefined },
    { ...validCapabilityQuery, datum: undefined },
    { ...validCapabilityQuery, subsystem: "wrong-mechanical-demo" },
    { ...validCapabilityQuery, datum: "wrong-primary-demo-datum" },
  ]) {
    const result = knowledgeBase.findCapability(request);
    expect(result).toEqual(expected);
    expect(result).not.toHaveProperty("feasible");
    expect(result).not.toHaveProperty("pass");
    expect(result).not.toHaveProperty("fail");
    expect(result).not.toHaveProperty("recommendedCapacity");
  }
});

it("returns unknown for unavailable rules and terminology without fuzzy terminology matching", () => {
  const knowledgeBase = loadKnowledgeBase({ version: "v1" });

  expect(knowledgeBase.getEngineeringRule({ ruleId: "not-a-rule" } as unknown)).toEqual({
    queryType: "rule",
    status: "unknown",
    contractVersion: "v1",
    knowledgeBaseVersion: "v1",
  });
  expect(
    knowledgeBase.resolveTerminology({
      termType: "part-category",
      value: "demonstration bracket plus",
    }),
  ).toEqual({
    queryType: "terminology",
    status: "unknown",
    contractVersion: "v1",
    knowledgeBaseVersion: "v1",
  });
  expect(
    knowledgeBase.resolveTerminology({
      termType: "datum",
      value: "demonstration bracket",
    }),
  ).toEqual({
    queryType: "terminology",
    status: "unknown",
    contractVersion: "v1",
    knowledgeBaseVersion: "v1",
  });
});

it("rejects malformed query requests with typed validation errors", () => {
  const knowledgeBase = loadKnowledgeBase({ version: "v1" });

  for (const invoke of [
    () => knowledgeBase.findCapability({ ...validCapabilityQuery, unit: "in" }),
    () => knowledgeBase.getEngineeringRule({ ruleId: "cts-sigma", extra: true }),
    () => knowledgeBase.resolveTerminology({ termType: "datum", value: "" }),
    () => knowledgeBase.findCapability(new Proxy({}, { get: () => { throw new Error("bad getter"); } })),
  ]) {
    expect(captureTypedError(invoke).typedError.code).toBe("validation_error");
  }
});

it("retains the duplicate capability library reference in validation errors", () => {
  const seed = createSeedPackage();
  seed.capabilities.push(structuredClone(seed.capabilities[0]!));

  expect(captureTypedError(() => createKnowledgeSnapshot(seed)).typedError).toMatchObject({
    code: "validation_error",
    affectedInputReferences: ["capability-library"],
  });
});

it("retains the manifest reference for a content hash mismatch", () => {
  const seed = createSeedPackage();
  seed.manifest.libraries[0]!.contentHash = "0".repeat(64);

  expect(captureTypedError(() => createKnowledgeSnapshot(seed)).typedError).toMatchObject({
    code: "validation_error",
    affectedInputReferences: ["knowledge-base-manifest"],
  });
});

it("rejects untrusted load requests with schema-valid validation errors", () => {
  const privatePath = `C:\\${["private", ".", "xls", "x"].join("")}`;

  for (const request of [{}, { version: 1 }, { version: "v1", path: privatePath }, { version: "v1", url: "https://example.test/v1" }, { version: "v1", data: {} }]) {
    const { error, typedError } = captureTypedError(() => loadKnowledgeBase(request));
    expect(typedError.code).toBe("validation_error");
    expect(JSON.stringify(error)).not.toContain(privatePath);
    expect(error.message).not.toContain(privatePath);
  }
});

it("reports unavailable versions as schema-valid F0 typed errors", () => {
  const { error, typedError } = captureTypedError(() => loadKnowledgeBase({ version: "v2" }));

  expect(typedError).toMatchObject({
    code: "feature_not_available",
    affectedInputReferences: ["knowledge-base-v1"],
  });
  expect(error).toMatchObject({
    featureId: "F0",
    dependencies: ["knowledge-base-v1"],
    enablementRequirements: ["approved-public-knowledge-snapshot"],
  });
});

it("returns fresh deeply frozen DTOs that cannot affect later queries", () => {
  const knowledgeBase = loadKnowledgeBase({ version: "v1" });
  const manifest = knowledgeBase.getKnowledgeBaseManifest();
  const capability = knowledgeBase.findCapability(validCapabilityQuery);
  const rule = knowledgeBase.getEngineeringRule({ ruleId: "cts-sigma" });
  const terminology = knowledgeBase.resolveTerminology({
    termType: "part-category",
    value: "demo-bracket",
  });

  expect(Object.isFrozen(manifest)).toBe(true);
  expect(Object.isFrozen(manifest.libraries)).toBe(true);
  expect(Object.isFrozen(capability)).toBe(true);
  expect(capability.status).toBe("matched");
  if (capability.status !== "matched") throw new Error("expected a capability match");
  expect(rule.status).toBe("matched");
  if (rule.status !== "matched") throw new Error("expected an engineering rule match");
  expect(terminology.status).toBe("matched");
  if (terminology.status !== "matched") throw new Error("expected a terminology match");
  expect(Object.isFrozen(capability.entry)).toBe(true);
  expect(Object.isFrozen(capability.entry.provenance)).toBe(true);
  expect(Object.isFrozen(rule.entry)).toBe(true);
  expect(Object.isFrozen(rule.entry.provenance)).toBe(true);
  expect(Object.isFrozen(terminology.entry)).toBe(true);
  expect(Object.isFrozen(terminology.entry.aliases)).toBe(true);
  expect(() => { manifest.changeSummary = "mutated"; }).toThrow(TypeError);
  expect(() => { capability.entry.provenance.owner = "mutated"; }).toThrow(TypeError);
  expect(() => { rule.entry.threshold = 99; }).toThrow(TypeError);
  expect(() => { terminology.entry.canonicalName = "mutated"; }).toThrow(TypeError);

  const laterManifest = knowledgeBase.getKnowledgeBaseManifest();
  const laterCapability = knowledgeBase.findCapability(validCapabilityQuery);
  const laterRule = knowledgeBase.getEngineeringRule({ ruleId: "cts-sigma" });
  const laterTerminology = knowledgeBase.resolveTerminology({
    termType: "part-category",
    value: "demo-bracket",
  });
  expect(laterManifest).not.toBe(manifest);
  expect(laterManifest.changeSummary).not.toBe("mutated");
  expect(laterCapability).not.toBe(capability);
  expect(laterCapability).toMatchObject({ entry: { provenance: { owner: "knowledge-steward" } } });
  expect(laterRule).not.toBe(rule);
  expect(laterRule.status).toBe("matched");
  if (laterRule.status !== "matched") throw new Error("expected an engineering rule match");
  expect(laterRule.entry).not.toBe(rule.entry);
  expect(laterRule.entry.threshold).toBe(6);
  expect(laterTerminology).not.toBe(terminology);
  expect(laterTerminology.status).toBe("matched");
  if (laterTerminology.status !== "matched") throw new Error("expected a terminology match");
  expect(laterTerminology.entry).not.toBe(terminology.entry);
  expect(laterTerminology.entry.canonicalName).toBe("demo-bracket");
});

it("exports loadKnowledgeBase through the built ESM package entrypoint", () => {
  const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", 'import { loadKnowledgeBase } from "@ai-assist/knowledge-base"; console.log(typeof loadKnowledgeBase);'],
    { cwd: packageDirectory, encoding: "utf8" },
  );

  expect(output.trim()).toBe("function");
});

it("returns DTOs that satisfy the strict versioned query result contract", () => {
  const knowledgeBase = loadKnowledgeBase({ version: "v1" });

  expect(knowledgeBaseManifestResponseSchema.safeParse(knowledgeBase.getKnowledgeBaseManifest()).success).toBe(true);
  for (const result of [
    knowledgeBase.findCapability(validCapabilityQuery),
    knowledgeBase.findCapability({ ...validCapabilityQuery, partCategory: "unknown-category" }),
    knowledgeBase.getEngineeringRule({ ruleId: "cts-sigma" }),
    knowledgeBase.getEngineeringRule({ ruleId: "not-a-rule" } as unknown),
    knowledgeBase.resolveTerminology({ termType: "part-category", value: "demo-bracket" }),
    knowledgeBase.resolveTerminology({ termType: "part-category", value: "unknown" }),
  ]) {
    expect(knowledgeBaseQueryResultSchema.safeParse(result).success).toBe(true);
  }
});