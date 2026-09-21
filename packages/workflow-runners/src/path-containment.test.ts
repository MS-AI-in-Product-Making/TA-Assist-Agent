import { describe, expect, it } from "vitest";

import { isWithinOrEqual } from "./path-containment.js";

describe("isWithinOrEqual", () => {
	it("accepts identical paths", () => {
		expect(isWithinOrEqual("C:\\repo\\test", "C:\\repo\\test")).toBe(true);
	});

	it("accepts Windows descendant paths", () => {
		expect(isWithinOrEqual("C:\\repo\\test", "C:\\repo\\test\\child\\file.json")).toBe(true);
	});

	it("rejects Windows sibling paths", () => {
		expect(isWithinOrEqual("C:\\repo\\test", "C:\\repo\\other\\file.json")).toBe(false);
	});

	it("rejects Windows escaped mixed-separator paths", () => {
		expect(isWithinOrEqual("C:\\repo\\test", "C:\\repo\\test/..\\outside\\file.json")).toBe(false);
	});
});
