import { useId, type KeyboardEvent } from "react";

import type { ProjectedText } from "../web-projection.js";

export function SourceText({ value, onActivate }: { readonly value: ProjectedText; readonly onActivate?: () => void }) {
  const descriptionId = useId();
  const hasActivation = onActivate !== undefined;

  return (
    <span className="source-text">
      <span
        {...(hasActivation ? {
          role: "button",
          tabIndex: 0,
          onClick: onActivate,
          onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onActivate();
            }
          },
        } : { tabIndex: 0 })}
        title={value.sourceText}
        aria-describedby={descriptionId}
      >
        {value.displayText}{value.translated ? null : <span className="source-text__fallback"> Original text</span>}
      </span>
      <span id={descriptionId} className="sr-only">{value.sourceText}</span>
    </span>
  );
}