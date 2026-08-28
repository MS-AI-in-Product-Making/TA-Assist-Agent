import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import {
  calculateToleranceAnalysis,
  type KernelCalculationResult,
} from "@ai-assist/workbook-catalog/calculation-kernel";
import ResponseDistributionCurve from "./ResponseDistributionCurve.vue";

const STYLE_SOURCE = readFileSync(join(process.cwd(), "apps/f7-web/src/style.css"), "utf8");

function createCalculation(
  nominalValue = 10,
  lowerSpecLimit = 9,
  upperSpecLimit = 11,
): KernelCalculationResult {
  return calculateToleranceAnalysis({
    factors: [{
      source: { worksheetName: "Study", tableId: "factors", sourceRow: 2 },
      name: "Gap",
      unit: "mm",
      input: {
        nominalValue,
        upperTolerance: 0.4,
        lowerTolerance: -0.2,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal",
      },
    }],
    system: {
      designNominal: nominalValue,
      lowerSpecLimit,
      upperSpecLimit,
      targetSigmaLevel: 6,
      targetCpk: 2,
      shift: 0,
    },
  });
}

function formatF4(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function requiredAttribute(
  wrapper: { attributes(name: string): string | undefined },
  name: string,
): string {
  const value = wrapper.attributes(name);
  if (value === undefined) throw new Error(`Missing required attribute: ${name}`);
  return value;
}

function parseTranslate(transform: string): { readonly x: number; readonly y: number } {
  const match = /^translate\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(transform);
  expect(match).not.toBeNull();
  return { x: Number(match![1]), y: Number(match![2]) };
}

function expectBadgesAlignedAndSeparated(wrapper: VueWrapper): void {
  const layouts = wrapper.findAll("[data-response-badge]").map((badge) => {
    const id = requiredAttribute(badge, "data-response-badge");
    const position = parseTranslate(requiredAttribute(badge, "transform"));
    const lineX = Number(requiredAttribute(
      wrapper.get(`[data-response-reference="${id}"]`),
      "x1",
    ));
    const rect = badge.get("rect");
    const rectX = Number(requiredAttribute(rect, "x"));
    const rectY = Number(requiredAttribute(rect, "y"));
    const width = Number(requiredAttribute(rect, "width"));
    const height = Number(requiredAttribute(rect, "height"));

    expect(position.x).toBe(lineX);
    expect(position.y + rectY + height).toBeLessThan(48);
    return {
      y: position.y,
      left: position.x + rectX,
      right: position.x + rectX + width,
    };
  });
  const rows = Map.groupBy(layouts, ({ y }) => y);

  expect(rows.size).toBeLessThanOrEqual(3);
  const rowPositions = [...rows.keys()].toSorted((left, right) => left - right);
  for (let index = 1; index < rowPositions.length; index += 1) {
    expect(rowPositions[index]! - rowPositions[index - 1]!).toBeGreaterThanOrEqual(15);
  }
  for (const row of rows.values()) {
    const sorted = row.toSorted((left, right) => left.left - right.left);
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index]!.left).toBeGreaterThanOrEqual(sorted[index - 1]!.right);
    }
  }
}

describe("ResponseDistributionCurve", () => {
  it("renders the Normal curve, accessible context, fixed references, ticks, and legend", () => {
    const calculation = createCalculation();
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation } });

    expect(wrapper.get("[data-response-distribution-curve]").element.tagName).toBe("SECTION");
    expect(wrapper.get("h3").text()).toBe("Normal Distribution Curve");
    expect(wrapper.get("svg").attributes("viewBox")).toBe("0 0 760 300");
    expect(wrapper.get("svg title").text()).toBe("Normal Distribution Curve");
    const description = wrapper.get("svg desc").text();
    expect(description).toContain(`Mean ${formatF4(calculation.system.mean)}`);
    expect(description).toContain(`sigma ${formatF4(calculation.system.rssSigma)}`);
    expect(description).toContain(`LSL ${formatF4(calculation.capability.lowerSpecLimit)}`);
    expect(description).toContain(`USL ${formatF4(calculation.capability.upperSpecLimit)}`);
    expect(wrapper.get("[data-response-normal-curve]").attributes("d")).toMatch(/^M/);
    expect(wrapper.findAll("[data-response-tick]")).toHaveLength(7);

    for (const [id, value] of [
      ["lower-spec-limit", calculation.capability.lowerSpecLimit],
      ["upper-spec-limit", calculation.capability.upperSpecLimit],
      ["target", (calculation.capability.lowerSpecLimit + calculation.capability.upperSpecLimit) / 2],
      ["mean", calculation.system.mean],
    ] as const) {
      const reference = wrapper.get(`[data-response-reference="${id}"]`);
      expect(reference.element.tagName).toBe("line");
      expect(reference.attributes("data-value")).toBe(formatF4(value));
      expect(wrapper.get(`[data-response-badge="${id}"]`).text()).toContain(formatF4(value));
    }

    expect(wrapper.get("[data-response-legend]").text()).toContain("Normal");
    expect(wrapper.get("[data-response-legend]").text()).toContain("LSL / USL");
    expect(wrapper.get("[data-response-legend]").text()).toContain("Target");
    expect(wrapper.get("[data-response-legend]").text()).toContain("Mean");
  });

  it("shows 4 sigma and 6 sigma by default with four explicitly labelled native checkboxes", () => {
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: createCalculation() } });

    const checkboxes = wrapper.findAll("input[type='checkbox']");
    expect(checkboxes).toHaveLength(4);
    expect(checkboxes.map((checkbox) => checkbox.element instanceof HTMLInputElement)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(wrapper.get("[data-response-sigma-controls]").text()).toContain("±3σ");
    expect(wrapper.get("[data-response-sigma-controls]").text()).toContain("±4σ");
    expect(wrapper.get("[data-response-sigma-controls]").text()).toContain("±4.5σ");
    expect(wrapper.get("[data-response-sigma-controls]").text()).toContain("±6σ");
    expect(wrapper.findAll('[data-response-sigma="3"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-response-sigma="4"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-response-sigma="4.5"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-response-sigma="6"]')).toHaveLength(2);
  });

  it("keeps every badge at its exact reference x in non-overlapping rows above the plot", async () => {
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: createCalculation() } });
    expectBadgesAlignedAndSeparated(wrapper);

    for (const checkbox of wrapper.findAll("input[type='checkbox']")) {
      if (!(checkbox.element as HTMLInputElement).checked) await checkbox.setValue(true);
    }
    expect(wrapper.findAll("[data-response-badge]")).toHaveLength(12);
    expectBadgesAlignedAndSeparated(wrapper);

    const calculation = createCalculation();
    const targetValue = (calculation.capability.lowerSpecLimit + calculation.capability.upperSpecLimit) / 2;
    const samePointWrapper = mount(ResponseDistributionCurve, {
      props: {
        calculation: {
          ...calculation,
          system: { ...calculation.system, mean: targetValue },
        },
      },
    });
    const meanLineX = Number(samePointWrapper.get('[data-response-reference="mean"]').attributes("x1"));
    const targetLineX = Number(samePointWrapper.get('[data-response-reference="target"]').attributes("x1"));
    const meanBadge = parseTranslate(requiredAttribute(
      samePointWrapper.get('[data-response-badge="mean"]'),
      "transform",
    ));
    const targetBadge = parseTranslate(requiredAttribute(
      samePointWrapper.get('[data-response-badge="target"]'),
      "transform",
    ));
    expect(meanLineX).toBeCloseTo(targetLineX, 8);
    expectBadgesAlignedAndSeparated(samePointWrapper);
    expect(meanBadge.y).not.toBe(targetBadge.y);
  });

  it("renders all reference lines below the curve and all badges above it", () => {
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: createCalculation() } });
    const svgChildren = Array.from(wrapper.get("svg").element.children);
    const linesIndex = svgChildren.findIndex((element) => element.hasAttribute("data-response-reference-lines"));
    const curveIndex = svgChildren.findIndex((element) => element.hasAttribute("data-response-curve-layer"));
    const badgesIndex = svgChildren.findIndex((element) => element.hasAttribute("data-response-reference-badges"));

    expect(linesIndex).toBeGreaterThanOrEqual(0);
    expect(curveIndex).toBeGreaterThan(linesIndex);
    expect(badgesIndex).toBeGreaterThan(curveIndex);
  });

  it("uses tabular numerals for tick, badge, and reference labels", () => {
    expect(STYLE_SOURCE).toMatch(
      /\.response-plot-tick-label,\s*\.response-reference-badge text,\s*\.response-distribution-legend\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s,
    );
  });

  it("places a visible-only legend before the SVG and updates it when 3 sigma is toggled", async () => {
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: createCalculation() } });
    const figureChildren = Array.from(wrapper.get("figure").element.children);
    const legendIndex = figureChildren.findIndex((element) => element.hasAttribute("data-response-legend"));
    const viewportIndex = figureChildren.findIndex((element) => element.classList.contains("response-distribution-viewport"));
    const toggle = wrapper.get("input[value='3']");

    expect(legendIndex).toBeGreaterThanOrEqual(0);
    expect(viewportIndex).toBeGreaterThan(legendIndex);
    expect(wrapper.get("[data-response-legend]").text()).toContain("Normal");
    expect(wrapper.get("[data-response-legend]").text()).toContain("LSL / USL");
    expect(wrapper.get("[data-response-legend]").text()).toContain("Target");
    expect(wrapper.get("[data-response-legend]").text()).toContain("Mean");
    expect(wrapper.get("[data-response-legend]").text()).not.toContain("±3σ");
    expect(wrapper.get("[data-response-legend]").text()).toContain("±4σ");
    expect(wrapper.get("[data-response-legend]").text()).not.toContain("±4.5σ");
    expect(wrapper.get("[data-response-legend]").text()).toContain("±6σ");

    await toggle.setValue(true);
    expect(wrapper.get("[data-response-legend]").text()).toContain("±3σ");
    expect(wrapper.findAll('[data-response-sigma="3"]')).toHaveLength(2);

    await toggle.setValue(false);
    expect(wrapper.get("[data-response-legend]").text()).not.toContain("±3σ");
    expect(wrapper.findAll('[data-response-sigma="3"]')).toHaveLength(0);
  });

  it("makes the horizontal plot viewport keyboard focusable and labelled", () => {
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: createCalculation() } });
    const viewport = wrapper.get(".response-distribution-viewport");

    expect(viewport.attributes("tabindex")).toBe("0");
    expect(viewport.attributes("aria-label")).toBe("Scrollable Normal distribution plot");
  });

  it("toggles both 3 sigma reference lines locally", async () => {
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: createCalculation() } });
    const toggle = wrapper.get("input[value='3']");

    expect(toggle.attributes("type")).toBe("checkbox");
    expect((toggle.element as HTMLInputElement).checked).toBe(false);
    await toggle.setValue(true);

    expect(wrapper.findAll('[data-response-sigma="3"]')).toHaveLength(2);
    expect((toggle.element as HTMLInputElement).checked).toBe(true);
  });

  it("updates Mean, LSL, and USL values when the calculation prop changes", async () => {
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: createCalculation() } });
    const updated = createCalculation(20, 18.25, 21.75);

    await wrapper.setProps({ calculation: updated });

    expect(wrapper.get('[data-response-reference="mean"]').attributes("data-value"))
      .toBe(formatF4(updated.system.mean));
    expect(wrapper.get('[data-response-reference="lower-spec-limit"]').attributes("data-value"))
      .toBe(formatF4(updated.capability.lowerSpecLimit));
    expect(wrapper.get('[data-response-reference="upper-spec-limit"]').attributes("data-value"))
      .toBe(formatF4(updated.capability.upperSpecLimit));
  });

  it("renders a compact unavailable state without a curve path for zero sigma", () => {
    const calculation = createCalculation();
    const zeroSigma: KernelCalculationResult = {
      ...calculation,
      system: { ...calculation.system, rssSigma: 0 },
    };
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: zeroSigma } });

    expect(wrapper.get("[data-response-distribution-unavailable]").text()).toContain("unavailable");
    expect(wrapper.find("path").exists()).toBe(false);
    expect(wrapper.find("svg").exists()).toBe(false);
  });

  it("renders the unavailable state when no calculation is provided", () => {
    const wrapper = mount(ResponseDistributionCurve);

    expect(wrapper.get("[data-response-distribution-unavailable]").text()).toContain("unavailable");
    expect(wrapper.find("[data-response-sigma-controls]").exists()).toBe(false);
    expect(wrapper.find("svg").exists()).toBe(false);
  });

  it("uses compact scientific notation for extreme reference badges", () => {
    const calculation = createCalculation();
    const extreme: KernelCalculationResult = {
      ...calculation,
      system: {
        ...calculation.system,
        mean: 1e120,
        rssSigma: 1e118,
      },
      capability: {
        ...calculation.capability,
        lowerSpecLimit: 0.9e120,
        upperSpecLimit: 1.1e120,
      },
    };
    const wrapper = mount(ResponseDistributionCurve, { props: { calculation: extreme } });

    expect(wrapper.get('[data-response-badge="mean"]').text()).toContain("1.000e+120");
    expect(Number(wrapper.get('[data-response-badge="mean"] rect').attributes("width"))).toBeLessThanOrEqual(82);
  });
});