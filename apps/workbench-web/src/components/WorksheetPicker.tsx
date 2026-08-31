import { useState } from "react";

import type { WorksheetWorkspaceModel } from "../workspace-model.js";

export function WorksheetPicker({ worksheets, selectedWorksheetName, onSelect }: {
  readonly worksheets: readonly WorksheetWorkspaceModel[];
  readonly selectedWorksheetName?: string;
  readonly onSelect: (worksheetName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = worksheets.filter(({ worksheetName }) => worksheetName.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const select = (worksheetName: string) => { onSelect(worksheetName); setQuery(""); setOpen(false); };

  return (
    <div className="worksheet-picker">
      <span>Worksheet</span>
      <input id="worksheet-search" type="search" role="combobox" aria-label="Worksheet" aria-controls="worksheet-options" aria-expanded={open} aria-activedescendant={open && filtered[activeIndex] !== undefined ? `worksheet-option-${activeIndex}` : undefined} value={query} placeholder={selectedWorksheetName ?? "Search worksheet"} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.min(current + 1, Math.max(0, filtered.length - 1))); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
        if (event.key === "Enter" && open && filtered[activeIndex] !== undefined) { event.preventDefault(); select(filtered[activeIndex]!.worksheetName); }
        if (event.key === "Escape") { setOpen(false); }
      }} />
      <div id="worksheet-options" className="worksheet-picker__options" role="listbox" aria-label="Worksheet options" hidden={!open}>
        {filtered.map((worksheet, index) => (
          <button id={`worksheet-option-${index}`} key={worksheet.worksheetName} type="button" role="option" aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(worksheet.worksheetName)}>
            <span>{worksheet.worksheetName}</span>
            <span className={`worksheet-status worksheet-status--${worksheet.status}`}>{statusLabel(worksheet.status)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: WorksheetWorkspaceModel["status"]): string {
  return status === "ready" ? "Ready" : status === "risk" ? "Risk" : status === "modified" ? "Modified" : "Blocked";
}
