import { describe, expect, it } from "vitest";
import { createComparisonPlaceholder } from "../../workbook-catalog/src/comparison-placeholder.js";
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

  it("reports F0 as three independent available read-only knowledge modules", () => {
    const feature = getFeatureStatus("F0");

    expect(feature).toMatchObject({
      featureId: "F0",
      title: "知识库",
      status: "available",
      inputContractId: "knowledge-base-query-request-v1",
      outputContractId: "knowledge-base-query-result-v1",
      maximumClassification: "internal",
      disableBehavior: "return feature_not_available",
    });
    expect(feature?.dependsOn).toEqual(expect.arrayContaining([
      "knowledge-base-v1",
      "internal-tolerance-guidance-v1",
      "interpretation-rules-v1",
    ]));
    expect(feature?.acceptanceChecks).toEqual(
      expect.arrayContaining([
        "anonymous-knowledge-base-fixture",
        "unknown-capability-t0-fixture",
        "knowledge-base-integrity-check",
        "internal-tolerance-guidance-integrity-check",
        "guidance-only-result-fixture",
        "internal-source-evidence-dto",
        "interpretation-rules-integrity-check",
        "internal-interpretation-source-evidence",
      ]),
    );
    expect(feature?.externalPrerequisites).toEqual(
      expect.arrayContaining([
        "approved-public-knowledge-snapshot",
        "approved-internal-knowledge-snapshot",
        "approved-interpretation-rules-snapshot",
      ]),
    );
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

  it("reports root F2 as the available worksheet-isolated Initial workflow", () => {
    expect(getFeatureStatus("F2")).toEqual({
      featureId: "F2",
      title: "TA 数据清洗与能力一致性门禁",
      status: "available",
      dependsOn: [
        "knowledge-base-v1",
        "capability-item-mapping-v1",
        "worksheet-analysis-assets-v1",
        "required-field-check-v1",
        "identifier-quality-check-v1",
        "f2-initial-workflow-v1",
      ],
      inputContractId: "f2-initial-workflow-request-v1",
      outputContractId: "f2-initial-workflow-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "f0-f1-f2-real-workbook-flow",
        "f2-worksheet-isolation-check",
        "f2-blocking-policy-check",
        "f2-mapping-gap-nonblocking-check",
        "f2-privacy-check",
      ],
      externalPrerequisites: ["approved-public-knowledge-snapshot", "approved-ooxml-parser"],
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
      dependsOn: ["capability-validation-v1", "identifier-quality-check-v1", "unified-exception-resolution-v2"],
      inputContractId: "unified-exception-resolution-request-v2",
      outputContractId: "unified-exception-resolution-result-v2",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-unified-exception-resolution-fixture",
        "unified-exception-resolution-coverage-check",
        "unified-exception-resolution-privacy-check",
      ],
      externalPrerequisites: ["approved-exception-policy"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("reports F2.4 as the available identifier-quality check", () => {
    expect(getFeatureStatus("F2.4")).toEqual({
      featureId: "F2.4",
      title: "DIM ID 与 Drawing Number 质量检查",
      status: "available",
      dependsOn: ["worksheet-analysis-assets-v1", "required-field-check-v1", "identifier-quality-check-v1"],
      inputContractId: "identifier-quality-check-request-v1",
      outputContractId: "identifier-quality-check-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: ["anonymous-identifier-quality-fixture", "identifier-quality-gate-check", "identifier-quality-privacy-check"],
      externalPrerequisites: ["approved-ooxml-parser"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("registers confidential F8 Workbench while preserving the public smoke fixture", () => {
    expect(getFeatureStatus("F8")).toEqual({
      featureId: "F8",
      title: "TA Assist Agent Workbench",
      status: "available",
      dependsOn: ["f8-session-command-v1", "f8-session-snapshot-v1", "ta-conversation-turn-v1", "surface-mcp-adapter-v1"],
      inputContractId: "f8-session-command-v1",
      outputContractId: "f8-session-snapshot-v1",
      maximumClassification: "confidential",
      acceptanceChecks: ["f8-browser-integration", "f8-security-e2e", "f8-f7-placeholder-e2e", "f8-what-if-no-writeback"],
      externalPrerequisites: ["approved-ooxml-parser", "approved-surface-mcp-access"],
      disableBehavior: "return feature_not_available",
    });
    expect(getFeatureStatus("F8.public-smoke")).toMatchObject({
      featureId: "F8.public-smoke",
      inputContractId: "workflow-request-v1",
      outputContractId: "workflow-result-v1",
      maximumClassification: "public",
    });
    expect(getFeatureStatus("F7")).toMatchObject({ status: "unavailable" });
  });

  it("reports F4 as the available governed calculation engine", () => {
    expect(getFeatureStatus("F4")).toEqual({
      featureId: "F4",
      title: "方法推荐与 Excel 一致性计算",
      status: "available",
      dependsOn: [
        "worksheet-analysis-assets-v1",
        "required-field-check-v1",
        "exception-resolution-v1",
        "calculation-service-v1",
      ],
      inputContractId: "calculation-request-v1",
      outputContractId: "calculation-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-calculation-kernel-fixture",
        "approved-template-regression",
        "calculation-privacy-check",
      ],
      externalPrerequisites: ["approved-windows-excel-worker"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("registers the accepted F3 v2 governance capability", () => {
    expect(getFeatureStatus("F3")).toEqual({
      featureId: "F3",
      title: "DIM ID 与图纸治理",
      status: "available",
      dependsOn: ["f2-user-report-v1", "drawing-governance-v2", "surface-mcp-adapter-v1"],
      inputContractId: "drawing-governance-request-v2",
      outputContractId: "drawing-governance-result-v2",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-drawing-governance-fixture",
        "drawing-governance-anchor-check",
        "drawing-governance-privacy-check",
        "surface-mcp-comment-zero-confirmation-check",
      ],
      externalPrerequisites: ["approved-surface-mcp-access", "approved-comment-zero-write-policy"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("reports root F5 as available with its feature release approvals", () => {
    const feature = getFeatureStatus("F5");

    expect(feature).toEqual({
      featureId: "F5",
      title: "客观结果解释",
      status: "available",
      dependsOn: [
        "interpretation-rules-v1",
        "worksheet-analysis-assets-v1",
        "drawing-governance-v2",
        "calculation-service-v1",
      ],
      inputContractId: "f5-data-interpretation-request-v1",
      outputContractId: "f5-data-interpretation-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "f5-artifact-association-check",
        "f5-rule-traceability-check",
        "f5-clarification-gate-check",
        "f5-skill-contract-check",
      ],
      externalPrerequisites: ["approved-knowledge-base", "approved-me-review"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("reports F5.1 as the available objective interpretation capability", () => {
    expect(getFeatureStatus("F5.1")).toEqual({
      featureId: "F5.1",
      title: "客观结果解读",
      status: "available",
      dependsOn: [
        "calculation-service-v1",
        "knowledge-base-v1",
        "interpretation-rules-v1",
        "objective-interpretation-v1",
      ],
      inputContractId: "interpretation-request-v1",
      outputContractId: "interpretation-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-interpretation-fixture",
        "interpretation-rule-traceability-check",
        "interpretation-privacy-check",
      ],
      externalPrerequisites: ["approved-knowledge-base"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("reports F6 as the available governed optimization workflow", () => {
    expect(getFeatureStatus("F6")).toEqual({
      featureId: "F6",
      title: "可比较的方案选项",
      status: "available",
      dependsOn: [
        "f2-user-report-v1",
        "drawing-governance-v2",
        "calculation-service-v1",
        "f5-data-interpretation-v1",
        "f6-analysis-context-v1",
        "f6-optimization-targets-v1",
        "f6-optimization-v2",
      ],
      inputContractId: "f6-analysis-context-v1",
      outputContractId: "f6-optimization-v2",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-f6-optimization-fixture",
        "f6-artifact-association-check",
        "f6-optimization-contract-check",
        "f6-privacy-check",
        "f6-no-write-network-check",
        "f6-supplier-datum-evidence-gate-check",
        "f6-roi-gate-check",
        "f6-skill-contract-check",
        "f0-f6-real-workbook-flow",
        "f6-final-report-check",
      ],
      externalPrerequisites: ["approved-knowledge-base"],
      disableBehavior: "return feature_not_available",
    });
  });

  it("keeps the legacy F6 comparison placeholder compatible and unavailable", () => {
    expect(createComparisonPlaceholder({
      contractVersion: "v1",
      inputClassification: "confidential",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      worksheetReferences: ["controlled-worksheet-reference"],
    })).toMatchObject({
      featureId: "F6",
      status: "feature_not_available",
      requiredPrerequisites: ["approved-knowledge-base"],
    });
  });

  it("keeps F7 unavailable with its established Cpk contracts", () => {
    expect(getFeatureStatus("F7")).toEqual({
      featureId: "F7",
      title: "实测 Cpk 闭环",
      status: "unavailable",
      dependsOn: ["measurement-store-v1", "dim-id-service-v1"],
      inputContractId: "cpk-request-v1",
      outputContractId: "cpk-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: ["anonymous-cpk-fixture"],
      externalPrerequisites: ["approved-measurement-store", "canonical-dim-id-policy"],
      disableBehavior: "return feature_not_available",
    });
  });

  it.each(["F7"])(
    "keeps %s unavailable",
    (featureId) => {
      expect(getFeatureStatus(featureId)).toMatchObject({
        featureId,
        status: "unavailable",
      });
    },
  );

  it("does not expose mutable F4 register state", () => {
    const firstResult = getFeatureStatus("F4");
    const mutableResult = firstResult as unknown as {
      status: string;
      maximumClassification: string;
      dependsOn: string[];
    };

    mutableResult.status = "unavailable";
    mutableResult.maximumClassification = "public";
    mutableResult.dependsOn.push("attacker-controlled-dependency");

    expect(getFeatureStatus("F4")).toMatchObject({
      status: "available",
      maximumClassification: "confidential",
      dependsOn: [
        "worksheet-analysis-assets-v1",
        "required-field-check-v1",
        "exception-resolution-v1",
        "calculation-service-v1",
      ],
    });
  });

  it("provides a register entry for every planned feature", () => {
    for (const featureId of ["F0", "F1", "F2", "F2.1", "F2.2", "F2.3", "F2.4", "F3", "F4", "F5", "F5.1", "F6", "F7", "F8"]) {
      expect(getFeatureStatus(featureId)).toMatchObject({ featureId });
    }
  });

  it("returns undefined for an unknown feature", () => {
    expect(getFeatureStatus("F9")).toBeUndefined();
  });
});