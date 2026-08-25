import type { F8SessionSnapshot } from "./commands.js";

export interface ReviewFindingEvidence {
  readonly sourceRow: number;
  readonly sourceCells: readonly string[];
  readonly imageArtifactId?: string;
  readonly formulaIds: readonly string[];
  readonly ruleEntryId?: string;
}

export interface ReviewFinding {
  readonly findingId: string;
  readonly title: string;
  readonly severity: "high" | "medium" | "low";
  readonly summary: string;
  readonly evidence: ReviewFindingEvidence;
  readonly action?: {
    readonly title: string;
    readonly summary: string;
  };
}

export interface ReviewEvidencePane {
  readonly worksheetName: string;
  readonly imageArtifactId?: string;
  readonly sourceRow: number;
  readonly sourceCells: readonly string[];
  readonly formulaIds: readonly string[];
  readonly ruleEntryId?: string;
  readonly factors: readonly {
    readonly factorName: string;
    readonly contribution?: number;
    readonly sourceRow: number;
  }[];
}

export interface ReviewCard {
  readonly title: string;
  readonly items: readonly string[];
}

export interface ReviewOptionSummary {
  readonly optionId: string;
  readonly label: string;
  readonly status: string;
  readonly deltaCpk?: number;
  readonly summary: string;
}

export interface ReviewReportLink {
  readonly artifactId: string;
  readonly label: string;
}

export interface ReviewWorksheetSummary {
  readonly worksheetName: string;
  readonly status: string;
  readonly findingCount: number;
}

export interface WorksheetReviewModel {
  readonly sessionId: string;
  readonly worksheets: readonly ReviewWorksheetSummary[];
  readonly selectedWorksheetName: string;
  readonly selectedFindingId?: string;
  readonly findings: readonly ReviewFinding[];
  readonly evidence?: ReviewEvidencePane;
  readonly analysisContext?: ReviewCard;
  readonly optimizationTargets?: ReviewCard;
  readonly f6Options: readonly ReviewOptionSummary[];
  readonly report?: ReviewReportLink;
}

export interface ReviewSelection {
  readonly selectedWorksheetName: string;
  readonly selectedFindingId?: string;
}

export type ReviewArtifactKind = "f1_image" | "f3_report" | "f4_calculation" | "f4_report" | "f5_report" | "f6_optimization" | "f6_report";

export interface ReviewContextArtifact {
  readonly artifactId: string;
  readonly kind: ReviewArtifactKind;
  readonly revision: number;
  readonly validated: boolean;
  readonly reviewContextId: string;
}

export interface CompleteReviewContext {
  readonly reviewContextId: string;
  readonly artifacts: ReadonlyMap<ReviewArtifactKind, ReviewContextArtifact>;
}

interface ReviewProjectionInput {
  readonly sessionId: string;
  readonly snapshot: F8SessionSnapshot;
  readonly f4Report?: {
    readonly calculations?: readonly CalculationLike[];
  };
  readonly f5Report?: {
    readonly worksheets?: readonly F5WorksheetLike[];
  };
  readonly f6Report?: {
    readonly worksheets?: readonly F6WorksheetLike[];
  };
}

interface CalculationLike {
  readonly worksheetSelection?: {
    readonly worksheetName?: string;
    readonly tableId?: string;
  };
  readonly capability?: {
    readonly cpk?: number;
    readonly status?: string;
  };
  readonly traceRecords?: readonly {
    readonly formulaId?: string;
    readonly outputField?: string;
  }[];
  readonly factors?: readonly {
    readonly factorName?: string;
    readonly contribution?: number;
    readonly source?: {
      readonly sourceRow?: number;
    };
    readonly trace?: {
      readonly sourceCells?: readonly string[];
      readonly formulaIds?: readonly string[];
    };
  }[];
}

interface F5WorksheetLike {
  readonly worksheetName?: string;
  readonly tableId?: string;
  readonly status?: string;
  readonly statements?: readonly F5StatementLike[];
  readonly clarifications?: readonly {
    readonly message?: string;
  }[];
  readonly assumptions?: readonly {
    readonly message?: string;
  }[];
}

interface F5StatementLike {
  readonly statementId?: string;
  readonly type?: string;
  readonly content?: {
    readonly entryId?: string;
    readonly requiresEngineeringReview?: boolean;
    readonly factorSourceRow?: number;
  };
}

interface F6WorksheetLike {
  readonly worksheetName?: string;
  readonly baselineIdentity?: {
    readonly worksheetName?: string;
    readonly tableId?: string;
  };
  readonly runStatus?: string;
  readonly options?: readonly F6OptionLike[];
}

interface F6OptionLike {
  readonly optionId?: string;
  readonly title?: string;
  readonly label?: string;
  readonly status?: string;
  readonly summary?: string;
  readonly targetId?: string;
  readonly baselineMetrics?: {
    readonly cpk?: number;
  };
  readonly resultMetrics?: {
    readonly cpk?: number;
  };
  readonly expectedMetrics?: {
    readonly baselineCpk?: number;
    readonly scenarioCpk?: number;
    readonly deltaCpk?: number;
  };
  readonly policyContext?: {
    readonly optionCode?: string;
  };
}

export function projectWorksheetReview(input: ReviewProjectionInput, selection: ReviewSelection | string): WorksheetReviewModel {
  const { selectedWorksheetName: worksheetName, selectedFindingId } = typeof selection === "string"
    ? { selectedWorksheetName: selection }
    : selection;
  const reviewContext = selectCompleteReviewContext(input.snapshot);
  if (reviewContext === undefined) {
    return {
      sessionId: input.sessionId,
      worksheets: collectWorksheetNames(input).map((name) => ({ worksheetName: name, status: "completed", findingCount: 0 })),
      selectedWorksheetName: worksheetName,
      findings: [],
      f6Options: [],
    };
  }
  const worksheetNames = collectWorksheetNames(input);
  const calculation = input.f4Report?.calculations?.find((item) => item.worksheetSelection?.worksheetName === worksheetName);
  const interpretation = input.f5Report?.worksheets?.find((item) => item.worksheetName === worksheetName);
  const optimization = input.f6Report?.worksheets?.find((item) => item.worksheetName === worksheetName);
  if (!hasMatchingWorksheetIdentity(worksheetName, calculation, interpretation, optimization)) {
    return {
      sessionId: input.sessionId,
      worksheets: worksheetNames.map((name) => ({ worksheetName: name, status: "evidence_mismatch", findingCount: 0 })),
      selectedWorksheetName: worksheetName,
      findings: [],
      f6Options: [],
    };
  }
  const dominantFactor = selectDominantFactor(calculation);
  const ruleStatement = interpretation?.statements?.find((statement) => statement.type === "RULE");
  const reviewSignals = (interpretation?.statements ?? []).filter((statement) => statement.type === "SIGNAL" && statement.content?.requiresEngineeringReview === true);
  const imageArtifactId = reviewContext.artifacts.get("f1_image")?.artifactId;
  const findings = createFindings({
    worksheetName,
    ...(calculation === undefined ? {} : { calculation }),
    ...(ruleStatement === undefined ? {} : { ruleStatement }),
    reviewSignals,
    ...(dominantFactor === undefined ? {} : { dominantFactor }),
    ...(optimization === undefined ? {} : { optimization }),
    ...(imageArtifactId === undefined ? {} : { imageArtifactId }),
  });
  const selectedFinding = findings.find((finding) => finding.findingId === selectedFindingId) ?? findings[0];

  return {
    sessionId: input.sessionId,
    worksheets: worksheetNames.map((name) => ({
      worksheetName: name,
      status: worksheetStatus(name, input, findings.length > 0 && name === worksheetName),
      findingCount: name === worksheetName ? findings.length : countFindingsForWorksheet(input, name),
    })),
    selectedWorksheetName: worksheetName,
    ...(selectedFinding === undefined ? {} : { selectedFindingId: selectedFinding.findingId }),
    findings,
    ...(selectedFinding === undefined ? {} : { evidence: createEvidencePane(worksheetName, calculation, selectedFinding) }),
    ...(createAnalysisContext(interpretation) === undefined ? {} : { analysisContext: createAnalysisContext(interpretation)! }),
    ...(createOptimizationTargets(optimization) === undefined ? {} : { optimizationTargets: createOptimizationTargets(optimization)! }),
    f6Options: createOptionSummaries(optimization),
    ...(reviewContext.artifacts.get("f6_report") === undefined ? {} : {
      report: {
        artifactId: reviewContext.artifacts.get("f6_report")!.artifactId,
        label: "下载当前报告",
      },
    }),
  };
}

function createEvidencePane(worksheetName: string, calculation: CalculationLike | undefined, finding: ReviewFinding): ReviewEvidencePane {
  return {
    worksheetName,
    ...(finding.evidence.imageArtifactId === undefined ? {} : { imageArtifactId: finding.evidence.imageArtifactId }),
    sourceRow: finding.evidence.sourceRow,
    sourceCells: finding.evidence.sourceCells,
    formulaIds: finding.evidence.formulaIds,
    ...(finding.evidence.ruleEntryId === undefined ? {} : { ruleEntryId: finding.evidence.ruleEntryId }),
    factors: (calculation?.factors ?? []).map((factor) => ({
      factorName: factor.factorName ?? "Unnamed factor",
      ...(factor.contribution === undefined ? {} : { contribution: factor.contribution }),
      sourceRow: factor.source?.sourceRow ?? finding.evidence.sourceRow,
    })),
  };
}

function collectWorksheetNames(input: ReviewProjectionInput): string[] {
  const names = new Set<string>();
  for (const name of input.snapshot.downstreamScopeSelection?.selectedWorksheetNames ?? []) {
    if (typeof name === "string" && name.length > 0) names.add(name);
  }
  for (const item of input.f4Report?.calculations ?? []) {
    if (typeof item.worksheetSelection?.worksheetName === "string" && item.worksheetSelection.worksheetName.length > 0) {
      names.add(item.worksheetSelection.worksheetName);
    }
  }
  for (const item of input.f5Report?.worksheets ?? []) {
    if (typeof item.worksheetName === "string" && item.worksheetName.length > 0) names.add(item.worksheetName);
  }
  for (const item of input.f6Report?.worksheets ?? []) {
    if (typeof item.worksheetName === "string" && item.worksheetName.length > 0) names.add(item.worksheetName);
  }
  return [...names];
}

export function selectCompleteReviewContext(snapshot: F8SessionSnapshot): CompleteReviewContext | undefined {
  const currentRevision = snapshot.revision;
  const contexts = new Map<string, Map<ReviewArtifactKind, ReviewContextArtifact>>();
  for (const artifact of snapshot.artifactRefs ?? []) {
    if (!isReviewArtifact(artifact) || !artifact.validated || artifact.revision !== currentRevision || artifact.reviewContextId === undefined) {
      continue;
    }
    const context = contexts.get(artifact.reviewContextId) ?? new Map<ReviewArtifactKind, ReviewContextArtifact>();
    context.set(artifact.kind, artifact);
    contexts.set(artifact.reviewContextId, context);
  }

  const complete = [...contexts.entries()]
    .filter(([, artifacts]) => ["f4_report", "f5_report", "f6_report"].every((kind) => artifacts.has(kind as ReviewArtifactKind)))
    .sort(([left], [right]) => left.localeCompare(right));
  if (complete.length !== 1) {
    return undefined;
  }

  const [reviewContextId, artifacts] = complete[0]!;
  return { reviewContextId, artifacts };
}

function isReviewArtifact(artifact: NonNullable<F8SessionSnapshot["artifactRefs"]>[number]): artifact is ReviewContextArtifact {
  return ["f1_image", "f3_report", "f4_calculation", "f4_report", "f5_report", "f6_optimization", "f6_report"].includes(artifact.kind);
}

function selectDominantFactor(calculation: CalculationLike | undefined) {
  return [...(calculation?.factors ?? [])].sort((left, right) => (right.contribution ?? 0) - (left.contribution ?? 0))[0];
}

function hasMatchingWorksheetIdentity(
  worksheetName: string,
  calculation: CalculationLike | undefined,
  interpretation: F5WorksheetLike | undefined,
  optimization: F6WorksheetLike | undefined,
): boolean {
  const tableId = calculation?.worksheetSelection?.tableId;
  if (calculation?.worksheetSelection?.worksheetName !== worksheetName || tableId === undefined) return false;
  return interpretation?.worksheetName === worksheetName
    && interpretation.tableId === tableId
    && optimization?.worksheetName === worksheetName
    && optimization.baselineIdentity?.worksheetName === worksheetName
    && optimization.baselineIdentity?.tableId === tableId;
}

function createFindings(input: {
  readonly worksheetName: string;
  readonly calculation?: CalculationLike;
  readonly ruleStatement?: F5StatementLike;
  readonly reviewSignals: readonly F5StatementLike[];
  readonly dominantFactor?: NonNullable<CalculationLike["factors"]>[number];
  readonly optimization?: F6WorksheetLike;
  readonly imageArtifactId?: string;
}): ReviewFinding[] {
  if (input.dominantFactor?.source?.sourceRow === undefined) {
    return [];
  }

  const evidence: ReviewFindingEvidence = {
    sourceRow: input.dominantFactor.source.sourceRow,
    sourceCells: input.dominantFactor.trace?.sourceCells ?? [],
    formulaIds: collectFormulaIds(input.calculation, input.dominantFactor),
    ...(input.imageArtifactId === undefined ? {} : { imageArtifactId: input.imageArtifactId }),
    ...(input.ruleStatement?.content?.entryId === undefined ? {} : { ruleEntryId: input.ruleStatement.content.entryId }),
  };

  const actionOption = createOptionSummaries(input.optimization)[0];
  const sourceFindings = input.reviewSignals.length > 0 ? input.reviewSignals : [input.ruleStatement].filter((value): value is F5StatementLike => value !== undefined);

  return sourceFindings.map((statement, index) => {
    const boundFactor = statement.content?.factorSourceRow === undefined
      ? input.dominantFactor
      : input.calculation?.factors?.find((factor) => factor.source?.sourceRow === statement.content?.factorSourceRow) ?? input.dominantFactor;
    return {
      findingId: statement.statementId ?? statement.content?.entryId ?? `finding-${index + 1}`,
      title: formatLabel(statement.content?.entryId ?? statement.statementId ?? "Engineering review"),
      severity: (input.calculation?.capability?.status ?? "").toUpperCase() === "FAIL" ? "high" : "medium",
      summary: createFindingSummary(statement, input.calculation?.capability?.cpk),
      evidence: {
        ...evidence,
        sourceRow: boundFactor?.source?.sourceRow ?? evidence.sourceRow,
        sourceCells: boundFactor?.trace?.sourceCells ?? evidence.sourceCells,
      },
      ...(actionOption === undefined ? {} : { action: { title: actionOption.label, summary: actionOption.summary } }),
    };
  });
}

function collectFormulaIds(calculation: CalculationLike | undefined, factor: NonNullable<CalculationLike["factors"]>[number]): string[] {
  const fromTrace = (calculation?.traceRecords ?? [])
    .filter((record) => record.outputField === "capability.cpk" || record.outputField === undefined)
    .map((record) => record.formulaId)
    .filter((formulaId): formulaId is string => typeof formulaId === "string" && formulaId.length > 0);
  if (fromTrace.length > 0) {
    return fromTrace;
  }
  return (factor.trace?.formulaIds ?? []).filter((formulaId): formulaId is string => typeof formulaId === "string" && formulaId.length > 0);
}

function createFindingSummary(statement: F5StatementLike, cpk: number | undefined): string {
  if (typeof cpk === "number") {
    return `${formatLabel(statement.content?.entryId ?? statement.statementId ?? "finding")} requires review. Current Cpk ${cpk.toFixed(2)}.`;
  }
  return `${formatLabel(statement.content?.entryId ?? statement.statementId ?? "finding")} requires review.`;
}

function worksheetStatus(worksheetName: string, input: ReviewProjectionInput, hasFindings: boolean): string {
  const optimization = input.f6Report?.worksheets?.find((item) => item.worksheetName === worksheetName);
  if (optimization?.runStatus !== undefined) {
    return optimization.runStatus.toLowerCase();
  }
  if (hasFindings) {
    return "review_required";
  }
  return "completed";
}

function countFindingsForWorksheet(input: ReviewProjectionInput, worksheetName: string): number {
  const interpretation = input.f5Report?.worksheets?.find((item) => item.worksheetName === worksheetName);
  return (interpretation?.statements ?? []).filter((statement) => statement.type === "SIGNAL" && statement.content?.requiresEngineeringReview === true).length;
}

function createAnalysisContext(worksheet: F5WorksheetLike | undefined): ReviewCard | undefined {
  const items = [
    ...(worksheet?.clarifications ?? []).map((item) => item.message).filter((item): item is string => typeof item === "string" && item.length > 0),
    ...(worksheet?.assumptions ?? []).map((item) => item.message).filter((item): item is string => typeof item === "string" && item.length > 0),
  ];
  return items.length === 0 ? undefined : { title: "Analysis Context", items };
}

function createOptimizationTargets(worksheet: F6WorksheetLike | undefined): ReviewCard | undefined {
  const items = [...new Set((worksheet?.options ?? [])
    .map((option) => option.targetId)
    .filter((targetId): targetId is string => typeof targetId === "string" && targetId.length > 0))];
  return items.length === 0 ? undefined : { title: "Optimization Targets", items };
}

function createOptionSummaries(worksheet: F6WorksheetLike | undefined): ReviewOptionSummary[] {
  return (worksheet?.options ?? []).map((option) => {
    const deltaCpk = option.expectedMetrics?.deltaCpk
      ?? calculateDelta(option.baselineMetrics?.cpk, option.resultMetrics?.cpk)
      ?? calculateDelta(option.expectedMetrics?.baselineCpk, option.expectedMetrics?.scenarioCpk);
    return {
      optionId: option.optionId ?? option.label ?? "option",
      label: option.label ?? option.title ?? option.policyContext?.optionCode ?? formatLabel(option.optionId ?? "option"),
      status: option.status ?? "unknown",
      ...(deltaCpk === undefined ? {} : { deltaCpk }),
      summary: option.summary ?? option.targetId ?? "Validated option summary unavailable.",
    };
  });
}

function calculateDelta(before: number | undefined, after: number | undefined): number | undefined {
  return typeof before === "number" && typeof after === "number" ? after - before : undefined;
}

function formatLabel(value: string): string {
  const normalized = value.replace(/[-_]+/g, " ").trim();
  if (normalized.length === 0) {
    return value;
  }
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
