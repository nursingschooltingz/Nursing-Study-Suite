'use strict';

// v21.1 regression suite: Concept-Curriculum x P-LATE deep intertwining
// (1) Sibling Exemplar P-LATE Matrix on Concept Overviews (kbProjectConceptMatrix, kbFormatConceptMatrixText, renderKBMarkdown)
// (2) Standalone Medication & Diagnostic auto-linking in single-condition Cases (selectCaseFacts, caseRenderFactPacket) & NCLEX batches (ngAllocateBatch)
// (3) Interrelated Concept Cascade framing ('cascade') in Case Studies (caseBuildPrompt, CaseStudyGenerator)
// (4) Step 6 unlinkedConditions + 1-click kbAssignConditionConcept linker (auditKbConcepts, kbAssignConditionConcept, KnowledgeBaseBuilder)
// Synthetic fixtures only; zero network calls.

const { load: loadCaseModule, fixture: caseFixture } = require('./case-remediation-tests');

module.exports = async function run(S, t) {
  const span = (a, b) => {
    const x = S.indexOf(a), y = S.indexOf(b, x + a.length);
    if (x < 0 || y < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous v21.1 anchor: ' + a);
    return S.slice(x, y);
  };

  // 1. Live extraction from shipped HTML with non-vacuous tail checks
  const KB = new Function(
    span('function kbBuildFocusBlock(', '// Underextraction flag:') + '\n' +
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') + '\n' +
    ';return {auditKbConcepts,kbAssignConditionConcept,kbOrderByConcept,normalizeKbEntities,kbNormalizeImported};'
  )();

  const VIEW = new Function(
    span('const KB_ENTITY_KINDS=', '// v17.4: facts with text') + '\n' +
    span('function ngFactRow(', 'function ngSplitParts(') + '\n' +
    ';return {kbFactView,renderKBMarkdown,kbProjectConceptMatrix,kbFormatConceptMatrixText,kbSourceText,ngFactRow,ngBuildFactPool,ngAllocateBatch,ngRenderAllocation};'
  )();

  const CASE_SEL = new Function(
    span('function selectCaseFacts(', '// Sufficiency check') + '\n;return {selectCaseFacts,selectCaseFactsMulti};'
  )();

  const CASE_PROMPT = new Function(
    'CASE_QUESTION_RULES', 'PRIORITY_ORDER_RULES', 'kbSourceText',
    span('function caseRenderFactPacket(', '// ── Deterministic post-generation validation ──') + '\n;return {caseRenderFactPacket,caseBuildPrompt};'
  )('SHARED_CASE_RULES', 'SHARED_PRIORITY_RULES', VIEW.kbSourceText);

  const CASE_VAL = loadCaseModule(S);

  t('v21.1 (Extraction tail): live Concept x P-LATE matrix, entity-linking, cascade-prompt, and Step 6 assignment helpers compile cleanly',
    typeof KB.auditKbConcepts === 'function' &&
    typeof KB.kbAssignConditionConcept === 'function' &&
    typeof VIEW.kbProjectConceptMatrix === 'function' &&
    typeof VIEW.kbFormatConceptMatrixText === 'function' &&
    typeof VIEW.ngRenderAllocation === 'function' &&
    typeof CASE_SEL.selectCaseFactsMulti === 'function' &&
    typeof CASE_PROMPT.caseBuildPrompt === 'function');

  // Shared synthetic Concept + Sibling Exemplars + Standalone Medications/Diagnostics fixture
  const mkFact = (id, bucket, text, extra = {}) => ({
    id,
    text,
    tier: extra.tier || 1,
    latteBucket: bucket,
    safetyCritical: !!extra.safetyCritical,
    sourceQuote: extra.sourceQuote || text,
    sources: [{ filename: 'synthetic.pdf', location: 'p. 1' }],
    ...extra
  });

  const fixtureKb = {
    metadata: { course: 'NUR 220', exam: 'Exam 3', schemaVersion: '1.2', concepts: ['Perfusion', 'Fluid & Electrolytes'] },
    conditions: [
      {
        id: 'concept-perfusion',
        name: 'Perfusion',
        entryRole: 'concept',
        aliases: ['Tissue Perfusion'],
        facts: [
          mkFact('pf-1', 'Patho', 'Cardiac output equals heart rate times stroke volume.', { conceptScope: 'shared' }),
          mkFact('pf-2', 'Look', 'Assess capillary refill and peripheral pulse amplitude.', { conceptScope: 'shared' })
        ]
      },
      {
        id: 'cond-lhf',
        name: 'Left-Sided Heart Failure',
        entryRole: 'exemplar',
        concept: 'Perfusion',
        aliases: ['LHF'],
        facts: [
          mkFact('lhf-p-rn', 'Patho', 'Reduced left ventricular ejection fraction elevates pulmonary venous pressure.', { conceptScope: 'delta' }),
          mkFact('lhf-p-br', 'Patho', 'Maladaptive endothelin-1 receptor cascade increases systemic afterload.', { clinicalLayer: 'bridge', tier: 2 }),
          mkFact('lhf-l-ord', 'Look', 'Fatigue on exertion.', { subtype: 'early' }),
          mkFact('lhf-l-cue', 'Look', 'Pink frothy sputum and ascending bibasilar crackles.', { subtype: 'late', conceptScope: 'differentiator', trapRole: 'twin-cue', contrastWith: 'Right-Sided Heart Failure', safetyCritical: true }),
          mkFact('lhf-a-gold', 'Analyze', 'Transthoracic echocardiogram measures LVEF.', { plateSlot: 'gold-standard', conceptScope: 'differentiator' }),
          mkFact('lhf-t-bed', 'Treat', 'Sit upright in high-Fowler position with legs dependent first.', { subtype: 'independent', trapRole: 'bedside-first', safetyCritical: true }),
          mkFact('lhf-e-slope', 'Educate', 'Urine output dropping below 30 mL/hr despite IV loop diuretic signals worsening perfusion.', { subtype: 'evaluate', trapRole: 'trend-slope', safetyCritical: true })
        ]
      },
      {
        id: 'cond-rhf',
        name: 'Right-Sided Heart Failure',
        entryRole: 'exemplar',
        concept: 'Perfusion',
        aliases: ['RHF'],
        facts: [
          mkFact('rhf-p', 'Patho', 'Right ventricular failure increases systemic venous congestion.', { conceptScope: 'delta' }),
          mkFact('rhf-l', 'Look', 'Jugular venous distention, hepatomegaly, and dependent pitting edema.', { conceptScope: 'differentiator', trapRole: 'twin-cue', contrastWith: 'Left-Sided Heart Failure' }),
          mkFact('rhf-a', 'Analyze', 'Central venous pressure above 8 mm Hg.', { conceptScope: 'delta' }),
          mkFact('rhf-t', 'Treat', 'Restrict dietary sodium to 2 g/day and weigh daily.', { subtype: 'independent' })
        ]
      },
      {
        id: 'cond-pad',
        name: 'Peripheral Arterial Disease',
        entryRole: 'exemplar',
        concept: 'Perfusion',
        aliases: ['PAD'],
        facts: [
          mkFact('pad-p', 'Patho', 'Atherosclerotic arterial lumen narrowing causes distal ischemia.', { conceptScope: 'delta' }),
          mkFact('pad-l', 'Look', 'Intermittent claudication and dependent rubor.', { conceptScope: 'differentiator' }),
          mkFact('pad-t', 'Treat', 'Never elevate ischemic legs above heart level; keep legs dependent.', { subtype: 'independent', trapRole: 'never-click', safetyCritical: true })
        ]
      }
    ],
    medications: [
      {
        id: 'med-spiro',
        name: 'Spironolactone',
        facts: [
          mkFact('spiro-hold', 'Treat', 'Hold spironolactone in Left-Sided Heart Failure when serum potassium > 5.0 mEq/L.', { subtype: 'dependent', trapRole: 'hold-triangle', safetyCritical: true }),
          mkFact('spiro-teach', 'Educate', 'Avoid potassium-containing salt substitutes.', { subtype: 'discharge' })
        ]
      },
      {
        id: 'med-furo',
        name: 'Furosemide',
        concept: 'Perfusion',
        facts: [
          mkFact('furo-hold', 'Treat', 'Infuse IV furosemide no faster than 20 mg/min to prevent ototoxicity and monitor potassium.', { subtype: 'dependent', trapRole: 'hold-triangle', safetyCritical: true })
        ]
      },
      {
        id: 'med-cilo',
        name: 'Cilostazol',
        concept: 'Perfusion',
        facts: [
          mkFact('cilo-tx', 'Treat', 'Prescribed for intermittent claudication in Peripheral Arterial Disease.', { subtype: 'dependent' })
        ]
      }
    ],
    diagnostics: [
      {
        id: 'diag-bnp',
        name: 'B-Type Natriuretic Peptide',
        aliases: ['BNP'],
        facts: [
          mkFact('bnp-crit', 'Analyze', 'BNP above 500 pg/mL in Left-Sided Heart Failure indicates acute ventricular stretch.', { factType: 'threshold', safetyCritical: true })
        ]
      }
    ]
  };

  // ── 2. Item 1: Sibling Exemplar P-LATE Matrix on Concept Overviews ──
  {
    const view = VIEW.kbFactView(fixtureKb);
    const perfSel = view.conditions.find(c => c.id === 'concept-perfusion');
    const lhfSel = view.conditions.find(c => c.id === 'cond-lhf');
    const singleExemplarKb = {
      conditions: [
        fixtureKb.conditions[0],
        fixtureKb.conditions[1]
      ]
    };

    const mat = VIEW.kbProjectConceptMatrix(perfSel, fixtureKb);
    const singleOverviewMd = VIEW.renderKBMarkdown({ ...fixtureKb, conditions: [perfSel] });
    const fullViewMd = VIEW.renderKBMarkdown(view);
    const oneExemplarMd = VIEW.renderKBMarkdown(singleExemplarKb);
    const clipMat = VIEW.kbFormatConceptMatrixText(mat);

    t('v21.1 (Item 1 — Sibling Exemplar P-LATE Matrix): renders cited 5-column matrix on Concept Overviews with >=2 exemplars (including single-selection Study View), prioritizes differentiator/gold-standard/bedside-first/slope RN facts while excluding NP Bridge, and omits matrix when <2 exemplars exist',
      VIEW.kbProjectConceptMatrix(lhfSel, fixtureKb) === null &&
      VIEW.kbProjectConceptMatrix(singleExemplarKb.conditions[0], singleExemplarKb) === null &&
      !oneExemplarMd.includes('Sibling Exemplar P-LATE Matrix') &&
      mat !== null &&
      mat.rows.length === 3 &&
      mat.rows[0].name === 'Left-Sided Heart Failure' &&
      mat.rows[0].patho.includes('lhf-p-rn') &&
      !mat.rows[0].patho.includes('lhf-p-br') &&
      mat.rows[0].look.includes('Pink frothy sputum') &&
      mat.rows[0].analyze.includes('Transthoracic echocardiogram') &&
      mat.rows[0].treat.includes('Sit upright in high-Fowler') &&
      mat.rows[0].educate.includes('Urine output dropping below 30 mL/hr') &&
      mat.rows[2].analyze === '[not stated in source]' &&
      singleOverviewMd.includes('### 🧭 Sibling Exemplar P-LATE Matrix — Perfusion (3 exemplars)') &&
      fullViewMd.includes('### 🧭 Sibling Exemplar P-LATE Matrix — Perfusion (3 exemplars)') &&
      clipMat.startsWith('### Sibling Exemplar P-LATE Matrix — Perfusion (3 exemplars)') &&
      S.includes('📋 Copy Sibling P-LATE Matrix'));
  }

  // ── 3. Item 2A: Auto-linking standalone Medications & Diagnostics in single-condition Case Studies ──
  {
    const view = VIEW.kbFactView(fixtureKb);
    const lhf = view.conditions.find(c => c.id === 'cond-lhf');
    const perf = view.conditions.find(c => c.id === 'concept-perfusion');
    const furo = view.conditions.find(c => c.name === 'Furosemide');

    const picked = CASE_SEL.selectCaseFacts(lhf, {
      includeTier2: true,
      includeTier3: false,
      includeCalculation: true,
      includeEducation: true,
      allConditions: view.conditions
    });
    const pickedIds = picked.map(f => f.id);
    const perfPicked = CASE_SEL.selectCaseFacts(perf, { allConditions: view.conditions }).map(f => f.id);
    const medSelfPicked = CASE_SEL.selectCaseFacts(furo, { allConditions: view.conditions }).map(f => f.id);
    const pkt = CASE_PROMPT.caseRenderFactPacket(lhf.name, picked);

    // Verify validateCaseStudy accepts auto-linked standalone entity factIds in a single-condition case
    const factIndex = new Map();
    for (const g of view.conditions) for (const f of g.facts) factIndex.set(f.id.toLowerCase(), { fact: f, condition: g });
    const allowedIds = new Set(pickedIds.map(id => id.toLowerCase()));
    const csWithEntityFact = JSON.parse(JSON.stringify(caseFixture()));
    csWithEntityFact.condition = lhf.name;
    csWithEntityFact.stages[0].data = [
      { label: 'Prescription', value: 'Hold spironolactone for potassium 5.3 mEq/L (above 5.0 mEq/L)', availability: 'revealed', supportType: 'instantiated', factIds: ['spiro-hold'] }
    ];
    csWithEntityFact.stages[0].questions[0].rationales.forEach(r => { r.factIds = ['spiro-hold']; r.text = 'Hold spironolactone when serum potassium > 5.0 mEq/L.'; r.supportType = 'direct'; });
    const valErrs = CASE_VAL.validateCaseStudy(csWithEntityFact, factIndex, allowedIds, lhf.name).filter(i => i.sev === 'error');

    t('v21.1 (Item 2A — Case standalone med/diagnostic auto-link): pulls high-priority Analyze/Treat facts from directly named & shared-concept meds/diagnostics, excludes sibling-only meds, omits ENTRY lines on single-condition packets, skips Concept Overviews/self-entities, and validates cleanly',
      pickedIds.includes('spiro-hold') &&
      pickedIds.includes('bnp-crit') &&
      pickedIds.includes('furo-hold') &&
      !pickedIds.includes('spiro-teach') &&
      !pickedIds.includes('cilo-tx') &&
      pickedIds.indexOf('spiro-hold') < pickedIds.indexOf('furo-hold') &&
      perfPicked.every(id => id.startsWith('pf-')) &&
      medSelfPicked.includes('furo-hold') &&
      !medSelfPicked.some(id => ['spiro-hold', 'bnp-crit', 'cilo-tx'].includes(id)) &&
      pkt.includes('[LINKED ENTITY: Spironolactone (medication)]') &&
      pkt.includes('[LINKED ENTITY: B-Type Natriuretic Peptide (diagnostic)]') &&
      !pkt.includes('\nENTRY: ') &&
      valErrs.length === 0);
  }

  // ── 4. Item 2B: Auto-linking standalone Medications & Diagnostics into NCLEX batch SUPPORTING CONTEXT ──
  {
    const view = VIEW.kbFactView(fixtureKb);
    const pool = VIEW.ngBuildFactPool(view, { tiers: [1, 2] });
    const lhfIdx = pool.findIndex(g => g.condition === 'Left-Sided Heart Failure');
    const batch = VIEW.ngAllocateBatch(pool, new Set(), { want: 2, perCondition: 2, neighborCap: 2, start: lhfIdx });
    const zeroCtx = VIEW.ngAllocateBatch(pool, new Set(), { want: 2, perCondition: 2, neighborCap: 0, start: lhfIdx });
    const ctxIds = batch.context.map(f => f.id);
    const rendered = VIEW.ngRenderAllocation(batch.targets, batch.context);

    t('v21.1 (Item 2B — NCLEX batch standalone med/diagnostic context): co-allocates linked med/diagnostic Analyze/Treat facts into SUPPORTING CONTEXT when neighborCap > 0 while excluding sibling-only meds and keeping neighborCap=0 empty',
      ctxIds.includes('spiro-hold') &&
      ctxIds.includes('bnp-crit') &&
      ctxIds.includes('furo-hold') &&
      !ctxIds.includes('cilo-tx') &&
      !ctxIds.includes('spiro-teach') &&
      zeroCtx.context.length === 0 &&
      rendered.includes('CONDITION: Spironolactone') &&
      rendered.includes('CONDITION: B-Type Natriuretic Peptide'));
  }

  // ── 5. Item 3: Interrelated Concept Cascade framing in Case Studies ──
  {
    const view = VIEW.kbFactView(fixtureKb);
    const lhf = view.conditions.find(c => c.id === 'cond-lhf');
    const rhf = view.conditions.find(c => c.id === 'cond-rhf');
    const multiFacts = CASE_SEL.selectCaseFactsMulti([lhf, rhf], { allConditions: view.conditions });
    const singleFacts = CASE_SEL.selectCaseFacts(lhf, { allConditions: view.conditions });

    const cascadeMultiPrompt = CASE_PROMPT.caseBuildPrompt({
      conditionName: 'Perfusion + Fluid & Electrolytes',
      facts: multiFacts,
      difficulty: 'exam',
      stages: 3,
      questionsPerStage: 2,
      includeTypes: { mcq: true, sata: true },
      mixMode: 'cascade',
      scopeEntries: ['Left-Sided Heart Failure', 'Acute Kidney Injury']
    });
    const cascadeSinglePrompt = CASE_PROMPT.caseBuildPrompt({
      conditionName: lhf.name,
      facts: singleFacts,
      difficulty: 'exam',
      stages: 3,
      questionsPerStage: 2,
      includeTypes: { mcq: true, sata: true },
      mixMode: 'cascade',
      scopeEntries: [lhf.name]
    });
    const plainSinglePrompt = CASE_PROMPT.caseBuildPrompt({
      conditionName: lhf.name,
      facts: singleFacts,
      difficulty: 'exam',
      stages: 3,
      questionsPerStage: 2,
      includeTypes: { mcq: true, sata: true }
    });

    t('v21.1 (Item 3 — Interrelated Concept Cascade framing): emits INTERRELATED CONCEPT CASCADE stage-arc instructions on multi-entry runs, stays 100% byte-identical on single-entry runs, and wires UI pill + auto-related opt-in',
      cascadeMultiPrompt.includes('MULTI-ENTRY / CONCEPT-MIX SCOPE (INTERRELATED CONCEPT CASCADE)') &&
      cascadeMultiPrompt.includes('FRAMING (INTERRELATED CONCEPT CASCADE):') &&
      cascadeMultiPrompt.includes('Concept A -> Concept B cascade') &&
      cascadeMultiPrompt.includes('[Pharm / Lab Hold Trap]') &&
      cascadeSinglePrompt === plainSinglePrompt &&
      !cascadeSinglePrompt.includes('MULTI-ENTRY') &&
      S.includes("['cascade','Interrelated Concept Cascade'") &&
      S.includes("if(m==='cascade'&&caseCatalog.hasRelated&&validCaseConcepts.length>0)setCaseIncludeRelated(true)"));
  }

  // ── 6. Item 4: Step 6 unlinkedConditions & 1-click kbAssignConditionConcept ──
  {
    const mixedConceptKb = {
      metadata: { course: 'NUR 220', exam: 'Exam 3', schemaVersion: '1.2', concepts: ['Perfusion'] },
      sources: [],
      conditions: [
        {
          id: 'concept-perfusion',
          name: 'Perfusion',
          entryRole: 'concept',
          aliases: [],
          facts: [mkFact('fact-1', 'Patho', 'Cardiac output maintains tissue oxygenation.', { conceptScope: 'shared' })]
        },
        {
          id: 'cond-hf',
          name: 'Heart Failure',
          entryRole: 'exemplar',
          concept: 'Perfusion',
          aliases: [],
          facts: [mkFact('fact-2', 'Patho', 'Ventricular remodeling lowers stroke volume.', { conceptScope: 'delta' })]
        },
        {
          id: 'cond-shock',
          name: 'Cardiogenic Shock',
          relatedConcepts: ['Perfusion', 'Acid-Base Balance'],
          facts: [mkFact('fact-3', 'Patho', 'Pump failure causes severe end-organ hypoperfusion.')]
        },
        {
          id: 'cond-gas-plain',
          name: 'Gas Exchange',
          facts: [mkFact('fact-4', 'Patho', 'Alveolar-capillary gas diffusion.')]
        },
        {
          id: 'cond-asthma-orphan',
          name: 'Asthma',
          entryRole: 'exemplar',
          concept: 'Gas Exchange',
          facts: [mkFact('fact-5', 'Patho', 'Reversible airway inflammation.')]
        }
      ],
      medications: [],
      diagnostics: [],
      scoringTools: [],
      formulas: [],
      contradictions: []
    };

    const auditBefore = KB.auditKbConcepts(VIEW.kbFactView(mixedConceptKb));

    // Link unlinked 'Cardiogenic Shock' to 'perfusion' (case-insensitive canonicalization + self/primary relatedConcepts cleanup + kbOrderByConcept)
    const afterLink = KB.kbAssignConditionConcept(mixedConceptKb, 'cond-shock', 'perfusion');
    const shockLinked = afterLink.conditions.find(c => c.id === 'cond-shock');

    // Reassign/confirm 'Asthma' to 'gas exchange' when 'Gas Exchange' exists as an unlinked condition -> promotes 'Gas Exchange' to Concept Overview!
    const afterPromoteViaAssign = KB.kbAssignConditionConcept(afterLink, 'cond-asthma-orphan', 'gas exchange');
    const auditAfter = KB.auditKbConcepts(VIEW.kbFactView(afterPromoteViaAssign));

    // Unlink 'Cardiogenic Shock' back to standalone -> strips concept & exemplar role cleanly
    const afterUnlink = KB.kbAssignConditionConcept(afterPromoteViaAssign, 'cond-shock', '');
    const shockUnlinked = afterUnlink.conditions.find(c => c.id === 'cond-shock');

    // Strict IndexedDB restore validation accepts the modified KB with zero errors
    const restored = KB.kbNormalizeImported(JSON.parse(JSON.stringify(afterPromoteViaAssign)), { restore: true });

    t('v21.1 (Item 4 — Step 6 unlinkedConditions & kbAssignConditionConcept): surfaces unlinkedConditions without inflating issueCount, links/promotes/unlinks immutably with canonical concept casing and ordering, passes strict restore, and wires Step 6 UI selects',
      auditBefore.unlinkedConditions.map(u => u.name).join(',') === 'Cardiogenic Shock,Gas Exchange' &&
      auditBefore.orphanExemplars.length === 1 &&
      auditBefore.issueCount === 1 &&
      mixedConceptKb.conditions.find(c => c.id === 'cond-shock').concept === undefined &&
      shockLinked.entryRole === 'exemplar' &&
      shockLinked.concept === 'Perfusion' &&
      JSON.stringify(shockLinked.relatedConcepts) === '["Acid-Base Balance"]' &&
      afterLink.conditions.map(c => c.id).indexOf('cond-shock') < afterLink.conditions.map(c => c.id).indexOf('cond-gas-plain') &&
      afterPromoteViaAssign.conditions.find(c => c.id === 'cond-gas-plain').entryRole === 'concept' &&
      afterPromoteViaAssign.metadata.concepts.includes('Gas Exchange') &&
      auditAfter.orphanExemplars.length === 0 &&
      auditAfter.unlinkedConditions.length === 0 &&
      !('concept' in shockUnlinked) &&
      !('entryRole' in shockUnlinked) &&
      restored.kb.conditions.find(c => c.id === 'cond-shock').concept === 'Perfusion' &&
      S.includes("'Reassign concept for '+o.name") &&
      S.includes("'Link '+u.name+' to concept'"));
  }
};
