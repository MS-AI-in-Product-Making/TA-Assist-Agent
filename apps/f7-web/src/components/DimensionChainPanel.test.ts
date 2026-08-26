import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DimensionChainPanel from "./DimensionChainPanel.vue";
import type { DimensionChainFactor } from "./dimension-chain";

function factor(itemNumber: number, designNominal: number): DimensionChainFactor {
  return {
    id: `factor-${itemNumber}`,
    itemNumber,
    name: `Factor ${itemNumber}`,
    designNominal,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
  };
}

const factors = [factor(1, 2), factor(2, -1), factor(3, 0.5)];

describe("DimensionChainPanel", () => {
  it("generates a labeled cumulative chain with component and closure arrows", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });

    expect(wrapper.find("[data-dimension-chain-svg]").exists()).toBe(false);
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.findAll("[data-dimension-segment]")).toHaveLength(3);
    expect(wrapper.findAll("[data-dimension-start]")).toHaveLength(3);
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("additive");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-direction")).toBe("subtractive");
    expect(wrapper.get("[data-dimension-segment='1']").classes()).toContain("dimension-chain-additive");
    expect(wrapper.get("[data-dimension-segment='2']").classes()).toContain("dimension-chain-subtractive");
    expect(wrapper.get("[data-dimension-origin-guide]").classes()).toContain("dimension-chain-origin-guide");
    expect(wrapper.get("[data-dimension-closure]").classes()).toContain("dimension-chain-closure");
    expect(wrapper.get("[data-dimension-closure-start]").classes()).toContain("dimension-chain-closure-start");
    expect(wrapper.get("[data-dimension-closure-marker]").attributes("markerWidth")).toBe("4");
    expect(wrapper.findAll("[data-dimension-component-marker]").map((marker) => marker.attributes("markerWidth"))).toEqual(["4", "4"]);
    expect(wrapper.text()).toContain("Item 1");
    expect(wrapper.text()).toContain("Factor 1");
    expect(wrapper.text()).toContain("Closure");
    const accessibleItems = wrapper.findAll("[data-dimension-chain-accessible-list] li");
    expect(accessibleItems).toHaveLength(4);
    expect(accessibleItems[0]!.text()).toContain("Item 1, Factor 1, +2, additive");
    expect(accessibleItems[3]!.text()).toContain("Closure");
  });

  it("keeps the generated snapshot until the user updates it", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    await wrapper.setProps({ factors: [{ ...factors[0]!, designNominal: 9 }, ...factors.slice(1)] });

    expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
    expect(wrapper.get("[data-generate-dimension-chain]").text()).toBe("Update");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("2");

    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(false);
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("9");
  });

  it("recalculates all arrow proportions when the user updates", async () => {
    const initial = [factor(1, 100), factor(2, 1)];
    const wrapper = mount(DimensionChainPanel, { props: { factors: initial, valid: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-length")).toBe("36");

    await wrapper.setProps({ factors: [factor(1, 2), factor(2, 1)] });
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-length")).toBe("36");
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-length")).toBe("90");
  });

  it("switches orientation without making the generated snapshot stale", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");

    expect(wrapper.get("button[aria-label='Vertical dimension chain']").attributes("aria-pressed")).toBe("true");
    expect(wrapper.get("[data-dimension-chain-svg]").attributes("data-orientation")).toBe("vertical");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(false);
  });

  it("uses the raw Factor Setup signature to detect non-geometric changes", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, sourceSignature: "original-drafts" },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    await wrapper.setProps({ sourceSignature: "changed-drafts" });

    expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
  });

  it("disables generation for invalid factors and renders zero items once valid", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors: [factor(1, 0)], valid: false } });
    expect(wrapper.get("[data-generate-dimension-chain]").attributes("disabled")).toBeDefined();

    await wrapper.setProps({ valid: true });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("zero");
    expect(wrapper.find("[data-dimension-zero]").exists()).toBe(true);
  });
});
