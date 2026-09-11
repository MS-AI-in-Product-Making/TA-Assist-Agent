import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import { createF5MultimodalRequestHash } from "@ai-assist/contracts";
import type { F8SessionSnapshot, HostActionRecord, SessionArtifactReference } from "@ai-assist/workbench";

import { assertCurrentWorksheetInterpretationRequest, buildSelectedWorksheetInterpretationContexts, readClaimedWorksheetImage, type WorksheetInterpretationArtifactReader } from "./worksheet-interpretation-context.js";

const SESSION_ID = "76767676-7676-4767-8767-767676767676";
const WORKBOOK_HASH = "a".repeat(64);
const REVIEW_CONTEXT_ID = "c".repeat(64);
const IMAGE_A_BYTES = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const IMAGE_B_BYTES = IMAGE_A_BYTES;
const IMAGE_A_HASH = createHash("sha256").update(IMAGE_A_BYTES).digest("hex");
const IMAGE_B_HASH = createHash("sha256").update(IMAGE_B_BYTES).digest("hex");

describe("buildSelectedWorksheetInterpretationContexts", () => {
  it.each(["missing", "hash_mismatch", "mapping"])("isolates a %s request-build failure and keeps the other worksheet current", async (failure) => {
    const reader = artifacts(({ f2 }) => {
      if (failure === "mapping") f2.worksheets[1].rows[0].factorOrdinal.value = "";
    });
    const inspect = reader.inspectWorksheetImage;
    reader.inspectWorksheetImage = async (input) => {
      if (input.worksheetName === "Analysis-B" && failure !== "mapping") throw new Error(failure === "missing" ? "image missing" : "image content hash mismatch");
      return inspect(input);
    };
    const contexts = await buildSelectedWorksheetInterpretationContexts(snapshot(), reader, { isolateFailures: true });
    expect(contexts.map((entry) => entry.worksheetName)).toEqual(["Analysis-B", "Analysis-A"]);
    expect(contexts[0]).toMatchObject({ contractVersion: "f5-multimodal-request-failure-v4", worksheetName: "Analysis-B", activeFactorCount: 1,
      reasonCode: failure === "missing" ? "image_missing" : failure === "hash_mismatch" ? "image_hash_mismatch" : "factor_mapping_failed",
      evidence: { f2ContentHash: createHash("sha256").update("f2_report").digest("hex"), f4ContentHash: createHash("sha256").update("f4_calculation").digest("hex") },
    });
    expect(contexts[0]).not.toHaveProperty("image");
    expect(contexts[0]).not.toHaveProperty("factorRows");
    expect(contexts[1]).toMatchObject({ contractVersion: "f5-multimodal-request-v3", worksheetName: "Analysis-A" });
    await expect(assertCurrentWorksheetInterpretationRequest(snapshot(), contexts[1] as any, reader)).resolves.toBeUndefined();
  });

  it("preserves selected order and isolates each image with every authoritative F4 Factor", async () => {
    const requests = await buildSelectedWorksheetInterpretationContexts(snapshot(), artifacts());

    expect(requests.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-B", "Analysis-A"]);
    expect(requests[0]).toMatchObject({
      worksheetName: "Analysis-B",
      tableId: "table-b",
      image: { artifactPath: "images/analysis-b.png", contentHash: IMAGE_B_HASH, byteLength: IMAGE_B_BYTES.byteLength },
      factorRows: [{ worksheetName: "Analysis-B", tableId: "table-b", sourceRow: 21, factorOrdinal: { value: "C", rawText: " C ", sourceCell: "Analysis-B!Z21" }, factorName: "Factor B1" }],
    });
    expect(requests[1]).toMatchObject({
      worksheetName: "Analysis-A",
      tableId: "table-a",
      image: { artifactPath: "images/analysis-a.png", contentHash: IMAGE_A_HASH, byteLength: IMAGE_A_BYTES.byteLength },
      factorRows: [
        { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z11" }, factorName: "Factor A1" },
        { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 12, factorOrdinal: { value: "B", rawText: "B", sourceCell: "Analysis-A!Z12" }, factorName: "Factor A2" },
      ],
    });
    expect(requests[0]!.factorRows).toHaveLength(1);
    expect(requests[1]!.factorRows).toHaveLength(2);
  });

  it("reads exact bytes only for the matching live HostAction claim", async () => {
    const request = (await buildSelectedWorksheetInterpretationContexts(snapshot(), artifacts()))[0]!;
    const action = multimodalActionRecord(request);
    let reads = 0;
    const readImage = async () => {
      reads += 1;
      return { bytes: IMAGE_B_BYTES, mediaType: "image/png" as const };
    };

    await expect(readClaimedWorksheetImage(action, { sessionId: SESSION_ID, actionId: action.actionId, hostInstanceId: "host-1", leaseId: "lease-1", now: new Date("2026-09-07T00:05:00.000Z") }, readImage, async () => ({ record: action, now: new Date("2026-09-07T00:05:01.000Z") }))).resolves.toMatchObject({ mediaType: "image/png" });
    expect(reads).toBe(1);

    const malformedBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]);
    const malformedRequest = structuredClone(request);
    malformedRequest.image.contentHash = createHash("sha256").update(malformedBytes).digest("hex");
    malformedRequest.image.byteLength = malformedBytes.byteLength;
    malformedRequest.requestHash = createF5MultimodalRequestHash(malformedRequest);
    const malformedAction = multimodalActionRecord(malformedRequest);
    await expect(readClaimedWorksheetImage(malformedAction, { sessionId: SESSION_ID, actionId: malformedAction.actionId, hostInstanceId: "host-1", leaseId: "lease-1", now: new Date("2026-09-07T00:05:00.000Z") }, async () => ({ bytes: malformedBytes, mediaType: "image/png" }), async () => ({ record: malformedAction, now: new Date("2026-09-07T00:05:01.000Z") }))).rejects.toMatchObject({ code: "policy_denied" });

    await expect(readClaimedWorksheetImage({ ...action, status: "pending", claim: undefined }, { sessionId: SESSION_ID, actionId: action.actionId, hostInstanceId: "host-1", leaseId: "lease-1", now: new Date("2026-09-07T00:05:00.000Z") }, readImage, async () => ({ record: action, now: new Date("2026-09-07T00:05:01.000Z") }))).rejects.toMatchObject({ code: "policy_denied" });
    expect(reads).toBe(1);
  });

  it("rejects image bytes when the HostAction claim changes during the read", async () => {
    const request = (await buildSelectedWorksheetInterpretationContexts(snapshot(), artifacts()))[0]!;
    const action = multimodalActionRecord(request);

    await expect(readClaimedWorksheetImage(
      action,
      { sessionId: SESSION_ID, actionId: action.actionId, hostInstanceId: "host-1", leaseId: "lease-1", now: new Date("2026-09-07T00:05:00.000Z") },
      async () => ({ bytes: IMAGE_B_BYTES, mediaType: "image/png" }),
      async () => ({ record: { ...action, status: "completed" }, now: new Date("2026-09-07T00:05:01.000Z") }),
    )).rejects.toMatchObject({ code: "policy_denied" });
  });

  it("rejects a worksheet descriptor swapped to another selected worksheet", async () => {
    await expect(buildSelectedWorksheetInterpretationContexts(snapshot(), artifacts(({ f2 }) => {
      const row = f2.worksheets[1].rows[0];
      row.imageReference.relativePath = "images/analysis-a.png";
      row.imageReference.contentHash = IMAGE_A_HASH;
    }))).rejects.toThrow("image identity mismatch");
  });

  it("rejects one cross-worksheet image hidden among otherwise valid rows", async () => {
    await expect(buildSelectedWorksheetInterpretationContexts(snapshot(), artifacts(({ f2 }) => {
      f2.worksheets[0].rows[1].imageReference.worksheetName = "Analysis-B";
    }))).rejects.toMatchObject({ code: "evidence_mismatch" });
  });

  it("rejects an incomplete F4 authoritative Factor set", async () => {
    await expect(buildSelectedWorksheetInterpretationContexts(snapshot(), artifacts(({ f4 }) => {
      f4.calculations[0].factors.pop();
      f4.calculations[0].factorCount = 1;
    }))).rejects.toMatchObject({ code: "evidence_mismatch" });
  });

  it("rejects a legacy downstream selection without current governed F2 authority", async () => {
    const legacy = snapshot();
    legacy.downstreamScopeSelection = { workbookContentHash: WORKBOOK_HASH, selectedWorksheetNames: ["Analysis-B", "Analysis-A"], confirmed: true };

    await expect(buildSelectedWorksheetInterpretationContexts(legacy, artifacts())).rejects.toMatchObject({ code: "evidence_mismatch" });
  });

  it("rejects a request whose revision and hash are no longer current", async () => {
    const reader = artifacts();
    const candidate = structuredClone((await buildSelectedWorksheetInterpretationContexts(snapshot(), reader))[0]!);
    candidate.revision -= 1;

    await expect(assertCurrentWorksheetInterpretationRequest(snapshot(), candidate, reader)).rejects.toMatchObject({ code: "evidence_mismatch" });
  });
});

function multimodalActionRecord(request: Awaited<ReturnType<typeof buildSelectedWorksheetInterpretationContexts>>[number]): HostActionRecord {
  const actionId = `multimodal:${request.worksheetName}`;
  const hostRequest = { contractVersion: "f8-host-action-request-v1" as const, actionId, sessionId: SESSION_ID, expectedRevision: request.revision, expiresAt: "2026-09-07T00:15:00.000Z", kind: "vscode_worksheet_multimodal_request" as const, confirmationHash: request.requestHash, expectedTargetVersion: "vscode-worksheet-multimodal-v3" as const, request };
  return {
    actionId,
    sessionId: SESSION_ID,
    status: "claimed",
    request: hostRequest,
    claim: { contractVersion: "f8-host-action-claim-v1", actionId, hostInstanceId: "host-1", leaseId: "lease-1", leaseExpiresAt: "2026-09-07T00:10:00.000Z", request: hostRequest },
    result: undefined,
    expiresAt: hostRequest.expiresAt,
    leaseId: "lease-1",
    leaseExpiresAt: "2026-09-07T00:10:00.000Z",
    expectedRevision: request.revision,
    confirmationHash: request.requestHash,
    expectedTargetVersion: hostRequest.expectedTargetVersion,
    dispatchedAt: undefined,
  };
}

function snapshot(): F8SessionSnapshot {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: SESSION_ID,
    revision: 7,
    inputRevision: 3,
    state: "f5_running",
    activeAttempt: null,
    priorRunReferences: [],
    downstreamScopeSelection: { decision: "continue_ready", workbookContentHash: WORKBOOK_HASH, selectedWorksheetNames: ["Analysis-B", "Analysis-A"], confirmed: true, provenance: "user", inputRevision: 3, f2ReportArtifactId: "f2-current", f2ReportContentHash: createHash("sha256").update("f2_report").digest("hex"), findingDigest: "d".repeat(64) },
    artifactRefs: [
      { artifactId: "f2-current", kind: "f2_report", revision: 3, validated: true },
      { artifactId: "f4-current", kind: "f4_calculation", revision: 3, validated: true, reviewContextId: REVIEW_CONTEXT_ID },
    ],
  };
}

function artifacts(mutate?: (value: { f2: any; f4: any }) => void): WorksheetInterpretationArtifactReader {
  const f2 = f2Report();
  const f4 = f4Result();
  mutate?.({ f2, f4 });
  const entries: Record<string, { reference: SessionArtifactReference; json: unknown }> = {
    "f2-current": { reference: reference("f2-current", "f2_report"), json: f2 },
    "f4-current": { reference: reference("f4-current", "f4_calculation", true), json: f4 },
  };
  return {
    async readReference(artifactId) { return entries[artifactId]?.reference; },
    async readJson(artifactId) { return entries[artifactId]?.json; },
    async inspectWorksheetImage(input) {
      const expected = input.worksheetName === "Analysis-A"
        ? { artifactPath: "images/analysis-a.png", contentHash: IMAGE_A_HASH }
        : { artifactPath: "images/analysis-b.png", contentHash: IMAGE_B_HASH };
      if (input.artifactPath !== expected.artifactPath || input.expectedContentHash !== expected.contentHash) throw new Error("image identity mismatch");
      return { mediaType: "image/png", contentHash: expected.contentHash, byteLength: IMAGE_A_BYTES.byteLength, artifactPath: expected.artifactPath };
    },
  };
}

function reference(artifactId: string, kind: string, reviewed = false): SessionArtifactReference {
  return {
    artifactId,
    sessionId: SESSION_ID,
    inputRevision: 3,
    kind,
    relativePath: `managed/${artifactId}.json`,
    contentHash: createHash("sha256").update(kind).digest("hex"),
    ...(reviewed ? { metadata: { reviewContextId: REVIEW_CONTEXT_ID } } : {}),
  };
}

function f2Row(worksheetName: string, tableId: string, sourceRow: number, ordinal: string, imagePath: string, imageHash: string) {
  return {
    worksheetName,
    tableId,
    sourceRow,
    factorOrdinal: { value: ordinal, rawText: ordinal === "C" ? " C " : ordinal, sourceCell: `${worksheetName}!Z${sourceRow}` },
    actualFields: { factorName: `Factor ${worksheetName.at(-1)}${ordinal === "C" ? "1" : ordinal === "A" ? "1" : "2"}`, partName: `Part ${worksheetName.at(-1)}`, drawingNumber: `DWG-${worksheetName.at(-1)}`, dimCharacteristicId: String(sourceRow), partCategory: "CNC", nominalValue: sourceRow, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", mean: sourceRow, tolerance: 0.2, oneSigma: 0.025, percentContributionToSigma: 0.5, notes: null },
    sourceCells: { factorName: `${worksheetName}!A${sourceRow}`, nominalValue: `${worksheetName}!B${sourceRow}` },
    imageReference: { artifact: "f1", relativePath: imagePath, contentHash: imageHash, worksheetName },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "non_f0_process_category",
    adoReminderRequested: false,
  };
}

function f2Report() {
  const worksheetA = [f2Row("Analysis-A", "table-a", 11, "A", "images/analysis-a.png", IMAGE_A_HASH), f2Row("Analysis-A", "table-a", 12, "B", "images/analysis-a.png", IMAGE_A_HASH)];
  const worksheetB = [f2Row("Analysis-B", "table-b", 21, "C", "images/analysis-b.png", IMAGE_B_HASH)];
  const worksheet = (worksheetName: string, rows: unknown[]) => ({ worksheetName, toleranceLoopDescription: worksheetName, tolerancePathImageStatus: "available", systemSpecification: { status: "available", designNominal: available(`${worksheetName}!B1`, 0), lowerSpecLimit: available(`${worksheetName}!B2`, -1), upperSpecLimit: available(`${worksheetName}!B3`, 1), targetSigmaLevel: available(`${worksheetName}!B4`, 4), additionalMeanShift: available(`${worksheetName}!B5`, 0) }, systemSpecificationIssues: [], f4CalculabilityIssues: [], rows, missingFieldSummary: [], status: "ready" });
  const handoff = (worksheetName: string, tableId: string, rows: typeof worksheetA) => ({
    contractVersion: "v1", handoffVersion: "f4-handoff-v1", inputClassification: "confidential", status: "ready", workbookContentHash: WORKBOOK_HASH, worksheetName, toleranceLoopDescription: worksheetName,
    systemSpecification: { designNominal: 0, lowerSpecLimit: available(`${worksheetName}!B2`, -1), upperSpecLimit: available(`${worksheetName}!B3`, 1), targetSigmaLevel: available(`${worksheetName}!B4`, 4), targetCpk: 4 / 3, additionalMeanShift: available(`${worksheetName}!B5`, 0) },
    factors: rows.map((row) => ({ tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, unit: "mm", actualFields: row.actualFields, sourceCells: row.sourceCells })),
  });
  return {
    contractVersion: "v1", inputClassification: "confidential", status: "completed", workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH, f1GeneratedAt: "2026-09-07T00:00:00.000Z" }, knowledgeBaseVersions: ["v1", "internal-v1"], mappingRuleVersion: "v1", artifactRoot: "managed/f2", worksheets: [worksheet("Analysis-A", worksheetA), worksheet("Analysis-B", worksheetB)], f4Handoffs: [handoff("Analysis-A", "table-a", worksheetA), handoff("Analysis-B", "table-b", worksheetB)], adoEvents: [],
    summary: { worksheetsChecked: 2, blockedWorksheetCount: 0, readyWorksheetCount: 2, factorRowCount: 3, rowsWithRequiredMissing: 0, requiredMissingFieldCount: 0, missingImageWorksheetCount: 0, internalWithinGuidanceCount: 0, internalGuidanceExceededCount: 0, f0InformationInsufficientCount: 0, publicLibraryMatchCount: 0, nonF0ProcessCategoryCount: 3, unableToCheckCount: 0, publicToleranceDifferenceCount: 0, publicDistributionDifferenceCount: 0, missingDimIdCount: 0, missingPartNumberCount: 0 },
  };
}

function available(sourceCell: string, actualValue: number) {
  return { status: "available", sourceLabel: "label", sourceCell, displayValue: String(actualValue), actualValue, valueOrigin: "numeric_literal" };
}

function f4Result() {
  const factor = (worksheetName: string, tableId: string, sourceRow: number, factorName: string) => ({ factorName, unit: "mm", source: { worksheetName, tableId, sourceRow }, input: { nominalValue: sourceRow, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal" }, mean: sourceRow, halfTolerance: 0.1, sigma: 0.025, contribution: 0.5, trace: { formulaIds: ["factor-mean-v1"], sourceCells: [`${worksheetName}!B${sourceRow}`] } });
  const calculation = (worksheetName: string, tableId: string, factors: unknown[]) => ({ contractVersion: "v1", outputClassification: "confidential", featureId: "F4", status: "completed", calculationVersion: "excel-ta-v1", projectReference: "project", runReference: `run-${worksheetName}`, workbookContentHash: WORKBOOK_HASH, worksheetSelection: { worksheetName, tableId }, factorCount: factors.length, recommendation: { method: "worst_case", reason: "factor_count_1_to_3", refer3d: false, criticality: "none", criticalityRisk: false }, factors, system: { designNominal: 0, mean: 0, additionalMeanShift: 0, worstCaseUpper: 1, worstCaseLower: -1, rssSigma: 0.1 }, capability: { lowerSpecLimit: -1, upperSpecLimit: 1, targetSigmaLevel: 4, targetCpk: 1.33, cp: 2, lowerCpk: 2, upperCpk: 2, cpk: 2, lowerZ: 6, upperZ: 6, lowerDpm: 0, upperDpm: 0, totalDpm: 0, outOfSpecRatio: 0, yield: 1, status: "PASS" }, traceRecords: [{ outputField: "capability.cpk", formulaVersion: "excel-ta-v1", formulaId: "cpk-v1", sourceCells: ["capability.lowerCpk", "capability.upperCpk"] }], scenarios: [] });
  return { contractVersion: "v1", workflowVersion: "f4-f2-v1", outputClassification: "confidential", featureId: "F4", status: "completed", runId: "f4-run", generatedAt: "2026-09-07T00:00:00.000Z", source: { artifactReference: "Feature2-Report.json", workbookFileName: "anonymous.xlsx", workbookContentHash: WORKBOOK_HASH }, calculations: [calculation("Analysis-A", "table-a", [factor("Analysis-A", "table-a", 11, "Factor A1"), factor("Analysis-A", "table-a", 12, "Factor A2")]), calculation("Analysis-B", "table-b", [factor("Analysis-B", "table-b", 21, "Factor B1")])], summary: { selectedWorksheetCount: 2, completedWorksheetCount: 2 } };
}
