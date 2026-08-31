import type { WorksheetSelectionPrompt } from "@ai-assist/contracts";

export interface AutoEntryDecision {
  readonly kind: "confirm_initial_scope";
  readonly workbookHash: string;
  readonly worksheetNames: readonly string[];
}

export function createAutoEntryDecision(prompt: WorksheetSelectionPrompt): AutoEntryDecision | undefined {
  const allNames = prompt.options.map(({ worksheetName }) => worksheetName);
  if (allNames.some((worksheetName) => worksheetName.trim().length === 0) || new Set(allNames).size !== allNames.length) return undefined;
  const worksheetNames = prompt.options
    .filter(({ worksheetKind }) => worksheetKind === "analysis")
    .map(({ worksheetName }) => worksheetName);
  return worksheetNames.length === 0
    ? undefined
    : { kind: "confirm_initial_scope", workbookHash: prompt.workbook.contentHash, worksheetNames };
}
