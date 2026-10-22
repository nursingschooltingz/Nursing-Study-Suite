'use strict';

// v18.0: step 10 of the v17.14 production review, Low findings (kb group). Synthetic data only.
// Each check runs the live function extracted from the shipped HTML; the KB build checks drive the shipped build
// handler with a stubbed geminiRequest (no network).

module.exports=async function run(S,t){
  function span(start,end){
    const a=S.indexOf(start);if(a<0||S.indexOf(start,a+start.length)>=0)throw Error('v18.0 kb anchor missing or ambiguous: '+start);
    const b=S.indexOf(end,a+start.length);if(b<0)throw Error('v18.0 kb end anchor missing after: '+start);
    return S.slice(a,b);
  }
  const load=(code,names,env={})=>new Function(...Object.keys(env),code+'\nreturn {'+names.join(',')+'};')(...Object.values(env));
  // A missing helper (as on the unfixed build) fails its assertion instead of aborting the harness.
  const attempt=(fn,fallback=null)=>{try{return fn();}catch(e){return fallback;}};
  const attemptAsync=async(fn,fallback=null)=>{try{return await fn();}catch(e){return fallback;}};
  const rejects=async p=>{try{await p;return '';}catch(e){return String(e&&e.message||e);}};

  // ── L6: cardTranscribe shape-checks numerics and title ──
  {
    const card=load(span('function cardKey(','// Compact, inspectable fact rows'),['cardMergeFaces','cardCompareRuns']);
    const {cardTranscribe}=load(span('async function cardTranscribe(','// Pairing key.'),['cardTranscribe'],{
      getExt:()=>'jpg',CARD_MIME:{jpg:'image/jpeg'},cardFilePayload:async()=>({mimeType:'image/jpeg',data:''}),
      CARD_TRANSCRIBE_PROMPT:'',extractJSON:JSON.parse,geminiRequest:async(_k,_m,_b,o)=>o.syntheticRaw});
    const tx=patch=>cardTranscribe('synthetic-never-sent','synthetic','low',{name:'card.jpg'},{syntheticRaw:JSON.stringify({face:'front',category:'Synthetic',cardNumber:'7',title:'Synthetic condition',sections:[{key:'k',heading:'H',bullets:['b'],legibility:'clean'}],numerics:[{value:'5 units',context:'synthetic dose',legibility:'clean'}],...patch})});
    const nullEntry=await rejects(tx({numerics:[null]}));
    // The crash the check prevents: the run comparison reads n.value on every entry.
    const crash=attempt(()=>{card.cardCompareRuns([{sections:[],numerics:[null]},{sections:[],numerics:[null]}]);return '';},'threw');
    t('v18.0 L6: a null numerics entry is rejected by cardTranscribe before it can crash the run comparison',/numerics or title are malformed/.test(nullEntry)&&crash==='threw');
    const bad=await Promise.all([{numerics:'5 units'},{numerics:{value:'5'}},{numerics:[['5 units']]},{numerics:[{value:{n:5},context:'x'}]},{numerics:[{value:'5',context:['x']}]},{numerics:[{value:'5',legibility:{}}]},{title:{name:'x'}},{title:['x']},{title:5}].map(p=>rejects(tx(p))));
    t('v18.0 L6: non-list numerics, non-object entries, object fields and a non-text title are all rejected',bad.every(m=>/numerics or title are malformed/.test(m)));
    const good=await attemptAsync(async()=>[await tx({}),await tx({title:null,face:'back'}),await tx({numerics:undefined}),await tx({numerics:null,title:undefined}),await tx({numerics:[{value:5,context:null,legibility:'clean'}]})]);
    t('v18.0 L6: well-formed transcripts, a back face with a null title and absent numerics are still accepted',
      !!good&&good.length===5&&card.cardMergeFaces([good[0]])[0].numerics.length===1&&card.cardMergeFaces([good[2]])[0].numerics.length===0&&
      good[4].numerics[0].value===5);
  }

  // ── L7: kbDehyphNormForMatch joins a soft hyphen at a line end ──
  {
    const normCode=span('function kbNormForMatch(','// Reason codes, ordered cheapest-to-fix first.');
    const N=load(normCode,['kbNormForMatch','kbDehyphNormForMatch','kbQuoteInSource']);
    // The pre-fix normalizer: the same live source with the v18.0 L7 step removed. Used to show that ordinary text,
    // which has no soft hyphen before a line break, normalizes byte-for-byte as before.
    const preCode=normCode.replace(/\n[ \t]*\.replace\(\/\\u00AD[^\n]*\n/,'\n');
    const pre=attempt(()=>load(preCode,['kbDehyphNormForMatch']).kbDehyphNormForMatch);
    const soft='\u00AD';
    t('v18.0 L7: a soft hyphen at a line end rejoins the word, with CRLF and trailing spaces too',
      N.kbDehyphNormForMatch('the inflam'+soft+'\nmation spreads')==='the inflammation spreads'&&
      N.kbDehyphNormForMatch('the inflam'+soft+' \r\n  mation spreads')==='the inflammation spreads'&&
      N.kbDehyphNormForMatch('0.2'+soft+'\n5 mg',true)===N.kbDehyphNormForMatch('0.25 mg',true));
    const source='Monitor the synthetic gauge for inflam'+soft+'\nmation before each readiness check.';
    const srcNorm=N.kbNormForMatch(source),srcDehyph=N.kbDehyphNormForMatch(source),marks={norm:N.kbNormForMatch(source,true),dehyph:N.kbDehyphNormForMatch(source,true)};
    t('v18.0 L7: a quote spanning a soft-hyphen line break verifies, while altered or reordered quotes still fail',
      N.kbQuoteInSource('synthetic gauge for inflammation before each',srcNorm,srcDehyph,marks)===true&&
      N.kbQuoteInSource('synthetic gauge for inflammation after each',srcNorm,srcDehyph,marks)===false&&
      N.kbQuoteInSource('before each synthetic gauge for inflammation',srcNorm,srcDehyph,marks)===false);
    // Deterministic corpus over the characters the normalizer treats specially, with soft hyphens allowed anywhere
    // except directly before (optional spaces and) a line break, which is the only input the fix changes.
    let seed=1729;const rnd=n=>{seed=(seed*1103515245+12345)%2147483648;return seed%n;};
    const alphabet=['a','b','Z','e','1','0','6','.',',','~',' ',' ','\t','\n','\r\n','-','\u2010','\u2011','\u2012','\u2013','\u2014','\uFB01','\uFB02','\uFB00','\u200B','\u200C','\u200D','\u2060','\uFEFF','\u00B9','\u00B2','\u2074','\u2020','\u2021','\u2217',soft,'%','<','\u2191','\u00E9'];
    const corpus=[];
    while(corpus.length<3000){let s='';const len=1+rnd(24);for(let i=0;i<len;i++)s+=alphabet[rnd(alphabet.length)];if(!/\u00AD[ \t]*\r?\n/.test(s))corpus.push(s);}
    corpus.push('Hold digoxin if the apical pulse is below 60 bpm.','Give 0.25 mg daily; check K+ 3.5-5.0 mEq/L.','inflam-\nmation','inflam\u2014 \nmation','in\uFB02ammation','co'+soft+'operate','12'+soft+'0 mm Hg','');
    const same=!!pre&&preCode!==normCode&&corpus.every(s=>pre(s)===N.kbDehyphNormForMatch(s)&&pre(s,true)===N.kbDehyphNormForMatch(s,true));
    t('v18.0 L7: 3,000+ inputs without a soft hyphen before a line break normalize exactly as the pre-fix function did',same);
  }

  // ── L8: mergeLatteParts alias merging no longer depends on chunk order ──
  {
    const core=load(span('function kbSlug(','// ── Imported-KB sanitizer'),['mergeLatteParts']);
    let n=0;const part=(name,aliases=[])=>({conditions:[{name,aliases,facts:[{text:'Synthetic fact '+(++n)+' for '+name,latteBucket:'Look',tier:2}]}]});
    const shape=kb=>kb.conditions.map(c=>c.facts.length).join(',');
    const a=core.mergeLatteParts([part('Alpha syndrome'),part('Beta syndrome',['Alpha syndrome']),part('Beta syndrome')]);
    const b=core.mergeLatteParts([part('Beta syndrome',['Alpha syndrome']),part('Alpha syndrome'),part('Beta syndrome')]);
    t('v18.0 L8: an alias link merges every chunk into one condition whichever chunk comes first',a.conditions.length===1&&b.conditions.length===1&&shape(a)==='3'&&shape(b)==='3');
    t('v18.0 L8: the incoming name is recorded as an alias of the entry it joined',a.conditions[0].name==='Alpha syndrome'&&a.conditions[0].aliases.includes('Beta syndrome'));
    const c=core.mergeLatteParts([part('Gamma'),part('Gamma',['Gamma variant']),part('Delta')]);
    t('v18.0 L8: a repeated name adds no self-alias and unrelated conditions stay separate',c.conditions.length===2&&c.conditions[0].aliases.join('|')==='Gamma variant'&&c.conditions[1].aliases.length===0&&a.conditions[0].aliases.length===2);
  }

  // ── L9: kbSplitChunk labels nested halves from the chunk's own label ──
  {
    const {kbUnitLabel}=load(span('function kbUnitLabel(units)','async function kbSourceUnits('),['kbUnitLabel']);
    const {kbSplitChunk}=load(span('function kbSplitChunk(','\nasync function kbBuildSourceChunks('),['kbSplitChunk'],{kbUnitLabel});
    const text=Array.from({length:400},(_,i)=>'Synthetic line '+i+' of the readiness text.').join('\n');
    const halves=kbSplitChunk({text,label:'page 3',units:[{kind:'page',n:3,text}]});
    const quarters=kbSplitChunk(halves[0]),back=kbSplitChunk(halves[1]);
    t('v18.0 L9: halves of a half carry the half in their labels, while a first split is labelled as before',halves.map(h=>h.label).join('|')==='page 3 (first half)|page 3 (second half)'&&quarters.map(h=>h.label).join('|')==='page 3 (first half) (first half)|page 3 (first half) (second half)'&&quarters[0].units[0].n===3);
    const multi=kbSplitChunk({text:'x',label:'pages 1\u20134',units:[1,2,3,4].map(n=>({kind:'page',n,text:'p'+n}))});
    const card=kbSplitChunk({text,label:'Synthetic card [card.jpg]',units:[]});
    t('v18.0 L9: the second half splits under its own label; unit splits and unlabelled or card chunks keep their labels',back[0].label==='page 3 (second half) (first half)'&&multi.map(h=>h.label).join('|')==='pages 1\u20132|pages 3\u20134'&&card[0].label==='Synthetic card [card.jpg] (first half)'&&kbSplitChunk({text,units:[{kind:'slide',n:9,text}]})[1].label==='slide 9 (second half)');
  }

  // ── L10: card blockers name changed numbers, changed text and failed comparisons separately ──
  {
    const card=load(span('function cardKey(','// Compact, inspectable fact rows'),['cardMergeFaces','cardChunkBlockers','cardKey']);
    const slot=attempt(()=>load(span('function cardCurrentEntries(','function KnowledgeBaseBuilder(){'),['cardRunInstability','cardIdentityConflict'],{cardKey:card.cardKey,cardIsImage:()=>true,cardFileId:f=>f.name}));
    const front={face:'front',category:'Synthetic',cardNumber:'4',title:'Synthetic',sections:[],numerics:[],overallLegibility:'clean'},back={...front,face:'back',title:null};
    const pair=card.cardMergeFaces([front,back])[0];
    const counts=slot&&slot.cardRunInstability?slot.cardRunInstability([
      {transcript:front,comparisonIncomplete:true,agreement:null},
      {transcript:back,agreement:{numericsUnstable:[],bulletsUnstable:['a','b'],facesDisagree:false,idsDisagree:false}}]).get(card.cardKey(front)):null;
    t('v18.0 L10: an incomplete comparison and changed bullets are counted apart from numbers',!!counts&&counts.numerics===0&&counts.bullets===2&&counts.comparisons===1);
    const blockers=counts?card.cardChunkBlockers(pair,counts):[];
    t('v18.0 L10: the blocker names the failed comparison and the changed text, and claims no changed numbers',blockers.length===2&&!blockers.some(b=>/number\(s\) changed/.test(b))&&blockers.some(b=>/comparison\(s\) incomplete/.test(b))&&blockers.some(b=>/2 line\(s\) of card text changed/.test(b)));
    const num=slot&&slot.cardRunInstability?slot.cardRunInstability([{transcript:front,agreement:{numericsUnstable:['5 (x)','6 (x)'],bulletsUnstable:[],facesDisagree:false,idsDisagree:false}}]).get(card.cardKey(front)):null;
    t('v18.0 L10: changed numbers still block with the numbers message, and a stable card has no entry',!!num&&card.cardChunkBlockers(pair,num).join()==='2 number(s) changed between identical transcription runs'&&slot.cardRunInstability([{transcript:front,agreement:{numericsUnstable:[],bulletsUnstable:[],facesDisagree:false,idsDisagree:false}}]).size===0&&card.cardChunkBlockers(pair,0).length===0);
    t('v18.0 L10: the KB builder gate reads the separated counts',S.includes('const cardUnstable=useMemo(()=>cardRunInstability(cardCurrentEntries(transcripts,files)),[transcripts,files]);')&&S.includes('blockers:cardChunkBlockers(c,cardUnstable.get(c.key)||0)'));
  }

  // ── KB build driver (shared by L11-L13): the shipped build handler with stubbed collaborators ──
  const core=load(span('function kbBuildFocusBlock(','// ── Imported-KB sanitizer'),['kbBuildFocusBlock','kbFlagUnderextraction','kbBucketGaps','mergeLatteParts']);
  const chunkCount=attempt(()=>load(span('function kbBuildFocusBlock(','// ── Imported-KB sanitizer'),['kbDistinctChunkCount']).kbDistinctChunkCount);
  const {extractJSON}=load(span('function extractJSON(text)','// PDF text extraction (shared)'),['extractJSON']);
  const {geminiHaltsBatch}=load(span('function geminiHaltsBatch(','\nasync function callGemini('),['geminiHaltsBatch']);
  const prompts=load(span('const KB_EXTRACTION_PROMPT=','// Focus context for the Knowledge Base.'),['KB_EXTRACTION_PROMPT','KB_VERIFY_PROMPT']);
  const {caseContentWords}=load(span('const CASE_STOPWORDS=','function itemHeuristics('),['caseContentWords']);
  const {kbTextQuality}=load(span('function kbTextQuality(units)','// v15.14: ONE page walk.'),['kbTextQuality']);
  const {createOperationSlot}=load(span('function createOperationSlot()','function cardCurrentEntries('),['createOperationSlot']);
  const H=load(span('function kbUnitLabel(units)','// ── v15.12: flashcard ingestion'),['kbRunLanes','kbCompareOrder','kbSourceUnits','kbGroupUnits','kbSplitChunk','kbBuildSourceChunks','kbNormForMatch','kbDehyphNormForMatch','kbQuoteInSource','kbQuoteNumericBoundedMatch','kbQuoteOperatorsAgree','kbCanonOperators','kbClassifyQuoteMiss','kbValidateExtractionEnvelope','kbQuoteCheckSummary'],
    {kbTextQuality,caseContentWords,pdfjsLib:{OPS:{}},extractPptxText:async f=>f.syntheticText,
      pdfWalkPages:async(file,options)=>{for(let i=0;i<file.pages.length;i++)await options.onPage(file.pages[i],i+1,{getOperatorList:async()=>({fnArray:[]})},file.pages.length);}});
  const buildCode=span('  const build=async()=>{','  // v15.10: the diagnostics panel is a scroll box');
  const copy=v=>JSON.parse(JSON.stringify(v));
  const fact=(text,patch={})=>({text,sourceQuote:text,sourcePointer:{filename:'synthetic.pdf',location:'page 1'},latteBucket:'Look',tier:1,factType:'other',safetyCritical:false,...patch});
  const primary=facts=>({conditions:[{name:'Signal',aliases:[],facts}]});
  async function build({pages,respond,verifyPass=false,chunkChars=45000,laneCount=1}){
    const state={published:[],logs:[],warnings:[],error:'',requests:0,diag:null},files=[{name:'synthetic.pdf',pages}],slot=createOperationSlot();
    const env={...core,...prompts,...H,extractJSON,geminiHaltsBatch,files,currentFiles:{current:files},replacementSlot:{current:slot},abortRef:{current:null},
      K:{setKnowledgeBase:v=>state.published.push(copy(v))},cfg:{apiKey:'synthetic-never-sent',autoProfile:false,forTool:()=>({model:'synthetic',level:'low'})},kbConfirmReplace:()=>true,cardGate:{buildable:[],blocked:[]},cardIsImage:()=>false,chunkChars,overlapUnits:0,probeComposition:false,laneCount,
      kbOutcomes:'',kbPoints:'',kbExtra:'',focusMode:'prioritize',course:'Synthetic',exam:'Synthetic',verifyPass,
      addLog:(m,type)=>state.logs.push({m,type}),setBusy:v=>state.busy=v,setError:v=>state.error=v,setWarnings:v=>state.warnings=v,setProg:v=>state.progress=v,setDiag:v=>state.diag=copy(v),setLogs:v=>state.logs=v,setSelected:()=>{},
      geminiRequest:async(_key,_model,body,opts)=>{const response=await respond(body,state.requests++,opts);if(response instanceof Error)throw response;opts.onMeta?.(response.meta||{truncated:false});return JSON.stringify(response.json||response);}};
    await load(buildCode,['build'],env).build();return state;
  }
  const pageA='The synthetic alpha lamp remains green during readiness checks in the morning.',pageB='The synthetic beta gauge remains steady during readiness checks in the evening.';
  const isAudit=body=>JSON.stringify(body).includes('FACTS ALREADY EXTRACTED');
  const pageOf=body=>body.contents[0].parts[0].text.includes(pageB)?'B':'A';

  // ── L11: the "Chunks" stat counts distinct chunks ──
  {
    const recovered='The synthetic beta gauge remains steady';
    const st=await build({pages:[pageA,pageB],chunkChars:pageA.length+20,verifyPass:true,respond:async body=>{
      if(isAudit(body))return pageOf(body)==='A'?{missed:[fact(pageA.slice(0,40),{conditionName:'Signal'})]}:{missed:[fact(recovered,{conditionName:'Signal'})]};
      return primary([fact(pageOf(body)==='A'?pageA:pageB)]);}});
    const kb=st.published[0];
    t('v18.0 L11: two chunks whose audits both recovered facts count as two chunks, not four sources',!!kb&&kb.sources.length===4&&typeof chunkCount==='function'&&chunkCount(kb.sources)===2&&st.diag.chunks.length===2);
    t('v18.0 L11: distinct ranges or files still count apart and malformed entries do not throw',typeof chunkCount==='function'&&chunkCount([{filename:'a.pdf',range:'page 1'},{filename:'b.pdf',range:'page 1'},{filename:'a.pdf',range:'page 1 (first half)'},null,'x'])===5&&chunkCount(undefined)===0&&chunkCount([{filename:'a.pdf',range:'page 1 (recovered)'}])===1);
    t('v18.0 L11: the Chunks stat renders the distinct count',S.includes('<div className="stat-val">{kbDistinctChunkCount(kb.sources)}</div><div className="stat-lbl">Chunks</div>')&&!S.includes('<div className="stat-val">{kb.sources.length}</div>'));
  }

  // ── L12: a halting failure in one lane aborts the other lane's request in flight ──
  {
    let siblingAborted=null,siblingFinished=false;
    const st=await build({pages:[pageA,pageB,pageA,pageB],chunkChars:pageA.length+20,laneCount:2,respond:async(body,index,opts)=>{
      if(index===1){await new Promise(r=>setTimeout(r,5));return Object.assign(Error('Quota exhausted (synthetic)'),{status:429});}
      if(index===0)return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{siblingFinished=true;siblingAborted=false;resolve(primary([fact(pageA)]));},120);
        const sig=opts&&opts.signal;
        if(sig)sig.addEventListener('abort',()=>{clearTimeout(timer);siblingAborted=true;reject(new DOMException('Aborted','AbortError'));},{once:true});
      });
      return primary([fact(pageOf(body)==='A'?pageA:pageB)]);}});
    t('v18.0 L12: a quota stop in one lane aborts the request in flight on the other lane',siblingAborted===true&&siblingFinished===false&&st.requests===2);
    t('v18.0 L12: the build reports the quota failure, not the abort it caused, and publishes nothing',st.published.length===0&&/Quota exhausted \(synthetic\)/.test(st.error)&&/2 chunk\(s\) were not sent/.test(st.error)&&siblingAborted===true);
    // The lane runner itself: the shared signal follows a failure and the caller's cancel, and its listener is removed.
    let seen=null;const outer=new AbortController();let added=0,removed=0;
    const watched={get aborted(){return outer.signal.aborted;},addEventListener:(...a)=>{added++;outer.signal.addEventListener(...a);},removeEventListener:(...a)=>{removed++;outer.signal.removeEventListener(...a);}};
    await H.kbRunLanes([{n:1},{n:2}],2,async(job,sig)=>{if(job.n===1)seen=sig;await new Promise(r=>setTimeout(r,2));},watched);
    const cancelled=await rejects(H.kbRunLanes([{n:1}],1,async(job,sig)=>{outer.abort();if(!sig||!sig.aborted)throw Error('lane signal did not follow the cancel');},watched));
    // A healthy two-lane build is unaffected: it sends live lane signals and publishes both chunks.
    const ok=await build({pages:[pageA,pageB],chunkChars:pageA.length+20,laneCount:2,respond:async(body,_i,opts)=>{if(!opts||!opts.signal||opts.signal.aborted)return Error('no live lane signal');return primary([fact(pageOf(body)==='A'?pageA:pageB)]);}});
    t('v18.0 L12: kbRunLanes hands each job a lane signal that follows the caller cancel and removes its listener; a healthy two-lane build still publishes both chunks',
      !!seen&&seen.aborted===false&&added===2&&removed===2&&cancelled==='Aborted'&&ok.published.length===1&&ok.published[0].conditions[0].facts.length===2);
  }

  // ── L12 (dead code): a returned audit is complete; the truncated-audit branch is gone ──
  {
    const st=await build({pages:[pageA],verifyPass:true,respond:async body=>isAudit(body)?{json:{missed:[]},meta:{truncated:true}}:primary([fact(pageA)])});
    t('v18.0 L12: a returned audit is recorded complete with no truncated-audit warning (geminiRequest rejects truncated JSON)',st.diag&&st.diag.chunks[0].auditStatus==='complete'&&!st.logs.some(l=>/audit output truncated/.test(l.m))&&!S.includes("auditStatus=vmeta?.truncated?'truncated':'complete';"));
  }

  // ── L13: the critical-fact regex matches a unit written straight after a digit ──
  {
    const {validateLatteKnowledgeBase}=load(span('function validateLatteKnowledgeBase(','\nfunction kbBucketFacts('),['validateLatteKnowledgeBase']);
    const line=S.slice(S.lastIndexOf('\n',S.indexOf('contraindicat|'))+1,S.indexOf('\n',S.indexOf('contraindicat|')));
    const re=new RegExp(line.slice(line.indexOf('||/')+3,line.indexOf('/i.test',line.indexOf('||/')+3)),'i');
    // The v15 pattern, kept here as the reference the change must remain a superset of.
    const v15=/(?:\b(?:mg|mcg|mEq|mm\s*Hg|bpm|mL|hours?|minutes?|days?|hold|notify|emergency|rapid response)\b|contraindicat|\d\s*%)/i;
    const tight=['Give 5mg orally','0.125mcg daily','K+ 3.5mEq/L','BP above 180mmHg','HR below 50bpm','Infuse 250mL','every 4hours','for 3days','within 30minutes'];
    t('v18.0 L13: units written straight after a digit are critical',tight.every(s=>re.test(s))&&!tight.some(s=>v15.test(s)));
    const corpus=['Give 5 mg orally','0.125 mcg','hold if HR < 60','notify the provider','emergency','rapid response team','7% weight loss','contraindicated in renal impairment','perform daily weights','120 mm Hg','for 3 days','every 4 hours','15 minutes','Assess the skin','html markup','Mondays and holidays','the mgmt plan','amlodipine','5mgs','mgdl','smg','5 milligrams','pH 7.35','q4h','10 units'];
    t('v18.0 L13: everything the v15 pattern matched still matches and no word-internal unit is newly matched',corpus.every(s=>re.test(s)===v15.test(s))&&tight.every(s=>re.test(s)));
    const issues=validateLatteKnowledgeBase({conditions:[{name:'Synthetic',facts:[{id:'f1',text:'Give 5mg of the synthetic agent',latteBucket:'Treatments',tier:2,sourceQuote:'q',sources:[]},{id:'f2',text:'Give 5 mg of the synthetic agent',latteBucket:'Treatments',tier:2,sourceQuote:'q',sources:[]},{id:'f3',text:'Assess the synthetic skin',latteBucket:'Assess',tier:2,sourceQuote:'q',sources:[]}]}]});
    t('v18.0 L13: a "5mg" fact without a source file is now a validation error, like "5 mg"',issues.filter(i=>/lacks an actual filename/.test(i.message)).map(i=>i.factId).join()==='f1,f2');
  }
};
