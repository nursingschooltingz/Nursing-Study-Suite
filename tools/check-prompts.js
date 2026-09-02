#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  FROZEN_PROMPTS,
  extractPromptLiteral,
  resolveSuiteFile,
  sha256,
} = require('./repo-checks');

const REPO_ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(REPO_ROOT, 'prompt-baseline.json');

function checkFrozenPrompts({ suiteFile, baselineFile = BASELINE_FILE }) {
  const source = fs.readFileSync(suiteFile, 'utf8');
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const expectedNames = Object.keys(baseline.prompts || {}).sort();
  const frozenNames = [...FROZEN_PROMPTS].sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(frozenNames)) {
    throw new Error('prompt-baseline.json must contain exactly the 11 frozen prompt names');
  }

  const changed = [];
  for (const name of FROZEN_PROMPTS) {
    const literal = extractPromptLiteral(source, name);
    const actual = sha256(literal.body);
    const expected = baseline.prompts[name];
    if (actual !== expected) changed.push(name + ': expected ' + expected + ', found ' + actual);
  }
  if (changed.length) {
    throw new Error('Frozen prompt byte-check failed:\n  ' + changed.join('\n  '));
  }
  return FROZEN_PROMPTS.length;
}

function argValue(argv, name) {
  const at = argv.indexOf('--' + name);
  return at >= 0 ? argv[at + 1] || '' : '';
}

if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    const suiteFile = resolveSuiteFile({ rootDir: REPO_ROOT, explicit: argValue(argv, 'html') });
    const count = checkFrozenPrompts({ suiteFile });
    console.log('PASS  ' + count + ' frozen prompt constants are byte-identical to prompt-baseline.json');
  } catch (error) {
    console.error('FAIL  ' + (error.stack || error.message || error));
    process.exit(1);
  }
}

module.exports = { BASELINE_FILE, checkFrozenPrompts };
