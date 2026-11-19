'use strict';
// Independent re-audit. Only shipped function spans execute; all source/API/storage
// inputs are synthetic and the script has no network or third-party dependencies.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const filename = 'Nursing-Study-Suite v16.6.html';
const html = fs.readFileSync(path.join(root, filename), 'utf8');
const anchors = [], mutations = [], results = [];
const builtins = Object.fromEntries(['Array','Object','String','Number','Boolean','Set','Map','Date','Math','JSON','RegExp','Error','Promise','AbortController','DOMException','parseInt','Infinity'].map(k => [k, globalThis[k]]));
const clone = value => JSON.parse(JSON.stringify(value));
function span(start, end, tail) {
  assert.equal(html.split(start).length - 1, 1, 'unique start: ' + start);
  assert.equal(html.split(end).length - 1, 1, 'unique end: ' + end);
  const a = html.indexOf(start), b = html.indexOf(end);
  assert.ok(b > a, 'ordered span');
  const source = html.slice(a,b);
  assert.ok(source.includes(tail), 'non-vacuous tail: ' + tail);
  anchors.push({start,end,tail,startLine:html.slice(0,a).split('\n').length,endLine:html.slice(0,b).split('\n').length-1});
  return source;
}
function load(source, names, dependencies = {}) {
  const env = {...builtins,...dependencies};
  return new Function(...Object.keys(env), source + '\nreturn {' + names.join(',') + '};')(...Object.values(env));
}
function mutate(source, original, replacement, name) {
  assert.equal(source.split(original).length-1,1,'unique mutation anchor: '+name);
  return source.replace(original,replacement);
}
const coreSource = span('function kbBuildFocusBlock(', '// ── Durable Knowledge Base persistence', "formulas:arr('formulas'),contradictions:arr('contradictions')");
const core = load(coreSource, ['kbBuildFocusBlock','kbFlagUnderextraction','kbBucketGaps','kbSlug','kbFactKey','mergeLatteParts','kbNormalizeImported','KB_IMPORT_MAX_BYTES']);
const promptSource = span('const KB_EXTRACTION_PROMPT=', '// Focus context for the Knowledge Base.', 'Assign latteBucket, subtype, factType, safetyCritical, and tier');
const prompts = load(promptSource,['KB_EXTRACTION_PROMPT','KB_VERIFY_PROMPT']);
const extractSource = span('function extractJSON(text)', '// PDF text extraction (shared)', "throw new Error('JSON truncated.')");
const {extractJSON} = load(extractSource,['extractJSON']);
const qualitySource = span('function kbTextQuality(units)', '// v15.14: ONE page walk.', 'perPage};');
const {kbTextQuality} = load(qualitySource,['kbTextQuality']);
const wordsSource = span('const CASE_STOPWORDS=', 'function itemHeuristics(', '!CASE_STOPWORDS.has(w)');
const {caseContentWords} = load(wordsSource,['caseContentWords']);
const chunkSource = span('function kbUnitLabel(units)', '// ── v15.12: flashcard ingestion', 'excessRaster:u.composition.raster-medianRaster');
const chunkNames = ['kbSourceUnits','kbGroupUnits','kbSplitChunk','kbBuildSourceChunks','kbNormForMatch','kbDehyphNormForMatch','kbQuoteInSource','kbQuoteOperatorsAgree','kbCanonOperators','kbClassifyQuoteMiss'];
const ankiSource = span('function splitOversizedConditionBlock(', '// v16.0: actual review fronts can reveal an answer', "+body;");
let nextUid = 0;
const A = load(ankiSource, ['ankiChunkText','ankiParseCards','ankiSourceSnapshot','ankiChunkFactIds','attachCoverageToCards','ankiDedupeCards','ankiNormalizeConditionTags','lintAnkiCard','ankiPreviewText','ankiExportText','ankiNumericAudit','ankiBatchSummary','ankiConditionTagIndex','ankiConditionTagKey','clozeNums'],
  {uid:()=> 'synthetic-note-'+(++nextUid),ankiStyleWarnings:()=>{throw new Error('unexercised style diagnostic dependency');}});
const validateSource = span('function validateLatteKnowledgeBase(', '// ── KB source chunking', "return lines.join('\\n');");
const V = load(validateSource,['validateLatteKnowledgeBase','kbForAnki'],
  {ankiConditionTagIndex:A.ankiConditionTagIndex,ankiConditionTagKey:A.ankiConditionTagKey,ngFactRow:()=>{throw new Error('NCLEX excluded');}});
const operationSource = span('function createOperationSlot()', 'function cardCurrentEntries(', 'cancel(){active?.ctl.abort();active=null;}');
const {createOperationSlot} = load(operationSource,['createOperationSlot']);
const buildSource = span('  const build=async()=>{', '  // v15.10: the diagnostics panel is a scroll box', 'finally{if(replacementSlot.current.finish(run)){abortRef.current=null;setBusy(false);}}');
const importSource = span('  const importJSON=async file=>{', '  // v15.3 (Gemini', 'finally{if(replacementSlot.current.finish(run)){abortRef.current=null;setBusy(false);}}');
const persistenceSource = span("const KB_DB_NAME='", 'function validateLatteKnowledgeBase(', 'const result=tail.then(job);tail=result.catch(()=>{});return result;');
const memory = new Map();
const localStorage = {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
const P = load(persistenceSource,['kbRunTx','kbStoredRecord','kbStoredKey','kbReadFallbacks','kbCaptureFallbacks','kbClearFallbacks','kbCreateSaveQueue','kbReconcileStored','kbLoadPersisted','kbSavePersisted'],
  {window:{},indexedDB:{open(){throw new Error('Native IndexedDB excluded');}},localStorage});
function chunkHelpers(overrides={}) {
  return load(chunkSource,chunkNames,{kbTextQuality,caseContentWords,pdfjsLib:{OPS:{}},
    extractPptxText:async file=>file.syntheticText,
    pdfWalkPages:async(file,options)=>{for(let i=0;i<file.pages.length;i++){if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');await options.onPage(file.pages[i],i+1,{getOperatorList:async()=>({fnArray:[]})},file.pages.length);}},
    ...overrides});
}
const C = chunkHelpers();
const sampleSource = 'The signal lamp is green during readiness. The alarm remains off during readiness. The indicator is observed before the synthetic procedure.';
function fact(text=sampleSource, patch={}) {
  return {id:'fact-1',text,latteBucket:'Look',tier:1,factType:'other',safetyCritical:false,sourceQuote:sampleSource,
    sources:[{filename:'synthetic.pdf',location:'page 1'}],sourcePointer:{filename:'synthetic.pdf',location:'page 1'},...patch};
}
function kb(facts=[fact()]) {return {metadata:{course:'Synthetic'},conditions:[{id:'signal',name:'Signal',aliases:[],facts}],sources:[]};}
function reply(facts=[fact()]) {return {conditions:[{name:'Signal',aliases:[],facts}]};}
function makeRuntime({responses=[],pages=[sampleSource],verifyPass=false,source=buildSource,chunks=C,beforeResponse=null}={}) {
  const state = {published:[],logs:[],warnings:[],error:'',requests:[],diag:null,busy:false};
  const files=[{name:'synthetic.pdf',pages}],slot=createOperationSlot(),replacementSlot={current:slot};
  const env={...core,...prompts,...chunks,extractJSON,files,currentFiles:{current:files},replacementSlot,abortRef:{current:null},
    K:{setKnowledgeBase:value=>state.published.push(clone(value))},cfg:{apiKey:'synthetic-never-sent',autoProfile:false,forTool:()=>({model:'mock',level:'low'})},
    kbConfirmReplace:()=>true,cardGate:{buildable:[],blocked:[]},cardIsImage:()=>false,chunkChars:45000,overlapUnits:0,probeComposition:false,
    kbOutcomes:'',kbPoints:'',kbExtra:'',focusMode:'prioritize',course:'Synthetic',exam:'Synthetic',verifyPass,
    addLog:(m,t='')=>state.logs.push({m,t}),setBusy:v=>state.busy=v,setError:v=>state.error=v,setWarnings:v=>state.warnings=v,
    setProg:v=>state.progress=v,setDiag:v=>state.diag=clone(v),setLogs:v=>state.logs=v,setSelected:v=>state.selected=v,
    setCourse:v=>state.course=v,setExam:v=>state.exam=v,formatSize:v=>String(v),
    geminiRequest:async(key,model,body,opts)=>{
      const index=state.requests.length;
      // Preserve source/inventory bytes and hash frozen prompts rather than repeat
      // many kilobytes of the same instructions in every fixture trace.
      state.requests.push({model,sourceParts:body.contents[0].parts.slice(0,-1).map(p=>p.text),
        promptSha256:crypto.createHash('sha256').update(body.contents[0].parts.at(-1).text).digest('hex'),
        generationConfig:clone(body.generationConfig)});
      if(beforeResponse)await beforeResponse({index,slot,state});
      const response=responses[index];
      if(response instanceof Error)throw response;
      if(response===undefined)throw new Error('No synthetic response '+index);
      opts.onMeta?.(response.meta||{truncated:false});
      return typeof response==='string'?response:JSON.stringify(response.json||response);
    }};
  const handlers=load(source+'\n'+importSource,['build','importJSON'],env);
  return {...handlers,state,slot,env};
}
async function build(options) {const r=makeRuntime(options);await r.build();return r.state;}
async function importKB(value) {
  const r=makeRuntime();await r.importJSON({size:JSON.stringify(value).length,text:async()=>JSON.stringify(value)});return r.state;
}
function hasDiagnostic(state) {return !!state.error||state.warnings.length>0;}
async function test(id, category, rationale, fn) {
  const trace={};
  try {await fn(trace);results.push({id,category,rationale,status:'pass',trace});}
  catch(error) {results.push({id,category,rationale,status:'fail',error:{name:error.name,message:error.message,actual:error.actual,expected:error.expected},trace});}
}
function ankiChain(value, response) {
  const snapshot=A.ankiSourceSnapshot(value),packet=V.kbForAnki(value),chunks=A.ankiChunkText(packet,12000,2),parsed=A.ankiParseCards(response,1,'hierarchical-v1');
  const trace={snapshot,packet,chunks,response,parse:clone(parsed.cards)};
  trace.mappingIssues=A.attachCoverageToCards(parsed.cards,[{chunk:1,text:parsed.ledger}],snapshot,chunks.map(A.ankiChunkFactIds));
  trace.attachCoverageToCards=clone(parsed.cards);
  let cards=A.ankiDedupeCards(parsed.cards);trace.ankiDedupeCards=clone(cards);
  const normalized=A.ankiNormalizeConditionTags(cards,snapshot);cards=normalized.cards;trace.ankiNormalizeConditionTags=clone(cards);
  cards=cards.map(c=>({...c,lint:A.lintAnkiCard(c)}));trace.lint=clone(cards);trace.edit={applied:false,cards:clone(cards)};
  const batch={snapshot};trace.numeric=cards.map(c=>A.ankiNumericAudit(c,batch,true));trace.summary=A.ankiBatchSummary(cards,batch,true);
  trace.preview=cards.map(c=>({text:A.ankiPreviewText(c.text,1),revealed:A.ankiPreviewText(c.text,1,true),extra:A.ankiPreviewText(c.extra,0,true)}));
  trace.export=A.ankiExportText(cards,batch,true,'all',true,true);
  return trace;
}
async function main() {
  await test('source-units-control','control','The page/slide labels and all source text must survive real grouping.',async t=>{
    t.pdf=await C.kbBuildSourceChunks({name:'synthetic.pdf',pages:['first page text','second page text']},30,1,{onQuality:q=>t.quality=q});
    assert.equal(t.pdf.length,2);assert.deepEqual(t.pdf[1].units.map(u=>u.n),[1,2]);assert.equal(t.quality.pages,2);
    t.pptx=await C.kbBuildSourceChunks({name:'synthetic.pptx',syntheticText:'--- SLIDE 1 ---\nfirst\n--- SLIDE 2 ---\nsecond'},30,0);
    assert.equal(t.pptx.length,2);assert.equal(t.pptx[1].label,'slide 2');
  });
  await test('quote-dehyphenation-control','control','A linebreak inside a word is a formatting variant of the same source sentence.',t=>{
    const source='The signal indicates readi-\nness before operation.';
    t.accepted=C.kbQuoteInSource('The signal indicates readiness before operation.',C.kbNormForMatch(source),C.kbDehyphNormForMatch(source));
    assert.equal(t.accepted,true);
  });
  await test('quote-substring-control','control','A quoted phrase may legitimately omit surrounding sentence words when its own edge tokens are complete.',async t=>{
    t.source='The synthetic marker reads 600 units.';t.quote='synthetic marker reads 600';
    t.accepted=C.kbQuoteInSource(t.quote,C.kbNormForMatch(t.source),C.kbDehyphNormForMatch(t.source));
    t.output=await build({pages:[t.source],verifyPass:true,responses:[{conditions:[]},{missed:[{conditionName:'Signal',...fact(t.source,{sourceQuote:t.quote})}]}]});
    assert.equal(t.accepted,true);assert.equal(t.output.diag.recovered,1);
  });
  await test('QUOTE_PREFIX-numeric-token-boundary','unsupported-fact-admission','Source 600 does not contain the complete number token 60. A trailing numeric prefix cannot satisfy the existing pass-2 verbatim-quote admission rule.',async t=>{
    t.source='The synthetic marker reads 600 units.';t.quote='The synthetic marker reads 60';t.fact='The synthetic marker reads 60 units.';
    t.accepted=C.kbQuoteInSource(t.quote,C.kbNormForMatch(t.source),C.kbDehyphNormForMatch(t.source));
    t.output=await build({pages:[t.source],verifyPass:true,responses:[{conditions:[]},{missed:[{conditionName:'Signal',...fact(t.fact,{sourceQuote:t.quote})}]}]});
    t.expected={recovered:0,reason:'60 is only a prefix inside source numeric token 600'};
    assert.equal(t.output.diag.recovered,0,'partial numeric token must not admit an additive fact');
  });
  await test('import-valid-control','control','A complete valid import and valid numeric tier string must preserve source content.',async t=>{
    t.input=kb([fact('Keep the signal green.',{tier:'1',sourceQuote:'Keep the signal green.'})]);
    t.output=await importKB(t.input);assert.equal(t.output.published.length,1);assert.equal(t.output.published[0].conditions[0].facts[0].tier,1);assert.equal(t.output.published[0].conditions[0].facts[0].text,t.input.conditions[0].facts[0].text);assert.equal(hasDiagnostic(t.output),false);
  });
  await test('N3-invalid-tier-bucket','silent-content-change','An invalid priority/category has no source-supported replacement; import must reject or disclose coercion.',async t=>{
    t.input=kb([fact(sampleSource,{tier:'safety',latteBucket:'Pharm',safetyCritical:true})]);t.output=await importKB(t.input);
    t.normalized=core.kbNormalizeImported(t.input);t.validation=V.validateLatteKnowledgeBase(t.output.published[0]);t.ankiPacket=V.kbForAnki(t.output.published[0]);
    assert.ok(hasDiagnostic(t.output),'invalid tier/bucket must not silently become 3/Look');
  });
  await test('A2-fact-quote-truncation','silent-content-change','A final negation/exception in a valid long fact is substantive and cannot disappear without notice.',async t=>{
    const text='Read source carefully. '.repeat(200)+'EXCEPTION: never enable red.',quote='Source prefix '.repeat(50)+'EXCEPTION: never enable red.';
    t.inputLengths={text:text.length,sourceQuote:quote.length};t.output=await importKB(kb([fact(text,{sourceQuote:quote})]));
    const out=t.output.published[0].conditions[0].facts[0];t.actual={text:out.text.length,sourceQuote:out.sourceQuote.length,exceptionRetained:out.text.includes('EXCEPTION')};
    assert.ok(out.text===text&&out.sourceQuote===quote||hasDiagnostic(t.output),'long source text must remain intact or be reported');
  });
  await test('A2-condition-cap','lost-coverage','The 2001st valid condition is distinct source content; any resource-limit omission must be disclosed.',async t=>{
    const input={conditions:Array.from({length:2001},(_,i)=>({name:'Signal '+i,facts:[fact('Distinct signal '+i)]}))};
    const normalized=core.kbNormalizeImported(input);t.counts={input:input.conditions.length,output:normalized.kb.conditions.length,dropped:normalized.dropped};const output=await importKB(input);t.importWarnings=output.warnings;
    assert.ok(t.counts.output===2001||hasDiagnostic(output),'condition cap silently loses a valid condition');
  });
  await test('A2-fact-cap','lost-coverage','The 5001st valid fact is distinct source content; any resource-limit omission must be disclosed.',async t=>{
    const input=kb(Array.from({length:5001},(_,i)=>fact('Distinct signal '+i)));const normalized=core.kbNormalizeImported(input);
    t.counts={input:5001,output:normalized.kb.conditions[0].facts.length,dropped:normalized.dropped};const output=await importKB(input);t.importWarnings=output.warnings;
    assert.ok(t.counts.output===5001||hasDiagnostic(output),'fact cap silently loses a valid fact');
  });
  await test('A2-per-fact-source-cap','lost-coverage','Each of 51 distinct source pointers is evidence; a cap cannot silently remove the 51st pointer.',async t=>{
    const sources=Array.from({length:51},(_,i)=>({filename:'source-'+i+'.pdf',location:'page 1'}));
    t.output=await importKB(kb([fact(sampleSource,{sources})]));t.inputPointers=sources;t.outputCount=t.output.published[0].conditions[0].facts[0].sources.length;
    assert.ok(t.outputCount===51||hasDiagnostic(t.output),'per-fact source cap silently removes provenance');
  });
  await test('A2-merge-restore-length','silent-content-change','The app own merge accepts the full fact; restore must preserve its final exception instead of silently shortening an app-produced KB.',t=>{
    const text='x'.repeat(4000)+' EXCEPTION: do not activate';
    const merged=core.mergeLatteParts([reply([fact(text)])]);const restored=core.kbNormalizeImported(merged);
    t.inputLength=text.length;t.mergedLength=merged.conditions[0].facts[0].text.length;t.restoredLength=restored.kb.conditions[0].facts[0].text.length;t.dropped=restored.dropped;
    assert.equal(t.restoredLength,t.mergedLength,'merge-produced fact silently shortened during restore');
  });
  await test('build-valid-control','control','One valid extraction with a located quote must publish intact with actual quality data.',async t=>{
    t.output=await build({responses:[reply()]});assert.equal(t.output.published.length,1);assert.equal(t.output.diag.quoteMiss,0);assert.equal(t.output.published[0].conditions[0].facts[0].text,sampleSource);
    assert.ok(t.output.diag.quality['synthetic.pdf']);
  });
  await test('build-API-error-control','control','An ordinary later API failure should preserve earlier completed chunks and disclose the failure.',async t=>{
    const runtime=makeRuntime({responses:[reply(),new Error('Synthetic API outage')],pages:[sampleSource,sampleSource]});runtime.env.chunkChars=1;
    const handlers=load(buildSource+'\n'+importSource,['build'],runtime.env);await handlers.build();t.output=runtime.state;
    assert.equal(t.output.published.length,1);assert.ok(t.output.warnings.some(w=>w.includes('Synthetic API outage')));
  });
  await test('A5-nested-primary-shape','lost-coverage','A malformed later condition must be isolated like an API chunk error; an earlier completed chunk must survive.',async t=>{
    const runtime=makeRuntime({responses:[reply(),{conditions:[null]}],pages:[sampleSource,sampleSource]});runtime.env.chunkChars=1;
    const handlers=load(buildSource+'\n'+importSource,['build'],runtime.env);await handlers.build();t.output=runtime.state;
    assert.equal(t.output.published.length,1,'nested malformed condition discards the earlier completed chunk');
  });
  for(const malformed of [{missed:{}},{missed:null},{}]) await test('A6-omission-shape-'+JSON.stringify(malformed),'inconclusive-misreported','Only a well-shaped empty missed array establishes a completed omission audit; malformed output is inconclusive.',async t=>{
    t.response=malformed;t.output=await build({verifyPass:true,responses:[reply(),malformed]});
    assert.ok(hasDiagnostic(t.output),'malformed omission shape must be reported as incomplete/failed');
  });
  await test('omission-empty-control','control','An explicit empty missed array is a valid no-omission result.',async t=>{
    t.output=await build({verifyPass:true,responses:[reply(),{missed:[]}]});assert.equal(t.output.published.length,1);assert.equal(t.output.error,'');assert.equal(t.output.warnings.length,0);
  });
  const discardFixture=async source=>{
    const state=await build({source,verifyPass:true,responses:[reply(),{missed:[{conditionName:'Signal',...fact('The signal is ultraviolet.',{sourceQuote:'Ultraviolet mode is mandatory for every signal.'})}]}]});
    return state;
  };
  await test('pass2-discard-control','control','The additive omission contains no source quote and must be discarded under the approved strict pass-2 policy.',async t=>{
    t.output=await discardFixture(buildSource);assert.equal(t.output.diag.discarded,1);assert.equal(t.output.published[0].conditions[0].facts.length,1);
  });
  await test('pass1-retention-policy','policy-limit','Primary quote misses intentionally retain facts and count the failure; no semantic approval is inferred.',async t=>{
    t.output=await build({responses:[reply([fact('The signal is ultraviolet.',{sourceQuote:'Ultraviolet is mandatory for every signal.'})])]});
    assert.equal(t.output.published.length,1);assert.equal(t.output.diag.quoteMiss,1);
  });
  await test('operator-warning-policy','policy-limit','Source comparator < contradicts >; the approved operator policy warns without discarding.',async t=>{
    const source='Hold the synthetic operation when signal level < 60 units.';
    t.output=await build({pages:[source],verifyPass:true,responses:[{conditions:[]},{missed:[{conditionName:'Signal',...fact(source.replace('<','>'),{sourceQuote:source.replace('<','>')})}]}]});
    assert.equal(t.output.diag.opMismatch,1);assert.equal(t.output.diag.recovered,1);assert.ok(t.output.logs.some(l=>l.m.includes('disagree')));
  });
  await test('source-poison-chain','policy-limit','Original source says green; red is contradicted even if its attached quote accurately says green. Faithful KB conversion propagates this upstream error.',async t=>{
    const falseFact='The signal lamp is red during readiness.';
    t.independentExpectedVerdict='unsupported: red contradicts the original source green';
    t.originalSource=sampleSource;t.output=await build({responses:[reply([fact(falseFact,{sourceQuote:'The signal lamp is green during readiness.'})])]});
    const response='~~~'.replace(/~/g,String.fromCharCode(96))+'\nSignal lamp during readiness is {{c1::red}}.||Nursing::LATTE::Look Condition::Signal Tier::1\n'+'~~~'.replace(/~/g,String.fromCharCode(96))+'\n'+'~~~'.replace(/~/g,String.fromCharCode(96))+'text\nfact-1 -> #1\n'+'~~~'.replace(/~/g,String.fromCharCode(96));
    t.downstream=ankiChain(t.output.published[0],response);
    assert.equal(t.output.diag.quoteMiss,0);assert.equal(t.downstream.summary.coveredCount,1);assert.ok(t.downstream.export.includes('{{c1::red}}'));assert.deepEqual(t.downstream.lint[0].lint,[]);
    // This establishes a limit, not an unapproved new entailment gate.
  });
  await test('A7-fabricated-first-pass-pointer','unsupported-provenance','The runtime read only synthetic.pdf page 1; a model-authored never-read.pdf page 999 cannot be its evidence pointer.',async t=>{
    t.output=await build({responses:[reply([fact(sampleSource,{safetyCritical:true,sourcePointer:{filename:'never-read.pdf',location:'page 999'}})])]});
    t.validation=V.validateLatteKnowledgeBase(t.output.published[0]);t.packet=V.kbForAnki(t.output.published[0]);
    const fence=String.fromCharCode(96).repeat(3);
    t.downstream=ankiChain(t.output.published[0],fence+'\nSignal lamp during readiness is {{c1::green}}.||Nursing::LATTE::Look Condition::Signal Tier::1\n'+fence+'\n'+fence+'text\nfact-1 -> #1\n'+fence);
    const pointer=t.output.published[0].conditions[0].facts[0].sources[0];t.actualPointer=pointer;
    assert.ok(pointer.filename==='synthetic.pdf'||hasDiagnostic(t.output),'first-pass source pointer must bind to the actual source or report mismatch');
  });
  await test('A8-absent-quote-status','policy-limit','An absent quote cannot establish source support. Current quote-miss count excludes absent anchors, but structural validation separately warns.',async t=>{
    t.output=await build({responses:[reply([fact(sampleSource,{sourceQuote:''})])]});t.validation=V.validateLatteKnowledgeBase(t.output.published[0]);
    t.uiStaticEvidence={line:3047,condition:'diag.quoteMiss ? warning : green every-first-pass-quote-located',browserExecuted:false};
    assert.equal(t.output.diag.quoteMiss,0);assert.ok(t.validation.some(x=>x.severity==='warning'&&x.message.includes('no short verbatim source anchor')));
  });
  await test('quality-probe-failure','code-path-concern','A failed quality probe is unknown, not successful scan quality; currently exceptions vanish.',async t=>{
    const chunks=chunkHelpers({kbTextQuality:()=>{throw new Error('Synthetic quality failure');}});
    t.output=await build({chunks,responses:[reply()]});t.actualQuality=t.output.diag?.quality;
    assert.ok(hasDiagnostic(t.output)||t.output.logs.some(l=>/quality.*fail|probe.*fail/i.test(l.m)),'quality probe failure is silent');
  });
  await test('MAX_TOKENS-split-control','control','Truncated primary JSON must requeue both source halves instead of publishing partial JSON.',async t=>{
    t.output=await build({pages:[sampleSource,sampleSource],responses:[{json:{conditions:[]},meta:{truncated:true}},reply([fact('First complete chunk.')]),reply([fact('Second complete chunk.')])]});
    assert.equal(t.output.requests.length,3);assert.equal(t.output.published[0].conditions[0].facts.length,2);assert.ok(t.output.logs.some(l=>l.m.includes('splitting')));
  });
  const publicationFixture=source=>build({source,responses:[reply()],beforeResponse:({slot})=>slot.cancel()});
  await test('publication-control','control','Cancellation after the API starts must suppress late KB publication.',async t=>{
    t.output=await publicationFixture(buildSource);assert.equal(t.output.published.length,0);
  });
  await test('import-size-control','control','Import size gate must run before reading a large file.',async t=>{
    const r=makeRuntime();let reads=0;await r.importJSON({size:core.KB_IMPORT_MAX_BYTES+1,text:async()=>{reads++;return '{}';}});t.output=r.state;t.reads=reads;assert.equal(reads,0);assert.equal(r.state.published.length,0);assert.ok(r.state.error.includes('larger'));
  });
  await test('persistence-order-control','control','Queued writes capture immutable snapshots and complete in order; ambiguous different-writer records stay unresolved.',async t=>{
    const writes=[],queue=P.kbCreateSaveQueue({writer:'synthetic',write:async r=>writes.push(clone(r)),remove:async r=>writes.push(clone(r)),writeFallback:()=>{},captureFallbacks:()=>({}),clearFallbacks:()=>{}});
    queue.setHead(null,{});const input=kb();const first=queue.save(input);input.conditions[0].facts[0].text='MUTATED';const second=queue.save(input);await Promise.all([first,second]);
    t.writes=writes;assert.equal(writes[0].kb.conditions[0].facts[0].text,sampleSource);assert.deepEqual(writes.map(w=>w.meta.sequence),[1,2]);
    t.conflict=P.kbReconcileStored([{kb:{a:1},meta:{writer:'one',sequence:1}},{kb:{a:2},meta:{writer:'two',sequence:2}}]);assert.equal(t.conflict.record,null);assert.equal(t.conflict.choices.length,2);
  });
  await test('persistence-transaction-control','control','The real transaction helper must wait for completion and reject aborts, always closing its handle.',async t=>{
    let transaction,closed=0,settled=false;
    const db={transaction:()=>transaction={objectStore:()=>({}),abort(){transaction.onabort();}},close:()=>closed++};
    const pending=P.kbRunTx(db,'readonly',(store,set)=>set('captured-value')).then(value=>{settled=true;return value;});
    await Promise.resolve();assert.equal(settled,false);transaction.oncomplete();assert.equal(await pending,'captured-value');assert.equal(closed,1);
    const aborted=P.kbRunTx(db,'readonly',()=>{});transaction.onabort();await assert.rejects(aborted,/aborted/);assert.equal(closed,2);
    t.actual={settledOnlyAfterCommit:true,closed,abortRejected:true};
  });
  await test('persistence-reload-loss','silent-content-change','Persistence writes the complete fact; reload sanitizer must not silently remove a final exception from the saved KB.',async t=>{
    const text='Keep checking the source. '.repeat(180)+'EXCEPTION: leave the alarm disabled.';let saved;
    const queue=P.kbCreateSaveQueue({writer:'synthetic',write:async r=>saved=clone(r),remove:async()=>{},writeFallback:()=>{},captureFallbacks:()=>({}),clearFallbacks:()=>{}});queue.setHead(null,{});await queue.save(kb([fact(text)]));
    const stored=P.kbStoredRecord(saved.kb,saved.meta),reconciled=P.kbReconcileStored([stored]),normalized=core.kbNormalizeImported(reconciled.record.kb);
    t.beforeLength=text.length;t.savedLength=saved.kb.conditions[0].facts[0].text.length;t.reloadedLength=normalized.kb.conditions[0].facts[0].text.length;t.dropped=normalized.dropped;
    assert.equal(t.reloadedLength,t.beforeLength,'actual reload normalizer truncates a previously persisted valid fact');
  });
  await test('persistence-id-scope','policy-limit','fact-N is snapshot-local; importing an ID gap deliberately renumbers it. It cannot independently identify saved external evidence.',t=>{
    t.input=kb([fact('First fact.',{id:'fact-7'}),fact('Second fact.',{id:'fact-42'})]);t.output=core.kbNormalizeImported(t.input);assert.deepEqual(t.output.kb.conditions[0].facts.map(f=>f.id),['fact-1','fact-2']);
  });
  for(const m of [
    {name:'pass2-quote-discard',old:'if(!kbQuoteInSource(f.sourceQuote,srcNorm,srcDehyph)){discarded++;noteMiss(2,f);continue;}',replacement:'if(false){discarded++;noteMiss(2,f);continue;}',fixture:discardFixture,check:s=>assert.equal(s.published[0].conditions[0].facts.length,1)},
    {name:'final-publication-guard',old:'if(!replacementSlot.current.current(run))return;\n      K.setKnowledgeBase(kb);',replacement:'if(false)return;\n      K.setKnowledgeBase(kb);',fixture:publicationFixture,check:s=>assert.equal(s.published.length,0)}
  ]) {
    const mutant=mutate(buildSource,m.old,m.replacement,m.name);const state=await m.fixture(mutant);let killed=false,message='';
    try {m.check(state);} catch(error){killed=true;message=error.message;}
    mutations.push({name:m.name,original:m.old,replacement:m.replacement,killed,message,trace:state});
  }
  const output={suite:'independent-source-reaudit',html:filename,sha256:crypto.createHash('sha256').update(html).digest('hex'),anchors,results,mutations,
    counts:{tests:results.length,pass:results.filter(r=>r.status==='pass').length,fail:results.filter(r=>r.status==='fail').length,mutationKilled:mutations.filter(m=>m.killed).length,mutationSurvived:mutations.filter(m=>!m.killed).length},
    limits:['No private source material','No live API','Native PDF/PPTX extraction mocked at boundary','Native IndexedDB/browser/React lifecycle not executed','Source-poison chain calls shipped stages directly; full Anki handler covered by separate lifecycle suite','No clinical correctness claim']};
  if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(output,null,2)+'\n');
  else {for(const r of results)process.stdout.write(r.status.toUpperCase()+' '+r.id+(r.error?' — '+r.error.message:'')+'\n');process.stdout.write(JSON.stringify(output.counts)+'\n');}
  process.exitCode=output.counts.fail||output.counts.mutationSurvived?1:0;
}
main().catch(error=>{process.stdout.write(JSON.stringify({suite:'independent-source-reaudit',fatal:{message:error.message,stack:error.stack},anchors,results,mutations})+'\n');process.exitCode=1;});
