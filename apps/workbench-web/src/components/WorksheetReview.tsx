import type { WorksheetReviewModel } from "../../../../packages/workbench/src/review-projection.js";

import { ConclusionPane } from "./ConclusionPane.js";
import { EvidencePane } from "./EvidencePane.js";

export interface WorksheetReviewProps {
  readonly review: WorksheetReviewModel;
  readonly onSelectWorksheet?: (worksheetName: string) => void;
  readonly onSelectFinding?: (findingId: string) => void;
}

export function WorksheetReview({ review, onSelectWorksheet, onSelectFinding }: WorksheetReviewProps) {
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
          <div className="choice-group" role="list">
            {review.worksheets.map((worksheet) => (
              <button
                key={worksheet.worksheetName}
                type="button"
                className={`button review-finding-button${worksheet.worksheetName === review.selectedWorksheetName ? " review-finding-button--active" : ""}`}
                onClick={() => onSelectWorksheet?.(worksheet.worksheetName)}
              >
                {worksheet.worksheetName} · {worksheet.status} · {worksheet.findingCount}
              </button>
            ))}
          </div>
        </section>

        <EvidencePane
          evidence={review.evidence}
          analysisContext={review.analysisContext}
          optimizationTargets={review.optimizationTargets}
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