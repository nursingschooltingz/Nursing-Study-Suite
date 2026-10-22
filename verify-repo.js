#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkFrozenPrompts } = require('./tools/check-prompts');
const { checkPromptDoc } = require('./tools/render-prompts');
const { parseCliArgs, resolveSuiteFile, suiteVersionFromFilename } = require('./tools/repo-checks');

const REPO_ROOT = __dirname;
const BABEL_VERSION = '7.23.9';
const TEMP_TOOL_ROOT = path.join(os.tmpdir(), 'nursing-study-suite-verify');
const TEMP_BABEL = path.join(TEMP_TOOL_ROOT, 'node_modules', '@babel', 'standalone', 'babel.js');

function argValue(argv, name) {
  const at = argv.indexOf('--' + name);
  if (at < 0) return '';
  const val = argv[at + 1];
  if (!val || val.startsWith('--')) throw new Error('Missing value for --' + name);
  return val;
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

// v18.0 (review M1): the page asks @babel/standalone for the react preset only. These are the options its script-tag
// runner then uses (babel.js buildBabelOptions), so the gate compiles exactly what the browser runs.
const BROWSER_BABEL_OPTIONS = {
  presets: ['react'],
  plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
};

function extractBabelScript(source) {
  if (source.split('type="text/babel"').length !== 2) throw new Error('Expected exactly one text/babel script');
  const startMarker = '<script type="text/babel" data-presets="react">';
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
  const changelogFile = path.join(REPO_ROOT, 'CHANGELOG.md');
  if (path.dirname(path.resolve(suiteFile)) === REPO_ROOT && fs.existsSync(changelogFile)) {
    const changelog = fs.readFileSync(changelogFile, 'utf8');
    if (!changelog.includes('## [' + version + ']') && !changelog.includes('## [v' + version + ']')) {
      throw new Error('Filename version v' + version + ' has no matching heading in CHANGELOG.md');
    }
  }
  return source;
}

// v18.0 (review M29): the Babel parse alone could certify an app that cannot boot. Babel does not validate a regex
// body (`/[z-a]/` passed every gate and threw at load in the browser), and nothing evaluated the top level, so a
// constant read before its declaration also passed. V8 now compiles the transformed block and the plain head scripts,
// and the block's top level runs once against inert stubs: no network, no DOM, no rendering.
function bootSmoke(code, source) {
  const vm = require('vm');
  new vm.Script(code, { filename: 'suite-babel-block.js' });
  const babelStart = source.indexOf('<script type="text/babel"');
  const headSource = babelStart >= 0 ? source.slice(0, babelStart) : source;
  const inline = [...headSource.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (inline.length < 2) throw new Error('Expected the boot and DOMPurify head scripts; found ' + inline.length + ' plain <script> blocks');
  inline.forEach((body, i) => new vm.Script(body, { filename: 'head-script-' + (i + 1) + '.js' }));
  const noop = () => {};
  const R = new Proxy({}, { get: (_, k) => k === 'createContext' ? () => ({ Provider: 'P' })
    : k === 'memo' || k === 'forwardRef' ? f => f : k === 'Component' ? class {} : k === 'Fragment' ? 'F' : () => [undefined, noop] });
  const g = { React: R, ReactDOM: { createRoot: () => ({ render: noop }) }, document: { getElementById: () => ({}), addEventListener: noop },
    addEventListener: noop, removeEventListener: noop, localStorage: { getItem: () => null, setItem: noop }, sessionStorage: { getItem: () => null, setItem: noop },
    fetch: () => { throw new Error('no network in verify'); }, pdfjsLib: { GlobalWorkerOptions: {}, OPS: {} }, JSZip: function () {}, marked: { parse: x => x, use: noop },
    DOMPurify: { sanitize: x => x, addHook: noop }, console, setTimeout, clearTimeout, TextEncoder, TextDecoder, URL, Blob, AbortController, DOMException,
    crypto: globalThis.crypto, indexedDB: { open: () => ({}) } };
  g.window = g;
  vm.runInNewContext(code, g, { filename: 'suite-babel-block.js', timeout: 10000 });
}

function runHarness(suiteFile, babelFile) {
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'latte-tests.js'), suiteFile], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, NSS_BABEL_STANDALONE: babelFile },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('latte-tests.js exited with ' + result.status);
}

function main() {
  const argv = process.argv.slice(2);
  parseCliArgs(argv, { flags: ['setup-babel'], options: ['html', 'babel'] });
  const suiteFile = resolveSuiteFile({ rootDir: REPO_ROOT, explicit: argValue(argv, 'html') });
  const source = preflightSuite(suiteFile);
  const babel = loadBabel(argv);

  console.log('VERIFY ' + path.basename(suiteFile));
  console.log('PASS  one canonical suite HTML; LF-only; filename and release comment agree');
  const frozenCount = checkFrozenPrompts({ suiteFile });
  console.log('PASS  ' + frozenCount + ' frozen prompt constants match prompt-baseline.json');
  const documentedCount = checkPromptDoc({ suiteFile });
  console.log('PASS  Prompts.md contains live bytes for all ' + documentedCount + ' prompt constants');

  runHarness(suiteFile, babel.file);

  const { code } = babel.Babel.transform(extractBabelScript(source), BROWSER_BABEL_OPTIONS);
  console.log('PASS  Babel parse with ' + babel.file);
  bootSmoke(code, source);
  console.log('PASS  V8 compiles the app and the head scripts, and the app\'s top level evaluates');
  console.log('\nALL REPOSITORY GATES PASSED');
}

try {
  main();
} catch (error) {
  console.error('\nVERIFY FAILED\n' + (error.stack || error.message || error));
  process.exit(1);
}
