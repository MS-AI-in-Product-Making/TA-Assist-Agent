import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { browserCandidates, inlineReportImages } from "./f6-pdf-service.js";

describe("browserCandidates", () => {
  it("uses only controlled Edge and Chrome installation paths", () => {
    expect(browserCandidates({
      AI_TVA_CHROMIUM_EXECUTABLE: "C:\\untrusted\\payload.exe",
      PROGRAMFILES: "C:\\Program Files",
      "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
      LOCALAPPDATA: "C:\\Users\\engineer\\AppData\\Local",
    })).toEqual([
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Users\\engineer\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Users\\engineer\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
    ]);
  });
});

describe("inlineReportImages", () => {
  it("inlines declared images contained by the managed root", async () => {
    const root = join(".tmp", `f6-pdf-images-${randomUUID()}`);
    const reportPath = join(root, "runs", "Feature6-Report.md");
    const imagePath = join(root, "evidence", "stack.png");
    try {
      await mkdir(dirname(reportPath), { recursive: true });
      await mkdir(dirname(imagePath), { recursive: true });
      await writeFile(imagePath, Buffer.from([137, 80, 78, 71]));

      const images = await inlineReportImages({
        markdown: "[Open image](<../evidence/stack.png>)",
        sourceHash: "a".repeat(64),
        reportPath,
        managedRoot: root,
      });

      expect(images.get("../evidence/stack.png")).toBe("data:image/png;base64,iVBORw==");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects declared images outside the managed root", async () => {
    const parent = join(".tmp", `f6-pdf-escape-${randomUUID()}`);
    const root = join(parent, "managed");
    const reportPath = join(root, "Feature6-Report.md");
    const outsideImage = join(parent, "outside.png");
    try {
      await mkdir(root, { recursive: true });
      await writeFile(reportPath, "# report", "utf8");
      await writeFile(outsideImage, Buffer.from([137, 80, 78, 71]));

      await expect(inlineReportImages({
        markdown: "[Open image](<../outside.png>)",
        sourceHash: "b".repeat(64),
        reportPath,
        managedRoot: root,
      })).rejects.toThrow("escaped the managed root");
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("rejects standard Markdown image links outside the managed root", async () => {
    const parent = join(".tmp", `f6-pdf-standard-escape-${randomUUID()}`);
    const root = join(parent, "managed");
    const reportPath = join(root, "Feature6-Report.md");
    const outsideImage = join(parent, "outside.png");
    try {
      await mkdir(root, { recursive: true });
      await writeFile(reportPath, "# report", "utf8");
      await writeFile(outsideImage, Buffer.from([137, 80, 78, 71]));

      await expect(inlineReportImages({
        markdown: "[Open image](../outside.png)",
        sourceHash: "b".repeat(64),
        reportPath,
        managedRoot: root,
      })).rejects.toThrow("escaped the managed root");
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("classifies a missing declared image as an invalid artifact", async () => {
    const root = join(".tmp", `f6-pdf-missing-${randomUUID()}`);
    const reportPath = join(root, "Feature6-Report.md");
    try {
      await mkdir(root, { recursive: true });
      await writeFile(reportPath, "# report", "utf8");

      await expect(inlineReportImages({
        markdown: "[Open image](<missing.png>)",
        sourceHash: "c".repeat(64),
        reportPath,
        managedRoot: root,
      })).rejects.toMatchObject({ code: "pdf_artifact_invalid" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});