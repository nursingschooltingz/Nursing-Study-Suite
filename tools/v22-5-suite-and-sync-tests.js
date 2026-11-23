'use strict';

const vm = require('vm');
const { webcrypto } = require('crypto');

module.exports = async function runV225SuiteAndSyncTests(S, t) {
  const babelStart = S.indexOf('<script type="text/babel"');
  if (babelStart < 0) throw new Error('v22.5 tests: missing text/babel block');
  const headSource = S.slice(0, babelStart);
  const inlineBlocks = [...headSource.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (inlineBlocks.length < 3) throw new Error('v22.5 tests: expected >= 3 plain script blocks');

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
    setTimeout: fn => { fn(); return 0; },
    clearTimeout: noop,
    TextEncoder,
    TextDecoder,
    URL,
    Blob,
    Uint8Array,
    AbortController,
    DOMException,
    crypto: webcrypto,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    indexedDB: { open: () => ({}) },
  };
  g.window = g;
  const ctx = vm.createContext(g);
  inlineBlocks.forEach((code, idx) => vm.runInContext(code, ctx, { filename: 'v225-plain-' + (idx + 1) + '.js', timeout: 10000 }));
  const E = vm.runInContext(
    '({CASE_STUDY_JSON_SCHEMA,CASE_BROAD_MIX_THRESHOLD,CASE_BROAD_CLUSTER_SIZE,GEN_LEDGER_MAX_TITLES,' +
    'buildCaseStudyJsonSchema,caseResolveEnabledTypeNames,caseAttachRunTypeContract,caseNormalizeParsedNgnFields,' +
    'caseDifficultyBlock,caseDifficultySignals,caseBuildPrompt,validateCaseStudy,buildFactIndex,' +
    'caseSpreadIndices,caseSliceBroadMixedEntries,selectCaseFacts,selectCaseFactsMulti,caseBuildBatchTargets,' +
    'caseResolveUsedFactCategories,caseFormatUsedFactCategoriesMd,caseToMarkdown,caseComposeSingleExportMd,casePacketToMarkdown,' +
    'ngBuildWorksheetMd,genLedgerKbKey,genLedgerRecord,genLedgerExcludeSet,' +
    'nclexProKbMeta,nclexProConvertWorksheet,nclexProConvertCaseStudy,nclexProConvertAnkiDeck,nclexProBuildFlashcardsExportJson,nclexProSyncFlashcardsToCloud,' +
    'CaseQuestionTypesGrid,CaseExportLayoutBar,CaseUsedCategoriesCard,AnkiNclexProSyncButtons,CaseValidationBanner,GenLedgerControl})',
    ctx
  );

  // 1. Extraction tail
  t('v22.5 (Extraction tail): all Case Study, Export Layout, Topic Slicer, and Anki Cloud Sync helpers compile cleanly from shipped HTML',
    typeof E.buildCaseStudyJsonSchema === 'function' &&
    typeof E.caseNormalizeParsedNgnFields === 'function' &&
    typeof E.caseSliceBroadMixedEntries === 'function' &&
    typeof E.caseResolveUsedFactCategories === 'function' &&
    typeof E.caseComposeSingleExportMd === 'function' &&
    typeof E.nclexProConvertAnkiDeck === 'function' &&
    typeof E.nclexProSyncFlashcardsToCloud === 'function' &&
    typeof E.CaseQuestionTypesGrid === 'function' &&
    typeof E.CaseExportLayoutBar === 'function' &&
    typeof E.AnkiNclexProSyncButtons === 'function');

  // 2. #1 — Strict MCQ blocking, dynamic JSON Schema enum, and NGN+SATA preset
  {
    const ngnSataTypes = { mcq: false, sata: true, prioritization: false, ordering: true, calculation: true, education: false, bowtie: true, matrix: true, cloze: true, trend: true };
    const dynSchema = E.buildCaseStudyJsonSchema(ngnSataTypes);
    const qEnum = dynSchema.properties.stages.items.properties.questions.items.properties.type.enum;
    const defaultSchema = E.buildCaseStudyJsonSchema({ mcq: true, sata: true, prioritization: true, ordering: true, calculation: true, education: true, bowtie: true, matrix: true, cloze: true, trend: true });
    const fullEnum = defaultSchema.properties.stages.items.properties.questions.items.properties.type.enum;

    const sampleFacts = [{ id: 'fact-1', latteBucket: 'Analyze', tier: 1, text: 'Lactate 4.2 mmol/L', sourceQuote: 'Lactate 4.2 mmol/L' }];
    const pNoMcq = E.caseBuildPrompt({ conditionName: 'Sepsis', difficulty: 'advanced', stages: 3, questionsPerStage: 2, includeTypes: ngnSataTypes, facts: sampleFacts });
    const pWithMcq = E.caseBuildPrompt({ conditionName: 'Sepsis', difficulty: 'advanced', stages: 3, questionsPerStage: 2, includeTypes: { ...ngnSataTypes, mcq: true }, facts: sampleFacts });

    const kb = { conditions: [{ id: 'c1', name: 'Sepsis', facts: [{ id: 'fact-1', text: 'Lactate 4.2 mmol/L indicates hypoperfusion', latteBucket: 'Analyze', tier: 1, sourceQuote: 'Lactate 4.2 mmol/L' }] }] };
    const fx = E.buildFactIndex(kb);
    const badMcqCase = E.caseAttachRunTypeContract({
      title: 'Septic Shock Progression', condition: 'Sepsis', difficulty: 'advanced',
      patient: { age: 64, sex: 'F', background: 'Admitted from triage.' },
      stages: [{
        stageNumber: 1, title: 'Triage', narrative: 'Client arrives restless.',
        data: [{ label: 'Lactate', value: '4.2 mmol/L', factIds: ['fact-1'], supportType: 'direct' }],
        questions: [{
          type: 'MCQ', stem: 'Which finding is most concerning?', cjmmSkill: 'Analyze Cues',
          options: [{ label: 'A', text: 'Lactate 4.2 mmol/L' }, { label: 'B', text: 'Calm demeanor' }, { label: 'C', text: 'Warm hands' }, { label: 'D', text: 'Resting quietly' }],
          correctAnswers: ['A'],
          rationales: [
            { option: 'A', text: 'Indicates hypoperfusion.', factIds: ['fact-1'], supportType: 'direct' },
            { option: 'B', text: 'Benign.', factIds: ['fact-1'], supportType: 'distractor-rationale' },
            { option: 'C', text: 'Benign.', factIds: ['fact-1'], supportType: 'distractor-rationale' },
            { option: 'D', text: 'Benign.', factIds: ['fact-1'], supportType: 'distractor-rationale' },
          ],
        }],
      }],
    }, ngnSataTypes);
    const badIssues = E.validateCaseStudy(badMcqCase, fx);

    t('v22.5 (#1 — MCQ checkbox & NGN+SATA preset): dynamic JSON Schema excludes unchecked MCQ/Prioritization/Education, prompt injects STRICT QUESTION-TYPE RESTRICTION, validateCaseStudy blocks unchecked MCQ type, and presets render',
      !qEnum.includes('MCQ') && !qEnum.includes('Prioritization') && !qEnum.includes('Education') &&
      qEnum.includes('SATA') && qEnum.includes('Bowtie') && qEnum.includes('Matrix') && qEnum.includes('Cloze') && qEnum.includes('Trend') &&
      fullEnum.includes('MCQ') &&
      pNoMcq.includes('STRICT QUESTION-TYPE RESTRICTION: Multiple-choice ("MCQ") is UNCHECKED') &&
      !pNoMcq.includes('single-best-answer question') &&
      !pWithMcq.includes('STRICT QUESTION-TYPE RESTRICTION') &&
      badIssues.some(i => i.sev === 'error' && /question type "MCQ" was unchecked/i.test(i.msg)) &&
      S.includes('NGN + SATA only') && S.includes('Prioritization (1 best)') && S.includes('Patient education (1 best)'));
  }

  // 3. #2 — NGN JSON Schema alignment, field-alias normalization, & plain-English audit skip message
  {
    const qProps = E.CASE_STUDY_JSON_SCHEMA.properties.stages.items.properties.questions.items.properties;
    const matrixColsSchema = qProps.matrix.properties.columns.items.properties;
    const matrixRowsSchema = qProps.matrix.properties.rows.items.properties;
    const trendRowsSchema = qProps.trendTable.properties.rows.items.properties;

    const rawSynonymCase = {
      stages: [{
        stageNumber: 1,
        questions: [
          {
            type: 'Matrix',
            matrix: { mode: 'single', columns: ['Expected', 'Not Expected'], rows: [{ id: 'R1', label: 'Crackles' }, { id: 'R2', label: 'Clear lungs' }] },
          },
          {
            type: 'Trend',
            trendTable: { timepoints: ['0800', '1000'], rows: [{ parameter: 'SpO2', values: ['88%', '95%'], factIds: ['fact-1'] }] },
          },
        ],
      }],
    };
    E.caseNormalizeParsedNgnFields(rawSynonymCase);
    const normM = rawSynonymCase.stages[0].questions[0].matrix;
    const normT = rawSynonymCase.stages[0].questions[1].trendTable;

    t('v22.5 (#2 — NGN Schema & plain-English grounding diagnostic): CASE_STUDY_JSON_SCHEMA matches Matrix/Trend validator fields, caseNormalizeParsedNgnFields repairs synonym drift, and cryptic grounding message is replaced',
      Boolean(matrixColsSchema.id && matrixColsSchema.label) &&
      Boolean(matrixRowsSchema.id && matrixRowsSchema.text) &&
      Boolean(trendRowsSchema.label && trendRowsSchema.values && trendRowsSchema.factIds) &&
      normM.columns[0].id === 'C1' && normM.columns[0].label === 'Expected' &&
      normM.rows[0].id === 'R1' && normM.rows[0].text === 'Crackles' &&
      normT.rows[0].label === 'SpO2' && normT.rows[0].values[1] === '95%' && normT.rows[0].factIds[0] === 'fact-1' &&
      !S.includes('fix grounding first — a rubric review') &&
      S.includes('Optional AI rubric review skipped (saved API quota):'));
  }

  // 4. #4 — Strict zero-reuse toggle (allowContextAnchors: false) & freshness disclosure
  {
    const cond = {
      id: 'c-hf', name: 'Heart Failure',
      facts: [
        { id: 'f-look', latteBucket: 'Look', tier: 1, text: 'Bibasilar crackles', sourceQuote: 'crackles' },
        { id: 'f-treat', latteBucket: 'Treat', tier: 1, text: 'IV furosemide 40 mg', sourceQuote: 'furosemide 40 mg' },
        { id: 'f-edu', latteBucket: 'Educate', tier: 2, text: 'Report > 2 lb daily weight gain', sourceQuote: '2 lb daily' },
      ],
    };
    const excl = new Set(['f-look', 'f-treat']);
    const withAnchors = E.selectCaseFacts(cond, { includeTier2: true, includeEducation: true, excludeFactIds: excl, allowContextAnchors: true });
    const strictZero = E.selectCaseFacts(cond, { includeTier2: true, includeEducation: true, excludeFactIds: excl, allowContextAnchors: false });

    t('v22.5 (#4 — Fact-reuse clarity & strict 0-reuse toggle): allowContextAnchors:true borrows <=2 labelled anchors while allowContextAnchors:false enforces 0 reused facts',
      withAnchors.some(f => f.contextAnchor === true) &&
      strictZero.length === 1 && strictZero[0].id === 'f-edu' &&
      strictZero.every(f => !f.contextAnchor && !excl.has(f.id)) &&
      S.includes('100% unused facts') && S.includes('background context anchors only if Look/Analyze/Treat'));
  }

  // 5. #5 — Used-fact categories in Case Study Answer Key & clean multi-condition display
  {
    const mkMultiConds = count => Array.from({ length: count }, (_, i) => ({
      id: 'cond-' + (i + 1),
      name: 'Topic ' + (i + 1),
      concept: 'Concept ' + ((i % 3) + 1),
      facts: [
        { id: 'tf-' + (i + 1) + 'a', latteBucket: 'Look', tier: 1, text: 'Cue ' + (i + 1), sourceQuote: 'Cue ' + (i + 1) },
        { id: 'tf-' + (i + 1) + 'b', latteBucket: 'Treat', tier: 1, text: 'Action ' + (i + 1), sourceQuote: 'Action ' + (i + 1) },
      ],
    }));
    const kbSmall = { conditions: mkMultiConds(3) };
    const fxSmall = E.buildFactIndex(kbSmall);
    const compactCase = {
      title: 'Cardiorenal Case',
      condition: 'Topic 1 + Topic 2 + Topic 3 (+293 more)',
      difficulty: 'exam',
      patient: { age: 58, sex: 'M', background: 'Admitted.' },
      stages: [{
        stageNumber: 1, title: 'Stage 1', narrative: 'Assessed.',
        data: [{ label: 'Cue', value: 'Cue 1', factIds: ['tf-1a'], supportType: 'direct' }],
        questions: [{
          type: 'MCQ', stem: 'Priority?', options: [{ label: 'A', text: 'Action 2' }, { label: 'B', text: 'Wait' }],
          correctAnswers: ['A'],
          rationales: [{ option: 'A', text: 'Supported.', factIds: ['tf-2b'], supportType: 'direct' }],
        }],
      }],
    };
    const mdAutoCompact = E.caseToMarkdown(compactCase, { factIndex: fxSmall, factCategoryPlacement: 'auto' });
    const keyPosCompact = mdAutoCompact.indexOf('## Answer Key');
    const catPosCompact = mdAutoCompact.indexOf('**Categories of Facts Used (');
    const stageKeyPosCompact = mdAutoCompact.indexOf('**Q1.1** — Answer:', keyPosCompact);

    const kbLarge = { conditions: mkMultiConds(8) };
    const fxLarge = E.buildFactIndex(kbLarge);
    const largeCase = {
      ...compactCase,
      stages: [{
        stageNumber: 1, title: 'Stage 1', narrative: 'Assessed.',
        data: Array.from({ length: 8 }, (_, i) => ({ label: 'D' + i, value: 'Cue ' + (i + 1), factIds: ['tf-' + (i + 1) + 'a'], supportType: 'direct' })),
        questions: compactCase.stages[0].questions,
      }],
    };
    const mdAutoLarge = E.caseToMarkdown(largeCase, { factIndex: fxLarge, factCategoryPlacement: 'auto' });
    const keyPosLarge = mdAutoLarge.indexOf('## Answer Key');
    const catPosLarge = mdAutoLarge.indexOf('Categories of Facts Used (', keyPosLarge);
    const stageKeyPosLarge = mdAutoLarge.indexOf('**Q1.1** — Answer:', keyPosLarge);
    const mdOff = E.caseToMarkdown(compactCase, { factIndex: fxSmall, factCategoryPlacement: 'off' });

    t('v22.5 (#5 — Answer Key used-fact categories & header cleanup): Auto places <=6 categories at beginning of Answer Key and >6 at end, honors Off, and replaces (+293 more) with cited topics',
      !mdAutoCompact.includes('(+293 more)') &&
      mdAutoCompact.includes('Topic 1') && mdAutoCompact.includes('Topic 2') &&
      catPosCompact > keyPosCompact && catPosCompact < stageKeyPosCompact &&
      catPosLarge > stageKeyPosLarge &&
      !mdOff.includes('Categories of Facts Used ('));
  }

  // 6. #6 — Consolidated warnings, errors & review appendix at the end (Case + NCLEX)
  {
    const sampleCs = {
      title: 'DKA Management', condition: 'DKA', difficulty: 'exam',
      patient: { age: 29, sex: 'F', background: 'Type 1 DM.' },
      stages: [{
        stageNumber: 1, title: 'Arrival', narrative: 'Tachypneic.',
        data: [{ label: 'pH', value: '7.18', factIds: ['f1'], supportType: 'direct' }],
        questions: [{ type: 'MCQ', stem: 'First action?', options: [{ label: 'A', text: '0.9% NaCl' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Restore volume.', factIds: ['f1'] }] }],
      }],
    };
    const issues = [{ sev: 'warn', msg: 'Timing advisory warning' }];
    const revApp = '\n---\n\n## Review appendix\n\n- Advisory item 1\n';
    const prov = { genModel: 'gemini-4-neon', genLevel: 'high' };

    const endMd = E.caseComposeSingleExportMd({ caseStudy: sampleCs, exportNotice: '> Notice banner\n\n', issues, provenance: prov, diagnosticsPlacement: 'end', reviewAppendix: revApp });
    const inlineMd = E.caseComposeSingleExportMd({ caseStudy: sampleCs, exportNotice: '> Notice banner\n\n', issues, provenance: prov, diagnosticsPlacement: 'inline', reviewAppendix: revApp });

    const pktEndMd = E.casePacketToMarkdown([{ caseStudy: sampleCs, issues, audit: {}, auditState: 'complete', provenance: prov }], { layout: 'booklet', includeProvenance: true, diagnosticsPlacement: 'end' });
    const wsEndMd = E.ngBuildWorksheetMd(
      { count: 1, questions: ['1. Stem?\nA. Choice'], answers: ['1. ANSWER: A\nWhy A is correct: Good.'] },
      [{ sev: 'warn', msg: 'Advisory stem length' }],
      '> Export notice\n\n',
      { diagnosticsAtEnd: true, provenance: prov }
    );

    t('v22.5 (#6 — Consolidated diagnostics at end + toggle): single Case, Case Packet, and NCLEX Worksheet move warnings/provenance/review appendix to trailing consolidated section while preserving classic inline option',
      endMd.startsWith('# DKA Management') &&
      endMd.indexOf('## Warnings, Errors & Review Appendix') > endMd.indexOf('## Answer Key') &&
      inlineMd.startsWith('> Notice banner') &&
      pktEndMd.indexOf('# Warnings, Errors & Review Appendix (All 1 Case)') > pktEndMd.indexOf('# Answer Key — Case 1') &&
      wsEndMd.startsWith('# NCLEX Practice Questions') &&
      wsEndMd.indexOf('Warnings, Errors & Review Appendix') > wsEndMd.indexOf('## Answer Key'));
  }

  // 7. #7 — Broad "All topics" 16-case non-repeating KB-spread topic rotation
  {
    let fid = 1;
    const conditions = Array.from({ length: 48 }, (_, i) => ({
      id: 'all-c-' + (i + 1),
      name: 'Condition ' + String(i + 1).padStart(2, '0'),
      concept: 'Concept ' + ((i % 8) + 1),
      facts: ['Patho', 'Look', 'Analyze', 'Treat', 'Educate'].flatMap(b => [
        { id: 'af-' + (fid++), latteBucket: b, tier: 1, text: b + ' finding A for C' + (i + 1), sourceQuote: 'q' },
        { id: 'af-' + (fid++), latteBucket: b, tier: 1, text: b + ' finding B for C' + (i + 1), sourceQuote: 'q' },
      ]),
    }));
    const usedIds = new Set();
    const waveClusters = [];
    const seenPrimaryConditions = new Set();

    for (let w = 0; w < 16; w++) {
      const sliced = E.caseSliceBroadMixedEntries(conditions, {
        includeTier2: true, includeTier3: true,
        excludeFactIds: usedIds,
        clusterSize: E.CASE_BROAD_CLUSTER_SIZE,
      });
      waveClusters.push(sliced.entries.map(c => c.name));
      sliced.entries.forEach(c => seenPrimaryConditions.add(c.name));
      const packetFacts = E.selectCaseFactsMulti(conditions, {
        includeTier2: true, includeTier3: true, includeCalculation: true, includeEducation: true,
        excludeFactIds: usedIds, allowContextAnchors: true,
      });
      packetFacts.slice(0, Math.ceil(packetFacts.length * 0.6)).forEach(f => usedIds.add(f.id));
    }

    const batch1CondNums = waveClusters.slice(0, 8).flat().map(n => parseInt(n.replace(/\D+/g, ''), 10));
    const hasEarly = batch1CondNums.some(n => n <= 8);
    const hasMid = batch1CondNums.some(n => n >= 20 && n <= 30);
    const hasLate = batch1CondNums.some(n => n >= 37);

    t('v22.5 (#7 — 16-wave "All topics" diversity): 2 batches of 8 waves across a 48-condition KB visit >=40 distinct conditions across early, middle, and late KB sections without repeating a single cluster',
      seenPrimaryConditions.size >= 40 &&
      new Set(waveClusters.map(c => c.join('|'))).size === 16 &&
      hasEarly && hasMid && hasLate &&
      E.GEN_LEDGER_MAX_TITLES >= 40);
  }

  // 8. #8 — Enriched Question/Case metadata + E2E-encrypted Anki Flashcard Sync
  {
    const kb = {
      metadata: { course: 'NURS 221', exam: 'Exam 3', concepts: ['Perfusion'] },
      conditions: [{
        id: 'c-hf', name: 'Heart Failure', concept: 'Perfusion', aliases: ['CHF'],
        facts: [
          { id: 'fact-101', latteBucket: 'Look', tier: 1, trapRole: 'first-action', text: 'Crackles and orthopnea', sourceQuote: 'Crackles' },
          { id: 'fact-102', latteBucket: 'Treat', tier: 1, trapRole: 'hold-triangle', text: 'Hold digoxin if HR < 60/min', sourceQuote: 'HR < 60' },
        ],
      }],
    };
    const ws = {
      questions: ['1. Client with Heart Failure has apical HR 54/min before digoxin.\nA. Hold digoxin\nB. Administer dose\nC. Recheck in 4 hr\nD. Document only'],
      answers: ['1. ANSWER: A\nWhy A is correct: Hold digoxin for HR < 60/min [fact-102].\nTags: Tier 1 | Take Action'],
    };
    const wsSync = E.nclexProConvertWorksheet(ws, [], kb);
    const q0 = wsSync.items[0];

    const keptCards = [{
      id: 'note-1',
      text: 'In Heart Failure, hold {{c1::digoxin::medication}} when apical pulse is {{c2::< 60/min::threshold}}.',
      extra: 'Assess apical pulse for 1 full minute.',
      tags: 'Tier::1 Concept::Perfusion Condition::Heart_Failure Nursing::PLATE::Treat Trap::Hold_Triangle',
      tier: 1,
      factIds: ['fact-102'],
    }];
    const batchSnap = { factIndex: E.buildFactIndex(kb) };
    const deckPayload = E.nclexProConvertAnkiDeck(keptCards, batchSnap, kb, {
      getTrapAudit: () => '[3] Hold / Never: Hold digoxin < 60/min',
      getSourceRef: () => 'lecture.pdf p. 12',
    });

    let putBody = null;
    const authSalt = Buffer.from('0123456789abcdef').toString('base64');
    const encSalt = Buffer.from('fedcba9876543210').toString('base64');
    mockFetch = async (url, opts = {}) => {
      if (url.endsWith('/api/meta')) {
        return { ok: true, status: 200, json: async () => ({ configured: true, kdfIterations: 600000, authSalt, encSalt }) };
      }
      if (url.endsWith('/api/ai-flashcards') && (!opts.method || opts.method === 'GET')) {
        return { ok: true, status: 200, json: async () => ({ rev: 0, payload: null }) };
      }
      if (url.endsWith('/api/ai-flashcards') && opts.method === 'PUT') {
        putBody = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ ok: true, rev: 1 }) };
      }
      throw new Error('Unexpected URL: ' + url);
    };
    const syncRes = await E.nclexProSyncFlashcardsToCloud(deckPayload, { passphrase: 'correct-horse-battery-staple' });

    mockFetch = async () => { throw new Error('network failed for secret correct-horse-battery-staple'); };
    let scrubbedErr = '';
    try {
      await E.nclexProSyncFlashcardsToCloud(deckPayload, { passphrase: 'correct-horse-battery-staple' });
    } catch (e) {
      scrubbedErr = e.message;
    }

    t('v22.5 (#8 — Enriched Remediation Metadata & E2E Anki Flashcard Sync): preserves factIds/kbKey/examKey/plateBuckets/trapRoles on questions and expands multi-cloze Anki notes into AES-256-GCM encrypted /api/ai-flashcards payload',
      q0.factIds.includes('fact-102') && q0.plateBuckets.includes('Treat') && q0.trapRoles.includes('hold-triangle') &&
      q0.course === 'NURS 221' && q0.exam === 'Exam 3' && Boolean(q0.kbKey) &&
      deckPayload.cards.length === 2 &&
      deckPayload.cards[0].ord === 1 && deckPayload.cards[1].ord === 2 &&
      deckPayload.cards[0].factIds.includes('fact-102') &&
      deckPayload.cards[0].conditionNames.includes('Heart Failure') &&
      deckPayload.cards[0].plateBucket === 'Treat' &&
      deckPayload.cards[0].trapAudit.includes('Hold digoxin') &&
      syncRes.ok === true && syncRes.syncedCount === 2 &&
      Boolean(putBody && putBody.payload && !JSON.stringify(putBody).includes('digoxin')) &&
      !scrubbedErr.includes('correct-horse-battery-staple'));
  }
};
