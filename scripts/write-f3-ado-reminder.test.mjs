import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeF3AdoReminder } from "./write-f3-ado-reminder.mjs";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function acceptedReport() {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "governance_required",
    artifactRoot: path.join("controlled", "f1"),
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [{
      worksheetName: "TP_Gap_X",
      toleranceLoopDescription: "Anonymous device gap",
      rows: [{
        factorInstanceId: "b".repeat(64),
        drawingDimensionKey: undefined,
        deviceLevelDim: "TP_Gap_X",
        dimensionDescription: "Anonymous device gap",
        partCategory: "Display",
        partSubsystem: "Anonymous bracket",
        drawingNumber: "DRAW-A",
        dimId: "307",
        factorDescription: "Anonymous display offset",
        nominal: 3.145,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        sigmaLevel: 4,
        dimIdStatus: "valid",
        qualitySignals: [],
        governanceStatus: "needs_governance",
        imageReference: {
          artifact: "f1",
          relativePath: "worksheets/TP_Gap_X/tolerance-path.png",
          contentHash: "d".repeat(64),
          worksheetName: "TP_Gap_X",
        },
        source: {
          worksheetName: "TP_Gap_X",
          tableId: "factor-table-1",
          sourceRow: 14,
          sourceCells: { factorName: "TP_Gap_X!E14" },
        },
      }],
    }],
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: 1,
      factorCount: 1,
      completeCount: 0,
      governanceRequiredCount: 1,
      duplicateConflictCount: 0,
    },
  };
}

function setupF3Root(report = acceptedReport()) {
  const root = mkdtempSync(path.join(tmpdir(), "f3-ado-write-"));
  roots.push(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "Feature3-Report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return root;
}

describe("writeF3AdoReminder", () => {
  it("writes reminder markdown and persists not_requested outcome", () => {
    const root = setupF3Root();
    const initialHref = path.relative(
      root,
      path.resolve(acceptedReport().artifactRoot, acceptedReport().worksheets[0].rows[0].imageReference.relativePath),
    ).split(path.sep).join("/");
    const result = writeF3AdoReminder({ f3OutputRoot: root, adoOutcome: { status: "not_requested" } });

    expect(result.reminderPath).toBe(path.join(root, "Feature3-ADO-Reminder.md"));
    expect(result.historyHtmlPath).toBe(path.join(root, "Feature3-ADO-History.html"));
    expect(existsSync(result.reminderPath)).toBe(true);
    expect(existsSync(result.historyHtmlPath)).toBe(true);
    expect(result.report.ado.status).toBe("not_requested");

    const reminder = readFileSync(result.reminderPath, "utf8");
    const historyHtml = readFileSync(result.historyHtmlPath, "utf8");
    const json = JSON.parse(readFileSync(path.join(root, "Feature3-Report.json"), "utf8"));
    const reportMd = readFileSync(path.join(root, "Feature3-Report.md"), "utf8");

    expect(reminder).toContain("F3 DIM ID / Drawing Governance Reminder");
    expect(historyHtml).toContain("<h2>F3 DIM ID / Drawing Governance Reminder</h2>");
    expect(historyHtml).toContain("<table>");
    expect(historyHtml.match(/<th>/g)).toHaveLength(12);
    expect(json.ado.status).toBe("not_requested");
    expect(reportMd).toContain("ADO 状态：`not_requested`");
    const href = path.relative(
      root,
      path.resolve(result.report.artifactRoot, result.report.worksheets[0].rows[0].imageReference.relativePath),
    ).split(path.sep).join("/");
    expect(href).toBe(initialHref);
    expect(reportMd).toContain(`[TP_Gap_X](${href})`);
    expect(reportMd).toContain(`[Anonymous device gap](${href})`);
    expect(reportMd).toContain(`[Anonymous display offset](${href})`);
    expect(readdirSync(root).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);
  });

  it("persists blocked status with controlled reason code and optional work item reference", () => {
    const root = setupF3Root();
    const result = writeF3AdoReminder({
      f3OutputRoot: root,
      adoOutcome: {
        status: "blocked",
        workItemReference: "1102392",
        reasonCode: "surface_mcp_comment_body_unsupported",
      },
    });

    expect(result.report.ado).toEqual({
      status: "blocked",
      workItemReference: "1102392",
      reasonCode: "surface_mcp_comment_body_unsupported",
    });

    const reportMd = readFileSync(path.join(root, "Feature3-Report.md"), "utf8");
    expect(reportMd).toContain("ADO 状态：`blocked`");
    expect(reportMd).toContain("ADO Work Item：`1102392`");
    expect(reportMd).toContain("ADO 原因：surface_mcp_comment_body_unsupported");
    expect(reportMd).not.toContain("comment body");
  });

  it("rejects input_rejected report", () => {
    const root = setupF3Root({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "input_rejected",
      artifactIssues: [{ reasonCode: "f2_report_invalid", artifactReference: "Feature2-Report.json" }],
    });

    expect(() => writeF3AdoReminder({
      f3OutputRoot: root,
      adoOutcome: { status: "not_requested" },
    })).toThrow(/input_rejected/i);
  });

  it("rejects unsupported status and reason combinations", () => {
    const root = setupF3Root();

    expect(() => writeF3AdoReminder({
      f3OutputRoot: root,
      adoOutcome: { status: "updated", reasonCode: "work_item_not_found" },
    })).toThrow(/reason/i);

    expect(() => writeF3AdoReminder({
      f3OutputRoot: root,
      adoOutcome: { status: "blocked" },
    })).toThrow(/reason/i);

    expect(() => writeF3AdoReminder({
      f3OutputRoot: root,
      adoOutcome: { status: "not_requested", workItemReference: "1102392" },
    })).toThrow(/not_requested/i);
  });

  it("persists controlled pre-validation Surface MCP failures without a target reference", () => {
    for (const reasonCode of ["surface_mcp_unavailable", "surface_mcp_authentication_failed"]) {
      const root = setupF3Root();
      const result = writeF3AdoReminder({
        f3OutputRoot: root,
        adoOutcome: { status: "blocked", reasonCode },
      });

      expect(result.report.ado).toEqual({ status: "blocked", reasonCode });
    }
  });

  it("rejects target references for pre-validation Surface MCP failures", () => {
    for (const reasonCode of ["surface_mcp_unavailable", "surface_mcp_authentication_failed"]) {
      const root = setupF3Root();
      expect(() => writeF3AdoReminder({
        f3OutputRoot: root,
        adoOutcome: {
          status: "blocked",
          reasonCode,
          workItemReference: "1102392",
        },
      })).toThrow(/cannot include work item reference/i);
    }
  });

  it("rolls back all four artifacts when fourth promotion fails and leaves no controlled temp/backup files", () => {
    const root = setupF3Root();
    const reminderPath = path.join(root, "Feature3-ADO-Reminder.md");
    const historyHtmlPath = path.join(root, "Feature3-ADO-History.html");
    const reportJsonPath = path.join(root, "Feature3-Report.json");
    const reportMdPath = path.join(root, "Feature3-Report.md");

    writeFileSync(reminderPath, "ORIGINAL_REMINDER\n", "utf8");
    writeFileSync(historyHtmlPath, "ORIGINAL_HISTORY_HTML\n", "utf8");
    writeFileSync(reportMdPath, "ORIGINAL_REPORT_MD\n", "utf8");

    const originalReminder = readFileSync(reminderPath, "utf8");
    const originalHistoryHtml = readFileSync(historyHtmlPath, "utf8");
    const originalJson = readFileSync(reportJsonPath, "utf8");
    const originalReportMd = readFileSync(reportMdPath, "utf8");

    const injectedFsOps = {
      existsSync,
      readFileSync,
      writeFileSync,
      rmSync,
      statSync: (targetPath) => ({
        isDirectory: () => {
          const normalized = path.resolve(targetPath).toLowerCase();
          const normalizedRoot = path.resolve(root).toLowerCase();
          return normalized === normalizedRoot;
        },
      }),
      renameSync: (fromPath, toPath) => {
        if (toPath === reportMdPath && String(fromPath).includes("copilot-stage")) {
          throw new Error(`simulated-fourth-promotion-failure: "${toPath}"`);
        }
        renameSync(fromPath, toPath);
      },
    };

    expect(() => writeF3AdoReminder({
      f3OutputRoot: root,
      adoOutcome: {
        status: "blocked",
        reasonCode: "surface_mcp_comment_body_unsupported",
      },
      __internalFsOps: injectedFsOps,
    })).toThrow(/simulated-fourth-promotion-failure/i);

    expect(readFileSync(reminderPath, "utf8")).toBe(originalReminder);
    expect(readFileSync(historyHtmlPath, "utf8")).toBe(originalHistoryHtml);
    expect(readFileSync(reportJsonPath, "utf8")).toBe(originalJson);
    expect(readFileSync(reportMdPath, "utf8")).toBe(originalReportMd);

    const leftovers = readdirSync(root).filter((name) =>
      name.includes("copilot-stage") || name.includes("copilot-backup") || name.endsWith(".tmp"));
    expect(leftovers).toHaveLength(0);
  });

  it("fails closed for a concurrent writer while lock owner continues to commit", () => {
    const root = setupF3Root();
    const reportJsonPath = path.join(root, "Feature3-Report.json");
    const reportMdPath = path.join(root, "Feature3-Report.md");
    const reminderPath = path.join(root, "Feature3-ADO-Reminder.md");
    const historyHtmlPath = path.join(root, "Feature3-ADO-History.html");
    writeFileSync(reportMdPath, "BASE_MD\n", "utf8");
    writeFileSync(reminderPath, "BASE_REMINDER\n", "utf8");
    writeFileSync(historyHtmlPath, "BASE_HISTORY_HTML\n", "utf8");

    let launchedB = false;
    const injectedFsOps = {
      existsSync,
      readFileSync,
      writeFileSync,
      rmSync,
      statSync: (targetPath) => {
        if (path.resolve(targetPath).toLowerCase() === path.resolve(root).toLowerCase()) {
          return { isDirectory: () => true };
        }
        return statSync(targetPath);
      },
      renameSync: (fromPath, toPath) => {
        renameSync(fromPath, toPath);
        const from = String(fromPath);
        const to = String(toPath);
        if (!launchedB && from.endsWith("Feature3-Report.md") && to.includes("copilot-backup")) {
          launchedB = true;
          expect(() => writeF3AdoReminder({
            f3OutputRoot: root,
            adoOutcome: {
              status: "blocked",
              reasonCode: "work_item_not_found",
              workItemReference: "B-WRITE",
            },
          })).toThrow(/lock|busy|another writer|another process/i);
        }
      },
    };

    const resultA = writeF3AdoReminder({
      f3OutputRoot: root,
      adoOutcome: {
        status: "failed",
        reasonCode: "project_not_found",
        workItemReference: "A-WRITE",
      },
      __internalFsOps: injectedFsOps,
    });

    const persisted = JSON.parse(readFileSync(reportJsonPath, "utf8"));
    expect(launchedB).toBe(true);
    expect(resultA.report.ado.workItemReference).toBe("A-WRITE");
    expect(persisted.ado).toEqual({
      status: "failed",
      reasonCode: "project_not_found",
      workItemReference: "A-WRITE",
    });
    expect(readFileSync(reportMdPath, "utf8")).toContain("A-WRITE");
    expect(readFileSync(reminderPath, "utf8")).toContain("F3 DIM ID / Drawing Governance Reminder");
  });

  it("prevents concurrent entry so failing writer rollback cannot clobber other invocation", () => {
    const root = setupF3Root();
    const reportJsonPath = path.join(root, "Feature3-Report.json");
    const reportMdPath = path.join(root, "Feature3-Report.md");
    const reminderPath = path.join(root, "Feature3-ADO-Reminder.md");
    const historyHtmlPath = path.join(root, "Feature3-ADO-History.html");
    writeFileSync(reportMdPath, "BASE_MD\n", "utf8");
    writeFileSync(reminderPath, "BASE_REMINDER\n", "utf8");
    writeFileSync(historyHtmlPath, "BASE_HISTORY_HTML\n", "utf8");

    const before = {
      json: readFileSync(reportJsonPath, "utf8"),
      md: readFileSync(reportMdPath, "utf8"),
      reminder: readFileSync(reminderPath, "utf8"),
      historyHtml: readFileSync(historyHtmlPath, "utf8"),
    };

    let launchedB = false;
    const injectedFsOps = {
      existsSync,
      readFileSync,
      writeFileSync,
      rmSync,
      statSync: (targetPath) => {
        if (path.resolve(targetPath).toLowerCase() === path.resolve(root).toLowerCase()) {
          return { isDirectory: () => true };
        }
        return statSync(targetPath);
      },
      renameSync: (fromPath, toPath) => {
        renameSync(fromPath, toPath);
        const from = String(fromPath);
        const to = String(toPath);
        if (!launchedB && from.endsWith("Feature3-Report.md") && to.includes("copilot-backup")) {
          launchedB = true;
          expect(() => writeF3AdoReminder({
            f3OutputRoot: root,
            adoOutcome: {
              status: "blocked",
              reasonCode: "work_item_not_found",
              workItemReference: "B-WRITE",
            },
          })).toThrow(/lock|busy|another writer|another process/i);
        }
      },
    };

    expect(() => writeF3AdoReminder({
      f3OutputRoot: root,
      adoOutcome: {
        status: "failed",
        reasonCode: "project_not_found",
        workItemReference: "A-WRITE",
      },
      __internalFsOps: injectedFsOps,
      __internalFailPromotionAt: 4,
      __internalFailWithPath: reportMdPath,
    })).toThrow(/simulated-third-promotion-failure/i);

    const after = {
      json: readFileSync(reportJsonPath, "utf8"),
      md: readFileSync(reportMdPath, "utf8"),
      reminder: readFileSync(reminderPath, "utf8"),
      historyHtml: readFileSync(historyHtmlPath, "utf8"),
    };
    expect(launchedB).toBe(true);
    expect(after).toEqual(before);
  });
});

describe("write-f3-ado-reminder CLI", () => {
  it("accepts one directory and controlled flags", () => {
    const root = setupF3Root();
    const stdout = execFileSync(process.execPath, [
      "scripts/write-f3-ado-reminder.mjs",
      root,
      "--status",
      "blocked",
      "--work-item-reference",
      "1102392",
      "--reason-code",
      "surface_mcp_comment_body_unsupported",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    const result = JSON.parse(stdout);
    expect(result.status).toBe("blocked");
    expect(result.reminderPath.endsWith("Feature3-ADO-Reminder.md")).toBe(true);
    expect(result.historyHtmlPath.endsWith("Feature3-ADO-History.html")).toBe(true);
    expect(result.report.ado.reasonCode).toBe("surface_mcp_comment_body_unsupported");
  });

  it("rejects duplicated controlled flags", () => {
    const root = setupF3Root();

    expect(() => execFileSync(process.execPath, [
      "scripts/write-f3-ado-reminder.mjs",
      root,
      "--status",
      "blocked",
      "--status",
      "failed",
      "--reason-code",
      "work_item_not_found",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/duplicated|missing/i);

    expect(() => execFileSync(process.execPath, [
      "scripts/write-f3-ado-reminder.mjs",
      root,
      "--status",
      "blocked",
      "--reason-code",
      "work_item_not_found",
      "--reason-code",
      "organization_not_found",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/duplicated|missing/i);
  });

  it("rejects a second positional output directory", () => {
    const root = setupF3Root();

    expect(() => execFileSync(process.execPath, [
      "scripts/write-f3-ado-reminder.mjs",
      root,
      root,
      "--status",
      "not_requested",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/exactly one output directory/i);
  });

  it("rejects unknown flags, missing values, and unsupported raw comment flags", () => {
    const root = setupF3Root();

    expect(() => execFileSync(process.execPath, ["scripts/write-f3-ado-reminder.mjs", root, "--comment-body", "raw"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/unsupported|failed|option/i);

    expect(() => execFileSync(process.execPath, ["scripts/write-f3-ado-reminder.mjs", root, "--status"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/missing/i);

    expect(() => execFileSync(process.execPath, ["scripts/write-f3-ado-reminder.mjs", root, "--status", "draft_ready"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/status|unsupported/i);

    expect(() => execFileSync(process.execPath, ["scripts/write-f3-ado-reminder.mjs", root, "--status", "failed", "--reason-code", "wrong_reason"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/reason/i);
  });

  it("rejects unsafe output path traversal argument", () => {
    expect(() => execFileSync(process.execPath, ["scripts/write-f3-ado-reminder.mjs", "../unsafe", "--status", "not_requested"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/unsafe|failed|directory/i);
  });

  it("ignores former failure-injection env vars in CLI runtime", () => {
    const root = setupF3Root();
    const stdout = execFileSync(process.execPath, [
      "scripts/write-f3-ado-reminder.mjs",
      root,
      "--status",
      "not_requested",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
      env: {
        ...process.env,
        F3_ADO_REMINDER_TEST_FAIL_PROMOTION: "3",
        F3_ADO_REMINDER_TEST_FAIL_WITH_PATH: "C:\\Users\\Name\\AI Project\\ado repro\\Feature3-Report.md",
      },
    });

    const result = JSON.parse(stdout);
    expect(result.status).toBe("not_requested");
  });
});
