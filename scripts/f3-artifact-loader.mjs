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

export function loadF2ArtifactBundle(artifactRoot) {
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
  const missingDescription = readyWorksheets.find((worksheet) => worksheet.toleranceLoopDescription === undefined);
  if (missingDescription !== undefined) {
    return rejected("description_missing", `worksheet:${missingDescription.worksheetName}`);
  }

  const request = drawingGovernanceRequestV2Schema.safeParse({
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    inputClassification: "confidential",
    workbook: {
      fileName: parsed.data.workbook.fileName,
      contentHash: parsed.data.workbook.contentHash,
    },
    worksheets: readyWorksheets.map((worksheet) => ({
      worksheetName: worksheet.worksheetName,
      toleranceLoopDescription: worksheet.toleranceLoopDescription,
      f2Status: "ready",
      rows: worksheet.rows,
    })),
  });
  if (!request.success) return rejected("f2_report_invalid", "Feature2-Report.json");
  return { status: "accepted", request: request.data };
}