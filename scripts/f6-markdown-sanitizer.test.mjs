import { describe, expect, it } from "vitest";
import {
  renderCalculationClaims,
  validateModelMarkdown,
} from "./f6-markdown-sanitizer.mjs";

describe("validateModelMarkdown", () => {
  it("preserves supported model Markdown byte-for-byte", () => {
    const markdown = [
      "### 风险判断",
      "",
      "**主要风险**需要 ME 复核。",
      "",
      "- 检查 [F4 计算](Feature4-Calculation.json)",
      "",
      "| 项目 | 状态 |",
      "|---|---|",
      "| 风险 | open |",
    ].join("\n");

    expect(validateModelMarkdown(markdown, ["Feature4-Calculation.json"])).toBe(markdown);
  });

  it.each([
    ["HTML", "<strong>risk</strong>"],
    ["code block", "```js\nalert(1)\n```"],
    ["image", "![drawing](drawing.png)"],
    ["external URL", "[source](https://example.com)"],
    ["protocol-relative URL", "[source](//example.com/a)"],
    ["javascript URL", "[source](javascript:alert(1))"],
    ["data URL", "[source](data:text/plain,risk)"],
    ["absolute path", "[source](C:/private/evidence.json)"],
    ["UNC path", String.raw`[source](\\server\share\evidence.json)`],
    ["parent traversal", "[source](../evidence.json)"],
    ["undeclared link", "[source](Feature5-Report.json)"],
    ["invalid placeholder", "risk {{calc:Invalid_Id}}"],
    ["literal decimal", "Cpk is 1.33"],
    ["literal percentage", "Contribution is 72%"],
  ])("rejects %s", (_label, markdown) => {
    expect(() => validateModelMarkdown(markdown, ["Feature4-Calculation.json"])).toThrow(/Invalid model Markdown/);
  });
});

describe("renderCalculationClaims", () => {
  it("formats each declared claim exactly once", () => {
    const markdown = "Cpk {{calc:cpk}}；贡献 {{calc:contribution}}；尺寸 {{calc:mean}}。";
    const claims = [
      { claimId: "cpk", rawValue: 1.3333, displayFormat: "number", unit: null },
      { claimId: "contribution", rawValue: 0.72, displayFormat: "percent", unit: null },
      { claimId: "mean", rawValue: 0.125, displayFormat: "engineering", unit: "mm" },
    ];

    expect(renderCalculationClaims(markdown, claims)).toBe("Cpk 1.3333；贡献 72.0%；尺寸 0.125 mm。");
  });

  it("rejects missing, duplicate, and leftover placeholders", () => {
    const claim = { claimId: "cpk", rawValue: 1.33, displayFormat: "number", unit: null };
    expect(() => renderCalculationClaims("没有引用", [claim])).toThrow(/Invalid calculation claims/);
    expect(() => renderCalculationClaims("{{calc:cpk}} {{calc:cpk}}", [claim])).toThrow(/Invalid calculation claims/);
    expect(() => renderCalculationClaims("{{calc:other}}", [claim])).toThrow(/Invalid calculation claims/);
  });
});