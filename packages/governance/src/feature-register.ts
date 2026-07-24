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
    "F2",
    unavailableFeature(
      "F2",
      "TA 风险与行动建议",
      ["quality-rules-v1", "recommendation-engine-v1"],
      "recommendation-request-v1",
      "recommendation-result-v1",
      "confidential",
      ["anonymous-recommendation-fixture"],
      ["approved-recommendation-rules"],
    ),
  ],
  [
    "F3",
    unavailableFeature(
      "F3",
      "DIM ID 与图纸治理",
      ["dim-id-service-v1"],
      "drawing-governance-request-v1",
      "drawing-governance-result-v1",
      "confidential",
      ["anonymous-dim-id-fixture"],
      ["approved-ado-access", "canonical-dim-id-policy"],
    ),
  ],
  [
    "F4",
    unavailableFeature(
      "F4",
      "方法推荐与 Excel 一致性计算",
      ["calculation-worker-v1"],
      "calculation-request-v1",
      "calculation-result-v1",
      "confidential",
      ["approved-template-regression"],
      ["approved-windows-excel-worker"],
    ),
  ],
  [
    "F5",
    unavailableFeature(
      "F5",
      "客观结果解释",
      ["calculation-worker-v1", "knowledge-base-v1"],
      "interpretation-request-v1",
      "interpretation-result-v1",
      "confidential",
      ["anonymous-interpretation-fixture"],
      ["approved-knowledge-base"],
    ),
  ],
  [
    "F6",
    unavailableFeature(
      "F6",
      "可比较的方案选项",
      ["knowledge-base-v1", "comparison-engine-v1"],
      "comparison-request-v1",
      "comparison-result-v1",
      "confidential",
      ["anonymous-comparison-fixture"],
      ["approved-knowledge-base"],
    ),
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