#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkFrozenPrompts } = require('./tools/check-prompts');
const { checkPromptDoc } = require('./tools/render-prompts');
const { resolveSuiteFile, suiteVersionFromFilename } = require('./tools/repo-checks');

const REPO_ROOT = __dirname;
const BABEL_VERSION = '7.23.9';
const TEMP_TOOL_ROOT = path.join(os.tmpdir(), 'nursing-study-suite-verify');
const TEMP_BABEL = path.join(TEMP_TOOL_ROOT, 'node_modules', '@babel', 'standalone', 'babel.js');

function argValue(argv, name) {
  const at = argv.indexOf('--' + name);
  return at >= 0 ? argv[at + 1] || '' : '';
}

function installBabel() {
  const npmArgs = [
    'install', '--prefix', TEMP_TOOL_ROOT, '--no-save', '--package-lock=false', '--ignore-scripts',
    '@babel/standalone@' + BABEL_VERSION,
  ];
  const npm = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const commandArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd', ...npmArgs]
    : npmArgs;
  console.log('SETUP Installing @babel/standalone@' + BABEL_VERSION + ' under ' + TEMP_TOOL_ROOT);
  const result = spawnSync(npm, commandArgs, { cwd: os.tmpdir(), stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Babel scratch install exited with ' + result.status);
}

function loadBabel(argv) {
  const requested = argValue(argv, 'babel') || process.env.NSS_BABEL_STANDALONE || '';
  const candidate = requested ? path.resolve(requested) : TEMP_BABEL;
  if (!fs.existsSync(candidate) && argv.includes('--setup-babel')) installBabel();
  if (!fs.existsSync(candidate)) {
    throw new Error('Babel gate unavailable. Run `node verify-repo.js --setup-babel` once, or pass ' +
      '`--babel <path-to-@babel/standalone/babel.js>`. Scratch tooling stays outside the repo.');
  }
  return { Babel: require(candidate), file: candidate };
}

function extractBabelScript(source) {
  const startMarker = '<script type="text/babel">';
  const occurrences = source.split(startMarker).length - 1;
  if (occurrences !== 1) throw new Error('Expected exactly one ' + startMarker + '; found ' + occurrences);
  const start = source.indexOf(startMarker) + startMarker.length;
  const end = source.indexOf('</script>', start);
  if (end < 0) throw new Error('Missing </script> after the Babel block');
  return source.slice(start, end);
}

function preflightSuite(suiteFile) {
  const source = fs.readFileSync(suiteFile, 'utf8');
  if (source.includes('\r')) throw new Error('CR byte found; the repository is LF-only: ' + suiteFile);
  const version = suiteVersionFromFilename(suiteFile);
  if (!source.includes('<!-- v' + version + ' (')) {
    throw new Error('Filename version v' + version + ' has no matching release comment in the HTML');
  }
  return source;
}

function runHarness(suiteFile) {
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'latte-tests.js'), suiteFile], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('latte-tests.js exited with ' + result.status);
}

function main() {
  const argv = process.argv.slice(2);
  const suiteFile = resolveSuiteFile({ rootDir: REPO_ROOT, explicit: argValue(argv, 'html') });
  const source = preflightSuite(suiteFile);
  const babel = loadBabel(argv);

  console.log('VERIFY ' + path.basename(suiteFile));
  console.log('PASS  one canonical suite HTML; LF-only; filename and release comment agree');
  const frozenCount = checkFrozenPrompts({ suiteFile });
  console.log('PASS  ' + frozenCount + ' frozen prompt constants match prompt-baseline.json');
  const documentedCount = checkPromptDoc({ suiteFile });
  console.log('PASS  Prompts.md contains live bytes for all ' + documentedCount + ' prompt constants');

  runHarness(suiteFile);

  babel.Babel.transform(extractBabelScript(source), { presets: ['react'] });
  console.log('PASS  Babel parse with ' + babel.file);
  console.log('\nALL REPOSITORY GATES PASSED');
}

try {
  main();
} catch (error) {
  console.error('\nVERIFY FAILED\n' + (error.stack || error.message || error));
  process.exit(1);
}
