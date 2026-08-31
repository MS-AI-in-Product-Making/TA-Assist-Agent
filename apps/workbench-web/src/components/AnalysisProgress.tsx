import type { FeatureLedgerEntry } from "../workbench-session.js";
import type { RunnerProgressEvent } from "../api.js";
import { useEffect, useState } from "react";

import { reasonDisplay } from "../web-projection.js";

export interface AnalysisProgressProps {
  readonly entries: readonly FeatureLedgerEntry[];
  readonly progress?: RunnerProgressEvent;
  readonly activeAttemptStartedAt?: string;
  readonly connected: boolean;
}

export function AnalysisProgress({ entries, progress, activeAttemptStartedAt, connected }: AnalysisProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  const timerStartedAt = progress?.kind === "stage_started" ? progress.timestamp : activeAttemptStartedAt;
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
        <span>{active === undefined ? summaryFor(visibleEntries) : stageLabel(progress)}</span>
        {timerStartedAt === undefined ? null : <time>{elapsed(timerStartedAt, now)}</time>}
        <span className={connected ? "analysis-progress__live" : "analysis-progress__reconnecting"}>{connected ? "Live sync" : "Reconnecting"}</span>
      </div>
      <ol className="analysis-progress__track">
        {visibleEntries.map((entry) => (
          <li key={entry.featureId} className={`analysis-progress__step analysis-progress__step--${entry.status}`}>
            <span className="analysis-progress__marker" aria-hidden="true" />
            <strong>{entry.featureId}</strong>
            <span>{entry.displayLabel}</span>
            <span>{statusLabel(entry)}</span>
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