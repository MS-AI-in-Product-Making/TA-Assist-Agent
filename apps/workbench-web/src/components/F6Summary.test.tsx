import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { F6Summary } from "./F6Summary.js";

afterEach(cleanup);

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

it("renders current v3 results as four governed sequential steps", () => {
  render(<F6Summary selectedWorksheetName="Analysis-A" report={{
    optimizationVersion: "f6-optimization-v3",
    interactionLanguage: { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-1", source: "workflow_start", fallbackUsed: false },
    runStatus: "COMPLETED",
    summary: { worksheetCount: 1, completedWorksheetCount: 1, clarificationRequiredWorksheetCount: 0, candidateOptionCount: 0, completedOptionCount: 1, calculationFailedOptionCount: 0 },
    worksheets: [{
      worksheetName: "Analysis-A",
      runStatus: "COMPLETED",
      steps: [
        { step: "centerAssessment", status: "aligned", adjustedMean: 0, specificationMidpoint: 0, offset: 0 },
        { step: "contributorPriorities", priorities: [{ rank: 1, factor: { factorName: "Factor A" }, contribution: 0.7, guidance: "tighten_tolerance" }] },
        { step: "specificationChanges", proposals: [], clarifications: [] },
        { step: "toleranceOptimization", policyId: "f6-top3-tolerance-policy-v1", trigger: { lowerCpk: 0.8, upperCpk: 1.2, targetCpk: 1, failedSides: ["lowerCpk"] }, options: [{ optionCode: "OP1", status: "completed", reductionRatios: [0.25], reductions: [{ factor: { factorName: "Factor A" }, rank: 1, reductionRatio: 0.25, scale: 0.75 }], resultMetrics: { cpk: 1.1 } }] },
      ],
    }],
  } as never} />);

  const region = screen.getByRole("region", { name: "Optimization summary" });
  expect(region).toHaveTextContent("Center assessment");
  expect(region).toHaveTextContent("Contributor priorities");
  expect(region).toHaveTextContent("Specification changes");
  expect(region).toHaveTextContent("Tolerance optimization");
  expect(region).toHaveTextContent("OP1");
  expect(region).toHaveTextContent("1 Completed options");
  const content = region.textContent ?? "";
  expect(content.indexOf("Center assessment")).toBeLessThan(content.indexOf("Contributor priorities"));
  expect(content.indexOf("Contributor priorities")).toBeLessThan(content.indexOf("Specification changes"));
  expect(content.indexOf("Specification changes")).toBeLessThan(content.indexOf("Tolerance optimization"));
  expect(content).not.toMatch(/candidate/i);
});
