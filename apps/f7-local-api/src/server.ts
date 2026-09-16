import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  f7DistributionApprovalRouteRequestSchema,
  f7DistributionFitRouteRequestSchema,
  f7FactorConfirmRouteRequestSchema,
  f7FactorModeRouteRequestSchema,
  f7MeasurementImportCommitRouteRequestSchema,
  f7MeasurementImportPreviewResponseSchema,
  f7MeasurementImportPreviewRouteRequestSchema,
  f7MeasurementDispositionRouteRequestSchema,
  f7MeasurementPasteRouteRequestSchema,
  f7MonteCarloRunRouteRequestSchema,
  f7ReportGenerateRouteRequestSchema,
  f7SessionRouteParamsSchema,
  f7WorkbookImportRouteRequestSchema,
  f7WorksheetConfirmRouteRequestSchema,
  typedErrorSchema,
  type F7SessionService,
  type F7MeasurementImportDiagnostic,
  type F7MeasurementImportFactorPreview,
  type TypedError,
} from "@ai-assist/contracts";
import {
  generateF7MeasurementTemplate,
  parseF7MeasurementTemplate,
  readOoxmlWorkbookFromSafeZip,
  readSafeZip,
  validateF7MeasurementDataset,
  type SafeZipParts,
} from "@ai-assist/workbook-catalog";
import {
  assumptionResultsPdfRouteRequestSchema,
  encodeRfc5987FileName,
  safePdfDownloadFileName,
  safeUnicodePdfDownloadFileName,
} from "./assumption-results-pdf-contract.js";
import {
  AssumptionResultsPdfQueueFullError,
  type AssumptionResultsPdfRenderer,
} from "./assumption-results-pdf-renderer.js";
import { validateAssumptionResultsPdfRequestAgainstSession } from "./assumption-results-pdf-session-validation.js";
import { F7_SESSION_NOT_FOUND_REASON_CODE } from "./f7-session-service.js";
import type { F7MeasurementImportRegistry } from "./f7-measurement-import-registry.js";

const REQUEST_SUMMARY = "F7 request is invalid.";
const INTERNAL_SUMMARY = "F7 local API request failed.";
const INTERNAL_REFERENCE = "f7-local-api";

const IMPORT_RAW_LIMIT_BYTES = 22_370_000;
const JSON_ROUTE_LIMIT_BYTES = 1_100_000;
const IMPORT_WORKBOOK_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 2_500_000;
const MAX_MEASUREMENT_IMPORT_COMMIT_RESPONSE_BYTES = IMPORT_RAW_LIMIT_BYTES;

const ROUTE_KIND_IMPORT = "f7.workbook.import";
const ROUTE_KIND_WORKSHEET_CONFIRM = "f7.workbook.worksheet-confirm";
const ROUTE_KIND_FACTORS_CONFIRM = "f7.factors.confirm";
const ROUTE_KIND_FACTOR_MODE = "f7.factors.mode";
const ROUTE_KIND_MEASUREMENT_PASTE = "f7.factors.measurements.paste";
const ROUTE_KIND_MEASUREMENT_DISPOSITION = "f7.factors.measurements.disposition";
const ROUTE_KIND_MEASUREMENT_IMPORT_TEMPLATE = "f7.measurements.import-template";
const ROUTE_KIND_MEASUREMENT_IMPORT_PREVIEW = "f7.measurements.import-preview";
const ROUTE_KIND_MEASUREMENT_IMPORT_COMMIT = "f7.measurements.import-commit";
const ROUTE_KIND_DISTRIBUTION_FIT = "f7.factors.distribution-fit";
const ROUTE_KIND_DISTRIBUTION_APPROVAL = "f7.factors.distribution-approval";
const ROUTE_KIND_MONTE_CARLO = "f7.monte-carlo.run";
const ROUTE_KIND_REPORT = "f7.report.generate";
const ROUTE_KIND_ASSUMPTION_RESULTS_PDF = "f7.assumption-results.pdf";
const ROUTE_KIND_SESSION_GET = "f7.session.get";
const ROUTE_KIND_DIMENSION_CHAIN_IMAGE_GET = "f7.session.dimension-chain-image.get";

const FACTOR_MODE_PATH = /^\/f7\/factors\/([^/]+)\/mode$/;
const FACTOR_MEASUREMENT_PASTE_PATH = /^\/f7\/factors\/([^/]+)\/measurements\/paste$/;
const FACTOR_MEASUREMENT_DISPOSITION_PATH = /^\/f7\/factors\/([^/]+)\/measurements\/disposition$/;
const FACTOR_DISTRIBUTION_FIT_PATH = /^\/f7\/factors\/([^/]+)\/distribution-fit$/;
const FACTOR_DISTRIBUTION_APPROVAL_PATH = /^\/f7\/factors\/([^/]+)\/distribution-approval$/;
const SESSION_PATH = /^\/f7\/session\/([^/]+)$/;
const DIMENSION_CHAIN_IMAGE_PATH = /^\/f7\/session\/([^/]+)\/dimension-chain-image$/;
const MEASUREMENT_IMPORT_TEMPLATE_PATH = "/f7/measurements/import-template";
const MEASUREMENT_IMPORT_PREVIEW_PATH = "/f7/measurements/import-preview";
const MEASUREMENT_IMPORT_COMMIT_PATH = "/f7/measurements/import-commit";
const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface ErrorEnvelope {
  readonly code: string;
  readonly summary: string;
  readonly suggestedAction: string;
  readonly affectedInputReferences: readonly string[];
}

const REQUEST_ENVELOPE: ErrorEnvelope = Object.freeze({
  code: "validation_error",
  summary: REQUEST_SUMMARY,
  suggestedAction: "Use the documented F7 route DTO and retry.",
  affectedInputReferences: [INTERNAL_REFERENCE],
});

const INTERNAL_ENVELOPE: ErrorEnvelope = Object.freeze({
  code: "internal_error",
  summary: INTERNAL_SUMMARY,
  suggestedAction: "Retry the request. If the problem persists, restart the local API.",
  affectedInputReferences: [INTERNAL_REFERENCE],
});

const PDF_RENDERER_BUSY_ENVELOPE: ErrorEnvelope = Object.freeze({
  code: "pdf_renderer_busy",
  summary: "The local PDF renderer is at capacity.",
  suggestedAction: "Wait for an active PDF generation to finish, then retry.",
  affectedInputReferences: ["f7-assumption-results-pdf"],
});

class HttpRouteError extends Error {
  constructor(
    readonly status: number,
    readonly envelope: ErrorEnvelope,
  ) {
    super(envelope.summary);
  }
}

function jsonContentType(headerValue: string | undefined): boolean {
  if (typeof headerValue !== "string") return false;
  const [mimeType] = headerValue.split(";");
  return mimeType?.trim().toLowerCase() === "application/json";
}

function headerContentLength(headers: IncomingMessage["headers"]): number | undefined {
  const raw = headers["content-length"];
  if (typeof raw !== "string") return undefined;
  if (!/^\d+$/.test(raw)) return undefined;
  const length = Number(raw);
  return Number.isFinite(length) ? length : undefined;
}

function hasBodyIndication(request: IncomingMessage): boolean {
  const contentLength = headerContentLength(request.headers);
  if (typeof contentLength === "number" && contentLength > 0) return true;
  return typeof request.headers["transfer-encoding"] === "string";
}

function hasValidSingleContentLength(request: IncomingMessage): boolean {
  const raw = request.headers["content-length"];
  if (raw === undefined) return true;
  if (Array.isArray(raw)) return false;
  if (raw.includes(",")) return false;
  return /^\d+$/.test(raw);
}

function transferEncodingValue(request: IncomingMessage): string | undefined {
  const raw = request.headers["transfer-encoding"];
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return "__invalid__";
  const normalized = raw.trim().toLowerCase();
  if (normalized.length === 0) return "__invalid__";
  return normalized;
}

function isBodyPostRoute(method: string, pathname: string): boolean {
  if (method !== "POST") return false;
  if (pathname === "/f7/workbook/import") return true;
  if (pathname === "/f7/workbook/worksheet-confirm") return true;
  if (pathname === "/f7/factors/confirm") return true;
  if (pathname === MEASUREMENT_IMPORT_TEMPLATE_PATH) return true;
  if (pathname === MEASUREMENT_IMPORT_PREVIEW_PATH) return true;
  if (pathname === MEASUREMENT_IMPORT_COMMIT_PATH) return true;
  if (FACTOR_MODE_PATH.test(pathname)) return true;
  if (FACTOR_MEASUREMENT_PASTE_PATH.test(pathname)) return true;
  if (FACTOR_MEASUREMENT_DISPOSITION_PATH.test(pathname)) return true;
  if (FACTOR_DISTRIBUTION_FIT_PATH.test(pathname)) return true;
  if (FACTOR_DISTRIBUTION_APPROVAL_PATH.test(pathname)) return true;
  if (pathname === "/f7/monte-carlo") return true;
  if (pathname === "/f7/report") return true;
  if (pathname === "/f7/assumption-results/pdf") return true;
  return false;
}

function validateRequestFraming(request: IncomingMessage, method: string, pathname: string): void {
  if (!hasValidSingleContentLength(request)) rejectBadRequest();

  const contentLengthHeader = request.headers["content-length"];
  const transferEncoding = transferEncodingValue(request);
  const hasTransferEncoding = transferEncoding !== undefined;

  if (contentLengthHeader !== undefined && hasTransferEncoding) {
    rejectBadRequest();
  }

  if (!isBodyPostRoute(method, pathname)) return;
  if (!hasTransferEncoding) return;
  if (transferEncoding !== "chunked") rejectBadRequest();
}

function writeClientErrorResponse(socket: NodeJS.WritableStream & { destroyed?: boolean; end: (chunk?: string) => void }): void {
  if (socket.destroyed) return;
  const rawResponse = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n";
  socket.end(rawResponse);
}

function mapTypedErrorStatus(error: TypedError): number {
  if (error.code === "policy_denied") return 403;
  if (error.code === "validation_error") {
    return 400;
  }
  if (error.code === "evidence_mismatch") return 400;
  if (error.code === "prerequisite_not_ready") return 409;
  if (error.code === "calculation_not_possible") return 409;
  if (error.code === "dependency_error") return 503;
  if (error.code === "transient_error") return 503;
  if (error.code === "feature_not_available") return 404;
  return 500;
}

function toErrorEnvelope(error: TypedError): ErrorEnvelope {
  return {
    code: error.code,
    summary: error.summary,
    suggestedAction: error.suggestedAction,
    affectedInputReferences: [...error.affectedInputReferences],
  };
}

function rejectBadRequest(): never {
  throw new HttpRouteError(400, REQUEST_ENVELOPE);
}

function rejectUnsupportedMediaType(): never {
  throw new HttpRouteError(415, REQUEST_ENVELOPE);
}

function rejectTooLarge(): never {
  throw new HttpRouteError(413, REQUEST_ENVELOPE);
}

async function readRawBody(request: IncomingMessage, limitBytes: number): Promise<Buffer> {
  const contentLength = headerContentLength(request.headers);
  if (typeof contentLength === "number" && contentLength > limitBytes) rejectTooLarge();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let finished = false;

    const finish = (callback: () => void): void => {
      if (finished) return;
      finished = true;
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("aborted", onAborted);
      request.off("error", onError);
      callback();
    };

    const onError = (): void => {
      finish(() => reject(new HttpRouteError(400, REQUEST_ENVELOPE)));
    };

    const onAborted = (): void => {
      finish(() => reject(new HttpRouteError(400, REQUEST_ENVELOPE)));
    };

    const onData = (chunk: Buffer): void => {
      total += chunk.length;
      if (total > limitBytes) {
        request.destroy();
        finish(() => reject(new HttpRouteError(413, REQUEST_ENVELOPE)));
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = (): void => {
      finish(() => resolve(Buffer.concat(chunks)));
    };

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("aborted", onAborted);
    request.on("error", onError);
  });
}

async function readStrictJsonObject(request: IncomingMessage, limitBytes: number): Promise<Record<string, unknown>> {
  if (!jsonContentType(request.headers["content-type"])) rejectUnsupportedMediaType();
  const raw = await readRawBody(request, limitBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    rejectBadRequest();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) rejectBadRequest();
  return parsed as Record<string, unknown>;
}

function decodeURIComponentStrict(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    rejectBadRequest();
  }
}

function decodeCanonicalBase64(base64: string): Uint8Array<ArrayBuffer> {
  if (base64.length % 4 !== 0) rejectBadRequest();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) rejectBadRequest();

  const decoded = Buffer.from(base64, "base64");
  if (decoded.toString("base64") !== base64) rejectBadRequest();
  if (decoded.length === 0) rejectBadRequest();
  if (decoded.length > IMPORT_WORKBOOK_LIMIT_BYTES) rejectTooLarge();
  const copiedBuffer = new ArrayBuffer(decoded.length);
  const copied = new Uint8Array(copiedBuffer);
  copied.set(decoded);
  return copied;
}

async function resolveMeasuredUnit(
  service: F7SessionService,
  sessionId: string,
  factorId: string,
): Promise<string> {
  const snapshot = service.getSession(sessionId);
  const match = snapshot.factors.find((factorState) => factorState.evidence?.factorId === factorId);
  const unit = match?.evidence?.unit;
  if (typeof unit !== "string" || unit.length === 0) {
    throw new HttpRouteError(400, REQUEST_ENVELOPE);
  }
  return unit;
}

function writeJson(response: ServerResponse, status: number, payload: unknown, maxBytes = MAX_RESPONSE_BYTES): number {
  if (response.writableEnded || response.destroyed) return status;

  let responseStatus = status;
  let responsePayload = payload;

  let serialized = JSON.stringify(responsePayload);
  if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
    responseStatus = 500;
    responsePayload = INTERNAL_ENVELOPE;
    serialized = JSON.stringify(responsePayload);
  }

  response.statusCode = responseStatus;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-length", Buffer.byteLength(serialized, "utf8"));
  response.end(serialized);
  return responseStatus;
}

function writeImage(response: ServerResponse, mediaType: "image/png" | "image/jpeg", bytes: Uint8Array): void {
  if (response.writableEnded || response.destroyed) return;
  response.statusCode = 200;
  response.setHeader("content-type", mediaType);
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("content-length", bytes.byteLength);
  response.end(bytes);
}

function safeMeasurementTemplateFileName(worksheetName: string): string {
  const sanitized = worksheetName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 120);
  return `F7_Measurements_${sanitized || "Worksheet"}.xlsx`;
}

function writeXlsx(response: ServerResponse, bytes: Uint8Array, worksheetName: string): void {
  if (response.writableEnded || response.destroyed) return;
  response.statusCode = 200;
  response.setHeader("content-type", XLSX_CONTENT_TYPE);
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("content-length", bytes.byteLength);
  response.setHeader("content-disposition", `attachment; filename="${safeMeasurementTemplateFileName(worksheetName)}"`);
  response.end(bytes);
}

function readMeasurementTemplateIdentity(bytes: Uint8Array): { readonly templateId: string; readonly safeParts: SafeZipParts } {
  try {
    const safeParts = readSafeZip(bytes);
    const workbook = readOoxmlWorkbookFromSafeZip(safeParts, ["_F7_MANIFEST"], false, { maxRow: 13, maxColumn: "B" });
    const manifest = workbook.worksheets.get("_F7_MANIFEST");
    const templateId = manifest?.cells.find((cell) => cell.reference === "B4")?.value;
    if (typeof templateId !== "string" || templateId.length === 0) rejectBadRequest();
    return { templateId, safeParts };
  } catch (error) {
    if (error instanceof HttpRouteError) throw error;
    rejectBadRequest();
  }
}

function staleMeasurementImport(): never {
  throw new HttpRouteError(409, {
    code: "prerequisite_not_ready",
    summary: "The measurement import template is stale.",
    suggestedAction: "Download a new template for the current F7 session and retry.",
    affectedInputReferences: ["f7-measurement-import"],
  });
}

function rejectMeasurementImportPreview(status: "not_found" | "expired" | "stale" | "blocked" | "consumed" | "session_mismatch"): never {
  if (status === "not_found" || status === "session_mismatch") rejectBadRequest();
  throw new HttpRouteError(409, {
    code: "prerequisite_not_ready",
    summary: "The measurement import preview cannot be committed.",
    suggestedAction: "Create and confirm a new measurement import preview for the current F7 session.",
    affectedInputReferences: ["f7-measurement-import"],
  });
}

const blockedCandidateEligibility = Object.freeze({
  normal: "eligible" as const,
  lognormal: "ineligible_nonpositive" as const,
  weibull: "ineligible_nonpositive" as const,
  gamma: "ineligible_nonpositive" as const,
  uniform: "eligible_with_boundary_warning" as const,
});

function previewWarning(
  reason: F7MeasurementImportDiagnostic["reason"],
  factor: { readonly factorId: string; readonly factorName: string },
  displayMessage: string,
): F7MeasurementImportDiagnostic {
  return { reason, factorId: factor.factorId, factorName: factor.factorName, displayMessage };
}

function factorWarnings(
  factor: { readonly factorId: string; readonly factorName: string; readonly lowerSpecLimit: number; readonly upperSpecLimit: number; readonly limitStatus: "VALID" | "CROSSES_ZERO" },
  dataset: { readonly observations: ReadonlyArray<{ readonly value: number; readonly disposition: string }> },
  advisoryCount: number,
): F7MeasurementImportDiagnostic[] {
  const warnings: F7MeasurementImportDiagnostic[] = [];
  if (factor.limitStatus === "CROSSES_ZERO") {
    warnings.push(previewWarning("sample_validation_failure", factor, "Factor specification crosses zero; physical LSL is 0."));
  }
  const outOfSpecCount = dataset.observations.filter((observation) =>
    observation.disposition === "included"
      && (observation.value < factor.lowerSpecLimit || observation.value > factor.upperSpecLimit)).length;
  if (outOfSpecCount > 0) {
    warnings.push(previewWarning(
      "sample_validation_failure",
      factor,
      `${outOfSpecCount} included measurement${outOfSpecCount === 1 ? " is" : "s are"} outside the Factor specification.`,
    ));
  }
  if (advisoryCount > 0) {
    warnings.push(previewWarning(
      "sample_validation_failure",
      factor,
      `${advisoryCount} governed dataset validation advisor${advisoryCount === 1 ? "y" : "ies"} require review.`,
    ));
  }
  return warnings;
}

function writePdf(
  response: ServerResponse,
  bytes: Buffer,
  fallbackFileName: string,
  unicodeFileName: string,
): void {
  if (response.writableEnded || response.destroyed) return;
  response.statusCode = 200;
  response.setHeader("content-type", "application/pdf");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("content-length", bytes.byteLength);
  response.setHeader(
    "content-disposition",
    `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodeRfc5987FileName(unicodeFileName)}`,
  );
  response.end(bytes);
}

function writeFailure(response: ServerResponse, error: unknown): number {
  if (error instanceof HttpRouteError) {
    writeJson(response, error.status, error.envelope);
    return error.status;
  }

  if (error instanceof AssumptionResultsPdfQueueFullError) {
    writeJson(response, 503, PDF_RENDERER_BUSY_ENVELOPE);
    return 503;
  }

  const parsed = typedErrorSchema.safeParse(error);
  if (parsed.success) {
    const status = mapTypedErrorStatus(parsed.data);
    writeJson(response, status, toErrorEnvelope(parsed.data));
    return status;
  }

  writeJson(response, 500, INTERNAL_ENVELOPE);
  return 500;
}

function routeNotFound(response: ServerResponse): number {
  writeJson(response, 404, REQUEST_ENVELOPE);
  return 404;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: F7SessionService,
  measurementImportRegistry: F7MeasurementImportRegistry,
  assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer,
  validateAssumptionResultsPdfRequest: typeof validateAssumptionResultsPdfRequestAgainstSession,
): Promise<{ kind: string; status: number } | undefined> {
  const method = request.method ?? "";
  const parsedUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = parsedUrl.pathname;

  if (method === "POST" && pathname === MEASUREMENT_IMPORT_TEMPLATE_PATH) {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const routeRequest = f7SessionRouteParamsSchema.safeParse(body);
    if (!routeRequest.success) rejectBadRequest();
    const registration = measurementImportRegistry.registerTemplate({
      sessionId: routeRequest.data.sessionId,
      createAuthority: ({ templateId }) => service.getMeasurementImportAuthority({
        sessionId: routeRequest.data.sessionId,
        templateId,
      }),
    });
    const bytes = generateF7MeasurementTemplate(registration.authority);
    writeXlsx(response, bytes, registration.authority.manifest.worksheetName);
    return { kind: ROUTE_KIND_MEASUREMENT_IMPORT_TEMPLATE, status: 200 };
  }

  if (method === "POST" && pathname === MEASUREMENT_IMPORT_PREVIEW_PATH) {
    const body = await readStrictJsonObject(request, IMPORT_RAW_LIMIT_BYTES);
    if (typeof body.workbookBase64 !== "string") rejectBadRequest();
    const workbookBytes = decodeCanonicalBase64(body.workbookBase64);
    const routeRequest = f7MeasurementImportPreviewRouteRequestSchema.safeParse({
      body: { ...body, workbookBase64: "AA==" },
    });
    if (!routeRequest.success) rejectBadRequest();
    const { templateId, safeParts } = readMeasurementTemplateIdentity(workbookBytes);
    const resolved = measurementImportRegistry.resolveTemplate({
      sessionId: routeRequest.data.body.sessionId,
      templateId,
    });
    if (resolved.status === "session_mismatch" || resolved.status === "not_found") rejectBadRequest();
    if (resolved.status !== "available") staleMeasurementImport();

    const currentContext = service.getMeasurementImportAuthority({
      sessionId: routeRequest.data.body.sessionId,
      templateId,
    });
    if (currentContext.authority.authorityDigest !== resolved.authority.authorityDigest
      || currentContext.authority.sessionStateDigest !== resolved.authority.sessionStateDigest
      || currentContext.authority.manifest.factorSetDigest !== resolved.authority.manifest.factorSetDigest) {
      staleMeasurementImport();
    }

    const snapshot = service.getSession(routeRequest.data.body.sessionId);
    const parsedTemplate = parseF7MeasurementTemplate(workbookBytes, resolved.authority, new Date().toISOString(), safeParts);
    const stateByFactorId = new Map(snapshot.factors.flatMap((state) =>
      state.evidence ? [[state.evidence.factorId, state] as const] : []));
    let factorPreviews: F7MeasurementImportFactorPreview[];

    if (parsedTemplate.status === "ready") {
      factorPreviews = parsedTemplate.datasets.map((dataset, index) => {
        const factor = resolved.authority.manifest.factors[index]!;
        const factorState = stateByFactorId.get(factor.factorId);
        const evidence = factorState?.evidence;
        if (!evidence) rejectBadRequest();
        const validation = validateF7MeasurementDataset({ factor: evidence, dataset });
        const replacesExistingFactor = factorState.input?.mode === "MEASURED" && factorState.input.dataset !== undefined;
        return {
          factorId: factor.factorId,
          factorName: factor.factorName,
          unit: factor.unit,
          structure: dataset.structure,
          ...(dataset.rationalSubgroupConfig ? { rationalSubgroupConfig: dataset.rationalSubgroupConfig } : {}),
          sampleCount: dataset.observations.length,
          status: validation.status,
          replacesExistingFactor,
          diagnostics: [],
          warnings: factorWarnings(factor, dataset, validation.advisoryIssues.length),
          dataset,
          validation,
        };
      });
    } else {
      factorPreviews = resolved.authority.manifest.factors.map((factor) => ({
        factorId: factor.factorId,
        factorName: factor.factorName,
        unit: factor.unit,
        structure: "UNORDERED_SAMPLE",
        sampleCount: 0,
        status: "blocked",
        replacesExistingFactor: false,
        diagnostics: parsedTemplate.diagnostics.filter((diagnostic) =>
          diagnostic.factorId === undefined || diagnostic.factorId === factor.factorId),
        warnings: factor.limitStatus === "CROSSES_ZERO"
          ? [previewWarning("sample_validation_failure", factor, "Factor specification crosses zero; physical LSL is 0.")]
          : [],
        validation: {
          status: "blocked",
          blockingIssues: [{ reason: "sample_count_below_minimum", factorId: factor.factorId }],
          advisoryIssues: [],
          candidateEligibility: blockedCandidateEligibility,
        },
      }));
    }

    const replacementFactorIds = factorPreviews
      .filter((factor) => factor.replacesExistingFactor)
      .map((factor) => factor.factorId);
    const readyFactors = factorPreviews.filter((factor) => factor.status === "ready" && factor.dataset !== undefined);
    const stored = readyFactors.length === factorPreviews.length
      ? measurementImportRegistry.storePreview({
        sessionId: routeRequest.data.body.sessionId,
        templateId,
        createStoredBatch: ({ previewId, expiresAt }) => ({
          previewId,
          sessionId: routeRequest.data.body.sessionId,
          expiresAt,
          sessionStateDigest: resolved.authority.sessionStateDigest,
          factorSetDigest: resolved.authority.manifest.factorSetDigest,
          authority: resolved.authority,
          replacementFactorIds,
          factors: readyFactors.map((factor) => ({
            factorId: factor.factorId,
            factorName: factor.factorName,
            unit: factor.unit,
            replacesExistingFactor: factor.replacesExistingFactor,
            dataset: factor.dataset!,
            validation: factor.validation,
          })),
        }),
      })
      : measurementImportRegistry.storeBlockedPreview({
        sessionId: routeRequest.data.body.sessionId,
        templateId,
      });
    const diagnostics = parsedTemplate.status === "blocked" ? parsedTemplate.diagnostics : [];
    const publicFactorPreviews = factorPreviews.map(({ dataset: _dataset, ...factor }) => factor);
    const preview = f7MeasurementImportPreviewResponseSchema.parse({
      previewId: stored.previewId,
      expiresAt: stored.expiresAt,
      sessionStateDigest: resolved.authority.sessionStateDigest,
      factorSetDigest: resolved.authority.manifest.factorSetDigest,
      status: readyFactors.length === factorPreviews.length ? "ready" : "blocked",
      factorCount: publicFactorPreviews.length,
      replacementFactorIds,
      factors: publicFactorPreviews,
      diagnostics,
      readyFactorCount: readyFactors.length,
      blockedFactorCount: publicFactorPreviews.length - readyFactors.length,
      replacementCount: replacementFactorIds.length,
      totalSampleCount: publicFactorPreviews.reduce((sum, factor) => sum + factor.sampleCount, 0),
      diagnosticCount: diagnostics.length,
    });
    writeJson(response, 200, preview);
    return { kind: ROUTE_KIND_MEASUREMENT_IMPORT_PREVIEW, status: 200 };
  }

  if (method === "POST" && pathname === MEASUREMENT_IMPORT_COMMIT_PATH) {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const routeRequest = f7MeasurementImportCommitRouteRequestSchema.safeParse({ body });
    if (!routeRequest.success) rejectBadRequest();

    const claimed = measurementImportRegistry.claimPreview({
      sessionId: routeRequest.data.body.sessionId,
      previewId: routeRequest.data.body.previewId,
    });
    if (claimed.status !== "claimed") rejectMeasurementImportPreview(claimed.status);

    const expectedReplacementFactorIds = [...claimed.preview.replacementFactorIds].sort();
    if (routeRequest.data.body.replacementFactorIds.length !== expectedReplacementFactorIds.length
      || routeRequest.data.body.replacementFactorIds.some((factorId, index) => factorId !== expectedReplacementFactorIds[index])) {
      rejectBadRequest();
    }

    const snapshot = service.commitMeasurementImport({
      sessionId: routeRequest.data.body.sessionId,
      expectedMeasurementImportRevision: claimed.expectedMeasurementImportRevision,
      sessionStateDigest: claimed.preview.sessionStateDigest,
      factorSetDigest: claimed.preview.factorSetDigest,
      authority: claimed.preview.authority,
      replacementFactorIds: claimed.preview.replacementFactorIds,
      factors: claimed.preview.factors,
    });
    const responseStatus = writeJson(response, 200, {
      contractId: "f7-analysis-result-v1",
      outputClassification: "confidential",
      snapshot,
    }, MAX_MEASUREMENT_IMPORT_COMMIT_RESPONSE_BYTES);
    return { kind: ROUTE_KIND_MEASUREMENT_IMPORT_COMMIT, status: responseStatus };
  }

  if (method === "POST" && pathname === "/f7/workbook/import") {
    const body = await readStrictJsonObject(request, IMPORT_RAW_LIMIT_BYTES);
    const routeRequest = f7WorkbookImportRouteRequestSchema.safeParse(body);
    if (!routeRequest.success) rejectBadRequest();

    const workbookBytes = decodeCanonicalBase64(routeRequest.data.workbookBase64);
    const snapshot = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: routeRequest.data.fileName,
      workbookBytes,
    });
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_IMPORT, status: 200 };
  }

  if (method === "POST" && pathname === "/f7/workbook/worksheet-confirm") {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const routeRequest = f7WorksheetConfirmRouteRequestSchema.safeParse(body);
    if (!routeRequest.success) rejectBadRequest();
    const snapshot = service.confirmWorksheet(routeRequest.data);
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_WORKSHEET_CONFIRM, status: 200 };
  }

  if (method === "POST" && pathname === "/f7/factors/confirm") {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const routeRequest = f7FactorConfirmRouteRequestSchema.safeParse(body);
    if (!routeRequest.success) rejectBadRequest();
    const snapshot = service.confirmFactorSetup(routeRequest.data);
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_FACTORS_CONFIRM, status: 200 };
  }

  const modePathMatch = FACTOR_MODE_PATH.exec(pathname);
  if (method === "POST" && modePathMatch) {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const factorId = decodeURIComponentStrict(modePathMatch[1]!);
    const routeRequest = f7FactorModeRouteRequestSchema.safeParse({
      params: { factorId },
      body,
    });
    if (!routeRequest.success) rejectBadRequest();
    const snapshot = service.setFactorMode({
      sessionId: routeRequest.data.body.sessionId,
      factorId: routeRequest.data.params.factorId,
      mode: routeRequest.data.body.mode,
    });
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_FACTOR_MODE, status: 200 };
  }

  const measurementPastePathMatch = FACTOR_MEASUREMENT_PASTE_PATH.exec(pathname);
  if (method === "POST" && measurementPastePathMatch) {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const factorId = decodeURIComponentStrict(measurementPastePathMatch[1]!);
    const routeRequest = f7MeasurementPasteRouteRequestSchema.safeParse({
      params: { factorId },
      body,
    });
    if (!routeRequest.success) rejectBadRequest();
    const unit = await resolveMeasuredUnit(service, routeRequest.data.body.sessionId, routeRequest.data.params.factorId);
    const snapshot = service.pasteMeasurements({
      sessionId: routeRequest.data.body.sessionId,
      factorId: routeRequest.data.params.factorId,
      unit,
      structure: routeRequest.data.body.structure,
      ...(routeRequest.data.body.rationalSubgroupConfig
        ? { rationalSubgroupConfig: routeRequest.data.body.rationalSubgroupConfig }
        : {}),
      sourceReference: routeRequest.data.body.sourceReference,
      msaStatus: routeRequest.data.body.msaStatus,
      text: routeRequest.data.body.text,
    });
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_MEASUREMENT_PASTE, status: 200 };
  }

  const measurementDispositionPathMatch = FACTOR_MEASUREMENT_DISPOSITION_PATH.exec(pathname);
  if (method === "POST" && measurementDispositionPathMatch) {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const factorId = decodeURIComponentStrict(measurementDispositionPathMatch[1]!);
    const routeRequest = f7MeasurementDispositionRouteRequestSchema.safeParse({
      params: { factorId },
      body,
    });
    if (!routeRequest.success) rejectBadRequest();
    const snapshot = service.applyMeasurementDisposition({
      sessionId: routeRequest.data.body.sessionId,
      factorId: routeRequest.data.params.factorId,
      rowNumbers: routeRequest.data.body.rowNumbers,
      action: routeRequest.data.body.action,
      reason: routeRequest.data.body.reason,
      operatorReference: routeRequest.data.body.operatorReference,
      confirmed: routeRequest.data.body.confirmed,
    });
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_MEASUREMENT_DISPOSITION, status: 200 };
  }

  const distributionFitPathMatch = FACTOR_DISTRIBUTION_FIT_PATH.exec(pathname);
  if (method === "POST" && distributionFitPathMatch) {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const factorId = decodeURIComponentStrict(distributionFitPathMatch[1]!);
    const routeRequest = f7DistributionFitRouteRequestSchema.safeParse({
      params: { factorId },
      body,
    });
    if (!routeRequest.success) rejectBadRequest();
    const snapshot = service.fitDistribution({
      sessionId: routeRequest.data.body.sessionId,
      factorId: routeRequest.data.params.factorId,
    });
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_DISTRIBUTION_FIT, status: 200 };
  }

  const distributionApprovalPathMatch = FACTOR_DISTRIBUTION_APPROVAL_PATH.exec(pathname);
  if (method === "POST" && distributionApprovalPathMatch) {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const factorId = decodeURIComponentStrict(distributionApprovalPathMatch[1]!);
    const routeRequest = f7DistributionApprovalRouteRequestSchema.safeParse({ params: { factorId }, body });
    if (!routeRequest.success) rejectBadRequest();
    const snapshot = service.approveDistribution({
      sessionId: routeRequest.data.body.sessionId,
      factorId: routeRequest.data.params.factorId,
      family: routeRequest.data.body.family,
      confirmed: routeRequest.data.body.confirmed,
    });
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_DISTRIBUTION_APPROVAL, status: 200 };
  }

  if (method === "POST" && pathname === "/f7/monte-carlo") {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const routeRequest = f7MonteCarloRunRouteRequestSchema.safeParse({ body });
    if (!routeRequest.success) rejectBadRequest();
    const snapshot = service.runMonteCarlo(routeRequest.data.body);
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_MONTE_CARLO, status: 200 };
  }

  if (method === "POST" && pathname === "/f7/report") {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const routeRequest = f7ReportGenerateRouteRequestSchema.safeParse({ body });
    if (!routeRequest.success) rejectBadRequest();
    const report = service.generateReport(routeRequest.data.body);
    writeJson(response, 200, report);
    return { kind: ROUTE_KIND_REPORT, status: 200 };
  }

  if (method === "POST" && pathname === "/f7/assumption-results/pdf") {
    const body = await readStrictJsonObject(request, JSON_ROUTE_LIMIT_BYTES);
    const routeRequest = assumptionResultsPdfRouteRequestSchema.safeParse(body);
    if (!routeRequest.success) rejectBadRequest();
    let sessionSnapshot;
    try {
      sessionSnapshot = service.getSession(routeRequest.data.sessionId);
    } catch (error) {
      const parsedError = typedErrorSchema.safeParse(error);
      const reasonCode = error && typeof error === "object" && "reasonCode" in error
        ? error.reasonCode
        : undefined;
      if (
        parsedError.success
        && parsedError.data.code === "validation_error"
        && reasonCode === F7_SESSION_NOT_FOUND_REASON_CODE
      ) {
        throw new HttpRouteError(404, toErrorEnvelope(parsedError.data));
      }
      throw error;
    }

    const validation = validateAssumptionResultsPdfRequest(routeRequest.data, sessionSnapshot);
    if (!validation.ok) rejectBadRequest();

    const pdfBytes = await assumptionResultsPdfRenderer.render(routeRequest.data);
    if (pdfBytes.length === 0 || pdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("Assumption-results renderer returned invalid PDF bytes.");
    }
    const fallbackFileName = safePdfDownloadFileName(
      routeRequest.data.workbookName,
      routeRequest.data.worksheetName,
    );
    const unicodeFileName = safeUnicodePdfDownloadFileName(
      routeRequest.data.workbookName,
      routeRequest.data.worksheetName,
    );
    writePdf(response, pdfBytes, fallbackFileName, unicodeFileName);
    return { kind: ROUTE_KIND_ASSUMPTION_RESULTS_PDF, status: 200 };
  }

  const dimensionChainImagePathMatch = DIMENSION_CHAIN_IMAGE_PATH.exec(pathname);
  if (method === "GET" && dimensionChainImagePathMatch) {
    if (parsedUrl.search.length > 0) rejectBadRequest();
    if (hasBodyIndication(request)) rejectBadRequest();
    const sessionId = decodeURIComponentStrict(dimensionChainImagePathMatch[1]!);
    const params = f7SessionRouteParamsSchema.safeParse({ sessionId });
    if (!params.success) rejectBadRequest();
    const image = service.readDimensionChainImage(params.data.sessionId);
    writeImage(response, image.mediaType, image.bytes);
    return { kind: ROUTE_KIND_DIMENSION_CHAIN_IMAGE_GET, status: 200 };
  }

  const sessionPathMatch = SESSION_PATH.exec(pathname);
  if (method === "GET" && sessionPathMatch) {
    if (parsedUrl.search.length > 0) rejectBadRequest();
    if (hasBodyIndication(request)) rejectBadRequest();
    const sessionId = decodeURIComponentStrict(sessionPathMatch[1]!);
    const params = f7SessionRouteParamsSchema.safeParse({ sessionId });
    if (!params.success) rejectBadRequest();
    const snapshot = service.getSession(params.data.sessionId);
    writeJson(response, 200, snapshot);
    return { kind: ROUTE_KIND_SESSION_GET, status: 200 };
  }

  return undefined;
}

export function createF7LocalServer(options: {
  readonly service: F7SessionService;
  readonly measurementImportRegistry: F7MeasurementImportRegistry;
  readonly assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer;
  readonly validateAssumptionResultsPdfRequestAgainstSession?: typeof validateAssumptionResultsPdfRequestAgainstSession;
  readonly onEvent?: (event: { readonly kind: string; readonly status: number }) => void;
}): Server {
  const validateAssumptionResultsPdfRequest = options.validateAssumptionResultsPdfRequestAgainstSession
    ?? validateAssumptionResultsPdfRequestAgainstSession;

  const server = createServer(async (request, response) => {
    response.on("error", () => {});

    let eventKind = "f7.route.unknown";
    let eventStatus = 500;
    try {
      const method = request.method ?? "";
      const parsedUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      if (method === "POST" && parsedUrl.pathname === "/f7/assumption-results/pdf") {
        eventKind = ROUTE_KIND_ASSUMPTION_RESULTS_PDF;
      }
      if (method === "POST" && parsedUrl.pathname === MEASUREMENT_IMPORT_COMMIT_PATH) {
        eventKind = ROUTE_KIND_MEASUREMENT_IMPORT_COMMIT;
      }
      validateRequestFraming(request, method, parsedUrl.pathname);
      const handled = await handleRequest(
        request,
        response,
        options.service,
        options.measurementImportRegistry,
        options.assumptionResultsPdfRenderer,
        validateAssumptionResultsPdfRequest,
      );
      if (handled) {
        eventKind = handled.kind;
        eventStatus = handled.status;
      } else {
        eventStatus = routeNotFound(response);
      }
    } catch (error) {
      eventStatus = writeFailure(response, error);
    }

    if (typeof options.onEvent === "function") {
      options.onEvent({ kind: eventKind, status: eventStatus });
    }
  });

  server.on("clientError", (_error, socket) => {
    writeClientErrorResponse(socket);
  });

  return server;
}

export function listenF7LocalServer(server: Server, port = 4317): Promise<AddressInfo> {
  return new Promise<AddressInfo>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      server.close(() => reject(error));
    };

    const onListening = (): void => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Server address is not available."));
        return;
      }
      resolve(address);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}
