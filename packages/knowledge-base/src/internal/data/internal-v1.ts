import type {
  InternalToleranceGuidanceEntry,
  InternalToleranceGuidanceSourceMetadata,
} from "@ai-assist/contracts";
import { contentHash } from "../../validation.js";
import type { InternalKnowledgeSeedPackage } from "../types.js";

export function createReviewedInternalV1SeedPackage(): InternalKnowledgeSeedPackage {
  const entries: InternalToleranceGuidanceEntry[] = [];
  const sources: InternalToleranceGuidanceSourceMetadata[] = [];
  const add = (input: Omit<InternalToleranceGuidanceEntry, "provenance"> & {
    readonly sourceId: string;
    readonly sourceFile: string;
    readonly sourceFileHash: string;
    readonly sheetName: string;
    readonly sourceRange: string;
  }) => {
    const source: InternalToleranceGuidanceSourceMetadata = {
      sourceId: input.sourceId,
      sourceFile: input.sourceFile,
      sourceFileHash: input.sourceFileHash,
      sourceVersion: "2026-07-28",
      sheetName: input.sheetName,
      sourceRange: input.sourceRange,
      classification: "internal",
    };
    sources.push(source);
    entries.push({
      entryId: input.entryId,
      processFamily: input.processFamily,
      featureType: input.featureType,
      ...(input.material === undefined ? {} : { material: input.material }),
      ...(input.nominalRange === undefined ? {} : { nominalRange: input.nominalRange }),
      maximumRecommendedTotalBand: input.maximumRecommendedTotalBand,
      fallbackPriority: input.fallbackPriority,
      ...(input.fallbackEntryId === undefined ? {} : { fallbackEntryId: input.fallbackEntryId }),
      ...(input.conditions === undefined ? {} : { conditions: input.conditions }),
      capabilityTier: input.capabilityTier,
      provenance: {
        ...source,
        owner: "internal-knowledge-steward",
        confidence: 0.6,
        effectiveVersion: "internal-v1",
        changeSummary: "Reviewed internal tolerance guidance published on 2026-07-28.",
      },
    });
  };
  const sourceFiles = {
    cnc: ["CNC_Tolerance_Capability_Matrix_KB_with_with_Fallback_Rule_V01_20260728.xlsx", "453e3b2210450c33bac48db3374abe616ac6ceb95f510e845b25445e7af6ea01", "ISO 2768-1 Class m"],
    dieCast: ["Die_Cast_Tolerance_Capability_Matrix_KB_with_Fallback_Rule_V01_20260728.xlsx", "8696db22e8b2cf834b1a2adccc6e564c1810ad4aed39dd688c9420bf87a475a8", "DCTG Table"],
    dieCut: ["Die_Cut_Capability_Matrix_KB_V01_20260728.xlsx", "d99b6a17924ad3372b49a95d8fb9afea32ca25407b8ec7ae9af763f5ebef9ba8", "Capability Matrix"],
    pcbFpc: ["PCB_FPC_Typical_Manufacturing_Capability_KB_V01_20260728.xlsx", "5099f2a6ed30dba481f480b35d3c70402655e60c870508c3b1f8940f148cd360", "Capability Matrix"],
    plastic: ["Plastic_Injection_Molding_Tolerance_Capability_KB_with_Fallback_Rule_V01_20260728.xlsx", "2da082ba4c95440eead347c0e92a37db621ac31f4ccc4a0ff8ba0454d68a4927", "Dimensional Tolerances"],
    sheetMetal: ["Sheet_Metal_Tolerance_Capability_Matrix_KB_with_Fallback_Rule_V01_20260728.xlsx", "f758615c9f5c12abb062511153d2b7cece668afe8cdf387dc39059673cd3af5f", "Formed Stampings Linear"],
  } as const;
  const range = (min: number, max: number, minInclusive = true) => ({ min, minInclusive, max, maxInclusive: true, unit: "mm" as const });
  const thicknessRange = (min: number, max: number, minInclusive = true) => ({ min, minInclusive, max, maxInclusive: true });
  const addSourceRule = (
    sourceKey: keyof typeof sourceFiles,
    row: number,
    sourceRange: string,
    rule: Omit<Parameters<typeof add>[0], "sourceId" | "sourceFile" | "sourceFileHash" | "sheetName" | "sourceRange">,
  ) => {
    const [sourceFile, sourceFileHash, sheetName] = sourceFiles[sourceKey];
    add({ ...rule, sourceId: `${sourceKey}-${row}-${rule.entryId}`, sourceFile, sourceFileHash, sheetName, sourceRange });
  };

  [[0.5, 3, 0.2], [3, 6, 0.2], [6, 30, 0.4], [30, 120, 0.6], [120, 400, 1], [400, 1000, 1.6], [1000, 2000, 2.4], [2000, 4000, 4]].forEach(([min, max, band], index) => addSourceRule("cnc", index + 5, `A${index + 5}:F${index + 5}`, { entryId: `cnc-linear-${index + 5}`, processFamily: "cnc-machining", featureType: "linear-dimension", nominalRange: range(min!, max!, index === 0), maximumRecommendedTotalBand: { value: band!, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T3" }));
  [[0, 10, 0.52], [10, 16, 0.54], [16, 25, 0.58], [25, 40, 0.64], [40, 63, 0.7], [63, 100, 0.78], [100, 160, 0.88], [160, 250, 1], [250, 400, 1.1], [400, 630, 1.2], [630, 1000, 1.4]].forEach(([min, max, band], index) => addSourceRule("dieCast", index + 6, `A${index + 6}:E${index + 6}`, { entryId: `die-cast-dctg6-${index + 6}`, processFamily: "die-casting", featureType: "linear-dimension", nominalRange: range(min!, max!, index === 0), conditions: { processMethod: "pressure-die-casting", toleranceGrade: "DCTG6" }, maximumRecommendedTotalBand: { value: band!, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T3" }));
  const dieCutRows: Array<[string, string, number]> = [["general-die-cut", "outline-profile", 0.3], ["general-die-cut", "internal-cutout", 0.3], ["general-die-cut", "hole-diameter", 0.2], ["general-die-cut", "hole-position", 0.3], ["general-die-cut", "slot-width", 0.2], ["general-die-cut", "slot-position", 0.3], ["foam", "outline-profile", 0.4], ["foam", "hole-slot-position", 0.4], ["psa-tape", "outline-profile", 0.3], ["psa-tape", "hole-slot-position", 0.3], ["graphite-sheet", "outline-profile", 0.3], ["graphite-sheet", "hole-slot-position", 0.3], ["emi-shielding", "outline-profile", 0.3], ["emi-shielding", "hole-slot-position", 0.3], ["pet-mylar-film", "outline-profile", 0.2], ["pet-mylar-film", "hole-slot-position", 0.2], ["fabric-mesh", "outline-profile", 0.4], ["fabric-mesh", "hole-slot-position", 0.4], ["rubber-silicone-sponge-gasket", "outline-profile", 0.4], ["rubber-silicone-sponge-gasket", "hole-slot-position", 0.4]];
  dieCutRows.forEach(([materialFamily, featureType, band], index) => { const rows = [11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32, 33, 35, 36]; const row = rows[index]!; addSourceRule("dieCut", row, `A${row}:J${row}`, { entryId: `die-cut-${materialFamily}-${featureType}-${row}`, processFamily: "die-cutting", featureType, conditions: { materialFamily }, maximumRecommendedTotalBand: { value: band, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T3" }); });
  const pcbRows: Array<[number, "pcb" | "fpc", string, number]> = [[12, "pcb", "thin-board-thickness", 0.1], [13, "pcb", "standard-board-thickness", 0.2], [15, "pcb", "outline", 0.2], [16, "pcb", "internal-cutout", 0.2], [17, "pcb", "finished-hole-diameter", 0.1], [18, "pcb", "hole-position", 0.15], [19, "pcb", "hole-to-hole-position", 0.15], [20, "pcb", "slot-width", 0.1], [21, "pcb", "slot-position", 0.15], [22, "pcb", "outline-to-copper", 0.2], [23, "pcb", "component-pad-to-copper", 0.2], [24, "pcb", "component-pad-to-outline", 0.4], [26, "fpc", "ultra-thin-thickness", 0.04], [27, "fpc", "thin-thickness", 0.06], [28, "fpc", "outline", 0.3], [29, "fpc", "internal-cutout", 0.3], [30, "fpc", "finished-hole-diameter", 0.1], [31, "fpc", "hole-position", 0.2], [33, "fpc", "slot-position", 0.3], [34, "fpc", "outline-to-copper", 0.4], [35, "fpc", "connector-or-smd-pad-to-copper", 0.2], [36, "fpc", "connector-or-smd-pad-to-outline", 0.5], [37, "fpc", "stiffener-to-outline", 0.8]];
  pcbRows.forEach(([row, processMethod, featureType, band]) => addSourceRule("pcbFpc", row, `A${row}:J${row}`, { entryId: `pcb-fpc-${processMethod}-${featureType}-${row}`, processFamily: "pcb-fpc", featureType, conditions: { processMethod }, maximumRecommendedTotalBand: { value: band, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T3" }));
  [[1, 3, 0.24], [3, 6, 0.36], [6, 10, 0.44], [10, 18, 0.52], [18, 30, 0.62], [30, 50, 0.74], [50, 80, 1.14], [80, 120, 1.6], [120, 180, 1.86], [180, 250, 2.1], [250, 315, 2.3], [315, 400, 3.2], [400, 500, 4.4], [500, 630, 5], [630, 800, 5.6], [800, 1000, 6.2]].forEach(([min, max, band], index) => { const row = index + 118; addSourceRule("plastic", row, `A${row}:H${row}`, { entryId: `plastic-tg6-nw-${row}`, processFamily: "plastic-injection-molding", featureType: "linear-dimension", nominalRange: range(min!, max!, index === 0), conditions: { processMethod: "injection-molding", toleranceGrade: "TG6", dimensionType: "NW" }, maximumRecommendedTotalBand: { value: band!, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T3" }); });
  const sheetRanges = [[0, 6], [6, 10], [10, 25], [25, 63], [63, 160], [160, 400], [400, 1000], [1000, 2500]];
  const sheetBands = [[0.4, 0.6, 0.8, 1.2], [0.6, 0.8, 1, 1.6], [0.8, 1, 1.2, 1.6], [1, 1.2, 1.6, 2], [1.2, 1.6, 2, 2.4], [2, 2.4, 2.4, 3.2], [3.2, 3.2, 4, 4], [4.8, 6, 6, 8]];
  const thicknessBands = [[0, 1], [1, 3], [3, 6], [6, 10]];
  sheetRanges.forEach(([min, max], rangeIndex) => thicknessBands.forEach(([thicknessMin, thicknessMax], thicknessIndex) => { const row = 6 + rangeIndex * 2; const column = String.fromCharCode(67 + thicknessIndex); addSourceRule("sheetMetal", row, `A${row}:${column}${row}`, { entryId: `sheet-metal-formed-m-${row}-${column.toLowerCase()}`, processFamily: "sheet-metal", featureType: "linear-dimension", nominalRange: range(min!, max!, rangeIndex === 0), conditions: { processMethod: "formed-stamping", toleranceGrade: "m", thicknessMm: thicknessRange(thicknessMin!, thicknessMax!, thicknessIndex === 0) }, maximumRecommendedTotalBand: { value: sheetBands[rangeIndex]![thicknessIndex]!, unit: "mm" }, fallbackPriority: 0, capabilityTier: "T3" }); }));

  return {
    manifest: { contractVersion: "v1", knowledgeBaseVersion: "internal-v1", classification: "internal", releasedAt: "2026-07-28", changeSummary: "Reviewed internal tolerance guidance snapshot from six controlled capability matrices.", sourceCount: sources.length, entryCount: entries.length, sourcesContentHash: contentHash(sources), entriesContentHash: contentHash(entries) },
    sources,
    entries,
  };
}