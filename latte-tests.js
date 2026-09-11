#!/usr/bin/env node
/*
 * LATTE Study Suite — deterministic regression test harness
 * Usage:  node latte-tests.js [path/to/LATTE-Study-Suite-*.html or Nursing-Study-Suite-*.html]
 * With no argument it requires exactly one suite HTML in the current folder. Ambiguity and
 * Proton Drive Name clash copies fail loudly rather than selecting a file lexically.
 *
 * The harness extracts the REAL functions from the shipped HTML (no copies to drift) and
 * exercises the deterministic logic that must never regress silently. It depends on these
 * anchors surviving future versions: CASE_CLINICAL_TOKEN_RE, validateStageTiming,
 * nclexChunkText, nclexDedup, the kbSourceUnits PPTX split, the caseStudies registry
 * builder ("const entries=[];let qi=0;"), and the KB critical-fact regex line
 * (contains "contraindicat|"). If an anchor moves, the harness fails loudly at extraction
 * — that is itself a useful signal.
 */
'use strict';
const fs = require('fs');
const { NAME_CLASH_RE, resolveSuiteFile } = require('./tools/repo-checks');
const EXPECTED_ASSERTIONS = 904;

let file;
try {
  file = resolveSuiteFile({ rootDir: process.cwd(), explicit: process.argv[2] || '' });
} catch (error) {
  console.error(error.message); process.exit(2);
}
const S = fs.readFileSync(file, 'utf8');
console.log('LATTE regression harness — testing: ' + file + ' (' + S.length.toLocaleString() + ' chars)\n');

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name); } };
const section = s => console.log('\n── ' + s + ' ──');

function spanFrom(startAnchor, endAnchor, fromAnchor) {
  let base = 0;
  if (fromAnchor) { base = S.indexOf(fromAnchor); if (base < 0) throw new Error('from-anchor missing: ' + fromAnchor); }
  const a = S.indexOf(startAnchor, base); if (a < 0) throw new Error('start anchor missing: ' + startAnchor);
  const b = S.indexOf(endAnchor, a + startAnchor.length); if (b < 0) throw new Error('end anchor missing after: ' + startAnchor);
  return S.slice(a, b + endAnchor.length);
}

/* ── extraction ── */
const clusterA = spanFrom('const CASE_CLINICAL_TOKEN_RE', 'function validateStageTiming');
const clusterB = spanFrom('function validateStageTiming', '\n  return issues;\n}');
const CASE = new Function(
  clusterA.slice(0, clusterA.lastIndexOf('function validateStageTiming')) + clusterB +
  ';return {CASE_CLINICAL_TOKEN_RE,CASE_CLINICAL_TERM_RE,scanUncitedProse,caseNormalizeClinical,caseAuditTextValues,caseAuditDatumValues,validateCaseStudy,validateStageTiming,NEIA_TERMINOLOGY_RULES,neiaTerminologyScan,CASE_SUPPORT_TYPES,caseParseThreshold,caseSplitValue,caseUnitsCompatible,caseThresholdSatisfied,itemHeuristics,caseContentWords,caseDifficultySignals};'
)();
const nclexChunkText = new Function(spanFrom('function nclexChunkText', '\n  return chunks;\n}') + ';return nclexChunkText;')();
// v15.14: the span starts at nclexKey now. nclexDedup delegates to it, and the incremental
// accumulator that shares it has to be tested against the SAME key function — two
// normalizations would be free to drift, which is the whole reason it was lifted out.
const NX = new Function(
  spanFrom('function nclexKey', 'return allQ;\n}') +
  ';return {nclexKey,nclexDedup,nclexAccumulate};')();
const nclexDedup = NX.nclexDedup;
// v15.15: the choice-aware question splitter, the stem/choice parser and the split-mode
// repair all come out as ONE span — they share NCLEX_OPTION_RUN_MIN, and extracting them
// separately would let the shared constant drift out from under the tests. The span ends on
// nclexRepairOptions, which is what the repair assertions below exercise: a short end anchor
// here would truncate the span and let every repair assertion pass vacuously.
const NXO = new Function(spanFrom('const NCLEX_OPTION_GAP', 'options_repaired:true};\n}') +
  ';return {nclexDropOptionRuns,nclexSliceByQNum,nclexSplitByQNum,nclexSplitStemOptions,nclexRepairOptions};')();
// The two exports are closures over component state, so they are extracted with `filtered`
// and their helpers injected as parameters. exportTxt ends inside downloadBlob, so the
// capture stub firing is itself proof the span reached its tail.
const nclexToMd = new Function('filtered', 'nclexSplitStemOptions',
  spanFrom('const nclexToMd=()=>{', '    return out;\n  };') + ';return nclexToMd();');
const nclexToTxt = new Function('filtered', 'nclexSplitStemOptions',
  'let CAP=null;const Blob=function(p){this.p=p;};const downloadBlob=(b)=>{CAP=b.p[0];};' +
  spanFrom('const nclexQText=q=>', "'nclex_questions.txt');\n  };") + ';exportTxt();return CAP;');

const kbLine = (() => { const i = S.indexOf('contraindicat|'); return S.slice(S.lastIndexOf('\n', i) + 1, S.indexOf('\n', i)); })();
const KB_RE = new RegExp(kbLine.slice(kbLine.indexOf('||/') + 3, kbLine.indexOf('/i.test')), 'i');
const pptxSplit = new Function('text', spanFrom("const parts=String(text||'').split(/(?=--- SLIDE", 'text:t};});'));
const provSpan = spanFrom('const entries=[];let qi=0;const claimed=new Set();', 'if(residual.length)', "const caseId='case-'")
  .replace(/if\(residual\.length\)$/, '') +
  "if(residual.length)entries.push({id:caseId+':case',caseId,factIds:residual,label:title+' — case context / debrief'});return entries;";
const buildProv = new Function('parsed', 'cited', 'caseId', 'title', provSpan);

// v15.6 item 4: the audit cluster sits after caseToMarkdown and depends on it, so it is
// extracted as its own span rather than folded into clusterA.
const AUDIT = new Function('CASE_QUESTION_RULES', 'caseRenderFactPacket',
  spanFrom('function caseToMarkdown(', '\n  return L.join(\'\\n\');\n}') +
  spanFrom('function caseIsGateEligible(', 'function CaseStudyGenerator()')
    .replace(/function CaseStudyGenerator\(\)$/, '') +
  ';return {caseToMarkdown,caseIsGateEligible,caseAuditPayload,itemBuildAuditPrompt,' +
  'itemParseAuditVerdict,itemAuditIsAnswerAccuracy,itemRunPool,caseGateItems,itemAuditSummary,' +
  'caseBuildRepairPrompt,ITEM_AUDIT_STATUS};'
)('«SHARED-QUESTION-RULES»', () => '«FACT-PACKET»');

// v15.7 B1c: the worksheet validator depends on the ng* parsers, neiaTerminologyScan, and
// itemHeuristics. Those live in different regions of the file, so they are stitched here —
// still extracted, never copied.
const WS = new Function(
  spanFrom('function ngSplitParts(', 'function ngRenumber(').replace(/function ngRenumber\($/, '') +
  spanFrom('const NEIA_TERMINOLOGY_RULES=', '\n}', 'const NEIA_TERMINOLOGY_RULES=') +
  spanFrom('const CASE_LEN_RATIO_HI=', '\n}\n// Enums exactly as caseBuildPrompt defines them') +
  // Leading newline is load-bearing: the preceding span ends in a line comment, which would
  // otherwise swallow this return and make the whole extraction silently undefined.
  '\n;return {validateNCLEXWorksheet,ngParseItem,ngParseKeyItem,ngParseDistribution,ngSplitParts,ngSpliceBlock,ngSpliceSection,ngRenderQuestionBlock,ngRenderKeyBlock,nclexGateItems,ngBuildRepairPrompt};'
)();

const hit = (re, x) => { re.lastIndex = 0; return re.test(x); };
const has = (issues, frag, sev) => issues.some(i => i.msg.includes(frag) && (!sev || i.sev === sev));

/* ── 1. clinical value regex (error tier) ── */
section('CASE_CLINICAL_TOKEN_RE');
t('"SpO2 88%" matches', hit(CASE.CASE_CLINICAL_TOKEN_RE, 'SpO2 88%'));
t('"lost 7% body weight" matches', hit(CASE.CASE_CLINICAL_TOKEN_RE, 'lost 7% body weight'));
t('"RR 28/min" matches', hit(CASE.CASE_CLINICAL_TOKEN_RE, 'RR 28/min'));
t('"furosemide 80 mg" matches', hit(CASE.CASE_CLINICAL_TOKEN_RE, 'furosemide 80 mg'));
t('"BP 82/50" matches', hit(CASE.CASE_CLINICAL_TOKEN_RE, 'BP 82/50'));
t('"Room 302 at 0800" clean', !hit(CASE.CASE_CLINICAL_TOKEN_RE, 'moved to Room 302 at 0800'));

/* ── 2. qualitative term regex (warn tier) ── */
section('CASE_CLINICAL_TERM_RE');
t('"becomes hypotensive" matches', hit(CASE.CASE_CLINICAL_TERM_RE, 'The patient becomes hypotensive.'));
t('"appears anxious" matches', hit(CASE.CASE_CLINICAL_TERM_RE, 'The patient appears anxious.'));
t('"pulmonary edema" matches', hit(CASE.CASE_CLINICAL_TERM_RE, 'develops pulmonary edema'));
t('"painting the fence" clean', !hit(CASE.CASE_CLINICAL_TERM_RE, 'spent the morning painting the fence'));
t('"call light within reach" clean', !hit(CASE.CASE_CLINICAL_TERM_RE, 'The call light is within reach.'));

/* ── 3. scanUncitedProse tiering ── */
section('scanUncitedProse');
{ const i = []; CASE.scanUncitedProse('BP is 82/50 this morning.', 'narrative', i);
  t('numeric value → error', has(i, 'uncited clinical value', 'error')); }
{ const i = []; CASE.scanUncitedProse('The patient appears anxious.', 'narrative', i);
  t('qualitative term → warn (not error)', has(i, 'possible uncited clinical finding', 'warn') && !i.some(x => x.sev === 'error')); }

/* ── 4. KB critical-fact heuristic ── */
section('KB critical-fact regex');
t('"contraindicated in renal impairment" matches', KB_RE.test('contraindicated in renal impairment'));
t('"7% weight loss" matches', KB_RE.test('7% weight loss'));
t('"daily weights" clean', !KB_RE.test('perform daily weights'));

/* ── 5. NCLEX chunker clamps ── */
section('nclexChunkText');
{ const c = nclexChunkText('x'.repeat(50000), 0, 800);
  t('size 0 terminates, chunks bounded', c.length > 0 && c.length < 1000 && c.every(x => x.length > 0 && x.length <= 500)); }
t('normal params produce chunks', nclexChunkText('y'.repeat(50000), 3000, 800).length > 10);
t('overlap ≥ size still terminates', nclexChunkText('z'.repeat(20000), 1000, 5000).length > 0);

/* ── 6. dedup ── */
section('nclexDedup');
{ const a = { question: 'A client with heart failure ' + 'x'.repeat(150) + ' VARIANT ONE?' };
  const b = { question: 'A client with heart failure ' + 'x'.repeat(150) + ' VARIANT TWO?' };
  t('distinct long stems both kept', nclexDedup([a, b]).length === 2);
  t('true duplicate collapses', nclexDedup([a, { question: a.question }]).length === 1); }

/* ── 6b. v15.15: answer choices are not question numbers ── */
section('nclexSplitByQNum — choice runs');
{
  // Davis shape: the stem is "1.", and so is its first choice. Before v15.15 the slice for
  // question 1 ended at its own first choice, so item 1 was the stem alone, items 2-4 were
  // single choice lines, and questions 2 and 3 vanished — their numbers had been claimed.
  const davis = [
    '1. The nurse is caring for a client with heart failure. Which finding requires immediate action?',
    '1. Weight gain of 1 kg in 24 hours', '2. Crackles auscultated bilaterally',
    '3. Serum potassium of 3.9 mEq/L', '4. Blood pressure 128/78 mm Hg', '',
    '2. A client receives furosemide. Which lab does the nurse monitor?',
    '1. Sodium', '2. Potassium', '3. Calcium', '4. Magnesium', '',
    '3. Which client does the nurse assess first?',
    '1. A client with a temperature of 100.2 F', '2. A client reporting 6/10 incisional pain',
    '3. A client with new-onset confusion', '4. A client awaiting discharge teaching'
  ].join('\n');
  const d = NXO.nclexSplitByQNum(davis);
  t('three questions, not four choice fragments', Object.keys(d).length === 3);
  t('question 1 keeps its choices instead of stopping at the stem', /Blood pressure 128\/78/.test(d['1']));
  t('question 2 survives its predecessor\u2019s choice numbering', /furosemide/.test(d['2']));
  t('question 3 survives too', /assess first/.test(d['3']));
  t('every question carries a full four-choice list',
    [1, 2, 3].every(k => NXO.nclexSplitStemOptions(d[String(k)]).options.length === 4));

  // The guards. A genuine question list must never be mistaken for a choice run.
  const spaced = [1, 2, 3, 4].map(n => n + '. Question ' + n + ' ' + 'x'.repeat(600)).join('\n');
  t('a real question list numbered from 1 is left alone', Object.keys(NXO.nclexSplitByQNum(spaced)).length === 4);
  const many = [];
  for (let n = 1; n <= 20; n++) many.push({ num: n, index: 50 + n * 120 });
  t('a 20-entry ascending run is a question list, not a choice list',
    NXO.nclexDropOptionRuns([{ num: 9, index: 0 }].concat(many)).length === 21);
  t('a run with nothing before it is never dropped',
    NXO.nclexDropOptionRuns([{num:1,index:0},{num:2,index:50},{num:3,index:100},{num:4,index:150}]).length === 4);

  // Select-all-that-apply: five choices, still choices.
  const sata = [{num:1,index:0},{num:1,index:120},{num:2,index:160},{num:3,index:200},{num:4,index:240},
                {num:5,index:280},{num:2,index:400},{num:1,index:500},{num:2,index:540},{num:3,index:580},
                {num:4,index:620},{num:5,index:660}];
  t('a five-choice select-all run is dropped, leaving two questions',
    NXO.nclexDropOptionRuns(sata).map(p => p.num).join(',') === '1,2');
}

/* ── 6c. v15.15: stem / choice parsing ── */
section('nclexSplitStemOptions');
{
  const P = NXO.nclexSplitStemOptions;
  t('choices on their own lines', P('Which action?\n1. Alpha\n2. Beta\n3. Gamma\n4. Delta').options.length === 4);
  t('choices run inline in one paragraph', P('Which lab? 1. Sodium 2. Potassium 3. Calcium 4. Magnesium').options.length === 4);
  {
    const r = P('Who is seen first?\nA. Febrile\nB. Confused\nC. Ambulatory\nD. Discharged');
    t('lettered choices parse', r.options.length === 4);
    t('lettered labels are preserved as written', r.options.map(o => o.label).join('') === 'ABCD');
  }
  t('parenthesised choices parse', P('Priority:\n(1) Airway\n(2) Breathing\n(3) Circulation\n(4) Disability').options.length === 4);
  {
    const r = P('Which finding requires immediate action?');
    t('a stem with no choices reports none', r.options.length === 0);
    t('and keeps the whole text as the stem', r.stem === 'Which finding requires immediate action?');
  }
  {
    // A numbered list INSIDE the stem must not be taken for the choice list: the real
    // choices further down form the longer run, and the longest run wins.
    const r = P('Vitals: 1. HR 110 2. BP 88/50\nWhich action is first?\n1. Notify\n2. Raise legs\n3. Fluids\n4. Recheck');
    t('a numbered list inside the stem does not win over the real choices', r.options.length === 4);
    t('and that list stays in the stem where it belongs', /HR 110/.test(r.stem));
    t('the first real choice is the one after the question', r.options[0].text === 'Notify');
  }
  t('empty input does not throw', P('').options.length === 0);
  t('null input does not throw', P(null).options.length === 0);
}

/* ── 6d. v15.15: split-mode choice repair ── */
section('nclexRepairOptions');
{
  const src = '4. Which lab is monitored?\n1. Sodium\n2. Potassium\n3. Calcium\n4. Magnesium';
  const bare = { question_number: 4, question: 'Which lab is monitored?' };
  const fixed = NXO.nclexRepairOptions(bare, src);
  t('a bare stem gets its choices back from the page', NXO.nclexSplitStemOptions(fixed.question).options.length === 4);
  t('the restored text is the source\u2019s own bytes', /Magnesium/.test(fixed.question));
  t('the repair is flagged so the UI can say so', fixed.options_repaired === true);
  t('the original object is not mutated', bare.question === 'Which lab is monitored?');
  const whole = { question: 'Pick one?\n1. A\n2. B\n3. C' };
  t('an item that already has choices is returned untouched', NXO.nclexRepairOptions(whole, src) === whole);
  t('no choices in the source leaves the item alone',
    NXO.nclexRepairOptions(bare, 'just prose, no numbered list here') === bare);
}

/* ── 6e. v15.15: answers are grouped at the end of every export ── */
section('NCLEX extractor export grouping');
{
  const fx = [
    { question: 'Which finding requires immediate action?\n1. Weight gain\n2. Crackles\n3. K 3.9\n4. BP 128/78',
      correct_answer: '2. Crackles \u2014 the earliest sign of decompensation', rationale: 'Crackles indicate fluid overload.',
      test_taking_strategy: 'Prioritise airway', diseases_conditions: ['Heart failure'] },
    { question: 'Which lab is monitored with furosemide?\n1. Sodium\n2. Potassium\n3. Calcium\n4. Magnesium',
      correct_answer: '2. Potassium \u2014 monitor before each dose', rationale: 'Loop diuretics waste potassium.',
      priority_nursing_tip: 'Watch for hypokalaemia', diseases_conditions: [] }
  ];
  const md = nclexToMd(fx, NXO.nclexSplitStemOptions);
  const cut = md.indexOf("## Answer Key");
  t('markdown has a Questions section before the Answer Key', md.indexOf('## Questions') > -1 && md.indexOf('## Questions') < cut);
  t('the answer key starts on its own printed page', md.indexOf('<div class="pagebreak"></div>') < cut && cut > -1);
  t('both stems sit in the questions section', md.indexOf('Which lab is monitored') < cut);
  // The regression this release exists to fix: no rationale, tip or answer may appear
  // alongside a question. Everything before the Answer Key heading must be answer-free.
  t('no rationale leaks into the questions section', md.slice(0, cut).indexOf('Loop diuretics') === -1);
  t('no answer text leaks into the questions section',
    md.slice(0, cut).indexOf('earliest sign of decompensation') === -1 && md.slice(0, cut).indexOf('monitor before each dose') === -1);
  t('no nursing tip leaks into the questions section', md.slice(0, cut).indexOf('Watch for hypokalaemia') === -1);
  t('the answers themselves land in the answer key',
    md.indexOf('earliest sign of decompensation') > cut && md.indexOf('monitor before each dose') > cut);
  t('both rationales land in the answer key', md.indexOf('Crackles indicate fluid overload.') > cut && md.indexOf('Loop diuretics waste potassium.') > cut);
  t('choices are rendered as a list under the stem', /\n1\. Weight gain\n2\. Crackles\n3\. K 3\.9\n4\. BP 128\/78/.test(md.slice(0, cut)));

  const txt = nclexToTxt(fx, NXO.nclexSplitStemOptions);
  t('exportTxt reached downloadBlob', typeof txt === 'string' && txt.length > 0);
  const tcut = txt.indexOf("ANSWER KEY");
  t('plaintext groups its answers at the end too', tcut > txt.indexOf('Which lab is monitored'));
  t('plaintext rationales are all past the answer key', txt.indexOf('Loop diuretics waste potassium.') > tcut);
  t('plaintext keeps no answer beside a question',
    txt.slice(0, tcut).indexOf('Crackles indicate fluid overload.') === -1 && txt.slice(0, tcut).indexOf('earliest sign of decompensation') === -1);
  t('plaintext indents the choice list', /\n   1\. Weight gain/.test(txt.slice(0, tcut)));
}

/* ── 7. PPTX slide splitting ── */
section('kbSourceUnits PPTX split');
{ const u = pptxSplit('\n--- SLIDE 1 ---\nAlpha\n\n--- SLIDE 2 ---\nBeta has literal fact-3 inside\n\n--- SLIDE 3 ---\nGamma\n');
  t('three slides → three units', u.length === 3);
  t('slide numbers parsed 1,2,3', u.map(x => x.n).join(',') === '1,2,3');
  t('literal fact-N does not shatter a slide', u[1].text.includes('fact-3')); }

/* ── 8. registry provenance builder ── */
section('caseStudies registry builder');
{ const parsed = { stages: [
    { stageNumber: 1, data: [{ factIds: ['FACT-1', 'fact-2'] }], questions: [
      { id: 'q1', rationales: [{ factIds: ['fact-2'] }] },
      { id: 'q2', rationales: [{ factIds: ['fact-3'] }] }] },
    { stageNumber: 2, data: [{ factIds: ['fact-9'] }], questions: [] }] };
  const entries = buildProv(parsed, new Set(['fact-1', 'fact-2', 'fact-3', 'fact-9', 'fact-7']), 'case-test', 'T');
  const byId = Object.fromEntries(entries.map(e => [e.id, e.factIds.slice().sort().join(',')]));
  t('stage entry carries stage data', byId['case-test:1:data'] === 'fact-1,fact-2');
  t('question entry carries ONLY its rationale facts', byId['case-test:1:q1'] === 'fact-2');
  t('question-less stage still gets a data entry', byId['case-test:2:data'] === 'fact-9');
  t('residual = narrative/debrief-only facts', byId['case-test:case'] === 'fact-7'); }

/* ── 9. numeric value-entailment audit (warn tier) ── */
section('caseAuditDatumValues');
const IDX = new Map([
  ['fact-a', { condition: {}, fact: { text: 'Monitor potassium during loop diuretic therapy.', sourceQuote: 'Monitor serum potassium.' } }],
  ['fact-b', { condition: {}, fact: { text: 'A heart rate of 120 beats per minute suggests decompensation.', sourceQuote: '' } }],
  ['fact-c', { condition: {}, fact: { text: 'Report urine output below 30 mL/hr.', sourceQuote: '' } }]]);
// v15.6 item 2: escalated warn → error. The legitimate reason a value could be absent from
// its cited facts (threshold instantiation) now has its own declared support type, so an
// unexplained absence is no longer ambiguous.
{ const i = []; CASE.caseAuditDatumValues({ label: 'Potassium', value: '2.4 mEq/L', supportType: 'direct', factIds: ['fact-a'] }, IDX, 'Stage 1', i);
  t('fabricated 2.4 mEq/L on a monitor-only fact → error (was warn pre-v15.6)', has(i, 'does not appear', 'error')); }
{ const i = []; CASE.caseAuditDatumValues({ label: 'Heart rate', value: '120 bpm', factIds: ['fact-b'] }, IDX, 'Stage 1', i);
  t('"120 bpm" matches "120 beats per minute" via unit normalization', i.length === 0); }
{ const i = []; CASE.caseAuditDatumValues({ label: 'Urine output', value: '22 mL/hr', supportType: 'instantiated', factIds: ['fact-c'] }, IDX, 'Stage 1', i);
  t('declared instantiation (22 vs "below 30") → clean', i.length === 0); }
{ const i = []; CASE.caseAuditDatumValues({ label: 'Urine output', value: '22 mL/hr', supportType: 'direct', factIds: ['fact-c'] }, IDX, 'Stage 1', i);
  t('the same value undeclared → error naming the instantiated escape hatch', has(i, 'declare supportType "instantiated"', 'error')); }
{ const i = []; CASE.caseAuditDatumValues({ label: 'Position', value: 'High Fowler', factIds: ['fact-a'] }, IDX, 'Stage 1', i);
  t('datum without unit-bearing values → silent', i.length === 0); }
{ const i = []; CASE.caseAuditDatumValues({ label: 'K+', value: '2.4 mEq/L', factIds: [] }, IDX, 'Stage 1', i);
  t('no cited IDs → audit defers to the missing-ID warn', i.length === 0); }

/* ── 10. validator: v15.2 structural contracts ── */
section('validateCaseStudy — new checks');
const V = (cs, expected) => CASE.validateCaseStudy(cs, IDX, new Set(['fact-a', 'fact-b', 'fact-c']), expected);
const q = o => Object.assign({ id: 'q' + Math.random().toString(36).slice(2, 6), stem: '', options: [], correctAnswers: [], rationales: [] }, o);
const stage = (n, qs, data) => ({ stageNumber: n, narrative: '', data: data || [], questions: qs || [] });
t('MCQ with 2 correct answers → error',
  has(V({ stages: [stage(1, [q({ type: 'MCQ', options: [{ label: 'A' }, { label: 'B' }], correctAnswers: ['A', 'B'] })])] }, 'HF'), 'exactly one correct', 'error'));
t('MCQ with 1 correct answer → clean of that error',
  !has(V({ stages: [stage(1, [q({ type: 'MCQ', options: [{ label: 'A' }, { label: 'B' }], correctAnswers: ['A'] })])] }, 'HF'), 'exactly one correct'));
t('SATA with 1 correct → error',
  has(V({ stages: [stage(1, [q({ type: 'SATA', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], correctAnswers: ['A'] })])] }, 'HF'), 'at least 2 correct', 'error'));
t('SATA marking every option correct → error',
  has(V({ stages: [stage(1, [q({ type: 'SATA', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], correctAnswers: ['A', 'B', 'C'] })])] }, 'HF'), 'every option correct', 'error'));
t('SATA with 5 of 6 correct → error (explicit 2–4 prompt contract)',
  has(V({ stages: [stage(1, [q({ type: 'SATA', options: 'ABCDEF'.split('').map(l => ({ label: l })), correctAnswers: ['A', 'B', 'C', 'D', 'E'] })])] }, 'HF'), "breaks the prompt's 2–4 contract", 'error'));
t('Ordering missing a label → error',
  has(V({ stages: [stage(1, [q({ type: 'Ordering', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], correctAnswers: ['B', 'A'] })])] }, 'HF'), 'every option label exactly once', 'error'));
t('Ordering full permutation → clean of that error',
  !has(V({ stages: [stage(1, [q({ type: 'Ordering', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], correctAnswers: ['B', 'A', 'C'] })])] }, 'HF'), 'every option label exactly once'));
t('stages numbered 1,3 → sequence error',
  has(V({ stages: [stage(1), stage(3)] }, 'HF'), 'expected stage 2', 'error'));
t('condition mismatch → error',
  has(V({ condition: 'Diabetes Mellitus', stages: [] }, 'Heart Failure'), 'does not match the selected condition', 'error'));
t('condition "Heart failure (HF)" vs "heart failure" → clean (contains)',
  !has(V({ condition: 'Heart failure (HF)', stages: [] }, 'heart failure'), 'does not match'));
t('invalid supportType "Direct" (case drift) → error',
  has(V({ stages: [stage(1, [], [{ label: 'K+', value: '', supportType: 'Direct', factIds: ['fact-a'] }])] }, 'HF'), 'invalid supportType', 'error'));
t('invalid availability "shown" → error',
  has(V({ stages: [stage(1, [], [{ label: 'K+', value: '', supportType: 'direct', availability: 'shown', factIds: ['fact-a'] }])] }, 'HF'), 'invalid availability', 'error'));
t('out-of-packet fact still rejected (pre-existing check intact)',
  has(CASE.validateCaseStudy({ stages: [stage(1, [], [{ label: 'X', value: '', supportType: 'direct', factIds: ['fact-a'] }])] }, IDX, new Set(['fact-b']), 'HF'), 'not supplied', 'error'));

/* ── 10b. v15.3 additions: rationale enum + entailment, missing fields ── */
section('v15.3 — rationale + missing-field checks');
t('rationale supportType "Neutral-framing" (case drift) → invalid-enum error',
  has(V({ stages: [stage(1, [q({ type: 'MCQ', options: [{ label: 'A' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: '', supportType: 'Neutral-framing', factIds: [] }] })])] }, 'HF'), 'invalid supportType', 'error'));
t('rationale "neutral-framing" with no factIds → still allowed (no lacks-IDs error)',
  !has(V({ stages: [stage(1, [q({ type: 'MCQ', options: [{ label: 'A' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'setting the scene', supportType: 'neutral-framing', factIds: [] }] })])] }, 'HF'), 'lacks fact IDs'));
t('rationale fabricating "2.4 mEq/L" against a monitor-only fact → entailment error',
  has(V({ stages: [stage(1, [q({ type: 'MCQ', options: [{ label: 'A' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Incorrect because potassium is 2.4 mEq/L.', supportType: 'direct', factIds: ['fact-a'] }] })])] }, 'HF'), 'does not appear', 'error'));
t('rationale value supported by its cited fact → no entailment warn',
  !has(V({ stages: [stage(1, [q({ type: 'MCQ', options: [{ label: 'A' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Correct because the rate is 120 bpm.', supportType: 'direct', factIds: ['fact-b'] }] })])] }, 'HF'), 'does not appear'));
t('caseAuditTextValues with no factIds → silent',
  (() => { const i = []; CASE.caseAuditTextValues('K is 2.4 mEq/L', [], IDX, 'X', i); return i.length === 0; })());
t('datum missing supportType → warn',
  has(V({ stages: [stage(1, [], [{ label: 'K+', value: '', availability: 'revealed', factIds: ['fact-a'] }])] }, 'HF'), 'missing supportType', 'warn'));
t('datum missing availability → warn',
  has(V({ stages: [stage(1, [], [{ label: 'K+', value: '', supportType: 'direct', factIds: ['fact-a'] }])] }, 'HF'), 'missing availability', 'warn'));
t('response omitting the condition field → warn',
  has(V({ stages: [] }, 'Heart Failure'), 'missing the "condition" field', 'warn'));

/* ── 10c. v15.4: PDF layout extraction + text-layer probe ── */
section('v15.4 — pdfLayoutText + kbTextQuality');
const pdfLayoutText = new Function(spanFrom('function pdfLayoutText', '\n  return result;\n}') + ';return pdfLayoutText;')();
const kbTextQuality = new Function(spanFrom('function kbTextQuality', '\n}') + ';return kbTextQuality;')();
// Two table rows: pdf.js hands them over as positioned runs, not lines.
const cell = (str, x, y, w) => ({ str, width: w, transform: [12, 0, 0, 12, x, y] });
const tableTC = { items: [
  cell('Drug', 50, 700, 30), cell('Dose', 150, 700, 30), cell('Hold if', 250, 700, 40),
  cell('Digoxin', 50, 680, 45), cell('0.125 mg', 150, 680, 50), cell('apical HR < 60', 250, 680, 70)] };
{
  const laid = pdfLayoutText(tableTC);
  const naive = tableTC.items.map(x => x.str).join(' ');
  t('layout pass preserves the row break', laid.includes('\n'));
  t('naive join loses it (the bug being fixed)', !naive.includes('\n'));
  t('row 1 stays intact', laid.split('\n')[0].trim() === 'Drug Dose Hold if');
  t('row 2 stays intact', laid.split('\n')[1].trim() === 'Digoxin 0.125 mg apical HR < 60');
}
t('empty items are skipped', pdfLayoutText({ items: [cell('', 0, 0, 0), cell('A', 50, 700, 10)] }).trim() === 'A');
t('undefined textContent is survivable', pdfLayoutText(undefined) === '');
{
  const scanned = [1, 2, 3].map(n => ({ kind: 'page', n, text: '\n--- PAGE ' + n + ' ---\n' }));
  const q = kbTextQuality(scanned);
  t('scanned PDF: avg ~0 chars/page', q.avg < 100);
  t('scanned PDF: all pages flagged empty', q.empty === 3 && q.pages === 3);
  const good = [1, 2].map(n => ({ kind: 'page', n, text: '\n--- PAGE ' + n + ' ---\n' + 'x'.repeat(2000) }));
  const g = kbTextQuality(good);
  t('text PDF: not flagged', g.avg >= 100 && g.empty === 0);
  t('page marker excluded from the char count', g.avg === 2000);
  t('no pages → null (no false warning)', kbTextQuality([]) === null);
  // v15.10: perPage is additive — the four aggregates above are still asserted verbatim.
  t('perPage names every page', g.perPage.length === 2 && g.perPage[0].n === 1 && g.perPage[1].n === 2);
  t('perPage carries the same char count the aggregate used', g.perPage.every(p => p.chars === 2000));
  t('perPage says WHICH pages are empty, not just how many',
    q.perPage.filter(p => p.chars < 50).map(p => p.n).join(',') === '1,2,3');
}
// v15.14: the layout-aware extractor moved INTO pdfWalkPages, so the KB branch now receives
// already-laid-out text. Same property, one level up: the naive join must stay gone, and the
// one place that produces page text must be the shared helper.
t('KB path uses pdfLayoutText, not the naive join',
  S.includes("'\\n--- PAGE '+i+' ---\\n'+text") && !S.includes("+tc.items.map(x=>x.str).join(' ')") &&
  S.includes('const text=pdfLayoutText(await pg.getTextContent());'));
t('there is exactly ONE page walk, and it is cancellable',
  S.split('async function pdfWalkPages').length - 1 === 1 &&
  !S.includes('for(let i=1;i<=pdf.numPages;i++)') &&
  S.includes("if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');"));
t('all three former walkers go through it',
  S.includes('await pdfWalkPages(file,{signal,onPage:t=>{out.push(t);}});') &&
  S.includes('await pdfWalkPages(file,{signal,from:startPage,to:endPage,onPage:t=>{out.push(t);}});') &&
  S.includes('await pdfWalkPages(file,{signal,onPage:async(text,i,pg,total)=>{'));
t('the inline NCLEX read is cancellable, not just the chunk loop',
  S.includes('await extractPdfTextSpaced(file,signal)'));
t('default Flash model is gemini-3.8-flash', /useState\('gemini-3\.8-flash'\)/.test(S));

/* ── 10d. v15.10: quote-miss classification + benchmark instrumentation ── */
section('v15.10 — quote-miss classification');
// One span covers kbNormForMatch through kbClassifyQuoteMiss. The end anchor is the
// classifier's LAST statement, so a span that truncated early would fail extraction
// rather than silently pass every assertion below it.
// caseContentWords is injected rather than re-extracted: the classifier genuinely depends
// on the NCLEX heuristics' stopword list, and threading it through says so out loud.
const QM = new Function('caseContentWords',
  spanFrom('function kbNormForMatch', "\n  return 'absent';\n}") +
  ';return {kbNormForMatch,kbQuoteInSource,kbDehyphNormForMatch,kbClassifyQuoteMiss,KB_QUOTE_MISS_REASONS,KB_QUOTE_MISS_LABEL,kbCanonOperators,kbQuoteOperatorsAgree,KB_OPERATOR_RE};'
)(CASE.caseContentWords);
const classify = (quote, source) => QM.kbClassifyQuoteMiss(quote, QM.kbNormForMatch(source), QM.kbDehyphNormForMatch(source));

// v15.11 promotes de-hyphenation into the matcher. The property that has to hold is no
// longer "unchanged" but "strictly additive": the fallback may only turn a FAIL into a
// PASS, never the reverse. Everything downstream — including pass 2, where a failed match
// discards the fact — rests on that.
{
  const src = 'The patient developed hypo-\nkalemia after aggressive diuresis and required replacement.';
  const n = QM.kbNormForMatch(src), d = QM.kbDehyphNormForMatch(src);
  t('the plain match still works exactly as before',
    QM.kbQuoteInSource('developed hypokalemia', n) === false &&
    QM.kbQuoteInSource('after aggressive diuresis', n) === true);
  t('the fallback rescues the hyphenated quote',
    QM.kbQuoteInSource('developed hypokalemia after aggressive diuresis', n, d) === true);
  t('the fallback never turns a passing quote into a failing one',
    QM.kbQuoteInSource('after aggressive diuresis', n, d) === true);
  t('the fallback cannot rescue a quote that is genuinely absent',
    QM.kbQuoteInSource('administer warfarin and check the INR weekly', n, d) === false);
  t('the sub-10-char floor still short-circuits before any fallback work',
    QM.kbQuoteInSource('K+ low', n, d) === false);
  // De-hyphenation rejoins tokens; it must never bridge two rows of a table into one match.
  const table = 'Digoxin 0.125 mg hold if HR below 60\nFurosemide 20 mg hold if SBP below 90';
  const tn = QM.kbNormForMatch(table), td = QM.kbDehyphNormForMatch(table);
  t('the fallback does not splice across a row boundary',
    QM.kbQuoteInSource('digoxin 0.125 mg furosemide 20 mg', tn, td) === false);
}
t('pass 1 checks with the fallback, then re-tests the plain matcher to count rescues',
  S.includes('if(!kbQuoteInSource(f.sourceQuote,srcNorm,srcDehyph)){quoteMiss++;noteMiss(1,f);continue;}') &&
  S.includes('if(!kbQuoteInSource(f.sourceQuote,srcNorm))dehyphSaved++;'));
t('pass 2 still discards on a failed match, now including the fallback',
  S.includes('if(!kbQuoteInSource(f.sourceQuote,srcNorm,srcDehyph)){discarded++;noteMiss(2,f);continue;}'));
// v15.10 merged pass-1 misses and pass-2 discards into one rollup printed under a sentence
// about the first-pass count. A real build read "182 first-pass" then a breakdown summing
// to 190 — the extra 8 were that run's audit discards.
t('pass-1 misses and pass-2 discards roll up separately',
  S.includes('const bucket=pass===1?missByReason:discardByReason;') &&
  S.includes('const byReason={},discardByReason={};'));
t('each breakdown is labelled with the number it reconciles against',
  S.includes('Those {diag.quoteMiss} by reason:') && S.includes('The {diag.discarded} audit discard(s) by reason:'));
t('a clean run says so instead of rendering nothing',
  S.includes('Every first-pass quote was located verbatim in the source.'));

t('a quote that IS present returns null, never a reason code',
  classify('developed hypokalemia after diuresis', 'The patient developed hypokalemia after diuresis.') === null);
t('a sub-10-char quote is bucketed, not dropped — the rollup has to reconcile with quoteMiss',
  classify('K+ low', 'The patient developed hypokalemia.') === 'tooShort');
t('line-break hyphenation is recognised as normalization-fixable',
  classify('developed hypokalemia after diuresis', 'The patient developed hypo-\nkalemia after diuresis.') === 'hyphenation');
t('an em-dash line break counts too', classify('preoperative teaching reduces anxiety', 'Careful preoperative teaching reduces anxiety.'.replace('preoperative', 'preop—\nerative')) === 'hyphenation');
t('a ligature glyph is recognised as normalization-fixable',
  classify('inflammation of the pleura', 'Chronic inﬂammation of the pleura is common.') === 'hyphenation');
t('a soft hyphen mid-token is normalization-fixable',
  classify('bradycardia requires holding the dose', 'Documented brady­cardia requires holding the dose today.') === 'hyphenation');
t('scattered-but-present tokens read as reading order — the column-major case v16 exists for',
  classify('apical pulse less than sixty hold digoxin', 'digoxin metoprolol hold hold apical pulse rate less than sixty beats') === 'reordered');
t('about half the tokens present reads as partial',
  classify('apical pulse less than sixty hold digoxin', 'apical pulse rate documented and the dose held when the patient is less alert than usual') === 'partial');
t('almost nothing present reads as absent',
  classify('apical pulse less than sixty hold digoxin', 'The wound bed was pink with moderate serosanguineous drainage.') === 'absent');
// Substring containment would score this 4/4 and call it 'reordered'; word membership
// scores it 0/4. "ate" lives inside "moderate" and would inflate every classification.
t('token matching respects word boundaries, not substrings',
  classify('ate lant sive tens', 'moderate anticoagulant hypertensive extension') === 'absent');
// Found by running the classifier against real drug text: scoring function words rated a
// wholly fabricated warfarin quote 'partial' against a digoxin paragraph, on "and"/"the".
t('function words do not prop up a fabricated quote',
  classify('administer warfarin 5 mg PO daily and check the INR weekly',
    'Administer digoxin 0.125 mg PO daily and assess the apical pulse for one full minute.') === 'absent');
t('clinical terms are still scored — the stopword list must not swallow them',
  CASE.caseContentWords('administer warfarin daily and check the INR').join(' ') === 'administer warfarin daily check inr');
t('every reason the classifier can emit has a display label',
  QM.KB_QUOTE_MISS_REASONS.every(r => typeof QM.KB_QUOTE_MISS_LABEL[r] === 'string' && QM.KB_QUOTE_MISS_LABEL[r].length));
{
  const emitted = ['tooShort', 'hyphenation', 'reordered', 'partial', 'absent'];
  t('the reason list matches what the classifier actually returns',
    emitted.every(r => QM.KB_QUOTE_MISS_REASONS.includes(r)) && QM.KB_QUOTE_MISS_REASONS.length === emitted.length);
}
// v15.11: the classifier deliberately keeps diagnosing the PLAIN match. Because the caller
// now only reaches it for quotes that failed plain AND de-hyphenated, 'hyphenation' can no
// longer fire in the app — which makes a non-zero count there a regression signal.
t('the classifier still diagnoses the plain match, not the promoted matcher',
  classify('developed hypokalemia after diuresis', 'The patient developed hypo-\nkalemia after diuresis.') === 'hyphenation');
t('a quote the promoted matcher accepts is never sent to the classifier as a miss', (() => {
  const src = 'The patient developed hypo-\nkalemia after diuresis.';
  const n = QM.kbNormForMatch(src), d = QM.kbDehyphNormForMatch(src);
  const q = 'developed hypokalemia after diuresis';
  return QM.kbQuoteInSource(q, n, d) === true;
})());

section('v15.10 — page composition probe');
const kbCompositionSummary = new Function(
  spanFrom('function kbCompositionSummary', 'excessRaster:u.composition.raster-medianRaster}))};\n}') +
  ';return kbCompositionSummary;')();
{
  const u = (n, raster, path, text) => ({ n, composition: { raster, path, paint: 4, text } });
  const sum = kbCompositionSummary([u(1, 0, 10, 900), u(2, 0, 12, 880), u(3, 4, 180, 40)]);
  t('median path count is the document baseline', sum.medianPath === 12);
  t('page furniture cancels itself out', sum.pages[0].excessPath <= 0);
  t('a diagram page stands out against that baseline', sum.pages[2].excessPath > 100);
  t('raster excess is tracked separately from vector', sum.pages[2].excessRaster === 4);
  t('a text-rich page carrying a figure is still visible — the router blind spot in §7',
    kbCompositionSummary([u(1, 0, 8, 900), u(2, 0, 9, 950), u(3, 6, 9, 900)]).pages[2].excessRaster > 0);
}
t('no probe data → null, never an empty summary', kbCompositionSummary([{ n: 1, kind: 'page' }]) === null);
// The v16 spec §7 lists paintJpegXObject as verified-present in pdf.js 3.11.174. It is
// not in the OPS table; JPEGs arrive as paintImageXObject. Naming it in the source would
// be a silent no-op, so the probe must not depend on it.
t('the probe does not depend on the non-existent paintJpegXObject', !S.includes('OPS.paintJpegXObject'));
t('tiled and grouped raster variants are counted — a scanned page paints via those',
  S.includes('OPS.paintImageXObjectRepeat') && S.includes('OPS.paintImageMaskXObjectGroup'));
t('the probe is opt-in', S.includes('const [probeComposition,setProbeComposition]=useState(false);'));
// v15.14: cleanup moved into pdfWalkPages, so a textual index comparison no longer says
// anything (the helper is defined earlier in the file than its caller). The invariant is
// now structural and stronger: cleanup runs in a finally AFTER onPage is awaited, so any
// probe inside onPage still sees the operator list that cleanup() is about to release.
t('the probe runs before cleanup() releases the operator list',
  /if\(onPage\)await onPage\([^)]*\);\s*\}finally\{\s*try\{pg\.cleanup\(\);\}catch\(e\)\{\}/.test(S) &&
  S.includes('if(composition){try{units[units.length-1].composition=await kbPageComposition(pg);}catch(e){}}'));
t('diagnostics export exists and is not a Knowledge Base', S.includes("kind:'latte-extraction-diagnostics'"));
t('the panel no longer claims diagnostics never reach any export',
  !S.includes('never written into the Knowledge Base or any export.'));

/* ── 10d-bis. v15.14: clinical operators survive the fact-merge key ── */
section('v15.14 — fact key preserves clinical operators');
// One line, so the span cannot truncate early — evaluating the function IS the end-anchor check.
const FK = new Function(spanFrom('function kbFactKey', "].join('|');}") + ';return {kbFactKey};')();
{
  const key = text => FK.kbFactKey({ latteBucket: 'Tests', subtype: null, text });
  // The defect: [^a-z0-9.%/<>-] kept ASCII < and > but DELETED ≤ ≥ ↑ ↓ +, so two opposite
  // facts produced one key, mergeLatteParts kept only the first, and unioned the OTHER
  // chunk's source pointer onto it — a fact citing the page that said the reverse.
  t('an up arrow and a down arrow do not share a key',
    key('↑ BUN and creatinine') !== key('↓ BUN and creatinine'));
  t('≤ and ≥ do not share a key', key('SpO2 ≤ 90%') !== key('SpO2 ≥ 90%'));
  t('a trailing + is not erased', key('K+ 6.6 mEq/L') !== key('K 6.6 mEq/L'));
  t('ASCII < and > still key apart (regression)', key('Hold if HR < 60') !== key('Hold if HR > 60'));
  t('whitespace runs still collapse, so identical text keys identically',
    key('Monitor daily weights') === key('Monitor  daily   weights'));
  t('bucket and subtype still lead the key',
    FK.kbFactKey({ latteBucket: 'Look', subtype: 'early', text: 'x y z' }).startsWith('Look|early|'));
  // A '-' anywhere but last in a character class silently becomes a range.
  t("the '-' stays last in the class, so it is a literal and not a range",
    S.includes("replace(/[^a-z0-9.%/<>≤≥↑↓+-]+/g,' ')"));
}

/* ── 10d-ter. v15.14: operator agreement on already-verified quotes ── */
section('v15.14 — operator agreement');
{
  const src = 'Hold digoxin if the apical heart rate is < 60 beats per minute and notify the provider.';
  const n = QM.kbNormForMatch(src), d = QM.kbDehyphNormForMatch(src);
  const on = QM.kbNormForMatch(QM.kbCanonOperators(src)), od = QM.kbDehyphNormForMatch(QM.kbCanonOperators(src));
  const faithful = 'Hold digoxin if the apical heart rate is < 60 beats per minute';
  const inverted = 'Hold digoxin if the apical heart rate is > 60 beats per minute';
  // THE PREMISE. If this ever starts failing, kbNormForMatch has changed and the whole
  // additive argument for this check has to be re-derived rather than assumed.
  t('the verbatim matcher genuinely cannot tell < from > (the reason this check exists)',
    QM.kbQuoteInSource(faithful, n, d) === true && QM.kbQuoteInSource(inverted, n, d) === true);
  t('operator agreement accepts the faithful quote', QM.kbQuoteOperatorsAgree(faithful, on, od) === true);
  t('operator agreement rejects the inverted quote', QM.kbQuoteOperatorsAgree(inverted, on, od) === false);
  t('a quote carrying no operator is never flagged',
    QM.kbQuoteOperatorsAgree('notify the provider', on, od) === true);

  const arrowSrc = 'Expect ↑ BUN and ↑ creatinine in prerenal azotemia with worsening oliguria.';
  const an = QM.kbNormForMatch(QM.kbCanonOperators(arrowSrc));
  const ad = QM.kbDehyphNormForMatch(QM.kbCanonOperators(arrowSrc));
  t('the same arrows pass', QM.kbQuoteOperatorsAgree('Expect ↑ BUN and ↑ creatinine', an, ad) === true);
  t('a reversed arrow is caught', QM.kbQuoteOperatorsAgree('Expect ↓ BUN and ↓ creatinine', an, ad) === false);
  t('≤ against a ≥ source is caught',
    QM.kbQuoteOperatorsAgree('maintain SpO2 ≥ 92 percent on room air',
      QM.kbNormForMatch(QM.kbCanonOperators('maintain SpO2 ≤ 92 percent on room air at all times')), '') === false);

  // The safety property: this can only ever ADD a finding beside a quote that already passed.
  t('pass 1 reaches the operator check only after kbQuoteInSource has accepted the quote',
    S.includes("if(!kbQuoteInSource(f.sourceQuote,srcNorm))dehyphSaved++;\n          if(!kbQuoteOperatorsAgree(f.sourceQuote,srcOpNorm,srcOpDehyph))noteOp(1,f);"));
  t('pass 2 records an operator mismatch but does NOT discard on it (warn tier, measure first)',
    S.includes('if(!kbQuoteOperatorsAgree(f.sourceQuote,srcOpNorm,srcOpDehyph))noteOp(2,f);') &&
    !S.includes('noteOp(2,f);continue;'));
  t('operator mismatches roll up separately from quote misses and from discards',
    S.includes('opMismatch:stats.reduce((n,s)=>n+(s.opMismatch||0),0),') &&
    S.includes('const opDetail=[];let opMismatch=0;'));
  t('a non-zero count is surfaced without opening the Details pane',
    S.includes('{diag.opMismatch>0&&<span'));
  t('kbNormForMatch itself is untouched, so no existing quote changes verdict',
    S.includes(String.raw`function kbNormForMatch(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}`));
}

/* ── 10e. v15.12: flashcard transcription (pass 1) ── */
section('v15.12 — flashcard transcription');
// Span runs from the image regex through the end of cardCompareRuns. The end anchor is
// that function's last statement, so a truncated span fails extraction rather than
// silently passing every assertion below.
// cardFilePayload reads the extension through the shared getExt, so it is extracted live
// and injected rather than re-implemented here — a local copy would be free to drift.
const getExtLive = new Function(spanFrom('function getExt', "toLowerCase();}") + ';return getExt;')();
const CARD = new Function('getExt',
  spanFrom('const CARD_IMAGE_RE', 'idsDisagree:new Set(runs.map(cardKey)).size>1};\n}') +
  ';return {cardIsImage,cardFileId,cardFilePayload,cardKey,cardTranscriptToText,cardMergeFaces,cardChunkBlockers,cardChunkWarnings,cardCompareRuns,CARD_TRANSCRIBE_PROMPT};'
)(getExtLive);

t('image types are recognised, documents are not',
  CARD.cardIsImage({ name: 'card.JPG' }) && CARD.cardIsImage({ name: 'a.heic' }) &&
  !CARD.cardIsImage({ name: 'chapter.pdf' }) && !CARD.cardIsImage({ name: 'deck.pptx' }));

// Real card shapes: the FRONT carries the condition name, the BACK carries only the
// running header and number. Pairing is not cosmetic — a back extracted alone produces
// facts with no condition to attach to.
const cFront = { face: 'front', category: 'Gastrointestinal System Disorders', cardNumber: '1',
  title: 'Bowel Obstruction', pronunciation: 'bow-el ob-struk-shun',
  sections: [{ key: 'clue', heading: 'Common Cues and Findings', bullets: [
    'U/S, CT, MRI shows dilated small bowel >3 cm, large bowel >12 cm, cecum >15 cm.'], legibility: 'clean' }],
  numerics: [{ value: '>3 cm', context: 'small bowel dilated', legibility: 'clean' }],
  symbols: [], overallLegibility: 'clean' };
const cBack = { face: 'back', category: 'Gastrointestinal System Disorders', cardNumber: '1',
  title: null, pronunciation: null,
  sections: [{ key: 'assessmentAndDiagnosticFindings', heading: 'Assessment and Diagnostic Findings',
    bullets: ['↑WBC and H&H.'], legibility: 'clean' }],
  numerics: [], symbols: ['↑'], overallLegibility: 'clean' };

t('front and back share a join key', CARD.cardKey(cFront) === CARD.cardKey(cBack));
{
  const merged = CARD.cardMergeFaces([cBack, cFront]); // deliberately out of order
  t('both faces merge into one source chunk', merged.length === 1 && merged[0].faces.length === 2);
  t('the title comes from the front, which is the only face that has one', merged[0].title === 'Bowel Obstruction');
  t('the front is placed first so the condition name leads',
    merged[0].text.indexOf('Bowel Obstruction') < merged[0].text.indexOf('Assessment and Diagnostic Findings'));
  t('numerics from every face are carried onto the merged card', merged[0].numerics.length === 1);
  // An up arrow before a lab IS the fact. Losing it silently reverses the meaning.
  t('arrow glyphs survive rendering to text', merged[0].text.includes('↑WBC'));
  t('an unpaired back face is still surfaced rather than dropped',
    CARD.cardMergeFaces([cBack])[0].faces.length === 1);
  t('legibility rolls up pessimistically across faces',
    CARD.cardMergeFaces([cFront, { ...cBack, overallLegibility: 'uncertain' }])[0].legibility === 'uncertain');
}

// The load-bearing claim of the whole two-pass design: because pass 2 reads text, the
// EXISTING matcher verifies its quotes with no new evidence model.
{
  const text = CARD.cardMergeFaces([cFront])[0].text;
  const n = QM.kbNormForMatch(text), d = QM.kbDehyphNormForMatch(text);
  t('a quote taken from the transcript verifies with the existing matcher',
    QM.kbQuoteInSource('dilated small bowel >3 cm, large bowel >12 cm', n, d) === true);
  t('a fabricated quote still fails against the transcript',
    QM.kbQuoteInSource('dilated small bowel greater than eight centimeters', n, d) === false);
}

{
  const stable = CARD.cardCompareRuns([cFront, cFront]);
  t('identical runs report no drift', stable.numericsUnstable.length === 0 && stable.bulletsUnstable.length === 0);
  const drifted = CARD.cardCompareRuns([cFront,
    { ...cFront, numerics: [{ value: '>8 cm', context: 'small bowel dilated', legibility: 'clean' }] }]);
  t('a number that changes between identical runs is caught', drifted.numericsUnstable.length > 0);
  t('a card identity that changes between runs is caught',
    CARD.cardCompareRuns([cFront, { ...cFront, cardNumber: '2' }]).idsDisagree === true);
}

// Not one of the 11 frozen constants, but these rules are why the transcript can be
// trusted as the source of truth. Losing one is a silent correctness regression.
t('the transcription prompt forbids guessing numbers', /NEVER GUESS A NUMBER/.test(CARD.CARD_TRANSCRIBE_PROMPT));
t('the transcription prompt forbids expanding abbreviations', /DO NOT EXPAND ABBREVIATIONS/.test(CARD.CARD_TRANSCRIBE_PROMPT));
t('the transcription prompt requires symbols be preserved', /PRESERVE SYMBOLS EXACTLY/.test(CARD.CARD_TRANSCRIBE_PROMPT));
t('the transcription prompt keeps an open enum for unknown headings', /"other"/.test(CARD.CARD_TRANSCRIBE_PROMPT));
t('the transcription prompt demands a separate numerics list', /"numerics" must list EVERY number/.test(CARD.CARD_TRANSCRIBE_PROMPT));
t('pass 2 never receives the image — cards enter the queue as text only',
  S.includes("queue.push({file:{name:'flashcards · '+c.key},chunk:{text:c.text,") &&
  !/queue\.push\(\{file:\{name:'flashcards[^\n]*inlineData/.test(S));

/* ── v15.14: flashcard identity, provenance, and the build gate ── */
section('v15.14 — flashcard trust boundary');
// Transcripts were keyed on the basename while addFiles dedupes on name+size+lastModified,
// so two photos sharing a basename both entered the file list and the second silently
// overwrote the first's transcript.
t('same-basename photos get distinct source identities',
  CARD.cardFileId({ name: 'IMG_0001.jpg', size: 100, lastModified: 1 }) !==
  CARD.cardFileId({ name: 'IMG_0001.jpg', size: 200, lastModified: 2 }));
t('the same file always yields the same identity',
  CARD.cardFileId({ name: 'a.jpg', size: 1, lastModified: 2 }) ===
  CARD.cardFileId({ name: 'a.jpg', size: 1, lastModified: 2 }));
t('transcripts are keyed on that identity, not on the basename',
  S.includes('out[cardFileId(f)]={file:f.name,transcript:runs[0]') &&
  S.includes('out[cardFileId(f)]={file:f.name,error:'));
t('removing a source deletes its transcript and clears the review',
  S.includes('setTranscripts(p=>{const n={...p};delete n[cardFileId(f)];return n;});setTxReviewed(false);'));
t('the file-chip key matches the transcript key, so neither can collide alone',
  S.includes('className="file-chip" key={cardFileId(f)}'));

// faces.length was the only composition signal, so front+front cleared the "only one face"
// warning — two DIFFERENT cards merged into one corrupt chunk.
{
  const pair = CARD.cardMergeFaces([cBack, cFront])[0];
  t('a merged card reports its faces by kind, not just by count',
    pair.fronts === 1 && pair.backs === 1);
  t('a clean front+back pair has no blockers',
    CARD.cardChunkBlockers(pair, 0).length === 0);
  t('a back-only card is blocked — its facts would have no condition to attach to',
    CARD.cardChunkBlockers(CARD.cardMergeFaces([cBack])[0], 0).length === 1);
  const twoFronts = CARD.cardMergeFaces([cFront, { ...cFront, title: 'Something Else' }])[0];
  t('front+front is blocked rather than silently merged',
    twoFronts.fronts === 2 && CARD.cardChunkBlockers(twoFronts, 0).some(b => /two different cards/.test(b)));
  t('an unreadable face is blocked',
    CARD.cardChunkBlockers(CARD.cardMergeFaces([cFront, { ...cBack, overallLegibility: 'unreadable' }])[0], 0).length === 1);
  t('numbers that changed between identical runs are blocked',
    CARD.cardChunkBlockers(pair, 3).some(b => /changed between identical/.test(b)));
  // Sound but incomplete: a front-only card still carries its condition name.
  t('a front-only card warns but is NOT blocked',
    CARD.cardChunkBlockers(CARD.cardMergeFaces([cFront])[0], 0).length === 0 &&
    CARD.cardChunkWarnings(CARD.cardMergeFaces([cFront])[0]).length === 1);
  t('an uncertain face warns but is not blocked',
    CARD.cardChunkBlockers(CARD.cardMergeFaces([cFront, { ...cBack, overallLegibility: 'uncertain' }])[0], 0).length === 0);
}

// Provenance: a misread number has to be walkable back to the photo it came from.
{
  const withSrc = CARD.cardMergeFaces([
    { ...cFront, _srcFile: 'IMG_0001.jpg' }, { ...cBack, _srcFile: 'IMG_0002.jpg' }])[0];
  t('a merged card names every photo it came from',
    withSrc.sources.length === 2 && withSrc.sources.includes('IMG_0001.jpg'));
  t('sources de-duplicate when both faces came from one photo',
    CARD.cardMergeFaces([{ ...cFront, _srcFile: 'a.jpg' }, { ...cBack, _srcFile: 'a.jpg' }])[0].sources.length === 1);
  t('an untagged transcript yields no sources rather than undefined',
    Array.isArray(CARD.cardMergeFaces([cFront])[0].sources));
}
t('a queued card carries its card number and its source photo(s) into the pointer',
  S.includes("'flashcards · '+c.key") &&
  S.includes("c.sources.length?' ['+c.sources.join(', ')+']':''"));
t('only cards that clear the gate are queued',
  S.includes('for(const c of cardGate.buildable){'));
t('blocked cards are reported rather than dropped in silence',
  S.includes("was NOT built: '+r.blockers.join('; ')") && S.includes('problems.push(msg)'));

// The gate itself. Build was clickable mid-transcription and on unreviewed cards.
t('Build is gated on transcription finishing and on an explicit review',
  S.includes('const buildBlocked=busy||txBusy||!cfg.apiKey||!files.length||cardsNeedReview||nothingToBuild;') &&
  S.includes('const cardsNeedReview=cardChunks.length>0&&!txReviewed;'));
t('the disabled button says which condition is stopping it',
  S.includes("cardsNeedReview?'Confirm the card numbers first'") &&
  S.includes("cardChunks.length?'No card clears the gate':'Transcribe the cards first'"));
t('a new transcription run clears a previous review',
  S.includes("setTxBusy(true);setTxErr('');setTxReviewed(false);"));
t('the review acknowledgement is recorded in the exported transcript',
  S.includes('reviewed:txReviewed'));
t('the panel and the queue read one partition, so they cannot disagree',
  S.includes('return{rows,buildable:rows.filter(r=>!r.blockers.length).map(r=>r.card),blocked:rows.filter(r=>r.blockers.length)};'));

// v15.14: the upload payload. Every failure path must PASS THROUGH the original bytes rather
// than error — HEIC decodes in Safari but not Chrome, and Gemini accepts image/heic directly.
{
  const mkFile = (name, size) => ({ name, size, type: 'image/jpeg', _b64: 'ORIGINALBYTES' });
  global.FileReader = class {
    readAsDataURL(f) { this.result = 'data:image/jpeg;base64,' + f._b64; if (this.onload) this.onload(); }
  };
  const withGlobals = async (bitmap, dataUrl, fn) => {
    const hadCIB = 'createImageBitmap' in global, hadDoc = 'document' in global;
    if (bitmap === 'throw') global.createImageBitmap = async () => { throw new Error('decode failed'); };
    else if (bitmap) global.createImageBitmap = async () => ({ width: bitmap[0], height: bitmap[1], close() {} });
    if (bitmap) global.document = { createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ drawImage() {}, imageSmoothingEnabled: false, imageSmoothingQuality: '' }),
      toDataURL: () => dataUrl }) };
    try { return await fn(); }
    finally { if (!hadCIB) delete global.createImageBitmap; if (!hadDoc) delete global.document; }
  };
  global.__imgChecks = (async () => {
    const small = await CARD.cardFilePayload(mkFile('c.jpg', 500 * 1024));
    const noCanvas = await CARD.cardFilePayload(mkFile('c.jpg', 9 * 1024 * 1024));
    const threw = await withGlobals('throw', null, () => CARD.cardFilePayload(mkFile('c.heic', 9 * 1024 * 1024)));
    const big = await withGlobals([4032, 3024], 'data:image/jpeg;base64,SMALLER',
      () => CARD.cardFilePayload(mkFile('c.jpg', 9 * 1024 * 1024)));
    const alreadySmall = await withGlobals([1200, 900], 'data:image/jpeg;base64,SMALLER',
      () => CARD.cardFilePayload(mkFile('c.jpg', 9 * 1024 * 1024)));
    return { small, noCanvas, threw, big, alreadySmall };
  })();
}
t('card images are filtered out of the PDF/PPTX path', S.includes('for(const f of files.filter(x=>!cardIsImage(x))){'));

/* ── 11. stage timing (pre-existing, pinned) ── */
section('validateStageTiming');
t('citing a fact before its reveal → warn',
  has(CASE.validateStageTiming({ stages: [
    stage(1, [q({ rationales: [{ factIds: ['fact-9'] }] })]),
    stage(2, [], [{ availability: 'revealed', factIds: ['fact-9'] }])] }), 'before it is revealed', 'warn'));
t('background facts are available from stage 1',
  !CASE.validateStageTiming({ stages: [
    stage(1, [q({ rationales: [{ factIds: ['fact-9'] }] })]),
    stage(2, [], [{ availability: 'background', factIds: ['fact-9'] }])] }).length);

/* ── 12. v15.5 — NCLEX_GEN_PROMPT v4.2 gate + category label map ── */
// The gate lives entirely in prompt text, so these assert the blocks are PRESENT and that
// the superseded wording is GONE. A prompt edit that silently drops one of these is the
// regression this section exists to catch.
section('v15.5 — NCLEX_GEN_PROMPT v4.2');
{
  const p = spanFrom('const NCLEX_GEN_PROMPT=`', '\n`;');
  const inPrompt = s => p.includes(s);

  t('prompt declares v4.2', inPrompt('NCLEX QUESTION GENERATOR — v4.2'));
  t('terminology block present', inPrompt('TERMINOLOGY — NCSBN usage, model-authored text only'));
  t('terminology is scoped to model-authored text',
    inPrompt('It does NOT apply to verbatim source-anchor quotations'));
  t('anchor quotations exempt from the client rewrite', inPrompt('EXEMPT — do not rewrite these'));
  t('five distractor tests present', inPrompt('FIVE DISTRACTOR TESTS'));
  t('answer integration test present', inPrompt('ANSWER INTEGRATION TEST'));
  t('integration test forbids the shortest-key workaround',
    inPrompt('Do NOT correct this by making the key the shortest option'));
  t('bias check present', inPrompt('BIAS CHECK — every rendered item'));
  t('gate lists eleven criteria', inPrompt('ELEVEN stop criteria'));
  t('gate is MCQ-scoped', inPrompt('GATE — MCQ ONLY'));
  t('alignment is WARN-only, never fatal', inPrompt('ADVISORY ONLY IN THIS BUILD'));
  t('gate fails on criteria 1-10 only', inPrompt('ANY ONE of criteria 1-10'));
  t('no total score is computed', inPrompt('Do NOT compute or report a total item-quality score'));
  t('warnings are terminal, not aggregated', inPrompt('Do NOT count, total, or aggregate warnings'));
  t('NEIA source is cited', inPrompt('Nurse Education in\nPractice 93:104804'));
  t('activity area is provisional and unquoted', inPrompt('Do NOT present it as a verbatim quotation'));

  // Superseded wording must be gone — each of these was a defect the patch removed.
  t('padded 2-4 sentence stem rule removed', !inPrompt('Stem: 2-4 sentences'));
  t('mandatory patient age in stem removed', !inPrompt('patient age, key history'));
  t('rubber-stamp honesty check removed', !inPrompt('rubber-stamped'));
  t('bare length/specificity integration rule removed',
    !inPrompt('Never make the correct answer identifiable by being longer'));

  // Kept deliberately — the strongest passage in the prompt, explicitly out of scope.
  t('CONTEXTUAL PLAUSIBILITY block preserved', inPrompt('CONTEXTUAL PLAUSIBILITY (critical)'));
  t('tinea pedis example preserved', inPrompt('tinea pedis'));
  t('four distractor types preserved', inPrompt('A misconception the source explicitly corrects'));

  // Batch-relative reporting: buildBatchBlock() overrides the 10-question default, so the
  // gate denominators must not be hardcoded to /6 and /10.
  t('gate counts are batch-relative, not hardcoded',
    inPrompt('Gate [MCQ passed:_/_, N/A:_]') && !inPrompt('MCQ passed:_/6'));
}
{
  const src = spanFrom('const NCLEX_CATEGORY_LABELS=', 'const NCLEX_TEST_PLAN_VERSION=2026;');
  const M = new Function(src + '\nreturn {L:NCLEX_CATEGORY_LABELS,V:NCLEX_TEST_PLAN_VERSION};')();
  t('label map version matches the Test Plan version', M.L.version === M.V);

  // Every category ID used in the prompt must resolve in the map, and vice versa.
  const promptIds = spanFrom('  ManagementOfCare       —', '\n\n\n═══')
    .split('\n').map(l => (l.match(/^\s{2}([A-Za-z]+)\s*—/) || [])[1]).filter(Boolean);
  t('prompt lists all 8 categories', promptIds.length === 8);
  t('every prompt category ID resolves to a label', promptIds.every(id => !!M.L.map[id]));
  t('map has no IDs the prompt does not list',
    Object.keys(M.L.map).every(id => promptIds.includes(id)));
  t('labels are display strings, not IDs',
    Object.entries(M.L.map).every(([id, label]) => label !== id && /\s/.test(label)));
}

/* ── 13. v15.6 — NEIA terminology linter (item 1) ── */
section('v15.6 — NEIA terminology linter');
{
  const scan = (txt) => { const out = []; CASE.neiaTerminologyScan(txt, 'x', out); return out; };
  const msgs = (txt) => scan(txt).map(i => i.msg).join(' | ');

  // Positive — each should raise exactly one warn.
  t('"the patient" → one warn', scan('Assess the patient before ambulating.').length === 1);
  t('"administer 5.0 mg" → trailing-zero warn', /trailing zero/.test(msgs('administer 5.0 mg')));
  t('".5 mL" → leading-zero warn', /missing leading zero/.test(msgs('draw up .5 mL')));
  t('"give 10 U insulin" → unsafe-U warn', /"U" is unsafe/.test(msgs('give 10 U insulin')));
  t('"IU" → unsafe warn', /International Unit/.test(msgs('give 500 IU daily')));
  t('"physician" → provider warn', /primary health care provider/.test(msgs('Notify the physician.')));
  t('every finding is warn-tier, never error', scan('the patient saw the doctor').every(i => i.sev === 'warn'));

  // Negative — the false-positive guards. These are the assertions that matter most:
  // an over-eager linter would push the author to reword a verbatim quote.
  t('"outpatient" does not trip the patient rule', !/use "client"/.test(msgs('Refer to the outpatient clinic.')));
  t('"0.5 mg" is clean', scan('administer 0.5 mg').length === 0);
  t('"5 mg" is clean', scan('administer 5 mg').length === 0);
  t('"10 units" spelled out is clean', scan('give 10 units of insulin').length === 0);
  t('clean client-voiced prose raises nothing', scan('The client reports chest pain to the primary health care provider.').length === 0);

  // Scope: the linter must never see source quotes. validateCaseStudy is the wiring point,
  // so this proves a fact's sourceQuote containing "patient" produces no terminology issue.
  {
    const fact = { id: 'fact-1', text: 'monitor potassium', sourceQuote: 'The patient should be monitored for hypokalemia.' };
    const idx = new Map([['fact-1', { fact, condition: 'HF' }]]);
    const cs = {
      condition: 'HF', title: 'Case', patient: { background: 'Lives alone.' },
      stages: [{
        stageNumber: 1, narrative: 'The nurse enters at 0800.',
        data: [{ label: 'Potassium', value: '3.1 mEq/L', supportType: 'direct', availability: 'revealed', factIds: ['fact-1'] }],
        questions: [{
          id: 's1q1', type: 'MCQ', stem: 'What should the nurse do first?',
          options: [{ label: 'A', text: 'Recheck the level' }, { label: 'B', text: 'Notify the provider' }],
          correctAnswers: ['B'],
          rationales: [{ option: 'A', text: 'Delays care.', supportType: 'direct', factIds: ['fact-1'] },
                       { option: 'B', text: 'Correct escalation.', supportType: 'direct', factIds: ['fact-1'] }],
          cjmmSkill: 'Take Action',
        }],
      }],
      debrief: { priorityProblem: 'Low potassium', keyDecisions: ['Escalate'], notes: '', factIds: ['fact-1'] },
    };
    const found = CASE.validateCaseStudy(cs, idx, new Set(['fact-1']), 'HF');
    t('sourceQuote containing "patient" produces zero terminology issues',
      !found.some(i => /terminology/.test(i.msg)));
    t('the same case is otherwise clean of terminology findings',
      found.filter(i => /terminology/.test(i.msg)).length === 0);
  }
  // Positive wiring: a stem that says "patient" must surface through validateCaseStudy.
  {
    const fact = { id: 'fact-1', text: 'monitor potassium', sourceQuote: 'Monitor potassium closely.' };
    const idx = new Map([['fact-1', { fact, condition: 'HF' }]]);
    const cs = {
      condition: 'HF', title: 'Case', patient: { background: '' },
      stages: [{
        stageNumber: 1, narrative: '',
        data: [],
        questions: [{
          id: 's1q1', type: 'MCQ', stem: 'The patient reports dizziness. What is first?',
          options: [{ label: 'A', text: 'Sit them down' }, { label: 'B', text: 'Notify the provider' }],
          correctAnswers: ['B'],
          rationales: [{ option: 'A', text: 'Partial.', supportType: 'direct', factIds: ['fact-1'] },
                       { option: 'B', text: 'Correct.', supportType: 'direct', factIds: ['fact-1'] }],
          cjmmSkill: 'Take Action',
        }],
      }],
      debrief: {},
    };
    const found = CASE.validateCaseStudy(cs, idx, new Set(['fact-1']), 'HF');
    t('a stem saying "patient" surfaces a terminology warn through validateCaseStudy',
      found.some(i => /stem: terminology/.test(i.msg) && i.sev === 'warn'));
  }
}
{
  // Prompt-side companion (item 1d).
  const cp = spanFrom('function caseBuildPrompt(', '`;\n}', 'function caseBuildPrompt(');
  // Guard: the end anchor must reach the real end of the function. '\n}\n' does NOT — it
  // matches inside the JSON-shape block, silently truncating the span so later assertions
  // pass vacuously. This assertion fails loudly if the anchor regresses.
  t('caseBuildPrompt span reaches the end of the prompt', cp.includes('Return ONLY the JSON object.'));
  t('caseBuildPrompt carries the TERMINOLOGY block', cp.includes('TERMINOLOGY: use NCSBN Test Plan vocabulary'));
  t('terminology block exempts quoted source', cp.includes('Quoted source material keeps its own wording'));
  t('"client\'s first name" replaces "patient\'s first name"',
    cp.includes("the client's first name") && !cp.includes("the patient's first name"));
  t('education type is Client education', cp.includes('Client education (which teaching point'));
  t('JSON key "patient" is deliberately unchanged', cp.includes('"patient": { "age": 0'));
  t('prose field path patient.background is unchanged', cp.includes('title · patient.background · stage narrative'));
}

/* ── 14. v15.6 — instantiated support type + threshold parser (item 2) ── */
section('v15.6 — instantiated values');
{
  const TH = CASE.caseParseThreshold;
  t('parses "<30 mL/hr"', (() => { const r = TH('Report urine output <30 mL/hr.'); return r && r.op === '<' && r.value === 30; })());
  t('parses "below 30"', (() => { const r = TH('Report urine output below 30 mL/hr.'); return r && r.op === '<' && r.value === 30; })());
  t('parses "less than 90 mm Hg"', (() => { const r = TH('Hypotension is a systolic less than 90 mm Hg.'); return r && r.op === '<' && r.value === 90; })());
  t('parses "at least 2 L"', (() => { const r = TH('Encourage at least 2 L of fluid daily.'); return r && r.op === '>=' && r.value === 2; })());
  t('parses "no more than 3 g"', (() => { const r = TH('Restrict sodium to no more than 3 g daily.'); return r && r.op === '<=' && r.value === 3; })());
  t('parses "greater than 100"', (() => { const r = TH('Tachycardia is a rate greater than 100 bpm.'); return r && r.op === '>' && r.value === 100; })());
  t('parses a 7.35-7.45 range', (() => { const r = TH('The normal pH range is 7.35-7.45.'); return r && r.op === 'range' && r.lo === 7.35 && r.hi === 7.45; })());
  t('parses an en-dash range', (() => { const r = TH('Normal range 7.35–7.45.'); return r && r.op === 'range' && r.hi === 7.45; })());
  t('a fact with no comparator yields null', TH('Monitor serum potassium.') === null);
  t('a comparator with no adjacent number yields null', TH('Keep the output below the stated threshold.') === null);
  t('empty input yields null', TH('') === null);

  const IX = new Map([
    ['t-lt', { condition: {}, fact: { text: 'Report urine output below 30 mL/hr.', sourceQuote: '' } }],
    ['t-ph', { condition: {}, fact: { text: 'The normal pH range is 7.35-7.45.', sourceQuote: '' } }],
    ['t-none', { condition: {}, fact: { text: 'Monitor serum potassium.', sourceQuote: '' } }],
    ['t-bp', { condition: {}, fact: { text: 'Hypotension is a systolic below 90 mm Hg.', sourceQuote: '' } }]]);
  const audit = (text, ids, st) => { const i = []; CASE.caseAuditTextValues(text, ids, IX, 'X', i, st); return i; };

  t('instantiated 22 mL/hr against "below 30" → clean', audit('Urine output 22 mL/hr', ['t-lt'], 'instantiated').length === 0);
  t('instantiated 45 mL/hr against "below 30" → warn, not error',
    has(audit('Urine output 45 mL/hr', ['t-lt'], 'instantiated'), 'falls outside the threshold', 'warn'));
  t('an out-of-range instantiation never blocks the case',
    !audit('Urine output 45 mL/hr', ['t-lt'], 'instantiated').some(i => i.sev === 'error'));
  t('instantiated against a fact with no comparator → error naming the missing threshold',
    has(audit('Potassium 2.4 mEq/L', ['t-none'], 'instantiated'), 'no parseable threshold', 'error'));
  t('range: 7.40 inside 7.35-7.45 → clean', audit('pH 7.40 units', ['t-ph'], 'instantiated').length === 0);
  t('range: 7.2 outside 7.35-7.45 → warn', has(audit('pH 7.2 units', ['t-ph'], 'instantiated'), 'falls outside the threshold', 'warn'));
  t('BP pair 82/50 against "systolic below 90" → clean (systolic compared in mmHg)',
    audit('Blood pressure 82/50', ['t-bp'], 'instantiated').length === 0);
  t('BP pair 120/80 against "systolic below 90" → warn',
    has(audit('Blood pressure 120/80', ['t-bp'], 'instantiated'), 'falls outside the threshold', 'warn'));
  // The real fabrication guard: a number with no basis in any cited fact stays an ERROR.
  t('an instantiation with no threshold anywhere is still an error',
    has(audit('Potassium 2.4 mEq/L', ['t-none'], 'instantiated'), 'no parseable threshold', 'error'));

  // Severity table: everything that is not instantiated or neutral-framing now errors.
  t('direct with an uncited value → error', has(audit('Potassium 2.4 mEq/L', ['t-none'], 'direct'), 'does not appear', 'error'));
  t('combined with an uncited value → error', has(audit('Potassium 2.4 mEq/L', ['t-none'], 'combined'), 'does not appear', 'error'));
  t('inference with an uncited value → error', has(audit('Potassium 2.4 mEq/L', ['t-none'], 'inference'), 'does not appear', 'error'));
  t('neutral-framing returns early even with a value and IDs', audit('Potassium 2.4 mEq/L', ['t-none'], 'neutral-framing').length === 0);
  t('no factIds → still silent', audit('Potassium 2.4 mEq/L', [], 'direct').length === 0);
  t('a value present verbatim in its cited fact → clean regardless of type',
    audit('Report urine output below 30 mL', ['t-lt'], 'direct').length === 0);

  // Enum + prompt contract.
  t('"instantiated" is a valid supportType', CASE.CASE_SUPPORT_TYPES.has('instantiated'));
  t('the enum still rejects off-vocabulary values', !CASE.CASE_SUPPORT_TYPES.has('Instantiated'));
  {
    const cp = spanFrom('function caseBuildPrompt(', '`;\n}', 'function caseBuildPrompt(');
    t('prompt documents the instantiated support type', cp.includes('"instantiated"   — a specific client value'));
    t('prompt warns instantiation is code-checked', cp.includes('is an ERROR unless you declare'));
    t('SOURCE BOUNDARY no longer contradicts instantiation', cp.includes('EITHER verbatim OR as a'));
  }
}

/* ── 15. v15.6 — deterministic item heuristics (item 3) ── */
section('v15.6 — item heuristics');
{
  const H = (q) => { const i = []; CASE.itemHeuristics(q, i, 'Q'); return i; };
  const mcq = (stem, texts, key) => ({
    type: 'MCQ', stem,
    options: texts.map((tx, n) => ({ label: 'ABCD'[n], text: tx })),
    correctAnswers: [key || 'A'],
  });
  const w = (n, seed) => Array.from({ length: n }, (_, i) => 'word' + ((i + (seed || 0)) % 40)).join(' ');

  // Length.
  {
    const found = H(mcq('What should the nurse do?', [w(30, 1), w(10, 2), w(10, 3), w(10, 4)], 'A'));
    const m = found.find(x => /option length/.test(x.msg));
    t('key 3× the median distractor → length diagnostic fires', !!m);
    t('length diagnostic reports the measured ratio', !!m && /3\.00× the median/.test(m.msg));
    t('length diagnostic names the word counts', !!m && /\(30 vs 10 words\)/.test(m.msg));
  }
  t('all options within ±10% → zero length diagnostics',
    !H(mcq('What should the nurse do?', [w(10, 1), w(11, 2), w(10, 3), w(11, 4)], 'A')).some(x => /option length/.test(x.msg)));
  // The false-positive guard: a long key is fine when a distractor is equally long.
  t('legitimately long key matched by an equally long distractor → no unique-longest flag',
    !H(mcq('What should the nurse do?', [w(30, 1), w(30, 2), w(10, 3), w(10, 4)], 'A')).some(x => /option length/.test(x.msg)));
  t('key that is the unique shortest by a wide margin → flags',
    H(mcq('What should the nurse do?', [w(3, 1), w(20, 2), w(20, 3), w(20, 4)], 'A')).some(x => /unique shortest/.test(x.msg)));

  // Stem overlap.
  t('key repeating a distinctive stem term → overlap diagnostic fires',
    H(mcq('The client shows evidence of digoxin toxicity today.',
      ['Hold the digoxin toxicity medication', 'Ambulate them promptly', 'Offer warm blankets', 'Dim the lights'], 'A'))
      .some(x => /stem overlap/.test(x.msg)));
  t('overlap diagnostic is labelled a smoke detector, not a verdict',
    H(mcq('The client shows evidence of digoxin toxicity today.',
      ['Hold the digoxin toxicity medication', 'Ambulate them promptly', 'Offer warm blankets', 'Dim the lights'], 'A'))
      .some(x => /smoke detector/.test(x.msg)));
  t('distractors sharing stem vocabulary equally → no overlap flag',
    !H(mcq('The client shows evidence of digoxin toxicity.',
      ['Hold the digoxin dose', 'Repeat the digoxin level', 'Review digoxin adherence', 'Chart the digoxin time'], 'A'))
      .some(x => /stem overlap/.test(x.msg)));

  // Distinctiveness.
  // Reordered synonyms are the case Distinctiveness exists to catch — same token set,
  // different surface form, both defensible to a confused student.
  t('near-duplicate options → Jaccard diagnostic',
    H(mcq('What should the nurse do?',
      ['Elevate the legs immediately', 'Immediately elevate the legs', 'Offer warm blankets', 'Dim the lights'], 'C'))
      .some(x => /near-duplicates/.test(x.msg)));
  t('options at Jaccard 0.75 stay under the 0.8 cutoff',
    !H(mcq('What should the nurse do?',
      ['Elevate the legs immediately', 'Elevate the legs immediately now', 'Offer warm blankets', 'Dim the lights'], 'C'))
      .some(x => /near-duplicates/.test(x.msg)));
  t('distinct options → no Jaccard diagnostic',
    !H(mcq('What should the nurse do?',
      ['Elevate the legs', 'Administer oxygen', 'Offer warm blankets', 'Dim the lights'], 'A'))
      .some(x => /near-duplicates/.test(x.msg)));

  // Negative stems.
  t('"which is NOT" stem → negative-construction diagnostic',
    H(mcq('Which finding is NOT expected?', ['a', 'b', 'c', 'd'], 'A')).some(x => /negative construction/.test(x.msg)));
  t('"all are correct EXCEPT" stem → diagnostic',
    H(mcq('All are correct except one.', ['a', 'b', 'c', 'd'], 'A')).some(x => /negative construction/.test(x.msg)));
  t('"outpatient" does not trip the negative-stem regex',
    !H(mcq('The client is seen in the outpatient clinic.', ['a', 'b', 'c', 'd'], 'A')).some(x => /negative construction/.test(x.msg)));
  t('"cannot" does not trip the bare "not" alternative',
    !H(mcq('The client cannot ambulate independently.', ['a', 'b', 'c', 'd'], 'A')).some(x => /negative construction/.test(x.msg)));
  // Consistency with NCLEX_GEN_PROMPT v4.2, which rules this clinical content, not a negation.
  t('"least restrictive" is permitted, matching v4.2',
    !H(mcq('Which is the least restrictive intervention?', ['a', 'b', 'c', 'd'], 'A')).some(x => /negative construction/.test(x.msg)));

  // Scope + severity.
  t('every heuristic finding is warn-tier',
    H(mcq('Which is NOT expected?', [w(30, 1), w(10, 2), w(10, 3), w(10, 4)], 'A')).every(x => x.sev === 'warn'));
  t('SATA is out of scope', H(Object.assign(mcq('x', [w(30, 1), w(5, 2), w(5, 3)], 'A'), { type: 'SATA' })).length === 0);
  t('Ordering is out of scope', H(Object.assign(mcq('x', [w(30, 1), w(5, 2), w(5, 3)], 'A'), { type: 'Ordering' })).length === 0);
  t('an MCQ whose key label matches no option is skipped safely',
    !H(mcq('What should the nurse do?', [w(30, 1), w(5, 2), w(5, 3), w(5, 4)], 'Z')).some(x => /option length/.test(x.msg)));
  t('heuristics are wired into validateCaseStudy', S.includes('itemHeuristics(q,issues,qn);'));
  t('thresholds are declared as LATTE heuristics, not NEIA', S.includes('const CASE_LEN_RATIO_HI=1.4'));
}

/* ── 16. v15.6 — Priority Stage 1 carve-out + UI copy (items 6, 7) ── */
section('v15.6 — Priority Stage 1 + UI copy');
{
  const pa = spanFrom('function paBuildExtractPrompt(', '\n}\n', 'function paBuildExtractPrompt(');
  t('rule 4 keeps its no-new-content ban', pa.includes('Never add clinical facts from'));
  t('rule 4 gains the classification carve-out', pa.includes('SCOPE: this bans ADDING clinical content'));
  t('carve-out permits applying a FLAG', pa.includes('Applying a FLAG from the list above is classification'));
  t('carve-out still bans writing new values', pa.includes('Writing a clinical value, threshold, or interpretation'));
  t('CRIT-LAB gains the baseline caveat', pa.includes('heuristic\n                    buckets, not universal thresholds'));
  t('CRIT-LAB caveat names the dialysis/INR cases', pa.includes("this client's expected baseline (dialysis K+"));
  // The verbatim-qualifier rule is explicitly out of scope for this release.
  t('rule 2 verbatim-qualifier requirement is untouched',
    pa.includes("QUALIFIER — copy the source's own modifying words for the finding, verbatim.") &&
    pa.includes('NEVER invent a qualifier.'));
  t('Stage 1 still assigns no tiers', pa.includes('Do not write T1, T2, or T3 anywhere.'));
  // Stage 1 output must never reach the terminology linter.
  t('terminology linter is not wired into the Priority Analyzer',
    !/paBuild\w+Prompt[\s\S]{0,4000}?neiaTerminologyScan/.test(S));
}
{
  t('Tier 3 copy no longer calls Tier 3 a distractor pool',
    !S.includes('Tier 3 supplies plausible non-urgent distractors'));
  t('Tier 3 copy describes background detail', S.includes('Tier 3 adds lower-priority background detail'));
  t('Tier 3 copy states distractors come from any tier',
    S.includes('Distractors are built from contextually plausible near-misses at any tier, not from Tier 3'));
}

/* ── 17. v15.6 — operationalized difficulty (item 5) ── */
section('v15.6 — difficulty contract');
{
  // Fact index: f1/f2 are Tier 1, f3 is Tier 3 filler, f4 is safety-critical.
  const DIX = new Map([
    ['f1', { condition: {}, fact: { id: 'f1', text: 'a', tier: 1, safetyCritical: false } }],
    ['f2', { condition: {}, fact: { id: 'f2', text: 'b', tier: 2, safetyCritical: false } }],
    ['f3', { condition: {}, fact: { id: 'f3', text: 'c', tier: 3, safetyCritical: false } }],
    ['f4', { condition: {}, fact: { id: 'f4', text: 'd', tier: 3, safetyCritical: true } }]]);
  const D = cs => CASE.caseDifficultySignals(cs, DIX);
  const datum = (ids, avail) => ({ label: 'x', value: 'y', supportType: 'direct', availability: avail || 'revealed', factIds: ids });
  const mcqQ = (id, skill, ratIds, opts) => ({
    id, type: 'MCQ', stem: 's', cjmmSkill: skill,
    options: (opts || [{ label: 'A' }, { label: 'B' }, { label: 'C' }]),
    correctAnswers: ['A'],
    rationales: (opts || [{ label: 'A' }, { label: 'B' }, { label: 'C' }])
      .map(o => ({ option: o.label, text: 't', supportType: 'direct', factIds: ratIds[o.label] || ['f1'] })),
  });

  t('foundational imposes no minimum', D({ difficulty: 'foundational', stages: [] }).length === 0);
  t('an unknown difficulty string is not policed', D({ difficulty: 'nightmare', stages: [] }).length === 0);

  // Advanced, all three signatures missing.
  {
    // Distractors cite f3 — Tier 3, not safety-critical — i.e. obviously-wrong filler.
    const weak = { A: ['f1'], B: ['f3'], C: ['f3'] };
    const cs = { difficulty: 'advanced', stages: [
      { stageNumber: 1, data: [datum(['f1'])], questions: [mcqQ('q1', 'Evaluate Outcomes', weak)] },
      { stageNumber: 2, data: [], questions: [mcqQ('q2', 'Evaluate Outcomes', weak)] }] };
    const found = D(cs);
    t('advanced with only Evaluate Outcomes → missing Prioritize Hypotheses warn',
      has(found, 'no question is tagged "Prioritize Hypotheses"', 'warn'));
    t('advanced with no cross-stage citation → warn', has(found, 'no cross-stage integration', 'warn'));
    t('advanced with weak distractors → near-miss density warn', has(found, 'near-miss density', 'warn'));
    t('difficulty findings are warn-tier, never error', found.every(i => i.sev === 'warn'));
    t('the warn names the requested level', found.every(i => /Requested difficulty "advanced"/.test(i.msg)));
  }

  // Advanced, all three signatures genuinely satisfied.
  {
    const cs = { difficulty: 'advanced', stages: [
      { stageNumber: 1, data: [datum(['f1'])], questions: [mcqQ('q1', 'Recognize Cues', {})] },
      { stageNumber: 2, data: [datum(['f2'])], questions: [mcqQ('q2', 'Prioritize Hypotheses', {})] },
      { stageNumber: 3, data: [datum(['f3'])], questions: [
        // cites f1 (stage 1) and f2 (stage 2) → two different earlier stages
        Object.assign(mcqQ('q3', 'Evaluate Outcomes', { A: ['f1', 'f2'], B: ['f2'], C: ['f4'] }),
          { rationales: [
            { option: 'A', text: 't', supportType: 'direct', factIds: ['f1', 'f2'] },
            { option: 'B', text: 't', supportType: 'direct', factIds: ['f2'] },
            { option: 'C', text: 't', supportType: 'direct', factIds: ['f4'] }] })] }] };
    t('advanced satisfying all three signatures → zero difficulty warnings', D(cs).length === 0);
  }

  // Cross-stage requires TWO different earlier stages, not two facts from one stage.
  {
    const cs = { difficulty: 'advanced', stages: [
      { stageNumber: 1, data: [datum(['f1']), datum(['f2'])], questions: [mcqQ('q1', 'Prioritize Hypotheses', {})] },
      { stageNumber: 2, data: [], questions: [] },
      { stageNumber: 3, data: [], questions: [
        Object.assign(mcqQ('q3', 'Evaluate Outcomes', {}), { rationales: [
          { option: 'A', text: 't', supportType: 'direct', factIds: ['f1', 'f2'] },
          { option: 'B', text: 't', supportType: 'direct', factIds: ['f2'] },
          { option: 'C', text: 't', supportType: 'direct', factIds: ['f4'] }] })] }] };
    t('two facts from a single earlier stage is not cross-stage integration',
      has(D(cs), 'no cross-stage integration', 'warn'));
  }
  // Background data is available everywhere, so it cannot evidence cross-stage integration.
  {
    const cs = { difficulty: 'advanced', stages: [
      { stageNumber: 1, data: [datum(['f1'], 'background')], questions: [mcqQ('q1', 'Prioritize Hypotheses', {})] },
      { stageNumber: 2, data: [datum(['f2'], 'background')], questions: [] },
      { stageNumber: 3, data: [], questions: [
        Object.assign(mcqQ('q3', 'Evaluate Outcomes', {}), { rationales: [
          { option: 'A', text: 't', supportType: 'direct', factIds: ['f1', 'f2'] },
          { option: 'B', text: 't', supportType: 'direct', factIds: ['f2'] },
          { option: 'C', text: 't', supportType: 'direct', factIds: ['f4'] }] })] }] };
    t('background-only citations do not count as cross-stage', has(D(cs), 'no cross-stage integration', 'warn'));
  }

  // Exam level.
  {
    const bare = { difficulty: 'exam', stages: [
      { stageNumber: 1, data: [], questions: [mcqQ('q1', 'Recognize Cues', {})] }] };
    const found = D(bare);
    t('exam without Analyze Cues → warn', has(found, 'no question is tagged "Analyze Cues"', 'warn'));
    t('exam without Take Action → warn', has(found, 'no question is tagged "Take Action"', 'warn'));
    t('exam without two revealed facts in one question → warn',
      has(found, 'two or more distinct facts presented as revealed case data', 'warn'));
  }
  {
    const ok = { difficulty: 'exam', stages: [
      { stageNumber: 1, data: [datum(['f1']), datum(['f2'])], questions: [
        mcqQ('q1', 'Analyze Cues', {}),
        Object.assign(mcqQ('q2', 'Take Action', {}), { rationales: [
          { option: 'A', text: 't', supportType: 'direct', factIds: ['f1', 'f2'] },
          { option: 'B', text: 't', supportType: 'direct', factIds: ['f1'] },
          { option: 'C', text: 't', supportType: 'direct', factIds: ['f2'] }] })] }] };
    t('exam satisfying all three signatures → zero difficulty warnings', D(ok).length === 0);
  }
  // Near-miss density needs a MAJORITY, not merely one strong distractor.
  {
    const half = { A: ['f1'], B: ['f2'], C: ['f3'] }; // 1 of 2 distractors is Tier<=2
    const cs = { difficulty: 'advanced', stages: [
      { stageNumber: 1, data: [datum(['f1'])], questions: [mcqQ('q1', 'Prioritize Hypotheses', half)] },
      { stageNumber: 2, data: [datum(['f2'])], questions: [] },
      { stageNumber: 3, data: [], questions: [
        Object.assign(mcqQ('q3', 'Evaluate Outcomes', half), { rationales: [
          { option: 'A', text: 't', supportType: 'direct', factIds: ['f1', 'f2'] },
          { option: 'B', text: 't', supportType: 'direct', factIds: ['f2'] },
          { option: 'C', text: 't', supportType: 'direct', factIds: ['f3'] }] })] }] };
    // q3's distractors are f2 (tier 2, strong) and f3 (tier 3, weak) → exactly half, not a majority.
    t('exactly half the distractors being strong is not a majority',
      has(D(cs), 'near-miss density', 'warn'));
  }
  t('difficulty signals are wired into validateCaseStudy',
    S.includes('issues.push(...caseDifficultySignals(caseStudy,factIndex));'));
}
{
  const cp = spanFrom('function caseDifficultyBlock(', '\n}\n', 'function caseDifficultyBlock(');
  t('the ceiling is emitted at every level', cp.includes('DIFFICULTY CEILING (all levels)'));
  t('ceiling names cue integration as the legitimate lever', cp.includes('Increase difficulty through cue integration'));
  t('ceiling forbids specialty trivia and convoluted language', cp.includes('never through specialty\ntrivia, obscure facts, convoluted language'));
  t('ceiling states out-of-scope is disqualifying', cp.includes("outside a new graduate's role is disqualified"));
  t('all three levels are defined', cp.includes('foundational:') && cp.includes('exam:') && cp.includes('advanced:'));
  t('each level declares its structural signature', cp.includes('STRUCTURAL SIGNATURE (checked in code)'));
  t('foundational declares no structural minimum', cp.includes('none — no structural minimum is enforced'));
  t('an unknown level falls back to exam, not to nothing', cp.includes('||LEVELS.exam'));
  t('the bare Difficulty interpolation is gone', !S.includes('Difficulty: ${difficulty}. Produce'));
}

/* ── 18. v15.6 — case NEIA audit pass (item 4) ── */
section('v15.6 — case audit pass');
{
  const A = AUDIT;
  const opt = (l, tx) => ({ label: l, text: tx });
  const Q = (o) => Object.assign({
    id: 'q1', type: 'MCQ', stem: 'What should the nurse do first?',
    options: [opt('A', 'Alpha'), opt('B', 'Beta'), opt('C', 'Gamma'), opt('D', 'Delta')],
    correctAnswers: ['B'], rationales: [], cjmmSkill: 'Take Action',
  }, o);

  // ── Scope (4a) ──
  t('a well-formed MCQ is gate-eligible', A.caseIsGateEligible(Q({})));
  t('SATA is not gate-eligible', !A.caseIsGateEligible(Q({ type: 'SATA', correctAnswers: ['A', 'B'] })));
  t('Ordering is not gate-eligible', !A.caseIsGateEligible(Q({ type: 'Ordering' })));
  t('Calculation is not gate-eligible', !A.caseIsGateEligible(Q({ type: 'Calculation' })));
  t('Education is not gate-eligible', !A.caseIsGateEligible(Q({ type: 'Education' })));
  t('Prioritization phrased as SATA is not gate-eligible',
    !A.caseIsGateEligible(Q({ type: 'Prioritization', correctAnswers: ['A', 'B'] })));
  t('an MCQ with two keys is not gate-eligible', !A.caseIsGateEligible(Q({ correctAnswers: ['A', 'B'] })));
  t('an MCQ with two options is not gate-eligible', !A.caseIsGateEligible(Q({ options: [opt('A', 'x'), opt('B', 'y')] })));

  // ── Payload (4b): the critical leak test ──
  const CS = {
    title: 'Worsening dyspnea', condition: 'Heart failure', difficulty: 'exam',
    patient: { age: 72, sex: 'female', background: 'Lives alone.' },
    stages: [
      { stageNumber: 1, title: 'Arrival', narrative: 'The nurse enters at 0800.',
        data: [{ label: 'RR', value: '28/min', supportType: 'direct', availability: 'revealed', factIds: ['fact-104'] }],
        questions: [Q({ id: 's1q1' })] },
      { stageNumber: 2, title: 'Labs', narrative: 'Results return.',
        data: [{ label: 'BNP', value: '900 pg/mL', supportType: 'direct', availability: 'revealed', factIds: ['fact-205'] }],
        questions: [Q({ id: 's2q1', stem: 'Which finding is most concerning?' })] },
      { stageNumber: 3, title: 'Later', narrative: 'Overnight.',
        data: [{ label: 'Weight', value: '3 kg up', supportType: 'direct', availability: 'revealed', factIds: ['fact-999'] }],
        questions: [Q({ id: 's3q1' })] }],
    debrief: { priorityProblem: 'Fluid overload', keyDecisions: ['Escalate'], notes: 'n', factIds: ['fact-104'] },
  };
  const p1 = A.caseAuditPayload(CS, 1, CS.stages[0].questions[0]);
  const p2 = A.caseAuditPayload(CS, 2, CS.stages[1].questions[0]);

  t('payload includes the item\'s own stage', p1.includes('Stage 1'));
  t('payload truncates at the item\'s stage — stage 2 is absent from a stage-1 audit', !p1.includes('Stage 2'));
  t('payload truncates future stages — stage 3 is absent from a stage-2 audit', !p2.includes('Stage 3'));
  t('a stage-2 payload still carries stage 1 for cumulative context', p2.includes('Stage 1'));
  t('payload carries the stem', p1.includes('What should the nurse do first?'));
  t('payload carries the keyed answer', p1.includes('KEYED ANSWER: B'));
  t('payload carries the options', p1.includes('A. Alpha') && p1.includes('D. Delta'));

  // These are the assertions that matter most: the auditor must be blind to grounding.
  t('payload leaks NO fact IDs', !/fact-\d+/.test(p1) && !/fact-\d+/.test(p2));
  t('payload leaks no future-stage fact IDs', !p2.includes('fact-999'));
  t('payload contains no supportType values', !/supportType|direct|neutral-framing/.test(p1));
  t('payload contains no answer key section', !p1.includes('Answer Key'));
  t('payload contains no rationales', !p1.includes('rationale'));
  t('payload contains no debrief', !p1.includes('Fluid overload'));
  t('payload shows what the student sees, including difficulty', p1.includes('Difficulty'));

  // ── Prompt (4c, 4e) ──
  const ap = A.itemBuildAuditPrompt('PAYLOAD');
  t('audit prompt embeds the payload', ap.includes('PAYLOAD'));
  t('audit prompt lists eleven criteria', /11\. TEST PLAN ALIGNMENT/.test(ap) && /1\. STEM CLARITY/.test(ap));
  t('audit prompt makes alignment advisory only', ap.includes('It may NEVER produce a FAIL'));
  t('audit prompt forbids a total score or band', ap.includes('Do NOT compute or report a total score'));
  t('audit prompt offers REVIEW as a status', ap.includes('REVIEW — <what you could not resolve>'));
  t('audit prompt states the auditor has no source facts', ap.includes('You do not have the case\'s source facts'));
  t('audit prompt cites NEIA', ap.includes('Nurse Education in\nPractice 93:104804'));
  t('audit prompt never ships the fact packet', !ap.includes('«FACT-PACKET»'));

  // ── Verdict parsing (4d, 4e) ──
  const V = A.itemParseAuditVerdict;
  t('PASS parses', V('PASS').status === 'PASS');
  t('FAIL with an em dash parses', V('FAIL — Distractor Plausibility').status === 'FAIL');
  t('FAIL captures the criterion', V('FAIL — Distractor Plausibility').criterion === 'Distractor Plausibility');
  t('FAIL with a hyphen parses', V('FAIL - Stem Clarity').criterion === 'Stem Clarity');
  t('REVIEW parses with its detail', V('REVIEW — cannot verify the lab threshold').status === 'REVIEW');
  t('unparseable output defaults to REVIEW, never PASS', V('the item looks fine to me').status === 'REVIEW');
  t('empty output defaults to REVIEW', V('').status === 'REVIEW');
  t('WARN lines are collected', V('PASS\nWARN Stem Clarity: tighten the second sentence').warns.length === 1);
  t('WARN captures criterion and detail', (() => {
    const w = V('PASS\nWARN Stem Clarity: tighten it').warns[0];
    return w.criterion === 'Stem Clarity' && w.detail === 'tighten it';
  })());
  t('multiple WARNs are collected', V('PASS\nWARN A: x\nWARN B: y').warns.length === 2);
  t('a WARN line does not become the verdict', V('WARN Stem Clarity: x\nPASS').status === 'PASS');

  // Alignment can never fail an item — enforced in code, not just asked for in the prompt.
  t('FAIL on Test Plan Alignment is downgraded to PASS', V('FAIL — Test Plan Alignment').status === 'PASS');
  t('the downgraded alignment failure survives as a WARN',
    V('FAIL — Test Plan Alignment').warns.some(w => /Test Plan Alignment/.test(w.criterion)));
  t('FAIL on "Alignment with NCLEX-RN Test Plan" is also downgraded',
    V('FAIL — Alignment with NCLEX-RN Test Plan').status === 'PASS');

  // Answer accuracy never auto-repairs.
  t('answer-accuracy FAIL is not auto-repairable', V('FAIL — Answer Accuracy').autoRepairable === false);
  t('"Correct Answer: Accuracy" is recognised', A.itemAuditIsAnswerAccuracy('Correct Answer: Accuracy'));
  t('a distractor FAIL IS auto-repairable', V('FAIL — Distractor Length').autoRepairable === true);
  t('a PASS is never auto-repairable', V('PASS').autoRepairable === false);
  t('a REVIEW is never auto-repairable', V('REVIEW — unclear').autoRepairable === false);

  // ── Item enumeration + summary ──
  const items = A.caseGateItems(CS);
  t('every question is enumerated', items.length === 3);
  t('gate items carry a stable stage:id key', items[0].key === '1:s1q1');
  t('all three MCQs are eligible here', items.filter(i => i.eligible).length === 3);
  {
    const mixed = { stages: [{ stageNumber: 1, questions: [Q({ id: 'a' }), Q({ id: 'b', type: 'SATA', correctAnswers: ['A', 'B'] })] }] };
    t('a SATA in the mix is enumerated but not eligible',
      A.caseGateItems(mixed).length === 2 && A.caseGateItems(mixed).filter(i => i.eligible).length === 1);
  }
  {
    const sum = A.itemAuditSummary([{ status: 'PASS', warns: [] }, { status: 'FAIL', warns: [{}] }, { status: 'N/A', warns: [] }, { status: 'REVIEW', warns: [] }, { status: 'REPAIRED', warns: [] }]);
    t('summary counts each status', sum.pass === 1 && sum.fail === 1 && sum.na === 1 && sum.review === 1 && sum.repaired === 1);
    t('summary counts warnings', sum.warns === 1);
    t('summary reports no score, percentage, or band',
      !('score' in sum) && !('band' in sum) && !('percent' in sum) && !('quality' in sum));
  }

  // ── Concurrency (4g) ──
  {
    const order = [];
    let live = 0, peak = 0;
    const work = Array.from({ length: 9 }, (_, i) => i);
    const res = (() => A.itemRunPool(work, 3, async (x) => {
      live++; peak = Math.max(peak, live);
      await new Promise(r => setTimeout(r, 5));
      live--; order.push(x);
      return x * 2;
    }))();
    // resolved below via .then in the async wrapper
    global.__poolCheck = res.then(r => ({ r, peak, order }));
  }
  {
    const ctl = new AbortController();
    ctl.abort();
    global.__abortCheck = A.itemRunPool([1, 2, 3], 3, async x => x, ctl.signal)
      .then(() => 'resolved', e => e.name);
  }
  // v15.8: a lane that throws must not discard the verdicts other lanes already returned.
  // Before this, Promise.all rejected, the caller's assignment never ran, and every audit
  // the user had already paid for in that batch was silently dropped.
  {
    global.__partialCheck = A.itemRunPool([1, 2, 3, 4], 1, async (x) => {
      if (x === 3) throw Object.assign(new Error('API quota exhausted'), { name: 'QuotaStop' });
      return 'done' + x;
    }).then(() => 'resolved-unexpectedly', e => ({ name: e.name, partial: e.partial }));
  }
  // v15.14: a lane that throws must also stop the OTHER lane. Promise.all rejected on the
  // first throw, but the sibling stayed inside its own for(;;) and kept pulling items and
  // issuing calls — which defeated the QuotaStop path entirely, since only one of the two
  // lanes ever actually stopped.
  {
    let started = 0;
    global.__poolStopCheck = A.itemRunPool([0, 1, 2, 3, 4, 5, 6, 7], 2, async (x) => {
      started++;
      await new Promise(r => setTimeout(r, 5));
      if (x === 1) throw Object.assign(new Error('API quota exhausted'), { name: 'QuotaStop' });
      return 'ok' + x;
    }).then(() => ({ started: -1 }), e => ({ started, partial: e.partial, name: e.name }));
  }
  // The converse: work in flight when the fatal lands must still reach the caller. e.partial
  // was snapshotted at rejection time, so a slow sibling's result was written into out[] and
  // never surfaced — paid for and discarded.
  {
    global.__poolLateCheck = A.itemRunPool([0, 1, 2, 3], 2, async (x) => {
      await new Promise(r => setTimeout(r, x === 0 ? 40 : 1));
      if (x === 1) throw Object.assign(new Error('q'), { name: 'QuotaStop' });
      return 'ok' + x;
    }).then(() => null, e => e.partial);
  }

  // ── Repair prompt (4f) ──
  const rp = A.caseBuildRepairPrompt({
    conditionName: 'HF', facts: [], stageNumber: 2, q: Q({ id: 's2q1' }),
    criterion: 'Distractor Length', visibleContext: 'CONTEXT-HERE',
  });
  t('repair prompt names the failed criterion', rp.includes('FAILED: Distractor Length'));
  t('repair prompt carries the visible context', rp.includes('CONTEXT-HERE'));
  t('repair prompt DOES ship the fact packet (repair is a generation call)', rp.includes('«FACT-PACKET»'));
  t('repair prompt carries the shared question rules', rp.includes('«SHARED-QUESTION-RULES»'));
  t('repair prompt pins the question id', rp.includes('"id": "s2q1"'));
  t('repair prompt forbids the shortest-key workaround', rp.includes('making the key the shortest option'));
  t('repair prompt requires answerability from already-shown data', rp.includes('Do not depend on data the student has not seen'));

  // ── Wiring ──
  // v15.7: Flash, not Pro — a cost decision. Thinking stays high, which is the part that
  // matters for rubric judgment. A real free-tier key exhausted its Pro allowance at ~26 calls.
  t('itemAudit profile defaults to flash + high', /itemAudit:\{m:'flash',lv:'high'\}/.test(S));
  t('the audit still uses high reasoning', /itemAudit:\{m:'\w+',lv:'high'\}/.test(S));
  t('the Flash default is documented as a cost decision, not a quality one',
    S.includes('This is a COST decision, not a quality one'));
  t('itemAudit has a profile row', S.includes("{id:'itemAudit',label:'Item quality · audit'}"));
  t('there is exactly ONE audit profile row, not one per source tool',
    (S.match(/label:'[^']*·\s*audit'/g) || []).filter(x => /Item quality/.test(x)).length === 1 && !S.includes("id:'nclexgenAudit'"));
  t('the renamed profile key is migrated for saved configs', S.includes('if(p.casesAudit&&!p.itemAudit)'));
  t('audit runs only when the case has zero structural errors', S.includes('if(runAudit&&errCount===0){'));
  // v15.7: narrowed 3 -> 2 after a live run exhausted free-tier quota. Width 3 at the ~6s
  // latency measured on this build bursts roughly 28 requests/minute.
  t('the audit pool is bounded and narrow', S.includes('const AUDIT_POOL_WIDTH=2') && S.includes('itemRunPool(eligible,AUDIT_POOL_WIDTH,'));
  t('audit calls get a retry budget big enough to ride out a rate limit', S.includes('AUDIT_RETRIES=3'));
  t('the audit stops early once quota is gone', S.includes("throw Object.assign(new Error('API quota exhausted'),{name:'QuotaStop'})"));
  t('a QuotaStop is caught, not surfaced as a crash', (S.match(/if\(e\.name!=='QuotaStop'\)throw e;/g) || []).length === 2);
  t('quota exhaustion is explained, not just logged as an error', S.includes('only the optional item review was cut short'));
  // v15.7, from a real case run: the panel showed "FAIL — DISTRACTOR LENGTH" for an item the
  // log had already reported as successfully repaired. The verdict described text that no
  // longer existed. REPAIRED is neither PASS (never re-checked) nor FAIL (already rewritten).
  t('REPAIRED is a distinct status', S.includes("'PASS','FAIL','REPAIRED','REVIEW','N/A','ERROR'"));
  t('a repaired case item updates its stored verdict', S.includes("[r.key]:{status:'REPAIRED'"));
  t('a repaired worksheet item updates its stored verdict', S.includes("row.status='REPAIRED';"));
  t('REPAIRED admits it was not re-audited',
    (S.match(/rewritten after failing; not re-audited/g) || []).length === 2);
  t('REPAIRED renders as neither pass nor fail', S.includes("r.status==='REPAIRED'?'⟳'"));
  t('the panel counts repaired items separately', S.includes('{auditTotals.repaired} repaired'));
  t('the abort signal is threaded into the pool', S.includes('},ctl.signal);'));
  t('repaired items are re-validated', S.includes('allIssues=revalidate(parsed);'));
  t('answer-accuracy failures are excluded from repair', S.includes('r.status===\'FAIL\'&&!r.autoRepairable'));
  // The panel must report counts only — never a derived score, percentage, or band. Checked
  // structurally (no arithmetic over the totals) rather than by keyword, since the panel's
  // own copy legitimately contains the words "score" and "band" while disclaiming them.
  {
    const panel = spanFrom('{/* v15.6: item-quality audit panel', 'accuracyFails>0');
    t('audit panel does no arithmetic over the verdict counts',
      !panel.includes('Math.round') && !panel.includes('/auditRows.length') && !panel.includes('toFixed'));
    t('audit panel renders only status counts',
      panel.includes('{auditTotals.pass} pass') && panel.includes('{auditTotals.fail} fail') && panel.includes('{auditTotals.review} review'));
    t('audit panel states N/A is not a pass', panel.includes('N/A means the rubric does not apply'));
    t('audit panel disclaims the uncriterion-validated bands', panel.includes('never been criterion-validated'));
  }
}

/* ── 19. v15.6 — test-retest fixture (item 8) ── */
// The retest RUN costs live API calls and never executes here. These assertions validate the
// fixture's shape and its compatibility with the shipped audit path, so the fixture cannot
// rot silently and be discovered only after spending quota on a broken run.
section('v15.6 — retest fixture');
{
  if (!fs.existsSync('neia-fixture.json')) {
    t('neia-fixture.json exists', false);
  } else {
    const F = JSON.parse(fs.readFileSync('neia-fixture.json', 'utf8'));
    const byBand = b => F.items.filter(i => i.band === b);
    t('fixture holds 10 items', F.items.length === 10);
    t('2 sound items', byBand('sound').length === 2);
    t('2 seeded items', byBand('seeded').length === 2);
    t('6 borderline items — the band the published data says raters collapse on', byBand('borderline').length === 6);
    t('item ids are unique', new Set(F.items.map(i => i.id)).size === F.items.length);
    t('every seeded item names exactly one criterion',
      byBand('seeded').every(i => typeof i.seededCriterion === 'string' && i.seededCriterion.length > 0));
    t('the two seeded items target different criteria',
      new Set(byBand('seeded').map(i => i.seededCriterion)).size === 2);
    t('sound and borderline items name no seeded criterion',
      [...byBand('sound'), ...byBand('borderline')].every(i => i.seededCriterion === null));
    t('every item carries a note explaining its classification',
      F.items.every(i => typeof i.note === 'string' && i.note.length > 20));
    t('the fixture records that its reference standard is in-house',
      /authored in-house/.test(F.referenceStandardCaveat || ''));
    t('the fixture warns against comparing to published figures',
      /zero Gemini/.test(F.why || ''));
    t('borderline band explicitly has no expected verdict',
      /NO expected verdict/.test((F.bands || {}).borderline || ''));

    // Every fixture item must survive the real audit path, or the run fails at call time.
    let allEligible = true, allPayloadsClean = true, allHaveOneStage = true;
    for (const it of F.items) {
      const st = (it.case.stages || [])[0];
      if (!st || (it.case.stages || []).length !== 1) { allHaveOneStage = false; continue; }
      const q = (st.questions || [])[0];
      if (!AUDIT.caseIsGateEligible(q)) allEligible = false;
      const p = AUDIT.caseAuditPayload(it.case, 1, q);
      if (/fact-\d+/.test(p) || !p.includes('KEYED ANSWER:')) allPayloadsClean = false;
    }
    t('every fixture item is a single-stage case', allHaveOneStage);
    t('every fixture item is gate-eligible under the shipped scope check', allEligible);
    t('every fixture payload builds cleanly and leaks no fact IDs', allPayloadsClean);
    t('the seeded stem-clarity item really does contain a negative construction',
      /EXCEPT/.test(JSON.stringify(F.items.find(i => i.seededCriterion === 'Stem Clarity'))));
  }
  // The runner must exist but never EXECUTE from this harness or the app — it costs live
  // API calls. A documentation mention (e.g. in the HTML header comment) is fine; an
  // invocation is not.
  t('the retest runner exists', fs.existsSync('neia-retest.js'));
  t('the retest runner is never invoked from this harness',
    !/require\(['"].*neia-retest/.test(fs.readFileSync('latte-tests.js', 'utf8')));
  t('the app never invokes the retest runner', !/neia-retest\.js['"]\s*\)/.test(S));
  // v15.7: the first live run lost 4 of 30 calls to HTTP 429 and the analysis counted each
  // lost call as a rater who changed their mind, producing three bogus demotion candidates.
  // These pin the corrected accounting.
  {
    const R = fs.readFileSync('neia-retest.js', 'utf8');
    t('errors are excluded from consistency stats', R.includes("const ok = rs.filter(r => r.status !== 'ERROR');"));
    t('an item with under two answered runs is not judged', R.includes('const measurable = ok.length >= 2;'));
    t('accuracy denominators count answered runs only', R.includes('soundRuns += ok.length;') && R.includes('seededRuns += ok.length;'));
    t('demotion denominators skip items with under two answered runs', R.includes('if (ok.length < 2) continue;'));
    t('verdict instability and label drift are distinguished', R.includes('const critRuns = new Map(), labelDrift = [];'));
    t('label drift is explicitly not a demotion trigger', R.includes('NOT a demotion trigger'));
    t('429 and 5xx are retried with backoff', R.includes("if (resp.status !== 429 && resp.status < 500) break;"));
  }
  t('retest reports are gitignored', /neia-retest-report/.test(fs.readFileSync('.gitignore', 'utf8')));
}

/* ── 20. v15.7 — validateNCLEXWorksheet (B1c) ── */
section('v15.7 — worksheet validator');
{
  const V = WS.validateNCLEXWorksheet;
  // Minimal but structurally faithful worksheet builder.
  const mkQ = (n, opts) => `  ${n}. A client reports new dyspnea. Which action should the nurse take first?\n\n` +
    (opts || ['Elevate the head of the bed', 'Offer a glass of water', 'Dim the room lights', 'Raise the side rails'])
      .map((tx, i) => `     ${'ABCD'[i]}. ${tx}`).join('\n');
  const mkA = (n, whys, tier) => `  ${n}. ANSWER: A\n` +
    (whys || ['A', 'B', 'C', 'D']).map(l => `     Why ${l} is ${l === 'A' ? 'correct' : 'wrong'}: reasoning here. (Source: C${n})`).join('\n') +
    `\n     Strategy: airway and breathing come first.\n     Tags: NCLEX::RiskReduction | LATTE::Assess | Tier ${tier || 1} | Take Action`;
  const build = ({ n = 2, dist, whys, opts, truncateLast } = {}) => {
    const qs = Array.from({ length: n }, (_, i) => mkQ(i + 1, opts)).join('\n\n');
    let as = Array.from({ length: n }, (_, i) => mkA(i + 1, whys)).join('\n\n');
    if (truncateLast) as = as.replace(/\n\s*Strategy:[\s\S]*$/, '');
    return `PART 1 — CONCEPT INVENTORY\nC1 | dyspnea | ANCHOR: "x" |\n\n` +
      `PART 2 — SELECTION & AUDIT\nQ1 — cites [C1]\n\n` +
      `PART 3 — QUESTIONS\n${qs}\n\n` +
      `PART 4 — ANSWER KEY\n${as}\n\n` +
      `DISTRIBUTION: Tier [1:${dist === undefined ? n : dist.tier1} 2:0 3:0] | Types [MCQ:${dist === undefined ? n : dist.mcq} SATA:0 Ordering:0 Calc:0] | Concepts logged: 25`;
  };

  // The three cases the brief names explicitly.
  t('a correct worksheet produces zero errors', V(build({ n: 2 }), 2).filter(i => i.sev === 'error').length === 0);
  t('a DISTRIBUTION line disagreeing with its own items → error',
    has(V(build({ n: 2, dist: { mcq: 6, tier1: 2 } }), 2), 'does not match its own reported distribution', 'error'));
  t('a truncated PART 4 → error',
    has(V(build({ n: 2, truncateLast: true }), 2), 'appears truncated', 'error'));

  // Count contracts. buildBatchBlock overrides the prompt's default of 10, so the batch size
  // the app asked for is the contract — not the constant 10.
  t('PART 3 short of the batch count → error', has(V(build({ n: 2 }), 3), 'PART 3 has 2 numbered question(s); this batch asked for 3', 'error'));
  t('a batch of 2 validated against 2 is clean', V(build({ n: 2 }), 2).filter(i => i.sev === 'error').length === 0);

  // Why-line coverage — the prompt promises one per option, correct and incorrect alike.
  t('a missing Why line → error', has(V(build({ n: 1, whys: ['A', 'B', 'C'] }), 1), 'option D has no "Why D is…" line', 'error'));
  t('all Why lines present → no such error', !has(V(build({ n: 1 }), 1), 'has no "Why'));

  // Structural gaps.
  t('empty input → error', has(V('', 1), 'Worksheet is empty', 'error'));
  t('a missing PART 4 → error', has(V('PART 1 — x\nC1 | a |\n\nPART 2 — y\n\nPART 3 — z\n' + mkQ(1), 1), 'PART 4 is missing', 'error'));
  t('no DISTRIBUTION line → warn, not error', has(V(build({ n: 1 }).replace(/\n\nDISTRIBUTION:[\s\S]*$/, ''), 1), 'No DISTRIBUTION line', 'warn'));

  // Reuses the shared linters rather than reimplementing them.
  t('terminology lint runs over worksheet stems',
    has(V(build({ n: 1, opts: ['Ask the patient to sit up', 'b option here', 'c option here', 'd option here'] }), 1), 'terminology', 'warn'));
  t('MCQ heuristics run over worksheet items',
    has(V(build({ n: 1, opts: ['word '.repeat(30), 'short one', 'short two', 'short three'] }), 1), 'option length', 'warn'));
  t('every heuristic/terminology finding stays warn-tier',
    V(build({ n: 1, opts: ['Ask the patient to sit up', 'b option', 'c option', 'd option'] }), 1)
      .filter(i => /terminology|option length/.test(i.msg)).every(i => i.sev === 'warn'));

  // Parsers.
  t('ngParseItem detects MCQ', WS.ngParseItem({ num: 1, text: mkQ(1) }).type === 'MCQ');
  t('ngParseItem detects SATA from the stem',
    WS.ngParseItem({ num: 1, text: '  1. (Select all that apply) Which apply?\n\n     A. a\n     B. b\n     C. c\n     D. d\n     E. e' }).type === 'SATA');
  t('ngParseItem detects Ordering', WS.ngParseItem({ num: 1, text: '  1. Place in order.\n\n     ___ step one\n     ___ step two' }).type === 'Ordering');
  t('ngParseItem detects Calculation', WS.ngParseItem({ num: 1, text: '  1. How many mL?\n\n     Answer: __________ mL' }).type === 'Calculation');
  t('ngParseItem captures four options', WS.ngParseItem({ num: 1, text: mkQ(1) }).options.length === 4);
  t('ngParseKeyItem captures the Why labels', WS.ngParseKeyItem({ num: 1, text: mkA(1) }).whyLabels.size === 4);
  t('ngParseKeyItem captures the tier', WS.ngParseKeyItem({ num: 1, text: mkA(1, null, 2) }).tier === 2);
  t('ngParseDistribution reads the Types counts', WS.ngParseDistribution('Types [MCQ:6 SATA:2 Ordering:1 Calc:1]').types.mcq === 6);
  t('ngParseDistribution on an absent line reports not present', WS.ngParseDistribution('').present === false);
  // v15.7, from a real run: the model emitted the distribution as prose, both regexes missed,
  // and the self-report check silently disabled itself while reporting 0 errors.
  {
    const prose = 'Tier 1: 6 (Q1, Q3, Q4), Tier 2: 3 (Q2, Q6), Tier 3: 1 (Q8).';
    const d = WS.ngParseDistribution(prose);
    t('a prose distribution parses no counts', !Object.keys(d.types).length && !Object.keys(d.tiers).length);
    const found = V(build({ n: 1 }).replace(/DISTRIBUTION:[^\n]*/, 'DISTRIBUTION: ' + prose), 1);
    t('a malformed DISTRIBUTION line warns instead of silently skipping',
      has(found, 'not in the required', 'warn'));
    t('a malformed DISTRIBUTION line is a warning, not an error',
      !found.some(i => i.sev === 'error' && /DISTRIBUTION/.test(i.msg)));
  }
  t('a well-formed DISTRIBUTION line does not trip the malformed warning',
    !has(V(build({ n: 2 }), 2), 'not in the required'));
}
/* ── 20b. v15.7 — fact-coverage resolution (real-run bug) ── */
section('v15.7 — coverage resolution');
{
  const NG = new Function(
    spanFrom('function ngConceptFactMap(', 'function ngParseCited(').replace(/function ngParseCited\($/, '') +
    '\n;return {ngConceptFactMap,ngCitedFactIds};'
  )();
  const p1 = 'C1 | Digoxin hold parameter [fact-42] | ANCHOR: "hold if under 60" |\n' +
             'C2 | Burn fluid resuscitation [fact-7] | ANCHOR: "Parkland" |\n' +
             'C3 | Unlinked concept | ANCHOR: "x" |';
  t('concept map links C-numbers to fact IDs', NG.ngConceptFactMap(p1).get('C1')[0] === 'fact-42');
  t('a concept with no fact ID is not mapped', !NG.ngConceptFactMap(p1).has('C3'));
  // The real failure: Parts 3/4 cite C-numbers, never fact IDs, so counting fact-N found none.
  const p4 = '  1. ANSWER: B\n     Why B is correct: reasoning. (Source: C1 — "hold if under 60")\n     Why A is wrong: no. (Source: C2)';
  t('C-number citations resolve to fact IDs', (() => {
    const s = NG.ngCitedFactIds(p1, '', p4);
    return s.has('fact-42') && s.has('fact-7');
  })());
  t('direct fact-N citations still count', NG.ngCitedFactIds(p1, 'see fact-99', '').has('fact-99'));
  t('an unmapped C-number contributes nothing', NG.ngCitedFactIds(p1, '', '(Source: C3)').size === 0);
  t('a stray C-number in clinical prose is ignored unless it is a logged concept',
    NG.ngCitedFactIds(p1, 'injury at C7 of the spine', '').size === 0);
  t('coverage uses the resolver, not the raw fact-ID scan',
    S.includes('const mentioned=ngCitedFactIds(P.p1,P.p3,P.p4);'));
}

/* ── 20b2. v15.8 — regressions found by the first live case run ── */
section('v15.8 — live-run regressions');
{
  // "7,000 mL" tokenized as "000 mL": a token that cannot match any source text, so a
  // correctly grounded Parkland rationale was reported as fabricated on every run.
  const tok = s => { CASE.CASE_CLINICAL_TOKEN_RE.lastIndex = 0; return s.match(CASE.CASE_CLINICAL_TOKEN_RE) || []; };
  t('a comma-grouped value tokenizes whole', tok('Give 7,000 mL over 24h')[0] === '7,000 mL');
  t('the truncated "000 mL" token is gone', !tok('Give 7,000 mL over 24h').includes('000 mL'));
  t('plain values are unaffected', tok('Give 7000 mL')[0] === '7000 mL');
  t('multi-comma values tokenize whole', tok('total 1,234,567 mL')[0] === '1,234,567 mL');
  t('a comma-grouped value still matches its uncomma-ed source', (() => {
    const idx = new Map([['f1', { condition: {}, fact: { text: 'Give 7000 mL over 24 hours.', sourceQuote: '' } }]]);
    const i = []; CASE.caseAuditTextValues('Infuse 7,000 mL total', ['f1'], idx, 'X', i, 'direct');
    return i.length === 0;
  })());

  // A Calculation answer is the computed value, not an option label.
  {
    const q = { id: 'c1', type: 'Calculation', stem: 'How many mL?',
      options: [{ label: 'Answer', text: '____ mL' }], correctAnswers: ['7000'],
      rationales: [{ option: 'Answer', text: 'x', supportType: 'direct', factIds: ['fact-a'] }] };
    const found = V({ stages: [stage(1, [q])] }, 'HF');
    t('a Calculation answer is not checked against option labels',
      !has(found, 'is not among the options'));
  }
  // Ordering and MCQ keep the check.
  t('an MCQ answer outside its options is still an error',
    has(V({ stages: [stage(1, [q({ type: 'MCQ', options: [{ label: 'A' }], correctAnswers: ['Z'],
      rationales: [{ option: 'A', text: '', supportType: 'direct', factIds: ['fact-a'] }] })])] }, 'HF'),
      'is not among the options', 'error'));
}

/* ── 20b3. v15.8 — decimal equivalence and timing-warning volume ── */
section('v15.8 — live case-run regressions');
{
  const n = CASE.caseNormalizeClinical;
  // "8.0 g/dL" vs a source saying "8 g/dL" is the same value. It was reported as fabricated,
  // while the terminology linter simultaneously asked for the shorter form -- so following
  // the style rule silently decided whether grounding passed.
  t('a trailing zero is equivalent to none', n('8.0 g/dL') === n('8 g/dL'));
  t('a trailing zero on a whole number is equivalent', n('120.0 bpm') === n('120 bpm'));
  t('a redundant trailing zero on a decimal is equivalent', n('0.50 mg') === n('0.5 mg'));
  t('a comma-grouped decimal canonicalises too', n('7,000.50 mL') === n('7000.5 mL'));
  // Genuinely different values must stay different.
  t('8.5 and 8 remain distinct', n('8.5 g/dL') !== n('8 g/dL'));
  t('0.5 and 5 remain distinct', n('0.5 mg') !== n('5 mg'));
  t('10 is not collapsed to 1', n('10 mg') !== n('1 mg'));
  t('7.35 keeps its precision', n('7.35') === '7.35');
  {
    const idx = new Map([['f1', { condition: {}, fact: { text: 'Hemoglobin of 8 g/dL indicates anemia.', sourceQuote: '' } }]]);
    const i = []; CASE.caseAuditTextValues('Hemoglobin is 8.0 g/dL', ['f1'], idx, 'X', i, 'direct');
    t('a trailing-zero value now matches its source and does not error', i.length === 0);
  }
  {
    const idx = new Map([['f1', { condition: {}, fact: { text: 'Hemoglobin of 8 g/dL indicates anemia.', sourceQuote: '' } }]]);
    const i = []; CASE.caseAuditTextValues('Hemoglobin is 9.4 g/dL', ['f1'], idx, 'X', i, 'direct');
    t('a genuinely different value still errors', has(i, 'does not appear', 'error'));
  }
}
{
  // One finding per question+fact. A question whose options all cite the same unrevealed
  // fact reported it once per rationale -- five times for one fact in a real run.
  const rat = ids => ids.map((f, k) => ({ option: 'ABCD'[k], text: '', supportType: 'direct', factIds: [f] }));
  const cs = { stages: [
    { stageNumber: 1, data: [], questions: [{ id: 'q1', rationales: rat(['fact-9', 'fact-9', 'fact-9', 'fact-9']) }] },
    { stageNumber: 2, data: [{ availability: 'revealed', factIds: ['fact-9'] }], questions: [] }] };
  const found = CASE.validateStageTiming(cs);
  t('a fact cited by every option is reported once', found.length === 1);
  t('the single finding still names the fact', /fact-9/.test(found[0].msg));
  // Distinct facts must still each be reported.
  const cs2 = { stages: [
    { stageNumber: 1, data: [], questions: [{ id: 'q1', rationales: rat(['fact-9', 'fact-8']) }] },
    { stageNumber: 2, data: [{ availability: 'revealed', factIds: ['fact-9', 'fact-8'] }], questions: [] }] };
  t('two distinct unrevealed facts are both reported', CASE.validateStageTiming(cs2).length === 2);
  // The same fact in a different question is a separate finding.
  const cs3 = { stages: [
    { stageNumber: 1, data: [], questions: [
      { id: 'q1', rationales: rat(['fact-9', 'fact-9']) },
      { id: 'q2', rationales: rat(['fact-9']) }] },
    { stageNumber: 2, data: [{ availability: 'revealed', factIds: ['fact-9'] }], questions: [] }] };
  t('the same fact in another question is reported separately', CASE.validateStageTiming(cs3).length === 2);
}

/* ── 20b4. v15.8 — sizing to the fact pool, citation robustness ── */
section('v15.8 — grounding capacity');
{
  const SF=new Function(spanFrom('const CASE_FACTS_PER_QUESTION=','\n}')+'\n;return caseFactSufficiency;')();
  const facts=n=>Array.from({length:n},(_,i)=>({latteBucket:['Look','Assess','Tests','Treatments'][i%4]}));
  const ratio=r=>r.warnings.find(w=>/supports about/.test(w))||'';
  // The real runs: 6 facts/12 questions, 8/12, 13/12 — all far under the NCLEX generator's
  // own factsPerQ default of 3.
  t('8 facts for 12 questions warns about capacity',!!ratio(SF(facts(8),12)));
  t('the warning names both the supply and the request',
    ratio(SF(facts(8),12)).includes('8 fact(s) supports about 4 grounded question(s), but 12 were requested'));
  t('the warning suggests a shape that actually fits',
    ratio(SF(facts(8),12)).includes('Try 2 stage(s) × 2 question(s)'));
  t('the warning points at Tier 2/3 as the other lever',ratio(SF(facts(8),12)).includes('Tier 2/3'));
  t('a sufficient pool raises no capacity warning',!ratio(SF(facts(24),12)));
  t('one short does warn',!!ratio(SF(facts(22),12)));
  // Omitting the count keeps the old behaviour, so existing callers are unaffected.
  t('no requested count means no capacity warning',!ratio(SF(facts(4))));
  t('the suggested shape is never zero',(()=>{
    const w=ratio(SF(facts(1),12));
    return w.includes('Try 1 stage(s) × 1 question(s)');})());
  t('the thin-pool bucket warnings still fire',
    SF([{latteBucket:'Look'}],1).warnings.some(w=>/diagnostic/.test(w)));
}
{
  const PC=new Function(spanFrom('function ngParseCited(','\n}')+'\n;return ngParseCited;')();
  t('bracketed citations still parse',PC('Q1 — cites [C1, C2, C3]').join(',')==='C1,C2,C3');
  // The recurring fallback: three of five batches in one run could not parse PART 2.
  t('bracket-less citations now parse',PC('Q1 — cites C1, C2, C3').join(',')==='C1,C2,C3');
  t('mixed forms across lines both parse',
    PC('Q1 — cites [C1, C2]'+String.fromCharCode(10)+'Q2 — cites C3, C4').join(',')==='C1,C2,C3,C4');
  t('surrounding prose is not scooped up',
    PC('Q1 — cites C1, C2 — one anchor per option, correct AND distractors.').join(',')==='C1,C2');
  t('a line with no citation yields nothing',PC('Q1 — no anchors logged').length===0);
  t('duplicates collapse',PC('cites C1, C1, C2').join(',')==='C1,C2');
}
{
  // A starved pool must reduce the ask, not let the model invent the difference.
  t('the batch size shrinks to what the facts can ground',S.includes('reducing this batch from'));
  t('batch size is reassignable',S.includes('let size=Math.min(batchSize,targetCount-produced);'));
  t('the shrink is driven by factsPerQ, not a new constant',
    S.includes('Math.floor(alloc.targets.length/Math.max(1,factsPerQ))'));
  const cp=spanFrom('function caseBuildPrompt(','`;\n}','function caseBuildPrompt(');
  t('the prompt permits a declared body weight',cp.includes('BODY WEIGHT is the one clinical value you may choose'));
  t('the weight must be presented as cited case data',cp.includes('present it in the stage "data" array'));
  t('the weight allowance does not open the door to other values',
    cp.includes('never invent any other laboratory or vital-sign value this way'));
}

/* ── 20b5. v15.8 — rationales may reference the case's own presented data ── */
section('v15.8 — presented-data grounding');
{
  // Three consecutive live runs errored on this: a hemoglobin ACCEPTED as case data was
  // then rejected in every rationale that reasoned about it, because each rationale was
  // audited against its own fact subset. A datum cites the facts that establish a value;
  // a rationale cites the facts that support its reasoning.
  const FI=new Map([
    ['f-hgb',{condition:{},fact:{text:'Hemoglobin of 8 g/dL indicates severe anemia.',sourceQuote:''}}],
    ['f-tired',{condition:{},fact:{text:'Fatigue is a hallmark of anemia.',sourceQuote:''}}],
    ['f-none',{condition:{},fact:{text:'Monitor the client closely.',sourceQuote:''}}]]);
  const datum=(label,value,ids)=>({label,value,supportType:'direct',availability:'revealed',factIds:ids});
  const build=(data,ratText,ratIds)=>({condition:'Anemia',title:'t',patient:{background:''},
    stages:[{stageNumber:1,narrative:'',data,questions:[{id:'s1q1',type:'MCQ',stem:'Which finding is most concerning?',
      options:[{label:'A',text:'a'},{label:'B',text:'b'}],correctAnswers:['A'],
      rationales:[{option:'A',text:ratText,supportType:'direct',factIds:ratIds},
                  {option:'B',text:'Other reasoning.',supportType:'direct',factIds:['f-tired']}],
      cjmmSkill:'Analyze Cues'}]}],debrief:{}});
  const run=cs=>CASE.validateCaseStudy(cs,FI,new Set(['f-hgb','f-tired','f-none']),'Anemia');

  // The reported case: the datum is grounded, the rationale reasons about it citing a
  // DIFFERENT fact. Previously an error; now accepted.
  {
    const found=run(build([datum('Hemoglobin','8 g/dL',['f-hgb'])],'Concerning because the hemoglobin is 8 g/dL.',['f-tired']));
    t('a rationale may reference a validated datum value',!has(found,'does not appear','error'));
    t('that case has no errors at all',!found.some(i=>i.sev==='error'));
  }
  // A value no datum presents is still fabrication.
  {
    const found=run(build([datum('Hemoglobin','8 g/dL',['f-hgb'])],'Concerning because potassium is 2.4 mEq/L.',['f-tired']));
    t('a value no datum presents is still an error',has(found,'does not appear','error'));
  }
  // No laundering: a datum that failed its own audit contributes nothing.
  {
    const found=run(build([datum('Potassium','2.4 mEq/L',['f-none'])],'Because potassium is 2.4 mEq/L.',['f-tired']));
    t('an ungrounded datum still errors on its own',has(found,'datum','error'));
    t('an ungrounded datum cannot launder a rationale value',
      found.filter(i=>i.sev==='error'&&/rationale/.test(i.msg)).length===1);
  }
  // Data grounding itself is unchanged.
  {
    const found=run(build([datum('Hemoglobin','8 g/dL',['f-hgb']),datum('Potassium','2.4 mEq/L',['f-none'])],'Fatigue is expected.',['f-tired']));
    t('a second ungrounded datum still errors even when another datum is valid',
      has(found,'value "2.4 mEq/L" does not appear','error'));
  }
  // Gathered across all stages, so a rationale is not penalised for a later finding.
  {
    const cs=build([],'Concerning because the hemoglobin is 8 g/dL.',['f-tired']);
    cs.stages.push({stageNumber:2,narrative:'',data:[datum('Hemoglobin','8 g/dL',['f-hgb'])],questions:[]});
    t('a value presented in a later stage still counts as presented',
      !has(CASE.validateCaseStudy(cs,FI,new Set(['f-hgb','f-tired','f-none']),'Anemia'),'does not appear','error'));
  }
  // The direct-call contract: without the set, behaviour is exactly as before.
  {
    const i=[];CASE.caseAuditTextValues('Hemoglobin is 8 g/dL',['f-tired'],FI,'X',i,'direct');
    t('omitting the presented set preserves the old behaviour',has(i,'does not appear','error'));
    const j=[];CASE.caseAuditTextValues('Hemoglobin is 8 g/dL',['f-tired'],FI,'X',j,'direct',new Set(['8g']));
    t('supplying the presented set clears it',j.length===0);
  }
}

/* ── 20c. v15.8 — the repair path (previously ZERO coverage) ── */
// This is the code that rewrites the user's worksheet in place. It shipped in v15.7 with no
// assertions at all; one round-trip test would have caught the $-injection bug fixed in v15.8.
section('v15.8 — worksheet repair path');
{
  const fixed = {
    stem: 'A client reports chest pain. Which action is first?',
    options: [{ label: 'A', text: 'Obtain vital signs' }, { label: 'B', text: 'Offer water' },
              { label: 'C', text: 'Dim the lights' }, { label: 'D', text: 'Raise the rails' }],
    correctLabel: 'A',
    rationales: [{ label: 'A', text: 'Assess first.', source: 'C1' }, { label: 'B', text: 'No.', source: 'C2' }],
  };
  const qb = WS.ngRenderQuestionBlock(3, fixed);
  const kb = WS.ngRenderKeyBlock(3, fixed, '     Strategy: airway first.', '     Tags: NCLEX::RiskReduction | Tier 1 | Take Action');

  t('rendered question block is numbered', /^ {2}3. /.test(qb));
  t('rendered question block carries every option', ['A','B','C','D'].every(l => qb.includes(l + '. ')));
  t('rendered key block states the answer', kb.includes('3. ANSWER: A'));
  t('rendered key block marks the key correct and the rest wrong',
    kb.includes('Why A is correct:') && kb.includes('Why B is wrong:'));
  // Carried verbatim so a repair cannot invalidate the DISTRIBUTION line the worksheet
  // already asserted — tier, CJMM and type all live in the Tags line.
  t('Strategy line is carried through verbatim', kb.includes('Strategy: airway first.'));
  t('Tags line is carried through verbatim', kb.includes('Tags: NCLEX::RiskReduction | Tier 1 | Take Action'));

  // ── The v15.8 regression: $-sequences in model-generated text ──
  const evil = {
    stem: "Dose costs $& per vial and $' per box",
    options: [{ label: 'A', text: 'Give $1 tablet' }, { label: 'B', text: 'Hold $$ dose' },
              { label: 'C', text: 'Offer water' }, { label: 'D', text: 'Dim lights' }],
    correctLabel: 'A', rationales: [{ label: 'A', text: 'ok', source: 'C1' }],
  };
  {
    const NL = String.fromCharCode(10);
    const sec3 = ['  1. First question', '', '     A. one', '     B. two'].join(NL);
    const doc = ['PART 3 — QUESTIONS', sec3, '', 'PART 4 — ANSWER KEY', '  1. ANSWER: A'].join(NL);
    const spliced = WS.ngSpliceSection(doc, sec3, WS.ngRenderQuestionBlock(1, evil));
    t('a $& in repaired text is inserted literally, not expanded', spliced.includes('costs $& per vial'));
    t('a $-quote in repaired text does not duplicate the document tail',
      spliced.includes("$' per box") && spliced.split('PART 4').length === 2);
    t('$$ and $1 survive untouched', spliced.includes('Hold $$ dose') && spliced.includes('Give $1 tablet'));
    t('the splice does not grow the document unboundedly', spliced.length < doc.length * 3);
  }
  // Bounded search: an empty section must never prepend, as replace('') would have.
  t('an empty section leaves the document untouched', WS.ngSpliceSection('abc', '', 'XXX') === 'abc');
  t('an absent section leaves the document untouched', WS.ngSpliceSection('abc', 'zzz', 'XXX') === 'abc');
  t('a present section is replaced exactly once',
    WS.ngSpliceSection('a-MID-b-MID-c', 'MID', 'X') === 'a-X-b-MID-c');

  {
    const NL = String.fromCharCode(10);
    const sec = ['  1. Q one', '     A. a', '', '  2. Q two', '     A. b'].join(NL);
    t('splicing a located block returns modified text',
      (WS.ngSpliceBlock(sec, 2, '  2. REPLACED') || '').includes('REPLACED'));
    t('splicing leaves the untouched block intact',
      (WS.ngSpliceBlock(sec, 2, '  2. REPLACED') || '').includes('Q one'));
    // Fail closed: the caller leaves the worksheet alone rather than splicing the wrong item.
    t('an absent block number returns null', WS.ngSpliceBlock(sec, 9, 'X') === null);
    // v15.8: a repeated number can no longer produce two blocks — ngSplitNumbered only
    // starts one where the number ascends — so this guard is unreachable via duplicate
    // NUMBERS. It still protects the indexOf path against two blocks of identical TEXT,
    // and the absent-number case above still exercises the null return.
    t('a repeated number now yields one block and splices safely',
      WS.ngSpliceBlock(['  1. dup', '', '  1. dup'].join(NL), 1, '  1. X') === '  1. X');
    t('the ambiguity guard is still present in the source',
      S.includes('if(target.length!==1)return null;'));
  }

  {
    const g = WS.nclexGateItems([
      { num: 1, type: 'MCQ', options: [{}, {}, {}, {}] },
      { num: 2, type: 'SATA', options: [{}, {}, {}, {}, {}] },
      { num: 3, type: 'Ordering', options: [{}, {}, {}] },
      { num: 4, type: 'MCQ', options: [{}, {}] },
    ]);
    t('worksheet gate selects single-best-answer MCQ only',
      g.filter(x => x.eligible).map(x => x.num).join(',') === '1');
    t('worksheet gate still enumerates the rest as N/A candidates', g.length === 4);
  }

  {
    const rp = WS.ngBuildRepairPrompt({ item: { stem: 's', options: [{ label: 'A', text: 'a' }] },
      criterion: 'DISTRACTOR LENGTH', keyBlock: '  1. ANSWER: A' });
    t('repair prompt names the failing criterion', rp.includes('FAILED: DISTRACTOR LENGTH'));
    t('repair prompt forbids the shortest-key workaround', rp.includes('making the key the shortest option'));
    t('repair prompt pins the option labels', rp.includes('Keep the same option labels'));
  }
}

/* ── 20d. v15.8 — Phase 2: paParseTiers, pdfLayoutText, Anki edit lint ── */
section('v15.8 — Phase 2 fixes');
{
  const PA=new Function(spanFrom('function paParseTiers(','\n}')+'\n;return paParseTiers;')();
  const doc=a=>a.join(String.fromCharCode(10));
  // The regression: `##?` matched 1-2 hashes, so `### TIER 2` broke the lookahead and
  // TIER 1 swallowed the rest of the document.
  {
    const r=PA(doc(['## TIER 1','one','### TIER 2','two','### TIER 3','three']));
    t('a 3-hash TIER 2 heading no longer lets TIER 1 swallow the document',r.tier1==='one');
    t('3-hash TIER 2 is captured',r.tier2==='two');
    t('3-hash TIER 3 is captured',r.tier3==='three');
  }
  {
    const r=PA(doc(['## 🔴 TIER 1','a','## 🟡 TIER 2','b','## 🔵 TIER 3','c','## Study Strategy','s','*Audit: ok*']));
    t('emoji headings still parse',r.tier1==='a'&&r.tier2==='b'&&r.tier3==='c');
    t('strategy is captured',r.strategy==='s');
    t('audit footer is captured and destarred',r.audit==='ok');
    t('the audit line does not leak into strategy',!r.strategy.includes('Audit'));
  }
  t('no tier headings at all returns null',PA(doc(['just prose','more prose']))===null);
  {
    const r=PA(doc(['# TIER 1','x','# TIER 2','y']));
    t('a missing TIER 3 does not corrupt the others',r.tier1==='x'&&r.tier2==='y'&&r.tier3==='');
  }
}
{
  const PL=new Function(spanFrom('function pdfLayoutText(','\n}')+'\n;return pdfLayoutText;')();
  // Rotated text: transform[0] is 0, and ?? does not default 0, so fontSize became 0 and
  // every y-delta beat the 0.5*fontSize line threshold — a newline per glyph.
  const rotated={items:[
    {str:'AB',transform:[0,12,-12,0,10,700],width:12},
    {str:'CD',transform:[0,12,-12,0,10,688],width:12}]};
  const out=PL(rotated);
  t('rotated text does not split every glyph onto its own line',out.split(String.fromCharCode(10)).length<=2);
  t('rotated text keeps its content',out.includes('AB')&&out.includes('CD'));
  const upright={items:[
    {str:'Hello',transform:[12,0,0,12,10,700],width:30},
    {str:'World',transform:[12,0,0,12,10,680],width:30}]};
  t('upright text still breaks lines on a real y change',PL(upright).split(String.fromCharCode(10)).length===2);
  t('the layout loop exists in exactly one place',
    S.split('lastWidth=item.width??').length-1===1);
}
{
  t('Anki edits recompute lint',S.includes('next.lint=lintAnkiCard(next);'));
  t('Anki edits recompute the abbreviation scan',S.includes("ankiUnsafeAbbrevScan(next.text,'Text',found);"));
  t('edits retain manual selection and derive structural eligibility',S.includes('const text=ankiExportText(cards,batch,current,tierFilter,ankiHeader,includeSources);')&&!S.includes('if(hadLint&&!next.lint.length)next.keep=true;'));
  t('abbrev findings never flip keep',!S.includes('next.abbrev.length)next.keep'));
}

/* ── 20e. v15.8 — Phase 3: numbering cap, PDF document release ── */
section('v15.8 — Phase 3 hardening');
{
  const SN=new Function(spanFrom('function ngSplitNumbered(','\n}')+'\n;return ngSplitNumbered;')();
  const doc=a=>a.join(String.fromCharCode(10));
  // The parser no longer encodes the UI's batch-size bound. Question 26+ used to be
  // appended to question 25's block with no error.
  {
    const blocks=SN(doc(['  24. twenty four','  25. twenty five','  26. twenty six','  30. thirty']));
    t('question 26 is its own block, not merged into 25',blocks.length===4);
    t('numbers past the old 25 cap are parsed',blocks.map(b=>b.num).join(',')==='24,25,26,30');
  }
  t('three-digit numbering parses',SN(doc(['  100. a hundred'])).map(b=>b.num).join(',')==='100');
  // Guard the other direction: a four-digit token is not a question number.
  t('a four-digit token is not treated as a question number',
    SN(doc(['  1234. not a question'])).length===0);
  // The live-run regression: PART 4's entry for an Ordering question carries its own
  // numbered step list (the prompt asks for "one line per step"), restarting at 1 at the
  // same indentation. Those steps parsed as new question blocks, and the caller's
  // new Map(blocks.map(...)) keeps the LAST match — so an ordering step replaced question
  // 1's real answer entry. Reported as 14 entries for 10 questions, Q1 with no ANSWER line.
  {
    const p4 = doc([
      '  1. ANSWER: B', '     Why B is correct: reasoning.',
      '  2. ANSWER: A', '     Why A is correct: reasoning.',
      '  9. ANSWER: C, A, D, B',
      '    1. C — first because airway.', '    2. A — then breathing.',
      '    3. D — then circulation.', '    4. B — last.',
      '  10. ANSWER: D', '     Why D is correct: reasoning.']);
    const blocks = SN(p4);
    t('an ordering step list does not inflate the block count', blocks.length === 4);
    t('only real question numbers become blocks', blocks.map(b => b.num).join(',') === '1,2,9,10');
    const byNum = new Map(blocks.map(k => [k.num, k]));
    t('question 1 keeps its own ANSWER line', /ANSWER: B/.test(byNum.get(1).text));
    t('question 1 keeps its Why line', /Why B is correct/.test(byNum.get(1).text));
    t('the ordering steps stay inside their own entry', /first because airway/.test(byNum.get(9).text));
    t('the entry after the step list is unaffected', /ANSWER: D/.test(byNum.get(10).text));
  }
  // Ascending is the rule, so a repeated or descending number is content, not a new block.
  t('a repeated question number does not start a new block',
    SN(doc(['  1. first', '  1. not a new question'])).length === 1);
  t('a descending number does not start a new block',
    SN(doc(['  5. fifth', '  2. not a new question'])).length === 1);
  t('gaps in numbering are still honoured',
    SN(doc(['  1. one', '  4. four', '  7. seven'])).map(b => b.num).join(',') === '1,4,7');
  t('non-numbered lines still attach to the current block',
    SN(doc(['  1. stem','     A. option'])).length===1);
}
{
  t('PDF documents are tracked for bulk release',S.includes('const _pdfLiveDocs=new Set();'));
  // v15.14: the v15.8 unmount cleanup was UNREACHABLE. App keeps all six tools mounted for
  // the whole session (display:contents/none), so neither effect could ever fire, and
  // destroyAllPdfDocs was cross-tool global besides — had either component unmounted it
  // would have destroyed the other's open documents. Deleted. What actually releases a
  // document is destroyPdfDoc on the x / Clear buttons, and that had the real leak: it
  // destroyed the proxy but never removed it from the Set.
  t('the unreachable unmount cleanup is gone',
    !S.includes('destroyAllPdfDocs') && !S.includes('_pdfLiveDocs.clear();'));
  t('destroying one document prunes it from the live set',
    S.includes('p.then(pdf=>{_pdfLiveDocs.delete(pdf);return pdf.destroy();}).catch(()=>{});'));
  t('the live set is still populated on load, so the prune has something to remove',
    S.includes('.then(doc=>{_pdfLiveDocs.add(doc);return doc;})'));
  t('the cache stays a WeakMap so Files are never pinned',S.includes('const _pdfDocCache=new WeakMap();'));
}

/* ── v15.16 — Anki text retrieval, advisory-only checks and export isolation ── */
section('v15.16 — Anki preview and style checks');
{
  // Extract through the LAST pure helper; exercise the filter below so a shortened
  // extraction cannot silently omit its implementation.
  const source=spanFrom('function parseAnkiClozes(value)', 'function AnkiStyleBadges');
  const helpers=source.slice(0,source.lastIndexOf('function AnkiStyleBadges'));
  const A=new Function(helpers+';return {ankiPreviewText,ankiStyleWarnings,ankiReviewFilter,lintAnkiCard};')();
  const note=(text,id='n1',tier=1)=>({id,text,extra:'Source-stated explanation',tags:'Nursing::LATTE::Look Condition::Example Tier::'+tier,pipeCount:2,keep:true,factIds:['fact-1']});
  const codes=c=>A.ankiStyleWarnings(c).map(x=>x.code);
  const two='[Example] Pattern: {{c1::alpha}} then {{c2::beta}}';
  t('preview hides only c1 and leaves c2 answer visible',A.ankiPreviewText(two,1)==='[Example] Pattern: [...] then beta');
  t('preview switches to c2 without hiding c1',A.ankiPreviewText(two,2)==='[Example] Pattern: alpha then [...]');
  t('reveal shows both answers without cloze syntax',A.ankiPreviewText(two,2,true)==='[Example] Pattern: alpha then beta');
  t('all same-number gaps hide together',A.ankiPreviewText('{{c1::alpha}} + {{c1::beta}}',1)==='[...] + [...]');
  t('cloze hints are visible while answers are hidden',A.ankiPreviewText('{{c1::alpha::first letter}}',1)==='[first letter]');
  t('revealed hints are replaced with the answer',A.ankiPreviewText('{{c1::alpha::first letter}}',1,true)==='alpha');
  t('uppercase cloze markers and numeric indices work',A.ankiPreviewText('{{C3::gamma}}',3)==='[...]');
  t('plain text remains unchanged',A.ankiPreviewText('Plain <text> & units',1)==='Plain <text> & units');
  t('preview does not interpret HTML or alter clinical comparators',A.ankiPreviewText('Threshold {{c1::<5 & >2}}',1,true)==='Threshold <5 & >2');
  t('empty preview input is safe',A.ankiPreviewText(null,1)==='');
  const good=note('[Example] Finding: {{c1::an unusual finding}}');
  const weak=note('[Example] Finding: an {{c1::unusual finding}}','n2',2);
  t('article outside the cloze is flagged',codes(weak).includes('article-clue'));
  t('article inside the cloze avoids the clue warning',!codes(good).includes('article-clue'));
  t('a and uppercase AN are detected',codes(note('A {{c1::finding}}')).includes('article-clue')&&codes(note('AN {{c1::answer}}')).includes('article-clue'));
  t('article detection does not match word suffixes',!codes(note('Scan {{c1::finding}}')).includes('article-clue'));
  t('a consistent anchor and label avoid the anchor warning',!codes(good).includes('front-anchor'));
  t('missing retrieval label is advisory',codes(note('[Example] {{c1::finding}}')).includes('front-anchor'));
  t('a diagnosis-retrieval exception is explained by the warning',A.ankiStyleWarnings(note('Findings suggest {{c1::Example}}')).some(x=>x.code==='front-anchor'&&x.msg.includes('reveal the answer')));
  t('independent indices do not trigger a same-gap warning',!codes(note(two)).includes('shared-gaps'));
  t('same-index gaps identify the index needing review',A.ankiStyleWarnings(note('[Example] Pair: {{c2::alpha}} + {{c2::beta}}')).some(x=>x.code==='shared-gaps'&&x.msg.startsWith('c2:')));
  const fifteen=note('[Example] Finding: '+Array(12).fill('context').join(' ')+' {{c1::answer}}');
  const sixteen=note('[Example] Finding: '+Array(13).fill('context').join(' ')+' {{c1::answer}}');
  t('15 visible front words do not trigger the soft warning',!codes(fifteen).includes('long-front'));
  t('16 visible front words trigger the soft warning',codes(sixteen).includes('long-front'));
  t('a long hidden answer counts as one gap',!codes(note('[Example] Finding: {{c1::'+Array(25).fill('word').join(' ')+'}}')).includes('long-front'));
  t('word check includes other visible cloze answers',codes(note('[Example] Pattern: {{c1::alpha}} {{c2::'+Array(16).fill('word').join(' ')+'}}')).includes('long-front'));
  const snapshot=JSON.stringify(weak);A.ankiStyleWarnings(weak);
  t('style inspection never mutates keep, content, or fact IDs',JSON.stringify(weak)===snapshot);
  t('style warnings do not become structural lint',A.lintAnkiCard(weak).length===0&&A.lintAnkiCard(sixteen).length===0);
  const notes=[good,weak];
  t('style filter shows only warned notes',A.ankiReviewFilter(notes,'all',true).map(c=>c.id).join(',')==='n2');
  t('turning the style filter off restores all notes',A.ankiReviewFilter(notes,'all',false).length===2);
  t('style and tier filters compose',A.ankiReviewFilter(notes,'1',true).length===0&&A.ankiReviewFilter(notes,'2',true)[0]===weak);
  t('filter tail assertion: an empty tier produces no matches',A.ankiReviewFilter(notes,'3',false).length===0);
  // Exercise the live edit callback, not a copy: style warnings derive from edited
  // text on render; structural lint retains its established keep semantics.
  let edited=[{...weak,lint:[],abbrev:[]}];
  const updateSource=spanFrom('const updateField=useCallback(', '  })),[]);', 'function AnkiGenerator()');
  const abbrevSource=spanFrom('const NEIA_UNSAFE_ABBREV_MSGS=', '\n}');
  const update=new Function('setCards','useCallback','NEIA_TERMINOLOGY_RULES',helpers+abbrevSource+'\n'+updateSource+';return updateField;')(fn=>{edited=fn(edited);},fn=>fn,CASE.NEIA_TERMINOLOGY_RULES);
  update('n2','text',good.text);
  t('editing away an article clue immediately clears style findings',A.ankiStyleWarnings(edited[0]).length===0);
  t('style edits preserve a kept note and provenance',edited[0].keep&&edited[0].factIds[0]==='fact-1');
  edited=[{...weak,keep:false,lint:[],abbrev:[]}];update('n2','text',good.text);
  t('clearing style warnings never rechecks a manually excluded note',edited[0].keep===false);
  // Capture the actual export callback using a tiny Blob recorder; no file download
  // or Gemini call occurs. A review-only filter must not shrink exported coverage.
  const exportSource=spanFrom('const exportTxt=useCallback(', '  },[cards,batch,current,tierFilter,ankiHeader,includeSources]);', 'function AnkiGenerator()');
  let exported='';
  const makeExport=(cards,filtered,tier,header)=>new Function('cards','filteredCards','tierFilter','ankiHeader','downloadBlob','useCallback','Blob',helpers+'const current=true,batch=null,includeSources=false;'+exportSource+';return exportTxt;')(
    cards,filtered,tier,header,b=>{exported=b.body;},fn=>fn,class{constructor(parts){this.body=parts.join('');}});
  makeExport(notes,notes,'all',false)();
  t('export keeps clean and warned notes regardless of review filter',exported.split('\n').length===2&&exported.includes(good.text)&&exported.includes(weak.text));
  makeExport(notes,[weak],'2',false)();
  t('export still respects the selected tier',exported===weak.text+'|'+weak.extra+'|'+weak.tags);
  makeExport([good,{...weak,keep:false}],notes,'all',false)();
  t('export still excludes manually unchecked notes',exported.split('\n').length===1&&exported.startsWith(good.text));
  makeExport([note('[Example] Threshold: {{c1::<5 & >2}}')],[],'all',true)();
  t('Anki header export preserves escaped comparator bytes and cloze braces',exported.startsWith('#separator:Pipe\n')&&exported.includes('{{c1::&lt;5 &amp; &gt;2}}'));
}

// Deliberately synthetic, shared by deterministic checks and the local browser fixture.
function ankiSyntheticFixture(){
  const source={filename:'Synthetic <notes> & examples|only\nhandout',location:'page 1'};
  const kb={metadata:{schemaVersion:'1.0'},conditions:[{name:'ExampleMedication-A',facts:[
    {id:'fact-1',text:'Count pulse for 1 minute; hold below 60 bpm.',sourceQuote:'Pulse below 60 bpm. Source also says 55 bpm.',tier:1,latteBucket:'Assess',sources:[source,source]},
    {id:'fact-2',text:'The fictional dose is 150 mg.',sourceQuote:'150 mg',tier:1,latteBucket:'Treatments',sources:[{filename:'Synthetic doses',location:'page 2'}]},
    {id:'fact-3',text:'The fictional amount is 5,000 U.',sourceQuote:'5,000 U',tier:2,latteBucket:'Treatments',sources:[]},
    {id:'fact-4',text:'The fictional rate is 30 mL/hr.',sourceQuote:'30 mL/hr',tier:2,latteBucket:'Treatments',sources:[]}
  ]},{name:'ExampleCondition-B',facts:[{id:'fact-5',text:'Report weight gain of 2 lb in 24 hours.',sourceQuote:'2 lb in 24 hours',tier:1,latteBucket:'Educate',sources:[{filename:'Synthetic teaching',location:'page 3'}]}]}]};
  const note=(id,text,tier=1,chunk=1,line=1)=>({id,text,extra:'',tags:'Nursing::LATTE::Assess Condition::Example Tier::'+tier,chunk,sourceLine:line,pipeCount:2,keep:true,factIds:[]});
  const cards=[note('n1','[Example] Pulse: {{c1::60 bpm}}'),note('n2','[Example] Pulse: {{c1::60 bpm}}',1,1,2),note('n3','[Example] Dose: {{c1::150 mg}}',2,1,3),note('n4','[Example B] Gain: {{c1::2 lb}} in {{c2::24 hr}}',1,2,1)];
  const chunkIds=[['fact-1','fact-2','fact-3','fact-4'],['fact-5']];
  const ledgers=[{chunk:1,text:'fact-1 -> line #1\nfact-1 -> line #2\nfact-2 -> line #2\nfact-2 -> line #3\nfact-3 -> line #0\nfact-999 -> line #1\nfact-5 -> line #3\nfact-4 -> line #99\nfact-4 -> nowhere'}, {chunk:2,text:'fact-5 -> line #1'}];
  return {kb,cards,chunkIds,ledgers,note};
}
const ankiHelperSource=spanFrom('function ankiParseCards(raw','function AnkiStyleBadges');
const ANKI=new Function('uid',ankiHelperSource.slice(0,ankiHelperSource.lastIndexOf('function AnkiStyleBadges'))+';return {ankiParseCards,parseKBCoverage,ankiSourceSnapshot,ankiChunkFactIds,attachCoverageToCards,ankiDedupeCards,ankiRunIsCurrent,ankiBatchSummary,ankiSelection,ankiReviewFilter,ankiPreviewText,ankiNumericTokens,ankiNumericAudit,ankiCollisionGroups,ankiBatchDiagnostics,ankiSourcePointers,ankiExportText,ankiRunEvidence,lintAnkiCard,ankiStyleWarnings,parseAnkiClozes};')(()=> 'synthetic-'+Math.random());
section('v15.17 — batch provenance and live counts');
{
  const F=ankiSyntheticFixture(),snapshot=ANKI.ankiSourceSnapshot(F.kb),original=JSON.stringify(F.kb);
  t('batch snapshot freezes facts, lookup and source pointers',Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.byId)&&Object.isFrozen(snapshot.facts[0].sources[0]));
  const ids=ANKI.ankiChunkFactIds('header fact-99\nFACT fact-1 | X\nFACT FACT-2 | Y\nFACT fact-1 | Z');
  t('chunk fact capture reads only supplied FACT rows',ids.join(',')==='fact-1,fact-2');
  const issues=ANKI.attachCoverageToCards(F.cards,F.ledgers,snapshot,F.chunkIds);
  t('repeated mappings on separate lines are retained',F.cards[0].factIds.join()==='fact-1'&&F.cards[1].factIds.join()==='fact-1,fact-2');
  t('unknown fact IDs never acquire support',issues.some(x=>x.code==='unknown-id')&&!F.cards[0].factIds.includes('fact-999'));
  t('out-of-chunk fact IDs never acquire support',issues.some(x=>x.code==='out-of-chunk')&&!F.cards[2].factIds.includes('fact-5'));
  t('line zero is an explicit omission',issues.some(x=>x.code==='omitted'&&x.id==='fact-3')&&!F.cards.some(c=>c.factIds.includes('fact-3')));
  t('missing and out-of-range destinations are diagnosed',issues.filter(x=>x.code==='invalid-destination').length===2);
  t('second chunk line one maps only to second chunk note',F.cards[3].factIds.join()==='fact-5'&&!F.cards[0].factIds.includes('fact-5'));
  t('model headings cannot override trusted chunk identity',ANKI.parseKBCoverage('--- Chunk 2 ---\nfact-1 -> line #1',1)[0].chunk===1);
  t('ambiguous multiple destinations are not silently partially accepted',Number.isNaN(ANKI.parseKBCoverage('fact-1 -> line #1, line #2')[0].line));
  const dedup=ANKI.ankiDedupeCards(F.cards);
  t('full text dedupe unions validated links before dropping duplicates',dedup.length===3&&dedup[0].factIds.join()==='fact-1,fact-2');
  t('dedupe preserves raw cards for baseline measurement',F.cards.length===4&&F.cards[0].factIds.join()==='fact-1');
  const batch={sourceKB:F.kb,snapshot};const summary=ANKI.ankiBatchSummary(dedup,batch,true);
  t('batch summary counts kept notes, reviews and distinct linked facts',summary.kept.length===3&&summary.reviews===4&&summary.coveredCount===3&&summary.total===5);
  const without=dedup.filter(c=>c.id!=='n4');
  t('deleting sole linked note lowers coverage and registry',ANKI.ankiBatchSummary(without,batch,true).coveredCount===2&&ANKI.ankiBatchSummary(without,batch,true).entries.length===2);
  t('unchecking sole linked note lowers coverage',ANKI.ankiBatchSummary(dedup.map(c=>c.id==='n4'?{...c,keep:false}:c),batch,true).coveredCount===2);
  t('invalid notes leave registry and linked coverage',ANKI.ankiBatchSummary(dedup.map(c=>c.id==='n4'?{...c,text:'{{c1::broken'}:c),batch,true).coveredCount===2);
  t('structural repair restores selected coverage',ANKI.ankiBatchSummary(dedup,batch,true).coveredCount===3);
  const changed=ANKI.ankiBatchSummary(dedup.map(c=>({...c,text:'[Example] Edited label: {{c1::answer}}'})),batch,true);
  t('registry labels follow edits and retain original associations',changed.entries[0].label.includes('Edited label: answer')&&changed.entries[0].factIds.includes('fact-1'));
  t('empty batch clears Anki registry entries',ANKI.ankiBatchSummary([],batch,true).entries.length===0);
  t('stale batch has no active support or export',ANKI.ankiBatchSummary(dedup,batch,false).entries.length===0&&ANKI.ankiBatchSummary(dedup,batch,false).total===0&&ANKI.ankiBatchSummary(dedup,batch,false).kept.length===0);
  const replacement=JSON.parse(original);replacement.conditions[0].facts[0].text='Different fact-1, 900 mg';
  const run={sourceKB:F.kb,ctl:new AbortController()},second={sourceKB:F.kb,ctl:new AbortController()};
  t('late result fails source identity guard even with matching fact IDs',!ANKI.ankiRunIsCurrent(run,run,replacement));
  t('superseded run cannot overwrite second run',!ANKI.ankiRunIsCurrent(run,second,F.kb)&&ANKI.ankiRunIsCurrent(second,second,F.kb));
  run.ctl.abort();t('cancellation rejects late success',!ANKI.ankiRunIsCurrent(run,run,F.kb));
  t('snapshot retains original source and leaves KB bytes unchanged',snapshot.facts[0].text.includes('60 bpm')&&JSON.stringify(F.kb)===original);
  let registry={ankiNotes:[{id:'old'}],nclexQuestions:[{id:'q'}],caseStudies:[{id:'case'}]};
  const registerSource=spanFrom('const registerArtifact=useCallback(', '  },[]);','function App()');
  const register=new Function('useCallback','setArtifactRegistry',registerSource+';return registerArtifact;')(f=>f,f=>{registry=f(registry);});
  register('ankiNotes',summary.entries);
  t('registry replaces only Anki entries across all tiers',registry.ankiNotes.length===3&&registry.nclexQuestions[0].id==='q'&&registry.caseStudies[0].id==='case');
  register('ankiNotes',[]);t('empty publication preserves other artifact kinds',registry.ankiNotes.length===0&&registry.caseStudies.length===1);
  t('registry effect depends on stable callback and derived entries',S.includes("useEffect(()=>{if(registerAnki)registerAnki('ankiNotes',coverage.entries);},[registerAnki,coverage.entries]);"));
  t('selected tier changes exports but not global registry',ANKI.ankiSelection(dedup,true,'2').kept.length===1&&summary.entries.length===3);
  t('style view does not modify current workload or coverage',ANKI.ankiReviewFilter(dedup,'all',true).length===0&&summary.reviews===4&&summary.coveredCount===3);
  const unmapped=[F.note('none','[Example] Finding: {{c1::answer}}')];
  t('missing mapping is diagnosed yet note stays exportable',ANKI.attachCoverageToCards(unmapped,[],snapshot,F.chunkIds).some(x=>x.code==='no-mapping')&&ANKI.ankiSelection(unmapped).kept.length===1);
  t('helper extraction reaches a non-vacuous tail',ANKI.ankiReviewFilter(dedup,'3',false).length===0);
  t('fractional and suffixed line references are invalid destinations',Number.isNaN(ANKI.parseKBCoverage('fact-1 -> line #1.5')[0].line)&&Number.isNaN(ANKI.parseKBCoverage('fact-1 -> line #1abc')[0].line));
  F.kb.conditions[0].facts[0].text='mutated';F.kb.conditions[0].facts[0].sources[0].filename='mutated';
  t('batch snapshot does not alias mutable source fact or pointer objects',snapshot.facts[0].text.includes('60 bpm')&&snapshot.facts[0].sources[0].filename.startsWith('Synthetic'));

}

section('v15.17 — advisory numeric consistency');
{
  const F=ankiSyntheticFixture(),batch={snapshot:ANKI.ankiSourceSnapshot(F.kb)};
  const card=(text,id='fact-1',extra='')=>({...F.note('numeric','[Example] Value: '+text),factIds:id?[id]:[],extra});
  const audit=(text,id,extra)=>ANKI.ankiNumericAudit(card(text,id,extra),batch,true);
  t('60 bpm source versus 50 bpm card warns',audit('{{c1::50 bpm}}').status==='Numeric discrepancy');
  t('150 mg source does not support substring 50 mg',audit('{{c1::50 mg}}','fact-2').status==='Numeric discrepancy');
  t('exact value and unit match is reported narrowly',audit('{{c1::150 mg}}','fact-2').status==='No numeric mismatch detected');
  t('cloze boundary placement has identical numeric assessment',JSON.stringify(audit('{{c1::50}} bpm'))===JSON.stringify(audit('{{c1::50 bpm}}')));
  const tokens=x=>ANKI.ankiNumericTokens(x).tokens.map(t=>t.key).join(';');
  for(const [a,b] of [['.5 mg','0.5 mg'],['5.0 mg','5 mg'],['005.00 mg','5 mg'],['5,000 U','5000 units'],['50 µg','50 mcg'],['50 μg','50 micrograms'],['2 milliliters per hour','2 mL/hr'],['60 beats per minute','60 bpm']])t('notation equivalence: '+a,tokens(a)===tokens(b)&&tokens(a)!=='');
  t('units are distinct, without automatic conversion',tokens('50 mg')!==tokens('50 mcg')&&tokens('30 mL')!==tokens('30 mL/hr'));
  t('compound units remain complete',tokens('2 mcg/kg/min')==='2 mcg/kg/min'&&tokens('5 mg/dL')==='5 mg/dl');
  t('unknown compound suffix cannot donate a supported prefix',ANKI.ankiNumericTokens('5 mg/kg2').unsupported.length>0&&ANKI.ankiNumericTokens('5 mg/kg2').tokens.length===0);
  t('commas separating measurements preserve complete numeric tokens',tokens('5 mg, 10 mg.')==='5 mg;10 mg'&&ANKI.ankiNumericTokens('5 mg, 10 mg.').unsupported.length===0);
  t('range endpoints inherit trailing unit',tokens('5–10 mg')==='5 mg;10 mg');
  t('explicit endpoint units and to notation are supported',tokens('5 mg to 10 mg')==='5 mg;10 mg'&&tokens('5 to 10 mg')==='5 mg;10 mg');
  t('decimal comparison preserves arbitrary supplied precision',tokens('1.12345678901234567890 mg')==='1.1234567890123456789 mg');
  for(const text of ['1/2 mg','1e3 mg','5 × 10^9/L','120/80','50 widgets','1,50 mg'])t('unsupported form requires source review: '+text,ANKI.ankiNumericTokens(text).unsupported.length>0);
  t('quote-only support never claims checked fact support',audit('{{c1::55 bpm}}').status==='Source review needed'&&audit('{{c1::55 bpm}}').findings.some(x=>x.code==='quote-only'));
  t('no mapping remains not checked',audit('{{c1::60 bpm}}',null).status==='Not checked');
  t('partial mappings report limited support',ANKI.ankiNumericAudit({...card('{{c1::60 bpm}}'),mappingIssues:[{code:'unknown-id'}]},batch,true).status==='Source review needed');
  t('invalid cloze is not numerically checked',audit('{{c1::60 bpm').status==='Not checked');
  t('earlier KB is never used for numeric checks',ANKI.ankiNumericAudit(card('{{c1::60 bpm}}'),batch,false).status==='Not checked');
  t('notes with no numbers have an explicit no-values status',audit('{{c1::pulse}}').status==='No supported numeric values found');
  t('Extra is included in numeric assessment',audit('{{c1::pulse}}','fact-1','Threshold 50 bpm').status==='Numeric discrepancy');
  const before=JSON.stringify(F.kb),beforeCard=card('{{c1::50 bpm}}');const frozen=JSON.stringify(beforeCard);ANKI.ankiNumericAudit(beforeCard,batch,true);
  t('numeric warnings leave source and selection bytes untouched',JSON.stringify(F.kb)===before&&JSON.stringify(beforeCard)===frozen&&beforeCard.keep);
  t('known limit: occurrence checks cannot distinguish below from above',audit('Above {{c1::60 bpm}}').status==='No numeric mismatch detected');
  const roleBatch={snapshot:ANKI.ankiSourceSnapshot({conditions:[{facts:[{id:'fact-1',text:'Morning 5 mg; evening 10 mg.'}]}]})};
  t('known limit: supported values can be assigned the wrong roles',ANKI.ankiNumericAudit(card('Morning {{c1::10 mg}}; evening {{c2::5 mg}}'),roleBatch,true).status==='No numeric mismatch detected');
  const rangeBatch={snapshot:ANKI.ankiSourceSnapshot({conditions:[{facts:[{id:'fact-1',text:'Range 5–10 mg.'}]}]})};
  t('range comparison checks the second endpoint',ANKI.ankiNumericAudit(card('{{c1::5–12 mg}}'),rangeBatch,true).findings.some(x=>x.code==='numeric-discrepancy'&&x.msg.startsWith('12 mg')));
}

section('v15.17 — rendered-front collisions and raw diagnostics');
{
  const F=ankiSyntheticFixture(),n=(id,text)=>F.note(id,text),collision=ANKI.ankiCollisionGroups;
  const a=n('a','[Example] Dose: {{c1::5 mg}}'),b=n('b','[Example] Dose: {{c1::10 mg}}');
  t('same rendered front and different answers warn as ambiguous',collision([a,b])[0].kind==='different-answer');
  const c=n('c','[Example] Dose: {{c2::5 mg}}');
  t('same front and answer sequence warn separately as redundant',collision([a,c])[0].kind==='same-answer');
  t('meaningful labels and case remain distinct',collision([a,n('d','[Example] Other: {{c1::5 mg}}'),n('e','[example] Dose: {{c1::5 mg}}')]).length===0);
  t('whitespace-only representation changes still collide',collision([a,n('f','[Example]   Dose: {{c1::5 mg}}')]).length===1);
  t('visible sibling answers distinguish actual fronts',collision([n('g','{{c1::a}} then {{c2::b}}'),n('h','{{c1::a}} then {{c2::c}}')]).length===1);
  t('different visible hints do not collide',collision([n('g','{{c1::a::first}}'),n('h','{{c1::b::second}}')]).length===0);
  const repeated=collision([n('g','{{c1::a}} plus {{c1::b}}'),n('h','{{c2::a}} plus {{c2::c}}')]);
  t('same-index gaps store the complete hidden answer sequence',repeated[0].members[0].answers.join(',')==='a,b'&&repeated[0].members.length===2);
  const original=JSON.stringify([a,b]);collision([a,b]);
  t('collision warnings never mutate, merge or deselect notes',JSON.stringify([a,b])===original&&a.keep&&b.keep);
  t('editing the front clears a group',collision([a,{...b,text:'[Example] New task: {{c1::10 mg}}'}]).length===0);
  t('raw groups include manually excluded rows',collision([a,{...b,keep:false}]).length===1&&collision(ANKI.ankiSelection([a,{...b,keep:false}]).kept).length===0);
  const snapshot=ANKI.ankiSourceSnapshot(F.kb);ANKI.attachCoverageToCards(F.cards,F.ledgers,snapshot,F.chunkIds);
  const batch={snapshot,rawCards:F.cards,truncated:true},cards=ANKI.ankiDedupeCards(F.cards),D=ANKI.ankiBatchDiagnostics(cards,batch,true);
  t('diagnostics retain raw parsed and post-dedupe counts',D.parsedNotes===4&&D.postDedupeNotes===3);
  t('raw duplicate fronts survive as baseline evidence',D.collisions.groups===1&&D.collisions.affectedReviews===2&&D.collisions.sameAnswer===1);
  t('raw style denominator and truncation remain explicit',D.frontAnchor.withText===4&&D.frontAnchor.warned===0&&D.truncated);
  t('current tier workload counts reviews rather than notes',D.current.byTier[0].notes===2&&D.current.byTier[0].reviews===3);
  t('stale raw diagnostics never claim numeric checks',ANKI.ankiBatchDiagnostics(cards,batch,false).numeric.checkedNotes===0);
}

section('v15.17 — optional source footers');
{
  const F=ankiSyntheticFixture(),snapshot=ANKI.ankiSourceSnapshot(F.kb),batch={snapshot},c={...F.cards[0],factIds:['fact-1','fact-2'],extra:'Original <extra> & explanation'};
  const before=JSON.stringify({c,snapshot});
  const output=(html=false,refs=false,cards=[c],current=true)=>ANKI.ankiExportText(cards,batch,current,'all',html,refs);
  t('source option off preserves the original three-field bytes',output()===c.text+'|'+c.extra+'|'+c.tags);
  t('all distinct source pairs survive and duplicates are removed',ANKI.ankiSourcePointers(c,batch,true).length===2);
  const plain=output(false,true),html=output(true,true);
  t('plain source footer uses inline separators without added markup',plain.includes(' — Source: Synthetic <notes> & examples / only, handout, page 1; Synthetic doses, page 2')&&!plain.includes('<br>'));
  t('HTML Extra and metadata escape separately around one trusted break',html.includes('Original &lt;extra&gt; &amp; explanation<br>Source: Synthetic &lt;notes&gt; &amp; examples / only, handout')&&html.split('<br>').length===2);
  t('metadata pipes and newlines cannot create extra fields or rows',plain.split('|').length===3&&plain.split('\n').length===1&&html.split('\n').length===5);
  t('source quotes are absent from pointer export',!plain.includes('Source also says 55 bpm'));
  t('HTML headers retain the existing import contract',html.startsWith('#separator:Pipe\n#html:true\n#notetype:Cloze\n#tags column:3\n'));
  t('current unmapped notes explicitly export unavailable sources',output(false,true,[{...c,factIds:[]}]).includes('Source: unavailable'));
  t('repeated export never appends duplicate footers or mutates state',output(true,true)===html&&JSON.stringify({c,snapshot})===before);
  t('stale batches cannot export or borrow source pointers',output(false,true,[c],false)===''&&ANKI.ankiSourcePointers(c,batch,false).length===0);
  t('a pipe introduced after generation cannot bypass export validation',output(false,true,[{...c,text:c.text+'|broken'}])==='');
  t('a newline introduced after generation cannot bypass export validation',output(false,true,[{...c,extra:'broken\nfield'}])==='');
  const comparator={...c,text:'[Example] Threshold: {{c1::<60 & >40}}'};
  t('source export preserves cloze braces and escaped comparisons',output(true,true,[comparator]).includes('{{c1::&lt;60 &amp; &gt;40}}'));
  t('empty Extra gains a footer with no stray separator',output(true,true,[{...c,extra:''}]).includes('}}|Source:')&&!output(true,true,[{...c,extra:''}]).includes('<br>'));
  t('tier filter still selects export while source option is on',ANKI.ankiExportText([c,{...c,id:'tier2',tags:'Tier::2'}],batch,true,'2',false,true).split('\n').length===1);
  const D=ANKI.ankiBatchDiagnostics([],{...batch,rawCards:F.cards,postDedupeNotes:3},true);
  t('deletion cannot rewrite the original post-dedupe baseline count',D.postDedupeNotes===3&&D.current.keptNotes===0);
}

section('v15.17 — approved live examples and replay evidence');
{
  const {buildAnkiExampleProposal}=require('./tools/anki-example-proposal');
  const {extractPromptLiteral,sha256}=require('./tools/repo-checks');
  const proposal=buildAnkiExampleProposal(S);
  const live=extractPromptLiteral(S,'ANKI_MASTER_PROMPT').declaration;
  const prompt=new Function(live+';return ANKI_MASTER_PROMPT;')();
  const rows=prompt.match(/\[Example(?:Medication-A|Condition-B)\][^\n]*?Tier::[123]\b/g)||[];
  const facts=[
    {id:'fact-1',text:'Before ExampleMedication-A, count the pulse for one full minute.',tier:1,latteBucket:'Assess'},
    {id:'fact-2',text:'Hold ExampleMedication-A when pulse is below 60 bpm.',tier:1,latteBucket:'Treatments'},
    {id:'fact-3',text:'Report weight gain of 2 lb in 24 hours with ExampleCondition-B.',tier:1,latteBucket:'Educate'},
    {id:'fact-4',text:'ExampleMedication-A blocks the fictional Receptor-Z.',tier:1,latteBucket:'Treatments'},
    {id:'fact-5',text:'ExampleCondition-B has an erythematous plaque as its lesion type.',tier:2,latteBucket:'Look'}
  ];
  const batch={snapshot:ANKI.ankiSourceSnapshot({conditions:[{facts}]})},ids=['fact-5','fact-1','fact-2','fact-3','fact-4'];
  const notes=rows.map((row,i)=>({...ANKI.ankiParseCards(row).cards[0],factIds:[ids[i]]}));
  t('all five complete examples come from the actual shipped prompt',rows.length===5&&notes.every(c=>c.text&&c.pipeCount===2));
  t('live examples have valid flat structure and no style warnings',notes.every(c=>ANKI.lintAnkiCard(c).length===0&&ANKI.ankiStyleWarnings(c).length===0));
  t('live examples retain supplied LATTE and Tier tags',notes.every(c=>{const f=batch.snapshot.byId[c.factIds[0]];return c.tags.includes('Nursing::LATTE::'+f.bucket)&&c.tags.includes('Tier::'+f.tier);}));
  t('live examples have no numeric findings against their fictional facts',notes.every(c=>ANKI.ankiNumericAudit(c,batch,true).findings.length===0));
  t('live examples have no identical rendered fronts',ANKI.ankiCollisionGroups(notes).length===0);
  t('fictional examples are explicitly excluded from generated source material',prompt.includes('fictional; never source material for the generated deck'));
  t('shipped prompt contains exactly the approved example revision',proposal.applied&&live===proposal.proposed&&!S.includes(proposal.original));
  t('reversing only the example diff recovers the historical frozen prompt',sha256(extractPromptLiteral(proposal.original,'ANKI_MASTER_PROMPT').body)==='353471cbee66c759341ad8f4d857fa75ea4051744a52771ce780fcf172efc548');
  const replay=buildAnkiExampleProposal(proposal.original);
  t('diff remains reproducible from either side without mutating input',!replay.applied&&replay.proposed===live&&replay.original===proposal.original);
  let partialRejected=false;try{buildAnkiExampleProposal(live.replace('Complete format examples (fictional; never source material for the generated deck):','Examples of desired compression:'));}catch(e){partialRejected=/anchors changed or are partially applied/.test(e.message);}
  t('partial example edits cannot silently regenerate an approved diff',partialRejected);
  const fixturePage=require('./tools/anki-browser-fixture').page();
  t('browser fixture mounts real generator and blocks live network calls',fixturePage.includes('<AnkiGenerator/>')&&fixturePage.includes('window.fetch=()=>Promise.reject')&&fixturePage.includes('<SyntheticAnkiApp/>'));
  const evidence=ANKI.ankiRunEvidence({model:'synthetic',thinkingLevel:'low',snapshot:batch.snapshot,rawResponses:['complete response'],partialResponse:'partial',apiKey:'MUST-NOT-RETAIN',ctl:new AbortController()},'cancelled');
  t('interrupted evidence retains raw responses and cancellation status',evidence.status==='cancelled'&&evidence.rawResponses.length===1&&evidence.partialResponse==='partial');
  t('private replay evidence excludes credentials and mutable controllers',!JSON.stringify(evidence).includes('MUST-NOT-RETAIN')&&!('ctl' in evidence));
}

section('v15.17 — unchanged generation inputs and bounded pilot');
{
  // Source hashes measured at the clean A0 checkout 21fb598; no baseline is refreshed here.
  const inputs=[
    ['source packet','function kbForAnki(kb){','// ── KB source chunking','abf40adde002b03587eefe395958ec67de14c7bec5c1fee5db600cc527e74a71'],
    ['chunking','function splitOversizedConditionBlock(block,max){','function ankiParseCards(raw','b3d15fb1e63a7b1cdd49eb105db827debac59bd0340c282fdae5049989e42002'],
    ['focus block','  function buildFocusBlock(){','  const run=useCallback(async()=>{','b096b8eb8733da287a097a99ede3f3e233d8e413c01bdf5605376f516054094f'],
    ['mapping adapter','        const kbAdapter=','        parts.push({text:ANKI_MASTER_PROMPT','5cc837d1317a87d3d58d2bc6ed7afef835dbace0b6d089167e83b354863b3836']
  ];
  const {sha256}=require('./tools/repo-checks');
  for(const [name,start,end,hash] of inputs){const a=S.indexOf(start,name==='focus block'?S.indexOf('function AnkiGenerator()'):0),b=S.indexOf(end,a);t('code-only generation input unchanged: '+name,a>=0&&b>a&&sha256(S.slice(a,b).trim())===hash);}
  const F=ankiSyntheticFixture(),before=JSON.stringify(F.kb),spec=require('./tools/anki-pilot-spec').makeAnkiPilotSpec(F.kb,S);
  t('pilot planner derives exact call counts from the live chunker',spec.facts===5&&spec.chunkCount===1&&spec.expectedGenerationCalls===1&&spec.maximumAttempts===3);
  t('pilot planner preserves the recommended model and token contract',spec.model==='gemini-3.8-flash'&&spec.thinkingLevel==='low'&&spec.maxOutputTokensPerAttempt===65536&&spec.additionalAuditCalls===0);
  t('pilot planning does not modify source facts or authorize execution',JSON.stringify(F.kb)===before&&spec.status.startsWith('PLANNED ONLY'));
}

/* ── v15.17: shared flat cloze parser and live eligibility ── */
section('v15.17 — flat cloze structure');
{
  const source=spanFrom('function parseAnkiClozes(value)','function AnkiStyleBadges');
  const A=new Function(source.slice(0,source.lastIndexOf('function AnkiStyleBadges'))+';return {parseAnkiClozes,ankiPreviewText,ankiSelection,lintAnkiCard,ankiReviewFilter};')();
  const note=text=>({id:'synthetic-1',text,extra:'',tags:'Tier::1',pipeCount:2,keep:true});
  const p=A.parseAnkiClozes('a {{C2::alpha::hint}} + {{c2::beta}}');
  t('flat spans retain offsets, answers, hints and numeric indices',p.spans.length===2&&p.spans[0].start===2&&p.spans[0].end===21&&p.spans[0].answer==='alpha'&&p.spans[0].hint==='hint'&&p.indices.join()==='2');
  for(const bad of ['{{c1::answer','}} before {{c1::answer}}','{{c1::answer}} }}','{{c1:: }}','{{c0::answer}}','{{c-1::answer}}','{{c1:answer}}','{{c1::outer {{c2::inner}} }}','{{c1::a}} {{oops}}']){
    t('invalid flat syntax is reported: '+bad,A.parseAnkiClozes(bad).issues.length>0&&A.lintAnkiCard(note(bad)).length>0&&A.ankiPreviewText(bad,1).startsWith('Structural error:'));
  }
  t('three distinct positive indices need no renumbering',A.ankiSelection([note('{{c2::a}} {{c8::b}} {{c20::c}}')]).reviews===3);
  t('four distinct indices are structurally ineligible',A.ankiSelection([note('{{c1::a}} {{c2::b}} {{c3::c}} {{c4::d}}')]).invalid===1);
  t('repeated c1 makes one review',A.ankiSelection([note('{{c1::a}} {{c1::b}}')]).reviews===1);
  const selected=note('{{c1::a}}'),manual={...selected,keep:false};
  t('invalid selected note remains editable but has no export eligibility',A.ankiSelection([{...selected,text:'{{c1::broken'}]).kept.length===0&&selected.keep);
  t('a repaired selected note regains eligibility while manual exclusion survives',A.ankiSelection([selected,manual]).kept.length===1);
  for(const field of ['text','extra','tags']){
    t('edited pipe rejected in '+field,A.lintAnkiCard({...selected,[field]:selected[field]+'|bad'}).includes('pipe-format'));
    t('edited newline rejected in '+field,A.lintAnkiCard({...selected,[field]:selected[field]+'\nbad'}).includes('pipe-format'));
  }
  t('stale selection cannot export any reviews',A.ankiSelection([selected],false).reviews===0);
  t('shared helper extraction reaches filter tail',A.ankiReviewFilter([selected],'3',false).length===0);
}

/* ── 21. v15.7 — provenance stamp + Anki abbreviation lint (B2, B5) ── */
section('v15.7 — provenance + Anki lint');
{
  const P = new Function(
    // The constant and its consumer live far apart in the file; two spans, not one range.
    "const NCLEX_TEST_PLAN_VERSION=2026;\n" +
    spanFrom("const LATTE_STANDARDS_VERSION=", ";\n") +
    spanFrom("function latteProvenanceStamp(", "\n}") +
    '\n;return {latteProvenanceStamp,LATTE_STANDARDS_VERSION};'
  )();
  const st = P.latteProvenanceStamp({ genModel: 'gemini-3.7-flash', genLevel: 'high',
    auditModel: 'gemini-3.1-pro-preview', auditLevel: 'high', promptLabel: 'NCLEX v4.2' });
  t('stamp names the generator model and level', /Generator: gemini-3\.7-flash \[Thinking: high\]/.test(st));
  t('stamp names the auditor model and level', /Auditor:\s+gemini-3\.1-pro-preview \[Thinking: high\]/.test(st));
  t('stamp names the prompt label', /Prompt: NCLEX v4\.2/.test(st));
  t('stamp names the criteria version', /Criteria: LATTE-NEIA v1\.0/.test(st));
  t('stamp names the Test Plan version', /Test Plan: 2026/.test(st));
  t('stamp records when no audit ran',
    /Auditor:\s+not run/.test(P.latteProvenanceStamp({ genModel: 'x', genLevel: 'low' })));
  t('LATTE_STANDARDS_VERSION is a flat string, not a registry object',
    typeof P.LATTE_STANDARDS_VERSION === 'string');
  t('no ASSESSMENT_STANDARDS registry was built', !S.includes('ASSESSMENT_STANDARDS'));
  t('stamp goes to the case audit trail, not the printable view',
    S.includes('caseValidationStamp(issues)+(provenance?latteProvenanceStamp(provenance):\'\')+caseToMarkdown(caseStudy)') &&
    !/casePrintMd=useMemo\(\(\)=>caseStudy\?caseValidationStamp\(issues\)\+latteProvenanceStamp/.test(S));
  t('provenance is captured at run time, not read at render time',
    S.includes("const _aud=cfg.forTool('itemAudit');"));
}
{
  const A = new Function(
    spanFrom('const NEIA_TERMINOLOGY_RULES=', '\n}', 'const NEIA_TERMINOLOGY_RULES=') +
    spanFrom('const NEIA_UNSAFE_ABBREV_MSGS=', '\n}', 'const NEIA_UNSAFE_ABBREV_MSGS=') +
    '\n;return {ankiUnsafeAbbrevScan};'
  )();
  const scan = txt => { const o = []; A.ankiUnsafeAbbrevScan(txt, 'Text', o); return o; };
  t('"5.0 mg" on a card → warn', scan('Give {{c1::5.0 mg}} daily').some(i => /trailing zero/.test(i.msg)));
  t('".5 mg" on a card → warn', scan('Give {{c1::.5 mg}}').some(i => /leading zero/.test(i.msg)));
  t('"q.d." on a card → warn', scan('Dose is {{c1::q.d.}}').some(i => /q\.d\./.test(i.msg)));
  t('"IU" on a card → warn', scan('Give {{c1::500 IU}}').some(i => /International Unit/.test(i.msg)));
  t('bare "U" on a card → warn', scan('Give {{c1::10 U}} insulin').some(i => /"U" is unsafe/.test(i.msg)));
  t('all findings are warn-tier', scan('Give 5.0 mg q.d.').every(i => i.sev === 'warn'));
  t('safe transcription is clean', scan('Give {{c1::0.5 mg}} daily').length === 0);
  // The deliberate exclusion: vocabulary rules must NOT fire on flashcards.
  t('"patient" does NOT fire on an Anki card (vocabulary half excluded)',
    !scan('The patient takes {{c1::furosemide}}').some(i => /client/.test(i.msg)));
  t('"physician" does NOT fire on an Anki card',
    !scan('Notify the physician about {{c1::bradycardia}}').some(i => /primary health care provider/.test(i.msg)));
  t('abbreviation findings are kept out of `lint` so cards stay exportable',
    S.includes('c.abbrev=found.map(x=>x.msg);') && !S.includes("issues.push('unsafe-abbrev')"));
  t('the Anki prompt gained a SAFE TRANSCRIPTION directive', S.includes('SAFE TRANSCRIPTION:'));
  t('the directive frames itself as transcription, not paraphrase',
    S.includes('This is transcription, not paraphrase'));
  t('the comment does not claim NEIA validates flashcards',
    S.includes('Do NOT claim NEIA validates flashcards'));
}

/* ── v15.14 tier 3: consolidation, provenance, and debloat ── */
section('v15.14 — tier 3');
{
  // T3.6 — the KB builder capped its log at 200; the other four grew without bound and
  // rendered every entry as an index-keyed div.
  t('all five tool logs and the KB-replacement notice are capped', S.split('p.slice(-200)').length - 1 === 6);
  // T3.13i — ten positional parameters, one of them inert since v15.
  t('callGemini takes an options object', S.includes('async function callGemini(apiKey,model,parts,opts={}){'));
  t('no positional call site survives the migration', !S.includes('],true,') && S.split('callGemini(').length - 1 === 10);
  t('a missed migration fails loudly instead of binding a boolean to opts',
    S.includes("throw new Error('callGemini: pass an options object"));
  t('the inert useThinking parameter is gone from the signature and every call site',
    !S.includes('parts,useThinking,') && !S.includes(',true,thinkingLevel'));
  // T3.13g/h — the wrapper no longer mutates its caller, and a deterministic failure is
  // no longer retried twice.
  t('geminiRequest does not mutate the body it was handed',
    S.includes('body=Object.assign({},body,{safetySettings:SAFETY_SETTINGS});'));
  t('an all-thinking empty response is fatal, not retried',
    S.includes("if(finish==='MAX_TOKENS'){const e=new Error('The model spent its whole output budget"));
  // T3.1 — the case generator stamped a failed artifact and refused to register it; the
  // worksheet, which is the sheet a student actually studies from, did neither.
  t('the printable worksheet carries a validation stamp',
    S.includes("caseValidationStamp(wsIssuesAll,'worksheet')"));
  t('a batch with structural errors is not registered as verified provenance',
    S.includes("results.filter(r=>r.qCount>0&&!(r.wsIssues||[]).some(x=>x.sev==='error'))"));
  t('the case wording is unchanged by the shared stamp',
    S.includes("'> This case did not pass source-grounding checks. Do not use it as verified study'"));
  // T3.11 — one intake path, a stale-guarded page count, a visible inverted range.
  t('the NCLEX picker and drop zone share one filtered, de-duplicating intake',
    S.includes('addPdfs(e.dataTransfer.files);') && S.includes('addPdfs(e.target.files);') &&
    S.includes('const addPdfs=fl=>setFiles('));
  t('a slow page-count resolve cannot overwrite a newer file', S.includes('return()=>{stale=true;};'));
  t('page ranges are only reseeded when the file in slot 0 actually changes',
    S.includes('if(firstFileRef.current!==id){'));
  t('an inverted page range says so', S.includes('start is after end'));
  // T3.3 — the AI pairing fallback saw only the first 12,000 characters and its result
  // replaced the regex pairing wholesale.
  t('AI pairing walks the whole text in windows',
    S.includes('const W=Math.max(1,Math.ceil(Math.max(qText.length,aText.length)/MAX_WIN));') &&
    !S.includes('NCLEX_AI_PAIR_PROMPT+qText.slice(0,12000)'));
  t('windows are merged by question number, keeping the fuller record at a seam',
    S.includes('byNum.set(row.number,row);'));
  // T3.7 — narrow by design. The value is connect-src; the omissions are the point.
  t('a CSP is present and pins where the page can send data',
    S.includes("connect-src 'self' blob: data: https://generativelanguage.googleapis.com"));
  t('the CSP omits default-src, which would fall through to worker-src and kill pdf.js under file://',
    !/Content-Security-Policy[^>]*default-src/.test(S));
  t('object-src, base-uri and form-action are locked, since none of them is used at all',
    S.includes("object-src 'none'; base-uri 'none'; form-action 'none'"));
  t('there is still exactly one fetch for connect-src to govern', S.split('fetch(').length - 1 === 1);
  t('and still no form, object, embed or base tag to need the other three',
    !S.includes('<form') && !S.includes('<object') && !S.includes('<embed') && !S.includes('<base '));
  // T3.8 — the shared DOMPurify hash was an assumption; it is now a measurement.
  t('the shared SRI hash is recorded as measured, not assumed',
    S.includes('Measured 2026-08-29: both') && S.includes('29,209 identical bytes'));
}
{
  // T3.10 — a single-unit chunk used to return null, and the caller then discarded it.
  const SC = new Function('kbUnitLabel',
    spanFrom('function kbSplitChunk', "units:only?[{...only,text:t}]:[]}));\n}") + ';return kbSplitChunk;')(u => 'page ' + (u[0] || {}).n);
  const page = n => ({ kind: 'page', n, text: 'x'.repeat(1500) });
  t('a multi-unit chunk still halves on the unit boundary',
    SC({ units: [page(1), page(2), page(3)], text: 'a' }).length === 2);
  const big = 'A'.repeat(3000) + '\n\n' + 'B'.repeat(3000);
  const one = SC({ units: [{ kind: 'page', n: 7, text: big }], text: big, label: 'page 7' });
  t('a single dense page now splits on text instead of being discarded', one && one.length === 2);
  t('the split lands on the paragraph break, not mid-word',
    one[0].text.endsWith('A') && one[1].text.startsWith('B'));
  t('both halves keep the original page pointer, so the source label stays truthful',
    one.every(h => h.units.length === 1 && h.units[0].n === 7));
  t('a half can be split again, so the recursion terminates on content not on structure',
    SC(one[0]) === null || SC(one[0]).length === 2);
  t('a chunk too small to divide still returns null',
    SC({ units: [{ kind: 'page', n: 1, text: 'short' }], text: 'short' }) === null);
  // A card chunk carries units:[] and used to be unsplittable for that reason alone.
  t('a card chunk with no units can still be halved on text',
    SC({ units: [], text: big, label: 'card' }).length === 2);
}
{
  // T3.13e — "first verdict line wins" was not true for a leading REVIEW: status stayed
  // 'REVIEW' with criterion still '', which is indistinguishable from "nothing seen yet",
  // so a later PASS overwrote it while the REVIEW detail survived.
  const V = AUDIT.itemParseAuditVerdict;
  const lead = V('REVIEW - could not resolve the dose\nPASS');
  t('a leading REVIEW is not overwritten by a later PASS', lead.status === 'REVIEW');
  t('and it keeps its own detail', /could not resolve/.test(lead.detail));
  t('a leading PASS still wins over a later FAIL', V('PASS\nFAIL - Stem Clarity').status === 'PASS');
  t('WARN lines are still collected regardless of position',
    V('WARN Terminology: use client\nPASS').warns.length === 1);
}

/* ── v15.14 tier 2: input clamps, backoff, and storage lifecycle ── */
section('v15.14 — clamps, backoff, storage');
{
  const bp = new Function(spanFrom('function nclexBatchPairs', '\n}') + ';return nclexBatchPairs;')();
  const pairs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // A cleared number input yields Number('')===0 and i+=0 never terminates: an infinite loop
  // pushing empty arrays until the tab dies, taking all six tools' unsaved state with it.
  // A typed letter yields NaN, where i+=NaN exits at once and produces ZERO batches, so the
  // run reports success and extracts nothing.
  for (const bad of [0, NaN, '', null, -3, 'abc', undefined]) {
    const r = bp(pairs, bad);
    t('nclexBatchPairs terminates and covers every pair for batchSize=' + JSON.stringify(bad),
      Array.isArray(r) && r.length > 0 && r.flat().length === pairs.length);
  }
  t('a sane batch size is unaffected', bp(pairs, 3).length === 4 && bp(pairs, 8).length === 2);
  t('the batch-size input is clamped at both ends, not just the floor',
    S.includes('setBatchSize(Math.max(2,Math.min(25,Math.floor(Number(e.target.value))||8)))'));
  // numBatches = ceil(targetCount/batchSize), so a floor-only clamp let one keystroke
  // schedule ~99,999 generation calls.
  t('targetCount has the ceiling its own markup already declares',
    S.includes('setTargetCount(Math.max(5,Math.min(200,parseInt(e.target.value)||50)))'));
  t('chunkChars has the ceiling its own markup already declares',
    S.includes('setChunkChars(Math.max(6000,Math.min(120000,Number(e.target.value)||30000)))'));
}
{
  const RD = new Function(spanFrom('function geminiRetryDelayMs', 'return Math.max(hintSec?Math.min(hintSec,60)*1000:0,exp);\n}') + ';return geminiRetryDelayMs;')();
  const hdr = v => ({ get: () => v });
  // The v1beta endpoint does not send Retry-After; it returns the wait as a
  // google.rpc.RetryInfo detail in the error body, which the old code parsed and discarded.
  const body37 = { error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }] } };
  t('a RetryInfo detail is honoured', RD(body37, hdr(null), 0) === 37000);
  t('a Retry-After header still works when present', RD({}, hdr('12'), 0) === 12000);
  t('RetryInfo wins over the header when both are present', RD(body37, hdr('2'), 0) === 37000);
  t('with no hint at all it falls back to the exponential curve',
    RD({}, hdr(null), 0) >= 2000 && RD({}, hdr(null), 0) < 3000);
  // A hint is a floor for how long to wait, never a licence to retry sooner than our curve.
  t('a short hint never shortens the backoff below the curve',
    RD({ error: { details: [{ '@type': 'google.rpc.RetryInfo', retryDelay: '1s' }] } }, hdr(null), 3) > 8000);
  t('a pathological hint is capped at 60s',
    RD({ error: { details: [{ '@type': 'google.rpc.RetryInfo', retryDelay: '99999s' }] } }, hdr(null), 0) === 60000);
  t('a malformed body cannot throw',
    typeof RD(null, null, 0) === 'number' && typeof RD({ error: { details: 'nope' } }, hdr(null), 0) === 'number');
}
{
  // Fake IDB. The real failure mode is a transaction that ABORTS: no handler fired at all,
  // so the promise stayed pending forever.
  const IDB = new Function('KB_DB_STORE', spanFrom('function kbRunTx', '\n  });\n}') + ';return {kbRunTx};')('knowledge');
  const mk = which => {
    const stats = { closed: 0 };
    const store = { get: () => ({}), put() {}, delete() {} };
    const tx = { objectStore: () => store, error: new Error('boom') };
    const db = { close() { stats.closed++; }, transaction() { setTimeout(() => { const h = tx['on' + which]; if (h) h(); }, 0); return tx; } };
    return { db, stats };
  };
  global.__idbChecks = (async () => {
    const out = {};
    for (const w of ['complete', 'error', 'abort']) {
      const { db, stats } = mk(w);
      const r = await IDB.kbRunTx(db, 'readonly', () => {}).then(() => 'resolved', e => 'rejected:' + e.message);
      out[w] = { r, closed: stats.closed };
    }
    return out;
  })();
  t('all three storage helpers route through one transaction runner',
    S.split('return kbRunTx(db,').length - 1 === 3);
}

(async () => {
  const { r, peak, order } = await global.__poolCheck;
  t('pool returns results in input order, not completion order', r.join(',') === '0,2,4,6,8,10,12,14,16');
  t('pool never exceeds its width', peak <= 3);
  t('pool actually ran concurrently', peak > 1);
  t('pool processed every item', order.length === 9);
  t('an already-aborted signal rejects with AbortError', (await global.__abortCheck) === 'AbortError');
  {
    const r = await global.__partialCheck;
    t('a QuotaStop still propagates to the caller', r.name === 'QuotaStop');
    t('work completed before the failure is preserved on the error',
      Array.isArray(r.partial) && r.partial.length === 2);
    t('the preserved results are the ones that actually finished',
      r.partial.join(',') === 'done1,done2');
    t('callers read the partials rather than dropping them',
      S.split('=(e.partial||[]).filter(Boolean)').length - 1 === 2);
  }
  // v15.8: the case must be published BEFORE the audit pool, or auditRows short-circuits on
  // !caseStudy and no per-item verdict can render while the audit is running.
  t('the case is published before the audit runs',
    S.indexOf('setCaseStudy(parsed);') < S.indexOf('if(runAudit&&errCount===0){'));
  // v15.14: a SECOND publish is now correct and required. The repair rebuilds the case
  // immutably rather than mutating React state, so the new object has to be handed back or
  // the memoized exports keep serving pre-repair text. Exactly two: the publish before the
  // audit, and the republish inside the repair worker.
  t('the case is published twice: once up front, once per successful repair',
    S.split('setCaseStudy(parsed);').length - 1 === 2);
  t('the second publish is inside the repair path, after the audit gate',
    S.indexOf('setCaseStudy(parsed);', S.indexOf('if(runAudit&&errCount===0){')) > 0);
  t('the repair rebuilds the case instead of writing into React state',
    !S.includes('st.questions[ix]=fixed;') && S.includes('parsed={...parsed,stages:parsed.stages.map('));

  {
    const im = await global.__imgChecks;
    t('a small photo is passed through untouched',
      im.small.data === 'ORIGINALBYTES' && im.small.mimeType === 'image/jpeg' && !im.small.resized);
    t('no canvas available falls back to the original bytes rather than erroring',
      im.noCanvas.data === 'ORIGINALBYTES' && !im.noCanvas.resized);
    // HEIC: Chrome cannot decode it, and Gemini accepts it directly. A throw here must never
    // become a failed transcription.
    t('a decode failure falls back to the original bytes',
      im.threw.data === 'ORIGINALBYTES' && im.threw.mimeType === 'image/heic');
    t('an oversized photo is downscaled on its long edge and re-encoded as JPEG',
      im.big.data === 'SMALLER' && im.big.mimeType === 'image/jpeg' &&
      im.big.resized.from === '4032x3024' && im.big.resized.to === '3000x2250');
    t('a large FILE whose pixels are already small is not re-encoded',
      im.alreadySmall.data === 'ORIGINALBYTES' && !im.alreadySmall.resized);
  }
  {
    const s = await global.__poolStopCheck;
    t('a fatal stops the sibling lane from scheduling more work',
      s.name === 'QuotaStop' && s.started >= 2 && s.started <= 4);
    const late = await global.__poolLateCheck;
    t('a result finishing after the fatal still reaches the caller',
      Array.isArray(late) && late.includes('ok0'));
  }
  {
    const idb = await global.__idbChecks;
    t('a completed transaction resolves and closes the connection',
      idb.complete.r === 'resolved' && idb.complete.closed === 1);
    t('a failed transaction rejects and still closes the connection',
      /^rejected/.test(idb.error.r) && idb.error.closed === 1);
    // THE one that mattered: an unhandled onabort left the promise pending forever, which
    // pinned persistenceStatus on 'loading' and silently disabled every later KB save.
    t('an ABORTED transaction rejects rather than hanging forever',
      /^rejected/.test(idb.abort.r) && idb.abort.closed === 1);
  }
  t('the misleading "cannot leave a stale verdict" claim is gone',
    !S.includes('so a repaired case cannot leave a stale verdict on screen'));

  section('repository verification tooling');
  const baseline = JSON.parse(fs.readFileSync('prompt-baseline.json', 'utf8'));
  const frozenNames = Object.keys(baseline.prompts || {});
  t('the prompt baseline contains exactly 11 constants and excludes the tunable card prompt',
    frozenNames.length === 11 && !frozenNames.includes('CARD_TRANSCRIBE_PROMPT'));
  const resolvedSuite = resolveSuiteFile({ rootDir: process.cwd(), explicit: file });
  t('the shared resolver preserves an explicitly selected canonical suite HTML', resolvedSuite === file);
  t('the shared resolver recognises Proton Drive Name clash filenames',
    NAME_CLASH_RE.test('Nursing-Study-Suite v15.15 (# Name clash 1 #).html'));
  const harnessSources = ['latte-tests.js','neia-retest.js','davis-transcribe-test.js']
    .map(name => fs.readFileSync(name, 'utf8'));
  t('all three harnesses use the shared unambiguous suite resolver',
    harnessSources.every(text => text.includes("require('./tools/repo-checks')")));
  const promptDoc = fs.readFileSync('Prompts.md', 'utf8');
  t('the generated prompt appendix covers all extractor prompts and the card transcriber',
    ['NCLEX_INLINE_PROMPT','NCLEX_SPLIT_PROMPT','NCLEX_AI_PAIR_PROMPT','CARD_TRANSCRIBE_PROMPT']
      .every(name => promptDoc.includes('### `' + name + '`')));
  const verifier = fs.readFileSync('verify-repo.js', 'utf8');
  t('the unified verifier wires prompt hashes, prompt docs, the harness and Babel parse',
    ['checkFrozenPrompts','checkPromptDoc','runHarness','presets: [\'react\']']
      .every(anchor => verifier.includes(anchor)));

  console.log('\n════════════════════════════');
  const total = pass + fail;
  if (total !== EXPECTED_ASSERTIONS) {
    console.log('FAIL  harness executed ' + total + ' assertions; expected ' + EXPECTED_ASSERTIONS);
  }
  console.log(pass + ' passed · ' + fail + ' failed');
  process.exit(fail || total !== EXPECTED_ASSERTIONS ? 1 : 0);
})();
