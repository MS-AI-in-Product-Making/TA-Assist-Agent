import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { F7Placeholder } from "./F7Placeholder.js";
import { WorksheetReview } from "./WorksheetReview.js";

const review = {
  sessionId: "session-review-1",
  worksheets: [
    { worksheetName: "AJ_GAP", status: "review_required", findingCount: 1 },
    { worksheetName: "B_STACK", status: "completed", findingCount: 0 },
  ],
  selectedWorksheetName: "AJ_GAP",
  selectedFindingId: "finding-cpk",
  findings: [
    {
      findingId: "finding-cpk",
      title: "Cpk below target",
      severity: "high",
      summary: "Current Cpk remains below project target.",
      evidence: {
        sourceRow: 15,
        sourceCells: ["AJ_GAP!J15", "AJ_GAP!K15", "AJ_GAP!L15"],
        imageArtifactId: "img-aj-gap",
        formulaIds: ["cpk-v1"],
        ruleEntryId: "performance-cpk-below-target",
      },
      action: {
        title: "Review centering option",
        summary: "Assess whether OP1 can recover Cpk without tightening supplier tolerance.",
      },
    },
  ],
  evidence: {
    worksheetName: "AJ_GAP",
    imageArtifactId: "img-aj-gap",
    sourceRow: 15,
    sourceCells: ["AJ_GAP!J15", "AJ_GAP!K15", "AJ_GAP!L15"],
    formulaIds: ["cpk-v1"],
    ruleEntryId: "performance-cpk-below-target",
    factors: [
      {
        factorName: "AJ center to C-bucket",
        contribution: 0.62,
        sourceRow: 15,
      },
    ],
  },
  analysisContext: {
    title: "Analysis Context",
    items: ["Gap to target bucket under static assembly condition."],
  },
  optimizationTargets: {
    title: "Optimization Targets",
    items: ["Raise Cpk to 1.33."],
  },
  f6Options: [
    {
      optionId: "op1",
      label: "OP1 Centering",
      status: "candidate",
      deltaCpk: 0.16,
      summary: "Shift mean toward target.",
    },
  ],
  report: {
    artifactId: "f6-report-aj-gap",
    label: "下载当前报告",
  },
};

describe("WorksheetReview", () => {
  it("shows worksheet queue, evidence pane, and finding action pane", async () => {
    const user = userEvent.setup();
    const selected: string[] = [];

    render(<WorksheetReview review={review} onSelectFinding={(findingId) => selected.push(findingId)} />);

    expect(screen.getByRole("heading", { name: "Worksheet Queue" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Read-only Evidence" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Finding and Action" })).toBeVisible();
    expect(screen.getByRole("tablist", { name: "Worksheet queue" })).toBeVisible();
    const selectedTab = screen.getByRole("tab", { name: /AJ_GAP/ });
    expect(selectedTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", selectedTab.id);
    expect(selectedTab).toHaveAttribute("aria-controls", screen.getByRole("tabpanel").id);
    expect(screen.getByRole("listbox", { name: "Engineering findings" })).toBeVisible();
    expect(screen.getByText("Source Row 15")).toBeVisible();
    expect(screen.getByText("AJ_GAP!J15")).toBeVisible();
    expect(screen.getByText("OP1 Centering")).toBeVisible();
    expect(screen.getByRole("link", { name: "下载当前报告" })).toHaveAttribute("href", "/api/sessions/session-review-1/artifacts/f6-report-aj-gap");

    await user.click(screen.getByRole("option", { name: "Cpk below target" }));
    expect(selected).toEqual(["finding-cpk"]);
    expect(screen.getByRole("option", { name: "Cpk below target" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "AJ_GAP!J15" }));
    expect(screen.getByRole("status")).toHaveTextContent("Source evidence focused: AJ_GAP!J15");
    await user.click(screen.getByRole("button", { name: "cpk-v1" }));
    expect(screen.getByRole("status")).toHaveTextContent("Formula evidence: cpk-v1");
    await user.click(screen.getByRole("button", { name: /F0 Rule/ }));
    expect(screen.getByRole("status")).toHaveTextContent("F0 rule evidence: performance-cpk-below-target");
    await user.click(screen.getByRole("button", { name: /Image Artifact/ }));
    expect(screen.getByRole("status")).toHaveTextContent("/api/sessions/session-review-1/artifacts/img-aj-gap");

    selectedTab.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: /B_STACK/ })).toHaveFocus();
  });

  it("shows F7 as unavailable without measured values", () => {
    render(<F7Placeholder status={{ status: "feature_not_available", lifecycle: "in_development" }} />);

    expect(screen.getByText("F7 正在开发")).toBeVisible();
    expect(screen.queryByText(/Measured Cpk/)).not.toBeInTheDocument();
  });
});