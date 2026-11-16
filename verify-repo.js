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

const MAX_BABEL_SCRIPT_CHARS = 500000;

function extractBabelScript(source) {
  if (source.split('type="text/babel"').length !== 2) throw new Error('Expected exactly one text/babel script');
  const startMarker = '<script type="text/babel" data-presets="react">';
  const occurrences = source.split(startMarker).length - 1;
  if (occurrences !== 1) throw new Error('Expected exactly one ' + startMarker + '; found ' + occurrences);
  const start = source.indexOf(startMarker) + startMarker.length;
  const end = source.indexOf('</script>', start);
  if (end < 0) throw new Error('Missing </script> after the Babel block');
  const script = source.slice(start, end);
  if (script.length > MAX_BABEL_SCRIPT_CHARS) {
    throw new Error('text/babel script is ' + script.length + ' chars (ceiling ' + MAX_BABEL_SCRIPT_CHARS + ' to prevent Babel 500KB deoptimization)');
  }
  return script;
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
// v21.6: bootSmoke also executes a first-render component smoke pass across App, ConfigSidebar, FactInspectorDrawer,
// and all 8 TOOL_COMPONENTS so TDZ ReferenceErrors or missing bindings inside lazy-mounted tabs cannot ship.
function bootSmoke(code, source) {
  const vm = require('vm');
  new vm.Script(code, { filename: 'suite-babel-block.js' });
  const babelStart = source.indexOf('<script type="text/babel"');
  const headSource = babelStart >= 0 ? source.slice(0, babelStart) : source;
  const inline = [...headSource.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (inline.length < 3) throw new Error('Expected the boot, DOMPurify, and core plain <script> blocks; found ' + inline.length + ' plain <script> blocks');
  inline.forEach((body, i) => new vm.Script(body, { filename: 'head-script-' + (i + 1) + '.js' }));
  const noop = () => {};
  let rootElement = null;
  const R = {
    Fragment: Symbol.for('react.fragment'),
    Component: class { constructor(props) { this.props = props; } },
    createContext(defaultValue) {
      const ctxObj = { _currentValue: defaultValue };
      ctxObj.Provider = function Provider(props) {
        return { $$provider: ctxObj, value: props ? props.value : defaultValue, children: props ? props.children : null };
      };
      return ctxObj;
    },
    useContext(ctxObj) { return ctxObj ? ctxObj._currentValue : undefined; },
    useState(init) { return [typeof init === 'function' ? init() : init, noop]; },
    useRef(init) { return { current: init }; },
    useMemo(fn) { return fn(); },
    useCallback(fn) { return fn; },
    useEffect(fn) { if (typeof fn !== 'function') throw new Error('useEffect expected function'); },
    memo(fn) { return { $$memo: true, type: fn }; },
    forwardRef(fn) { return fn; },
    createElement(type, props, ...children) {
      const flatChildren = children.length === 0 ? undefined : (children.length === 1 ? children[0] : children);
      return { type, props: Object.assign({}, props || {}, flatChildren !== undefined ? { children: flatChildren } : {}) };
    },
  };
  const g = { Babel: {}, React: R, ReactDOM: { createRoot: () => ({ render: el => { rootElement = el; } }) },
    document: { getElementById: () => ({}), addEventListener: noop, removeEventListener: noop, createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }), body: { appendChild: noop, style: {} } },
    addEventListener: noop, removeEventListener: noop, stop: noop, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    fetch: () => { throw new Error('no network in verify'); }, pdfjsLib: { GlobalWorkerOptions: {}, OPS: {}, getDocument: () => ({ promise: new Promise(noop), destroy: noop }) }, JSZip: function () {}, marked: { parse: x => x, use: noop },
    DOMPurify: { sanitize: x => x, addHook: noop }, console, setTimeout: () => 0, clearTimeout: noop, TextEncoder, TextDecoder, URL, Blob, AbortController, DOMException,
    crypto: globalThis.crypto, indexedDB: { open: () => ({}) } };
  g.window = g;
  const ctx = vm.createContext(g);
  inline.forEach((body, i) => vm.runInContext(body, ctx, { filename: 'head-script-' + (i + 1) + '.js', timeout: 10000 }));
  vm.runInContext(code, ctx, { filename: 'suite-babel-block.js', timeout: 10000 });
  if (g.__latteMounted !== true || !rootElement) throw new Error('App failed to mount cleanly in bootSmoke');
  g.__rootElement = rootElement;
  vm.runInContext(`
    (function runComponentSmoke() {
      const rendered = new Set();
      const captured = [];
      function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (node.$$provider) {
          captured.push([node.$$provider, node.value]);
          const prev = node.$$provider._currentValue;
          node.$$provider._currentValue = node.value;
          try { walk(node.children); } finally { node.$$provider._currentValue = prev; }
          return;
        }
        let t = node.type;
        if (t && t.$$memo) t = t.type;
        if (typeof t === 'function') {
          rendered.add(t.name || 'anon');
          if (t.prototype && t.prototype instanceof React.Component) {
            const inst = new t(node.props || {});
            walk(inst.render());
          } else {
            walk(t(node.props || {}));
          }
          return;
        }
        if (node.props && node.props.children !== undefined) walk(node.props.children);
      }
      walk(window.__rootElement);
      const saved = captured.map(([c, v]) => { const prev = c._currentValue; c._currentValue = v; return [c, prev]; });
      try {
        const expectedTools = ['knowledge', 'priority', 'anki', 'nclex', 'nclexgen', 'cases', 'nclex2anki', 'gizmo'];
        for (const id of expectedTools) {
          const entry = TOOL_COMPONENTS[id];
          const fn = entry && entry.$$memo ? entry.type : entry;
          if (typeof fn !== 'function') throw new Error('Missing TOOL_COMPONENTS.' + id);
          walk(React.createElement(fn, {}));
        }
        walk(React.createElement(ConfigSidebar, { onClose: () => {}, activeTool: 'knowledge' }));
      } finally {
        for (let i = saved.length - 1; i >= 0; i--) saved[i][0]._currentValue = saved[i][1];
      }
      const mustRender = ['App', 'KnowledgeBaseBuilder', 'PriorityAnalyzer', 'AnkiGenerator', 'NCLEXExtractor', 'NCLEXGenerator', 'CaseStudyGenerator', 'NCLEXToAnki', 'GizmoImporter', 'ConfigSidebar', 'FactInspectorDrawer'];
      for (const name of mustRender) {
        if (!rendered.has(name)) throw new Error('bootSmoke did not render component: ' + name);
      }
      window.__smokeRenderedCount = rendered.size;
    })();
  `, ctx, { filename: 'suite-render-smoke.js', timeout: 10000 });
  delete g.__rootElement;
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
  console.log('PASS  V8 compiles the app and the head scripts, evaluates top level, and render-smokes App + all 8 tool components');
  console.log('\nALL REPOSITORY GATES PASSED');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('\nVERIFY FAILED\n' + (error.stack || error.message || error));
    process.exit(1);
  }
}

module.exports = {
  BROWSER_BABEL_OPTIONS,
  MAX_BABEL_SCRIPT_CHARS,
  extractBabelScript,
  bootSmoke,
};
