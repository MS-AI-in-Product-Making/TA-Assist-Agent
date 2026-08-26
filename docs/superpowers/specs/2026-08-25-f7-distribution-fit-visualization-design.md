# F7 Distribution Fit Visualization Design

## Goal

Add an expandable histogram and fitted probability-density curve for every successful distribution candidate, followed by a governed plain-language conclusion for the recommended model.

## Interaction And Layout

- Add a `Plot` disclosure in each distribution row beside the existing Q-Q evidence.
- Keep plots collapsed by default so the engineering comparison table remains scannable.
- Expand a full-width row immediately below the selected candidate.
- Show observed-density bars, a fitted-density line, axis ticks, sample size, and a legend.
- Preserve horizontal table scrolling and make each plot responsive down to mobile widths.

## Statistical Rendering

- Recover the observed sample from the candidate Q-Q points.
- Use a shared observed-value domain for all candidates so visual comparisons are fair.
- Build density-normalized histogram bins using Freedman-Diaconis, with Sturges as a fallback for zero or invalid IQR.
- Evaluate the model PDF from the governed parameters for Normal, Lognormal, Weibull, Gamma, and Uniform candidates.
- Treat non-finite PDF values as zero and clamp the SVG scale to finite histogram and curve values.

## Recommendation Conclusion

- Use `recommendedFamily` from the API as the sole recommendation source.
- State that the recommended model is acceptable and has the lowest AICc among acceptable candidates.
- Display its fitted parameters, AICc, BIC, KS, AD, and bootstrap p-value.
- Explain that lower AICc/BIC and smaller KS/AD are favorable while the bootstrap status governs acceptability.
- Preserve the existing withheld/no-recommendation states when fitting is incomplete or no candidate is acceptable.

## Testing

- Unit-test histogram density and each family PDF for finite, nonnegative output.
- Component-test plot disclosure content and recommendation conclusion.
- Run focused F7 Web tests, production typecheck/build, and browser checks at desktop and mobile widths.
