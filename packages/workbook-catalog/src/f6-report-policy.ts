export const F6_DISPOSITION_RANK = Object.freeze({
	PASS: 0,
	CONDITIONAL_PASS: 1,
	INCOMPLETE: 2,
	FAIL: 3,
});

function rankDisposition(disposition: string): number {
	return F6_DISPOSITION_RANK[disposition as keyof typeof F6_DISPOSITION_RANK] ?? F6_DISPOSITION_RANK.FAIL;
}

export function worstDisposition(dispositions: readonly string[]): string {
	if (!Array.isArray(dispositions) || dispositions.length === 0) return "PASS";
	return dispositions.reduce<string>((worst, value) => (
		rankDisposition(value) > rankDisposition(worst) ? value : worst
	), "PASS");
}