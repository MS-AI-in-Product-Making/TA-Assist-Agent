import {
  f7ReportProjectionSchema,
  f7SessionSnapshotSchema,
  type F7ReportProjection,
  type F7ReportSpecificationInputOrigins,
  type F7ReportSpecificationSourceCells,
  type F7SessionSnapshot,
} from "@ai-assist/contracts";

type ReportWithoutMarkdown = Omit<F7ReportProjection, "markdown">;

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

  return [
    "# F7 Report",
    "",
    "## Assessment",
    "",
    `**${report.assessment}**`,
    "",
    "This statistical assessment is not a design or production release decision and does not confirm physical root cause.",
    "",
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
      ? "normal" as const
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