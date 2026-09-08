import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import { xPosition, type SpecificationPlotModel } from "../chart-model.js";
import { clampSpecDraft, specValueFromPointer, stepSpecValue, type SpecificationDraftClampResult } from "../specification-drag.js";
import type { WhatIfMetrics } from "./MetricComparison.js";
import { InputGuidance, inputGuidanceId } from "./InputGuidance.js";

type SpecField = "lowerSpecLimit" | "upperSpecLimit";

interface SpecificationPlotProps {
  readonly model: SpecificationPlotModel;
  readonly draft?: WhatIfMetrics;
  readonly systemValues?: { readonly lowerSpecLimit: string; readonly upperSpecLimit: string };
  readonly onSystemEdit?: (field: SpecField, value: string) => void;
  readonly onSystemCommit?: (field: SpecField) => void;
  readonly externalError?: string;
}

const PLOT_LEFT = 42;
const PLOT_WIDTH = 516;
const SVG_WIDTH = 600;
const MIN_DOMAIN_SPAN = 0.001;

export function SpecificationPlot({ model, draft, systemValues, onSystemEdit, onSystemCommit, externalError }: SpecificationPlotProps) {
  const plotRef = useRef<SVGSVGElement>(null);
  const activeDrag = useRef<{ readonly field: SpecField; readonly pointerId?: number; readonly element?: HTMLElement; committed: boolean }>();
  const [dragging, setDragging] = useState<SpecField>();
  const [inlineReason, setInlineReason] = useState<string>();
  const currentLsl = Number(systemValues?.lowerSpecLimit ?? model.lsl);
  const currentUsl = Number(systemValues?.upperSpecLimit ?? model.usl);
  const safeLsl = Number.isFinite(currentLsl) ? currentLsl : model.lsl;
  const safeUsl = Number.isFinite(currentUsl) ? currentUsl : model.usl;
  const baselineLower = model.baselineLower;
  const baselineUpper = model.baselineUpper;
  const scenarioLower = model.scenarioLower;
  const scenarioUpper = model.scenarioUpper;
  const domainValues = [model.lsl, model.usl, baselineLower, baselineUpper, scenarioLower, scenarioUpper, model.worstCaseLower, model.worstCaseUpper].filter((value): value is number => Number.isFinite(value));
  const domainMinimum = Math.min(...domainValues);
  const domainMaximum = expandMaximum(domainMinimum, Math.max(...domainValues));
  const ticks = axisTicks(domainMinimum, domainMaximum);
  const alert = inlineReason ?? externalError;
  const position = (value: number) => PLOT_LEFT + clampToRange(xPosition(value, domainMinimum, domainMaximum, PLOT_WIDTH), 0, PLOT_WIDTH);
  const sliderPercent = (value: number) => clampToRange(xPosition(value, domainMinimum, domainMaximum, 100), 0, 100);
  const range = (lower: number, upper: number, y: number, className: string) => <line className={className} x1={position(lower)} x2={position(upper)} y1={y} y2={y} />;
  const lslPosition = position(safeLsl);
  const uslPosition = position(safeUsl);
  const labelLayout = limitLabelLayout(lslPosition, uslPosition);

  const previewClamped = (field: SpecField, clamped: SpecificationDraftClampResult) => {
    setInlineReason(clamped.reason);
    onSystemEdit?.(field, String(field === "lowerSpecLimit" ? clamped.lowerSpecLimit : clamped.upperSpecLimit));
  };

  const previewField = (field: SpecField, value: number) => {
    previewClamped(field, clampSpecDraft({ lowerSpecLimit: field === "lowerSpecLimit" ? value : safeLsl, upperSpecLimit: field === "upperSpecLimit" ? value : safeUsl, activeField: field }));
  };

  const updateFromPointer = (field: SpecField, clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    const track = plotTrack(rect);
    const value = specValueFromPointer({ pointerX: clientX, trackLeft: track.left, trackWidth: track.width, domainStart: domainMinimum, domainEnd: domainMaximum });
    previewField(field, value);
  };

  const commitField = (field: SpecField) => {
    const clamped = clampSpecDraft({ lowerSpecLimit: safeLsl, upperSpecLimit: safeUsl, activeField: field });
    setInlineReason(clamped.reason);
    if (clamped.reason !== undefined) onSystemEdit?.(field, String(field === "lowerSpecLimit" ? clamped.lowerSpecLimit : clamped.upperSpecLimit));
    onSystemCommit?.(field);
  };

  const finishDrag = (event?: Pick<PointerEvent, "pointerId">) => {
    const drag = activeDrag.current;
    if (drag === undefined || drag.committed) return;
    if (event?.pointerId !== undefined && drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
    drag.committed = true;
    if (drag.pointerId !== undefined) drag.element?.releasePointerCapture?.(drag.pointerId);
    commitField(drag.field);
    activeDrag.current = undefined;
    setDragging(undefined);
  };

  useEffect(() => {
    if (dragging === undefined) return undefined;
    const handleMouseMove = (event: MouseEvent) => updateFromPointer(dragging, event.clientX);
    const handleMouseUp = () => finishDrag();
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, domainMinimum, domainMaximum, safeLsl, safeUsl]);

  return (
    <div className="spec-plot">
      <div className="spec-inputs">
        <label>LSL<input aria-label="Lower Spec Limit" aria-describedby={inputGuidanceId("lower_spec_limit")} data-user-input-id="lower_spec_limit" type="number" step="0.001" value={systemValues?.lowerSpecLimit ?? formatValue(model.lsl)} onChange={(event) => { setInlineReason(undefined); onSystemEdit?.("lowerSpecLimit", event.target.value); }} onBlur={() => commitField("lowerSpecLimit")} onKeyDown={(event) => handleInputKeyDown(event, "lowerSpecLimit", commitField)} /></label>
        <label>USL<input aria-label="Upper Spec Limit" aria-describedby={inputGuidanceId("upper_spec_limit")} data-user-input-id="upper_spec_limit" type="number" step="0.001" value={systemValues?.upperSpecLimit ?? formatValue(model.usl)} onChange={(event) => { setInlineReason(undefined); onSystemEdit?.("upperSpecLimit", event.target.value); }} onBlur={() => commitField("upperSpecLimit")} onKeyDown={(event) => handleInputKeyDown(event, "upperSpecLimit", commitField)} /></label>
      </div>
      <div className="input-guidance-group"><InputGuidance inputId="lower_spec_limit" /><InputGuidance inputId="upper_spec_limit" /></div>
      {alert === undefined ? null : <p className="spec-plot__reason" role="alert">{alert}</p>}
      <div className="spec-plot__stage">
        <svg ref={plotRef} data-testid="specification-plot" role="img" aria-label="Baseline and scenario specification distribution" viewBox="0 0 600 210">
          <line className="spec-axis" x1={PLOT_LEFT} x2={PLOT_LEFT + PLOT_WIDTH} y1="156" y2="156" />
          {ticks.map((tick) => <g key={tick} className="spec-axis-tick"><line x1={position(tick)} x2={position(tick)} y1="150" y2="162" /><text x={position(tick)} y="182" textAnchor="middle">{formatValue(tick)}</text></g>)}
          <line className="spec-limit" x1={lslPosition} x2={lslPosition} y1="22" y2="158" />
          <line className="spec-limit" x1={uslPosition} x2={uslPosition} y1="22" y2="158" />
          {range(baselineLower, baselineUpper, 58, "baseline-range")}
          {scenarioLower === undefined || scenarioUpper === undefined ? null : range(scenarioLower, scenarioUpper, 88, "scenario-range")}
          {model.worstCaseLower === undefined || model.worstCaseUpper === undefined ? null : range(model.worstCaseLower, model.worstCaseUpper, 118, "scenario-worst-range")}
          <circle className="baseline-mean-marker" cx={position(model.baselineMean)} cy="58" r="5" />
          {model.scenarioMean === undefined ? null : <circle className="scenario-mean-marker" cx={position(model.scenarioMean)} cy="88" r="5" />}
          <text className="spec-limit-label" x={lslPosition + labelLayout.lslOffset} y={labelLayout.lslY} textAnchor={labelLayout.lslAnchor}>LSL {formatValue(safeLsl)}</text>
          <text className="spec-limit-label" x={uslPosition + labelLayout.uslOffset} y={labelLayout.uslY} textAnchor={labelLayout.uslAnchor}>USL {formatValue(safeUsl)}</text>
        </svg>
        <button type="button" role="slider" aria-label="Lower Spec Limit line" aria-describedby={inputGuidanceId("lower_spec_limit")} data-user-input-id="lower_spec_limit" aria-valuemin={domainMinimum} aria-valuemax={domainMaximum} aria-valuenow={safeLsl} className="spec-slider spec-slider--lsl" style={{ left: `${sliderPercent(safeLsl)}%` }} onPointerDown={(event) => beginPointerDrag(event, "lowerSpecLimit")} onPointerMove={(event) => handlePointerDrag(event)} onPointerUp={finishDrag} onPointerCancel={finishDrag} onMouseDown={() => beginMouseDrag("lowerSpecLimit")} onKeyDown={(event) => handleSliderKeyDown(event, { lowerSpecLimit: safeLsl, upperSpecLimit: safeUsl, activeField: "lowerSpecLimit" }, previewClamped, commitField)} />
        <button type="button" role="slider" aria-label="Upper Spec Limit line" aria-describedby={inputGuidanceId("upper_spec_limit")} data-user-input-id="upper_spec_limit" aria-valuemin={domainMinimum} aria-valuemax={domainMaximum} aria-valuenow={safeUsl} className="spec-slider spec-slider--usl" style={{ left: `${sliderPercent(safeUsl)}%` }} onPointerDown={(event) => beginPointerDrag(event, "upperSpecLimit")} onPointerMove={(event) => handlePointerDrag(event)} onPointerUp={finishDrag} onPointerCancel={finishDrag} onMouseDown={() => beginMouseDrag("upperSpecLimit")} onKeyDown={(event) => handleSliderKeyDown(event, { lowerSpecLimit: safeLsl, upperSpecLimit: safeUsl, activeField: "upperSpecLimit" }, previewClamped, commitField)} />
      </div>
      <div className="spec-plot__summary" aria-label="Specification plot summary">
        <span>Baseline mean {formatValue(model.baselineMean)} · statistical range {formatValue(model.baselineLower)} to {formatValue(model.baselineUpper)}</span>
        {model.scenarioMean === undefined || model.scenarioLower === undefined || model.scenarioUpper === undefined ? null : <span>Scenario mean {formatValue(model.scenarioMean)} · statistical range {formatValue(model.scenarioLower)} to {formatValue(model.scenarioUpper)}</span>}
        {model.worstCaseLower === undefined || model.worstCaseUpper === undefined ? null : <span>Worst-case range {formatValue(model.worstCaseLower)} to {formatValue(model.worstCaseUpper)}</span>}
      </div>
      <div className="spec-plot__legend" aria-label="Specification plot legend">
        <span><i className="spec-legend-swatch spec-legend-swatch--baseline" />Baseline mean</span>
        <span><i className="spec-legend-swatch spec-legend-swatch--scenario" />Scenario mean</span>
        <span><i className="spec-legend-line spec-legend-line--baseline" />Baseline statistical range</span>
        <span><i className="spec-legend-line spec-legend-line--scenario" />Scenario statistical range</span>
        <span><i className="spec-legend-line spec-legend-line--worst" />Worst-case range</span>
      </div>
    </div>
  );

  function beginPointerDrag(event: ReactPointerEvent<HTMLButtonElement>, field: SpecField) {
    event.preventDefault();
    activeDrag.current = { field, pointerId: event.pointerId, element: event.currentTarget, committed: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(field);
  }

  function handlePointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = activeDrag.current;
    if (drag === undefined || drag.pointerId !== event.pointerId || drag.committed) return;
    updateFromPointer(drag.field, event.clientX);
  }

  function beginMouseDrag(field: SpecField) {
    if (activeDrag.current !== undefined) return;
    activeDrag.current = { field, committed: false };
    setDragging(field);
  }
}

function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>, field: SpecField, commit: (field: SpecField) => void) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  commit(field);
}

function handleSliderKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  input: { readonly lowerSpecLimit: number; readonly upperSpecLimit: number; readonly activeField: SpecField },
  preview: (field: SpecField, clamped: SpecificationDraftClampResult) => void,
  commit: (field: SpecField) => void,
) {
  if (event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
    preview(input.activeField, stepSpecValue({ ...input, direction }));
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    commit(input.activeField);
  }
}

function axisTicks(minimum: number, maximum: number): readonly number[] {
  const span = Math.max(maximum - minimum, MIN_DOMAIN_SPAN);
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => Number((minimum + span * ratio).toFixed(3)));
}

function expandMaximum(minimum: number, maximum: number): number {
  if (maximum - minimum >= MIN_DOMAIN_SPAN) return maximum;
  return minimum + MIN_DOMAIN_SPAN;
}

function clampToRange(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function plotTrack(rect: DOMRect) {
  return {
    left: rect.left + rect.width * (PLOT_LEFT / SVG_WIDTH),
    width: rect.width * (PLOT_WIDTH / SVG_WIDTH),
  };
}

function limitLabelLayout(lslPosition: number, uslPosition: number) {
  if (Math.abs(uslPosition - lslPosition) >= 72) {
    return {
      lslY: 16,
      uslY: 16,
      lslOffset: 0,
      uslOffset: 0,
      lslAnchor: "middle" as const,
      uslAnchor: "middle" as const,
    };
  }
  return {
    lslY: 16,
    uslY: 30,
    lslOffset: -8,
    uslOffset: 8,
    lslAnchor: "end" as const,
    uslAnchor: "start" as const,
  };
}

function formatValue(value: number): string {
  return value.toFixed(3);
}
