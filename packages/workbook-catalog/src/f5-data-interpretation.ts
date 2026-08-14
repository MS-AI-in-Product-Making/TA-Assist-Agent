import {
  createTypedError,
  f5DataInterpretationRequestSchema,
  f5DataInterpretationResultSchema,
  f5ObjectiveInterpretationCompletedResultSchema,
  type F5DataInterpretationResult,
} from "@ai-assist/contracts";
import { createInterpretation } from "./interpretation-placeholder.js";

const REQUEST_REFERENCE = "f5-data-interpretation-request-v1";
const STRUCTURAL_SCOPES = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
  "cross_subsystem",
  "non_geometric_variable",
  "long_dimension_chain",
] as const;
const STRUCTURAL_ASSUMPTIONS = [
  ["assembly_datum_face", "assembly-datum-face", "The assembly datum face requires engineering confirmation."],
  ["stack_start", "stack-start", "The tolerance stack start requires engineering confirmation."],
  ["cross_subsystem", "cross-subsystem", "Cross-subsystem participation requires engineering confirmation."],
  ["direction", "direction", "The tolerance-chain direction requires engineering confirmation."],
] as const;

function typedRequestError(
  summary: string,
  code: "validation_error" | "policy_denied" | "prerequisite_not_ready" = "validation_error",
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide a valid confidential F5 data interpretation request.",
    affectedInputReferences: [REQUEST_REFERENCE],
  });
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function validatedResult(value: unknown): F5DataInterpretationResult {
  const parsed = f5DataInterpretationResultSchema.safeParse(value);
  if (!parsed.success) {
    throw typedRequestError("F5 data interpretation result validation failed.", "prerequisite_not_ready");
  }
  return deepFreeze(structuredClone(parsed.data));
}

function sourceKey(source: { worksheetName: string; tableId: string; sourceRow: number }): string {
  return `${source.worksheetName}\u0000${source.tableId}\u0000${source.sourceRow}`;
}

function factorReference(source: { worksheetName: string; tableId: string; sourceRow: number }): string {
  return `${source.worksheetName}/${source.tableId}/${source.sourceRow}`;
}

type ParsedRequest = ReturnType<typeof f5DataInterpretationRequestSchema.parse>;
type RequestWorksheet = ParsedRequest["worksheets"][number];
type ObjectiveResult = ReturnType<typeof f5ObjectiveInterpretationCompletedResultSchema.parse>;
type CompletedWorksheetResult = Extract<F5DataInterpretationResult["worksheets"][number], { status: "completed" }>;
type RootStatement = CompletedWorksheetResult["statements"][number];

function rejectedWorksheet(worksheetName: string) {
  return {
    worksheetName,
    status: "input_rejected" as const,
    reasonCode: "interpretation_failed" as const,
    artifactReference: `worksheet:${worksheetName}`,
  };
}

function mapObjectiveStatements(objective: ObjectiveResult): RootStatement[] {
  const mapped: RootStatement[] = [];
  for (const statement of objective.statements) {
    if (statement.type === "FACT") {
      mapped.push(structuredClone(statement));
      continue;
    }
    if (statement.type === "RULE") {
      mapped.push(structuredClone(statement));
      continue;
    }
    if (statement.type === "SIGNAL" || statement.type === "OPTION") {
      mapped.push(structuredClone(statement));
    }
  }
  return mapped;
}

function createImageEvidence(worksheet: RequestWorksheet) {
  if ("observationVersion" in worksheet) {
    const facts = worksheet.imageObservations
      .filter(({ visualObservation }) => (
        visualObservation.confidence === "high" && visualObservation.reviewStatus !== "rejected"
      ))
      .map(({ scope, visualObservation }) => ({
        statementId: `f5-image-fact-${scope}`,
        type: "FACT" as const,
        section: "tolerance-chain-validity" as const,
        content: {
          provenanceKind: "image_observation" as const,
          scope,
          observedValue: visualObservation.observedValue,
          imageReference: structuredClone(worksheet.imageReference),
          confidence: visualObservation.confidence,
          visibleBasis: visualObservation.visibleBasis,
          visibleLabels: structuredClone(visualObservation.visibleLabels),
          reviewStatus: visualObservation.reviewStatus,
          ...(visualObservation.confirmedBy === undefined ? {} : { confirmedBy: visualObservation.confirmedBy }),
          ...(visualObservation.confirmedAt === undefined ? {} : { confirmedAt: visualObservation.confirmedAt }),
        },
      }));
    const signals = worksheet.imageObservations.map(({ scope, visualObservation, contextualSignal }) => ({
      statementId: `f5-context-signal-${scope}`,
      type: "SIGNAL" as const,
      section: "tolerance-chain-validity" as const,
      content: {
        signalKind: "image_text_context_review" as const,
        scope,
        signalValue: contextualSignal.signalValue,
        textBasis: contextualSignal.textBasis,
        linkedSourceRows: structuredClone(contextualSignal.linkedSourceRows),
        linkedVisualLabels: structuredClone(contextualSignal.linkedVisualLabels),
        visualEvidence: {
          ...structuredClone(visualObservation),
          imageReference: structuredClone(worksheet.imageReference),
        },
        requiresEngineeringReview: true as const,
      },
    }));
    return { status: "needs_review" as const, statements: [...facts, ...signals] };
  }

  const observations = worksheet.imageObservations;
  if (observations.length === 0) {
    return { status: "not_evaluated" as const, statements: [] };
  }
  const usableObservations = observations.filter(({ confidence, reviewStatus }) => (
    confidence !== "low" && reviewStatus !== "rejected"
  ));
  if (usableObservations.length === 0) {
    return { status: "insufficient_evidence" as const, statements: [] };
  }

  const factObservations = usableObservations.filter(({ confidence }) => confidence === "high");
  const facts = factObservations.map((observation) => ({
    statementId: `f5-image-fact-${observation.scope}`,
    type: "FACT" as const,
    section: "tolerance-chain-validity" as const,
    content: {
      provenanceKind: "image_observation" as const,
      scope: observation.scope,
      observedValue: observation.observedValue,
      imageReference: structuredClone(worksheet.imageReference),
      confidence: observation.confidence,
      visibleBasis: observation.visibleBasis,
      reviewStatus: observation.reviewStatus,
      ...(observation.confirmedBy === undefined ? {} : { confirmedBy: observation.confirmedBy }),
      ...(observation.confirmedAt === undefined ? {} : { confirmedAt: observation.confirmedAt }),
    },
  }));
  const mediumEvidence = usableObservations
    .filter(({ confidence }) => confidence === "medium")
    .map((observation) => ({
      ...structuredClone(observation),
      imageReference: structuredClone(worksheet.imageReference),
    }));
  const signals = usableObservations.map((observation) => {
    const fact = facts.find(({ content }) => content.scope === observation.scope);
    const evidence = mediumEvidence.find(({ scope }) => scope === observation.scope);
    return {
      statementId: `f5-signal-structural-evidence-review-${observation.scope}`,
      type: "SIGNAL" as const,
      section: "tolerance-chain-validity" as const,
      content: {
        signalKind: "structural_evidence_review" as const,
        requiresEngineeringReview: true as const,
        ...(fact === undefined ? {} : { triggerFactReferences: [fact.statementId] }),
        ...(evidence === undefined ? {} : { observationEvidence: [evidence] }),
      },
    };
  });
  return {
    status: "needs_review" as const,
    statements: [...facts, ...signals],
  };
}

function structuralClarifications(
  worksheet: RequestWorksheet,
  observationFallback: ParsedRequest["observationFallback"],
) {
  const observationByScope = new Map(worksheet.imageObservations.map((observation) => [
    observation.scope,
    "visualObservation" in observation ? observation.visualObservation : observation,
  ]));
  return STRUCTURAL_SCOPES.flatMap((scope) => {
    const observation = observationByScope.get(scope);
    const reasonCode = observation === undefined
      ? observationFallback !== undefined && (STRUCTURAL_SCOPES.slice(0, 5) as readonly string[]).includes(scope)
        ? observationFallback.reasonCode
        : "drawing_evidence_not_evaluated"
      : observation.reviewStatus === "rejected"
        ? "image_observation_rejected"
        : observation.confidence === "low"
          ? "image_observation_low_confidence"
          : undefined;
    if (reasonCode === undefined) return [];
    const enhancedObservationRejected = reasonCode === "enhanced_observation_rejected";
    return [{
      clarificationId: `clarification-${reasonCode}-${scope}`,
      reasonCode,
      section: "toleranceChainValidity" as const,
      structuralScope: scope,
      missingEvidence: enhancedObservationRejected
        ? ["validated enhanced image observations"]
        : [`usable ${scope} image observation`],
      affectedConclusionIds: [] as string[],
      blockingScope: "conclusion" as const,
      questionForReviewer: enhancedObservationRejected
        ? `Can the enhanced ${scope} observation be regenerated and validated from the existing worksheet image?`
        : `Can the ${scope} image observation be reviewed with acceptable evidence?`,
    }];
  });
}

function structuralItems(
  worksheet: RequestWorksheet,
  imageStatements: readonly RootStatement[],
  clarifications: ReturnType<typeof structuralClarifications>,
) {
  const observationByScope = new Map(worksheet.imageObservations.map((observation) => [
    observation.scope,
    "visualObservation" in observation ? observation.visualObservation : observation,
  ]));
  return STRUCTURAL_SCOPES.map((scope) => {
    const observation = observationByScope.get(scope);
    const status = observation === undefined
      ? "not_evaluated" as const
      : observation.confidence === "low" || observation.reviewStatus === "rejected"
        ? "insufficient_evidence" as const
        : "needs_review" as const;
    const relatedStatementIds = imageStatements.filter((statement) => (
      (statement.type === "FACT" && statement.content.provenanceKind === "image_observation" && statement.content.scope === scope)
      || (statement.type === "SIGNAL" && "signalKind" in statement.content
        && statement.content.signalKind === "structural_evidence_review" && status === "needs_review"
        && (statement.content.triggerFactReferences?.some((statementId) => imageStatements.some((candidate) => (
          candidate.statementId === statementId && candidate.type === "FACT"
            && candidate.content.provenanceKind === "image_observation" && candidate.content.scope === scope
        ))) === true
          || statement.content.observationEvidence?.some((evidence) => evidence.scope === scope) === true))
      || (statement.type === "SIGNAL" && "signalKind" in statement.content
        && statement.content.signalKind === "image_text_context_review"
        && statement.content.scope === scope)
    )).map(({ statementId }) => statementId);
    return {
      scope,
      status,
      relatedStatementIds,
      clarificationIds: clarifications.filter(({ clarificationId }) => clarificationId.endsWith(`-${scope}`))
        .map(({ clarificationId }) => clarificationId),
    };
  });
}

function structuralAssumptions(worksheet: RequestWorksheet) {
  const observedScopes = new Set(worksheet.imageObservations
    .filter((observation) => {
      const visual = "visualObservation" in observation ? observation.visualObservation : observation;
      return visual.confidence !== "low" && visual.reviewStatus !== "rejected";
    })
    .map(({ scope }) => scope));
  return STRUCTURAL_ASSUMPTIONS
    .filter(([scope]) => !observedScopes.has(scope))
    .map(([scope, id, statement]) => ({
      assumptionId: `assumption-${id}`,
      source: `Missing controlled image observation for ${scope}`,
      affectedSections: ["toleranceChainValidity" as const],
      statement,
      status: "proposed" as const,
    }));
}

function createWorksheetResult(
  worksheet: RequestWorksheet,
  createObjectiveInterpretation: typeof createInterpretation,
  observationFallback: ParsedRequest["observationFallback"],
) {
  let objectiveRaw: unknown;
  try {
    objectiveRaw = createObjectiveInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult: worksheet.calculationResult,
    });
  } catch {
    throw typedRequestError("F5 objective interpretation prerequisite failed.", "prerequisite_not_ready");
  }
  const objective = f5ObjectiveInterpretationCompletedResultSchema.safeParse(objectiveRaw);
  if (!objective.success) {
    throw typedRequestError("F5 objective interpretation result is invalid.", "prerequisite_not_ready");
  }

  const objectiveStatements = mapObjectiveStatements(objective.data);
  const contributionFactIdByReference = new Map<string, string>();
  for (const statement of objectiveStatements) {
    if (statement.type === "FACT" && statement.content.provenanceKind !== "image_observation"
      && "metric" in statement.content
      && statement.content.metric === "factor_contribution") {
      contributionFactIdByReference.set(statement.content.factorReference, statement.statementId);
    }
  }
  const governanceBySource = new Map(worksheet.governanceRows.map((row) => [sourceKey(row.source), row]));
  const governanceFacts = worksheet.calculationResult.factors.map((factor, factorIndex) => {
    const governance = governanceBySource.get(sourceKey(factor.source));
    if (governance === undefined) {
      throw typedRequestError("F5 governance provenance is incomplete.", "prerequisite_not_ready");
    }
    return {
      statementId: `f5-fact-f3-governance-${factorIndex + 1}`,
      type: "FACT" as const,
      section: "major-contributors" as const,
      content: {
        provenanceKind: "f3_governance" as const,
        source: structuredClone(governance.source),
        drawingNumber: governance.drawingNumber,
        dimId: governance.dimId,
        dimIdStatus: governance.dimIdStatus,
        governanceStatus: governance.governanceStatus,
        qualitySignals: structuredClone(governance.qualitySignals),
      },
    };
  });
  const governanceFactIdBySource = new Map(governanceFacts.map((fact) => [
    sourceKey(fact.content.source),
    fact.statementId,
  ]));
  const contributors = worksheet.calculationResult.factors.map((factor, factorIndex) => {
    const reference = factorReference(factor.source);
    const governance = governanceBySource.get(sourceKey(factor.source));
    const contributionFactId = contributionFactIdByReference.get(reference);
    if (governance === undefined || contributionFactId === undefined) {
      throw typedRequestError("F5 contributor provenance is incomplete.", "prerequisite_not_ready");
    }
    return {
      factorReference: reference,
      factorName: factor.factorName,
      factorIndex,
      contributionPercent: factor.contribution * 100,
      halfTolerance: factor.halfTolerance,
      sigma: factor.sigma,
      unit: factor.unit,
      source: structuredClone(factor.source),
      drawingNumber: governance.drawingNumber,
      dimId: governance.dimId,
      governanceStatus: governance.governanceStatus,
      reasonCodes: [] as Array<"contribution_concentration" | "identifier_governance_gap">,
      relatedStatementIds: [contributionFactId],
    };
  }).sort((left, right) => (
    right.contributionPercent - left.contributionPercent || left.factorIndex - right.factorIndex
  ));

  const governanceSignals = contributors.flatMap((contributor) => {
    const governance = governanceBySource.get(sourceKey(contributor.source));
    if (governance === undefined || (governance.governanceStatus === "complete"
      && governance.dimIdStatus === "valid" && governance.qualitySignals.length === 0)) {
      return [];
    }
    const governanceFactId = governanceFactIdBySource.get(sourceKey(contributor.source));
    if (governanceFactId === undefined) {
      throw typedRequestError("F5 governance FACT reference is incomplete.", "prerequisite_not_ready");
    }
    return [{
      statementId: `f5-signal-identifier-governance-gap-${contributor.factorIndex + 1}`,
      type: "SIGNAL" as const,
      section: "major-contributors" as const,
      content: {
        signalKind: "identifier_governance_gap" as const,
        requiresEngineeringReview: true as const,
        triggerFactReferences: [governanceFactId],
      },
    }];
  });
  const concentrationSignal = objectiveStatements.find((statement) => (
    statement.type === "SIGNAL" && "entryId" in statement.content
      && statement.content.entryId === "root-cause-contributor-concentration"
  ));
  const highestContribution = Math.max(...contributors.map(({ contributionPercent }) => contributionPercent));
  for (const contributor of contributors) {
    if (concentrationSignal !== undefined && contributor.contributionPercent === highestContribution) {
      contributor.reasonCodes.push("contribution_concentration");
      contributor.relatedStatementIds.push(concentrationSignal.statementId);
    }
    const governanceSignal = governanceSignals.find((signal) => signal.statementId === `f5-signal-identifier-governance-gap-${contributor.factorIndex + 1}`);
    if (governanceSignal !== undefined) {
      contributor.reasonCodes.push("identifier_governance_gap");
      contributor.relatedStatementIds.push(governanceSignal.statementId);
    }
  }
  const imageEvidence = createImageEvidence(worksheet);
  const capabilityStatementIds = objectiveStatements.filter((statement) => (
    statement.type === "RULE"
      || (statement.type === "FACT" && "metric" in statement.content
        && statement.content.metric !== "factor_contribution")
  )).map(({ statementId }) => statementId);
  const clarifications = structuralClarifications(worksheet, observationFallback);
  const toleranceItems = structuralItems(worksheet, imageEvidence.statements, clarifications);
  const toleranceSeverity = { not_evaluated: 1, insufficient_evidence: 2, needs_review: 3 } as const;
  const toleranceStatus = toleranceItems.reduce((highest, item) => (
    toleranceSeverity[item.status] > toleranceSeverity[highest] ? item.status : highest
  ), "not_evaluated" as "not_evaluated" | "insufficient_evidence" | "needs_review");

  return {
    worksheetName: worksheet.worksheetName,
    imageReference: structuredClone(worksheet.imageReference),
    governanceRows: structuredClone(worksheet.governanceRows),
    calculationResult: structuredClone(worksheet.calculationResult),
    ...("observationVersion" in worksheet ? {
      observationVersion: worksheet.observationVersion,
      contextSnapshot: structuredClone(worksheet.contextSnapshot),
    } : {}),
    status: "completed" as const,
    sections: {
      toleranceChainValidity: { status: toleranceStatus, items: toleranceItems },
      capabilityVsSpecification: { status: "supported" as const, statementIds: capabilityStatementIds },
      majorContributors: { status: "supported" as const, items: contributors },
      reasonableToleranceRange: { status: "delegated_to_f6" as const },
      designOptimizationAndParallelOptions: { status: "delegated_to_f6" as const },
    },
    statements: [...objectiveStatements, ...governanceFacts, ...imageEvidence.statements, ...governanceSignals],
    clarifications,
    assumptions: structuralAssumptions(worksheet),
  };
}

export function createF5DataInterpretation(
  input: unknown,
  dependencies: { createObjectiveInterpretation?: typeof createInterpretation } = {},
): F5DataInterpretationResult {
  let parsed: ReturnType<typeof f5DataInterpretationRequestSchema.safeParse> | undefined;
  try {
    const classification = (input as { inputClassification?: unknown })?.inputClassification;
    if (typeof classification === "string" && classification !== "confidential") {
      throw typedRequestError("F5 data interpretation input is not permitted.", "policy_denied");
    }
    parsed = f5DataInterpretationRequestSchema.safeParse(input);
  } catch (error) {
    if ((error as { code?: unknown })?.code === "policy_denied") throw error;
    throw typedRequestError("F5 data interpretation request is invalid.");
  }
  if (!parsed.success) throw typedRequestError("F5 data interpretation request is invalid.");

  const createObjectiveInterpretation = dependencies.createObjectiveInterpretation ?? createInterpretation;
  const worksheets = parsed.data.worksheets.map((worksheet) => {
    try {
      return createWorksheetResult(
        worksheet,
        createObjectiveInterpretation,
        parsed.data.observationFallback,
      );
    } catch {
      return rejectedWorksheet(worksheet.worksheetName);
    }
  });
  const completedWorksheets = worksheets.filter((worksheet) => worksheet.status === "completed");
  const inputRejectedWorksheetCount = worksheets.length - completedWorksheets.length;
  const summary = {
    worksheetCount: worksheets.length,
    completedWorksheetCount: completedWorksheets.length,
    inputRejectedWorksheetCount,
    statementCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.statements.length, 0),
    clarificationCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.clarifications.length, 0),
    assumptionCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.assumptions.length, 0),
  };

  return validatedResult({
    contractVersion: parsed.data.contractVersion,
    outputClassification: "confidential",
    featureId: "F5",
    status: inputRejectedWorksheetCount === 0
      ? "completed"
      : completedWorksheets.length === 0
        ? "input_rejected"
        : "partially_completed",
    interpretationVersion: "f5-data-interpretation-v1",
    knowledgeBaseVersion: parsed.data.knowledgeBaseVersion,
    workbook: structuredClone(parsed.data.workbook),
    worksheets,
    summary,
  });
}