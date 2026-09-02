#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DOCUMENTED_PROMPTS,
  extractPromptLiteral,
  resolveSuiteFile,
  sha256,
  suiteVersionFromFilename,
} = require('./repo-checks');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROMPTS_FILE = path.join(REPO_ROOT, 'Prompts.md');
const START = '<!-- BEGIN GENERATED: EXTRACTOR_AND_TRANSCRIBER_PROMPTS -->';
const END = '<!-- END GENERATED: EXTRACTOR_AND_TRANSCRIBER_PROMPTS -->';
const APPENDIX_PROMPTS = [
  'NCLEX_INLINE_PROMPT',
  'NCLEX_SPLIT_PROMPT',
  'NCLEX_AI_PAIR_PROMPT',
  'CARD_TRANSCRIBE_PROMPT',
];

function promptBlock(literal, status) {
  return [
    '### `' + literal.name + '` (' + literal.body.length.toLocaleString('en-US') + ' source chars; ' + status + ')',
    '',
    'SHA-256 of the raw template-literal body: `' + sha256(literal.body) + '`',
    '',
    '````js',
    literal.declaration,
    '````',
  ].join('\n');
}

function buildGeneratedAppendix(source) {
  const blocks = APPENDIX_PROMPTS.map(name => {
    const status = name === 'CARD_TRANSCRIBE_PROMPT'
      ? 'tunable; remeasure with 2 runs per card after edits'
      : 'byte-frozen';
    return promptBlock(extractPromptLiteral(source, name), status);
  });
  return [
    START,
    '## Appendix · NCLEX Extractor and card-transcription constants',
    '',
    'Generated verbatim from the shipped HTML by `node tools/render-prompts.js --write`.',
    'Do not edit inside these markers. The three extractor prompts are among the 11 byte-frozen',
    'constants. `CARD_TRANSCRIBE_PROMPT` is not byte-frozen, but its safety rules are load-bearing.',
    '',
    blocks.join('\n\n'),
    END,
  ].join('\n');
}

function generatedSpan(doc) {
  const startCount = doc.split(START).length - 1;
  const endCount = doc.split(END).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    throw new Error('Prompts.md must contain exactly one generated appendix marker pair');
  }
  const start = doc.indexOf(START);
  const end = doc.indexOf(END, start) + END.length;
  return { start, end, value: doc.slice(start, end) };
}

function checkPromptDoc({ suiteFile, promptsFile = PROMPTS_FILE }) {
  const source = fs.readFileSync(suiteFile, 'utf8');
  const doc = fs.readFileSync(promptsFile, 'utf8');
  const expectedAppendix = buildGeneratedAppendix(source);
  const span = generatedSpan(doc);
  if (span.value !== expectedAppendix) {
    throw new Error('Prompts.md generated appendix is stale; run node tools/render-prompts.js --write');
  }

  const missing = DOCUMENTED_PROMPTS.filter(name => {
    const literal = extractPromptLiteral(source, name);
    return !doc.includes(literal.body);
  });
  if (missing.length) throw new Error('Prompts.md is missing live prompt bytes for: ' + missing.join(', '));

  const version = suiteVersionFromFilename(suiteFile);
  if (!doc.includes('shipped v' + version + ' file')) {
    throw new Error('Prompts.md header does not name shipped v' + version);
  }
  return DOCUMENTED_PROMPTS.length;
}

function writePromptDoc({ suiteFile, promptsFile = PROMPTS_FILE }) {
  const source = fs.readFileSync(suiteFile, 'utf8');
  let doc = fs.readFileSync(promptsFile, 'utf8').replace(/\r\n?/g, '\n');
  const expectedAppendix = buildGeneratedAppendix(source);
  const version = suiteVersionFromFilename(suiteFile);
  const versionMatches = doc.match(/shipped v\d+\.\d+ file/g) || [];
  if (versionMatches.length !== 1) {
    throw new Error('Prompts.md must name exactly one shipped vNN.N file in its header');
  }
  doc = doc.replace(/shipped v\d+\.\d+ file/, 'shipped v' + version + ' file');
  if (doc.includes(START) || doc.includes(END)) {
    const span = generatedSpan(doc);
    doc = doc.slice(0, span.start) + expectedAppendix + doc.slice(span.end);
  } else {
    doc = doc.replace(/\s*$/, '') + '\n\n---\n\n' + expectedAppendix + '\n';
  }
  fs.writeFileSync(promptsFile, doc, 'utf8');
}

function argValue(argv, name) {
  const at = argv.indexOf('--' + name);
  return at >= 0 ? argv[at + 1] || '' : '';
}

if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    const suiteFile = resolveSuiteFile({ rootDir: REPO_ROOT, explicit: argValue(argv, 'html') });
    if (argv.includes('--write')) {
      writePromptDoc({ suiteFile });
      console.log('Updated Prompts.md generated appendix from ' + path.basename(suiteFile));
    } else if (argv.includes('--check')) {
      const count = checkPromptDoc({ suiteFile });
      console.log('PASS  Prompts.md contains live bytes for all ' + count + ' prompt constants');
    } else {
      throw new Error('Usage: node tools/render-prompts.js --check|--write [--html <file>]');
    }
  } catch (error) {
    console.error('FAIL  ' + (error.stack || error.message || error));
    process.exit(1);
  }
}

module.exports = { END, START, buildGeneratedAppendix, checkPromptDoc, writePromptDoc };
