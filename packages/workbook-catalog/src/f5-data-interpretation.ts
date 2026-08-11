import {
  createTypedError,
  f5DataInterpretationRequestSchema,
  f5DataInterpretationResultSchema,
  f5ObjectiveInterpretationCompletedResultSchema,
  type F5DataInterpretationResult,
} from "@ai-assist/contracts";
import { createInterpretation } from "./interpretation-placeholder.js";

const REQUEST_REFERENCE = "f5-data-interpretation-request-v1";
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

function mapObjectiveStatements(objective: ObjectiveResult, worksheet: RequestWorksheet): RootStatement[] {
  const mapped: RootStatement[] = [];
  for (const statement of objective.statements) {
    if (statement.type === "FACT") {
      if (statement.section === "capability-vs-specification" || statement.section === "major-contributors") {
        mapped.push(structuredClone(statement));
      }
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
  const signals = [{
    statementId: "f5-signal-structural-evidence-review",
    type: "SIGNAL" as const,
    section: "tolerance-chain-validity" as const,
    content: {
      signalKind: "structural_evidence_review" as const,
      requiresEngineeringReview: true as const,
      ...(facts.length === 0 ? {} : { triggerFactReferences: facts.map(({ statementId }) => statementId) }),
      ...(mediumEvidence.length === 0 ? {} : { observationEvidence: mediumEvidence }),
    },
  }];
  return {
    status: "needs_review" as const,
    statements: [...facts, ...signals],
  };
}

function structuralClarifications(
  worksheet: RequestWorksheet,
  status: "supported" | "needs_review" | "not_evaluated" | "insufficient_evidence",
  imageStatementIds: readonly string[],
) {
  const usableObservations = worksheet.imageObservations.filter(({ confidence, reviewStatus }) => (
    confidence !== "low" && reviewStatus !== "rejected"
  ));
  const observedScopes = new Set(usableObservations.map(({ scope }) => scope));
  const missingScopes = STRUCTURAL_ASSUMPTIONS
    .map(([scope]) => scope)
    .filter((scope) => !observedScopes.has(scope));
  const observationClarifications = worksheet.imageObservations.flatMap((observation) => {
    const reasonCode = observation.reviewStatus === "rejected"
      ? "image_observation_rejected"
      : observation.confidence === "low"
        ? "image_observation_low_confidence"
        : undefined;
    if (reasonCode === undefined) return [];
    return [{
      clarificationId: `clarification-${reasonCode}-${observation.scope}`,
      reasonCode,
      section: "toleranceChainValidity" as const,
      missingEvidence: [`usable ${observation.scope} image observation`],
      affectedConclusionIds: [] as string[],
      blockingScope: "conclusion" as const,
      questionForReviewer: `Can the ${observation.scope} image observation be reviewed with acceptable evidence?`,
    }];
  });
  if (status === "not_evaluated") {
    return [...observationClarifications, {
      clarificationId: "clarification-structural-evidence",
      reasonCode: "drawing_evidence_not_evaluated",
      section: "toleranceChainValidity" as const,
      missingEvidence: ["reviewed worksheet image observations"],
      affectedConclusionIds: [...imageStatementIds],
      blockingScope: "section" as const,
      questionForReviewer: "Can the missing structural evidence be reviewed and confirmed?",
    }];
  }
  if (missingScopes.length === 0 || status === "insufficient_evidence") return observationClarifications;

  return [...observationClarifications, {
    clarificationId: "clarification-structural-evidence",
    reasonCode: "structural_scope_confirmation_required",
    section: "toleranceChainValidity" as const,
    missingEvidence: missingScopes.map((scope) => `confirmed ${scope} evidence`),
    affectedConclusionIds: [...imageStatementIds],
    blockingScope: "section" as const,
    questionForReviewer: "Can the missing structural evidence be reviewed and confirmed?",
  }];
}

function structuralAssumptions(worksheet: RequestWorksheet) {
  const observedScopes = new Set(worksheet.imageObservations
    .filter(({ confidence, reviewStatus }) => confidence !== "low" && reviewStatus !== "rejected")
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

  const objectiveStatements = mapObjectiveStatements(objective.data, worksheet);
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
      source: structuredClone(factor.source),
      drawingNumber: governance.drawingNumber,
      dimId: governance.dimId,
      governanceStatus: governance.governanceStatus,
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
  const imageEvidence = createImageEvidence(worksheet);
  const capabilityStatementIds = objectiveStatements.filter((statement) => (
    statement.section === "capability-vs-specification"
      && (statement.type === "FACT" || statement.type === "RULE")
  )).map(({ statementId }) => statementId);
  const imageStatementIds = imageEvidence.statements
    .filter(({ type }) => type === "FACT")
    .map(({ statementId }) => statementId);

  return {
    worksheetName: worksheet.worksheetName,
    imageReference: structuredClone(worksheet.imageReference),
    governanceRows: structuredClone(worksheet.governanceRows),
    calculationResult: structuredClone(worksheet.calculationResult),
    status: "completed" as const,
    sections: {
      toleranceChainValidity: { status: imageEvidence.status },
      capabilityVsSpecification: { status: "supported" as const, statementIds: capabilityStatementIds },
      majorContributors: { status: "supported" as const, items: contributors },
      reasonableToleranceRange: { status: "delegated_to_f6" as const },
      designOptimizationAndParallelOptions: { status: "delegated_to_f6" as const },
    },
    statements: [...objectiveStatements, ...governanceFacts, ...imageEvidence.statements, ...governanceSignals],
    clarifications: structuralClarifications(
      worksheet,
      imageEvidence.status,
      imageStatementIds,
    ),
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
  const worksheets = parsed.data.worksheets.map((worksheet) => (
    createWorksheetResult(worksheet, createObjectiveInterpretation)
  ));
  const summary = {
    worksheetCount: worksheets.length,
    completedWorksheetCount: worksheets.length,
    inputRejectedWorksheetCount: 0,
    statementCount: worksheets.reduce((count, worksheet) => count + worksheet.statements.length, 0),
    clarificationCount: worksheets.reduce((count, worksheet) => count + worksheet.clarifications.length, 0),
    assumptionCount: worksheets.reduce((count, worksheet) => count + worksheet.assumptions.length, 0),
  };

  return validatedResult({
    contractVersion: parsed.data.contractVersion,
    outputClassification: "confidential",
    featureId: "F5",
    status: "completed",
    interpretationVersion: "f5-data-interpretation-v1",
    knowledgeBaseVersion: parsed.data.knowledgeBaseVersion,
    workbook: structuredClone(parsed.data.workbook),
    worksheets,
    summary,
  });
}