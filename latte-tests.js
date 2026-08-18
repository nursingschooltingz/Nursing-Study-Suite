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
  ';return {CASE_CLINICAL_TOKEN_RE,CASE_CLINICAL_TERM_RE,scanUncitedProse,caseNormalizeClinical,caseAuditTextValues,caseAuditDatumValues,validateCaseStudy,validateStageTiming};'
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
{ const i = []; CASE.caseAuditDatumValues({ label: 'Potassium', value: '2.4 mEq/L', factIds: ['fact-a'] }, IDX, 'Stage 1', i);
  t('fabricated 2.4 mEq/L on a monitor-only fact → warn', has(i, 'does not appear', 'warn')); }
{ const i = []; CASE.caseAuditDatumValues({ label: 'Heart rate', value: '120 bpm', factIds: ['fact-b'] }, IDX, 'Stage 1', i);
  t('"120 bpm" matches "120 beats per minute" via unit normalization', i.length === 0); }
{ const i = []; CASE.caseAuditDatumValues({ label: 'Urine output', value: '22 mL/hr', factIds: ['fact-c'] }, IDX, 'Stage 1', i);
  t('threshold instantiation (22 vs "<30") → warn (telemetry by design)', has(i, 'does not appear', 'warn')); }
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
t('rationale fabricating "2.4 mEq/L" against a monitor-only fact → entailment warn',
  has(V({ stages: [stage(1, [q({ type: 'MCQ', options: [{ label: 'A' }], correctAnswers: ['A'], rationales: [{ option: 'A', text: 'Incorrect because potassium is 2.4 mEq/L.', supportType: 'direct', factIds: ['fact-a'] }] })])] }, 'HF'), 'does not appear', 'warn'));
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

console.log('\n════════════════════════════');
console.log(pass + ' passed · ' + fail + ' failed');
process.exit(fail ? 1 : 0);
