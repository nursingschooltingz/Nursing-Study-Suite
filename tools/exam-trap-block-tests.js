'use strict';

// v19.2: Exam Trap Blocks & Active-Recall Trap Pipeline (LATTE + P + Traps — Phase 1).
// Synthetic clinical fixtures modeled on Acute Hyperkalemia vs. Acute Hypokalemia and
// Acute Decompensated Respiratory Acidosis. No network calls.

module.exports = async function run(S, t) {
  const span = (a, b) => {
    const x = S.indexOf(a), y = S.indexOf(b, x + a.length);
    if (x < 0 || y < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous exam-trap anchor: ' + a);
    return S.slice(x, y);
  };
  const count = (s, sub) => s.split(sub).length - 1;

  // 1. Live extraction from shipped HTML
  const KB = new Function(
    span('function kbBuildFocusBlock(', '// Underextraction flag:') + '\n' +
    span('function kbSlug(', '// ── Durable Knowledge Base persistence') + '\n' +
    ';return {kbBuildFocusBlock,KB_EXAM_TRAP_RULES,KB_TRAP_ROLES,kbCoerceTrapFields,kbSanitizeContrastPartners,mergeLatteParts,kbNormalizeImported};'
  )();

  const VIEW = new Function(
    span('const KB_ENTITY_KINDS=', '// v17.4: facts with text') + '\n' +
    span('function ngFactRow(', 'function ngSplitParts(') + '\n' +
    span('function kbForPriority(', '// v16.7: completeness and captured-source limits') + '\n' +
    ';return {kbFactWeight,DIFFERENTIATOR_WEIGHT,BOX_TABLE_WEIGHT,TRAP_ROLE_WEIGHT,kbFactView,renderKBMarkdown,KB_TRAP_ROLE_BADGE,kbProjectExamTraps,kbFormatExamTrapText,auditKbExamTraps,kbForNCLEX,ngFactRow,ngBuildFactPool,kbForPriority};'
  )();

  const ANKI = new Function(
    'uid',
    span('function kbSourceText(f){', '\n') + '\n' +
    span('function kbUsableFactCount(', '// ── KB source chunking') + '\n' +
    span('function ankiParseCards(raw', 'function AnkiStyleBadges(') + '\n' +
    ';return {kbForAnki,ankiSourceSnapshot,ankiConditionTagCheck,ankiNormalizeConditionTags,ANKI_TRAP_TAG_MAP,ankiCardTraps,ankiStampConceptTags,ankiStampTrapTags,ankiFilterFactView,lintAnkiCard,ankiNumericAudit};'
  )(() => 'syn-trap-id');

  const selectCaseFacts = new Function(span('function selectCaseFacts(', '// Sufficiency check') + ';return selectCaseFacts;')();
  const caseRenderFactPacket = new Function('kbSourceText', span('function caseRenderFactPacket(', '// ── v15.6 item 5') + ';return caseRenderFactPacket;')(f => (f.sources || []).map(s => s.filename).join(', '));

  // ── 1. kbBuildFocusBlock examTraps composition & zero scope/tier side-effect ──
  const plainOff = KB.kbBuildFocusBlock('', '', '', 'prioritize', '', false, false);
  const trapsOnlyInScopeMode = KB.kbBuildFocusBlock('', '', '', 'scope', '', false, true);
  const focusConceptAndTraps = KB.kbBuildFocusBlock('1. Manage acute dyskalemias', '1. Hyperkalemia rescue order', '', 'prioritize', 'Fluid & Electrolytes', false, true);

  t('v19.2 (Traps): KB_TRAP_ROLES defines all 10 supported clinical trap roles',
    KB.KB_TRAP_ROLES.length === 10 &&
    ['twin-cue', 'twin-rx-opposite', 'trend-slope', 'pseudo-improvement', 'therapy-overshoot', 'bedside-first', 'ordered-escalation', 'hold-triangle', 'dynamic-monitor', 'never-click'].every(r => KB.KB_TRAP_ROLES.includes(r)));

  t('v19.2 (Traps): kbBuildFocusBlock appends KB_EXAM_TRAP_RULES without activating Focus SCOPE or PRIORITIZE rules when Focus text is blank',
    plainOff === '' &&
    trapsOnlyInScopeMode.includes('═══ EXAM TRAP MAPPING (HESI / ATI / NGN) ═══') &&
    trapsOnlyInScopeMode.includes(KB.KB_EXAM_TRAP_RULES) &&
    !trapsOnlyInScopeMode.includes('STUDENT-PROVIDED FOCUS CONTEXT') &&
    !trapsOnlyInScopeMode.includes('SCOPE MODE') &&
    !trapsOnlyInScopeMode.includes('PRIORITIZE MODE') &&
    focusConceptAndTraps.indexOf('STUDENT-PROVIDED FOCUS CONTEXT') < focusConceptAndTraps.indexOf('CONCEPT-BASED CURRICULUM STRUCTURE') &&
    focusConceptAndTraps.indexOf('CONCEPT-BASED CURRICULUM STRUCTURE') < focusConceptAndTraps.indexOf('EXAM TRAP MAPPING'));

  // ── 2. Decision 2: Zero extra keys when no trap metadata exists + coercion/canonicalization/restore ──
  {
    const untaggedKb = KB.mergeLatteParts([
      {
        source: { filename: 'lec1.pdf', range: 'p. 1' },
        conditions: [
          {
            name: 'Uncomplicated UTI',
            contrastPartners: [],
            facts: [
              { latteBucket: 'Look', tier: 2, trapRole: null, contrastWith: '', text: 'Dysuria and urinary frequency.', sourceQuote: 'Dysuria and urinary frequency', sourcePointer: { filename: 'lec1.pdf', location: 'p. 1' } }
            ]
          }
        ]
      }
    ], 'NUR 210', 'Exam 1', '', { examTraps: true });

    const restoredUntagged = KB.kbNormalizeImported(untaggedKb, { restore: true }).kb;
    t('v19.2 (Traps / Decision 2): mergeLatteParts and restore omit metadata.examTraps, contrastPartners, trapRole, and contrastWith when no trap facts exist',
      !('examTraps' in untaggedKb.metadata) &&
      !('contrastPartners' in untaggedKb.conditions[0]) &&
      !('trapRole' in untaggedKb.conditions[0].facts[0]) &&
      !('contrastWith' in untaggedKb.conditions[0].facts[0]) &&
      !('examTraps' in restoredUntagged.metadata) &&
      !('contrastPartners' in restoredUntagged.conditions[0]) &&
      !('trapRole' in restoredUntagged.conditions[0].facts[0]) &&
      !('contrastWith' in restoredUntagged.conditions[0].facts[0]));

    const trapMerged = KB.mergeLatteParts([
      {
        source: { filename: 'electrolytes.pdf', range: 'p. 1-3' },
        conditions: [
          {
            name: 'Acute Hyperkalemia',
            concept: 'Fluid & Electrolytes',
            contrastPartners: ['acute hypokalemia', 'Acute Hyperkalemia'],
            facts: [
              { latteBucket: 'Look', tier: 1, trapRole: 'twin-cue', contrastWith: 'acute hypokalemia', text: 'Tall peaked T waves, widened QRS, and ascending flaccid weakness.', sourceQuote: 'Tall peaked T waves, widened QRS', sourcePointer: { filename: 'electrolytes.pdf', location: 'p. 1' } },
              { latteBucket: 'Tests', tier: 1, trapRole: 'twin-cue', contrastWith: 'specimen hemolysis', text: 'Rule out specimen hemolysis when asymptomatic with a normal ECG.', sourceQuote: 'Rule out specimen hemolysis', sourcePointer: { filename: 'electrolytes.pdf', location: 'p. 1' } },
              { latteBucket: 'Assess', tier: 1, text: 'Serum potassium climbing alongside oliguria below 30 mL/hr.', sourceQuote: 'oliguria below 30 mL/hr', sourcePointer: { filename: 'electrolytes.pdf', location: 'p. 2' } },
              { latteBucket: 'Educate', tier: 2, trapRole: 'invented-role', text: 'Avoid salt substitutes containing potassium chloride.', sourceQuote: 'Avoid salt substitutes', sourcePointer: { filename: 'electrolytes.pdf', location: 'p. 3' } }
            ]
          },
          {
            name: 'Acute Hypokalemia',
            aliases: ['Hypokalemia'],
            concept: 'Fluid & Electrolytes',
            facts: [
              { latteBucket: 'Look', tier: 1, trapRole: 'twin-cue', contrastWith: 'Acute Hyperkalemia', text: 'Flat T waves, prominent U waves, and paralytic ileus.', sourceQuote: 'Flat T waves, prominent U waves', sourcePointer: { filename: 'electrolytes.pdf', location: 'p. 2' } }
            ]
          }
        ]
      },
      {
        source: { filename: 'electrolytes.pdf', range: 'p. 2-4' },
        conditions: [
          {
            name: 'Acute Hyperkalemia',
            facts: [
              { latteBucket: 'Assess', tier: 1, trapRole: 'trend-slope', text: 'Serum potassium climbing alongside oliguria below 30 mL/hr.', sourceQuote: 'oliguria below 30 mL/hr', sourcePointer: { filename: 'electrolytes.pdf', location: 'p. 2' } }
            ]
          }
        ]
      }
    ], 'NUR 210', 'Exam 2', '', { examTraps: true });

    const hyper = trapMerged.conditions.find(c => c.name === 'Acute Hyperkalemia');
    const twinCondFact = hyper.facts.find(f => f.text.startsWith('Tall peaked'));
    const artifactFact = hyper.facts.find(f => f.text.startsWith('Rule out specimen'));
    const mergedSlopeFact = hyper.facts.find(f => f.text.startsWith('Serum potassium climbing'));
    const coercedFact = hyper.facts.find(f => f.text.startsWith('Avoid salt substitutes'));

    t('v19.2 (Traps): mergeLatteParts canonicalizes peer-condition contrastWith, preserves non-condition artifact contrastWith ("specimen hemolysis"), merges duplicate trapRole, drops self-partner, and records unknown trapRole in coerced',
      trapMerged.metadata.examTraps === true &&
      JSON.stringify(hyper.contrastPartners) === '["Acute Hypokalemia"]' &&
      twinCondFact.contrastWith === 'Acute Hypokalemia' &&
      artifactFact.contrastWith === 'specimen hemolysis' &&
      mergedSlopeFact.trapRole === 'trend-slope' &&
      !('trapRole' in coercedFact) &&
      trapMerged.coerced.some(c => String(c.reason).includes('trapRole')));

    const restored = KB.kbNormalizeImported(JSON.parse(JSON.stringify(trapMerged)), { restore: true });
    const imported = KB.kbNormalizeImported(JSON.parse(JSON.stringify(trapMerged)), { restore: false });
    const throwsRestore = mutator => {
      const copy = JSON.parse(JSON.stringify(trapMerged));
      delete copy.coerced;
      mutator(copy);
      try { KB.kbNormalizeImported(copy, { restore: true }); return false; } catch (e) { return true; }
    };

    t('v19.2 (Traps): trap metadata round-trips across restore and import, and strict restore rejects tampered trapRole, contrastPartners, or metadata.examTraps',
      restored.kb.metadata.examTraps === true &&
      imported.kb.metadata.examTraps === true &&
      restored.kb.conditions.find(c => c.name === 'Acute Hyperkalemia').facts.find(f => f.id === artifactFact.id).contrastWith === 'specimen hemolysis' &&
      throwsRestore(k => { k.conditions[0].facts[0].trapRole = 'bogus-trap'; }) &&
      throwsRestore(k => { k.conditions[0].contrastPartners = [42]; }) &&
      throwsRestore(k => { k.metadata.examTraps = 'yes'; }));
  }

  // ── 3. build() end-to-end with kbExamTraps=true (Pass 1 + Pass 2 [trap:...] inventory + recovery) ──
  {
    const buildSpan = span('const build=async()=>{', '\n  const exportDiag=()=>{');
    const sourceText = 'Acute Hyperkalemia: stop potassium IV fluids first. Check capillary blood glucose after IV regular insulin with dextrose.';
    const pass1Reply = {
      conditions: [
        {
          name: 'Acute Hyperkalemia',
          contrastPartners: ['Acute Hypokalemia'],
          facts: [
            { latteBucket: 'Treatments', subtype: null, factType: 'other', tier: 1, safetyCritical: true, trapRole: 'bedside-first', text: 'Stop potassium IV fluids first.', sourceQuote: 'stop potassium IV fluids first' }
          ]
        }
      ],
      medications: [], diagnostics: [], scoringTools: [], formulas: [], contradictions: []
    };
    const pass2Reply = {
      missed: [
        { conditionName: 'Acute Hyperkalemia', contrastPartners: ['Hypokalemia'], latteBucket: 'Assess', subtype: null, factType: 'other', tier: 1, safetyCritical: true, trapRole: 'dynamic-monitor', text: 'Check capillary blood glucose after IV regular insulin with dextrose.', sourceQuote: 'Check capillary blood glucose after IV regular insulin with dextrose' }
      ]
    };
    const state = { published: [], diag: null, logs: [], warnings: [], error: '', requests: [] };
    const files = [{ name: 'dyskalemia.pdf' }];
    const buildFn = new Function(
      'cfg', 'files', 'currentFiles', 'kbConfirmReplace', 'replacementSlot', 'setBusy', 'setError', 'setWarnings', 'setProg', 'setDiag', 'setLogs', 'setSelected', 'addLog', 'abortRef',
      'kbOutcomes', 'kbPoints', 'kbExtra', 'focusMode', 'kbConcepts', 'kbConceptAuto', 'kbExamTraps', 'cardGate', 'cardIsImage', 'kbBuildSourceChunks', 'chunkChars', 'overlapUnits', 'probeComposition',
      'laneCount', 'verifyPass', 'KB_EXTRACTION_PROMPT', 'KB_VERIFY_PROMPT', 'kbBuildFocusBlock', 'kbNormForMatch', 'kbDehyphNormForMatch', 'kbCanonOperators', 'kbClassifyQuoteMiss',
      'geminiRequest', 'kbValidateExtractionEnvelope', 'extractJSON', 'kbSplitChunk', 'geminiHaltsBatch', 'kbQuoteInSource', 'kbQuoteOperatorsAgree', 'kbRunLanes', 'kbCompareOrder',
      'mergeLatteParts', 'course', 'exam', 'kbFlagUnderextraction', 'kbBucketGaps', 'K',
      buildSpan + '\n;return build;'
    )(
      { apiKey: 'k', autoProfile: true, forTool: () => ({ model: 'm', level: 'low' }) },
      files, { current: files }, () => true,
      { current: { start: () => ({ ctl: new AbortController() }), current: () => true, owns: () => true, finish: () => true } },
      () => {}, e => { state.error = e; }, w => { state.warnings = w; }, () => {}, d => { state.diag = d; }, () => {}, () => {},
      (m, tp) => state.logs.push({ m, tp }), { current: null },
      '', '', '', 'scope', '', false, true,
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
    const recMon = built.conditions[0].facts.find(f => f.trapRole === 'dynamic-monitor');

    t('v19.2 (Traps): build() with kbExamTraps=true injects KB_EXAM_TRAP_RULES, marks Pass-2 inventory with [trap:...], and lifts recovered contrastPartners off fact objects',
      !state.error &&
      state.diag.focus === null &&
      state.requests[0].includes('EXAM TRAP MAPPING (HESI / ATI / NGN)') &&
      state.requests[1].includes('[trap:bedside-first]') &&
      built.metadata.examTraps === true &&
      !!recMon && recMon.recovered === true && !('contrastPartners' in recMon) &&
      built.conditions[0].contrastPartners.includes('Hypokalemia'));
  }

  // ── 4. Study View, kbProjectExamTraps, kbFormatExamTrapText, Decision 3, and auditKbExamTraps ──
  const referenceKb = {
    metadata: { schemaVersion: '1.2', examTraps: true },
    conditions: [
      {
        id: 'acute-hyperkalemia',
        name: 'Acute Hyperkalemia',
        concept: 'Fluid & Electrolytes',
        entryRole: 'exemplar',
        contrastPartners: ['Acute Hypokalemia'],
        facts: [
          { id: 'fact-1', latteBucket: 'Look', tier: 1, trapRole: 'twin-cue', contrastWith: 'Acute Hypokalemia', text: 'Tall peaked T waves, widened QRS, and ascending flaccid weakness.', sources: [{ filename: 'fe.pdf', location: 'p. 10' }] },
          { id: 'fact-2', latteBucket: 'Tests', tier: 1, trapRole: 'twin-cue', contrastWith: 'specimen hemolysis', text: 'Rule out specimen hemolysis when asymptomatic with a normal ECG.', sources: [{ filename: 'fe.pdf', location: 'p. 10' }] },
          { id: 'fact-3', latteBucket: 'Treatments', tier: 1, trapRole: 'twin-rx-opposite', contrastWith: 'Acute Hypokalemia', text: 'Restrict potassium and shift intracellularly with IV insulin plus dextrose.', sources: [{ filename: 'fe.pdf', location: 'p. 12' }] },
          { id: 'fact-4', latteBucket: 'Assess', tier: 1, trapRole: 'trend-slope', text: 'Serum potassium climbing from 4.4 to 5.3 mEq/L with oliguria below 30 mL/hr.', sources: [{ filename: 'fe.pdf', location: 'p. 11' }] },
          { id: 'fact-5', latteBucket: 'Treatments', tier: 1, trapRole: 'bedside-first', text: 'Stop all potassium-containing IV fluids including Lactated Ringer\'s and place on continuous telemetry first.', sources: [{ filename: 'fe.pdf', location: 'p. 12' }] },
          { id: 'fact-6', latteBucket: 'Treatments', tier: 1, trapRole: 'ordered-escalation', text: 'Administer ordered IV calcium gluconate to stabilize cardiac membranes before IV regular insulin with dextrose.', sources: [{ filename: 'fe.pdf', location: 'p. 12' }] },
          { id: 'fact-7', latteBucket: 'Assess', tier: 1, trapRole: 'dynamic-monitor', text: 'Monitor continuous ECG morphology, hourly serum potassium, and capillary blood glucose.', sources: [{ filename: 'fe.pdf', location: 'p. 13' }] },
          { id: 'fact-8', latteBucket: 'Treatments', tier: 1, trapRole: 'never-click', factType: 'contraindication', text: 'Never administer IV potassium chloride by push, never expect calcium gluconate to lower serum potassium, and never choose sodium polystyrene sulfonate first during acute QRS widening.', sources: [{ filename: 'fe.pdf', location: 'p. 13' }] }
        ]
      },
      {
        id: 'acute-hypokalemia',
        name: 'Acute Hypokalemia',
        concept: 'Fluid & Electrolytes',
        entryRole: 'exemplar',
        contrastPartners: ['Acute Hyperkalemia'],
        facts: [
          { id: 'fact-9', latteBucket: 'Look', tier: 1, trapRole: 'twin-cue', contrastWith: 'Acute Hyperkalemia', text: 'Flat T waves, prominent U waves, and paralytic ileus.', sources: [{ filename: 'fe.pdf', location: 'p. 14' }] },
          { id: 'fact-10', latteBucket: 'Treatments', tier: 1, trapRole: 'twin-rx-opposite', contrastWith: 'Acute Hyperkalemia', text: 'Administer diluted IV potassium chloride via infusion pump, never IV push.', sources: [{ filename: 'fe.pdf', location: 'p. 15' }] }
        ]
      },
      {
        id: 'resp-acidosis',
        name: 'Acute Decompensated Respiratory Acidosis',
        concept: 'Acid-Base',
        entryRole: 'exemplar',
        facts: [
          { id: 'fact-11', latteBucket: 'Tests', tier: 1, trapRole: 'twin-cue', contrastWith: 'chronic compensated COPD baseline', text: 'pH below 7.35, PaCO2 above 45 mm Hg, with normal HCO3 of 22 to 26 mEq/L versus renal-buffered HCO3 above 28 mEq/L in chronic COPD.', sources: [{ filename: 'abg.pdf', location: 'p. 4' }] },
          { id: 'fact-12', latteBucket: 'Assess', tier: 1, trapRole: 'pseudo-improvement', text: 'PaCO2 climbing from 33 mm Hg into the normal 42 to 45 mm Hg range as loud wheezes fade into a silent chest with new drowsiness.', sources: [{ filename: 'abg.pdf', location: 'p. 5' }] },
          { id: 'fact-13', latteBucket: 'Treatments', tier: 1, trapRole: 'never-click', factType: 'contraindication', text: 'Never interpret disappearing wheezes with lethargy as bronchodilator success or give PRN sedatives for hypercapnic restlessness.', sources: [{ filename: 'abg.pdf', location: 'p. 6' }] }
        ]
      }
    ],
    medications: [
      {
        id: 'spironolactone',
        name: 'Spironolactone',
        facts: [
          { id: 'fact-14', latteBucket: 'Treatments', tier: 1, trapRole: 'hold-triangle', text: 'Hold spironolactone and ACE inhibitors in Acute Hyperkalemia when serum potassium exceeds 5.0 mEq/L or oliguria develops.', sources: [{ filename: 'fe.pdf', location: 'p. 13' }] }
        ]
      }
    ]
  };

  {
    const legacyKb = {
      conditions: [
        { id: 'gout', name: 'Gout', facts: [{ id: 'fact-99', latteBucket: 'Look', tier: 2, text: 'Podagra at first metatarsophalangeal joint.', sources: [{ filename: 'msk.pdf', location: 'p. 2' }] }] }
      ]
    };
    const legacyDefaultMd = VIEW.renderKBMarkdown(VIEW.kbFactView(legacyKb));
    const legacyWorksheetMd = VIEW.renderKBMarkdown(VIEW.kbFactView(legacyKb), { showEmptyTrapWorksheet: true });

    t('v19.2 (Traps / Decision 3): legacy KBs without trap facts omit Exam Trap Blocks by default and render [not stated in source] worksheet only when opted in',
      VIEW.kbProjectExamTraps(legacyKb.conditions[0], legacyKb) === null &&
      VIEW.auditKbExamTraps(VIEW.kbFactView(legacyKb)) === null &&
      !legacyDefaultMd.includes('Exam Trap Block') &&
      legacyWorksheetMd.includes('### ⚡ Exam Trap Block — Exemplar: Gout') &&
      count(legacyWorksheetMd, '[not stated in source]') === 5);

    const view = VIEW.kbFactView(referenceKb);
    const selHyper = view.conditions.find(c => c.name === 'Acute Hyperkalemia');
    const singleSelMd = VIEW.renderKBMarkdown({ ...referenceKb, conditions: [selHyper] });
    const projHyper = VIEW.kbProjectExamTraps(selHyper, referenceKb);
    const clipText = VIEW.kbFormatExamTrapText(projHyper);
    const trapAudit = VIEW.auditKbExamTraps(view);

    t('v19.2 (Traps): Study View single-condition projection renders <Concept> Exemplar header, 2-column Twin Contrast Strip, linked entity Hold & Monitor, ordered Action Split, and 4-part Never-Click Trap',
      singleSelMd.includes('### ⚡ Exam Trap Block — Fluid & Electrolytes Exemplar: Acute Hyperkalemia') &&
      singleSelMd.includes('| Dimension | Acute Hyperkalemia | Acute Hypokalemia |') &&
      singleSelMd.includes('| **Tie-Breaker Cues** |') &&
      singleSelMd.includes('| **Treatment Opposite** |') &&
      singleSelMd.includes('- **Twin Tie-Breaker:**') &&
      singleSelMd.includes('Rule out specimen hemolysis') &&
      singleSelMd.includes('- **Slope Red Flag:**') &&
      singleSelMd.includes('- **Action Split:** *Bedside first:* Stop all potassium-containing IV fluids') &&
      singleSelMd.includes('*Ordered escalation:* Administer ordered IV calcium gluconate') &&
      singleSelMd.includes('- **Hold & Monitor:** *Hold:* Hold spironolactone') &&
      singleSelMd.includes('*Monitor:* Monitor continuous ECG morphology, hourly serum potassium, and capillary blood glucose.') &&
      singleSelMd.includes('- **Never-Click Trap:** Never administer IV potassium chloride by push') &&
      clipText.startsWith('**Fluid & Electrolytes Exemplar: Acute Hyperkalemia**') &&
      clipText.includes('* **Never-Click Trap:**'));

    t('v19.2 (Traps): auditKbExamTraps summarizes condition coverage and missing trap slots without raising validation errors',
      trapAudit !== null &&
      trapAudit.conditionCount === 3 &&
      trapAudit.coveredConditionCount === 3 &&
      trapAudit.trapFactCount === 14 &&
      trapAudit.missingSlopeConditions.includes('Acute Hypokalemia') &&
      trapAudit.missingHoldMonitorConditions.includes('Acute Decompensated Respiratory Acidosis') &&
      !trapAudit.missingSlopeConditions.includes('Acute Hyperkalemia'));
  }

  // ── 5. Anki Active-Recall Trap Pipeline (kbForAnki, twin-contrast, Trap::* stamping, scopeMode='traps', ankiNumericAudit) ──
  {
    const plainKb = { conditions: [{ name: 'Gout', aliases: [], facts: [{ id: 'fact-1', latteBucket: 'Look', tier: 2, text: 'Great toe pain.', sources: [{ filename: 'a.pdf', location: 'p. 1' }] }] }] };
    const plainSnap = ANKI.ankiSourceSnapshot(plainKb);
    const plainAnkiTxt = ANKI.kbForAnki(plainKb);

    const view = VIEW.kbFactView(referenceKb);
    const trapSnap = ANKI.ankiSourceSnapshot(view);
    const trapAnkiTxt = ANKI.kbForAnki(view);

    t('v19.2 (Traps): kbForAnki and ankiSourceSnapshot emit CONTRAST PARTNERS and Trap/Contrast markers only when present, leaving plain KBs untouched',
      !plainAnkiTxt.includes('CONTRAST PARTNERS:') &&
      !plainAnkiTxt.includes('| Trap:') &&
      !('trapRole' in plainSnap.facts[0]) &&
      trapAnkiTxt.includes('CONTRAST PARTNERS: Acute Hypokalemia') &&
      trapAnkiTxt.includes('| Trap: twin-cue | Contrast: Acute Hypokalemia |') &&
      trapAnkiTxt.includes('| Trap: pseudo-improvement |') &&
      trapSnap.byId['fact-12'].trapRole === 'pseudo-improvement');

    // Explicit twin contrast WITHOUT a shared overarching concept
    const nonConceptTwins = ANKI.ankiSourceSnapshot({
      conditions: [
        { name: 'SIADH', contrastPartners: ['Diabetes Insipidus'], facts: [{ id: 'fact-1', latteBucket: 'Tests', tier: 1, trapRole: 'twin-cue', contrastWith: 'Diabetes Insipidus', text: 'Serum sodium below 135 mEq/L with high urine specific gravity above 1.030.' }] },
        { name: 'Diabetes Insipidus', aliases: ['DI'], facts: [{ id: 'fact-2', latteBucket: 'Tests', tier: 1, trapRole: 'twin-cue', text: 'Hypernatremia above 145 mEq/L with dilute urine specific gravity below 1.005.' }] },
        { name: 'Acute Pancreatitis', facts: [{ id: 'fact-3', latteBucket: 'Tests', tier: 1, text: 'Elevated serum lipase.' }] }
      ]
    });
    const validTwinNote = { id: 'n-twin', chunk: 1, sourceLine: 1, text: '[SIADH vs. DI] Urine specific gravity: {{c1::>1.030 in SIADH}} vs. {{c2::<1.005 in DI}}', extra: '', tags: 'Nursing::LATTE::Tests Topic::Contrast Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-1', 'fact-2'], keep: true, tagFormatContract: 'hierarchical-v1' };
    const unlinkedMixNote = { ...validTwinNote, id: 'n-mix', factIds: ['fact-1', 'fact-3'] };
    const twinCheck = ANKI.ankiConditionTagCheck(validTwinNote, nonConceptTwins);
    const unlinkedCheck = ANKI.ankiConditionTagCheck(unlinkedMixNote, nonConceptTwins);

    t('v19.2 (Traps): ankiConditionTagCheck accepts explicit twin-condition Topic::Contrast notes even without a shared parent concept while still flagging unlinked cross-condition mixes',
      twinCheck.status === 'canonical' &&
      twinCheck.code === 'twin-contrast' &&
      unlinkedCheck.status === 'review' &&
      unlinkedCheck.code === 'topic-tag');

    const rawDeck = [
      { id: 'c1', chunk: 1, sourceLine: 1, text: '[Acute Decompensated Respiratory Acidosis] PaCO2 climbing from 33 mm Hg into normal 42 to 45 mm Hg as loud wheezes fade into a silent chest signals {{c1::impending respiratory failure (pseudo-improvement)}}', extra: '', tags: 'Nursing::LATTE::Assess Condition::AcuteDecompensatedRespiratoryAcidosis Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-12'], keep: true, tagFormatContract: 'hierarchical-v1' },
      { id: 'c2', chunk: 1, sourceLine: 2, text: '[Acute Hyperkalemia — NEVER DO] During acute QRS widening, never choose {{c1::sodium polystyrene sulfonate}} first or administer {{c2::IV potassium chloride by push}}', extra: '', tags: 'Nursing::LATTE::Treatments Condition::AcuteHyperkalemia Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-8'], keep: true, tagFormatContract: 'hierarchical-v1' },
      { id: 'c3', chunk: 1, sourceLine: 3, text: '[Acute Hyperkalemia] Rescue sequence & safety monitor: give {{c1::IV calcium gluconate}} before {{c2::IV regular insulin with dextrose}}, and track {{c3::capillary blood glucose}}', extra: '', tags: 'Nursing::LATTE::Treatments Condition::AcuteHyperkalemia Tier::1', pipeCount: 2, parseIssues: [], mappingIssues: [], factIds: ['fact-6', 'fact-7'], keep: true, tagFormatContract: 'hierarchical-v1' }
    ];
    const stamped = ANKI.ankiStampTrapTags(ANKI.ankiStampConceptTags(rawDeck, trapSnap), trapSnap);
    const batch = { snapshot: trapSnap };
    const cleanAudit = ANKI.ankiNumericAudit(stamped[0], batch, true);
    const inventedAudit = ANKI.ankiNumericAudit({ ...stamped[0], text: '[Asthma] PaCO2 rising from 29 mm Hg to 44 mm Hg signals {{c1::fatigue}}' }, batch, true);
    const trapsOnlyView = ANKI.ankiFilterFactView(view, '', 'traps');

    t('v19.2 (Traps): ankiStampTrapTags stamps hierarchical Trap::* tags with zero lint errors, leaves plain KBs untouched, filters traps mode, and ankiNumericAudit catches invented serial numbers',
      ANKI.ankiStampTrapTags(rawDeck, plainSnap) === rawDeck &&
      stamped.every(c => ANKI.lintAnkiCard(c).length === 0) &&
      ANKI.ankiCardTraps(stamped[0].tags).join(',') === 'PseudoImprovement' &&
      ANKI.ankiCardTraps(stamped[1].tags).join(',') === 'NeverClick' &&
      ANKI.ankiCardTraps(stamped[2].tags).join(',') === 'OrderedEscalation,DynamicMonitor' &&
      cleanAudit.status === 'No numeric mismatch detected' &&
      inventedAudit.status === 'Numeric discrepancy' &&
      trapsOnlyView.conditions.reduce((n, c) => n + c.facts.length, 0) === 14);
  }

  // ── 6. Priority, NCLEX, Case Connectors & UI Source Contracts ──
  {
    const plainF = { id: 'f0', latteBucket: 'Assess', tier: 1, text: 'Plain fact.' };
    const trapF = { id: 'f1', latteBucket: 'Assess', tier: 1, trapRole: 'trend-slope', text: 'Slope fact.' };
    const diffF = { id: 'f2', latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', text: 'Diff fact.' };
    const bothF = { id: 'f3', latteBucket: 'Assess', tier: 1, conceptScope: 'differentiator', trapRole: 'pseudo-improvement', text: 'Both fact.' };

    t('v19.2 (Traps): kbFactWeight orders differentiator+trap > differentiator > trap > plain while keeping plain weight=1',
      VIEW.kbFactWeight(plainF) === 1 &&
      VIEW.kbFactWeight(trapF) === 2 &&
      VIEW.kbFactWeight(diffF) === 3 &&
      VIEW.kbFactWeight(bothF) === 4);

    const view = VIEW.kbFactView(referenceKb);
    const prio = VIEW.kbForPriority(view, { conditionQuery: 'hyperkalemia' });
    const nclex = VIEW.kbForNCLEX(view, { conditionQuery: 'hyperkalemia' });
    const pool = VIEW.ngBuildFactPool({
      conditions: [{ name: 'Mixed', facts: [plainF, trapF, diffF, bothF] }]
    });

    const caseCond = {
      name: 'Acute Hyperkalemia',
      facts: Array.from({ length: 10 }, (_, i) => ({
        id: 'cf-' + (i + 1),
        latteBucket: 'Assess',
        tier: 1,
        safetyCritical: false,
        ...(i === 9 ? { trapRole: 'dynamic-monitor', contrastWith: 'Acute Hypokalemia' } : {}),
        text: 'Assessment cue ' + (i + 1) + '.',
        sources: [{ filename: 'fe.pdf', location: 'p. 1' }]
      }))
    };
    const pickedCase = selectCaseFacts(caseCond);
    const casePkt = caseRenderFactPacket('Acute Hyperkalemia', pickedCase);

    t('v19.2 (Traps): Priority, NCLEX, and Case connectors surface TRAP markers and rank trap facts ahead of untagged peers',
      prio.includes('; TRAP twin-cue vs Acute Hypokalemia;') &&
      nclex.includes('[TRAP: twin-cue vs Acute Hypokalemia]') &&
      pool[0].facts.map(f => f.id).join(',') === 'f3,f2,f1,f0' &&
      pickedCase[0].id === 'cf-10' &&
      casePkt.includes('[TRAP: dynamic-monitor vs Acute Hypokalemia]'));

    const kbBuilder = span('function KnowledgeBaseBuilder(){', '\n// ──── TOOL: Priority Analyzer ────');
    const ankiGen = span('function AnkiGenerator(){', '\n// ──── TOOL: NCLEX Extractor ────');

    t('v19.2 (Traps): KnowledgeBaseBuilder and AnkiGenerator wire Step 01 default-on trap toggle, empty worksheet toggle, Study View single-mdToSafeHtml invariant, and EXAM TRAPS review filters',
      kbBuilder.includes('const [kbExamTraps,setKbExamTraps]=useState(true);') &&
      kbBuilder.includes('const [kbTrapWorksheet,setKbTrapWorksheet]=useState(false);') &&
      kbBuilder.includes('id="kb-exam-traps"') &&
      kbBuilder.includes('id="kb-trap-worksheet"') &&
      count(kbBuilder, 'mdToSafeHtml(') === 1 &&
      ankiGen.includes('<option value="traps">') &&
      ankiGen.includes('EXAM TRAPS:'));
  }
};
