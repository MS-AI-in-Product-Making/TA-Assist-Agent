import { loadInternalToleranceGuidance, loadKnowledgeBase } from "@ai-assist/knowledge-base";
import { normalizeDistribution } from "./distribution-normalization.js";

const INTERNAL_CONTEXT_REQUIRED = new Set([
  "sheetmetal",
  "sheet metal",
  "die cast",
  "diecast",
  "die cut",
  "diecut",
  "pcb",
  "fpc",
  "plastic",
  "injection molding",
]);

type Distribution = "normal" | "uniform" | "triangular" | "trapezoidal" | "elliptical" | "beta";

export interface F0CapabilityRow {
  readonly partCategory: string;
  readonly factorName: string;
  readonly partName: string;
  readonly nominalValue: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly distribution: string;
}

interface F0Dependencies {
  readonly publicKnowledgeBase: { matchCapabilityItem(request: unknown): unknown };
  readonly internalGuidance: { assessToleranceGuidance(request: unknown): unknown };
}

export type F0CapabilityAssessment =
  | { readonly capabilityStatus: "internal_within_guidance" | "internal_guidance_exceeded"; readonly f0KnowledgeBaseVersion: "internal-v1"; readonly recommendation: { readonly kind: "internal-guidance"; readonly assessedTotalBand: number; readonly maximumRecommendedTotalBand: number; readonly unit: "mm"; readonly matchedEntryId: string; readonly fallbackApplied: boolean; readonly evidence: { readonly sourceFileHash: string; readonly sheetName: string; readonly sourceRange: string } } }
  | { readonly capabilityStatus: "f0_information_insufficient"; readonly f0KnowledgeBaseVersion: "internal-v1"; readonly f0InformationReason: "missing_process_context" | "invalid_total_band" | "guidance_unknown" }
  | { readonly capabilityStatus: "in_library_recommended" | "in_library_tolerance_outside" | "in_library_distribution_differs" | "in_library_tolerance_and_distribution_differ"; readonly f0KnowledgeBaseVersion: "v1"; readonly recommendation: { readonly kind: "public"; readonly toleranceMin: number; readonly toleranceMax: number; readonly unit: "mm"; readonly distribution: Distribution; readonly capabilityEntryId: string } }
  | { readonly capabilityStatus: "non_f0_process_category" };

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function normalizedCategory(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function internalAssessment(result: unknown): F0CapabilityAssessment {
  const value = record(result);
  if (value?.status !== "within-guidance" && value?.status !== "guidance-exceeded") {
    return { capabilityStatus: "f0_information_insufficient", f0KnowledgeBaseVersion: "internal-v1", f0InformationReason: "guidance_unknown" };
  }
  const assessed = record(value.assessedTotalBand);
  const maximum = record(value.maximumRecommendedTotalBand);
  const evidence = record(value.evidence);
  return {
    capabilityStatus: value.status === "within-guidance" ? "internal_within_guidance" : "internal_guidance_exceeded",
    f0KnowledgeBaseVersion: "internal-v1",
    recommendation: {
      kind: "internal-guidance",
      assessedTotalBand: assessed?.value as number,
      maximumRecommendedTotalBand: maximum?.value as number,
      unit: "mm",
      matchedEntryId: value.matchedEntryId as string,
      fallbackApplied: value.fallbackApplied as boolean,
      evidence: {
        sourceFileHash: evidence?.sourceFileHash as string,
        sheetName: evidence?.sheetName as string,
        sourceRange: evidence?.sourceRange as string,
      },
    },
  };
}

function publicAssessment(result: unknown, row: F0CapabilityRow, totalBand: number): F0CapabilityAssessment {
  const value = record(result);
  if (value?.status !== "matched") return { capabilityStatus: "non_f0_process_category" };
  const capability = record(value.capabilityEntry)!;
  const toleranceMin = capability.toleranceMin as number;
  const toleranceMax = capability.toleranceMax as number;
  const recommendedDistribution = capability.recommendedDistribution as Distribution;
  const toleranceMatches = totalBand >= toleranceMin && totalBand <= toleranceMax;
  const distributionMatches = normalizeDistribution(row.distribution) === recommendedDistribution;
  return {
    capabilityStatus: toleranceMatches
      ? distributionMatches ? "in_library_recommended" : "in_library_distribution_differs"
      : distributionMatches ? "in_library_tolerance_outside" : "in_library_tolerance_and_distribution_differ",
    f0KnowledgeBaseVersion: "v1",
    recommendation: {
      kind: "public",
      toleranceMin,
      toleranceMax,
      unit: "mm",
      distribution: recommendedDistribution,
      capabilityEntryId: capability.entryId as string,
    },
  };
}

export function createF0CapabilityRouter(dependencies: F0Dependencies = {
  publicKnowledgeBase: loadKnowledgeBase({ version: "v1" }),
  internalGuidance: loadInternalToleranceGuidance({ version: "internal-v1" }),
}) {
  return {
    assess(row: F0CapabilityRow): F0CapabilityAssessment {
      const category = normalizedCategory(row.partCategory);
      const totalBand = row.upperTolerance - row.lowerTolerance;
      if (category === "cnc") {
        if (!Number.isFinite(totalBand) || totalBand <= 0) {
          return { capabilityStatus: "f0_information_insufficient", f0KnowledgeBaseVersion: "internal-v1", f0InformationReason: "invalid_total_band" };
        }
        return internalAssessment(dependencies.internalGuidance.assessToleranceGuidance({
          processFamily: "cnc-machining",
          featureType: "linear-dimension",
          nominalValue: Math.abs(row.nominalValue),
          nominalUnit: "mm",
          tolerance: { representation: "total-band", value: totalBand, unit: "mm" },
        }));
      }
      if (INTERNAL_CONTEXT_REQUIRED.has(category)) {
        return { capabilityStatus: "f0_information_insufficient", f0KnowledgeBaseVersion: "internal-v1", f0InformationReason: "missing_process_context" };
      }
      return publicAssessment(dependencies.publicKnowledgeBase.matchCapabilityItem({
        partCategory: row.partCategory,
        factorName: row.factorName,
        partName: row.partName,
      }), row, totalBand);
    },
  };
}
