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
  it("provides TA Assist Agent as the primary complete-workbook entry", () => {
    const skillPath = join(root, ".github", "skills", "ta-assist-agent", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);
    const skill = readFileSync(skillPath, "utf8");

    expect(skill).toMatch(/^---\r?\nname: ta-assist-agent\r?$/m);
    expect(skill).toContain("user-invocable: true");
    expect(skill).toContain("# TA Assist Agent");
    expect(skill).toContain("REQUIRED SUB-SKILL: Use design-optimization");
    expect(skill).toMatch(/Do not use for generic spreadsheet editing/i);
    expect(skill).toMatch(/generic Cpk questions/i);
    expect(skill).toMatch(/Monte Carlo programming/i);
    expect(skill).toMatch(/actual measurement|real measurement/i);
    expect(skill).toMatch(/reviewed feedback/i);
  });

  it("allocates one workspace and gates final presentation on its completed summary", () => {
    const skill = readFileSync(join(root, ".github", "skills", "ta-assist-agent", "SKILL.md"), "utf8");
    expect(skill).toContain("create-analysis-workspace.mjs --workbook");
    expect(skill).toContain("--analysis-root");
    expect(skill).toContain("Never allocate a second root");
    expect(skill).toContain("analysis-run-summary.json");
    expect(skill).toContain('overallStatus === "completed"');
    expect(skill).toContain("failed or completed root is immutable");
    expect(skill).toContain("F1 -> F2 -> F3 -> F4 -> F5 -> F6");
    expect(skill).toContain("two confirmations");
    expect(skill).toContain("F5 -> validated F6 candidate -> ADO choice/write -> final F6 publish");
    expect(skill).toContain("--candidate");
    expect(skill).toContain("candidate_cleanup_failed");
    expect(skill).toContain("Keep candidate evidence through final validation and root completion");
    expect(skill).toContain("mode-choice and separate final-write confirmations");
    const optimization = readFileSync(join(root, ".github", "skills", "design-optimization", "SKILL.md"), "utf8");
    expect(optimization).toContain("workflow:f2:excel -- <ta-workbook-path> --analysis-root <analysis-root>");
  });

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

  it("routes workbook parsing and cleaning skills through the canonical analysis workspace", () => {
    const parsingSkill = readFileSync(join(root, ".github", "skills", "data-parsing", "SKILL.md"), "utf8");
    const cleaningSkill = readFileSync(join(root, ".github", "skills", "data-cleaning", "SKILL.md"), "utf8");

    expect(parsingSkill).toContain("canonical analysis root");
    expect(parsingSkill).toContain("01 - F1 Data Parsing");
    expect(parsingSkill).toContain("02 - F2 Data Cleaning");
    expect(parsingSkill).toContain("Preserve the canonical analysis root from this step");
    expect(parsingSkill).toContain("fall back to legacy `test/demo-output` write roots");
    expect(parsingSkill).toContain("worksheet-selection prompt, selection registry/reference, and parsing-stage logs stay in `01 - F1 Data Parsing`");
    expect(parsingSkill).toContain("Do not copy `Feature1-Selection.json` or other parsing evidence into `02 - F2 Data Cleaning`");

    expect(cleaningSkill).toContain("reuse the same canonical analysis root");
    expect(cleaningSkill).toContain("01 - F1 Data Parsing");
    expect(cleaningSkill).toContain("02 - F2 Data Cleaning");
    expect(cleaningSkill).toContain("create a new `f2-runs` or timestamped workspace layer");
    expect(cleaningSkill).toContain("Read the exact parsing handoff from `01 - F1 Data Parsing`");
    expect(cleaningSkill).toContain("store the path/reference instead of duplicating parsing artifacts into stage 2");
    expect(cleaningSkill).toContain("Keep cleaning reports, cleaning-stage logs, and cleaning validation artifacts in `02 - F2 Data Cleaning`");
  });

  it("routes governance and calculation skills through the canonical F3 and F4 stage folders", () => {
    const governanceSkill = readFileSync(join(root, ".github", "skills", "drawing-governance", "SKILL.md"), "utf8");
    const calculationSkill = readFileSync(join(root, ".github", "skills", "ta-calculation", "SKILL.md"), "utf8");

    expect(governanceSkill).toContain("03 - F3 Drawing Governance");
    expect(governanceSkill).toContain("reuse the canonical analysis root");
    expect(governanceSkill).toContain("Do not create or fall back to legacy `feature3-output` write roots");
    expect(governanceSkill).toContain("Consume the exact cleaning-stage artifact reference");

    expect(calculationSkill).toContain("04 - F4 Calculation Engine");
    expect(calculationSkill).toContain("reuse the canonical analysis root");
    expect(calculationSkill).toContain("Do not create a new `f4-runs` or run-id child for the current workspace flow");
    expect(calculationSkill).toContain("Consume the exact cleaning-stage artifact reference");
  });

  it("keeps measured-data routing and reviewed feedback routing mutually exclusive", () => {
    const measuredSkill = readFileSync(join(root, ".github", "skills", "ta-real-measurement-analysis", "SKILL.md"), "utf8");
    const feedbackSkill = readFileSync(join(root, ".github", "skills", "feedback-application", "SKILL.md"), "utf8");

    expect(measuredSkill).toMatch(/Do not use for general Cpk explanations.*Monte Carlo programming/i);
    expect(feedbackSkill).toMatch(/reviewed feedback/i);
    expect(feedbackSkill).toMatch(/Do not use for real measurement value entry, measured sample modeling, or starting the real-measurement analysis workflow/i);
  });
});