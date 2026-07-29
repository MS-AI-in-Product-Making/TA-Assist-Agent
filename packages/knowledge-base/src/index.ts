export {
	canonicalJson,
	contentHash,
	createKnowledgeSnapshot,
	createSeedPackage,
	type KnowledgeBaseSeedPackage,
} from "./validation.js";
export {
	createInternalKnowledgeSnapshot,
} from "./internal/validation.js";
export {
	loadInternalToleranceGuidance,
	type InternalToleranceGuidance,
} from "./internal/query.js";
export {
	importCapabilityMatrix,
	type CapabilityMatrixImportResult,
	type ImportCapabilityMatrixRequest,
} from "./internal/import-capability-matrices.js";
export { createReviewedInternalV1SeedPackage } from "./internal/data/internal-v1.js";
export type {
	InternalKnowledgeSeedPackage,
	InternalKnowledgeSnapshot,
} from "./internal/types.js";
export {
	loadKnowledgeBase,
	type CapabilityMatch,
	type CapabilityUnknown,
	type KnowledgeBase,
	type RuleMatch,
	type RuleUnknown,
	type TerminologyMatch,
	type TerminologyUnknown,
} from "./knowledge-base.js";