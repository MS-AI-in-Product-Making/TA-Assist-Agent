import type {
  InternalToleranceGuidanceEntry,
  InternalToleranceGuidanceSourceMetadata,
} from "@ai-assist/contracts";
import { contentHash } from "../validation.js";
import type { InternalKnowledgeSeedPackage } from "./types.js";

export function createInternalSeedPackage(): InternalKnowledgeSeedPackage {
  const sources: InternalToleranceGuidanceSourceMetadata[] = [
    {
      sourceId: "internal-source-cnc-a", sourceFile: "anonymized-cnc-capability-source-a", sourceFileHash: contentHash("internal-source-cnc-a"), sourceVersion: "2026-q3", sheetName: "capability-data", sourceRange: "A1:H12", classification: "internal",
    },
    {
      sourceId: "internal-source-forming-b", sourceFile: "anonymized-forming-capability-source-b", sourceFileHash: contentHash("internal-source-forming-b"), sourceVersion: "2026-q3", sheetName: "capability-data", sourceRange: "A1:H12", classification: "internal",
    },
  ];
  const provenance = (source: InternalToleranceGuidanceSourceMetadata, confidence: number) => ({
    ...source, owner: "internal-knowledge-steward", confidence, effectiveVersion: "internal-v1" as const, changeSummary: "Anonymized internal capability guidance.",
  });
  const entries: InternalToleranceGuidanceEntry[] = [
    { entryId: "internal-cnc-diameter-aluminum", processFamily: "cnc-machining", featureType: "diameter", material: "aluminum", nominalRange: { min: 5, max: 10, unit: "mm" }, maximumRecommendedTotalBand: { value: 0.2, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T2", provenance: provenance(sources[0]!, 0.8) },
    { entryId: "internal-cnc-slot-steel", processFamily: "cnc-machining", featureType: "slot", material: "steel", nominalRange: { min: 2, max: 8, unit: "mm" }, maximumRecommendedTotalBand: { value: 0.15, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T2", provenance: provenance(sources[0]!, 0.8) },
    { entryId: "internal-sheet-bend-carbon-steel", processFamily: "sheet-metal", featureType: "bend", material: "carbon-steel", maximumRecommendedTotalBand: { value: 0.5, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T1", provenance: provenance(sources[1]!, 0.75) },
    { entryId: "internal-cnc-diameter-aluminum-fallback", processFamily: "cnc-machining", featureType: "diameter", material: "aluminum", nominalRange: { min: 5, max: 10, unit: "mm" }, maximumRecommendedTotalBand: { value: 0.25, unit: "mm" }, fallbackPriority: 1, capabilityTier: "T2", provenance: provenance(sources[0]!, 0.8) },
  ];

  return {
    manifest: { contractVersion: "v1", knowledgeBaseVersion: "internal-v1", classification: "internal", releasedAt: "2026-07-28", changeSummary: "Anonymized internal tolerance guidance snapshot.", sourceCount: sources.length, entryCount: entries.length, sourcesContentHash: contentHash(sources), entriesContentHash: contentHash(entries) },
    sources: structuredClone(sources),
    entries: structuredClone(entries),
  };
}export {
	createInternalToleranceGuidance,
	createInternalToleranceGuidanceFromEntries,
} from "./query.js";