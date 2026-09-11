import { marked, Renderer, type Tokens } from "marked";

export interface F6PdfHtmlInput {
  readonly markdown: string;
  readonly sourceHash: string;
  readonly baseHref?: string;
  readonly inlineImages?: ReadonlyMap<string, string>;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function cellText(cell: Tokens.TableCell): string {
  return cell.text.replace(/<[^>]*>/g, "").trim();
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
  return `<figure class="spec-range-graph" data-statistical-result="${ranges[0]?.result.display ?? "N/A"}" data-worst-case-result="${ranges[1]?.result.display ?? "N/A"}"><figcaption>Specification range</figcaption>${rangeRows}<div class="range-axis"><span>${minimum.toFixed(3)}</span><span>Nominal ${nominal.toFixed(3)}</span><span>${maximum.toFixed(3)}</span></div></figure>`;
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
  const bars = entries.map(({ label, value, result }) => `<div class="capability-row capability-row--${result.className}"><span>${escapeHtml(label.replace("Predictive ", ""))}</span><span class="capability-track"><i style="width:${Math.max(0, Math.min(100, (value / maximum) * 100))}%"></i><b style="left:${Math.min(100, (target / maximum) * 100)}%"></b></span><strong>${value.toFixed(3)}</strong></div>`).join("");
  const yieldRow = rows.find((row) => cellText(row[0]!) === "Predicted Yield");
  const dpmRow = rows.find((row) => cellText(row[0]!) === "Predicted DPM");
  return `<figure class="capability-spectrum" data-target-cpk="${target.toFixed(3)}"><figcaption>Capability against target <strong>${target.toFixed(3)}</strong></figcaption>${bars}<p>${yieldRow === undefined ? "" : `Yield ${escapeHtml(cellText(yieldRow[1]!))}`} ${dpmRow === undefined ? "" : `· DPM ${escapeHtml(cellText(dpmRow[1]!))}`}</p></figure>`;
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
  const graphRows = entries.map(({ side, current, proposed }) => `<div class="change-row"><span>${escapeHtml(side)}</span><span class="change-track"><i style="left:${graphPosition(current!, minimum, maximum)}%"></i><b style="left:${graphPosition(proposed!, minimum, maximum)}%"></b></span><small>${current!.toFixed(3)} → ${proposed!.toFixed(3)}</small></div>`).join("");
  return `<figure class="spec-change-graph"><figcaption>Specification proposal</figcaption>${graphRows}<p>Engineering approval required.</p></figure>`;
}

class F6PdfRenderer extends Renderer {
  private worksheetSectionOpen = false;
  private analysisGridOpen = false;
  private analysisPanelOpen = false;
  private analysisPanelType: string | undefined;
  private readonly requirements = new Map<string, string>();

  constructor(private readonly inlineImages: ReadonlyMap<string, string>) {
    super();
  }

  get hasWorksheetSection(): boolean {
    return this.worksheetSectionOpen;
  }

  finishContent(): string {
    return `${this.closeAnalysisGrid()}${this.worksheetSectionOpen ? "</div></section>" : "</section>"}`;
  }

  private closeAnalysisGrid(): string {
    if (!this.analysisGridOpen) return "";
    const closing = `${this.analysisPanelOpen ? "</article>" : ""}</section>`;
    this.analysisGridOpen = false;
    this.analysisPanelOpen = false;
    this.analysisPanelType = undefined;
    return closing;
  }

  override html(): string {
    return "";
  }

  override heading(token: Tokens.Heading): string {
    const content = this.parser.parseInline(token.tokens);
    const worksheetMatch = token.depth === 1 ? /^3-(\d+)\s+Worksheet:/i.exec(token.text.trim()) : null;
    if (worksheetMatch !== null) {
      const closePrevious = this.worksheetSectionOpen ? `${this.closeAnalysisGrid()}</div></section>` : "</section>";
      this.worksheetSectionOpen = true;
      return `${closePrevious}<section class="worksheet-section" id="worksheet-${worksheetMatch[1]}"><div class="worksheet-fit"><h1>${content}</h1>\n`;
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
      return `<figure class="stack-image"><img src="${escapeHtml(source)}" alt="${escapeHtml(token.text)}"></figure>`;
    }
    return super.link(token);
  }

  override image(token: Tokens.Image): string {
    const source = this.inlineImages.get(token.href);
    if (source === undefined) throw new Error("F6 PDF image links must be validated and inlined before rendering.");
    return `<figure class="stack-image"><img src="${escapeHtml(source)}" alt="${escapeHtml(token.text)}"></figure>`;
  }

  override list(token: Tokens.List): string {
    const items = token.items.map((item) => item.text.replace(/<[^>]*>/gu, "").trim());
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
    if (headers.length === 5 && headers[0] === "Metric" && headers[1] === "Lower" && headers[2] === "Upper") {
      return specificationRangeGraph(this.requirements, token.rows);
    }
    if (headers.length === 3 && headers[0] === "Capability Metric" && headers[1] === "Value" && headers[2] === "Result") {
      return capabilitySpectrum(this.requirements, token.rows);
    }
    if (headers.length >= 10 && headers.includes("Ordinal") && headers.includes("Factor Description")) {
      return `<p class="brief-kicker">Graph-first engineering brief</p>${drawingHealthGraph(headers, token.rows)}`;
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
    const bars = entries.map(({ rank, factor, sigma, value, priority, guidance }, index) => `<div class="contribution-row${index < 3 ? " contribution-row--priority" : ""}"><span class="contribution-rank">${escapeHtml(rank)}</span><span class="contribution-factor">${escapeHtml(factor)}</span><span class="contribution-sigma">${escapeHtml(sigma)}</span><span class="contribution-track"><span class="contribution-fill" style="width:${value}%"></span></span><strong>${value.toFixed(1)}%</strong><span class="contribution-priority">${escapeHtml(priority)}</span><span class="contribution-guidance">${escapeHtml(guidance)}</span></div>`).join("");
    return `<figure class="contribution-chart"><figcaption>Factor Contribution Pareto and Review Priorities</figcaption><div class="contribution-head"><span>Rank</span><span>Factor</span><span>One Sigma</span><span>Variance Contribution</span><span>Value</span><span>Priority</span><span>Guidance</span></div>${bars}</figure>`;
  }
}

const PRINT_CSS = `
  :root { --ink:#0f172a; --muted:#475569; --line:#cbd5e1; --paper:#fff; --wash:#f8fafc; --blue:#0078d4; --pass:#107c10; --warn:#a15c00; --fail:#d13438; }
  * { box-sizing:border-box; }
  @page { size:320mm 180mm; margin:7mm; @bottom-right { content:"TA Assist Agent  |  " counter(page) " / " counter(pages); color:#64748b; font:6pt "Segoe UI", Arial, sans-serif; } }
  html { background:var(--wash); color:var(--ink); font-family:"Segoe UI", Arial, sans-serif; font-size:10pt; line-height:1.25; font-variant-numeric:tabular-nums; }
  body { margin:0 auto; max-width:306mm; background:var(--paper); }
  .report-content { padding:4mm; }
  .report-content>h1 { font-size:20pt; margin:0 0 3mm; padding-bottom:2mm; border-bottom:2px solid var(--blue); }
  .report-content>h2 { margin:2.5mm 0 1mm; font-size:11pt; }
  .document-overview,.workbook-summary { table-layout:fixed; margin:0 0 2mm; font-size:9pt; }
  .document-overview th:first-child,.document-overview td:first-child { width:34%; }
  .workbook-summary th:nth-child(1),.workbook-summary td:nth-child(1) { width:14%; }
  .workbook-summary th:nth-child(2),.workbook-summary td:nth-child(2) { width:24%; }
  .workbook-summary th:nth-child(3),.workbook-summary td:nth-child(3) { width:52%; }
  .workbook-summary th:nth-child(4),.workbook-summary td:nth-child(4) { width:10%; text-align:center; }
  .worksheet-section { width:calc(100% + 8mm); height:174mm; margin:-4mm; overflow:hidden; break-before:page; break-after:page; }
  .worksheet-fit { width:100%; padding:1mm 1.5mm; transform-origin:top left; }
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
  .brief-kicker { margin:0 0 1mm; color:var(--muted); font-size:7pt; }
  .drawing-health { display:flex; align-items:center; justify-content:space-between; gap:4mm; margin:0 0 1.5mm; padding:1.4mm 2mm; border:1px solid var(--line); background:#f8fafc; } .health-copy { display:flex; align-items:baseline; gap:3mm; } .health-copy h2,.health-copy p { margin:0; } .health-copy h2 { font-size:10pt; } .health-copy p { color:var(--muted); font-size:7.5pt; } .health-measures { display:flex; gap:5mm; font-size:7.5pt; } .health-measures span { white-space:nowrap; } .health-measures strong { margin-right:1mm; color:var(--fail); font-size:11pt; }
  .analysis-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); grid-template-rows:auto auto; gap:0; align-items:stretch; border:1px solid var(--line); } .analysis-panel { min-width:0; padding:1.5mm 2mm; background:var(--paper); break-inside:avoid; } .analysis-panel+.analysis-panel { border-left:1px solid var(--line); } .analysis-panel h2 { margin-bottom:1mm; } .analysis-panel--image { display:grid; grid-template-columns:78mm minmax(0,1fr); column-gap:3mm; grid-column:span 5; } .analysis-panel--image h2 { grid-column:1/-1; } .analysis-panel--image>.stack-image { grid-column:1; grid-row:2/span 3; } .analysis-panel--image>p { grid-column:2; margin:.5mm 0; font-size:7.5pt; line-height:1.3; } .analysis-panel--results { display:grid; grid-template-columns:1fr 1fr; gap:2mm; grid-column:span 7; } .analysis-panel--results>h2,.analysis-panel--results>.system-summary { grid-column:1/-1; } .analysis-panel--center,.analysis-panel--contributors,.analysis-panel--specifications { min-height:36mm; border-top:1px solid var(--line); } .analysis-panel--center { grid-column:span 3; } .analysis-panel--contributors { grid-column:span 6; } .analysis-panel--specifications { grid-column:span 3; }
  .stack-image { margin:0; text-align:center; break-inside:avoid; } .stack-image img { width:78mm; max-height:62mm; object-fit:contain; }
  figure { margin:0; } figcaption { margin-bottom:1.2mm; color:var(--ink); font-size:8pt; font-weight:650; }
  .spec-range-graph,.capability-spectrum,.mean-offset-graph,.spec-change-graph { min-width:0; }
  .range-row { display:grid; grid-template-columns:17mm 1fr 10mm 22mm; gap:1.2mm; align-items:center; margin:1.2mm 0; font-size:7pt; } .range-row>strong { font-size:7pt; } .range-row--pass>strong { color:var(--pass); } .range-row--fail>strong { color:var(--fail); } .range-row>small { color:var(--muted); } .range-track,.capability-track,.offset-track,.change-track { position:relative; display:block; height:4mm; background:#e7edf3; } .range-track i { position:absolute; top:.8mm; height:2.4mm; background:var(--blue); z-index:2; } .range-track .spec-window { position:absolute; top:0; height:4mm; border:1px solid #94a3b8; background:transparent; z-index:1; } .range-track em { position:absolute; top:-.8mm; width:1px; height:5.6mm; background:var(--ink); z-index:3; } .range-axis { display:flex; justify-content:space-between; color:var(--muted); font-size:6.5pt; }
  .capability-spectrum figcaption strong { color:var(--blue); } .capability-row { display:grid; grid-template-columns:12mm 1fr 14mm; gap:1mm; align-items:center; margin:1.2mm 0; font-size:7pt; } .capability-track i { display:block; height:100%; background:#64748b; } .capability-row--pass .capability-track i { background:var(--pass); } .capability-row--fail .capability-track i { background:var(--fail); } .capability-track b { position:absolute; top:-.8mm; width:1px; height:5.6mm; background:var(--ink); } .capability-spectrum>p,.system-summary { margin:1mm 0 0; color:var(--muted); font-size:6.8pt; }
  .offset-track { margin:3mm 0 2mm; background:#e7edf3; } .offset-track i { position:absolute; left:50%; top:-1mm; width:1px; height:6mm; background:var(--ink); } .offset-track b { position:absolute; top:.5mm; width:3mm; height:3mm; background:var(--blue); transform:translateX(-50%) rotate(45deg); } .mean-offset-graph p,.spec-change-graph p { margin:1mm 0 0; color:var(--muted); font-size:6.8pt; }
  .contribution-chart { margin:0; } .contribution-chart figcaption { margin-bottom:1mm; font-size:8pt; } .contribution-head,.contribution-row { display:grid; grid-template-columns:6mm minmax(25mm,1fr) 16mm minmax(24mm,.8fr) 12mm 15mm minmax(36mm,1.2fr); gap:.8mm; align-items:center; min-height:3.3mm; font-size:6.8pt; } .contribution-head { color:var(--muted); font-weight:700; } .contribution-track { height:2.4mm; overflow:hidden; background:#dbe4ee; } .contribution-fill { display:block; height:100%; background:#64748b; } .contribution-row--priority .contribution-fill { background:var(--blue); } .contribution-rank,.contribution-priority { font-weight:700; } .contribution-guidance { overflow-wrap:anywhere; }
  .change-row { display:grid; grid-template-columns:10mm 1fr; gap:1mm; align-items:center; margin:2mm 0; font-size:7pt; } .change-row small { grid-column:2; color:var(--muted); } .change-track { height:2.5mm; } .change-track i,.change-track b { position:absolute; top:-.5mm; width:3.5mm; height:3.5mm; transform:translateX(-50%) rotate(45deg); } .change-track i { background:#64748b; } .change-track b { background:var(--blue); }
  @media print { html,body { background:#fff; } body { max-width:none; } }
`;

const FIT_SCRIPT = `<script>
  function fitWorksheetPages() {
    for (const section of document.querySelectorAll(".worksheet-section")) {
      const content = section.querySelector(".worksheet-fit");
      if (!(content instanceof HTMLElement)) continue;
      content.style.transform = "none";
      content.style.width = "100%";
      const heightScale = section.clientHeight / content.scrollHeight;
      const widthScale = section.clientWidth / content.scrollWidth;
      const scale = Math.min(1, heightScale, widthScale);
      content.style.width = (100 / scale) + "%";
      content.style.transform = "scale(" + scale + ")";
      section.dataset.fitScale = scale.toFixed(4);
    }
  }
  window.addEventListener("load", fitWorksheetPages);
  window.addEventListener("beforeprint", fitWorksheetPages);
  if (document.fonts) document.fonts.ready.then(fitWorksheetPages);
</script>`;

export function renderF6PdfHtml(input: F6PdfHtmlInput): string {
  if (!/^[a-f0-9]{64}$/.test(input.sourceHash)) throw new Error("F6 PDF source hash must be a SHA-256 digest.");
  if (input.markdown.trim().length === 0) throw new Error("F6 PDF source Markdown must not be empty.");
  const renderer = new F6PdfRenderer(input.inlineImages ?? new Map());
  const content = marked.parse(input.markdown, { async: false, renderer });
  const closingSection = renderer.finishContent();
  const base = input.baseHref === undefined ? "" : `<base href="${escapeHtml(input.baseHref)}">`;
  return `<!doctype html>\n<html lang="en" data-source-sha256="${input.sourceHash}"><head><meta charset="utf-8">${base}<meta name="color-scheme" content="light"><title>TA Engineering Analysis Report</title><style>${PRINT_CSS}</style></head><body><main><section class="report-content">${content}${closingSection}</main>${FIT_SCRIPT}</body></html>`;
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