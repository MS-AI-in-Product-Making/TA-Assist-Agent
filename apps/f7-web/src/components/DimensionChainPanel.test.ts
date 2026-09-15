import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import DimensionChainPanel from "./DimensionChainPanel.vue";
import type { DimensionChainFactor } from "./dimension-chain";
import { dimensionChainSignature } from "./dimension-chain";

const STYLE_SOURCE = readFileSync(join(process.cwd(), "apps/f7-web/src/style.css"), "utf8");

function dispatchPointer(
  element: Element,
  type: string,
  init: MouseEventInit & { readonly pointerId?: number },
): void {
  const event = new MouseEvent(type, { ...init, bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerId", { value: init.pointerId ?? 1 });
  element.dispatchEvent(event);
}

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

function installImageEnvironment(
  urls: readonly string[],
  decoded: Readonly<Record<string, { readonly width: number; readonly height: number } | "error">>,
): { readonly createObjectURL: ReturnType<typeof vi.fn>; readonly revokeObjectURL: ReturnType<typeof vi.fn> } {
  const createObjectURL = vi.fn();
  for (const url of urls) createObjectURL.mockReturnValueOnce(url);
  const revokeObjectURL = vi.fn();
  const NativeURL = globalThis.URL;
  class MockURL extends NativeURL {}
  Object.defineProperties(MockURL, {
    createObjectURL: { configurable: true, value: createObjectURL },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
  vi.stubGlobal("URL", MockURL);

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 0;
    naturalHeight = 0;

    set src(url: string) {
      const result = decoded[url];
      queueMicrotask(() => {
        if (!result || result === "error") {
          this.onerror?.();
          return;
        }
        this.naturalWidth = result.width;
        this.naturalHeight = result.height;
        this.onload?.();
      });
    }
  }
  vi.stubGlobal("Image", MockImage);
  return { createObjectURL, revokeObjectURL };
}

function installControllableImageEnvironment(urls: readonly string[]): {
  readonly revokeObjectURL: ReturnType<typeof vi.fn>;
  readonly resolve: (url: string, width?: number, height?: number) => void;
} {
  const createObjectURL = vi.fn();
  for (const url of urls) createObjectURL.mockReturnValueOnce(url);
  const revokeObjectURL = vi.fn();
  const NativeURL = globalThis.URL;
  class MockURL extends NativeURL {}
  Object.defineProperties(MockURL, {
    createObjectURL: { configurable: true, value: createObjectURL },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
  vi.stubGlobal("URL", MockURL);

  const pending = new Map<string, MockImage>();
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 0;
    naturalHeight = 0;

    set src(url: string) {
      pending.set(url, this);
    }
  }
  vi.stubGlobal("Image", MockImage);
  return {
    revokeObjectURL,
    resolve(url, width = 640, height = 480) {
      const image = pending.get(url);
      if (!image) throw new Error(`No pending image for ${url}`);
      image.naturalWidth = width;
      image.naturalHeight = height;
      image.onload?.();
    },
  };
}

async function chooseBackgroundFile(
  wrapper: ReturnType<typeof mount>,
  file: File,
): Promise<void> {
  const input = wrapper.get("input[type='file']");
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file],
  });
  await input.trigger("change");
}

function pasteFiles(element: Element, files: readonly File[]): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { files },
  });
  element.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setCanvasBounds(element: Element, width = 360, height = 300): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width, height, right: width, bottom: height }),
  });
}

describe("DimensionChainPanel", () => {
  it("emits fallback on mount and generated projection on Generate", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });

    const initial = wrapper.emitted("report-projection-change");
    expect(initial).toHaveLength(1);
    expect(initial?.[0]?.[0]).toEqual({
      status: "fallback",
      sourceSignature: dimensionChainSignature(factors),
    });

    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const emitted = wrapper.emitted("report-projection-change");
    const latest = emitted?.at(-1)?.[0] as Record<string, unknown>;
    expect(latest.status).toBe("generated");
    expect(latest.orientation).toBe("horizontal");
    expect(latest.closureDirection).toBe("start-to-end");
    expect(latest.reversedFactorIds).toEqual([]);
    expect(latest).not.toHaveProperty("viewX");
    expect(latest).not.toHaveProperty("viewZoom");
    expect(latest).not.toHaveProperty("selectionMode");
    expect(latest).not.toHaveProperty("backgroundUrl");
  });

  it("emits generated projection on orientation and layout changes, and fallback when source changes", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const beforeViewOnlyChangeCount = wrapper.emitted("report-projection-change")?.length ?? 0;

    await wrapper.get("button[aria-label='Zoom in']").trigger("click");
    await wrapper.get("button[aria-label='Pan right']").trigger("click");
    expect(wrapper.emitted("report-projection-change")?.length ?? 0).toBe(beforeViewOnlyChangeCount);

    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    const afterOrientation = wrapper.emitted("report-projection-change")?.at(-1)?.[0] as Record<string, unknown>;
    expect(afterOrientation.status).toBe("generated");
    expect(afterOrientation.orientation).toBe("vertical");

    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    const guide = wrapper.get("[data-dimension-guide-handle='factor-1::factor-2']");
    dispatchPointer(guide.element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 77,
      clientY: 244,
      pointerId: 70,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 120,
      clientY: 180,
      pointerId: 70,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 120,
      clientY: 180,
      pointerId: 70,
    });
    await wrapper.vm.$nextTick();
    const afterGuide = wrapper.emitted("report-projection-change")?.at(-1)?.[0] as Record<string, unknown>;
    expect(afterGuide.status).toBe("generated");
    expect(afterGuide.manualLayout).toBeTruthy();

    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");
    await wrapper.setProps({
      factors: factors.map((entry) => ({ ...entry, designNominal: -entry.designNominal })),
    });
    const afterReverse = wrapper.emitted("report-projection-change")?.at(-1)?.[0] as Record<string, unknown>;
    expect(afterReverse.status).toBe("generated");
    expect(afterReverse.closureDirection).toBe("end-to-start");
    expect(afterReverse.reversedFactorIds).toEqual(["factor-1", "factor-2", "factor-3"]);

    await wrapper.setProps({ factors: [{ ...factors[0]!, upperTolerance: 0.25 }, ...factors.slice(1)] });
    const afterSourceChange = wrapper.emitted("report-projection-change")?.at(-1)?.[0] as Record<string, unknown>;
    expect(afterSourceChange).toEqual({
      status: "fallback",
      sourceSignature: dimensionChainSignature([{ ...factors[0]!, upperTolerance: 0.25 }, ...factors.slice(1)]),
    });
  });

  it("defers projection emission during manual drag until pointerup or pointercancel", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });

    const guide = wrapper.get("[data-dimension-guide-handle='factor-1::factor-2']");
    const beforeDragCount = wrapper.emitted("report-projection-change")?.length ?? 0;

    dispatchPointer(guide.element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 244,
      clientY: 77,
      pointerId: 501,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 254,
      clientY: 77,
      pointerId: 501,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 264,
      clientY: 77,
      pointerId: 501,
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("report-projection-change")?.length ?? 0).toBe(beforeDragCount);

    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 264,
      clientY: 77,
      pointerId: 501,
    });
    await wrapper.vm.$nextTick();

    expect((wrapper.emitted("report-projection-change")?.length ?? 0) - beforeDragCount).toBe(1);

    const beforeCancelCount = wrapper.emitted("report-projection-change")?.length ?? 0;
    dispatchPointer(guide.element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 264,
      clientY: 77,
      pointerId: 502,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 274,
      clientY: 77,
      pointerId: 502,
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("report-projection-change")?.length ?? 0).toBe(beforeCancelCount);

    dispatchPointer(canvas.element, "pointercancel", {
      button: 0,
      buttons: 0,
      clientX: 274,
      clientY: 77,
      pointerId: 502,
    });
    await wrapper.vm.$nextTick();

    expect((wrapper.emitted("report-projection-change")?.length ?? 0) - beforeCancelCount).toBe(1);
  });

  it("resets to generated projection with exact report keys after stale fallback update", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });

    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");

    await wrapper.setProps({ factors: [{ ...factors[0]!, designNominal: 7 }, ...factors.slice(1)] });
    const staleProjection = wrapper.emitted("report-projection-change")?.at(-1)?.[0] as Record<string, unknown>;
    expect(staleProjection).toEqual({
      status: "fallback",
      sourceSignature: dimensionChainSignature([{ ...factors[0]!, designNominal: 7 }, ...factors.slice(1)]),
    });

    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const latest = wrapper.emitted("report-projection-change")?.at(-1)?.[0] as Record<string, unknown>;

    expect(latest).toEqual({
      status: "generated",
      sourceSignature: dimensionChainSignature([{ ...factors[0]!, designNominal: 7 }, ...factors.slice(1)]),
      orientation: "vertical",
      factors: [
        {
          id: "factor-1",
          itemNumber: 1,
          name: "Factor 1",
          designNominal: 7,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
        {
          id: "factor-2",
          itemNumber: 2,
          name: "Factor 2",
          designNominal: -1,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
        {
          id: "factor-3",
          itemNumber: 3,
          name: "Factor 3",
          designNominal: 0.5,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
      ],
      manualLayout: {
        boundaryOffsets: {},
        laneOffsets: {},
      },
      reversedFactorIds: [],
      closureDirection: "start-to-end",
    });

    expect(latest).not.toHaveProperty("viewX");
    expect(latest).not.toHaveProperty("viewY");
    expect(latest).not.toHaveProperty("viewZoom");
    expect(latest).not.toHaveProperty("selectionMode");
    expect(latest).not.toHaveProperty("backgroundUrl");
    expect(latest).not.toHaveProperty("toolState");
    expect(latest).not.toHaveProperty("blob");
  });

  it("enables generation and orientation only while Factor Setup is editable", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: false },
    });
    const generate = wrapper.get("[data-generate-dimension-chain]");
    const horizontal = wrapper.get("button[aria-label='Horizontal dimension chain']");
    const vertical = wrapper.get("button[aria-label='Vertical dimension chain']");

    expect(generate.attributes("disabled")).toBeDefined();
    expect(horizontal.attributes("disabled")).toBeDefined();
    expect(vertical.attributes("disabled")).toBeDefined();

    await wrapper.setProps({ editable: true });
    expect(generate.attributes("disabled")).toBeUndefined();
    expect(horizontal.attributes("disabled")).toBeUndefined();
    expect(vertical.attributes("disabled")).toBeUndefined();

    await wrapper.setProps({ valid: false });
    expect(generate.attributes("disabled")).toBeDefined();
    expect(horizontal.attributes("disabled")).toBeUndefined();
    expect(vertical.attributes("disabled")).toBeUndefined();
  });

  it("generates a labeled cumulative chain with component and closure arrows", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });

    expect(wrapper.find("[data-dimension-chain-svg]").exists()).toBe(false);
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.findAll("[data-dimension-segment]")).toHaveLength(3);
    expect(wrapper.findAll("[data-dimension-start]")).toHaveLength(3);
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("additive");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-direction")).toBe("subtractive");
    expect(wrapper.get("[data-dimension-segment='1']").classes()).toContain("dimension-chain-additive");
    expect(wrapper.get("[data-dimension-segment='2']").classes()).toContain("dimension-chain-subtractive");
    expect(wrapper.find("[data-dimension-origin-guide]").exists()).toBe(false);
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
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
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
    const wrapper = mount(DimensionChainPanel, { props: { factors: initial, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-length")).toBe("36");

    await wrapper.setProps({ factors: [factor(1, 2), factor(2, 1)] });
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-length")).toBe("36");
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-length")).toBe("90");
  });

  it("switches orientation without making the generated snapshot stale", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");

    expect(wrapper.get("button[aria-label='Vertical dimension chain']").attributes("aria-pressed")).toBe("true");
    expect(wrapper.get("[data-dimension-chain-svg]").attributes("data-orientation")).toBe("vertical");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(false);
  });

  it("keeps the two arrow label lines at normal line spacing in both orientations", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const lineGap = () => {
      const segment = wrapper.get("[data-dimension-segment='1']");
      return Number(segment.get(".dimension-chain-factor-name").attributes("y"))
        - Number(segment.get(".dimension-chain-label").attributes("y"));
    };

    expect(lineGap()).toBe(8);
    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    expect(lineGap()).toBe(8);
  });

  it("keeps viewport controls without exposing a page-layout expansion action", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Zoom in']").trigger("click");

    const svg = wrapper.get("[data-dimension-chain-svg]");
    expect(Number(svg.attributes("data-view-zoom"))).toBeGreaterThan(1);
    expect(wrapper.find("button[aria-label='Expand Dimension Chain']").exists()).toBe(false);
    expect(wrapper.find("button[aria-label='Restore split layout']").exists()).toBe(false);
  });

  it("uses toolbar pan, bounds zoom, selects a local view, and restores the full view", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const title = wrapper.get("#dimension-chain-title");
    expect(title.element.parentElement?.classList).toContain("dimension-chain-titlebar");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const svg = wrapper.get("[data-dimension-chain-svg]");
    expect(canvas.classes()).not.toContain("is-pannable");
    expect(svg.attributes("data-view-zoom")).toBe("1");

    await wrapper.get("button[aria-label='Pan right']").trigger("click");
    expect(Number(svg.attributes("data-view-x"))).toBeGreaterThan(0);
    await wrapper.get("button[aria-label='Pan left']").trigger("click");
    expect(svg.attributes("data-view-x")).toBe("0");

    for (let index = 0; index < 20; index += 1) {
      await wrapper.get("button[aria-label='Zoom in']").trigger("click");
    }
    expect(svg.attributes("data-view-zoom")).toBe("2.5");
    for (let index = 0; index < 40; index += 1) {
      await wrapper.get("button[aria-label='Zoom out']").trigger("click");
    }
    expect(svg.attributes("data-view-zoom")).toBe("0.25");

    await wrapper.get("button[aria-label='Fit full dimension chain']").trigger("click");
    expect(svg.attributes("data-view-zoom")).toBe("1");
    expect(svg.attributes("data-view-x")).toBe("0");
    expect(svg.attributes("data-view-y")).toBe("0");

    Object.defineProperty(canvas.element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) }),
    });
    const wheelEvent = new WheelEvent("wheel", { cancelable: true, deltaY: -100, clientX: 180, clientY: 180 });
    expect(canvas.element.dispatchEvent(wheelEvent)).toBe(true);
    await wrapper.vm.$nextTick();
    expect(svg.attributes("data-view-zoom")).toBe("1");

    await wrapper.get("button[aria-label='Zoom in']").trigger("click");
    expect(Number(svg.attributes("data-view-zoom"))).toBeGreaterThan(1);

    const selectButton = wrapper.get("button[aria-label='Select area to zoom']");
    await selectButton.trigger("click");
    expect(selectButton.attributes("aria-pressed")).toBe("true");
    expect(canvas.classes()).toContain("is-selecting");
    dispatchPointer(canvas.element, "pointerdown", { button: 0, buttons: 1, clientX: 40, clientY: 40, pointerId: 1 });
    dispatchPointer(canvas.element, "pointermove", { button: 0, buttons: 1, clientX: 180, clientY: 160, pointerId: 1 });
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-dimension-chain-selection]").exists()).toBe(true);
    dispatchPointer(canvas.element, "pointerup", { button: 0, buttons: 0, clientX: 180, clientY: 160, pointerId: 1 });
    await wrapper.vm.$nextTick();
    expect(Number(svg.attributes("data-view-zoom"))).toBeGreaterThan(1);
    expect(selectButton.attributes("aria-pressed")).toBe("false");
  });

  it("keeps the viewport unchanged when the left button drags empty canvas", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const svg = wrapper.get("[data-dimension-chain-svg]");
    Object.defineProperty(canvas.element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) }),
    });
    const initialX = svg.attributes("data-view-x");
    const initialY = svg.attributes("data-view-y");

    dispatchPointer(canvas.element, "pointerdown", { button: 0, buttons: 1, clientX: 180, clientY: 180, pointerId: 4 });
    await wrapper.vm.$nextTick();
    expect(canvas.classes()).not.toContain("is-panning");
    dispatchPointer(canvas.element, "pointermove", { button: 0, buttons: 1, clientX: 120, clientY: 100, pointerId: 4 });
    dispatchPointer(canvas.element, "pointerup", { button: 0, buttons: 0, clientX: 120, clientY: 100, pointerId: 4 });
    await wrapper.vm.$nextTick();

    expect(svg.attributes("data-view-x")).toBe(initialX);
    expect(svg.attributes("data-view-y")).toBe(initialY);
    expect(canvas.classes()).not.toContain("is-panning");
  });

  it("pans empty canvas only with the middle button", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const svg = wrapper.get("[data-dimension-chain-svg]");
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperties(canvas.element, {
      getBoundingClientRect: {
        configurable: true,
        value: () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) }),
      },
      setPointerCapture: { configurable: true, value: setPointerCapture },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });

    dispatchPointer(canvas.element, "pointerdown", { button: 1, buttons: 4, clientX: 180, clientY: 180, pointerId: 7 });
    await wrapper.vm.$nextTick();
    expect(canvas.classes()).toContain("is-panning");
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(((wrapper.vm.$ as unknown as { setupState: Record<string, unknown> }).setupState).interaction).toEqual({
      kind: "pan",
      pointerId: 7,
    });

    const initialX = svg.attributes("data-view-x");
    const initialY = svg.attributes("data-view-y");
    dispatchPointer(canvas.element, "pointermove", { button: 1, buttons: 4, clientX: 60, clientY: 40, pointerId: 9 });
    dispatchPointer(canvas.element, "pointercancel", { button: 1, buttons: 0, clientX: 60, clientY: 40, pointerId: 9 });
    dispatchPointer(canvas.element, "pointerup", { button: 1, buttons: 0, clientX: 60, clientY: 40, pointerId: 9 });
    await wrapper.vm.$nextTick();
    expect(svg.attributes("data-view-x")).toBe(initialX);
    expect(svg.attributes("data-view-y")).toBe(initialY);
    expect(canvas.classes()).toContain("is-panning");
    expect(releasePointerCapture).not.toHaveBeenCalled();

    dispatchPointer(canvas.element, "pointermove", { button: 1, buttons: 4, clientX: 120, clientY: 100, pointerId: 7 });
    await wrapper.vm.$nextTick();
    expect(Number(svg.attributes("data-view-x"))).toBeGreaterThan(0);
    expect(Number(svg.attributes("data-view-y"))).toBeGreaterThan(0);

    dispatchPointer(canvas.element, "pointerup", { button: 1, buttons: 0, clientX: 120, clientY: 100, pointerId: 7 });
    await wrapper.vm.$nextTick();
    expect(canvas.classes()).not.toContain("is-panning");
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("finishes the owner pan when a real pointermove reports no pressed buttons", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const releasePointerCapture = vi.fn();
    Object.defineProperties(canvas.element, {
      getBoundingClientRect: {
        configurable: true,
        value: () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) }),
      },
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });

    dispatchPointer(canvas.element, "pointerdown", { button: 1, buttons: 4, clientX: 180, clientY: 180, pointerId: 10 });
    dispatchPointer(canvas.element, "pointermove", { button: -1, buttons: 0, clientX: 160, clientY: 160, pointerId: 10 });
    await wrapper.vm.$nextTick();

    expect(canvas.classes()).not.toContain("is-panning");
    expect(releasePointerCapture).toHaveBeenCalledOnce();
    expect(releasePointerCapture).toHaveBeenCalledWith(10);
  });

  it("keeps panning when a synthetic owner move omits buttons", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const svg = wrapper.get("[data-dimension-chain-svg]");
    Object.defineProperties(canvas.element, {
      getBoundingClientRect: {
        configurable: true,
        value: () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) }),
      },
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });

    dispatchPointer(canvas.element, "pointerdown", { button: 1, buttons: 4, clientX: 180, clientY: 180, pointerId: 11 });
    dispatchPointer(canvas.element, "pointermove", { clientX: 120, clientY: 100, pointerId: 11 });
    await wrapper.vm.$nextTick();

    expect(canvas.classes()).toContain("is-panning");
    expect(Number(svg.attributes("data-view-x"))).toBeGreaterThan(0);
    expect(Number(svg.attributes("data-view-y"))).toBeGreaterThan(0);
  });

  it("clears a lost pointer capture without releasing it again", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const releasePointerCapture = vi.fn();
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });

    dispatchPointer(canvas.element, "pointerdown", { button: 1, buttons: 4, clientX: 180, clientY: 180, pointerId: 12 });
    await wrapper.vm.$nextTick();
    expect(canvas.classes()).toContain("is-panning");

    dispatchPointer(canvas.element, "lostpointercapture", { pointerId: 12 });
    dispatchPointer(canvas.element, "pointerup", { button: 1, buttons: 0, clientX: 180, clientY: 180, pointerId: 12 });
    await wrapper.vm.$nextTick();

    expect(canvas.classes()).not.toContain("is-panning");
    expect(releasePointerCapture).not.toHaveBeenCalled();
  });

  it("preserves a pre-enabled selection mode after middle-button panning", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const selectButton = wrapper.get("button[aria-label='Select area to zoom']");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    await selectButton.trigger("click");

    dispatchPointer(canvas.element, "pointerdown", { button: 1, buttons: 4, clientX: 180, clientY: 180, pointerId: 13 });
    dispatchPointer(canvas.element, "pointerup", { button: 1, buttons: 0, clientX: 180, clientY: 180, pointerId: 13 });
    await wrapper.vm.$nextTick();

    expect(selectButton.attributes("aria-pressed")).toBe("true");
    expect(canvas.classes()).toContain("is-selecting");
  });

  it("lets only the owner pointer move and finish a selection drag", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const selectButton = wrapper.get("button[aria-label='Select area to zoom']");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const svg = wrapper.get("[data-dimension-chain-svg]");
    const releasePointerCapture = vi.fn();
    Object.defineProperties(canvas.element, {
      getBoundingClientRect: {
        configurable: true,
        value: () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) }),
      },
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });
    await selectButton.trigger("click");

    dispatchPointer(canvas.element, "pointerdown", { button: 0, buttons: 1, clientX: 40, clientY: 40, pointerId: 14 });
    dispatchPointer(canvas.element, "pointermove", { button: 0, buttons: 1, clientX: 180, clientY: 160, pointerId: 15 });
  dispatchPointer(canvas.element, "pointercancel", { button: 0, buttons: 0, clientX: 180, clientY: 160, pointerId: 15 });
    dispatchPointer(canvas.element, "pointerup", { button: 0, buttons: 0, clientX: 180, clientY: 160, pointerId: 15 });
    await wrapper.vm.$nextTick();
    const untouchedSelection = wrapper.get("[data-dimension-chain-selection]");
    expect(untouchedSelection.attributes("width")).toBe("0");
    expect(untouchedSelection.attributes("height")).toBe("0");
    expect(selectButton.attributes("aria-pressed")).toBe("true");
    expect(releasePointerCapture).not.toHaveBeenCalled();

    dispatchPointer(canvas.element, "pointermove", { button: 0, buttons: 1, clientX: 180, clientY: 160, pointerId: 14 });
    dispatchPointer(canvas.element, "pointerup", { button: 0, buttons: 0, clientX: 180, clientY: 160, pointerId: 14 });
    await wrapper.vm.$nextTick();

    expect(Number(svg.attributes("data-view-zoom"))).toBeGreaterThan(1);
    expect(selectButton.attributes("aria-pressed")).toBe("false");
    expect(releasePointerCapture).toHaveBeenCalledWith(14);
  });

  it("stops panning when the middle-button pointer is cancelled", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const svg = wrapper.get("[data-dimension-chain-svg]");
    const releasePointerCapture = vi.fn();
    Object.defineProperties(canvas.element, {
      getBoundingClientRect: {
        configurable: true,
        value: () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) }),
      },
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });

    dispatchPointer(canvas.element, "pointerdown", { button: 1, buttons: 4, clientX: 180, clientY: 180, pointerId: 8 });
    await wrapper.vm.$nextTick();
    expect(canvas.classes()).toContain("is-panning");

    dispatchPointer(canvas.element, "pointercancel", { button: 1, buttons: 0, clientX: 180, clientY: 180, pointerId: 8 });
    await wrapper.vm.$nextTick();
    expect(releasePointerCapture).toHaveBeenCalledWith(8);
    expect(canvas.classes()).not.toContain("is-panning");

    const cancelledViewX = svg.attributes("data-view-x");
    const cancelledViewY = svg.attributes("data-view-y");
    dispatchPointer(canvas.element, "pointermove", { button: 1, buttons: 4, clientX: 120, clientY: 100, pointerId: 8 });
    await wrapper.vm.$nextTick();
    expect(svg.attributes("data-view-x")).toBe(cancelledViewX);
    expect(svg.attributes("data-view-y")).toBe(cancelledViewY);
  });

  it("uses the raw Factor Setup signature to detect non-geometric changes", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true, sourceSignature: "original-drafts" },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    await wrapper.setProps({ sourceSignature: "changed-drafts" });

    expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
  });

  it("emits reverse-all only when editable and valid", async () => {
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });
    const reverse = wrapper.get("button[aria-label='Reverse all factors']");

    expect(reverse.attributes("title")).toBe("Reverse all factors");
    expect(reverse.find("svg").exists()).toBe(true);
    expect(reverse.attributes("disabled")).toBeDefined();
    await reverse.trigger("click");
    expect(wrapper.emitted("reverse-all")).toBeUndefined();

    await wrapper.setProps({ editable: true, valid: false });
    expect(reverse.attributes("disabled")).toBeDefined();
    await reverse.trigger("click");
    expect(wrapper.emitted("reverse-all")).toBeUndefined();

    await wrapper.setProps({ valid: true });
    expect(reverse.attributes("disabled")).toBeUndefined();
    await reverse.trigger("click");
    expect(wrapper.emitted("reverse-all")).toHaveLength(1);
  });

  it("emits reverse-all before generation without creating a snapshot when parent signs return", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    const reverse = wrapper.get("button[aria-label='Reverse all factors']");

    expect(reverse.element.parentElement?.classList).toContain("dimension-chain-toolbar");
    expect(wrapper.find("[data-dimension-chain-svg]").exists()).toBe(false);
    await reverse.trigger("click");
    expect(wrapper.emitted("reverse-all")).toHaveLength(1);

    await expect(wrapper.setProps({
      factors: factors.map((entry) => ({ ...entry, designNominal: -entry.designNominal })),
    })).resolves.toBeUndefined();
    expect(wrapper.find("[data-dimension-chain-svg]").exists()).toBe(false);
  });

  it("marks a generated snapshot stale without synchronizing external sign-only changes", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    await wrapper.setProps({
      factors: factors.map((entry) => ({ ...entry, designNominal: -entry.designNominal })),
    });

    expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("2");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("additive");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-value")).toBe("-1");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-direction")).toBe("subtractive");
  });

  it("keeps reversed arrows connected head-to-tail through their shared guides", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    const firstGuide = wrapper.get("[data-dimension-guide-handle='factor-1::factor-2']");
    dispatchPointer(firstGuide.element, "pointerdown", {
      button: 0, buttons: 1, clientX: 244, clientY: 77, pointerId: 42,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 44, clientY: 77, pointerId: 42,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 44, clientY: 77, pointerId: 42,
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("subtractive");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-direction")).toBe("additive");

    const positionsBefore = wrapper.findAll("[data-dimension-segment] .dimension-chain-component")
      .map((line) => ({
        x1: line.attributes("x1"), x2: line.attributes("x2"),
        y1: line.attributes("y1"), y2: line.attributes("y2"),
      }));
    const guidesBefore = wrapper.findAll("[data-dimension-guide-handle]").map((guide) => ({
      x1: guide.attributes("x1"), x2: guide.attributes("x2"),
      y1: guide.attributes("y1"), y2: guide.attributes("y2"),
    }));
    const closureBefore = wrapper.get("[data-dimension-closure]");
    const closurePositionBefore = {
      x1: closureBefore.attributes("x1"), x2: closureBefore.attributes("x2"),
      y1: closureBefore.attributes("y1"), y2: closureBefore.attributes("y2"),
    };
    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    const verticalClosureBefore = wrapper.get("[data-dimension-closure]");
    const verticalClosurePositionBefore = {
      x1: verticalClosureBefore.attributes("x1"), x2: verticalClosureBefore.attributes("x2"),
      y1: verticalClosureBefore.attributes("y1"), y2: verticalClosureBefore.attributes("y2"),
    };
    await wrapper.get("button[aria-label='Horizontal dimension chain']").trigger("click");
    await wrapper.get("button[aria-label='Zoom in']").trigger("click");
    const zoomBefore = wrapper.get("[data-dimension-chain-svg]").attributes("data-view-zoom");

    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");
    await wrapper.setProps({
      factors: factors.map((entry) => ({ ...entry, designNominal: -entry.designNominal })),
    });

    const first = wrapper.get("[data-dimension-segment='1']");
    const second = wrapper.get("[data-dimension-segment='2']");
    const last = wrapper.get("[data-dimension-segment='3']");
    expect(first.attributes("data-value")).toBe("-2");
    expect(first.attributes("data-direction")).toBe("additive");
    expect(first.classes()).toContain("dimension-chain-additive");
    expect(second.attributes("data-value")).toBe("1");
    expect(second.attributes("data-direction")).toBe("subtractive");
    expect(second.classes()).toContain("dimension-chain-subtractive");
    expect(last.attributes("data-value")).toBe("-0.5");
    expect(last.attributes("data-direction")).toBe("subtractive");
    expect(last.classes()).toContain("dimension-chain-subtractive");

    const segments = wrapper.findAll("[data-dimension-segment]");
    const guides = wrapper.findAll("[data-dimension-guide-handle]");
    expect(segments.map((segment) => {
      const line = segment.get(".dimension-chain-component");
      return {
        x1: line.attributes("x1"), x2: line.attributes("x2"),
        y1: line.attributes("y1"), y2: line.attributes("y2"),
      };
    })).toEqual(positionsBefore.map(({ x1, x2, y1, y2 }) => ({ x1: x2, x2: x1, y1: y2, y2: y1 })));
    expect(guides.map((guide) => ({
      x1: guide.attributes("x1"), x2: guide.attributes("x2"),
      y1: guide.attributes("y1"), y2: guide.attributes("y2"),
    }))).toEqual(guidesBefore);
    const closure = wrapper.get("[data-dimension-closure]");
    expect({
      x1: closure.attributes("x1"), x2: closure.attributes("x2"),
      y1: closure.attributes("y1"), y2: closure.attributes("y2"),
    }).toEqual({
      x1: closurePositionBefore.x2, x2: closurePositionBefore.x1,
      y1: closurePositionBefore.y2, y2: closurePositionBefore.y1,
    });
    const closureStartGuide = wrapper.get("[data-dimension-closure-guide-handle='start']");
    const closureEndGuide = wrapper.get("[data-dimension-closure-guide-handle='end']");
    const firstLine = segments[0]!.get(".dimension-chain-component");
    const lastLine = segments[segments.length - 1]!.get(".dimension-chain-component");
    expect(lastLine.attributes("x1")).toBe(closureStartGuide.attributes("x1"));
    expect(closure.attributes("x2")).toBe(closureStartGuide.attributes("x2"));
    expect(closure.attributes("x1")).toBe(closureEndGuide.attributes("x2"));
    expect(firstLine.attributes("x2")).toBe(closureEndGuide.attributes("x1"));
    for (let index = 0; index < guides.length; index += 1) {
      const previousLine = segments[index]!.get(".dimension-chain-component");
      const nextLine = segments[index + 1]!.get(".dimension-chain-component");
      const guide = guides[index]!;
      const previousHeadAtGuide = previousLine.attributes("x2") === guide.attributes("x1")
        && previousLine.attributes("y2") === guide.attributes("y1");
      const nextHeadAtGuide = nextLine.attributes("x2") === guide.attributes("x2")
        && nextLine.attributes("y2") === guide.attributes("y2");
      expect(previousHeadAtGuide).not.toBe(nextHeadAtGuide);
    }
    expect(wrapper.get("[data-dimension-chain-svg]").attributes("data-view-zoom")).toBe(zoomBefore);
    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    const verticalClosure = wrapper.get("[data-dimension-closure]");
    expect({
      x1: verticalClosure.attributes("x1"), x2: verticalClosure.attributes("x2"),
      y1: verticalClosure.attributes("y1"), y2: verticalClosure.attributes("y2"),
    }).toEqual({
      x1: verticalClosurePositionBefore.x2, x2: verticalClosurePositionBefore.x1,
      y1: verticalClosurePositionBefore.y2, y2: verticalClosurePositionBefore.y1,
    });
    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");
    await wrapper.setProps({ factors });
    expect({
      x1: verticalClosure.attributes("x1"), x2: verticalClosure.attributes("x2"),
      y1: verticalClosure.attributes("y1"), y2: verticalClosure.attributes("y2"),
    }).toEqual(verticalClosurePositionBefore);
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(false);
  });

  it("requires all pending signs in the same parent snapshot before synchronizing", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");

    await wrapper.setProps({
      factors: [{ ...factors[0]!, designNominal: -2 }, ...factors.slice(1)],
    });
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("2");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-value")).toBe("-1");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(true);

    await wrapper.setProps({
      factors: [factors[0]!, { ...factors[1]!, designNominal: 1 }, factors[2]!],
    });
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("2");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-value")).toBe("-1");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(true);

    await wrapper.setProps({
      factors: factors.map((entry) => ({ ...entry, designNominal: -entry.designNominal })),
    });
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("-2");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-value")).toBe("1");
    expect(wrapper.get("[data-dimension-segment='3']").attributes("data-value")).toBe("-0.5");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(false);
  });

  it("clears a pending reverse when Update replaces the generated snapshot", async () => {
    const initial = [factor(1, 2), factor(2, -1)];
    const wrapper = mount(DimensionChainPanel, {
      props: { factors: initial, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");

    await wrapper.setProps({ factors: [factor(1, 9), factor(2, -1)] });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("9");

    await wrapper.setProps({ factors: [factor(1, -9), factor(2, 1)] });

    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("9");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-value")).toBe("-1");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(true);
  });

  it("cancels pending synchronization when the factor ID set changes", async () => {
    const initial = [factor(1, 2), factor(2, -1)];
    const wrapper = mount(DimensionChainPanel, {
      props: { factors: initial, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");

    await wrapper.setProps({ factors: [factor(1, -2), factor(3, 4)] });
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("2");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-value")).toBe("-1");

    await wrapper.setProps({ factors: [factor(1, -2), factor(2, 1)] });

    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("2");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-value")).toBe("-1");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(true);
  });

  it("does not create a pending transaction when every generated factor is zero", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors: [factor(1, 0), factor(2, 0)], valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");

    const setupState = (wrapper.vm.$ as unknown as { setupState: Record<string, unknown> }).setupState;
    expect(setupState.pendingSignSync).toBeUndefined();
  });

  it("keeps an existing non-sign stale condition after pending signs return", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const staleFactors = [{ ...factors[0]!, upperTolerance: 0.25 }, ...factors.slice(1)];
    await wrapper.setProps({ factors: staleFactors });
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(true);

    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");
    await wrapper.setProps({
      factors: staleFactors.map((entry, index) => ({
        ...entry,
        designNominal: index === 0 ? -9 : -entry.designNominal,
      })),
    });

    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("-2");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("subtractive");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(true);
  });

  it("does not expose a layout reset control", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.find("button[aria-label='Reset layout']").exists()).toBe(false);
  });

  it("keeps a shared guide at its dragged position without changing factor signs", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: setPointerCapture },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });
    const bubbledPointerDown = vi.fn();
    canvas.element.addEventListener("pointerdown", bubbledPointerDown);
    const guide = wrapper.get("[data-dimension-guide-handle='factor-1::factor-2']");

    expect(guide.attributes("tabindex")).toBe("0");
    expect(guide.attributes("aria-label")).toContain("Factor 1");
    dispatchPointer(guide.element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 244,
      clientY: 77,
      pointerId: 21,
    });
    await wrapper.vm.$nextTick();
    expect(setPointerCapture).toHaveBeenCalledWith(21);
    expect(bubbledPointerDown).not.toHaveBeenCalled();
    expect(guide.classes()).toContain("is-selected");
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 44,
      clientY: 177,
      pointerId: 99,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 44,
      clientY: 177,
      pointerId: 99,
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-display-end")).toBe("180");
    expect(releasePointerCapture).not.toHaveBeenCalled();
    expect(wrapper.emitted("factor-sign-change")).toBeUndefined();

    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 44,
      clientY: 177,
      pointerId: 21,
    });
    await wrapper.vm.$nextTick();

    const first = wrapper.get("[data-dimension-segment='1']");
    const second = wrapper.get("[data-dimension-segment='2']");
    expect(first.attributes("data-display-end")).toBe("-20");
    expect(second.attributes("data-display-start")).toBe("-20");
    expect(first.attributes("data-direction")).toBe("subtractive");
    expect(first.classes()).toContain("dimension-chain-subtractive");
    expect(second.attributes("data-direction")).toBe("additive");
    expect(wrapper.emitted("factor-sign-change")).toBeUndefined();

    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 44,
      clientY: 177,
      pointerId: 21,
    });
    await wrapper.vm.$nextTick();
    expect(releasePointerCapture).toHaveBeenCalledWith(21);
    expect(guide.classes()).not.toContain("is-selected");
    expect(first.attributes("data-display-end")).toBe("-20");
    expect(second.attributes("data-display-start")).toBe("-20");
    expect(wrapper.emitted("factor-sign-change")).toBeUndefined();
    const setupState = (wrapper.vm.$ as unknown as { setupState: Record<string, unknown> }).setupState;
    expect(setupState.pendingSignSync).toBeUndefined();
  });

  it("rolls a guide preview back on pointercancel and Escape without emitting", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    const guide = wrapper.get("[data-dimension-guide-handle='factor-1::factor-2']");

    dispatchPointer(guide.element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 244,
      clientY: 77,
      pointerId: 22,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 44,
      clientY: 77,
      pointerId: 22,
    });
    dispatchPointer(canvas.element, "pointercancel", {
      button: 0,
      buttons: 0,
      clientX: 44,
      clientY: 77,
      pointerId: 22,
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-display-end")).toBe("180");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-display-start")).toBe("180");

    dispatchPointer(guide.element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 244,
      clientY: 77,
      pointerId: 23,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 44,
      clientY: 77,
      pointerId: 23,
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-display-end")).toBe("180");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("additive");
    expect(wrapper.emitted("factor-sign-change")).toBeUndefined();
  });

  it("drags each arrow only along its orientation-specific perpendicular lane", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    const horizontalSegment = wrapper.get("[data-dimension-segment='2']");
    const horizontalLine = horizontalSegment.get(".dimension-chain-component");
    const horizontalPoint = horizontalSegment.get("[data-dimension-start]");
    const horizontalTexts = horizontalSegment.findAll("text");
    const originalHorizontal = {
      x1: horizontalLine.attributes("x1"),
      x2: horizontalLine.attributes("x2"),
      y1: Number(horizontalLine.attributes("y1")),
      pointY: Number(horizontalPoint.attributes("cy")),
      labelY: Number(horizontalTexts[0]!.attributes("y")),
      nameY: Number(horizontalTexts[1]!.attributes("y")),
      value: horizontalSegment.attributes("data-value"),
      start: horizontalSegment.attributes("data-display-start"),
      end: horizontalSegment.attributes("data-display-end"),
      direction: horizontalSegment.attributes("data-direction"),
    };
    const horizontalHandle = wrapper.get("[data-dimension-arrow-handle='factor-2']");
    expect(horizontalHandle.attributes("tabindex")).toBe("0");
    expect(horizontalHandle.attributes("aria-label")).toContain("Factor 2");

    dispatchPointer(horizontalHandle.element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 199,
      clientY: 106,
      pointerId: 24,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 299,
      clientY: 141,
      pointerId: 24,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 299,
      clientY: 141,
      pointerId: 24,
    });
    await wrapper.vm.$nextTick();

    expect(horizontalSegment.attributes("data-lane-offset")).toBe("35");
    expect(horizontalLine.attributes("x1")).toBe(originalHorizontal.x1);
    expect(horizontalLine.attributes("x2")).toBe(originalHorizontal.x2);
    expect(Number(horizontalLine.attributes("y1"))).toBe(originalHorizontal.y1 + 35);
    expect(Number(horizontalPoint.attributes("cy"))).toBe(originalHorizontal.pointY + 35);
    expect(Number(horizontalTexts[0]!.attributes("y"))).toBe(originalHorizontal.labelY + 35);
    expect(Number(horizontalTexts[1]!.attributes("y"))).toBe(originalHorizontal.nameY + 35);
    expect(horizontalSegment.attributes("data-value")).toBe(originalHorizontal.value);
    expect(horizontalSegment.attributes("data-display-start")).toBe(originalHorizontal.start);
    expect(horizontalSegment.attributes("data-display-end")).toBe(originalHorizontal.end);
    expect(horizontalSegment.attributes("data-direction")).toBe(originalHorizontal.direction);
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-lane-offset")).toBe("0");

    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    const verticalSegment = wrapper.get("[data-dimension-segment='2']");
    const verticalLine = verticalSegment.get(".dimension-chain-component");
    const verticalPoint = verticalSegment.get("[data-dimension-start]");
    const verticalTexts = verticalSegment.findAll("text");
    const originalVertical = {
      x1: Number(verticalLine.attributes("x1")),
      pointX: Number(verticalPoint.attributes("cx")),
      labelX: Number(verticalTexts[0]!.attributes("x")),
      nameX: Number(verticalTexts[1]!.attributes("x")),
      y1: verticalLine.attributes("y1"),
      y2: verticalLine.attributes("y2"),
    };
    expect(verticalSegment.attributes("data-lane-offset")).toBe("0");

    dispatchPointer(wrapper.get("[data-dimension-arrow-handle='factor-2']").element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 106,
      clientY: 199,
      pointerId: 25,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 146,
      clientY: 299,
      pointerId: 25,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 146,
      clientY: 299,
      pointerId: 25,
    });
    await wrapper.vm.$nextTick();

    expect(verticalSegment.attributes("data-lane-offset")).toBe("40");
    expect(Number(verticalLine.attributes("x1"))).toBe(originalVertical.x1 + 40);
    expect(Number(verticalPoint.attributes("cx"))).toBe(originalVertical.pointX + 40);
    expect(Number(verticalTexts[0]!.attributes("x"))).toBe(originalVertical.labelX + 40);
    expect(Number(verticalTexts[1]!.attributes("x"))).toBe(originalVertical.nameX + 40);
    expect(verticalLine.attributes("y1")).toBe(originalVertical.y1);
    expect(verticalLine.attributes("y2")).toBe(originalVertical.y2);
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-lane-offset")).toBe("0");

    await wrapper.get("button[aria-label='Horizontal dimension chain']").trigger("click");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-lane-offset")).toBe("35");
  });

  it("moves both closure guides and the closure arrow independently without changing factor data", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    const closure = wrapper.get("[data-dimension-closure-loop]");
    const startGuide = wrapper.get("[data-dimension-closure-guide-handle='start']");
    const endGuide = wrapper.get("[data-dimension-closure-guide-handle='end']");
    const arrow = wrapper.get("[data-dimension-closure-arrow-handle]");

    expect(startGuide.attributes("tabindex")).toBe("0");
    expect(endGuide.attributes("tabindex")).toBe("0");
    expect(arrow.attributes("tabindex")).toBe("0");
    expect(startGuide.attributes("aria-label")).toBe("Move Closure start guide");
    expect(endGuide.attributes("aria-label")).toBe("Move Closure end guide");
    expect(arrow.attributes("aria-label")).toBe("Move Closure arrow lane");

    dispatchPointer(startGuide.element, "pointerdown", {
      button: 0, buttons: 1, clientX: 199, clientY: 222, pointerId: 30,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 219, clientY: 222, pointerId: 30,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 219, clientY: 222, pointerId: 30,
    });
    await wrapper.vm.$nextTick();
    expect(closure.attributes("data-start-offset")).toBe("20");
    expect(closure.attributes("data-end-offset")).toBe("0");
    expect(closure.attributes("data-lane-offset")).toBe("0");
    expect(startGuide.attributes("x1")).toBe(startGuide.attributes("x2"));
    expect(
      wrapper.get("[data-dimension-segment='3'] .dimension-chain-component").attributes("x2"),
    ).toBe(startGuide.attributes("x2"));

    dispatchPointer(endGuide.element, "pointerdown", {
      button: 0, buttons: 1, clientX: 64, clientY: 222, pointerId: 31,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 49, clientY: 222, pointerId: 31,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 49, clientY: 222, pointerId: 31,
    });
    await wrapper.vm.$nextTick();
    expect(closure.attributes("data-start-offset")).toBe("20");
    expect(closure.attributes("data-end-offset")).toBe("-15");
    expect(closure.attributes("data-lane-offset")).toBe("0");
    expect(endGuide.attributes("x1")).toBe(endGuide.attributes("x2"));
    expect(
      wrapper.get("[data-dimension-segment='1'] .dimension-chain-component").attributes("x1"),
    ).toBe(endGuide.attributes("x2"));

    dispatchPointer(arrow.element, "pointerdown", {
      button: 0, buttons: 1, clientX: 130, clientY: 222, pointerId: 32,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 130, clientY: 252, pointerId: 32,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 130, clientY: 252, pointerId: 32,
    });
    await wrapper.vm.$nextTick();
    expect(closure.attributes("data-start-offset")).toBe("20");
    expect(closure.attributes("data-end-offset")).toBe("-15");
    expect(closure.attributes("data-lane-offset")).toBe("30");
    expect(wrapper.emitted("factor-sign-change")).toBeUndefined();

    dispatchPointer(wrapper.get("[data-dimension-arrow-handle='factor-2']").element, "pointerdown", {
      button: 0, buttons: 1, clientX: 100, clientY: 100, pointerId: 35,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 100, clientY: 110, pointerId: 35,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 100, clientY: 110, pointerId: 35,
    });
    await wrapper.vm.$nextTick();
    expect(closure.attributes("data-start-offset")).toBe("20");
    expect(closure.attributes("data-end-offset")).toBe("-15");
    expect(closure.attributes("data-lane-offset")).toBe("30");

    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    dispatchPointer(wrapper.get("[data-dimension-closure-guide-handle='start']").element, "pointerdown", {
      button: 0, buttons: 1, clientX: 222, clientY: 199, pointerId: 33,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 222, clientY: 211, pointerId: 33,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 222, clientY: 211, pointerId: 33,
    });
    dispatchPointer(wrapper.get("[data-dimension-closure-arrow-handle]").element, "pointerdown", {
      button: 0, buttons: 1, clientX: 222, clientY: 130, pointerId: 34,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 238, clientY: 130, pointerId: 34,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 238, clientY: 130, pointerId: 34,
    });
    await wrapper.vm.$nextTick();
    expect(Number(closure.attributes("data-start-offset"))).toBeCloseTo(14.4, 10);
    expect(closure.attributes("data-end-offset")).toBe("0");
    expect(closure.attributes("data-lane-offset")).toBe("16");
    const verticalStartGuide = wrapper.get("[data-dimension-closure-guide-handle='start']");
    expect(verticalStartGuide.attributes("y1")).toBe(verticalStartGuide.attributes("y2"));
    expect(
      wrapper.get("[data-dimension-segment='3'] .dimension-chain-component").attributes("y2"),
    ).toBe(verticalStartGuide.attributes("y2"));
    expect(wrapper.emitted("factor-sign-change")).toBeUndefined();
  });

  it("closes the chain from the last dimension endpoint to the first dimension start", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const horizontalClosure = wrapper.get("[data-dimension-closure]");
    const horizontalStartGuide = wrapper.get("[data-dimension-closure-guide-handle='start']");
    const horizontalEndGuide = wrapper.get("[data-dimension-closure-guide-handle='end']");
    const horizontalFirst = wrapper.get("[data-dimension-segment='1'] .dimension-chain-component");
    const horizontalLast = wrapper.get("[data-dimension-segment='3'] .dimension-chain-component");
    expect(horizontalClosure.attributes("x1")).toBe(horizontalStartGuide.attributes("x2"));
    expect(horizontalClosure.attributes("x2")).toBe(horizontalEndGuide.attributes("x2"));
    expect(horizontalStartGuide.attributes("x1")).toBe(horizontalLast.attributes("x2"));
    expect(horizontalEndGuide.attributes("x1")).toBe(horizontalFirst.attributes("x1"));
    expect(wrapper.get("[data-dimension-closure-start]").attributes("cx"))
      .toBe(horizontalStartGuide.attributes("x2"));

    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    const verticalClosure = wrapper.get("[data-dimension-closure]");
    const verticalStartGuide = wrapper.get("[data-dimension-closure-guide-handle='start']");
    const verticalEndGuide = wrapper.get("[data-dimension-closure-guide-handle='end']");
    const verticalFirst = wrapper.get("[data-dimension-segment='1'] .dimension-chain-component");
    const verticalLast = wrapper.get("[data-dimension-segment='3'] .dimension-chain-component");
    expect(verticalClosure.attributes("y1")).toBe(verticalStartGuide.attributes("y2"));
    expect(verticalClosure.attributes("y2")).toBe(verticalEndGuide.attributes("y2"));
    expect(verticalStartGuide.attributes("y1")).toBe(verticalLast.attributes("y2"));
    expect(verticalEndGuide.attributes("y1")).toBe(verticalFirst.attributes("y1"));
    expect(wrapper.get("[data-dimension-closure-start]").attributes("cy"))
      .toBe(verticalStartGuide.attributes("y2"));

    const coincident = mount(DimensionChainPanel, {
      props: { factors: [factor(1, 1), factor(2, -1)], valid: true, editable: true },
    });
    await coincident.get("[data-generate-dimension-chain]").trigger("click");
    const coincidentClosure = coincident.get("[data-dimension-closure]");
    const coincidentHandle = coincident.get("[data-dimension-closure-arrow-handle]");
    const coincidentStartGuide = coincident.get("[data-dimension-closure-guide-handle='start']");
    const coincidentEndGuide = coincident.get("[data-dimension-closure-guide-handle='end']");
    const coincidentAxisPosition = coincidentStartGuide.attributes("x2");
    expect(coincidentClosure.element.tagName.toLowerCase()).toBe("path");
    expect(coincidentEndGuide.attributes("x2")).toBe(coincidentAxisPosition);
    expect(coincidentClosure.attributes("d")).toMatch(new RegExp(`^M ${coincidentAxisPosition} `));
    expect(coincidentHandle.attributes("d")).toBe(coincidentClosure.attributes("d"));
    expect(coincident.get("[data-dimension-closure-start]").attributes("cx"))
      .toBe(coincidentAxisPosition);
  });

  it("prevents Closure guides from crossing in horizontal and vertical orientations", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });

    const startGuide = wrapper.get("[data-dimension-closure-guide-handle='start']");
    const endGuide = wrapper.get("[data-dimension-closure-guide-handle='end']");
    dispatchPointer(startGuide.element, "pointerdown", {
      button: 0, buttons: 1, clientX: 220, clientY: 220, pointerId: 38,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 0, clientY: 220, pointerId: 38,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 0, clientY: 220, pointerId: 38,
    });
    await wrapper.vm.$nextTick();
    expect(Number(startGuide.attributes("x2")) - Number(endGuide.attributes("x2"))).toBeCloseTo(1, 10);

    dispatchPointer(endGuide.element, "pointerdown", {
      button: 0, buttons: 1, clientX: 0, clientY: 220, pointerId: 39,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 300, clientY: 220, pointerId: 39,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 300, clientY: 220, pointerId: 39,
    });
    await wrapper.vm.$nextTick();
    expect(Number(startGuide.attributes("x2")) - Number(endGuide.attributes("x2"))).toBeCloseTo(1, 10);

    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    const verticalStartGuide = wrapper.get("[data-dimension-closure-guide-handle='start']");
    const verticalEndGuide = wrapper.get("[data-dimension-closure-guide-handle='end']");
    dispatchPointer(verticalStartGuide.element, "pointerdown", {
      button: 0, buttons: 1, clientX: 220, clientY: 220, pointerId: 40,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 220, clientY: 0, pointerId: 40,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 220, clientY: 0, pointerId: 40,
    });
    await wrapper.vm.$nextTick();
    expect(Number(verticalStartGuide.attributes("y2")) - Number(verticalEndGuide.attributes("y2")))
      .toBeCloseTo(1, 10);

    dispatchPointer(verticalEndGuide.element, "pointerdown", {
      button: 0, buttons: 1, clientX: 220, clientY: 0, pointerId: 41,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 220, clientY: 300, pointerId: 41,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 220, clientY: 300, pointerId: 41,
    });
    await wrapper.vm.$nextTick();
    expect(Number(verticalStartGuide.attributes("y2")) - Number(verticalEndGuide.attributes("y2")))
      .toBeCloseTo(1, 10);
  });

  it("updates connected arrow colors when closure guide movement reverses their visual direction", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });

    dispatchPointer(wrapper.get("[data-dimension-closure-guide-handle='start']").element, "pointerdown", {
      button: 0, buttons: 1, clientX: 220, clientY: 220, pointerId: 36,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 120, clientY: 220, pointerId: 36,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 120, clientY: 220, pointerId: 36,
    });
    await wrapper.vm.$nextTick();

    const lastSegment = wrapper.get("[data-dimension-segment='3']");
    expect(lastSegment.attributes("data-direction")).toBe("subtractive");
    expect(lastSegment.classes()).toContain("dimension-chain-subtractive");
    expect(lastSegment.get(".dimension-chain-component").attributes("marker-end"))
      .toContain("dimension-chain-subtractive-arrow");
    expect(wrapper.emitted("factor-sign-change")).toEqual([[
      [{ factorId: "factor-3", sign: -1 }],
    ]]);

    await wrapper.setProps({
      factors: [factors[0]!, factors[1]!, factor(3, -0.5)],
    });
    expect(lastSegment.attributes("data-value")).toBe("-0.5");
    expect(lastSegment.attributes("data-direction")).toBe("subtractive");
    const closureStartGuide = wrapper.get("[data-dimension-closure-guide-handle='start']");
    const closureEndGuide = wrapper.get("[data-dimension-closure-guide-handle='end']");
    expect(Number(closureStartGuide.attributes("x2")))
      .toBeGreaterThan(Number(closureEndGuide.attributes("x2")));

    dispatchPointer(wrapper.get("[data-dimension-closure-guide-handle='end']").element, "pointerdown", {
      button: 0, buttons: 1, clientX: 80, clientY: 220, pointerId: 37,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0, buttons: 1, clientX: 280, clientY: 220, pointerId: 37,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0, buttons: 0, clientX: 280, clientY: 220, pointerId: 37,
    });
    await wrapper.vm.$nextTick();

    const firstSegment = wrapper.get("[data-dimension-segment='1']");
    expect(firstSegment.attributes("data-direction")).toBe("additive");
    expect(firstSegment.classes()).toContain("dimension-chain-additive");
    expect(Number(closureStartGuide.attributes("x2")) - Number(closureEndGuide.attributes("x2")))
      .toBeCloseTo(1, 10);
    expect(wrapper.emitted("factor-sign-change")).toEqual([[[{ factorId: "factor-3", sign: -1 }]]]);
  });

  it("exposes disabled edit handles without allowing non-editable pointer changes", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.setProps({ editable: false });
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    const setPointerCapture = vi.fn();
    Object.defineProperty(canvas.element, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });
    const bubbledPointerDown = vi.fn();
    canvas.element.addEventListener("pointerdown", bubbledPointerDown);
    const guide = wrapper.get("[data-dimension-guide-handle='factor-1::factor-2']");
    expect(guide.attributes("tabindex")).toBe("0");
    expect(guide.attributes("aria-disabled")).toBe("true");

    dispatchPointer(guide.element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 244,
      clientY: 77,
      pointerId: 28,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 44,
      clientY: 77,
      pointerId: 28,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 44,
      clientY: 77,
      pointerId: 28,
    });

    expect(setPointerCapture).not.toHaveBeenCalled();
  expect(bubbledPointerDown).not.toHaveBeenCalled();
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-display-end")).toBe("180");
    expect(wrapper.emitted("factor-sign-change")).toBeUndefined();
  });

  it("starts area selection when the left-button drag begins on an edit handle", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    await wrapper.get("button[aria-label='Select area to zoom']").trigger("click");

    dispatchPointer(wrapper.get("[data-dimension-arrow-handle='factor-2']").element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 120,
      clientY: 100,
      pointerId: 29,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 260,
      clientY: 220,
      pointerId: 29,
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.get("[data-dimension-chain-selection]").attributes("width")).not.toBe("0");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-lane-offset")).toBe("0");
  });

  it("preserves live offsets through Update, prunes removed factors, and resets both orientations", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    setCanvasBounds(canvas.element);
    Object.defineProperties(canvas.element, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    dispatchPointer(wrapper.get("[data-dimension-arrow-handle='factor-2']").element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 199,
      clientY: 106,
      pointerId: 26,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 199,
      clientY: 136,
      pointerId: 26,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 199,
      clientY: 136,
      pointerId: 26,
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-lane-offset")).toBe("30");

    dispatchPointer(wrapper.get("[data-dimension-arrow-handle='factor-3']").element, "pointerdown", {
      button: 0,
      buttons: 1,
      clientX: 176,
      clientY: 164,
      pointerId: 27,
    });
    dispatchPointer(canvas.element, "pointermove", {
      button: 0,
      buttons: 1,
      clientX: 176,
      clientY: 184,
      pointerId: 27,
    });
    dispatchPointer(canvas.element, "pointerup", {
      button: 0,
      buttons: 0,
      clientX: 176,
      clientY: 184,
      pointerId: 27,
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-dimension-segment='3']").attributes("data-lane-offset")).toBe("20");

    await wrapper.setProps({ factors: [factor(1, 2), factor(2, -1), factor(4, 1)] });
    const setupState = (wrapper.vm.$ as unknown as {
      setupState: {
        manualLayouts: {
          horizontal: { laneOffsets: Record<string, number> };
          vertical: { laneOffsets: Record<string, number> };
        };
      };
    }).setupState;
    expect(setupState.manualLayouts.horizontal.laneOffsets).toEqual({ "factor-2": 30 });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expect(wrapper.get("[data-dimension-segment='2']").attributes("data-lane-offset")).toBe("30");
    expect(setupState.manualLayouts.horizontal.laneOffsets).toEqual({ "factor-2": 30 });

  });

  it("hides and restores dimension annotations while keeping the background image visible", async () => {
    installImageEnvironment(["blob:visibility"], {
      "blob:visibility": { width: 640, height: 360 },
    });
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    const visibilityToggle = wrapper.get("button[aria-label='Hide dimension chain']");
    expect(visibilityToggle.attributes("disabled")).toBeDefined();

    await chooseBackgroundFile(wrapper, new File(["png"], "section.png", { type: "image/png" }));
    await vi.waitFor(() => expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(true));
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(visibilityToggle.attributes("disabled")).toBeUndefined();
    expect(visibilityToggle.attributes("aria-pressed")).toBe("true");
    expect(wrapper.find("[data-dimension-chain-overlay]").exists()).toBe(true);
    expect(wrapper.find("[data-dimension-chain-accessible-list]").exists()).toBe(true);

    await visibilityToggle.trigger("click");
    expect(wrapper.get("button[aria-label='Show dimension chain']").attributes("aria-pressed")).toBe("false");
    expect(wrapper.find("[data-dimension-chain-overlay]").exists()).toBe(false);
    expect(wrapper.find("[data-dimension-chain-accessible-list]").exists()).toBe(false);
    expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(true);

    await wrapper.get("button[aria-label='Show dimension chain']").trigger("click");
    expect(wrapper.get("button[aria-label='Hide dimension chain']").attributes("aria-pressed")).toBe("true");
    expect(wrapper.find("[data-dimension-chain-overlay]").exists()).toBe(true);
    expect(wrapper.find("[data-dimension-segment='1']").exists()).toBe(true);
  });

  it("imports PNG, JPEG, and WebP before Generate and renders the image as the first fitted visual layer", async () => {
    const { createObjectURL } = installImageEnvironment(
      ["blob:png", "blob:jpeg", "blob:webp"],
      {
        "blob:png": { width: 400, height: 200 },
        "blob:jpeg": { width: 300, height: 600 },
        "blob:webp": { width: 640, height: 360 },
      },
    );
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    const importButton = wrapper.get("button[aria-label='Import background image']");
    const input = wrapper.get("input[type='file']");

    expect(importButton.attributes("title")).toBe("Import background image");
    expect(importButton.find("svg").exists()).toBe(true);
    expect(input.attributes("accept")).toBe("image/png,image/jpeg,image/webp");
    expect(input.attributes("hidden")).toBeDefined();

    const supportedFiles = [
      new File(["png"], "section.png", { type: "image/png" }),
      new File(["jpeg"], "section.jpg", { type: "image/jpeg" }),
      new File(["webp"], "section.webp", { type: "image/webp" }),
    ];
    for (const [index, file] of supportedFiles.entries()) {
      await chooseBackgroundFile(wrapper, file);
      await vi.waitFor(() => {
        expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe(
          ["blob:png", "blob:jpeg", "blob:webp"][index],
        );
      });
    }

    expect(createObjectURL).toHaveBeenCalledTimes(3);
    expect(wrapper.findAll("input[type='file']")).toHaveLength(1);
    expect(wrapper.get("[data-generate-dimension-chain]").attributes("disabled")).toBeUndefined();
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const svg = wrapper.get("[data-dimension-chain-svg]");
    const image = wrapper.get("[data-dimension-chain-background]");
    expect(canvas.attributes("tabindex")).toBe("0");
    expect(wrapper.get("[data-dimension-chain-image-only-hint]").text()).toContain("Generate");
    expect(image.attributes("preserveAspectRatio")).toBe("xMidYMax meet");
    expect(image.attributes("data-natural-width")).toBe("640");
    expect(image.attributes("data-natural-height")).toBe("360");
    expect(image.attributes("data-image-x")).toBe(image.attributes("x"));
    expect(image.attributes("data-image-y")).toBe(image.attributes("y"));
    expect(image.attributes("data-image-width")).toBe(image.attributes("width"));
    expect(image.attributes("data-image-height")).toBe(image.attributes("height"));
    expect(Number(image.attributes("x")) * 2 + Number(image.attributes("width"))).toBeCloseTo(
      Number(svg.attributes("width")),
    );
    expect(Number(image.attributes("y")) + Number(image.attributes("height"))).toBeCloseTo(
      Number(svg.attributes("height")) - 16,
    );
    expect(Number(image.attributes("width")) / Number(image.attributes("height"))).toBeCloseTo(640 / 360);
    const firstVisualChild = Array.from(svg.element.children).find(
      (element) => !["title", "desc", "defs"].includes(element.tagName.toLowerCase()),
    );
    expect(firstVisualChild).toBe(image.element);
  });

  it("pastes the first supported image on the focusable canvas without intercepting text inputs", async () => {
    const { createObjectURL } = installImageEnvironment(
      ["blob:pasted"],
      { "blob:pasted": { width: 800, height: 500 } },
    );
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true, editable: true } });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    const canvas = wrapper.get("[data-dimension-chain-canvas]");
    const textInput = document.createElement("input");
    canvas.element.append(textInput);
    const ignoredInputPaste = pasteFiles(textInput, [
      new File(["png"], "ignored.png", { type: "image/png" }),
    ]);

    expect(ignoredInputPaste.defaultPrevented).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    textInput.remove();

    const pasteEvent = pasteFiles(canvas.element, [
      new File(["text"], "notes.txt", { type: "text/plain" }),
      new File(["jpeg"], "first-supported.jpg", { type: "image/jpeg" }),
      new File(["webp"], "second-supported.webp", { type: "image/webp" }),
    ]);
    expect(pasteEvent.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:pasted");
    });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect((createObjectURL.mock.calls[0]![0] as File).name).toBe("first-supported.jpg");
  });

  it("loads a governed default background URL without taking ownership of it", async () => {
    const { revokeObjectURL } = installImageEnvironment(
      [],
      { "/f7/session/session-fixed/dimension-chain-image": { width: 960, height: 540 } },
    );
    const wrapper = mount(DimensionChainPanel, {
      props: {
        factors,
        valid: true,
        defaultBackgroundImageUrl: "/f7/session/session-fixed/dimension-chain-image",
      },
    });

    await vi.waitFor(() => {
      expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe(
        "/f7/session/session-fixed/dimension-chain-image",
      );
    });
    expect(wrapper.get("[data-dimension-chain-background]").attributes("data-natural-width")).toBe("960");

    await wrapper.setProps({ defaultBackgroundImageUrl: undefined });
    await vi.waitFor(() => {
      expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(false);
    });
    expect(wrapper.find(".dimension-chain-empty").exists()).toBe(true);

    wrapper.unmount();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("centers the generated chain over the background image", async () => {
    installImageEnvironment(
      ["blob:centered"],
      { "blob:centered": { width: 640, height: 360 } },
    );
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await chooseBackgroundFile(wrapper, new File(["png"], "section.png", { type: "image/png" }));
    await vi.waitFor(() => expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(true));
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const background = wrapper.get("[data-dimension-chain-background]");
    const backgroundCenterX = Number(background.attributes("x")) + Number(background.attributes("width")) / 2;
    const backgroundCenterY = Number(background.attributes("y")) + Number(background.attributes("height")) / 2;
    const components = wrapper.findAll("[data-dimension-segment] .dimension-chain-component");
    const closure = wrapper.get("[data-dimension-closure]");
    const axisCoordinates = components.flatMap((component) => [
      Number(component.attributes("x1")),
      Number(component.attributes("x2")),
    ]);
    const laneCoordinates = [
      ...components.map((component) => Number(component.attributes("y1"))),
      Number(closure.attributes("y1")),
    ];

    expect((Math.min(...axisCoordinates) + Math.max(...axisCoordinates)) / 2)
      .toBeCloseTo(backgroundCenterX, 10);
    expect((Math.min(...laneCoordinates) + Math.max(...laneCoordinates)) / 2)
      .toBeCloseTo(backgroundCenterY, 10);

    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    const verticalBackground = wrapper.get("[data-dimension-chain-background]");
    const verticalBackgroundCenterX = Number(verticalBackground.attributes("x"))
      + Number(verticalBackground.attributes("width")) / 2;
    const verticalBackgroundCenterY = Number(verticalBackground.attributes("y"))
      + Number(verticalBackground.attributes("height")) / 2;
    const verticalComponents = wrapper.findAll("[data-dimension-segment] .dimension-chain-component");
    const verticalClosure = wrapper.get("[data-dimension-closure]");
    const verticalAxisCoordinates = verticalComponents.flatMap((component) => [
      Number(component.attributes("y1")),
      Number(component.attributes("y2")),
    ]);
    const verticalLaneCoordinates = [
      ...verticalComponents.map((component) => Number(component.attributes("x1"))),
      Number(verticalClosure.attributes("x1")),
    ];
    expect((Math.min(...verticalAxisCoordinates) + Math.max(...verticalAxisCoordinates)) / 2)
      .toBeCloseTo(verticalBackgroundCenterY, 10);
    expect((Math.min(...verticalLaneCoordinates) + Math.max(...verticalLaneCoordinates)) / 2)
      .toBeCloseTo(verticalBackgroundCenterX, 10);
  });

  it("retains the current image for unsupported content and decode errors while revoking only failed candidates", async () => {
    const { createObjectURL, revokeObjectURL } = installImageEnvironment(
      ["blob:current", "blob:broken"],
      {
        "blob:current": { width: 640, height: 480 },
        "blob:broken": "error",
      },
    );
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });
    await chooseBackgroundFile(wrapper, new File(["png"], "current.png", { type: "image/png" }));
    await vi.waitFor(() => {
      expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:current");
    });

    await chooseBackgroundFile(wrapper, new File(["gif"], "unsupported.gif", { type: "image/gif" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:current");
    const fileError = wrapper.get("[data-dimension-chain-background-error]");
    expect(fileError.attributes("role")).toBe("status");
    expect(fileError.attributes("aria-live")).toBe("polite");
    expect(fileError.text()).toContain("PNG, JPEG, or WebP");

    const unsupportedPaste = pasteFiles(wrapper.get("[data-dimension-chain-canvas]").element, [
      new File(["text"], "notes.txt", { type: "text/plain" }),
    ]);
    await wrapper.vm.$nextTick();
    expect(unsupportedPaste.defaultPrevented).toBe(false);
    expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:current");
    expect(wrapper.get("[data-dimension-chain-background-error]").text()).toContain("clipboard");

    await chooseBackgroundFile(wrapper, new File(["webp"], "broken.webp", { type: "image/webp" }));
    await vi.waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:broken");
    });
    expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:current");
    expect(wrapper.get("[data-dimension-chain-background-error]").text()).toContain("could not be decoded");
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("revokes the old image only after replacement and revokes the current image once on Remove or unmount", async () => {
    const { revokeObjectURL } = installImageEnvironment(
      ["blob:first", "blob:second", "blob:unmount"],
      {
        "blob:first": { width: 400, height: 200 },
        "blob:second": { width: 200, height: 400 },
        "blob:unmount": { width: 300, height: 200 },
      },
    );
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });
    await chooseBackgroundFile(wrapper, new File(["png"], "first.png", { type: "image/png" }));
    await vi.waitFor(() => expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(true));
    expect(revokeObjectURL).not.toHaveBeenCalled();

    await chooseBackgroundFile(wrapper, new File(["jpeg"], "second.jpg", { type: "image/jpeg" }));
    await vi.waitFor(() => {
      expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:second");
    });
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:first");

    await wrapper.get("button[aria-label='Remove background image']").trigger("click");
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:second");
    expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(false);
    wrapper.unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);

    const unmountedWithImage = mount(DimensionChainPanel, { props: { factors, valid: true } });
    await chooseBackgroundFile(
      unmountedWithImage,
      new File(["webp"], "unmount.webp", { type: "image/webp" }),
    );
    await vi.waitFor(() => {
      expect(unmountedWithImage.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:unmount");
    });
    unmountedWithImage.unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:unmount");
  });

  it("keeps the latest operation authoritative while image decoding is pending", async () => {
    const { revokeObjectURL, resolve } = installControllableImageEnvironment([
      "blob:first-pending",
      "blob:latest",
      "blob:removed-pending",
      "blob:unmounted-pending",
    ]);
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });

    await chooseBackgroundFile(wrapper, new File(["png"], "first.png", { type: "image/png" }));
    await chooseBackgroundFile(wrapper, new File(["jpeg"], "latest.jpg", { type: "image/jpeg" }));
    resolve("blob:latest");
    await vi.waitFor(() => {
      expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:latest");
    });
    resolve("blob:first-pending");
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:latest");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first-pending");

    await chooseBackgroundFile(wrapper, new File(["webp"], "removed.webp", { type: "image/webp" }));
    await wrapper.get("button[aria-label='Remove background image']").trigger("click");
    resolve("blob:removed-pending");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:removed-pending");

    const unmounted = mount(DimensionChainPanel, { props: { factors, valid: true } });
    await chooseBackgroundFile(unmounted, new File(["png"], "unmounted.png", { type: "image/png" }));
    unmounted.unmount();
    resolve("blob:unmounted-pending");
    await Promise.resolve();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:unmounted-pending");
  });

  it("adjusts background opacity and retains the local image through all diagram actions", async () => {
    installImageEnvironment(
      ["blob:persistent"],
      { "blob:persistent": { width: 720, height: 480 } },
    );
    const wrapper = mount(DimensionChainPanel, {
      props: { factors, valid: true, editable: true },
    });
    await chooseBackgroundFile(wrapper, new File(["png"], "persistent.png", { type: "image/png" }));
    await vi.waitFor(() => expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(true));
    const opacity = wrapper.get("input[aria-label='Background image opacity']");
    expect(opacity.attributes("type")).toBe("range");
    expect(opacity.attributes("min")).toBe("10");
    expect(opacity.attributes("max")).toBe("100");
    expect(opacity.element).toHaveProperty("value", "60");
    const opacityOutput = opacity.element.parentElement?.querySelector("output");
    expect(opacityOutput?.textContent).toBe("60%");
    expect(opacityOutput?.nextElementSibling).toBe(opacity.element);
    expect(STYLE_SOURCE).toMatch(
      /\.dimension-chain-background-opacity\s*\{[^}]*grid-template-areas:\s*"label value"\s*"slider slider"/s,
    );
    expect(STYLE_SOURCE).toMatch(
      /\.dimension-chain-background-opacity\s*\+\s*\.dimension-chain-background-opacity\s*\{[^}]*border-left:/s,
    );
    expect(wrapper.get("[data-dimension-chain-background]").attributes("opacity")).toBe("0.6");

    await opacity.setValue("85");
    expect(wrapper.get("[data-dimension-chain-background]").attributes("opacity")).toBe("0.85");

    const expectPersistentImage = (): void => {
      expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:persistent");
    };
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expectPersistentImage();
    await wrapper.setProps({ factors: [{ ...factors[0]!, upperTolerance: 0.25 }, ...factors.slice(1)] });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expectPersistentImage();
    await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
    expectPersistentImage();
    await wrapper.get("button[aria-label='Reverse all factors']").trigger("click");
    expectPersistentImage();
    const svg = wrapper.get("[data-dimension-chain-svg]");
    const image = wrapper.get("[data-dimension-chain-background]");
    const overlay = wrapper.get("[data-dimension-chain-overlay]");
    const closureLoop = wrapper.get("[data-dimension-closure-loop]");
    expect(Array.from(svg.element.children).indexOf(image.element)).toBeLessThan(
      Array.from(svg.element.children).indexOf(overlay.element),
    );
    expect(overlay.element.contains(closureLoop.element)).toBe(true);
  });

  it("scales the background image around its center and resets scale for a new image", async () => {
    installImageEnvironment(
      ["blob:first-scale", "blob:second-scale"],
      {
        "blob:first-scale": { width: 640, height: 360 },
        "blob:second-scale": { width: 400, height: 300 },
      },
    );
    const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });
    await chooseBackgroundFile(wrapper, new File(["png"], "first.png", { type: "image/png" }));
    await vi.waitFor(() => expect(wrapper.find("[data-dimension-chain-background]").exists()).toBe(true));

    const scale = wrapper.get("input[aria-label='Background image scale']");
    expect(scale.attributes("type")).toBe("range");
    expect(scale.attributes("min")).toBe("25");
    expect(scale.attributes("max")).toBe("300");
    expect(scale.element).toHaveProperty("value", "100");
    const scaleOutput = scale.element.parentElement?.querySelector("output");
    expect(scaleOutput?.textContent).toBe("100%");
    expect(scaleOutput?.nextElementSibling).toBe(scale.element);
    const image = wrapper.get("[data-dimension-chain-background]");
    const initial = {
      x: Number(image.attributes("x")),
      y: Number(image.attributes("y")),
      width: Number(image.attributes("width")),
      height: Number(image.attributes("height")),
    };

    await scale.setValue("200");
    const scaled = {
      x: Number(image.attributes("x")),
      y: Number(image.attributes("y")),
      width: Number(image.attributes("width")),
      height: Number(image.attributes("height")),
    };
    expect(scaled.width).toBeCloseTo(initial.width * 2, 10);
    expect(scaled.height).toBeCloseTo(initial.height * 2, 10);
    expect(scaled.x + scaled.width / 2).toBeCloseTo(initial.x + initial.width / 2, 10);
    expect(scaled.y + scaled.height / 2).toBeCloseTo(initial.y + initial.height / 2, 10);

    await scale.setValue("300");
    for (let index = 0; index < 12; index += 1) {
      await wrapper.get("button[aria-label='Zoom out']").trigger("click");
    }
    const svg = wrapper.get("[data-dimension-chain-svg]");
    const viewBox = svg.attributes("viewBox");
    expect(viewBox).toBeDefined();
    const [viewX, viewY, viewWidth, viewHeight] = viewBox!.split(" ").map(Number) as [number, number, number, number];
    const enlarged = {
      x: Number(image.attributes("x")),
      y: Number(image.attributes("y")),
      width: Number(image.attributes("width")),
      height: Number(image.attributes("height")),
    };
    expect(svg.attributes("data-view-zoom")).toBe("0.25");
    expect(enlarged.x).toBeGreaterThanOrEqual(viewX);
    expect(enlarged.y).toBeGreaterThanOrEqual(viewY);
    expect(enlarged.x + enlarged.width).toBeLessThanOrEqual(viewX + viewWidth);
    expect(enlarged.y + enlarged.height).toBeLessThanOrEqual(viewY + viewHeight);

    await chooseBackgroundFile(wrapper, new File(["jpeg"], "second.jpg", { type: "image/jpeg" }));
    await vi.waitFor(() => {
      expect(wrapper.get("[data-dimension-chain-background]").attributes("href")).toBe("blob:second-scale");
    });
    expect(scale.element).toHaveProperty("value", "100");
  });

  it("disables generation for invalid factors and renders zero items once valid", async () => {
    const wrapper = mount(DimensionChainPanel, {
      props: { factors: [factor(1, 0)], valid: false, editable: true },
    });
    expect(wrapper.get("[data-generate-dimension-chain]").attributes("disabled")).toBeDefined();

    await wrapper.setProps({ valid: true });
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("zero");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("aria-label")).toContain("assembly shift");
    expect(wrapper.find("[data-dimension-zero]").exists()).toBe(true);
  });
});
