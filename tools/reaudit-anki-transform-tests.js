#!/usr/bin/env node
'use strict';
// Independent, synthetic, offline audit. No production writes, third-party modules or API calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const suitePath = path.join(root, 'Nursing-Study-Suite v16.6.html');
const source = fs.readFileSync(suitePath, 'utf8');
const extraction = [];
function uniqueAt(haystack, needle) {
  const at = haystack.indexOf(needle);
  assert.ok(at >= 0 && haystack.indexOf(needle, at + needle.length) < 0, 'Unique anchor: ' + needle);
  return at;
}
function spanFrom(start, end) {
  const a = uniqueAt(source, start), b = uniqueAt(source, end);
  assert.ok(b > a, 'Ordered extraction');
  extraction.push({start, end, startLine: source.slice(0, a).split('\n').length, endLine: source.slice(0, b).split('\n').length});
  return source.slice(a, b);
}
const helperSource = spanFrom('function ankiParseCards(raw', 'function AnkiStyleBadges');
const scannerSource = spanFrom('const NEIA_TERMINOLOGY_RULES=[', '// Deterministic post-generation validation.');
const editSource = spanFrom('  const updateField=useCallback((id,f,v)', '\n  const exportTxt=useCallback(()=>');
const exportedNames = ['ankiParseCards','parseKBCoverage','ankiSourceSnapshot','attachCoverageToCards','ankiDedupeCards','ankiNormalizeConditionTags','ankiBatchSummary','parseAnkiClozes','clozeNums','ankiTier','lintAnkiCard','ankiSelection','ankiNumericTokens','ankiNumericAudit','ankiPreviewText','ankiExportText','ankiCollisionGroups','ankiReviewDecisionEvidence','ankiStyleWarnings'];
function loadHelpers(body = helperSource) {
  let serial = 0;
  const h = new Function('uid', body + '\nreturn {' + exportedNames.join(',') + '};')(() => 'synthetic-note-' + ++serial);
  h.ankiUnsafeAbbrevScan = new Function(scannerSource + '\nreturn ankiUnsafeAbbrevScan;')();
  h.edit = (cards, id, field, value) => {
    let next = cards;
    const update = new Function('useCallback','setCards','lintAnkiCard','ankiUnsafeAbbrevScan',editSource + '\nreturn updateField;')(
      fn => fn, setter => { next = setter(next); },h.lintAnkiCard,h.ankiUnsafeAbbrevScan);
    update(id, field, value);
    return next;
  };
  return h;
}
const clone = value => JSON.parse(JSON.stringify(value));
const tags = 'Nursing::LATTE::Treatments Condition::DiabetesMellitus Tier::1';
const note = (text, extra = '', tagString = tags) => text + '|' + extra + '|' + tagString;
const response = (lines, ledger) => '```text\n' + lines.join('\n') + '\n```\n```text\n' + ledger.join('\n') + '\n```';
const defaultPointer = {filename:'Synthetic lecture.txt',location:'line 1'};
function makeKB(texts, fixture = {}) {
  return {conditions:[{name:'Diabetes mellitus',aliases:['DM'],facts:texts.map((text,i)=>({id:'fact-'+i,text,tier:1,latteBucket:'Treatments',sourceQuote:fixture.quote || text,sources:fixture.sources === undefined ? [defaultPointer] : fixture.sources}))}]};
}
function fixture(id, fact, text, numeric, rationale, extra = {}) {
  return {id, category:'numeric',facts:[fact],lines:[note(text,extra.extra || '')],ledger:['fact-0 -> #1'],expectedParsed:1,expectedEligible:1,expectedNumeric:numeric,semanticSupported:numeric === 'clean',rationale,...extra};
}
const fixtures = [
  fixture('exact-dose','Dose is 5 mg.','Dose is {{c1::5 mg}}.','clean','The answer repeats the supplied dose.'),
  fixture('unit-word-variant','Dose is 5 milligrams.','Dose is {{c1::5 mg}}.','clean','The supported normalization milligrams → mg preserves amount and unit.'),
  fixture('microgram-symbol-variant','Dose is 5 micrograms.','Dose is {{c1::5 µg}}.','clean','Microgram word and micro sign denote the same explicitly supported unit.'),
  fixture('decimal-format','Dose is 5.00 mg.','Dose is {{c1::05.0 mg}}.','clean','Leading and trailing zero formatting preserves the decimal quantity.'),
  fixture('grouped-number','Volume is 1,000 mL.','Volume is {{c1::1000 ml}}.','clean','Thousands separators and unit letter case do not change the supplied amount.'),
  fixture('range-format','Dose is 5 to 10 mg.','Dose is {{c1::5–10 mg}}.','clean','The source range endpoints and unit are preserved.'),
  fixture('changed-number','Dose is 5 mg.','Dose is {{c1::7 mg}}.','warning','Seven is absent from the only linked fact.'),
  fixture('changed-unit','Dose is 5 mg.','Dose is {{c1::5 mcg}}.','warning','Milligrams and micrograms are distinct units.'),
  fixture('ascii-minus-changed','Temperature is 5 °C.','Temperature is {{c1::-5 °C}}.','warning','Negative five is not positive five.'),
  fixture('unicode-minus-changed','Temperature is 5 °C.','Temperature is {{c1::−5 °C}}.','warning','The mathematical minus sign must not turn negative five into positive five.',{classification:'implementation-defect'}),
  fixture('unicode-minus-faithful','Temperature is -5 °C.','Temperature is {{c1::−5 °C}}.','clean','ASCII hyphen-minus and mathematical minus denote the same negative value.',{classification:'implementation-defect'}),
  fixture('superscript-unit-changed','Length is 5 cm.','Area is {{c1::5 cm²}}.','warning','Square centimeters are not centimeters; unsupported compound units must not donate a matching prefix.',{classification:'implementation-defect'}),
  fixture('superscript-cubic-changed','Length is 5 cm.','Volume is {{c1::5 cm³}}.','warning','Cubic centimeters are not centimeters.',{classification:'implementation-defect'}),
  fixture('caret-unit-changed','Length is 5 cm.','Area is {{c1::5 cm^2}}.','warning','A unit exponent must not be silently discarded.'),
  fixture('fraction-unsupported','Dose is 2 mg.','Dose is {{c1::1/2 mg}}.','warning','One half does not equal two; an unsupported fraction must be flagged.'),
  fixture('scientific-unsupported','Dose is 2 mg.','Dose is {{c1::1e2 mg}}.','warning','Scientific notation is outside the supported tokenizer and must be flagged.'),
  fixture('quote-only','Monitor the dose.','Dose is {{c1::5 mg}}.','warning','A number occurring only in sourceQuote is outside the fact text supplied to generation.',{quote:'Dose is 5 mg.'}),
  fixture('extra-unsupported-number','Dose is 5 mg.','Dose is {{c1::5 mg}}.','warning','Extra adds a second dose absent from the fact.',{extra:'Also give 7 mg.'}),
  fixture('hint-unsupported-number','Dose is 5 mg.','Dose is {{c1::5 mg::7 mg}}.',null,'The visible hint adds an unsupported number; revealed-text numeric scope does not inspect hints.',{semanticSupported:false,classification:'heuristic-scope-limit',desiredAdvisory:true}),
  fixture('hint-faithful','Dose is 5 mg.','Dose is {{c1::5 mg::dose}}.','clean','The hint is a label; it adds no dose.'),
  fixture('qualifier-strengthened','The intervention may help.','The intervention {{c1::always helps}}.',null,'May does not support always.',{semanticSupported:false,classification:'semantic-heuristic-limit'}),
  fixture('negation-reversed','Do not give the intervention.','{{c1::Give}} the intervention.',null,'A prohibition does not support an instruction to administer.',{semanticSupported:false,classification:'semantic-heuristic-limit'}),
  fixture('comparator-reversed','Treat below 5 mg.','Treat {{c1::above 5 mg}}.',null,'The same threshold value with the opposite comparison is a different claim.',{semanticSupported:false,classification:'documented-semantic-limit'}),
  fixture('route-changed','Give 5 mg orally.','Give {{c1::5 mg intravenously}}.',null,'The source supplies oral administration only.',{semanticSupported:false,classification:'semantic-heuristic-limit'}),
  fixture('population-changed','Adults receive 5 mg.','{{c1::Children}} receive 5 mg.',null,'The source gives an adult dose and says nothing about children.',{semanticSupported:false,classification:'semantic-heuristic-limit'}),
  fixture('timeframe-changed','Give 5 mg before meals.','Give 5 mg {{c1::after meals}}.',null,'Before and after do not have the same temporal relationship.',{semanticSupported:false,classification:'semantic-heuristic-limit'}),
  fixture('time-value-changed','Observe for 5 hr.','Observe for {{c1::7 hr}}.','warning','Seven hours is absent from the fact.'),
  fixture('irrelevant-existing-reference','Monitor the skin.','Give {{c1::the intervention}}.',null,'The existing fact ID is valid but does not support this unrelated intervention.',{semanticSupported:false,classification:'mapping-association-limit'}),
  fixture('extra-unsupported-prose','Monitor the skin.','Monitor {{c1::the skin}}.',null,'The supplied fact does not say the intervention prevents infection.',{extra:'The intervention prevents infection.',semanticSupported:false,classification:'semantic-heuristic-limit'}),
  fixture('legitimate-paraphrase','Observe the skin.','{{c1::Monitor}} the skin.',null,'Observe and monitor are faithful wording variants in this synthetic instruction.',{semanticSupported:true}),
  fixture('escaped-entities','Literal text <5 & >3 &lt; remains literal.','Literal {{c1::<5 & >3 &lt;::a < b & c}} remains literal.',null,'Text, hints and Extra must survive HTML escaping as literal characters.',{extra:'Literal <em>content</em> &amp; &#60; "quoted".'}),
  fixture('multi-index','Observe skin and pulse.','Observe {{c1::skin}} and {{c2::pulse}}.',null,'Two independent cloze indices must generate two review previews.',{expectedReviews:2}),
  fixture('repeated-index','Observe skin and pulse.','Observe {{c1::skin}} and {{c1::pulse}}.',null,'One shared index masks two spans together and yields one review.',{expectedReviews:1}),
  fixture('nested-cloze','Observe the skin.','Observe {{c1::the {{c2::skin}}}}.',null,'Nested clozes are outside the documented flat subset.',{category:'structural',expectedEligible:0}),
  fixture('unclosed-cloze','Observe the skin.','Observe {{c1::skin.',null,'Unclosed clozes must not export.',{category:'structural',expectedEligible:0}),
  fixture('ambiguous-braces','Observe the skin.','Observe {{c1::skin}} }}.',null,'An extra closing delimiter makes structure ambiguous.',{category:'structural',expectedEligible:0}),
  fixture('zero-index','Observe the skin.','Observe {{c0::skin}}.',null,'Only positive indices are supported.',{category:'structural',expectedEligible:0}),
  fixture('empty-answer','Observe the skin.','Observe {{c1:: }}.',null,'An empty answer is not a valid cloze.',{category:'structural',expectedEligible:0}),
  fixture('four-indices','Observe A B C D.','{{c1::A}} {{c2::B}} {{c3::C}} {{c4::D}}.',null,'The supported contract caps distinct indices at three.',{category:'structural',expectedEligible:0}),
  fixture('pipe-in-field','Observe the skin.','Observe {{c1::skin|pulse}}.',null,'A literal pipe would create an extra field and must not export.',{category:'structural',expectedEligible:0}),
  fixture('manual-excluded','Dose is 5 mg.','Dose is {{c1::5 mg}}.','clean','Keep is a manual choice independent of structural validity.',{keep:false,expectedEligible:0}),
  fixture('stale-source','Dose is 5 mg.','Dose is {{c1::5 mg}}.','not-checked','Old-source notes remain inspectable but must not export.',{current:false,expectedEligible:0}),
  fixture('unknown-reference','Dose is 5 mg.','Dose is {{c1::5 mg}}.','not-checked','Unknown references must not count as valid source mappings.',{ledger:['fact-99 -> #1'],expectedLinked:0}),
  fixture('out-of-chunk-reference','Dose is 5 mg.','Dose is {{c1::5 mg}}.','not-checked','An existing ID absent from this chunk must not acquire a valid link.',{chunkIds:[[]],expectedLinked:0}),
  {id:'empty-response',category:'parse',facts:['Monitor skin.'],raw:'',expectedParsed:0,expectedEligible:0,rationale:'An empty response has no notes; orchestration must distinguish this from successful generation.'},
  {id:'nonempty-no-notes',category:'parse',facts:['Monitor skin.'],raw:'STOP: cannot produce notes.',expectedParsed:0,expectedEligible:0,rationale:'A STOP explanation is not a note; lifecycle tests check completion reporting.'},
  {id:'no-fence-fallback',category:'parse',facts:['Monitor skin.'],raw:note('Monitor {{c1::skin}}.'),expectedParsed:1,expectedEligible:1,rationale:'The parser supports a raw unfenced note, but without a ledger it is unmapped.'},
  {id:'multiline-negation-prefix-lost',category:'parse',facts:['Do not administer the intervention.'],lines:['Do not',note('{{c1::administer the intervention}}.')],ledger:['fact-0 -> #1'],expectedParsed:1,expectedEligible:null,expectedPreservedPrefix:'Do not',rationale:'Dropping the unpiped negation prefix changes the explicit prohibition into its opposite; export must retain the prohibition or require structural repair.',classification:'implementation-defect'},
  {id:'dropped-no-pipe-line',category:'parse',facts:['Dose is 5 mg.','Dose is 7 mg.'],lines:['Dose is {{c1::5 mg}}.',note('Dose is {{c1::7 mg}}.')],ledger:['fact-0 -> #1','fact-1 -> #2'],expectedParsed:2,expectedEligible:null,rationale:'A malformed generated note should remain reviewable and must not shift the next declared note identity.',classification:'implementation-defect',expectedSecondLink:'fact-1'},
  {id:'truncated-note',category:'parse',facts:['Monitor skin.'],raw:'```text\n'+note('Monitor {{c1::skin}}.')+'\nMonitor {{c1::pulse',expectedParsed:2,expectedEligible:null,rationale:'An incomplete final note should remain visible for correction instead of disappearing.',classification:'implementation-defect'},
  {id:'alias-normalization-collision',category:'dedupe',facts:['Dose is 5 mg.'],lines:[note('Dose is {{c1::5 mg}}.','',tags.replace('DiabetesMellitus','DM')),note('Dose is {{c1::5 mg}}.')],ledger:['fact-0 -> #1','fact-0 -> #2'],expectedParsed:2,expectedEligible:null,expectedFinalDistinct:1,rationale:'Two identical notes differing only by a proven source alias must not become byte-identical exported notes after dedupe.',classification:'implementation-defect'},
  {id:'exact-duplicate-union',category:'dedupe',facts:['Monitor skin.','Check the skin.'],lines:[note('Monitor {{c1::skin}}.'),note('Monitor {{c1::skin}}.')],ledger:['fact-0 -> #1','fact-1 -> #2'],expectedParsed:2,expectedEligible:1,expectedPostDedupe:1,expectedLinked:2,rationale:'Equivalent notes merge while preserving all distinct linked fact IDs.'},
  {id:'distinct-extra',category:'dedupe',facts:['Monitor skin and record findings.'],lines:[note('Monitor {{c1::skin}}.','Record findings.'),note('Monitor {{c1::skin}}.','')],ledger:['fact-0 -> #1','fact-0 -> #2'],expectedParsed:2,expectedEligible:2,expectedPostDedupe:2,rationale:'Different Extra content is not an equivalent note and must not disappear.'},
  {id:'distinct-answer',category:'dedupe',facts:['Monitor skin and pulse.'],lines:[note('Monitor {{c1::skin}}.'),note('Monitor {{c1::pulse}}.')],ledger:['fact-0 -> #1','fact-0 -> #2'],expectedParsed:2,expectedEligible:2,expectedPostDedupe:2,rationale:'Different answers must remain distinct.'},
  {id:'distinct-tag',category:'dedupe',facts:['Monitor skin.'],lines:[note('Monitor {{c1::skin}}.'),note('Monitor {{c1::skin}}.','',tags+' Topic::Contrast')],ledger:['fact-0 -> #1','fact-0 -> #2'],expectedParsed:2,expectedEligible:2,expectedPostDedupe:2,rationale:'Different effective tags must remain distinct.'},
  {id:'equivalent-tag-order',category:'dedupe',facts:['Monitor skin.'],lines:[note('Monitor {{c1::skin}}.'),note('Monitor {{c1::skin}}.','',tags.split(' ').reverse().join(' '))],ledger:['fact-0 -> #1','fact-0 -> #2'],expectedParsed:2,expectedEligible:1,expectedPostDedupe:1,rationale:'Tag order is not a semantic distinction.'},
  {id:'manual-keep-distinction',category:'dedupe',facts:['Monitor skin.'],lines:[note('Monitor {{c1::skin}}.'),note('Monitor {{c1::skin}}.')],ledger:['fact-0 -> #1','fact-0 -> #2'],keep:[true,false],expectedParsed:2,expectedEligible:1,expectedPostDedupe:2,rationale:'Dedupe must not undo a manual Keep distinction.'},
  {id:'invalid-duplicates-manual-repair',category:'edit',facts:['Monitor skin.'],lines:[note('Monitor skin.'),note('Monitor skin.')],ledger:['fact-0 -> #1','fact-0 -> #2'],edits:[{index:0,field:'text',value:'Monitor {{c1::skin}}.'},{index:1,field:'text',value:'Monitor {{c1::skin}}.'}],expectedParsed:2,expectedEligible:2,expectedPostDedupe:2,expectedCollision:true,rationale:'Invalid notes remain visible; after manual repair identical-front warnings must expose the resulting duplicate. Automatic dedupe on manual edits is a policy choice.'},
  {id:'edit-unchecked-repair',category:'edit',facts:['Monitor skin.'],lines:[note('Monitor skin.')],ledger:['fact-0 -> #1'],keep:false,edits:[{index:0,field:'text',value:'Monitor {{c1::skin}}.'}],expectedParsed:1,expectedEligible:0,rationale:'Repairing a manually unchecked note must not reselect it.'},
  {id:'edit-pipe-injection',category:'edit',facts:['Monitor skin.'],lines:[note('Monitor {{c1::skin}}.')],ledger:['fact-0 -> #1'],edits:[{index:0,field:'extra',value:'Text | another field'}],expectedParsed:1,expectedEligible:0,rationale:'A manual edit cannot introduce an unvalidated export delimiter.'},
  {id:'edit-newline-injection',category:'edit',facts:['Monitor skin.'],lines:[note('Monitor {{c1::skin}}.')],ledger:['fact-0 -> #1'],edits:[{index:0,field:'extra',value:'Text\nanother note'}],expectedParsed:1,expectedEligible:0,rationale:'A manual edit cannot create an extra export row.'},
  fixture('reference-sanitization','Monitor skin.','Monitor {{c1::skin}}.',null,'Export-only source pointers must be sanitized without changing editable Extra.',{sources:[{filename:'Synthetic|lecture.txt',location:'line 1\nsection 2'}],expectedPointer:'Synthetic / lecture.txt, line 1, section 2',extra:'Context.'}),
  fixture('missing-pointer','Monitor skin.','Monitor {{c1::skin}}.',null,'Missing source metadata is represented explicitly.',{sources:[],expectedPointer:'unavailable'}),
];

// Independent import model for the documented three-field, one-line, flat-cloze subset.
// It decodes exactly one HTML layer; it is NOT a native Anki integration test.
function decodeImport(text, html) {
  if(!text)return [];
  const expectedHeader = '#separator:Pipe\n#html:true\n#notetype:Cloze\n#tags column:3\n';
  if(html){assert.ok(text.startsWith(expectedHeader),'Exact import header');text=text.slice(expectedHeader.length);}
  function decode(value){return html?value.replace(/<br>/g,'\n').replace(/&(amp|lt|gt);/g,(_,key)=>({amp:'&',lt:'<',gt:'>'}[key])):value;}
  return text.split('\n').map(line=>{const fields=line.split('|');assert.equal(fields.length,3,'Three import fields');return {text:decode(fields[0]),extra:decode(fields[1]),tags:fields[2]};});
}
function independentReview(text, index, revealed) {
  return text.replace(/\{\{c([1-9][0-9]*)::([^{}]*?)(?:::([^{}]*))?\}\}/g,(_,n,answer,hint)=>Number(n)===index&&!revealed?'['+(hint||'...')+']':answer);
}
function runSuite(body, capture) {
  const h=loadHelpers(body),results=[],traces=[];
  function check(id,fn){try{fn();results.push({id,pass:true});}catch(error){results.push({id,pass:false,error:error.message});}}
  // Exercise the far end of the whole helper extraction, not merely its existence.
  check('extraction-tail-review-evidence',()=>{
    const cards=[],batch={},inputs={current:true,cards,batch,tier:'all'};
    const item={key:'tail-key',signature:'tail-signature',source:'local'};
    const decision={key:item.key,signature:item.signature,code:'test',noteIds:['n'],factIds:['fact-0'],disposition:'fixed',reason:'Synthetic review',at:'2026-09-18T00:00:00Z',scope:{cards,batch,tier:'all',preparedAt:null}};
    const evidence=h.ankiReviewDecisionEvidence([decision],[item],inputs,null);
    assert.equal(evidence.length,1);assert.equal(evidence[0].current,true);assert.equal(evidence[0].reason,'Synthetic review');assert.equal(evidence[0].superseded,false);
  });
  check('scanner-tail-live-behavior',()=>{const found=[];h.ankiUnsafeAbbrevScan('5.0 mg','Text',found);assert.equal(found.length,1);assert.match(found[0].msg,/trailing zero/);});
  for(const f of fixtures){
    try{
      const current=f.current!==false,kb=makeKB(f.facts,f),snapshot=h.ankiSourceSnapshot(kb),raw=f.raw===undefined?response(f.lines,f.ledger||[]):f.raw;
      const trace={id:f.id,category:f.category,rationale:f.rationale,classification:f.classification||'acceptance',semanticSupported:f.semanticSupported??null,input:{kb,raw},snapshot:clone(snapshot),stages:[]};
      const captureStage=(stage,before,after,detail={})=>trace.stages.push({stage,before:clone(before),after:clone(after),...clone(detail)});
      const parsed=h.ankiParseCards(raw,1,'hierarchical-v1');let cards=parsed.cards;
      if(f.keep!==undefined)cards=cards.map((c,i)=>({...c,keep:Array.isArray(f.keep)?f.keep[i]:f.keep}));
      captureStage('parse',raw,cards,{ledger:parsed.ledger});
      check(f.id+':parsed-notes',()=>assert.equal(cards.length,f.expectedParsed,f.rationale));
      const chunkIds=f.chunkIds||[snapshot.facts.map(x=>x.id)],beforeMap=clone(cards);
      const mappingIssues=h.attachCoverageToCards(cards,[{chunk:1,text:parsed.ledger}],snapshot,chunkIds);
      captureStage('attachCoverageToCards',beforeMap,cards,{mappingIssues});
      if(f.expectedSecondLink)check(f.id+':no-mapping-index-shift',()=>assert.ok(cards.find(c=>c.text.includes('7 mg'))?.factIds.includes(f.expectedSecondLink),f.rationale));
      const beforeDedupe=clone(cards);cards=h.ankiDedupeCards(cards);captureStage('ankiDedupeCards',beforeDedupe,cards);
      if(f.expectedPostDedupe!==undefined)check(f.id+':dedupe-retention',()=>assert.equal(cards.length,f.expectedPostDedupe,f.rationale));
      const beforeNormalize=clone(cards),normalized=h.ankiNormalizeConditionTags(cards,snapshot);cards=normalized.cards;
      captureStage('ankiNormalizeConditionTags',beforeNormalize,cards,{changes:normalized.changes,outcomes:normalized.outcomes,issues:normalized.issues});
      const beforeLint=clone(cards);cards.forEach(c=>{c.lint=h.lintAnkiCard(c);const found=[];h.ankiUnsafeAbbrevScan(c.text,'Text',found);h.ankiUnsafeAbbrevScan(c.extra,'Extra',found);c.abbrev=found.map(x=>x.msg);});
      captureStage('lint',beforeLint,cards);
      const beforeEdit=clone(cards),editSteps=[];
      for(const edit of f.edits||[]){const before=clone(cards);cards=h.edit(cards,cards[edit.index].id,edit.field,edit.value);editSteps.push({action:edit,before,after:clone(cards)});}
      captureStage('edit',beforeEdit,cards,{executed:!!f.edits,editSteps,handler:'extracted live updateField; no edit fixtures are explicit no-ops'});
      const batch={snapshot,rawCards:parsed.cards,postDedupeNotes:beforeNormalize.length,chunkIds,mappingIssues};
      const summary=h.ankiBatchSummary(cards,batch,current),audits=cards.map(c=>({id:c.id,...h.ankiNumericAudit(c,batch,current)}));
      captureStage('numeric',cards,cards,{audits});
      trace.selection=clone(summary);trace.collisions=h.ankiCollisionGroups(cards);
      trace.preview=cards.map(c=>({id:c.id,structure:h.lintAnkiCard(c),extra:c.extra,reviews:h.clozeNums(c.text).map(index=>({index,front:h.ankiPreviewText(c.text,index),back:h.ankiPreviewText(c.text,index,true)}))}));
      trace.exports=[];
      for(const html of [false,true])for(const references of [false,true])for(const tier of ['all','1','2']){
        const before=clone(cards),text=h.ankiExportText(cards,batch,current,tier,html,references);
        let decoded=[],decodeError=null;
        try{decoded=decodeImport(text,html);}catch(e){decodeError=e.message;}
        const expected=summary.kept.filter(c=>tier==='all'||h.ankiTier(c.tags)===tier);
        const variant={html,references,tier,text,decoded,decodeError};trace.exports.push(variant);
        check(f.id+':preview-export:'+html+':'+references+':'+tier,()=>{
          assert.equal(decodeError,null);assert.equal(decoded.length,expected.length,'Export selection count');
          expected.forEach((c,i)=>{
            assert.equal(decoded[i].text,c.text,'Decoded Text preserves all literal bytes');assert.equal(decoded[i].tags,c.tags,'Tags preserve literal bytes');
            const pointer=c.factIds.length?(f.expectedPointer||'Synthetic lecture.txt, line 1'):'unavailable';
            const expectedExtra=c.extra+(references?((c.extra?(html?'\n':' — '):'')+'Source: '+pointer):'');
            assert.equal(decoded[i].extra,expectedExtra,'Extra agrees with preview plus explicit export-only references');
            const indices=[...new Set([...decoded[i].text.matchAll(/\{\{c([1-9][0-9]*)::/g)].map(x=>Number(x[1])))];
            assert.deepEqual(h.clozeNums(c.text),indices,'Independent import cloze count');
            indices.forEach(index=>{assert.equal(h.ankiPreviewText(c.text,index),independentReview(decoded[i].text,index,false),'Masked front');assert.equal(h.ankiPreviewText(c.text,index,true),independentReview(decoded[i].text,index,true),'Revealed back');});
          });
          assert.deepEqual(cards,before,'Export is read-only');
        });
      }
      captureStage('export',cards,cards,{variants:trace.exports});
      if(f.expectedEligible!==undefined&&f.expectedEligible!==null)check(f.id+':eligible-notes',()=>assert.equal(summary.kept.length,f.expectedEligible,f.rationale));
      if(f.expectedReviews!==undefined)check(f.id+':review-count',()=>assert.equal(summary.reviews,f.expectedReviews));
      if(f.expectedPreservedPrefix)check(f.id+':no-exported-negation-loss',()=>assert.ok(summary.kept.every(c=>h.ankiPreviewText(c.text,0,true).startsWith(f.expectedPreservedPrefix)),f.rationale));
      if(f.expectedLinked!==undefined)check(f.id+':linked-count',()=>assert.equal(summary.coveredCount,f.expectedLinked));
      if(f.expectedCollision)check(f.id+':duplicate-advisory',()=>assert.ok(trace.collisions.length>0,'Duplicate repaired notes remain discoverable as identical fronts'));
      if(f.expectedFinalDistinct!==undefined)check(f.id+':no-byte-identical-export-duplicates',()=>{
        const rows=trace.exports.find(x=>x.html&&!x.references&&x.tier==='all').text.split('\n').filter(x=>!x.startsWith('#'));
        assert.equal(rows.length,f.expectedFinalDistinct,f.rationale);assert.equal(new Set(rows).size,rows.length,'No byte-identical rows');
      });
      if(f.expectedNumeric)check(f.id+':numeric-verdict',()=>{
        const a=audits[0];assert.ok(a,'Numeric fixture must contain a note');
        if(f.expectedNumeric==='clean')assert.equal(a.findings.length,0,f.rationale);
        if(f.expectedNumeric==='warning')assert.ok(a.findings.some(x=>x.code==='numeric-discrepancy'||x.code.startsWith('unsupported')||x.code==='quote-only'),f.rationale);
        if(f.expectedNumeric==='not-checked')assert.equal(a.status,'Not checked',f.rationale);
      });
      trace.semanticObservation=f.semanticSupported===false?{unsupportedByFixtureSource:true,eligible:summary.kept.length>0,numericFindings:audits.flatMap(x=>x.findings),interpretation:'Structural eligibility and association are not semantic approval. Missing heuristic warnings are separately classified; no semantic rejection policy is asserted.'}:null;
      if(capture)traces.push(trace);
    }catch(error){results.push({id:f.id+':execution',pass:false,error:error.stack});}
  }
  return {results,traces};
}
const baseline=runSuite(helperSource,true),mutations=[];
const mutationSpecs=[
  {id:'numeric-supported-short-circuit',old:'if(supported.has(token.key))continue;',replacement:'if(true)continue;'},
  {id:'lint-selection-filter',old:'const valid=scoped.filter(c=>!lintAnkiCard(c).length),kept=current?valid.filter(c=>c.keep):[];',replacement:'const valid=scoped,kept=current?valid.filter(c=>c.keep):[];'},
  {id:'dedupe-key-text-only',old:"JSON.stringify([String(c.text||''),String(c.extra||''),[...new Set(String(c.tags||'').trim().split(/\\s+/))].sort(),!!c.keep])",replacement:"JSON.stringify([String(c.text||'')])"},
];
for(const m of mutationSpecs){
  uniqueAt(helperSource,m.old);
  const mutant=runSuite(helperSource.replace(m.old,m.replacement),false);
  const passingBaseline=new Set(baseline.results.filter(x=>x.pass).map(x=>x.id));
  const newlyFailing=mutant.results.filter(x=>!x.pass&&passingBaseline.has(x.id));
  mutations.push({id:m.id,anchor:m.old,replacement:m.replacement,killed:newlyFailing.length>0,newlyFailing,otherFailures:mutant.results.filter(x=>!x.pass&&!passingBaseline.has(x.id))});
  baseline.results.push({id:'mutation-killed:'+m.id,pass:newlyFailing.length>0,...(newlyFailing.length?{}:{error:'Mutant survived: explicit coverage gap'})});
}
const failed=baseline.results.filter(x=>!x.pass);
const report={schema:1,scope:'Independent synthetic transform re-audit',command:[process.execPath,...process.argv.slice(1)],suitePath,htmlSha256:crypto.createHash('sha256').update(source).digest('hex'),extraction,fixtureCount:fixtures.length,summary:{assertions:baseline.results.length,passed:baseline.results.length-failed.length,failed:failed.length,mutantsKilled:mutations.filter(x=>x.killed).length},results:baseline.results,failures:failed,mutations,traces:baseline.traces,limits:['No native Anki import/rendering, real browser, model, private source or clinical correctness test.','Import equivalence is an independent string-level model of the supported three-field, flat-cloze contract. Headerless import presumes explicit Pipe / plain-text import settings.','Lifecycle publication, cancellation and source-check retry tests belong to companion scripts.','Semantic fixture expectations come from supplied synthetic text, not the validator; heuristics do not certify fidelity.']};
const args=process.argv.slice(2),outAt=args.indexOf('--out');
if(outAt>=0){assert.ok(args[outAt+1],'--out requires a path');const outPath=path.resolve(args[outAt+1]);fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');}
if(args.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else{console.log(JSON.stringify({suite:report.scope,htmlSha256:report.htmlSha256,fixtureCount:report.fixtureCount,...report.summary,failures:failed,mutations:mutations.map(m=>({id:m.id,killed:m.killed,newlyFailing:m.newlyFailing.map(x=>x.id)}))},null,2));}
process.exitCode=failed.length?1:0;
