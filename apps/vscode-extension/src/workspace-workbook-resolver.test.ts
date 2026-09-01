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
});
