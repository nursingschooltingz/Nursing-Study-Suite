'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cliSlicer = require('./pdf-toc-slice');
const { MEASUREMENT_SAFETY_SETTINGS, redactSecrets, cliRetryDelayMs } = require('./repo-checks');
const { extractBabelScript, bootSmoke, MAX_BABEL_SCRIPT_CHARS } = require('../verify-repo');

function makeIsoBmffBox(type, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.concat(payload);
  const hdr = Buffer.alloc(8);
  hdr.writeUInt32BE(8 + body.length, 0);
  hdr.write(type, 4, 4, 'ascii');
  return Buffer.concat([hdr, body]);
}

function makeIspeBox(width, height) {
  const payload = Buffer.alloc(12);
  payload.writeUInt32BE(0, 0); // version=0, flags=0
  payload.writeUInt32BE(width >>> 0, 4);
  payload.writeUInt32BE(height >>> 0, 8);
  return makeIsoBmffBox('ispe', payload);
}

function makeHeicHeader(ispeDimsList) {
  const ftypPayload = Buffer.alloc(12);
  ftypPayload.write('heic', 0, 4, 'ascii');
  ftypPayload.writeUInt32BE(0, 4);
  ftypPayload.write('mif1', 8, 4, 'ascii');
  const ftyp = makeIsoBmffBox('ftyp', ftypPayload);
  const ipco = makeIsoBmffBox('ipco', ispeDimsList.map(([w, h]) => makeIspeBox(w, h)));
  const iprp = makeIsoBmffBox('iprp', ipco);
  const metaFullHdr = Buffer.alloc(4, 0); // FullBox version/flags on meta
  const meta = makeIsoBmffBox('meta', [metaFullHdr, iprp]);
  return new Uint8Array(Buffer.concat([ftyp, meta]));
}

function makeExifPaddedJpeg(totalMetaBytes, width, height) {
  const segs = [Buffer.from([0xFF, 0xD8])];
  let rem = totalMetaBytes;
  while (rem > 0) {
    const chunk = Math.min(rem, 50000);
    const seg = Buffer.alloc(4 + chunk);
    seg[0] = 0xFF; seg[1] = 0xE1;
    seg.writeUInt16BE(chunk + 2, 2);
    segs.push(seg);
    rem -= chunk;
  }
  const sof0 = Buffer.from([
    0xFF, 0xC0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xFF, height & 0xFF,
    (width >> 8) & 0xFF, width & 0xFF,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xFF, 0xD9
  ]);
  segs.push(sof0);
  return Buffer.concat(segs);
}

function makePngHeader(width, height, totalBytes = 64) {
  const buf = Buffer.alloc(Math.max(32, totalBytes));
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 4, 'ascii');
  buf.writeUInt32BE(width >>> 0, 16);
  buf.writeUInt32BE(height >>> 0, 20);
  return buf;
}

module.exports = async function runV216ReviewRemediationTests(S, t) {
  function span(startAnchor, endAnchor, fromAnchor) {
    const base = fromAnchor ? S.indexOf(fromAnchor) : 0;
    if (base < 0) throw new Error('v21.6 fromAnchor missing: ' + fromAnchor);
    const a = S.indexOf(startAnchor, base);
    if (a < 0) throw new Error('v21.6 startAnchor missing: ' + startAnchor);
    const b = S.indexOf(endAnchor, a + startAnchor.length);
    if (b < 0) throw new Error('v21.6 endAnchor missing after ' + startAnchor + ': ' + endAnchor);
    return S.slice(a, b);
  }

  // ── 1. Step 1 (ISSUE-01): tools/pdf-toc-slice.js DoS hardening & shared HTML helper parity ──
  {
    const cliSrc = fs.readFileSync(path.join(__dirname, 'pdf-toc-slice.js'), 'utf8');
    const bombCompressed = zlib.deflateSync(Buffer.alloc(cliSlicer.MAX_PDF_META_STREAM_BYTES + 4096, 0));
    const bombPdf = Buffer.concat([
      Buffer.from(`%PDF-1.5\n1 0 obj\n<< /Filter /FlateDecode /Length ${bombCompressed.length} >>\nstream\n`, 'latin1'),
      bombCompressed,
      Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1')
    ]);
    const bombReader = new cliSlicer.PdfReader(bombPdf);
    // Force offset 1 into xref so getObject(1) attempts to inflate the bomb stream
    bombReader.xref.set(1, { type: 1, offset: bombPdf.indexOf('1 0 obj') });
    let bombRejected = false;
    try {
      bombReader.decompressStream(bombReader.getObject(1));
    } catch (e) {
      bombRejected = /exceeds 32 MB decompression limit|maxOutputLength|ERR_BUFFER_TOO_LARGE/i.test(String(e && (e.code || e.message || e)));
    }

    let badColsRejected = false, badColorsRejected = false, badBpcRejected = false;
    try { cliSlicer.applyPdfPredictor(Buffer.alloc(16), { Predictor: 12, Columns: 1000000000 }); } catch (e) { badColsRejected = /Invalid PDF predictor Columns/i.test(e.message); }
    try { cliSlicer.applyPdfPredictor(Buffer.alloc(16), { Predictor: 12, Columns: 4, Colors: 99 }); } catch (e) { badColorsRejected = /Invalid PDF predictor Colors/i.test(e.message); }
    try { cliSlicer.applyPdfPredictor(Buffer.alloc(16), { Predictor: 12, Columns: 4, Colors: 1, BitsPerComponent: 64 }); } catch (e) { badBpcRejected = /Invalid PDF predictor BitsPerComponent/i.test(e.message); }

    // Verify windowed fallbackScanObjects finds an object straddling the 8 MB window seam (8 * 1024 * 1024 - 5)
    const seamBuf = Buffer.alloc(8 * 1024 * 1024 + 512, 0x20);
    Buffer.from('%PDF-1.4\n', 'latin1').copy(seamBuf, 0);
    const seamPos = 8 * 1024 * 1024 - 4;
    Buffer.from('\n77 0 obj\n<< /Type /Catalog >>\nendobj\n', 'latin1').copy(seamBuf, seamPos);
    const seamReader = new cliSlicer.PdfReader(seamBuf);
    seamReader.fallbackScanObjects();

    t('v21.6 (ISSUE-01 — PDF CLI DoS hardening & helper deduplication): caps FlateDecode expansion at 32 MB, validates Predictor Columns/Colors/BPC, scans >8 MB files in windows across seams, and reuses canonical HTML TOC helpers',
      cliSlicer.MAX_PDF_META_STREAM_BYTES === 32 * 1024 * 1024 &&
      bombRejected &&
      badColsRejected &&
      badColorsRejected &&
      badBpcRejected &&
      seamReader.xref.has(77) &&
      seamReader.xref.get(77).offset === seamPos + 1 &&
      cliSrc.includes('function loadSuiteTocHelpers()') &&
      !cliSrc.includes('function kbSuggestTextbookRole(filename)'));
  }

  // ── 2. Step 2 & Step 6 (ISSUE-02, ISSUE-07, ISSUE-08): geminiRequest store:false + 400 fallback, 5 safety categories, JSON Content-Type under stream:true, & 180s SSE idle timeout ──
  {
    const transportSrc = span('const SAFETY_SETTINGS=[', '\n// PDF text extraction (shared)');
    const makeTransport = ({ fetchImpl, setTimeoutImpl }) => new Function(
      'MODEL_SETTINGS_DEFAULTS', 'THINKING_LEVELS', 'fetch', 'setTimeout', 'clearTimeout',
      transportSrc + '\nreturn { SAFETY_SETTINGS, redactApiSecrets, geminiRequest, callGemini, extractJSON };'
    )(
      { hydrogenModel: 'gemini-4-hydrogen', neonModel: 'gemini-4-neon' },
      ['minimal', 'low', 'medium', 'high', 'xhigh'],
      fetchImpl,
      setTimeoutImpl || setTimeout,
      clearTimeout
    );

    const sentBodies = [];
    let callNum = 0;
    const tr = makeTransport({
      fetchImpl: async (_url, opts) => {
        callNum++;
        const parsedBody = JSON.parse(opts.body);
        sentBodies.push(parsedBody);
        if (callNum === 1) {
          // Simulate an older/regional endpoint rejecting "store" with HTTP 400
          return {
            ok: false,
            status: 400,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: { message: 'Invalid JSON payload received. Unknown name "store": Cannot find field.' } })
          };
        }
        // Return a real Fetch-style JSON response that ALSO has body.getReader so stream:true Content-Type routing is exercised!
        return new Response(JSON.stringify({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 }
        }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }
    });

    const callerBody = { contents: [{ parts: [{ text: 'hello' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' }, responseMimeType: 'application/json' } };
    const resp1 = await tr.geminiRequest('AIzaSyTestKey1234567890123456', 'gemini-4-hydrogen', callerBody, { retries: 0, stream: true });
    const resp2 = await tr.geminiRequest('AIzaSyTestKey1234567890123456', 'gemini-4-hydrogen', callerBody, { retries: 0, stream: true });

    // Verify 900s initial arm -> 180s SSE inter-frame arm on streaming response
    const armedTimeouts = [];
    const trIdle = makeTransport({
      setTimeoutImpl: (fn, ms) => { armedTimeouts.push(ms); return 0; },
      fetchImpl: async () => {
        const chunk = new TextEncoder().encode('data: {"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"stream-ok"}]}}]}\n\n');
        let readCount = 0;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'text/event-stream' },
          body: {
            getReader: () => ({
              read: async () => (readCount++ === 0 ? { done: false, value: chunk } : { done: true, value: undefined }),
              cancel: async () => {},
              releaseLock: () => {}
            })
          }
        };
      }
    });
    const sseOut = await trIdle.geminiRequest('key-12345678', 'gemini-4-hydrogen', {
      contents: [{ parts: [{ text: 'sse' }] }],
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' } }
    }, { stream: true, timeoutMs: 900000 });

    t('v21.6 + v22.6 (ISSUE-02, ISSUE-07, ISSUE-08 — transport privacy, safety, & SSE routing): defaults store:false without mutating caller, auto-falls back on HTTP 400 rejecting store, drops deprecated CIVIC_INTEGRITY (4 active BLOCK_NONE categories), routes application/json under stream:true, and tightens SSE inter-frame timeout to 180s',
      tr.SAFETY_SETTINGS.length === 4 &&
      !tr.SAFETY_SETTINGS.some(s => s.category === 'HARM_CATEGORY_CIVIC_INTEGRITY') &&
      MEASUREMENT_SAFETY_SETTINGS.length === 4 &&
      !MEASUREMENT_SAFETY_SETTINGS.some(s => s.category === 'HARM_CATEGORY_CIVIC_INTEGRITY') &&
      callerBody.store === undefined &&
      sentBodies.length === 3 &&
      sentBodies[0].store === false &&
      sentBodies[1].store === undefined &&
      sentBodies[2].store === undefined &&
      resp1 === '{"ok":true}' &&
      resp2 === '{"ok":true}' &&
      sseOut === 'stream-ok' &&
      armedTimeouts[0] === 900000 &&
      armedTimeouts.includes(180000) &&
      S.includes('store: false'));

    // Also test extractJSON upgrades on the live extracted function
    const fencedJsonFirst = tr.extractJSON('Here is commentary:\n```\nnot json {broken\n```\nAnd the payload:\n```json\n{"picked":"json-fence"}\n```');
    const inlineAfterBracket = tr.extractJSON('Chunk [P1] anchor note: {"conditions":[{"name":"Sepsis"}]}');
    let outerMalformedThrew = false;
    try { tr.extractJSON('{bad: {"inner": 1}}'); } catch (e) { outerMalformedThrew = /Malformed JSON/i.test(e.message); }
    let nestedMismatchThrew = false;
    try { tr.extractJSON('{"arr": [1, 2}}'); } catch (e) { nestedMismatchThrew = /Malformed JSON/i.test(e.message); }

    t('v21.6 (ISSUE-03 — extractJSON fence priority, stack tracking, & inline recovery): prioritizes ```json over prose fences, recovers inline JSON after [P1] brackets, and rejects malformed outer envelopes or mismatched brackets',
      fencedJsonFirst.picked === 'json-fence' &&
      inlineAfterBracket.conditions[0].name === 'Sepsis' &&
      outerMalformedThrew &&
      nestedMismatchThrew);
  }

  // ── 3. Step 3 (ISSUE-05): ISO-BMFF HEIC/AVIF dimension probing, 512 KB slice, & single-read i2a buffer reuse ──
  {
    const imgSrc =
      span('const CARD_MIME=', '/* ── END KB & CARD PURE HELPERS ── */') + '\n' +
      'const I2A_MAX_RAW_BYTES=14*1024*1024;\n' +
      span('async function i2aFileKey(file){', 'const N2A_MODES=[');
    const IMG = new Function(
      'getExt', 'btoa',
      imgSrc + '\nreturn { probeImageDimensions, cardValidateImageSafety, i2aFileKey, i2aImagePayload };'
    )(
      name => (String(name || '').toLowerCase().match(/\.([^.]+)$/) || ['', ''])[1],
      str => Buffer.from(str, 'binary').toString('base64')
    );

    const normalHeic = makeHeicHeader([[4032, 3024]]);
    const bombHeicWithThumbFirst = makeHeicHeader([[320, 240], [10000, 10000]]);
    const d1 = IMG.probeImageDimensions(normalHeic);
    const d2 = IMG.probeImageDimensions(bombHeicWithThumbFirst);

    let heicBombRejected = false;
    try {
      await IMG.cardValidateImageSafety({
        name: 'bomb.heic',
        size: bombHeicWithThumbFirst.byteLength,
        slice: (a, b) => ({ arrayBuffer: async () => bombHeicWithThumbFirst.buffer.slice(a, b) })
      });
    } catch (e) {
      heicBombRejected = e.isSafetyLimit === true && /10000×10000/.test(e.message);
    }

    // 100 KB EXIF segment before a 10000x10000 JPEG SOF0 (>64 KB, <512 KB)
    const bigExifJpeg = makeExifPaddedJpeg(100 * 1024, 10000, 10000);
    let jpegExifBombRejected = false;
    try {
      await IMG.cardValidateImageSafety({
        name: 'exif-bomb.jpg',
        size: bigExifJpeg.length,
        slice: (a, b) => ({ arrayBuffer: async () => bigExifJpeg.subarray(a, b).buffer.slice(bigExifJpeg.byteOffset + a, bigExifJpeg.byteOffset + Math.min(b, bigExifJpeg.length)) })
      });
    } catch (e) {
      jpegExifBombRejected = e.isSafetyLimit === true && /10000×10000/.test(e.message);
    }

    // Oversized >25 MB file in i2aFileKey must not call arrayBuffer()
    let oversizeReadCount = 0;
    const oversizeKey = await IMG.i2aFileKey({
      name: 'huge.png',
      size: 30 * 1024 * 1024,
      lastModified: 99,
      arrayBuffer: async () => { oversizeReadCount++; return new ArrayBuffer(8); }
    });

    // Valid <=14 MB PNG read once across i2aFileKey + i2aImagePayload
    const pngBuf = makePngHeader(1200, 900, 128);
    let pngReadCount = 0, pngSliceCount = 0;
    const mockPngFile = {
      name: 'q1.png',
      size: pngBuf.length,
      lastModified: 42,
      arrayBuffer: async () => { pngReadCount++; return pngBuf.buffer.slice(pngBuf.byteOffset, pngBuf.byteOffset + pngBuf.byteLength); },
      slice: () => { pngSliceCount++; throw new Error('slice should not run when WeakMap buffer is cached'); }
    };
    const keyHex = await IMG.i2aFileKey(mockPngFile);
    const payload = await IMG.i2aImagePayload(mockPngFile);

    t('v21.6 (ISSUE-05 & ISSUE-17 — HEIC/JPEG bomb defense & single-read i2a WeakMap cache): probes ISO-BMFF max-area ispe, catches >64 MP after 100 KB EXIF via 512 KB slice, skips >25 MB arrayBuffer in i2aFileKey, and reads <=14 MB screenshots once',
      d1 && d1.width === 4032 && d1.height === 3024 &&
      d2 && d2.width === 10000 && d2.height === 10000 &&
      heicBombRejected &&
      jpegExifBombRejected &&
      oversizeReadCount === 0 &&
      oversizeKey.startsWith('oversize:huge.png:') &&
      /^[0-9a-f]{64}$/.test(keyHex) &&
      pngReadCount === 1 &&
      pngSliceCount === 0 &&
      payload.mimeType === 'image/png' &&
      Buffer.from(payload.data, 'base64').equals(pngBuf));
  }

  // ── 4. Step 4 (ISSUE-04): Step 01 manual PDF slice bounds validation against pdf.numPages ──
  {
    const tocSpan = span('function kbMergePageRanges(', '\n// Markdown to plain text');
    const buildSpan = span('const build=async()=>{', '\n  // v15.10: the diagnostics panel');
    const logs = [], warnings = [], chunkedRanges = [];
    const files = [
      { name: 'OutBounds.pdf', size: 1000, lastModified: 1, type: 'application/pdf' },
      { name: 'ClampBounds.pdf', size: 1000, lastModified: 2, type: 'application/pdf' },
    ];
    const runBuild = new Function(
      'tocCode', 'cfg', 'files', 'currentFiles', 'kbConfirmReplace', 'replacementSlot',
      'setBusy', 'setError', 'setWarnings', 'setProg', 'setDiag', 'setLogs', 'setSelected', 'addLog',
      'abortRef', 'kbOutcomes', 'kbPoints', 'kbExtra', 'focusMode',
      'kbConcepts', 'kbConceptAuto', 'kbExamTraps', 'kbPlateBridge', 'kbCapBridgeTier',
      'defaultSourceRoles', 'sourceRoles', 'sourcePageRanges', 'cardGate', 'cardIsImage', 'cardFileId',
      'getPdfDoc', 'kbBuildSourceChunks', 'probeComposition', 'destroyPdfDoc', 'chunkChars', 'overlapUnits', 'laneCount', 'verifyPass',
      'kbBuildFocusBlock', 'kbNormForMatch', 'kbDehyphNormForMatch', 'kbCanonOperators', 'kbClassifyQuoteMiss',
      'geminiRequest', 'KB_EXTRACTION_PROMPT', 'KB_VERIFY_PROMPT', 'kbValidateExtractionEnvelope', 'extractJSON',
      'kbSplitChunk', 'geminiHaltsBatch', 'kbQuoteInSource', 'kbQuoteOperatorsAgree', 'kbRunLanes', 'kbCompareOrder',
      'mergeLatteParts', 'course', 'exam', 'kbFlagUnderextraction', 'kbBucketGaps', 'K',
      `${tocSpan}\n${buildSpan}\nreturn build();`
    );

    const slot = { current: { start: () => ({ ctl: new AbortController() }), current: () => true, owns: () => true, finish: () => true } };
    await runBuild(
      '',
      { apiKey: 'k', autoProfile: true, forTool: () => ({ model: 'gemini-4-hydrogen', level: 'low' }) },
      files,
      { current: files },
      () => true,
      slot,
      () => {}, () => {}, w => warnings.push(...w), () => {}, () => {}, () => {}, () => {}, (m, lv) => logs.push({ m, lv }),
      { current: null }, '', '', '', 'prioritize',
      '', false, true, false, true,
      ['rn'], {}, { 'OutBounds.pdf:1000:1': '60-70', 'ClampBounds.pdf:1000:2': '45-60' },
      { buildable: [], blocked: [] }, () => false, f => `${f.name}:${f.size}:${f.lastModified}`,
      async () => ({ numPages: 50 }),
      async (f, _chars, _ov, opts) => { chunkedRanges.push({ name: f.name, ranges: opts.pageRanges }); return [{ label: 'pp. 45-50', text: 'Furosemide 40 mg IV.', units: [] }]; },
      false, () => {}, 15000, 1, 1, false,
      () => '', s => s, s => s, s => s, () => null,
      async () => JSON.stringify({ source: { filename: 'ClampBounds.pdf' }, conditions: [{ name: 'HF', aliases: [], facts: [{ text: 'Furosemide 40 mg IV.', latteBucket: 'Treat', tier: 1, sourceQuote: 'Furosemide 40 mg IV.' }] }] }),
      'PROMPT', 'VERIFY', x => x, JSON.parse,
      () => null, () => false, () => true, () => true,
      async (q, _w, worker, sig) => { while (q.length) await worker(q.shift(), sig); },
      () => 0,
      parts => ({ conditions: [{ id: 'c1', name: 'HF', facts: parts[0].conditions[0].facts }] }),
      '', '', s => s, () => [], { setKnowledgeBase: () => {} }
    );

    t('v21.6 (ISSUE-04 — Step 01 manual PDF slice bounds check): validates manual page slices against getPdfDoc(f).numPages, reports real PDF page count on out-of-bounds slices, and warns when clamping partial overflows',
      warnings.some(w => w.includes('OutBounds.pdf: invalid page slice "60-70" (PDF has 50 page(s))')) &&
      warnings.some(w => w.includes('ClampBounds.pdf: page slice "45-60" exceeded 50 PDF page(s) and was clamped to 45-50.')) &&
      chunkedRanges.length === 1 &&
      chunkedRanges[0].name === 'ClampBounds.pdf' &&
      JSON.stringify(chunkedRanges[0].ranges) === '[{"start":45,"end":50}]');
  }

  // ── 5. Step 5 & Step 9 (ISSUE-06, ISSUE-15): <500 KB Babel ceiling & bootSmoke TDZ component render gate ──
  {
    const babelScript = extractBabelScript(S);
    let over500kRejected = false;
    try {
      extractBabelScript('<script type="text/babel" data-presets="react">' + 'x'.repeat(MAX_BABEL_SCRIPT_CHARS + 1) + '</script>');
    } catch (e) {
      over500kRejected = /ceiling 500000/.test(e.message);
    }

    // Prove bootSmoke catches a TDZ ReferenceError inside a lazy-mounted tool component (GizmoImporter)
    const os = require('os');
    const babelPath = process.env.NSS_BABEL_STANDALONE || path.join(os.tmpdir(), 'nursing-study-suite-verify', 'node_modules', '@babel', 'standalone', 'babel.js');
    const Babel = require(babelPath);
    const mutatedBabel = babelScript.replace(
      'function GizmoImporter(){',
      'function GizmoImporter(){ const _tdzRead = _tdzVarBeforeInit; let _tdzVarBeforeInit = 1;'
    );
    const { code: mutatedCompiled } = Babel.transform(mutatedBabel, {
      presets: ['react'],
      plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
    });
    let tdzCaughtByBootSmoke = false;
    try {
      bootSmoke(mutatedCompiled, S);
    } catch (e) {
      tdzCaughtByBootSmoke = e instanceof ReferenceError || /ReferenceError|Cannot access '_tdzVarBeforeInit' before initialization/.test(String(e && (e.stack || e.message || e)));
    }

    t('v21.6 (ISSUE-06 & ISSUE-15 — <500 KB text/babel ceiling & bootSmoke component render gate): keeps text/babel strictly under 500 KB, rejects >500 KB regressions, and catches TDZ ReferenceErrors inside lazy-mounted tool components',
      babelScript.length < MAX_BABEL_SCRIPT_CHARS &&
      Buffer.byteLength(babelScript, 'utf8') < MAX_BABEL_SCRIPT_CHARS &&
      over500kRejected &&
      tdzCaughtByBootSmoke);
  }

  // ── 6. Step 6 (ISSUE-08): Structured JSON Schemas & CaseStudyGenerator static/dynamic prompt split ──
  {
    const schemas = new Function(
      span('const I2A_TRANSCRIBE_JSON_SCHEMA=', 'function i2aNormalizeTranscript(') + '\n' +
      span('const NG_REPAIR_JSON_SCHEMA=', 'function ngBuildRepairPrompt(') + '\n' +
      span('function caseSplitSystemPrompt(', 'function caseBuildRepairPrompt(') + '\n' +
      span('const GIZMO_RESPONSE_JSON_SCHEMA=', 'function gizmoCleanPlainText(') + '\n' +
      'return { I2A_TRANSCRIBE_JSON_SCHEMA, I2A_ANSWER_JSON_SCHEMA, NG_REPAIR_JSON_SCHEMA, CASE_REPAIR_JSON_SCHEMA, caseSplitSystemPrompt, GIZMO_RESPONSE_JSON_SCHEMA };'
    )();

    const sampleCasePrompt = 'You are an RN clinical educator.\nStatic rules here.\n\n═══ STAGE DEPENDENCY ═══\nCondition: Heart Failure\nFACT fact-1: Hold digoxin < 60 bpm.';
    const split = schemas.caseSplitSystemPrompt(sampleCasePrompt);

    t('v21.6 (ISSUE-08 — responseJsonSchema & caseSplitSystemPrompt): defines standard lowercase JSON Schemas across i2a, NCLEX repair, Case repair, and Gizmo, and splits static Case rules into systemInstruction losslessly',
      schemas.I2A_TRANSCRIBE_JSON_SCHEMA.type === 'object' &&
      schemas.I2A_ANSWER_JSON_SCHEMA.type === 'object' &&
      schemas.NG_REPAIR_JSON_SCHEMA.type === 'object' &&
      schemas.CASE_REPAIR_JSON_SCHEMA.type === 'object' &&
      schemas.GIZMO_RESPONSE_JSON_SCHEMA.type === 'object' &&
      split.systemInstruction === 'You are an RN clinical educator.\nStatic rules here.' &&
      split.userPrompt.startsWith('═══ STAGE DEPENDENCY ═══\nCondition: Heart Failure') &&
      split.systemInstruction + '\n\n' + split.userPrompt === sampleCasePrompt &&
      S.includes('systemInstruction:{parts:[{text:CARD_TRANSCRIBE_PROMPT}]}') &&
      S.includes('sys=I2A_TRANSCRIBE_PROMPT;') &&
      S.includes('sys=I2A_ANSWER_PROMPT;') &&
      S.includes('...(sys?{systemInstruction:sys}:{})'));
  }

  // ── 7. Step 7 (ISSUE-09, ISSUE-13): CSP script-src, DOMPurify fallback without document.write, secret scrubbing, & CLI hardening ──
  {
    const headHtml = S.slice(0, S.indexOf('</head>'));
    const neiaSrc = fs.readFileSync(path.join(__dirname, '..', 'neia-retest.js'), 'utf8');
    const davisSrc = fs.readFileSync(path.join(__dirname, '..', 'davis-transcribe-test.js'), 'utf8');
    const customKey = 'my+custom/key=12'; // 16 chars, URI-encodes differently
    const scrubbed = redactSecrets(
      `Failed at ?key=${encodeURIComponent(customKey)} with raw ${customKey} and token AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234`,
      customKey
    );
    const delayFromRetryInfo = cliRetryDelayMs({
      error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12.5s' }] }
    }, null, 2000, 0, () => 0);
    const delayFromHeader = cliRetryDelayMs({}, { get: h => (h.toLowerCase() === 'retry-after' ? '9' : null) }, 2000, 0, () => 0);

    t('v21.6 (ISSUE-09 & ISSUE-13 — CSP script-src, DOM sanitizer fallback, secret scrubbing, & CLI hardening): enforces script-src without document.write, scrubs >=8-char + URI-encoded keys, and hardens CLI timeouts/backoff/0600 reports',
      headHtml.includes("script-src 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net blob:;") &&
      headHtml.includes('<template id="dompurify-fallback">') &&
      headHtml.includes('function _renderSanitizerHaltBanner()') &&
      !/document\.write\(\s*['"<]/.test(headHtml) &&
      !scrubbed.includes(customKey) &&
      !scrubbed.includes(encodeURIComponent(customKey)) &&
      !scrubbed.includes('AIzaSy') &&
      delayFromRetryInfo >= 12500 &&
      delayFromHeader >= 9000 &&
      neiaSrc.includes('AbortSignal.timeout(') &&
      davisSrc.includes('AbortSignal.timeout(') &&
      neiaSrc.includes('writePrivateReport(') &&
      davisSrc.includes('writePrivateReport(') &&
      fs.readFileSync(path.join(__dirname, 'repo-checks.js'), 'utf8').includes('mode: 0o600'));
  }

  // ── 8. Step 8 & Step 9 (ISSUE-10, ISSUE-11, ISSUE-12, ISSUE-14, ISSUE-17): IndexedDB CAS fast-path, 2-lane split concurrency, live N2A reactivity, & single-slice useCappedLog ──
  {
    const idbSrc =
      span('const KB_DB_KEY=', 'function kbOpenDB(') + '\n' +
      span('const KB_META_KEY=', 'function kbReconcileStored(');
    let stringifyCalls = 0;
    const origStringify = JSON.stringify;
    const trackedJson = {
      parse: JSON.parse,
      stringify: (...args) => { stringifyCalls++; return origStringify(...args); }
    };
    const storeData = new Map();
    const getLog = [];
    const fakeDb = {};
    const makeIdbEnv = () => new Function(
      'JSON', 'kbOpenDB', 'kbRunTx', 'EMPTY_LATTE_KB',
      idbSrc + '\nreturn { kbDigest, kbStoredRecord, kbLoadPersisted, kbSavePersisted, KB_DB_KEY, KB_META_KEY };'
    )(
      trackedJson,
      async () => fakeDb,
      (_db, _mode, fn) => new Promise((resolve, reject) => {
        const store = {
          get(key) {
            getLog.push(key);
            const req = { result: storeData.get(key) };
            Promise.resolve().then(() => req.onsuccess && req.onsuccess());
            return req;
          },
          put(val, key) { storeData.set(key, val); },
          delete(key) { storeData.delete(key); }
        };
        try { fn(store, resolve); } catch (e) { reject(e); }
      }),
      { conditions: [] }
    );

    const IDB = makeIdbEnv();
    const kbSample = { conditions: [{ id: 'c1', name: 'Heart Failure', facts: [{ id: 'fact-1', text: 'Daily weights.' }] }] };
    const digest = IDB.kbDigest(origStringify(kbSample));
    const meta1 = { writer: 'tab-1', sequence: 1, digest };
    storeData.set(IDB.KB_DB_KEY, kbSample);
    storeData.set(IDB.KB_META_KEY, meta1);

    stringifyCalls = 0;
    const loaded = await IDB.kbLoadPersisted();
    const loadStringifies = stringifyCalls;

    // Fast-path save: expected carries matching writer + sequence + digest -> must NOT read KB_DB_KEY!
    getLog.length = 0;
    const meta2 = { writer: 'tab-1', sequence: 2, digest };
    await IDB.kbSavePersisted({ kb: kbSample, meta: meta2 }, loaded);
    const fastPathGets = [...getLog];

    // Conflict save: stale expected sequence -> falls back to reading KB_DB_KEY and throws KBConflict
    getLog.length = 0;
    let conflictCaught = false;
    try {
      await IDB.kbSavePersisted({ kb: kbSample, meta: { writer: 'tab-1', sequence: 3, digest } }, { kb: kbSample, meta: meta1 });
    } catch (e) {
      conflictCaught = e.name === 'KBConflict';
    }
    const conflictGets = [...getLog];

    // Test 2-lane split concurrency in kbRunLanes when queue starts with 1 chunk
    const { kbRunLanes } = new Function(span('async function kbRunLanes(', '// Verify a model-supplied verbatim quote') + '\nreturn { kbRunLanes };')();
    let activeNow = 0, peakActive = 0;
    const q = [{ id: 'root' }];
    await kbRunLanes(q, 2, async job => {
      activeNow++;
      if (activeNow > peakActive) peakActive = activeNow;
      await new Promise(r => setTimeout(r, 15));
      if (job.id === 'root') q.unshift({ id: 'half-1' }, { id: 'half-2' });
      activeNow--;
    }, new AbortController().signal);

    // Test useCappedLog single-slice reducer behavior
    const { useCappedLog } = new Function(
      'useState', 'useCallback',
      span('function useCappedLog(', '// ──── TOOL: Shared P-LATE Knowledge Base ────') + '\nreturn { useCappedLog };'
    )(
      init => {
        let state = init;
        const setState = updater => { state = typeof updater === 'function' ? updater(state) : updater; return state; };
        return [() => state, setState];
      },
      fn => fn
    );
    const [getCap3, pushCap3] = useCappedLog(3);
    pushCap3('a'); pushCap3('b'); pushCap3('c'); pushCap3('d');
    const [getCap1, pushCap1] = useCappedLog(1);
    pushCap1('x'); pushCap1('y');
    const [getCap0, pushCap0] = useCappedLog(0);
    pushCap0('z');

    t('v21.6 (ISSUE-10, ISSUE-11, ISSUE-12, ISSUE-14, ISSUE-17 — IDB CAS fast-path, 2-lane split concurrency, N2A live reactivity, & useCappedLog): stringifies once on IDB load, skips KB_DB_KEY read on matching CAS save while catching conflicts, runs split halves across 2 lanes, updates N2A deck/tags live, and caps logs in 1 allocation',
      loadStringifies === 1 &&
      fastPathGets.length === 1 && fastPathGets[0] === IDB.KB_META_KEY &&
      conflictCaught &&
      conflictGets.includes(IDB.KB_DB_KEY) &&
      peakActive === 2 &&
      getCap3().join(',') === 'b,c,d' &&
      getCap1().join(',') === 'y' &&
      getCap0().length === 0 &&
      (S.includes('const liveCards=useMemo(()=>{') || S.includes('const liveCards=useMemo(()=>n2aDeriveLiveCards(rawResult,liveExtraTags),[rawResult,liveExtraTags]);')) &&
      S.includes('kbProjectExamTraps._entryCache') &&
      S.includes('ngAllocateBatch._entryCache') &&
      S.includes('selectCaseFacts._entryCache') &&
      !S.includes('function runPointAnchorHarness'));
  }
};
