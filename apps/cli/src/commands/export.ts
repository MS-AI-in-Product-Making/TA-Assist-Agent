import { openRunStore } from "@ai-assist/memory";

export async function runExportCommand(rootDir: string, runId: string, confirmConfidential: boolean): Promise<string> {
  const store = await openRunStore({ rootDir, runId });
  const result = await store.createExport({ confirmConfidential });
  const hasConfidential = result.manifest.artifacts.some((artifact) => artifact.classification === "confidential");
  return `classification: ${hasConfidential ? "confidential" : "public"}\nartifactCount: ${result.manifest.artifacts.length}\n`;
}