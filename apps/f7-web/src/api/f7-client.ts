import type {
  F7DatasetValidationIssue as ContractF7DatasetValidationIssue,
  F7ExclusionReason as ContractF7ExclusionReason,
  F7FactorCandidate as ContractF7FactorCandidate,
  F7FactorConfirmRouteRequest,
  F7FactorEvidence as ContractF7FactorEvidence,
  F7FactorInput as ContractF7FactorInput,
  F7FactorModeRouteRequest,
  F7FactorSetupConfirmation,
  F7FactorSourceMode,
  F7LoopCoefficient as ContractF7LoopCoefficient,
  F7MeasurementDataset as ContractF7MeasurementDataset,
  F7MeasurementDispositionRouteRequest,
  F7MeasurementPasteResult as ContractF7MeasurementPasteResult,
  F7MeasurementPasteRouteRequest,
  F7MeasurementStructure as ContractF7MeasurementStructure,
  F7MsaStatus as ContractF7MsaStatus,
  F7SessionRouteParams,
  F7SessionSnapshot as ContractF7SessionSnapshot,
  F7WorksheetConfirmRouteRequest,
  F7WorkbookImportRouteRequest,
} from "@ai-assist/contracts";

export type F7SessionStatus = ContractF7SessionSnapshot["status"];
export type F7SourceMode = F7FactorSourceMode;
export type F7LoopCoefficient = ContractF7LoopCoefficient;
export type F7MeasurementStructure = ContractF7MeasurementStructure;
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
  "factorCandidateId" | "factorName" | "excelSignedMean" | "sourceCells" | "workbookUnitEvidence"
>;

export type F7FactorEvidence = Pick<
  ContractF7FactorEvidence,
  "factorCandidateId" | "factorId" | "factorName" | "unit" | "loopCoefficient" | "physicalMean" | "signedContributionMean" | "sourceCells"
>;

export type F7DatasetValidationIssue = Omit<
  Pick<ContractF7DatasetValidationIssue, "reason" | "factorId" | "rowNumbers">,
  "rowNumbers"
> & {
  readonly rowNumbers?: readonly number[];
};

export interface F7DatasetValidationResult {
  readonly status: "ready" | "blocked";
  readonly blockingIssues: readonly F7DatasetValidationIssue[];
  readonly advisoryIssues: readonly F7DatasetValidationIssue[];
}

type F7MeasurementObservation = Pick<
  ContractF7MeasurementDataset["observations"][number],
  "originalRow" | "value" | "disposition"
> & {
  readonly reason?: F7ExclusionReason;
};

export interface F7SessionSnapshot extends Omit<ContractF7SessionSnapshot, "selectedWorksheetNames" | "worksheetOptions" | "factors"> {
  readonly selectedWorksheetNames: readonly string[];
  readonly worksheetOptions: readonly F7WorksheetOption[];
  readonly factors: readonly F7FactorState[];
}

export type F7MeasurementDataset = Pick<
  ContractF7MeasurementDataset,
  "factorId" | "unit" | "structure" | "sourceReference" | "msaStatus" | "originalRowCount" | "analyzedCount"
> & {
  readonly observations: readonly F7MeasurementObservation[];
};

type F7BaselineSampler = Extract<ContractF7FactorInput, { mode: "BASELINE_ASSUMPTION" }>["baselineSampler"];

export type F7FactorInput =
  | { readonly mode: "MEASURED"; readonly dataset?: F7MeasurementDataset }
  | { readonly mode: "BASELINE_ASSUMPTION"; readonly baselineSampler: F7BaselineSampler };

export type F7MeasurementPasteResult = Pick<ContractF7MeasurementPasteResult, "status" | "factorId"> & {
  readonly dataset?: F7MeasurementDataset;
  readonly validation: F7DatasetValidationResult;
};

export interface F7FactorState {
  readonly factorCandidate: F7FactorCandidate;
  readonly setup?: F7FactorSetupConfirmation;
  readonly evidence?: F7FactorEvidence;
  readonly sourceMode?: F7SourceMode;
  readonly input?: F7FactorInput;
  readonly datasetValidation?: {
    readonly status: "ready" | "blocked";
    readonly blockingIssues: readonly F7DatasetValidationIssue[];
    readonly advisoryIssues: readonly F7DatasetValidationIssue[];
  };
  readonly measurementPasteResult?: F7MeasurementPasteResult;
}

type WorksheetConfirmRequest = {
  readonly sessionId: string;
  readonly workbookContentHash: F7WorksheetConfirmRouteRequest["confirmation"]["workbookContentHash"];
  readonly selectedWorksheetName: F7SessionSnapshot["worksheetOptions"][number]["worksheetName"];
  readonly confirmed: true;
};

type ConfirmFactorsRequest = {
  readonly sessionId: string;
  readonly confirmations: F7FactorConfirmRouteRequest["confirmations"];
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

export interface F7Client {
  importWorkbook(request: { readonly file: File }): Promise<F7SessionSnapshot>;
  confirmWorksheet(request: WorksheetConfirmRequest): Promise<F7SessionSnapshot>;
  confirmFactors(request: ConfirmFactorsRequest): Promise<F7SessionSnapshot>;
  setFactorMode(request: SetFactorModeRequest): Promise<F7SessionSnapshot>;
  pasteMeasurements(request: PasteMeasurementsRequest): Promise<F7SessionSnapshot>;
  applyMeasurementDisposition(request: ApplyMeasurementDispositionRequest): Promise<F7SessionSnapshot>;
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

export function createF7Client(baseUrl = ""): F7Client {
  const isSnapshotShape = (value: unknown): value is F7SessionSnapshot => {
    if (!value || typeof value !== "object") return false;
    const recordValue = value as Record<string, unknown>;
    return (
      typeof recordValue.sessionId === "string"
      && typeof recordValue.status === "string"
      && Array.isArray(recordValue.worksheetOptions)
      && Array.isArray(recordValue.factors)
    );
  };

  const requestJson = async (path: string, init: RequestInit): Promise<F7SessionSnapshot> => {
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
    if (!isSnapshotShape(payload)) {
      throw toGenericError();
    }
    return payload;
  };

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

    async getSession(sessionId) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/f7/session/${encodeURIComponent(sessionId)}`);
      } catch {
        throw toGenericError();
      }
      const payload = await parseJsonResponse(response);
      if (!response.ok) throw mapErrorEnvelope(payload);
      if (!isSnapshotShape(payload)) throw toGenericError();
      return payload;
    },
  };
}