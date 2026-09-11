# F7 Variation Suggestion Merge Design

## Goal

Present total-variation reduction and dominant-contributor reduction as one suggestion when both controlled options match, because contributor reduction is the recommended method for reducing total variation.

## Design

- Merge the options in the product-language narrative layer so Web, API, and report consumers receive the same result.
- Keep `improvement-reduce-variation` as the displayed option identity and reading-order position.
- Use the title `Reduce total variation` and explain that representative evidence must first confirm the modeled shortfall, then the dominant contributor should be investigated before tolerance or process-control changes.
- Combine and de-duplicate validation steps from both controlled options.
- Preserve existing behavior when only one of the two options matches.
- Do not remove or merge the underlying knowledge-base rules; they remain independently traceable inputs.

## Verification

- A narrative containing both options emits one merged suggestion.
- The merged suggestion contains validation steps from both source options without duplicates.
- Either option by itself still emits its existing standalone suggestion.
- F7 Web, local API, and product-language tests continue to pass.