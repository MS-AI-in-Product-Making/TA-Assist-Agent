import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const skills = [
  ["knowledge-library", "Knowledge Library"],
  ["data-parsing", "Data Parsing"],
  ["data-cleaning", "Data Cleaning"],
  ["drawing-governance", "Drawing Governance"],
  ["ta-calculation", "TA Calculation"],
  ["result-interpretation", "Result Interpretation"],
  ["design-optimization", "Design Optimization"],
  ["feedback-application", "Feedback Application"],
];
const retiredSkills = ["f3-analysis", "f5-analysis", "f6-analysis"];
const executionAliases = [
  ["workflow:data-parsing", "workflow:f1"],
  ["workflow:data-cleaning", "workflow:f2"],
  ["workflow:drawing-governance", "workflow:f3"],
  ["workflow:ta-calculation", "workflow:f4"],
  ["workflow:result-interpretation", "workflow:f5"],
  ["workflow:design-optimization", "workflow:f6"],
];

describe("product Agent Skills", () => {
  it.each(skills)("provides the standard %s skill", (name, title) => {
    const skill = readFileSync(join(root, ".github", "skills", name, "SKILL.md"), "utf8");
    const userFacingSkill = skill.split("## Internal executor contract")[0];

    expect(skill).toMatch(new RegExp(`^---\\r?\\nname: ${name}\\r?$`, "m"));
    expect(skill).toMatch(new RegExp(`\\r?\\n# ${title}\\r?\\n`));
    expect(skill).toContain("Determine the interaction language from the user request that starts the current product workflow");
    expect(skill).toContain("Keep that language locked for the entire workflow");
    expect(skill).toContain("Do not re-detect language from confirmation answers");
    expect(skill).toContain("Change the locked language only when the user explicitly requests a language change");
    expect(userFacingSkill).not.toMatch(/\bF[0-7]\b/u);
    expect(userFacingSkill).not.toMatch(/\bFeature[ _-]?[0-7]\b/iu);
  });

  it.each(retiredSkills)("retires the legacy %s skill", (name) => {
    expect(existsSync(join(root, ".github", "skills", name))).toBe(false);
  });

  it.each(skills)("does not delegate %s to a legacy skill", (name) => {
    const skill = readFileSync(join(root, ".github", "skills", name, "SKILL.md"), "utf8");

    expect(skill).not.toMatch(/\.\.\/f[356]-analysis/u);
    expect(skill).not.toContain("remains authoritative");
  });

  it.each(executionAliases)("maps %s to the same executor as %s", (productAlias, internalAlias) => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

    expect(packageJson.scripts[productAlias]).toBe(packageJson.scripts[internalAlias]);
  });

  it("keeps measured-data routing and reviewed feedback routing mutually exclusive", () => {
    const measuredSkill = readFileSync(join(root, ".github", "skills", "ta-real-measurement-analysis", "SKILL.md"), "utf8");
    const feedbackSkill = readFileSync(join(root, ".github", "skills", "feedback-application", "SKILL.md"), "utf8");

    expect(measuredSkill).toMatch(/Do not use for general Cpk explanations.*Monte Carlo programming/i);
    expect(feedbackSkill).toMatch(/reviewed feedback/i);
    expect(feedbackSkill).toMatch(/Do not use for real measurement value entry, measured sample modeling, or starting the real-measurement analysis workflow/i);
  });
});