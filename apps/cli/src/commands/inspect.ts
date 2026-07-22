import { createAuditStore } from "@ai-assist/audit";
import { openRunStore } from "@ai-assist/memory";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function runInspectCommand(rootDir: string, runId: string): Promise<string> {
  const store = await openRunStore({ rootDir, runId });
  const audit = await createAuditStore(store.runDirectory);
  const verification = await audit.verify();
  const artifacts = await store.listArtifactMetadata();
  const events = await readFile(join(store.runDirectory, "events.jsonl"), "utf8");
  return [
    `runId: ${runId}`,
    `manifestValid: ${verification.valid}`,
    `eventCount: ${events.split("\n").filter(Boolean).length}`,
    `artifactCount: ${artifacts.length}`,
  ].join("\n") + "\n";
}