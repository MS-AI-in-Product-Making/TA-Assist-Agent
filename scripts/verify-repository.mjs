import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const forbiddenPatterns = [
  /(^|\/)\.env(?:\.(?!example$).+)?$/,
  /(^|\/)(?:runtime|exports)(?:\/|$)/,
  /(^|\/)fixtures\/confidential(?:\/|$)/i,
  /\.(xls|xlsx|xlsm)$/i,
];

export function isForbiddenRepositoryPath(path) {
  const normalizedPath = path.replaceAll("\\", "/").toLowerCase();
  return forbiddenPatterns.some((pattern) => pattern.test(normalizedPath));
}

const englishEngineeringPaths = new Set([
  "README.md",
  "docs/README.md",
  "package.json",
  ".github/skills/ta-assist-agent/SKILL.md",
  "docs/00-overview.md",
  "docs/01-architecture.md",
  "docs/02-end-to-end-flow.md",
  "docs/03-differentiation.md",
  "docs/04-feature-breakdown.md",
  "docs/05-design-decisions.md",
]);

export function hasCjkText(content) {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(content);
}

export function isEnglishEngineeringPath(repositoryPath) {
  return englishEngineeringPaths.has(repositoryPath.replaceAll("\\", "/"));
}

export function findEngineeringLanguageViolations(paths, read = (repositoryPath) => readFileSync(repositoryPath, "utf8")) {
  return paths.filter((repositoryPath) => isEnglishEngineeringPath(repositoryPath) && hasCjkText(read(repositoryPath)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const violations = tracked.filter(isForbiddenRepositoryPath);
  const languageViolations = findEngineeringLanguageViolations(tracked);

  if (violations.length > 0 || languageViolations.length > 0) {
    console.error(`Forbidden tracked paths:\n${violations.join("\n")}`);
    if (languageViolations.length > 0) console.error(`Non-English engineering entry assets:\n${languageViolations.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("Repository classified-path and engineering-language checks passed.");
  }
}