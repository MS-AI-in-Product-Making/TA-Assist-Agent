import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SpecificationPlotModel } from "../chart-model.js";
import type { WhatIfMetrics } from "./MetricComparison.js";
import { SpecificationPlot } from "./SpecificationPlot.js";

afterEach(cleanup);

describe("SpecificationPlot", () => {
  it("renders labeled limits, numeric ticks, mean markers, ranges, and fixed legend", () => {
    const { container } = render(<SpecificationPlot model={model()} draft={scenarioMetrics()} />);

    expect(screen.getByRole("img", { name: "Baseline and scenario specification distribution" })).toBeVisible();
    expect(screen.getByText("LSL 1.400")).toBeVisible();
    expect(screen.getByText("USL 1.600")).toBeVisible();
    expect(screen.getByText("1.300")).toBeVisible();
    expect(screen.getByText("1.900")).toBeVisible();
    expect(screen.getByText("Baseline mean")).toBeVisible();
    expect(screen.getByText("Scenario mean")).toBeVisible();
    expect(screen.getByText("Baseline statistical range")).toBeVisible();
    expect(screen.getByText("Scenario statistical range")).toBeVisible();
    expect(screen.getByText("Worst-case range")).toBeVisible();
    expect(screen.getByText("Baseline mean 1.500 · statistical range 1.425 to 1.575")).toBeVisible();
    expect(screen.getByText("Scenario mean 1.525 · statistical range 1.405 to 1.645")).toBeVisible();
    expect(screen.getByText("Worst-case range 1.300 to 1.900")).toBeVisible();
    expect(container.querySelector(".baseline-mean-marker")).not.toBeNull();
    expect(container.querySelector(".scenario-mean-marker")).not.toBeNull();
    expect(container.querySelector(".baseline-range")).not.toBeNull();
    expect(container.querySelector(".scenario-range")).not.toBeNull();
    expect(container.querySelector(".scenario-worst-range")).not.toBeNull();
  });

  it("keeps the drag domain stable and uses the axis track instead of the full svg width", () => {
    const edits: Array<readonly ["lowerSpecLimit" | "upperSpecLimit", string]> = [];
    render(
      <SpecificationPlot
        model={model()}
        draft={scenarioMetrics()}
        systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.6" }}
        onSystemEdit={(field, value) => edits.push([field, value])}
      />,
    );

    const slider = screen.getByRole("slider", { name: "Lower Spec Limit line" });
    const plot = screen.getByTestId("specification-plot");
    plot.getBoundingClientRect = () => ({ x: 100, y: 20, width: 600, height: 210, top: 20, left: 100, right: 700, bottom: 230, toJSON() { return {}; } }) as DOMRect;

    fireEvent(slider, pointerEvent("pointerdown", { clientX: 142, pointerId: 9, buttons: 1 }));
    fireEvent(slider, pointerEvent("pointermove", { clientX: 142, pointerId: 9, buttons: 1 }));

    expect(edits.at(-1)).toEqual(["lowerSpecLimit", "1.3"]);
    expect(Number.parseFloat((slider as HTMLButtonElement).style.left)).toBeCloseTo(16.666666666666664, 10);
  });

  it("separates close spec limit labels to avoid overlap", () => {
    render(
      <SpecificationPlot
        model={model()}
        systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.43" }}
      />,
    );

    const lsl = screen.getByText("LSL 1.400");
    const usl = screen.getByText("USL 1.430");

    expect(lsl.getAttribute("y")).toBe("16");
    expect(usl.getAttribute("y")).toBe("30");
    expect(lsl.getAttribute("text-anchor")).toBe("end");
    expect(usl.getAttribute("text-anchor")).toBe("start");
  });

  it("previews captured pointer drags and commits exactly once on release", () => {
    const edits: Array<["lowerSpecLimit" | "upperSpecLimit", string]> = [];
    const commits: Array<"lowerSpecLimit" | "upperSpecLimit"> = [];
    render(
      <SpecificationPlot
        model={model()}
        draft={scenarioMetrics()}
        systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.6" }}
        onSystemEdit={(field, value) => edits.push([field, value])}
        onSystemCommit={(field) => commits.push(field)}
      />,
    );

    const slider = screen.getByRole("slider", { name: "Lower Spec Limit line" }) as HTMLButtonElement & { setPointerCapture?: (pointerId: number) => void; releasePointerCapture?: (pointerId: number) => void };
    const captures: number[] = [];
    const releases: number[] = [];
    slider.setPointerCapture = (pointerId: number) => captures.push(pointerId);
    slider.releasePointerCapture = (pointerId: number) => releases.push(pointerId);
    screen.getByTestId("specification-plot").getBoundingClientRect = () => ({ x: 100, y: 20, width: 560, height: 140, top: 20, left: 100, right: 660, bottom: 160, toJSON() { return {}; } }) as DOMRect;

    fireEvent(slider, pointerEvent("pointerdown", { clientX: 100, pointerId: 7, buttons: 1 }));
    fireEvent(slider, pointerEvent("pointermove", { clientX: 240, pointerId: 7, buttons: 1 }));
    fireEvent(slider, pointerEvent("pointerup", { clientX: 240, pointerId: 7, buttons: 0 }));
    fireEvent(slider, pointerEvent("pointerup", { clientX: 240, pointerId: 7, buttons: 0 }));

    expect(captures).toEqual([7]);
    expect(releases).toEqual([7]);
    expect(edits).toHaveLength(1);
    expect(edits[0]?.[0]).toBe("lowerSpecLimit");
    expect(Number.isFinite(Number(edits[0]?.[1]))).toBe(true);
    expect(commits).toEqual(["lowerSpecLimit"]);
  });

  it("uses numeric blur and Enter for the shared commit path", () => {
    const edits: Array<["lowerSpecLimit" | "upperSpecLimit", string]> = [];
    const commits: Array<"lowerSpecLimit" | "upperSpecLimit"> = [];
    render(<SpecificationPlot model={model()} systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.6" }} onSystemEdit={(field, value) => edits.push([field, value])} onSystemCommit={(field) => commits.push(field)} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Lower Spec Limit" }), { target: { value: "1.45" } });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Lower Spec Limit" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Upper Spec Limit" }), { target: { value: "1.65" } });
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Upper Spec Limit" }), { key: "Enter" });

    expect(edits).toEqual([["lowerSpecLimit", "1.45"], ["upperSpecLimit", "1.65"]]);
    expect(commits).toEqual(["lowerSpecLimit", "upperSpecLimit"]);
  });

  it("links numeric and slider specification controls to persistent guidance", () => {
    render(<SpecificationPlot model={model()} />);
    for (const control of [screen.getByRole("spinbutton", { name: "Lower Spec Limit" }), screen.getByRole("slider", { name: "Lower Spec Limit line" })]) {
      expect(control).toHaveAttribute("data-user-input-id", "lower_spec_limit");
      expect(control).toHaveAttribute("aria-describedby", "lower_spec_limit-guidance");
    }
    expect(screen.getByText(/Enter or drag the proposed lower specification limit/)).toBeVisible();
  });

  it("routes keyboard arrows through clamping and shows an English inline reason", () => {
    const edits: Array<["lowerSpecLimit" | "upperSpecLimit", string]> = [];
    render(<SpecificationPlot model={model()} systemValues={{ lowerSpecLimit: "1.4", upperSpecLimit: "1.401" }} onSystemEdit={(field, value) => edits.push([field, value])} />);

    fireEvent.keyDown(screen.getByRole("slider", { name: "Upper Spec Limit line" }), { key: "ArrowLeft" });

    expect(edits).toEqual([["upperSpecLimit", "1.401"]]);
    expect(screen.getByRole("alert")).toHaveTextContent("USL must stay above LSL.");
  });
});

function model(): SpecificationPlotModel {
  return { lsl: 1.4, usl: 1.6, baselineMean: 1.5, baselineLower: 1.425, baselineUpper: 1.575, baselineSigma: 0.025, scenarioMean: 1.525, scenarioSigma: 0.03, scenarioLower: 1.405, scenarioUpper: 1.645, worstCaseLower: 1.3, worstCaseUpper: 1.9 };
}

function scenarioMetrics(): WhatIfMetrics {
  return {
    mean: 1.525,
    rssSigma: 0.03,
    cp: 1.1,
    cpkL: 1.0,
    cpkU: 1.2,
    cpk: 1.0,
    statisticalMargin: 0.18,
    worstCaseMargin: 0.08,
    lowerSpecLimit: 1.4,
    upperSpecLimit: 1.6,
    statisticalLower: 1.405,
    statisticalUpper: 1.645,
    worstCaseLower: 1.3,
    worstCaseUpper: 1.9,
  };
}

function pointerEvent(type: string, init: { readonly clientX: number; readonly pointerId: number; readonly buttons: number }): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: init.clientX },
    pointerId: { value: init.pointerId },
    buttons: { value: init.buttons },
  });
  return event;
}