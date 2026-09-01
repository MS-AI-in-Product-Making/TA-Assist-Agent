import { describe, expect, it } from "vitest";

import { parseAnalyzeIntent } from "./analyze-intent.js";

describe("parseAnalyzeIntent", () => {
  it.each([
    {
      name: "recognizes a Chinese TA request without a path",
      input: "帮我分析这份 TA 报告",
      expected: { kind: "analyze_ta" },
    },
    {
      name: "recognizes an English TA request without a path",
      input: "Please analyze this TA workbook.",
      expected: { kind: "analyze_ta" },
    },
    {
      name: "extracts a quoted Windows absolute xlsx path",
      input: "帮我分析 \"C:\\TA Reports\\report.xlsx\"",
      expected: { kind: "analyze_ta", workbookPath: "C:\\TA Reports\\report.xlsx" },
    },
    {
      name: "extracts a bare Windows absolute xlsx path with spaces",
      input: "Analyze C:\\TA Reports\\report final.xlsx",
      expected: { kind: "analyze_ta", workbookPath: "C:\\TA Reports\\report final.xlsx" },
    },
    {
      name: "recognizes an exact workbook filename for workspace resolution",
      input: "请帮我分析 Gearbox-TA.xlsx 的 TA",
      expected: { kind: "analyze_ta", workbookFileName: "Gearbox-TA.xlsx" },
    },
  ])("$name", ({ input, expected }) => {
    expect(parseAnalyzeIntent(input)).toEqual(expected);
  });

  it.each([
    {
      name: "rejects multiple workbook paths",
      input: "帮我分析 C:\\TA\\first.xlsx 和 C:\\TA\\second.xlsx",
    },
    {
      name: "rejects a folder workbook path without a drive letter",
      input: "Analyze folder\\report.xlsx",
    },
    {
      name: "rejects a relative workbook path",
      input: "帮我分析 .\\report.xlsx",
    },
    {
      name: "rejects an https url",
      input: "Analyze https://contoso.example/report.xlsx",
    },
    {
      name: "rejects a file url",
      input: "Analyze file:///C:/TA/report.xlsx",
    },
    {
      name: "rejects a non xlsx extension",
      input: "Analyze C:\\TA\\report.xlsm",
    },
    {
      name: "rejects control characters",
      input: "帮我分析 C:\\TA\\report.xlsx\u0000",
    },
    {
      name: "does not capture ordinary conversation",
      input: "继续分析当前 session 的 factor table",
    },
  ])("$name", ({ input }) => {
    expect(parseAnalyzeIntent(input)).toBeUndefined();
  });

  it("keeps generic .xlsx prose as a no-path analyze request", () => {
    expect(parseAnalyzeIntent("Please analyze the .xlsx extension guidance for this session.")).toEqual({ kind: "analyze_ta" });
  });

  it("does not convert current-session continuation into a new analysis", () => {
    expect(parseAnalyzeIntent("继续分析当前 session 的 factor table")).toBeUndefined();
  });
});