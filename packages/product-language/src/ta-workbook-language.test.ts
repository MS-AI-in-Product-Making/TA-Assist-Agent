import { describe, expect, it } from "vitest";
import { projectTaWorkbookStage, TA_WORKBOOK_STAGES, TA_WORKBOOK_WORKFLOW } from "./ta-workbook-language.js";

describe("TA workbook language", () => {
  it("provides stable workflow stages for product surfaces", () => {
    expect(TA_WORKBOOK_WORKFLOW).toBe("TA Workbook Analysis");
    expect(TA_WORKBOOK_STAGES).toEqual([
      "prepare_workbook",
      "validate_analysis_inputs",
      "review_dimension_traceability",
      "calculate_and_interpret",
      "evaluate_and_publish",
    ]);
    expect(projectTaWorkbookStage("f3_running")).toBe("review_dimension_traceability");
    expect(projectTaWorkbookStage("completed")).toBe("evaluate_and_publish");
  });
});
