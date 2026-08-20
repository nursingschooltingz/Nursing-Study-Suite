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
  ';return {CASE_CLINICAL_TOKEN_RE,CASE_CLINICAL_TERM_RE,scanUncitedProse,caseNormalizeClinical,caseAuditTextValues,caseAuditDatumValues,validateCaseStudy,validateStageTiming,NEIA_TERMINOLOGY_RULES,neiaTerminologyScan,CASE_SUPPORT_TYPES,caseParseThreshold,caseSplitValue,caseUnitsCompatible,caseThresholdSatisfied,caseItemHeuristics,caseContentWords,caseDifficultySignals};'
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
  t('instantiated 45 mL/hr against "below 30" → error', has(audit('Urine output 45 mL/hr', ['t-lt'], 'instantiated'), 'wrong side of the threshold', 'error'));
  t('instantiated against a fact with no comparator → error naming the missing threshold',
    has(audit('Potassium 2.4 mEq/L', ['t-none'], 'instantiated'), 'no parseable threshold', 'error'));
  t('range: 7.40 inside 7.35-7.45 → clean', audit('pH 7.40 units', ['t-ph'], 'instantiated').length === 0);
  t('range: 7.2 outside 7.35-7.45 → error', has(audit('pH 7.2 units', ['t-ph'], 'instantiated'), 'wrong side of the threshold', 'error'));
  t('BP pair 82/50 against "systolic below 90" → clean (systolic compared in mmHg)',
    audit('Blood pressure 82/50', ['t-bp'], 'instantiated').length === 0);
  t('BP pair 120/80 against "systolic below 90" → error',
    has(audit('Blood pressure 120/80', ['t-bp'], 'instantiated'), 'wrong side of the threshold', 'error'));

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
  const H = (q) => { const i = []; CASE.caseItemHeuristics(q, i, 'Q'); return i; };
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
  t('heuristics are wired into validateCaseStudy', S.includes('caseItemHeuristics(q,issues,qn);'));
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

console.log('\n════════════════════════════');
console.log(pass + ' passed · ' + fail + ' failed');
process.exit(fail ? 1 : 0);
