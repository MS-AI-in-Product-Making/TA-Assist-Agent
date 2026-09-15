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

  it("resolves the workbook's symbolic calculated headers", () => {
    const cells = cluster(7).map((cell) => {
      if (cell.value === "1 Sigma") return { ...cell, value: "1σ" };
      if (cell.value === "% Contribution to Sigma") return { ...cell, value: "% Cont. to σ" };
      return cell;
    });

    const result = resolveFactorHeaderCluster(cells);

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.columns.oneSigma).toMatchObject({ semanticField: "oneSigma", sourceColumn: "T", headerText: "1σ" });
    expect(result.columns.percentContributionToSigma).toMatchObject({ semanticField: "percentContributionToSigma", sourceColumn: "U", headerText: "% Cont. to σ" });
  });

  it("resolves controlled Factor traceability and physical limit headers", () => {
    const result = resolveFactorHeaderCluster([
      { reference: "G13", value: "Factor Description" },
      { reference: "H13", value: "Part Number" },
      { reference: "I13", value: "DIM ID" },
      { reference: "J13", value: "Factor LSL" },
      { reference: "K13", value: "Factor USL" },
    ]);

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.columns.partNumber?.sourceColumn).toBe("H");
    expect(result.columns.dimCharacteristicId?.sourceColumn).toBe("I");
    expect(result.columns.factorLowerSpecLimit?.sourceColumn).toBe("J");
    expect(result.columns.factorUpperSpecLimit?.sourceColumn).toBe("K");
  });

  it("does not treat response-level LSL and USL labels as Factor columns", () => {
    const result = resolveFactorHeaderCluster([
      { reference: "G13", value: "Factor Description" },
      { reference: "J13", value: "LSL" },
      { reference: "K13", value: "USL" },
    ]);

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.columns.factorLowerSpecLimit).toBeUndefined();
    expect(result.columns.factorUpperSpecLimit).toBeUndefined();
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