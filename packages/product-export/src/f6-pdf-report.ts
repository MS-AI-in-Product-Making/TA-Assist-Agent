import { marked, Renderer, type Tokens } from "marked";

export interface F6PdfHtmlInput {
  readonly markdown: string;
  readonly sourceHash: string;
  readonly baseHref?: string;
  readonly inlineImages?: ReadonlyMap<string, string>;
}

const COMPLETE_FACTOR_TABLE_HEADERS = [
  "Factor Description",
  "Part Name",
  "Part Category",
  "Drawing Number",
  "DIM ID",
  "Design Nominal",
  "+ Tolerance",
  "- Tolerance",
  "Long Term / Safety Factor",
  "Sigma Level",
  "Mean",
  "Tolerance",
  "One Sigma",
  "Capability / Knowledge Guidance",
] as const;

const REQUIRED_MISSING_MARKER_OPEN = /^<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="(\d+)" hidden(?:="")? aria-hidden="true">$/u;
const REQUIRED_MISSING_MARKER_CLOSE = /^<\/span>$/u;
const F6_OPTIMIZATION_COMPARISON_MARKER = "<!-- f6-optimization-comparison -->";
const F6_OPTIMIZATION_CONTINUATION_MARKER = "<!-- f6-optimization-comparison continuation=\"1\" -->";

type SlideSection = "summary" | "worksheet" | "optimization" | "optimization-continuation";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function threeSignificantFigures(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0.00";
  const precise = value.toPrecision(3);
  if (!precise.includes("e")) return precise;
  const [coefficient, exponent] = precise.split("e");
  return `${coefficient} × 10^${Number(exponent)}`;
}

function formatReportText(value: string): string {
  return value
    .replace(/(-?\d+(?:\.\d+)?)\s*%/gu, (_match, rawValue: string) => `${threeSignificantFigures(Number(rawValue))}&nbsp;%`)
    .replace(/(-?\d+(?:\.\d+)?)\s+mm/gu, (_match, rawValue: string) => `${threeSignificantFigures(Number(rawValue))}&nbsp;mm`)
    .replace(/DPM\s+(-?\d+(?:\.\d+)?)/gu, (_match, rawValue: string) => `DPM ${threeSignificantFigures(Number(rawValue))}`)
    .replace(/Target Cpk\s+(-?\d+(?:\.\d+)?)/gu, (_match, rawValue: string) => `Target Cpk ${threeSignificantFigures(Number(rawValue))}`)
    .replace(/\b(CpkL|CpkU|Cpk|Cp)\s+(-?\d+(?:\.\d+)?)/gu, (_match, metric: string, rawValue: string) => `${metric} ${threeSignificantFigures(Number(rawValue))}`);
}

function formatReportHtml(value: string): string {
  const simplified = value
    .replaceAll("Capability / Knowledge Guidance", "Guidance")
    .replaceAll("Capability: f0_information_insufficient; Knowledge: missing_process_context", '<span class="guidance guidance--review">Insufficient evidence</span>')
    .replace(
      /Capability: internal_within_guidance; Recommended tolerance band or range: &lt;= (-?\d+(?:\.\d+)?) ([^;<]+);[^<]*/gu,
      (_match, rawLimit: string, unit: string) => `<span class="guidance guidance--pass">Within guidance &le; ${rawLimit} ${unit.trim()}</span>`,
    )
    .replaceAll("Capability: non_f0_process_category", '<span class="guidance guidance--neutral">Not covered</span>')
    .replaceAll("tighten_tolerance", "Tighten tolerance");
  const formatOutsideOptimizationSlides = (fragment: string): string => fragment
    .split(/(<[^>]*>)/gu)
    .map((part) => part.startsWith("<") ? part : formatReportText(part))
    .join("");
  const optimizationSectionPattern = /(<section class="optimization-section slide slide-optimization(?: slide-optimization-continuation)?">[\s\S]*?<\/section><\/div><\/section>)/gu;
  return simplified
    .split(optimizationSectionPattern)
    .map((part) => part.startsWith('<section class="optimization-section slide slide-optimization') ? part : formatOutsideOptimizationSlides(part))
    .join("");
}

function cellText(cell: Tokens.TableCell): string {
  return cell.text.replace(/<[^>]*>/g, "").trim();
}

function exactHeadersMatch(headers: readonly string[], expected: readonly string[]): boolean {
  return headers.length === expected.length && headers.every((header, index) => header === expected[index]);
}

function requiredMissingMarker(cell: Tokens.TableCell): { index: number; sourceRow: string } | undefined {
  const htmlIndexes = cell.tokens.flatMap((token, index) => token.type === "html" ? [index] : []);
  if (htmlIndexes.length !== 2) return undefined;
  const [openIndex, closeIndex] = htmlIndexes as [number, number];
  if (closeIndex !== openIndex + 1) return undefined;
  const sourceRow = REQUIRED_MISSING_MARKER_OPEN.exec(cell.tokens[openIndex]!.raw)?.[1];
  if (sourceRow === undefined || !REQUIRED_MISSING_MARKER_CLOSE.test(cell.tokens[closeIndex]!.raw)) return undefined;
  return { index: openIndex, sourceRow };
}

function numericValue(value: string): number | undefined {
  const normalized = value.replaceAll(",", "").trim();
  const match = /^([-+]?\d+(?:\.\d+)?)(?:\s+(?:mm|cm|m|µm|μm|um|in|deg|rad|N|%|unit)(?:\^?2)?)?$/iu.exec(normalized);
  if (match === null) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function graphPosition(value: number, minimum: number, maximum: number): number {
  if (maximum <= minimum) return 50;
  return Math.max(2, Math.min(98, ((value - minimum) / (maximum - minimum)) * 100));
}

function graphStatus(value: string): { className: string; display: string } {
  const normalized = value.trim().toUpperCase();
  if (normalized === "PASS") return { className: "pass", display: "PASS" };
  if (normalized === "FAIL") return { className: "fail", display: "FAIL" };
  if (normalized === "WARNING" || normalized === "REVIEW") return { className: "review", display: normalized };
  return { className: "neutral", display: "N/A" };
}

function unavailableGraph(className: string, caption: string): string {
  return `<figure class="${className}"><figcaption>${caption}</figcaption><p class="graph-unavailable">Insufficient numeric evidence</p></figure>`;
}

function drawingHealthGraph(headers: readonly string[], rows: readonly Tokens.TableCell[][]): string {
  const drawingIndex = headers.indexOf("Drawing Number");
  const dimIndex = headers.indexOf("DIM ID");
  const missingDrawings = rows.filter((row) => cellText(row[drawingIndex]!).toUpperCase() === "MISSING").length;
  const invalidDimIds = rows.filter((row) => {
    const value = cellText(row[dimIndex]!);
    return value.toUpperCase() === "MISSING" || /^\d$/u.test(value);
  }).length;
  const total = rows.length;
  const incomplete = rows.filter((row) => {
    const drawing = cellText(row[drawingIndex]!);
    const dimId = cellText(row[dimIndex]!);
    return drawing.toUpperCase() === "MISSING" || dimId.toUpperCase() === "MISSING" || /^\d$/u.test(dimId);
  }).length;
  const complete = Math.max(0, total - incomplete);
  return `<section class="drawing-health" data-missing-drawings="${missingDrawings}" data-invalid-dim-ids="${invalidDimIds}"><div class="health-copy"><h2>Input integrity</h2><p>${complete} of ${total} Factors have complete drawing identifiers.</p></div><div class="health-measures"><span><strong>${missingDrawings}</strong> Missing drawings</span><span><strong>${invalidDimIds}</strong> DIM IDs to review</span></div></section>`;
}

function specificationRangeGraph(requirements: ReadonlyMap<string, string>, rows: readonly Tokens.TableCell[][]): string {
  const lowerSpec = numericValue(requirements.get("LSL") ?? "");
  const upperSpec = numericValue(requirements.get("USL") ?? "");
  const nominal = numericValue(requirements.get("Design Nominal") ?? "");
  const ranges = rows.map((row) => ({
    label: cellText(row[0]!), lower: numericValue(cellText(row[1]!)),
    upper: numericValue(cellText(row[2]!)), margin: cellText(row[3]!), result: graphStatus(cellText(row[4]!)),
  }));
  if (lowerSpec === undefined || upperSpec === undefined || nominal === undefined
    || ranges.some(({ lower, upper }) => lower === undefined || upper === undefined)) {
    return unavailableGraph("spec-range-graph", "Specification range");
  }
  const domain = [lowerSpec, upperSpec, nominal, ...ranges.flatMap(({ lower, upper }) => [lower!, upper!])];
  const minimum = Math.min(...domain);
  const maximum = Math.max(...domain);
  const rangeRows = ranges.map(({ label, lower, upper, margin, result }) => `<div class="range-row range-row--${result.className}"><span>${escapeHtml(label.replace(" Range", ""))}</span><span class="range-track"><i style="left:${graphPosition(lower!, minimum, maximum)}%;width:${Math.max(1, graphPosition(upper!, minimum, maximum) - graphPosition(lower!, minimum, maximum))}%"></i><b class="spec-window" style="left:${graphPosition(lowerSpec, minimum, maximum)}%;width:${Math.max(1, graphPosition(upperSpec, minimum, maximum) - graphPosition(lowerSpec, minimum, maximum))}%"></b><em style="left:${graphPosition(nominal, minimum, maximum)}%"></em></span><strong>${result.display}</strong><small>Margin ${escapeHtml(margin)}</small></div>`).join("");
  return `<figure class="spec-range-graph" data-statistical-result="${ranges[0]?.result.display ?? "N/A"}" data-worst-case-result="${ranges[1]?.result.display ?? "N/A"}"><figcaption>Specification range</figcaption>${rangeRows}<div class="range-axis"><span>${threeSignificantFigures(minimum)}</span><span>Nominal ${threeSignificantFigures(nominal)}</span><span>${threeSignificantFigures(maximum)}</span></div></figure>`;
}

function capabilitySpectrum(requirements: ReadonlyMap<string, string>, rows: readonly Tokens.TableCell[][]): string {
  const target = numericValue(requirements.get("Target Cpk") ?? "");
  const entries = rows.flatMap((row) => {
    const label = cellText(row[0]!);
    const value = numericValue(cellText(row[1]!));
    return value === undefined || !/^Predictive Cp(?:k|kL|kU)?$/u.test(label) ? [] : [{ label, value, result: graphStatus(cellText(row[2]!)) }];
  });
  if (target === undefined || entries.length === 0) return unavailableGraph("capability-spectrum", "Capability against target");
  const maximum = Math.max(target, ...entries.map(({ value }) => value), 1) * 1.15;
  const bars = entries.map(({ label, value, result }) => `<div class="capability-row capability-row--${result.className}"><span>${escapeHtml(label.replace("Predictive ", ""))}</span><span class="capability-track"><i style="width:${Math.max(0, Math.min(100, (value / maximum) * 100))}%"></i><b style="left:${Math.min(100, (target / maximum) * 100)}%"></b></span><strong>${threeSignificantFigures(value)}</strong></div>`).join("");
  const yieldRow = rows.find((row) => cellText(row[0]!) === "Predicted Yield");
  const dpmRow = rows.find((row) => cellText(row[0]!) === "Predicted DPM");
  return `<figure class="capability-spectrum" data-target-cpk="${target.toFixed(3)}"><figcaption>Capability against target <strong>${threeSignificantFigures(target)}</strong></figcaption>${bars}<p>${yieldRow === undefined ? "" : `Yield ${escapeHtml(cellText(yieldRow[1]!))}`} ${dpmRow === undefined ? "" : `· DPM ${escapeHtml(cellText(dpmRow[1]!))}`}</p></figure>`;
}

function meanOffsetGraph(items: readonly string[]): string {
  const value = (label: string) => items.map((item) => new RegExp(`^${label}:\\s*(.+)$`, "iu").exec(item)?.[1]).find(Boolean) ?? "N/A";
  const offsetText = value("Offset");
  const adjustedMean = value("Adjusted Mean");
  const specificationCenter = value("Specification Center");
  const offset = numericValue(offsetText);
  if (numericValue(adjustedMean) === undefined || numericValue(specificationCenter) === undefined || offset === undefined) {
    return unavailableGraph("mean-offset-graph", "Mean-center alignment");
  }
  const magnitude = Math.min(45, Math.abs(offset) * 500);
  return `<figure class="mean-offset-graph" data-offset="${offset.toFixed(3)}"><figcaption>Mean-center alignment</figcaption><div class="offset-track"><i></i><b style="left:calc(50% + ${offset < 0 ? -magnitude : magnitude}%)"></b></div><p>Mean ${escapeHtml(adjustedMean)} · Center ${escapeHtml(specificationCenter)} · Offset ${escapeHtml(offsetText)}</p></figure>`;
}

function specificationChangeGraph(rows: readonly Tokens.TableCell[][]): string {
  const entries = rows.map((row) => ({ side: cellText(row[0]!), current: numericValue(cellText(row[1]!)), proposed: numericValue(cellText(row[2]!)) }));
  if (entries.length === 0 || entries.some(({ current, proposed }) => current === undefined || proposed === undefined)) {
    return unavailableGraph("spec-change-graph", "Specification proposal");
  }
  const domain = entries.flatMap(({ current, proposed }) => [current!, proposed!]);
  const minimum = Math.min(...domain);
  const maximum = Math.max(...domain);
  const graphRows = entries.map(({ side, current, proposed }) => `<div class="change-row"><span>${escapeHtml(side)}</span><span class="change-track"><i style="left:${graphPosition(current!, minimum, maximum)}%"></i><b style="left:${graphPosition(proposed!, minimum, maximum)}%"></b></span><small>${threeSignificantFigures(current!)} → ${threeSignificantFigures(proposed!)}</small></div>`).join("");
  return `<figure class="spec-change-graph"><figcaption>Specification proposal</figcaption>${graphRows}<p>Engineering approval required.</p></figure>`;
}

class F6PdfRenderer extends Renderer {
  private section: SlideSection = "summary";
  private pendingOptimizationSection: "optimization" | "optimization-continuation" | undefined;
  private analysisGridOpen = false;
  private analysisPanelOpen = false;
  private analysisPanelType: string | undefined;
  private readonly requirements = new Map<string, string>();

  constructor(private readonly inlineImages: ReadonlyMap<string, string>) {
    super();
  }

  get hasWorksheetSection(): boolean {
    return this.section === "worksheet";
  }

  finishContent(): string {
    return this.closeCurrentSection();
  }

  private closeCurrentSection(): string {
    if (this.section === "worksheet") {
      this.section = "summary";
      return `${this.closeAnalysisGrid()}</div></section>`;
    }
    if (this.section === "optimization" || this.section === "optimization-continuation") {
      this.section = "summary";
      return "</section></div></section>";
    }
    return "</section>";
  }

  private inOptimizationSection(): boolean {
    return this.section === "optimization" || this.section === "optimization-continuation";
  }

  private closeAnalysisGrid(): string {
    if (!this.analysisGridOpen) return "";
    const closing = `${this.analysisPanelOpen ? "</article>" : ""}</section>`;
    this.analysisGridOpen = false;
    this.analysisPanelOpen = false;
    this.analysisPanelType = undefined;
    return closing;
  }

  override html(token: Tokens.HTML | Tokens.Tag): string {
    const raw = token.raw.trim();
    if (raw === F6_OPTIMIZATION_COMPARISON_MARKER) {
      this.pendingOptimizationSection = "optimization";
      return "";
    }
    if (raw === F6_OPTIMIZATION_CONTINUATION_MARKER) {
      this.pendingOptimizationSection = "optimization-continuation";
      return "";
    }
    return "";
  }

  override heading(token: Tokens.Heading): string {
    const content = this.parser.parseInline(token.tokens);
    const worksheetMatch = token.depth === 1 ? /^3-(\d+)\s+Worksheet:/i.exec(token.text.trim()) : null;
    if (worksheetMatch !== null) {
      const closePrevious = this.closeCurrentSection();
      this.section = "worksheet";
      this.pendingOptimizationSection = undefined;
      return `${closePrevious}<section class="worksheet-section slide slide-worksheet" id="worksheet-${worksheetMatch[1]}"><div class="worksheet-fit"><h1>${content}</h1>\n`;
    }
    const optimizationSection = this.pendingOptimizationSection;
    const optimizationHeading = token.depth === 2
      && /^Optimization Comparison(?: \(Continued\))?$/u.test(token.text.trim())
      && optimizationSection !== undefined;
    if (optimizationHeading) {
      const closePrevious = this.closeCurrentSection();
      this.pendingOptimizationSection = undefined;
      this.section = optimizationSection;
      const classes = optimizationSection === "optimization-continuation"
        ? "optimization-section slide slide-optimization slide-optimization-continuation"
        : "optimization-section slide slide-optimization";
      return `${closePrevious}<section class="${classes}"><div class="optimization-fit"><h1>${content}</h1><section class="optimization-grid">\n`;
    }
    const panelTypes = new Map([
      ["Tolerance Path Image", "image"],
      ["Requirements and Statistical Results", "results"],
      ["Adjusted Mean to Spec Center Shift", "center"],
      ["Contributor Priorities", "contributors"],
      ["Specification Changes", "specifications"],
    ]);
    const panelType = token.depth === 2 ? panelTypes.get(token.text.trim()) : undefined;
    if (token.depth === 2 && token.text.trim() === "Complete Factor Table") return "";
    if (panelType === undefined) return `<h${token.depth}>${content}</h${token.depth}>\n`;
    const gridStart = this.analysisGridOpen ? "" : '<section class="analysis-grid">';
    const previousPanelEnd = this.analysisPanelOpen ? "</article>" : "";
    this.analysisGridOpen = true;
    this.analysisPanelOpen = true;
    this.analysisPanelType = panelType;
    return `${gridStart}${previousPanelEnd}<article class="analysis-panel analysis-panel--${panelType}"><h2>${content}</h2>\n`;
  }

  override link(token: Tokens.Link): string {
    if (/\.(?:png|jpe?g)(?:$|[?#])/i.test(token.href)) {
      const source = this.inlineImages.get(token.href);
      if (source === undefined) throw new Error("F6 PDF image links must be validated and inlined before rendering.");
      return `<figure class="stack-image"><img width="993" height="622" src="${escapeHtml(source)}" alt="${escapeHtml(token.text)}"></figure>`;
    }
    return super.link(token);
  }

  override image(token: Tokens.Image): string {
    const source = this.inlineImages.get(token.href);
    if (source === undefined) throw new Error("F6 PDF image links must be validated and inlined before rendering.");
    return `<figure class="stack-image"><img width="993" height="622" src="${escapeHtml(source)}" alt="${escapeHtml(token.text)}"></figure>`;
  }

  override list(token: Tokens.List): string {
    const items = token.items.map((item) => item.text.replace(/<[^>]*>/gu, "").trim());
    if (this.inOptimizationSection()) {
      const list = token.ordered ? "ol" : "ul";
      const rows = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      return `<section class="optimization-decision"><h2>Decision Summary</h2><${list}>${rows}</${list}></section>`;
    }
    if (this.analysisPanelType === "center") return meanOffsetGraph(items);
    if (this.analysisPanelType === "results") {
      return `<p class="system-summary">${items.map(escapeHtml).join(" · ")}</p>`;
    }
    return super.list(token);
  }

  override table(token: Tokens.Table): string {
    const headers = token.header.map(cellText);
    if (headers.length === 2 && headers[0] === "Field" && headers[1] === "Value" && !this.analysisGridOpen) {
      return super.table(token).replace("<table>", '<table class="document-overview">');
    }
    if (headers.length === 4 && headers[0] === "Worksheet" && headers[3] === "Comment") {
      const headerCells = token.header.map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`).join("");
      const rows = token.rows.map((row) => {
        const cells = row.map((cell, index) => {
          if (index !== 3) return `<td>${this.parser.parseInline(cell.tokens)}</td>`;
          const comment = cellText(cell);
          const status = comment.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
          return `<td><span class="comment comment--${status}">${escapeHtml(comment)}</span></td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table class="workbook-summary"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (headers.length === 2 && headers[0] === "Requirement" && headers[1] === "Value") {
      for (const row of token.rows) this.requirements.set(cellText(row[0]!), cellText(row[1]!));
      return "";
    }
    if (this.inOptimizationSection()) {
      if (headers.length === 3 && headers[0] === "Metric" && headers[1] === "Raw Data" && headers[2] === "Optimized Data") {
        return super.table(token).replace("<table>", '<table class="optimization-table optimization-table--system">');
      }
      if (headers.length === 4 && headers[0] === "Step" && headers[1] === "Status" && headers[2] === "Action" && headers[3] === "Result") {
        return super.table(token).replace("<table>", '<table class="optimization-table optimization-table--path">');
      }
      if (headers.length === 4 && headers[0] === "Factor" && headers[1] === "Table / Row" && headers[2] === "Nominal Before" && headers[3] === "Nominal After") {
        return super.table(token).replace("<table>", '<table class="optimization-table optimization-table--factors">');
      }
      return super.table(token).replace("<table>", '<table class="optimization-table">');
    }
    if (headers.length === 5 && headers[0] === "Metric" && headers[1] === "Lower" && headers[2] === "Upper") {
      return specificationRangeGraph(this.requirements, token.rows);
    }
    if (headers.length === 3 && headers[0] === "Capability Metric" && headers[1] === "Value" && headers[2] === "Result") {
      return capabilitySpectrum(this.requirements, token.rows);
    }
    if (exactHeadersMatch(headers, COMPLETE_FACTOR_TABLE_HEADERS)) {
      if (token.rows.length > 10) {
        throw new Error("F6 PDF fixed slide supports at most 10 Factors per worksheet.");
      }
      const headerCells = token.header.map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`).join("");
      const rows = token.rows.map((row) => {
        const marker = requiredMissingMarker(row[0]!);
        const rowClass = marker === undefined ? "" : ' class="missing"';
        const cells = row.map((cell, index) => {
          if (index !== 0 || marker === undefined) return `<td>${this.parser.parseInline(cell.tokens)}</td>`;
          const before = this.parser.parseInline(cell.tokens.slice(0, marker.index));
          const after = this.parser.parseInline(cell.tokens.slice(marker.index + 2));
          return `<td>${before}<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="${marker.sourceRow}" hidden="" aria-hidden="true"></span>${after}</td>`;
        }).join("");
        return `<tr${rowClass}>${cells}</tr>`;
      }).join("");
      return `<table class="factor-table factor-table--complete" data-factor-count="${token.rows.length}"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (headers.length === 5 && headers[0] === "Side" && headers[1] === "Current Limit" && headers[2] === "Proposed Limit") {
      return specificationChangeGraph(token.rows);
    }
    const contributionIndex = token.header.findIndex((cell) => cellText(cell) === "Variance Contribution");
    const factorIndex = token.header.findIndex((cell) => cellText(cell) === "Factor");
    const rankIndex = token.header.findIndex((cell) => cellText(cell) === "Rank");
    const sigmaIndex = token.header.findIndex((cell) => cellText(cell) === "One Sigma");
    const priorityIndex = token.header.findIndex((cell) => cellText(cell) === "Priority");
    const guidanceIndex = token.header.findIndex((cell) => cellText(cell) === "Guidance");
    if ([contributionIndex, factorIndex, rankIndex, sigmaIndex, priorityIndex, guidanceIndex].some((index) => index < 0)) {
      const tableClass = this.analysisPanelType === "results" ? "result-table" : "analysis-table";
      return super.table(token).replace("<table>", `<table class="${tableClass}">`);
    }
    const entries = token.rows.flatMap((row) => {
      const value = Number.parseFloat(cellText(row[contributionIndex]!).replace("%", ""));
      return Number.isFinite(value) ? [{
        rank: cellText(row[rankIndex]!),
        factor: cellText(row[factorIndex]!),
        sigma: cellText(row[sigmaIndex]!),
        value: Math.max(0, Math.min(100, value)),
        priority: cellText(row[priorityIndex]!),
        guidance: cellText(row[guidanceIndex]!),
      }] : [];
    });
    if (entries.length === 0) return super.table(token);
    const bars = entries.map(({ rank, factor, sigma, value, priority, guidance }, index) => `<div class="contribution-row${index < 3 ? " contribution-row--priority" : ""}"><span class="contribution-rank">${escapeHtml(rank)}</span><span class="contribution-factor">${escapeHtml(factor)}</span><span class="contribution-sigma">${escapeHtml(sigma)}</span><span class="contribution-track"><span class="contribution-fill" style="width:${value}%"></span></span><strong>${threeSignificantFigures(value)}%</strong><span class="contribution-priority">${escapeHtml(priority)}</span><span class="contribution-guidance">${escapeHtml(guidance)}</span></div>`).join("");
    return `<figure class="contribution-chart"><figcaption>Factor Contribution Pareto and Review Priorities</figcaption><div class="contribution-head"><span>Rank</span><span>Factor</span><span>One Sigma</span><span>Variance Contribution</span><span>Value</span><span>Priority</span><span>Guidance</span></div>${bars}</figure>`;
  }
}

const PRINT_CSS = `
  :root { --ink:#0f172a; --muted:#475569; --line:#cbd5e1; --paper:#fff; --wash:#f8fafc; --blue:#0078d4; --pass:#107c10; --warn:#a15c00; --fail:#d13438; }
  * { box-sizing:border-box; }
  @page { size:A4 landscape; margin:10mm 8mm 12mm; @bottom-right { content:"TA Assist Agent  |  " counter(page) " / " counter(pages); color:#64748b; font:6pt "Segoe UI", Arial, sans-serif; } }
  html { background:var(--wash); color:var(--ink); font-family:"Segoe UI", Arial, sans-serif; font-size:10pt; line-height:1.25; font-variant-numeric:tabular-nums; }
  body { margin:0 auto; max-width:281mm; background:var(--paper); }
  .report-content { padding:4mm; }
  .report-content>h1 { font-size:20pt; margin:0 0 3mm; padding-bottom:2mm; border-bottom:2px solid var(--blue); }
  .report-content>h2 { margin:2.5mm 0 1mm; font-size:11pt; }
  .document-overview,.workbook-summary { table-layout:fixed; margin:0 0 2mm; font-size:9pt; }
  .document-overview th:first-child,.document-overview td:first-child { width:34%; }
  .workbook-summary th:nth-child(1),.workbook-summary td:nth-child(1) { width:14%; }
  .workbook-summary th:nth-child(2),.workbook-summary td:nth-child(2) { width:24%; }
  .workbook-summary th:nth-child(3),.workbook-summary td:nth-child(3) { width:52%; }
  .workbook-summary th:nth-child(4),.workbook-summary td:nth-child(4) { width:10%; text-align:center; }
  .worksheet-section { margin:0 0 6mm; break-before:page; page-break-before:always; }
  .worksheet-fit { width:100%; padding:0; }
  h1 { margin:0 0 1.5mm; padding:0 0 1mm; border-bottom:2px solid var(--blue); font-size:20pt; font-weight:650; letter-spacing:0; }
  h2 { margin:0 0 1mm; color:#1e293b; font-size:13pt; font-weight:650; letter-spacing:0; break-after:avoid; }
  .worksheet-section h2 { font-size:10pt; }
  h3 { margin:1mm 0 .5mm; font-size:12pt; break-after:avoid; }
  p, li { margin:.7mm 0; color:#334155; }
  table { width:100%; margin:1mm 0 1.5mm; border-collapse:collapse; font-size:10pt; break-inside:auto; }
  thead { display:table-header-group; } tr { break-inside:avoid; }
  th { padding:1.2mm 1mm; background:#1e293b; color:#fff; text-align:left; font-weight:600; }
  td { padding:1mm; border-bottom:1px solid var(--line); vertical-align:top; } tbody tr:nth-child(even) { background:var(--wash); }
  a { color:#0067b8; text-decoration:underline; } .comment { font-weight:750; white-space:nowrap; } .comment--pass { color:var(--pass); } .comment--need-review { color:var(--warn); } .comment--fail { color:var(--fail); }
  .f6-inline-marker,[data-f6-marker] { display:none !important; }
  .factor-table { table-layout:fixed; }
  .factor-table td,.factor-table th { font-size:8.5pt; overflow-wrap:normal; word-break:normal; }
  .factor-table th:nth-child(1),.factor-table td:nth-child(1) { width:16%; }
  .factor-table th:nth-child(2),.factor-table td:nth-child(2) { width:10%; }
  .factor-table th:nth-child(3),.factor-table td:nth-child(3) { width:8%; }
  .factor-table th:nth-child(4),.factor-table td:nth-child(4) { width:8%; }
  .factor-table th:nth-child(5),.factor-table td:nth-child(5) { width:7%; }
  .factor-table th:nth-child(6),.factor-table td:nth-child(6) { width:7%; text-align:right; }
  .factor-table th:nth-child(7),.factor-table td:nth-child(7) { width:7%; text-align:right; }
  .factor-table th:nth-child(8),.factor-table td:nth-child(8) { width:7%; text-align:right; }
  .factor-table th:nth-child(9),.factor-table td:nth-child(9) { width:7%; text-align:right; }
  .factor-table th:nth-child(10),.factor-table td:nth-child(10) { width:6%; text-align:right; }
  .factor-table th:nth-child(11),.factor-table td:nth-child(11) { width:6%; text-align:right; }
  .factor-table th:nth-child(12),.factor-table td:nth-child(12) { width:6%; text-align:right; }
  .factor-table th:nth-child(13),.factor-table td:nth-child(13) { width:6%; text-align:right; }
  .factor-table th:nth-child(14),.factor-table td:nth-child(14) { width:16%; }
  .factor-table tbody tr.missing td { background:#fef2f2; }
  .drawing-health { display:flex; align-items:center; justify-content:space-between; gap:4mm; margin:0 0 1.5mm; padding:1.4mm 2mm; border:1px solid var(--line); background:#f8fafc; } .health-copy { display:flex; align-items:baseline; gap:3mm; } .health-copy h2,.health-copy p { margin:0; } .health-copy h2 { font-size:10pt; } .health-copy p { color:var(--muted); font-size:7.5pt; } .health-measures { display:flex; gap:5mm; font-size:7.5pt; } .health-measures span { white-space:nowrap; } .health-measures strong { margin-right:1mm; color:var(--fail); font-size:11pt; }
  .analysis-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); grid-template-rows:auto auto; gap:0; align-items:stretch; border:1px solid var(--line); } .analysis-panel { min-width:0; padding:1.5mm 2mm; background:var(--paper); break-inside:avoid; } .analysis-panel+.analysis-panel { border-left:1px solid var(--line); } .analysis-panel h2 { margin-bottom:1mm; } .analysis-panel--image { display:grid; grid-template-columns:78mm minmax(0,1fr); column-gap:3mm; grid-column:span 5; } .analysis-panel--image h2 { grid-column:1/-1; } .analysis-panel--image>.stack-image { grid-column:1; grid-row:2/span 3; } .analysis-panel--image>p { grid-column:2; margin:.5mm 0; font-size:7.5pt; line-height:1.3; } .analysis-panel--results { display:grid; grid-template-columns:1fr 1fr; gap:2mm; grid-column:span 7; } .analysis-panel--results>h2,.analysis-panel--results>.system-summary { grid-column:1/-1; } .analysis-panel--center,.analysis-panel--contributors,.analysis-panel--specifications { min-height:36mm; border-top:1px solid var(--line); } .analysis-panel--center { grid-column:span 3; } .analysis-panel--contributors { grid-column:span 6; } .analysis-panel--specifications { grid-column:span 3; }
  .stack-image { margin:0; text-align:center; break-inside:avoid; } .stack-image img { width:78mm; max-height:62mm; object-fit:contain; }
  figure { margin:0; } figcaption { margin-bottom:1.2mm; color:var(--ink); font-size:8pt; font-weight:650; }
  .spec-range-graph,.capability-spectrum,.mean-offset-graph,.spec-change-graph { min-width:0; }
  .range-row { display:grid; grid-template-columns:17mm 1fr 10mm 22mm; gap:1.2mm; align-items:center; margin:1.2mm 0; font-size:7pt; } .range-row>strong { font-size:7pt; } .range-row--pass>strong { color:var(--pass); } .range-row--fail>strong { color:var(--fail); } .range-row>small { color:var(--muted); } .range-track,.capability-track,.offset-track,.change-track { position:relative; display:block; height:4mm; background:#e7edf3; } .range-track i { position:absolute; top:.8mm; height:2.4mm; background:var(--blue); z-index:2; } .range-track .spec-window { position:absolute; top:0; height:4mm; border:1px solid #94a3b8; background:transparent; z-index:1; } .range-track em { position:absolute; top:-.8mm; width:1px; height:5.6mm; background:var(--ink); z-index:3; } .range-axis { display:flex; justify-content:space-between; color:var(--muted); font-size:6.5pt; }
  .capability-spectrum figcaption strong { color:var(--blue); } .capability-row { display:grid; grid-template-columns:12mm 1fr 14mm; gap:1mm; align-items:center; margin:1.2mm 0; font-size:7pt; } .capability-track i { display:block; height:100%; background:#64748b; } .capability-row--pass .capability-track i { background:var(--pass); } .capability-row--fail .capability-track i { background:var(--fail); } .capability-track b { position:absolute; top:-.8mm; width:1px; height:5.6mm; background:var(--ink); } .capability-spectrum>p,.system-summary { margin:1mm 0 0; color:var(--muted); font-size:6.8pt; }
  .offset-track { margin:3mm 0 2mm; background:#e7edf3; } .offset-track i { position:absolute; left:50%; top:-1mm; width:1px; height:6mm; background:var(--ink); } .offset-track b { position:absolute; top:.5mm; width:3mm; height:3mm; background:var(--blue); transform:translateX(-50%) rotate(45deg); } .mean-offset-graph p,.spec-change-graph p { margin:1mm 0 0; color:var(--muted); font-size:6.8pt; }
  .contribution-chart { margin:0; } .contribution-chart figcaption { margin-bottom:1mm; font-size:8pt; } .contribution-head,.contribution-row { display:grid; grid-template-columns:6mm minmax(25mm,1fr) 16mm minmax(24mm,.8fr) 12mm 15mm minmax(36mm,1.2fr); gap:.8mm; align-items:center; min-height:3.3mm; font-size:6.8pt; } .contribution-head { color:var(--muted); font-weight:700; } .contribution-track { height:2.4mm; overflow:hidden; background:#dbe4ee; } .contribution-fill { display:block; height:100%; background:#64748b; } .contribution-row--priority .contribution-fill { background:var(--blue); } .contribution-rank,.contribution-priority { font-weight:700; } .contribution-guidance { overflow-wrap:normal; word-break:normal; }
  .change-row { display:grid; grid-template-columns:10mm 1fr; gap:1mm; align-items:center; margin:2mm 0; font-size:7pt; } .change-row small { grid-column:2; color:var(--muted); } .change-track { height:2.5mm; } .change-track i,.change-track b { position:absolute; top:-.5mm; width:3.5mm; height:3.5mm; transform:translateX(-50%) rotate(45deg); } .change-track i { background:#64748b; } .change-track b { background:var(--blue); }
  @media print { html,body { background:#fff; } body { max-width:none; } }

  :root { --st-bone:#e2dcc9; --st-black:#000; --st-ink:#0a0a0a; --st-paper:#f4efe0; --st-magenta:#c73b7a; --st-orange:#ee7a2e; --st-teal:#2d7e73; --st-blue:#3f73b7; --st-mustard:#d8a93b; --st-display:"Stardos Stencil","Rockwell Extra Bold",Rockwell,serif; --st-meta:"Barlow Condensed","Arial Narrow",sans-serif; --st-body:Aptos,"Segoe UI",sans-serif; }
  @page { size:20in 11.25in; margin:0; }
  html,body { width:1920px; margin:0; background:var(--st-paper); color:var(--st-ink); font-family:var(--st-body); }
  main { width:1920px; }
  .slide { position:relative; display:grid; width:1920px; height:1080px; margin:0; padding:48px 64px 42px; overflow:hidden; break-after:page; page-break-after:always; background:var(--st-bone); }
  .slide:last-child { break-after:auto; page-break-after:auto; }
  .slide::after { position:absolute; right:64px; bottom:24px; content:"TA ASSIST AGENT  /  DRAFT"; color:rgba(10,10,10,.56); font:700 20px/1 var(--st-meta); letter-spacing:.08em; }
  .slide-summary { grid-template-columns:1.05fr .95fr; grid-template-rows:180px 1fr; gap:24px 28px; }
  .slide-summary>h1 { grid-column:1/-1; align-self:end; margin:0; padding:0; border:0; color:var(--st-ink); font:700 112px/.84 var(--st-display); text-transform:uppercase; letter-spacing:0; }
  .slide-summary>h2 { display:none; }
  .document-overview,.workbook-summary { align-self:stretch; width:100%; margin:0; overflow:hidden; border:2px solid var(--st-ink); border-radius:24px; border-collapse:separate; border-spacing:0; table-layout:fixed; background:var(--st-paper); font-size:24px; }
  .document-overview::before,.workbook-summary::before { display:table-caption; padding:20px 26px; background:var(--st-orange); color:var(--st-ink); content:"Document Overview"; font:700 28px/1 var(--st-display); text-align:left; text-transform:uppercase; }
  .workbook-summary::before { content:"Workbook Summary"; background:var(--st-teal); color:var(--st-bone); }
  .document-overview th,.workbook-summary th { padding:14px 20px; border:0; border-bottom:2px solid var(--st-ink); background:var(--st-black); color:var(--st-bone); font:800 20px/1 var(--st-meta); letter-spacing:.04em; text-transform:uppercase; }
  .document-overview td,.workbook-summary td { padding:13px 20px; border:0; border-bottom:1px solid rgba(10,10,10,.22); color:var(--st-ink); font-size:21px; }
  .workbook-summary .comment { display:inline-block; padding:7px 16px; border-radius:999px; background:var(--st-magenta); color:var(--st-bone); font:800 18px/1 var(--st-meta); text-transform:uppercase; }
  .slide-worksheet { display:flex; flex-direction:column; gap:18px; border:0; }
  .slide-worksheet>.worksheet-fit { display:grid; min-height:0; flex:1; grid-template-columns:1fr; grid-template-rows:64px 330px 1fr; gap:10px; }
  .slide-worksheet>.worksheet-fit>h1 { margin:0; padding:0; border:0; color:var(--st-ink); font:700 58px/.95 var(--st-display); text-transform:uppercase; }
  .slide-optimization { display:flex; flex-direction:column; border:0; }
  .slide-optimization>.optimization-fit { display:grid; min-height:0; flex:1; grid-template-columns:1fr; grid-template-rows:64px 1fr; gap:10px; }
  .slide-optimization>.optimization-fit>h1 { margin:0; padding:0; border:0; color:var(--st-ink); font:700 54px/.95 var(--st-display); text-transform:uppercase; }
  .optimization-grid { display:grid; min-height:0; grid-template-columns:1fr 1fr; grid-template-rows:220px 1fr 1fr; gap:12px; }
  .optimization-decision { min-height:0; padding:18px 20px; border-radius:22px; background:var(--st-orange); }
  .optimization-decision h2 { margin:0 0 8px; color:var(--st-ink); font:700 24px/1 var(--st-display); text-transform:uppercase; }
  .optimization-decision ul,.optimization-decision ol { margin:0; padding-left:20px; font-size:16px; line-height:1.25; }
  .optimization-decision li { margin:4px 0; color:var(--st-ink); }
  .optimization-table { width:100%; margin:0; table-layout:fixed; overflow:hidden; border:2px solid var(--st-ink); border-radius:20px; border-collapse:separate; border-spacing:0; background:var(--st-paper); }
  .optimization-table th { padding:10px 11px; border:0; border-bottom:2px solid var(--st-ink); background:var(--st-black); color:var(--st-bone); font:800 15px/1 var(--st-meta); letter-spacing:.03em; text-transform:uppercase; }
  .optimization-table td { padding:8px 10px; border:0; border-bottom:1px solid rgba(10,10,10,.22); color:var(--st-ink); font-size:14px; line-height:1.2; }
  .optimization-table--system { grid-column:1; grid-row:2/span 2; }
  .optimization-table--path { grid-column:2; grid-row:1/span 2; }
  .optimization-table--factors { grid-column:1/span 2; grid-row:3; }
  .slide-optimization-continuation .optimization-table--factors { grid-row:2/span 2; }
  .slide-optimization-continuation .optimization-table--path { grid-row:1; }
  .slide-optimization-continuation .optimization-table--system { grid-row:1; }
  .factor-table { height:330px; margin:0; overflow:hidden; border:2px solid var(--st-ink); border-radius:22px; border-collapse:separate; border-spacing:0; table-layout:fixed; background:var(--st-paper); }
  .factor-table th { padding:10px 9px; border:0; border-bottom:2px solid var(--st-ink); background:var(--st-black); color:var(--st-bone); font:800 15px/1 var(--st-meta); letter-spacing:.03em; text-transform:uppercase; }
  .factor-table td { padding:8px 9px; border:0; border-bottom:1px solid rgba(10,10,10,.2); color:var(--st-ink); font-size:14px; line-height:1.1; }
  .factor-table tbody tr.missing td { background:transparent; }
  .factor-table tbody tr.missing td:nth-child(4) { color:var(--st-magenta); font-weight:700; }
  .guidance { display:inline-block; padding-left:8px; border-left:3px solid rgba(10,10,10,.38); }
  .guidance--pass { border-color:var(--st-teal); color:var(--st-teal); }
  .guidance--review { border-color:var(--st-orange); }
  .analysis-grid { display:grid; min-height:0; grid-template-columns:1.15fr .85fr .72fr; grid-template-rows:1fr 220px; gap:12px; border:0; }
  .analysis-panel { min-width:0; min-height:0; padding:20px 22px; overflow:hidden; border:0; border-radius:22px; break-inside:avoid; color:var(--st-ink); }
  .analysis-panel+.analysis-panel { border-left:0; }
  .analysis-panel h2 { margin:0 0 12px; color:inherit; font:700 28px/1 var(--st-display); text-transform:uppercase; }
  .analysis-panel--image { display:block; grid-column:1; grid-row:1; background:var(--st-paper); }
  .analysis-panel--results { display:block; grid-column:2; grid-row:1; background:var(--st-mustard); }
  .analysis-panel--center { grid-column:3; grid-row:1; min-height:0; border:0; background:var(--st-blue); color:var(--st-bone); }
  .analysis-panel--contributors { grid-column:1/span 2; grid-row:2; min-height:0; border:0; background:var(--st-teal); color:var(--st-bone); }
  .analysis-panel--specifications { grid-column:3; grid-row:2; min-height:0; border:0; background:var(--st-magenta); color:var(--st-bone); }
  .analysis-panel--image>.stack-image { display:block; float:left; width:48%; margin:0 18px 8px 0; }
  .analysis-panel--image .stack-image img { width:100%; height:auto; max-height:248px; object-fit:contain; }
  .analysis-panel--image>p { margin:7px 0; color:var(--st-ink); font-size:15px; line-height:1.28; }
  .analysis-panel--results .spec-range-graph,.analysis-panel--results .capability-spectrum { width:49%; }
  .analysis-panel--results .spec-range-graph { float:left; }
  .analysis-panel--results .capability-spectrum { float:right; }
  .analysis-panel figcaption { margin-bottom:12px; color:inherit; font:800 17px/1 var(--st-meta); letter-spacing:.05em; text-transform:uppercase; }
  .range-row { grid-template-columns:62px 1fr 42px; min-height:30px; margin:0; gap:8px; font-size:12px; }
  .range-row>small { display:none; }
  .range-axis { font-size:12px; }
  .capability-row { grid-template-columns:38px 1fr 45px; min-height:28px; margin:0; gap:8px; font-size:12px; }
  .capability-row>strong,.range-row>strong { color:var(--st-ink); }
  .analysis-panel--center .mean-offset-graph p { color:var(--st-bone); font-size:17px; }
  .analysis-panel--center .offset-track { margin-top:74px; background:rgba(226,220,201,.35); }
  .analysis-panel--contributors .contribution-chart { display:grid; margin:0; grid-template-columns:1fr; }
  .analysis-panel--contributors h2,.analysis-panel--specifications h2 { margin-bottom:6px; font-size:22px; }
  .analysis-panel--contributors figcaption,.analysis-panel--specifications figcaption { display:none; }
  .analysis-panel--contributors .contribution-head,.analysis-panel--contributors .contribution-row { grid-template-columns:30px minmax(145px,1fr) 84px minmax(90px,1fr) 54px 68px minmax(100px,1fr); min-height:17px; padding:1px 0; color:var(--st-bone); font-size:10px; line-height:1; }
  .analysis-panel--contributors .contribution-track { background:rgba(226,220,201,.28); }
  .analysis-panel--contributors .contribution-fill { background:var(--st-mustard); }
  .analysis-panel--contributors>p { margin:4px 0 0; color:var(--st-bone); font-size:11px; line-height:1.15; }
  .analysis-panel--specifications .change-row { margin:0 0 6px; }
  .analysis-panel--specifications .change-track { background:rgba(226,220,201,.28); }
  .analysis-panel--specifications .change-track i { background:var(--st-bone); }
  .analysis-panel--specifications .change-track b { background:var(--st-mustard); }
  .analysis-panel--specifications .spec-change-graph p,.analysis-panel--specifications .change-row small { color:var(--st-bone); }
  .analysis-panel--specifications .spec-change-graph p { margin:4px 0 0; font-size:11px; }
`;

export function renderF6PdfHtml(input: F6PdfHtmlInput): string {
  if (!/^[a-f0-9]{64}$/.test(input.sourceHash)) throw new Error("F6 PDF source hash must be a SHA-256 digest.");
  if (input.markdown.trim().length === 0) throw new Error("F6 PDF source Markdown must not be empty.");
  const renderer = new F6PdfRenderer(input.inlineImages ?? new Map());
  const parsedContent = marked.parse(input.markdown, { async: false, renderer });
  const content = formatReportHtml(`${parsedContent}${renderer.finishContent()}`);
  const base = input.baseHref === undefined ? "" : `<base href="${escapeHtml(input.baseHref)}">`;
  return `<!doctype html>\n<html lang="en" data-source-sha256="${input.sourceHash}"><head><meta charset="utf-8">${base}<meta name="color-scheme" content="light"><title>TA Engineering Analysis Report</title><style>${PRINT_CSS}</style></head><body><main><section class="report-content slide slide-summary">${content}</main></body></html>`;
}

export function f6PdfImageLinks(markdown: string): readonly string[] {
  const links = new Set<string>();
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if ((token.type === "link" || token.type === "image") && /\.(?:png|jpe?g)(?:$|[?#])/i.test(token.href)) {
      links.add(token.href);
    }
  });
  return [...links];
}