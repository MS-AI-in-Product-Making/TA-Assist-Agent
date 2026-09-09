import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import {
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import {
  createF5MultimodalFactorSetHash,
  createF5MultimodalRequestHash,
  f5MultimodalArtifactV3Schema,
  validateF5MultimodalArtifactV3,
} from "../packages/contracts/dist/ta-multimodal-contracts.js";

const ARTIFACTS = Object.freeze({
  f2: "Feature2-Report.json",
  f3: "Feature3-Report.json",
  f4: "Feature4-Calculation.json",
  f5: "Feature5-Report.json",
});
const DEFAULT_OUTPUT_ROOT = path.resolve("test", "demo-output");
const MAX_JSON_BYTES = 10 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const responseSchema = z.object({
  contractVersion: z.literal("f6-model-interpretation-response-v1"),
  model: z.object({
    modelId: z.string().trim().min(1),
    supportsImage: z.literal(true),
  }).strict(),
  worksheets: z.array(z.object({
    worksheetName: z.string().trim().min(1),
    imageTableInterpretation: z.string().trim().min(1),
    rows: z.array(z.object({
      sourceRow: z.number().int().positive(),
      visibleStatus: z.literal("visible"),
      interpretation: z.string().trim().min(1),
    }).strict()).min(1),
  }).strict()).min(1),
}).strict();

function requiredValue(args, index, option) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--") || value.trim().length === 0) {
    throw new Error(`${option} requires a nonempty value.`);
  }
  return value;
}

export function parseModelInterpretationArgs(args) {
  if (args.length < 4 || args.slice(0, 4).some((value) => value.startsWith("--"))) {
    throw new Error("Model interpretation requires exactly four artifact roots before options.");
  }
  const [f2ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, f5ArtifactRoot] = args;
  const selectedWorksheetNames = [];
  let responsePath;
  for (let index = 4; index < args.length; index += 1) {
    const option = args[index];
    const value = requiredValue(args, index, option);
    if (option === "--worksheet") {
      const worksheetName = value.trim();
      if (selectedWorksheetNames.includes(worksheetName)) throw new Error(`Model interpretation worksheet is duplicated: ${worksheetName}`);
      selectedWorksheetNames.push(worksheetName);
    } else if (option === "--response") {
      if (responsePath !== undefined) throw new Error("Model interpretation --response option is duplicated.");
      responsePath = value;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
    index += 1;
  }
  if (selectedWorksheetNames.length === 0) throw new Error("Model interpretation requires at least one --worksheet selection.");
  if (responsePath === undefined) throw new Error("Model interpretation requires one --response artifact.");
  return { f2ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, f5ArtifactRoot, selectedWorksheetNames, responsePath };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readJsonArtifact(root, artifactName, schema) {
  const resolvedRoot = path.resolve(root);
  if (lstatSync(resolvedRoot).isSymbolicLink() || !statSync(resolvedRoot).isDirectory()) throw new Error(`${artifactName} root is invalid.`);
  const filePath = path.join(resolvedRoot, artifactName);
  if (lstatSync(filePath).isSymbolicLink() || statSync(filePath).size > MAX_JSON_BYTES) throw new Error(`${artifactName} is invalid.`);
  const bytes = readFileSync(filePath);
  return { value: schema.parse(JSON.parse(bytes.toString("utf8"))), filePath, contentHash: sha256(bytes) };
}

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null);
}

function sameNullableIdentifier(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return String(left) === String(right);
}

function detectImageMediaType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  throw new Error("Worksheet image media type is unsupported.");
}

function containedFile(root, relativePath) {
  const resolvedRoot = realpathSync(path.resolve(root));
  const candidate = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Worksheet image escaped its artifact root.");
  if (lstatSync(candidate).isSymbolicLink() || !statSync(candidate).isFile()) throw new Error("Worksheet image is invalid.");
  const realCandidate = realpathSync(candidate);
  const realRelative = path.relative(resolvedRoot, realCandidate);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) throw new Error("Worksheet image escaped its artifact root.");
  return realCandidate;
}

function readGovernedResponse(responsePath, outputRoot, workbookHash) {
  const root = realpathSync(path.resolve(outputRoot));
  const governedRoot = path.join(root, "f6-model-responses", workbookHash);
  const candidate = path.resolve(responsePath);
  const relative = path.relative(governedRoot, candidate);
  const segments = relative.split(path.sep);
  if (relative.startsWith("..")
    || path.isAbsolute(relative)
    || segments.length !== 2
    || !UUID_PATTERN.test(segments[0])
    || segments[1] !== "Feature6-Model-Response.json") {
    throw new Error("Model response must remain beneath the governed response root for the current workbook.");
  }
  let current = root;
  for (const segment of path.relative(root, candidate).split(path.sep)) {
    current = path.join(current, segment);
    if (lstatSync(current).isSymbolicLink()) throw new Error("Model response ancestry must not contain linked paths.");
  }
  const realCandidate = realpathSync(candidate);
  const realRelative = path.relative(governedRoot, realCandidate);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error("Model response must remain beneath the governed response root for the current workbook.");
  }
  if (!statSync(realCandidate).isFile() || statSync(realCandidate).size > MAX_JSON_BYTES) throw new Error("Model response artifact is invalid.");
  return readFileSync(realCandidate);
}

function exactlyOne(values, description) {
  if (values.length !== 1) throw new Error(`${description} must resolve exactly once.`);
  return values[0];
}

function buildFactorRows(worksheetName, f2Worksheet, f3Worksheet, calculation) {
  const tableId = calculation.worksheetSelection.tableId;
  return calculation.factors.map((factor) => {
    const f2Row = exactlyOne(f2Worksheet.rows.filter((row) => row.tableId === tableId && row.sourceRow === factor.source.sourceRow), `${worksheetName} F2 Factor row`);
    const f3Row = exactlyOne(f3Worksheet.rows.filter((row) => row.source.tableId === tableId && row.source.sourceRow === factor.source.sourceRow), `${worksheetName} F3 Factor row`);
    const actual = f2Row.actualFields;
    if (!isDeepStrictEqual(f2Row.factorOrdinal, f3Row.factorOrdinal)
      || actual.factorName !== factor.factorName
      || actual.partName !== f3Row.partSubsystem
      || actual.partCategory !== f3Row.partCategory
      || !sameNullable(actual.drawingNumber, f3Row.drawingNumber)
      || !sameNullableIdentifier(actual.dimCharacteristicId, f3Row.dimId)
      || actual.nominalValue !== factor.input.nominalValue
      || actual.upperTolerance !== factor.input.upperTolerance
      || actual.lowerTolerance !== factor.input.lowerTolerance
      || actual.longTermSafetyFactor !== factor.input.longTermSafetyFactor
      || actual.sigmaLevel !== factor.input.sigmaLevel) {
      throw new Error(`${worksheetName} Factor identity does not match current F2/F3/F4 evidence.`);
    }
    return {
      worksheetName,
      tableId,
      sourceRow: factor.source.sourceRow,
      factorOrdinal: f2Row.factorOrdinal,
      factorName: factor.factorName,
      partName: actual.partName,
      partCategory: actual.partCategory,
      drawingNumber: actual.drawingNumber,
      dimId: actual.dimCharacteristicId == null ? null : String(actual.dimCharacteristicId),
      nominal: factor.input.nominalValue,
      upperTolerance: factor.input.upperTolerance,
      lowerTolerance: factor.input.lowerTolerance,
      longTermSafetyFactor: factor.input.longTermSafetyFactor,
      sigmaLevel: factor.input.sigmaLevel,
      distribution: factor.input.distribution,
      sourceCells: Object.fromEntries(Object.entries(f2Row.sourceCells).filter(([, value]) => typeof value === "string")),
    };
  });
}

function assertDisclosure(value, worksheetName) {
  const normalized = value.toLowerCase();
  if (!normalized.includes("hallucinations")
    || !normalized.includes("label mismatches")
    || !normalized.includes("omissions")
    || !normalized.includes("reviewed by me")) {
    throw new Error(`${worksheetName} interpretation is missing the required model-risk and ME-review disclosure.`);
  }
}

function ensureOutputDirectory(outputRoot, workbookHash, targetId) {
  const root = path.resolve(outputRoot);
  mkdirSync(root, { recursive: true });
  if (lstatSync(root).isSymbolicLink() || !statSync(root).isDirectory()) throw new Error("Model interpretation output root is invalid.");
  const realRoot = realpathSync(root);
  const segments = ["f6-model-interpretations", workbookHash, targetId];
  let current = realRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (existsSync(current)) {
      if (lstatSync(current).isSymbolicLink() || !statSync(current).isDirectory()) throw new Error("Model interpretation output ancestry is invalid.");
    } else {
      mkdirSync(current);
    }
  }
  const relative = path.relative(realRoot, current);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Model interpretation output escaped its controlled root.");
  return current;
}

export function materializeF6ModelInterpretation(options) {
  const f2Loaded = readJsonArtifact(options.f2ArtifactRoot, ARTIFACTS.f2, f2UserReportSchema);
  const f3Loaded = readJsonArtifact(options.f3ArtifactRoot, ARTIFACTS.f3, drawingGovernanceResultV2Schema);
  const f4Loaded = readJsonArtifact(options.f4ArtifactRoot, ARTIFACTS.f4, f4WorkflowCalculationResultSchema);
  const f5Loaded = readJsonArtifact(options.f5ArtifactRoot, ARTIFACTS.f5, f5DataInterpretationResultSchema);
  const { value: f2 } = f2Loaded;
  const { value: f3 } = f3Loaded;
  const { value: f4 } = f4Loaded;
  const { value: f5 } = f5Loaded;
  const workbookHash = f2.workbook.contentHash;
  if (f2.status === "inputRejected"
    || !["completed", "partiallyBlocked"].includes(f2.status)
    || !["completed", "governance_required"].includes(f3.status)
    || f4.status !== "completed"
    || f5.status !== "completed"
    || f3.workbook.contentHash !== workbookHash
    || f4.source.workbookContentHash !== workbookHash
    || f5.workbook.contentHash !== workbookHash
    || f3.workbook.fileName !== f2.workbook.fileName
    || f4.source.workbookFileName !== f2.workbook.fileName
    || f5.workbook.fileName !== f2.workbook.fileName) {
    throw new Error("Model interpretation inputs do not share one completed workbook lineage.");
  }

  const responseBytes = readGovernedResponse(options.responsePath, options.outputRoot, workbookHash);
  const response = responseSchema.parse(JSON.parse(responseBytes.toString("utf8")));
  if (!isDeepStrictEqual(response.worksheets.map(({ worksheetName }) => worksheetName), options.selectedWorksheetNames)) {
    throw new Error("Model response worksheet order does not match the confirmed scope.");
  }

  const sessionId = randomUUID();
  const revision = 0;
  const inputRevision = 0;
  const worksheets = options.selectedWorksheetNames.map((worksheetName, worksheetIndex) => {
    const f2Worksheet = exactlyOne(f2.worksheets.filter((worksheet) => worksheet.worksheetName === worksheetName && worksheet.status === "ready"), `${worksheetName} F2 worksheet`);
    const f3Worksheet = exactlyOne(f3.worksheets.filter((worksheet) => worksheet.worksheetName === worksheetName), `${worksheetName} F3 worksheet`);
    const calculation = exactlyOne(f4.calculations.filter((candidate) => candidate.status === "completed" && candidate.worksheetSelection.worksheetName === worksheetName), `${worksheetName} F4 calculation`);
    const f5Worksheet = exactlyOne(f5.worksheets.filter((worksheet) => worksheet.status === "completed" && worksheet.worksheetName === worksheetName), `${worksheetName} F5 worksheet`);
    const factorRows = buildFactorRows(worksheetName, f2Worksheet, f3Worksheet, calculation);
    if (f5Worksheet.calculationResult.workbookContentHash !== workbookHash
      || f5Worksheet.calculationResult.worksheetSelection.tableId !== calculation.worksheetSelection.tableId) {
      throw new Error(`${worksheetName} F5 calculation identity does not match F4.`);
    }
    const imageReference = f5Worksheet.imageReference;
    if (imageReference.worksheetName !== worksheetName) throw new Error(`${worksheetName} image identity does not match.`);
    const imagePath = containedFile(f2.artifactRoot, imageReference.relativePath);
    const imageBytes = readFileSync(imagePath);
    if (sha256(imageBytes) !== imageReference.contentHash) throw new Error(`${worksheetName} image hash does not match.`);
    const request = {
      contractVersion: "f5-multimodal-request-v3",
      inputClassification: "confidential",
      requestHash: "",
      sessionId,
      revision,
      inputRevision,
      workbook: { fileName: f2.workbook.fileName, contentHash: workbookHash },
      worksheetName,
      tableId: calculation.worksheetSelection.tableId,
      activeFactorCount: factorRows.length,
      factorSetHash: createF5MultimodalFactorSetHash(factorRows),
      image: {
        mediaType: detectImageMediaType(imageBytes),
        contentHash: imageReference.contentHash,
        byteLength: imageBytes.length,
        artifactPath: imageReference.relativePath,
      },
      factorRows,
    };
    request.requestHash = createF5MultimodalRequestHash(request);

    const worksheetResponse = response.worksheets[worksheetIndex];
    assertDisclosure(worksheetResponse.imageTableInterpretation, worksheetName);
    const rowResponses = new Map(worksheetResponse.rows.map((row) => [row.sourceRow, row]));
    if (rowResponses.size !== factorRows.length || worksheetResponse.rows.length !== factorRows.length) {
      throw new Error(`${worksheetName} model response must cover every active Factor exactly once.`);
    }
    const rowMappings = factorRows.map((row) => {
      const rowResponse = rowResponses.get(row.sourceRow);
      if (rowResponse === undefined) throw new Error(`${worksheetName} model response is missing source row ${row.sourceRow}.`);
      return {
        worksheetName,
        tableId: row.tableId,
        sourceRow: row.sourceRow,
        factorOrdinal: row.factorOrdinal,
        mappingStatus: "matched",
        visibleStatus: rowResponse.visibleStatus,
        interpretation: rowResponse.interpretation,
      };
    });
    return {
      request,
      result: {
        contractVersion: "f5-multimodal-result-v3",
        outputClassification: "confidential",
        requestHash: request.requestHash,
        sessionId,
        revision,
        inputRevision,
        workbookContentHash: workbookHash,
        worksheetName,
        tableId: request.tableId,
        imageContentHash: request.image.contentHash,
        model: response.model,
        imageTableInterpretation: worksheetResponse.imageTableInterpretation,
        rowMappings,
      },
    };
  });

  const artifact = f5MultimodalArtifactV3Schema.parse({
    contractVersion: "f5-multimodal-artifact-v3",
    outputClassification: "confidential",
    sessionId,
    revision,
    inputRevision,
    workbookContentHash: workbookHash,
    selectedWorksheetNames: [...options.selectedWorksheetNames],
    worksheets,
  });
  const authority = {
    sessionId,
    revision,
    inputRevision,
    workbookContentHash: workbookHash,
    worksheets: worksheets.map(({ request }) => ({
      worksheetName: request.worksheetName,
      tableId: request.tableId,
      activeFactorCount: request.activeFactorCount,
      factorSetHash: request.factorSetHash,
    })),
  };
  if (!validateF5MultimodalArtifactV3(artifact, authority).success) throw new Error("Generated model interpretation failed authority validation.");

  const targetDirectory = ensureOutputDirectory(options.outputRoot, workbookHash, randomUUID());
  const artifactPath = path.join(targetDirectory, "Feature6-Model-Interpretation.json");
  const descriptor = openSync(artifactPath, "wx");
  try {
    writeFileSync(descriptor, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  } finally {
    closeSync(descriptor);
  }
  const bytes = readFileSync(artifactPath);
  const readback = f5MultimodalArtifactV3Schema.parse(JSON.parse(bytes.toString("utf8")));
  if (!validateF5MultimodalArtifactV3(readback, authority).success) throw new Error("Model interpretation readback failed authority validation.");
  return { status: "completed", artifactPath, contentHash: sha256(bytes), worksheetCount: worksheets.length };
}

export function runModelInterpretationCli(args = process.argv.slice(2)) {
  const parsed = parseModelInterpretationArgs(args);
  return materializeF6ModelInterpretation({
    ...parsed,
    outputRoot: process.env.AI_TVA_F6_PUBLISH_ROOT ?? DEFAULT_OUTPUT_ROOT,
  });
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(runModelInterpretationCli(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}