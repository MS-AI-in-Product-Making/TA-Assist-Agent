import type { DataClassification } from "@ai-assist/contracts";

export type FeatureStatus = "available" | "unavailable";

export interface FeatureRegistration {
  readonly featureId: string;
  readonly title: string;
  readonly status: FeatureStatus;
  dependsOn: readonly string[];
  readonly inputContractId: string;
  readonly outputContractId: string;
  readonly maximumClassification: DataClassification;
  acceptanceChecks: readonly string[];
  externalPrerequisites: readonly string[];
  readonly disableBehavior: "return feature_not_available";
}

const unavailableFeature = (
  featureId: string,
  title: string,
  dependsOn: readonly string[],
  inputContractId: string,
  outputContractId: string,
  maximumClassification: DataClassification,
  acceptanceChecks: readonly string[],
  externalPrerequisites: readonly string[],
): FeatureRegistration => ({
  featureId,
  title,
  status: "unavailable",
  dependsOn,
  inputContractId,
  outputContractId,
  maximumClassification,
  acceptanceChecks,
  externalPrerequisites,
  disableBehavior: "return feature_not_available",
});

const featureRegister: ReadonlyMap<string, FeatureRegistration> = new Map([
  [
    "F0",
    {
      featureId: "F0",
      title: "知识库",
      status: "available",
      dependsOn: [
        "knowledge-base-v1",
        "internal-tolerance-guidance-v1",
        "interpretation-rules-v1",
      ],
      inputContractId: "knowledge-base-query-request-v1",
      outputContractId: "knowledge-base-query-result-v1",
      maximumClassification: "internal",
      acceptanceChecks: [
        "anonymous-knowledge-base-fixture",
        "unknown-capability-t0-fixture",
        "knowledge-base-integrity-check",
        "internal-tolerance-guidance-integrity-check",
        "guidance-only-result-fixture",
        "internal-source-evidence-dto",
        "interpretation-rules-integrity-check",
        "internal-interpretation-source-evidence",
      ],
      externalPrerequisites: [
        "approved-public-knowledge-snapshot",
        "approved-internal-knowledge-snapshot",
        "approved-interpretation-rules-snapshot",
      ],
      disableBehavior: "return feature_not_available",
    },
  ],
  [
    "F1",
    {
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
    },
  ],
  [
    "F1.7",
    {
      featureId: "F1.7",
      title: "TA 因子表语义识别与人工确认",
      status: "available",
      dependsOn: ["workbook-catalog-v1", "semantic-table-detection-v1"],
      inputContractId: "semantic-table-detection-request-v1",
      outputContractId: "semantic-table-detection-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-semantic-table-detection-fixture",
        "semantic-detection-failfast-check",
        "semantic-detection-privacy-check",
      ],
      externalPrerequisites: ["approved-ooxml-parser"],
      disableBehavior: "return feature_not_available",
    },
  ],
  [
    "F2",
    {
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
    },
  ],
  [
    "F2.1",
    {
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
    },
  ],
  [
    "F2.2",
    {
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
    },
  ],
  [
    "F2.3",
    {
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
    },
  ],
  [
    "F2.4",
    {
      featureId: "F2.4",
      title: "DIM ID 与 Drawing Number 质量检查",
      status: "available",
      dependsOn: ["worksheet-analysis-assets-v1", "required-field-check-v1", "identifier-quality-check-v1"],
      inputContractId: "identifier-quality-check-request-v1",
      outputContractId: "identifier-quality-check-result-v1",
      maximumClassification: "confidential",
      acceptanceChecks: [
        "anonymous-identifier-quality-fixture",
        "identifier-quality-gate-check",
        "identifier-quality-privacy-check",
      ],
      externalPrerequisites: ["approved-ooxml-parser"],
      disableBehavior: "return feature_not_available",
    },
  ],
  [
    "F3",
    {
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
      externalPrerequisites: [
        "approved-surface-mcp-access",
        "approved-comment-zero-write-policy",
      ],
      disableBehavior: "return feature_not_available",
    },
  ],
  [
    "F4",
    {
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
    },
  ],
  // These external prerequisites are feature release/enablement approvals, not per-run inputs;
  // status available records that deployment is approved. Runtime ME review remains gated by
  // review SIGNALs, clarifications/assumptions, and suppression of unsupported final RULEs;
  // physical image, artifact identity/hash, and schema evidence failures still fail closed.
  [
    "F5",
    {
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
    },
  ],
  [
    "F5.1",
    {
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
    },
  ],
  [
    "F6",
    {
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
    },
  ],
  [
    "F7",
    unavailableFeature(
      "F7",
      "实测 Cpk 闭环",
      ["measurement-store-v1", "dim-id-service-v1"],
      "cpk-request-v1",
      "cpk-result-v1",
      "confidential",
      ["anonymous-cpk-fixture"],
      ["approved-measurement-store", "canonical-dim-id-policy"],
    ),
  ],
  [
    "F8",
    {
      featureId: "F8",
      title: "TA 工作流编排",
      status: "available",
      dependsOn: ["orchestrator-v1", "skill-runtime-v1"],
      inputContractId: "workflow-request-v1",
      outputContractId: "workflow-result-v1",
      maximumClassification: "public",
      acceptanceChecks: ["anonymous-workflow-fixture", "anonymous-governed-skill"],
      externalPrerequisites: ["approved-skill-manifests"],
      disableBehavior: "return feature_not_available",
    },
  ],
]);

export function getFeatureStatus(
  featureId: string,
): FeatureRegistration | undefined {
  const registration = featureRegister.get(featureId);

  if (!registration) {
    return undefined;
  }

  return {
    ...registration,
    dependsOn: [...registration.dependsOn],
    acceptanceChecks: [...registration.acceptanceChecks],
    externalPrerequisites: [...registration.externalPrerequisites],
  };
}