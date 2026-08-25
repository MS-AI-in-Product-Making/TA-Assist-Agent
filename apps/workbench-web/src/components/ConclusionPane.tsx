import { useEffect, useState } from "react";

import type { ReviewFinding } from "@ai-assist/workbench";

import { F6Options } from "./F6Options.js";
import { ReportLink } from "./ReportLink.js";
import type { WorksheetReviewProps } from "./WorksheetReview.js";

export interface ConclusionPaneProps {
  readonly sessionId: string;
  readonly findings: readonly ReviewFinding[];
  readonly selectedFindingId?: string;
  readonly onSelectFinding?: (findingId: string) => void;
  readonly options: WorksheetReviewProps["review"]["f6Options"];
  readonly report: WorksheetReviewProps["review"]["report"];
}

export function ConclusionPane({ sessionId, findings, selectedFindingId, onSelectFinding, options, report }: ConclusionPaneProps) {
  const [activeFindingId, setActiveFindingId] = useState<string | undefined>(selectedFindingId ?? findings[0]?.findingId);

  useEffect(() => {
    setActiveFindingId(selectedFindingId ?? findings[0]?.findingId);
  }, [findings, selectedFindingId]);

  const activeFinding = findings.find((finding) => finding.findingId === activeFindingId) ?? findings[0];

  return (
    <section className="panel review-pane" aria-labelledby="review-conclusion-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Review</p>
          <h2 id="review-conclusion-title">Finding and Action</h2>
        </div>
        <ReportLink sessionId={sessionId} report={report} />
      </div>
      <div className="stack">
        <div>
          <h3 className="subheading">Findings</h3>
          <div className="choice-group" role="listbox" aria-label="Engineering findings">
            {findings.map((finding) => (
              <button
                key={finding.findingId}
                type="button"
                className={`button review-finding-button${finding.findingId === activeFinding?.findingId ? " review-finding-button--active" : ""}`}
                role="option"
                aria-selected={finding.findingId === activeFinding?.findingId}
                onClick={() => {
                  setActiveFindingId(finding.findingId);
                  onSelectFinding?.(finding.findingId);
                }}
              >
                {finding.title}
              </button>
            ))}
          </div>
        </div>
        {activeFinding !== undefined ? (
          <div className="review-card">
            <h3 className="subheading">{activeFinding.title}</h3>
            <p>{activeFinding.summary}</p>
            {activeFinding.action !== undefined ? (
              <>
                <p><strong>{activeFinding.action.title}</strong></p>
                <p className="support-text">{activeFinding.action.summary}</p>
              </>
            ) : null}
          </div>
        ) : <p className="support-text">当前没有需要工程审阅的 finding。</p>}
        <F6Options options={options} />
      </div>
    </section>
  );
}