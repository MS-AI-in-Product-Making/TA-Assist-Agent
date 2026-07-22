import { createAuditStore, type AuditStore } from "@ai-assist/audit";
import type { RunWorkflowOptions, WorkflowResult } from "./run-orchestrator.js";
import { runWorkflowWithDependencies } from "./run-orchestrator.js";

export interface WorkflowTestDependencies {
  readonly auditStoreFactory?: (runDirectory: string) => Promise<AuditStore>;
  readonly delay?: (milliseconds: number) => Promise<void>;
}

export function runWorkflowForTest(
  options: RunWorkflowOptions,
  dependencies: WorkflowTestDependencies,
): Promise<WorkflowResult> {
  return runWorkflowWithDependencies(options, {
    auditStoreFactory: dependencies.auditStoreFactory ?? createAuditStore,
    delay: dependencies.delay ?? ((milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))),
  });
}