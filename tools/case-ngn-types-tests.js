'use strict';

// v21.7: Next Generation NCLEX (NGN) Case Study Question Types — Bowtie, Matrix, Cloze, and Trend.
// Deterministic extraction tests against shipped HTML bytes; synthetic clinical fixtures only, zero network calls.

const { extractPromptLiteral } = require('./repo-checks');
const { extractBabelScript, BROWSER_BABEL_OPTIONS, MAX_BABEL_SCRIPT_CHARS } = require('../verify-repo');

module.exports = async function runCaseNgnTypesTests(S, t) {
  function span(startAnchor, endAnchor, fromAnchor) {
    const base = fromAnchor ? S.indexOf(fromAnchor) : 0;
    if (base < 0) throw new Error('v21.7 NGN fromAnchor missing: ' + fromAnchor);
    const a = S.indexOf(startAnchor, base);
    if (a < 0) throw new Error('v21.7 NGN startAnchor missing: ' + startAnchor);
    const b = S.indexOf(endAnchor, a + startAnchor.length);
    if (b < 0) throw new Error('v21.7 NGN endAnchor missing after ' + startAnchor + ': ' + endAnchor);
    return S.slice(a, b);
  }

  const ENG = new Function(
    'CASE_QUESTION_RULES', 'PRIORITY_ORDER_RULES', 'kbSourceText', 'LATTE_STANDARDS_VERSION', 'NCLEX_TEST_PLAN_VERSION',
    span('const ITEM_LETTER_NOUN=', '// v17.12: the worksheet kept each choice') + '\n' +
    span('const CASE_FACTS_PER_QUESTION=', '/* ── END CASE STUDY PURE HELPERS ── */') + '\n' +
    'return { caseFactSufficiency, CASE_SLOPE_SYNC_RULES, CASE_NGN_TYPE_RULES, caseBuildPrompt, caseSplitSystemPrompt, ' +
    'caseShapeIssues, CASE_QUESTION_TYPES, caseValidateNgnQuestion, validateCaseStudy, validateStageTiming, ' +
    'caseAllFactIds, caseDifficultySignals, caseToMarkdown, caseShuffleQuestion, caseShuffleIssues, ' +
    'caseFormatAnswerSummary, caseIsGateEligible, caseGateItems, caseAuditPayload, caseSplitMarkdown, casePacketToMarkdown };'
  )(
    'SHARED_CASE_QUESTION_RULES',
    'SHARED_PRIORITY_ORDER_RULES',
    f => (f.sources || []).map(s => [s.filename, s.location].filter(Boolean).join(', ')).join('; '),
    'NEIA-2026',
    '2026'
  );

  // Also extract the live Fact Inspector provenance builder from CaseStudyGenerator.run
  const provSpan = span('const entries=[];let qi=0;const claimed=new Set();', 'if(residual.length)', "const caseId='case-'") +
    "if(residual.length)entries.push({id:caseId+':case',caseId,factIds:residual,label:title+' — case context / debrief'});return entries;";
  const buildProv = new Function('parsed', 'cited', 'caseId', 'title', provSpan);

  // Synthetic KB facts & index
  const facts = [
    { id: 'f-cue1', latteBucket: 'Look', tier: 1, text: 'Acute respiratory distress with accessory muscle use and SpO2 below 90%.', sourceQuote: 'SpO2 below 90%', sources: [{ filename: 'resp.pdf', location: 'p. 1' }] },
    { id: 'f-cue2', latteBucket: 'Look', tier: 1, trapRole: 'twin-cue', contrastWith: 'Pneumothorax', text: 'Bilateral expiratory wheezes diminishing to a silent chest signal impending respiratory failure in severe asthma.', sourceQuote: 'silent chest', sources: [{ filename: 'resp.pdf', location: 'p. 2' }] },
    { id: 'f-lab1', latteBucket: 'Analyze', tier: 1, text: 'Report urine output below 30 mL/hr as hypoperfusion.', sourceQuote: 'urine output below 30 mL/hr', sources: [{ filename: 'renal.pdf', location: 'p. 3' }] },
    { id: 'f-lab2', latteBucket: 'Analyze', tier: 1, text: 'Tachycardia greater than 100 bpm accompanies early shock compensation.', sourceQuote: 'greater than 100 bpm', sources: [{ filename: 'renal.pdf', location: 'p. 4' }] },
    { id: 'f-tx1', latteBucket: 'Treat', subtype: 'independent', tier: 1, text: 'Place the client in high-Fowler position and administer supplemental oxygen.', sourceQuote: 'high-Fowler position', sources: [{ filename: 'resp.pdf', location: 'p. 5' }] },
    { id: 'f-tx2', latteBucket: 'Treat', subtype: 'dependent', tier: 1, text: 'Administer prescribed short-acting inhaled beta-2 agonist nebulizer immediately.', sourceQuote: 'short-acting inhaled beta-2 agonist', sources: [{ filename: 'resp.pdf', location: 'p. 6' }] },
    { id: 'f-hold', latteBucket: 'Treat', subtype: 'dependent', tier: 1, trapRole: 'hold-triangle', text: 'Infuse IV furosemide no faster than 20 mg/min; rapid bolus risks ototoxicity.', sourceQuote: 'no faster than 20 mg/min', sources: [{ filename: 'pharm.pdf', location: 'p. 7' }] },
    { id: 'f-never', latteBucket: 'Treat', subtype: 'dependent', tier: 1, trapRole: 'never-click', text: 'Nonselective beta-blockers are contraindicated in acute bronchospasm.', sourceQuote: 'Nonselective beta-blockers are contraindicated', sources: [{ filename: 'pharm.pdf', location: 'p. 8' }] },
    { id: 'f-eval1', latteBucket: 'Educate', subtype: 'evaluate', tier: 1, trapRole: 'dynamic-monitor', text: 'Monitor continuous pulse oximetry and breath-sound air movement after bronchodilator therapy.', sourceQuote: 'continuous pulse oximetry', sources: [{ filename: 'resp.pdf', location: 'p. 9' }] },
    { id: 'f-eval2', latteBucket: 'Educate', subtype: 'discharge', tier: 2, text: 'Rinse the mouth with water after inhaled corticosteroid use to prevent oral candidiasis.', sourceQuote: 'Rinse the mouth with water', sources: [{ filename: 'resp.pdf', location: 'p. 10' }] }
  ];
  const factIndex = new Map(facts.map(f => [f.id, { condition: { name: 'Status Asthmaticus' }, fact: f }]));
  const allowedIds = new Set(facts.map(f => f.id));

  const mkCase = (questions, stageData = []) => ({
    title: 'Acute Airway & Perfusion Unfolding Case',
    condition: 'Status Asthmaticus',
    difficulty: 'exam',
    patient: { age: 34, sex: 'female', background: 'Arrives at the emergency department with her partner.' },
    stages: [{
      stageNumber: 1,
      title: 'Emergency Presentation',
      narrative: 'The nurse enters the treatment bay at 0800.',
      data: stageData,
      questions
    }],
    debrief: { priorityProblem: 'Acute bronchospasm stabilization', keyDecisions: ['Prioritize airway and dynamic reassessment'], notes: 'Grounded synthetic fixture.', factIds: ['f-tx1'] }
  });

  const mkBowtie = () => ({
    id: 'q-bow',
    type: 'Bowtie',
    stem: 'Complete the diagram by selecting the potential condition, two actions to take, and two parameters to monitor.',
    options: [
      { label: 'A1', group: 'actions', text: 'Place the client in high-Fowler position and apply oxygen' },
      { label: 'A2', group: 'actions', text: 'Administer prescribed inhaled short-acting beta-2 agonist' },
      { label: 'A3', group: 'actions', text: 'Administer a nonselective beta-blocker' },
      { label: 'A4', group: 'actions', text: 'Instruct on rinsing the mouth after home steroid inhalers' },
      { label: 'C1', group: 'condition', text: 'Impending respiratory failure from status asthmaticus' },
      { label: 'C2', group: 'condition', text: 'Spontaneous pneumothorax' },
      { label: 'C3', group: 'condition', text: 'Ototoxicity from loop diuretic therapy' },
      { label: 'C4', group: 'condition', text: 'Oral candidiasis' },
      { label: 'P1', group: 'parameters', text: 'Continuous pulse oximetry saturation' },
      { label: 'P2', group: 'parameters', text: 'Breath-sound air movement on lung auscultation' },
      { label: 'P3', group: 'parameters', text: 'Oral mucosa inspection for white plaques' },
      { label: 'P4', group: 'parameters', text: 'Hearing acuity screening' }
    ],
    correctAnswers: ['A1', 'A2', 'C1', 'P1', 'P2'],
    rationales: [
      { option: 'A1', text: 'Upright positioning and oxygen support airway and oxygenation immediately. ABC: airway and breathing first.', supportType: 'direct', factIds: ['f-tx1'] },
      { option: 'A2', text: 'Short-acting beta-2 agonist reverses acute bronchospasm.', supportType: 'direct', factIds: ['f-tx2'] },
      { option: 'A3', text: '[Pharm / Lab Hold Trap] Nonselective beta-blockers worsen bronchospasm and are contraindicated.', supportType: 'direct', factIds: ['f-never'] },
      { option: 'A4', text: '[Priority / First-Action Trap] Discharge mouth-rinse teaching is nonurgent during acute respiratory distress.', supportType: 'direct', factIds: ['f-eval2'] },
      { option: 'C1', text: 'Diminishing wheezes progressing to a silent chest indicate impending respiratory failure.', supportType: 'direct', factIds: ['f-cue2'] },
      { option: 'C2', text: '[Twin-Diagnosis Trap] Pneumothorax is the contrasted condition rather than diffuse bronchospasm.', supportType: 'direct', factIds: ['f-cue2'] },
      { option: 'C3', text: '[Pharm / Lab Hold Trap] Ototoxicity relates to rapid IV loop diuretic infusion.', supportType: 'direct', factIds: ['f-hold'] },
      { option: 'C4', text: '[Further-Teaching / Context Trap] Oral candidiasis is a chronic inhaler side effect, not the acute crisis.', supportType: 'direct', factIds: ['f-eval2'] },
      { option: 'P1', text: 'Continuous pulse oximetry tracks oxygenation response after therapy.', supportType: 'direct', factIds: ['f-eval1'] },
      { option: 'P2', text: 'Auscultating air movement evaluates whether bronchospasm is resolving or worsening.', supportType: 'direct', factIds: ['f-eval1'] },
      { option: 'P3', text: '[Further-Teaching / Context Trap] Oral candidiasis inspection does not track acute airway recovery.', supportType: 'direct', factIds: ['f-eval2'] },
      { option: 'P4', text: '[Pharm / Lab Hold Trap] Hearing checks apply to high-rate loop diuretic toxicity.', supportType: 'direct', factIds: ['f-hold'] }
    ],
    cjmmSkill: 'Take Action'
  });

  const mkMatrix = (mode = 'single') => ({
    id: 'q-mat',
    type: 'Matrix',
    stem: 'For each potential nursing intervention below, specify whether it is indicated, nonessential, or contraindicated for this client.',
    options: [],
    matrix: {
      mode,
      columns: [
        { id: 'C1', label: 'Indicated' },
        { id: 'C2', label: 'Nonessential' },
        { id: 'C3', label: 'Contraindicated' }
      ],
      rows: [
        { id: 'R1', text: 'Place the client in high-Fowler position and apply supplemental oxygen' },
        { id: 'R2', text: 'Administer IV furosemide 80 mg push over 30 seconds' },
        { id: 'R3', text: 'Administer a nonselective beta-blocker for tachycardia' }
      ]
    },
    correctAnswers: mode === 'single' ? ['R1:C1', 'R2:C3', 'R3:C3'] : ['R1:C1', 'R2:C2', 'R2:C3', 'R3:C3'],
    rationales: [
      { option: 'R1', text: 'High-Fowler positioning and oxygen are indicated immediately for hypoxemia.', supportType: 'direct', factIds: ['f-tx1'] },
      { option: 'R2', text: '[Pharm / Lab Hold Trap] This row\'s rapid bolus rate violates the maximum IV furosemide rate of 20 mg/min and risks ototoxicity.', supportType: 'direct', factIds: ['f-hold'] },
      { option: 'R3', text: '[Pharm / Lab Hold Trap] Nonselective beta-blockers are contraindicated in acute bronchospasm.', supportType: 'direct', factIds: ['f-never'] }
    ],
    cjmmSkill: 'Generate Solutions'
  });

  const mkCloze = () => ({
    id: 'q-clz',
    type: 'Cloze',
    stem: 'The nurse recognizes the client is developing {{D1}} and should immediately {{D2}} while monitoring {{D3}}.',
    options: [
      { label: 'D1A', group: 'D1', text: 'impending respiratory failure from silent chest' },
      { label: 'D1B', group: 'D1', text: 'oral candidiasis' },
      { label: 'D1C', group: 'D1', text: 'furosemide ototoxicity' },
      { label: 'D2A', group: 'D2', text: 'administer the prescribed short-acting beta-2 agonist' },
      { label: 'D2B', group: 'D2', text: 'administer a nonselective beta-blocker' },
      { label: 'D2C', group: 'D2', text: 'teach mouth rinsing after steroid use' },
      { label: 'D3A', group: 'D3', text: 'continuous pulse oximetry and breath-sound air movement' },
      { label: 'D3B', group: 'D3', text: 'oral mucosa for white plaques' },
      { label: 'D3C', group: 'D3', text: 'auditory acuity' }
    ],
    correctAnswers: ['D1A', 'D2A', 'D3A'],
    rationales: [
      { option: 'D1A', text: 'Expiratory wheezes diminishing to a silent chest signal impending respiratory failure.', supportType: 'direct', factIds: ['f-cue2'] },
      { option: 'D1B', text: '[Further-Teaching / Context Trap] Oral candidiasis is a chronic steroid effect.', supportType: 'direct', factIds: ['f-eval2'] },
      { option: 'D1C', text: '[Pharm / Lab Hold Trap] Ototoxicity follows rapid IV furosemide infusion.', supportType: 'direct', factIds: ['f-hold'] },
      { option: 'D2A', text: 'Short-acting inhaled beta-2 agonist is the immediate rescue bronchodilator.', supportType: 'direct', factIds: ['f-tx2'] },
      { option: 'D2B', text: '[Pharm / Lab Hold Trap] Nonselective beta-blockers worsen bronchospasm.', supportType: 'direct', factIds: ['f-never'] },
      { option: 'D2C', text: '[Priority / First-Action Trap] Discharge teaching waits until crisis stabilization.', supportType: 'direct', factIds: ['f-eval2'] },
      { option: 'D3A', text: 'Continuous SpO2 and lung air movement evaluate bronchodilator efficacy.', supportType: 'direct', factIds: ['f-eval1'] },
      { option: 'D3B', text: '[Further-Teaching / Context Trap] Oral inspection does not evaluate acute ventilation.', supportType: 'direct', factIds: ['f-eval2'] },
      { option: 'D3C', text: '[Pharm / Lab Hold Trap] Hearing checks monitor loop diuretic toxicity.', supportType: 'direct', factIds: ['f-hold'] }
    ],
    cjmmSkill: 'Analyze Cues'
  });

  const mkTrend = () => ({
    id: 'q-trd',
    type: 'Trend',
    stem: 'Review the serial flowsheet from 0800 to 1000. Which interpretation of the client\'s trajectory requires immediate action?',
    trendTable: {
      timepoints: ['0800', '0900', '1000'],
      rows: [
        { label: 'Lung auscultation', values: ['Loud bilateral wheezes', 'Diminishing wheezes', 'Silent chest'], supportType: 'direct', factIds: ['f-cue2'] },
        { label: 'Urine output', values: ['42 mL/hr', '32 mL/hr', '20 mL/hr'], supportType: 'instantiated', factIds: ['f-lab1'] },
        { label: 'Heart rate', values: ['96 bpm', '108 bpm', '122 bpm'], supportType: 'instantiated', factIds: ['f-lab2'] }
      ]
    },
    options: [
      { label: 'A', text: 'Worsening respiratory failure and hypoperfusion despite quieter breath sounds' },
      { label: 'B', text: 'Resolution of bronchospasm evidenced by disappearance of wheezing at 1000' },
      { label: 'C', text: 'Expected diuretic response requiring routine discharge teaching' },
      { label: 'D', text: 'Indication to administer a nonselective beta-blocker for heart rate 122 bpm' }
    ],
    correctAnswers: ['A'],
    rationales: [
      { option: 'A', text: 'Progression to a silent chest alongside urine output dropping from 42 mL/hr to 20 mL/hr and heart rate rising to 122 bpm signals decompensation.', supportType: 'combined', factIds: ['f-cue2', 'f-lab1', 'f-lab2'] },
      { option: 'B', text: '[Twin-Diagnosis Trap] Disappearing wheezes into a silent chest is deceptive pseudo-improvement, not airway clearance.', supportType: 'direct', factIds: ['f-cue2'] },
      { option: 'C', text: '[Priority / First-Action Trap] Oliguria below 30 mL/hr indicates hypoperfusion rather than readiness for discharge teaching.', supportType: 'direct', factIds: ['f-lab1', 'f-eval2'] },
      { option: 'D', text: '[Pharm / Lab Hold Trap] Nonselective beta-blockers are contraindicated in acute bronchospasm.', supportType: 'direct', factIds: ['f-never'] }
    ],
    cjmmSkill: 'Evaluate Outcomes'
  });

  // 1. Extraction tail, CASE_NGN_TYPE_RULES documentation, & legacy prompt byte-identity
  {
    const literal = extractPromptLiteral(S, 'CASE_NGN_TYPE_RULES');
    const legacyPrompt = ENG.caseBuildPrompt({
      conditionName: 'Status Asthmaticus',
      facts,
      difficulty: 'exam',
      stages: 3,
      questionsPerStage: 2,
      includeTypes: { mcq: true, sata: true, prioritization: true, ordering: true, calculation: true, education: true }
    });
    const ngnPrompt = ENG.caseBuildPrompt({
      conditionName: 'Status Asthmaticus',
      facts,
      difficulty: 'exam',
      stages: 3,
      questionsPerStage: 2,
      includeTypes: { mcq: true, bowtie: true, matrix: true, cloze: true, trend: true }
    });
    const split = ENG.caseSplitSystemPrompt(ngnPrompt);
    const suff2 = ENG.caseFactSufficiency([facts[0]], 2);
    const suff3 = ENG.caseFactSufficiency([facts[0]], 2, { bowtie: true, trend: true });

    t('v21.7 (NGN prompt contract & legacy byte-identity): CASE_NGN_TYPE_RULES is documented, omitted when NGN checkboxes are off, injected with lossless prefix-cache split when on, and caseFactSufficiency advises on thin NGN pools',
      literal.body.length > 800 &&
      !legacyPrompt.includes('NEXT GENERATION NCLEX (NGN) ITEM FORMAT CONTRACTS') &&
      legacyPrompt.includes('"type": "MCQ|SATA|Prioritization|Ordering|Calculation|Education"') &&
      ngnPrompt.includes('NEXT GENERATION NCLEX (NGN) ITEM FORMAT CONTRACTS') &&
      ngnPrompt.includes('"type": "MCQ|SATA|Prioritization|Ordering|Calculation|Education|Bowtie|Matrix|Cloze|Trend"') &&
      split.systemInstruction + '\n\n' + split.userPrompt === ngnPrompt &&
      !suff2.warnings.some(w => /Bow-tie|Trend items/i.test(w)) &&
      suff3.warnings.some(w => /Bow-tie items require/i.test(w)) &&
      suff3.warnings.some(w => /Trend items require/i.test(w)));
  }

  // 2. Bowtie validation & 3-pool independent Fisher-Yates shuffling
  {
    const validIssues = ENG.validateCaseStudy(mkCase([mkBowtie()]), factIndex, allowedIds, 'Status Asthmaticus');
    const badPool = mkBowtie();
    badPool.options = badPool.options.filter(o => o.label !== 'C4'); // 3 conditions instead of 4
    const badPoolIssues = ENG.validateCaseStudy(mkCase([badPool]), factIndex, allowedIds, 'Status Asthmaticus');

    const badKeys = mkBowtie();
    badKeys.correctAnswers = ['A1', 'A2', 'A3', 'C1', 'P1']; // 3 actions, 1 cond, 1 param (still length 5!)
    const badKeyIssues = ENG.validateCaseStudy(mkCase([badKeys]), factIndex, allowedIds, 'Status Asthmaticus');

    const orig = mkBowtie();
    const shuf = ENG.caseShuffleQuestion(orig, () => 0);
    const keyedTextsAfter = shuf.options.filter(o => shuf.correctAnswers.includes(o.label)).map(o => o.text).sort();
    const keyedTextsBefore = orig.options.filter(o => orig.correctAnswers.includes(o.label)).map(o => o.text).sort();
    const ratsFollow = shuf.options.every(o => {
      const origOpt = orig.options.find(x => x.text === o.text);
      const origRat = orig.rationales.find(r => r.option === origOpt.label);
      const newRat = shuf.rationales.find(r => r.option === o.label);
      return newRat && newRat.text === origRat.text && newRat.factIds[0] === origRat.factIds[0];
    });
    const refLocked = mkBowtie();
    refLocked.rationales[0].text = 'Compare A1 with A2 first.';
    const lockedRes = ENG.caseShuffleQuestion(refLocked, () => 0);

    t('v21.7 (Bowtie validation & per-pool shuffle): accepts valid 2+1+2 Bowtie, rejects wrong pool/key distribution, shuffles each pool independently with intact rationales, and locks order on token references',
      validIssues.filter(i => i.sev === 'error').length === 0 &&
      badPoolIssues.some(i => i.sev === 'error' && /4 "condition" options/.test(i.msg)) &&
      badKeyIssues.some(i => i.sev === 'error' && /2 actions, 1 condition, and 2 parameters/.test(i.msg)) &&
      shuf.correctAnswers.join(',') !== orig.correctAnswers.join(',') &&
      JSON.stringify(keyedTextsAfter) === JSON.stringify(keyedTextsBefore) &&
      ratsFollow &&
      !!lockedRes.shuffleNotice);
  }

  // 3. Matrix single & multiple validation, Contraindicated trap numeric exemption, & row-only shuffling
  {
    const singleIssues = ENG.validateCaseStudy(mkCase([mkMatrix('single')]), factIndex, allowedIds, 'Status Asthmaticus');
    const multiIssues = ENG.validateCaseStudy(mkCase([mkMatrix('multiple')]), factIndex, allowedIds, 'Status Asthmaticus');

    // Contraindicated row R2 carries unsourced "80 mg" / "30 seconds" trap -> 0 errors AND 0 affirmative-row warnings!
    // Now test an Indicated row carrying an unsourced "80 mg" -> surfaces warn-tier disclosure (never error).
    const indUncited = mkMatrix('single');
    indUncited.matrix.rows[0].text = 'Administer IV methylprednisolone 80 mg now';
    const indIssues = ENG.validateCaseStudy(mkCase([indUncited]), factIndex, allowedIds, 'Status Asthmaticus');

    // Ungrounded number repeated as fact inside Matrix rationale -> still caught as error!
    const ratLeak = mkMatrix('single');
    ratLeak.rationales[1].text = 'Giving 80 mg over 30 seconds is reserved for pulmonary edema.';
    const ratLeakIssues = ENG.validateCaseStudy(mkCase([ratLeak]), factIndex, allowedIds, 'Status Asthmaticus');

    // Missing row selection on single mode & all-cells-checked on multiple mode
    const missingRow = mkMatrix('single');
    missingRow.correctAnswers = ['R1:C1', 'R2:C3']; // R3 missing
    const allCells = mkMatrix('multiple');
    allCells.correctAnswers = ['R1:C1', 'R1:C2', 'R1:C3', 'R2:C1', 'R2:C2', 'R2:C3', 'R3:C1', 'R3:C2', 'R3:C3'];

    // Row shuffle preserves column order (Indicated, Nonessential, Contraindicated) and row->column truth mapping
    const origMx = mkMatrix('single');
    const shufMx = ENG.caseShuffleQuestion(origMx, () => 0);
    const colOrderUnchanged = JSON.stringify(shufMx.matrix.columns) === JSON.stringify(origMx.matrix.columns);
    const rowTruthPreserved = shufMx.matrix.rows.every(r => {
      const origRow = origMx.matrix.rows.find(or => or.text === r.text);
      const origCol = origMx.correctAnswers.find(x => x.startsWith(origRow.id + ':')).split(':')[1];
      return shufMx.correctAnswers.includes(r.id + ':' + origCol);
    });

    t('v21.7 (Matrix single/multiple, Contraindicated trap safety, & row shuffle): validates grids, keeps Contraindicated trap doses free of false warnings while flagging affirmative-row/rationale numbers, and shuffles rows without reordering clinical columns',
      singleIssues.filter(i => i.sev === 'error').length === 0 &&
      !singleIssues.some(i => /Matrix row R2/.test(i.msg)) &&
      multiIssues.filter(i => i.sev === 'error').length === 0 &&
      indIssues.some(i => i.sev === 'warn' && /Matrix row R1/.test(i.msg)) &&
      !indIssues.some(i => i.sev === 'error') &&
      ratLeakIssues.some(i => i.sev === 'error' && /rationale R2/.test(i.msg)) &&
      ENG.validateCaseStudy(mkCase([missingRow]), factIndex, allowedIds, 'Status Asthmaticus').some(i => i.sev === 'error' && /row R3 must select/.test(i.msg)) &&
      ENG.validateCaseStudy(mkCase([allCells]), factIndex, allowedIds, 'Status Asthmaticus').some(i => i.sev === 'error' && /every cell in the grid/.test(i.msg)) &&
      colOrderUnchanged &&
      shufMx.matrix.rows[0].text !== origMx.matrix.rows[0].text &&
      rowTruthPreserved);
  }

  // 4. Cloze (drop-down) validation & per-blank shuffling
  {
    const clzIssues = ENG.validateCaseStudy(mkCase([mkCloze()]), factIndex, allowedIds, 'Status Asthmaticus');
    const singleBlank = mkCloze();
    singleBlank.stem = 'The client is developing {{D1}}.';
    const gapBlank = mkCloze();
    gapBlank.stem = 'The client has {{D1}} and needs {{D3}}.';
    const origClz = mkCloze();
    const shufClz = ENG.caseShuffleQuestion(origClz, () => 0);
    const clzTruthPreserved = ['D1', 'D2', 'D3'].every((bid, i) => {
      const beforeTxt = origClz.options.find(o => o.label === origClz.correctAnswers[i]).text;
      const afterTxt = shufClz.options.find(o => o.label === shufClz.correctAnswers[i] && o.group === bid)?.text;
      return beforeTxt === afterTxt;
    });

    t('v21.7 (Cloze drop-down validation & per-blank shuffle): enforces 2–4 contiguous {{D#}} blanks with 3–5 options and 1 key each, and shuffles within each blank independently',
      clzIssues.filter(i => i.sev === 'error').length === 0 &&
      ENG.validateCaseStudy(mkCase([singleBlank]), factIndex, allowedIds, 'Status Asthmaticus').some(i => i.sev === 'error' && /contiguous placeholders/.test(i.msg)) &&
      ENG.validateCaseStudy(mkCase([gapBlank]), factIndex, allowedIds, 'Status Asthmaticus').some(i => i.sev === 'error' && /contiguous placeholders/.test(i.msg)) &&
      shufClz.correctAnswers.join(',') !== origClz.correctAnswers.join(',') &&
      clzTruthPreserved);
  }

  // 5. Trend flowsheet validation, threshold instantiation + presentedValues, stage timing, provenance, & SATA support
  {
    const trdIssues = ENG.validateCaseStudy(mkCase([mkTrend()]), factIndex, allowedIds, 'Status Asthmaticus');
    // Pre-crossing instantiated values (42 mL/hr against <30 mL/hr; 96 bpm against >100 bpm) warn honestly, never error,
    // AND enter presentedValues so rationale A discussing "42 mL/hr to 20 mL/hr" and "122 bpm" produces ZERO errors!
    const sataTrend = mkTrend();
    sataTrend.stem = '(Select all that apply) Review the flowsheet. Which findings confirm acute decompensation?';
    sataTrend.options.push({ label: 'E', text: 'Progressive oliguria reaching 20 mL/hr at 1000' });
    sataTrend.rationales.push({ option: 'E', text: 'Urine output of 20 mL/hr falls below the 30 mL/hr perfusion threshold.', supportType: 'instantiated', factIds: ['f-lab1'] });
    sataTrend.correctAnswers = ['A', 'E'];
    const sataTrdIssues = ENG.validateCaseStudy(mkCase([sataTrend]), factIndex, allowedIds, 'Status Asthmaticus');

    // Fabricated numeric trend on a fact with NO numeric threshold -> hard error!
    const fabTrend = mkTrend();
    fabTrend.trendTable.rows[0] = { label: ' Serum potassium', values: ['3.8 mEq/L', '4.9 mEq/L', '6.2 mEq/L'], supportType: 'instantiated', factIds: ['f-cue2'] };
    const fabIssues = ENG.validateCaseStudy(mkCase([fabTrend]), factIndex, allowedIds, 'Status Asthmaticus');

    // Stage timing & Fact Inspector provenance: Trend table in Stage 2 reveals f-lab1; Stage 1 citing f-lab1 warns "before it is revealed", while Stage 2 Trend itself has 0 "never presented" warnings for f-lab1!
    const twoStage = {
      title: 'Timing Check', condition: 'Status Asthmaticus', difficulty: 'exam', patient: { age: 30, sex: 'male', background: '' },
      stages: [
        { stageNumber: 1, title: 'S1', narrative: '', data: [{ label: 'Airway', value: 'Silent chest', supportType: 'direct', availability: 'revealed', factIds: ['f-cue2'] }],
          questions: [{ ...mkBowtie(), rationales: mkBowtie().rationales.map((r, idx) => idx === 0 ? { ...r, factIds: ['f-lab1'] } : { ...r, factIds: ['f-cue2'] }) }] },
        { stageNumber: 2, title: 'S2', narrative: '', data: [], questions: [mkTrend()] }
      ],
      debrief: { priorityProblem: '', keyDecisions: [], notes: '', factIds: [] }
    };
    const timingIssues = ENG.validateStageTiming(twoStage);
    const allIds = ENG.caseAllFactIds(mkCase([mkTrend()]));
    const prov = buildProv(mkCase([mkTrend()]), new Set(allIds), 'case-ngn', 'NGN Title');
    const shufTrd = ENG.caseShuffleQuestion(mkTrend(), () => 0);

    t('v21.7 (Trend flowsheet grounding, SATA mode, stage timing, & provenance): validates instantiated trajectories into presentedValues, blocks ungrounded numeric trends, tracks stage-timing/Fact-Inspector IDs, and keeps chronological timepoints on shuffle',
      trdIssues.filter(i => i.sev === 'error').length === 0 &&
      trdIssues.some(i => i.sev === 'warn' && /falls outside the threshold/.test(i.msg)) &&
      sataTrdIssues.filter(i => i.sev === 'error').length === 0 &&
      fabIssues.some(i => i.sev === 'error' && /no parseable threshold/.test(i.msg)) &&
      timingIssues.some(i => /Stage 1 q-bow cites f-lab1 before it is revealed/.test(i.msg)) &&
      !timingIssues.some(i => /Stage 2 q-trd cites f-lab1/.test(i.msg)) &&
      allIds.includes('f-lab1') &&
      prov.some(e => e.id === 'case-ngn:1:q-trd' && e.factIds.includes('f-lab1')) &&
      JSON.stringify(shufTrd.trendTable.timepoints) === '["0800","0900","1000"]' &&
      shufTrd.correctAnswers[0] !== 'A');
  }

  // 6. NEIA gate N/A scope, blind audit payload hygiene, & Booklet / Paired Case Packet Markdown
  {
    const mcq = {
      id: 'q-mcq', type: 'MCQ', stem: 'Based on the flowsheet above, which prescription should the nurse question?',
      options: [
        { label: 'A', text: 'Nonselective beta-blocker' },
        { label: 'B', text: 'Supplemental oxygen' },
        { label: 'C', text: 'Inhaled beta-2 agonist' },
        { label: 'D', text: 'Continuous pulse oximetry' }
      ],
      correctAnswers: ['A'],
      rationales: ['A', 'B', 'C', 'D'].map(o => ({ option: o, text: 'Grounded.', supportType: 'direct', factIds: ['f-never'] })),
      cjmmSkill: 'Take Action'
    };
    const mixedCs = mkCase([mkBowtie(), mkMatrix('single'), mkCloze(), mkTrend(), mcq]);
    const gate = ENG.caseGateItems(mixedCs);
    const auditPayload = ENG.caseAuditPayload(mixedCs, 1, mcq);
    const fullMd = ENG.caseToMarkdown(mixedCs, { worksheetFactIds: true });
    const printMd = ENG.caseToMarkdown(mixedCs, { worksheetFactIds: false });
    const pktMd = ENG.casePacketToMarkdown([
      { id: 'p1', caseStudy: mixedCs, issues: [], audit: null, auditState: 'disabled', provenance: null, artifactSource: null },
      { id: 'p2', caseStudy: mkCase([mkMatrix('multiple')]), issues: [], audit: null, auditState: 'disabled', provenance: null, artifactSource: null }
    ], { layout: 'booklet', worksheetFactIds: false });

    t('v21.7 (NEIA N/A scope, blind audit payload, & Booklet/PDF Markdown): marks all 4 NGN formats N/A while keeping MCQ eligible, strips [fact-*] and answers from audit/print worksheets, and renders formatted NGN Answer Keys in Case Packets',
      gate.filter(g => g.eligible).map(g => g.q.id).join(',') === 'q-mcq' &&
      gate.filter(g => !g.eligible).length === 4 &&
      auditPayload.includes('| Lung auscultation | Loud bilateral wheezes |') &&
      !auditPayload.includes('[f-cue2]') &&
      !auditPayload.includes('## Answer Key') &&
      fullMd.slice(0, fullMd.indexOf('## Answer Key')).includes('[f-cue2]') &&
      !printMd.slice(0, printMd.indexOf('## Answer Key')).includes('[f-cue2]') &&
      printMd.includes('Actions: A1, A2 · Condition: C1 · Parameters: P1, P2') &&
      printMd.includes('R1 → Indicated (R1:C1)') &&
      printMd.includes('D1: D1A (impending respiratory failure from silent chest)') &&
      pktMd.indexOf('# Case 2 of 2') < pktMd.indexOf('# Answer Key — Case 1 of 2'));
  }

  // 7. Sub-500 KB Babel ceiling & live CaseRenderer VDOM render smoke across all 4 NGN widgets
  {
    const babelScript = extractBabelScript(S);
    const babelPath = process.env.NSS_BABEL_STANDALONE || require('path').join(require('os').tmpdir(), 'nursing-study-suite-verify/node_modules/@babel/standalone/babel.js');
    const Babel = require(babelPath);
    const crRaw = span('function CaseRenderer({caseStudy:cs}){', '\nfunction GizmoImporter(){');
    const crJs = Babel.transform(crRaw, BROWSER_BABEL_OPTIONS).code;
    const states = [{ s: { '1-0': true, '1-1': true, '1-2': true, '1-3': true } }, { s: { '1-0': ['A1', 'A3'], '1-1': ['R1:C1', 'R2:C2'], '1-2': { D1: 'D1A', D2: 'D2B' } } }];
    let si = 0;
    const ReactStub = {
      Fragment: Symbol.for('react.fragment'),
      createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } })
    };
    const CaseRenderer = new Function(
      'React', 'useState', 'FactTag', 'caseFormatAnswerSummary',
      crJs + '\nreturn CaseRenderer;'
    )(
      ReactStub,
      init => { const idx = si++; const cur = states[idx] ? states[idx].s : (typeof init === 'function' ? init() : init); return [cur, fn => { states[idx] = { s: typeof fn === 'function' ? fn(cur) : fn }; }]; },
      ({ factId }) => ({ type: 'FactTag', props: { factId } }),
      ENG.caseFormatAnswerSummary
    );
    const vdom = CaseRenderer({ caseStudy: mkCase([mkBowtie(), mkMatrix('single'), mkCloze(), mkTrend()]) });
    const tags = new Set();
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (typeof n.type === 'string') tags.add(n.type);
      if (typeof n.type === 'function') walk(n.type(n.props || {}));
      else if (n.props && n.props.children !== undefined) walk(n.props.children);
    })(vdom);

    t('v21.7 (Sub-500 KB Babel ceiling & CaseRenderer NGN widget smoke): keeps text/babel < 500,000 chars and renders interactive Bowtie buttons, Matrix inputs/tables, Cloze <select> menus, and Trend flowsheets with revealed keys cleanly',
      babelScript.length < MAX_BABEL_SCRIPT_CHARS &&
      tags.has('table') &&
      tags.has('select') &&
      tags.has('input') &&
      tags.has('button') &&
      S.includes("['bowtie','Bow-tie (NGN)']") &&
      S.includes("['matrix','Matrix / grid (NGN)']") &&
      S.includes("['cloze','Cloze drop-down (NGN)']") &&
      S.includes("['trend','Trend (NGN)']"));
  }
};
