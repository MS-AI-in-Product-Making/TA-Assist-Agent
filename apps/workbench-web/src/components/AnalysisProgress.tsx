import type { FeatureLedgerEntry } from "../workbench-session.js";
import type { RunnerProgressEvent } from "../api.js";
import type { F8AdoProjection } from "@ai-assist/contracts";
import { useEffect, useState } from "react";

import { reasonDisplay } from "../web-projection.js";

export interface AnalysisProgressProps {
  readonly entries: readonly FeatureLedgerEntry[];
  readonly progress?: RunnerProgressEvent;
  readonly adoProjection?: F8AdoProjection;
  readonly activeAttemptStartedAt?: string;
  readonly connected: boolean;
}

export function AnalysisProgress({ entries, progress, adoProjection, activeAttemptStartedAt, connected }: AnalysisProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  const pendingAdo = adoProjection?.state === "validation_pending" || adoProjection?.state === "write_pending" ? adoProjection : undefined;
  const timerStartedAt = pendingAdo?.startedAt ?? (progress?.kind === "stage_started" ? progress.timestamp : activeAttemptStartedAt);
  useEffect(() => {
    if (timerStartedAt === undefined) return () => undefined;
    setNow(Date.now());
    const handle = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(handle);
  }, [timerStartedAt]);
  const visibleEntries = entriesForProgress(entries, progress);
  const active = visibleEntries.find((entry) => entry.status === "running");
  const activeFeatureId = active === undefined ? undefined : progress?.featureId ?? active.featureId;

  return (
    <section className="analysis-progress" aria-label="Analysis progress">
      <div className="analysis-progress__summary">
        <strong>{activeFeatureId === undefined ? "Analysis flow" : `${activeFeatureId} running`}</strong>
        <span>{adoStageLabel(adoProjection) ?? (active === undefined ? summaryFor(visibleEntries) : stageLabel(progress))}</span>
        {pendingAdo !== undefined ? <time>{adoTiming(pendingAdo.startedAt, pendingAdo.expiresAt, now)}</time> : timerStartedAt === undefined ? null : <time>{elapsed(timerStartedAt, now)}</time>}
        <span className={connected ? "analysis-progress__live" : "analysis-progress__reconnecting"}>{connected ? "Live sync" : "Reconnecting"}</span>
      </div>
      <ol className="analysis-progress__track">
        {visibleEntries.map((entry) => (
          <li key={entry.featureId} className={`analysis-progress__step analysis-progress__step--${entry.status}`}>
            <span className="analysis-progress__marker" aria-hidden="true" />
            <div className="analysis-progress__content">
              <strong>{entry.featureId}</strong>
              <span>{entry.displayLabel}</span>
              <span>{statusLabel(entry)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function entriesForProgress(entries: readonly FeatureLedgerEntry[], progress: RunnerProgressEvent | undefined): readonly FeatureLedgerEntry[] {
  if (progress === undefined || progress.kind === "artifact_written") return entries;
  const activeIndex = entries.findIndex((entry) => entry.featureId === progress.featureId);
  if (activeIndex < 0) return entries;
  return entries.map((entry, index) => {
    if (entry.lifecycle === "in_development") return entry;
    if (index < activeIndex) return { ...entry, status: "completed", displayStatus: reasonDisplay("completed") };
    if (index === activeIndex) {
      const status = progress.kind === "stage_failed" ? "failed" : progress.kind === "stage_completed" ? "completed" : "running";
      return { ...entry, status, displayStatus: reasonDisplay(status) };
    }
    return { ...entry, status: "pending", displayStatus: reasonDisplay("pending") };
  });
}

function statusLabel(entry: FeatureLedgerEntry): string {
  return entry.displayStatus;
}

function summaryFor(entries: readonly FeatureLedgerEntry[]): string {
  const action = entries.find((entry) => entry.status === "action_required");
  if (action !== undefined) return `${action.featureId} needs action`;
  return entries.some((entry) => entry.status === "failed") ? "Analysis needs attention" : "Progress synced";
}

function stageLabel(progress: RunnerProgressEvent | undefined): string {
  if (progress === undefined) return "Running governed analysis";
  if (progress.stage === "f1-selection") return "Reading Worksheet";
  if (progress.stage === "report" && progress.featureId === "F2") return "Generating user report";
  const stage = progress.stage;
  const labels: Record<string, string> = { selection: "Reading Worksheet", f1: "Extracting Workbook", f2: "Generating user report", validation: "Validating output", report: "Generating analysis report" };
  return labels[stage] ?? `Running ${stage}`;
}

function elapsed(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1_000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function adoStageLabel(projection: F8AdoProjection | undefined): string | undefined {
  if (projection?.state === "validation_pending") return "Waiting for VS Code host";
  if (projection?.state === "preview_ready") return "ADO preview ready";
  if (projection?.state === "write_pending") return "Writing and verifying ADO update";
  if (projection?.state === "completed") return "ADO update completed";
  if (projection?.state === "blocked") return isAdoWriteAction(projection.actionId) ? "ADO write blocked" : "ADO validation blocked";
  if (projection?.state === "failed") return isAdoWriteAction(projection.actionId) ? "ADO write failed" : "ADO validation failed";
  return undefined;
}

function isAdoWriteAction(actionId: string | undefined): boolean {
  return actionId?.startsWith("ado-write:") ?? false;
}

function adoTiming(startedAt: string, expiresAt: string, now: number): string {
  return `Elapsed ${duration(now - Date.parse(startedAt))} · timeout in ${duration(Date.parse(expiresAt) - now)}`;
}

function duration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}