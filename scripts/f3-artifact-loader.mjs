import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  drawingGovernanceRequestV2Schema,
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
} from "../packages/contracts/dist/contracts.js";

function rejected(reasonCode, artifactReference) {
  return {
    status: "inputRejected",
    report: drawingGovernanceResultV2Schema.parse({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "input_rejected",
      artifactIssues: [{ reasonCode, artifactReference }],
    }),
  };
}

export function loadF2ArtifactBundle(artifactRoot, { selectedWorksheetNames } = {}) {
  const reportPath = path.join(path.resolve(artifactRoot), "Feature2-Report.json");
  if (!existsSync(reportPath)) return rejected("f2_report_missing", "Feature2-Report.json");

  let value;
  try {
    value = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    return rejected("f2_report_invalid", "Feature2-Report.json");
  }
  const parsed = f2UserReportSchema.safeParse(value);
  if (!parsed.success || parsed.data.status === "inputRejected") {
    return rejected("f2_report_invalid", "Feature2-Report.json");
  }

  const readyWorksheets = parsed.data.worksheets.filter((worksheet) => worksheet.status === "ready");
  if (readyWorksheets.length === 0) return rejected("no_ready_worksheet", "Feature2-Report.json");
  const readyByName = new Map(readyWorksheets.map((worksheet) => [worksheet.worksheetName, worksheet]));
  let selectedWorksheets = readyWorksheets;
  if (selectedWorksheetNames !== undefined) {
    const duplicateNames = selectedWorksheetNames.filter((name, index) => selectedWorksheetNames.indexOf(name) !== index);
    const unavailableNames = selectedWorksheetNames.filter((name) => !readyByName.has(name));
    if (selectedWorksheetNames.length === 0 || duplicateNames.length > 0 || unavailableNames.length > 0) {
      const invalidNames = [...new Set([...duplicateNames, ...unavailableNames])];
      return rejected(
        "worksheet_selection_invalid",
        invalidNames.length > 0 ? `worksheet-selection:${invalidNames.join(",")}` : "worksheet-selection:empty",
      );
    }
    selectedWorksheets = selectedWorksheetNames.map((name) => readyByName.get(name));
  }

  const missingDescription = selectedWorksheets.find((worksheet) => worksheet.toleranceLoopDescription === undefined);
  if (missingDescription !== undefined) {
    return rejected("description_missing", `worksheet:${missingDescription.worksheetName}`);
  }

  const request = drawingGovernanceRequestV2Schema.safeParse({
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    inputClassification: "confidential",
    artifactRoot: parsed.data.artifactRoot,
    workbook: {
      fileName: parsed.data.workbook.fileName,
      contentHash: parsed.data.workbook.contentHash,
    },
    worksheets: selectedWorksheets.map((worksheet) => ({
      worksheetName: worksheet.worksheetName,
      toleranceLoopDescription: worksheet.toleranceLoopDescription,
      f2Status: "ready",
      rows: worksheet.rows,
    })),
  });
  if (!request.success) return rejected("f2_report_invalid", "Feature2-Report.json");
  return { status: "accepted", request: request.data };
}