import type { ApprovedCapabilityMatrixSource } from "../import-capability-matrices.js";

const source = (
  sourceId: string,
  sourceFile: string,
  sourceFileHash: string,
  sheetName: string,
  entryIdPrefix: string,
): ApprovedCapabilityMatrixSource => ({
  sourceId,
  sourceFile,
  sourceFileHash,
  sourceVersion: "2026-07-28",
  sheetName,
  entryIdPrefix,
  owner: "internal-knowledge-steward",
  confidence: 0.6,
  effectiveVersion: "internal-v1",
  capabilityTier: "T3",
  changeSummary: "Reviewed internal tolerance guidance published on 2026-07-28.",
});

const approvedCapabilityMatrixSources: Readonly<Record<string, ApprovedCapabilityMatrixSource>> = Object.freeze({
  "cnc-20260728": source("cnc-20260728", "CNC_Tolerance_Capability_Matrix_KB_with_with_Fallback_Rule_V01_20260728.xlsx", "453e3b2210450c33bac48db3374abe616ac6ceb95f510e845b25445e7af6ea01", "ISO 2768-1 Class m", "cnc-linear"),
  "die-cast-20260728": source("die-cast-20260728", "Die_Cast_Tolerance_Capability_Matrix_KB_with_Fallback_Rule_V01_20260728.xlsx", "8696db22e8b2cf834b1a2adccc6e564c1810ad4aed39dd688c9420bf87a475a8", "DCTG Table", "die-cast-dctg6"),
  "die-cut-20260728": source("die-cut-20260728", "Die_Cut_Capability_Matrix_KB_V01_20260728.xlsx", "d99b6a17924ad3372b49a95d8fb9afea32ca25407b8ec7ae9af763f5ebef9ba8", "Capability Matrix", "die-cut"),
  "pcb-fpc-20260728": source("pcb-fpc-20260728", "PCB_FPC_Typical_Manufacturing_Capability_KB_V01_20260728.xlsx", "5099f2a6ed30dba481f480b35d3c70402655e60c870508c3b1f8940f148cd360", "Capability Matrix", "pcb-fpc"),
  "plastic-20260728": source("plastic-20260728", "Plastic_Injection_Molding_Tolerance_Capability_KB_with_Fallback_Rule_V01_20260728.xlsx", "2da082ba4c95440eead347c0e92a37db621ac31f4ccc4a0ff8ba0454d68a4927", "Dimensional Tolerances", "plastic-tg6-nw"),
  "sheet-metal-20260728": source("sheet-metal-20260728", "Sheet_Metal_Tolerance_Capability_Matrix_KB_with_Fallback_Rule_V01_20260728.xlsx", "f758615c9f5c12abb062511153d2b7cece668afe8cdf387dc39059673cd3af5f", "Formed Stampings Linear", "sheet-metal-formed-m"),
});

export function getApprovedCapabilityMatrixSource(sourceId: string): ApprovedCapabilityMatrixSource | undefined {
  return approvedCapabilityMatrixSources[sourceId];
}