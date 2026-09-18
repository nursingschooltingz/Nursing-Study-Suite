'use strict';
const fs=require('fs');
function extract(source){
  const span=(a,b)=>{if(source.split(a).length!==2)throw Error('Correctness start anchor must be unique: '+a);const x=source.indexOf(a),y=source.indexOf(b,x+a.length);if(y<0)throw Error('Correctness end anchor missing: '+b);return source.slice(x,y);};
  const C=new Function(span('const CASE_CLINICAL_TOKEN_RE=','// Every distinct fact id referenced anywhere in the case')+';return {caseParseThreshold,caseAuditTextValues,validateCaseStudy};')();
  const N=new Function(span('function nclexChunkText(','// Split-mode: extract text')+span('const NCLEX_OPTION_GAP=','// Page range picker sub-component')+';return {nclexChunkText,nclexSplitStemOptions,nclexRepairOptions};')();
  const card=new Function('cardIsImage','cardFileId',span('function createOperationSlot(){','function KnowledgeBaseBuilder(){')+span('function cardKey(','// Compact, inspectable fact rows')+';return {cardCurrentEntries,cardPublishTranscript,cardIdentityConflict,cardKey,cardMergeFaces,cardChunkBlockers};')(()=>true,f=>f.name);
  return {C,N,card,span};
}
async function runTests(source,t){
  const {C,N,card,span}=extract(source);
  for(const [name,end] of [['addFiles','  const importJSON='],['addPdfs','\n\n  // Auto-detect page count']]){
    let pending;
    const add=new Function('setFiles',span('  const '+name+'=fl=>',end)+';return '+name+';')(fn=>{pending=fn;});
    const selectedFile={name:'synthetic.pdf',type:'application/pdf',size:7,lastModified:1};
    const rejectedFile={name:'synthetic.txt',type:'text/plain',size:8,lastModified:2};
    const liveList={0:selectedFile,1:rejectedFile,length:2};
    add(liveList);delete liveList[0];delete liveList[1];liveList.length=0;
    const added=pending([]);
    t(name+' captures selected files before event FileList expires',added.length===1&&added[0]===selectedFile);
    add([selectedFile]);
    t(name+' still filters unsupported files and deduplicates existing selections',pending(added).length===1);
  }
  const audit=(output,support,kind='instantiated')=>{const issues=[];C.caseAuditTextValues(output,['fact-1'],new Map([['fact-1',{fact:{text:support,sourceQuote:''}}]]),'Synthetic',issues,kind);return issues;};
  for(const suffix of ['mg/(kg min)','mg²','mg·kg','mg * kg','mg^','mg%','mg5']){
    t('instantiation cannot borrow threshold unit prefix '+suffix,audit('4 mg','Below 5 '+suffix+'.').some(i=>i.sev==='error'));
    t('range threshold cannot borrow unsupported unit prefix '+suffix,C.caseParseThreshold('Between 3-5 '+suffix+'.')===null);
  }
  t('complete supported threshold retains instantiation',audit('4 mg','Below 5 mg.').length===0);
  t('supported compound threshold retains complete denominator',audit('4 mcg/kg/min','Below 5 mcg / kg / min.').length===0);
  t('dimensionless pH range remains available',C.caseParseThreshold('Normal pH 7.35–7.45.').unit==='');
  t('an arithmetic factor after a complete unit is not a compound unit',C.caseParseThreshold('Below 5 mg × 2 doses.').unit==='mg');
  const deteriorated=audit('8 mg','Below 5 mg.');
  t('outside-threshold deterioration remains warning-only',deteriorated.some(i=>i.sev==='warn')&&!deteriorated.some(i=>i.sev==='error'));
  const cs={condition:'Synthetic',stages:[{stageNumber:1,data:[{label:'Rate',value:'4 mg',supportType:'instantiated',availability:'revealed',factIds:['fact-1']}],questions:[]}]};
  t('whole case rejects instantiated quantity with incompatible source unit',C.validateCaseStudy(cs,new Map([['fact-1',{fact:{text:'Below 5 mg/(kg min).',sourceQuote:''}}]]),new Set(['fact-1']),'Synthetic').some(i=>i.sev==='error'&&i.msg.includes('no parseable threshold')));

  const unique=Array.from({length:6500},(_,i)=>String.fromCharCode(0x1000+i));unique[1600]='\n';unique[3100]='\n';unique[5200]='\n';
  const text=unique.join('');
  for(const [size,overlap] of [[3000,800],[3000,0],[500,499],[500,1000],[0,800],[3000,2800]]){
    const chunks=N.nclexChunkText(text,size,overlap),covered=new Uint8Array(text.length);
    for(const chunk of chunks){const at=text.indexOf(chunk);if(at<0)throw Error('Chunk is not an exact source substring');covered.fill(1,at,at+chunk.length);}
    t('chunk source coverage has no gaps for '+size+'/'+overlap,covered.every(Boolean));
    t('chunker terminates with positive bounded chunks for '+size+'/'+overlap,chunks.length>0&&chunks.length<1000&&chunks.every(c=>c.length>0&&c.length<=Math.max(500,size)));
  }
  t('newline at the size boundary cannot make an oversized chunk',N.nclexChunkText('a'.repeat(3000)+'\n'+'b'.repeat(1000),3000,800).every(c=>c.length<=3000));
  t('empty inline source creates no chunks',N.nclexChunkText('',3000,800).length===0);
  const stem='Select all that apply.',letters='ABCDEF',question=stem+'\n'+[...letters].map((label,i)=>label+'. Choice '+(i+1)).join('\n');
  for(const value of [question,question.toLowerCase()]){
    const parsed=N.nclexSplitStemOptions(value);
    t('six lettered options retain independent labels '+value[0],parsed.options.length===6&&parsed.options[5].label.toUpperCase()==='F'&&parsed.options[4].text.toLowerCase()==='choice 5');
  }
  const repaired=N.nclexRepairOptions({question:stem},question);
  t('split repair retains the sixth option verbatim',repaired.options_repaired&&N.nclexSplitStemOptions(repaired.question).options[5].text==='Choice 6');
  const filtered=[{question,correct_answer:'F',rationale:'Synthetic rationale.'}];
  const md=new Function('filtered','nclexSplitStemOptions',span('  const nclexToMd=()=>{','  const exportMd=')+';return nclexToMd();')(filtered,N.nclexSplitStemOptions);
  t('Markdown export has a separate sixth choice',md.includes('\nF. Choice 6\n')&&!md.includes('Choice 5 F.'));
  let txt;
  new Function('filtered','nclexQText','downloadBlob','Blob',span('  const exportTxt=()=>{','\n\n  const nclexToMd=')+';exportTxt();')(filtered,q=>{const p=N.nclexSplitStemOptions(q.question);return p.stem+'\n'+p.options.map(o=>'   '+o.label+'. '+o.text).join('\n');},blob=>{txt=blob;},Blob);
  t('TXT export has a separate sixth choice',(await txt.text()).includes('\n   F. Choice 6\n'));

  const file={name:'synthetic-card.png'},old={file:file.name,transcript:{face:'front',title:'Synthetic',category:'Synthetic',cardNumber:'1',sections:[],numerics:[],overallLegibility:'clean'},runs:[{kind:'old successful run'}],agreement:null,comparisonIncomplete:false};
  let transcripts={[file.name]:old},error='',calls=0;
  const transcribeSource=span('  const transcribeCards=async()=>{','  // v15.14: tag each transcript');
  const bind=impl=>new Function('files','cardIsImage','cfg','txAbortRef','setTxBusy','setTxErr','setTxReviewed','addLog','txRuns','cardTranscribe','cardFileId','cardCompareRuns','cardKey','setTranscripts','cardPublishTranscript','currentFiles',transcribeSource+';return transcribeCards;')([file],()=>true,{apiKey:'synthetic',forTool:()=>({model:'mock',level:'low'})},{current:null},()=>{},v=>{error=v;},()=>{},()=>{},2,impl,f=>f.name,()=>({runs:2,numericsUnstable:[],bulletsUnstable:[],facesDisagree:false,idsDisagree:false}),card.cardKey,fn=>{transcripts=fn(transcripts);},card.cardPublishTranscript,{current:[file]});
  const fail=bind(async()=>{calls++;throw Error('Synthetic unavailable');});await fail();
  const failed=transcripts[file.name];
  t('failed retranscription publishes each requested failed attempt',calls===2&&failed.runs.length===0&&failed.requestedRuns===2);
  t('failed retranscription preserves prior evidence for inspection',failed.retainedTranscript===old&&failed.transcript===old.transcript);
  t('failed requested comparison blocks current transcript',failed.comparisonIncomplete&&card.cardIdentityConflict(failed));
  const merged=card.cardMergeFaces([failed.transcript])[0];
  t('failed retranscription reaches the actual card build blocker',card.cardChunkBlockers(merged,card.cardIdentityConflict(failed)?1:0).length>0);
  t('failed retranscription appears outside the shared log',error.includes('Synthetic unavailable')&&error.includes('blocked'));
  await fail();
  t('repeated failed attempts retain original successful evidence without nested copies',transcripts[file.name].retainedTranscript===old);
  await bind(async()=>old.transcript)();
  t('completed successful comparison clears failed current state',!transcripts[file.name].comparisonIncomplete&&!card.cardIdentityConflict(transcripts[file.name])&&error==='');

  const fallbackKey='latte_knowledge_snapshot_v2',legacyKey='latte_knowledge_base_v1';
  const persistenceCode=span("const KB_META_KEY='active-save-v2'",'\nfunction validateLatteKnowledgeBase');
  const storageFixture=(rows={},denied=false)=>{
    const data=new Map(Object.entries(rows)),events=[];
    const localStorage={getItem:key=>{if(denied)throw Error('Synthetic denied read');return data.get(key)??null;},setItem:(key,value)=>{events.push({kind:'write',key,value});data.set(key,value);},removeItem:key=>{events.push({kind:'remove',key});data.delete(key);}};
    const P=new Function('localStorage','kbOpenDB',persistenceCode+';return {kbReadFallbacks,kbReconcileStored,kbCaptureFallbacks,kbClearFallbacks,kbCreateSaveQueue,kbArchiveRecovery};')(localStorage,async()=>{throw Error('Synthetic unavailable IndexedDB archive');});
    return{P,data,events};
  };
  const goodKB={metadata:{course:'Synthetic',exam:'',schemaVersion:'1.1',createdAt:'2026-09-18'},sources:[],conditions:[{id:'synthetic',name:'Synthetic',aliases:[],facts:[{id:'fact-1',text:'Synthetic finding.',tier:1,latteBucket:'Look',sourceQuote:'Synthetic finding.',sources:[]}]}],medications:[],diagnostics:[],scoringTools:[],formulas:[],contradictions:[]};
  const durable={kb:goodKB},raw='{bad synthetic JSON\n  preserve exact bytes\n';
  let store=storageFixture({[fallbackKey]:raw,[legacyKey]:JSON.stringify(goodKB)});
  let read=store.P.kbReadFallbacks(),reconciled=store.P.kbReconcileStored([durable,...read]);
  t('damaged fallback retains exact raw bytes and key',read.some(r=>r.recoveryError&&r.raw===raw&&r.storageKey===fallbackKey));
  t('healthy durable copy remains a recovery choice beside damaged fallback',reconciled.choices.some(r=>r.kb===goodKB)&&reconciled.choices.some(r=>r.raw===raw));
  t('identical healthy fallback does not duplicate the durable choice',reconciled.choices.length===2);
  t('raw failed copy cannot reconcile as an empty tombstone',store.P.kbReconcileStored([{kb:null,meta:{writer:'synthetic',sequence:1,bytes:'null',deleted:true}},...read]).choices.some(r=>r.recoveryError));
  store=storageFixture({[fallbackKey]:JSON.stringify({kb:goodKB,meta:{bytes:'mismatch'}})});
  t('invalid fallback metadata stays raw recovery evidence',store.P.kbReadFallbacks()[0].recoveryError.includes('metadata')&&store.P.kbReadFallbacks()[0].raw===store.data.get(fallbackKey));
  const normalizer=new Function(span('function kbSlug(','// v15.14: the class kept ASCII')+span('const KB_IMPORT_MAX_BYTES=','// ── Durable Knowledge Base persistence')+';return kbNormalizeImported;')();
  const hydrateSource=span('    (async()=>{\n      try{\n        let durable=null,unavailable=false;',';return()=>{alive=false;mounted.current=false;};');
  const hydrate=new Function('kbLoadPersisted','kbReconcileStored','kbReadFallbacks','saveQueue','kbCaptureFallbacks','kbMutation','started','kbNormalizeImported','EMPTY_LATTE_KB','currentKnowledge','publishKnowledgeBase','setPersistenceStatus','setPersistenceError','setRecoveryChoices','setHydrated','alive','return '+hydrateSource+';');
  async function hydrateFixture(store){
    const state={choices:[],hydrated:false,status:[],errors:[],published:[],head:null,captured:null};
    await hydrate(async()=>durable,store.P.kbReconcileStored,store.P.kbReadFallbacks,{current:{setHead:(head,captured)=>{state.head=head;state.captured=captured;}}},store.P.kbCaptureFallbacks,{current:0},0,normalizer,{conditions:[]},{current:{conditions:[]}},x=>state.published.push(x),x=>state.status.push(x),x=>state.errors.push(x),x=>{state.choices=x;},x=>{state.hydrated=x;},true);
    return state;
  }
  store=storageFixture({[fallbackKey]:raw});const hydrated=await hydrateFixture(store);
  t('actual hydration completes into paused recovery after corrupt fallback',hydrated.hydrated&&hydrated.status.includes('conflict')&&hydrated.choices.length===2);
  t('save queue retains durable head and exact fallback snapshot',hydrated.head===durable&&hydrated.captured[fallbackKey]===raw&&!hydrated.captured[fallbackKey].kb);
  const recoverySource=span('  const chooseRecovery=useCallback(async index=>{','\n\n  // cfg.thinkingLevel');
  function chooser(state,archive){
    const result={published:[],errors:[],choices:[],archives:[],events:[]};
    const choose=new Function('useCallback','recoveryChoices','kbMutation','kbArchiveRecovery','mounted','kbNormalizeImported','EMPTY_LATTE_KB','setRecoveryChoices','setKnowledgeBase','setPersistenceError','currentKnowledge',recoverySource+';return chooseRecovery;')(fn=>fn,state.choices,{current:0},async records=>{result.events.push('archive');result.archives.push(records);if(archive)await archive(records);},{current:true},normalizer,{conditions:[]},x=>result.choices.push(x),x=>{result.events.push('publish');result.published.push(x);},x=>result.errors.push(x),{current:goodKB});
    return{choose,result};
  }
  let recovery=chooser(hydrated,store.P.kbArchiveRecovery);await recovery.choose(0);
  t('choosing readable durable copy archives every raw and valid copy first',recovery.result.events.join(',')==='archive,publish'&&recovery.result.archives[0].length===2&&recovery.result.published[0].conditions[0].facts[0].text==='Synthetic finding.');
  t('actual archive preserves raw damaged bytes before recovery resumes',store.events.some(e=>e.kind==='write'&&e.key.startsWith('latte_recovery-')&&JSON.parse(e.value).some(r=>r.raw===raw)));
  let expected;
  const queue=store.P.kbCreateSaveQueue({write:async(record,head)=>{expected=head;},remove:async()=>{},writeFallback:()=>{throw Error('Unexpected fallback');},captureFallbacks:store.P.kbCaptureFallbacks,clearFallbacks:store.P.kbClearFallbacks,writer:'synthetic'});
  queue.setHead(hydrated.head,hydrated.captured);await queue.save(recovery.result.published[0]);
  t('recovery save compares durable identity without treating raw envelope as head',expected===durable&&!store.data.has(fallbackKey));
  t('clearing accepted fallback leaves the archived raw recovery copy intact',[...store.data.keys()].some(k=>k.startsWith('latte_recovery-')));
  recovery=chooser(hydrated);await recovery.choose(1);
  t('raw failed recovery copy cannot be published as an empty KB',recovery.result.published.length===0&&recovery.result.archives.length===0&&recovery.result.errors.some(e=>e.includes('cannot be restored directly')));
  recovery=chooser(hydrated,async()=>{throw Error('Synthetic archive quota');});await recovery.choose(-1);
  t('failed recovery archive preserves choices and blocks replacement',recovery.result.published.length===0&&recovery.result.choices.length===0&&recovery.result.errors.some(e=>e.includes('archive quota')));
  const denied=await hydrateFixture(storageFixture({},true));
  t('read-access failure completes hydration with visible paused recovery',denied.hydrated&&denied.status.includes('conflict')&&denied.choices.some(r=>r.unavailable&&r.recoveryError.includes('reload')));
  recovery=chooser(denied);await recovery.choose(-1);
  t('unavailable bytes require restored access and reload before overwrite',recovery.result.archives.length===0&&recovery.result.published.length===0&&recovery.result.errors.some(e=>e.includes('reload')));
  const exportAt=source.indexOf('onClick={()=>downloadBlob(new Blob([record.raw]'),exportEnd=source.indexOf('}>Export raw copy',exportAt);
  if(exportAt<0||exportEnd<0)throw Error('Raw recovery export handler missing');
  let rawBlob;new Function('record','index','downloadBlob','Blob','return '+source.slice(exportAt+'onClick={'.length,exportEnd)+';')({raw},0,b=>{rawBlob=b;},Blob)();
  t('raw recovery download preserves damaged bytes exactly',(await rawBlob.text())===raw);
  t('correctness extraction reaches live card helper tail',typeof card.cardChunkBlockers==='function'&&N.nclexSplitStemOptions('No choices').options.length===0);
}
module.exports={runTests};
if(require.main===module){
  const {resolveSuiteFile}=require('./repo-checks');const source=fs.readFileSync(resolveSuiteFile({rootDir:process.cwd()}),'utf8');let count=0;
  runTests(source,(name,ok)=>{if(!ok)throw Error(name);count++;}).then(()=>console.log(count+' production correctness assertions passed')).catch(e=>{console.error(e);process.exitCode=1;});
}
