import { createHash } from "node:crypto";

import {
  createF5MultimodalFactorSetHash,
  createF5MultimodalRequestHash,
  createTypedError,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5MultimodalWorksheetRequestV3Schema,
  type F5MultimodalFactorRowV3,
  type F5MultimodalWorksheetRequestV3,
} from "@ai-assist/contracts";
import type { F8SessionSnapshot, HostActionRecord, SessionArtifactReference } from "@ai-assist/workbench";
import sharp from "sharp";

export interface WorksheetInterpretationArtifactReader {
  readReference(artifactId: string): Promise<SessionArtifactReference | undefined>;
  readJson(artifactId: string, expectedContentHash: string): Promise<unknown>;
  inspectWorksheetImage(input: {
    readonly worksheetName: string;
    readonly artifactPath: string;
    readonly expectedContentHash: string;
  }): Promise<{
    readonly mediaType: "image/png" | "image/jpeg";
    readonly contentHash: string;
    readonly byteLength: number;
    readonly artifactPath: string;
  }>;
}

type F2Report = Exclude<ReturnType<typeof f2UserReportSchema.parse>, { readonly status: "inputRejected" }>;
type F4Result = ReturnType<typeof f4WorkflowCalculationResultSchema.parse>;

export async function readClaimedWorksheetImage(
  record: HostActionRecord | undefined,
  binding: {
    readonly sessionId: string;
    readonly actionId: string;
    readonly hostInstanceId: string;
    readonly leaseId: string;
    readonly now: Date;
  },
  readImage: (descriptor: F5MultimodalWorksheetRequestV3["image"]) => Promise<{
    readonly bytes: Uint8Array;
    readonly mediaType: "image/png" | "image/jpeg";
  }>,
  readCurrentClaim: () => Promise<{ readonly record: HostActionRecord | undefined; readonly now: Date }>,
): Promise<{ readonly bytes: Uint8Array; readonly mediaType: "image/png" | "image/jpeg" }> {
  if (!isMatchingLiveClaim(record, binding)) {
    throw imageReadDenied(binding.actionId);
  }
  const descriptor = record.request.request.image;
  const image = await readImage(descriptor);
  const contentHash = createHash("sha256").update(image.bytes).digest("hex");
  if (image.mediaType !== descriptor.mediaType
    || await detectDecodableImageMediaType(image.bytes) !== descriptor.mediaType
    || image.bytes.byteLength !== descriptor.byteLength
    || contentHash !== descriptor.contentHash) {
    throw imageReadDenied(binding.actionId);
  }
  const current = await readCurrentClaim();
  if (!isMatchingLiveClaim(current.record, { ...binding, now: current.now })) {
    throw imageReadDenied(binding.actionId);
  }
  return image;
}

function isMatchingLiveClaim(
  record: HostActionRecord | undefined,
  binding: { readonly sessionId: string; readonly actionId: string; readonly hostInstanceId: string; readonly leaseId: string; readonly now: Date },
): record is HostActionRecord & { readonly request: Extract<HostActionRecord["request"], { kind: "vscode_worksheet_multimodal_request" }> } {
  return record !== undefined
    && record.status === "claimed"
    && record.sessionId === binding.sessionId
    && record.actionId === binding.actionId
    && record.request.kind === "vscode_worksheet_multimodal_request"
    && record.claim?.hostInstanceId === binding.hostInstanceId
    && record.claim.leaseId === binding.leaseId
    && record.leaseId === binding.leaseId
    && record.leaseExpiresAt !== undefined
    && Date.parse(record.leaseExpiresAt) > binding.now.getTime();
}

export async function buildSelectedWorksheetInterpretationContexts(
  snapshot: F8SessionSnapshot,
  artifacts: WorksheetInterpretationArtifactReader,
): Promise<readonly F5MultimodalWorksheetRequestV3[]> {
  const selection = snapshot.downstreamScopeSelection;
  if (selection === undefined
    || !("decision" in selection)
    || selection.decision !== "continue_ready"
    || selection.provenance !== "user"
    || selection.inputRevision !== snapshot.inputRevision) {
    throw contextError("Current multimodal interpretation requires a user-governed downstream worksheet decision.", [snapshot.sessionId]);
  }
  const selectedWorksheetNames = selection.selectedWorksheetNames;
  if (selectedWorksheetNames.length === 0 || new Set(selectedWorksheetNames).size !== selectedWorksheetNames.length) {
    throw contextError("Current worksheet scope is missing or ambiguous.", [snapshot.sessionId]);
  }

  const f2Reference = await readCurrentReference(snapshot, artifacts, "f2_report");
  const f4Reference = await readCurrentReference(snapshot, artifacts, "f4_calculation");
  if (selection.f2ReportArtifactId !== f2Reference.artifactId
    || selection.f2ReportContentHash !== f2Reference.contentHash) {
    throw contextError("The downstream worksheet decision is not bound to the current F2 report.", [selection.f2ReportArtifactId, f2Reference.artifactId]);
  }
  const f2 = f2UserReportSchema.parse(await artifacts.readJson(f2Reference.artifactId, f2Reference.contentHash!));
  const f4 = f4WorkflowCalculationResultSchema.parse(await artifacts.readJson(f4Reference.artifactId, f4Reference.contentHash!));
  if (f2.status === "inputRejected"
    || f4.status !== "completed"
    || f2.workbook.contentHash !== f4.source.workbookContentHash
    || f2.workbook.fileName !== f4.source.workbookFileName
    || f2.workbook.contentHash !== selection.workbookContentHash) {
    throw contextError("Current F2 and F4 workbook evidence does not match the selected session scope.", [f2Reference.artifactId, f4Reference.artifactId]);
  }

  return Promise.all(selectedWorksheetNames.map(async (worksheetName) => buildRequest(
    snapshot,
    worksheetName,
    f2,
    f4,
    artifacts,
  )));
}

export async function assertCurrentWorksheetInterpretationRequest(
  snapshot: F8SessionSnapshot,
  candidate: F5MultimodalWorksheetRequestV3,
  artifacts: WorksheetInterpretationArtifactReader,
): Promise<void> {
  const parsedCandidate = f5MultimodalWorksheetRequestV3Schema.safeParse(candidate);
  if (!parsedCandidate.success) {
    throw contextError("Multimodal worksheet request has an invalid content binding.", [candidate.worksheetName]);
  }
  const current = await buildSelectedWorksheetInterpretationContexts(snapshot, artifacts);
  const expected = current.find(({ worksheetName }) => worksheetName === parsedCandidate.data.worksheetName);
  if (expected === undefined || expected.requestHash !== parsedCandidate.data.requestHash) {
    throw contextError("Multimodal worksheet request is stale or does not match current evidence.", [candidate.worksheetName]);
  }
}

async function buildRequest(
  snapshot: F8SessionSnapshot,
  worksheetName: string,
  f2: F2Report,
  f4: F4Result,
  artifacts: WorksheetInterpretationArtifactReader,
): Promise<F5MultimodalWorksheetRequestV3> {
  const worksheetMatches = f2.worksheets.filter((worksheet) => worksheet.worksheetName === worksheetName && worksheet.status === "ready");
  const calculationMatches = f4.calculations.filter((calculation) => calculation.worksheetSelection.worksheetName === worksheetName && calculation.status === "completed");
  if (worksheetMatches.length !== 1 || calculationMatches.length !== 1) {
    throw contextError("Selected worksheet does not have exactly one current F2/F4 evidence pair.", [worksheetName]);
  }
  const worksheet = worksheetMatches[0]!;
  const calculation = calculationMatches[0]!;
  const tableId = calculation.worksheetSelection.tableId;
  const f2Rows = worksheet.rows.filter((row) => row.tableId === tableId);
  const f2ByIdentity = new Map(f2Rows.map((row) => [`${row.tableId}\u0000${row.sourceRow}`, row]));
  if (f2Rows.length !== calculation.factors.length || f2ByIdentity.size !== f2Rows.length) {
    throw contextError("F2 and F4 active Factor sets do not match.", [worksheetName, tableId]);
  }

  const factorRows: F5MultimodalFactorRowV3[] = calculation.factors.map((factor) => {
    const row = f2ByIdentity.get(`${factor.source.tableId}\u0000${factor.source.sourceRow}`);
    const actual = row?.actualFields;
    if (row === undefined
      || actual === undefined
      || row.worksheetName !== worksheetName
      || factor.source.worksheetName !== worksheetName
      || factor.source.tableId !== tableId
      || row.factorOrdinal === undefined
      || text(row.factorOrdinal.value) === undefined
      || text(row.factorOrdinal.rawText) === undefined
      || text(row.factorOrdinal.sourceCell) === undefined
      || text(actual?.factorName) !== factor.factorName
      || number(actual?.nominalValue) !== factor.input.nominalValue
      || number(actual?.upperTolerance) !== factor.input.upperTolerance
      || number(actual?.lowerTolerance) !== factor.input.lowerTolerance
      || number(actual?.longTermSafetyFactor) !== factor.input.longTermSafetyFactor
      || number(actual?.sigmaLevel) !== factor.input.sigmaLevel
      || text(actual?.distribution) !== factor.input.distribution) {
      throw contextError("F2 and F4 Factor identity or values do not match.", [worksheetName, tableId, String(factor.source.sourceRow)]);
    }
    return {
      worksheetName,
      tableId,
      sourceRow: factor.source.sourceRow,
      factorOrdinal: {
        value: row.factorOrdinal.value,
        rawText: row.factorOrdinal.rawText,
        sourceCell: row.factorOrdinal.sourceCell!,
      },
      factorName: factor.factorName,
      partName: requiredText(actual.partName, "partName", worksheetName, factor.source.sourceRow),
      partCategory: requiredText(actual.partCategory, "partCategory", worksheetName, factor.source.sourceRow),
      drawingNumber: optionalText(actual.drawingNumber),
      dimId: optionalText(actual.dimCharacteristicId),
      nominal: factor.input.nominalValue,
      upperTolerance: factor.input.upperTolerance,
      lowerTolerance: factor.input.lowerTolerance,
      longTermSafetyFactor: factor.input.longTermSafetyFactor,
      sigmaLevel: factor.input.sigmaLevel,
      distribution: factor.input.distribution,
      sourceCells: Object.fromEntries(
        Object.entries(row.sourceCells).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      ),
    };
  });

  const worksheetImages = worksheet.rows.map((row) => row.imageReference);
  if (worksheetImages.some((image) => image === undefined || image.worksheetName !== worksheetName)) {
    throw contextError("Every active Factor must bind the selected worksheet image.", [worksheetName]);
  }
  const imageIdentities = new Map(worksheetImages.map((image) => [
    `${image!.relativePath}\u0000${image!.contentHash}`,
    image!,
  ]));
  if (imageIdentities.size !== 1) {
    throw contextError("Selected worksheet does not have exactly one governed image identity.", [worksheetName]);
  }
  const imageReference = [...imageIdentities.values()][0]!;
  const inspectedImage = await artifacts.inspectWorksheetImage({
    worksheetName,
    artifactPath: imageReference.relativePath,
    expectedContentHash: imageReference.contentHash,
  });
  if (inspectedImage.artifactPath !== imageReference.relativePath
    || inspectedImage.contentHash !== imageReference.contentHash
    || inspectedImage.byteLength <= 0) {
    throw contextError("Governed worksheet image bytes do not match the image descriptor.", [worksheetName, imageReference.relativePath]);
  }

  const request = {
    contractVersion: "f5-multimodal-request-v3" as const,
    inputClassification: "confidential" as const,
    requestHash: "",
    sessionId: snapshot.sessionId,
    revision: snapshot.revision,
    inputRevision: snapshot.inputRevision,
    workbook: { fileName: f2.workbook.fileName, contentHash: f2.workbook.contentHash },
    worksheetName,
    tableId,
    activeFactorCount: factorRows.length,
    factorSetHash: createF5MultimodalFactorSetHash(factorRows),
    image: inspectedImage,
    factorRows,
  };
  request.requestHash = createF5MultimodalRequestHash(request);
  return f5MultimodalWorksheetRequestV3Schema.parse(request);
}

async function readCurrentReference(
  snapshot: F8SessionSnapshot,
  artifacts: WorksheetInterpretationArtifactReader,
  kind: string,
): Promise<SessionArtifactReference & { readonly contentHash: string }> {
  const references = snapshot.artifactRefs?.filter((reference) => reference.kind === kind && reference.validated && reference.revision === snapshot.inputRevision) ?? [];
  if (references.length !== 1) throw contextError(`Current ${kind} evidence is missing or ambiguous.`, [snapshot.sessionId]);
  const persisted = await artifacts.readReference(references[0]!.artifactId);
  if (persisted === undefined
    || persisted.sessionId !== snapshot.sessionId
    || persisted.inputRevision !== snapshot.inputRevision
    || persisted.kind !== kind
    || persisted.contentHash === undefined) {
    throw contextError(`Current ${kind} reference is stale or invalid.`, [references[0]!.artifactId]);
  }
  return persisted as SessionArtifactReference & { readonly contentHash: string };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function detectDecodableImageMediaType(bytes: Uint8Array): Promise<"image/png" | "image/jpeg" | undefined> {
  try {
    const metadata = await sharp(bytes, { failOn: "error" }).metadata();
    if (metadata.width === undefined || metadata.height === undefined || metadata.width <= 0 || metadata.height <= 0) return undefined;
    if (metadata.format === "png") return "image/png";
    if (metadata.format === "jpeg") return "image/jpeg";
    return undefined;
  } catch {
    return undefined;
  }
}

function optionalText(value: unknown): string | null {
  return text(value) ?? null;
}

function requiredText(value: unknown, field: string, worksheetName: string, sourceRow: number): string {
  const parsed = text(value);
  if (parsed === undefined) throw contextError(`Active Factor ${field} is missing.`, [worksheetName, String(sourceRow)]);
  return parsed;
}

function contextError(summary: string, affectedInputReferences: readonly string[]) {
  return createTypedError({
    code: "evidence_mismatch",
    summary,
    retryable: false,
    suggestedAction: "Regenerate the governed worksheet artifacts before model interpretation.",
    affectedInputReferences: [...affectedInputReferences],
  });
}

function imageReadDenied(actionId: string) {
  return createTypedError({
    code: "policy_denied",
    summary: "Governed worksheet image read was rejected.",
    retryable: false,
    suggestedAction: "Claim the current multimodal HostAction and retry with its active lease.",
    affectedInputReferences: [actionId],
  });
}
