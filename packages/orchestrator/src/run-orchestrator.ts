import { randomUUID } from "node:crypto";
import { createAuditStore, hashUtf8, type AuditStore } from "@ai-assist/audit";
import { MockAdapter } from "@ai-assist/adapters";
import {
  createTypedError,
  type DataClassification,
  type PublicWorkflowResult,
  typedErrorSchema,
  workflowRequestSchema,
  workflowResultSchema,
  type TypedError,
} from "@ai-assist/contracts";
import { createRunStore } from "@ai-assist/memory";
import {
  runRegisteredSkill,
  SkillRegistry,
  type SkillRunResult,
} from "@ai-assist/skill-sdk";
import { createAnonymousSkillRegistry } from "@ai-assist/skills";
import { z } from "zod";

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
}

export interface WorkflowResult {
  readonly runId: string;
  readonly runDirectory: string;
  readonly skillResults: readonly SkillRunResult[];
  readonly manifestValid: boolean;
}

export interface RunSmokeWorkflowOptions {
  readonly rootDir: string;
  readonly request?: unknown;
}

export interface RunPublicWorkflowOptions {
  readonly rootDir: string;
  readonly request: unknown;
}

export interface SmokeWorkflowRequest {
  readonly version: 1;
  readonly kind: "public-smoke-request";
  readonly data: {
    readonly message: string;
    readonly classification: "public";
  };
}

const smokeWorkflowRequestSchema = z.object({
  version: z.literal(1),
  kind: z.literal("public-smoke-request"),
  data: z.object({
    message: z.string().trim().min(1).max(4_096),
    classification: z.literal("public"),
  }),
});

const unavailableFeatureDetailsSchema = z.object({
  featureId: z.string().min(1),
  dependencies: z.array(z.string()),
  enablementRequirements: z.array(z.string()),
});

interface WorkflowDependencies {
  readonly auditStoreFactory: (runDirectory: string) => Promise<AuditStore>;
  readonly delay: (milliseconds: number) => Promise<void>;
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
  const request = validateSmokeWorkflowRequest(options.request ?? {
    version: 1,
    kind: "public-smoke-request",
    data: { message: "public smoke", classification: "public" },
  });
  const echoAdapter = new MockAdapter({ accepted: true });

  return runWorkflow({
    rootDir: options.rootDir,
    registry: createAnonymousSkillRegistry(),
    adapters: { echo: echoAdapter },
    steps: [
      { skillId: "public-echo", input: { message: request.data.message } },
      { skillId: "classification-check", input: { classification: request.data.classification } },
    ],
  });
}

export async function runPublicWorkflow(options: RunPublicWorkflowOptions): Promise<PublicWorkflowResult> {
  const request = validatePublicWorkflowRequest(options.request);
  const workflow = await runSmokeWorkflow({
    rootDir: options.rootDir,
    request: {
      version: 1,
      kind: "public-smoke-request",
      data: { message: request.message, classification: "public" },
    },
  });
  const executedSkillIds = workflow.skillResults.map((result) => result.skillId);

  if (executedSkillIds.length !== 2 || executedSkillIds[0] !== "public-echo" || executedSkillIds[1] !== "classification-check") {
    throw createTypedError({
      code: "internal_error",
      summary: "Public workflow produced an unexpected Skill sequence.",
      suggestedAction: "Inspect the governed public workflow registration.",
      affectedInputReferences: [],
    });
  }

  const parsed = workflowResultSchema.safeParse({
    contractVersion: "v1",
    workflowId: "public-smoke",
    outputClassification: "public",
    runId: workflow.runId,
    manifestValid: workflow.manifestValid,
    executedSkillIds,
  });
  if (!parsed.success) {
    throw createTypedError({
      code: "internal_error",
      summary: "Public workflow result is invalid.",
      suggestedAction: "Inspect the governed public workflow implementation.",
      affectedInputReferences: [],
    });
  }

  return deepFreeze(structuredClone(parsed.data));
}

export async function runWorkflow(options: RunWorkflowOptions): Promise<WorkflowResult> {
  if ("runner" in (options as unknown as Record<string, unknown>)) {
    throw createTypedError({
      code: "policy_denied",
      summary: "Arbitrary Skill runners are not supported.",
      suggestedAction: "Register a trusted Skill and use the governed runtime.",
      affectedInputReferences: ["runner"],
    });
  }
  return runWorkflowWithDependencies(options, {
    auditStoreFactory: createAuditStore,
    delay: delay,
  });
}

export async function runWorkflowWithDependencies(
  options: RunWorkflowOptions,
  dependencies: WorkflowDependencies,
): Promise<WorkflowResult> {
  const runId = randomUUID();
  const runStore = await createRunStore({ rootDir: options.rootDir, runId });
  const audit = await dependencies.auditStoreFactory(runStore.runDirectory);
  const skillResults: SkillRunResult[] = [];
  let terminalStateRecorded = false;
  let runningStateRecorded = false;
  let workflowError: (Error & TypedError) | undefined;

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
          payload: {
            runId,
            ...(runningStateRecorded ? {} : { state: "running" satisfies WorkflowState }),
            skillId: step.skillId,
            attempt,
          },
        });
        runningStateRecorded = true;

        try {
          const result = await runRegisteredSkill({
            skillId: step.skillId,
            ...(step.input === undefined ? {} : { input: step.input }),
            ...(step.inputClassification === undefined ? {} : { inputClassification: step.inputClassification }),
            runId,
          }, {
            registry: options.registry,
            ...(options.adapters === undefined ? {} : { adapters: options.adapters }),
          });
          skillResults.push(result);
          await audit.append({
            type: lifecycleEventTypes.completed,
            classification: "public",
            payload: { runId, skillId: step.skillId, attempt },
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
              skillId: step.skillId,
              attempt,
              code: typedError.code,
              retrying: mayRetry,
            },
          });
          if (mayRetry) {
            await dependencies.delay(10 * (2 ** (attempt - 1)));
            continue;
          }
          throw typedError;
        }
      }
    }
  } catch (error: unknown) {
    workflowError = toWorkflowError(error, runId);
    await audit.append({
      type: lifecycleEventTypes.failed,
      classification: "public",
      payload: { runId, state: "failed" satisfies WorkflowState, code: workflowError.code },
    });
    terminalStateRecorded = true;
  }

  if (!terminalStateRecorded) {
    await audit.append({
      type: lifecycleEventTypes.completed,
      classification: "public",
      payload: { runId, state: "completed" satisfies WorkflowState },
    });
  }

  try {
    const manifestValid = await sealAndVerify(audit, runId, skillResults, options.steps);
    if (workflowError !== undefined) {
      throw enrichWorkflowError(workflowError, runStore.runDirectory);
    }
    return { runId, runDirectory: runStore.runDirectory, skillResults, manifestValid };
  } catch (error: unknown) {
    const auditError = toAuditError(error, runId);
    if (workflowError !== undefined) {
      throw enrichWorkflowError(workflowError, runStore.runDirectory, safeAuditDiagnostic(auditError));
    }
    throw enrichWorkflowError(auditError, runStore.runDirectory);
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
  const verification = await audit.verify();
  if (!verification.valid) {
    throw createTypedError({
      code: "dependency_error",
      runId,
      summary: "Audit sealing or verification failed.",
      suggestedAction: "Inspect the run storage and retry the workflow after the audit dependency is available.",
      affectedInputReferences: [],
    });
  }
  return true;
}

function validateSmokeWorkflowRequest(request: unknown): SmokeWorkflowRequest {
  const parsed = smokeWorkflowRequestSchema.safeParse(request);
  if (parsed.success) {
    return parsed.data;
  }

  const classification = isRecord(request) && isRecord(request.data) ? request.data.classification : undefined;
  throw createTypedError({
    code: classification === "secret" || classification === "internal" || classification === "confidential"
      ? "policy_denied"
      : "validation_error",
    runId: randomUUID(),
    summary: classification === "secret" || classification === "internal" || classification === "confidential"
      ? "Smoke workflows only accept public input."
      : "Smoke workflow input is invalid.",
    suggestedAction: "Provide a public smoke request with a non-empty message.",
    affectedInputReferences: ["request"],
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOwnDataProperty(record: Record<string, unknown>, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}

function toWorkflowError(error: unknown, runId: string): Error & TypedError {
  const parsed = typedErrorSchema.safeParse(error);
  if (parsed.success) {
    if (parsed.data.code === "feature_not_available") {
      const unavailableFeatureDetails = unavailableFeatureDetailsSchema.safeParse(
        isRecord(error)
          ? {
            featureId: readOwnDataProperty(error, "featureId"),
            dependencies: readOwnDataProperty(error, "dependencies"),
            enablementRequirements: readOwnDataProperty(error, "enablementRequirements"),
          }
          : undefined,
      );
      if (!unavailableFeatureDetails.success) {
        return createTypedError({
          code: "internal_error",
          runId,
          summary: "Workflow execution failed unexpectedly.",
          suggestedAction: "Inspect the audited run and contact the Skill owner.",
          affectedInputReferences: [],
        });
      }
      return createTypedError({
        code: parsed.data.code,
        runId,
        summary: parsed.data.summary,
        retryable: parsed.data.retryable,
        suggestedAction: parsed.data.suggestedAction,
        affectedInputReferences: parsed.data.affectedInputReferences,
        details: unavailableFeatureDetails.data,
      });
    }
    return createTypedError({
      code: parsed.data.code,
      runId,
      summary: parsed.data.summary,
      retryable: parsed.data.retryable,
      suggestedAction: parsed.data.suggestedAction,
      affectedInputReferences: parsed.data.affectedInputReferences,
    });
  }
  return createTypedError({
    code: "internal_error",
    runId,
    summary: "Workflow execution failed unexpectedly.",
    suggestedAction: "Inspect the audited run and contact the Skill owner.",
    affectedInputReferences: [],
  });
}

function toAuditError(error: unknown, runId: string): Error & TypedError {
  const parsed = typedErrorSchema.safeParse(error);
  if (parsed.success && (parsed.data.code === "dependency_error" || parsed.data.code === "internal_error")) {
    return createTypedError({
      code: parsed.data.code,
      runId,
      summary: parsed.data.summary,
      suggestedAction: parsed.data.suggestedAction,
      affectedInputReferences: parsed.data.affectedInputReferences,
    });
  }
  return createTypedError({
    code: "dependency_error",
    runId,
    summary: "Audit sealing or verification failed.",
    suggestedAction: "Inspect the run storage and retry the workflow after the audit dependency is available.",
    affectedInputReferences: [],
  });
}

function enrichWorkflowError(
  error: Error & TypedError,
  runDirectory: string,
  auditError?: ReturnType<typeof safeAuditDiagnostic>,
): Error & TypedError {
  const errorDetails = isRecord(error) ? error : undefined;
  const unavailableFeatureDetails = error.code === "feature_not_available" && errorDetails !== undefined
    ? unavailableFeatureDetailsSchema.safeParse({
      featureId: readOwnDataProperty(errorDetails, "featureId"),
      dependencies: readOwnDataProperty(errorDetails, "dependencies"),
      enablementRequirements: readOwnDataProperty(errorDetails, "enablementRequirements"),
    })
    : undefined;

  return createTypedError({
    code: error.code,
    runId: error.runId,
    summary: error.summary,
    retryable: error.retryable,
    suggestedAction: error.suggestedAction,
    affectedInputReferences: error.affectedInputReferences,
    details: {
      ...(unavailableFeatureDetails?.success ? unavailableFeatureDetails.data : {}),
      runDirectory,
      ...(auditError === undefined ? {} : { auditError }),
    },
  });
}

function safeAuditDiagnostic(error: TypedError): Pick<TypedError, "code" | "runId" | "summary" | "suggestedAction"> {
  return {
    code: error.code,
    runId: error.runId,
    summary: error.summary,
    suggestedAction: error.suggestedAction,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function validatePublicWorkflowRequest(request: unknown) {
  const classification = isRecord(request) ? readOwnDataProperty(request, "inputClassification") : undefined;
  if (typeof classification === "string" && classification !== "public") {
    throw createTypedError({
      code: "policy_denied",
      summary: "Public workflows only accept public input.",
      suggestedAction: "Provide a public workflow request.",
      affectedInputReferences: ["workflow-request-v1"],
    });
  }

  try {
    const parsed = workflowRequestSchema.safeParse(request);
    if (parsed.success) return parsed.data;
  } catch {}
  throw createTypedError({
    code: "validation_error",
    summary: "Public workflow input is invalid.",
    suggestedAction: "Provide a valid public workflow request.",
    affectedInputReferences: ["workflow-request-v1"],
  });
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}