'use strict';

// v21.9: Regression tests for 01 · Course Analyzer (syllabus + lecture PPTX/PDF -> conservative KB brief & 1-click sync).
function span(S, start, end) {
  const a = S.indexOf(start);
  if (a < 0) throw new Error('Course Analyzer anchor missing: ' + start);
  const b = S.indexOf(end, a + start.length);
  if (b < 0) throw new Error('Course Analyzer end anchor missing after: ' + start);
  return S.slice(a, b);
}

module.exports = async function runCourseAnalyzerTests(S, t) {
  const helperCode = span(S, '/* ── COURSE ANALYZER PURE HELPERS (v21.9) ── */', '/* ── END COURSE ANALYZER PURE HELPERS ── */');
  const pointsCode = span(S, 'function parseAndNumberPoints(', '// 2. Formatted string to inject');

  const buildHelpers = (stubs = {}) => new Function(
    'getExt', 'cardFileId', 'kbSourceUnits', 'destroyPdfDoc', 'geminiRequest', 'extractJSON', 'redactApiSecrets',
    pointsCode + '\n' + helperCode + '\n' +
    'return {COURSE_ANALYZER_PROMPT,COURSE_ANALYZER_JSON_SCHEMA,COURSE_ANALYZER_SAFETY_BULLET,COURSE_ANALYZER_RETENTION_FOOTER,COURSE_ANALYZER_FILE_ROLES,COURSE_ANALYZER_EXAM_PRESETS,' +
    'caSplitExamTargets,caHasExamPreset,caToggleExamPreset,caBuildExamTailoringHint,caInferFileRole,caDefaultCarryToKb,caNormalizeAnalysis,caMergeAnalysisParts,caFormatCoverageMarkdown,caFormatAllMarkdown,caBuildKbHandoff,caReadSourceFile,caSegmentMaterials,caRunAnalysisWithEnv,parseAndNumberPoints};'
  )(
    stubs.getExt || (n => String(n || '').split('.').pop().toLowerCase()),
    stubs.cardFileId || (f => `${f.name}|${f.size || 0}|${f.lastModified || 0}`),
    stubs.kbSourceUnits || (async () => []),
    stubs.destroyPdfDoc || (() => {}),
    stubs.geminiRequest || (async () => '{}'),
    stubs.extractJSON || (raw => JSON.parse(raw)),
    stubs.redactApiSecrets || ((msg, key) => (key ? String(msg).split(key).join('[redacted]') : String(msg)))
  );

  const H = buildHelpers();

  // 1. Navigation placement, default landing tab, profile registration, and CourseBriefCtx handoff wiring
  const toolsBlock = span(S, 'const TOOLS=[', '];');
  const profileDefaults = span(S, 'const TOOL_PROFILE_DEFAULTS={', '};');
  const profileRows = span(S, 'const PROFILE_ROWS=[', '];');
  const toolComponents = S.match(/const TOOL_COMPONENTS=\{([^}]*)\}/);
  const caIdx = toolsBlock.indexOf("id:'courseAnalyzer'");
  const kbIdx = toolsBlock.indexOf("id:'knowledge'");
  t('v21.9: Course Analyzer sits first under Source (01 -> 02 Knowledge Base), keeps Knowledge Base as default boot tab, and registers profile & CourseBriefCtx bridge',
    caIdx > -1 && kbIdx > -1 && caIdx < kbIdx &&
    toolsBlock.includes("{id:'courseAnalyzer',stage:'source',label:'Course Analyzer',step:'Analyze syllabus & slides',title:'Nursing Course Analyzer',") &&
    profileDefaults.includes("courseAnalyzer:{m:'hydrogen',lv:'medium'}") &&
    profileRows.includes("{id:'courseAnalyzer',label:'Course Analyzer'}") &&
    !!toolComponents && toolComponents[1].includes('courseAnalyzer:React.memo(CourseAnalyzer)') &&
    S.includes("const [activeTool,setActiveTool]=useState('knowledge');") &&
    S.includes('const CourseBriefCtx=createContext(null);') &&
    S.includes('<CourseBriefCtx.Provider value={kbHandoff}>') &&
    S.includes('const sendCourseBriefToKb=useCallback(brief=>{setKbHandoff({...brief,sentAt:Date.now()});selectTool(\'knowledge\');},[selectTool]);') &&
    S.includes("setKbConceptAuto(true);setKbExamTraps(true);setFocusMode('prioritize');setKbKeepSafetyT1(true);"));

  // 2. Prompt & JSON Schema contract (conservative retention, no over-pruning / drop-anatomy language)
  t('v21.9: COURSE_ANALYZER_PROMPT enforces conservative retention without DROP-anatomy directives and COURSE_ANALYZER_JSON_SCHEMA uses standard lowercase JSON Schema',
    H.COURSE_ANALYZER_PROMPT.includes('CONSERVATIVE RETENTION PRINCIPLE (ZERO OVER-PRUNING)') &&
    H.COURSE_ANALYZER_PROMPT.includes('NEVER split Points into per-disease P-LATE subheadings') &&
    H.COURSE_ANALYZER_PROMPT.includes('STRICTLY ADDITIVE'.toLowerCase()) === false &&
    H.COURSE_ANALYZER_PROMPT.includes('strictly ADDITIVE guidance bullets') &&
    H.COURSE_ANALYZER_JSON_SCHEMA.type === 'object' &&
    H.COURSE_ANALYZER_JSON_SCHEMA.required.join(',') === 'course,exam,overarchingConcepts,outcomes,pointGroups,additionalContext,coverageReport' &&
    H.COURSE_ANALYZER_JSON_SCHEMA.properties.pointGroups.items.required.join(',') === 'concept,points');

  // 3. File role inference & KB Step 01 carry-over defaults
  t('v21.9: caInferFileRole & caDefaultCarryToKb classify syllabi/blueprints vs. lecture decks and default KB carry-over ON only for lecture files',
    H.caInferFileRole('NUR221_Fall_Syllabus.pdf') === 'syllabus' &&
    H.caInferFileRole('Course_Calendar_Schedule.pdf') === 'syllabus' &&
    H.caInferFileRole('Exam2_Blueprint_StudyGuide.pdf') === 'blueprint' &&
    H.caInferFileRole('Week4_HeartFailure_Perfusion.pptx') === 'lecture' &&
    H.caInferFileRole('Electrolytes_Lecture.pdf') === 'lecture' &&
    H.caDefaultCarryToKb('lecture') === true &&
    H.caDefaultCarryToKb('syllabus') === false &&
    H.caDefaultCarryToKb('blueprint') === false);

  // 4. Normalization guarantees safety catch-all bullet, verbatim retention footer, deduplication, and clean Point-ID parsing
  const norm = H.caNormalizeAnalysis({
    course: 'NUR221',
    exam: 'Exam 2',
    overarchingConcepts: ['Perfusion', 'perfusion', 'Gas Exchange'],
    outcomes: ['1. Prioritize interventions for acute heart failure [Priority / Safety]', '2. Differentiate COPD vs. asthma'],
    pointGroups: [
      { concept: '## Perfusion:', points: ['- Left vs. right-sided heart failure cues', 'Left vs. right-sided heart failure cues', 'P1: Loop diuretic hold parameters'] },
      { concept: '**Gas Exchange**', points: ['COPD oxygen titration targets (88-92% SpO2)', H.COURSE_ANALYZER_SAFETY_BULLET] },
      { concept: 'Safety & High-Alert Catch-All', points: [H.COURSE_ANALYZER_SAFETY_BULLET] }
    ],
    additionalContext: [
      '- Contrast Left vs. Right HF and DKA vs. HHS',
      'Flag silent chest pseudo-improvement in status asthmaticus',
      H.COURSE_ANALYZER_RETENTION_FOOTER
    ],
    coverageReport: {
      materialsAnalyzed: ['Syllabus.pdf (10 pages)', 'Syllabus.pdf (10 pages)'],
      majorConceptsCovered: ['Perfusion', 'Gas Exchange'],
      missingOrUnreadable: [],
      uncertainOrDiscrepancies: ['Week 5 slide deck date overlaps Exam 2'],
      sourceVerification: ['Slide 12: explicit objective on loop diuretic K+ monitoring']
    }
  });
  const parsedPts = H.parseAndNumberPoints(norm.points);
  t('v21.9: caNormalizeAnalysis deduplicates concepts/points, guarantees single safety catch-all bullet and retention footer, and parses cleanly in parseAndNumberPoints',
    norm.concepts === 'Perfusion, Gas Exchange' &&
    norm.outcomes === '1. Prioritize interventions for acute heart failure [Priority / Safety]\n2. Differentiate COPD vs. asthma' &&
    norm.points.includes('## Perfusion\n- Left vs. right-sided heart failure cues\n- Loop diuretic hold parameters') &&
    norm.points.split(H.COURSE_ANALYZER_SAFETY_BULLET).length === 2 &&
    norm.additionalContext.split(H.COURSE_ANALYZER_RETENTION_FOOTER).length === 2 &&
    parsedPts.length === 4 &&
    parsedPts[3].text === H.COURSE_ANALYZER_SAFETY_BULLET &&
    norm.coverageReport.materialsAnalyzed.length === 1);

  // 5. Segmented multi-deck splitting preserves syllabus anchor on every segment and caMergeAnalysisParts merges without dropping points
  const longSlideA = 'A'.repeat(40000);
  const longSlideB = 'B'.repeat(40000);
  const segs = H.caSegmentMaterials([
    { name: 'Syllabus.pdf', role: 'syllabus', unitLabel: 'pages', unitCount: 4, text: 'Exam 2 covers Perfusion and Gas Exchange.' },
    {
      name: 'HeartFailure.pptx', role: 'lecture', unitLabel: 'slides', unitCount: 4,
      units: [
        { kind: 'slide', n: 1, text: '[Slide 1]\n' + longSlideA },
        { kind: 'slide', n: 2, text: '[Slide 2]\n' + longSlideA },
        { kind: 'slide', n: 3, text: '[Slide 3]\n' + longSlideB },
        { kind: 'slide', n: 4, text: '[Slide 4]\n' + longSlideB }
      ],
      text: longSlideA + longSlideA + longSlideB + longSlideB
    }
  ], 100000);
  const merged = H.caMergeAnalysisParts([
    { course: 'NUR221', exam: 'Exam 2', overarchingConcepts: ['Perfusion'], outcomes: ['Manage HF'], pointGroups: [{ concept: 'Perfusion', points: ['ADHF cues'] }], additionalContext: ['Contrast L vs R HF'], coverageReport: { materialsAnalyzed: ['HeartFailure.pptx (slides 1-2)'], majorConceptsCovered: ['Perfusion'], missingOrUnreadable: [], uncertainOrDiscrepancies: [], sourceVerification: ['Slide 1'] } },
    { course: 'NUR221', exam: 'Exam 2', overarchingConcepts: ['Perfusion', 'Gas Exchange'], outcomes: ['Manage HF', 'Titrate O2 in COPD'], pointGroups: [{ concept: 'Perfusion', points: ['Loop diuretic holds'] }, { concept: 'Gas Exchange', points: ['COPD 88-92% SpO2'] }], additionalContext: ['Flag silent chest'], coverageReport: { materialsAnalyzed: ['HeartFailure.pptx (slides 3-4)'], majorConceptsCovered: ['Gas Exchange'], missingOrUnreadable: [], uncertainOrDiscrepancies: [], sourceVerification: ['Slide 4'] } }
  ], 'NUR221', 'Exam 2');
  t('v21.9: caSegmentMaterials splits oversized lecture decks on slide boundaries with syllabus anchored in every segment and caMergeAnalysisParts merges losslessly',
    segs.length >= 2 &&
    segs.every(s => s.text.includes('SYLLABUS FILE: Syllabus.pdf') && s.text.includes('Exam 2 covers Perfusion')) &&
    merged.concepts === 'Perfusion, Gas Exchange' &&
    merged.outcomes.includes('1. Manage HF\n2. Titrate O2 in COPD') &&
    merged.points.includes('ADHF cues') &&
    merged.points.includes('Loop diuretic holds') &&
    merged.points.includes('COPD 88-92% SpO2') &&
    merged.coverageReport.sourceVerification.length === 2);

  // 6. Markdown export & KB handoff payload builder
  const md = H.caFormatAllMarkdown(norm);
  const handoff = H.caBuildKbHandoff(norm, [{ name: 'HeartFailure.pptx', size: 1200 }]);
  t('v21.9: caFormatAllMarkdown includes Suite Settings Reminder and Source Coverage Report, and caBuildKbHandoff carries all 4 blocks, point count, and selected files',
    md.includes('# NUR221 — Exam 2') &&
    md.includes('Focus Mode: Prioritize (NOT Scope)') &&
    md.includes('## OVERARCHING CONCEPTS') &&
    md.includes('## Source Coverage Report') &&
    handoff.course === 'NUR221' &&
    handoff.exam === 'Exam 2' &&
    handoff.concepts === 'Perfusion, Gas Exchange' &&
    handoff.pointCount === 4 &&
    handoff.files.length === 1 &&
    handoff.files[0].name === 'HeartFailure.pptx');

  // 7. End-to-end caRunAnalysisWithEnv: PDF/PPTX/txt ingestion, systemInstruction + responseJsonSchema + stream:true, and destroyPdfDoc cleanup
  const destroyed = [];
  const reqs = [];
  const R = buildHelpers({
    kbSourceUnits: async f => f.name.endsWith('.pdf')
      ? [{ kind: 'page', n: 1, text: 'NUR221 Exam 2 covers Perfusion and Gas Exchange.' }]
      : [{ kind: 'slide', n: 1, text: '[Slide 1] Heart failure: crackles, S3 gallop, furosemide K+ hold.' }],
    destroyPdfDoc: f => destroyed.push(f.name),
    geminiRequest: async (apiKey, model, body, opts) => {
      reqs.push({ apiKey, model, body, opts });
      return JSON.stringify({
        course: 'NUR221',
        exam: 'Exam 2',
        overarchingConcepts: ['Perfusion'],
        outcomes: ['Manage acute heart failure'],
        pointGroups: [{ concept: 'Perfusion', points: ['Heart failure crackles and S3 gallop', 'Furosemide potassium hold parameters'] }],
        additionalContext: ['Contrast left vs. right heart failure cues'],
        coverageReport: { materialsAnalyzed: ['Syllabus.pdf'], majorConceptsCovered: ['Perfusion'], missingOrUnreadable: [], uncertainOrDiscrepancies: [], sourceVerification: ['Slide 1: HF cues'] }
      });
    }
  });
  let outRes = null, outConcepts = '', outOutcomes = '', outPoints = '', outExtra = '', outErr = '', outBusy = true, outProg = 0;
  const runLogs = [];
  const abortRef = { current: null };
  await R.caRunAnalysisWithEnv({
    cfg: { apiKey: 'AIzaSyntheticKeyForTesting9999', autoProfile: true, forTool: () => ({ model: 'gemini-4-hydrogen', level: 'medium' }) },
    course: 'NUR221',
    exam: 'Exam 2',
    notes: 'Professor emphasized loop diuretic K+ monitoring',
    files: [
      { name: 'NUR221_Syllabus.pdf', size: 500, lastModified: 1, type: 'application/pdf' },
      { name: 'HeartFailure.pptx', size: 900, lastModified: 2, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
    ],
    fileRoles: {},
    abortRef,
    setBusy: v => { outBusy = v; },
    setError: v => { outErr = v; },
    setProg: v => { outProg = v; },
    setLogs: () => {},
    pushLog: entry => runLogs.push(entry),
    setResult: v => { outRes = v; },
    setEditConcepts: v => { outConcepts = v; },
    setEditOutcomes: v => { outOutcomes = v; },
    setEditPoints: v => { outPoints = v; },
    setEditExtra: v => { outExtra = v; }
  });
  t('v21.9: caRunAnalysisWithEnv reads PDF/PPTX, sends systemInstruction + responseJsonSchema + stream:true, cleans up PDF.js docs, and populates all 4 editable blocks',
    outBusy === false && outErr === '' && outProg === 100 && abortRef.current === null &&
    reqs.length === 1 &&
    reqs[0].opts.stream === true &&
    reqs[0].body.systemInstruction.parts[0].text === R.COURSE_ANALYZER_PROMPT &&
    reqs[0].body.generationConfig.responseJsonSchema === R.COURSE_ANALYZER_JSON_SCHEMA &&
    destroyed.join(',') === 'NUR221_Syllabus.pdf' &&
    outRes !== null &&
    outConcepts === 'Perfusion' &&
    outOutcomes === '1. Manage acute heart failure' &&
    outPoints.includes(R.COURSE_ANALYZER_SAFETY_BULLET) &&
    outExtra.includes(R.COURSE_ANALYZER_RETENTION_FOOTER));

  // 8. Secret redaction on error path
  let redErr = '';
  const E = buildHelpers({
    kbSourceUnits: async () => [{ kind: 'slide', n: 1, text: '[Slide 1] Content' }],
    geminiRequest: async () => { throw new Error('HTTP 403 for key AIzaSecretLeak123456'); }
  });
  await E.caRunAnalysisWithEnv({
    cfg: { apiKey: 'AIzaSecretLeak123456', autoProfile: true, forTool: () => ({ model: 'gemini-4-hydrogen', level: 'medium' }) },
    course: 'NUR221', exam: 'Exam 2', notes: '',
    files: [{ name: 'Slides.pptx', size: 100, lastModified: 1 }],
    fileRoles: {}, abortRef: { current: null },
    setBusy: () => {}, setError: v => { redErr = v; }, setProg: () => {}, setLogs: () => {}, pushLog: () => {},
    setResult: () => {}, setEditConcepts: () => {}, setEditOutcomes: () => {}, setEditPoints: () => {}, setEditExtra: () => {}
  });
  t('v21.9: caRunAnalysisWithEnv redacts API key secrets from surfaced error messages',
    redErr.includes('[redacted]') && !redErr.includes('AIzaSecretLeak123456'));

  // 9. v21.10: Quick-select exam presets (single, multi-toggle combine, toggle-off) & automatic unit/comprehensive tailoring lens
  const toggled1 = H.caToggleExamPreset('', 'Exam 2');
  const toggled2 = H.caToggleExamPreset(toggled1, 'HESI Comprehensive');
  const toggled3 = H.caToggleExamPreset(toggled2, 'Exam 2');
  t('v21.10: COURSE_ANALYZER_EXAM_PRESETS, caSplitExamTargets, caHasExamPreset, and caToggleExamPreset support single, combined, and toggle-off targets synced with #ca-exam',
    H.COURSE_ANALYZER_EXAM_PRESETS.includes('Exam 1') &&
    H.COURSE_ANALYZER_EXAM_PRESETS.includes('Exam 4') &&
    H.COURSE_ANALYZER_EXAM_PRESETS.includes('HESI Comprehensive') &&
    H.COURSE_ANALYZER_EXAM_PRESETS.includes('ATI / NCLEX Review') &&
    toggled1 === 'Exam 2' &&
    toggled2 === 'Exam 2 + HESI Comprehensive' &&
    H.caHasExamPreset('exam 2, HESI Comprehensive', 'Exam 2') === true &&
    H.caHasExamPreset('exam 2, HESI Comprehensive', 'HESI Comprehensive') === true &&
    H.caHasExamPreset('exam 2, HESI Comprehensive', 'Exam 3') === false &&
    toggled3 === 'HESI Comprehensive' &&
    S.includes('aria-label="Quick-select exam targets"') &&
    S.includes('caToggleExamPreset(v,p)'));

  const unitLens = H.caBuildExamTailoringHint('Exam 2');
  const compLens = H.caBuildExamTailoringHint('HESI Comprehensive');
  const comboLens = H.caBuildExamTailoringHint('Exam 2 + HESI Comprehensive');
  const neutralLens = H.caBuildExamTailoringHint('Cardiovascular Lab Checkoff');
  const compReqs = [];
  const C = buildHelpers({
    kbSourceUnits: async () => [{ kind: 'slide', n: 1, text: '[Slide 1] Perfusion cues.' }],
    geminiRequest: async (_key, _model, body) => {
      compReqs.push(body);
      return JSON.stringify({
        course: 'NUR221', exam: 'Exam 2 + HESI Comprehensive',
        overarchingConcepts: ['Perfusion'], outcomes: ['Prioritize safety'],
        pointGroups: [{ concept: 'Perfusion', points: ['HF cues'] }],
        additionalContext: ['Cross-concept HESI traps'],
        coverageReport: { materialsAnalyzed: ['Slides.pptx'], majorConceptsCovered: ['Perfusion'], missingOrUnreadable: [], uncertainOrDiscrepancies: [], sourceVerification: ['Slide 1'] }
      });
    }
  });
  await C.caRunAnalysisWithEnv({
    cfg: { apiKey: 'AIzaSyntheticKeyForTesting9999', autoProfile: true, forTool: () => ({ model: 'gemini-4-hydrogen', level: 'medium' }) },
    course: 'NUR221', exam: 'Exam 2 + HESI Comprehensive', notes: '',
    files: [{ name: 'Slides.pptx', size: 100, lastModified: 1 }],
    fileRoles: {}, abortRef: { current: null },
    setBusy: () => {}, setError: () => {}, setProg: () => {}, setLogs: () => {}, pushLog: () => {},
    setResult: () => {}, setEditConcepts: () => {}, setEditOutcomes: () => {}, setEditPoints: () => {}, setEditExtra: () => {}
  });
  const sentComboPrompt = compReqs[0]?.contents?.[0]?.parts?.[0]?.text || '';
  t('v21.10: caBuildExamTailoringHint selects unit, comprehensive, combined, or empty lens and caRunAnalysisWithEnv injects it into the request prompt',
    unitLens.includes('EXAM TAILORING LENS (UNIT EXAM)') &&
    compLens.includes('EXAM TAILORING LENS (COMPREHENSIVE / STANDARDIZED EXAM)') &&
    comboLens.includes('EXAM TAILORING LENS (COMBINED UNIT + STANDARDIZED/COMPREHENSIVE)') &&
    neutralLens === '' &&
    sentComboPrompt.includes('EXAM TAILORING LENS (COMBINED UNIT + STANDARDIZED/COMPREHENSIVE)') &&
    reqs[0].body.contents[0].parts[0].text.includes('EXAM TAILORING LENS (UNIT EXAM)'));
};
