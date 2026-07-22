import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const forbiddenPatterns = [
  /(^|\/)\.env(?:\.(?!example$).+)?$/,
  /(^|\/)(?:runtime|exports)(?:\/|$)/,
  /\.(xlsx|xlsm)$/i,
];

export function isForbiddenRepositoryPath(path) {
  return forbiddenPatterns.some((pattern) => pattern.test(path.replaceAll("\\", "/")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const violations = tracked.filter(isForbiddenRepositoryPath);

  if (violations.length > 0) {
    console.error(`Forbidden tracked paths:\n${violations.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("Repository classified-path check passed.");
  }
}