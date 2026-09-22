import { readFileSync } from "node:fs";

import type { F6PdfWorkerRequest } from "./f6-pdf-export.js";
import { superviseF6PdfWorker } from "./f6-pdf-worker-process.js";

try {
  const request = JSON.parse(readFileSync(0, "utf8")) as F6PdfWorkerRequest;
  const outcome = await superviseF6PdfWorker(request);
  process.stdout.write(outcome, () => process.exit(0));
} catch {
  process.stdout.write("execution_failed", () => process.exit(0));
}
