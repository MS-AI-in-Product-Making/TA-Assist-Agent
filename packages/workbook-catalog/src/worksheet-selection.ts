import {
  createTypedError,
  worksheetSelectionConfirmationSchema,
  worksheetSelectionConfirmationResultSchema,
  worksheetSelectionPromptSchema,
  worksheetSelectionViewRequestSchema,
  worksheetSelectionViewResultSchema,
  type WorksheetSelectionConfirmationResult,
  type WorksheetSelectionPrompt,
  type WorksheetSelectionViewResult,
} from "@ai-assist/contracts";

const REQUEST_SUMMARY = "Worksheet-selection view request is invalid.";
const POLICY_SUMMARY = "Worksheet-selection view input is not permitted.";

function selectionError(summary: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide a supported confidential worksheet-selection view request.",
    affectedInputReferences: ["workbook-catalog"],
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

export function createWorksheetSelectionView(request: unknown): WorksheetSelectionViewResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw selectionError(REQUEST_SUMMARY);
  }
  if (typeof classification === "string" && classification !== "confidential") {
    throw selectionError(POLICY_SUMMARY, "policy_denied");
  }

  const parsed = worksheetSelectionViewRequestSchema.safeParse(request);
  if (!parsed.success) throw selectionError(REQUEST_SUMMARY);

  const { workbookCatalog } = parsed.data;
  const result = worksheetSelectionViewResultSchema.safeParse({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: {
      fileName: workbookCatalog.workbook.fileName,
      classification: workbookCatalog.workbook.classification,
      contentHash: workbookCatalog.workbook.contentHash,
      revision: workbookCatalog.workbook.metadata.revision,
      date: workbookCatalog.workbook.metadata.date,
    },
    worksheets: workbookCatalog.analyses.map((analysis, index) => ({
      selectionIndex: index + 1,
      worksheetName: analysis.worksheetName,
      toleranceLoopDescription: analysis.toleranceLoopDescription,
      source: analysis.source,
    })),
  });
  if (!result.success) throw selectionError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(result.data));
}

function worksheetKind(worksheetName: string): "analysis" | "example_or_template" {
  return /^(?:example(?:[_ -]?ta)?|ta[_ -]?template)$/i.test(worksheetName.trim())
    ? "example_or_template"
    : "analysis";
}

export function createWorksheetSelectionPrompt(request: unknown): WorksheetSelectionPrompt {
  const view = createWorksheetSelectionView(request);
  const result = worksheetSelectionPromptSchema.safeParse({
    contractVersion: view.contractVersion,
    inputClassification: view.inputClassification,
    status: "selectionRequired",
    workbook: {
      fileName: view.workbook.fileName,
      contentHash: view.workbook.contentHash,
    },
    options: view.worksheets.map((worksheet) => ({
      ...worksheet,
      worksheetKind: worksheetKind(worksheet.worksheetName),
    })),
  });
  if (!result.success) throw selectionError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(result.data));
}

export function validateWorksheetSelectionConfirmation(request: {
  readonly prompt: WorksheetSelectionPrompt;
  readonly confirmation: unknown;
}): WorksheetSelectionConfirmationResult {
  const prompt = worksheetSelectionPromptSchema.safeParse(request?.prompt);
  const confirmation = worksheetSelectionConfirmationSchema.safeParse(request?.confirmation);
  if (!prompt.success || !confirmation.success) {
    return deepFreeze(worksheetSelectionConfirmationResultSchema.parse({
      status: "rejected",
      reasonCode: "invalid_worksheet_selection",
    }));
  }
  if (confirmation.data.workbookContentHash !== prompt.data.workbook.contentHash) {
    return deepFreeze(worksheetSelectionConfirmationResultSchema.parse({
      status: "rejected",
      reasonCode: "stale_worksheet_selection",
    }));
  }
  if (confirmation.data.selectedWorksheetNames.length === 0) {
    return deepFreeze(worksheetSelectionConfirmationResultSchema.parse({
      status: "cancelled",
      reasonCode: "worksheet_selection_empty",
    }));
  }
  const options = new Set(prompt.data.options.map((option) => option.worksheetName));
  if (confirmation.data.selectedWorksheetNames.some((worksheetName) => !options.has(worksheetName))) {
    return deepFreeze(worksheetSelectionConfirmationResultSchema.parse({
      status: "rejected",
      reasonCode: "invalid_worksheet_selection",
    }));
  }
  return deepFreeze(worksheetSelectionConfirmationResultSchema.parse({
    status: "confirmed",
    workbookContentHash: confirmation.data.workbookContentHash,
    selectedWorksheetNames: confirmation.data.selectedWorksheetNames,
  }));
}
