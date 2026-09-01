import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { F6Summary } from "./F6Summary.js";

it("shows optimization status, counts, and worksheet outcomes", () => {
  render(<F6Summary report={{ runStatus: "COMPLETED", summary: { worksheetCount: 1, completedWorksheetCount: 1, partiallyCompletedWorksheetCount: 0, inputRejectedWorksheetCount: 0, candidateOptionCount: 2, completedOptionCount: 1, insufficientEvidenceOptionCount: 0, calculationFailedOptionCount: 0 }, worksheets: [{ worksheetName: "Analysis-A", runStatus: "COMPLETED", options: [{}, {}] }] } as never} />);
  expect(screen.getByRole("region", { name: "Optimization summary" })).toHaveTextContent("COMPLETED");
  expect(screen.getByText("Governed options overview")).toBeVisible();
  expect(screen.getByText("Analysis-A")).toBeVisible();
  expect(screen.getByText("2 Candidates")).toBeVisible();
});

it("does not render internal feature identifiers on the summary surface", () => {
  render(<F6Summary report={{ runStatus: "COMPLETED", summary: { worksheetCount: 1, completedWorksheetCount: 1, partiallyCompletedWorksheetCount: 0, inputRejectedWorksheetCount: 0, candidateOptionCount: 2, completedOptionCount: 1, insufficientEvidenceOptionCount: 0, calculationFailedOptionCount: 0 }, worksheets: [{ worksheetName: "Analysis-A", runStatus: "COMPLETED", options: [{}, {}] }] } as never} />);
  expect(screen.getAllByRole("region", { name: "Optimization summary" }).every((region) => !/\bF[0-7]\b/.test(region.textContent ?? ""))).toBe(true);
});
