import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(import.meta.dirname, "..");
const skillPath = path.join(rootDir, ".github", "skills", "ta-real-measurement-analysis", "SKILL.md");

function readSkill() {
  return fs.readFileSync(skillPath, "utf-8");
}

describe("TA real-measurement analysis workspace skill", () => {
  it("is discoverable from Chinese and English user intent without requiring the F7 codename", () => {
    const skill = readSkill();

    expect(skill).toMatch(/^---\r?\nname: ta-real-measurement-analysis\r?\n/);
    expect(skill).toMatch(/description:.*真实量测.*actual measurement.*TA.*dimension.*tolerance.*assembly.*Factors/i);
    expect(skill).toMatch(/description:.*measured samples.*capability.*distribution fit.*Monte Carlo/i);
    expect(skill).toMatch(/description:.*explicit F7 requests/i);
    expect(skill).toContain("user-invocable: true");
    expect(skill).toContain('argument-hint: "[<ta-workbook-path>]"');
  });

  it("excludes broad statistics and programming requests from automatic discovery", () => {
    const skill = readSkill();

    expect(skill).toMatch(/description:.*Do not use.*general Cpk explanations.*generic measurement analysis.*Monte Carlo programming/i);
  });

  it("prefers the existing Web UI and starts the stack as a long-running process", () => {
    const skill = readSkill();

    expect(skill).toContain("npm run dev:f7");
    expect(skill).toContain("http://127.0.0.1:5177");
    expect(skill).toContain("127.0.0.1:4317");
    expect(skill).toMatch(/async|background|long-running/i);
    expect(skill).toMatch(/open.*browser|open.*Web UI/i);
    expect(skill).not.toContain("workflow:f7");
  });

  it("reuses a ready stack and stops on partial port conflicts or startup failure", () => {
    const skill = readSkill();

    expect(skill).toMatch(/reuse|already running/i);
    expect(skill).toMatch(/only one|partial/i);
    expect(skill).toMatch(/port conflict|occupied/i);
    expect(skill).toMatch(/startup.*fail|command.*fail|exits/i);
    expect(skill).toMatch(/do not claim|never claim/i);
  });

  it("guides multi-Factor measured input without exceeding local Phase 1 boundaries", () => {
    const skill = readSkill();

    expect(skill).toMatch(/import.*workbook/i);
    expect(skill).toMatch(/select.*worksheet/i);
    expect(skill).toMatch(/multiple Factors/i);
    expect(skill).toMatch(/MEASURED/);
    expect(skill).toMatch(/Open workspace/);
    expect(skill).toMatch(/Normal.*baseline/i);
    expect(skill).toMatch(/do not.*invent.*measurement|never.*invent.*measurement/i);
    expect(skill).toMatch(/do not.*upload|never.*upload/i);
    expect(skill).toMatch(/do not.*modify.*workbook|never.*modify.*workbook/i);
    expect(skill).toMatch(/do not.*ADO|never.*ADO/i);
  });
});