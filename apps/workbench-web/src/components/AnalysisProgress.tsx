import type { ProductStageEntry } from "../workbench-session.js";
import type { RunnerProgressEvent } from "../api.js";
import type { F8AdoProjection } from "@ai-assist/contracts";
import { useEffect, useState } from "react";

import { reasonDisplay } from "../web-projection.js";

export interface AnalysisProgressProps {
  readonly stages: readonly ProductStageEntry[];
  readonly progress?: RunnerProgressEvent;
  readonly adoProjection?: F8AdoProjection;
  readonly activeAttemptStartedAt?: string;
  readonly connected: boolean;
}

export function AnalysisProgress({ stages, progress, adoProjection, activeAttemptStartedAt, connected }: AnalysisProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  const pendingAdo = adoProjection?.state === "validation_pending" || adoProjection?.state === "write_pending" ? adoProjection : undefined;
  const timerStartedAt = pendingAdo?.startedAt ?? (progress?.kind === "stage_started" ? progress.timestamp : activeAttemptStartedAt);
  useEffect(() => {
    if (timerStartedAt === undefined) return () => undefined;
    setNow(Date.now());
    const handle = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(handle);
  }, [timerStartedAt]);
  const visibleStages = stages;
  const active = visibleStages.find((stage) => stage.status === "running" || stage.status === "action_required");

  return (
    <section className="analysis-progress" aria-label="Analysis progress">
      <div className="analysis-progress__summary">
        <strong>TA workbook analysis</strong>
        <span>{adoStageLabel(adoProjection) ?? (active === undefined ? summaryFor(visibleStages) : active.label)}</span>
        {pendingAdo !== undefined ? <time>{adoTiming(pendingAdo.startedAt, pendingAdo.expiresAt, now)}</time> : timerStartedAt === undefined ? null : <time>{elapsed(timerStartedAt, now)}</time>}
        <span className={connected ? "analysis-progress__live" : "analysis-progress__reconnecting"}>{connected ? "Live sync" : "Reconnecting"}</span>
      </div>
      <ol className="analysis-progress__track">
        {visibleStages.map((stage) => (
          <li key={stage.stageId} className={`analysis-progress__step analysis-progress__step--${stage.status}`}>
            <span className="analysis-progress__marker" aria-hidden="true" />
            <div className="analysis-progress__content">
              <strong>{stage.label}</strong>
              <span>{statusLabel(stage)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function statusLabel(stage: ProductStageEntry): string {
  return stage.displayStatus;
}

function summaryFor(stages: readonly ProductStageEntry[]): string {
  const action = stages.find((stage) => stage.status === "action_required");
  if (action !== undefined) return `${action.label} requires action`;
  return stages.some((stage) => stage.status === "failed") ? "Analysis needs attention" : "Progress synced";
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
