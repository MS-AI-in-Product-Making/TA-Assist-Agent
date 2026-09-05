import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("../apps/f7-web/src/style.css", import.meta.url), "utf8");

describe("F7 workbench layout CSS", () => {
  it("uses the available width on wide desktop viewports", () => {
    const workbenchRule = stylesheet.match(/\.workbench-root\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(workbenchRule).toContain("width: 100%");
    expect(workbenchRule).toContain("max-width: 1888px");
  });

  it("visually mutes disabled dimension-chain orientation controls", () => {
    const disabledOrientationRule = stylesheet.match(
      /\.dimension-chain-orientation button:disabled\s*\{([^}]*)\}/,
    )?.[1] ?? "";

    expect(disabledOrientationRule).toContain("opacity: 0.4");
    expect(disabledOrientationRule).toContain("cursor: not-allowed");
  });
});