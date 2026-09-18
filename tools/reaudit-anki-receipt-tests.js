'use strict';

// Independent desired-behavior audit. No network and no production modifications.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const {resolveSuiteFile}=require('./repo-checks');
const {validReceipt}=require('./fixtures/anki-audit-response');
const suite=resolveSuiteFile(),S=fs.readFileSync(suite,'utf8');
function spanFrom(text,start,end){
  assert.equal(text.split(start).length-1,1,'unique start '+start);
  assert.equal(text.split(end).length-1,1,'unique end '+end);
  const a=text.indexOf(start),b=text.indexOf(end,a+start.length);
  assert(b>a,'ordered extraction boundaries');return text.slice(a,b);
}
const code=spanFrom(S,'function ankiParseCards(raw','function AnkiStyleBadges');
const names=['ankiSourceSnapshot','ankiParseCards','attachCoverageToCards','ankiDedupeCards','ankiNormalizeConditionTags','lintAnkiCard','ankiPreviewText','parseAnkiClozes','ankiExportText','ankiAuditGroups','ankiAuditPacket','ankiParseSourceAuditV4','ankiMergeSourceAuditResult','ankiAuditReviewItems','ankiRecallContext','ankiRecallIssues','ankiReceiptRecallIssues','ankiSourceLinkStatus','ankiNumericAudit','ankiMakeReviewDecision','ankiReviewDecisionCurrent','ankiReviewDecisionEvidence','ankiSourceAuditEvidence','ankiSourceAuditCurrent','ankiSourceAuditPending','ankiSelection'];
function load(text=code){let next=0;return new Function('uid','globalThis','TextEncoder',text+';return {'+names.join(',')+'};')(()=> 'reaudit-note-'+(++next),{crypto:crypto.webcrypto},TextEncoder);}
const H=load(),copy=x=>JSON.parse(JSON.stringify(x)),results=[],traces=[],mutations=[];
function expect(id,category,rationale,fn){try{fn();results.push({id,category,rationale,pass:true});}catch(error){if(!(error instanceof assert.AssertionError))throw error;results.push({id,category,rationale,pass:false,expected:error.expected,actual:error.actual,message:error.message});}}
function make(text,extra='',factText='Store the red marker in the north drawer.',more={}){
  const kb={metadata:{schemaVersion:'1.0'},conditions:[{id:'workshop',name:'Workshop',aliases:[],facts:[{id:'fact-1',text:factText,sourceQuote:factText,latteBucket:'Educate',tier:1,sources:[{filename:'synthetic-source.txt',location:'line 1'}]}]}]};
  const snapshot=H.ankiSourceSnapshot(kb),response='```text\n'+text+'|'+extra+'|Topic::Workshop Tier::1\n```\n```text\nfact-1 -> line #1\n```';
  const parsed=H.ankiParseCards(response,1,'hierarchical-v1'),stages={parse:{before:response,after:copy(parsed.cards)}};
  const beforeMap=copy(parsed.cards);H.attachCoverageToCards(parsed.cards,[{chunk:1,text:parsed.ledger}],snapshot,[['fact-1']]);stages.map={before:beforeMap,after:copy(parsed.cards)};
  const deduped=H.ankiDedupeCards(parsed.cards);stages.dedupe={before:copy(parsed.cards),after:copy(deduped)};
  const normalized=H.ankiNormalizeConditionTags(deduped,snapshot);const cards=normalized.cards;stages.normalize={before:copy(deduped),after:copy(cards)};
  stages.lint={before:copy(cards),issues:cards.map(H.lintAnkiCard),after:copy(cards)};stages.edit={before:copy(cards),after:copy(cards),action:'No content edit requested in this fixture'};
  const batch={snapshot,chunkIds:[['fact-1']]},group=H.ankiAuditGroups(cards,batch,'all',4)[0],packet=H.ankiAuditPacket(group),raw=validReceipt(packet);
  const result={groupId:group.id,...H.ankiParseSourceAuditV4(JSON.stringify(raw),group)};
  const run={cards,batch,tier:'all',status:'complete',preparedAt:'synthetic-capture',groups:[group],results:[result],responses:[],failures:[]};
  const previews=cards.map(c=>({id:c.id,text:c.text,extra:c.extra,fronts:H.parseAnkiClozes(c.text).indices.map(index=>({index,front:H.ankiPreviewText(c.text,index,false),back:H.ankiPreviewText(c.text,index,true)}))}));
  stages.export={before:copy(cards),plain:H.ankiExportText(cards,batch,true,'all',false,false),html:H.ankiExportText(cards,batch,true,'all',true,false),withSources:H.ankiExportText(cards,batch,true,'all',true,true),after:copy(cards)};
  return {kb,snapshot,cards,batch,group,raw,result,run,stages,previews,...more};
}
function record(id,f,rationale){traces.push({id,source:copy(f.kb),sourceExpectation:rationale,snapshot:copy(f.snapshot),stages:f.stages,previews:f.previews,requestPacket:H.ankiAuditPacket(f.group),mockReceipt:f.raw,acceptedReceipt:f.result});}
function decodeHTML(text){return text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function roundTrip(f){
  for(const [kind,html] of [['plain',false],['html',true]]){
    const rows=f.stages.export[kind].split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split('|'));
    assert.equal(rows.length,H.ankiSelection(f.cards,true).kept.length);
    rows.forEach((fields,i)=>{assert.equal(fields.length,3);const decode=html?decodeHTML:x=>x;assert.equal(decode(fields[0]),f.cards[i].text);assert.equal(decode(fields[1]),f.cards[i].extra);assert.equal(fields[2],f.cards[i].tags);
      for(const target of f.previews[i].fronts){assert.equal(H.ankiPreviewText(decode(fields[0]),target.index,false),target.front);assert.equal(H.ankiPreviewText(decode(fields[0]),target.index,true),target.back);}
    });
  }
}
async function main(){
  expect('live-span-tail','control','Extraction must reach actual review decision implementation.',()=>{assert.equal(typeof H.ankiReviewDecisionEvidence,'function');assert(code.includes('superseded:latest.get(d.key)!==d'));});
  const examples=[
    {id:'supported-literal',text:'[Marker] Store red in the {{c1::north}} drawer.',expected:'supported',rationale:'North is the explicit source destination.'},
    {id:'supported-paraphrase',text:'[Marker] Place the red marker in the {{c1::north}} drawer.',expected:'supported',rationale:'Place preserves the supplied storage destination.'},
    {id:'contradictory-answer',text:'[Marker] Store the red marker in the {{c1::south}} drawer.',expected:'unsupported',rationale:'South contradicts the supplied north destination.'},
    {id:'visible-negation',text:'[Marker] Do not store the red marker in the {{c1::north}} drawer.',expected:'unsupported',rationale:'Visible negation reverses the directive.'},
    {id:'extra-addition',text:'[Marker] Store the red marker in the {{c1::north}} drawer.',extra:'The marker dissolves in water.',expected:'unsupported',rationale:'No source statement describes solubility.'},
    {id:'hint-addition',text:'[Marker] Store the red marker in the {{c1::north::sterile drawer}} drawer.',expected:'unsupported',rationale:'The source supplies no sterility property.'},
    {id:'irrelevant-real-reference',text:'[Marker] Store the red marker in the {{c1::north}} drawer.',source:'The blue square belongs in the east cabinet.',expected:'unsupported',rationale:'The existing source ID refers to a different object and destination.'},
    {id:'inconclusive-population',text:'[Marker] Store the marker in the {{c1::north}} drawer.',source:'Red markers go north; blue markers go south.',expected:'inconclusive',rationale:'Without color the destination is underdetermined, not proven true or false.'},
    {id:'entity-and-hint-preservation',text:'[Marker] The symbol {{c1::< &amp; >::symbol}} is literal.',extra:'Literal <tag> &amp; and "quote".',source:'The symbol < &amp; > is literal. Literal <tag> &amp; and "quote".',expected:'supported',rationale:'Characters, entities, hint and Extra must retain their literal values under text-only export.'}
  ];
  for(const spec of examples){const f=make(spec.text,spec.extra||'',spec.source),queue=H.ankiAuditReviewItems(f.run,f.cards,f.batch,'all');record(spec.id,f,spec.rationale);
    expect(spec.id+'-roundtrip','control',spec.rationale,()=>roundTrip(f));
    expect(spec.id+'-immutability','control','Advisory checking must never rewrite the supplied note.',()=>assert.deepEqual(f.stages.export.before,f.stages.export.after));
    if(spec.expected==='supported')expect(spec.id+'-preserved','control',spec.rationale,()=>{assert(f.result.complete);assert.equal(f.result.noteReviews[0].text.status,'supported');assert.equal(f.cards.length,1);});
    else expect(spec.id+'-semantic-expectation','semantic-limit',spec.rationale,()=>assert.equal(f.result.noteReviews[0][spec.id==='extra-addition'?'extra':'text'].status,spec.expected));
    traces.at(-1).queueCodes=queue.map(x=>x.code);
  }
  const f=make('[Marker] Store the red marker in the {{c1::north}} drawer.'),parse=v=>H.ankiParseSourceAuditV4(JSON.stringify(v),f.group),inputs={cards:f.cards,batch:f.batch,tier:'all',current:true};
  expect('real-source-shape','control','Source pointers must come from the actual snapshot helper.',()=>assert.deepEqual(f.snapshot.facts[0].sources,[{filename:'synthetic-source.txt',location:'line 1'}]));
  expect('source-footers','control','Export references must use the captured file and location.',()=>{assert(f.stages.export.withSources.includes('synthetic-source.txt'));assert(f.stages.export.withSources.includes('line 1'));assert.equal(f.cards[0].extra,'');});
  for(const raw of ['', '{"factReviews":', '{}'])expect('invalid-json-'+JSON.stringify(raw),'control','Absent/incomplete evidence cannot become completed audit.',()=>assert.throws(()=>H.ankiParseSourceAuditV4(raw,f.group)));
  const badHandle=copy(f.raw);badHandle.factReviews[0].targets[0].noteRefs[0].noteId='n01';
  expect('invalid-handle-incomplete','control','An unrecognized note address must remain unresolved.',()=>assert.equal(parse(badHandle).complete,false));
  const shortInventory=copy(f.raw);shortInventory.factReviews[0].inventory[0].sourceRef.end--;shortInventory.factReviews[0].targets[0].sourceRef.end--;
  expect('missing-inventory-tail-incomplete','control','A source token cannot silently disappear from accounting.',()=>assert.equal(parse(shortInventory).complete,false));
  const badIndex=copy(f.raw);badIndex.factReviews[0].targets[0].noteRefs[0].clozeIndices=[99];
  const badSource=copy(f.raw);badSource.noteReviews[0].text.evidence[0].factId='fact-999';
  for(const [name,raw]of [['missing-cloze',badIndex],['unknown-evidence',badSource]])expect(name+'-public-decoder','control','The public boundary must reject the malformed evidence even when a leaf helper returns no warning.',()=>assert.equal(parse(raw).complete,false));
  const emptyEvidence=copy(f.raw);emptyEvidence.noteReviews[0].text.evidence=[];
  expect('missing-evidence-no-supported-receipt','control','A supported declaration without its required evidence must remain unresolved.',()=>{const r=parse(emptyEvidence);assert.equal(r.complete,false);assert.equal(r.noteReviews.length,0);assert(r.unresolved.some(x=>x.recordType==='noteReview'));});
  emptyEvidence.noteReviews[0].text.status='unsupported';
  expect('missing-evidence-no-invented-falsehood','control','Missing evidence alone cannot substitute for the explicit finding required by an unsupported receipt.',()=>assert.equal(parse(emptyEvidence).complete,false));
  emptyEvidence.findings=[{code:'unsupported',factIds:[],noteIds:['n1'],message:'Synthetic false-negative checker judgment for a supported card.',suggestion:''}];
  expect('false-negative-checker-does-not-deselect','control','A mistaken advisory judgment must leave a source-supported card available.',()=>{const accepted=parse(emptyEvidence);assert(accepted.complete);assert.equal(H.ankiSelection(f.cards,true).kept.length,1);assert.equal(H.ankiExportText(f.cards,f.batch,true,'all',false,false),f.stages.export.plain);});
  const context=H.ankiRecallContext(f.run),target=f.result.factReviews[0].targets[0];
  const missingShapes=[{...target,noteRefs:[]},{...target,noteRefs:[{noteId:'missing',clozeIndices:[1]}]},{...target,noteRefs:[{noteId:f.cards[0].id,clozeIndices:[99]}]}];
  for(const [i,shape]of missingShapes.entries()){const warnings=H.ankiReceiptRecallIssues(shape,'fact-1',f.run,context);traces.push({id:'missing-receipt-shape-'+i,input:shape,leafWarnings:warnings,meaning:'No applicable heuristic result, not a supported verdict.'});expect('missing-receipt-shape-'+i,'control','Missing evidence must not manufacture an affirmative approval.',()=>assert(!warnings.some(x=>x.status==='supported'||x.approved===true)));}
  const foreign=make('[Marker] {{c1::north}} Ж.'),unmapped={...foreign.cards[0],factIds:[]},disputed={...foreign.cards[0],mappingIssues:[{code:'out-of-chunk'}]};
  for(const [id,card]of [['unmapped',unmapped],['disputed',disputed]]){const warnings=H.ankiRecallIssues(card,foreign.snapshot),status=H.ankiSourceLinkStatus(card,foreign.snapshot),numeric=H.ankiNumericAudit(card,foreign.batch,true);traces.push({id,card,recallWarnings:warnings,sourceLinkStatus:status,numeric});expect(id+'-not-approved','control','An inapplicable script heuristic is not approval; independent mapping diagnostics must remain visible.',()=>{assert.notEqual(status.code,'linked');assert(!warnings.some(x=>x.status==='supported'));});}
  const numeric=make('[Timing] Observe for 7 minutes; test the {{c1::blue}} marker.','','Observe for 7 minutes; test the blue marker.');
  const nctx=H.ankiRecallContext(numeric.run),nt=numeric.result.factReviews[0].targets[0];
  expect('receipt-number-not-hidden','control','7 is supplied but the referenced hidden answer blue does not test it.',()=>assert(H.ankiReceiptRecallIssues(nt,'fact-1',numeric.run,nctx).some(x=>x.code==='receipt-number-mismatch')));
  const invalidNumericRef={...nt,noteRefs:[{noteId:'missing',clozeIndices:[1]}]};
  traces.push({id:'numeric-ref-missing',source:copy(numeric.kb),target:invalidNumericRef,leafWarnings:H.ankiReceiptRecallIssues(invalidNumericRef,'fact-1',numeric.run,nctx),publicBoundaryRejectsInvalidRef:true});
  // Suggestion application is intentionally manual; a review decision never edits a note.
  const suggestion={code:'unsupported',factIds:['fact-1'],noteIds:['n1'],message:'Mock checker proposes an unsupported replacement.',suggestion:'[Marker] Use {{c1::radiation}} to sterilize the marker.'};
  const suggestedRaw=copy(f.raw);suggestedRaw.findings=[suggestion];const suggested={groupId:f.group.id,...parse(suggestedRaw)},suggestedRun={...f.run,results:[suggested]};
  const items=H.ankiAuditReviewItems(suggestedRun,f.cards,f.batch,'all'),item=items.find(x=>x.source==='finding'),before=copy(f.cards),decisions=[];
  for(const disposition of ['fixed','intentional-context','covered-elsewhere','unresolved'])expect('decision-'+disposition+'-no-repair','control','A source-unsupported suggestion or acknowledgement cannot automatically replace original content.',()=>{const d=H.ankiMakeReviewDecision(item,disposition,f.cards[0].id,'Synthetic manual decision',inputs,suggestedRun);decisions.push(d);assert.deepEqual(f.cards,before);assert.equal(H.ankiExportText(f.cards,f.batch,true,'all',false,false),f.stages.export.plain);assert.equal(H.ankiReviewDecisionCurrent(d,item,inputs,suggestedRun),true);});
  for(const [id,changed]of [['text',{cards:f.cards.map(c=>({...c,text:'[Marker] {{c1::unrelated}}.'}))}],['source',{batch:{...f.batch}}],['tier',{tier:'2'}],['selection',{cards:f.cards.map(c=>({...c,keep:false}))}]])expect('decision-invalidated-'+id,'control','Captured acknowledgements must not survive changed evidence.',()=>assert.equal(H.ankiReviewDecisionCurrent(decisions[0],item,{...inputs,...changed},suggestedRun),false));
  expect('covered-by-missing-rejected','control','A nonexistent note cannot be used as manual coverage evidence.',()=>assert.throws(()=>H.ankiMakeReviewDecision(item,'covered-elsewhere','missing','',inputs,suggestedRun)));
  const decisionEvidence=H.ankiReviewDecisionEvidence(decisions,items,inputs,suggestedRun);traces.push({id:'suggestion-lifecycle',suggestion,stages:{beforeSuggestion:before,afterSuggestion:copy(f.cards),afterEachDecision:decisions.map(d=>({disposition:d.disposition,cards:copy(f.cards)}))},decisionEvidence});
  const first=copy(f.raw);first.noteReviews=[];const second=copy(f.raw);second.factReviews=[];const p1=parse(first),p2=parse(second),merged={groupId:f.group.id,...H.ankiMergeSourceAuditResult(p1,p2,f.group)};
  expect('complementary-retry-completes','control','Good independent records from the same immutable packet must survive a retry.',()=>{assert.equal(merged.complete,true);assert.equal(merged.factReviews.length,1);assert.equal(merged.noteReviews.length,1);assert.deepEqual(f.cards,before);assert.equal(H.ankiSourceAuditPending({...f.run,results:[merged]}).length,0);});
  expect('repeated-retry-no-record-duplication','control','Replaying accepted records must not append duplicate target or note receipts.',()=>{const again=H.ankiMergeSourceAuditResult(merged,merged,f.group);assert.equal(again.factReviews.length,1);assert.equal(again.noteReviews.length,1);assert.equal(again.findings.length,0);});
  expect('changed-packet-cannot-merge','control','Receipts from altered source content cannot reuse prior completion.',()=>assert.throws(()=>H.ankiMergeSourceAuditResult(p1,p2,{...f.group,facts:f.group.facts.map(x=>({...x,text:'Changed.'}))})));
  const report=await H.ankiSourceAuditEvidence(f.run,{...inputs,reviewItems:[],reviewDecisions:[]});
  expect('complete-report-honest-scope','control','Protocol completion must retain semantic limitation language.',()=>{assert(report.metadata.checkComplete);assert(report.metadata.audit.limitations.includes('do not certify'));});
  const stale=await H.ankiSourceAuditEvidence(f.run,{...inputs,cards:[...f.cards],reviewItems:[],reviewDecisions:[]});expect('stale-report-not-complete','control','Changed note capture invalidates completion.',()=>assert.equal(stale.metadata.checkComplete,false));
  function mutate(name,old,replacement,test){assert.equal(code.split(old).length-1,1,'unique mutation '+name);let outcome='survived',error='';try{test(load(code.replace(old,replacement)));}catch(e){if(!(e instanceof assert.AssertionError))throw e;outcome='killed';error=e.message;}mutations.push({name,outcome,error});}
  mutate('handle-guard-bypass',"if(typeof handle!=='string'||!handles.has(handle))",'if(false)',M=>assert.equal(M.ankiParseSourceAuditV4(JSON.stringify(badHandle),f.group).complete,false));
  mutate('handle-alias-guess',"if(typeof handle!=='string'||!handles.has(handle))","if(typeof handle==='string'&&/^n0+\\d+$/.test(handle))handle='n'+Number(handle.slice(1));if(typeof handle!=='string'||!handles.has(handle))",M=>assert.equal(M.ankiParseSourceAuditV4(JSON.stringify(badHandle),f.group).complete,false));
  mutate('inventory-guard-bypass','if(!tokens.length||covered.size!==tokens.length)','if(false)',M=>assert.equal(M.ankiParseSourceAuditV4(JSON.stringify(shortInventory),f.group).complete,false));
  const failed=results.filter(x=>!x.pass),reportOut={suite:require('path').basename(suite),sha256:crypto.createHash('sha256').update(fs.readFileSync(suite)).digest('hex'),results,summary:{passed:results.length-failed.length,failed:failed.length,failuresByCategory:Object.fromEntries([...new Set(failed.map(x=>x.category))].map(k=>[k,failed.filter(x=>x.category===k).length]))},traces,mutations,limitations:['The shared validReceipt fixture creates protocol-valid mock judgments; it is never the semantic oracle.','Preview/export equivalence decodes emitted escaping; it does not execute native Anki.','Leaf empty warnings are tested against public decoder rejection and independent mapping status, not mislabeled a pass.']};
  if(process.argv.includes('--json'))console.log(JSON.stringify(reportOut,null,2));else{for(const r of results)console.log((r.pass?'PASS ':'FAIL ')+r.id+' ['+r.category+']'+(r.pass?'':': '+r.message));console.log(JSON.stringify(reportOut.summary));for(const m of mutations)console.log(m.outcome.toUpperCase()+' '+m.name);}
  process.exitCode=failed.length?1:0;
  return reportOut;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=2;});
module.exports={main,load};
