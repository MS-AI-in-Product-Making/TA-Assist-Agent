import type { WorkspaceIssue } from "../business-status.js";

export function WorkspaceIssuePanel({ issue, onAction }: { readonly issue?: WorkspaceIssue; readonly onAction?: (action: NonNullable<WorkspaceIssue["action"]>) => void }) {
  if (issue === undefined) return null;
  return <section className={`workspace-issue workspace-issue--${issue.severity}`} role={issue.severity === "error" ? "alert" : "status"}><div><strong>{issue.title}</strong><p>{issue.detail}</p></div>{issue.action === undefined || onAction === undefined ? null : <button type="button" className="button" onClick={() => onAction(issue.action!)}>{actionLabel(issue.action)}</button>}</section>;
}

function actionLabel(action: NonNullable<WorkspaceIssue["action"]>) {
  return action === "retry" ? "Retry" : action === "refresh" ? "Refresh" : action === "upload" ? "Upload again" : "Review issue";
}
