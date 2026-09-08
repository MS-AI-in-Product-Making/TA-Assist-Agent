import { createInterpretationRulesFromValidatedEntries, type InterpretationRules } from "./query.js";
import { createInterpretationKnowledgeSnapshot } from "./validation.js";

export function createInterpretationRules(snapshot: unknown): InterpretationRules {
  return createInterpretationRulesFromValidatedEntries(
    createInterpretationKnowledgeSnapshot(snapshot).entries,
  );
}