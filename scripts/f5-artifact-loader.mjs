import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import {
  drawingGovernanceResultV2Schema,
  f2ArtifactInputSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationRequestSchema,
  f5ImageObservationArtifactSchema,
  workbookCatalogFileNameSchema,
} from "../packages/contracts/dist/contracts.js";

const SOURCE_REFERENCES = Object.freeze({
  f1: "Feature1-Report.json",
  f3: "Feature3-Report.json",
  f4: "Feature4-Calculation.json",
});
const MAX_F1_WORKSHEET_INDEXES = 1000;
const MAX_JSON_ARTIFACT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_ARTIFACT_BYTES = 50 * 1024 * 1024;
const REASON_PRIORITY = Object.freeze({
  artifact_missing: 1,
  artifact_identity_mismatch: 2,
  artifact_contract_invalid: 3,
});

function inputRejected(reasonCode, artifactReference) {
  return { status: "inputRejected", reasonCode, artifactReference };
}

function ioReason(error) {
  return new Set(["ENOENT", "ENOTDIR"]).has(error?.code)
    ? "artifact_missing"
    : "artifact_contract_invalid";
}

function safeChild(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    return { reasonCode: "artifact_identity_mismatch" };
  }
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relation = path.relative(resolvedRoot, resolvedPath);
  if (!relation || relation.split(path.sep)[0] === ".." || path.isAbsolute(relation)) {
    return { reasonCode: "artifact_identity_mismatch" };
  }
  try {
    const realRoot = realpathSync(resolvedRoot);
    const realChild = realpathSync(resolvedPath);
    const realRelation = path.relative(realRoot, realChild);
    return realRelation && realRelation.split(path.sep)[0] !== ".." && !path.isAbsolute(realRelation)
      ? { filePath: realChild }
      : { reasonCode: "artifact_identity_mismatch" };
  } catch (error) {
    return { reasonCode: ioReason(error) };
  }
}

function safeReference(filePath) {
  const reference = path.basename(String(filePath));
  return reference || "artifact.json";
}

function readJson(filePath, artifactReference) {
  let contents;
  try {
    if (statSync(filePath).size > MAX_JSON_ARTIFACT_BYTES) {
      return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
    }
    contents = readFileSync(filePath, "utf8");
  } catch (error) {
    return { rejection: inputRejected(ioReason(error), artifactReference) };
  }
  try {
    return { value: JSON.parse(contents) };
  } catch {
    return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
  }
}

function readAndParse(filePath, artifactReference, schema) {
  const loaded = readJson(filePath, artifactReference);
  if (loaded.rejection) return loaded;
  const parsed = schema.safeParse(loaded.value);
  return parsed.success
    ? { value: parsed.data }
    : { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
}

function duplicateNames(indexes) {
  const seen = new Set();
  const duplicates = new Set();
  for (const index of indexes) {
    if (seen.has(index?.worksheetName)) duplicates.add(index?.worksheetName);
    seen.add(index?.worksheetName);
  }
  return duplicates;
}

function validF1Index(index, referenceField) {
  return index !== null
    && typeof index === "object"
    && !Array.isArray(index)
    && typeof index.worksheetName === "string"
    && index.worksheetName.length > 0
    && typeof index[referenceField] === "string"
    && index[referenceField].length > 0;
}

function loadF1Index(f1ArtifactRoot) {
  const reportPath = path.join(path.resolve(f1ArtifactRoot), SOURCE_REFERENCES.f1);
  const loaded = readJson(reportPath, SOURCE_REFERENCES.f1);
  if (loaded.rejection) return loaded;
  const report = loaded.value;
  const workbookRecord = Array.isArray(report?.workbooks) && report.workbooks.length === 1
    ? report.workbooks[0]
    : undefined;
  const workbook = workbookRecord?.workbook;
  const jsonSheets = workbookRecord?.task15_factor_table_and_debug_json?.sheets;
  const markdownSheets = workbookRecord?.task16_loop_screenshot_and_run_record?.sheets ?? [];
  if (report?.contractVersion !== "v1"
    || typeof report.generatedAt !== "string"
    || !workbookCatalogFileNameSchema.safeParse(workbook?.fileName).success
    || !workbook?.contentHash
    || !Array.isArray(jsonSheets)
    || !Array.isArray(markdownSheets)
    || jsonSheets.length > MAX_F1_WORKSHEET_INDEXES
    || markdownSheets.length > MAX_F1_WORKSHEET_INDEXES
    || jsonSheets.some((index) => !validF1Index(index, "jsonPath"))
    || markdownSheets.some((index) => !validF1Index(index, "mdPath"))) {
    return { rejection: inputRejected("artifact_contract_invalid", SOURCE_REFERENCES.f1) };
  }

  const duplicateJsonNames = duplicateNames(jsonSheets);
  const duplicateMarkdownNames = duplicateNames(markdownSheets);
  const duplicateWorksheetNames = new Set([...duplicateJsonNames, ...duplicateMarkdownNames]);
  const worksheetErrors = new Map(
    [...duplicateWorksheetNames].map((worksheetName) => [worksheetName, "artifact_contract_invalid"]),
  );
  return {
    value: {
      workbook: {
        fileName: workbook.fileName,
        contentHash: workbook.contentHash,
        f1GeneratedAt: report.generatedAt,
      },
      artifactContractVersion: report.artifactContractVersion,
      jsonByWorksheet: new Map(
        jsonSheets
          .filter(({ worksheetName }) => !duplicateJsonNames.has(worksheetName))
          .map((index) => [index.worksheetName, index]),
      ),
      markdownByWorksheet: new Map(
        markdownSheets
          .filter(({ worksheetName }) => !duplicateMarkdownNames.has(worksheetName))
          .map((index) => [index.worksheetName, index.mdPath]),
      ),
      worksheetErrors,
    },
  };
}

function loadSelectedF1Artifacts(f1ArtifactRoot, f1Index, selection) {
  const {
    workbook,
    artifactContractVersion,
    jsonByWorksheet,
    markdownByWorksheet,
    worksheetErrors,
  } = f1Index;
  const worksheets = [];
  const imageReferences = new Map();
  for (const worksheetName of selection) {
    if (worksheetErrors.has(worksheetName)) continue;
    const index = jsonByWorksheet.get(worksheetName);
    if (!index) {
      worksheetErrors.set(worksheetName, "artifact_identity_mismatch");
      continue;
    }
    const worksheetPath = safeChild(f1ArtifactRoot, index.jsonPath);
    if (!worksheetPath.filePath) {
      worksheetErrors.set(worksheetName, worksheetPath.reasonCode);
      continue;
    }
    const worksheetLoaded = readJson(worksheetPath.filePath, SOURCE_REFERENCES.f1);
    if (worksheetLoaded.rejection) {
      worksheetErrors.set(worksheetName, worksheetLoaded.rejection.reasonCode);
      continue;
    }
    const worksheet = worksheetLoaded.value;
    if (worksheet?.worksheetName !== worksheetName
      || worksheet?.workbook?.fileName !== workbook.fileName
      || worksheet?.workbook?.contentHash !== workbook.contentHash) {
      worksheetErrors.set(worksheetName, "artifact_identity_mismatch");
      continue;
    }

    let tolerancePathImage = { status: "unavailable", reasonCode: "image_missing" };
    const semanticImage = worksheet.tolerancePathImage;
    if (semanticImage?.status === "available") {
      const labelWorksheetName = semanticImage.labelSourceCell?.split("!")[0];
      if (labelWorksheetName !== worksheetName) {
        worksheetErrors.set(worksheetName, "artifact_identity_mismatch");
        continue;
      }
      const candidates = (worksheet.imageAssets ?? []).filter(
        (image) => image?.contentHash === semanticImage.imageContentHash,
      );
      const image = candidates.length === 1 ? candidates[0] : undefined;
      if (!image) {
        worksheetErrors.set(worksheetName, "artifact_identity_mismatch");
        continue;
      }
      const imagePath = safeChild(f1ArtifactRoot, image.outputFile);
      if (!imagePath.filePath) {
        worksheetErrors.set(worksheetName, imagePath.reasonCode);
        continue;
      }
      if (!new Set(["image/png", "image/jpeg"]).has(image.mediaType)) {
        worksheetErrors.set(worksheetName, "artifact_contract_invalid");
        continue;
      }
      let imageBytes;
      try {
        if (statSync(imagePath.filePath).size > MAX_IMAGE_ARTIFACT_BYTES) {
          worksheetErrors.set(worksheetName, "artifact_contract_invalid");
          continue;
        }
        imageBytes = readFileSync(imagePath.filePath);
      } catch (error) {
        worksheetErrors.set(worksheetName, ioReason(error));
        continue;
      }
      const actualHash = createHash("sha256").update(imageBytes).digest("hex");
      if (imageBytes.length === 0 || actualHash !== image.contentHash) {
        worksheetErrors.set(worksheetName, "artifact_identity_mismatch");
        continue;
      } else {
        tolerancePathImage = {
          status: "available",
          imagePath: image.outputFile,
          contentHash: image.contentHash,
          mediaType: image.mediaType,
        };
        imageReferences.set(worksheetName, {
          artifact: "f1",
          relativePath: image.outputFile,
          contentHash: image.contentHash,
          worksheetName,
        });
      }
    }
    const canonical = f2ArtifactInputSchema.safeParse({
      contractVersion: "v1",
      inputClassification: "confidential",
      artifactRoot: "controlled-f1-artifact",
      workbook,
      worksheets: [{
      worksheetName,
      toleranceLoopDescription: worksheet.toleranceLoopDescription,
      systemSpecification: new Set(["f1-semantic-v2", "f1-semantic-v3"]).has(artifactContractVersion)
        ? worksheet.systemSpecification
        : { status: "unavailable", reasonCode: "legacy_artifact_missing_system_specification" },
      worksheetJsonPath: index.jsonPath,
      worksheetMdPath: markdownByWorksheet.get(worksheetName) ?? `worksheets/${worksheetName}.md`,
      tolerancePathImage,
      factorTables: worksheet.factorTables,
      }],
    });
    if (!canonical.success) {
      worksheetErrors.set(worksheetName, "artifact_contract_invalid");
      imageReferences.delete(worksheetName);
      continue;
    }
    worksheets.push(canonical.data.worksheets[0]);
  }
  return {
    value: {
      workbook,
      worksheets: new Map(worksheets.map((worksheet) => [worksheet.worksheetName, worksheet])),
      imageReferences,
      worksheetErrors,
    },
  };
}

function sameImageReference(left, right) {
  return left?.artifact === "f1"
    && right?.artifact === "f1"
    && left.relativePath === right.relativePath
    && left.contentHash === right.contentHash
    && left.worksheetName === right.worksheetName;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function sameStableValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function buildExpectedContextSnapshot(f1Worksheet, f3Worksheet, tableId) {
  const f1Table = f1Worksheet.factorTables.find((table) => table.tableId === tableId);
  if (!f1Table) return undefined;
  const f1BySourceRow = new Map(f1Table.rows.map((row) => [row.sourceRow, row]));
  const rows = [];
  for (const row of [...f3Worksheet.rows].sort(
    (left, right) => left.source.sourceRow - right.source.sourceRow,
  )) {
    const f1Row = f1BySourceRow.get(row.source.sourceRow);
    if (row.source.tableId !== tableId
      || !f1Row
      || f1Row.actualFields.partName !== row.partSubsystem
      || f1Row.actualFields.factorName !== row.factorDescription
      || !sameStableValue(f1Row.factorOrdinal, row.factorOrdinal)) {
      return undefined;
    }
    rows.push({
      tableId: row.source.tableId,
      sourceRow: row.source.sourceRow,
      factorOrdinal: row.factorOrdinal,
      partName: f1Row.actualFields.partName,
      partSubsystem: row.partSubsystem,
      partCategory: row.partCategory,
      factorName: f1Row.actualFields.factorName,
      factorDescription: row.factorDescription,
      nominal: row.nominal,
      upperTolerance: row.upperTolerance,
      lowerTolerance: row.lowerTolerance,
      sigmaLevel: row.sigmaLevel,
      sourceCells: row.source.sourceCells,
    });
  }
  return {
    dimensionDescription: f3Worksheet.toleranceLoopDescription,
    rows,
  };
}

function sameWorksheetSet(worksheets, selection) {
  const names = worksheets.map(({ worksheetName }) => worksheetName);
  return names.length === selection.length
    && new Set(names).size === names.length
    && names.every((name) => selection.includes(name));
}

function selectedNames(selectedWorksheetNames, calculations) {
  const calculationNames = calculations.map(({ worksheetSelection }) => worksheetSelection.worksheetName);
  const names = selectedWorksheetNames === undefined ? calculationNames : selectedWorksheetNames;
  if (!Array.isArray(names)
    || names.length === 0
    || names.some((name) => typeof name !== "string" || name.length === 0)
    || new Set(names).size !== names.length
    || names.some((name) => !calculationNames.includes(name))) {
    return undefined;
  }
  return names;
}

function worksheetRejection(worksheetName, reasonCode = "artifact_identity_mismatch") {
  return {
    worksheetName,
    reasonCode,
    artifactReference: `worksheet:${worksheetName}`,
  };
}

function highestPriorityRejection(rejectedWorksheets) {
  return rejectedWorksheets.reduce((highest, rejection) => (
    REASON_PRIORITY[rejection.reasonCode] > REASON_PRIORITY[highest.reasonCode] ? rejection : highest
  ));
}

export function loadF5ArtifactBundle({
  f1ArtifactRoot,
  f3ArtifactRoot,
  f4ArtifactRoot,
  selectedWorksheetNames,
  imageObservationArtifact,
}) {
  const f1IndexLoaded = loadF1Index(f1ArtifactRoot);
  if (f1IndexLoaded.rejection) return f1IndexLoaded.rejection;

  const f4Loaded = readAndParse(
    path.join(path.resolve(f4ArtifactRoot), SOURCE_REFERENCES.f4),
    SOURCE_REFERENCES.f4,
    f4WorkflowCalculationResultSchema,
  );
  if (f4Loaded.rejection) return f4Loaded.rejection;

  const f4 = f4Loaded.value;
  const selection = selectedNames(selectedWorksheetNames, f4.calculations);
  if (!selection) return inputRejected("worksheet_selection_invalid", "selectedWorksheetNames");
  const workbook = f1IndexLoaded.value.workbook;
  if (workbook.contentHash !== f4.source.workbookContentHash
    || workbook.fileName !== f4.source.workbookFileName) {
    return inputRejected("artifact_identity_mismatch", SOURCE_REFERENCES.f4);
  }

  const f1Loaded = loadSelectedF1Artifacts(f1ArtifactRoot, f1IndexLoaded.value, selection);
  const { worksheets: f1Worksheets, imageReferences, worksheetErrors } = f1Loaded.value;

  const f3Loaded = readAndParse(
    path.join(path.resolve(f3ArtifactRoot), SOURCE_REFERENCES.f3),
    SOURCE_REFERENCES.f3,
    drawingGovernanceResultV2Schema,
  );
  if (f3Loaded.rejection) return f3Loaded.rejection;
  if (!new Set(["completed", "governance_required"]).has(f3Loaded.value.status)) {
    return inputRejected("artifact_contract_invalid", SOURCE_REFERENCES.f3);
  }
  const f3 = f3Loaded.value;
  if (!workbookCatalogFileNameSchema.safeParse(f3.workbook.fileName).success) {
    return inputRejected("artifact_contract_invalid", SOURCE_REFERENCES.f3);
  }
  if (workbook.contentHash !== f3.workbook.contentHash || workbook.fileName !== f3.workbook.fileName) {
    return inputRejected("artifact_identity_mismatch", SOURCE_REFERENCES.f3);
  }

  const f3Worksheets = new Map(f3.worksheets.map((worksheet) => [worksheet.worksheetName, worksheet]));
  const calculationByWorksheet = new Map(
    f4.calculations.map((calculationResult) => [calculationResult.worksheetSelection.worksheetName, calculationResult]),
  );

  const acceptedWorksheets = [];
  const rejectedWorksheets = [];
  for (const worksheetName of selection) {
    const f1Worksheet = f1Worksheets.get(worksheetName);
    const f3Worksheet = f3Worksheets.get(worksheetName);
    const calculationResult = calculationByWorksheet.get(worksheetName);
    const imageReference = imageReferences.get(worksheetName);
    if (worksheetErrors.has(worksheetName) || !f1Worksheet || !f3Worksheet || !calculationResult) {
      rejectedWorksheets.push(worksheetRejection(
        worksheetName,
        worksheetErrors.get(worksheetName) ?? "artifact_identity_mismatch",
      ));
      continue;
    }
    const table = f1Worksheet.factorTables.find(
      ({ tableId }) => tableId === calculationResult.worksheetSelection.tableId,
    );
    const f1SourceRows = new Set((table?.rows ?? []).map(({ sourceRow }) => sourceRow));
    const factorsExistInF1 = calculationResult.factors.every(
      ({ source }) => source.worksheetName === worksheetName
        && source.tableId === table?.tableId
        && f1SourceRows.has(source.sourceRow),
    );
    const governanceImagesMatch = f3Worksheet.rows.every(
      (row) => sameImageReference(row.imageReference, imageReference),
    );

    const requestWorksheet = {
      worksheetName,
      imageReference,
      governanceRows: f3Worksheet.rows,
      calculationResult,
      imageObservations: [],
    };
    const singleWorksheetRequest = f5DataInterpretationRequestSchema.safeParse({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbook: { fileName: workbook.fileName, contentHash: workbook.contentHash },
      knowledgeBaseVersion: "interpretation-rules-v1",
      worksheets: [requestWorksheet],
    });
    if (!imageReference || !table || !factorsExistInF1 || !governanceImagesMatch || !singleWorksheetRequest.success) {
      rejectedWorksheets.push(worksheetRejection(worksheetName));
    } else {
      acceptedWorksheets.push(singleWorksheetRequest.data.worksheets[0]);
    }
  }

  if (acceptedWorksheets.length === 0) {
    const rejection = highestPriorityRejection(rejectedWorksheets);
    return inputRejected(rejection.reasonCode, rejection.artifactReference);
  }
  const baselineRequest = f5DataInterpretationRequestSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: workbook.fileName, contentHash: workbook.contentHash },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: acceptedWorksheets,
  });

  const acceptedResult = (request, extras = {}) => ({
    status: "accepted",
    request,
    rejectedWorksheets,
    worksheetOrder: [...selection],
    sourceReferences: SOURCE_REFERENCES,
    ...extras,
  });
  if (imageObservationArtifact === undefined) return acceptedResult(baselineRequest);

  const observationReference = safeReference(imageObservationArtifact);
  const observationFallback = (reasonCode) => acceptedResult(baselineRequest, {
    observationFallback: { reasonCode, artifactReference: observationReference },
  });
  const observationJson = readJson(path.resolve(imageObservationArtifact), observationReference);
  if (observationJson.rejection) {
    return observationFallback(observationJson.rejection.reasonCode);
  }
  const observationParsed = f5ImageObservationArtifactSchema.safeParse(observationJson.value);
  if (!observationParsed.success) {
    return observationFallback("artifact_contract_invalid");
  }

  const observationArtifact = observationParsed.data;
  if (observationArtifact.observationVersion === "f5-image-observation-v2") {
    if (observationArtifact.workbookContentHash !== workbook.contentHash
      || !sameWorksheetSet(observationArtifact.worksheets, selection)) {
      return observationFallback("artifact_identity_mismatch");
    }

    const observationByWorksheet = new Map(
      observationArtifact.worksheets.map((worksheet) => [worksheet.worksheetName, worksheet]),
    );
    const baselineByWorksheet = new Map(
      baselineRequest.worksheets.map((worksheet) => [worksheet.worksheetName, worksheet]),
    );
    const enrichedWorksheets = [];
    for (const worksheetName of selection) {
      const baselineWorksheet = baselineByWorksheet.get(worksheetName);
      const observation = observationByWorksheet.get(worksheetName);
      const f1Worksheet = f1Worksheets.get(worksheetName);
      const f3Worksheet = f3Worksheets.get(worksheetName);
      const calculationResult = calculationByWorksheet.get(worksheetName);
      const imageReference = imageReferences.get(worksheetName);
      const expectedSnapshot = f1Worksheet && f3Worksheet && calculationResult
        ? buildExpectedContextSnapshot(
          f1Worksheet,
          f3Worksheet,
          calculationResult.worksheetSelection.tableId,
        )
        : undefined;
      if (!baselineWorksheet
        || !observation
        || !expectedSnapshot
        || !sameImageReference(observation.imageReference, imageReference)
        || !sameStableValue(observation.contextSnapshot, expectedSnapshot)) {
        return observationFallback("artifact_identity_mismatch");
      }
      enrichedWorksheets.push({
        ...baselineWorksheet,
        observationVersion: observationArtifact.observationVersion,
        contextSnapshot: observation.contextSnapshot,
        imageObservations: observation.observations,
      });
    }
    return acceptedResult(
      { ...baselineRequest, worksheets: enrichedWorksheets },
      {
        sourceReferences: { ...SOURCE_REFERENCES, observation: observationReference },
        observationArtifact,
      },
    );
  }

  if (observationArtifact.workbookContentHash !== workbook.contentHash) {
    return inputRejected("artifact_identity_mismatch", observationReference);
  }
  const selectedWorksheetSet = new Set(selection);
  if (observationArtifact.worksheets.some(({ worksheetName }) => (
    !selectedWorksheetSet.has(worksheetName)
    || !calculationByWorksheet.has(worksheetName)
  ))) {
    return inputRejected("artifact_identity_mismatch", observationReference);
  }
  const observationByWorksheet = new Map(
    observationArtifact.worksheets.map((worksheet) => [worksheet.worksheetName, worksheet]),
  );
  const v1AcceptedWorksheets = [];
  for (const worksheet of baselineRequest.worksheets) {
    const observation = observationByWorksheet.get(worksheet.worksheetName);
    if (observation && !sameImageReference(observation.imageReference, worksheet.imageReference)) {
      rejectedWorksheets.push(worksheetRejection(worksheet.worksheetName));
      continue;
    }
    v1AcceptedWorksheets.push({
      ...worksheet,
      imageObservations: observation?.observations ?? [],
    });
  }
  if (v1AcceptedWorksheets.length === 0) {
    const rejection = highestPriorityRejection(rejectedWorksheets);
    return inputRejected(rejection.reasonCode, rejection.artifactReference);
  }
  const request = f5DataInterpretationRequestSchema.parse({
    ...baselineRequest,
    worksheets: v1AcceptedWorksheets,
  });
  return acceptedResult(request, {
    sourceReferences: { ...SOURCE_REFERENCES, observation: observationReference },
    observationArtifact,
  });
}