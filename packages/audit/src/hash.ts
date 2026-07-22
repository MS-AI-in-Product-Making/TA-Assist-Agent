import { createHash } from "node:crypto";

export function hashUtf8(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}