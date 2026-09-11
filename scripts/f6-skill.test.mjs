import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const skillPath = path.join(root, ".github", "skills", "design-optimization", "SKILL.md");
const deprecatedF6ReportArtifactJsonName = [["Feature6", "Composed", "Report"].join("-"), "json"].join(".");

const allowedCommands = [
  "npm run workflow:ta-entry-validation -- <ta-workbook-path>",
  "npm run workflow:f2:excel -- <ta-workbook-path>",
  "npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm",
  "npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>",
  "npm run workflow:f6:model-interpretation -- <f2-output-dir> <f3-output-dir> <f4-output-dir> <f5-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --response <model-response-artifact>",
  "npm run workflow:f6 -- <f2-output-dir> <f3-output-dir> <f4-output-dir> <f5-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --language <locked-language-tag> --model-interpretation <artifact-path> [--analysis-context <artifact-path>] [--optimization-targets <artifact-path>]",
];

function readSkill() {
  return readFileSync(skillPath, "utf8");
}

function splitSkillSections(markdown) {
  const marker = "## Internal executor contract";
  const index = markdown.indexOf(marker);
  if (index < 0) throw new Error("Missing internal executor contract section.");
  return {
    userFacing: markdown.slice(0, index),
    internal: markdown.slice(index),
  };
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

describe("Design Optimization skill contract", () => {
  it("exists with product discovery metadata and no legacy stage codenames", () => {
    expect(existsSync(skillPath)).toBe(true);
    const metadata = frontmatter(readSkill());
    expect(metadata.name).toBe("design-optimization");
    expect(metadata["user-invocable"]).toBe("true");
    expect(metadata.description).toContain("complete governed TA analysis");
    expect(metadata.description).toContain("design improvement options");
    expect(metadata.description).toContain("optimization targets");
    expect(metadata.description).toContain("final engineering report");
    expect(metadata.description).not.toMatch(/\bF[0-7]\b/u);
    expect(metadata.description).not.toMatch(/\bFeature[ _-]?[0-7]\b/iu);
    expect(metadata.description).not.toContain("使用F6分析报告");
    expect(metadata.description).not.toContain("使用 F6 分析报告");
    expect(metadata.description).not.toContain("use F6 analysis report");
    expect(metadata["argument-hint"]).toContain("ta-workbook-path");
  });

  it("uses product-capability user flow markers before the internal contract", () => {
    const skill = readSkill();
    const { userFacing } = splitSkillSections(skill);
    expect(userFacing).toContain("Determine the interaction language from the user request that starts the current product workflow");
    expect(userFacing).toContain("Keep that language locked for the entire workflow");
    expect(userFacing).toContain("Do not re-detect language from confirmation answers");
    expect(userFacing).toContain("Change the locked language only when the user explicitly requests a language change");
    expectOrdered(userFacing, [
      "## Purpose",
      "## Entry routing",
      "## Agent planning",
      "1. Knowledge Library:",
      "2. Data Parsing:",
      "3. Data Cleaning:",
      "4. Drawing Governance:",
      "5. TA Calculation:",
      "6. Result Interpretation:",
      "7. Design Optimization:",
      "8. Feedback Application:",
    ]);
    expect(userFacing).not.toMatch(/\bF[0-7]\b/u);
    expect(userFacing).not.toMatch(/\bFeature[ _-]?[0-7]\b/iu);
    expect(userFacing).not.toMatch(/\bW[0-9A-Z]*\b/u);
  });

  it("allows only the governed entry through F6 workflow command shapes", () => {
    const { internal } = splitSkillSections(readSkill());
    expect(commandLines(internal)).toEqual(allowedCommands);
    expect(internal).toContain("Pass the workflow-locked language tag with `--language <locked-language-tag>`");
    expect(internal).toContain("Always pass the accepted W8 artifact with `--model-interpretation <artifact-path>`");
    expect(internal).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
    expect(internal).not.toMatch(/npm\s+run\s+[^\n`]*ado/i);
  });

  it("orders the complete workbook flow and preserves both worksheet gates", () => {
    const { internal } = splitSkillSections(readSkill());
    expect(internal).not.toContain("optionally collect image observations");
    expect(internal).not.toContain("independent Analysis Context and Optimization Targets confirmations");
    expectOrdered(internal, [
      "### Phase W0 - Validate workbook and F0 capabilities",
      "### Phase W1 - Generate F1 worksheet selection",
      "### Phase W2 - Confirm and run F1 plus F2",
      "### Phase W3 - Select ready downstream worksheets",
      "### Phase W4 - Run and validate current F3",
      "### Phase W5 - Run F4",
      "### Phase W6 - Run workflow-owned F5 image evaluation",
      "### Phase W7 - Run and validate F5",
      "### Phase W8 - Generate governed model interpretation",
      "### Phase W9 - Run and validate F6",
      "### Phase W9A - Govern optional F3 ADO publishing",
      "### Phase W10 - Present every Feature output",
    ]);
    expect(internal).toContain("F1/F2 scope call");
    expect(internal).toContain("F3/F4/F5/F6 scope call");
    expect(internal).toContain("`vscode_askQuestions` (`multiSelect: true`)");
    expect(internal).toContain("No complete F1, F2, F3, F4, F5, or F6 execution may begin before the first selection succeeds");
    expect(internal).toContain("No F3, F4, F5, or F6 execution may begin before the second selection succeeds");
    expect(internal).toContain("The exact downstream worksheet set is reused by F3, F5, and F6");
    expect(internal).not.toContain("### Phase W8A - Collect optional TA Analysis Context");
    expect(internal).not.toContain("### Phase W8B - Collect optional Optimization Targets");
  });

  it("records standard-path context and targets as not provided without extra vscode_askQuestions", () => {
    const { internal } = splitSkillSections(readSkill());
    expectOrdered(internal, [
      "Record Analysis Context as `NOT_PROVIDED` on the standard workbook path.",
      "Record Optimization Targets as `NOT_PROVIDED` on the standard workbook path.",
      "### Phase W9 - Run and validate F6",
    ]);
    expect(internal).toContain("Do not prompt for Analysis Context or Optimization Targets on the standard workbook path.");
    expect(internal).toContain("Omit `--analysis-context` and `--optimization-targets` unless an existing artifact entry mode explicitly supplies them.");
    expect(internal).toContain("`CALLER_AUTHORIZED`, `DECLINED`, `REJECTED`, or `NOT_PROVIDED`");
    expect(internal).toContain("f6-optimization-v3");
    expect(internal).not.toContain("reduce_top_contributor_20");
    expect(internal).not.toContain("Confirm analysis context");
    expect(internal).not.toContain("Confirm optimization targets");
    expect(internal).not.toContain("two separate `vscode_askQuestions` calls");
  });

  it("keeps image evaluation internal on the standard workbook path while preserving governed gates", () => {
    const { internal } = splitSkillSections(readSkill());
    const resultInterpretationSkill = readFileSync(path.join(root, ".github", "skills", "result-interpretation", "SKILL.md"), "utf8");
    const entrySkill = readFileSync(path.join(root, ".github", "skills", "ta-assist-agent", "SKILL.md"), "utf8");

    expect(internal).toContain("Run workflow-owned F5 image evaluation");
    expect(internal).toContain("Do not ask the user whether to evaluate the already verified F1 images");
    expect(internal).toContain("Record the workflow-owned outcome internally and continue to W7 without a caller confirmation gate");
    expect(internal).toContain("Task 2 mixed-outcome behavior");
    expect(internal).toContain("f5-image-observation-v2");
    expect(internal).toContain("must be reviewed by ME");
    expect(internal).toContain("Record Analysis Context as `NOT_PROVIDED` on the standard workbook path.");
    expect(internal).toContain("Record Optimization Targets as `NOT_PROVIDED` on the standard workbook path.");
    expect(internal).toContain("f6-top3-tolerance-policy-v1");
    expect(internal).toContain("Confirm write");
    expect(internal).toContain("Feature6-Report.pdf");
    expect(resultInterpretationSkill).toContain("When Design Optimization owns the end-to-end workbook workflow, this capability must not add a separate caller image-confirmation gate");
    expect(entrySkill).toContain("internal image evaluation before recording standard-path Analysis Context and Optimization Targets as NOT_PROVIDED");
  });

  it("runs current-run F3 before F4 and defers the optional ADO gate until after F6", () => {
    const { internal } = splitSkillSections(readSkill());
    expectOrdered(internal, [
      "npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
      "Feature3-Report.json",
      "### Phase W5 - Run F4",
      "### Phase W9 - Run and validate F6",
      "### Phase W9A - Govern optional F3 ADO publishing",
    ]);
    expect(internal).toContain("must execute F3 for the current confirmed run");
    expect(internal).toContain("Never reuse a historical F3 root");
    expect(internal).toContain("Every validated F3 result enters W9A after F6 validation");
    expect(internal).toContain("F3 governance status does not bypass W9A");
  });

  it("reuses the governed drawing governance protocol without automatic or implicit writes", () => {
    const { internal } = splitSkillSections(readSkill());
    expect(internal).toContain("REQUIRED SUB-SKILL: Use drawing-governance");
    expect(internal).not.toMatch(/\.\.\/f3-analysis/u);
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
    ]) expect(internal).toContain(marker);
    expect(internal).toContain("Never publish automatically or implicitly");
    expect(internal).toContain("W9A outcome does not change the validated F3 analysis result");
  });

  it("requires immutable F5 v2 observations and target-gated F6 scenarios", () => {
    const { internal } = splitSkillSections(readSkill());
    expect(internal).toContain("New image mode creates only `f5-image-observation-v2`");
    expect(internal).toContain("all active factor rows");
    expect(internal).toContain("each selected worksheet independently");
    expect(internal).toContain("validated F5 evidence for image facts, contextual signals, and clarifications");
    expect(internal).toContain("hallucinations, label mismatches, or omissions");
    expect(internal).toContain("must be reviewed by ME");
    expect(internal).toContain("Compare explicit visible arrow direction and label mapping with linked structured Factor descriptions and nominal signs");
    expect(internal).toContain("Each worksheet's `3-N.1` section contains only the verified tolerance-path image and its link");
    expect(internal).toContain("Section 3-N.3 consumes only the accepted W8 multimodal v3 interpretation");
    expect(internal).toContain("Never hard-code screenshot-specific labels, values, loads, or conclusions into the report template");
    expect(internal).toContain("Feature6-Report.md");
    expect(internal).toContain("not_evaluated");
    for (const scope of [
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
      "direction",
    ]) expect(internal).toContain(`\`${scope}\``);
    expect(internal).toContain("chat natural language only");
    expect(internal).toContain("governed proposal materializer");
    expect(internal).toContain("preview-ready pending draft");
    expect(internal).toContain("f6-top3-tolerance-policy-v1");
    expect(internal).toContain("CpkL");
    expect(internal).toContain("CpkU");
    expect(internal).toContain("OP1");
    expect(internal).toContain("OP2");
    expect(internal).toContain("OP3");
    expect(internal).toContain("No other automatic percentage scenario is permitted");
  });

  it("governs required multimodal v3 interpretation as an immutable pre-F6 artifact", () => {
    const { internal } = splitSkillSections(readSkill());
    expectOrdered(internal, [
      "### Phase W7 - Run and validate F5",
      "### Phase W8 - Generate governed model interpretation",
      "### Phase W9 - Run and validate F6",
    ]);
    for (const marker of [
      "f5-multimodal-artifact-v3",
      "test/demo-output/f6-model-interpretations/<workbook-content-hash>/<system-generated-uuid>/Feature6-Model-Interpretation.json",
      "f5MultimodalArtifactV3Schema",
      "validateF5MultimodalArtifactV3",
      "each selected worksheet independently",
      "all active Factor rows",
      "complete ordered Factor set",
      "exactly one field-identical row mapping",
      "f6-model-interpretation-response-v1",
      "workflow:f6:model-interpretation",
      "Never manually assemble the complete v3 artifact",
      "required input",
      "must be reviewed by ME",
      "hallucinations, label mismatches, or omissions",
      "--model-interpretation <artifact-path>",
    ]) expect(internal).toContain(marker);
    expect(internal).not.toContain("f6-model-interpretation-v2");
    expect(internal).toContain("Never edit, overwrite, append to, repair, or reuse a model interpretation target");
    expect(internal).toContain("does not require an additional caller confirmation");
    expect(internal).not.toContain("Replace the former Reference Traceability appendix with a per-worksheet TA summary");
    expect(internal).not.toContain("separates image-visible FACTs, deterministic table calculations, engineering inference and risk, direct image-to-Table anomalies, required clarifications, and the preliminary engineering judgment");
  });

  it("validates every Feature output and supports an existing F6 artifact fast path", () => {
    const { internal } = splitSkillSections(readSkill());
    expect(internal).toContain("Entry mode 1 - TA workbook");
    expect(internal).toContain("Entry mode 2 - Existing F6 artifact");
    expect(internal).toContain("Feature6-Report.md");
    expect(internal).toContain("Feature6-Report.pdf");
    expect(internal).toContain("five-file");
    expect(internal).not.toContain("Feature6-Optimization.md");
    expect(internal).toContain("final Markdown and PDF report links");
    expect(internal).toContain("reportSummary");
    expect(internal).not.toContain(deprecatedF6ReportArtifactJsonName);
    expect(internal).toContain("without rerunning F0, F1, F2, F3, F4, F5, or F6");
    for (const feature of ["F1", "F2", "F3", "F4", "F5", "F6"]) {
      expect(internal).toContain(`\`${feature}\` output`);
    }
    expect(internal).toContain("contract, containment, identity, manifest, and recorded hashes");
  });

  it("requires validator-confirmed Markdown and PDF links for every successful completion", () => {
    const { internal } = splitSkillSections(readSkill());
    expect(internal).toContain("For every successful completion response");
    expect(internal).toContain("exactly two workspace-relative links");
    expect(internal).toContain("[Design Optimization Report](test/demo-output/f6-runs/<run-id>/Feature6-Report.md)");
    expect(internal).toContain("[Design Optimization PDF](test/demo-output/f6-runs/<run-id>/Feature6-Report.pdf)");
    expect(internal).toContain("Do not render absolute paths in the success response");
    expect(internal).toContain("use only the validated final report paths");
    expect(internal).toContain("do not present any report link");
    expect(internal.match(/\[Design Optimization Report\]\(test\/demo-output\/f6-runs\/<run-id>\/Feature6-Report\.md\)/g)).toHaveLength(1);
    expect(internal.match(/\[Design Optimization PDF\]\(test\/demo-output\/f6-runs\/<run-id>\/Feature6-Report\.pdf\)/g)).toHaveLength(1);
    expectOrdered(internal, [
      "[Design Optimization Report](test/demo-output/f6-runs/<run-id>/Feature6-Report.md)",
      "[Design Optimization PDF](test/demo-output/f6-runs/<run-id>/Feature6-Report.pdf)",
    ]);
  });

  it("documents final report scope from validated summary and manifest instead of Optimization alone", () => {
    const { internal } = splitSkillSections(readSkill());
    expect(internal).toContain("Optimization worksheet names must be a unique subset of reportSummary worksheet names");
    expect(internal).toContain("Any reportSummary worksheet not present in Optimization is blocked FAIL");
    expect(internal).toContain("reportSummary extras with any other disposition are blocked FAIL");
    expect(internal).toContain("The exact full report scope comes from the validated run summary and manifest, not from Optimization alone");
  });

  it("keeps deterministic runners local and the optional ADO adapter fail closed", () => {
    const { internal } = splitSkillSections(readSkill());
    for (const rule of [
      "Never request or expose credentials",
      "No REST, browser network, shell HTTP, curl, or Invoke-WebRequest for ADO",
      "Never modify the source workbook",
      "F3 and F6 repository runners remain deterministic and network-free",
      "Never publish automatically or implicitly",
      "Treat all inputs and outputs as confidential",
      "Stop on command failure or validation failure",
      "Do not continue from a historical or partial run",
    ]) expect(internal).toContain(rule);
  });

  it("keeps a governed command alive when the execution tool moves it to the background", () => {
    const internal = splitSkillSections(readSkill()).internal;
    const entrySkill = readFileSync(path.join(root, ".github", "skills", "ta-assist-agent", "SKILL.md"), "utf8");

    for (const skill of [entrySkill, internal]) {
      expect(skill).toContain("A tool timeout or background transition is not a command failure");
      expect(skill).toContain("retain the execution handle and continue retrieving its result");
      expect(skill).toContain("Do not send a final response while a required command is still running");
    }
  });

  it("documents product-triggered orchestration and governance mapping", () => {
    const documents = {
      readme: readFileSync(path.join(root, "README.md"), "utf8"),
      entrySkill: readFileSync(path.join(root, ".github", "skills", "ta-assist-agent", "SKILL.md"), "utf8"),
      englishFlow: readFileSync(path.join(root, "docs", "02-end-to-end-flow.md"), "utf8"),
      register: readFileSync(path.join(root, "docs", "governance", "feature-register.md"), "utf8"),
    };
    for (const markdown of [documents.readme, documents.englishFlow, documents.register]) expect(markdown).toContain("Design Optimization");
    expect(documents.readme).toContain("/ta-assist-agent");
    expect(documents.entrySkill).toContain("REQUIRED SUB-SKILL: Use design-optimization");
    expect(documents.englishFlow).toContain("F0 -> F1 -> F2 -> F3 -> F4 -> F5 -> F6");
    expect(documents.englishFlow).toContain("two worksheet confirmations");
    expect(documents.englishFlow).toContain("current-run F3");
    expect(documents.englishFlow).toContain("governance_required");
    expect(documents.englishFlow).toContain("optional ADO publishing gate");
    expect(documents.englishFlow).toContain("never automatic or implicit");
    expect(documents.englishFlow).toContain("f5-image-observation-v2");
    for (const check of [
      "f6-skill-contract-check",
      "f0-f6-real-workbook-flow",
      "f6-final-report-check",
    ]) expect(documents.register).toContain(check);
  });

  it("locks the entry language before any user-visible response", () => {
    const entrySkill = readFileSync(path.join(root, ".github", "skills", "ta-assist-agent", "SKILL.md"), "utf8");

    expect(entrySkill).toContain("Before any acknowledgement, plan, skill-loading update, or other user-visible text");
    expect(entrySkill).toContain("A naturally English request locks English");
    expect(entrySkill).toContain("Do not inherit the VS Code, host, or UI locale");
  });
});