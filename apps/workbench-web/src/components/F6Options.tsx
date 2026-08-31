import type { ReviewOptionSummary } from "@ai-assist/workbench/review";

export interface F6OptionsProps {
  readonly options: readonly ReviewOptionSummary[];
}

export function F6Options({ options }: F6OptionsProps) {
  return (
    <div className="review-card">
      <h3 className="subheading">F6 Options</h3>
      {options.length === 0 ? <p className="support-text">No F6 options are available to display.</p> : null}
      <ul className="compact-list">
        {options.map((option) => (
          <li key={option.optionId}>
            <strong>{option.label}</strong> · {option.status}
            {typeof option.deltaCpk === "number" ? ` · ΔCpk ${option.deltaCpk.toFixed(2)}` : ""}
            <div className="support-text">{option.summary}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}