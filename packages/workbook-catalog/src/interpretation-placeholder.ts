import {
  createTypedError,
  interpretationRequestSchema,
  interpretationResultSchema,
  type InterpretationRuleVersion,
  type InterpretationResult,
} from "@ai-assist/contracts";
import { loadInterpretationRules } from "@ai-assist/knowledge-base";

const REQUEST_SUMMARY = "Interpretation request is invalid.";
const POLICY_SUMMARY = "Interpretation input is not permitted.";
const PREREQUISITE_SUMMARY = "Interpretation calculation evidence is not ready.";

const REQUIRED_FORMULA_IDS: Readonly<Record<string, string>> = {
  "capability.cpk": "cpk-v1",
  "capability.cp": "cp-v1",
  "system.rssSigma": "rss-v1",
  "capability.totalDpm": "dpm-total-v1",
  "capability.yield": "yield-v1",
  "capability.lowerZ": "z-lower-v1",
  "capability.upperZ": "z-upper-v1",
};

function requiredFormulaId(outputField: string): string | undefined {
  return /^factors\[(?:0|[1-9]\d*)\]\.contribution$/.test(outputField)
    ? "contribution-v1"
    : REQUIRED_FORMULA_IDS[outputField];
}

function requestError(
  summary: string,
  code: "validation_error" | "policy_denied" | "prerequisite_not_ready" = "validation_error",
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide valid confidential controlled references.",
    affectedInputReferences: ["interpretation-request-v1"],
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

function createResult(value: unknown): InterpretationResult {
  const parsed = interpretationResultSchema.safeParse(value);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(parsed.data));
}

type InterpretationRuleLoader = typeof loadInterpretationRules;

function createInterpretationWithRules(
  request: unknown,
  loadRules: InterpretationRuleLoader,
  interpretationVersion: InterpretationRuleVersion,
): InterpretationResult {
  let parsed: ReturnType<typeof interpretationRequestSchema.safeParse> | undefined;
  let policyDenied = false;
  try {
    const classification = (request as { inputClassification?: unknown })?.inputClassification;
    policyDenied = typeof classification === "string" && classification !== "confidential";
    if (!policyDenied) parsed = interpretationRequestSchema.safeParse(request);
  } catch {
    throw requestError(REQUEST_SUMMARY);
  }
  if (policyDenied) {
    throw requestError(POLICY_SUMMARY, "policy_denied");
  }
  if (parsed === undefined || !parsed.success) throw requestError(REQUEST_SUMMARY);
  const calculation = parsed.data.calculationResult;
  const tracesByOutputField = new Map<string, typeof calculation.traceRecords>();
  for (const traceRecord of calculation.traceRecords) {
    const traces = tracesByOutputField.get(traceRecord.outputField);
    if (traces === undefined) {
      tracesByOutputField.set(traceRecord.outputField, [traceRecord]);
    } else {
      traces.push(traceRecord);
    }
  }
  const requiredOutputFields = [
    "capability.cpk",
    "capability.cp",
    "system.rssSigma",
    "capability.totalDpm",
    "capability.yield",
    "capability.lowerZ",
    "capability.upperZ",
    ...calculation.factors.map((_, index) => `factors[${index}].contribution`),
  ];
  if (requiredOutputFields.some((outputField) => {
    const traces = tracesByOutputField.get(outputField);
    return traces?.length !== 1 || traces[0]?.formulaId !== requiredFormulaId(outputField);
  })) {
    throw requestError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
  }
  const traceFor = (outputField: string) => tracesByOutputField.get(outputField) ?? [];
  const formulaFact = (
    statementId: string,
    section: string,
    metric: string,
    value: number,
    outputField: string,
  ) => ({
    statementId,
    type: "FACT",
    section,
    content: {
      metric,
      value,
      provenanceKind: "formula_output",
      outputField,
      traceRecords: traceFor(outputField),
    },
  });
  const inputFact = (
    statementId: string,
    metric: string,
    value: number,
    inputField: string,
  ) => ({
    statementId,
    type: "FACT",
    section: metric === "target_sigma" ? "calculation-summary" : "capability-vs-specification",
    content: { metric, value, provenanceKind: "calculation_input", inputField },
  });
  const factorFacts = calculation.factors.map((factor, index) => {
    const outputField = `factors[${index}].contribution`;
    return {
      statementId: `fact-factor-contribution-${index + 1}`,
      type: "FACT",
      section: "major-contributors",
      content: {
        metric: "factor_contribution",
        factorReference: `${factor.source.worksheetName}/${factor.source.tableId}/${factor.source.sourceRow}`,
        contributionPercent: factor.contribution * 100,
        provenanceKind: "formula_output",
        outputField,
        traceRecords: traceFor(outputField),
      },
    };
  });
  const facts = [
    formulaFact("fact-cpk", "capability-vs-specification", "cpk", calculation.capability.cpk, "capability.cpk"),
    formulaFact("fact-cp", "calculation-summary", "cp", calculation.capability.cp, "capability.cp"),
    formulaFact("fact-rss-sigma", "calculation-summary", "rss_sigma", calculation.system.rssSigma, "system.rssSigma"),
    formulaFact("fact-total-dpm", "calculation-summary", "total_dpm", calculation.capability.totalDpm, "capability.totalDpm"),
    formulaFact("fact-yield", "calculation-summary", "yield", calculation.capability.yield, "capability.yield"),
    inputFact("fact-lower-spec-limit", "lower_spec_limit", calculation.capability.lowerSpecLimit, "capability.lowerSpecLimit"),
    inputFact("fact-upper-spec-limit", "upper_spec_limit", calculation.capability.upperSpecLimit, "capability.upperSpecLimit"),
    inputFact("fact-target-cpk", "target_cpk", calculation.capability.targetCpk, "capability.targetCpk"),
    inputFact("fact-target-sigma", "target_sigma", calculation.capability.targetSigmaLevel, "capability.targetSigmaLevel"),
    {
      statementId: "fact-recommended-method",
      type: "FACT",
      section: "calculation-summary",
      content: {
        metric: "recommended_method",
        ...calculation.recommendation,
        provenanceKind: "calculation_input",
        inputField: "recommendation.method",
      },
    },
    {
      statementId: "fact-achieved-sigma",
      type: "FACT",
      section: "calculation-summary",
      content: {
        metric: "achieved_sigma",
        value: Math.min(calculation.capability.lowerZ, calculation.capability.upperZ),
        provenanceKind: "derived_from_formula_outputs",
        sourceOutputFields: ["capability.lowerZ", "capability.upperZ"],
        traceRecords: [
          ...traceFor("capability.lowerZ"),
          ...traceFor("capability.upperZ"),
        ],
      },
    },
    ...factorFacts,
  ];

  const evaluation = calculation.recommendation.method === "rss_1d"
    ? loadRules({ version: interpretationVersion })
      .evaluateInterpretationRules({
        analysisDimension: "one-dimensional",
        method: "rss",
        facts: {
          cp: calculation.capability.cp,
          cpk: calculation.capability.cpk,
          targetCpk: { value: calculation.capability.targetCpk, source: "project" },
          mean: calculation.system.mean,
          lowerSpecLimit: calculation.capability.lowerSpecLimit,
          upperSpecLimit: calculation.capability.upperSpecLimit,
          achievedSigma: Math.min(calculation.capability.lowerZ, calculation.capability.upperZ),
          targetSigma: { value: calculation.capability.targetSigmaLevel, source: "project" },
          contributors: calculation.factors.map((factor) => ({
            reference: `${factor.source.worksheetName}/${factor.source.tableId}/${factor.source.sourceRow}`,
            contributionPercent: factor.contribution * 100,
          })),
        },
      })
    : {
      knowledgeBaseVersion: interpretationVersion,
      status: "not-applicable" as const,
      resolvedTargets: {},
      factsUsed: [],
      matchedRules: [],
      missingFacts: [],
    };
  const derivedStatements = evaluation.matchedRules.map((matched) => {
    const common = {
      statementId: `${matched.entryType}-${matched.entryId}`,
      content: {
        entryId: matched.entryId,
        effectiveVersion: matched.effectiveVersion,
        applicability: structuredClone(matched.applicability),
        relatedFactReferences: matched.relatedFactReferences,
        evidence: matched.evidence,
      },
    };
    if (matched.entryType === "performance-rule") {
      return { ...common, type: "RULE", section: "capability-vs-specification" };
    }
    if (matched.entryType === "root-cause-signal") {
      return {
        ...common,
        type: "SIGNAL",
        section: "major-contributors",
        content: { ...common.content, requiresEngineeringReview: true },
      };
    }
    return {
      ...common,
      type: "OPTION",
      section: "parallel-options",
      content: { ...common.content, rank: null },
    };
  });

  return createResult({
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F5.1",
    status: "completed",
    interpretationVersion: "objective-interpretation-v1",
    projectReference: calculation.projectReference,
    runReference: calculation.runReference,
    workbookContentHash: calculation.workbookContentHash,
    worksheetSelection: calculation.worksheetSelection,
    calculationVersion: calculation.calculationVersion,
    knowledgeBaseVersion: evaluation.knowledgeBaseVersion,
    ruleEvaluationStatus: evaluation.status,
    statements: [...facts, ...derivedStatements],
    clarifications: [
      {
        clarificationId: "clarification-drawing-evidence-not-evaluated",
        reasonCode: "drawing_evidence_not_evaluated",
        message: "Drawing and structural evidence were not evaluated.",
        scopes: [
          "tolerance_loop_closure",
          "datum_chain",
          "assembly_datum_face",
          "stack_start",
          "direction",
          "cross_subsystem",
        ],
      },
      ...(evaluation.status === "not-applicable" ? [{
        clarificationId: "clarification-rule-method-not-applicable",
        reasonCode: "rule_method_not_applicable",
        message: "The recommended calculation method is outside the RSS interpretation rule scope.",
      }] : []),
      ...(evaluation.status === "insufficient-facts" ? [{
        clarificationId: "clarification-rule-facts-insufficient",
        reasonCode: "rule_facts_insufficient",
        message: "The interpretation rules require additional calculation facts.",
        missingFacts: evaluation.missingFacts,
      }] : []),
      ...(calculation.recommendation.method === "refer_3d_variation_analysis" ? [{
        clarificationId: "clarification-three-dimensional-follow-up-required",
        reasonCode: "three_dimensional_follow_up_required",
        message: "Three-dimensional variation analysis follow-up is required.",
      }] : []),
    ],
  });
}

export function createInterpretationService({
  loadRules = loadInterpretationRules,
  interpretationVersion = "interpretation-rules-v2",
}: {
  loadRules?: InterpretationRuleLoader;
  interpretationVersion?: InterpretationRuleVersion;
} = {}): (request: unknown) => InterpretationResult {
  return (request) => createInterpretationWithRules(request, loadRules, interpretationVersion);
}

const defaultInterpretationService = createInterpretationService();

export function createInterpretation(request: unknown): InterpretationResult {
  return defaultInterpretationService(request);
}

export const createInterpretationPlaceholder = createInterpretation;