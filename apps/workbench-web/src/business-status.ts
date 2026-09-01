import type { TypedError } from "@ai-assist/contracts";

import { reasonDisplay } from "./web-projection.js";
import type { F8SessionSnapshot } from "./workbench-session.js";

export interface WorkspaceIssue { readonly severity: "info" | "warning" | "error"; readonly title: string; readonly detail: string; readonly action?: "retry" | "refresh" | "upload" | "confirm" }

export function projectWorkspaceIssue(snapshot: F8SessionSnapshot | undefined, error: TypedError | undefined): WorkspaceIssue | undefined {
  const toleranceStageLabel = "Review dimension traceability";
  if (error !== undefined) {
    if (error.code === "transient_error") return { severity: "warning", title: reasonDisplay(error.code), detail: "Your edits remain local while the connection recovers. Validation will resume automatically.", action: "retry" };
    if (error.code === "evidence_mismatch") return { severity: "warning", title: reasonDisplay(error.code), detail: `Refresh the current ${toleranceStageLabel} worksheet before continuing.`, action: "refresh" };
    if (error.code === "calculation_not_possible") return { severity: "warning", title: reasonDisplay(error.code), detail: "Add direction evidence or adjust only the tolerance range." };
    if (error.code === "validation_error") return { severity: "error", title: reasonDisplay(error.code), detail: "Check the workbook or input values, then try again.", action: "upload" };
    return { severity: "error", title: "Action incomplete", detail: "Try again. If the issue persists, refresh the current workspace.", action: "retry" };
  }
  if (snapshot?.state === "initial_scope_required") return { severity: "warning", title: "No analyzable worksheet", detail: "Check Auto Summary or worksheet data.", action: "confirm" };
  if (snapshot?.state === "failed") return { severity: "error", title: "Workspace setup failed", detail: "The current content is preserved. Retry or upload another workbook.", action: "retry" };
  return undefined;
}
