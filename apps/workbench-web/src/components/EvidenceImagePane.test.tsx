import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EvidenceImagePane } from "./EvidenceImagePane.js";

describe("EvidenceImagePane", () => {
  it("renders the authenticated F1 image and focused factor context", () => {
    render(<EvidenceImagePane {...({
      worksheetName: "Analysis-A",
      imageUrl: "/api/sessions/s/artifacts/f1-image%3Ahash?disposition=inline",
      focusedLabel: "C boss height · C-bucket",
      analysisTarget: {
        description: "Display gap loop",
        nominal: -0.05,
        nominalDisplay: "-0.050",
        upperTolerance: 0.1,
        upperToleranceDisplay: "0.100",
        lowerTolerance: -0.1,
        lowerToleranceDisplay: "-0.100",
        unit: "mm",
      },
    } as any)} />);
    expect(screen.getByRole("img", { name: "Analysis-A tolerance loop stack-up" })).toHaveAttribute("src", expect.stringContaining("f1-image"));
    expect(screen.getByText("C boss height · C-bucket")).toBeVisible();
    expect(screen.getByText("Tolerance loop description")).toBeVisible();
    expect(screen.getByText("Display gap loop")).toBeVisible();
    expect(screen.getByText("Target nominal")).toBeVisible();
    expect(screen.getByText("-0.050 mm")).toBeVisible();
    expect(screen.getByText("Upper tolerance")).toBeVisible();
    expect(screen.getByText("0.100 mm")).toBeVisible();
    expect(screen.getByText("Lower tolerance")).toBeVisible();
    expect(screen.getByText("-0.100 mm")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByTestId("evidence-image-stage")).toHaveStyle({ "--evidence-scale": "1.25" });
  });

  it("shows an actionable missing-image state", () => {
    render(<EvidenceImagePane {...({
      worksheetName: "Analysis-B",
      analysisTarget: {
        description: "Not available",
        descriptionReason: "Tolerance loop description is missing from the worksheet evidence.",
        nominalDisplay: "Not available",
        nominalReason: "Worksheet system specification is unavailable.",
        upperToleranceDisplay: "Not available",
        upperToleranceReason: "Worksheet system specification is unavailable.",
        lowerToleranceDisplay: "Not available",
        lowerToleranceReason: "Worksheet system specification is unavailable.",
        unit: "mm",
      },
    } as any)} />);
    expect(screen.getByText("This worksheet is missing a tolerance loop stack-up image")).toBeVisible();
    expect(screen.getAllByText("Not available").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Tolerance loop description is missing from the worksheet evidence.")).toBeVisible();
    expect(screen.getAllByText("Worksheet system specification is unavailable.")).toHaveLength(3);
  });
});
