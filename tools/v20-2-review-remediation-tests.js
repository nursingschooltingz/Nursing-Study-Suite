'use strict';

// v20.2 production-readiness remediation Phases 1–10 regression suite.
// Exercises live extracted functions from the shipped HTML and repository tooling.

const { parseMeasurementArgs } = require('./repo-checks');
const CASE_REMED = require('./case-remediation-tests');
const { createAuditCaller } = require('../neia-retest');
const { createTranscriber } = require('../davis-transcribe-test');

module.exports = async function runV202ReviewRemediationTests(S, t) {
  function span(start, end, fromAnchor) {
    const base = fromAnchor ? S.indexOf(fromAnchor) : 0;
    if (base < 0) throw new Error('v20.2 from-anchor missing: ' + fromAnchor);
    const a = S.indexOf(start, base);
    if (a < 0) throw new Error('v20.2 start anchor missing: ' + start);
    const b = S.indexOf(end, a + start.length);
    if (b < 0) throw new Error('v20.2 end anchor missing after: ' + start);
    return S.slice(a, b);
  }
  const load = (code, names, env = {}) =>
    new Function(...Object.keys(env), code + '\n;return {' + names.join(',') + '};')(...Object.values(env));

  // ── Phase 1: Model settings schema v2 & non-Hydrogen xhigh guard ──
  const MODEL = load(
    span('const MODEL_SETTINGS_KEY=', 'const ConfigCtx=createContext();'),
    ['MODEL_SETTINGS_KEY', 'MODEL_SETTINGS_SCHEMA_VERSION', 'MODEL_SETTINGS_DEFAULTS', 'THINKING_LEVELS', 'loadModelSettings', 'saveModelSettings']
  );
  const TRANSPORT = load(
    span('const GEMINI_OUTPUT_CAP=', 'async function geminiRequest('),
    ['geminiIsArgon', 'geminiIsHydrogen', 'geminiOutputCap', 'geminiGenerationConfig'],
    { THINKING_LEVELS: MODEL.THINKING_LEVELS }
  );

  t('v20.2 (Extraction tail): Phase 1–10 live spans compile and expose expected entrypoints',
    MODEL.MODEL_SETTINGS_SCHEMA_VERSION === 2 &&
    typeof MODEL.saveModelSettings === 'function' &&
    typeof TRANSPORT.geminiGenerationConfig === 'function');

  {
    const rawStore = new Map();
    const storage = {
      getItem: k => (rawStore.has(k) ? rawStore.get(k) : null),
      setItem: (k, v) => rawStore.set(k, String(v))
    };
    MODEL.saveModelSettings(storage, {
      hydrogenModel: 'gemini-4.5-hydrogen-exp',
      argonModel: 'gemini-4.5-argon-exp',
      thinkingMode: true,
      hydrogenLevel: 'xhigh',
      argonLevel: 'medium'
    });
    const persisted = JSON.parse(rawStore.get(MODEL.MODEL_SETTINGS_KEY));
    const reloaded = MODEL.loadModelSettings(storage);
    t('v20.2 (Phase 1 — saveModelSettings schemaVersion 2): stamps schemaVersion 2 and preserves explicit custom model selections across reloads',
      persisted.schemaVersion === 2 &&
      reloaded.hydrogenModel === 'gemini-4.5-hydrogen-exp' &&
      reloaded.argonModel === 'gemini-4.5-argon-exp' &&
      reloaded.thinkingMode === true &&
      reloaded.hydrogenLevel === 'xhigh' &&
      reloaded.argonLevel === 'medium');

    // A schemaVersion 2 payload never re-runs the pre-v17.13 proLevel migration shim.
    rawStore.set(MODEL.MODEL_SETTINGS_KEY, JSON.stringify({ schemaVersion: 2, proLevel: 'low' }));
    const v2NoLegacy = MODEL.loadModelSettings(storage);
    rawStore.set(MODEL.MODEL_SETTINGS_KEY, JSON.stringify({ proLevel: 'low' }));
    const v0Legacy = MODEL.loadModelSettings(storage);
    t('v20.2 (Phase 1 — gated legacy migration): schemaVersion < 2 migrates proLevel while schemaVersion >= 2 ignores stale proLevel',
      v2NoLegacy.argonLevel === 'high' && v0Legacy.argonLevel === 'low');

    const hydOut = TRANSPORT.geminiGenerationConfig('gemini-4-hydrogen', { thinkingConfig: { thinkingLevel: 'xhigh' } });
    const customOut = TRANSPORT.geminiGenerationConfig('custom-reasoning-v1', { thinkingConfig: { thinkingLevel: 'xhigh' } });
    let argonErr = null;
    try { TRANSPORT.geminiGenerationConfig('gemini-4-argon', { thinkingConfig: { thinkingLevel: 'xhigh' } }); } catch (e) { argonErr = e; }
    t('v20.2 (Phase 1 — geminiGenerationConfig xhigh guard): preserves xhigh on Hydrogen, clamps non-Hydrogen custom models to high, and refuses Argon xhigh',
      hydOut.thinkingConfig.thinkingLevel === 'xhigh' &&
      customOut.thinkingConfig.thinkingLevel === 'high' &&
      Boolean(argonErr && argonErr.isFatal === true && argonErr.status === 400));

    const cliCustom = parseMeasurementArgs(['--model', 'custom-reasoning-v1', '--level', 'xhigh', '--dry-run'], 'neia');
    const cliHyd = parseMeasurementArgs(['--model', 'gemini-4-hydrogen', '--level', 'xhigh', '--dry-run'], 'neia');
    let cliArgonErr = '';
    try { parseMeasurementArgs(['--model', 'gemini-4-argon', '--level', 'xhigh', '--dry-run'], 'neia'); } catch (e) { cliArgonErr = e.message; }
    t('v20.2 (Phase 1 — CLI parseMeasurementArgs xhigh guard): clamps custom non-Hydrogen xhigh to high, keeps Hydrogen xhigh, and rejects Argon xhigh',
      cliCustom.level === 'high' && cliHyd.level === 'xhigh' && /Argon does not accept/.test(cliArgonErr));
  }

  // ── Phase 2: IndexedDB open watchdog / blocked / versionchange, archive quota recovery, & cross-tab storage sync ──
  {
    const idbCode = span("const KB_DB_NAME='latte-study-suite';", 'function kbCreateSaveQueue(');
    const makeIdbEnv = ({ indexedDBImpl, localStorageImpl, downloadBlobImpl }) =>
      load(idbCode, ['kbOpenDB', 'kbArchiveRecovery', 'KB_RECOVERY_ARCHIVES'], {
        indexedDB: indexedDBImpl,
        localStorage: localStorageImpl || {},
        downloadBlob: downloadBlobImpl,
        Blob: typeof Blob === 'function' ? Blob : class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } }
      });

    // 1) onblocked rejects immediately
    let blockedErr = '';
    const blockedEnv = makeIdbEnv({
      indexedDBImpl: {
        open() {
          const req = {};
          setTimeout(() => req.onblocked && req.onblocked(), 0);
          return req;
        }
      }
    });
    try { await blockedEnv.kbOpenDB(500); } catch (e) { blockedErr = e.message; }

    // 2) hung open rejects after watchdog timeout and closes a late onsuccess db
    let hungErr = '', lateClosed = false, pendingReq = null;
    const hungEnv = makeIdbEnv({
      indexedDBImpl: {
        open() { pendingReq = {}; return pendingReq; }
      }
    });
    try { await hungEnv.kbOpenDB(25); } catch (e) { hungErr = e.message; }
    pendingReq.result = { close() { lateClosed = true; } };
    if (pendingReq.onsuccess) pendingReq.onsuccess();

    // 3) successful open wires db.onversionchange -> db.close()
    let vcClosed = false;
    const okEnv = makeIdbEnv({
      indexedDBImpl: {
        open() {
          const req = {};
          setTimeout(() => {
            req.result = { close() { vcClosed = true; } };
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        }
      }
    });
    const openedDb = await okEnv.kbOpenDB(500);
    if (typeof openedDb.onversionchange === 'function') openedDb.onversionchange();

    t('v20.2 (Phase 2 — kbOpenDB resilience): rejects blocked upgrades, times out hung opens while closing late connections, and closes on versionchange',
      /blocked/i.test(blockedErr) && /timed out/i.test(hungErr) && lateClosed === true && vcClosed === true);

    // 4) kbArchiveRecovery prunes before writing, retries after full archive eviction on quota error, and falls back to JSON download
    const mem = new Map();
    for (let i = 0; i < 5; i++) mem.set('latte_recovery-100' + i + '-old', '[{"kb":{"old":' + i + '}}]');
    let maxArchiveCountDuringWrite = 0;
    const quotaOnceStorage = {
      get length() { return mem.size; },
      key: i => [...mem.keys()][i] || null,
      getItem: k => mem.get(k) || null,
      removeItem: k => mem.delete(k),
      setItem: (k, v) => {
        const currentCount = [...mem.keys()].filter(x => x.startsWith('latte_recovery-')).length;
        maxArchiveCountDuringWrite = Math.max(maxArchiveCountDuringWrite, currentCount + 1);
        if (currentCount > 0) throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
        mem.set(k, String(v));
      }
    };
    const evictEnv = makeIdbEnv({ indexedDBImpl: null, localStorageImpl: quotaOnceStorage });
    const evictRes = await evictEnv.kbArchiveRecovery([{ kb: { fresh: true } }]);

    const downloads = [];
    const fullStorage = {
      length: 0,
      key: () => null,
      removeItem() {},
      setItem() { throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' }); }
    };
    const dlEnv = makeIdbEnv({
      indexedDBImpl: null,
      localStorageImpl: fullStorage,
      downloadBlobImpl: (blob, filename) => downloads.push({ blob, filename })
    });
    const dlRes = await dlEnv.kbArchiveRecovery([{ kb: { rescued: true } }]);

    t('v20.2 (Phase 2 — kbArchiveRecovery quota safety): prunes stale archives before write, retries after full archive eviction, and falls back to JSON download',
      maxArchiveCountDuringWrite <= 5 &&
      evictRes.archived === 'localStorage' &&
      mem.size === 1 &&
      dlRes.archived === 'download' &&
      downloads.length === 1 &&
      /^LATTE-Knowledge-Base-recovery-.*\.json$/.test(downloads[0].filename));

    // 5) Cross-tab storage listener in App
    const defaultsTable = load(span('const TOOL_PROFILE_DEFAULTS=', 'const PROFILE_ROWS='), ['TOOL_PROFILE_DEFAULTS']).TOOL_PROFILE_DEFAULTS;
    const listenerBlock = span('    const onStorage=ev=>{', '    window.addEventListener(\'storage\',onStorage);', 'function App()');
    const syncState = { hydrogenModel: 'gemini-4-hydrogen', argonModel: 'gemini-4-argon', thinkingMode: false, hydrogenLevel: 'low', argonLevel: 'high', autoProfile: true, profiles: defaultsTable };
    const tabStore = new Map();
    const fakeLocal = { getItem: k => tabStore.get(k) ?? null, setItem: (k, v) => tabStore.set(k, String(v)) };
    const { onStorage } = load(listenerBlock, ['onStorage'], {
      localStorage: fakeLocal,
      MODEL_SETTINGS_KEY: MODEL.MODEL_SETTINGS_KEY,
      loadModelSettings: s => MODEL.loadModelSettings(s),
      TOOL_PROFILE_DEFAULTS: defaultsTable,
      setHydrogenModel: v => { syncState.hydrogenModel = v; },
      setArgonModel: v => { syncState.argonModel = v; },
      setThinkingMode: v => { syncState.thinkingMode = v; },
      setHydrogenLevel: v => { syncState.hydrogenLevel = v; },
      setArgonLevel: v => { syncState.argonLevel = v; },
      setAutoProfile: v => { syncState.autoProfile = v; },
      setProfiles: v => { syncState.profiles = v; }
    });
    MODEL.saveModelSettings(fakeLocal, { hydrogenModel: 'gemini-4-hydrogen-next', argonModel: 'gemini-4-argon-next', thinkingMode: true, hydrogenLevel: 'xhigh', argonLevel: 'low' });
    onStorage({ key: MODEL.MODEL_SETTINGS_KEY, storageArea: fakeLocal });
    onStorage({ key: 'latte_auto_profile_v1', newValue: '0', storageArea: fakeLocal });
    onStorage({ key: 'latte_tool_profiles_v1', newValue: JSON.stringify({ anki: { m: 'hydrogen', lv: 'xhigh' }, cases: { m: 'argon', lv: 'xhigh' } }), storageArea: fakeLocal });
    onStorage({ key: 'latte_auto_profile_v1', newValue: '1', storageArea: {} }); // ignored: non-localStorage area

    t('v20.2 (Phase 2 — cross-tab storage sync): syncs model settings, auto-profile toggle, and clamped tool profiles across tabs while ignoring other storage areas',
      syncState.hydrogenModel === 'gemini-4-hydrogen-next' &&
      syncState.hydrogenLevel === 'xhigh' &&
      syncState.argonLevel === 'low' &&
      syncState.thinkingMode === true &&
      syncState.autoProfile === false &&
      syncState.profiles.anki.lv === 'xhigh' &&
      syncState.profiles.cases.lv === 'high');
  }

  // ── Phase 3: Entity latteBucket validation & multi-chunk / import entity deduplication ──
  {
    const N = load(span('function kbSlug(', '// v15.14: the class kept ASCII'), ['normalizeKbEntities', 'kbDedupEntities', 'KB_FACT_BUCKETS']);
    const M = load(span('function kbSlug(', '// ── Imported-KB sanitizer'), ['mergeLatteParts']);
    const I = load(span('function kbSlug(', '// v15.14: the class kept ASCII') + '\n' + span('const KB_IMPORT_MAX_BYTES=', '// ── Durable Knowledge Base persistence'), ['kbNormalizeImported']);

    const badEntityKb = {
      conditions: [{ id: 'hf', name: 'Heart Failure', aliases: [], facts: [{ id: 'fact-1', text: 'Crackles on auscultation.', latteBucket: 'Look', tier: 1, sources: [{ filename: 'a.pdf', location: 'p.1' }] }] }],
      medications: [{
        name: 'Furosemide',
        facts: [
          { id: 'fact-2', text: 'Administer slowly IV.', latteBucket: 'Treatment', tier: 1, sources: [{ filename: 'a.pdf', location: 'p.2' }] },
          { id: 'fact-3', text: 'Report tinnitus immediately.', latteBucket: 'Education', tier: 1, sources: [{ filename: 'a.pdf', location: 'p.2' }] }
        ]
      }],
      diagnostics: [{
        name: 'BNP',
        facts: [{ id: 'fact-4', text: 'Elevated above 100 pg/mL in ventricular stretch.', latteBucket: null, tier: 1, sources: [{ filename: 'a.pdf', location: 'p.3' }] }]
      }],
      scoringTools: []
    };
    const once = N.normalizeKbEntities(badEntityKb);
    const twice = N.normalizeKbEntities(once.kb);
    t('v20.2 (Phase 3 — entity bucket coercion & idempotence): coerces invalid entity latteBucket values onto KB_FACT_BUCKETS and stays reference-idempotent on second pass',
      once.kb.medications[0].facts[0].latteBucket === 'Treatments' &&
      once.kb.medications[0].facts[1].latteBucket === 'Educate' &&
      once.kb.diagnostics[0].facts[0].latteBucket === 'Tests' &&
      once.report.factsRepaired === 3 &&
      twice.kb === once.kb);

    const chunk1 = {
      source: { filename: 'cardiac.pdf', range: 'pages 1-5' },
      conditions: [{ name: 'Heart Failure', aliases: ['HF'], facts: [{ text: 'Dyspnea on exertion.', latteBucket: 'Look', tier: 1, sourceQuote: 'Dyspnea on exertion.', sourcePointer: { filename: 'cardiac.pdf', location: 'p. 1' } }] }],
      medications: [{ name: 'Furosemide', aliases: ['Lasix'], class: 'Loop diuretic', indications: ['Pulmonary edema'] }],
      diagnostics: [{ name: 'BNP', normalRange: '< 100 pg/mL' }],
      scoringTools: [{ name: 'NYHA Class', scoringRange: 'I to IV' }]
    };
    const chunk2 = {
      source: { filename: 'cardiac.pdf', range: 'pages 6-10' },
      conditions: [{ name: 'HF', aliases: [], facts: [{ text: 'Monitor daily weight.', latteBucket: 'Assess', tier: 1, sourceQuote: 'Monitor daily weight.', sourcePointer: { filename: 'cardiac.pdf', location: 'p. 6' } }] }],
      medications: [{ name: 'Lasix', indications: ['Pulmonary edema'], considerations: ['Monitor serum potassium'] }],
      diagnostics: [{ name: 'bnp', criticalValues: '> 400 pg/mL' }],
      scoringTools: [{ name: 'nyha class', interpretation: 'Class IV symptoms at rest' }]
    };
    const merged = M.mergeLatteParts([chunk1, chunk2], 'Med-Surg', 'Exam 2');
    const allEntityFactIds = ['medications', 'diagnostics', 'scoringTools'].flatMap(k => merged[k].flatMap(e => e.facts.map(f => f.id)));
    const expectedContiguous = Array.from({ length: allEntityFactIds.length }, (_, i) => 'fact-' + (3 + i));
    const dupIndicationFacts = merged.medications[0].facts.filter(f => /indication: Pulmonary edema/i.test(f.text));

    t('v20.2 (Phase 3 — mergeLatteParts entity dedup): merges duplicate medications/diagnostics/scoringTools across chunks (including aliases), unions sources, and keeps fact-N IDs contiguous',
      merged.medications.length === 1 &&
      merged.diagnostics.length === 1 &&
      merged.scoringTools.length === 1 &&
      merged.medications[0].aliases.includes('Lasix') &&
      dupIndicationFacts.length === 1 &&
      dupIndicationFacts[0].sources.length === 2 &&
      merged.medications[0].facts.some(f => /Monitor serum potassium/.test(f.text)) &&
      JSON.stringify(allEntityFactIds) === JSON.stringify(expectedContiguous));

    const rawImportDup = {
      metadata: { course: 'Med-Surg', exam: 'Exam 2', schemaVersion: '1.2' },
      conditions: merged.conditions,
      medications: [
        { name: 'Spironolactone', class: 'Aldosterone antagonist', sourcePointer: { filename: 'a.pdf', location: 'p.1' } },
        { name: 'spironolactone', considerations: ['Watch for hyperkalemia'], sourcePointer: { filename: 'a.pdf', location: 'p.4' } }
      ],
      diagnostics: [],
      scoringTools: []
    };
    const imp = I.kbNormalizeImported(JSON.parse(JSON.stringify(rawImportDup)));
    t('v20.2 (Phase 3 — kbNormalizeImported entity dedup): deduplicates standalone entities on import and numbers entity facts contiguously after conditions',
      imp.kb.medications.length === 1 &&
      imp.kb.medications[0].facts.length === 2 &&
      imp.kb.medications[0].facts.map(f => f.id).join(',') === 'fact-3,fact-4');
  }

  // ── Phase 4: artifactSourceSnapshot WeakMap memoization, deterministic packet commit, & pruneArtifact ──
  {
    const { kbFactView } = load(span('function validateLatteKnowledgeBase(', '\nfunction kbBucketFacts('), ['kbFactView']);
    const { buildFactIndex } = load(
      span('function buildFactIndex(kb){', 'function findFactById('),
      ['buildFactIndex'],
      { kbFactView }
    );
    const { artifactSourceSnapshot } = load(
      span('function artifactSourceSnapshot(', 'function artifactExportNotice('),
      ['artifactSourceSnapshot'],
      { buildFactIndex }
    );
    const kbA = { conditions: [{ id: 'c1', name: 'SIADH', aliases: [], facts: [{ id: 'fact-1', text: 'Serum Na < 135 mEq/L.', latteBucket: 'Tests', tier: 1, sources: [] }] }], medications: [], diagnostics: [], scoringTools: [] };
    const kbB = JSON.parse(JSON.stringify(kbA));
    const s1 = artifactSourceSnapshot(kbA);
    const s2 = artifactSourceSnapshot(kbA);
    const s3 = artifactSourceSnapshot(kbB);
    t('v20.2 (Phase 4 — artifactSourceSnapshot WeakMap): memoizes identical frozen snapshot per sourceKB object and refreshes on KB replacement',
      s1 === s2 && s1 !== s3 && Object.isFrozen(s1) && Object.isFrozen(s1.kb) && s1.factIndex.has('fact-1'));

    // Deterministic packet commit inside CaseStudyGenerator.run without relying on useEffect
    const C = CASE_REMED.load(S);
    const runStart = S.indexOf('  const run=useCallback(async()=>{', S.indexOf('function CaseStudyGenerator(){'));
    const runEnd = S.indexOf('\n\n  // v15.6: audit verdicts', runStart);
    const createOperationSlot = load(span('function createOperationSlot(){', 'function cardCurrentEntries('), ['createOperationSlot']).createOperationSlot;
    let packetState = [];
    const casePacketRef = { current: packetState };
    let registeredEntries = [];
    const kbObj = {};
    const env = {
      ...C,
      caseRepairContract: C.repairContract,
      caseShuffleQuestion: q => C.shuffle(q, () => 0.5),
      caseShuffleIssues: C.shuffleIssues,
      useCallback: fn => fn,
      batchOverrideRef: { current: { condition: { name: 'Synthetic' }, facts: [{ id: 'f1' }], sufficiency: { warnings: [] }, keepLogs: true, packetId: 'pkt-bg-1', completed: false, halted: '' } },
      setActivePacketId: () => {},
      setCasePacket: fn => { packetState = typeof fn === 'function' ? fn(packetState) : fn; },
      casePacketRef,
      cfg: { apiKey: 'synthetic', forTool: () => ({ model: 'gemini-4-argon', level: 'high' }) },
      K: { knowledgeBase: kbObj, isCurrentSource: () => true, registerArtifact: (_kind, entries) => { registeredEntries = entries; } },
      generatorSlot: { current: createOperationSlot() },
      currentSourceKB: { current: kbObj },
      artifactSourceSnapshot: () => ({ sourceKB: kbObj, factIndex: CASE_REMED.index('Monitor the marker.') }),
      activeCondition: { name: 'Synthetic' },
      selectedFacts: [{ id: 'f1' }],
      sufficiency: { warnings: [] },
      difficulty: 'exam',
      stages: 1,
      questionsPerStage: 1,
      types: { mcq: true },
      runAudit: true,
      caseBuildPrompt: () => 'PROMPT',
      caseBuildRepairPrompt: () => '{}',
      extractJSON: JSON.parse,
      isQuotaError: () => false,
      uid: () => 'u99999',
      log: () => {},
      setBusy: () => {}, setLogs: () => {}, setCaseStudy: () => {}, setIssues: () => {}, setCoverage: () => {},
      setLiveKB: () => {}, setAudit: () => {}, setAuditPhase: () => {}, setProvenance: () => {},
      setInvalidCaseRaw: () => {}, setAbortCtl: () => {}, setArtifactSource: () => {}, setAuditState: () => {},
      callGemini: async (_k, _m, parts) => parts[0].text.includes('NCLEX ITEM QUALITY REVIEW') ? 'PASS' : JSON.stringify(CASE_REMED.fixture())
    };
    const runFn = new Function('env', 'with(env){' + S.slice(runStart, runEnd) + ';return run;}')(env);
    await runFn();

    t('v20.2 (Phase 4 — deterministic packet commit): CaseStudyGenerator.run commits completed auditState, coverage, verdict map, and caseId without useEffect',
      packetState.length === 1 &&
      packetState[0].id === 'pkt-bg-1' &&
      packetState[0].auditState === 'complete' &&
      packetState[0].coverage.used === 1 &&
      packetState[0].audit['1:q1'].status === 'PASS' &&
      Boolean(packetState[0].caseId) &&
      registeredEntries.every(e => e.caseId === packetState[0].caseId));

    // pruneArtifact + removePacketEntry + clearPacket
    let registry = {
      ankiNotes: [{ id: 'anki-1', factIds: ['f1'] }],
      nclexQuestions: [{ id: 'nclex-1', factIds: ['f1'] }],
      caseStudies: [
        { id: 'case-a:1:q1', caseId: 'case-a', factIds: ['f1'] },
        { id: 'case-b:1:q1', caseId: 'case-b', factIds: ['f1'] }
      ]
    };
    const pruneCode = span('  const pruneArtifact=useCallback(', '  // Merge a batch of generated artifacts', 'function App()');
    const pruneArtifact = load(pruneCode, ['pruneArtifact'], {
      useCallback: fn => fn,
      setArtifactRegistry: fn => { registry = fn(registry); }
    }).pruneArtifact;

    const pktRef = {
      current: [
        { id: 'pkt-1', caseId: 'case-a', caseStudy: { title: 'A' } },
        { id: 'pkt-2', caseId: 'case-b', caseStudy: { title: 'B' } }
      ]
    };
    const pktOpsCode = span('  const removePacketEntry=useCallback(', '  const isBatchMode=', 'function CaseStudyGenerator()');
    const pktOps = load(pktOpsCode, ['removePacketEntry', 'clearPacket'], {
      useCallback: fn => fn,
      casePacketRef: pktRef,
      setCasePacket: v => { pktRef.current = v; },
      activePacketId: 'pkt-1',
      selectPacketEntry: () => {},
      setActivePacketId: () => {}, setCaseStudy: () => {}, setIssues: () => {}, setCoverage: () => {},
      setAudit: () => {}, setAuditState: () => {}, setProvenance: () => {}, setArtifactSource: () => {}, setInvalidCaseRaw: () => {},
      K: { pruneArtifact }
    });
    pktOps.removePacketEntry('pkt-1');
    const afterRemove = JSON.parse(JSON.stringify(registry));
    pktOps.clearPacket();

    t('v20.2 (Phase 4 — pruneArtifact on packet remove/clear): removing one packet entry prunes only its caseId while preserving other cases and tools; clearPacket empties caseStudies',
      afterRemove.caseStudies.length === 1 &&
      afterRemove.caseStudies[0].caseId === 'case-b' &&
      afterRemove.ankiNotes.length === 1 &&
      registry.caseStudies.length === 0 &&
      registry.nclexQuestions.length === 1);
  }

  // ── Phase 5: File intake caps, header decompression-bomb guards, PDF worker cleanup, PPTX EOCD/XXE, & null-proto caches ──
  {
    // 1) PDF 150 MB intake cap
    const PDF = load(
      span('const MAX_PDF_BYTES=', 'function destroyPdfDoc('),
      ['MAX_PDF_BYTES', 'getPdfDoc'],
      { _pdfDocCache: new WeakMap(), _pdfWorkerOwner: null, pdfEnsureVerifiedWorker: async () => ({}), _pdfLoadingTasks: new Set(), _pdfLiveDocs: new Set(), pdfjsLib: {} }
    );
    let pdfArrayBufferCalled = false, pdfCapErr = '';
    try {
      await PDF.getPdfDoc({ name: 'giant.pdf', size: 151 * 1024 * 1024, arrayBuffer() { pdfArrayBufferCalled = true; return new ArrayBuffer(0); } });
    } catch (e) { pdfCapErr = e.message; }
    t('v20.2 (Phase 5 — PDF 150 MB cap): getPdfDoc rejects >150 MB PDFs before calling file.arrayBuffer()',
      PDF.MAX_PDF_BYTES === 150 * 1024 * 1024 && /150 MB/.test(pdfCapErr) && pdfArrayBufferCalled === false);

    // 2) Image dimension header probing, 25 MB / 15 MB caps, 64 MP bomb rejection before createImageBitmap, and canvas zeroing
    const getExtLive = load(span('function getExt', 'toLowerCase();}') + 'toLowerCase();}', ['getExt']).getExt;
    const CARD = load(
      span('const CARD_IMAGE_RE', 'const CARD_TRANSCRIBE_PROMPT='),
      ['CARD_MAX_FILE_BYTES', 'CARD_MAX_INLINE_BYTES', 'CARD_MAX_PIXELS', 'probeImageDimensions', 'cardValidateImageSafety', 'cardFilePayload'],
      { getExt: getExtLive }
    );

    // Synthetic PNG (32768x32768 = 1,073,741,824 px > 64 MP) and JPEG SOF0 (4000x3000) headers
    const pngBomb = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x80, 0x00, // width = 32768
      0x00, 0x00, 0x80, 0x00  // height = 32768
    ]);
    const jpegOk = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x04, 0x00, 0x00,
      0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x0B, 0xB8, 0x0F, 0xA0, 0x01, 0x01, 0x11, 0x00
    ]);
    const gifOk = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02]); // 800x600
    const pngDims = CARD.probeImageDimensions(pngBomb);
    const jpgDims = CARD.probeImageDimensions(jpegOk);
    const gifDims = CARD.probeImageDimensions(gifOk);
    t('v20.2 (Phase 5 — probeImageDimensions): reads PNG IHDR, JPEG SOF0, and GIF89a dimensions from header bytes',
      pngDims.width === 32768 && pngDims.height === 32768 &&
      jpgDims.width === 4000 && jpgDims.height === 3000 &&
      gifDims.width === 800 && gifDims.height === 600);

    let cibCalls = 0, bombErr = '', over25Err = '', over15Err = '';
    const lastCanvas = { width: -1, height: -1 };
    const hadCIB = 'createImageBitmap' in global, hadDoc = 'document' in global;
    global.createImageBitmap = async () => { cibCalls++; return { width: 4000, height: 3000, close() {} }; };
    global.document = {
      createElement: () => {
        const cv = {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage() {}, imageSmoothingEnabled: false, imageSmoothingQuality: '' }),
          toDataURL: () => 'data:image/jpeg;base64,RESIZED'
        };
        lastCanvas.ref = cv;
        return cv;
      }
    };
    try {
      const bombFile = {
        name: 'bomb.png',
        size: 4096,
        slice: () => ({ arrayBuffer: async () => pngBomb.buffer })
      };
      try { await CARD.cardFilePayload(bombFile); } catch (e) { bombErr = e.message; }
      try { await CARD.cardFilePayload({ name: 'huge.jpg', size: 26 * 1024 * 1024 }); } catch (e) { over25Err = e.message; }

      const resizedOk = await CARD.cardFilePayload({
        name: 'photo.jpg',
        size: 5 * 1024 * 1024,
        slice: () => ({ arrayBuffer: async () => jpegOk.buffer })
      });
      lastCanvas.width = lastCanvas.ref.width;
      lastCanvas.height = lastCanvas.ref.height;

      global.createImageBitmap = async () => { throw new Error('HEIC unsupported'); };
      try { await CARD.cardFilePayload({ name: 'big.heic', size: 16 * 1024 * 1024 }); } catch (e) { over15Err = e.message; }

      // i2aImagePayload also blocks <15 MB header bombs before raw base64 pass-through
      const { i2aImagePayload } = load(
        span('async function i2aImagePayload(file){', 'const N2A_MODES='),
        ['i2aImagePayload'],
        { cardValidateImageSafety: CARD.cardValidateImageSafety, I2A_MAX_RAW_BYTES: 15 * 1024 * 1024, CARD_MIME: { png: 'image/png' }, getExt: getExtLive, cardFileToBase64: async () => 'B64', cardFilePayload: CARD.cardFilePayload }
      );
      let i2aBombErr = '';
      try { await i2aImagePayload(bombFile); } catch (e) { i2aBombErr = e.message; }

      t('v20.2 (Phase 5 — image safety & canvas cleanup): blocks >25 MB files, blocks >64 MP header bombs before createImageBitmap in both tools, blocks >15 MB unresized fallbacks, and zeroes canvas dimensions',
        cibCalls === 1 &&
        /64 MP/.test(bombErr) &&
        /64 MP/.test(i2aBombErr) &&
        /25 MB/.test(over25Err) &&
        /15 MB/.test(over15Err) &&
        Boolean(resizedOk.resized) &&
        lastCanvas.width === 0 &&
        lastCanvas.height === 0);
    } finally {
      if (!hadCIB) delete global.createImageBitmap;
      if (!hadDoc) delete global.document;
    }

    // 3) PPTX EOCD pre-check, XML DOCTYPE/ENTITY rejection, and zip.files hasOwnProperty guard
    let domParserCalls = 0, jszipCalls = 0;
    const PPTX = load(
      span('const _OOXML_A_NS =', '// Single core for ALL Gemini traffic:'),
      ['_pptxParseXml', '_pptxZipEocdEntries', 'extractPptxText'],
      {
        DOMParser: class {
          parseFromString() {
            domParserCalls++;
            return { getElementsByTagName: () => [], getElementsByTagNameNS: () => [{ firstElementChild: null, textContent: 'Clean slide text' }] };
          }
        },
        JSZip: {
          loadAsync: async () => {
            jszipCalls++;
            return {
              files: {
                'ppt/presentation.xml': { internalStream: () => ({ pause() {}, on(ev, fn) { if (ev === 'data') this._d = fn; if (ev === 'end') this._e = fn; return this; }, resume() { this._d(new TextEncoder().encode('<p:presentation/>')); this._e(); } }) },
                'ppt/_rels/presentation.xml.rels': { internalStream: () => ({ pause() {}, on(ev, fn) { if (ev === 'data') this._d = fn; if (ev === 'end') this._e = fn; return this; }, resume() { this._d(new TextEncoder().encode('<Relationships/>')); this._e(); } }) },
                'ppt/slides/slide1.xml': { internalStream: () => ({ pause() {}, on(ev, fn) { if (ev === 'data') this._d = fn; if (ev === 'end') this._e = fn; return this; }, resume() { this._d(new TextEncoder().encode('<p:sld><a:t>Clean</a:t></p:sld>')); this._e(); } }) }
              }
            };
          }
        }
      }
    );

    let xxeErr = '';
    try { PPTX._pptxParseXml('<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]><p:sld/>'); } catch (e) { xxeErr = e.message; }

    const eocdBomb = new Uint8Array(22);
    eocdBomb[0] = 0x50; eocdBomb[1] = 0x4B; eocdBomb[2] = 0x05; eocdBomb[3] = 0x06;
    eocdBomb[10] = 0x11; eocdBomb[11] = 0x27; // 0x2711 = 10,001 entries > 10,000 limit
    let eocdErr = '';
    try {
      await PPTX.extractPptxText({
        name: 'flood.pptx',
        size: 22,
        slice: () => ({ arrayBuffer: async () => eocdBomb.buffer })
      });
    } catch (e) { eocdErr = e.message; }

    t('v20.2 (Phase 5 — PPTX EOCD & XML entity guards): blocks <!DOCTYPE/<!ENTITY before DOMParser and blocks >10,000 EOCD entries before JSZip.loadAsync',
      /DOCTYPE or ENTITY/.test(xxeErr) &&
      domParserCalls === 0 &&
      PPTX._pptxZipEocdEntries(eocdBomb) === 10001 &&
      /too many ZIP entries/.test(eocdErr) &&
      jszipCalls === 0 &&
      S.includes('Object.prototype.hasOwnProperty.call(zip.files,name)'));

    // 4) Prototype-pollution hardening on normalizeKbEntities & i2aEmptyCache/i2aMergeCache, 50 MB transcripts cap, and destroyPdfDoc wiring
    const N = load(span('function kbSlug(', '// v15.14: the class kept ASCII'), ['normalizeKbEntities']);
    const unmappedRes = N.normalizeKbEntities({
      conditions: [],
      medications: [JSON.parse('{"name":"TestDrug","class":"Beta blocker","__proto__":{"polluted":true},"constructor":"bad","customField":"kept"}')]
    });
    const N2A = load(span('// ──── TOOL: NCLEX to Anki ────', 'async function i2aFileKey('), ['i2aEmptyCache', 'i2aMergeCache', 'I2A_VERSION']);
    const cache = N2A.i2aEmptyCache();
    const mergedCount = N2A.i2aMergeCache(cache, JSON.parse('{"images":{"__proto__":{"items":[]},"constructor":{"items":[]},"img1":{"items":[]}},"ai":{"__proto__":{"answer":"A"},"q1":{"answer":"B"}}}'));

    let transcriptNotes = [], transcriptTextRead = false;
    const { loadTranscripts } = load(
      span('  const loadTranscripts=async fl=>{', '\n\n  const canRun='),
      ['loadTranscripts'],
      { busy: false, reading: false, setNote: msg => transcriptNotes.push(msg), i2aMergeCache: N2A.i2aMergeCache, cacheRef: { current: cache }, setCacheCount: () => {} }
    );
    await loadTranscripts([{ name: 'huge_transcripts.json', size: 51 * 1024 * 1024, text: async () => { transcriptTextRead = true; return '{}'; } }]);

    t('v20.2 (Phase 5 — null-prototype maps, 50 MB transcripts cap, & PDF worker cleanup): blocks prototype keys, caps loadTranscripts at 50 MB, and cleans up PDF workers',
      Object.getPrototypeOf(unmappedRes.report.unmapped) === null &&
      unmappedRes.report.unmapped.customField === 1 &&
      Object.getPrototypeOf(cache.images) === null &&
      Object.getPrototypeOf(cache.ai) === null &&
      mergedCount === 1 &&
      cache.ai.q1.answer === 'B' &&
      !('polluted' in ({})) &&
      transcriptTextRead === false &&
      transcriptNotes.some(m => /50 MB/.test(m)) &&
      S.includes("finally{if(typeof destroyPdfDoc==='function'&&(/\\.pdf$/i.test(f.name||'')||f.type==='application/pdf'))destroyPdfDoc(f);}") &&
      S.includes('filesRef.current.forEach(destroyPdfDoc)') &&
      S.includes('finally{destroyPdfDoc(workFiles[fi]);}'));
  }

  // ── Phase 6: Transport secret redaction, retry jitter, SSE keep-alive streaming, prefix caching, & API key UI ──
  {
    const sleepCalls = [], fetchUrls = [], fetchBodies = [], metaLogs = [];
    let fetchImpl = async () => { throw new Error('unconfigured fetch'); };
    const mathMock = Object.create(Math);
    mathMock.random = () => 0.5;
    const GEM = load(
      '"use strict";\n' + span('function geminiRetryDelayMs(', 'function extractJSON('),
      ['redactApiSecrets', 'geminiRetryDelayMs', 'geminiRequest', 'callGemini'],
      {
        THINKING_LEVELS: MODEL.THINKING_LEVELS,
        SAFETY_SETTINGS: [],
        Math: mathMock,
        fetch: (url, opts) => { fetchUrls.push(url); fetchBodies.push(opts && opts.body ? JSON.parse(opts.body) : null); return fetchImpl(url, opts); },
        _sleep: async ms => { sleepCalls.push(ms); }
      }
    );

    const testKey = 'my-custom-secret-key-998877';
    const leaked = GEM.redactApiSecrets('Upstream rejected ' + testKey + ' and AIzaSyTestKeyLeak1234567890ABCDEF', testKey);

    fetchImpl = async () => ({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({ error: { message: 'Invalid key ' + testKey + ' or AIzaSyEchoedProviderSecret9876543210' } })
    });
    let httpErrMsg = '';
    try {
      await GEM.geminiRequest(testKey, 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } }, {
        retries: 0,
        onMeta: m => metaLogs.push(m)
      });
    } catch (e) { httpErrMsg = e.message; }

    // Strict-mode AbortError with getter-only DOMException.message must never become TypeError
    const abortCtl = new AbortController();
    fetchImpl = async () => {
      abortCtl.abort();
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }] })
      };
    };
    let abortErr = null;
    try {
      await GEM.geminiRequest(testKey, 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } }, {
        signal: abortCtl.signal,
        retries: 0
      });
    } catch (e) { abortErr = e; }

    t('v20.2 (Phase 6 — redactApiSecrets & geminiRequest redaction): scrubs echoed keys and AIza tokens from HTTP errors and onMeta while preserving strict-mode AbortError',
      leaked === 'Upstream rejected [REDACTED] and [REDACTED_GEMINI_KEY]' &&
      !httpErrMsg.includes(testKey) &&
      !httpErrMsg.includes('AIzaSy') &&
      httpErrMsg.includes('[REDACTED]') &&
      httpErrMsg.includes('[REDACTED_GEMINI_KEY]') &&
      metaLogs.length === 1 &&
      !metaLogs[0].error.includes(testKey) &&
      !metaLogs[0].error.includes('AIzaSy') &&
      Boolean(abortErr && abortErr.name === 'AbortError'));

    // Network retry jitter (Math.random() = 0.5 -> 2000 + 500 = 2500ms on attempt 0) vs RetryInfo floor (7s -> 7000ms)
    sleepCalls.length = 0;
    let netAttempts = 0;
    fetchImpl = async () => {
      netAttempts++;
      if (netAttempts === 1) throw new Error('Failed to fetch');
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'recovered' }] } }] })
      };
    };
    const netOut = await GEM.geminiRequest(testKey, 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } }, { retries: 1 });
    const netSleep = sleepCalls[0];

    sleepCalls.length = 0;
    let rlAttempts = 0;
    fetchImpl = async () => {
      rlAttempts++;
      if (rlAttempts === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => null },
          json: async () => ({ error: { message: 'Quota', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '7s' }] } })
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'paced' }] } }] })
      };
    };
    const rlOut = await GEM.geminiRequest(testKey, 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } }, { retries: 1 });
    const rlSleep = sleepCalls[0];

    // stream:true without onUpdate uses :streamGenerateContent?alt=sse with ReadableStream chunks AND JSON mock fallback
    fetchUrls.length = 0;
    const sseChunks = [
      new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"{\\"ok\\":"}]}}]}\n\n'),
      new TextEncoder().encode('data: {"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"true}"}]}}]}\n\n')
    ];
    let chunkIdx = 0;
    fetchImpl = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: { getReader: () => ({ read: async () => (chunkIdx < sseChunks.length ? { done: false, value: sseChunks[chunkIdx++] } : { done: true }), releaseLock() {}, cancel: async () => {} }) }
    });
    const sseOut = await GEM.geminiRequest(testKey, 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } } }, { stream: true, retries: 0 });
    const sseUrl = fetchUrls[0];

    fetchImpl = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"fallback":1}' }] } }] })
    });
    const jsonFallbackOut = await GEM.geminiRequest(testKey, 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } } }, { stream: true, retries: 0 });

    t('v20.2 (Phase 6 — retry jitter & SSE keep-alive streaming): applies uniform 0..999 ms jitter on network retries, honors RetryInfo floors, and streams non-UI calls via SSE with JSON fallback',
      netOut === 'recovered' &&
      netSleep === 2500 &&
      rlOut === 'paced' &&
      rlSleep === 7000 &&
      /:streamGenerateContent\?alt=sse$/.test(sseUrl) &&
      sseOut === '{"ok":true}' &&
      jsonFallbackOut === '{"fallback":1}');

    // callGemini systemInstruction + nclexCallGemini prefix split + CLI jitter + #suite-api-key hardening
    fetchBodies.length = 0;
    fetchImpl = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'sys-ok' }] } }] })
    });
    await GEM.callGemini(testKey, 'gemini-4-hydrogen', [{ text: 'USER_PAYLOAD' }], { thinkingLevel: 'low', systemInstruction: 'STATIC_SYS_PROMPT', retries: 0 });
    const callBody = fetchBodies[0];

    let capturedNclexBody = null, capturedNclexOpts = null;
    const { nclexCallGemini } = load(
      span('  async function nclexCallGemini(prompt,signal){', '\n\n  // v17.4: one admission path'),
      ['nclexCallGemini'],
      {
        toolLevel: 'low',
        cfg: { apiKey: testKey },
        model: 'gemini-4-hydrogen',
        NCLEX_INLINE_PROMPT: 'INLINE_STATIC_PREFIX\n',
        NCLEX_SPLIT_PROMPT: 'SPLIT_STATIC_PREFIX\n',
        NCLEX_AI_PAIR_PROMPT: 'PAIR_STATIC_PREFIX\n',
        geminiRequest: async (_k, _m, body, opts) => { capturedNclexBody = body; capturedNclexOpts = opts; return '[{"question":"Q1"}]'; }
      }
    );
    const nclexParsed = await nclexCallGemini('INLINE_STATIC_PREFIX\nPAGE_CHUNK_DATA');

    // CLI retry jitter (neia-retest.js & davis-transcribe-test.js)
    const cliSleeps = [];
    let auditTry = 0;
    const auditCall = createAuditCaller(
      { live: true, dryRun: false, model: 'gemini-4-hydrogen', level: 'low', rpm: 0, retryms: 1000 },
      'cli-key',
      {
        now: () => 1000,
        random: () => 0.5,
        sleep: async ms => { cliSleeps.push(ms); },
        fetch: async () => {
          auditTry++;
          if (auditTry === 1) return { ok: false, status: 503 };
          return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"verdict":"pass"}' }] } }], usageMetadata: {} }) };
        }
      }
    );
    await auditCall('prompt', { attempts: 0 });

    let davisTry = 0;
    const davisCall = createTranscriber(
      { live: true, dryRun: false, model: 'gemini-4-hydrogen', level: 'low', rpm: 0, retryms: 1000 },
      'prompt',
      'cli-key',
      {
        now: () => 1000,
        random: () => 0.25,
        readFile: () => Buffer.from([0x89, 0x50, 0x4E, 0x47]),
        sleep: async ms => { cliSleeps.push(ms); },
        fetch: async () => {
          davisTry++;
          if (davisTry === 1) return { ok: false, status: 429 };
          return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"face":"front","sections":[],"numerics":[]}' }] } }], usageMetadata: {} }) };
        }
      }
    );
    await davisCall('card.png', { attempts: 0 });

    t('v20.2 (Phase 6 — systemInstruction & static-first prefix caching + CLI jitter + API key UI): hoists static prompts to token 0, adds CLI retry jitter, and hardens #suite-api-key',
      callBody.systemInstruction.parts[0].text === 'STATIC_SYS_PROMPT' &&
      callBody.contents[0].parts[0].text === 'USER_PAYLOAD' &&
      capturedNclexBody.systemInstruction.parts[0].text === 'INLINE_STATIC_PREFIX\n' &&
      capturedNclexBody.contents[0].parts[0].text === 'PAGE_CHUNK_DATA' &&
      capturedNclexOpts.stream === true &&
      Array.isArray(nclexParsed) &&
      cliSleeps[0] === 1500 &&
      cliSleeps[1] === 1250 &&
      S.includes('systemInstruction:{parts:[{text:KB_EXTRACTION_PROMPT+focusBlock}]}') &&
      S.includes('systemInstruction:{parts:[{text:KB_VERIFY_PROMPT+focusBlock}]}') &&
      S.includes('systemInstruction:{parts:[{text:CARD_TRANSCRIBE_PROMPT}]}') &&
      S.includes('gemini([{text:I2A_TRANSCRIBE_PROMPT},{inlineData:{mimeType:payload.mimeType,data:payload.data}}],thinking)') &&
      S.includes('data-1p-ignore="true" data-lpignore="true" data-form-type="other"') &&
      S.includes('aria-label="Clear Gemini API key"') &&
      S.includes("onClick={()=>cfg.setApiKey('')}"));
  }

  // ── Phase 7: DOMPurify CSS property allowlist, href scheme allowlist, print popup sessionStorage isolation, & PDF.js isEvalSupported:false ──
  {
    const hooks = [];
    const anchors = [
      { tagName: 'A', attrs: { href: 'https://www.ncsbn.org/nclex.htm' }, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } },
      { tagName: 'A', attrs: { href: '#rationale-2' }, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } },
      { tagName: 'A', attrs: { href: 'file:///C:/Users/student/secret.txt' }, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } },
      { tagName: 'A', attrs: { href: 'obsidian://open?vault=notes' }, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } }
    ];
    const SAN = load(
      span('const STUDY_OUTPUT_POLICY=Object.freeze({', '// navigator.clipboard requires'),
      ['STUDY_OUTPUT_POLICY', 'n2aSanitizeStyle', 'ensureDomPurifyHooks', 'mdToSafeHtml'],
      {
        DOMPurify: {
          isSupported: true,
          addHook: (name, fn) => hooks.push({ name, fn }),
          sanitize: () => ({
            querySelectorAll: sel => (sel === 'a[href]' ? anchors.filter(a => 'href' in a.attrs) : [])
          })
        },
        marked: { parse: s => String(s || '') },
        document: { createElement: () => ({ innerHTML: 'ok', appendChild() {} }) }
      }
    );
    const { N2A_CARD_POLICY } = load(
      span('const N2A_CARD_POLICY=', 'function NCLEXToAnki()'),
      ['N2A_CARD_POLICY']
    );

    const cleanedCss = SAN.n2aSanitizeStyle('text-align:left; margin-top:.8em; position:fixed; top:0; z-index:99999; background:url(https://evil.example/p); opacity:.75; color:#223344');
    const hookFn = hooks.find(h => h.name === 'uponSanitizeAttribute')?.fn;
    const attrSafe = { attrName: 'style', attrValue: 'font-weight:700;position:fixed;inset:0', keepAttr: true };
    const attrUnsafe = { attrName: 'style', attrValue: 'position:fixed;z-index:9999', keepAttr: true };
    if (hookFn) { hookFn(null, attrSafe); hookFn(null, attrUnsafe); }

    t('v20.2 (Phase 7 — n2aSanitizeStyle, ensureDomPurifyHooks, & N2A_CARD_POLICY): retains safe typography styles, strips overlay/url CSS, and freezes N2A_CARD_POLICY',
      cleanedCss === 'text-align:left;margin-top:.8em;opacity:.75;color:#223344' &&
      hooks.length === 1 &&
      attrSafe.attrValue === 'font-weight:700' &&
      attrSafe.keepAttr === true &&
      attrUnsafe.keepAttr === false &&
      Object.isFrozen(N2A_CARD_POLICY) &&
      N2A_CARD_POLICY.ALLOW_DATA_ATTR === false &&
      N2A_CARD_POLICY.ALLOW_ARIA_ATTR === false);

    SAN.mdToSafeHtml('links');
    t('v20.2 (Phase 7 — mdToSafeHtml href scheme allowlist): keeps https:// and #fragment anchors while stripping file:// and custom URI schemes',
      anchors[0].attrs.href === 'https://www.ncsbn.org/nclex.htm' &&
      anchors[0].attrs.rel === 'noopener noreferrer' &&
      anchors[1].attrs.href === '#rationale-2' &&
      !('href' in anchors[2].attrs) &&
      !('href' in anchors[3].attrs));

    const { pdfSafeDocParams } = load(
      span('const MAX_PDF_BYTES=150*1024*1024;', 'function destroyPdfDoc('),
      ['pdfSafeDocParams']
    );
    const safePdfParams = pdfSafeDocParams({ data: new Uint8Array(4), isEvalSupported: true });

    let sessionCleared = 0, winPrinted = 0, clickHandler = null, iframeTimeoutMs = 0, iframeRemoved = 0, afterPrintFn = null;
    const mockWin = {
      opener: { secret: 1 },
      sessionStorage: { clear: () => { sessionCleared++; } },
      addEventListener: (ev, fn) => { if (ev === 'click') clickHandler = fn; },
      focus() {},
      print: () => { winPrinted++; },
      document: {
        readyState: 'complete',
        open() {},
        write() {},
        close() {},
        getElementById: () => ({ onclick: null })
      }
    };
    const mockFrame = {
      style: {},
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      remove: () => { iframeRemoved++; },
      contentWindow: {
        addEventListener: (ev, fn) => { if (ev === 'afterprint') afterPrintFn = fn; },
        focus() {},
        print() {}
      }
    };
    const PRINT = load(
      span('function escHtml(s){', '\n</script>\n<script type="text/babel"'),
      ['printViaIframe', 'exportAsPdf'],
      {
        mdToSafeHtml: s => '<p>' + s + '</p>',
        alert() {},
        window: { open: () => mockWin },
        document: {
          createElement: () => mockFrame,
          body: { appendChild() {} }
        },
        setTimeout: (fn, ms) => { if (ms === 180000) iframeTimeoutMs = ms; return 1; }
      }
    );
    PRINT.exportAsPdf('# Priority Study Guide', 'Cardiology', 'Unit 2');
    if (clickHandler) clickHandler({ target: { id: 'lp-print' } });
    PRINT.printViaIframe('<!DOCTYPE html><html><body>hi</body></html>');
    if (mockFrame.onload) mockFrame.onload();
    if (afterPrintFn) afterPrintFn();

    t('v20.2 (Phase 7 — exportAsPdf, printViaIframe, & pdfSafeDocParams): clears child sessionStorage, binds opener #lp-print click, holds print iframe 180s, and forces isEvalSupported:false',
      safePdfParams.isEvalSupported === false &&
      mockWin.opener === null &&
      sessionCleared === 1 &&
      winPrinted === 1 &&
      iframeTimeoutMs === 180000 &&
      iframeRemoved === 1);
  }

  // ── Phase 8: Native plain <script> split for core ES2020 utilities & lazy mounting of unvisited tabs ──
  {
    const babelTag = '<script type="text/babel" data-presets="react">';
    const babelIdx = S.indexOf(babelTag);
    const plainGemIdx = S.indexOf('async function geminiRequest(');
    const plainExportIdx = S.indexOf('function exportAsPdf(');
    const babelCount = S.split(babelTag).length - 1;
    const babelLen = S.indexOf('</script>', babelIdx) - babelIdx;

    // Simulate visitedTabs + selectTool monotonic mounting behavior from App()
    let visited = new Set(['knowledge']), active = 'knowledge';
    const selectToolSim = id => {
      if (!visited.has(id)) { const next = new Set(visited); next.add(id); visited = next; }
      active = id;
    };
    const initialMountedCount = ['knowledge', 'priority', 'anki', 'nclex', 'nclexgen', 'cases', 'nclex2anki', 'gizmo']
      .filter(id => visited.has(id) || active === id).length;
    selectToolSim('cases');
    selectToolSim('anki');

    t('v20.2 (Phase 8 — plain script split & lazy tab mounting): runs core utilities in native script before JSX and mounts only visited tabs on boot',
      babelCount === 1 &&
      plainGemIdx > 0 &&
      plainExportIdx > plainGemIdx &&
      plainExportIdx < babelIdx &&
      babelLen < S.length - 40000 &&
      initialMountedCount === 1 &&
      visited.has('knowledge') &&
      visited.has('cases') &&
      visited.has('anki') &&
      !visited.has('gizmo') &&
      S.includes('const NoopTool=()=>null;') &&
      S.includes("const [visitedTabs,setVisitedTabs]=useState(()=>new Set(['knowledge']));") &&
      S.includes('const C=(visitedTabs.has(t.id)||activeTool===t.id)?TOOL_COMPONENTS[t.id]:NoopTool;'));
  }

  // ── Phase 9: Persisted KB Points inheritance + _batchCaps routing in ngFocusPlan, bloatedExemplars audit, & Priority chunk clamp ──
  {
    const FOCUS = load(
      span("const NG_FOCUS_STOP=new Set(", '// v18.6: the run log'),
      ['ngFocusPlan']
    );
    const pool = [
      {
        condition: 'Heart Failure',
        aliases: ['HF'],
        facts: [
          { id: 'fact-1', text: 'Hold digoxin when apical pulse is below 60 beats/min.', pointAnchors: ['P1'] },
          { id: 'fact-2', text: 'Check serum digoxin toxicity signs including visual halos.', pointAnchors: ['P1'] },
          { id: 'fact-3', text: 'Monitor serum potassium closely during intravenous furosemide therapy.', pointAnchors: ['P2'] }
        ]
      },
      {
        condition: 'Atrial Fibrillation',
        aliases: ['AFib'],
        facts: [
          { id: 'fact-4', text: 'Check potassium and magnesium before antiarrhythmic dosing.', pointAnchors: ['P2'] },
          { id: 'fact-5', text: 'Assess rate control at the cardiac apex for one full minute.', pointAnchors: ['P1'] }
        ]
      }
    ];
    pool.numberedPoints = [
      { id: 'P1', text: 'Digoxin apical pulse hold threshold and toxicity cues' },
      { id: 'P2', text: 'Loop diuretic hypokalemia surveillance' }
    ];
    pool._inheritPersistedPoints = true;
    pool._batchCaps = [4, 1]; // Batch 2 has room for only 1 focus fact; overflow stays within cap

    const planned = FOCUS.ngFocusPlan(pool, { points: '', outcomes: '', batches: 2, perItem: 2, cap: 5 });

    const { buildFocusBlock } = load(
      span('  function buildFocusBlock(){', '\n\n  function buildBatchBlock(', 'function NCLEXGenerator()'),
      ['buildFocusBlock'],
      {
        outcomes: '',
        points: '',
        focusContext: '',
        K: { knowledgeBase: { numberedPoints: pool.numberedPoints } },
        formatPointsForPrompt: pts => pts.map(p => p.id + ': ' + p.text).join('\n')
      }
    );
    const builtFocus = buildFocusBlock();

    t('v20.2 (Phase 9 — ngFocusPlan persisted Points inheritance & _batchCaps overflow routing): inherits KB numberedPoints when points is blank and routes overflow across short final batches',
      planned.items.length === 2 &&
      planned.items.every(it => it.matched === true) &&
      planned.plan[1].length === 1 &&
      planned.plan[0].length >= 2 &&
      builtFocus.includes('POINTS (Specific content that must be covered):\nP1: Digoxin apical pulse hold threshold and toxicity cues\nP2: Loop diuretic hypokalemia surveillance'));

    const { auditKbConcepts } = load(
      span('function kbCanonConceptKey(', '// v19.2: Exam Trap Mapping'),
      ['auditKbConcepts']
    );
    const makeFacts = (n, tag) => Array.from({ length: n }, (_, i) => ({
      id: 'f-' + tag + '-' + i,
      latteBucket: i === 0 ? 'BriefPatho' : 'Assess',
      conceptScope: i === 1 ? 'differentiator' : 'exemplar',
      text: tag + 'alpha' + i + ' ' + tag + 'beta' + i + ' ' + tag + 'gamma' + i
    }));
    const bloatedAudit = auditKbConcepts({
      metadata: { concepts: ['Perfusion'] },
      conditions: [
        { name: 'Perfusion', entryRole: 'concept', facts: [{ id: 'c1', latteBucket: 'BriefPatho', text: 'Pump and vascular tone.' }] },
        { name: 'Cardiogenic Shock', entryRole: 'exemplar', concept: 'Perfusion', facts: makeFacts(3, 'cardio') },
        { name: 'Hypovolemic Shock', entryRole: 'exemplar', concept: 'Perfusion', facts: makeFacts(3, 'hypovol') },
        { name: 'Heart Failure', entryRole: 'exemplar', concept: 'Perfusion', facts: makeFacts(9, 'hf') }
      ]
    });
    const balancedAudit = auditKbConcepts({
      metadata: { concepts: ['Perfusion'] },
      conditions: [
        { name: 'Perfusion', entryRole: 'concept', facts: [{ id: 'c1', latteBucket: 'BriefPatho', text: 'Pump and vascular tone.' }] },
        { name: 'Cardiogenic Shock', entryRole: 'exemplar', concept: 'Perfusion', facts: makeFacts(3, 'cardio') },
        { name: 'Hypovolemic Shock', entryRole: 'exemplar', concept: 'Perfusion', facts: makeFacts(4, 'hypovol') },
        { name: 'Septic Shock', entryRole: 'exemplar', concept: 'Perfusion', facts: makeFacts(5, 'septic') }
      ]
    });

    t('v20.2 (Phase 9 — auditKbConcepts bloatedExemplars & Priority chunk clamp): flags exemplars > max(2x median, 4) facts and caps #priority-chunk-size at 60,000',
      bloatedAudit.bloatedExemplars.length === 1 &&
      bloatedAudit.bloatedExemplars[0].name === 'Heart Failure' &&
      bloatedAudit.bloatedExemplars[0].factCount === 9 &&
      bloatedAudit.bloatedExemplars[0].medianCount === 3 &&
      bloatedAudit.bloatedExemplars[0].bloatCutoff === 6 &&
      bloatedAudit.issueCount === 1 &&
      balancedAudit.bloatedExemplars.length === 0 &&
      balancedAudit.issueCount === 0 &&
      S.includes('id="priority-chunk-size" type="number" min={2000} max={60000} value={chunkSize} onChange={e=>setChunkSize(Math.min(60000,Math.max(2000,parseInt(e.target.value)||12000)))}'));
  }

  // ── Phase 10: O(1) nclexAccumulate WeakMap index, O(n) kbReconcileStored single-pass stringify, & 60s downloadBlob ──
  {
    const ACC = load(
      span('function nclexKey(q){', '// v17.4: the extractor reported'),
      ['nclexAccumulate']
    );
    const seen = new Set(), allQ = [];
    const initialBatch = Array.from({ length: 1200 }, (_, i) => ({
      question_number: i + 1,
      question: 'Client scenario #' + (i + 1) + ': which assessment finding requires immediate intervention?',
      correct_answer: i === 0 ? 'A (unmatched)' : 'B',
      answer_unmatched: i === 0 ? true : undefined
    }));
    ACC.nclexAccumulate(seen, allQ, initialBatch);
    ACC.nclexAccumulate(seen, allQ, [{
      question_number: 1,
      question: 'Client scenario #1: which assessment finding requires immediate intervention?',
      correct_answer: 'C',
      rationale: 'Stridor indicates acute upper airway obstruction.',
      diseases_conditions: ['Anaphylaxis']
    }]);

    const { kbReconcileStored } = load(
      span('function kbReconcileStored(records){', '// v17.4: hydration parsed'),
      ['kbReconcileStored'],
      { kbStoredKey: r => (r && r.meta ? r.meta.writer + ':' + r.meta.sequence : 'none') }
    );
    let toJsonCalls = 0;
    const makeCandidate = meta => ({
      kb: { conditions: [{ name: 'Sepsis' }], toJSON() { toJsonCalls++; return { conditions: [{ name: 'Sepsis' }] }; } },
      meta
    });
    const reconciled = kbReconcileStored([
      makeCandidate(null),
      makeCandidate({ writer: 'w1', sequence: 3 }),
      makeCandidate({ writer: 'w1', sequence: 3 }),
      makeCandidate(null)
    ]);

    let revokedUrl = '', revokeDelayMs = 0;
    const { downloadBlob } = load(
      span('function downloadBlob(blob,name){', 'function exportAsMd('),
      ['downloadBlob'],
      {
        document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
        URL: { createObjectURL: () => 'blob:latte-export-1', revokeObjectURL: u => { revokedUrl = u; } },
        setTimeout: (fn, ms) => { revokeDelayMs = ms; fn(); return 1; }
      }
    );
    downloadBlob({}, 'KB.json');

    t('v20.2 (Phase 10 — O(1) nclexAccumulate, O(n) kbReconcileStored, & 60s downloadBlob): indexes 1,200+ items via WeakMap, deduplicates KB snapshots in one stringify per record, and revokes blobs at 60s',
      allQ.length === 1200 &&
      allQ[0].correct_answer === 'C' &&
      allQ[0].rationale === 'Stridor indicates acute upper airway obstruction.' &&
      allQ[0].diseases_conditions[0] === 'Anaphylaxis' &&
      !('answer_unmatched' in allQ[0]) &&
      toJsonCalls === 4 &&
      Boolean(reconciled.record && reconciled.record.meta && reconciled.record.meta.sequence === 3) &&
      reconciled.choices.length === 0 &&
      revokeDelayMs === 60000 &&
      revokedUrl === 'blob:latte-export-1');
  }
};
