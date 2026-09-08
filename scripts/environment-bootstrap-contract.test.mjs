import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const skillPath = join(root, ".github", "skills", "environment-bootstrap", "SKILL.md");
const bootstrapPath = join(root, "scripts", "bootstrap-environment.ps1");
const entrySkillPath = join(root, ".github", "skills", "ta-assist-agent", "SKILL.md");

assert.equal(existsSync(skillPath), true, "environment-bootstrap SKILL.md must exist");
assert.equal(existsSync(bootstrapPath), true, "bootstrap-environment.ps1 must exist");

const skill = readFileSync(skillPath, "utf8");
const bootstrap = readFileSync(bootstrapPath, "utf8");
const entrySkill = readFileSync(entrySkillPath, "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

assert.match(skill, /^---\r?\nname: environment-bootstrap\r?$/m);
assert.match(skill, /Use when .*dependency installation.*build tool.*missing/is);
assert.match(skill, /diagnose.*before.*repair/is);
assert.match(skill, /do not modify.*global.*npm/is);
assert.match(skill, /permission|credential|administrator/is);
assert.match(bootstrap, /npm ci/);
assert.match(bootstrap, /EUSAGE[\s\S]*package-lock-only/);
assert.match(bootstrap, /replace-registry-host=never/);
assert.match(bootstrap, /\$ciArguments\s*=\s*@\("ci", "--ignore-scripts", "--no-audit", "--no-fund"\)/);
assert.match(bootstrap, /npm(?:\.cmd)? run build/);
assert.equal(packageJson.scripts["environment:bootstrap"], "pwsh -NoProfile -File scripts/bootstrap-environment.ps1");
assert.match(entrySkill, /REQUIRED SUB-SKILL: Use environment-bootstrap/);
assert.ok(
  entrySkill.indexOf("REQUIRED SUB-SKILL: Use environment-bootstrap")
    < entrySkill.indexOf("REQUIRED SUB-SKILL: Use design-optimization"),
  "environment bootstrap must run before design optimization",
);

console.log("environment bootstrap contract: PASS");