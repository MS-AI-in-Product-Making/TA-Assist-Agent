import type { ReviewReportLink } from "../../../../packages/workbench/src/review-projection.js";

export interface ReportLinkProps {
  readonly sessionId: string;
  readonly report?: ReviewReportLink;
}

export function ReportLink({ sessionId, report }: ReportLinkProps) {
  if (report === undefined) {
    return <p className="support-text">当前没有已验证的报告入口。</p>;
  }

  return (
    <a className="button button--ghost" href={`/api/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(report.artifactId)}`}>
      {report.label}
    </a>
  );
}