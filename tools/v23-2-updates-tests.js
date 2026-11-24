'use strict';

const vm = require('vm');
const { extractSpan } = require('./repo-checks');

module.exports = async function runV232UpdatesTests(S, t) {
  const babelStart = S.indexOf('<script type="text/babel"');
  if (babelStart < 0) throw new Error('v23.2 tests: missing text/babel block');
  const headSource = S.slice(0, babelStart);
  const inlineBlocks = [...headSource.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (inlineBlocks.length < 3) throw new Error('v23.2 tests: expected >= 3 plain script blocks');

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
  const g = {
    React: R,
    document: { getElementById: () => ({}), addEventListener: noop, removeEventListener: noop, createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }), body: { appendChild: noop, style: {} } },
    addEventListener: noop,
    removeEventListener: noop,
    localStorage: storage,
    sessionStorage: makeMockStorage(),
    fetch: () => { throw new Error('unexpected fetch'); },
    pdfjsLib: { GlobalWorkerOptions: {}, OPS: {}, getDocument: () => ({ promise: new Promise(noop), destroy: noop }) },
    marked: { parse: x => x, use: noop },
    DOMPurify: { sanitize: x => x, addHook: noop, isSupported: true },
    console,
    setTimeout: fn => { fn(); return 0; },
    clearTimeout: noop,
    TextEncoder,
    TextDecoder,
    URL,
    Blob,
    Uint8Array,
    AbortController,
    DOMException,
    crypto: globalThis.crypto,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    indexedDB: { open: () => ({}) },
  };
  g.window = g;
  const ctx = vm.createContext(g);
  inlineBlocks.forEach((code, idx) => vm.runInContext(code, ctx, { filename: 'v232-plain-' + (idx + 1) + '.js', timeout: 10000 }));

  const E = vm.runInContext(
    '({suiteVersion,CASE_STUDY_JSON_SCHEMA,buildCaseStudyJsonSchema,caseNormalizeParsedNgnFields,caseParseThresholds,caseAuditTextValues,validateCaseStudy,buildFactIndex,' +
    'genLedgerTopicKey,genLedgerLoad,genLedgerRecord,genLedgerReset,genLedgerExcludeSet,genLedgerExcludeTopicSet,genLedgerTopicScopeStats,' +
    'caseCollectUnrecordedPacketTopics,GenLedgerControl,caseSliceBroadMixedEntries,selectCaseFactsMulti,caseBuildBatchTargets,caseEstimateWavePlan,' +
    'ngBuildFactPool,ngBatchStart,ngAllocateBatch,caseComposeSingleExportMd,casePacketToMarkdown,ngBuildWorksheetMd,n2aConvertText,' +
    'nclexProComposeTags,nclexProConvertWorksheet,nclexProConvertCaseStudy,nclexProConvertAnkiDeck})',
    ctx
  );

  // 1. Extraction tail
  t('v23.2 (Extraction tail): all v23.2 helpers compile cleanly from shipped HTML',
    E.suiteVersion() === '23.2' &&
    typeof E.genLedgerTopicKey === 'function' &&
    typeof E.genLedgerExcludeTopicSet === 'function' &&
    typeof E.genLedgerTopicScopeStats === 'function' &&
    typeof E.caseCollectUnrecordedPacketTopics === 'function' &&
    typeof E.nclexProComposeTags === 'function');

  // 2. #1 — Two parallel lanes default ON in KnowledgeBaseBuilder
  {
    const kbSpan = extractSpan(S, 'function KnowledgeBaseBuilder(){', 'function PriorityAnalyzer(){');
    t('v23.2 (#1 — Parallel lanes default): KnowledgeBaseBuilder initializes laneCount to 2 and labels Two parallel lanes as default',
      kbSpan.includes('const [laneCount,setLaneCount]=useState(2);') &&
      kbSpan.includes('Two parallel lanes') &&
      kbSpan.includes('default · faster'));
  }

  // 3. #5 — NGN Matrix correctAnswers schema requirement + defensive normalizer + strict empty rejection
  {
    const qSchema = E.CASE_STUDY_JSON_SCHEMA.properties.stages.items.properties.questions.items;
    const dynQSchema = E.buildCaseStudyJsonSchema({ mcq: false, matrix: true, cloze: true }).properties.stages.items.properties.questions.items;
    const kb = {
      conditions: [{
        id: 'c1', name: 'Heart Failure',
        facts: [
          { id: 'f1', latteBucket: 'Look', tier: 1, text: 'Crackles indicate pulmonary congestion', sourceQuote: 'Crackles' },
          { id: 'f2', latteBucket: 'Treat', tier: 1, text: 'Avoid rapid saline bolus in acute overload', sourceQuote: 'Avoid rapid saline bolus' },
          { id: 'f3', latteBucket: 'Analyze', tier: 1, text: 'Elevate head of bed to ease dyspnea', sourceQuote: 'Elevate head of bed' },
        ],
      }],
    };
    const fx = E.buildFactIndex(kb);
    const baseCase = q => ({
      title: 'Acute Fluid Overload', condition: 'Heart Failure', difficulty: 'exam',
      patient: { age: 68, sex: 'F', background: 'Admitted to telemetry.' },
      stages: [{
        stageNumber: 1, title: 'Arrival', narrative: 'Client arrives dyspneic.',
        data: [{ label: 'Lung sounds', value: 'Crackles', supportType: 'direct', availability: 'revealed', factIds: ['f1'] }],
        questions: [q],
      }],
      debrief: { priorityProblem: 'Fluid overload', keyDecisions: ['Elevate head of bed'], notes: '', factIds: ['f1'] },
    });

    // 3a. Nested matrix.correctAnswers with arrow & column label drift
    const nestedMatrix = baseCase({
      id: 's1q1', type: 'Matrix', stem: 'Classify each action.', cjmmSkill: 'Take Action',
      options: [],
      matrix: {
        mode: 'single',
        columns: [{ id: 'C1', label: 'Indicated' }, { id: 'C2', label: 'Contraindicated' }],
        rows: [
          { id: 'R1', text: 'Elevate head of bed' },
          { id: 'R2', text: 'Administer rapid saline bolus' },
          { id: 'R3', text: 'Monitor lung sounds for crackles' },
        ],
        correctAnswers: ['R1 -> Indicated', 'R2 : Contraindicated', 'R3 = C1'],
      },
      rationales: [
        { option: 'R1', text: 'Easing dyspnea is indicated.', supportType: 'direct', factIds: ['f3'] },
        { option: 'R2', text: 'Rapid saline worsens overload.', supportType: 'direct', factIds: ['f2'] },
        { option: 'R3', text: 'Crackles track congestion.', supportType: 'direct', factIds: ['f1'] },
      ],
    });
    E.caseNormalizeParsedNgnFields(nestedMatrix);
    const nestedQ = nestedMatrix.stages[0].questions[0];
    const nestedErrs = E.validateCaseStudy(nestedMatrix, fx).filter(i => i.sev === 'error');

    // 3b. Per-row correctColumn drift
    const rowAnsMatrix = baseCase({
      id: 's1q2', type: 'Matrix', stem: 'Classify each action.', cjmmSkill: 'Take Action',
      options: [],
      matrix: {
        mode: 'single',
        columns: [{ id: 'C1', label: 'Indicated' }, { id: 'C2', label: 'Contraindicated' }],
        rows: [
          { id: 'R1', text: 'Elevate head of bed', correctColumn: 'C1' },
          { id: 'R2', text: 'Administer rapid saline bolus', correctAnswer: 'Contraindicated' },
          { id: 'R3', text: 'Monitor lung sounds for crackles', answer: 'C1' },
        ],
      },
      rationales: [
        { option: 'R1', text: 'Easing dyspnea is indicated.', supportType: 'direct', factIds: ['f3'] },
        { option: 'R2', text: 'Rapid saline worsens overload.', supportType: 'direct', factIds: ['f2'] },
        { option: 'R3', text: 'Crackles track congestion.', supportType: 'direct', factIds: ['f1'] },
      ],
    });
    E.caseNormalizeParsedNgnFields(rowAnsMatrix);
    const rowErrs = E.validateCaseStudy(rowAnsMatrix, fx).filter(i => i.sev === 'error');

    // 3c. Cloze legacy blanks drift -> standard options + correctAnswers
    const clozeDrift = baseCase({
      id: 's1q3', type: 'Cloze', stem: 'The client has {{D1}} so the nurse should {{D2}}.', cjmmSkill: 'Analyze Cues',
      cloze: {
        blanks: [
          { id: 'D1', options: ['pulmonary congestion', 'hypoglycemia', 'dehydration'], correctAnswer: 'pulmonary congestion' },
          { id: 'D2', options: ['give rapid saline', 'elevate head of bed', 'discharge home'], correctAnswer: 'elevate head of bed' },
        ],
      },
      rationales: [],
    });
    E.caseNormalizeParsedNgnFields(clozeDrift);
    const clozeQ = clozeDrift.stages[0].questions[0];

    // 3d. Truly missing Matrix answers still fail validation cleanly (never invented)
    const emptyMatrix = baseCase({
      id: 's1q4', type: 'Matrix', stem: 'Classify.', cjmmSkill: 'Take Action',
      options: [],
      correctAnswers: [],
      matrix: {
        mode: 'single',
        columns: [{ id: 'C1', label: 'Indicated' }, { id: 'C2', label: 'Contraindicated' }],
        rows: [{ id: 'R1', text: 'Elevate head of bed' }, { id: 'R2', text: 'Saline bolus' }, { id: 'R3', text: 'Assess crackles' }],
      },
      rationales: [
        { option: 'R1', text: 'Ok.', supportType: 'direct', factIds: ['f3'] },
        { option: 'R2', text: 'No.', supportType: 'direct', factIds: ['f2'] },
        { option: 'R3', text: 'Ok.', supportType: 'direct', factIds: ['f1'] },
      ],
    });
    E.caseNormalizeParsedNgnFields(emptyMatrix);
    const emptyErrs = E.validateCaseStudy(emptyMatrix, fx).filter(i => i.sev === 'error');

    t('v23.2 (#5 — Matrix schema & normalizer): requires correctAnswers (minItems:1), rescues Matrix/Cloze drift without inventing answers, and rejects truly empty Matrix keys',
      qSchema.required.includes('correctAnswers') &&
      qSchema.properties.correctAnswers.minItems === 1 &&
      dynQSchema.required.includes('correctAnswers') &&
      JSON.stringify(nestedQ.correctAnswers) === JSON.stringify(['R1:C1', 'R2:C2', 'R3:C1']) &&
      nestedErrs.length === 0 &&
      rowErrs.length === 0 &&
      !('correctColumn' in rowAnsMatrix.stages[0].questions[0].matrix.rows[0]) &&
      !clozeQ.cloze && clozeQ.options.length === 6 &&
      JSON.stringify(clozeQ.correctAnswers) === JSON.stringify(['D1A', 'D2B']) &&
      emptyErrs.some(e => e.msg.includes('no correct answer')) &&
      emptyErrs.some(e => e.msg.includes('must select exactly 1 column (got 0)')));
  }

  // 4. #2A — Persistent topic ledger, legacy fallback, progress bar UI, & unrecorded failed packet helper
  {
    const st = makeMockStorage();
    const kb = {
      conditions: [
        { id: 'c1', name: 'Topic Alpha', facts: [{ id: 'f-1', latteBucket: 'Look', tier: 1, text: 'Alpha 1' }, { id: 'f-2', latteBucket: 'Treat', tier: 1, text: 'Alpha 2' }] },
        { id: 'c2', name: 'Topic Beta', facts: [{ id: 'f-3', latteBucket: 'Look', tier: 1, text: 'Beta 1' }, { id: 'f-4', latteBucket: 'Treat', tier: 1, text: 'Beta 2' }] },
        { id: 'c3', name: 'Topic Gamma', facts: [{ id: 'f-5', latteBucket: 'Look', tier: 1, text: 'Gamma 1' }] },
        { id: 'c4', name: 'Topic Delta', facts: [{ id: 'f-6', latteBucket: 'Look', tier: 1, text: 'Delta 1' }] },
      ],
    };
    const rec = E.genLedgerRecord(kb, 'cases', { factIds: ['f-1'], topicIds: ['Topic Beta'], titles: ['Case 1'], caseDelta: 1 }, st);
    const exF = E.genLedgerExcludeSet(rec, 'cases', { excludeOwn: true, excludeOther: false });
    const exT = E.genLedgerExcludeTopicSet(rec, 'cases', { excludeOwn: true, excludeOther: false });
    const tStats = E.genLedgerTopicScopeStats(kb.conditions, exF, exT);

    // Unrecorded failed packet entry detection
    const failedEntry = {
      caseStudy: {
        title: 'Failed Gamma Case',
        stages: [{ stageNumber: 1, data: [{ factIds: ['f-5'] }], questions: [] }],
      },
      issues: [{ sev: 'error', msg: 'Matrix got 0' }],
    };
    const unrec = E.caseCollectUnrecordedPacketTopics([failedEntry], kb, exF, exT);

    // Render GenLedgerControl and inspect progressbar + mark-packet-used button in virtual tree
    const tree = E.GenLedgerControl({
      idPrefix: 'case', primaryKind: 'cases', ledger: rec,
      scopeStats: { total: 6, excluded: 1, remaining: 5 },
      topicStats: tStats,
      unrecordedPacketInfo: { count: unrec.count, onMarkUsed: noop },
      excludeOwn: true, setExcludeOwn: noop, excludeOther: false, setExcludeOther: noop,
      allowContextAnchors: true, setAllowContextAnchors: noop,
      freshnessPreview: { totalSelected: 4, freshCount: 4, anchorCount: 0, reusedCount: 0, isBatch: false },
      onReset: noop, disabled: false,
    });
    const treeJson = JSON.stringify(tree);
    const afterReset = E.genLedgerReset(kb, 'cases', st);

    t('v23.2 (#2A — Persistent topic ledger & progress bar UI): tracks explicit & fact-derived topicIds, renders topic progress bar + unrecorded packet prompt, and resets cleanly',
      rec.cases.topicIds.includes('topic alpha') &&
      rec.cases.topicIds.includes('topic beta') &&
      tStats.totalTopics === 4 && tStats.coveredTopics === 2 && tStats.untouchedTopics === 2 && tStats.pct === 50 &&
      unrec.count === 1 && unrec.topicIds.includes('topic gamma') && unrec.factIds.includes('f-5') &&
      treeJson.includes('"role":"progressbar"') &&
      treeJson.includes('case-topic-progress') &&
      treeJson.includes('case-mark-packet-used') &&
      afterReset.cases.topicIds.length === 0);
  }

  // 5. #2B — Case Study untouched-topics-first rotation across sessions & Batch Queue prioritization
  {
    let fid = 1;
    const conds = Array.from({ length: 16 }, (_, i) => ({
      id: 'ct-' + (i + 1),
      name: 'Clinical Topic ' + String(i + 1).padStart(2, '0'),
      facts: ['Patho', 'Look', 'Analyze', 'Treat', 'Educate'].flatMap(b => [
        { id: 'cf-' + (fid++), latteBucket: b, tier: 1, text: b + ' A for T' + (i + 1), sourceQuote: 'q' },
        { id: 'cf-' + (fid++), latteBucket: b, tier: 1, text: b + ' B for T' + (i + 1), sourceQuote: 'q' },
      ]),
    }));

    // Run 1: 2 waves (8 topics partially used: only 2 facts cited per topic, 8 unused facts left!)
    const usedFacts = new Set(), usedTopics = new Set();
    const run1Names = new Set();
    for (let w = 0; w < 2; w++) {
      const sl = E.caseSliceBroadMixedEntries(conds, { includeTier2: true, excludeFactIds: usedFacts, excludeTopicKeys: usedTopics });
      sl.entries.forEach(c => {
        run1Names.add(c.name);
        usedTopics.add(E.genLedgerTopicKey(c));
        c.facts.slice(0, 2).forEach(f => usedFacts.add(f.id));
      });
    }
    // Run 2: next 2 waves MUST pick the 8 remaining UNTOUCHED topics with 0 overlap against Run 1
    const run2Names = new Set();
    for (let w = 0; w < 2; w++) {
      const sl = E.caseSliceBroadMixedEntries(conds, { includeTier2: true, excludeFactIds: usedFacts, excludeTopicKeys: usedTopics });
      sl.entries.forEach(c => {
        run2Names.add(c.name);
        usedTopics.add(E.genLedgerTopicKey(c));
        c.facts.slice(0, 2).forEach(f => usedFacts.add(f.id));
      });
    }
    const zeroOverlap = [...run2Names].every(n => !run1Names.has(n));

    // Pass 2: once all 16 topics are visited once, slice cleanly draws remaining unused facts
    const pass2Slice = E.caseSliceBroadMixedEntries(conds, { includeTier2: true, excludeFactIds: usedFacts, excludeTopicKeys: usedTopics });

    // Batch Queue separate cases: untouched topics 5..10 must queue ahead of partially-used topics 1..4
    const tenConds = conds.slice(0, 10);
    const partialExFacts = new Set(tenConds.slice(0, 4).flatMap(c => c.facts.slice(0, 2).map(f => f.id)));
    const partialExTopics = new Set(tenConds.slice(0, 4).map(c => E.genLedgerTopicKey(c)));
    const batchRes = E.caseBuildBatchTargets({
      conditions: tenConds,
      resolvedConditions: tenConds,
      factOpts: { includeTier2: true, excludeFactIds: partialExFacts, excludeTopicKeys: partialExTopics, allowContextAnchors: true },
      stages: 3, questionsPerStage: 2, maxBatch: 6,
    });
    const batchFirstSix = batchRes.targets.map(x => x.condition.name);
    const batchAllUntouched = batchFirstSix.every(nm => !tenConds.slice(0, 4).some(c => c.name === nm));

    t('v23.2 (#2B — Case Study untouched-topics-first rotation): Run 2 covers untouched topics with 0 overlap against Run 1, transitions to Pass 2 cleanly, and Batch Queue prioritizes untouched topics',
      run1Names.size === 8 && run2Names.size === 8 && zeroOverlap &&
      pass2Slice.entries.length === 4 &&
      batchRes.targets.length === 6 && batchAllUntouched);
  }

  // 6. #2C — NCLEX Generator untouched-topics-first spacing & allocation
  {
    let fid = 1;
    const kb = {
      conditions: Array.from({ length: 10 }, (_, i) => ({
        id: 'nc-' + (i + 1),
        name: 'NCLEX Topic ' + String(i + 1).padStart(2, '0'),
        facts: Array.from({ length: 8 }, (__, j) => ({
          id: 'nf-' + (fid++), latteBucket: 'Treat', tier: 1, text: 'Fact ' + j + ' for topic ' + (i + 1), sourceQuote: 'q',
        })),
      })),
    };
    const pool = E.ngBuildFactPool(kb, { tiers: [1, 2, 3] });
    // Simulate Run 1 partially covering Topics 1..4 (2 of 8 facts used each, leaving 6 unused facts per topic)
    const exIds = new Set(kb.conditions.slice(0, 4).flatMap(c => c.facts.slice(0, 2).map(f => f.id)));
    const usedTopicKeys = new Set(kb.conditions.slice(0, 4).map(c => E.genLedgerTopicKey(c)));
    Object.defineProperty(pool, '_excludeIds', { value: exIds, configurable: true });
    Object.defineProperty(pool, '_usedTopicKeys', { value: usedTopicKeys, configurable: true });

    const startB1 = E.ngBatchStart(pool, 1, 2);
    const startB2 = E.ngBatchStart(pool, 2, 2);
    const allocB1 = E.ngAllocateBatch(pool, new Set(exIds), { want: 12, perCondition: 4, neighborCap: 2, start: startB1 });
    const allocB1Topics = new Set(allocB1.targets.map(f => E.genLedgerTopicKey(f.condition)));
    const b1ZeroOverlap = [...allocB1Topics].every(tk => !usedTopicKeys.has(tk));

    // Pass 2: all 10 topics already touched -> falls back cleanly to remaining unused facts
    const allTopicsUsed = new Set(kb.conditions.map(c => E.genLedgerTopicKey(c)));
    Object.defineProperty(pool, '_usedTopicKeys', { value: allTopicsUsed, configurable: true });
    const pass2Alloc = E.ngAllocateBatch(pool, new Set(exIds), { want: 12, perCondition: 4, neighborCap: 2, start: E.ngBatchStart(pool, 1, 2) });

    t('v23.2 (#2C — NCLEX untouched-topics-first continuation): skips partially-used Topics 1..4 to target untouched Topics 5..10 first, then falls back cleanly to Pass 2',
      startB1 >= 4 && startB2 > startB1 &&
      allocB1.targets.length === 12 && b1ZeroOverlap &&
      pass2Alloc.targets.length === 12 && pass2Alloc.targets.every(f => !exIds.has(f.id)));
  }

  // 7. #3 & #4 — End-of-document validation banners across Packet, Single Case, NCLEX Worksheet, & n2aConvertText
  {
    const sampleCs = {
      title: 'Respiratory Distress Case', condition: 'COPD', difficulty: 'advanced',
      patient: { age: 66, sex: 'M', background: 'Admitted.' },
      stages: [{
        stageNumber: 1, title: 'Arrival', narrative: 'Dyspneic.',
        data: [{ label: 'SpO2', value: '88%', factIds: ['f1'], supportType: 'direct' }],
        questions: [{ type: 'MCQ', stem: 'First action?', options: [{ label: 'A', text: 'Apply O2' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Supports hypoxia.', factIds: ['f1'] }] }],
      }],
    };
    const errIssues = [{ sev: 'error', msg: 'Stage 1 s1q1: synthetic grounding error' }];

    const pktBookletEnd = E.casePacketToMarkdown(
      [{ caseStudy: sampleCs, issues: errIssues, audit: {}, auditState: 'complete' }],
      { layout: 'booklet', diagnosticsPlacement: 'end' }
    );
    const pktPairedEnd = E.casePacketToMarkdown(
      [{ caseStudy: sampleCs, issues: errIssues, audit: {}, auditState: 'complete' }],
      { layout: 'paired', diagnosticsPlacement: 'end' }
    );
    const singleEnd = E.caseComposeSingleExportMd({
      caseStudy: sampleCs, issues: errIssues, diagnosticsPlacement: 'end',
      reviewAppendix: '\n---\n\n## Review appendix\n\n- ERROR: Stage 1 s1q1: synthetic grounding error\n',
    });
    const wsEnd = E.ngBuildWorksheetMd(
      {
        count: 1,
        questions: ['1. A client has SpO2 88%. What is the priority action?\nA. Apply supplemental oxygen\nB. Document only\nC. Reassess in 4 hours\nD. Discharge client'],
        answers: ['1. ANSWER: A\nWhy A is correct: Treats hypoxemia.\nWhy B is wrong: Delays care.\nWhy C is wrong: Too slow.\nWhy D is wrong: Unsafe.\nTags: Tier 1'],
      },
      [{ sev: 'error', msg: 'Batch 1: synthetic distribution mismatch' }],
      '',
      { diagnosticsAtEnd: true }
    );
    const n2aRes = E.n2aConvertText(wsEnd, 'end-diag-ws.md');

    const bKeyPos = pktBookletEnd.indexOf('# Answer Key — Case 1');
    const bAppPos = pktBookletEnd.indexOf('# Warnings, Errors & Review Appendix');
    const pAppPos = pktPairedEnd.indexOf('# Warnings, Errors & Review Appendix');

    t('v23.2 (#3 & #4 — Red validation boxes at end by default): moves packet & per-case red boxes and TOC flags strictly after Answer Keys while keeping n2aConvertText NeedsReview detection intact',
      bKeyPos > 0 && bAppPos > bKeyPos &&
      !pktBookletEnd.slice(0, bAppPos).includes('PACKET CONTAINS UNVERIFIED') &&
      !pktBookletEnd.slice(0, bAppPos).includes('failed validation') &&
      !pktBookletEnd.slice(0, bAppPos).includes('FAILED VALIDATION') &&
      pktBookletEnd.slice(bAppPos).includes('PACKET CONTAINS UNVERIFIED') &&
      pktBookletEnd.slice(bAppPos).includes('FAILED VALIDATION') &&
      !pktPairedEnd.slice(0, pAppPos).includes('failed validation') &&
      singleEnd.startsWith('# Respiratory Distress Case') &&
      singleEnd.indexOf('FAILED VALIDATION') > singleEnd.indexOf('## Answer Key') &&
      wsEnd.startsWith('# NCLEX Practice Questions') &&
      wsEnd.indexOf('FAILED VALIDATION') > wsEnd.indexOf('## Answer Key') &&
      n2aRes.cards.length === 1 &&
      n2aRes.cards[0].tags.includes('NeedsReview') &&
      !n2aRes.cards[0].back.includes('Warnings, Errors & Review Appendix'));
  }

  // 8. NCLEX Pro tag parity & mixed-case conditionNames cleanup
  {
    const kb = {
      metadata: { course: 'NURS 310', exam: 'Exam 1', concepts: ['Mobility'] },
      conditions: [
        {
          id: 'c-oa', name: 'Osteoarthritis', concept: 'Mobility',
          facts: [{ id: 'f-oa1', latteBucket: 'Look', tier: 1, trapRole: 'twin-cue', text: 'Heberden nodes worsen with use', sourceQuote: 'Heberden nodes' }],
        },
        {
          id: 'c-ra', name: 'Rheumatoid Arthritis', concept: 'Mobility',
          facts: [{ id: 'f-ra1', latteBucket: 'Treat', tier: 2, clinicalLayer: 'bridge', trapRole: 'hold-triangle', text: 'Monitor LFTs on methotrexate', sourceQuote: 'methotrexate' }],
        },
      ],
    };
    const mixedCase = {
      title: 'Differentiating Joint Pain',
      condition: 'Osteoarthritis + Rheumatoid Arthritis',
      difficulty: 'exam',
      patient: { age: 58, sex: 'F', background: 'Clinic visit.' },
      stages: [{
        stageNumber: 1, title: 'Assessment', narrative: 'Joint stiffness noted.',
        data: [{ label: 'Exam', value: 'Heberden nodes', factIds: ['f-oa1'], supportType: 'direct' }],
        questions: [
          {
            type: 'MCQ', stem: 'Which finding points to Osteoarthritis?', cjmmSkill: 'Analyze Cues',
            options: [{ label: 'A', text: 'Heberden nodes' }, { label: 'B', text: 'Bilateral morning stiffness > 1 hr' }],
            correctAnswers: ['A'],
            rationales: [{ option: 'A', text: 'Classic OA cue.', factIds: ['f-oa1'] }],
          },
          {
            type: 'MCQ', stem: 'Which NP Bridge lab monitors methotrexate?', cjmmSkill: 'Take Action',
            options: [{ label: 'A', text: 'LFTs' }, { label: 'B', text: 'TSH' }],
            correctAnswers: ['A'],
            rationales: [{ option: 'A', text: 'Check LFTs.', factIds: ['f-ra1'] }],
          },
        ],
      }],
    };
    const csSync = E.nclexProConvertCaseStudy(mixedCase, kb);
    const qOa = csSync.items[0], qRa = csSync.items[1];
    const wsSync = E.nclexProConvertWorksheet({
      questions: ['1. Which finding indicates Osteoarthritis?\nA. Heberden nodes\nB. Bilateral swelling'],
      answers: ['1. ANSWER: A\nWhy A is correct: Classic OA finding [f-oa1].\nTags: Tier 1 | Analyze Cues'],
    }, [], kb);
    const ankiSync = E.nclexProConvertAnkiDeck([{
      text: 'In Osteoarthritis, {{c1::Heberden nodes}} worsen with use.',
      extra: 'Asymmetric joint pain.',
      tags: 'Tier::1 Condition::Osteoarthritis Nursing::PLATE::Look',
      factIds: ['f-oa1'],
    }], { sourceKB: kb }, kb);

    t('v23.2 (NCLEX Pro tag parity & mixed-case conditionNames): avoids compound "A + B" fake conditions and stamps clinicalLayer + hierarchical Anki-style tags across Cases, NCLEX Qs, and Flashcards',
      qOa.conditionNames.includes('Osteoarthritis') &&
      !qOa.conditionNames.includes('Osteoarthritis + Rheumatoid Arthritis') &&
      qOa.clinicalLayer === 'rn' &&
      qRa.clinicalLayer === 'bridge' &&
      Array.isArray(qOa.tags) && qOa.tags.includes('Tier::1') && qOa.tags.includes('Layer::RNCore') && qOa.tags.includes('Condition::Osteoarthritis') && qOa.tags.includes('Nursing::PLATE::Look') && qOa.tags.includes('Trap::TwinContrast') && qOa.tags.includes('Source::Suite::NURS_310_Exam_1') &&
      Array.isArray(qRa.tags) && qRa.tags.includes('Layer::NPBridge') && qRa.tags.includes('Trap::HoldTriangle') &&
      Array.isArray(wsSync.items[0].tags) && wsSync.items[0].tags.includes('Condition::Osteoarthritis') && wsSync.items[0].clinicalLayer === 'rn' &&
      Array.isArray(ankiSync.cards[0].tags) && ankiSync.cards[0].tags.includes('Source::Suite::NURS_310_Exam_1'));
  }

  // 9. Threshold comparator phrasing ("more than", "exceeds", "up to", postfix "or more/greater/less") & non-empty stages/questions schema
  {
    const th = s => JSON.stringify(E.caseParseThresholds(s).map(x => [x.op, x.value, x.unit]));
    const fx = new Map([
      ['f-more', { fact: { text: 'An inter-arm systolic BP difference of more than 15 mm Hg suggests arterial occlusion.', sourceQuote: '' } }],
      ['f-post', { fact: { text: 'An inter-arm systolic BP difference of 15 mm Hg or greater requires vascular workup.', sourceQuote: '' } }],
      ['f-exc', { fact: { text: 'Refer when inter-arm systolic BP difference exceeds 15 mm Hg.', sourceQuote: '' } }],
    ]);
    const audit = (val, id) => { const out = []; E.caseAuditTextValues(val, [id], fx, 'Stage 1', out, 'instantiated'); return out; };
    t('v23.2 (Threshold comparators): parses "more than", "fewer than", "exceeds/exceeding", "up to", and postfix "or more/greater/less" while keeping negated forms <=/>=',
      th('Difference of more than 15 mm Hg') === '[[">",15,"mmhg"]]' &&
      th('Difference exceeds 15 mm Hg') === '[[">",15,"mmhg"]]' &&
      th('Difference exceeding 15 mm Hg') === '[[">",15,"mmhg"]]' &&
      th('Difference of 15 mm Hg or greater') === '[[">=",15,"mmhg"]]' &&
      th('Difference of 10 mm Hg or more') === '[[">=",10,"mmhg"]]' &&
      th('Normal difference is 10 mm Hg or less') === '[["<=",10,"mmhg"]]' &&
      th('Normal difference is up to 10 mm Hg') === '[["<=",10,"mmhg"]]' &&
      th('Fewer than 12 breaths/min') === '[["<",12,"/min"]]' &&
      th('Does not exceed 15 mm Hg') === '[["<=",15,"mmhg"]]' &&
      th('No more than 15 mm Hg') === '[["<=",15,"mmhg"]]' &&
      audit('16 mm Hg', 'f-more').length === 0 &&
      audit('18 mm Hg', 'f-post').length === 0 &&
      audit('19 mm Hg', 'f-exc').length === 0);

    const baseStages = E.CASE_STUDY_JSON_SCHEMA.properties.stages;
    const dynStages = E.buildCaseStudyJsonSchema({ mcq: false, matrix: true, bowtie: true }).properties.stages;
    t('v23.2 (Case schema minItems): CASE_STUDY_JSON_SCHEMA and buildCaseStudyJsonSchema require minItems: 1 on both stages and questions',
      baseStages.minItems === 1 &&
      baseStages.items.properties.questions.minItems === 1 &&
      dynStages.minItems === 1 &&
      dynStages.items.properties.questions.minItems === 1);
  }
};
