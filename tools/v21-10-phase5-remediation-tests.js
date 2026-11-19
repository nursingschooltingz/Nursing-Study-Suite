'use strict';

// v21.10 Phase 5 production code-review remediation regression suite (M1, M5, M6, M17, M18).
// Exercises live extracted code from Nursing-Study-Suite v21.10.html, browser fixtures,
// and offline measurement CLIs directly — zero mocked clones and zero live API calls.

const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = async function runPhase5RemediationTests(S, t) {
  const rootDir = path.resolve(__dirname, '..');
  const span = (a, b) => {
    const x = S.indexOf(a);
    if (x < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous Phase 5 start anchor: ' + a);
    const y = S.indexOf(b, x + a.length);
    if (y < 0) throw new Error('Missing Phase 5 end anchor: ' + b + ' after ' + a);
    return S.slice(x, y);
  };

  // 1. Live extraction & M1 Babel budget ceiling (< 390 KB)
  const babelOpen = '<script type="text/babel" data-presets="react">';
  const babelIdx = S.indexOf(babelOpen);
  const babelEnd = babelIdx >= 0 ? S.indexOf('</script>', babelIdx + babelOpen.length) : -1;
  if (babelIdx < 0 || babelEnd < 0) throw new Error('Phase 5: missing Babel script block');
  const babelBytes = Buffer.byteLength(S.slice(babelIdx + babelOpen.length, babelEnd), 'utf8');

  const geminiCode =
    span('const MODEL_SETTINGS_KEY=', 'const ConfigCtx=createContext();') + '\n' +
    span('const SAFETY_SETTINGS=[', '// PDF text extraction (shared)') + '\n' +
    span('const CARD_TRANSCRIBE_JSON_SCHEMA=', 'function cardMergeFaces(');
  const paCode = span('function paBuildExtractPrompt(', 'function paParseTiers(');
  const i2aSchemaCode = span('const I2A_TRANSCRIBE_JSON_SCHEMA=', 'const I2A_ANSWER_JSON_SCHEMA=');
  const kbSchemaCode = span('const _KB_FACT_SCHEMA_PROPS=', 'async function kbBuildWithEnv(');
  const ankiRunnerCode = span('// ── BEGIN ANKI RUNNERS ──', '// ── END ANKI RUNNERS ──');
  const nclexRunnerCode = span('const _NCLEX_Q_PROPS=', 'async function nclexRunInlineWithEnv(');
  const caseSchemaCode = span('const CASE_STUDY_JSON_SCHEMA=', 'async function caseRunSingleWithEnv(');
  const caseEngineCode =
    span('function kbSourceText(', 'function kbProvenanceText(') + '\n' +
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') + '\n' +
    span('const NCLEX_DISTRACTOR_RULES=', '/* ── END CASE STUDY PURE HELPERS ── */');

  const G = new Function(
    'fetch', 'window', 'document', 'getExt', 'CARD_MIME', 'cardFilePayload', 'CARD_TRANSCRIBE_PROMPT',
    geminiCode + '\nreturn {geminiRequest,callGemini,CARD_TRANSCRIBE_JSON_SCHEMA,cardTranscribe,redactApiSecrets};'
  );
  const PA = new Function(paCode + '\nreturn {paBuildExtractPrompt,paBuildSynthPrompt,paSplitPrompt};')();
  const SCHEMAS = new Function(
    i2aSchemaCode + '\n' + kbSchemaCode + '\n' + caseSchemaCode + '\n' +
    span('const _ANKI_REF_SCHEMA=', 'function ankiSplitSourceAuditPrompt(') + '\n' +
    span('const _NCLEX_Q_PROPS=', 'async function nclexCallGeminiWithEnv(') + '\n' +
    span('const NG_REPAIR_JSON_SCHEMA=', 'function ngBuildRepairPrompt(') + '\n' +
    'return {I2A_TRANSCRIBE_JSON_SCHEMA,KB_EXTRACTION_JSON_SCHEMA,KB_VERIFY_JSON_SCHEMA,CASE_STUDY_JSON_SCHEMA,ANKI_SOURCE_AUDIT_V4_JSON_SCHEMA,NCLEX_INLINE_JSON_SCHEMA,NCLEX_SPLIT_JSON_SCHEMA,NCLEX_AI_PAIR_JSON_SCHEMA,NG_REPAIR_JSON_SCHEMA};'
  )();
  const CE = new Function(
    caseEngineCode + '\nreturn {CASE_QUESTION_RULES,PRIORITY_ORDER_RULES,CASE_SLOPE_SYNC_RULES,CASE_NGN_TYPE_RULES,caseBuildPrompt,caseSplitSystemPrompt,caseAuditPayload,itemBuildAuditPrompt,itemSplitAuditPrompt,itemHeuristics};'
  )();

  const hoistedBeforeBabel = [
    'async function kbBuildWithEnv(',
    'async function ankiRunSourceAuditWithEnv(',
    'async function ankiRunWithEnv(',
    'async function nclexCallGeminiWithEnv(',
    'async function caseRunSingleWithEnv(',
    'async function n2aRunImagesWithEnv('
  ].every(sig => {
    const pos = S.indexOf(sig);
    return pos > 0 && pos < babelIdx;
  });

  t('v21.10 Phase 5 (Extraction tail & M1 Babel budget): <script type="text/babel"> stays <390 KB, hoisted runners precede Babel, and live engines compile cleanly',
    babelBytes < 390000 &&
    hoistedBeforeBabel &&
    typeof PA.paSplitPrompt === 'function' &&
    typeof CE.caseSplitSystemPrompt === 'function' &&
    typeof CE.itemSplitAuditPrompt === 'function' &&
    typeof CE.itemHeuristics === 'function' &&
    typeof SCHEMAS.CASE_STUDY_JSON_SCHEMA === 'object' &&
    ankiRunnerCode.includes('async function ankiRunWithEnv(') &&
    nclexRunnerCode.includes('async function nclexCallGeminiWithEnv('));

  // 2. M1 & M18 — Browser fixtures inject pure-JS shims before Babel and expose v21.10 parity
  {
    const ankiFixture = require('./anki-browser-fixture');
    const remFixture = require('./remediation-browser-fixture');
    const ankiHtml = ankiFixture.page();
    const remHtml = remFixture.page();
    const ankiBabelStart = ankiHtml.indexOf(babelOpen);
    const ankiBabelEnd = ankiHtml.indexOf('</script>', ankiBabelStart + babelOpen.length);
    const remBabelStart = remHtml.indexOf(babelOpen);
    const remBabelEnd = remHtml.indexOf('</script>', remBabelStart + babelOpen.length);
    const ankiBabelBytes = Buffer.byteLength(ankiHtml.slice(ankiBabelStart + babelOpen.length, ankiBabelEnd), 'utf8');
    const remBabelBytes = Buffer.byteLength(remHtml.slice(remBabelStart + babelOpen.length, remBabelEnd), 'utf8');
    const ankiFixtureSrc = fs.readFileSync(path.join(__dirname, 'anki-browser-fixture.js'), 'utf8');
    const remFixtureSrc = fs.readFileSync(path.join(__dirname, 'remediation-browser-fixture.js'), 'utf8');

    t('v21.10 Phase 5 (M1 & M18 — Browser fixture Babel split & v21.10 parity): pure-JS shims precede Babel (<395 KB), Anki fixture exposes v21.10 cfg/K fields & hardened HTTP guards, and Remediation fixture wraps geminiRequest',
      ankiHtml.indexOf('function ankiSyntheticFixture()') < ankiBabelStart &&
      remHtml.indexOf('remediationMockGemini') < remBabelStart &&
      ankiBabelBytes < 395000 &&
      remBabelBytes < 395000 &&
      ankiFixtureSrc.includes("hydrogenModel:'synthetic-hydrogen'") &&
      ankiFixtureSrc.includes("neonModel:'synthetic-neon'") &&
      ankiFixtureSrc.includes('isCurrentSource:s=>s===kb') &&
      ankiFixtureSrc.includes('publishAnkiDeck') &&
      ankiFixtureSrc.includes("req.method!=='GET'") &&
      ankiFixtureSrc.includes("'X-Content-Type-Options':'nosniff'") &&
      ankiFixtureSrc.includes('port>65535') &&
      remFixtureSrc.includes('callGemini=async(') &&
      remFixtureSrc.includes('geminiRequest=async('));
  }

  // 3. M6 — geminiRequest CONTINUATION auto-resume & terminal truncation
  {
    const hopBodies = [];
    let hopCall = 0;
    const mockFetchResume = async (_url, init) => {
      hopBodies.push(JSON.parse(init.body));
      hopCall++;
      if (hopCall === 1) {
        return {
          ok: true, status: 200,
          json: async () => ({
            candidates: [{ finishReason: 'CONTINUATION', continuationToken: 'tok-hop-2', content: { parts: [{ text: '{"part":1,' }] } }],
            usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 10 }
          })
        };
      }
      return {
        ok: true, status: 200,
        json: async () => ({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '"part2":2}' }] } }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40, thoughtsTokenCount: 5 }
        })
      };
    };
    const envResume = G(mockFetchResume, {}, {}, () => 'png', { png: 'image/png' }, null, 'CARD_PROMPT');
    let resumeMeta = null;
    const resumed = await envResume.geminiRequest(
      'AIzaSyTestKey1234567890', 'gemini-4-hydrogen',
      { contents: [{ parts: [{ text: 'hello' }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'low' } } },
      { retries: 0, onMeta: m => { resumeMeta = m; } }
    );

    // Tokenless CONTINUATION in JSON mode -> fatal truncated error with partialText
    const envJsonTrunc = G(async () => ({
      ok: true, status: 200,
      json: async () => ({
        candidates: [{ finishReason: 'CONTINUATION', content: { parts: [{ text: '{"partial":' }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 }
      })
    }), {}, {}, () => 'png', { png: 'image/png' }, null, 'CARD_PROMPT');
    let jsonTruncErr = null;
    try {
      await envJsonTrunc.geminiRequest(
        'AIzaSyTestKey1234567890', 'gemini-4-hydrogen',
        { contents: [{ parts: [{ text: 'hello' }] }], generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } } },
        { retries: 0 }
      );
    } catch (e) { jsonTruncErr = e; }

    // Exhausted CONTINUATION (4 fetches = initial + 3 hops) in plain-text mode -> partial text + truncated:true
    let exhaustCalls = 0;
    const envExhaust = G(async () => {
      exhaustCalls++;
      return {
        ok: true, status: 200,
        json: async () => ({
          candidates: [{ finishReason: 'CONTINUATION', continuationToken: 'tok-' + exhaustCalls, content: { parts: [{ text: 'seg' + exhaustCalls + ';' }] } }],
          usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10 }
        })
      };
    }, {}, {}, () => 'png', { png: 'image/png' }, null, 'CARD_PROMPT');
    let exhaustMeta = null;
    const exhaustOut = await envExhaust.geminiRequest(
      'AIzaSyTestKey1234567890', 'gemini-4-hydrogen',
      { contents: [{ parts: [{ text: 'hello' }] }], generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } },
      { retries: 0, onMeta: m => { exhaustMeta = m; } }
    );

    t('v21.10 Phase 5 (M6 — geminiRequest CONTINUATION auto-resume & truncation): resumes via continuationToken without cumulative maxOutputTokens, merges usage, and handles tokenless/exhausted CONTINUATION',
      resumed === '{"part":1,"part2":2}' &&
      hopBodies.length === 2 &&
      hopBodies[0].generationConfig.maxOutputTokens === 1024 &&
      hopBodies[1].continuationToken === 'tok-hop-2' &&
      !('maxOutputTokens' in hopBodies[1].generationConfig) &&
      resumeMeta && resumeMeta.continuationHops === 1 && resumeMeta.truncated === false &&
      resumeMeta.usage && resumeMeta.usage.candidatesTokenCount === 90 && resumeMeta.usage.thoughtsTokenCount === 15 &&
      jsonTruncErr && jsonTruncErr.truncated === true && jsonTruncErr.partialText === '{"partial":' &&
      exhaustCalls === 4 && exhaustOut === 'seg1;seg2;seg3;seg4;' &&
      exhaustMeta && exhaustMeta.truncated === true && exhaustMeta.continuationHops === 3);
  }

  // 4. M5 — Lossless systemInstruction prefix-cache splitters (Case, Item Audit, Anki Audit, Priority)
  {
    const sampleFacts = [
      { id: 'fact-1', text: 'Potassium 3.5-5.0 mEq/L.', latteBucket: 'Assess', tier: 1, safetyCritical: true, sources: [{ filename: 'lec.pdf', location: 'p.1' }] }
    ];
    const classicFull = CE.caseBuildPrompt({
      conditionName: 'Heart Failure', facts: sampleFacts, difficulty: 'exam', stages: 2, questionsPerStage: 2,
      includeTypes: { mcq: true, sata: true, prioritization: true }
    });
    const classicSplit = CE.caseSplitSystemPrompt(classicFull);
    const ngnFull = CE.caseBuildPrompt({
      conditionName: 'Heart Failure', facts: sampleFacts, difficulty: 'exam', stages: 2, questionsPerStage: 2,
      includeTypes: { mcq: true, bowtie: true, matrix: true, cloze: true, trend: true }
    });
    const ngnSplit = CE.caseSplitSystemPrompt(ngnFull);

    const auditFull = CE.itemBuildAuditPrompt('CASE: Heart Failure\nSTEM: Which action first?\nA. Notify provider\nKEYED ANSWER: A');
    const auditSplit = CE.itemSplitAuditPrompt(auditFull);

    const ankiSplitFn = new Function(span('function ankiSplitSourceAuditPrompt(', 'async function ankiRunSourceAuditWithEnv(') + '\nreturn ankiSplitSourceAuditPrompt;')();
    const ankiAuditFull = 'STATIC SOURCE AUDIT RULES\nLine 2\n\nAUDIT PACKET:\n{"groupId":"g1"}';
    const ankiAuditSplit = ankiSplitFn(ankiAuditFull);

    const paExtFull = PA.paBuildExtractPrompt('Lecture content chunk', 0, 2, '');
    const paExtSplit = PA.paSplitPrompt(paExtFull);
    const paSynFull = PA.paBuildSynthPrompt(['Harvest chunk 1'], 'Exam 1');
    const paSynSplit = PA.paSplitPrompt(paSynFull);

    t('v21.10 Phase 5 (M5 — Lossless systemInstruction prefix-cache splitters): Case (>8.2 KB static rules + NGN), Item Audit, Anki Audit, and Priority Harvest/Synthesis split losslessly',
      classicSplit.systemInstruction + '\n\n' + classicSplit.userPrompt === classicFull &&
      classicSplit.systemInstruction.length > 8200 &&
      classicSplit.systemInstruction.includes(CE.CASE_QUESTION_RULES) &&
      classicSplit.systemInstruction.includes(CE.PRIORITY_ORDER_RULES) &&
      classicSplit.systemInstruction.includes(CE.CASE_SLOPE_SYNC_RULES) &&
      !classicSplit.systemInstruction.includes('═══ STAGE DEPENDENCY ═══') &&
      classicSplit.userPrompt.includes('═══ STAGE DEPENDENCY ═══') &&
      ngnSplit.systemInstruction + '\n\n' + ngnSplit.userPrompt === ngnFull &&
      ngnSplit.systemInstruction.includes(CE.CASE_NGN_TYPE_RULES) &&
      ngnSplit.systemInstruction.length > classicSplit.systemInstruction.length &&
      auditSplit.systemInstruction + '\n\n' + auditSplit.userPrompt === auditFull &&
      auditSplit.systemInstruction.includes('═══ STOP CRITERIA ═══') &&
      auditSplit.userPrompt.includes('THE CASE, AS THE STUDENT SEES IT') &&
      ankiAuditSplit.systemInstruction + '\n\n' + ankiAuditSplit.userPrompt === ankiAuditFull &&
      ankiAuditSplit.systemInstruction === 'STATIC SOURCE AUDIT RULES\nLine 2' &&
      ankiAuditSplit.userPrompt.startsWith('AUDIT PACKET:\n') &&
      paExtSplit.systemInstruction + '\n\n' + paExtSplit.userPrompt === paExtFull &&
      paExtSplit.userPrompt.startsWith('## Content\n') &&
      paSynSplit.systemInstruction + '\n\n' + paSynSplit.userPrompt === paSynFull &&
      paSynSplit.userPrompt.startsWith('## Harvested Inventory\n'));
  }

  // 5. M5 & M6 — Live runner wire contracts (cardTranscribe, nclexCallGeminiWithEnv, ankiRunSourceAuditWithEnv, ankiRunWithEnv, kb/case/ng/priority)
  {
    // 5a. cardTranscribe -> systemInstruction + CARD_TRANSCRIBE_JSON_SCHEMA + stream:true
    const cardFetches = [];
    const envCard = G(
      async (url, init) => {
        cardFetches.push({ url, body: JSON.parse(init.body) });
        return {
          ok: true, status: 200,
          json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"face":"front","category":null,"cardNumber":null,"sections":[],"numerics":[],"overallLegibility":"clean"}' }] } }], usageMetadata: {} })
        };
      },
      {}, {}, () => 'png', { png: 'image/png' },
      async () => ({ mimeType: 'image/png', data: 'AAAA', bytes: 3, resized: false }),
      'STATIC_CARD_PROMPT'
    );
    await envCard.cardTranscribe('AIzaSyTestKey1234567890', 'gemini-4-hydrogen', 'low', { name: 'card.png' }, {});

    // 5b. nclexCallGeminiWithEnv -> routes inline / split / ai-pair schemas + systemInstruction + stream:true
    const nclexCalls = [];
    const NCLEX_RUN = new Function(
      'NCLEX_INLINE_PROMPT', 'NCLEX_SPLIT_PROMPT', 'NCLEX_AI_PAIR_PROMPT', 'geminiRequest', 'extractJSON',
      nclexRunnerCode + '\nreturn {nclexCallGeminiWithEnv,NCLEX_INLINE_JSON_SCHEMA,NCLEX_SPLIT_JSON_SCHEMA,NCLEX_AI_PAIR_JSON_SCHEMA};'
    )('INLINE_HDR\n', 'SPLIT_HDR\n', 'PAIR_HDR\n', async (_k, _m, body, opts) => {
      nclexCalls.push({ body, opts });
      return '[{"question":"Q1","correct_answer":"A","rationale":"R1"}]';
    }, s => JSON.parse(s));
    const nclexEnv = { toolLevel: 'low', cfg: { apiKey: 'k' }, model: 'gemini-4-hydrogen' };
    await NCLEX_RUN.nclexCallGeminiWithEnv(nclexEnv, 'INLINE_HDR\nChunk 1');
    await NCLEX_RUN.nclexCallGeminiWithEnv(nclexEnv, 'SPLIT_HDR\nChunk 2');
    await NCLEX_RUN.nclexCallGeminiWithEnv(nclexEnv, 'PAIR_HDR\nChunk 3');

    // 5c. ankiRunSourceAuditWithEnv -> protocol 4 sends systemInstruction + ANKI_SOURCE_AUDIT_V4_JSON_SCHEMA + stream:true
    const ankiAuditCalls = [];
    const ANKI_RUN = new Function(
      'ankiSourceAuditCurrent', 'ankiSourceAuditPending', 'ankiSourceAuditState', 'redactApiSecrets',
      'callGemini', 'ankiParseSourceAuditV4', 'ankiParseSourceAudit', 'ankiMergeSourceAuditResult',
      'ANKI_MASTER_PROMPT', 'buildFactIndex', 'ankiScopeKB', 'kbFormatCompact', 'ankiParseCards',
      'ankiAttachProvenance', 'ankiSourceSnapshot', 'ankiAssignIds', 'ankiLedgerFromNotes', 'ankiValidateDeck',
      'ankiCanonicalizeDeck', 'ankiAuditGroups', 'ankiPrepareSourceAudit', 'isQuotaError',
      ankiRunnerCode + '\nreturn {ankiRunSourceAuditWithEnv,ankiRunWithEnv,ANKI_SOURCE_AUDIT_V4_JSON_SCHEMA};'
    )(
      () => true,
      sa => (sa.results || []).some(r => r.groupId === 'g1') ? [] : [{ id: 'g1', protocolVersion: 4, factIds: ['fact-1'], noteIds: ['n1'] }],
      (run, status, message) => ({ ...run, status, message }),
      s => String(s),
      async (_k, _m, parts, opts) => {
        ankiAuditCalls.push({ parts, opts });
        return '{"factReviews":[],"noteReviews":[],"findings":[]}';
      },
      () => ({ factReviews: [], noteReviews: [], findings: [], complete: true }),
      () => ({ factReviews: [], noteReviews: [], findings: [], complete: true }),
      (_prior, parsed) => parsed,
      'STATIC_ANKI_MASTER_PROMPT',
      () => new Map(),
      kb => kb,
      () => 'COMPACT_KB_BODY',
      () => ({ cards: [{ text: 'Q {{c1::A}}', extra: '', tags: ['Nursing::LATTE::Look', 'Tier::1'] }], rawText: '' }),
      (cards) => ({ cards, provenance: {} }),
      () => ({ hash: 'h1' }),
      cards => cards.map((c, i) => ({ ...c, id: 'n' + (i + 1) })),
      () => ({ entries: [] }),
      () => ({ warnings: [], errors: [] }),
      d => d,
      () => [],
      () => null,
      () => false
    );
    let auditStateOut = null;
    await ANKI_RUN.ankiRunSourceAuditWithEnv({
      sourceAudit: {
        preparedAt: '2026-01-01T00:00:00Z', status: 'prepared', model: 'gemini-4-hydrogen', thinkingLevel: 'low',
        prompts: [{ groupId: 'g1', text: 'STATIC_AUDIT_RULES\n\nAUDIT PACKET:\n{"groupId":"g1"}' }],
        results: [], responses: [], failures: [], failureHistory: [], sessions: []
      },
      auditBusy: false, busy: false, auditRun: { current: null }, auditInputs: { current: {} },
      cfg: { apiKey: 'AIzaSyTestKey1234567890' }, setSourceAudit: v => { auditStateOut = v; }, setAuditBusy: () => {}
    });

    // 5d. ankiRunWithEnv -> puts ANKI_MASTER_PROMPT + focusBlock + kbAdapter in systemInstruction and streams
    const ankiGenCalls = [];
    const ankiHelperCode = span('function ankiChunkText(', '/* ── END ANKI PURE HELPERS ── */');
    const ANKI_GEN = new Function(
      'callGemini', 'redactApiSecrets', 'ANKI_MASTER_PROMPT',
      'kbUsableFactCount', 'kbFactView', 'kbForAnki', 'validateLatteKnowledgeBase', 'isQuotaError', 'crypto',
      ankiHelperCode + '\n' + ankiRunnerCode + '\nreturn {ankiRunWithEnv};'
    )(
      async (_k, _m, parts, opts) => {
        ankiGenCalls.push({ parts, opts });
        return '```text\n[Heart Failure] Sign: {{c1::crackles}}||Nursing::LATTE::Look Condition::HeartFailure Tier::1\n```\n```text\nfact-1 -> line #1\n```';
      },
      s => String(s),
      'STATIC_ANKI_MASTER_PROMPT',
      () => 1,
      kb => kb,
      () => 'COMPACT_KB_BODY\nFACT fact-1: Crackles',
      () => [],
      () => false,
      globalThis.crypto
    );
    const kbStub = {
      metadata: { schemaVersion: '1.0', course: 'Synth' },
      conditions: [{ id: 'c1', name: 'Heart Failure', aliases: [], facts: [{ id: 'fact-1', text: 'Crackles', sourceQuote: 'Crackles', tier: 1, latteBucket: 'Look', sources: [{ filename: 'lec.pdf', location: 'p.1' }] }] }],
      sources: [], medications: [], diagnostics: [], scoringTools: [], formulas: [], contradictions: []
    };
    await ANKI_GEN.ankiRunWithEnv({
      cfg: { apiKey: 'AIzaSyTestKey1234567890', forTool: () => ({ model: 'gemini-4-hydrogen', level: 'low' }) },
      log: () => {}, K: { knowledgeBase: kbStub, isCurrentSource: () => true, registerArtifact: () => {} },
      ankiConditionFilter: '', ankiScopeMode: 'all', cancelSourceAudit: () => {},
      setBusy: () => {}, setProg: () => {}, setLogs: () => {}, setInterruptedRun: () => {},
      activeRun: { current: null }, setAbortCtl: () => {}, model: 'gemini-4-hydrogen', toolLevel: 'low',
      outcomes: '', points: '', focusContext: '', currentKB: { current: kbStub }, buildFocusBlock: () => '\nFOCUS_BLOCK',
      setLiveKB: () => {}, setSourceAudit: () => {}, setInspectNote: () => {}, setShowUncovered: () => {},
      setNotePage: () => {}, setEditBlocked: () => {}, setBatch: () => {}, setCards: () => {}, setLedger: () => {}
    });

    t('v21.10 Phase 5 (M5 & M6 — Live runner wire contracts): cardTranscribe, NCLEX-Extract, Anki Audit/Gen, KB, Case, NCLEX-Gen, and Priority send systemInstruction, stream:true & responseJsonSchema',
      cardFetches.length === 1 &&
      cardFetches[0].url.includes(':streamGenerateContent?alt=sse') &&
      cardFetches[0].body.systemInstruction.parts[0].text === 'STATIC_CARD_PROMPT' &&
      cardFetches[0].body.generationConfig.responseJsonSchema.required.includes('overallLegibility') &&
      nclexCalls.length === 3 &&
      nclexCalls[0].body.systemInstruction.parts[0].text === 'INLINE_HDR\n' &&
      nclexCalls[0].body.generationConfig.responseJsonSchema === NCLEX_RUN.NCLEX_INLINE_JSON_SCHEMA &&
      nclexCalls[0].opts.stream === true &&
      nclexCalls[1].body.generationConfig.responseJsonSchema === NCLEX_RUN.NCLEX_SPLIT_JSON_SCHEMA &&
      nclexCalls[2].body.generationConfig.responseJsonSchema === NCLEX_RUN.NCLEX_AI_PAIR_JSON_SCHEMA &&
      ankiAuditCalls.length === 1 &&
      ankiAuditCalls[0].opts.stream === true &&
      ankiAuditCalls[0].opts.systemInstruction === 'STATIC_AUDIT_RULES' &&
      ankiAuditCalls[0].parts[0].text.startsWith('AUDIT PACKET:\n') &&
      ankiAuditCalls[0].opts.generationConfig.responseJsonSchema === ANKI_RUN.ANKI_SOURCE_AUDIT_V4_JSON_SCHEMA &&
      auditStateOut && auditStateOut.status === 'complete' &&
      ankiGenCalls.length === 1 &&
      typeof ankiGenCalls[0].opts.onUpdate === 'function' &&
      ankiGenCalls[0].opts.systemInstruction.startsWith('STATIC_ANKI_MASTER_PROMPT\nFOCUS_BLOCK') &&
      ankiGenCalls[0].opts.systemInstruction.includes('KNOWLEDGE BASE ADAPTER') &&
      !ankiGenCalls[0].parts[0].text.includes('STATIC_ANKI_MASTER_PROMPT') &&
      S.includes('responseJsonSchema:KB_EXTRACTION_JSON_SCHEMA') &&
      S.includes('responseJsonSchema:KB_VERIFY_JSON_SCHEMA') &&
      S.includes('responseJsonSchema:CASE_STUDY_JSON_SCHEMA') &&
      S.includes('itemSplitAuditPrompt(_aPrompt)') &&
      S.includes('itemSplitAuditPrompt(_audPrompt)') &&
      S.includes('paSplitPrompt(prompt)') &&
      S.includes('paSplitPrompt(synthPrompt)'));
  }

  // 6. M6 — Hardened JSON Schema structural contracts
  {
    const cardSchema = G(null, {}, {}, () => 'png', {}, null, '').CARD_TRANSCRIBE_JSON_SCHEMA;
    const i2aItem = SCHEMAS.I2A_TRANSCRIBE_JSON_SCHEMA.properties.items.items;
    const i2aEv = i2aItem.properties.answer_evidence;
    const i2aVerdict = i2aItem.properties.option_rationales.items.properties.verdict;
    const ngRatReq = SCHEMAS.NG_REPAIR_JSON_SCHEMA.properties.rationales.items.required;
    const caseQProps = SCHEMAS.CASE_STUDY_JSON_SCHEMA.properties.stages.items.properties.questions.items.properties;

    t('v21.10 Phase 5 (M6 — Hardened JSON Schema structural contracts): all 10 live responseJsonSchema objects enforce required fields and enums',
      ['face', 'category', 'cardNumber', 'sections', 'numerics', 'overallLegibility'].every(k => cardSchema.required.includes(k)) &&
      JSON.stringify(cardSchema.properties.overallLegibility.enum) === JSON.stringify(['clean', 'uncertain', 'unreadable']) &&
      ['kind', 'format', 'legibility'].every(k => i2aItem.required.includes(k)) &&
      JSON.stringify(i2aItem.properties.legibility.enum) === JSON.stringify(['clean', 'uncertain', 'unreadable']) &&
      Array.isArray(i2aEv.anyOf) && JSON.stringify(i2aEv.anyOf[0].enum) === JSON.stringify(['printed', 'marked']) &&
      Array.isArray(i2aVerdict.anyOf) && JSON.stringify(i2aVerdict.anyOf[0].enum) === JSON.stringify(['correct', 'incorrect']) &&
      ['label', 'text', 'source'].every(k => ngRatReq.includes(k)) &&
      SCHEMAS.KB_EXTRACTION_JSON_SCHEMA.required.includes('conditions') &&
      SCHEMAS.KB_VERIFY_JSON_SCHEMA.required.includes('missed') &&
      SCHEMAS.NCLEX_INLINE_JSON_SCHEMA.type === 'array' &&
      SCHEMAS.NCLEX_SPLIT_JSON_SCHEMA.items.required.includes('question_number') &&
      SCHEMAS.NCLEX_AI_PAIR_JSON_SCHEMA.items.required.includes('number') &&
      ['options', 'matrix', 'cloze', 'trendTable', 'rationales'].every(k => k in caseQProps) &&
      ['factReviews', 'noteReviews', 'findings'].every(k => SCHEMAS.ANKI_SOURCE_AUDIT_V4_JSON_SCHEMA.required.includes(k)));
  }

  // 7. M17 — davis-transcribe-test.js offline wire parity, 15 MB stat guard, caching, retries & validation
  {
    const davis = require('../davis-transcribe-test');
    const liveCardSchema = G(null, {}, {}, () => 'png', {}, null, '').CARD_TRANSCRIBE_JSON_SCHEMA;
    const extractedSchema = davis.extractCardSchema(S);

    // 7a. >15 MB file rejected via statFile BEFORE readFile is called
    let oversizedReads = 0;
    const oversizedCaller = davis.createTranscriber(
      { live: true, dryRun: false, model: 'gemini-4-hydrogen', level: 'low', rpm: 0, retryms: 10 },
      'DAVIS_PROMPT', 'cli-key',
      {
        statFile: () => ({ size: 15 * 1024 * 1024 + 1 }),
        readFile: () => { oversizedReads++; return Buffer.from([0x89, 0x50, 0x4e, 0x47]); },
        fetch: async () => { throw new Error('must not fetch'); },
        sleep: async () => {}
      }
    );
    let oversizedErr = null;
    try { await oversizedCaller('huge.png', { attempts: 0 }); } catch (e) { oversizedErr = e; }

    // 7b. Payload caching across 3 runs + wire parity + encodeURIComponent(model) + transient fetch throw retry
    let diskReads = 0, fetchTries = 0;
    const seenUrls = [], seenBodies = [];
    const okTranscript = '{"face":"front","category":"Med","cardNumber":"42","sections":[{"key":"other","bullets":["b1"]}],"numerics":[],"overallLegibility":"clean"}';
    const cachedCaller = davis.createTranscriber(
      { live: true, dryRun: false, model: 'gemini/custom#1', level: 'low', rpm: 0, retryms: 10 },
      'DAVIS_PROMPT', 'cli-key',
      {
        statFile: () => ({ size: 128 }),
        readFile: () => { diskReads++; return Buffer.from([0x89, 0x50, 0x4e, 0x47]); },
        sleep: async () => {},
        random: () => 0,
        fetch: async (url, init) => {
          fetchTries++;
          seenUrls.push(url);
          seenBodies.push(JSON.parse(init.body));
          if (fetchTries === 1) throw new TypeError('simulated ECONNRESET');
          return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: okTranscript }] } }], usageMetadata: {} }) };
        }
      }
    );
    await cachedCaller('card.png', { attempts: 0 });
    await cachedCaller('card.png', { attempts: 0 });
    await cachedCaller('card.png', { attempts: 0 });

    // 7c. store:false 400 fallback never exceeds 4 attempts
    const storeObs = { attempts: 0 };
    const storeCaller = davis.createTranscriber(
      { live: true, dryRun: false, model: 'gemini-4-hydrogen', level: 'low', rpm: 0, retryms: 10 },
      'DAVIS_PROMPT', 'cli-key',
      {
        statFile: () => ({ size: 128 }),
        readFile: () => Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        sleep: async () => {},
        random: () => 0,
        fetch: async (_u, init) => {
          const b = JSON.parse(init.body);
          if (b.store === false) return { ok: false, status: 400, json: async () => ({ error: { message: 'Unknown field: store' } }) };
          return { ok: false, status: 503, json: async () => ({ error: { message: 'unavailable' } }) };
        }
      }
    );
    let storeCapErr = null;
    try { await storeCaller('card.png', storeObs); } catch (e) { storeCapErr = e; }

    // 7d. validateTranscript rejects missing/invalid overallLegibility or non-string category/cardNumber
    const throws = fn => { try { fn(); return false; } catch { return true; } };
    const baseTx = { face: 'front', category: null, cardNumber: '12', sections: [], numerics: [], overallLegibility: 'clean' };

    t('v21.10 Phase 5 (M17 — davis-transcribe-test.js): aligns schema & systemInstruction wire format, blocks >15 MB before readFile, caches disk reads, retries fetch throws within 4 attempts, and tightens validateTranscript',
      JSON.stringify(extractedSchema) === JSON.stringify(liveCardSchema) &&
      oversizedErr && /too large.*15(?:\.0)? MB/i.test(oversizedErr.message) && oversizedReads === 0 &&
      diskReads === 1 && fetchTries === 4 &&
      seenUrls[0].includes('models/gemini%2Fcustom%231:generateContent') &&
      seenBodies[0].systemInstruction.parts[0].text === 'DAVIS_PROMPT' &&
      seenBodies[0].contents[0].parts.length === 1 &&
      Boolean(seenBodies[0].contents[0].parts[0].inlineData) &&
      seenBodies[0].generationConfig.responseJsonSchema.required.includes('overallLegibility') &&
      storeCapErr && storeObs.attempts === 4 &&
      davis.validateTranscript(baseTx) === baseTx &&
      throws(() => davis.validateTranscript({ ...baseTx, overallLegibility: 'bogus' })) &&
      throws(() => davis.validateTranscript({ ...baseTx, category: 123 })) &&
      throws(() => davis.validateTranscript({ ...baseTx, cardNumber: {} })));
  }

  // 8. M17 — neia-retest.js offline systemInstruction, retry bounds, ok-only means & atomic writePrivateReport
  {
    const neia = require('../neia-retest');
    const { writePrivateReport } = require('./repo-checks');
    const extracted = neia.extractAudit(S);

    // 8a. systemInstruction split + encodeURIComponent(model) + transient fetch throw retry + 600s sleep cap
    const seenUrls = [], seenBodies = [], sleeps = [];
    let tries = 0;
    const auditCaller = neia.createAuditCaller(
      { live: true, dryRun: false, model: 'gemini/neon#1', level: 'high', rpm: 0, retryms: 600000 },
      'cli-key',
      {
        sleep: async ms => { sleeps.push(ms); },
        random: () => 0.5,
        fetch: async (url, init) => {
          tries++;
          seenUrls.push(url);
          seenBodies.push(JSON.parse(init.body));
          if (tries === 1) throw new TypeError('socket hang up');
          if (tries === 2) return { ok: false, status: 503, headers: null, json: async () => ({ error: { message: 'busy' } }) };
          return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'PASS' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }) };
        }
      }
    );
    const samplePrompt = 'STATIC_NEIA_RUBRIC\n\n═══ THE CASE, AS THE STUDENT SEES IT ═══\nSTEM: Q1';
    const res = await auditCaller(samplePrompt, { attempts: 0 });

    // 8b. store:false 400 fallback strictly capped at 4 attempts
    const storeObs = { attempts: 0 };
    const storeAuditCaller = neia.createAuditCaller(
      { live: true, dryRun: false, model: 'gemini-4-neon', level: 'high', rpm: 0, retryms: 10 },
      'cli-key',
      {
        sleep: async () => {},
        random: () => 0,
        fetch: async (_u, init) => {
          const b = JSON.parse(init.body);
          if (b.store === false) return { ok: false, status: 400, json: async () => ({ error: { message: 'Invalid store parameter' } }) };
          return { ok: false, status: 429, headers: null, json: async () => ({ error: { message: 'rate limit' } }) };
        }
      }
    );
    let neiaCapErr = null;
    try { await storeAuditCaller(samplePrompt, storeObs); } catch (e) { neiaCapErr = e; }

    // 8c. analyzeResults averages latency/tokens over ok runs only (never deflated by 0ms ERROR rows)
    const analysis = neia.analyzeResults([
      { id: 'item-1', run: 0, band: 'sound', seeded: null, status: 'PASS', criterion: null, warnCriteria: [], ms: 100, tokensIn: 400, tokensOut: 20, tokensThought: 10 },
      { id: 'item-1', run: 1, band: 'sound', seeded: null, status: 'PASS', criterion: null, warnCriteria: [], ms: 200, tokensIn: 600, tokensOut: 40, tokensThought: 30 },
      { id: 'item-1', run: 2, band: 'sound', seeded: null, status: 'ERROR', criterion: null, warnCriteria: [], ms: 0, tokensIn: 0, tokensOut: 0, tokensThought: 0 },
      { id: 'item-2', run: 0, band: 'sound', seeded: null, status: 'ERROR', criterion: null, warnCriteria: [], ms: 0, tokensIn: 0, tokensOut: 0, tokensThought: 0 },
      { id: 'item-2', run: 1, band: 'sound', seeded: null, status: 'ERROR', criterion: null, warnCriteria: [], ms: 0, tokensIn: 0, tokensOut: 0, tokensThought: 0 }
    ], 3);
    const row1 = analysis.rows.find(r => r.id === 'item-1');
    const row2 = analysis.rows.find(r => r.id === 'item-2');

    // 8d. writePrivateReport atomically writes via temp file + rename with zero leftover .tmp files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nss-phase5-'));
    let reportRead = '', dirFiles = [];
    try {
      const target = path.join(tmpDir, 'report.json');
      writePrivateReport(target, '{"ok":true}\n');
      reportRead = fs.readFileSync(target, 'utf8');
      dirFiles = fs.readdirSync(tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    t('v21.10 Phase 5 (M17 — neia-retest.js & writePrivateReport): splits rubric into systemInstruction, encodes model, caps retries & 600s backoff, excludes ERROR rows from means, and writes reports atomically',
      typeof extracted.itemSplitAuditPrompt === 'function' &&
      res.text === 'PASS' &&
      seenUrls[0].includes('models/gemini%2Fneon%231:generateContent') &&
      seenBodies[0].systemInstruction.parts[0].text === 'STATIC_NEIA_RUBRIC' &&
      seenBodies[0].contents[0].parts[0].text.startsWith('═══ THE CASE, AS THE STUDENT SEES IT ═══\n') &&
      sleeps.length === 2 && sleeps.every(ms => ms <= 600000) &&
      neiaCapErr && storeObs.attempts === 4 &&
      row1.meanMs === 150 && row1.meanTokensIn === 500 && row1.meanTokensOut === 30 && row1.meanTokensThought === 20 &&
      row2.meanMs === 0 && row2.meanTokensIn === 0 &&
      reportRead === '{"ok":true}\n' && dirFiles.length === 1 && dirFiles[0] === 'report.json');
  }

  // 9. M18 — neia-fixture.json itemAudit metadata, borderline-2 potassium overlap, & balanced answer keys
  {
    const fixture = JSON.parse(fs.readFileSync(path.join(rootDir, 'neia-fixture.json'), 'utf8'));
    const b2 = fixture.items.find(it => it.id === 'borderline-2');
    const b2q = b2.case.stages[0].questions[0];
    const b2Issues = [];
    CE.itemHeuristics(b2q, b2Issues, 'borderline-2');
    const keyCounts = { A: 0, B: 0, C: 0, D: 0 };
    for (const it of fixture.items) {
      const k = it.case.stages[0].questions[0].correctAnswers[0];
      keyCounts[k] = (keyCounts[k] || 0) + 1;
    }
    const distractorItem = fixture.items.find(it => it.id === 'seeded-distractor-plausibility');
    const distractorD = distractorItem.case.stages[0].questions[0].options.find(o => o.label === 'D');

    t('v21.10 Phase 5 (M18 — neia-fixture.json): names itemAudit (not casesAudit), borderline-2 triggers live stem-overlap smoke detector on potassium, distractor D matches note, and answer keys are balanced',
      fixture.purpose.includes('itemAudit') &&
      !fixture.purpose.includes('casesAudit') &&
      /potassium/i.test(b2q.stem) &&
      b2Issues.some(i => i.sev === 'warn' && /stem overlap/i.test(i.msg)) &&
      distractorD && /meal tray/i.test(distractorD.text) &&
      keyCounts.A >= 2 && keyCounts.B >= 2 && keyCounts.C >= 2 && keyCounts.D >= 2 &&
      Math.max(keyCounts.A, keyCounts.B, keyCounts.C, keyCounts.D) <= 3);
  }
};
