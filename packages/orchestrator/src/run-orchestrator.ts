import { randomUUID } from "node:crypto";
import { createAuditStore, hashUtf8 } from "@ai-assist/audit";
import { MockAdapter } from "@ai-assist/adapters";
import { createTypedError, type DataClassification, typedErrorSchema } from "@ai-assist/contracts";
import { createRunStore } from "@ai-assist/memory";
import {
  runRegisteredSkill,
  SkillRegistry,
  type SkillRunRequest,
  type SkillRunResult,
} from "@ai-assist/skill-sdk";
import { createAnonymousSkillRegistry } from "@ai-assist/skills";

type WorkflowState = "created" | "policy_checked" | "running" | "completed" | "failed" | "purged";

export interface WorkflowStep {
  readonly skillId: string;
  readonly input?: Record<string, unknown>;
  readonly inputClassification?: DataClassification;
}

export interface RunWorkflowOptions {
  readonly rootDir: string;
  readonly registry: SkillRegistry;
  readonly steps: readonly WorkflowStep[];
  readonly adapters?: Readonly<Record<string, { execute(action: string): Promise<unknown> }>>;
  readonly runner?: (request: SkillRunRequest) => Promise<SkillRunResult>;
}

export interface WorkflowResult {
  readonly runId: string;
  readonly runDirectory: string;
  readonly skillResults: readonly SkillRunResult[];
  readonly manifestValid: boolean;
}

export interface RunSmokeWorkflowOptions {
  readonly rootDir: string;
}

const lifecycleEventTypes: Readonly<Record<WorkflowState, "run_created" | "policy_evaluated" | "skill_started" | "skill_completed" | "skill_failed" | "purge_completed">> = {
  created: "run_created",
  policy_checked: "policy_evaluated",
  running: "skill_started",
  completed: "skill_completed",
  failed: "skill_failed",
  purged: "purge_completed",
};

export async function runSmokeWorkflow(options: RunSmokeWorkflowOptions): Promise<WorkflowResult> {
  const echoAdapter = new MockAdapter({ accepted: true });

  return runWorkflow({
    rootDir: options.rootDir,
    registry: createAnonymousSkillRegistry(),
    adapters: { echo: echoAdapter },
    steps: [
      { skillId: "public-echo", input: { message: "public smoke" } },
      { skillId: "classification-check", input: { classification: "public" } },
    ],
  });
}

export async function runWorkflow(options: RunWorkflowOptions): Promise<WorkflowResult> {
  const runId = randomUUID();
  const runStore = await createRunStore({ rootDir: options.rootDir, runId });
  const audit = await createAuditStore(runStore.runDirectory);
  const runner = options.runner ?? ((request) => runRegisteredSkill(request, {
    registry: options.registry,
    ...(options.adapters === undefined ? {} : { adapters: options.adapters }),
  }));
  const skillResults: SkillRunResult[] = [];

  await runStore.recordDecision("public", { runId, state: "created" satisfies WorkflowState });
  await audit.append({
    type: lifecycleEventTypes.policy_checked,
    classification: "public",
    payload: { runId, state: "policy_checked" satisfies WorkflowState, stepCount: options.steps.length },
  });

  try {
    for (const step of options.steps) {
      const skill = options.registry.get(step.skillId);
      if (skill === undefined) {
        throw createTypedError({
          code: "policy_denied",
          runId,
          summary: `Skill '${step.skillId}' is not registered.`,
          suggestedAction: "Use a trusted registered Skill.",
          affectedInputReferences: ["skillId"],
        });
      }

      let attempt = 0;
      while (true) {
        attempt += 1;
        await audit.append({
          type: lifecycleEventTypes.running,
          classification: "public",
          payload: { runId, state: "running" satisfies WorkflowState, skillId: step.skillId, attempt },
        });

        try {
          const result = await runner({
            skillId: step.skillId,
            ...(step.input === undefined ? {} : { input: step.input }),
            ...(step.inputClassification === undefined ? {} : { inputClassification: step.inputClassification }),
            runId,
          });
          skillResults.push(result);
          await audit.append({
            type: lifecycleEventTypes.completed,
            classification: "public",
            payload: { runId, state: "completed" satisfies WorkflowState, skillId: step.skillId, attempt },
          });
          break;
        } catch (error: unknown) {
          const typedError = toWorkflowError(error, runId);
          const mayRetry = skill.manifest.retryable && typedError.code === "transient_error" && attempt <= 2;
          await audit.append({
            type: lifecycleEventTypes.failed,
            classification: "public",
            payload: {
              runId,
              state: "failed" satisfies WorkflowState,
              skillId: step.skillId,
              attempt,
              code: typedError.code,
              retrying: mayRetry,
            },
          });
          if (mayRetry) {
            continue;
          }
          throw typedError;
        }
      }
    }

    const result = await sealAndVerify(audit, runId, skillResults, options.steps);
    return { runId, runDirectory: runStore.runDirectory, skillResults, manifestValid: result };
  } catch (error: unknown) {
    const typedError = toWorkflowError(error, runId);
    await sealAndVerify(audit, runId, skillResults, options.steps);
    Object.assign(typedError, { runDirectory: runStore.runDirectory });
    throw typedError;
  }
}

async function sealAndVerify(
  audit: Awaited<ReturnType<typeof createAuditStore>>,
  runId: string,
  skillResults: readonly SkillRunResult[],
  steps: readonly WorkflowStep[],
): Promise<boolean> {
  await audit.writeManifest({
    runId,
    artifacts: [],
    skillHash: hashUtf8(JSON.stringify(steps.map(({ skillId }) => skillId))),
    configurationHash: hashUtf8(JSON.stringify({ kind: "orchestrator-v1" })),
    inputHash: hashUtf8(JSON.stringify(steps)),
    outputHash: hashUtf8(JSON.stringify(skillResults)),
  });
  return (await audit.verify()).valid;
}

function toWorkflowError(error: unknown, runId: string): Error & { code: string } {
  if (typedErrorSchema.safeParse(error).success) {
    return error as Error & { code: string };
  }
  return createTypedError({
    code: "internal_error",
    runId,
    summary: "Workflow execution failed unexpectedly.",
    suggestedAction: "Inspect the audited run and contact the Skill owner.",
    affectedInputReferences: [],
  });
}