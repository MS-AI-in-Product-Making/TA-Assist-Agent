import type { ReviewCard, ReviewEvidencePane } from "@ai-assist/workbench";

export interface EvidencePaneProps {
  readonly id?: string;
  readonly evidence?: ReviewEvidencePane;
  readonly analysisContext?: ReviewCard;
  readonly optimizationTargets?: ReviewCard;
}

export function EvidencePane({ id, evidence, analysisContext, optimizationTargets }: EvidencePaneProps) {
  return (
    <section id={id} className="panel review-pane" role="tabpanel" aria-labelledby="worksheet-queue-title review-evidence-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Evidence</p>
          <h2 id="review-evidence-title">Read-only Evidence</h2>
        </div>
      </div>
      {evidence === undefined ? <p className="support-text">当前 worksheet 尚未绑定可展示的只读证据。</p> : (
        <div className="stack">
          <p><strong>Source Row {evidence.sourceRow}</strong></p>
          <div className="token-row" aria-label="source cells">
            {evidence.sourceCells.map((cell) => <button key={cell} type="button" className="token-chip" aria-current="true">{cell}</button>)}
          </div>
          <div className="token-row" aria-label="formula ids">
            {evidence.formulaIds.map((formulaId) => <button key={formulaId} type="button" className="token-chip">{formulaId}</button>)}
          </div>
          {evidence.ruleEntryId !== undefined ? <button type="button">F0 Rule: {evidence.ruleEntryId}</button> : null}
          {evidence.imageArtifactId !== undefined ? <button type="button">Image Artifact: {evidence.imageArtifactId}</button> : null}
          <div>
            <h3 className="subheading">Bound Factors</h3>
            <ul className="compact-list">
              {evidence.factors.map((factor) => (
                <li key={`${factor.factorName}-${factor.sourceRow}`}>
                  {factor.factorName} · Row {factor.sourceRow}{typeof factor.contribution === "number" ? ` · Contribution ${factor.contribution.toFixed(2)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {analysisContext !== undefined ? <ReviewCardSection card={analysisContext} /> : null}
      {optimizationTargets !== undefined ? <ReviewCardSection card={optimizationTargets} /> : null}
    </section>
  );
}

function ReviewCardSection({ card }: { readonly card: ReviewCard }) {
  return (
    <div className="review-card">
      <h3 className="subheading">{card.title}</h3>
      <ul className="compact-list">
        {card.items.map((item, index) => <li key={`${card.title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}