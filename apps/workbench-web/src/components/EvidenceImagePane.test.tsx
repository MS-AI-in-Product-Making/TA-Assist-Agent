import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EvidenceImagePane } from "./EvidenceImagePane.js";

afterEach(cleanup);

describe("EvidenceImagePane", () => {
  it("renders the authenticated F1 image and focused factor context", () => {
    render(<EvidenceImagePane {...({
      worksheetName: "Analysis-A",
      imageUrl: "/api/sessions/s/artifacts/f1-image%3Ahash?disposition=inline",
      focusedLabel: "C boss height · C-bucket",
      analysisTarget: {
        description: "Display gap loop",
        designNominal: { actual: -0.05, display: "-0.050", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53" },
        lowerSpecLimit: { actual: -0.1, display: "-0.100", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54" },
        upperSpecLimit: { actual: 0.1, display: "0.100", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55" },
        unit: "mm",
      },
    } as any)} />);
    const image = screen.getByRole("img", { name: "Analysis-A tolerance loop stack-up" });
    expect(image).toHaveAttribute("src", expect.stringContaining("f1-image"));
    expect(image).toHaveAttribute("width", "1600");
    expect(image).toHaveAttribute("height", "900");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("C boss height · C-bucket")).toBeVisible();
    expect(screen.getByText("Tolerance Loop Description")).toBeVisible();
    expect(screen.getByText("Display gap loop")).toBeVisible();
    expect(screen.getByText("Design Nominal")).toBeVisible();
    expect(screen.getByText("-0.050 mm")).toBeVisible();
    expect(screen.getByText("Upper Spec Limit")).toBeVisible();
    expect(screen.getByText("0.100 mm")).toBeVisible();
    expect(screen.getByText("Lower Spec Limit")).toBeVisible();
    expect(screen.getByText("-0.100 mm")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByTestId("evidence-image-stage")).toHaveStyle({ "--evidence-scale": "1.25" });
  });

  it("shows a governed load-error message and resets it when imageUrl changes", () => {
    const { rerender } = render(<EvidenceImagePane {...({
      worksheetName: "Analysis-A",
      imageUrl: "/api/sessions/s/artifacts/f1-image%3Ahash-a?disposition=inline",
      analysisTarget: {
        description: "Display gap loop",
        designNominal: { actual: -0.05, display: "-0.050", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53" },
        lowerSpecLimit: { actual: -0.1, display: "-0.100", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54" },
        upperSpecLimit: { actual: 0.1, display: "0.100", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55" },
        unit: "mm",
      },
    } as any)} />);

    fireEvent.error(screen.getByRole("img", { name: "Analysis-A tolerance loop stack-up" }));
    expect(screen.getByText("The governed image artifact could not be loaded.")).toBeVisible();
    expect(screen.getByText("Refresh this session or rerun workbook analysis.")).toBeVisible();

    rerender(<EvidenceImagePane {...({
      worksheetName: "Analysis-A",
      imageUrl: "/api/sessions/s/artifacts/f1-image%3Ahash-b?disposition=inline",
      analysisTarget: {
        description: "Display gap loop",
        designNominal: { actual: -0.05, display: "-0.050", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53" },
        lowerSpecLimit: { actual: -0.1, display: "-0.100", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54" },
        upperSpecLimit: { actual: 0.1, display: "0.100", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55" },
        unit: "mm",
      },
    } as any)} />);

    expect(screen.queryByText("The governed image artifact could not be loaded.")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Analysis-A tolerance loop stack-up" })).toHaveAttribute("src", expect.stringContaining("hash-b"));
  });

  it("shows an actionable missing-image state", () => {
    render(<EvidenceImagePane {...({
      worksheetName: "Analysis-B",
      analysisTarget: {
        description: "Not available",
        descriptionReason: "Tolerance loop description is missing from the worksheet evidence.",
        designNominal: { display: "Not available", reason: "Worksheet system specification is unavailable." },
        lowerSpecLimit: { display: "Not available", reason: "Worksheet system specification is unavailable." },
        upperSpecLimit: { display: "Not available", reason: "Worksheet system specification is unavailable." },
        unit: "mm",
      },
    } as any)} />);
    expect(screen.getByText("This worksheet is missing a tolerance loop stack-up image")).toBeVisible();
    expect(screen.getAllByText("Not available").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Tolerance loop description is missing from the worksheet evidence.")).toBeVisible();
    expect(screen.getAllByText("Worksheet system specification is unavailable.")).toHaveLength(3);
  });
});
