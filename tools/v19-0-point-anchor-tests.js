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
  const ankiSpan =
    span('function kbSourceText(f){', '\n') + '\n' +
    span('function ankiConditionTagKey(', 'function ankiBatchSummary(') +
    span('function kbForAnki(kb){', '// ── KB source chunking') +
    span('function ankiParseCards(raw', '// ── KB coverage + card lint');

  const H = new Function(
    'uid',
    kbSpan + '\n' + ankiSpan + '\n' +
    'return {KB_SOURCE_ANCHOR_RULES,kbBuildFocusBlock,parseAndNumberPoints,formatPointsForPrompt,buildKbFactItemSchema,auditKbFacts,runPointAnchorHarness,kbStripPointTags,kbExtractPointAnchors,mergeLatteParts,kbNormalizeImported,kbForAnki,ankiParseCards};'
  )(() => 'card-uid-1');

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
    adapter.includes('Strict Source Grounding for Priorities & Thresholds:'));
};
