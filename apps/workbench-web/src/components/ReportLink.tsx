import type { ReviewReportLink } from "@ai-assist/workbench/review";

export interface ReportLinkProps {
  readonly sessionId: string;
  readonly report?: ReviewReportLink;
}

export function ReportLink({ sessionId, report }: ReportLinkProps) {
  if (report === undefined) {
    return <p className="support-text">No validated report link is available yet.</p>;
  }

  return (
    <a className="button button--ghost" href={`/api/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(report.artifactId)}`}>
      {report.label}
    </a>
  );
}