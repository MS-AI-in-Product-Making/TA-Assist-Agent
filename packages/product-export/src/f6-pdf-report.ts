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

const OMITTED_FACTOR_HEADERS = new Set(["Row", "Notes"]);
const ENGINEERING_FACTOR_HEADERS = new Set([
  "Design Nominal",
  "+ Tolerance",
  "- Tolerance",
  "Mean",
  "Tolerance",
  "One Sigma",
]);

function fixedFactorValue(header: string, value: string): string {
  if (!ENGINEERING_FACTOR_HEADERS.has(header)) return value;
  return value.replace(/^-?\d+(?:\.\d+)?(?=\s|$)/u, (number) => Number(number).toFixed(3));
}

function factorGuidance(value: string): string {
  const normalized = value.replaceAll("\\", "").toLowerCase();
  if (normalized.includes("missing_process_context") || normalized.includes("missing process context")) {
    return "Missing process context";
  }
  const recommendation = /recommended tolerance band or range:\s*(?:&lt;=|<=)\s*([-+]?\d+(?:\.\d+)?)\s*([^;\s]+)/iu.exec(value);
  if (recommendation !== null) {
    return `Knowledge library: Recommended tolerance band or range: <= ${recommendation[1]} ${recommendation[2]}`;
  }
  if (normalized.includes("non_f0_process_category") || normalized.includes("no process category")) {
    return "No process category";
  }
  return value;
}

class F6PdfRenderer extends Renderer {
  private worksheetSectionOpen = false;
  private analysisGridOpen = false;
  private analysisPanelOpen = false;
  private analysisPanelType: string | undefined;

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
    if (headers.length === 3 && headers[0] === "Capability Metric" && headers[1] === "Value" && headers[2] === "Result") {
      const cards = token.rows.map((row) => {
        const [metric, value, result] = row.map(cellText);
        const status = result?.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") || "neutral";
        return `<article class="metric-card metric-card--${status}"><span>${escapeHtml(metric ?? "")}</span><strong>${escapeHtml(value ?? "")}</strong><small>${escapeHtml(result ?? "")}</small></article>`;
      }).join("");
      return `<section class="metric-dashboard">${cards}</section>`;
    }
    if (headers.length >= 10 && headers.includes("Ordinal") && headers.includes("Factor Description")) {
      const visibleColumns = headers.flatMap((header, index) => OMITTED_FACTOR_HEADERS.has(header) ? [] : [{ header, index }]);
      const headerCells = visibleColumns.map(({ header }) => `<th>${escapeHtml(header)}</th>`).join("");
      const rows = token.rows.map((row) => {
        const cells = visibleColumns.map(({ header, index }) => {
          const rawValue = cellText(row[index]!);
          const value = header === "Capability and Knowledge Guidance"
            ? factorGuidance(rawValue)
            : fixedFactorValue(header, rawValue);
          const isAlert = (header === "Drawing Number" && rawValue.toUpperCase() === "MISSING")
            || (header === "DIM ID" && (rawValue.toUpperCase() === "MISSING" || /^\d$/u.test(rawValue)));
          const displayValue = isAlert
            ? `<span class="field-alert">${escapeHtml(value)}</span>`
            : escapeHtml(value);
          return `<td>${displayValue}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table class="factor-table"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
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
  .worksheet-section { width:306mm; height:166mm; font-size:13pt; overflow:hidden; break-before:page; break-after:page; }
  .worksheet-fit { width:100%; padding:1mm; transform-origin:top left; }
  h1 { margin:0 0 1.5mm; padding:0 0 1mm; border-bottom:2px solid var(--blue); font-size:20pt; font-weight:650; letter-spacing:0; }
  h2 { margin:0 0 1mm; color:#1e293b; font-size:13pt; font-weight:650; letter-spacing:0; break-after:avoid; }
  .worksheet-section h2 { font-size:10pt; }
  h3 { margin:1mm 0 .5mm; font-size:12pt; break-after:avoid; }
  p, li { margin:.7mm 0; color:#334155; }
  table { width:100%; margin:1mm 0 1.5mm; border-collapse:collapse; font-size:10pt; break-inside:auto; }
  thead { display:table-header-group; } tr { break-inside:avoid; }
  th { padding:1.2mm 1mm; background:#1e293b; color:#fff; text-align:left; font-weight:600; }
  td { padding:1mm; border-bottom:1px solid var(--line); vertical-align:top; } tbody tr:nth-child(even) { background:var(--wash); }
  a { color:#0067b8; text-decoration:underline; } .comment { font-weight:750; white-space:nowrap; } .comment--pass { color:var(--pass); } .comment--need-review { color:var(--warn); } .comment--fail { color:var(--fail); } .field-alert { color:var(--fail); font-weight:700; }
  .analysis-grid { font-size:8pt; display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); grid-template-rows:auto auto; gap:0; align-items:stretch; margin-top:1.5mm; border-top:1px solid var(--line); border-bottom:1px solid var(--line); } .analysis-grid table { font-size:8pt; } .analysis-panel { min-width:0; padding:1mm 1.5mm; border-top:0; background:transparent; break-inside:avoid; } .analysis-panel+.analysis-panel { border-left:1px solid var(--line); } .analysis-panel--image { display:grid; grid-template-columns:84mm minmax(0,1fr); column-gap:2.5mm; grid-column:span 6; } .analysis-panel--image h2 { grid-column:1/-1; } .analysis-panel--image>.stack-image { grid-column:1; grid-row:2/span 3; } .analysis-panel--image>p { grid-column:2; } .analysis-panel--results { grid-column:span 6; } .analysis-panel--results .metric-dashboard { border-top:1px solid var(--line); } .analysis-panel--center,.analysis-panel--contributors,.analysis-panel--specifications { min-height:36mm; border-top:1px solid var(--line); } .analysis-panel--center { grid-column:span 3; } .analysis-panel--contributors { grid-column:span 6; } .analysis-panel--specifications { grid-column:span 3; }
  .stack-image { margin:.5mm 0 1mm; text-align:center; break-inside:avoid; } .stack-image img { max-width:84mm; max-height:84mm; object-fit:contain; }
  .result-table { display:inline-table; width:auto; max-width:72mm; margin:0 1.5mm 1mm 0; font-size:8pt; } .result-table th,.result-table td { padding:.6mm; }
  .metric-dashboard { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1mm; margin:1mm 0; break-inside:avoid; }
  .metric-card { min-height:11mm; padding:.8mm; border-top:1px solid var(--line); background:transparent; } .metric-card>span,.metric-card>strong,.metric-card>small { font-size:8pt; } .metric-card>span { display:block; min-height:3mm; color:var(--muted); font-weight:600; } .metric-card>strong { display:block; margin:.3mm 0; } .metric-card>small { color:var(--muted); font-weight:700; }
  .metric-card--pass { border-color:var(--pass); } .metric-card--warning,.metric-card--review { border-color:var(--warn); } .metric-card--fail { border-color:var(--fail); }
  .factor-table { table-layout:fixed; line-height:1.05; break-inside:avoid; } .factor-table th,.factor-table td { text-align:center; font-size:7.5pt; padding:.55mm .4mm; overflow-wrap:anywhere; vertical-align:middle; } .factor-table td:nth-child(n+7):nth-child(-n+16) { white-space:nowrap; } .factor-table th:nth-child(1),.factor-table td:nth-child(1) { width:3.5%; } .factor-table th:nth-child(2),.factor-table td:nth-child(2) { width:8%; } .factor-table th:nth-child(3),.factor-table td:nth-child(3) { width:6%; } .factor-table th:nth-child(4),.factor-table td:nth-child(4) { width:5%; } .factor-table th:nth-child(5),.factor-table td:nth-child(5) { width:4%; } .factor-table th:nth-child(6),.factor-table td:nth-child(6) { width:5.5%; } .factor-table th:nth-child(17),.factor-table td:nth-child(17) { width:18%; }
  .contribution-chart { max-width:190mm; margin:.5mm 0; padding:0; background:transparent; break-inside:avoid; } .contribution-chart figcaption { margin-bottom:.5mm; font-size:8pt; font-weight:650; } .contribution-head,.contribution-row { display:grid; grid-template-columns:7mm minmax(28mm,1fr) 20mm minmax(28mm,.8fr) 14mm 18mm minmax(50mm,1.4fr); gap:1mm; align-items:center; min-height:3.5mm; font-size:8pt; } .contribution-head { color:var(--muted); font-weight:700; } .contribution-track { height:2.5mm; max-width:42mm; overflow:hidden; background:#dbe4ee; } .contribution-fill { display:block; height:100%; background:#64748b; } .contribution-row--priority .contribution-fill { background:var(--blue); } .contribution-rank,.contribution-priority { font-weight:700; } .contribution-guidance { overflow-wrap:anywhere; }
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