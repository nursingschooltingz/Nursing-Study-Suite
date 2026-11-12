'use strict';

// v19.2: Unified Giddens Concept + Condition Scope & Mixing across NCLEXGenerator and CaseStudyGenerator.
// Synthetic clinical fixtures only; zero network calls.

const { load: loadCaseModule, fixture: caseFixture } = require('./case-remediation-tests');

module.exports = async function run(S, t) {
  const span = (a, b) => {
    const x = S.indexOf(a), y = S.indexOf(b, x + a.length);
    if (x < 0 || y < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous scope-mixing anchor: ' + a);
    return S.slice(x, y);
  };

  // 1. Live extraction from shipped HTML (with non-vacuous tail checks via exported symbols)
  const SCOPE = new Function(
    span('function kbSourceText(f){', '\n') + '\n' +
    span('function ngFactRow(', 'function ngSplitParts(') + '\n' +
    span('function kbForNCLEX(', '// v17.4: facts with text') + '\n' +
    ';return {kbSourceText,ngFactRow,ngBuildFactPool,ngPoolSize,ngAllocateBatch,ngBatchStart,ngConceptCoverage,kbForNCLEX,kbScopeHasSelection,kbResolveScopeGroups,kbDescribeScopeSelection,kbCollectScopeCatalog};'
  )();

  // Standalone ngBuildFactPool compiled WITHOUT kbResolveScopeGroups in scope (verifies inline fallback)
  const STANDALONE_NG = new Function(
    'kbSourceText',
    span('function ngFactRow(', '// v17.3: this text was duplicated') + '\n;return {ngBuildFactPool};'
  )(SCOPE.kbSourceText);

  const CASE_SEL = new Function(
    span('function selectCaseFacts(', '// Sufficiency check') + '\n;return {selectCaseFacts,selectCaseFactsMulti};'
  )();

  const CASE_PROMPT = new Function(
    'CASE_QUESTION_RULES', 'PRIORITY_ORDER_RULES', 'kbSourceText',
    span('function caseRenderFactPacket(', '// ── Deterministic post-generation validation ──') + '\n;return {caseRenderFactPacket,caseDifficultyBlock,caseBuildPrompt};'
  )('SHARED_CASE_RULES', 'SHARED_PRIORITY_RULES', SCOPE.kbSourceText);

  const CASE_VAL = loadCaseModule(S);

  // 2. Synthetic concept-based + exemplar + entity fixture
  const mkFact = (id, bucket, text, extra = {}) => ({
    id,
    text,
    tier: extra.tier || 1,
    latteBucket: bucket,
    safetyCritical: !!extra.safetyCritical,
    sourceQuote: extra.sourceQuote || text,
    sources: [{ filename: 'synthetic.pdf', location: 'page 1' }],
    ...extra
  });

  const perfOverview = {
    id: 'concept-perfusion',
    name: 'Perfusion',
    entryRole: 'concept',
    aliases: ['Cardiovascular Perfusion'],
    facts: [
      mkFact('pf-1', 'BriefPatho', 'Cardiac output equals heart rate multiplied by stroke volume.', { conceptScope: 'shared' }),
      mkFact('pf-2', 'Assess', 'Assess capillary refill, peripheral pulses, and mentation across perfusion alterations.', { conceptScope: 'shared' }),
      mkFact('pf-3', 'Treatments', 'Elevate legs for venous stasis but keep legs dependent or neutral in arterial insufficiency.', { conceptScope: 'shared', safetyCritical: true })
    ]
  };
  const lhf = {
    id: 'cond-lhf',
    name: 'Left-Sided Heart Failure',
    entryRole: 'exemplar',
    concept: 'Perfusion',
    aliases: ['LHF'],
    facts: [
      mkFact('lhf-1', 'Look', 'Bibasilar crackles, orthopnea, and pink frothy sputum signal pulmonary congestion.', { conceptScope: 'differentiator', trapRole: 'twin-cue', contrastWith: 'Right-Sided Heart Failure', safetyCritical: true }),
      mkFact('lhf-2', 'Assess', 'Auscultate S3 ventricular gallop and monitor SpO2 continuously.', { tier: 1 }),
      mkFact('lhf-3', 'Tests', 'BNP above 500 pg/mL supports acute decompensated ventricular stretch.', { tier: 1 }),
      mkFact('lhf-4', 'Treatments', 'Place in high-Fowler position and administer prescribed IV loop diuretic.', { safetyCritical: true }),
      mkFact('lhf-5', 'Educate', 'Report weight gain of 3 lb in 24 hours or 5 lb in 1 week.', { tier: 2 })
    ]
  };
  const rhf = {
    id: 'cond-rhf',
    name: 'Right-Sided Heart Failure',
    entryRole: 'exemplar',
    concept: 'Perfusion',
    aliases: ['RHF'],
    facts: [
      mkFact('rhf-1', 'Look', 'Jugular venous distention, hepatomegaly, ascites, and dependent peripheral edema predominate.', { conceptScope: 'differentiator', trapRole: 'twin-cue', contrastWith: 'Left-Sided Heart Failure' }),
      mkFact('rhf-2', 'Assess', 'Measure abdominal girth and bilateral ankle circumference daily.', { tier: 1 }),
      mkFact('rhf-3', 'Tests', 'Central venous pressure above 8 mm Hg reflects systemic venous congestion.', { tier: 1 }),
      mkFact('rhf-4', 'Treatments', 'Restrict sodium to 2 g daily and monitor fluid balance closely.', { tier: 1 })
    ]
  };
  const pad = {
    id: 'cond-pad',
    name: 'Peripheral Arterial Disease',
    entryRole: 'exemplar',
    concept: 'Perfusion',
    aliases: ['PAD'],
    facts: [
      mkFact('pad-1', 'Look', 'Intermittent claudication, cool hairless skin, and dependent rubor characterize arterial insufficiency.', { conceptScope: 'differentiator' }),
      mkFact('pad-2', 'Treatments', 'Never elevate ischemic extremities above heart level; maintain dependent positioning.', { trapRole: 'never-click', safetyCritical: true })
    ]
  };
  const furosemide = {
    id: 'medications:0',
    name: 'Furosemide',
    entityKind: 'medication',
    concept: 'Perfusion',
    aliases: ['Lasix'],
    facts: [
      mkFact('fur-1', 'Treatments', 'Administer IV furosemide no faster than 20 mg/min to prevent ototoxicity.', { trapRole: 'hold-rule', safetyCritical: true })
    ]
  };
  const aki = {
    id: 'cond-aki',
    name: 'Acute Kidney Injury',
    entryRole: 'exemplar',
    concept: 'Fluid & Electrolytes',
    relatedConcepts: ['Perfusion'],
    aliases: ['AKI'],
    facts: [
      mkFact('aki-1', 'Tests', 'Serum creatinine rise above 0.3 mg/dL in 48 hours or urine output below 30 mL/hr.', { trapRole: 'slope-trigger', safetyCritical: true }),
      mkFact('aki-2', 'Look', 'Oliguria and rising potassium from 4.4 to 5.4 mEq/L.', { conceptScope: 'differentiator' }),
      mkFact('aki-3', 'Treatments', 'Hold nephrotoxic agents and potassium supplements when oliguria develops.', { trapRole: 'hold-rule', safetyCritical: true })
    ]
  };
  const appendicitis = {
    id: 'cond-appy',
    name: 'Appendicitis',
    aliases: [],
    facts: [
      mkFact('app-1', 'Look', 'Right lower quadrant rebound tenderness at McBurney point.', { safetyCritical: true })
    ]
  };

  const kb = { conditions: [perfOverview, lhf, rhf, pad, furosemide, aki, appendicitis] };
  const idsOf = arr => arr.map(c => c.id).join(',');

  // ── 3. All 5 study scope modes in kbResolveScopeGroups + kbDescribeScopeSelection ──
  {
    t('v19.2 (Scope): kbScopeHasSelection is false for null, empty arrays, or plain text query, and true when concepts or conditionIds are non-empty',
      !SCOPE.kbScopeHasSelection(null) &&
      !SCOPE.kbScopeHasSelection({}) &&
      !SCOPE.kbScopeHasSelection({ concepts: [], conditionIds: ['   '], query: 'Perfusion' }) &&
      SCOPE.kbScopeHasSelection({ concepts: ['Perfusion'], conditionIds: [] }) &&
      SCOPE.kbScopeHasSelection({ concepts: [], conditionIds: ['cond-lhf'] }));

    // Mode 1: Single condition only
    const m1 = SCOPE.kbResolveScopeGroups(kb, { conditionIds: ['cond-lhf'] });
    const d1 = SCOPE.kbDescribeScopeSelection(m1, { conditionIds: ['cond-lhf'] });
    t('v19.2 (Mode 1 — Single condition): resolves only the picked condition with isMixed=false',
      idsOf(m1) === 'cond-lhf' && d1.label === 'Left-Sided Heart Failure' && d1.isMixed === false);

    // Mode 2: Single Giddens Concept with mixConceptExemplars=false (Concept Overview only)
    const m2 = SCOPE.kbResolveScopeGroups(kb, { concepts: ['Perfusion'], mixConceptExemplars: false });
    const d2 = SCOPE.kbDescribeScopeSelection(m2, { concepts: ['Perfusion'], mixConceptExemplars: false });
    const m2MissingOverview = SCOPE.kbResolveScopeGroups(kb, { concepts: ['Fluid & Electrolytes'], mixConceptExemplars: false });
    t('v19.2 (Mode 2 — Concept Overview only): mixConceptExemplars=false resolves only the Giddens Concept Overview and returns [] when no standalone overview exists',
      idsOf(m2) === 'concept-perfusion' && d2.label === 'Perfusion' && d2.isMixed === false && m2MissingOverview.length === 0);

    // Mode 3: Single Giddens Concept with mixConceptExemplars=true (Overview + all exemplars + concept-linked entities)
    const m3 = SCOPE.kbResolveScopeGroups(kb, { concepts: ['Perfusion'], mixConceptExemplars: true });
    const d3 = SCOPE.kbDescribeScopeSelection(m3, { concepts: ['Perfusion'], mixConceptExemplars: true });
    t('v19.2 (Mode 3 — Mixed Giddens Concept): mixConceptExemplars=true pulls Concept Overview, all Perfusion exemplars, and linked meds while excluding other concepts',
      idsOf(m3) === 'concept-perfusion,cond-lhf,cond-rhf,cond-pad,medications:0' &&
      d3.isMixed === true &&
      d3.label.startsWith('Perfusion (Left-Sided Heart Failure, Right-Sided Heart Failure, Peripheral Arterial Disease, Furosemide)'));

    // Mode 4: Custom subset of sibling / twin conditions without pulling unrelated exemplars
    const m4 = SCOPE.kbResolveScopeGroups(kb, { conditionIds: ['cond-lhf', 'cond-rhf'] });
    const d4 = SCOPE.kbDescribeScopeSelection(m4, { conditionIds: ['cond-lhf', 'cond-rhf'] });
    t('v19.2 (Mode 4 — Twin/subset conditions): resolves only Left-Sided + Right-Sided Heart Failure without pulling PAD or AKI',
      idsOf(m4) === 'cond-lhf,cond-rhf' &&
      d4.label === 'Left-Sided Heart Failure + Right-Sided Heart Failure' &&
      d4.isMixed === true);

    // Mode 5: Combined Giddens Concept + external Condition(s), plus Concept Overview + 1 hand-picked exemplar, plus includeRelated
    const m5Union = SCOPE.kbResolveScopeGroups(kb, { concepts: ['Perfusion'], conditionIds: ['cond-aki'], mixConceptExemplars: true });
    const d5Union = SCOPE.kbDescribeScopeSelection(m5Union, { concepts: ['Perfusion'], conditionIds: ['cond-aki'], mixConceptExemplars: true });
    const m5OverviewPlusOne = SCOPE.kbResolveScopeGroups(kb, { concepts: ['Perfusion'], conditionIds: ['cond-lhf'], mixConceptExemplars: false });
    const m5Related = SCOPE.kbResolveScopeGroups(kb, { concepts: ['Perfusion'], mixConceptExemplars: true, includeRelated: true });
    t('v19.2 (Mode 5 — Combined Concept + Condition & includeRelated): supports Concept+Condition union, Concept Overview + 1 exemplar, and relatedConcepts opt-in',
      idsOf(m5Union) === 'concept-perfusion,cond-lhf,cond-rhf,cond-pad,medications:0,cond-aki' &&
      d5Union.label.includes('Perfusion (') && d5Union.label.includes('+ Acute Kidney Injury') &&
      idsOf(m5OverviewPlusOne) === 'concept-perfusion,cond-lhf' &&
      idsOf(m5Related) === 'concept-perfusion,cond-lhf,cond-rhf,cond-pad,medications:0,cond-aki');
  }

  // ── 4. kbCollectScopeCatalog grouping + NCLEXGenerator pool/packet parity & union allocation ──
  {
    const cat = SCOPE.kbCollectScopeCatalog(kb.conditions);
    t('v19.2 (Catalog): kbCollectScopeCatalog extracts Giddens concepts, detects relatedConcepts, and groups overviews, exemplars, plain conditions, and standalone entities',
      cat.hasRelated === true &&
      cat.concepts.map(c => c.name).join(',') === 'Perfusion,Fluid & Electrolytes' &&
      cat.groups.map(g => g.heading).join('|') === '◆ Perfusion|◆ Fluid & Electrolytes|Other Conditions');

    // Legacy plain conditionQuery byte-identity
    const legacyPool = SCOPE.ngBuildFactPool(kb, { tiers: [1, 2, 3], conditionQuery: 'heart failure' });
    const nullScopePool = SCOPE.ngBuildFactPool(kb, { tiers: [1, 2, 3], conditionQuery: 'heart failure', scope: null });
    const legacyPacket = SCOPE.kbForNCLEX(kb, { tiers: [1, 2, 3], conditionQuery: 'heart failure' });
    const nullScopePacket = SCOPE.kbForNCLEX(kb, { tiers: [1, 2, 3], conditionQuery: 'heart failure', scope: null });
    t('v19.2 (NCLEX parity): blank/null scope preserves exact legacy conditionQuery pool and kbForNCLEX packet bytes',
      JSON.stringify(legacyPool) === JSON.stringify(nullScopePool) && legacyPacket === nullScopePacket);

    // Structured union scope in both full and standalone-isolated ngBuildFactPool + batch allocation
    const mixScope = { concepts: ['Perfusion'], conditionIds: ['cond-aki'], mixConceptExemplars: false };
    const unionPool = SCOPE.ngBuildFactPool(kb, { tiers: [1, 2], scope: mixScope });
    const isoPool = STANDALONE_NG.ngBuildFactPool(kb, { tiers: [1, 2], scope: mixScope });
    const alloc = SCOPE.ngAllocateBatch(unionPool, new Set(), { want: 4, perCondition: 2, neighborCap: 1, start: 0 });
    t('v19.2 (NCLEX union): ngBuildFactPool (and its standalone fallback) builds exact Concept+Condition union pools and allocates across both groups',
      unionPool.map(g => g.condition).join(',') === 'Perfusion,Acute Kidney Injury' &&
      JSON.stringify(unionPool) === JSON.stringify(isoPool) &&
      alloc.targets.some(f => f.condition === 'Perfusion') &&
      alloc.targets.some(f => f.condition === 'Acute Kidney Injury'));
  }

  // ── 5. Case Studies: selectCaseFactsMulti, caseRenderFactPacket, caseBuildPrompt, validateCaseStudy ──
  {
    // Single-entry byte-identity
    const singleDirect = CASE_SEL.selectCaseFacts(lhf, { includeTier2: true, includeTier3: false, includeCalculation: true, includeEducation: true, allConditions: kb.conditions });
    const singleViaMulti = CASE_SEL.selectCaseFactsMulti([lhf], { includeTier2: true, includeTier3: false, includeCalculation: true, includeEducation: true, allConditions: kb.conditions });
    const singlePacket = CASE_PROMPT.caseRenderFactPacket(lhf.name, singleViaMulti);
    const singlePromptBase = CASE_PROMPT.caseBuildPrompt({ conditionName: lhf.name, facts: singleDirect, difficulty: 'exam', stages: 3, questionsPerStage: 2, includeTypes: { mcq: true, sata: true } });
    const singlePromptOne = CASE_PROMPT.caseBuildPrompt({ conditionName: lhf.name, facts: singleViaMulti, difficulty: 'exam', stages: 3, questionsPerStage: 2, includeTypes: { mcq: true, sata: true }, mixMode: 'differential', scopeEntries: [lhf.name] });
    t('v19.2 (Case single-entry parity): single-entry selectCaseFactsMulti, packet, and caseBuildPrompt stay 100% byte-identical with no ENTRY or MULTI-ENTRY lines',
      JSON.stringify(singleDirect) === JSON.stringify(singleViaMulti) &&
      !singlePacket.includes('\nENTRY: ') &&
      singlePromptBase === singlePromptOne &&
      !singlePromptOne.includes('MULTI-ENTRY'));

    // Round-robin multi-condition selection + bucket cap enforcement + parent Concept Overview bridge
    const heavyA = {
      id: 'heavy-a', name: 'Condition A', entryRole: 'exemplar', concept: 'Perfusion',
      facts: Array.from({ length: 20 }, (_, i) => mkFact('ha-' + i, 'Look', 'Condition A finding ' + (i + 1) + ' with rate ' + (60 + i) + ' bpm.'))
    };
    const heavyB = {
      id: 'heavy-b', name: 'Condition B', entryRole: 'exemplar', concept: 'Perfusion',
      facts: [
        mkFact('hb-plain', 'Look', 'Condition B ordinary finding.'),
        mkFact('hb-diff', 'Look', 'Condition B key differentiator cue.', { conceptScope: 'differentiator', trapRole: 'twin-cue' }),
        mkFact('hb-tx', 'Treatments', 'Administer Condition B therapy 10 mg IV.')
      ]
    };
    const multiNoCalc = CASE_SEL.selectCaseFactsMulti([heavyA, heavyB], {
      includeTier2: true, includeTier3: false, includeCalculation: false, includeEducation: true, allConditions: [perfOverview, heavyA, heavyB]
    });
    const multiFacts = CASE_SEL.selectCaseFactsMulti([heavyA, heavyB], {
      includeTier2: true, includeTier3: false, includeCalculation: true, includeEducation: true, allConditions: [perfOverview, heavyA, heavyB]
    });
    const multiIds = multiFacts.map(f => f.id);
    const lookNoCalc = multiNoCalc.filter(f => f.latteBucket === 'Look' && !f.id.startsWith('pf-'));
    const multiPacket = CASE_PROMPT.caseRenderFactPacket('Condition A + Condition B', multiFacts);
    t('v19.2 (Case round-robin): selectCaseFactsMulti enforces Look cap=12 round-robin so a 20-fact Condition A never starves Condition B, tops up +4 calculation facts when requested, ranks differentiator/trap first, pulls parent Concept Overview, and emits ENTRY lines',
      lookNoCalc.length === 12 &&
      multiFacts.length === multiNoCalc.length + 4 &&
      multiIds.includes('hb-diff') &&
      multiIds.indexOf('hb-diff') < multiIds.indexOf('hb-plain') &&
      multiIds.some(id => id.startsWith('pf-')) &&
      multiFacts.every(f => typeof f.caseCondition === 'string' && f.caseCondition.length > 0) &&
      multiPacket.includes('ENTRY: Condition A [Exemplar of Perfusion]') &&
      multiPacket.includes('ENTRY: Condition B [Exemplar of Perfusion]') &&
      multiPacket.includes('ENTRY: Perfusion [Concept Overview]'));

    // Multi-entry prompt framing: differential vs comorbid
    const diffPrompt = CASE_PROMPT.caseBuildPrompt({
      conditionName: 'Left-Sided Heart Failure + Right-Sided Heart Failure',
      facts: CASE_SEL.selectCaseFactsMulti([lhf, rhf], { allConditions: kb.conditions }),
      difficulty: 'exam', stages: 4, questionsPerStage: 3, includeTypes: { mcq: true, sata: true, prioritization: true },
      mixMode: 'differential', scopeEntries: ['Left-Sided Heart Failure', 'Right-Sided Heart Failure']
    });
    const comPrompt = CASE_PROMPT.caseBuildPrompt({
      conditionName: 'Perfusion (Left-Sided Heart Failure) + Acute Kidney Injury',
      facts: CASE_SEL.selectCaseFactsMulti([lhf, aki], { allConditions: kb.conditions }),
      difficulty: 'exam', stages: 4, questionsPerStage: 3, includeTypes: { mcq: true, calculation: true },
      mixMode: 'comorbid', scopeEntries: ['Left-Sided Heart Failure', 'Acute Kidney Injury']
    });
    t('v19.2 (Case mix framing): caseBuildPrompt emits DIFFERENTIAL / TWIN TIE-BREAKER vs COMORBID / EVOLVING TRAJECTORY instructions when 2+ entries are in scope',
      diffPrompt.includes('MULTI-ENTRY / CONCEPT-MIX SCOPE (DIFFERENTIAL / TWIN TIE-BREAKER)') &&
      diffPrompt.includes('Selected entries in packet: Left-Sided Heart Failure · Right-Sided Heart Failure') &&
      diffPrompt.includes('Never attribute a finding, lab threshold, medication hold rule, or contraindication from Entry A to Entry B') &&
      comPrompt.includes('MULTI-ENTRY / CONCEPT-MIX SCOPE (COMORBID / EVOLVING TRAJECTORY)') &&
      comPrompt.includes('leave those facts unused and note that honestly in debrief.notes'));

    // validateCaseStudy with allowedConditionNames + strict packet-scoped factIds
    const factIndex = new Map([
      ['f1', { fact: { text: 'Monitor the marker.', sourceQuote: '' } }],
      ['app-1', { fact: { text: 'Right lower quadrant rebound tenderness.', sourceQuote: '' } }]
    ]);
    const allowedIds = new Set(['f1']);
    const expectedLabel = 'Perfusion (Left-Sided Heart Failure, Right-Sided Heart Failure)';
    const allowedNames = ['Perfusion', 'Left-Sided Heart Failure', 'Right-Sided Heart Failure'];

    const csComposite = { ...caseFixture(), condition: expectedLabel };
    const csConstituent = { ...caseFixture(), condition: 'Left-Sided Heart Failure' };
    const csConcept = { ...caseFixture(), condition: 'Perfusion' };
    const csWrong = { ...caseFixture(), condition: 'Appendicitis' };
    const csShortJunk = { ...caseFixture(), condition: 'in' };
    const csOutOfPacket = JSON.parse(JSON.stringify(csComposite));
    csOutOfPacket.stages[0].data = [{ label: 'Abdomen', value: 'Rebound tenderness', supportType: 'direct', availability: 'revealed', factIds: ['app-1'] }];

    const hasCondErr = cs => CASE_VAL.validateCaseStudy(cs, factIndex, allowedIds, expectedLabel, allowedNames)
      .some(i => i.sev === 'error' && /does not match the selected condition/.test(i.msg));
    const outErrs = CASE_VAL.validateCaseStudy(csOutOfPacket, factIndex, allowedIds, expectedLabel, allowedNames);

    t('v19.2 (Case validation): validateCaseStudy accepts composite label and constituent allowedConditionNames, rejects unrelated or short-substring condition echoes, and still rejects out-of-packet factIds',
      !hasCondErr(csComposite) &&
      !hasCondErr(csConstituent) &&
      !hasCondErr(csConcept) &&
      hasCondErr(csWrong) &&
      hasCondErr(csShortJunk) &&
      outErrs.some(i => i.sev === 'error' && /exists in the Knowledge Base but was not supplied to this run/.test(i.msg)));
  }

  // ── 6. Step 01 UI wiring across NCLEXGenerator and CaseStudyGenerator ──
  {
    t('v19.2 (UI): NCLEXGenerator and CaseStudyGenerator wire multi-select Giddens Concept pills, Mix exemplars & interrelated checkboxes, grouped condition pickers, and Case Mix Framing controls',
      S.includes('id="nclex-mix-exemplars"') &&
      S.includes('id="nclex-include-related"') &&
      S.includes('Choose / mix specific conditions') &&
      S.includes('id="case-mix-exemplars"') &&
      S.includes('id="case-include-related"') &&
      S.includes('Mix specific conditions') &&
      S.includes('aria-label="Case mix framing"') &&
      S.includes('Comorbid / Evolving Trajectory') &&
      S.includes('Differential / Twin Tie-Breaker'));
  }
};
