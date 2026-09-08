export {
	TA_PRODUCT_CAPABILITY_CATALOG,
	TA_PRODUCT_CAPABILITIES,
	TA_WORKBOOK_WORKFLOW,
	TA_WORKBOOK_STAGES,
	TA_WORKBOOK_STAGE_LABELS,
	detectUserLanguage,
	productCapabilityLabel,
	projectProductCapabilityReferences,
	projectTaWorkbookStage,
	resolveProductCapabilityReference,
} from "./ta-workbook-language.js";
export type { InteractionLanguage, LanguageLockSource, ResolveInteractionLanguageInput, UiCatalogLanguage } from "./interaction-language.js";
export type { LocalizedInputMetadata, UserInputId, UserInputKind } from "./input-metadata.js";
export type { TaProductCapabilityId, TaProductCapabilityLookupId, TaProductCapabilityName, TaWorkbookStage, UserLanguage } from "./ta-workbook-language.js";
export {
	changeInteractionLanguage,
	detectExplicitLanguageTag,
	resolveInteractionLanguage,
} from "./interaction-language.js";
export {
	inputMetadata,
} from "./input-metadata.js";
export {
	buildF7EngineeringNarrative,
} from "./f7-engineering-narrative.js";
export { assertNoProhibitedProductIdentifiers, createProductRunReference, productSafeNameV1 } from "./product-identifiers.js";
export type {
	BuildF7EngineeringNarrativeInput,
	F7EngineeringNarrative,
	F7NarrativeActionItem,
	F7NarrativeContributor,
	F7NarrativeEvidenceBasis,
	F7NarrativeJudgmentStatus,
	F7NarrativeKnowledgeBaseVersion,
	F7NarrativeMethod,
	F7NarrativeOption,
	F7NarrativeResultJudgment,
	F7NarrativeRootCauseItem,
	F7NarrativeRule,
	F7NarrativeSpecificationSide,
} from "./f7-engineering-narrative.js";
export { classifyTopLevelWorkflowIntent, PRODUCT_WORKFLOWS, productWorkflowLabel } from "./workflow-intent.js";
export type { ProductWorkflowId, TopLevelWorkflowIntent } from "./workflow-intent.js";
