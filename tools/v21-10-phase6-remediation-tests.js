'use strict';

// v21.10 Phase 6 production code-review remediation regression suite (H24, M19, M20, L1–L8).
// Exercises live shipped code from Nursing-Study-Suite v21.10.html (plain script block, head
// DOMPurify fallback + bootFail scripts, and Babel-compiled React components) and live repo
// tooling directly — zero mocked clones and zero live API calls.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { extractSpan, resolveSuiteFile, suiteVersionFromFilename } = require('./repo-checks');
const { checkPromptDoc, extractBuilderFunction } = require('./render-prompts');

function extractScriptBlocks(S) {
  const blocks = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(S)) !== null) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    const before = S.slice(Math.max(0, m.index - 40), m.index);
    if (before.includes('<template')) continue;
    blocks.push({ isBabel: /text\/babel/.test(attrs), attrs: attrs.trim(), code: m[2] });
  }
  return blocks;
}

function createMinimalReact(contexts) {
  let stateMap = new Map();
  let currentId = 'root';
  let cursor = 0;
  let pending = [];

  const getStore = () => {
    let s = stateMap.get(currentId);
    if (!s) { s = { hooks: [] }; stateMap.set(currentId, s); }
    return s;
  };

  const React = {
    createContext(def) { return { _default: def, Provider: ({ children }) => children }; },
    useState(init) {
      const store = getStore(), i = cursor++;
      if (!store.hooks[i]) store.hooks[i] = { value: typeof init === 'function' ? init() : init };
      const h = store.hooks[i];
      return [h.value, next => { h.value = typeof next === 'function' ? next(h.value) : next; }];
    },
    useRef(init) {
      const store = getStore(), i = cursor++;
      if (!store.hooks[i]) store.hooks[i] = { current: init };
      return store.hooks[i];
    },
    useEffect(fn, deps) {
      const store = getStore(), i = cursor++, prev = store.hooks[i];
      const changed = !prev || !deps || !prev.deps || deps.length !== prev.deps.length ||
        deps.some((d, k) => !Object.is(d, prev.deps[k]));
      store.hooks[i] = { deps, cleanup: prev ? prev.cleanup : null };
      if (changed) pending.push({ store, i, fn });
    },
    useCallback(fn) { return fn; },
    useMemo(fn, deps) {
      const store = getStore(), i = cursor++, prev = store.hooks[i];
      const changed = !prev || !deps || !prev.deps || deps.length !== prev.deps.length ||
        deps.some((d, k) => !Object.is(d, prev.deps[k]));
      if (changed) store.hooks[i] = { deps, value: fn() };
      return store.hooks[i].value;
    },
    useContext(ctx) {
      if (contexts.has(ctx)) return contexts.get(ctx);
      return ctx && ctx._default;
    },
    memo(c) { return c; },
    createElement(type, props, ...children) {
      const flat = [];
      const push = x => {
        if (x == null || typeof x === 'boolean') return;
        if (Array.isArray(x)) x.forEach(push);
        else flat.push(x);
      };
      push(children);
      return { type, props: props || {}, children: flat };
    },
    Fragment: 'Fragment',
  };

  const flush = () => {
    const queue = pending;
    pending = [];
    for (const e of queue) {
      const h = e.store.hooks[e.i];
      if (typeof h.cleanup === 'function') h.cleanup();
      h.cleanup = e.fn() || null;
    }
  };

  const render = (id, Component, props = {}) => {
    currentId = id;
    cursor = 0;
    pending = [];
    const tree = Component(props);
    flush();
    return tree;
  };

  const unmount = id => {
    const store = stateMap.get(id);
    if (!store) return;
    for (const h of store.hooks) {
      if (h && typeof h.cleanup === 'function') { h.cleanup(); h.cleanup = null; }
    }
    stateMap.delete(id);
  };

  return { React, render, unmount };
}

function collectNodes(node, pred, out = []) {
  if (node == null || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach(n => collectNodes(n, pred, out)); return out; }
  if (typeof node.type === 'function') {
    const rendered = node.type({ ...node.props, children: node.children });
    return collectNodes(rendered, pred, out);
  }
  if (pred(node)) out.push(node);
  if (Array.isArray(node.children)) node.children.forEach(c => collectNodes(c, pred, out));
  return out;
}

function nodeText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (typeof node.type === 'function') return nodeText(node.type({ ...node.props, children: node.children }));
  return Array.isArray(node.children) ? node.children.map(nodeText).join('') : '';
}

function loadBabelInstance() {
  const { PRIVATE_TOOL_ROOT } = require('../verify-repo');
  const priv = path.join(PRIVATE_TOOL_ROOT, 'node_modules', '@babel', 'standalone', 'babel.js');
  const babelPath = process.env.NSS_BABEL_STANDALONE ||
    (fs.existsSync(priv) ? priv : path.join(os.tmpdir(), 'nursing-study-suite-verify', 'node_modules', '@babel', 'standalone', 'babel.js'));
  return require(babelPath);
}

function makeGeminiOk(text, usage = { promptTokenCount: 100, candidatesTokenCount: 50 }) {
  const payload = {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
    usageMetadata: usage,
  };
  const sseBytes = new TextEncoder().encode('data: ' + JSON.stringify(payload) + '\n\n');
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    json: async () => payload,
    body: {
      getReader() {
        let sent = false;
        return {
          async read() {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: sseBytes };
          },
          async cancel() {},
        };
      },
    },
  };
}

function makeMinimalKB() {
  return {
    course: 'NUR221',
    exam: 'Exam 2',
    schemaVersion: 3,
    numberedPoints: [{ id: 'P1', text: 'Loop diuretic potassium monitoring' }],
    conditions: [{
      id: 'hf',
      name: 'Heart Failure',
      category: 'Cardiovascular',
      concept: 'Perfusion',
      facts: [
        {
          id: 'fact-1', latteBucket: 'Assess', tier: 1, safetyCritical: true,
          text: 'Monitor serum potassium 3.5-5.0 mEq/L before giving furosemide.',
          sources: [{ filename: 'hf.pdf', location: 'p.1', quote: 'Monitor serum potassium 3.5-5.0 mEq/L before giving furosemide.' }],
          pointAnchors: ['P1'],
        },
        {
          id: 'fact-2', latteBucket: 'Treat', tier: 1, safetyCritical: true,
          text: 'Hold digoxin and notify provider when apical pulse is below 60 beats/min.',
          sources: [{ filename: 'hf.pdf', location: 'p.2', quote: 'Hold digoxin and notify provider when apical pulse is below 60 beats/min.' }],
          pointAnchors: ['P1'],
        },
        {
          id: 'fact-3', latteBucket: 'Educate', tier: 2, safetyCritical: false,
          text: 'Report weight gain of 2 lb in 24 hours or 5 lb in 1 week.',
          sources: [{ filename: 'hf.pdf', location: 'p.3', quote: 'Report weight gain of 2 lb in 24 hours or 5 lb in 1 week.' }],
        },
        {
          id: 'fact-4', latteBucket: 'Labs', tier: 1, safetyCritical: false,
          text: 'BNP greater than 100 pg/mL supports acute heart failure exacerbation.',
          sources: [{ filename: 'hf.pdf', location: 'p.4', quote: 'BNP greater than 100 pg/mL supports acute heart failure exacerbation.' }],
        },
      ],
    }],
    medications: [],
    diagnostics: [],
    scoringTools: [],
  };
}

module.exports = async function runPhase6RemediationTests(S, t) {
  const rootDir = path.resolve(__dirname, '..');
  const scriptBlocks = extractScriptBlocks(S);
  const domPurifyScript = scriptBlocks.find(b => !b.isBabel && b.code.includes('function _hasDomPurify()'));
  const bootFailScript = scriptBlocks.find(b => !b.isBabel && b.code.includes('function bootFail(message)'));
  const mainPlainScript = scriptBlocks.find(b => !b.isBabel && b.code.includes('const TOOL_PROFILE_DEFAULTS='));
  if (!domPurifyScript || !bootFailScript || !mainPlainScript) {
    throw new Error('Phase 6: failed to locate inline head/plain scripts in suite HTML');
  }

  // Boot the live ES2020 core script once in an isolated VM context so every pure helper,
  // schema, IndexedDB runner, and *WithEnv orchestrator runs with its real sibling bindings.
  const noopStore = { getItem: () => null, setItem() {}, removeItem() {} };
  const fakeWindow = {
    React: {
      useState: x => [typeof x === 'function' ? x() : x, () => {}],
      useRef: x => ({ current: x }),
      useCallback: f => f,
      useEffect: () => {},
      useMemo: f => f(),
      createContext: d => ({ _default: d, Provider: () => null }),
      useContext: () => ({}),
      createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      Fragment: 'Fragment',
    },
    DOMPurify: {
      isSupported: true,
      sanitize: (x, cfg) => (cfg && cfg.RETURN_DOM_FRAGMENT)
        ? { querySelectorAll: () => [], textContent: String(x || '') }
        : String(x || ''),
      addHook() {},
    },
    marked: { parse: x => '<p>' + String(x || '') + '</p>' },
    localStorage: noopStore,
    sessionStorage: noopStore,
    location: { href: 'https://localhost/' },
    addEventListener() {},
    removeEventListener() {},
  };
  const sandbox = {
    window: fakeWindow,
    globalThis: null,
    self: fakeWindow,
    document: {
      createElement: tag => ({ tagName: tag.toUpperCase(), style: {}, setAttribute() {}, appendChild() {}, querySelectorAll: () => [] }),
      getElementById: () => null,
      addEventListener() {},
      removeEventListener() {},
    },
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: noopStore,
    sessionStorage: noopStore,
    indexedDB: undefined,
    fetch: async () => { throw new Error('Unexpected unmocked fetch in Phase 6 test'); },
    React: fakeWindow.React,
    DOMPurify: fakeWindow.DOMPurify,
    marked: fakeWindow.marked,
    AbortController,
    AbortSignal,
    DOMException,
    URL,
    Blob,
    TextEncoder,
    TextDecoder,
    DecompressionStream,
    ReadableStream,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    ArrayBuffer,
    DataView,
    Float32Array,
    Float64Array,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    console,
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    performance: { now: () => Date.now() },
    crypto: require('crypto').webcrypto,
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(mainPlainScript.code, ctx, { filename: 'suite-plain-core.js' });

  // Export lexical consts alongside function declarations from the same VM realm.
  const LIVE = vm.runInContext(`({
    kbOpenDB, kbRunTx, KB_DB_STORE,
    kbTranscribeCardsWithEnv, paRunAnalysisWithEnv, nclexRunSplitWithEnv, n2aConvertTextWithEnv,
    ngRunGeneratorWithEnv, gizmoPrepareInputWithEnv, gizmoRunAiConvertWithEnv,
    caRunAnalysisWithEnv, nclexRunMainWithEnv, caseRunBatchWithEnv,
    createOperationSlot, caBuildKbHandoff, parseAndNumberPoints, buildFactIndex,
    GIZMO_CONVERT_PROMPT, GIZMO_RESPONSE_JSON_SCHEMA,
    artifactJsonExport, casePacketJsonExport,
    ankiStripPTags, ankiLiteralMatches, nclexStripStemPrefix, n2aMatchAnswerLabels, n2aSplitStemOptions,
    itemAuditIsAnswerAccuracy, itemParseAuditVerdict, ngParseKeyItem, ngRenderQuestionBlock, ngRenderKeyBlock, itemRefersByLetter,
    caseAuditPayload, itemRunPool, NEIA_TERMINOLOGY_RULES, neiaTerminologyScan, validateCaseStudy,
    caseToMarkdown, caseBuildPrompt, selectCaseFacts, caseValidateNgnQuestion,
    ankiBatchDiagnostics, ankiGenerationOutcome, ankiSourceAuditState, ankiStampConceptTags, ankiStampLayerTags,
    nclexChunkText, nclexRepairOptions, nclexMergePairs, n2aKeyFit, n2aRealignKey, x2aBuildCard,
    N2A_PDF_CHROME, n2aPdfChoiceLines, n2aPdfKeyLines, CASE_CLINICAL_TOKEN_RE,
    _pptxParseZip, pptxReadXml, extractPptxText, PPTX_LIMITS,
  })`, ctx);

  // ── 1. H24 Batch 1: Live *WithEnv orchestrators (n2aConvertText, kbTranscribeCards, gizmoPrepareInput, gizmoRunAiConvert, caRunAnalysis) ──
  {
    const baseCfg = {
      apiKey: 'AIzaSyPhase6SecretKey99999',
      autoProfile: true,
      forTool: () => ({ model: 'gemini-4-hydrogen', level: 'low' }),
    };

    // 1a. n2aConvertTextWithEnv
    let n2aBusyTrace = [], n2aErr = '', n2aResults = {};
    const n2aAbort = { current: null };
    const sampleWs = [
      '# NCLEX Practice Questions',
      '## Questions',
      '1. A client receiving furosemide has a potassium level of 2.9 mEq/L. Which action is priority?',
      'A. Administer prescribed potassium chloride',
      'B. Encourage ambulation',
      'C. Restrict oral fluids',
      'D. Obtain a routine weight',
      '## Answer Key',
      '1. ANSWER: A',
      'Why A is correct: Hypokalemia below 3.5 mEq/L causes lethal dysrhythmias and requires prompt replacement.',
      'Why B is wrong: Ambulation does not correct hypokalemia.',
      'Why C is wrong: Fluid restriction does not correct potassium loss.',
      'Why D is wrong: Weight checks are secondary to potassium replacement.',
    ].join('\n');
    await LIVE.n2aConvertTextWithEnv({
      textFiles: { text: [{ name: 'huge.txt', size: 60 * 1024 * 1024, text: async () => '' }] },
      pasted: sampleWs,
      reading: false,
      abortRef: n2aAbort,
      setReading: v => n2aBusyTrace.push(v),
      setError: v => { n2aErr = v; },
      setResults: fn => { n2aResults = typeof fn === 'function' ? fn(n2aResults) : fn; },
      deck: 'NUR221::Exam2',
      extraTags: ['Exam 2'],
      mode: 'text',
      base: f => String(f.name || '').replace(/\.[^.]+$/, ''),
    });
    const n2aOk =
      n2aErr === '' &&
      n2aBusyTrace[0] === true && n2aBusyTrace[n2aBusyTrace.length - 1] === false &&
      n2aAbort.current === null &&
      n2aResults.text && n2aResults.text.cards.length === 1 &&
      n2aResults.text.warnings.some(w => w.includes('larger than 50 MB')) &&
      n2aResults.text.initExtraTags.includes('Exam_2') &&
      n2aResults.text.text.includes('#deck:NUR221::Exam2');

    // 1b. kbTranscribeCardsWithEnv (card 1 clean across 2 runs; card 2 triggers 429 halt)
    const savedCardFilePayload = ctx.cardFilePayload;
    const savedFetch1 = ctx.fetch;
    const txBusyTrace = [];
    let txErr = '', txTranscripts = {};
    const txAbort = { current: null };
    const card1 = { name: 'card1.png', size: 120, lastModified: 1, type: 'image/png' };
    const card2 = { name: 'card2.png', size: 120, lastModified: 2, type: 'image/png' };
    let txCalls = 0;
    try {
      ctx.cardFilePayload = async () => ({ mimeType: 'image/png', data: 'AAAA', bytes: 3, resized: false });
      ctx.fetch = async () => {
        txCalls++;
        if (txCalls <= 2) {
          return makeGeminiOk(JSON.stringify({
            face: 'front', category: 'Cardiac', cardNumber: 12,
            sections: [{ heading: 'Signs', bullets: ['Crackles'] }],
            numerics: [{ raw: '3.5-5.0 mEq/L', context: 'Potassium' }],
            overallLegibility: 'clean',
          }));
        }
        return {
          ok: false, status: 429,
          headers: { get: k => String(k || '').toLowerCase() === 'retry-after' ? '120' : 'application/json' },
          json: async () => ({ error: { message: 'RESOURCE_EXHAUSTED quota exceeded' } }),
          text: async () => '{"error":{"message":"RESOURCE_EXHAUSTED quota exceeded"}}',
        };
      };
      await LIVE.kbTranscribeCardsWithEnv({
        files: [card1, card2],
        cfg: baseCfg,
        txAbortRef: txAbort,
        setTxBusy: v => txBusyTrace.push(v),
        setTxErr: v => { txErr = v; },
        setTxReviewed: () => {},
        addLog: () => {},
        txRuns: 2,
        setTranscripts: fn => { txTranscripts = typeof fn === 'function' ? fn(txTranscripts) : fn; },
        currentFiles: { current: [card1, card2] },
      });
    } finally {
      ctx.cardFilePayload = savedCardFilePayload;
      ctx.fetch = savedFetch1;
    }
    const c1Key = Object.keys(txTranscripts).find(k => k.includes('card1.png'));
    const c2Key = Object.keys(txTranscripts).find(k => k.includes('card2.png'));
    const txOk =
      txBusyTrace[0] === true && txBusyTrace[txBusyTrace.length - 1] === false &&
      txAbort.current === null &&
      c1Key && txTranscripts[c1Key].runs.length === 2 && !txTranscripts[c1Key].comparisonIncomplete &&
      c2Key && txTranscripts[c2Key].comparisonIncomplete === true && Boolean(txTranscripts[c2Key].error) &&
      /Transcription stopped at card2\.png/i.test(txErr);

    // 1c. gizmoPrepareInputWithEnv (live mode tier filter + upload/paste merge)
    const prepLive = LIVE.gizmoPrepareInputWithEnv({
      sourceMode: 'live',
      liveDeck: {
        cards: [
          { id: 'c1', text: 'Furosemide lowers {{c1::potassium}}', extra: 'Monitor K+', tags: 'Tier::1 LATTE::Assess', tier: 1, keep: true, pipeCount: 2, parseIssues: [] },
          { id: 'c2', text: 'BNP rises in {{c1::heart failure}}', extra: '>100', tags: 'Tier::2 LATTE::Labs', tier: 2, keep: true, pipeCount: 2, parseIssues: [] },
        ],
      },
      liveTier: '1',
      liveIncludeSources: false,
      fileEntries: [],
      pasted: '',
    });
    const prepUpload = LIVE.gizmoPrepareInputWithEnv({
      sourceMode: 'upload',
      liveDeck: null,
      liveTier: 'all',
      liveIncludeSources: false,
      fileEntries: [{ name: 'deck1.txt', text: 'Furosemide lowers {{c1::potassium}}|Monitor K+|Tier_1\n' }],
      pasted: 'Digoxin hold if HR {{c1::<60}}|Check apical pulse|Tier_1\n',
    });
    const gizmoPrepOk =
      prepLive.cards.length === 1 && prepLive.sourceLabel.includes('Tier 1') &&
      prepUpload.cards.length === 2 && prepUpload.cards[1].index === 2 && prepUpload.outBase === 'gizmo';

    // 1d. gizmoRunAiConvertWithEnv (2 chunks: chunk 1 AI succeeds, chunk 2 invalid JSON -> deterministic fallback keeps all 6 cards)
    const savedFetch2 = ctx.fetch;
    let gizmoCall = 0, gizmoResult = null, gizmoErr = '';
    const gizmoBusy = [], gizmoAbort = { current: null };
    const sixCards = Array.from({ length: 6 }, (_, i) => ({
      index: i + 1, lineNumber: i + 1,
      rawFront: `Concept ${i + 1}: Potassium normal is {{c1::3.5-5.0 mEq/L}}`,
      rawBack: 'Monitor ECG',
    }));
    try {
      ctx.fetch = async () => {
        gizmoCall++;
        if (gizmoCall === 1) {
          return makeGeminiOk(JSON.stringify({
            cards: sixCards.slice(0, 5).map(c => ({ index: c.index, front: `Concept ${c.index}: Potassium normal is [3.5-5.0 mEq/L]`, back: 'Monitor ECG' })),
          }));
        }
        return makeGeminiOk('NOT_VALID_JSON_AT_ALL');
      };
      await LIVE.gizmoRunAiConvertWithEnv({
        canRun: true,
        preparedInput: { cards: sixCards, warnings: [], sourceLabel: 'test', outBase: 'exam2' },
        aiBatchSize: 5,
        abortRef: gizmoAbort,
        setError: v => { gizmoErr = v; },
        setLogs: () => {},
        setBusy: v => gizmoBusy.push(v),
        setProgress: () => {},
        pushLog: () => {},
        model: 'gemini-4-hydrogen',
        toolLevel: 'low',
        cfg: baseCfg,
        setResult: v => { gizmoResult = v; },
        setChunkIdx: () => {},
        setCopiedChunks: () => {},
        cardsPerPage: 20,
        setRangeStart: () => {},
        setRangeEnd: () => {},
        pagesPerChunk: 2,
        result: null,
        systemInstruction: LIVE.GIZMO_CONVERT_PROMPT,
        responseJsonSchema: LIVE.GIZMO_RESPONSE_JSON_SCHEMA,
      });
    } finally {
      ctx.fetch = savedFetch2;
    }
    const gizmoRunOk =
      gizmoErr === '' &&
      gizmoBusy[0] === true && gizmoBusy[gizmoBusy.length - 1] === false &&
      gizmoAbort.current === null &&
      gizmoResult && gizmoResult.cards.length === 6 &&
      gizmoResult.warnings.some(w => /deterministic verbatim fallback|deterministic verbatim formatting/i.test(w)) &&
      gizmoResult.outName === 'exam2_gizmo.txt';

    // 1e. caRunAnalysisWithEnv (happy path + re-entrancy rejection while abortRef is active)
    const savedFetch3 = ctx.fetch;
    let caResult = null, caErr = '', caProg = 0, caEditPts = '', caEditConcepts = '';
    const caBusy = [], caAbort = { current: null };
    let caFetchCount = 0;
    try {
      ctx.fetch = async () => {
        caFetchCount++;
        return makeGeminiOk(JSON.stringify({
          overarchingConcepts: ['Perfusion', 'Fluid and Electrolytes'],
          outcomes: ['Evaluate manifestations of heart failure'],
          pointGroups: [{ heading: 'Perfusion', points: ['Monitor potassium on loop diuretics', 'Hold digoxin when apical pulse < 60'] }],
          additionalContext: ['Exam 2 focuses on bedside safety.'],
          coverageReport: {
            materialsAnalyzed: ['syllabus.txt'],
            majorConceptsCovered: ['Perfusion'],
            missingOrUnreadable: [],
            uncertainOrDiscrepancies: [],
            sourceVerification: ['Verified against syllabus.txt'],
          },
        }));
      };
      await LIVE.caRunAnalysisWithEnv({
        cfg: baseCfg,
        course: 'NUR221',
        exam: 'Exam 2',
        notes: 'Professor stressed diuretic safety',
        files: [{ name: 'syllabus.txt', size: 120, lastModified: 1, text: async () => 'Week 4: Perfusion, Heart Failure, Loop Diuretics, Digoxin toxicity.' }],
        fileRoles: {},
        abortRef: caAbort,
        setBusy: v => caBusy.push(v),
        setError: v => { caErr = v; },
        setProg: v => { caProg = v; },
        setLogs: () => {},
        pushLog: () => {},
        setResult: v => { caResult = v; },
        setEditConcepts: v => { caEditConcepts = v; },
        setEditOutcomes: () => {},
        setEditPoints: v => { caEditPts = v; },
        setEditExtra: () => {},
      });
      // Re-entrancy guard: if abortRef.current is already set, second invocation must no-op
      caAbort.current = new AbortController();
      await LIVE.caRunAnalysisWithEnv({
        cfg: baseCfg, course: 'NUR221', exam: 'Exam 2', notes: '',
        files: [{ name: 'syllabus.txt', size: 10, lastModified: 1, text: async () => 'x' }],
        fileRoles: {}, abortRef: caAbort, setBusy: () => {}, setError: () => {}, setProg: () => {},
        setLogs: () => {}, pushLog: () => {}, setResult: () => {}, setEditConcepts: () => {},
        setEditOutcomes: () => {}, setEditPoints: () => {}, setEditExtra: () => {},
      });
      caAbort.current = null;
    } finally {
      ctx.fetch = savedFetch3;
    }
    const caOk =
      caErr === '' && caFetchCount === 1 && caProg === 100 &&
      caBusy[0] === true && caBusy[caBusy.length - 1] === false &&
      caResult && caResult.overarchingConcepts.includes('Perfusion') &&
      caResult.coverageReport.materialsAnalyzed.some(m => m.includes('syllabus.txt')) &&
      caEditConcepts.includes('Perfusion') && caEditPts.includes('Monitor potassium');

    t('v21.10 Phase 6 (H24 — Live *WithEnv orchestrators batch 1): n2aConvertTextWithEnv, kbTranscribeCardsWithEnv, gizmoPrepareInputWithEnv, gizmoRunAiConvertWithEnv, and caRunAnalysisWithEnv run end-to-end with cleanup and error guards',
      n2aOk && txOk && gizmoPrepOk && gizmoRunOk && caOk);
  }

  // ── 2. H24 Batch 2: Live *WithEnv orchestrators (paRunAnalysis, nclexRunSplit, nclexRunMain, ngRunGenerator, caseRunBatch) ──
  {
    const kb = makeMinimalKB();
    const baseCfg = {
      apiKey: 'AIzaSyPhase6SecretKey99999',
      autoProfile: true,
      forTool: () => ({ model: 'gemini-4-hydrogen', level: 'low' }),
    };

    // 2a. paRunAnalysisWithEnv
    const savedFetchPa = ctx.fetch;
    let paStep = '', paProg = 0, paErr = '', paTiers = null, paHarvest = null, paBusy = null, paAbort = 'unset';
    let paCalls = 0;
    try {
      ctx.fetch = async () => {
        paCalls++;
        if (paCalls === 1) return makeGeminiOk('HARVESTED: Heart Failure potassium 3.5-5.0 mEq/L [hf-1]; digoxin hold <60 [hf-2].');
        return makeGeminiOk([
          '## TIER 1: CRITICAL SAFETY & IMMEDIATE INTERVENTION',
          '- Monitor serum potassium 3.5-5.0 mEq/L before furosemide [hf-1].',
          '- Hold digoxin if apical pulse < 60 beats/min [hf-2].',
          '## TIER 2: HIGH-YIELD CLINICAL MANAGEMENT',
          '- Report weight gain >= 2 lb/day [hf-3].',
        ].join('\n'));
      };
      await LIVE.paRunAnalysisWithEnv({
        cfg: baseCfg,
        analysisSlot: { current: LIVE.createOperationSlot() },
        setResultSource: () => {},
        setHarvestState: v => { paHarvest = v; },
        setMeta: () => {},
        K: { knowledgeBase: kb, isCurrentSource: s => s === kb },
        setError: v => { paErr = v; },
        setStep: fn => { paStep = typeof fn === 'function' ? fn(paStep) : fn; },
        paIncludeBridge: false,
        kbTiers: [1, 2],
        kbConditionFilter: '',
        chunkSize: 12000,
        overlapSize: 500,
        analysisSource: { current: null },
        setAnalysisBusy: v => { paBusy = v; },
        setProgress: v => { paProg = v; },
        setPhase: () => {},
        setOutput: () => {},
        setParsedTiers: v => { paTiers = v; },
        setChunks: () => {},
        setIsStreaming: () => {},
        setAbortController: v => { paAbort = v; },
        context: 'Exam 2',
      });
    } finally {
      ctx.fetch = savedFetchPa;
    }
    const paOk =
      paCalls === 2 && paErr === '' && paStep === 'results' && paProg === 100 &&
      paBusy === false && paAbort === null &&
      paHarvest && paHarvest.successful === 1 && paTiers && Object.keys(paTiers).length >= 1;

    // 2b. nclexRunSplitWithEnv (restores missing options from page text & marks unmatched Q3)
    const savedExtractPage = ctx.nclexExtractPageRange;
    const savedSleep = ctx._sleep;
    const splitTrack = { attempted: 0, succeeded: 0, failed: [], review: 0, notes: [], duplicates: 0, rejected: 0 };
    let splitOut = [];
    try {
      ctx._sleep = async () => {};
      let pageCall = 0;
      ctx.nclexExtractPageRange = async () => {
        pageCall++;
        if (pageCall === 1) {
          return [
            '1. A client receives furosemide. Which electrolyte should be monitored first?\nA. Potassium\nB. Calcium\nC. Sodium\nD. Chloride',
            '2. A client is prescribed digoxin. Which pulse requires holding the dose?\nA. 54 beats/min\nB. 72 beats/min\nC. 80 beats/min\nD. 88 beats/min',
            '3. A client has heart failure. Which daily weight change warrants calling the provider?\nA. 2 lb in 24 hours\nB. 0.5 lb in 24 hours\nC. 1 lb in 1 week\nD. 0 lb change',
          ].join('\n\n');
        }
        return [
          '1. Answer: A. Potassium is lost with loop diuretics.',
          '2. Answer: A. Hold digoxin below 60 beats/min.',
        ].join('\n\n');
      };
      splitOut = await LIVE.nclexRunSplitWithEnv({
        addLog: () => {},
        qRanges: [{ start: 1, end: 2 }],
        aRanges: [{ start: 3, end: 4 }],
        nclexCallGemini: async () => ([
          { question_number: 'Q1', question: 'A client receives furosemide. Which electrolyte should be monitored first?', correct_answer: 'A', rationale: 'Loop diuretics waste potassium.' },
          { question_number: 2, question: 'A client is prescribed digoxin. Which pulse requires holding the dose?\nA. 54 beats/min\nB. 72 beats/min\nC. 80 beats/min\nD. 88 beats/min', correct_answer: 'A', rationale: 'Hold < 60.' },
          { question_number: 3, question: 'A client has heart failure. Which daily weight change warrants calling the provider?\nA. 2 lb in 24 hours\nB. 0.5 lb in 24 hours\nC. 1 lb in 1 week\nD. 0 lb change', correct_answer: 'A', rationale: 'Model fallback.' },
        ]),
        batchSize: 10,
        model: 'gemini-4-hydrogen',
        setProgress: () => {},
        admit: (seen, allQ, items) => { for (const x of items) allQ.push(x); },
      }, { name: 'qbank.pdf' }, [], new AbortController().signal, splitTrack);
    } finally {
      ctx.nclexExtractPageRange = savedExtractPage;
      ctx._sleep = savedSleep;
    }
    const splitOk =
      splitOut.length === 3 &&
      splitOut[0].options_repaired === true && splitOut[0].question.includes('A. Potassium') &&
      splitOut[2].answer_unmatched === true && !splitOut[0].answer_unmatched &&
      splitTrack.succeeded === 1 && splitTrack.review >= 1;

    // 2c. nclexRunMainWithEnv (single-file guard in split mode, destroyPdfDoc cleanup, and secret redaction on error)
    const savedDestroy = ctx.destroyPdfDoc;
    const destroyed = [], mainRanFiles = [];
    let mainStatus = '', mainSummary = null, mainErr = '';
    const mainAbort = { current: null };
    try {
      ctx.destroyPdfDoc = f => destroyed.push(f.name);
      await LIVE.nclexRunMainWithEnv({
        cfg: baseCfg,
        files: [{ name: 'first.pdf' }, { name: 'second.pdf' }],
        mode: 'split',
        iRangeOn: false,
        model: 'gemini-4-hydrogen',
        toolLevel: 'low',
        abortRef: mainAbort,
        setError: v => { mainErr = v; },
        setQuestions: () => {},
        setRunSummary: v => { mainSummary = v; },
        setLog: () => {},
        setStatus: v => { mainStatus = v; },
        addLog: () => {},
        runInline: async () => [],
        runSplit: async (file, allQ, _sig, track) => {
          mainRanFiles.push(file.name);
          track.attempted++; track.succeeded++;
          return [...allQ, { id: 'q1', question: 'Q1' }];
        },
      });
      // Error path scrubs API key
      await LIVE.nclexRunMainWithEnv({
        cfg: baseCfg,
        files: [{ name: 'err.pdf' }],
        mode: 'inline',
        iRangeOn: false,
        model: 'gemini-4-hydrogen',
        toolLevel: 'low',
        abortRef: mainAbort,
        setError: v => { mainErr = v; },
        setQuestions: () => {},
        setRunSummary: () => {},
        setLog: () => {},
        setStatus: () => {},
        addLog: () => {},
        runInline: async () => { throw new Error('Upstream error for key ' + baseCfg.apiKey); },
        runSplit: async () => [],
      });
    } finally {
      ctx.destroyPdfDoc = savedDestroy;
    }
    const mainOk =
      mainRanFiles.length === 1 && mainRanFiles[0] === 'first.pdf' &&
      destroyed.includes('first.pdf') && destroyed.includes('err.pdf') &&
      mainStatus === 'done' && mainSummary && mainSummary.status === 'complete' &&
      mainAbort.current === null &&
      !mainErr.includes(baseCfg.apiKey) && mainErr.includes('[REDACTED]');

    // 2d. ngRunGeneratorWithEnv
    const savedFetchNg = ctx.fetch;
    let ngBatches = [], ngCov = null, ngBusy = null, ngRegistered = null;
    const sampleNgRaw = [
      'PART 1: CONCEPT INVENTORY',
      'C1 | Furosemide potassium safety | fact-1 | Assess',
      'C2 | Digoxin apical pulse hold | fact-2 | Treat',
      '',
      'PART 2: SELECTION & GROUNDING AUDIT',
      'Q1 -> cites [C1] (fact-1)',
      'Q2 -> cites [C2] (fact-2)',
      'DISTRIBUTION: 2 MCQ, 0 SATA',
      '',
      'PART 3: QUESTIONS',
      '1. A client is prescribed furosemide for heart failure. Which laboratory value should the nurse verify prior to administration?',
      'A. Serum potassium',
      'B. Serum amylase',
      'C. Hemoglobin A1C',
      'D. Serum bilirubin',
      '',
      '2. Before administering scheduled digoxin, which assessment finding requires the nurse to hold the dose and notify the provider?',
      'A. Apical pulse of 54 beats/min',
      'B. Respiratory rate of 18 breaths/min',
      'C. Temperature of 37.0 C',
      'D. Blood pressure of 122/76 mmHg',
      '',
      'PART 4: ANSWER KEY & RATIONALES',
      '1. ANSWER: A',
      'Why A is correct: Monitor serum potassium 3.5-5.0 mEq/L before giving furosemide [fact-1].',
      'Why B is wrong: Amylase assesses pancreatic injury, not loop diuretic electrolyte loss.',
      'Why C is wrong: Hemoglobin A1C reflects chronic glycemia.',
      'Why D is wrong: Bilirubin reflects hepatic processing.',
      'Tags: Perfusion, Tier1',
      '',
      '2. ANSWER: A',
      'Why A is correct: Hold digoxin and notify provider when apical pulse is below 60 beats/min [fact-2].',
      'Why B is wrong: Respiratory rate of 18 is within expected limits.',
      'Why C is wrong: Temperature of 37.0 C is normal.',
      'Why D is wrong: Blood pressure of 122/76 mmHg is stable.',
      'Tags: Perfusion, Tier1',
    ].join('\n');
    try {
      ctx.fetch = async () => makeGeminiOk(sampleNgRaw);
      await LIVE.ngRunGeneratorWithEnv({
        cfg: baseCfg,
        log: () => {},
        K: {
          knowledgeBase: kb,
          isCurrentSource: s => s === kb,
          registerArtifact: (kind, entries) => { ngRegistered = { kind, entries }; },
        },
        generatorSlot: { current: LIVE.createOperationSlot() },
        setArtifactSource: () => {},
        targetCount: 2,
        runAudit: false,
        setAuditState: () => {},
        currentSourceKB: { current: kb },
        setBusy: v => { ngBusy = v; },
        setProg: () => {},
        setLogs: () => {},
        setBatches: v => { ngBatches = v; },
        setCoverage: v => { ngCov = v; },
        setShowUncov: () => {},
        setAbortCtl: () => {},
        setProvenance: () => {},
        setTrackers: () => {},
        setLiveKB: () => {},
        numBatches: 1,
        batchSize: 2,
        hasStructuredScope: false,
        nclexScope: null,
        kbIncludeBridge: false,
        kbTiers: [1, 2],
        kbConditionFilter: '',
        allocMode: true,
        factsPerQ: 2,
        points: '',
        outcomes: '',
        buildBatchBlock: () => '\nBATCH 1 of 1: 2 questions\n',
        buildFocusBlock: () => '',
      });
    } finally {
      ctx.fetch = savedFetchNg;
    }
    const ngOk =
      ngBusy === false && ngBatches.length === 1 && ngBatches[0].qCount === 2 &&
      ngCov && ngCov.cited >= 1 && ngRegistered && ngRegistered.kind === 'nclexQuestions';

    // 2e. caseRunBatchWithEnv (sequential batchOverrideRef execution & final packet auto-select)
    const batchOverrideRef = { current: null };
    const casePacketRef = { current: [] };
    const caseStudyRef = { current: null };
    const seenBatchConds = [];
    let batchBusy = null, batchStatus = 'unset', selectedEntry = null;
    await LIVE.caseRunBatchWithEnv({
      cfg: baseCfg,
      batchPlan: {
        targets: [
          { condition: kb.conditions[0], facts: kb.conditions[0].facts.slice(0, 2), sufficiency: { ok: true } },
          { condition: { id: 'copd', name: 'COPD', facts: kb.conditions[0].facts.slice(2, 4) }, facts: kb.conditions[0].facts.slice(2, 4), sufficiency: { ok: true } },
        ],
        skipped: [],
        overflowCount: 0,
      },
      generatorSlot: { current: LIVE.createOperationSlot() },
      batchBusy: false,
      K: { knowledgeBase: kb },
      batchCancelRef: { current: false },
      setBatchBusy: v => { batchBusy = v; },
      setLogs: () => {},
      log: () => {},
      currentSourceKB: { current: kb },
      setBatchStatus: v => { batchStatus = v; },
      batchOverrideRef,
      run: async () => {
        const ovr = batchOverrideRef.current;
        seenBatchConds.push({ name: ovr.condition.name, keepLogs: ovr.keepLogs, hasPktId: /^pkt-/.test(ovr.packetId) });
        ovr.completed = true;
        casePacketRef.current.push({ id: ovr.packetId, condition: ovr.condition.name });
      },
      caseStudyRef,
      casePacketRef,
      selectPacketEntry: e => { selectedEntry = e; },
    });
    const batchOk =
      seenBatchConds.length === 2 &&
      seenBatchConds[0].name === 'Heart Failure' && seenBatchConds[1].name === 'COPD' &&
      seenBatchConds.every(x => x.keepLogs && x.hasPktId) &&
      batchOverrideRef.current === null &&
      batchBusy === false && batchStatus === null &&
      selectedEntry && selectedEntry.condition === 'COPD';

    t('v21.10 Phase 6 (H24 — Live *WithEnv orchestrators batch 2): paRunAnalysisWithEnv, nclexRunSplitWithEnv, nclexRunMainWithEnv, ngRunGeneratorWithEnv, and caseRunBatchWithEnv execute live pipelines cleanly',
      paOk && splitOk && mainOk && ngOk && batchOk);
  }

  // ── 3. H24 Batch 3: Live <head> DOMPurify Fallback Loader & bootFail Latch via vm.runInContext ──
  {
    const tplMatch = S.match(/<template id="dompurify-fallback"><script src="([^"]+)" integrity="([^"]+)" crossorigin="([^"]+)"><\/script><\/template>/);
    if (!tplMatch) throw new Error('Phase 6: missing dompurify-fallback template in HTML');
    const [, fallbackSrc, fallbackSri, fallbackCors] = tplMatch;

    const makeHeadEnv = initialDomPurify => {
      const appendedHead = [], appendedBody = [];
      const rootEl = { id: 'root', innerHTML: 'Loading...' };
      const byId = new Map([
        ['root', rootEl],
        ['dompurify-fallback', {
          content: {
            querySelector: sel => sel === 'script' ? {
              getAttribute: k => ({ src: fallbackSrc, integrity: fallbackSri, crossorigin: fallbackCors }[k] || null),
            } : null,
          },
        }],
      ]);
      const doc = {
        head: { appendChild: el => { appendedHead.push(el); return el; } },
        body: {
          appendChild: el => {
            appendedBody.push(el);
            if (el.id) byId.set(el.id, el);
            return el;
          },
        },
        getElementById: id => byId.get(id) || null,
        createElement: tag => ({
          tagName: tag.toUpperCase(), id: '', textContent: '', attrs: {},
          setAttribute(k, v) { this.attrs[k] = v; },
          appendChild(c) { (this.children = this.children || []).push(c); return c; },
        }),
        addEventListener() {},
      };
      const timers = [];
      const win = {
        DOMPurify: initialDomPurify,
        Babel: {}, React: {}, ReactDOM: {}, marked: {}, pdfjsLib: {},
        addEventListener() {},
      };
      const env = {
        window: win,
        document: doc,
        Promise,
        Boolean,
        String,
        setTimeout: fn => { timers.push(fn); return timers.length; },
        ensureDomPurifyHooks: null,
      };
      return { env, win, doc, rootEl, appendedHead, appendedBody, timers };
    };

    // Scenario A: primary missing -> jsDelivr fallback loads cleanly -> __domPurifyReady resolves true
    const scA = makeHeadEnv(undefined);
    let hooksCalled = 0;
    scA.env.ensureDomPurifyHooks = () => { hooksCalled++; };
    vm.runInContext(domPurifyScript.code, vm.createContext(scA.env), { filename: 'head-dompurify-A.js' });
    const fbTagA = scA.appendedHead[0];
    scA.win.DOMPurify = { sanitize: s => s, isSupported: true };
    fbTagA.onload();
    const resA = await scA.win.__domPurifyReady;

    // Scenario B: both CDNs fail -> halt banner latches once and resists late bootFail timeout overwrite
    const scB = makeHeadEnv(undefined);
    const ctxB = vm.createContext(scB.env);
    vm.runInContext(domPurifyScript.code, ctxB, { filename: 'head-dompurify-B.js' });
    vm.runInContext(bootFailScript.code, ctxB, { filename: 'head-bootfail-B.js' });
    scB.appendedHead[0].onerror();
    const resB = await scB.win.__domPurifyReady;
    const rootBeforeTimeout = scB.rootEl.innerHTML;
    // Simulate late 12s startup timeout firing
    for (const fn of scB.timers) fn();
    scB.win.__latteBootFail('Late secondary error');

    // Scenario C: non-callable DOMPurify.sanitize or isSupported:false rejected and halts
    const scC = makeHeadEnv({ sanitize: 'not-a-function', isSupported: true });
    const ctxC = vm.createContext(scC.env);
    vm.runInContext(domPurifyScript.code, ctxC, { filename: 'head-dompurify-C.js' });
    const badPrimaryCheck = ctxC._hasDomPurify();
    scC.win.DOMPurify = { sanitize: s => s, isSupported: false };
    scC.appendedHead[0].onload();
    const resC = await scC.win.__domPurifyReady;

    t('v21.10 Phase 6 (H24 — Live <head> DOMPurify fallback & halt latch): fallback SRI loads cleanly, dual-CDN failure latches halt banner against late timeout, and spoofed/unsupported DOMPurify is rejected',
      fbTagA && fbTagA.src === fallbackSrc && fbTagA.integrity === fallbackSri && fbTagA.crossOrigin === 'anonymous' &&
      resA === true && hooksCalled === 1 && !scA.win.__latteBootFailed &&
      resB === false && scB.win.__latteBootFailed === true &&
      scB.appendedBody.length === 1 && scB.appendedBody[0].id === 'latte-sanitizer-halt' &&
      scB.rootEl.innerHTML === rootBeforeTimeout &&
      badPrimaryCheck === false && resC === false && scC.win.__latteBootFailed === true);
  }

  // ── 4. H24 Batch 4: Fake-IndexedDB kbOpenDB & kbRunTx Lifecycle ──
  {
    const savedIDB = ctx.indexedDB;
    let upgradedStore = null, versionClosed = 0, blockedMsg = '', timeoutMsg = '', lateClosed = 0;
    let txResolved = null, txClosedOk = 0, txAbortedMsg = '', txClosedAbort = 0;
    let bodyErrMsg = '', bodyAbortThrowMsg = '', bodyAbortThrowClosed = 0;
    try {
      // 4a. Upgrade + onversionchange close
      ctx.indexedDB = {
        open() {
          const req = {};
          const stores = new Set();
          const db = {
            objectStoreNames: { contains: name => stores.has(name) },
            createObjectStore: name => { stores.add(name); upgradedStore = name; },
            close() { versionClosed++; },
          };
          queueMicrotask(() => {
            req.result = db;
            if (req.onupgradeneeded) req.onupgradeneeded();
            if (req.onsuccess) req.onsuccess();
          });
          return req;
        },
      };
      const db1 = await LIVE.kbOpenDB(500);
      db1.onversionchange();

      // 4b. Blocked upgrade
      ctx.indexedDB = {
        open() {
          const req = {};
          queueMicrotask(() => { if (req.onblocked) req.onblocked(); });
          return req;
        },
      };
      try { await LIVE.kbOpenDB(500); } catch (e) { blockedMsg = e.message; }

      // 4c. Watchdog timeout + late onsuccess closes leaked connection
      let lateReq = null;
      ctx.indexedDB = {
        open() { lateReq = {}; return lateReq; },
      };
      try { await LIVE.kbOpenDB(20); } catch (e) { timeoutMsg = e.message; }
      lateReq.result = { close() { lateClosed++; } };
      lateReq.onsuccess();

      // 4d. kbRunTx success -> resolves + closes
      const fakeDbOk = {
        close() { txClosedOk++; },
        transaction() {
          const tx = { objectStore: () => ({ get: () => {} }) };
          queueMicrotask(() => tx.oncomplete && tx.oncomplete());
          return tx;
        },
      };
      txResolved = await LIVE.kbRunTx(fakeDbOk, 'readonly', (_store, setVal) => setVal('SAVED_KB'));

      // 4e. kbRunTx onabort -> rejects + closes (never hangs)
      const fakeDbAbort = {
        close() { txClosedAbort++; },
        transaction() {
          const tx = { objectStore: () => ({}), error: null };
          queueMicrotask(() => tx.onabort && tx.onabort());
          return tx;
        },
      };
      try { await LIVE.kbRunTx(fakeDbAbort, 'readwrite', () => {}); } catch (e) { txAbortedMsg = e.message; }

      // 4f. kbRunTx synchronous body throw (both abort fires onabort AND abort itself throws)
      const fakeDbBodyErr = {
        close() {},
        transaction() {
          const tx = {
            objectStore: () => ({}),
            abort() { queueMicrotask(() => tx.onabort && tx.onabort()); },
          };
          return tx;
        },
      };
      try {
        await LIVE.kbRunTx(fakeDbBodyErr, 'readwrite', () => { throw new Error('DataCloneError: non-cloneable'); });
      } catch (e) { bodyErrMsg = e.message; }

      const fakeDbAbortThrows = {
        close() { bodyAbortThrowClosed++; },
        transaction() {
          return {
            objectStore: () => ({}),
            abort() { throw new Error('InvalidStateError'); },
          };
        },
      };
      try {
        await LIVE.kbRunTx(fakeDbAbortThrows, 'readwrite', () => { throw new Error('QuotaExceeded body'); });
      } catch (e) { bodyAbortThrowMsg = e.message; }
    } finally {
      ctx.indexedDB = savedIDB;
    }

    t('v21.10 Phase 6 (H24 — Fake-IndexedDB kbOpenDB & kbRunTx lifecycle): upgrade store creation, versionchange close, blocked/timeout + late-open cleanup, tx abort rejection, and synchronous body throw handling all work cleanly',
      upgradedStore === LIVE.KB_DB_STORE &&
      versionClosed === 1 &&
      /blocked by another open tab/i.test(blockedMsg) &&
      /timed out/i.test(timeoutMsg) &&
      lateClosed === 1 &&
      txResolved === 'SAVED_KB' && txClosedOk === 1 &&
      /aborted/i.test(txAbortedMsg) && txClosedAbort === 1 &&
      bodyErrMsg === 'DataCloneError: non-cloneable' &&
      bodyAbortThrowMsg === 'QuotaExceeded body' && bodyAbortThrowClosed === 1);
  }

  // ── 5. H24 Batch 5a: Live Babel-compiled CaseRenderer Interactive NGN Controls (Bowtie, Matrix single/multi, Cloze, Trend) ──
  {
    const Babel = loadBabelInstance();
    const caseRendererSrc = extractSpan(S, 'function CaseRenderer({caseStudy:cs}){', '\nfunction GizmoImporter(){');
    const rt = createMinimalReact(new Map());
    const compiled = Babel.transform(
      'const {useState,useRef,useCallback,useEffect,useMemo,useContext}=React;\n' +
      caseRendererSrc + '\nreturn CaseRenderer;',
      { presets: ['react'], parserOpts: { allowReturnOutsideFunction: true } }
    ).code;
    const CaseRenderer = new Function('React', 'FactTag', 'caseFormatAnswerSummary', compiled)(
      rt.React,
      ({ factId }) => rt.React.createElement('span', { className: 'fact-tag' }, factId),
      q => (q.correctAnswers || []).join(', ')
    );

    const ngnCase = {
      condition: 'Heart Failure',
      difficulty: 'exam',
      patient: { age: 68, sex: 'F', background: 'Admitted with dyspnea.' },
      stages: [{
        stageNumber: 1,
        title: 'Acute Decompensation',
        narrative: 'Crackles bilaterally.',
        data: [{ label: 'BNP', value: '820 pg/mL', factIds: ['hf-4'], supportType: 'direct' }],
        questions: [
          {
            type: 'Bowtie',
            stem: 'Complete the diagram by selecting 2 actions, 1 condition, and 2 parameters.',
            options: [
              { label: 'A1', group: 'actions', text: 'Administer IV furosemide' },
              { label: 'A2', group: 'actions', text: 'Apply supplemental oxygen' },
              { label: 'A3', group: 'actions', text: 'Elevate head of bed' },
              { label: 'A4', group: 'actions', text: 'Give 1 L NS bolus' },
              { label: 'C1', group: 'condition', text: 'Fluid volume deficit' },
              { label: 'C2', group: 'condition', text: 'Acute pulmonary edema' },
              { label: 'C3', group: 'condition', text: 'Hypoglycemia' },
              { label: 'P1', group: 'parameters', text: 'Serum potassium' },
              { label: 'P2', group: 'parameters', text: 'Urine output' },
              { label: 'P3', group: 'parameters', text: 'Oxygen saturation' },
            ],
            correctAnswers: ['A1', 'A2', 'C2', 'P1', 'P3'],
            rationales: [{ option: 'A1', text: 'Reduces preload.', factIds: ['hf-1'] }],
          },
          {
            type: 'Matrix',
            stem: 'Indicate whether each finding is Expected or Unexpected.',
            matrix: {
              mode: 'single',
              columns: [{ id: 'C1', label: 'Expected' }, { id: 'C2', label: 'Unexpected' }],
              rows: [
                { id: 'R1', text: 'Bibasilar crackles' },
                { id: 'R2', text: 'Clear breath sounds' },
              ],
            },
            correctAnswers: ['R1:C1', 'R2:C2'],
            rationales: [],
          },
          {
            type: 'Matrix',
            stem: 'Select all applicable columns for each nursing action.',
            matrix: {
              mode: 'multiple',
              columns: [{ id: 'C1', label: 'Monitor Labs' }, { id: 'C2', label: 'Bedside Safety' }],
              rows: [{ id: 'R1', text: 'Loop diuretic therapy' }],
            },
            correctAnswers: ['R1:C1', 'R1:C2'],
            rationales: [],
          },
          {
            type: 'Cloze',
            stem: 'The client is at highest risk for {{D1}} as evidenced by {{D2}}.',
            options: [
              { label: 'A', group: 'D1', text: 'Hyperkalemia' },
              { label: 'B', group: 'D1', text: 'Hypokalemia' },
              { label: 'C', group: 'D2', text: 'Potassium 2.9 mEq/L' },
              { label: 'D', group: 'D2', text: 'Potassium 5.9 mEq/L' },
            ],
            correctAnswers: ['B', 'C'],
            rationales: [],
          },
          {
            type: 'Trend',
            stem: 'Review the trend table. Which prescription is priority?',
            trendTable: {
              timepoints: ['0800', '1000'],
              rows: [{ label: 'SpO2', values: ['94%', '87%'], factIds: ['hf-1'] }],
            },
            options: [
              { label: 'A', text: 'Administer IV furosemide' },
              { label: 'B', text: 'Document and recheck in 4 hours' },
            ],
            correctAnswers: ['A'],
            rationales: [{ option: 'A', text: 'Declining SpO2 indicates worsening pulmonary congestion.', factIds: ['hf-1'] }],
          },
        ],
      }],
    };

    const renderCase = () => rt.render('case', CaseRenderer, { caseStudy: ngnCase });
    let tree = renderCase();

    const findBowtieBtn = prefix => collectNodes(tree, n => n.type === 'button' && nodeText(n).startsWith(prefix + '.'))[0];
    // Bowtie: click A1, A2, A3 -> cap-2 slides to A2 & A3; click C1 then C2 -> C2 replaces C1 WITHOUT wiping A2/A3; click P1, P3 then toggle P1 off
    for (const lbl of ['A1', 'A2', 'A3', 'C1', 'C2', 'P1', 'P3', 'P1']) {
      findBowtieBtn(lbl).props.onClick();
      tree = renderCase();
    }
    const bowtieStateOk =
      findBowtieBtn('A1').props['aria-pressed'] === false &&
      findBowtieBtn('A2').props['aria-pressed'] === true &&
      findBowtieBtn('A3').props['aria-pressed'] === true &&
      findBowtieBtn('C1').props['aria-pressed'] === false &&
      findBowtieBtn('C2').props['aria-pressed'] === true &&
      findBowtieBtn('P1').props['aria-pressed'] === false &&
      findBowtieBtn('P3').props['aria-pressed'] === true;

    // Matrix single (radio replace) & multiple (checkbox toggle)
    const findInput = label => collectNodes(tree, n => n.type === 'input' && n.props['aria-label'] === label)[0];
    findInput('Bibasilar crackles — Expected').props.onChange();
    tree = renderCase();
    findInput('Bibasilar crackles — Unexpected').props.onChange();
    tree = renderCase();
    const matrixSingleOk =
      findInput('Bibasilar crackles — Expected').props.checked === false &&
      findInput('Bibasilar crackles — Unexpected').props.checked === true;

    findInput('Loop diuretic therapy — Monitor Labs').props.onChange();
    tree = renderCase();
    findInput('Loop diuretic therapy — Bedside Safety').props.onChange();
    tree = renderCase();
    const matrixMultiBoth =
      findInput('Loop diuretic therapy — Monitor Labs').props.checked === true &&
      findInput('Loop diuretic therapy — Bedside Safety').props.checked === true;
    findInput('Loop diuretic therapy — Monitor Labs').props.onChange();
    tree = renderCase();
    const matrixMultiToggle =
      findInput('Loop diuretic therapy — Monitor Labs').props.checked === false &&
      findInput('Loop diuretic therapy — Bedside Safety').props.checked === true;

    // Cloze dropdown
    const findSelect = label => collectNodes(tree, n => n.type === 'select' && n.props['aria-label'] === label)[0];
    findSelect('Blank D1').props.onChange({ target: { value: 'B' } });
    tree = renderCase();
    const clozeOk = findSelect('Blank D1').props.value === 'B' && findSelect('Blank D2').props.value === '';

    // Trend table renders + Show answer reveals keyed grading
    const trendHasTable = nodeText(tree).includes('0800') && nodeText(tree).includes('87%');
    const toggleBtns = collectNodes(tree, n => n.type === 'button' && /Show answer & rationale/.test(nodeText(n)));
    toggleBtns[0].props.onClick(); // Bowtie answer reveal
    toggleBtns[4].props.onClick(); // Trend answer reveal
    tree = renderCase();
    const revealOk =
      nodeText(findBowtieBtn('A2')).includes('✓') &&
      nodeText(findBowtieBtn('A3')).includes('✕') &&
      nodeText(tree).includes('Declining SpO2 indicates worsening pulmonary congestion.');

    t('v21.10 Phase 6 (H24 — Live CaseRenderer NGN interactions): Bowtie per-column 2/1/2 caps + Condition isolation + grading, Matrix single radio replace & multiple toggle, Cloze dropdown selection, and Trend table + key reveal all work',
      bowtieStateOk && matrixSingleOk && matrixMultiBoth && matrixMultiToggle && clozeOk && trendHasTable && revealOk);
  }

  // ── 6. H24 Batch 5b: Live CourseAnalyzer -> CourseBriefCtx -> KnowledgeBaseBuilder Handoff ──
  {
    const Babel = loadBabelInstance();
    const kbbSrc = extractSpan(S, 'function KnowledgeBaseBuilder(){', '\nfunction PriorityAnalyzer(){');

    const contexts = new Map();
    const rt = createMinimalReact(contexts);
    const h = rt.React.createElement;
    const Pass = props => h('div', props, props.setup, props.action, props.children);

    // Boot a dedicated VM realm with our stateful React + the full live plain script block,
    // so KnowledgeBaseBuilder resolves every live helper directly without manual allowlists.
    const kbbWin = { ...fakeWindow, React: rt.React };
    const kbbSandbox = {
      ...sandbox,
      window: kbbWin,
      self: kbbWin,
      React: rt.React,
      Workbench: Pass,
      NumberInput: () => null,
      useCappedLog: () => {
        const [l, setL] = rt.React.useState([]);
        return [l, x => setL(p => [...p, x]), setL];
      },
    };
    kbbSandbox.globalThis = kbbSandbox;
    const kbbCtx = vm.createContext(kbbSandbox);
    vm.runInContext(mainPlainScript.code, kbbCtx, { filename: 'suite-plain-kbb.js' });
    // Keep child layout primitives stateless during tree traversal so Disclose's internal useState
    // does not advance KnowledgeBaseBuilder's hook cursor inside collectNodes/nodeText.
    kbbCtx.Disclose = Pass;
    kbbCtx.Step = Pass;
    kbbCtx.Panel = Pass;
    kbbCtx.ResultsHead = Pass;
    kbbCtx.EmptyState = () => null;
    kbbCtx.RunStatus = () => null;
    const kbbCompiled = Babel.transform(kbbSrc, { presets: ['react'] }).code;
    vm.runInContext(kbbCompiled, kbbCtx, { filename: 'KnowledgeBaseBuilder.jsx' });
    const { ConfigCtx, KnowledgeCtx, CourseBriefCtx, KnowledgeBaseBuilder } = vm.runInContext(
      '({ ConfigCtx, KnowledgeCtx, CourseBriefCtx, KnowledgeBaseBuilder })',
      kbbCtx
    );

    const emptyKB = { conditions: [], medications: [], diagnostics: [], scoringTools: [] };
    const cfg = {
      apiKey: 'AIzaSyTest', autoProfile: true,
      forTool: () => ({ model: 'gemini-4-hydrogen', level: 'medium' }),
    };
    const K = {
      knowledgeBase: emptyKB,
      setKnowledgeBase() {},
      isCurrentSource: () => true,
      recovery: [],
      restoreRecovery() {},
      dismissRecovery() {},
    };
    contexts.set(ConfigCtx, cfg);
    contexts.set(KnowledgeCtx, K);
    contexts.set(CourseBriefCtx, null);

    // Step 1: Build handoff via live caBuildKbHandoff (exact CourseAnalyzer sendToKb call) + App sentAt stamp
    const lecFile = { name: 'HeartFailureSlides.pptx', size: 4200, lastModified: 100 };
    const handoffPayload = {
      ...LIVE.caBuildKbHandoff({
        course: 'NUR221',
        exam: 'Exam 2',
        concepts: 'Perfusion, Fluid Balance',
        outcomes: 'Prioritize nursing actions for acute heart failure',
        points: '1. Monitor potassium on furosemide\n2. Hold digoxin if HR < 60',
        additionalContext: 'Instructor emphasized bedside safety traps.',
      }, [lecFile]),
      sentAt: 1700000001234,
    };

    // Initial mount (no handoff yet)
    rt.render('kbb', KnowledgeBaseBuilder, {});
    // Deliver handoff through CourseBriefCtx (simulating CourseAnalyzer -> App.sendCourseBriefToKb)
    contexts.set(CourseBriefCtx, handoffPayload);
    rt.render('kbb', KnowledgeBaseBuilder, {});
    // Re-render once so React state setters triggered inside useEffect reflect in rendered controls
    let kbbTree = rt.render('kbb', KnowledgeBaseBuilder, {});

    const getInputByPlaceholder = ph => collectNodes(kbbTree, n => (n.type === 'input' || n.type === 'textarea') && String(n.props.placeholder || '').includes(ph))[0];
    const getInputById = id => collectNodes(kbbTree, n => (n.type === 'input' || n.type === 'textarea' || n.type === 'select') && n.props.id === id)[0];
    const allText1 = nodeText(kbbTree);
    const inputs1 = collectNodes(kbbTree, n => n.type === 'input' || n.type === 'textarea');
    const hasCourseVal = inputs1.some(n => n.props.value === 'NUR221');
    const hasExamVal = inputs1.some(n => n.props.value === 'Exam 2');
    const hasConceptsVal = inputs1.some(n => n.props.value === 'Perfusion, Fluid Balance');
    const hasOutcomesVal = inputs1.some(n => n.props.value === 'Prioritize nursing actions for acute heart failure');
    const hasPointsVal = inputs1.some(n => String(n.props.value || '').includes('Monitor potassium on furosemide'));
    const hasExtraVal = inputs1.some(n => n.props.value === 'Instructor emphasized bedside safety traps.');
    const hasCarriedFile = allText1.includes('HeartFailureSlides.pptx');
    const hasHandoffBanner = allText1.includes('Synced from 01 · Course Analyzer (NUR221 · Exam 2)') && allText1.includes('2 atomic point(s)');

    // Step 2: Single-consumption guard — user edits course to 'NUR221-Edited'; re-rendering with the SAME sentAt must NOT overwrite it
    const courseInput = inputs1.find(n => n.props.value === 'NUR221');
    courseInput.props.onChange({ target: { value: 'NUR221-Edited' } });
    kbbTree = rt.render('kbb', KnowledgeBaseBuilder, {});
    const preservedEdit = collectNodes(kbbTree, n => n.type === 'input' && n.props.value === 'NUR221-Edited').length === 1;

    // Step 3: External KB replacement clears stale handoffNotice banner
    contexts.set(KnowledgeCtx, { ...K, knowledgeBase: makeMinimalKB() });
    rt.render('kbb', KnowledgeBaseBuilder, {});
    kbbTree = rt.render('kbb', KnowledgeBaseBuilder, {});
    const clearedBanner = !nodeText(kbbTree).includes('Synced from 01 · Course Analyzer');

    rt.unmount('kbb');
    void getInputByPlaceholder; void getInputById;

    t('v21.10 Phase 6 (H24 — Live CourseAnalyzer -> KnowledgeBaseBuilder handoff): caBuildKbHandoff populates course, exam, concepts, outcomes, points, extra context, carried lecture file, and notice banner; single-consumption guard preserves user edits; external KB change clears banner',
      hasCourseVal && hasExamVal && hasConceptsVal && hasOutcomesVal && hasPointsVal && hasExtraVal &&
      hasCarriedFile && hasHandoffBanner && preservedEdit && clearedBanner);
  }

  // ── 7. L1 & L2: Dead-Code Removal & Utility Consolidation ──
  {
    const deadRemoved =
      !S.includes('function FactText(') &&
      !S.includes('wsErrCount') &&
      !S.includes('panelRef') &&
      !S.includes('JSON.parse(artifactJsonExport(') &&
      !LIVE.CASE_CLINICAL_TOKEN_RE.source.includes('%\\b');

    const artObj = LIVE.artifactJsonExport({ id: 'a1', text: 'ok' }, 'notice', [], [], true);
    const pktJson = LIVE.casePacketJsonExport([{ id: 'p1', condition: 'HF', caseStudy: { condition: 'HF', stages: [] }, validation: [], auditRows: [] }], 'notice');
    const pktParsed = JSON.parse(pktJson);

    const pTagClean = LIVE.ankiStripPTags('Monitor potassium [P1] [NONE] daily') === 'Monitor potassium daily';
    const litMatch = LIVE.ankiLiteralMatches('Monitor serum potassium 3.5-5.0 mEq/L', '3.5-5.0') &&
      !LIVE.ankiLiteralMatches('Monitor 13.5 mEq/L', '3.5');
    const stemNorm = LIVE.nclexStripStemPrefix('Q12.  Monitor potassium') === 'monitor potassium';
    const ansLabels = LIVE.n2aMatchAnswerLabels('B, D', [['A', 'x'], ['B', 'y'], ['C', 'z'], ['D', 'w']], false);
    const vitD = LIVE.n2aSplitStemOptions('Give vitamin D. Monitor calcium levels.\nA. First\nB. Second\nC. Third\nD. Fourth', true);
    const inlineA = LIVE.n2aSplitStemOptions('Which action first? A. Check airway\nB. Call provider\nC. Document\nD. Discharge', true);

    const cliFiles = ['verify-repo.js', 'tools/check-prompts.js', 'tools/render-prompts.js']
      .map(f => fs.readFileSync(path.join(rootDir, f), 'utf8'));
    const noArgValue = cliFiles.every(src => !src.includes('function argValue('));

    t('v21.10 Phase 6 (L1 & L2 — Dead code removal & helper consolidation): dead symbols/round-trip parse removed, shared HTML helpers work live (including vitamin D exemption & inline-A split), and tooling extracts extractSpan/drops argValue',
      deadRemoved &&
      typeof artObj === 'object' && artObj.id === 'a1' && artObj._suiteReview && artObj._suiteReview.notice === 'notice' &&
      Array.isArray(pktParsed.cases) && pktParsed.cases.length === 1 &&
      pTagClean && litMatch && stemNorm &&
      ansLabels.join(',') === 'B,D' &&
      vitD[0].includes('vitamin D.') && vitD[1].length === 4 &&
      inlineA[1].length === 4 && inlineA[1][0][0] === 'A' &&
      typeof extractSpan === 'function' && noArgValue);
  }

  // ── 8. L3 & L4: Item Auditor Parser, Answer-Accuracy Detection, Repair Renderers & Letter-Ref Guard ──
  {
    const accOk =
      LIVE.itemAuditIsAnswerAccuracy('Criterion 3') &&
      LIVE.itemAuditIsAnswerAccuracy('3. Answer Accuracy') &&
      LIVE.itemAuditIsAnswerAccuracy('ACCURACY') &&
      !LIVE.itemAuditIsAnswerAccuracy('Criterion 1 (Cueing)');

    const vMd = LIVE.itemParseAuditVerdict('- **FAIL — Criterion 3**\n- `WARN Distractor — Weak stem`');
    const vBareFail = LIVE.itemParseAuditVerdict('**FAIL**');
    const vBareReview = LIVE.itemParseAuditVerdict('REVIEW');
    const vUnparse = LIVE.itemParseAuditVerdict('Looks mostly okay to me.');

    const keyParsed = LIVE.ngParseKeyItem({
      num: 1,
      text: '1. ANSWER: A\nWhy A is correct: Skin tags: benign lesions are harmless.\nTags: Integumentary, Tier1',
    });
    const qRendered = LIVE.ngRenderQuestionBlock(1, {
      stem: 'Line one\nLine two?',
      options: [{ label: 'a', text: 'First\nline' }, { label: 'b', text: 'Second' }],
    });
    const kRendered = LIVE.ngRenderKeyBlock(1, {
      correctLabel: 'a',
      rationales: [
        { label: 'a', text: 'Correct\nreason' },
        { label: 'b', text: 'Wrong\nreason' },
      ],
    }, 'Airway first', 'Tags: Safety');
    const letterRefOk =
      LIVE.itemRefersByLetter('Answers A and C are correct', ['A', 'B', 'C', 'D']) &&
      LIVE.itemRefersByLetter('Select answers B, D together', ['A', 'B', 'C', 'D']) &&
      !LIVE.itemRefersByLetter('Choose answer B first', ['A', 'B', 'C', 'D']) &&
      !LIVE.itemRefersByLetter('Give vitamin B12 orally', ['A', 'B', 'C', 'D']);

    t('v21.10 Phase 6 (L3 & L4 — Auditor verdict parsing, repair renderers & letter-ref guard): Criterion 3/bare Accuracy, Markdown/em-dash/bare FAIL/REVIEW/unparseable detail, line-anchored Tags:, single-line uppercase repair blocks, and answer-letter refs all pass',
      accOk &&
      vMd.status === 'FAIL' && vMd.criterion === 'Criterion 3' && vMd.warns.length === 1 && vMd.warns[0].criterion === 'Distractor' &&
      vBareFail.status === 'FAIL' && vBareFail.criterion === 'Unspecified criterion' &&
      vBareReview.status === 'REVIEW' &&
      vUnparse.status === 'REVIEW' && vUnparse.detail === 'Unparseable auditor response' &&
      keyParsed.rationales.some(r => r.text.includes('Skin tags: benign lesions')) &&
      qRendered.includes('1. Line one Line two?') && qRendered.includes('A. First line') &&
      kRendered.includes('1. ANSWER: A') && kRendered.includes('Why A is correct: Correct reason') && kRendered.includes('Why B is wrong: Wrong reason') &&
      letterRefOk);
  }

  // ── 9. L5 & L6: Case Audit Leakage Guard, itemRunPool Hardening, NEIA Terminology Rules & NGN Validation ──
  {
    const leakCase = {
      condition: 'Heart Failure',
      patient: { age: 0, sex: 'M', background: 'Neonate admitted.' },
      stages: [
        {
          stageNumber: 1,
          title: 'Patient Arrival',
          narrative: 'Initial presentation.',
          data: [{ label: 'HR', value: '140 beats/min', factIds: ['fact-1'] }],
          questions: [
            { type: 'MCQ', stem: 'First question?', options: [{ label: 'A', text: 'Action 1' }], correctAnswers: ['A'], rationales: [] },
            {
              type: 'Trend', stem: 'Later trend spoiler?',
              trendTable: { timepoints: ['0800', '1000'], rows: [{ label: 'SPOILER_ROW', values: ['99%', '80%'] }] },
              options: [{ label: 'A', text: 'Spoiler' }], correctAnswers: ['A'], rationales: [],
            },
          ],
        },
        { stageNumber: 2, title: 'Stage Two Spoiler', narrative: 'Future stage.', data: [], questions: [] },
      ],
    };
    const auditPay = LIVE.caseAuditPayload(leakCase, 1, leakCase.stages[0].questions[0]);
    const noLeakOk =
      auditPay.includes('Initial presentation.') &&
      !auditPay.includes('SPOILER_ROW') &&
      !auditPay.includes('Stage Two Spoiler');

    // itemRunPool: empty array returns [] even if aborted; falsy 0 preserved in partial; primitive & frozen errors wrapped cleanly
    const abortedCtl = new AbortController();
    abortedCtl.abort();
    const emptyRes = await LIVE.itemRunPool([], 3, async x => x, abortedCtl.signal);
    let primErr = null, frozenErr = null;
    try {
      await LIVE.itemRunPool([0, 1], 1, async x => { if (x === 0) return 0; throw 'quota-string'; });
    } catch (e) { primErr = e; }
    try {
      await LIVE.itemRunPool([0, 1], 1, async x => { if (x === 0) return false; throw Object.freeze(new Error('frozen-err')); });
    } catch (e) { frozenErr = e; }
    const VmError = vm.runInContext('Error', ctx);
    const poolOk =
      Array.isArray(emptyRes) && emptyRes.length === 0 &&
      primErr instanceof VmError && primErr.message === 'quota-string' && Array.isArray(primErr.partial) && primErr.partial[0] === 0 &&
      frozenErr instanceof VmError && frozenErr.message === 'frozen-err' && Array.isArray(frozenErr.partial) && frozenErr.partial[0] === false;

    // NEIA terminology exemptions & multi-digit trailing zeros / leading decimal
    const termHits = txt => { const out = []; LIVE.neiaTerminologyScan(txt, 'test', out); return out; };
    const pcaExempt = termHits('Client uses patient-controlled analgesia and patient care technician with MDS screening.').length === 0;
    const termFlags =
      termHits('Notify the MD immediately.').length >= 1 &&
      termHits('Give 5.00 mg IV.').length >= 1 &&
      termHits('Administer 5.50 mL PO.').length >= 1 &&
      termHits('Give .5 units insulin.').length >= 1;

    // validateCaseStudy scans stage.title for NEIA terminology; caseToMarkdown keeps age: 0 and Client:; caseBuildPrompt escapes double quotes in conditionName
    const factIdx = LIVE.buildFactIndex(makeMinimalKB());
    const caseIssues = LIVE.validateCaseStudy(leakCase, factIdx);
    const titleScanned = caseIssues.some(i => /Stage 1 title/i.test(i.msg) && /Client/i.test(i.msg));
    const mdOut = LIVE.caseToMarkdown(leakCase);
    const mdOk = mdOut.includes('**Client:** 0 y/o, M') && !mdOut.includes('**Patient:**');
    const safePrompt = LIVE.caseBuildPrompt({
      conditionName: 'Heart "Acute" Failure',
      facts: makeMinimalKB().conditions[0].facts,
      difficulty: 'exam', stages: 2, questionsPerStage: 2,
      includeTypes: { mcq: true },
    });
    const safeCondOk = safePrompt.includes("Heart 'Acute' Failure") && !safePrompt.includes('"Heart "Acute" Failure"');

    // selectCaseFacts: numeric top-up sorted by rank (past cap 4) & parent concept lookup excludes entityKind
    const parentEntityFake = { id: 'med-perf', name: 'Perfusion', entityKind: 'medication', facts: [{ id: 'ent-1', tier: 1, latteBucket: 'Look', text: 'Fake entity fact' }] };
    const parentConceptReal = { id: 'con-perf', name: 'Perfusion', entryRole: 'concept', facts: [{ id: 'con-1', tier: 1, latteBucket: 'Look', text: 'Real concept fact' }] };
    const condWithNums = {
      id: 'c-num', name: 'Shock', concept: 'Perfusion',
      facts: [
        ...Array.from({ length: 12 }, (_, i) => ({ id: 't1-' + i, tier: 1, safetyCritical: false, latteBucket: 'Treat', text: 'Core non-numeric intervention ' + i })),
        ...Array.from({ length: 5 }, (_, i) => ({ id: 'num-low-' + i, tier: 2, safetyCritical: false, latteBucket: 'Treat', text: 'Low-priority dose ' + (10 + i) + ' mg PO' })),
        { id: 'num-hi', tier: 1, safetyCritical: true, latteBucket: 'Treat', text: 'Critical lactate > 4 mmol/L requires immediate sepsis bundle' },
      ],
    };
    const selected = LIVE.selectCaseFacts(condWithNums, { includeTier2: true, includeCalculation: true, allConditions: [parentEntityFake, parentConceptReal, condWithNums] });
    const selectOk =
      selected.some(f => f.id === 'num-hi') &&
      selected.some(f => f.id === 'con-1') &&
      !selected.some(f => f.id === 'ent-1');

    // caseValidateNgnQuestion rejects non-empty options on Matrix
    const matrixIssues = [];
    LIVE.caseValidateNgnQuestion({
      type: 'Matrix',
      stem: 'Select.',
      options: [{ label: 'A', text: 'Stray option' }],
      matrix: { mode: 'single', columns: [{ id: 'C1', label: 'Yes' }, { id: 'C2', label: 'No' }], rows: [{ id: 'R1', text: 'Item 1' }] },
      correctAnswers: ['R1:C1'],
      rationales: [{ option: 'R1:C1', text: 'Because.', factIds: ['fact-1'] }],
    }, 'S1 Q1', factIdx, () => {}, new Set(), new Set(), new Set(), matrixIssues);
    const matrixOptErr = matrixIssues.some(i => i.sev === 'error' && /Matrix questions must keep "options" empty/i.test(i.msg));

    t('v21.10 Phase 6 (L5 & L6 — Case audit isolation, itemRunPool, NEIA terminology & NGN validation): stage-question slicing, pool empty/falsy/frozen-error guards, PCA/PCT/MDS exemptions, stage.title scan, neonate age 0, ranked numeric top-up, and Matrix options rejection all pass',
      noLeakOk && poolOk && pcaExempt && termFlags && titleScanned && mdOk && safeCondOk && selectOk && matrixOptErr);
  }

  // ── 10. L7: Anki, NCLEX Extractor & Converter Null-Safety & Boundary Fixes ──
  {
    const diagSafe = LIVE.ankiBatchDiagnostics([], {}, true);
    const outSafe = LIVE.ankiGenerationOutcome([{ id: '1' }], null, null);
    const origRun = { status: 'running', sessions: [{ groupIds: ['g1'], finishedAt: null }], responses: [] };
    const snapRun = LIVE.ankiSourceAuditState(origRun, 'done', 'ok');
    const nonMutating = origRun.status === 'running' && origRun.sessions[0].finishedAt === null && snapRun.status === 'done';

    // ankiStampConceptTags & ankiStampLayerTags skip lint-invalid cards
    const badCard = { raw: 'no cloze here|extra|Tier1', text: 'no cloze here', extra: 'extra', tags: 'Tier1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['f1'] };
    const snapMeta = { facts: [{ id: 'f1', concept: 'Perfusion', clinicalLayer: 'bridge' }] };
    const stampedConcept = LIVE.ankiStampConceptTags([badCard], snapMeta);
    const stampedLayer = LIVE.ankiStampLayerTags([badCard], snapMeta);
    const stampLintOk = stampedConcept[0].tags === 'Tier1' && stampedLayer[0].tags === 'Tier1';

    // nclexChunkText null-safe
    const chunkNull = LIVE.nclexChunkText(null, 1000, 100);

    // nclexRepairOptions / nclexMergePairs reject 1-4 char junk stems
    const shortRepair = LIVE.nclexRepairOptions({ question: 'A.', correct_answer: 'A' }, 'A completely different full question\nA. One\nB. Two\nC. Three\nD. Four');
    const shortMerge = LIVE.nclexMergePairs(
      [{ number: 1, question: 'A.', answer: '', matched: false }],
      [{ number: 1, question: 'Different long stem text here', answer: 'B', matched: true }]
    );

    // n2aKeyFit zero-overlap returns 0 (not 1); n2aRealignKey rejects non-contiguous numbering
    const fitZero = LIVE.n2aKeyFit(
      { options: [['A', '10'], ['B', '20'], ['C', '30']] },
      { why: new Map([['A', ['ok', 'alpha beta']], ['B', ['no', 'gamma delta']], ['C', ['no', 'epsilon zeta']]]) }
    );
    const nonContig = LIVE.n2aRealignKey([
      { n: 1, dup: false, key: { answer: '[not parsed]', why: new Map() } },
      { n: 5, dup: false, key: { answer: 'A', why: new Map() } },
      { n: 5, dup: true, key: { answer: 'B', why: new Map() } },
    ], new Map());

    // x2aBuildCard negated rationale ("not the correct answer") does not false-flag as correct
    const [negCard] = LIVE.x2aBuildCard({
      question: 'Which action first?\nA. Assess airway\nB. Give oral water\nC. Document\nD. Discharge',
      answer: 'A',
      rationale: 'A: Assessing airway is priority.\nB: Giving water is not the correct answer due to aspiration risk.',
    }, 'test', []);
    const negRationaleOk = Boolean(negCard && negCard.back) && !negCard.back.includes('✓ B.') && negCard.back.includes('not the correct answer');

    // N2A_PDF_CHROME strips Page / PM while keeping lowercase hyphenated clinical terms
    const chromeOk =
      LIVE.N2A_PDF_CHROME.test('Page 2 of 5') &&
      LIVE.N2A_PDF_CHROME.test('11/19/26, 2:15 PM') &&
      !LIVE.N2A_PDF_CHROME.test('over-the-counter') &&
      !LIVE.N2A_PDF_CHROME.test('end-of-life');

    // n2aPdfChoiceLines captures 9th choice (I.); n2aPdfKeyLines parses 4-digit keys (1000. ANSWER: A)
    const nineChoices = LIVE.n2aPdfChoiceLines('A. One B. Two C. Three D. Four E. Five F. Six G. Seven H. Eight I. Nine');
    const fourDigitKey = LIVE.n2aPdfKeyLines('1000. ANSWER: A Why A is correct: Verified.', new Map(), '');

    t('v21.10 Phase 6 (L7 — Anki, Extractor & Converter null-safety and boundaries): missing rawCards/summary guards, immutable audit snapshot, lint-gated tag stampers, null chunking, short-stem guard, zero-overlap n2aKeyFit, contiguous realign, negated rationale match, hyphenated PDF term preservation, 9 choices, and 4-digit keys all pass',
      diagSafe && diagSafe.collisions && typeof diagSafe.collisions.groups === 'number' &&
      outSafe.status === 'complete' &&
      nonMutating && stampLintOk &&
      Array.isArray(chunkNull) && chunkNull.length === 0 &&
      !shortRepair.options_repaired && shortMerge.collisions === 1 &&
      fitZero === 0 && nonContig.length === 0 &&
      negRationaleOk && chromeOk &&
      Array.isArray(nineChoices) && nineChoices.length === 9 && nineChoices[8].startsWith('I.') &&
      Array.isArray(fourDigitKey) && fourDigitKey[0].startsWith('1000. ANSWER: A'));
  }

  // ── 11. M19 & M20: Script Quarantine, UI Tool Numbers, render-prompts.js Dynamic Builders & Doc Sync ──
  {
    const archivedScripts = [
      'audit-anki-lifecycle-tests.js', 'audit-anki-receipt-tests.js',
      'audit-anki-source-tests.js', 'audit-anki-transform-tests.js',
      'reaudit-anki-lifecycle-tests.js', 'reaudit-anki-receipt-tests.js',
      'reaudit-anki-source-tests.js', 'reaudit-anki-transform-tests.js',
    ];
    const archiveDir = path.join(rootDir, 'docs', 'history', 'anki-audit-scripts');
    const quarantinedOk =
      fs.existsSync(path.join(archiveDir, 'README.md')) &&
      archivedScripts.every(name =>
        !fs.existsSync(path.join(rootDir, 'tools', name)) &&
        fs.existsSync(path.join(archiveDir, name))
      );

    const runtimeCode = scriptBlocks.map(b => b.code).join('\n');
    const uiNumbersOk =
      runtimeCode.includes('04 · Anki') &&
      runtimeCode.includes('05 · NCLEX Extract') &&
      !runtimeCode.includes('03 · Anki') &&
      !runtimeCode.includes('04 · NCLEX Extract');

    const suiteFile = resolveSuiteFile({ rootDir });
    const promptCheckCount = checkPromptDoc({ suiteFile });
    const buildersPresent = ['paBuildExtractPrompt', 'paBuildSynthPrompt', 'caseBuildPrompt', 'itemBuildAuditPrompt', 'caseBuildRepairPrompt']
      .every(fn => extractBuilderFunction(S, fn).startsWith('function ' + fn + '('));

    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
    const decisions = fs.readFileSync(path.join(rootDir, 'DECISIONS.md'), 'utf8');
    const development = fs.readFileSync(path.join(rootDir, 'DEVELOPMENT.md'), 'utf8');
    const plateGuide = fs.readFileSync(path.join(rootDir, 'docs', 'PLATE-Tagging-and-Exam-Study-Guide.md'), 'utf8');

    const docsOk =
      readme.includes('## 01 · Source — Nursing Course Analyzer') && readme.includes('gemini-4-neon') && !readme.includes('gemini-4-argon') &&
      decisions.includes('gemini-4-neon') && decisions.includes('SCHEMA_VERSION = 3') && !decisions.includes('All 11 frozen') &&
      development.includes('docs/history/anki-audit-scripts/') && development.includes('5 dynamic prompt builders') &&
      plateGuide.includes('--match "Heart Failure"') && !plateGuide.includes('--query "Heart Failure"');

    t('v21.10 Phase 6 (M19 & M20 — Quarantine, UI numbering, dynamic prompt builders & doc sync): 8 legacy audit scripts quarantined, UI tool numbers updated to 04/05, Prompts.md validates 25 constants + 5 dynamic builders, and docs synced to v21.10',
      quarantinedOk && uiNumbersOk && promptCheckCount === 25 && buildersPresent && docsOk);

    // ── 12. v21.11 Option A (M7 Privacy & Release Lock): Zero Google Fonts, native font CSS vars, and version parity ──
    const ver = suiteVersionFromFilename(suiteFile);
    const noGoogleFonts =
      !S.includes('fonts.googleapis.com') &&
      !S.includes('fonts.gstatic.com') &&
      !S.includes("fontFamily:'JetBrains Mono'") &&
      !S.includes("fontFamily:'DM Sans'") &&
      S.includes("style-src 'unsafe-inline'; font-src 'none'") &&
      S.includes("function suiteVersion(){return '" + ver + "';}");
    t('v21.11 Option A (M7 — Zero external font hosts & native font stacks): Google Fonts links/CSP removed, inline styles use CSS font variables, and suiteVersion() matches canonical HTML filename',
      noGoogleFonts);

    // ── 13. v21.11 Option B (M7 — Native Bounded ZIP Reader replacing JSZip): STORED + DEFLATE, ZIP64, encrypted, spoofed EOCD, forged bomb ──
    const { makeZipBytes } = require('./production-resource-transport-tests');
    const VmU8 = vm.runInContext('Uint8Array', ctx);
    const toVmU8 = b => new VmU8(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    // STORED + DEFLATE round-trip
    const storedZip = LIVE._pptxParseZip(toVmU8(makeZipBytes({ 'a.xml': 'Hello μg stored' }, { compress: false })));
    const storedTxt = await LIVE.pptxReadXml(storedZip.files['a.xml'], { bytes: 0 });
    const deflateZip = LIVE._pptxParseZip(toVmU8(makeZipBytes({ 'b.xml': 'Hello μg deflate '.repeat(200) }, { compress: true })));
    const deflateTxt = await LIVE.pptxReadXml(deflateZip.files['b.xml'], { bytes: 0 });
    // ZIP64 EOCD marker rejected
    const zip64Bytes = toVmU8(makeZipBytes({ 'a.xml': 'x' }, { compress: false, eocdCountOverride: 0xFFFF }));
    let zip64Err = '';
    try { LIVE._pptxParseZip(zip64Bytes); } catch (e) { zip64Err = e.message; }
    // Encrypted entry rejected
    const encBytes = toVmU8(makeZipBytes({ 'a.xml': 'x' }, { compress: false, flags: 1 }));
    let encErr = '';
    try { LIVE._pptxParseZip(encBytes); } catch (e) { encErr = e.message; }
    // Spoofed EOCD count (declares 1 while CD contains 10,001 entries) rejected
    const floodEntries = Object.fromEntries(Array.from({ length: LIVE.PPTX_LIMITS.entries + 1 }, (_, i) => ['f' + i, '']));
    let floodErr = '';
    try { LIVE._pptxParseZip(toVmU8(makeZipBytes(floodEntries, { compress: false, eocdCountOverride: 1 }))); } catch (e) { floodErr = e.message; }
    // Forged uncompSize=1 DEFLATE bomb (4 MiB + 1) rejected during streaming inflate
    const bombArchive = LIVE._pptxParseZip(toVmU8(makeZipBytes({ 'bomb.xml': Buffer.alloc(LIVE.PPTX_LIMITS.xmlBytes + 1, 65) }, { compress: true, forgedUncompSize: { 'bomb.xml': 1 } })));
    let bombErr = '';
    try { await LIVE.pptxReadXml(bombArchive.files['bomb.xml'], { bytes: 0 }); } catch (e) { bombErr = e.message; }

    t('v21.11 Option B (M7 — Native DecompressionStream ZIP reader): reads STORED & DEFLATE UTF-8 entries cleanly while rejecting ZIP64, encrypted archives, spoofed-EOCD CD floods, and forged-size DEFLATE bombs',
      storedTxt === 'Hello μg stored' &&
      deflateTxt === 'Hello μg deflate '.repeat(200) &&
      /ZIP64/i.test(zip64Err) &&
      /encrypted/i.test(encErr) &&
      /too many ZIP entries/i.test(floodErr) &&
      /expansion exceeds/i.test(bombErr));

    // ── 14. v21.11 Option B (M7 — CDN Debloat & Patch Pin Verification): JSZip removed, Babel 7.29.14 + marked 18.2.1 pinned ──
    const verifierSrc = fs.readFileSync(path.join(rootDir, 'verify-repo.js'), 'utf8');
    const cndDebloatOk =
      !/<script[^>]+jszip/i.test(S) &&
      !/\bJSZip\b/.test(runtimeCode.replace(/\/\/[^\n]*/g, '')) &&
      S.includes('babel-standalone/7.29.14/babel.min.js') &&
      S.includes('marked/18.2.1/lib/marked.umd.min.js') &&
      verifierSrc.includes("const BABEL_VERSION = '7.29.14';") &&
      verifierSrc.includes("'DecompressionStream'") &&
      !verifierSrc.includes("'JSZip'");
    t('v21.11 Option B (M7 — CDN debloat & patch pins): JSZip script/references removed, @babel/standalone@7.29.14 and marked@18.2.1 pinned, and verify-repo.js synced',
      cndDebloatOk);
  }
};
