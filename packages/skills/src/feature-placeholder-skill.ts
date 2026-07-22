import { getFeatureStatus } from "@ai-assist/governance";

export interface FeatureNotAvailable {
  readonly code: "feature_not_available";
  readonly featureId: string;
  readonly dependencies: readonly string[];
  readonly enablementRequirements: readonly string[];
}

export function featureNotAvailable(featureId: string): FeatureNotAvailable {
  const feature = getFeatureStatus(featureId);
  return {
    code: "feature_not_available",
    featureId,
    dependencies: feature?.dependsOn ?? [],
    enablementRequirements: feature?.externalPrerequisites ?? [],
  };
}