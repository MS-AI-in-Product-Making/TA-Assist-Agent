import { computed, readonly, ref, shallowRef } from "vue";
import type {
  F7Client,
  F7ExclusionReason,
  F7MeasurementStructure,
  F7RationalSubgroupConfig,
  F7MsaStatus,
  F7ReportProjection,
  F7SessionSnapshot,
  F7SetupDistribution,
  F7SourceMode,
  F7SystemSpecificationInput,
  F7UiError,
} from "../api/f7-client";

type BusyAction =
  | "importWorkbook"
  | "confirmWorksheet"
  | "confirmFactors"
  | "setFactorMode"
  | "pasteMeasurements"
  | "applyMeasurementDisposition"
  | "fitDistribution"
  | "approveDistribution"
  | "runMonteCarlo"
  | "generateReport"
  | "refreshSession";

function toUiError(error: unknown): F7UiError {
  if (!error || typeof error !== "object") {
    return {
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action.",
      affectedInputReferences: ["f7-web-session"],
    };
  }
  const recordValue = error as Record<string, unknown>;
  if (
    typeof recordValue.code === "string"
    && typeof recordValue.summary === "string"
    && typeof recordValue.suggestedAction === "string"
    && Array.isArray(recordValue.affectedInputReferences)
  ) {
    return {
      code: recordValue.code,
      summary: recordValue.summary,
      suggestedAction: recordValue.suggestedAction,
      affectedInputReferences: recordValue.affectedInputReferences.filter(
        (entry): entry is string => typeof entry === "string",
      ),
    };
  }
  return {
    code: "request_failed",
    summary: "Unable to complete the F7 workbench request.",
    suggestedAction: "Retry the action.",
    affectedInputReferences: ["f7-web-session"],
  };
}

function prerequisiteNotReadyError(summary = "Import a workbook before continuing."): F7UiError {
  return {
    code: "prerequisite_not_ready",
    summary,
    suggestedAction: "Import and confirm a workbook.",
    affectedInputReferences: ["f7-session"],
  };
}

export function createF7SessionStore(client: F7Client) {
  const session = ref<F7SessionSnapshot | null>(null);
  const report = shallowRef<F7ReportProjection | null>(null);
  const busyAction = ref<BusyAction | null>(null);
  const error = ref<F7UiError | null>(null);

  const isBusy = computed(() => busyAction.value !== null);

  const commitMutationSnapshot = (snapshot: F7SessionSnapshot): void => {
    session.value = snapshot;
    report.value = null;
  };

  const runAction = async <T>(name: BusyAction, operation: () => Promise<T>): Promise<T> => {
    if (busyAction.value !== null) {
      throw {
        code: "busy",
        summary: "Another F7 action is already running.",
        suggestedAction: "Wait for the current action to complete.",
        affectedInputReferences: ["f7-web-session"],
      } satisfies F7UiError;
    }
    busyAction.value = name;
    error.value = null;
    try {
      return await operation();
    } catch (caught) {
      const uiError = toUiError(caught);
      error.value = uiError;
      throw uiError;
    } finally {
      busyAction.value = null;
    }
  };

  return {
    session: readonly(session),
    report: readonly(report),
    busyAction: readonly(busyAction),
    error: readonly(error),
    isBusy: readonly(isBusy),
    clearError(): void {
      error.value = null;
    },
    async importWorkbook(file: File): Promise<void> {
      await runAction("importWorkbook", async () => {
        commitMutationSnapshot(await client.importWorkbook({ file }));
      });
    },
    async confirmWorksheet(selectedWorksheetName: string): Promise<void> {
      await runAction("confirmWorksheet", async () => {
        const current = session.value;
        if (!current) {
          throw prerequisiteNotReadyError("Import a workbook before continuing.");
        }
        commitMutationSnapshot(await client.confirmWorksheet({
          sessionId: current.sessionId,
          workbookContentHash: current.workbook.workbookContentHash,
          selectedWorksheetName,
          confirmed: true,
        }));
      });
    },
    async confirmFactors(confirmations: ReadonlyArray<{
      readonly factorCandidateId: string;
      readonly designNominal: number;
      readonly upperTolerance: number;
      readonly lowerTolerance: number;
      readonly longTermSafetyFactor: number;
      readonly sigmaLevel: number;
      readonly distribution: F7SetupDistribution;
      readonly factorName?: string;
      readonly userAdded?: true;
    }>, systemSpecification: F7SystemSpecificationInput): Promise<void> {
      await runAction("confirmFactors", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        commitMutationSnapshot(await client.confirmFactors({
          sessionId: current.sessionId,
          confirmations: confirmations.map((confirmation) => ({ ...confirmation, confirmed: true as const })),
          systemSpecification,
        }));
      });
    },
    async setFactorMode(factorId: string, mode: F7SourceMode): Promise<void> {
      await runAction("setFactorMode", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        commitMutationSnapshot(await client.setFactorMode({
          sessionId: current.sessionId,
          factorId,
          mode,
        }));
      });
    },
    async pasteMeasurements(request: {
      readonly factorId: string;
      readonly structure: F7MeasurementStructure;
      readonly rationalSubgroupConfig?: F7RationalSubgroupConfig;
      readonly sourceReference: string;
      readonly msaStatus: F7MsaStatus;
      readonly text: string;
    }): Promise<void> {
      await runAction("pasteMeasurements", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        commitMutationSnapshot(await client.pasteMeasurements({
          sessionId: current.sessionId,
          factorId: request.factorId,
          structure: request.structure,
          ...(request.rationalSubgroupConfig
            ? { rationalSubgroupConfig: request.rationalSubgroupConfig }
            : {}),
          sourceReference: request.sourceReference,
          msaStatus: request.msaStatus,
          text: request.text,
        }));
      });
    },
    async applyMeasurementDisposition(request: {
      readonly factorId: string;
      readonly rowNumbers: readonly number[];
      readonly action: "EXCLUDE" | "RESTORE";
      readonly reason: F7ExclusionReason;
      readonly operatorReference: string;
    }): Promise<void> {
      await runAction("applyMeasurementDisposition", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        commitMutationSnapshot(await client.applyMeasurementDisposition({
          sessionId: current.sessionId,
          factorId: request.factorId,
          rowNumbers: request.rowNumbers,
          action: request.action,
          reason: request.reason,
          operatorReference: request.operatorReference,
          confirmed: true,
        }));
      });
    },
    async fitDistribution(factorId: string): Promise<void> {
      await runAction("fitDistribution", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        commitMutationSnapshot(await client.fitDistribution({
          sessionId: current.sessionId,
          factorId,
        }));
      });
    },
    async approveDistribution(factorId: string, family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform"): Promise<void> {
      await runAction("approveDistribution", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        commitMutationSnapshot(await client.approveDistribution({
          sessionId: current.sessionId,
          factorId,
          family,
          confirmed: true,
        }));
      });
    },
    async runMonteCarlo(request: {
      readonly lowerSpecLimit: number;
      readonly upperSpecLimit: number;
      readonly targetSigmaLevel: number;
      readonly iterations: 10_000 | 100_000;
      readonly runSeed: string;
      readonly correlationMode: "INDEPENDENT";
    }): Promise<void> {
      await runAction("runMonteCarlo", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        commitMutationSnapshot(await client.runMonteCarlo({ sessionId: current.sessionId, ...request }));
      });
    },
    async generateReport(): Promise<void> {
      await runAction("generateReport", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        report.value = await client.generateReport({ sessionId: current.sessionId });
      });
    },
    async refreshSession(): Promise<void> {
      await runAction("refreshSession", async () => {
        const current = session.value;
        if (!current) throw prerequisiteNotReadyError();
        commitMutationSnapshot(await client.getSession(current.sessionId));
      });
    },
  };
}

export type F7SessionStore = ReturnType<typeof createF7SessionStore>;