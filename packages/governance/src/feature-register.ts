import type { DataClassification } from "@ai-assist/contracts";

export type FeatureStatus = "unavailable";

export interface FeatureRegistration {
  featureId: string;
  title: string;
  status: FeatureStatus;
  dependsOn: readonly string[];
  inputContractId: string;
  outputContractId: string;
  maximumClassification: DataClassification;
  acceptanceChecks: readonly string[];
  externalPrerequisites: readonly string[];
  disableBehavior: "return feature_not_available";
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
    unavailableFeature(
      "F0",
      "TA 工作簿基础解析",
      ["workbook-parser-v1"],
      "workbook-request-v1",
      "workbook-summary-v1",
      "confidential",
      ["anonymous-workbook-fixture"],
      ["approved-workbook-parser"],
    ),
  ],
  [
    "F1",
    unavailableFeature(
      "F1",
      "TA 数据质量检查",
      ["workbook-parser-v1", "quality-rules-v1"],
      "quality-check-request-v1",
      "quality-check-result-v1",
      "confidential",
      ["anonymous-quality-fixture"],
      ["approved-quality-rules"],
    ),
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
    unavailableFeature(
      "F8",
      "TA 工作流编排",
      ["orchestrator-v1", "skill-runtime-v1"],
      "workflow-request-v1",
      "workflow-result-v1",
      "internal",
      ["anonymous-workflow-fixture"],
      ["approved-skill-manifests"],
    ),
  ],
]);

export function getFeatureStatus(
  featureId: string,
): FeatureRegistration | undefined {
  return featureRegister.get(featureId);
}