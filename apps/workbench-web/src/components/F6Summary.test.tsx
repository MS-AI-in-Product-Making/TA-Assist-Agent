import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { F6Summary } from "./F6Summary.js";

it("shows F6 status, counts, and worksheet outcomes", () => {
  render(<F6Summary report={{ runStatus: "COMPLETED", summary: { worksheetCount: 1, completedWorksheetCount: 1, partiallyCompletedWorksheetCount: 0, inputRejectedWorksheetCount: 0, candidateOptionCount: 2, completedOptionCount: 1, insufficientEvidenceOptionCount: 0, calculationFailedOptionCount: 0 }, worksheets: [{ worksheetName: "Analysis-A", runStatus: "COMPLETED", options: [{}, {}] }] } as never} />);
  expect(screen.getByRole("region", { name: "Optimization summary" })).toHaveTextContent("COMPLETED");
  expect(screen.getByText("Analysis-A")).toBeVisible();
  expect(screen.getByText("2 Candidates")).toBeVisible();
});
