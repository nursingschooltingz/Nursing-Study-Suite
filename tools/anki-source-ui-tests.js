'use strict';

const {validReceipt}=require('./fixtures/anki-audit-response');

// Execute the shipped source-check callbacks with captured component state and a
// deferred transport. This checks lifecycle behavior without React, DOM or network.
async function runAnkiSourceUiTests({ S, t, section }) {
  if (section) section('Anki source-check UI lifecycle');
  const span = (start, end, includeEnd = false) => {
    const a = S.indexOf(start), b = S.indexOf(end, a + start.length);
    if (a < 0 || b < 0 || S.indexOf(start, a + start.length) >= 0) throw new Error('Anki UI extraction anchor moved or became ambiguous: ' + start);
    return S.slice(a, includeEnd ? b + end.length : b);
  };
  const helpers = span('function ankiParseCards(raw', 'function AnkiStyleBadges');
  const H = new Function('uid', helpers + ';return {ankiSourceAuditCurrent,ankiAuditGroups,ankiBuildSourceAuditPrompt,ankiParseSourceAudit};')(() => 'synthetic-id');
  const callbacks = span('  const prepareSourceAudit=()=>{', '  const openNote=');
  const invalidation = span('  useEffect(()=>{\n    const run=auditRun.current;', '  },[cards,batch,tierFilter,current]);', true);
  const cleanup = '  useEffect(()=>()=>{auditRun.current?.ctl.abort();auditRun.current=null;},[]);';
  if (S.split(cleanup).length !== 2) throw new Error('Anki source-check unmount extraction anchor moved');
  const capture = new Function('state', 'services', `
    const {cards,batch,tierFilter,current,busy,auditBusy,sourceAudit,model,toolLevel,auditModel,auditLevel,cfg}=state;
    const {auditRun,auditInputs,setSourceAudit,setAuditBusy,callGemini,ankiSourceAuditCurrent,ankiAuditGroups,ankiBuildSourceAuditPrompt,ankiParseSourceAudit}=services;
    const effects=[];const useEffect=fn=>effects.push(fn);
    ${callbacks}
    ${invalidation}
    ${cleanup}
    return {prepareSourceAudit,runSourceAudit,cancelSourceAudit,invalidate:effects[0],unmount:effects[1]()};
  `);
  const credential = 'SYNTHETIC_SOURCE_CHECK_TEST_CREDENTIAL';
  const create = (transport, changes = {}) => {
    const facts = [1, 2].map(n => ({ id: 'fact-' + n, text: 'Synthetic target ' + n + '.', tier: 1, bucket: 'Treatments', condition: 'Synthetic condition', aliases: [], subtype: 'independent', sourceQuote: 'QUOTE_NOT_GENERATION_INPUT' }));
    const cards = [1, 2].map(n => ({ id: 'note-' + n, chunk: n, sourceLine: 1, text: '[Synthetic] Action: {{c1::target ' + n + '}}.', extra: '', tags: 'Tier::1', keep: n === 1, pipeCount: 2, factIds: ['fact-' + n] }));
    const state = { cards, batch: { snapshot: { facts }, chunkIds: [['fact-1'], ['fact-2']] }, tierFilter: 'all', current: true, busy: false, auditBusy: false, sourceAudit: null, model: 'synthetic-model', toolLevel: 'low', auditModel: 'synthetic-audit-model', auditLevel: 'medium', cfg: { apiKey: credential }, ...changes };
    const auditRun = { current: null }, auditInputs = { current: null }, calls = [], publications = [];
    const services = {
      ...H, auditRun, auditInputs,
      setSourceAudit(value) { state.sourceAudit = typeof value === 'function' ? value(state.sourceAudit) : value; publications.push(state.sourceAudit); },
      setAuditBusy(value) { state.auditBusy = value; },
      callGemini(...args) { calls.push(args); return transport(...args); }
    };
    const render = () => {
      auditInputs.current = { cards: state.cards, batch: state.batch, tier: state.tierFilter, current: state.current };
      return capture(state, services);
    };
    const prepare = () => { render().prepareSourceAudit(); return render(); };
    return { state, calls, publications, auditRun, auditInputs, render, prepare };
  };
  const clean = parts => JSON.stringify(validReceipt(JSON.parse(parts[0].text.split('AUDIT PACKET:')[1])));
  const pending = () => {
    const requests = [];
    const call = (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }));
    return { requests, call };
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));

  const happy = create(async (_key, _model, parts, options) => { options.onMeta({ usage: { totalTokenCount: 11 } }); return clean(parts); });
  const original = JSON.stringify({ cards: happy.state.cards, batch: happy.state.batch });
  happy.render();
  t('rendering source-check callbacks makes no request', happy.calls.length === 0);
  const prepared = happy.prepare();
  t('preparation computes the call count locally without a request', happy.calls.length === 0 && happy.state.sourceAudit.status === 'prepared' && happy.state.sourceAudit.groups.length === 2);
  const preparationTime = happy.state.sourceAudit.preparedAt;
  t('preparation records its timestamp and independent audit choice before any request', Number.isFinite(Date.parse(preparationTime)) && happy.state.sourceAudit.model === 'synthetic-audit-model' && happy.state.sourceAudit.thinkingLevel === 'medium' && !happy.state.sourceAudit.startedAt && !happy.state.sourceAudit.finishedAt);
  happy.state.model = 'new-model-setting'; happy.state.toolLevel = 'medium';
  happy.state.auditModel = 'new-audit-model-setting'; happy.state.auditLevel = 'high';
  await happy.render().runSourceAudit();
  t('explicit Run checks every prepared group with the captured independent audit model and level', happy.calls.length === 2 && happy.calls.every(c => c[1] === 'synthetic-audit-model' && c[3].thinkingLevel === 'medium'));
  t('completed audit retains checked groups, raw responses and usage then clears its running ref', happy.state.sourceAudit.status === 'complete' && happy.state.sourceAudit.results.length === 2 && happy.state.sourceAudit.responses.length === 2 && happy.state.sourceAudit.responses.every(r => r.usage.totalTokenCount === 11) && !happy.auditRun.current && !happy.state.auditBusy);
  t('completed audit retains per-fact and per-note receipts including manual exclusions', happy.state.sourceAudit.results[0].factReviews[0].targets[0].status === 'tested' && happy.state.sourceAudit.results[0].noteReviews[0].extra.status === 'empty' && happy.state.sourceAudit.results[1].factReviews[0].targets[0].status === 'manual-excluded' && happy.state.sourceAudit.results[1].noteReviews.length === 0);
  t('completed audit retains preparation and ordered run timestamps', happy.state.sourceAudit.preparedAt === preparationTime && Number.isFinite(Date.parse(happy.state.sourceAudit.startedAt)) && Number.isFinite(Date.parse(happy.state.sourceAudit.finishedAt)) && Date.parse(preparationTime) <= Date.parse(happy.state.sourceAudit.startedAt) && Date.parse(happy.state.sourceAudit.startedAt) <= Date.parse(happy.state.sourceAudit.finishedAt));
  t('source checks neither rewrite notes nor change manual selection or source data', JSON.stringify({ cards: happy.state.cards, batch: happy.state.batch }) === original);
  t('saved audit state and emitted prompts do not retain API credentials or quote-only evidence', !JSON.stringify(happy.state.sourceAudit).includes(credential) && happy.calls.every(c => !JSON.stringify(c[2]).includes(credential) && !JSON.stringify(c[2]).includes('QUOTE_NOT_GENERATION_INPUT')));
  t('currentness requires the exact source batch, notes array and selected tier', H.ankiSourceAuditCurrent(happy.state.sourceAudit, happy.auditInputs.current) && !H.ankiSourceAuditCurrent(happy.state.sourceAudit, { ...happy.auditInputs.current, cards: [...happy.state.cards] }) && !H.ankiSourceAuditCurrent(happy.state.sourceAudit, { ...happy.auditInputs.current, batch: { ...happy.state.batch } }) && !H.ankiSourceAuditCurrent(happy.state.sourceAudit, { ...happy.auditInputs.current, tier: '1' }));

  const stalePrepared = create(async (_key, _model, parts) => clean(parts)); stalePrepared.prepare(); stalePrepared.state.cards = [...stalePrepared.state.cards];
  await stalePrepared.render().runSourceAudit();
  t('a stale prepared selection cannot initiate a request', stalePrepared.calls.length === 0 && !stalePrepared.state.auditBusy);
  const noKey = create(async (_key, _model, parts) => clean(parts), { cfg: { apiKey: '' } });
  await noKey.prepare().runSourceAudit();
  t('a missing key prevents requests and leaves a useful prepared-state message', noKey.calls.length === 0 && noKey.state.sourceAudit.status === 'prepared' && /API key/.test(noKey.state.sourceAudit.message));
  const busy = create(async (_key, _model, parts) => clean(parts)); busy.prepare(); busy.state.busy = true;
  await busy.render().runSourceAudit();
  t('card generation prevents starting a source check', busy.calls.length === 0);
  const preparingBusy = create(async (_key, _model, parts) => clean(parts), { busy: true }); preparingBusy.render().prepareSourceAudit();
  t('preparation is unavailable while generation is active', !preparingBusy.state.sourceAudit && preparingBusy.calls.length === 0);

  for (const kind of ['notes', 'tier', 'source', 'batch']) {
    const deferred = pending(), run = create(deferred.call), ui = run.prepare();
    const completion = ui.runSourceAudit();
    const signal = deferred.requests[0].args[3].signal;
    if (kind === 'notes') run.state.cards = run.state.cards.map(c => ({ ...c, extra: 'Edited after request.' }));
    if (kind === 'tier') run.state.tierFilter = '1';
    if (kind === 'source') run.state.current = false;
    if (kind === 'batch') run.state.batch = { ...run.state.batch };
    run.render().invalidate();
    const interrupted = run.state.sourceAudit;
    t(kind + ' changes abort the pending source check and mark its captured report interrupted', signal.aborted && interrupted.status === 'interrupted' && !run.auditRun.current && !run.state.auditBusy);
    deferred.requests[0].resolve(clean(deferred.requests[0].args[2])); await completion;
    t('a late response after ' + kind + ' changes cannot publish or start another group', run.state.sourceAudit === interrupted && run.calls.length === 1 && run.state.sourceAudit.results.length === 0);
  }

  const guardDeferred = pending(), guarded = create(guardDeferred.call), guardRun = guarded.prepare().runSourceAudit();
  guarded.state.cards = [...guarded.state.cards]; guarded.render();
  guardDeferred.requests[0].resolve(clean(guardDeferred.requests[0].args[2])); await guardRun;
  t('the post-await identity guard also blocks stale publication before effects run', guarded.state.sourceAudit.status === 'interrupted' && guarded.state.sourceAudit.results.length === 0 && guarded.calls.length === 1 && !guarded.state.auditBusy);

  const cancelDeferred = pending(), cancelled = create(cancelDeferred.call), cancelUi = cancelled.prepare(), cancelRun = cancelUi.runSourceAudit();
  cancelDeferred.requests[0].resolve(clean(cancelDeferred.requests[0].args[2])); await flush();
  t('each finished group publishes evidence before the next request completes', cancelled.state.sourceAudit.results.length === 1 && cancelled.state.sourceAudit.responses.length === 1 && cancelDeferred.requests.length === 2);
  cancelled.render().cancelSourceAudit(); const cancelledReport = cancelled.state.sourceAudit;
  t('Cancel aborts the active request and preserves completed source groups', cancelDeferred.requests[1].args[3].signal.aborted && cancelledReport.status === 'cancelled' && cancelledReport.results.length === 1 && !cancelled.state.auditBusy && !cancelled.auditRun.current);
  cancelDeferred.requests[1].resolve(clean(cancelDeferred.requests[1].args[2])); await cancelRun;
  t('a transport that resolves after cancellation cannot overwrite the cancelled report', cancelled.state.sourceAudit === cancelledReport && cancelled.state.sourceAudit.results.length === 1);

  const unmountDeferred = pending(), unmounted = create(unmountDeferred.call), unmountUi = unmounted.prepare(), unmountRun = unmountUi.runSourceAudit();
  unmountUi.unmount(); const publishedBeforeLate = unmounted.publications.length;
  unmountDeferred.requests[0].resolve(clean(unmountDeferred.requests[0].args[2])); await unmountRun;
  t('unmount aborts the request and prevents all late state publications', unmountDeferred.requests[0].args[3].signal.aborted && !unmounted.auditRun.current && unmounted.publications.length === publishedBeforeLate && unmounted.calls.length === 1);

  let malformedCount = 0;
  const malformed = create(async (_key, _model, parts) => ++malformedCount === 1 ? clean(parts) : 'MALFORMED_SYNTHETIC_RESPONSE');
  await malformed.prepare().runSourceAudit();
  t('malformed audit output retains earlier results and the rejected raw response', malformed.state.sourceAudit.status === 'failed' && malformed.state.sourceAudit.results.length === 1 && malformed.state.sourceAudit.responses.length === 2 && malformed.state.sourceAudit.responses[1].raw === 'MALFORMED_SYNTHETIC_RESPONSE' && !malformed.state.auditBusy);
  const missingReceipts = create(async () => '{"findings":[]}');
  await missingReceipts.prepare().runSourceAudit();
  t('findings-only responses fail rather than counting unreviewed source groups complete', missingReceipts.state.sourceAudit.status === 'failed' && missingReceipts.state.sourceAudit.results.length === 0 && missingReceipts.state.sourceAudit.responses.length === 1 && missingReceipts.state.sourceAudit.responses[0].raw === '{"findings":[]}' && missingReceipts.calls.length === 1 && !missingReceipts.state.auditBusy);
  const truncated = create(async (_key, _model, parts, options) => { options.onMeta({ truncated: true }); return clean(parts); });
  await truncated.prepare().runSourceAudit();
  t('truncated responses remain evidence and never become successful group verdicts', truncated.state.sourceAudit.status === 'failed' && truncated.state.sourceAudit.responses[0].truncated && truncated.state.sourceAudit.results.length === 0 && truncated.calls.length === 1);
  const abortFailure = create(async () => { const e = Error('Synthetic abort'); e.name = 'AbortError'; throw e; });
  await abortFailure.prepare().runSourceAudit();
  t('transport aborts produce cancelled state and release the running lock', abortFailure.state.sourceAudit.status === 'cancelled' && !abortFailure.auditRun.current && !abortFailure.state.auditBusy);
  const failedPreparation = create(async (_key, _model, parts) => clean(parts)); failedPreparation.state.batch = { snapshot: { facts: [] }, chunkIds: [['missing-fact']] }; failedPreparation.render().prepareSourceAudit();
  t('group preparation failures remain local and expose no Run-ready groups', failedPreparation.state.sourceAudit.status === 'failed' && failedPreparation.state.sourceAudit.groups.length === 0 && failedPreparation.calls.length === 0);
  t('extracted cancel callback reaches its no-active-run tail safely', (() => { const previous = happy.state.sourceAudit; happy.render().cancelSourceAudit(); return happy.state.sourceAudit === previous && happy.calls.length === 2; })());
}

module.exports = { runAnkiSourceUiTests };
