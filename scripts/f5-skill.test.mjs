import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const skillPath = path.join(root, ".github", "skills", "f5-analysis", "SKILL.md");

const allowedCommands = [
  "npm run workflow:f1 -- <ta-workbook-path>",
  "npm run workflow:f2 -- <f1-output-dir>",
  "npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>",
];

const frontmatterKeys = ["argument-hint", "description", "name", "user-invocable"];
const executableStart = /^(?:npm|pnpm|yarn|node|pwsh|powershell|curl|Invoke-WebRequest)(?:\s|$)/i;
const imperativeExecutableStart = /^(?:please(?:\s+run)?|run|use|execute|call|invoke)\s*:?\s*((?:npm|pnpm|yarn|node|pwsh|powershell|curl|Invoke-WebRequest)(?:\s|$).*)/i;
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
  const section = markdown.match(/## Allowed commands\r?\n([\s\S]*?)(?=\r?\n## |$)/)?.[1] ?? "";
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
    else if (executableStart.test(unquoted)) candidates.add(unquoted);
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
        "User skips image evaluation",
        "No observation artifact generated",
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

describe("f5-analysis skill contract", () => {
  it("starts RED while the skill file is absent", () => {
    expect(existsSync(skillPath), "SKILL.md must exist at .github/skills/f5-analysis/SKILL.md").toBe(true);
  });

  it("uses exact discoverable frontmatter with trigger-only description", () => {
    const metadata = parseFrontmatter(readSkill());
    expect(metadata.name).toBe("f5-analysis");
    expect(metadata.argumentHint).not.toBe("");
    expect(Buffer.byteLength(metadata.raw, "utf8")).toBeLessThanOrEqual(1024);

    const description = metadata.description;
    expect(description.startsWith("Use when")).toBe(true);
    for (const trigger of [
      "F5",
      "使用F5分析报告",
      "使用 F5 分析报告",
      "use F5 analysis report",
      "F0/F1/F3/F4 TA data interpretation",
    ]) {
      expect(description).toContain(trigger);
    }
    expect(description).not.toMatch(/workflow|run |select|validate|image observation|step\s*\d/i);

    const base = readSkill();
    expect(() => parseFrontmatter(base.replace('description: "', "description: "))).toThrow(/double quoted/);
    expect(() => parseFrontmatter(base.replace(/description: .*\r?\n/, 'description: "unterminated\n'))).toThrow(/double quoted|closed quoted/);
    expect(() => parseFrontmatter(base.replace("user-invocable: true", "name: duplicate\nuser-invocable: true"))).toThrow(/Duplicate/);
    expect(() => parseFrontmatter(base.replace("user-invocable: true", "unknown-key: value\nuser-invocable: true"))).toThrow(/Unexpected/);
    expect(() => parseFrontmatter(base.replace('argument-hint: "[<ta-workbook-path> | <f5-output-dir>]"', 'argument-hint: ""'))).toThrow(/nonempty/);
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
    for (const executable of executableCommands(skill)) {
      expect(allowedCommands, `Non-whitelisted executable in SKILL.md: ${executable}`).toContain(executable);
    }
    expect([...new Set(workflowCommands(skill))].sort()).toEqual([
      "workflow:f1",
      "workflow:f2",
      "workflow:f3",
      "workflow:f4",
      "workflow:f5",
    ]);
    for (const command of ["workflow:f1", "workflow:f2", "workflow:f3", "workflow:f4", "workflow:f5"]) {
      expect(scripts[command], `${command} must be backed by package.json`).toMatch(/^node scripts\//);
    }
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f4[^\n]*--worksheet/i);
    expect(skill).not.toMatch(/npm\s+run\s+workflow:f3:ado-reminder/i);
  });

  it("orders workbook phases and selects ready worksheets before F3, F4, and F5", () => {
    const skill = readSkill();
    expectOrdered(skill, [
      "Phase W1 - Run F1",
      "Phase W2 - Run F2",
      "Phase W3 - Select ready worksheets",
      "Phase W4 - Run local F3",
      "Phase W5 - Run F4 from F2",
      "Phase W6 - Optional image observations",
      "Phase W7 - Run F5 with the same selection",
      "Phase W8 - Validate and present F5",
    ]);
    expect(skill).toContain("Feature2-Report.json");
    expect(skill).toContain("status: readyForNextFeature");
    expect(skill).toContain("vscode_askQuestions");
    expect(skill).toContain("multiSelect: true");
    expect(skill).toContain("at least one worksheet");
    expect(skill).toContain("stop before F3, F4, and F5");
    expect(skill).toContain("F3 and F5 receive the identical selected worksheet-name set");
    expect(skill).toContain("F4 may calculate every F2 ready worksheet because its runner has no worksheet flag");
    expect(skill.replaceAll("`", "")).toContain("F5 --worksheet filters F4 output back to the selected set");
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
    expect(skill).toContain("test/demo-output/f5-observations/<workbook-content-hash>/<system-generated-uuid>/Feature5-Image-Observations.json");
    for (const phrase of [
      "The UUID must be system-generated and must not be user-derived.",
      "Create the observation artifact with create_file only.",
      "Never edit, overwrite, append to, or reuse an observation artifact or target.",
      "Before creation, check every existing ancestor for a reparse point, symlink, or junction.",
      "If ancestry is unverifiable, do not create the artifact; continue deterministic F5 with not_evaluated plus clarification.",
      "After creation, read back and validate the artifact with f5ImageObservationArtifactSchema.",
      "Readback must exactly match the validated workbook content hash and selected worksheets.",
      "Each readback imageReference must exactly match relativePath, contentHash, and worksheetName, including SHA-256 contentHash verification.",
    ]) {
      expect(normalizedSkill).toContain(phrase);
    }
    expect(skill).not.toContain("apply_patch");
    expect(skill).toContain("Do not claim that a shell command invokes an image model");
  });

  it("fails closed for a missing F1 physical image or imageReference but continues deterministic F5 when observation is skipped", () => {
    const routes = markdownTable(readSkill(), "Image availability routing");
    const physicalMissing = rowBy(routes, "Condition", "F1 physical image or imageReference missing");
    expect(physicalMissing["Worksheet routing"]).toBe("fail_closed; exclude from F5 ready");
    expect(physicalMissing["F5 continuation"]).toBe("prohibited; do not promise continuation");
    expect(physicalMissing["Tolerance result"]).toBe("not produced");

    for (const condition of [
      "Image mode unavailable",
      "User skips image evaluation",
      "No observation artifact generated",
    ]) {
      const route = rowBy(routes, "Condition", condition);
      expect(route["Prerequisite"]).toBe("verified existing F1 imageReference");
      expect(route["Worksheet routing"]).toBe("remain F5 ready");
      expect(route["F5 continuation"]).toBe("continue deterministic F5");
      expect(route["Tolerance result"]).toBe("not_evaluated + clarification");
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
    expect(rowBy(gates, "Classification", "low")["Conclusion handling"]).toBe("clarification only");
    const rejected = rowBy(gates, "Classification", "rejected");
    expect(rejected["FACT"]).toBe("prohibited");
    expect(rejected["SIGNAL"]).toBe("prohibited");
    expect(rejected["RULE"]).toBe("prohibited");
    expect(rejected["Conclusion handling"]).toBe(
      "excluded from conclusions; emit clarification requiring reviewer/new evidence",
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