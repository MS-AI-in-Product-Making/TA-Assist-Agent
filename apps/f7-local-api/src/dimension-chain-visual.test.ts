import { describe, expect, it } from "vitest";
import { dimensionChainVisualSchema, renderDimensionChainVisual } from "./dimension-chain-visual.js";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("dimensionChainVisualSchema", () => {
  it("accepts empty and controlled PNG visuals", () => {
    expect(dimensionChainVisualSchema.parse({ status: "empty" })).toEqual({ status: "empty" });
    expect(dimensionChainVisualSchema.parse({
      status: "image",
      mediaType: "image/png",
      dataUrl: PNG_DATA_URL,
      width: 1,
      height: 1,
    }).status).toBe("image");
  });

  it("rejects non-PNG, non-canonical base64, and excessive dimensions", () => {
    expect(dimensionChainVisualSchema.safeParse({
      status: "image", mediaType: "image/png", dataUrl: "data:image/png;base64,AAAA", width: 1, height: 1,
    }).success).toBe(false);
    expect(dimensionChainVisualSchema.safeParse({
      status: "image", mediaType: "image/png", dataUrl: `${PNG_DATA_URL}=`, width: 1, height: 1,
    }).success).toBe(false);
    expect(dimensionChainVisualSchema.safeParse({
      status: "image", mediaType: "image/png", dataUrl: PNG_DATA_URL, width: 4097, height: 1,
    }).success).toBe(false);
    expect(dimensionChainVisualSchema.safeParse({
      status: "image", mediaType: "image/png", dataUrl: PNG_DATA_URL, width: 2, height: 1,
    }).success).toBe(false);
  });
});

describe("renderDimensionChainVisual", () => {
  it("renders image and empty states without reconstructing geometry", () => {
    const image = renderDimensionChainVisual(dimensionChainVisualSchema.parse({
      status: "image",
      mediaType: "image/png",
      dataUrl: PNG_DATA_URL,
      width: 1,
      height: 1,
    }));
    expect(image).toContain("data-dimension-chain-visual");
    expect(image).toContain(PNG_DATA_URL);
    expect(renderDimensionChainVisual({ status: "empty" })).toContain("data-dimension-chain-visual-empty");
  });
});
