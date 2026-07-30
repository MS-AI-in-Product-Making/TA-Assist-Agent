import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const scriptPath = resolve(import.meta.dirname, "verify-f4-excel-regression.ps1");

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function validMapping(overrides = {}) {
  return {
    version: "excel-ta-v1",
    inputs: [{ cell: "A1", value: 42 }],
    outputs: [{ name: "result", cell: "B2", expected: 42 }],
    ...overrides,
  };
}

function runHarness(args, options = {}) {
  return spawnSync("pwsh", ["-NoProfile", "-File", scriptPath, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
}

function withFixture(mapping, callback) {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "f4-excel-regression-"));
  const workbookContent = Buffer.from("dummy xlsx bytes for validate-only");
  const workbookPath = join(fixtureDirectory, "fixture.xlsx");
  const mappingPath = join(fixtureDirectory, "mapping.json");
  writeFileSync(workbookPath, workbookContent);
  writeFileSync(mappingPath, JSON.stringify(mapping));

  try {
    return callback({
      workbookContent,
      workbookPath,
      mappingPath,
      expectedSha256: sha256(workbookContent),
    });
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

function validArgs(fixture) {
  return [
    "-WorkbookPath",
    fixture.workbookPath,
    "-ExpectedSha256",
    fixture.expectedSha256,
    "-WorksheetName",
    "Calculation",
    "-MappingPath",
    fixture.mappingPath,
    "-ValidateOnly",
  ];
}

function parseLastJson(output) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  return JSON.parse(lines.at(-1));
}

test("requires all command-line arguments", () => {
  const result = runHarness([]);

  assert.notEqual(result.status, 0);
});

test("rejects a hash mismatch before attempting Excel startup", () => {
  withFixture(validMapping(), (fixture) => {
    const args = validArgs(fixture);
    args[args.indexOf("-ExpectedSha256") + 1] = "0".repeat(64);
    const result = runHarness(args, { env: { F4_EXCEL_REGRESSION_FAIL_ON_COM_START: "1" } });

    assert.notEqual(result.status, 0);
    assert.equal(parseLastJson(result.stdout).status, "hash_mismatch");
  });
});

const invalidMappings = [
  ["unknown top-level field", { ...validMapping(), unexpected: true }],
  ["unknown input field", validMapping({ inputs: [{ cell: "A1", value: 1, unexpected: true }] })],
  ["unknown output field", validMapping({ outputs: [{ name: "result", cell: "B2", expected: 1, unexpected: true }] })],
  ["unsupported version", validMapping({ version: "excel-ta-v2" })],
  ["invalid input A1 address", validMapping({ inputs: [{ cell: "A0", value: 1 }] })],
  ["invalid output A1 address", validMapping({ outputs: [{ name: "result", cell: "A:1", expected: 1 }] })],
  ["empty outputs", validMapping({ outputs: [] })],
  ["duplicate cell", validMapping({ outputs: [{ name: "result", cell: "A1", expected: 1 }] })],
  [
    "duplicate output name",
    validMapping({
      outputs: [
        { name: "result", cell: "B2", expected: 1 },
        { name: "result", cell: "C3", expected: 2 },
      ],
    }),
  ],
  ["negative tolerance", validMapping({ outputs: [{ name: "result", cell: "B2", expected: 1, tolerance: -1 }] })],
  ["non-numeric tolerance", validMapping({ outputs: [{ name: "result", cell: "B2", expected: 1, tolerance: "0.1" }] })],
  ["invalid input value", validMapping({ inputs: [{ cell: "A1", value: true }] })],
  ["invalid expected value", validMapping({ outputs: [{ name: "result", cell: "B2", expected: null }] })],
];

for (const [name, mapping] of invalidMappings) {
  test(`rejects mapping with ${name}`, () => {
    withFixture(mapping, (fixture) => {
      const result = runHarness(validArgs(fixture));

      assert.notEqual(result.status, 0);
      assert.equal(parseLastJson(result.stdout).status, "invalid_mapping");
    });
  });
}

test("ValidateOnly accepts normalized hash casing without starting Excel", () => {
  withFixture(validMapping(), (fixture) => {
    const args = validArgs(fixture);
    args[args.indexOf("-ExpectedSha256") + 1] = fixture.expectedSha256.toUpperCase();
    const before = sha256(readFileSync(fixture.workbookPath));
    const result = runHarness(args, { env: { F4_EXCEL_REGRESSION_FAIL_ON_COM_START: "1" } });
    const after = sha256(readFileSync(fixture.workbookPath));

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(parseLastJson(result.stdout), {
      status: "validated",
      workbookPath: fixture.workbookPath,
      worksheetName: "Calculation",
      inputCount: 1,
      outputCount: 1,
      sourceSha256: fixture.expectedSha256.toUpperCase(),
    });
    assert.equal(after, before);
  });
});

test("script declares the required isolated Excel execution controls", () => {
  const script = readFileSync(scriptPath, "utf8");

  assert.match(script, /AutomationSecurity\s*=\s*3/);
  assert.match(script, /AskToUpdateLinks\s*=\s*\$false/);
  assert.match(script, /CalculateFullRebuild\(\)/);
  assert.match(script, /Workbooks\.Open\([^\r\n]*UpdateLinks[^\r\n]*ReadOnly/);
  assert.match(script, /Remove-Item[^\r\n]*-Recurse[^\r\n]*-Force/);
});

test("root package exposes the Excel regression harness", () => {
  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));

  assert.equal(
    packageJson.scripts["verify:f4-excel-regression"],
    "pwsh -NoProfile -File scripts/verify-f4-excel-regression.ps1",
  );
});