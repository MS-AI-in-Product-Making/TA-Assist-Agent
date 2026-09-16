import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { persistF3AdoTraceability } from "./index.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function acceptedV2Report() {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "completed",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [],
    ado: { status: "not_requested" },
    summary: { worksheetCount: 0, factorCount: 0, completeCount: 0, governanceRequiredCount: 0, duplicateConflictCount: 0 },
  } as const;
}

describe("persistF3AdoTraceability", () => {
  it("fails closed without an explicit current report path and leaves legacy v2 unchanged", () => {
    const f3Root = mkdtempSync(path.join(tmpdir(), "f3-ado-outcome-"));
    roots.push(f3Root);
    const historicalPath = path.join(f3Root, "Feature3-Report.json");
    const legacyContent = `${JSON.stringify(acceptedV2Report(), null, 2)}\n`;
    writeFileSync(historicalPath, legacyContent, "utf8");
    const receipt = {
      operation: "updated" as const,
      targetIdentity: { organization: "contoso", project: "Devices", workItemId: 1119604 },
      verifiedAt: "2026-09-16T08:30:12.000Z",
    };


    expect(() => persistF3AdoTraceability({ f3Root, receipt })).toThrow(/report path/i);
    expect(readFileSync(historicalPath, "utf8")).toBe(legacyContent);
  });

  it("returns structured readback for the explicit current report path without overwriting it", () => {
    const f3Root = mkdtempSync(path.join(tmpdir(), "f3-ado-outcome-"));
    roots.push(f3Root);
    const reportPath = path.join(f3Root, "current-host-action.json");
    const legacyContent = `${JSON.stringify(acceptedV2Report(), null, 2)}\n`;
    writeFileSync(reportPath, legacyContent, "utf8");

    const report = persistF3AdoTraceability({
      f3Root,
      reportPath,
      receipt: {
        operation: "updated",
        targetIdentity: { organization: "contoso", project: "Devices", workItemId: 1119604 },
        verifiedAt: "2026-09-16T08:30:12.000Z",
      },
    });

    expect(report.modelVersion).toBe("drawing-governance-v3");
    expect(report.ado).toEqual({
      status: "updated",
      operation: "updated",
      organization: "contoso",
      project: "Devices",
      workItemId: 1119604,
    });
    expect(readFileSync(reportPath, "utf8")).toBe(legacyContent);
    expect(JSON.stringify(report)).not.toContain("dev.azure.com");
  });

  it("publishes the exact current report path supplied by validated side-table evidence", () => {
    const f3Root = mkdtempSync(path.join(tmpdir(), "f3-ado-outcome-"));
    roots.push(f3Root);
    const reportPath = path.join(f3Root, "current-host-action.json");
    const legacyContent = `${JSON.stringify(acceptedV2Report(), null, 2)}\n`;
    writeFileSync(reportPath, legacyContent, "utf8");

    const report = persistF3AdoTraceability({
      f3Root,
      reportPath,
      receipt: {
        operation: "created",
        targetIdentity: { organization: "contoso", project: "Devices", workItemId: 1119604 },
        verifiedAt: "2026-09-16T08:30:12.000Z",
      },
    });

    expect(report.modelVersion).toBe("drawing-governance-v3");
    expect(readFileSync(reportPath, "utf8")).toBe(legacyContent);
    expect(() => readFileSync(path.join(f3Root, "Feature3-Report.json"), "utf8")).toThrow();
  });
});