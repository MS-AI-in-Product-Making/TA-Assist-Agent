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
            {Array.from({ length: 19 }).map((_, index) => <col key={index} className="factor-table__col" />)}
          </colgroup>
          <thead>
            <tr>
              <th>Loop Label</th>
              <th>Factor Description</th>
              <th>Part Name</th>
              <th>Drawing Number</th>
              <th>DIM ID</th>
              <th>Part Category</th>
              <th>Design Nominal</th>
              <th>+ Tolerance</th>
              <th>- Tolerance</th>
              <th>Long Term/Safety Factor</th>
              <th>Sigma Level</th>
              <th>Distribution</th>
              <th>Mean</th>
              <th>Tolerance</th>
              <th>One Sigma</th>
              <th>% Contribution to Sigma</th>
              <th>Notes</th>
              <th>Capability Result</th>
              <th>Knowledge Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((factor) => {
              const state = states.get(factor.key);
              const notesId = `${factor.key}-notes`;
              const hasNotes = typeof factor.notes === "string" && factor.notes.trim().length > 0;
              const notesExpanded = expandedNotesKey === factor.key;
              const activateFactor = () => {
                onSelect(factor.key);
                onEvidenceFocus?.(factor.key);
              };
              const loopRowTitle = `Excel source row ${factor.sourceRow}`;
              return (
                <tr key={factor.key} className={state?.dirty ? "factor-row--modified" : undefined}>
                  <td title={loopRowTitle}>
                    <span>{factor.loopLabel ?? "Not available"}</span>
                    <span className="sr-only">{loopRowTitle}</span>
                  </td>
                  <td>
                    <div className="factor-summary-cell">
                      <SourceText value={factor.factorName} onActivate={activateFactor} />
                    </div>
                  </td>
                  <td><SourceText value={factor.partName} onActivate={activateFactor} /></td>
                  <td>{factor.drawingNumber ?? "—"}</td>
                  <td>{factor.dimId ?? "—"}</td>
                  <td>{factor.partCategory}</td>
                  {(["nominalValue", "upperTolerance", "lowerTolerance"] as const).map((field) => <td key={field} className="factor-table__cell--numeric"><input aria-label={`${factor.factorName.displayText} ${field}`} aria-describedby={state?.error === undefined ? undefined : `${factor.key}-error`} disabled={!factor.editable} type="number" name={field} autoComplete="off" step="any" value={state?.values[field] ?? String(factor[field])} onChange={(event) => onEdit(factor.key, field, event.target.value)} onBlur={() => onCommit(factor.key)} /></td>)}
                  <td className="factor-table__cell--numeric">{factor.longTermSafetyFactorDisplay}</td>
                  <td className="factor-table__cell--numeric">{factor.sigmaLevelDisplay}</td>
                  <td>{factor.distribution}</td>
                  <td className={state?.calculated === undefined ? "factor-table__cell--numeric" : "factor-table__cell--numeric scenario-value"}>{state?.calculated?.mean.toFixed(3) ?? factor.meanDisplay}</td>
                  <td className={state?.calculated === undefined ? "factor-table__cell--numeric" : "factor-table__cell--numeric scenario-value"}>{state?.calculated?.tolerance.toFixed(3) ?? factor.toleranceDisplay}</td>
                  <td className={state?.calculated === undefined ? "factor-table__cell--numeric" : "factor-table__cell--numeric scenario-value"}>{state?.calculated?.oneSigma.toFixed(3) ?? factor.oneSigmaDisplay}</td>
                  <td className={state?.calculated === undefined ? "factor-table__cell--numeric" : "factor-table__cell--numeric scenario-value"}>{state?.calculated === undefined ? factor.contributionDisplay : `${(state.calculated.contribution * 100).toFixed(1)}%`}</td>
                  <td>
                    {hasNotes ? (
                      <div className="factor-notes">
                        <button type="button" className="factor-notes__toggle" aria-expanded={notesExpanded} aria-controls={notesId} onClick={() => setExpandedNotesKey(notesExpanded ? undefined : factor.key)}>
                          {notesExpanded ? `Hide notes for ${factor.factorName.displayText}` : `Show notes for ${factor.factorName.displayText}`}
                        </button>
                        {notesExpanded ? <p id={notesId} className="factor-notes__detail">{factor.notes}</p> : null}
                      </div>
                    ) : "—"}
                  </td>
                  <td>
                    <div className="factor-status-cell">
                      <span className={`factor-status factor-status--${factor.status}`}>{statusLabel(factor.status)}</span>
                      <span>{factor.capabilityResult}</span>
                      <span id={`${factor.key}-error`} className="factor-row-state">{state?.calculating ? "Updating" : state?.error ?? ""}</span>
                    </div>
                  </td>
                  <td>{factor.knowledgeRecommendation === undefined ? "—" : <SourceText value={factor.knowledgeRecommendation} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
