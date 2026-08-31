import { describe, expect, it } from "vitest";

import type { WorksheetSelectionPrompt } from "@ai-assist/contracts";

import { createAutoEntryDecision } from "./auto-entry.js";

const HASH = "a".repeat(64);

describe("createAutoEntryDecision", () => {
  it("selects only analysis worksheets in workbook order", () => {
    expect(createAutoEntryDecision(prompt([
      option(1, "Title", "example_or_template"),
      option(2, "Analysis-A", "analysis"),
      option(3, "Analysis-B", "analysis"),
    ]))).toEqual({ kind: "confirm_initial_scope", workbookHash: HASH, worksheetNames: ["Analysis-A", "Analysis-B"] });
  });

  it("requires user recovery when no analysis worksheet exists", () => {
    expect(createAutoEntryDecision(prompt([option(1, "Title", "example_or_template")]))).toBeUndefined();
  });
});

function option(selectionIndex: number, worksheetName: string, worksheetKind: "analysis" | "example_or_template") {
  return {
    selectionIndex,
    worksheetName,
    toleranceLoopDescription: `${worksheetName} loop`,
    worksheetKind,
    source: "auto_summary" as const,
  };
}

function prompt(options: ReturnType<typeof option>[]): WorksheetSelectionPrompt {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "selectionRequired",
    workbook: { fileName: "anonymous.xlsx", contentHash: HASH },
    options,
  };
}
