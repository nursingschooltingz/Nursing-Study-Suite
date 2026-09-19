#!/usr/bin/env node
'use strict';

// Audit-only, offline. Execute extracted shipped functions and the complete
// AnkiGenerator hook/handler body (only its JSX return is replaced by a probe).
// The small hook runner is not a browser/React scheduling equivalence claim.
// All API I/O is synthetic; no external dependencies, app edits, or course files.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {resolveSuiteFile}=require('./repo-checks');
const {validReceipt}=require('./fixtures/anki-audit-response');
const root=path.resolve(__dirname,'..'),file=resolveSuiteFile({rootDir:root});
const S=fs.readFileSync(file,'utf8');
function span(a,b){const i=S.indexOf(a),j=S.indexOf(b,i+a.length);assert(i>=0&&j>i,'live extraction anchors: '+a);assert.equal(S.indexOf(a,i+a.length),-1,'unique start anchor: '+a);return S.slice(i,j);}
const helperSource=span('function ankiParseCards(raw','function AnkiStyleBadges');
const setup=span('const ANKI_MASTER_PROMPT=', 'function splitOversizedConditionBlock')+
  span('function splitOversizedConditionBlock','function ankiParseCards(raw')+
  span('function validateLatteKnowledgeBase(kb){','function kbBucketFacts')+
  span('function kbSourceText(f){','function renderKBMarkdown')+
  span('function kbForAnki(kb){','// ── KB source chunking')+
  span('const NEIA_TERMINOLOGY_RULES=','// Deterministic post-generation validation.');
const component=span('function AnkiGenerator(){','function NCLEXExtractor');
const renderAt=component.indexOf('\n  return <Workbench');
assert(renderAt>0&&component.slice(0,renderAt).includes('const exportTxt=useCallback'),'component tail includes live export handler');
const probeReturn=`return {run,cards,batch,busy,logs,coverage,selected,interruptedRun,numericAudits,current,abortCtl,sourceAudit,auditBusy,updateField,updateSourceLinks,toggle,del,exportTxt,setTierFilter,setWarningFilter,setStyleOnly,prepareSourceAudit,runSourceAudit,cancelSourceAudit,sourceAuditCurrent:ankiSourceAuditCurrent(sourceAudit,{cards,batch,tier:tierFilter,current})};}`;
const transportSource=span('function geminiRetryDelayMs(', 'function extractJSON(');
const snapshot=x=>JSON.parse(JSON.stringify(x));
function sourceKB(long=false){return {metadata:{schemaVersion:'1.0'},conditions:[{id:'c1',name:'Synthetic',aliases:[],facts:[
  {id:'fact-1',text:'Observe for 1 minute; report below 60 bpm.'+(long?' '+'Synthetic context. '.repeat(710):''),tier:1,latteBucket:'Assess',sourceQuote:'Observe for 1 minute; report below 60 bpm.',sources:[{filename:'synthetic.txt',location:'line 1'}]},
  {id:'fact-2',text:'The marker is blue.',tier:2,latteBucket:'Look',sourceQuote:'The marker is blue.',sources:[{filename:'synthetic.txt',location:'line 2'}]}
]}]};}
const supported='[Synthetic] Observation: {{c1::1 minute}}; reporting threshold: below {{c2::60 bpm}}.||Nursing::LATTE::Assess Condition::Synthetic Tier::1';
const second='[Synthetic] Marker: {{c1::blue}}.||Nursing::LATTE::Look Condition::Synthetic Tier::2';
function response(notes=[supported,second],map=['fact-1 -> line #1','fact-2 -> line #2']){return '```text\n'+notes.join('\n')+'\n```\n```text\n'+map.join('\n')+'\n```';}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(test){for(let i=0;i<100;i++){if(test())return;await tick();}throw Error('Synthetic operation did not reach expected boundary.');}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}

function mount({kb=sourceKB(),callGemini,mutant=false}={}){
  const cells=[],effects=[],stages=[],downloads=[];
  let registry={ankiNotes:[],nclexQuestions:[{id:'other'}]};
  let cursor=0,dirty=true,state,uid=0,source=kb,dead=false;
  const different=(a,b)=>!a||!b||a.length!==b.length||a.some((v,i)=>v!==b[i]);
  function useState(initial){const at=cursor++;if(!cells[at]){const cell={value:typeof initial==='function'?initial():initial};cell.set=value=>{const next=typeof value==='function'?value(cell.value):value;if(next!==cell.value){cell.value=next;dirty=true;}};cells[at]=cell;}return [cells[at].value,cells[at].set];}
  function useRef(value){const at=cursor++;return cells[at]||(cells[at]={current:value});}
  function useMemo(fn,deps){const at=cursor++;if(!cells[at]||different(cells[at].deps,deps))cells[at]={value:fn(),deps};return cells[at].value;}
  function useCallback(fn,deps){return useMemo(()=>fn,deps);}
  function useEffect(fn,deps){const at=cursor++;if(!cells[at]||different(cells[at].deps,deps)){const old=cells[at];cells[at]={deps,cleanup:old?.cleanup};effects.push(()=>{cells[at].cleanup?.();cells[at].cleanup=fn();});}}
  const cfg={apiKey:'synthetic-only',forTool:()=>({model:'synthetic-model',level:'medium'}),flashModel:'synthetic-flash',proModel:'synthetic-pro',autoProfile:true};
  const currentKnowledge={current:source},setArtifactRegistry=value=>{registry=typeof value==='function'?value(registry):value;};
  const registerArtifact=new Function('useCallback','currentKnowledge','setArtifactRegistry',
    span('  const registerArtifact=useCallback((kind,entries,','  const knowledgeValue=')+';return registerArtifact;')((fn)=>fn,currentKnowledge,setArtifactRegistry);
  const replaceKB=new Function('useCallback','currentKnowledge','kbMutation','publishKnowledgeBase','setSaveRequest','setPersistenceStatus','setArtifactRegistry','setInspectedFactId','EMPTY_ARTIFACT_REGISTRY',
    span('  const setKnowledgeBase=useCallback(value=>{','  const [persistenceStatus,')+';return setKnowledgeBase;')((fn)=>fn,currentKnowledge,{current:0},value=>{source=value;dirty=true;},()=>{},()=>{},setArtifactRegistry,()=>{},{ankiNotes:[],nclexQuestions:[],caseStudies:[]});
  let helpers=helperSource;
  if(mutant){const guard='return run===active&&run.sourceKB===sourceKB&&!run.ctl.signal.aborted;';assert.equal(helpers.split(guard).length,2);helpers=helpers.replace(guard,'return true;');}
  const instrument=`
const capture=(stage,value)=>probe.stages.push({stage,value:probe.snapshot(value)});
const originalParse=ankiParseCards;ankiParseCards=(...a)=>{capture('raw-response',a[0]);const r=originalParse(...a);capture('parsed',r.cards);return r;};
const originalMap=attachCoverageToCards;attachCoverageToCards=(...a)=>{const r=originalMap(...a);capture('mapped',a[0]);return r;};
const originalDedupe=ankiDedupeCards;ankiDedupeCards=(...a)=>{const r=originalDedupe(...a);capture('deduped',r);return r;};
const originalNormalize=ankiNormalizeConditionTags;ankiNormalizeConditionTags=(...a)=>{const r=originalNormalize(...a);capture('normalized',r.cards);return r;};
`;
  const construct=new Function('useState','useRef','useMemo','useCallback','useEffect','useConfig','useKnowledge','callGemini','downloadBlob','uid','probe',
    setup+helpers+instrument+component.slice(0,renderAt)+probeReturn+';return AnkiGenerator;');
  const Component=construct(useState,useRef,useMemo,useCallback,useEffect,()=>cfg,()=>({knowledgeBase:source,registerArtifact,isCurrentSource:kb=>kb===source}),callGemini||(async()=>response()),(blob,name)=>downloads.push({blob,name}),()=>`synthetic-${++uid}`,{stages,snapshot});
  const flush=()=>{if(dead)return state;for(let n=0;dirty||effects.length;n++){assert(n<100,'hook effects converge');if(dirty){dirty=false;cursor=0;state=Component();}effects.splice(0).forEach(fn=>fn());}return state;};
  flush();
  return {get state(){return flush();},stages,get registry(){return registry;},downloads,replaceKB(kb){replaceKB(kb);flush();},unmount(){for(const cell of cells)cell?.cleanup?.();dead=true;},async generate(){const run=flush().run();flush();await run;return flush();}};
}

function sse(text,finish='STOP'){
  const event={candidates:[{content:{parts:[{text}]},...(finish?{finishReason:finish}:{})}]};
  return new Response('data: '+JSON.stringify(event)+'\n\n',{status:200,headers:{'content-type':'text/event-stream'}});
}
function transport(queue){
  const calls=[],metadata=[],updates=[],delays=[];
  const fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});assert(queue.length,'unexpected synthetic fetch');const next=queue.shift();if(next instanceof Error)throw next;return typeof next==='function'?next(url,opts):next;};
  const api=new Function('fetch','_sleep','SAFETY_SETTINGS',transportSource+';return {callGemini,geminiRequest};')(fetch,async(ms,signal)=>{delays.push(ms);if(signal?.aborted)throw new DOMException('Aborted','AbortError');},[]);
  return {...api,calls,metadata,updates,delays,call:(opts={})=>api.callGemini('synthetic-only','synthetic-model',[{text:'synthetic prompt'}],{onMeta:m=>metadata.push(m),onUpdate:t=>updates.push(t),...opts})};
}

let passed=0;const results=[];
async function test(name,fn){await fn();passed++;results.push(name);console.log('PASS '+name);}
async function main(){
  await test('supported generation preserves note fields through every actual content stage',async()=>{
    const m=mount();await m.generate();
    assert.equal(m.state.cards.length,2);assert.deepEqual(m.stages.map(s=>s.stage),['raw-response','parsed','mapped','deduped','normalized']);
    for(const stage of m.stages.filter(s=>Array.isArray(s.value)))assert.deepEqual(stage.value.map(c=>[c.text,c.extra,c.tags]),[supported,second].map(line=>line.split('|')));
    assert.equal(m.state.coverage.coveredCount,2);assert.equal(m.state.selected.reviews,3);
    assert.equal(m.registry.ankiNotes.length,2);assert.equal(m.registry.nclexQuestions[0].id,'other');
    m.state.exportTxt();assert.equal(await m.downloads[0].blob.text(),supported+'\n'+second);
  });
  await test('selection, tier, edit repair, deletion, export and global registry agree',async()=>{
    const m=mount();await m.generate();const [a,b]=m.state.cards;
    m.state.setTierFilter('1');assert.equal(m.state.selected.reviews,2);assert.equal(m.registry.ankiNotes.length,2);
    m.state.setWarningFilter('mapping');m.state.setStyleOnly(true);m.state.exportTxt();assert.equal(await m.downloads.at(-1).blob.text(),supported);
    m.state.updateField(a.id,'text','{{c1::broken');assert.equal(m.state.cards[0].keep,true);assert.equal(m.state.selected.kept.length,0);assert.equal(m.state.coverage.coveredCount,1);
    m.state.toggle(a.id);m.state.updateField(a.id,'text',a.text);assert.equal(m.state.cards[0].keep,false);assert.equal(m.state.selected.kept.length,0);
    m.state.toggle(a.id);assert.equal(m.state.selected.reviews,2);assert.equal(m.registry.ankiNotes.length,2);
    m.state.del(b.id);assert.equal(m.state.coverage.coveredCount,1);assert.equal(m.registry.ankiNotes.length,1);
  });
  await test('numeric evidence and prepared source audit invalidate after Text, Extra, source-link and KB edits',async()=>{
    const m=mount();await m.generate();const id=m.state.cards[0].id;
    m.state.prepareSourceAudit();assert.equal(m.state.sourceAuditCurrent,true);
    const original=m.state.cards[0].text;m.state.updateField(id,'text',original.replace('60 bpm','70 bpm'));
    assert.equal(m.state.sourceAuditCurrent,false);assert(m.state.numericAudits.get(id).findings.some(f=>f.code==='numeric-discrepancy'));
    m.state.updateField(id,'text',original);m.state.prepareSourceAudit();
    m.state.updateField(id,'extra','Repeat after 8 minutes.');assert.equal(m.state.sourceAuditCurrent,false);
    assert(m.state.numericAudits.get(id).findings.length,'8 minutes is absent from linked fact');
    m.state.prepareSourceAudit();m.state.updateSourceLinks(id,['fact-2']);assert.equal(m.state.sourceAuditCurrent,false);
    assert(m.state.numericAudits.get(id).findings.length,'irrelevant color source cannot support timing');
    m.replaceKB(sourceKB());assert.equal(m.state.current,false);assert.equal(m.state.coverage.kept.length,0);assert.equal(m.state.sourceAuditCurrent,false);
    const count=m.downloads.length;m.state.exportTxt();assert.equal(m.downloads.length,count);assert.equal(m.registry.ankiNotes.length,0);
  });
  await test('unsupported qualitative content remains exportable without implying a semantic check',async()=>{
    const unsupported='[Synthetic] Marker: {{c1::red}}.|Always safe.|Nursing::LATTE::Look Condition::Synthetic Tier::2';
    const m=mount({callGemini:async()=>response([unsupported],['fact-2 -> line #1'])});await m.generate();
    assert.equal(m.state.selected.kept.length,1);assert.equal(m.state.coverage.coveredCount,1);
    assert.equal(m.state.numericAudits.get(m.state.cards[0].id).findings.length,0);
    assert.equal(m.state.sourceAudit,null);m.state.exportTxt();assert.equal(await m.downloads[0].blob.text(),unsupported);
  });
  await test('unmapped note is inconclusive and exportable but never increases linked coverage',async()=>{
    const m=mount({callGemini:async()=>response([supported],[])});await m.generate();
    assert.equal(m.state.selected.kept.length,1);assert.equal(m.state.coverage.coveredCount,0);assert.equal(m.registry.ankiNotes.length,0);
    assert(m.state.batch.mappingIssues.some(i=>i.code==='no-mapping'));assert(m.state.numericAudits.get(m.state.cards[0].id).findings.length);
  });
  await test('real transport retries empty STOP then returns only successful final attempt',async()=>{
    const t=transport([sse(''),sse(response())]);assert.equal(await t.call(),response());assert.equal(t.calls.length,2);assert.equal(t.metadata[0].complete,false);assert.equal(t.metadata[1].complete,true);
    assert.equal(t.delays.length,1);assert(t.updates.includes(''),'retry resets preview');
  });
  await test('real transport retries missing finish metadata and rejects fatal API errors',async()=>{
    const t=transport([sse('partial',null),sse('partial',null),sse('partial',null)]);await assert.rejects(()=>t.call(),/without finish metadata/);
    assert.equal(t.calls.length,3);assert(t.metadata.every(x=>!x.complete&&x.partialText==='partial'));
    const fatal=transport([new Response(JSON.stringify({error:{message:'synthetic invalid request'}}),{status:400})]);await assert.rejects(()=>fatal.call(),/synthetic invalid request/);assert.equal(fatal.calls.length,1);
  });
  await test('real transport retry does not duplicate generated notes',async()=>{
    const t=transport([sse('discarded partial',null),sse(response())]),m=mount({callGemini:t.callGemini});await m.generate();
    assert.equal(t.calls.length,2);assert.equal(m.state.cards.length,2);assert.equal(m.state.batch.rawResponses.length,1);assert.equal(m.state.batch.rawResponses[0],response());
  });
  await test('empty exhausted transport cannot become an empty successful Anki batch',async()=>{
    const t=transport([sse(''),sse(''),sse('')]),m=mount({callGemini:t.callGemini});await m.generate();
    assert.equal(t.calls.length,3);assert.equal(m.state.batch,null);assert.equal(m.state.interruptedRun.status,'failed');assert(!m.state.logs.some(l=>l.msg.startsWith('Complete!')));
  });
  await test('429 retries honor provider delay and malformed SSE never becomes a success',async()=>{
    const retry=new Response(JSON.stringify({error:{message:'synthetic quota',details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'9s'}]}}),{status:429});
    const t=transport([retry,sse(response())]);assert.equal(await t.call(),response());assert.equal(t.delays[0],9000);assert.equal(t.calls.length,2);
    const bad=transport([new Response('data: {broken}\n\n')]);await assert.rejects(()=>bad.call({retries:0}),/Malformed nonempty SSE/);assert.equal(bad.metadata[0].complete,false);
  });
  await test('real transport rejects an aborted pending request and marks interrupted metadata',async()=>{
    const ctl=new AbortController(),pending=deferred();let called=false;
    const t=transport([async(url,opts)=>{called=true;opts.signal.addEventListener('abort',()=>pending.reject(new DOMException('Aborted','AbortError')),{once:true});return pending.promise;}]);
    const task=t.call({signal:ctl.signal});await until(()=>called);ctl.abort();await assert.rejects(()=>task,{name:'AbortError'});assert.equal(t.calls.length,1);assert.equal(t.metadata[0].status,'interrupted');
  });
  await test('MAX_TOKENS keeps valid notes, warning and truncated evidence, but still logs Complete',async()=>{
    const t=transport([sse(response([supported],['fact-1 -> line #1']),'MAX_TOKENS')]),m=mount({callGemini:t.callGemini});await m.generate();
    assert.equal(m.state.batch.truncated,true);assert.equal(m.state.selected.kept.length,1);assert(m.state.logs.some(l=>l.msg.includes('cards are missing from the end')));assert(m.state.logs.some(l=>l.msg.startsWith('Complete!')));
  });
  await test('nonempty STOP response with no card records commits zero-note Complete batch',async()=>{
    const t=transport([sse('I could not format this input.')]),m=mount({callGemini:t.callGemini});await m.generate();
    assert.equal(m.state.cards.length,0);assert(m.state.batch);assert.equal(m.state.batch.truncated,false);assert(m.state.logs.some(l=>l.msg.startsWith('Complete! 0 received notes')));assert.equal(m.state.coverage.coveredCount,0);
  });
  await test('late cancelled generation cannot publish even when mock transport ignores abort',async()=>{
    const pending=deferred();let called=false;const m=mount({callGemini:()=>{called=true;return pending.promise;}});const task=m.state.run();await until(()=>called);m.state.abortCtl.abort();pending.resolve(response());await task;
    assert.equal(m.state.cards.length,0);assert.equal(m.state.batch,null);assert.equal(m.state.interruptedRun.status,'cancelled');assert.equal(m.state.busy,false);
  });
  await test('source replacement and older overlapping completion cannot publish into newer run',async()=>{
    const pending=[];const m=mount({callGemini:()=>{const d=deferred();pending.push(d);return d.promise;}});
    const first=m.state.run();await until(()=>pending.length===1);m.replaceKB(sourceKB());assert.equal(m.state.interruptedRun.status,'source-replaced');
    const next=m.state.run();await until(()=>pending.length===2);pending[1].resolve(response([second],['fact-2 -> line #1']));await next;
    pending[0].resolve(response());await first;assert.equal(m.state.cards.length,1);assert.equal(m.state.cards[0].text,second.split('|')[0]);assert.equal(m.state.busy,false);
  });
  await test('same-source superseding generation retains only newest result',async()=>{
    const pending=[];const m=mount({callGemini:()=>{const d=deferred();pending.push(d);return d.promise;}});
    const first=m.state.run();await until(()=>pending.length===1);const next=m.state.run();await until(()=>pending.length===2);
    pending[1].resolve(response([second],['fact-2 -> line #1']));await next;pending[0].resolve(response());await first;
    assert.equal(m.state.cards.length,1);assert.equal(m.state.cards[0].text,second.split('|')[0]);
  });
  await test('later chunk error retains earlier good response only in interrupted diagnostics',async()=>{
    let calls=0;const m=mount({kb:sourceKB(true),callGemini:async()=>{if(++calls===1)return response([supported],['fact-1 -> line #1']);throw Error('synthetic quota exhausted');}});await m.generate();
    assert.equal(calls,2);assert.equal(m.state.cards.length,0);assert.equal(m.state.batch,null);assert.equal(m.state.interruptedRun.status,'failed');assert.equal(m.state.interruptedRun.rawResponses.length,1);assert.equal(m.registry.ankiNotes.length,0);
  });
  await test('new failed generation replaces previous visible batch with diagnostics',async()=>{
    let fail=false;const m=mount({callGemini:async()=>{if(fail)throw Error('synthetic failure');return response();}});await m.generate();assert.equal(m.state.cards.length,2);fail=true;await m.generate();assert.equal(m.state.cards.length,0);assert.equal(m.state.batch,null);assert.equal(m.registry.ankiNotes.length,0);
  });
  await test('source-check transport failure retains cards and retry uses captured request',async()=>{
    let mode='fail';const auditCalls=[];const m=mount({callGemini:async(key,model,parts)=>{
      const text=parts[0].text;if(!text.includes('AUDIT PACKET:'))return response();auditCalls.push(text);if(mode==='fail')throw Error('synthetic check failure');return JSON.stringify(validReceipt(JSON.parse(text.split('AUDIT PACKET:')[1])));
    }});await m.generate();const before=snapshot(m.state.cards);m.state.prepareSourceAudit();await m.state.runSourceAudit();assert.equal(m.state.sourceAudit.status,'failed');assert.deepEqual(m.state.cards,before);
    mode='valid';await m.state.runSourceAudit();assert.equal(m.state.sourceAudit.status,'complete');assert.equal(auditCalls[0],auditCalls[1]);assert.equal(m.state.sourceAudit.responses.length,2);assert.deepEqual(m.state.cards,before);
  });
  await test('source-check response after card edit is stale and cannot publish verdict',async()=>{
    const pending=deferred();let packet;const m=mount({callGemini:async(key,model,parts)=>{const text=parts[0].text;if(!text.includes('AUDIT PACKET:'))return response();packet=JSON.parse(text.split('AUDIT PACKET:')[1]);return pending.promise;}});
    await m.generate();m.state.prepareSourceAudit();const task=m.state.runSourceAudit();await until(()=>!!packet);m.state.updateField(m.state.cards[0].id,'extra','Edited');assert.equal(m.state.auditBusy,false);
    pending.resolve(JSON.stringify(validReceipt(packet)));await task;assert.equal(m.state.sourceAudit.status,'interrupted');assert.equal(m.state.sourceAudit.results.length,0);assert.equal(m.state.sourceAuditCurrent,false);
  });
  await test('malformed and truncated source-check responses remain partial until explicit successful retry',async()=>{
    let mode='malformed';const m=mount({callGemini:async(key,model,parts,options)=>{const text=parts[0].text;if(!text.includes('AUDIT PACKET:'))return response();if(mode==='malformed')return '{';if(mode==='truncated')options.onMeta({truncated:true});return JSON.stringify(validReceipt(JSON.parse(text.split('AUDIT PACKET:')[1])));}});
    await m.generate();const before=snapshot(m.state.cards);m.state.prepareSourceAudit();await m.state.runSourceAudit();assert.equal(m.state.sourceAudit.status,'partial');assert.equal(m.state.sourceAudit.results.length,0);
    mode='truncated';await m.state.runSourceAudit();assert.equal(m.state.sourceAudit.status,'partial');assert.equal(m.state.sourceAudit.results.length,0);assert.equal(m.state.sourceAudit.failures[0].type,'truncated');
    mode='valid';await m.state.runSourceAudit();assert.equal(m.state.sourceAudit.status,'complete');assert.equal(m.state.sourceAudit.responses.length,3);assert.deepEqual(m.state.cards,before);
  });
  await test('tier and manual-selection edits invalidate prepared source-check identity',async()=>{
    const m=mount();await m.generate();m.state.prepareSourceAudit();assert.equal(m.state.sourceAuditCurrent,true);m.state.setTierFilter('1');assert.equal(m.state.sourceAuditCurrent,false);
    m.state.prepareSourceAudit();assert.equal(m.state.sourceAuditCurrent,true);m.state.toggle(m.state.cards[0].id);assert.equal(m.state.sourceAuditCurrent,false);
  });
  await test('cancelled source check retains no late verdict and does not change notes',async()=>{
    const pending=deferred();let packet;const m=mount({callGemini:async(key,model,parts)=>{const text=parts[0].text;if(!text.includes('AUDIT PACKET:'))return response();packet=JSON.parse(text.split('AUDIT PACKET:')[1]);return pending.promise;}});
    await m.generate();const before=snapshot(m.state.cards);m.state.prepareSourceAudit();const task=m.state.runSourceAudit();await until(()=>!!packet);m.state.cancelSourceAudit();pending.resolve(JSON.stringify(validReceipt(packet)));await task;
    assert.equal(m.state.sourceAudit.status,'cancelled');assert.equal(m.state.sourceAudit.results.length,0);assert.deepEqual(m.state.cards,before);
  });
  await test('isolated stale-guard bypass is killed by cancelled-generation assertion',async()=>{
    const pending=deferred();let called=false;const m=mount({mutant:true,callGemini:()=>{called=true;return pending.promise;}});const task=m.state.run();await until(()=>called);m.state.abortCtl.abort();pending.resolve(response());await task;
    assert.throws(()=>assert.equal(m.state.cards.length,0),assert.AssertionError);assert.equal(m.state.cards.length,2);
  });
  console.log('\n'+passed+' lifecycle scenarios passed; one isolated guard mutant killed. No live API requests.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,mount,sourceKB,response,transport,sse};
