import { f6OptimizationTargetsSchema, f8ScenarioDraftSchema, type F8ScenarioDraft } from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";

import {
  applyScenarioPatch,
  createToleranceTargetsPreview,
  resetDraft,
  saveDraft,
  undoScenarioPatch,
} from "./scenario-draft.js";

const BASELINE = {
  workbookContentHash: "a".repeat(64),
  baselineRunReference: "f4-run-a",
  calculationVersion: "excel-ta-v1" as const,
  projectReference: "project-a",
  worksheetName: "Analysis-A",
  tableId: "table-a",
  factor: {
    worksheetName: "Analysis-A",
    tableId: "table-a",
    sourceRow: 2,
    factorName: "Length",
    unit: "mm",
    nominalValue: 0,
    upperTolerance: 1,
    lowerTolerance: -1,
    additionalMeanShift: 0,
  },
};

function draft(): F8ScenarioDraft {
  return {
    contractVersion: "f8-scenario-draft-v1",
    draftId: "draft-a",
    sessionId: "session-a",
    worksheetName: "Analysis-A",
    inputRevision: 3,
    status: "draft",
    mode: "WHAT_IF",
    baselineWorkbookHash: BASELINE.workbookContentHash,
    baselineRunReference: BASELINE.baselineRunReference,
    change: { upperTolerance: 0.8 },
  };
}

describe("scenario draft", () => {
  it("applies one immutable patch and supports undo and baseline reset", () => {
    const original = draft();
    const patched = applyScenarioPatch(original, { lowerTolerance: -0.7 });

    expect(patched).toMatchObject({ status: "draft", change: { upperTolerance: 0.8, lowerTolerance: -0.7 } });
    expect(original.change).toEqual({ upperTolerance: 0.8 });
    expect(undoScenarioPatch(patched, original)).toEqual(original);
    expect(resetDraft(patched, BASELINE)).toMatchObject({
      status: "draft",
      change: { nominalValue: 0, upperTolerance: 1, lowerTolerance: -1, additionalMeanShift: 0 },
    });
  });

  it("saves the patch and calculation reference without publishing an artifact", () => {
    const saved = saveDraft(draft(), {
      calculationReference: "what-if:attempt-1",
      expectedInputRevision: 3,
    });
    expect(saved).toMatchObject({
      status: "saved",
      inputRevision: 3,
      calculationReference: "what-if:attempt-1",
    });
    expect(f8ScenarioDraftSchema.parse(saved)).toEqual(saved);
    expect(() => saveDraft(draft(), {
      calculationReference: "what-if:late",
      expectedInputRevision: 4,
    })).toThrow(/revision/i);
  });

  it("creates only tolerance targets under the existing F6 contract", () => {
    const preview = createToleranceTargetsPreview(draft(), BASELINE);
    expect(f6OptimizationTargetsSchema.parse(preview)).toEqual(preview);
    expect(preview).toMatchObject({
      contractVersion: "v1",
      targetVersion: "f6-optimization-targets-v1",
      worksheets: [{ targets: [{ targetType: "factor_tolerance", upperTolerance: 0.8, lowerTolerance: -1 }] }],
    });
    expect(createToleranceTargetsPreview({ ...draft(), draftId: "draft-b" }, BASELINE).worksheets[0]?.targets[0]?.targetId)
      .toBe(preview.worksheets[0]?.targets[0]?.targetId);
  });

  it.each([
    [{ nominalValue: 0.1 }, /nominal/i],
    [{ additionalMeanShift: 0.1 }, /mean shift/i],
  ])("rejects non-tolerance promotion changes", (change, message) => {
    expect(() => createToleranceTargetsPreview({ ...draft(), change }, BASELINE)).toThrow(message);
  });

  it("rejects promotion when tolerances do not differ from baseline", () => {
    expect(() => createToleranceTargetsPreview({ ...draft(), change: { upperTolerance: 1, lowerTolerance: -1 } }, BASELINE)).toThrow(/differ/i);
  });
});
