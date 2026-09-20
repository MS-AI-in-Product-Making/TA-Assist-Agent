import { describe, expect, it } from "vitest";
import {
  dimensionChainRasterScale,
  findDimensionChainContentBounds,
} from "./dimension-chain-image-crop";

describe("Dimension Chain image crop", () => {
  it("renders ordinary report images at double resolution within controlled limits", () => {
    expect(dimensionChainRasterScale(800, 500)).toBe(2);
    expect(dimensionChainRasterScale(2400, 1200)).toBeCloseTo(4 / 3);
    expect(dimensionChainRasterScale(800, 1200)).toBeCloseTo(5 / 3);
  });

  it("crops white canvas space around visible content and preserves padding", () => {
    const width = 8;
    const height = 6;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let y = 2; y <= 3; y += 1) {
      for (let x = 3; x <= 5; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = 30;
        pixels[offset + 1] = 40;
        pixels[offset + 2] = 50;
      }
    }

    expect(findDimensionChainContentBounds(pixels, width, height, 1)).toEqual({
      x: 2,
      y: 1,
      width: 5,
      height: 4,
    });
  });

  it("keeps the full canvas when no visible content is found", () => {
    const width = 5;
    const height = 4;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);

    expect(findDimensionChainContentBounds(pixels, width, height, 2)).toEqual({
      x: 0,
      y: 0,
      width,
      height,
    });
  });
});