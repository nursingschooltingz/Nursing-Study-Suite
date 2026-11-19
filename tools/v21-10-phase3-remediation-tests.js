'use strict';

// v21.10 Phase 3 production code-review remediation regression suite:
// H10 (Argon xhigh -> high clamping across App, AnkiGenerator, ConfigSidebar),
// H11 (cardMergeFaces worst-case legibility escalation across numerics, sections, unreadable[], [?]),
// H12 (selectCaseFacts & selectCaseFactsMulti boolean safetyCritical/tier rank comparator),
// H13 (caseCalculationEvidence time-denominator division & multiplication: hr/min/sec/day/week),
// H14 (ngSplitParts ADME prose "Distribution:" inside PART 4 preserved via final DISTRIBUTION: match),
// H15 (NGN trendTable type gating, same-stage lookahead prevention, HR N/min -> bpm, option/answer trimming),
// H16 (closed uncited unit-bearing numeric bypass while keeping non-numeric missing-factIds warn-only),
// H17 (CRLF normalization in ankiChunkText/ankiParseCards/parseKBCoverage, unclosed trailing fence capture, dedup/trailing dot),
// H18 (ankiAuditGroups single-scoping, stripped unmapped exclusion, cross-chunk fallback dedupe),
// H19 (n2aConvertText kText truncation, nclexDropOptionRuns per-run resume & trailing-Q guard, nclexSplitByQNum loose delimiter, i2aMergeAnswer legibility precedence, i2aAssemble continuation & ambiguity),
// M8  (case/anki numeric tokenizers: 10/10 pain vs BP, slash BP threshold, rejected unsupported tails, 24-hr clock strip, neutral-framing labels, Unicode minus decimal parity, plural units/m², leading-dot fraction, ankiRecallNumbers),
// M9  (KB focus verify schema, whitespace concept key, Patho differentiator, mergeLatteParts metadata & trapRole/RN-core hoisting, case-sensitive short acronyms, envelope optional arrays, operator canon/boundary, letter-only dehyphenation),
// M10 (parseAndNumberPoints linear dash check & p53/P450/P2 preservation; paParseTiers strategy subheadings & bold-italic Audit),
// M11 (cardFilePayload white fill & >15MB scale===1 JPEG re-encode, cardKey normalization, cardCompareRuns title/heading/bullet multiplicity, i2aFileKey pure-JS FIPS 180-4 SHA-256 fallback),
// M12 (validateCaseStudy min options & calc instantiated rationale, caseShuffleQuestion custom labels & positional phrasing, 3-letter sibling exclusion & multi-entity auto-link, ngFocusPlan [P#] anchors with ;/:, validateNCLEXWorksheet DISTRIBUTION union, binomial organism wrap guard, caseRepairContract/caseReviewRows/isQuotaError/casePacketToMarkdown/caseBuildBatchTargets/caseRunBatchQueue),
// M13 (ankiCreateStyleCache in-place invalidation, lintAnkiCard null guard & extra-cloze advisory warning, provenance from/to & conditionTagNormalizations, contrast owners & connected-graph check, Scope::Contrast sibling requirement, nclexAdmitRecord/nclexSplitStemOptions/nclexMergePairs/TOC/1-page seed/n2aParseKey/n2aStripSources/x2aBlocks/n2aPdfQuestionLines/i2aNormalizeItem/i2aAiCacheKey/i2aConvert/i2aBuildCards).

const crypto = require('crypto');

module.exports = async function runV2110Phase3RemediationTests(S, t) {
  function span(start, end, fromAnchor) {
    const base = fromAnchor ? S.indexOf(fromAnchor) : 0;
    if (base < 0) throw new Error('v21.10 Phase 3 from-anchor missing: ' + fromAnchor);
    const a = S.indexOf(start, base);
    if (a < 0) throw new Error('v21.10 Phase 3 start anchor missing: ' + start);
    if (S.indexOf(start, a + start.length) >= 0) throw new Error('v21.10 Phase 3 start anchor ambiguous: ' + start);
    const b = S.indexOf(end, a + start.length);
    if (b < 0) throw new Error('v21.10 Phase 3 end anchor missing after: ' + start);
    return S.slice(a, b);
  }

  // Extract the live plain-ES2020 pure-engine script (everything inside the main non-Babel <script>)
  const babelTag = '<script type="text/babel" data-presets="react">';
  const babelIdx = S.indexOf(babelTag);
  if (babelIdx < 0) throw new Error('Missing text/babel script tag');
  const mainClose = S.lastIndexOf('</script>', babelIdx);
  const mainOpen = S.lastIndexOf('<script>', mainClose);
  if (mainOpen < 0 || mainClose < 0) throw new Error('Missing main pure-engine <script> block');
  const pureSrc = S.slice(mainOpen + '<script>'.length, mainClose);

  let seq = 0;
  const mockWin = { addEventListener() {}, removeEventListener() {}, location: { protocol: 'file:' } };
  const ENV = new Function('window', 'React', 'uid', pureSrc + `
    return {
      geminiIsArgon,
      parseAndNumberPoints,
      kbBuildFocusBlock, kbOrderByConcept, auditKbConcepts, renderKBMarkdown, mergeLatteParts, kbFactView,
      kbInferEntityConcept, kbProjectExamTraps, kbValidateExtractionEnvelope,
      kbCanonOperators, kbQuoteOperatorsAgree, kbDehyphNormForMatch,
      cardFilePayload, cardKey, cardMergeFaces, cardCompareRuns, cardChunkBlockers, CARD_MAX_INLINE_BYTES,
      paParseTiers,
      ankiChunkText, ankiParseCards, parseKBCoverage, ankiSourceSnapshot, ankiAuditGroups,
      ankiNumericText, ankiNumericTokens, ankiDecimal, ankiRecallNumbers,
      ankiCreateStyleCache, lintAnkiCard, ankiStyleWarnings, ankiNoteProvenance,
      ankiSourceAuditEvidence, ankiConditionTagCheck, ankiStampConceptTags,
      nclexAdmitRecord, nclexDropOptionRuns, nclexSplitByQNum, nclexSplitStemOptions,
      nclexMergePairs, nclexMatchSplitTocSpans, nclexSeedPdfRanges,
      n2aConvertText, n2aParseKey, n2aStripSources, x2aBlocks, n2aPdfQuestionLines,
      i2aFileKey, i2aMergeAnswer, i2aAssemble, i2aNormalizeItem, i2aApplyAi, i2aAiCacheKey, i2aConvert, i2aBuildCards,
      ngSplitParts, ngCanonicalOrderingAnswers, ngAllocateBatch, ngFocusPlan,
      validateNCLEXWorksheet, ngParseItem, ngShuffleWorksheetOptions,
      selectCaseFacts, selectCaseFactsMulti, caseCalculationEvidence, caseNumericText, caseNumericTokens,
      caseSplitValue, caseParseThresholds, caseDecimal, caseAuditTextValues, caseAuditDatumValues,
      caseDifficultySignals, validateCaseStudy, validateStageTiming, caseAllFactIds,
      caseToMarkdown, caseShuffleQuestion, caseFormatAnswerSummary, caseRepairContract,
      caseReviewRows, isQuotaError, casePacketToMarkdown, caseBuildBatchTargets, caseRunBatchQueue,
    };
  `)(mockWin, { createElement: () => null, Fragment: Symbol('Fragment'), createContext: () => ({}), useState: () => [null, () => {}], useEffect: () => {}, useCallback: fn => fn, useMemo: fn => fn(), useRef: v => ({ current: v }), useContext: () => ({}), memo: c => c }, () => 'p3-uid-' + (++seq));

  t('v21.10 Phase 3 (Extraction tail): live pure domain engines compile cleanly and reach caseRunBatchQueue',
    typeof ENV.caseRunBatchQueue === 'function' && typeof ENV.geminiIsArgon === 'function' && typeof ENV.i2aFileKey === 'function');

  // ── H10: Argon xhigh -> high clamping across App, AnkiGenerator, ConfigSidebar ──
  {
    const defaults = new Function(span('const TOOL_PROFILE_DEFAULTS={', 'const PROFILE_ROWS=') + ';return TOOL_PROFILE_DEFAULTS;')();
    const forToolSrc = span('  const forTool=useCallback(id=>{', '  const cfg=useMemo');
    const makeForTool = (opts) => new Function(
      'autoProfile', 'profiles', 'TOOL_PROFILE_DEFAULTS', 'thinkingMode', 'hydrogenModel', 'neonModel', 'hydrogenLevel', 'neonLevel', 'geminiIsArgon', 'useCallback',
      forToolSrc + ';return forTool;'
    )(opts.autoProfile, opts.profiles, defaults, opts.thinkingMode, opts.hydrogenModel, opts.neonModel, opts.hydrogenLevel, opts.neonLevel, ENV.geminiIsArgon, fn => fn);

    const ftAutoNeonArg = makeForTool({ autoProfile: true, profiles: { cases: { m: 'neon', lv: 'xhigh' } }, thinkingMode: false, hydrogenModel: 'gemini-4-hydrogen', neonModel: 'gemini-4-argon', hydrogenLevel: 'xhigh', neonLevel: 'xhigh' });
    const ftAutoHydArg = makeForTool({ autoProfile: true, profiles: { anki: { m: 'hydrogen', lv: 'xhigh' } }, thinkingMode: false, hydrogenModel: 'gemini-4-argon', neonModel: 'gemini-4-neon', hydrogenLevel: 'xhigh', neonLevel: 'xhigh' });
    const ftManHydArg = makeForTool({ autoProfile: false, profiles: {}, thinkingMode: false, hydrogenModel: 'gemini-4-argon', neonModel: 'gemini-4-neon', hydrogenLevel: 'xhigh', neonLevel: 'xhigh' });
    const ftManNeonOk = makeForTool({ autoProfile: false, profiles: {}, thinkingMode: true, hydrogenModel: 'gemini-4-hydrogen', neonModel: 'gemini-4-neon', hydrogenLevel: 'xhigh', neonLevel: 'xhigh' });

    // AnkiGenerator prepareSourceAudit Argon clamping
    const prepSrc = span('  const prepareSourceAudit=()=>{', '  const runSourceAudit=()=>ankiRunSourceAuditWithEnv(');
    let capturedAudit = null;
    const runPrep = (auditModel, auditLevel) => new Function(
      'current', 'busy', 'auditBusy', 'auditRun', 'ankiAuditGroups', 'cards', 'batch', 'tierFilter',
      'ankiBuildSourceAuditPrompt', 'ankiBuildSourceAuditPromptV4', 'ankiAuditPacket', 'ankiAuditSourceTokens',
      'geminiIsArgon', 'auditModel', 'auditLevel', 'setSourceAudit', 'redactApiSecrets', 'cfg',
      prepSrc + ';prepareSourceAudit();'
    )(true, false, false, { current: null }, () => [{ id: 'g1' }], [], {}, 'all', () => 'p', () => 'p', () => ({}), () => [], ENV.geminiIsArgon, auditModel, auditLevel, v => { capturedAudit = v; }, s => String(s), { apiKey: '' });
    runPrep('gemini-4-argon', 'xhigh');
    const clampedAuditLv = capturedAudit && capturedAudit.thinkingLevel;
    runPrep('gemini-4-neon', 'xhigh');
    const neonAuditLv = capturedAudit && capturedAudit.thinkingLevel;

    // ConfigSidebar & App structural Argon guards for both slots
    const sidebarSrc = span('function ConfigSidebar({onClose,activeTool}){', 'class ToolBoundary extends React.Component{');
    const appEffectSrc = span('  useEffect(()=>{\n    if(geminiIsArgon(neonModel)', '  const forTool=useCallback(');

    t('v21.10 Phase 3 (H10 — Argon xhigh clamping): App.forTool, AnkiGenerator.prepareSourceAudit, App effect, and ConfigSidebar clamp xhigh -> high for both Hydrogen and Neon Argon slots',
      ftAutoNeonArg('cases').level === 'high' &&
      ftAutoHydArg('anki').level === 'high' &&
      ftManHydArg('anki').level === 'high' &&
      ftManNeonOk('cases').level === 'xhigh' &&
      clampedAuditLv === 'high' &&
      neonAuditLv === 'xhigh' &&
      sidebarSrc.includes('const activeId=cfg.thinkingMode?cfg.neonModel:cfg.hydrogenModel') &&
      appEffectSrc.includes("if(geminiIsArgon(hydrogenModel)&&hydrogenLevel==='xhigh')setHydrogenLevel('high')"));
  }

  // ── H11: cardMergeFaces worst-case legibility escalation ──
  {
    const baseFace = (over) => ({ face: 'front', category: 'Pharm', cardNumber: '12', title: 'Digoxin', sections: [{ heading: 'Dose', bullets: ['0.125 mg'], legibility: 'clean' }], numerics: [{ label: 'Level', value: '0.8 ng/mL', legibility: 'clean' }], unreadable: [], overallLegibility: 'clean', ...over });
    const mNum = ENV.cardMergeFaces([baseFace({ numerics: [{ label: 'Level', value: '0.8 ng/mL', legibility: 'unreadable' }] })])[0];
    const mSec = ENV.cardMergeFaces([baseFace({ sections: [{ heading: 'Dose', bullets: ['blurry'], legibility: 'uncertain' }] })])[0];
    const mUnr = ENV.cardMergeFaces([baseFace({ unreadable: ['apical threshold'] })])[0];
    const mQmk = ENV.cardMergeFaces([baseFace({ numerics: [{ label: 'Hold', value: '< [?] bpm', legibility: 'clean' }] })])[0];
    const blockers = ENV.cardChunkBlockers(mNum, false);

    t('v21.10 Phase 3 (H11 — cardMergeFaces legibility): escalates clean overallLegibility from unreadable/uncertain numerics, sections, unreadable[], and [?] values, blocking KB promotion',
      mNum.legibility === 'unreadable' &&
      mSec.legibility === 'uncertain' &&
      mUnr.legibility === 'unreadable' &&
      mQmk.legibility === 'unreadable' &&
      blockers.length > 0 &&
      ENV.cardChunkBlockers(mQmk, false).length > 0);
  }

  // ── H12: selectCaseFacts & selectCaseFactsMulti safetyCritical precedence ──
  {
    const cond = {
      name: 'Hyperkalemia',
      facts: [
        { id: 'f-t1', text: 'Administer oral sodium zirconium cyclosilicate.', tier: 1, latteBucket: 'Treatments', sourceQuote: 'Administer oral sodium zirconium cyclosilicate.' },
        { id: 'f-t2-safe', text: 'Give IV calcium gluconate first for peaked T waves.', tier: 2, safetyCritical: true, latteBucket: 'Treatments', sourceQuote: 'Give IV calcium gluconate first for peaked T waves.' },
      ],
    };
    const single = ENV.selectCaseFacts(cond, { includeTier2: true });
    const multi = ENV.selectCaseFactsMulti([cond], { includeTier2: true });

    t('v21.10 Phase 3 (H12 — selectCaseFacts rank comparator): safetyCritical:true Tier-2 ranks ahead of safetyCritical:undefined Tier-1 in both single and multi selectors',
      single[0].id === 'f-t2-safe' &&
      single[1].id === 'f-t1' &&
      multi[0].id === 'f-t2-safe' &&
      multi[1].id === 'f-t1');
  }

  // ── H13: caseCalculationEvidence time-denominator division & multiplication ──
  {
    const ix = new Map([
      ['f-inf', { fact: { text: 'Infuse 1000 mL normal saline over 8 hr.', sourceQuote: '' } }],
      ['f-vol', { fact: { text: 'Rate is 125 mL/hr for 8 hr.', sourceQuote: '' } }],
      ['f-min', { fact: { text: 'Infuse lidocaine at 2 mg/min for 30 min.', sourceQuote: '' } }],
    ]);
    const calcQ = (expr) => ({ type: 'Calculation', rationales: [{ option: 'Answer', text: expr }] });
    const divEv = ENV.caseCalculationEvidence(calcQ('1000 mL ÷ 8 hr = 125 mL/hr'), ix, ['f-inf'], []);
    const mulEv = ENV.caseCalculationEvidence(calcQ('125 mL/hr × 8 hr = 1000 mL'), ix, ['f-vol'], []);
    const minEv = ENV.caseCalculationEvidence(calcQ('2 mg/min × 30 min = 60 mg'), ix, ['f-min'], []);

    t('v21.10 Phase 3 (H13 — caseCalculationEvidence time denominators): verifies 1000 mL ÷ 8 hr = 125 mL/hr, 125 mL/hr × 8 hr = 1000 mL, and 2 mg/min × 30 min = 60 mg',
      divEv.has('125ml/hr') &&
      mulEv.has('1000ml') &&
      minEv.has('60mg'));
  }

  // ── H14: ngSplitParts ADME prose "Distribution:" inside PART 4 ──
  {
    const ws = [
      'PART 1: FOCUS SUMMARY',
      'Pharmacology focus.',
      '',
      'PART 2: PRACTICE QUESTIONS',
      '1. Which pharmacokinetic property applies?',
      'A. Absorption',
      'B. Distribution',
      '',
      'PART 3: ANSWER KEY',
      '1. B',
      '',
      'PART 4: RATIONALES',
      '1. B is correct.',
      'Distribution: Lipophilic drugs distribute widely into adipose tissue.',
      'Elimination occurs primarily via hepatic metabolism.',
      'DISTRIBUTION: 1 MCQ (1 Tier 1)',
    ].join('\n');
    const parts = ENV.ngSplitParts(ws);

    t('v21.10 Phase 3 (H14 — ngSplitParts ADME prose): retains full PART 4 across a line-start "Distribution:" pharmacology rationale before the final DISTRIBUTION: summary',
      parts.p4.includes('Lipophilic drugs distribute widely into adipose tissue.') &&
      parts.p4.includes('Elimination occurs primarily via hepatic metabolism.') &&
      parts.dist.startsWith('1 MCQ'));
  }

  // ── H15: NGN trendTable gating, same-stage lookahead, HR N/min -> bpm, & trimming ──
  {
    const ix = new Map([
      ['f1', { fact: { text: 'Heart rate 88 bpm. Respiratory rate 24/min. Hypovolemic shock.', sourceQuote: '' } }],
      ['f2', { fact: { text: 'Lactate 4.2 mmol/L indicates worsening perfusion.', sourceQuote: '' } }],
    ]);
    const known = new Set(['f1', 'f2']);
    // 1. Unexpected trendTable on MCQ
    const badMcqCase = {
      condition: 'Shock',
      stages: [{
        stageNumber: 1,
        data: [{ label: 'Heart rate', value: '88/min', supportType: 'direct', availability: 'revealed', factIds: ['f1'] }],
        questions: [{
          id: 's1q1', type: 'MCQ', stem: 'Identify priority.',
          trendTable: { columns: ['Time', 'Lactate'], rows: [{ label: '0800', values: ['4.2 mmol/L'], factIds: ['f-ghost'] }] },
          options: [{ label: ' A ', text: 'Fluid bolus' }, { label: ' B ', text: 'Reassess later' }],
          correctAnswers: [' A '],
          rationales: [
            { option: ' A ', text: 'Lactate 4.2 mmol/L confirms hypoperfusion.', supportType: 'direct', factIds: ['f2'] },
            { option: ' B ', text: 'Hypovolemic shock needs action.', supportType: 'direct', factIds: ['f1'] },
          ],
        }],
      }],
    };
    const badIssues = ENV.validateCaseStudy(badMcqCase, ix, known, 'Shock');
    const hasUnexpectedTrendErr = badIssues.some(i => i.sev === 'error' && /trendTable/i.test(i.msg));
    const sigs = ENV.caseDifficultySignals(badMcqCase, ix);
    const allIds = ENV.caseAllFactIds(badMcqCase);

    // 2. Same-stage lookahead: s2q1 cites f2 which only appears in s2q2's trendTable
    const lookaheadCase = {
      stages: [{
        stageNumber: 1, data: [{ label: 'Heart rate', value: '88 bpm', availability: 'revealed', factIds: ['f1'] }],
        questions: [
          { id: 's1q1', type: 'MCQ', rationales: [{ option: 'A', factIds: ['f2'] }] },
          { id: 's1q2', type: 'Trend', trendTable: { columns: ['0800'], rows: [{ label: 'Lactate', values: ['4.2 mmol/L'], factIds: ['f2'] }] }, rationales: [{ option: 'A', factIds: ['f2'] }] },
        ],
      }],
    };
    const timingIssues = ENV.validateStageTiming(lookaheadCase);

    // 3. Heart rate 88/min -> 88 bpm while RR 24/min stays 24/min
    const hrNorm = ENV.caseNumericText('Heart rate 88/min');
    const rrNorm = ENV.caseNumericText('RR 24/min');
    const hrErrs = [];
    ENV.caseAuditTextValues('Heart rate 88/min', ['f1'], ix, 'HR', hrErrs, 'direct');
    const rrBadErrs = [];
    ENV.caseAuditTextValues('RR 24 bpm', ['f1'], ix, 'RR', rrBadErrs, 'direct');

    // 4. Padded Cloze/Bowtie labels trim cleanly across validate/markdown/summary/shuffle
    const paddedCloze = {
      condition: 'Shock',
      stages: [{
        stageNumber: 1,
        data: [{ label: 'Heart rate', value: '88/min', supportType: 'direct', availability: 'revealed', factIds: ['f1'] }],
        questions: [{
          id: 's1q1', type: 'Cloze',
          stem: 'The client is experiencing {{D1}} and needs {{D2}}.',
          options: [
            { label: ' 1A ', group: ' D1 ', text: 'hypovolemic shock' },
            { label: ' 1B ', group: ' D1 ', text: 'stable rhythm' },
            { label: ' 1C ', group: ' D1 ', text: 'mild dehydration' },
            { label: ' 2A ', group: ' D2 ', text: 'fluid resuscitation' },
            { label: ' 2B ', group: ' D2 ', text: 'discharge' },
            { label: ' 2C ', group: ' D2 ', text: 'observation only' },
          ],
          correctAnswers: [' 1A ', ' 2A '],
          rationales: [
            { option: ' 1A ', text: 'Hypovolemic shock matches findings.', supportType: 'direct', factIds: ['f1'] },
            { option: ' 1B ', text: 'Hypovolemic shock is unstable.', supportType: 'direct', factIds: ['f1'] },
            { option: ' 1C ', text: 'Hypovolemic shock is more severe.', supportType: 'direct', factIds: ['f1'] },
            { option: ' 2A ', text: 'Hypovolemic shock needs fluids.', supportType: 'direct', factIds: ['f1'] },
            { option: ' 2B ', text: 'Hypovolemic shock cannot be discharged.', supportType: 'direct', factIds: ['f1'] },
            { option: ' 2C ', text: 'Hypovolemic shock requires prompt action.', supportType: 'direct', factIds: ['f1'] },
          ],
        }],
      }],
    };
    const paddedErrs = ENV.validateCaseStudy(paddedCloze, ix, known, 'Shock').filter(i => i.sev === 'error');
    const paddedSummary = ENV.caseFormatAnswerSummary(paddedCloze.stages[0].questions[0]);
    const paddedMd = ENV.caseToMarkdown(paddedCloze, true);

    t('v21.10 Phase 3 (H15 — NGN trendTable, HR/min, & trimming): rejects non-Trend trendTable, blocks same-stage trendTable lookahead, normalizes HR /min -> bpm without conflating RR, and trims padded NGN labels',
      hasUnexpectedTrendErr &&
      !allIds.includes('f-ghost') &&
      (!Array.isArray(sigs.ngnTypes) || !sigs.ngnTypes.includes('Trend')) &&
      timingIssues.some(i => i.sev === 'warn' && i.msg.includes('s1q1') && i.msg.includes('f2')) &&
      !timingIssues.some(i => i.msg.includes('s1q2')) &&
      /\b88 bpm\b/i.test(hrNorm) &&
      !/\b24 bpm\b/i.test(rrNorm) &&
      hrErrs.length === 0 &&
      rrBadErrs.some(i => i.sev === 'error') &&
      paddedErrs.length === 0 &&
      paddedSummary.includes('1A') &&
      paddedMd.includes('D1'));
  }

  // ── H16: Closed uncited unit-bearing bypass while preserving non-numeric warn-only ──
  {
    const ix = new Map([['f1', { fact: { text: 'Normal potassium 3.5-5.0 mEq/L.', sourceQuote: '' } }]]);
    const known = new Set(['f1']);
    const makeCase = (datum) => ({
      condition: 'Electrolytes',
      stages: [{
        stageNumber: 1,
        data: [datum],
        questions: [{
          id: 'q1', type: 'MCQ', stem: 'Select action.',
          options: [{ label: 'A', text: 'Monitor' }, { label: 'B', text: 'Ignore' }],
          correctAnswers: ['A'],
          rationales: [
            { option: 'A', text: 'Normal potassium 3.5-5.0 mEq/L.', supportType: 'direct', factIds: ['f1'] },
            { option: 'B', text: 'Normal potassium 3.5-5.0 mEq/L.', supportType: 'direct', factIds: ['f1'] },
          ],
        }],
      }],
    });
    const fabNum = ENV.validateCaseStudy(makeCase({ label: 'Potassium', value: '2.1 mEq/L', supportType: 'direct', availability: 'revealed', factIds: [] }), ix, known, 'Electrolytes');
    const nonNum = ENV.validateCaseStudy(makeCase({ label: 'Skin', value: 'Warm and dry', supportType: 'direct', availability: 'revealed', factIds: [] }), ix, known, 'Electrolytes');

    t('v21.10 Phase 3 (H16 — uncited numeric entailment): fabricated uncited unit-bearing stage.data fails with sev:error while non-numeric uncited datum remains warn-only',
      fabNum.some(i => i.sev === 'error' && /2\.1\s*meq\/l/i.test(i.msg)) &&
      nonNum.some(i => i.sev === 'warn' && /has no fact ID/.test(i.msg)) &&
      !nonNum.some(i => i.sev === 'error'));
  }

  // ── H17: CRLF normalization, unclosed trailing fence capture, & parseKBCoverage ──
  {
    const crlfPages = 'Page one content '.repeat(30) + '\r\n--- PAGE 2 ---\r\n' + 'Page two content '.repeat(30);
    const pageChunks = ENV.ankiChunkText(crlfPages, 600, 0);
    const crlfConds = 'HEADER\r\n\r\n=== CONDITION: Alpha ===\r\n' + 'Fact A '.repeat(40) + '\r\n\r\n=== CONDITION: Beta ===\r\n' + 'Fact B '.repeat(40);
    const condChunks = ENV.ankiChunkText(crlfConds, 400, 0);

    const unclosedLedger = ENV.ankiParseCards('```text\nCheck {{c1::pulse}}.|Extra|Tier::1\n```\n```text\nfact-1 -> line #1', 1);
    const unclosedWithPreamble = ENV.ankiParseCards('Here are your Anki cards:\n```text\nCheck {{c1::pulse}}.|Extra|Tier::1', 1);

    const covCrlf = ENV.parseKBCoverage('fact-1 -> line #5.\r\nfact-2, fact-2 -> line #2\r\nfact-3 -> line #1.5\r\nfact-4 -> line #1, #2');
    const byId = new Map(covCrlf.map(r => [r.id, r.line]));

    t('v21.10 Phase 3 (H17 — Anki CRLF, unclosed fences, & coverage ledger): splits CRLF pages/conditions, captures unclosed trailing fences without preamble pollution, and parses trailing period/dupes while rejecting #1.5 and multi-destinations',
      pageChunks.length === 2 &&
      condChunks.length === 2 &&
      unclosedLedger.cards.length === 1 &&
      unclosedLedger.ledger.includes('fact-1 -> line #1') &&
      unclosedWithPreamble.cards.length === 1 &&
      unclosedWithPreamble.cards[0].text === 'Check {{c1::pulse}}.' &&
      covCrlf.length === 4 &&
      byId.get('fact-1') === 5 &&
      byId.get('fact-2') === 2 &&
      Number.isNaN(byId.get('fact-3')) &&
      Number.isNaN(byId.get('fact-4')));
  }

  // ── H18: ankiAuditGroups single-scoping, unmapped exclusion, & cross-chunk dedupe ──
  {
    const bigText = (label) => (label + ' clinical monitoring threshold detail ').repeat(200);
    const kb = {
      conditions: [{
        name: 'Sepsis',
        facts: [
          { id: 'fact-1', text: bigText('FactOne'), tier: 1, latteBucket: 'Assess', sourceQuote: '' },
          { id: 'fact-2', text: bigText('FactTwo'), tier: 1, latteBucket: 'Treatments', sourceQuote: '' },
          { id: 'fact-3', text: bigText('FactThree'), tier: 1, latteBucket: 'Evaluate', sourceQuote: '' },
        ],
      }],
    };
    const snapshot = ENV.ankiSourceSnapshot(kb);
    const batch = { snapshot, chunkIds: [['fact-1', 'fact-2', 'fact-3']] };
    const cards = [
      { id: 'n1', chunk: 1, sourceLine: 1, text: 'Monitor {{c1::FactOne}}.', extra: '', tags: 'Tier::1', keep: true, pipeCount: 2, factIds: ['fact-1', 'fact-2'] },
      { id: 'n2', chunk: 1, sourceLine: 2, text: 'Monitor {{c1::FactThree}}.', extra: '', tags: 'Tier::1', keep: true, pipeCount: 2, factIds: ['fact-3'] },
      { id: 'n-unmapped', chunk: 1, sourceLine: 3, text: 'Unmapped {{c1::note}}.', extra: '', tags: 'Tier::1', keep: true, pipeCount: 2, factIds: [] },
      { id: 'n-cross', chunk: 2, sourceLine: 1, text: 'Cross chunk {{c1::FactOne}}.', extra: '', tags: 'Tier::1', keep: true, pipeCount: 2, factIds: ['fact-1'] },
    ];
    const groups = ENV.ankiAuditGroups(cards, batch, 'all', 3);
    const scopedCounts = new Map();
    for (const g of groups) for (const id of (g.scopeNoteIds || [])) scopedCounts.set(id, (scopedCounts.get(id) || 0) + 1);

    t('v21.10 Phase 3 (H18 — ankiAuditGroups partitioning): scopes every mapped note at most once, excludes unmapped notes from stripped partition scopes, and creates no duplicate fallback group for mapped cross-chunk notes',
      groups.length >= 2 &&
      scopedCounts.get('n1') === 1 &&
      scopedCounts.get('n2') === 1 &&
      scopedCounts.get('n-cross') === 1 &&
      !scopedCounts.has('n-unmapped') &&
      !groups.some(g => g.chunk === 2));
  }

  // ── H19: NCLEX-Extract & NCLEXToAnki parser/merger hardening ──
  {
    // 1. n2aConvertText kText truncation before second ## Questions
    const twoPartDoc = [
      '## Questions',
      '1. First question stem?',
      'A. Alpha',
      'B. Beta',
      '',
      '## Answer Key',
      '1. ANSWER: A',
      'Rationale: Alpha is correct.',
      '',
      '## Questions',
      '2. Leaked second section question?',
      'A. Gamma',
      'B. Delta',
      '',
      '## Answer Key',
      '2. ANSWER: C',
    ].join('\n');
    const n2aRes = ENV.n2aConvertText(twoPartDoc, 'test.md');
    const noLeak = n2aRes.cards.length === 1 && !JSON.stringify(n2aRes.cards[0]).includes('Leaked second section');

    // 2. nclexDropOptionRuns per-run resuming & trailing Q-number preservation
    const twoChap = [
      { num: 1, index: 0 },
      { num: 1, index: 25 }, { num: 2, index: 40 }, { num: 3, index: 55 }, { num: 4, index: 70 },
      { num: 2, index: 85 },
      { num: 3, index: 140 },
      { num: 1, index: 200 }, { num: 2, index: 280 }, { num: 3, index: 360 }, { num: 4, index: 440 },
    ];
    const dropped = ENV.nclexDropOptionRuns(twoChap);
    // Trailing Q5 guard: Q4 with 4 numbered choices followed by Q5 (at EOF, matching earlier 4-choice run length)
    const q4Then5 = [
      { num: 3, index: 0 },
      { num: 1, index: 20 }, { num: 2, index: 35 }, { num: 3, index: 50 }, { num: 4, index: 65 },
      { num: 4, index: 85 },
      { num: 1, index: 105 }, { num: 2, index: 120 }, { num: 3, index: 135 }, { num: 4, index: 150 },
      { num: 5, index: 170 },
    ];
    const q4Kept = ENV.nclexDropOptionRuns(q4Then5);

    // 3. nclexSplitByQNum loose requires whitespace after delimiter
    const looseSplit = ENV.nclexSplitByQNum('1. Give furosemide\n1.5 mg IV at\n08:00 daily.\n2. Reassess potassium.', { loose: true });

    // 4. i2aMergeAnswer worst legibility precedence
    const qMerge = { answer: '', legibility: 'unreadable', whys: [], rationale: '', extras: [], unreadable: [], flags: [] };
    ENV.i2aMergeAnswer(qMerge, { answer: 'B', legibility: 'uncertain', whys: [], rationale: 'Because B.', extras: [], unreadable: [] }, 'ans.png');

    // 5. i2aAssemble continuation stem -> last option, duplicate label merge, & pool ambiguity when later.length===0
    const norm = arr => arr.map(ENV.i2aNormalizeItem);
    const assembled = ENV.i2aAssemble([
      ['p0.png', norm([
        { number: 1, kind: 'answer_only', answer: 'A', overall_rationale: 'Key copy 1.' },
        { number: 1, kind: 'answer_only', answer: 'B', overall_rationale: 'Key copy 2.' },
      ])],
      ['p1.png', norm([
        { number: 1, kind: 'question', format: 'multiple_choice', stem: 'First Q?', options: [{ label: 'A', text: 'First part' }, { label: 'B', text: 'Other' }] },
      ])],
    ]);
    // Also test clean single-question continuation stem & duplicate option merge
    const contAsm = ENV.i2aAssemble([
      ['p1.png', norm([{ number: 1, kind: 'question', format: 'multiple_choice', stem: 'Stem?', options: [{ label: 'A', text: 'Start of A' }] }])],
      ['p2.png', norm([{ number: null, kind: 'continuation', stem: 'wrapped tail.', options: [{ label: 'A', text: 'more A' }, { label: 'B', text: 'Option B' }] }])],
    ]);

    t('v21.10 Phase 3 (H19 — NCLEX/i2a parsers): truncates n2a kText, keeps 2nd chapter & trailing Q5 in nclexDropOptionRuns, guards loose 1.5/08:00 splits, keeps unreadable legibility, and merges i2a continuations + duplicate-key ambiguity',
      noLeak &&
      dropped.map(x => x.num).join(',') === '1,2,3,1,2,3,4' &&
      q4Kept.map(x => x.num).join(',') === '3,4,5' &&
      Object.keys(looseSplit).length === 2 && looseSplit['1'].includes('1.5 mg') && looseSplit['1'].includes('08:00') &&
      qMerge.legibility === 'unreadable' &&
      assembled.questions[0].flags.some(f => /2 answer-key entries/i.test(f)) &&
      contAsm.questions[0].options[0][1] === 'Start of A wrapped tail. more A' &&
      contAsm.questions[0].options[1][1] === 'Option B');
  }

  // ── M8: Case & Anki numeric tokenizers ──
  {
    const painToks = ENV.caseNumericTokens('Client reports 10/10 chest pain.');
    const bpThresh = ENV.caseParseThresholds('Hold for BP < 90/60 mmHg.');
    const ixBp = new Map([['f-bp', { fact: { text: 'Hold for BP < 90/60 mmHg.', sourceQuote: '' } }]]);
    const bpInstErrs = [];
    ENV.caseAuditTextValues('BP 84/52 mmHg', ['f-bp'], ixBp, 'BP', bpInstErrs, 'instantiated');

    const badTail = ENV.caseNumericTokens('Give 5 mg/(kg 24 hr) total.');
    const clockToks = ENV.caseNumericTokens('Assess at 0800 hours and 1400 hrs.');

    const ageIssues = [];
    ENV.caseAuditDatumValues({ label: 'Age', value: '72 years', supportType: 'neutral-framing', factIds: [] }, new Map(), 'S1', ageIssues);

    const ankiPlurals = ENV.ankiNumericTokens('Infuse for 3 days, 24 hrs, 5 mg/m².');
    const ankiDotFrac = ENV.ankiNumericTokens('Administer .5/2 mg.');
    const ankiRecall = ENV.ankiRecallNumbers('Give .5 mg, repeat 5.0 mg on 1ST day.');

    t('v21.10 Phase 3 (M8 — numeric tokenizers): separates 10/10 pain from BP, parses slash BP thresholds, blocks unsupported tails & 24-hr clock times, exempts neutral-framing Age, aligns Unicode minus decimals, and handles Anki plural units/m²/.5 fractions',
      !painToks.tokens.some(x => x.unit === 'mmhg') &&
      bpThresh.length === 1 && bpThresh[0].op === '<' && bpThresh[0].value === 90 && bpThresh[0].unit === 'mmhg' &&
      bpInstErrs.length === 0 &&
      !badTail.tokens.some(x => x.key === '24 hr') && badTail.unsupported.length > 0 &&
      clockToks.tokens.length === 0 &&
      ageIssues.length === 0 &&
      ENV.caseDecimal('−5') === '-5' && ENV.ankiDecimal('−5') === '-5' &&
      ankiPlurals.tokens.some(x => x.key === '3 day') &&
      ankiPlurals.tokens.some(x => x.key === '24 hr') &&
      ankiPlurals.tokens.some(x => x.key === '5 mg/m2') &&
      ankiDotFrac.unsupported.length > 0 && ankiDotFrac.tokens.length === 0 &&
      JSON.stringify(ankiRecall) === JSON.stringify(['0.5', '5']));
  }

  // ── M9: KB ingestion, concept audit, dedupe, acronyms, envelope, operators, & dehyphenation ──
  {
    const verifyFocus = ENV.kbBuildFocusBlock('', 'Heart failure', '', 'scope', '', false, false, false, 'rn', true, true);
    const ordered = ENV.kbOrderByConcept([{ name: 'Solo', concept: '   ', facts: [] }, { name: 'HF', concept: 'Perfusion', facts: [] }]);

    const kbPatho = {
      conditions: [
        { name: 'Perfusion', concept: 'Perfusion', isConceptOverview: true, facts: [{ id: 'f1', text: 'Shared perfusion.', tier: 1, latteBucket: 'Assess' }] },
        { name: 'Heart Failure', concept: 'Perfusion', facts: [{ id: 'f2', text: 'Ventricular remodeling.', tier: 1, latteBucket: 'Patho', conceptScope: 'differentiator' }] },
      ],
    };
    const conceptAud = ENV.auditKbConcepts(kbPatho);
    const kbMd = ENV.renderKBMarkdown(kbPatho);

    // mergeLatteParts duplicate metadata & sibling hoisting precedence
    const merged = ENV.mergeLatteParts([
      {
        conditions: [{
          name: 'DKA', concept: 'Glucose',
          facts: [{ id: 'a1', text: 'Hold potassium if < 3.3 mEq/L.', tier: 2, latteBucket: 'Treatments', clinicalLayer: 'bridge', sourceQuote: '', sources: [{ filename: 'a.pdf', location: 'p1' }] }],
        }],
      },
      {
        conditions: [{
          name: 'DKA', concept: 'Glucose',
          facts: [{ id: 'a2', text: 'Hold potassium if < 3.3 mEq/L.', tier: 1, safetyCritical: true, latteBucket: 'Treatments', clinicalLayer: 'rn-core', trapRole: 'hold-triangle', sourceQuote: 'Hold K+ if < 3.3', sourceKind: 'table', sourceLabel: 'Table 2', sources: [{ filename: 'b.pdf', location: 'p2' }] }],
        }],
      },
    ]);
    const mf = merged.conditions[0].facts[0];

    // Case-sensitive 2-3 char acronym matching (lowercase "all"/"age"/"hit" must NOT match ALL/AGE/HIT)
    const condsAcronym = [{ name: 'ALL', concept: 'Cellular Regulation', facts: [] }, { name: 'HIT', concept: 'Clotting', facts: [] }];
    const inferred = ENV.kbInferEntityConcept({ name: 'Warfarin', notes: 'Monitor all patients of every age for any hit to platelets.' }, [], condsAcronym);
    const trapProj = ENV.kbProjectExamTraps(
      { name: 'DVT', facts: [{ id: 't1', text: 'Assess all patients of every age.', tier: 1, latteBucket: 'Assess' }] },
      { conditions: [{ name: 'ALL', facts: [] }, { name: 'HIT', facts: [] }] }
    );

    // Envelope optional array validation
    let badEnvThrew = false;
    try { ENV.kbValidateExtractionEnvelope({ conditions: [], medications: 'not-an-array' }); } catch (e) { badEnvThrew = /medications must be an array/i.test(e.message); }
    const okEnv = ENV.kbValidateExtractionEnvelope({ conditions: [], medications: [] });

    // Operators & dehyphenation
    const canon = ENV.kbCanonOperators('pH <= 7.35 and K+ >= 5.5');
    const opMismatch = ENV.kbQuoteOperatorsAgree('Hold digoxin if HR < 60', ENV.kbCanonOperators('Hold digoxin if HR < 600'), ENV.kbCanonOperators('Hold digoxin if HR < 600'));
    const dehyphNums = ENV.kbDehyphNormForMatch('Normal range 18-\n65 years; hypo-\ntension');

    t('v21.10 Phase 3 (M9 — KB accuracy): emits {"missed":[]} in verify focus, guards whitespace concepts, recognizes Patho differentiators, preserves duplicate metadata, enforces case-sensitive short acronyms, validates optional arrays, orders <=/>= canon, and keeps 18-\\n65 separated',
      verifyFocus.includes('{"missed":[]}') && !verifyFocus.includes('{"conditions":[]}') &&
      ordered.length === 2 &&
      conceptAud.missingDifferentiatorExemplars.length === 0 &&
      kbMd.includes('Ventricular remodeling.') &&
      mf.safetyCritical === true && mf.tier === 1 && mf.sourceQuote === 'Hold K+ if < 3.3' && mf.sourceKind === 'table' && mf.trapRole === 'hold-triangle' && mf.clinicalLayer !== 'bridge' &&
      !inferred &&
      !(trapProj && trapProj.traps || []).some(tr => /\b(ALL|HIT)\b/.test(String(tr.contrastWith || ''))) &&
      badEnvThrew && !!okEnv &&
      canon.includes('lte') && canon.includes('gte') &&
      opMismatch === false &&
      dehyphNums.includes('18 65') && dehyphNums.includes('hypotension'));
  }

  // ── M10: Priority parsers (parseAndNumberPoints + paParseTiers) ──
  {
    const t0 = Date.now();
    const dashRes = ENV.parseAndNumberPoints('-'.repeat(10000) + '\np53 tumor suppressor pathway\nP450 hepatic enzyme inhibition\nP2 purinergic receptor\nP1: Explicit point prefix');
    const elapsed = Date.now() - t0;

    const tierDoc = [
      '## TIER 1 — Must Know',
      '- Airway obstruction warning signs',
      '### TIER 2 — Should Know',
      '- Secondary lab monitoring',
      '## TIER 3 — Good to Know',
      '- Rare genetic variant',
      '## Study Strategy',
      '### Tier 1 Drill',
      '- Review airway protocols first.',
      '***Audit: all priority points verified***',
    ].join('\n');
    const parsed = ENV.paParseTiers(tierDoc);

    t('v21.10 Phase 3 (M10 — Priority parsers): preserves p53/P450/P2, finishes 10,000-dash line in <50ms, keeps ### Tier 1 Drill inside strategy, supports ### TIER 2, and parses ***Audit:...***',
      elapsed < 50 &&
      dashRes.some(p => p.text.startsWith('p53 tumor suppressor')) &&
      dashRes.some(p => p.text.startsWith('P450 hepatic enzyme')) &&
      dashRes.some(p => p.text.startsWith('P2 purinergic receptor')) &&
      dashRes.some(p => p.text === 'Explicit point prefix') &&
      parsed &&
      parsed.tier1.includes('Airway obstruction') && !parsed.tier1.includes('Review airway protocols') &&
      parsed.tier2.includes('Secondary lab monitoring') &&
      parsed.strategy.includes('### Tier 1 Drill') &&
      parsed.audit.includes('all priority points verified'));
  }

  // ── M11: Card payload white fill + >15MB scale===1 re-encode, cardKey, cardCompareRuns, & i2aFileKey SHA-256 ──
  {
    // Mock canvas + createImageBitmap on globalThis for cardFilePayload
    const origCIB = globalThis.createImageBitmap, origDoc = globalThis.document, origFR = globalThis.FileReader;
    const ops = [];
    const bigPng = { name: 'transparent-card.png', size: ENV.CARD_MAX_INLINE_BYTES + 1024, type: 'image/png', arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x04, 0x00, 0, 0, 0x03, 0x00]).buffer };
    globalThis.createImageBitmap = async () => ({ width: 1024, height: 768, close() { ops.push('close'); } });
    globalThis.document = {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({
          set fillStyle(v) { ops.push('fillStyle:' + v); },
          fillRect(x, y, w, h) { ops.push(`fillRect:${x},${y},${w},${h}`); },
          drawImage() { ops.push('drawImage'); },
        }),
        toDataURL: (mime, q) => { ops.push(`toDataURL:${mime}:${q}`); return 'data:image/jpeg;base64,' + Buffer.from('jpeg-bytes').toString('base64'); },
      }),
    };
    let payloadRes;
    try {
      payloadRes = await ENV.cardFilePayload(bigPng);
    } finally {
      globalThis.createImageBitmap = origCIB;
      globalThis.document = origDoc;
      globalThis.FileReader = origFR;
    }

    const k1 = ENV.cardKey({ category: '  Pharm  ', title: 'Digoxin   Toxicity' });
    const k2 = ENV.cardKey({ category: 'pharm', title: 'digoxin toxicity' });

    const runA = { category: 'Pharm', title: 'Digoxin', sections: [{ heading: 'Signs', bullets: ['Nausea', 'Nausea'] }], numerics: [{ value: '0.8' }] };
    const runB = { category: 'Pharm', title: 'Digoxin Toxicity', sections: [{ heading: 'Findings', bullets: ['Nausea'] }], numerics: [{ value: '0.8' }] };
    const cmp = ENV.cardCompareRuns([runA, runB]);

    // Pure-JS FIPS 180-4 SHA-256 fallback when crypto.subtle is unavailable (file://)
    const prevCrypto = globalThis.crypto;
    let emptySha = '', abcSha = '';
    try {
      Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true, writable: true });
      emptySha = await ENV.i2aFileKey({ name: 'empty.png', size: 0, arrayBuffer: async () => new Uint8Array(0).buffer });
      abcSha = await ENV.i2aFileKey({ name: 'abc.png', size: 3, arrayBuffer: async () => new TextEncoder().encode('abc').buffer });
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: prevCrypto, configurable: true, writable: true });
    }

    t('v21.10 Phase 3 (M11 — Card payload, comparison, & pure-JS SHA-256): paints #ffffff and re-encodes >15MB scale===1 PNGs, normalizes cardKey, catches title/heading/bullet multiplicity drift, and matches FIPS 180-4 SHA-256 without crypto.subtle',
      payloadRes && payloadRes.mimeType === 'image/jpeg' &&
      ops.includes('fillStyle:#ffffff') &&
      ops.some(o => o.startsWith('fillRect:0,0,1024,768')) &&
      ops.some(o => o.startsWith('toDataURL:image/jpeg:')) &&
      k1 === k2 &&
      cmp.titleDisagree === true && cmp.bulletsUnstable.length >= 3 && cmp.bulletCounts.join(',') === '2,1' &&
      emptySha === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' &&
      abcSha === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  }

  // ── M12a: Case validation, shuffling, sibling exclusion, repair, review rows, & quota detection ──
  {
    const ix = new Map([['f1', { fact: { text: 'Give 2 mg/kg.', sourceQuote: '' } }]]);
    const oneOpt = {
      condition: 'Test',
      stages: [{
        stageNumber: 1, data: [],
        questions: [{ id: 'q1', type: 'MCQ', stem: 'Pick.', options: [{ label: 'A', text: 'Only one' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Give 2 mg/kg.', supportType: 'direct', factIds: ['f1'] }] }],
      }],
    };
    const oneOptErrs = ENV.validateCaseStudy(oneOpt, ix, new Set(['f1']), 'Test');

    const calcInst = {
      condition: 'Test',
      stages: [{
        stageNumber: 1,
        data: [{ label: 'Weight', value: '50 kg', supportType: 'neutral-framing', availability: 'revealed', factIds: [] }],
        questions: [{
          id: 'q1', type: 'Calculation', stem: 'Calculate dose.',
          options: [{ label: 'Answer', text: '____' }],
          correctAnswers: ['100 mg'],
          rationales: [{ option: 'Answer', text: '50 kg × 2 mg/kg = 100 mg.', supportType: 'instantiated', factIds: ['f1'] }],
        }],
      }],
    };
    const calcErrs = ENV.validateCaseStudy(calcInst, ix, new Set(['f1']), 'Test').filter(i => i.sev === 'error');

    // caseShuffleQuestion: positional phrase guard + nonstandard label guard + ordinary "first action" still shuffles
    const posQ = { type: 'MCQ', stem: 'Select.', options: [{ label: 'A', text: 'One' }, { label: 'B', text: 'All of the above' }], correctAnswers: ['B'], rationales: [{ option: 'A', text: 'Wrong.' }, { option: 'B', text: 'Right.' }] };
    const firstTwoQ = { type: 'MCQ', stem: 'Select.', options: [{ label: 'A', text: 'First two actions together' }, { label: 'B', text: 'Wait' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Right.' }, { option: 'B', text: 'Wrong.' }] };
    const clinicalFirstQ = { type: 'MCQ', stem: 'What is the nurse\'s first action?', options: [{ label: 'A', text: 'Assess airway' }, { label: 'B', text: 'Document later' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Right.' }, { option: 'B', text: 'Wrong.' }] };
    const customLblQ = { type: 'MCQ', stem: 'Select.', options: [{ label: '1', text: 'One' }, { label: '2', text: 'Two' }], correctAnswers: ['1'], rationales: [{ option: '1', text: 'Right.' }, { option: '2', text: 'Wrong.' }] };
    const shPos = ENV.caseShuffleQuestion(posQ, () => 0.1);
    const shFirst = ENV.caseShuffleQuestion(firstTwoQ, () => 0.1);
    const shClinFirst = ENV.caseShuffleQuestion(clinicalFirstQ, () => 0.1);
    const shCust = ENV.caseShuffleQuestion(customLblQ, () => 0.1);

    // 3-letter sibling exclusion (DKA vs HHS) + selectCaseFactsMulti standalone entity auto-link
    const dka = { name: 'DKA', concept: 'Glucose', facts: [{ id: 'd1', text: 'Ketones positive in DKA.', tier: 1, latteBucket: 'Tests' }] };
    const hhs = { name: 'HHS', concept: 'Glucose', facts: [{ id: 'h1', text: 'Severe hyperosmolarity in HHS.', tier: 1, latteBucket: 'Tests' }] };
    const dkaSel = ENV.selectCaseFacts(dka, { allConditions: [dka, hhs] });
    const kbMulti = {
      conditions: [dka, hhs],
      medications: [{ name: 'Regular Insulin', linkedConditions: ['DKA'], facts: [{ id: 'm1', text: 'IV regular insulin lowers glucose in DKA.', tier: 1, latteBucket: 'Treatments' }] }],
    };
    const viewMulti = ENV.kbFactView(kbMulti);
    const multiSel = ENV.selectCaseFactsMulti([dka, hhs], { allConditions: viewMulti.conditions });

    // caseRepairContract non-array guard, caseReviewRows NaN stageNumber, isQuotaError boundary
    const repContract = ENV.caseRepairContract(
      { stages: [{ stageNumber: 1, questions: [{ id: 'q1', type: 'MCQ', correctAnswers: 'A', rationales: null }] }] },
      { stages: [{ stageNumber: 1, questions: [{ id: 'q1', type: 'MCQ', correctAnswers: ['A'], rationales: [] }] }] }
    );
    const revRows = ENV.caseReviewRows({ stages: [{ stageNumber: NaN, questions: [{ id: 'q1', type: 'MCQ', stem: 'S', options: [{ label: 'A', text: 'X' }, { label: 'B', text: 'Y' }], correctAnswers: ['A'], rationales: [] }] }] }, {}, 'ready');

    t('v21.10 Phase 3 (M12a — Case validation, shuffling, selection & guards): enforces >=2 options, keeps calc instantiated rationale, guards positional/custom shuffles, excludes 3-letter siblings, auto-links multi entities, and guards repair/review/isQuotaError',
      oneOptErrs.some(i => i.sev === 'error' && /at least 2/i.test(i.msg)) &&
      calcErrs.length === 0 &&
      shPos.options[1].text === 'All of the above' && !!shPos.shuffleNotice &&
      shFirst.options[0].text === 'First two actions together' && !!shFirst.shuffleNotice &&
      !shClinFirst.shuffleNotice && shClinFirst.options[0].text === 'Document later' &&
      shCust.options[0].label === '1' && !!shCust.shuffleNotice &&
      !dkaSel.some(f => f.id === 'h1') &&
      multiSel.some(f => f.id === 'm1') &&
      typeof repContract === 'string' && repContract.length > 0 &&
      revRows.length === 1 && revRows[0].number === 'Q1.1' &&
      ENV.isQuotaError(new Error('HTTP 429 Too Many Requests')) === true &&
      ENV.isQuotaError({ status: 429, message: 'slow down' }) === true &&
      ENV.isQuotaError(new Error('Citation error on fact-429')) === false);
  }

  // ── M12b: NCLEX-Gen worksheet, binomial wraps, Case Packet paired layout, & Batch Queue ──
  {
    const groups = [{ name: 'HF', facts: [{ id: 'f1', text: 'Weigh daily.', tier: 1, pointAnchors: ['P1'] }] }];
    const fp = ENV.ngFocusPlan(groups, { points: 'P1: Daily weights; report > 2 lb/day: notify provider' });
    const hasP1 = Array.isArray(fp.plan) && fp.plan[0].includes('f1') && fp.items.some(it => it.facts.includes('f1'));

    // validateNCLEXWorksheet catches omitted DISTRIBUTION type/tier
    const wsOmit = [
      'PART 1: FOCUS SUMMARY', 'Summary.',
      'PART 2: PRACTICE QUESTIONS',
      '1. Stem one?\nA. One\nB. Two\nC. Three\nD. Four',
      '2. Stem two?\nA. One\nB. Two\nC. Three\nD. Four',
      'PART 3: ANSWER KEY',
      '1. A', '2. B',
      'PART 4: RATIONALES',
      '1. ANSWER: A\nA is right (Source: f1).\nTags: Tier 1 | MCQ',
      '2. ANSWER: B\nB is right (Source: f1).\nTags: Tier 1 | MCQ',
      'DISTRIBUTION: Tier [1:1 2:0 3:0] | Types [MCQ:1]',
    ].join('\n');
    const wsIssues = ENV.validateNCLEXWorksheet(wsOmit, 2, { allowTypes: ['MCQ'], allowTiers: [1] });

    // Binomial organism wrapped lines ("C. difficile", "E. coli")
    const orgBlock = { num: 1, text: '1. Which precaution is required for a patient with\nC. difficile diarrhea?\nA. Contact precautions with soap and water\n   due to\n   C. difficile spores\nB. Airborne precautions\nC. Droplet precautions\nD. Standard only' };
    const parsedOrg = ENV.ngParseItem(orgBlock);
    const shufWs = [
      'PART 1: FOCUS SUMMARY', 'Summary.',
      'PART 2: PRACTICE QUESTIONS',
      '1. Which infection causes watery diarrhea?\nA. Infection caused by\n   E. coli O157:H7\nB. Infection caused by\n   C. difficile spores\nC. Influenza A\nD. Norovirus',
      'PART 3: ANSWER KEY',
      '1. A',
      'PART 4: RATIONALES',
      '1. A is correct. B is wrong. C is wrong. D is wrong.',
      'DISTRIBUTION: Tier [1:1 2:0 3:0] | Types [MCQ:1]',
    ].join('\n');
    const shufOut = ENV.ngShuffleWorksheetOptions(shufWs, () => 0.99);

    // casePacketToMarkdown paired layout keeps provenance on key half only
    const pktMd = ENV.casePacketToMarkdown([{
      id: 'c1', condition: 'HF', status: 'ok',
      provenance: { genModel: 'gemini-4-neon', genLevel: 'high' },
      caseStudy: {
        condition: 'HF',
        stages: [{
          stageNumber: 1, data: [{ label: 'Weight', value: 'Gain 3 lb', factIds: ['f1'] }],
          questions: [{ id: 'q1', type: 'MCQ', stem: 'Action?', options: [{ label: 'A', text: 'Call' }, { label: 'B', text: 'Wait' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Notify.', factIds: ['f1'] }] }],
        }],
      },
    }], { layout: 'paired', includeProvenance: true });
    const [wsHalf, keyHalf] = pktMd.split('<div class="pagebreak"></div>');

    // caseBuildBatchTargets ID-less conditions & overlapping concepts
    const cNoId1 = { name: 'Alpha', concept: 'C1', facts: Array.from({ length: 8 }, (_, i) => ({ id: 'a' + i, text: 'Alpha fact ' + i, tier: 1, latteBucket: 'Assess' })) };
    const cNoId2 = { name: 'Beta', concept: 'C1', facts: Array.from({ length: 8 }, (_, i) => ({ id: 'b' + i, text: 'Beta fact ' + i, tier: 1, latteBucket: 'Assess' })) };
    const bt = ENV.caseBuildBatchTargets({
      conditions: [cNoId1, cNoId2],
      resolvedConditions: [cNoId1, cNoId2],
      concepts: ['C1', 'C1'],
      batchUnit: 'concepts', mixConceptExemplars: true,
    });

    // caseRunBatchQueue clears onStatus(null) via finally even when runOne throws
    const statuses = [];
    let threw = false;
    try {
      await ENV.caseRunBatchQueue({
        targets: [{ id: 't1', name: 'HF' }],
        runOne: async () => { throw new Error('boom'); },
        onStatus: (s) => statuses.push(s),
      });
    } catch (_) { threw = true; }

    t('v21.10 Phase 3 (M12b — NCLEX-Gen, Packet, & Batch Queue): preserves [P#] anchors, checks DISTRIBUTION total, spares C. difficile/E. coli wraps, keeps paired provenance off student half, dedupes ID-less batch targets, and clears onStatus on throw',
      hasP1 &&
      wsIssues.some(i => /DISTRIBUTION/i.test(i.msg || String(i))) &&
      parsedOrg.options.length === 4 && parsedOrg.options[0].text.includes('C. difficile spores') &&
      shufOut && shufOut.text.includes('C. difficile spores') && shufOut.text.includes('E. coli O157:H7') &&
      wsHalf && keyHalf && !wsHalf.includes('gemini-4-neon') && keyHalf.includes('gemini-4-neon') &&
      bt.targets.length === 1 &&
      threw && statuses[statuses.length - 1] === null);
  }

  // ── M13a: Anki style cache, extra-cloze warning, provenance, & contrast tag checks ──
  {
    const cache = ENV.ankiCreateStyleCache();
    const card = { id: 'c1', text: 'Short {{c1::ans}}.', extra: '', tags: 'Tier::1', pipeCount: 2 };
    const w1 = cache(card);
    card.extra = 'Hidden {{c1::extra cloze}}.';
    const w2 = cache(card);
    const nullCache = cache(null);
    const nullLint = ENV.lintAnkiCard(null);

    const prov = ENV.ankiNoteProvenance([{ id: 'n1', conditionTagNormalizations: [{ noteId: 'n1', status: 'repaired', from: 'Condition::DM', to: 'Condition::DiabetesMellitus' }] }]);
    const ev = await ENV.ankiSourceAuditEvidence({
      status: 'complete', model: 'm', thinkingLevel: 'low', groups: [], results: [], responses: [],
      cards: [{ id: 'n1', text: 'A {{c1::b}}.', extra: '', tags: 'Tier::1', conditionTagNormalizations: [{ status: 'repaired', from: 'Condition::DM', to: 'Condition::DiabetesMellitus' }] }],
      batch: { snapshot: { facts: [], byId: {} } }, tier: 'all',
    }, () => ({ cards: [], batch: null, tier: 'all', current: false }));

    // Contrast tag owner collision & disconnected twin-contrast graph + Scope::Contrast sibling requirement
    const snapContrast = ENV.ankiSourceSnapshot({
      conditions: [
        { name: 'Perfusion', concept: 'Perfusion', isConceptOverview: true, facts: [{ id: 'f-ov', text: 'Overview.', tier: 1, latteBucket: 'Assess' }] },
        { name: 'DKA', concept: 'Glucose', facts: [{ id: 'f-dka', text: 'Ketones.', tier: 1, latteBucket: 'Tests' }] },
        { name: 'HHS', concept: 'Glucose', facts: [{ id: 'f-hhs', text: 'No ketones.', tier: 1, latteBucket: 'Tests' }] },
        { name: 'Sepsis', concept: 'Infection', facts: [{ id: 'f-sep', text: 'Fever.', tier: 1, latteBucket: 'Assess' }] },
      ],
    });
    const twinDisconnected = ENV.ankiConditionTagCheck(
      { id: 'c-tw', text: 'Compare {{c1::DKA}} vs Sepsis.', tags: 'Tier::1 Topic::Contrast', factIds: ['f-dka', 'f-sep'] },
      snapContrast
    );
    const ovPlusOne = [{ id: 'c-ov', text: 'Overview + DKA {{c1::test}}.', tags: 'Tier::1', factIds: ['f-ov', 'f-dka'] }];
    ENV.ankiStampConceptTags(ovPlusOne, snapContrast);

    t('v21.10 Phase 3 (M13a — Anki cache, extra-cloze, provenance & contrast): invalidates cache on in-place edit, guards null, flags extra-cloze warning, preserves from/to & plural conditionTagNormalizations, and rejects disconnected twin contrast & overview+1 Scope::Contrast',
      !w1.some(x => x.code === 'extra-cloze') &&
      w2.some(x => x.code === 'extra-cloze') &&
      Array.isArray(nullCache) &&
      nullLint.includes('no-cloze') &&
      prov[0].conditionTagNormalizations[0].from === 'Condition::DM' &&
      prov[0].conditionTagNormalizations[0].to === 'Condition::DiabetesMellitus' &&
      Array.isArray(ev.noteProvenance[0].conditionTagNormalizations) &&
      ev.noteProvenance[0].conditionTagNormalizations[0].from === 'Condition::DM' &&
      twinDisconnected.status === 'review' &&
      !ovPlusOne[0].tags.includes('Scope::Contrast'));
  }

  // ── M13b: NCLEX-Extract & NCLEXToAnki edge fixes ──
  {
    const admitted = ENV.nclexAdmitRecord({ question: 'Valid stem?', correct_answer: 'A', rationale: '   \n\t  ' });
    const hybrid = ENV.nclexSplitStemOptions('Which vitamin aids calcium absorption? A. Vitamin A\nB. Vitamin B12\nC. Vitamin C\nD. Vitamin D. Monitor serum calcium.');
    const vitDSentence = ENV.nclexSplitStemOptions('Explain the role of vitamin D. Also review dietary sources.');
    const mergedPairs = ENV.nclexMergePairs([{ number: '#12', question: 'Q12 stem?' }], [{ number: 'Q12', question: 'Q12 stem?', answer: 'C', rationale: 'Because C.' }]);

    // TOC front-matter "Answers" before "Questions"
    const tocSpan = ENV.nclexMatchSplitTocSpans([
      { title: 'How to Use Answers', startPage: 2, depth: 0 },
      { title: 'Practice Questions', startPage: 10, depth: 0 },
      { title: 'Answers and Rationales', startPage: 25, depth: 0 },
    ], 40);

    // 1-page PDF range seed doesn't invert aRanges (start <= end)
    let seededA = null;
    const seedFn = new Function('nclexInspectPdfSplitLayout',
      span('function nclexSeedPdfRanges(', '/* ── END NCLEX EXTRACTOR PURE HELPERS ── */') + ';return nclexSeedPdfRanges;'
    )(async () => ({ numPages: 1, split: null }));
    seedFn(
      { name: 'onepage.pdf' },
      {
        isStale: () => false, firstFileRef: { current: null }, id: 'id1',
        setPageCount: () => {}, setIRanges: () => {}, setMode: () => {},
        setQRanges: () => {}, setARanges: (r) => { seededA = r; },
        setSplitAutoNote: () => {},
      }
    );
    await new Promise(r => setImmediate(r));

    // n2aParseKey doesn't overwrite key.answer on rationale "Answer:" and dedupes why_order
    const pk = ENV.n2aParseKey('ANSWER: B\nWhy A is incorrect: wrong.\nWhy A is incorrect: repeated note.\nWhy B is correct: right.\nRationale:\nAnswer: always check airway first.');
    // n2aStripSources /m per-line
    const strippedMulti = ENV.n2aStripSources('Line 1 (Source: Ch 1 — "quote one")\nLine 2 (Source: Ch 2 — "quote two")');
    // x2aBlocks ignores mid-stem bold number jump without blank line
    const xb = ENV.x2aBlocks('**1.** First stem mentions\n**5.** milligrams inline.\n\n**2.** Second stem.', /^\*\*(\d+)\.\*\*/gm);
    // n2aPdfQuestionLines preserves single inline blank
    const pdfQ = ENV.n2aPdfQuestionLines('The normal potassium range is ____ mEq/L in adults.', '');
    // i2aNormalizeItem strips balanced (A) -> A
    const normItem = ENV.i2aNormalizeItem({ number: 1, kind: 'question', stem: 'Stem?', options: [{ label: '(A)', text: 'Alpha' }, { label: '(B)', text: 'Beta' }] });
    // i2aAiCacheKey separates keyed-answer rationale mode from unkeyed answer mode
    const kUnkeyed = ENV.i2aAiCacheKey({ stem: 'S', options: [['A', '1']], answer: '' }, 'm');
    const kKeyed = ENV.i2aAiCacheKey({ stem: 'S', options: [['A', '1']], answer: 'A' }, 'm');
    // i2aBuildCards scans rationale/whys/extras for [?], skips empty Source::, dedupes tags
    const builtRes = ENV.i2aBuildCards([{
      number: 1, format: 'multiple_choice', legibility: 'clean', stem: 'Stem?', options: [['A', 'Alpha'], ['B', 'Beta']],
      answer: 'A', rationale: 'Check [?] dose.', whys: [], extras: [], unreadable: [], flags: [], images: ['p1.png'],
    }], '   ', ['DupTag', 'DupTag']);
    const builtTags = Array.isArray(builtRes.cards[0].tags) ? builtRes.cards[0].tags : String(builtRes.cards[0].tags || '').split(/\s+/);
    // i2aConvert sets result.stopped on AI halt and dedupes identical pending cache keys
    let aiCalls = 0, aiPromptItems = 0;
    const convRes = await ENV.i2aConvert({
      images: [
        { key: 'k1', name: 'img1.png', payload: async () => ({ mimeType: 'image/png', data: 'AA==' }) },
        { key: 'k2', name: 'img2.png', payload: async () => ({ mimeType: 'image/png', data: 'BB==' }) },
      ],
      gemini: async (parts, think) => {
        if (think !== 'high') return { items: [{ number: 1, kind: 'question', format: 'multiple_choice', stem: 'Same stem?', options: [{ label: 'A', text: 'One' }, { label: 'B', text: 'Two' }] }] };
        aiCalls++;
        aiPromptItems = (String(parts[0]?.text || '').match(/Same stem\?/g) || []).length;
        throw Object.assign(new Error('HTTP 429 rate limited'), { isQuota: true });
      },
      halts: (e) => !!e.isQuota,
      model: 'gemini-4-hydrogen',
      cache: { images: {}, ai: {} },
      deck: 'NCLEX',
      aiAnswers: true,
    });

    t('v21.10 Phase 3 (M13b — NCLEX-Extract & NCLEXToAnki edge fixes): trims blank rationale, parses hybrid/vitamin-D stems, merges Q12, skips front-matter TOC, seeds 1-page ranges safely, protects n2aParseKey/n2aStripSources/x2aBlocks/n2aPdfQuestionLines, normalizes (A), isolates i2aAiCacheKey, flags [?] in rationale, and sets result.stopped with deduped AI pending',
      !admitted.rationale &&
      hybrid.options.length === 4 &&
      vitDSentence.options.length === 0 &&
      mergedPairs.filled === 1 && mergedPairs.pairs[0].number === 12 && mergedPairs.pairs[0].answer === 'C' &&
      tocSpan && tocSpan.qRanges[0].start === 10 && tocSpan.aRanges[0].start === 25 &&
      Array.isArray(seededA) && seededA.length === 1 && seededA[0].start === 1 && seededA[0].end === 1 &&
      pk.answer === 'B' && pk.why_order.filter(x => x === 'A').length === 1 &&
      !strippedMulti[0].includes('Source:') &&
      xb.length === 2 &&
      pdfQ.length === 1 && pdfQ[0].includes('____') &&
      normItem.options[0][0] === 'A' &&
      kUnkeyed !== kKeyed &&
      builtTags.includes('NeedsReview') && !builtTags.some(x => x.startsWith('Source::')) &&
      builtTags.filter(x => x === 'DupTag').length === 1 &&
      typeof convRes.stopped === 'string' && convRes.stopped.includes('429') && aiCalls === 1 && aiPromptItems === 1);
  }
};
