import { marked, Renderer, type Tokens } from "marked";

export interface F6PdfHtmlInput {
  readonly markdown: string;
  readonly sourceHash: string;
  readonly baseHref?: string;
  readonly inlineImages?: ReadonlyMap<string, string>;
}

const COMPLETE_FACTOR_TABLE_HEADERS = [
  "Ordinal",
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
    .replace(
      /Capability: f0_information_insufficient; Knowledge: (?:missing_process_context|invalid_total_band|guidance_unknown)/gu,
      '<span class="guidance guidance--review">Insufficient evidence</span>',
    )
    .replace(
      /Capability: internal_within_guidance; Recommended tolerance band or range: &lt;= (-?\d+(?:\.\d+)?) ([^;<]+);[^<]*/gu,
      (_match, rawLimit: string, unit: string) => `<span class="guidance guidance--pass">Within guidance &le; ${rawLimit} ${unit.trim()}</span>`,
    )
    .replace(
      /Capability: internal_guidance_exceeded; Recommended tolerance band or range: &lt;= (-?\d+(?:\.\d+)?) ([^;<]+);[^<]*/gu,
      (_match, rawLimit: string, unit: string) => `<span class="guidance guidance--review">Exceeds guidance &le; ${rawLimit} ${unit.trim()}</span>`,
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

function statusClass(status: { className: string; display: string }): string {
  if (status.className === "pass") return "status-complete";
  if (status.className === "review") return "status-warning";
  if (status.className === "fail" || status.display === "MISSING") return "status-missing";
  return "";
}

function statusHtml(value: string): string {
  if (value.trim().toUpperCase() === "MISSING") return '<strong class="status-missing">MISSING</strong>';
  return escapeHtml(value);
}

function factorTableCellHtml(headers: readonly string[], cell: Tokens.TableCell, index: number, parseInline: (tokens: Tokens.Generic[]) => string): string {
  const text = cellText(cell);
  if (text.toUpperCase() === "MISSING") return statusHtml(text);
  if (headers[index] === "DIM ID" && /^\d$/u.test(text)) return `<strong class="dim-id-review">${escapeHtml(text)}</strong>`;
  return parseInline(cell.tokens);
}

function unavailableGraph(className: string, caption: string): string {
  return `<figure class="${className}"><figcaption>${caption}</figcaption><p class="graph-unavailable">Insufficient numeric evidence</p></figure>`;
}

function specificationRangeGraph(requirements: ReadonlyMap<string, string>, rows: readonly Tokens.TableCell[][]): string {
  const lowerSpec = numericValue(requirements.get("LSL") ?? "");
  const upperSpec = numericValue(requirements.get("USL") ?? "");
  const nominal = numericValue(requirements.get("Design Nominal") ?? "");
  const ranges = rows.map((row) => ({
    label: cellText(row[0]!), lower: numericValue(cellText(row[1]!)),
    upper: numericValue(cellText(row[2]!)), result: graphStatus(cellText(row[4]!)),
  }));
  if (lowerSpec === undefined || upperSpec === undefined || nominal === undefined
    || ranges.some(({ lower, upper }) => lower === undefined || upper === undefined)) {
    return unavailableGraph("spec-range-graph", "Specification range");
  }
  const domain = [lowerSpec, upperSpec, nominal, ...ranges.flatMap(({ lower, upper }) => [lower!, upper!])];
  const minimum = Math.min(...domain);
  const maximum = Math.max(...domain);
  const lowerSpecPosition = graphPosition(lowerSpec, minimum, maximum);
  const upperSpecPosition = graphPosition(upperSpec, minimum, maximum);
  const rangeRows = ranges.map(({ label, lower, upper, result }) => {
    const semanticClass = statusClass(result);
    return `<div class="range-row range-row--${result.className}"><span>${escapeHtml(label.replace(" Range", ""))}</span><span class="range-track"><b class="range-spec-line range-spec-line--lower" aria-hidden="true" style="left:${lowerSpecPosition}%"></b><i style="left:${graphPosition(lower!, minimum, maximum)}%;width:${Math.max(1, graphPosition(upper!, minimum, maximum) - graphPosition(lower!, minimum, maximum))}%"></i><em style="left:${graphPosition(nominal, minimum, maximum)}%"></em><b class="range-spec-line range-spec-line--upper" aria-hidden="true" style="left:${upperSpecPosition}%"></b></span><strong${semanticClass === "" ? "" : ` class="${semanticClass}"`}>${result.display}</strong><small class="range-values">${threeSignificantFigures(lower!)} to ${threeSignificantFigures(upper!)}</small></div>`;
  }).join("");
  const worstCaseResult = ranges.find(({ label }) => label === "Worst-Case Range")?.result.display ?? "N/A";
  return `<figure class="spec-range-graph" data-statistical-result="${ranges[0]?.result.display ?? "N/A"}" data-worst-case-result="${worstCaseResult}"><figcaption>Specification range</figcaption><div class="range-spec-labels"><b class="range-spec-label range-spec-label--lower">LSL ${threeSignificantFigures(lowerSpec)}</b><b class="range-spec-label range-spec-label--upper">USL ${threeSignificantFigures(upperSpec)}</b></div>${rangeRows}<div class="range-axis"><span>${threeSignificantFigures(minimum)}</span><span>Nominal ${threeSignificantFigures(nominal)}</span><span>${threeSignificantFigures(maximum)}</span></div></figure>`;
}

function capabilitySpectrum(requirements: ReadonlyMap<string, string>, rows: readonly Tokens.TableCell[][]): string {
  const target = numericValue(requirements.get("Target Cpk") ?? "");
  const evaluationLevelText = requirements.get("Evaluation Level")?.trim() ?? "";
  const evaluationLevel = evaluationLevelText === "" || /^N\/A(?:\s+sigma)?$/iu.test(evaluationLevelText) ? undefined : evaluationLevelText;
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
  const evaluationLevelAttribute = evaluationLevel === undefined ? "" : ` data-evaluation-level="${escapeHtml(evaluationLevel)}"`;
  const caption = evaluationLevel === undefined ? threeSignificantFigures(target) : `${escapeHtml(evaluationLevel)} · ${threeSignificantFigures(target)}`;
  return `<figure class="capability-spectrum" data-target-cpk="${target.toFixed(3)}"${evaluationLevelAttribute}><figcaption><span>Capability against target</span><strong>${caption}</strong></figcaption>${bars}<p>${yieldRow === undefined ? "" : `Yield ${escapeHtml(cellText(yieldRow[1]!))}`} ${dpmRow === undefined ? "" : `· DPM ${escapeHtml(cellText(dpmRow[1]!))}`}</p></figure>`;
}

function meanOffsetGraph(items: readonly string[]): string {
  const value = (label: string) => items.map((item) => new RegExp(`^${label}:\\s*(.+)$`, "iu").exec(item)?.[1]).find(Boolean) ?? "N/A";
  const offsetText = value("Offset");
  const adjustedMean = value("Adjusted Mean");
  const designNominal = value("Design Nominal");
  const offset = numericValue(offsetText);
  if (numericValue(adjustedMean) === undefined || numericValue(designNominal) === undefined || offset === undefined) {
    return unavailableGraph("mean-offset-graph", "Mean-center alignment");
  }
  const magnitude = Math.min(45, Math.abs(offset) * 500);
  return `<figure class="mean-offset-graph" data-offset="${offset.toFixed(3)}"><figcaption>Mean-center alignment</figcaption><div class="offset-track"><i class="mean-marker mean-marker--nominal"><span>Design nominal</span></i><b class="mean-marker mean-marker--adjusted" style="left:calc(50% + ${offset < 0 ? -magnitude : magnitude}%)"><span>Adjusted mean</span></b></div><p><span class="mean-value mean-value--nominal">Design nominal ${escapeHtml(designNominal)}</span> · <span class="mean-value mean-value--adjusted">Adjusted mean ${escapeHtml(adjustedMean)}</span> · Offset ${escapeHtml(offsetText)}</p></figure>`;
}

function specificationChangeGraph(rows: readonly Tokens.TableCell[][]): string {
  const entries = rows.map((row) => ({ side: cellText(row[0]!), current: numericValue(cellText(row[1]!)), proposed: numericValue(cellText(row[2]!)) }));
  if (entries.length === 0 || entries.some(({ current, proposed }) => current === undefined || proposed === undefined)) {
    return unavailableGraph("spec-change-graph", "Specification proposal");
  }
  const domain = entries.flatMap(({ current, proposed }) => [current!, proposed!]);
  const minimum = Math.min(...domain);
  const maximum = Math.max(...domain);
  const graphRows = entries.map(({ side, current, proposed }) => `<div class="change-row"><span>${escapeHtml(side)}</span><span class="change-track"><i class="spec-marker spec-marker--current" style="left:${graphPosition(current!, minimum, maximum)}%"></i><b class="spec-marker spec-marker--proposed" style="left:${graphPosition(proposed!, minimum, maximum)}%"></b></span><small><span class="spec-value spec-value--current">${threeSignificantFigures(current!)}</span> → <span class="spec-value spec-value--proposed">${threeSignificantFigures(proposed!)}</span></small></div>`).join("");
  return `<figure class="spec-change-graph"><figcaption>Specification proposal</figcaption><div class="spec-change-legend"><span class="spec-value spec-value--current">Current</span><span class="spec-value spec-value--proposed">Proposed</span></div>${graphRows}<p>Engineering approval required.</p></figure>`;
}

function specificationGuidance(items: readonly string[]): string {
  const value = (label: string) => items.map((item) => new RegExp(`^${label}:\\s*(.+)$`, "iu").exec(item)?.[1]).find(Boolean);
  const current = value("Current Range");
  const proposed = value("Proposed Range");
  const summary = value("Summary");
  const values = current === undefined && proposed === undefined ? "" : `<p class="spec-guidance-values">${current === undefined ? "" : `<span class="spec-value spec-value--current">Current ${escapeHtml(current)}</span>`}${current !== undefined && proposed !== undefined ? " · " : ""}${proposed === undefined ? "" : `<span class="spec-value spec-value--proposed">Proposed ${escapeHtml(proposed)}</span>`}</p>`;
  return `<section class="specification-guidance">${values}${summary === undefined ? "" : `<p class="spec-range-summary">${escapeHtml(summary)}</p>`}</section>`;
}

class F6PdfRenderer extends Renderer {
  private section: SlideSection = "summary";
  private pendingOptimizationSection: "optimization" | "optimization-continuation" | undefined;
  private analysisGridOpen = false;
  private analysisPanelOpen = false;
  private analysisPanelType: string | undefined;
  private inlineOptimizationOpen = false;
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
      const inlineEnd = this.inlineOptimizationOpen ? "</section>" : "";
      this.inlineOptimizationOpen = false;
      return `${this.closeAnalysisGrid()}${inlineEnd}</div></section>`;
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
    if (this.section === "summary" && token.depth === 1 && token.text.trim() === "TA Engineering Analysis Report") {
      return "<h1>TA ENGINEERING ANALYSIS REPORT - TA ASSIST AGENT DRAFT</h1>\n";
    }
    const worksheetMatch = token.depth === 1 ? /^3-(\d+)\s+(?:Worksheet|工作表):/iu.exec(token.text.trim()) : null;
    if (worksheetMatch !== null) {
      const closePrevious = this.closeCurrentSection();
      this.section = "worksheet";
      this.pendingOptimizationSection = undefined;
      return `${closePrevious}<section class="worksheet-section slide slide-worksheet" id="worksheet-${worksheetMatch[1]}"><div class="worksheet-fit"><h1>${content}</h1><aside class="report-stage-legend" aria-label="Report content stages"><span class="stage-key stage-key--raw">Raw data</span><span class="stage-key stage-key--interpretation">Interpretation</span><span class="stage-key stage-key--optimization">Optimization</span></aside>\n`;
    }
    const optimizationSection = this.pendingOptimizationSection;
    const optimizationHeading = token.depth === 2
      && /^Optimization Comparison(?: \(Continued\))?$/u.test(token.text.trim())
      && optimizationSection !== undefined;
    if (optimizationHeading) {
      this.pendingOptimizationSection = undefined;
      const previousInlineEnd = this.inlineOptimizationOpen ? "</section>" : "";
      this.inlineOptimizationOpen = true;
      return `${this.closeAnalysisGrid()}${previousInlineEnd}<section class="optimization-inline optimization-inline--${optimizationSection}"><h2>${content}</h2>\n`;
    }
    const panelTypes = new Map([
      ["Process and Requirements", "process"],
      ["Tolerance Path Image", "image"],
      ["公差路径图片", "image"],
      ["Requirements and Statistical Results", "results"],
      ["要求与统计结果", "results"],
      ["Adjusted Mean to Spec Center Shift", "center"],
      ["Contributor Priorities", "contributors"],
      ["贡献因子优先级", "contributors"],
      ["Specification Changes", "specifications"],
      ["规格变更建议", "specifications"],
    ]);
    const panelType = token.depth === 2 ? panelTypes.get(token.text.trim()) : undefined;
    if (token.depth === 2 && ["Complete Factor Table", "完整 Factor 表"].includes(token.text.trim())) return "";
    if (panelType === undefined) return `<h${token.depth}>${content}</h${token.depth}>\n`;
    const gridStart = this.analysisGridOpen ? "" : '<section class="analysis-grid">';
    const previousPanelEnd = this.analysisPanelOpen ? "</article>" : "";
    this.analysisGridOpen = true;
    this.analysisPanelOpen = true;
    this.analysisPanelType = panelType;
    const stepLabels = new Map([
      ["center", "Step 1"],
      ["contributors", "Step 2"],
      ["specifications", "Step 3"],
    ]);
    const stepLabel = stepLabels.get(panelType);
    const heading = stepLabel === undefined ? content : `${content}<span class="step-label">${stepLabel}</span>`;
    return `${gridStart}${previousPanelEnd}<article class="analysis-panel analysis-panel--${panelType}"><h2>${heading}</h2>\n`;
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
    if (this.analysisPanelType === "specifications") return specificationGuidance(items);
    if (this.analysisPanelType === "results") {
      return `<p class="system-summary">${items.map(escapeHtml).join(" · ")}</p>`;
    }
    return super.list(token);
  }

  override paragraph(token: Tokens.Paragraph): string {
    const content = this.parser.parseInline(token.tokens);
    if (/^<figure class="stack-image">/u.test(content)) return `${content}\n`;
    return `<p>${content}</p>\n`;
  }

  override table(token: Tokens.Table): string {
    const headers = token.header.map(cellText);
    if (headers.length === 2 && headers[0] === "Field" && headers[1] === "Value" && !this.analysisGridOpen) {
      return super.table(token).replace("<table>", '<table class="document-overview">');
    }
    if (exactHeadersMatch(headers, ["Result", "Worksheet", "Tolerance Loop Description", "Key Finding"])) {
      const headerCells = token.header.map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`).join("");
      const rows = token.rows.map((row) => {
        const cells = row.map((cell, index) => {
          if (index !== 0) return `<td>${this.parser.parseInline(cell.tokens)}</td>`;
          const comment = cellText(cell);
          const status = comment.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
          const displayComment = status === "fail" ? "CPK FAIL" : comment;
          return `<td><span class="comment comment--${status}">${escapeHtml(displayComment)}</span></td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table class="workbook-summary"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (headers.length === 2 && headers[0] === "Requirement" && headers[1] === "Value") {
      for (const row of token.rows) this.requirements.set(cellText(row[0]!), cellText(row[1]!));
      return "";
    }
    if (this.inOptimizationSection() || this.inlineOptimizationOpen) {
      if (headers.length === 3 && headers[0] === "Metric" && headers[1] === "Raw Data" && headers[2] === "Optimized Data") {
        return super.table(token).replace("<table>", '<table class="optimization-table optimization-table--system">');
      }
      if (headers.length === 4 && headers[0] === "Step" && headers[1] === "Status" && headers[2] === "Action" && headers[3] === "Result") {
        return super.table(token).replace("<table>", '<table class="optimization-table optimization-table--path">');
      }
      if (headers.length === 7 && headers[0] === "Factor" && headers[1] === "Table / Row" && headers[6] === "Changed By") {
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
    if (exactHeadersMatch(headers, ["Check", "Status", "Assessment"])) {
      const headerCells = token.header.map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`).join("");
      const rows = token.rows.map((row) => {
        const cells = row.map((cell, index) => {
          if (index !== 1) return `<td>${this.parser.parseInline(cell.tokens)}</td>`;
          const status = cellText(cell).trim().toUpperCase();
          const semanticClass = status === "MISSING"
            ? "status-missing"
            : status === "WARNING"
              ? "status-warning"
              : status === "COMPLETE"
                ? "status-complete"
                : "";
          return semanticClass === ""
            ? `<td>${this.parser.parseInline(cell.tokens)}</td>`
            : `<td class="${semanticClass}"><strong class="${semanticClass}">${escapeHtml(status)}</strong></td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table class="analysis-table process-check-table"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (exactHeadersMatch(headers, COMPLETE_FACTOR_TABLE_HEADERS)) {
      if (token.rows.length > 10) {
        throw new Error("F6 PDF fixed slide supports at most 10 Factors per worksheet.");
      }
      const headerCells = token.header.map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`).join("");
      const rows = token.rows.map((row) => {
        const marker = requiredMissingMarker(row[1]!);
        const rowClass = marker === undefined ? "" : ' class="missing"';
        const cells = row.map((cell, index) => {
          if (index !== 1 || marker === undefined) return `<td>${factorTableCellHtml(headers, cell, index, (tokens) => this.parser.parseInline(tokens))}</td>`;
          const before = this.parser.parseInline(cell.tokens.slice(0, marker.index));
          const after = this.parser.parseInline(cell.tokens.slice(marker.index + 2));
          return `<td>${before}<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="${marker.sourceRow}" hidden="" aria-hidden="true"></span>${after}</td>`;
        }).join("");
        return `<tr${rowClass}>${cells}</tr>`;
      }).join("");
      const densityClass = token.rows.length > 7 ? " factor-table--dense" : "";
      return `<table class="factor-table factor-table--complete${densityClass}" data-factor-count="${token.rows.length}"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
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
  :root { --p-black:#000000; --p-white:#FFFFFF; --p-gray-242:#F2F2F2; --p-gray-210:#D2D2D2; --p-gray-80:#505050; --p-orange:#FF9349; --p-yellow:#FEF000; --p-green:#9BF00B; --p-aqua:#30E5D0; --p-cyan:#50E6FF; --p-purple:#D59DFF; --p-dark-red:#A72929; --raw-data:#0078D4; --interpretation:#50E6FF; --optimization:#D59DFF; --ink:var(--p-black); --muted:var(--p-gray-80); --line:var(--p-gray-210); --paper:var(--p-white); --wash:var(--p-gray-242); --blue:var(--p-cyan); --pass:var(--p-green); --warn:var(--p-orange); --fail:var(--p-dark-red); --signal-red:var(--p-dark-red); --signal-green:var(--p-green); }
  * { box-sizing:border-box; }
  @page { size:A4 landscape; margin:10mm 8mm 12mm; }
  html { background:var(--wash); color:var(--ink); font-family:"Segoe UI", Arial, sans-serif; font-size:10pt; line-height:1.25; font-variant-numeric:tabular-nums; }
  body { margin:0 auto; max-width:281mm; background:var(--paper); }
  .report-content { padding:4mm; }
  .report-content>h1 { font-size:20pt; margin:0 0 3mm; padding-bottom:2mm; border-bottom:2px solid var(--blue); }
  .report-content>h2 { margin:2.5mm 0 1mm; font-size:11pt; }
  .document-overview,.workbook-summary { table-layout:fixed; margin:0 0 2mm; font-size:9pt; }
  .document-overview th:first-child,.document-overview td:first-child { width:34%; }
  .workbook-summary th:nth-child(1),.workbook-summary td:nth-child(1) { width:9%; text-align:center; }
  .workbook-summary th:nth-child(2),.workbook-summary td:nth-child(2) { width:21%; }
  .workbook-summary th:nth-child(3),.workbook-summary td:nth-child(3) { width:25%; }
  .workbook-summary th:nth-child(4),.workbook-summary td:nth-child(4) { width:45%; }
  .worksheet-section { margin:0 0 6mm; break-before:page; page-break-before:always; }
  .worksheet-fit { width:100%; padding:0; }
  h1 { margin:0 0 1.5mm; padding:0 0 1mm; border-bottom:2px solid var(--blue); font-size:20pt; font-weight:650; letter-spacing:0; }
  h2 { margin:0 0 1mm; color:var(--p-black); font-size:13pt; font-weight:650; letter-spacing:0; break-after:avoid; }
  .worksheet-section h2 { font-size:10pt; }
  h3 { margin:1mm 0 .5mm; font-size:12pt; break-after:avoid; }
  p, li { margin:.7mm 0; color:var(--p-gray-80); }
  table { width:100%; margin:1mm 0 1.5mm; border-collapse:collapse; font-size:10pt; break-inside:auto; }
  thead { display:table-header-group; } tr { break-inside:avoid; }
  th { padding:1.2mm 1mm; background:var(--p-black); color:var(--p-white); text-align:left; font-weight:600; }
  td { padding:1mm; border-bottom:1px solid var(--line); vertical-align:top; } tbody tr:nth-child(even) { background:var(--wash); }
  a { color:var(--p-cyan); text-decoration:underline; } .comment { font-weight:750; white-space:nowrap; } .comment--pass { color:var(--pass); } .comment--need-review { color:var(--warn); } .comment--fail { color:var(--fail); }
  .f6-inline-marker,[data-f6-marker] { display:none !important; }
  .factor-table { table-layout:fixed; }
  .factor-table td,.factor-table th { font-size:8.5pt; overflow-wrap:normal; word-break:normal; }
  .factor-table th:nth-child(1),.factor-table td:nth-child(1) { width:4%; }
  .factor-table th:nth-child(2),.factor-table td:nth-child(2) { width:17%; white-space:nowrap; }
  .factor-table th:nth-child(3),.factor-table td:nth-child(3) { width:6%; }
  .factor-table th:nth-child(4),.factor-table td:nth-child(4) { width:6%; }
  .factor-table th:nth-child(5),.factor-table td:nth-child(5) { width:6%; }
  .factor-table th:nth-child(6),.factor-table td:nth-child(6) { width:3%; }
  .factor-table th:nth-child(7),.factor-table td:nth-child(7) { width:6%; text-align:right; }
  .factor-table th:nth-child(8),.factor-table td:nth-child(8) { width:6%; text-align:right; }
  .factor-table th:nth-child(9),.factor-table td:nth-child(9) { width:6%; text-align:right; }
  .factor-table th:nth-child(10),.factor-table td:nth-child(10) { width:5%; text-align:right; }
  .factor-table th:nth-child(11),.factor-table td:nth-child(11) { width:5%; text-align:right; }
  .factor-table th:nth-child(12),.factor-table td:nth-child(12) { width:6%; text-align:right; }
  .factor-table th:nth-child(13),.factor-table td:nth-child(13) { width:6%; text-align:right; }
  .factor-table th:nth-child(14),.factor-table td:nth-child(14) { width:6%; text-align:right; }
  .factor-table th:nth-child(15),.factor-table td:nth-child(15) { width:12%; }
  .factor-table th:nth-child(2),.factor-table td:nth-child(2),.factor-table th:nth-child(5),.factor-table td:nth-child(5),.factor-table th:nth-child(6),.factor-table td:nth-child(6),.factor-table th:nth-child(15),.factor-table td:nth-child(15) { overflow-wrap:anywhere; }
  .factor-table tbody tr.missing td { background:var(--p-gray-242); }
  .status-missing { color:var(--p-dark-red); font-weight:800; } .status-warning { color:var(--p-orange); font-weight:800; } .status-complete { color:var(--p-black); font-weight:800; } .dim-id-review { color:var(--p-black); background:var(--p-yellow); font-weight:800; }
  .drawing-health { display:flex; align-items:center; justify-content:space-between; gap:4mm; margin:0 0 1.5mm; padding:1.4mm 2mm; border:1px solid var(--line); background:var(--p-gray-242); } .health-copy { display:flex; align-items:baseline; gap:3mm; } .health-copy h2,.health-copy p { margin:0; } .health-copy h2 { font-size:10pt; } .health-copy p { color:var(--muted); font-size:7.5pt; } .health-measures { display:flex; gap:5mm; font-size:7.5pt; } .health-measures span { white-space:nowrap; } .health-measures strong { margin-right:1mm; color:var(--fail); font-size:11pt; }
  .analysis-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); grid-template-rows:auto auto; gap:0; align-items:stretch; border:1px solid var(--line); } .analysis-panel { min-width:0; padding:1.5mm 2mm; background:var(--paper); break-inside:avoid; } .analysis-panel+.analysis-panel { border-left:1px solid var(--line); } .analysis-panel h2 { margin-bottom:1mm; } .analysis-panel--image { display:grid; min-width:0; grid-template-columns:minmax(0,3fr) minmax(0,2fr); column-gap:3mm; grid-column:span 5; } .analysis-panel--image h2 { grid-column:1/-1; } .analysis-panel--image>.stack-image { min-width:0; grid-column:1; grid-row:2/span 3; } .analysis-panel--image>p { min-width:0; grid-column:2; margin:.5mm 0; font-size:7.5pt; line-height:1.3; } .analysis-panel--results { display:grid; grid-template-columns:1fr 1fr; gap:2mm; grid-column:span 7; } .analysis-panel--results>h2,.analysis-panel--results>.system-summary { grid-column:1/-1; } .analysis-panel--center,.analysis-panel--contributors,.analysis-panel--specifications { min-height:36mm; border-top:1px solid var(--line); } .analysis-panel--center { grid-column:span 3; } .analysis-panel--contributors { grid-column:span 6; } .analysis-panel--specifications { grid-column:span 3; }
  .stack-image { margin:0; text-align:center; break-inside:avoid; } .stack-image img { width:100%; max-height:62mm; object-fit:contain; }
  figure { margin:0; } figcaption { margin-bottom:1.2mm; color:var(--ink); font-size:8pt; font-weight:650; }
  .spec-range-graph,.capability-spectrum,.mean-offset-graph,.spec-change-graph { min-width:0; }
  .range-spec-labels { position:relative; margin:0 12% 1mm; color:var(--signal-red); font-size:6.5pt; min-height:2.4mm; } .range-spec-label { position:absolute; top:0; transform:translateX(-50%); white-space:nowrap; } .range-spec-line { position:absolute; top:-.8mm; width:1px; height:5.6mm; min-height:0; padding:0; background:var(--signal-red); font-size:0; z-index:4; transform:translateX(-50%); } .range-row { display:grid; grid-template-columns:17mm 1fr 10mm 22mm; gap:1.2mm; align-items:center; margin:1.2mm 0; font-size:7pt; } .range-row>strong { font-size:7pt; } .range-row--pass>strong { color:var(--pass); } .range-row--fail>strong { color:var(--fail); } .range-row>small { color:var(--p-black); margin:0; } .range-track,.capability-track,.offset-track,.change-track { position:relative; display:block; height:4mm; background:var(--p-gray-210); } .range-track i { position:absolute; top:.8mm; height:2.4mm; background:var(--blue); z-index:2; } .range-track em { position:absolute; top:-.8mm; width:1px; height:5.6mm; background:var(--ink); z-index:3; } .range-axis { display:flex; justify-content:space-between; color:var(--muted); font-size:6.5pt; }
  .capability-spectrum figcaption strong { color:var(--blue); } .capability-row { display:grid; grid-template-columns:12mm 1fr 14mm; gap:1mm; align-items:center; margin:1.2mm 0; font-size:7pt; } .capability-track i { display:block; height:100%; background:var(--p-gray-80); } .capability-row--pass .capability-track i { background:var(--pass); } .capability-row--fail .capability-track i { background:var(--fail); } .capability-track b { position:absolute; top:-.8mm; width:1px; height:5.6mm; background:var(--ink); } .capability-spectrum>p,.system-summary { margin:1mm 0 0; color:var(--muted); font-size:6.8pt; }
  .offset-track { margin:3mm 0 2mm; background:var(--p-gray-210); } .offset-track .mean-marker--nominal { position:absolute; left:50%; top:-1mm; width:2px; height:6mm; background:var(--signal-red); } .offset-track .mean-marker--adjusted { position:absolute; top:.5mm; width:3mm; height:3mm; background:var(--signal-green); transform:translateX(-50%) rotate(45deg); } .mean-marker>span { display:none; } .mean-value--nominal,.spec-value--current { color:var(--signal-red); font-weight:700; } .mean-value--adjusted,.spec-value--proposed { color:var(--signal-green); font-weight:700; } .mean-offset-graph p,.spec-change-graph p { margin:1mm 0 0; color:var(--muted); font-size:6.8pt; }
  .contribution-chart { margin:0; } .contribution-chart figcaption { margin-bottom:1mm; font-size:8pt; } .contribution-head,.contribution-row { display:grid; grid-template-columns:6mm minmax(25mm,1fr) 16mm minmax(24mm,.8fr) 12mm 15mm minmax(36mm,1.2fr); gap:.8mm; align-items:center; min-height:3.3mm; font-size:6.8pt; } .contribution-head { color:var(--muted); font-weight:700; } .contribution-track { height:2.4mm; overflow:hidden; background:var(--p-gray-210); } .contribution-fill { display:block; height:100%; background:var(--p-gray-80); } .contribution-row--priority .contribution-fill { background:var(--blue); } .contribution-rank,.contribution-priority { font-weight:700; } .contribution-guidance { overflow-wrap:normal; word-break:normal; }
  .spec-change-legend { display:flex; gap:3mm; margin-bottom:1mm; font-size:6.5pt; } .change-row { display:grid; grid-template-columns:10mm 1fr; gap:1mm; align-items:center; margin:2mm 0; font-size:7pt; } .change-row small { grid-column:2; color:var(--muted); } .change-track { height:2.5mm; } .change-track i,.change-track b { position:absolute; top:-.5mm; width:3.5mm; height:3.5mm; transform:translateX(-50%) rotate(45deg); } .change-track .spec-marker--current { background:var(--signal-red); } .change-track .spec-marker--proposed { background:var(--signal-green); } .spec-guidance-values,.spec-range-summary { margin:4px 0 0; font-size:11px; line-height:1.2; }
  @media print { html,body { background:var(--p-white); } body { max-width:none; } }

  :root { --st-display:"Stardos Stencil","Rockwell Extra Bold",Rockwell,serif; --st-meta:"Barlow Condensed","Arial Narrow",sans-serif; --st-body:Aptos,"Segoe UI",sans-serif; }
  @page { size:20in 11.25in; margin:0; }
  html,body { width:1920px; margin:0; background:var(--p-white); color:var(--p-black); font-family:var(--st-body); }
  main { width:1920px; }
  .slide { position:relative; display:grid; width:1920px; height:1080px; margin:0; padding:48px 64px 42px; overflow:hidden; break-after:page; page-break-after:always; background:var(--p-gray-242); }
  .slide:last-child { break-after:auto; page-break-after:auto; }
  .slide-summary { grid-template-columns:.72fr 1.28fr; grid-template-rows:64px 1fr; gap:14px 28px; }
  .slide-summary>h1 { grid-column:1/-1; align-self:start; margin:0; padding:0; border:0; color:var(--p-black); font:700 56px/.9 var(--st-display); text-transform:uppercase; letter-spacing:0; white-space:nowrap; }
  .slide-summary>h2 { display:none; }
  .document-overview,.workbook-summary { align-self:stretch; box-sizing:border-box; width:100%; margin:0; overflow:hidden; clip-path:inset(0 round 24px); border:2px solid var(--p-black); border-radius:24px; border-collapse:separate; border-spacing:0; table-layout:fixed; background:var(--p-white); font-size:22px; }
  .document-overview::before,.workbook-summary::before { display:table-caption; padding:20px 26px; background:var(--p-white); color:var(--p-black); content:"Document Overview"; font:700 26px/1 var(--st-display); text-align:center; text-transform:uppercase; }
  .workbook-summary::before { content:"Workbook Summary"; background:var(--p-white); color:var(--p-black); }
  .document-overview th,.workbook-summary th { padding:14px 20px; border:0; border-bottom:2px solid var(--p-black); background:var(--p-black); color:var(--p-white); font:800 18px/1 var(--st-meta); letter-spacing:.04em; text-transform:uppercase; }
  .document-overview td,.workbook-summary td { padding:9px 16px; border:0; border-bottom:1px solid rgba(0,0,0,.22); color:var(--p-black); font-size:17px; }
  .workbook-summary { align-self:start; }
  .workbook-summary td { white-space:nowrap; font-size:12px; line-height:1; }
  .workbook-summary td:nth-child(1) { white-space:nowrap; }
  .workbook-summary td:nth-child(2) a { color:var(--raw-data); font-weight:700; }
  .workbook-summary .comment { display:inline-block; padding:3px 6px; border-radius:999px; background:var(--p-gray-210); color:var(--p-black); font:800 12px/1 var(--st-meta); text-transform:uppercase; }
  .workbook-summary .comment--fail { color:var(--p-dark-red) !important; }
  .slide-worksheet { display:flex; flex-direction:column; gap:18px; border:0; }
  .slide-worksheet>.worksheet-fit { position:relative; display:grid; min-height:0; flex:1; grid-template-columns:1fr; grid-template-rows:64px 330px 1fr; gap:10px; }
  .slide-worksheet>.worksheet-fit>h1 { margin:0; padding:0; border:0; color:var(--p-black); font:700 58px/.95 var(--st-display); text-transform:uppercase; }
  .report-stage-legend { position:absolute; top:0; right:0; display:flex; gap:16px; align-items:center; font:700 14px/1 var(--st-meta); text-transform:uppercase; }
  .stage-key { display:inline-flex; align-items:center; gap:7px; white-space:nowrap; } .stage-key::before { width:28px; height:7px; content:""; } .stage-key--raw::before { background:var(--raw-data); } .stage-key--interpretation::before { background:var(--interpretation); } .stage-key--optimization::before { background:var(--optimization); }
  .slide-optimization { display:flex; flex-direction:column; border:0; }
  .slide-optimization>.optimization-fit { display:grid; min-height:0; flex:1; grid-template-columns:1fr; grid-template-rows:64px 1fr; gap:10px; }
  .slide-optimization>.optimization-fit>h1 { margin:0; padding:0; border:0; color:var(--p-black); font:700 54px/.95 var(--st-display); text-transform:uppercase; }
  .optimization-grid { display:grid; min-height:0; grid-template-columns:1fr 1fr; grid-template-rows:220px 1fr 1fr; gap:12px; }
  .optimization-decision { min-height:0; padding:18px 20px; border-radius:22px; background:var(--p-white); }
  .optimization-decision h2 { margin:0 0 8px; color:var(--p-black); font:700 24px/1 var(--st-display); text-transform:uppercase; }
  .optimization-decision ul,.optimization-decision ol { margin:0; padding-left:20px; font-size:16px; line-height:1.25; }
  .optimization-decision li { margin:4px 0; color:var(--p-black); }
  .optimization-table { width:100%; margin:0; table-layout:fixed; overflow:hidden; border:2px solid var(--p-black); border-radius:20px; border-collapse:separate; border-spacing:0; background:var(--p-white); }
  .optimization-table th { padding:10px 11px; border:0; border-bottom:2px solid var(--p-black); background:var(--p-black); color:var(--p-white); font:800 15px/1 var(--st-meta); letter-spacing:.03em; text-transform:uppercase; }
  .optimization-table td { padding:8px 10px; border:0; border-bottom:1px solid rgba(0,0,0,.22); color:var(--p-black); font-size:14px; line-height:1.2; }
  .optimization-table--system { grid-column:1; grid-row:2/span 2; }
  .optimization-table--path { grid-column:2; grid-row:1/span 2; }
  .optimization-table--path td { overflow-wrap:anywhere; word-break:break-word; }
  .optimization-table--path th:nth-child(1),.optimization-table--path td:nth-child(1) { width:24%; }
  .optimization-table--path th:nth-child(2),.optimization-table--path td:nth-child(2) { width:24%; }
  .optimization-table--path th:nth-child(3),.optimization-table--path td:nth-child(3) { width:32%; }
  .optimization-table--path th:nth-child(4),.optimization-table--path td:nth-child(4) { width:20%; }
  .optimization-table--factors { grid-column:1/span 2; grid-row:3; }
  .optimization-table--factors th,.optimization-table--factors td { padding:6px 7px; font-size:11px; overflow-wrap:anywhere; }
  .optimization-table--factors th:nth-child(1),.optimization-table--factors td:nth-child(1) { width:13%; }
  .optimization-table--factors th:nth-child(2),.optimization-table--factors td:nth-child(2) { width:9%; }
  .optimization-table--factors th:nth-child(3),.optimization-table--factors td:nth-child(3) { width:16%; }
  .optimization-table--factors th:nth-child(4),.optimization-table--factors td:nth-child(4) { width:25%; }
  .optimization-table--factors th:nth-child(5),.optimization-table--factors td:nth-child(5) { width:13%; }
  .optimization-table--factors th:nth-child(6),.optimization-table--factors td:nth-child(6) { width:15%; }
  .optimization-table--factors th:nth-child(7),.optimization-table--factors td:nth-child(7) { width:9%; }
  .slide-optimization-continuation .optimization-table--factors { grid-row:2/span 2; }
  .slide-optimization-continuation .optimization-table--path { grid-row:1; }
  .slide-optimization-continuation .optimization-table--system { grid-row:1; }
  .factor-table { height:330px; margin:0; overflow:hidden; border:2px solid var(--p-black); border-radius:22px; border-collapse:separate; border-spacing:0; table-layout:fixed; background:var(--p-white); }
  .factor-table th { padding:10px 9px; border:0; border-bottom:2px solid var(--p-black); background:var(--p-black); color:var(--p-white); font:800 15px/1 var(--st-meta); letter-spacing:.03em; text-transform:uppercase; }
  .factor-table td { padding:5px 7px; border:0; border-bottom:1px solid rgba(0,0,0,.2); color:var(--p-black); font-size:13px; line-height:1.05; }
  .factor-table--dense th { padding:7px 6px; font-size:14px; }
  .factor-table--dense td { padding:5px 6px; font-size:13px; line-height:1.05; }
  .factor-table--dense th:nth-child(1),.factor-table--dense td:nth-child(1) { width:3.5%; }
  .factor-table--dense th:nth-child(2),.factor-table--dense td:nth-child(2) { width:20%; white-space:nowrap; }
  .factor-table--dense th:nth-child(3),.factor-table--dense td:nth-child(3),.factor-table--dense th:nth-child(4),.factor-table--dense td:nth-child(4) { width:5.5%; }
  .factor-table--dense th:nth-child(5),.factor-table--dense td:nth-child(5) { width:7%; }
  .factor-table--dense th:nth-child(6),.factor-table--dense td:nth-child(6) { width:3.5%; }
  .factor-table--dense th:nth-child(7),.factor-table--dense td:nth-child(7),.factor-table--dense th:nth-child(8),.factor-table--dense td:nth-child(8),.factor-table--dense th:nth-child(9),.factor-table--dense td:nth-child(9),.factor-table--dense th:nth-child(12),.factor-table--dense td:nth-child(12),.factor-table--dense th:nth-child(13),.factor-table--dense td:nth-child(13),.factor-table--dense th:nth-child(14),.factor-table--dense td:nth-child(14) { width:5.5%; }
  .factor-table--dense th:nth-child(10),.factor-table--dense td:nth-child(10) { width:5%; }
  .factor-table--dense th:nth-child(11),.factor-table--dense td:nth-child(11) { width:4.5%; }
  .factor-table--dense th:nth-child(15),.factor-table--dense td:nth-child(15) { width:12.5%; }
  .factor-table tbody tr.missing td { background:transparent; }
  .factor-table tbody tr.missing td:nth-child(5) { color:var(--p-dark-red); font-weight:700; }
  .guidance { display:inline-block; padding-left:8px; border-left:3px solid rgba(0,0,0,.38); }
  .guidance--pass { border-color:var(--p-green); color:var(--p-black); }
  .guidance--review { border-color:var(--p-orange); }
  .analysis-grid { display:grid; min-height:0; grid-template-columns:.72fr 1.15fr .95fr; grid-template-rows:1fr 220px; gap:12px; border:0; }
  .analysis-panel { min-width:0; min-height:0; padding:20px 22px; overflow:hidden; border:0; border-radius:22px; break-inside:avoid; color:var(--p-black); }
  .analysis-panel+.analysis-panel { border-left:0; }
  .analysis-panel h2 { margin:0 0 12px; color:inherit; font:700 28px/1 var(--st-display); text-transform:uppercase; }
  .analysis-panel--process { grid-column:1; grid-row:1; background:var(--p-white); }
  .process-check-table { margin:0; table-layout:fixed; font-size:11px; line-height:1.1; }
  .process-check-table th,.process-check-table td { padding:4px 5px; }
  .process-check-table th:nth-child(1),.process-check-table td:nth-child(1) { width:31%; }
  .process-check-table th:nth-child(2),.process-check-table td:nth-child(2) { width:22%; }
  .process-check-table th:nth-child(3),.process-check-table td:nth-child(3) { width:47%; }
  .analysis-panel--process ul { margin:0; padding-left:20px; font-size:14px; line-height:1.25; }
  .analysis-panel--process li { margin:6px 0; color:var(--p-black); }
  .analysis-panel--image { display:grid; min-width:0; grid-template-columns:minmax(0,3fr) minmax(0,2fr); column-gap:18px; grid-column:2; grid-row:1; background:var(--p-white); }
  .analysis-panel--results { display:block; grid-column:3; grid-row:1; background:var(--p-white); }
  .analysis-panel--center,.analysis-panel--contributors,.analysis-panel--specifications { height:220px; min-height:0; align-self:stretch; box-sizing:border-box; }
  .analysis-panel--center { grid-column:1; grid-row:2; border:0; background:var(--p-white); color:var(--p-black); }
  .analysis-panel--contributors { grid-column:2; grid-row:2; border:0; background:var(--p-white); color:var(--p-black); }
  .analysis-panel--specifications { grid-column:3; grid-row:2; border:0; background:var(--p-white); color:var(--p-black); }
  .analysis-panel--process>h2,.analysis-panel--image>h2,.analysis-panel--results>h2 { color:var(--interpretation); }
  .analysis-panel--center>h2,.analysis-panel--contributors>h2,.analysis-panel--specifications>h2 { color:var(--optimization); }
  .step-label { display:inline-block; margin-left:10px; color:var(--p-black); font:800 13px/1 var(--st-meta); vertical-align:middle; }
  .analysis-panel--center,.analysis-panel--contributors { position:relative; overflow:visible; }
  .analysis-panel--center::after,.analysis-panel--contributors::after { content:"→"; position:absolute; top:50%; right:-20px; z-index:5; color:var(--optimization); font:800 26px/1 var(--st-meta); transform:translateY(-50%); }
  .analysis-panel--contributors:last-child::after { display:none; }
  .analysis-panel--image>h2 { grid-column:1/-1; }
  .analysis-panel--image>.stack-image { display:block; min-width:0; grid-column:1; grid-row:2/span 4; width:100%; margin:0; }
  .analysis-panel--image .stack-image img { width:100%; height:248px; max-height:248px; object-fit:contain; }
  .analysis-panel--image>p { min-width:0; grid-column:2; margin:7px 0; color:var(--p-black); font-size:15px; line-height:1.28; }
  .analysis-panel--results .spec-range-graph,.analysis-panel--results .capability-spectrum { width:49%; }
  .analysis-panel--results .spec-range-graph { float:left; }
  .analysis-panel--results .capability-spectrum { float:right; }
  .analysis-panel figcaption { margin-bottom:12px; color:inherit; font:800 17px/1 var(--st-meta); letter-spacing:.05em; text-transform:uppercase; }
  .range-spec-labels { margin:0 54px 4px 70px; font-size:11px; }
  .range-spec-label--lower { left:0; transform:none; }
  .range-spec-label--upper { right:0; left:auto; transform:none; }
  .range-row { grid-template-columns:62px 1fr 42px; min-height:39px; margin:0; gap:8px; font-size:12px; }
  .range-row>small { display:block; grid-column:2; margin:0; font-size:9px; line-height:1; color:var(--p-black); }
  .range-axis { font-size:12px; }
  .capability-row { grid-template-columns:38px 1fr 45px; min-height:28px; margin:0; gap:8px; font-size:12px; }
  .capability-spectrum figcaption span,.capability-spectrum figcaption strong { display:block; }
  .capability-spectrum figcaption strong { margin-top:5px; }
  .capability-row>strong,.range-row>strong { color:var(--p-black); }
  .analysis-panel--center .mean-offset-graph p { color:var(--p-black); font-size:11px; }
  .analysis-panel--center .offset-track { margin-top:34px; background:rgba(242,242,242,.55); }
  .analysis-panel--contributors .contribution-chart { display:grid; margin:0; grid-template-columns:1fr; }
  .analysis-panel--center h2,.analysis-panel--contributors h2,.analysis-panel--specifications h2 { margin-bottom:6px; font-size:22px; }
  .analysis-panel--contributors figcaption,.analysis-panel--specifications figcaption { display:none; }
  .analysis-panel--contributors { padding:10px 22px; }
  .analysis-panel--contributors .contribution-head,.analysis-panel--contributors .contribution-row { grid-template-columns:30px minmax(145px,1fr) 84px minmax(90px,1fr) 54px 68px minmax(100px,1fr); min-height:14px; padding:0; color:var(--p-black); font-size:10px; line-height:1; }
  .analysis-panel--contributors .contribution-track { background:rgba(242,242,242,.5); }
  .analysis-panel--contributors .contribution-fill { background:var(--p-yellow); }
  .analysis-panel--contributors>p { margin:4px 0 0; color:var(--p-black); font-size:11px; line-height:1.15; }
  .analysis-panel--specifications .change-row { margin:0 0 6px; }
  .analysis-panel--specifications .change-track { background:rgba(242,242,242,.5); }
  .analysis-panel--specifications .change-track .spec-marker--current { background:var(--signal-red); }
  .analysis-panel--specifications .change-track .spec-marker--proposed { background:var(--signal-green); }
  .analysis-panel--specifications .spec-change-graph p,.analysis-panel--specifications .change-row small { color:var(--p-black); }
  .analysis-panel--specifications .spec-value--current { color:var(--p-dark-red); }
  .analysis-panel--specifications .spec-value--proposed { color:var(--p-green); }
  .analysis-panel--specifications .spec-range-summary,.analysis-panel--specifications .spec-guidance-values { color:var(--p-black); }
  .analysis-panel--specifications .spec-change-graph p { margin:4px 0 0; font-size:11px; }
  .optimization-inline { display:grid; grid-template-columns:1fr 1fr; gap:8px; min-height:0; overflow:hidden; }
  .optimization-inline>h2 { grid-column:1/-1; margin:0; font:700 18px/1 var(--st-display); text-transform:uppercase; }
  .optimization-inline .optimization-table { font-size:10px; }
  th { background:var(--raw-data) !important; color:var(--p-white); }
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