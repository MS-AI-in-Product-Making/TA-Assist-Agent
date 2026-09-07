import { createHash } from "node:crypto";

import {
  f5MultimodalWorksheetPairV3Schema,
  f5MultimodalWorksheetRequestV3Schema,
  type F5MultimodalWorksheetRequestV3,
  type F5MultimodalWorksheetResultV3,
} from "@ai-assist/contracts";

interface MultimodalModel {
  readonly id: string;
  readonly supportsImage?: boolean;
  sendRequest(messages: readonly unknown[]): Promise<{ readonly text: AsyncIterable<string> }>;
}

export interface WorksheetMultimodalModelDependencies {
  readonly request: F5MultimodalWorksheetRequestV3;
  readonly models: readonly MultimodalModel[];
  fetchImage(): Promise<{ readonly bytes: Uint8Array; readonly mediaType: string }>;
  createImagePart(bytes: Uint8Array, mediaType: string): unknown;
  createTextPart(text: string): unknown;
  createUserMessage(content: readonly unknown[]): unknown;
}

export type WorksheetMultimodalExecution =
  | { readonly status: "completed"; readonly outcome: { readonly kind: "worksheet_multimodal_response"; readonly result: F5MultimodalWorksheetResultV3 } }
  | { readonly status: "blocked"; readonly reason: "model_capability_unavailable" | "ordinal_mapping_unavailable" }
  | { readonly status: "failed"; readonly error: { readonly code: "image_identity_mismatch" | "model_result_invalid" | "image_read_failed" | "model_execution_failed" } };

export async function executeWorksheetMultimodalModel(
  dependencies: WorksheetMultimodalModelDependencies,
): Promise<WorksheetMultimodalExecution> {
  const parsedRequest = f5MultimodalWorksheetRequestV3Schema.safeParse(dependencies.request);
  if (!parsedRequest.success) return failed("model_result_invalid");
  const request = parsedRequest.data;
  const model = dependencies.models.find(({ supportsImage }) => supportsImage === true);
  if (model === undefined) return { status: "blocked", reason: "model_capability_unavailable" };

  let image: Awaited<ReturnType<WorksheetMultimodalModelDependencies["fetchImage"]>>;
  try {
    image = await dependencies.fetchImage();
  } catch {
    return failed("image_read_failed");
  }
  const imageHash = createHash("sha256").update(image.bytes).digest("hex");
  if (image.mediaType !== request.image.mediaType
    || detectImageMediaType(image.bytes) !== request.image.mediaType
    || image.bytes.byteLength !== request.image.byteLength
    || imageHash !== request.image.contentHash) {
    return failed("image_identity_mismatch");
  }

  const content = [
    dependencies.createImagePart(image.bytes, request.image.mediaType),
    dependencies.createTextPart(buildStructuredPrompt(request, model.id)),
  ];
  let response: { readonly text: AsyncIterable<string> };
  try {
    response = await model.sendRequest([dependencies.createUserMessage(content)]);
  } catch {
    return model.supportsImage === false
      ? { status: "blocked", reason: "model_capability_unavailable" }
      : failed("model_execution_failed");
  }

  let responseText = "";
  try {
    for await (const chunk of response.text) responseText += chunk;
  } catch {
    return failed("model_execution_failed");
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(responseText);
  } catch {
    return failed("model_result_invalid");
  }
  if (isOrdinalMappingBlocker(candidate)) return { status: "blocked", reason: "ordinal_mapping_unavailable" };
  const pair = f5MultimodalWorksheetPairV3Schema.safeParse({ request, result: candidate });
  if (!pair.success || pair.data.result.model.modelId !== model.id) return failed("model_result_invalid");
  return { status: "completed", outcome: { kind: "worksheet_multimodal_response", result: pair.data.result } };
}

function buildStructuredPrompt(request: F5MultimodalWorksheetRequestV3, modelId: string): string {
  return JSON.stringify({
    instruction: "Interpret the attached worksheet image together with every Factor row. Return only one JSON object matching f5-multimodal-result-v3 when every exact factorOrdinal is visibly mapped. Map every row by worksheetName, tableId, sourceRow, and exact factorOrdinal, with visibleStatus=visible. If any ordinal is not visible or is ambiguous, return exactly {\"status\":\"blocked\",\"reason\":\"ordinal_mapping_unavailable\"}. Do not infer unseen image evidence.",
    requiredResultIdentity: {
      contractVersion: "f5-multimodal-result-v3",
      outputClassification: "confidential",
      requestHash: request.requestHash,
      sessionId: request.sessionId,
      revision: request.revision,
      inputRevision: request.inputRevision,
      workbookContentHash: request.workbook.contentHash,
      worksheetName: request.worksheetName,
      tableId: request.tableId,
      imageContentHash: request.image.contentHash,
      model: { modelId, supportsImage: true },
    },
    completeFactorTable: request.factorRows,
  });
}

function failed(code: "image_identity_mismatch" | "model_result_invalid" | "image_read_failed" | "model_execution_failed"): WorksheetMultimodalExecution {
  return { status: "failed", error: { code } };
}

function detectImageMediaType(bytes: Uint8Array): "image/png" | "image/jpeg" | undefined {
  if (bytes.byteLength >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return undefined;
}

function isOrdinalMappingBlocker(value: unknown): boolean {
  return typeof value === "object" && value !== null
    && (value as { readonly status?: unknown }).status === "blocked"
    && (value as { readonly reason?: unknown }).reason === "ordinal_mapping_unavailable"
    && Object.keys(value).length === 2;
}
