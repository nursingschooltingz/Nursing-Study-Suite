'use strict';

const fs=require('fs');
const path=require('path');
const fixtures=require('./fixtures/anki-v166-quality-cases.json');

function extractQualityHelpers(S){
  const start='function ankiParseCards(raw',end='function AnkiStyleBadges',a=S.indexOf(start),b=S.indexOf(end,a+start.length);
  if(a<0||b<0||S.indexOf(start,a+1)>=0||S.indexOf(end,b+1)>=0)throw Error('Anki v16.6 quality extraction anchors missing or ambiguous');
  return new Function('uid',S.slice(a,b)+';return {ankiAuditSourceTokens,ankiAuditSourceRange,ankiContextInventoryIssues,ankiEvidenceReviewIssues,ankiRecallContext,ankiAuditReviewItems,ankiSelection,ankiExportText,ankiAnswerExposure};')(()=> 'synthetic-quality-note');
}

function hydrateQualityCase(spec,H){
  const fact={id:'fact-1',text:spec.source,aliases:[],...fixtures.defaults},facts=[fact],byId={'fact-1':fact},snapshot={facts,byId},batch={snapshot};
  const tokens=H.ankiAuditSourceTokens(fact.text);
  const range=span=>{
    const at=fact.text.indexOf(span);
    if(at<0||fact.text.indexOf(span,at+1)>=0)throw Error(spec.id+': fixture span must occur exactly once: '+span);
    const first=tokens.find(token=>token.start===at),last=tokens.find(token=>token.end===at+span.length);
    if(!first||!last)throw Error(spec.id+': fixture span must preserve complete source token boundaries: '+span);
    const ref={start:first.id,end:last.id},value=H.ankiAuditSourceRange(fact,ref);
    if(!value.ok||value.sourceSpan!==span)throw Error(spec.id+': live source-range hydration changed evidence');
    return {sourceSpan:value.sourceSpan,sourceRef:ref,sourceStart:value.sourceStart,sourceEnd:value.sourceEnd};
  };
  const note=(id,text,overrides={})=>({id,text,extra:'',tags:'Topic::Workshop Condition::VelaWorkshop Tier::1',keep:true,factIds:['fact-1'],mappingIssues:[],pipeCount:2,chunk:1,...overrides});
  const cards=[note('note-1',spec.text,{extra:spec.extra||''}),...(spec.otherNotes||[]).map(n=>note(n.id,n.text,n))];
  const factReviews=[];
  if(spec.inventory){
    const inventory=spec.inventory.map(entry=>({...range(entry.span),role:entry.role,reason:entry.reason||'A distinct supplied target.'}));
    let cursor=1;for(const entry of inventory){if(entry.sourceRef.start!==cursor)throw Error(spec.id+': fixture inventory gap or overlap');cursor=entry.sourceRef.end+1;}
    if(cursor!==tokens.length+1)throw Error(spec.id+': fixture inventory does not reach the end');
    const targets=spec.inventory.filter(entry=>entry.role==='target').map(entry=>({...range(entry.span),status:'tested',noteRefs:[{noteId:'note-1',clozeIndices:[entry.index]}],contextRefs:[]}));
    factReviews.push({factId:fact.id,inventory,targets});
  }
  const evidence=spans=>(spans||[fact.text]).map(span=>({factId:fact.id,...range(span)}));
  const noteReviews=[{noteId:'note-1',text:{status:'supported',evidence:evidence(spec.textEvidence)},extra:spec.extra?{status:'supported',evidence:evidence(spec.extraEvidence)}:{status:'empty',evidence:[]}}];
  const result={groupId:'quality-fixture',protocolVersion:4,complete:true,findings:[],factReviews,noteReviews};
  const run={cards,batch,tier:'all',status:'complete',preparedAt:'synthetic-quality',results:[result]};
  return {fact,facts,cards,batch,run,factReviews,noteReviews,range};
}

function runAnkiQualityV166Tests({S,t,section}){
  if(section)section('Anki bounded quality advisories with independent synthetic controls');
  const H=extractQualityHelpers(S),equal=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
  const reviewed=[];
  for(const spec of fixtures.cases){
    const data=hydrateQualityCase(spec,H),ctx=H.ankiRecallContext(data.run,data.cards,data.batch);
    const before=JSON.stringify(data),exportBefore=H.ankiExportText(data.cards,data.batch,true,'all',false,false),selectionBefore=H.ankiSelection(data.cards,true,'all').kept.map(c=>c.id);
    const contextIssues=data.factReviews.flatMap(review=>H.ankiContextInventoryIssues(review,data.run,ctx));
    const evidenceIssues=data.noteReviews.flatMap(review=>H.ankiEvidenceReviewIssues(review,data.run,ctx));
    const queue=H.ankiAuditReviewItems(data.run,data.cards,data.batch,'all');
    reviewed.push({spec,data,contextIssues,evidenceIssues,queue});
    t(spec.id+': independently supplied context classifications match',equal(contextIssues.map(issue=>issue.sourceSpan),spec.expect.contextSpans));
    t(spec.id+': short-citation evidence review matches without a semantic verdict',equal(evidenceIssues.filter(issue=>issue.code==='receipt-evidence-review').map(issue=>issue.field),spec.expect.evidenceFields));
    t(spec.id+': source qualifier comparison matches',equal(evidenceIssues.filter(issue=>issue.code==='source-qualifier-review').map(issue=>issue.field),spec.expect.qualifierFields));
    t(spec.id+': quality signals enter the current advisory queue',equal(queue.filter(issue=>issue.code==='inventory-context').map(issue=>issue.sourceSpan),spec.expect.contextSpans)&&equal(queue.filter(issue=>issue.code==='receipt-evidence-review').map(issue=>issue.field),spec.expect.evidenceFields)&&equal(queue.filter(issue=>issue.code==='source-qualifier-review').map(issue=>issue.field),spec.expect.qualifierFields));
    t(spec.id+': review does not mutate source notes or supported receipts',JSON.stringify(data)===before&&data.noteReviews.every(review=>review.text.status==='supported'));
    t(spec.id+': review leaves export bytes and manual selection intact',H.ankiExportText(data.cards,data.batch,true,'all',false,false)===exportBefore&&equal(H.ankiSelection(data.cards,true,'all').kept.map(c=>c.id),selectionBefore));
    for(const candidateId of spec.expect.candidateNoteIds||[]){
      const item=queue.find(issue=>issue.code==='inventory-context');
      t(spec.id+': hidden destination remains a candidate without clearing context review',!!item&&item.reconciliation?.candidates.some(candidate=>candidate.noteId===candidateId)&&item.code==='inventory-context');
    }
    if(spec.expect.answerExposure===false)t(spec.id+': equivalent representations are hidden together',H.ankiAnswerExposure(data.cards[0]).length===0);
  }
  const positive=reviewed.find(row=>row.spec.id==='noun-only-causal-extra'),contextual=reviewed.find(row=>row.spec.id==='mixed-list-member-tautological-rationale');
  const contextIssue=contextual.contextIssues[0];
  t('field support review does not imply a zero-result hidden-coverage search',positive.queue.some(item=>item.code==='receipt-evidence-review'&&!Object.hasOwn(item,'reconciliation')));
  t('mixed context review preserves exact source address for independent decisions',!!contextIssue&&contextIssue.sourceRef.start>0&&H.ankiAuditSourceRange(contextual.data.fact,contextIssue.sourceRef).sourceSpan===contextIssue.sourceSpan);
  t('stale audits cannot produce new quality verdicts in the active queue',H.ankiAuditReviewItems(positive.data.run,[...positive.data.cards],positive.data.batch,'all').every(issue=>issue.source==='local'));
  t('unrun audit cannot invent supported-receipt evidence warnings',H.ankiAuditReviewItems({...positive.data.run,results:[]},positive.data.cards,positive.data.batch,'all').every(issue=>issue.source==='local'));
  const badReceipt=JSON.parse(JSON.stringify(positive.data.noteReviews[0]));badReceipt.extra.evidence[0].sourceRef={start:999,end:999};
  t('invalid cited source addresses cannot become semantic warning evidence',H.ankiEvidenceReviewIssues(badReceipt,positive.data.run).length===0);
  const unchecked={...positive.data.cards[0],keep:false},uncheckedRun={...positive.data.run,cards:[unchecked]};
  t('manually unchecked notes do not generate supported-field review pressure',H.ankiEvidenceReviewIssues(positive.data.noteReviews[0],uncheckedRun).length===0);
  const outOfTier={...positive.data.cards[0],tags:'Tier::2'},tierRun={...positive.data.run,tier:'1',cards:[outOfTier]};
  t('out-of-tier notes do not generate active supported-field review pressure',H.ankiEvidenceReviewIssues(positive.data.noteReviews[0],tierRun).length===0);
  const unsupported={...positive.data.noteReviews[0],extra:{status:'unsupported',evidence:[]}};
  t('already unsupported fields are not relabeled as supported-receipt review',H.ankiEvidenceReviewIssues(unsupported,positive.data.run).length===0);
  t('quality fixture includes an explicit semantic limitation rather than claiming completeness',fixtures.cases.some(spec=>spec.expect.limitationControl&&spec.expect.semanticAssessment.includes('unsupported')&&spec.expect.evidenceFields.length===0));
  t('quality extraction reaches active queue currentness with a non-vacuous tail',H.ankiAuditReviewItems(null,[],{snapshot:{facts:[],byId:{}}},'all').length===0);
}

module.exports={runAnkiQualityV166Tests,hydrateQualityCase,extractQualityHelpers};

if(require.main===module){
  const root=path.resolve(__dirname,'..'),matches=fs.readdirSync(root).filter(name=>/^Nursing-Study-Suite v\d+\.\d+\.html$/.test(name));
  if(matches.length!==1)throw Error('Expected exactly one canonical suite HTML');
  let passed=0,failed=0;
  runAnkiQualityV166Tests({S:fs.readFileSync(path.join(root,matches[0]),'utf8'),t:(name,ok)=>{if(ok)passed++;else{failed++;process.stderr.write('FAIL '+name+'\n');}}});
  process.stdout.write(JSON.stringify({passed,failed})+'\n');
  if(failed)process.exitCode=1;
}
