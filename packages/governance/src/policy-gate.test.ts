import { describe, expect, it } from "vitest";
import { evaluatePolicy, getFeatureStatus } from "./index.js";

describe("policy gate", () => {
  it("denies secret persistence", () => {
    expect(
      evaluatePolicy({ inputClassification: "secret", permission: "persist" }),
    ).toEqual({ allowed: false, reason: "policy_denied" });
  });

  it("denies undeclared network access", () => {
    expect(
      evaluatePolicy({ inputClassification: "public", permission: "network" }),
    ).toEqual({ allowed: false, reason: "policy_denied" });
  });

  it("denies the default adapter", () => {
    expect(
      evaluatePolicy({ inputClassification: "public", permission: "adapter" }),
    ).toEqual({ allowed: false, reason: "policy_denied" });
  });

  it("allows an explicitly low-risk public read", () => {
    expect(
      evaluatePolicy({ inputClassification: "public", permission: "read" }),
    ).toEqual({ allowed: true });
  });

  it("reports F4 as unavailable", () => {
    expect(getFeatureStatus("F4")).toEqual({
      featureId: "F4",
      title: "方法推荐与 Excel 一致性计算",
      status: "unavailable",
      dependsOn: ["calculation-worker-v1"],
      inputContractId: "calculation-request-v1",
      outputContractId: "calculation-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: ["approved-template-regression"],
      externalPrerequisites: ["approved-windows-excel-worker"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("provides a register entry for every planned feature", () => {
    for (const featureId of ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"]) {
      expect(getFeatureStatus(featureId)).toMatchObject({ featureId });
    }
  });

  it("returns undefined for an unknown feature", () => {
    expect(getFeatureStatus("F9")).toBeUndefined();
  });
});