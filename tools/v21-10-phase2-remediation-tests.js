'use strict';

// v21.10 Phase 2 production code-review remediation regression suite:
// H1 (ngAnswerLabels / ngLetterNumberedOptions / ngShuffleWorksheetOptions ReDoS),
// H2 (CASE_CLINICAL_TOKEN_RE ReDoS),
// H3 (probeImageDimensions ISO-BMFF recursion/box caps, 64-bit hdr=16, compatible_brands),
// H4 + M18 (tools/pdf-toc-slice.js DoS caps, lazy CWD-independent helpers, filter rejection, PNG stride, CLI validation),
// H6 (.gitignore coverage for Course Brief, Case Packet .md/.json, and Case Study .json),
// H7 (redactSecrets ASCII boundaries & UI/CLI secret redaction),
// H8 (N2A_ANKI_HEADER CR/LF/TAB sanitization & RFC-4180 TSV quoting),
// H9 (renderKBMarkdown / caseToMarkdown HTML-tag escaping + lastIndexOf pagebreak splitting),
// H20 (recursive _kbSafeKeys, entity facts/pointAnchors caps, colon-free IDs, kbDedupEntities/kbFactView immutability, kbEntityValueTexts false/object handling),
// H22 + M17 (verify-repo.js SHA-256 integrity, private cache, direct npm-cli.js, tightened --out isProtectedFile),
// M16 (null-prototype maps & own-property guards across KB/Card/Anki/NCLEX/Case),
// M7 (CSP default-src 'none', referrer meta, deep-frozen sanitizer policies).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  BABEL_SHA256,
  PRIVATE_TOOL_ROOT,
  verifyBabelIntegrity,
} = require('../verify-repo');
const { redactSecrets, parseMeasurementArgs } = require('./repo-checks');
const pdfSlicer = require('./pdf-toc-slice');

function buildU32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function makeBox(type, payload, { use64 = false, hi = 0, loOverride = null } = {}) {
  const t = Buffer.from(type, 'ascii');
  if (use64) {
    const total = loOverride !== null ? loOverride : (16 + payload.length);
    return Buffer.concat([buildU32BE(1), t, buildU32BE(hi), buildU32BE(total), payload]);
  }
  return Buffer.concat([buildU32BE(8 + payload.length), t, payload]);
}

function makeFullBox(type, payload, opts) {
  return makeBox(type, Buffer.concat([Buffer.alloc(4), payload]), opts);
}

function makeIspe(w, h, opts) {
  return makeFullBox('ispe', Buffer.concat([buildU32BE(w), buildU32BE(h)]), opts);
}

module.exports = async function runV2110Phase2RemediationTests(S, t) {
  function span(start, end, fromAnchor) {
    const base = fromAnchor ? S.indexOf(fromAnchor) : 0;
    if (base < 0) throw new Error('v21.10 Phase 2 from-anchor missing: ' + fromAnchor);
    const a = S.indexOf(start, base);
    if (a < 0) throw new Error('v21.10 Phase 2 start anchor missing: ' + start);
    if (S.indexOf(start, a + start.length) >= 0) throw new Error('v21.10 Phase 2 start anchor ambiguous: ' + start);
    const b = S.indexOf(end, a + start.length);
    if (b < 0) throw new Error('v21.10 Phase 2 end anchor missing after: ' + start);
    return S.slice(a, b);
  }

  const POLICY = new Function(
    span('const STUDY_OUTPUT_POLICY=', '// navigator.clipboard requires') +
    '\nreturn { STUDY_OUTPUT_POLICY };'
  )();

  const KB = new Function(
    span('function kbBuildFocusBlock(', '// Underextraction flag:') + '\n' +
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') + '\n' +
    span('const KB_ENTITY_KINDS=', '\nfunction kbForNCLEX(') +
    '\nreturn { kbEntityValueTexts, normalizeKbEntities, kbDedupEntities, _kbSafeKeys, kbNormalizeImported, kbFactView, renderKBMarkdown };'
  )();

  const IMG = new Function(
    span('const CARD_MIME=', '/* ── END KB & CARD PURE HELPERS ── */') +
    '\nreturn { CARD_MIME, probeImageDimensions };'
  )();

  const ANKI = new Function(
    'uid',
    span('function ankiParseCards(raw', '/* ── END ANKI PURE HELPERS ── */') +
    '\nreturn { attachCoverageToCards, ankiLinkedIds, ANKI_TRAP_TAG_MAP, ankiStampTrapTags, ankiSourceLinkStatus, ankiSetSourceLinks, ankiRecallIssues };'
  )(() => 'synthetic-id');

  const N2A = new Function(
    span('// ──── TOOL: NCLEX to Anki ────', '/* ── END NCLEX TO ANKI PURE HELPERS ── */') +
    '\nreturn { N2A_ANKI_HEADER, n2aAnkiFileText, N2A_CARD_POLICY };'
  )();

  const NG = new Function(
    span('function ngSplitParts(', 'const NG_REPAIR_JSON_SCHEMA=') +
    '\nreturn { ngAnswerLabels, ngLetterNumberedOptions, ngShuffleWorksheetOptions, ngParseDistribution };'
  )();

  const CASE = new Function(
    'kbSourceText', 'LATTE_STANDARDS_VERSION',
    span('function selectCaseFacts(', 'const CASE_SLOPE_SYNC_RULES=') + '\n' +
    span('const CASE_CLINICAL_TOKEN_RE=', 'const CASE_CLINICAL_TERM_RE=') + '\n' +
    span('function caseToMarkdown(', '\nfunction casePacketToMarkdown(') +
    '\nreturn { selectCaseFacts, selectCaseFactsMulti, caseFactSufficiency, caseDifficultyBlock, CASE_CLINICAL_TOKEN_RE, caseToMarkdown, caseAuditPayload, caseSplitMarkdown };'
  )(() => '', 'test-standards');

  // 1. Extraction tail assertion
  t('v21.10 Phase 2 (Extraction tail): live H1–H9, H20, H22, M7, M16–M18 security helpers compile cleanly',
    typeof POLICY.STUDY_OUTPUT_POLICY === 'object' &&
    typeof KB.kbNormalizeImported === 'function' &&
    typeof KB.renderKBMarkdown === 'function' &&
    typeof IMG.probeImageDimensions === 'function' &&
    typeof ANKI.ankiRecallIssues === 'function' &&
    typeof N2A.n2aAnkiFileText === 'function' &&
    typeof NG.ngAnswerLabels === 'function' &&
    typeof CASE.caseSplitMarkdown === 'function' &&
    typeof verifyBabelIntegrity === 'function');

  // 2. H1 + H2 — Adversarial ReDoS timing checks (n = 40, < 50 ms each)
  {
    const timed = fn => {
      const t0 = performance.now();
      const value = fn();
      return { ms: performance.now() - t0, value };
    };
    const h1Comma = timed(() => NG.ngAnswerLabels('A' + ', A'.repeat(40) + 'X'));
    const h1Space = timed(() => NG.ngAnswerLabels('A' + ' ,  A'.repeat(40) + 'X'));
    const h1Oxford = NG.ngAnswerLabels('A, C, and E');

    const numWs = 'PART 1\nc\nPART 2\na\nPART 3\n1. Select items:\n  1. One\n  2. Two\n  3. Three\n  4. Four\nPART 4\n1. ANSWER: 1' + ', 1'.repeat(40) + 'X\nWhy 1 is correct: ok\nTags: Tier 1\n';
    const h1Num = timed(() => NG.ngLetterNumberedOptions(numWs));

    const shufWs = 'PART 1\nc\nPART 2\na\nPART 3\n1. Select items:\n  A. One\n  B. Two\n  C. Three\n  D. Four\nPART 4\n1. ANSWER: A' + ', A'.repeat(40) + 'X\nWhy A is correct: ok\nTags: Tier 1\n';
    const h1Shuf = timed(() => NG.ngShuffleWorksheetOptions(shufWs, () => 0.5));

    const h2a = timed(() => ('5 mg²' + ' per  ²'.repeat(40)).match(CASE.CASE_CLINICAL_TOKEN_RE));
    const h2b = timed(() => ('5 mg' + ' per  ²'.repeat(40)).match(CASE.CASE_CLINICAL_TOKEN_RE));
    const h2Valid = 'Infuse 5 mg per kg per min IV.'.match(CASE.CASE_CLINICAL_TOKEN_RE);

    t('v21.10 Phase 2 (H1 & H2 — ReDoS remediation): ngAnswerLabels, ngLetterNumberedOptions, ngShuffleWorksheetOptions, and CASE_CLINICAL_TOKEN_RE finish in <50 ms on n=40 adversarial inputs while preserving valid parses',
      h1Comma.ms < 50 && h1Space.ms < 50 && h1Num.ms < 50 && h1Shuf.ms < 50 &&
      h2a.ms < 50 && h2b.ms < 50 &&
      h1Oxford.join(',') === 'A,C,E' &&
      Array.isArray(h2Valid) && h2Valid[0] === '5 mg per kg per min');
  }

  // 3. H3 — HEIC/AVIF probeImageDimensions recursion/box caps, 64-bit hdr=16, and compatible_brands
  {
    const ftypHeic = makeBox('ftyp', Buffer.from('heic\0\0\0\0mif1heic', 'ascii'));
    // Deeply nested 40-level iprp boxes (would blow deeper recursion / excessive box scans)
    let deepInner = makeIspe(100, 100);
    for (let i = 0; i < 40; i++) deepInner = makeBox('iprp', deepInner);
    const deepBuf = Buffer.concat([ftypHeic, deepInner]);
    let deepSafe = true;
    try { IMG.probeImageDimensions(new Uint8Array(deepBuf)); } catch { deepSafe = false; }

    // 64-bit sz===1 with hi > 0 on ispe FullBox (previously kept hdr=8 and misread dimensions)
    const box64 = makeIspe(10000, 10000, { use64: true, hi: 1, loOverride: 0 });
    const meta64 = makeFullBox('meta', makeBox('iprp', makeBox('ipco', box64)));
    const dims64 = IMG.probeImageDimensions(new Uint8Array(Buffer.concat([ftypHeic, meta64])));

    // Compatible brand detection when major_brand is iso8 but compatible_brands includes avif
    const ftypCompat = makeBox('ftyp', Buffer.from('iso8\0\0\0\0mp41avif', 'ascii'));
    const metaCompat = makeFullBox('meta', makeBox('iprp', makeBox('ipco', makeIspe(4000, 3000))));
    const dimsCompat = IMG.probeImageDimensions(new Uint8Array(Buffer.concat([ftypCompat, metaCompat])));

    t('v21.10 Phase 2 (H3 — HEIC/AVIF probeImageDimensions): survives deep nesting without stack overflow, parses 64-bit sz=1 hi>0 ispe boxes with hdr=16, and detects ftyp compatible_brands',
      deepSafe &&
      dims64 && dims64.width === 10000 && dims64.height === 10000 &&
      dimsCompat && dimsCompat.width === 4000 && dimsCompat.height === 3000);
  }

  // 4. H4 + M18 — tools/pdf-toc-slice.js DoS caps, CWD independence, unsupported filter, PNG stride, CLI parsing
  {
    // CWD independence + lazy require outside repo root
    const slicerAbs = path.resolve(__dirname, 'pdf-toc-slice.js');
    const cwdRun = spawnSync(process.execPath, [
      '-e',
      `process.chdir(${JSON.stringify(os.tmpdir())}); const p = require(${JSON.stringify(slicerAbs)}); console.log(p.formatPageRanges(p.mergePageRanges([{start:1,end:3},{start:4,end:5}])));`
    ], { encoding: 'utf8' });

    // Deep nested array DoS cap
    const deepPdf = Buffer.from('%PDF-1.4\n1 0 obj\n' + '['.repeat(200) + ']'.repeat(200) + '\nendobj\nstartxref\n9\n%%EOF\n', 'latin1');
    let deepRejected = false;
    try {
      const r = new pdfSlicer.PdfReader(deepPdf);
      r.readIndirectAt(deepPdf.indexOf('1 0 obj'));
    } catch (e) {
      deepRejected = /nesting depth exceeds safety limit/i.test(String(e && e.message));
    }

    // Classic XRef huge count at EOF breaks immediately
    const eofXrefPdf = Buffer.from('%PDF-1.4\nxref\n0 2000000000\nstartxref\n9\n%%EOF\n', 'latin1');
    const tXref = performance.now();
    new pdfSlicer.PdfReader(eofXrefPdf);
    const xrefMs = performance.now() - tXref;

    // Compressed XRef /W [0 0 0] throws instead of spinning
    const wZeroBody = Buffer.from('00000000', 'hex');
    const wZeroOff = '%PDF-1.5\n'.length;
    const wZeroPdf = Buffer.concat([
      Buffer.from(`%PDF-1.5\n1 0 obj\n<< /Type /XRef /Size 1000 /W [0 0 0] /Length ${wZeroBody.length} >>\nstream\n`, 'latin1'),
      wZeroBody,
      Buffer.from(`\nendstream\nendobj\nstartxref\n${wZeroOff}\n%%EOF\n`, 'latin1'),
    ]);
    let wZeroRejected = false;
    try { new pdfSlicer.PdfReader(wZeroPdf); } catch (e) { wZeroRejected = /Invalid PDF XRef \/W/i.test(String(e && e.message)); }

    // ObjStm huge /N rejected
    const objStmPdf = Buffer.from('%PDF-1.5\n1 0 obj\n<< /Type /ObjStm /N 1000000000 /First 0 /Length 0 >>\nstream\n\nendstream\nendobj\n%%EOF\n', 'latin1');
    const objStmReader = new pdfSlicer.PdfReader(objStmPdf);
    objStmReader.xref.set(1, { type: 1, offset: objStmPdf.indexOf('1 0 obj') });
    let objStmRejected = false;
    try { objStmReader.getObjectFromStream(1, 0); } catch (e) { objStmRejected = /object stream \/N exceeds safety limit/i.test(String(e && e.message)); }

    // toAlphaLabel capped at 20 repeats
    const alphaHuge = pdfSlicer.toAlphaLabel(1e9, true);

    // PNG predictor stride check (data.length === rowBytes < stride)
    let strideRejected = false;
    try { pdfSlicer.applyPdfPredictor(Buffer.alloc(4), { Predictor: 12, Columns: 4, Colors: 1, BitsPerComponent: 8 }); } catch (e) {
      strideRejected = /row width exceeds stream bounds/i.test(String(e && e.message));
    }

    // Unsupported non-Flate stream filter throws explicitly
    let filterRejected = false;
    try {
      objStmReader.decompressStream({ dict: { Filter: { kind: 'name', value: 'ASCIIHexDecode' } }, rawStream: Buffer.from('4142>', 'latin1') });
    } catch (e) {
      filterRejected = /Unsupported PDF stream filter: ASCIIHexDecode/i.test(String(e && e.message));
    }

    // CLI strict integer / duplicate / '--' parsing
    const throws = fn => { try { fn(); return false; } catch { return true; } };
    const cliStrict =
      throws(() => pdfSlicer.parseCli(['book.pdf', '--pad', '2.9'])) &&
      throws(() => pdfSlicer.parseCli(['book.pdf', '--pad', ''])) &&
      throws(() => pdfSlicer.parseCli(['book.pdf', '--pad', '1', '--pad', '2'])) &&
      throws(() => pdfSlicer.parseCli(['book.pdf', '--depth', '3.5'])) &&
      pdfSlicer.parseCli(['--', '-weird.pdf']).file === '-weird.pdf';

    t('v21.10 Phase 2 (H4 & M18 — pdf-toc-slice.js hardening): works outside repo CWD, caps nesting/XRef/ObjStm/PageLabels/150MB file size, rejects /W [0 0 0], checks PNG stride, fails on non-Flate filters, and strictly parses CLI flags',
      cwdRun.status === 0 && String(cwdRun.stdout || '').trim() === '1-5' &&
      deepRejected &&
      xrefMs < 50 &&
      wZeroRejected &&
      objStmRejected &&
      alphaHuge.length === 20 &&
      strideRejected &&
      filterRejected &&
      cliStrict &&
      pdfSlicer.MAX_PDF_FILE_BYTES === 150 * 1024 * 1024);
  }

  // 5. H6 — .gitignore ignores all 4 newly protected export patterns
  {
    const targets = [
      'NURS_210-Exam_2-Course-Brief.md',
      'LATTE-Case-Packet-4-Cases.md',
      'LATTE-Case-Packet-4-Cases.json',
      'LATTE-Case-Study.json',
      'LATTE-Case-Study-Heart_Failure.json',
    ];
    const res = spawnSync('git', ['check-ignore', '--stdin', '--no-index'], {
      cwd: path.resolve(__dirname, '..'),
      input: targets.join('\n') + '\n',
      encoding: 'utf8',
    });
    const ignored = new Set(String(res.stdout || '').split(/\r?\n/).filter(Boolean));
    t('v21.10 Phase 2 (H6 — .gitignore copyright boundary): ignores Course Brief .md, Case Packet .md/.json, and Case Study .json exports',
      !res.error && targets.every(name => ignored.has(name)));
  }

  // 6. H7 — CLI redactSecrets boundary fix & UI/CLI secret redaction wiring
  {
    const k1 = 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234';
    const k2 = 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123-';
    const r1 = redactSecrets('err api_key_' + k1 + ' failed', '');
    const r2 = redactSecrets('url?key=' + k2 + ' 403', '');
    const neiaSrc = fs.readFileSync(path.resolve(__dirname, '..', 'neia-retest.js'), 'utf8');
    const davisSrc = fs.readFileSync(path.resolve(__dirname, '..', 'davis-transcribe-test.js'), 'utf8');
    t('v21.10 Phase 2 (H7 — Secret redaction): redactSecrets catches underscore-prefixed and trailing-hyphen AIza keys, and UI/ErrorBoundaries/CLIs route errors through secret redaction',
      !r1.includes('AIzaSy') && r1.includes('[REDACTED_GEMINI_KEY]') &&
      !r2.includes('AIzaSy') && r2.includes('[REDACTED_GEMINI_KEY]') &&
      /console\.error\(redactSecrets\(/.test(neiaSrc) &&
      /console\.error\(redactSecrets\(/.test(davisSrc) &&
      S.includes("const errorText=e=>redactApiSecrets(e?.message||e||'Source check failed.',apiKey);") &&
      S.includes('repairAttempt:re') &&
      S.includes('{redactApiSecrets(this.state.error?.message||String(this.state.error))}'));
  }

  // 7. H22 + M17 — verify-repo.js SHA-256/private cache/no cmd.exe + tightened --out isProtectedFile
  {
    const verifySrc = fs.readFileSync(path.resolve(__dirname, '..', 'verify-repo.js'), 'utf8');
    const activeBabel = process.env.NSS_BABEL_STANDALONE;
    const realOk = Boolean(activeBabel) && verifyBabelIntegrity(activeBabel) === BABEL_SHA256;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nss-babel-hash-'));
    const badBabel = path.join(tmpDir, 'babel.js');
    fs.writeFileSync(badBabel, '// tampered babel\n', 'utf8');
    let tamperedRejected = false;
    try { verifyBabelIntegrity(badBabel); } catch (e) { tamperedRejected = /Babel integrity check failed/i.test(String(e && e.message)); }
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const rejectsOut = outPath => {
      try { parseMeasurementArgs(['--out', outPath], 'neia'); return false; }
      catch (e) { return /--out cannot overwrite/.test(String(e && e.message)); }
    };
    const allowsOut = outPath => {
      try { return parseMeasurementArgs(['--out', outPath], 'neia').out === outPath; }
      catch { return false; }
    };

    t('v21.10 Phase 2 (H22 & M17 — Verifier integrity & --out guard): verifies pinned Babel SHA-256, uses user-private cache without cmd.exe, and blocks --out overwrites of tools/, docs/, dotfiles, LICENSE, and repo JSON manifests',
      realOk &&
      tamperedRejected &&
      !PRIVATE_TOOL_ROOT.startsWith(os.tmpdir()) &&
      !/ComSpec|npm\.cmd/.test(verifySrc) &&
      verifySrc.includes('npm-cli.js') &&
      rejectsOut('tools/fixtures/anki-v166-quality-cases.json') &&
      rejectsOut('.gitignore') &&
      rejectsOut('LICENSE') &&
      rejectsOut('docs/anything.json') &&
      rejectsOut('prompt-baseline.json') &&
      rejectsOut('package.json') &&
      allowsOut('neia-retest-report.json') &&
      allowsOut('davis-report.json'));
  }

  // 8. H8 — N2A_ANKI_HEADER CR/LF/TAB sanitization & RFC-4180 TSV quoting
  {
    const hdr = N2A.N2A_ANKI_HEADER('Cardio\n#notetype:Cloze\r#separator:comma\tbad');
    const deckLine = hdr.find(l => l.startsWith('#deck:'));
    const rawTsv = N2A.n2aAnkiFileText(
      [{ front: '<div style="color:red">Stem\t1\n2</div>', back: 'Key "B"', tags: ['T1\nInjected'], guid: 'g1' }],
      'Deck\n#html:false',
      false
    );
    const lines = rawTsv.trimEnd().split('\n');
    const cols = lines[6].split('\t');
    const fixTsv = N2A.n2aAnkiFileText(
      [{ front: '<div style="color:red">Stem</div>', back: 'Key', tags: ['T1'], guid: 'g1' }],
      '   \n\t  ',
      true
    );
    t('v21.10 Phase 2 (H8 — Anki TSV injection & quoting): strips CR/LF/TAB from #deck and cells, defaults blank deck to NCLEX, and RFC-4180 quotes double-quoted cells when quoteFix is false',
      !/[\r\n\t]/.test(deckLine) &&
      lines.length === 7 &&
      cols.length === 4 &&
      cols[0] === '"<div style=""color:red"">Stem 1 2</div>"' &&
      cols[1] === '"Key ""B"""' &&
      fixTsv.includes('#deck:NCLEX\n') &&
      fixTsv.includes("style='color:red'"));
  }

  // 9. H9 — renderKBMarkdown & caseToMarkdown HTML tag escaping + lastIndexOf pagebreak splitting
  {
    const evilKb = {
      conditions: [{
        id: 'hf',
        name: 'Heart Failure <img src=x onerror=1>',
        facts: [
          { id: 'f1', latteBucket: 'Look', tier: 1, text: 'Hold if HR < 60 bpm or UOP <30 mL/hr or <= 18; monitor <q4h and avoid <script>alert(1)</script>.', sources: [{ filename: 'book.pdf', location: 'p. 1' }] },
          { id: 'f2', latteBucket: 'Treat', tier: 2, clinicalLayer: 'bridge', text: 'Escape attempt </details><img src=x onerror=2> here.', sources: [] },
        ]
      }]
    };
    const kbMd = KB.renderKBMarkdown(evilKb);

    const evilCase = {
      title: 'Case <script>x</script>',
      condition: 'HF',
      difficulty: 'exam',
      patient: { age: 68, sex: 'F', background: 'History <img src=x onerror=3>' },
      stages: [
        {
          stageNumber: 1,
          title: 'Initial',
          narrative: 'Client arrives.\n<div class="pagebreak"></div>\n\nStill Stage 1 narrative with BP < 90 mmHg and UOP <30 mL/hr.',
          data: [{ label: 'Vitals', value: 'HR < 60 bpm; <q4h check', factIds: ['fact-1'] }],
          questions: [{
            id: 'q1', type: 'MCQ', stem: 'Which action next? <img src=x onerror=4>',
            options: [{ label: 'A', text: 'Act A' }, { label: 'B', text: 'Act B' }],
            correctAnswers: ['A'],
            rationales: [{ option: 'A', text: 'Hold if HR < 60 bpm.', factIds: ['fact-1'] }]
          }]
        }
      ],
      debrief: { priorityProblem: 'Fluid overload <script>z</script>', keyDecisions: ['Check <q4h'], notes: 'Done' }
    };
    const caseMd = CASE.caseToMarkdown(evilCase);
    const split = CASE.caseSplitMarkdown(evilCase);
    const payload = CASE.caseAuditPayload(evilCase, 1, evilCase.stages[0].questions[0]);

    t('v21.10 Phase 2 (H9 — Markdown HTML escaping & pagebreak split): escapes HTML tags (<script>, <img...>, </details>, <q4h) while preserving clinical < 60 bpm / <30 mL/hr comparators and using lastIndexOf for structural pagebreaks',
      !kbMd.includes('<script>') && !kbMd.includes('<img ') &&
      kbMd.includes('&lt;script>') && kbMd.includes('&lt;/details>') && kbMd.includes('&lt;q4h') &&
      kbMd.includes('HR < 60 bpm') && kbMd.includes('<30 mL/hr') && kbMd.includes('<= 18') &&
      kbMd.includes('<details open><summary><strong>') &&
      !caseMd.includes('<script>') && !caseMd.includes('<img ') &&
      caseMd.includes('BP < 90 mmHg') && caseMd.includes('<30 mL/hr') && caseMd.includes('&lt;q4h') &&
      split.worksheet.includes('Still Stage 1 narrative') &&
      split.worksheet.includes('Which action next?') &&
      !split.keyAndDebrief.includes('Which action next?') &&
      split.keyAndDebrief.startsWith('## Answer Key') &&
      payload.includes('Still Stage 1 narrative') &&
      !payload.includes('## Answer Key'));
  }

  // 10. H20 — kbEntityValueTexts, kbDedupEntities immutability, deep _kbSafeKeys, intake caps, colon-free IDs, kbFactView immutability
  {
    const valFalse = KB.kbEntityValueTexts(false);
    const valObj = KB.kbEntityValueTexts({ male: '14-18 g/dL', female: '12-16 g/dL' });
    const normFalse = KB.normalizeKbEntities({
      conditions: [],
      medications: [{ name: 'Furosemide', blackBoxWarnings: false, therapeuticRange: { male: '14-18', female: '12-16' } }],
      diagnostics: [],
      scoringTools: []
    }).kb;

    // kbDedupEntities must not mutate untouched diagnostics collection's f.id in place
    const diagFact = { id: 'fact-99', latteBucket: 'Analyze', tier: 1, text: 'BNP > 100 pg/mL.', sources: [] };
    const origKb = {
      conditions: [{ id: 'hf', name: 'HF', aliases: [], facts: [{ id: 'fact-1', latteBucket: 'Look', tier: 1, text: 'Edema.', sources: [] }] }],
      medications: [
        { name: 'Furosemide', aliases: [], facts: [{ id: 'fact-2', latteBucket: 'Treat', tier: 1, text: 'Loop diuretic.', sources: [] }] },
        { name: 'Furosemide', aliases: ['Lasix'], facts: [{ id: 'fact-3', latteBucket: 'Treat', tier: 1, text: 'Monitor K+.', sources: [] }] },
      ],
      diagnostics: [{ name: 'BNP', aliases: [], facts: [diagFact] }],
      scoringTools: []
    };
    const deduped = KB.kbDedupEntities(origKb);

    // Deep _kbSafeKeys + intake caps + colon-free imported condition ID
    const hostileJson = JSON.parse('{"conditions":[{"id":"medications:0","name":"HF","facts":[{"text":"Edema.","tier":1,"latteBucket":"Look","sources":[{"filename":"a.pdf","location":"p.1","__proto__":{"p":1}}]}]}],"medications":[{"name":"Drug","facts":[{"text":"Dose.","tier":1,"latteBucket":"Treat","sources":[],"__proto__":{"p":2}}]}],"formulas":[{"name":"MAP","__proto__":{"p":3}}],"sources":[{"filename":"a.pdf","__proto__":{"p":4}}]}');
    const imp = KB.kbNormalizeImported(hostileJson);
    const hasOwnProto = o => Boolean(o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, '__proto__'));

    let anchorCapRejected = false;
    try {
      KB.kbNormalizeImported({
        conditions: [{ id: 'hf', name: 'HF', facts: [{ text: 'Edema.', tier: 1, latteBucket: 'Look', sources: [], pointAnchors: Array.from({ length: 201 }, (_, i) => 'P' + (i + 1)) }] }]
      });
    } catch (e) { anchorCapRejected = /import limit is 200/i.test(String(e && e.message)); }

    let entityFactCapRejected = false;
    try {
      KB.kbNormalizeImported({
        conditions: [{ id: 'hf', name: 'HF', facts: [{ text: 'Edema.', tier: 1, latteBucket: 'Look', sources: [] }] }],
        medications: [{ name: 'Drug', facts: Array.from({ length: 5001 }, (_, i) => ({ text: 'F' + i, tier: 1, latteBucket: 'Treat', sources: [] })) }]
      });
    } catch (e) { entityFactCapRejected = /import limit is 5000/i.test(String(e && e.message)); }

    // kbFactView must not mutate caller kb.conditions[0]
    const rawCond = { id: 'hf', name: 'HF', facts: [{ id: 'fact-1', latteBucket: 'Look', tier: 1, text: 'Edema.' }] };
    const view1 = KB.kbFactView({ conditions: [rawCond] });

    t('v21.10 Phase 2 (H20 — KB intake & immutability): skips false booleans & preserves nested keys, clones untouched collections in kbDedupEntities, deep-scrubs __proto__, caps pointAnchors/entity facts, strips colons from imported IDs, and keeps kbFactView non-mutating',
      valFalse.length === 0 &&
      valObj[0] === 'male: 14-18 g/dL — female: 12-16 g/dL' &&
      !(normFalse.medications[0].facts || []).some(f => /boxed warning/i.test(f.text)) &&
      diagFact.id === 'fact-99' &&
      deduped.diagnostics[0].facts[0] !== diagFact &&
      imp.kb.conditions[0].id === 'medications-0' &&
      !hasOwnProto(imp.kb.conditions[0].facts[0].sources[0]) &&
      !hasOwnProto(imp.kb.medications[0].facts[0]) &&
      !hasOwnProto(imp.kb.formulas[0]) &&
      !hasOwnProto(imp.kb.sources[0]) &&
      anchorCapRejected &&
      entityFactCapRejected &&
      !Object.prototype.hasOwnProperty.call(rawCond, '_kbGroups') &&
      Array.isArray(view1.conditions[0]._kbGroups));
  }

  // 11. M16 + M7 — Null-prototype maps, own-property snapshot guards, CSP default-src 'none', referrer meta, deep-frozen policies
  {
    const plainSnap = { facts: [{ id: 'fact-1', text: 'Normal K+ 3.5-5.0 mEq/L.', condition: 'HF', aliases: [] }], byId: { 'fact-1': { id: 'fact-1', text: 'Normal K+ 3.5-5.0 mEq/L.', condition: 'HF', aliases: [] } } };
    const fakeCard = { id: 'n1', chunk: 1, sourceLine: 1, text: 'K+ {{c1::3.5}}.', extra: '', tags: 'Tier::1', pipeCount: 2, factIds: ['toString'], mappingIssues: [] };
    const recallProto = ANKI.ankiRecallIssues({ ...fakeCard, extra: 'Текст' }, plainSnap);
    let setLinksRejected = false;
    try { ANKI.ankiSetSourceLinks(fakeCard, ['toString'], plainSnap); } catch { setLinksRejected = true; }
    const trapStamped = ANKI.ankiStampTrapTags(
      [{ ...fakeCard, factIds: ['fact-1'] }],
      { facts: [{ id: 'fact-1', trapRole: 'toString' }], byId: { 'fact-1': { id: 'fact-1', trapRole: 'toString' } } }
    );
    const selProto = CASE.selectCaseFacts({ id: 'c1', name: 'Test', facts: [{ id: 'f1', tier: 1, latteBucket: 'toString', text: 'Safe.' }] });
    const suffProto = CASE.caseFactSufficiency([{ id: 'f1', tier: 1, latteBucket: 'toString', text: 'Safe.' }], 2);
    const diffProto = CASE.caseDifficultyBlock('toString');
    const headHtml = S.slice(0, S.indexOf('</head>'));

    t('v21.10 Phase 2 (M16 & M7 — Prototype-chain defense & CSP/policy hardening): blocks prototype keys across CARD_MIME, ANKI_TRAP_TAG_MAP, snapshot.byId, selectCaseFacts, caseFactSufficiency, and caseDifficultyBlock; enforces default-src none, referrer no-referrer, and deep-frozen sanitizer policies',
      Object.getPrototypeOf(IMG.CARD_MIME) === null && IMG.CARD_MIME.toString === undefined &&
      Object.getPrototypeOf(ANKI.ANKI_TRAP_TAG_MAP) === null && ANKI.ANKI_TRAP_TAG_MAP.toString === undefined &&
      ANKI.ankiLinkedIds(fakeCard, plainSnap).length === 0 &&
      ANKI.ankiSourceLinkStatus(fakeCard, plainSnap).code === 'unmapped' &&
      !recallProto.some(i => i.code === 'unexpected-script') &&
      setLinksRejected &&
      !trapStamped[0].tags.includes('Trap::') &&
      Array.isArray(selProto) &&
      suffProto.byBucket.toString === 1 &&
      Object.getPrototypeOf(suffProto.byBucket) === null &&
      diffProto.includes('integrate at least TWO revealed cues') &&
      headHtml.includes('<meta name="referrer" content="no-referrer" />') &&
      headHtml.includes("default-src 'none';") &&
      Object.isFrozen(POLICY.STUDY_OUTPUT_POLICY) &&
      Object.isFrozen(POLICY.STUDY_OUTPUT_POLICY.ALLOWED_TAGS) &&
      Object.isFrozen(POLICY.STUDY_OUTPUT_POLICY.ALLOWED_ATTR) &&
      Object.isFrozen(N2A.N2A_CARD_POLICY) &&
      Object.isFrozen(N2A.N2A_CARD_POLICY.ALLOWED_TAGS) &&
      Object.isFrozen(N2A.N2A_CARD_POLICY.ALLOWED_ATTR));
  }
};
