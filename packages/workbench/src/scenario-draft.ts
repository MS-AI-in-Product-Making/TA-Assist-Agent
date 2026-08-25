import {
  f6OptimizationTargetsSchema,
  f8ScenarioDraftSchema,
  type F6OptimizationTargets,
  type F8ScenarioDraft,
} from "@ai-assist/contracts";

export interface ScenarioBaseline {
  readonly workbookContentHash: string;
  readonly baselineRunReference: string;
  readonly calculationVersion: "excel-ta-v1";
  readonly projectReference: string;
  readonly worksheetName: string;
  readonly tableId: string;
  readonly factor: {
    readonly worksheetName: string;
    readonly tableId: string;
    readonly sourceRow: number;
    readonly factorName: string;
    readonly unit: string;
    readonly nominalValue: number;
    readonly upperTolerance: number;
    readonly lowerTolerance: number;
    readonly additionalMeanShift: number;
  };
}

export type ScenarioPatch = NonNullable<F8ScenarioDraft["change"]>;

function immutableDraft(draft: unknown): F8ScenarioDraft {
  return Object.freeze(f8ScenarioDraftSchema.parse(structuredClone(draft)));
}

function sameDraftIdentity(left: F8ScenarioDraft, right: F8ScenarioDraft): boolean {
  return left.draftId === right.draftId
    && left.sessionId === right.sessionId
    && left.worksheetName === right.worksheetName
    && left.inputRevision === right.inputRevision;
}

export function applyScenarioPatch(draft: F8ScenarioDraft, patch: ScenarioPatch): F8ScenarioDraft {
  const current = f8ScenarioDraftSchema.parse(draft);
  const base = { ...current };
  delete base.calculationReference;
  return immutableDraft({
    ...base,
    status: "draft",
    change: { ...current.change, ...patch },
  });
}

export function undoScenarioPatch(current: F8ScenarioDraft, previous: F8ScenarioDraft): F8ScenarioDraft {
  const parsedCurrent = f8ScenarioDraftSchema.parse(current);
  const parsedPrevious = f8ScenarioDraftSchema.parse(previous);
  if (!sameDraftIdentity(parsedCurrent, parsedPrevious)) {
    throw new Error("Scenario draft undo identity does not match.");
  }
  return immutableDraft(parsedPrevious);
}

export function resetDraft(draft: F8ScenarioDraft, baseline: ScenarioBaseline): F8ScenarioDraft {
  const current = f8ScenarioDraftSchema.parse(draft);
  if (current.worksheetName !== baseline.worksheetName
    || current.baselineWorkbookHash !== baseline.workbookContentHash
    || current.baselineRunReference !== baseline.baselineRunReference) {
    throw new Error("Scenario draft baseline identity does not match.");
  }
  const base = { ...current };
  delete base.calculationReference;
  return immutableDraft({
    ...base,
    status: "draft",
    change: {
      nominalValue: baseline.factor.nominalValue,
      upperTolerance: baseline.factor.upperTolerance,
      lowerTolerance: baseline.factor.lowerTolerance,
      additionalMeanShift: baseline.factor.additionalMeanShift,
    },
  });
}

export function saveDraft(
  draft: F8ScenarioDraft,
  input: { readonly calculationReference: string; readonly expectedInputRevision: number },
): F8ScenarioDraft {
  const current = f8ScenarioDraftSchema.parse(draft);
  if (current.inputRevision !== input.expectedInputRevision) {
    throw new Error("Scenario draft input revision is stale.");
  }
  return immutableDraft({ ...current, status: "saved", calculationReference: input.calculationReference });
}

export function createToleranceTargetsPreview(
  draft: F8ScenarioDraft,
  baseline: ScenarioBaseline,
): F6OptimizationTargets {
  const current = f8ScenarioDraftSchema.parse(draft);
  if (current.worksheetName !== baseline.worksheetName
    || current.baselineWorkbookHash !== baseline.workbookContentHash
    || current.baselineRunReference !== baseline.baselineRunReference) {
    throw new Error("Scenario draft baseline identity does not match.");
  }
  if (current.change?.nominalValue !== undefined) {
    throw new Error("Nominal changes cannot be promoted to F6 optimization targets.");
  }
  if (current.change?.additionalMeanShift !== undefined) {
    throw new Error("Mean shift cannot be promoted to F6 optimization targets.");
  }
  const upperTolerance = current.change?.upperTolerance ?? baseline.factor.upperTolerance;
  const lowerTolerance = current.change?.lowerTolerance ?? baseline.factor.lowerTolerance;
  if (upperTolerance === baseline.factor.upperTolerance && lowerTolerance === baseline.factor.lowerTolerance) {
    throw new Error("Promoted tolerances must differ from the governed baseline.");
  }
  if (upperTolerance < lowerTolerance) {
    throw new Error("Upper tolerance must be greater than or equal to lower tolerance.");
  }
  return f6OptimizationTargetsSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    targetVersion: "f6-optimization-targets-v1",
    workbookContentHash: baseline.workbookContentHash,
    worksheets: [{
      worksheetName: baseline.worksheetName,
      tableId: baseline.tableId,
      baselineIdentity: {
        calculationVersion: baseline.calculationVersion,
        projectReference: baseline.projectReference,
        runReference: baseline.baselineRunReference,
        workbookContentHash: baseline.workbookContentHash,
        worksheetName: baseline.worksheetName,
        tableId: baseline.tableId,
      },
      targets: [{
        targetId: `${baseline.factor.worksheetName}:${baseline.factor.tableId}:${baseline.factor.sourceRow}:tolerance`,
        targetType: "factor_tolerance",
        factor: {
          worksheetName: baseline.factor.worksheetName,
          tableId: baseline.factor.tableId,
          sourceRow: baseline.factor.sourceRow,
          factorName: baseline.factor.factorName,
          unit: baseline.factor.unit,
        },
        upperTolerance,
        lowerTolerance,
        unit: baseline.factor.unit,
      }],
    }],
  });
}
