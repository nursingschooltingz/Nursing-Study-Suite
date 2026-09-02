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
      return {
        name,
        body: source.slice(literalStart + 1, i),
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

module.exports = {
  DOCUMENTED_PROMPTS,
  FROZEN_PROMPTS,
  NAME_CLASH_RE,
  SUITE_FILE_RE,
  countExact,
  extractPromptLiteral,
  listSuiteFiles,
  resolveSuiteFile,
  sha256,
  suiteVersionFromFilename,
};
