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

class F6PdfRenderer extends Renderer {
  constructor(private readonly inlineImages: ReadonlyMap<string, string>) {
    super();
  }

  override html(): string {
    return "";
  }

  override heading(token: Tokens.Heading): string {
    const content = this.parser.parseInline(token.tokens);
    return token.depth === 1 && /^3-\d+\s+Worksheet:/i.test(token.text.trim())
      ? `</section><section class="worksheet-section"><h1>${content}</h1>\n`
      : `<h${token.depth}>${content}</h${token.depth}>\n`;
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
    if (headers.length === 3 && headers[0] === "Capability Metric" && headers[1] === "Value" && headers[2] === "Result") {
      const cards = token.rows.map((row) => {
        const [metric, value, result] = row.map(cellText);
        const status = result?.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") || "neutral";
        return `<article class="metric-card metric-card--${status}"><span>${escapeHtml(metric ?? "")}</span><strong>${escapeHtml(value ?? "")}</strong><small>${escapeHtml(result ?? "")}</small></article>`;
      }).join("");
      return `<section class="metric-dashboard">${cards}</section>`;
    }
    if (headers.length >= 10 && headers.includes("Ordinal") && headers.includes("Factor Description")) {
      const ordinalIndex = headers.indexOf("Ordinal");
      const descriptionIndex = headers.indexOf("Factor Description");
      const cards = token.rows.map((row) => {
        const values = row.map(cellText);
        const details = headers.map((header, index) => `<div class="factor-field"><dt>${escapeHtml(header)}</dt><dd>${escapeHtml(values[index] ?? "")}</dd></div>`).join("");
        return `<article class="factor-card"><header><span class="factor-ordinal">${escapeHtml(values[ordinalIndex] ?? "")}</span><h3>${escapeHtml(values[descriptionIndex] ?? "")}</h3></header><dl>${details}</dl></article>`;
      }).join("");
      return `<section class="factor-grid">${cards}</section>`;
    }
    const table = super.table(token);
    const contributionIndex = token.header.findIndex((cell) => cellText(cell) === "Variance Contribution");
    const factorIndex = token.header.findIndex((cell) => cellText(cell) === "Factor");
    if (contributionIndex < 0 || factorIndex < 0) return table;
    const entries = token.rows.flatMap((row) => {
      const value = Number.parseFloat(cellText(row[contributionIndex]!).replace("%", ""));
      return Number.isFinite(value) ? [{ factor: cellText(row[factorIndex]!), value: Math.max(0, Math.min(100, value)) }] : [];
    });
    if (entries.length === 0) return table;
    const bars = entries.map(({ factor, value }, index) => `<div class="pareto-row${index < 3 ? " pareto-row--priority" : ""}"><span class="pareto-rank">${index + 1}</span><span class="pareto-factor">${escapeHtml(factor)}</span><span class="pareto-track"><span class="pareto-fill" style="width:${value}%"></span></span><strong>${value.toFixed(1)}%</strong></div>`).join("");
    return `${table}<figure class="pareto-chart"><figcaption>Factor Contribution Pareto</figcaption>${bars}</figure>`;
  }
}

const PRINT_CSS = `
  :root { --ink:#0f172a; --muted:#475569; --line:#cbd5e1; --paper:#fff; --wash:#f8fafc; --blue:#00a4ef; --pass:#7fba00; --warn:#ffb900; --fail:#f25022; }
  * { box-sizing:border-box; }
  @page { size:A4; margin:16mm 13mm 17mm; @bottom-right { content:"TA Assist Agent  |  " counter(page) " / " counter(pages); color:#64748b; font:8pt "Segoe UI", Arial, sans-serif; } }
  html { background:var(--wash); color:var(--ink); font-family:"Segoe UI", Arial, sans-serif; font-size:10pt; line-height:1.45; }
  body { margin:0 auto; max-width:210mm; background:var(--paper); }
  .report-content, .worksheet-section { padding:4mm 2mm; }
  .worksheet-section { break-before:page; }
  h1 { margin:0 0 7mm; padding:0 0 4mm; border-bottom:3px solid var(--blue); font-size:23pt; font-weight:650; letter-spacing:0; }
  h2 { margin:8mm 0 3mm; color:#1e293b; font-size:15pt; font-weight:650; letter-spacing:0; break-after:avoid; }
  h3 { margin:6mm 0 2mm; font-size:11pt; break-after:avoid; }
  p, li { color:#334155; }
  table { width:100%; margin:3mm 0 6mm; border-collapse:collapse; font-size:8pt; break-inside:auto; }
  thead { display:table-header-group; } tr { break-inside:avoid; }
  th { padding:2.2mm 1.5mm; background:#1e293b; color:#fff; text-align:left; font-weight:600; }
  td { padding:2mm 1.5mm; border-bottom:1px solid var(--line); vertical-align:top; } tbody tr:nth-child(even) { background:var(--wash); }
  .stack-image { margin:4mm 0 7mm; text-align:center; break-inside:avoid; } .stack-image img { max-width:100%; max-height:105mm; object-fit:contain; }
  .metric-dashboard { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:3mm; margin:3mm 0 6mm; break-inside:avoid; }
  .metric-card { min-height:25mm; padding:3mm; border-top:3px solid #64748b; background:var(--wash); } .metric-card>span { display:block; min-height:8mm; color:var(--muted); font-size:7pt; font-weight:600; } .metric-card>strong { display:block; margin:1mm 0; font-size:14pt; } .metric-card>small { color:var(--muted); font-size:7pt; font-weight:700; }
  .metric-card--pass { border-color:var(--pass); } .metric-card--warning,.metric-card--review { border-color:var(--warn); } .metric-card--fail { border-color:var(--fail); }
  .factor-grid { display:grid; grid-template-columns:1fr; gap:4mm; margin:3mm 0 7mm; } .factor-card { border:1px solid var(--line); border-top:3px solid var(--blue); break-inside:avoid; } .factor-card header { display:flex; align-items:center; gap:3mm; padding:2.5mm 3mm; background:#eef6fb; } .factor-card h3 { margin:0; font-size:10pt; } .factor-ordinal { display:grid; width:7mm; height:7mm; place-items:center; background:var(--ink); color:#fff; font-weight:700; } .factor-card dl { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:0; } .factor-field { min-width:0; padding:2mm 2.5mm; border-top:1px solid #e2e8f0; } .factor-field dt { color:#64748b; font-size:6.5pt; font-weight:600; text-transform:uppercase; } .factor-field dd { margin:.6mm 0 0; overflow-wrap:anywhere; font-size:7.5pt; }
  .pareto-chart { margin:5mm 0 8mm; padding:5mm; border-left:4px solid var(--blue); background:var(--wash); break-inside:avoid; } .pareto-chart figcaption { margin-bottom:4mm; font-size:11pt; font-weight:650; } .pareto-row { display:grid; grid-template-columns:7mm minmax(34mm,1.15fr) 2fr 14mm; gap:2mm; align-items:center; min-height:7mm; font-size:8pt; } .pareto-track { height:3.2mm; overflow:hidden; background:#dbe4ee; } .pareto-fill { display:block; height:100%; background:#64748b; } .pareto-row--priority .pareto-fill { background:var(--blue); }
  @media print { html,body { background:#fff; } body { max-width:none; } }
`;

export function renderF6PdfHtml(input: F6PdfHtmlInput): string {
  if (!/^[a-f0-9]{64}$/.test(input.sourceHash)) throw new Error("F6 PDF source hash must be a SHA-256 digest.");
  if (input.markdown.trim().length === 0) throw new Error("F6 PDF source Markdown must not be empty.");
  const content = marked.parse(input.markdown, { async: false, renderer: new F6PdfRenderer(input.inlineImages ?? new Map()) });
  const base = input.baseHref === undefined ? "" : `<base href="${escapeHtml(input.baseHref)}">`;
  return `<!doctype html>\n<html lang="en" data-source-sha256="${input.sourceHash}"><head><meta charset="utf-8">${base}<meta name="color-scheme" content="light"><title>TA Engineering Analysis Report</title><style>${PRINT_CSS}</style></head><body><main><section class="report-content">${content}</section></main></body></html>`;
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