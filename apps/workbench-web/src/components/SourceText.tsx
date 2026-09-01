import { useId } from "react";

import type { ProjectedText } from "../web-projection.js";

export function SourceText({ value, onActivate }: { readonly value: ProjectedText; readonly onActivate?: () => void }) {
  const descriptionId = useId();
  if (onActivate !== undefined) {
    return (
      <span className="source-text">
        <button type="button" className="source-text__button" onClick={onActivate} title={value.sourceText} aria-describedby={descriptionId}>
          {value.displayText}
        </button>
        <span id={descriptionId} className="sr-only">{value.sourceText}</span>
      </span>
    );
  }

  return (
    <span className="source-text">
      <span title={value.sourceText} aria-describedby={descriptionId}>{value.displayText}</span>
      <span id={descriptionId} className="sr-only">{value.sourceText}</span>
    </span>
  );
}