'use strict';

// Offline checks of captured evidence, source-link edits and asynchronous hash
// boundaries. Fixtures are synthetic; passing hashes do not certify content.
async function runAnkiReviewEvidenceTests({ S, t, section }) {
  if (section) section('Anki source-link edits and review evidence');
  const { createHash, webcrypto } = require('crypto');
  const start = 'function ankiParseCards(raw', end = 'function AnkiStyleBadges';
  const a = S.indexOf(start), b = S.indexOf(end, a + start.length);
  if (a < 0 || b <= a || S.indexOf(start, a + start.length) >= 0) throw new Error('Anki evidence helper extraction anchors moved or became ambiguous');
  const helperSource = S.slice(a, b);
  const load = crypto => new Function('uid', 'globalThis', 'TextEncoder', helperSource + ';return {ankiSourceLinkStatus,ankiSetSourceLinks,ankiSha256,ankiSourceAuditLabel,ankiSourceAuditEvidence,ankiSourceSnapshot,ankiAuditGroups};')(() => 'synthetic', { crypto }, TextEncoder);
  const H = load(webcrypto), sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
  const throws = fn => { try { fn(); return false; } catch (_) { return true; } };
  const snapshot = H.ankiSourceSnapshot({ conditions: [{ name: 'Synthetic container', aliases: ['Synthetic alias'], facts: [
    { id: 'fact-1', text: 'Use a cool container.', tier: 1, latteBucket: 'Treatments', sourceQuote: 'QUOTE_ONLY_SENTINEL', subtype: 'independent' },
    { id: 'fact-2', text: 'Check the marker after 7 minutes.', tier: 1, latteBucket: 'Assess', subtype: 'independent' }
  ] }] });
  const card = { id: 'note-1', chunk: 1, sourceLine: 1, text: '[Synthetic] Container: {{c1::cool}}.', extra: '', tags: 'Tier::1', keep: false, pipeCount: 2, factIds: ['fact-1'], mappingIssues: [] };
  t('source-link status distinguishes no mapping from grounded associations', H.ankiSourceLinkStatus({ ...card, factIds: [] }, snapshot).code === 'unmapped' && H.ankiSourceLinkStatus(card, snapshot).code === 'linked');
  t('source-link status surfaces partial unknown references and mapping diagnostics', H.ankiSourceLinkStatus({ ...card, factIds: ['fact-1', 'fact-999'] }, snapshot).code === 'mapping-review' && H.ankiSourceLinkStatus({ ...card, mappingIssues: [{ code: 'duplicate-edge' }] }, snapshot).code === 'mapping-review');
  t('entirely unavailable source references remain visibly unmapped', H.ankiSourceLinkStatus({ ...card, factIds: ['fact-999'] }, snapshot).code === 'unmapped');
  const before = JSON.stringify(card), suppliedIds = ['fact-1', 'fact-2'], changed = H.ankiSetSourceLinks(card, suppliedIds, snapshot, '2026-01-01T00:00:00Z');
  t('source-link edits create a new note without changing the original', changed !== card && JSON.stringify(card) === before && changed.factIds.join(',') === 'fact-1,fact-2');
  t('source-link edits preserve Text, Extra, Tags and manual keep choice', changed.text === card.text && changed.extra === card.extra && changed.tags === card.tags && changed.keep === false);
  t('source-link history records exact before, after and edit time', changed.sourceLinkEdits.length === 1 && changed.sourceLinkEdits[0].at === '2026-01-01T00:00:00Z' && changed.sourceLinkEdits[0].before.join(',') === 'fact-1' && changed.sourceLinkEdits[0].after.join(',') === 'fact-1,fact-2');
  suppliedIds.push('fact-999');
  t('caller changes cannot mutate applied links or the recorded history', changed.factIds.length === 2 && changed.sourceLinkEdits[0].after.length === 2);
  t('unchanged confirmed links are a true no-op', H.ankiSetSourceLinks(card, ['fact-1'], snapshot) === card);
  {
    const callbackStart=S.indexOf('  const updateSourceLinks=(id,ids)=>{'),callbackEnd=S.indexOf('\n  // Build optional focus context block',callbackStart);
    if(callbackStart<0||callbackEnd<callbackStart)throw Error('Source-link UI callback anchor moved');
    const sourceKB={},uiBatch={sourceKB,snapshot};let rows=[card],writes=0;
    const apply=new Function('current','busy','batch','currentKB','cards','ankiSetSourceLinks','setCards',S.slice(callbackStart,callbackEnd)+';return updateSourceLinks;')(true,false,uiBatch,{current:sourceKB},rows,H.ankiSetSourceLinks,fn=>{writes++;rows=fn(rows);});
    const originalRows=rows;apply(card.id,['fact-1']);
    t('applying unchanged clean source links preserves the checked card-array identity',writes===0&&rows===originalRows);
    apply(card.id,['fact-1','fact-2']);
    t('applying a changed source link replaces the card array and records the edit',writes===1&&rows!==originalRows&&rows[0].factIds.length===2&&rows[0].sourceLinkEdits.length===1);
  }
  const unresolved = { ...card, mappingIssues: [{ code: 'unknown-id', id: 'fact-999', chunk: 1, line: 1 }], unresolvedFactIds: ['fact-999'] };
  const confirmed = H.ankiSetSourceLinks(unresolved, ['fact-1'], snapshot, '2026-01-02T00:00:00Z');
  t('confirming valid links clears current diagnostics but records the prior issues', confirmed !== unresolved && confirmed.mappingIssues.length === 0 && confirmed.unresolvedFactIds.length === 0 && confirmed.sourceLinkEdits[0].previousIssues[0].code === 'unknown-id' && unresolved.mappingIssues.length === 1);
  confirmed.sourceLinkEdits[0].previousIssues[0].code = 'changed-in-copy';
  t('new diagnostic history objects do not alias the original issues', unresolved.mappingIssues[0].code === 'unknown-id');
  const removed = H.ankiSetSourceLinks(changed, [], snapshot, '2026-01-03T00:00:00Z');
  t('clearing links is an explicit recorded edit that retains earlier history', removed.factIds.length === 0 && removed.sourceLinkEdits.length === 2 && changed.sourceLinkEdits.length === 1 && H.ankiSourceLinkStatus(removed, snapshot).code === 'unmapped');
  for (const ids of [['fact-999'], ['fact-1', 'fact-1'], [1], 'fact-1', null]) t('source-link edits reject invalid ID input ' + JSON.stringify(ids), throws(() => H.ankiSetSourceLinks(card, ids, snapshot)));
  t('local SHA-256 matches the standard UTF-8 abc test vector', await H.ankiSha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  t('local SHA-256 encodes non-ASCII source text as UTF-8', await H.ankiSha256('Synthetic Δ 37°C') === sha('Synthetic Δ 37°C'));
  t('missing Web Crypto produces explicit unavailable hashes', await load(undefined).ankiSha256('abc') === null);
  t('a rejected digest produces unavailable hashes without discarding evidence', await load({ subtle: { digest: async () => { throw Error('Synthetic digest failure'); } } }).ankiSha256('abc') === null);

  const { validReceipt } = require('./fixtures/anki-audit-response');
  const cards = [{ ...card, keep: true, sourceLinkEdits: changed.sourceLinkEdits, conditionTagNormalization: { originalTags: 'Condition::SyntheticAlias Tier::1', normalizedTags: 'Condition::SyntheticContainer Tier::1', reason: 'Supplied alias.' }, unrelatedRuntimeValue: 'CARD_RUNTIME_SENTINEL' }];
  const batch = { snapshot, chunkIds: [['fact-1', 'fact-2']], model: 'synthetic-generator', thinkingLevel: 'low', startedAt: '2026-01-01T01:00:00Z', completedAt: '2026-01-01T01:01:00Z', context: { outcomes: 'Synthetic outcome', points: 'Synthetic point', focusContext: 'Synthetic context', apiKey: 'CONTEXT_CREDENTIAL_SENTINEL' }, promptHashes: { masterRuntimeSha256: sha('synthetic master'), adapterRuntimeSha256: sha('synthetic adapter') }, apiKey: 'BATCH_CREDENTIAL_SENTINEL' };
  const groups = H.ankiAuditGroups(cards, batch, 'all');
  const results = groups.map(group => ({ groupId: group.id, ...validReceipt(group) }));
  const responses = groups.map(group => ({ groupId: group.id, raw: JSON.stringify(validReceipt(group)), usage: { promptTokenCount: 10, candidatesTokenCount: 5 }, truncated: false }));
  const run = { cards, batch, groups, results, responses, model: 'synthetic-auditor', thinkingLevel: 'medium', tier: 'all', status: 'complete', message: '', preparedAt: '2026-01-01T02:00:00Z', startedAt: '2026-01-01T02:01:00Z', finishedAt: '2026-01-01T02:02:00Z', builderSource: 'function syntheticAuditBuilder(){return "receipt contract";}', apiKey: 'RUN_CREDENTIAL_SENTINEL', ctl: new AbortController() };
  const inputs = { current: true, cards, batch, tier: 'all' }, exportedAt = '2026-01-01T03:00:00Z';
  const evidence = await H.ankiSourceAuditEvidence(run, inputs, exportedAt);
  t('complete current evidence has an explicit schema, timestamps and truthful completed counts', evidence.metadata.schemaVersion === 4 && evidence.metadata.suiteVersion === '17.5' && evidence.metadata.exportedAt === exportedAt && evidence.metadata.preparedAt === run.preparedAt && evidence.metadata.finishedAt === run.finishedAt && evidence.metadata.checkComplete && evidence.metadata.checkedGroups === groups.length && evidence.metadata.totalGroups === groups.length);
  t('generation and auditor identities and thinking levels remain separate', evidence.metadata.generation.model === 'synthetic-generator' && evidence.metadata.generation.thinkingLevel === 'low' && evidence.metadata.audit.model === 'synthetic-auditor' && evidence.metadata.audit.thinkingLevel === 'medium');
  t('audit builder hash identifies the captured builder bytes', evidence.metadata.audit.builderSha256 === sha(run.builderSource));
  t('evidence retains grouped receipt results, raw replies and explicit user edit history', evidence.results[0].factReviews.length > 0 && evidence.results[0].noteReviews.length === 1 && evidence.responses[0].raw === responses[0].raw && evidence.noteEdits[0].sourceLinkEdits.length === 1 && evidence.noteEdits[0].conditionTagNormalization.originalTags.includes('SyntheticAlias'));
  t('evidence includes mapping diagnostics without replacing original study content', evidence.mappingDiagnostics.length === 1 && evidence.mappingDiagnostics[0].noteId === 'note-1' && evidence.mappingDiagnostics[0].factIds[0] === 'fact-1' && evidence.groups[0].notes[0].text === card.text);
  t('evidence whitelists generation context and omits runtime credentials and source quotes', Object.keys(evidence.metadata.generation.context).sort().join(',') === 'focusContext,outcomes,points' && !/CREDENTIAL_SENTINEL|CARD_RUNTIME_SENTINEL|QUOTE_ONLY_SENTINEL/.test(JSON.stringify(evidence)) && !Object.hasOwn(evidence, 'ctl'));
  t('evidence distinguishes snapshot fingerprints from uploaded KB file hashes', evidence.metadata.hashesAvailable && /^[a-f0-9]{64}$/.test(evidence.metadata.sourceSnapshotSha256) && /^[a-f0-9]{64}$/.test(evidence.metadata.cardSnapshotSha256) && evidence.metadata.hashEncoding.includes('not the uploaded KB file bytes'));
  const again = await H.ankiSourceAuditEvidence(run, inputs, exportedAt);
  t('identical captured content produces repeatable source and card hashes', again.metadata.sourceSnapshotSha256 === evidence.metadata.sourceSnapshotSha256 && again.metadata.cardSnapshotSha256 === evidence.metadata.cardSnapshotSha256);
  const editedCards = cards.map(c => ({ ...c, extra: 'Edited synthetic context.' })), editedRun = { ...run, cards: editedCards };
  const cardEditEvidence = await H.ankiSourceAuditEvidence(editedRun, { ...inputs, cards: editedCards }, exportedAt);
  t('a note edit changes the card hash while retaining the same source fingerprint', cardEditEvidence.metadata.cardSnapshotSha256 !== evidence.metadata.cardSnapshotSha256 && cardEditEvidence.metadata.sourceSnapshotSha256 === evidence.metadata.sourceSnapshotSha256);
  const changedSnapshot = { ...snapshot, facts: snapshot.facts.map((f, i) => i ? f : { ...f, aliases: ['Changed synthetic alias'] }) }, changedBatch = { ...batch, snapshot: changedSnapshot };
  const sourceEditEvidence = await H.ankiSourceAuditEvidence({ ...run, batch: changedBatch }, { ...inputs, batch: changedBatch }, exportedAt);
  t('source context changes alter its fingerprint even when the card text is unchanged', sourceEditEvidence.metadata.sourceSnapshotSha256 !== evidence.metadata.sourceSnapshotSha256 && sourceEditEvidence.metadata.cardSnapshotSha256 === evidence.metadata.cardSnapshotSha256);
  const unavailable = await load(undefined).ankiSourceAuditEvidence(run, inputs, exportedAt);
  t('unavailable crypto retains raw evidence with null hashes and availability metadata', !unavailable.metadata.hashesAvailable && unavailable.metadata.sourceSnapshotSha256 === null && unavailable.metadata.cardSnapshotSha256 === null && unavailable.metadata.audit.builderSha256 === null && unavailable.responses.length === responses.length);
  t('completed source checks use report filenames', evidence.filename === 'anki-source-report-complete.json');
  const prepared = await H.ankiSourceAuditEvidence({ ...run, status: 'prepared', results: [], responses: [], startedAt: null, finishedAt: null }, inputs, exportedAt);
  t('prepared packets are never named or marked as completed checks', prepared.filename === 'anki-source-packet-prepared.json' && !prepared.metadata.checkComplete && prepared.metadata.checkedGroups === 0 && prepared.responses.length === 0);
  const partial = await H.ankiSourceAuditEvidence({ ...run, status: 'complete', results: [] }, inputs, exportedAt);
  t('a complete status without all group results remains incomplete evidence', !partial.metadata.checkComplete && partial.filename === 'anki-source-incomplete-complete.json');
  for (const status of ['running', 'failed', 'cancelled', 'interrupted']) {
    const item = await H.ankiSourceAuditEvidence({ ...run, status }, inputs, exportedAt);
    t(status + ' evidence preserves completed groups without claiming full completion', !item.metadata.checkComplete && item.filename === 'anki-source-incomplete-' + status + '.json' && item.results.length === results.length);
  }
  const stale = await H.ankiSourceAuditEvidence(run, { ...inputs, cards: [...cards] }, exportedAt);
  t('stale notes force outdated incomplete evidence while preserving original run status', stale.status === 'outdated' && stale.runStatus === 'complete' && !stale.metadata.currentAtExport && !stale.metadata.checkComplete && stale.filename === 'anki-source-incomplete-outdated.json');
  const tierChanged = await H.ankiSourceAuditEvidence(run, { ...inputs, tier: '1' }, exportedAt);
  t('a changed export tier invalidates the source-check completeness claim', tierChanged.status === 'outdated' && !tierChanged.metadata.checkComplete);
  const pending = [], deferred = load({ subtle: { digest(algorithm, bytes) { return new Promise(resolve => pending.push({ algorithm, bytes, resolve })); } } });
  let latestInputs = inputs, reads = 0;
  const inFlight = deferred.ankiSourceAuditEvidence(run, () => { reads++; return latestInputs; }, exportedAt);
  t('evidence hashes captured source, cards and builder before checking export currency', pending.length === 3 && reads === 0);
  latestInputs = { ...inputs, batch: { ...batch } };
  await Promise.all(pending.map(async item => item.resolve(await webcrypto.subtle.digest(item.algorithm, item.bytes))));
  const delayed = await inFlight;
  t('source changes while hashes await cannot publish a current complete report', reads === 1 && delayed.status === 'outdated' && !delayed.metadata.checkComplete && delayed.metadata.cardSnapshotSha256 === evidence.metadata.cardSnapshotSha256);
  t('status labels distinguish prepared from checked, incomplete and outdated records', H.ankiSourceAuditLabel(null) === 'No source check prepared' && H.ankiSourceAuditLabel({ ...run, status: 'prepared', results: [] }).includes('no AI check yet') && H.ankiSourceAuditLabel({ ...run, status: 'failed' }).includes('incomplete') && H.ankiSourceAuditLabel(run, false).startsWith('Outdated — '));
  const empty = { ...run, cards: [], groups: [], results: [], responses: [] }, emptyEvidence = await H.ankiSourceAuditEvidence(empty, { ...inputs, cards: empty.cards }, exportedAt);
  t('an explicitly completed empty audit has consistent zero-group evidence', emptyEvidence.metadata.checkComplete && emptyEvidence.metadata.checkedGroups === 0 && emptyEvidence.metadata.totalGroups === 0);
  // These assertions establish the shipped adapter contract, not model adherence.
  const adapterStart = 'const kbAdapter=`', adapterA = S.indexOf(adapterStart), adapterB = S.indexOf('\n`;', adapterA + adapterStart.length);
  if (adapterA < 0 || adapterB <= adapterA || S.indexOf(adapterStart, adapterA + adapterStart.length) >= 0) throw new Error('Anki runtime-adapter extraction anchor moved or became ambiguous');
  const adapter = S.slice(adapterA, adapterB);
  t('live adapter keeps Extra source-only and forbids moving unsupported claims into Text', adapter.includes('Keep Extra empty unless the supplied FACT text explicitly gives a useful supporting explanation or contrast.') && adapter.includes('Do not add cue captions or move unsupported claims into Text.'));
  t('live adapter does not turn undefined source labels into invented definition cards', adapter.includes('A term listed without a definition must not become a definition card unless this input actually defines it') && adapter.includes('do not supply missing mechanisms, frequency rankings, severity labels, or durations from memory'));
  t('live adapter preserves population, certainty and distinct action or eligibility relationships', adapter.includes("preserve each fact's independent population, trigger, action, timing and certainty (may, often, as prescribed, if indicated)") && adapter.includes('AND/OR, preparation versus administration, or distinct eligibility criteria'));
  t('live adapter requires recall of substantive list members without splitting equivalent units or inseparable decisions', adapter.includes('Never leave a substantive list member permanently visible merely to satisfy a cloze limit.') && adapter.includes('Test that target elsewhere when needed, preserving equivalent units and inseparable clinical decisions.') && S.includes('ANKI_MASTER_PROMPT+focusBlock+kbAdapter'));
  t('helper extraction reaches the live currency predicate and evidence filename tail', helperSource.includes("filename:'anki-source-'") && (await H.ankiSourceAuditEvidence(run, { ...inputs, current: false }, exportedAt)).status === 'outdated');
  // v17.0: v16.7 remediated data-integrity finding SUGGESTION by renaming this label from
  // "Suggested correction:", which implied the checker had already rewritten the note. Only an
  // optional browser runner covered the wording, so it drifted for two releases with the
  // verifier green. The remediated meaning is a trust contract, so the mandatory gate now owns
  // it: the label must state the edit is unapplied, and the pre-remediation wording must be gone.
  t('a checker suggestion is labelled as an unapplied proposal, not an applied correction',
    S.includes('<strong>Proposed edit to review — not applied:</strong> {f.suggestion}') && !S.includes('Suggested correction:'));
}

module.exports = { runAnkiReviewEvidenceTests };
