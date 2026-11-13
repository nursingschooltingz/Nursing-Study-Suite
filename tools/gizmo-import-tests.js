'use strict';

// v19.2: Regression suite for the Import to Gizmo tab (AI-driven chunked Anki -> Gizmo.ai converter).
// Extracts the real production helpers and component wiring from the shipped HTML.

function span(S, start, end) {
  const a = S.indexOf(start);
  if (a < 0) throw new Error('Gizmo test start anchor missing: ' + start);
  const b = S.indexOf(end, a + start.length);
  if (b < 0) throw new Error('Gizmo test end anchor missing after: ' + start);
  if (S.indexOf(start, a + start.length) >= 0) throw new Error('Gizmo test start anchor is not unique: ' + start);
  return S.slice(a, b);
}

module.exports = function runGizmoImportTests(S, t) {
  const kbPointHelpers = span(S, 'function kbStripPointTags(text){', 'function kbExtractPointAnchors(');
  const ankiHelpers = span(S, 'function ankiParseCards(raw', 'function AnkiStyleBadges(');
  const gizmoHelpers = span(S, '// ──── TOOL: Import to Gizmo (AI-driven chunked Anki → Gizmo.ai converter) ────', 'function GizmoImporter(){');
  const gizmoComponent = span(S, 'function GizmoImporter(){', '// v16.0: settings use named native controls');

  t('Gizmo extraction span retains non-vacuous helper tail',
    gizmoHelpers.includes('function gizmoRenderHighlightedFront(front){') &&
    gizmoComponent.includes('setupLabel="Gizmo converter source and chunk settings"'));

  const H = new Function(
    'TextDecoder', 'uid',
    kbPointHelpers + '\n' + ankiHelpers + '\n' + gizmoHelpers + '\n' +
    'return {GIZMO_PROMPT_STORAGE_KEY,GIZMO_DEFAULT_IMPORT_PROMPT,GIZMO_DEFAULT_PAGES_PER_CHUNK,GIZMO_DEFAULT_CARDS_PER_PAGE,GIZMO_DEFAULT_PAGE_CHARS,GIZMO_DEFAULT_AI_BATCH,' +
    'loadGizmoImportPrompt,saveGizmoImportPrompt,gizmoDecodeFileBytes,gizmoParseDelimitedRecords,gizmoLooksLikeTagField,gizmoParseAnkiInput,gizmoCardsFromLiveAnki,' +
    'gizmoCleanPlainText,gizmoDeterministicCard,gizmoExtractBrackets,gizmoReconcileChunk,gizmoFormatTsv,gizmoPaginateCards,gizmoBuildPageChunks,gizmoSlicePageRange,gizmoRenderHighlightedFront};'
  )(TextDecoder, () => 'synthetic-id');

  // 1. Navigation, profile defaults, and live Anki bridge wiring
  const toolsBlock = span(S, 'const TOOLS=[', '];');
  const profileDefaults = span(S, 'const TOOL_PROFILE_DEFAULTS={', '};');
  const profileRows = span(S, 'const PROFILE_ROWS=[', '];');
  const toolComponents = S.match(/const TOOL_COMPONENTS=\{([^}]*)\}/);
  t('Import to Gizmo is registered in TOOLS, TOOL_PROFILE_DEFAULTS, PROFILE_ROWS, and memoized TOOL_COMPONENTS',
    toolsBlock.includes("{id:'gizmo',stage:'practice',label:'Import to Gizmo',step:'Send cards to Gizmo',title:'Import to Gizmo',") &&
    profileDefaults.includes("gizmo:{m:'hydrogen',lv:'low'}") &&
    profileRows.includes("{id:'gizmo',label:'Import to Gizmo'}") &&
    !!toolComponents && toolComponents[1].includes('gizmo:React.memo(GizmoImporter)'));

  t('AnkiGenerator publishes live deck state into AnkiDeckCtx via KnowledgeCtx without new unmocked Anki globals',
    S.includes('const AnkiDeckCtx=createContext(null);') &&
    S.includes('const publishAnkiDeck=K.publishAnkiDeck;') &&
    S.includes('if(publishAnkiDeck)publishAnkiDeck({cards,batch,current,tierFilter});') &&
    S.includes('publishAnkiDeck:setSharedAnkiDeck') &&
    S.includes('<AnkiDeckCtx.Provider value={sharedAnkiDeck}>'));

  // 2. Preloaded, editable, saveable Gizmo Import Prompt contract
  const expectedImportPrompt = [
    'Create standard 2-sided flashcards from this tab-separated text:',
    '',
    '1. ONE CARD PER LINE: Do not duplicate cards. Keep all blanks for a sentence on the SAME card.',
    '2. FRONT OF CARD: Use the sentence before the tab. Highlight every phrase inside square brackets [like this] in green as a blank. Remove the bracket symbols from the final text. Do not highlight any unbracketed words.',
    '3. BACK OF CARD: Place the exact text after the tab into the Back/Explanation field. Do not omit or shorten this text.',
    '4. VERBATIM: Do not summarize, rephrase, or convert into questions or True/False cards. Keep the wording identical to the input.'
  ].join('\n');
  t('GIZMO_DEFAULT_IMPORT_PROMPT matches the exact 4-rule Gizmo.ai instructions verbatim',
    H.GIZMO_DEFAULT_IMPORT_PROMPT === expectedImportPrompt && H.GIZMO_DEFAULT_PAGES_PER_CHUNK === 5);

  const memStore = (() => {
    const map = new Map();
    return {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); }
    };
  })();
  const throwStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  t('loadGizmoImportPrompt and saveGizmoImportPrompt preload default, persist custom edits, and survive blocked storage',
    H.loadGizmoImportPrompt(memStore) === expectedImportPrompt &&
    H.saveGizmoImportPrompt(memStore, 'Custom Gizmo prompt rule') === true &&
    H.loadGizmoImportPrompt(memStore) === 'Custom Gizmo prompt rule' &&
    H.saveGizmoImportPrompt(memStore, '   ') === true &&
    H.loadGizmoImportPrompt(memStore) === expectedImportPrompt &&
    H.loadGizmoImportPrompt(throwStore) === expectedImportPrompt &&
    H.saveGizmoImportPrompt(throwStore, 'x') === false);

  // 3. UTF-8 / UTF-16 BOM decoding
  const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x4b, 0x2b]);
  const utf16le = new Uint8Array([0xff, 0xfe, 0x4b, 0x00, 0x2b, 0x00]);
  const utf16be = new Uint8Array([0xfe, 0xff, 0x00, 0x4b, 0x00, 0x2b]);
  let badUtfThrew = false;
  try { H.gizmoDecodeFileBytes(new Uint8Array([0x80, 0xfe, 0xff])); } catch (e) { badUtfThrew = /UTF-8 or BOM-marked UTF-16/.test(e.message); }
  t('gizmoDecodeFileBytes decodes UTF-8 BOM, UTF-16LE BOM, UTF-16BE BOM, and rejects malformed bytes',
    H.gizmoDecodeFileBytes(utf8Bom) === 'K+' &&
    H.gizmoDecodeFileBytes(utf16le) === 'K+' &&
    H.gizmoDecodeFileBytes(utf16be) === 'K+' &&
    badUtfThrew);

  // 4. Anki deck parsing across LATTE pipe exports, CSV-quoted HTML exports, and NCLEX-to-Anki 4-column TSV exports
  const v19PipeDeck = [
    '#separator:Pipe',
    '#html:true',
    '[Perfusion → Heart Failure] Hallmark sign: {{c1::dyspnea on exertion}} and {{c2::orthopnea}}.|Monitor lung sounds q4h.|Nursing::LATTE::Assess Condition::Heart_Failure Concept::Perfusion Scope::Exemplar Trap::Priority Tier::1',
    '"[DKA — NEVER DO] Never give {{c1::IV insulin}} if serum K+ is &lt; {{c2::3.3 mEq/L::critical floor}}.<br>Replete K+ first."|"Line 1 ""quoted""',
    'Line 2"|Nursing::LATTE::Treat Condition::DKA Trap::NeverDo Tier::1',
    '[Digoxin] Patient says "halos" around lights: check {{c1::digoxin level}}.|Early toxicity clue.|Condition::Digoxin_Toxicity Tier::1'
  ].join('\n');
  const parsedPipe = H.gizmoParseAnkiInput(v19PipeDeck, 'deck.txt');
  t('gizmoParseAnkiInput parses v19 Concept/Scope/Trap tags, multi-line CSV-quoted HTML rows, and unquoted mid-sentence quotes',
    parsedPipe.cards.length === 3 &&
    parsedPipe.warnings.length === 0 &&
    parsedPipe.delimiter === 'pipes' &&
    parsedPipe.cards[1].rawBack.includes('Line 1 "quoted"\nLine 2') &&
    parsedPipe.cards[2].rawFront.includes('"halos"'));

  const n2aExport = [
    '#separator:tab',
    '#html:true',
    '#notetype:Basic',
    '#deck:NCLEX::Cardiac',
    '#tags column:3',
    '#guid column:4',
    'Which electrolyte abnormality increases digoxin toxicity?\t<b>✓ B.</b> Hypokalemia\tTier::1 Cardiac::HF NCLEX_Type::MCQ\tn2a2cd653dccc88350dbb6e'
  ].join('\n');
  const parsedN2a = H.gizmoParseAnkiInput(n2aExport, 'n2a.txt');
  t('gizmoParseAnkiInput strips #tags column and #guid column metadata from NCLEX-to-Anki exports',
    parsedN2a.cards.length === 1 &&
    parsedN2a.cards[0].rawFront === 'Which electrolyte abnormality increases digoxin toxicity?' &&
    parsedN2a.cards[0].rawBack === '<b>✓ B.</b> Hypokalemia' &&
    parsedN2a.cards[0].tags.includes('NCLEX_Type::MCQ'));

  // 5. Live Anki deck reader (tier filter, source pointers, stale KB warning)
  const liveFixture = {
    current: true,
    batch: { snapshot: { byId: { 'f-1': { sources: [{ filename: 'cardiac.pdf', location: 'p. 12' }] } } } },
    cards: [
      { id: 'n1', keep: true, text: '[HF] Hold digoxin if apical pulse < {{c1::60 bpm}}.', extra: '', tags: 'Nursing::LATTE::Treat Condition::HF Tier::1', pipeCount: 2, factIds: ['f-1'], mappingIssues: [] },
      { id: 'n2', keep: true, text: '[HF] Daily weight gain > {{c1::2 lb}} in 24 hr.', extra: 'Report same day.', tags: 'Nursing::LATTE::Teach Condition::HF Tier::2', pipeCount: 2, factIds: ['f-1'], mappingIssues: [] },
      { id: 'n3', keep: false, text: '[HF] Excluded {{c1::note}}.', extra: '', tags: 'Condition::HF Tier::1', pipeCount: 2, factIds: [], mappingIssues: [] }
    ]
  };
  const liveAll = H.gizmoCardsFromLiveAnki(liveFixture, { tier: 'all', includeSources: false });
  const liveT1WithSrc = H.gizmoCardsFromLiveAnki(liveFixture, { tier: '1', includeSources: true });
  const liveStale = H.gizmoCardsFromLiveAnki({ ...liveFixture, current: false }, { tier: 'all', includeSources: true });
  t('gizmoCardsFromLiveAnki filters kept Anki notes by tier, optionally appends source pointers, and warns when KB is stale',
    liveAll.cards.length === 2 &&
    liveAll.cards[0].rawBack === '' &&
    liveT1WithSrc.cards.length === 1 &&
    liveT1WithSrc.cards[0].rawBack === 'Source: cardiac.pdf, p. 12' &&
    liveStale.stale === true &&
    liveStale.warnings.length === 1 &&
    liveStale.cards[0].rawBack === '');

  // 6. Verbatim deterministic conversion: clozes, hints, [Topic] prefixes, non-cloze brackets, HTML comparators, and empty Back
  const detEmptyBack = H.gizmoDeterministicCard({
    rawFront: '[Perfusion → Heart Failure] Hold digoxin for apical pulse &lt; {{c1::60 bpm::full 1 min}} and check [serum K+] &gt; {{c2::3.5 mEq/L}} [P1].',
    rawBack: ''
  });
  t('gizmoDeterministicCard keeps multiple clozes on one card, converts hints to parentheses, turns [Topic] into colon prefix, converts non-cloze [brackets] to parens, preserves < and > comparators, and keeps empty Back strictly empty',
    detEmptyBack.front === 'Perfusion → Heart Failure: Hold digoxin for apical pulse < [60 bpm] (full 1 min) and check (serum K+) > [3.5 mEq/L].' &&
    detEmptyBack.back === '' &&
    detEmptyBack.blankCount === 2 &&
    detEmptyBack.blanks.join('|') === '60 bpm|3.5 mEq/L');

  const detHtmlBack = H.gizmoDeterministicCard({
    rawFront: '<div><b>[DKA — NEVER DO]</b> Never start {{c1::insulin}} when K+ &lt; {{c2::3.3 mEq/L}}.</div>',
    rawBack: '<i>Replete potassium first</i><br>Check BMP &amp; ECG [P2]'
  });
  t('gizmoDeterministicCard strips HTML tags, joins <br> with semicolons, strips [P#] anchors, and preserves non-empty Back verbatim',
    detHtmlBack.front === 'DKA — NEVER DO: Never start [insulin] when K+ < [3.3 mEq/L].' &&
    detHtmlBack.back === 'Replete potassium first; Check BMP & ECG');

  // 7. Anti-hallucination AI chunk reconciliation
  const chunkInput = [
    { index: 1, lineNumber: 1, rawFront: '[HF] Hold digoxin below {{c1::60 bpm}}.', rawBack: '' },
    { index: 2, lineNumber: 2, rawFront: '[DKA] Hold insulin if K+ < {{c1::3.3 mEq/L}}.', rawBack: 'Give K+ first.' },
    { index: 3, lineNumber: 3, rawFront: '[COPD] Target SpO2 {{c1::88-92%}}.', rawBack: 'Avoid hypoxic drive suppression.' },
    { index: 4, lineNumber: 4, rawFront: '[Lithium] Therapeutic range {{c1::0.6-1.2 mEq/L}}.', rawBack: 'Narrow therapeutic index.' }
  ];
  const aiChunkOutput = {
    cards: [
      // Card 1: AI hallucinated a Back explanation when source Extra was empty -> must strip Back to ""
      { index: 1, front: 'HF: Hold digoxin below [60 bpm].', back: 'Hallucinated rationale that was not in Extra.' },
      // Card 2: AI altered 3.3 -> 3.5 -> numeric guard must repair to deterministic source
      { index: 2, front: 'DKA: Hold insulin if K+ < [3.5 mEq/L].', back: 'Give K+ first.' },
      // Card 3: AI highlighted an extra unbracketed word [COPD] -> bracket guard must repair to deterministic source
      { index: 3, front: '[COPD]: Target SpO2 [88-92%].', back: 'Avoid hypoxic drive suppression.' }
      // Card 4: AI omitted card #4 completely -> count/order guard must recover card #4 verbatim
    ]
  };
  const reconciled = H.gizmoReconcileChunk(chunkInput, aiChunkOutput);
  t('gizmoReconcileChunk strips hallucinated empty-Extra backs, repairs numeric or bracket drift, and recovers omitted AI cards',
    reconciled.cards.length === 4 &&
    reconciled.repairedCount === 4 &&
    reconciled.cards[0].front === 'HF: Hold digoxin below [60 bpm].' &&
    reconciled.cards[0].back === '' &&
    reconciled.cards[1].front === 'DKA: Hold insulin if K+ < [3.3 mEq/L].' &&
    reconciled.cards[1].back === 'Give K+ first.' &&
    reconciled.cards[2].front === 'COPD: Target SpO2 [88-92%].' &&
    reconciled.cards[3].index === 4 &&
    reconciled.cards[3].front === 'Lithium: Therapeutic range [0.6-1.2 mEq/L].' &&
    reconciled.cards[3].back === 'Narrow therapeutic index.');

  const cleanAi = H.gizmoReconcileChunk(
    [{ index: 1, lineNumber: 1, rawFront: '[HF] Hold digoxin below {{c1::60 bpm}}.', rawBack: 'Count apical pulse 1 full minute.' }],
    { cards: [{ index: 1, front: 'HF: Hold digoxin below [60 bpm].', back: 'Count apical pulse 1 full minute.' }] }
  );
  t('gizmoReconcileChunk accepts clean AI output with zero repairs or warnings',
    cleanAi.repairedCount === 0 && cleanAi.warnings.length === 0 && cleanAi.cards[0].blankCount === 1);

  // 8. Virtual textbook PDF pagination, 5-page chunk slideshow, Copy All TSV, and Page Range slicing
  const syntheticConverted = Array.from({ length: 40 }, (_, i) => ({
    index: i + 1,
    lineNumber: i + 1,
    front: 'Condition ' + (i + 1) + ': Monitor [' + (i + 1) + ' mg] dose closely.',
    back: i % 2 === 0 ? '' : 'Explanation ' + (i + 1),
    blankCount: 1
  }));
  const pages = H.gizmoPaginateCards(syntheticConverted, { cardsPerPage: 5, charsPerPage: 2500 });
  const chunks5 = H.gizmoBuildPageChunks(pages, 5);
  const slice2to4 = H.gizmoSlicePageRange(pages, 2, 4);
  const invalidSlice = H.gizmoSlicePageRange(pages, 5, 2);
  const fullTsv = H.gizmoFormatTsv(syntheticConverted);
  const tsvLines = fullTsv.split('\n');

  t('gizmoPaginateCards and gizmoBuildPageChunks group cards into virtual textbook pages and 5-page slideshow chunks',
    pages.length === 8 &&
    pages[0].pageNumber === 1 && pages[0].startCard === 1 && pages[0].endCard === 5 &&
    chunks5.length === 2 &&
    chunks5[0].startPage === 1 && chunks5[0].endPage === 5 && chunks5[0].cardCount === 25 &&
    chunks5[1].startPage === 6 && chunks5[1].endPage === 8 && chunks5[1].cardCount === 15);

  t('gizmoSlicePageRange copies exact virtual page ranges and rejects inverted page bounds',
    slice2to4.valid === true &&
    slice2to4.startPage === 2 && slice2to4.endPage === 4 &&
    slice2to4.startCard === 6 && slice2to4.endCard === 20 &&
    slice2to4.cardCount === 15 &&
    slice2to4.text.split('\n').length === 15 &&
    invalidSlice.valid === false && invalidSlice.text === '');

  t('gizmoFormatTsv emits strictly 1 card per line with exactly one tab separator even when Back is empty',
    tsvLines.length === 40 &&
    tsvLines.every(line => line.split('\t').length === 2 && !line.includes('\r')) &&
    tsvLines[0] === 'Condition 1: Monitor [1 mg] dose closely.\t' &&
    tsvLines[1] === 'Condition 2: Monitor [2 mg] dose closely.\tExplanation 2');

  const hi = H.gizmoRenderHighlightedFront('HF: Hold below [60 bpm] and K+ < [3.5 mEq/L].');
  t('gizmoRenderHighlightedFront isolates only bracketed phrases for green blank preview badges',
    hi.filter(s => s.blank).map(s => s.text).join('|') === '60 bpm|3.5 mEq/L' &&
    hi.filter(s => !s.blank).map(s => s.text).join('') === 'HF: Hold below  and K+ < .');

  // 9. UI controls contract inside GizmoImporter
  t('GizmoImporter renders editable/saveable prompt box with Copy button plus Chunk slideshow, Copy all, and Page range modes',
    gizmoComponent.includes('<Panel title="Gizmo import instructions"') &&
    gizmoComponent.includes('onClick={handleSavePrompt}>Save</button>') &&
    gizmoComponent.includes('onClick={handleCopyPrompt}>Copy</button>') &&
    gizmoComponent.includes("📑 Chunk slideshow ({chunks.length})") &&
    gizmoComponent.includes("📋 Copy all ({result.cards.length})") &&
    gizmoComponent.includes("🔢 Page range (1–{pages.length})") &&
    gizmoComponent.includes('callGemini(cfg.apiKey,model,[{text:GIZMO_CONVERT_PROMPT'));
};
