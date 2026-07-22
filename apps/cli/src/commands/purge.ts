import { openRunStore } from "@ai-assist/memory";

export async function runPurgePlanCommand(rootDir: string, runId: string): Promise<string> {
  const store = await openRunStore({ rootDir, runId });
  const plan = await store.planPurge();
  return `runId: ${runId}\nscope: run\nconfirmationToken: ${plan.confirmationToken}\n`;
}

export async function runPurgeCommand(rootDir: string, runId: string, confirmationToken: string): Promise<string> {
  const store = await openRunStore({ rootDir, runId });
  await store.executePurge(confirmationToken);
  return `runId: ${runId}\npurged: true\n`;
}