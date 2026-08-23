import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const skillPath = path.join(root, ".github", "skills", "f6-analysis", "SKILL.md");
const deprecatedF6ReportArtifactJsonName = [["Feature6", "Composed", "Report"].join("-"), "json"].join(".");

const allowedCommands = [
  "npm run workflow:f2:excel -- <ta-workbook-path>",
  "npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm",
  "npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>",
  "npm run workflow:f6 -- <f2-output-dir> <f3-output-dir> <f4-output-dir> <f5-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] [--analysis-context <artifact-path>] [--optimization-targets <artifact-path>]",
];

function readSkill() {
  return readFileSync(skillPath, "utf8");
}

function frontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error("Missing frontmatter.");
  return Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`Malformed frontmatter: ${line}`);
    return [line.slice(0, separator), line.slice(separator + 1).trim().replace(/^"|"$/g, "")];
  }));
}

function commandLines(markdown) {
  const section = markdown.match(/## Allowed commands\r?\n([\s\S]*?)(?=\r?\n## |$)/)?.[1] ?? "";
  return section.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- `npm run workflow:"))
    .map((line) => line.replace(/^- `|`$/g, ""));
}

function expectOrdered(markdown, markers) {
  let previous = -1;
  for (const marker of markers) {
    const index = markdown.indexOf(marker);
    expect(index, `Missing ordered marker: ${marker}`).toBeGreaterThan(previous);
    previous = index;
  }
}

describe("F6 analysis skill contract", () => {
  it("exists with the exact user-invocable phrase contract", () => {
    expect(existsSync(skillPath)).toBe(true);
    const metadata = frontmatter(readSkill());
    expect(metadata.name).toBe("f6-analysis");
    expect(metadata["user-invocable"]).toBe("true");
    expect(metadata.description).toContain("使用F6分析报告");
    expect(metadata.description).toContain("使用 F6 分析报告");
    expect(metadata.description).toContain("use F6 analysis report");
    expect(metadata["argument-hint"]).toContain("ta-workbook-path");
  });

  it("allows only the governed F1 through F6 workflow command shapes", () => {
    const skill = readSkill();
    expect(commandLines(skill)).toEqual(allowedCommands);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
    expect(skill).not.toMatch(/npm\s+run\s+[^\n`]*ado/i);
  });

  it("orders the complete workbook flow and preserves both worksheet gates", () => {
    const skill = readSkill();
    expectOrdered(skill, [
      "### Phase W0 - Validate workbook and F0 capabilities",
      "### Phase W1 - Generate F1 worksheet selection",
      "### Phase W2 - Confirm and run F1 plus F2",
      "### Phase W3 - Select ready downstream worksheets",
      "### Phase W4 - Run and validate current F3",
      "### Phase W4A - Govern optional F3 ADO publishing",
      "### Phase W5 - Run F4",
      "### Phase W6 - Evaluate optional F5 v2 image evidence",
      "### Phase W7 - Run and validate F5",
      "### Phase W8A - Collect optional TA Analysis Context",
      "Confirm analysis context",
      "### Phase W8B - Collect optional Optimization Targets",
      "Confirm optimization targets",
      "### Phase W9 - Run and validate F6",
      "### Phase W10 - Present every Feature output",
    ]);
    expect(skill).toContain("F1/F2 scope call");
    expect(skill).toContain("F3/F4/F5/F6 scope call");
    expect(skill).toContain("`vscode_askQuestions` (`multiSelect: true`)");
    expect(skill).toContain("No complete F1, F2, F3, F4, F5, or F6 execution may begin before the first selection succeeds");
    expect(skill).toContain("No F3, F4, F5, or F6 execution may begin before the second selection succeeds");
    expect(skill).toContain("The exact downstream worksheet set is reused by F3, F5, and F6");
  });

  it("governs context and targets with separate confirmations before any scenario", () => {
    const skill = readSkill();
    expectOrdered(skill, [
      "Collect optional TA Analysis Context",
      "Confirm analysis context",
      "Collect optional Optimization Targets",
      "Confirm optimization targets",
      "### Phase W9 - Run and validate F6",
    ]);
    expect(skill).toContain("two separate `vscode_askQuestions` calls");
    expect(skill).toContain("Declined analysis context omits `--analysis-context`");
    expect(skill).toContain("Declined optimization targets omit `--optimization-targets`");
    expect(skill).toContain("Caller-target optimization scenarios may not be generated before target confirmation");
    expect(skill).toContain("`CALLER_AUTHORIZED`, `DECLINED`, `REJECTED`, or `NOT_PROVIDED`");
    expect(skill).toContain("must not be combined with the F3 ADO confirmation");
    expect(skill).toContain("f6-optimization-v2");
    expect(skill).not.toContain("reduce_top_contributor_20");
  });

  it("requires current-run F3 execution before the optional ADO gate and F4", () => {
    const skill = readSkill();
    expectOrdered(skill, [
      "npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
      "Feature3-Report.json",
      "`governance_required`",
      "### Phase W4A - Govern optional F3 ADO publishing",
      "### Phase W5 - Run F4",
    ]);
    expect(skill).toContain("must execute F3 for the current confirmed run");
    expect(skill).toContain("Never reuse a historical F3 root");
    expect(skill).toContain("Only `governance_required` enters W4A");
    expect(skill).toContain("A completed F3 skips W4A");
  });

  it("reuses the governed F3 ADO protocol without automatic or implicit writes", () => {
    const skill = readSkill();
    expect(skill).toContain("[F3 analysis and ADO publishing protocol](../f3-analysis/SKILL.md)");
    expect(skill).toContain("[F3 ADO publishing reference](../f3-analysis/references/ado-publishing.md)");
    for (const marker of [
      "Create a new ADO work item",
      "Use an existing ADO work item",
      "Do not publish to ADO",
      "Question call 1",
      "Question call 2",
      "Confirm write",
      "Surface MCP",
      "write exactly once",
      "read back",
    ]) expect(skill).toContain(marker);
    expect(skill).toContain("Never publish automatically or implicitly");
    expect(skill).toContain("W4A outcome does not change the validated F3 analysis result");
  });

  it("requires immutable F5 v2 observations and target-gated F6 scenarios", () => {
    const skill = readSkill();
    expect(skill).toContain("New image mode creates only `f5-image-observation-v2`");
    expect(skill).toContain("all active factor rows");
    for (const scope of [
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
      "direction",
    ]) expect(skill).toContain(`\`${scope}\``);
    expect(skill).toContain("f6-analysis-context-v1");
    expect(skill).toContain("f6-optimization-targets-v1");
    expect(skill).toContain("f6-top3-tolerance-policy-v1");
    expect(skill).toContain("CpkL");
    expect(skill).toContain("CpkU");
    expect(skill).toContain("OP1");
    expect(skill).toContain("OP2");
    expect(skill).toContain("OP3");
    expect(skill).toContain("No other automatic percentage scenario is permitted");
  });

  it("validates every Feature output and supports an existing F6 artifact fast path", () => {
    const skill = readSkill();
    expect(skill).toContain("Entry mode 1 - TA workbook");
    expect(skill).toContain("Entry mode 2 - Existing F6 artifact");
    expect(skill).toContain("Feature6-Report.md");
    expect(skill).toContain("five-file");
    expect(skill).toContain("reportSummary");
    expect(skill).not.toContain(deprecatedF6ReportArtifactJsonName);
    expect(skill).toContain("without rerunning F0, F1, F2, F3, F4, F5, or F6");
    for (const feature of ["F1", "F2", "F3", "F4", "F5", "F6"]) {
      expect(skill).toContain(`\`${feature}\` output`);
    }
    expect(skill).toContain("contract, containment, identity, manifest, and recorded hashes");
  });

  it("documents final report scope from validated summary and manifest instead of Optimization alone", () => {
    const skill = readSkill();
    expect(skill).toContain("Optimization worksheet names must be a unique subset of reportSummary worksheet names");
    expect(skill).toContain("Any reportSummary worksheet not present in Optimization is blocked FAIL");
    expect(skill).toContain("reportSummary extras with any other disposition are blocked FAIL");
    expect(skill).toContain("The exact full report scope comes from the validated run summary and manifest, not from Optimization alone");
  });

  it("keeps deterministic runners local and the optional ADO adapter fail closed", () => {
    const skill = readSkill();
    for (const rule of [
      "Never request or expose credentials",
      "No REST, browser network, shell HTTP, curl, or Invoke-WebRequest for ADO",
      "Never modify the source workbook",
      "F3 and F6 repository runners remain deterministic and network-free",
      "Never publish automatically or implicitly",
      "Treat all inputs and outputs as confidential",
      "Stop on command failure or validation failure",
      "Do not continue from a historical or partial run",
    ]) expect(skill).toContain(rule);
  });

  it("documents the phrase-driven F0-F6 orchestration and governance mapping", () => {
    const documents = {
      readme: readFileSync(path.join(root, "README.md"), "utf8"),
      englishFlow: readFileSync(path.join(root, "docs", "02-end-to-end-flow.md"), "utf8"),
      chineseFlow: readFileSync(path.join(root, "docs", "02-端到端流程.md"), "utf8"),
      register: readFileSync(path.join(root, "docs", "governance", "feature-register.md"), "utf8"),
    };
    for (const markdown of Object.values(documents)) expect(markdown).toContain("使用F6分析报告");
    for (const markdown of [documents.readme, documents.englishFlow, documents.chineseFlow]) {
      expect(markdown).toContain("F0 -> F1 -> F2 -> F3 -> F4 -> F5 -> F6");
      expect(markdown).toContain("two worksheet confirmations");
      expect(markdown).toContain("current-run F3");
      expect(markdown).toContain("governance_required");
      expect(markdown).toContain("optional ADO publishing gate");
      expect(markdown).toContain("never automatic or implicit");
      expect(markdown).toContain("f5-image-observation-v2");
      expect(markdown).toContain("insufficient_evidence");
      expect(markdown).toContain("not_computed");
      expect(markdown).toContain("F1-F6 output ledger");
    }
    for (const check of [
      "f6-skill-contract-check",
      "f0-f6-real-workbook-flow",
      "f6-final-report-check",
    ]) expect(documents.register).toContain(check);
  });
});