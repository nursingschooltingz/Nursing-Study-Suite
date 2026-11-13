'use strict';

// v21.0 Phase 4 dedicated regression suite (tools/plate-bridge-tests.js):
// Multi-book Saunders + Porth + Jarvis attribution & acronym merging, card/transcript role pills,
// Pharmacology medications 5-bucket P-LATE routing + Pharm-native Study View headings,
// Triple-E Study View + unmigrated/migrated legacy Assess parity, and RN-vs-NP layer isolation.

module.exports = async function run(S, t) {
  const span = (a, b) => {
    const x = S.indexOf(a), y = S.indexOf(b, x + a.length);
    if (x < 0 || y < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous plate-bridge anchor: ' + a);
    return S.slice(x, y);
  };

  const KB = new Function(
    span('function kbBuildFocusBlock(', '// Underextraction flag:') + '\n' +
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') + '\n' +
    ';return {KB_FACT_BUCKETS,KB_LEGACY_LATTE_BUCKETS,KB_SOURCE_ROLES,KB_PLATE_SLOTS,KB_PLATE_BRIDGE_RULES,' +
    'kbMigrateLegacyBucket,kbCoercePlateFields,kbBuildFocusBlock,kbConditionMatchKeys,mergeLatteParts,kbNormalizeImported,normalizeKbEntities};'
  )();

  const VIEW = new Function(
    span('const KB_ENTITY_KINDS=', '// v17.4: facts with text') + '\n' +
    span('function ngFactRow(', 'function ngSplitParts(') + '\n' +
    span('function kbForPriority(', '// v16.7: completeness and captured-source limits') + '\n' +
    ';return {kbFactView,kbBucketFacts,renderKBMarkdown,kbProjectExamTraps,kbForNCLEX,ngFactRow,ngBuildFactPool,kbForPriority};'
  )();

  const ANKI_GIZMO = new Function(
    'uid', 'globalThis', 'TextEncoder', 'TextDecoder',
    span('function kbSourceText(f){', '\n') + '\n' +
    span('function kbStripPointTags(text){', 'function kbExtractPointAnchors(') + '\n' +
    span('function kbUsableFactCount(', '// ── KB source chunking') + '\n' +
    span('function ankiParseCards(raw', 'function AnkiStyleBadges(') + '\n' +
    span('// ──── TOOL: Import to Gizmo (AI-driven chunked Anki → Gizmo.ai converter) ────', 'function GizmoImporter(){') + '\n' +
    ';return {kbForAnki,ankiSourceSnapshot,ankiStampLayerTags,ankiFilterFactView,lintAnkiCard,gizmoLooksLikeTagField,gizmoParseAnkiInput};'
  )(() => 'synthetic', { crypto: require('crypto').webcrypto }, TextEncoder, TextDecoder);

  const CASE_GEN = new Function(
    span('function selectCaseFacts(', '// Sufficiency check') + '\n' +
    ';return {selectCaseFacts,selectCaseFactsMulti};'
  )();

  // 1. Extraction tail assertion
  t('plate-bridge (Extraction tail): live KB, View, Anki, Gizmo, and Case spans compile cleanly',
    typeof KB.mergeLatteParts === 'function' &&
    typeof KB.normalizeKbEntities === 'function' &&
    typeof VIEW.renderKBMarkdown === 'function' &&
    typeof VIEW.kbBucketFacts === 'function' &&
    typeof ANKI_GIZMO.lintAnkiCard === 'function' &&
    typeof ANKI_GIZMO.gizmoLooksLikeTagField === 'function' &&
    typeof CASE_GEN.selectCaseFacts === 'function');

  // 2. Step 01 per-source role selector (PDF/PPTX/card transcript chips) & zero-hallucination KB_PLATE_BRIDGE_RULES
  {
    const kbBuilderSpan = span('function KnowledgeBaseBuilder(){', '\n// ──── TOOL: Priority Analyzer ────');
    const chipStart = kbBuilderSpan.indexOf('className="file-chip"');
    const chipEnd = kbBuilderSpan.indexOf('</div>;})}</div>}', chipStart);
    const chipJsx = kbBuilderSpan.slice(chipStart, chipEnd);
    const focusRn = KB.kbBuildFocusBlock('', '', '', 'prioritize', '', false, false, false, 'rn');
    const focusBridgeRole = KB.kbBuildFocusBlock('', '', '', 'prioritize', '', false, false, false, 'patho-bridge');
    const focusToggle = KB.kbBuildFocusBlock('', '', '', 'prioritize', '', false, false, true, 'rn');

    t('plate-bridge (Step 01 role pills & zero-hallucination prompt rules): PDFs, PPTX decks, and card/transcript chips render all 4 role options, propagate card roles in build(), and ban invented thresholds/receptors/gold-standards/3-step chronological lists',
      JSON.stringify(KB.KB_SOURCE_ROLES) === '[["rn","RN Core"],["patho-bridge","Patho Bridge"],["exam-bridge","Exam / Diff Bridge"],["pharm-bridge","Pharm / GDMT Bridge"]]' &&
      JSON.stringify(KB.KB_PLATE_SLOTS) === '["exam-nuance","gold-standard","diff-tiebreaker","gdmt-bridge","evaluate"]' &&
      chipJsx.includes("<select aria-label={'Source role for '+f.name}") &&
      !chipJsx.includes('!isImg&&<select') &&
      kbBuilderSpan.includes("const cardRole=matchedRoles.find(r=>r!=='rn')||matchedRoles[0]||'rn';") &&
      kbBuilderSpan.includes('role:cardRole,depth:0') &&
      KB.KB_PLATE_BRIDGE_RULES.includes('artificial 3-step chronological lists') &&
      !focusRn.includes('P-LATE MULTI-SOURCE & NP MECHANISM BRIDGE RULES') &&
      focusBridgeRole.includes('P-LATE MULTI-SOURCE & NP MECHANISM BRIDGE RULES') &&
      focusBridgeRole.includes('Pathophysiology Bridge source') &&
      focusToggle.includes('P-LATE MULTI-SOURCE & NP MECHANISM BRIDGE RULES'));
  }

  // 3. Multi-book Saunders + Porth + Jarvis attribution, acronym condition merging, RN-wins dedup, and capBridgeTier
  {
    const parts = [
      // Porth (patho-bridge) enters FIRST with acronym "ADHF", a non-safety Tier 1 mechanism, a safety-critical Tier 1 hold rule, and a duplicate clinical finding
      {
        source: { filename: 'Porth-Patho.pdf', range: 'pp. 410-415', sourceRole: 'patho-bridge' },
        conditions: [{
          name: 'ADHF',
          aliases: [],
          facts: [
            { text: 'Sustained sympathetic and RAAS activation triggers myocardial beta-1 receptor downregulation.', latteBucket: 'Patho', tier: 1, safetyCritical: false, sourceQuote: 'RAAS activation triggers myocardial beta-1 receptor downregulation', sourcePointer: { filename: 'Porth-Patho.pdf', location: 'p. 411' } },
            { text: 'Hold IV nitroprusside immediately if systolic blood pressure drops below 90 mmHg.', latteBucket: 'Treat', subtype: 'dependent', factType: 'threshold', tier: 1, safetyCritical: true, sourceQuote: 'Hold IV nitroprusside immediately if systolic blood pressure drops below 90 mmHg', sourcePointer: { filename: 'Porth-Patho.pdf', location: 'p. 414' } },
            { text: 'Bibasilar crackles and orthopnea.', latteBucket: 'Look', subtype: 'early', tier: 2, sourceQuote: 'Bibasilar crackles and orthopnea', sourcePointer: { filename: 'Porth-Patho.pdf', location: 'p. 412' } }
          ]
        }]
      },
      // Saunders (rn) enters SECOND with full name + parenthetical acronym "Acute Decompensated Heart Failure (ADHF)" and the same duplicate clinical finding
      {
        source: { filename: 'Saunders-RN.pdf', range: 'pp. 712-716', sourceRole: 'rn' },
        conditions: [{
          name: 'Acute Decompensated Heart Failure (ADHF)',
          aliases: [],
          facts: [
            { text: 'Bibasilar crackles and orthopnea.', latteBucket: 'Look', subtype: 'early', tier: 1, sourceQuote: 'Bibasilar crackles and orthopnea', sourcePointer: { filename: 'Saunders-RN.pdf', location: 'p. 712' } },
            { text: 'Place the dyspneic client in high-Fowler position with legs dependent.', latteBucket: 'Treat', subtype: 'independent', tier: 1, safetyCritical: true, sourceQuote: 'high-Fowler position with legs dependent', sourcePointer: { filename: 'Saunders-RN.pdf', location: 'p. 714' } }
          ]
        }]
      },
      // Jarvis (exam-bridge) enters THIRD with full name without acronym
      {
        source: { filename: 'Jarvis-Exam.pdf', range: 'pp. 490-493', sourceRole: 'exam-bridge' },
        conditions: [{
          name: 'Acute Decompensated Heart Failure',
          aliases: [],
          facts: [
            { text: 'Low-pitched S3 ventricular gallop at the apex best heard with the bell in left lateral decubitus.', latteBucket: 'Look', subtype: 'early', plateSlot: 'exam-nuance', tier: 1, safetyCritical: false, sourceQuote: 'S3 ventricular gallop at the apex best heard with the bell', sourcePointer: { filename: 'Jarvis-Exam.pdf', location: 'p. 491' } },
            { text: 'Obesity falsely lowers BNP whereas chronic kidney disease elevates baseline BNP.', latteBucket: 'Analyze', plateSlot: 'diff-tiebreaker', tier: 1, safetyCritical: false, sourceQuote: 'Obesity falsely lowers BNP whereas chronic kidney disease elevates baseline BNP', sourcePointer: { filename: 'Jarvis-Exam.pdf', location: 'p. 493' } }
          ]
        }]
      }
    ];

    const merged = KB.mergeLatteParts(parts, 'NUR 220', 'Cardiac', null, { capBridgeTier: true });
    const cond = merged.conditions[0];
    const byText = sub => cond.facts.find(f => f.text.includes(sub));
    const raas = byText('RAAS activation');
    const nitroHold = byText('Hold IV nitroprusside');
    const sharedCrackles = byText('Bibasilar crackles');
    const s3 = byText('S3 ventricular gallop');
    const bnp = byText('Obesity falsely lowers BNP');

    t('plate-bridge (Saunders + Porth + Jarvis merge): merges acronym/full-name conditions into 1 entry, preserves multi-book provenance, lets RN Core win on shared facts, and caps only non-safety Bridge Tier 1 facts at Tier 2',
      merged.conditions.length === 1 &&
      cond.aliases.includes('Acute Decompensated Heart Failure (ADHF)') &&
      cond.aliases.includes('Acute Decompensated Heart Failure') &&
      raas.clinicalLayer === 'bridge' && raas.tier === 2 && raas.sources[0].filename === 'Porth-Patho.pdf' &&
      nitroHold.clinicalLayer === 'bridge' && nitroHold.tier === 1 &&
      !sharedCrackles.clinicalLayer && sharedCrackles.tier === 1 &&
      sharedCrackles.sources.map(s => s.filename).sort().join(',') === 'Porth-Patho.pdf,Saunders-RN.pdf' &&
      s3.clinicalLayer === 'bridge' && s3.plateSlot === 'exam-nuance' && s3.tier === 2 && s3.sources[0].filename === 'Jarvis-Exam.pdf' &&
      bnp.clinicalLayer === 'bridge' && bnp.plateSlot === 'diff-tiebreaker' && bnp.tier === 2);
  }

  // 4. Pharmacology medications 5-bucket P-LATE routing & Pharm-native Study View headings
  {
    const rawPharmKb = {
      metadata: { course: 'NUR 210', exam: 'Pharm Cardiac' },
      conditions: [],
      medications: [{
        name: 'Digoxin',
        aliases: ['Lanoxin'],
        sourcePointer: { filename: 'Pharm-Lehne.pdf', location: 'p. 582' },
        class: 'Cardiac glycoside',
        mechanism: 'Inhibits myocardial Na+/K+-ATPase to increase intracellular calcium and vagal tone',
        sideEffects: ['Anorexia, nausea, yellow-green visual halos'],
        therapeuticRange: '0.5 to 0.8 ng/mL in heart failure (toxicity > 2.0 ng/mL)',
        labMonitoring: 'Monitor serum potassium, magnesium, and creatinine',
        monitoring: 'Check apical pulse for 1 full minute before each dose; hold if < 60 bpm',
        indications: 'Heart failure with reduced ejection fraction and atrial fibrillation rate control',
        antidote: 'Digoxin immune Fab (Digibind)',
        contraindications: 'Ventricular fibrillation and hypokalemia',
        blackBoxWarnings: 'Narrow therapeutic index with life-threatening dysrhythmias',
        administrationInstructions: 'Administer IV push slowly over at least 5 minutes',
        teaching: 'Report visual halos, bradycardia, or new nausea before taking next dose',
        expectedOutcomes: 'Decreased ventricular rate and improved exercise tolerance'
      }]
    };
    const { kb: normPharm } = KB.normalizeKbEntities(rawPharmKb);
    const medView = VIEW.kbFactView(normPharm);
    const dig = medView.conditions[0];
    const bucketOf = field => dig.facts.find(f => f.derivedFrom && f.derivedFrom.field === field)?.latteBucket;
    const evalFact = dig.facts.find(f => f.derivedFrom && f.derivedFrom.field === 'expectedOutcomes');
    const pharmMd = VIEW.renderKBMarkdown(medView);

    t('plate-bridge (Pharmacology 5-bucket P-LATE upgrade): routes class/mechanism->Patho, sideEffects->Look, therapeuticRange/labMonitoring->Analyze, bedside pre-dose check & hold/antidote/admin->Treat, teaching/outcomes->Educate, and renders Pharm-native Study View headers',
      dig.entityKind === 'medication' &&
      bucketOf('class') === 'Patho' &&
      bucketOf('mechanism') === 'Patho' &&
      bucketOf('sideEffects') === 'Look' &&
      bucketOf('therapeuticRange') === 'Analyze' &&
      bucketOf('labMonitoring') === 'Analyze' &&
      bucketOf('monitoring') === 'Treat' &&
      bucketOf('indications') === 'Treat' &&
      bucketOf('antidote') === 'Treat' &&
      bucketOf('contraindications') === 'Treat' &&
      bucketOf('blackBoxWarnings') === 'Treat' &&
      bucketOf('administrationInstructions') === 'Treat' &&
      bucketOf('teaching') === 'Educate' &&
      evalFact?.latteBucket === 'Educate' && evalFact?.subtype === 'evaluate' &&
      pharmMd.includes('### P — Pharmacodynamics & Drug Class') &&
      pharmMd.includes('### L — Look For: Side Effects & Toxicity') &&
      pharmMd.includes('### A — Analyze: Therapeutic Levels, Labs & Telemetry') &&
      pharmMd.includes('### T — Treat: Indications, Hold Rules, Antidotes & Safe Administration') &&
      pharmMd.includes('### E — Educate, Evaluate & Pharm Traps (Triple-E)'));
  }

  // 5. Triple-E Study View rendering & deterministic unmigrated legacy Assess routing in kbBucketFacts
  {
    const unmigratedCond = {
      name: 'Legacy Heart Failure Fixture',
      facts: [
        { id: 'u1', latteBucket: 'BriefPatho', tier: 1, text: 'Impaired ventricular contractility.', sources: [] },
        { id: 'u2', latteBucket: 'Assess', tier: 1, text: 'Auscultate bibasilar crackles and inspect JVD.', sources: [] },
        { id: 'u3', latteBucket: 'Assess', tier: 1, text: 'Serum BNP > 100 pg/mL and chest x-ray cardiomegaly.', sources: [] },
        { id: 'u4', latteBucket: 'Assess', tier: 1, text: 'Hold dose if apical pulse < 60 bpm before administering.', sources: [] },
        { id: 'u5', latteBucket: 'Assess', tier: 1, text: 'Urine output >= 30 mL/hr indicates therapeutic response.', sources: [] }
      ]
    };
    const unmigMd = VIEW.renderKBMarkdown({ conditions: [unmigratedCond] });

    const tripleEKb = {
      conditions: [
        {
          id: 'adhf',
          name: 'Acute Decompensated Heart Failure',
          concept: 'Perfusion',
          entryRole: 'exemplar',
          contrastPartners: ['COPD Exacerbation'],
          facts: [
            { id: 'f1', latteBucket: 'Patho', tier: 1, text: 'Left ventricular systolic dysfunction elevates pulmonary venous pressure.', sources: [{ filename: 'rn.pdf', location: 'p. 1' }] },
            { id: 'f2', latteBucket: 'Patho', tier: 2, clinicalLayer: 'bridge', text: 'Neurohormonal endothelin-1 and angiotensin II raise afterload.', sources: [{ filename: 'porth.pdf', location: 'p. 2' }] },
            { id: 'f3', latteBucket: 'Look', subtype: 'early', tier: 1, text: 'Dyspnea on exertion.', sources: [{ filename: 'rn.pdf', location: 'p. 3' }] },
            { id: 'f4', latteBucket: 'Look', subtype: 'late', tier: 1, trapRole: 'twin-cue', contrastWith: 'COPD Exacerbation', text: 'Pink frothy sputum with S3 gallop.', sources: [{ filename: 'rn.pdf', location: 'p. 3' }] },
            { id: 'f5', latteBucket: 'Look', tier: 2, clinicalLayer: 'bridge', plateSlot: 'exam-nuance', text: 'Cool extremities with narrow pulse pressure mark Forrester cold-wet profile.', sources: [{ filename: 'jarvis.pdf', location: 'p. 4' }] },
            { id: 'f6', latteBucket: 'Analyze', tier: 1, plateSlot: 'gold-standard', text: 'Transthoracic echocardiogram confirms LVEF.', sources: [{ filename: 'rn.pdf', location: 'p. 5' }] },
            { id: 'f7', latteBucket: 'Analyze', tier: 2, clinicalLayer: 'bridge', plateSlot: 'diff-tiebreaker', text: 'BNP > 500 pg/mL favors ADHF over pure COPD exacerbation.', sources: [{ filename: 'jarvis.pdf', location: 'p. 6' }] },
            { id: 'f8', latteBucket: 'Treat', subtype: 'dependent', tier: 1, trapRole: 'twin-rx-opposite', contrastWith: 'COPD Exacerbation', text: 'Administer IV furosemide 40 mg slow push.', sources: [{ filename: 'rn.pdf', location: 'p. 7' }] },
            { id: 'f9', latteBucket: 'Treat', subtype: 'independent', tier: 1, trapRole: 'bedside-first', text: 'Sit upright in high-Fowler position with legs dependent first.', sources: [{ filename: 'rn.pdf', location: 'p. 7' }] },
            { id: 'f10', latteBucket: 'Treat', tier: 2, clinicalLayer: 'bridge', plateSlot: 'gdmt-bridge', text: 'Transition once euvolemic to ARNI after 36-hour ACEi washout.', sources: [{ filename: 'pharm.pdf', location: 'p. 8' }] },
            { id: 'f11', latteBucket: 'Educate', subtype: 'discharge', tier: 1, text: 'Report weight gain > 2 lb in 24 hours.', sources: [{ filename: 'rn.pdf', location: 'p. 9' }] },
            { id: 'f12', latteBucket: 'Educate', subtype: 'evaluate', tier: 1, text: 'Clearing lung bases and SpO2 >= 94% indicate improvement.', sources: [{ filename: 'rn.pdf', location: 'p. 9' }] }
          ]
        },
        {
          id: 'copd',
          name: 'COPD Exacerbation',
          concept: 'Gas Exchange',
          entryRole: 'exemplar',
          facts: [
            { id: 'c1', latteBucket: 'Look', subtype: 'early', tier: 1, trapRole: 'twin-cue', contrastWith: 'Acute Decompensated Heart Failure', text: 'Barrel chest, prolonged expiration, and purulent sputum.', sources: [{ filename: 'rn.pdf', location: 'p. 20' }] },
            { id: 'c2', latteBucket: 'Treat', subtype: 'independent', tier: 1, trapRole: 'twin-rx-opposite', contrastWith: 'Acute Decompensated Heart Failure', text: 'Titrate low-flow oxygen to target SpO2 88% to 92%.', sources: [{ filename: 'rn.pdf', location: 'p. 21' }] }
          ]
        }
      ]
    };
    const md = VIEW.renderKBMarkdown(VIEW.kbFactView(tripleEKb));

    t('plate-bridge (Triple-E Study View & unmigrated Assess parity): renders all 5 P-LATE sections, collapsible NP Bridge blocks, Gold Standard, 1/2 Treat & Educate/Evaluate sub-headers, Twin Contrast Strip, and routes unmigrated Assess facts by clinical target',
      VIEW.kbBucketFacts(unmigratedCond, 'Patho').map(f => f.id).join(',') === 'u1' &&
      VIEW.kbBucketFacts(unmigratedCond, 'Look').map(f => f.id).join(',') === 'u2' &&
      VIEW.kbBucketFacts(unmigratedCond, 'Analyze').map(f => f.id).join(',') === 'u3' &&
      VIEW.kbBucketFacts(unmigratedCond, 'Treat', 'dependent').map(f => f.id).join(',') === 'u4' &&
      VIEW.kbBucketFacts(unmigratedCond, 'Educate', 'evaluate').map(f => f.id).join(',') === 'u5' &&
      unmigMd.indexOf('Hold dose if apical pulse < 60 bpm') > unmigMd.indexOf('**1. Pharmacology, Hold Rules & Provider Orders**') &&
      unmigMd.indexOf('Urine output >= 30 mL/hr indicates therapeutic response.') > unmigMd.indexOf('**2. Evaluate — Expected vs. Worsening Trends**') &&
      md.includes('<details open><summary><strong>NP Mechanism Bridge</strong></summary>') &&
      md.includes('<details open><summary><strong>NP Physical Exam & Differential Nuance</strong></summary>') &&
      md.includes('<details open><summary><strong>NP Diagnostic & Differential Nuance</strong></summary>') &&
      md.includes('<details open><summary><strong>NP Receptor & GDMT Bridge</strong></summary>') &&
      md.includes('**Gold Standard / Confirmatory**') &&
      md.includes('**1. Educate — Discharge & Self-Management**') &&
      md.includes('**2. Evaluate — Expected vs. Worsening Trends**') &&
      md.includes('**Twin-Diagnosis Contrast Strip (Acute Decompensated Heart Failure vs. COPD Exacerbation)**') &&
      md.includes('### ⚡ Exam Trap Block — '));
  }

  // 6. Legacy Nursing::LATTE::* + native Nursing::PLATE::* + Layer::RNCore / Layer::NPBridge compatibility in Anki & Gizmo
  {
    const plateIssues = ANKI_GIZMO.lintAnkiCard({
      text: 'ADHF first position: {{c1::high-Fowler with legs dependent}}.',
      extra: 'Reduces preload. (rn.pdf, p. 7)',
      tags: 'Condition::ADHF Nursing::PLATE::Treat Tier::1 Layer::RNCore',
      pipeCount: 2,
      parseIssues: []
    }, false);
    const legacyIssues = ANKI_GIZMO.lintAnkiCard({
      text: 'Legacy card: {{c1::furosemide 40 mg IV}}.',
      extra: 'Loop diuretic. (rn.pdf, p. 7)',
      tags: 'Condition::ADHF Nursing::LATTE::Treatments Tier::1',
      pipeCount: 2,
      parseIssues: []
    }, false);
    const gizmoParsed = ANKI_GIZMO.gizmoParseAnkiInput(
      'ADHF position: {{c1::high-Fowler}}|Reduces preload|Condition::ADHF Nursing::PLATE::Treat Tier::1 Layer::RNCore\n' +
      'Legacy BNP: {{c1::> 100 pg/mL}}|Supports HF|Condition::ADHF Nursing::LATTE::Tests Tier::1'
    );

    t('plate-bridge (Anki & Gizmo tag compatibility): lintAnkiCard and Gizmo parser accept both native Nursing::PLATE::* + Layer::* tags and legacy Nursing::LATTE::* decks cleanly',
      plateIssues.length === 0 &&
      legacyIssues.length === 0 &&
      gizmoParsed.cards.length === 2 &&
      ANKI_GIZMO.gizmoLooksLikeTagField('Condition::ADHF Nursing::PLATE::Analyze Tier::2 Layer::NPBridge') &&
      ANKI_GIZMO.gizmoLooksLikeTagField('Condition::ADHF Nursing::LATTE::Assess Tier::1'));
  }
};
