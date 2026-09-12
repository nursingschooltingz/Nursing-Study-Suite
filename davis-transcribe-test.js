#!/usr/bin/env node
/*
 * Davis flashcard transcription: manual, quota-consuming self-agreement measurement.
 * Run only after the user authorizes these images and this live run.
 *
 * node davis-transcribe-test.js card.jpg --dry-run [--app-profile]
 * GEMINI_API_KEY=... node davis-transcribe-test.js card.jpg --live --runs 2
 * Options: --runs 2..100, --model ID, --level minimal|low|medium|high,
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
  resolveMeasurementProfile, measurementPlan, createMeasurementPacer } = require('./tools/repo-checks');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' };
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
  .map(category => ({ category, threshold: 'BLOCK_NONE' }));
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
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !['front', 'back', 'unknown'].includes(value.face) ||
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
  const fetchFn = deps.fetch || globalThis.fetch;
  const sleep = deps.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const pace = createMeasurementPacer(config.rpm, { now: deps.now || Date.now, sleep });
  return async function transcribe(imgPath, observation) {
    if (!config.live || config.dryRun) throw new Error('Live transcription requires --live and per-run human authorization');
    const mimeType = MIME[path.extname(imgPath).toLowerCase()];
    if (!mimeType) throw new Error('Unsupported image type');
    const bytes = readFile(imgPath);
    observation.originalPayload = payloadMetadata(bytes, mimeType);
    observation.actualPayload = { ...observation.originalPayload, resized: false };
    if (bytes.length > 15 * 1024 * 1024) throw new Error('Image too large for an inline request: ' + (bytes.length / 1048576).toFixed(1) + ' MB');
    const body = { contents: [{ parts: [{ inlineData: { mimeType, data: bytes.toString('base64') } }, { text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 65536, thinkingConfig: { thinkingLevel: config.level } },
      safetySettings: SAFETY };
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + config.model + ':generateContent';
    let resp;
    for (let attempt = 0; attempt < 4; attempt++) {
      await pace();
      observation.attempts++;
      resp = await fetchFn(url, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
      if (resp.ok) break;
      // Do not copy an upstream error body into a report: it can echo request data.
      if ((resp.status !== 429 && resp.status < 500) || attempt === 3) throw new Error('HTTP ' + resp.status);
      await sleep(config.retryms * Math.pow(2, attempt));
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
      log('Davis: card.jpg [--dry-run | --live] [--runs 2..100] [--app-profile | --model ID --level low|medium|high] [--app suite.html] [--out report.json] [--retryms 0..600000] [--rpm 0..60000]. Exit 3 means incomplete measurement.');
      return 0;
    }
    if (!config.live && !config.dryRun) throw new Error('Use --dry-run to inspect the plan, or --live only after per-run human authorization');
    const key = (deps.env || process.env).GEMINI_API_KEY || '';
    if (config.live && !key) throw new Error('Set GEMINI_API_KEY in the environment');
    const suiteFile = (deps.resolveSuite || resolveSuiteFile)({ rootDir: deps.cwd || process.cwd(), explicit: config.suite });
    const source = readFile(suiteFile, 'utf8');
    const prompt = extractPromptLiteral(source, 'CARD_TRANSCRIBE_PROMPT').body;
    const profile = resolveMeasurementProfile(config, source, 'cardTranscribe');
    config = { ...config, ...profile };
    const plan = { ...measurementPlan(config, config.images.length, profile),
      promptHash: sha256(prompt), payloadMode: 'original-image-bytes (not the UI cardFilePayload resize path)' };
    log(JSON.stringify(plan, null, 2));
    if (config.dryRun) return 0;
    log('--live does not replace the required human authorization for these images and this run.');
    measuring = true;
    const summary = await runMeasurement(config, createTranscriber(config, prompt, key, deps), log);
    const report = { at: new Date().toISOString(), model: config.model, level: config.level,
      runs: config.runs, suite: path.basename(suiteFile), plan, ...summary };
    // A locally thrown error may include the key; reports must never retain it.
    const reportText = JSON.stringify(report, null, 2).split(key).join('[REDACTED]');
    writeFile(config.out, reportText, 'utf8');
    printSummary(JSON.parse(reportText), log);
    log('Full private report: ' + config.out + '; observed HTTP attempts: ' + summary.observedAttempts);
    return summary.exitCode;
  } catch (error) {
    const key = (deps.env || process.env).GEMINI_API_KEY || '';
    const message = String(error.message || error);
    errorLog(key ? message.split(key).join('[REDACTED]') : message);
    return measuring ? 1 : 2;
  }
}
module.exports = { parseArgs, compareRuns, validateTranscript, summarizeImages, payloadMetadata,
  createTranscriber, runMeasurement, printSummary, main };
if (require.main === module) main().then(code => { process.exitCode = code; },
  error => { console.error(String(error.message || error)); process.exitCode = 1; });
