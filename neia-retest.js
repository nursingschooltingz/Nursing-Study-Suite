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
const RETRY_MS = Number(arg('retryms', 20000)); // base backoff; doubles each attempt
const RPM = Number(arg('rpm', 0)); // 0 = unthrottled; otherwise cap request STARTS per minute

// Global pacer. Free-tier Gemini limits are per-minute and per-day, and a concurrency pool
// alone cannot respect either: width 3 at ~6s latency bursts ~28 requests/minute. This
// serialises the *start* of every request so the pool still overlaps waiting, but never
// exceeds the requested rate. --rpm 10 is a reasonable free-tier Pro setting.
let _lastStart = 0;
async function pace() {
  if (!RPM) return;
  const gap = 60000 / RPM;
  const wait = Math.max(0, _lastStart + gap - Date.now());
  _lastStart = Date.now() + wait;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}
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
  // Retry on 429/5xx with backoff. The first run of this harness lost 4 of 30 calls to
  // free-tier quota exhaustion, and a lost call is worse than a slow one here: it reads to
  // the analysis as a rater who changed their mind, which is exactly the thing being measured.
  const t0 = Date.now();
  let resp, lastBody = '';
  for (let attempt = 0; attempt <= 3; attempt++) {
    await pace();
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(body),
    });
    if (resp.ok) break;
    lastBody = (await resp.text()).slice(0, 300);
    if (resp.status !== 429 && resp.status < 500) break; // not retryable
    if (attempt === 3) break;
    const wait = RETRY_MS * Math.pow(2, attempt);
    process.stdout.write('r');
    await new Promise(r => setTimeout(r, wait));
  }
  const ms = Date.now() - t0;
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + lastBody);
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
  let soundRuns = 0, seededRuns = 0;
  let accuracyDisagree = 0, plausibilityDisagree = 0, errors = 0;

  let insufficient = 0;
  for (const [id, rs] of byItem) {
    const statuses = rs.map(r => r.status);
    // A call that never returned is NOT a rater who changed their mind. Errors are excluded
    // from every stability and accuracy figure; an item with fewer than two successful runs
    // has no measurable consistency at all and is reported separately.
    const ok = rs.filter(r => r.status !== 'ERROR');
    const uniqStatus = [...new Set(ok.map(r => r.status))];
    const crits = ok.filter(r => r.status === 'FAIL').map(r => r.criterion);
    const uniqCrit = [...new Set(crits)];
    const band = rs[0].band, seeded = rs[0].seeded;
    const measurable = ok.length >= 2;
    const flipped = measurable && uniqStatus.length > 1;
    if (!measurable) insufficient++;
    if (flipped) statusFlips++;
    if (measurable && uniqCrit.length > 1) criterionFlips++;
    errors += rs.filter(r => r.status === 'ERROR').length;

    // Band-specific error rates. Borderline items are deliberately excluded from every
    // accuracy metric: they exist to show the gate does NOT discriminate there, and scoring
    // them would be tuning toward the exact boundary the published data says is unreliable.
    if (band === 'sound') { falseFatal += ok.filter(r => r.status === 'FAIL').length; soundRuns += ok.length; }
    if (band === 'seeded') { missedDefect += ok.filter(r => r.status === 'PASS').length; seededRuns += ok.length; }

    // Per-criterion disagreement across identical runs, for the two domains the June study
    // measured as the AI's weakest (Correct Answer 0.575, Distractors 0.524).
    const mentions = k => ok.filter(r =>
      (r.criterion && k.test(r.criterion)) || (r.warnCriteria || []).some(c => k.test(c))).length;
    const acc = mentions(/answer\s*accuracy|correct\s*answer/i);
    const pla = mentions(/plausib/i);
    if (measurable && acc > 0 && acc < ok.length) accuracyDisagree++;
    if (measurable && pla > 0 && pla < ok.length) plausibilityDisagree++;

    rows.push({ id, band, seededCriterion: seeded, statuses, uniqueStatuses: uniqStatus,
      failCriteria: uniqCrit, flipped, measurable, okRuns: ok.length,
      meanMs: Math.round(rs.reduce((a, r) => a + r.ms, 0) / rs.length),
      meanTokensIn: Math.round(rs.reduce((a, r) => a + r.tokensIn, 0) / rs.length),
      meanTokensOut: Math.round(rs.reduce((a, r) => a + r.tokensOut, 0) / rs.length),
      meanTokensThought: Math.round(rs.reduce((a, r) => a + r.tokensThought, 0) / rs.length) });
  }

  // Which criteria were unstable — this is the list that drives FAIL -> WARN demotion.
  // Denominators count SUCCESSFUL runs only. Counting a failed call here is what produced
  // three spurious demotion candidates on the first run of this harness: a criterion that
  // fired in 2 of 2 answered runs looked like "2/3" purely because the third call 429'd.
  // TWO DIFFERENT THINGS, deliberately not conflated:
  //
  //   VERDICT instability — the item passes in one run and fails in another. This is what
  //   gates, so this is what justifies demoting a criterion from FAIL to WARN.
  //
  //   LABEL drift — the verdict is stably FAIL across every run, but the auditor names a
  //   different criterion each time. Informational only. A defect can genuinely satisfy two
  //   criteria at once (a key that is too long is also an integration problem), so rotating
  //   between two true labels is not unreliability about whether the item is broken.
  //
  // The first run of this harness reported label drift as a demotion candidate and would
  // have weakened two criteria that never once disagreed about whether the item failed.
  const critRuns = new Map(), labelDrift = [];
  const touch = k => { if (!critRuns.has(k)) critRuns.set(k, { firedOnUnstable: 0, ofUnstable: 0 }); };
  for (const [id, rs] of byItem) {
    const ok = rs.filter(r => r.status !== 'ERROR');
    if (ok.length < 2) continue;
    const verdicts = new Set(ok.map(r => r.status));
    const crits = ok.filter(r => r.status === 'FAIL').map(r => r.criterion.trim()).filter(Boolean);
    const uniqCrits = [...new Set(crits)];
    if (verdicts.size > 1) {
      // Verdict genuinely flipped — every criterion implicated on this item is suspect.
      for (const k of uniqCrits) { touch(k); const v = critRuns.get(k);
        v.firedOnUnstable += crits.filter(c => c === k).length; v.ofUnstable += ok.length; }
    } else if (uniqCrits.length > 1) {
      labelDrift.push({ id, verdict: [...verdicts][0], criteria: uniqCrits, runs: ok.length });
    }
  }
  const unstable = [...critRuns.entries()]
    .filter(([, v]) => v.firedOnUnstable > 0 && v.firedOnUnstable < v.ofUnstable)
    .map(([k, v]) => ({ criterion: k, firedIn: v.firedOnUnstable + '/' + v.ofUnstable }));

  const sound = soundRuns, seededN = seededRuns;
  const pad = (s, n) => String(s).padEnd(n);

  console.log('── per item ──');
  console.log(pad('id', 34) + pad('band', 12) + pad('verdicts', 22) + 'flip');
  for (const r of rows)
    console.log(pad(r.id, 34) + pad(r.band, 12) + pad(r.statuses.join(','), 22) + (!r.measurable ? 'n/a' : r.flipped ? 'YES' : '-'));

  console.log('\n── stability ──');
  console.log('  items with enough successful runs to judge consistency    : ' + (rows.length - insufficient) + '/' + rows.length);
  console.log('  items whose overall verdict flipped across identical runs : ' + statusFlips + '/' + (rows.length - insufficient));
  console.log('  items where the FAIL label drifted (verdict still stable)  : ' + criterionFlips + '/' + (rows.length - insufficient));
  console.log('  answer-accuracy disagreement (raised in some runs only)   : ' + accuracyDisagree + '/' + (rows.length - insufficient));
  console.log('  distractor-plausibility disagreement                      : ' + plausibilityDisagree + '/' + (rows.length - insufficient));

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

  if (labelDrift.length) {
    console.log('\n── label drift (informational, NOT a demotion trigger) ──');
    console.log('  Verdict was stable across all runs; only the named criterion changed.');
    console.log('  A defect can satisfy two criteria at once, so this is not a disagreement');
    console.log('  about whether the item is broken.');
    for (const d of labelDrift)
      console.log('    · ' + d.id + '  ' + d.verdict + ' in ' + d.runs + '/' + d.runs + ' runs, labelled: ' + d.criteria.join(' / '));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    config: { model: MODEL, thinkingLevel: LEVEL, runs: RUNS, width: WIDTH, html: htmlFile },
    caveat: FIX.referenceStandardCaveat,
    noPublishedComparison: 'No figure here may be compared to any published ICC or accuracy value. The June 2026 study tested zero Gemini configurations.',
    totals: { items: rows.length, measurableItems: rows.length - insufficient, calls: results.length, statusFlips, criterionFlips,
      falseFatal, falseFatalOf: sound, missedDefect, missedDefectOf: seededN,
      accuracyDisagree, plausibilityDisagree, errors },
    demotionCandidates: unstable,
    labelDrift,
    rows,
    raw: results,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('\nFull report (including raw model output) written to ' + OUT);
  console.log('This file is gitignored — it contains model output, not source material.');
})().catch(e => { console.error('\n' + (e.stack || e.message || e)); process.exit(1); });
