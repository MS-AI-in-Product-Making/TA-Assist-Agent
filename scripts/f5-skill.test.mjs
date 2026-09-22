import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const skillPath = path.join(root, ".github", "skills", "result-interpretation", "SKILL.md");

const allowedCommands = [
  "npm run workflow:f2:excel -- <ta-workbook-path>",
  "npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm",
  "npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>",
];

const structuralScopes = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
  "cross_subsystem",
  "non_geometric_variable",
  "long_dimension_chain",
];

const frontmatterKeys = ["argument-hint", "description", "name", "user-invocable"];
const executableName = String.raw`(?:npm|npx|pnpm|yarn|bun|node|deno|python|python3|py|pwsh|powershell|bash|sh|curl|Invoke-WebRequest)`;
const executableStart = new RegExp(`^${executableName}(?:\\s|$)`, "i");
const imperativeExecutableStart = new RegExp(
  `^(?:please(?:\\s+run)?|run|use|execute|call|invoke)\\s*:?\\s*(${executableName}(?:\\s|$).*)`,
  "i",
);
const directWorkflowStart = /^workflow:[a-z0-9:-]+(?:\s|$)/i;
const dangerousPatterns = [
  /\b(?:allow|permit)\s+ADO\s+publishing\b/i,
  /\b(?:ignore|bypass)\s+(?:the\s+)?(?:recorded\s+)?hash(?:es|\s+validation)?\b/i,
  /\buse\s+(?:REST|HTTP)\b/i,
  /\bmodify\s+(?:the\s+)?(?:source\s+)?workbook\b/i,
  /\boverwrite\s+(?:the\s+)?(?:image\s+)?observation(?:\s+artifact)?\b/i,
  /\bapply_patch\b[^\n.]*\bobservation\b|\bobservation\b[^\n.]*\bapply_patch\b/i,
];

function readSkill() {
  return readFileSync(skillPath, "utf8");
}

it("aligns both image workflows on one immutable precreated workspace input", () => {
  for (const skill of ["result-interpretation", "design-optimization"]) {
    const text = readFileSync(path.join(root, ".github", "skills", skill, "SKILL.md"), "utf8");
    expect(text).not.toContain("test/demo-output/f5-observations/");
    expect(text).toContain("<validated-analysis-root>/05 - F5 Result Interpretation/Feature5-Image-Observations.json");
    expect(text).toContain("immutable input");
    expect(text).toContain("all other stage debris");
  }
});

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error("Missing or malformed frontmatter block.");
  if (Buffer.byteLength(match[0], "utf8") > 1024) throw new Error("Frontmatter exceeds 1024 bytes.");

  const values = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([a-z][a-z0-9-]*):[ \t]+(.+)$/);
    if (!field) throw new Error(`Malformed frontmatter line: ${line}`);
    if (values.has(field[1])) throw new Error(`Duplicate frontmatter key: ${field[1]}`);
    values.set(field[1], field[2].trim());
  }
  const keys = [...values.keys()].sort();
  if (JSON.stringify(keys) !== JSON.stringify(frontmatterKeys)) {
    throw new Error(`Unexpected frontmatter keys: ${keys.join(", ")}`);
  }

  const descriptionSource = values.get("description");
  if (!descriptionSource.startsWith('"') || !descriptionSource.endsWith('"')) {
    throw new Error("Description must be double quoted.");
  }
  let description;
  try {
    description = JSON.parse(descriptionSource);
  } catch {
    throw new Error("Description must be a valid closed quoted string.");
  }
  if (typeof description !== "string") throw new Error("Description must be a string.");

  const name = values.get("name");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error("Invalid skill name.");
  if (values.get("user-invocable") !== "true") throw new Error("user-invocable must be true.");
  const argumentHintSource = values.get("argument-hint");
  const argumentHint = argumentHintSource.startsWith('"')
    ? JSON.parse(argumentHintSource)
    : argumentHintSource;
  if (typeof argumentHint !== "string" || argumentHint.trim().length === 0) {
    throw new Error("argument-hint must be nonempty.");
  }
  return { argumentHint, description, name, raw: match[0] };
}

function commandLines(markdown) {
  const section = markdown.match(/### Allowed commands\r?\n([\s\S]*?)(?=\r?\n## |\r?\n### |$)/)?.[1] ?? "";
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- `npm run workflow:"))
    .map((line) => line.replace(/^- `|`$/g, ""));
}

function workflowCommands(markdown) {
  return [...markdown.matchAll(/npm\s+run\s+(workflow:[a-z0-9:-]+)/gi)]
    .map((match) => match[1].toLowerCase());
}

function normalizeMarkdownLine(line) {
  let normalized = line.trim();
  while (/^(?:>\s*|[-*+]\s+|\d+[.)]\s+)/.test(normalized)) {
    normalized = normalized.replace(/^(?:>\s*|[-*+]\s+|\d+[.)]\s+)/, "").trim();
  }
  return normalized
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\$\s+/, "")
    .replace(/(?:\*\*|__|~~)/g, "")
    .trim();
}

function executableCommands(markdown) {
  const candidates = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    const normalized = normalizeMarkdownLine(line);
    if (!normalized || /^```/.test(normalized)) continue;
    let foundInline = false;
    for (const match of normalized.matchAll(/`([^`\r\n]+)`/g)) {
      const executable = match[1].trim();
      if (executableStart.test(executable)) {
        candidates.add(executable);
        foundInline = true;
      }
    }
    if (foundInline) continue;
    const unquoted = normalized.replace(/`+/g, "");
    const imperative = unquoted.match(imperativeExecutableStart)?.[1]?.trim();
    if (imperative) candidates.add(imperative);
    else if (executableStart.test(unquoted) || directWorkflowStart.test(unquoted)) candidates.add(unquoted);
  }
  return [...candidates];
}

function affirmativeContradictions(markdown) {
  const hits = [];
  for (const clause of markdown.split(/[.;,\r\n]+|\b(?:but|however|and\s+then|then)\b/i)) {
    for (const pattern of dangerousPatterns) {
      const matches = clause.matchAll(new RegExp(pattern.source, `${pattern.flags}g`));
      for (const match of matches) {
        const left = clause.slice(0, match.index);
        const immediatelyNegated = /\b(?:never|no|do not|must not|prohibit(?:ed)?|forbid(?:den)?)\s*$/i.test(left);
        if (!immediatelyNegated) hits.push(match[0]);
      }
    }
  }
  return hits;
}

function expectOrdered(markdown, markers) {
  let previous = -1;
  for (const marker of markers) {
    const index = markdown.indexOf(marker);
    expect(index, `Missing ordered marker: ${marker}`).toBeGreaterThan(previous);
    previous = index;
  }
}

function markdownTable(markdown, heading) {
  const table = parseMarkdownTable(markdown, heading);
  const rows = table?.rows ?? [];
  expect(rows.length, `Missing markdown table under: ${heading}`).toBeGreaterThanOrEqual(3);
  const [headers, separator, ...body] = rows;
  expect(separator.every((cell) => /^:?-{3,}:?$/.test(cell)), `Invalid markdown table under: ${heading}`).toBe(true);
  return body.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function rowBy(table, column, value) {
  const rows = table.filter((candidate) => candidate[column] === value);
  expect(rows, `Expected exactly one ${column} row: ${value}`).toHaveLength(1);
  return rows[0];
}

function parseMarkdownTable(markdown, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingMatch = new RegExp(`^### ${escapedHeading}\\s*$`, "m").exec(markdown);
  if (!headingMatch) return undefined;

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const nextHeading = /\r?\n#{2,3}\s+/.exec(markdown.slice(sectionStart));
  const sectionEnd = nextHeading ? sectionStart + nextHeading.index : markdown.length;
  const section = markdown.slice(sectionStart, sectionEnd);
  const tableLines = [...section.matchAll(/^[ \t]*\|.*\|[ \t]*$/gm)];
  if (tableLines.length === 0) return undefined;

  const rows = tableLines.map((match) => match[0]
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim()));
  return {
    end: sectionStart + tableLines.at(-1).index + tableLines.at(-1)[0].length,
    rows,
    start: sectionStart + tableLines[0].index,
  };
}

function imageRuleViolations(markdown) {
  const violations = [];
  const tableContracts = [
    {
      heading: "Image availability routing",
      key: "Condition",
      values: [
        "F1 physical image or imageReference missing",
        "Image mode unavailable",
        "Incomplete or invalid observation",
      ],
    },
    {
      heading: "Image evidence classification gates",
      key: "Classification",
      values: ["high + unreviewed", "high + confirmed", "medium", "low", "rejected"],
    },
  ];
  const tableRanges = [];

  for (const contract of tableContracts) {
    const table = parseMarkdownTable(markdown, contract.heading);
    if (!table || table.rows.length < 3) {
      violations.push(`missing authoritative table: ${contract.heading}`);
      continue;
    }
    tableRanges.push({ end: table.end, start: table.start });
    const [headers, separator, ...body] = table.rows;
    if (!separator.every((cell) => /^:?-{3,}:?$/.test(cell))) {
      violations.push(`invalid authoritative table: ${contract.heading}`);
      continue;
    }
    const keyIndex = headers.indexOf(contract.key);
    if (keyIndex < 0) {
      violations.push(`missing table key column: ${contract.heading}.${contract.key}`);
      continue;
    }
    for (const value of contract.values) {
      const count = body.filter((cells) => cells[keyIndex] === value).length;
      if (count !== 1) violations.push(`expected one ${contract.key}: ${value}; found ${count}`);
    }
  }

  const prose = [...tableRanges]
    .sort((left, right) => right.start - left.start)
    .reduce((text, range) => `${text.slice(0, range.start)}${text.slice(range.end)}`, markdown);
  const conflictRules = [
    {
      message: "missing image may continue or become not_evaluated",
      pattern: /\bmissing\b[^.\r\n]*(?:physical\s+image|imageReference|image)[^.\r\n]*(?:\b(?:may|can|will|should)\s+continue\b|\b(?:as|be|become|produce)\s+not_evaluated\b)/i,
    },
    {
      message: "medium confidence may become FACT",
      pattern: /\bmedium(?:\s+confidence)?\b[^.\r\n]*\b(?:may|can|will|should)\s+(?:be\s+)?(?:recorded\s+as\s+)?(?:an?\s+)?(?:image\s+)?FACT\b/i,
    },
    {
      message: "confirmed evidence may bypass review or automatically become RULE",
      pattern: /\bconfirmed\b[^.\r\n]*(?:(?:needs?|requires?)\s+no\s+(?:ME\s+)?review|(?:may|can|will|should)\s+automatically\s+(?:create|become|produce)\s+(?:an?\s+)?RULE)\b/i,
    },
  ];
  for (const rule of conflictRules) {
    if (rule.pattern.test(prose)) violations.push(rule.message);
  }
  return violations;
}

function normalizeContractText(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function structuralScopeList(markdown) {
  const line = markdown.match(/^- Allowed scopes are (.+)\.$/m)?.[1] ?? "";
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

describe("result-interpretation skill contract", () => {
  it("starts RED while the skill file is absent", () => {
    expect(existsSync(skillPath), "SKILL.md must exist at .github/skills/result-interpretation/SKILL.md").toBe(true);
  });

  it("uses exact discoverable frontmatter with trigger-only description", () => {
    const metadata = parseFrontmatter(readSkill());
    expect(metadata.name).toBe("result-interpretation");
    expect(metadata.argumentHint).not.toBe("");
    expect(Buffer.byteLength(metadata.raw, "utf8")).toBeLessThanOrEqual(1024);

    const description = metadata.description;
    expect(description.startsWith("Use when")).toBe(true);
    for (const trigger of [
      "interpret TA calculations",
      "explain risks and drivers",
      "evaluate drawing evidence",
      "governed engineering findings",
    ]) {
      expect(description).toContain(trigger);
    }
    expect(description).not.toMatch(/\bF[0-7]\b|\bFeature[ _-]?[0-7]\b/iu);
    expect(description).not.toMatch(/workflow|run |select|validate|image observation|step\s*\d/i);

    const base = readSkill();
    expect(() => parseFrontmatter(base.replace('description: "', "description: "))).toThrow(/double quoted/);
    expect(() => parseFrontmatter(base.replace(/description: .*\r?\n/, 'description: "unterminated\n'))).toThrow(/double quoted|closed quoted/);
    expect(() => parseFrontmatter(base.replace("user-invocable: true", "name: duplicate\nuser-invocable: true"))).toThrow(/Duplicate/);
    expect(() => parseFrontmatter(base.replace("user-invocable: true", "unknown-key: value\nuser-invocable: true"))).toThrow(/Unexpected/);
    expect(() => parseFrontmatter(base.replace('argument-hint: "[<ta-workbook-path> | <interpretation-output-dir>]"', 'argument-hint: ""'))).toThrow(/nonempty/);
  });

  it("lists only repository-backed workflow command shapes", () => {
    const skill = readSkill();
    const scripts = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts;

    expect(commandLines(skill)).toEqual(allowedCommands);
    expect(executableCommands(skill)).toEqual(allowedCommands);
    expect(executableCommands([
      "Ordinary prose without an executable is ignored.",
      "**Run** `node unsafe-from-prose.mjs` to inspect the artifact.",
      "Run: `node unsafe-from-colon.mjs`",
      "Please run `curl https://example.invalid/from-please`.",
      "Please: `node unsafe-please.mjs`",
      "Use: `pwsh -File unsafe-use.ps1`",
      "Execute `powershell -File unsafe-execute.ps1`",
      "Call: `pnpm unsafe-call`",
      "Invoke `yarn unsafe-invoke`",
      "> `curl https://example.invalid/from-blockquote`",
    ].join("\n"))).toEqual([
      "node unsafe-from-prose.mjs",
      "node unsafe-from-colon.mjs",
      "curl https://example.invalid/from-please",
      "node unsafe-please.mjs",
      "pwsh -File unsafe-use.ps1",
      "powershell -File unsafe-execute.ps1",
      "pnpm unsafe-call",
      "yarn unsafe-invoke",
      "curl https://example.invalid/from-blockquote",
    ]);
    expect(executableCommands("- `node unsafe.mjs`\n\n```sh\npwsh -File unsafe.ps1\n```\n\n- curl https://example.invalid")).toEqual([
      "node unsafe.mjs",
      "pwsh -File unsafe.ps1",
      "curl https://example.invalid",
    ]);
    expect(executableCommands("Fallback command: `node unsafe.mjs`")).toEqual(["node unsafe.mjs"]);
    expect(executableCommands([
      "Inline candidate: `python image_model.py`.",
      "Run npx image-model after validation.",
      "```sh",
      "bash analyze.sh",
      "deno run image-analysis.ts",
      "```",
      "workflow:f0 --unsafe-direct-command",
      "The Python observation schema is descriptive ordinary prose.",
      "A bash shell is not itself an instruction to execute.",
    ].join("\n"))).toEqual([
      "python image_model.py",
      "npx image-model after validation.",
      "bash analyze.sh",
      "deno run image-analysis.ts",
      "workflow:f0 --unsafe-direct-command",
    ]);
    for (const adversarial of [
      "python image_model.py",
      "npx image-model after validation.",
      "bash analyze.sh",
      "deno run image-analysis.ts",
      "workflow:f0 --unsafe-direct-command",
    ]) {
      expect(allowedCommands).not.toContain(adversarial);
    }
    for (const commandStart of [
      "npm",
      "npx",
      "pnpm",
      "yarn",
      "bun",
      "node",
      "deno",
      "python",
      "python3",
      "py",
      "pwsh",
      "powershell",
      "bash",
      "sh",
      "curl",
      "Invoke-WebRequest",
    ]) {
      expect(executableCommands(`Run ${commandStart} unsafe-command`)).toEqual([`${commandStart} unsafe-command`]);
    }
    for (const executable of executableCommands(skill)) {
      expect(allowedCommands, `Non-whitelisted executable in SKILL.md: ${executable}`).toContain(executable);
    }
    expect([...new Set(workflowCommands(skill))].sort()).toEqual([
      "workflow:f2:excel",
      "workflow:f3",
      "workflow:f4",
      "workflow:f5",
    ]);
    expect(scripts["workflow:f2:excel"]).toBe("node scripts/f2-excel-runner.mjs");
    for (const command of ["workflow:f3", "workflow:f4", "workflow:f5"]) {
      expect(scripts[command], `${command} must be backed by package.json`).toMatch(/^node scripts\//);
    }
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f1\s+--\s+<ta-workbook-path>/i);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f2\s+--\s+<f1-output-dir>/i);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f4[^\n]*--worksheet/i);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f3:ado-reminder/i);
  });

  it("orders the F0 check, F1 selection handshake, ready selection, and downstream features", () => {
    const skill = readSkill();
    expectOrdered(skill, [
      "Phase W0 - Validate input and F0 capabilities",
      "Phase W1 - Generate F1 worksheet selection",
      "Phase W2 - Confirm and run F1 plus F2",
      "Phase W3 - Select ready worksheets",
      "Phase W4 - Run local F3",
      "Phase W5 - Run F4 from F2",
      "Phase W6 - Required workflow-owned image observations",
      "Phase W7 - Run F5 with the same selection",
      "Phase W8 - Validate and present F5",
    ]);
    expect(skill).toContain("Feature2-Report.json");
    expect(skill).toContain("status: readyForNextFeature");
    expect(skill).toContain("Worksheet Selection scope call - `vscode_askQuestions` (`multiSelect: true`)");
    expect(skill).toContain("Result Interpretation scope call - `vscode_askQuestions` (`multiSelect: true`)");
    expect(skill).toContain("at least one worksheet");
    expect(skill).toContain("No complete F1, F2, F3, F4, or F5 execution may begin before the first selection succeeds");
    expect(skill).toContain("No F3, F4, or F5 execution may begin before the second selection succeeds");
    expect(skill).toContain("stop before F3, F4, and F5");
    expect(skill).toContain("F3 and F5 receive the identical selected worksheet-name set");
    expect(skill).toContain("F4 may calculate every F2 ready worksheet because its runner has no worksheet flag");
    expect(skill.replaceAll("`", "")).toContain("F5 --worksheet filters F4 output back to the selected set");
  });

  it("keeps F0 internal and discloses controlled versions", () => {
    const skill = readSkill();
    expect(skill).toContain("`v1`");
    expect(skill).toContain("`internal-v1`");
    expect(skill).toContain("`interpretation-rules-v2`");
    expect(skill).toContain("validate the versions recorded by the F2 and F5 artifacts");
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
  });

  it("defines workbook and existing-artifact entry modes without implicit reruns", () => {
    const skill = readSkill();
    expect(skill).toContain("Entry mode 1 - TA workbook");
    expect(skill).toContain("Entry mode 2 - Existing F5 artifact");
    expect(skill).toContain("Feature5-Report.json");
    expect(skill).toContain("read `Feature5-Report.json`");
    expect(skill).toContain("`f5DataInterpretationResultSchema`");
    expect(skill).toMatch(/schema semantics.*`featureId: F5`.*classification.*status.*summary.*workbook.*contentHash.*worksheet/si);
    expect(skill).toContain("Do not execute node or any other non-whitelisted command");
    expect(skill).toContain("present the validated report without rerunning F1, F2, F3, F4, or F5");
    expect(skill).toContain("do not create or repeat image observations");
    expect(skill).toContain("F3 is local analysis only");
    expect(skill).toContain("Do not publish to ADO");
  });

  it("locks image observation schema, provenance, and confidence gates", () => {
    const skill = readSkill();
    const normalizedSkill = normalizeContractText(skill);
    for (const field of [
      "contractVersion",
      "inputClassification",
      "observationVersion",
      "workbookContentHash",
      "worksheets",
      "worksheetName",
      "imageReference",
      "observations",
      "scope",
      "observedValue",
      "confidence",
      "visibleBasis",
      "reviewStatus",
      "confirmedBy",
      "confirmedAt",
    ]) {
      expect(skill).toContain(`\`${field}\``);
    }
    expect(skill).toContain("f5-image-observation-v1");
    expect(skill).toContain("only the real file referenced by F1 imageReference");
    expect(skill).toContain("verify the controlled path and SHA-256 contentHash before viewing");
    expect(skill).toContain("record only visible evidence");
    expect(skill).toContain("Do not record hidden chain-of-thought or inferred unseen geometry");
    expect(skill.replaceAll("`", "")).toContain("confirmedBy and confirmedAt are required only when reviewStatus is confirmed");
    expect(skill).toContain("not_evaluated");
    expect(skill).toContain("current agent image capability");
    expect(skill).toContain("<validated-analysis-root>/05 - F5 Result Interpretation/Feature5-Image-Observations.json");
    for (const phrase of [
      "Current/default workspace publication requires one explicit validated analysisRoot plus the exact validated F1, F3, and F4 stage paths; do not infer workspace identity or stage selection from names alone.",
      "Create the observation artifact with create_file only.",
      "Never edit, overwrite, append to, or reuse an observation artifact or target.",
      "Before creation, check every existing ancestor for a reparse point, symlink, or junction.",
      "If ancestry is unverifiable, record the affected worksheet as failed and continue only other validated worksheets.",
      "After creation, read back and validate the artifact with f5ImageObservationArtifactSchema.",
      "Readback must exactly match the validated workbook content hash and selected worksheets.",
      "Each readback imageReference must exactly match the W3-verified relativePath, contentHash, and worksheetName; W6 does not independently rehash the physical image or the new observation artifact.",
    ]) {
      expect(normalizedSkill).toContain(phrase);
    }
    expect(skill).not.toContain("apply_patch");
    expect(skill).toContain("Do not claim that a shell command invokes an image model");
    expect(skill).toContain("Each result `image_text_context_review` SIGNAL copies the complete `visualObservation` into self-contained `visualEvidence`");
    expect(skill).toContain("Result validation uses `visualEvidence.visibleLabels`, never the existence of a visual FACT");
    expect(skill).toContain("Visual FACT gates do not remove or invalidate the context SIGNAL");
  });

  it("creates only immutable v2 observations through the governed W6 sequence", () => {
    const skill = readSkill();
    const normalizedSkill = normalizeContractText(skill);

    for (const phrase of [
      "f5-image-observation-v1 is historical read-only compatibility; new workbook image mode never creates v1.",
      "New image mode creates only f5-image-observation-v2.",
      "Current/default workspace publication requires one explicit validated analysisRoot plus the exact validated F1, F3, and F4 stage paths; do not infer workspace identity or stage selection from names alone.",
      "Create the observation artifact with create_file only.",
      "Never edit, overwrite, append to, or reuse an observation artifact or target.",
      "Before creation, check every existing ancestor for a reparse point, symlink, or junction.",
      "After creation, read back and validate the artifact with f5ImageObservationArtifactSchema.",
      "The F5 loader is the authoritative runtime revalidation gate for physical image SHA and content identity when consuming v2.",
      "The post-run summary records the observation artifact hash.",
      "Current/default workspace publication keeps Feature5-Report.json, Feature5-Report.md, Feature5-Run-Summary.json, Feature5-Image-Observations.json, and manifest.json directly under the fixed F5 stage. Do not publish under f5-runs, f5-observations, workbook-hash, run-id, or UUID subdirectories.",
      "Legacy explicit-root layouts remain low-level read compatibility only; do not switch the governed workspace flow back to them.",
      "No additional shell or hash command is permitted or invented.",
    ]) {
      expect(normalizedSkill).toContain(phrase);
    }

    expectOrdered(skill, [
      "Use every W3-verified selected F1 image",
      "Construct and validate the all-row context snapshot",
      "Ask exactly five image-mode questions per selected worksheet",
      "Create one immutable `f5-image-observation-v2` artifact",
      "Read back and validate schema, identity, and source rows",
      "Pass completed worksheet evidence to F5 and preserve failed worksheet outcomes for the final report",
    ]);
  });

  it("requires an exact all-row snapshot and exactly five contextual questions", () => {
    const skill = readSkill();
    const normalizedSkill = normalizeContractText(skill);

    for (const phrase of [
      "The context snapshot includes ALL active factor rows, not only top contributors.",
      "Its exact row set equals the verified F1/F3 selected rows.",
      "The snapshot preserves original partName and factorName, mapped partSubsystem and factorDescription, dimensionDescription, and source provenance.",
      "Current mapping requires partName to equal partSubsystem and factorName to equal factorDescription.",
      "Snapshot dimensionDescription equals every governance row dimensionDescription, and all governance rows for the worksheet agree.",
      "Each selected worksheet answers exactly five questions: tolerance_loop_closure, datum_chain, assembly_datum_face, stack_start, and direction.",
      "visualObservation may produce only an image FACT when the evidence gates permit.",
      "image_text_context_review is an independent contextual SIGNAL for every core scope.",
      "visualObservation records unique nonempty visibleLabels as structured visual evidence; never parse visibleBasis to discover labels.",
      "direction row links require structured linkedVisualLabels; never parse visibleBasis to infer links.",
      "Each direction linkedVisualLabels label exists in visualObservation.visibleLabels, and direction label/source row key sets align exactly.",
      "Non-direction scopes keep linkedVisualLabels empty but may link unique snapshot source rows and may use indicated_consistent or indicated_conflict when evidence permits.",
      "With no reliable mapping, linkedVisualLabels and linkedSourceRows are empty and signalValue is ambiguous or insufficient_evidence.",
      "Use the validated structured Factor rows as the only numeric source; do not OCR, reconstruct, or recalculate Factor values from the image.",
      "Do not state pass/fail, compliance, or capability conclusions unless the validated deterministic evidence contains the required specification.",
      "Model-generated reference interpretation may contain hallucinations, label mismatches, or omissions and must be reviewed by ME.",
    ]) {
      expect(normalizedSkill).toContain(phrase);
    }
  });

  it("requires direct image-to-Table anomaly comparison and a bounded user-facing narrative", () => {
    const normalizedSkill = normalizeContractText(readSkill());

    for (const phrase of [
      "Compare visible arrow direction and label mapping directly against linked structured Factor descriptions and nominal signs when both sides are explicit.",
      "Report each indicated_conflict prominently as a direct image-to-Table anomaly, preserving textBasis and linked Factor names, and label it as requiring ME review.",
      "The user-facing TA interpretation narrative must summarize tolerance-chain and Target understanding, capability results, major contributors and engineering risk, direct image-to-Table anomalies, and required clarifications.",
      "Do not include datum_chain or stack_start in the user-facing narrative; retain them only in governed internal evidence and the audit appendix.",
    ]) {
      expect(normalizedSkill).toContain(phrase);
    }
  });

  it("governs visual classifications independently from contextual signals for every core scope", () => {
    const skill = readSkill();
    const normalizedSkill = normalizeContractText(skill);
    for (const phrase of [
      "The current classification table governs only outputs derived from visualObservation.",
      "image_text_context_review is an independent contextual SIGNAL for every core scope.",
      "It remains present when visual confidence is low or visual reviewStatus is rejected.",
      "It always requires ME review and never creates a FACT, RULE, or final engineering determination.",
    ]) {
      expect(normalizedSkill).toContain(phrase);
    }

    const mutations = [
      normalizedSkill.replace("governs only outputs derived from visualObservation", "governs all observation outputs"),
      normalizedSkill.replace("an independent contextual SIGNAL for every core scope", "a contextual SIGNAL for selected scopes"),
      normalizedSkill.replace("remains present when visual confidence is low or visual reviewStatus is rejected", "is omitted when visual confidence is low or visual reviewStatus is rejected"),
      normalizedSkill.replace("always requires ME review and never creates a FACT, RULE, or final engineering determination", "may create a FACT after ME review"),
    ];
    for (const mutated of mutations) {
      expect(mutated).not.toBe(normalizedSkill);
      expect(mutated).not.toContain("The current classification table governs only outputs derived from visualObservation. image_text_context_review is an independent contextual SIGNAL for every core scope. It remains present when visual confidence is low or visual reviewStatus is rejected. It always requires ME review and never creates a FACT, RULE, or final engineering determination.");
    }
  });

  it("assigns image and observation SHA checks to existing governed mechanisms", () => {
    const skill = readSkill();
    const normalizedSkill = normalizeContractText(skill);
    for (const phrase of [
      "W3 already validates each F1 physical image SHA and keeps its verified imageReference.",
      "W6 readback must exactly match those already verified image references and the v2 snapshot and source identities.",
      "The F5 loader is the authoritative runtime revalidation gate for physical image SHA and content identity when consuming v2.",
      "The post-run summary records the observation artifact hash.",
      "No additional shell or hash command is permitted or invented.",
    ]) {
      expect(normalizedSkill).toContain(phrase);
    }
    expect(normalizedSkill).not.toContain("Verify the immutable artifact SHA-256 after readback.");
    expect(skill).not.toMatch(/(?:run|use|invoke|execute)\s+(?:an?\s+)?(?:independent\s+)?(?:shell\s+)?(?:hash|sha-?256)\s+command/i);
  });

  it("isolates invalid required image evidence by worksheet", () => {
    const skill = readSkill();
    const normalizedSkill = normalizeContractText(skill);

    for (const phrase of [
      "Every selected worksheet reaches one terminal outcome.",
      "Any worksheet, scope, snapshot, readback, image, or mapping mismatch fails that worksheet without discarding valid completed worksheets.",
      "A worksheet baseline identity mismatch fails that worksheet and prohibits its F5 continuation while preserving other valid worksheets.",
    ]) {
      expect(normalizedSkill).toContain(phrase);
    }

    expect(commandLines(skill)).toEqual(allowedCommands);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f[06]\b/i);
    expect(skill).not.toMatch(/(?:npm|node|pwsh|powershell)\s+[^\n`]*(?:image-model|image_model)/i);
    expect(skill).not.toMatch(/npm\s+run\s+[^\n`]*ado/i);
  });

  it("lists all eight structural scopes exactly once in contract order", () => {
    expect(structuralScopeList(readSkill())).toEqual(structuralScopes);
  });

  it("fails required image evaluation by worksheet while preserving other worksheets", () => {
    const routes = markdownTable(readSkill(), "Image availability routing");
    const physicalMissing = rowBy(routes, "Condition", "F1 physical image or imageReference missing");
    expect(physicalMissing["Worksheet routing"]).toBe("fail_closed; exclude from F5 ready");
    expect(physicalMissing["F5 continuation"]).toBe("prohibited; do not promise continuation");
    expect(physicalMissing["Tolerance result"]).toBe("not produced");

    for (const condition of [
      "Image mode unavailable",
      "Incomplete or invalid observation",
    ]) {
      const route = rowBy(routes, "Condition", condition);
      expect(route["Prerequisite"]).toBe("verified existing F1 imageReference");
      expect(route["Worksheet routing"]).toBe("worksheet FAIL");
      expect(route["F5 continuation"]).toBe("prohibit that worksheet; continue others");
      expect(route["Tolerance result"]).toBe("required evaluation failed");
    }
  });

  it("keeps image evidence classifications within exact review and conclusion boundaries", () => {
    const skill = readSkill();
    const gates = markdownTable(skill, "Image evidence classification gates");
    const highUnreviewed = rowBy(gates, "Classification", "high + unreviewed");
    expect(highUnreviewed["FACT"]).toBe("image FACT only");
    expect(highUnreviewed["SIGNAL"]).toBe("requiresEngineeringReview");
    expect(highUnreviewed["RULE"]).toBe("prohibited");
    expect(highUnreviewed["Final engineering determination"]).toBe("prohibited");

    const confirmed = rowBy(gates, "Classification", "high + confirmed");
    expect(confirmed["ME review"]).toBe("still required");
    expect(confirmed["RULE"]).toBe("prohibited; never automatic");

    const medium = rowBy(gates, "Classification", "medium");
    expect(medium["FACT"]).toBe("prohibited");
    expect(medium["SIGNAL"]).toBe("at most SIGNAL");
    const low = rowBy(gates, "Classification", "low");
    expect(low["SIGNAL"]).toBe("visual-derived SIGNAL prohibited; independent context SIGNAL preserved");
    expect(low["Conclusion handling"]).toBe("clarification plus context SIGNAL");
    const rejected = rowBy(gates, "Classification", "rejected");
    expect(rejected["FACT"]).toBe("prohibited");
    expect(rejected["SIGNAL"]).toBe("visual-derived SIGNAL prohibited; independent context SIGNAL preserved");
    expect(rejected["RULE"]).toBe("prohibited");
    expect(rejected["Conclusion handling"]).toBe(
      "excluded from visual conclusions; emit clarification and preserve context SIGNAL",
    );

    expect(imageRuleViolations(skill)).toEqual([]);
    const mutated = `${skill}\nA missing physical image may continue as not_evaluated.\nMedium confidence can be recorded as an image FACT.\nConfirmed evidence needs no ME review and may automatically create a RULE.\n`;
    expect(imageRuleViolations(mutated)).toEqual([
      "missing image may continue or become not_evaluated",
      "medium confidence may become FACT",
      "confirmed evidence may bypass review or automatically become RULE",
    ]);
    const duplicateMedium = skill.replace(
      "| medium | prohibited | at most SIGNAL | prohibited | prohibited | required before promotion | SIGNAL only |",
      "| medium | prohibited | at most SIGNAL | prohibited | prohibited | required before promotion | SIGNAL only |\n| medium | prohibited | at most SIGNAL | prohibited | prohibited | required before promotion | SIGNAL only |",
    );
    expect(imageRuleViolations(duplicateMedium)).toContain("expected one Classification: medium; found 2");
  });

  it("enforces confidentiality, boundaries, sequencing, and fail-closed behavior", () => {
    const skill = readSkill();
    for (const rule of [
      "Never request or expose credentials",
      "No REST, browser, shell HTTP, curl, or Invoke-WebRequest",
      "Never modify the source workbook",
      "No implicit ADO access or publishing",
      "Do not perform F6 calculation or recommendation",
      "Treat all inputs and outputs as confidential",
      "Validate path containment, artifact identity, and hashes before use",
      "Run commands only in the documented phase order",
      "Stop on command failure or validation failure",
    ]) {
      expect(skill).toContain(rule);
    }
    expect(affirmativeContradictions(skill)).toEqual([]);
    expect(affirmativeContradictions("Never allow ADO publishing. Do not modify the source workbook.")).toEqual([]);
    expect(affirmativeContradictions("Do not allow ADO publishing")).toEqual([]);
    expect(affirmativeContradictions("Do not use REST or allow ADO publishing")).toEqual(["allow ADO publishing"]);
    expect(affirmativeContradictions("Do not use REST; allow ADO publishing")).toEqual(["allow ADO publishing"]);
    expect(affirmativeContradictions("Do not use REST, but allow ADO publishing")).toEqual(["allow ADO publishing"]);
    expect(affirmativeContradictions("Never overwrite the observation artifact")).toEqual([]);
    expect(affirmativeContradictions("Never modify the source workbook or overwrite the observation artifact")).toEqual(["overwrite the observation artifact"]);
    expect(affirmativeContradictions("Never modify the source workbook, then overwrite the observation artifact")).toEqual(["overwrite the observation artifact"]);
    expect(affirmativeContradictions("Do not use REST or browser")).toEqual([]);
    expect(affirmativeContradictions("Allow ADO publishing. Bypass hash validation. Use REST. Modify the source workbook. Overwrite the observation artifact. Use apply_patch for the observation artifact.")).toEqual([
      "Allow ADO publishing",
      "Bypass hash validation",
      "Use REST",
      "Modify the source workbook",
      "Overwrite the observation artifact",
      "apply_patch for the observation",
    ]);
  });
});