import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as contracts from "./index.js";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

function request(worksheetName = "Analysis-A") {
  const factorRows = [{
    worksheetName,
    tableId: "table-1",
    sourceRow: 2,
    factorOrdinal: { value: "A", rawText: " A ", sourceCell: `${worksheetName}!Z2` },
    factorName: "Bracket height",
    partName: "Bracket",
    partCategory: "CNC",
    drawingNumber: "DRAW-1",
    dimId: "307",
    nominal: 1,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    sourceCells: { factorName: `${worksheetName}!A2`, nominalValue: `${worksheetName}!B2` },
  }];
  const input = {
    contractVersion: "f5-multimodal-request-v3",
    inputClassification: "confidential",
    requestHash: "",
    sessionId: "session-1",
    revision: 7,
    inputRevision: 3,
    workbook: { fileName: "Anonymous.xlsx", contentHash: sha("workbook") },
    worksheetName,
    tableId: "table-1",
    activeFactorCount: 1,
    factorSetHash: contracts.createF5MultimodalFactorSetHash(factorRows),
    image: {
      mediaType: "image/png",
      contentHash: sha(`image:${worksheetName}`),
      byteLength: 128,
      artifactPath: `sheets/anonymous/images/${worksheetName}.png`,
    },
    factorRows,
  };
  input.requestHash = contracts.createF5MultimodalRequestHash(input);
  return input;
}

function result(input = request()) {
  return {
    contractVersion: "f5-multimodal-result-v3",
    outputClassification: "confidential",
    requestHash: input.requestHash,
    sessionId: input.sessionId,
    revision: input.revision,
    inputRevision: input.inputRevision,
    workbookContentHash: input.workbook.contentHash,
    worksheetName: input.worksheetName,
    tableId: input.tableId,
    imageContentHash: input.image.contentHash,
    model: { modelId: "controlled-vision-model", supportsImage: true },
    imageTableInterpretation: "The tolerance path image and complete Factor table are consistent.",
    rowMappings: input.factorRows.map((row) => ({
      worksheetName: row.worksheetName,
      tableId: row.tableId,
      sourceRow: row.sourceRow,
      factorOrdinal: row.factorOrdinal,
      mappingStatus: "matched",
      visibleStatus: "visible",
      interpretation: `Factor ${row.factorOrdinal.value} is visible in the interpreted loop context.`,
    })),
  };
}

function scopeEvaluations() {
  return ["tolerance_loop_closure", "datum_chain", "assembly_datum_face", "stack_start", "direction"].map((scope) => ({
    scope,
    status: "insufficient_evidence",
    observedValue: "ambiguous",
    confidence: "low",
    visibleBasis: "The supplied image does not establish this geometry.",
  }));
}

function schemas() {
  return contracts as typeof contracts & {
    f5MultimodalWorksheetRequestV3Schema?: { safeParse(value: unknown): { success: boolean } };
    f5MultimodalWorksheetResultV3Schema?: { safeParse(value: unknown): { success: boolean } };
    f5MultimodalArtifactV3Schema?: { safeParse(value: unknown): { success: boolean } };
    f5MultimodalWorksheetPairV3Schema?: { safeParse(value: unknown): { success: boolean } };
    f5MultimodalEvaluationFailureReasonSchema?: { safeParse(value: unknown): { success: boolean } };
    f5MultimodalWorksheetOutcomeV4Schema?: { safeParse(value: unknown): { success: boolean } };
    f5MultimodalArtifactV4Schema?: { safeParse(value: unknown): { success: boolean } };
    createF5MultimodalFactorSetHash?: (rows: unknown[]) => string;
    createF5MultimodalRequestHash?: (value: unknown) => string;
    validateF5MultimodalArtifactV3?: (value: unknown, authority: unknown) => { success: boolean };
    validateF5MultimodalArtifactV4?: (value: unknown, authority: unknown) => { success: boolean };
  };
}

describe("F5 mandatory multimodal v3 contracts", () => {
  it("requires five assessed scopes for v4 completion while preserving historical v3 pairs", () => {
    const input = request();
    const output = result(input);
    const pair = { request: input, result: output };
    expect(contracts.f5MultimodalWorksheetPairV3Schema.parse(pair)).toEqual(pair);
    expect(contracts.f5MultimodalWorksheetOutcomeV4Schema.safeParse({ status: "completed", ...pair }).success).toBe(false);
    const scopes = ["tolerance_loop_closure", "datum_chain", "assembly_datum_face", "stack_start", "direction"].map((scope) => ({
      scope, status: "needs_review", observedValue: "ambiguous", confidence: "low", visibleBasis: "The visible image leaves the geometry ambiguous.",
    }));
    const completed = { status: "completed", ...pair, scopeEvaluations: scopes };
    expect(contracts.f5MultimodalWorksheetOutcomeV4Schema.parse(completed)).toEqual(completed);
    for (const scopeEvaluations of [scopes.slice(1), [...scopes.slice(1), scopes[1]], scopes.map((scope) => ({ ...scope, status: "not_evaluated" }))]) {
      expect(contracts.f5MultimodalWorksheetOutcomeV4Schema.safeParse({ ...completed, scopeEvaluations }).success).toBe(false);
    }
  });

  it("exports strict per-worksheet request and result schemas", () => {
    const exported = schemas();

    expect(exported.f5MultimodalWorksheetRequestV3Schema).toBeDefined();
    expect(exported.f5MultimodalWorksheetResultV3Schema).toBeDefined();
    expect(exported.f5MultimodalWorksheetRequestV3Schema?.safeParse(request()).success).toBe(true);
    expect(exported.f5MultimodalWorksheetResultV3Schema?.safeParse(result()).success).toBe(true);
  });

  it("rejects incomplete, blank, or duplicate active Factor mappings", () => {
    const schema = schemas().f5MultimodalWorksheetRequestV3Schema!;
    const blank = request();
    blank.factorRows[0]!.factorOrdinal = { value: "", rawText: "", sourceCell: "Analysis-A!Z2" };
    expect(schema.safeParse(blank).success).toBe(false);

    const duplicate = request();
    duplicate.factorRows.push({ ...structuredClone(duplicate.factorRows[0]!), sourceRow: 3, factorOrdinal: { value: "a", rawText: "a", sourceCell: "Analysis-A!Z3" } });
    expect(schema.safeParse(duplicate).success).toBe(false);

    const incomplete = request();
    incomplete.activeFactorCount = 2;
    expect(schema.safeParse(incomplete).success).toBe(false);
  });

  it("requires one matched model mapping for every active Factor identity", () => {
    const schema = schemas().f5MultimodalArtifactV3Schema!;
    const input = request();
    const output = result(input);
    const artifact = {
      contractVersion: "f5-multimodal-artifact-v3",
      outputClassification: "confidential",
      sessionId: input.sessionId,
      revision: input.revision,
      inputRevision: input.inputRevision,
      workbookContentHash: input.workbook.contentHash,
      selectedWorksheetNames: [input.worksheetName],
      worksheets: [{ request: input, result: output }],
    };
    expect(schema.safeParse(artifact).success).toBe(true);

    const missing = structuredClone(artifact);
    missing.worksheets[0]!.result.rowMappings = [];
    expect(schema.safeParse(missing).success).toBe(false);

    const stale = structuredClone(artifact);
    stale.worksheets[0]!.result.revision -= 1;
    expect(schema.safeParse(stale).success).toBe(false);
  });

  it("requires every selected worksheet exactly once", () => {
    const schema = schemas().f5MultimodalArtifactV3Schema!;
    const input = request();
    const artifact = {
      contractVersion: "f5-multimodal-artifact-v3",
      outputClassification: "confidential",
      sessionId: input.sessionId,
      revision: input.revision,
      inputRevision: input.inputRevision,
      workbookContentHash: input.workbook.contentHash,
      selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
      worksheets: [{ request: input, result: result(input) }],
    };

    expect(schema.safeParse(artifact).success).toBe(false);
  });

  it.each([
    ["text-only model", (artifact: any) => { artifact.worksheets[0].result.model.supportsImage = false; }],
    ["ordinal not visible", (artifact: any) => { artifact.worksheets[0].result.rowMappings[0].visibleStatus = "not_visible"; }],
    ["request hash mismatch", (artifact: any) => { artifact.worksheets[0].result.requestHash = sha("other-request"); }],
    ["image hash mismatch", (artifact: any) => { artifact.worksheets[0].result.imageContentHash = sha("other-image"); }],
    ["worksheet mismatch", (artifact: any) => { artifact.worksheets[0].result.worksheetName = "Analysis-B"; }],
    ["table mismatch", (artifact: any) => { artifact.worksheets[0].result.tableId = "table-2"; }],
    ["source row mismatch", (artifact: any) => { artifact.worksheets[0].result.rowMappings[0].sourceRow = 99; }],
    ["extra mapping", (artifact: any) => { artifact.worksheets[0].result.rowMappings.push({ ...structuredClone(artifact.worksheets[0].result.rowMappings[0]), sourceRow: 3, factorOrdinal: { value: "B", rawText: "B", sourceCell: "Analysis-A!Z3" } }); }],
  ])("fails closed for %s", (_name, mutate) => {
    const schema = schemas().f5MultimodalArtifactV3Schema!;
    const input = request();
    const artifact = {
      contractVersion: "f5-multimodal-artifact-v3",
      outputClassification: "confidential",
      sessionId: input.sessionId,
      revision: input.revision,
      inputRevision: input.inputRevision,
      workbookContentHash: input.workbook.contentHash,
      selectedWorksheetNames: [input.worksheetName],
      worksheets: [{ request: input, result: result(input) }],
    };
    mutate(artifact);

    expect(schema.safeParse(artifact).success).toBe(false);
  });

  it("binds requestHash to the exact canonical request payload", () => {
    const exported = schemas();
    expect(exported.createF5MultimodalRequestHash).toBeDefined();
    const input = request();
    input.factorRows[0]!.factorName = "Changed after hashing";

    expect(exported.f5MultimodalWorksheetRequestV3Schema!.safeParse(input).success).toBe(false);
  });

  it("preserves exact request/result identities instead of trimming them", () => {
    const exported = schemas();
    expect(exported.f5MultimodalWorksheetPairV3Schema).toBeDefined();
    const input = request();
    const output = result(input);
    output.worksheetName = ` ${input.worksheetName} `;

    expect(exported.f5MultimodalWorksheetPairV3Schema!.safeParse({ request: input, result: output }).success).toBe(false);
  });

  it.each([
    ["ordinal value", (output: ReturnType<typeof result>) => { output.rowMappings[0]!.factorOrdinal.value = "a"; }],
    ["ordinal raw text", (output: ReturnType<typeof result>) => { output.rowMappings[0]!.factorOrdinal.rawText = "A"; }],
    ["ordinal source cell", (output: ReturnType<typeof result>) => { output.rowMappings[0]!.factorOrdinal.sourceCell = "Analysis-A!Y2"; }],
    ["table identity", (output: ReturnType<typeof result>) => { output.tableId = " table-1 "; }],
  ])("rejects a non-identical %s", (_name, mutate) => {
    const input = request();
    const output = result(input);
    mutate(output);

    expect(schemas().f5MultimodalWorksheetPairV3Schema!.safeParse({ request: input, result: output }).success).toBe(false);
  });

  it("rejects unknown nested fields and whitespace-only model interpretations", () => {
    const input = request();
    const unknown = result(input) as ReturnType<typeof result> & { model: { unexpected?: boolean } };
    unknown.model.unexpected = true;
    expect(schemas().f5MultimodalWorksheetResultV3Schema!.safeParse(unknown).success).toBe(false);

    const blank = result(input);
    blank.imageTableInterpretation = "   ";
    expect(schemas().f5MultimodalWorksheetResultV3Schema!.safeParse(blank).success).toBe(false);
  });

  it("rejects a self-consistent request that omits an authoritative active Factor", () => {
    const exported = schemas();
    expect(exported.createF5MultimodalFactorSetHash).toBeDefined();
    expect(exported.validateF5MultimodalArtifactV3).toBeDefined();
    const authoritative = request();
    const omitted = request();
    authoritative.factorRows.push({
      ...structuredClone(authoritative.factorRows[0]!),
      sourceRow: 3,
      factorOrdinal: { value: "B", rawText: "B", sourceCell: "Analysis-A!Z3" },
    });
    authoritative.activeFactorCount = authoritative.factorRows.length;
    authoritative.factorSetHash = contracts.createF5MultimodalFactorSetHash(authoritative.factorRows);
    const artifact = {
      contractVersion: "f5-multimodal-artifact-v3",
      outputClassification: "confidential",
      sessionId: omitted.sessionId,
      revision: omitted.revision,
      inputRevision: omitted.inputRevision,
      workbookContentHash: omitted.workbook.contentHash,
      selectedWorksheetNames: [omitted.worksheetName],
      worksheets: [{ request: omitted, result: result(omitted) }],
    };
    const authority = {
      sessionId: authoritative.sessionId,
      revision: authoritative.revision,
      inputRevision: authoritative.inputRevision,
      workbookContentHash: authoritative.workbook.contentHash,
      worksheets: [{
        worksheetName: authoritative.worksheetName,
        tableId: authoritative.tableId,
        activeFactorCount: authoritative.activeFactorCount,
        factorSetHash: authoritative.factorSetHash,
      }],
    };

    expect(exported.validateF5MultimodalArtifactV3!(artifact, authority).success).toBe(false);
  });

  it("exports strict v4 worksheet outcomes that preserve completed and failed identities", () => {
    const exported = schemas();
    expect(exported.f5MultimodalEvaluationFailureReasonSchema).toBeDefined();
    expect(exported.f5MultimodalWorksheetOutcomeV4Schema).toBeDefined();
    expect(exported.f5MultimodalArtifactV4Schema).toBeDefined();
    expect(exported.validateF5MultimodalArtifactV4).toBeDefined();

    const completedRequest = request("Analysis-A");
    const failedRequest = request("Analysis-B");
    const artifact = {
      contractVersion: "f5-multimodal-artifact-v4",
      outputClassification: "confidential",
      sessionId: completedRequest.sessionId,
      revision: completedRequest.revision,
      inputRevision: completedRequest.inputRevision,
      workbookContentHash: completedRequest.workbook.contentHash,
      selectedWorksheetNames: [completedRequest.worksheetName, failedRequest.worksheetName],
      worksheets: [
        { status: "completed", request: completedRequest, result: result(completedRequest), scopeEvaluations: scopeEvaluations() },
        { status: "failed", request: failedRequest, reasonCode: "evaluation_failed", summary: "worksheet image evaluation failed" },
      ],
    };

    expect(exported.f5MultimodalArtifactV4Schema?.safeParse(artifact).success).toBe(true);

    const duplicateNames = structuredClone(artifact);
    duplicateNames.selectedWorksheetNames = [completedRequest.worksheetName, completedRequest.worksheetName];
    expect(exported.f5MultimodalArtifactV4Schema?.safeParse(duplicateNames).success).toBe(false);

    const missingWorksheet = structuredClone(artifact);
    missingWorksheet.selectedWorksheetNames = [completedRequest.worksheetName];
    expect(exported.f5MultimodalArtifactV4Schema?.safeParse(missingWorksheet).success).toBe(false);

    const requestHashMismatch = structuredClone(artifact);
    requestHashMismatch.worksheets[1]!.request.requestHash = sha("other-request");
    expect(exported.f5MultimodalArtifactV4Schema?.safeParse(requestHashMismatch).success).toBe(false);

    const orderMismatch = structuredClone(artifact);
    orderMismatch.worksheets.reverse();
    expect(exported.f5MultimodalArtifactV4Schema?.safeParse(orderMismatch).success).toBe(false);

    const unknownReason = structuredClone(artifact);
    unknownReason.worksheets[1] = { ...unknownReason.worksheets[1], reasonCode: "runner_failed" };
    expect(exported.f5MultimodalArtifactV4Schema?.safeParse(unknownReason).success).toBe(false);

    const missingRequestIdentity = structuredClone(artifact);
    delete missingRequestIdentity.worksheets[1].request.tableId;
    expect(exported.f5MultimodalArtifactV4Schema?.safeParse(missingRequestIdentity).success).toBe(false);
  });
});
