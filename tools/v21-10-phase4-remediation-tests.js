'use strict';

// v21.10 Phase 4 production code-review remediation regression suite (H5, H21, M3, M4, M14, M15).
// Exercises live extracted functions from Nursing-Study-Suite v21.10.html directly — zero mocked
// clones — with strict unique-anchor checks and non-vacuous tail assertions.

module.exports = async function runPhase4RemediationTests(S, t) {
  const span = (a, b) => {
    const x = S.indexOf(a);
    if (x < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous Phase 4 start anchor: ' + a);
    const y = S.indexOf(b, x + a.length);
    if (y < 0) throw new Error('Missing Phase 4 end anchor: ' + b + ' after ' + a);
    return S.slice(x, y);
  };

  // 1. Live extraction of core utilities, KB, Anki, NCLEX, Case, CourseAnalyzer, Gizmo, and PDF/Clipboard helpers
  const utilCode =
    span('const MODEL_SETTINGS_KEY=', 'const ConfigCtx=createContext();') + '\n' +
    span('const STUDY_OUTPUT_POLICY=', 'function formatFactCitation(') + '\n' +
    span('const SAFETY_SETTINGS=[', 'async function callGemini(') + '\n' +
    span('const CARD_IMAGE_RE=', 'function cardMergeFaces(') + '\n' +
    span('const N2A_OK_STYLE=', 'const N2A_MODES=') + '\n' +
    span('function escHtml(', 'const COURSE_ANALYZER_FILE_ROLES=') + '\n' +
    span('const COURSE_ANALYZER_FILE_ROLES=', 'function ngAssembleWorksheet(') + '\n' +
    span('const GIZMO_PROMPT_STORAGE_KEY=', 'function gizmoDecodeFileBytes(') + '\n' +
    span('function gizmoDecodeFileBytes(', 'function gizmoPrepareInputWithEnv(');

  const kbCode =
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') + '\n' +
    span('const KB_ENTITY_KINDS=', '// ── KB source chunking');

  const ankiCode =
    span('function ankiParseCards(raw', '/* ── END ANKI PURE HELPERS ── */');

  const nclexCaseCode =
    span('function ngFactRow(', '// ── Deterministic post-generation validation ──') + '\n' +
    span('const CASE_CLINICAL_TOKEN_RE=', '/* ── END CASE STUDY PURE HELPERS ── */');

  const U = new Function(
    'DOMPurify', 'marked', 'window', 'document', 'navigator', 'fetch', 'getExt', 'extractPdfText', 'extractPptxText', 'destroyPdfDoc', 'nclexNewTrack', 'nclexRunSummary', 'parseAndNumberPoints', 'callGemini', 'extractJSON',
    utilCode + '\nreturn {MODEL_SETTINGS_KEY,saveModelSettings,loadModelSettings,n2aSanitizeStyle,N2A_OK_STYLE,N2A_NO_STYLE,copyText,redactApiSecrets,geminiRequest,i2aFileKey,i2aImagePayload,i2aConvert,i2aEmptyCache,exportAsPdf,caReadSourceFile,caSegmentMaterials,caRunAnalysisWithEnv,nclexRunMainWithEnv,saveGizmoImportPrompt,loadGizmoImportPrompt,GIZMO_DEFAULT_IMPORT_PROMPT,gizmoReadUploadFiles};'
  );

  // Build isolated runtime instances for tests
  const K = new Function(
    kbCode + '\nreturn {auditKbConcepts,mergeLatteParts,kbFactView,kbInferEntityConcept,kbBuildEntityConceptIndex,renderKBMarkdown,kbConditionMatchKeys};'
  )();

  const A = new Function(
    ankiCode + '\nreturn {ankiStyleWarnings,ankiBatchDiagnostics,ankiTrapAuditIndex,ankiParseSourceAuditV4,ankiMergeSourceAuditResult,ankiRecallContext,ankiContextInventoryIssues,ankiAuditReviewItems,ankiSourceSnapshot,ankiAuditGroups};'
  )();

  const NC = new Function(
    nclexCaseCode + '\nreturn {ngAllocateBatch,ngShuffleWorksheetOptions,ngSplitParts,ngSplitNumbered,caseNumericTokens,caseParseThresholds,caseAuditTextValues,validateCaseStudy};'
  )();

  t('v21.10 Phase 4 (Extraction tail): live pure utilities, KB, Anki, NCLEX, and Case engines compile cleanly',
    typeof K.renderKBMarkdown === 'function' &&
    typeof A.ankiAuditReviewItems === 'function' &&
    typeof NC.validateCaseStudy === 'function' &&
    utilCode.includes('async function nclexRunMainWithEnv(') &&
    utilCode.includes('function gizmoReadUploadFiles('));

  // 2. H5 — i2aFileKey byte-budgeted LRU (<= 28 MB), i2aImagePayload magic-byte sniff + chunk base64, and i2aConvert cache release
  {
    const env = U(null, null, {}, {}, {}, null, n => String(n || '').split('.').pop().toLowerCase(), null, null, () => {}, null, null, null, null, null);
    env.i2aFileKey._clear?.();
    const mkFile = (name, bytes) => {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      let reads = 0;
      return {
        name, size: u8.byteLength, lastModified: 1,
        get reads() { return reads; },
        async arrayBuffer() { reads++; return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); },
        slice(a, b) { return { async arrayBuffer() { return u8.buffer.slice(u8.byteOffset + a, u8.byteOffset + Math.min(u8.byteLength, b)); } }; }
      };
    };
    const mkPng = (fill, len = 64) => {
      const b = new Uint8Array(len);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1], 0);
      b.fill(fill, 24);
      return b;
    };
    // LRU eviction: three 12 MB files exceed 28 MB budget -> oldest evicted so total <= 28 MB
    const big1 = mkFile('a.png', mkPng(1, 12 * 1024 * 1024));
    const big2 = mkFile('b.png', mkPng(2, 12 * 1024 * 1024));
    const big3 = mkFile('c.png', mkPng(3, 12 * 1024 * 1024));
    await env.i2aFileKey(big1);
    await env.i2aFileKey(big2);
    await env.i2aFileKey(big3);
    const lruEvictedOldest = !env.i2aFileKey._bufs.has(big1) && env.i2aFileKey._bufs.has(big2) && env.i2aFileKey._bufs.has(big3);
    env.i2aFileKey._clear();

    // Magic-byte sniffing: spoofed .png with %PDF or <svg rejected with isSafetyLimit: true
    const spoofPdf = mkFile('fake.png', new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n'));
    const spoofSvg = mkFile('xss.png', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
    let pdfErr = null, svgErr = null;
    try { await env.i2aImagePayload(spoofPdf); } catch (e) { pdfErr = e; }
    try { await env.i2aImagePayload(spoofSvg); } catch (e) { svgErr = e; }

    // Chunked base64 accuracy (crosses 30,720-byte chunk boundary!) + buffer release in finally
    const realPngBytes = mkPng(0x5a, 70000);
    const realPng = mkFile('real.png', realPngBytes);
    const key = await env.i2aFileKey(realPng);
    const cachedBeforePayload = env.i2aFileKey._bufs.has(realPng);
    const payload = await env.i2aImagePayload(realPng);
    const cachedAfterPayload = env.i2aFileKey._bufs.has(realPng);
    const roundtripOk = Buffer.from(payload.data, 'base64').equals(Buffer.from(realPngBytes)) && payload.mimeType === 'image/png';

    // i2aConvert drops key on cache hit immediately and clears remaining cached buffers in finally on halt/abort
    const hitPng = mkFile('hit.png', mkPng(7, 128));
    const hitKey = await env.i2aFileKey(hitPng);
    const cache = env.i2aEmptyCache();
    const promptVerMatch = S.match(/const I2A_PROMPT_VERSION=([^;]+);/);
    const promptVer = promptVerMatch ? new Function('return ' + promptVerMatch[1])() : 'v1';
    cache.images[hitKey + '|m|' + promptVer] = { file: 'hit.png', items: [] };
    const missPng = mkFile('miss.png', mkPng(9, 128));
    const missKey = await env.i2aFileKey(missPng);
    let droppedOnHit = false;
    const convRes = await env.i2aConvert({
      images: [
        { name: 'hit.png', key: hitKey, payload: () => env.i2aImagePayload(hitPng) },
        { name: 'miss.png', key: missKey, payload: () => { droppedOnHit = !env.i2aFileKey._bufs.has(hitPng); throw Object.assign(new Error('Aborted'), { name: 'AbortError' }); } }
      ],
      gemini: async () => ({}), halts: e => e?.name === 'AbortError', model: 'm', cache, deck: 'D', extraTags: [], sourceTag: '', aiAnswers: false, thinking: 'low', log: () => {}, onProgress: () => {}
    });
    const clearedAfterAbort = env.i2aFileKey._bufs.size === 0 && env.i2aFileKey._byKey.size === 0;

    t('v21.10 Phase 4 (H5 — i2a LRU cache, magic-byte sniff, chunked base64 & buffer cleanup): enforces 28 MB LRU cap, rejects spoofed PDF/SVG images, round-trips >64 KB PNG base64 accurately, and releases buffers on hit/abort',
      lruEvictedOldest && !!pdfErr?.isSafetyLimit && !!svgErr?.isSafetyLimit &&
      cachedBeforePayload && !cachedAfterPayload && roundtripOk &&
      droppedOnHit && !!convRes.stopped && /Cancelled/.test(convRes.stopped) && clearedAfterAbort);
  }

  // 3. H21.5 — n2aSanitizeStyle preserves N2A_OK_STYLE/N2A_NO_STYLE while stripping unsafe CSS + NCLEXToAnki reviewOnly reset
  {
    const env = U(null, null, {}, {}, {}, null, null, null, null, null, null, null, null, null, null);
    const okClean = env.n2aSanitizeStyle(env.N2A_OK_STYLE);
    const noClean = env.n2aSanitizeStyle(env.N2A_NO_STYLE);
    const evilClean = env.n2aSanitizeStyle('background:url(https://evil.example/x);position:fixed;z-index:999;color:expression(alert(1));border-left:4px solid var(--bad);padding:.4em');
    t('v21.10 Phase 4 (H21.5 — n2aSanitizeStyle & reviewOnly reset): preserves green/red border-left/rgba/border-radius choice highlights, strips url()/expression()/var()/position/z-index, and resets reviewOnly when needsReview===0',
      okClean.includes('border-left:4px solid #2e9e48') &&
      okClean.includes('background:rgba(46,158,72,.13)') &&
      okClean.includes('border-radius:4px') &&
      noClean.includes('border-left:4px solid #c94040') &&
      noClean.includes('background:rgba(201,64,64,.07)') &&
      !evilClean.includes('url(') && !evilClean.includes('position') && !evilClean.includes('z-index') &&
      !evilClean.includes('expression') && !evilClean.includes('var(') && evilClean.includes('padding:.4em') &&
      S.includes('if(reviewOnly&&result&&!(result.needsReview>0))setReviewOnly(false);'));
  }

  // 4. H21.6 — CourseAnalyzer: 50 MB text cap, anchor-only segmentation, concurrency guard, partial-segment retention
  {
    let textCalled = false;
    let fetchCalls = 0;
    const env = U(
      null, null, {}, {}, {},
      async (_url, init) => {
        fetchCalls++;
        if (fetchCalls === 2) {
          return { ok: false, status: 400, headers: { get: () => 'application/json' }, async json() { return { error: { message: 'transient segment 2 failure' } }; } };
        }
        const payload = JSON.stringify({
          course: 'NUR221', exam: 'Exam 2',
          overarchingConcepts: ['Perfusion'],
          outcomes: ['Assess perfusion cues'],
          pointGroups: [{ concept: 'Perfusion', points: ['Heart failure hallmark cues'] }],
          additionalContext: ['Professor stressed orthopnea'],
          coverageReport: { materialsAnalyzed: ['lec1.txt'], majorConceptsCovered: ['Perfusion'], missingOrUnreadable: [], uncertainOrDiscrepancies: [], sourceVerification: ['Slide 1'] }
        });
        return {
          ok: true, status: 200, headers: { get: () => 'application/json' },
          async json() { return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: payload }] } }] }; }
        };
      },
      n => String(n || '').split('.').pop().toLowerCase(),
      null, null, () => {}, null, null, null, null, s => JSON.parse(s)
    );
    // 50 MB cap on .txt before calling file.text()
    let bigErr = null;
    try {
      await env.caReadSourceFile({ name: 'huge.txt', size: 51 * 1024 * 1024, async text() { textCalled = true; return 'x'; } }, 'syllabus');
    } catch (e) { bigErr = e; }

    // Anchor-only segmentation when !lectures.length && combined.length > maxChars
    const bigSyl = Array.from({ length: 40 }, (_, i) => '--- PAGE ' + (i + 1) + ' ---\n' + 'Syllabus clinical objective '.repeat(120)).join('\n');
    const anchorSegs = env.caSegmentMaterials([{ name: 'syllabus.txt', role: 'syllabus', unitLabel: 'pages', unitCount: 40, text: bigSyl }], 15000);

    // Concurrency guard
    const abortRef = { current: { active: true } };
    let busyChanges = [], savedResult = null, savedErr = '';
    await env.caRunAnalysisWithEnv({
      cfg: { apiKey: 'AIzaTestKey1234567890', forTool: () => ({ model: 'gemini-4-hydrogen', level: 'medium' }) },
      course: 'NUR221', exam: 'Exam 2', notes: '',
      files: [{ name: 'lec1.txt', size: 100, lastModified: 1, async text() { return 'Lecture 1'; } }],
      fileRoles: {}, abortRef,
      setBusy: v => busyChanges.push(v), setError: e => { savedErr = e; }, setProg: () => {}, setLogs: () => {}, pushLog: () => {},
      setResult: r => { savedResult = r; }, setEditConcepts: () => {}, setEditOutcomes: () => {}, setEditPoints: () => {}, setEditExtra: () => {}
    });
    const blockedConcurrent = busyChanges.length === 0 && fetchCalls === 0;

    // Multi-segment partial survival when segment 2 fails (two 95 KB lecture files exceed 160 KB segment budget)
    abortRef.current = null;
    const lecText = 'Cardiac output and preload assessment. '.repeat(2500);
    const logs = [];
    await env.caRunAnalysisWithEnv({
      cfg: { apiKey: 'AIzaTestKey1234567890', forTool: () => ({ model: 'gemini-4-hydrogen', level: 'medium' }) },
      course: 'NUR221', exam: 'Exam 2', notes: '',
      files: [
        { name: 'lec1.txt', size: lecText.length, lastModified: 1, async text() { return lecText; } },
        { name: 'lec2.txt', size: lecText.length, lastModified: 2, async text() { return lecText; } }
      ],
      fileRoles: {}, abortRef,
      setBusy: v => busyChanges.push(v), setError: e => { savedErr = e; }, setProg: () => {}, setLogs: () => {}, pushLog: m => logs.push(m),
      setResult: r => { savedResult = r; }, setEditConcepts: () => {}, setEditOutcomes: () => {}, setEditPoints: () => {}, setEditExtra: () => {}
    });

    t('v21.10 Phase 4 (H21.6 — CourseAnalyzer intake, segmentation, concurrency & partial survival): rejects >50 MB text before .text(), segments oversized anchor-only files, blocks concurrent runs, and retains succeeded partial segments',
      !textCalled && !!bigErr && /50 MB/.test(bigErr.message) &&
      anchorSegs.length > 1 && anchorSegs.every(s => s.text.length <= 20000) &&
      blockedConcurrent &&
      !!savedResult && savedResult.overarchingConcepts.includes('Perfusion') &&
      logs.some(l => l.t === 'warn' && /Segment 2\/2 failed/.test(l.m)) &&
      abortRef.current === null);
  }

  // 5. H21.7 — exportAsPdf fires win.print() exactly once per click (no duplicate btn.onclick)
  {
    let printCalls = 0, clickListeners = 0, writes = 0;
    const printBtn = { id: 'lp-print', onclick: null, closest(sel) { return sel === '#lp-print' ? this : null; } };
    let capturedClick = null;
    const MockDOMParser = class { parseFromString(h) { return { documentElement: { html: h } }; } };
    const fakeWin = {
      DOMParser: MockDOMParser,
      document: {
        documentElement: { initial: true },
        importNode: n => n,
        replaceChild(next) { this.documentElement = next; },
        write() { writes++; },
        getElementById(id) { return id === 'lp-print' ? printBtn : null; }
      },
      addEventListener(ev, fn) { if (ev === 'click') { clickListeners++; capturedClick = fn; } },
      print() { printCalls++; }
    };
    const env = U(
      { isSupported: true, addHook() {}, sanitize: s => ({ html: s, querySelectorAll: () => [] }) },
      { parse: s => '<p>' + s + '</p>' },
      { open: () => fakeWin, DOMParser: MockDOMParser },
      { createElement: () => ({ innerHTML: '', appendChild(f) { this.innerHTML = f.html || ''; } }) },
      {}, null, null, null, null, null, null, null, null, null, null
    );
    env.exportAsPdf('# Hello', 'Title', 'Sub');
    if (capturedClick) capturedClick({ target: printBtn });
    if (typeof printBtn.onclick === 'function') printBtn.onclick();
    t('v21.10 Phase 4 (H21.7 — exportAsPdf single print): attaches one delegated click listener without document.write or duplicate btn.onclick so clicking #lp-print triggers win.print() exactly once',
      clickListeners === 1 && writes === 0 && printBtn.onclick === null && printCalls === 1);
  }

  // 6. H21.8 — NCLEXExtractor concurrency guard, error secret redaction, /\.pdf$/i, and [firstFile] effect
  {
    const secret = 'AIzaSyPhase4TestSecretKey987654321';
    const env = U(
      null, null, {}, {}, {}, null, null, null, null, () => {},
      () => ({ failed: [], notes: [], cancelled: false, stopped: '' }),
      tr => ({ status: tr.stopped ? 'error' : 'complete', headline: tr.stopped || 'ok' }),
      null, null, null
    );
    const abortRef = { current: { busy: true } };
    let statusChanges = [], surfacedErr = '';
    await env.nclexRunMainWithEnv({
      cfg: { apiKey: secret, autoProfile: false },
      files: [{ name: 'a.pdf' }], mode: 'inline', iRangeOn: false, model: 'gemini-4-hydrogen', toolLevel: 'medium',
      abortRef, setError: e => { surfacedErr = e; }, setQuestions: () => {}, setRunSummary: () => {}, setLog: () => {},
      setStatus: s => statusChanges.push(s), addLog: () => {},
      runInline: async () => { throw new Error('Leaked ' + secret); }, runSplit: async () => []
    });
    const blockedOverlap = statusChanges.length === 0;

    abortRef.current = null;
    await env.nclexRunMainWithEnv({
      cfg: { apiKey: secret, autoProfile: false },
      files: [{ name: 'a.pdf' }], mode: 'inline', iRangeOn: false, model: 'gemini-4-hydrogen', toolLevel: 'medium',
      abortRef, setError: e => { surfacedErr = e; }, setQuestions: () => {}, setRunSummary: () => {}, setLog: () => {},
      setStatus: s => statusChanges.push(s), addLog: () => {},
      runInline: async () => { throw new Error('Leaked ' + secret); }, runSplit: async () => []
    });
    t('v21.10 Phase 4 (H21.8 — NCLEXExtractor concurrency, redaction, /\.pdf$/i & [firstFile]): blocks concurrent runs, redacts API key from errors, escapes /\.pdf$/i, and keys range seeding on [firstFile]',
      blockedOverlap && !surfacedErr.includes(secret) && surfacedErr.includes('[REDACTED]') && abortRef.current === null &&
      S.includes(".filter(f=>/\\.pdf$/i.test(f.name||'')||f.type==='application/pdf')") &&
      S.includes('const firstFile=files[0]||null;') &&
      S.includes('},[firstFile]);'));
  }

  // 7. H21.1–H21.3 & M15.3 — renderKBMarkdown single-condition sibling context + trap worksheet, Orphan select, Remove Q-banks disabled, Disclose onToggle
  {
    const kb = {
      metadata: { concepts: ['Perfusion'] },
      conditions: [
        { id: 'perfusion', name: 'Perfusion', entryRole: 'concept', facts: [{ id: 'f1', latteBucket: 'Patho', text: 'Baseline perfusion physiology.', tier: 1, sources: [] }] },
        { id: 'dka', name: 'DKA', entryRole: 'exemplar', concept: 'Perfusion', contrastPartners: ['HHS'], facts: [
          { id: 'f2', latteBucket: 'Patho', text: 'Absolute insulin deficiency causes ketosis.', tier: 1, sources: [] },
          { id: 'f3', latteBucket: 'Look', text: 'Kussmaul respirations and fruity breath.', tier: 1, trapRole: 'twin-cue', contrastWith: 'HHS', sources: [] },
          { id: 'f4', latteBucket: 'Treat', subtype: 'dependent', text: 'IV regular insulin plus NS.', tier: 1, trapRole: 'twin-rx-opposite', contrastWith: 'HHS', sources: [] }
        ] },
        { id: 'hhs', name: 'HHS', entryRole: 'exemplar', concept: 'Perfusion', contrastPartners: ['DKA'], facts: [
          { id: 'f5', latteBucket: 'Patho', text: 'Relative insulin deficiency causes severe dehydration without ketosis.', tier: 1, sources: [] },
          { id: 'f6', latteBucket: 'Look', text: 'BG > 600 mg/dL with no ketones.', tier: 1, trapRole: 'twin-cue', contrastWith: 'DKA', sources: [] },
          { id: 'f7', latteBucket: 'Treat', subtype: 'dependent', text: 'Aggressive IV fluid resuscitation first.', tier: 1, trapRole: 'twin-rx-opposite', contrastWith: 'DKA', sources: [] }
        ] }
      ]
    };
    const view = K.kbFactView(kb);
    const dkaMd = K.renderKBMarkdown(view, { showEmptyTrapWorksheet: true, onlyConditionId: 'dka' });
    const conceptMd = K.renderKBMarkdown(view, { onlyConditionId: 'perfusion' });
    t('v21.10 Phase 4 (H21.1–H21.3 & M15.3 — KB Study View, Orphan select, Remove Q-banks & Disclose onToggle): onlyConditionId renders one condition while retaining sibling Twin Contrast Strip, Concept Matrix & empty trap worksheet, and UI guards hold',
      dkaMd.includes('## DKA') && !dkaMd.includes('## HHS') && !dkaMd.includes('## Perfusion') &&
      dkaMd.includes('Twin-Diagnosis Contrast Strip (DKA vs. HHS)') &&
      dkaMd.includes('BG > 600 mg/dL with no ketones.') &&
      dkaMd.includes('[not stated in source]') &&
      conceptMd.includes('## Perfusion') && conceptMd.includes('Sibling Exemplar P-LATE Matrix') && !conceptMd.includes('## DKA') &&
      S.includes("<select aria-label={'Reassign concept for '+o.name} value=\"_noop\"") &&
      S.includes('disabled={busy} style={{fontSize:11,padding:\'2px 8px\',minHeight:22}} onClick={()=>kbRemoveFileSubset(') &&
      S.includes('if(ownBuildKbRef.current===K.knowledgeBase){ownBuildKbRef.current=null;}\n      else{setDiag(null);setLogs([]);setHandoffNotice(\'\');}') &&
      S.includes('function Disclose({summary,note,children,open=false,onToggle,className=\'\'}){') &&
      S.includes('open={tocOpen} onToggle={e=>setTocOpen(e.currentTarget.open)}'));
  }

  // 8. M3 — Split KnowledgeDataCtx & FactInspectorActionsCtx + AnkiGenerator memoized kbView & debounced publishAnkiDeck
  t('v21.10 Phase 4 (M3 — Context split & Anki keystroke storm): splits KnowledgeDataCtx and FactInspectorActionsCtx with fallback to legacy contexts, routes FactTag & tools through split contexts, memoizes kbView, and debounces publishAnkiDeck',
    S.includes('const KnowledgeDataCtx=createContext(null);') &&
    S.includes('function useKnowledgeData(){return useContext(KnowledgeDataCtx)||useContext(KnowledgeCtx);}') &&
    S.includes('const FactInspectorActionsCtx=createContext(null);') &&
    S.includes('function useFactInspectorActions(){return useContext(FactInspectorActionsCtx)||useContext(FactInspectorCtx);}') &&
    S.includes('const K=useKnowledgeData();const FI=useFactInspectorActions();') &&
    S.includes('<FactInspectorActionsCtx.Provider value={inspectorActionsValue}>') &&
    S.includes('<KnowledgeDataCtx.Provider value={knowledgeDataValue}>') &&
    S.includes('const kbView=useMemo(()=>kbFactView(K.knowledgeBase),[K.knowledgeBase]);') &&
    S.includes('const t=setTimeout(()=>{if(publishAnkiDeck)publishAnkiDeck({cards,batch,current,tierFilter});},250);return()=>clearTimeout(t);'));

  // 9. M4 — Lazy Markdown serialization & memoized projections in KnowledgeBaseBuilder & CaseStudyGenerator
  {
    const kbSpan = span('function KnowledgeBaseBuilder(){', '// ──── TOOL: Priority Analyzer ────');
    const caseSpan = span('function CaseStudyGenerator(){', 'function CaseRenderer(');
    t('v21.10 Phase 4 (M4 — Lazy Markdown & memoized projections): defers full-KB and Case/Packet Markdown to click handlers, memoizes tocProjection and packetMeta, and gates recovery JSON.stringify on open details',
      !kbSpan.includes('md=useMemo(()=>renderKBMarkdown') &&
      kbSpan.includes('const buildExportMd=()=>renderKBMarkdown(view,') &&
      kbSpan.includes('const tocProjection=useMemo(()=>tocReport?kbProjectTocView(') &&
      kbSpan.includes('{openRecovery[index]&&<pre') &&
      !caseSpan.includes('const caseMd=useMemo(') &&
      !caseSpan.includes('const packetMd=useMemo(') &&
      caseSpan.includes('const buildCaseMd=()=>caseStudy?') &&
      caseSpan.includes('const buildPacketMd=()=>casePacket.length?') &&
      caseSpan.includes('const packetMeta=useMemo(()=>casePacket.map('));
  }

  // 10. M15.1, M15.2, M15.4, M15.5 — copyText, saveModelSettings, geminiRequest apiKey trim, saveGizmoImportPrompt, gizmoReadUploadFiles, UI resilience
  {
    const lsMap = new Map();
    let lsWrites = 0;
    const mockStorage = {
      getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
      setItem: (k, v) => { lsWrites++; lsMap.set(k, String(v)); }
    };
    let capturedHeaderKey = '';
    const env = U(
      null, null, {},
      {
        createElement: () => ({ style: {}, setAttribute() {}, select() {} }),
        body: { appendChild() {}, removeChild() {} },
        execCommand: () => { throw new Error('blocked'); }
      },
      { clipboard: { writeText: async () => { throw new Error('denied'); } } },
      async (_u, init) => {
        capturedHeaderKey = init.headers['x-goog-api-key'];
        return {
          ok: true, status: 200, headers: { get: () => 'application/json' },
          async json() { return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }] }; }
        };
      },
      null, null, null, null, null, null, null, null, null
    );
    const copyOk = await env.copyText('hello'); // must resolve to false without unhandled rejection
    env.saveModelSettings(mockStorage, { hydrogenModel: 'gemini-4-hydrogen', neonModel: 'gemini-4-neon', thinkingMode: false, hydrogenLevel: 'low', neonLevel: 'high' });
    env.saveModelSettings(mockStorage, { hydrogenModel: 'gemini-4-hydrogen', neonModel: 'gemini-4-neon', thinkingMode: false, hydrogenLevel: 'low', neonLevel: 'high' });
    const skippedDuplicateSave = lsWrites === 1;

    await env.geminiRequest('  AIzaTrimmedKey1234567890  ', 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } });
    const trimmedKeySent = capturedHeaderKey === 'AIzaTrimmedKey1234567890';

    env.saveGizmoImportPrompt(mockStorage, '   Custom rule   ');
    const trimmedGizmoPrompt = env.loadGizmoImportPrompt(mockStorage) === 'Custom rule';

    // gizmoReadUploadFiles never calls setFiles inside setFileEntries updater
    let inEntriesUpdater = false, nestedSetFiles = false, entriesState = [];
    const buf = new TextEncoder().encode('Q|A|T');
    env.gizmoReadUploadFiles(
      [{ name: 'deck.txt', size: buf.byteLength, lastModified: 1, async arrayBuffer() { return buf.buffer; } }],
      {
        fileKey: f => f.name,
        setNote: () => {},
        setFileEntries: fn => { inEntriesUpdater = true; entriesState = fn(entriesState); inEntriesUpdater = false; },
        setFiles: () => { if (inEntriesUpdater) nestedSetFiles = true; }
      }
    );
    await new Promise(r => setTimeout(r, 15));

    t('v21.10 Phase 4 (M15 — UI resilience, clipboard safety, storage echo, API trim & drawer isolation): copyText resolves false on failure, saveModelSettings skips identical write, geminiRequest trims apiKey, gizmoReadUploadFiles avoids nested updaters, and UI guards hold',
      copyOk === false && skippedDuplicateSave && trimmedKeySent && trimmedGizmoPrompt &&
      entriesState.length === 1 && !nestedSetFiles &&
      S.includes("runState.chunkIssues.push({chunk:i+1,code:'chunk-error',message:cmsg});") &&
      S.includes('useEffect(()=>{setEditBlocked(null);},[tierFilter]);') &&
      S.includes("warningFilter.startsWith('scope:')||warningFilter.startsWith('trap:')||warningFilter.startsWith('layer:')") &&
      S.includes("if(isQuotaError(e)&&++repairQuotaFails>=2)throw Object.assign(new Error('API quota exhausted'),{name:'QuotaStop'});") &&
      S.includes("<div style={{display:view==='case'?'block':'none'}}><CaseRenderer key={activePacketId||'single'} caseStudy={caseStudy}/></div>") &&
      S.includes('useEffect(()=>{setCopiedChunks(new Set());},[pagesPerChunk,cardsPerPage]);') &&
      S.includes('<ToolBoundary name="Fact Inspector">') &&
      S.includes('<ToolBoundary name="Study settings"><ConfigSidebar onClose={closeSettings} activeTool={activeTool}/></ToolBoundary>') &&
      S.includes('onChange={e=>cfg.setApiKey(e.target.value.trim())}') &&
      S.includes("document.querySelector('[role=\"dialog\"][aria-modal=\"true\"]')"));
  }

  // 11. M14a — KB & Anki engine hot-loop optimizations preserve exact semantics
  {
    // mergeLatteParts O(C) index with 40 conditions + cross-chunk alias match
    const parts = [
      { source: { filename: 'a.pdf' }, conditions: Array.from({ length: 40 }, (_, i) => ({ name: 'Condition ' + i, aliases: ['Alias' + i], facts: [{ text: 'Fact A' + i, latteBucket: 'Look', tier: 1 }] })) },
      { source: { filename: 'b.pdf' }, conditions: Array.from({ length: 40 }, (_, i) => ({ name: 'Alias' + i, aliases: [], facts: [{ text: 'Fact B' + i, latteBucket: 'Treat', tier: 1 }] })) }
    ];
    const merged = K.mergeLatteParts(parts);
    const mergedAll40 = merged.conditions.length === 40 && merged.conditions.every(c => c.facts.length === 2);

    // auditKbConcepts bucket-indexed pre-tokenization catches sibling overlap
    const overlapAudit = K.auditKbConcepts({
      metadata: { concepts: ['Perfusion'] },
      conditions: [
        { id: 'p', name: 'Perfusion', entryRole: 'concept', facts: [{ text: 'Perfusion baseline', latteBucket: 'Patho' }] },
        { id: 'e1', name: 'Left HF', entryRole: 'exemplar', concept: 'Perfusion', facts: [{ text: 'Patho bridge 1', latteBucket: 'Patho' }, { text: 'Daily morning weight tracking detects fluid retention promptly', latteBucket: 'Look' }, { text: 'Pink frothy sputum', latteBucket: 'Look', conceptScope: 'differentiator' }] },
        { id: 'e2', name: 'Right HF', entryRole: 'exemplar', concept: 'Perfusion', facts: [{ text: 'Patho bridge 2', latteBucket: 'Patho' }, { text: 'Daily morning weight tracking detects fluid retention accurately', latteBucket: 'Look' }, { text: 'Jugular venous distention', latteBucket: 'Look', conceptScope: 'differentiator' }] }
      ]
    });

    // kbFactView uses precompiled kbBuildEntityConceptIndex cleanly
    const entityView = K.kbFactView({
      conditions: [{ id: 'p', name: 'Perfusion', entryRole: 'concept', facts: [{ id: 'f1', text: 'Perfusion overview', latteBucket: 'Patho', tier: 1 }] }, { id: 'hf', name: 'Heart Failure', entryRole: 'exemplar', concept: 'Perfusion', facts: [{ id: 'f2', text: 'Reduced ejection fraction', latteBucket: 'Patho', tier: 1 }] }],
      medications: [{ name: 'Furosemide', indications: ['Heart Failure'], facts: [{ id: 'f3', text: 'Loop diuretic for Heart Failure.', latteBucket: 'Treat', tier: 1 }] }]
    });
    const medLinked = entityView.conditions.find(c => c.entityKind === 'medication')?.concept === 'Perfusion';

    // ankiStyleWarnings single-pass + ankiBatchDiagnostics single-pass
    const cards = [
      { id: 'n1', text: '[HF] Triad: {{c1::a}}, {{c1::b}}, {{c1::c}}', extra: 'note {{c1::bad}}', tags: 'Condition::HF Tier::1', pipeCount: 2, keep: true, factIds: ['f1'] },
      { id: 'n2', text: 'No cue {{c1::x}}', extra: '', tags: 'Tier::1', pipeCount: 2, keep: true, factIds: ['f1'] }
    ];
    const sw1 = A.ankiStyleWarnings(cards[0]).map(x => x.code);
    const snap = A.ankiSourceSnapshot({ conditions: [{ name: 'HF', facts: [{ id: 'f1', text: 'Triad a, b, c.', latteBucket: 'Look', tier: 1 }] }] });
    const diag = A.ankiBatchDiagnostics(cards, { rawCards: cards, snapshot: snap }, true);

    // ankiMergeSourceAuditResult deduplicates citationRecoveries and uses O(F) fact Map
    const grp = { id: 'g1', protocolVersion: 4, facts: [{ id: 'f1', text: 'Keep K+ 3.5-5.0 mEq/L', inSelectedTier: true }], notes: [{ id: 'n1', text: '[K] Range: {{c1::3.5-5.0 mEq/L}}', extra: '', eligible: true, keep: true, structurallyValid: true, inSelectedTier: true, reviewTargets: [{ index: 1 }] }], sourceFactIds: ['f1'], scopeNoteIds: ['n1'] };
    const sig = JSON.stringify(grp);
    const rec = { groupId: 'g1', path: 'x', factId: 'f1', originalSourceSpan: 'a', sourceSpan: 'a', method: 'norm' };
    const mergedAudit = A.ankiMergeSourceAuditResult(
      { protocolVersion: 4, packetSignature: sig, factReviews: [{ factId: 'f1', inventory: [], targets: [] }], noteReviews: [], findings: [], citationRecoveries: [rec], referenceRecoveries: [], unresolved: [], complete: false },
      { protocolVersion: 4, packetSignature: sig, factReviews: [], noteReviews: [{ noteId: 'n1', text: { status: 'supported', evidence: [] }, extra: { status: 'empty', evidence: [] } }], findings: [], citationRecoveries: [{ ...rec }], referenceRecoveries: [], unresolved: [], complete: false },
      grp
    );
    const rc = A.ankiRecallContext(null, cards, { snapshot: snap }, false);

    t('v21.10 Phase 4 (M14a — KB & Anki hot-loop optimizations): O(C) condition merge, bucketed overlap audit, precompiled entity concept index, single-pass Anki style/diagnostics, deduped citationRecoveries, and notesByFactId index all match exact semantics',
      mergedAll40 && overlapAudit.nearDuplicateOverlaps.length === 1 && medLinked &&
      sw1.includes('shared-gaps') && sw1.includes('list-recall') && sw1.includes('extra-cloze') &&
      diag.listRecall.warned === 1 && diag.frontAnchor.warned === 1 &&
      mergedAudit.complete === true && mergedAudit.citationRecoveries.length === 1 &&
      rc.notesByFactId instanceof Map && rc.notesByFactId.get('f1').length === 2);
  }

  // 12. M14b — NCLEX & Case engine hot-loop optimizations (concept pre-grouping, linear shuffle splice, hoisted regexes & cached case validation)
  {
    // Linear batch splice in ngShuffleWorksheetOptions across 12 questions
    const qParts = [], kParts = [];
    for (let i = 1; i <= 12; i++) {
      qParts.push(`${i}. Question stem ${i} for a client?\nA. Administer IV furosemide (${i})\nB. Assess bilateral lung sounds (${i})\nC. Measure daily morning weight (${i})\nD. Elevate head of bed (${i})`);
      kParts.push(`${i}. ANSWER: A\nWhy A is correct: Diuretic reduces preload (${i}) (Source: fact-1).\nWhy B is wrong: Auscultation does not relieve overload (${i}) (Source: fact-1).\nWhy C is wrong: Weight tracks trend only (${i}) (Source: fact-1).\nWhy D is wrong: Positioning alone is insufficient (${i}) (Source: fact-1).\nTags: Tier::1`);
    }
    const rawWs = 'PART 1: PLAN\n1. plan\n\nPART 2: NOTES\nNone\n\nPART 3: QUESTIONS\n\n' + qParts.join('\n\n') + '\n\nPART 4: ANSWER KEY\n\n' + kParts.join('\n\n') + '\n\nDISTRIBUTION:\nTotal: 12';
    let seed = 0.37;
    const detRand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const shuf = NC.ngShuffleWorksheetOptions(rawWs, detRand);
    const sp = NC.ngSplitParts(shuf.text);
    const outQs = NC.ngSplitNumbered(sp.p3), outKs = NC.ngSplitNumbered(sp.p4);

    // Case validation with hoisted regexes + per-validation fact cache + single datum/Trend audit
    const factIndex = new Map([
      ['fact-1', { condition: { name: 'Heart Failure' }, fact: { id: 'fact-1', text: 'Report urine output < 30 mL/hr and BP < 90/60 mmHg.', sourceQuote: 'urine output < 30 mL/hr', tier: 1 } }]
    ]);
    const cs = {
      title: 'Heart Failure Case', condition: 'Heart Failure', difficulty: 'exam',
      patient: { age: 68, sex: 'F', background: 'Admitted for decompensation.' },
      stages: [{
        stageNumber: 1, title: 'Arrival', narrative: 'Client arrives.',
        data: [
          { label: 'Urine output', value: '20 mL/hr', supportType: 'instantiated', availability: 'revealed', factIds: ['fact-1'] },
          { label: 'Blood pressure', value: '84/52 mmHg', supportType: 'instantiated', availability: 'revealed', factIds: ['fact-1'] }
        ],
        questions: [{
          id: 'q1', type: 'MCQ', stem: 'With urine output 20 mL/hr and BP 84/52 mmHg, what is the priority?',
          options: [{ label: 'A', text: 'Notify provider of oliguria' }, { label: 'B', text: 'Reassess next shift' }, { label: 'C', text: 'Encourage oral fluids' }, { label: 'D', text: 'Ambulate in hallway' }],
          correctAnswers: ['A'],
          rationales: [
            { option: 'A', text: 'Urine output 20 mL/hr is below 30 mL/hr and BP 84/52 mmHg is below 90/60 mmHg.', supportType: 'instantiated', factIds: ['fact-1'] },
            { option: 'B', text: 'Delaying intervention risks hypoperfusion.', supportType: 'direct', factIds: ['fact-1'] },
            { option: 'C', text: 'Oral fluids worsen overload.', supportType: 'direct', factIds: ['fact-1'] },
            { option: 'D', text: 'Ambulation is unsafe with BP 84/52 mmHg.', supportType: 'direct', factIds: ['fact-1'] }
          ]
        }]
      }],
      debrief: { priorityProblem: 'Impaired perfusion', keyDecisions: ['Report low output'], notes: 'Review thresholds.' }
    };
    const caseIssues = NC.validateCaseStudy(cs, factIndex, new Set(['fact-1']), 'Heart Failure');
    const caseErrors = caseIssues.filter(x => x.sev === 'error');

    // Also verify bad datum produces exactly ONE error (not duplicated by pre-pass + main pass)
    const badCs = JSON.parse(JSON.stringify(cs));
    badCs.stages[0].data[0] = { label: 'Potassium', value: '6.8 mEq/L', supportType: 'direct', availability: 'revealed', factIds: ['fact-1'] };
    const badIssues = NC.validateCaseStudy(badCs, factIndex, new Set(['fact-1']), 'Heart Failure');
    const kDatumErrors = badIssues.filter(x => x.sev === 'error' && x.msg.includes('Stage 1 datum "Potassium"'));

    t('v21.10 Phase 4 (M14b — NCLEX linear splice & Case cached/hoisted validation): batch-splices 12 shuffled questions in one pass, validates instantiated BP/urine thresholds with hoisted regexes, and emits each datum audit error exactly once',
      shuf.shuffled.length === 12 && outQs.length === 12 && outKs.length === 12 &&
      caseErrors.length === 0 && kDatumErrors.length === 1);
  }
};
