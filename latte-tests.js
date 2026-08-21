#!/usr/bin/env node
/*
 * LATTE Study Suite — regression test harness (v15.2)
 * Usage:  node latte-tests.js [path/to/LATTE-Study-Suite-*.html or Nursing-Study-Suite-*.html]
 * With no argument it picks the newest LATTE-Study-Suite*.html or Nursing-Study-Suite*.html in the current folder.
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

let file = process.argv[2];
if (!file) {
  const cands = fs.readdirSync('.').filter(f => /^(LATTE-Study-Suite|Nursing-Study-Suite).*\.html$/i.test(f)).sort();
  file = cands[cands.length - 1];
}
if (!file || !fs.existsSync(file)) {
  console.error('usage: node latte-tests.js <LATTE-Study-Suite or Nursing-Study-Suite html>'); process.exit(2);
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
const nclexDedup = new Function(spanFrom('function nclexDedup', '\n}') + ';return nclexDedup;')();
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
}
t('KB path uses pdfLayoutText, not the naive join',
  S.includes("'\\n--- PAGE '+i+' ---\\n'+pdfLayoutText(tc)") && !S.includes("+tc.items.map(x=>x.str).join(' ')"));
t('default Flash model is gemini-3.7-flash', /useState\('gemini-3\.7-flash'\)/.test(S));

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
  t('a cleared lint re-enables keep',S.includes('if(hadLint&&!next.lint.length)next.keep=true;'));
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
  t('a release helper exists',S.includes('function destroyAllPdfDocs()'));
  t('the registry is cleared after release',S.includes('_pdfLiveDocs.clear();'));
  t('both PDF-opening tools release on unmount',
    S.split('useEffect(()=>()=>destroyAllPdfDocs(),[]);').length-1===2);
  t('the cache stays a WeakMap so Files are never pinned',S.includes('const _pdfDocCache=new WeakMap();'));
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
  t('the case is published exactly once',
    S.split('setCaseStudy(parsed);').length - 1 === 1);
  t('the misleading "cannot leave a stale verdict" claim is gone',
    !S.includes('so a repaired case cannot leave a stale verdict on screen'));

  console.log('\n════════════════════════════');
  console.log(pass + ' passed · ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
