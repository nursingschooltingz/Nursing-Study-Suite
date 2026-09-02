#!/usr/bin/env node
/*
 * Davis flashcard transcription — pass-1 feasibility harness
 *
 * Usage:
 *   GEMINI_API_KEY=... node davis-transcribe-test.js card-front.jpg card-back.jpg
 *   GEMINI_API_KEY=... node davis-transcribe-test.js *.jpg --runs 3 --model gemini-3.1-pro-preview
 *                                                        [--app <suite.html>]
 *
 * WHY THIS EXISTS
 * The proposed card pipeline is two passes: (1) transcribe the card image to structured
 * text, verbatim; (2) atomize that text, never re-reading the image. Everything downstream
 * grounds against the pass-1 transcript, which makes the transcript the trust boundary:
 * if pass 1 misreads "small bowel >3 cm" as ">8 cm", pass 2 verifies it perfectly against
 * a wrong transcript, the auditor passes it, and every check agrees. Confidently wrong.
 *
 * So before any of it gets built, one question has to be answered on real photographs:
 * can the model read these cards reliably enough to be the source of truth?
 *
 * WHAT IT MEASURES
 * Two things, deliberately separated:
 *   1. SELF-AGREEMENT (automatic). Each image is transcribed --runs times. Any field that
 *      differs between identical runs is untrustworthy by definition, and numeric
 *      disagreements are reported loudly and separately. This needs no ground truth.
 *   2. ACCURACY (manual, by you). Self-agreement cannot catch a model that misreads the
 *      same digit the same way every time. The report prints every numeric value it found
 *      so you can check them against the card in about a minute per card.
 *
 * A run that is perfectly self-consistent and wrong is the failure mode that matters.
 * Do not skip step 2.
 *
 * WHAT IT DOES NOT DO
 * It does not decide anything, and it writes nothing into the app. It is not part of
 * `node latte-tests.js` and never runs in CI.
 *
 * COST WARNING: makes (images x runs) live API calls with image payloads attached, which
 * are far more expensive per call than the text-only harnesses. Default 2 runs.
 *
 * OUTPUT: davis-transcribe-report.json (gitignored — card text is publisher content).
 *
 * Like latte-tests.js and neia-retest.js, the prompt is extracted from the shipped HTML by
 * anchor rather than copied, so this harness can never measure a prompt the app does not use.
 *
 * Built-in modules only; no dependencies.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveSuiteFile } = require('./tools/repo-checks');

/* ── args ── */
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const flag = name => argv.includes('--' + name);
const RUNS = Number(arg('runs', 2));
const MODEL = arg('model', 'gemini-3.7-flash');
const LEVEL = arg('level', 'low');
const OUT = arg('out', 'davis-transcribe-report.json');
const RETRY_MS = Number(arg('retryms', 20000));
const IMAGES = argv.filter(a => !a.startsWith('--') && /\.(jpe?g|png|webp|heic|heif)$/i.test(a));

const KEY = process.env.GEMINI_API_KEY || '';
if (!KEY) { console.error('Set GEMINI_API_KEY in the environment.'); process.exit(2); }
if (!IMAGES.length) { console.error('Pass at least one image path.'); process.exit(2); }

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
               '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' };

// BLOCK_NONE for the same reason the app uses it: nursing content (overdose thresholds,
// self-harm risk, abuse scenarios) false-positives generic filters.
const SAFETY = ['HARM_CATEGORY_HARASSMENT','HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT','HARM_CATEGORY_DANGEROUS_CONTENT']
  .map(category => ({ category, threshold: 'BLOCK_NONE' }));

/* ── PASS 1 PROMPT ──────────────────────────────────────────────────────────
 * Extracted from the shipped HTML by anchor, never copied. A second copy of this prompt
 * living here would drift from the one the app actually uses, and the drift would be
 * silent — the harness would then be measuring a prompt nobody runs. If the anchor moves,
 * this fails loudly at startup, which is the intended behaviour.
 */
let APP_FILE;
try {
  APP_FILE = resolveSuiteFile({ rootDir: process.cwd(), explicit: arg('app', '') });
} catch (error) {
  console.error(error.message); process.exit(2);
}
const TRANSCRIBE_PROMPT = (() => {
  const S = fs.readFileSync(APP_FILE, 'utf8');
  const i = S.indexOf('const CARD_TRANSCRIBE_PROMPT=');
  if (i < 0) throw new Error('anchor missing in ' + APP_FILE + ': const CARD_TRANSCRIBE_PROMPT=');
  const start = S.indexOf('`', i);
  let j = start + 1;
  while (j < S.length) {
    if (S[j] === '\\') { j += 2; continue; }
    if (S[j] === '`') break;
    j++;
  }
  if (j >= S.length) throw new Error('unterminated CARD_TRANSCRIBE_PROMPT literal');
  return S.slice(start + 1, j);
})();

/* ── API ── */
let last = 0;
const pace = async () => {
  const gap = 4000 - (Date.now() - last);
  if (gap > 0) await new Promise(r => setTimeout(r, gap));
  last = Date.now();
};

async function transcribe(imgPath) {
  const ext = path.extname(imgPath).toLowerCase();
  const mimeType = MIME[ext];
  if (!mimeType) throw new Error('unsupported image type: ' + ext);
  const bytes = fs.readFileSync(imgPath);
  // The inline-image request limit covers instructions + image bytes together.
  if (bytes.length > 15 * 1024 * 1024) throw new Error('image too large for an inline request: ' + (bytes.length / 1048576).toFixed(1) + ' MB');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
  const body = {
    contents: [{ parts: [
      { inlineData: { mimeType, data: bytes.toString('base64') } },
      { text: TRANSCRIBE_PROMPT },
    ] }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 65536,
                        thinkingConfig: { thinkingLevel: LEVEL } },
    safetySettings: SAFETY,
  };

  let resp, lastBody = '';
  for (let attempt = 0; attempt <= 3; attempt++) {
    await pace();
    resp = await fetch(url, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(body) });
    if (resp.ok) break;
    lastBody = (await resp.text()).slice(0, 300);
    if (resp.status !== 429 && resp.status < 500) break;
    if (attempt === 3) break;
    process.stdout.write('r');
    await new Promise(r => setTimeout(r, RETRY_MS * Math.pow(2, attempt)));
  }
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + lastBody);
  const j = await resp.json();
  const cand = (j.candidates || [])[0] || {};
  const text = ((cand.content || {}).parts || []).map(p => p.text || '').join('');
  if (cand.finishReason === 'MAX_TOKENS') throw new Error('output truncated (MAX_TOKENS)');
  try { return JSON.parse(text); }
  catch (e) { throw new Error('response was not JSON: ' + text.slice(0, 200)); }
}

/* ── comparison ──
 * Self-agreement across identical runs. A field that changes between runs cannot be
 * trusted whatever it says; numerics are compared separately because they are the ones
 * that turn a study aid into a wrong drug dose.
 */
function bulletsOf(t) {
  return (t.sections || []).flatMap(s => (s.bullets || []).map(b => s.key + ' :: ' + b));
}
function numericsOf(t) {
  return (t.numerics || []).map(n => String(n.value || '').trim() + ' (' + String(n.context || '').trim() + ')');
}
function compareRuns(runs) {
  const sets = runs.map(bulletsOf);
  const numSets = runs.map(numericsOf);
  const allB = [...new Set(sets.flat())];
  const allN = [...new Set(numSets.flat())];
  return {
    bulletCounts: sets.map(s => s.length),
    bulletsUnstable: allB.filter(b => !sets.every(s => s.includes(b))),
    numericCounts: numSets.map(s => s.length),
    numericsUnstable: allN.filter(n => !numSets.every(s => s.includes(n))),
    numericsAgreed: allN.filter(n => numSets.every(s => s.includes(n))),
    faces: [...new Set(runs.map(r => r.face))],
    cardIds: [...new Set(runs.map(r => String(r.category || '?') + ' #' + String(r.cardNumber || '?')))],
    legibility: runs.map(r => r.overallLegibility),
  };
}

/* ── main ── */
(async () => {
  console.log('Davis transcription feasibility — ' + IMAGES.length + ' image(s) x ' + RUNS + ' run(s) = ' + (IMAGES.length * RUNS) + ' live call(s)');
  console.log('model: ' + MODEL + ' [' + LEVEL + ']\n');
  const report = { model: MODEL, level: LEVEL, runs: RUNS, at: new Date().toISOString(), images: [] };
  let anyNumericDrift = false, anyUnstable = false;

  for (const img of IMAGES) {
    process.stdout.write(path.basename(img) + ' ');
    const outs = [], errs = [];
    for (let r = 0; r < RUNS; r++) {
      try { outs.push(await transcribe(img)); process.stdout.write('.'); }
      catch (e) { errs.push(String(e.message || e)); process.stdout.write('x'); }
    }
    const entry = { image: path.basename(img), errors: errs, transcripts: outs };
    if (outs.length >= 2) {
      entry.agreement = compareRuns(outs);
      if (entry.agreement.numericsUnstable.length) anyNumericDrift = true;
      if (entry.agreement.bulletsUnstable.length) anyUnstable = true;
    }
    report.images.push(entry);
    console.log('');
  }

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');

  /* ── human-readable summary ── */
  console.log('\n════════════════════════════');
  for (const e of report.images) {
    console.log('\n■ ' + e.image);
    if (e.errors.length) console.log('  errors: ' + e.errors.join(' | '));
    const a = e.agreement;
    if (!a) { console.log('  (need >=2 successful runs to compare)'); continue; }
    console.log('  card: ' + a.cardIds.join(' / ') + (a.cardIds.length > 1 ? '   <-- DISAGREED ON CARD IDENTITY' : ''));
    console.log('  face: ' + a.faces.join(' / ') + (a.faces.length > 1 ? '   <-- DISAGREED ON FACE' : ''));
    console.log('  legibility: ' + a.legibility.join(' / '));
    console.log('  bullets per run: ' + a.bulletCounts.join(' / ') + (a.bulletsUnstable.length ? '   <-- ' + a.bulletsUnstable.length + ' unstable' : '   stable'));
    console.log('  numerics per run: ' + a.numericCounts.join(' / ') + (a.numericsUnstable.length ? '   <-- ' + a.numericsUnstable.length + ' UNSTABLE' : '   stable'));
    if (a.numericsUnstable.length) {
      console.log('  ⚠ numeric values that changed between identical runs:');
      for (const n of a.numericsUnstable) console.log('      ' + n);
    }
    if (a.numericsAgreed.length) {
      console.log('  numbers to CHECK BY EYE against the card:');
      for (const n of a.numericsAgreed) console.log('      ' + n);
    }
    if (a.bulletsUnstable.length) {
      console.log('  bullets that changed between identical runs (first 5):');
      for (const b of a.bulletsUnstable.slice(0, 5)) console.log('      ' + b.slice(0, 140));
    }
  }

  console.log('\n════════════════════════════');
  console.log(anyNumericDrift
    ? '⚠ NUMERIC DRIFT between identical runs. Transcription is not reliable enough to be the trust boundary as configured. Try a stronger model or --level high before considering any preprocessing.'
    : '✓ No numeric drift between identical runs.');
  if (anyUnstable) console.log('ⓘ Some prose bullets varied between runs. Less alarming than numeric drift, but read them.');
  console.log('\nSelf-agreement is NOT accuracy. A model can misread the same digit identically every');
  console.log('time. Check the numbers listed above against the actual cards before trusting any of this.');
  console.log('\nFull output: ' + OUT);
})().catch(e => { console.error('\nFATAL: ' + (e.message || e)); process.exit(1); });
