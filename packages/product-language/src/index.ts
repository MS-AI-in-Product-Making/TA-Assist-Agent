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
	resolveInteractionLanguage,
} from "./interaction-language.js";
export {
	inputMetadata,
} from "./input-metadata.js";
export { assertNoProhibitedProductIdentifiers, createProductRunReference, productSafeNameV1 } from "./product-identifiers.js";
