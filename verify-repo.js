#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkFrozenPrompts } = require('./tools/check-prompts');
const { checkPromptDoc } = require('./tools/render-prompts');
const { parseCliArgs, resolveSuiteFile, suiteVersionFromFilename } = require('./tools/repo-checks');

const REPO_ROOT = __dirname;
const BABEL_VERSION = '7.23.9';
// v21.10 (Phase 2): pin SHA-256 of @babel/standalone@7.23.9/babel.js, install into a user-private cache directory (0700 on POSIX), and avoid cmd.exe shell invocation on Windows.
const BABEL_SHA256 = '190679c2d0d05cffc00b1a719278dcc85d78b1cca6b78d75c8fa432affce682f';
const PRIVATE_TOOL_ROOT = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'nursing-study-suite-verify')
  : path.join(os.homedir(), '.cache', 'nursing-study-suite-verify');
const PRIVATE_BABEL = path.join(PRIVATE_TOOL_ROOT, 'node_modules', '@babel', 'standalone', 'babel.js');
const LEGACY_TEMP_BABEL = path.join(os.tmpdir(), 'nursing-study-suite-verify', 'node_modules', '@babel', 'standalone', 'babel.js');

function verifyBabelIntegrity(filePath) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (hash !== BABEL_SHA256) {
    throw new Error(
      'Babel integrity check failed for ' + filePath + ' (expected SHA-256 ' + BABEL_SHA256 + ', got ' + hash +
      '). Remove the untrusted cache and re-run `node verify-repo.js --setup-babel`.'
    );
  }
  return hash;
}

function installBabel() {
  fs.mkdirSync(PRIVATE_TOOL_ROOT, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    try { fs.chmodSync(PRIVATE_TOOL_ROOT, 0o700); } catch {}
  }
  const npmArgs = [
    'install', '--prefix', PRIVATE_TOOL_ROOT, '--no-save', '--package-lock=false', '--ignore-scripts',
    '@babel/standalone@' + BABEL_VERSION,
  ];
  console.log('SETUP Installing @babel/standalone@' + BABEL_VERSION + ' under ' + PRIVATE_TOOL_ROOT);
  let result;
  if (process.platform === 'win32') {
    const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (!fs.existsSync(npmCli)) {
      throw new Error('Could not locate npm-cli.js next to Node executable (' + npmCli + '); pass `--babel <path>` or install Node with npm.');
    }
    result = spawnSync(process.execPath, [npmCli, ...npmArgs], { cwd: PRIVATE_TOOL_ROOT, stdio: 'inherit', shell: false });
  } else {
    result = spawnSync('npm', npmArgs, { cwd: PRIVATE_TOOL_ROOT, stdio: 'inherit', shell: false });
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Babel scratch install exited with ' + result.status);
  if (!fs.existsSync(PRIVATE_BABEL)) throw new Error('Babel install completed but ' + PRIVATE_BABEL + ' is missing');
  verifyBabelIntegrity(PRIVATE_BABEL);
}

function loadBabel(argv) {
  const cli = Array.isArray(argv)
    ? parseCliArgs(argv, { flags: ['setup-babel'], options: ['html', 'babel'] })
    : (argv || { flags: new Set(), values: {} });
  const requested = cli.values.babel || process.env.NSS_BABEL_STANDALONE || '';
  let candidate;
  if (requested) {
    candidate = path.resolve(requested);
  } else if (fs.existsSync(PRIVATE_BABEL)) {
    candidate = PRIVATE_BABEL;
  } else if (fs.existsSync(LEGACY_TEMP_BABEL)) {
    candidate = LEGACY_TEMP_BABEL;
  } else {
    candidate = PRIVATE_BABEL;
    if (cli.flags.has('setup-babel')) installBabel();
  }
  if (!fs.existsSync(candidate)) {
    throw new Error('Babel gate unavailable. Run `node verify-repo.js --setup-babel` once, or pass ' +
      '`--babel <path-to-@babel/standalone/babel.js>`. Scratch tooling stays outside the repo.');
  }
  verifyBabelIntegrity(candidate);
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
  const utf8Bytes = Buffer.byteLength(script, 'utf8');
  if (script.length > MAX_BABEL_SCRIPT_CHARS || utf8Bytes > MAX_BABEL_SCRIPT_CHARS) {
    throw new Error('text/babel script is ' + script.length + ' chars / ' + utf8Bytes + ' UTF-8 bytes (ceiling ' + MAX_BABEL_SCRIPT_CHARS + ' to prevent Babel 500KB deoptimization)');
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
  // v21.10 (Phase 1): keep runtime suiteVersion() locked to the filename version so footer and exported evidence never drift stale.
  if (!source.includes("function suiteVersion(){return '" + version + "';}")) {
    throw new Error('Filename version v' + version + ' does not match suiteVersion() in the HTML');
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

const AST_KNOWN_GLOBALS = new Set([
  'window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'indexedDB',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'Headers', 'Request', 'Response', 'AbortController', 'AbortSignal', 'DOMException', 'DOMParser',
  'URL', 'Blob', 'File', 'FileReader', 'FormData', 'TextEncoder', 'TextDecoder', 'Uint8Array', 'Uint16Array', 'Uint32Array',
  'Int8Array', 'Int16Array', 'Int32Array', 'ArrayBuffer', 'DataView', 'Float32Array', 'Float64Array',
  'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'BigInt', 'Proxy', 'Reflect',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'RegExp', 'Date', 'Math', 'JSON', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
  'Function', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Infinity', 'NaN', 'undefined', 'globalThis', 'self',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'atob', 'btoa',
  'Worker', 'MessageChannel', 'createImageBitmap', 'Image', 'Audio', 'HTMLElement', 'Event', 'CustomEvent',
  'alert', 'confirm', 'prompt', 'crypto', 'performance', 'structuredClone', 'queueMicrotask',
  'React', 'ReactDOM', 'DOMPurify', 'marked', 'pdfjsLib', 'JSZip', 'Babel', 'arguments',
]);

// v21.10 (Phase 1): statically walk every inline <script> block (plain + Babel-transformed JSX) to catch undeclared
// free identifiers inside event handlers, useEffect hooks, and hoisted *WithEnv runners that bootSmoke does not execute.
function astFreeVarCheck(source, Babel) {
  const blocks = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(source)) !== null) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue;
    const before = source.slice(Math.max(0, m.index - 40), m.index);
    if (before.includes('<template')) continue;
    const startLine = source.slice(0, m.index).split('\n').length;
    blocks.push({ isBabel: /text\/babel/.test(attrs), startLine, code: m[2] });
  }
  let fullCode = '';
  const lineOffsets = [];
  let curLine = 1;
  for (const b of blocks) {
    const transformed = b.isBabel
      ? Babel.transform(b.code, { ...BROWSER_BABEL_OPTIONS, retainLines: true }).code
      : b.code;
    const lines = transformed.split('\n').length;
    lineOffsets.push({ startCombined: curLine, startHtml: b.startLine, lines });
    fullCode += transformed + '\n';
    curLine += lines;
  }
  const mapLine = l => {
    for (let i = lineOffsets.length - 1; i >= 0; i--) {
      if (l >= lineOffsets[i].startCombined) return lineOffsets[i].startHtml + (l - lineOffsets[i].startCombined);
    }
    return l;
  };
  const undeclared = [];
  const plugin = () => ({
    visitor: {
      Program: {
        exit(p) {
          p.traverse({
            ReferencedIdentifier(idPath) {
              const name = idPath.node.name;
              if (AST_KNOWN_GLOBALS.has(name) || idPath.scope.hasBinding(name)) return;
              if (idPath.parent.type === 'UnaryExpression' && idPath.parent.operator === 'typeof') return;
              let fnName = '<top>';
              let cur = idPath.parentPath;
              while (cur) {
                if (cur.node.type === 'FunctionDeclaration' && cur.node.id) { fnName = cur.node.id.name; break; }
                if ((cur.node.type === 'FunctionExpression' || cur.node.type === 'ArrowFunctionExpression') &&
                    cur.parent.type === 'VariableDeclarator' && cur.parent.id.type === 'Identifier') {
                  fnName = cur.parent.id.name; break;
                }
                cur = cur.parentPath;
              }
              const line = idPath.node.loc ? mapLine(idPath.node.loc.start.line) : 0;
              undeclared.push({ name, line, fn: fnName });
            },
          });
        },
      },
    },
  });
  Babel.transform(fullCode, { plugins: [plugin], code: false, ast: false });
  if (undeclared.length) {
    const summary = undeclared.slice(0, 12).map(u => `${u.name} (L${u.line} in ${u.fn})`).join(', ');
    throw new Error('AST free-identifier check found ' + undeclared.length + ' undeclared reference(s): ' + summary);
  }
  return { blocksChecked: blocks.length };
}

// v18.0 (review M29): the Babel parse alone could certify an app that cannot boot. Babel does not validate a regex
// body (`/[z-a]/` passed every gate and threw at load in the browser), and nothing evaluated the top level, so a
// constant read before its declaration also passed. V8 now compiles the transformed block and the plain head scripts,
// and the block's top level runs once against inert stubs: no network, no DOM, no rendering.
// v21.6 + v21.10: bootSmoke also executes a first-render component smoke pass across App, ConfigSidebar, FactInspectorDrawer,
// and every tool registered in TOOLS / TOOL_COMPONENTS so TDZ ReferenceErrors or missing bindings inside lazy-mounted tabs cannot ship.
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
    DOMPurify: { sanitize: x => x, addHook: noop, isSupported: true }, console, setTimeout: () => 0, clearTimeout: noop, TextEncoder, TextDecoder, URL, Blob, AbortController, DOMException,
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
        const toolIds = Array.isArray(TOOLS) ? TOOLS.map(t => t.id) : [];
        const compIds = Object.keys(TOOL_COMPONENTS || {});
        if (!toolIds.length || toolIds.length !== compIds.length || toolIds.some(id => !Object.prototype.hasOwnProperty.call(TOOL_COMPONENTS, id))) {
          throw new Error('TOOLS and TOOL_COMPONENTS mismatch: ' + toolIds.join(',') + ' vs ' + compIds.join(','));
        }
        for (const id of toolIds) {
          const entry = TOOL_COMPONENTS[id];
          const fn = entry && entry.$$memo ? entry.type : entry;
          if (typeof fn !== 'function') throw new Error('Missing TOOL_COMPONENTS.' + id);
          walk(React.createElement(fn, {}));
        }
        walk(React.createElement(ConfigSidebar, { onClose: () => {}, activeTool: 'knowledge' }));
      } finally {
        for (let i = saved.length - 1; i >= 0; i--) saved[i][0]._currentValue = saved[i][1];
      }
      const mustRender = ['App', 'ConfigSidebar', 'FactInspectorDrawer', ...Object.values(TOOL_COMPONENTS).map(e => (e && e.$$memo ? e.type : e).name)];
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
  const cli = parseCliArgs(argv, { flags: ['setup-babel'], options: ['html', 'babel'] });
  const suiteFile = resolveSuiteFile({ rootDir: REPO_ROOT, explicit: cli.values.html || '' });
  const source = preflightSuite(suiteFile);
  const babel = loadBabel(cli);

  console.log('VERIFY ' + path.basename(suiteFile));
  console.log('PASS  one canonical suite HTML; LF-only; filename and release comment agree');
  const frozenCount = checkFrozenPrompts({ suiteFile });
  console.log('PASS  ' + frozenCount + ' frozen prompt constants match prompt-baseline.json');
  const documentedCount = checkPromptDoc({ suiteFile });
  console.log('PASS  Prompts.md contains live bytes for all ' + documentedCount + ' prompt constants');

  runHarness(suiteFile, babel.file);

  const { code } = babel.Babel.transform(extractBabelScript(source), BROWSER_BABEL_OPTIONS);
  console.log('PASS  Babel parse with ' + babel.file);
  const astCheck = astFreeVarCheck(source, babel.Babel);
  console.log('PASS  AST free-identifier check across ' + astCheck.blocksChecked + ' inline script blocks (0 undeclared references)');
  bootSmoke(code, source);
  console.log('PASS  V8 compiles the app and the head scripts, evaluates top level, and render-smokes App + all registered tool components');
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
  BABEL_SHA256,
  PRIVATE_TOOL_ROOT,
  BROWSER_BABEL_OPTIONS,
  MAX_BABEL_SCRIPT_CHARS,
  verifyBabelIntegrity,
  loadBabel,
  extractBabelScript,
  astFreeVarCheck,
  bootSmoke,
};
