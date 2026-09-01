import { basename } from "node:path";

export interface WorkbookUriLike {
  readonly fsPath: string;
}

export type WorkbookResolution =
  | { readonly kind: "unique"; readonly uri: WorkbookUriLike }
  | { readonly kind: "ambiguous"; readonly candidates: readonly WorkbookUriLike[] }
  | { readonly kind: "not_found" };

export async function resolveWorkspaceWorkbook(
  fileName: string,
  findFiles: (pattern: string) => PromiseLike<readonly WorkbookUriLike[]>,
): Promise<WorkbookResolution> {
  const trimmedFileName = fileName.trim();
  if (trimmedFileName.length === 0 || trimmedFileName.includes("\\") || trimmedFileName.includes("/")) {
    return { kind: "not_found" };
  }

  const exactName = normalizeWorkbookFileName(trimmedFileName);
  const pattern = `**/${escapeGlobSegment(trimmedFileName)}`;
  const matches = await findFiles(pattern);
  const exactMatches = matches
    .filter((candidate) => normalizeWorkbookFileName(basename(candidate.fsPath)) === exactName)
    .slice()
    .sort((left, right) => left.fsPath.localeCompare(right.fsPath));

  if (exactMatches.length === 0) return { kind: "not_found" };
  if (exactMatches.length === 1) return { kind: "unique", uri: exactMatches[0]! };
  return { kind: "ambiguous", candidates: exactMatches };
}

function normalizeWorkbookFileName(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

function escapeGlobSegment(value: string): string {
  return value
    .replaceAll("[", "[[]")
    .replaceAll("]", "[]]")
    .replaceAll("{", "[{]")
    .replaceAll("}", "[}]")
    .replaceAll("*", "[*]")
    .replaceAll("?", "[?]")
    .replaceAll(",", "[,]");
}
