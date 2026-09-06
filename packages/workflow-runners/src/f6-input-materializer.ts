import {
  f6AnalysisContextProposalSchema,
  f6AnalysisContextV2Schema,
  f6OptimizationTargetsProposalSchema,
  f6OptimizationTargetsV2Schema,
  type F6AnalysisContextProposal,
  type F6OptimizationTargetsProposal,
} from "@ai-assist/contracts";

import type {
  F6AnalysisContextMaterializationResult,
  F6InputMaterializationClarification,
  F6InputMaterializationClarificationResult,
  F6InputMaterializationLineage,
  F6InputMaterializationResult,
  F6InputProposalForMaterialization,
  F6OptimizationTargetsMaterializationResult,
  ResolvedFactor,
  ResolvedWorksheet,
} from "./types.js";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function createClarification(
  reasonCode: "proposal_ambiguous" | "draft_identity_mismatch",
  question: string,
  requiredFields: readonly string[],
): F6InputMaterializationClarification {
  return {
    clarificationId: reasonCode,
    reasonCode,
    question,
    requiredFields: [...requiredFields],
  };
}

function staleContextClarification(lineage: F6InputMaterializationLineage): F6InputMaterializationClarification | undefined {
  if (lineage.reviewContextId === lineage.expectedReviewContextId) return undefined;
  return createClarification(
    "draft_identity_mismatch",
    "Current validated review context changed. Please regenerate the draft from the latest review context.",
    ["reviewContextId"],
  );
}

function baselineIdentity(lineage: F6InputMaterializationLineage, worksheet: { worksheetName: string; tableId: string }) {
  return {
    calculationVersion: lineage.calculationVersion,
    projectReference: lineage.projectReference,
    runReference: lineage.runReference,
    workbookContentHash: lineage.workbookContentHash,
    worksheetName: worksheet.worksheetName,
    tableId: worksheet.tableId,
  } as const;
}

function clarificationResult(
  clarifications: readonly F6InputMaterializationClarification[],
): F6InputMaterializationClarificationResult {
  return {
    status: "clarification_required",
    clarifications,
  };
}

function ensureUniqueSelectors(selectors: readonly string[]): F6InputMaterializationClarification | undefined {
  const keys = selectors.map(normalize);
  if (new Set(keys).size === keys.length) return undefined;
  return createClarification(
    "proposal_ambiguous",
    "Worksheet selectors must be unique and map to exactly one worksheet.",
    ["worksheetSelectors"],
  );
}


export function resolveWorksheet(
  selector: string,
  lineage: F6InputMaterializationLineage,
): ResolvedWorksheet | F6InputMaterializationClarification {
  const key = normalize(selector);
  const matches = lineage.worksheets.filter((worksheet) => normalize(worksheet.worksheetName) === key);
  if (matches.length !== 1) {
    return createClarification(
      "proposal_ambiguous",
      `Worksheet selector \"${selector}\" does not bind to exactly one validated worksheet.`,
      ["worksheetSelector"],
    );
  }
  const worksheet = matches[0]!;
  return {
    worksheetName: worksheet.worksheetName,
    tableId: worksheet.tableId,
    baselineIdentity: baselineIdentity(lineage, worksheet),
    factors: worksheet.factors,
    system: worksheet.system,
  };
}

export function resolveFactor(
  worksheet: ResolvedWorksheet,
  selector: string,
  unit: string | undefined,
): ResolvedFactor | F6InputMaterializationClarification {
  const key = normalize(selector);
  const byName = worksheet.factors.filter((factor) => normalize(factor.factorName) === key);
  if (byName.length === 0) {
    return createClarification(
      "proposal_ambiguous",
      `Factor selector \"${selector}\" does not match any validated factor in worksheet ${worksheet.worksheetName}.`,
      ["factorSelector"],
    );
  }
  const byNameAndUnit = unit === undefined
    ? byName
    : byName.filter((factor) => factor.unit === unit);
  if (byNameAndUnit.length !== 1) {
    return createClarification(
      "proposal_ambiguous",
      `Factor selector "${selector}" is ambiguous in worksheet ${worksheet.worksheetName}; provide an exact unit and unique factor name.`,
      ["factorSelector", "numericTarget.unit"],
    );
  }
  const factor = byNameAndUnit[0]!;
  return {
    worksheetName: worksheet.worksheetName,
    tableId: worksheet.tableId,
    sourceRow: factor.sourceRow,
    factorName: factor.factorName,
    unit: factor.unit,
    lowerTolerance: factor.lowerTolerance,
    upperTolerance: factor.upperTolerance,
  };
}

export function materializeF6AnalysisContext(
  proposal: F6AnalysisContextProposal,
  lineage: F6InputMaterializationLineage,
): F6AnalysisContextMaterializationResult {
  const proposalParsed = f6AnalysisContextProposalSchema.safeParse(proposal);
  if (!proposalParsed.success) {
    return clarificationResult([createClarification(
      "proposal_ambiguous",
      "Analysis context proposal shape is invalid; regenerate proposal without identity or authority fields.",
      ["proposal"],
    )]);
  }
  const parsedProposal = proposalParsed.data;

  const stale = staleContextClarification(lineage);
  if (stale !== undefined) return clarificationResult([stale]);

  const duplicate = ensureUniqueSelectors(parsedProposal.worksheetSelectors);
  if (duplicate !== undefined) return clarificationResult([duplicate]);

  const resolved: Array<{ selector: string; worksheet: ResolvedWorksheet }> = [];
  for (const selector of parsedProposal.worksheetSelectors) {
    const worksheet = resolveWorksheet(selector, lineage);
    if ("reasonCode" in worksheet) return clarificationResult([worksheet]);
    resolved.push({ selector, worksheet });
  }

  const artifactCandidate = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    contextVersion: "f6-analysis-context-v2" as const,
    workbookContentHash: lineage.workbookContentHash,
    worksheets: resolved.map(({ worksheet }) => ({
      worksheetName: worksheet.worksheetName,
      tableId: worksheet.tableId,
      baselineIdentity: worksheet.baselineIdentity,
      engineeringNarrative: parsedProposal.userText,
      operatingConditions: [],
      correlationRequirement: { mode: "NOT_PROVIDED" as const },
    })),
  };

  const parsed = f6AnalysisContextV2Schema.safeParse(artifactCandidate);
  if (!parsed.success) {
    return clarificationResult([createClarification(
      "proposal_ambiguous",
      "Analysis context proposal cannot be materialized safely; please clarify worksheet scope and required fields.",
      ["worksheetSelectors", "userText"],
    )]);
  }

  return {
    status: "draft_ready",
    artifact: parsed.data,
    preview: {
      reviewContextId: lineage.reviewContextId,
      worksheetBindings: resolved.map(({ selector, worksheet }) => ({
        selector,
        worksheetName: worksheet.worksheetName,
        tableId: worksheet.tableId,
      })),
      artifact: parsed.data,
    },
  };
}

interface ToleranceAccumulator {
  readonly worksheet: ResolvedWorksheet;
  readonly factor: ResolvedFactor;
  readonly unit: string;
  lowerTolerance?: number;
  upperTolerance?: number;
}

interface SpecificationAccumulator {
  readonly worksheet: ResolvedWorksheet;
  readonly unit: string;
  lowerSpecLimit?: number;
  upperSpecLimit?: number;
}

function pushClarification(
  clarifications: F6InputMaterializationClarification[],
  reasonCode: "proposal_ambiguous" | "draft_identity_mismatch",
  question: string,
  requiredFields: readonly string[],
): void {
  clarifications.push(createClarification(reasonCode, question, requiredFields));
}

export function materializeF6OptimizationTargets(
  proposal: F6OptimizationTargetsProposal,
  lineage: F6InputMaterializationLineage,
): F6OptimizationTargetsMaterializationResult {
  const proposalParsed = f6OptimizationTargetsProposalSchema.safeParse(proposal);
  if (!proposalParsed.success) {
    return clarificationResult([createClarification(
      "proposal_ambiguous",
      "Optimization targets proposal shape is invalid; regenerate proposal without identity or authority fields.",
      ["proposal"],
    )]);
  }
  const parsedProposal = proposalParsed.data;

  const stale = staleContextClarification(lineage);
  if (stale !== undefined) return clarificationResult([stale]);

  const clarifications: F6InputMaterializationClarification[] = [];
  const qualitativeDirections: Array<{
    adjustmentClass: F6OptimizationTargetsProposal["directions"][number]["adjustmentClass"];
    worksheetName: string;
    factor?: {
      worksheetName: string;
      tableId: string;
      sourceRow: number;
      factorName: string;
      unit: string;
    };
  }> = [];
  const worksheetTargets = new Map<string, {
    worksheet: ResolvedWorksheet;
    targets: Array<unknown>;
  }>();
  const toleranceAccumulators = new Map<string, ToleranceAccumulator>();
  const specificationAccumulators = new Map<string, SpecificationAccumulator>();
  const emittedTargetKeys = new Set<string>();

  for (const direction of parsedProposal.directions) {
    const worksheet = resolveWorksheet(direction.worksheetSelector, lineage);
    if ("reasonCode" in worksheet) {
      clarifications.push(worksheet);
      continue;
    }

    const worksheetKey = `${worksheet.worksheetName}\u0000${worksheet.tableId}`;
    if (!worksheetTargets.has(worksheetKey)) worksheetTargets.set(worksheetKey, { worksheet, targets: [] });

    const addQualitative = (factor?: ResolvedFactor) => qualitativeDirections.push({
      adjustmentClass: direction.adjustmentClass,
      worksheetName: worksheet.worksheetName,
      ...(factor === undefined ? {} : {
        factor: {
          worksheetName: factor.worksheetName,
          tableId: factor.tableId,
          sourceRow: factor.sourceRow,
          factorName: factor.factorName,
          unit: factor.unit,
        },
      }),
    });

    if (direction.adjustmentClass === "factor_tolerance") {
      if (direction.factorSelector === undefined) {
        pushClarification(clarifications, "proposal_ambiguous", "Factor tolerance direction requires factorSelector.", ["factorSelector"]);
        continue;
      }
      if (direction.numericTarget === undefined) {
        const factor = resolveFactor(worksheet, direction.factorSelector, undefined);
        if ("reasonCode" in factor) {
          clarifications.push(factor);
          continue;
        }
        addQualitative(factor);
        continue;
      }
      if (direction.numericTarget.field !== "upper_tolerance" && direction.numericTarget.field !== "lower_tolerance") {
        pushClarification(clarifications, "proposal_ambiguous", "Factor tolerance numeric target must use upper_tolerance or lower_tolerance.", ["numericTarget.field"]);
        continue;
      }
      const factor = resolveFactor(worksheet, direction.factorSelector, direction.numericTarget.unit);
      if ("reasonCode" in factor) {
        clarifications.push(factor);
        continue;
      }
      const accumulatorKey = `${worksheetKey}\u0000${factor.sourceRow}\u0000factor_tolerance`;
      if (!toleranceAccumulators.has(accumulatorKey)) {
        toleranceAccumulators.set(accumulatorKey, {
          worksheet,
          factor,
          unit: direction.numericTarget.unit,
        });
      }
      const accumulator = toleranceAccumulators.get(accumulatorKey)!;
      if (accumulator.unit !== direction.numericTarget.unit) {
        pushClarification(clarifications, "proposal_ambiguous", "Factor tolerance directions must use one exact unit.", ["numericTarget.unit"]);
        continue;
      }
      if (direction.numericTarget.field === "upper_tolerance") accumulator.upperTolerance = direction.numericTarget.value;
      if (direction.numericTarget.field === "lower_tolerance") accumulator.lowerTolerance = direction.numericTarget.value;
      continue;
    }

    if (direction.adjustmentClass === "factor_nominal") {
      if (direction.factorSelector === undefined) {
        pushClarification(clarifications, "proposal_ambiguous", "Factor nominal direction requires factorSelector.", ["factorSelector"]);
        continue;
      }
      if (direction.numericTarget === undefined) {
        const factor = resolveFactor(worksheet, direction.factorSelector, undefined);
        if ("reasonCode" in factor) {
          clarifications.push(factor);
          continue;
        }
        addQualitative(factor);
        continue;
      }
      if (direction.numericTarget.field !== "factor_nominal") {
        pushClarification(clarifications, "proposal_ambiguous", "Factor nominal direction requires numericTarget.field = factor_nominal.", ["numericTarget.field"]);
        continue;
      }
      const factor = resolveFactor(worksheet, direction.factorSelector, direction.numericTarget.unit);
      if ("reasonCode" in factor) {
        clarifications.push(factor);
        continue;
      }
      const key = `${worksheetKey}\u0000${factor.sourceRow}\u0000factor_nominal`;
      if (emittedTargetKeys.has(key)) {
        pushClarification(clarifications, "proposal_ambiguous", "A factor can only have one factor_nominal target in one materialization.", ["directions"]);
        continue;
      }
      emittedTargetKeys.add(key);
      worksheetTargets.get(worksheetKey)!.targets.push({
        targetId: `${worksheet.worksheetName}:${worksheet.tableId}:${factor.sourceRow}:factor_nominal`,
        targetType: "factor_nominal",
        factor: {
          worksheetName: factor.worksheetName,
          tableId: factor.tableId,
          sourceRow: factor.sourceRow,
          factorName: factor.factorName,
          unit: factor.unit,
        },
        nominalValue: direction.numericTarget.value,
        unit: direction.numericTarget.unit,
      });
      continue;
    }

    if (direction.adjustmentClass === "factor_sigma" || direction.adjustmentClass === "improvement_ratio") {
      if (direction.factorSelector === undefined) {
        pushClarification(
          clarifications,
          "proposal_ambiguous",
          `${direction.adjustmentClass} direction requires factorSelector for exact factor binding.`,
          ["factorSelector"],
        );
        continue;
      }
      if (direction.numericTarget !== undefined) {
        pushClarification(clarifications, "proposal_ambiguous", "Numeric target is not supported for this adjustment class in chat proposal v1.", ["numericTarget"]);
        continue;
      }
      const factor = resolveFactor(worksheet, direction.factorSelector, undefined);
      if ("reasonCode" in factor) {
        clarifications.push(factor);
        continue;
      }
      addQualitative(factor);
      continue;
    }

    if (direction.adjustmentClass === "system_mean_shift") {
      if (direction.numericTarget === undefined) {
        addQualitative();
        continue;
      }
      const field = direction.numericTarget.field;
      if (field !== "target_mean" && field !== "additional_mean_shift") {
        pushClarification(clarifications, "proposal_ambiguous", "System mean shift requires target_mean or additional_mean_shift.", ["numericTarget.field"]);
        continue;
      }
      const key = `${worksheetKey}\u0000system_mean_shift`;
      if (emittedTargetKeys.has(key)) {
        pushClarification(clarifications, "proposal_ambiguous", "Only one system_mean_shift target is allowed per worksheet.", ["directions"]);
        continue;
      }
      emittedTargetKeys.add(key);
      worksheetTargets.get(worksheetKey)!.targets.push({
        targetId: `${worksheet.worksheetName}:${worksheet.tableId}:system_mean_shift`,
        targetType: "system_mean_shift",
        systemIdentity: {
          baselineIdentity: worksheet.baselineIdentity,
          designNominal: worksheet.system.designNominal,
          mean: worksheet.system.mean,
          rssSigma: worksheet.system.rssSigma,
          lowerSpecLimit: worksheet.system.lowerSpecLimit,
          upperSpecLimit: worksheet.system.upperSpecLimit,
          targetCpk: worksheet.system.targetCpk,
          traceReferences: [...worksheet.system.traceReferences],
        },
        target: field === "target_mean"
          ? { targetMean: direction.numericTarget.value, unit: direction.numericTarget.unit }
          : { resultingAdditionalMeanShift: direction.numericTarget.value, unit: direction.numericTarget.unit },
      });
      continue;
    }

    if (direction.adjustmentClass === "system_specification") {
      if (direction.numericTarget === undefined) {
        pushClarification(
          clarifications,
          "proposal_ambiguous",
          "System specification requires an explicit lower_spec_limit or upper_spec_limit target.",
          ["numericTarget.field"],
        );
        continue;
      }
      if (direction.numericTarget.field !== "lower_spec_limit" && direction.numericTarget.field !== "upper_spec_limit") {
        pushClarification(clarifications, "proposal_ambiguous", "System specification numeric target must use lower_spec_limit or upper_spec_limit.", ["numericTarget.field"]);
        continue;
      }
      const key = `${worksheetKey}\u0000system_specification`;
      if (!specificationAccumulators.has(key)) {
        specificationAccumulators.set(key, { worksheet, unit: direction.numericTarget.unit });
      }
      const accumulator = specificationAccumulators.get(key)!;
      if (accumulator.unit !== direction.numericTarget.unit) {
        pushClarification(clarifications, "proposal_ambiguous", "System specification limits must use one exact unit.", ["numericTarget.unit"]);
        continue;
      }
      if (direction.numericTarget.field === "lower_spec_limit") accumulator.lowerSpecLimit = direction.numericTarget.value;
      if (direction.numericTarget.field === "upper_spec_limit") accumulator.upperSpecLimit = direction.numericTarget.value;
      continue;
    }
  }

  for (const [key, accumulator] of toleranceAccumulators) {
    if (emittedTargetKeys.has(key)) {
      pushClarification(clarifications, "proposal_ambiguous", "Only one factor_tolerance target is allowed per factor.", ["directions"]);
      continue;
    }
    const lowerTolerance = accumulator.lowerTolerance ?? accumulator.factor.lowerTolerance;
    const upperTolerance = accumulator.upperTolerance ?? accumulator.factor.upperTolerance;
    if (!(upperTolerance > lowerTolerance)) {
      pushClarification(clarifications, "proposal_ambiguous", "Factor tolerance target requires lower_tolerance < upper_tolerance.", ["numericTarget"]);
      continue;
    }
    emittedTargetKeys.add(key);
    const worksheetKey = `${accumulator.worksheet.worksheetName}\u0000${accumulator.worksheet.tableId}`;
    worksheetTargets.get(worksheetKey)!.targets.push({
      targetId: `${accumulator.worksheet.worksheetName}:${accumulator.worksheet.tableId}:${accumulator.factor.sourceRow}:factor_tolerance`,
      targetType: "factor_tolerance",
      factor: {
        worksheetName: accumulator.factor.worksheetName,
        tableId: accumulator.factor.tableId,
        sourceRow: accumulator.factor.sourceRow,
        factorName: accumulator.factor.factorName,
        unit: accumulator.factor.unit,
      },
      upperTolerance,
      lowerTolerance,
      unit: accumulator.unit,
    });
  }

  for (const [key, accumulator] of specificationAccumulators) {
    if (emittedTargetKeys.has(key)) {
      pushClarification(clarifications, "proposal_ambiguous", "Only one system_specification target is allowed per worksheet.", ["directions"]);
      continue;
    }
    const effectiveLower = accumulator.lowerSpecLimit ?? accumulator.worksheet.system.lowerSpecLimit;
    const effectiveUpper = accumulator.upperSpecLimit ?? accumulator.worksheet.system.upperSpecLimit;
    if (!(effectiveUpper > effectiveLower)) {
      pushClarification(clarifications, "proposal_ambiguous", "System specification requires effective lower_spec_limit < upper_spec_limit.", ["numericTarget"]);
      continue;
    }
    emittedTargetKeys.add(key);
    const worksheetKey = `${accumulator.worksheet.worksheetName}\u0000${accumulator.worksheet.tableId}`;
    worksheetTargets.get(worksheetKey)!.targets.push({
      targetId: `${accumulator.worksheet.worksheetName}:${accumulator.worksheet.tableId}:system_specification`,
      targetType: "system_specification",
      systemIdentity: {
        baselineIdentity: accumulator.worksheet.baselineIdentity,
        designNominal: accumulator.worksheet.system.designNominal,
        mean: accumulator.worksheet.system.mean,
        rssSigma: accumulator.worksheet.system.rssSigma,
        lowerSpecLimit: accumulator.worksheet.system.lowerSpecLimit,
        upperSpecLimit: accumulator.worksheet.system.upperSpecLimit,
        targetCpk: accumulator.worksheet.system.targetCpk,
        traceReferences: [...accumulator.worksheet.system.traceReferences],
      },
      ...(accumulator.lowerSpecLimit === undefined ? {} : { lowerSpecLimit: accumulator.lowerSpecLimit }),
      ...(accumulator.upperSpecLimit === undefined ? {} : { upperSpecLimit: accumulator.upperSpecLimit }),
      unit: accumulator.unit,
    });
  }

  if (clarifications.length > 0) {
    return clarificationResult(clarifications);
  }

  const worksheetRecords = [...worksheetTargets.values()]
    .filter(({ targets }) => targets.length > 0)
    .map(({ worksheet, targets }) => ({
      worksheetName: worksheet.worksheetName,
      tableId: worksheet.tableId,
      baselineIdentity: worksheet.baselineIdentity,
      targets,
    }));

  const artifactCandidate = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    targetVersion: "f6-optimization-targets-v2" as const,
    workbookContentHash: lineage.workbookContentHash,
    worksheets: worksheetRecords,
  };

  if (worksheetRecords.length === 0) {
    return {
      status: "draft_ready",
      preview: {
        reviewContextId: lineage.reviewContextId,
        qualitativeDirections,
      },
    };
  }

  const parsed = f6OptimizationTargetsV2Schema.safeParse(artifactCandidate);
  if (!parsed.success) {
    return clarificationResult([createClarification(
      "proposal_ambiguous",
      "Optimization targets proposal cannot be materialized safely. Please clarify worksheet, factor and numeric target details.",
      ["directions"],
    )]);
  }

  return {
    status: "draft_ready",
    artifact: parsed.data,
    preview: {
      reviewContextId: lineage.reviewContextId,
      qualitativeDirections,
      artifact: parsed.data,
    },
  };
}

export function materializeF6InputProposal(
  proposal: F6InputProposalForMaterialization,
  lineage: F6InputMaterializationLineage,
): F6InputMaterializationResult {
  if (proposal.proposalVersion === "f6-analysis-context-proposal-v1") {
    return materializeF6AnalysisContext(proposal, lineage);
  }
  return materializeF6OptimizationTargets(proposal, lineage);
}
