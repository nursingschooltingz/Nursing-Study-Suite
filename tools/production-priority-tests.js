'use strict';
const assert=require('node:assert/strict');
const {syntheticKB}=require('./remediation-browser-fixture');
module.exports=async function productionPriorityTests(S,t){
  const span=(a,b)=>{assert.equal(S.split(a).length,2,'Unique extraction start '+a);const i=S.indexOf(a),j=S.indexOf(b,i+a.length);assert(j>i,'Missing extraction end '+b);return S.slice(i,j);};
  const createOperationSlot=new Function(span('function createOperationSlot(){','function cardCurrentEntries(')+';return createOperationSlot;')();
  const sourceHelpers=new Function('buildFactIndex',span('function artifactSourceSnapshot(','function artifactExportNotice(')+';return {artifactSourceSnapshot,artifactSourceCurrent};')(()=>new Map());
  const P=new Function('kbSourceText','artifactSourceCurrent',span('function kbForPriority(','function PriorityAnalyzer(){')+';return {kbForPriority,paResultNotice};')(()=>'',sourceHelpers.artifactSourceCurrent);
  const runSource=span('  async function runAnalysis(){','\n  const resultNotice=');
  const {geminiHaltsBatch}=new Function(span('function geminiHaltsBatch(','\nasync function callGemini(')+';return {geminiHaltsBatch};')(); // v17.4: the harvest catch consults the shared halting rule
  const effectSource=span('    if(analysisSlot.current.active&&analysisSource.current!==K.knowledgeBase){','\n  },[K.knowledgeBase]);');
  const A=syntheticKB('A'),B=syntheticKB('B');
  function fixture({query='',chunks,call}={}){
    const out={output:'',error:'',step:'idle',calls:[],harvest:null,busy:false};let activeKB=A;
    const set=(key,value)=>{out[key]=typeof value==='function'?value(out[key]):value;};
    const env={cfg:{apiKey:'synthetic',forTool:id=>({model:id,level:'low'})},K:{knowledgeBase:A,isCurrentSource:kb=>kb===activeKB},analysisSlot:{current:createOperationSlot()},analysisSource:{current:null},
      kbTiers:[1,2,3],kbConditionFilter:query,chunkSize:12000,overlapSize:1500,context:'',...sourceHelpers,...P,geminiHaltsBatch,
      paChunkText:text=>chunks||[text],paBuildExtractPrompt:text=>'HARVEST:'+text,paBuildSynthPrompt:rows=>'SYNTHESIZE:'+rows.join('\n'),paParseTiers:text=>({tier1:text}),
      setAnalysisBusy:value=>set('busy',value),setResultSource:value=>set('source',value),setHarvestState:value=>set('harvest',value),setStep:value=>set('step',value),setError:value=>set('error',value),setOutput:value=>set('output',value),
      setAbortController(){},setIsStreaming(){},setProgress(){},setPhase(){},setParsedTiers(){},setMeta:value=>set('meta',value),setChunks(){}};
    env.callGemini=async(...args)=>{out.calls.push(args);return call?call(out.calls.length,args):'Synthetic result';};
    const run=new Function('env','with(env){'+runSource+';return runAnalysis;}')(env);
    const replace=(flushEffect=true)=>{activeKB=B;env.K={knowledgeBase:B,isCurrentSource:kb=>kb===activeKB};if(flushEffect)new Function('env','with(env){'+effectSource+'}')(env);};
    return {run,replace,out,env,notice:()=>P.paResultNotice({source:out.source,activeKB,harvest:out.harvest,meta:out.meta,error:out.error,busy:out.busy})};
  }
  t('Priority packet is empty for a zero-match condition',P.kbForPriority(A,{conditionQuery:'absent'})==='');
  t('Priority packet is empty for a zero-match tier',P.kbForPriority(A,{tiers:[3]})==='');
  t('Priority alias selection keeps the fact packet',P.kbForPriority({...A,conditions:[{...A.conditions[0],aliases:['alternate']}]},{conditionQuery:'alternate'}).includes('Fictional marker A'));
  let h=fixture({query:'absent'});await h.run();
  t('Priority empty selection makes no model request',h.out.calls.length===0);
  t('Priority empty selection presents an actionable error',h.out.step==='error'&&/no facts/.test(h.out.error));
  h=fixture({call:async()=>{throw Error('Synthetic outage');}});await h.run();
  t('Priority all-failed harvest never invokes synthesis',h.out.calls.length===1&&h.out.step==='error');
  t('Priority all-failed harvest retains separate failure metadata',h.out.harvest.failed.length===1&&h.out.harvest.successful===0&&/No source chunks/.test(h.out.error));
  h=fixture({call:async()=>''});await h.run();
  t('Priority empty model text is not usable harvest evidence',h.out.calls.length===1&&h.out.harvest.failed.length===1);
  h=fixture({chunks:['one','two'],call:async(n,args)=>{if(n===1)throw Error('Synthetic outage');if(n===2){args[3].onMeta({truncated:true});return 'Usable partial evidence';}return 'Partial guide';}});await h.run();
  t('Priority partial success synthesizes only usable harvest text',h.out.calls.length===3&&h.out.calls[2][2][0].text==='SYNTHESIZE:Usable partial evidence');
  t('Priority failed and truncated chunk identities are preserved',h.out.harvest.failed[0].chunk===1&&h.out.harvest.truncated[0]===2);
  t('Priority retained notice discloses partial source coverage',/1 of 2/.test(h.notice())&&/Missing source chunks: 1/.test(h.notice())&&/Truncated source chunks: 2/.test(h.notice()));
  // v17.4: a deferred retry on a harvest chunk stops the run; the next chunk is never sent (R04).
  const deferredRetry=Object.assign(Error('The provider requested a wait of 120 seconds. No automatic retry was sent; wait before trying again.'),{name:'RetryDeferredError',retryDeferred:true,status:429,retryAfterMs:120000});
  h=fixture({chunks:['one','two'],call:async n=>{if(n===1)throw deferredRetry;return 'Never reached';}});await h.run();
  t('Priority deferred retry stops the harvest before the next chunk is sent',h.out.calls.length===1&&h.out.step==='error'&&/Harvest stopped at chunk 1 of 2/.test(h.out.error)&&/wait of 120 seconds/.test(h.out.error)&&h.out.harvest.failed.length===1&&h.out.harvest.successful===0);
  // v17.4: streamed synthesis text survives a failure and is labelled incomplete (R09).
  h=fixture({call:async(n,args)=>{if(n===1)return 'Captured A';args[3].onUpdate('Streamed before failure');throw Error('Synthetic timeout');}});await h.run();
  t('Priority keeps streamed text after a synthesis failure and labels it incomplete',h.out.step==='results'&&h.out.output==='Streamed before failure'&&h.out.error==='Synthetic timeout'&&/Analysis status: Synthetic timeout/.test(h.notice()));
  h=fixture({call:async(n,args)=>{if(n===1)return 'Captured A';throw Error('Synthetic timeout');}});await h.run();
  t('Priority synthesis failure with no streamed text still shows the error view',h.out.step==='error'&&h.out.error==='Synthetic timeout');
  let release;h=fixture({call:async(n)=>n===1?new Promise(r=>{release=r;}):'Should not synthesize'});
  let pending=h.run();h.replace();release('Old source evidence');await pending;
  t('Priority source replacement aborts the old harvest',h.out.calls[0][3].signal.aborted);
  t('Priority source replacement prevents obsolete synthesis and publication',h.out.calls.length===1&&h.out.output==='');
  t('Priority replacement releases busy state and presents source stop',!h.out.busy&&h.out.step==='error'&&/Knowledge Base changed/.test(h.out.error));
  let resolveSynthesis;h=fixture({call:async(n,args)=>{if(n===1)return 'Captured A';args[3].onUpdate('Retained partial A');return new Promise(r=>{resolveSynthesis=r;});}});
  pending=h.run();while(!resolveSynthesis)await Promise.resolve();h.replace();resolveSynthesis('Late obsolete A');await pending;
  t('Priority late synthesis cannot replace retained streamed text',h.out.output==='Retained partial A');
  t('Priority retained output labels its earlier captured source',/Source: earlier Knowledge Base/.test(h.notice()));
  t('Priority replacement aborts synthesis transport',h.out.calls[1][3].signal.aborted);
  h=fixture({call:async(n)=>n===1?new Promise(r=>{release=r;}):'Should not synthesize'});
  pending=h.run();h.replace(false);release('Late harvest before effect');await pending;
  t('Priority harvest completion before the source effect still exits processing with a stop reason',h.out.step==='error'&&!h.out.busy&&/earlier analysis was stopped/.test(h.out.error)&&h.out.calls.length===1);
  resolveSynthesis=null;h=fixture({call:async(n,args)=>{if(n===1)return 'Captured A';args[3].onUpdate('Retained A before effect');return new Promise(r=>{resolveSynthesis=r;});}});
  pending=h.run();while(!resolveSynthesis)await Promise.resolve();h.replace(false);resolveSynthesis('Late synthesis before effect');await pending;
  t('Priority synthesis completion before the source effect cannot imply complete output',h.out.output==='Retained A before effect'&&!h.out.busy&&/earlier analysis was stopped/.test(h.notice()));
  h=fixture();await h.run();
  t('Priority successful control publishes and releases its operation',h.out.output==='Synthetic result'&&h.out.step==='results'&&!h.out.busy&&!h.env.analysisSlot.current.active);
  t('Priority successful control has no incomplete notice',h.notice()==='');
  h.replace();t('Priority completed output remains available with earlier-source notice',h.out.output==='Synthetic result'&&/earlier Knowledge Base/.test(h.notice()));
  h.env.setMeta({truncated:true});
  new Function('env','with(env){'+span('  const resetAll=()=>{analysisSlot.current.cancel();','\n\n  const tiers=parsedTiers;')+';resetAll();}')(h.env);
  t('Priority reset clears prior source, completeness and truncation notices',h.out.step==='idle'&&h.out.meta===null&&h.out.harvest===null&&h.out.source===null&&h.notice()==='');
  t('Priority export notice also preserves truncated synthesis',/output was truncated/.test(P.paResultNotice({meta:{truncated:true}})));
  t('Priority in-progress export cannot appear complete',/still in progress/.test(P.paResultNotice({busy:true})));
  const copyStart=S.indexOf('  const copyOutput=()=>copyText(exportOutput);'),copyEnd=S.indexOf('  const resetAll=',copyStart);
  assert(copyStart>0&&copyEnd>copyStart,'Priority export closure tail');
  const copied=[],downloaded=[];
  const handlers=new Function('copyText','exportAsMd','exportOutput',S.slice(copyStart,copyEnd)+';return {copyOutput,downloadMd};')(x=>copied.push(x),(text,name)=>downloaded.push({text,name}),'Earlier source notice\nGuide');
  handlers.copyOutput();handlers.downloadMd();
  t('Priority Copy and Markdown export include the retained notice',copied[0]==='Earlier source notice\nGuide'&&downloaded[0].text===copied[0]);
  t('Priority text and print export use the same noticed output',S.includes("exportAsTxt(exportOutput,'priority-analysis.txt')")&&S.includes("exportAsPdf(exportOutput,'Pyramid Priority Analysis','LATTE Knowledge Base')"));
  const N=new Function(span('function kbSlug(','// v15.14: the class kept ASCII')+span('const KB_IMPORT_MAX_BYTES=','// ── Durable Knowledge Base persistence')+';return kbNormalizeImported;')();
  const restored=N(syntheticKB('A'),{restore:true});
  t('browser synthetic KB satisfies the actual saved-state normalizer',restored.kb.conditions[0].facts[0].text==='Fictional marker A is present.'&&Array.isArray(restored.kb.sources));
  t('Priority extraction reaches notice tail and restored fixture remains usable',typeof P.paResultNotice==='function'&&restored.kb.conditions.length===1);
};
