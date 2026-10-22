#!/usr/bin/env node
'use strict';
// Offline regressions for the actual manual-tool exports. No image/course file is read,
// no credential is needed, and fetch is always a controlled stub in these tests.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const checks = require('./repo-checks');
const render = require('./render-prompts');
const davis = require('../davis-transcribe-test');
const neia = require('../neia-retest');

async function runTests({ source, test = (name, value) => assert.ok(value, name) } = {}) {
  let count = 0;
  const t = (name, value) => { count++; test('tooling: ' + name, !!value); };
  const throws = (fn, regex) => { try { fn(); return false; } catch (error) { return regex.test(error.message); } };
  const rejects = async (fn, regex) => { try { await fn(); return false; } catch (error) { return regex.test(error.message); } };
  const parseD = args => davis.parseArgs(['synthetic.jpg', ...args]);
  for (const [name, parse] of [['Davis', parseD], ['NEIA', neia.parseArgs]]) {
    for (const value of ['NaN', 'Infinity', '-1', '0', '1', '2.5', '101']) {
      t(name + ' rejects runs=' + value, throws(() => parse(['--runs', value]), /--runs must be an integer/));
    }
    for (const value of ['NaN', 'Infinity', '-1', '0.5', '600001']) {
      t(name + ' rejects retryms=' + value, throws(() => parse(['--retryms', value]), /--retryms must be an integer/));
    }
    for (const value of ['NaN', 'Infinity', '-1', '60001']) {
      t(name + ' rejects rpm=' + value, throws(() => parse(['--rpm', value]), /--rpm must be finite/));
    }
    t(name + ' permits zero retry delay and fractional positive pacing', parse(['--retryms', '0', '--rpm', '0.5']).rpm === 0.5);
    t(name + ' permits unthrottled pacing explicitly', parse(['--rpm', '0']).rpm === 0);
    t(name + ' rejects unknown option', throws(() => parse(['--surprise']), /Unknown option/));
    t(name + ' rejects missing value', throws(() => parse(['--runs']), /Missing value/));
    t(name + ' does not consume another option as a value', throws(() => parse(['--out', '--dry-run']), /Missing value/));
    t(name + ' rejects duplicate option', throws(() => parse(['--runs', '2', '--runs', '3']), /Duplicate option/));
    t(name + ' rejects ambiguous profile override', throws(() => parse(['--app-profile', '--model', 'gemini-test']), /cannot be combined/));
    t(name + ' rejects conflicting execution modes', throws(() => parse(['--live', '--dry-run']), /Choose --dry-run/));
    t(name + ' rejects invalid model URL path', throws(() => parse(['--model', '../other']), /Invalid model ID/));
    t(name + ' rejects invalid thinking level', throws(() => parse(['--level', 'turbo']), /--level must/));
  }
  for (const value of ['NaN', 'Infinity', '-1', '0', '1.2', '101']) {
    t('NEIA rejects width=' + value, throws(() => neia.parseArgs(['--width', value]), /--width must be an integer/));
  }
  t('Davis excludes output image filename from inputs', JSON.stringify(parseD(['--out', 'foo.png']).images) === '["synthetic.jpg"]');
  t('Davis preserves multiple positional images', JSON.stringify(davis.parseArgs(['a.jpg', '--out', 'foo.png', 'b.png']).images) === '["a.jpg","b.png"]');
  t('Davis and NEIA reject --out that overwrites an input image or protected repo file',
    throws(() => davis.parseArgs(['a.jpg', '--out', 'a.jpg']), /--out cannot overwrite/) &&
    throws(() => neia.parseArgs(['--out', 'neia-fixture.json']), /--out cannot overwrite/) &&
    throws(() => neia.parseArgs(['--out', 'verify-repo.js']), /--out cannot overwrite/));
  t('Davis supports option-like paths after --', davis.parseArgs(['--', '--photo.jpg']).images[0] === '--photo.jpg');
  t('Davis requires at least one image', throws(() => davis.parseArgs(['--dry-run']), /at least one image/));
  t('NEIA rejects positional input', throws(() => neia.parseArgs(['foo.png']), /Unexpected input/));
  t('NEIA rejects empty only selection', throws(() => neia.parseArgs(['--only', ',']), /at least one item ID/));
  t('Historical Davis baseline remains Flash 3.7 low', parseD([]).model === 'gemini-3.7-flash' && parseD([]).level === 'low' && parseD([]).rpm === 15);
  t('NEIA baseline is Argon high since v17.13', neia.parseArgs([]).model === 'gemini-4-argon' && neia.parseArgs([]).level === 'high' && neia.parseArgs([]).width === 3);
  t('Argon measurement refuses the minimal level it answers with HTTP 400', throws(() => neia.parseArgs(['--level', 'minimal']), /Argon does not accept/) && neia.parseArgs(['--model', 'gemini-3.8-flash', '--level', 'minimal']).level === 'minimal');
  const plan = checks.measurementPlan(parseD(['--runs', '3']), 2, { model: 'gemini-test', level: 'low', profile: 'synthetic' });
  t('Plan separates logical operations and retry ceiling', plan.logicalOperations === 6 && plan.maximumAttempts === 24 && plan.maxAttemptsPerOperation === 4 && plan.maxOutputTokens === 65536);
  t('Plan uses the same per-model output ceiling as the suite', checks.measurementPlan(parseD([]), 1, { model: 'gemini-4-argon', level: 'high', profile: 'synthetic' }).maxOutputTokens === 65536 && checks.measurementOutputCap('gemini-4-argon') === 65536 && checks.measurementOutputCap('gemini-3.7-flash') === 65536); // v18.2: Argon is 65,536
  t('Plan rejects zero selected inputs', throws(() => checks.measurementPlan(parseD([]), 0, {}), /No measurement inputs/));

  const transcript = { face: 'front', category: 'Synthetic', cardNumber: '1', overallLegibility: 'clean',
    sections: [{ key: 'other', bullets: ['Synthetic bullet'] }], numerics: [{ value: '0', context: 'synthetic' }] };
  for (let mask = 0; mask < 8; mask++) {
    const runs = [0, 1, 2].filter(run => mask & (1 << run)).map(() => transcript);
    const summary = davis.summarizeImages([{ image: 'fixture.png', transcripts: runs,
      errors: Array(3 - runs.length).fill('synthetic failure') }], 3);
    t('Davis completion pattern ' + mask, summary.conclusive === (mask === 7) &&
      summary.comparableImages === (runs.length >= 2 ? 1 : 0) && summary.failedImages === (runs.length === 0 ? 1 : 0) &&
      summary.incompleteImages === (runs.length > 0 && runs.length < 3 ? 1 : 0) &&
      summary.exitCode === (mask === 7 ? 0 : 3) && (mask === 7 || summary.conclusion.startsWith('INCOMPLETE')));
  }
  t('Davis empty measurement is inconclusive', davis.summarizeImages([], 2).exitCode === 3);
  t('Davis refuses one-run comparison', throws(() => davis.summarizeImages([], 1), /At least two/));
  const stable = davis.summarizeImages([{ transcripts: [transcript, transcript], errors: [] }], 2);
  t('Davis no observed drift does not claim accuracy', stable.conclusive && /accuracy remains unmeasured/.test(stable.conclusion));
  const differing = { ...transcript, face: 'back', cardNumber: '2', numerics: [{ value: '1', context: 'synthetic' }],
    sections: [{ key: 'other', bullets: ['Different synthetic bullet'] }] };
  const drift = davis.summarizeImages([{ transcripts: [transcript, differing], errors: [] }], 2);
  t('Davis counts identity, numeric, and prose drift', drift.conclusive && drift.identityDrift && drift.numericDrift && drift.proseDrift);
  t('Davis preserves zero numeric values', davis.compareRuns([transcript, transcript]).numericsAgreed[0].startsWith('0 '));
  t('Davis malformed response cannot become empty stable transcript', throws(() => davis.validateTranscript({}), /Incomplete or malformed/));
  t('Davis rejects malformed bullets', throws(() => davis.validateTranscript({ ...transcript, sections: [{ key: 'other', bullets: [null] }] }), /Incomplete or malformed/));
  const resultRow = (status, run, criterion = '') => ({ id: 'synthetic', band: 'sound', seeded: null,
    status, run, criterion, warnCriteria: [], ms: 1, tokensIn: 1, tokensOut: 1, tokensThought: 0, attempts: 1 });
  for (let mask = 0; mask < 8; mask++) {
    const results = [0, 1, 2].map(run => resultRow(mask & (1 << run) ? 'PASS' : 'ERROR', run));
    const summary = neia.analyzeResults(results, 3, ['synthetic']);
    t('NEIA completion pattern ' + mask, summary.conclusive === (mask === 7) && summary.exitCode === (mask === 7 ? 0 : 3) &&
      summary.totals.statusFlips === 0 && summary.totals.falseFatalOf === results.filter(r => r.status === 'PASS').length);
  }
  t('NEIA missing expected item remains incomplete', neia.analyzeResults([], 2, ['missing']).totals.incompleteItems === 1);
  t('NEIA duplicate run cannot satisfy completion', !neia.analyzeResults([resultRow('PASS', 0), resultRow('PASS', 0)], 2).conclusive);
  const flip = neia.analyzeResults([resultRow('PASS', 0), resultRow('FAIL', 1, 'Stem clarity')], 2);
  t('NEIA actual verdict flip creates a candidate', flip.totals.statusFlips === 1 && flip.demotionCandidates[0].criterion === 'Stem clarity');
  const label = neia.analyzeResults([resultRow('FAIL', 0, 'Stem clarity'), resultRow('FAIL', 1, 'Stem relevance')], 2);
  t('NEIA label drift alone does not create a demotion candidate', label.labelDrift.length === 1 && !label.demotionCandidates.length && label.totals.statusFlips === 0);
  t('NEIA selection rejects unknown IDs', throws(() => neia.selectItems({ items: [] }, ['missing'], {}), /Unknown fixture item/));

  t('Regex extraction reports missing anchor specifically', throws(() => checks.extractAnchoredRegex('unrelated', 'contraindicat|', '||/', '/i.test', 'i'), /Regex anchor missing: contraindicat/));
  t('Regex extraction reports missing start specifically', throws(() => checks.extractAnchoredRegex('contraindicat|/i.test', 'contraindicat|', '||/', '/i.test', 'i'), /Regex start marker missing/));
  t('Regex extraction reports missing end specifically', throws(() => checks.extractAnchoredRegex('x||/contraindicat|', 'contraindicat|', '||/', '/i.test', 'i'), /Regex end marker missing/));
  t('Regex extraction retains live alternation', checks.extractAnchoredRegex('x||/contraindicat|danger/i.test(x)', 'contraindicat|', '||/', '/i.test', 'i').test('DANGER'));
  t('Empty documented card prompt fails specifically', throws(() => checks.extractPromptLiteral('const CARD_TRANSCRIBE_PROMPT=\`  \`;', 'CARD_TRANSCRIBE_PROMPT'), /Empty documented prompt body: CARD_TRANSCRIBE_PROMPT/));
  t('Empty frozen prompt fails specifically', throws(() => checks.extractPromptLiteral('const KB_VERIFY_PROMPT=\`\`;', 'KB_VERIFY_PROMPT'), /Empty documented prompt body: KB_VERIFY_PROMPT/));
  t('NEIA missing extraction start is explicit', throws(() => neia.extractAudit(''), /Start anchor missing: function caseToMarkdown/));
  t('NEIA missing extraction end is explicit', throws(() => neia.spanFrom('function start() {}', 'function start()', 'end marker'), /End anchor missing/));

  let fileReads = 0, fileWrites = 0, requests = 0;
  const forbidden = { env: { GEMINI_API_KEY: 'synthetic-key' }, log: () => {}, error: () => {},
    readFile: () => { fileReads++; throw new Error('Unexpected file read'); },
    writeFile: () => { fileWrites++; }, fetch: () => { requests++; throw new Error('Unexpected network request'); } };
  t('Davis no opt-in blocks before I/O', await davis.main(['synthetic.jpg'], forbidden) === 2 && fileReads === 0 && fileWrites === 0 && requests === 0);
  t('NEIA no opt-in blocks before I/O', await neia.main([], forbidden) === 2 && fileReads === 0 && fileWrites === 0 && requests === 0);
  t('Davis --live needs a key before I/O', await davis.main(['synthetic.jpg', '--live'], { ...forbidden, env: {} }) === 2 && fileReads === 0);
  t('NEIA --live needs a key before I/O', await neia.main(['--live'], { ...forbidden, env: {} }) === 2 && fileReads === 0);
  t('Exported Davis request helper also enforces opt-in', await rejects(() => davis.createTranscriber(parseD([]), 'synthetic', '', forbidden)('synthetic.jpg', { attempts: 0 }), /requires --live/) && requests === 0);
  t('Exported NEIA request helper also enforces opt-in', await rejects(() => neia.createAuditCaller(neia.parseArgs([]), '', forbidden)('synthetic', { attempts: 0 }), /requires --live/) && requests === 0);

  const bytes = Buffer.from('synthetic image payload'), sent = [];
  const requestConfig = { ...parseD(['--live', '--rpm', '0', '--retryms', '0']), model: 'gemini-synthetic' };
  const observation = { attempts: 0 };
  const transcribe = davis.createTranscriber(requestConfig, 'synthetic prompt', 'synthetic-key', {
    readFile: () => bytes, sleep: async () => {},
    fetch: async (url, options) => {
      sent.push({ url, body: JSON.parse(options.body) });
      return sent.length < 3 ? { ok: false, status: sent.length === 1 ? 429 : 503 } :
        { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP',
          content: { parts: [{ text: JSON.stringify(transcript) }] } }] }) };
    },
  });
  t('Davis retries are observed and counted', (await transcribe('synthetic.jpg', observation)).face === 'front' && observation.attempts === 3);
  t('Davis records unchanged original and actual payload metadata', observation.originalPayload.sha256 === checks.sha256(bytes) &&
    observation.originalPayload.bytes === bytes.length && observation.actualPayload.resized === false &&
    observation.actualPayload.mimeType === 'image/jpeg');
  t('Davis keeps measured request settings', sent[0].body.generationConfig.maxOutputTokens === 65536 &&
    sent[0].body.generationConfig.thinkingConfig.thinkingLevel === 'low' &&
    sent[0].body.safetySettings.every(s => s.threshold === 'BLOCK_NONE') &&
    sent[0].body.contents[0].parts[1].text === 'synthetic prompt');
  let retryAttempts = 0;
  const failedObservation = { attempts: 0 };
  const failCall = neia.createAuditCaller({ ...neia.parseArgs(['--live']), retryms: 0 }, 'synthetic-key', {
    sleep: async () => {}, fetch: async () => { retryAttempts++; return { ok: false, status: 429 }; } });
  t('NEIA retry exhaustion records four attempts', await rejects(() => failCall('synthetic', failedObservation), /HTTP 429/) &&
    retryAttempts === 4 && failedObservation.attempts === 4);
  const waits = [];
  const pace = checks.createMeasurementPacer(30, { now: () => 1000, sleep: async ms => { waits.push(ms); } });
  await Promise.all([pace(), pace(), pace()]);
  t('Concurrent pacing reserves serial request starts', JSON.stringify(waits) === '[2000,4000]');
  const outputs = await neia.pool([1, 2, 3], 2, async n => n * 2);
  t('Audit pool preserves result ordering', JSON.stringify(outputs) === '[2,4,6]');

  if (typeof source !== 'string') throw new Error('Tooling regressions require the live suite source');
  const profileD = checks.resolveMeasurementProfile(parseD(['--app-profile']), source, 'cardTranscribe');
  const profileN = checks.resolveMeasurementProfile(neia.parseArgs(['--app-profile']), source, 'itemAudit');
  // v17.14: card OCR ships on Flash and the item audit on Argon, so the two app profiles resolve to different shipped models.
  t('App-matching profiles use each row\'s shipped model and tool level', profileD.family === 'flash' && profileN.family === 'argon' &&
    source.includes("flashModel:'" + profileD.model + "'") && source.includes("argonModel:'" + profileN.model + "'") && profileD.level === 'low' && profileN.level === 'high');
  const flashSource = source.replace(/itemAudit:\{m:'argon',lv:'high'\}/, "itemAudit:{m:'flash',lv:'high'}");
  const profileFlash = checks.resolveMeasurementProfile(neia.parseArgs(['--app-profile']), flashSource, 'itemAudit');
  t('A Flash profile row resolves to the shipped Flash default', flashSource !== source && profileFlash.family === 'flash' && profileFlash.model === profileD.model && profileFlash.level === 'high');
  t('Missing app registry fails explicitly', throws(() => checks.resolveMeasurementProfile(parseD(['--app-profile']), '', 'cardTranscribe'), /App profile registry anchor missing/));
  const liveAudit = neia.extractAudit(source);
  t('Audit extraction includes non-vacuous tail behavior', liveAudit.itemAuditSummary([{ status: 'PASS', warns: [] }]).pass === 1);
  const syntheticFixture = { referenceStandardCaveat: 'Synthetic regression fixture', items: [{ id: 'synthetic',
    band: 'sound', seededCriterion: null, case: { title: 'Synthetic', stages: [{ stageNumber: 1,
      questions: [{ id: 'Q1', type: 'MCQ', stem: 'Synthetic question?', options: [
        { id: 'A', text: 'One' }, { id: 'B', text: 'Two' }, { id: 'C', text: 'Three' }, { id: 'D', text: 'Four' }
      ], correctAnswers: ['A'], rationales: [] }] }] } }] };
  const jobs = neia.prepareJobs(neia.selectItems(syntheticFixture, [], liveAudit), 2, liveAudit);
  t('NEIA plans exact selected jobs with live prompt hashes', jobs.length === 2 && jobs[0].promptHash === checks.sha256(jobs[0].prompt) &&
    !jobs[0].prompt.includes('F999') && jobs[0].prompt.includes('Synthetic question?'));
  const malformed = await neia.runMeasurement({ runs: 2, width: 1 }, jobs, liveAudit,
    async () => ({ text: 'Unparseable output', ms: 1, tokensIn: 1, tokensOut: 1, tokensThought: 0 }));
  t('Missing explicit verdict is incomplete evidence', malformed.exitCode === 3 && malformed.totals.errors === 2);

  const dryLogs = [], dryReads = [];
  const dryDeps = { env: {}, log: value => dryLogs.push(value), error: value => dryLogs.push(value),
    resolveSuite: () => 'Nursing-Study-Suite v99.1.html',
    readFile: file => { dryReads.push(file); return file.endsWith('neia-fixture.json') ? JSON.stringify(syntheticFixture) : source; },
    writeFile: () => { fileWrites++; }, fetch: () => { requests++; throw new Error('Unexpected network'); } };
  const dryD = await davis.main(['synthetic.jpg', '--dry-run', '--app-profile', '--out', 'ignored.png'], dryDeps);
  t('Davis dry-run needs no key and never reads images or writes a report', dryD === 0 && dryReads.length === 1 &&
    dryReads[0].endsWith('.html') && fileWrites === 0 && requests === 0);
  const dryN = await neia.main(['--dry-run', '--app-profile', '--only', 'synthetic'], dryDeps);
  t('NEIA dry-run needs no key and writes no report', dryN === 0 && fileWrites === 0 && requests === 0);
  t('Dry-run prints profile, operations, attempt ceiling, and hashes', dryLogs.join('\n').includes('"logicalOperations"') &&
    dryLogs.join('\n').includes('"maximumAttempts"') && dryLogs.join('\n').includes('"promptHash"') &&
    dryLogs.join('\n').includes('shipped-default:cardTranscribe') && dryLogs.join('\n').includes('original-image-bytes'));
  const cardLiteral = checks.extractPromptLiteral(source, 'CARD_TRANSCRIBE_PROMPT');
  const emptyCard = source.replace(cardLiteral.declaration, 'const CARD_TRANSCRIBE_PROMPT=\`\`;');
  t('Prompt documentation fails an empty live card prompt specifically', throws(() => render.buildGeneratedAppendix(emptyCard), /Empty documented prompt body: CARD_TRANSCRIBE_PROMPT/));

  const os = require('os');
  const clashDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nss-clash-test-'));
  try {
    const mainHtml = path.join(clashDir, 'Nursing-Study-Suite v19.0.html');
    const clashHtml = path.join(clashDir, 'Nursing-Study-Suite v19.0 (Name clash 2026-10-21).html');
    fs.writeFileSync(mainHtml, '<!-- v19.0 (2026-10-21) -->');
    fs.writeFileSync(clashHtml, '<!-- v19.0 (2026-10-21) -->');
    t('resolveSuiteFile rejects explicit --html when a Proton Drive Name-clash file exists in rootDir',
      throws(() => checks.resolveSuiteFile({ rootDir: clashDir, explicit: 'Nursing-Study-Suite v19.0.html' }), /Proton Drive Name clash/));
    t('DOCUMENTED_PROMPTS includes v19.0 KB_SOURCE_ANCHOR_RULES (16 total)',
      checks.DOCUMENTED_PROMPTS.length === 16 && checks.DOCUMENTED_PROMPTS.includes('KB_SOURCE_ANCHOR_RULES'));
    t('parseCliArgs rejects unknown flags, duplicate options, missing values, and unexpected positional arguments',
      throws(() => checks.parseCliArgs(['--bogus'], { flags: ['check'], options: ['html'] }), /Unknown option: --bogus/) &&
      throws(() => checks.parseCliArgs(['--check', '--check'], { flags: ['check'], options: ['html'] }), /Duplicate option: --check/) &&
      throws(() => checks.parseCliArgs(['--html'], { flags: ['check'], options: ['html'] }), /Missing value for --html/) &&
      throws(() => checks.parseCliArgs(['extra.html'], { flags: ['check'], options: ['html'] }), /Unexpected positional argument: extra\.html/) &&
      checks.parseCliArgs(['--check', '--html', 'file.html'], { flags: ['check'], options: ['html'] }).values.html === 'file.html');
  } finally {
    fs.rmSync(clashDir, { recursive: true, force: true });
  }

  // v19.0: offline verification for browser fixtures, visual rail tool coverage, and Anki pilot spec builder.
  const browserFixture = require('./remediation-browser-fixture');
  const browserTests = require('./remediation-browser-tests');
  const ankiFixture = require('./anki-browser-fixture');
  const ankiSourceReviewBrowser = require('./anki-source-review-browser-tests');
  const ankiGenQualityBrowser = require('./anki-generation-quality-browser-tests');
  const ankiV166Browser = require('./anki-v166-browser-tests');
  const visualBrowser = require('./visual-browser-tests');
  const { makeAnkiPilotSpec } = require('./anki-pilot-spec');

  const realAppFixtureHtml = browserFixture.page({ hold: ['load'], local: browserFixture.syntheticKB('A') });
  t('Real-App browser fixture mounts shipped App and RemediationProbe without anchor drift',
    realAppFixtureHtml.includes('<BootErrorBoundary><App/></BootErrorBoundary>') &&
    !realAppFixtureHtml.includes('SyntheticAnkiApp') &&
    realAppFixtureHtml.includes('<RemediationProbe/>') &&
    !browserFixture.page({ label: '</script><script>bad</script>' }).includes('const remediationConfig={"label":"</script>'));
  t('Real-App browser fixture once() rejects missing and duplicate anchors',
    throws(() => browserFixture.once('duplicate duplicate', 'duplicate', 'replacement'), /exactly once/) &&
    throws(() => browserFixture.once('missing', 'absent', 'replacement'), /exactly once/));
  const resources = browserTests.approvedResources(realAppFixtureHtml);
  t('Browser fixture approvedResources accounts for all 8 pinned CDN scripts and 2 PDF workers',
    resources.scripts.size === 8 && resources.workers.size === 2 && resources.styles.size === 1);
  t('All four Anki browser fixtures build cleanly against the live suite HTML without anchor drift',
    [ankiFixture, ankiSourceReviewBrowser, ankiGenQualityBrowser, ankiV166Browser].every(mod => {
      const html = mod.page();
      return html.includes('<BootErrorBoundary><SyntheticAnkiApp/></BootErrorBoundary>') && !html.includes('<RemediationProbe/>');
    }));
  const liveToolIds = Array.from(source.matchAll(/\{id:'([^']+)',stage:'(?:source|plan|practice)',label:'[^']+',step:'[^']+',title:'([^']+)'/g), m => [m[1], m[2]]);
  t('visual-browser-tests tabs list matches all 7 shipped TOOLS in the rail',
    liveToolIds.length === 7 && JSON.stringify(visualBrowser.tabs) === JSON.stringify(liveToolIds));
  const kbClean = browserFixture.syntheticKB('A');
  const kbTagged = JSON.parse(JSON.stringify(kbClean));
  kbTagged.conditions[0].facts[0].text += ' [P1]';
  kbTagged.medications = [{ name: 'Synthetic med A', mechanism: 'Blocks receptor Z [P2]' }];
  const kbCleanWithMed = JSON.parse(JSON.stringify(kbClean));
  kbCleanWithMed.medications = [{ name: 'Synthetic med A', mechanism: 'Blocks receptor Z' }];
  const specTagged = makeAnkiPilotSpec(kbTagged, source);
  const specClean = makeAnkiPilotSpec(kbCleanWithMed, source);
  t('makeAnkiPilotSpec strips v19.0 [P#] tags from condition and derived entity facts before hashing Anki packet',
    specTagged.packetSha256 === specClean.packetSha256 && specTagged.facts === 2 && specTagged.entries === 1 && specTagged.chunkCount === 1);

  // Fresh process proves module import cannot read fixtures, emit output, call exit, or
  // fetch. Its read hook allows only Node's module-loader reads of .js source files.
  const probe = [
    "const fs=require('fs'); const original=fs.readFileSync;",
    "fs.readFileSync=function(file,...rest){if(typeof file!=='string'||!file.endsWith('.js'))throw Error('Import read data');return original.call(this,file,...rest)};",
    "fs.writeFileSync=()=>{throw Error('Import wrote file')};",
    "global.fetch=()=>{throw Error('Import fetched')}; process.exit=()=>{throw Error('Import exited')};",
    "console.log=console.error=()=>{throw Error('Import emitted output')};",
    "require('./davis-transcribe-test');require('./neia-retest');require('./tools/remediation-browser-tests');require('./tools/visual-browser-tests');require('./tools/anki-pilot-spec');require('./tools/anki-example-proposal');"
  ].join('\n');
  const imported = spawnSync(process.execPath, ['-e', probe], { cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
  t('Fresh imports have no execution side effects', imported.status === 0 && imported.stdout === '' && imported.stderr === '');
  return count;
}
module.exports = { runTests };
if (require.main === module) {
  const suiteFile = checks.resolveSuiteFile({ rootDir: path.resolve(__dirname, '..') });
  runTests({ source: fs.readFileSync(suiteFile, 'utf8') }).then(count => {
    console.log('PASS ' + count + ' offline tooling regression assertions');
  }).catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });
}
