import { useState } from "react";
import type { FactorScenarioState } from "../hooks/use-scenario-workspace.js";
import type { FactorRowModel } from "../workspace-model.js";
import { SourceText } from "./SourceText.js";

function statusLabel(status: FactorRowModel["status"]): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "risk":
      return "Risk";
    case "blocked":
      return "Blocked";
    case "modified":
      return "Modified";
  }
}

export function FactorTable({ factors, states, onEdit, onCommit, onSelect, onEvidenceFocus }: {
  readonly factors: readonly FactorRowModel[];
  readonly states: ReadonlyMap<string, FactorScenarioState>;
  readonly onEdit: (factorKey: string, field: "nominalValue" | "upperTolerance" | "lowerTolerance" | "additionalMeanShift", value: string) => void;
  readonly onCommit: (factorKey: string) => void;
  readonly onSelect: (factorKey: string) => void;
  readonly onEvidenceFocus?: (factorKey: string) => void;
}) {
  const [expandedNotesKey, setExpandedNotesKey] = useState<string>();

  return (
    <section className="factor-table-section" aria-label="TA Factor Table">
      <div className="factor-table-section__header"><h2>TA Factor Table</h2><span>{factors.length} Factors</span></div>
      <div className="factor-table-section__body">
        <table className="factor-table factor-table--compact">
          <colgroup>
            <col className="factor-table__col factor-table__col--row" />
            <col className="factor-table__col factor-table__col--factor" />
            <col className="factor-table__col factor-table__col--identity" />
            <col className="factor-table__col factor-table__col--edit" />
            <col className="factor-table__col factor-table__col--edit" />
            <col className="factor-table__col factor-table__col--edit" />
            <col className="factor-table__col factor-table__col--results" />
            <col className="factor-table__col factor-table__col--contribution" />
            <col className="factor-table__col factor-table__col--status" />
          </colgroup>
          <thead><tr><th>Row</th><th>Factor &amp; Process</th><th>Part &amp; IDs</th><th>Nominal</th><th>+Tol</th><th>-Tol</th><th>Results</th><th>Contribution</th><th>Status</th></tr></thead>
          <tbody>
            {factors.map((factor) => {
              const state = states.get(factor.key);
              const notesId = `${factor.key}-notes`;
              const hasNotes = typeof factor.notes === "string" && factor.notes.trim().length > 0;
              const notesExpanded = expandedNotesKey === factor.key;
              return (
                <tr key={factor.key} className={state?.dirty ? "factor-row--modified" : undefined} onClick={() => onSelect(factor.key)}>
                  <th scope="row">{factor.sourceRow}</th>
                  <td>
                    <div className="factor-summary-cell">
                      <SourceText value={factor.factorName} onActivate={() => onEvidenceFocus?.(factor.key)} />
                      <span>{factor.partCategory} · {factor.distribution}</span>
                      <span>LT/SF {factor.longTermSafetyFactorDisplay}</span>
                      <span>Sigma {factor.sigmaLevelDisplay}</span>
                    </div>
                  </td>
                  <td>
                    <div className="factor-identity-cell">
                      <SourceText value={factor.partName} onActivate={() => onEvidenceFocus?.(factor.key)} />
                      <span><strong>Drawing</strong> {factor.drawingNumber ?? "—"}</span>
                      <span><strong>DIM ID</strong> {factor.dimId ?? "—"}</span>
                    </div>
                  </td>
                  {(["nominalValue", "upperTolerance", "lowerTolerance"] as const).map((field) => <td key={field} className="factor-table__cell--numeric"><input aria-label={`${factor.factorName.displayText} ${field}`} aria-describedby={state?.error === undefined ? undefined : `${factor.key}-error`} disabled={!factor.editable} type="number" step="any" value={state?.values[field] ?? String(factor[field])} onChange={(event) => onEdit(factor.key, field, event.target.value)} onBlur={() => onCommit(factor.key)} /></td>)}
                  <td className={state?.calculated === undefined ? "factor-table__cell--numeric" : "factor-table__cell--numeric scenario-value"}>
                    <div className="factor-results-cell">
                      <span>Mean <strong>{state?.calculated?.mean.toFixed(3) ?? factor.meanDisplay}</strong></span>
                      <span>Tol. <strong>{state?.calculated?.tolerance.toFixed(3) ?? factor.toleranceDisplay}</strong></span>
                      <span>1σ <strong>{state?.calculated?.oneSigma.toFixed(3) ?? factor.oneSigmaDisplay}</strong></span>
                    </div>
                  </td>
                  <td className={state?.calculated === undefined ? "factor-table__cell--numeric" : "factor-table__cell--numeric scenario-value"}>{state?.calculated === undefined ? factor.contributionDisplay : `${(state.calculated.contribution * 100).toFixed(1)}%`}</td>
                  <td>
                    <div className="factor-status-cell">
                      <span className={`factor-status factor-status--${factor.status}`}>{statusLabel(factor.status)}</span>
                      <span>{factor.capabilityResult}</span>
                      <span>{factor.knowledgeRecommendation === undefined ? "—" : <SourceText value={factor.knowledgeRecommendation} />}</span>
                      {hasNotes ? (
                        <div className="factor-notes">
                          <button type="button" className="factor-notes__toggle" aria-expanded={notesExpanded} aria-controls={notesId} onClick={(event) => { event.stopPropagation(); setExpandedNotesKey(notesExpanded ? undefined : factor.key); }}>
                            {notesExpanded ? `Hide notes for ${factor.factorName.displayText}` : `Show notes for ${factor.factorName.displayText}`}
                          </button>
                          {notesExpanded ? <p id={notesId} className="factor-notes__detail">{factor.notes}</p> : null}
                        </div>
                      ) : null}
                      <span id={`${factor.key}-error`} className="factor-row-state">{state?.calculating ? "Updating" : state?.error ?? ""}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
