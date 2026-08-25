import type { ReviewCard, ReviewEvidencePane } from "@ai-assist/workbench/review";

export interface EvidencePaneProps {
  readonly id?: string;
  readonly labelledBy?: string;
  readonly evidence?: ReviewEvidencePane;
  readonly analysisContext?: ReviewCard;
  readonly optimizationTargets?: ReviewCard;
  readonly detail?: string;
  readonly onFocusSource?: (cell: string) => void;
  readonly onShowFormula?: (formulaId: string) => void;
  readonly onShowRule?: (ruleEntryId: string) => void;
  readonly onOpenArtifact?: (artifactId: string) => void;
}

export function EvidencePane({ id, labelledBy, evidence, analysisContext, optimizationTargets, detail, onFocusSource, onShowFormula, onShowRule, onOpenArtifact }: EvidencePaneProps) {
  return (
    <section id={id} className="panel review-pane" role="tabpanel" aria-labelledby={labelledBy}>
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
            {evidence.sourceCells.map((cell) => onFocusSource === undefined ? <span key={cell} className="token-chip">{cell}</span> : <button key={cell} type="button" className="token-chip" onClick={() => onFocusSource(cell)}>{cell}</button>)}
          </div>
          <div className="token-row" aria-label="formula ids">
            {evidence.formulaIds.map((formulaId) => onShowFormula === undefined ? <span key={formulaId} className="token-chip">{formulaId}</span> : <button key={formulaId} type="button" className="token-chip" onClick={() => onShowFormula(formulaId)}>{formulaId}</button>)}
          </div>
          {evidence.ruleEntryId === undefined ? null : onShowRule === undefined ? <p>F0 Rule: {evidence.ruleEntryId}</p> : <button type="button" onClick={() => onShowRule(evidence.ruleEntryId!)}>F0 Rule: {evidence.ruleEntryId}</button>}
          {evidence.imageArtifactId === undefined ? null : onOpenArtifact === undefined ? <p>Image Artifact: {evidence.imageArtifactId}</p> : <button type="button" onClick={() => onOpenArtifact(evidence.imageArtifactId!)}>Image Artifact: {evidence.imageArtifactId}</button>}
          {detail === undefined ? null : <p role="status" className="support-text">{detail}</p>}
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