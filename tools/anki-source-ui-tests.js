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
  const H = new Function('uid', helpers + ';return {ankiSourceAuditCurrent,ankiSourceAuditPending,ankiSourceAuditState,ankiAuditGroups,ankiBuildSourceAuditPrompt,ankiParseSourceAudit};')(() => 'synthetic-id');
  const callbacks = span('  const prepareSourceAudit=()=>{', '  const openNote=');
  const invalidation = span('  useEffect(()=>{\n    const run=auditRun.current;', '  },[cards,batch,tierFilter,current]);', true);
  const cleanup = '  useEffect(()=>()=>{auditRun.current?.ctl.abort();auditRun.current=null;},[]);';
  if (S.split(cleanup).length !== 2) throw new Error('Anki source-check unmount extraction anchor moved');
  const capture = new Function('state', 'services', `
    const {cards,batch,tierFilter,current,busy,auditBusy,sourceAudit,model,toolLevel,auditModel,auditLevel,cfg}=state;
    const {auditRun,auditInputs,setSourceAudit,setAuditBusy,callGemini,ankiSourceAuditCurrent,ankiSourceAuditPending,ankiSourceAuditState,ankiAuditGroups,ankiBuildSourceAuditPrompt,ankiParseSourceAudit}=services;
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
    return { state, services, calls, publications, auditRun, auditInputs, render, prepare };
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
  t('each finished group publishes evidence alongside the next in-flight attempt', cancelled.state.sourceAudit.results.length === 1 && cancelled.state.sourceAudit.responses.length === 2 && cancelled.state.sourceAudit.responses[0].accepted && cancelled.state.sourceAudit.responses[1].raw === null && !cancelled.state.sourceAudit.responses[1].finishedAt && cancelDeferred.requests.length === 2);
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
  t('malformed audit output retains earlier results and quarantines the rejected raw response', malformed.state.sourceAudit.status === 'partial' && malformed.state.sourceAudit.results.length === 1 && malformed.state.sourceAudit.responses.length === 2 && malformed.state.sourceAudit.responses[1].raw === 'MALFORMED_SYNTHETIC_RESPONSE' && malformed.state.sourceAudit.failures[0].type === 'validation' && !malformed.state.auditBusy);
  const missingReceipts = create(async () => '{"findings":[]}');
  await missingReceipts.prepare().runSourceAudit();
  t('findings-only responses quarantine each group without counting unreviewed source groups complete', missingReceipts.state.sourceAudit.status === 'partial' && missingReceipts.state.sourceAudit.results.length === 0 && missingReceipts.state.sourceAudit.responses.length === 2 && missingReceipts.state.sourceAudit.responses.every(r=>r.raw === '{"findings":[]}' && r.type === 'validation') && missingReceipts.calls.length === 2 && missingReceipts.state.sourceAudit.failures.length === 2 && !missingReceipts.state.auditBusy);
  const truncated = create(async (_key, _model, parts, options) => { options.onMeta({ truncated: true }); return clean(parts); });
  await truncated.prepare().runSourceAudit();
  t('truncated responses remain evidence and later groups are attempted without implicit retries', truncated.state.sourceAudit.status === 'partial' && truncated.state.sourceAudit.responses.every(r=>r.truncated && r.type === 'truncated') && truncated.state.sourceAudit.results.length === 0 && truncated.calls.length === 2 && truncated.state.sourceAudit.failures.length === 2);
  const abortFailure = create(async () => { const e = Error('Synthetic abort'); e.name = 'AbortError'; throw e; });
  await abortFailure.prepare().runSourceAudit();
  t('transport aborts produce cancelled state and release the running lock', abortFailure.state.sourceAudit.status === 'cancelled' && !abortFailure.auditRun.current && !abortFailure.state.auditBusy);
  const failedPreparation = create(async (_key, _model, parts) => clean(parts)); failedPreparation.state.batch = { snapshot: { facts: [] }, chunkIds: [['missing-fact']] }; failedPreparation.render().prepareSourceAudit();
  t('group preparation failures remain local and expose no Run-ready groups', failedPreparation.state.sourceAudit.status === 'failed' && failedPreparation.state.sourceAudit.groups.length === 0 && failedPreparation.calls.length === 0);

  // v16.3: completion and recovery are measured with the live callbacks, not an imitation queue.
  const timestamp = value => Number.isFinite(Date.parse(value));
  t('preparation captures exact per-group prompt strings and starts with empty failure/session history', happy.state.sourceAudit.prompts.length === 2 && happy.calls.every((c,i)=>c[2][0].text === happy.state.sourceAudit.prompts[i].text) && happy.state.sourceAudit.failures.length === 0 && happy.state.sourceAudit.failureHistory.length === 0);
  t('accepted attempts and their first session carry ordered execution timestamps', happy.state.sourceAudit.responses.every(r=>r.attempt === 1 && timestamp(r.startedAt) && timestamp(r.finishedAt) && Date.parse(r.startedAt) <= Date.parse(r.finishedAt)) && happy.state.sourceAudit.sessions.length === 1 && happy.state.sourceAudit.sessions[0].status === 'complete' && timestamp(happy.state.sourceAudit.sessions[0].finishedAt));
  await happy.render().runSourceAudit();
  t('a completed run does not silently start another session or repeat accepted requests', happy.calls.length === 2 && happy.state.sourceAudit.sessions.length === 1 && H.ankiSourceAuditPending(happy.state.sourceAudit).length === 0);
  t('pending selection includes unaccepted empty-scope groups and handles an empty capture', H.ankiSourceAuditPending({groups:[{id:'accepted'},{id:'empty',facts:[],notes:[]}],results:[{groupId:'accepted'}]}).map(g=>g.id).join() === 'empty' && H.ankiSourceAuditPending({groups:[],results:[]}).length === 0);

  const originalBuilder = H.ankiBuildSourceAuditPrompt;
  const captured = create(async (_key,_model,parts)=>clean(parts)); captured.prepare();
  const capturedPrompts = captured.state.sourceAudit.prompts.map(p=>p.text);
  captured.services.ankiBuildSourceAuditPrompt = () => { throw Error('A captured request must not be rebuilt.'); };
  await captured.render().runSourceAudit();
  t('execution uses prepared prompt text even if the currently available builder changes', captured.state.sourceAudit.status === 'complete' && captured.calls.every((c,i)=>c[2][0].text === capturedPrompts[i]) && captured.state.sourceAudit.builderSource === originalBuilder.toString());

  let firstValidation = true;
  const continued = create(async (_key,_model,parts)=>{if(firstValidation){firstValidation=false;return 'INVALID_FIRST_GROUP';}return clean(parts);});
  await continued.prepare().runSourceAudit();
  const firstPartial = continued.state.sourceAudit, preservedResult = firstPartial.results[0];
  t('validation failure in the first group does not prevent a later independent group from completing', firstPartial.status === 'partial' && continued.calls.length === 2 && firstPartial.results.length === 1 && firstPartial.results[0].groupId === firstPartial.groups[1].id && H.ankiSourceAuditPending(firstPartial).length === 1);
  t('a quarantined validation failure retains its group, attempt and diagnostic location', firstPartial.failures[0].groupId === firstPartial.groups[0].id && firstPartial.failures[0].attempt === 1 && firstPartial.failures[0].type === 'validation' && firstPartial.failures[0].detail.groupId === firstPartial.groups[0].id && timestamp(firstPartial.failures[0].at));
  continued.state.auditModel = 'changed-after-partial'; continued.state.auditLevel = 'high';
  await continued.render().runSourceAudit();
  const resumed = continued.state.sourceAudit;
  t('explicit resume calls only the unaccepted group with its captured model and thinking level', continued.calls.length === 3 && resumed.status === 'complete' && resumed.results.length === 2 && resumed.results.includes(preservedResult) && continued.calls[2][1] === 'synthetic-audit-model' && continued.calls[2][3].thinkingLevel === 'medium' && continued.calls[2][2][0].text === firstPartial.prompts[0].text);
  t('successful resume clears the current group failure while retaining old failures and response attempts', resumed.failures.length === 0 && resumed.failureHistory.length === 1 && resumed.responses.length === 3 && resumed.responses[0].raw === 'INVALID_FIRST_GROUP' && resumed.responses[2].attempt === 2 && resumed.responses[2].accepted);
  t('resume retains initial preparation/start timestamps and closes both session records', resumed.preparedAt === firstPartial.preparedAt && resumed.startedAt === firstPartial.startedAt && resumed.sessions.length === 2 && resumed.sessions[0].status === 'partial' && resumed.sessions[1].status === 'complete' && resumed.sessions.every(s=>timestamp(s.startedAt) && timestamp(s.finishedAt)) && resumed.sessions[1].groupIds.join() === firstPartial.groups[0].id);
  t('resuming does not mutate previously published partial evidence', firstPartial.results.length === 1 && firstPartial.responses.length === 2 && firstPartial.failures.length === 1 && firstPartial.sessions.length === 1 && firstPartial.status === 'partial');

  let repeatedFirst = 0;
  const repeated = create(async (_key,_model,parts)=>{const group=JSON.parse(parts[0].text.split('AUDIT PACKET:')[1]);return group.sourceFactIds.includes('fact-1')&&++repeatedFirst<3?'REPEATED_INVALID_RESPONSE':clean(parts);});
  await repeated.prepare().runSourceAudit(); await repeated.render().runSourceAudit();
  t('repeated explicit failures retain full history but one latest unresolved failure per group', repeated.calls.length === 3 && repeated.state.sourceAudit.status === 'partial' && repeated.state.sourceAudit.failureHistory.length === 2 && repeated.state.sourceAudit.failures.length === 1 && repeated.state.sourceAudit.failures[0].attempt === 2 && repeated.state.sourceAudit.results.length === 1);
  await repeated.render().runSourceAudit();
  t('a later successful attempt clears unresolved failure without dropping either earlier rejection', repeated.calls.length === 4 && repeated.state.sourceAudit.status === 'complete' && repeated.state.sourceAudit.failureHistory.length === 2 && repeated.state.sourceAudit.failures.length === 0 && repeated.state.sourceAudit.responses[3].attempt === 3 && repeated.state.sourceAudit.sessions.length === 3);

  let truncateFirst = true;
  const oneTruncated = create(async (_key,_model,parts,options)=>{if(truncateFirst){truncateFirst=false;options.onMeta({truncated:true,usage:{totalTokenCount:7}});}return clean(parts);});
  await oneTruncated.prepare().runSourceAudit();
  t('one truncated response preserves raw text and usage while a later group still succeeds', oneTruncated.state.sourceAudit.status === 'partial' && oneTruncated.state.sourceAudit.results.length === 1 && oneTruncated.state.sourceAudit.responses[0].raw.length > 0 && oneTruncated.state.sourceAudit.responses[0].usage.totalTokenCount === 7 && oneTruncated.state.sourceAudit.failures[0].type === 'truncated');
  await oneTruncated.render().runSourceAudit();
  t('explicit resume recovers only the truncated group and keeps its original attempt', oneTruncated.calls.length === 3 && oneTruncated.state.sourceAudit.status === 'complete' && oneTruncated.state.sourceAudit.responses[0].truncated && oneTruncated.state.sourceAudit.responses[2].attempt === 2 && oneTruncated.state.sourceAudit.failureHistory.length === 1);

  const addThird = run => {
    run.state.batch.snapshot.facts.push({...run.state.batch.snapshot.facts[0],id:'fact-3',text:'Synthetic target 3.'});
    run.state.batch.chunkIds.push(['fact-3']);
    run.state.cards.push({...run.state.cards[0],id:'note-3',chunk:3,text:'[Synthetic] Action: {{c1::target 3}}.',factIds:['fact-3']});
    return run;
  };
  for(const message of ['HTTP 429 quota exceeded','HTTP 401 authentication failed','Synthetic network unavailable']){
    let requests = 0;
    const stopped = addThird(create(async (_key,_model,parts)=>{if(++requests === 2)throw Error(message);return clean(parts);}));
    await stopped.prepare().runSourceAudit();
    t(message+' stops the session before a third request and preserves its first accepted result', stopped.calls.length === 2 && stopped.state.sourceAudit.status === 'failed' && stopped.state.sourceAudit.results.length === 1 && stopped.state.sourceAudit.failures[0].type === 'transport' && stopped.state.sourceAudit.responses[1].raw === null && timestamp(stopped.state.sourceAudit.responses[1].finishedAt) && stopped.state.sourceAudit.sessions[0].status === 'failed');
    await stopped.render().runSourceAudit();
    t(message+' can resume only the failed and unattempted groups without repeating the accepted group', stopped.calls.length === 4 && stopped.state.sourceAudit.status === 'complete' && stopped.state.sourceAudit.results.length === 3 && stopped.state.sourceAudit.failures.length === 0 && stopped.state.sourceAudit.failureHistory.length === 1 && stopped.state.sourceAudit.responses[2].attempt === 2 && stopped.state.sourceAudit.responses[3].attempt === 1);
  }

  t('explicit cancellation closes the active attempt/session without inventing a returned body', cancelledReport.responses[1].raw === null && cancelledReport.responses[1].aborted && timestamp(cancelledReport.responses[1].finishedAt) && cancelledReport.sessions[0].status === 'cancelled' && timestamp(cancelledReport.sessions[0].finishedAt));
  cancelled.services.callGemini = (...args) => {cancelled.calls.push(args);return Promise.resolve(clean(args[2]));};
  await cancelled.render().runSourceAudit();
  t('cancelled runs resume the unfinished group while retaining earlier accepted results and the aborted attempt', cancelled.calls.length === 3 && cancelled.state.sourceAudit.status === 'complete' && cancelled.state.sourceAudit.results.length === 2 && cancelled.state.sourceAudit.responses[1].aborted && cancelled.state.sourceAudit.responses[2].attempt === 2 && cancelled.state.sourceAudit.sessions.length === 2);
  t('invalidation closes session and in-flight attempt timestamps even when the late body is discarded', guarded.state.sourceAudit.sessions[0].status === 'interrupted' && timestamp(guarded.state.sourceAudit.sessions[0].finishedAt) && guarded.state.sourceAudit.responses[0].aborted && guarded.state.sourceAudit.responses[0].raw === null);
  const staleCalls = guarded.calls.length; await guarded.render().runSourceAudit();
  t('an interrupted capture cannot resume after notes identity changes', guarded.calls.length === staleCalls && guarded.state.sourceAudit.status === 'interrupted');

  const parallel = pending(), doubleStart = create(parallel.call), doubleUi = doubleStart.prepare();
  const firstStart = doubleUi.runSourceAudit(), secondStart = doubleUi.runSourceAudit();
  t('the running reference blocks a second Run from the same stale callback closure', parallel.requests.length === 1 && doubleStart.state.sourceAudit.sessions.length === 1);
  doubleStart.render().cancelSourceAudit();parallel.requests[0].resolve(clean(parallel.requests[0].args[2]));await Promise.all([firstStart,secondStart]);

  const diagnostic = create(async (_key,_model,parts)=>clean(parts)); diagnostic.prepare();
  const originalParser = diagnostic.services.ankiParseSourceAudit; let rejectOne = true;
  diagnostic.services.ankiParseSourceAudit=(raw,group)=>{
    if(rejectOne){rejectOne=false;const e=Error('Synthetic invalid citation');e.code='anki-audit-validation';e.detail={groupId:group.id,path:'factReviews[0].targets[0].sourceSpan',factId:'fact-1',noteId:'note-1',sourceSpan:'Synthetic unmatched span'};throw e;}
    return {...originalParser(raw,group),citationRecoveries:[{path:'synthetic-location',method:'synthetic-test'}]};
  };
  await diagnostic.render().runSourceAudit();
  t('typed validation details survive quarantine and accepted citation recovery metadata survives publication', diagnostic.state.sourceAudit.failures[0].detail.path === 'factReviews[0].targets[0].sourceSpan' && diagnostic.state.sourceAudit.failures[0].detail.sourceSpan === 'Synthetic unmatched span' && diagnostic.state.sourceAudit.results[0].citationRecoveries[0].method === 'synthetic-test');
  const secretError = create(async()=>{throw Error('Synthetic request rejected '+credential);});await secretError.prepare().runSourceAudit();
  t('transport error evidence redacts the captured credential instead of persisting it', !JSON.stringify(secretError.state.sourceAudit).includes(credential) && secretError.state.sourceAudit.failures[0].error.includes('[redacted]'));

  const empty = create(async()=>{throw Error('Empty capture must not use transport.');},{cards:[],batch:{snapshot:{facts:[]},chunkIds:[]},cfg:{apiKey:''}});
  await empty.prepare().runSourceAudit();
  t('a valid prepared empty capture completes locally without credentials or transport', empty.state.sourceAudit.status === 'complete' && empty.calls.length === 0 && empty.state.sourceAudit.results.length === 0 && empty.state.sourceAudit.sessions[0].groupIds.length === 0);
  await failedPreparation.render().runSourceAudit();
  t('a failed local preparation is not mistaken for a successfully checked empty capture', failedPreparation.state.sourceAudit.status === 'failed' && failedPreparation.calls.length === 0 && failedPreparation.state.sourceAudit.sessions.length === 0);
  t('extracted cancel callback reaches its no-active-run tail safely', (() => { const previous = happy.state.sourceAudit; happy.render().cancelSourceAudit(); return happy.state.sourceAudit === previous && happy.calls.length === 2; })());
}

module.exports = { runAnkiSourceUiTests };
