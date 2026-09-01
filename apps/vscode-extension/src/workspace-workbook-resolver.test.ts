import { describe, expect, it } from "vitest";

import { resolveWorkspaceWorkbook } from "./workspace-workbook-resolver.js";

type UriLike = { readonly fsPath: string };

describe("resolveWorkspaceWorkbook", () => {
  it("returns unique when one exact workbook name exists", async () => {
    const result = await resolveWorkspaceWorkbook("report.xlsx", async () => [{ fsPath: "C:\\TA\\report.xlsx" } as UriLike]);

    expect(result).toEqual({ kind: "unique", uri: { fsPath: "C:\\TA\\report.xlsx" } });
  });

  it("requires selection when duplicate exact workbook names exist", async () => {
    const result = await resolveWorkspaceWorkbook("report.xlsx", async () => [
      { fsPath: "C:\\A\\report.xlsx" } as UriLike,
      { fsPath: "C:\\B\\report.xlsx" } as UriLike,
    ]);

    expect(result).toMatchObject({ kind: "ambiguous", candidates: expect.any(Array) });
    expect(result.kind === "ambiguous" ? result.candidates.length : 0).toBe(2);
  });

  it("returns not_found when no exact workbook name exists", async () => {
    const result = await resolveWorkspaceWorkbook("report.xlsx", async () => []);

    expect(result).toEqual({ kind: "not_found" });
  });

  it("keeps duplicate exact names across multiple roots as ambiguous", async () => {
    const result = await resolveWorkspaceWorkbook("report.xlsx", async () => [
      { fsPath: "C:\\workspace-a\\docs\\report.xlsx" } as UriLike,
      { fsPath: "C:\\workspace-b\\inputs\\report.xlsx" } as UriLike,
      { fsPath: "C:\\workspace-b\\inputs\\report-final.xlsx" } as UriLike,
    ]);

    expect(result).toMatchObject({ kind: "ambiguous", candidates: expect.any(Array) });
    expect(result.kind === "ambiguous" ? result.candidates.map((item) => item.fsPath) : []).toEqual([
      "C:\\workspace-a\\docs\\report.xlsx",
      "C:\\workspace-b\\inputs\\report.xlsx",
    ]);
  });

  it("escapes glob specials and resolves by exact basename", async () => {
    const findFiles = async (pattern: string) => {
      expect(pattern).toBe("**/report[[]1[]][{]a[}][*][?][,].xlsx");
      return [{ fsPath: "C:\\TA\\report[1]{a}*?,.xlsx" } as UriLike];
    };

    const result = await resolveWorkspaceWorkbook("report[1]{a}*?,.xlsx", findFiles);

    expect(result).toEqual({ kind: "unique", uri: { fsPath: "C:\\TA\\report[1]{a}*?,.xlsx" } });
  });
});
