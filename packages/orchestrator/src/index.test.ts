import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditStore, hashUtf8, type AuditStore } from "@ai-assist/audit";
import { createTypedError } from "@ai-assist/contracts";
import { SkillRegistry, type RegisteredSkill } from "@ai-assist/skill-sdk";
import { expect, it, vi } from "vitest";
import { MockAdapter } from "@ai-assist/adapters";
import { runPublicWorkflow, runSmokeWorkflow, runWorkflow } from "./index.js";
import { runWorkflowForTest } from "./run-orchestrator.test-support.js";

interface SmokeRequest {
  readonly version: 1;
  readonly kind: "public-smoke-request";
  readonly data: {
    readonly message: string;
    readonly classification: "public";
  };
}

interface SmokeExpected {
  readonly version: 1;
  readonly kind: "public-smoke-expected";
  readonly skillIds: string[];
  readonly manifestValid: boolean;
}

it("creates a verifiable public run with two Skills", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const request = JSON.parse(await readFile(new URL("../../../fixtures/public/smoke-request.json", import.meta.url), "utf8")) as SmokeRequest;
  const expected = JSON.parse(await readFile(new URL("../../../fixtures/public/smoke-expected.json", import.meta.url), "utf8")) as SmokeExpected;

  try {
    const result = await runSmokeWorkflow({ rootDir, request });

    expect(result.skillResults).toHaveLength(2);
    expect(result.skillResults.map((entry) => entry.skillId)).toEqual(expected.skillIds);
    expect(result.skillResults[0]?.output).toEqual({ message: request.data.message });
    expect(result.manifestValid).toBe(expected.manifestValid);
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/);

    const audit = await createAuditStore(result.runDirectory);
    await expect(audit.verify()).resolves.toEqual({ valid: true, failures: [] });
    await expect(audit.hasEventType("run_created")).resolves.toBe(true);
    await expect(audit.hasEventType("policy_evaluated")).resolves.toBe(true);
    await expect(audit.hasEventType("skill_started")).resolves.toBe(true);
    await expect(audit.hasEventType("skill_completed")).resolves.toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("returns a frozen public workflow result without exposing its run directory", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-public-workflow-"));

  try {
    const result = await runPublicWorkflow({
      rootDir,
      request: {
        contractVersion: "v1",
        workflowId: "public-smoke",
        inputClassification: "public",
        message: "public contract smoke",
      },
    });

    expect(result).toMatchObject({
      contractVersion: "v1",
      workflowId: "public-smoke",
      outputClassification: "public",
      manifestValid: true,
      executedSkillIds: ["public-echo", "classification-check"],
    });
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.executedSkillIds)).toBe(true);
    expect("runDirectory" in result).toBe(false);
    expect(() => { (result.executedSkillIds as string[]).push("changed"); }).toThrow();
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("denies a non-public public-workflow request", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-public-workflow-"));

  try {
    const thrown = await runPublicWorkflow({
      rootDir,
      request: {
        contractVersion: "v1",
        workflowId: "public-smoke",
        inputClassification: "confidential",
        message: "denied",
      },
    }).catch((error: unknown) => error) as Error & { code: string };

    expect(thrown.code).toBe("policy_denied");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("exports runPublicWorkflow through the built ESM package entrypoint", () => {
  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", "import { runPublicWorkflow } from '@ai-assist/orchestrator'; console.log(typeof runPublicWorkflow);"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  expect(output.trim()).toBe("function");
});

it("rejects an arbitrary runner in the public workflow options", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  let bypassExecuted = false;
  registry.register(createTestSkill("governed-skill", false, async () => ({ governed: true })));

  try {
    // @ts-expect-error Arbitrary execution callbacks are not part of the public API.
    const thrown = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "governed-skill" }],
      runner: async () => {
        bypassExecuted = true;
        return { skillId: "governed-skill", output: { bypassed: true } };
      },
    }).catch((error: unknown) => error) as Error & { code: string };

    expect(bypassExecuted).toBe(false);
    expect(thrown.code).toBe("policy_denied");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("normalizes a foreign typed Skill error to the current run and records a correlated failure", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  const foreignRunId = "11111111-1111-4111-8111-111111111111";
  registry.register(createTestSkill("denied-skill", false, async () => {
    throw createTypedError({
      code: "policy_denied",
      runId: foreignRunId,
      summary: "The requested operation is denied.",
      suggestedAction: "Use a public-only workflow.",
      affectedInputReferences: [],
    });
  }));

  try {
    const thrown = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "denied-skill" }],
    }).catch((error: unknown) => error);

    const failedRun = thrown as Error & { code: string; runId: string; runDirectory: string };
    expect(failedRun.code).toBe("policy_denied");
    expect(failedRun.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(failedRun.runId).not.toBe(foreignRunId);
    const audit = await createAuditStore(failedRun.runDirectory);
    await expect(audit.hasEventType("skill_failed")).resolves.toBe(true);
    await expect(audit.verify()).resolves.toEqual({ valid: true, failures: [] });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("preserves validated unavailable feature details while normalizing its foreign run ID", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  const foreignRunId = "22222222-2222-4222-8222-222222222222";
  registry.register({
    trusted: true,
    manifest: {
      skillId: "unavailable-f5-skill",
      version: "v1",
      featureId: "F8",
      inputClassification: ["public"],
      permissions: [],
      adapterCapabilities: [],
      idempotent: true,
      retryable: false,
      auditEventTypes: ["skill_started", "skill_completed"],
    },
    async execute() {
      throw createTypedError({
        code: "feature_not_available",
        runId: foreignRunId,
        summary: "Feature 'F5' is not available.",
        suggestedAction: "Complete its enablement requirements.",
        affectedInputReferences: [],
        details: {
          featureId: "F5",
          dependencies: ["knowledge-base-v1"],
          enablementRequirements: ["approved-knowledge-base"],
        },
      });
    },
  });

  try {
    const thrown = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "unavailable-f5-skill" }],
    }).catch((error: unknown) => error) as Error & {
      code: string;
      runId: string;
      runDirectory: string;
      featureId?: string;
      dependencies?: string[];
      enablementRequirements?: string[];
    };

    expect(thrown.code).toBe("feature_not_available");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.runId).not.toBe(foreignRunId);
    expect(thrown.featureId).toBe("F5");
    expect(thrown.dependencies).toEqual(["knowledge-base-v1"]);
    expect(thrown.enablementRequirements).toEqual(["approved-knowledge-base"]);
    const auditContents = await readFile(join(thrown.runDirectory, "events.jsonl"), "utf8");
    expect(auditContents).not.toContain("knowledge-base-v1");
    expect(auditContents).not.toContain("approved-knowledge-base");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("normalizes malformed unavailable feature details to a current-run internal error", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  const foreignRunId = "33333333-3333-4333-8333-333333333333";
  registry.register(createTestSkill("malformed-unavailable-skill", false, async () => {
    throw createTypedError({
      code: "feature_not_available",
      runId: foreignRunId,
      summary: "Feature 'F5' is not available.",
      suggestedAction: "Complete its enablement requirements.",
      affectedInputReferences: [],
      details: {
        featureId: "F5",
        dependencies: ["calculation-worker-v1", 1],
        enablementRequirements: ["approved-knowledge-base"],
      },
    });
  }));

  try {
    const thrown = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "malformed-unavailable-skill" }],
    }).catch((error: unknown) => error) as Error & { code: string; runId: string; featureId?: string };

    expect(thrown.code).toBe("internal_error");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.runId).not.toBe(foreignRunId);
    expect(thrown.featureId).toBeUndefined();
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("records only monotonic run-level lifecycle state transitions", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  registry.register(createTestSkill("first-skill", false, async () => ({ first: true })));
  registry.register(createTestSkill("second-skill", false, async () => ({ second: true })));

  try {
    const result = await runWorkflow({
      rootDir,
      registry,
      steps: [{ skillId: "first-skill" }, { skillId: "second-skill" }],
    });
    const auditContents = await readFile(join(result.runDirectory, "events.jsonl"), "utf8");
    const events = auditContents.trim().split("\n").map((line) => JSON.parse(line) as { type: string; payloadHash: string });
    const statePayloads = [
      { runId: result.runId, state: "created" },
      { runId: result.runId, state: "policy_checked", stepCount: 2 },
      { runId: result.runId, state: "running", skillId: "first-skill", attempt: 1 },
      { runId: result.runId, state: "completed" },
    ];
    const states = statePayloads.filter((payload) => events.some((event) => event.payloadHash === hashUtf8(JSON.stringify(payload))))
      .map((payload) => payload.state);

    expect(states).toEqual(["created", "policy_checked", "running", "completed"]);
    expect(events.filter((event) => event.type === "skill_completed")).toHaveLength(3);
    expect(events.filter((event) => event.type === "skill_started")).toHaveLength(2);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("normalizes audit sealing failures to a current-run dependency error", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  registry.register(createTestSkill("seal-skill", false, async () => ({ sealed: false })));

  try {
    const thrown = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "seal-skill" }],
    }, {
      auditStoreFactory: async (runDirectory) => failingSealAuditStore(await createAuditStore(runDirectory)),
    }).catch((error: unknown) => error) as Error & { code: string; runId: string; runDirectory: string };

    expect(thrown.code).toBe("dependency_error");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.runDirectory).toContain(rootDir);
    expect(Object.isFrozen(thrown)).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("preserves the primary Skill error when audit sealing also fails", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  registry.register(createTestSkill("failing-skill", false, async () => {
    throw createTypedError({
      code: "policy_denied",
      summary: "The requested operation is denied.",
      suggestedAction: "Use a public-only workflow.",
      affectedInputReferences: [],
    });
  }));

  try {
    const thrown = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "failing-skill" }],
    }, {
      auditStoreFactory: async (runDirectory) => failingSealAuditStore(await createAuditStore(runDirectory)),
    }).catch((error: unknown) => error) as Error & {
      code: string;
      runId: string;
      runDirectory: string;
      auditError?: { code: string; runId: string };
    };

    expect(thrown.code).toBe("policy_denied");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.runDirectory).toContain(rootDir);
    expect(thrown.auditError).toEqual({
      code: "dependency_error",
      runId: thrown.runId,
      summary: "Audit sealing or verification failed.",
      suggestedAction: "Inspect the run storage and retry the workflow after the audit dependency is available.",
    });
    expect(Object.isFrozen(thrown)).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("preserves frozen unavailable feature diagnostics when audit sealing also fails", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  const foreignRunId = "44444444-4444-4444-8444-444444444444";
  registry.register(createTestSkill("unavailable-seal-skill", false, async () => {
    throw createTypedError({
      code: "feature_not_available",
      runId: foreignRunId,
      summary: "Feature 'F5' is not available.",
      retryable: true,
      suggestedAction: "Complete its enablement requirements.",
      affectedInputReferences: ["input.workbook"],
      details: {
        featureId: "F5",
        dependencies: ["knowledge-base-v1"],
        enablementRequirements: ["approved-knowledge-base"],
      },
    });
  }));

  try {
    const thrown = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "unavailable-seal-skill" }],
    }, {
      auditStoreFactory: async (runDirectory) => failingSealAuditStore(await createAuditStore(runDirectory)),
    }).catch((error: unknown) => error) as Error & {
      code: string;
      runId: string;
      summary: string;
      retryable: boolean;
      suggestedAction: string;
      affectedInputReferences: string[];
      featureId: string;
      dependencies: string[];
      enablementRequirements: string[];
      auditError: { code: string; runId: string; summary: string; suggestedAction: string };
      runDirectory: string;
    };

    expect(thrown.code).toBe("feature_not_available");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.runId).not.toBe(foreignRunId);
    expect(thrown.summary).toBe("Feature 'F5' is not available.");
    expect(thrown.retryable).toBe(true);
    expect(thrown.suggestedAction).toBe("Complete its enablement requirements.");
    expect(thrown.affectedInputReferences).toEqual(["input.workbook"]);
    expect(thrown.featureId).toBe("F5");
    expect(thrown.dependencies).toEqual(["knowledge-base-v1"]);
    expect(thrown.enablementRequirements).toEqual(["approved-knowledge-base"]);
    expect(thrown.auditError).toEqual({
      code: "dependency_error",
      runId: thrown.runId,
      summary: "Audit sealing or verification failed.",
      suggestedAction: "Inspect the run storage and retry the workflow after the audit dependency is available.",
    });
    expect(thrown.runDirectory).toContain(rootDir);
    expect(Object.isFrozen(thrown)).toBe(true);
    expect(Object.isFrozen(thrown.affectedInputReferences)).toBe(true);
    expect(Object.isFrozen(thrown.dependencies)).toBe(true);
    expect(Object.isFrozen(thrown.enablementRequirements)).toBe(true);
    expect(Object.isFrozen(thrown.auditError)).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("normalizes an invalid audit verification result to a current-run dependency error", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  registry.register(createTestSkill("verify-skill", false, async () => ({ verified: false })));

  try {
    const thrown = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "verify-skill" }],
    }, {
      auditStoreFactory: async (runDirectory) => invalidVerificationAuditStore(await createAuditStore(runDirectory)),
    }).catch((error: unknown) => error) as Error & { code: string; runId: string; runDirectory: string; summary: string };

    expect(thrown.code).toBe("dependency_error");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.runDirectory).toContain(rootDir);
    expect(thrown.summary).not.toContain(rootDir);
    expect(thrown.summary).not.toContain("events.jsonl");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("preserves a primary Skill error and attaches a safe diagnostic for invalid audit verification", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  registry.register(createTestSkill("failing-verify-skill", false, async () => {
    throw createTypedError({
      code: "policy_denied",
      summary: "The requested operation is denied.",
      suggestedAction: "Use a public-only workflow.",
      affectedInputReferences: [],
    });
  }));

  try {
    const thrown = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "failing-verify-skill" }],
    }, {
      auditStoreFactory: async (runDirectory) => invalidVerificationAuditStore(await createAuditStore(runDirectory)),
    }).catch((error: unknown) => error) as Error & {
      code: string;
      runId: string;
      auditError?: { code: string; runId: string; summary: string };
    };

    expect(thrown.code).toBe("policy_denied");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(thrown.auditError).toEqual({
      code: "dependency_error",
      runId: thrown.runId,
      summary: "Audit sealing or verification failed.",
      suggestedAction: "Inspect the run storage and retry the workflow after the audit dependency is available.",
    });
    expect(thrown.auditError?.summary).not.toContain(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

it("rejects secret smoke input before creating runtime artifacts or invoking an adapter", async () => {
  const rootDir = join(await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-")), "runtime");
  const adapterExecute = vi.spyOn(MockAdapter.prototype, "execute");

  try {
    const thrown = await runSmokeWorkflow({
      rootDir,
      request: {
        version: 1,
        kind: "public-smoke-request",
        data: { message: "do not retain", classification: "secret" },
      } as unknown,
    }).catch((error: unknown) => error) as Error & { code: string; runId: string };

    expect(thrown.code).toBe("policy_denied");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(adapterExecute).not.toHaveBeenCalled();
    await expect(access(rootDir)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    adapterExecute.mockRestore();
    await rm(join(rootDir, ".."), { recursive: true, force: true });
  }
});

it("rejects malformed smoke input with a generated validation error before runtime setup", async () => {
  const rootDir = join(await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-")), "runtime");

  try {
    const thrown = await runSmokeWorkflow({
      rootDir,
      request: {
        version: 1,
        kind: "public-smoke-request",
        data: { message: "", classification: "public" },
      } as unknown,
    }).catch((error: unknown) => error) as Error & { code: string; runId: string };

    expect(thrown.code).toBe("validation_error");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(access(rootDir)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(join(rootDir, ".."), { recursive: true, force: true });
  }
});

it("rejects internal smoke input with a generated policy error before runtime setup", async () => {
  const rootDir = join(await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-")), "runtime");

  try {
    const thrown = await runSmokeWorkflow({
      rootDir,
      request: {
        version: 1,
        kind: "public-smoke-request",
        data: { message: "internal", classification: "internal" },
      } as unknown,
    }).catch((error: unknown) => error) as Error & { code: string; runId: string };

    expect(thrown.code).toBe("policy_denied");
    expect(thrown.runId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(access(rootDir)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(join(rootDir, ".."), { recursive: true, force: true });
  }
});

it("retries only retryable transient Skills with finite exponential backoff", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-assist-orchestrator-"));
  const registry = new SkillRegistry();
  let attempts = 0;
  const delays: number[] = [];
  registry.register(createTestSkill("retryable-skill", true, async () => {
    attempts += 1;
    if (attempts < 3) {
      throw createTypedError({
        code: "transient_error",
        summary: "Temporary mock failure.",
        retryable: true,
        suggestedAction: "Retry the operation.",
        affectedInputReferences: [],
      });
    }
    return { attempts };
  }));

  try {
    const result = await runWorkflowForTest({
      rootDir,
      registry,
      steps: [{ skillId: "retryable-skill" }],
    }, {
      delay: async (milliseconds) => { delays.push(milliseconds); },
    });

    expect(attempts).toBe(3);
    expect(delays).toEqual([10, 20]);
    expect(result.skillResults).toEqual([{ skillId: "retryable-skill", output: { attempts: 3 } }]);
    expect(result.manifestValid).toBe(true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

function createTestSkill(
  skillId: string,
  retryable: boolean,
  execute: RegisteredSkill["execute"],
): RegisteredSkill {
  return {
    trusted: true,
    manifest: {
      skillId,
      version: "v1",
      featureId: "F8",
      inputClassification: ["public"],
      permissions: [],
      adapterCapabilities: [],
      idempotent: true,
      retryable,
      auditEventTypes: ["skill_started", "skill_completed"],
    },
    execute,
  };
}

function failingSealAuditStore(audit: AuditStore): AuditStore {
  return {
    ...audit,
    async writeManifest() {
      throw new Error("audit storage unavailable");
    },
  };
}

function invalidVerificationAuditStore(audit: AuditStore): AuditStore {
  return {
    ...audit,
    async verify() {
      return { valid: false, failures: ["C:\\private\\runtime\\events.jsonl"] };
    },
  };
}