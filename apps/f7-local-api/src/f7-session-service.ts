import { createHash } from "node:crypto";
import {
  createTypedError,
  f7DistributionCharacteristicKindSchema,
  f7DistributionApprovalRouteRequestSchema,
  f7FactorConfirmRouteRequestSchema,
  f7MeasurementDispositionRequestSchema,
  f7MeasurementPasteRequestSchema,
  f7MonteCarloRunRouteRequestSchema,
  f7ReportGenerateRouteRequestSchema,
  f7SessionSnapshotSchema,
  f7WorkbookImportRequestSchema,
  worksheetSelectionConfirmationSchema,
  type F7DatasetValidationResult,
  type F7DistributionCharacteristicKind,
  type F7DistributionCandidateFamily,
  type F7FactorInput,
  type F7FactorConfirmRouteRequest,
  type F7FactorSourceMode,
  type F7MeasurementDispositionRequest,
  type F7MeasurementPasteRequest,
  type F7MeasurementPasteResult,
  type F7SessionService,
  type F7SessionSnapshot,
  type F7WorkbookImportRequest,
  type WorksheetAnalysisAssetsResult,
  type WorksheetImageReadResult,
  type WorksheetSelectionConfirmation,
} from "@ai-assist/contracts";
import { runF7MonteCarlo as runF7MonteCarloSimulation } from "@ai-assist/f7-simulation";
import {
  F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS,
  fitDistribution as fitDistributionDataset,
} from "@ai-assist/f7-statistics";
import {
  applyF7MeasurementDisposition,
  confirmF7FactorSetup,
  createWorkbookCatalog,
  createWorksheetAnalysisAssets as createWorksheetAnalysisAssetsDefault,
  createF7WorkbookImport,
  extractResponseSummarySystemSpecification,
  extractF7FactorCandidates,
  parseF7MeasurementPaste,
  readWorksheetImageAsset as readWorksheetImageAssetDefault,
  readOoxmlWorkbook,
  validateF7MeasurementDataset,
  type F7FactorCandidateExtractionResult,
  type F7WorkbookImportResult,
} from "@ai-assist/workbook-catalog";
import { z } from "zod";
import {
  createF7ReportProjection,
  isF7ReportPrerequisiteError,
} from "./f7-report.js";

interface InternalSession {
  readonly workbookBytes: Uint8Array;
  readonly importResult: F7WorkbookImportResult;
  readonly extractionResult?: F7FactorCandidateExtractionResult;
  readonly dimensionChainImage?: {
    readonly mediaType: "image/png" | "image/jpeg";
    readonly bytes: Uint8Array;
  };
  readonly snapshot: F7SessionSnapshot;
}

const SESSION_SUMMARY = "F7 session request is invalid.";
const PREREQUISITE_SUMMARY = "F7 session operation is not ready.";
const NOT_FOUND_SUMMARY = "F7 session state was not found.";
const INTERNAL_REFERENCE = "f7-session-service";
const DISTRIBUTION_FIT_SUMMARY = "F7 distribution fitting could not be calculated.";
const SELECTED_WORKSHEET_SUMMARY = "F7 selected worksheet could not be read.";

export const MAX_F7_LOCAL_SESSIONS = 8;

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function fixedError(summary: string, code: "validation_error" | "prerequisite_not_ready" | "internal_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Confirm session identity and complete each phase in order.",
    affectedInputReferences: [INTERNAL_REFERENCE],
  });
}

function fixedDistributionFitError(): Error {
  return createTypedError({
    code: "calculation_not_possible",
    summary: DISTRIBUTION_FIT_SUMMARY,
    suggestedAction: "Review the included measurements for finite variation and retry distribution fitting.",
    affectedInputReferences: [INTERNAL_REFERENCE],
  });
}

function distributionFitSeed(sessionId: string, factorId: string, datasetHash: string): string {
  return createHash("sha256")
    .update("F7_DISTRIBUTION_FIT_BOOTSTRAP_SEED_V1\0", "utf8")
    .update(sessionId, "utf8")
    .update(factorId, "utf8")
    .update(datasetHash, "utf8")
    .digest("hex");
}

function distributionCharacteristicKindForFactor(
  _factorState: F7SessionSnapshot["factors"][number],
): F7DistributionCharacteristicKind {
  return f7DistributionCharacteristicKindSchema.enum.other;
}

function measurementRowCount(text: string): number {
  return text.split(/\r\n|\n|\r/).filter((row) => row.trim().length > 0).length;
}

function hasVerifiedDesignNominal(
  specification: NonNullable<F7SessionSnapshot["systemSpecification"]>,
): specification is Extract<NonNullable<F7SessionSnapshot["systemSpecification"]>, { status: "available" }> & {
  designNominal: { status: "available"; actualValue: number; displayValue: string; sourceLabel: string; sourceCell?: string; valueOrigin: "numeric_literal" | "formula_cached" | "defaulted" };
} {
  return specification.status === "available" && specification.designNominal.status === "available";
}

function cloneFrozenSnapshot(snapshot: F7SessionSnapshot): F7SessionSnapshot {
  return deepFreeze(structuredClone(snapshot));
}

function normalizeSnapshot(snapshot: F7SessionSnapshot): F7SessionSnapshot {
  return deepFreeze(f7SessionSnapshotSchema.parse(structuredClone(snapshot)));
}

function readyForPhaseOne(factors: F7SessionSnapshot["factors"]): boolean {
  if (factors.length === 0) return false;
  for (const factor of factors) {
    if (factor.sourceMode === undefined || factor.input === undefined) return false;
    if (factor.sourceMode === "BASELINE_ASSUMPTION") {
      if (factor.input.mode !== "BASELINE_ASSUMPTION" || factor.input.baselineSampler === undefined) return false;
      continue;
    }
    if (factor.input.mode !== "MEASURED") return false;
    if (factor.measurementPasteResult?.status !== "ready") return false;
    if (factor.datasetValidation?.status !== "ready") return false;
    if (factor.input.dataset === undefined) return false;
  }
  return true;
}

function computeMeasurementStatus(snapshot: F7SessionSnapshot): F7SessionSnapshot["status"] {
  return readyForPhaseOne(snapshot.factors) ? "phase_1_ready" : "measurement_entry";
}

function normalizeNow(now: string): string {
  const parsed = z.string().datetime({ offset: true }).safeParse(now);
  if (!parsed.success) throw fixedError(SESSION_SUMMARY, "validation_error");
  return parsed.data;
}

export function createF7SessionService(dependencies: {
  readonly createId: () => string;
  readonly now: () => string;
  readonly createReportProjection?: typeof createF7ReportProjection;
  readonly createWorksheetAnalysisAssets?: (request: unknown) => WorksheetAnalysisAssetsResult;
  readonly readWorksheetImageAsset?: (request: unknown) => WorksheetImageReadResult;
}): F7SessionService {
  if (typeof dependencies.createId !== "function" || typeof dependencies.now !== "function") {
    throw fixedError(SESSION_SUMMARY, "validation_error");
  }

  const sessions = new Map<string, InternalSession>();
  const projectReport = dependencies.createReportProjection ?? createF7ReportProjection;
  const createAnalysisAssets = dependencies.createWorksheetAnalysisAssets ?? createWorksheetAnalysisAssetsDefault;
  const readImageAsset = dependencies.readWorksheetImageAsset ?? readWorksheetImageAssetDefault;

  const readSession = (sessionId: string): InternalSession => {
    const session = sessions.get(sessionId);
    if (!session) throw fixedError(NOT_FOUND_SUMMARY, "validation_error");
    return session;
  };

  const writeSession = (sessionId: string, next: InternalSession): void => {
    sessions.set(sessionId, next);
  };

  const importWorkbook = (request: F7WorkbookImportRequest): F7SessionSnapshot => {
    const parsedRequest = f7WorkbookImportRequestSchema.safeParse(request);
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");

    const sessionId = dependencies.createId();
    if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
      throw fixedError(SESSION_SUMMARY, "validation_error");
    }
    if (sessions.has(sessionId)) throw fixedError(SESSION_SUMMARY, "validation_error");

    const importResult = createF7WorkbookImport(parsedRequest.data);
    const snapshot = normalizeSnapshot({
      contractId: "f7-analysis-result-v1",
      outputClassification: "confidential",
      sessionId,
      status: "worksheet_selection",
      workbook: {
        fileName: importResult.workbook.fileName,
        workbookContentHash: importResult.workbook.contentHash,
      },
      selectedWorksheetNames: [],
      worksheetOptions: importResult.prompt.options,
      factors: [],
    });

    if (sessions.size >= MAX_F7_LOCAL_SESSIONS) {
      const oldestSession = sessions.keys().next();
      if (!oldestSession.done) sessions.delete(oldestSession.value);
    }
    writeSession(sessionId, {
      workbookBytes: new Uint8Array(parsedRequest.data.workbookBytes),
      importResult,
      snapshot,
    });
    return cloneFrozenSnapshot(snapshot);
  };

  const confirmWorksheet = (request: { sessionId: string; confirmation: WorksheetSelectionConfirmation }): F7SessionSnapshot => {
    const parsedRequest = z.object({
      sessionId: z.string().min(1),
      confirmation: worksheetSelectionConfirmationSchema,
    }).strict().safeParse(request);
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");

    const current = readSession(parsedRequest.data.sessionId);
    if (current.snapshot.status !== "worksheet_selection") throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");

    const extraction = extractF7FactorCandidates({
      workbookBytes: current.workbookBytes,
      importResult: current.importResult,
      confirmation: parsedRequest.data.confirmation,
    });
    const workbook = readOoxmlWorkbook(
      current.workbookBytes,
      [extraction.worksheetName],
      false,
      { maxRow: 1000, maxColumn: "BN" },
    );
    const selectedWorksheet = workbook.worksheets.get(extraction.worksheetName);
    if (!selectedWorksheet) throw fixedError(SELECTED_WORKSHEET_SUMMARY, "internal_error");
    const systemSpecification = extractResponseSummarySystemSpecification(
      extraction.worksheetName,
      selectedWorksheet.cells,
    );
    const workbookCatalog = createWorkbookCatalog({
      contractVersion: "v1",
      inputClassification: "confidential",
      fileName: current.snapshot.workbook.fileName,
      workbookBytes: current.workbookBytes,
    });
    const analysisAssets = createAnalysisAssets({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes: current.workbookBytes,
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: [extraction.worksheetName] },
    });
    const tolerancePathImage = analysisAssets.worksheets[0]?.tolerancePathImage;
    const imageAsset = tolerancePathImage?.status === "available"
      ? readImageAsset({
          contractVersion: "v1",
          inputClassification: "confidential",
          workbookBytes: current.workbookBytes,
          workbookContentHash: current.snapshot.workbook.workbookContentHash,
          imageContentHash: tolerancePathImage.imageContentHash,
        })
      : undefined;
    const dimensionChainImage: InternalSession["dimensionChainImage"] = imageAsset
      && (imageAsset.mediaType === "image/png" || imageAsset.mediaType === "image/jpeg")
      ? {
          mediaType: imageAsset.mediaType,
          bytes: imageAsset.bytes.slice(),
        }
      : undefined;

    const snapshot = normalizeSnapshot({
      ...current.snapshot,
      status: "factor_setup",
      selectedWorksheetNames: [extraction.worksheetName],
      worksheetOptions: current.importResult.prompt.options,
      ...(dimensionChainImage && tolerancePathImage?.status === "available"
        ? {
            dimensionChainImage: {
              status: "available" as const,
              worksheetName: extraction.worksheetName,
              contentHash: tolerancePathImage.imageContentHash,
              url: `/f7/session/${encodeURIComponent(parsedRequest.data.sessionId)}/dimension-chain-image`,
            },
          }
        : {}),
      systemSpecification,
      factors: extraction.candidates.map((factorCandidate) => ({ factorCandidate })),
    });

    const nextSession: InternalSession = {
      ...current,
      extractionResult: extraction,
      snapshot,
    };
    writeSession(parsedRequest.data.sessionId, dimensionChainImage
      ? { ...nextSession, dimensionChainImage }
      : nextSession);
    return cloneFrozenSnapshot(snapshot);
  };

  const readDimensionChainImage = (sessionId: string) => {
    const current = readSession(sessionId);
    if (!current.dimensionChainImage) throw fixedError(NOT_FOUND_SUMMARY, "validation_error");
    return Object.freeze({
      mediaType: current.dimensionChainImage.mediaType,
      bytes: current.dimensionChainImage.bytes.slice(),
    });
  };

  const confirmFactorSetup = (request: F7FactorConfirmRouteRequest): F7SessionSnapshot => {
    const parsedRequest = f7FactorConfirmRouteRequestSchema.safeParse(request);
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");

    const current = readSession(parsedRequest.data.sessionId);
    if (
      !["factor_setup", "measurement_entry", "phase_1_ready"].includes(current.snapshot.status)
      || current.extractionResult === undefined
    ) {
      throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
    }

    const setupResult = confirmF7FactorSetup({
      extractionResult: current.extractionResult,
      confirmations: parsedRequest.data.confirmations,
    });

    const confirmationByCandidateId = new Map(parsedRequest.data.confirmations.map((confirmation) => [
      confirmation.factorCandidateId,
      confirmation,
    ]));

    const currentFactorByCandidateId = new Map(current.snapshot.factors.map((factorState) => [
      factorState.factorCandidate.factorCandidateId,
      factorState,
    ]));
    const factors = setupResult.factors.map((factorEvidence) => {
      const currentFactor = currentFactorByCandidateId.get(factorEvidence.factorCandidateId);
      const setup = confirmationByCandidateId.get(factorEvidence.factorCandidateId);
      if (!setup) throw fixedError(SESSION_SUMMARY, "validation_error");
      const factorCandidate = currentFactor?.factorCandidate ?? {
        workbookContentHash: factorEvidence.workbookContentHash,
        worksheetName: factorEvidence.worksheetName,
        tableId: factorEvidence.tableId,
        sourceRow: factorEvidence.sourceRow,
        sourceCells: factorEvidence.sourceCells,
        factorCandidateId: factorEvidence.factorCandidateId,
        factorName: factorEvidence.factorName,
        userAdded: true as const,
        excelSignedMean: factorEvidence.calculatedMean,
        designNominal: factorEvidence.designNominal,
        upperTolerance: factorEvidence.upperTolerance,
        lowerTolerance: factorEvidence.lowerTolerance,
        longTermSafetyFactor: factorEvidence.longTermSafetyFactor,
        sigmaLevel: factorEvidence.sigmaLevel,
        standardDeviation: factorEvidence.oneSigma,
        distribution: factorEvidence.distribution,
        lowerSpecLimit: factorEvidence.lowerSpecLimit,
        upperSpecLimit: factorEvidence.upperSpecLimit,
      };
      return {
        factorCandidate,
        setup,
        evidence: factorEvidence,
      };
    });

    const specificationOverride = parsedRequest.data.systemSpecification;
    const currentSystemSpecification = current.snapshot.systemSpecification;
    const availableLiteral = (actualValue: number, sourceLabel: string) => ({
      status: "available" as const,
      actualValue,
      displayValue: String(actualValue),
      sourceLabel,
      valueOrigin: "numeric_literal" as const,
    });
    const systemSpecification = specificationOverride && currentSystemSpecification
      ? hasVerifiedDesignNominal(currentSystemSpecification)
        ? {
            status: "available" as const,
            designNominal: currentSystemSpecification.designNominal,
            lowerSpecLimit: availableLiteral(specificationOverride.lowerSpecLimit, "Lower Specification Limit"),
            upperSpecLimit: availableLiteral(specificationOverride.upperSpecLimit, "Upper Specification Limit"),
            targetSigmaLevel: availableLiteral(specificationOverride.targetSigmaLevel, "Target Sigma Level"),
            additionalMeanShift: currentSystemSpecification.additionalMeanShift,
            ...(currentSystemSpecification.volume === undefined ? {} : { volume: currentSystemSpecification.volume }),
          }
        : {
            status: "unavailable" as const,
            reasonCode: "legacy_artifact_missing_system_specification" as const,
            ...(currentSystemSpecification.designNominal === undefined ? {} : { designNominal: currentSystemSpecification.designNominal }),
            ...(currentSystemSpecification.lowerSpecLimit === undefined ? {} : { lowerSpecLimit: currentSystemSpecification.lowerSpecLimit }),
            ...(currentSystemSpecification.upperSpecLimit === undefined ? {} : { upperSpecLimit: currentSystemSpecification.upperSpecLimit }),
            ...(currentSystemSpecification.targetSigmaLevel === undefined ? {} : { targetSigmaLevel: currentSystemSpecification.targetSigmaLevel }),
            ...(currentSystemSpecification.additionalMeanShift === undefined ? {} : { additionalMeanShift: currentSystemSpecification.additionalMeanShift }),
            ...(currentSystemSpecification.volume === undefined ? {} : { volume: currentSystemSpecification.volume }),
          }
      : currentSystemSpecification;
    const snapshot = normalizeSnapshot({
      ...current.snapshot,
      status: "measurement_entry",
      factors,
      systemSpecification,
      monteCarloResult: undefined,
    });

    writeSession(parsedRequest.data.sessionId, {
      ...current,
      snapshot,
    });
    return cloneFrozenSnapshot(snapshot);
  };

  const setFactorMode = (request: { sessionId: string; factorId: string; mode: F7FactorSourceMode }): F7SessionSnapshot => {
    const parsedRequest = z.object({
      sessionId: z.string().min(1),
      factorId: z.string().regex(/^[a-f0-9]{64}$/),
      mode: z.enum(["MEASURED", "BASELINE_ASSUMPTION"]),
    }).strict().safeParse(request);
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");

    const current = readSession(parsedRequest.data.sessionId);
    if (current.snapshot.status !== "measurement_entry" && current.snapshot.status !== "phase_1_ready") {
      throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
    }

    let found = false;
    const factors = current.snapshot.factors.map((factorState) => {
      if (factorState.evidence?.factorId !== parsedRequest.data.factorId) return factorState;
      found = true;
      if (parsedRequest.data.mode === "BASELINE_ASSUMPTION") {
        if (factorState.evidence === undefined) throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
        const input: F7FactorInput = {
          mode: "BASELINE_ASSUMPTION",
          baselineSampler: factorState.evidence.baselineSampler,
        };
        return {
          factorCandidate: factorState.factorCandidate,
          setup: factorState.setup,
          evidence: factorState.evidence,
          sourceMode: "BASELINE_ASSUMPTION" as const,
          input,
        };
      }
      return {
        factorCandidate: factorState.factorCandidate,
        setup: factorState.setup,
        evidence: factorState.evidence,
        sourceMode: "MEASURED" as const,
        input: {
          mode: "MEASURED" as const,
        },
      };
    });

    if (!found) throw fixedError(NOT_FOUND_SUMMARY, "validation_error");

    const snapshot = normalizeSnapshot({
      ...current.snapshot,
      factors,
      status: computeMeasurementStatus({ ...current.snapshot, factors }),
      monteCarloResult: undefined,
    });

    writeSession(parsedRequest.data.sessionId, {
      ...current,
      snapshot,
    });
    return cloneFrozenSnapshot(snapshot);
  };

  const pasteMeasurements = (request: F7MeasurementPasteRequest & { sessionId: string }): F7SessionSnapshot => {
    const parsedRequest = z.object({
      sessionId: z.string().min(1),
      payload: f7MeasurementPasteRequestSchema,
    }).strict().safeParse({
      sessionId: request.sessionId,
      payload: {
        factorId: request.factorId,
        unit: request.unit,
        structure: request.structure,
        ...(request.rationalSubgroupConfig
          ? { rationalSubgroupConfig: request.rationalSubgroupConfig }
          : {}),
        sourceReference: request.sourceReference,
        msaStatus: request.msaStatus,
        text: request.text,
      },
    });
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");
    if (measurementRowCount(parsedRequest.data.payload.text) > F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS) {
      throw fixedError(SESSION_SUMMARY, "validation_error");
    }

    const current = readSession(parsedRequest.data.sessionId);
    if (current.snapshot.status !== "measurement_entry" && current.snapshot.status !== "phase_1_ready") {
      throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
    }

    const now = normalizeNow(dependencies.now());
    let found = false;
    const factors = current.snapshot.factors.map((factorState) => {
      if (factorState.evidence?.factorId !== parsedRequest.data.payload.factorId) return factorState;
      found = true;
      if (factorState.sourceMode !== "MEASURED" || factorState.input?.mode !== "MEASURED") {
        throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
      }
      if (factorState.evidence === undefined) throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");

      const parsed = parseF7MeasurementPaste({
        factorId: factorState.evidence.factorId,
        unit: factorState.evidence.unit,
        structure: parsedRequest.data.payload.structure,
        ...(parsedRequest.data.payload.rationalSubgroupConfig
          ? { rationalSubgroupConfig: parsedRequest.data.payload.rationalSubgroupConfig }
          : {}),
        sourceReference: parsedRequest.data.payload.sourceReference,
        importedAt: now,
        msaStatus: parsedRequest.data.payload.msaStatus,
        text: parsedRequest.data.payload.text,
      });

      const datasetValidation: F7DatasetValidationResult = parsed.dataset
        ? validateF7MeasurementDataset({ factor: factorState.evidence, dataset: parsed.dataset })
        : parsed.validation;

      const measurementPasteResult: F7MeasurementPasteResult = {
        status: datasetValidation.status === "ready" ? "ready" : "blocked",
        factorId: factorState.evidence.factorId,
        ...(parsed.dataset ? { dataset: parsed.dataset } : {}),
        validation: datasetValidation,
      };

      return {
        factorCandidate: factorState.factorCandidate,
        setup: factorState.setup,
        evidence: factorState.evidence,
        sourceMode: factorState.sourceMode,
        input: {
          mode: "MEASURED",
          ...(parsed.dataset ? { dataset: parsed.dataset } : {}),
        } satisfies F7FactorInput,
        datasetValidation,
        measurementPasteResult,
      };
    });

    if (!found) throw fixedError(NOT_FOUND_SUMMARY, "validation_error");

    const snapshot = normalizeSnapshot({
      ...current.snapshot,
      factors,
      status: computeMeasurementStatus({ ...current.snapshot, factors }),
      monteCarloResult: undefined,
    });

    writeSession(parsedRequest.data.sessionId, {
      ...current,
      snapshot,
    });
    return cloneFrozenSnapshot(snapshot);
  };

  const applyMeasurementDisposition = (request: F7MeasurementDispositionRequest & { sessionId: string }): F7SessionSnapshot => {
    const parsedSession = z.object({ sessionId: z.string().min(1) }).strict().safeParse({ sessionId: request.sessionId });
    if (!parsedSession.success) throw fixedError(SESSION_SUMMARY, "validation_error");
    const parsedDisposition = f7MeasurementDispositionRequestSchema.safeParse({
      factorId: request.factorId,
      rowNumbers: request.rowNumbers,
      action: request.action,
      reason: request.reason,
      operatorReference: request.operatorReference,
      confirmed: request.confirmed,
    });
    if (!parsedDisposition.success) throw fixedError(SESSION_SUMMARY, "validation_error");

    const current = readSession(parsedSession.data.sessionId);
    if (current.snapshot.status !== "measurement_entry" && current.snapshot.status !== "phase_1_ready") {
      throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
    }

    let found = false;
    const factors = current.snapshot.factors.map((factorState) => {
      if (factorState.evidence?.factorId !== parsedDisposition.data.factorId) return factorState;
      found = true;
      if (factorState.sourceMode !== "MEASURED" || factorState.input?.mode !== "MEASURED") {
        throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
      }
      if (factorState.evidence === undefined || factorState.input.dataset === undefined) {
        throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
      }

      const dataset = applyF7MeasurementDisposition({
        dataset: factorState.input.dataset,
        rowNumbers: parsedDisposition.data.rowNumbers,
        action: parsedDisposition.data.action,
        reason: parsedDisposition.data.reason,
        operatorReference: parsedDisposition.data.operatorReference,
        confirmed: parsedDisposition.data.confirmed,
      });
      const datasetValidation = validateF7MeasurementDataset({ factor: factorState.evidence, dataset });

      const measurementPasteResult: F7MeasurementPasteResult = {
        status: datasetValidation.status === "ready" ? "ready" : "blocked",
        factorId: factorState.evidence.factorId,
        dataset,
        validation: datasetValidation,
      };

      return {
        factorCandidate: factorState.factorCandidate,
        setup: factorState.setup,
        evidence: factorState.evidence,
        sourceMode: factorState.sourceMode,
        input: {
          mode: "MEASURED",
          dataset,
        } satisfies F7FactorInput,
        datasetValidation,
        measurementPasteResult,
      };
    });

    if (!found) throw fixedError(NOT_FOUND_SUMMARY, "validation_error");

    const snapshot = normalizeSnapshot({
      ...current.snapshot,
      factors,
      status: computeMeasurementStatus({ ...current.snapshot, factors }),
      monteCarloResult: undefined,
    });

    writeSession(parsedSession.data.sessionId, {
      ...current,
      snapshot,
    });
    return cloneFrozenSnapshot(snapshot);
  };

  const fitDistribution = (request: { sessionId: string; factorId: string }): F7SessionSnapshot => {
    const parsedRequest = z.object({
      sessionId: z.string().min(1),
      factorId: z.string().regex(/^[a-f0-9]{64}$/),
    }).strict().safeParse(request);
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");

    const current = readSession(parsedRequest.data.sessionId);
    if (current.snapshot.status !== "measurement_entry" && current.snapshot.status !== "phase_1_ready") {
      throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
    }

    let found = false;
    const factors = current.snapshot.factors.map((factorState) => {
      if (factorState.evidence?.factorId !== parsedRequest.data.factorId) return factorState;
      found = true;
      if (
        factorState.sourceMode !== "MEASURED"
        || factorState.input?.mode !== "MEASURED"
        || factorState.input.dataset === undefined
        || factorState.datasetValidation?.status !== "ready"
        || factorState.measurementPasteResult?.status !== "ready"
      ) {
        throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
      }

      const observations = factorState.input.dataset.observations
        .filter((observation) => observation.disposition === "included")
        .map((observation) => observation.value);
      let distributionFitResult;
      try {
        distributionFitResult = fitDistributionDataset({
          factorId: parsedRequest.data.factorId,
          observations,
          candidateEligibility: factorState.datasetValidation.candidateEligibility,
          characteristicKind: distributionCharacteristicKindForFactor(factorState),
          bootstrapSeed: distributionFitSeed(
            parsedRequest.data.sessionId,
            parsedRequest.data.factorId,
            factorState.input.dataset.contentHash,
          ),
        });
      } catch {
        throw fixedDistributionFitError();
      }
      const proposedFamily = distributionFitResult.selectionDecision.proposedFinalFamily;
      const proposedCandidate = distributionFitResult.candidates.find((candidate) => (
        candidate.family === proposedFamily
      ));
      const distributionApproval = proposedFamily !== undefined
        && proposedCandidate?.bootstrap.status === "acceptable"
        ? {
            factorId: parsedRequest.data.factorId,
            family: proposedFamily,
            confirmed: true as const,
            approvedAt: normalizeNow(dependencies.now()),
          }
        : undefined;
      return { ...factorState, distributionFitResult, distributionApproval };
    });

    if (!found) throw fixedError(NOT_FOUND_SUMMARY, "validation_error");
    const snapshot = normalizeSnapshot({ ...current.snapshot, factors, monteCarloResult: undefined });
    writeSession(parsedRequest.data.sessionId, { ...current, snapshot });
    return cloneFrozenSnapshot(snapshot);
  };

  const approveDistribution = (request: {
    sessionId: string;
    factorId: string;
    family: F7DistributionCandidateFamily;
    confirmed: true;
  }): F7SessionSnapshot => {
    const parsedRequest = f7DistributionApprovalRouteRequestSchema.safeParse({
      params: { factorId: request.factorId },
      body: { sessionId: request.sessionId, family: request.family, confirmed: request.confirmed },
    });
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");
    const current = readSession(parsedRequest.data.body.sessionId);
    let found = false;
    const approvedAt = normalizeNow(dependencies.now());
    const factors = current.snapshot.factors.map((factorState) => {
      if (factorState.evidence?.factorId !== parsedRequest.data.params.factorId) return factorState;
      found = true;
      const fit = factorState.distributionFitResult;
      const candidate = fit?.candidates.find((entry) => entry.family === parsedRequest.data.body.family);
      if (fit?.selectionDecision.proposedFinalFamily !== parsedRequest.data.body.family
        || candidate?.bootstrap.status !== "acceptable") {
        throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
      }
      return {
        ...factorState,
        distributionApproval: {
          factorId: parsedRequest.data.params.factorId,
          family: parsedRequest.data.body.family,
          confirmed: true as const,
          approvedAt,
        },
      };
    });
    if (!found) throw fixedError(NOT_FOUND_SUMMARY, "validation_error");
    const snapshot = normalizeSnapshot({ ...current.snapshot, factors, monteCarloResult: undefined });
    writeSession(parsedRequest.data.body.sessionId, { ...current, snapshot });
    return cloneFrozenSnapshot(snapshot);
  };

  const runMonteCarlo = (request: Parameters<F7SessionService["runMonteCarlo"]>[0]): F7SessionSnapshot => {
    const parsedRequest = f7MonteCarloRunRouteRequestSchema.safeParse({ body: request });
    let requestBody;
    if (parsedRequest.success) {
      requestBody = parsedRequest.data.body;
    } else {
      const { targetSigmaLevel, ...legacyRequest } = request;
      const parsedLegacyRequest = f7MonteCarloRunRouteRequestSchema.safeParse({ body: legacyRequest });
      const parsedTargetSigmaLevel = z.number().finite().positive().safeParse(targetSigmaLevel);
      if (!parsedLegacyRequest.success || !parsedTargetSigmaLevel.success) {
        throw fixedError(SESSION_SUMMARY, "validation_error");
      }
      requestBody = { ...parsedLegacyRequest.data.body, targetSigmaLevel: parsedTargetSigmaLevel.data };
    }
    const current = readSession(requestBody.sessionId);
    if (!readyForPhaseOne(current.snapshot.factors)) {
      throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
    }
    const factors = current.snapshot.factors.map((factorState) => {
      const evidence = factorState.evidence;
      if (!evidence || !factorState.sourceMode) throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
      if (factorState.sourceMode === "BASELINE_ASSUMPTION") {
        if (evidence.baselineSampler.samplerId === "UNIFORM_BOUNDED_V1") {
          return {
            factorId: evidence.factorId,
            coefficient: evidence.loopCoefficient,
            sourceMode: factorState.sourceMode,
            family: "uniform" as const,
            parameters: {
              minimum: evidence.baselineSampler.minimum,
              maximum: evidence.baselineSampler.maximum,
            },
          };
        }
        return {
          factorId: evidence.factorId,
          coefficient: evidence.loopCoefficient,
          sourceMode: factorState.sourceMode,
          family: "normal" as const,
          parameters: {
            mean: evidence.baselineSampler.physicalMean,
            standardDeviation: evidence.baselineSampler.standardDeviation,
          },
        };
      }
      const approval = factorState.distributionApproval;
      const candidate = factorState.distributionFitResult?.candidates.find((entry) => entry.family === approval?.family);
      if (!approval || !candidate || candidate.bootstrap.status !== "acceptable") {
        throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
      }
      return {
        factorId: evidence.factorId,
        coefficient: evidence.loopCoefficient,
        sourceMode: factorState.sourceMode,
        family: candidate.family,
        parameters: candidate.parameters,
      };
    });
    const simulationRequest = {
      lowerSpecLimit: requestBody.lowerSpecLimit,
      upperSpecLimit: requestBody.upperSpecLimit,
      targetSigmaLevel: requestBody.targetSigmaLevel,
      iterations: requestBody.iterations,
      runSeed: requestBody.runSeed,
      correlationMode: requestBody.correlationMode,
      additionalMeanShift: current.snapshot.systemSpecification?.additionalMeanShift?.status === "available"
        && current.snapshot.systemSpecification.additionalMeanShift.valueOrigin !== "defaulted"
        ? current.snapshot.systemSpecification.additionalMeanShift.actualValue
        : 0,
      factors,
    };
    const monteCarloResult = runF7MonteCarloSimulation(simulationRequest);
    const snapshot = normalizeSnapshot({ ...current.snapshot, monteCarloResult });
    writeSession(requestBody.sessionId, { ...current, snapshot });
    return cloneFrozenSnapshot(snapshot);
  };

  const generateReport = (request: Parameters<F7SessionService["generateReport"]>[0]) => {
    const parsedRequest = f7ReportGenerateRouteRequestSchema.safeParse({ body: request });
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");

    const current = readSession(parsedRequest.data.body.sessionId);
    if (current.snapshot.status !== "phase_1_ready" || current.snapshot.monteCarloResult === undefined) {
      throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
    }
    try {
      return projectReport(current.snapshot, normalizeNow(dependencies.now()));
    } catch (error) {
      if (isF7ReportPrerequisiteError(error)) {
        throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
      }
      throw error;
    }
  };

  const getSession = (sessionId: string): F7SessionSnapshot => {
    if (typeof sessionId !== "string" || sessionId.trim().length === 0) throw fixedError(SESSION_SUMMARY, "validation_error");
    const current = readSession(sessionId);
    return cloneFrozenSnapshot(current.snapshot);
  };

  return Object.freeze({
    importWorkbook,
    confirmWorksheet,
    confirmFactorSetup,
    setFactorMode,
    pasteMeasurements,
    applyMeasurementDisposition,
    fitDistribution,
    approveDistribution,
    runMonteCarlo,
    generateReport,
    getSession,
    readDimensionChainImage,
  });
}