import { useEffect, useState, type CSSProperties } from "react";

import type { AnalysisTargetModel } from "../workspace-model.js";

interface EvidenceImagePaneProps {
  readonly worksheetName: string;
  readonly imageUrl?: string;
  readonly focusedLabel?: string;
  readonly analysisTarget: AnalysisTargetModel;
}

export function EvidenceImagePane({ worksheetName, imageUrl, focusedLabel, analysisTarget }: EvidenceImagePaneProps) {
  const [scale, setScale] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [imageUrl]);

  return (
    <section className={`evidence-pane ${expanded ? "evidence-pane--expanded" : ""}`} aria-label="Tolerance loop evidence">
      <header className="evidence-pane__header">
        <div><span>F1 Evidence</span><h2>Tolerance loop stack-up</h2></div>
        <div className="evidence-pane__tools">
          <button type="button" className="icon-button" aria-label="Zoom out" onClick={() => setScale((value) => Math.max(0.5, value - 0.25))}>−</button>
          <button type="button" className="icon-button" aria-label="Fit to frame" onClick={() => setScale(1)}>↙</button>
          <button type="button" className="icon-button" aria-label="Zoom in" onClick={() => setScale((value) => Math.min(3, value + 0.25))}>+</button>
          <button type="button" className="icon-button" aria-label={expanded ? "Exit full screen" : "Full screen"} onClick={() => setExpanded((value) => !value)}>⛶</button>
        </div>
      </header>
      {imageUrl === undefined ? (
        <div className="evidence-pane__empty"><strong>This worksheet is missing a tolerance loop stack-up image</strong><span>Add the image in the source workbook and upload again.</span></div>
      ) : loadError ? (
        <div className="evidence-pane__empty" aria-live="polite"><strong>The governed image artifact could not be loaded.</strong><span>Refresh this session or rerun workbook analysis.</span></div>
      ) : (
        <div className="evidence-pane__stage" data-testid="evidence-image-stage" style={{ "--evidence-scale": String(scale) } as CSSProperties}>
          <img src={imageUrl} alt={`${worksheetName} tolerance loop stack-up`} width={1600} height={900} loading="lazy" onError={() => setLoadError(true)} />
        </div>
      )}
      <footer className="evidence-pane__context"><span>{worksheetName}</span>{focusedLabel === undefined ? null : <strong>{focusedLabel}</strong>}</footer>
      <dl className="evidence-pane__target" aria-label="Analysis target details">
        <TargetField label="Tolerance Loop Description" value={analysisTarget.description} reason={analysisTarget.description === "Not available" ? analysisTarget.descriptionReason : undefined} />
        <TargetField label="Design Nominal" value={displayTargetValue(analysisTarget.designNominal.display, analysisTarget.unit)} reason={analysisTarget.designNominal.reason} />
        <TargetField label="Lower Spec Limit" value={displayTargetValue(analysisTarget.lowerSpecLimit.display, analysisTarget.unit)} reason={analysisTarget.lowerSpecLimit.reason} />
        <TargetField label="Upper Spec Limit" value={displayTargetValue(analysisTarget.upperSpecLimit.display, analysisTarget.unit)} reason={analysisTarget.upperSpecLimit.reason} />
      </dl>
    </section>
  );
}

function TargetField({ label, value, reason }: { readonly label: string; readonly value: string; readonly reason?: string }) {
  return (
    <div className="evidence-pane__target-item">
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {reason === undefined ? null : <small>{reason}</small>}
      </dd>
    </div>
  );
}

function displayTargetValue(display: string, unit: string): string {
  return display === "Not available" ? display : `${display} ${unit}`;
}
