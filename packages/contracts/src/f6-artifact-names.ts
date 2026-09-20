import { workbookCatalogFileNameSchema } from "./contracts.js";

const REPORT_SUFFIX = " - TA ENGINEERING ANALYSIS REPORT";
const MAX_WINDOWS_FILE_NAME_LENGTH = 255;

export interface F6ReportFileNames {
  readonly finalReportMdName: string;
  readonly finalReportPdfName: string;
}

export function createF6ReportFileNames(workbookFileName: string): F6ReportFileNames {
  const validated = workbookCatalogFileNameSchema.parse(workbookFileName);
  const workbookBasename = validated.slice(0, -5);
  const reportBasename = `${workbookBasename}${REPORT_SUFFIX}`;
  const names = {
    finalReportMdName: `${reportBasename}.md`,
    finalReportPdfName: `${reportBasename}.pdf`,
  };
  if (Object.values(names).some((name) => name.length > MAX_WINDOWS_FILE_NAME_LENGTH)) {
    throw new Error("F6 report filename is too long.");
  }
  return names;
}
