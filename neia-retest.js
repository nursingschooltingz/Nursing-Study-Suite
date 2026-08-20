#!/usr/bin/env node
/*
 * NEIA audit — Gemini test-retest harness (v15.6, item 8)
 *
 * Usage:
 *   GEMINI_API_KEY=... node neia-retest.js [--runs 3] [--model gemini-3.1-pro-preview]
 *                                          [--level high] [--width 3] [--html <file>]
 *                                          [--only <id,id>] [--out <file.json>]
 *
 * WHY THIS EXISTS
 * No published figure establishes audit reliability for this build. The June 2026
 * reliability study tested five OpenAI and two Anthropic configurations and ZERO Gemini,
 * and it lists intra-rater reliability as unmeasured while calling it "a foundational
 * property for operational use". Whether one configuration scores the same item the same
 * way twice is the most operationally relevant unknown for a gate you run continuously.
 * Nothing this script reports may be compared to any published ICC or accuracy figure.
 *
 * WHAT IT DOES NOT DO
 * It does not decide anything. It measures flip rates so a human can decide which criteria
 * are stable enough to keep at FAIL. Per the brief: any criterion whose verdict flips
 * across identical runs is demoted from FAIL to WARN until it stabilises.
 *
 * COST WARNING: runs (fixture items x runs) live API calls. Default 10 x 3 = 30 calls, at
 * Pro + high reasoning. This is NOT part of `node latte-tests.js` and never runs in CI.
 *
 * Like latte-tests.js, this extracts the REAL prompt builders from the shipped HTML by
 * anchor string and never keeps a copy — if an anchor moves it fails loudly at extraction.
 * Built-in modules only; no dependencies.
 */
'use strict';
const fs = require('fs');

/* ── args ── */
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const RUNS = Number(arg('runs', 3));
const MODEL = arg('model', 'gemini-3.1-pro-preview');
const LEVEL = arg('level', 'high');
const WIDTH = Number(arg('width', 3));
const ONLY = (arg('only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const OUT = arg('out', 'neia-retest-report.json');
const KEY = process.env.GEMINI_API_KEY || '';

if (!KEY) {
  console.error('Set GEMINI_API_KEY in the environment. The key is never written to the report.');
  process.exit(2);
}

let htmlFile = arg('html', '');
if (!htmlFile) {
  const cands = fs.readdirSync('.').filter(f => /^(LATTE-Study-Suite|Nursing-Study-Suite).*\.html$/i.test(f)).sort();
  htmlFile = cands[cands.length - 1];
}
if (!htmlFile || !fs.existsSync(htmlFile)) { console.error('No suite HTML found. Pass --html <file>.'); process.exit(2); }
if (!fs.existsSync('neia-fixture.json')) { console.error('neia-fixture.json not found.'); process.exit(2); }

const S = fs.readFileSync(htmlFile, 'utf8');
const FIX = JSON.parse(fs.readFileSync('neia-fixture.json', 'utf8'));

/* ── extraction: the real functions, never a copy ── */
function spanFrom(startAnchor, endAnchor) {
  const a = S.indexOf(startAnchor); if (a < 0) throw new Error('start anchor missing: ' + startAnchor);
  const b = S.indexOf(endAnchor, a + startAnchor.length); if (b < 0) throw new Error('end anchor missing after: ' + startAnchor);
  return S.slice(a, b + endAnchor.length);
}
const AUDIT = new Function('CASE_QUESTION_RULES', 'caseRenderFactPacket',
  spanFrom('function caseToMarkdown(', '\n  return L.join(\'\\n\');\n}') +
  spanFrom('function caseIsGateEligible(', 'function CaseStudyGenerator()')
    .replace(/function CaseStudyGenerator\(\)$/, '') +
  ';return {caseAuditPayload,itemBuildAuditPrompt,itemParseAuditVerdict,caseIsGateEligible};'
)('', () => '');

const SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// Matches the app's request shape. Transport differs from the in-app wrapper (no streaming,
// no watchdog) on purpose — what is being measured is verdict stability, not transport.
async function callOnce(prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 65536, thinkingConfig: { thinkingLevel: LEVEL } },
    safetySettings: SAFETY,
  };
  const t0 = Date.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text()).slice(0, 300));
  const j = await resp.json();
  const text = (((j.candidates || [])[0] || {}).content || {}).parts
    ? j.candidates[0].content.parts.map(p => p.text || '').join('')
    : '';
  const um = j.usageMetadata || {};
  return { text, ms, tokensIn: um.promptTokenCount || 0, tokensOut: um.candidatesTokenCount || 0,
    tokensThought: um.thoughtsTokenCount || 0 };
}

async function pool(items, width, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(width, items.length || 1)) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await worker(items[i], i); }
  }));
  return out;
}

/* ── build the work list ── */
const items = FIX.items.filter(it => !ONLY.length || ONLY.includes(it.id));
for (const it of items) {
  const q = it.case.stages[0].questions[0];
  if (!AUDIT.caseIsGateEligible(q)) { console.error('Fixture item ' + it.id + ' is not gate-eligible.'); process.exit(2); }
}
const jobs = [];
for (const it of items) for (let r = 0; r < RUNS; r++) jobs.push({ it, run: r });

console.log('NEIA test-retest — ' + items.length + ' item(s) x ' + RUNS + ' run(s) = ' + jobs.length + ' live API calls');
console.log('model=' + MODEL + '  thinkingLevel=' + LEVEL + '  width=' + WIDTH + '  html=' + htmlFile);
console.log('Reference classifications are in-house; see referenceStandardCaveat in the fixture.\n');

/* ── run ── */
(async () => {
  const results = await pool(jobs, WIDTH, async (job) => {
    const q = job.it.case.stages[0].questions[0];
    const payload = AUDIT.caseAuditPayload(job.it.case, 1, q);
    const prompt = AUDIT.itemBuildAuditPrompt(payload);
    try {
      const r = await callOnce(prompt);
      const v = AUDIT.itemParseAuditVerdict(r.text);
      process.stdout.write(v.status === 'PASS' ? '.' : v.status === 'FAIL' ? 'F' : v.status === 'REVIEW' ? '?' : 'x');
      return { id: job.it.id, band: job.it.band, seeded: job.it.seededCriterion, run: job.run,
        status: v.status, criterion: v.criterion, detail: v.detail,
        warnCriteria: (v.warns || []).map(w => w.criterion),
        ms: r.ms, tokensIn: r.tokensIn, tokensOut: r.tokensOut, tokensThought: r.tokensThought, raw: r.text };
    } catch (e) {
      process.stdout.write('!');
      return { id: job.it.id, band: job.it.band, seeded: job.it.seededCriterion, run: job.run,
        status: 'ERROR', criterion: '', detail: e.message || String(e), warnCriteria: [], ms: 0,
        tokensIn: 0, tokensOut: 0, tokensThought: 0, raw: '' };
    }
  });
  console.log('\n');

  /* ── analysis ── */
  const byItem = new Map();
  for (const r of results) { if (!byItem.has(r.id)) byItem.set(r.id, []); byItem.get(r.id).push(r); }

  const rows = [];
  let statusFlips = 0, criterionFlips = 0, falseFatal = 0, missedDefect = 0;
  let accuracyDisagree = 0, plausibilityDisagree = 0, errors = 0;

  for (const [id, rs] of byItem) {
    const statuses = rs.map(r => r.status);
    const uniqStatus = [...new Set(statuses)];
    const crits = rs.filter(r => r.status === 'FAIL').map(r => r.criterion);
    const uniqCrit = [...new Set(crits)];
    const band = rs[0].band, seeded = rs[0].seeded;
    const flipped = uniqStatus.length > 1;
    if (flipped) statusFlips++;
    if (uniqCrit.length > 1) criterionFlips++;
    errors += rs.filter(r => r.status === 'ERROR').length;

    // Band-specific error rates. Borderline items are deliberately excluded from every
    // accuracy metric: they exist to show the gate does NOT discriminate there, and scoring
    // them would be tuning toward the exact boundary the published data says is unreliable.
    if (band === 'sound') falseFatal += rs.filter(r => r.status === 'FAIL').length;
    if (band === 'seeded') missedDefect += rs.filter(r => r.status === 'PASS').length;

    // Per-criterion disagreement across identical runs, for the two domains the June study
    // measured as the AI's weakest (Correct Answer 0.575, Distractors 0.524).
    const mentions = k => rs.filter(r =>
      (r.criterion && k.test(r.criterion)) || (r.warnCriteria || []).some(c => k.test(c))).length;
    const acc = mentions(/answer\s*accuracy|correct\s*answer/i);
    const pla = mentions(/plausib/i);
    if (acc > 0 && acc < rs.length) accuracyDisagree++;
    if (pla > 0 && pla < rs.length) plausibilityDisagree++;

    rows.push({ id, band, seededCriterion: seeded, statuses, uniqueStatuses: uniqStatus,
      failCriteria: uniqCrit, flipped,
      meanMs: Math.round(rs.reduce((a, r) => a + r.ms, 0) / rs.length),
      meanTokensIn: Math.round(rs.reduce((a, r) => a + r.tokensIn, 0) / rs.length),
      meanTokensOut: Math.round(rs.reduce((a, r) => a + r.tokensOut, 0) / rs.length),
      meanTokensThought: Math.round(rs.reduce((a, r) => a + r.tokensThought, 0) / rs.length) });
  }

  // Which criteria were unstable — this is the list that drives FAIL -> WARN demotion.
  const critRuns = new Map();
  for (const [, rs] of byItem)
    for (const r of rs) {
      const c = r.status === 'FAIL' ? r.criterion : null;
      if (!c) continue;
      const k = c.trim();
      if (!critRuns.has(k)) critRuns.set(k, { fired: 0, of: 0 });
    }
  for (const [k, v] of critRuns)
    for (const [, rs] of byItem) {
      const fired = rs.filter(r => r.status === 'FAIL' && r.criterion.trim() === k).length;
      if (fired > 0) { v.fired += fired; v.of += rs.length; }
    }
  const unstable = [...critRuns.entries()]
    .filter(([, v]) => v.fired > 0 && v.fired < v.of)
    .map(([k, v]) => ({ criterion: k, firedIn: v.fired + '/' + v.of }));

  const sound = rows.filter(r => r.band === 'sound').length * RUNS;
  const seededN = rows.filter(r => r.band === 'seeded').length * RUNS;
  const pad = (s, n) => String(s).padEnd(n);

  console.log('── per item ──');
  console.log(pad('id', 34) + pad('band', 12) + pad('verdicts', 22) + 'flip');
  for (const r of rows)
    console.log(pad(r.id, 34) + pad(r.band, 12) + pad(r.statuses.join(','), 22) + (r.flipped ? 'YES' : '-'));

  console.log('\n── stability ──');
  console.log('  items whose overall verdict flipped across identical runs : ' + statusFlips + '/' + rows.length);
  console.log('  items whose FAIL criterion changed between runs           : ' + criterionFlips + '/' + rows.length);
  console.log('  answer-accuracy disagreement (raised in some runs only)   : ' + accuracyDisagree + '/' + rows.length);
  console.log('  distractor-plausibility disagreement                      : ' + plausibilityDisagree + '/' + rows.length);

  console.log('\n── accuracy against the in-house reference ──');
  console.log('  false fatal failures on sound items  : ' + falseFatal + '/' + sound);
  console.log('  missed defects on seeded items       : ' + missedDefect + '/' + seededN);
  console.log('  call errors                          : ' + errors + '/' + results.length);
  console.log('  (borderline items are deliberately excluded from both rates)');

  const allMs = results.filter(r => r.ms).map(r => r.ms);
  if (allMs.length) {
    const mean = Math.round(allMs.reduce((a, b) => a + b, 0) / allMs.length);
    console.log('\n── cost ──');
    console.log('  mean latency per audit : ' + (mean / 1000).toFixed(1) + 's  (min ' +
      (Math.min(...allMs) / 1000).toFixed(1) + 's, max ' + (Math.max(...allMs) / 1000).toFixed(1) + 's)');
    console.log('  mean tokens in/out/thought : ' +
      Math.round(results.reduce((a, r) => a + r.tokensIn, 0) / results.length) + ' / ' +
      Math.round(results.reduce((a, r) => a + r.tokensOut, 0) / results.length) + ' / ' +
      Math.round(results.reduce((a, r) => a + r.tokensThought, 0) / results.length));
  }

  if (unstable.length) {
    console.log('\n── DEMOTION CANDIDATES ──');
    console.log('  These criteria fired inconsistently across identical runs. Per the v15.6 brief,');
    console.log('  demote each from FAIL to WARN until it stabilises:');
    for (const u of unstable) console.log('    · ' + u.criterion + '  (fired in ' + u.firedIn + ' runs of the items it touched)');
  } else {
    console.log('\n── DEMOTION CANDIDATES ──\n  None: every criterion that fired did so in every run of the items it touched.');
  }

  const report = {
    generatedAt: new Date().toISOString(),
    config: { model: MODEL, thinkingLevel: LEVEL, runs: RUNS, width: WIDTH, html: htmlFile },
    caveat: FIX.referenceStandardCaveat,
    noPublishedComparison: 'No figure here may be compared to any published ICC or accuracy value. The June 2026 study tested zero Gemini configurations.',
    totals: { items: rows.length, calls: results.length, statusFlips, criterionFlips,
      falseFatal, falseFatalOf: sound, missedDefect, missedDefectOf: seededN,
      accuracyDisagree, plausibilityDisagree, errors },
    demotionCandidates: unstable,
    rows,
    raw: results,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('\nFull report (including raw model output) written to ' + OUT);
  console.log('This file is gitignored — it contains model output, not source material.');
})().catch(e => { console.error('\n' + (e.stack || e.message || e)); process.exit(1); });
