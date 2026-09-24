#!/usr/bin/env node
'use strict';

// v17.4: regression contracts for the 2026-09-24 production review, findings R01-R12
// (docs/reviews/production-review-2026-09-24.md). Shipped functions are extracted and exercised
// with synthetic data; a fix that lives inside a component handler is compiled with a minimal
// environment or pinned by a source contract. No course material, no live Gemini call.

const http=require('http');
const fs=require('fs');
const path=require('path');

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('R-findings anchor missing: '+start);
  if(S.indexOf(start,a+1)>=0)throw Error('R-findings anchor ambiguous: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('R-findings end anchor missing after: '+start);
  return S.slice(a,b);
}
const count=(haystack,needle)=>haystack.split(needle).length-1;

async function run(S,t){
  /* ── R01: an unverified calculation answer is disclosed in every export ── */
  const C=new Function(span(S,'const CASE_CLINICAL_TOKEN_RE=','// Every distinct fact id referenced anywhere in the case')+';return {validateCaseStudy};')();
  const appendix=new Function(span(S,'function caseReviewAppendix(cs,issues,rows){','\nfunction caseAuditProgress(')+';return caseReviewAppendix;')();
  const jsonExport=new Function(span(S,'function artifactJsonExport(artifact,notice,validation=[],auditRows=[]){','\n}\n')+'\n};return artifactJsonExport;')();
  const calcCase=(answer,rationale)=>({condition:'Synthetic',stages:[{stageNumber:1,data:[],questions:[{id:'q1',type:'Calculation',stem:'Calculate the dose.',options:[{label:'Answer',text:'Answer'}],correctAnswers:[answer],rationales:[{option:'Answer',text:rationale,supportType:'direct',factIds:['f1']}],factIds:['f1']}]}]});
  const calcIndex=new Map([['f1',{fact:{text:'Dose is 2 mg/kg. Weight is 70 kg.',sourceQuote:''}}]]);
  const validate=(answer,rationale)=>C.validateCaseStudy(calcCase(answer,rationale),calcIndex,new Set(['f1']),'Synthetic');
  const disclosed=issues=>issues.filter(i=>i.sev==='warn'&&/not independently verified/.test(i.msg));
  const unverified=validate('999 mg','Use the supplied dose and weight.');
  t('R01: a calculation with no supported equation gets exactly one disclosure warning and no error',disclosed(unverified).length===1&&!unverified.some(i=>i.sev==='error'));
  const verified=validate('140 mg','2 mg/kg × 70 kg = 140 mg');
  t('R01: a verified equation is not disclosed as unverified and still passes',disclosed(verified).length===0&&!verified.some(i=>i.sev==='error'));
  const wrong=validate('999 mg','2 mg/kg × 70 kg = 140 mg');
  t('R01: a wrong answer against a verified equation is still an error, not a warning',wrong.some(i=>i.sev==='error'&&/disagrees with the verified calculation/.test(i.msg))&&disclosed(wrong).length===0);
  t('R01: the disclosure reaches the Markdown review appendix',appendix(calcCase('999 mg','x'),unverified,[]).includes('- WARN: ')&&/WARN: .*not independently verified/.test(appendix(calcCase('999 mg','x'),unverified,[])));
  t('R01: the disclosure reaches the JSON review block',JSON.parse(jsonExport({title:'Synthetic'},'',unverified,[]))._suiteReview.validation.some(v=>v.severity==='warn'&&/not independently verified/.test(v.message)));
  t('R01: the print and Markdown case exports both append the review appendix',count(S,'caseReviewAppendix(')>=3);

  /* ── R02: one read of the fallback keys feeds both the restored copy and the save baseline ── */
  const persistence=span(S,"const KB_META_KEY='active-save-v2'",'\nfunction validateLatteKnowledgeBase');
  const KB={metadata:{course:'Synthetic A',exam:'',schemaVersion:'1.1',createdAt:'2026-09-24'},sources:[],conditions:[{id:'synthetic',name:'Synthetic',aliases:[],facts:[{id:'fact-1',text:'Synthetic finding.',tier:1,latteBucket:'Look',sourceQuote:'Synthetic finding.',sources:[]}]}],medications:[],diagnostics:[],scoringTools:[],formulas:[],contradictions:[]};
  const withStorage=localStorage=>new Function('localStorage','kbOpenDB',persistence+';return {KB_FALLBACK_KEY,KB_LEGACY_KEY,kbDigest,kbReadFallbackSnapshot,kbReadFallbacks,kbCaptureFallbacks,kbReconcileStored};')(localStorage,async()=>{throw Error('synthetic: no IndexedDB');});
  const probe=withStorage({getItem:()=>null});
  const record=course=>{const kb={...KB,metadata:{...KB.metadata,course}};return JSON.stringify({kb,meta:{writer:'synthetic',sequence:1,parent:null,deleted:false,digest:probe.kbDigest(JSON.stringify(kb))}});};
  const A=record('Synthetic A'),B=record('Synthetic B');
  const mutating=()=>{let reads=0;return {getItem:key=>key===probe.KB_FALLBACK_KEY?(reads++===0?A:B):null};};
  const snapshot=withStorage(mutating()).kbReadFallbackSnapshot();
  t('R02: one read supplies both the restored record and the baseline bytes',snapshot.records.length===1&&snapshot.records[0].kb.metadata.course==='Synthetic A'&&snapshot.captured[probe.KB_FALLBACK_KEY]===A&&snapshot.captured[probe.KB_LEGACY_KEY]===null);
  const legacy=withStorage(mutating());legacy.kbReadFallbacks();
  t('R02: the retired two-read shape could baseline bytes it never restored',legacy.kbCaptureFallbacks()[probe.KB_FALLBACK_KEY]===B);
  const denied=withStorage({getItem(){throw Error('synthetic denied');}}).kbReadFallbackSnapshot();
  t('R02: a denied read yields an unavailable record per key and no baseline',denied.records.length===2&&denied.records.every(r=>r.unavailable&&/Browser fallback access failed/.test(r.recoveryError))&&denied.captured===undefined);
  t('R02: the parsed-record wrapper is unchanged for existing callers',JSON.stringify(withStorage(mutating()).kbReadFallbacks().map(r=>r.kb.metadata.course))==='["Synthetic A"]');
  const hydrateSource=span(S,'    (async()=>{\n      try{\n        let durable=null,unavailable=false;',';return()=>{alive=false;mounted.current=false;};');
  const normalizer=new Function(span(S,'function kbSlug(','// v15.14: the class kept ASCII')+span(S,'const KB_IMPORT_MAX_BYTES=','// ── Durable Knowledge Base persistence')+';return kbNormalizeImported;')();
  const hydrate=new Function('kbLoadPersisted','kbReconcileStored','kbReadFallbackSnapshot','saveQueue','kbMutation','started','kbNormalizeImported','EMPTY_LATTE_KB','currentKnowledge','publishKnowledgeBase','setPersistenceStatus','setPersistenceError','setRecoveryChoices','setHydrated','alive','return '+hydrateSource);
  const store=withStorage(mutating()),state={published:[],status:[],head:null,captured:null};
  await hydrate(async()=>null,store.kbReconcileStored,store.kbReadFallbackSnapshot,{current:{setHead:(head,captured)=>{state.head=head;state.captured=captured;}}},{current:0},0,normalizer,{conditions:[]},{current:{conditions:[]}},kb=>state.published.push(kb),v=>state.status.push(v),()=>{},()=>{},()=>{},true);
  t('R02: App hydration restores and baselines the same fallback bytes while storage changes underneath',state.published.length===1&&state.published[0].metadata.course==='Synthetic A'&&state.captured[probe.KB_FALLBACK_KEY]===A&&state.status.includes('ready'));
  t('R02: hydration no longer takes a second capture',count(hydrateSource,'kbReadFallbackSnapshot()')===1&&!hydrateSource.includes('kbCaptureFallbacks'));

  /* ── R03: union of the regex pairing and the model pairing ── */
  const merge=new Function(span(S,'function nclexMergePairs(','function nclexBatchPairs(')+';return nclexMergePairs;')();
  const P=(number,question,answer='')=>({number,question,answer,matched:!!answer});
  let m=merge([P(1,'Q one'),P(2,'Q two')],[P(2,'Q two','A two'),P(3,'Q three','A three'),P(4,'Q four')]);
  t('R03: partial overlap keeps every question from both passes',m.pairs.map(p=>p.number).join(',')==='1,2,3,4'&&m.added===2&&m.filled===1&&m.pairs[1].answer==='A two'&&m.pairs[1].matched===true&&m.pairs[3].matched===false);
  m=merge([P(1,'Q one'),P(2,'Q two')],[P(3,'Q three','A three'),P(4,'Q four','A four')]);
  t('R03: disjoint results are unioned in number order',m.pairs.map(p=>p.number).join(',')==='1,2,3,4'&&m.added===2&&m.filled===0);
  m=merge([P(1,'Q one'),P(2,'Q two')],[P(2,'Q two'),P(3,'Q three')]);
  t('R03: an equal-size model result with a new question no longer discards it',m.pairs.length===3&&m.added===1);
  m=merge([P(1,'Q one','Page answer')],[P(1,'Q one','Model answer')]);
  t('R03: a matched page answer is never overwritten by the model',m.pairs[0].answer==='Page answer'&&m.filled===0);
  m=merge([P(1,'The page text of question one is long enough to compare')],[P(1,'A completely different question under the same number','A')]);
  t('R03: the page text wins a number collision, the answer is filled and the collision is counted',m.pairs[0].question.startsWith('The page text')&&m.pairs[0].answer==='A'&&m.collisions===1);
  m=merge([P(1,'Q one')],[P(1,'Q one restated slightly','A')]);
  t('R03: a paraphrase that shares its opening is not a collision',m.collisions===0&&m.filled===1);
  t('R03: empty and malformed inputs are safe',merge([],[]).pairs.length===0&&merge(null,undefined).pairs.length===0&&merge([P(1,'Q')],[null,{number:2,question:'  '}]).pairs.length===1);
  const split=span(S,'  async function runSplit(file,existingQ,signal,track){','\n  const run=useCallback(async()=>{');
  t('R03: runSplit merges through nclexMergePairs and no longer replaces the regex pairing',split.includes('const merged=nclexMergePairs(pairs,aiResult);pairs=merged.pairs;')&&!split.includes('better than regex')&&!split.includes('pairs=aiResult;'));

  /* ── R04: one halting rule for every batch scheduler ── */
  const halts=new Function(span(S,'function geminiHaltsBatch(','\nasync function callGemini(')+';return geminiHaltsBatch;')();
  const err=props=>Object.assign(Error('synthetic'),props);
  t('R04: cancellation, a deferred retry, an exhausted quota and a permanent HTTP failure halt a batch',halts(err({name:'AbortError'}))&&halts(err({retryDeferred:true,status:429}))&&halts(err({status:429,retryable:true}))&&halts(err({status:401,isFatal:true}))&&halts(err({status:403,isFatal:true})));
  t('R04: content failures without an HTTP status stay per-chunk',!halts(err({}))&&!halts(err({isFatal:true}))&&!halts(err({incomplete:true,finishReason:'MAX_TOKENS'}))&&!halts(err({status:500,retryable:true}))&&!halts(null)&&!halts(undefined));
  t('R04: every batch scheduler uses the one halting rule',count(S,'if(geminiHaltsBatch(e))throw e;')===5&&count(S,'geminiHaltsBatch(err)')===1&&count(S,'if(e.isFatal&&e.status)throw e;')===0);
  const kbBuild=span(S,'      const processJob=async job=>{','      // v17.3: chunk order, not completion order, decides fact numbering and diagnostics order.');
  t('R04: the Knowledge Base build stops scheduling and reports what was never sent',kbBuild.includes('if(geminiHaltsBatch(e))throw e;')&&kbBuild.includes('try{await kbRunLanes(queue,laneCount,processJob,controller.signal);}')&&kbBuild.includes('chunk(s) were not sent. '));
  const priority=span(S,'function PriorityAnalyzer(){','// ──── TOOL: Anki Generator ────');
  t('R04: the Priority harvest stops instead of harvesting into a closed quota window',priority.includes('if(geminiHaltsBatch(err)){publishHarvest();throw new Error(`Harvest stopped at chunk ${i+1} of ${total}; the remaining chunks were not sent. `'));
  t('R04: the NCLEX generator halts on a deferred retry as well as a permanent failure',span(S,'function NCLEXGenerator(){','function CaseStudyGenerator(){').includes('if(geminiHaltsBatch(e))throw e;'));

  /* ── R04/R05/R06 in the shipped inline runner ── */
  const NX=new Function(span(S,'function nclexKey(','const NCLEX_OPTION_GAP=')+';return {nclexKey,nclexAccumulate,nclexAdmitRecord,nclexNewTrack,nclexRunSummary,nclexSummaryLine};')();
  const chunker=new Function(span(S,'function nclexChunkText(','\n  return chunks;\n}')+'\n  return chunks;\n}\n;return nclexChunkText;')();
  const inline=span(S,'  async function runInline(file,existingQ,signal,track){','\n  // ── Split Q&A mode runner ──');
  const text=Array.from({length:12},(_,i)=>`Question ${i+1}. Synthetic stem number ${i+1} about a fictional marker. A. one B. two C. three D. four.`).join('\n\n');
  const chunks=chunker(text,300,0).length;
  async function driveInline(responses,{aborted=false}={}){
    const calls=[],published=[],track=NX.nclexNewTrack();
    const admit=(seen,allQ,records,tr)=>{NX.nclexAccumulate(seen,allQ,records,tr);published.push(allQ.length);};
    const factory=new Function('addLog','iRangeOn','iRanges','nclexExtractPageRange','extractPdfTextSpaced','nclexChunkText','chunkSize','overlap','setProgress','nclexKey','nclexCallGemini','NCLEX_INLINE_PROMPT','admit','uid','geminiHaltsBatch','_sleep','return '+inline);
    const runInline=factory(()=>{},false,[],async()=>'',async()=>text,chunker,300,0,()=>{},NX.nclexKey,async prompt=>{calls.push(prompt);const r=responses[calls.length-1];if(r instanceof Error)throw r;return r===undefined?[]:r;},'PROMPT ',admit,()=>'id-'+(calls.length+published.length),halts,async()=>{});
    let failure=null,allQ=null;
    try{allQ=await runInline({name:'synthetic.pdf'},[],{aborted},track);}catch(e){failure=e;}
    return {calls,published,track,failure,allQ};
  }
  t('R04/R06: the synthetic source yields at least three inline chunks',chunks>=3);
  const deferred=Object.assign(Error('The provider requested a wait of 120 seconds. No automatic retry was sent; wait before trying again.'),{name:'RetryDeferredError',retryDeferred:true,status:429,retryAfterMs:120000});
  let drive=await driveInline([[{question:'Q1 text'}],deferred,[{question:'Q3 text'}]]);
  t('R04: the inline runner stops at a deferred retry, keeps the first chunk and never sends the third',drive.failure===deferred&&drive.calls.length===2&&drive.published.at(-1)===1&&drive.track.attempted===2&&drive.track.succeeded===1&&drive.track.failed.length===0);
  drive.track.stopped=drive.failure.message;
  t('R06: a halted run summarizes as stopped with the provider reason in the export line',NX.nclexRunSummary(drive.track).status==='stopped'&&NX.nclexRunSummary(drive.track).exportLine.includes('Reason: The provider requested a wait of 120 seconds.'));
  drive=await driveInline([[{question:'Q1 text'}],Error('Model returned unparseable JSON (chunk skipped)'),[{question:'Q3 text'}]]);
  t('R04/R06: an ordinary chunk failure still lets the remaining chunks run and is named in the summary',!drive.failure&&drive.calls.length===chunks&&drive.allQ.length===2&&JSON.stringify(drive.track.failed)==='["Chunk 2"]'&&NX.nclexRunSummary(drive.track).status==='partial'&&NX.nclexRunSummary(drive.track).detail.includes('failed: Chunk 2'));
  drive=await driveInline([[{question:{bad:1}},{question:'Good record'},'text',null,{question:'   '}]]);
  t('R05/R06: malformed provider records are skipped, counted and sampled while valid siblings are kept',!drive.failure&&drive.allQ.length===1&&drive.allQ[0].question==='Good record'&&drive.track.malformed===4&&drive.track.samples.length===3&&NX.nclexRunSummary(drive.track).detail.includes('4 malformed records skipped'));
  drive=await driveInline(Array.from({length:chunks},()=>Error('synthetic chunk failure')));
  t('R06: every chunk failing is reported as failed, not done',!drive.failure&&NX.nclexRunSummary(drive.track).status==='failed'&&NX.nclexRunSummary(drive.track).label==='Failed');
  drive=await driveInline([[{question:'Q1 text'}]],{aborted:true});
  t('R06: an aborted signal still surfaces as AbortError for the run to record a cancel',drive.failure&&drive.failure.name==='AbortError'&&drive.calls.length===0);

  /* ── R05: typed admission ── */
  const admitRec=NX.nclexAdmitRecord;
  t('R05: a non-string or blank question is rejected, never rendered',admitRec({question:{text:'x'}})===null&&admitRec({question:['a']})===null&&admitRec({question:42})===null&&admitRec({question:'  '})===null&&admitRec('plain string')===null&&admitRec(null)===null&&admitRec([{question:'in array'}])===null);
  const rec=admitRec({question:'Which action?\nA. One\nB. Two',correct_answer:{label:'A'},rationale:['r'],priority_nursing_tip:7,test_taking_strategy:true,clinical_judgment_skill:null,diseases_conditions:'Heart failure',question_number:'12',options_repaired:true,id:'q-1',unknown:{deep:1}});
  t('R05: text fields keep strings, spell out primitives and drop objects; unknown fields are dropped',rec.question.startsWith('Which action?')&&rec.correct_answer===undefined&&rec.rationale===undefined&&rec.priority_nursing_tip==='7'&&rec.test_taking_strategy==='true'&&rec.clinical_judgment_skill===undefined&&JSON.stringify(rec.diseases_conditions)==='["Heart failure"]'&&rec.question_number===12&&rec.options_repaired===true&&rec.id==='q-1'&&!('unknown' in rec));
  const long=admitRec({question:'x'.repeat(30000),rationale:'y'.repeat(30000)});
  t('R05: every text field is bounded',long.question.length===20000&&long.rationale.length===20000);
  const track5=NX.nclexNewTrack(),kept=NX.nclexAccumulate(new Set(),[],[{question:{bad:1}},{question:'Good one'},'text',null,{question:'   '},{question:'Good one'}],track5);
  t('R05: a mixed batch keeps the valid siblings, deduplicates and counts the malformed ones',kept.length===1&&kept[0].question==='Good one'&&track5.malformed===4&&track5.samples[0]==='{"question":{"bad":1}}'&&track5.questions===1);
  t('R05: admitted records always satisfy the disease filter and the card renderer',kept.every(q=>typeof q.question==='string'&&q.question.toLowerCase().length>0&&Array.isArray(q.diseases_conditions)));
  t('R05: accumulation without a tracker keeps its old signature',NX.nclexAccumulate(new Set(),[],[{question:'Same'},{question:'Same'},{question:{bad:true}}]).length===1);
  const repair=new Function(span(S,'function nclexKey(','const NCLEX_OPTION_GAP=')+span(S,'const NCLEX_OPTION_GAP=','// Page range picker sub-component')+';return nclexRepairOptions;')();
  t('R05: option repair leaves a non-string question alone instead of throwing',(()=>{const item={question:{bad:1},question_number:1};try{return repair(item,'1. Q\nA. x\nB. y')===item;}catch(e){return false;}})());

  /* ── R06: run summary statuses ── */
  const sum=NX.nclexRunSummary;
  t('R06: every request succeeding is complete',sum({attempted:3,succeeded:3,failed:[],malformed:0}).status==='complete');
  t('R06: a swallowed chunk failure makes the run incomplete and names the chunk',(()=>{const s=sum({attempted:3,succeeded:2,failed:['Chunk 2']});return s.status==='partial'&&s.label==='Incomplete'&&s.detail.includes('2 of 3 extraction requests succeeded')&&s.detail.includes('failed: Chunk 2');})());
  t('R06: every request failing is failed, not done',sum({attempted:2,succeeded:0,failed:['Chunk 1','Chunk 2']}).status==='failed');
  t('R06: a cancel after a success is cancelled and says what was not sent',(()=>{const s=sum({attempted:1,succeeded:1,failed:[],cancelled:true});return s.status==='cancelled'&&s.detail.includes('cancelled before the remaining requests were sent');})());
  t('R06: a successful run that found no questions is complete, distinct from a failed request',sum({attempted:1,succeeded:1,failed:[],questions:0}).status==='complete');
  t('R06: a halted run is stopped and only the export line carries the provider reason',(()=>{const s=sum({attempted:2,succeeded:1,failed:[],stopped:'The provider requested a wait of 120 seconds.'});return s.status==='stopped'&&s.exportLine.includes('Reason: The provider requested a wait of 120 seconds.')&&!s.detail.includes('Reason:');})());
  t('R06: malformed records and notes are reported',(()=>{const s=sum({attempted:1,succeeded:1,failed:[],malformed:2,notes:['AI pairing failed: synthetic']});return s.detail.includes('2 malformed records skipped')&&s.detail.includes('AI pairing failed: synthetic');})());
  t('R06: no request at all is "Nothing extracted"',sum(NX.nclexNewTrack()).status==='empty'&&NX.nclexSummaryLine(sum(NX.nclexNewTrack())).startsWith('Extraction status: Nothing extracted')&&NX.nclexSummaryLine(null)==='');
  const extractor=span(S,'function NCLEXExtractor(){','// ──── TOOL: NCLEX Question Generator ────');
  t('R06: the results view and both export builders carry the run summary',extractor.includes("{runSummary&&runSummary.status!=='complete'&&!isProcessing&&<div")&&count(extractor,'nclexSummaryLine(runSummary)')===2&&extractor.includes("if(e.name==='AbortError'){track.cancelled=true;setRunSummary(nclexRunSummary(track));")&&extractor.includes('track.stopped=e.message;setRunSummary(nclexRunSummary(track));'));
  t('R06: split mode counts batches and notes a pairing failure or an empty page range',extractor.includes('track.failed.push(`Batch ${i+1}`)')&&extractor.includes("track.notes.push('AI pairing failed: '+e.message)")&&extractor.includes("track.notes.push('no numbered questions were detected in the page ranges')"));

  /* ── R07: a factless Knowledge Base is refused before the deck is cleared ── */
  const usable=new Function(span(S,'function kbUsableFactCount(','function kbForAnki(')+';return kbUsableFactCount;')();
  t('R07: usable facts are counted across conditions and blank facts are ignored',usable(null)===0&&usable({conditions:[]})===0&&usable({conditions:[{name:'Empty',facts:[]}]})===0&&usable({conditions:[{name:'A',facts:[{text:'  '},null,{text:'Real'}]},{name:'B',facts:[{text:'Also'}]}]})===2);
  const anki=span(S,'function AnkiGenerator(){','// ──── TOOL: NCLEX Extractor ────');
  const runStart=anki.indexOf('  const run=useCallback(async()=>{'),guard=anki.indexOf('if(!kbUsableFactCount(K.knowledgeBase)){log(',runStart),clear=anki.indexOf('setCards([]);',runStart),packet=anki.indexOf('kbForAnki(K.knowledgeBase)',runStart);
  t('R07: the Anki run refuses a factless Knowledge Base before clearing the deck or building a packet',runStart>=0&&guard>runStart&&clear>guard&&packet>guard&&anki.slice(guard,guard+400).includes('nothing was sent to the model'));

  /* ── R09: Priority keeps streamed text after a failure ── */
  t('R09: Priority keeps streamed text after any failure and labels it incomplete',priority.includes("owned_setStep(gotOutput?'results':'error');")&&!priority.includes("owned_setStep(cancelled&&gotOutput?'results':'error');")&&priority.includes('<strong>Incomplete analysis:</strong> {error}'));

  /* ── R10: overlap can be zero ── */
  const overlap=new Function(span(S,'function paParseOverlap(','function paChunkText(')+';return paParseOverlap;')();
  t('R10: zero overlap is accepted; blank and non-numeric restore the default; bounds hold',overlap('0')===0&&overlap(0)===0&&overlap('')===1500&&overlap('abc')===1500&&overlap('-5')===0&&overlap('99999')===5000&&overlap('750')===750&&overlap('12.9')===12);
  t('R10: the overlap input uses the parser',S.includes('onChange={e=>setOverlapSize(paParseOverlap(e.target.value))}')&&!S.includes('parseInt(e.target.value)||1500'));

  /* ── R11: the browser fixture releases its server on every failure path ── */
  const runner=require('./remediation-browser-tests');
  async function closes(browser){
    const orig=http.Server.prototype.close;let n=0;http.Server.prototype.close=function(...args){n++;return orig.apply(this,args);};
    let failure=null;try{await runner.withFixture(browser,{},async()=>{});}catch(e){failure=e;}finally{http.Server.prototype.close=orig;}
    return {n,failure};
  }
  let r=await closes({newContext:async()=>{throw Error('synthetic context failure');}});
  t('R11: a failed browser context still closes the fixture server',r.n===1&&/synthetic context failure/.test(r.failure&&r.failure.message));
  r=await closes({newContext:async()=>({route(){throw Error('synthetic route failure');},addInitScript(){},on(){},newPage(){},close:async()=>{throw Error('synthetic close failure');}})});
  t('R11: a rejected context close still closes the fixture server and reports the original failure',r.n===1&&/synthetic route failure/.test(r.failure&&r.failure.message));

  /* ── R12: README provenance wording ── */
  const readme=fs.readFileSync(path.join(__dirname,'..','README.md'),'utf8');
  t('R12: the README describes provenance as file plus page or slide range with a quote check',!readme.includes('traceable back to the exact page it came from')&&readme.includes('page or slide range'));

  /* ── dependency pin ── */
  t('DOMPurify 3.4.16 is pinned on both CDNs with one verified hash and no 3.4.15 remains',count(S,'dompurify/3.4.16/purify.min.js" integrity="sha384-a7SzOxErzJ3ZpQz0zJ32d67dSitNzPcbfybc/ykU9KJhMgZkwqfSxlhhdJRS+XGL"')===1&&count(S,'dompurify@3.4.16/dist/purify.min.js" integrity="sha384-a7SzOxErzJ3ZpQz0zJ32d67dSitNzPcbfybc/ykU9KJhMgZkwqfSxlhhdJRS+XGL"')===1&&count(S,'3.4.15')===0);
}

module.exports=run;
