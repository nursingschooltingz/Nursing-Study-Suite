'use strict';

// v21.10 Phase 1 production code-review remediation regression suite:
// C1 (NCLEXToAnki n2aConvertTextWithEnv ReferenceError), C2 (itemParseAuditVerdict Criterion-11-only downgrade),
// C3 (kbConditionMatchKeys clinical-safety separation), C4 + H21.4 (CaseRenderer Bowtie column caps & Cloze blank grading),
// C5 (DOMPurify callable check, async mount .catch, single bootFail latch), C6 (kbRunTx, kbCreateSaveQueue,
// saveModelSettings, App hydration & chooseRecovery validation/concurrency/identity), M1/M2/H23 (AST free-var gate,
// UTF-8 Babel ceiling, canonical suiteVersion).

const os = require('os');
const path = require('path');
const vm = require('vm');
const {
  BROWSER_BABEL_OPTIONS,
  MAX_BABEL_SCRIPT_CHARS,
  extractBabelScript,
  astFreeVarCheck,
} = require('../verify-repo');

module.exports = async function runV2110Phase1RemediationTests(S, t) {
  function span(start, end, fromAnchor) {
    const base = fromAnchor ? S.indexOf(fromAnchor) : 0;
    if (base < 0) throw new Error('v21.10 Phase 1 from-anchor missing: ' + fromAnchor);
    const a = S.indexOf(start, base);
    if (a < 0) throw new Error('v21.10 Phase 1 start anchor missing: ' + start);
    if (S.indexOf(start, a + start.length) >= 0) throw new Error('v21.10 Phase 1 start anchor ambiguous: ' + start);
    const b = S.indexOf(end, a + start.length);
    if (b < 0) throw new Error('v21.10 Phase 1 end anchor missing after: ' + start);
    return S.slice(a, b);
  }

  const babelPath = process.env.NSS_BABEL_STANDALONE ||
    path.join(os.tmpdir(), 'nursing-study-suite-verify', 'node_modules', '@babel', 'standalone', 'babel.js');
  const Babel = require(babelPath);

  // Extract live clusters from shipped HTML
  const N2A = new Function(
    span('// ──── TOOL: NCLEX to Anki ────', '/* ── END NCLEX TO ANKI PURE HELPERS ── */') + '\n' +
    span('function n2aConvertTextWithEnv(', '// v21.6: lifted pure NCLEX worksheet') +
    '\nreturn { n2aConvertTextWithEnv, n2aConvertExports, n2aTagSafe, n2aAnkiFileText, N2A_KIND_LABEL };'
  )();

  const AUDIT = new Function(
    span('function itemAuditIsAnswerAccuracy(', 'function isQuotaError(') +
    '\nreturn { itemAuditIsAnswerAccuracy, itemParseAuditVerdict };'
  )();

  const KB = new Function(
    span('function kbBuildFocusBlock(', '// Underextraction flag:') + '\n' +
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') +
    '\nreturn { kbIsAbbrevOf, kbConditionMatchKeys, mergeLatteParts, kbDedupEntities };'
  )();

  const PERSIST = new Function(
    'KB_DB_STORE',
    span('function kbRunTx(', 'function kbStoredRecord(') + '\n' +
    span('function kbStoredRecord(', '\nfunction validateLatteKnowledgeBase') +
    '\nreturn { kbRunTx, kbStoredRecord, kbCreateSaveQueue };'
  )('knowledge');

  const MODEL = new Function(
    span('const MODEL_SETTINGS_KEY=', 'const ConfigCtx=createContext();') +
    '\nreturn { loadModelSettings, saveModelSettings };'
  )();

  // 1. Extraction tail assertion
  t('v21.10 Phase 1 (Extraction tail): live C1–C6 & verifier functions compile cleanly',
    typeof N2A.n2aConvertTextWithEnv === 'function' &&
    typeof AUDIT.itemParseAuditVerdict === 'function' &&
    typeof KB.kbIsAbbrevOf === 'function' &&
    typeof KB.kbConditionMatchKeys === 'function' &&
    typeof PERSIST.kbRunTx === 'function' &&
    typeof PERSIST.kbCreateSaveQueue === 'function' &&
    typeof MODEL.saveModelSettings === 'function' &&
    typeof astFreeVarCheck === 'function');

  // 2. C1 — NCLEXToAnki n2aConvertTextWithEnv runs end-to-end without ReferenceError
  {
    const sampleWorksheet = [
      '## Questions',
      '1. A client with heart failure has crackles and 3+ edema. Which medication does the nurse anticipate?',
      'A. Furosemide',
      'B. Normal saline bolus',
      'C. Ibuprofen',
      'D. Potassium chloride',
      '',
      '## Answer Key',
      '1. ANSWER: A',
      'Why A is correct: Furosemide reduces fluid overload.',
      'Why B is wrong: Bolus worsens pulmonary congestion.',
      'Why C is wrong: NSAIDs cause sodium retention.',
      'Why D is wrong: Not indicated without hypokalemia.',
      'Tags: Tier 1 | Take Action'
    ].join('\n');
    const readingStates = [];
    const errors = [];
    let resultsState = { export: null, images: null };
    const abortRef = { current: null };
    await N2A.n2aConvertTextWithEnv({
      textFiles: { export: [{ name: 'hf_exam.md', size: sampleWorksheet.length, text: async () => sampleWorksheet }] },
      pasted: '',
      reading: false,
      abortRef,
      setReading: v => readingStates.push(v),
      setError: e => errors.push(e),
      setResults: fn => { resultsState = fn(resultsState); },
      deck: 'Cardio',
      extraTags: ['Exam1'],
      mode: 'export',
      base: f => f.name.replace(/\.[^.]*$/, '')
    });
    const exp = resultsState.export;
    t('v21.10 Phase 1 (C1 — NCLEXToAnki export conversion): n2aConvertTextWithEnv executes end-to-end without ReferenceError, toggles reading, and produces Anki cards',
      readingStates.join(',') === 'true,false' &&
      errors[0] === '' &&
      abortRef.current === null &&
      Boolean(exp) &&
      exp.cards.length === 1 &&
      exp.outName === 'hf_exam_anki.txt' &&
      exp.cards[0].tags.includes('Exam1') &&
      S.includes('const convertText=()=>n2aConvertTextWithEnv({textFiles,pasted,reading,abortRef,setReading,setError,setResults,deck,extraTags,mode,base});'));
  }

  // 3. C2 — itemParseAuditVerdict only downgrades Criterion-11-exclusive FAILs
  {
    const V = AUDIT.itemParseAuditVerdict;
    const tp1 = V('FAIL — Test Plan Alignment');
    const tp2 = V('FAIL — Alignment with NCLEX-RN Test Plan');
    const tp3 = V('FAIL — 11. Test Plan Alignment');
    const badAcc = V('FAIL — ANSWER ACCURACY — keyed option lacks alignment with stem');
    const badRel = V('FAIL — CLINICAL RELEVANCE: misalignment with scenario');
    const badDist = V('FAIL — Distractor Plausibility — poor alignment with stem');
    const compound1 = V('FAIL — ANSWER ACCURACY and TEST PLAN ALIGNMENT');
    const compound2 = V('FAIL — Test Plan Alignment and Answer Accuracy');
    t('v21.10 Phase 1 (C2 — itemParseAuditVerdict): downgrades Criterion-11-only FAILs while keeping Criteria 1–10 failures mentioning alignment or compound failures as FAIL',
      tp1.status === 'PASS' && tp1.warns.length === 1 &&
      tp2.status === 'PASS' && tp2.warns.length === 1 &&
      tp3.status === 'PASS' && tp3.warns.length === 1 &&
      badAcc.status === 'FAIL' && badAcc.autoRepairable === false &&
      badRel.status === 'FAIL' && badRel.autoRepairable === true &&
      badDist.status === 'FAIL' && badDist.autoRepairable === true &&
      compound1.status === 'FAIL' && compound1.autoRepairable === false &&
      compound2.status === 'FAIL' && compound2.autoRepairable === false);
  }

  // 4. C3 — kbConditionMatchKeys preserves distinct clinical conditions & drug formulations while merging real multi-word acronyms
  {
    const mkPart = (name, text, col = 'conditions') => col === 'conditions'
      ? { source: { filename: 'rn.pdf', range: 'p.1' }, conditions: [{ name, aliases: [], facts: [{ latteBucket: 'Treat', tier: 1, text, sourcePointer: { filename: 'rn.pdf', location: 'p.1' } }] }] }
      : { conditions: [], [col]: [{ name, aliases: [], facts: [{ id: 'f-' + name, latteBucket: 'Treat', tier: 1, text, sources: [{ filename: 'rn.pdf', location: 'p.1' }] }] }] };

    const sepPairs = [
      ['Heart Failure (Left)', 'Heart Failure (Right)'],
      ['Heart Failure (HFrEF)', 'Heart Failure (HFpEF)'],
      ['Myocardial Infarction (STEMI)', 'Myocardial Infarction (NSTEMI)'],
      ['Diabetes Mellitus (T1DM)', 'Diabetes Mellitus (T2DM)'],
      ['Pneumonia (CAP)', 'Pneumonia (HAP)'],
    ];
    const allCondsStaySeparate = sepPairs.every(([a, b]) => {
      const m = KB.mergeLatteParts([mkPart(a, 'Fact A.'), mkPart(b, 'Fact B.')], 'NUR', 'E1');
      return m.conditions.length === 2;
    });

    const medKb = KB.kbDedupEntities({
      conditions: [],
      medications: [
        ...mkPart('Insulin (Regular)', 'IV or SubQ for DKA.', 'medications').medications,
        ...mkPart('Insulin (Lispro)', 'Rapid onset 15 min.', 'medications').medications,
        ...mkPart('Insulin (Glargine)', 'Long-acting basal, never IV.', 'medications').medications,
        ...mkPart('Insulin (NPH)', 'Intermediate cloudy.', 'medications').medications,
        ...mkPart('Heparin (UFH)', 'Monitor aPTT.', 'medications').medications,
        ...mkPart('Heparin (LMWH)', 'SubQ enoxaparin.', 'medications').medications,
        ...mkPart('Metoprolol (Tartrate)', 'Immediate release BID.', 'medications').medications,
        ...mkPart('Metoprolol (Succinate)', 'Extended release daily.', 'medications').medications,
      ],
      diagnostics: [],
      scoringTools: []
    });

    const mergePairs = [
      ['Acute Decompensated Heart Failure (ADHF)', 'ADHF'],
      ['Heart Failure (HF)', 'HF'],
      ['Chronic Kidney Disease (CKD)', 'CKD'],
      ['Heparin-Induced Thrombocytopenia (HIT)', 'HIT'],
    ];
    const allAcronymsMerge = mergePairs.every(([full, acr]) => {
      const m = KB.mergeLatteParts([mkPart(full, 'Fact 1.'), mkPart(acr, 'Fact 2.')], 'NUR', 'E1');
      return m.conditions.length === 1;
    });

    t('v21.10 Phase 1 (C3 — kbConditionMatchKeys clinical safety): keeps distinct disease subtypes & drug formulations separate while merging exact multi-word initialisms',
      allCondsStaySeparate &&
      medKb.medications.length === 8 &&
      allAcronymsMerge &&
      !KB.kbIsAbbrevOf('Heart Failure', 'Left') &&
      !KB.kbIsAbbrevOf('Heart Failure', 'HFrEF') &&
      !KB.kbIsAbbrevOf('Insulin', 'NPH') &&
      KB.kbIsAbbrevOf('Acute Decompensated Heart Failure', 'ADHF'));
  }

  // 5. C4 + H21.4 — Interactive CaseRenderer Bowtie column isolation/caps & Cloze grading
  {
    const crRaw = span('function CaseRenderer({caseStudy:cs}){', '\nfunction GizmoImporter(){');
    const crJs = Babel.transform(crRaw, BROWSER_BABEL_OPTIONS).code;
    const hookState = [{ '1-0': false, '1-1': true }, {}];
    const ReactStub = {
      Fragment: Symbol.for('react.fragment'),
      createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } })
    };
    const render = cs => {
      let idx = 0;
      const CaseRenderer = new Function('React', 'useState', 'FactTag', 'caseFormatAnswerSummary', crJs + '\nreturn CaseRenderer;')(
        ReactStub,
        init => {
          const slot = idx++;
          if (!(slot in hookState)) hookState[slot] = typeof init === 'function' ? init() : init;
          return [hookState[slot], v => { hookState[slot] = typeof v === 'function' ? v(hookState[slot]) : v; }];
        },
        ({ factId }) => ({ type: 'FactTag', props: { factId } }),
        q => (q.correctAnswers || []).join(', ')
      );
      return CaseRenderer({ caseStudy: cs });
    };
    const findAll = (node, pred, out = []) => {
      if (!node || typeof node !== 'object') return out;
      if (Array.isArray(node)) { node.forEach(x => findAll(x, pred, out)); return out; }
      if (pred(node)) out.push(node);
      if (node.props && node.props.children !== undefined) findAll(node.props.children, pred, out);
      return out;
    };
    const bowtieQ = {
      type: 'Bowtie',
      stem: 'Complete the bow-tie.',
      options: [
        { label: 'A1', group: 'actions', text: 'Act 1' }, { label: 'A2', group: 'actions', text: 'Act 2' }, { label: 'A3', group: 'actions', text: 'Act 3' },
        { label: 'C1', group: 'condition', text: 'Cond 1' }, { label: 'C2', group: 'condition', text: 'Cond 2' },
        { label: 'P1', group: 'parameters', text: 'Param 1' }, { label: 'P2', group: 'parameters', text: 'Param 2' }, { label: 'P3', group: 'parameters', text: 'Param 3' },
      ],
      correctAnswers: ['A1', 'A2', 'C2', 'P1', 'P2'],
      rationales: []
    };
    const clozeQ = {
      type: 'Cloze',
      stem: 'Blank {{D1}} and numeric {{D2}}.',
      options: [
        { label: 'D1A', group: 'D1', text: 'Opt A' },
        { label: 1, group: 'D2', text: 'Numeric Opt 1' }
      ],
      correctAnswers: ['1'], // D1 intentionally has no key; D2 has numeric label 1
      rationales: []
    };
    const cs = { condition: 'HF', difficulty: 'exam', patient: {}, stages: [{ stageNumber: 1, title: 'S1', questions: [bowtieQ, clozeQ] }] };
    const clickBowtie = lbl => {
      const tree = render(cs);
      const btn = findAll(tree, n => n.type === 'button' && JSON.stringify(n.props.children).includes('"' + lbl + '"'))[0];
      if (!btn) throw new Error('Missing bowtie button ' + lbl);
      btn.props.onClick();
    };
    clickBowtie('A1'); clickBowtie('A2'); clickBowtie('A3'); // cap 2 -> A2, A3
    const afterActions = [...(hookState[1]['1-0'] || [])];
    clickBowtie('C2'); // Condition must NOT wipe A2, A3
    const afterCond = [...(hookState[1]['1-0'] || [])];
    clickBowtie('C2'); // Clicking selected Condition toggles ONLY C2 off
    const afterCondOff = [...(hookState[1]['1-0'] || [])];
    clickBowtie('C1'); clickBowtie('C2'); // Single-select replaces C1 with C2 without wiping A2, A3
    clickBowtie('P1'); clickBowtie('P2'); clickBowtie('P3'); // cap 2 -> P2, P3
    const finalBowtie = [...(hookState[1]['1-0'] || [])].sort().join(',');

    // Cloze: unanswered D1 with missing key must NOT be green; numeric label '1' on D2 matches green
    hookState[1]['1-1'] = { D1: '', D2: '1' };
    const clozeTree = render(cs);
    const selects = findAll(clozeTree, n => n.type === 'select');
    const d1Style = selects[0]?.props?.style || {};
    const d2Style = selects[1]?.props?.style || {};

    t('v21.10 Phase 1 (C4 & H21.4 — CaseRenderer Bowtie & Cloze): preserves Actions/Parameters on Condition clicks, enforces 2/1/2 caps, toggles Condition cleanly, never grades missing-key Cloze blanks green, and coerces numeric Cloze labels',
      afterActions.sort().join(',') === 'A2,A3' &&
      afterCond.sort().join(',') === 'A2,A3,C2' &&
      afterCondOff.sort().join(',') === 'A2,A3' &&
      finalBowtie === 'A2,A3,C2,P2,P3' &&
      d1Style.borderColor === 'var(--accent)' &&
      d1Style.color === undefined &&
      d2Style.borderColor === 'var(--accent-green)' &&
      d2Style.color === 'var(--accent-green)');
  }

  // 6. C5 — Boot / DOMPurify fail-closed behavioral execution
  {
    const babelStart = S.indexOf('<script type="text/babel"');
    const headScripts = [...S.slice(0, babelStart).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const mountLine = S.slice(S.lastIndexOf('try{if(!window.React)'), S.lastIndexOf('</script>')).trim();
    const mountJs = Babel.transform(mountLine, BROWSER_BABEL_OPTIONS).code;

    function runBootScenario({ initialPurify, fallbackOutcome, mountThrows = false }) {
      const appendedHead = [];
      const appendedBody = [];
      const timeouts = [];
      const rootNode = { innerHTML: 'loading' };
      let bootFailCount = 0;
      let mountedRenders = 0;
      const g = {
        Babel: {},
        React: { createElement: () => ({}) },
        ReactDOM: {
          createRoot: () => ({
            render: () => {
              if (mountThrows) throw new Error('Async mount boom');
              mountedRenders++;
            }
          })
        },
        marked: {},
        pdfjsLib: {},
        DOMPurify: initialPurify,
        App: () => null,
        BootErrorBoundary: () => null,
        console: { error() {}, log() {} },
        setTimeout: fn => { timeouts.push(fn); return 1; },
        clearTimeout() {},
        addEventListener() {},
        document: {
          head: { appendChild: s => appendedHead.push(s) },
          body: { appendChild: n => appendedBody.push(n) },
          getElementById: id => {
            if (id === 'root') return rootNode;
            if (id === 'latte-sanitizer-halt') return appendedBody.find(n => n.id === id) || null;
            if (id === 'dompurify-fallback') {
              return { content: { querySelector: () => ({ getAttribute: k => (k === 'src' ? 'https://cdn.jsdelivr.net/npm/dompurify' : 'sha384-test') }) } };
            }
            return null;
          },
          createElement: tag => ({ tag, id: '', style: {}, setAttribute() {}, appendChild() {}, textContent: '' }),
          addEventListener() {},
        },
      };
      g.window = g;
      const ctx = vm.createContext(g);
      vm.runInContext(headScripts[0], ctx);
      vm.runInContext(headScripts[1], ctx);
      const origBootFail = g.__latteBootFail;
      g.__latteBootFail = msg => { bootFailCount++; return origBootFail(msg); };
      vm.runInContext(mountJs, ctx);
      return {
        g, rootNode, appendedHead, appendedBody, timeouts,
        get bootFailCount() { return bootFailCount; },
        get mountedRenders() { return mountedRenders; },
        async settleFallback() {
          const s = appendedHead[0];
          if (fallbackOutcome === 'ok') { g.DOMPurify = { sanitize: x => x, isSupported: true }; s.onload(); }
          else if (fallbackOutcome === 'malformed') { g.DOMPurify = { sanitize: 'not-a-fn' }; s.onload(); }
          else if (fallbackOutcome === 'error') { s.onerror(); }
          await g.__domPurifyReady;
          await new Promise(r => setTimeout(r, 0));
        }
      };
    }

    // (a) Malformed non-callable DOMPurify refuses mount and halts
    const badObj = runBootScenario({ initialPurify: { isSupported: false }, fallbackOutcome: 'malformed' });
    await badObj.settleFallback();
    // (b) Fallback CDN succeeds -> mounts App
    const okFb = runBootScenario({ initialPurify: undefined, fallbackOutcome: 'ok' });
    await okFb.settleFallback();
    // (c) Fallback CDN fails -> single halt banner; firing 12s timeout does NOT overwrite root
    const failFb = runBootScenario({ initialPurify: undefined, fallbackOutcome: 'error' });
    await failFb.settleFallback();
    failFb.timeouts.forEach(fn => fn());
    // (d) Async mount throw inside __domPurifyReady.then(_mountApp) is caught and routed to __latteBootFail
    const asyncThrow = runBootScenario({ initialPurify: undefined, fallbackOutcome: 'ok', mountThrows: true });
    await asyncThrow.settleFallback();

    t('v21.10 Phase 1 (C5 — DOMPurify boot & async mount gate): rejects non-callable DOMPurify, mounts cleanly on fallback success, latches single halt banner against 12s timeout overwrite, and catches async mount throws',
      badObj.mountedRenders === 0 && badObj.g.__latteBootFailed === true && badObj.appendedBody.length === 1 &&
      okFb.mountedRenders === 1 && okFb.g.__latteMounted === true &&
      failFb.mountedRenders === 0 && failFb.appendedBody.length === 1 && failFb.rootNode.innerHTML === 'loading' &&
      asyncThrow.bootFailCount === 1 && asyncThrow.rootNode.innerHTML.includes('Async mount boom'));
  }

  // 7. C6 — Persistence fixes: kbRunTx sync-throw + abort-throw, kbCreateSaveQueue SecurityError isolation & head ordering, saveModelSettings, hydration catch, chooseRecovery
  {
    // (a) kbRunTx sync throw when tx.abort() ALSO throws -> rejects with original error and closes db
    let dbClosed1 = 0;
    const txThrowsOnAbort = {
      objectStore: () => ({}),
      abort() { throw new Error('TransactionInactiveError'); }
    };
    const db1 = { close() { dbClosed1++; }, transaction: () => txThrowsOnAbort };
    let syncErr = '';
    try { await PERSIST.kbRunTx(db1, 'readwrite', () => { throw new Error('DataCloneError-original'); }); }
    catch (e) { syncErr = e.message; }

    // (b) kbRunTx sync throw when tx.abort() triggers async onabort -> rejects with original body error
    let dbClosed2 = 0;
    const txAsyncAbort = {
      objectStore: () => ({}),
      error: null,
      abort() { Promise.resolve().then(() => this.onabort && this.onabort()); }
    };
    const db2 = { close() { dbClosed2++; }, transaction: () => txAsyncAbort };
    let asyncBodyErr = '';
    try { await PERSIST.kbRunTx(db2, 'readwrite', () => { throw new Error('ExactBodyThrow'); }); }
    catch (e) { asyncBodyErr = e.message; }

    // (c) kbCreateSaveQueue works with IndexedDB even when captureFallbacks() throws SecurityError
    let savedDurable = null;
    const secQueue = PERSIST.kbCreateSaveQueue({
      write: async rec => { savedDurable = rec; },
      remove: async () => {},
      writeFallback: () => { throw new Error('SecurityError'); },
      captureFallbacks: () => { throw new Error('SecurityError'); },
      clearFallbacks: () => { throw new Error('SecurityError'); },
      writer: 'sec-test'
    });
    const secRes = await secQueue.save({ conditions: [{ name: 'HF' }] });

    // (d) saveModelSettings catches SecurityError silently
    let saveModelThrew = false;
    try { MODEL.saveModelSettings({ setItem() { throw new Error('SecurityError'); } }, { hydrogenModel: 'gemini-4-hydrogen' }); }
    catch (_) { saveModelThrew = true; }

    // (e) chooseRecovery validates BEFORE archiving, blocks re-entrant clicks, and preserves currentKnowledge identity on index===-1
    const recoverySrc = span('  const chooseRecovery=useCallback(async index=>{', '\n\n  // cfg.thinkingLevel');
    let archiveCalls = 0, archiveRelease = null;
    const published = [], errors = [];
    const badChoose = new Function(
      'useCallback', 'recoveryChoices', 'kbMutation', 'kbArchiveRecovery', 'mounted', 'kbNormalizeImported', 'EMPTY_LATTE_KB', 'setRecoveryChoices', 'setKnowledgeBase', 'setPersistenceError', 'currentKnowledge',
      recoverySrc + '\nreturn chooseRecovery;'
    )(
      fn => fn, [{ kb: { bad: true } }], { current: 0 },
      async () => { archiveCalls++; },
      { current: true },
      () => { throw new Error('corrupt recovery payload'); },
      { conditions: [] }, () => {}, x => published.push(x), e => errors.push(e), { current: { conditions: [] } }
    );
    await badChoose(0);
    const archivedOnBad = archiveCalls;

    archiveCalls = 0;
    const liveCurrentKB = { conditions: [{ name: 'Live Current' }] };
    let reentrantArchiveCalls = 0;
    const livePublished = [];
    const goodChoose = new Function(
      'useCallback', 'recoveryChoices', 'kbMutation', 'kbArchiveRecovery', 'mounted', 'kbNormalizeImported', 'EMPTY_LATTE_KB', 'setRecoveryChoices', 'setKnowledgeBase', 'setPersistenceError', 'currentKnowledge',
      recoverySrc + '\nreturn chooseRecovery;'
    )(
      fn => fn, [{ kb: { conditions: [] } }], { current: 0 },
      () => new Promise(resolve => { reentrantArchiveCalls++; archiveRelease = resolve; }),
      { current: true },
      kb => ({ kb: JSON.parse(JSON.stringify(kb)) }),
      { conditions: [] }, () => {}, x => livePublished.push(x), () => {}, { current: liveCurrentKB }
    );
    const firstClick = goodChoose(-1);
    const secondClick = goodChoose(-1); // should be ignored while in flight
    archiveRelease();
    await Promise.all([firstClick, secondClick]);

    t('v21.10 Phase 1 (C6 — Persistence & recovery hardening): kbRunTx never hangs/swallows sync throws, saveQueue tolerates localStorage SecurityError, saveModelSettings catches throws, hydration catch unblocks saves, and chooseRecovery validates before archive while blocking double-clicks & preserving current KB identity',
      syncErr === 'DataCloneError-original' && dbClosed1 === 1 &&
      asyncBodyErr === 'ExactBodyThrow' && dbClosed2 === 1 &&
      secRes.status === 'saved' && savedDurable?.kb?.conditions?.[0]?.name === 'HF' &&
      saveModelThrew === false &&
      S.includes("catch(e){if(alive){setPersistenceStatus('error');setPersistenceError(e.message);setHydrated(true);}}") &&
      archivedOnBad === 0 && errors[0].includes('corrupt recovery payload') &&
      reentrantArchiveCalls === 1 && livePublished.length === 1 && livePublished[0] === liveCurrentKB);
  }

  // 8. M1 + M2 + H23 — Verifier AST free-identifier gate, UTF-8 Babel byte ceiling, and canonical suiteVersion()
  {
    const astPass = astFreeVarCheck(S, Babel);
    let injectedCaught = false;
    const mutated = S.replace(
      'const convertText=()=>n2aConvertTextWithEnv(',
      'const convertText=()=>{totallyMissingHandlerVar();return n2aConvertTextWithEnv('
    ).replace(
      'extraTags,mode,base});',
      'extraTags,mode,base});};'
    );
    try { astFreeVarCheck(mutated, Babel); }
    catch (e) { injectedCaught = /totallyMissingHandlerVar/.test(e.message); }

    // UTF-8 byte ceiling check: 499,000 chars containing multi-byte em-dashes exceeds 500,000 UTF-8 bytes
    const multiByteBody = 'const x = "' + '—'.repeat(2000) + 'a'.repeat(497000) + '";';
    const fakeHtml = '<script type="text/babel" data-presets="react">' + multiByteBody + '</script>';
    let utf8OverRejected = false;
    try { extractBabelScript(fakeHtml); }
    catch (e) { utf8OverRejected = /UTF-8 bytes/.test(e.message); }

    const expectedVer = (S.match(/<!-- v(\d+\.\d+) \(/) || [])[1] || '';
    t('v21.10 Phase 1 (M1, M2, H23 — Verifier guardrails): astFreeVarCheck passes live suite and catches undeclared event-handler refs, extractBabelScript enforces UTF-8 500 KB ceiling, and suiteVersion() matches release header',
      astPass.blocksChecked >= 4 &&
      injectedCaught === true &&
      multiByteBody.length <= MAX_BABEL_SCRIPT_CHARS &&
      Buffer.byteLength(multiByteBody, 'utf8') > MAX_BABEL_SCRIPT_CHARS &&
      utf8OverRejected === true &&
      Boolean(expectedVer) &&
      S.includes("function suiteVersion(){return '" + expectedVer + "';}"));
  }
};
