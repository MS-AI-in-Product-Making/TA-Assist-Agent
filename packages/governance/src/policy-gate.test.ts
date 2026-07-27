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

  it.each([
    null,
    undefined,
    { inputClassification: "unknown", permission: "read" },
    { inputClassification: "public" },
  ])("fails closed for malformed runtime input %#", (request) => {
    expect(evaluatePolicy(request as never)).toEqual({
      allowed: false,
      reason: "policy_denied",
    });
  });

  it("fails closed when an input classification getter throws", () => {
    const request = {
      get inputClassification(): never {
        throw new Error("malformed input");
      },
      permission: "read",
    };

    expect(() => evaluatePolicy(request)).not.toThrow();
    expect(evaluatePolicy(request)).toEqual({
      allowed: false,
      reason: "policy_denied",
    });
  });

  it("reports F0 as the available public read-only knowledge base", () => {
    expect(getFeatureStatus("F0")).toEqual({
      featureId: "F0",
      title: "知识库",
      status: "available",
      dependsOn: ["knowledge-base-v1"],
      inputContractId: "knowledge-base-query-request-v1",
      outputContractId: "knowledge-base-query-result-v1",
      maximumClassification: "public",
      acceptanceChecks: [
        "anonymous-knowledge-base-fixture",
        "unknown-capability-t0-fixture",
        "knowledge-base-integrity-check",
      ],
      externalPrerequisites: ["approved-public-knowledge-snapshot"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("reports F1 as the available TA report parsing and asset preparation feature", () => {
    expect(getFeatureStatus("F1")).toEqual({
      featureId: "F1",
      title: "TA 报告解析与资产准备",
      status: "available",
      dependsOn: ["workbook-catalog-v1", "worksheet-analysis-assets-v1"],
      inputContractId: "worksheet-analysis-assets-request-v1",
      outputContractId: "worksheet-analysis-assets-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-workbook-catalog-fixture",
        "dynamic-date-cache-fixture",
        "workbook-catalog-privacy-check",
        "anonymous-worksheet-analysis-assets-fixture",
        "worksheet-image-read-privacy-check",
      ],
      externalPrerequisites: ["approved-ooxml-parser"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("reports F2.1 as the available strict required-field check only", () => {
    expect(getFeatureStatus("F2.1")).toEqual({
      featureId: "F2.1",
      title: "TA 必填字段严格校验",
      status: "available",
      dependsOn: ["worksheet-analysis-assets-v1", "required-field-check-v1"],
      inputContractId: "required-field-check-request-v1",
      outputContractId: "required-field-check-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-required-field-check-fixture",
        "required-field-blocking-check",
        "required-field-privacy-check",
      ],
      externalPrerequisites: ["approved-ooxml-parser"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("reports F2.2 as the available non-blocking capability validation", () => {
    expect(getFeatureStatus("F2.2")).toEqual({
      featureId: "F2.2",
      title: "能力库与分布一致性校验",
      status: "available",
      dependsOn: ["worksheet-analysis-assets-v1", "required-field-check-v1", "knowledge-base-v1", "capability-validation-v1"],
      inputContractId: "capability-validation-request-v1",
      outputContractId: "capability-validation-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-capability-validation-fixture",
        "capability-validation-gate-check",
        "capability-validation-nonblocking-check",
        "capability-validation-privacy-check",
      ],
      externalPrerequisites: ["approved-public-knowledge-snapshot"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("reports F2.3 as the available non-blocking exception resolution", () => {
    expect(getFeatureStatus("F2.3")).toEqual({
      featureId: "F2.3",
      title: "非阻断差异例外处理",
      status: "available",
      dependsOn: ["capability-validation-v1", "exception-resolution-v1"],
      inputContractId: "exception-resolution-request-v1",
      outputContractId: "exception-resolution-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-exception-resolution-fixture",
        "exception-resolution-coverage-check",
        "exception-resolution-privacy-check",
      ],
      externalPrerequisites: ["approved-exception-policy"],
      disableBehavior: "return feature_not_available",
    });
  });

  it.each(["F2", "F2.4", "F3", "F4", "F5", "F6", "F7"])(
    "keeps %s unavailable",
    (featureId) => {
      expect(getFeatureStatus(featureId)).toMatchObject({
        featureId,
        status: "unavailable",
      });
    },
  );

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

  it("does not expose mutable F4 register state", () => {
    const firstResult = getFeatureStatus("F4");
    const mutableResult = firstResult as unknown as {
      status: string;
      maximumClassification: string;
      dependsOn: string[];
    };

    mutableResult.status = "available";
    mutableResult.maximumClassification = "public";
    mutableResult.dependsOn.push("attacker-controlled-dependency");

    expect(getFeatureStatus("F4")).toMatchObject({
      status: "unavailable",
      maximumClassification: "confidential",
      dependsOn: ["calculation-worker-v1"],
    });
  });

  it("provides a register entry for every planned feature", () => {
    for (const featureId of ["F0", "F1", "F2", "F2.1", "F2.2", "F2.3", "F2.4", "F3", "F4", "F5", "F6", "F7", "F8"]) {
      expect(getFeatureStatus(featureId)).toMatchObject({ featureId });
    }
  });

  it("returns undefined for an unknown feature", () => {
    expect(getFeatureStatus("F9")).toBeUndefined();
  });
});