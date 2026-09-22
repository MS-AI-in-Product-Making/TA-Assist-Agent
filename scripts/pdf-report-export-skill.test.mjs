import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

describe("PDF Report Export skill", () => {
  it("defines required governed PDF publication behavior", () => {
    const skill = read(".github/skills/pdf-report-export/SKILL.md");
    expect(skill).toContain("name: pdf-report-export");
    expect(skill).toContain("<validated workbook basename> - TA ENGINEERING ANALYSIS REPORT.pdf");
    expect(skill).toContain("f6-artifact-set-v4");
    expect(skill).toContain("f6-artifact-set-v3");
    expect(skill).toContain("historical read-only");
    expect(skill).toContain("finalReportPdfSha256");
    expect(skill).toContain("fail closed");
    expect(skill).toContain("<validated workbook basename> - TA ENGINEERING ANALYSIS REPORT.md");
    expect(skill).toContain("English-only content in both reports regardless of the interaction language");
    expect(skill).toContain("exactly two validator-confirmed canonical absolute paths");
    expect(skill).toContain("validated `06 - F6 Design Optimization` stage root");
    expect(skill).toContain("stage `evidence` folder");
  });

  it("is required by the TA Assist Agent and Design Optimization workflows", () => {
    const entry = read(".github/skills/ta-assist-agent/SKILL.md");
    const optimization = read(".github/skills/design-optimization/SKILL.md");
    expect(entry).toContain("REQUIRED SUB-SKILL: Use pdf-report-export");
    expect(optimization).toContain("REQUIRED SUB-SKILL: Use pdf-report-export");
    expect(entry).toContain("TA ENGINEERING ANALYSIS REPORT.pdf");
    expect(optimization).toContain("TA ENGINEERING ANALYSIS REPORT.pdf");
  });
});