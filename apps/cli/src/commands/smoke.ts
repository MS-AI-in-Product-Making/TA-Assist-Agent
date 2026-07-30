import { getFeatureStatus } from "@ai-assist/governance";
import { runSmokeWorkflow } from "@ai-assist/orchestrator";

export function formatF4Status(status: string | undefined): string {
  return status === "available" ? "available" : "feature_not_available";
}

export async function runSmokeCommand(rootDir: string): Promise<string> {
  const result = await runSmokeWorkflow({ rootDir });
  const f4 = getFeatureStatus("F4");
  return [
    `runId: ${result.runId}`,
    `skillResults: ${result.skillResults.length}`,
    `manifestValid: ${result.manifestValid}`,
    `F4: ${formatF4Status(f4?.status)}`,
  ].join("\n") + "\n";
}