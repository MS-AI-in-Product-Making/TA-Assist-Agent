import { getFeatureStatus } from "@ai-assist/governance";
import { runSmokeWorkflow } from "@ai-assist/orchestrator";

export async function runSmokeCommand(rootDir: string): Promise<string> {
  const result = await runSmokeWorkflow({ rootDir });
  const f4 = getFeatureStatus("F4");
  return [
    `runId: ${result.runId}`,
    `skillResults: ${result.skillResults.length}`,
    `manifestValid: ${result.manifestValid}`,
    `F4: ${f4?.status === "unavailable" ? "feature_not_available" : "available"}`,
  ].join("\n") + "\n";
}