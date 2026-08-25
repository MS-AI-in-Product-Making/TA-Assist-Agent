import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeF3AdoReminder } from "./write-f3-ado-reminder.mjs";

const root = process.cwd();
const skillPath = path.join(root, ".github", "skills", "f3-analysis", "SKILL.md");
const referencePath = path.join(root, ".github", "skills", "f3-analysis", "references", "ado-publishing.md");
const englishFlowPath = path.join(root, "docs", "02-end-to-end-flow.md");
const chineseFlowPath = path.join(root, "docs", "02-端到端流程.md");
const featureRegisterPath = path.join(root, "docs", "governance", "feature-register.md");

function readUtf8(filePath) {
  return readFileSync(filePath, "utf8");
}

function getFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return match ? match[1] : "";
}

function getWorkflowCommands(markdown) {
  const matches = markdown.match(/npm\s+run\s+(workflow:[a-z0-9:-]+)/gi) ?? [];
  return [...new Set(matches.map((token) => token.toLowerCase().replace(/^npm\s+run\s+/, "")))];
}

function getCommandExampleLines(markdown) {
  const sectionMatch = markdown.match(/## Supported local workflow commands \(repository-verified\)([\s\S]*?)\n## /);
  if (!sectionMatch) return [];
  const block = sectionMatch[1];
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- `npm run "))
    .map((line) => line.replace(/^- `|`$/g, ""));
  return lines;
}

function extractAdoReminderCommandsFromSkill(markdown) {
  const commandExamples = getCommandExampleLines(markdown);
  return commandExamples.filter((line) => line.startsWith("npm run workflow:f3:ado-reminder -- "));
}

function parseOutcomeFromCommand(commandLine) {
  const statusMatch = commandLine.match(/--status\s+([a-z_]+)/i);
  if (!statusMatch) throw new Error(`Missing --status in command: ${commandLine}`);
  const reasonMatch = commandLine.match(/--reason-code\s+([a-z_]+)/i);
  const hasReference = /--work-item-reference\s+<id>/i.test(commandLine);
  return {
    status: statusMatch[1],
    reasonCode: reasonMatch?.[1],
    hasReference,
  };
}

function extractStatusReasonMatrixFromReference(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const matrix = [];
  const matrixLine = /^-\s*(.+?)\s*->\s*status\s*`([^`]+)`(?:\s*\+\s*reason\s*`([^`]+)`)?(?:\s*\(([^)]*)\))?$/i;
  for (const line of lines) {
    const match = line.match(matrixLine);
    if (!match) continue;
    matrix.push({
      flow: match[1],
      status: match[2],
      reasonCode: match[3],
      note: match[4],
    });
  }
  return matrix;
}

function acceptedReport() {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "governance_required",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [{
      worksheetName: "TP_Gap_X",
      toleranceLoopDescription: "Anonymous device gap",
      rows: [{
        factorInstanceId: "b".repeat(64),
        drawingDimensionKey: undefined,
        deviceLevelDim: "TP_Gap_X",
        dimensionDescription: "Anonymous device gap",
        partCategory: "Display",
        partSubsystem: "Anonymous bracket",
        drawingNumber: "DRAW-A",
        dimId: "307",
        factorDescription: "Anonymous display offset",
        nominal: 3.145,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        sigmaLevel: 4,
        dimIdStatus: "valid",
        qualitySignals: [],
        governanceStatus: "needs_governance",
        imageReference: {
          artifact: "f1",
          relativePath: "worksheets/TP_Gap_X/tolerance-path.png",
          contentHash: "c".repeat(64),
          worksheetName: "TP_Gap_X",
        },
        source: {
          worksheetName: "TP_Gap_X",
          tableId: "factor-table-1",
          sourceRow: 14,
          sourceCells: { factorName: "TP_Gap_X!E14" },
        },
      }],
    }],
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: 1,
      factorCount: 1,
      completeCount: 0,
      governanceRequiredCount: 1,
      duplicateConflictCount: 0,
    },
  };
}

const tempRoots = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function setupF3RootForSkillTests() {
  const root = mkdtempSync(path.join(tmpdir(), "f3-skill-"));
  tempRoots.push(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "Feature3-Report.json"), `${JSON.stringify(acceptedReport(), null, 2)}\n`, "utf8");
  return root;
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let index = 0;
  let count = 0;
  while (true) {
    const hit = text.indexOf(needle, index);
    if (hit === -1) return count;
    count += 1;
    index = hit + needle.length;
  }
}

function getPackageScripts() {
  const packageJson = JSON.parse(readUtf8(path.join(root, "package.json")));
  return packageJson.scripts ?? {};
}

function expectContainsAny(haystack, markers, message) {
  const matched = markers.some((marker) => haystack.includes(marker));
  expect(matched, `${message}: expected one of [${markers.join(" | ")}]`).toBe(true);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHeadingLineMatches(markdown, headingLine) {
  const pattern = new RegExp(`^${escapeRegExp(headingLine)}\\s*$`, "gm");
  return [...markdown.matchAll(pattern)].map((match) => ({
    start: match.index ?? -1,
    text: match[0],
  }));
}

function extractSectionByHeading(markdown, headingLine) {
  const matches = getHeadingLineMatches(markdown, headingLine);
  if (matches.length === 0) return "";
  if (matches.length > 1) {
    throw new Error(`Expected exactly one heading '${headingLine}', found ${matches.length}`);
  }
  const sectionStart = matches[0].start;
  const bodyStart = markdown.indexOf("\n", sectionStart);
  if (bodyStart === -1) return "";
  const nextHeadingOffset = markdown.slice(bodyStart + 1).search(/\n##\s+/);
  if (nextHeadingOffset === -1) return markdown.slice(bodyStart + 1);
  return markdown.slice(bodyStart + 1, bodyStart + 1 + nextHeadingOffset + 1);
}

function getLevel2HeadingLines(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => /^##\s+/.test(line));
}

function extractBlockBeforeMarker(section, startMarker, endMarker) {
  const start = section.indexOf(startMarker);
  if (start === -1) return "";
  const end = section.indexOf(endMarker, start);
  if (end === -1) return "";
  return section.slice(start, end);
}

function getIndentedBulletOptionLines(markdownBlock) {
  return markdownBlock
    .split(/\r?\n/)
    .filter((line) => /^(?:\s{2,}|\t+)-\s+/.test(line));
}

function extractFirstMermaidBlock(markdown) {
  const match = markdown.match(/```mermaid\r?\n([\s\S]*?)\r?\n```/);
  return match?.[1] ?? "";
}

describe("f3-analysis skill contract", () => {
  it("starts RED when skill/reference are absent", () => {
    expect(existsSync(skillPath), "SKILL.md must exist at .github/skills/f3-analysis/SKILL.md").toBe(true);
    expect(existsSync(referencePath), "reference must exist at .github/skills/f3-analysis/references/ado-publishing.md").toBe(true);
  });

  it("uses valid skill frontmatter for VS Code discovery", () => {
    const skill = readUtf8(skillPath);
    const frontmatter = getFrontmatter(skill);

    expect(frontmatter.length).toBeGreaterThan(0);
    expect(frontmatter).toMatch(/^name:\s*f3-analysis\s*$/m);
    expect(frontmatter).toMatch(/^user-invocable:\s*true\s*$/m);
    expect(frontmatter).toMatch(/^argument-hint:\s*.+\s*$/m);

    const descriptionLine = frontmatter.match(/^description:\s*(.+)$/m)?.[1] ?? "";
    const normalizedDescription = descriptionLine.replace(/^"|"$/g, "").trim();
    expect(normalizedDescription.startsWith("Use when")).toBe(true);
    expect(normalizedDescription).toContain("F3");
    expect(normalizedDescription).toContain("使用 F3 分析报告");
    expect(normalizedDescription).toContain("TA workbook/report");
    expect(normalizedDescription).toContain("DIM ID");
    expect(normalizedDescription).toContain("Drawing Number");
    expect(normalizedDescription).toContain("ADO Work Item");

    // Description should be trigger-only and must not summarize process steps.
    expect(normalizedDescription).not.toMatch(/run\s+f0|run\s+f1|run\s+f2|run\s+f3|step\s*1|workflow\s+steps|prepare\s*->\s*confirm\s*->\s*execute/i);
  });

  it("keeps skill concise and links reference by relative path", () => {
    const skill = readUtf8(skillPath);
    const lineCount = skill.split(/\r?\n/).length;
    expect(lineCount).toBeLessThan(500);
    expect(skill).toContain("[ADO publishing protocol](./references/ado-publishing.md)");
  });

  it("locks complete workflow commands to repository scripts and real argument shapes", () => {
    const skill = readUtf8(skillPath);
    const scripts = getPackageScripts();
    const commands = getWorkflowCommands(skill);
    const commandExamples = getCommandExampleLines(skill);
    const allowed = new Set([
      "workflow:f2:excel",
      "workflow:f3",
      "workflow:f3:ado-reminder",
    ]);

    expect(scripts["workflow:f2:excel"]).toBe("node scripts/f2-excel-runner.mjs");
    expect(scripts["workflow:f3"]).toBe("node scripts/run-f3-full-validation.mjs");
    expect(scripts["workflow:f3:ado-reminder"]).toBe("node scripts/write-f3-ado-reminder.mjs");

    expect(commands).toContain("workflow:f2:excel");
    expect(commands).toContain("workflow:f3");
    expect(commands).toContain("workflow:f3:ado-reminder");

    // Lock complete example lines in skill to package script keys and argument shapes.
    expect(commandExamples).toEqual([
      "npm run workflow:f2:excel -- <ta-workbook-path>",
      "npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm",
      "npm run workflow:f3 -- <f2-output-dir>",
      "npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status not_requested",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status updated --work-item-reference <id>",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_unavailable",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_authentication_failed",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_comment_body_unsupported",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_comment_body_unsupported --work-item-reference <id>",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status failed --reason-code write_verification_failed",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status failed --reason-code write_verification_failed --work-item-reference <id>",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code user_declined_write",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code user_declined_write --work-item-reference <id>",
    ]);

    for (const example of commandExamples) {
      const key = example.match(/^npm\s+run\s+(workflow:[a-z0-9:-]+)/i)?.[1]?.toLowerCase();
      expect(Boolean(key), `Unable to parse script key from example: ${example}`).toBe(true);
      if (key) {
        expect(typeof scripts[key]).toBe("string");
      }
    }

    for (const command of commands) {
      expect(allowed.has(command), `Unsupported workflow command in skill: ${command}`).toBe(true);
    }

    expect(skill).not.toContain("npm run workflow:f1 -- <ta-workbook-path>");
    expect(skill).not.toContain("npm run workflow:f2 -- <f1-output-dir>");
    expect(skill).toContain("npm run workflow:f2:excel -- <ta-workbook-path>");
    expect(skill).toContain("npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm");
    expect(skill).toContain("npm run workflow:f3 -- <f2-output-dir>");
    expect(skill).toContain("npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]");
    expect(skill).toContain("npm run workflow:f3:ado-reminder -- <f3-dir> --status not_requested");
    expect(skill).toContain("npm run workflow:f3:ado-reminder -- <f3-dir> --status updated --work-item-reference <id>");
    expect(skill).toContain("npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_comment_body_unsupported");
    expect(skill).toContain("npm run workflow:f3:ado-reminder -- <f3-dir> --status failed --reason-code write_verification_failed");
    expect(skill).toContain("npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code user_declined_write");

    // Ensure no placeholder command shape that bypasses npm script reality.
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f3:ado-reminder\s+--\s+<f3-dir>\s+--status\s+cancel/i);
  });

  it("requires the F1 selection handshake before F2 validation and F3 selection", () => {
    const skill = readUtf8(skillPath);
    const markers = [
      "Workbook step 1 - generate F1 selection",
      "F1/F2 scope call - vscode_askQuestions (multiSelect: true)",
      "Workbook step 2 - confirm F1 and run F2",
      "Worksheet selection call - vscode_askQuestions (multiSelect: true)",
      "Run workflow:f3 only after the worksheet selection call returns at least one selection.",
    ];
    let previous = -1;
    for (const marker of markers) {
      const index = skill.indexOf(marker);
      expect(index, `Missing ordered marker: ${marker}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(skill).toContain("public `v1` and internal `internal-v1`");
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
  });

  it("requires ready worksheet selection before F3 and validates existing targets from an ADO URL", () => {
    const skill = readUtf8(skillPath);
    const reference = readUtf8(referencePath);
    const worksheetCall = "Worksheet selection call - vscode_askQuestions (multiSelect: true)";
    const executionBoundary = "Run workflow:f3 only after the worksheet selection call returns at least one selection.";
    const publishCall = "Question call 1 - publishing mode: vscode_askQuestions";
    const urlCall = "Existing target URL call - vscode_askQuestions";

    expect(skill).toContain(worksheetCall);
    expect(skill).toContain("F2 ready worksheets");
    expect(skill).toContain("stop without running F3");
    expect(skill).toContain(executionBoundary);
    expect(skill.indexOf(worksheetCall)).toBeLessThan(skill.indexOf(executionBoundary));
    expect(skill.indexOf(executionBoundary)).toBeLessThan(skill.indexOf(publishCall));

    expect(skill).toContain(urlCall);
    expect(skill).toContain("HTTPS Azure DevOps work item URL");
    expect(skill).toContain("_workitems/edit/<id>");
    expect(skill).toContain("parse organization, project, and positive integer work item ID from the URL");
    expect(skill).toContain("Do not ask for a separately entered ADO number");
    expect(skill).toContain("do not persist the ADO URL");
    expect(skill.indexOf(urlCall)).toBeGreaterThan(skill.indexOf(publishCall));
    expect(skill).toContain("URL organization/project/ID must match the Surface readback target");

    expect(reference).toContain("HTTPS Azure DevOps work item URL");
    expect(reference).toContain("_workitems/edit/<id>");
    expect(reference).toContain("URL is ephemeral validation input");
    expect(reference).toContain("Do not accept an independently entered work item ID");
    expect(reference).toContain("fail closed before any Surface write");
  });

  it("requires explicit Question call 1 marker before entity-call boundary", () => {
    const skill = readUtf8(skillPath);
    const question1Marker = "Question call 1 - publishing mode: vscode_askQuestions";
    const boundaryMarker = "Surface MCP entity calls may start only after Question call 1 returns";
    const question1Index = skill.indexOf(question1Marker);
    const boundaryIndex = skill.indexOf(boundaryMarker);
    const choiceCreateIndex = skill.indexOf("Create a new ADO work item");
    const choiceExistingIndex = skill.indexOf("Use an existing ADO work item");
    const choiceNoPublishIndex = skill.indexOf("Do not publish to ADO");

    expect(question1Index).toBeGreaterThan(-1);
    expect(countOccurrences(skill, question1Marker)).toBe(1);
    expect(boundaryIndex).toBeGreaterThan(-1);
    expect(countOccurrences(skill, boundaryMarker)).toBe(1);
    expect(choiceCreateIndex).toBeGreaterThan(-1);
    expect(choiceExistingIndex).toBeGreaterThan(-1);
    expect(choiceNoPublishIndex).toBeGreaterThan(-1);
    expect(question1Index).toBeLessThan(boundaryIndex);
    expect(choiceCreateIndex).toBeLessThan(boundaryIndex);
    expect(choiceExistingIndex).toBeLessThan(boundaryIndex);
    expect(choiceNoPublishIndex).toBeLessThan(boundaryIndex);
  });

  it("connects and authenticates Surface MCP after publishing mode and before entity validation", () => {
    const skill = readUtf8(skillPath);
    const reference = readUtf8(referencePath);
    const publishGate = "Question call 1 - publishing mode: vscode_askQuestions";
    const connectionPhase = "## Phase 3 - Surface connection and authentication";
    const readOnlyTrigger = "read-only organization listing";
    const validationPhase = "## Phase 4 - Surface validation flow";

    expect(skill.indexOf(connectionPhase)).toBeGreaterThan(skill.indexOf(publishGate));
    expect(skill.indexOf(readOnlyTrigger)).toBeGreaterThan(skill.indexOf(connectionPhase));
    expect(skill.indexOf(validationPhase)).toBeGreaterThan(skill.indexOf(readOnlyTrigger));
    expect(skill).toContain("VS Code native authentication");
    expect(skill).toContain("Wait for the tool call to return");
    expect(skill).toContain("Confirm authentication completed");
    expect(skill).toContain("exactly one additional read-only organization listing");
    expect(skill).toContain("Never retry automatically");
    expect(skill).toContain("Never request passwords, PATs, tokens, verification codes, or MFA responses");
    expect(reference).toContain("configured -> connected -> authenticated -> entity validated");
    expect(reference).toContain("authorization completion can race the first read-only call");
  });

  it("documents validated create/existing/no-publish flows and exact fallback command", () => {
    const skill = readUtf8(skillPath);

    expect(skill).toContain("validate organization -> project -> work item type via Surface MCP");
    expect(skill).toContain("candidate correction");
    expect(skill).toContain("Default: Task");
    expect(skill).toContain("title");
    expect(skill).toContain("no unvalidated create");

    expect(skill).toContain("read back ID, title, type, state, assigned owner");
    expect(skill).toContain("ask user to confirm target");

    expect(skill).toContain("npm run workflow:f3:ado-reminder -- <f3-dir> --status not_requested");
  });

  it("requires deterministic English preview and governed write contract", () => {
    const skill = readUtf8(skillPath);

    expect(skill).toContain("deterministic English preview");
    expect(skill).toContain("exact 11 columns");
    expect(skill).toContain("no model rewriting records");

    expect(skill).toContain("inspect real Surface tool schema");
    expect(skill).toContain("full Markdown body");
    expect(skill).toContain("surface_mcp_comment_body_unsupported");

    expect(skill).toContain("Question call 2 - final write confirmation: vscode_askQuestions");
    expect(skill).toContain("Confirm write");
    expect(skill).toContain("org/project/ID/title/factor/governance/complete preview/write effect");
    expect(skill).toContain("schema-compatible local fallback");

    expect(skill).toContain("write exactly once");
    expect(skill).toContain("readback full body/hash");
    expect(skill).toContain("no retry");
    expect(skill).toContain("write_verification_failed");

    expect(skill).toContain("Never use Azure DevOps MCP");
    expect(skill).toContain("no REST/browser/shell HTTP");
    expect(skill).toContain("no body-less/empty comment");
    expect(skill).toContain("no raw body/secrets on CLI");
  });

  it("enforces two distinct askQuestions calls and forbids combining them", () => {
    const skill = readUtf8(skillPath);
    const q1 = "Question call 1 - publishing mode: vscode_askQuestions";
    const q2 = "Question call 2 - final write confirmation: vscode_askQuestions";
    const boundary = "Surface MCP entity calls may start only after Question call 1 returns";
    const preview = "deterministic English preview";
    const write = "write exactly once";
    const forbidCombine = "MUST be separate and never combined.";

    const q1Index = skill.indexOf(q1);
    const boundaryIndex = skill.indexOf(boundary);
    const previewIndex = skill.indexOf(preview);
    const q2Index = skill.indexOf(q2);
    const writeIndex = skill.indexOf(write);

    expect(countOccurrences(skill, q1)).toBe(1);
    expect(countOccurrences(skill, q2)).toBe(1);
    expect(countOccurrences(skill, "vscode_askQuestions")).toBeGreaterThanOrEqual(2);

    expect(q1Index).toBeGreaterThan(-1);
    expect(boundaryIndex).toBeGreaterThan(q1Index);
    expect(previewIndex).toBeGreaterThan(boundaryIndex);
    expect(q2Index).toBeGreaterThan(previewIndex);
    expect(writeIndex).toBeGreaterThan(q2Index);

    expect(skill).toContain(forbidCombine);
    expect(countOccurrences(skill, forbidCombine)).toBe(1);
  });

  it("reference defines exact query order, capability rules, table header, and mappings", () => {
    const reference = readUtf8(referencePath);

    expect(reference).toContain("organization -> project -> work item type/work item id");
    expect(reference).toContain("candidate correction");
    expect(reference).toContain("capability");
    expect(reference).toContain("English payload contract");

    expect(reference).toContain("| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |");

    expect(reference).toContain("drawing_number_missing -> Drawing Number missing");
    expect(reference).toContain("dim_id_missing -> DIM ID missing");
    expect(reference).toContain("dim_id_suspected_invalid -> DIM ID suspected invalid");
    expect(reference).toContain("dim_id_needs_confirmation -> DIM ID needs confirmation");
    expect(reference).toContain("duplicate_conflict -> Duplicate Drawing Number and DIM ID conflict");
    expect(reference).toContain("no signal -> Complete");
  });

  it("defines exact status/reason matrix in reference and keeps all six flows unique", () => {
    const reference = readUtf8(referencePath);
    const matrix = extractStatusReasonMatrixFromReference(reference);

    expect(matrix).toEqual([
      {
        flow: "initial no publish",
        status: "not_requested",
        reasonCode: undefined,
        note: "no reason/reference",
      },
      {
        flow: "Surface MCP unavailable",
        status: "blocked",
        reasonCode: "surface_mcp_unavailable",
        note: undefined,
      },
      {
        flow: "Surface MCP authentication failed",
        status: "blocked",
        reasonCode: "surface_mcp_authentication_failed",
        note: undefined,
      },
      {
        flow: "final user decline",
        status: "blocked",
        reasonCode: "user_declined_write",
        note: undefined,
      },
      {
        flow: "body capability unsupported",
        status: "blocked",
        reasonCode: "surface_mcp_comment_body_unsupported",
        note: undefined,
      },
      {
        flow: "write/readback mismatch",
        status: "failed",
        reasonCode: "write_verification_failed",
        note: undefined,
      },
    ]);

    const signatures = new Set(matrix.map((row) => `${row.status}|${row.reasonCode ?? ""}`));
    expect(signatures.size).toBe(6);

    expect(reference).toContain("`updated` is persisted only after readback verification and carries no reason code.");
    expect(reference).toContain("local reminder fallback is not required on successful update");
  });

  it("derives fallback commands from Skill and validates outcomes with real writer constraints", () => {
    const skill = readUtf8(skillPath);
    const commands = extractAdoReminderCommandsFromSkill(skill);
    const fallbackCommands = commands.filter((line) =>
      line.includes("--status not_requested")
      || line.includes("--reason-code surface_mcp_unavailable")
      || line.includes("--reason-code surface_mcp_authentication_failed")
      || line.includes("--reason-code user_declined_write")
      || line.includes("--reason-code surface_mcp_comment_body_unsupported")
      || line.includes("--reason-code write_verification_failed"));

    expect(fallbackCommands).toEqual([
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status not_requested",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_unavailable",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_authentication_failed",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_comment_body_unsupported",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code surface_mcp_comment_body_unsupported --work-item-reference <id>",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status failed --reason-code write_verification_failed",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status failed --reason-code write_verification_failed --work-item-reference <id>",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code user_declined_write",
      "npm run workflow:f3:ado-reminder -- <f3-dir> --status blocked --reason-code user_declined_write --work-item-reference <id>",
    ]);

    const seenSignatures = new Set();
    for (const command of fallbackCommands) {
      const parsed = parseOutcomeFromCommand(command);
      const outputRoot = setupF3RootForSkillTests();
      const outcome = {
        status: parsed.status,
        ...(parsed.reasonCode ? { reasonCode: parsed.reasonCode } : {}),
        ...(parsed.hasReference ? { workItemReference: "1102392" } : {}),
      };

      const result = writeF3AdoReminder({ f3OutputRoot: outputRoot, adoOutcome: outcome });
      const persisted = JSON.parse(readUtf8(path.join(outputRoot, "Feature3-Report.json")));

      expect(result.report.ado).toEqual(outcome);
      expect(persisted.ado).toEqual(outcome);
      seenSignatures.add(`${outcome.status}|${outcome.reasonCode ?? ""}|${outcome.workItemReference ? "ref" : "noref"}`);
    }

    expect(seenSignatures.size).toBe(fallbackCommands.length);
  });

  it("enforces ordering/policy/fallback statements", () => {
    const skill = readUtf8(skillPath);
    const reference = readUtf8(referencePath);

    const phase1Index = skill.indexOf("## Phase 1 - Preconditions and entry");
    const phase2Index = skill.indexOf("## Phase 2 - Publish mode gate");
    const boundaryIndex = skill.indexOf("Surface MCP entity calls may start only after Question call 1 returns");
    const phase3Index = skill.indexOf("## Phase 3 - Surface connection and authentication");
    const phase4Index = skill.indexOf("## Phase 4 - Surface validation flow");
    const phase5Index = skill.indexOf("## Phase 5 - Preview and final write confirmation");
    const previewIndex = skill.indexOf("deterministic English preview");
    const confirmIndex = skill.indexOf("Question call 2 - final write confirmation: vscode_askQuestions");
    const writeIndex = skill.indexOf("write exactly once");
    expect(phase1Index).toBeGreaterThan(-1);
    expect(phase2Index).toBeGreaterThan(phase1Index);
    expect(boundaryIndex).toBeGreaterThan(phase2Index);
    expect(phase3Index).toBeGreaterThan(boundaryIndex);
    expect(phase4Index).toBeGreaterThan(phase3Index);
    expect(phase5Index).toBeGreaterThan(phase4Index);
    expect(previewIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeGreaterThan(phase5Index);
    expect(confirmIndex).toBeGreaterThan(previewIndex);
    expect(writeIndex).toBeGreaterThan(confirmIndex);

    // F0 reality must be explicit and tied to package scripts, with strict stop/ask behavior.
    expect(skill).toContain("There is no executable `workflow:f0` script in package.json.");
    expect(skill).toContain("stop and ask for valid input");

    // Initial no-publish vs final cancel semantics are different and schema-compatible.
    expect(skill).toContain("--status not_requested");
    expect(skill).toContain("--status blocked --reason-code user_declined_write");
    expect(skill).toContain("work item reference only if valid target exists");

    expect(reference).toContain("If body capability is missing, do not call Surface comment write");
    expect(reference).toContain("local fallback reason: surface_mcp_comment_body_unsupported");
    expect(skill).toContain("must be refused");
    expect(skill).toContain("generate local fallback");
    expect(skill).toContain("Never use Azure DevOps MCP/REST/browser/shell HTTP");
  });

  it("governs the Surface System.History comment channel", () => {
    const skill = readUtf8(skillPath);
    const reference = readUtf8(referencePath);

    for (const contract of [skill, reference]) {
      expect(contract).toContain("mcp_surface_mcp_p_update_work_item");
      expect(contract).toContain("/fields/System.History");
      expect(contract).toContain("mcp_surface_mcp_p_list_work_item_comments");
      expect(contract).toContain("Feature3-ADO-History.html");
      expect(contract).toContain("confirmedHistoryHtml");
      expect(contract).toContain("comment format `html`");
      expect(contract).toContain("ADO-safe canonical HTML");
      expect(contract).toContain("canonical HTML text and SHA-256");
      expect(contract).toContain("11 headers and the expected marked factor row count");
      expect(contract).toContain("data-f3-factor-row=\"true\"");
      expect(contract).toContain("data-f3-group-row=\"true\"");
      expect(contract).toContain("exactly one new comment");
      expect(contract).toContain("SHA-256");
      expect(contract).toContain("write_verification_failed");
      expect(contract.match(/`top: 200`/g)).toHaveLength(2);
      expect(contract.match(/Never pass a `top` value greater than `200`/g)).toHaveLength(2);
    }

    expect(reference).toContain('"op": "add"');
    expect(reference).toContain('"path": "/fields/System.History"');
    expect(reference).toContain("value: confirmedHistoryHtml");
    expect(reference).toContain("Do not add any other JSON Patch operation");
    expect(skill).toContain("direct comment channel uses `confirmedMarkdownBody`");
    expect(skill).toContain("System.History channel uses `confirmedHistoryHtml`");

    const snapshotIndex = skill.indexOf("snapshot existing comment IDs");
    const previewIndex = skill.indexOf("deterministic English preview");
    const confirmIndex = skill.indexOf("Question call 2 - final write confirmation: vscode_askQuestions");
    const writeIndex = skill.indexOf("call `mcp_surface_mcp_p_update_work_item` exactly once");
    const readbackIndex = skill.indexOf("read back comments exactly once");

    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeGreaterThan(snapshotIndex);
    expect(confirmIndex).toBeGreaterThan(previewIndex);
    expect(writeIndex).toBeGreaterThan(confirmIndex);
    expect(readbackIndex).toBeGreaterThan(writeIndex);
  });

  it("keeps phase markers and askQuestions markers strictly separated and ordered", () => {
    const skill = readUtf8(skillPath);
    const phase2 = "## Phase 2 - Publish mode gate";
    const phase3 = "## Phase 3 - Surface connection and authentication";
    const phase4 = "## Phase 4 - Surface validation flow";
    const phase5 = "## Phase 5 - Preview and final write confirmation";
    const phase6 = "## Phase 6 - Write execution contract";
    const q1 = "Question call 1 - publishing mode: vscode_askQuestions";
    const boundary = "Surface MCP entity calls may start only after Question call 1 returns";
    const preview = "deterministic English preview";
    const q2 = "Question call 2 - final write confirmation: vscode_askQuestions";
    const confirmWrite = "Confirm write";
    const separate = "MUST be separate and never combined.";

    const phase2Index = skill.indexOf(phase2);
    const phase3Index = skill.indexOf(phase3);
    const phase4Index = skill.indexOf(phase4);
    const phase5Index = skill.indexOf(phase5);
    const phase6Index = skill.indexOf(phase6);
    const q1Index = skill.indexOf(q1);
    const boundaryIndex = skill.indexOf(boundary);
    const previewIndex = skill.indexOf(preview);
    const q2Index = skill.indexOf(q2);
    const confirmWriteIndex = skill.indexOf(confirmWrite);

    expect(countOccurrences(skill, q1)).toBe(1);
    expect(countOccurrences(skill, boundary)).toBe(1);
    expect(countOccurrences(skill, q2)).toBe(1);
    expect(countOccurrences(skill, "Confirm write")).toBe(1);
    expect(countOccurrences(skill, separate)).toBe(1);

    expect(q1Index).toBeGreaterThan(phase2Index);
    expect(boundaryIndex).toBeGreaterThan(q1Index);
    expect(boundaryIndex).toBeLessThan(phase3Index);
    expect(phase4Index).toBeGreaterThan(phase3Index);

    expect(previewIndex).toBeGreaterThan(phase5Index);
    expect(q2Index).toBeGreaterThan(previewIndex);
    expect(phase6Index).toBeGreaterThan(q2Index);
    expect(confirmWriteIndex).toBeGreaterThan(q2Index);
    expect(q2Index).toBeLessThan(phase6Index);
  });

  it("rejects duplicate target headings instead of selecting the first section", () => {
    const duplicated = [
      "## Key Decision Points",
      "alpha",
      "## Another",
      "x",
      "## Key Decision Points",
      "beta",
    ].join("\n");

    expect(() => extractSectionByHeading(duplicated, "## Key Decision Points")).toThrow(
      "Expected exactly one heading '## Key Decision Points', found 2");
  });

  it("documents governed F3 ADO publishing flow in EN/CN flow docs and governance register", () => {
    const englishFlow = readUtf8(englishFlowPath);
    const chineseFlow = readUtf8(chineseFlowPath);
    const featureRegister = readUtf8(featureRegisterPath);
    const englishMermaid = extractFirstMermaidBlock(englishFlow);
    const chineseMermaid = extractFirstMermaidBlock(chineseFlow);
    const englishKeyHeading = "## Key Decision Points";
    const chineseKeyHeading = "## 关键决策点";
    const englishContractHeading = "## F3 Governed ADO Publishing Contract";
    const chineseContractHeading = "## F3 受治理 ADO 发布契约";

    expect(englishMermaid.length).toBeGreaterThan(0);
    expect(chineseMermaid.length).toBeGreaterThan(0);
    expect(englishMermaid).toContain("REQ -- Yes --> DIFF");
    expect(englishMermaid).toContain("REQ -- No --> FIX");
    expect(chineseMermaid).toContain("REQ -- 是 --> DIFF");
    expect(chineseMermaid).toContain("REQ -- 否 --> FIX");

    expect(getHeadingLineMatches(englishFlow, englishKeyHeading).length).toBe(1);
    expect(getHeadingLineMatches(chineseFlow, chineseKeyHeading).length).toBe(1);
    expect(getHeadingLineMatches(englishFlow, englishContractHeading).length).toBe(1);
    expect(getHeadingLineMatches(chineseFlow, chineseContractHeading).length).toBe(1);

    const englishHeadings = getLevel2HeadingLines(englishFlow);
    const chineseHeadings = getLevel2HeadingLines(chineseFlow);

    expect(englishHeadings).toEqual([
      "## F1 to F2 Evidence Contract",
      "## F5 Governed Interpretation Contract",
      "## Flow Diagram",
      "## Key Decision Points",
      "## F3 Governed ADO Publishing Contract",
    ]);
    expect(chineseHeadings).toEqual([
      "## F1 到 F2 证据契约",
      "## F5 受治理解读契约",
      "## 流程图",
      "## 关键决策点",
      "## F3 受治理 ADO 发布契约",
    ]);

    expect(englishHeadings.length).toBe(chineseHeadings.length);
    expect(englishHeadings.indexOf(englishKeyHeading)).toBeLessThan(englishHeadings.indexOf(englishContractHeading));
    expect(chineseHeadings.indexOf(chineseKeyHeading)).toBeLessThan(chineseHeadings.indexOf(chineseContractHeading));

    const englishF3Section = extractSectionByHeading(englishFlow, englishContractHeading);
    const chineseF3Section = extractSectionByHeading(chineseFlow, chineseContractHeading);
    const englishKeySection = extractSectionByHeading(englishFlow, englishKeyHeading);
    const chineseKeySection = extractSectionByHeading(chineseFlow, chineseKeyHeading);

    expect(englishF3Section.length).toBeGreaterThan(0);
    expect(chineseF3Section.length).toBeGreaterThan(0);
    expect(englishKeySection.length).toBeGreaterThan(0);
    expect(chineseKeySection.length).toBeGreaterThan(0);

    expectContainsAny(englishFlow, [
      "future roadmap",
      "Future roadmap",
    ], "EN must label milestone/date write intent as future roadmap");
    expectContainsAny(chineseFlow, [
      "未来路线图",
      "未来规划",
    ], "CN must label milestone/date write intent as future roadmap");
    expectContainsAny(englishFlow, [
      "out of current F3 scope",
      "outside current F3 scope",
    ], "EN must state current milestone/date write is out of scope");
    expectContainsAny(chineseFlow, [
      "不在当前 F3 范围",
      "超出当前 F3 范围",
    ], "CN must state current milestone/date write is out of scope");

    const englishGovernanceBoundaryText = englishFlow;
    const chineseGovernanceBoundaryText = chineseFlow;

    expectContainsAny(englishGovernanceBoundaryText, ["scheduler"], "missing EN no-scheduler boundary");
    expectContainsAny(englishGovernanceBoundaryText, ["milestone timer"], "missing EN no milestone timer boundary");
    expectContainsAny(englishGovernanceBoundaryText, ["date-triggered reminder"], "missing EN no date-triggered reminder boundary");
    expectContainsAny(englishGovernanceBoundaryText, ["F4 calculation/handoff mutation"], "missing EN no F4 mutation boundary");

    expectContainsAny(chineseGovernanceBoundaryText, ["scheduler", "调度器"], "missing CN no-scheduler boundary");
    expectContainsAny(chineseGovernanceBoundaryText, ["milestone timer", "里程碑计时器"], "missing CN no milestone timer boundary");
    expectContainsAny(chineseGovernanceBoundaryText, ["date-triggered reminder", "日期触发提醒"], "missing CN no date-triggered reminder boundary");
    expectContainsAny(chineseGovernanceBoundaryText, ["F4 calculation/handoff mutation", "F4 计算/交接变更"], "missing CN no F4 mutation boundary");

    for (const flowSection of [englishF3Section, chineseF3Section]) {
      expect(flowSection).toContain(".github/skills/f3-analysis/SKILL.md");

      const question1Marker = "Question call 1 - publishing mode";
      const boundaryMarker = "Surface MCP entity calls may start only after Question call 1 returns";
      const validationMarker = "organization/project/type or ID";
      const previewMarker = "complete preview";
      const question2Marker = "Question call 2 - final write confirmation";
      const writeMarker = "Feature3-ADO-Reminder.md";

      const question1Index = flowSection.indexOf(question1Marker);
      const boundaryIndex = flowSection.indexOf(boundaryMarker);
      const validationIndex = flowSection.indexOf(validationMarker);
      const previewIndex = flowSection.indexOf(previewMarker);
      const question2Index = flowSection.indexOf(question2Marker);
      const writeIndex = flowSection.indexOf(writeMarker);

      expect(question1Index).toBeGreaterThan(-1);
      expect(boundaryIndex).toBeGreaterThan(question1Index);
      expect(validationIndex).toBeGreaterThan(boundaryIndex);
      expect(previewIndex).toBeGreaterThan(validationIndex);
      expect(question2Index).toBeGreaterThan(previewIndex);
      expect(writeIndex).toBeGreaterThan(question2Index);

      const publishingChoiceBlock = extractBlockBeforeMarker(flowSection, question1Marker, boundaryMarker);
      const choiceOptionLines = getIndentedBulletOptionLines(publishingChoiceBlock);
      const expectedChoices = [
        "Create a new ADO work item",
        "Use an existing ADO work item",
        "Do not publish to ADO",
      ];

      expect(publishingChoiceBlock.length).toBeGreaterThan(0);
      expect(choiceOptionLines.length).toBe(3);
      expect(choiceOptionLines.map((line) => line.trim())).toEqual(expectedChoices.map((choice) => `- ${choice}`));
      for (const choice of expectedChoices) {
        expect(countOccurrences(publishingChoiceBlock, choice)).toBe(1);
      }

      expectContainsAny(flowSection, [
        "Surface MCP-only",
        "仅允许 Surface MCP",
      ], "missing Surface MCP-only validation scope");
      expectContainsAny(flowSection, [
        "candidate correction",
        "候选纠正",
      ], "missing candidate correction");

      expectContainsAny(flowSection, [
        "Default: Task",
        "默认类型：Task",
      ], "missing default type Task");

      expectContainsAny(flowSection, [
        "comment template text is fixed English",
        "评论模板文本固定为英文",
      ], "missing fixed English comment/template rule");
      expectContainsAny(flowSection, [
        "Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue",
        "Device Level Dim｜Dimension Description｜Part / Subsystem｜Drawing Number｜Dim ID｜Factor Description｜Nominal｜Upper Tolerance (+)｜Lower Tolerance (-)｜σ Level｜Governance issue",
      ], "missing exact fixed 11-column header");

      const reasonCodeLine = flowSection
        .split(/\r?\n/)
        .find((line) => line.includes("Feature3-ADO-Reminder.md") && line.includes("user_declined_write"));
      expect(Boolean(reasonCodeLine), "missing governed fallback reason-code statement").toBe(true);
      for (const reasonCode of [
        "user_declined_write",
        "surface_mcp_comment_body_unsupported",
        "write_verification_failed",
      ]) {
        expect(countOccurrences(reasonCodeLine ?? "", reasonCode), `missing explicit reason code: ${reasonCode}`).toBe(1);
      }

      expectContainsAny(flowSection, [
        "bodyless Surface schema",
        "Surface schema 无 body",
      ], "missing bodyless schema blocked rule");
      expectContainsAny(flowSection, [
        "never empty comment",
        "禁止空评论",
      ], "missing never-empty-comment rule");

      expectContainsAny(flowSection, [
        "System.History",
      ], "missing governed System.History channel");
      expectContainsAny(flowSection, [
        "Feature3-ADO-History.html",
      ], "missing HTML history artifact");
      expectContainsAny(flowSection, [
        "confirmedHistoryHtml",
      ], "missing channel-specific HTML body");
      expectContainsAny(flowSection, [
        "exactly one new comment",
        "恰好一个新增评论",
      ], "missing new-comment readback rule");
      expectContainsAny(flowSection, [
        "exact text and SHA-256",
        "正文与 SHA-256 完全一致",
        "exact HTML text and SHA-256",
        "HTML 正文与 SHA-256 完全一致",
        "canonical HTML text and SHA-256",
        "ADO-safe canonical HTML 正文与 SHA-256",
      ], "missing exact body verification rule");

      expectContainsAny(flowSection, [
        "Never use Azure DevOps MCP/REST/browser/shell HTTP",
        "不得使用 Azure DevOps MCP/REST/browser/shell HTTP",
      ], "missing never-use-Azure-DevOps-fallback rule");

      expectContainsAny(flowSection, [
        "no scheduler/milestone timer",
        "无 scheduler/milestone timer",
        "no scheduler, no milestone timer",
        "无 scheduler、无 milestone timer",
      ], "missing no-scheduler-timer boundary");
      expectContainsAny(flowSection, [
        "no F4 calculation/handoff impact",
        "不影响 F4 计算/交接",
        "no F4 calculation/handoff mutation",
        "不发生 F4 计算/交接变更",
      ], "missing no F4 impact boundary");
    }

    // Governance register should stay concise but still lock key F3 contract points.
    expect(featureRegister).toContain(".github/skills/f3-analysis/SKILL.md");
    expect(featureRegister).toContain("F3");
    expect(featureRegister).toContain("drawing-governance-v2");
    expect(featureRegister).toContain("surface-mcp-adapter-v1");
    expectContainsAny(featureRegister, [
      "Create a new ADO work item",
      "Use an existing ADO work item",
      "Do not publish to ADO",
    ], "feature register missing governed publish choices");
    expect(featureRegister).toContain("Question call 1");
    expect(featureRegister).toContain("Question call 2");
    expect(featureRegister).toContain("Default: Task");
    expect(featureRegister).toContain("Feature3-ADO-Reminder.md");
    expect(featureRegister).toContain("surface_mcp_comment_body_unsupported");
    expect(featureRegister).toContain("write_verification_failed");
    expect(featureRegister).toContain("user_declined_write");
    expect(featureRegister).toContain("Never use Azure DevOps MCP/REST/browser/shell HTTP");
    expect(featureRegister).toContain("no scheduler/milestone timer");
    expect(featureRegister).toContain("no F4 calculation/handoff impact");
    expect(featureRegister).toContain("System.History");
    expect(featureRegister).toContain("Feature3-ADO-History.html");
    expect(featureRegister).toContain("confirmedHistoryHtml");
    expect(featureRegister).toContain("exactly one new comment");
  });
});
