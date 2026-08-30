import { expect, test } from "vitest";
import {
  getPublicEngineeringRule,
  engineeringRules,
  validatePublicEngineeringRules,
} from "./public-engineering-rules.js";

function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isDeepFrozen);
}

test("default-cpk-target resolves to knowledgeBaseVersion v1 with threshold 1.33", () => {
  const result = getPublicEngineeringRule({ ruleId: "default-cpk-target" });
  expect(result).toMatchObject({ status: "matched", knowledgeBaseVersion: "v1", entry: { threshold: 1.33 } });
  expect(isDeepFrozen(result)).toBe(true);
  // runtime tests only; compile-time negative assertions moved to a type-test file
});

test("unknown ruleId returns unknown and is immutable", () => {
  const result = getPublicEngineeringRule({ ruleId: "not-a-rule" });
  expect(result).toMatchObject({ status: "unknown", knowledgeBaseVersion: "v1" });
  expect(isDeepFrozen(result)).toBe(true);
});

test("rejects invalid or duplicate controlled rules", () => {
  expect(() => validatePublicEngineeringRules([
    engineeringRules[0],
    engineeringRules[0],
  ])).toThrow(/unique/i);
  expect(() => validatePublicEngineeringRules([{
    ...engineeringRules[0],
    threshold: -1,
  }])).toThrow();
});

test("exported engineeringRules and nested provenance are deeply frozen", () => {
  expect(Object.isFrozen(engineeringRules)).toBe(true);
  for (const entry of engineeringRules as unknown as Record<string, unknown>[]) {
    expect(Object.isFrozen(entry)).toBe(true);
    if (entry && typeof entry === "object" && "provenance" in entry) {
      const prov = (entry as unknown as { provenance?: unknown }).provenance;
      expect(Object.isFrozen(prov)).toBe(true);
    }
  }
});

test("default-cpk-target canonical provenance matches expected original values", () => {
  const expectedProvenance = {
    source: "anonymous engineering estimate",
    confidence: 0.5,
    owner: "knowledge-steward",
    coverage: ["public demo coverage"],
    effectiveVersion: "v1",
    changeSummary: "公开演示知识库初始版本。",
  } as const;

  // verify canonical array entry
  const canonical = (engineeringRules as unknown as { ruleId: string; provenance?: unknown }[]).find((e) => e.ruleId === "default-cpk-target");
  expect(canonical).toBeDefined();
  // @ts-expect-error runtime assertion
  expect(canonical!.provenance).toMatchObject(expectedProvenance);

  // verify runtime query returns the same provenance
  const result = getPublicEngineeringRule({ ruleId: "default-cpk-target" });
  expect(result).toMatchObject({ status: "matched", entry: { provenance: expectedProvenance } });
});
