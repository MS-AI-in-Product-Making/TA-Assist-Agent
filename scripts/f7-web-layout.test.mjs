import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("../apps/f7-web/src/style.css", import.meta.url), "utf8");

describe("F7 workbench layout CSS", () => {
  it("uses the available width on wide desktop viewports", () => {
    const workbenchRule = stylesheet.match(/\.workbench-root\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(workbenchRule).toContain("width: 100%");
    expect(workbenchRule).toContain("max-width: 1760px");
  });
});