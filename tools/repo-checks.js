#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUITE_FILE_RE = /^(?:LATTE-Study-Suite|Nursing-Study-Suite).*\.html$/i;
const NAME_CLASH_RE = /name\s+clash/i;

const FROZEN_PROMPTS = Object.freeze([
  'KB_EXTRACTION_PROMPT',
  'KB_VERIFY_PROMPT',
  'ANKI_MASTER_PROMPT',
  'NCLEX_INLINE_PROMPT',
  'NCLEX_SPLIT_PROMPT',
  'NCLEX_AI_PAIR_PROMPT',
  'NCLEX_GEN_PROMPT',
  'NCLEX_DISTRACTOR_RULES',
  'NCLEX_ANCHOR_RULES',
  'NCLEX_RATIONALE_RULES',
  'NCLEX_COMPLETENESS_RULES',
]);

const DOCUMENTED_PROMPTS = Object.freeze([
  ...FROZEN_PROMPTS,
  'CARD_TRANSCRIBE_PROMPT',
]);

function listSuiteFiles(rootDir = process.cwd()) {
  return fs.readdirSync(rootDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && SUITE_FILE_RE.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function resolveSuiteFile({ rootDir = process.cwd(), explicit = '' } = {}) {
  const root = path.resolve(rootDir);
  if (explicit) {
    const full = path.resolve(root, explicit);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw new Error('Suite HTML does not exist: ' + full);
    }
    if (!SUITE_FILE_RE.test(path.basename(full))) {
      throw new Error('Not a Nursing Study Suite HTML filename: ' + path.basename(full));
    }
    if (NAME_CLASH_RE.test(path.basename(full))) {
      throw new Error('Refusing Proton Drive Name clash file: ' + path.basename(full));
    }
    return full;
  }

  const candidates = listSuiteFiles(root);
  const clashes = candidates.filter(name => NAME_CLASH_RE.test(name));
  if (clashes.length) {
    throw new Error('Proton Drive Name clash file(s) require manual diffing: ' + clashes.join(', '));
  }
  if (candidates.length !== 1) {
    const detail = candidates.length ? candidates.join(', ') : 'none found';
    throw new Error('Expected exactly one suite HTML; found ' + candidates.length + ': ' + detail +
      '. Pass an explicit file only after resolving which copy is canonical.');
  }
  return path.join(root, candidates[0]);
}

function countExact(haystack, needle) {
  if (!needle) throw new Error('countExact requires a non-empty needle');
  let count = 0;
  let from = 0;
  while (true) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return count;
    count++;
    from = at + needle.length;
  }
}

function extractPromptLiteral(source, name) {
  const anchor = 'const ' + name + '=';
  const occurrences = countExact(source, anchor);
  if (occurrences !== 1) {
    throw new Error(anchor + ' expected exactly once; found ' + occurrences);
  }
  const declarationStart = source.indexOf(anchor);
  const literalStart = source.indexOf('`', declarationStart + anchor.length);
  if (literalStart < 0 || source.slice(declarationStart + anchor.length, literalStart).trim()) {
    throw new Error(name + ' is no longer a direct template-literal constant');
  }

  let i = literalStart + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === '`') {
      const semicolonEnd = source[i + 1] === ';' ? i + 2 : i + 1;
      const body = source.slice(literalStart + 1, i);
      if (DOCUMENTED_PROMPTS.includes(name) && !body.trim()) {
        throw new Error('Empty documented prompt body: ' + name);
      }
      return {
        name,
        body,
        declaration: source.slice(declarationStart, semicolonEnd),
      };
    }
    i++;
  }
  throw new Error('Unterminated template literal: ' + name);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function suiteVersionFromFilename(file) {
  const match = path.basename(file).match(/\bv(\d+\.\d+)\b/i);
  if (!match) throw new Error('Suite filename has no vNN.N version: ' + path.basename(file));
  return match[1];
}

// Explicit diagnostics for the harness's live contraindication regex extraction.
function extractAnchoredRegex(source, anchor, startMarker, endMarker, flags = '') {
  const at = source.indexOf(anchor);
  if (at < 0) throw new Error('Regex anchor missing: ' + anchor);
  const end = source.indexOf('\n', at);
  const line = source.slice(source.lastIndexOf('\n', at) + 1, end < 0 ? source.length : end);
  const start = line.indexOf(startMarker);
  if (start < 0) throw new Error('Regex start marker missing after anchor: ' + anchor);
  const stop = line.indexOf(endMarker, start + startMarker.length);
  if (stop < 0) throw new Error('Regex end marker missing after anchor: ' + anchor);
  const body = line.slice(start + startMarker.length, stop);
  if (!body) throw new Error('Empty regex body after anchor: ' + anchor);
  return new RegExp(body, flags);
}

// Manual measurement tools share strict parsing; importing this module does no I/O.
// Bounds keep typo-driven work lists and timer delays finite and reviewable.
function parseMeasurementArgs(argv, kind) {
  if (!['davis', 'neia'].includes(kind)) throw new Error('Unknown measurement tool: ' + kind);
  const davis = kind === 'davis';
  const config = { runs: davis ? 2 : 3, model: davis ? 'gemini-3.7-flash' : 'gemini-3.1-pro-preview',
    level: davis ? 'low' : 'high', width: davis ? 1 : 3, retryms: 20000, rpm: davis ? 15 : 0,
    out: davis ? 'davis-transcribe-report.json' : 'neia-retest-report.json',
    suite: '', only: [], images: [], dryRun: false, live: false, appProfile: false, help: false };
  const names = new Set(['runs', 'model', 'level', 'out', 'retryms', 'rpm', davis ? 'app' : 'html',
    ...(davis ? [] : ['width', 'only'])]);
  const flags = { '--dry-run': 'dryRun', '--live': 'live', '--app-profile': 'appProfile', '--help': 'help' };
  const seen = new Set();
  let positionalOnly = false;
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!positionalOnly && value === '--') { positionalOnly = true; continue; }
    if (!positionalOnly && value.startsWith('-')) {
      if (seen.has(value)) throw new Error('Duplicate option: ' + value);
      seen.add(value);
      if (flags[value]) { config[flags[value]] = true; continue; }
      const name = value.slice(2);
      if (!value.startsWith('--') || !names.has(name)) throw new Error('Unknown option: ' + value);
      const next = argv[++i];
      if (next === undefined || !next.trim() || next.startsWith('--')) throw new Error('Missing value for ' + value);
      if (name === 'app' || name === 'html') config.suite = next;
      else if (name === 'only') config.only = next.split(',').map(s => s.trim()).filter(Boolean);
      else config[name] = next;
    } else {
      if (!davis || !/\.(jpe?g|png|webp|heic|heif)$/i.test(value)) throw new Error('Unexpected input: ' + value);
      config.images.push(value);
    }
  }
  const number = (name, min, max, integer) => {
    const n = Number(config[name]);
    if (!Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) {
      throw new Error('--' + name + ' must be ' + (integer ? 'an integer' : 'finite') + ' from ' + min + ' to ' + max);
    }
    config[name] = n;
  };
  number('runs', 2, 100, true);
  number('width', 1, 100, true);
  number('retryms', 0, 600000, true);
  number('rpm', 0, 60000, false);
  if (!['minimal', 'low', 'medium', 'high'].includes(config.level)) throw new Error('--level must be minimal, low, medium, or high');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(config.model)) throw new Error('Invalid model ID');
  if (config.dryRun && config.live) throw new Error('Choose --dry-run or --live, not both');
  if (config.appProfile && (seen.has('--model') || seen.has('--level'))) throw new Error('--app-profile cannot be combined with --model or --level');
  if (davis && !config.images.length && !config.help) throw new Error('Pass at least one image path');
  if (seen.has('--only') && !config.only.length) throw new Error('--only requires at least one item ID');
  return config;
}

function resolveMeasurementProfile(config, source, tool) {
  if (!config.appProfile) return { model: config.model, level: config.level, profile: 'CLI baseline (explicit overrides allowed)' };
  if (!['cardTranscribe', 'itemAudit'].includes(tool)) throw new Error('Unknown app profile: ' + tool);
  const profiles = source.match(/const TOOL_PROFILE_DEFAULTS=\{([\s\S]*?)\n\};/);
  if (!profiles) throw new Error('App profile registry anchor missing');
  const row = profiles[1].match(new RegExp('\\b' + tool + ":\\{m:'(flash|pro)',lv:'([^']+)'\\}"));
  if (!row) throw new Error('App profile row missing: ' + tool);
  const family = row[1];
  const model = source.match(new RegExp('const \\[' + family + "Model,set[A-Za-z]+Model\\]=useState\\('([^']+)'\\)"));
  if (!model) throw new Error('App model default anchor missing: ' + family);
  return { model: model[1], level: row[2], family, profile: 'shipped-default:' + tool,
    profileCaveat: 'Shipped defaults only; saved browser profile overrides are not read.' };
}

function measurementPlan(config, count, profile) {
  if (!Number.isInteger(count) || count < 1) throw new Error('No measurement inputs selected');
  return { ...profile, runs: config.runs, logicalOperations: count * config.runs,
    maximumAttempts: count * config.runs * 4, maxAttemptsPerOperation: 4,
    retryPolicy: 'At most 3 retries after HTTP 429 or 5xx; other failures stop that operation.',
    width: config.width, rpm: config.rpm, retryms: config.retryms, maxOutputTokens: 65536,
    caveat: 'These are planned operations and an attempt ceiling, not exact HTTP calls or a price estimate.' };
}

function createMeasurementPacer(rpm, { now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let lastStart = null;
  return async function pace() {
    if (!rpm) return;
    const current = now();
    const wait = lastStart === null ? 0 : Math.max(0, lastStart + 60000 / rpm - current);
    lastStart = current + wait;
    if (wait > 0) await sleep(wait);
  };
}

module.exports = {
  DOCUMENTED_PROMPTS,
  FROZEN_PROMPTS,
  NAME_CLASH_RE,
  SUITE_FILE_RE,
  countExact,
  createMeasurementPacer,
  extractAnchoredRegex,
  extractPromptLiteral,
  listSuiteFiles,
  resolveSuiteFile,
  measurementPlan,
  parseMeasurementArgs,
  resolveMeasurementProfile,
  sha256,
  suiteVersionFromFilename,
};
