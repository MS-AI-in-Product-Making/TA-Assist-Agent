export interface TaAnalyzeIntent {
  readonly kind: "analyze_ta";
  readonly workbookPath?: string;
  readonly workbookFileName?: string;
}

export type TaAnalyzeIntentClassification = TaAnalyzeIntent | {
  readonly kind: "invalid_analyze_ta";
  readonly reason: "multiple_paths" | "relative_path" | "url_not_allowed" | "non_xlsx_path" | "control_chars";
};

const ABSOLUTE_QUOTED_PATH = /"([A-Za-z]:\\[^"\r\n]+?\.[A-Za-z0-9]+)"/g;
const ABSOLUTE_BARE_PATH_START = /[A-Za-z]:\\/g;
const ANALYZE_VERB = /(分析|analy[sz]e)/i;
const ANALYZE_CONTEXT = /(\bta\b|报告|報告|\breport\b|\bworkbook\b|\.xlsx\b)/i;
const URL_PATTERN = /(?:file|https?):\/\//i;
const RELATIVE_XLSX_PATTERN = /(^|[\s"'])(?:\.\.?\\)[^"\r\n]*\.xlsx\b/i;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const SESSION_FIRST_INTENT_PATTERN = /(继续|resume|continue|当前\s*session|current[-\s]*session|status|状态|进度|blocker|阻塞|卡住)/i;
const WORKBOOK_TOKEN_PATTERN = /(?:^|[^A-Za-z0-9])(?:[^\s"'`<>]+\.xlsx\b|\.xlsx\b)/i;

export function parseAnalyzeIntent(text: string): TaAnalyzeIntent | undefined {
  const classification = classifyAnalyzeIntent(text);
  return classification?.kind === "analyze_ta" ? classification : undefined;
}

export function classifyAnalyzeIntent(text: string): TaAnalyzeIntentClassification | undefined {
  if (!looksLikeAnalyzePathRequest(text)) return undefined;
  if (CONTROL_CHAR_PATTERN.test(text)) return { kind: "invalid_analyze_ta", reason: "control_chars" };
  if (URL_PATTERN.test(text)) return { kind: "invalid_analyze_ta", reason: "url_not_allowed" };
  if (RELATIVE_XLSX_PATTERN.test(text)) return { kind: "invalid_analyze_ta", reason: "relative_path" };

  const absolutePathMatches = collectWindowsAbsolutePaths(text);
  const absolutePaths = absolutePathMatches.map(({ path }) => path);
  const nonAbsoluteXlsxTokens = collectNonAbsoluteXlsxTokens(text, absolutePathMatches);
  const workbookFileNames = collectWorkbookFileNames(nonAbsoluteXlsxTokens);
  const nonWorkbookFileNameTokens = nonAbsoluteXlsxTokens.filter((token) => !workbookFileNames.includes(token));

  if (SESSION_FIRST_INTENT_PATTERN.test(text) && nonWorkbookFileNameTokens.length === 0 && absolutePaths.length + workbookFileNames.length <= 1) {
    return undefined;
  }

  if (nonWorkbookFileNameTokens.length > 0) {
    return { kind: "invalid_analyze_ta", reason: absolutePaths.length === 1 ? "multiple_paths" : "relative_path" };
  }

  if (absolutePaths.length + workbookFileNames.length > 1) return { kind: "invalid_analyze_ta", reason: "multiple_paths" };

  if (absolutePaths.length === 1) {
    const workbookPath = absolutePaths[0]!;
    return workbookPath.toLowerCase().endsWith(".xlsx")
      ? { kind: "analyze_ta", workbookPath }
      : { kind: "invalid_analyze_ta", reason: "non_xlsx_path" };
  }

  if (workbookFileNames.length === 1) {
    return { kind: "analyze_ta", workbookFileName: workbookFileNames[0]! };
  }

  return { kind: "analyze_ta" };
}

function looksLikeAnalyzePathRequest(text: string): boolean {
  if (!ANALYZE_VERB.test(text)) return false;
  return WORKBOOK_TOKEN_PATTERN.test(text) || hasPathLikeToken(text);
}

function hasPathLikeToken(text: string): boolean {
  return /[A-Za-z]:\\/.test(text) || URL_PATTERN.test(text) || RELATIVE_XLSX_PATTERN.test(text);
}

type WindowsAbsolutePathMatch = {
  readonly path: string;
  readonly start: number;
  readonly end: number;
};

function collectWindowsAbsolutePaths(text: string): WindowsAbsolutePathMatch[] {
  const spans: Array<{ readonly start: number; readonly end: number }> = [];
  const paths: WindowsAbsolutePathMatch[] = [];

  for (const match of text.matchAll(ABSOLUTE_QUOTED_PATH)) {
    const fullMatch = match[0];
    const workbookPath = match[1];
    if (fullMatch === undefined || workbookPath === undefined) continue;
    const start = match.index ?? 0;
    spans.push({ start, end: start + fullMatch.length });
    paths.push({ path: workbookPath, start, end: start + fullMatch.length });
  }

  for (const match of text.matchAll(ABSOLUTE_BARE_PATH_START)) {
    const start = match.index ?? 0;
    if (spans.some((span) => start >= span.start && start < span.end)) continue;
    const workbookPath = readBareAbsolutePath(text, start);
    if (workbookPath !== undefined) paths.push({ path: workbookPath, start, end: start + workbookPath.length });
  }

  return paths;
}

function collectNonAbsoluteXlsxTokens(text: string, absolutePathMatches: readonly WindowsAbsolutePathMatch[]): string[] {
  const tokens = new Set<string>();

  for (const match of text.matchAll(/[^\s"'`<>]+\.xlsx\b/gi)) {
    const token = match[0];
    if (token === undefined) continue;
    const start = match.index ?? 0;
    const end = start + token.length;
    if (absolutePathMatches.some((absolutePath) => start >= absolutePath.start && end <= absolutePath.end)) continue;
    const cleanedToken = token.replace(/[,.!?;:)"]+$/g, "");
    if (cleanedToken.length === 0) continue;
    if (cleanedToken.toLowerCase() === ".xlsx") continue;
    if (!/[A-Za-z0-9\\]/.test(cleanedToken.slice(0, -5))) continue;
    tokens.add(cleanedToken);
  }

  return [...tokens];
}

function collectWorkbookFileNames(tokens: readonly string[]): string[] {
  const fileNames = new Set<string>();
  for (const token of tokens) {
    if (isExactWorkbookFileName(token)) fileNames.add(token);
  }
  return [...fileNames];
}

function isExactWorkbookFileName(token: string): boolean {
  if (!token.toLowerCase().endsWith(".xlsx")) return false;
  if (token.includes("\\") || token.includes("/") || token.includes(":")) return false;
  if (token.length <= ".xlsx".length) return false;
  return !/[<>:"|?*\u0000-\u001f]/.test(token);
}

function readBareAbsolutePath(text: string, start: number): string | undefined {
  const remainder = text.slice(start);
  const extensions = remainder.matchAll(/\.[A-Za-z0-9]+/g);
  for (const match of extensions) {
    const fragment = match[0];
    if (fragment === undefined || match.index === undefined) continue;
    const end = start + match.index + fragment.length;
    if (isBarePathBoundary(text, end)) return text.slice(start, end);
  }
  return undefined;
}

function isBarePathBoundary(text: string, end: number): boolean {
  if (end >= text.length) return true;
  const trailing = text.slice(end);
  return /^[,.!?;:)\]"，。；：！？]/.test(trailing)
    || /^\s+(?:and|or|和|或)\b/i.test(trailing)
    || /^\s*$/.test(trailing);
}