import { describe, expect, it } from "vitest";
import { resolveFactorHeaderCluster, type HeaderCell } from "./factor-header-resolver.js";

const LABELS = [
  "Factor Description (TA Loop)", "Part Name", "Drawing Number", "Dim / Characteristic ID",
  "Part Category", "Design Nominal", "+ Tolerance", "- Tolerance", "Long Term/Safety Factor",
  "σ Level", "Distribution", "Mean", "Tolerance", "1 Sigma", "% Contribution to Sigma", "Notes",
] as const;

function column(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function cluster(startColumn: number): HeaderCell[] {
  return LABELS.map((value, offset) => ({ reference: `${column(startColumn + offset)}13`, value }));
}

describe("resolveFactorHeaderCluster", () => {
  it.each([[5, "E", "K", "L"], [7, "G", "M", "N"], [27, "AA", "AG", "AH"]])(
    "resolves a complete semantic cluster starting at column %s",
    (startColumn, anchorColumn, upperColumn, lowerColumn) => {
      const result = resolveFactorHeaderCluster(cluster(startColumn as number));

      expect(result.status).toBe("resolved");
      if (result.status !== "resolved") return;
      expect(result.anchorColumn).toBe(anchorColumn);
      expect(result.columns.upperTolerance.sourceColumn).toBe(upperColumn);
      expect(result.columns.lowerTolerance.sourceColumn).toBe(lowerColumn);
      expect(result.columns.notes.sourceColumn).toBe(column((startColumn as number) + 15));
    },
  );

  it("ignores matching auxiliary labels to the left of the factor anchor", () => {
    const result = resolveFactorHeaderCluster([
      { reference: "C13", value: "+ Tolerance" },
      { reference: "D13", value: "+ Tolerance" },
      ...cluster(7),
    ]);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.columns.upperTolerance.sourceColumn).toBe("M");
  });

  it("fails closed when the primary anchor is missing", () => {
    expect(resolveFactorHeaderCluster(cluster(7).slice(1))).toEqual({
      status: "unavailable",
      reasonCode: "factor_header_missing",
    });
  });

  it("fails closed for an internal duplicate or two complete clusters", () => {
    expect(resolveFactorHeaderCluster([
      ...cluster(7),
      { reference: "W13", value: "+ Tolerance" },
    ])).toEqual({ status: "unavailable", reasonCode: "ambiguous_factor_header" });
    expect(resolveFactorHeaderCluster([...cluster(5), ...cluster(27)])).toEqual({
      status: "unavailable",
      reasonCode: "ambiguous_factor_header",
    });
  });
});