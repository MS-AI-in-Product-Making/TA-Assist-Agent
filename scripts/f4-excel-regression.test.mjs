import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

function withFixture(mapping, callback, options = {}) {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "f4-excel-regression-test-"));
  const workbookContent = Buffer.from("dummy xlsx bytes for validate-only");
  const workbookPath = join(fixtureDirectory, "fixture.xlsx");
  const mappingPath = join(fixtureDirectory, "mapping.json");
  writeFileSync(workbookPath, workbookContent);
  writeFileSync(mappingPath, options.mappingContent ?? JSON.stringify(mapping));

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

function validArgs(fixture, { validateOnly = true, worksheetName = "Calculation" } = {}) {
  const args = [
    "-WorkbookPath",
    fixture.workbookPath,
    "-ExpectedSha256",
    fixture.expectedSha256,
    "-WorksheetName",
    worksheetName,
    "-MappingPath",
    fixture.mappingPath,
  ];
  if (validateOnly) args.push("-ValidateOnly");
  return args;
}

function parseLastJson(output) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  return JSON.parse(lines.at(-1));
}

function excelRegressionTemporaryDirectories() {
  return new Set(readdirSync(tmpdir()).filter(
    (name) => name.startsWith("f4-excel-regression-") && !name.startsWith("f4-excel-regression-test-"),
  ));
}

test("requires all command-line arguments", () => {
  const result = runHarness([]);

  assert.notEqual(result.status, 0);
});

test("rejects a hash mismatch before attempting Excel startup", () => {
  withFixture(validMapping(), (fixture) => {
    const args = validArgs(fixture, { validateOnly: false });
    args[args.indexOf("-ExpectedSha256") + 1] = "0".repeat(64);
    const result = runHarness(args, { env: { F4_EXCEL_REGRESSION_FAIL_ON_COM_START: "1" } });

    assert.notEqual(result.status, 0);
    assert.equal(parseLastJson(result.stdout).status, "hash_mismatch");
  });
});

for (const dangerousValue of ["=1+1", "  +cmd", "\t-2", "@SUM(A1)", "line\rbreak", "line\nbreak", "nul\0byte"]) {
  test(`rejects dangerous mapping input string ${JSON.stringify(dangerousValue)}`, () => {
    withFixture(validMapping({ inputs: [{ cell: "A1", value: dangerousValue }] }), (fixture) => {
      const result = runHarness(validArgs(fixture));

      assert.notEqual(result.status, 0);
      assert.equal(parseLastJson(result.stdout).status, "invalid_mapping");
    });
  });
}

for (const safeValue of ["plain text", "1", -2]) {
  test(`accepts safe mapping input ${JSON.stringify(safeValue)}`, () => {
    withFixture(validMapping({ inputs: [{ cell: "A1", value: safeValue }] }), (fixture) => {
      const result = runHarness(validArgs(fixture));

      assert.equal(result.status, 0, result.stderr);
    });
  });
}

test("rejects a tampered temporary copy before attempting Excel startup", () => {
  withFixture(validMapping(), (fixture) => {
    const result = runHarness(validArgs(fixture, { validateOnly: false }), {
      env: {
        F4_EXCEL_REGRESSION_FAIL_ON_COM_START: "1",
        F4_EXCEL_REGRESSION_TAMPER_TEMP_COPY: "1",
      },
    });

    assert.notEqual(result.status, 0);
    assert.equal(parseLastJson(result.stdout).status, "hash_mismatch");
  });
});

test("rejects invalid mapping before attempting Excel startup", () => {
  withFixture(validMapping({ inputs: [{ cell: "A1", value: "=1+1" }] }), (fixture) => {
    const result = runHarness(validArgs(fixture, { validateOnly: false }), {
      env: { F4_EXCEL_REGRESSION_FAIL_ON_COM_START: "1" },
    });

    assert.notEqual(result.status, 0);
    assert.equal(parseLastJson(result.stdout).status, "invalid_mapping");
  });
});

test("cleans the temporary copy after Excel startup failure", () => {
  withFixture(validMapping(), (fixture) => {
    const before = excelRegressionTemporaryDirectories();
    const result = runHarness(validArgs(fixture, { validateOnly: false }), {
      env: { F4_EXCEL_REGRESSION_FAIL_ON_COM_START: "1" },
    });
    const after = excelRegressionTemporaryDirectories();

    assert.notEqual(result.status, 0);
    assert.equal(parseLastJson(result.stdout).status, "excel_error");
    assert.deepEqual(after, before);
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
  ["101 inputs", validMapping({ inputs: Array.from({ length: 101 }, (_, index) => ({ cell: `A${index + 1}`, value: index })) })],
  ["101 outputs", validMapping({ outputs: Array.from({ length: 101 }, (_, index) => ({ name: `result-${index}`, cell: `B${index + 1}`, expected: index })) })],
  ["output name longer than 128 characters", validMapping({ outputs: [{ name: "n".repeat(129), cell: "B2", expected: 1 }] })],
  ["input string longer than 1024 characters", validMapping({ inputs: [{ cell: "A1", value: "v".repeat(1025) }] })],
  ["expected string longer than 1024 characters", validMapping({ outputs: [{ name: "result", cell: "B2", expected: "v".repeat(1025) }] })],
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

test("rejects a mapping file larger than 1 MiB before parsing", () => {
  withFixture(validMapping(), (fixture) => {
    const result = runHarness(validArgs(fixture));

    assert.notEqual(result.status, 0);
    assert.equal(parseLastJson(result.stdout).status, "invalid_mapping");
  }, { mappingContent: " ".repeat((1024 * 1024) + 1) });
});

for (const worksheetName of ["W".repeat(32), "Sensitive\nSheet", "Sensitive\tSheet"]) {
  test(`rejects invalid worksheet name ${JSON.stringify(worksheetName)}`, () => {
    withFixture(validMapping(), (fixture) => {
      const result = runHarness(validArgs(fixture, { worksheetName }));

      assert.notEqual(result.status, 0);
      assert.equal(parseLastJson(result.stdout).status, "invalid_arguments");
    });
  });
}

for (const tolerance of [0, 1e-12]) {
  test(`ValidateOnly accepts mapping output tolerance ${tolerance}`, () => {
    const mapping = validMapping({
      outputs: [{ name: "result", cell: "B2", expected: 1, tolerance }],
    });

    withFixture(mapping, (fixture) => {
      const result = runHarness(validArgs(fixture));

      assert.equal(result.status, 0, result.stderr);
      assert.equal(parseLastJson(result.stdout).status, "validated");
    });
  });
}

for (const tolerance of [1.0000001e-12, 1]) {
  test(`ValidateOnly rejects mapping output tolerance ${tolerance}`, () => {
    const mapping = validMapping({
      outputs: [{ name: "result", cell: "B2", expected: 1, tolerance }],
    });

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
      inputCount: 1,
      outputCount: 1,
      sourceSha256: fixture.expectedSha256.toUpperCase(),
      version: "excel-ta-v1",
    });
    assert.equal(after, before);
  });
});

test("does not disclose sensitive paths or worksheet names in validation output", () => {
  withFixture(validMapping(), (fixture) => {
    const result = runHarness(validArgs(fixture, { worksheetName: "SENSITIVE_SHEET" }));
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(output, /SENSITIVE_SHEET/);
    assert.doesNotMatch(output, new RegExp(fixture.workbookPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    assert.doesNotMatch(output, new RegExp(fixture.mappingPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  });
});

test("uses a fixed error for missing sensitive paths", () => {
  const sensitiveRoot = join(tmpdir(), "SENSITIVE_MISSING_PATH");
  const result = runHarness([
    "-WorkbookPath", join(sensitiveRoot, "workbook.xlsx"),
    "-ExpectedSha256", "0".repeat(64),
    "-WorksheetName", "SENSITIVE_SHEET",
    "-MappingPath", join(sensitiveRoot, "mapping.json"),
    "-ValidateOnly",
  ]);
  const output = `${result.stdout}\n${result.stderr}`;

  assert.notEqual(result.status, 0);
  assert.deepEqual(parseLastJson(result.stdout), {
    status: "invalid_arguments",
    error: "WorkbookPath or MappingPath is unavailable.",
  });
  assert.doesNotMatch(output, /SENSITIVE_/);
});

test("script declares the required isolated Excel execution controls", () => {
  const script = readFileSync(scriptPath, "utf8");

  assert.match(script, /AutomationSecurity\s*=\s*3/);
  assert.match(script, /AskToUpdateLinks\s*=\s*\$false/);
  assert.match(script, /CalculateFullRebuild\(\)/);
  assert.match(script, /Workbooks\.Open\([^\r\n]*UpdateLinks[^\r\n]*ReadOnly/);
  assert.match(script, /Remove-Item[^\r\n]*-Recurse[^\r\n]*-Force/);
  assert.match(script, /NumberFormat\s*=\s*["']@["']/);
  assert.doesNotMatch(script, /\$resultPayload\s*=\s*\[ordered\]@[\s\S]*?worksheetName\s*=/);
  assert.doesNotMatch(script, /\$outputResults\.Add\(\[ordered\]@[\s\S]*?difference\s*=/);
  assert.match(script, /try\s*\{\s*\$finalSourceSha256\s*=\s*\(Get-FileHash[\s\S]*?\}\s*catch\s*\{/);
});

test("root package exposes the Excel regression harness", () => {
  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));

  assert.equal(
    packageJson.scripts["verify:f4-excel-regression"],
    "pwsh -NoProfile -File scripts/verify-f4-excel-regression.ps1",
  );
});
