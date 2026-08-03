import { describe, expect, it } from "vitest";
import {
  annotateArtifactField,
  cellActualText,
  filterFeature1WorksheetNames,
  injectLinksIntoFactorTableMarkdown,
  maskBlankFactorTemplateRows,
} from "./f1-dual-grid.mjs";

describe("Feature 1 dual grid", () => {
  it("normalizes actual numeric values to Excel's 15 significant digits", () => {
    expect(cellActualText({ t: "n", v: 1.6500000000000001, w: "1.650" })).toBe("1.65");
    expect(cellActualText({ t: "n", v: 0.016666666666666666, w: "0.017" })).toBe("0.0166666666666667");
  });

  it("uses Excel display text while retaining numeric artifact values", () => {
    expect(annotateArtifactField({
      status: "available",
      sourceCell: "Analysis-A!K20",
      rawText: "0.28000000000000003",
      numericValue: 0.28,
    }, "0.280")).toEqual(expect.objectContaining({
      displayValue: "0.280",
      actualValue: 0.28,
      numericValue: 0.28,
    }));
  });

  it("excludes the Example_TA template worksheet from F1 selection", () => {
    expect(filterFeature1WorksheetNames(["Analysis-A", "Example_TA", " example_ta "]))
      .toEqual(["Analysis-A"]);
  });

  it("keeps an empty factor slot as an empty worksheet row", () => {
    const actualGrid = Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => ""));
    const displayGrid = Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => ""));
    actualGrid[1][3] = "Factor Description (TA Loop)";
    actualGrid[1][5] = "Distribution";
    actualGrid[2][2] = "3";
    actualGrid[2][6] = "0";
    displayGrid[2][2] = "3";
    displayGrid[2][6] = "0.000";

    const blankRows = maskBlankFactorTemplateRows(actualGrid, displayGrid, 1, 2, [2, 3, 4, 5, 6]);

    expect([...blankRows]).toEqual([2]);
    expect(actualGrid[2].slice(2, 7)).toEqual(["", "", "", "", ""]);
    expect(displayGrid[2].slice(2, 7)).toEqual(["", "", "", "", ""]);
  });

  it("clears the helper value when a linked factor has no part name", () => {
    const markdown = [
      "## Factor Table (Rows 13-47)",
      "",
      "| row | C | D | G | H |",
      "|---|---|---|---|---|",
      "| 20 | A:0.02<br>D:0.0 | A:-0.02<br>D:0.0 | Q: Welding Process |  |",
    ].join("\n");

    const result = injectLinksIntoFactorTableMarkdown(markdown, [{
      sourceRow: 20,
      factorDescription: { text: "Q: Welding Process", imageLinkForMd: "../images/loop.png" },
      partName: { text: "" },
      target: { imageLinkForMd: "../images/loop.png" },
    }]);

    const row = result.split("\n").find((line) => line.startsWith("| 20 |"));
    expect(row?.split("|")[3]?.trim()).toBe("");
    expect(row).toContain("[Q: Welding Process](../images/loop.png)");
  });
});