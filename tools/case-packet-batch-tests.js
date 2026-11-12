'use strict';

// v20.1: Multi-case Session Packet (Exam Booklet & Paired exports) + Walk-Away Batch Queue regression suite.
// Synthetic clinical fixtures only; zero live Gemini API calls.

const { load: loadCaseModule, fixture: caseFixture, question: caseQuestion, index: caseIndex } = require('./case-remediation-tests');

module.exports = async function run(S, t) {
  const span = (a, b) => {
    const x = S.indexOf(a), y = S.indexOf(b, x + a.length);
    if (x < 0 || y < 0 || S.indexOf(a, x + 1) >= 0) throw new Error('Missing or ambiguous case-packet-batch anchor: ' + a);
    return S.slice(x, y);
  };

  // 1. Live extraction from shipped HTML with non-vacuous tail verification
  const BUNDLE = new Function(
    span('const NCLEX_TEST_PLAN_VERSION=', 'const CASE_QUESTION_RULES=') + '\n' +
    span('function artifactSourceCurrent(', 'function FactTag(') + '\n' +
    span('function kbScopeHasSelection(', '// v17.4: facts with text') + '\n' +
    span('function selectCaseFacts(', 'function caseRenderFactPacket(') + '\n' +
    span('const ITEM_LETTER_NOUN=', '// v17.12: the worksheet kept each choice') + '\n' +
    span('const CASE_CLINICAL_TOKEN_RE=', 'function CaseStudyGenerator()') + '\n' +
    ';return {MAX_CASE_BATCH,caseSplitMarkdown,casePacketToMarkdown,casePacketJsonExport,caseBuildBatchTargets,caseRunBatchQueue,kbResolveScopeGroups,artifactSourceCurrent,artifactExportNotice,artifactJsonExport,caseToMarkdown,caseReviewRows};'
  )();

  t('v20.1 (Packet extraction): shipped span reaches MAX_CASE_BATCH=8 and caseRunBatchQueue tail',
    BUNDLE.MAX_CASE_BATCH === 8 &&
    typeof BUNDLE.caseSplitMarkdown === 'function' &&
    typeof BUNDLE.casePacketToMarkdown === 'function' &&
    typeof BUNDLE.casePacketJsonExport === 'function' &&
    typeof BUNDLE.caseBuildBatchTargets === 'function' &&
    typeof BUNDLE.caseRunBatchQueue === 'function');

  // 2. Synthetic 3-case packet fixture (including literal $& in title to prove safe replacement)
  const mkCase = (title, condition, factId) => {
    const q = caseQuestion();
    q.rationales.forEach(r => { r.factIds = [factId]; });
    const cs = caseFixture(q);
    cs.title = title;
    cs.condition = condition;
    cs.difficulty = 'exam';
    cs.stages[0].data = [{ label: 'Serum K+', value: '5.8 mEq/L', supportType: 'direct', availability: 'revealed', factIds: [factId] }];
    cs.debrief = { priorityProblem: condition + ' crisis', keyDecisions: ['Stabilize membrane first'], notes: 'Synthetic note.' };
    return cs;
  };

  const activeKB = { id: 'kb-current' };
  const oldKB = { id: 'kb-earlier' };

  const entry1 = {
    id: 'pkt-1',
    caseStudy: mkCase('Peaked T-Wave Emergency', 'Acute Hyperkalemia', 'fact-1'),
    issues: [],
    coverage: { selected: 10, used: 4, outOfPacket: [], uncovered: [] },
    audit: { '1:q1': { status: 'PASS', criterion: '', detail: '', warns: [] } },
    auditState: 'complete',
    provenance: { genModel: 'gemini-4-argon', genLevel: 'high', auditModel: 'gemini-4-argon', auditLevel: 'high', promptLabel: 'case builder v17.3' },
    artifactSource: { sourceKB: activeKB, requested: 1, auditRequested: true }
  };

  const entry2 = {
    id: 'pkt-2',
    caseStudy: mkCase('Polyuria Tie-Breaker', 'SIADH vs. Diabetes Insipidus', 'fact-2'),
    issues: [{ sev: 'warn', msg: 'Synthetic timing advisory' }],
    coverage: { selected: 12, used: 5, outOfPacket: [], uncovered: [] },
    audit: { '1:q1': { status: 'REPAIRED', criterion: 'Distractor length', detail: 'rewritten after failing; not re-audited', warns: [] } },
    auditState: 'complete',
    provenance: { genModel: 'gemini-4-argon', genLevel: 'high', auditModel: 'gemini-4-argon', auditLevel: 'high', promptLabel: 'case builder v17.3' },
    artifactSource: { sourceKB: activeKB, requested: 1, auditRequested: true }
  };

  const entry3 = {
    id: 'pkt-3',
    caseStudy: mkCase('Ketosis & $100/$& Copay Discharge', 'Diabetic Ketoacidosis', 'fact-3'),
    issues: [],
    coverage: { selected: 8, used: 3, outOfPacket: [], uncovered: [] },
    audit: null,
    auditState: 'disabled',
    provenance: { genModel: 'gemini-4-argon', genLevel: 'high', auditModel: '', auditLevel: '', promptLabel: 'case builder v17.3' },
    artifactSource: { sourceKB: activeKB, requested: 1, auditRequested: false }
  };

  // 3. Booklet mode (All student worksheets first -> Pagebreak -> Master Answer Keys at back)
  {
    const printMd = BUNDLE.casePacketToMarkdown([entry1, entry2, entry3], {
      activeKB,
      layout: 'booklet',
      worksheetFactIds: false,
      includeProvenance: false
    });
    const w1 = printMd.indexOf('# Case 1 of 3 — Peaked T-Wave Emergency');
    const w2 = printMd.indexOf('# Case 2 of 3 — Polyuria Tie-Breaker');
    const w3 = printMd.indexOf('# Case 3 of 3 — Ketosis & $100/$& Copay Discharge');
    const k1 = printMd.indexOf('# Answer Key — Case 1 of 3: Peaked T-Wave Emergency');
    const k2 = printMd.indexOf('# Answer Key — Case 2 of 3: Polyuria Tie-Breaker');
    const k3 = printMd.indexOf('# Answer Key — Case 3 of 3: Ketosis & $100/$& Copay Discharge');
    const firstKeyHeading = printMd.indexOf('## Answer Key');

    t('v20.1 (Booklet order): places all student worksheets 1..N strictly before every Answer Key section with pagebreaks between cases and literal $& title safety',
      w1 > 0 && w2 > w1 && w3 > w2 && k1 > w3 && k2 > k1 && k3 > k2 &&
      firstKeyHeading > w3 &&
      (printMd.match(/<div class="pagebreak"><\/div>/g) || []).length === 5);

    const worksheetSlice = printMd.slice(w1, k1);
    const keySlice = printMd.slice(k1);
    t('v20.1 (Booklet student print): omits [fact-*] tags and provenance stamps from student worksheets while retaining [fact-*] rationale citations and review appendices at the back',
      !worksheetSlice.includes('[fact-1]') &&
      !worksheetSlice.includes('[fact-2]') &&
      !printMd.includes('Generator: gemini-4-argon') &&
      keySlice.includes('[fact-1]') &&
      keySlice.includes('[fact-2]') &&
      keySlice.includes('Synthetic timing advisory') &&
      keySlice.includes('REPAIRED'));

    const fullMd = BUNDLE.casePacketToMarkdown([entry1, entry2], {
      activeKB,
      layout: 'booklet',
      worksheetFactIds: true,
      includeProvenance: true
    });
    t('v20.1 (Booklet .md export): retains worksheet [fact-*] tags and provenance stamps when requested',
      fullMd.slice(0, fullMd.indexOf('# Answer Key — Case 1')).includes('[fact-1]') &&
      fullMd.includes('Generator: gemini-4-argon [Thinking: high]'));
  }

  // 4. Paired mode (Case 1 -> Key 1 -> Case 2 -> Key 2)
  {
    const pairedMd = BUNDLE.casePacketToMarkdown([entry1, entry2], {
      activeKB,
      layout: 'paired',
      worksheetFactIds: false,
      includeProvenance: false
    });
    const w1 = pairedMd.indexOf('# Case 1 of 2 — Peaked T-Wave Emergency');
    const k1 = pairedMd.indexOf('# Answer Key — Case 1 of 2: Peaked T-Wave Emergency');
    const w2 = pairedMd.indexOf('# Case 2 of 2 — Polyuria Tie-Breaker');
    const k2 = pairedMd.indexOf('# Answer Key — Case 2 of 2: Polyuria Tie-Breaker');

    t('v20.1 (Paired order): alternates each case worksheet immediately with its own Answer Key and Debrief across pagebreaks',
      w1 > 0 && k1 > w1 && w2 > k1 && k2 > w2 &&
      (pairedMd.match(/<div class="pagebreak"><\/div>/g) || []).length === 3);
  }

  // 5. Validation-error banners, earlier-KB source notices, and JSON packet export
  {
    const failedEntry = {
      ...entry2,
      issues: [{ sev: 'error', msg: 'Stage 1 datum Serum Na+ 199 mEq/L is unsupported by cited fact' }]
    };
    const staleEntry = {
      ...entry3,
      artifactSource: { sourceKB: oldKB, requested: 1, auditRequested: false }
    };
    const flaggedMd = BUNDLE.casePacketToMarkdown([entry1, failedEntry, staleEntry], {
      activeKB,
      layout: 'booklet',
      worksheetFactIds: false
    });
    const stamps = (flaggedMd.match(/FAILED VALIDATION/g) || []).length;
    t('v20.1 (Packet safety stamps): flags unverified cases at the packet header, table of contents, worksheet, and answer key, and discloses earlier-KB entries',
      flaggedMd.includes('PACKET CONTAINS UNVERIFIED CASE(S) — Case 2 (Polyuria Tie-Breaker: 1 error(s))') &&
      stamps >= 3 &&
      flaggedMd.includes('earlier KB') &&
      flaggedMd.includes('Source: earlier Knowledge Base.'));

    const beforeJson = JSON.stringify(entry1.caseStudy);
    const packetJson = JSON.parse(BUNDLE.casePacketJsonExport([entry1, failedEntry, staleEntry], activeKB));
    t('v20.1 (Packet JSON export): serializes all packet cases with _packetNumber and _suiteReview metadata without mutating case objects',
      packetJson.packetVersion === 1 &&
      packetJson.caseCount === 3 &&
      packetJson.cases[0]._packetNumber === 1 &&
      packetJson.cases[1]._suiteReview.validation[0].severity === 'error' &&
      packetJson.cases[1]._suiteReview.itemAudit[0].status === 'REPAIRED' &&
      packetJson.cases[2]._suiteReview.notice.includes('earlier Knowledge Base') &&
      JSON.stringify(entry1.caseStudy) === beforeJson);
  }

  // 6. caseBuildBatchTargets: per-condition vs per-concept grouping, 0-fact skip, and MAX_CASE_BATCH=8 cap
  {
    const mkCond = (id, name, tier, count, extra = {}) => ({
      id,
      name,
      facts: Array.from({ length: count }, (_, i) => ({
        id: id + '-f' + (i + 1),
        tier,
        latteBucket: ['Look', 'Assess', 'Tests', 'Treatments'][i % 4],
        text: name + ' finding ' + (i + 1)
      })),
      ...extra
    });

    const perfOv = mkCond('c-perf', 'Perfusion', 1, 4, { entryRole: 'concept', concept: 'Perfusion' });
    const lhf = mkCond('c-lhf', 'Left-Sided Heart Failure', 1, 8, { entryRole: 'exemplar', concept: 'Perfusion' });
    const rhf = mkCond('c-rhf', 'Right-Sided Heart Failure', 1, 8, { entryRole: 'exemplar', concept: 'Perfusion' });
    const gasEx1 = mkCond('c-copd', 'COPD', 1, 8, { entryRole: 'exemplar', concept: 'Gas Exchange' });
    const gasEx2 = mkCond('c-asthma', 'Asthma', 1, 8, { entryRole: 'exemplar', concept: 'Gas Exchange' });
    const tier3Only = mkCond('c-stub', 'Tier3 Stub', 3, 4);
    const extras = Array.from({ length: 5 }, (_, i) => mkCond('c-ex-' + i, 'Extra Condition ' + (i + 1), 1, 8));
    const allConditions = [perfOv, lhf, rhf, gasEx1, gasEx2, tier3Only, ...extras];

    const condBatch = BUNDLE.caseBuildBatchTargets({
      conditions: allConditions,
      resolvedConditions: allConditions,
      concepts: ['Perfusion', 'Gas Exchange'],
      mixConceptExemplars: true,
      batchUnit: 'conditions',
      factOpts: { includeTier2: true, includeTier3: false, includeCalculation: false, includeEducation: true },
      stages: 4,
      questionsPerStage: 3
    });

    t('v20.1 (Batch targets — per-condition): skips 0-fact entries without wasting a batch slot and enforces MAX_CASE_BATCH=8 with overflowCount',
      condBatch.skipped.length === 1 &&
      condBatch.skipped[0].condition.id === 'c-stub' &&
      condBatch.targets.length === 8 &&
      condBatch.totalEligible === 10 &&
      condBatch.overflowCount === 2 &&
      condBatch.targets.every(x => !x.condition.isMixed && x.facts.length > 0));

    const conceptScope = { concepts: ['Perfusion', 'Gas Exchange'], conditionIds: ['c-ex-0', 'c-stub'], mixConceptExemplars: true, includeRelated: false };
    const resolvedConceptUnion = BUNDLE.kbResolveScopeGroups({ conditions: allConditions }, conceptScope);
    const conceptBatch = BUNDLE.caseBuildBatchTargets({
      conditions: allConditions,
      resolvedConditions: resolvedConceptUnion,
      concepts: ['Perfusion', 'Gas Exchange'],
      mixConceptExemplars: true,
      mixMode: 'differential',
      batchUnit: 'concepts',
      factOpts: { includeTier2: true, includeTier3: false, includeCalculation: false, includeEducation: true },
      stages: 3,
      questionsPerStage: 2
    });

    t('v20.1 (Batch targets — per-concept): builds 1 mixed case per selected Giddens Concept, preserves extra standalone checked entries, and skips 0-fact stubs',
      conceptBatch.targets.length === 3 &&
      conceptBatch.skipped.length === 1 &&
      conceptBatch.targets[0].condition.isMixed === true &&
      conceptBatch.targets[0].condition.mixMode === 'differential' &&
      conceptBatch.targets[0].condition.conditions.length === 3 &&
      conceptBatch.targets[1].condition.isMixed === true &&
      conceptBatch.targets[1].condition.conditions.length === 2 &&
      !conceptBatch.targets[2].condition.isMixed &&
      conceptBatch.targets[2].condition.id === 'c-ex-0');
  }

  // 7. caseRunBatchQueue lifecycle: full completion, mid-batch cancel, and quota-halt retention
  {
    const mkTarget = name => ({ condition: { name }, facts: [{ id: 'f1' }], sufficiency: { warnings: [] } });
    const targets = [mkTarget('Hyperkalemia'), mkTarget('SIADH'), mkTarget('DKA')];

    // 7a. Full sequential completion
    const seenStatuses = [], logsA = [];
    const resFull = await BUNDLE.caseRunBatchQueue({
      targets,
      skipped: [{ condition: { name: 'Stub' }, reason: 'no facts at selected tiers' }],
      overflowCount: 1,
      maxBatch: 8,
      log: (m, lv) => logsA.push({ m, lv }),
      onStatus: st => seenStatuses.push(st),
      runOne: async () => ({ completed: true, halted: '' })
    });
    t('v20.1 (Batch runner — complete): runs targets sequentially, emits progress updates + terminal null, and logs skipped/overflow notices',
      resFull.completedCount === 3 &&
      resFull.total === 3 &&
      resFull.halted === '' &&
      seenStatuses.length === 4 &&
      seenStatuses[0].done === 0 && seenStatuses[2].done === 2 && seenStatuses[3] === null &&
      logsA.some(l => l.m.includes('Skipped Stub')) &&
      logsA.some(l => l.m.includes('capped at 8 cases')));

    // 7b. Mid-batch user cancel after Case 2 finishes
    let cancelled = false; const calledCancel = [];
    const resCancel = await BUNDLE.caseRunBatchQueue({
      targets,
      isCancelled: () => cancelled,
      runOne: async (tgt, idx) => {
        calledCancel.push(tgt.condition.name);
        if (idx === 1) cancelled = true;
        return { completed: true, halted: '' };
      }
    });
    t('v20.1 (Batch runner — cancel): stops before subsequent queued cases and retains completed count',
      resCancel.halted === 'abort' &&
      resCancel.completedCount === 2 &&
      calledCancel.join(',') === 'Hyperkalemia,SIADH');

    // 7c. Mid-batch API quota halt during Case 2 audit (Case 2 generated, Case 3 skipped)
    const calledQuota = [], logsQ = [];
    const resQuota = await BUNDLE.caseRunBatchQueue({
      targets,
      log: m => logsQ.push(m),
      runOne: async (tgt, idx) => {
        calledQuota.push(tgt.condition.name);
        if (idx === 1) return { completed: true, halted: 'quota' };
        return { completed: true, halted: '' };
      }
    });
    t('v20.1 (Batch runner — quota stop): halts remaining queue immediately on quota exhaustion while keeping completed cases',
      resQuota.halted === 'quota' &&
      resQuota.completedCount === 2 &&
      calledQuota.join(',') === 'Hyperkalemia,SIADH' &&
      logsQ.some(m => m.includes('Batch queue stopped after case 2 of 3')));
  }

  // 8. Live CaseStudyGenerator.run handler integration with batchOverrideRef
  {
    const CASE_VAL = loadCaseModule(S);
    const start = S.indexOf('  const run=useCallback(async()=>{', S.indexOf('function CaseStudyGenerator(){'));
    const end = S.indexOf('\n\n  // v15.6: audit verdicts', start);
    const opStart = S.indexOf('function createOperationSlot(){'), opEnd = S.indexOf('function cardCurrentEntries(', opStart);
    const createOperationSlot = new Function(S.slice(opStart, opEnd) + ';return createOperationSlot;')();

    const runWithOverride = async ({ failQuota = false } = {}) => {
      const kb = {}, logs = ['prior batch header'], packetIds = [];
      let publishedCase = null;
      const ovr = {
        condition: { name: 'Override Condition' },
        facts: [{ id: 'f1' }],
        sufficiency: { warnings: [] },
        keepLogs: true,
        packetId: 'pkt-ovr-1',
        completed: false,
        halted: ''
      };
      const env = {
        ...CASE_VAL,
        caseRepairContract: CASE_VAL.repairContract,
        caseShuffleQuestion: q => CASE_VAL.shuffle(q, () => 0.5),
        caseShuffleIssues: CASE_VAL.shuffleIssues,
        useCallback: fn => fn,
        batchOverrideRef: { current: ovr },
        setActivePacketId: id => packetIds.push(id),
        cfg: { apiKey: 'synthetic', forTool: () => ({ model: 'mock', level: 'low' }) },
        K: { knowledgeBase: kb, isCurrentSource: () => true, registerArtifact: () => {} },
        generatorSlot: { current: createOperationSlot() },
        currentSourceKB: { current: kb },
        artifactSourceSnapshot: () => ({ sourceKB: kb, factIndex: caseIndex('Monitor the marker.') }),
        activeCondition: { name: 'Ignored Default' },
        selectedFacts: [],
        sufficiency: { warnings: [] },
        difficulty: 'exam',
        stages: 1,
        questionsPerStage: 1,
        types: { mcq: true },
        runAudit: false,
        caseBuildPrompt: ({ conditionName }) => 'PROMPT:' + conditionName,
        caseBuildRepairPrompt: () => '{}',
        extractJSON: JSON.parse,
        geminiHaltsBatch: e => !!(e && e.status === 429),
        isQuotaError: e => /429|quota/i.test(String(e && e.message || '')),
        uid: () => 'u12345',
        log: msg => logs.push(msg),
        setBusy: () => {},
        setLogs: v => { logs.length = 0; (Array.isArray(v) ? v : []).forEach(x => logs.push(x)); },
        setCaseStudy: cs => { if (cs) publishedCase = cs; },
        setIssues: () => {},
        setCoverage: () => {},
        setLiveKB: () => {},
        setAudit: () => {},
        setAuditPhase: () => {},
        setProvenance: () => {},
        setInvalidCaseRaw: () => {},
        setAbortCtl: () => {},
        setArtifactSource: () => {},
        setAuditState: () => {},
        callGemini: async (k, m, parts) => {
          if (failQuota) throw Object.assign(new Error('429 quota exceeded'), { status: 429 });
          const cs = caseFixture();
          cs.condition = parts[0].text.replace('PROMPT:', '');
          return JSON.stringify(cs);
        }
      };
      const fn = new Function('env', 'with(env){' + S.slice(start, end) + ';return run;}')(env);
      await fn();
      return { ovr, logs, packetIds, publishedCase };
    };

    const okRun = await runWithOverride({ failQuota: false });
    const quotaRun = await runWithOverride({ failQuota: true });
    t('v20.1 (Live run batchOverrideRef): overrides condition/facts, preserves batch logs when keepLogs=true, stamps packetId, and reports quota halts',
      okRun.ovr.completed === true &&
      okRun.ovr.halted === '' &&
      okRun.packetIds[0] === 'pkt-ovr-1' &&
      okRun.logs[0] === 'prior batch header' &&
      okRun.publishedCase.condition === 'Override Condition' &&
      quotaRun.ovr.completed === false &&
      quotaRun.ovr.halted === 'quota');
  }

  // 9. UI controls wired in CaseStudyGenerator
  t('v20.1 (Case Packet & Batch UI): CaseStudyGenerator wires Multi-entry run mode, Batch queue grouping, Select >=8 facts, RunStatus batch bar, and Case Packet booklet/paired exports',
    S.includes('aria-label="Multi-entry run mode"') &&
    S.includes('Batch Queue: separate cases') &&
    S.includes('aria-label="Batch queue grouping"') &&
    S.includes('Select ≥8 facts') &&
    S.includes('<RunStatus label="Case study batch"') &&
    S.includes('aria-label="Packet print order"') &&
    S.includes('aria-label="Session case packet"') &&
    S.includes('🖨 Packet PDF ('));
};
