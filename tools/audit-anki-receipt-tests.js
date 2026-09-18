'use strict';

// Audit characterization, not a new repository gate or a clinical accuracy score.
// Only synthetic workshop material; source-based expectations are specified here.
const fs = require('fs');
const assert = require('assert/strict');
const crypto = require('crypto');
const {resolveSuiteFile} = require('./repo-checks');
const suiteFile = resolveSuiteFile();
const S = fs.readFileSync(suiteFile, 'utf8');
const start = 'function ankiParseCards(raw', end = 'function AnkiStyleBadges';
const a = S.indexOf(start), b = S.indexOf(end, a);
assert(a >= 0 && b > a && S.indexOf(start, a + 1) < 0 && S.indexOf(end, b + 1) < 0);
const source = S.slice(a, b);
const names = ['ankiParseCards','attachCoverageToCards','ankiDedupeCards','ankiNormalizeConditionTags','ankiAuditGroups','ankiParseSourceAuditV4','ankiMergeSourceAuditResult','ankiAuditReviewItems','ankiSourceAuditCurrent','ankiSourceAuditPending','ankiSourceAuditEvidence','ankiExportText','ankiAuditSourceTokens','ankiMakeReviewDecision','ankiReviewDecisionCurrent'];
function helpers(code = source) {
  let n = 0;
  return new Function('uid','globalThis','TextEncoder',code + ';return {' + names.join(',') + '};')(() => 'audit-note-' + ++n, {crypto:crypto.webcrypto}, TextEncoder);
}
const H = helpers(), clone = x => JSON.parse(JSON.stringify(x));
let assertions = 0;
function check(name, condition) { assertions++; assert(condition, name); }
function fixture(text, extra = '', sourceText = 'The red marker belongs in the north drawer.') {
  const fact = {id:'fact-1',text:sourceText,condition:'Workshop',aliases:[],subtype:'',tier:1,bucket:'Educate',sourceQuote:sourceText,source:{fileName:'synthetic.txt',location:'line 1'}};
  const snapshot = {facts:[fact],byId:{'fact-1':fact}};
  const response = '```text\n' + text + '|' + extra + '|Topic::Workshop Tier::1\n```\n```text\nfact-1 -> line #1\n```';
  const parsed = H.ankiParseCards(response, 1, 'hierarchical-v1');
  const stages = {response,parsed:clone(parsed.cards)};
  H.attachCoverageToCards(parsed.cards, [{chunk:1,text:parsed.ledger}], snapshot, [['fact-1']]);
  stages.mapped = clone(parsed.cards);
  const deduped = H.ankiDedupeCards(parsed.cards); stages.deduped = clone(deduped);
  const normalized = H.ankiNormalizeConditionTags(deduped, snapshot), cards = normalized.cards;
  stages.normalized = clone(cards);
  const batch = {snapshot,chunkIds:[['fact-1']]};
  const group = H.ankiAuditGroups(cards,batch,'all',4)[0];
  const range = {start:1,end:H.ankiAuditSourceTokens(sourceText).length};
  const receipt = {factReviews:[{factId:'fact-1',inventory:[{sourceRef:range,role:'target',reason:''}],targets:[{sourceRef:range,status:'tested',noteRefs:[{noteId:'n1',clozeIndices:[1]}],contextRefs:[]}]}],noteReviews:[{noteId:'n1',text:{status:'supported',evidence:[{factId:'fact-1',sourceRef:range}]},extra:extra ? {status:'supported',evidence:[{factId:'fact-1',sourceRef:range}]} : {status:'empty',evidence:[]}}],findings:[]};
  const result = {groupId:group.id,...H.ankiParseSourceAuditV4(JSON.stringify(receipt),group)};
  const run = {cards,batch,tier:'all',status:'complete',preparedAt:'synthetic-audit',groups:[group],results:[result],failures:[],responses:[]};
  stages.afterAudit = clone(cards);
  stages.exported = H.ankiExportText(cards,batch,true,'all',false,false);
  return {cards,batch,group,receipt,result,run,stages};
}

async function main() {
  const cases = [
    {id:'literal-supported',text:'[Marker] The red marker belongs in the {{c1::north}} drawer.',expected:'supported',rationale:'The source states north for this marker.'},
    {id:'paraphrase-supported',text:'[Marker] Place the red marker in the {{c1::north}} drawer.',expected:'supported',rationale:'Place in preserves the supplied storage destination.'},
    {id:'wrong-answer-real-citation',text:'[Marker] The red marker belongs in the {{c1::south}} drawer.',expected:'unsupported',rationale:'The only supplied destination is north; south contradicts it.'},
    {id:'outside-cloze-negation',text:'[Marker] The red marker does not belong in the {{c1::north}} drawer.',expected:'unsupported',rationale:'The added negation reverses the source outside the answer.'},
    {id:'extra-addition',text:'[Marker] The red marker belongs in the {{c1::north}} drawer.',extra:'The marker dissolves in water.',expected:'unsupported',rationale:'No statement in this source describes solubility.'},
    {id:'hint-addition',text:'[Marker] The red marker belongs in the {{c1::north::sterile drawer}} drawer.',expected:'unsupported',rationale:'The source provides no sterility property; the hint is learner-visible.'},
    {id:'irrelevant-existing-fact',text:'[Marker] The red marker belongs in the {{c1::north}} drawer.',source:'The blue square belongs in the east cabinet.',expected:'unsupported',rationale:'An existing but unrelated fact establishes neither red marker nor north drawer.'},
    {id:'missing-qualifier-inconclusive',text:'[Marker] Place the marker in the {{c1::north}} drawer.',source:'A red marker goes north; a blue marker goes south.',expected:'inconclusive',rationale:'Without color, the destination is underdetermined; the source does not prove this general card true or false.'},
  ];
  const outcomes = [];
  for (const spec of cases) {
    const f = fixture(spec.text,spec.extra || '',spec.source);
    const queue = H.ankiAuditReviewItems(f.run,f.cards,f.batch,'all');
    check(spec.id + ': well-addressed model receipt is accepted structurally', f.result.complete);
    check(spec.id + ': audit leaves Text, Extra, tags and selection unchanged', JSON.stringify(f.stages.normalized) === JSON.stringify(f.stages.afterAudit));
    check(spec.id + ': export retains the submitted claim', f.stages.exported.includes(spec.text));
    outcomes.push({...spec,actual:{receiptComplete:f.result.complete,textStatus:f.result.noteReviews[0].text.status,extraStatus:f.result.noteReviews[0].extra.status,queueCodes:queue.map(x=>x.code),exportable:true},stages:f.stages});
  }
  const base = fixture(cases[0].text), before = JSON.stringify(base.cards);
  const parse = value => H.ankiParseSourceAuditV4(JSON.stringify(value),base.group);
  const badRange = clone(base.receipt); badRange.noteReviews[0].text.evidence[0].sourceRef.end = 99;
  const bad = parse(badRange);
  check('invalid note evidence quarantines note but retains independently valid fact', !bad.complete && bad.factReviews.length === 1 && bad.noteReviews.length === 0);
  const badHandle = clone(base.receipt); badHandle.factReviews[0].targets[0].noteRefs[0].noteId = 'n01';
  check('near-match note handle is rejected without guessing', !parse(badHandle).complete);
  const gap = clone(base.receipt); gap.factReviews[0].inventory[0].sourceRef.end--; gap.factReviews[0].targets[0].sourceRef.end--;
  check('missing token coverage does not become complete', !parse(gap).complete);
  for (const raw of ['', '{"factReviews":', '{}']) {
    let rejected = false; try { H.ankiParseSourceAuditV4(raw,base.group); } catch { rejected = true; }
    check('empty/malformed/schema-empty audit is inconclusive, not success: ' + raw, rejected);
  }
  const allContext = clone(base.receipt); allContext.factReviews[0].inventory[0].role = 'context'; allContext.factReviews[0].inventory[0].reason = 'The model calls the entire instruction context.'; allContext.factReviews[0].targets = [];
  const contextResult = {groupId:base.group.id,...parse(allContext)};
  const contextQueue = H.ankiAuditReviewItems({...base.run,results:[contextResult]},base.cards,base.batch,'all');
  check('all-context judgment remains protocol-complete but explicitly enters advisory review', contextResult.complete && contextQueue.some(x=>x.code==='inventory-context'));

  const inputs = {cards:base.cards,batch:base.batch,tier:'all',current:true};
  check('original captured receipt is current', H.ankiSourceAuditCurrent(base.run,inputs));
  for (const [name,change] of [['text',{cards:base.cards.map(c=>({...c,text:c.text+' Changed.'}))}],['extra',{cards:base.cards.map(c=>({...c,extra:'Changed.'}))}],['selection',{cards:base.cards.map(c=>({...c,keep:false}))}],['mapping',{cards:base.cards.map(c=>({...c,factIds:[]}))}],['source',{batch:{...base.batch}}],['tier',{tier:'2'}],['source replacement',{current:false}]]) {
    check(name + ' invalidates captured audit', !H.ankiSourceAuditCurrent(base.run,{...inputs,...change}));
  }
  const evidence = await H.ankiSourceAuditEvidence(base.run,inputs,'synthetic-export');
  check('report distinguishes protocol completion and model accuracy', evidence.metadata.checkComplete && evidence.metadata.audit.limitations.includes('do not certify correctness'));
  const stale = await H.ankiSourceAuditEvidence(base.run,{...inputs,cards:[...base.cards]},'synthetic-export');
  check('outdated report does not claim current completeness', stale.status==='outdated' && !stale.metadata.checkComplete);
  check('invalid records remain pending', H.ankiSourceAuditPending({...base.run,results:[{groupId:base.group.id,...bad}]}).length===1);

  const first = clone(base.receipt); first.factReviews = []; first.noteReviews[0].text = {status:'unsupported',evidence:[]};
  first.findings = [{code:'unsupported',factIds:['fact-1'],noteIds:['n1'],message:'The first attempt claims an unsupported destination.',suggestion:''}];
  const p1 = parse(first), p2 = parse(base.receipt), merged = {groupId:base.group.id,...H.ankiMergeSourceAuditResult(p1,p2,base.group)};
  check('partial retry merges current supported receipt but retains former finding', !p1.complete && merged.complete && merged.noteReviews[0].text.status==='supported' && merged.findings[0].code==='unsupported');
  const retryQueue = H.ankiAuditReviewItems({...base.run,results:[merged]},base.cards,base.batch,'all');
  check('retained earlier finding remains in current review queue', retryQueue.some(x=>x.code==='unsupported'));
  check('checks never rewrite captured notes', JSON.stringify(base.cards)===before);

  const f2={...base.batch.snapshot.facts[0],id:'fact-2'};
  const multiSnapshot={facts:[base.batch.snapshot.facts[0],f2],byId:{...base.batch.snapshot.byId,'fact-2':f2}};
  const multiCards=[{...base.cards[0],id:'cross-1',chunk:1,sourceLine:1,factIds:['fact-1']},{...base.cards[0],id:'cross-2',chunk:2,sourceLine:1,factIds:['fact-2']}];
  const collapsed=H.ankiDedupeCards(multiCards),multiGroups=H.ankiAuditGroups(collapsed,{snapshot:multiSnapshot,chunkIds:[['fact-1'],['fact-2']]},'all',4);
  check('exact cross-chunk dedupe preserves both source associations',collapsed.length===1 && collapsed[0].factIds.length===2);
  check('both source chunks retain the surviving note in their audit packets',multiGroups.length===2 && multiGroups.every(g=>g.scopeNoteIds.includes(collapsed[0].id)));
  check('cross-chunk packets retain all linked supporting facts',multiGroups.every(g=>g.facts.some(f=>f.id==='fact-1') && g.facts.some(f=>f.id==='fact-2')));

  const mutations = [];
  function mutant(name, old, replacement, assertion, expectedKilled = true) {
    check(name + ': exact mutation anchor', source.split(old).length === 2);
    let caught = false;
    try { assertion(helpers(source.replace(old,replacement))); } catch (e) { if(e instanceof assert.AssertionError)caught=true;else throw e; }
    check(name + ': mutation result matches independently inspected downstream behavior',caught===expectedKilled); mutations.push({name,killed:caught});
  }
  mutant('bypass note handle lookup (survives: later note access still quarantines the record)', "if(typeof handle!=='string'||!handles.has(handle))", "if(false)", M=>assert.equal(M.ankiParseSourceAuditV4(JSON.stringify(badHandle),base.group).complete,false), false);
  mutant('bypass complete source-token inventory', 'if(!tokens.length||covered.size!==tokens.length)', 'if(false)', M=>assert.equal(M.ankiParseSourceAuditV4(JSON.stringify(gap),base.group).complete,false));
  mutant('invert currentness on edited notes','run.cards===inputs.cards','run.cards!==inputs.cards',M=>assert.equal(M.ankiSourceAuditCurrent(base.run,inputs),true));
  check('extraction reaches final review decision evidence helper', source.includes('function ankiReviewDecisionEvidence') && typeof H.ankiReviewDecisionCurrent==='function');
  const report = {suite:require('path').basename(suiteFile),suiteSha256:crypto.createHash('sha256').update(fs.readFileSync(suiteFile)).digest('hex'),assertions,outcomes,controls:{malformedAuditRejected:true,partialRecordsRetained:true,staleAuditInvalidated:true,allContextAdvisory:true},retryContradiction:{complete:merged.complete,textStatus:merged.noteReviews[0].text.status,findings:merged.findings,queueCodes:retryQueue.map(x=>x.code)},mutations,interpretation:'Accepted receipts establish exact addresses and accounting, not semantic entailment. Unsupported and inconclusive expectations above come from the frozen source, not from the validator. Characterization assertions passing do not make these cards correct.'};
  const outputAt=process.argv.indexOf('--out');
  if(outputAt>=0)fs.writeFileSync(process.argv[outputAt+1],JSON.stringify(report,null,2)+'\n');
  console.log('Receipt audit: '+assertions+' characterization/control assertions passed; semantic cases: 2 supported, 5 unsupported, 1 inconclusive. No model calls.');
  console.log('Protocol-complete receipts can retain source-unsupported claims. See --out JSON for exact stage captures.');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
