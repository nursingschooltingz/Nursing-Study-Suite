'use strict';

const vm = require('vm');
const { extractSpan } = require('./repo-checks');

module.exports = async function runMultiWaveLedgerTests(S, t) {
  // Execute the entire live plain <script> block in an isolated vm context so every helper
  // and orchestrator runs against real shipped code without copied fixtures.
  const babelStart = S.indexOf('<script type="text/babel"');
  if (babelStart < 0) throw new Error('v22.4 tests: missing text/babel block');
  const headSource = S.slice(0, babelStart);
  const inlineBlocks = [...headSource.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (inlineBlocks.length < 3) throw new Error('v22.4 tests: expected >= 3 plain script blocks');

  const noop = () => {};
  const makeMockStorage = () => {
    const map = new Map();
    return {
      getItem: k => (map.has(String(k)) ? map.get(String(k)) : null),
      setItem: (k, v) => { map.set(String(k), String(v)); },
      removeItem: k => { map.delete(String(k)); },
      _map: map,
    };
  };
  const storage = makeMockStorage();
  const R = {
    Fragment: Symbol.for('react.fragment'),
    createContext: v => ({ _currentValue: v, Provider: () => null }),
    useState: init => [typeof init === 'function' ? init() : init, noop],
    useEffect: noop,
    useRef: init => ({ current: init }),
    useMemo: fn => fn(),
    useCallback: fn => fn,
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  };
  let mockFetch = () => { throw new Error('unexpected fetch'); };
  const g = {
    React: R,
    document: { getElementById: () => ({}), addEventListener: noop, removeEventListener: noop, createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }), body: { appendChild: noop, style: {} } },
    addEventListener: noop,
    removeEventListener: noop,
    localStorage: storage,
    sessionStorage: makeMockStorage(),
    fetch: (...args) => mockFetch(...args),
    pdfjsLib: { GlobalWorkerOptions: {}, OPS: {}, getDocument: () => ({ promise: new Promise(noop), destroy: noop }) },
    marked: { parse: x => x, use: noop },
    DOMPurify: { sanitize: x => x, addHook: noop, isSupported: true },
    console,
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: noop,
    TextEncoder,
    TextDecoder,
    URL,
    Blob,
    AbortController,
    DOMException,
    crypto: globalThis.crypto,
    indexedDB: { open: () => ({}) },
  };
  g.window = g;
  const ctx = vm.createContext(g);
  inlineBlocks.forEach((code, idx) => vm.runInContext(code, ctx, { filename: 'v224-plain-' + (idx + 1) + '.js', timeout: 10000 }));
  const L = vm.runInContext(
    '({GEN_LEDGER_STORAGE_KEY,GEN_LEDGER_MAX_KBS,MAX_NCLEX_TARGET,MAX_CASE_BATCH,' +
    'genLedgerKbKey,genLedgerLoad,genLedgerRecord,genLedgerReset,genLedgerExcludeSet,genLedgerScopeStats,genLedgerSubscribe,' +
    'selectCaseFacts,selectCaseFactsMulti,caseRenderFactPacket,caseBuildPrompt,caseSplitSystemPrompt,' +
    'caseBuildBatchTargets,caseEstimateWavePlan,caseRunBatchWithEnv,' +
    'ngBuildFactPool,ngAllocateBatch,ngBatchStart,ngFocusPlan,kbForNCLEX,ngRunGeneratorWithEnv,ngAssembleWorksheet,createOperationSlot})',
    ctx
  );

  // 1. Extraction tail
  t('v22.4 (Extraction tail): ledger, multi-wave case slicer, and NCLEX continuation helpers compile cleanly from shipped HTML',
    L.MAX_NCLEX_TARGET === 500 &&
    L.MAX_CASE_BATCH === 8 &&
    typeof L.genLedgerKbKey === 'function' &&
    typeof L.genLedgerRecord === 'function' &&
    typeof L.genLedgerReset === 'function' &&
    typeof L.caseEstimateWavePlan === 'function' &&
    typeof L.ngRunGeneratorWithEnv === 'function');

  // Helper to build synthetic P-LATE conditions/KB
  let seq = 1;
  const mkFact = (bucket, tier = 1, extra = {}) => ({
    id: 'fact-' + (seq++),
    latteBucket: bucket,
    tier,
    text: bucket + ' clinical fact #' + (seq - 1) + ' with threshold > 100 mg/dL',
    sourceQuote: bucket + ' fact quote ' + (seq - 1),
    source: { file: 'lecture.pdf', page: 1 },
    ...extra,
  });
  const mkCond = (id, name, counts, extra = {}) => {
    const facts = [];
    for (const [b, n] of Object.entries(counts)) {
      for (let i = 0; i < n; i++) facts.push(mkFact(b, i % 2 === 0 ? 1 : 2));
    }
    return { id, name, aliases: [], facts, ...extra };
  };

  // 2. Persistent per-KB Used-Fact Ledger: separate defaults, opt-in cross-tab, independent reset, LRU cap, & subscribers
  {
    const st = makeMockStorage();
    const kbA = { conditions: [mkCond('hf', 'Heart Failure', { Look: 3, Analyze: 2, Treat: 3 })] };
    const kbB = { conditions: [mkCond('copd', 'COPD', { Look: 2, Treat: 2 })] };
    const events = [];
    const unsub = L.genLedgerSubscribe(k => events.push(k));
    const rec1 = L.genLedgerRecord(kbA, 'nclex', { factIds: ['FACT-1', 'fact-2'], stems: ['Stem A'], questionDelta: 10, runDelta: 1 }, st);
    const rec2 = L.genLedgerRecord(kbA, 'cases', { factIds: ['fact-3', 'fact-4'], titles: ['Case Alpha'], caseDelta: 1 }, st);
    const ownOnlyNclex = L.genLedgerExcludeSet(rec2, 'nclex', { excludeOwn: true, excludeOther: false });
    const crossNclex = L.genLedgerExcludeSet(rec2, 'nclex', { excludeOwn: true, excludeOther: true });
    const ownOnlyCases = L.genLedgerExcludeSet(rec2, 'cases', { excludeOwn: true, excludeOther: false });
    const stats = L.genLedgerScopeStats(kbA.conditions, crossNclex);
    const afterCaseReset = L.genLedgerReset(kbA, 'cases', st);
    const reloaded = L.genLedgerLoad(kbA, st);
    // LRU cap test (>10 distinct KBs)
    for (let i = 0; i < 12; i++) {
      const kbx = { conditions: [{ id: 'lru-' + i, name: 'LRU ' + i, facts: [{ id: 'lru-f-' + i, latteBucket: 'Look', tier: 1, text: 'fact ' + i }] }] };
      L.genLedgerRecord(kbx, 'cases', { factIds: ['lru-f-' + i], caseDelta: 1 }, st);
    }
    const storedAfterLru = JSON.parse(st.getItem(L.GEN_LEDGER_STORAGE_KEY));
    L.genLedgerRecord(kbB, 'nclex', { factIds: [kbB.conditions[0].facts[0].id] }, st);
    L.genLedgerReset(kbB, 'both', st);
    unsub();

    t('v22.4 (Per-KB Used-Fact Ledger): keeps NCLEX and Case ledgers separate by default, supports opt-in cross-tab union, independent resets, LRU cap, and live subscriber notifications',
      rec1.nclex.factIds.join(',') === 'fact-1,fact-2' &&
      rec2.nclex.questionCount === 10 && rec2.cases.caseCount === 1 &&
      ownOnlyNclex.size === 2 && !ownOnlyNclex.has('fact-3') &&
      crossNclex.size === 4 && crossNclex.has('fact-1') && crossNclex.has('fact-3') &&
      ownOnlyCases.size === 2 && !ownOnlyCases.has('fact-1') &&
      stats.total === 8 && stats.excluded === 4 && stats.remaining === 4 &&
      afterCaseReset.cases.factIds.length === 0 && afterCaseReset.nclex.factIds.length === 2 &&
      reloaded.nclex.factIds.length === 2 && reloaded.cases.factIds.length === 0 &&
      Object.keys(storedAfterLru.byKb).length <= L.GEN_LEDGER_MAX_KBS &&
      events.length >= 4);
  }

  // 3. selectCaseFacts & selectCaseFactsMulti with excludeFactIds + bounded context anchors (Decision #1)
  {
    const c1 = mkCond('c1', 'DKA', { Patho: 2, Look: 2, Analyze: 4, Treat: 8, Educate: 4 });
    const c2 = mkCond('c2', 'HHS', { Patho: 2, Look: 2, Analyze: 4, Treat: 8, Educate: 4 });
    // Exclude ALL Look facts from c1 & c2 while leaving fresh Analyze/Treat/Educate facts
    const allLookIds = [...c1.facts, ...c2.facts].filter(f => f.latteBucket === 'Look').map(f => f.id);
    const singleWithAnchors = L.selectCaseFacts(c1, { includeTier2: true, excludeFactIds: new Set(allLookIds), allowContextAnchors: true });
    const singleAnchors = singleWithAnchors.filter(f => f.contextAnchor);
    const singleFresh = singleWithAnchors.filter(f => !f.contextAnchor);
    const singleStrict = L.selectCaseFacts(c1, { includeTier2: true, excludeFactIds: new Set(allLookIds), allowContextAnchors: false });

    const multiWithAnchors = L.selectCaseFactsMulti([c1, c2], { includeTier2: true, excludeFactIds: new Set(allLookIds), allowContextAnchors: true });
    const multiLookAnchors = multiWithAnchors.filter(f => f.contextAnchor && f.latteBucket === 'Look');
    const multiNonLookAnchors = multiWithAnchors.filter(f => f.contextAnchor && f.latteBucket !== 'Look');

    // Exclude ALL facts -> must return [] (never an anchor-only hollow case)
    const allIds = [...c1.facts, ...c2.facts].map(f => f.id);
    const emptySingle = L.selectCaseFacts(c1, { includeTier2: true, excludeFactIds: new Set(allIds), allowContextAnchors: true });
    const emptyMulti = L.selectCaseFactsMulti([c1, c2], { includeTier2: true, excludeFactIds: new Set(allIds), allowContextAnchors: true });

    t('v22.4 (Case exclusions & bounded context anchors): borrows <=2 background anchors ONLY for empty Look/Analyze/Treat buckets while fresh facts remain, respects allowContextAnchors:false, and returns [] when exhausted',
      singleFresh.length > 0 && singleFresh.every(f => f.latteBucket !== 'Look') &&
      singleAnchors.length === 2 && singleAnchors.every(f => f.latteBucket === 'Look') &&
      singleStrict.every(f => !f.contextAnchor && f.latteBucket !== 'Look') &&
      multiLookAnchors.length === 2 && multiNonLookAnchors.length === 0 &&
      emptySingle.length === 0 && emptyMulti.length === 0);
  }

  // 4. caseRenderFactPacket & caseBuildPrompt: legacy byte-identity vs Wave 2+ context-anchor & prefix-cache preservation
  {
    const baseFact = mkFact('Treat', 1);
    const anchorFact = { ...mkFact('Look', 1), contextAnchor: true };
    const pLegacy = L.caseBuildPrompt({ conditionName: 'Sepsis', facts: [baseFact], difficulty: 'exam', stages: 4, questionsPerStage: 3, includeTypes: { mcq: true } });
    const pWave2 = L.caseBuildPrompt({ conditionName: 'Sepsis', facts: [baseFact, anchorFact], difficulty: 'exam', stages: 4, questionsPerStage: 3, includeTypes: { mcq: true }, priorTitles: ['Acute Sepsis Presentation'] });
    const splitLegacy = L.caseSplitSystemPrompt(pLegacy);
    const splitWave2 = L.caseSplitSystemPrompt(pWave2);

    t('v22.4 (Prompt & prefix-cache invariance): single-wave prompt omits wave rules; Wave 2+ stamps CONTEXT ANCHOR + priorTitles strictly after systemInstruction split so Gemini prefix caching stays lossless',
      !pLegacy.includes('MULTI-WAVE NON-OVERLAP') &&
      !pLegacy.includes('CONTEXT ANCHOR') &&
      pWave2.includes('MULTI-WAVE NON-OVERLAP & CONTEXT ANCHOR RULES') &&
      pWave2.includes('"Acute Sepsis Presentation"') &&
      pWave2.includes('[CONTEXT ANCHOR — ALREADY TESTED; BACKGROUND FRAMING ONLY]') &&
      splitLegacy.systemInstruction === splitWave2.systemInstruction &&
      splitWave2.userPrompt.includes('MULTI-WAVE NON-OVERLAP'));
  }

  // 5. caseEstimateWavePlan & caseBuildBatchTargets with exclusions
  {
    const bigEntries = [
      mkCond('m1', 'Heart Failure', { Patho: 4, Look: 14, Analyze: 14, Treat: 14, Educate: 8 }),
      mkCond('m2', 'Pulmonary Edema', { Patho: 4, Look: 14, Analyze: 14, Treat: 14, Educate: 8 }),
      mkCond('m3', 'Cardiogenic Shock', { Patho: 4, Look: 10, Analyze: 10, Treat: 10, Educate: 6 }),
    ];
    const mixedCond = { id: 'mixed:m1+m2+m3', name: 'Heart Failure + 2 more', isMixed: true, mixMode: 'comorbid', conditions: bigEntries };
    const planAuto = L.caseEstimateWavePlan({ condition: mixedCond, conditions: bigEntries, factOpts: { includeTier2: true }, stages: 4, questionsPerStage: 3, requestedWaves: 'auto' });
    const planTwo = L.caseEstimateWavePlan({ condition: mixedCond, conditions: bigEntries, factOpts: { includeTier2: true }, stages: 4, questionsPerStage: 3, requestedWaves: 2 });
    const allMixedIds = new Set(bigEntries.flatMap(c => c.facts.map(f => f.id)));
    const planExhausted = L.caseEstimateWavePlan({ condition: mixedCond, conditions: bigEntries, factOpts: { includeTier2: true }, stages: 4, questionsPerStage: 3, excludeFactIds: allMixedIds, requestedWaves: 'auto' });

    // Batch Queue across 10 conditions where first 8 are already used -> next run queues conditions 9 and 10
    const tenConds = Array.from({ length: 10 }, (_, i) => mkCond('b-' + (i + 1), 'Cond ' + (i + 1), { Look: 4, Analyze: 4, Treat: 4 }));
    const usedFirstEight = new Set(tenConds.slice(0, 8).flatMap(c => c.facts.map(f => f.id)));
    const nextBatch = L.caseBuildBatchTargets({
      conditions: tenConds,
      resolvedConditions: tenConds,
      factOpts: { includeTier2: true, excludeFactIds: usedFirstEight, allowContextAnchors: true },
      stages: 4,
      questionsPerStage: 3,
      maxBatch: 8,
    });

    t('v22.4 (Wave estimator & Batch Queue rollover): caseEstimateWavePlan accurately projects multi-wave combined runs and caseBuildBatchTargets skips already-covered entries 1..8 to advance to 9..10',
      planAuto.totalEligible === 148 && planAuto.maxUsefulWaves >= 3 && planAuto.waves === planAuto.maxUsefulWaves &&
      planTwo.waves === 2 &&
      planExhausted.waves === 0 && planExhausted.exhausted === true &&
      nextBatch.targets.length === 2 &&
      nextBatch.targets[0].condition.id === 'b-9' &&
      nextBatch.targets[1].condition.id === 'b-10' &&
      nextBatch.skipped.length === 8 &&
      nextBatch.skipped.every(s => s.reason.includes('prior cases')));
  }

  // 6. Live dynamic sequential multi-wave execution (caseRunBatchWithEnv + waveConfig)
  {
    const e1 = mkCond('w1', 'Sepsis', { Patho: 2, Look: 6, Analyze: 6, Treat: 6, Educate: 4 });
    const e2 = mkCond('w2', 'ARDS', { Patho: 2, Look: 6, Analyze: 6, Treat: 6, Educate: 4 });
    const mixed = { id: 'mixed:w1+w2', name: 'Sepsis + ARDS', isMixed: true, mixMode: 'comorbid', conditions: [e1, e2] };
    const kb = { conditions: [e1, e2] };
    const batchOverrideRef = { current: null }, casePacketRef = { current: [] }, caseStudyRef = { current: null };
    const waveRuns = [];
    await L.caseRunBatchWithEnv({
      cfg: { apiKey: 'synthetic-key' },
      batchPlan: { targets: [], skipped: [], overflowCount: 0 },
      waveConfig: {
        condition: mixed,
        conditions: [e1, e2],
        factOpts: { includeTier2: true },
        includeTypes: { mcq: true },
        stages: 4,
        questionsPerStage: 3,
        requestedWaves: 'auto',
        maxBatch: 4,
        initialExcludeIds: new Set(),
        initialPriorTitles: [],
        allowContextAnchors: true,
      },
      generatorSlot: { current: L.createOperationSlot() },
      batchBusy: false,
      K: { knowledgeBase: kb },
      batchCancelRef: { current: false },
      setBatchBusy: noop,
      setLogs: noop,
      log: noop,
      currentSourceKB: { current: kb },
      setBatchStatus: noop,
      batchOverrideRef,
      run: async () => {
        const ovr = batchOverrideRef.current;
        const freshIds = ovr.facts.filter(f => !f.contextAnchor).map(f => f.id);
        // Simulate model citing half of Wave 1's supplied facts so Wave 2 dynamically reclaims the uncited half!
        const citedNow = freshIds.slice(0, Math.ceil(freshIds.length / 2));
        waveRuns.push({
          waveIndex: ovr.waveIndex,
          freshIds,
          citedNow,
          priorTitles: (ovr.priorTitles || []).slice(),
        });
        ovr.completed = true;
        ovr.errCount = 0;
        ovr.citedFactIds = citedNow;
        ovr.caseTitle = 'Dynamic Wave Case ' + ovr.waveIndex;
        casePacketRef.current.push({ id: ovr.packetId, waveIndex: ovr.waveIndex, caseStudy: { title: ovr.caseTitle } });
      },
      caseStudyRef,
      casePacketRef,
      selectPacketEntry: noop,
    });
    const w1CitedSet = new Set(waveRuns[0].citedNow);
    const w1Uncited = waveRuns[0].freshIds.filter(id => !w1CitedSet.has(id));
    const w2ReclaimedCount = waveRuns[1].freshIds.filter(id => w1Uncited.includes(id)).length;
    const w2ZeroOverlapWithW1Cited = waveRuns[1].freshIds.every(id => !w1CitedSet.has(id));

    t('v22.4 (Dynamic sequential multi-wave execution): Wave 2 excludes Wave 1 cited facts, reclaims Wave 1 uncited facts, and passes Wave 1 title in priorTitles',
      waveRuns.length >= 2 &&
      w2ZeroOverlapWithW1Cited &&
      w2ReclaimedCount > 0 &&
      waveRuns[1].priorTitles.includes('Dynamic Wave Case 1'));
  }

  // 7. NCLEX pure helpers: ngBatchStart remaining-fact spacing, ngFocusPlan exclusions, kbForNCLEX exclusions
  {
    const g1 = mkCond('ng1', 'Alpha', { Look: 4, Treat: 4 });
    const g2 = mkCond('ng2', 'Beta', { Look: 4, Treat: 4 });
    const g3 = mkCond('ng3', 'Gamma', { Look: 4, Treat: 4 });
    const kb = { conditions: [g1, g2, g3] };
    const pool = L.ngBuildFactPool(kb, { tiers: [1, 2, 3] });
    const exG1 = new Set(g1.facts.map(f => f.id));
    Object.defineProperty(pool, '_excludeIds', { value: exG1, configurable: true });
    const start1 = L.ngBatchStart(pool, 1, 2); // must skip exhausted g1 (index 0) and start at g2 (index 1)
    const start2 = L.ngBatchStart(pool, 2, 2); // must land on g3 (index 2)

    const focusEx = new Set([g2.facts[0].id, g2.facts[1].id]);
    const fp = L.ngFocusPlan(pool, { points: 'Beta', batches: 1, perItem: 2, cap: 4, excludeIds: focusEx });
    const legacyPacket = L.kbForNCLEX(kb, { tiers: [1, 2, 3], excludeFactIds: exG1 });

    t('v22.4 (NCLEX continuation spacing & focus/legacy exclusions): ngBatchStart skips depleted groups via pool._excludeIds, ngFocusPlan skips tested facts, and kbForNCLEX omits excluded IDs',
      start1 === 1 && start2 === 2 &&
      fp.plan[0].length === 2 && fp.plan[0].every(id => !focusEx.has(id)) &&
      !legacyPacket.includes(g1.facts[0].id) && legacyPacket.includes(g2.facts[0].id));
  }

  // 8. Live ngRunGeneratorWithEnv: Run 1 -> New Worksheet (exclusions kept) -> + Append (preserves batches & increments batch numbers)
  {
    const c = {
      id: 'nc1', name: 'Heart Failure', aliases: [],
      facts: [
        { id: 'fact-101', latteBucket: 'Analyze', tier: 1, text: 'Monitor serum potassium 3.5-5.0 mEq/L before furosemide.', sourceQuote: 'serum potassium 3.5-5.0 mEq/L', source: { file: 'ch1.pdf', page: 1 } },
        { id: 'fact-102', latteBucket: 'Treat', tier: 1, text: 'Hold digoxin when apical pulse is below 60 beats/min.', sourceQuote: 'apical pulse is below 60', source: { file: 'ch1.pdf', page: 2 } },
        { id: 'fact-103', latteBucket: 'Look', tier: 1, text: 'Assess daily weights; report gain greater than 2 lb in 24 hours.', sourceQuote: 'gain greater than 2 lb in 24 hours', source: { file: 'ch1.pdf', page: 3 } },
        { id: 'fact-104', latteBucket: 'Educate', tier: 1, text: 'Restrict sodium intake to 2000 mg daily in heart failure.', sourceQuote: 'Restrict sodium intake to 2000 mg daily', source: { file: 'ch1.pdf', page: 4 } },
        { id: 'fact-105', latteBucket: 'Treat', tier: 1, text: 'Elevate head of bed to high-Fowler position for acute dyspnea.', sourceQuote: 'high-Fowler position for acute dyspnea', source: { file: 'ch1.pdf', page: 5 } },
        { id: 'fact-106', latteBucket: 'Analyze', tier: 1, text: 'BNP above 100 pg/mL supports heart failure exacerbation.', sourceQuote: 'BNP above 100 pg/mL', source: { file: 'ch1.pdf', page: 6 } },
      ],
    };
    const kb = { conditions: [c] };
    const mkWsResponse = (factId, stemText) => [
      'PART 1: CONCEPT INVENTORY',
      'C1 | Grounded nursing concept | ' + factId + ' | Treat',
      '',
      'PART 2: SELECTION & GROUNDING AUDIT',
      'Q1 -> cites [C1] (' + factId + ')',
      'DISTRIBUTION: 1 MCQ, 0 SATA',
      '',
      'PART 3: QUESTIONS',
      '1. ' + stemText,
      'A. Priority nursing intervention grounded in source',
      'B. Delayed reassessment',
      'C. Unrelated diagnostic test',
      'D. Routine documentation only',
      '',
      'PART 4: ANSWER KEY & RATIONALES',
      '1. ANSWER: A',
      'Why A is correct: Matches supplied guidance [' + factId + ']. (Source: C1)',
      'Why B is wrong: Delays needed care. (Source: C1)',
      'Why C is wrong: Does not address the priority. (Source: C1)',
      'Why D is wrong: Insufficient action. (Source: C1)',
      'Strategy: Prioritize safety.',
      'Tags: Perfusion, Tier 1',
    ].join('\n');

    const makeOk = text => ({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }),
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }),
    });

    const st = makeMockStorage();
    const seenAllocatedPerRun = [];
    const baseCfg = { apiKey: 'synthetic-key', autoProfile: false, forTool: () => ({ model: 'gemini-4-neon', level: 'low' }) };

    const runNg = async ({ appendMode = false, existingBatches = null, prevRequested = 0, excludeSet = null, stems = null }) => {
      let batchesOut = appendMode && existingBatches ? existingBatches.slice() : [];
      let covOut = null, artSrc = null;
      const runLogs = [];
      let fetchCount = 0;
      mockFetch = async (_url, opts) => {
        fetchCount++;
        const body = JSON.parse(opts.body);
        const packetTxt = (body.contents && body.contents[0] && body.contents[0].parts && body.contents[0].parts[1] && body.contents[0].parts[1].text) || '';
        const targetBlock = packetTxt.split('SUPPORTING CONTEXT')[0] || packetTxt;
        const ids = [...targetBlock.matchAll(/KBFACT (fact-\d+)/g)].map(m => m[1]);
        seenAllocatedPerRun.push(ids);
        return makeOk(mkWsResponse(ids[0] || 'fact-101', 'A client requires care for ' + (ids[0] || 'unknown') + '. Which action is priority?'));
      };
      await L.ngRunGeneratorWithEnv({
        cfg: baseCfg,
        log: (m, ty) => runLogs.push({ m, ty }),
        K: { knowledgeBase: kb, isCurrentSource: s => s === kb, registerArtifact: noop },
        generatorSlot: { current: L.createOperationSlot() },
        setArtifactSource: v => { artSrc = v; },
        targetCount: 1,
        runAudit: false,
        setAuditState: noop,
        currentSourceKB: { current: kb },
        setBusy: noop, setProg: noop, setLogs: noop,
        setBatches: v => { batchesOut = v; },
        setCoverage: v => { covOut = v; },
        setShowUncov: noop, setAbortCtl: noop, setProvenance: noop, setTrackers: noop, setLiveKB: noop,
        numBatches: 1,
        batchSize: 1,
        hasStructuredScope: false,
        nclexScope: null,
        kbIncludeBridge: false,
        kbTiers: [1, 2],
        kbConditionFilter: '',
        allocMode: true,
        factsPerQ: 2,
        points: '',
        outcomes: '',
        buildBatchBlock: (b, tot, sz) => '\nBATCH ' + b + ' of ' + tot + ': ' + sz + ' question\n',
        buildFocusBlock: () => '',
        appendMode,
        existingBatches,
        prevRequested,
        excludeFactIds: excludeSet,
        priorStems: stems,
        onRecordUsedFacts: rec => L.genLedgerRecord(kb, 'nclex', rec, st),
      });
      return { batchesOut, covOut, artSrc, runLogs, fetchCount };
    };

    // Run 1: fresh
    const r1 = await runNg({});
    const led1 = L.genLedgerLoad(kb, st);
    // Run 2: New Worksheet (appendMode: false) with Run 1 exclusions
    const r2 = await runNg({ appendMode: false, excludeSet: new Set(led1.nclex.factIds), stems: led1.nclex.stems });
    const led2 = L.genLedgerLoad(kb, st);
    // Run 3: Append onto Run 2 (appendMode: true) with Run 1+2 exclusions
    const r3 = await runNg({ appendMode: true, existingBatches: r2.batchesOut, prevRequested: r2.artSrc.requested, excludeSet: new Set(led2.nclex.factIds), stems: led2.nclex.stems });
    const wsAppended = L.ngAssembleWorksheet(r3.batchesOut);

    // Exhausted run: all 6 facts excluded -> 0 API calls
    const rExhausted = await runNg({ excludeSet: new Set(c.facts.map(f => f.id)) });

    t('v22.4 (Live NCLEX New Worksheet vs + Append continuation): Run 2 starts fresh worksheet excluding Run 1 cited facts; Run 3 appends as Batch 2 with cumulative renumbering; exhausted pool makes 0 API calls',
      r1.batchesOut.length === 1 && r1.batchesOut[0].n === 1 &&
      led1.nclex.factIds.length === 1 &&
      r2.batchesOut.length === 1 && r2.batchesOut[0].n === 1 &&
      !seenAllocatedPerRun[1].includes(led1.nclex.factIds[0]) &&
      r3.batchesOut.length === 2 && r3.batchesOut[0].n === 1 && r3.batchesOut[1].n === 2 &&
      wsAppended.count === 2 &&
      r3.artSrc.requested === 2 &&
      !seenAllocatedPerRun[2].includes(led1.nclex.factIds[0]) &&
      !seenAllocatedPerRun[2].includes(led2.nclex.factIds[1]) &&
      rExhausted.fetchCount === 0 &&
      rExhausted.runLogs.some(x => x.ty === 'err' && x.m.includes('already been used')));
  }

  // 9. UI controls & Decision #2 / #3 defaults wired cleanly in NCLEXGenerator & CaseStudyGenerator
  {
    const ngSpan = extractSpan(S, 'function NCLEXGenerator(){', 'function CaseStudyGenerator(){');
    const csSpan = extractSpan(S, 'function CaseStudyGenerator(){', 'function CaseRenderer(');

    t('v22.4 (UI wiring & defaults): NCLEXGenerator exposes up to MAX_NCLEX_TARGET (500), Fill remaining, New Worksheet primary + Append secondary, and CaseStudyGenerator exposes CaseWaveControl + separate-by-default cross-tab checkboxes',
      ngSpan.includes('max={MAX_NCLEX_TARGET}') &&
      ngSpan.includes('id="nclex-fill-remaining"') &&
      ngSpan.includes('id="nclex-append-btn"') &&
      ngSpan.includes("New Worksheet ('+targetCount+' Qs)") &&
      ngSpan.includes('const [excludePriorNclex,setExcludePriorNclex]=useState(true)') &&
      ngSpan.includes('const [excludeCaseFacts,setExcludeCaseFacts]=useState(false)') &&
      csSpan.includes('<CaseWaveControl ') &&
      csSpan.includes('<GenLedgerControl idPrefix="case"') &&
      csSpan.includes('const [excludePriorCases,setExcludePriorCases]=useState(true)') &&
      csSpan.includes('const [excludeNclexFacts,setExcludeNclexFacts]=useState(false)') &&
      S.includes("id:'case-wave-count'") &&
      S.includes('Separate from Clear packet'));
  }

  // 10. Context-anchor tag is omitted on normal facts and rendered cleanly on anchor facts
  {
    const normalF = mkFact('Analyze', 1);
    const anchorF = { ...mkFact('Look', 1), contextAnchor: true };
    const pktNormal = L.caseRenderFactPacket('Sepsis', [normalF]);
    const pktAnchor = L.caseRenderFactPacket('Sepsis', [normalF, anchorF]);
    t('v22.4 (caseRenderFactPacket anchor disclosure): normal packets stay free of CONTEXT ANCHOR tags while borrowed background facts are explicitly labelled',
      !pktNormal.includes('CONTEXT ANCHOR') &&
      pktAnchor.includes('FACT ' + anchorF.id) &&
      pktAnchor.includes('[CONTEXT ANCHOR — ALREADY TESTED; BACKGROUND FRAMING ONLY]'));
  }
};
