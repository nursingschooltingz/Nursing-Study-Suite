'use strict';

const zlib = require('zlib');
const path = require('path');
const { spawnSync } = require('child_process');
const cliSlicer = require('./pdf-toc-slice');

function buildClassicPdf14Buffer() {
  // Synthetic 20-page PDF 1.4 with Roman front-matter (i..iv) + Arabic pages (1..16),
  // /Outlines hierarchy (Ch 1 Heart Failure & Shock -> Heart Failure [pp. 5-8], Circulatory Shock [pp. 9-11];
  // Ch 2 Diuretics -> Loop Diuretics [pp. 12-14], Thiazide Diuretics [pp. 15-20]), and /Dests named destination.
  const objects = new Map();
  // 1: Catalog, 2: Pages, 3..22: 20 Page objects, 23: PageLabels, 24: Dests, 25: Outlines, 26..31: Outline items
  const pageRefs = [];
  for (let i = 0; i < 20; i++) {
    const objNum = 3 + i;
    pageRefs.push(`${objNum} 0 R`);
    objects.set(objNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>`);
  }
  objects.set(2, `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count 20 >>`);
  objects.set(23, `<< /Nums [0 << /S /r >> 4 << /S /D /St 1 >>] >>`);
  objects.set(24, `<< /hf_sec [7 0 R /XYZ 0 700 null] >>`); // obj 7 = page 5 (index 4)
  objects.set(25, `<< /Type /Outlines /First 26 0 R /Last 29 0 R /Count 6 >>`);
  // Ch 1 starts on PDF p. 5 (obj 7), Ch 2 starts on PDF p. 12 (obj 14)
  objects.set(26, `<< /Title (Chapter 1: Heart Failure and Circulatory Shock) /Parent 25 0 R /Next 29 0 R /First 27 0 R /Last 28 0 R /Dest [7 0 R /Fit] >>`);
  objects.set(27, `<< /Title (Heart Failure in Adults) /Parent 26 0 R /Next 28 0 R /Dest /hf_sec >>`);
  objects.set(28, `<< /Title (Circulatory Shock) /Parent 26 0 R /Prev 27 0 R /Dest [11 0 R /Fit] >>`); // obj 11 = PDF p. 9
  objects.set(29, `<< /Title (Chapter 2: Renal & Diuretic Agents) /Parent 25 0 R /Prev 26 0 R /First 30 0 R /Last 31 0 R /A << /S /GoTo /D [14 0 R /Fit] >> >>`); // obj 14 = PDF p. 12
  objects.set(30, `<< /Title (Loop Diuretics and Prototype Drug: Furosemide) /Parent 29 0 R /Next 31 0 R /Dest [14 0 R /Fit] >>`); // PDF pp. 12-14
  objects.set(31, `<< /Title (Thiazide Diuretics) /Parent 29 0 R /Prev 30 0 R /Dest [17 0 R /Fit] >>`); // obj 17 = PDF p. 15
  objects.set(1, `<< /Type /Catalog /Pages 2 0 R /PageLabels 23 0 R /Dests 24 0 R /Outlines 25 0 R >>`);

  const maxObj = 31;
  let body = '%PDF-1.4\n';
  const offsets = new Array(maxObj + 1).fill(0);
  for (let n = 1; n <= maxObj; n++) {
    offsets[n] = Buffer.byteLength(body, 'latin1');
    body += `${n} 0 obj\n${objects.get(n)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= maxObj; n++) {
    body += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
  }
  body += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function encodeUtf16BeHex(str) {
  const bytes = [0xFE, 0xFF];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push((code >> 8) & 0xFF, code & 0xFF);
  }
  return '<' + bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('') + '>';
}

function pngUpEncodeRows(rawBuf, columns) {
  const rows = Math.floor(rawBuf.length / columns);
  const out = Buffer.alloc(rows * (columns + 1));
  let prev = Buffer.alloc(columns);
  for (let r = 0; r < rows; r++) {
    out[r * (columns + 1)] = 2; // PNG Up filter
    const cur = rawBuf.slice(r * columns, (r + 1) * columns);
    for (let c = 0; c < columns; c++) {
      out[r * (columns + 1) + 1 + c] = (cur[c] - prev[c]) & 0xFF;
    }
    prev = cur;
  }
  return out;
}

function buildCompressedPdf15Buffer() {
  // Synthetic 15-page PDF 1.5 where Catalog, Outlines, UTF-16BE Outline items, and /Names -> /Dests
  // live inside a compressed /Type /ObjStm (obj 20), indexed by a Flate + PNG-Up (/Predictor 12) /Type /XRef stream (obj 21).
  const directObjs = new Map();
  // 2: Pages, 3..17: 15 Page objects
  const kids = [];
  for (let i = 0; i < 15; i++) {
    const onum = 3 + i;
    kids.push(`${onum} 0 R`);
    directObjs.set(onum, `<< /Type /Page /Parent 2 0 R >>`);
  }
  directObjs.set(2, `<< /Type /Pages /Kids [${kids.join(' ')}] /Count 15 >>`);

  // Objects stored inside ObjStm (obj 20):
  // 1: Catalog, 18: Names root, 19: Dests name tree, 22: Outlines, 23: Ch 19, 24: Abnormal Findings
  const stmEntries = [
    [1, `<< /Type /Catalog /Pages 2 0 R /Names 18 0 R /Outlines 22 0 R >>`],
    [18, `<< /Dests 19 0 R >>`],
    [19, `<< /Names [(ch19_start) << /D [5 0 R /XYZ 0 750 null] >> (abn_sec) [14 0 R /Fit]] >>`], // obj 5 = p. 3, obj 14 = p. 12
    [22, `<< /Type /Outlines /First 23 0 R /Last 23 0 R /Count 2 >>`],
    [23, `<< /Title ${encodeUtf16BeHex('Chapter 19: Heart and Neck Vessels')} /Parent 22 0 R /First 24 0 R /Last 24 0 R /Dest (ch19_start) >>`],
    [24, `<< /Title ${encodeUtf16BeHex('Abnormal Findings: Heart Sounds and Murmurs')} /Parent 23 0 R /Dest (abn_sec) >>`],
  ];
  let headerParts = [], bodyStr = '';
  for (const [onum, txt] of stmEntries) {
    const relOff = Buffer.byteLength(bodyStr, 'latin1');
    headerParts.push(`${onum} ${relOff}`);
    bodyStr += txt + '\n';
  }
  const headerStr = headerParts.join(' ') + ' ';
  const firstOff = Buffer.byteLength(headerStr, 'latin1');
  const objStmCompressed = zlib.deflateSync(Buffer.from(headerStr + bodyStr, 'latin1'));

  const parts = [Buffer.from('%PDF-1.5\n', 'latin1')];
  let cursor = parts[0].length;
  const type1Offsets = new Map();

  for (const [onum, dictTxt] of directObjs.entries()) {
    type1Offsets.set(onum, cursor);
    const chunk = Buffer.from(`${onum} 0 obj\n${dictTxt}\nendobj\n`, 'latin1');
    parts.push(chunk);
    cursor += chunk.length;
  }

  // Write ObjStm as obj 20
  type1Offsets.set(20, cursor);
  const stmHead = Buffer.from(`20 0 obj\n<< /Type /ObjStm /N ${stmEntries.length} /First ${firstOff} /Filter /FlateDecode /Length ${objStmCompressed.length} >>\nstream\n`, 'latin1');
  const stmTail = Buffer.from(`\nendstream\nendobj\n`, 'latin1');
  parts.push(stmHead, objStmCompressed, stmTail);
  cursor += stmHead.length + objStmCompressed.length + stmTail.length;

  // XRef stream is obj 21 (Size = 25, W = [1, 2, 1], Columns = 4, Predictor = 12)
  const xrefOffset = cursor;
  type1Offsets.set(21, xrefOffset);
  const size = 25;
  const rawXref = Buffer.alloc(size * 4);
  const writeEntry = (idx, tp, f1, f2) => {
    const base = idx * 4;
    rawXref[base] = tp;
    rawXref[base + 1] = (f1 >> 8) & 0xFF;
    rawXref[base + 2] = f1 & 0xFF;
    rawXref[base + 3] = f2 & 0xFF;
  };
  writeEntry(0, 0, 0, 255);
  for (const [onum, off] of type1Offsets.entries()) writeEntry(onum, 1, off, 0);
  stmEntries.forEach(([onum], idx) => writeEntry(onum, 2, 20, idx));

  const predicted = pngUpEncodeRows(rawXref, 4);
  const xrefCompressed = zlib.deflateSync(predicted);
  const xrefHead = Buffer.from(`21 0 obj\n<< /Type /XRef /Size ${size} /Root 1 0 R /W [1 2 1] /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >> /Length ${xrefCompressed.length} >>\nstream\n`, 'latin1');
  const xrefTail = Buffer.from(`\nendstream\nendobj\nstartxref\n${xrefOffset}\n%%EOF\n`, 'latin1');
  parts.push(xrefHead, xrefCompressed, xrefTail);
  return Buffer.concat(parts);
}

module.exports = async function pdfTocSlicerTests(S, t) {
  function span(startAnchor, endAnchor) {
    const a = S.indexOf(startAnchor);
    if (a < 0) throw new Error('start anchor missing: ' + startAnchor);
    const b = S.indexOf(endAnchor, a + startAnchor.length);
    if (b < 0) throw new Error('end anchor missing after ' + startAnchor + ': ' + endAnchor);
    return S.slice(a, b);
  }

  const tocHelpersSpan = span('function kbMergePageRanges(', '\n// Markdown to plain text');
  const chunkHelpersSpan = span('function kbUnitLabel(', '\nfunction kbCompareOrder(');
  const buildSpan = span('const build=async()=>{', '\n  const exportDiag=()=>{');
  const kbBuilderSpan = span('function KnowledgeBaseBuilder(){', '\n// ──── TOOL: Priority Analyzer ────');

  // Instantiate live HTML TOC helpers with controlled PDF stubs
  function makeTocEnv({ fakePdf = null, fakePages = {} } = {}) {
    const getPdfDoc = async () => {
      if (!fakePdf) throw new Error('No fakePdf configured');
      return fakePdf;
    };
    const destroyPdfDoc = () => {};
    const pdfWalkPages = async (file, { signal, from = 1, to = Infinity, onPage } = {}) => {
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const total = fakePdf ? fakePdf.numPages : Object.keys(fakePages).length;
      const first = Math.max(1, Math.floor(from) || 1);
      const last = Math.min(total, to === Infinity ? total : Math.floor(to) || 0);
      for (let i = first; i <= last; i++) {
        if (onPage) await onPage(fakePages[i] || '', i, { cleanup: () => {} }, total, { items: [] });
      }
      return total;
    };
    const kbTextQuality = units => {
      const pages = (units || []).filter(u => u && u.kind === 'page');
      if (!pages.length) return null;
      const chars = pages.map(u => String(u.text || '').replace(/^\s*---\s*PAGE\s*\d+\s*---/i, '').trim().length);
      const total = chars.reduce((a, b) => a + b, 0);
      return { pages: pages.length, empty: chars.filter(c => c < 50).length, total, avg: Math.round(total / pages.length), perPage: [] };
    };
    return new Function(
      'getPdfDoc', 'destroyPdfDoc', 'pdfWalkPages', 'kbTextQuality', 'extractPptxText', 'kbPageComposition', 'kbCompositionSummary',
      `${tocHelpersSpan}\n${chunkHelpersSpan}\nreturn { kbMergePageRanges, kbFormatPageRanges, kbCountPagesInRanges, kbParsePageRanges, kbDetectConceptSortQBank, kbSuggestTextbookRole, kbMergeConceptInput, kbInferUploadDropMeta, kbClassifyTocFeature, kbBuildTocTree, kbMatchTocNodes, kbResolveTocSelectionRanges, kbFormatTocSlicePlanMd, kbResolvePdfDestPage, kbInspectPdfToc, kbSourceUnits, kbGroupUnits, kbBuildSourceChunks };`
    )(getPdfDoc, destroyPdfDoc, pdfWalkPages, kbTextQuality, async () => '', async () => ({}), () => null);
  }

  const H = makeTocEnv();

  // 1. Extraction tail
  t('v21.3 TOC Slicer (Extraction tail): live HTML TOC inspector, matcher, page-range slicer, and chunk helpers compile cleanly',
    typeof H.kbMergePageRanges === 'function' &&
    typeof H.kbParsePageRanges === 'function' &&
    typeof H.kbSuggestTextbookRole === 'function' &&
    typeof H.kbBuildTocTree === 'function' &&
    typeof H.kbMatchTocNodes === 'function' &&
    typeof H.kbResolveTocSelectionRanges === 'function' &&
    typeof H.kbFormatTocSlicePlanMd === 'function' &&
    typeof H.kbInspectPdfToc === 'function' &&
    typeof H.kbSourceUnits === 'function' &&
    typeof H.kbGroupUnits === 'function' &&
    typeof H.kbBuildSourceChunks === 'function');

  // 2. Page range parser, adjacency merger, cap clamping & invalid detection
  {
    const parsed = H.kbParsePageRanges('512-520, 521-524; pp. 535, PDF pages 540–542', 600);
    const bad = H.kbParsePageRanges('512-520, 50-40, abc, 700-710', 600);
    t('v21.3 TOC Slicer (kbParsePageRanges): merges contiguous ranges, accepts pp./en-dash syntax, clamps maxPages, and flags reversed/out-of-bounds tokens',
      parsed.formatted === '512-524, 535, 540-542' &&
      parsed.pageCount === 17 &&
      parsed.invalid.length === 0 &&
      bad.formatted === '512-520' &&
      bad.invalid.length === 3 &&
      bad.invalid.includes('50-40') &&
      bad.invalid.includes('abc') &&
      bad.invalid.includes('700-710'));
  }

  // 3. Textbook P-LATE role suggestion
  t('v21.3 TOC Slicer (kbSuggestTextbookRole): maps Porth/McCance->patho-bridge, Jarvis/Bates->exam-bridge, Lehne->pharm-bridge, and McCuistion/Saunders->rn',
    H.kbSuggestTextbookRole('Porths-Essentials-of-Pathophysiology-5th.pdf').roles[0] === 'patho-bridge' &&
    H.kbSuggestTextbookRole('Jarvis_Physical_Examination_Health_Assessment.pdf').roles[0] === 'exam-bridge' &&
    H.kbSuggestTextbookRole('Lehnes-Pharmacology-for-Nursing-Care.pdf').roles[0] === 'pharm-bridge' &&
    H.kbSuggestTextbookRole('McCuistion-Pharmacology-12e.pdf').roles[0] === 'rn' &&
    H.kbSuggestTextbookRole('Saunders-Comprehensive-NCLEX.pdf').roles[0] === 'rn');

  // 4. Hierarchical TOC tree, start/end page derivation, book labels, and exemplar-level topic specificity
  {
    const labels = Array.from({ length: 100 }, (_, idx) => idx < 20 ? cliSlicer.inspectPdfTocBuffer ? 'x' : '' : String(idx - 19));
    // First 20 pages front matter ('i'..'xx' approximated), PDF p. 21 = Book p. 1
    for (let i = 0; i < 20; i++) labels[i] = 'fm-' + (i + 1);
    const rawOutline = [
      {
        title: 'Unit 5: Disorders of Cardiovascular Function', page: 21, items: [
          {
            title: 'Chapter 20: Heart Failure and Circulatory Shock', page: 21, items: [
              {
                title: 'Heart Failure in Adults', page: 22, items: [
                  { title: 'Pathophysiology of Heart Failure', page: 22, items: [] },
                  { title: 'Clinical Manifestations', page: 25, items: [] },
                  { title: 'Treatment and Nursing Management', page: 28, items: [] },
                ]
              },
              { title: 'Circulatory Shock', page: 31, items: [] },
              { title: 'Heart Failure in Children', page: 40, items: [] },
              { title: 'Review of Key Concepts', page: 45, items: [] },
            ]
          },
          {
            title: 'Chapter 21: Diuretic & Cardiac Glycoside Therapy', page: 47, items: [
              { title: 'Loop Diuretics', page: 48, items: [] },
              { title: 'Thiazide Diuretics', page: 53, items: [] },
              { title: 'Cardiac Glycosides', page: 58, items: [] },
              { title: 'Abnormal Findings in Fluid Overload', page: 63, items: [] },
            ]
          }
        ]
      }
    ];
    const tree = H.kbBuildTocTree(rawOutline, 100, labels);
    const hfAdults = tree.flat.find(n => n.title === 'Heart Failure in Adults');
    const shock = tree.flat.find(n => n.title === 'Circulatory Shock');
    const matchHf = H.kbMatchTocNodes(tree.flat, 'Heart Failure in Adults, Loop Diuretics, Cardiac Glycosides');
    const sel = H.kbResolveTocSelectionRanges(tree.flat, matchHf.recommendedIds, { padEnd: 0, numPages: 100 });
    const selPadded = H.kbResolveTocSelectionRanges(tree.flat, matchHf.recommendedIds, { padEnd: 1, numPages: 100 });
    const planMd = H.kbFormatTocSlicePlanMd({ fileName: 'Porth-5e.pdf', numPages: 100, source: 'outline', suggestedRole: H.kbSuggestTextbookRole('Porth-5e.pdf') }, sel);

    t('v21.3 TOC Slicer (kbBuildTocTree & kbMatchTocNodes): computes exact section spans, preserves child extent on parent exemplar, maps Book page labels, classifies high-yield features, and formats Ctrl+P slice ranges',
      hfAdults.startPage === 22 && hfAdults.endPage === 30 && hfAdults.pageCount === 9 &&
      hfAdults.bookStart === '2' && hfAdults.bookEnd === '10' && hfAdults.bookLabelDiffers === true &&
      shock.startPage === 31 && shock.endPage === 39 &&
      sel.formatted === '22-30, 48-52, 58-62' &&
      sel.pageCount === 19 &&
      selPadded.formatted === '22-31, 48-53, 58-63' &&
      tree.flat.find(n => n.title === 'Review of Key Concepts').feature === 'key-concepts' &&
      tree.flat.find(n => n.title === 'Abnormal Findings in Fluid Overload').feature === 'abnormal-table' &&
      planMd.includes('`22-30, 48-52, 58-62`') &&
      planMd.includes('Book pp. 2–10'));
  }

  // 5. kbInspectPdfToc: embedded outline resolution AND printed front-matter TOC fallback
  {
    const envOutline = makeTocEnv({
      fakePdf: {
        numPages: 50,
        getOutline: async () => [
          { title: 'Ch 10: Perfusion', dest: 'perf_dest', items: [{ title: 'Acute Coronary Syndrome', dest: [{ ref: 15 }, { name: 'XYZ' }], items: [] }] },
          { title: 'Ch 11: Gas Exchange', dest: [29, { name: 'Fit' }], items: [] },
        ],
        getDestination: async name => name === 'perf_dest' ? [{ ref: 10 }, { name: 'Fit' }] : null,
        getPageIndex: async refObj => refObj.ref - 1,
        getPageLabels: async () => Array.from({ length: 50 }, (_, i) => String(i + 1)),
      }
    });
    const repOutline = await envOutline.kbInspectPdfToc({ name: 'Bates-Guide-Physical-Examination.pdf', size: 1024 });

    // Bookmarkless PDF with printed Table of Contents on PDF p. 4 and printed page "1" on PDF p. 25 (offset = +24)
    const printedPages = {
      4: 'Table of Contents\nChapter 18 Disorders of Cardiac Function ........ 1\nHeart Failure ........ 12\nCirculatory Shock ........ 20',
      25: 'Chapter 18 Disorders of Cardiac Function\nNormal blood flow...\n1',
      26: 'Cardiac cycle mechanics...\n2',
    };
    const envPrinted = makeTocEnv({
      fakePdf: { numPages: 80, getOutline: async () => null, getPageLabels: async () => null },
      fakePages: printedPages,
    });
    const repPrinted = await envPrinted.kbInspectPdfToc({ name: 'Porth-Pathophysiology.pdf', size: 2048 });
    const hfPrinted = repPrinted.flat.find(n => n.title === 'Heart Failure');

    t('v21.3 TOC Slicer (kbInspectPdfToc): resolves embedded PDF outlines + named destinations AND falls back to front-matter printed TOC with estimated PDF page offset when bookmarks are absent',
      repOutline.source === 'outline' &&
      repOutline.suggestedRole.roles[0] === 'exam-bridge' &&
      repOutline.flat[0].startPage === 10 && repOutline.flat[0].endPage === 29 &&
      repOutline.flat[1].startPage === 15 && repOutline.flat[1].endPage === 29 &&
      repPrinted.source === 'printed-toc' &&
      repPrinted.tocOffset === 24 &&
      hfPrinted && hfPrinted.startPage === 36 && hfPrinted.endPage === 43);
  }

  // 6. Non-contiguous PDF page slicing in kbSourceUnits, kbGroupUnits, and KnowledgeBaseBuilder.build()
  {
    const walkedPages = [];
    const hundredPages = {};
    for (let i = 1; i <= 100; i++) {
      hundredPages[i] = `Clinical textbook content for page ${i}. ` + 'Furosemide inhibits NKCC2 in the thick ascending limb. '.repeat(6);
    }
    const envSlice = makeTocEnv({
      fakePdf: { numPages: 100 },
      fakePages: new Proxy(hundredPages, {
        get(target, prop) {
          const n = Number(prop);
          if (Number.isFinite(n)) walkedPages.push(n);
          return target[prop];
        }
      })
    });
    const chunks = await envSlice.kbBuildSourceChunks(
      { name: 'McCuistion.pdf', type: 'application/pdf' },
      15000,
      1,
      { pageRanges: [{ start: 10, end: 11 }, { start: 25, end: 26 }] }
    );

    // Also run extracted KnowledgeBaseBuilder.build() with sourcePageRanges set for one valid sliced PDF and one invalid slice
    const logs = [], warnings = [], chunkCalls = [];
    const files = [
      { name: 'Porth-5e.pdf', size: 1000, lastModified: 1, type: 'application/pdf' },
      { name: 'BadSlice.pdf', size: 500, lastModified: 2, type: 'application/pdf' },
    ];
    const buildFn = new Function(
      'cfg', 'files', 'currentFiles', 'kbConfirmReplace', 'replacementSlot',
      'setBusy', 'setError', 'setWarnings', 'setProg', 'setDiag', 'setLogs', 'setSelected', 'addLog', 'abortRef',
      'kbOutcomes', 'kbPoints', 'kbExtra', 'focusMode', 'sourceRoles', 'sourcePageRanges', 'kbParsePageRanges', 'cardFileId',
      'cardGate', 'cardIsImage', 'kbBuildSourceChunks', 'chunkChars', 'overlapUnits', 'probeComposition',
      'laneCount', 'verifyPass', 'KB_EXTRACTION_PROMPT', 'KB_VERIFY_PROMPT', 'kbBuildFocusBlock',
      'kbNormForMatch', 'kbDehyphNormForMatch', 'kbCanonOperators', 'kbClassifyQuoteMiss',
      'geminiRequest', 'kbValidateExtractionEnvelope', 'extractJSON', 'kbSplitChunk', 'geminiHaltsBatch',
      'kbQuoteInSource', 'kbQuoteOperatorsAgree', 'kbRunLanes', 'kbCompareOrder', 'mergeLatteParts',
      'course', 'exam', 'kbFlagUnderextraction', 'kbBucketGaps', 'K',
      buildSpan + '\n;return build;'
    )(
      { apiKey: 'k', autoProfile: true, forTool: () => ({ model: 'm', level: 'low' }) },
      files, { current: files }, () => true,
      { current: { start: () => ({ ctl: new AbortController() }), current: () => true, owns: () => true, finish: () => true } },
      () => {}, () => {}, w => warnings.push(...w), () => {}, () => {}, () => {}, () => {},
      (m, tp) => logs.push({ m, tp }), { current: null },
      '', '', '', 'prioritize',
      { 'Porth-5e.pdf:1000:1': ['patho-bridge'] },
      { 'Porth-5e.pdf:1000:1': '512-520, 531-535', 'BadSlice.pdf:500:2': '90-80' },
      H.kbParsePageRanges,
      f => `${f.name}:${f.size}:${f.lastModified}`,
      { buildable: [], blocked: [] }, () => false,
      async (f, maxC, ov, opts) => {
        chunkCalls.push({ name: f.name, pageRanges: opts.pageRanges || null });
        return [{ text: '--- PAGE 512 ---\nRAAS remodeling reduces stroke volume.', label: 'pages 512–520', units: [{ kind: 'page', n: 512, text: 'RAAS remodeling reduces stroke volume.' }] }];
      },
      15000, 1, false, 1, false, 'EXTRACT', 'VERIFY', () => '',
      s => String(s || '').toLowerCase(), s => String(s || '').toLowerCase(), s => String(s || ''), () => null,
      async () => JSON.stringify({
        conditions: [{ name: 'Heart Failure', aliases: [], facts: [{ latteBucket: 'Patho', subtype: null, factType: 'definition', tier: 1, safetyCritical: false, text: 'RAAS remodeling reduces stroke volume.', sourceQuote: 'raas remodeling reduces stroke volume' }] }],
        medications: [], diagnostics: [], scoringTools: [], formulas: [], contradictions: []
      }),
      x => x, s => JSON.parse(s), () => null, () => false, () => true, () => true,
      async (q, w, worker, sig) => { while (q.length) await worker(q.shift(), sig); },
      () => 0,
      parts => ({ conditions: [{ id: 'hf', name: 'Heart Failure', facts: parts[0].conditions[0].facts }], metadata: {}, sources: [parts[0].source] }),
      '', '', s => s, () => [], { setKnowledgeBase: () => {} }
    );
    await buildFn();

    t('v21.3 TOC Slicer (Sliced PDF extraction & build() integration): reads only the 4 sliced pages out of 100, splits chunks cleanly across non-contiguous page jumps without overlap bleed, passes pageRanges in build(), and skips invalid slices with a warning',
      JSON.stringify(walkedPages) === '[10,11,25,26]' &&
      chunks.length === 2 &&
      chunks[0].label === 'pages 10–11' &&
      chunks[1].label === 'pages 25–26' &&
      !chunks[1].text.includes('PAGE 11') &&
      chunkCalls.length === 1 &&
      chunkCalls[0].name === 'Porth-5e.pdf' &&
      JSON.stringify(chunkCalls[0].pageRanges) === '[{"start":512,"end":520},{"start":531,"end":535}]' &&
      logs.some(l => l.m.includes('✂ Porth-5e.pdf: slicing PDF pages 512-520, 531-535 (14 page(s))')) &&
      warnings.some(w => w.includes('BadSlice.pdf: invalid page slice "90-80"')));
  }

  // 7. KnowledgeBaseBuilder UI subsection & Step 01 chip integration
  t('v21.3 TOC Slicer (KnowledgeBaseBuilder UI integration): renders dedicated Textbook TOC & section slicer setup subsection, interactive results Panel, labelled #kb-toc-query field, and Step 01 PDF chip slice controls',
    kbBuilderSpan.includes('<Disclose summary="Textbook TOC & section slicer"') &&
    kbBuilderSpan.includes('<Panel title="Textbook TOC & section slicer"') &&
    kbBuilderSpan.includes('htmlFor="kb-toc-query"') &&
    S.split('id="kb-toc-query"').length === 2 &&
    kbBuilderSpan.includes("aria-label={'Page slice for '+f.name}") &&
    kbBuilderSpan.includes('✂ Slice / TOC') &&
    kbBuilderSpan.includes('Send Sliced PDF to Step 01'));

  // 8. Standalone local CLI script (tools/pdf-toc-slice.js) against PDF 1.4 & compressed PDF 1.5 (XRef stream + PNG Up predictor + ObjStm + UTF-16BE + Names/Dests)
  {
    const pdf14 = buildClassicPdf14Buffer();
    const rep14 = cliSlicer.inspectPdfTocBuffer(pdf14, 'McCuistion-Pharmacology-12e.pdf');
    const m14 = cliSlicer.matchTocNodes(rep14.flat, 'Heart Failure, Loop Diuretics');
    const sel14 = cliSlicer.resolveSelectionRanges(rep14.flat, m14.recommendedIds, { numPages: rep14.numPages });

    const pdf15 = buildCompressedPdf15Buffer();
    const rep15 = cliSlicer.inspectPdfTocBuffer(pdf15, 'Jarvis-Health-Assessment.pdf');
    const m15 = cliSlicer.matchTocNodes(rep15.flat, 'Abnormal Findings');
    const sel15 = cliSlicer.resolveSelectionRanges(rep15.flat, m15.recommendedIds, { numPages: rep15.numPages });

    const cliHelp = spawnSync(process.execPath, [path.join(__dirname, 'pdf-toc-slice.js'), '--help'], { encoding: 'utf8' });

    t('v21.3 TOC Slicer (tools/pdf-toc-slice.js standalone local CLI): parses classic PDF 1.4 xrefs + PageLabels AND compressed PDF 1.5 XRef/ObjStm streams with PNG-Up predictor + UTF-16BE titles + Names/Dests',
      rep14.numPages === 20 &&
      rep14.suggestedRole.roles[0] === 'rn' &&
      rep14.hasBookLabels === true &&
      rep14.flat.find(n => n.title === 'Heart Failure in Adults').bookStart === '1' &&
      sel14.formatted === '5-8, 12-14' &&
      sel14.pageCount === 7 &&
      rep15.numPages === 15 &&
      rep15.suggestedRole.roles[0] === 'exam-bridge' &&
      rep15.flat.length === 2 &&
      rep15.flat[0].title === 'Chapter 19: Heart and Neck Vessels' &&
      rep15.flat[0].startPage === 3 && rep15.flat[0].endPage === 15 &&
      rep15.flat[1].feature === 'abnormal-table' &&
      sel15.formatted === '12-15' &&
      cliHelp.status === 0 &&
      cliHelp.stdout.includes('Local PDF TOC Inspector & Section Slicer'));
  }

  // 9. v21.8 Lehne Pharmacotherapeutics role precedence, callout feature classification, and Step 01 Giddens concept-sort drop inference
  {
    const lehneMasterRole = H.kbSuggestTextbookRole(
      "Lehne's Pharmacotherapeutics for Advanced Practice Nurses - 2nd Ed.pdf",
      ['Title Page', 'Preface', 'Reviewing Physiology and Pathophysiology', 'Teaching Through Prototypes']
    );
    const lehneCh81Unprefixed = H.kbSuggestTextbookRole(
      'Chapter 81 - Antiviral Agents II (HIV and Antiretrovirals).pdf',
      ['Pathophysiology of Human Immunodeficiency Virus Infection', 'Antiretroviral Drugs', 'Summary of Key Prescribing Considerations: Drugs for HIV Infection']
    );
    const genericPathoRole = H.kbSuggestTextbookRole(
      'Essentials-of-Pathophysiology-Unbranded.pdf',
      ['Cellular Adaptation and Pathophysiology of Shock']
    );
    const giddensConceptRole = H.kbSuggestTextbookRole('Giddens - Concept 18 - Perfusion.pdf', ['Concept Overview']);

    t('v21.8 TOC Slicer (Lehne role precedence over Preface/sub-section Pathophysiology): resolves Lehne Pharmacotherapeutics and unprefixed Key Prescribing Considerations chapters to pharm-bridge while keeping unbranded Pathophysiology on patho-bridge and Giddens on rn',
      lehneMasterRole.roles[0] === 'pharm-bridge' &&
      lehneCh81Unprefixed.roles[0] === 'pharm-bridge' &&
      genericPathoRole.roles[0] === 'patho-bridge' &&
      giddensConceptRole.roles[0] === 'rn');

    t('v21.8 TOC Slicer (Lehne high-yield callout classification): maps plural Prototype Drugs, Black Box Warnings, and Drugs to Avoid -> prototype-drug; Key Prescribing Considerations, Across the Life Span, and Evaluating Treatment -> nursing-process; Key Points -> key-concepts',
      H.kbClassifyTocFeature('Prototype Drugs: Drugs for HIV Infection') === 'prototype-drug' &&
      H.kbClassifyTocFeature('Black Box Warning: Pramlintide') === 'prototype-drug' &&
      H.kbClassifyTocFeature('Drugs to Avoid') === 'prototype-drug' &&
      H.kbClassifyTocFeature('Summary of Key Prescribing Considerations: GLP-1 Receptor Agonists') === 'nursing-process' &&
      H.kbClassifyTocFeature('Patient-Centered Care Across the Life Span: Protease Inhibitors') === 'nursing-process' &&
      H.kbClassifyTocFeature('Evaluating Treatment') === 'nursing-process' &&
      H.kbClassifyTocFeature('Key Points') === 'key-concepts');

    // Execute live extracted KnowledgeBaseBuilder.addFiles against a mixed Giddens concept-sort folder packet
    const addFilesSpan = span('  const addFiles=fl=>', '  const importJSON=');
    let filesState = [];
    let rolesState = { 'Porth - Chapter 27 - Heart Failure.pdf:200:2': ['rn', 'patho-bridge'] }; // manual override must survive
    let conceptsState = 'Gas Exchange';
    const cardFileId = f => f.name + ':' + f.size + ':' + f.lastModified;
    const runAddFiles = new Function(
      'setFiles', 'setSourceRoles', 'setKbConcepts', 'cardFileId', 'kbInferUploadDropMeta', 'kbMergeConceptInput',
      addFilesSpan + '\n;return addFiles;'
    )(
      fn => { filesState = fn(filesState); },
      fn => { rolesState = fn(rolesState); },
      fn => { conceptsState = fn(conceptsState); },
      cardFileId,
      H.kbInferUploadDropMeta,
      H.kbMergeConceptInput
    );

    const dropPacket = [
      { name: 'Giddens - Concept 18 - Perfusion.pdf', size: 100, lastModified: 1, webkitRelativePath: '16 - Perfusion/01 - Foundations & AP/Giddens - Concept 18 - Perfusion.pdf' },
      { name: 'Porth - Chapter 27 - Heart Failure.pdf', size: 200, lastModified: 2 },
      { name: 'Porth - Chapter 28 - Dysrhythmias.pdf', size: 210, lastModified: 3 },
      { name: 'Lehne - Chapter 42 - Drugs for Heart Failure.pdf', size: 300, lastModified: 4 },
      { name: 'Jarvis - Ch 20 - Heart and Neck Vessels.pdf', size: 400, lastModified: 5 },
      { name: 'McCuistion - Chapter 42 - Antihypertensives.pdf', size: 500, lastModified: 6 },
      { name: 'Saunders - Chapter 53 - Cardiovascular Problems.pdf', size: 600, lastModified: 7 },
      { name: 'NUR221_Pathophysiology_Lecture_Slides.pptx', size: 700, lastModified: 8 },
    ];
    runAddFiles(dropPacket);

    t('v21.8 Step 01 Giddens Concept Sort Drop (addFiles + kbInferUploadDropMeta): auto-assigns pharm-bridge/patho-bridge/exam-bridge to Lehne/Porth/Jarvis, leaves Giddens/McCuistion/Saunders/lecture slides on default RN Core, preserves prior manual role overrides, and deduplicate-merges overarching Giddens concepts',
      filesState.length === 8 &&
      JSON.stringify(rolesState['Lehne - Chapter 42 - Drugs for Heart Failure.pdf:300:4']) === '["pharm-bridge"]' &&
      JSON.stringify(rolesState['Porth - Chapter 28 - Dysrhythmias.pdf:210:3']) === '["patho-bridge"]' &&
      JSON.stringify(rolesState['Jarvis - Ch 20 - Heart and Neck Vessels.pdf:400:5']) === '["exam-bridge"]' &&
      JSON.stringify(rolesState['Porth - Chapter 27 - Heart Failure.pdf:200:2']) === '["rn","patho-bridge"]' &&
      rolesState['McCuistion - Chapter 42 - Antihypertensives.pdf:500:6'] === undefined &&
      rolesState['Saunders - Chapter 53 - Cardiovascular Problems.pdf:600:7'] === undefined &&
      rolesState['Giddens - Concept 18 - Perfusion.pdf:100:1'] === undefined &&
      rolesState['NUR221_Pathophysiology_Lecture_Slides.pptx:700:8'] === undefined &&
      conceptsState === 'Gas Exchange, Perfusion');

    // 10. All 15 Digital Library (concept sort) resources + 04 · NCLEX Extractor Split Q&A bookmark auto-detection
    const klimekRole = H.kbSuggestTextbookRole('Klimek - Lecture 05 - Diabetes Mellitus, Insulins, DI, SIADH, DKA, and HHNS.pdf');
    const norrisRole = H.kbSuggestTextbookRole("Norris - Porth's Essentials of Pathophysiology 5e.pdf");
    const eckhardtRole = H.kbSuggestTextbookRole('Eckhardt - Physical Examination Abnormal Findings.pdf');
    const rosenthalRole = H.kbSuggestTextbookRole('Rosenthal & Burchum - Drug Therapy in Heart Failure.pdf');
    const silvestriRole = H.kbSuggestTextbookRole('Silvestri - Comprehensive NCLEX-RN Review.pdf');

    const qbankFilesSample = [
      'Davis Fundamentals - Ch 02 - Slice - Theory-Based Nursing Care Q&A.pdf',
      'Davis Med-Surg - Ch 03 - Slice - Congestive Heart Failure Q&A.pdf',
      'Davis Pharm - Ch 03 - Slice - Congestive Heart Failure Q&A.pdf',
      'Davis Psych - Chapter 07 - Depressive Disorders and the Suicidal Client Q&A.pdf',
      'Davis Maternal - Ch 02 - Slice - Genetics Q&A.pdf',
      'Davis Peds - Chapter 03 - Growth and Development Q&A.pdf',
      'Saunders Q&A 9e - 16 - Perfusion (Adult & Complex Care) Q&A.pdf',
      'LaCharity PDA - Case Study 15 - Heart Failure Q&A.pdf',
    ];
    const allQBanksDetected = qbankFilesSample.every(fn => {
      const det = H.kbDetectConceptSortQBank(fn);
      const role = H.kbSuggestTextbookRole(fn);
      return det && det.isQBank === true && role.isQBank === true && role.roles[0] === 'rn';
    });
    const nonQBankGuides = [
      'Davis Med-Surg - Appendices A-B - Normal Lab Values and Nursing Concept Care Map.pdf',
      'Davis Pharm - Appendix A - Drug Charts Reference.pdf',
      'LaCharity PDA - Part 1 - Prioritization, Delegation, and Assignment Guidelines.pdf',
      'Saunders Q&A 9e - Chapter 01 - Clinical Judgment and the NCLEX-RN Examination.pdf',
    ];
    const guidesStayReading = nonQBankGuides.every(fn => {
      const det = H.kbDetectConceptSortQBank(fn);
      return det && det.isQBank === false && !H.kbSuggestTextbookRole(fn).isQBank;
    });
    const qbankDropMeta = H.kbInferUploadDropMeta([
      { name: 'Saunders Q&A 9e - 18 - Gas Exchange (Pharmacology) Q&A.pdf', size: 120, lastModified: 10, webkitRelativePath: '18 - Gas Exchange/04 - Practice Questions/Saunders Q&A 9e - 18 - Gas Exchange (Pharmacology) Q&A.pdf' },
      { name: 'LaCharity PDA - Chapter 07 - Cardiovascular Problems Q&A.pdf', size: 130, lastModified: 11 },
    ], cardFileId);

    const nclexSplitSpan = span('function nclexMatchSplitTocSpans(', '/* ── END NCLEX EXTRACTOR PURE HELPERS ── */');
    const runInspectSplit = async fakeOutline => {
      const fakePdf = {
        numPages: 90,
        getOutline: async () => fakeOutline,
        getPageIndex: async refObj => refObj.p - 1,
        getDestination: async () => null,
      };
      const fn = new Function(
        'getPdfDoc', 'kbResolvePdfDestPage', 'kbBuildTocTree', 'kbDetectConceptSortQBank',
        nclexSplitSpan + '\n;return { nclexMatchSplitTocSpans, nclexInspectPdfSplitLayout };'
      )(async () => fakePdf, H.kbResolvePdfDestPage, H.kbBuildTocTree, H.kbDetectConceptSortQBank);
      return fn.nclexInspectPdfSplitLayout({ name: 'Saunders Q&A 9e - 16 - Perfusion (Adult & Complex Care) Q&A.pdf' });
    };
    const splitSaunders = await runInspectSplit([
      { title: 'Questions (1-67)', dest: [{ p: 1 }, { name: 'Fit' }], items: [] },
      { title: 'Answers & Rationales (1-67)', dest: [{ p: 24 }, { name: 'Fit' }], items: [] },
    ]);
    const splitLaCharityCase = await runInspectSplit([
      { title: 'Case Study & Questions', dest: [{ p: 1 }, { name: 'Fit' }], items: [] },
      { title: 'Answers & Rationales', dest: [{ p: 9 }, { name: 'Fit' }], items: [] },
    ]);

    t('v21.8 Digital Library (concept sort) 15-resource & author catalog + 04 · NCLEX Extractor Split Q&A bookmark auto-detection: maps all 7 core texts/authors and all 8 Q-banks (keeping Appendices/Guidelines non-Q-bank) and extracts exact Question/Answer page spans from PDF bookmarks',
      klimekRole.roles[0] === 'rn' && klimekRole.badge.includes('NCLEX Lecture') &&
      norrisRole.roles[0] === 'patho-bridge' &&
      eckhardtRole.roles[0] === 'exam-bridge' &&
      rosenthalRole.roles[0] === 'pharm-bridge' &&
      silvestriRole.roles[0] === 'rn' &&
      allQBanksDetected &&
      guidesStayReading &&
      qbankDropMeta.qbankFiles.length === 2 &&
      qbankDropMeta.concepts.join(',') === 'Gas Exchange' &&
      kbBuilderSpan.includes('Q-Bank → 04 · NCLEX Extract') &&
      splitSaunders.split &&
      JSON.stringify(splitSaunders.split.qRanges) === '[{"start":1,"end":23}]' &&
      JSON.stringify(splitSaunders.split.aRanges) === '[{"start":24,"end":90}]' &&
      splitSaunders.qbank.id === 'saunders-qa' &&
      splitLaCharityCase.split &&
      JSON.stringify(splitLaCharityCase.split.qRanges) === '[{"start":1,"end":8}]' &&
      JSON.stringify(splitLaCharityCase.split.aRanges) === '[{"start":9,"end":90}]');
  }
};
