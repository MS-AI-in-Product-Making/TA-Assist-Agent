import { describe, expect, it } from "vitest";
import { evidenceLabel, formatEngineering, formatPercent } from "./engineering-format.mjs";

describe("engineering report formatting", () => {
  it("formats units and percentages without floating tails", () => {
    expect(formatEngineering(0.04506939094329987, "mm", 3)).toBe("0.045 mm");
    expect(formatEngineering(1, "ratio", 2)).toBe("1.00 ratio");
    expect(formatPercent(30.76923076923077, 1)).toBe("30.8%");
  });

  it("maps every governed evidence class to a bilingual label", () => {
    expect(evidenceLabel("INPUT_FACT")).toBe("【输入事实 Fact】");
    expect(evidenceLabel("CALCULATED")).toBe("【计算结果 Calculated】");
    expect(evidenceLabel("DERIVED")).toBe("【数学推导 Derived】");
    expect(evidenceLabel("ASSUMPTION")).toBe("【工程假设 Assumption】");
    expect(evidenceLabel("INFERENCE")).toBe("【工程推断 Inference】");
    expect(evidenceLabel("MISSING")).toBe("【数据缺口 Missing】");
  });

  it("rejects nonfinite values and unsupported evidence classes", () => {
    expect(() => formatEngineering(Number.NaN, "mm", 3)).toThrow();
    expect(() => evidenceLabel("FACT")).toThrow();
  });
});
