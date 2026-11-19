#!/usr/bin/env node
/*
 * Davis flashcard transcription: manual, quota-consuming self-agreement measurement.
 * Run only after the user authorizes these images and this live run.
 *
 * node davis-transcribe-test.js card.jpg --dry-run [--app-profile]
 * GEMINI_API_KEY=... node davis-transcribe-test.js card.jpg --live --runs 2
 * Options: --runs 2..100, --model ID, --level low|medium|high|xhigh,
 * --app <suite.html>, --app-profile, --out <report.json>, --retryms 0..600000,
 * --rpm 0..60000 (0 = unthrottled; fractional positive rates allowed).
 *
 * --app-profile resolves the shipped cardTranscribe default, not saved browser overrides.
 * CLI payloads are ORIGINAL IMAGE BYTES. This does not measure the UI resize path:
 * UI resize acceptance must run the shipped cardFilePayload in a browser.
 * --dry-run reads no images, needs no key, sends nothing, and writes no report.
 * --live is an accident-prevention flag, not a substitute for per-run human authorization.
 * Exit status: 0 complete measurement/dry-run/help; 1 fatal failure; 2 invalid invocation;
 * 3 incomplete measurement (including any image with fewer than the requested successes).
 * Completed self-agreement, even with no observed drift, NEVER establishes accuracy.
 * Reports contain private transcripts and must stay gitignored.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveSuiteFile, extractPromptLiteral, sha256, parseMeasurementArgs,
  resolveMeasurementProfile, measurementPlan, createMeasurementPacer, measurementOutputCap,
  MEASUREMENT_SAFETY_SETTINGS, redactSecrets, cliRetryDelayMs, writePrivateReport } = require('./tools/repo-checks');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' };
const SAFETY = MEASUREMENT_SAFETY_SETTINGS;
const DEFAULT_CARD_SCHEMA = {
  type: 'object',
  required: ['face', 'category', 'cardNumber', 'sections', 'numerics', 'overallLegibility'],
  properties: {
    face: { type: 'string', enum: ['front', 'back', 'unknown'] },
    category: { type: ['string', 'null'] },
    cardNumber: { type: ['string', 'null'] },
    title: { type: ['string', 'null'] },
    pronunciation: { type: ['string', 'null'] },
    sections: { type: 'array', items: { type: 'object', required: ['key', 'bullets'], properties: { key: { type: 'string' }, heading: { type: ['string', 'null'] }, bullets: { type: 'array', items: { type: 'string' } }, legibility: { type: 'string', enum: ['clean', 'uncertain', 'unreadable'] } } } },
    numerics: { type: 'array', items: { type: 'object', required: ['value', 'context'], properties: { value: { type: 'string' }, context: { type: 'string' }, legibility: { type: 'string', enum: ['clean', 'uncertain', 'unreadable'] } } } },
    symbols: { type: 'array', items: { type: 'string' } },
    unreadable: { type: 'array', items: { type: 'string' } },
    overallLegibility: { type: 'string', enum: ['clean', 'uncertain', 'unreadable'] }
  }
};
function extractCardSchema(source) {
  if (typeof source !== 'string') return DEFAULT_CARD_SCHEMA;
  const start = source.indexOf('const CARD_TRANSCRIBE_JSON_SCHEMA=');
  if (start < 0) return DEFAULT_CARD_SCHEMA;
  const end = source.indexOf(';\nasync function cardTranscribe(', start);
  if (end < 0) return DEFAULT_CARD_SCHEMA;
  try {
    return new Function(source.slice(start, end + 1) + ';return CARD_TRANSCRIBE_JSON_SCHEMA;')();
  } catch {
    return DEFAULT_CARD_SCHEMA;
  }
}
const parseArgs = argv => parseMeasurementArgs(argv, 'davis');

function bulletsOf(t) {
  return (t.sections || []).flatMap(s => (s.bullets || []).map(b => s.key + ' :: ' + b));
}
function numericsOf(t) {
  return (t.numerics || []).map(n => String(n.value ?? '').trim() + ' (' + String(n.context ?? '').trim() + ')');
}
function compareRuns(runs) {
  const sets = runs.map(bulletsOf), numSets = runs.map(numericsOf);
  const allB = [...new Set(sets.flat())], allN = [...new Set(numSets.flat())];
  return {
    bulletCounts: sets.map(s => s.length),
    bulletsUnstable: allB.filter(b => !sets.every(s => s.includes(b))),
    numericCounts: numSets.map(s => s.length),
    numericsUnstable: allN.filter(n => !numSets.every(s => s.includes(n))),
    numericsAgreed: allN.filter(n => numSets.every(s => s.includes(n))),
    faces: [...new Set(runs.map(r => r.face))],
    cardIds: [...new Set(runs.map(r => String(r.category ?? '?') + ' #' + String(r.cardNumber ?? '?')))],
    legibility: runs.map(r => r.overallLegibility),
  };
}
function validateTranscript(value) {
  // v21.10 (Phase 5 M17): also validate overallLegibility enum and category/cardNumber string-or-null types to match shipped cardTranscribe schema.
  const nullableStr = v => v === null || v === undefined || typeof v === 'string';
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !['front', 'back', 'unknown'].includes(value.face) ||
      !['clean', 'uncertain', 'unreadable'].includes(value.overallLegibility) ||
      !nullableStr(value.category) || !nullableStr(value.cardNumber) ||
      !Array.isArray(value.sections) || !Array.isArray(value.numerics) ||
      !value.sections.every(s => s && typeof s.key === 'string' && Array.isArray(s.bullets) && s.bullets.every(b => typeof b === 'string')) ||
      !value.numerics.every(n => n && typeof n === 'object' && !Array.isArray(n) && n.value != null)) {
    throw new Error('Incomplete or malformed transcription response');
  }
  return value;
}
function summarizeImages(images, requestedRuns) {
  if (!Number.isInteger(requestedRuns) || requestedRuns < 2) throw new Error('At least two requested runs are required for comparison');
  const rows = images.map(image => {
    const runs = image.transcripts || [], errors = image.errors || [];
    const agreement = runs.length >= 2 ? compareRuns(runs) : null;
    return { ...image, agreement, successfulRuns: runs.length, comparable: runs.length >= 2,
      complete: runs.length === requestedRuns && !errors.length,
      measurementStatus: !runs.length ? 'failed' : runs.length === requestedRuns && !errors.length ? 'complete' : 'incomplete' };
  });
  const comparableImages = rows.filter(r => r.comparable).length;
  const failedImages = rows.filter(r => r.measurementStatus === 'failed').length;
  const incompleteImages = rows.filter(r => r.measurementStatus === 'incomplete').length;
  const completeImages = rows.filter(r => r.complete).length;
  const numericDrift = rows.some(r => r.agreement && r.agreement.numericsUnstable.length);
  const proseDrift = rows.some(r => r.agreement && r.agreement.bulletsUnstable.length);
  const identityDrift = rows.some(r => r.agreement && (r.agreement.faces.length > 1 || r.agreement.cardIds.length > 1));
  const conclusive = rows.length > 0 && completeImages === rows.length;
  const conclusion = !conclusive
    ? 'INCOMPLETE: requested successful comparison count was not reached for every image; no overall stability conclusion.'
    : numericDrift || proseDrift || identityDrift
      ? 'Drift observed between completed repeated transcriptions.'
      : 'No drift observed in the requested repeated transcriptions; transcription accuracy remains unmeasured.';
  return { images: rows, comparableImages, failedImages, incompleteImages, completeImages,
    conclusive, numericDrift, proseDrift, identityDrift, conclusion, exitCode: conclusive ? 0 : 3 };
}
function payloadMetadata(bytes, mimeType) {
  return { bytes: bytes.length, mimeType, sha256: sha256(bytes), dimensions: null,
    dimensionsNote: 'Original-byte CLI baseline; dimensions are not decoded.' };
}
function createTranscriber(config, prompt, key, deps = {}) {
  const readFile = deps.readFile || fs.readFileSync;
  const statFile = deps.statFile || (deps.readFile ? null : fs.statSync);
  const fetchFn = deps.fetch || globalThis.fetch;
  const sleep = deps.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const rand = deps.random || Math.random;
  const schema = deps.schema || DEFAULT_CARD_SCHEMA;
  const pace = createMeasurementPacer(config.rpm, { now: deps.now || Date.now, sleep });
  // v21.10 (Phase 5 M17): cache decoded image payloads across repeated --runs per image instead of re-reading and re-encoding every run.
  const payloadCache = new Map();
  let storeUnsupported = false;
  return async function transcribe(imgPath, observation) {
    if (!config.live || config.dryRun) throw new Error('Live transcription requires --live and per-run human authorization');
    const mimeType = MIME[path.extname(imgPath).toLowerCase()];
    if (!mimeType) throw new Error('Unsupported image type');
    let cached = payloadCache.get(imgPath);
    if (!cached) {
      if (typeof statFile === 'function') {
        const st = statFile(imgPath);
        if (st && Number.isFinite(st.size) && st.size > 15 * 1024 * 1024) {
          throw new Error('Image too large for an inline request: ' + (st.size / 1048576).toFixed(1) + ' MB');
        }
      }
      const bytes = readFile(imgPath);
      const meta = payloadMetadata(bytes, mimeType);
      if (bytes.length > 15 * 1024 * 1024) {
        observation.originalPayload = meta;
        observation.actualPayload = { ...meta, resized: false };
        throw new Error('Image too large for an inline request: ' + (bytes.length / 1048576).toFixed(1) + ' MB');
      }
      cached = { meta, base64: bytes.toString('base64') };
      payloadCache.set(imgPath, cached);
    }
    observation.originalPayload = cached.meta;
    observation.actualPayload = { ...cached.meta, resized: false };
    // v21.10 (Phase 5 M17): align wire format with shipped cardTranscribe (systemInstruction + responseJsonSchema + single inlineData part).
    const body = {
      systemInstruction: { parts: [{ text: prompt }] },
      contents: [{ parts: [{ inlineData: { mimeType, data: cached.base64 } }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        maxOutputTokens: measurementOutputCap(config.model),
        thinkingConfig: { thinkingLevel: config.level }
      },
      safetySettings: SAFETY,
      ...(storeUnsupported ? {} : { store: false })
    };
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(String(config.model)) + ':generateContent';
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
      // v21.10 (Phase 5 M17): honor maxAttemptsPerOperation === 4 strictly (never attempt-- on store:false 400 fallback).
      if (resp.status === 400 && body.store === false && !retriedStore && /\bstore\b/i.test(errMsg)) {
        storeUnsupported = true;
        retriedStore = true;
        delete body.store;
        if (attempt < 3) continue;
      }
      // Do not copy an upstream error body into a report: it can echo request data.
      if ((resp.status !== 429 && resp.status < 500) || attempt === 3) throw new Error('HTTP ' + resp.status);
      await sleep(cliRetryDelayMs(errBody, resp.headers, config.retryms, attempt, rand));
    }
    const response = await resp.json(), candidate = (response.candidates || [])[0] || {};
    observation.finishReason = candidate.finishReason || '';
    observation.usage = response.usageMetadata || {};
    if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Output truncated (MAX_TOKENS)');
    const text = ((candidate.content || {}).parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    let transcript;
    try { transcript = JSON.parse(text); } catch { throw new Error('Response was not JSON'); }
    return validateTranscript(transcript);
  };
}
async function runMeasurement(config, transcribe, log = () => {}) {
  const images = [];
  for (const img of config.images) {
    const transcripts = [], errors = [], observations = [];
    for (let run = 0; run < config.runs; run++) {
      const observation = { run: run + 1, attempts: 0 };
      observations.push(observation);
      try { transcripts.push(await transcribe(img, observation)); }
      catch (error) { errors.push(String(error.message || error)); }
    }
    images.push({ image: path.basename(img), transcripts, errors, observations });
    log(path.basename(img) + ': ' + transcripts.length + '/' + config.runs + ' successful transcriptions');
  }
  const summary = summarizeImages(images, config.runs);
  return { ...summary, observedAttempts: images.reduce((n, image) => n + image.observations.reduce((sum, r) => sum + r.attempts, 0), 0) };
}
function printSummary(summary, log) {
  log(summary.conclusion);
  log('Images: ' + summary.completeImages + ' complete, ' + summary.comparableImages + ' comparable, ' +
    summary.failedImages + ' failed, ' + summary.incompleteImages + ' incomplete.');
  for (const row of summary.images) {
    if (row.errors.length) log(row.image + ' errors: ' + row.errors.join(' | '));
    if (!row.agreement) continue;
    const a = row.agreement;
    log(row.image + ' card: ' + a.cardIds.join(' / ') + '; face: ' + a.faces.join(' / '));
    if (a.numericsUnstable.length) log('Numeric drift: ' + a.numericsUnstable.join(' | '));
    if (a.numericsAgreed.length) log('Numbers to CHECK BY EYE against the card: ' + a.numericsAgreed.join(' | '));
    if (a.bulletsUnstable.length) log('Unstable prose bullets: ' + a.bulletsUnstable.length);
  }
  log('Self-agreement is not accuracy. Check all transcripts and clinical numbers against the images.');
}
async function main(argv = process.argv.slice(2), deps = {}) {
  const log = deps.log || console.log, errorLog = deps.error || console.error;
  const readFile = deps.readFile || fs.readFileSync, writeFile = deps.writeFile || fs.writeFileSync;
  let config, measuring = false;
  try {
    config = parseArgs(argv);
    if (config.help) {
      log('Davis: card.jpg [--dry-run | --live] [--runs 2..100] [--app-profile | --model ID --level low|medium|high|xhigh] [--app suite.html] [--out report.json] [--retryms 0..600000] [--rpm 0..60000]. Exit 3 means incomplete measurement.');
      return 0;
    }
    if (!config.live && !config.dryRun) throw new Error('Use --dry-run to inspect the plan, or --live only after per-run human authorization');
    const key = (deps.env || process.env).GEMINI_API_KEY || '';
    if (config.live && !key) throw new Error('Set GEMINI_API_KEY in the environment');
    const suiteFile = (deps.resolveSuite || resolveSuiteFile)({ rootDir: deps.cwd || process.cwd(), explicit: config.suite });
    const source = readFile(suiteFile, 'utf8');
    const prompt = extractPromptLiteral(source, 'CARD_TRANSCRIBE_PROMPT').body;
    const schema = extractCardSchema(source);
    const profile = resolveMeasurementProfile(config, source, 'cardTranscribe');
    config = { ...config, ...profile };
    const plan = { ...measurementPlan(config, config.images.length, profile),
      promptHash: sha256(prompt), payloadMode: 'original-image-bytes (not the UI cardFilePayload resize path)' };
    log(JSON.stringify(plan, null, 2));
    if (config.dryRun) return 0;
    log('--live does not replace the required human authorization for these images and this run.');
    measuring = true;
    const summary = await runMeasurement(config, createTranscriber(config, prompt, key, { ...deps, schema }), log);
    const report = { at: new Date().toISOString(), model: config.model, level: config.level,
      runs: config.runs, suite: path.basename(suiteFile), plan, ...summary };
    // A locally thrown error may include the key; reports must never retain it.
    const reportText = redactSecrets(JSON.stringify(report, null, 2), key);
    writePrivateReport(config.out, reportText, deps.writeFile);
    printSummary(JSON.parse(reportText), log);
    log('Full private report: ' + config.out + '; observed HTTP attempts: ' + summary.observedAttempts);
    return summary.exitCode;
  } catch (error) {
    const key = (deps.env || process.env).GEMINI_API_KEY || '';
    errorLog(redactSecrets(error.message || error, key));
    return measuring ? 1 : 2;
  }
}
module.exports = { parseArgs, compareRuns, validateTranscript, summarizeImages, payloadMetadata,
  extractCardSchema, createTranscriber, runMeasurement, printSummary, main };
if (require.main === module) main().then(code => { process.exitCode = code; },
  error => { console.error(redactSecrets(error && error.message || error, process.env.GEMINI_API_KEY || '')); process.exitCode = 1; });
