'use strict';

// v21.0 regression suite: CaseStudyGenerator TDZ guard, [P] P-LATE branding & HESI/ATI legal notice,
// 5-bucket P-LATE migration, RN Core vs. NP Mechanism Bridge firewall, selectCaseFacts 15/25/20/25/15
// rebalance + subtype sub-quotas, approved frozen-prompt tweaks, and runtime NCLEX/Case trap directives.

module.exports = async function run(S, t) {
  const span = (a, b) => {
    const x = S.indexOf(a), y = S.indexOf(b, x + a.length);
    if (x < 0 || y < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous v21.0 anchor: ' + a);
    return S.slice(x, y);
  };

  const KB = new Function(
    span('function kbBuildFocusBlock(', '// Underextraction flag:') + '\n' +
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') + '\n' +
    ';return {KB_FACT_BUCKETS,KB_LEGACY_LATTE_BUCKETS,kbMigrateLegacyBucket,kbCoercePlateFields,KB_PLATE_BRIDGE_RULES,kbBuildFocusBlock,mergeLatteParts,kbNormalizeImported,normalizeKbEntities};'
  )();

  const VIEW = new Function(
    span('const KB_ENTITY_KINDS=', '// v17.4: facts with text') + '\n' +
    span('function ngFactRow(', 'function ngSplitParts(') + '\n' +
    span('function kbForPriority(', '// v16.7: completeness and captured-source limits') + '\n' +
    ';return {kbFactView,kbBucketFacts,renderKBMarkdown,kbForNCLEX,ngFactRow,ngBuildFactPool,kbForPriority};'
  )();

  const ANKI = new Function(
    'uid', 'globalThis', 'TextEncoder',
    span('function kbSourceText(f){', '\n') + '\n' +
    span('function kbUsableFactCount(', '// ── KB source chunking') + '\n' +
    span('function ankiParseCards(raw', 'function AnkiStyleBadges') + '\n' +
    ';return {suiteVersion,kbForAnki,ankiSourceSnapshot,ankiCardLayers,ankiStampLayerTags,ankiFilterFactView,lintAnkiCard};'
  )(() => 'synthetic', { crypto: require('crypto').webcrypto }, TextEncoder);
  const suiteVersion = ANKI.suiteVersion;

  const CASE_GEN = new Function(
    'CASE_QUESTION_RULES', 'PRIORITY_ORDER_RULES', 'kbSourceText',
    span('function selectCaseFacts(', '// ── Deterministic post-generation validation ──') + '\n' +
    ';return {selectCaseFacts,selectCaseFactsMulti,caseFactSufficiency,caseRenderFactPacket,CASE_SLOPE_SYNC_RULES,caseBuildPrompt};'
  )('CASE_QUESTION_RULES', 'PRIORITY_ORDER_RULES', f => (f.sources || []).map(s => [s.filename, s.location].filter(Boolean).join(', ')).join('; '));

  const { extractPromptLiteral } = require('./repo-checks');
  const PROMPTS = {
    NCLEX_GEN_PROMPT: extractPromptLiteral(S, 'NCLEX_GEN_PROMPT').body,
    NCLEX_DISTRACTOR_RULES: extractPromptLiteral(S, 'NCLEX_DISTRACTOR_RULES').body,
    NG_GROUNDING_ADAPTER: extractPromptLiteral(S, 'NG_GROUNDING_ADAPTER').body,
    NCLEX_PLATE_TRAP_RULES: extractPromptLiteral(S, 'NCLEX_PLATE_TRAP_RULES').body
  };

  // 1. Extraction tail assertion
  t('v21.0 (Extraction tail): live P-LATE KB, view, Anki, NCLEX, and Case spans compile cleanly',
    typeof suiteVersion === 'function' &&
    typeof KB.kbMigrateLegacyBucket === 'function' &&
    typeof KB.kbCoercePlateFields === 'function' &&
    typeof VIEW.renderKBMarkdown === 'function' &&
    typeof ANKI.ankiStampLayerTags === 'function' &&
    typeof CASE_GEN.selectCaseFacts === 'function' &&
    typeof CASE_GEN.caseBuildPrompt === 'function' &&
    typeof PROMPTS.NCLEX_PLATE_TRAP_RULES === 'string' &&
    typeof CASE_GEN.CASE_SLOPE_SYNC_RULES === 'string');

  // 2. CaseStudyGenerator TDZ regression: declaration order + live hook-prefix execution
  {
    const csInitSpan = span('function CaseStudyGenerator(){', '  const conditions=useMemo(');
    const declIdx = csInitSpan.indexOf('const [caseStudy,setCaseStudy]=useState(null)');
    const refSyncIdx = csInitSpan.indexOf('caseStudyRef.current=caseStudy');
    const pktDeclIdx = csInitSpan.indexOf('const [casePacket,setCasePacket]=useState([])');
    const pktSyncIdx = csInitSpan.indexOf('casePacketRef.current=casePacket');
    let mountedWithoutTdz = false;
    try {
      const runInit = new Function(
        'useConfig', 'useKnowledge', 'useState', 'useRef', 'useCappedLog', 'useCallback',
        csInitSpan + '\n  return {caseStudy:caseStudyRef.current,casePacket:casePacketRef.current};}' + ';return CaseStudyGenerator;'
      )(
        () => ({}),
        () => ({ knowledgeBase: { conditions: [] } }),
        init => [typeof init === 'function' ? init() : init, () => {}],
        init => ({ current: init }),
        () => [[], () => {}, () => {}],
        fn => fn
      );
      const res = runInit();
      mountedWithoutTdz = res.caseStudy === null && Array.isArray(res.casePacket) && res.casePacket.length === 0;
    } catch (_) {
      mountedWithoutTdz = false;
    }
    t('v21.0 (CaseStudyGenerator TDZ guard): caseStudy and casePacket state hooks initialize before ref sync and execute without ReferenceError',
      declIdx > 0 && refSyncIdx > declIdx && pktDeclIdx > 0 && pktSyncIdx > pktDeclIdx && mountedWithoutTdz);
  }

  // 3. Branding ([P] P-LATE Study Suite in-place), version 21.2+, and HESI®/ATI® trademark non-affiliation notice
  t('v21.0 (Branding & legal notice): suiteVersion is 21.2, rail-brand renders [P] P-LATE Study Suite in-place, and rail-foot cites HESI® and ATI® non-affiliation',
    suiteVersion() === '21.2' &&
    S.includes('<title>P-LATE Study Suite</title>') &&
    S.includes('<div className="rail-brand"><div className="rail-mark nav-logo" aria-hidden="true">P</div><div className="rail-word"><b>P-LATE</b><span>Study Suite</span></div></div>') &&
    S.includes('<span className="rail-stat">Built for your next step.</span>') &&
    S.includes('Not affiliated with NCSBN®, HESI®, ATI®, or Straight A Nursing.') &&
    S.includes('HESI® is a registered trademark of Elsevier Inc.') &&
    S.includes('ATI® is a registered trademark of Assessment Technologies Institute, LLC.'));

  // 4. Legacy 6-bucket LATTE -> 5-bucket P-LATE migration & strict restore round-trip
  {
    const legacyKB = {
      metadata: { course: 'NUR 220', exam: 'Exam 1' },
      conditions: [{
        name: 'Heart Failure',
        aliases: ['HF'],
        facts: [
          { id: 'fact-1', latteBucket: 'BriefPatho', tier: 1, text: 'Ventricular remodeling decreases stroke volume.', sources: [{ filename: 'hf.pdf', location: 'p. 1' }] },
          { id: 'fact-2', latteBucket: 'Assess', tier: 1, text: 'Auscultate bibasilar crackles and S3 gallop.', sources: [{ filename: 'hf.pdf', location: 'p. 2' }] },
          { id: 'fact-3', latteBucket: 'Assess', tier: 1, text: 'BNP > 100 pg/mL supports acute heart failure.', sources: [{ filename: 'hf.pdf', location: 'p. 2' }] },
          { id: 'fact-4', latteBucket: 'Tests', tier: 1, text: 'Echocardiogram measures left ventricular ejection fraction.', sources: [{ filename: 'hf.pdf', location: 'p. 3' }] },
          { id: 'fact-5', latteBucket: 'Treatments', subtype: 'dependent', tier: 1, text: 'Administer furosemide 40 mg IV push slowly.', sources: [{ filename: 'hf.pdf', location: 'p. 4' }] },
          { id: 'fact-6', latteBucket: 'Educate', subtype: 'evaluate', tier: 1, text: 'Urine output >= 30 mL/hr indicates therapeutic response.', sources: [{ filename: 'hf.pdf', location: 'p. 5' }] }
        ]
      }]
    };
    const migrated = KB.kbNormalizeImported(JSON.parse(JSON.stringify(legacyKB))).kb;
    const restored = KB.kbNormalizeImported(JSON.parse(JSON.stringify(migrated)), { restore: true }).kb;
    const buckets = restored.conditions[0].facts.map(f => f.latteBucket);
    t('v21.0 (5-bucket P-LATE migration): migrates BriefPatho->Patho, physical-exam Assess->Look, lab/BNP Assess & Tests->Analyze, Treatments->Treat, and restores cleanly',
      JSON.stringify(KB.KB_FACT_BUCKETS) === '["Patho","Look","Analyze","Treat","Educate"]' &&
      JSON.stringify(buckets) === '["Patho","Look","Analyze","Analyze","Treat","Educate"]' &&
      restored.conditions[0].facts[5].subtype === 'evaluate');
  }

  // 5. RN Core vs. NP Mechanism Bridge (clinicalLayer: "bridge") firewall across Study View, Priority, NCLEX, Case Studies, and Anki
  {
    const layeredKB = {
      metadata: { course: 'NUR 220', exam: 'Exam 2', plateBridge: true },
      conditions: [{
        id: 'hf',
        name: 'Heart Failure',
        aliases: ['HF'],
        facts: [
          { id: 'fact-1', latteBucket: 'Patho', tier: 1, text: 'Left ventricular pump failure causes pulmonary congestion.', sources: [{ filename: 'rn.pdf', location: 'p. 1' }] },
          { id: 'fact-2', latteBucket: 'Patho', tier: 2, clinicalLayer: 'bridge', text: 'Chronic RAAS and sympathetic activation drive maladaptive beta-1 downregulation.', sources: [{ filename: 'porth.pdf', location: 'p. 14' }] },
          { id: 'fact-3', latteBucket: 'Look', subtype: 'early', tier: 1, text: 'Dyspnea on exertion and orthopnea.', sources: [{ filename: 'rn.pdf', location: 'p. 2' }] },
          { id: 'fact-4', latteBucket: 'Analyze', tier: 1, plateSlot: 'gold-standard', text: 'Transthoracic echocardiogram quantifies ejection fraction.', sources: [{ filename: 'rn.pdf', location: 'p. 3' }] },
          { id: 'fact-5', latteBucket: 'Analyze', tier: 2, clinicalLayer: 'bridge', plateSlot: 'diff-tiebreaker', text: 'Obesity lowers BNP whereas chronic kidney disease elevates baseline BNP.', sources: [{ filename: 'jarvis.pdf', location: 'p. 9' }] },
          { id: 'fact-6', latteBucket: 'Treat', subtype: 'independent', tier: 1, text: 'Place client in high-Fowler position with legs dependent.', sources: [{ filename: 'rn.pdf', location: 'p. 4' }] },
          { id: 'fact-7', latteBucket: 'Educate', subtype: 'discharge', tier: 1, text: 'Report weight gain of > 2 lb in 24 hr or > 5 lb in 1 week.', sources: [{ filename: 'rn.pdf', location: 'p. 5' }] }
        ]
      }]
    };
    const studyMd = VIEW.renderKBMarkdown(layeredKB);
    const prioRn = VIEW.kbForPriority(layeredKB);
    const prioBridge = VIEW.kbForPriority(layeredKB, { includeBridge: true });
    const nclexRn = VIEW.kbForNCLEX(layeredKB);
    const nclexBridge = VIEW.kbForNCLEX(layeredKB, { includeBridge: true });
    const poolRn = VIEW.ngBuildFactPool(layeredKB);
    const poolBridge = VIEW.ngBuildFactPool(layeredKB, { includeBridge: true });
    const caseRnIds = CASE_GEN.selectCaseFacts(layeredKB.conditions[0], { includeTier2: true }).map(f => f.id);
    const caseBridgeIds = CASE_GEN.selectCaseFacts(layeredKB.conditions[0], { includeTier2: true, includeBridge: true }).map(f => f.id);
    const ankiRnOnly = ANKI.ankiFilterFactView(layeredKB, '', 'rn-only').conditions[0].facts.map(f => f.id);
    const ankiBridgeOnly = ANKI.ankiFilterFactView(layeredKB, '', 'bridge-only').conditions[0].facts.map(f => f.id);
    const snap = ANKI.ankiSourceSnapshot(layeredKB);
    const stamped = ANKI.ankiStampLayerTags([
      { id: 'n1', text: 'Position: {{c1::high-Fowler}}.', extra: '', tags: 'Condition::HeartFailure Nursing::PLATE::Treat Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-6'], keep: true },
      { id: 'n2', text: 'BNP confounder: {{c1::obesity lowers BNP}}.', extra: '', tags: 'Condition::HeartFailure Nursing::PLATE::Analyze Tier::2', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-5'], keep: true }
    ], snap);

    t('v21.0 (RN/NP Bridge firewall): excludes clinicalLayer="bridge" by default across Priority, NCLEX, Pool, Case, and Anki rn-only filter, and exposes it cleanly when enabled',
      studyMd.includes('<details open><summary><strong>NP Mechanism Bridge</strong></summary>') &&
      studyMd.includes('**Gold Standard / Confirmatory**') &&
      !prioRn.includes('fact-2') && !prioRn.includes('fact-5') &&
      prioBridge.includes('fact-2; PLATE Patho; NP BRIDGE') &&
      !nclexRn.includes('fact-2') && !nclexRn.includes('fact-5') &&
      nclexBridge.includes('KBFACT fact-5 | CONDITION: Heart Failure | PLATE: Analyze [NP BRIDGE]') &&
      poolRn[0].facts.length === 5 && poolBridge[0].facts.length === 7 &&
      !caseRnIds.includes('fact-2') && !caseRnIds.includes('fact-5') &&
      caseBridgeIds.includes('fact-2') && caseBridgeIds.includes('fact-5') &&
      ankiRnOnly.join(',') === 'fact-1,fact-3,fact-4,fact-6,fact-7' &&
      ankiBridgeOnly.join(',') === 'fact-2,fact-5' &&
      stamped[0].tags.includes('Layer::RNCore') && !stamped[0].tags.includes('Layer::NPBridge') &&
      stamped[1].tags.includes('Layer::NPBridge'));
  }

  // 6. selectCaseFacts (3/12/12/12/8 = 47) & selectCaseFactsMulti (4/12/12/12/8 = 48) + subtype sub-quotas
  {
    const mk = (pfx, bucket, count, subtype = null) => Array.from({ length: count }, (_, i) => ({
      id: `${pfx}-${i + 1}`,
      latteBucket: bucket,
      subtype,
      tier: 1,
      text: `${bucket} ${subtype || 'std'} clinical fact ${i + 1}.`,
      sourceQuote: `${bucket} ${subtype || 'std'} clinical fact ${i + 1}`,
      sources: [{ filename: 'ms.pdf', location: 'p. 1' }]
    }));
    const richCond = {
      id: 'dka',
      name: 'Diabetic Ketoacidosis',
      facts: [
        ...mk('p', 'Patho', 12),
        ...mk('l', 'Look', 16, 'early'),
        ...mk('a', 'Analyze', 16),
        // Put 14 dependent facts BEFORE 4 independent facts — without subtype sub-quotas, all 12 Treat slots would go to dependent!
        ...mk('td', 'Treat', 14, 'dependent'),
        ...mk('ti', 'Treat', 4, 'independent'),
        // Put 10 discharge facts BEFORE 3 evaluate facts — without subtype sub-quotas, all 8 Educate slots would go to discharge!
        ...mk('ed', 'Educate', 10, 'discharge'),
        ...mk('ee', 'Educate', 3, 'evaluate')
      ]
    };
    const picked = CASE_GEN.selectCaseFacts(richCond, { includeTier2: true, includeCalculation: false, includeEducation: true });
    const counts = {};
    for (const f of picked) counts[f.latteBucket] = (counts[f.latteBucket] || 0) + 1;
    const treatSubs = new Set(picked.filter(f => f.latteBucket === 'Treat').map(f => f.subtype));
    const educSubs = new Set(picked.filter(f => f.latteBucket === 'Educate').map(f => f.subtype));

    const twinCond = {
      id: 'hhs',
      name: 'Hyperosmolar Hyperglycemic State',
      facts: richCond.facts.map(f => ({ ...f, id: 'hhs-' + f.id }))
    };
    const multiPicked = CASE_GEN.selectCaseFactsMulti([richCond, twinCond], { includeTier2: true, includeCalculation: false, includeEducation: true });
    const multiCounts = {};
    for (const f of multiPicked) multiCounts[f.latteBucket] = (multiCounts[f.latteBucket] || 0) + 1;

    t('v21.0 (Case fact allocation rebalance & subtype sub-quotas): allocates exact 3/12/12/12/8 (47) single-case caps, 4/12/12/12/8 (48) multi-case caps, and prevents Treat/Educate subtype starvation',
      picked.length === 47 &&
      counts.Patho === 3 && counts.Look === 12 && counts.Analyze === 12 && counts.Treat === 12 && counts.Educate === 8 &&
      treatSubs.has('dependent') && treatSubs.has('independent') &&
      educSubs.has('discharge') && educSubs.has('evaluate') &&
      multiPicked.length === 48 &&
      multiCounts.Patho === 4 && multiCounts.Look === 12 && multiCounts.Analyze === 12 && multiCounts.Treat === 12 && multiCounts.Educate === 8);
  }

  // 7. Approved frozen prompt surgical tweaks (NCLEX_GEN_PROMPT T0->T1->T2 trend stems & NCLEX_DISTRACTOR_RULES 4-Pillar traps)
  t('v21.0 (Approved frozen prompt updates): NCLEX_GEN_PROMPT supports T0 -> T1 -> T2 trend trajectories and NCLEX_DISTRACTOR_RULES names all 4 clinical trap pillars',
    PROMPTS.NCLEX_GEN_PROMPT.includes('PLATE SECONDARY TAG — map to exactly one of: Patho | Look | Analyze | Treat |') &&
    PROMPTS.NCLEX_GEN_PROMPT.includes('T0 → T1 → T2') &&
    PROMPTS.NCLEX_DISTRACTOR_RULES.includes('[Priority / First-Action Trap]') &&
    PROMPTS.NCLEX_DISTRACTOR_RULES.includes('[Twin-Diagnosis Trap]') &&
    PROMPTS.NCLEX_DISTRACTOR_RULES.includes('[Pharm / Lab Hold Trap]') &&
    PROMPTS.NCLEX_DISTRACTOR_RULES.includes('[Further-Teaching / Context Trap]'));

  // 8. Non-frozen runtime directives (NCLEX_PLATE_TRAP_RULES & CASE_SLOPE_SYNC_RULES) injection and validator-safe boundaries
  {
    const trapOccurrences = S.split("${typeof NCLEX_PLATE_TRAP_RULES==='string'?NCLEX_PLATE_TRAP_RULES+'\\n\\n':''}").length - 1;
    const casePrompt = CASE_GEN.caseBuildPrompt({
      conditionName: 'Heart Failure',
      facts: [{ id: 'fact-1', latteBucket: 'Look', tier: 1, text: 'Crackles in lung bases.', sourceQuote: 'Crackles in lung bases', sources: [{ filename: 'hf.pdf', location: 'p. 1' }] }],
      difficulty: 'exam',
      stages: 3,
      questionsPerStage: 2,
      includeTypes: { mcq: true, sata: true, prioritization: true, ordering: false, calculation: false, education: true }
    });
    t('v21.0 (Runtime NCLEX & Case directives): injects NCLEX_PLATE_TRAP_RULES into both NCLEX packets and CASE_SLOPE_SYNC_RULES into caseBuildPrompt while preserving citation and prose-validator invariants',
      trapOccurrences === 2 &&
      PROMPTS.NG_GROUNDING_ADAPTER.split('\n').length === 12 &&
      PROMPTS.NCLEX_PLATE_TRAP_RULES.includes('SLOPE RED FLAGS') &&
      PROMPTS.NCLEX_PLATE_TRAP_RULES.includes('(Source: C#)') &&
      casePrompt.includes('═══ UNFOLDING EHR STATE-MACHINE & CROSS-STAGE SYNCHRONIZATION RULES ═══') &&
      casePrompt.includes('Keep stage "narrative" strictly qualitative and free of ALL clinical numbers') &&
      casePrompt.includes('P-LATE (TRIPLE-E) CLINICAL PROGRESSION ACROSS UNFOLDING QUESTIONS'));
  }
};
