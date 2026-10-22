'use strict';

module.exports = function runV190PointAnchorTests(S, t) {
  const span = (start, end) => {
    const a = S.indexOf(start), b = S.indexOf(end, a + start.length);
    if (a < 0 || b <= a || S.indexOf(start, a + 1) >= 0) {
      throw new Error('v19.0 extraction anchor moved: ' + start);
    }
    return S.slice(a, b);
  };

  const kbSpan = span('function kbBuildFocusBlock(', '// ── Durable Knowledge Base persistence');
  const vSpan = span('function validateLatteKnowledgeBase(', '\nfunction kbBucketFacts(');
  const ankiSpan =
    span('function kbSourceText(f){', 'function renderKBMarkdown(kb){') + '\n' +
    span('function ankiExactMergeKey(card){', 'const LINT_LABEL=') +
    span('function kbForAnki(kb){', '// ── KB source chunking') +
    span('function ankiParseCards(raw', 'function ankiChunkFactIds(');
  const nclexSpan = span('const NCLEX_OPTION_GAP=400;', 'function nclexBatchPairs(');
  const n2aSpan = span('// ──── TOOL: NCLEX to Anki ────', 'async function i2aFileKey(');
  const indexSpan = span('function buildFactIndex(kb){', 'const STUDY_OUTPUT_POLICY=');
  const pdfLayoutSpan = span('function pdfLayoutText(tc){', 'function kbTextQuality(units){');
  const citeSpan = span('function formatFactCitation(fact){', 'let _uidN=0;');
  const pptxSpan = span('const _OOXML_A_NS =', 'function _xmlElementsByLocalName(');
  const jsonSpan = span('function extractJSON(text){', '// PDF text extraction (shared)');
  const mdSpan = span('function markdownToPlainText(md){', '// Shared export helpers');
  const quoteSpan = span('function kbNormForMatch(', 'async function kbPageComposition(');
  const paSpan = span('function paParseTiers(text){', 'function paResultNotice(');
  const accumSpan = span('function nclexKey(q){', 'function nclexNewTrack(');
  const ngFocusSpan = span('function ngAllocateBatch(', 'const NG_GROUNDING_ADAPTER=');
  const ankiFocusSpan = span('  // Build optional focus context block\n  function buildFocusBlock(){', '\n\n  const run=useCallback(async()=>{');
  const caseShuffleSpan = span('const ITEM_LETTER_NOUN=', 'function ngShuffleWorksheetOptions(') + '\n' +
    span('function caseShuffleQuestion(q,random=Math.random){', 'function caseShuffleIssues(');

  const H = new Function(
    'uid',
    'DOMParser',
    'PPTX_LIMITS',
    'caseContentWords',
    indexSpan + '\n' + pdfLayoutSpan + '\n' + citeSpan + '\n' + pptxSpan + '\n' + jsonSpan + '\n' + mdSpan + '\n' + kbSpan + '\n' + vSpan + '\n' + quoteSpan + '\n' + paSpan + '\n' + ankiSpan + '\n' + accumSpan + '\n' + nclexSpan + '\n' + n2aSpan + '\n' + ngFocusSpan + '\n' + caseShuffleSpan + '\n' +
    'const runAnkiFocus=(outcomes,points,focusContext,K)=>(function(){' + ankiFocusSpan + ';return buildFocusBlock();})();\n' +
    'return {buildFactIndex,findFactById,getFactUsage,getExt,pdfLayoutText,formatFactCitation,_pptxAssertXml,_pptxRunText,_zipNormalizePath,extractJSON,markdownToPlainText,KB_SOURCE_ANCHOR_RULES,kbBuildFocusBlock,parseAndNumberPoints,formatPointsForPrompt,buildKbFactItemSchema,auditKbFacts,runPointAnchorHarness,kbStripPointTags,kbExtractPointAnchors,normalizeKbEntities,mergeLatteParts,kbNormalizeImported,validateLatteKnowledgeBase,kbFactView,kbSourceText,kbProvenanceText,kbNormForMatch,kbDehyphNormForMatch,kbClassifyQuoteMiss,paParseTiers,paMergeTopics,kbForPriority,kbForAnki,ankiParseCards,ankiSourceSnapshot,ankiDedupeCards,ankiConditionTagCheck,nclexAdmitRecord,nclexAccumulate,nclexDropOptionRuns,nclexSplitStemOptions,nclexRepairOptions,nclexMergePairs,n2aSplitStemOptions,n2aSplitBlocks,n2aStripSources,n2aAnswerLabels,x2aBlocks,x2aParseExport,x2aResolveAnswer,x2aSplitRationale,x2aBuildCard,i2aAnswerLabels,i2aApplyAi,i2aBuildCards,i2aWorksheetMd,i2aConvert,ngAllocateBatch,ngFocusItems,ngFocusIndex,ngFocusMatch,ngFocusPlan,ngFocusSummary,runAnkiFocus,caseShuffleQuestion};'
  )(
    () => 'card-uid-1',
    class { parseFromString(xml) { return { getElementsByTagName: tag => tag === 'parsererror' && xml.includes('<parsererror') ? [{}] : [], getElementsByTagNameNS: () => [] }; } },
    { textChars: 10000 },
    s => String(s || '').toLowerCase().match(/[a-z]{3,}/g) || []
  );

  // 1. Built-in harness executes and passes all internal assertions
  const harnessOut = H.runPointAnchorHarness();
  t('v19.0 built-in runPointAnchorHarness passes all internal assertions',
    harnessOut === 'ALL HARNESS ASSERTIONS PASSED');

  // 2. parseAndNumberPoints heading filters & dotted number regex
  const parsed = H.parseAndNumberPoints([
    '# Fluid and Electrolytes',
    '**Potassium Imbalances**:',
    'Nursing Priorities:',
    '2.1 Hypokalemia causes and U waves on 12-lead ECG',
    '2.2. Hyperkalemia peaked T waves and IV calcium gluconate',
    'P9 — 2 L/min O2 via nasal cannula for COPD',
    '• Hold digoxin if apical pulse < 60 bpm'
  ].join('\n'));
  t('parseAndNumberPoints skips headings and preserves dotted prefixes and clinical numbers',
    parsed.length === 4 &&
    parsed[0].id === 'P1' && parsed[0].text === 'Hypokalemia causes and U waves on 12-lead ECG' &&
    parsed[1].id === 'P2' && parsed[1].text === 'Hyperkalemia peaked T waves and IV calcium gluconate' &&
    parsed[2].id === 'P3' && parsed[2].text === '2 L/min O2 via nasal cannula for COPD' &&
    parsed[3].id === 'P4' && parsed[3].text === 'Hold digoxin if apical pulse < 60 bpm');

  t('formatPointsForPrompt formats P1..Pn lines cleanly',
    H.formatPointsForPrompt(parsed) === [
      'P1: Hypokalemia causes and U waves on 12-lead ECG',
      'P2: Hyperkalemia peaked T waves and IV calcium gluconate',
      'P3: 2 L/min O2 via nasal cannula for COPD',
      'P4: Hold digoxin if apical pulse < 60 bpm'
    ].join('\n'));

  // 3. buildKbFactItemSchema dynamic enum with NONE escape hatch
  const schema = H.buildKbFactItemSchema(parsed.slice(0, 2));
  t('buildKbFactItemSchema locks pointAnchors enum to exact Point IDs plus NONE',
    schema.type === 'OBJECT' &&
    schema.required.join(',') === 'fact,pointAnchors' &&
    schema.properties.pointAnchors.minItems === 1 &&
    schema.properties.pointAnchors.items.enum.join(',') === 'P1,P2,NONE' &&
    schema.properties.sourcePage.nullable === true);

  // 4. auditKbFacts even-length median, deduplication, partial invalid array, and >2x median bleed detection
  const auditEven = H.auditKbFacts(parsed, [
    { id: 'fact-1', text: 'F1', pointAnchors: ['P1', 'P1'] },
    { id: 'fact-2', text: 'F2', pointAnchors: ['P1', 'P2'] },
    { id: 'fact-3', text: 'F3', pointAnchors: ['P1'] },
    { id: 'fact-4', text: 'F4', pointAnchors: ['P1'] },
    { id: 'fact-5', text: 'F5', pointAnchors: ['P1', 'P99'] },
    { id: 'fact-6', text: 'F6', pointAnchors: ['NONE'] },
    { id: 'fact-7', text: 'F7', pointAnchors: [] }
  ]);
  // Counts: P1=5, P2=1, P3=0, P4=0 -> sorted [0, 0, 1, 5] -> median = 0.5 -> bleedCutoff = max(1, 1) = 1 -> P1 (5 > 1) is bleed suspect
  t('auditKbFacts deduplicates repeated tags, catches partial bad arrays, and computes >2x median bleed suspects',
    auditEven.countsByPoint.P1 === 5 &&
    auditEven.countsByPoint.P2 === 1 &&
    auditEven.countsByPoint.P3 === 0 &&
    auditEven.countsByPoint.P4 === 0 &&
    auditEven.uncoveredPoints.map(p => p.id).join(',') === 'P3,P4' &&
    auditEven.medianCount === 0.5 &&
    auditEven.bleedCutoff === 1 &&
    auditEven.bleedSuspectPoints.length === 1 &&
    auditEven.bleedSuspectPoints[0].id === 'P1' &&
    auditEven.bleedSuspectPoints[0].factCount === 5 &&
    auditEven.flaggedFacts.map(f => f.flagReason).join('|') === 'INVALID_ID:P99|UNMAPPED_NONE|EMPTY_ANCHORS');

  // 5. kbBuildFocusBlock injects numbered Points and KB_SOURCE_ANCHOR_RULES
  const focus = H.kbBuildFocusBlock('1. Master electrolytes', '2.1 Hypokalemia\n2.2 Hyperkalemia', 'Ch. 14 only', 'prioritize');
  t('kbBuildFocusBlock numbers atomic Points and injects SOURCE & ANCHOR RULES with [NONE] escape hatch',
    focus.includes('P1: Hypokalemia\nP2: Hyperkalemia') &&
    focus.includes('SOURCE & ANCHOR RULES:') &&
    focus.includes('Strict Point-ID Mapping (With [NONE] Escape Hatch)') &&
    focus.includes('Inverse Consolidation (Multi-Anchor Allowed)') &&
    focus.includes('Zero-Tolerance Exclusion List'));

  // 6. mergeLatteParts and kbNormalizeImported extract/preserve pointAnchors and numberedPoints
  const merged = H.mergeLatteParts([{
    source: { filename: 'lecture.pdf', range: 'pp. 1–2' },
    conditions: [{
      name: 'Hypokalemia & Hyperkalemia',
      facts: [
        { latteBucket: 'Look', text: 'Hypokalemia causes prominent U waves while hyperkalemia causes tall peaked T waves [P1, P2].', tier: 1, sourcePointer: { filename: 'lecture.pdf', location: 'p. 1' }, sourceQuote: 'prominent U waves and tall peaked T waves' },
        { latteBucket: 'Assess', text: 'Unrelated epidemiology note.', pointAnchors: ['NONE'], tier: 3, sourcePointer: { filename: 'lecture.pdf', location: 'p. 2' }, sourceQuote: 'unrelated note' }
      ]
    }]
  }], 'NUR 201', 'Exam 1', parsed.slice(0, 2));

  t('mergeLatteParts strips trailing [P#] tags from prose into pointAnchors and persists numberedPoints',
    Array.isArray(merged.numberedPoints) && merged.numberedPoints.length === 2 &&
    merged.conditions[0].facts[0].text === 'Hypokalemia causes prominent U waves while hyperkalemia causes tall peaked T waves.' &&
    merged.conditions[0].facts[0].pointAnchors.join(',') === 'P1,P2' &&
    merged.conditions[0].facts[1].pointAnchors.join(',') === 'NONE');

  const roundTrip = H.kbNormalizeImported(JSON.parse(JSON.stringify(merged))).kb;
  t('kbNormalizeImported preserves numberedPoints and pointAnchors across JSON import/restore',
    Array.isArray(roundTrip.numberedPoints) && roundTrip.numberedPoints.length === 2 &&
    roundTrip.conditions[0].facts[0].pointAnchors.join(',') === 'P1,P2' &&
    roundTrip.conditions[0].facts[1].pointAnchors.join(',') === 'NONE');

  // 7. kbForAnki and ankiParseCards strip [P#] and [NONE] tags
  const ankiPacket = H.kbForAnki({
    conditions: [{
      name: 'Hypokalemia',
      aliases: [],
      facts: [{ id: 'fact-1', latteBucket: 'Look', tier: 1, text: 'Prominent U waves on ECG [P1, P2].', sources: [{ filename: 'lecture.pdf', location: 'p. 1' }] }]
    }]
  });
  t('kbForAnki strips residual [P#] tags from fact text before Anki generation',
    ankiPacket.includes('FACT fact-1 | LATTE: Look | Tier: 1 | Prominent U waves on ECG. | Source: lecture.pdf, p. 1') &&
    !ankiPacket.includes('[P1'));

  const parsedCards = H.ankiParseCards('```text\nThe hallmark ECG finding of hypokalemia is {{c1::prominent U waves}} [P1]. | Contrast with tall peaked T waves [P2, P3] | Condition::Hypokalemia Nursing::LATTE::Look Tier::1\n```\n```text\nfact-1 -> line #1\n```', 1, 'hierarchical-v1');
  t('ankiParseCards strips [P#] and [NONE] tags from card Text and Extra',
    parsedCards.cards.length === 1 &&
    parsedCards.cards[0].text === 'The hallmark ECG finding of hypokalemia is {{c1::prominent U waves}}.' &&
    parsedCards.cards[0].extra === 'Contrast with tall peaked T waves');

  // 8. Step 7 4-category Anki adapter contract
  const { extractPromptLiteral } = require('./repo-checks');
  const adapter = new Function(extractPromptLiteral(S, 'kbAdapter').declaration + ';return kbAdapter;')();
  t('Anki kbAdapter enforces all 4 exam-testable LATTE categories, front-anchored clozes, closed sets, and priority grounding',
    adapter.includes('1. Clinical Discriminators:') &&
    adapter.includes('2. Exact Numeric Parameters:') &&
    adapter.includes('3. Direct Clinical Associations:') &&
    adapter.includes('4. Nursing Interventions & Patient Education (LATTE T & E):') &&
    adapter.includes('Front-Anchored Clozes:') &&
    adapter.includes('Closed Sets vs. Open Symptom Lists:') &&
    adapter.includes("[Increased ICP] Cushing's triad (three classic findings):") &&
    adapter.includes('Strict Source Grounding for Priorities & Thresholds:'));

  // 9. Phase 1 review fixes — C1: NCLEX-to-Anki clinical answer-keying (decimals, word boundaries, single-label non-collision)
  const doseOpts = [['A', '0.5 mg'], ['B', '5 mg']];
  const coughOpts = [['A', 'Productive cough'], ['B', 'Nonproductive cough']];
  const mlOpts = [['1', '0.5 mL'], ['2', '1.5 mL'], ['3', '2 mL'], ['4', '2.5 mL']];
  const clientOpts = [['A', 'A client with wheezing'], ['B', 'A client with stridor']];
  t('C1: n2aAnswerLabels, x2aResolveAnswer, and i2aAnswerLabels preserve decimal points ("0.5 mg" != "5 mg")',
    H.n2aAnswerLabels('Give 0.5 mg IV', doseOpts).join(',') === 'A' &&
    H.x2aResolveAnswer('Give 0.5 mg IV', doseOpts)[0].join(',') === 'A' &&
    H.i2aAnswerLabels('Give 0.5 mg IV', doseOpts).join(',') === 'A');
  t('C1: n2aAnswerLabels, x2aResolveAnswer, and i2aAnswerLabels enforce word boundaries ("Nonproductive cough" != "Productive cough")',
    H.n2aAnswerLabels('The answer is nonproductive cough', coughOpts).join(',') === 'B' &&
    H.x2aResolveAnswer('The answer is nonproductive cough', coughOpts)[0].join(',') === 'B' &&
    H.i2aAnswerLabels('The answer is nonproductive cough', coughOpts).join(',') === 'B');
  t('C1: n2aAnswerLabels and i2aAnswerLabels do not misread "2 mL" as choice 2 or "A client..." as choice A',
    H.n2aAnswerLabels('2 mL', mlOpts).join(',') === '3' &&
    H.i2aAnswerLabels('2 mL', mlOpts).join(',') === '3' &&
    H.n2aAnswerLabels('A client with stridor', clientOpts).join(',') === 'B' &&
    H.i2aAnswerLabels('A client with stridor', clientOpts).join(',') === 'B');

  // 10. Phase 1 review fixes — H1, H2, H3, H5, M2, M3, M12: Point-ID & Entity Normalization hardening
  const edgePts = H.parseAndNumberPoints('P1 —\n- **Electrolytes**:\n1. \n- Section Header:\n2.1 Hypokalemia');
  t('M12: parseAndNumberPoints filters out bare prefixes and bulleted headings after prefix stripping',
    edgePts.length === 1 && edgePts[0].id === 'P1' && edgePts[0].text === 'Hypokalemia' &&
    H.kbBuildFocusBlock('', '# Heading Only\n- **Subheading**:', '', 'prioritize') === '');

  const decStr = H.kbStripPointTags('Administer .5 mg IV [P1] [P2] .');
  const snap = H.ankiSourceSnapshot({ conditions: [{ name: 'C', aliases: [], facts: [{ id: 'fact-1', latteBucket: 'Treatments', tier: 1, text: 'Administer .5 mg IV [P1].', sources: [null, { filename: 'f.pdf', location: 'p. 1' }] }] }] });
  const tagCard = H.ankiParseCards('```text\nAdminister .5 mg IV [P1]. | Monitor HR [NONE] | Condition::C [P1] Tier::1\n```', 1);
  t('M2: kbStripPointTags, ankiParseCards (including tags), and ankiSourceSnapshot preserve leading-dot decimals and strip [P#]/[NONE]',
    decStr === 'Administer .5 mg IV.' &&
    snap.byId['fact-1'].text === 'Administer .5 mg IV.' &&
    snap.byId['fact-1'].sources.length === 1 &&
    tagCard.cards[0].text === 'Administer .5 mg IV.' &&
    tagCard.cards[0].tags === 'Condition::C Tier::1');

  const extractedAnchors = H.kbExtractPointAnchors('Monitor potassium [P2].', ['[P1]', 'P2, P3', 'NONE']);
  t('M3: kbExtractPointAnchors normalizes bracketed/comma anchors, deduplicates, and drops NONE when paired with real P# IDs',
    extractedAnchors.text === 'Monitor potassium.' &&
    extractedAnchors.pointAnchors.join(',') === 'P1,P2,P3');

  const entityMerged = H.mergeLatteParts([{
    source: { filename: 'ch1.pdf', range: 'pp. 3–4' },
    conditions: [{ name: 'α-β', facts: [{ latteBucket: 'Look', text: 'Finding [NONE].', tier: 1, sourcePointer: { filename: 'ch1.pdf', location: 'p. 3' } }, { latteBucket: 'Look', text: 'Finding [P1].', tier: 1, sourcePointer: { filename: 'ch1.pdf', location: 'p. 4' } }] }],
    medications: [{ name: 'Furosemide', mechanism: 'Loop diuretic [P1]', facts: [null, { text: 123 }, { text: 'Give slowly [P2].', latteBucket: 'Treatments', tier: 1, sources: [null] }] }],
    diagnostics: [{ name: 'BMP', purpose: 'Electrolyte panel [P1]' }]
  }], 'NUR', 'E1', [{ id: 'P1', text: 'Diuretics' }, { id: '   ', text: 'Empty' }]);
  const greekRestored = H.kbNormalizeImported(JSON.parse(JSON.stringify(entityMerged)), { restore: true }).kb;
  t('H1/H2/H5: mergeLatteParts and normalizeKbEntities bind chunk sourcePointer, strip entity [P#] tags, filter bad facts/sources, and restore non-ASCII condition slugs',
    entityMerged.numberedPoints.length === 1 &&
    entityMerged.conditions[0].facts[0].pointAnchors.join(',') === 'P1' &&
    entityMerged.medications[0].facts.length === 1 &&
    entityMerged.medications[0].facts[0].text === 'Give slowly.' &&
    entityMerged.medications[0].facts[0].pointAnchors.join(',') === 'P2' &&
    entityMerged.medications[0].facts[0].sources[0].filename === 'ch1.pdf' &&
    entityMerged.diagnostics[0].facts[0].text === 'BMP — purpose: Electrolyte panel' &&
    entityMerged.diagnostics[0].facts[0].pointAnchors.join(',') === 'P1' &&
    entityMerged.diagnostics[0].facts[0].sources[0].location === 'pp. 3–4' &&
    greekRestored.conditions[0].id === 'condition' &&
    H.kbSourceText({ sources: [null, { filename: 'a.pdf', location: 'p. 1' }] }) === 'a.pdf, p. 1' &&
    H.validateLatteKnowledgeBase({ conditions: [{ name: 'C', facts: [{ id: 'fact-1', latteBucket: 'Treatments', tier: 1, text: 'Give 5 mg IV.', safetyCritical: true, sources: [null] }] }] }).some(i => i.severity === 'error'));

  // 11. Phase 1 review fixes — H6, H7, H8, H9, H10: Build gate, QuotaStop, no-op repair, and option/block splitting
  t('H6/H7/H8: KnowledgeBaseBuilder gates untranscribed cards and pointAudit; NCLEXGenerator gates auditInterrupted, rejects no-op repairs, and refreshes citedAll',
    S.includes('const untranscribedCards=files.filter(cardIsImage).some(f=>!transcripts[cardFileId(f)]);') &&
    S.includes('const nothingToBuild=untranscribedCards||(onlyCardSources&&!cardGate.buildable.length);') &&
    S.includes('const hasAnyAnchors=allFacts.some(f=>Array.isArray(f.pointAnchors)&&f.pointAnchors.length>0);') &&
    S.includes("const persistedPts=!points.trim()&&Array.isArray(K.knowledgeBase?.numberedPoints)?K.knowledgeBase.numberedPoints:[];") &&
    S.includes("if(repairable.length&&!auditInterrupted){") &&
    S.includes("throw new Error('repair returned an unchanged item')") &&
    S.includes("const strat=(keyRaw.match(/^\\s*Strategy:[\\s\\S]*?(?=\\n\\s*Tags:|(?![\\s\\S]))/m)||[])[0]||'';"));

  const q5Pos = [
    { num: 4, index: 0 },
    { num: 1, index: 50 }, { num: 2, index: 100 }, { num: 3, index: 150 }, { num: 4, index: 200 },
    { num: 5, index: 300 },
    { num: 6, index: 900 }
  ];
  const keptPos = H.nclexDropOptionRuns(q5Pos);
  const inlineSplit = H.n2aSplitStemOptions('Which temperature is elevated? A. 98.6 F. B. 101.3 F. C. 99.1 F. D. 97.8 F.', false);
  const crossTypeSplit = H.nclexSplitStemOptions('Which action is priority? A. Give 1. B. Give 2. C. Give 3. D. Give 4.');
  const boldAnsBlocks = H.n2aSplitBlocks('**1.** ANSWER: A\nWhy A is correct: ok.\n\n**3.** ANSWER: B\nWhy B is correct: ok.\n\n**3.** ANSWER: C');
  t('H9/H10: nclexDropOptionRuns keeps non-numeric Q5 after Q4 choices, n2aSplitStemOptions skips inline "101.3 F.", and n2aSplitBlocks handles bold ANSWER keys with gaps/duplicates',
    keptPos.map(p => p.num).join(',') === '4,5,6' &&
    inlineSplit[1].length === 4 && inlineSplit[1][1][1] === '101.3 F.' &&
    crossTypeSplit.options.length === 4 &&
    boldAnsBlocks.length === 3 && boldAnsBlocks[1][0] === 3 && boldAnsBlocks[2][2] === true);

  // 12. Phase 2 review fixes — M4..M14, L1, L2
  const dupGroups = [
    { condition: 'Shared Name', facts: [{ id: 'f-1', text: 'First group target' }, { id: 'f-2', text: 'First group neighbor' }] },
    { condition: 'Shared Name', facts: [{ id: 'f-3', text: 'Second group target' }, { id: 'f-4', text: 'Second group neighbor' }] }
  ];
  const allocDup = H.ngAllocateBatch(dupGroups, new Set(['f-1', 'f-2']), { want: 1, perCondition: 2, neighborCap: 1, start: 1 });
  const focusCleaned = H.ngFocusItems('# Unit 1\n**Electrolytes**:\nNursing Priorities:\n2.1 Hypokalemia U waves\nP2: Hyperkalemia peaked T waves');
  const outcomeWarn = H.ngFocusSummary([{ kind: 'outcome', text: 'Unmatched learning outcome', matched: false, facts: [] }]);
  t('M4/L2: ngAllocateBatch pulls neighbor context from the actual hit group when condition names collide, ngFocusItems skips headings/prefixes, and ngFocusSummary warns when 0 outcomes match',
    allocDup.targets.length === 1 && allocDup.targets[0].id === 'f-3' &&
    allocDup.context.length === 1 && allocDup.context[0].id === 'f-4' &&
    focusCleaned.join('|') === 'Hypokalemia U waves|Hyperkalemia peaked T waves' &&
    outcomeWarn && outcomeWarn.t === 'warn');

  const shufQ = H.caseShuffleQuestion({
    id: 'q1', type: 'MCQ', stem: 'Question stem?\nOption\nA stays on its own line.',
    options: [{ label: 'A', text: 'First' }, { label: 'B', text: 'Second' }, { label: 'C', text: 'Third' }, { label: 'D', text: 'Fourth' }],
    correctAnswers: ['A'],
    rationales: [
      { option: 'A', text: 'Option  A is right.', supportType: 'direct', factIds: ['fact-1'] },
      { option: 'B', text: 'Choice B is wrong.', supportType: 'direct', factIds: ['fact-1'] },
      { option: 'C', text: 'Answer C is wrong.', supportType: 'direct', factIds: ['fact-1'] },
      { option: 'D', text: 'Option D is wrong.', supportType: 'direct', factIds: ['fact-1'] }
    ]
  }, () => 0);
  t('M5/M6: validateCaseStudy resolves option-label Calculation answers and caseShuffleQuestion preserves horizontal spacing without matching across newlines',
    S.includes("const optMatch=(q.options||[]).find(o=>String(o.label||'').trim()===rawAns.trim());") &&
    shufQ.stem.includes('Option\nA stays') &&
    shufQ.rationales.find(r => r.option === 'D').text === 'Option  D is right.');

  const srcText = 'Administer 0.5 mg IV push slowly over two minutes.';
  const srcNorm = H.kbNormForMatch(srcText), srcDehyph = H.kbDehyphNormForMatch(srcText);
  const srcMarks = { norm: H.kbNormForMatch(srcText, true), dehyph: H.kbDehyphNormForMatch(srcText, true) };
  t('M7: kbClassifyQuoteMiss forwards decimal marks so "5 mg IV push" inside "0.5 mg IV push" classifies as numericBoundary',
    H.kbClassifyQuoteMiss('5 mg IV push slowly', srcNorm, srcDehyph, new Set(srcNorm.split(' ')), srcMarks) === 'numericBoundary');

  const upperFence = H.extractJSON('Prose with {bad brace\n```JSON\n{"ok":1}\n```');
  const multiLineStart = H.extractJSON('Intro {bad\n  {still bad\n  {"good":2}');
  t('M8/M9: extractJSON handles uppercase ```JSON fences and retries later line-start braces, and geminiRequest maps gRPC codes and retains bestPartial',
    upperFence.ok === 1 && multiLineStart.good === 2 &&
    S.includes('const grpcMap={3:400,4:504,7:403,8:429,13:500,14:503,16:401') &&
    S.includes('failure.partialText=text||bestPartial;'));

  const ruleOnlyTiers = H.paParseTiers('## TIER 1 — Must Know\n---\n## TIER 2 — Should Know\n---\n## Study Strategy\n---');
  const mergedH2 = H.paMergeTopics(['## Heart Failure\n- Watch weight', '## heart failure\n- Watch weight\n- Check lungs']);
  t('M10: paParseTiers rejects rule-only tier sections, paMergeTopics merges H2 topic headings, and PriorityAnalyzer counts kbFactView facts',
    ruleOnlyTiers === null &&
    mergedH2 === '## Heart Failure\n- Watch weight\n- Check lungs' &&
    S.includes('kbUsableFactCount(kbFactView(K.knowledgeBase))} facts ready'));

  const accSeen = new Set(), accAll = [];
  H.nclexAccumulate(accSeen, accAll, [{ question_number: 1, question: 'What is the priority action for this client?', correct_answer: '', rationale: 'No answer for this question was found on the answer pages.', answer_unmatched: true }], {});
  H.nclexAccumulate(accSeen, accAll, [{ question_number: 1, question: 'What is the priority action for this client?', correct_answer: 'B', rationale: 'Assess airway first.' }], {});
  const strippedSrc = H.n2aStripSources('Give oxygen (2 L/min) via cannula. (Source: C1 — "Give oxygen 2 L/min")');
  const parsedUnext = H.x2aParseExport('# Questions\n\n## Questions\n\n**1.** Stem?\nA. One\nB. Two\n\n## Answer Key\n\n**1.** (not extracted)\n\nNo answer for this question was found on the answer pages.');
  const builtUnmatched = H.x2aBuildCard({ num: 1, question: 'Stem?\nA. One\nB. Two\nC. Three\nD. Four', answer: '', rationale: 'No answer for this question was found on the answer pages.' }, 'src', []);
  const splitCaseInsensitive = H.x2aSplitRationale('Preface. option A is wrong. option B is right. Test-Taking Strategy: focus on airway.', [['A', 'One'], ['B', 'Two']]);
  const aiQs = [{ number: 1, format: 'multiple_choice', stem: 'Stem?', options: [['A', 'One'], ['B', 'Two']], answer: 'B', whys: [], rationale: '', extras: [], flags: [], images: ['img.png'] }];
  const qidKey = Object.keys((() => { const c = {}; return c; })());
  t('M11: nclexAccumulate upgrades unmatched answers, n2aStripSources keeps earlier parens, x2a handles unmatched placeholders & mixed-case trailers, and i2aApplyAi strips trailing label punctuation',
    accAll[0].correct_answer === 'B' && accAll[0].rationale === 'Assess airway first.' && !accAll[0].answer_unmatched &&
    strippedSrc[0] === 'Give oxygen (2 L/min) via cannula.' && strippedSrc[1] === 'Give oxygen 2 L/min' &&
    parsedUnext.records[0].answer === '' &&
    builtUnmatched[0].tags.includes('NeedsReview') &&
    splitCaseInsensitive[1] && splitCaseInsensitive[1].get('A').includes('option A is wrong.') &&
    splitCaseInsensitive[2] === 'Test-Taking Strategy: focus on airway.' &&
    S.includes("i2aS(w.label).replace(/[.)]+$/,'').toUpperCase()") &&
    void qidKey === undefined);

  const citedWithProv = H.formatFactCitation({
    text: 'Hold digoxin for apical pulse < 60 bpm.',
    sourceQuote: 'Hold digoxin if apical pulse < 60',
    sources: [{ filename: 'medsurg.pdf', location: 'p. 102' }],
    sourceKind: 'table',
    sourceLabel: 'Table 14-2',
    printedPage: '98'
  });
  const plainMd = H.markdownToPlainText('Range 5---10 mg\n\n---\n\n<div class="pagebreak"></div>\n\n## Answer Key');
  let pptxThrew = false;
  try { H._pptxRunText('<parsererror>bad xml</parsererror>'); } catch (e) { pptxThrew = /malformed XML/i.test(e.message); }
  t('M13/M14/L1/L2: formatFactCitation includes provenance, markdownToPlainText preserves pagebreak rule and inline dashes, _pptxRunText rejects parsererror XML, and buildKbFactItemSchema includes LATTE properties',
    citedWithProv === '"Hold digoxin if apical pulse < 60" — medsurg.pdf (p. 102) · Table 14-2 · printed p. 98' &&
    plainMd.includes('Range 5---10 mg') && plainMd.includes('\n---\n') &&
    pptxThrew &&
    Array.isArray(schema.properties.latteBucket.enum) && schema.properties.latteBucket.enum.length === 6);

  // 13. Phase 3 edge-case hardening
  const idx = H.buildFactIndex({ conditions: [{ name: 'C', facts: [{ id: '', text: 'No ID' }, { id: 'fact-7', text: 'Has ID' }] }] });
  const usageEmpty = H.getFactUsage({ ankiNotes: [{ id: 'n1', factIds: [''] }] }, '');
  const pdfNegCoord = H.pdfLayoutText({ items: [{ str: 'First', transform: [12, 0, 0, 12, -1, -1], width: 20 }, { str: 'Second', transform: [12, 0, 0, 12, 30, -1], width: 20 }] });
  const mlPrio = H.kbForPriority({ conditions: [{ name: 'C', aliases: [], facts: [{ id: 'fact-1', latteBucket: 'Look', tier: 1, text: 'Line 1\nLine 2', sources: [{ filename: 'a.pdf', location: 'p. 1' }] }] }] });
  t('Phase 3: buildFactIndex/findFactById/getFactUsage ignore empty factIds, getExt returns "" for extensionless names, pdfLayoutText handles -1 coordinates, and kbForPriority collapses embedded newlines',
    idx.size === 1 && H.findFactById(idx, '') === null && H.findFactById(idx, 'fact-7').fact.text === 'Has ID' &&
    usageEmpty.anki.length === 0 &&
    H.getExt('README') === '' && H.getExt('.gitignore') === '' && H.getExt('deck.pptx') === 'pptx' &&
    pdfNegCoord === 'First Second' &&
    mlPrio.includes('- Line 1 Line 2 [KB fact-1; LATTE Look; source-tier T1; a.pdf, p. 1]'));

  const admitQ12 = H.nclexAdmitRecord({ question_number: 'Q12', question: 'Stem?' });
  const admitHash = H.nclexAdmitRecord({ question_number: '#7', question: 'Stem?' });
  const repColon = H.nclexRepairOptions({ question_number: 12, question: 'Q 12 Which lab is monitored with furosemide?' }, '12: Which lab is monitored with furosemide?\nA. Sodium\nB. Potassium\nC. Calcium');
  const mergedColon = H.nclexMergePairs([{ number: 12, question: '12: Which lab is monitored with furosemide?', answer: '', matched: false }], [{ number: 12, question: 'Q 12 Which lab is monitored with furosemide?', answer: 'B' }]);
  const capFirst = H.ngAllocateBatch([{ condition: 'C', facts: [{ id: 'f1', text: '1' }, { id: 'f2', text: '2' }, { id: 'f3', text: '3' }] }], new Set(), { want: 3, perCondition: 2, neighborCap: 0, first: ['f1', 'f2', 'f3'] });
  t('Phase 3: nclexAdmitRecord parses "Q12"/"#7", nclexRepairOptions & nclexMergePairs strip "Q 12 "/"12: ", ngAllocateBatch caps firstIds at perCondition, and i2aConvert/FactInspectorDrawer/exportAsPdf guards are wired',
    admitQ12.question_number === 12 && admitHash.question_number === 7 &&
    repColon.options_repaired === true && mergedColon.collisions === 0 && mergedColon.filled === 1 &&
    capFirst.targets.map(f => f.id).join(',') === 'f1,f2,f3' &&
    H.ngAllocateBatch([
      { condition: 'C1', facts: [{ id: 'f1', text: '1' }, { id: 'f2', text: '2' }, { id: 'f3', text: '3' }] },
      { condition: 'C2', facts: [{ id: 'g1', text: '4' }] }
    ], new Set(), { want: 3, perCondition: 2, neighborCap: 0, first: ['f1', 'f2', 'f3'] }).targets.map(f => f.id).join(',') === 'f1,f2,g1' &&
    S.includes('if(todo.length&&aiAnswers)warnings.push(...i2aApplyAi(questions,cache.ai,model));') &&
    S.includes('},[factId]);') &&
    S.includes("||\'export\')}</title>"));

  // 14. Phase 4 lifecycle, parser, and UI hardening
  const admitMlMeta = H.nclexAdmitRecord({
    question: 'Stem?',
    correct_answer: 'B.\nPotassium',
    rationale: 'Line 1\nLine 2',
    priority_nursing_tip: 'Check K+\nbefore dose',
    test_taking_strategy: 'Use ABCs\nfirst',
    clinical_judgment_skill: 'Recognize\nCues'
  });
  const ordExport = H.x2aParseExport([
    '# NCLEX Practice Questions',
    '**2 questions** read from question images.',
    '## Questions',
    '**1.** Order the steps.',
    '1. First',
    '2. Second',
    '**2.** Next question?',
    'A. One',
    'B. Two',
    '## Answer Key',
    '**1.** 1, 2',
    '',
    '**1.** Step one rationale  ',
    '**2.** Step two rationale',
    '',
    '---',
    '',
    '**2.** A',
    '',
    'Option A is correct. Option A explains one. Option B explains two.'
  ].join('\n'));
  const splitPrefaced = H.x2aSplitRationale(
    'Option B is correct. Option A is wrong because of X. Option B is right because of Y.',
    [['A', 'One'], ['B', 'Two']]
  );
  const noAiAnsQ = [{ number: '1', stem: 'Stem?', options: [['A', '1'], ['B', '2']], answer: '', format: 'multiple_choice', images: ['p1.png'], flags: [], whys: [], rationale: '', extras: [], unreadable: [], legibility: 'clean', ai: { mode: 'answer', whys: [], rationale: '', strategy: '', agrees: null, dispute: '' } }];
  const noAiCards = H.i2aBuildCards(noAiAnsQ, 'src');
  const noAiWs = H.i2aWorksheetMd(noAiAnsQ);
  t('Phase 4: nclexAdmitRecord collapses newlines in single-line metadata, x2aBlocks ignores inline ordering rationales, x2aSplitRationale splits prefaced option words, and i2aBuildCards/i2aWorksheetMd/boot/pdfWalkPages/ResultsHead guards hold',
    admitMlMeta.correct_answer === 'B. Potassium' &&
    admitMlMeta.priority_nursing_tip === 'Check K+ before dose' &&
    admitMlMeta.test_taking_strategy === 'Use ABCs first' &&
    admitMlMeta.clinical_judgment_skill === 'Recognize Cues' &&
    admitMlMeta.rationale === 'Line 1\nLine 2' &&
    ordExport.records.length === 2 &&
    ordExport.records[0].rationale.includes('Step two rationale') &&
    ordExport.records[1].answer === 'A' &&
    splitPrefaced[0] === 'Option B is correct.' &&
    splitPrefaced[1] instanceof Map && splitPrefaced[1].get('A').includes('wrong') && splitPrefaced[1].get('B').includes('right') &&
    noAiCards.warnings[0].includes('AI returned no answer for it') &&
    noAiWs.md.includes('No answer in the images; AI returned no answer for it.') &&
    S.includes("if(!window.Babel||!window.React||!window.ReactDOM||!window.marked||!window.DOMPurify||!window.pdfjsLib||!window.JSZip){bootFail('One or more required CDN scripts failed to load.');return;}") &&
    S.includes("{count!=null&&count!==''&&count!==false&&<span className=\"results-count\">{count}</span>}") &&
    S.includes('txAbortRef.current?.abort();if(busy)abortRef.current?.abort();'));

  // 15. Phase 5: cross-chunk pointAnchors union, kbBuildFocusBlock deduplication, Anki buildFocusBlock runtime, and ngFocusPlan batchCaps
  const multiChunkMerged = H.mergeLatteParts([
    { source: { filename: 'p1.pdf', range: 'p. 1' }, conditions: [{ name: 'Hypokalemia', facts: [{ latteBucket: 'Look', text: 'Prominent U waves on ECG [P1].', tier: 1, sourcePointer: { filename: 'p1.pdf', location: 'p. 1' } }] }] },
    { source: { filename: 'p1.pdf', range: 'p. 2' }, conditions: [{ name: 'Hypokalemia', facts: [{ latteBucket: 'Look', text: 'Prominent U waves on ECG [P2].', tier: 1, sourcePointer: { filename: 'p1.pdf', location: 'p. 2' } }] }] }
  ], 'NUR', 'E1', [{ id: 'P1', text: 'ECG' }, { id: 'P2', text: 'K+' }]);
  const dedupedExtra = H.kbBuildFocusBlock('', '1. Hypokalemia', 'Custom note\nSOURCE & ANCHOR RULES:\nAlready present', 'prioritize');
  const ankiLocalFocus = H.runAnkiFocus('', '1. Hypokalemia\n2. Digoxin', '', { knowledgeBase: {} });
  const ankiPersistedFocus = H.runAnkiFocus('', '', '', { knowledgeBase: { numberedPoints: [{ id: 'P1', text: 'Saved point' }] } });
  const ankiHeadingOnly = H.runAnkiFocus('', '# Heading Only', '', { knowledgeBase: {} });
  const cappedFocusPlan = H.ngFocusPlan([
    { condition: 'Hypokalemia', aliases: [], facts: [{ id: 'k1', text: 'Hypokalemia U waves' }, { id: 'k2', text: 'Hypokalemia weakness' }] },
    { condition: 'Hyperkalemia', aliases: [], facts: [{ id: 'h1', text: 'Hyperkalemia peaked T waves' }, { id: 'h2', text: 'Hyperkalemia calcium gluconate' }] }
  ], { points: 'Hypokalemia\nHyperkalemia', batches: 2, perItem: 2, batchCaps: [4, 1] });
  t('Phase 5: mergeLatteParts unions P1+P2 across chunks, kbBuildFocusBlock avoids duplicating SOURCE & ANCHOR RULES, Anki buildFocusBlock formats local/persisted Points, and ngFocusPlan respects batchCaps',
    multiChunkMerged.conditions[0].facts.length === 1 &&
    multiChunkMerged.conditions[0].facts[0].pointAnchors.join(',') === 'P1,P2' &&
    dedupedExtra.split('SOURCE & ANCHOR RULES:').length === 2 &&
    ankiLocalFocus.includes('P1: Hypokalemia\nP2: Digoxin') &&
    ankiPersistedFocus.includes('P1: Saved point') &&
    ankiHeadingOnly === '' &&
    cappedFocusPlan.plan[0].length === 2 && cappedFocusPlan.plan[1].length === 1 &&
    S.includes("if(b<numBatches&&focus.plan[b-1]?.length){const deferred=focus.plan[b-1].filter(id=>!usedFactIds.has(id));if(deferred.length)focus.plan[b]=[...deferred,...(focus.plan[b]||[])];}"));

  // 16. Phase 8: OPC URI decoding, markdown bold non-bridging, useCappedLog cap enforcement, Step/Disclose 0-guards, N2A PDF abort & remove/clear guards, and CaseStudyGenerator conditionId reset
  const unclosedBold = H.markdownToPlainText('**unclosed and **closed** bold');
  const wordFollowedBold = H.markdownToPlainText('**span1**a and **span2**');
  t('Phase 8: _zipNormalizePath decodes URI-encoded OPC targets, markdownToPlainText prevents bold span bridging, and useCappedLog/Step/Disclose/NCLEXToAnki/CaseStudyGenerator guards hold',
    H._zipNormalizePath('ppt/presentation.xml', 'slides/slide%201.xml') === 'ppt/slides/slide 1.xml' &&
    H._zipNormalizePath('ppt/slides/slide1.xml', '../notesSlides/notesSlide%201%20%28final%29.xml') === 'ppt/notesSlides/notesSlide 1 (final).xml' &&
    H._zipNormalizePath('ppt/presentation.xml', 'slides/bad%ZZ.xml') === 'ppt/slides/bad%ZZ.xml' &&
    unclosedBold === '**unclosed and closed bold' &&
    wordFollowedBold === '**span1**a and span2' &&
    S.includes('const push=useCallback(entry=>setLogs(p=>cap>0?[...p.slice(-cap),entry].slice(-cap):[]),[cap]);') &&
    S.includes("{n!=null&&n!==''&&n!==false&&<span className=\"sect-num\" aria-hidden=\"true\">{n}</span>}") &&
    S.includes("<summary>{summary}{note!=null&&note!==''&&note!==false&&<span className=\"disclose-note\">{note}</span>}</summary>") &&
    S.includes('const r=n2aPdfToWorksheetText(n2aPdfBlocks(await n2aReadPdfPages(f,ac.signal)),f.name);') &&
    S.includes("const removeFile=i=>{if(busy||reading)return;") &&
    S.includes("else if(!conditions.length&&conditionId)setConditionId('');"));

  // 17. Phase 9: ankiDedupeCards unresolvedFactIds union, PriorityAnalyzer monotonic progress & partial synthesis tier merge, NCLEXToAnki pre-convert abort/transcript guard/PDF cancel, and ConfigSidebar 2-stage priority badge
  const dedupedUnresolved = H.ankiDedupeCards([
    { id: 'n1', text: '[Hypokalemia] Clue: {{c1::U waves}}', extra: '', tags: 'Condition::HypoK Nursing::LATTE::Look Tier::1', pipeCount: 2, keep: true, factIds: ['fact-1'], mappingIssues: [] },
    { id: 'n2', text: '[Hypokalemia] Clue: {{c1::U waves}}', extra: '', tags: 'Condition::HypoK Nursing::LATTE::Look Tier::1', pipeCount: 2, keep: true, factIds: ['fact-1'], mappingIssues: [], unresolvedFactIds: ['fact-999'] }
  ]);
  const dedupedClean = H.ankiDedupeCards([
    { id: 'n3', text: '[Hypokalemia] Clue: {{c1::U waves}}', extra: '', tags: 'Condition::HypoK Nursing::LATTE::Look Tier::1', pipeCount: 2, keep: true, factIds: ['fact-1'], mappingIssues: [] },
    { id: 'n4', text: '[Hypokalemia] Clue: {{c1::U waves}}', extra: '', tags: 'Condition::HypoK Nursing::LATTE::Look Tier::1', pipeCount: 2, keep: true, factIds: ['fact-1'], mappingIssues: [] }
  ]);
  const snapForCheck = { facts: [{ id: 'fact-1', condition: 'Hypokalemia', aliases: ['HypoK'], text: 'U waves', tier: 1, bucket: 'Look' }], byId: { 'fact-1': { id: 'fact-1', condition: 'Hypokalemia', aliases: ['HypoK'], text: 'U waves', tier: 1, bucket: 'Look' } } };
  const tagCheckAfterMerge = H.ankiConditionTagCheck(dedupedUnresolved[0], snapForCheck);
  t('Phase 9: ankiDedupeCards unions unresolvedFactIds across exact duplicates, PriorityAnalyzer merges surviving synthesis parts on halt, NCLEXToAnki guards hashing/transcripts/PDF cancel, and ConfigSidebar shows both Priority stages',
    dedupedUnresolved.length === 1 &&
    Array.isArray(dedupedUnresolved[0].unresolvedFactIds) &&
    dedupedUnresolved[0].unresolvedFactIds.join(',') === 'fact-999' &&
    tagCheckAfterMerge.code === 'unreliable-mapping' &&
    dedupedClean.length === 1 &&
    dedupedClean[0].unresolvedFactIds === undefined &&
    S.includes('owned_setProgress(Math.floor(completed/total*50));') &&
    S.includes('if(slots.some(t=>String(t||\'\').trim())){const partialMerged=paMergeSynthesis(slots);owned_setOutput(partialMerged.text);owned_setParsedTiers(partialMerged.tiers);gotOutput=true;}') &&
    S.includes("for(const f of ordered){if(ac.signal.aborted)throw new DOMException('Aborted','AbortError');prepared.push({name:f.name,key:await i2aFileKey(f),payload:()=>i2aImagePayload(f)});}") &&
    S.includes('disabled={busy||reading}>⬆ Load transcripts</button>') &&
    S.includes("{((busy&&mode==='images')||(reading&&mode==='export'))&&<button className=\"btn-danger\" onClick={()=>abortRef.current?.abort()}>Cancel</button>}") &&
    S.includes("const h=activeTool==='priority'?cfg.forTool('priorityHarvest'):null;"));

  // 18. Phase 10: kbExtractPointAnchors newline normalization, importJSON abortRef decoupling, paParseTiers bold/italicized Audit footer, nclexAccumulate unmatched/conditions fill, n2aStripSources trailing period, and x2aSplitRationale/x2aBuildCard inline marks & unmatched trailer
  const multiLineImported = H.kbNormalizeImported({
    conditions: [{
      name: 'Hypokalemia',
      aliases: [],
      facts: [{ id: 'fact-1', latteBucket: 'Look', tier: 1, text: 'Prominent U waves\non 12-lead ECG [P1].', sources: [{ filename: 'lecture.pdf', location: 'p. 1' }] }]
    }]
  }).kb;
  const ankiMultiLine = H.kbForAnki(multiLineImported);
  const boldAuditTiers = H.paParseTiers('## TIER 1 — Must Know\n- **Hold digoxin** [§1] — (R1) pulse < 60.\n## Study Strategy\n- Check apical pulse.\n**Audit: 1 items · 0 unverified · 0 inferred · 1/1 T1 rule-tagged**');
  const labelAuditTiers = H.paParseTiers('## TIER 1 — Must Know\n- **Hold digoxin** [§1] — (R1) pulse < 60.\n*Audit*: 1 items · 0 unverified · 0 inferred · 1/1 T1 rule-tagged');
  const accSeen10 = new Set(), accAll10 = [];
  H.nclexAccumulate(accSeen10, accAll10, [{ question_number: 2, question: 'Which electrolyte imbalance causes U waves?', correct_answer: '', rationale: '', diseases_conditions: [] }], {});
  H.nclexAccumulate(accSeen10, accAll10, [{ question_number: 2, question: 'Which electrolyte imbalance causes U waves?', correct_answer: 'A. Hypokalemia', rationale: 'Model guess.', answer_unmatched: true, diseases_conditions: ['Hypokalemia'] }], {});
  const stripTrailingDot = H.n2aStripSources('Hold digoxin for low potassium (Source: C1 — "low potassium increases digoxin toxicity").');
  const stripDoubleDot = H.n2aStripSources('Hold digoxin for low potassium. (Source: C1 — "low potassium increases digoxin toxicity").');
  const splitInlineVitaminD = H.x2aSplitRationale(
    'A. Vitamin D. deficiency is wrong. B. Hypokalemia is correct. C. Hypernatremia is wrong. D. Hypercalcemia is wrong. ⚠ No answer for this question was found on the answer pages; this answer was written by the model. Check it against the book.',
    [['A', 'One'], ['B', 'Two'], ['C', 'Three'], ['D', 'Four']]
  );
  const builtUnmatchedWarn = H.x2aBuildCard({
    num: 1,
    question: 'Stem?\nA. One\nB. Two\nC. Three\nD. Four',
    answer: 'B',
    rationale: 'A. Wrong. B. Correct. C. Wrong. D. Wrong. ⚠ No answer for this question was found on the answer pages; this answer was written by the model. Check it against the book.'
  }, 'src', []);
  t('Phase 10: kbForAnki collapses embedded newlines, importJSON decouples abortRef, paParseTiers parses bold/label-italicized Audit footers, nclexAccumulate propagates answer_unmatched & diseases_conditions, n2aStripSources handles trailing period, and x2aSplitRationale/x2aBuildCard handle inline marks & unmatched trailer',
    ankiMultiLine.includes('FACT fact-1 | LATTE: Look | Tier: 1 | Prominent U waves on 12-lead ECG. | Source: lecture.pdf, p. 1') &&
    S.includes("if(!kbConfirmReplace('Importing this file'))return;\n    // v19.0: do not bind abortRef to importJSON") &&
    boldAuditTiers && boldAuditTiers.audit === '1 items · 0 unverified · 0 inferred · 1/1 T1 rule-tagged' && !boldAuditTiers.strategy.includes('Audit') &&
    labelAuditTiers && labelAuditTiers.audit === '1 items · 0 unverified · 0 inferred · 1/1 T1 rule-tagged' &&
    accAll10[0].correct_answer === 'A. Hypokalemia' && accAll10[0].answer_unmatched === true && accAll10[0].diseases_conditions.join(',') === 'Hypokalemia' &&
    stripTrailingDot[0] === 'Hold digoxin for low potassium.' && stripTrailingDot[1] === 'low potassium increases digoxin toxicity' &&
    stripDoubleDot[0] === 'Hold digoxin for low potassium.' && stripDoubleDot[1] === 'low potassium increases digoxin toxicity' &&
    splitInlineVitaminD[1] instanceof Map &&
    splitInlineVitaminD[1].get('A').includes('Vitamin D. deficiency is wrong.') &&
    !splitInlineVitaminD[1].get('D').includes('No answer for this question') &&
    splitInlineVitaminD[2].startsWith('⚠ No answer for this question was found on the answer pages') &&
    builtUnmatchedWarn[0].tags.includes('NeedsReview') &&
    builtUnmatchedWarn[1].some(w => w.includes('no answer on the answer pages')));
};
