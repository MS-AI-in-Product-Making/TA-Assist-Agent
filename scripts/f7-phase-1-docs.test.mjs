import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf-8");
}

function extractRouteEvidence(serverSource) {
  const literalRoutes = [...serverSource.matchAll(/pathname\s*===\s*"([^"]+)"/g)].map((match) => match[1]);
  const regexRoutes = [...serverSource.matchAll(/const\s+\w+_PATH\s*=\s*\/\^(.+?)\$\//g)].map((match) => match[1]);
  return {
    literalRoutes,
    regexRoutes,
    all: [...literalRoutes, ...regexRoutes],
  };
}

describe("F7 phase 1 docs and local-only boundary", () => {
  it("documents local Phase 1 constraints and required commands in README", () => {
    const readme = read("README.md");

    expect(readme).toContain("npm run build -- --force");
    expect(readme).toContain("npm run dev:f7");
    expect(readme).toContain("127.0.0.1:4317");
    expect(readme).toContain("127.0.0.1:5177");

    expect(readme).toMatch(/experimental/i);
    expect(readme).toMatch(/local-only|single-user local/i);
    expect(readme).toMatch(/ephemeral/i);
    expect(readme).toMatch(/max\s*8\s*sessions/i);
    expect(readme).toMatch(/restart\s+to\s+clear/i);
    expect(readme).toMatch(/data\s+not\s+uploaded/i);
    expect(readme).toMatch(/direct\s+Excel\s+interim\s+adapter/i);
    expect(readme).toMatch(/Normal\s+baseline\s+supported/i);
    expect(readme).toMatch(/explicit\s+worksheet\s*\/\s*coefficient\s*\/\s*unit/i);
    expect(readme).toMatch(/measured\s*\/\s*baseline\s+mix/i);
    expect(readme).toMatch(/F7\s+governance\s+remains\s+unavailable/i);
    expect(readme).toMatch(/cpk\s+placeholder\s+unchanged/i);
    expect(readme).toMatch(/Phase\s*1\s+ready\s+means\s+input\s+evidence\s+ready\s+only/i);

    expect(readme).toMatch(/no\s+capability\s*\/\s*Cp\s*\/\s*Cpk\s*\/\s*Pp\s*\/\s*Ppk/i);
    expect(readme).toMatch(/no\s+fit/i);
    expect(readme).toMatch(/no\s+distribution\s+fit/i);
    expect(readme).toMatch(/no\s+Monte\s+Carlo/i);
    expect(readme).toMatch(/no\s+recommendation/i);
    expect(readme).toMatch(/no\s+writeback|no\s+write-back/i);
    expect(readme).toMatch(/no\s+upload/i);
    expect(readme).toMatch(/remote\s+persistence/i);
    expect(readme).toMatch(/ADO/i);
    expect(readme).toMatch(/F0\s+writes?/i);
  });

  it("shows local API route evidence for confirm and disposition, without excluded feature routes", () => {
    const serverSource = read("apps/f7-local-api/src/server.ts");
    const routes = extractRouteEvidence(serverSource);

    expect(routes.literalRoutes).toContain("/f7/factors/confirm");
    expect(routes.regexRoutes.some((route) => route.includes("/f7\\/factors\\/([^/]+)\\/measurements\\/disposition"))).toBe(true);

    const excludedRouteTokens = ["capability", "fit", "monte", "recommendation"];
    for (const token of excludedRouteTokens) {
      expect(routes.all.some((route) => route.toLowerCase().includes(token))).toBe(false);
    }
  });
});