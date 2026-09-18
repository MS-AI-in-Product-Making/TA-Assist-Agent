import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { persistF3AdoTraceability, publishF3AdoTraceabilityArtifacts } from "./index.js";

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

function updatedV3Report(workItemId = 1119604) {
  return {
    ...acceptedV2Report(),
    modelVersion: "drawing-governance-v3",
    ado: {
      status: "updated",
      operation: "updated",
      organization: "contoso",
      project: "Devices",
      workItemId,
    },
  } as const;
}

function receipt(workItemId = 1119604) {
  return {
    operation: "updated" as const,
    targetIdentity: { organization: "contoso", project: "Devices", workItemId },
    verifiedAt: "2026-09-16T08:30:12.000Z",
  };
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

  it("publishes structured Surface readback to all synchronized F3 artifacts", () => {
    const f3Root = mkdtempSync(path.join(tmpdir(), "f3-ado-outcome-"));
    roots.push(f3Root);
    const reportPath = path.join(f3Root, "current-host-action.json");
    writeFileSync(reportPath, `${JSON.stringify(acceptedV2Report(), null, 2)}\n`, "utf8");

    const result = publishF3AdoTraceabilityArtifacts({
      f3Root,
      reportPath,
      receipt: receipt(),
    });

    expect(JSON.parse(readFileSync(reportPath, "utf8"))).toEqual(result.report);
    expect(readFileSync(result.reminderPath, "utf8")).toContain("F3 DIM ID / Drawing Governance Reminder");
    expect(readFileSync(result.historyHtmlPath, "utf8")).toContain("<h2>F3 DIM ID / Drawing Governance Reminder</h2>");
    const reportMarkdown = readFileSync(path.join(f3Root, "Feature3-Report.md"), "utf8");
    expect(reportMarkdown).toContain("ADO 状态：`updated`");
    expect(reportMarkdown).toContain("ADO Work Item：`1119604`");
    expect(JSON.stringify(result.report)).not.toContain("dev.azure.com");
  });

  it("fails closed without partial artifacts when the current report path escapes the F3 root", () => {
    const f3Root = mkdtempSync(path.join(tmpdir(), "f3-ado-outcome-"));
    roots.push(f3Root);
    const outsideRoot = mkdtempSync(path.join(tmpdir(), "f3-ado-outside-"));
    roots.push(outsideRoot);
    const outsideReportPath = path.join(outsideRoot, "Feature3-Report.json");
    writeFileSync(outsideReportPath, `${JSON.stringify(acceptedV2Report(), null, 2)}\n`, "utf8");

    expect(() => publishF3AdoTraceabilityArtifacts({
      f3Root,
      reportPath: outsideReportPath,
      receipt: receipt(),
    })).toThrow(/outside/i);

    expect(existsSync(path.join(f3Root, "Feature3-ADO-Reminder.md"))).toBe(false);
    expect(existsSync(path.join(f3Root, "Feature3-ADO-History.html"))).toBe(false);
    expect(existsSync(path.join(f3Root, "Feature3-Report.md"))).toBe(false);
  });

  it("fails closed when an existing v3 identity conflicts with the Surface receipt", () => {
    const f3Root = mkdtempSync(path.join(tmpdir(), "f3-ado-outcome-"));
    roots.push(f3Root);
    const reportPath = path.join(f3Root, "Feature3-Report.json");
    const original = `${JSON.stringify(updatedV3Report(1119604), null, 2)}\n`;
    writeFileSync(reportPath, original, "utf8");

    expect(() => publishF3AdoTraceabilityArtifacts({
      f3Root,
      reportPath,
      receipt: receipt(2222222),
    })).toThrow(/does not match/i);

    expect(readFileSync(reportPath, "utf8")).toBe(original);
    expect(existsSync(path.join(f3Root, "Feature3-ADO-Reminder.md"))).toBe(false);
    expect(existsSync(path.join(f3Root, "Feature3-ADO-History.html"))).toBe(false);
    expect(existsSync(path.join(f3Root, "Feature3-Report.md"))).toBe(false);
  });
});