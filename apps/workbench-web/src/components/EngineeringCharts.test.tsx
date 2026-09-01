import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { WorksheetWorkspaceModel } from "../workspace-model.js";
import { projectSourceText } from "../web-projection.js";
import { EngineeringCharts } from "./EngineeringCharts.js";

afterEach(cleanup);

it("renders metric comparison, contribution, and specification plots", () => {
  render(<EngineeringCharts worksheet={worksheet()} scenario={{ status: "completed", calculationReference: "calc", metrics: { ...worksheet().metrics!, cpk: 1.3 } }} />);
  expect(screen.getByText("Cpk")).toBeVisible();
  expect(screen.getByText("Mean Response")).toBeVisible();
  expect(screen.getByText("Additional Mean Shift")).toBeVisible();
  expect(screen.queryByText("Mean Offset")).toBeNull();
  expect(screen.queryByLabelText("Mean Offset source values")).toBeNull();
  expect(screen.getByLabelText("Metric strip")).toHaveClass("metric-strip--compact");
  expect(screen.getByRole("img", { name: "Factor contribution" })).toBeVisible();
  expect(screen.getByRole("img", { name: "Baseline and scenario specification distribution" })).toBeVisible();
});

it("shows an inactive scenario legend and no scenario bars when no draft exists", () => {
  const { container } = render(<EngineeringCharts worksheet={worksheet()} />);

  expect([...container.querySelectorAll(".chart-legend text")].map((node) => node.textContent)).toEqual(["Baseline", "No scenario"]);
  expect(container.querySelector(".scenario-legend__swatch")?.getAttribute("fill")).toBe("#9aa7a1");
  expect(container.querySelectorAll(".baseline-bar")).toHaveLength(1);
  expect(container.querySelectorAll(".scenario-bar")).toHaveLength(0);
});

it("renders fixed Baseline and Scenario legend entries even when contribution values are equal", () => {
  const { container } = render(
    <EngineeringCharts
      worksheet={worksheet()}
      scenario={{ status: "completed", calculationReference: "calc", metrics: worksheet().metrics! }}
      scenarioContributions={new Map([["key", 0.5]])}
    />,
  );

  expect([...container.querySelectorAll(".chart-legend text")].map((node) => node.textContent)).toEqual(["Baseline", "Scenario"]);
  expect(container.querySelector(".baseline-legend__swatch")?.getAttribute("fill")).toBe("#7a807d");
  expect(container.querySelector(".scenario-legend__swatch")?.getAttribute("fill")).toBe("#2d6854");
  expect(container.querySelectorAll(".baseline-bar")).toHaveLength(1);
  expect(container.querySelectorAll(".scenario-bar")).toHaveLength(1);
  expect(container.querySelector(".baseline-bar")?.getAttribute("fill")).toBe("#7a807d");
  expect(container.querySelector(".scenario-bar")?.getAttribute("fill")).toBe("#2d6854");
});

it("keeps baseline contribution visible when scenario contribution changes", () => {
  const { container } = render(
    <EngineeringCharts
      worksheet={worksheet()}
      scenario={{ status: "completed", calculationReference: "calc", metrics: worksheet().metrics! }}
      scenarioContributions={new Map([["key", 0.65]])}
    />,
  );

  const baselineBar = container.querySelector<SVGRectElement>(".baseline-bar");
  const scenarioBar = container.querySelector<SVGRectElement>(".scenario-bar");

  expect(baselineBar?.getAttribute("width")).toBe("190");
  expect(scenarioBar?.getAttribute("width")).toBe("247");
  expect(baselineBar?.getAttribute("fill")).toBe("#7a807d");
  expect(scenarioBar?.getAttribute("fill")).toBe("#2d6854");
});

it("commits a dragged lower spec limit through preview and release callbacks", () => {
  const edits: Array<["lowerSpecLimit" | "upperSpecLimit", string]> = [];
  const commits: Array<"lowerSpecLimit" | "upperSpecLimit"> = [];
  const { container } = render(
    <EngineeringCharts
      worksheet={worksheet()}
      systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.6" }}
      onSystemEdit={(field, value) => edits.push([field, value])}
      onSystemCommit={(field) => commits.push(field)}
    />,
  );

  const slider = screen.getByRole("slider", { name: "Lower Spec Limit line" });
  const plot = container.querySelector("[data-testid='specification-plot']");
  expect(plot).not.toBeNull();
  plot!.getBoundingClientRect = () => ({ x: 100, y: 20, width: 560, height: 140, top: 20, left: 100, right: 660, bottom: 160, toJSON() { return {}; } }) as DOMRect;

  fireEvent.mouseDown(slider, { clientX: 100, buttons: 1 });
  fireEvent.mouseMove(window, { clientX: 240, buttons: 1 });
  fireEvent.mouseUp(window, { clientX: 240, buttons: 0 });

  expect(edits).toHaveLength(1);
  expect(edits[0]?.[0]).toBe("lowerSpecLimit");
  expect(Number.isFinite(Number(edits[0]?.[1]))).toBe(true);
  expect(commits).toEqual(["lowerSpecLimit"]);
});

it("commits only once when both pointer and mouse release events fire for the same drag", () => {
  const commits: Array<"lowerSpecLimit" | "upperSpecLimit"> = [];
  const { container } = render(
    <EngineeringCharts
      worksheet={worksheet()}
      systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.6" }}
      onSystemEdit={() => undefined}
      onSystemCommit={(field) => commits.push(field)}
    />,
  );

  const slider = screen.getByRole("slider", { name: "Lower Spec Limit line" });
  const plot = container.querySelector("[data-testid='specification-plot']");
  expect(plot).not.toBeNull();
  plot!.getBoundingClientRect = () => ({ x: 100, y: 20, width: 560, height: 140, top: 20, left: 100, right: 660, bottom: 160, toJSON() { return {}; } }) as DOMRect;

  fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1, buttons: 1 });
  fireEvent.pointerMove(window, { clientX: 240, pointerId: 1, buttons: 1 });
  fireEvent.pointerUp(window, { clientX: 240, pointerId: 1, buttons: 0 });
  fireEvent.mouseUp(window, { clientX: 240, buttons: 0 });

  expect(commits).toEqual(["lowerSpecLimit"]);
});

it("uses arrow keys for preview and Enter for the shared commit path", () => {
  const edits: Array<["lowerSpecLimit" | "upperSpecLimit", string]> = [];
  const commits: Array<"lowerSpecLimit" | "upperSpecLimit"> = [];
  render(
    <EngineeringCharts
      worksheet={worksheet()}
      systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.6" }}
      onSystemEdit={(field, value) => edits.push([field, value])}
      onSystemCommit={(field) => commits.push(field)}
    />,
  );

  const upperSlider = screen.getByRole("slider", { name: "Upper Spec Limit line" });
  fireEvent.keyDown(upperSlider, { key: "ArrowLeft" });
  fireEvent.keyDown(upperSlider, { key: "Enter" });

  expect(edits).toEqual([["upperSpecLimit", "1.599"]]);
  expect(commits).toEqual(["upperSpecLimit"]);
});

it("uses blur on numeric inputs to reach the same commit callback", () => {
  const commits: Array<"lowerSpecLimit" | "upperSpecLimit"> = [];
  render(
    <EngineeringCharts
      worksheet={worksheet()}
      systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.6" }}
      onSystemEdit={() => undefined}
      onSystemCommit={(field) => commits.push(field)}
    />,
  );

  fireEvent.blur(screen.getByRole("spinbutton", { name: "Lower Spec Limit" }));
  fireEvent.blur(screen.getByRole("spinbutton", { name: "Upper Spec Limit" }));

  expect(commits).toEqual(["lowerSpecLimit", "upperSpecLimit"]);
});

function worksheet(): WorksheetWorkspaceModel {
  return { worksheetName: "Analysis-A", status: "ready", analysisTarget: { description: "Gap loop", designNominal: { actual: 1.5, display: "1.500", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53" }, lowerSpecLimit: { actual: 1.4, display: "1.400", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54" }, upperSpecLimit: { actual: 1.6, display: "1.600", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55" }, unit: "mm" }, issues: [], factors: [{ key: "key", worksheetName: "Analysis-A", tableId: "table", sourceRow: 1, factorName: projectSourceText("间隙", "Gap"), partName: projectSourceText("部件", "Part"), partCategory: "CNC", unit: "mm", nominalValue: 1, nominalDisplay: "1.000", upperTolerance: 0.2, upperToleranceDisplay: "0.200", lowerTolerance: -0.2, lowerToleranceDisplay: "-0.200", longTermSafetyFactorDisplay: "1.0", sigmaLevelDisplay: "4.0", distribution: "Normal", mean: 1.627, meanDisplay: "1.627", toleranceDisplay: "0.200", oneSigmaDisplay: "0.050", contributionDisplay: "50.0%", capabilityResult: "ready", editable: true, additionalMeanShift: 0.02, directionLabel: "positive", directionAvailable: true, contribution: 0.5, status: "pass" }], metrics: { mean: 1.627, rssSigma: 0.05, cp: 1.4, cpkL: 1.2, cpkU: 1.3, cpk: 1.2, statisticalMargin: 0.2, worstCaseMargin: 0.1, lowerSpecLimit: 1.4, upperSpecLimit: 1.6, meanShift: 0.02, yield: 0.999, dpm: 1, statisticalLower: 1.427, statisticalUpper: 1.827, worstCaseLower: 1.3, worstCaseUpper: 1.9 } };
}
