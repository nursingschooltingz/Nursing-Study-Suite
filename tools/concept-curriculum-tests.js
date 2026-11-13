'use strict';

// v19.2: Concept-based curriculum LATTE + P support (Master Concept Overviews, BriefPatho "P" concept bridge,
// exemplar deltas vs shared parent-concept routing, priority differentiator flagging, and Priority/NCLEX/Case connectors).
// Synthetic data only; no network calls.

module.exports = async function run(S, t) {
  const span = (a, b) => {
    const x = S.indexOf(a), y = S.indexOf(b, x + a.length);
    if (x < 0 || y < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous concept-curriculum anchor: ' + a);
    return S.slice(x, y);
  };

  // 1. Extract live KB focus, merge, import/restore, Study-view, Anki, Priority, NCLEX, and Case helpers from shipped HTML.
  const KB = new Function(
    span('function kbBuildFocusBlock(', '// Underextraction flag:') + '\n' +
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') + '\n' +
    ';return {kbBuildFocusBlock,KB_CONCEPT_CURRICULUM_RULES,KB_CONCEPT_ROLES,KB_CONCEPT_SCOPES,kbParseConceptNames,kbCoerceConceptScope,kbSanitizeRelatedConcepts,kbCanonConceptKey,auditKbConcepts,kbOrderByConcept,mergeLatteParts,kbNormalizeImported};'
  )();

  const VIEW = new Function(
    span('const KB_ENTITY_KINDS=', '// v17.4: facts with text') + '\n' +
    span('function ngFactRow(', 'function ngSplitParts(') + '\n' +
    span('function kbForPriority(', '// v16.7: completeness and captured-source limits') + '\n' +
    ';return {kbFactWeight,DIFFERENTIATOR_WEIGHT,BOX_TABLE_WEIGHT,kbInferEntityConcept,kbFactView,renderKBMarkdown,kbForNCLEX,ngFactRow,ngBuildFactPool,ngAllocateBatch,ngFocusIndex,ngFocusMatch,ngFocusPlan,ngConceptCoverage,ngRenderAllocation,kbForPriority};'
  )();

  const ANKI_CONCEPT = new Function(
    span('function kbSourceText(f){', '\n') + '\n' +
    span('function kbUsableFactCount(', '// ── KB source chunking') + '\n' +
    span('function splitOversizedConditionBlock(', 'function ankiParseCards(raw') + '\n' +
    span('function ankiSourceSnapshot(', 'function ankiChunkFactIds(') + '\n' +
    span('function ankiConditionTagKey(', 'const LINT_LABEL=') + '\n' +
    ';return {kbForAnki,ankiChunkText,ankiSourceSnapshot,ankiConditionTagCheck,ankiNormalizeConditionTags,ankiCardScopes,ankiStampConceptTags,ankiFilterFactView,lintAnkiCard};'
  )();

  const selectCaseFacts = new Function(span('function selectCaseFacts(', '// Sufficiency check') + ';return selectCaseFacts;')();
  const caseRenderFactPacket = new Function('kbSourceText', span('function caseRenderFactPacket(', '// ── v15.6 item 5') + ';return caseRenderFactPacket;')(f => (f.sources || []).map(s => s.filename).join(', '));
  const { load: loadCaseValidators, index: makeCaseIndex } = require('./case-remediation-tests');
  const CASEV = loadCaseValidators(S);

  // ── 1. Option B concept parsing & kbBuildFocusBlock separation from Focus scope/tier rules ──
  t('v19.2: kbParseConceptNames splits commas, semicolons, newlines and bullets while deduplicating',
    JSON.stringify(KB.kbParseConceptNames('Perfusion, Gas Exchange;\n• Intracranial Regulation\n1. Perfusion\n- Fluid & Electrolyte Balance')) ===
    '["Perfusion","Gas Exchange","Intracranial Regulation","Fluid & Electrolyte Balance"]' &&
    KB.kbParseConceptNames('').length === 0);

  const plainEmpty = KB.kbBuildFocusBlock('', '', '', 'prioritize');
  const plainFocusOnly = KB.kbBuildFocusBlock('1. Master electrolytes', '1. Hypokalemia', '', 'prioritize');
  const conceptNamedOnly = KB.kbBuildFocusBlock('', '', '', 'scope', 'Perfusion, Gas Exchange', false);
  const conceptAutoOnly = KB.kbBuildFocusBlock('', '', '', 'prioritize', '', true);
  const conceptNamedAndAuto = KB.kbBuildFocusBlock('', '', '', 'prioritize', 'Perfusion', true);
  const focusPlusConcept = KB.kbBuildFocusBlock('1. Apply perfusion principles', '1. Heart failure', '', 'prioritize', 'Perfusion', false);

  t('v19.2: kbBuildFocusBlock keeps legacy output untouched when concept mode is off',
    plainEmpty === '' &&
    plainFocusOnly.includes('═══ STUDENT-PROVIDED FOCUS CONTEXT ═══') &&
    !plainFocusOnly.includes('CONCEPT-BASED CURRICULUM STRUCTURE'));

  t('v19.2: Concept mode alone (Option B: named concepts, auto-detect, or both) never triggers Focus SCOPE or Tier-3 demotion rules',
    conceptNamedOnly.includes('═══ CONCEPT-BASED CURRICULUM STRUCTURE ═══') &&
    conceptNamedOnly.includes('OVERARCHING CONCEPTS TO ANCHOR') &&
    conceptNamedOnly.includes('- Perfusion\n- Gas Exchange') &&
    conceptNamedOnly.includes(KB.KB_CONCEPT_CURRICULUM_RULES) &&
    !conceptNamedOnly.includes('STUDENT-PROVIDED FOCUS CONTEXT') &&
    !conceptNamedOnly.includes('SCOPE MODE') &&
    !conceptNamedOnly.includes('PRIORITIZE MODE') &&
    conceptAutoOnly.includes('CONCEPT AUTO-DETECTION:') &&
    !conceptAutoOnly.includes('STUDENT-PROVIDED FOCUS CONTEXT') &&
    conceptNamedAndAuto.includes('also auto-detect any additional overarching concepts'));

  t('v19.2: Focus context and Concept mode compose cleanly when both are active',
    focusPlusConcept.includes('═══ STUDENT-PROVIDED FOCUS CONTEXT ═══') &&
    focusPlusConcept.includes('═══ CONCEPT-BASED CURRICULUM STRUCTURE ═══') &&
    focusPlusConcept.indexOf('STUDENT-PROVIDED FOCUS CONTEXT') < focusPlusConcept.indexOf('CONCEPT-BASED CURRICULUM STRUCTURE'));

  // ── 2. mergeLatteParts cross-chunk concept promotion, canonicalization, ordering, and scope upgrade ──
  const mergedConcept = KB.mergeLatteParts([
    {
      source: { filename: 'unit1.pdf', range: 'p. 1-4' },
      conditions: [
        {
          name: 'Dehydration',
          facts: [{ latteBucket: 'Look', tier: 1, text: 'Dry mucous membranes.', sourceQuote: 'Dry mucous membranes', sourcePointer: { filename: 'unit1.pdf', location: 'p. 1' } }]
        },
        {
          name: 'Heart Failure',
          concept: 'perfusion',
          facts: [
            { latteBucket: 'BriefPatho', tier: 1, conceptScope: 'delta', text: 'Ventricular remodeling reduces stroke volume and cardiac output.', sourceQuote: 'Ventricular remodeling reduces stroke volume', sourcePointer: { filename: 'unit1.pdf', location: 'p. 2' } },
            { latteBucket: 'Assess', tier: 1, conceptScope: 'delta', text: 'Auscultate for S3 ventricular gallop and bibasilar crackles.', sourceQuote: 'S3 ventricular gallop and bibasilar crackles', sourcePointer: { filename: 'unit1.pdf', location: 'p. 2' } }
          ]
        }
      ]
    },
    {
      source: { filename: 'unit1.pdf', range: 'p. 5-8' },
      conditions: [
        {
          name: 'Perfusion',
          aliases: [' Tissue Perfusion '],
          facts: [
            { latteBucket: 'BriefPatho', tier: 1, conceptScope: 'shared', text: 'Adequate perfusion depends on pump, volume, and vascular tone.', sourceQuote: 'pump, volume, and vascular tone', sourcePointer: { filename: 'unit1.pdf', location: 'p. 5' } },
            { latteBucket: 'Assess', tier: 1, conceptScope: 'shared', text: 'Check capillary refill, peripheral pulses, and mentation.', sourceQuote: 'capillary refill, peripheral pulses, and mentation', sourcePointer: { filename: 'unit1.pdf', location: 'p. 5' } }
          ]
        },
        {
          name: 'Heart Failure',
          entryRole: 'exemplar',
          concept: 'Perfusion',
          facts: [
            { latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', text: 'Auscultate for S3 ventricular gallop and bibasilar crackles.', sourceQuote: 'S3 ventricular gallop and bibasilar crackles', sourcePointer: { filename: 'unit1.pdf', location: 'p. 6' } },
            { latteBucket: 'Treatments', tier: 1, subtype: 'dependent', conceptScope: ' bogus-scope ', text: 'Administer IV loop diuretic for acute pulmonary congestion.', sourceQuote: 'Administer IV loop diuretic', sourcePointer: { filename: 'unit1.pdf', location: 'p. 6' } }
          ]
        },
        {
          name: 'Gas Exchange',
          entryRole: 'invalid-role',
          facts: [
            { latteBucket: 'BriefPatho', tier: 1, conceptScope: 'shared', text: 'Ventilation-perfusion matching drives arterial oxygenation.', sourceQuote: 'Ventilation-perfusion matching', sourcePointer: { filename: 'unit1.pdf', location: 'p. 8' } }
          ]
        }
      ]
    }
  ], 'NUR 210', 'Exam 2', null, { concepts: 'Gas Exchange', conceptAuto: true });

  t('v19.2: mergeLatteParts promotes referenced and explicit concepts, canonicalizes exemplar parent casing, and orders concepts before exemplars',
    mergedConcept.conditions.map(c => c.name).join('|') === 'Perfusion|Heart Failure|Gas Exchange|Dehydration' &&
    mergedConcept.conditions[0].entryRole === 'concept' &&
    mergedConcept.conditions[0].concept === undefined &&
    mergedConcept.conditions[1].entryRole === 'exemplar' &&
    mergedConcept.conditions[1].concept === 'Perfusion' &&
    mergedConcept.conditions[2].entryRole === 'concept' &&
    mergedConcept.conditions[3].entryRole === undefined &&
    JSON.stringify(mergedConcept.metadata.concepts) === '["Gas Exchange"]' &&
    mergedConcept.metadata.conceptAuto === true);

  const hfFacts = mergedConcept.conditions[1].facts;
  t('v19.2: mergeLatteParts upgrades duplicate fact conceptScope to differentiator and strips invalid conceptScope/entryRole into coerced diagnostics',
    hfFacts.length === 3 &&
    hfFacts.find(f => f.text.includes('S3 ventricular gallop')).conceptScope === 'differentiator' &&
    hfFacts.find(f => f.text.includes('IV loop diuretic')).conceptScope === undefined &&
    mergedConcept.coerced.length === 2 &&
    mergedConcept.coerced.some(c => c.reason.includes('unknown entryRole')) &&
    mergedConcept.coerced.some(c => c.reason.includes('unknown conceptScope')));

  const plainMerged = KB.mergeLatteParts([
    { source: { filename: 'plain.pdf', range: 'p. 1' }, conditions: [{ name: 'Hypokalemia', facts: [{ latteBucket: 'Look', tier: 1, text: 'Prominent U waves.', sourceQuote: 'Prominent U waves', sourcePointer: { filename: 'plain.pdf', location: 'p. 1' } }] }] }
  ], 'NUR 101', 'Exam 1');
  t('v19.2: plain non-concept mergeLatteParts adds zero concept keys to metadata, conditions, or facts',
    !('concepts' in plainMerged.metadata) && !('conceptAuto' in plainMerged.metadata) &&
    !('entryRole' in plainMerged.conditions[0]) && !('concept' in plainMerged.conditions[0]) &&
    !('conceptScope' in plainMerged.conditions[0].facts[0]));

  // ── 3. kbNormalizeImported import coercion, ordering, and strict restore validation ──
  const copy = x => JSON.parse(JSON.stringify(x));
  const importedOnce = KB.kbNormalizeImported(copy(mergedConcept));
  const restoredConcept = KB.kbNormalizeImported(copy(importedOnce.kb), { restore: true });
  t('v19.2: concept KB round-trips entryRole, concept, conceptScope, metadata.concepts and metadata.conceptAuto across import and strict restore',
    restoredConcept.kb.conditions[0].entryRole === 'concept' &&
    restoredConcept.kb.conditions[1].entryRole === 'exemplar' &&
    restoredConcept.kb.conditions[1].concept === 'Perfusion' &&
    restoredConcept.kb.conditions[1].facts[1].conceptScope === 'differentiator' &&
    JSON.stringify(restoredConcept.kb.metadata.concepts) === '["Gas Exchange"]' &&
    restoredConcept.kb.metadata.conceptAuto === true);

  const untrustedImport = KB.kbNormalizeImported({
    metadata: { course: 'NUR', exam: 'E1', concepts: 'Perfusion, Mobility' },
    conditions: [
      { name: 'DVT', concept: 'Perfusion', facts: [{ latteBucket: 'Assess', tier: 1, conceptScope: 'weird', text: 'Unilateral calf swelling.', sources: [{ filename: 'a.pdf', location: 'p. 1' }] }] },
      { name: 'Perfusion', entryRole: 'CONCEPT', facts: [{ latteBucket: 'BriefPatho', tier: 1, conceptScope: 'SHARED', text: 'Pump and vessels.', sources: [{ filename: 'a.pdf', location: 'p. 1' }] }] },
      { name: 'Sprain', entryRole: 'mystery', facts: [{ latteBucket: 'Look', tier: 2, text: 'Joint edema.', sources: [{ filename: 'a.pdf', location: 'p. 2' }] }] }
    ]
  });
  t('v19.2: external import orders concept before exemplar, normalizes case, infers exemplar role from concept, and warns on unknown values',
    untrustedImport.kb.conditions.map(c => c.name).join('|') === 'Perfusion|DVT|Sprain' &&
    untrustedImport.kb.conditions[0].entryRole === 'concept' &&
    untrustedImport.kb.conditions[0].facts[0].conceptScope === 'shared' &&
    untrustedImport.kb.conditions[1].entryRole === 'exemplar' &&
    untrustedImport.kb.conditions[1].facts[0].conceptScope === undefined &&
    untrustedImport.kb.conditions[2].entryRole === undefined &&
    JSON.stringify(untrustedImport.kb.metadata.concepts) === '["Perfusion","Mobility"]' &&
    untrustedImport.warnings.length === 2);

  const throwsOnRestore = mut => {
    const snap = copy(restoredConcept.kb);
    mut(snap);
    try { KB.kbNormalizeImported(snap, { restore: true }); return false; }
    catch (e) { return /Saved Knowledge Base/.test(e.message); }
  };
  t('v19.2: strict restore rejects tampered conceptScope, entryRole, metadata.concepts, and metadata.conceptAuto',
    throwsOnRestore(s => { s.conditions[0].entryRole = 'bogus'; }) &&
    throwsOnRestore(s => { s.conditions[1].facts[0].conceptScope = 'bogus'; }) &&
    throwsOnRestore(s => { s.metadata.concepts = 'not-an-array'; }) &&
    throwsOnRestore(s => { s.metadata.conceptAuto = 'yes'; }));

  // ── 4. KnowledgeBaseBuilder.build() end-to-end with Pass 1 + Pass 2 omission audit in concept mode ──
  {
    const buildSpan = span('const build=async()=>{', '\n  const exportDiag=()=>{');
    const sourceText = 'Perfusion depends on cardiac output and systemic vascular resistance. Monitor capillary refill and peripheral pulses. Heart failure ventricular remodeling decreases stroke volume. Auscultate S3 gallop. Check BNP level.';
    const pass1Reply = {
      conditions: [
        { name: 'Perfusion', entryRole: 'concept', aliases: [], facts: [
          { latteBucket: 'BriefPatho', subtype: null, factType: 'definition', tier: 1, safetyCritical: false, conceptScope: 'shared', text: 'Perfusion depends on cardiac output and systemic vascular resistance.', sourceQuote: 'Perfusion depends on cardiac output and systemic vascular resistance' },
          { latteBucket: 'Assess', subtype: null, factType: 'other', tier: 1, safetyCritical: false, conceptScope: 'shared', text: 'Monitor capillary refill and peripheral pulses.', sourceQuote: 'Monitor capillary refill and peripheral pulses' }
        ]},
        { name: 'Heart Failure', entryRole: 'exemplar', concept: 'Perfusion', aliases: ['HF'], facts: [
          { latteBucket: 'BriefPatho', subtype: null, factType: 'definition', tier: 1, safetyCritical: false, conceptScope: 'delta', text: 'Ventricular remodeling decreases stroke volume.', sourceQuote: 'Heart failure ventricular remodeling decreases stroke volume' },
          { latteBucket: 'Assess', subtype: null, factType: 'other', tier: 1, safetyCritical: true, conceptScope: 'differentiator', text: 'Auscultate S3 gallop.', sourceQuote: 'Auscultate S3 gallop' }
        ]}
      ],
      medications: [], diagnostics: [], scoringTools: [], formulas: [], contradictions: []
    };
    const pass2Reply = {
      missed: [
        { conditionName: 'Heart Failure', entryRole: 'exemplar', concept: 'Perfusion', latteBucket: 'Tests', subtype: null, factType: 'lab', tier: 1, safetyCritical: false, conceptScope: 'delta', text: 'Check BNP level.', sourceQuote: 'Check BNP level' }
      ]
    };
    const state = { published: [], diag: null, logs: [], warnings: [], error: '', requests: [] };
    const files = [{ name: 'perfusion.pdf' }];
    const buildFn = new Function(
      'cfg','files','currentFiles','kbConfirmReplace','replacementSlot','setBusy','setError','setWarnings','setProg','setDiag','setLogs','setSelected','addLog','abortRef',
      'kbOutcomes','kbPoints','kbExtra','focusMode','kbConcepts','kbConceptAuto','cardGate','cardIsImage','kbBuildSourceChunks','chunkChars','overlapUnits','probeComposition',
      'laneCount','verifyPass','KB_EXTRACTION_PROMPT','KB_VERIFY_PROMPT','kbBuildFocusBlock','kbNormForMatch','kbDehyphNormForMatch','kbCanonOperators','kbClassifyQuoteMiss',
      'geminiRequest','kbValidateExtractionEnvelope','extractJSON','kbSplitChunk','geminiHaltsBatch','kbQuoteInSource','kbQuoteOperatorsAgree','kbRunLanes','kbCompareOrder',
      'mergeLatteParts','course','exam','kbFlagUnderextraction','kbBucketGaps','K',
      buildSpan + '\n;return build;'
    )(
      { apiKey: 'k', autoProfile: true, forTool: () => ({ model: 'm', level: 'low' }) },
      files, { current: files }, () => true,
      { current: { start: () => ({ ctl: new AbortController() }), current: () => true, owns: () => true, finish: () => true } },
      () => {}, e => { state.error = e; }, w => { state.warnings = w; }, () => {}, d => { state.diag = d; }, () => {}, () => {},
      (m, tp) => state.logs.push({ m, tp }), { current: null },
      '', '', '', 'scope', 'Perfusion', true,
      { buildable: [], blocked: [] }, () => false,
      async () => [{ text: sourceText, label: 'page 1', units: [{ n: 1, text: sourceText }] }],
      15000, 1, false, 1, true, 'EXTRACT ONE supplied source file', 'VERIFY', KB.kbBuildFocusBlock,
      s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      s => String(s || ''), () => 'absent',
      async (_k, _m, body, opts) => { const txt = JSON.stringify(body); state.requests.push(txt); opts.onMeta?.({ truncated: false }); return JSON.stringify(txt.includes('FACTS ALREADY EXTRACTED') ? pass2Reply : pass1Reply); },
      v => v, JSON.parse, () => null, () => false,
      (q, src) => src.includes(String(q || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()),
      () => true, async (q, _l, fn) => { while (q.length) await fn(q.shift()); }, () => 0,
      KB.mergeLatteParts, 'NUR 210', 'Exam 2', x => x, () => [], { setKnowledgeBase: x => state.published.push(x) }
    );
    await buildFn();
    const built = state.published[0];
    const recoveredBnp = built.conditions[1].facts.find(f => f.text === 'Check BNP level.');
    t('v19.2: build() in concept mode keeps scoped=false when Focus text is blank, tags Pass-2 inventory with concept roles, and lifts recovered entryRole/concept off fact objects',
      !state.error &&
      state.diag.focus === null &&
      state.requests.length === 2 &&
      state.requests[0].includes('CONCEPT-BASED CURRICULUM RULES (P-LATE):') &&
      state.requests[1].includes('# Perfusion [CONCEPT OVERVIEW]') &&
      state.requests[1].includes('# Heart Failure [Exemplar of Perfusion]') &&
      !!recoveredBnp && recoveredBnp.recovered === true && recoveredBnp.conceptScope === 'delta' &&
      !('entryRole' in recoveredBnp) && !('concept' in recoveredBnp));
  }

  // ── 5. Study View (renderKBMarkdown): Hidden "P" bridge, cited BriefPatho, Priority Differentiators, and Shared separation ──
  {
    const md = VIEW.renderKBMarkdown({
      conditions: [
        {
          name: 'Perfusion',
          entryRole: 'concept',
          facts: [
            { id: 'f1', latteBucket: 'BriefPatho', tier: 1, conceptScope: 'shared', text: 'Adequate perfusion requires intact cardiac output and vascular tone.', sources: [{ filename: 'giddens.pdf', location: 'p. 10' }] },
            { id: 'f2', latteBucket: 'Assess', tier: 1, conceptScope: 'shared', text: 'Assess capillary refill and peripheral pulses.', sources: [{ filename: 'giddens.pdf', location: 'p. 11' }] }
          ]
        },
        {
          name: 'Heart Failure',
          entryRole: 'exemplar',
          concept: 'Perfusion',
          facts: [
            { id: 'f3', latteBucket: 'BriefPatho', tier: 1, conceptScope: 'delta', text: 'Ventricular remodeling impairs contractility and stroke volume.', sources: [{ filename: 'giddens.pdf', location: 'p. 22' }] },
            { id: 'f4', latteBucket: 'Assess', tier: 2, conceptScope: 'delta', text: 'Monitor daily weight before breakfast.', sources: [{ filename: 'giddens.pdf', location: 'p. 23' }] },
            { id: 'f5', latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', text: 'Pink frothy sputum signals acute pulmonary edema.', sources: [{ filename: 'giddens.pdf', location: 'p. 24' }] },
            { id: 'f6', latteBucket: 'Assess', tier: 2, conceptScope: 'shared', text: 'Check blood pressure and heart rate.', sources: [{ filename: 'giddens.pdf', location: 'p. 23' }] }
          ]
        }
      ]
    });
    t('v19.2: Study view renders Concept Overview banner and cited P — Baseline Physiology & Risk Factors bullets',
      md.includes('> **◆ Overarching Concept Overview**') &&
      md.includes('### P — Baseline Physiology & Risk Factors (Patho)\n- Adequate perfusion requires intact cardiac output and vascular tone.  \n  *Source: giddens.pdf, p. 10*'));
    t('v19.2: Study view renders Exemplar Concept Bridge (P), sorts and flags Priority Differentiators first, and separates residual shared facts',
      md.includes('> **↳ Exemplar of Perfusion**') &&
      md.includes('### P — Pathophysiology & Hemodynamic Driver (Concept Bridge → Perfusion)\n- Ventricular remodeling impairs contractility and stroke volume.  \n  *Source: giddens.pdf, p. 22*') &&
      md.indexOf('**⚑ Priority Differentiator:** Pink frothy sputum') > 0 &&
      md.indexOf('**⚑ Priority Differentiator:** Pink frothy sputum') < md.indexOf('- Monitor daily weight before breakfast.') &&
      md.indexOf('- Monitor daily weight before breakfast.') < md.indexOf('*Shared with Perfusion:*\n- Check blood pressure and heart rate.'));
  }

  // ── 6. Downstream Connector 1: Priority (kbForPriority) & NCLEX (kbForNCLEX, ngBuildFactPool, ngFactRow) ──
  {
    const conceptKB = {
      conditions: [
        { id: 'perfusion', name: 'Perfusion', entryRole: 'concept', aliases: [], facts: [{ id: 'f1', latteBucket: 'Assess', tier: 1, conceptScope: 'shared', text: 'Check capillary refill.', sources: [{ filename: 'c.pdf', location: 'p. 1' }] }] },
        { id: 'hf', name: 'Heart Failure', entryRole: 'exemplar', concept: 'Perfusion', aliases: ['HF'], facts: [{ id: 'f2', latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', text: 'Auscultate S3 gallop.', sources: [{ filename: 'c.pdf', location: 'p. 2' }] }] },
        { id: 'pad', name: 'Peripheral Arterial Disease', entryRole: 'exemplar', concept: 'Perfusion', aliases: ['PAD'], facts: [{ id: 'f3', latteBucket: 'Treatments', tier: 1, conceptScope: 'delta', text: 'Keep legs in dependent position.', sources: [{ filename: 'c.pdf', location: 'p. 3' }] }] },
        { id: 'asthma', name: 'Asthma', entryRole: 'exemplar', concept: 'Gas Exchange', aliases: [], facts: [{ id: 'f4', latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', text: 'Silent chest indicates impending respiratory failure.', sources: [{ filename: 'c.pdf', location: 'p. 9' }] }] }
      ]
    };
    const prioPerfusion = VIEW.kbForPriority(conceptKB, { conditionQuery: 'perfusion' });
    const nclexPerfusion = VIEW.kbForNCLEX(conceptKB, { conditionQuery: 'perfusion' });
    const poolPerfusion = VIEW.ngBuildFactPool(conceptKB, { conditionQuery: 'perfusion' });

    t('v19.2: Priority packet matches parent concept filter, labels Concept Overview and Exemplar headings, and marks PRIORITY DIFFERENTIATOR',
      prioPerfusion.includes('## Perfusion [Concept Overview]') &&
      prioPerfusion.includes('## Heart Failure [Exemplar of Perfusion]') &&
      prioPerfusion.includes('## Peripheral Arterial Disease [Exemplar of Perfusion]') &&
      prioPerfusion.includes('[KB f2; PLATE Assess; PRIORITY DIFFERENTIATOR; source-tier T1; c.pdf, p. 2]') &&
      !prioPerfusion.includes('Asthma'));

    t('v19.2: NCLEX packet and ngBuildFactPool match parent concept filter across all exemplars and tag [Concept Overview], [Exemplar of ...], and [PRIORITY DIFFERENTIATOR] in ngFactRow',
      poolPerfusion.map(g => g.condition).join('|') === 'Perfusion|Heart Failure|Peripheral Arterial Disease' &&
      poolPerfusion[1].concept === 'Perfusion' &&
      nclexPerfusion.includes('KBFACT f1 | CONDITION: Perfusion [Concept Overview] | PLATE: Assess [Shared Concept Baseline] | TIER: 1') &&
      nclexPerfusion.includes('KBFACT f2 | CONDITION: Heart Failure [Exemplar of Perfusion] | PLATE: Assess [PRIORITY DIFFERENTIATOR] | TIER: 1') &&
      nclexPerfusion.includes('KBFACT f3 | CONDITION: Peripheral Arterial Disease [Exemplar of Perfusion] | PLATE: Treatments | TIER: 1') &&
      !nclexPerfusion.includes('Asthma'));
  }

  // ── 7. Downstream Connector 2: Case Studies (selectCaseFacts parent-concept top-up + caseRenderFactPacket + validateCaseStudy) ──
  {
    const parentCond = {
      id: 'perfusion',
      name: 'Perfusion',
      entryRole: 'concept',
      aliases: ['Tissue Perfusion'],
      facts: [
        { id: 'p-patho', latteBucket: 'BriefPatho', tier: 1, conceptScope: 'shared', text: 'Cardiac output equals heart rate times stroke volume.', sourceQuote: 'Cardiac output equals heart rate times stroke volume', sources: [{ filename: 'c.pdf', location: 'p. 1' }] },
        { id: 'p-test1', latteBucket: 'Tests', tier: 1, conceptScope: 'shared', text: 'Serum lactate above 2 mmol/L indicates tissue hypoperfusion.', sourceQuote: 'Serum lactate above 2 mmol/L', sources: [{ filename: 'c.pdf', location: 'p. 2' }] },
        { id: 'p-test2', latteBucket: 'Tests', tier: 2, conceptScope: 'shared', text: 'Monitor hemoglobin and hematocrit.', sourceQuote: 'Monitor hemoglobin and hematocrit', sources: [{ filename: 'c.pdf', location: 'p. 2' }] },
        { id: 'p-test3', latteBucket: 'Tests', tier: 2, conceptScope: 'shared', text: 'Check baseline serum creatinine.', sourceQuote: 'Check baseline serum creatinine', sources: [{ filename: 'c.pdf', location: 'p. 2' }] },
        { id: 'p-edu1', latteBucket: 'Educate', tier: 1, conceptScope: 'shared', text: 'Report sudden dizziness or syncope immediately.', sourceQuote: 'Report sudden dizziness or syncope', sources: [{ filename: 'c.pdf', location: 'p. 3' }] }
      ]
    };
    const exemplarCond = {
      id: 'hf',
      name: 'Heart Failure',
      entryRole: 'exemplar',
      concept: 'Perfusion',
      aliases: ['HF'],
      facts: [
        { id: 'e-patho', latteBucket: 'BriefPatho', tier: 1, conceptScope: 'delta', text: 'Ventricular remodeling lowers ejection fraction.', sourceQuote: 'Ventricular remodeling lowers ejection fraction', sources: [{ filename: 'c.pdf', location: 'p. 5' }] },
        { id: 'e-look', latteBucket: 'Look', tier: 1, conceptScope: 'delta', text: 'Orthopnea and paroxysmal nocturnal dyspnea.', sourceQuote: 'Orthopnea and paroxysmal nocturnal dyspnea', sources: [{ filename: 'c.pdf', location: 'p. 5' }] },
        { id: 'e-ass-delta', latteBucket: 'Assess', tier: 1, safetyCritical: false, conceptScope: 'delta', text: 'Check jugulovenous distention at 45 degrees.', sourceQuote: 'jugulovenous distention at 45 degrees', sources: [{ filename: 'c.pdf', location: 'p. 6' }] },
        { id: 'e-ass-diff', latteBucket: 'Assess', tier: 2, safetyCritical: false, conceptScope: 'differentiator', text: 'Crackles ascending to lung apices signal flash pulmonary edema.', sourceQuote: 'Crackles ascending to lung apices', sources: [{ filename: 'c.pdf', location: 'p. 6' }] },
        { id: 'e-tx', latteBucket: 'Treatments', tier: 1, safetyCritical: true, conceptScope: 'differentiator', text: 'Give furosemide 40 mg IV push slowly.', sourceQuote: 'Give furosemide 40 mg IV push slowly', sources: [{ filename: 'c.pdf', location: 'p. 7' }] }
      ]
    };
    const allConds = [parentCond, exemplarCond];
    const picked = selectCaseFacts(exemplarCond, { includeTier2: true, includeCalculation: true, includeEducation: true, allConditions: allConds });
    const pickedIds = picked.map(f => f.id);
    const parentPicked = picked.filter(f => f.id.startsWith('p-')).map(f => f.id);
    const conceptSelfPicked = selectCaseFacts(parentCond, { includeTier2: true, allConditions: allConds }).map(f => f.id);

    t('v19.2: selectCaseFacts ranks exemplar differentiator ahead of higher-tier delta, tops up sparse buckets from parent concept (capped at 2/bucket), and never pulls exemplar facts into a concept case',
      pickedIds.indexOf('e-ass-diff') < pickedIds.indexOf('e-ass-delta') &&
      parentPicked.includes('p-patho') &&
      parentPicked.includes('p-test1') &&
      parentPicked.includes('p-test2') &&
      !parentPicked.includes('p-test3') &&
      parentPicked.includes('p-edu1') &&
      parentPicked.length <= 6 &&
      conceptSelfPicked.every(id => id.startsWith('p-')));

    const packet = caseRenderFactPacket('Heart Failure', picked);
    t('v19.2: caseRenderFactPacket labels [PRIORITY DIFFERENTIATOR] and [SHARED PARENT CONCEPT] facts',
      packet.includes('PLATE: Assess [PRIORITY DIFFERENTIATOR]') &&
      packet.includes('PLATE: Tests [SHARED PARENT CONCEPT]'));

    // Verify validateCaseStudy accepts parent-concept fact IDs included in allowedFactIds for an exemplar case.
    const fi = new Map();
    for (const c of allConds) for (const f of c.facts) fi.set(f.id.toLowerCase(), { fact: f, condition: c });
    const allowed = new Set(picked.map(f => f.id.toLowerCase()));
    const validCase = {
      title: 'Unfolding Case',
      condition: 'Heart Failure',
      patient: { name: ' Jordan ', age: 64, sex: 'F', background: 'Admitted to the telemetry unit at 0800.' },
      stages: [{
        stageNumber: 1,
        title: 'Arrival',
        narrative: 'The nurse enters Room 402.',
        data: [
          { label: 'Lung sounds', value: 'Crackles ascending to lung apices', availability: 'revealed', supportType: 'direct', factIds: ['e-ass-diff'] },
          { label: 'Serum lactate', value: '3 mmol/L (above 2 mmol/L)', availability: 'revealed', supportType: 'instantiated', factIds: ['p-test1'] }
        ],
        questions: [{
          id: 'q1',
          type: 'MCQ',
          cjmmStep: 'Take Action',
          stem: 'Which prescription should the nurse implement first for this client?',
          options: [
            { label: 'A', text: 'Administer furosemide 40 mg IV push slowly.' },
            { label: 'B', text: 'Recheck findings in four hours.' },
            { label: 'C', text: 'Provide routine discharge paperwork.' },
            { label: 'D', text: 'Ambulate the client down the hall.' }
          ],
          correctAnswers: ['A'],
          rationales: [
            { option: 'A', text: 'Furosemide 40 mg IV push treats acute pulmonary congestion while lactate above 2 mmol/L reflects hypoperfusion.', supportType: 'combined', factIds: ['e-tx', 'p-test1'] },
            { option: 'B', text: 'Delaying care worsens acute pulmonary edema.', supportType: 'inference', factIds: ['e-ass-diff'] },
            { option: 'C', text: 'Discharge teaching applies after stabilization, such as reporting syncope.', supportType: 'direct', factIds: ['p-edu1'] },
            { option: 'D', text: 'Exertion increases oxygen demand duringorthopnea.', supportType: 'direct', factIds: ['e-look'] }
          ]
        }]
      }],
      debrief: { summary: 'Prompt diuresis addresses pulmonary congestion.', notes: '' }
    };
    const caseIssues = CASEV.validateCaseStudy(validCase, fi, allowed, exemplarCond.name);
    t('v19.2: validateCaseStudy accepts an exemplar case citing both exemplar facts and topped-up parent-concept facts with zero errors',
      !caseIssues.some(i => i.sev === 'error'));
  }

  // ── 8. UI source contracts for Step 01 Option B controls, browser hierarchy, fact badges, and Case selector ──
  t('v19.2: UI wires Step 01 Overarching concept(s) + Auto-detect controls, browser concept/exemplar badges, KBFactList & FactInspectorDrawer scope badges, and CaseStudyGenerator allConditions',
    S.includes('id="kb-concepts"') &&
    S.includes('Auto-detect overarching concepts from source') &&
    S.includes("c.entryRole==='concept'?'◆ ':(!c.entityKind&&c.concept)?'↳ ':''") &&
    S.includes("f.conceptScope==='differentiator'&&<span className=\"tier-badge t1\"") &&
    S.includes("fact.conceptScope==='differentiator'&&<span className=\"tier-badge t1\">⚑ priority differentiator</span>") &&
    S.includes('allConditions:conditions'));

  // ── 9. KB Enhancements (1A–1C): Concept drift canonicalization, cross-sibling shared hoist, auditKbConcepts, entity linking, and relatedConcepts ──
  {
    const driftMerged = KB.mergeLatteParts([
      {
        source: { filename: 'resp.pdf', range: 'p. 1-4' },
        conditions: [
          {
            name: 'Gas Exchange',
            entryRole: 'concept',
            facts: [{ latteBucket: 'BriefPatho', tier: 1, conceptScope: 'shared', text: 'Alveolar-capillary diffusion moves oxygen and carbon dioxide.', sourceQuote: 'Alveolar-capillary diffusion', sourcePointer: { filename: 'resp.pdf', location: 'p. 1' } }]
          },
          {
            name: 'COPD',
            concept: 'Impaired Gas Exchange',
            relatedConcepts: ['Acid-Base Balance', 'Gas Exchange', 'COPD'],
            facts: [
              { latteBucket: 'BriefPatho', tier: 1, conceptScope: 'delta', text: 'Chronic airway remodeling traps air and flattens the diaphragm.', sourceQuote: 'traps air and flattens the diaphragm', sourcePointer: { filename: 'resp.pdf', location: 'p. 2' } },
              { latteBucket: 'Assess', tier: 1, conceptScope: 'delta', text: 'Monitor continuous pulse oximetry and respiratory rate closely.', sourceQuote: 'Monitor continuous pulse oximetry and respiratory rate', sourcePointer: { filename: 'resp.pdf', location: 'p. 2' } },
              { latteBucket: 'Treatments', tier: 1, conceptScope: 'differentiator', text: 'Target SpO2 88% to 92% to avoid blunting hypoxic drive.', sourceQuote: 'Target SpO2 88% to 92%', sourcePointer: { filename: 'resp.pdf', location: 'p. 2' } }
            ]
          }
        ],
        medications: [
          { name: 'Albuterol', concept: 'Altered Gas Exchange', relatedConcepts: ['Perfusion'], class: 'Short-acting beta-2 agonist', indications: ['Acute bronchospasm in COPD and asthma'], sourcePointer: { filename: 'resp.pdf', location: 'p. 3' } }
        ]
      },
      {
        source: { filename: 'resp.pdf', range: 'p. 5-8' },
        conditions: [
          {
            name: 'Asthma',
            concept: 'Gas Exchange',
            facts: [
              { latteBucket: 'BriefPatho', tier: 1, conceptScope: 'delta', text: 'Reversible IgE-mediated airway inflammation and bronchoconstriction.', sourceQuote: 'IgE-mediated airway inflammation', sourcePointer: { filename: 'resp.pdf', location: 'p. 5' } },
              { latteBucket: 'Assess', tier: 1, conceptScope: 'delta', text: 'Monitor continuous pulse oximetry and respiratory rate closely.', sourceQuote: 'Monitor continuous pulse oximetry and respiratory rate', sourcePointer: { filename: 'resp.pdf', location: 'p. 5' } }
            ]
          }
        ]
      }
    ], 'NUR 210', 'Exam 3', null, { concepts: 'Gas Exchange', conceptAuto: false });

    const geOverview = driftMerged.conditions.find(c => c.name === 'Gas Exchange');
    const copd = driftMerged.conditions.find(c => c.name === 'COPD');
    const asthma = driftMerged.conditions.find(c => c.name === 'Asthma');
    t('v19.2 (1A/1C): mergeLatteParts canonicalizes "Impaired/Altered Gas Exchange" drift, hoists exact duplicate sibling facts to parent Concept Overview as shared, and sanitizes relatedConcepts',
      copd.concept === 'Gas Exchange' &&
      driftMerged.medications[0].concept === 'Gas Exchange' &&
      JSON.stringify(driftMerged.medications[0].relatedConcepts) === '["Perfusion"]' &&
      JSON.stringify(copd.relatedConcepts) === '["Acid-Base Balance"]' &&
      driftMerged.hoistedShared === 1 &&
      geOverview.facts.some(f => f.text.includes('Monitor continuous pulse oximetry') && f.conceptScope === 'shared') &&
      !copd.facts.some(f => f.text.includes('Monitor continuous pulse oximetry')) &&
      !asthma.facts.some(f => f.text.includes('Monitor continuous pulse oximetry')));

    const rt = KB.kbNormalizeImported(JSON.parse(JSON.stringify(driftMerged)));
    const restored = KB.kbNormalizeImported(JSON.parse(JSON.stringify(rt.kb)), { restore: true });
    let badRelRejected = false;
    try {
      const broken = JSON.parse(JSON.stringify(restored.kb));
      broken.conditions[1].relatedConcepts = 'not-an-array';
      KB.kbNormalizeImported(broken, { restore: true });
    } catch (e) { badRelRejected = /Saved Knowledge Base/.test(e.message); }
    t('v19.2 (1B/1C): relatedConcepts and entity concept round-trip through import/restore and strict restore rejects malformed relatedConcepts',
      JSON.stringify(restored.kb.conditions[1].relatedConcepts) === '["Acid-Base Balance"]' &&
      restored.kb.medications[0].concept === 'Gas Exchange' &&
      badRelRejected);

    // Deterministic entity inference in kbFactView + interrelated concept matching across consumers
    const inferKB = {
      conditions: [
        { id: 'ge', name: 'Gas Exchange', entryRole: 'concept', aliases: [], facts: [{ id: 'f-ge', latteBucket: 'BriefPatho', tier: 1, conceptScope: 'shared', text: 'Ventilation and diffusion.', sources: [{ filename: 'r.pdf', location: 'p. 1' }] }] },
        { id: 'copd', name: 'COPD', entryRole: 'exemplar', concept: 'Gas Exchange', relatedConcepts: ['Acid-Base Balance'], aliases: [], facts: [{ id: 'f-copd', latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', text: 'Respiratory acidosis on ABG.', sources: [{ filename: 'r.pdf', location: 'p. 2' }] }] },
        { id: 'hf', name: 'Heart Failure', entryRole: 'exemplar', concept: 'Perfusion', aliases: ['HF'], facts: [{ id: 'f-hf', latteBucket: 'Look', tier: 1, conceptScope: 'delta', text: 'Orthopnea.', sources: [{ filename: 'p.pdf', location: 'p. 9' }] }] }
      ],
      medications: [
        { name: 'Tiotropium', facts: [{ id: 'f-tio', latteBucket: 'Treatments', tier: 1, text: 'Long-acting bronchodilator for COPD maintenance.', sources: [{ filename: 'r.pdf', location: 'p. 3' }] }] },
        { name: 'AmbiguousIV', facts: [{ id: 'f-amb', latteBucket: 'Treatments', tier: 1, text: 'Used in both COPD and Heart Failure.', sources: [{ filename: 'x.pdf', location: 'p. 1' }] }] }
      ],
      diagnostics: [
        { name: 'Capnography', facts: [{ id: 'f-cap', latteBucket: 'Tests', tier: 1, text: 'Measures end-tidal CO2.', sources: [{ filename: 'r.pdf', location: 'p. 2' }] }] }
      ]
    };
    const fView = VIEW.kbFactView(inferKB);
    const tioG = fView.conditions.find(c => c.name === 'Tiotropium');
    const capG = fView.conditions.find(c => c.name === 'Capnography');
    const ambG = fView.conditions.find(c => c.name === 'AmbiguousIV');
    const acidPrio = VIEW.kbForPriority(fView, { conditionQuery: 'acid-base' });
    const acidNclex = VIEW.kbForNCLEX(fView, { conditionQuery: 'acid-base' });
    const studyMd = VIEW.renderKBMarkdown(fView);
    t('v19.2 (1B/1C): kbFactView infers unambiguous entity parent concepts from text or source co-location, leaves ambiguous entities unlinked, and matches relatedConcepts in downstream filters',
      tioG.concept === 'Gas Exchange' &&
      capG.concept === 'Gas Exchange' &&
      ambG.concept === undefined &&
      acidPrio.includes('COPD') && !acidPrio.includes('Heart Failure') &&
      acidNclex.includes('f-copd') && !acidNclex.includes('f-hf') &&
      studyMd.includes('Interrelated concepts: Acid-Base Balance') &&
      studyMd.includes('Linked to Gas Exchange'));

    // auditKbConcepts warn-only diagnostics (evaluated over kbFactView just like KnowledgeBaseBuilder)
    const plainAudit = KB.auditKbConcepts(VIEW.kbFactView({ conditions: [{ name: 'Appendicitis', facts: [{ id: 'f1', latteBucket: 'Look', text: 'RLQ pain.' }] }] }));
    const auditSample = KB.auditKbConcepts(VIEW.kbFactView({
      conditions: [
        { name: 'Perfusion', entryRole: 'concept', facts: [{ id: 'f1', latteBucket: 'BriefPatho', conceptScope: 'shared', text: 'Cardiac output.' }] },
        { name: 'Heart Failure', entryRole: 'exemplar', concept: 'Perfusion', facts: [{ id: 'f2', latteBucket: 'Assess', conceptScope: 'delta', text: 'Monitor daily weight every morning before breakfast using same scale.' }] },
        { name: 'Cardiomyopathy', entryRole: 'exemplar', concept: 'Perfusion', facts: [
          { id: 'f3', latteBucket: 'BriefPatho', conceptScope: 'delta', text: 'Dilated chambers.' },
          { id: 'f4', latteBucket: 'Assess', conceptScope: 'delta', text: 'Monitor daily weight every morning before breakfast on the same scale.' }
        ] },
        { name: 'Asthma', entryRole: 'exemplar', concept: 'Gas Exchange', facts: [{ id: 'f5', latteBucket: 'BriefPatho', conceptScope: 'delta', text: 'Bronchospasm.' }] }
      ],
      medications: [{ name: 'UnlinkedDrug', facts: [{ id: 'f6', latteBucket: 'Treatments', text: 'Take with water.' }] }]
    }));
    t('v19.2 (1A): auditKbConcepts is null on plain KBs and flags orphan concepts, missing BriefPatho bridges, multi-exemplar concepts without differentiators, sibling cue overlap, and unlinked entities',
      plainAudit === null &&
      auditSample.orphanExemplars.length === 1 && auditSample.orphanExemplars[0].concept === 'Gas Exchange' &&
      auditSample.missingBridgeExemplars.includes('Heart Failure') &&
      auditSample.missingDifferentiatorExemplars.length === 2 &&
      auditSample.nearDuplicateOverlaps.length === 1 && auditSample.nearDuplicateOverlaps[0].concept === 'Perfusion' &&
      auditSample.unlinkedEntities.includes('UnlinkedDrug') &&
      auditSample.issueCount === 5);
  }

  // ── 10. Flashcard Enhancements (2A–2C): kbForAnki roles/scopes, family chunking, sibling-contrast tags, Concept/Scope tag stamping, and scope filters ──
  {
    const plainAnkiKB = { conditions: [{ name: 'Appendicitis', aliases: [], facts: [{ id: 'fact-1', latteBucket: 'Look', tier: 1, text: 'McBurney point tenderness.', sources: [] }] }] };
    const plainPkt = ANKI_CONCEPT.kbForAnki(plainAnkiKB);
    const conceptAnkiKB = {
      conditions: [
        { name: 'Gas Exchange', entryRole: 'concept', aliases: [], facts: [{ id: 'fact-1', latteBucket: 'BriefPatho', tier: 1, conceptScope: 'shared', text: 'Ventilation-perfusion matching.', sources: [] }] },
        { name: 'COPD', entryRole: 'exemplar', concept: 'Gas Exchange', relatedConcepts: ['Acid-Base Balance'], aliases: [], facts: [
          { id: 'fact-2', latteBucket: 'BriefPatho', tier: 1, conceptScope: 'delta', text: 'Alveolar wall destruction causes air trapping.', sources: [] },
          { id: 'fact-3', latteBucket: 'Treatments', tier: 1, conceptScope: 'differentiator', text: 'Titrate oxygen to SpO2 88%-92%.', sources: [] },
          { id: 'fact-4', latteBucket: 'Educate', tier: 2, conceptScope: 'delta', text: 'Use pursed-lip breathing during dyspnea.', sources: [] }
        ] },
        { name: 'Asthma', entryRole: 'exemplar', concept: 'Gas Exchange', aliases: [], facts: [
          { id: 'fact-5', latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', text: 'Silent chest signals impending respiratory failure.', sources: [] }
        ] },
        { name: 'Heart Failure', entryRole: 'exemplar', concept: 'Perfusion', aliases: ['HF'], facts: [
          { id: 'fact-6', latteBucket: 'Look', tier: 1, conceptScope: 'delta', text: 'Paroxysmal nocturnal dyspnea.', sources: [] }
        ] }
      ]
    };
    const conceptPkt = ANKI_CONCEPT.kbForAnki(conceptAnkiKB);
    t('v19.2 (2B): kbForAnki emits CONCEPT ROLE and Scope metadata on concept KBs while leaving plain KB packets untouched',
      !plainPkt.includes('CONCEPT ROLE:') && !plainPkt.includes('| Scope:') &&
      conceptPkt.includes('CONCEPT ROLE: Overarching Concept Overview') &&
      conceptPkt.includes('CONCEPT ROLE: Exemplar of Gas Exchange | Interrelated: Acid-Base Balance') &&
      conceptPkt.includes('FACT fact-3 | PLATE: Treatments | Scope: differentiator | Tier: 1'));

    // Concept-family chunking: filler standalone condition first (~2200 chars), then Gas Exchange family (~1200 chars) with max=3000.
    // Without family grouping, Gas Exchange Overview would squeeze into chunk 1 and strand COPD/Asthma in chunk 2.
    const chunkedKB = {
      conditions: [
        { name: 'Standalone Topic', aliases: [], facts: [{ id: 'fact-90', latteBucket: 'Look', tier: 1, text: 'Clinical filler sentence for standalone block. '.repeat(42), sources: [] }] },
        ...conceptAnkiKB.conditions.slice(0, 3)
      ]
    };
    const familyChunks = ANKI_CONCEPT.ankiChunkText(ANKI_CONCEPT.kbForAnki(chunkedKB), 3100, 2);
    t('v19.2 (2B): ankiChunkText flushes an earlier partial chunk so a Concept Overview and its sibling exemplars stay together when the family fits',
      familyChunks.length === 2 &&
      familyChunks[0].includes('=== CONDITION: Standalone Topic ===') &&
      !familyChunks[0].includes('=== CONDITION: Gas Exchange ===') &&
      familyChunks[1].includes('=== CONDITION: Gas Exchange ===') &&
      familyChunks[1].includes('=== CONDITION: COPD ===') &&
      familyChunks[1].includes('=== CONDITION: Asthma ==='));

    const snap = ANKI_CONCEPT.ankiSourceSnapshot(conceptAnkiKB);
    const plainSnap = ANKI_CONCEPT.ankiSourceSnapshot(plainAnkiKB);
    const rawCards = [
      { id: 'c-ov', text: '[Gas Exchange] Matching: {{c1::V/Q}}.', extra: '', tags: 'Nursing::LATTE::Look Condition::GasExchange Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-1'], keep: true, tagFormatContract: 'hierarchical-v1' },
      { id: 'c-br', text: '[Gas Exchange → COPD] Mechanism: {{c1::air trapping}}.', extra: '', tags: 'Nursing::LATTE::Look Condition::COPD Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-2'], keep: true, tagFormatContract: 'hierarchical-v1' },
      { id: 'c-df', text: '[COPD] Priority SpO2 target: {{c1::88%-92%}}.', extra: '', tags: 'Nursing::LATTE::Treatments Condition::COPD Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-3'], keep: true, tagFormatContract: 'hierarchical-v1' },
      { id: 'c-ct1', text: '[Gas Exchange Contrast] COPD targets {{c1::SpO2 88%-92%}}, whereas asthma silent chest signals {{c2::respiratory failure}}.', extra: '', tags: 'Nursing::LATTE::Assess Topic::Contrast Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-3', 'fact-5'], keep: true, tagFormatContract: 'hierarchical-v1' },
      { id: 'c-ct2', text: '[Gas Exchange Contrast] COPD vs Asthma: {{c1::hypoxic drive}}.', extra: '', tags: 'Nursing::LATTE::Assess Condition::gasexchange Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-3', 'fact-5'], keep: true, tagFormatContract: 'hierarchical-v1' },
      { id: 'c-cross', text: 'Mixed unrelated concepts: {{c1::dyspnea}}.', extra: '', tags: 'Nursing::LATTE::Look Condition::COPD Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-3', 'fact-6'], keep: true, tagFormatContract: 'hierarchical-v1' }
    ];
    const normRes = ANKI_CONCEPT.ankiNormalizeConditionTags(rawCards, snap);
    const stamped = ANKI_CONCEPT.ankiStampConceptTags(normRes.cards, snap);
    const plainCard = [{ id: 'p1', text: 'Pain at {{c1::McBurney point}}.', extra: '', tags: 'Condition::Appendicitis Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-1'], keep: true }];

    t('v19.2 (2A/2B): ankiConditionTagCheck accepts same-concept sibling contrast notes (Topic::Contrast or Condition::<ConceptSlug>) while still flagging cross-concept mixed conditions',
      normRes.issues.length === 1 && normRes.issues[0].noteId === 'c-cross' && normRes.issues[0].code === 'mixed-conditions' &&
      normRes.changes.length === 1 && normRes.changes[0].noteId === 'c-ct2' && normRes.changes[0].to === 'Condition::GasExchange');

    t('v19.2 (2A): ankiStampConceptTags stamps Concept::<Slug> and Scope::<Overview|Bridge|Differentiator|Contrast> with zero lint errors and leaves plain KBs untouched',
      ANKI_CONCEPT.ankiStampConceptTags(plainCard, plainSnap) === plainCard &&
      !('concept' in plainSnap.facts[0]) &&
      stamped[0].tags.includes('Concept::GasExchange') && stamped[0].tags.includes('Scope::Overview') &&
      stamped[1].tags.includes('Concept::GasExchange') && stamped[1].tags.includes('Scope::Bridge') &&
      stamped[2].tags.includes('Concept::GasExchange') && stamped[2].tags.includes('Scope::Differentiator') &&
      stamped[3].tags.includes('Concept::GasExchange') && stamped[3].tags.includes('Scope::Contrast') &&
      stamped.slice(0, 5).every(c => ANKI_CONCEPT.lintAnkiCard(c).length === 0) &&
      ANKI_CONCEPT.ankiCardScopes(stamped[3].tags).join(',') === 'Contrast');

    const coreScoped = ANKI_CONCEPT.ankiFilterFactView(conceptAnkiKB, 'gas exchange', 'core');
    const diffScoped = ANKI_CONCEPT.ankiFilterFactView(conceptAnkiKB, '', 'differentiator');
    const deltaScoped = ANKI_CONCEPT.ankiFilterFactView(conceptAnkiKB, 'gas exchange', 'deltas');
    t('v19.2 (2C): ankiFilterFactView filters by overarching/interrelated concept and Concept Scope modes (core, differentiator, deltas)',
      ANKI_CONCEPT.ankiFilterFactView(conceptAnkiKB, '', 'all') === conceptAnkiKB &&
      coreScoped.conditions.flatMap(c => c.facts.map(f => f.id)).join(',') === 'fact-1,fact-2,fact-3,fact-5' &&
      diffScoped.conditions.flatMap(c => c.facts.map(f => f.id)).join(',') === 'fact-3,fact-5' &&
      deltaScoped.conditions.flatMap(c => c.facts.map(f => f.id)).join(',') === 'fact-2,fact-3,fact-4,fact-5');
  }

  // ── 11. NCLEX Enhancements (3A–3D): Differentiator weight, parent+sibling context co-allocation, concept Outcomes & [P#] focus matching, and Concept Blueprint Coverage ──
  {
    t('v19.2 (3B): kbFactWeight adds DIFFERENTIATOR_WEIGHT=2 while preserving BOX_TABLE_WEIGHT=2 on plain facts',
      VIEW.BOX_TABLE_WEIGHT === 2 && VIEW.DIFFERENTIATOR_WEIGHT === 2 &&
      VIEW.kbFactWeight({ sourceKind: 'prose' }) === 1 &&
      VIEW.kbFactWeight({ sourceKind: 'table' }) === 2 &&
      VIEW.kbFactWeight({ sourceKind: 'prose', conceptScope: 'differentiator' }) === 3 &&
      VIEW.kbFactWeight({ sourceKind: 'box', conceptScope: 'differentiator' }) === 4);

    const nclexConceptKB = {
      numberedPoints: [
        { id: 'P1', text: 'Hypoxic drive oxygen titration in chronic hypercapnia' }
      ],
      conditions: [
        { name: 'Gas Exchange', entryRole: 'concept', aliases: [], facts: [
          { id: 'ge-1', latteBucket: 'BriefPatho', tier: 1, conceptScope: 'shared', text: 'Gas exchange requires intact ventilation and perfusion.' },
          { id: 'ge-2', latteBucket: 'Assess', tier: 1, conceptScope: 'shared', text: 'Assess work of breathing, mental status, and skin color.' }
        ] },
        { name: 'COPD', entryRole: 'exemplar', concept: 'Gas Exchange', aliases: [], facts: [
          { id: 'copd-delta', latteBucket: 'Look', tier: 1, conceptScope: 'delta', text: 'Barrel chest and chronic productive cough.' },
          { id: 'copd-diff', latteBucket: 'Treatments', tier: 1, conceptScope: 'differentiator', pointAnchors: ['P1'], text: 'Maintain SpO2 between 88% and 92% with Venturi mask.' }
        ] },
        { name: 'Asthma', entryRole: 'exemplar', concept: 'Gas Exchange', aliases: [], facts: [
          { id: 'asth-diff', latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', text: 'Sudden absence of wheezing indicates imminent airway closure.' },
          { id: 'asth-delta', latteBucket: 'Treatments', tier: 1, conceptScope: 'delta', text: 'Administer inhaled albuterol during acute bronchospasm.' }
        ] },
        { name: 'Pneumonia', entryRole: 'exemplar', concept: 'Gas Exchange', aliases: [], facts: [
          { id: 'pna-diff', latteBucket: 'Tests', tier: 1, conceptScope: 'differentiator', text: 'Obtain sputum culture before starting IV antibiotics.' }
        ] }
      ]
    };
    const pool = VIEW.ngBuildFactPool(nclexConceptKB);
    t('v19.2 (3B): ngBuildFactPool ranks differentiator facts ahead of ordinary delta facts within each group and preserves non-enumerable numberedPoints',
      pool[1].facts.map(f => f.id).join(',') === 'copd-diff,copd-delta' &&
      Object.keys(pool).every(k => /^\d+$/.test(k)) &&
      Array.isArray(pool.numberedPoints) && pool.numberedPoints.length === 1);

    // Allocate 1 target starting at COPD (group index 1): targets gets copd-diff; context gets copd-delta (same condition) + ge-1,ge-2 (parent concept) + asth-diff,pna-diff (sibling exemplars)!
    const batch1 = VIEW.ngAllocateBatch(pool, new Set(), { want: 1, perCondition: 2, neighborCap: 2, start: 1 });
    const noCtxBatch = VIEW.ngAllocateBatch(pool, new Set(), { want: 1, perCondition: 2, neighborCap: 0, start: 1 });
    const rendered = VIEW.ngRenderAllocation(batch1.targets, batch1.context);
    t('v19.2 (3A): ngAllocateBatch co-allocates parent Concept Overview shared facts and sibling-exemplar facts into SUPPORTING CONTEXT when neighborCap > 0',
      batch1.targets.map(f => f.id).join(',') === 'copd-diff' &&
      batch1.context.map(f => f.id).join(',') === 'copd-delta,ge-1,ge-2,asth-diff,pna-diff' &&
      noCtxBatch.context.length === 0 &&
      rendered.includes('CONDITION: COPD [Exemplar of Gas Exchange]') &&
      rendered.includes('CONDITION: Gas Exchange [Concept Overview]') &&
      rendered.includes('[Shared Concept Baseline]') &&
      rendered.includes('[PRIORITY DIFFERENTIATOR]'));

    // Focus plan: Point 1 matches [P1] via persisted numberedPoints even though wording shares zero rare words with "Maintain SpO2 between 88% and 92% with Venturi mask";
    // Outcome 1 names overarching concept "Gas Exchange" and spreads round-robin across the Concept Overview and its exemplars!
    const fPlan = VIEW.ngFocusPlan(pool, {
      points: '• Hypoxic drive oxygen titration in chronic hypercapnia',
      outcomes: '1. Prioritize care for clients with impaired Gas Exchange',
      batches: 2,
      perItem: 3
    });
    t('v19.2 (3C): ngFocusPlan resolves [P#] pointAnchors via persisted numberedPoints and spreads concept-level Outcomes round-robin across exemplars',
      fPlan.items[0].facts.join(',') === 'copd-diff' &&
      fPlan.items[1].facts.length === 3 &&
      new Set(fPlan.items[1].facts).size === 3 &&
      fPlan.items[1].facts.includes('ge-1') &&
      fPlan.items[1].facts.includes('asth-diff') &&
      fPlan.items[1].facts.includes('pna-diff'));

    const cov = VIEW.ngConceptCoverage(pool, new Set(['ge-1', 'copd-diff', 'asth-diff']), new Set(['copd-diff', 'asth-diff']));
    const plainCov = VIEW.ngConceptCoverage([{ condition: 'Appendicitis', facts: [{ id: 'a1' }] }], new Set(['a1']), new Set(['a1']));
    t('v19.2 (3D): ngConceptCoverage computes per-concept exemplar, pool, allocated, cited, and differentiator totals and returns [] on plain KBs',
      plainCov.length === 0 &&
      cov.length === 1 &&
      cov[0].concept === 'Gas Exchange' &&
      cov[0].exemplarCount === 3 &&
      cov[0].poolFacts === 7 &&
      cov[0].allocated === 3 &&
      cov[0].cited === 2 &&
      cov[0].diffTotal === 3 &&
      cov[0].diffAllocated === 2 &&
      cov[0].diffCited === 2);

    t('v19.2 (1A/2C/3D): UI wires Concept Curriculum Audit panel, Anki concept/scope filter & CONCEPT SCOPE review pills, and NCLEX concept pills & Concept Blueprint Coverage',
      S.includes('Concept Curriculum Audit (P-LATE)') &&
      S.includes('id="anki-condition-filter"') &&
      S.includes('id="anki-scope-mode"') &&
      S.includes('CONCEPT SCOPE:') &&
      S.includes('Concept / condition filter') &&
      S.includes('Concept Blueprint Coverage'));
  }
};
