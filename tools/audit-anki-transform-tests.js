#!/usr/bin/env node
'use strict';

// Audit only. Synthetic material; no browser, API, dependencies, or production edits.
// Like latte-tests.js, execute the shipped helpers, never a copied implementation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveSuiteFile, countExact, sha256 } = require('./repo-checks');
const root = path.resolve(__dirname, '..');
const file = resolveSuiteFile({ rootDir: root });
const html = fs.readFileSync(file, 'utf8');
const first = 'function ankiParseCards(raw';
const last = 'function AnkiStyleBadges';
assert.equal(countExact(html, first), 1);
assert.equal(countExact(html, last), 1);
const extracted = html.slice(html.indexOf(first), html.indexOf(last));
assert.ok(extracted.includes('function ankiReviewDecisionEvidence('), 'non-vacuous tail anchor');
const names = ['ankiParseCards', 'ankiSourceSnapshot', 'attachCoverageToCards', 'ankiDedupeCards',
  'ankiNormalizeConditionTags', 'lintAnkiCard', 'ankiSelection', 'ankiBatchSummary',
  'ankiNumericTokens', 'ankiNumericAudit', 'ankiPreviewText', 'ankiExportText',
  'parseAnkiClozes', 'ankiCollisionGroups', 'ankiReviewCandidates', 'ankiSetSourceLinks'];
function live(source = extracted) {
  let id = 0;
  return new Function('uid', source + '\nreturn {' + names.join(',') + '};')(() => 'audit-note-' + (++id));
}
const A = live();
const copy = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const tags = 'Nursing::LATTE::Treatments Condition::Demo Tier::1';
const row = (text, extra = '', useTags = tags) => text + '|' + extra + '|' + useTags;
const fact = (id, text, more = {}) => ({ id, text, sourceQuote: text, tier: 1,
  latteBucket: 'Treatments', sources: [{ filename: 'synthetic.txt', location: 'line 1' }], ...more });
const kb = (...facts) => freeze({ conditions: [{ name: 'Demo', aliases: ['DemoAlias'], facts }] });
const base = kb(fact('fact-1', 'In children do not administer 5 mg orally.'),
  fact('fact-2', 'For a different procedure, use 9 mg orally.'),
  fact('fact-3', 'The calibration reference is 5 °C.'),
  fact('fact-4', 'The reference line is 5 cm long.'),
  fact('fact-5', 'For Demo, give the morning dose of 5 mg and the evening dose of 9 mg.'),
  fact('fact-6', 'The example threshold is greater than 5 mg.'),
  fact('fact-7', 'Observe the blue indicator.'),
  fact('fact-8', 'The recorded dose is 5 mg.', { sourceQuote: 'Earlier drafts used 9 mg; the recorded dose is 5 mg.' }),
  fact('fact-9', 'Adults may receive 5 mg orally within 2 hr after the procedure.'),
  fact('fact-10', 'The example dose is 1/2 mg.'));
const traces = [], expectations = [], controls = [];
function check(name, fn) { fn(); controls.push(name); }
function expectation(name, expected, actual, rationale, category, disposition) {
  expectations.push({ name, expected, actual, met: JSON.stringify(expected) === JSON.stringify(actual),
    rationale, category, disposition });
}
function pipeline(name, raw, source = base, ledger = 'fact-1 -> line #1', api = A) {
  // Capture every production stage that may change these note fields or associations.
  const snapshot = api.ankiSourceSnapshot(source);
  const before = JSON.stringify(source);
  const response = freeze({ raw, ledger });
  const parsed = api.ankiParseCards(response.raw, 1, 'hierarchical-v1');
  const stages = [{ stage: 'model response', raw }, { stage: 'parsed', notes: copy(parsed.cards) }];
  const mappingIssues = api.attachCoverageToCards(parsed.cards, [{ chunk: 1, text: ledger }],
    snapshot, [snapshot.facts.map(f => f.id)]);
  stages.push({ stage: 'source links attached', notes: copy(parsed.cards), mappingIssues });
  const deduped = api.ankiDedupeCards(parsed.cards);
  stages.push({ stage: 'deduped', notes: copy(deduped) });
  const normalized = api.ankiNormalizeConditionTags(deduped, snapshot);
  stages.push({ stage: 'condition tags normalized', notes: copy(normalized.cards), outcomes: normalized.outcomes });
  const cards = normalized.cards.map(c => ({ ...c, lint: api.lintAnkiCard(c) }));
  const batch = { snapshot, rawCards: parsed.cards, postDedupeNotes: cards.length };
  const numeric = cards.map(c => api.ankiNumericAudit(c, batch, true));
  stages.push({ stage: 'lint and advisory numeric checks', notes: copy(cards), numeric });
  const previews = cards.map(c => ({ id: c.id, fronts: api.parseAnkiClozes(c.text).indices.map(index => ({
    index, front: api.ankiPreviewText(c.text, index), back: api.ankiPreviewText(c.text, index, true)
  })), extraLiteral: c.extra }));
  const exported = api.ankiExportText(cards, batch, true, 'all', true, false);
  stages.push({ stage: 'preview and export', previews, exported });
  assert.equal(JSON.stringify(source), before, name + ': source cannot be mutated');
  const result = { name, raw, source: copy(snapshot), stages, cards, numeric, exported,
    summary: api.ankiBatchSummary(cards, batch, true), batch };
  traces.push(result);
  return result;
}

const intactText = '[Demo] In children do not administer {{c1::5 mg}} orally.';
const intact = pipeline('supported-negation-population-route', row(intactText));
check('supported Text remains byte-identical at all note stages', () => {
  for (const s of intact.stages.filter(s => s.notes)) assert.equal(s.notes[0].text, intactText);
  assert.equal(intact.cards[0].extra, '');
  assert.equal(intact.summary.kept.length, 1); assert.equal(intact.summary.reviews, 1);
});
const variant = pipeline('harmless-number-unit-formatting', row('[Demo] In children do not administer {{c1::05.00 milligrams}} orally.'));
check('leading zero, decimal zero and written unit variants stay intact and numerically equivalent', () => {
  assert.equal(variant.numeric[0].findings.length, 0);
  assert.ok(variant.exported.includes('05.00 milligrams'));
});
for (const [name, text, linked] of [
  ['changed-number', '[Demo] In children do not administer {{c1::9 mg}} orally.', 'fact-1'],
  ['changed-unit', '[Demo] In children do not administer {{c1::5 mcg}} orally.', 'fact-1'],
  ['number-only-in-another-chunk-fact', '[Demo] In children do not administer {{c1::9 mg}} orally.', 'fact-1']
]) {
  const r = pipeline(name, row(text), base, linked + ' -> line #1');
  check(name + ': numeric discrepancy is advisory, not selection loss', () => {
    assert.equal(r.numeric[0].status, 'Numeric discrepancy');
    assert.equal(r.summary.kept.length, 1); assert.ok(r.exported.includes(text));
  });
}
const quoteOnly = pipeline('quote-only-evidence', row('[Demo] Dose: {{c1::9 mg}}.'), base, 'fact-8 -> line #1');
check('a matching quote does not grant fact-text numeric support', () => {
  assert.equal(quoteOnly.numeric[0].status, 'Source review needed');
  assert.ok(quoteOnly.numeric[0].findings.some(x => x.code === 'quote-only'));
});
const extra = pipeline('unsupported-extra-number', row(intactText, 'Also give 100 mg.'));
check('Extra numeric addition is checked', () => assert.equal(extra.numeric[0].status, 'Numeric discrepancy'));
const hint = pipeline('unsupported-hint-number', row('[Demo] In children do not administer {{c1::5 mg::100 mg}} orally.'));
expectation('unsupported numeric hint is inspected', true,
  hint.numeric[0].findings.some(x => x.code === 'numeric-discrepancy'),
  'The only supplied dose is 5 mg. The front contains the invented hint 100 mg.',
  'unsupported-card-approval', 'deterministic-input-omission');
check('numeric hint is visibly present on review front', () => {
  assert.ok(hint.stages.at(-1).previews[0].fronts[0].front.includes('[100 mg]'));
  assert.equal(hint.numeric[0].status, 'No numeric mismatch detected');
  assert.equal(hint.summary.kept.length, 1);
});

for (const [name, text, linked, rationale] of [
  ['unicode-minus', '[Demo] Calibration: {{c1::−5 °C}}.', 'fact-3',
    'The source says positive 5 °C; U+2212 means negative 5 °C, a different value.'],
  ['unit-superscript', '[Demo] Reference measurement: {{c1::5 cm²}}.', 'fact-4',
    'The source gives a 5 cm length; cm² denotes area, a different dimension.']
]) {
  const r = pipeline(name, row(text), base, linked + ' -> line #1');
  expectation(name + ' must not get a clean value/unit comparison', true, r.numeric[0].findings.length > 0,
    rationale, 'unsupported-card-approval', 'deterministic-tokenizer-defect');
  check(name + ': bad sign/unit survives to export without a numeric warning', () => {
    assert.equal(r.numeric[0].status, 'No numeric mismatch detected');
    assert.equal(r.summary.kept.length, 1); assert.ok(r.exported.includes(text));
  });
}
const multilineRaw = row('[Demo] In children do not\nadminister {{c1::5 mg}} orally.');
const multiline = pipeline('multiline-negation-loss', multilineRaw);
expectation('multiline Text must retain the qualifier or remain visibly invalid', true,
  multiline.cards.some(c => c.text.includes('do not') || c.lint.length > 0),
  'The raw response faithfully contains the source negation and population. Dropping its first physical line reverses the instruction.',
  'silent-content-change', 'deterministic-parser-defect');
check('multiline response silently exports the unqualified positive instruction', () => {
  assert.equal(multiline.cards.length, 1);
  assert.equal(multiline.cards[0].text, 'administer {{c1::5 mg}} orally.');
  assert.equal(multiline.cards[0].needsReview, false); assert.deepEqual(multiline.cards[0].lint, []);
  assert.equal(multiline.summary.coveredCount, 1); assert.equal(multiline.numeric[0].findings.length, 0);
  assert.ok(!multiline.exported.includes('do not'));
});

for (const [name, text, extraText, ledger, rationale] of [
  ['negation-change', '[Demo] In children administer {{c1::5 mg}} orally.', '', 'fact-1 -> line #1',
    'Source expressly forbids administration in this population; the response omits do not.'],
  ['changed-comparator', '[Demo] Threshold: less than {{c1::5 mg}}.', '', 'fact-6 -> line #1',
    'Source says greater than. Occurrence of 5 mg does not preserve comparator direction.'],
  ['existing-irrelevant-reference', '[Demo] In children administer {{c1::9 mg}} orally.', '', 'fact-2 -> line #1',
    'fact-2 is a different procedure and cannot establish this pediatric instruction.'],
  ['swapped-numeric-roles', '[Demo] Morning {{c1::9 mg}}; evening {{c2::5 mg}}.', '', 'fact-5 -> line #1',
    'Source assigns morning 5 mg and evening 9 mg. The values exist but their roles are reversed.'],
  ['unsupported-extra-proposition', '[Demo] Observe {{c1::the blue indicator}}.', 'This always prevents seizures.', 'fact-7 -> line #1',
    'Nothing in the supplied source establishes seizure prevention.'],
  ['unsupported-hint-proposition', '[Demo] Observe {{c1::the blue indicator::prevents seizures}}.', '', 'fact-7 -> line #1',
    'The visible hint invents a preventive relationship absent from the source.'],
  ['changed-modality', '[Demo] Adults must receive {{c1::5 mg}} orally within 2 hr after the procedure.', '', 'fact-9 -> line #1',
    'Source permits may; the response requires must.'],
  ['changed-route', '[Demo] Adults may receive {{c1::5 mg}} intravenously within 2 hr after the procedure.', '', 'fact-9 -> line #1',
    'Source specifies oral administration, not intravenous.'],
  ['changed-population', '[Demo] Children may receive {{c1::5 mg}} orally within 2 hr after the procedure.', '', 'fact-9 -> line #1',
    'Source specifies adults; it supplies no child instruction.'],
  ['changed-time-origin', '[Demo] Adults may receive {{c1::5 mg}} orally within 2 hr before the procedure.', '', 'fact-9 -> line #1',
    'The source interval follows the procedure; the response places it before.']
]) {
  const r = pipeline(name, row(text, extraText), base, ledger);
  expectation(name + ': semantic mismatch would merit source review', true, r.numeric[0].findings.length > 0,
    rationale, 'unsupported-card-approval', 'documented-heuristic-limit');
  check(name + ': numeric occurrence is not semantic validation', () => {
    assert.equal(r.numeric[0].findings.length, 0); assert.equal(r.summary.kept.length, 1);
  });
}
const unknown = pipeline('missing-evidence', row(intactText), base, '');
check('missing mapping is explicitly inconclusive and remains user-selectable', () => {
  assert.equal(unknown.numeric[0].status, 'Not checked');
  assert.equal(unknown.summary.coveredCount, 0); assert.equal(unknown.summary.kept.length, 1);
});
const fraction = pipeline('supported-but-inconclusive-numeric-form', row('[Demo] Example dose: {{c1::1/2 mg}}.'), base, 'fact-10 -> line #1');
check('source-supported unsupported syntax produces review, preserves content and selection', () => {
  assert.equal(fraction.numeric[0].status, 'Source review needed');
  assert.ok(fraction.numeric[0].findings.some(x => x.code === 'unsupported-form'));
  assert.equal(fraction.summary.kept.length, 1); assert.ok(fraction.exported.includes('1/2 mg'));
});
const malformed = ['{{c1::}}', '{{c0::5 mg}}', '{{c1::5 mg}', '{{c1::a {{c2::b}}}}',
  '{{c1::a}} }}', '{{c1::a}} {{c2::b}} {{c3::c}} {{c4::d}}'];
for (const text of malformed) {
  const r = pipeline('malformed-' + text, row(text));
  check('malformed cloze stays visible and excluded: ' + text, () => {
    assert.equal(r.cards.length, 1); assert.ok(r.cards[0].lint.length);
    assert.equal(r.summary.kept.length, 0); assert.equal(r.exported, '');
  });
}
const embeddedPipe = pipeline('embedded-field-delimiter', row('[Demo] Target {{c1::blue|green}}.'));
check('embedded pipe remains visible and blocked', () => {
  assert.equal(embeddedPipe.cards.length, 1); assert.ok(embeddedPipe.cards[0].lint.includes('pipe-format'));
  assert.equal(embeddedPipe.exported, '');
});
const brokenLine = pipeline('missing-delimiters', '[Demo] Observe {{c1::the blue indicator}}.', base, 'fact-7 -> line #1');
expectation('a malformed no-delimiter note must remain available for correction', 1, brokenLine.cards.length,
  'The complete supported note exists in the raw response but violates only the output delimiters. The parser discards it rather than retaining a visibly invalid note.',
  'valid-content-lost', 'deterministic-parser-defect');

const alias = pipeline('condition-alias-normalization', row(intactText, '', tags.replace('Condition::Demo', 'Condition::DemoAlias')));
check('only proven alias tag changes; content and Keep remain intact', () => {
  assert.equal(alias.cards[0].tags, tags); assert.equal(alias.cards[0].text, intactText);
  assert.equal(alias.cards[0].keep, true);
  assert.equal(alias.stages[4].outcomes[0].status, 'repaired');
});
const repeated = pipeline('exact-duplicate-merges-links', [row(intactText), row(intactText)].join('\n'), base,
  'fact-1 -> line #1\nfact-2 -> line #2');
check('exact-only dedupe merges links and correct live counts', () => {
  assert.equal(repeated.stages[1].notes.length, 2); assert.equal(repeated.cards.length, 1);
  assert.deepEqual(repeated.cards[0].factIds, ['fact-1', 'fact-2']);
  assert.equal(repeated.summary.coveredCount, 2); assert.equal(repeated.summary.reviews, 1);
});
const distinctRows = [row('[Demo] Indicator: {{c1::blue}}.'), row('[Demo] Indicator: {{c1::green}}.'),
  row('[Demo] Indicator: {{c1::blue}}.', 'Context differs.'),
  row('[Demo] Indicator: {{c1::blue}}.', '', tags.replace('Tier::1', 'Tier::2')),
  row('[Demo] Indicator: {{c1::Blue}}.'),
  row('[Demo] Indicator: do not choose {{c1::blue}}.')];
const distinct = pipeline('distinct-notes-preserved', distinctRows.join('\n'), base,
  distinctRows.map((_, i) => 'fact-7 -> line #' + (i + 1)).join('\n'));
check('different answers, Extra, tier, case, and negation are never automatically deduped', () => {
  assert.equal(distinct.cards.length, distinctRows.length); assert.equal(distinct.summary.reviews, distinctRows.length);
  const groups = A.ankiCollisionGroups(distinct.cards);
  assert.ok(groups.some(g => g.kind === 'different-answer'));
  assert.equal(A.ankiDedupeCards(distinct.cards).length, distinctRows.length);
});
const nearRows = [row('[Demo] During the stable recovery phase observe the {{c1::blue}} indicator.'),
  row('[Demo] During stable recovery phase observe the {{c1::blue}} indicator.')];
const near = pipeline('similarity-review-only', nearRows.join('\n'), base, 'fact-7 -> line #1\nfact-7 -> line #2');
check('similarity candidates are advisory and preserve both notes', () => {
  assert.ok(A.ankiReviewCandidates(near.cards).length); assert.equal(near.cards.length, 2);
});
check('manual exclusion prevents identical-note merge and is retained', () => {
  const selected = distinct.cards[0], unchecked = { ...selected, id: 'unchecked', keep: false };
  assert.equal(A.ankiDedupeCards([selected, unchecked]).length, 2);
  assert.equal(A.ankiSelection([selected, unchecked]).kept.length, 1);
});

const symbols = pipeline('literal-html-entities-and-quotes', row('[Demo] <b>&lt; & "quoted"</b>: {{c1::blue}}.', '<alert> & "quoted"'));
check('headered export escapes literal text and preserves three pipe fields', () => {
  assert.ok(symbols.exported.includes('&lt;b&gt;&amp;lt; &amp; "quoted"&lt;/b&gt;'));
  assert.ok(symbols.exported.includes('|&lt;alert&gt; &amp; "quoted"|'));
  assert.equal(symbols.exported.split('\n').at(-1).split('|').length, 3);
  assert.ok(symbols.stages.at(-1).previews[0].fronts[0].front.includes('<b>&lt; & "quoted"</b>'));
});
check('plain export preserves literal field bytes and no header', () => {
  assert.equal(A.ankiExportText(symbols.cards, symbols.batch, true, 'all', false, false),
    row(symbols.cards[0].text, symbols.cards[0].extra));
});
const pointerKb = kb(fact('fact-1', base.conditions[0].facts[0].text, { sources: [
  { filename: 'source|demo<&>.txt', location: 'line 1\nsection A' }
] }));
const pointer = pipeline('source-pointer-export', row(intactText, 'Supported context.'), pointerKb);
check('source references are export-only and pointer delimiters are sanitized', () => {
  const out = A.ankiExportText(pointer.cards, pointer.batch, true, 'all', true, true);
  assert.ok(out.includes('Supported context.<br>Source: source / demo&lt;&amp;&gt;.txt, line 1, section A'));
  assert.equal(pointer.cards[0].extra, 'Supported context.');
  assert.equal(out.split('\n').at(-1).split('|').length, 3);
});
check('live selection/export count only kept structurally valid current notes in the chosen tier', () => {
  const cards = [distinct.cards[0], { ...distinct.cards[1], keep: false }, distinct.cards[3], embeddedPipe.cards[0]];
  const all = A.ankiSelection(cards, true, 'all'), tier1 = A.ankiSelection(cards, true, '1');
  assert.equal(all.kept.length, 2); assert.equal(all.reviews, 2); assert.equal(all.invalid, 1);
  assert.equal(tier1.kept.length, 1); assert.equal(tier1.reviews, 1);
  assert.equal(A.ankiBatchSummary([], distinct.batch, true).coveredCount, 0);
  assert.equal(A.ankiBatchSummary(cards, distinct.batch, false).coveredCount, 0);
  assert.equal(A.ankiExportText(cards, distinct.batch, false, 'all', true, false), '');
});
check('numeric results recompute from edited bytes, not cached lint/status', () => {
  const modified = { ...intact.cards[0], text: intactText.replace('5 mg', '17 mg'), lint: [], numericStatus: 'clean' };
  assert.equal(A.ankiNumericAudit(modified, intact.batch, true).status, 'Numeric discrepancy');
  const remapped = A.ankiSetSourceLinks(modified, ['fact-2'], intact.batch.snapshot, '2026-09-18T00:00:00.000Z');
  assert.equal(remapped.sourceLinkEdits.length, 1);
  assert.equal(A.ankiNumericAudit(remapped, intact.batch, true).status, 'Numeric discrepancy');
});

// Mutation sensitivity: change only an in-memory extracted copy. Never write production HTML.
const mutations = [];
function killMutation(name, before, after, predicate) {
  assert.equal(countExact(extracted, before), 1, 'mutation has one exact anchor');
  const mutant = live(extracted.replace(before, after));
  let failure = null;
  try { predicate(mutant); } catch (error) { if (!(error instanceof assert.AssertionError)) throw error; failure = error.message; }
  assert.ok(failure, name + ': mutation must be detected');
  mutations.push({ name, killed: true, failedAssertion: failure });
}
killMutation('bypass numeric occurrence check', 'if(supported.has(token.key))continue;', 'if(true)continue;', mutant => {
  const c = { ...intact.cards[0], text: intactText.replace('5 mg', '17 mg') };
  assert.equal(mutant.ankiNumericAudit(c, intact.batch, true).status, 'Numeric discrepancy', 'unsupported 17 mg must be reported');
});
killMutation('bypass selection structural gate', 'const valid=scoped.filter(c=>!lintAnkiCard(c).length)', 'const valid=scoped', mutant => {
  assert.equal(mutant.ankiSelection(embeddedPipe.cards, true).kept.length, 0, 'a pipe-broken note must not export');
});
killMutation('dedupe by masked front', "String(c.text||''),String(c.extra||'')", "ankiPreviewText(c.text,1),String(c.extra||'')", mutant => {
  assert.equal(mutant.ankiDedupeCards(distinct.cards.slice(0, 2)).length, 2, 'different hidden answers must survive');
});

const failures = expectations.filter(x => !x.met);
assert.equal(failures.filter(x => x.disposition === 'documented-heuristic-limit').length, 10);
assert.equal(failures.filter(x => x.disposition !== 'documented-heuristic-limit').length, 5);
const report = { suite: path.basename(file), suiteSha256: sha256(html), controls: controls.length,
  knownSemanticExpectationFailures: failures, mutations,
  traces: traces.map(({ name, source, stages, summary }) => ({ name, source, stages,
    summary: { keptNotes: summary.kept.length, keptNoteIds: summary.kept.map(c => c.id),
      reviews: summary.reviews, invalid: summary.invalid, manualExcluded: summary.manualExcluded,
      coveredCount: summary.coveredCount, total: summary.total, uncoveredFactIds: summary.uncovered.map(f => f.id) }
  })) };
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else {
  console.log('Shipped helpers: ' + report.suite + ' sha256=' + report.suiteSha256);
  console.log('Control assertions/groups passed: ' + controls.length + '; isolated mutations killed: ' + mutations.length + '/' + mutations.length);
  console.log('Known independent expectation failures: ' + failures.length + ' (5 defect manifestations, 10 documented semantic limits).');
  failures.forEach(x => console.log('  ' + x.disposition + ' | ' + x.name + ' | expected=' + JSON.stringify(x.expected) + ' actual=' + JSON.stringify(x.actual)));
  console.log('Every note-changing stage is retained in --json output; no production file was changed.');
}
if (process.argv.includes('--strict') && failures.length) process.exitCode = 1;
