import { describe, expect, it } from "vitest";

import { clampSpecDraft, DEFAULT_SPEC_STEP, specValueFromPointer, stepSpecValue } from "./specification-drag.js";

describe("specification-drag", () => {
  it("maps pointer pixels into an ascending value domain", () => {
    expect(specValueFromPointer({ pointerX: 150, trackLeft: 100, trackWidth: 200, domainStart: 1.4, domainEnd: 1.6 })).toBeCloseTo(1.45);
    expect(specValueFromPointer({ pointerX: 300, trackLeft: 100, trackWidth: 200, domainStart: 1.4, domainEnd: 1.6 })).toBeCloseTo(1.6);
  });

  it("maps pointer pixels into a reversed value domain", () => {
    expect(specValueFromPointer({ pointerX: 150, trackLeft: 100, trackWidth: 200, domainStart: 1.6, domainEnd: 1.4 })).toBeCloseTo(1.55);
  });

  it("clamps a crossed lower spec limit to the nearest valid value", () => {
    expect(clampSpecDraft({ lowerSpecLimit: 1.601, upperSpecLimit: 1.6, activeField: "lowerSpecLimit" })).toEqual({
      lowerSpecLimit: 1.599,
      upperSpecLimit: 1.6,
      reason: "LSL must stay below USL.",
    });
  });

  it("clamps a crossed upper spec limit to the nearest valid value", () => {
    expect(clampSpecDraft({ lowerSpecLimit: 1.4, upperSpecLimit: 1.399, activeField: "upperSpecLimit" })).toEqual({
      lowerSpecLimit: 1.4,
      upperSpecLimit: 1.401,
      reason: "USL must stay above LSL.",
    });
  });

  it("applies keyboard increments through the same clamp rules", () => {
    expect(stepSpecValue({ lowerSpecLimit: 1.4, upperSpecLimit: 1.6, activeField: "upperSpecLimit", direction: -1 })).toEqual({
      lowerSpecLimit: 1.4,
      upperSpecLimit: 1.599,
    });
    expect(stepSpecValue({ lowerSpecLimit: 1.4, upperSpecLimit: 1.4 + DEFAULT_SPEC_STEP, activeField: "upperSpecLimit", direction: -1 })).toEqual({
      lowerSpecLimit: 1.4,
      upperSpecLimit: 1.401,
      reason: "USL must stay above LSL.",
    });
  });
});