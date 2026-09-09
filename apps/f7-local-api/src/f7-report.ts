import {
  f7ReportProjectionSchema,
  f7SessionSnapshotSchema,
  type F7ReportProjection,
  type F7ReportSpecificationInputOrigins,
  type F7ReportSpecificationSourceCells,
  type F7SessionSnapshot,
} from "@ai-assist/contracts";
import { loadInterpretationRules } from "@ai-assist/knowledge-base/interpretation-rules";
import { buildF7EngineeringNarrative } from "@ai-assist/product-language/f7-engineering-narrative";

type ReportWithoutMarkdown = Omit<F7ReportProjection, "markdown">;
type AvailableF7ReportAnalysis = Extract<NonNullable<F7ReportProjection["analysis"]>, { status: "available" }>;

function formatSigned(value: number, digits: number): string {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;
}

export function projectF7EngineeringNarrativeForReport(
  narrative: ReturnType<typeof buildF7EngineeringNarrative>,
): AvailableF7ReportAnalysis["narrative"] {
  return {
    resultJudgment: {
      status: narrative.resultJudgment.status,
      headline: narrative.resultJudgment.headline,
      judgment: narrative.resultJudgment.judgment,
      cpk: narrative.resultJudgment.cpk,
      targetCpk: narrative.resultJudgment.targetCpk,
      margin: narrative.resultJudgment.margin,
      display: {
        cpk: narrative.resultJudgment.display.cpk,
        targetCpk: narrative.resultJudgment.display.targetCpk,
        margin: narrative.resultJudgment.display.margin,
      },
      ...(narrative.resultJudgment.nearerSpecificationSide === undefined
        ? {}
        : { nearerSpecificationSide: narrative.resultJudgment.nearerSpecificationSide }),
    },
    engineeringSummary: narrative.engineeringSummary,
    rootCauseAnalysis: narrative.rootCauseAnalysis.map((item) => ({
      ruleId: item.ruleId,
      title: item.title,
      hypothesis: true,
      explanation: item.narrative,
      completeEvidence: item.completeEvidence,
      ...(item.quantitativeEvidence === undefined
        ? {}
        : {
            quantitativeEvidence: Object.fromEntries(
              Object.entries(item.quantitativeEvidence).map(([key, value]) => [key, value]),
            ),
          }),
      ...(item.quantitativeEvidenceLabels === undefined
        ? {}
        : {
            quantitativeEvidenceLabels: Object.fromEntries(
              Object.entries(item.quantitativeEvidenceLabels).map(([key, value]) => [key, value]),
            ),
          }),
    })),
    engineeringRisk: narrative.engineeringRisk,
    suggestedActionSequence: narrative.suggestedActionSequence.map((item) => ({
      optionId: item.optionId,
      title: item.title,
      narrative: item.narrative,
      validationSteps: item.validationSteps.map((step) => step),
    })),
    validationRequirements: narrative.validationRequirements.map((step) => step),
    evidenceDisclosure: narrative.evidenceDisclosure,
  };
}

function createF0Analysis(
  snapshot: F7SessionSnapshot,
  simulation: F7SessionSnapshot["monteCarloResult"] & {},
): NonNullable<F7ReportProjection["analysis"]> {
  if (simulation.capability.status !== "available") {
    return {
      status: "unavailable",
      reason: "TA comparison is unavailable because Monte Carlo capability is not evaluable.",
      optimizationDirections: ["Resolve zero or invalid variation evidence, then rerun Monte Carlo capability."],
    };
  }

  let setupMean = 0;
  let setupStandardDeviation = 0;
  for (const factor of snapshot.factors) {
    if (factor.setup?.confirmed !== true || factor.evidence === undefined
      || !Number.isFinite(factor.evidence.calculatedMean)
      || !Number.isFinite(factor.evidence.oneSigma)
      || factor.evidence.oneSigma < 0) {
      return {
        status: "unavailable",
        reason: "Factor Setup comparison is unavailable because confirmed setup evidence is incomplete.",
        optimizationDirections: ["Complete and confirm Factor Setup evidence before comparing assumed and measured TA."],
      };
    }
    setupMean += factor.evidence.calculatedMean;
    setupStandardDeviation = Math.hypot(setupStandardDeviation, factor.evidence.oneSigma);
  }
  const shiftEvidence = snapshot.systemSpecification?.additionalMeanShift;
  if (shiftEvidence?.status !== "available" || setupStandardDeviation <= 0) {
    return {
      status: "unavailable",
      reason: "Factor Setup comparison is unavailable because mean-shift or variation evidence is incomplete.",
      optimizationDirections: ["Complete the system mean-shift and factor variation assumptions, then regenerate the report."],
    };
  }
  setupMean += shiftEvidence.valueOrigin === "defaulted" ? 0 : shiftEvidence.actualValue;
  const setupCp = (simulation.upperSpecLimit - simulation.lowerSpecLimit) / (6 * setupStandardDeviation);
  const setupCpk = Math.min(
    (simulation.upperSpecLimit - setupMean) / (3 * setupStandardDeviation),
    (setupMean - simulation.lowerSpecLimit) / (3 * setupStandardDeviation),
  );
  const monteCarlo = simulation.capability;
  const target = monteCarlo.targetCpk;
  const targetEvidence = snapshot.systemSpecification?.targetSigmaLevel;
  const targetSource = targetEvidence?.status === "available"
    && targetEvidence.valueOrigin === "defaulted"
    ? "template"
    : "project";
  const evaluation = loadInterpretationRules({ version: "interpretation-rules-v2" })
    .evaluateInterpretationRules({
      analysisDimension: "one-dimensional",
      method: "monte-carlo",
      facts: {
        cp: monteCarlo.cp,
        cpk: monteCarlo.cpk,
        targetCpk: { value: target, source: targetSource },
        mean: simulation.mean,
        lowerSpecLimit: simulation.lowerSpecLimit,
        upperSpecLimit: simulation.upperSpecLimit,
      },
    });
  const performanceRule = evaluation.status === "matched"
    ? evaluation.matchedRules.find(({ entryType }) => entryType === "performance-rule")
    : undefined;
  if (evaluation.knowledgeBaseVersion !== "interpretation-rules-v2"
    || evaluation.resolvedTargets?.cpk?.value !== target
    || evaluation.resolvedTargets.cpk.source !== targetSource
    || performanceRule === undefined || (
    performanceRule.entryId !== "performance-cpk"
    && performanceRule.entryId !== "performance-cpk-below-target"
  )) {
    return { status: "unavailable", reason: "The governed F0 Cpk interpretation rule is unavailable.", optimizationDirections: [] };
  }
  const meanDelta = simulation.mean - setupMean;
  const sigmaRelativeChange = (simulation.standardDeviation - setupStandardDeviation) / setupStandardDeviation;
  const cpDelta = monteCarlo.cp - setupCp;
  const cpkDelta = monteCarlo.cpk - setupCpk;
  const rootCauseRules = evaluation.matchedRules.filter(({ entryType }) => entryType === "root-cause-signal");
  const improvementRules = evaluation.matchedRules.filter(({ entryType }) => entryType === "improvement-option");
  const projectRule = (rule: (typeof evaluation.matchedRules)[number]) => ({
    ruleId: rule.entryId,
    title: rule.title,
    sourceAlias: rule.evidence.sourceAlias,
    sourceFileHash: rule.evidence.sourceFileHash,
  });
  const targetAssessment = monteCarlo.cpk >= target
    ? `Monte Carlo Cpk ${monteCarlo.cpk.toFixed(3)} meets the resolved target of ${target}.`
    : `Monte Carlo Cpk ${monteCarlo.cpk.toFixed(3)} is below the resolved target of ${target}.`;
  const interpretations = [
    `Mean changed from Setup ${setupMean.toFixed(4)} to Monte Carlo ${simulation.mean.toFixed(4)} (${formatSigned(meanDelta, 4)}).`,
    `Standard deviation changed from Setup ${setupStandardDeviation.toFixed(4)} to Monte Carlo ${simulation.standardDeviation.toFixed(4)} (${formatSigned(sigmaRelativeChange * 100, 1)}%).`,
    `Cp changed from Setup ${setupCp.toFixed(3)} to Monte Carlo ${monteCarlo.cp.toFixed(3)} (${formatSigned(cpDelta, 3)}).`,
    `Cpk changed from Setup ${setupCpk.toFixed(3)} to Monte Carlo ${monteCarlo.cpk.toFixed(3)} (${formatSigned(cpkDelta, 3)}); ${targetAssessment}`,
  ];
  const optimizationDirections = improvementRules.map(({ title }) => title);
  if (optimizationDirections.length === 0) {
    optimizationDirections.push("Maintain the current setup and verify capability remains stable with the next representative measurement sample.");
  }
  const narrative = projectF7EngineeringNarrativeForReport(buildF7EngineeringNarrative({
    evidenceBasis: "measured",
    method: "monte-carlo",
    cp: monteCarlo.cp,
    cpk: monteCarlo.cpk,
    targetCpk: target,
    mean: simulation.mean,
    lowerSpecLimit: simulation.lowerSpecLimit,
    upperSpecLimit: simulation.upperSpecLimit,
    rootCauseRules: rootCauseRules.map((rule) => ({ ruleId: rule.entryId, title: rule.title })),
    controlledOptions: improvementRules.map((rule) => ({
      ruleId: rule.entryId,
      title: rule.title,
      validationSteps: rule.validationSteps ?? [],
    })),
    contributors: [],
    knowledgeBaseVersion: evaluation.knowledgeBaseVersion,
  }));

  return {
    status: "available",
    provenance: {
      knowledgeBaseVersion: evaluation.knowledgeBaseVersion,
      ruleId: performanceRule.entryId,
      threshold: target,
      applicability: "one-dimensional interpretation applied to the resolved Monte Carlo capability result",
    },
    comparison: {
      setup: { mean: setupMean, standardDeviation: setupStandardDeviation, cp: setupCp, cpk: setupCpk },
      monteCarlo: {
        mean: simulation.mean,
        standardDeviation: simulation.standardDeviation,
        cp: monteCarlo.cp,
        cpk: monteCarlo.cpk,
      },
    },
    targetAssessment,
    interpretations,
    optimizationDirections,
    rootCauseSignals: rootCauseRules.map(projectRule),
    controlledOptions: improvementRules.map(projectRule),
    validationRequirements: [...new Set(improvementRules.flatMap(({ validationSteps }) => validationSteps ?? []))],
    narrative,
  };
}

export class F7ReportPrerequisiteError extends Error {
  readonly code = "F7_REPORT_PREREQUISITE_MISMATCH" as const;

  constructor(message: string) {
    super(message);
    this.name = "F7ReportPrerequisiteError";
  }
}

export function isF7ReportPrerequisiteError(error: unknown): error is F7ReportPrerequisiteError {
  return error instanceof F7ReportPrerequisiteError;
}

function escapeMarkdownTableText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\r\n|\r|\n/g, "<br>")
    .replace(/([`!*#_[\]()~])/g, "\\$1");
}

function renderValue(value: string | number): string {
  return escapeMarkdownTableText(String(value));
}

function renderNarrativeEvidence(item: AvailableF7ReportAnalysis["narrative"]["rootCauseAnalysis"][number]): string | undefined {
  if (item.quantitativeEvidence === undefined) {
    return undefined;
  }

  return Object.entries(item.quantitativeEvidence)
    .map(([key, value]) => `${item.quantitativeEvidenceLabels?.[key] ?? key}: ${String(value)}`)
    .map(escapeMarkdownTableText)
    .join("; ");
}

function renderMarkdown(report: ReportWithoutMarkdown): string {
  const capability = report.simulation.capability;
  const capabilityRows = capability.status === "available"
    ? [
        `| Cp | ${renderValue(capability.cp)} |`,
        `| Cpk | ${renderValue(capability.cpk)} |`,
      ]
    : ["| Cp | Not evaluable |", "| Cpk | Not evaluable |"];
  const factorRows = report.factors.map((factor) => (
    `| ${renderValue(factor.factorName)} | ${factor.loopCoefficient} | ${factor.sourceMode} | ${factor.approvedDistribution} | ${factor.sourceReferences.map(renderValue).join("<br>")} |`
  ));
  const specificationRows = (["lowerSpecLimit", "upperSpecLimit", "targetSigmaLevel"] as const)
    .map((field) => {
      const origin = report.evidence.specificationInputOrigins[field];
      const sourceCell = origin === "excel_source"
        ? report.evidence.specificationSourceCells[field]!
        : "Not applicable";
      return `| ${field} | ${origin} | ${sourceCell} |`;
    });
  const manifestRows = report.evidence.factorManifest.map((entry) => (
    `| ${entry.factorId} | ${entry.sourceMode} | ${entry.family} |`
  ));
  const analysisLines = report.analysis?.status === "available"
    ? [
        "## Factor Setup vs Monte Carlo TA",
        "",
        "| Metric | Factor Setup assumption | Measured-data Monte Carlo |",
        "| --- | ---: | ---: |",
        `| Mean | ${renderValue(report.analysis.comparison.setup.mean)} | ${renderValue(report.analysis.comparison.monteCarlo.mean)} |`,
        `| Standard deviation | ${renderValue(report.analysis.comparison.setup.standardDeviation)} | ${renderValue(report.analysis.comparison.monteCarlo.standardDeviation)} |`,
        `| Cp | ${renderValue(report.analysis.comparison.setup.cp)} | ${renderValue(report.analysis.comparison.monteCarlo.cp)} |`,
        `| Cpk | ${renderValue(report.analysis.comparison.setup.cpk)} | ${renderValue(report.analysis.comparison.monteCarlo.cpk)} |`,
        "",
        `**Assessment:** ${escapeMarkdownTableText(report.analysis.targetAssessment)}`,
        "",
        ...report.analysis.interpretations.map((item) => `- ${escapeMarkdownTableText(item)}`),
        "",
        "### Result Judgment",
        "",
        `**${escapeMarkdownTableText(report.analysis.narrative.resultJudgment.headline)}**`,
        "",
        `- Cpk: ${renderValue(report.analysis.narrative.resultJudgment.cpk)} (${renderValue(report.analysis.narrative.resultJudgment.display.cpk)})`,
        `- Target Cpk: ${renderValue(report.analysis.narrative.resultJudgment.targetCpk)} (${renderValue(report.analysis.narrative.resultJudgment.display.targetCpk)})`,
        `- Margin: ${renderValue(report.analysis.narrative.resultJudgment.margin)} (${renderValue(report.analysis.narrative.resultJudgment.display.margin)})`,
        ...(report.analysis.narrative.resultJudgment.nearerSpecificationSide === undefined
          ? []
          : [`- Nearer specification side: ${escapeMarkdownTableText(report.analysis.narrative.resultJudgment.nearerSpecificationSide)}`]),
        "",
        escapeMarkdownTableText(report.analysis.narrative.resultJudgment.judgment),
        "",
        `**Summary:** ${escapeMarkdownTableText(report.analysis.narrative.engineeringSummary)}`,
        "",
        "### Root Cause Analysis",
        "",
        ...(report.analysis.narrative.rootCauseAnalysis.length === 0
          ? ["No governed root-cause hypothesis matched."]
          : report.analysis.narrative.rootCauseAnalysis.flatMap((item) => [
              `- ${escapeMarkdownTableText(item.title)} (${escapeMarkdownTableText(item.ruleId)})`,
              `  Hypothesis: ${item.hypothesis ? "true" : "false"}.`,
              `  Explanation: ${escapeMarkdownTableText(item.explanation)}`,
              `  Evidence completeness: ${item.completeEvidence ? "complete" : "incomplete"}.`,
              ...(renderNarrativeEvidence(item) === undefined
                ? []
                : [`  Quantitative evidence: ${renderNarrativeEvidence(item)!}`]),
              "",
            ])),
        "",
        "### Engineering Risk",
        "",
        escapeMarkdownTableText(report.analysis.narrative.engineeringRisk),
        "",
        "### Suggested Action Sequence",
        "",
        ...(report.analysis.narrative.suggestedActionSequence.length === 0
          ? ["No controlled improvement action matched."]
          : report.analysis.narrative.suggestedActionSequence.map((item) => (
              `- ${escapeMarkdownTableText(item.title)} (${escapeMarkdownTableText(item.optionId)}): ${escapeMarkdownTableText(item.narrative)}`
            ))),
        "",
        "### Verification Requirements",
        "",
        ...report.analysis.narrative.validationRequirements.map((item) => `- ${escapeMarkdownTableText(item)}`),
        "",
        "### Evidence Disclosure",
        "",
        escapeMarkdownTableText(report.analysis.narrative.evidenceDisclosure),
        "",
      ]
    : [
        "## F0 Interpretation",
        "",
        report.analysis?.reason ?? "F0 analysis is unavailable.",
        "",
        ...(report.analysis?.optimizationDirections ?? []).map((item) => `- ${escapeMarkdownTableText(item)}`),
        "",
      ];

  return [
    "# F7 Report",
    "",
    "## Assessment",
    "",
    `**${report.assessment}**`,
    "",
    "This statistical assessment does not authorize design or production release and does not confirm physical root cause.",
    "",
    ...analysisLines,
    "## Key Metrics",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Mean | ${renderValue(report.summary.mean)} |`,
    `| Standard deviation | ${renderValue(report.summary.standardDeviation)} |`,
    `| Predicted yield | ${renderValue(report.summary.yield)} |`,
    `| Observed PPM | ${renderValue(report.summary.ppm)} |`,
    ...capabilityRows,
    `| Target Cpk | ${renderValue(report.summary.targetCpk)} |`,
    "",
    "## Monte Carlo Distribution",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Histogram method | ${report.simulation.histogram.methodId} |`,
    `| Histogram bin count | ${report.simulation.histogram.bins.length} |`,
    `| Normal fit method | ${report.simulation.normalFit.methodId} |`,
    "",
    "## Monte Carlo Summary",
    "",
    "| Field | Value |",
    "| --- | ---: |",
    `| Mean | ${renderValue(report.simulation.mean)} |`,
    `| Standard deviation | ${renderValue(report.simulation.standardDeviation)} |`,
    `| P0.135 | ${renderValue(report.simulation.quantiles.p00135)} |`,
    `| P1 | ${renderValue(report.simulation.quantiles.p01)} |`,
    `| P5 | ${renderValue(report.simulation.quantiles.p05)} |`,
    `| P50 | ${renderValue(report.simulation.quantiles.p50)} |`,
    `| P95 | ${renderValue(report.simulation.quantiles.p95)} |`,
    `| P99 | ${renderValue(report.simulation.quantiles.p99)} |`,
    `| P99.865 | ${renderValue(report.simulation.quantiles.p99865)} |`,
    `| Lower specification limit | ${renderValue(report.simulation.lowerSpecLimit)} |`,
    `| Upper specification limit | ${renderValue(report.simulation.upperSpecLimit)} |`,
    `| Iterations | ${report.simulation.iterations} |`,
    `| Correlation mode | ${report.simulation.correlationMode} |`,
    "",
    "## Factor Models",
    "",
    "| Factor | Loop coefficient | Source mode | Approved distribution | Source references |",
    "| --- | ---: | --- | --- | --- |",
    ...factorRows,
    "",
    "## Evidence Chain",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Workbook file | ${renderValue(report.workbook.fileName)} |`,
    `| Workbook content hash | ${report.evidence.workbookContentHash} |`,
    `| Worksheet | ${renderValue(report.evidence.worksheetName)} |`,
    `| Simulation method | ${report.evidence.methodIds.simulation} |`,
    `| Histogram method | ${report.evidence.methodIds.histogram} |`,
    `| Normal fit method | ${report.evidence.methodIds.normalFit} |`,
    `| Random seed | ${report.evidence.seed} |`,
    `| Iterations | ${report.evidence.iterations} |`,
    `| Generated at | ${renderValue(report.generatedAt)} |`,
    "",
    "### Specification Sources",
    "",
    "| Specification | Input origin | Source cell |",
    "| --- | --- | --- |",
    ...specificationRows,
    "",
    "### Factor Manifest",
    "",
    "| Factor ID | Source mode | Family |",
    "| --- | --- | --- |",
    ...manifestRows,
    "",
  ].join("\n");
}

export function createF7ReportProjection(
  snapshot: F7SessionSnapshot,
  generatedAt: string,
): F7ReportProjection {
  const parsedSnapshot = f7SessionSnapshotSchema.parse(snapshot);
  const simulation = parsedSnapshot.monteCarloResult;
  if (simulation === undefined) {
    throw new F7ReportPrerequisiteError("Monte Carlo result is required to generate an F7 report");
  }

  const worksheetName = parsedSnapshot.selectedWorksheetNames[0];
  if (worksheetName === undefined) {
    throw new Error("A selected worksheet is required to generate an F7 report");
  }
  if (parsedSnapshot.factors.length !== simulation.factorManifest.length) {
    throw new F7ReportPrerequisiteError("Simulation factor manifest does not match the current factors");
  }

  const manifestByFactorId = new Map(simulation.factorManifest.map((entry) => [entry.factorId, entry]));
  const factors = parsedSnapshot.factors.map((factorState) => {
    const evidence = factorState.evidence;
    const sourceMode = factorState.sourceMode;
    if (evidence === undefined || sourceMode === undefined) {
      throw new F7ReportPrerequisiteError("Current factor evidence is incomplete for the simulation manifest");
    }

    const approvedDistribution = sourceMode === "BASELINE_ASSUMPTION"
      ? evidence.baselineSampler.samplerId === "UNIFORM_BOUNDED_V1"
        ? "uniform" as const
        : "normal" as const
      : (() => {
          const approval = factorState.distributionApproval;
          const fitResult = factorState.distributionFitResult;
          const approvedCandidate = fitResult?.candidates.find((candidate) => candidate.family === approval?.family);
          if (approval === undefined
            || fitResult?.selectionDecision.proposedFinalFamily !== approval.family
            || approvedCandidate?.bootstrap.status !== "acceptable") {
            throw new F7ReportPrerequisiteError(
              "Measured factor must use its acceptable proposed and approved distribution",
            );
          }
          return approval.family;
        })();
    const manifestEntry = manifestByFactorId.get(evidence.factorId);
    if (manifestEntry === undefined
      || manifestEntry.sourceMode !== sourceMode
      || manifestEntry.family !== approvedDistribution) {
      throw new F7ReportPrerequisiteError("Simulation factor manifest does not match the current factor model");
    }

    const sourceReferences = [...new Set([
      ...Object.values(evidence.sourceCells),
      ...(sourceMode === "MEASURED" && factorState.input?.mode === "MEASURED"
        && factorState.input.dataset !== undefined
        ? [factorState.input.dataset.sourceReference]
        : []),
    ])];
    return {
      factorId: evidence.factorId,
      factorName: evidence.factorName,
      loopCoefficient: evidence.loopCoefficient,
      sourceMode,
      approvedDistribution,
      sourceReferences,
    };
  });

  const capability = simulation.capability;
  const assessment = capability.status === "not_available"
    ? "NOT_EVALUABLE" as const
    : capability.targetStatus === "meets_target"
      ? "MEETS_TARGET" as const
      : "BELOW_TARGET" as const;
  const specification = parsedSnapshot.systemSpecification;
  const specificationSourceCells: F7ReportSpecificationSourceCells = {};
  const specificationInputOrigins = {} as F7ReportSpecificationInputOrigins;
  for (const field of ["lowerSpecLimit", "upperSpecLimit", "targetSigmaLevel"] as const) {
    const value = specification?.[field];
    const origin = value?.status !== "available"
      ? "manual_entry"
      : simulation[field] === value.actualValue && value.sourceCell !== undefined
        ? "excel_source"
        : simulation[field] === value.actualValue
          ? "manual_entry"
          : "manual_override";
    specificationInputOrigins[field] = origin;
    if (origin === "excel_source" && value?.status === "available") {
      specificationSourceCells[field] = value.sourceCell;
    }
  }
  const reportWithoutMarkdown: ReportWithoutMarkdown = {
    contractId: "f7-report-v1",
    outputClassification: "confidential",
    sessionId: parsedSnapshot.sessionId,
    generatedAt,
    assessment,
    workbook: {
      fileName: parsedSnapshot.workbook.fileName,
      workbookContentHash: parsedSnapshot.workbook.workbookContentHash,
      worksheetName,
    },
    summary: {
      mean: simulation.mean,
      standardDeviation: simulation.standardDeviation,
      yield: simulation.yield,
      ppm: simulation.ppm,
      lowerSpecLimit: simulation.lowerSpecLimit,
      upperSpecLimit: simulation.upperSpecLimit,
      targetSigmaLevel: simulation.targetSigmaLevel,
      ...(capability.status === "available" ? { cp: capability.cp, cpk: capability.cpk } : {}),
      targetCpk: capability.targetCpk,
    },
    simulation,
    factors,
    analysis: createF0Analysis(parsedSnapshot, simulation),
    evidence: {
      workbookContentHash: parsedSnapshot.workbook.workbookContentHash,
      worksheetName,
      specificationSourceCells,
      specificationInputOrigins,
      methodIds: {
        simulation: simulation.methodId,
        histogram: simulation.histogram.methodId,
        normalFit: simulation.normalFit.methodId,
      },
      seed: simulation.runSeed,
      iterations: simulation.iterations,
      factorManifest: simulation.factorManifest,
    },
  };

  return f7ReportProjectionSchema.parse({
    ...reportWithoutMarkdown,
    markdown: renderMarkdown(reportWithoutMarkdown),
  });
}