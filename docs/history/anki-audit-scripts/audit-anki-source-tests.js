#!/usr/bin/env node
'use strict';
// Standalone audit evidence, not a repository gate. All source/response fixtures below
// are invented. Actual production helpers and build/import closures are extracted;
// only file reads, Gemini and React setters are mocked. Never calls a live API.
const fs=require('fs');
const assert=require('assert/strict');
const cp=require('child_process');
const {resolveSuiteFile}=require('./repo-checks');
const file=resolveSuiteFile({rootDir:process.cwd()});
let source=fs.readFileSync(file,'utf8');
const mutant=process.argv.includes('--mutant')?process.argv[process.argv.indexOf('--mutant')+1]:'';
function replaceOne(oldText,newText){
  assert.equal(source.split(oldText).length-1,1,'unique mutation anchor');
  source=source.replace(oldText,newText);
}
if(mutant==='quote-discard-bypass')replaceOne('if(!kbQuoteInSource(f.sourceQuote,srcNorm,srcDehyph)){discarded++;noteMiss(2,f);continue;}','if(false){discarded++;noteMiss(2,f);continue;}');
else if(mutant==='operator-warning-bypass')replaceOne("if(!KB_OPERATOR_RE.test(raw))return true;","return true; // audit mutation: bypass operator warning\n  if(!KB_OPERATOR_RE.test(raw))return true;");
else if(mutant==='publication-guard-bypass')replaceOne('if(!replacementSlot.current.current(run))return;\n      K.setKnowledgeBase(kb);','// audit mutation: removed publication guard\n      K.setKnowledgeBase(kb);');
else if(mutant==='dedupe-collapse')replaceOne("String(f.text||'').replace(/\\s+/g,' ').trim()].join('|');","String(f.text||'').replace(/[<>]/g,'').replace(/\\s+/g,' ').trim()].join('|');");
else if(mutant)throw Error('unknown mutation '+mutant);
function span(a,b){
  const start=source.indexOf(a),end=source.indexOf(b,start+a.length);
  assert(start>=0&&end>start,'missing extraction anchors: '+a+' -> '+b);
  assert.equal(source.split(a).length-1,1,'unique extraction anchor '+a);
  return source.slice(start,end);
}
const helpers=span('const KB_EXTRACTION_PROMPT=', '// ── v15.12: flashcard ingestion, pass 1 of 2')+
  span('function extractJSON(text){','// PDF text extraction (shared)')+
  span('function createOperationSlot(){','function cardCurrentEntries(')+
  span('const CASE_STOPWORDS=','function itemHeuristics(')+
  span('function pdfLayoutText(tc){','// v15.14: ONE page walk.');
const names=['KB_EXTRACTION_PROMPT','KB_VERIFY_PROMPT','KB_IMPORT_MAX_BYTES','kbBuildFocusBlock','kbFlagUnderextraction','kbBucketGaps','kbFactKey','mergeLatteParts','kbNormalizeImported','validateLatteKnowledgeBase','kbNormForMatch','kbDehyphNormForMatch','kbQuoteInSource','kbClassifyQuoteMiss','kbCanonOperators','kbQuoteOperatorsAgree','kbGroupUnits','kbSplitChunk','kbTextQuality','pdfLayoutText','extractJSON','createOperationSlot','kbCreateSaveQueue','kbStoredRecord','kbReconcileStored'];
const H=new Function(helpers+';return {'+names.join(',')+'};')();
const buildCode=span('  const build=async()=>{','  // v15.10: the diagnostics panel is a scroll box');
const importCode=span('  const importJSON=async file=>{','  // v15.3 (Gemini\'s BUG-02');
const clone=v=>JSON.parse(JSON.stringify(v));
let count=0;
const trace=[];
function check(name,fn){
  try{fn();}catch(e){console.error('Audit assertion failed: '+name);throw e;}
  count++;console.log('PASS '+name);
}
function fact(text='Assess skin color.',extra={}){return {text,latteBucket:'Assess',tier:1,factType:'assessment',sourceQuote:text,sourcePointer:{filename:'source.pdf',location:'page 1'},...extra};}
function response(facts=[fact()],name='Synthetic condition'){return {conditions:[{name,aliases:[],facts}]};}
function fixture({responses=[],chunks=[{text:'Assess skin color.',label:'page 1',units:[{kind:'page',n:1,text:'Assess skin color.'}]}],verifyPass=false}={}){
  const state={published:[],logs:[],warnings:[],error:'',diag:null,calls:[]};
  const file={name:'source.pdf'},files=[file],slot=H.createOperationSlot();
  let index=0;
  const set=k=>v=>{state[k]=typeof v==='function'?v(state[k]):v;};
  const env={...H,files,currentFiles:{current:files},replacementSlot:{current:slot},abortRef:{current:null},
    cfg:{apiKey:'synthetic-key-never-sent',forTool:()=>({model:'synthetic-model',level:'low'}),autoProfile:false},
    K:{setKnowledgeBase:kb=>{state.published.push(clone(kb));}},kbConfirmReplace:()=>true,
    setBusy:set('busy'),setError:set('error'),setWarnings:set('warnings'),setProg:set('progress'),setDiag:set('diag'),setLogs:set('logs'),setSelected:set('selected'),
    addLog:(m,t)=>state.logs.push({m,t}),cardGate:{buildable:[],blocked:[]},cardIsImage:()=>false,
    course:'Synthetic',exam:'Audit',kbOutcomes:'',kbPoints:'',kbExtra:'',focusMode:'prioritize',verifyPass,chunkChars:30000,overlapUnits:1,probeComposition:false,
    kbBuildSourceChunks:async()=>clone(chunks),
    geminiRequest:async(...args)=>{
      state.calls.push(clone(args.slice(0,3)));const value=responses[index++];
      if(value instanceof Error)throw value;
      if(typeof value==='function')return value(args[3]);
      if(value===undefined)throw Error('Unexpected extra mocked Gemini request');
      return typeof value==='string'?value:JSON.stringify(value);
    }};
  const build=new Function(...Object.keys(env),buildCode+';return build;')(...Object.values(env));
  const importEnv={...env,formatSize:String,setCourse:set('course'),setExam:set('exam')};
  const importJSON=new Function(...Object.keys(importEnv),importCode+';return importJSON;')(...Object.values(importEnv));
  return {state,slot,build,importJSON};
}
async function main(){
  check('extraction reaches real helper and build tails',()=>{
    assert.equal(typeof H.kbReconcileStored,'function');assert.equal(typeof H.kbQuoteOperatorsAgree,'function');
    assert(buildCode.includes('finally{if(replacementSlot.current.finish(run))'));
  });
  const ordinary=fact('Assess skin color and temperature.');
  const basic=fixture({responses:[response([ordinary])],chunks:[{text:ordinary.text,label:'page 1',units:[]}]});await basic.build();
  check('source-supported primary fact preserved through complete build',()=>{
    assert.equal(basic.state.published[0].conditions[0].facts[0].text,ordinary.text);
    assert.equal(basic.state.error,'');assert.equal(basic.state.progress,100);assert.equal(basic.state.busy,false);
  });
  trace.push({case:'supported-primary',source:ordinary.text,response:response([ordinary]),merged:basic.state.published[0]});
  check('formatting and dehyphenation variants accepted without content rewrite',()=>{
    assert(H.kbQuoteInSource('Assess skin color',H.kbNormForMatch('Assess\n  skin color')));
    const s='Observe inflam-\nmation of the skin.';
    assert(H.kbQuoteInSource('Observe inflammation of the skin',H.kbNormForMatch(s),H.kbDehyphNormForMatch(s)));
  });
  check('strict omission quote check rejects unrelated evidence',()=>{
    assert(!H.kbQuoteInSource('Administer synthetic medicine daily',H.kbNormForMatch('Assess skin color and temperature.')));
  });
  const recovered=fixture({verifyPass:true,responses:[response(),{missed:[{...fact('Administer synthetic medicine daily.'),conditionName:'Synthetic condition'}]}]});await recovered.build();
  check('unsupported omission fact discarded while unrelated supported primary survives',()=>{
    assert.equal(recovered.state.diag.discarded,1);
    assert.equal(recovered.state.published[0].conditions[0].facts.length,1);
  });
  const shortQuote=fixture({verifyPass:true,responses:[response([]),{missed:[{...fact('Rash.'),conditionName:'Synthetic condition'}]}],chunks:[{text:'Synthetic condition\nRash.',label:'page 1',units:[]}]});await shortQuote.build();
  check('inconclusive short evidence: literal supported short quote is deliberately discarded in omission pass',()=>{
    assert.equal(shortQuote.state.diag.discarded,1);assert.equal(shortQuote.state.diag.discardByReason.tooShort,1);
    assert.equal(shortQuote.state.published[0].conditions[0].facts.length,0);
  });
  const miss=fixture({responses:[response([fact('Administer synthetic medicine daily.')])]});await miss.build();
  check('documented primary-miss policy retains fact with diagnostic uncertainty',()=>{
    assert.equal(miss.state.published[0].conditions[0].facts.length,1);assert.equal(miss.state.diag.quoteMiss,1);
  });
  check('changed explicit operator raises warning evidence',()=>{
    const s='Hold the synthetic dose if pulse < 60 bpm.';
    assert(H.kbQuoteInSource('Hold the synthetic dose if pulse > 60 bpm.',H.kbNormForMatch(s)));
    assert(!H.kbQuoteOperatorsAgree('Hold the synthetic dose if pulse > 60 bpm.',H.kbNormForMatch(H.kbCanonOperators(s))));
  });
  check('known limitation: dropped operator and decimal punctuation still match',()=>{
    const s='Hold the synthetic dose if pulse < 60 bpm.';
    assert(H.kbQuoteInSource('Hold the synthetic dose if pulse 60 bpm.',H.kbNormForMatch(s)));
    assert(H.kbQuoteOperatorsAgree('Hold the synthetic dose if pulse 60 bpm.',H.kbNormForMatch(H.kbCanonOperators(s))));
    assert(H.kbQuoteInSource('Dose is 1,5 mg',H.kbNormForMatch('Dose is 1.5 mg')));
  });
  const drift=fixture({verifyPass:true,responses:[response([]),{missed:[{...fact('Administer the synthetic dose if pulse > 60 bpm.',{sourceQuote:'Hold the synthetic dose if pulse < 60 bpm.'}),conditionName:'Synthetic condition'}]}],chunks:[{text:'Hold the synthetic dose if pulse < 60 bpm.',label:'page 1',units:[]}]});await drift.build();
  check('semantic boundary: true quotation does not prove the recovered fact claim',()=>{
    assert.equal(drift.state.diag.recovered,1);assert.equal(drift.state.diag.opMismatch,0);
    assert.equal(drift.state.published[0].conditions[0].facts[0].text,'Administer the synthetic dose if pulse > 60 bpm.');
    assert.equal(H.validateLatteKnowledgeBase(drift.state.published[0]).length,0);
  });
  trace.push({case:'source-to-kb-drift',source:'Hold the synthetic dose if pulse < 60 bpm.',response:drift.state.calls.length,merged:drift.state.published[0]});
  const noQuote=fixture({responses:[response([fact('Assess skin color.',{sourceQuote:''})])]});await noQuote.build();
  check('reproduced: absent primary quote contributes zero quote misses',()=>{
    assert.equal(noQuote.state.diag.quoteMiss,0);
    assert(H.validateLatteKnowledgeBase(noQuote.state.published[0]).some(i=>i.message.includes('no short verbatim')));
    assert(source.includes(':<div style={{fontSize:12,color:\'var(--accent-green)\',marginTop:7,lineHeight:1.5}}>✓ Every first-pass quote was located verbatim in the source.</div>'));
  });
  const pointer=fixture({responses:[response([fact('Assess skin color.',{sourcePointer:{filename:'never-read.pdf',location:'page 999'}})])]});await pointer.build();
  check('reproduced: primary source pointer remains model-controlled',()=>{
    assert.equal(pointer.state.published[0].sources[0].filename,'source.pdf');
    assert.deepEqual(pointer.state.published[0].conditions[0].facts[0].sources,[{filename:'never-read.pdf',location:'page 999'}]);
    assert.equal(H.validateLatteKnowledgeBase(pointer.state.published[0]).length,0);
  });
  check('distinct comparator facts survive exact KB dedupe',()=>{
    const merged=H.mergeLatteParts([response([fact('Hold if pulse < 60 bpm.'),fact('Hold if pulse > 60 bpm.')])]);
    assert.equal(merged.conditions[0].facts.length,2);
  });
  check('exact duplicate merges pointers without changing text',()=>{
    const a=fact('Assess skin color.'),b=fact('Assess skin color.',{sourcePointer:{filename:'source.pdf',location:'page 2'}});
    const f=H.mergeLatteParts([response([a,b])]).conditions[0].facts[0];assert.equal(f.text,a.text);assert.equal(f.sources.length,2);
  });
  const malformed=fixture({responses:[response(),{conditions:[null]}],chunks:[{text:'Assess skin color.',label:'page 1',units:[]},{text:'Assess temperature.',label:'page 2',units:[]}]});await malformed.build();
  check('reproduced: malformed neighbor discards previously completed KB chunk',()=>{
    assert.equal(malformed.state.calls.length,2);assert(malformed.state.logs.some(l=>l.m.includes('— 1 fact(s)')));
    assert.equal(malformed.state.published.length,0);assert.match(malformed.state.error,/null/);assert.equal(malformed.state.busy,false);
  });
  const failed=fixture({responses:[response(),new Error('Synthetic network error')],chunks:[{text:'Assess skin color.',label:'page 1',units:[]},{text:'Assess temperature.',label:'page 2',units:[]}]});await failed.build();
  check('ordinary failed response retains completed independent chunk',()=>{
    assert.equal(failed.state.published.length,1);assert.equal(failed.state.diag.chunks[1].failed,true);assert(failed.state.warnings[0].includes('Synthetic network error'));
  });
  const wrongSchema=fixture({verifyPass:true,responses:[response(),{conditions:[]}]});await wrongSchema.build();
  check('reproduced: omission response missing required missed array appears successful',()=>{
    assert.equal(wrongSchema.state.error,'');assert.deepEqual(wrongSchema.state.warnings,[]);
    assert.equal(wrongSchema.state.diag.verified,true);assert(wrongSchema.state.logs.some(l=>l.m.includes('audit: +0 recovered')));
  });
  const brokenAudit=fixture({verifyPass:true,responses:[response(),'{"missed":[']});await brokenAudit.build();
  check('genuinely malformed omission JSON warns and retains primary content',()=>{
    assert.equal(brokenAudit.state.published.length,1);assert(brokenAudit.state.warnings.some(w=>w.includes('JSON truncated')));
  });
  const empty=fixture({responses:['']});await empty.build();
  check('empty extraction cannot publish empty successful KB',()=>{assert.equal(empty.state.published.length,0);assert(empty.state.error.includes('No source chunk completed'));});
  const split=fixture({responses:[opts=>{opts.onMeta({truncated:true});return '{"conditions":[';},response(),response([fact('Assess temperature.')])],chunks:[{text:'Assess skin color.\nAssess temperature.',label:'pages 1–2',units:[{kind:'page',n:1,text:'Assess skin color.'},{kind:'page',n:2,text:'Assess temperature.'}]}]});await split.build();
  check('MAX_TOKENS primary response splits real units and retains both successful retries',()=>{
    assert.equal(split.state.calls.length,3);assert.equal(split.state.published[0].conditions[0].facts.length,2);
    assert.equal(split.state.diag.chunks.length,2);
  });
  let release,entered;
  const ready=new Promise(r=>entered=r),late=fixture({responses:[async()=>{entered();return new Promise(r=>release=r);} ]});
  const pending=late.build();await ready;late.slot.cancel();release(JSON.stringify(response()));await pending;
  check('cancelled source build cannot publish a late successful response',()=>{assert.equal(late.state.published.length,0);});
  let releaseOld,enteredOld;
  const oldReady=new Promise(r=>enteredOld=r),overlap=fixture({responses:[async()=>{enteredOld();return new Promise(r=>releaseOld=r);}]});
  const oldBuild=overlap.build();await oldReady;
  const newKB=H.mergeLatteParts([response([fact('Assess temperature.')],'Replacement')]);
  await overlap.importJSON({size:100,text:async()=>JSON.stringify(newKB)});
  releaseOld(JSON.stringify(response()));await oldBuild;
  check('accepted import supersedes pending extraction without late replacement',()=>{
    assert.equal(overlap.state.published.length,1);assert.equal(overlap.state.published[0].conditions[0].name,'Replacement');
  });
  const validKB=H.mergeLatteParts([response([ordinary])]);
  check('ordinary import and persisted reload preserve supported fact text',()=>{
    const imported=H.kbNormalizeImported(validKB);assert.equal(imported.kb.conditions[0].facts[0].text,ordinary.text);assert.deepEqual(imported.dropped,{conditions:0,facts:0});
  });
  const longText='x'.repeat(3959)+'. Administer the synthetic medicine; do not administer to children.';
  const longKB=H.mergeLatteParts([response([fact(longText)])]);
  const importedLong=H.kbNormalizeImported(longKB);
  check('reproduced: import silently truncates a source-supported qualifying clause',()=>{
    assert(longText.includes('do not administer to children'));assert.equal(importedLong.kb.conditions[0].facts[0].text.length,4000);
    assert(!importedLong.kb.conditions[0].facts[0].text.includes('do not administer to children'));
    assert.deepEqual(importedLong.dropped,{conditions:0,facts:0});
  });
  let durable;
  const queue=H.kbCreateSaveQueue({write:async r=>{durable=clone(r);},remove:async()=>{},writeFallback:()=>{throw Error('unexpected fallback');},captureFallbacks:()=>null,clearFallbacks:()=>{},writer:'synthetic-writer'});
  await queue.save(longKB);
  const restored=H.kbNormalizeImported(H.kbReconcileStored([durable]).record.kb).kb;
  check('reproduced: actual save/reconcile/restore helper chain loses same qualifier on reload',()=>{
    assert.equal(durable.kb.conditions[0].facts[0].text,longText);
    assert.equal(restored.conditions[0].facts[0].text.length,4000);
  });
  trace.push({case:'persisted-truncation',before:longKB.conditions[0].facts[0].text,stored:durable.kb.conditions[0].facts[0].text,after:restored.conditions[0].facts[0].text,dropped:importedLong.dropped});
  check('reproduced: import condition/fact caps silently lose valid entries',()=>{
    const manyFacts=H.kbNormalizeImported(response(Array.from({length:5001},(_,i)=>fact('Synthetic source fact '+i))));
    assert.equal(manyFacts.kb.conditions[0].facts.length,5000);assert.deepEqual(manyFacts.dropped,{conditions:0,facts:0});
    const manyConditions=H.kbNormalizeImported({conditions:Array.from({length:2001},(_,i)=>({name:'Synthetic '+i,facts:[]}))});
    assert.equal(manyConditions.kb.conditions.length,2000);assert.deepEqual(manyConditions.dropped,{conditions:0,facts:0});
  });
  check('unit grouping and split preserve page identity and source-supported text',()=>{
    const units=[{kind:'page',n:1,text:'One.'},{kind:'page',n:2,text:'Two.'},{kind:'page',n:3,text:'Three.'}];
    const chunks=H.kbGroupUnits(units,7,1);assert.equal(chunks.length,3);assert.equal(chunks[1].text,'One.\nTwo.');
    const halves=H.kbSplitChunk({text:'One.\nTwo.',units:units.slice(0,2)});assert.deepEqual(halves.map(h=>h.label),['page 1','page 2']);
  });
  check('text quality distinguishes low-evidence page without claiming source correctness',()=>{
    const quality=H.kbTextQuality([{kind:'page',n:1,text:'\n--- PAGE 1 ---\n'}]);assert.equal(quality.empty,1);assert.equal(quality.total,0);
  });
  check('coordinate-aware PDF helper retains simple row and column separation',()=>{
    const item=(str,x,y,width)=>({str,width,transform:[12,0,0,12,x,y]});
    assert.equal(H.pdfLayoutText({items:[item('Pulse',10,100,30),item('< 60',80,100,30),item('Hold',10,80,25)]}),'Pulse < 60\nHold');
  });
  if(process.argv.includes('--trace'))console.log(JSON.stringify(trace,null,2));
  console.log(count+' source audit assertions passed'+(mutant?' (mutant '+mutant+')':''));
  if(!mutant){
    const expectedFailure={
      'quote-discard-bypass':'unsupported omission fact discarded while unrelated supported primary survives',
      'operator-warning-bypass':'changed explicit operator raises warning evidence',
      'publication-guard-bypass':'cancelled source build cannot publish a late successful response',
      'dedupe-collapse':'distinct comparator facts survive exact KB dedupe',
    };
    for(const name of ['quote-discard-bypass','operator-warning-bypass','publication-guard-bypass','dedupe-collapse']){
      const result=cp.spawnSync(process.execPath,[__filename,'--mutant',name],{encoding:'utf8'});
      assert.equal(result.status,1,'mutation must fail relevant checks: '+name+'\n'+result.stdout+'\n'+result.stderr);
      assert.match(result.stderr,/AssertionError/,'mutation failure must be an assertion, not extraction or syntax');
      assert(result.stderr.includes('Audit assertion failed: '+expectedFailure[name]),'mutation must trip its intended semantic check: '+name+'\n'+result.stderr);
      console.log('KILLED '+name);
    }
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
