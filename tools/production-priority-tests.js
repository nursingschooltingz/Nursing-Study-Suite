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
  // v17.7: split-synthesis helpers sit between paParseTiers and kbForPriority; each copy binds the tier parser it is given.
  // The span ends on the helpers' leading comment, so the return must start on a new line.
  const parseTiers=new Function(span('function paParseTiers(','\nconst PA_SYNTH_PART_CHARS=')+'\n;return paParseTiers;')();
  assert.equal(typeof parseTiers,'function','paParseTiers extraction');
  const helperSource=span('const PA_SYNTH_PART_CHARS=','function kbForPriority(');
  const splitHelpers=tierParser=>new Function('paParseTiers',helperSource+';return {PA_SYNTH_PART_CHARS,paSynthGroups,paMergeTopics,paMergeAudits,paMergeSynthesis};')(tierParser);
  const H=splitHelpers(parseTiers),stubTiers=text=>({tier1:text});
  const C=new Function(span('function paChunkText(','// STAGE 1')+'\n;return {paChunkText,paChunkJoins};')();
  const A=syntheticKB('A'),B=syntheticKB('B');
  function fixture({query='',chunks,call,groupLimit,realTiers=false}={}){
    const out={output:'',error:'',step:'idle',calls:[],harvest:null,busy:false};let activeKB=A;
    const set=(key,value)=>{out[key]=typeof value==='function'?value(out[key]):value;};
    const tiers=realTiers?parseTiers:stubTiers,split=splitHelpers(tiers);
    const env={cfg:{apiKey:'synthetic',forTool:id=>({model:id,level:'low'})},K:{knowledgeBase:A,isCurrentSource:kb=>kb===activeKB},analysisSlot:{current:createOperationSlot()},analysisSource:{current:null},
      kbTiers:[1,2,3],kbConditionFilter:query,chunkSize:12000,overlapSize:1500,context:'',...sourceHelpers,...P,geminiHaltsBatch,
      paChunkText:text=>chunks||[text],paBuildExtractPrompt:text=>'HARVEST:'+text,paBuildSynthPrompt:rows=>'SYNTHESIZE:'+rows.join('\n'),paParseTiers:tiers,
      paSynthGroups:(rows,limit,joins)=>split.paSynthGroups(rows,groupLimit,joins),paMergeSynthesis:split.paMergeSynthesis,paChunkJoins:C.paChunkJoins,
      setAnalysisBusy:value=>set('busy',value),setResultSource:value=>set('source',value),setHarvestState:value=>set('harvest',value),setStep:value=>set('step',value),setError:value=>set('error',value),setOutput:value=>set('output',value),
      setAbortController(){},setIsStreaming(){},setProgress(){},setPhase:value=>set('phase',value),setParsedTiers:value=>set('tiers',value),setMeta:value=>set('meta',value),setChunks:value=>set('chunks',value)};
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
  // v17.7: a large inventory is synthesized in parts and merged; one part keeps the single request unchanged.
  const guide=(n,audit=true)=>`## TIER 1 — Must Know\n- **Item ${n}a** [§ S${n}] — (R1 ABC) why.\n\n## TIER 2 — Should Know\n- **Item ${n}b** [§ S${n}] — (R9) why.\n\n## TIER 3 — Good to Know\n- **Item ${n}c** [§ S${n}] — (R9) detail.\n\n---\n## Study Strategy\n- Drill part ${n}.\n\n`+(audit?`*Audit: 3 items · ${n-1} unverified · 1 inferred · 1/1 T1 rule-tagged*`:'');
  const order=(text,...marks)=>marks.every((m,i)=>text.includes(m)&&(i===0||text.indexOf(m)>text.indexOf(marks[i-1])));
  t('Priority synthesis keeps an inventory within the part limit as one part',H.PA_SYNTH_PART_CHARS===40000&&JSON.stringify(H.paSynthGroups(['a','b'],10))==='[["a","b"]]'&&H.paSynthGroups(Array(3).fill('x'.repeat(1000))).length===1);
  const big=Array.from({length:15},(_,i)=>String(i).padEnd(10000,'.')),bigGroups=H.paSynthGroups(big);
  t('Priority synthesis packs a large inventory into ordered, unsplit parts',JSON.stringify(bigGroups.map(g=>g.length))==='[4,4,4,3]'&&JSON.stringify(bigGroups.flat())===JSON.stringify(big));
  t('Priority synthesis gives an oversized extraction its own part',JSON.stringify(H.paSynthGroups(['a','x'.repeat(50),'b'],10))==='[["a"],["'+'x'.repeat(50)+'"],["b"]]');
  let merged=H.paMergeSynthesis([guide(1)]);
  t('Priority single-part merge passes the model text through unchanged',merged.text===guide(1)&&JSON.stringify(merged.tiers)===JSON.stringify(parseTiers(guide(1))));
  merged=H.paMergeSynthesis([guide(1),guide(2)]);
  t('Priority multi-part merge joins every tier in part order',order(merged.tiers.tier1,'Item 1a','Item 2a')&&order(merged.tiers.tier2,'Item 1b','Item 2b')&&order(merged.tiers.tier3,'Item 1c','Item 2c')&&!/Item \da/.test(merged.tiers.tier2)&&!/---/.test(merged.tiers.tier3));
  t('Priority multi-part merge labels each part strategy and sums the audit',order(merged.tiers.strategy,'**Part 1 of 2**','Drill part 1','**Part 2 of 2**','Drill part 2')&&merged.tiers.audit==='6 items · 1 unverified · 2 inferred · 2/2 T1 rule-tagged');
  t('Priority merged guide re-parses identically through the shared tier parser',JSON.stringify(parseTiers(merged.text))===JSON.stringify(merged.tiers));
  merged=H.paMergeSynthesis([guide(1),'Plain prose without tier headings.']);
  t('Priority unparseable part sends every part to the raw view',merged.tiers===null&&order(merged.text,'## Part 1 of 2','Item 1a','## Part 2 of 2','Plain prose without tier headings.'));
  merged=H.paMergeSynthesis([guide(1),'',guide(3)]);
  t('Priority part with no text is listed as missing, never counted',order(merged.tiers.tier1,'Item 1a','Item 3a')&&merged.tiers.audit==='Part 1: 3 items · 0 unverified · 1 inferred · 1/1 T1 rule-tagged | Part 2: (missing) | Part 3: 3 items · 2 unverified · 1 inferred · 1/1 T1 rule-tagged');
  t('Priority audit merge lists parts when a footer is unreadable',H.paMergeAudits(['1 items · 0 unverified · 0 inferred · 1/1 T1 rule-tagged','garbled'])==='Part 1: 1 items · 0 unverified · 0 inferred · 1/1 T1 rule-tagged | Part 2: garbled');
  t('Priority single-part truncation notice is byte-identical',P.paResultNotice({meta:{truncated:true}})==='> Analysis output was truncated; review it before studying.\n\n');
  let splitNotice=P.paResultNotice({meta:{truncated:true,part:2,parts:4,truncatedParts:[2,4]}});
  t('Priority split notice names truncated parts and discloses the split',splitNotice.includes('Synthesis parts 2, 4 of 4 were truncated; review them before studying.')&&splitNotice.includes('Synthesized in 4 parts to stay under the output limit')&&!splitNotice.includes('Analysis output was truncated'));
  splitNotice=P.paResultNotice({meta:{part:null,parts:3,truncatedParts:[]}});
  t('Priority split notice discloses the split when no part was truncated',splitNotice==='> Synthesized in 3 parts to stay under the output limit; each condition is ranked within one part where it fits, and topics that share a heading are combined.\n\n');
  const splitRun=synth=>fixture({chunks:['one','two','three'],groupLimit:2,realTiers:true,call:async(n,args)=>n<=3?'H'+n:synth(n-3,args)});
  h=splitRun(async k=>guide(k));await h.run();
  t('Priority split run sends one synthesis request per part carrying only that part',h.out.calls.length===6&&[1,2,3].every(k=>h.out.calls[2+k][2][0].text==='SYNTHESIZE:H'+k)&&h.out.calls.slice(3).every(c=>c[1]==='priority'));
  t('Priority split run publishes one merged tiered guide',h.out.step==='results'&&h.out.error===''&&order(h.out.tiers.tier1,'Item 1a','Item 2a','Item 3a')&&h.out.tiers.audit==='9 items · 3 unverified · 3 inferred · 3/3 T1 rule-tagged'&&h.out.output.includes('*Audit: 9 items'));
  t('Priority split run shows one progress item per part',JSON.stringify(h.out.chunks.filter(c=>c.phase==='synthesis').map(c=>c.name+':'+c.status))==='["Synthesis 1/3:done","Synthesis 2/3:done","Synthesis 3/3:done"]');
  t('Priority split run export discloses the part count',h.out.meta.parts===3&&/Synthesized in 3 parts/.test(h.notice())&&!/truncated/.test(h.notice()));
  h=splitRun(async(k,args)=>{if(k===2)args[3].onMeta({truncated:true,usage:{thoughtsTokenCount:9}});return guide(k);});await h.run();
  t('Priority split run names the truncated part in metadata and notice',h.out.meta.part===2&&JSON.stringify(h.out.meta.truncatedParts)==='[2]'&&h.out.meta.usage.thoughtsTokenCount===9&&/Synthesis part 2 of 3 was truncated/.test(h.notice()));
  h=splitRun(async k=>{if(k===2)throw Error('Synthetic safety block');return guide(k);});await h.run();
  t('Priority split run content failure costs only its own part',h.out.calls.length===6&&h.out.step==='results'&&/^Synthesis part 2 of 3 failed \(Synthetic safety block\)\. The other parts are shown\.$/.test(h.out.error)&&order(h.out.tiers.tier1,'Item 1a','Item 3a')&&/Part 2: \(missing\)/.test(h.out.tiers.audit)&&/Analysis status: Synthesis part 2 of 3 failed/.test(h.notice()));
  h=splitRun(async k=>{if(k===2)throw Object.assign(Error('Synthetic cut stream'),{partialText:'## TIER 1 — Must Know\n- **Item 2a partial** [§ S2]'});return guide(k);});await h.run();
  t('Priority split run keeps a failed part\'s streamed partial text',order(h.out.tiers.tier1,'Item 1a','Item 2a partial','Item 3a')&&/Synthesis part 2 of 3 failed/.test(h.out.error));
  h=splitRun(async(k,args)=>{if(k===1){args[3].onUpdate(guide(1));return guide(1);}if(k===2)throw Object.assign(Error('Synthetic quota'),{status:429});return guide(k);});await h.run();
  t('Priority split run halts on a quota failure without sending later parts',h.out.calls.length===5&&h.out.step==='results'&&/^Synthesis stopped at part 2 of 3; the remaining parts were not sent\. Synthetic quota$/.test(h.out.error)&&h.out.output.includes('Item 1a')&&/Synthesized in 3 parts/.test(h.notice()));
  h=splitRun(async()=>{throw Error('Synthetic block');});await h.run();
  t('Priority split run with no part text reports every part failure',h.out.step==='error'&&/^No synthesis part returned text\. Part 1: Synthetic block Part 2: Synthetic block Part 3: Synthetic block$/.test(h.out.error));
  // v17.7: harvest chunks are built from whole fact lines under their own condition heading (no [§ untitled]),
  // continuing conditions stay in one synthesis part, and same-heading topics are combined across parts.
  const kbOf=spec=>({conditions:spec.map(([name,n,len])=>({name,aliases:[],facts:Array.from({length:n},(_,i)=>({id:name+'-'+(i+1),text:(name+' fact '+(i+1)+' ').padEnd(len,'x'),tier:1,latteBucket:'Look'}))}))});
  const packet=P.kbForPriority(kbOf([['Alpha',3,150],['Beta',30,180],['Gamma',2,150]]));
  const home=new Map();{let at='';for(const l of packet.split('\n')){if(l.startsWith('## '))at=l;else if(l.startsWith('- '))home.set(l,at);}}
  const underOwnHeading=chunks=>chunks.every(c=>{let at=null;return c.split('\n').every(l=>l.startsWith('## ')?(at=l,true):!l.startsWith('- ')||at===home.get(l));});
  const chunked=C.paChunkText(packet,2000,500),noOverlap=C.paChunkText(packet,2000,0),inChunks=(chunks,l)=>chunks.filter(c=>c.split('\n').includes(l)).length;
  t('Priority chunks open with the packet preamble and keep every fact under its own condition heading',chunked.length>3&&chunked.every(c=>c.startsWith('STRUCTURED LATTE KNOWLEDGE BASE'))&&underOwnHeading(chunked)&&underOwnHeading(noOverlap));
  t('Priority chunks keep every fact line whole and within the chunk size',[...home.keys()].every(l=>inChunks(chunked,l)>0)&&chunked.every(c=>c.split('\n').filter(l=>l.startsWith('- ')).every(l=>home.has(l))&&c.length<=2000));
  t('Priority chunks never split a condition that fits',[...home.keys()].filter(l=>home.get(l)!=='## Beta').every(l=>inChunks(chunked,l)===1)&&new Set(chunked.map((c,i)=>c.includes('## Alpha')?i:-1).filter(i=>i>=0)).size===1);
  t('Priority overlap repeats only the continuing condition\'s facts',[...home.keys()].some(l=>inChunks(chunked,l)>1)&&[...home.keys()].every(l=>inChunks(chunked,l)===1||home.get(l)==='## Beta')&&[...home.keys()].every(l=>inChunks(noOverlap,l)===1));
  const chunkJoins=C.paChunkJoins(chunked),betaChunks=chunked.filter(c=>c.includes('## Beta')).length;
  t('Priority chunk joins mark exactly the chunks that continue a condition',betaChunks>1&&chunkJoins.filter(Boolean).length===betaChunks-1&&chunkJoins.every((j,i)=>!j||chunked[i].split('\n').find(l=>l.startsWith('## '))==='## Beta')&&!chunkJoins[0]);
  t('Priority synthesis keeps a continuing condition in one part',JSON.stringify(H.paSynthGroups(['aaaa','bbbb','cccc'],8,[false,false,true]))==='[["aaaa"],["bbbb","cccc"]]'&&JSON.stringify(H.paSynthGroups(['aaaa','bbbb','cccc'],8))==='[["aaaa","bbbb"],["cccc"]]');
  t('Priority synthesis divides only a condition larger than a part',JSON.stringify(H.paSynthGroups(['aa','bbbbbb','cccccc','dd'],8,[false,false,true,false]))==='[["aa"],["bbbbbb"],["cccccc","dd"]]');
  t('Priority merge combines topics that share a heading in first-appearance order',H.paMergeTopics(['### Fever\n- f1\n### Hypermagnesemia\n- m1','### hypermagnesemia \n- m2\n### Stroke\n- s1'])==='### Fever\n- f1\n\n### Hypermagnesemia\n- m1\n- m2\n\n### Stroke\n- s1');
  t('Priority merge keeps a word-for-word repeat once and differently worded items both',H.paMergeTopics(['### A\n- **x** one','### A\n-  **x**  one\n- **x** two'])==='### A\n- **x** one\n- **x** two');
  t('Priority merge keeps items that precede any topic heading',H.paMergeTopics(['- lead\n### A\n- a','- lead2'])==='- lead\n- lead2\n\n### A\n- a');
  const topicGuide=(item,audit)=>`## TIER 1 — Must Know\n### Hypermagnesemia\n- **${item}** [§ Hypermagnesemia] — (R1 ABC) why.\n\n---\n## Study Strategy\n- Drill.\n\n*Audit: ${audit}*`;
  merged=H.paMergeSynthesis([topicGuide('Antidote A','1 items · 0 unverified · 0 inferred · 1/1 T1 rule-tagged'),topicGuide('Reflexes B','1 items · 0 unverified · 0 inferred · 1/1 T1 rule-tagged')]);
  t('Priority multi-part merge shows a topic from two parts under one heading',merged.tiers.tier1.split('### Hypermagnesemia').length===2&&order(merged.tiers.tier1,'Antidote A','Reflexes B'));
  h=fixture({chunks:['## A\n- a1','## A\n- a2','## B\n- b1'],groupLimit:4,call:async n=>n<=3?'H'+n:'Guide '+n});await h.run();
  t('Priority split run keeps a continuing condition\'s harvests in one synthesis part',h.out.calls.length===5&&h.out.calls[3][2][0].text==='SYNTHESIZE:H1\nH2'&&h.out.calls[4][2][0].text==='SYNTHESIZE:H3');
  h=fixture({chunks:['## B\n- b1','## A\n- a1','## A\n- a2','## A\n- a3'],groupLimit:5,call:async n=>{if(n===3)throw Error('Synthetic outage');return n<=4?'H'+n:'Guide '+n;}});await h.run();
  t('Priority failed chunk inside a condition does not divide the rest of it',h.out.calls.length===6&&h.out.calls[4][2][0].text==='SYNTHESIZE:H1'&&h.out.calls[5][2][0].text==='SYNTHESIZE:H2\nH4'&&h.out.harvest.failed[0].chunk===3);
  h=fixture({call:async(n,args)=>{if(n===1)return 'Captured A';args[3].onMeta({truncated:true});return 'Guide A';}});await h.run();
  t('Priority single-part run keeps its request, progress item and metadata unchanged',h.out.calls.length===2&&h.out.calls[1][2][0].text==='SYNTHESIZE:Captured A'&&JSON.stringify(h.out.meta)==='{"truncated":true}'&&h.out.chunks.filter(c=>c.phase==='synthesis').map(c=>c.id+':'+c.name).join()==='synthesis:Final Synthesis'&&h.out.phase==='Synthesizing...');
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
