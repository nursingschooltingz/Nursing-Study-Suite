'use strict';

// Synthetic only. Exercise the shipped KB build handler and its live helpers; the
// optional CLI patch applies exact reviewed replacements in memory, never on disk.
module.exports=async function ankiIntegritySourceRegression(S,t){
  function span(start,end,tail){
    if(S.split(start).length!==2||S.split(end).length!==2)throw Error('Ambiguous source regression anchor: '+start);
    const a=S.indexOf(start),b=S.indexOf(end,a);
    if(b<=a)throw Error('Reversed source regression anchor: '+start);
    const text=S.slice(a,b);if(!text.includes(tail))throw Error('Source regression tail missing: '+tail);return text;
  }
  const load=(code,names,env={})=>new Function(...Object.keys(env),code+'\nreturn {'+names.join(',')+'};')(...Object.values(env));
  const core=load(span('function kbBuildFocusBlock(', '// ── Imported-KB sanitizer', 'contradictions:parts.flatMap'),['kbBuildFocusBlock','kbFlagUnderextraction','kbBucketGaps','mergeLatteParts']);
  const {extractJSON}=load(span('function extractJSON(text)', '// PDF text extraction (shared)', "throw new Error('JSON truncated.')"),['extractJSON']);
  const prompts=load(span('const KB_EXTRACTION_PROMPT=', '// Focus context for the Knowledge Base.', 'Assign latteBucket, subtype, factType, safetyCritical, and tier'),['KB_EXTRACTION_PROMPT','KB_VERIFY_PROMPT']);
  const {caseContentWords}=load(span('const CASE_STOPWORDS=', 'function itemHeuristics(', '!CASE_STOPWORDS.has(w)'),['caseContentWords']);
  const {kbTextQuality}=load(span('function kbTextQuality(units)', '// v15.14: ONE page walk.', 'perPage};'),['kbTextQuality']);
  const {createOperationSlot}=load(span('function createOperationSlot()', 'function cardCurrentEntries(', 'cancel(){active?.ctl.abort();active=null;}'),['createOperationSlot']);
  const sourceCode=span('function kbUnitLabel(units)', '// ── v15.12: flashcard ingestion', 'excessRaster:u.composition.raster-medianRaster');
  const helperNames=['kbSourceUnits','kbGroupUnits','kbSplitChunk','kbBuildSourceChunks','kbNormForMatch','kbDehyphNormForMatch','kbQuoteInSource','kbQuoteNumericBoundedMatch','kbQuoteOperatorsAgree','kbCanonOperators','kbClassifyQuoteMiss','kbValidateExtractionEnvelope','kbQuoteCheckSummary'];
  function helpers({quality=kbTextQuality,compositionError=false}={}){
    return load(sourceCode,helperNames,{kbTextQuality:quality,caseContentWords,pdfjsLib:{OPS:{}},extractPptxText:async f=>f.syntheticText,
      pdfWalkPages:async(file,options)=>{for(let i=0;i<file.pages.length;i++)await options.onPage(file.pages[i],i+1,{getOperatorList:async()=>{if(compositionError)throw Error('synthetic composition failure');return{fnArray:[]};}},file.pages.length);}});
  }
  const H=helpers(),buildCode=span('  const build=async()=>{','  // v15.10: the diagnostics panel is a scroll box','finally{if(replacementSlot.current.finish(run)){abortRef.current=null;setBusy(false);}}');
  const source='The synthetic signal lamp remains green during readiness. The indicator is observed before the synthetic procedure.';
  const fact=(patch={})=>({text:source,sourceQuote:source,sourcePointer:{filename:'synthetic.pdf',location:'page 1'},latteBucket:'Look',tier:1,factType:'other',safetyCritical:false,...patch});
  const primary=(facts=[fact()])=>({conditions:[{name:'Signal',aliases:[],facts}]});
  const copy=v=>JSON.parse(JSON.stringify(v));
  async function build({responses=[primary()],pages=[source],verifyPass=false,chunks=H,probeComposition=false,chunkChars=45000}={}){
    const state={published:[],logs:[],warnings:[],error:'',requests:0,diag:null},files=[{name:'synthetic.pdf',pages}],slot=createOperationSlot();
    const env={...core,...prompts,...chunks,extractJSON,files,currentFiles:{current:files},replacementSlot:{current:slot},abortRef:{current:null},
      K:{setKnowledgeBase:v=>state.published.push(copy(v))},cfg:{apiKey:'synthetic-never-sent',autoProfile:false,forTool:()=>({model:'synthetic',level:'low'})},kbConfirmReplace:()=>true,cardGate:{buildable:[],blocked:[]},cardIsImage:()=>false,chunkChars,overlapUnits:0,probeComposition,
      kbOutcomes:'',kbPoints:'',kbExtra:'',focusMode:'prioritize',course:'Synthetic',exam:'Synthetic',verifyPass,
      addLog:(m,type)=>state.logs.push({m,type}),setBusy:v=>state.busy=v,setError:v=>state.error=v,setWarnings:v=>state.warnings=v,setProg:v=>state.progress=v,setDiag:v=>state.diag=copy(v),setLogs:v=>state.logs=v,setSelected:()=>{},
      geminiRequest:async(_key,_model,_body,opts)=>{const response=responses[state.requests++];if(response instanceof Error)throw response;if(response===undefined)throw Error('Missing synthetic response');opts.onMeta?.(response.meta||{truncated:false});return JSON.stringify(response.json||response);}};
    await load(buildCode,['build'],env).build();return state;
  }
  const throws=fn=>{try{fn();return false;}catch{return true;}};
  t('source envelope accepts complete empty primary and omission inventories',H.kbValidateExtractionEnvelope({conditions:[]}).conditions.length===0&&H.kbValidateExtractionEnvelope({missed:[]},true).missed.length===0);
  for(const bad of [{conditions:[null]},{conditions:[{name:'Signal',facts:'bad'}]},{conditions:[{name:'Signal',facts:[null]}]},{conditions:[{name:'Signal',facts:[fact()],aliases:'bad'}]}]){
    t('source envelope rejects malformed nested primary structure '+JSON.stringify(bad).slice(0,75),throws(()=>H.kbValidateExtractionEnvelope(bad)));
    const state=await build({responses:[primary(),bad],pages:[source,source],chunkChars:source.length+20});
    t('malformed later primary chunk preserves the earlier completed extraction '+JSON.stringify(bad).slice(0,55),state.published.length===1&&state.published[0].conditions[0].facts.length===1&&state.diag.chunks[1].failed&&state.warnings.length>0);
    t('quarantined primary response retains its exact raw evidence '+JSON.stringify(bad).slice(0,45),state.diag.chunks[1].primaryResponse.text===JSON.stringify(bad));
  }
  let state=await build({responses:[primary(),Error('synthetic request failure')],pages:[source,source],chunkChars:source.length+20});
  t('ordinary request failure retains completed primary content',state.published.length===1&&state.published[0].conditions[0].facts.length===1);
  state=await build({responses:[{conditions:[null]}]});
  t('all-malformed primary responses publish failure diagnostics without replacing the KB',state.published.length===0&&state.error.includes('No source chunk completed')&&state.diag?.buildStatus==='failed'&&state.diag.chunks.length===1&&state.diag.chunks[0].failed);
  t('all-failed diagnostics retain exact malformed evidence and zero checked quote denominators',state.diag?.chunks[0].primaryResponse.text==='{"conditions":[null]}'&&state.diag.quoteChecked===0&&state.diag.quoteMatched===0&&state.diag.quoteMiss===0&&state.diag.quoteMissing===0&&!H.kbQuoteCheckSummary(state.diag).complete);
  t('a failed first build exposes its diagnostics download outside the KB browser',S.includes("{diag&&diag.buildStatus==='failed'&&!(kb.conditions||[]).length&&<div")&&S.includes('Export failed-build diagnostics'));
  for(const bad of [{},{missed:{}},{missed:null},{missed:[null]},{missed:[fact(),{text:5}]}]){
    state=await build({verifyPass:true,responses:[primary(),bad]});
    t('malformed omission evidence is reported incomplete without losing primary content '+JSON.stringify(bad).slice(0,50),state.published.length===1&&state.published[0].conditions[0].facts.length===1&&state.diag.chunks[0].auditStatus==='failed'&&state.warnings.some(x=>x.includes('[audit]'))&&!state.logs.some(x=>x.m.includes('audit: +0')));
    t('quarantined omission response retains its exact raw evidence '+JSON.stringify(bad).slice(0,45),state.diag.chunks[0].auditResponse.text===JSON.stringify(bad));
  }
  state=await build({verifyPass:true,responses:[primary(),{missed:[]}]});
  t('explicit empty omission evidence completes the audit without an error',state.diag.chunks[0].auditStatus==='complete'&&!state.warnings.some(x=>x.includes('[audit]'))&&state.logs.some(x=>x.m.includes('audit: +0')));
  const invented={filename:'never-read.pdf',location:'page 999',modelDetail:'retained'};
  state=await build({responses:[primary([fact({sourcePointer:invented})])]});
  t('primary fact pointers use the file and source range actually read',JSON.stringify(state.published[0].conditions[0].facts[0].sources)==='[{"filename":"synthetic.pdf","location":"page 1"}]');
  t('diagnostics retain the complete original model pointer beside the runtime binding',JSON.stringify(state.diag.chunks[0].sourcePointerEvidence[0].modelPointer)===JSON.stringify(invented)&&state.diag.chunks[0].sourcePointerEvidence[0].boundPointer.location==='page 1');
  state=await build({responses:[primary([fact({sourcePointer:null})])]});
  t('missing primary pointer is bound without inventing a model claim',state.published[0].conditions[0].facts[0].sources[0].filename==='synthetic.pdf'&&state.diag.chunks[0].sourcePointerEvidence[0].modelPointer===null);
  state=await build({responses:[primary([fact(),fact({text:'Second source fact.',sourceQuote:''}),fact({text:'Third source fact.',sourceQuote:'This exact unsupported claim is absent.'})])]});
  t('first-pass quote counts reconcile checked, matched, failed and missing anchors',state.diag.quoteChecked===2&&state.diag.quoteMatched===1&&state.diag.quoteMiss===1&&state.diag.quoteMissing===1&&state.published[0].conditions[0].facts.length===3);
  let summary=H.kbQuoteCheckSummary(state.diag);
  t('mixed quote coverage remains advisory and cannot use complete wording',!summary.complete&&summary.checked===summary.matched+summary.failed&&summary.text.includes('1 fact(s) missing'));
  state=await build({responses:[primary([fact({sourceQuote:''})])]});summary=H.kbQuoteCheckSummary(state.diag);
  t('zero attempted checks explicitly report zero and missing anchors',summary.checked===0&&summary.missing===1&&!summary.complete&&summary.text.startsWith('0 first-pass'));
  t('a wholly located nonempty quote set can report completion',H.kbQuoteCheckSummary({quoteChecked:2,quoteMiss:0,quoteMissing:0}).complete);
  const checks=[
    ['numeric trailing prefix','The synthetic marker reads 60','The synthetic marker reads 600 units.',false],
    ['numeric leading suffix','60 units are recorded','160 units are recorded.',false],
    ['complete numeric substring','synthetic marker reads 600','The synthetic marker reads 600 units.',true],
    ['later complete occurrence','The synthetic marker reads 60','The synthetic marker reads 600 units. The synthetic marker reads 60 units.',true],
    ['existing alphabetic substring','marker remains green','The marker remains greenish.',true],
    ['dehyphenation control','The indicator shows readiness','The indicator shows readi-\nness.',true],
    ['dehyphenation numeric prefix','The readiness marker reads 60','The readi-\nness marker reads 600.',false],
    ['dehyphenation complete numeric token','The readiness marker reads 600','The readi-\nness marker reads 600.',true]
  ];
  for(const [label,quote,text,expected]of checks)t('bounded quote matching: '+label,H.kbQuoteInSource(quote,H.kbNormForMatch(text),H.kbDehyphNormForMatch(text))===expected);
  const prefixQuote='The synthetic marker reads 60',prefixSource='The synthetic marker reads 600 units.';
  t('partial numeric token receives a distinct actionable quote diagnostic',H.kbClassifyQuoteMiss(prefixQuote,H.kbNormForMatch(prefixSource),H.kbDehyphNormForMatch(prefixSource))==='numericBoundary');
  state=await build({pages:[prefixSource],verifyPass:true,responses:[primary([fact({text:prefixSource,sourceQuote:prefixSource})]),{missed:[fact({text:'The synthetic marker reads 60 units.',sourceQuote:prefixQuote,conditionName:'Signal'})]}]});
  t('partial numeric omission anchor cannot add the altered fact',state.diag.recovered===0&&state.diag.discarded===1&&state.diag.discardByReason.numericBoundary===1&&state.published[0].conditions[0].facts.length===1);
  state=await build({pages:[prefixSource],responses:[primary([fact({text:'The synthetic marker reads 60 units.',sourceQuote:prefixQuote})])]});
  t('primary partial numeric anchor warns and retains its fact under the established pass policy',state.diag.quoteMiss===1&&state.diag.byReason.numericBoundary===1&&state.published[0].conditions[0].facts.length===1);
  const operatorSource='The synthetic signal must remain below < 60 units.';
  state=await build({pages:[operatorSource],verifyPass:true,responses:[primary([]),{missed:[fact({text:'The synthetic signal must remain above > 60 units.',sourceQuote:operatorSource.replace('<','>'),conditionName:'Signal'})]}]});
  t('operator disagreement stays WARN tier and does not discard the omission fact',state.diag.recovered===1&&state.diag.discarded===0&&state.diag.opMismatch===1);
  state=await build({chunks:helpers({quality:()=>{throw Error('synthetic quality failure');}})});
  t('quality helper failure is visible without losing extracted content',state.published.length===1&&state.diag.diagnosticsUnavailable.some(x=>x.kind==='text quality')&&state.warnings.some(x=>x.includes('diagnostics unavailable')));
  state=await build({chunks:helpers({compositionError:true}),probeComposition:true});
  t('page composition failure is visible without suppressing usable source text',state.published.length===1&&state.diag.diagnosticsUnavailable.some(x=>x.kind==='page 1 composition')&&state.warnings.some(x=>x.includes('synthetic composition failure')));
  t('diagnostics download persists quote denominators and unavailable evidence',S.includes('quoteChecked:diag.quoteChecked,quoteMissing:diag.quoteMissing,quoteMatched:diag.quoteMatched')&&S.includes('diagnosticsUnavailable:diag.diagnosticsUnavailable'));
  t('diagnostics UI uses the tested denominator summary and its bounded complete predicate',S.includes("color:kbQuoteCheckSummary(diag).complete?'var(--accent-green)':'var(--text-dim)'")&&S.includes('{kbQuoteCheckSummary(diag).text}'));
};

if(require.main===module){
  const fs=require('fs'),{resolveSuiteFile}=require('./repo-checks');let S=fs.readFileSync(resolveSuiteFile(),'utf8');
  const flag=process.argv.indexOf('--patch');
  if(flag!==-1){const edits=JSON.parse(fs.readFileSync(process.argv[flag+1],'utf8')).edits;for(const e of edits){if(S.split(e.old).length!==2)throw Error('Patch is no longer unique: '+e.old.slice(0,70));S=S.replace(e.old,e.new);}}
  let passed=0,failed=0;module.exports(S,(label,ok)=>{if(ok)passed++;else failed++;process.stdout.write((ok?'PASS ':'FAIL ')+label+'\n');}).then(()=>{console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;}).catch(e=>{console.error(e);process.exitCode=1;});
}
