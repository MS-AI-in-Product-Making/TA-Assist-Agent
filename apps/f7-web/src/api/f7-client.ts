import type {
  F7DatasetValidationIssue as ContractF7DatasetValidationIssue,
  F7DatasetValidationResult as ContractF7DatasetValidationResult,
  F7DistributionApprovalRouteRequest,
  F7DistributionFitResult as ContractF7DistributionFitResult,
  F7DistributionFitRouteRequest,
  F7ExclusionReason as ContractF7ExclusionReason,
  F7FactorCandidate as ContractF7FactorCandidate,
  F7FactorConfirmRouteRequest,
  F7FactorEvidence as ContractF7FactorEvidence,
  F7FactorInput as ContractF7FactorInput,
  F7FactorModeRouteRequest,
  F7FactorSourceMode,
  F7LoopCoefficient as ContractF7LoopCoefficient,
  F7MeasurementDataset as ContractF7MeasurementDataset,
  F7MeasurementDispositionRouteRequest,
  F7MeasurementImportCommitRouteRequest,
  F7MeasurementImportPreviewResponse as ContractF7MeasurementImportPreviewResponse,
  F7MeasurementImportPreviewRouteRequest,
  F7MeasurementPasteResult as ContractF7MeasurementPasteResult,
  F7MeasurementPasteRouteRequest,
  F7MeasurementStructure as ContractF7MeasurementStructure,
  F7RationalSubgroupConfig as ContractF7RationalSubgroupConfig,
  F7MonteCarloRunRouteRequest,
  F7MsaStatus as ContractF7MsaStatus,
  F7ReportProjection as ContractF7ReportProjection,
  F7SessionRouteParams,
  F7SessionSnapshot as ContractF7SessionSnapshot,
  F7ToleranceDistribution,
  F7WorksheetConfirmRouteRequest,
  F7WorkbookImportRouteRequest,
} from "@ai-assist/contracts";
import type { AssumptionResultsEngineeringEvidence, DimensionChainVisual } from "../assumption-results-pdf-evidence";
import {
  f7AnalysisResultSchema,
  f7MeasurementImportPreviewResponseSchema,
  f7ReportProjectionSchema,
  f7SessionSnapshotSchema,
} from "@ai-assist/contracts";
import type { DeepReadonly } from "vue";

export type F7SessionStatus = ContractF7SessionSnapshot["status"];
export type F7SourceMode = F7FactorSourceMode;
export type F7SetupDistribution = F7ToleranceDistribution;
export type F7LoopCoefficient = ContractF7LoopCoefficient;
export type F7MeasurementStructure = ContractF7MeasurementStructure;
export type F7RationalSubgroupConfig = ContractF7RationalSubgroupConfig;
export type F7MsaStatus = ContractF7MsaStatus;
export type F7ExclusionReason = ContractF7ExclusionReason;

export interface F7UiError {
  readonly code: string;
  readonly summary: string;
  readonly suggestedAction: string;
  readonly affectedInputReferences: readonly string[];
}

export type F7WorksheetOption = ContractF7SessionSnapshot["worksheetOptions"][number];

export type F7FactorCandidate = Pick<
  ContractF7FactorCandidate,
  "factorCandidateId" | "factorName" | "excelSignedMean" | "designNominal" | "upperTolerance" | "lowerTolerance" | "sourceCells" | "workbookUnitEvidence"
>;

export type F7FactorEvidence = Pick<
  ContractF7FactorEvidence,
  "factorCandidateId" | "factorId" | "factorName" | "unit" | "designNominal" | "upperTolerance" | "lowerTolerance" | "loopCoefficient" | "physicalMean" | "signedContributionMean" | "sourceCells" | "lowerSpecLimit" | "upperSpecLimit"
>;

export type F7DatasetValidationIssue = Omit<
  Pick<ContractF7DatasetValidationIssue, "reason" | "factorId" | "rowNumbers">,
  "rowNumbers"
> & {
  readonly rowNumbers?: readonly number[];
};

export type F7DatasetValidationResult = ContractF7DatasetValidationResult;

export type F7DistributionFitCandidate = ContractF7DistributionFitResult["candidates"][number];

export type F7DistributionFitResult = ContractF7DistributionFitResult;

export type F7SessionSnapshot = ContractF7SessionSnapshot;

export type F7MeasurementDataset = ContractF7MeasurementDataset;

export type F7FactorInput = ContractF7FactorInput;

export type F7MeasurementPasteResult = ContractF7MeasurementPasteResult;

export type F7MeasurementImportPreviewResponse = ContractF7MeasurementImportPreviewResponse;

export interface F7MeasurementTemplateDownload {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export type F7ReportProjection = ContractF7ReportProjection;

export type F7FactorState = ContractF7SessionSnapshot["factors"][number];
export type F7SystemSpecificationInput = NonNullable<F7FactorConfirmRouteRequest["systemSpecification"]>;

type WorksheetConfirmRequest = {
  readonly sessionId: string;
  readonly workbookContentHash: F7WorksheetConfirmRouteRequest["confirmation"]["workbookContentHash"];
  readonly selectedWorksheetName: F7SessionSnapshot["worksheetOptions"][number]["worksheetName"];
  readonly confirmed: true;
};

type ConfirmFactorsRequest = {
  readonly sessionId: string;
  readonly confirmations: F7FactorConfirmRouteRequest["confirmations"];
  readonly systemSpecification: F7SystemSpecificationInput;
};

type SetFactorModeRequest = {
  readonly sessionId: string;
  readonly factorId: F7FactorModeRouteRequest["params"]["factorId"];
  readonly mode: F7FactorModeRouteRequest["body"]["mode"];
};

type PasteMeasurementsRequest = {
  readonly sessionId: string;
  readonly factorId: F7MeasurementPasteRouteRequest["params"]["factorId"];
} & F7MeasurementPasteRouteRequest["body"];

type ApplyMeasurementDispositionRequest = {
  readonly sessionId: string;
  readonly factorId: F7MeasurementDispositionRouteRequest["params"]["factorId"];
  readonly rowNumbers: readonly number[];
  readonly action: F7MeasurementDispositionRouteRequest["body"]["action"];
  readonly reason: F7MeasurementDispositionRouteRequest["body"]["reason"];
  readonly operatorReference: F7MeasurementDispositionRouteRequest["body"]["operatorReference"];
  readonly confirmed: F7MeasurementDispositionRouteRequest["body"]["confirmed"];
};

type FitDistributionRequest = {
  readonly sessionId: string;
  readonly factorId: F7DistributionFitRouteRequest["params"]["factorId"];
};

type ApproveDistributionRequest = {
  readonly sessionId: string;
  readonly factorId: F7DistributionApprovalRouteRequest["params"]["factorId"];
  readonly family: F7DistributionApprovalRouteRequest["body"]["family"];
  readonly confirmed: true;
};

type RunMonteCarloRequest = F7MonteCarloRunRouteRequest["body"];

type PdfAdjustmentRow = {
  readonly current: string;
  readonly recommended: string;
  readonly adjustment: string;
};

type PdfAdjustmentOutcome = {
  readonly label: string;
  readonly value: string;
  readonly context: string;
};

type PdfActionBase = {
  readonly title: string;
  readonly narrative: string;
};

type AssumptionResultsPdfActionItem =
  | PdfActionBase & {
      readonly optionId: "improvement-center-mean";
      readonly meanCenteringAdjustment: PdfAdjustmentRow;
      readonly outcome: PdfAdjustmentOutcome;
      readonly specificationAdjustment?: never;
    }
  | PdfActionBase & {
      readonly optionId: "improvement-reduce-variation" | "improvement-reduce-contributor";
      readonly meanCenteringAdjustment?: never;
      readonly specificationAdjustment?: never;
      readonly outcome?: never;
    }
  | PdfActionBase & {
      readonly optionId: "improvement-relax-final-specification";
      readonly specificationAdjustment: {
        readonly lower: PdfAdjustmentRow;
        readonly upper: PdfAdjustmentRow;
      };
      readonly outcome: PdfAdjustmentOutcome;
      readonly meanCenteringAdjustment?: never;
    };

export type AssumptionResultsPdfRequest = {
  readonly sessionId: string;
  readonly dimensionChainVisual: DimensionChainVisual;
  readonly workbookName: string;
  readonly worksheetName: string;
  readonly resultJudgment: {
    readonly status: "meets-target" | "below-target";
    readonly headline: string;
  };
  readonly resultSummaryCaption: string;
  readonly summaryRows: readonly {
    readonly metric: string;
    readonly result: string;
    readonly reference: string;
    readonly referenceDetail?: string;
    readonly difference: string;
    readonly assessment: string;
    readonly performanceContext: string;
    readonly tone?: "pass" | "fail" | "warning";
  }[];
  readonly overallAssessment: string;
  readonly rootCauseItems: readonly {
    readonly title: string;
    readonly narrative: string;
    readonly hypothesisStatus: "hypothesis";
    readonly incompleteEvidence: boolean;
    readonly quantitativeEvidence: readonly {
      readonly label: string;
      readonly value: string;
    }[];
  }[];
  readonly actionItems: readonly AssumptionResultsPdfActionItem[];
  readonly contributors: readonly {
    readonly factorName: string;
    readonly reference: string;
    readonly designNominal: number;
    readonly upperTolerance: number;
    readonly lowerTolerance: number;
    readonly contributionPercent: number;
    readonly cumulativePercent: number;
  }[];
  readonly processGuidanceContext: string;
  readonly priorityRecommendation?: {
    readonly selectedPriority: "P0" | "P1" | "P2" | "P3";
    readonly requiresMeDmAlignment: true;
  };
  readonly priorityDefinitions?: readonly {
    readonly priority: "P0" | "P1" | "P2" | "P3";
    readonly title: string;
    readonly message: string;
  }[];
  readonly processGuidance: readonly {
    readonly state: "guidance" | "warning";
    readonly title: string;
    readonly message: string;
  }[];
  readonly engineeringEvidence: AssumptionResultsEngineeringEvidence;
};

export interface F7Client {
  importWorkbook(request: { readonly file: File }): Promise<F7SessionSnapshot>;
  downloadMeasurementTemplate(request: { readonly sessionId: string }): Promise<F7MeasurementTemplateDownload>;
  previewMeasurementImport(request: {
    readonly sessionId: string;
    readonly file: File;
  }): Promise<F7MeasurementImportPreviewResponse>;
  commitMeasurementImport(request: F7MeasurementImportCommitRouteRequest["body"]): Promise<F7SessionSnapshot>;
  confirmWorksheet(request: WorksheetConfirmRequest): Promise<F7SessionSnapshot>;
  confirmFactors(request: ConfirmFactorsRequest): Promise<F7SessionSnapshot>;
  setFactorMode(request: SetFactorModeRequest): Promise<F7SessionSnapshot>;
  pasteMeasurements(request: PasteMeasurementsRequest): Promise<F7SessionSnapshot>;
  applyMeasurementDisposition(request: ApplyMeasurementDispositionRequest): Promise<F7SessionSnapshot>;
  fitDistribution(request: FitDistributionRequest): Promise<F7SessionSnapshot>;
  approveDistribution(request: ApproveDistributionRequest): Promise<F7SessionSnapshot>;
  runMonteCarlo(request: RunMonteCarloRequest): Promise<F7SessionSnapshot>;
  generateReport(request: { readonly sessionId: string }): Promise<F7ReportProjection>;
  generateReportPdf(request: {
    readonly sessionId: string;
    readonly report: DeepReadonly<F7ReportProjection>;
    readonly dimensionChainVisual: DimensionChainVisual;
    readonly includeFactorDistributionAppendix: boolean;
  }): Promise<Blob>;
  generateAssumptionResultsPdf(request: AssumptionResultsPdfRequest): Promise<Blob>;
  getSession(sessionId: F7SessionRouteParams["sessionId"]): Promise<F7SessionSnapshot>;
}

function toGenericError(): F7UiError {
  return {
    code: "request_failed",
    summary: "Unable to complete the F7 workbench request.",
    suggestedAction: "Retry the action. If the issue persists, restart the local API.",
    affectedInputReferences: ["f7-web-client"],
  };
}

function mapErrorEnvelope(value: unknown): F7UiError {
  if (!value || typeof value !== "object") return toGenericError();
  const recordValue = value as Record<string, unknown>;
  const code = typeof recordValue.code === "string" ? recordValue.code : undefined;
  const summary = typeof recordValue.summary === "string" ? recordValue.summary : undefined;
  const suggestedAction = typeof recordValue.suggestedAction === "string" ? recordValue.suggestedAction : undefined;
  const refs = Array.isArray(recordValue.affectedInputReferences)
    ? recordValue.affectedInputReferences.filter((entry): entry is string => typeof entry === "string")
    : undefined;
  if (!code || !summary || !suggestedAction || !refs) return toGenericError();
  return {
    code,
    summary,
    suggestedAction,
    affectedInputReferences: refs,
  };
}

function controlledFileReadError(): F7UiError {
  return {
    code: "request_failed",
    summary: "Unable to complete the F7 workbench request.",
    suggestedAction: "Retry the action. If the issue persists, restart the local API.",
    affectedInputReferences: ["f7-web-client"],
  };
}

async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(controlledFileReadError());
    reader.onabort = () => reject(controlledFileReadError());
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(controlledFileReadError());
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });

  const match = /^data:[^;]+;base64,(.+)$/u.exec(dataUrl);
  const workbookBase64 = match?.[1]?.trim();
  if (!workbookBase64) {
    throw controlledFileReadError();
  }
  return workbookBase64;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function extractSafeAttachmentFileName(contentDisposition: string | null): string | undefined {
  if (!/^attachment\s*;/iu.test(contentDisposition ?? "")) return undefined;
  const match = /(?:^|;)\s*filename="([^"]+)"\s*(?:;|$)/iu.exec(contentDisposition ?? "");
  const fileName = match?.[1];
  if (
    !fileName
    || fileName.length > 255
    || !/\.xlsx$/iu.test(fileName)
    || /[<>:"/\\|?*]/u.test(fileName)
    || [...fileName].some((character) => {
      const codePoint = character.codePointAt(0)!;
      return codePoint < 32 || codePoint === 127;
    })
    || fileName.includes("..")
    || fileName.trim() !== fileName
  ) {
    return undefined;
  }
  return fileName;
}

export function createF7Client(baseUrl = ""): F7Client {
  const parseSnapshot = (value: unknown): F7SessionSnapshot | undefined => {
    const parsed = f7SessionSnapshotSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  };

  const requestValidatedJson = async <T>(
    path: string,
    init: RequestInit,
    parsePayload: (value: unknown) => T | undefined,
  ): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw toGenericError();
    }
    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      throw mapErrorEnvelope(payload);
    }
    const result = parsePayload(payload);
    if (!result) {
      throw toGenericError();
    }
    return result;
  };

  const requestJson = async (path: string, init: RequestInit): Promise<F7SessionSnapshot> =>
    await requestValidatedJson(path, init, parseSnapshot);

  return {
    async importWorkbook({ file }) {
      if (file.size > 16 * 1024 * 1024) {
        throw {
          code: "validation_error",
          summary: "Workbook exceeds the 16 MiB local import limit.",
          suggestedAction: "Reduce workbook size and retry import.",
          affectedInputReferences: [file.name],
        } satisfies F7UiError;
      }
      const workbookBase64 = await fileToBase64(file);
      const payload = {
        fileName: file.name,
        workbookBase64,
      } satisfies F7WorkbookImportRouteRequest;

      return await requestJson("/f7/workbook/import", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async downloadMeasurementTemplate(request) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/f7/measurements/import-template`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: request.sessionId }),
        });
      } catch {
        throw toGenericError();
      }
      if (!response.ok) {
        throw mapErrorEnvelope(await parseJsonResponse(response));
      }
      const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      const fileName = extractSafeAttachmentFileName(response.headers.get("content-disposition"));
      if (mediaType !== XLSX_CONTENT_TYPE || !fileName) {
        throw toGenericError();
      }
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch {
        throw toGenericError();
      }
      if (bytes.byteLength === 0) {
        throw toGenericError();
      }
      return { fileName, bytes };
    },

    async previewMeasurementImport({ sessionId, file }) {
      if (file.size > 16 * 1024 * 1024) {
        throw {
          code: "validation_error",
          summary: "Workbook exceeds the 16 MiB local import limit.",
          suggestedAction: "Reduce workbook size and retry import.",
          affectedInputReferences: [file.name],
        } satisfies F7UiError;
      }
      const payload = {
        sessionId,
        fileName: file.name,
        workbookBase64: await fileToBase64(file),
      } satisfies F7MeasurementImportPreviewRouteRequest["body"];
      return await requestValidatedJson("/f7/measurements/import-preview", {
        method: "POST",
        body: JSON.stringify(payload),
      }, (value) => {
        const parsed = f7MeasurementImportPreviewResponseSchema.safeParse(value);
        return parsed.success ? parsed.data : undefined;
      });
    },

    async commitMeasurementImport(request) {
      return await requestValidatedJson("/f7/measurements/import-commit", {
        method: "POST",
        body: JSON.stringify(request satisfies F7MeasurementImportCommitRouteRequest["body"]),
      }, (value) => {
        const parsed = f7AnalysisResultSchema.safeParse(value);
        return parsed.success && parsed.data.snapshot.sessionId === request.sessionId
          ? parsed.data.snapshot
          : undefined;
      });
    },

    async confirmWorksheet(request) {
      const payload = {
        sessionId: request.sessionId,
        confirmation: {
          workbookContentHash: request.workbookContentHash,
          selectedWorksheetNames: [request.selectedWorksheetName],
          confirmed: request.confirmed,
        },
      } satisfies F7WorksheetConfirmRouteRequest;

      return await requestJson("/f7/workbook/worksheet-confirm", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async confirmFactors(request) {
      const payload = {
        sessionId: request.sessionId,
        confirmations: request.confirmations,
        systemSpecification: request.systemSpecification,
      } satisfies F7FactorConfirmRouteRequest;

      return await requestJson("/f7/factors/confirm", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async setFactorMode(request) {
      const payload = {
        sessionId: request.sessionId,
        mode: request.mode,
      } satisfies F7FactorModeRouteRequest["body"];

      return await requestJson(`/f7/factors/${encodeURIComponent(request.factorId)}/mode`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async pasteMeasurements(request) {
      const payload = {
        sessionId: request.sessionId,
        structure: request.structure,
        ...(request.rationalSubgroupConfig
          ? { rationalSubgroupConfig: request.rationalSubgroupConfig }
          : {}),
        sourceReference: request.sourceReference,
        msaStatus: request.msaStatus,
        text: request.text,
      } satisfies F7MeasurementPasteRouteRequest["body"];

      return await requestJson(`/f7/factors/${encodeURIComponent(request.factorId)}/measurements/paste`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async applyMeasurementDisposition(request) {
      const payload = {
        sessionId: request.sessionId,
        rowNumbers: [...request.rowNumbers],
        action: request.action,
        reason: request.reason,
        operatorReference: request.operatorReference,
        confirmed: request.confirmed,
      } satisfies F7MeasurementDispositionRouteRequest["body"];

      return await requestJson(`/f7/factors/${encodeURIComponent(request.factorId)}/measurements/disposition`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async fitDistribution(request) {
      const payload = {
        sessionId: request.sessionId,
      } satisfies F7DistributionFitRouteRequest["body"];

      return await requestJson(`/f7/factors/${encodeURIComponent(request.factorId)}/distribution-fit`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async approveDistribution(request) {
      const payload = {
        sessionId: request.sessionId,
        family: request.family,
        confirmed: request.confirmed,
      } satisfies F7DistributionApprovalRouteRequest["body"];
      return await requestJson(`/f7/factors/${encodeURIComponent(request.factorId)}/distribution-approval`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async runMonteCarlo(request) {
      return await requestJson("/f7/monte-carlo", {
        method: "POST",
        body: JSON.stringify(request satisfies F7MonteCarloRunRouteRequest["body"]),
      });
    },

    async generateReport(request) {
      return await requestValidatedJson("/f7/report", {
        method: "POST",
        body: JSON.stringify({ sessionId: request.sessionId }),
      }, (value) => {
        const parsed = f7ReportProjectionSchema.safeParse(value);
        return parsed.success && parsed.data.sessionId === request.sessionId ? parsed.data : undefined;
      });
    },

    async generateReportPdf(request) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/f7/report/pdf`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
      } catch {
        throw toGenericError();
      }

      if (!response.ok) throw mapErrorEnvelope(await parseJsonResponse(response));
      const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (mediaType !== "application/pdf") throw toGenericError();
      try {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0) throw toGenericError();
        const signature = bytes.subarray(0, 5);
        if (String.fromCharCode(...signature) !== "%PDF-") throw toGenericError();
        return new Blob([bytes], { type: "application/pdf" });
      } catch {
        throw toGenericError();
      }
    },

    async generateAssumptionResultsPdf(request) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/f7/assumption-results/pdf`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
      } catch {
        throw toGenericError();
      }

      if (!response.ok) {
        throw mapErrorEnvelope(await parseJsonResponse(response));
      }
      const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (mediaType !== "application/pdf") {
        throw toGenericError();
      }

      try {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0) throw toGenericError();
        const signature = bytes.subarray(0, 5);
        if (String.fromCharCode(...signature) !== "%PDF-") throw toGenericError();
        return new Blob([bytes], { type: "application/pdf" });
      } catch {
        throw toGenericError();
      }
    },

    async getSession(sessionId) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/f7/session/${encodeURIComponent(sessionId)}`);
      } catch {
        throw toGenericError();
      }
      const payload = await parseJsonResponse(response);
      if (!response.ok) throw mapErrorEnvelope(payload);
      const snapshot = parseSnapshot(payload);
      if (!snapshot || snapshot.sessionId !== sessionId) throw toGenericError();
      return snapshot;
    },
  };
}