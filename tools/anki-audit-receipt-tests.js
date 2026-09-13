'use strict';

// Synthetic protocol tests, not a measurement of model accuracy or entailment.
function runAnkiAuditReceiptTests({ S, t, section }) {
  if (section) section('Anki auditable source and note receipts');
  const start = 'function ankiBuildSourceAuditPrompt(group){', end = '// v16.0: audit validity follows';
  const a = S.indexOf(start), b = S.indexOf(end, a + start.length);
  if (a < 0 || b <= a || S.indexOf(start, a + start.length) >= 0) throw new Error('Anki receipt helper extraction anchors moved or became ambiguous');
  const source = S.slice(a, b);
  const H = new Function(source + ';return {ankiBuildSourceAuditPrompt,ankiParseSourceAudit};')();
  const copy = value => JSON.parse(JSON.stringify(value));
  const facts = [
    { id: 'fact-1', text: 'Use a cool container for 7 minutes; heat changes the marker.', inSelectedTier: true },
    { id: 'fact-2', text: 'Report a red marker immediately.', inSelectedTier: true },
    { id: 'fact-3', text: 'A blue marker remains stable.', inSelectedTier: true },
    { id: 'fact-4', text: 'Store the capsule below 5 units.', inSelectedTier: false }
  ];
  const note = (id, changes = {}) => ({ id, text: '[Synthetic] Report {{c1::red}} marker {{c2::immediately}}.', extra: '', keep: true, structurallyValid: true, inSelectedTier: true, eligible: true, factIds: ['fact-2'], reviewTargets: [{ index: 1, front: '[Synthetic] Report [...] marker immediately.', answers: ['red'] }, { index: 2, front: '[Synthetic] Report red marker [...].', answers: ['immediately'] }], ...changes });
  const notes = [
    note('note-1', { text: '[Synthetic] Use a {{c1::cool}} container for {{c2::7 minutes}}.', extra: 'Heat changes the marker.', factIds: ['fact-1'], reviewTargets: [{ index: 1, front: '[Synthetic] Use a [...] container for 7 minutes.', answers: ['cool'] }, { index: 2, front: '[Synthetic] Use a cool container for [...].', answers: ['7 minutes'] }] }),
    note('note-2'),
    note('manual', { keep: false, eligible: false }),
    note('other-tier', { inSelectedTier: false, eligible: false }),
    note('broken', { text: '{{c1::red', structurallyValid: false, eligible: false, reviewTargets: [] })
  ];
  const group = { id: 'synthetic-group', tier: '1', facts, notes, sourceFactIds: ['fact-1', 'fact-2', 'fact-4'], scopeNoteIds: ['note-1', 'note-2'] };
  const evidence = (id, span) => [{ factId: id, sourceSpan: span }];
  const base = {
    factReviews: [
      { factId: 'fact-1', targets: [
        { sourceSpan: 'cool container', status: 'tested', noteRefs: [{ noteId: 'note-1', clozeIndices: [1] }] },
        { sourceSpan: '7 minutes', status: 'tested', noteRefs: [{ noteId: 'note-1', clozeIndices: [2] }] },
        { sourceSpan: 'heat changes the marker', status: 'extra-only', noteRefs: [{ noteId: 'note-1', clozeIndices: [] }] }
      ] },
      { factId: 'fact-2', targets: [{ sourceSpan: 'Report a red marker immediately.', status: 'tested', noteRefs: [{ noteId: 'note-2', clozeIndices: [1, 2] }] }] }
    ],
    noteReviews: [
      { noteId: 'note-1', text: { status: 'supported', evidence: evidence('fact-1', 'Use a cool container for 7 minutes') }, extra: { status: 'supported', evidence: evidence('fact-1', 'heat changes the marker') } },
      { noteId: 'note-2', text: { status: 'supported', evidence: evidence('fact-2', facts[1].text) }, extra: { status: 'empty', evidence: [] } }
    ],
    findings: []
  };
  const finding = (code, factIds = [], noteIds = [], suggestion = '') => ({ code, factIds, noteIds, message: 'Synthetic source discrepancy.', suggestion });
  const parse = (value, packet = group) => H.ankiParseSourceAudit(JSON.stringify(value), packet);
  const throws = fn => { try { fn(); return false; } catch (_) { return true; } };
  const reject = (label, mutate) => { const value = copy(base); mutate(value); t('audit receipts reject ' + label, throws(() => parse(value))); };
  const before = JSON.stringify(group), good = parse(base);
  t('complete receipts preserve separate target, Text, Extra and finding arrays', good.factReviews.length === 2 && good.factReviews[0].targets.length === 3 && good.noteReviews.length === 2 && good.findings.length === 0);
  t('audit receipt validation does not edit input cards, selection or supplied sources', JSON.stringify(group) === before);
  t('supported Extra is retained while genuinely empty Extra has an explicit receipt', good.noteReviews[0].extra.evidence[0].sourceSpan === 'heat changes the marker' && good.noteReviews[1].extra.status === 'empty');
  t('one optional JSON fence retains full receipts', H.ankiParseSourceAudit('```json\n' + JSON.stringify(base) + '\n```', group).factReviews.length === 2);
  t('findings-only success can no longer certify completed receipt coverage', throws(() => H.ankiParseSourceAudit('{"findings":[]}', group)));
  reject('a missing fact review array', value => { delete value.factReviews; });
  reject('a missing selected-primary-fact receipt', value => { value.factReviews.pop(); });
  reject('a missing scoped-note receipt', value => { value.noteReviews.pop(); });
  reject('duplicate fact receipts in place of a missing fact', value => { value.factReviews[1] = copy(value.factReviews[0]); });
  reject('duplicate note receipts in place of a missing note', value => { value.noteReviews[1] = copy(value.noteReviews[0]); });
  reject('coverage receipts for support-only facts', value => { value.factReviews[1].factId = 'fact-3'; });
  reject('coverage receipts for unselected primary facts', value => { value.factReviews[1].factId = 'fact-4'; });
  reject('an empty substantive-target inventory', value => { value.factReviews[0].targets = []; });
  reject('an invented target status', value => { value.factReviews[0].targets[0].status = 'passed'; });
  reject('source target paraphrases presented as exact spans', value => { value.factReviews[0].targets[0].sourceSpan = 'cold container'; });
  reject('duplicate source spans disguised as extra reviewed targets', value => { value.factReviews[0].targets.push(copy(value.factReviews[0].targets[0])); });
  reject('unknown target notes', value => { value.factReviews[0].targets[0].noteRefs[0].noteId = 'invented'; });
  reject('unknown target cloze indices', value => { value.factReviews[0].targets[0].noteRefs[0].clozeIndices = [3]; });
  reject('string cloze indices', value => { value.factReviews[0].targets[0].noteRefs[0].clozeIndices = ['1']; });
  reject('duplicate cloze indices', value => { value.factReviews[0].targets[0].noteRefs[0].clozeIndices = [1, 1]; });
  reject('tested targets without a cloze ID', value => { value.factReviews[0].targets[0].noteRefs[0].clozeIndices = []; });
  reject('visible-only targets claiming hidden cloze IDs', value => { value.factReviews[0].targets[0].status = 'visible-only'; });
  reject('Extra-only coverage from an empty Extra field', value => { value.factReviews[0].targets[2].noteRefs[0].noteId = 'note-2'; });
  reject('manual exclusions counted as active tested coverage', value => { value.factReviews[1].targets[0].noteRefs[0].noteId = 'manual'; });
  reject('out-of-tier notes counted as active tested coverage', value => { value.factReviews[1].targets[0].noteRefs[0].noteId = 'other-tier'; });
  reject('an unscoped note review', value => { value.noteReviews[1].noteId = 'manual'; });
  reject('unknown evidence facts', value => { value.noteReviews[0].text.evidence[0].factId = 'fact-999'; });
  reject('note text misrepresented as source evidence', value => { value.noteReviews[0].text.evidence[0].sourceSpan = notes[0].text; });
  reject('duplicate evidence citations', value => { value.noteReviews[0].text.evidence.push(copy(value.noteReviews[0].text.evidence[0])); });
  reject('a supported field without source evidence', value => { value.noteReviews[0].text.evidence = []; });
  reject('nonempty Extra described as empty', value => { value.noteReviews[0].extra = { status: 'empty', evidence: [] }; });
  reject('empty Extra carrying invented support', value => { value.noteReviews[1].extra = copy(value.noteReviews[0].extra); });
  reject('Text using the empty-Extra status', value => { value.noteReviews[0].text = { status: 'empty', evidence: [] }; });
  reject('unsupported field verdicts without a matching finding', value => { value.noteReviews[0].extra = { status: 'unsupported', evidence: [] }; });
  reject('changed-meaning field verdicts without their source evidence', value => { value.noteReviews[0].text = { status: 'changed-meaning', evidence: [] }; value.findings = [finding('changed-meaning', ['fact-1'], ['note-1'])]; });
  const unsupported = copy(base); unsupported.noteReviews[0].extra = { status: 'unsupported', evidence: [] }; unsupported.findings = [finding('unsupported', [], ['note-1'])];
  t('unsupported additions need no fabricated source span when an advisory finding identifies them', parse(unsupported).noteReviews[0].extra.evidence.length === 0 && parse(unsupported).findings[0].code === 'unsupported');
  const changed = copy(base); changed.noteReviews[0].text.status = 'changed-meaning'; changed.findings = [finding('changed-meaning', ['fact-1'], ['note-1'], '  Retain the supplied qualifier.  ')];
  t('changed-meaning receipts retain source spans and trimmed advisory suggestions', parse(changed).noteReviews[0].text.evidence.length === 1 && parse(changed).findings[0].suggestion === 'Retain the supplied qualifier.');
  const visible = copy(base); visible.factReviews[0].targets[0].status = 'visible-only'; visible.factReviews[0].targets[0].noteRefs[0].clozeIndices = [];
  t('visible-only coverage is recorded separately from an actual hidden target', parse(visible).factReviews[0].targets[0].status === 'visible-only');
  const missing = copy(base); missing.factReviews[0].targets[0] = { sourceSpan: 'cool container', status: 'missing', noteRefs: [] };
  t('a missing target receipt cannot suppress the corresponding finding', throws(() => parse(missing)));
  missing.findings = [finding('missing-target', ['fact-1'])];
  t('missing targets remain inspectable advisory findings with no invented note IDs', parse(missing).factReviews[0].targets[0].noteRefs.length === 0);
  const excludedPacket = { ...group, sourceFactIds: ['fact-2'], scopeNoteIds: [] };
  const excluded = { factReviews: [{ factId: 'fact-2', targets: [{ sourceSpan: facts[1].text, status: 'manual-excluded', noteRefs: [{ noteId: 'manual', clozeIndices: [1] }] }] }], noteReviews: [], findings: [] };
  t('manual exclusions receive explicit receipts without forcing restoration or a missing-content finding', parse(excluded, excludedPacket).findings.length === 0);
  const outside = copy(excluded); outside.factReviews[0].targets[0].status = 'out-of-tier'; outside.factReviews[0].targets[0].noteRefs[0].noteId = 'other-tier';
  t('out-of-tier coverage remains distinct from active export coverage', parse(outside, excludedPacket).factReviews[0].targets[0].status === 'out-of-tier');
  const broken = copy(excluded); broken.factReviews[0].targets[0].status = 'invalid-note'; broken.factReviews[0].targets[0].noteRefs = [{ noteId: 'broken', clozeIndices: [] }];
  t('structurally invalid generated content can be reported without pretending it was absent', parse(broken, excludedPacket).factReviews[0].targets[0].status === 'invalid-note');
  const conflict = copy(base); conflict.factReviews[0].targets[0].status = 'source-conflict'; conflict.factReviews[0].targets[0].noteRefs = [{ noteId: 'manual', clozeIndices: [1] }]; conflict.noteReviews[0].text.status = 'source-conflict'; conflict.findings = [finding('source-conflict', ['fact-1'])];
  t('source conflicts may cite contextual notes and retain an empty correction suggestion', parse(conflict).factReviews[0].targets[0].noteRefs[0].noteId === 'manual' && parse(conflict).findings[0].suggestion === '');
  conflict.findings[0].suggestion = 'Choose one clinical answer.';
  t('source conflicts cannot silently supply an adjudicated clinical correction', throws(() => parse(conflict)));
  const noScope = { facts: [], notes: [], sourceFactIds: [], scopeNoteIds: [] };
  t('genuinely empty groups accept three empty arrays', parse({ factReviews: [], noteReviews: [], findings: [] }, noScope).noteReviews.length === 0);
  const support = copy(base); support.factReviews = []; const supportPacket = { ...group, sourceFactIds: [] };
  t('support-only groups still require note reviews but no new primary-fact obligations', parse(support, supportPacket).factReviews.length === 0 && parse(support, supportPacket).noteReviews.length === 2);
  const prompt = H.ankiBuildSourceAuditPrompt(group);
  t('receipt prompt distinguishes tested targets, context, Extra, exclusions and source conflicts', ['tested', 'visible-only', 'extra-only', 'manual-excluded', 'out-of-tier', 'invalid-note', 'source-conflict'].every(status => prompt.includes(status)) && prompt.includes('noteRefs') && prompt.includes('clozeIndices'));
  t('receipt prompt requires exact supplied-fact evidence and preserves the no-certification boundary', prompt.includes('Evidence spans come only from the supplied fact.text') && prompt.includes('do not certify clinical correctness') && prompt.endsWith(JSON.stringify(group)));
  t('receipt extraction reaches returned note evidence and the complete findings parser tail', source.includes('return {factReviews:parsed.factReviews,noteReviews:parsed.noteReviews,findings:parsed.findings.map') && parse(changed).findings[0].message === 'Synthetic source discrepancy.');
}

module.exports = { runAnkiAuditReceiptTests };
