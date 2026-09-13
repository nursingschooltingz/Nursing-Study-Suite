'use strict';

function runAnkiAuditReconcileTests({S,t,section}){
  if(section)section('Anki whole-deck candidate reconciliation remains advisory');
  const start='function ankiParseCards(raw',end='function AnkiStyleBadges',a=S.indexOf(start),b=S.indexOf(end,a+start.length);
  if(a<0||b<0||S.indexOf(start,a+1)>=0||S.indexOf(end,b+1)>=0)throw Error('Anki reconciliation extraction anchors missing or ambiguous');
  const H=new Function('uid',S.slice(a,b)+';return {ankiReconciliationLiteral,ankiAuditReconciliation,ankiBroadTargetIssues,ankiRecallContext,ankiAuditReviewItems,ankiSelection,ankiExportText,ankiMakeReviewDecision,ankiReviewDecisionCurrent};')(()=> 'synthetic');
  const fact=(id,text,condition='Synthetic condition')=>({id,text,condition,tier:1,bucket:'Look',aliases:[]});
  const facts=[fact('fact-1','Monitor fever, chills and nausea.'),fact('fact-2','Observe nausea.'),fact('fact-3','Avoid nausea.','Other condition'),fact('fact-4','A different source detail.','Synthetic condition')];
  const note=(id,text,overrides={})=>({id,text,extra:'',tags:'Tier::1',keep:true,factIds:['fact-1'],mappingIssues:[],pipeCount:2,...overrides});
  const cards=[
    note('reported','[Synthetic] Monitor {{c1::fever}}, chills and nausea.',{chunk:1}),
    note('later','[Synthetic] Observe {{c1::nausea}}.',{factIds:['fact-2'],chunk:9}),
    note('withheld','[Synthetic] Observe {{c1::nausea}}.',{keep:false,chunk:3}),
    note('tier-two','[Synthetic] Observe {{c1::nausea}}.',{tags:'Tier::2',chunk:5}),
    note('other-condition','[Other] Avoid {{c1::nausea}}.',{factIds:['fact-3']}),
    note('extra-only','[Synthetic] Monitor {{c1::fever}}.',{extra:'nausea'})
  ];
  const snapshot={facts,byId:Object.fromEntries(facts.map(f=>[f.id,f]))},batch={snapshot};
  const run={cards,batch,tier:'1',preparedAt:'synthetic',status:'partial',results:[]},issue={code:'visible-only',noteIds:['reported'],factIds:['fact-1'],sourceSpan:'nausea',message:'Synthetic visible target.',suggestion:''};
  const rec=(change={},r=run)=>H.ankiAuditReconciliation({...issue,...change},r),r=rec();
  const codes=value=>value.map(x=>x.code),target=(sourceSpan,indices=[1],status='tested')=>({sourceSpan,status,noteRefs:[{noteId:'reported',clozeIndices:indices}]});
  t('reconciliation finds a hidden candidate in a later generation chunk and another fact',r.candidates.some(c=>c.noteId==='later'&&c.clozeIndices.join(',')==='1'));
  t('reconciliation searches across all captured tiers',r.candidates.some(c=>c.noteId==='tier-two'&&!c.inSelectedTier));
  t('reconciliation records unchecked candidates without claiming active coverage',r.candidates.some(c=>c.noteId==='withheld'&&!c.kept&&!c.eligible));
  t('reconciliation counts active unchecked and out-of-tier candidates independently',r.total===3&&r.active===1&&r.withheld===1&&r.outOfTier===1);
  t('reconciliation excludes identical wording from a different source condition',!r.candidates.some(c=>c.noteId==='other-condition'));
  t('reconciliation does not use Extra as hidden recall',!r.candidates.some(c=>c.noteId==='extra-only'));
  t('reconciliation exposes Text field and captured tier with matched wording',r.candidates[0].field==='Text'&&r.candidates[0].tier==='1'&&r.candidates[0].matchedText==='nausea');
  t('reconciliation always identifies literal results as candidate-only and preserves meaning cautions',r.warnings.some(w=>w.code==='candidate-coverage'&&/actor, polarity, timing and qualifiers/.test(w.message)&&/do not prove/.test(w.message)));
  t('reconciliation cautions that excluded candidates are not export coverage',codes(r.warnings).includes('candidate-selection'));
  t('reconciliation uses an exact target span when present',r.basis==='source-span');
  const broad=rec({sourceSpan:'',code:'missing-target'});
  t('reconciliation marks fact-wide searches when a finding has no target span',broad.basis==='source-facts'&&codes(broad.warnings).includes('candidate-broad-source'));
  t('reconciliation does not derive source targets from arbitrary suggestion prose',rec({sourceSpan:'not in source',suggestion:'Invented material.'}).basis==='source-facts');
  t('reconciliation declines unsupported semantic finding categories',rec({code:'changed-meaning'}).total===0&&rec({code:'unsupported'}).warnings.length===0);
  t('reconciliation declines unknown source IDs',rec({factIds:['absent']}).total===0);
  t('reconciliation declines findings spanning different source conditions',rec({factIds:['fact-1','fact-3']}).total===0);
  const unreliable=[note('unmapped','[Synthetic] {{c1::nausea}}.',{factIds:[]}),note('unknown','[Synthetic] {{c1::nausea}}.',{factIds:['absent']}),note('diagnostic','[Synthetic] {{c1::nausea}}.',{mappingIssues:[{code:'unknown'}]}),note('mixed','[Synthetic] {{c1::nausea}}.',{factIds:['fact-1','fact-3']}),note('invalid','[Synthetic] {{c1::nausea}.')];
  t('reconciliation excludes invalid or unreliable mapped notes',rec({}, {...run,cards:unreliable}).total===0);
  const bounded=rec({}, {...run,cards:Array.from({length:12},(_,i)=>note('candidate-'+String(i).padStart(2,'0'),'[Synthetic] Observe {{c1::nausea}}.',{tags:i===11?'Tier::1':'Tier::2'}))});
  t('reconciliation exposes at most five candidate links while retaining total counts',bounded.total===12&&bounded.candidates.length===5&&bounded.limit===5);
  t('reconciliation shows an active Tier 1 candidate before lower-tier matches',bounded.candidates[0].noteId==='candidate-11'&&bounded.candidates[0].eligible);
  t('reconciliation counts kept Tier 1 candidates and warns for duplicate removal review',rec({code:'duplicate-target'}).tier1Candidates===1&&codes(rec({code:'duplicate-target'}).warnings).includes('candidate-tier-one'));
  t('reconciliation still cautions about Tier 1 when that tier is outside the selected subset',codes(rec({code:'priority-loss'},{...run,tier:'2'}).warnings).includes('candidate-tier-one'));
  t('reconciliation retains separate cloze indices for the same candidate note',rec({}, {...run,cards:[note('multi','[Synthetic] {{c1::nausea}} and {{c2::nausea}}.')]}).candidates[0].clozeIndices.join(',')==='1,2');
  t('reconciliation deduplicates repeated same-index hidden wording',rec({}, {...run,cards:[note('multi','[Synthetic] {{c1::nausea}} and {{c1::nausea}}.')]}).candidates[0].clozeIndices.length===1);

  t('literal reconciliation preserves case-sensitive symbols and units',!H.ankiReconciliationLiteral('Use 5 Mg.','5 mg'));
  t('literal reconciliation rejects numeric suffix and comparator-only matches',!H.ankiReconciliationLiteral('Use 15 mg.','5 mg')&&!H.ankiReconciliationLiteral('Use > 5 mg.','5 mg'));
  t('literal reconciliation preserves a complete comparator match',H.ankiReconciliationLiteral('Use >5 mg.','>5 mg'));
  t('literal reconciliation uses token boundaries',!H.ankiReconciliationLiteral('Assess nausea-like symptoms.','use')&&!H.ankiReconciliationLiteral('Assess nausea.','nause'));
  t('literal reconciliation ignores generic grammar and isolated numbers',!H.ankiReconciliationLiteral('The target is not 5.','not')&&!H.ankiReconciliationLiteral('The target is 500.','500'));
  t('literal reconciliation allows whitespace formatting without rewriting words',H.ankiReconciliationLiteral('Observe severe   nausea.','severe nausea'));

  const wide=H.ankiBroadTargetIssues(target(facts[0].text),'fact-1',run);
  t('broad-target advisory notices unhidden list segments in an otherwise tested receipt',wide.length===1&&wide[0].code==='receipt-broad-target'&&wide[0].message.includes('2 lack a literal match'));
  t('broad-target advisory preserves original cited source and reference indices',wide[0].sourceSpan===facts[0].text&&wide[0].clozeIndices[0].noteId==='reported'&&wide[0].clozeIndices[0].index===1);
  t('broad-target advisory states paraphrase context and verdict limits',/context, paraphrases or missed targets/.test(wide[0].message)&&/does not change the receipt verdict/.test(wide[0].message));
  t('broad-target advisory does not warn when all list segments are hidden',H.ankiBroadTargetIssues(target(facts[0].text,[1,2,3]),'fact-1',{...run,cards:[note('reported','[Synthetic] Monitor {{c1::fever}}, {{c2::chills}} and {{c3::nausea}}.')]}).length===0);
  t('broad-target advisory accepts a whole hidden list as literal coverage without proving its quality',H.ankiBroadTargetIssues(target(facts[0].text),'fact-1',{...run,cards:[note('reported','[Synthetic] Monitor {{c1::fever, chills and nausea}}.')]}).length===0);
  t('broad-target advisory skips short non-list source spans',H.ankiBroadTargetIssues(target('nausea'),'fact-1',run).length===0);
  t('broad-target advisory rejects invented spans and invalid indices',H.ankiBroadTargetIssues(target('Invented fever, chills and nausea.'),'fact-1',run).length===0&&H.ankiBroadTargetIssues(target(facts[0].text,[9]),'fact-1',run).length===0);
  t('broad-target advisory never promotes visible receipts to tested',H.ankiBroadTargetIssues(target(facts[0].text,[],'visible-only'),'fact-1',run).length===0);
  t('broad-target advisory makes no lexical inference when every fragment differs',H.ankiBroadTargetIssues(target(facts[0].text),'fact-1',{...run,cards:[note('reported','[Synthetic] {{c1::unrelated}}.')]}).length===0);

  const receipt={factId:'fact-1',targets:[target('nausea',[],'visible-only'),target(facts[0].text)]},accepted={groupId:'accepted',findings:[],factReviews:[receipt]},live={...run,results:[accepted]};
  const before=JSON.stringify({cards,batch,live}),exportBefore=H.ankiExportText(cards,batch,true,'1',false,false),queue=H.ankiAuditReviewItems(live,cards,batch,'1');
  t('current accepted receipt items carry all-deck reconciliation metadata',queue.some(i=>i.code==='visible-only'&&i.reconciliation.candidates.some(c=>c.noteId==='later')));
  t('broad-target receipt advisory becomes an inspectable queue item',queue.some(i=>i.code==='receipt-broad-target'&&i.source==='receipt'&&i.reconciliation.total>0));
  t('reconciliation excludes stale audit claims when cards change',H.ankiAuditReviewItems(live,[...cards],batch,'1').every(i=>i.source==='local'));
  t('reconciliation does not generate audit claims before an accepted result',H.ankiAuditReviewItems({...live,results:[]},cards,batch,'1').every(i=>i.source==='local'));
  const contextReview={factId:'fact-1',targets:[],inventory:[{sourceSpan:'Monitor fever,',role:'context',reason:'Synthetic context decision.'},{sourceSpan:'chills and nausea.',role:'context',reason:'Synthetic context decision.'}]};
  const contextItems=(review=contextReview,tier='1')=>H.ankiAuditReviewItems({...live,tier,results:[{groupId:'context',findings:[],factReviews:[review,review]}]},cards,batch,tier).filter(i=>i.code==='inventory-context');
  t('all-context facts create only one advisory item despite multiple context spans and duplicate receipts',contextItems().length===1);
  t('all-context advisory clearly describes an unverified classification rather than a missing-target finding',contextItems()[0].message.includes('chose no recall target')&&contextItems()[0].message.includes('not a missing-target verdict'));
  t('all-context items retain source navigation and bounded whole-deck candidate metadata',contextItems()[0].factIds[0]==='fact-1'&&contextItems()[0].sourceSpan===''&&contextItems()[0].reconciliation.total>0);
  t('mixed target and context inventories do not create context classification noise',contextItems({...contextReview,targets:[target('fever')]}).length===0);
  t('all-context advisory declines absent invalid or non-context inventories',contextItems({...contextReview,inventory:[]}).length===0&&contextItems({...contextReview,inventory:[{sourceSpan:'invented',role:'context'}]}).length===0&&contextItems({...contextReview,inventory:[{sourceSpan:'fever',role:'target'}]}).length===0);
  t('all-context advisory honors the selected source fact tier',contextItems(contextReview,'2').length===0);
  const v4Target=(status='visible-only',field='text',noteId='reported')=>({sourceSpan:'nausea',sourceRef:{start:5,end:5},sourceStart:25,sourceEnd:31,status,noteRefs:[],contextRefs:[{noteId,field}]});
  const v4Queue=target=>H.ankiAuditReviewItems({...live,results:[{groupId:'v4',protocolVersion:4,complete:false,findings:[],factReviews:[{factId:'fact-1',targets:[target]}]}]},cards,batch,'1');
  const v4=v4Target(),v4Before=JSON.stringify(v4),v4Visible=v4Queue(v4).find(i=>i.code==='visible-only');
  t('V4 visible-only context references enter the active review queue',v4Visible&&v4Visible.noteIds.join(',')==='reported');
  t('V4 context-only queue views retain exact positional source evidence and original empty hidden references',JSON.stringify(v4)===v4Before&&v4.noteRefs.length===0&&v4Visible.sourceSpan==='nausea');
  t('V4 Extra-only context references enter the active review queue',v4Queue(v4Target('extra-only','extra','extra-only')).some(i=>i.code==='extra-only'&&i.noteIds[0]==='extra-only'));
  t('V4 context candidates include hidden coverage elsewhere without clearing visible receipt status',v4Visible.reconciliation.candidates.some(c=>c.noteId==='later')&&v4.status==='visible-only');
  t('V4 context-only queue rejects mismatched fields and empty Extra',!v4Queue(v4Target('visible-only','extra')).some(i=>i.source==='receipt')&&!v4Queue(v4Target('extra-only','extra')).some(i=>i.source==='receipt'));
  t('V4 context-only queue rejects unknown excluded or out-of-tier note references',!v4Queue(v4Target('visible-only','text','unknown')).some(i=>i.source==='receipt')&&!v4Queue(v4Target('visible-only','text','withheld')).some(i=>i.source==='receipt')&&!v4Queue(v4Target('visible-only','text','tier-two')).some(i=>i.source==='receipt'));
  t('V4 context-only queue never accepts a false hidden-index claim',!v4Queue({...v4,noteRefs:[{noteId:'reported',clozeIndices:[1]}]}).some(i=>i.source==='receipt'));
  t('V4 tested receipts retain explicit hidden refs despite contextual mentions',v4Queue({...target(facts[0].text),contextRefs:[{noteId:'extra-only',field:'extra'}]}).some(i=>i.code==='receipt-broad-target'));
  const repeatedFact={...facts[0],text:'Monitor fever, chills and nausea. Monitor fever, chills and nausea.'},repeatedBatch={snapshot:{facts:[repeatedFact],byId:{'fact-1':repeatedFact}}};
  const repeatedTargets=[5,10].map(position=>({...v4Target(),sourceSpan:'nausea.',sourceRef:{start:position,end:position}})),repeatedBefore=JSON.stringify(repeatedTargets);
  const repeatedRun={...live,batch:repeatedBatch,results:[{groupId:'positions',protocolVersion:4,findings:[],factReviews:[{factId:'fact-1',targets:[...repeatedTargets,repeatedTargets[0]]}]}]};
  const positional=H.ankiAuditReviewItems(repeatedRun,cards,repeatedBatch,'1').filter(i=>i.code==='visible-only');
  t('positional queue identities distinguish identical target text at different source addresses',positional.length===2&&positional[0].key!==positional[1].key&&positional[0].signature!==positional[1].signature);
  t('positional queue retains exact source references and coalesces only the same address',positional.map(i=>i.sourceRef.start).sort((a,b)=>a-b).join(',')==='5,10'&&positional.every(i=>i.sourceRef.start===i.sourceRef.end));
  const decisionInputs={cards,batch:repeatedBatch,tier:'1',current:true},positionalDecision=H.ankiMakeReviewDecision(positional[0],'intentional-context','','Synthetic decision.',decisionInputs,repeatedRun);
  t('a manual decision for one positional target cannot clear another identical-word target',H.ankiReviewDecisionCurrent(positionalDecision,positional[0],decisionInputs,repeatedRun)&&!H.ankiReviewDecisionCurrent(positionalDecision,positional[1],decisionInputs,repeatedRun));
  t('positional metadata does not mutate canonical target records',JSON.stringify(repeatedTargets)===repeatedBefore);
  const broadPosition={...target(facts[0].text),sourceRef:{start:1,end:5}},broadPositionItem=v4Queue(broadPosition).find(i=>i.code==='receipt-broad-target');
  t('derived broad-target advisories retain the tested target source address',broadPositionItem.sourceRef.start===1&&broadPositionItem.sourceRef.end===5);
  t('legacy receipt identities remain unchanged when no positional source reference exists',queue.filter(i=>i.source==='receipt').every(i=>!Object.prototype.hasOwnProperty.call(i,'sourceRef')&&JSON.parse(i.key).length===7));
  t('reconciliation adds no automatic keep edits or verdict changes',JSON.stringify({cards,batch,live})===before&&receipt.targets[1].status==='tested');
  t('reconciliation cannot alter export bytes or eligibility',H.ankiExportText(cards,batch,true,'1',false,false)===exportBefore&&H.ankiSelection(cards,true,'1').kept.length===4);
  t('reconciliation extraction reaches queue currentness and has a non-vacuous tail',typeof H.ankiAuditReviewItems==='function'&&H.ankiAuditReviewItems(null,[],batch,'all').length===0);
}

module.exports={runAnkiAuditReconcileTests};
