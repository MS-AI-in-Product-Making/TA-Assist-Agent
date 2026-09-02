import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FactorScenarioState } from "../hooks/use-scenario-workspace.js";
import type { FactorRowModel } from "../workspace-model.js";
import { projectSourceText } from "../web-projection.js";
import { FactorTable } from "./FactorTable.js";

const factor: FactorRowModel = { key: "sheet\u0000table\u00001", worksheetName: "sheet", tableId: "table", sourceRow: 1, factorName: projectSourceText("间隙", "Gap"), partName: projectSourceText("支架", "Bracket"), drawingNumber: "DRW-001", dimId: "DIM-17", partCategory: "CNC", unit: "mm", nominalValue: 1, nominalDisplay: "1.000", upperTolerance: 0.2, upperToleranceDisplay: "0.200", lowerTolerance: -0.2, lowerToleranceDisplay: "-0.200", longTermSafetyFactor: 1, longTermSafetyFactorDisplay: "1.0", sigmaLevel: 4, sigmaLevelDisplay: "4.0", distribution: "Normal", mean: 1, meanDisplay: "1.000", tolerance: 0.2, toleranceDisplay: "0.200", oneSigma: 0.05, oneSigmaDisplay: "0.050", contributionDisplay: "50.0%", notes: "Check stack-up at room temperature", capabilityResult: "Internal within guidance", knowledgeRecommendation: projectSourceText("最大总公差带 0.5 mm · internal-v1 · v1", "Maximum total tolerance band 0.5 mm · internal-v1 · v1"), editable: true, additionalMeanShift: 0, directionLabel: "positive", directionAvailable: true, contribution: 0.5, loopLabel: undefined, status: "pass" };
const state: FactorScenarioState = { values: { nominalValue: "1", upperTolerance: "0.2", lowerTolerance: "-0.2", additionalMeanShift: "0" }, dirty: false, calculating: false };

describe("FactorTable", () => {
  it("edits scenario values and commits on blur without changing identity", () => {
    const onEdit = vi.fn();
    const onCommit = vi.fn();
    render(<FactorTable factors={[factor]} states={new Map([[factor.key, state]])} onEdit={onEdit} onCommit={onCommit} onSelect={vi.fn()} />);

    const input = screen.getByRole("spinbutton", { name: "Gap upperTolerance" });
    fireEvent.change(input, { target: { value: "0.25" } });
    fireEvent.blur(input);

    expect(onEdit).toHaveBeenLastCalledWith(factor.key, "upperTolerance", "0.25");
    expect(onCommit).toHaveBeenCalledWith(factor.key);
    expect(screen.getByText("50.0%")).toBeVisible();
  });

  it("renders canonical F2 columns and links Factor and Part to the image", () => {
    const onEvidenceFocus = vi.fn();
    const rendered = render(<FactorTable factors={[factor]} states={new Map([[factor.key, state]])} onEdit={vi.fn()} onCommit={vi.fn()} onSelect={vi.fn()} onEvidenceFocus={onEvidenceFocus} />);
    expect(within(rendered.container).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Loop Label",
      "Factor Description",
      "Part Name",
      "Drawing Number",
      "DIM ID",
      "Part Category",
      "Design Nominal",
      "+ Tolerance",
      "- Tolerance",
      "Long Term/Safety Factor",
      "Sigma Level",
      "Distribution",
      "Mean",
      "Tolerance",
      "One Sigma",
      "% Contribution to Sigma",
      "Notes",
      "Capability Result",
      "Knowledge Recommendation",
    ]);
    expect(within(rendered.container).getByText("Internal within guidance")).toBeVisible();
    const loopLabelText = within(rendered.container).getByText("Not available");
    expect(loopLabelText).toBeVisible();
    const loopCell = loopLabelText.closest("td");
    expect(loopCell).not.toBeNull();
    expect(loopCell).toHaveAttribute("title", "Excel source row 1");
    expect(within(loopCell as HTMLTableCellElement).getByText("Excel source row 1")).toBeInTheDocument();
    fireEvent.click(within(rendered.container).getByRole("button", { name: "Gap" }));
    fireEvent.click(within(rendered.container).getByRole("button", { name: "Bracket" }));
    expect(onEvidenceFocus).toHaveBeenCalledTimes(2);
    expect(onEvidenceFocus).toHaveBeenLastCalledWith(factor.key);
  });

  it("keeps notes accessible and removes row-level click activation", () => {
    const onSelect = vi.fn();
    const rendered = render(<FactorTable factors={[factor]} states={new Map([[factor.key, state]])} onEdit={vi.fn()} onCommit={vi.fn()} onSelect={onSelect} />);

    expect(rendered.container.querySelector("tr")?.getAttribute("onclick")).toBeNull();

    const notesButton = within(rendered.container).getByRole("button", { name: /show notes for gap/i });
    notesButton.focus();
    expect(notesButton).toHaveFocus();
    fireEvent.click(notesButton);

    expect(onSelect).not.toHaveBeenCalled();
    expect(notesButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Check stack-up at room temperature")).toBeVisible();
    expect(screen.getAllByText("DRW-001")[0]).toBeVisible();
    expect(screen.getAllByText("DIM-17")[0]).toBeVisible();
    expect(screen.getAllByText("Maximum total tolerance band 0.5 mm · internal-v1 · v1")[0]).toBeVisible();
  });

  it("applies stable editable input attributes", () => {
    const rendered = render(<FactorTable factors={[factor]} states={new Map([[factor.key, state]])} onEdit={vi.fn()} onCommit={vi.fn()} onSelect={vi.fn()} />);

    const nominal = within(rendered.container).getByRole("spinbutton", { name: "Gap nominalValue" });
    const upper = within(rendered.container).getByRole("spinbutton", { name: "Gap upperTolerance" });
    const lower = within(rendered.container).getByRole("spinbutton", { name: "Gap lowerTolerance" });
    expect(nominal).toHaveAttribute("name", "nominalValue");
    expect(upper).toHaveAttribute("name", "upperTolerance");
    expect(lower).toHaveAttribute("name", "lowerTolerance");
    expect(nominal).toHaveAttribute("autocomplete", "off");
    expect(upper).toHaveAttribute("autocomplete", "off");
    expect(lower).toHaveAttribute("autocomplete", "off");
  });
});
