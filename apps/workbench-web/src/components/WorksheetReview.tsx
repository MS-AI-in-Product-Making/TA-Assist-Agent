import { useState } from "react";

import type { WorksheetReviewModel } from "@ai-assist/workbench";

import { ConclusionPane } from "./ConclusionPane.js";
import { EvidencePane } from "./EvidencePane.js";

export interface WorksheetReviewProps {
  readonly review: WorksheetReviewModel;
  readonly onSelectWorksheet?: (worksheetName: string) => void;
  readonly onSelectFinding?: (findingId: string) => void;
}

export function WorksheetReview({ review, onSelectWorksheet, onSelectFinding }: WorksheetReviewProps) {
  const [evidenceDetail, setEvidenceDetail] = useState<string>();
  const selectedTabId = worksheetTabId(review.selectedWorksheetName);
  return (
    <section className="panel" aria-labelledby="worksheet-review-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Review</p>
          <h2 id="worksheet-review-title">Three-pane Worksheet Review</h2>
        </div>
      </div>
      <div className="review-grid">
        <section className="panel review-pane" aria-labelledby="worksheet-queue-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Queue</p>
              <h2 id="worksheet-queue-title">Worksheet Queue</h2>
            </div>
          </div>
          <div className="choice-group" role="tablist" aria-label="Worksheet queue" aria-orientation="vertical">
            {review.worksheets.map((worksheet, index) => (
              <button
                key={worksheet.worksheetName}
                type="button"
                className={`button review-finding-button${worksheet.worksheetName === review.selectedWorksheetName ? " review-finding-button--active" : ""}`}
                onClick={() => onSelectWorksheet?.(worksheet.worksheetName)}
                onKeyDown={(event) => {
                  const buttons = [...event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
                  const targetIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (index + 1) % buttons.length : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length : undefined;
                  if (targetIndex !== undefined) { event.preventDefault(); buttons[targetIndex]?.focus(); onSelectWorksheet?.(review.worksheets[targetIndex]!.worksheetName); }
                }}
                role="tab"
                id={worksheetTabId(worksheet.worksheetName)}
                aria-controls="worksheet-review-panel"
                aria-selected={worksheet.worksheetName === review.selectedWorksheetName}
                tabIndex={worksheet.worksheetName === review.selectedWorksheetName ? 0 : -1}
              >
                {worksheet.worksheetName} · {worksheet.status} · {worksheet.findingCount}
              </button>
            ))}
          </div>
        </section>

        <EvidencePane
          id="worksheet-review-panel"
          labelledBy={selectedTabId}
          evidence={review.evidence}
          analysisContext={review.analysisContext}
          optimizationTargets={review.optimizationTargets}
          detail={evidenceDetail}
          onFocusSource={(cell) => setEvidenceDetail(`Source evidence focused: ${cell}`)}
          onShowFormula={(formulaId) => setEvidenceDetail(`Formula evidence: ${formulaId}`)}
          onShowRule={(ruleEntryId) => setEvidenceDetail(`F0 rule evidence: ${ruleEntryId}`)}
          onOpenArtifact={(artifactId) => setEvidenceDetail(`Authenticated artifact route: /api/sessions/${encodeURIComponent(review.sessionId)}/artifacts/${encodeURIComponent(artifactId)}`)}
        />

        <ConclusionPane
          sessionId={review.sessionId}
          findings={review.findings}
          selectedFindingId={review.selectedFindingId}
          onSelectFinding={onSelectFinding}
          options={review.f6Options}
          report={review.report}
        />
      </div>
    </section>
  );
}

function worksheetTabId(worksheetName: string): string {
  return `worksheet-tab-${encodeURIComponent(worksheetName).replace(/%/g, "_")}`;
}