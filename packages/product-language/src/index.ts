export {
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
export type { TaProductCapabilityId, TaWorkbookStage, UserLanguage } from "./ta-workbook-language.js";
export { assertNoProhibitedProductIdentifiers, createProductRunReference, productSafeNameV1 } from "./product-identifiers.js";
