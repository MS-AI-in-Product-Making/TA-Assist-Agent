import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import {
  drawingGovernanceResultV2Schema,
  drawingGovernanceResultV3Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import {
  ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME,
  resolveAnalysisWorkspaceStagePaths,
  validateAnalysisWorkspaceLayout,
  validateAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";
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
const readableDrawingGovernanceResultSchema = z.union([
  drawingGovernanceResultV2Schema,
  drawingGovernanceResultV3Schema,
]);

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
  let analysisRoot;
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
    } else if (option === "--analysis-root") {
      if (analysisRoot !== undefined) throw new Error("Model interpretation --analysis-root option is duplicated.");
      analysisRoot = value;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
    index += 1;
  }
  if (selectedWorksheetNames.length === 0) throw new Error("Model interpretation requires at least one --worksheet selection.");
  if (responsePath === undefined) throw new Error("Model interpretation requires one --response artifact.");
  return { f2ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, f5ArtifactRoot, selectedWorksheetNames, responsePath, analysisRoot };
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

function sameDimId(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return sameNullable(left, right);
  }
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

function captureDirectoryIdentity(targetPath, label) {
  const requestedPath = path.resolve(targetPath);
  if (!existsSync(requestedPath)) throw new Error(`${label} is missing.`);
  const requestedStats = lstatSync(requestedPath);
  if (!requestedStats.isDirectory()) throw new Error(`${label} is invalid.`);
  const canonicalPath = realpathSync(requestedPath);
  const canonicalStats = statSync(canonicalPath);
  if (!canonicalStats.isDirectory()) throw new Error(`${label} is invalid.`);
  return {
    requestedPath,
    canonicalPath,
    requestedDev: requestedStats.dev,
    requestedIno: requestedStats.ino,
    canonicalDev: canonicalStats.dev,
    canonicalIno: canonicalStats.ino,
  };
}

function captureFileIdentity(targetPath, label) {
  const requestedPath = path.resolve(targetPath);
  if (!existsSync(requestedPath)) throw new Error(`${label} is missing.`);
  const requestedStats = lstatSync(requestedPath);
  if (!requestedStats.isFile()) throw new Error(`${label} is invalid.`);
  const canonicalPath = realpathSync(requestedPath);
  const canonicalStats = statSync(canonicalPath);
  if (!canonicalStats.isFile()) throw new Error(`${label} is invalid.`);
  return {
    requestedPath,
    canonicalPath,
    requestedDev: requestedStats.dev,
    requestedIno: requestedStats.ino,
    canonicalDev: canonicalStats.dev,
    canonicalIno: canonicalStats.ino,
  };
}

function sameIdentity(expected, actual) {
  return expected.requestedPath === actual.requestedPath
    && expected.canonicalPath === actual.canonicalPath
    && expected.requestedDev === actual.requestedDev
    && expected.requestedIno === actual.requestedIno
    && expected.canonicalDev === actual.canonicalDev
    && expected.canonicalIno === actual.canonicalIno;
}

function assertIdentityUnchanged(expected, label, capture) {
  const current = capture(expected.requestedPath, label);
  if (!sameIdentity(expected, current)) throw new Error(`${label} changed during validation.`);
  return current;
}

function captureRegularFileIdentity(targetPath, descriptor, label) {
  const requestedPath = path.resolve(targetPath);
  const handleStats = fstatSync(descriptor);
  const requestedStats = lstatSync(requestedPath);
  if (!handleStats.isFile() || requestedStats.isSymbolicLink() || !requestedStats.isFile()) {
    throw new Error(`${label} is invalid.`);
  }
  const canonicalPath = realpathSync(requestedPath);
  const canonicalStats = statSync(canonicalPath);
  if (!canonicalStats.isFile()
    || handleStats.dev !== requestedStats.dev
    || handleStats.ino !== requestedStats.ino
    || handleStats.dev !== canonicalStats.dev
    || handleStats.ino !== canonicalStats.ino) {
    throw new Error(`${label} is invalid.`);
  }
  return {
    requestedPath,
    canonicalPath,
    dev: handleStats.dev,
    ino: handleStats.ino,
  };
}

function captureRegularFilePathIdentity(targetPath, label) {
  const requestedPath = path.resolve(targetPath);
  const requestedStats = lstatSync(requestedPath);
  if (requestedStats.isSymbolicLink() || !requestedStats.isFile()) {
    throw new Error(`${label} is invalid.`);
  }
  const canonicalPath = realpathSync(requestedPath);
  const canonicalStats = statSync(canonicalPath);
  if (!canonicalStats.isFile()
    || requestedStats.dev !== canonicalStats.dev
    || requestedStats.ino !== canonicalStats.ino) {
    throw new Error(`${label} is invalid.`);
  }
  return {
    requestedPath,
    canonicalPath,
    dev: requestedStats.dev,
    ino: requestedStats.ino,
  };
}

function sameOwnedRegularFile(expected, actual) {
  return expected.dev === actual.dev && expected.ino === actual.ino;
}

function readDescriptorBytes(descriptor) {
  const chunks = [];
  let totalBytes = 0;
  while (totalBytes <= MAX_JSON_BYTES) {
    const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, MAX_JSON_BYTES + 1 - totalBytes));
    const bytesRead = readSync(descriptor, chunk, 0, chunk.length, totalBytes);
    if (!Number.isInteger(bytesRead) || bytesRead < 0 || bytesRead > chunk.length) {
      throw new Error("Model response descriptor read result is invalid.");
    }
    if (bytesRead === 0) break;
    totalBytes += bytesRead;
    if (totalBytes > MAX_JSON_BYTES) throw new Error("Model response artifact is invalid.");
    chunks.push(chunk.subarray(0, bytesRead));
  }
  return Buffer.concat(chunks, totalBytes);
}

function removeOwnedRegularFile(ownedFile) {
  const candidates = [ownedFile.requestedPath, ownedFile.canonicalPath]
    .filter((value, index, values) => values.indexOf(value) === index);
  for (const candidatePath of candidates) {
    try {
      const current = captureRegularFilePathIdentity(candidatePath, "Feature 6 owned file");
      if (!sameOwnedRegularFile(ownedFile, current)) continue;
      rmSync(candidatePath, { force: true });
      return;
    } catch {
      // ignore
    }
  }
}

function resolveAnalysisWorkspace(analysisRoot) {
  const resolvedRoot = path.resolve(analysisRoot);
  const summaryPath = path.join(resolvedRoot, ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  validateAnalysisWorkspaceSummary(summary);
  const layout = {
    contractVersion: summary.contractVersion,
    analysisRoot: summary.analysisRoot,
    summaryPath: summary.summaryPath,
    workbookFileName: summary.workbook.fileName,
    workbookContentHash: summary.workbook.contentHash,
    allocationDate: summary.allocationDate,
    stagePaths: resolveAnalysisWorkspaceStagePaths(summary.analysisRoot),
  };
  validateAnalysisWorkspaceLayout(layout);
  const analysisRootIdentity = captureDirectoryIdentity(resolvedRoot, "Feature 6 analysis workspace root");
  if (analysisRootIdentity.canonicalPath !== path.resolve(layout.analysisRoot)) {
    throw new Error("Feature 6 analysis workspace root does not match the validated summary.");
  }
  const stageIdentities = {
    f2: captureDirectoryIdentity(layout.stagePaths.f2, "Feature 6 validated F2 stage path"),
    f3: captureDirectoryIdentity(layout.stagePaths.f3, "Feature 6 validated F3 stage path"),
    f4: captureDirectoryIdentity(layout.stagePaths.f4, "Feature 6 validated F4 stage path"),
    f5: captureDirectoryIdentity(layout.stagePaths.f5, "Feature 6 validated F5 stage path"),
    f6: captureDirectoryIdentity(layout.stagePaths.f6, "Feature 6 validated F6 stage path"),
  };
  return { layout, analysisRootIdentity, stageIdentities };
}

function assertExpectedWorkspaceArtifact(stageIdentity, artifactFileName, label) {
  const currentStageIdentity = assertIdentityUnchanged(stageIdentity, label, captureDirectoryIdentity);
  if (currentStageIdentity.canonicalPath !== stageIdentity.canonicalPath) {
    throw new Error(`${label} changed during validation.`);
  }
  const artifactIdentity = captureFileIdentity(path.join(stageIdentity.requestedPath, artifactFileName), `${label} artifact`);
  if (!artifactIdentity.canonicalPath.startsWith(stageIdentity.canonicalPath + path.sep)) {
    throw new Error(`${label} artifact escaped the validated stage.`);
  }
  const expectedArtifactPath = path.join(stageIdentity.canonicalPath, artifactFileName);
  if (artifactIdentity.canonicalPath !== expectedArtifactPath) {
    throw new Error(`${label} artifact is invalid.`);
  }
}

function assertExactWorkspaceStage(requestedStagePath, stageIdentity, artifactFileName, label, workspaceRootIdentity) {
  assertIdentityUnchanged(workspaceRootIdentity, "Feature 6 analysis workspace root", captureDirectoryIdentity);
  const requestedIdentity = captureDirectoryIdentity(requestedStagePath, label);
  if (!requestedIdentity.canonicalPath.startsWith(workspaceRootIdentity.canonicalPath + path.sep)
    || !sameIdentity(stageIdentity, requestedIdentity)) {
    throw new Error(`Feature 6 current workspace flow requires the exact validated ${label.match(/F\d/)?.[0] ?? "workspace"} stage path.`);
  }
  assertExpectedWorkspaceArtifact(stageIdentity, artifactFileName, label);
}

function resolveWorkspaceMode(options) {
  if (typeof options.analysisRoot !== "string") return undefined;
  const workspace = resolveAnalysisWorkspace(options.analysisRoot);
  assertExactWorkspaceStage(options.f2ArtifactRoot, workspace.stageIdentities.f2, "Feature2-Report.json", "Feature 6 validated F2 stage path", workspace.analysisRootIdentity);
  assertExactWorkspaceStage(options.f3ArtifactRoot, workspace.stageIdentities.f3, "Feature3-Report.json", "Feature 6 validated F3 stage path", workspace.analysisRootIdentity);
  assertExactWorkspaceStage(options.f4ArtifactRoot, workspace.stageIdentities.f4, "Feature4-Calculation.json", "Feature 6 validated F4 stage path", workspace.analysisRootIdentity);
  assertExactWorkspaceStage(options.f5ArtifactRoot, workspace.stageIdentities.f5, "Feature5-Report.json", "Feature 6 validated F5 stage path", workspace.analysisRootIdentity);
  return workspace;
}

function semanticEvidenceRoots(stageRoot) {
  const evidenceRoot = path.join(stageRoot, "evidence");
  return {
    evidenceRoot,
    responseRoot: path.join(evidenceRoot, "model-response"),
    interpretationRoot: path.join(evidenceRoot, "model-interpretation"),
  };
}

function assertWorkspaceBoundaryUnchanged(workspace) {
  assertIdentityUnchanged(workspace.analysisRootIdentity, "Feature 6 analysis workspace root", captureDirectoryIdentity);
  assertIdentityUnchanged(workspace.stageIdentities.f6, "Feature 6 validated F6 stage path", captureDirectoryIdentity);
}

function assertEvidenceDirectoryUnchanged(expected, label) {
  const current = captureDirectoryIdentity(expected.requestedPath, label);
  if (!sameIdentity(expected, current)) {
    throw new Error(`${label} changed during validation.`);
  }
  return current;
}

function assertOwnedFileInDirectory(ownedFile, directoryIdentity, label) {
  const canonicalParent = path.dirname(ownedFile.canonicalPath);
  if (canonicalParent !== directoryIdentity.canonicalPath || !ownedFile.canonicalPath.startsWith(directoryIdentity.canonicalPath + path.sep)) {
    throw new Error(`${label} escaped the validated stage6 evidence root.`);
  }
}

function readGovernedResponse(responsePath, outputRoot, workbookHash, workspace, hooks = {}) {
  if (workspace) {
    const { responseRoot } = semanticEvidenceRoots(workspace.layout.stagePaths.f6);
    const expectedPath = path.join(responseRoot, "Feature6-Model-Response.json");
    const candidate = path.resolve(responsePath);
    if (candidate !== path.resolve(expectedPath)) {
      throw new Error("Model response must remain beneath the validated stage6 semantic evidence root.");
    }
    hooks.beforeReadResponse?.();
    assertWorkspaceBoundaryUnchanged(workspace);
    const responseIdentity = captureFileIdentity(expectedPath, "Feature 6 model response artifact");
    if (responseIdentity.canonicalPath !== path.resolve(expectedPath)) {
      throw new Error("Model response must remain beneath the validated stage6 semantic evidence root.");
    }
    const descriptor = openSync(expectedPath, "r");
    try {
      const ownedResponse = captureRegularFileIdentity(expectedPath, descriptor, "Feature 6 model response artifact");
      if (ownedResponse.canonicalPath !== responseIdentity.canonicalPath
        || !sameOwnedRegularFile({ dev: responseIdentity.canonicalDev, ino: responseIdentity.canonicalIno }, ownedResponse)) {
        throw new Error("Model response must remain beneath the validated stage6 semantic evidence root.");
      }
      const bytes = readDescriptorBytes(descriptor);
      const postReadStats = fstatSync(descriptor);
      const postReadPathStats = lstatSync(expectedPath);
      if (postReadPathStats.isSymbolicLink()
        || postReadStats.dev !== postReadPathStats.dev
        || postReadStats.ino !== postReadPathStats.ino) {
        throw new Error("Model response artifact is invalid.");
      }
      assertWorkspaceBoundaryUnchanged(workspace);
      return bytes;
    } finally {
      closeSync(descriptor);
    }
  }
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
      || !sameDimId(actual.dimCharacteristicId, f3Row.dimId)
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
      dimId: f3Row.dimId,
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

function ensureOutputDirectory(outputRoot, workbookHash, targetId, workspace, hooks = {}) {
  if (workspace) {
    hooks.beforeEnsureOutputDirectory?.();
    assertWorkspaceBoundaryUnchanged(workspace);
    const { evidenceRoot, interpretationRoot } = semanticEvidenceRoots(workspace.layout.stagePaths.f6);
    for (const target of [evidenceRoot, interpretationRoot]) {
      if (existsSync(target)) {
        if (lstatSync(target).isSymbolicLink() || !statSync(target).isDirectory()) throw new Error("Model interpretation output ancestry is invalid.");
      } else {
        mkdirSync(target, { recursive: true });
      }
      if (realpathSync(target) !== path.resolve(target)) throw new Error("Model interpretation output ancestry is invalid.");
    }
    assertWorkspaceBoundaryUnchanged(workspace);
    return {
      directoryPath: interpretationRoot,
      evidenceRootIdentity: captureDirectoryIdentity(evidenceRoot, "Feature 6 stage6 evidence root"),
      interpretationRootIdentity: captureDirectoryIdentity(interpretationRoot, "Feature 6 stage6 model interpretation root"),
    };
  }
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
  return { directoryPath: current };
}

function atomicWriteWorkspaceArtifact(artifactPath, content, workspace, directoryState, hooks = {}) {
  assertWorkspaceBoundaryUnchanged(workspace);
  assertEvidenceDirectoryUnchanged(directoryState.evidenceRootIdentity, "Feature 6 stage6 evidence root");
  assertEvidenceDirectoryUnchanged(directoryState.interpretationRootIdentity, "Feature 6 stage6 model interpretation root");
  hooks.beforeOpenOwnedFile?.();
  assertWorkspaceBoundaryUnchanged(workspace);
  assertEvidenceDirectoryUnchanged(directoryState.evidenceRootIdentity, "Feature 6 stage6 evidence root");
  assertEvidenceDirectoryUnchanged(directoryState.interpretationRootIdentity, "Feature 6 stage6 model interpretation root");

  const temporaryPath = `${artifactPath}.${randomUUID()}.tmp`;
  let descriptor;
  let ownedTemporaryFile;
  let ownedFinalFile;
  let committed = false;
  try {
    descriptor = openSync(temporaryPath, "wx");
    ownedTemporaryFile = captureRegularFileIdentity(temporaryPath, descriptor, "Feature 6 model interpretation temp artifact");
    assertOwnedFileInDirectory(ownedTemporaryFile, directoryState.interpretationRootIdentity, "Feature 6 model interpretation temp artifact");
    hooks.beforeWriteOwnedFile?.();
    assertWorkspaceBoundaryUnchanged(workspace);
    assertEvidenceDirectoryUnchanged(directoryState.evidenceRootIdentity, "Feature 6 stage6 evidence root");
    assertEvidenceDirectoryUnchanged(directoryState.interpretationRootIdentity, "Feature 6 stage6 model interpretation root");
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    hooks.beforeRenameOwnedFile?.();
    assertWorkspaceBoundaryUnchanged(workspace);
    assertEvidenceDirectoryUnchanged(directoryState.evidenceRootIdentity, "Feature 6 stage6 evidence root");
    assertEvidenceDirectoryUnchanged(directoryState.interpretationRootIdentity, "Feature 6 stage6 model interpretation root");
    renameSync(temporaryPath, artifactPath);
    ownedFinalFile = captureRegularFilePathIdentity(artifactPath, "Feature 6 model interpretation artifact");
    if (!sameOwnedRegularFile(ownedTemporaryFile, ownedFinalFile)) {
      throw new Error("Feature 6 model interpretation artifact identity changed during rename.");
    }
    assertOwnedFileInDirectory(ownedFinalFile, directoryState.interpretationRootIdentity, "Feature 6 model interpretation artifact");
    assertWorkspaceBoundaryUnchanged(workspace);
    committed = true;
    return ownedFinalFile;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (!committed) removeOwnedRegularFile(ownedFinalFile ?? ownedTemporaryFile ?? {
      requestedPath: temporaryPath,
      canonicalPath: temporaryPath,
      dev: Number.NaN,
      ino: Number.NaN,
    });
  }
}

function readPublishedWorkspaceArtifact(artifactPath, ownedFinalFile, workspace, directoryState, hooks = {}) {
  hooks.beforeReadPublishedArtifact?.();
  assertWorkspaceBoundaryUnchanged(workspace);
  assertEvidenceDirectoryUnchanged(directoryState.evidenceRootIdentity, "Feature 6 stage6 evidence root");
  assertEvidenceDirectoryUnchanged(directoryState.interpretationRootIdentity, "Feature 6 stage6 model interpretation root");

  const currentPathIdentity = captureRegularFilePathIdentity(artifactPath, "Feature 6 model interpretation artifact");
  if (!sameOwnedRegularFile(ownedFinalFile, currentPathIdentity)) {
    throw new Error("Feature 6 model interpretation artifact identity changed after rename.");
  }
  assertOwnedFileInDirectory(currentPathIdentity, directoryState.interpretationRootIdentity, "Feature 6 model interpretation artifact");

  const descriptor = openSync(artifactPath, "r");
  try {
    const ownedReadFile = captureRegularFileIdentity(artifactPath, descriptor, "Feature 6 model interpretation artifact");
    if (!sameOwnedRegularFile(ownedFinalFile, ownedReadFile)) {
      throw new Error("Feature 6 model interpretation artifact identity changed before reread.");
    }
    assertOwnedFileInDirectory(ownedReadFile, directoryState.interpretationRootIdentity, "Feature 6 model interpretation artifact");
    hooks.beforeReadPublishedArtifactDescriptor?.();
    const bytes = readDescriptorBytes(descriptor);
    const postReadStats = fstatSync(descriptor);
    const postReadPathStats = lstatSync(artifactPath);
    if (postReadPathStats.isSymbolicLink()
      || postReadStats.dev !== postReadPathStats.dev
      || postReadStats.ino !== postReadPathStats.ino) {
      throw new Error("Feature 6 model interpretation artifact is invalid after reread.");
    }
    const postReadIdentity = captureRegularFilePathIdentity(artifactPath, "Feature 6 model interpretation artifact");
    if (!sameOwnedRegularFile(ownedFinalFile, postReadIdentity)) {
      throw new Error("Feature 6 model interpretation artifact identity changed during reread.");
    }
    assertOwnedFileInDirectory(postReadIdentity, directoryState.interpretationRootIdentity, "Feature 6 model interpretation artifact");
    assertWorkspaceBoundaryUnchanged(workspace);
    assertEvidenceDirectoryUnchanged(directoryState.evidenceRootIdentity, "Feature 6 stage6 evidence root");
    assertEvidenceDirectoryUnchanged(directoryState.interpretationRootIdentity, "Feature 6 stage6 model interpretation root");
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

export function materializeF6ModelInterpretation(options, hooks = {}) {
  const f2Loaded = readJsonArtifact(options.f2ArtifactRoot, ARTIFACTS.f2, f2UserReportSchema);
  const f3Loaded = readJsonArtifact(options.f3ArtifactRoot, ARTIFACTS.f3, readableDrawingGovernanceResultSchema);
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

  const workspace = resolveWorkspaceMode(options);
  const responseBytes = readGovernedResponse(options.responsePath, options.outputRoot, workbookHash, workspace, hooks);
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

  const targetDirectory = ensureOutputDirectory(options.outputRoot, workbookHash, randomUUID(), workspace, hooks);
  const artifactPath = path.join(targetDirectory.directoryPath, "Feature6-Model-Interpretation.json");
  const artifactContent = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  let bytes;
  if (workspace) {
    const ownedFinalFile = atomicWriteWorkspaceArtifact(artifactPath, artifactContent, workspace, targetDirectory, hooks);
    try {
      bytes = readPublishedWorkspaceArtifact(artifactPath, ownedFinalFile, workspace, targetDirectory, hooks);
    } catch (error) {
      removeOwnedRegularFile(ownedFinalFile);
      throw error;
    }
  } else {
    const descriptor = openSync(artifactPath, "wx");
    try {
      writeFileSync(descriptor, artifactContent);
    } finally {
      closeSync(descriptor);
    }
    bytes = readFileSync(artifactPath);
  }
  const readback = f5MultimodalArtifactV3Schema.parse(JSON.parse(bytes.toString("utf8")));
  if (!validateF5MultimodalArtifactV3(readback, authority).success) throw new Error("Model interpretation readback failed authority validation.");
  if (workspace) {
    assertWorkspaceBoundaryUnchanged(workspace);
    assertEvidenceDirectoryUnchanged(targetDirectory.evidenceRootIdentity, "Feature 6 stage6 evidence root");
    assertEvidenceDirectoryUnchanged(targetDirectory.interpretationRootIdentity, "Feature 6 stage6 model interpretation root");
  }
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