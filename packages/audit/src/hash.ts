import { createHash } from "node:crypto";

export function hashUtf8(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function hashBytes(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}