const path = require('path');
const XLSX = require('xlsx');

function text(file) {
  if (!file || !file.content) return '';
  if (typeof file.content === 'string') return file.content;
  return Buffer.from(file.content).toString('utf8');
}

function inspect(workbookPath, targets) {
  const wb = XLSX.readFile(workbookPath, { bookFiles: true });
  const wbXml = text(wb.files['xl/workbook.xml']);
  const relXml = text(wb.files['xl/_rels/workbook.xml.rels']);
  const relMap = new Map();
  for (const m of relXml.matchAll(/<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi)) {
    relMap.set(m[1], m[2]);
  }

  for (const m of wbXml.matchAll(/<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/gi)) {
    const name = m[1];
    if (!targets.includes(name)) continue;

    const target = relMap.get(m[2]);
    const normalized = target.replace(/^\/?/, '').replace(/^\.\//, '');
    const sheetPath = normalized.startsWith('xl/') ? normalized : `xl/${normalized}`;

    const sheetXml = text(wb.files[sheetPath]);
    const drawingRid = sheetXml.match(/<drawing\s+[^>]*r:id="([^"]+)"/i)?.[1];

    const sheetFile = sheetPath.split('/').pop();
    const relPath = `xl/worksheets/_rels/${sheetFile}.rels`;
    const sheetRelsXml = text(wb.files[relPath]);
    const relRows = [...sheetRelsXml.matchAll(/<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*Type="([^"]+)"/gi)]
      .map((x) => ({ id: x[1], target: x[2], type: x[3] }));

    const drawingRel = relRows.find((r) => r.id === drawingRid || r.type.includes('/drawing'));
    let drawingPart = undefined;
    let drawingXml = '';
    if (drawingRel) {
      const baseDir = sheetPath.split('/').slice(0, -1).join('/');
      drawingPart = drawingRel.target.startsWith('/')
        ? drawingRel.target.replace(/^\//, '')
        : path.posix.normalize(path.posix.join(baseDir, drawingRel.target)).replace(/^\/+/, '');
      drawingXml = text(wb.files[drawingPart]);
    }

    const picCount = (drawingXml.match(/<xdr:pic\b/gi) || []).length;
    const spCount = (drawingXml.match(/<xdr:sp\b/gi) || []).length;
    const cxnCount = (drawingXml.match(/<xdr:cxnSp\b/gi) || []).length;
    const grpCount = (drawingXml.match(/<xdr:grpSp\b/gi) || []).length;
    const textCount = (drawingXml.match(/<a:t\b/gi) || []).length;
    const lnCount = (drawingXml.match(/<a:ln\b/gi) || []).length;

    console.log('---', name);
    console.log('sheetPath:', sheetPath);
    console.log('drawingRid:', drawingRid || 'none');
    console.log('relPath exists:', !!wb.files[relPath]);
    console.log('drawingPart:', drawingPart || 'none');
    console.log('pic/sp/cxn/grp/text/ln:', picCount, spCount, cxnCount, grpCount, textCount, lnCount);
  }
}

inspect('test/Maera_cosmetic_critical_TA - Rev E.xlsx', ['Feet_positioning', 'Feet_gap', 'TP_Gap_X']);
inspect('test/Maera_gap_TP_brkt_and _battery_20260305V1.xlsx', ['gap w rubber_TPoverload500g']);
