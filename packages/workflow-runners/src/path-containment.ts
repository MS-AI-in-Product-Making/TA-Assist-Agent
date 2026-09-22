import path from "node:path";

export function isWithinOrEqual(parentPath: string, childPath: string): boolean {
	const relativePath = path.relative(parentPath, childPath);
	return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
