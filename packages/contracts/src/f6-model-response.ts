import { z } from "zod";
import { f5MultimodalArtifactV3Schema } from "./ta-multimodal-contracts.js";

export const f6ModelInterpretationResponseSchema = z.object({
  contractVersion: z.literal("f6-model-interpretation-response-v1"),
  model: z.object({ modelId: z.string().trim().min(1), supportsImage: z.literal(true) }).strict(),
  worksheets: z.array(z.object({
    worksheetName: z.string().trim().min(1),
    imageTableInterpretation: z.string().trim().min(1),
    rows: z.array(z.object({
      sourceRow: z.number().int().positive(),
      visibleStatus: z.literal("visible"),
      interpretation: z.string().trim().min(1),
    }).strict()).min(1),
  }).strict()).min(1),
}).strict();

export function modelResponseMatchesInterpretation(responseValue: unknown, interpretationValue: unknown, workbook: { fileName: string; contentHash: string }): boolean {
  const response = f6ModelInterpretationResponseSchema.safeParse(responseValue);
  const interpretation = f5MultimodalArtifactV3Schema.safeParse(interpretationValue);
  if (!response.success || !interpretation.success) return false;
  const workbookContentHash = workbook.contentHash;
  const artifact = interpretation.data;
  if (artifact.workbookContentHash !== workbookContentHash
    || response.data.worksheets.length !== artifact.worksheets.length) return false;
  return response.data.worksheets.every((sheet, index) => {
    const accepted = artifact.worksheets[index]!;
    const result = accepted.result;
    if (sheet.worksheetName !== artifact.selectedWorksheetNames[index]
      || sheet.worksheetName !== result.worksheetName
      || accepted.request.workbook.fileName !== workbook.fileName
      || accepted.request.workbook.contentHash !== workbookContentHash
      || result.workbookContentHash !== workbookContentHash
      || response.data.model.modelId !== result.model.modelId
      || response.data.model.supportsImage !== result.model.supportsImage
      || sheet.imageTableInterpretation !== result.imageTableInterpretation
      || sheet.rows.length !== result.rowMappings.length
      || new Set(sheet.rows.map((row) => row.sourceRow)).size !== sheet.rows.length) return false;
    return sheet.rows.every((row) => {
      const mapping = result.rowMappings.find((candidate) => candidate.sourceRow === row.sourceRow);
      return mapping?.visibleStatus === row.visibleStatus && mapping.interpretation === row.interpretation;
    });
  });
}
