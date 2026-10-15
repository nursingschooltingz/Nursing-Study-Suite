'use strict';

// v18.4: Knowledge Base coverage. Entry facts (medications, diagnostics, scoring tools), schema 1.2 box/table
// provenance and the 15,000-character default. Synthetic data only; no network.

module.exports=async function run(S,t){
  const span=(a,b,from)=>{const base=from?S.indexOf(from):0;const x=S.indexOf(a,base),y=S.indexOf(b,x+a.length);if(base<0||x<0||y<0||S.indexOf(a,x+1)>=0&&!from)throw Error('Missing or ambiguous v18.4 anchor '+a);return S.slice(x,y);};
  const load=(code,names,env={})=>new Function(...Object.keys(env),code+'\n;return {'+names.join(',')+'};')(...Object.values(env));
  const copy=v=>JSON.parse(JSON.stringify(v));

  // The live functions, each from the span the other modules already use.
  const N=load(span('function kbSlug(','// v15.14: the class kept ASCII'),['kbCoerceProvenance','normalizeKbEntities','KB_ENTITY_COLLECTIONS','KB_ENTITY_FIELD_MAP','KB_SOURCE_KINDS']);
  const M=load(span('function kbSlug(','// ── Imported-KB sanitizer'),['mergeLatteParts']);
  const I=load(span('function kbSlug(','// v15.14: the class kept ASCII')+'\n'+span('const KB_IMPORT_MAX_BYTES=','// ── Durable Knowledge Base persistence'),['kbNormalizeImported']);
  const V=load(span('function validateLatteKnowledgeBase(','\nfunction kbBucketFacts('),['validateLatteKnowledgeBase','kbEntitiesWithoutFacts','kbFactView','kbFactWeight','BOX_TABLE_WEIGHT','KB_ENTITY_KINDS']);
  const R=load(span('function kbBucketFacts(','function kbForNCLEX('),['renderKBMarkdown','kbSourceText','kbProvenanceText']);
  const {ngFactRow,ngBuildFactPool,ngAllocateBatch}=load(span('function ngFactRow(','// v17.3: this text was duplicated'),['ngFactRow','ngBuildFactPool','ngAllocateBatch'],{kbSourceText:R.kbSourceText});
  const A=load(span('function kbSourceText(f){','\n')+'\n'+span('function ankiConditionTagKey(','function ankiBatchSummary(')+span('function kbForNCLEX(','// ── KB source chunking'),['kbForNCLEX','kbUsableFactCount','kbForAnki'],{ngFactRow});
  const {ankiSourceSnapshot}=load(span('function ankiSourceSnapshot(','function ankiChunkFactIds('),['ankiSourceSnapshot']);
  const {kbForPriority}=load(span('function kbForPriority(','function PriorityAnalyzer(){'),['kbForPriority'],{kbSourceText:R.kbSourceText,artifactSourceCurrent:()=>true});
  const {selectCaseFacts}=load(span('function selectCaseFacts(','// Sufficiency check'),['selectCaseFacts']);
  const {buildFactIndex}=load(span('function buildFactIndex(kb){','function findFactById('),['buildFactIndex'],{kbFactView:V.kbFactView});
  const prompts=load(span('const KB_EXTRACTION_PROMPT=','// Focus context for the Knowledge Base.'),['KB_EXTRACTION_PROMPT','KB_VERIFY_PROMPT']);

  // ── Fixtures: the flat shapes the audit found, one entry of each kind ──
  const ptr={filename:'synthetic.pdf',location:'pages 10-12'};
  const mannitol={name:'Mannitol',class:'Osmotic diuretic',mechanism:'Draws water across the synthetic barrier.',indications:['Reduction of synthetic pressure','Reduction of synthetic edema'],considerations:['Most common synthetic agent.','Monitor the synthetic level.'],sourcePointer:ptr};
  const condFact=(id,text,patch={})=>({id,text,latteBucket:'Look',tier:2,factType:'symptom',safetyCritical:false,sourceQuote:text,sources:[{filename:'synthetic.pdf',location:'page 1'}],...patch});
  const mixed=()=>({metadata:{course:'Synthetic',exam:'Fixture',createdAt:'2026-10-15',schemaVersion:'1.1'},sources:[],
    conditions:[{id:'alpha',name:'Alpha Condition',aliases:[],facts:[condFact('fact-1','Alpha finding one.'),condFact('fact-2','Alpha finding two.')]}],
    medications:[copy(mannitol),{name:'Betadrug',facts:[{text:'Betadrug is held when the synthetic rate is low.',latteBucket:'Treatments',factType:'medication',safetyCritical:true,tier:1,sourceQuote:'held when the synthetic rate is low',sourcePointer:{filename:'synthetic.pdf',location:'page 3'}}]}],
    diagnostics:[{name:'Synthetic Panel',category:'Laboratory',purpose:'Measures the synthetic marker.',normalRange:'5 to 10 units',criticalValues:'Above 20 units',indications:'Suspected synthetic imbalance',sourcePointer:ptr}],
    scoringTools:[{name:'Synthetic Scale',aliases:['SS'],components:['Eye response (1 to 4)','Verbal response (1 to 5)'],scoringRange:'3 to 15',interpretation:'8 or less is severe',sourcePointer:ptr},{name:'STOP-Synthetic',purpose:'Screens for synthetic apnea.',sourcePointer:ptr}],
    formulas:[],contradictions:[]});

  // ── Step 1: the normalizer ──
  {
    const {kb,report}=N.normalizeKbEntities({conditions:[],medications:[copy(mannitol)]});
    const facts=kb.medications[0].facts||[],buckets=facts.map(f=>f.latteBucket);
    t('v18.4: the flat Mannitol entry (class, mechanism, 2 indications, 2 considerations) becomes at least 5 facts, all derived',facts.length>=5&&facts.length===6&&facts.every(f=>f.derived===true));
    t('v18.4: Mannitol facts land in the mapped buckets: class and mechanism BriefPatho, indications and considerations Treatments',
      JSON.stringify(buckets)==='["BriefPatho","BriefPatho","Treatments","Treatments","Treatments","Treatments"]'
      &&facts[0].text==='Mannitol is an osmotic diuretic.'&&facts[1].factType==='mechanism'&&facts[2].factType==='indication'&&facts[4].factType==='nursing_action');
    t('v18.4: a derived fact has tier 1, a null sourceQuote, the entry pointer as its source, and names its field',
      facts.every(f=>f.tier===1&&f.sourceQuote===null&&f.sources.length===1&&f.sources[0].filename==='synthetic.pdf'&&f.sources[0].location==='pages 10-12'&&f.derivedFrom.collection==='medications'&&typeof f.derivedFrom.field==='string'));
    t('v18.4: derived facts get fact-N IDs (the only form Anki and the NCLEX Generator recognise), unique and in order',
      facts.map(f=>f.id).join()==='fact-1,fact-2,fact-3,fact-4,fact-5,fact-6');
    t('v18.4: normalization is additive: the flat fields are kept',kb.medications[0].class==='Osmotic diuretic'&&kb.medications[0].considerations.length===2&&report.withoutFactsBefore===1&&report.factsWritten===6);
    const empty=N.normalizeKbEntities({conditions:[],medications:[{name:'Gamma',class:'   ',indications:['',null],sourcePointer:ptr}]});
    t('v18.4: blank values are skipped, and an entry with nothing to map stays without facts and is counted',!empty.kb.medications[0].facts&&empty.report.withoutFactsAfter===1&&empty.report.factsWritten===0);
  }
  {
    const {kb,report}=N.normalizeKbEntities(mixed());
    t('v18.4: after normalizing a KB with mixed entry shapes, no entry is left without facts',V.kbEntitiesWithoutFacts(kb)===0&&V.kbEntitiesWithoutFacts(mixed())===4&&report.withoutFactsBefore===4&&report.withoutFactsAfter===0);
    const ids=[...kb.conditions[0].facts,...['medications','diagnostics','scoringTools'].flatMap(k=>kb[k].flatMap(e=>e.facts))].map(f=>f.id);
    t('v18.4: entry fact IDs continue after the conditions and never collide',new Set(ids).size===ids.length&&ids.every(id=>/^fact-\d+$/.test(id))&&!ids.slice(2).some(id=>Number(id.slice(5))<=2));
    const beta=kb.medications[1].facts[0];
    t('v18.4: an entry that already had facts keeps them and gains only a missing ID and sources',kb.medications[1].facts.length===1&&beta.text.startsWith('Betadrug is held')&&/^fact-\d+$/.test(beta.id)&&beta.sources[0].location==='page 3'&&!beta.derived);
    t('v18.4: a diagnostic\'s indications go to Tests, its critical values are safety-critical thresholds',
      kb.diagnostics[0].facts.some(f=>f.derivedFrom.field==='indications'&&f.latteBucket==='Tests')&&kb.diagnostics[0].facts.some(f=>f.derivedFrom.field==='criticalValues'&&f.factType==='threshold'&&f.safetyCritical===true));
    t('v18.4: each scoring-tool component is its own fact, and unmapped content fields are reported, not dropped',
      kb.scoringTools[0].facts.filter(f=>f.derivedFrom.field==='components').length===2&&report.unmapped.category===1&&/category \(1\)/.test(report.summary)&&kb.diagnostics[0].category==='Laboratory');
    const again=N.normalizeKbEntities(kb);
    t('v18.4: normalizing twice changes nothing',again.kb===kb&&again.report.factsWritten===0&&again.report.summary==='');
    t('v18.4: KB_ENTITY_COLLECTIONS names the same keys, in order, as the view\'s KB_ENTITY_KINDS',JSON.stringify(N.KB_ENTITY_COLLECTIONS)===JSON.stringify(V.KB_ENTITY_KINDS.map(k=>k[0])));
    t('v18.4: odd shapes never throw (null entries, a string entry, a non-array collection)',(()=>{try{const r=N.normalizeKbEntities({conditions:[null],medications:[null,'x',{name:'Delta',facts:'nope',class:'Antidote'}],diagnostics:{}});return r.kb.medications[2].facts.length===1&&r.kb.medications[1]==='x';}catch{return false;}})());
  }

  // ── Step 1: build, import and restore all normalize ──
  {
    const part={source:{filename:'synthetic.pdf',range:'pages 1-2'},conditions:[{name:'Alpha Condition',aliases:[],facts:[{text:'Alpha finding.',latteBucket:'Look',tier:2,sourceQuote:'Alpha finding.',sourcePointer:{filename:'synthetic.pdf',location:'page 1'}}]}],medications:[copy(mannitol)]};
    const kb=M.mergeLatteParts([part],'C','E');
    t('v18.4: a build writes schema 1.2 and normalizes entries at the end of the merge',kb.metadata.schemaVersion==='1.2'&&kb.medications[0].facts.length===6&&kb.medications[0].facts[0].id==='fact-2'&&kb.entityReport.factsWritten===6&&!Object.keys(kb).includes('entityReport'));
    const imported=I.kbNormalizeImported(copy(mixed()));
    t('v18.4: Import JSON repairs a saved KB without re-extraction and reports what it wrote',V.kbEntitiesWithoutFacts(imported.kb)===0&&imported.entityReport.factsWritten>0&&/had no facts/.test(imported.entityReport.summary));
    const saved=copy(imported.kb),restored=I.kbNormalizeImported(copy(saved),{restore:true}).kb;
    t('v18.4: a restore keeps every saved entry fact ID; an import renumbers entry facts after the conditions',
      JSON.stringify(restored.medications)===JSON.stringify(saved.medications)&&I.kbNormalizeImported(copy(saved)).kb.medications[0].facts[0].id==='fact-3');
    const pre=mixed();delete pre.medications;delete pre.diagnostics;delete pre.scoringTools;
    const plain=I.kbNormalizeImported(copy(pre));
    // The import's own field set before v18.4: the same facts come back with exactly these keys and nothing added.
    const v183Keys=JSON.stringify(['id','text','tier','latteBucket','subtype','factType','safetyCritical','recovered','sourceQuote','sources']);
    t('v18.4: a schema 1.1 KB loads unchanged: same facts and fields, same declared version, no provenance fields invented',
      plain.kb.metadata.schemaVersion==='1.1'&&plain.warnings.length===0&&plain.entityReport.summary===''&&plain.kb.conditions[0].facts.length===2
      &&plain.kb.conditions[0].facts.every((f,i)=>{const o=pre.conditions[0].facts[i];return JSON.stringify(Object.keys(f))===v183Keys&&f.id===o.id&&f.text===o.text&&f.tier===o.tier&&f.latteBucket===o.latteBucket&&f.sourceQuote===o.sourceQuote&&JSON.stringify(f.sources)===JSON.stringify(o.sources);}));
  }

  // ── Step 1: derived facts are not filtered for lacking a quote ──
  {
    const view=V.kbFactView(N.normalizeKbEntities(mixed()).kb),issues=V.validateLatteKnowledgeBase(view);
    const derivedIds=new Set(view.conditions.flatMap(c=>c.facts).filter(f=>f.derived).map(f=>f.id));
    t('v18.4: validation does not flag a derived fact for its missing verbatim anchor, and still flags a condition fact',
      derivedIds.size>0&&!issues.some(i=>derivedIds.has(i.factId))&&V.validateLatteKnowledgeBase(V.kbFactView({conditions:[{name:'Q',facts:[condFact('fact-1','No quote.',{sourceQuote:''})]}]})).some(i=>/verbatim source anchor/.test(i.message)));
    t('v18.4: validation warns while entries have no facts and is quiet once they do',
      V.validateLatteKnowledgeBase(V.kbFactView(mixed())).some(i=>/4 medication, diagnostic or scoring-tool entries have no facts/.test(i.message))&&!issues.some(i=>/entr(y|ies) ha(s|ve) no facts/.test(i.message)));
  }

  // The shipped build handler: a flat entry plus an omission audit. The audit filter discards a recovered fact whose
  // quote is absent; the entry's derived facts (no quote at all) must come through the whole build.
  {
    const core=load(span('function kbBuildFocusBlock(','// ── Imported-KB sanitizer'),['kbBuildFocusBlock','kbFlagUnderextraction','kbBucketGaps','mergeLatteParts']);
    const {extractJSON}=load(span('function extractJSON(text)','// PDF text extraction (shared)'),['extractJSON']);
    const {geminiHaltsBatch}=load(span('function geminiHaltsBatch(','\nasync function callGemini('),['geminiHaltsBatch']);
    const {caseContentWords}=load(span('const CASE_STOPWORDS=','function itemHeuristics('),['caseContentWords']);
    const {kbTextQuality}=load(span('function kbTextQuality(units)','// v15.14: ONE page walk.'),['kbTextQuality']);
    const {createOperationSlot}=load(span('function createOperationSlot()','function cardCurrentEntries('),['createOperationSlot']);
    const H=load(span('function kbUnitLabel(units)','// ── v15.12: flashcard ingestion'),['kbRunLanes','kbCompareOrder','kbSourceUnits','kbGroupUnits','kbSplitChunk','kbBuildSourceChunks','kbNormForMatch','kbDehyphNormForMatch','kbQuoteInSource','kbQuoteNumericBoundedMatch','kbQuoteOperatorsAgree','kbCanonOperators','kbClassifyQuoteMiss','kbValidateExtractionEnvelope','kbQuoteCheckSummary'],
      {kbTextQuality,caseContentWords,pdfjsLib:{OPS:{}},extractPptxText:async f=>f.syntheticText,
        pdfWalkPages:async(file,options)=>{for(let i=0;i<file.pages.length;i++)await options.onPage(file.pages[i],i+1,{getOperatorList:async()=>({fnArray:[]})},file.pages.length);}});
    const buildCode=span('  const build=async()=>{','  // v15.10: the diagnostics panel is a scroll box');
    const page='Box 3.1 Synthetic signs: the synthetic alpha lamp remains green during readiness checks in the morning.';
    const state={published:[],logs:[],warnings:[],requests:[],error:''},files=[{name:'synthetic.pdf',pages:[page]}],slot=createOperationSlot();
    const primary={conditions:[{name:'Signal',aliases:[],facts:[{text:'Alpha lamp stays green during readiness.',sourceQuote:'the synthetic alpha lamp remains green',latteBucket:'Look',tier:1,factType:'symptom',sourceKind:'box',sourceLabel:'Box 3.1',printedPage:44},
      {text:'Alpha lamp is checked in the morning.',sourceQuote:'readiness checks in the morning',latteBucket:'Assess',tier:2,factType:'assessment',sourceKind:'diagram'}]}],medications:[copy(mannitol)]};
    const audit={missed:[{conditionName:'Signal',text:'Invented recovery.',sourceQuote:'this quote is not in the synthetic page at all',latteBucket:'Look',tier:2}]};
    const env={...core,...prompts,...H,extractJSON,geminiHaltsBatch,files,currentFiles:{current:files},replacementSlot:{current:slot},abortRef:{current:null},
      K:{setKnowledgeBase:v=>state.published.push(copy(v))},cfg:{apiKey:'synthetic-never-sent',autoProfile:false,forTool:()=>({model:'synthetic',level:'low'})},kbConfirmReplace:()=>true,cardGate:{buildable:[],blocked:[]},cardIsImage:()=>false,chunkChars:45000,overlapUnits:0,probeComposition:false,laneCount:1,
      kbOutcomes:'',kbPoints:'',kbExtra:'',focusMode:'prioritize',course:'Synthetic',exam:'Synthetic',verifyPass:true,
      addLog:(m,type)=>state.logs.push({m,type}),setBusy:()=>{},setError:v=>state.error=v,setWarnings:v=>state.warnings=v,setProg:()=>{},setDiag:()=>{},setLogs:()=>{},setSelected:()=>{},
      geminiRequest:async(_key,_model,body,opts)=>{const text=JSON.stringify(body);state.requests.push(text);opts.onMeta?.({truncated:false});return JSON.stringify(text.includes('FACTS ALREADY EXTRACTED')?audit:primary);}};
    await load(buildCode,['build'],env).build();
    const kb=state.published[0]||{conditions:[],medications:[]},derived=(kb.medications[0]||{}).facts||[];
    t('v18.4: derived facts with a null sourceQuote survive the build and its omission audit, whose quote filter still discards an unlocatable recovery',
      state.published.length===1&&derived.length===6&&derived.every(f=>f.derived===true&&f.sourceQuote===null)&&!kb.conditions[0].facts.some(f=>f.text==='Invented recovery.'));
    const facts=kb.conditions[0].facts,boxed=facts.find(f=>f.sourceLabel==='Box 3.1'),bad=facts.find(f=>f.text.startsWith('Alpha lamp is checked'));
    t('v18.4: a build keeps sourceKind, sourceLabel and printedPage (number read as text)',!!boxed&&boxed.sourceKind==='box'&&boxed.printedPage==='44');
    t('v18.4: an unknown sourceKind from the model is read as prose with a build warning, not a failure',!!bad&&bad.sourceKind==='prose'&&state.logs.some(l=>/unknown sourceKind and were read as prose/.test(l.m))&&state.warnings.some(w=>/unknown sourceKind/.test(w))&&!state.error);
    t('v18.4: the audit inventory shows a fact\'s box label, and the build log reports the entries it gave facts',
      state.requests.some(r=>r.includes('FACTS ALREADY EXTRACTED')&&r.includes('- [Look] [Box 3.1] Alpha lamp stays green during readiness.'))&&state.logs.some(l=>/1 of 1 had no facts, and 6 fact\(s\) were written/.test(l.m)));
  }

  // ── Step 2: schema 1.2 provenance through import, export and restore ──
  {
    const kb=mixed();kb.metadata.schemaVersion='1.2';kb.conditions[0].facts[0]={...kb.conditions[0].facts[0],sourceKind:'table',sourceLabel:'Table 6-2',printedPage:'89'};
    const once=I.kbNormalizeImported(copy(kb)).kb,twice=I.kbNormalizeImported(copy(once)).kb,restored=I.kbNormalizeImported(copy(twice),{restore:true}).kb;
    const f=restored.conditions[0].facts[0];
    t('v18.4: a 1.2 fact with sourceKind table and sourceLabel "Table 6-2" round-trips through import, export and restore',f.sourceKind==='table'&&f.sourceLabel==='Table 6-2'&&f.printedPage==='89'&&restored.metadata.schemaVersion==='1.2');
    const bad=copy(kb);bad.conditions[0].facts[1].sourceKind='sidebar-ish';
    let out=null;try{out=I.kbNormalizeImported(bad);}catch{}
    t('v18.4: an invalid sourceKind on import is coerced to prose with a warning, not a crash',!!out&&out.kb.conditions[0].facts[1].sourceKind==='prose'&&out.warnings.length===1&&/conditions\[0\]\.facts\[1\]: unknown sourceKind "sidebar-ish"/.test(out.warnings[0]));
    const g={sourceKind:' Box ',sourceLabel:{x:1},printedPage:112};
    t('v18.4: kbCoerceProvenance lower-cases a valid kind and keeps only text labels and pages',N.kbCoerceProvenance(g)===''&&g.sourceKind==='box'&&g.sourceLabel===null&&g.printedPage==='112'&&JSON.stringify(N.KB_SOURCE_KINDS)==='["box","table","figure","prose"]');
    const md=R.renderKBMarkdown({conditions:[{name:'Alpha',facts:[condFact('fact-1','Tabled finding.',{sourceKind:'table',sourceLabel:'Table 6-2',printedPage:'89'}),condFact('fact-2','Prose finding.')]}]});
    t('v18.4: the Study view shows the box or table label and the printed page next to the source line, and nothing extra for prose',
      md.includes('*Source: synthetic.pdf, page 1 · Table 6-2 · printed p. 89*')&&md.includes('- Prose finding.  \n  *Source: synthetic.pdf, page 1*'));
  }

  // ── Step 2: box and table facts first in the Anki and NCLEX Generator selection paths ──
  {
    const kb={conditions:[{id:'c',name:'Alpha',aliases:[],facts:[condFact('fact-1','Prose one.'),condFact('fact-2','Figure two.',{sourceKind:'figure'}),condFact('fact-3','Table three.',{sourceKind:'table',sourceLabel:'Table 1.1'}),condFact('fact-4','Prose four.'),condFact('fact-5','Box five.',{sourceKind:'box',sourceLabel:'Box 1.1'})]}]};
    const ordered=V.kbFactView(kb,{boxTableFirst:true}).conditions[0].facts.map(f=>f.id).join();
    t('v18.4: BOX_TABLE_WEIGHT is 2 and boxTableFirst moves box and table facts ahead, keeping source order otherwise',V.BOX_TABLE_WEIGHT===2&&V.kbFactWeight({sourceKind:'table'})===2&&V.kbFactWeight({sourceKind:'figure'})===1&&ordered==='fact-3,fact-5,fact-1,fact-2,fact-4');
    t('v18.4: without boxTableFirst the view keeps source order and the KB itself is never reordered',V.kbFactView(kb).conditions[0].facts.map(f=>f.id).join()==='fact-1,fact-2,fact-3,fact-4,fact-5'&&kb.conditions[0].facts[0].id==='fact-1');
    const alloc=ngAllocateBatch(ngBuildFactPool(V.kbFactView(kb,{boxTableFirst:true})),new Set(),{want:2,perCondition:2,neighborCap:0});
    t('v18.4: the NCLEX Generator allocates the box and table facts first',alloc.targets.map(f=>f.id).join()==='fact-3,fact-5');
    const packet=A.kbForAnki(V.kbFactView(kb,{boxTableFirst:true}));
    t('v18.4: the Anki packet lists box and table facts first',packet.indexOf('FACT fact-3 ')<packet.indexOf('FACT fact-1 ')&&packet.indexOf('FACT fact-5 ')<packet.indexOf('FACT fact-1 '));
    t('v18.4: Anki and the NCLEX Generator ask for the ordered view at their call sites',
      S.includes('const allTxt=kbForAnki(kbFactView(K.knowledgeBase,{boxTableFirst:true}));')&&S.includes('const factView=kbFactView(K.knowledgeBase,{boxTableFirst:true});\n      const pool=ngBuildFactPool(factView,')&&S.includes("kbForNCLEX(factView,{tiers:kbTiers,conditionQuery:kbConditionFilter})"));
  }

  // ── Step 1.4: every consumer sees medication, diagnostic and scoring-tool facts ──
  {
    const kb=N.normalizeKbEntities(mixed()).kb,view=V.kbFactView(kb);
    const pick=k=>kb[k][0].facts[0],med=pick('medications'),dx=pick('diagnostics'),tool=pick('scoringTools');
    const hasAll=text=>[med,dx,tool].every(f=>text.includes(f.id));
    t('v18.4: the view adds one group per entry with facts, after the conditions, with a kind and an ID no condition slug can take',
      view.conditions.length===6&&view.conditions[0].id==='alpha'&&view.conditions[1].id==='medications:0'&&view.conditions[1].entityKind==='medication'&&view.conditions[3].entityKind==='diagnostic'&&view.conditions[4].aliases[0]==='SS'&&view.conditions[5].entityKind==='scoring tool');
    const index=buildFactIndex(kb);
    t('v18.4: consumer — the fact index (inspector, chip count, NCLEX known IDs) resolves entry facts',[med,dx,tool].every(f=>index.get(f.id).fact===f)&&index.get(med.id).condition.name==='Mannitol');
    const md=R.renderKBMarkdown(view);
    t('v18.4: consumer — the Study view renders entry facts under a heading naming the kind',[med,dx,tool].every(f=>md.includes(f.text))&&md.includes('## Mannitol (medication)')&&S.includes('md=useMemo(()=>renderKBMarkdown(view),[view])'));
    t('v18.4: consumer — the Knowledge Base browser lists entries and selection accepts them',S.includes('{view.conditions.map(c=><button key={c.id} className="kb-condition"')&&S.includes('const conds=kbFactView(K.knowledgeBase).conditions;'));
    t('v18.4: consumer — the Anki packet carries medication, diagnostic and scoring-tool facts',hasAll(A.kbForAnki(V.kbFactView(kb,{boxTableFirst:true})))&&A.kbForAnki(view).includes('=== CONDITION: Mannitol ===')&&A.kbUsableFactCount(view)>A.kbUsableFactCount(kb));
    const snap=ankiSourceSnapshot(view);
    t('v18.4: consumer — the Anki source snapshot (coverage and source checks) knows entry facts',[med,dx,tool].every(f=>!!snap.byId[f.id])&&S.includes('snapshot=ankiSourceSnapshot(kbFactView(sourceKB))')&&S.includes('ankiSourceSnapshot(kbFactView(K.knowledgeBase))'));
    const pool=ngBuildFactPool(V.kbFactView(kb,{boxTableFirst:true}));
    t('v18.4: consumer — the NCLEX Generator pool and packet carry entry facts',hasAll(JSON.stringify(pool))&&hasAll(A.kbForNCLEX(view))&&A.kbForNCLEX(view).includes('CONDITION: Synthetic Scale'));
    t('v18.4: consumer — the Priority packet carries entry facts',hasAll(kbForPriority(view))&&S.includes('const analysisText=kbForPriority(kbFactView(source.kb),'));
    const group=view.conditions.find(c=>c.name==='Mannitol');
    t('v18.4: consumer — Case Studies can take an entry as its topic, with its facts selected',selectCaseFacts(group).length===6&&S.includes('const conditions=useMemo(()=>kbFactView(K.knowledgeBase).conditions,[K.knowledgeBase]);')&&S.includes("{c.name}{c.entityKind?' · '+c.entityKind:''} ({(c.facts||[]).length} facts)"));
    t('v18.4: the Knowledge Base tab shows an "entities without facts" status chip',S.includes('{entitiesWithoutFacts} entities without facts</span>}')&&S.includes('const entitiesWithoutFacts=useMemo(()=>kbEntitiesWithoutFacts(knowledgeBase),[knowledgeBase]);'));
  }

  // ── Step 2: the two approved prompt changes ──
  {
    const e=prompts.KB_EXTRACTION_PROMPT,v=prompts.KB_VERIFY_PROMPT;
    t('v18.4: the extraction JSON shape asks for sourceKind, sourceLabel and printedPage on every fact',e.includes('"sourceKind":"box|table|figure|prose",\n      "sourceLabel":"box, table, or figure label as printed, or null",\n      "printedPage":"the book\'s printed page number, or null"\n    }]'));
    t('v18.4: the extraction rules want one fact per table row and box bullet and never a summarised box',e.includes('BOX AND TABLE RULES')&&e.includes('Every row of a table and every bullet of a box must produce at least one fact.')&&e.includes('never summarize a box or table into a single fact')&&e.includes('- every table row and every box bullet produced at least one fact'));
    t('v18.4: the omission audit checks every box and table label and labels what it recovers',v.includes('check every box and table label in the source chunk against the extracted list')&&v.includes('a recovered table row or box bullet carries its label exactly as printed')&&v.includes('"sourceKind":"box|table|figure|prose"'));
  }

  // ── Step 3: shipped defaults ──
  {
    const D=new Function(span('const KB_DEFAULT_CHUNK_CHARS=','\nfunction KnowledgeBaseBuilder(){')+';return {KB_DEFAULT_CHUNK_CHARS,KB_DEFAULT_AUDIT,KB_DEFAULT_OVERLAP};')();
    t('v18.4: the default chunk is 15,000 characters; the audit stays on and the overlap stays 1',D.KB_DEFAULT_CHUNK_CHARS===15000&&D.KB_DEFAULT_AUDIT===true&&D.KB_DEFAULT_OVERLAP===1);
    const builder=span('function KnowledgeBaseBuilder(){','\n// ──── TOOL: Priority Analyzer ────');
    t('v18.4: the builder starts from the constants and no literal 30000 remains in the Knowledge Base tab',
      builder.includes('useState(KB_DEFAULT_AUDIT)')&&builder.includes('useState(KB_DEFAULT_CHUNK_CHARS)')&&builder.includes('useState(KB_DEFAULT_OVERLAP)')&&!builder.includes('30000'));
    t('v18.4: the chunk field explains the new default and two lanes offset the extra calls',builder.includes('Default lowered to 15,000 in v18.4: smaller chunks capture boxes and tables more reliably.')&&builder.includes('two lanes offset that.'));
  }
};
