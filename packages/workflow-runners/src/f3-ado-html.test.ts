import { describe, expect, it } from "vitest";

import type { DrawingGovernanceResultV2 } from "@ai-assist/contracts";
import { F3_ADO_HTML_TABLE_HEADERS, renderF3AdoHistoryHtml } from "./f3-ado-html.js";

describe("renderF3AdoHistoryHtml", () => {
  it("renders Worksheet Source first in a canonical 12-column table", () => {
    const html = renderF3AdoHistoryHtml(report());

    expect(F3_ADO_HTML_TABLE_HEADERS).toHaveLength(12);
    expect(F3_ADO_HTML_TABLE_HEADERS[0]).toBe("Worksheet Source");
    expect(html).toContain("<thead><tr><th>Worksheet Source</th><th>Device Level Dim</th>");
    expect(html).toContain("<tr data-f3-group-row=true><td colspan=12>Part / Subsystem: Bracket (1 factors)</td></tr>");
    expect(html).toContain("<td>Analysis&lt;A&amp;</td><td>Gap</td>");
    const factorRow = html.match(/<tr data-f3-factor-row=true>(.*?)<\/tr>/)?.[1];
    expect(factorRow?.match(/<td>/g)).toHaveLength(12);
  });
});

function report(): DrawingGovernanceResultV2 {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "completed",
    artifactRoot: "runtime/session/f3",
    workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Gap",
      rows: [{
        factorInstanceId: "b".repeat(64),
        deviceLevelDim: "Gap",
        dimensionDescription: "Display gap",
        partCategory: "Display",
        partSubsystem: "Bracket",
        drawingNumber: "DWG-1",
        dimId: "307",
        factorDescription: "Gap factor",
        nominal: 1,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        sigmaLevel: 3,
        dimIdStatus: "valid",
        qualitySignals: [],
        governanceStatus: "complete",
        imageReference: { artifact: "f1", relativePath: "worksheets/Analysis-A/tolerance-path.png", contentHash: "c".repeat(64), worksheetName: "Analysis-A" },
        source: { worksheetName: "Analysis<A&", tableId: "factor-table-1", sourceRow: 12, sourceCells: { factorName: "Analysis-A!E12" } },
      }],
    }],
    ado: { status: "not_requested" },
    summary: { worksheetCount: 1, factorCount: 1, completeCount: 1, governanceRequiredCount: 0, duplicateConflictCount: 0 },
  };
}
