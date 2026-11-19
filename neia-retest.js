#!/usr/bin/env node
/*
 * NEIA audit: manually authorized, quota-consuming Gemini test-retest measurement.
 * node neia-retest.js --dry-run [--app-profile] [--only sound-1,sound-2]
 * GEMINI_API_KEY=... node neia-retest.js --live [--runs 3] [--width 3]
 * Options: --runs 2..100, --width 1..100, --model ID, --level low|medium|high|xhigh,
 * --html <suite.html>, --app-profile, --only <id,id>, --out <report.json>,
 * --retryms 0..600000, --rpm 0..60000 (0 = unthrottled; fractional rates allowed).
 *
 * CLI baseline is Neon/high (v21.10; v17.13–v21.9 used Argon/high and earlier reports used 3.1 Pro/high). --app-profile resolves the shipped
 * itemAudit model/level, not saved browser overrides. No profile is changed in the app.
 * --dry-run needs no key, sends nothing, and writes no report.
 * --live prevents accidents; per-run human authorization is still required.
 * Exit 0: complete measurement/dry-run/help; 1: fatal; 2: invalid invocation;
 * 3: incomplete measurement. Errors never count as verdict flips.
 * Importing this module is offline and has no filesystem/output side effects.
 * No result is comparable to published ICC or external accuracy figures.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveSuiteFile, sha256, parseMeasurementArgs, resolveMeasurementProfile,
  measurementPlan, createMeasurementPacer, measurementOutputCap,
  MEASUREMENT_SAFETY_SETTINGS, redactSecrets, cliRetryDelayMs, writePrivateReport } = require('./tools/repo-checks');
const parseArgs = argv => parseMeasurementArgs(argv, 'neia');
const SAFETY = MEASUREMENT_SAFETY_SETTINGS;

function spanFrom(source, startAnchor, endAnchor) {
  const a = source.indexOf(startAnchor);
  if (a < 0) throw new Error('Start anchor missing: ' + startAnchor);
  const b = source.indexOf(endAnchor, a + startAnchor.length);
  if (b < 0) throw new Error('End anchor missing after: ' + startAnchor);
  return source.slice(a, b + endAnchor.length);
}
function extractAudit(source) {
  const markdown = spanFrom(source, 'function caseToMarkdown(', "\n  return L.join('\\n');\n}");
  const audit = spanFrom(source, 'function caseIsGateEligible(', '/* ── END CASE STUDY PURE HELPERS ── */');
  const result = new Function('CASE_QUESTION_RULES', 'caseRenderFactPacket', markdown + audit +
    ';return {caseAuditPayload,itemBuildAuditPrompt,itemSplitAuditPrompt,itemParseAuditVerdict,caseIsGateEligible,itemAuditSummary};')('', () => '');
  if (typeof result.itemAuditSummary !== 'function') throw new Error('Audit extraction tail missing: itemAuditSummary');
  return result;
}
function selectItems(fixture, only, audit) {
  if (!fixture || !Array.isArray(fixture.items)) throw new Error('Fixture has no items array');
  const missing = only.filter(id => !fixture.items.some(item => item.id === id));
  if (missing.length) throw new Error('Unknown fixture item ID(s): ' + missing.join(', '));
  const items = fixture.items.filter(item => !only.length || only.includes(item.id));
  if (!items.length) throw new Error('No fixture items selected');
  for (const item of items) {
    const q = item.case && item.case.stages && item.case.stages[0] && item.case.stages[0].questions && item.case.stages[0].questions[0];
    if (!q || !audit.caseIsGateEligible(q)) throw new Error('Fixture item ' + item.id + ' is not gate-eligible');
  }
  return items;
}
function prepareJobs(items, runs, audit) {
  const jobs = [];
  for (const item of items) {
    const question = item.case.stages[0].questions[0];
    const prompt = audit.itemBuildAuditPrompt(audit.caseAuditPayload(item.case, 1, question));
    if (!prompt.trim()) throw new Error('Empty item audit prompt: ' + item.id);
    for (let run = 0; run < runs; run++) jobs.push({ item, run, prompt, promptHash: sha256(prompt) });
  }
  return jobs;
}
function createAuditCaller(config, key, deps = {}) {
  const fetchFn = deps.fetch || globalThis.fetch;
  const sleep = deps.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const rand = deps.random || Math.random;
  const now = deps.now || Date.now, pace = createMeasurementPacer(config.rpm, { now, sleep });
  let storeUnsupported = false;
  return async function callOnce(prompt, observation) {
    if (!config.live || config.dryRun) throw new Error('Live audit requires --live and per-run human authorization');
    // v21.10 (Phase 5 M17): align wire format with shipped itemAudit (static rubric in systemInstruction when marker present), encode model ID, catch transient fetch rejections, honor 4-attempt ceiling, and respect cliRetryDelayMs 600s cap.
    const promptStr = String(prompt || '');
    const splitMarker = '\n\n═══ THE CASE, AS THE STUDENT SEES IT ═══\n';
    const cut = promptStr.indexOf(splitMarker);
    const body = {
      ...(cut > 0 ? { systemInstruction: { parts: [{ text: promptStr.slice(0, cut) }] } } : {}),
      contents: [{ parts: [{ text: cut > 0 ? promptStr.slice(cut + 2) : promptStr }] }],
      generationConfig: { maxOutputTokens: measurementOutputCap(config.model), thinkingConfig: { thinkingLevel: config.level } },
      safetySettings: SAFETY,
      ...(storeUnsupported ? {} : { store: false })
    };
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(String(config.model)) + ':generateContent';
    const started = now();
    let resp, retriedStore = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      await pace();
      observation.attempts++;
      const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(900000) : undefined;
      try {
        resp = await fetchFn(url, { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {}) });
      } catch (fetchErr) {
        if (attempt === 3) throw fetchErr;
        await sleep(cliRetryDelayMs(null, null, config.retryms, attempt, rand));
        continue;
      }
      if (resp.ok) break;
      const errBody = typeof resp.json === 'function' ? await resp.json().catch(() => null) : null;
      const errMsg = String((errBody && errBody.error && errBody.error.message) || '');
      if (resp.status === 400 && body.store === false && !retriedStore && /\bstore\b/i.test(errMsg)) {
        storeUnsupported = true;
        retriedStore = true;
        delete body.store;
        if (attempt < 3) continue;
      }
      if ((resp.status !== 429 && resp.status < 500) || attempt === 3) throw new Error('HTTP ' + resp.status);
      await sleep(cliRetryDelayMs(errBody, resp.headers, config.retryms, attempt, rand));
    }
    const response = await resp.json(), candidate = (response.candidates || [])[0] || {};
    observation.finishReason = candidate.finishReason || '';
    if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Output truncated (MAX_TOKENS)');
    const text = ((candidate.content || {}).parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    if (!text.trim()) throw new Error('Empty audit response');
    const usage = response.usageMetadata || {};
    return { text, ms: now() - started, tokensIn: usage.promptTokenCount || 0,
      tokensOut: usage.candidatesTokenCount || 0, tokensThought: usage.thoughtsTokenCount || 0 };
  };
}
async function pool(items, width, worker) {
  if (!Number.isInteger(width) || width < 1) throw new Error('Pool width must be a positive integer');
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await worker(items[i], i); }
  }));
  return out;
}
function analyzeResults(results, requestedRuns, expectedIds) {
  if (!Number.isInteger(requestedRuns) || requestedRuns < 2) throw new Error('At least two requested runs are required');
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

    // v21.10 (Phase 5 M17): compute latency/token means over successful runs (ok) so ERROR rows (which record 0s) never deflate means.
    const meanOf = fn => ok.length ? Math.round(ok.reduce((a, r) => a + fn(r), 0) / ok.length) : 0;
    rows.push({ id, band, seededCriterion: seeded, statuses, uniqueStatuses: uniqStatus,
      failCriteria: uniqCrit, flipped, measurable, okRuns: ok.length,
      meanMs: meanOf(r => r.ms),
      meanTokensIn: meanOf(r => r.tokensIn),
      meanTokensOut: meanOf(r => r.tokensOut),
      meanTokensThought: meanOf(r => r.tokensThought) });
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


  const ids = expectedIds || [...byItem.keys()];
  const completeItems = ids.filter(id => {
    const rs = byItem.get(id) || [];
    return rs.length === requestedRuns && rs.every(r => r.status !== 'ERROR') &&
      new Set(rs.map(r => r.run)).size === requestedRuns;
  }).length;
  const conclusive = ids.length > 0 && completeItems === ids.length;
  return { rows, demotionCandidates: unstable, labelDrift, conclusive, exitCode: conclusive ? 0 : 3,
    conclusion: conclusive ? 'Requested repeated audits completed; stability is not external accuracy.'
      : 'INCOMPLETE: requested successful audit count was not reached for every item; no overall stability conclusion.',
    totals: { items: ids.length, measurableItems: rows.length - insufficient, completeItems,
      incompleteItems: ids.length - completeItems, logicalOperations: results.length,
      observedAttempts: results.reduce((n, r) => n + (r.attempts || 0), 0),
      statusFlips, criterionFlips, falseFatal, falseFatalOf: soundRuns, missedDefect, missedDefectOf: seededRuns,
      accuracyDisagree, plausibilityDisagree, errors } };
}
async function runMeasurement(config, jobs, audit, callOnce) {
  const results = await pool(jobs, config.width, async job => {
    const observation = { attempts: 0, finishReason: '' };
    const base = { id: job.item.id, band: job.item.band, seeded: job.item.seededCriterion,
      run: job.run, promptHash: job.promptHash };
    try {
      const result = await callOnce(job.prompt, observation);
      // The app keeps malformed verdicts inspectable as REVIEW. A measurement must not
      // treat a missing verdict as a completed rating merely because of that UI fallback.
      if (!/^(?:PASS\b|FAIL\s*[—–\-:]\s*\S|REVIEW\s*[—–\-:]\s*\S)/im.test(result.text)) {
        throw new Error('Audit response has no explicit verdict');
      }
      const verdict = audit.itemParseAuditVerdict(result.text);
      return { ...base, ...observation, status: verdict.status, criterion: verdict.criterion,
        detail: verdict.detail, warnCriteria: (verdict.warns || []).map(w => w.criterion),
        ms: result.ms, tokensIn: result.tokensIn, tokensOut: result.tokensOut,
        tokensThought: result.tokensThought, raw: result.text };
    } catch (error) {
      return { ...base, ...observation, status: 'ERROR', criterion: '', detail: String(error.message || error),
        warnCriteria: [], ms: 0, tokensIn: 0, tokensOut: 0, tokensThought: 0, raw: '' };
    }
  });
  return { ...analyzeResults(results, config.runs, [...new Set(jobs.map(job => job.item.id))]), raw: results };
}
function printSummary(summary, log) {
  log(summary.conclusion);
  log(JSON.stringify(summary.totals, null, 2));
  for (const row of summary.rows) log(row.id + ': ' + row.statuses.join(', ') +
    (row.measurable ? row.flipped ? ' (verdict flip)' : '' : ' (insufficient comparison)'));
  if (summary.demotionCandidates.length) {
    log('Criteria with observed verdict instability (human review required):');
    for (const candidate of summary.demotionCandidates) log(candidate.criterion + ': ' + candidate.firedIn);
  } else {
    log(summary.conclusive ? 'No verdict-instability candidates observed in the completed comparisons.'
      : 'No verdict-instability candidates observed in available comparisons; incomplete evidence cannot establish stability.');
  }
  for (const row of summary.labelDrift) log('Label drift only: ' + row.id + ': ' + row.criteria.join(' / '));
}
async function main(argv = process.argv.slice(2), deps = {}) {
  const log = deps.log || console.log, errorLog = deps.error || console.error;
  const readFile = deps.readFile || fs.readFileSync, writeFile = deps.writeFile || fs.writeFileSync;
  let config, measuring = false;
  try {
    config = parseArgs(argv);
    if (config.help) {
      log('NEIA: --dry-run | --live [--runs 2..100] [--width 1..100] [--app-profile | --model ID --level high] [--only id,id] [--html suite.html] [--out report.json] [--retryms 0..600000] [--rpm 0..60000]. Exit 3 means incomplete measurement.');
      return 0;
    }
    if (!config.live && !config.dryRun) throw new Error('Use --dry-run to inspect the plan, or --live only after per-run human authorization');
    const key = (deps.env || process.env).GEMINI_API_KEY || '';
    if (config.live && !key) throw new Error('Set GEMINI_API_KEY in the environment');
    const root = deps.cwd || process.cwd();
    const suiteFile = (deps.resolveSuite || resolveSuiteFile)({ rootDir: root, explicit: config.suite });
    const source = readFile(suiteFile, 'utf8'), audit = extractAudit(source);
    const fixture = JSON.parse(readFile(path.join(root, 'neia-fixture.json'), 'utf8'));
    const items = selectItems(fixture, config.only, audit), jobs = prepareJobs(items, config.runs, audit);
    const profile = resolveMeasurementProfile(config, source, 'itemAudit');
    config = { ...config, ...profile };
    const plan = { ...measurementPlan(config, items.length, profile),
      promptHashes: jobs.filter(job => job.run === 0).map(job => ({ id: job.item.id, sha256: job.promptHash })) };
    log(JSON.stringify(plan, null, 2));
    if (config.dryRun) return 0;
    log('--live does not replace the required human authorization for this run.');
    measuring = true;
    const summary = await runMeasurement(config, jobs, audit, createAuditCaller(config, key, deps));
    const report = { generatedAt: new Date().toISOString(),
      config: { model: config.model, thinkingLevel: config.level, runs: config.runs,
        width: config.width, html: path.basename(suiteFile), profile: config.profile }, plan,
      caveat: fixture.referenceStandardCaveat,
      noPublishedComparison: 'No figure here may be compared to any published ICC or accuracy value. The June 2026 study tested zero Gemini configurations.',
      ...summary };
    const reportText = redactSecrets(JSON.stringify(report, null, 2), key);
    writePrivateReport(config.out, reportText, deps.writeFile);
    printSummary(JSON.parse(reportText), log);
    log('Full private report: ' + config.out);
    return summary.exitCode;
  } catch (error) {
    const key = (deps.env || process.env).GEMINI_API_KEY || '';
    errorLog(redactSecrets(error.message || error, key));
    return measuring ? 1 : 2;
  }
}
module.exports = { parseArgs, spanFrom, extractAudit, selectItems, prepareJobs, createAuditCaller,
  pool, analyzeResults, runMeasurement, printSummary, main };
if (require.main === module) main().then(code => { process.exitCode = code; },
  error => { console.error(redactSecrets(error && error.message || error, process.env.GEMINI_API_KEY || '')); process.exitCode = 1; });
