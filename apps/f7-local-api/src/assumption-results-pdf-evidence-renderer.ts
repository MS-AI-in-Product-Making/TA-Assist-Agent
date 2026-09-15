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

function renderDimensionChain(input: AssumptionResultsPdfEvidenceRequest): string {
  const chain = input.dimensionChain;
  const isFallback = chain.status === "fallback";
  const orientation = chain.status === "generated" ? chain.orientation : "horizontal";
  const closure = chain.status === "generated" ? chain.closureDirection : "start-to-end";
  const factors = chainFactors(input);
  const reversed = chain.status === "generated" ? new Set(chain.reversedFactorIds) : new Set<string>();
  const boundaryOffsets = chain.status === "generated" ? chain.manualLayout.boundaryOffsets : {};
  const laneOffsets = chain.status === "generated" ? chain.manualLayout.laneOffsets : {};
  const closureStartOffset = chain.status === "generated" ? chainNumber(chain.manualLayout.closureStartOffset) : 0;
  const closureEndOffset = chain.status === "generated" ? chainNumber(chain.manualLayout.closureEndOffset) : 0;
  const closureLaneOffset = chain.status === "generated" ? chainNumber(chain.manualLayout.closureLaneOffset) : 0;

  const x0 = orientation === "vertical" ? 132 : 56;
  const y0 = orientation === "vertical" ? 30 : 92;
  const x1 = orientation === "vertical" ? 132 : 564;
  const y1 = orientation === "vertical" ? 162 : 156;
  const span = Math.max(1, factors.length - 1);
  const maxNominalMagnitude = factors.reduce((maximum, factor) => {
    const magnitude = Math.abs(chainNumber(factor.designNominal));
    return Math.max(maximum, magnitude);
  }, 0);
  const normalizedMagnitude = (value: number): number => {
    const denominator = Math.max(1e-9, maxNominalMagnitude);
    return Math.min(1, Math.max(0, Math.abs(value) / denominator));
  };

  const points = factors.map((factor, index) => {
    let offset = chainNumber(laneOffsets[factor.id]);
    if (index > 0) {
      const previous = factors[index - 1];
      if (previous) offset += chainNumber(boundaryOffsets[`${previous.id}::${factor.id}`]);
    }
    if (orientation === "vertical") {
      return {
        x: x0 + offset,
        y: y0 + (index / span) * (y1 - y0),
      };
    }
    return {
      x: x0 + (index / span) * (x1 - x0),
      y: y0 + offset,
    };
  });

  const axisStart = orientation === "vertical"
    ? { x: x0, y: y0 - 22 + closureStartOffset }
    : { x: x0 - 20 + closureStartOffset, y: y0 };
  const axisEnd = orientation === "vertical"
    ? { x: x0, y: y1 + 22 + closureEndOffset }
    : { x: x1 + 20 + closureEndOffset, y: y0 };

  const closureStart = orientation === "vertical"
    ? { x: x0 + 58 + closureLaneOffset, y: y0 - 10 }
    : { x: x0 - 8, y: y0 + 54 + closureLaneOffset };
  const closureEnd = orientation === "vertical"
    ? { x: x0 + 58 + closureLaneOffset, y: y1 + 10 }
    : { x: x1 + 8, y: y0 + 54 + closureLaneOffset };

  const closureFrom = closure === "end-to-start" ? closureEnd : closureStart;
  const closureTo = closure === "end-to-start" ? closureStart : closureEnd;

  const segmentMinLength = orientation === "vertical" ? 24 : 36;
  const segmentMaxLength = orientation === "vertical" ? 60 : 112;

  const factorSegments = factors.map((factor, index) => {
    const anchor = points[index];
    if (!anchor) return "";
    const rawDirection = chainNumber(factor.designNominal) < 0 ? -1 : 1;
    const reverseDirection = reversed.has(factor.id) ? -1 : 1;
    const direction = rawDirection * reverseDirection;
    const scale = normalizedMagnitude(chainNumber(factor.designNominal));
    const length = segmentMinLength + (segmentMaxLength - segmentMinLength) * scale;
    const to = orientation === "vertical"
      ? { x: anchor.x, y: anchor.y + direction * length }
      : { x: anchor.x + direction * length, y: anchor.y };
    const labelX = orientation === "vertical" ? anchor.x + 8 : (anchor.x + to.x) / 2;
    const labelY = orientation === "vertical" ? (anchor.y + to.y) / 2 : anchor.y - 8;
    const segmentId = factor.id.startsWith("fallback-") ? factor.id : factor.id.slice(0, 8);
    return `<g>
      <line data-factor-segment="${safeText(segmentId)}" x1="${anchor.x.toFixed(2)}" y1="${anchor.y.toFixed(2)}" x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}" stroke="#2a8992" stroke-width="2" marker-end="url(#chain-arrow)"/>
        <text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}" text-anchor="middle">Item ${factor.itemNumber} ${safeText(factor.name)} DN ${signedFinite(factor.designNominal)} Tol ${signedFinite(factor.upperTolerance)} / ${finite(factor.lowerTolerance)}</text>
      </g>`;
  }).join("");

  return `<section class="evidence-panel">
    <h3>Dimension Chain</h3>
    <p class="dimension-note">${isFallback ? "fallback to standard horizontal chain from factorSetup rows" : "generated chain preserved for report"}; orientation: ${safeText(orientation)}; ${chain.status === "generated" ? "manual layout" : "automatic layout"}; ${reversed.size > 0 ? "reversed factor segments" : "forward factor segments"}; closure: ${safeText(closure)}.</p>
    <svg data-dimension-chain viewBox="0 0 620 184" role="img" aria-label="Dimension Chain">
      <defs>
        <marker id="chain-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L7,3.5 L0,7 z" fill="#176b75"/>
        </marker>
        <marker id="chain-arrow-red" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L7,3.5 L0,7 z" fill="#a3342d"/>
        </marker>
      </defs>
      <rect x="0" y="0" width="620" height="184" rx="10" fill="#f6fbfb" stroke="#b8c4c8"/>
      <line data-chain-axis x1="${axisStart.x.toFixed(2)}" y1="${axisStart.y.toFixed(2)}" x2="${axisEnd.x.toFixed(2)}" y2="${axisEnd.y.toFixed(2)}" stroke="#176b75" stroke-width="2" marker-end="url(#chain-arrow)"/>
      ${factors.map((factor, index) => {
    const point = points[index];
    if (!point) return "";
    const isVertical = orientation === "vertical";
    const width = isVertical ? 118 : 94;
    const height = isVertical ? 28 : 36;
    const x = point.x - width / 2;
    const y = point.y - height / 2;
    return `<g>
        <rect data-factor-id="${safeText(factor.id.slice(0, 8))}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width}" height="${height}" rx="7" fill="#ffffff" stroke="#6a7b83"/>
        <text x="${point.x.toFixed(2)}" y="${(point.y - 3).toFixed(2)}" text-anchor="middle">${safeText(factor.name)}</text>
        <text x="${point.x.toFixed(2)}" y="${(point.y + 10).toFixed(2)}" text-anchor="middle">${safeText(factor.id.slice(0, 8))}</text>
      </g>`;
  }).join("")}
      ${factorSegments}
      <line data-chain-closure x1="${closureFrom.x.toFixed(2)}" y1="${closureFrom.y.toFixed(2)}" x2="${closureTo.x.toFixed(2)}" y2="${closureTo.y.toFixed(2)}" stroke="#a3342d" stroke-width="1.8" stroke-dasharray="4 3" marker-end="url(#chain-arrow-red)"/>
      <text x="24" y="156">${safeText(isFallback ? "Fallback from factorSetup rows" : "Generated from validated factor setup")}</text>
      <text x="24" y="170">${safeText(chain.sourceSignature)}</text>
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

  return `<section class="evidence-panel">
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
  return `<section class="evidence-panel">
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
  return `
    <div class="report-page report-page--evidence">
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
            <tr><th colspan="2">Total Design Nominal</th><td colspan="10">${finite(input.factorSetup.footer.designNominalTotal)}</td></tr>
            <tr><th colspan="2">Upper Worst Case Tolerance</th><td colspan="10">${finite(input.factorSetup.footer.upperWorstCaseTolerance)}</td></tr>
            <tr><th colspan="2">Lower Worst Case Tolerance</th><td colspan="10">${finite(input.factorSetup.footer.lowerWorstCaseTolerance)}</td></tr>
            <tr><th colspan="2">Mean Response</th><td colspan="10">${finite(input.factorSetup.footer.meanResponse)}</td></tr>
            <tr><th colspan="2">RSS Tolerance</th><td colspan="10">${finite(input.factorSetup.footer.rssTolerance)}</td></tr>
            <tr><th colspan="2">RSS Sigma</th><td colspan="10">${finite(input.factorSetup.footer.rssSigma)}</td></tr>
            <tr><th colspan="2">Contribution Total Percent</th><td colspan="10">${finite(input.factorSetup.footer.contributionTotalPercent)}%</td></tr>
            <tr><th colspan="2">Additional Mean Shift</th><td colspan="10">${finite(input.factorSetup.footer.additionalMeanShift)}</td></tr>
            <tr><th colspan="2">Adjusted Mean</th><td colspan="10">${finite(input.factorSetup.footer.adjustedMean)}</td></tr>
          </tfoot>
        </table>
      </section>
      <div class="evidence-lower-grid">
        ${renderDimensionChain(input)}
        <div class="evidence-right-stack">
          ${renderNormalCurve(input.responseDistribution)}
          ${renderResponseSummary(input.responseSummary)}
        </div>
      </div>
    </div>`;
}
