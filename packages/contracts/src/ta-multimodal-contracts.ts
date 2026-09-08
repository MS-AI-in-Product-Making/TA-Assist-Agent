import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const nonEmptyStringSchema = z.string().min(1).refine((value) => value.trim().length > 0, "must not be blank");
const worksheetCellSchema = z.string().regex(/^[^!]+![A-Z]+[1-9]\d*$/);
const relativeArtifactPathSchema = z.string().min(1).refine((value) => (
  !value.includes("\\")
  && !value.startsWith("/")
  && !/^[A-Za-z]:/.test(value)
  && value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
), "artifact path must be a normalized relative path");

export const f5MultimodalFactorOrdinalV3Schema = z.object({
  value: nonEmptyStringSchema,
  rawText: nonEmptyStringSchema,
  sourceCell: worksheetCellSchema,
}).strict();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function canonicalHash(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(canonicalize(value)))));
}

export function createF5MultimodalFactorSetHash(factorRows: readonly unknown[]): string {
  return canonicalHash(factorRows);
}

export function createF5MultimodalRequestHash(request: Readonly<Record<string, unknown>>): string {
  const { requestHash: _requestHash, ...payload } = request;
  return canonicalHash(payload);
}

export const f5MultimodalFactorRowV3Schema = z.object({
  worksheetName: nonEmptyStringSchema,
  tableId: nonEmptyStringSchema,
  sourceRow: z.number().int().positive(),
  factorOrdinal: f5MultimodalFactorOrdinalV3Schema,
  factorName: nonEmptyStringSchema,
  partName: nonEmptyStringSchema,
  partCategory: nonEmptyStringSchema,
  drawingNumber: nonEmptyStringSchema.nullable(),
  dimId: nonEmptyStringSchema.nullable(),
  nominal: z.number().finite(),
  upperTolerance: z.number().finite(),
  lowerTolerance: z.number().finite(),
  longTermSafetyFactor: z.number().finite().positive(),
  sigmaLevel: z.number().finite().positive(),
  distribution: nonEmptyStringSchema,
  sourceCells: z.record(nonEmptyStringSchema, worksheetCellSchema),
}).strict();

function normalizedOrdinal(value: string): string {
  return value.trim().toUpperCase();
}

function rowIdentity(row: { worksheetName: string; tableId: string; sourceRow: number }): string {
  return `${row.worksheetName}\u0000${row.tableId}\u0000${row.sourceRow}`;
}

export const f5MultimodalWorksheetRequestV3Schema = z.object({
  contractVersion: z.literal("f5-multimodal-request-v3"),
  inputClassification: z.literal("confidential"),
  requestHash: sha256Schema,
  sessionId: nonEmptyStringSchema,
  revision: z.number().int().nonnegative(),
  inputRevision: z.number().int().nonnegative(),
  workbook: z.object({ fileName: nonEmptyStringSchema, contentHash: sha256Schema }).strict(),
  worksheetName: nonEmptyStringSchema,
  tableId: nonEmptyStringSchema,
  activeFactorCount: z.number().int().positive(),
  factorSetHash: sha256Schema,
  image: z.object({
    mediaType: z.enum(["image/png", "image/jpeg"]),
    contentHash: sha256Schema,
    byteLength: z.number().int().positive(),
    artifactPath: relativeArtifactPathSchema,
  }).strict(),
  factorRows: z.array(f5MultimodalFactorRowV3Schema).min(1),
}).strict().superRefine((request, context) => {
  if (request.factorRows.length !== request.activeFactorCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "factorRows must contain every active Factor", path: ["factorRows"] });
  }
  if (request.factorSetHash !== createF5MultimodalFactorSetHash(request.factorRows)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "factorSetHash must bind the complete ordered Factor set", path: ["factorSetHash"] });
  }
  if (request.requestHash !== createF5MultimodalRequestHash(request)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "requestHash must bind the canonical request payload", path: ["requestHash"] });
  }
  const identities = new Set<string>();
  const ordinals = new Set<string>();
  request.factorRows.forEach((row, index) => {
    if (row.worksheetName !== request.worksheetName) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Factor worksheet must match request worksheet", path: ["factorRows", index, "worksheetName"] });
    }
    if (row.tableId !== request.tableId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Factor table must match request table", path: ["factorRows", index, "tableId"] });
    }
    const identity = rowIdentity(row);
    if (identities.has(identity)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "active Factor identities must be unique", path: ["factorRows", index] });
    }
    identities.add(identity);
    const ordinal = normalizedOrdinal(row.factorOrdinal.value);
    if (ordinals.has(ordinal)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "active Factor ordinals must be unique", path: ["factorRows", index, "factorOrdinal"] });
    }
    ordinals.add(ordinal);
  });
});

export const f5MultimodalRowMappingV3Schema = z.object({
  worksheetName: nonEmptyStringSchema,
  tableId: nonEmptyStringSchema,
  sourceRow: z.number().int().positive(),
  factorOrdinal: f5MultimodalFactorOrdinalV3Schema,
  mappingStatus: z.literal("matched"),
  visibleStatus: z.literal("visible"),
  interpretation: nonEmptyStringSchema,
}).strict();

export const f5MultimodalWorksheetResultV3Schema = z.object({
  contractVersion: z.literal("f5-multimodal-result-v3"),
  outputClassification: z.literal("confidential"),
  requestHash: sha256Schema,
  sessionId: nonEmptyStringSchema,
  revision: z.number().int().nonnegative(),
  inputRevision: z.number().int().nonnegative(),
  workbookContentHash: sha256Schema,
  worksheetName: nonEmptyStringSchema,
  tableId: nonEmptyStringSchema,
  imageContentHash: sha256Schema,
  model: z.object({ modelId: nonEmptyStringSchema, supportsImage: z.literal(true) }).strict(),
  imageTableInterpretation: nonEmptyStringSchema,
  rowMappings: z.array(f5MultimodalRowMappingV3Schema).min(1),
}).strict().superRefine((result, context) => {
  const identities = new Set<string>();
  const ordinals = new Set<string>();
  result.rowMappings.forEach((mapping, index) => {
    if (mapping.worksheetName !== result.worksheetName || mapping.tableId !== result.tableId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "mapping scope must match result scope", path: ["rowMappings", index] });
    }
    const identity = rowIdentity(mapping);
    if (identities.has(identity)) context.addIssue({ code: z.ZodIssueCode.custom, message: "mapping identities must be unique", path: ["rowMappings", index] });
    identities.add(identity);
    const ordinal = normalizedOrdinal(mapping.factorOrdinal.value);
    if (ordinals.has(ordinal)) context.addIssue({ code: z.ZodIssueCode.custom, message: "mapping ordinals must be unique", path: ["rowMappings", index, "factorOrdinal"] });
    ordinals.add(ordinal);
  });
});

export const f5MultimodalWorksheetPairV3Schema = z.object({
  request: f5MultimodalWorksheetRequestV3Schema,
  result: f5MultimodalWorksheetResultV3Schema,
}).strict().superRefine(({ request, result }, context) => {
  const bindings = [
    ["requestHash", request.requestHash, result.requestHash],
    ["sessionId", request.sessionId, result.sessionId],
    ["revision", request.revision, result.revision],
    ["inputRevision", request.inputRevision, result.inputRevision],
    ["workbookContentHash", request.workbook.contentHash, result.workbookContentHash],
    ["worksheetName", request.worksheetName, result.worksheetName],
    ["tableId", request.tableId, result.tableId],
    ["imageContentHash", request.image.contentHash, result.imageContentHash],
  ] as const;
  for (const [field, expected, actual] of bindings) {
    if (expected !== actual) context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} must match the request`, path: ["result", field] });
  }
  const mappingByIdentity = new Map(result.rowMappings.map((mapping) => [rowIdentity(mapping), mapping]));
  request.factorRows.forEach((row, index) => {
    const mapping = mappingByIdentity.get(rowIdentity(row));
    if (mapping === undefined
      || mapping.factorOrdinal.value !== row.factorOrdinal.value
      || mapping.factorOrdinal.rawText !== row.factorOrdinal.rawText
      || mapping.factorOrdinal.sourceCell !== row.factorOrdinal.sourceCell) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "every active Factor requires one field-identical model mapping", path: ["result", "rowMappings", index] });
    }
  });
  if (mappingByIdentity.size !== request.factorRows.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "model mappings must exactly cover active Factors", path: ["result", "rowMappings"] });
  }
});

export const f5MultimodalArtifactV3Schema = z.object({
  contractVersion: z.literal("f5-multimodal-artifact-v3"),
  outputClassification: z.literal("confidential"),
  sessionId: nonEmptyStringSchema,
  revision: z.number().int().nonnegative(),
  inputRevision: z.number().int().nonnegative(),
  workbookContentHash: sha256Schema,
  selectedWorksheetNames: z.array(nonEmptyStringSchema).min(1),
  worksheets: z.array(f5MultimodalWorksheetPairV3Schema).min(1),
}).strict().superRefine((artifact, context) => {
  if (new Set(artifact.selectedWorksheetNames).size !== artifact.selectedWorksheetNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "selected worksheet names must be unique", path: ["selectedWorksheetNames"] });
  }
  const worksheetNames = artifact.worksheets.map(({ request }) => request.worksheetName);
  if (JSON.stringify(worksheetNames) !== JSON.stringify(artifact.selectedWorksheetNames)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "multimodal worksheets must exactly match selected worksheets in order", path: ["worksheets"] });
  }
  artifact.worksheets.forEach(({ request }, index) => {
    if (request.sessionId !== artifact.sessionId) context.addIssue({ code: z.ZodIssueCode.custom, message: "request session must match artifact", path: ["worksheets", index, "request", "sessionId"] });
    if (request.revision !== artifact.revision) context.addIssue({ code: z.ZodIssueCode.custom, message: "request revision must match artifact", path: ["worksheets", index, "request", "revision"] });
    if (request.inputRevision !== artifact.inputRevision) context.addIssue({ code: z.ZodIssueCode.custom, message: "request inputRevision must match artifact", path: ["worksheets", index, "request", "inputRevision"] });
    if (request.workbook.contentHash !== artifact.workbookContentHash) context.addIssue({ code: z.ZodIssueCode.custom, message: "request workbook must match artifact", path: ["worksheets", index, "request", "workbook"] });
  });
});

export const f5MultimodalArtifactAuthorityV3Schema = z.object({
  sessionId: nonEmptyStringSchema,
  revision: z.number().int().nonnegative(),
  inputRevision: z.number().int().nonnegative(),
  workbookContentHash: sha256Schema,
  worksheets: z.array(z.object({
    worksheetName: nonEmptyStringSchema,
    tableId: nonEmptyStringSchema,
    activeFactorCount: z.number().int().positive(),
    factorSetHash: sha256Schema,
  }).strict()).min(1),
}).strict();

export function validateF5MultimodalArtifactV3(
  value: unknown,
  authorityValue: unknown,
): z.SafeParseReturnType<unknown, F5MultimodalArtifactV3> {
  const artifact = f5MultimodalArtifactV3Schema.safeParse(value);
  if (!artifact.success) return artifact;
  const authority = f5MultimodalArtifactAuthorityV3Schema.safeParse(authorityValue);
  if (!authority.success) return { success: false, error: authority.error };

  const issues: z.ZodIssue[] = [];
  const bindings = [
    ["sessionId", authority.data.sessionId, artifact.data.sessionId],
    ["revision", authority.data.revision, artifact.data.revision],
    ["inputRevision", authority.data.inputRevision, artifact.data.inputRevision],
    ["workbookContentHash", authority.data.workbookContentHash, artifact.data.workbookContentHash],
  ] as const;
  for (const [field, expected, actual] of bindings) {
    if (expected !== actual) issues.push({ code: z.ZodIssueCode.custom, message: `${field} must match authority`, path: [field] });
  }
  if (authority.data.worksheets.length !== artifact.data.worksheets.length) {
    issues.push({ code: z.ZodIssueCode.custom, message: "worksheet coverage must match authority", path: ["worksheets"] });
  }
  authority.data.worksheets.forEach((expected, index) => {
    const request = artifact.data.worksheets[index]?.request;
    if (request === undefined
      || request.worksheetName !== expected.worksheetName
      || request.tableId !== expected.tableId
      || request.activeFactorCount !== expected.activeFactorCount
      || request.factorSetHash !== expected.factorSetHash) {
      issues.push({ code: z.ZodIssueCode.custom, message: "worksheet Factor set must match authority", path: ["worksheets", index] });
    }
  });
  return issues.length === 0
    ? artifact
    : { success: false, error: new z.ZodError(issues) };
}

export type F5MultimodalWorksheetRequestV3 = z.infer<typeof f5MultimodalWorksheetRequestV3Schema>;
export type F5MultimodalWorksheetResultV3 = z.infer<typeof f5MultimodalWorksheetResultV3Schema>;
export type F5MultimodalArtifactV3 = z.infer<typeof f5MultimodalArtifactV3Schema>;
export type F5MultimodalArtifactAuthorityV3 = z.infer<typeof f5MultimodalArtifactAuthorityV3Schema>;
export type F5MultimodalFactorRowV3 = z.infer<typeof f5MultimodalFactorRowV3Schema>;
