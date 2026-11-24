'use strict';

const vm = require('vm');
const { webcrypto } = require('crypto');

module.exports = async function runV226FsrsPrescriptionTests(S, t) {
  const babelStart = S.indexOf('<script type="text/babel"');
  if (babelStart < 0) throw new Error('v22.6 tests: missing text/babel block');
  const headSource = S.slice(0, babelStart);
  const inlineBlocks = [...headSource.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (inlineBlocks.length < 3) throw new Error('v22.6 tests: expected >= 3 plain script blocks');

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
    setTimeout: (fn, ms) => { if (!ms || ms < 5000) fn(); return 0; },
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
  g.self = g;
  g.globalThis = g;
  const ctx = vm.createContext(g);
  for (const blk of inlineBlocks) vm.runInContext(blk, ctx);

  // 1. Version agreement & FSRS-5 forgetting curve / leech math
  const fixedNow = Date.parse('2026-11-23T12:00:00Z');
  const srTenDays = { stability: 10, reps: 3, lastReviewTs: new Date(fixedNow - 10 * 86400000).toISOString(), lapses: 0, difficulty: 5.5 };
  const rAtS = ctx.nclexProFsrsRetrievability(srTenDays, fixedNow);
  const rAtZero = ctx.nclexProFsrsRetrievability({ stability: 10, reps: 1, lastReviewTs: new Date(fixedNow).toISOString() }, fixedNow);
  const rFuture = ctx.nclexProFsrsRetrievability(srTenDays, fixedNow, 15);
  const expectedVer = (S.match(/<!-- v(\d+\.\d+) \(/) || [])[1];
  t('v22.6 (FSRS-5 math & version): suiteVersion matches release header and nclexProFsrsRetrievability satisfies R(0,S)=1.0, R(S,S)=0.90, and monotonic decay',
    Boolean(expectedVer) && ctx.suiteVersion() === expectedVer &&
    Math.abs(rAtZero - 1.0) < 1e-9 &&
    Math.abs(rAtS - 0.90) < 1e-9 &&
    rFuture < rAtS && rFuture > 0.70);

  t('v22.6 (Leech detection): nclexProIsLeechSr flags 3+ lapses or 2+ high-difficulty lapses and ignores clean reviews',
    ctx.nclexProIsLeechSr({ lapses: 3, difficulty: 5.0 }) === true &&
    ctx.nclexProIsLeechSr({ lapses: 2, difficulty: 7.2 }) === true &&
    ctx.nclexProIsLeechSr({ lapses: 1, difficulty: 8.0 }) === false &&
    ctx.nclexProIsLeechSr({ lapses: 0, difficulty: 4.5 }) === false);

  // Build synthetic LATTE KB with Endocrine look-alike twins & Fluid/Electrolytes concept
  const syntheticKb = {
    metadata: { course: 'NUR 211', exam: 'Exam 3', concepts: ['Fluid and Electrolytes', 'Glucose Regulation'] },
    numberedPoints: [{ id: 'P1', text: 'Hypertonic 3% saline safety rules' }],
    conditions: [
      {
        id: 'cond-siadh',
        name: 'SIADH',
        aliases: ['Syndrome of Inappropriate Antidiuretic Hormone'],
        concept: 'Fluid and Electrolytes',
        facts: [
          { id: 'fact-101', tier: 1, latteBucket: 'Look', trapRole: 'TwinContrast', text: 'Serum sodium <135 mEq/L with high urine specific gravity >1.020' },
          { id: 'fact-102', tier: 1, latteBucket: 'Treat', trapRole: 'SafetyHold', text: 'Fluid restriction and slow 3% hypertonic saline for severe neurologic symptoms' },
        ],
      },
      {
        id: 'cond-di',
        name: 'Diabetes Insipidus',
        aliases: ['Central DI'],
        concept: 'Fluid and Electrolytes',
        facts: [
          { id: 'fact-201', tier: 1, latteBucket: 'Look', trapRole: 'TwinContrast', text: 'Polyuria 4-20 L/day with dilute urine specific gravity <1.005 and hypernatremia' },
          { id: 'fact-202', tier: 2, latteBucket: 'Treat', text: 'Administer desmopressin (DDAVP) and monitor serum sodium' },
        ],
      },
      {
        id: 'cond-dka',
        name: 'Diabetic Ketoacidosis',
        aliases: ['DKA'],
        concept: 'Glucose Regulation',
        facts: [
          { id: 'fact-301', tier: 1, latteBucket: 'Treat', trapRole: 'PriorityFirst', text: 'Verify serum potassium >= 3.5 mEq/L before initiating IV regular insulin drip' },
        ],
      },
    ],
  };
  const km = ctx.nclexProKbMeta(syntheticKb);

  // 2. Analyze compact Weak-Tag Prescription JSON against KB
  const compactRxPayload = {
    version: '1.0',
    kind: 'nclex_pro_weak_tag_prescription',
    scopeName: 'Med-Surg Exam 3',
    examDate: '2026-11-30',
    daysToExam: 7,
    weakConditions: [
      { name: 'Syndrome of Inappropriate Antidiuretic Hormone', retrievabilityPct: 68, lapses: 3, leeches: 1, weakBuckets: ['Look', 'Treat'], weakTraps: ['TwinContrast', 'SafetyHold'] },
      { name: 'Diabetes Insipidus', retrievabilityPct: 74, lapses: 2, leeches: 0, weakBuckets: ['Look'], weakTraps: ['TwinContrast'] },
    ],
    weakConcepts: [{ name: 'Fluid and Electrolytes', accuracyPct: 62, total: 16 }],
    weakBuckets: ['Look', 'Treat'],
    weakTraps: ['TwinContrast', 'SafetyHold'],
    weakFactIds: [
      { kbKey: km.kbKey, factId: 'fact-101', condition: 'SIADH', plateBucket: 'Look', retrievabilityPct: 64, lapses: 3, isLeech: true },
      { kbKey: km.kbKey, factId: 'fact-201', condition: 'Diabetes Insipidus', plateBucket: 'Look', retrievabilityPct: 76, lapses: 1, isLeech: false },
      { kbKey: 'other_kb_999', factId: 'fact-301', condition: 'Diabetic Ketoacidosis', plateBucket: 'Treat', retrievabilityPct: 50, lapses: 4, isLeech: true },
    ],
    leechFactIds: ['fact-101'],
  };

  const analyzedCompact = ctx.nclexProAnalyzeWeakTagPrescription(JSON.stringify(compactRxPayload), { kb: syntheticKb, nowMs: fixedNow });
  t('v22.6 (Compact Prescription -> KB mapping): resolves aliases to KB condition IDs, filters foreign-kbKey facts, identifies leeches, and prescribes Differential Case Mix + NGN types',
    analyzedCompact.matchedConditionIds.length === 2 &&
    analyzedCompact.matchedConditionIds[0] === 'cond-siadh' &&
    analyzedCompact.matchedConditionIds[1] === 'cond-di' &&
    analyzedCompact.matchedConcepts.includes('Fluid and Electrolytes') &&
    analyzedCompact.matchedWeakFactIds.length === 2 &&
    !analyzedCompact.matchedWeakFactIds.includes('fact-301') &&
    analyzedCompact.matchedLeechFactIds.length === 1 &&
    analyzedCompact.matchedLeechFactIds[0] === 'fact-101' &&
    analyzedCompact.suggestedCaseMixMode === 'differential' &&
    analyzedCompact.suggestedCaseTypes.bowtie === true &&
    analyzedCompact.suggestedCaseTypes.matrix === true &&
    analyzedCompact.suggestedCaseTypes.trend === true &&
    analyzedCompact.focusOutcomesText.includes('SIADH — Look/Treat'));

  // 3. Analyze raw decrypted progress:v2 + aiBank + aiFlashcards payload
  const aiItemId = 'ai_ws_test_dka_1';
  const aiNumericId = ctx.nclexProStableAiNumericId(aiItemId);
  const rawProgressV2 = {
    version: '2.1',
    sessions: [{ sid: 's1', date: '2026-11-22', mode: 'practice', answered: 10, correct: 6, pct: 60 }],
    customDecks: [{ id: 'dk1', name: 'Endocrine Final', examDate: '2026-11-28', filter: {} }],
    conditionTotals: { 'SIADH': { correct: 2, total: 6 } },
    conceptTotals: { 'Glucose Regulation': { correct: 3, total: 8 } },
    flashcardSr: {
      'fc_card_102': { reps: 1, interval: 1, stability: 0.6, difficulty: 7.4, lapses: 3, lastReviewTs: new Date(fixedNow - 4 * 86400000).toISOString() },
    },
    questionHistory: {
      [String(aiNumericId)]: {
        seen: 3,
        correct: 1,
        sr: { reps: 0, interval: 1, stability: 0.5, difficulty: 7.8, lapses: 3, lastReviewTs: new Date(fixedNow - 3 * 86400000).toISOString() },
      },
    },
  };
  const mockAiFlashcards = {
    cards: [
      { cardId: 'fc_card_102', kbKey: km.kbKey, factIds: ['fact-102'], conditionNames: ['SIADH'], conceptNames: ['Fluid and Electrolytes'], plateBucket: 'Treat', trapTags: ['SafetyHold'] },
    ],
  };
  const mockAiBank = {
    items: [
      { aiId: aiItemId, stem: 'Client in DKA has K+ 3.1 mEq/L...', kbKey: km.kbKey, factIds: ['fact-301'], conditionNames: ['Diabetic Ketoacidosis'], plateBuckets: ['Treat'], trapRoles: ['PriorityFirst'] },
    ],
  };

  const analyzedRaw = ctx.nclexProAnalyzeWeakTagPrescription(rawProgressV2, { aiBank: mockAiBank, aiFlashcards: mockAiFlashcards, kb: syntheticKb, nowMs: fixedNow });
  t('v22.6 (Raw progress:v2 -> KB mapping): joins flashcardSr, AI questionHistory (via stableAiNumericId), and published conditionTotals to surface weak conditions & leech factIds',
    analyzedRaw.scopeName === 'Endocrine Final' &&
    analyzedRaw.daysToExam === 5 &&
    analyzedRaw.matchedConditionIds.includes('cond-siadh') &&
    analyzedRaw.matchedConditionIds.includes('cond-dka') &&
    analyzedRaw.matchedLeechFactIds.includes('fact-102') &&
    analyzedRaw.matchedLeechFactIds.includes('fact-301') &&
    analyzedRaw.weakBuckets.includes('Treat') &&
    analyzedRaw.weakTraps.includes('PriorityFirst'));

  // 4. E2E Encrypted Cloud Pull (nclexProPullWeakTagPrescription) + Passphrase Redaction + Origin Allowlist
  const secretPass = 'NurseBridgeSecret#2026';
  const authSalt = webcrypto.getRandomValues(new Uint8Array(16));
  const encSalt = webcrypto.getRandomValues(new Uint8Array(16));
  const iterations = 1000; // fast test iterations via meta.iterations
  const baseKey = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(secretPass), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  const expectedTokenBits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt: authSalt, iterations, hash: 'SHA-256' }, baseKey, 256);
  const expectedToken = Buffer.from(expectedTokenBits).toString('base64');
  const aesKey = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: encSalt, iterations, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);

  const encryptJson = async obj => {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(JSON.stringify(obj)));
    const combined = new Uint8Array(12 + ct.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ct), 12);
    return Buffer.from(combined).toString('base64');
  };
  const encProg = await encryptJson(rawProgressV2);
  const encAi = await encryptJson(mockAiBank);
  const encFc = await encryptJson(mockAiFlashcards);

  let seenTokens = [];
  mockFetch = async (url, opts = {}) => {
    if (url.endsWith('/api/meta')) {
      return { ok: true, status: 200, json: async () => ({ configured: true, iterations, authSalt: Buffer.from(authSalt).toString('base64'), encSalt: Buffer.from(encSalt).toString('base64') }) };
    }
    const tok = opts.headers && opts.headers['X-Vault-Token'];
    seenTokens.push(tok);
    if (tok !== expectedToken) return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
    if (url.endsWith('/api/progress')) return { ok: true, status: 200, json: async () => ({ payload: encProg }) };
    if (url.endsWith('/api/ai-bank')) return { ok: true, status: 200, json: async () => ({ payload: encAi }) };
    if (url.endsWith('/api/ai-flashcards')) return { ok: true, status: 200, json: async () => ({ payload: encFc }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const testVaultUrl = 'https://vault.example.test';
  const pulledRx = await ctx.nclexProPullWeakTagPrescription({ url: testVaultUrl, passphrase: secretPass, kb: syntheticKb });
  t('v22.6 (Cloud pull E2E): nclexProPullWeakTagPrescription derives PBKDF2 token + AES-256-GCM key, decrypts /api/progress + /api/ai-bank + /api/ai-flashcards, and returns KB-matched prescription',
    seenTokens.length === 3 &&
    seenTokens.every(tk => tk === expectedToken) &&
    pulledRx.matchedConditionIds.includes('cond-siadh') &&
    pulledRx.matchedConditionIds.includes('cond-dka') &&
    pulledRx.matchedLeechFactIds.includes('fact-102') &&
    pulledRx.matchedLeechFactIds.includes('fact-301'));

  let blockedOriginErr = '';
  try {
    await ctx.nclexProPullWeakTagPrescription({ url: 'http://evil-collector.example.com', passphrase: secretPass, kb: syntheticKb });
  } catch (e) { blockedOriginErr = e.message; }

  ctx.nclexProClearVaultKeyCache();
  mockFetch = async () => { throw new Error('Echoed secret ' + secretPass + ' in transport failure'); };
  let scrubbedErr = '';
  try {
    await ctx.nclexProPullWeakTagPrescription({ url: testVaultUrl, passphrase: secretPass, kb: syntheticKb });
  } catch (e) { scrubbedErr = e.message; }

  t('v22.6 (Security & privacy): nclexProPullWeakTagPrescription blocks non-HTTPS origins and redacts vault passphrase from thrown errors',
    /Blocked untrusted NCLEX Pro sync origin/.test(blockedOriginErr) &&
    scrubbedErr.includes('[redacted]') &&
    !scrubbedErr.includes(secretPass));

  // 5. Applying Prescription to NCLEXGenerator & CaseStudyGenerator + Leech Re-Unlocking
  let nclexState = { condIds: [], concepts: ['OldConcept'], tiers: [1, 2, 3], outcomes: '', points: '', focusContext: '', unlocked: [] };
  const nclexRes = ctx.nclexProApplyPrescriptionToNclex(analyzedCompact, { unlockLeeches: true }, {
    setKbSelectedConditionIds: v => { nclexState.condIds = v; },
    setKbSelectedConcepts: v => { nclexState.concepts = v; },
    setKbTiers: v => { nclexState.tiers = v; },
    setOutcomes: v => { nclexState.outcomes = v; },
    setFocusContext: v => { nclexState.focusContext = v; },
    setRxUnlockedFactIds: v => { nclexState.unlocked = v; },
  });

  // Verify ledger exclusion subtracts unlocked Leech factIds while keeping non-leech used facts excluded
  let ledgerRec = ctx.genLedgerRecord(syntheticKb, 'nclex', { factIds: ['fact-101', 'fact-102', 'fact-201'], questionDelta: 3, runDelta: 1 }, storage);
  const fullEx = ctx.genLedgerExcludeSet(ledgerRec, 'nclex', { excludeOwn: true, excludeOther: false });
  for (const id of nclexState.unlocked) fullEx.delete(String(id).toLowerCase());

  t('v22.6 (Apply to NCLEXGenerator & Leech Unlock): scopes weak conditions + Tiers 1/2, sets outcomes/focusContext without clobbering persisted KB numberedPoints, and unlocks only Leech facts from exclusion',
    nclexRes.appliedConditions === 2 &&
    nclexRes.unlockedLeeches === 1 &&
    nclexState.condIds.join(',') === 'cond-siadh,cond-di' &&
    nclexState.concepts.length === 0 &&
    nclexState.tiers.join(',') === '1,2' &&
    nclexState.points === '' &&
    nclexState.outcomes.includes('SIADH') &&
    !fullEx.has('fact-101') &&
    fullEx.has('fact-102') &&
    fullEx.has('fact-201'));

  let caseState = { condId: 'cond-dka', extraIds: [], concepts: [], runMode: 'batch', mixMode: 'comorbid', tier2: false, types: { mcq: true, sata: false, bowtie: false, matrix: false, trend: false, cloze: false }, unlocked: [] };
  const caseRes = ctx.nclexProApplyPrescriptionToCases(analyzedCompact, { unlockLeeches: false }, {
    setConditionId: v => { caseState.condId = v; },
    setCaseExtraConditionIds: v => { caseState.extraIds = v; },
    setCaseSelectedConcepts: v => { caseState.concepts = v; },
    setCaseRunMode: v => { caseState.runMode = v; },
    setCaseMixMode: v => { caseState.mixMode = v; },
    setIncludeTier2: v => { caseState.tier2 = v; },
    setTypes: fn => { caseState.types = fn(caseState.types); },
    setRxUnlockedCaseIds: v => { caseState.unlocked = v; },
  });

  t('v22.6 (Apply to CaseStudyGenerator): scopes multi-condition mixed case in Differential framing, enables prescribed NGN types, and respects unlockLeeches=false',
    caseRes.appliedConditions === 2 &&
    caseRes.unlockedLeeches === 0 &&
    caseState.extraIds.join(',') === 'cond-siadh,cond-di' &&
    caseState.runMode === 'mixed' &&
    caseState.mixMode === 'differential' &&
    caseState.tier2 === true &&
    caseState.types.bowtie === true &&
    caseState.types.matrix === true &&
    caseState.types.trend === true &&
    caseState.types.sata === true &&
    caseState.unlocked.length === 0);

  // 6. Plain-script component render smoke & JSX wiring check
  const bridgeTree = ctx.NclexProWeakTagBridge({ idPrefix: 'nclex', mode: 'nclex', kb: syntheticKb, passphrase: '', unlockedCount: 2, setters: {} });
  const diagTree = ctx.AnkiNoteDiagnostics({ card: { factIds: ['fact-101'], sourceLinksNeedReview: true }, audit: { status: 'Supported', checked: 1, hintChecked: 0, findings: [] }, current: true });
  const serializedBridge = JSON.stringify(bridgeTree);
  const serializedDiag = JSON.stringify(diagTree);

  t('v22.6 (UI component smoke & generator wiring): NclexProWeakTagBridge and hoisted AnkiNoteDiagnostics render cleanly, and both generators wire Step 01 prescription bridges',
    serializedBridge.includes('Prescribe from NCLEX Pro FSRS') &&
    serializedBridge.includes('2 leech fact(s) unlocked') &&
    serializedDiag.includes('revealed numeric token') &&
    !serializedDiag.includes('revealed numeric tokens') &&
    serializedDiag.includes('Text or Extra changed; review and confirm the source links.') &&
    S.includes('<NclexProWeakTagBridge idPrefix="nclex" mode="nclex"') &&
    S.includes('<NclexProWeakTagBridge idPrefix="case" mode="cases"'));

  // 7. 4-Pillar Trap Audit object formatting (no "[object Object]") + custom Deck Name override in Anki -> NCLEX Pro sync
  const trapKb = {
    metadata: { course: 'NUR 211', exam: 'Exam 3' },
    conditions: [{
      id: 'cond-siadh',
      name: 'SIADH',
      contrastPartners: ['Diabetes Insipidus'],
      facts: [
        { id: 'fact-101', tier: 1, latteBucket: 'Look', trapRole: 'twin-cue', contrastWith: 'Diabetes Insipidus', text: 'Serum sodium <135 mEq/L with high urine specific gravity >1.020' },
        { id: 'fact-102', tier: 1, latteBucket: 'Treat', trapRole: 'hold-triangle', text: 'Hold free water and restrict fluids; slow 3% hypertonic saline for severe neurologic symptoms' },
      ],
    }],
  };
  const trapSnap = ctx.ankiSourceSnapshot(trapKb);
  const trapBatch = { sourceKB: trapKb, snapshot: trapSnap };
  const sampleAnkiNotes = [{
    id: 'n-siadh-1',
    text: '[SIADH] Hold fluid intake and monitor for {{c1::hyponatremia (<135 mEq/L)}}.',
    extra: 'High urine specific gravity >1.020.',
    tags: 'Condition::SIADH Nursing::PLATE::Look Tier::1',
    factIds: ['fact-101', 'fact-102'],
  }];
  const liveAuditObj = ctx.ankiCardTrapAudit(sampleAnkiNotes[0], trapBatch, true);
  const convertedCustom = ctx.nclexProConvertAnkiDeck(sampleAnkiNotes, trapBatch, trapKb, {
    deckName: 'NUR 211 · Exam 3 — Endocrine Twins',
    getTrapAudit: c => ctx.ankiCardTrapAudit(c, trapBatch, true),
    getSourceRef: () => 'slides.pdf p. 4',
  });
  const syncBtnsTree = ctx.AnkiNclexProSyncButtons({
    kept: sampleAnkiNotes, keptCount: 1, batch: trapBatch, kb: trapKb,
    includeTrapAudit: true, current: true, passphrase: '', syncState: { busy: false, msg: '', err: '' }, setSyncState: noop,
  });
  const serializedSyncBtns = JSON.stringify(syncBtnsTree);
  t('v22.6 (Anki -> NCLEX Pro 4-Pillar Trap Audit & Custom Deck Name): formats {condition, lines} trapAudit object without "[object Object]" and exposes #anki-nclex-pro-deck-name override',
    Boolean(liveAuditObj && typeof liveAuditObj === 'object' && Array.isArray(liveAuditObj.lines) && liveAuditObj.lines.length > 0) &&
    convertedCustom.deck.name === 'NUR 211 · Exam 3 — Endocrine Twins' &&
    convertedCustom.deck.cardCount === convertedCustom.cards.length &&
    convertedCustom.deck.count === convertedCustom.cards.length &&
    Boolean(convertedCustom.deck.updatedAt) &&
    convertedCustom.cards[0].deckName === 'NUR 211 · Exam 3 — Endocrine Twins' &&
    !convertedCustom.cards[0].trapAudit.includes('[object Object]') &&
    convertedCustom.cards[0].trapAudit.includes('[SIADH]') &&
    convertedCustom.cards[0].trapAudit.includes('[3] Hold / Never:') &&
    ctx.nclexProFormatTrapAudit('[object Object]') === '' &&
    serializedSyncBtns.includes('anki-nclex-pro-deck-name') &&
    serializedSyncBtns.includes('NUR 211 · Exam 3'));

  // 8. F2 (Foreign-KB leech isolation): block bare and scoped leech factIds belonging to a different KB
  const foreignBleedRx = {
    version: '1.0',
    kind: 'nclex_pro_weak_tag_prescription',
    scopeName: 'Mixed KBs',
    weakConditions: [],
    weakConcepts: [],
    weakBuckets: ['Treat'],
    weakTraps: [],
    weakFactIds: [
      { kbKey: 'other_kb_999', factId: 'fact-301', isLeech: true },
      { kbKey: km.kbKey, factId: 'fact-101', isLeech: true },
    ],
    leechFactIds: [
      'fact-301', // legacy bare leech from foreign KB must be blocked!
      { kbKey: 'other_kb_999', factId: 'fact-201' }, // scoped foreign object must be blocked!
      km.kbKey + '|fact-102', // pipe-scoped active KB leech must match!
      { kbKey: km.kbKey, factId: 'fact-101' }, // object-scoped active KB leech must match!
    ],
  };
  const analyzedForeign = ctx.nclexProAnalyzeWeakTagPrescription(foreignBleedRx, { kb: syntheticKb, nowMs: fixedNow });
  t('v22.6 (F2 Foreign-KB Leech Isolation): blocks bare and scoped foreign-kbKey leech IDs while matching active-KB object and pipe-scoped leeches',
    !analyzedForeign.matchedLeechFactIds.includes('fact-301') &&
    !analyzedForeign.matchedLeechFactIds.includes('fact-201') &&
    analyzedForeign.matchedLeechFactIds.includes('fact-101') &&
    analyzedForeign.matchedLeechFactIds.includes('fact-102'));

  // 9. F7 (Case Study FSRS focus wiring & multi-condition primary conditionId sync)
  let caseFocusState = { condId: 'cond-dka', extraIds: [], focusOut: '', focusCtx: '' };
  ctx.nclexProApplyPrescriptionToCases(analyzedCompact, { unlockLeeches: true }, {
    setConditionId: v => { caseFocusState.condId = v; },
    setCaseExtraConditionIds: v => { caseFocusState.extraIds = v; },
    setCaseFocusOutcomes: v => { caseFocusState.focusOut = v; },
    setCaseFocusContext: v => { caseFocusState.focusCtx = v; },
  });
  const baseCaseArgs = {
    conditionName: 'SIADH',
    facts: [{ id: 'fact-101', latteBucket: 'Look', tier: 1, text: 'Serum sodium <135 mEq/L', sources: [{ filename: 'a.pdf', location: 'p. 1' }] }],
    difficulty: 'exam', stages: 2, questionsPerStage: 2, includeTypes: { mcq: true, sata: true },
  };
  const promptNoFocus = ctx.caseBuildPrompt(baseCaseArgs);
  const promptWithFocus = ctx.caseBuildPrompt({ ...baseCaseArgs, focusOutcomes: caseFocusState.focusOut, focusContext: caseFocusState.focusCtx });
  const splitNoFocus = ctx.caseSplitSystemPrompt(promptNoFocus);
  const splitWithFocus = ctx.caseSplitSystemPrompt(promptWithFocus);
  t('v22.6 (F7 Case FSRS focus & primary conditionId): multi-condition prescription syncs conditionId[0] and forwards focusOutcomes/focusContext into caseBuildPrompt without perturbing systemInstruction',
    caseFocusState.condId === 'cond-siadh' &&
    caseFocusState.focusOut.includes('SIADH') &&
    caseFocusState.focusCtx.includes('FSRS Remediation') &&
    !promptNoFocus.includes('FSRS REMEDIATION FOCUS') &&
    promptWithFocus.includes('FSRS REMEDIATION FOCUS') &&
    promptWithFocus.includes('SIADH — Look/Treat') &&
    splitNoFocus.systemInstruction === splitWithFocus.systemInstruction);

  // 10. F9 + F12 + F22 (geminiRequest storeFallback + dropped stream throws Incomplete; cachedContentTokenCount summed across continuation hops; stream:true on repair & n2a)
  ctx.geminiRequest._storeUnsupported = false;
  let grCall = 0;
  mockFetch = async () => {
    grCall++;
    if (grCall === 1) {
      return { ok: false, status: 400, headers: { get: () => 'application/json' }, json: async () => ({ error: { message: 'Unknown name "store": Cannot find field.' } }) };
    }
    // Attempt 2 succeeds HTTP 200 but drops stream with no finishReason
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ candidates: [{ content: { parts: [{ text: 'partial' }] } }] }) };
  };
  let droppedErr = null;
  try {
    await ctx.geminiRequest('synthetic-key', 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } }, { retries: 0 });
  } catch (e) { droppedErr = e; }

  // Continuation hop cachedContentTokenCount summation
  let contCall = 0, lastMeta = null;
  mockFetch = async () => {
    contCall++;
    if (contCall === 1) {
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Part 1 ' }] }, finishReason: 'CONTINUATION', continuationToken: 'tok1' }], usageMetadata: { promptTokenCount: 1000, cachedContentTokenCount: 800, candidatesTokenCount: 50, totalTokenCount: 1050 } }) };
    }
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Part 2' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1000, cachedContentTokenCount: 850, candidatesTokenCount: 60, totalTokenCount: 1060 } }) };
  };
  const contText = await ctx.geminiRequest('synthetic-key', 'gemini-4-hydrogen', { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } }, { retries: 0, onMeta: m => { lastMeta = m; } });
  t('v22.6 (F9 & F12/F22 Gemini transport): dropped stream after store:false fallback throws Incomplete (never undefined), cachedContentTokenCount sums across continuation hops, and repair/i2a enable stream:true',
    droppedErr && /Incomplete response/i.test(droppedErr.message) && droppedErr.incomplete === true &&
    contText === 'Part 1 Part 2' &&
    lastMeta && lastMeta.usage && lastMeta.usage.cachedContentTokenCount === 1650 &&
    S.includes('systemInstruction:staticSysPrompt') &&
    S.includes('retries:1,stream:true') &&
    S.includes('retries:4,stream:true'));

  // 11. F13 + F14 (pdf-toc-slice fallbackScanObjects XRef cap & cyclic outline MAX_OUTLINE_NODES cap + 25 MB WeakTagBridge guard)
  const pdfSlicerSrc = require('fs').readFileSync(require('path').join(__dirname, 'pdf-toc-slice.js'), 'utf8');
  const pdfSlicer = require('./pdf-toc-slice');
  // Build a cyclic PDF outline fixture (outline node 4 points Next->5, 5 points First->4!) and ensure inspectPdfTocBuffer terminates cleanly
  const cyclicPdf = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Outlines 3 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [6 0 R] /Count 1 >>\nendobj\n' +
    '3 0 obj\n<< /Type /Outlines /First 4 0 R /Last 5 0 R >>\nendobj\n' +
    '4 0 obj\n<< /Title (Chapter 1) /Next 5 0 R /First 5 0 R >>\nendobj\n' +
    '5 0 obj\n<< /Title (Cycle Back) /First 4 0 R /Next 4 0 R >>\nendobj\n' +
    '6 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n' +
    '%%EOF\n',
    'latin1'
  );
  const cycToc = pdfSlicer.inspectPdfTocBuffer(cyclicPdf, 'cyclic.pdf');
  t('v22.6 (F13 & F14 DoS bounds): pdf-toc-slice enforces MAX_XREF_ENTRIES in fallbackScanObjects and terminates cyclic parent-child outlines via MAX_OUTLINE_NODES; WeakTagBridge enforces 25 MB JSON cap',
    pdfSlicerSrc.includes('const MAX_OUTLINE_NODES = 25000;') &&
    pdfSlicerSrc.includes('!this.xref.has(objNum) && this.xref.size >= MAX_XREF_ENTRIES') &&
    cycToc && Array.isArray(cycToc.flat) && cycToc.flat.length <= 2 &&
    S.includes('NCLEX_PRO_MAX_IMPORT_BYTES=25*1024*1024'));
};
