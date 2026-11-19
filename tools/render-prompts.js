#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DOCUMENTED_PROMPTS,
  extractPromptLiteral,
  parseCliArgs,
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
  'I2A_TRANSCRIBE_PROMPT',
  'I2A_ANSWER_PROMPT',
  'KB_SOURCE_ANCHOR_RULES',
  'KB_CONCEPT_CURRICULUM_RULES',
  'KB_EXAM_TRAP_RULES',
  'KB_PLATE_BRIDGE_RULES',
  'NCLEX_PLATE_TRAP_RULES',
  'CASE_SLOPE_SYNC_RULES',
  'CASE_NGN_TYPE_RULES',
  'GIZMO_DEFAULT_IMPORT_PROMPT',
  'GIZMO_CONVERT_PROMPT',
  'COURSE_ANALYZER_PROMPT',
];
// v21.10 (Phase 6 M20): keep dynamic builder functions and heading char counts synced programmatically alongside the generated appendix.
const DYNAMIC_BUILDERS = Object.freeze([
  'paBuildExtractPrompt',
  'paBuildSynthPrompt',
  'caseBuildPrompt',
  'itemBuildAuditPrompt',
  'caseBuildRepairPrompt',
]);
const HEADING_CHAR_CONSTANTS = Object.freeze([
  'KB_EXTRACTION_PROMPT',
  'KB_VERIFY_PROMPT',
  'ANKI_MASTER_PROMPT',
  'NCLEX_GEN_PROMPT',
  'NCLEX_ANCHOR_RULES',
  'NCLEX_DISTRACTOR_RULES',
  'NCLEX_RATIONALE_RULES',
  'NCLEX_COMPLETENESS_RULES',
  'PRIORITY_ORDER_RULES',
]);

function extractBuilderFunction(source, name) {
  const anchor = 'function ' + name + '(';
  const start = source.indexOf(anchor);
  if (start < 0 || source.indexOf(anchor, start + 1) >= 0) {
    throw new Error('Dynamic builder anchor must occur exactly once: ' + anchor);
  }
  const openBrace = source.indexOf('{', start + anchor.length);
  if (openBrace < 0) throw new Error('Missing opening brace for builder: ' + name);
  let i = openBrace + 1, depth = 1;
  const tplBraceStack = [];
  while (i < source.length && depth > 0) {
    const ch = source[i], next = source[i + 1];
    if (ch === '/' && next === '/') {
      const nl = source.indexOf('\n', i + 2);
      i = nl < 0 ? source.length : nl + 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated block comment in builder: ' + name);
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\\') i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (ch === '`') {
      i++;
      let inTpl = true;
      while (i < source.length && inTpl) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '`') { i++; inTpl = false; break; }
        if (source[i] === '$' && source[i + 1] === '{') {
          tplBraceStack.push(depth);
          depth++;
          i += 2;
          inTpl = false;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') {
      depth--;
      i++;
      if (tplBraceStack.length && tplBraceStack[tplBraceStack.length - 1] === depth) {
        tplBraceStack.pop();
        while (i < source.length) {
          if (source[i] === '\\') { i += 2; continue; }
          if (source[i] === '`') { i++; break; }
          if (source[i] === '$' && source[i + 1] === '{') {
            tplBraceStack.push(depth);
            depth++;
            i += 2;
            break;
          }
          i++;
        }
      }
      continue;
    }
    i++;
  }
  if (depth !== 0) throw new Error('Unbalanced braces in builder: ' + name);
  return source.slice(start, i);
}

function headingCharRegex(name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^#+[^\\n]*`' + esc + '`(?:,\\s*v[\\d.]+,|\\s*\\(|,|\\s)\\s*)([\\d,]+)(\\s+chars)', 'm');
}

function syncBuilderBlock(doc, name, liveSource) {
  const open = '````js\nfunction ' + name + '(';
  const start = doc.indexOf(open);
  if (start < 0 || doc.indexOf(open, start + 1) >= 0) {
    throw new Error('Prompts.md must contain exactly one ````js block for ' + name);
  }
  const endFence = doc.indexOf('\n````', start + open.length);
  if (endFence < 0) throw new Error('Unterminated ````js block for ' + name + ' in Prompts.md');
  return doc.slice(0, start) + '````js\n' + liveSource + doc.slice(endFence);
}

function expectedHeadingCounts(source) {
  const counts = [];
  for (const name of HEADING_CHAR_CONSTANTS) {
    counts.push([name, extractPromptLiteral(source, name).body.length]);
  }
  for (const name of DYNAMIC_BUILDERS) {
    if (name === 'caseBuildRepairPrompt') continue;
    counts.push([name, extractBuilderFunction(source, name).length]);
  }
  return counts;
}

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
      : name.startsWith('I2A_')
        ? 'tunable; copied from img2anki.py, bump I2A_PROMPT_VERSION after edits'
        : name === 'KB_SOURCE_ANCHOR_RULES'
          ? 'tunable; v19.0 Point-ID anchoring rules appended by kbBuildFocusBlock'
          : name === 'KB_CONCEPT_CURRICULUM_RULES'
            ? 'tunable; v20.0 concept-curriculum P-LATE rules appended by kbBuildFocusBlock'
            : name === 'KB_EXAM_TRAP_RULES'
              ? 'tunable; v20.0 HESI/ATI/NGN Exam Trap mapping rules appended by kbBuildFocusBlock'
              : name === 'KB_PLATE_BRIDGE_RULES'
                ? 'tunable; v21.0 P-LATE RN vs. NP Mechanism Bridge tagging rules appended by kbBuildFocusBlock'
                : name === 'NCLEX_PLATE_TRAP_RULES'
                  ? 'tunable; v21.0 P-LATE 4-Pillar distractor & Slope Red Flag runtime directive for NCLEXGenerator'
                  : name === 'CASE_SLOPE_SYNC_RULES'
                    ? 'tunable; v21.0 Unfolding EHR State-Machine & Cross-Stage Synchronization directive for CaseStudyGenerator'
                    : name === 'CASE_NGN_TYPE_RULES'
                      ? 'tunable; v21.7 Next Generation NCLEX (Bowtie, Matrix, Cloze, Trend) format contract for CaseStudyGenerator'
                      : name === 'COURSE_ANALYZER_PROMPT'
                        ? 'tunable; v21.9 conservative-retention syllabus & lecture PPTX curriculum analyst for 01 · Course Analyzer'
                        : 'byte-frozen';
    return promptBlock(extractPromptLiteral(source, name), status);
  });
  return [
    START,
    '## Appendix · NCLEX Extractor, card-transcription and NCLEX to Anki constants',
    '',
    'Generated verbatim from the shipped HTML by `node tools/render-prompts.js --write`.',
    'Do not edit inside these markers. The three extractor prompts and two Gizmo prompts are among the 13 byte-frozen',
    'constants. `CARD_TRANSCRIBE_PROMPT` is not byte-frozen, but its safety rules are load-bearing.',
    'The two `I2A_` prompts belong to the NCLEX to Anki image reader and are not byte-frozen either.',
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
  const endAt = doc.indexOf(END, start);
  if (endAt < 0) throw new Error('Prompts.md generated appendix end marker precedes its start marker');
  const end = endAt + END.length;
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

  const staleBuilders = DYNAMIC_BUILDERS.filter(name => !doc.includes('````js\n' + extractBuilderFunction(source, name) + '\n````'));
  if (staleBuilders.length) {
    throw new Error('Prompts.md dynamic builder blocks are stale (' + staleBuilders.join(', ') + '); run node tools/render-prompts.js --write');
  }

  const staleCounts = [];
  for (const [name, expected] of expectedHeadingCounts(source)) {
    const re = headingCharRegex(name);
    const match = doc.match(re);
    const formatted = expected.toLocaleString('en-US');
    if (!match || match[2] !== formatted) {
      staleCounts.push(name + ': expected ' + formatted + ', found ' + (match ? match[2] : 'missing'));
    }
  }
  if (staleCounts.length) {
    throw new Error('Prompts.md heading character counts are stale (' + staleCounts.join('; ') + '); run node tools/render-prompts.js --write');
  }

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
  for (const name of DYNAMIC_BUILDERS) {
    doc = syncBuilderBlock(doc, name, extractBuilderFunction(source, name));
  }
  for (const [name, expected] of expectedHeadingCounts(source)) {
    const re = headingCharRegex(name);
    if (!re.test(doc)) throw new Error('Prompts.md heading char-count anchor missing for ' + name);
    doc = doc.replace(re, (_, pre, _old, suf) => pre + expected.toLocaleString('en-US') + suf);
  }
  if (doc.includes(START) || doc.includes(END)) {
    const span = generatedSpan(doc);
    doc = doc.slice(0, span.start) + expectedAppendix + doc.slice(span.end);
  } else {
    doc = doc.replace(/\s*$/, '') + '\n\n---\n\n' + expectedAppendix + '\n';
  }
  fs.writeFileSync(promptsFile, doc, 'utf8');
}

if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    const cli = parseCliArgs(argv, { flags: ['check', 'write'], options: ['html'] });
    if (cli.flags.has('check') && cli.flags.has('write')) {
      throw new Error('Choose either --check or --write, not both');
    }
    const suiteFile = resolveSuiteFile({ rootDir: REPO_ROOT, explicit: cli.values.html || '' });
    if (cli.flags.has('write')) {
      writePromptDoc({ suiteFile });
      console.log('Updated Prompts.md generated appendix, dynamic builders, and heading counts from ' + path.basename(suiteFile));
    } else if (cli.flags.has('check')) {
      const count = checkPromptDoc({ suiteFile });
      console.log('PASS  Prompts.md contains live bytes for all ' + count + ' prompt constants and ' + DYNAMIC_BUILDERS.length + ' dynamic builders');
    } else {
      throw new Error('Usage: node tools/render-prompts.js --check|--write [--html <file>]');
    }
  } catch (error) {
    console.error('FAIL  ' + (error.stack || error.message || error));
    process.exit(1);
  }
}

module.exports = { DYNAMIC_BUILDERS, END, START, buildGeneratedAppendix, checkPromptDoc, extractBuilderFunction, writePromptDoc };
