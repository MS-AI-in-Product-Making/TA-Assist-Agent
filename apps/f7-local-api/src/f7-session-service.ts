import {
  createTypedError,
  f7FactorSetupConfirmationSchema,
  f7MeasurementDispositionRequestSchema,
  f7MeasurementPasteRequestSchema,
  f7SessionSnapshotSchema,
  f7WorkbookImportRequestSchema,
  worksheetSelectionConfirmationSchema,
  type F7DatasetValidationResult,
  type F7FactorInput,
  type F7FactorSetupConfirmation,
  type F7FactorSourceMode,
  type F7MeasurementDispositionRequest,
  type F7MeasurementPasteRequest,
  type F7MeasurementPasteResult,
  type F7SessionService,
  type F7SessionSnapshot,
  type F7WorkbookImportRequest,
  type WorksheetSelectionConfirmation,
} from "@ai-assist/contracts";
import {
  applyF7MeasurementDisposition,
  confirmF7FactorSetup,
  createF7WorkbookImport,
  extractF7FactorCandidates,
  parseF7MeasurementPaste,
  validateF7MeasurementDataset,
  type F7FactorCandidateExtractionResult,
  type F7WorkbookImportResult,
} from "@ai-assist/workbook-catalog";
import { z } from "zod";

interface InternalSession {
  readonly workbookBytes: Uint8Array;
  readonly importResult: F7WorkbookImportResult;
  readonly extractionResult?: F7FactorCandidateExtractionResult;
  readonly snapshot: F7SessionSnapshot;
}

const SESSION_SUMMARY = "F7 session request is invalid.";
const PREREQUISITE_SUMMARY = "F7 session operation is not ready.";
const NOT_FOUND_SUMMARY = "F7 session state was not found.";
const INTERNAL_REFERENCE = "f7-session-service";
const CAPACITY_SUMMARY = "F7 local session capacity is reached.";

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

function fixedCapacityError(): Error {
  return createTypedError({
    code: "validation_error",
    summary: CAPACITY_SUMMARY,
    suggestedAction: "Restart the local API process or complete the current session before importing another workbook.",
    affectedInputReferences: [INTERNAL_REFERENCE],
  });
}

function cloneFrozenSnapshot(snapshot: F7SessionSnapshot): F7SessionSnapshot {
  return deepFreeze(structuredClone(snapshot));
}

function normalizeSnapshot(snapshot: F7SessionSnapshot): F7SessionSnapshot {
  const parsed = f7SessionSnapshotSchema.parse(structuredClone(snapshot));
  return deepFreeze(parsed);
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
}): F7SessionService {
  if (typeof dependencies.createId !== "function" || typeof dependencies.now !== "function") {
    throw fixedError(SESSION_SUMMARY, "validation_error");
  }

  const sessions = new Map<string, InternalSession>();

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
    if (sessions.size >= MAX_F7_LOCAL_SESSIONS) throw fixedCapacityError();

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

    const snapshot = normalizeSnapshot({
      ...current.snapshot,
      status: "factor_setup",
      selectedWorksheetNames: [extraction.worksheetName],
      worksheetOptions: current.importResult.prompt.options,
      factors: extraction.candidates.map((factorCandidate) => ({ factorCandidate })),
    });

    writeSession(parsedRequest.data.sessionId, {
      ...current,
      extractionResult: extraction,
      snapshot,
    });
    return cloneFrozenSnapshot(snapshot);
  };

  const confirmFactorSetup = (request: { sessionId: string; confirmations: readonly F7FactorSetupConfirmation[] }): F7SessionSnapshot => {
    const parsedRequest = z.object({
      sessionId: z.string().min(1),
      confirmations: z.array(f7FactorSetupConfirmationSchema).min(1),
    }).strict().safeParse(request);
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");

    const current = readSession(parsedRequest.data.sessionId);
    if (current.snapshot.status !== "factor_setup" || current.extractionResult === undefined) {
      throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
    }

    const setupResult = confirmF7FactorSetup({
      extractionResult: current.extractionResult,
      confirmations: parsedRequest.data.confirmations,
    });

    const factorByCandidateId = new Map(setupResult.factors.map((factor) => [factor.factorCandidateId, factor]));
    const confirmationByCandidateId = new Map(parsedRequest.data.confirmations.map((confirmation) => [
      confirmation.factorCandidateId,
      confirmation,
    ]));

    const factors = current.snapshot.factors.map((factorState) => {
      const factorEvidence = factorByCandidateId.get(factorState.factorCandidate.factorCandidateId);
      const setup = confirmationByCandidateId.get(factorState.factorCandidate.factorCandidateId);
      if (!factorEvidence || !setup) throw fixedError(SESSION_SUMMARY, "validation_error");
      return {
        factorCandidate: factorState.factorCandidate,
        setup,
        evidence: factorEvidence,
      };
    });

    const snapshot = normalizeSnapshot({
      ...current.snapshot,
      status: "measurement_entry",
      factors,
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
        sourceReference: request.sourceReference,
        msaStatus: request.msaStatus,
        text: request.text,
      },
    });
    if (!parsedRequest.success) throw fixedError(SESSION_SUMMARY, "validation_error");

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
    });

    writeSession(parsedSession.data.sessionId, {
      ...current,
      snapshot,
    });
    return cloneFrozenSnapshot(snapshot);
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
    getSession,
  });
}