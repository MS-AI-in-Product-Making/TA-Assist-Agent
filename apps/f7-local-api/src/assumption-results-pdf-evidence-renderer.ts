import type { AssumptionResultsPdfRouteRequest } from "./assumption-results-pdf-contract.js";

export type AssumptionResultsPdfEvidenceRequest = AssumptionResultsPdfRouteRequest["engineeringEvidence"];

type ChainFactor = {
  readonly id: string;
  readonly itemNumber: number;
  readonly name: string;
  readonly designNominal: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function sanitizeText(value: string): string {
  return value.replace(/https?:\/\/\S+/gi, "[link removed]");
}

function safeText(value: string): string {
  return escapeHtml(sanitizeText(value));
}

function finite(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(3))) : "—";
}

function signedFinite(value: number): string {
  const rendered = finite(value);
  if (rendered === "—") return rendered;
  if (rendered.startsWith("-")) return rendered;
  return `+${rendered}`;
}

function chainNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function renderFactorSetupRows(rows: AssumptionResultsPdfEvidenceRequest["factorSetup"]["rows"]): string {
  return rows.map((row) => `<tr>
            <td>${row.itemNumber}</td>
            <th scope="row">${safeText(row.factorName)}</th>
            <td>${finite(row.designNominal)}</td>
            <td>${finite(row.upperTolerance)}</td>
            <td>${finite(row.lowerTolerance)}</td>
            <td>${finite(row.longTermSafetyFactor)}</td>
            <td>${finite(row.sigmaLevel)}</td>
            <td>${safeText(row.distribution)}</td>
            <td>${finite(row.mean)}</td>
            <td>${finite(row.tolerance)}</td>
            <td>${finite(row.oneSigma)}</td>
            <td>${finite(row.contributionPercent)}%</td>
          </tr>`).join("");
}

function chainFactors(input: AssumptionResultsPdfEvidenceRequest): readonly ChainFactor[] {
  if (input.dimensionChain.status === "generated") {
    return input.dimensionChain.factors.map((factor) => ({
      id: factor.id,
      itemNumber: factor.itemNumber,
      name: factor.name,
      designNominal: factor.designNominal,
      upperTolerance: factor.upperTolerance,
      lowerTolerance: factor.lowerTolerance,
    }));
  }
  return input.factorSetup.rows.map((row) => ({
    id: `fallback-${row.itemNumber}`,
    itemNumber: row.itemNumber,
    name: row.factorName,
    designNominal: row.designNominal,
    upperTolerance: row.upperTolerance,
    lowerTolerance: row.lowerTolerance,
  }));
}

function formatPoint(value: { x: number; y: number }): string {
  return `${value.x.toFixed(3)},${value.y.toFixed(3)}`;
}

function chainSourceSummary(sourceSignature: string): string {
  try {
    const source = JSON.parse(sourceSignature) as { workbookName?: unknown; worksheetName?: unknown };
    const workbookName = typeof source.workbookName === "string" ? safeText(source.workbookName) : "unknown workbook";
    const worksheetName = typeof source.worksheetName === "string" ? safeText(source.worksheetName) : "unknown worksheet";
    return `${workbookName} / ${worksheetName}`;
  } catch {
    return "validated factor setup";
  }
}

function renderDimensionChain(input: AssumptionResultsPdfEvidenceRequest): string {
  const chain = input.dimensionChain;
  const isFallback = chain.status === "fallback";
  const orientation = chain.status === "generated" ? chain.orientation : "horizontal";
  const closure = chain.status === "generated" ? chain.closureDirection : "start-to-end";
  const factors = chainFactors(input);
  const reversed = chain.status === "generated" ? new Set(chain.reversedFactorIds) : new Set<string>();
  const boundaryOffsets = chain.status === "generated" ? chain.manualLayout.boundaryOffsets : {};
  const laneOffsets = chain.status === "generated" ? chain.manualLayout.laneOffsets : {};
  const axisStart = orientation === "vertical" ? 24 : 56;
  const axisEnd = orientation === "vertical" ? 144 : 564;
  const axisRange = axisEnd - axisStart;
  const segmentCount = factors.length;
  const minVisualLength = segmentCount > 0
    ? Math.max(8, Math.min(orientation === "vertical" ? 18 : 26, axisRange / (segmentCount * 1.35)))
    : 0;
  const magnitudes = factors.map((factor) => Math.abs(chainNumber(factor.designNominal)));
  const weightTotal = magnitudes.reduce((sum, current) => sum + current, 0);
  const baseTotal = segmentCount * minVisualLength;
  const distributable = Math.max(0, axisRange - baseTotal);
  const scaledLengths = factors.map((_factor, index) => {
    if (segmentCount === 0) return 0;
    if (weightTotal <= 1e-9) return minVisualLength + distributable / segmentCount;
    return minVisualLength + distributable * (magnitudes[index] ?? 0) / weightTotal;
  });

  const cumulativePositions = [0];
  for (let index = 0; index < factors.length; index += 1) {
    const factor = factors[index];
    if (!factor) continue;
    const direction = chainNumber(factor.designNominal) < 0 ? -1 : 1;
    const delta = direction * (scaledLengths[index] ?? minVisualLength);
    cumulativePositions.push((cumulativePositions[index] ?? 0) + delta);
  }

  const minimumPosition = Math.min(...cumulativePositions);
  const maximumPosition = Math.max(...cumulativePositions);
  const positionSpan = Math.max(1e-9, maximumPosition - minimumPosition);
  const mapPosition = (position: number): number => axisStart
    + ((position - minimumPosition) / positionSpan) * axisRange;
  const vertices = cumulativePositions.map((position) => orientation === "vertical"
    ? { x: 310, y: mapPosition(position) }
    : { x: mapPosition(position), y: 92 });

  for (let index = 1; index < factors.length; index += 1) {
    const previousFactor = factors[index - 1];
    const factor = factors[index];
    const vertex = vertices[index];
    if (!previousFactor || !factor || !vertex) continue;
    const boundaryKey = `${previousFactor.id}::${factor.id}`;
    const boundaryOffset = chainNumber(boundaryOffsets[boundaryKey]);
    if (orientation === "vertical") vertex.x = Math.min(596, Math.max(24, vertex.x + boundaryOffset));
    else vertex.y = Math.min(144, Math.max(24, vertex.y + boundaryOffset));
  }

  const originVertex = vertices[0] ?? (orientation === "vertical" ? { x: 310, y: 84 } : { x: 310, y: 92 });
  const finalVertex = vertices[vertices.length - 1] ?? originVertex;

  const factorSegments = factors.map((factor, index) => {
    const physicalStart = vertices[index];
    const physicalEnd = vertices[index + 1];
    if (!physicalStart || !physicalEnd) return "";
    const isReversedVisual = reversed.has(factor.id);
    const visualStart = isReversedVisual ? physicalEnd : physicalStart;
    const visualEnd = isReversedVisual ? physicalStart : physicalEnd;
    const laneOffset = chainNumber(laneOffsets[factor.id]);
    const midpointX = (physicalStart.x + physicalEnd.x) / 2;
    const midpointY = (physicalStart.y + physicalEnd.y) / 2;
    const evenlySpacedAxisPosition = axisStart + ((index + 0.5) / Math.max(1, factors.length)) * axisRange;
    const automaticLaneOffset = (index % 4) * 18 - 27;
    const labelX = clamp(
      orientation === "vertical" ? midpointX + 9 + automaticLaneOffset + laneOffset : evenlySpacedAxisPosition,
      24,
      596,
    );
    const labelY = clamp(
      orientation === "vertical" ? evenlySpacedAxisPosition : midpointY - 16 + automaticLaneOffset + laneOffset,
      16,
      133,
    );
    const isPositive = chainNumber(factor.designNominal) >= 0;
    const strokeColor = isPositive ? "#176b3a" : "#a3342d";
    const markerId = isPositive ? "chain-arrow-green" : "chain-arrow-red";
    const segmentId = factor.id.startsWith("fallback-") ? factor.id : factor.id.slice(0, 8);
    return `<g>
      <line data-chain-segment="${index}" data-factor-segment="${safeText(segmentId)}" data-segment-index="${index + 1}" data-physical-start="${formatPoint(physicalStart)}" data-physical-end="${formatPoint(physicalEnd)}" x1="${visualStart.x.toFixed(3)}" y1="${visualStart.y.toFixed(3)}" x2="${visualEnd.x.toFixed(3)}" y2="${visualEnd.y.toFixed(3)}" stroke="${strokeColor}" stroke-width="2" marker-end="url(#${markerId})"/>
      <text data-chain-label="${index}" x="${labelX.toFixed(3)}" y="${labelY.toFixed(3)}" text-anchor="middle">
        <tspan x="${labelX.toFixed(3)}" dy="0">Item ${factor.itemNumber} ${safeText(factor.name)}</tspan>
        <tspan x="${labelX.toFixed(3)}" dy="11">DN ${signedFinite(factor.designNominal)} Tol ${signedFinite(factor.upperTolerance)} / ${finite(factor.lowerTolerance)}</tspan>
      </text>
    </g>`;
  }).join("");

  const closureStartOffset = chainNumber(chain.status === "generated" ? chain.manualLayout.closureStartOffset : 0);
  const closureEndOffset = chainNumber(chain.status === "generated" ? chain.manualLayout.closureEndOffset : 0);
  const closureLaneOffset = chainNumber(chain.status === "generated" ? chain.manualLayout.closureLaneOffset : 0);
  const closureLane = orientation === "vertical"
    ? clamp(550 + closureLaneOffset, 24, 596)
    : clamp(132 + closureLaneOffset, 24, 144);
  const closureStartGuide = orientation === "vertical"
    ? { x: closureLane, y: clamp(finalVertex.y + closureStartOffset, 24, 144) }
    : { x: clamp(finalVertex.x + closureStartOffset, 24, 596), y: closureLane };
  const closureEndGuide = orientation === "vertical"
    ? { x: closureLane, y: clamp(originVertex.y + closureEndOffset, 24, 144) }
    : { x: clamp(originVertex.x + closureEndOffset, 24, 596), y: closureLane };
  const physicalClosurePoints = [finalVertex, closureStartGuide, closureEndGuide, originVertex];
  const closureDisplayPoints = closure === "end-to-start"
    ? physicalClosurePoints
    : [...physicalClosurePoints].reverse();
  const closureLabelX = clamp((closureStartGuide.x + closureEndGuide.x) / 2, 24, 596);
  const closureLabelY = clamp((closureStartGuide.y + closureEndGuide.y) / 2 - 4, 24, 144);

  return `<section class="evidence-panel evidence-panel--chain">
    <h3>Dimension Chain</h3>
    <p class="dimension-note">${isFallback ? "fallback to standard horizontal chain from factorSetup rows" : "generated chain preserved for report"}; orientation: ${safeText(orientation)}; ${chain.status === "generated" ? "manual layout" : "automatic layout"}; ${reversed.size > 0 ? "reversed factor segments" : "forward factor segments"}; closure: ${safeText(closure)}.</p>
    <svg data-dimension-chain viewBox="0 0 620 184" role="img" aria-label="Dimension Chain">
      <defs>
        <marker id="chain-arrow-green" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L7,3.5 L0,7 z" fill="#176b3a"/>
        </marker>
        <marker id="chain-arrow-red" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L7,3.5 L0,7 z" fill="#a3342d"/>
        </marker>
      </defs>
      <rect x="0" y="0" width="620" height="184" rx="10" fill="#f6fbfb" stroke="#b8c4c8"/>
      <circle data-chain-origin cx="${originVertex.x.toFixed(3)}" cy="${originVertex.y.toFixed(3)}" r="4" fill="#176b3a"/>
      ${factorSegments}
      <polyline data-chain-closure points="${closureDisplayPoints.map(formatPoint).join(" ")}" data-physical-start="${formatPoint(finalVertex)}" data-physical-end="${formatPoint(originVertex)}" data-start-offset="${closureStartOffset}" data-end-offset="${closureEndOffset}" data-lane-offset="${closureLaneOffset}" fill="none" stroke="#176b3a" stroke-width="1.8" marker-end="url(#chain-arrow-green)"/>
      <text data-chain-closure-label x="${closureLabelX.toFixed(3)}" y="${closureLabelY.toFixed(3)}">Closure</text>
      <text x="24" y="156">${safeText(isFallback ? "Fallback from factorSetup rows" : "Generated from validated factor setup")}</text>
      <text x="24" y="170">Source: ${chainSourceSummary(chain.sourceSignature)}</text>
    </svg>
  </section>`;
}

function renderNormalCurve(curve: AssumptionResultsPdfEvidenceRequest["responseDistribution"]): string {
  const sigma = Math.max(1e-9, Math.abs(curve.standardDeviation));
  const lowerSigma = curve.mean - 3 * sigma;
  const upperSigma = curve.mean + 3 * sigma;
  const domainMin = Math.min(curve.lowerSpecLimit, curve.upperSpecLimit, curve.target, curve.mean, lowerSigma);
  const domainMax = Math.max(curve.lowerSpecLimit, curve.upperSpecLimit, curve.target, curve.mean, upperSigma);
  const safeSpan = Math.max(1e-9, domainMax - domainMin);
  const xMin = 24;
  const xMax = 500;
  const scaleX = (value: number): number => xMin + ((value - domainMin) / safeSpan) * (xMax - xMin);

  const points: string[] = [];
  for (let index = 0; index <= 64; index += 1) {
    const domainX = domainMin + (index / 64) * safeSpan;
    const normalized = (domainX - curve.mean) / sigma;
    const y = Math.exp(-0.5 * normalized ** 2);
    const chartX = Number(scaleX(domainX).toFixed(3));
    const chartY = Number((140 - y * 94).toFixed(3));
    if (Number.isFinite(chartX) && Number.isFinite(chartY)) points.push(`${chartX},${chartY}`);
  }

  const lslX = scaleX(curve.lowerSpecLimit);
  const uslX = scaleX(curve.upperSpecLimit);
  const targetX = scaleX(curve.target);
  const meanX = scaleX(curve.mean);
  const sigmaLeftX = scaleX(lowerSigma);
  const sigmaRightX = scaleX(upperSigma);

  return `<section class="evidence-panel evidence-panel--curve">
    <h3>Normal Distribution Curve</h3>
    <p class="curve-note">Mean ${finite(curve.mean)}; LSL ${finite(curve.lowerSpecLimit)}; USL ${finite(curve.upperSpecLimit)}; Target ${finite(curve.target)}; ±3σ ${finite(3 * sigma)}.</p>
    <svg data-normal-curve viewBox="0 0 520 180" role="img" aria-label="Normal Distribution Curve">
      <rect x="0" y="0" width="520" height="180" rx="10" fill="#fffdf8" stroke="#b8c4c8"/>
      <line x1="24" y1="140" x2="500" y2="140" stroke="#6a7b83"/>
      <polyline data-normal-curve-line points="${points.join(" ")}" fill="none" stroke="#2a8992" stroke-width="2.5"/>
      <line data-curve-lsl x1="${lslX.toFixed(3)}" y1="30" x2="${lslX.toFixed(3)}" y2="140" stroke="#a3342d" stroke-dasharray="4 4"/>
      <line data-curve-usl x1="${uslX.toFixed(3)}" y1="30" x2="${uslX.toFixed(3)}" y2="140" stroke="#a3342d" stroke-dasharray="4 4"/>
      <line data-curve-target x1="${targetX.toFixed(3)}" y1="20" x2="${targetX.toFixed(3)}" y2="140" stroke="#176b75" stroke-dasharray="4 4"/>
      <line data-curve-mean x1="${meanX.toFixed(3)}" y1="20" x2="${meanX.toFixed(3)}" y2="140" stroke="#176b75"/>
      <line data-curve-sigma-left x1="${sigmaLeftX.toFixed(3)}" y1="105" x2="${sigmaLeftX.toFixed(3)}" y2="140" stroke="#6a7b83"/>
      <line data-curve-sigma-right x1="${sigmaRightX.toFixed(3)}" y1="105" x2="${sigmaRightX.toFixed(3)}" y2="140" stroke="#6a7b83"/>
      <text x="${lslX.toFixed(3)}" y="24">LSL</text>
      <text x="${uslX.toFixed(3)}" y="24">USL</text>
      <text x="${targetX.toFixed(3)}" y="16">Target</text>
      <text x="24" y="168">Mean ${finite(curve.mean)}</text>
      <text x="392" y="168">±3σ</text>
    </svg>
  </section>`;
}

function summaryStatusClass(status: "PASS" | "FAIL"): string {
  return status === "PASS" ? "summary-value--pass" : "summary-value--fail";
}

function renderResponseSummary(summary: AssumptionResultsPdfEvidenceRequest["responseSummary"]): string {
  return `<section class="evidence-panel evidence-panel--summary">
    <h3>Response Summary</h3>
    <div class="response-summary-grid">
    <table class="response-summary-table"><caption>RSS and Worst Case</caption><tbody>
      ${summary.rssAndWorstCase.sigmaBands.map((band) => `<tr><th scope="row">${band.sigma}σ</th><td>${finite(band.tolerance)}</td><td>${finite(band.upper)}</td><td>${finite(band.lower)}</td></tr>`).join("")}
      <tr><th scope="row">Worst Case</th><td>${finite(summary.rssAndWorstCase.worstCase.tolerance)}</td><td>${finite(summary.rssAndWorstCase.worstCase.upper)}</td><td>${finite(summary.rssAndWorstCase.worstCase.lower)}</td></tr>
    </tbody></table>
    <table class="response-summary-table"><caption>Response and Specifications</caption><tbody>
      <tr><th scope="row">Design Nominal</th><td>${finite(summary.responseAndSpecifications.designNominal)}</td></tr>
      <tr><th scope="row">Mean Response</th><td>${finite(summary.responseAndSpecifications.meanResponse)}</td></tr>
      <tr><th scope="row">Additional Mean Shift</th><td>${finite(summary.responseAndSpecifications.additionalMeanShift)}</td></tr>
      <tr><th scope="row">Adjusted Mean</th><td>${finite(summary.responseAndSpecifications.adjustedMean)}</td></tr>
      <tr><th scope="row">LSL</th><td>${finite(summary.responseAndSpecifications.lowerSpecLimit)}</td></tr>
      <tr><th scope="row">USL</th><td>${finite(summary.responseAndSpecifications.upperSpecLimit)}</td></tr>
      <tr><th scope="row">Target Sigma Level</th><td>${finite(summary.responseAndSpecifications.targetSigmaLevel)}</td></tr>
      <tr><th scope="row">Target Cpk</th><td>${finite(summary.responseAndSpecifications.targetCpk)}</td></tr>
    </tbody></table>
    <table class="response-summary-table"><caption>Sigma Level and Capability</caption><tbody>
      <tr><th scope="row">Lower Z</th><td>${finite(summary.sigmaLevelAndCapability.lowerZ.value)}</td><td class="${summaryStatusClass(summary.sigmaLevelAndCapability.lowerZ.status)}">${summary.sigmaLevelAndCapability.lowerZ.status}</td></tr>
      <tr><th scope="row">Upper Z</th><td>${finite(summary.sigmaLevelAndCapability.upperZ.value)}</td><td class="${summaryStatusClass(summary.sigmaLevelAndCapability.upperZ.status)}">${summary.sigmaLevelAndCapability.upperZ.status}</td></tr>
      <tr><th scope="row">Calculated Sigma Level</th><td>${finite(summary.sigmaLevelAndCapability.calculatedSigmaLevel.value)}</td><td class="${summaryStatusClass(summary.sigmaLevelAndCapability.calculatedSigmaLevel.status)}">${summary.sigmaLevelAndCapability.calculatedSigmaLevel.status}</td></tr>
      <tr><th scope="row">Cp</th><td>${finite(summary.sigmaLevelAndCapability.cp.value)}</td><td class="${summaryStatusClass(summary.sigmaLevelAndCapability.cp.status)}">${summary.sigmaLevelAndCapability.cp.status}</td></tr>
      <tr><th scope="row">Lower Cpk</th><td>${finite(summary.sigmaLevelAndCapability.lowerCpk.value)}</td><td class="${summaryStatusClass(summary.sigmaLevelAndCapability.lowerCpk.status)}">${summary.sigmaLevelAndCapability.lowerCpk.status}</td></tr>
      <tr><th scope="row">Upper Cpk</th><td>${finite(summary.sigmaLevelAndCapability.upperCpk.value)}</td><td class="${summaryStatusClass(summary.sigmaLevelAndCapability.upperCpk.status)}">${summary.sigmaLevelAndCapability.upperCpk.status}</td></tr>
      <tr><th scope="row">Calculated Cpk</th><td>${finite(summary.sigmaLevelAndCapability.calculatedCpk.value)}</td><td class="${summaryStatusClass(summary.sigmaLevelAndCapability.calculatedCpk.status)}">${summary.sigmaLevelAndCapability.calculatedCpk.status}</td></tr>
    </tbody></table>
    <table class="response-summary-table"><caption>Defects Per Million</caption><tbody>
      <tr><th scope="row">Lower DPM</th><td>${finite(summary.defectsPerMillion.lowerDpm)}</td></tr>
      <tr><th scope="row">Upper DPM</th><td>${finite(summary.defectsPerMillion.upperDpm)}</td></tr>
      <tr><th scope="row">Total DPM</th><td>${finite(summary.defectsPerMillion.totalDpm)}</td></tr>
      <tr><th scope="row">Out of Spec %</th><td>${finite(summary.defectsPerMillion.outOfSpecPercent)}</td></tr>
      <tr><th scope="row">Yield %</th><td>${finite(summary.defectsPerMillion.yieldPercent)}</td></tr>
      ${summary.defectsPerMillion.volume === undefined ? "" : `<tr><th scope="row">Volume</th><td>${summary.defectsPerMillion.volume}</td></tr>`}
      ${summary.defectsPerMillion.failuresOverVolume === undefined ? "" : `<tr><th scope="row">Failures / Volume</th><td>${finite(summary.defectsPerMillion.failuresOverVolume)}</td></tr>`}
    </tbody></table>
    </div>
  </section>`;
}

export function renderAssumptionResultsPdfEvidenceHtml(input: AssumptionResultsPdfEvidenceRequest): string {
  const requiresFlowLayout = input.factorSetup.rows.length > 7
    || input.responseSummary.rssAndWorstCase.sigmaBands.length > 2;
  return `
    <div class="report-page report-page--evidence${requiresFlowLayout ? " report-page--evidence-flow" : ""}">
      <div class="evidence-top">
        <header>
          <h1>Engineering Evidence</h1>
          <p>Layout B</p>
        </header>
        <section class="factor-setup-panel">
          <h2>Factor Setup</h2>
          <table>
            <thead><tr><th>#</th><th>Factor</th><th>Design Nominal</th><th>Upper Tol.</th><th>Lower Tol.</th><th>LT Safety</th><th>Sigma Level</th><th>Distribution</th><th>Mean</th><th>Combined Tol.</th><th>1 Sigma</th><th>Contribution</th></tr></thead>
            <tbody>${renderFactorSetupRows(input.factorSetup.rows)}</tbody>
            <tfoot>
              <tr data-footer-core-total>
                <th colspan="3" data-footer-field="design-nominal-total">Design Nominal Total: ${finite(input.factorSetup.footer.designNominalTotal)}</th>
                <th colspan="3" data-footer-field="upper-worst-case-tolerance">Upper Worst Case Tol.: ${finite(input.factorSetup.footer.upperWorstCaseTolerance)}</th>
                <th colspan="3" data-footer-field="lower-worst-case-tolerance">Lower Worst Case Tol.: ${finite(input.factorSetup.footer.lowerWorstCaseTolerance)}</th>
                <th colspan="3" data-footer-field="contribution-total">Contribution Total: ${finite(input.factorSetup.footer.contributionTotalPercent)}%</th>
              </tr>
              <tr data-footer-derived-total>
                <th colspan="2" data-footer-field="mean-response">Mean Response: ${finite(input.factorSetup.footer.meanResponse)}</th>
                <th colspan="2" data-footer-field="rss-tolerance">RSS Tol.: ${finite(input.factorSetup.footer.rssTolerance)}</th>
                <th colspan="2" data-footer-field="rss-sigma">RSS Sigma: ${finite(input.factorSetup.footer.rssSigma)}</th>
                <th colspan="3" data-footer-field="additional-mean-shift">Additional Mean Shift: ${finite(input.factorSetup.footer.additionalMeanShift)}</th>
                <th colspan="3" data-footer-field="adjusted-mean">Adjusted Mean: ${finite(input.factorSetup.footer.adjustedMean)}</th>
              </tr>
            </tfoot>
          </table>
        </section>
      </div>
      <div class="evidence-lower-grid">
        ${renderDimensionChain(input)}
        ${renderNormalCurve(input.responseDistribution)}
        ${renderResponseSummary(input.responseSummary)}
      </div>
    </div>`;
}
