export function cellActualText(cell) {
  if (!cell) return "";
  if (cell.t === "e") {
    return typeof cell.w === "string" ? cell.w.trim() : "";
  }
  if (cell.v === undefined || cell.v === null) return "";
  if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
    return Number(cell.v.toPrecision(15)).toString();
  }
  return String(cell.v).trim();
}

export function cellDisplayText(cell) {
  if (!cell) return "";
  if (typeof cell.w === "string" && cell.w.trim().length > 0) return cell.w.trim();
  return cellActualText(cell);
}

function headerColumn(actualGrid, headerRow, label) {
  const expected = label.toLowerCase();
  return actualGrid[headerRow].findIndex((value) => String(value).toLowerCase().includes(expected));
}

export function maskBlankFactorTemplateRows(actualGrid, displayGrid, headerRow, endRow, columns) {
  const factorColumn = headerColumn(actualGrid, headerRow, "factor description");
  const distributionColumn = headerColumn(actualGrid, headerRow, "distribution");
  if (factorColumn < 0 || distributionColumn < factorColumn) return new Set();

  const blankRows = new Set();
  for (let row = headerRow + 1; row <= endRow; row += 1) {
    const hasFactorInput = actualGrid[row]
      .slice(factorColumn, distributionColumn + 1)
      .some((value) => String(value).trim().length > 0);
    if (hasFactorInput) continue;

    const hasTemplateOutput = columns.some((column) => String(actualGrid[row][column] ?? "").trim().length > 0);
    if (!hasTemplateOutput) continue;
    for (const column of columns) {
      actualGrid[row][column] = "";
      displayGrid[row][column] = "";
    }
    blankRows.add(row);
  }
  return blankRows;
}

function markdownLink(text, href) {
  const safeText = String(text ?? "").replace(/\]/g, "\\]");
  return `[${safeText}](${href})`;
}

export function injectLinksIntoFactorTableMarkdown(markdown, traceabilityRows) {
  const byRow = new Map(traceabilityRows.map((item) => [Number(item.sourceRow), item]));
  const lines = markdown.split(/\r?\n/);
  let inFactorTable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## Factor Table")) {
      inFactorTable = true;
      continue;
    }
    if (inFactorTable && line.startsWith("## ") && !line.startsWith("## Factor Table")) {
      inFactorTable = false;
    }
    if (!inFactorTable || !line.startsWith("|") || line.includes("|---")) continue;

    const parts = line.split("|");
    if (parts.length < 4) continue;
    const rowNumber = Number(parts[1]?.trim());
    if (!Number.isFinite(rowNumber)) continue;

    const trace = byRow.get(rowNumber);
    if (!trace) continue;
    const link = trace.factorDescription?.imageLinkForMd ?? trace.target?.imageLinkForMd;
    parts[2] = trace.factorDescription?.text && link
      ? ` ${markdownLink(trace.factorDescription.text, link)} `
      : " ";
    parts[3] = trace.partName?.text && link
      ? ` ${markdownLink(trace.partName.text, link)} `
      : " ";
    lines[index] = parts.join("|");
  }

  return lines.join("\n");
}