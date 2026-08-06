import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { f2ArtifactInputSchema, f2UserReportSchema } from "../packages/contracts/dist/contracts.js";

function rejected(artifactRoot, artifactIssues) {
  return {
    status: "inputRejected",
    report: f2UserReportSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      status: "inputRejected",
      artifactRoot,
      artifactIssues,
    }),
  };
}

function safeChild(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath) return undefined;
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relation = path.relative(resolvedRoot, resolved);
  return relation && !relation.startsWith("..") && !path.isAbsolute(relation) ? resolved : undefined;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function issue(reasonCode, artifactPath) {
  return { reasonCode, artifactPath };
}

export function loadF1ArtifactBundle(artifactRoot) {
  const root = path.resolve(artifactRoot);
  const issues = [];
  const rootJsonPath = path.join(root, "Feature1-Report.json");
  const rootMdPath = path.join(root, "Feature1-Report.md");
  if (!existsSync(rootJsonPath)) issues.push(issue("root_json_missing", "Feature1-Report.json"));
  if (!existsSync(rootMdPath)) issues.push(issue("root_md_missing", "Feature1-Report.md"));
  if (!existsSync(rootJsonPath)) return rejected(artifactRoot, issues);

  let rootReport;
  try {
    rootReport = readJson(rootJsonPath);
  } catch {
    issues.push(issue("invalid_json", "Feature1-Report.json"));
    return rejected(artifactRoot, issues);
  }
  const workbook = rootReport?.workbooks?.length === 1 ? rootReport.workbooks[0] : undefined;
  const workbookIdentity = workbook?.workbook;
  const manifestRelative = workbook?.sheetReadmePath;
  const manifestPath = safeChild(root, manifestRelative);
  if (!manifestPath || !existsSync(manifestPath)) issues.push(issue(manifestPath ? "manifest_missing" : "path_outside_root", manifestRelative ?? "sheets/README.md"));

  const jsonSheets = workbook?.task15_factor_table_and_debug_json?.sheets;
  const mdSheets = workbook?.task16_loop_screenshot_and_run_record?.sheets;
  if (!workbookIdentity?.fileName || !workbookIdentity?.contentHash || !Array.isArray(jsonSheets) || !Array.isArray(mdSheets)) {
    issues.push(issue("invalid_contract", "Feature1-Report.json"));
    return rejected(artifactRoot, issues);
  }

  const mdByWorksheet = new Map(mdSheets.map((sheet) => [sheet.worksheetName, sheet.mdPath]));
  const worksheets = [];
  for (const sheet of jsonSheets) {
    const jsonPath = safeChild(root, sheet.jsonPath);
    const mdRelative = mdByWorksheet.get(sheet.worksheetName);
    const mdPath = safeChild(root, mdRelative);
    if (!jsonPath) issues.push(issue("path_outside_root", String(sheet.jsonPath)));
    else if (!existsSync(jsonPath)) issues.push(issue("worksheet_json_missing", sheet.jsonPath));
    if (!mdPath) issues.push(issue("path_outside_root", String(mdRelative ?? "")));
    else if (!existsSync(mdPath)) issues.push(issue("worksheet_md_missing", mdRelative));
    if (!jsonPath || !mdPath || !existsSync(jsonPath) || !existsSync(mdPath)) continue;

    let worksheet;
    try {
      worksheet = readJson(jsonPath);
    } catch {
      issues.push(issue("invalid_json", sheet.jsonPath));
      continue;
    }
    if (worksheet.worksheetName !== sheet.worksheetName
      || worksheet.workbook?.fileName !== workbookIdentity.fileName
      || worksheet.workbook?.contentHash !== workbookIdentity.contentHash) {
      issues.push(issue("workbook_identity_mismatch", sheet.jsonPath));
      continue;
    }
    if (typeof worksheet.toleranceLoopDescription !== "string"
      || worksheet.toleranceLoopDescription.trim().length === 0) {
      issues.push(issue("invalid_contract", sheet.jsonPath));
      continue;
    }

    let tolerancePathImage;
    const semanticImage = worksheet.tolerancePathImage;
    if (semanticImage?.status === "available") {
      const candidates = (worksheet.imageAssets ?? []).filter((image) => image.contentHash === semanticImage.imageContentHash);
      const image = candidates.length === 1 ? candidates[0] : undefined;
      const imagePath = safeChild(root, image?.outputFile);
      if (!image || !imagePath || !existsSync(imagePath)) {
        issues.push(issue(imagePath === undefined && image?.outputFile ? "path_outside_root" : "image_missing", image?.outputFile ?? sheet.jsonPath));
        continue;
      }
      if (statSync(imagePath).size === 0) {
        issues.push(issue("image_empty", image.outputFile));
        continue;
      }
      if (!new Set(["image/png", "image/jpeg"]).has(image.mediaType)) {
        issues.push(issue("image_unsupported", image.outputFile));
        continue;
      }
      const actualHash = createHash("sha256").update(readFileSync(imagePath)).digest("hex");
      if (actualHash !== image.contentHash) {
        issues.push(issue("workbook_identity_mismatch", image.outputFile));
        continue;
      }
      tolerancePathImage = { status: "available", imagePath: image.outputFile, contentHash: image.contentHash, mediaType: image.mediaType };
    } else {
      tolerancePathImage = {
        status: "unavailable",
        reasonCode: semanticImage?.reasonCode ?? "image_missing",
      };
    }
    worksheets.push({
      worksheetName: sheet.worksheetName,
      toleranceLoopDescription: worksheet.toleranceLoopDescription,
      worksheetJsonPath: sheet.jsonPath,
      worksheetMdPath: mdRelative,
      tolerancePathImage,
      factorTables: worksheet.factorTables ?? [],
    });
  }

  if (issues.length > 0) return rejected(artifactRoot, issues);
  const parsed = f2ArtifactInputSchema.safeParse({
    contractVersion: "v1",
    inputClassification: "confidential",
    artifactRoot,
    workbook: {
      fileName: workbookIdentity.fileName,
      contentHash: workbookIdentity.contentHash,
      f1GeneratedAt: rootReport.generatedAt,
    },
    worksheets,
  });
  if (!parsed.success) return rejected(artifactRoot, [issue("invalid_contract", "Feature1-Report.json")]);
  return { status: "accepted", input: parsed.data };
}