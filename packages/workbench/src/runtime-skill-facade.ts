export type RuntimeSkillPermission = "read" | "persist" | "adapter" | "network";

export interface RuntimeSkillMetadata {
  readonly skillId: string;
  readonly contractVersion: "v1";
  readonly inputClassification: "internal" | "confidential";
  readonly permissions: readonly RuntimeSkillPermission[];
  readonly idempotent: boolean;
  readonly retryable: boolean;
  readonly sideEffect: "none" | "local_persist" | "external_write";
}

export interface RuntimeSkillArtifactReference {
  readonly artifactId: string;
  readonly kind: string;
  readonly revision: number;
  readonly validated?: boolean;
}

export interface RuntimeWorksheetScope {
  readonly workbookContentHash: string;
  readonly selectedWorksheetNames: readonly string[];
  readonly confirmed?: boolean | undefined;
  readonly provenance?: "user" | "internal_fixture" | "legacy_unverified" | undefined;
}

export interface RuntimeSkillInvocation<Input> {
  readonly inputRevision: number;
  readonly idempotencyKey: string;
  readonly artifactReferences: readonly RuntimeSkillArtifactReference[];
  readonly worksheetScope?: RuntimeWorksheetScope;
  readonly input: Input;
}

export interface RuntimeSkillResult<Output> {
  readonly status: "completed" | "blocked" | "failed";
  readonly skillId: string;
  readonly inputRevision: number;
  readonly idempotencyKey: string;
  readonly output?: Output;
  readonly reasonCode?: string;
  readonly summary?: string;
  readonly error?: unknown;
}

export interface RuntimeSkillFacade<Input, Output> {
  readonly metadata: RuntimeSkillMetadata;
  invoke(invocation: RuntimeSkillInvocation<Input>): Promise<RuntimeSkillResult<Output>>;
}

export interface RuntimeSkillValidationOptions {
  readonly requireWorksheetScope?: boolean;
  readonly requiredArtifactKinds?: readonly string[];
  readonly requireConfirmedUserScope?: boolean;
}

export const TA_RUNTIME_SKILLS: readonly RuntimeSkillMetadata[] = [
  { skillId: "knowledge-and-rules-validation-v1", contractVersion: "v1", inputClassification: "internal", permissions: ["read"], idempotent: true, retryable: true, sideEffect: "none" },
  { skillId: "workbook-scope-discovery-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "persist"], idempotent: true, retryable: true, sideEffect: "local_persist" },
  { skillId: "workbook-analysis-assets-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "persist"], idempotent: true, retryable: true, sideEffect: "local_persist" },
  { skillId: "analysis-input-validation-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read"], idempotent: true, retryable: true, sideEffect: "none" },
  { skillId: "dimension-traceability-review-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "persist"], idempotent: true, retryable: true, sideEffect: "local_persist" },
  { skillId: "ado-governance-publication-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "adapter", "network"], idempotent: false, retryable: false, sideEffect: "external_write" },
  { skillId: "tolerance-performance-calculation-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "persist"], idempotent: true, retryable: true, sideEffect: "local_persist" },
  { skillId: "engineering-interpretation-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "persist"], idempotent: true, retryable: true, sideEffect: "local_persist" },
  { skillId: "improvement-evaluation-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "persist"], idempotent: true, retryable: true, sideEffect: "local_persist" },
  { skillId: "engineering-summary-report-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "persist"], idempotent: true, retryable: true, sideEffect: "local_persist" },
  { skillId: "ta-product-export-v1", contractVersion: "v1", inputClassification: "confidential", permissions: ["read", "persist"], idempotent: true, retryable: true, sideEffect: "local_persist" },
] as const;

export function runtimeSkillMetadataFor(skillId: string): RuntimeSkillMetadata {
  const matched = TA_RUNTIME_SKILLS.find((skill) => skill.skillId === skillId);
  if (matched === undefined) {
    throw new Error(`Unknown runtime skill metadata: ${skillId}`);
  }
  return matched;
}

export function validateRuntimeSkillInvocation<Input>(
  invocation: RuntimeSkillInvocation<Input>,
  options: RuntimeSkillValidationOptions = {},
): void {
  const errors: string[] = [];
  if (!Number.isInteger(invocation.inputRevision) || invocation.inputRevision < 0) {
    errors.push("inputRevision must be a non-negative integer");
  }
  if (invocation.idempotencyKey.trim().length === 0) {
    errors.push("idempotencyKey must be non-empty");
  }

  const artifactIds = new Set<string>();
  for (const reference of invocation.artifactReferences) {
    if (reference.artifactId.trim().length === 0) {
      errors.push("artifact reference artifactId must be non-empty");
    }
    if (reference.kind.trim().length === 0) {
      errors.push("artifact reference kind must be non-empty");
    }
    if (!Number.isInteger(reference.revision) || reference.revision < 0) {
      errors.push("artifact reference revision must be a non-negative integer");
    }
    if (reference.revision !== invocation.inputRevision) {
      errors.push(`artifact reference revision must match inputRevision: ${reference.artifactId}`);
    }
    if (reference.validated !== true) {
      errors.push(`artifact reference must be validated: ${reference.artifactId}`);
    }
    if (artifactIds.has(reference.artifactId)) {
      errors.push(`duplicate artifact reference id: ${reference.artifactId}`);
    }
    artifactIds.add(reference.artifactId);
  }

  if (options.requiredArtifactKinds !== undefined) {
    const presentKinds = new Set(invocation.artifactReferences.map((reference) => reference.kind));
    for (const requiredKind of options.requiredArtifactKinds) {
      if (!presentKinds.has(requiredKind)) {
        errors.push(`missing required artifact kind: ${requiredKind}`);
      }
    }
  }

  const worksheetScope = invocation.worksheetScope;
  if (options.requireWorksheetScope === true && worksheetScope === undefined) {
    errors.push("worksheetScope is required");
  }
  if (worksheetScope !== undefined) {
    if (worksheetScope.workbookContentHash.trim().length === 0) {
      errors.push("worksheetScope.workbookContentHash must be non-empty");
    }
    if (worksheetScope.selectedWorksheetNames.length === 0) {
      errors.push("worksheetScope.selectedWorksheetNames must be non-empty");
    }
    const dedupe = new Set<string>();
    for (const worksheetName of worksheetScope.selectedWorksheetNames) {
      if (worksheetName.trim().length === 0) {
        errors.push("worksheetScope.selectedWorksheetNames cannot include empty names");
      }
      if (dedupe.has(worksheetName)) {
        errors.push(`worksheetScope.selectedWorksheetNames contains duplicate: ${worksheetName}`);
      }
      dedupe.add(worksheetName);
    }
    if (options.requireConfirmedUserScope === true) {
      if (worksheetScope.confirmed !== true) {
        errors.push("worksheetScope.confirmed must be true");
      }
      if (worksheetScope.provenance !== "user") {
        errors.push("worksheetScope.provenance must be user");
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`runtime skill invocation rejected: ${errors.join("; ")}`);
  }
}
