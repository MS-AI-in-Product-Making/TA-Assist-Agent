import { createTypedError, f2UserReportSchema, f4WorkflowCalculationResultSchema, taModelContextEnvelopeSchema, type F8ScenarioDraft, type TaModelContextEnvelope } from "@ai-assist/contracts";
import type { F8SessionSnapshot, SessionArtifactReference } from "@ai-assist/workbench";

import { isSupportedGovernedImageMediaType, sanitizePromptVisibleText } from "./prompt-sanitizer.js";

export interface ConversationContextSelection {
  readonly worksheetName?: string;
  readonly tableId?: string;
  readonly sourceRow?: number;
  readonly factorName?: string;
  readonly calculationReference?: string;
}

export interface ConversationContextArtifactReader {
  readReference(artifactId: string): Promise<SessionArtifactReference | undefined>;
  readJson(artifactId: string, expectedContentHash: string): Promise<unknown>;
}

type SnapshotArtifactRef = NonNullable<F8SessionSnapshot["artifactRefs"]>[number];
type ReviewSnapshotArtifactRef = Extract<SnapshotArtifactRef, { readonly reviewContextId: string }>;
type VerifiedArtifactReference = SessionArtifactReference & { readonly contentHash: string };
type F2Report = Exclude<ReturnType<typeof f2UserReportSchema.parse>, { readonly status: "inputRejected" }>;
type F2Worksheet = F2Report["worksheets"][number];
type F4Result = ReturnType<typeof f4WorkflowCalculationResultSchema.parse>;
type F4Calculation = F4Result["calculations"][number];

export async function buildConversationContext(
  snapshot: F8SessionSnapshot,
  selection: ConversationContextSelection,
  artifacts: ConversationContextArtifactReader,
): Promise<TaModelContextEnvelope> {
  if (selection.worksheetName === undefined || selection.worksheetName.trim().length === 0) {
    throw contextError("validation_error", "A selected worksheet is required for TA model context.", [snapshot.sessionId]);
  }
  ensureWorksheetInCurrentScope(snapshot, selection.worksheetName);

  const f2Ref = await readCurrentReference(snapshot, artifacts, "f2_report");
  const f4Ref = await readCurrentReference(snapshot, artifacts, "f4_calculation");
  ensureSameReviewContext(snapshot, [f4Ref]);

  const f2 = f2UserReportSchema.parse(await artifacts.readJson(f2Ref.artifactId, f2Ref.contentHash));
  if (f2.status === "inputRejected") {
    throw contextError("evidence_mismatch", "The current F2 report was rejected and cannot provide model context.", [f2Ref.artifactId]);
  }
  const f4 = f4WorkflowCalculationResultSchema.parse(await artifacts.readJson(f4Ref.artifactId, f4Ref.contentHash));
  validateWorkbookLineage(snapshot, f2, f4, [f2Ref.artifactId, f4Ref.artifactId]);

  const worksheet = f2.worksheets.find((candidate) => candidate.worksheetName === selection.worksheetName);
  if (worksheet === undefined) {
    throw contextError("evidence_mismatch", "The selected worksheet is not present in the current F2 report.", [selection.worksheetName]);
  }
  const calculation = f4.calculations.find((candidate) => candidate.worksheetSelection.worksheetName === selection.worksheetName);
  if (calculation === undefined) {
    throw contextError("evidence_mismatch", "The selected worksheet is not present in the current F4 baseline.", [selection.worksheetName]);
  }
  if (selection.tableId !== undefined && calculation.worksheetSelection.tableId !== selection.tableId) {
    throw contextError("evidence_mismatch", "The selected factor table does not match the current F4 baseline.", [selection.tableId]);
  }

  const factorTable = buildFactorRows(snapshot.inputRevision, selection.worksheetName, worksheet, calculation);
  const selectedFactor = resolveSelectedFactor(selection, factorTable);
  const f0Knowledge = buildF0Knowledge(snapshot.inputRevision, selection.worksheetName, worksheet);
  const toleranceLoopImage = await buildImageContext(snapshot, selection.worksheetName, selectedFactor, worksheet, artifacts, f4Ref);
  const scenario = resolveScenario(snapshot, selection, {
    workbookContentHash: f2.workbook.contentHash,
    baselineRunReference: calculation.runReference,
  });

  return taModelContextEnvelopeSchema.parse({
    contractVersion: "ta-model-context-envelope-v1",
    session: { sessionId: snapshot.sessionId, revision: snapshot.revision },
    inputRevision: snapshot.inputRevision,
    worksheet: {
      worksheetName: selection.worksheetName,
      ...(selectedFactor === undefined ? {} : { tableId: selectedFactor.tableId, sourceRow: selectedFactor.sourceRow, factorName: selectedFactor.factorName }),
      ...(scenario?.calculationReference === undefined ? {} : { calculationReference: scenario.calculationReference }),
    },
    f0Knowledge,
    ...(toleranceLoopImage === undefined ? {} : { toleranceLoopImage }),
    factorTable,
    baselineMetrics: metricContext(snapshot.inputRevision, calculation.runReference, calculation),
    ...(scenario?.calculationMetrics === undefined || scenario.calculationReference === undefined ? {} : { scenarioMetrics: { inputRevision: snapshot.inputRevision, calculationReference: scenario.calculationReference, ...scenario.calculationMetrics } }),
    relatedArtifactIds: [f2Ref.artifactId, f4Ref.artifactId, ...(toleranceLoopImage === undefined ? [] : [toleranceLoopImage.artifactId])],
  });
}

async function readCurrentReference(snapshot: F8SessionSnapshot, artifacts: ConversationContextArtifactReader, kind: string): Promise<VerifiedArtifactReference> {
  const refs = snapshot.artifactRefs?.filter((reference) => reference.kind === kind && reference.validated && reference.revision === snapshot.inputRevision) ?? [];
  if (refs.length !== 1) {
    throw contextError("evidence_mismatch", `Current model context requires one validated ${kind} artifact.`, [snapshot.sessionId]);
  }
  return validatePersistedReference(snapshot, artifacts, refs[0]!);
}

async function validatePersistedReference(snapshot: F8SessionSnapshot, artifacts: ConversationContextArtifactReader, snapshotRef: SnapshotArtifactRef): Promise<VerifiedArtifactReference> {
  const persisted = await artifacts.readReference(snapshotRef.artifactId);
  if (persisted === undefined || persisted.sessionId !== snapshot.sessionId) {
    throw contextError("evidence_mismatch", "Artifact reference does not belong to the current session.", [snapshotRef.artifactId]);
  }
  if (persisted.inputRevision !== snapshot.inputRevision || persisted.kind !== snapshotRef.kind || persisted.contentHash === undefined) {
    throw contextError("evidence_mismatch", "Artifact reference does not match the current input revision.", [snapshotRef.artifactId]);
  }
  if ("reviewContextId" in snapshotRef && persisted.metadata?.reviewContextId !== snapshotRef.reviewContextId) {
    throw contextError("evidence_mismatch", "Artifact review context does not match the current review baseline.", [snapshotRef.artifactId]);
  }
  return persisted as VerifiedArtifactReference;
}

function ensureWorksheetInCurrentScope(snapshot: F8SessionSnapshot, worksheetName: string): void {
  const scopedWorksheets = snapshot.downstreamScopeSelection?.selectedWorksheetNames ?? snapshot.initialScopeSelection?.selectedWorksheetNames ?? [];
  if (!scopedWorksheets.includes(worksheetName)) {
    throw contextError("evidence_mismatch", "The selected worksheet is outside the current session scope.", [worksheetName]);
  }
}

function ensureSameReviewContext(snapshot: F8SessionSnapshot, refs: readonly SessionArtifactReference[]): void {
  const reviewRefs = snapshot.artifactRefs?.filter((reference): reference is ReviewSnapshotArtifactRef => "reviewContextId" in reference && reference.validated && reference.revision === snapshot.inputRevision) ?? [];
  const expected = new Set(reviewRefs.map((reference) => reference.reviewContextId));
  for (const ref of refs) {
    const reviewContextId = ref.metadata?.reviewContextId;
    if (typeof reviewContextId !== "string" || !expected.has(reviewContextId)) {
      throw contextError("evidence_mismatch", "Artifact review context does not match the current review baseline.", [ref.artifactId]);
    }
  }
}

function validateWorkbookLineage(snapshot: F8SessionSnapshot, f2: F2Report, f4: F4Result, references: readonly string[]): void {
  const scopeHash = snapshot.downstreamScopeSelection?.workbookContentHash ?? snapshot.initialScopeSelection?.workbookContentHash;
  if (scopeHash !== undefined && f2.workbook.contentHash !== scopeHash) {
    throw contextError("evidence_mismatch", "The current F2 report workbook hash does not match the selected session scope.", references);
  }
  if (f4.source.workbookContentHash !== f2.workbook.contentHash) {
    throw contextError("evidence_mismatch", "The current F4 baseline does not match the current F2 report workbook hash.", references);
  }
}

function buildFactorRows(inputRevision: number, worksheetName: string, worksheet: F2Worksheet, calculation: F4Calculation): TaModelContextEnvelope["factorTable"] {
  const f4Rows = new Map(calculation.factors.map((factor) => [`${factor.source.tableId}:${factor.source.sourceRow}`, factor]));
  return worksheet.rows.flatMap((row) => {
    const factorName = textValue(row.actualFields.factorName);
    const nominalValue = numberValue(row.actualFields.nominalValue);
    const upperTolerance = numberValue(row.actualFields.upperTolerance);
    const lowerTolerance = numberValue(row.actualFields.lowerTolerance);
    const unit = typeof row.recommendation?.unit === "string" ? row.recommendation.unit : "mm";
    if (factorName === undefined || nominalValue === undefined || upperTolerance === undefined || lowerTolerance === undefined) return [];
    const f4Row = f4Rows.get(`${row.tableId}:${row.sourceRow}`);
    return [{
      inputRevision,
      worksheetName,
      tableId: row.tableId,
      sourceRow: row.sourceRow,
      factorName,
      ...(textValue(row.actualFields.partName) === undefined ? {} : { partName: textValue(row.actualFields.partName) }),
      unit,
      nominalValue,
      upperTolerance,
      lowerTolerance,
      ...(distributionValue(row.actualFields.distribution) === undefined ? {} : { distribution: distributionValue(row.actualFields.distribution) }),
      ...(f4Row === undefined ? {} : { mean: f4Row.mean, tolerance: Math.abs(f4Row.halfTolerance) * 2, oneSigma: f4Row.sigma, contribution: f4Row.contribution }),
      ...(sanitizePromptVisibleText(textValue(row.actualFields.notes)) === undefined ? {} : { notes: sanitizePromptVisibleText(textValue(row.actualFields.notes)) }),
    }];
  }).slice(0, 256);
}

function resolveSelectedFactor(selection: ConversationContextSelection, factorTable: TaModelContextEnvelope["factorTable"]): TaModelContextEnvelope["factorTable"][number] | undefined {
  if (selection.tableId === undefined && selection.sourceRow === undefined && selection.factorName === undefined) return undefined;
  if (selection.tableId === undefined || selection.sourceRow === undefined || selection.factorName === undefined) {
    throw contextError("validation_error", "Selected factor identity must include tableId, sourceRow, and factorName together.", [selection.worksheetName ?? "<missing>"]);
  }
  const factor = factorTable.find((row) => row.tableId === selection.tableId && row.sourceRow === selection.sourceRow && row.factorName === selection.factorName);
  if (factor === undefined) {
    throw contextError("evidence_mismatch", "The selected factor identity is not present in the current factor table.", [selection.tableId, String(selection.sourceRow)]);
  }
  return factor;
}

function buildF0Knowledge(inputRevision: number, worksheetName: string, worksheet: F2Worksheet): TaModelContextEnvelope["f0Knowledge"] {
  return worksheet.rows.flatMap((row) => {
    const factorName = textValue(row.actualFields.factorName);
    if (factorName === undefined) return [];
    const recommendation = row.recommendation?.kind === "internal-guidance"
      ? { kind: "internal-guidance" as const, assessedTotalBand: row.recommendation.assessedTotalBand, maximumRecommendedTotalBand: row.recommendation.maximumRecommendedTotalBand, unit: row.recommendation.unit, matchedEntryId: row.recommendation.matchedEntryId, sourceFileHash: row.recommendation.evidence.sourceFileHash }
      : row.recommendation;
    return [{
      inputRevision,
      worksheetName,
      tableId: row.tableId,
      sourceRow: row.sourceRow,
      factorName,
      capabilityStatus: row.capabilityStatus,
      ...(row.f0KnowledgeBaseVersion === undefined ? {} : { f0KnowledgeBaseVersion: row.f0KnowledgeBaseVersion }),
      summary: f0Summary(row.capabilityStatus, factorName),
      ...(recommendation === undefined ? {} : { recommendation }),
      ...(row.f0InformationReason === undefined ? {} : { f0InformationReason: row.f0InformationReason }),
    }];
  }).slice(0, 128);
}

async function buildImageContext(
  snapshot: F8SessionSnapshot,
  worksheetName: string,
  selectedFactor: TaModelContextEnvelope["factorTable"][number] | undefined,
  worksheet: F2Worksheet,
  artifacts: ConversationContextArtifactReader,
  f4Ref: VerifiedArtifactReference,
): Promise<TaModelContextEnvelope["toleranceLoopImage"] | undefined> {
  const sourceRow = selectedFactor?.sourceRow;
  const image = (sourceRow === undefined ? worksheet.rows.find((row) => row.imageReference !== undefined) : worksheet.rows.find((row) => row.sourceRow === sourceRow))?.imageReference;
  if (image === undefined || image.worksheetName !== worksheetName) return undefined;
  const snapshotRef = snapshot.artifactRefs?.find((reference) => reference.kind === "f1_image" && reference.validated && reference.revision === snapshot.inputRevision);
  if (snapshotRef === undefined) return undefined;
  const ref = await validatePersistedReference(snapshot, artifacts, snapshotRef);
  if (ref.contentHash !== image.contentHash || ref.metadata?.reviewContextId !== f4Ref.metadata?.reviewContextId) {
    throw contextError("evidence_mismatch", "F1 image artifact metadata does not match the current worksheet image.", [ref.artifactId]);
  }
  const mediaType = typeof ref.metadata?.mediaType === "string" ? ref.metadata.mediaType : "image/png";
  if (!isSupportedGovernedImageMediaType(mediaType)) return undefined;
  const description = sanitizePromptVisibleText(typeof ref.metadata?.description === "string" ? ref.metadata.description : undefined);
  return { artifactId: ref.artifactId, kind: "f1_image", inputRevision: snapshot.inputRevision, worksheetName, contentHash: ref.contentHash, mediaType, ...(description === undefined ? {} : { description }) };
}

function resolveScenario(
  snapshot: F8SessionSnapshot,
  selection: ConversationContextSelection,
  baseline: { readonly workbookContentHash: string; readonly baselineRunReference: string },
): F8ScenarioDraft | undefined {
  const candidates = snapshot.scenarioDrafts?.filter((draft) => draft.sessionId === snapshot.sessionId && draft.inputRevision === snapshot.inputRevision && draft.worksheetName === selection.worksheetName && draft.status === "saved") ?? [];
  const scenario = selection.calculationReference === undefined
    ? candidates.findLast((draft) => draft.status === "saved")
    : candidates.find((draft) => draft.calculationReference === selection.calculationReference);
  if (selection.calculationReference !== undefined && scenario === undefined) {
    throw contextError("evidence_mismatch", "The selected Scenario calculation reference is not current for this worksheet.", [selection.calculationReference]);
  }
  if (scenario !== undefined && (scenario.baselineWorkbookHash !== baseline.workbookContentHash || scenario.baselineRunReference !== baseline.baselineRunReference)) {
    throw contextError("evidence_mismatch", "The selected Scenario lineage no longer matches the current workbook review baseline.", [scenario.calculationReference ?? scenario.draftId]);
  }
  return scenario;
}

function metricContext(inputRevision: number, calculationReference: string, calculation: F4Calculation): TaModelContextEnvelope["baselineMetrics"] {
  const statisticalLower = calculation.system.mean - (3 * calculation.system.rssSigma);
  const statisticalUpper = calculation.system.mean + (3 * calculation.system.rssSigma);
  return {
    inputRevision,
    calculationReference,
    mean: calculation.system.mean,
    rssSigma: calculation.system.rssSigma,
    cp: calculation.capability.cp,
    cpkL: calculation.capability.lowerCpk,
    cpkU: calculation.capability.upperCpk,
    cpk: calculation.capability.cpk,
    statisticalMargin: Math.min(calculation.capability.upperSpecLimit - calculation.system.mean, calculation.system.mean - calculation.capability.lowerSpecLimit) / 2,
    worstCaseMargin: Math.min(calculation.capability.upperSpecLimit - calculation.system.worstCaseUpper, calculation.system.worstCaseLower - calculation.capability.lowerSpecLimit) / 2,
    lowerSpecLimit: calculation.capability.lowerSpecLimit,
    upperSpecLimit: calculation.capability.upperSpecLimit,
    yield: calculation.capability.yield,
    dpm: calculation.capability.totalDpm,
    statisticalLower,
    statisticalUpper,
    worstCaseLower: calculation.system.worstCaseLower,
    worstCaseUpper: calculation.system.worstCaseUpper,
  };
}

function f0Summary(status: string, factorName: string): string {
  return `F0 public guidance ${status} for ${factorName}.`;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function distributionValue(value: unknown): "normal" | "uniform" | undefined {
  return value === "normal" || value === "uniform" ? value : undefined;
}

function contextError(code: "validation_error" | "evidence_mismatch", summary: string, affectedInputReferences: readonly string[]): Error {
  return createTypedError({ code, summary, suggestedAction: "Refresh the current review and retry the TA conversation request.", affectedInputReferences });
}