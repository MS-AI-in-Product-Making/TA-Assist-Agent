import { createTypedError, f8SessionCommandSchema, f8SessionSnapshotSchema, } from "@ai-assist/contracts";
import { changeInteractionLanguage } from "@ai-assist/product-language";
import { annotateSnapshot, attemptMatchesActiveAttempt, createRunningAttempt, deriveRetryable, resolveRetryStage, terminalAttempt, } from "./attempts.js";
import { assertCommandAllowed, isRunningState, } from "./commands.js";
export { canRetryAttempt } from "./attempts.js";
const F6_ANALYSIS_CONTEXT_REFERENCE_PREFIX = "f6-analysis-context:";
const F6_OPTIMIZATION_TARGETS_REFERENCE_PREFIX = "f6-optimization-targets:";
const F6_INPUT_DECISION_CONTRACT_VERSION = "f6-input-decision-v1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export function reduceSessionCommand(snapshotInput, commandInput) {
    const snapshot = f8SessionSnapshotSchema.parse(snapshotInput);
    const command = f8SessionCommandSchema.parse(commandInput);
    if (command.command !== "set_interaction_language") {
        assertCommandAllowed(snapshot, command);
    }
    if (command.sessionId !== snapshot.sessionId) {
        throw createTypedError({
            code: "validation_error",
            summary: `Command ${command.commandId} targets session ${command.sessionId}, expected ${snapshot.sessionId}.`,
            suggestedAction: "Re-run the command against the active session.",
            affectedInputReferences: [command.commandId, command.sessionId],
        });
    }
    if (command.expectedRevision !== snapshot.revision) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: `Expected revision ${command.expectedRevision}, found ${snapshot.revision}.`,
            suggestedAction: "Refresh the session snapshot before sending another command.",
            affectedInputReferences: [command.commandId, snapshot.sessionId],
        });
    }
    if (command.command === "set_interaction_language") {
        return reduceSetInteractionLanguage(snapshot, command);
    }
    switch (command.command) {
        case "upload_workbook":
            return startWorkbookValidation(snapshot, command, false);
        case "replace_workbook":
            return startWorkbookValidation(snapshot, command, true);
        case "confirm_initial_scope":
        case "auto_confirm_initial_scope":
            return reduceConfirmInitialScope(snapshot, command);
        case "confirm_downstream_scope":
            return reduceConfirmDownstreamScope(snapshot, command);
        case "confirm_ado_decision":
            return reduceConfirmAdoDecision(snapshot, command);
        case "reset_ado_decision":
            return nextSnapshot(snapshot, { state: "ado_decision_required", activeAttempt: null });
        case "accept_surface_write":
            return transitionWithAttempt(snapshot, command, "f6_running", {
                priorRunReferences: [
                    ...snapshot.priorRunReferences,
                    {
                        featureId: "F3",
                        referenceId: "ado-updated",
                        contractVersion: "drawing-governance-v3",
                        runReference: `f3-ado:updated:${snapshot.sessionId}:${snapshot.inputRevision}`,
                    },
                ],
            });
        case "confirm_image_decision":
            return transitionWithAttempt(snapshot, command, "f5_running");
        case "confirm_analysis_context":
            return nextSnapshot(snapshot, {
                state: "optimization_targets_decision_required",
                activeAttempt: null,
                pendingAnalysisContextDraft: undefined,
                priorRunReferences: appendF6InputDecisionReference(snapshot, command, F6_ANALYSIS_CONTEXT_REFERENCE_PREFIX),
            });
        case "confirm_optimization_targets":
            return transitionWithAttempt(snapshot, command, "f6_running", {
                pendingOptimizationTargetsDraft: undefined,
                priorRunReferences: appendF6InputDecisionReference(snapshot, command, F6_OPTIMIZATION_TARGETS_REFERENCE_PREFIX),
            });
        case "retry": {
            const retryStage = resolveRetryStage(snapshot, command.payload.stage);
            return transitionWithAttempt(snapshot, command, retryStage);
        }
        case "cancel":
            return nextSnapshot(snapshot, {
                state: "cancelled",
                activeAttempt: terminalAttempt(snapshot, "cancelled", undefined),
            });
        case "complete_review":
            return nextSnapshot(snapshot, {
                state: "completed",
                activeAttempt: null,
                priorRunReferences: withF7PlaceholderOutcome(snapshot),
            });
        case "save_what_if_draft":
            return reduceSaveWhatIfDraft(snapshot, command);
        case "confirm_what_if_tolerance_promotion":
            return reduceConfirmWhatIfPromotion(snapshot, command);
        default:
            throw new Error(`Unhandled command: ${command.command}`);
    }
}
function reduceConfirmInitialScope(snapshot, command) {
    const payload = command.payload;
    const provenance = command.command === "auto_confirm_initial_scope"
        ? "internal_fixture"
        : payload.provenance ?? "user";
    return transitionWithAttempt(snapshot, command, "f1_f2_running", {
        initialScopeSelection: {
            workbookContentHash: payload.workbookHash,
            selectedWorksheetNames: payload.worksheetNames,
            confirmed: true,
            provenance,
        },
    });
}
function reduceConfirmDownstreamScope(snapshot, command) {
    const payload = command.payload;
    const initial = snapshot.initialScopeSelection;
    if (initial === undefined || initial.confirmed !== true) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: "The initial worksheet confirmation is unavailable.",
            suggestedAction: "Confirm the initial worksheet scope before downstream confirmation.",
            affectedInputReferences: [command.commandId, snapshot.sessionId],
        });
    }
    if (payload.workbookHash !== initial.workbookContentHash) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: "Downstream worksheet confirmation does not match the initial workbook hash.",
            suggestedAction: "Refresh the session and confirm downstream worksheets for the current workbook.",
            affectedInputReferences: [command.commandId, snapshot.sessionId],
        });
    }
    if (payload.inputRevision !== snapshot.inputRevision) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: "Downstream worksheet confirmation does not match the current input revision.",
            suggestedAction: "Refresh the session and confirm the findings for the current workbook revision.",
            affectedInputReferences: [command.commandId, snapshot.sessionId],
        });
    }
    const initialWorksheetSet = new Set(initial.selectedWorksheetNames);
    const outOfScope = payload.worksheetNames.filter((worksheetName) => !initialWorksheetSet.has(worksheetName));
    if (outOfScope.length > 0) {
        throw createTypedError({
            code: "validation_error",
            summary: "Downstream worksheet confirmation contains worksheets outside the confirmed initial scope.",
            suggestedAction: "Select only worksheets that were included in the initial worksheet confirmation.",
            affectedInputReferences: [command.commandId, ...outOfScope],
        });
    }
    if (payload.worksheetNames.length !== payload.downstreamReadyWorksheetNames.length
        || payload.worksheetNames.some((worksheetName, index) => worksheetName !== payload.downstreamReadyWorksheetNames[index])) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: "Downstream confirmation must match the exact downstream-ready set.",
            suggestedAction: "Refresh the current findings and continue with every downstream-ready worksheet in report order.",
            affectedInputReferences: [command.commandId, payload.f2ReportArtifactId],
        });
    }
    const currentF2References = (snapshot.artifactRefs ?? []).filter((reference) => reference.kind === "f2_report" && reference.validated && reference.revision === snapshot.inputRevision);
    if (currentF2References.length !== 1 || currentF2References[0].artifactId !== payload.f2ReportArtifactId) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: "Downstream worksheet confirmation does not match the current Data Cleaning report identity.",
            suggestedAction: "Refresh the current Data Cleaning findings and confirm again.",
            affectedInputReferences: [command.commandId, payload.f2ReportArtifactId],
        });
    }
    return transitionWithAttempt(snapshot, command, "f3_running", {
        downstreamScopeSelection: {
            workbookContentHash: payload.workbookHash,
            selectedWorksheetNames: payload.worksheetNames,
            confirmed: true,
            provenance: payload.provenance ?? "user",
            decision: payload.decision,
            inputRevision: payload.inputRevision,
            f2ReportArtifactId: payload.f2ReportArtifactId,
            f2ReportContentHash: payload.f2ReportContentHash,
            findingDigest: payload.findingDigest,
        },
    });
}
export function acceptAttemptResult(snapshotInput, result) {
    const snapshot = f8SessionSnapshotSchema.parse(snapshotInput);
    if (!attemptMatchesActiveAttempt(snapshot, result.attemptId)) {
        return snapshot;
    }
    const activeAttempt = snapshot.activeAttempt;
    if (activeAttempt === null) {
        return snapshot;
    }
    const terminalStatus = result.status ?? "completed";
    switch (terminalStatus) {
        case "completed": {
            if (activeAttempt.stage === "f5_running")
                assertCompletedF5MultimodalReference(snapshot, result.result);
            const nextState = activeAttempt.stage === "f6_running" && hasTerminalAdoReference(snapshot)
                ? "review_required"
                : resolveCompletionState(activeAttempt.stage);
            const transitioned = transitionAfterCompletion(snapshot, activeAttempt.stage, nextState, activeAttempt.commandId ?? result.attemptId);
            return annotateSnapshot(transitioned, undefined);
        }
        case "failed": {
            const failedSnapshot = nextSnapshot(snapshot, {
                state: "failed",
                activeAttempt: terminalAttempt(snapshot, "failed", result.endedAt),
            });
            return annotateSnapshot(failedSnapshot, { retryable: deriveRetryable(result.result) });
        }
        case "cancelled":
            return nextSnapshot(snapshot, {
                state: "cancelled",
                activeAttempt: terminalAttempt(snapshot, "cancelled", result.endedAt),
            });
        default:
            throw new Error(`Unhandled terminal status: ${terminalStatus}`);
    }
}
function startWorkbookValidation(snapshot, command, replacingWorkbook) {
    const nextInputRevision = snapshot.inputRevision + 1;
    const preservedDrafts = snapshot.scenarioDrafts?.filter((draft) => draft.inputRevision !== snapshot.inputRevision);
    return transitionWithAttempt(snapshot, command, "f0_validating", {
        inputRevision: nextInputRevision,
        initialScopeSelection: undefined,
        downstreamScopeSelection: undefined,
        pendingAnalysisContextDraft: undefined,
        pendingOptimizationTargetsDraft: undefined,
        priorRunReferences: snapshot.priorRunReferences,
        scenarioDrafts: preservedDrafts?.length ? preservedDrafts : undefined,
        ...(replacingWorkbook ? {} : {}),
    });
}
function reduceSetInteractionLanguage(snapshot, command) {
    if (isRunningState(snapshot.state) || snapshot.activeAttempt !== null) {
        throw createTypedError({
            code: "validation_error",
            summary: "Interaction language can change only while the session is waiting for user input.",
            suggestedAction: "Wait for the active run to finish before changing the interaction language.",
            affectedInputReferences: [command.commandId, snapshot.sessionId],
        });
    }
    const payload = command.payload;
    return nextSnapshot(snapshot, {
        interactionLanguage: changeInteractionLanguage(snapshot.interactionLanguage, {
            text: "",
            turnId: payload.turnId,
            explicitLanguageTag: payload.explicitLanguageTag,
        }),
    });
}
function transitionAfterCompletion(snapshot, completedStage, nextState, transitionKey) {
    const standardF6InputReferences = completedStage === "f5_running"
        ? appendF6InputDecisionReference({
            ...snapshot,
            priorRunReferences: appendF6InputDecisionReference(snapshot, {
                ...f8SessionCommandSchema.parse({
                    contractVersion: "f8-session-command-v1",
                    sessionId: snapshot.sessionId,
                    commandId: `${transitionKey}:analysis-context-default`,
                    expectedRevision: snapshot.revision,
                    command: "confirm_analysis_context",
                    payload: { decision: "not_provided" },
                }),
            }, F6_ANALYSIS_CONTEXT_REFERENCE_PREFIX),
        }, f8SessionCommandSchema.parse({
            contractVersion: "f8-session-command-v1",
            sessionId: snapshot.sessionId,
            commandId: `${transitionKey}:optimization-targets-default`,
            expectedRevision: snapshot.revision,
            command: "confirm_optimization_targets",
            payload: { decision: "not_provided" },
        }), F6_OPTIMIZATION_TARGETS_REFERENCE_PREFIX)
        : snapshot.priorRunReferences;
    if (isRunningState(nextState)) {
        return nextSnapshot(snapshot, {
            priorRunReferences: standardF6InputReferences,
            state: nextState,
            activeAttempt: createRunningAttempt(nextState, `${transitionKey}:next`),
        });
    }
    return nextSnapshot(snapshot, {
        priorRunReferences: standardF6InputReferences,
        state: nextState,
        activeAttempt: null,
    });
}
function resolveCompletionState(stage) {
    switch (stage) {
        case "workbook_validating":
            return "f0_validating";
        case "f0_validating":
            return "initial_scope_required";
        case "f1_f2_running":
            return "downstream_scope_required";
        case "f3_running":
            return "f4_running";
        case "ado_action_pending":
            return "ado_action_pending";
        case "f4_running":
            return "f5_running";
        case "f5_running":
            return "f6_running";
        case "f6_running":
            return "ado_decision_required";
        case "f7_running":
            return "feedback_review_required";
        case "created":
        case "workbook_required":
        case "f0_validated":
        case "initial_scope_required":
        case "downstream_scope_required":
        case "ado_decision_required":
        case "image_decision_required":
        case "analysis_context_decision_required":
        case "optimization_targets_decision_required":
        case "review_required":
        case "f7_import_required":
        case "f7_preview_required":
        case "feedback_review_required":
        case "completed":
        case "failed":
        case "cancelled":
            throw createTypedError({
                code: "validation_error",
                summary: `Stage ${stage} does not accept worker completion results.`,
                suggestedAction: "Submit completion results only for actively running states.",
                affectedInputReferences: [stage],
            });
        default:
            throw new Error(`Unhandled stage: ${stage}`);
    }
}
function nextSnapshot(snapshot, updates) {
    return f8SessionSnapshotSchema.parse({
        ...snapshot,
        ...updates,
        revision: snapshot.revision + 1,
    });
}
function transitionWithAttempt(snapshot, command, state, updates = {}) {
    if (!isRunningState(state)) {
        throw createTypedError({
            code: "validation_error",
            summary: `State ${state} cannot be entered with an automatic attempt.`,
            suggestedAction: "Use a decision-state transition instead of starting an attempt.",
            affectedInputReferences: [state, command.commandId],
        });
    }
    return annotateSnapshot(nextSnapshot(snapshot, {
        ...updates,
        state,
        activeAttempt: createRunningAttempt(state, command.commandId),
    }), undefined);
}
function withF7PlaceholderOutcome(snapshot) {
    const placeholderReferenceId = `f7-placeholder-input-${snapshot.inputRevision}`;
    const placeholderRunReference = `f7-placeholder:${snapshot.sessionId}:${snapshot.inputRevision}`;
    if (snapshot.priorRunReferences.some((reference) => reference.featureId === "F7" && reference.referenceId === placeholderReferenceId)) {
        return snapshot.priorRunReferences;
    }
    return [
        ...snapshot.priorRunReferences,
        {
            featureId: "F7",
            referenceId: placeholderReferenceId,
            contractVersion: "f7-workbench-placeholder-v1",
            runReference: placeholderRunReference,
        },
    ];
}
function reduceConfirmAdoDecision(snapshot, command) {
    const payload = command.payload;
    if (payload.decision !== "local_only") {
        return nextSnapshot(snapshot, {
            state: "ado_action_pending",
            activeAttempt: null,
        });
    }
    return transitionWithAttempt(snapshot, command, "f6_running", {
        priorRunReferences: [
            ...snapshot.priorRunReferences,
            {
                featureId: "F3",
                referenceId: "ado-not-requested",
                contractVersion: "f3-ado-reminder-v1",
                runReference: `f3-ado:not-requested:${snapshot.sessionId}:${snapshot.inputRevision}`,
            },
        ],
    });
}
function hasTerminalAdoReference(snapshot) {
    const expectedSuffix = `:${snapshot.inputRevision}`;
    return snapshot.priorRunReferences.some((reference) => (reference.featureId === "F3"
        && (reference.referenceId === "ado-not-requested" || reference.referenceId === "ado-updated")
        && (reference.runReference ?? "").endsWith(expectedSuffix)));
}
function reduceSaveWhatIfDraft(snapshot, command) {
    const draft = command.payload.draft;
    if (draft.sessionId !== snapshot.sessionId || draft.inputRevision !== snapshot.inputRevision) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: "What-if draft does not match the current session input revision.",
            suggestedAction: "Refresh the review and recalculate the draft.",
            affectedInputReferences: [command.commandId, draft.draftId],
        });
    }
    const historical = (snapshot.scenarioDrafts ?? []).filter((existing) => existing.draftId !== draft.draftId).map((existing) => ["promoted_to_f6_targets", "superseded", "deleted"].includes(existing.status)
        ? existing
        : { ...existing, status: "superseded" });
    return nextSnapshot(snapshot, { state: "review_required", activeAttempt: null, scenarioDrafts: [...historical, draft] });
}
function reduceConfirmWhatIfPromotion(snapshot, command) {
    const payload = command.payload;
    const draft = snapshot.scenarioDrafts?.findLast((candidate) => candidate.draftId === payload.draftId && candidate.status === "saved");
    const worksheet = payload.promotionPreview.worksheets[0];
    if (draft?.status !== "saved" || worksheet === undefined
        || payload.promotionPreview.workbookContentHash !== draft.baselineWorkbookHash
        || worksheet.worksheetName !== draft.worksheetName
        || worksheet.baselineIdentity.runReference !== draft.baselineRunReference) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: "Optimization targets preview does not match the saved What-if draft lineage.",
            suggestedAction: "Refresh the review and create a new promotion preview.",
            affectedInputReferences: [command.commandId, payload.draftId],
        });
    }
    return nextSnapshot(snapshot, {
        state: "review_required",
        activeAttempt: null,
        scenarioDrafts: snapshot.scenarioDrafts?.map((candidate) => candidate.draftId === payload.draftId
            ? { ...candidate, status: "promoted_to_f6_targets", promotionPreview: payload.promotionPreview }
            : candidate),
    });
}
function appendF6InputDecisionReference(snapshot, command, referencePrefix) {
    const payload = command.payload;
    const decision = payload.decision;
    let decisionReference;
    if (payload.decision === "confirm") {
        if (payload.draftId.trim().length === 0 || !SHA256_PATTERN.test(payload.draftHash)) {
            throw createTypedError({
                code: "validation_error",
                summary: "F6 confirm decision must include a valid draftId and draftHash.",
                suggestedAction: "Use the current pending server-owned draft identity and retry confirmation.",
                affectedInputReferences: [command.commandId],
            });
        }
        decisionReference = `draft:${payload.draftId}#sha256:${payload.draftHash}`;
    }
    else {
        // not_provided and decline must not carry a decision reference.
    }
    const workbookHash = snapshot.downstreamScopeSelection?.workbookContentHash ?? snapshot.initialScopeSelection?.workbookContentHash;
    const currentReferenceId = `${referencePrefix}${decision}`;
    const retained = snapshot.priorRunReferences.filter((reference) => !(reference.featureId === "F6"
        && reference.contractVersion === F6_INPUT_DECISION_CONTRACT_VERSION
        && reference.referenceId.startsWith(referencePrefix)));
    return [
        ...retained,
        {
            featureId: "F6",
            referenceId: currentReferenceId,
            contractVersion: F6_INPUT_DECISION_CONTRACT_VERSION,
            ...(workbookHash === undefined ? {} : { workbookHash }),
            ...(decisionReference === undefined ? {} : { runReference: decisionReference }),
        },
    ];
}
function assertCompletedF5MultimodalReference(snapshot, result) {
    const expectedArtifactId = `f5-multimodal:${snapshot.inputRevision}`;
    const authorized = snapshot.artifactRefs?.filter((reference) => reference.kind === "f5_multimodal"
        && reference.artifactId === expectedArtifactId
        && reference.revision === snapshot.inputRevision
        && reference.validated) ?? [];
    const authorizedReference = authorized[0];
    const references = result?.artifactReferences ?? [];
    const matches = references.filter((reference) => reference.kind === "f5_multimodal" && reference.artifactId === expectedArtifactId);
    if (authorized.length !== 1
        || authorizedReference?.kind !== "f5_multimodal"
        || matches.length !== 1
        || matches[0].relativePath !== authorizedReference.relativePath
        || matches[0].contentHash !== authorizedReference.contentHash) {
        throw createTypedError({
            code: "evidence_mismatch",
            summary: "Result Interpretation cannot complete without the current governed multimodal artifact.",
            suggestedAction: "Complete image and Factor-table interpretation for every selected worksheet.",
            affectedInputReferences: [snapshot.sessionId, String(snapshot.inputRevision), `revision:${snapshot.revision}`, `artifacts:${(snapshot.artifactRefs ?? []).map(({ artifactId }) => artifactId).join(",") || "none"}`],
        });
    }
}
//# sourceMappingURL=state-machine.js.map