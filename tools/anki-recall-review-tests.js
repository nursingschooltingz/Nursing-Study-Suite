'use strict';

// Synthetic offline cases exercise shipped code, never source material or model accuracy.
function runAnkiRecallReviewTests({S,t,section}){
  if(section)section('Anki advisory recall queue and suggestion checks');
  const start='function ankiParseCards(raw',end='function AnkiStyleBadges',a=S.indexOf(start),b=S.indexOf(end,a+start.length);
  if(a<0||b<0||S.indexOf(start,a+1)>=0||S.indexOf(end,b+1)>=0)throw Error('Anki recall-review extraction anchors missing or ambiguous');
  const source=S.slice(a,b),H=new Function('uid',source+';return {parseAnkiClozes,ankiAnswerExposure,ankiRecallRangeText,ankiRecallNumbers,ankiRecallIssues,ankiReceiptRecallIssues,ankiSuggestionWarnings,ankiAuditReviewItems,ankiSourceSnapshot,ankiParseSourceAudit,ankiSelection,ankiExportText};')(()=> 'synthetic-note');
  const note=(id,text,changes={})=>({id,text,extra:'',tags:'Tier::1',keep:true,factIds:['fact-1'],pipeCount:2,mappingIssues:[],...changes});
  const exposed=text=>H.ankiAnswerExposure(note('exposure',text));
  const codes=items=>items.map(x=>x.code);
  const copy=x=>JSON.parse(JSON.stringify(x));
  const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};

  const range='[Example] Window: {{c1::1.5 to 2}} units; reference {{c2::1.5–2 units}}.';
  t('recall exposure recognizes explicit numeric range connector equivalence',exposed(range).some(x=>x.index===1&&x.answer==='1.5 to 2'));
  t('recall exposure preserves the original displayed answer and front',exposed(range)[0].front.includes('1.5–2 units')&&exposed(range)[0].answer.includes(' to '));
  t('recall range matching accepts hyphen and em dash connectors',exposed('[Example] Range: {{c1::2-4 units}}; reference 2—4 units.').length===1);
  t('recall range matching handles two signed negative endpoints',exposed('[Example] Range: {{c1::-5 to -2 units}}; reference -5–-2 units.').length===1);
  t('recall range matching does not erase endpoint signs',exposed('[Example] Range: {{c1::-5 to -2 units}}; reference 5–2 units.').length===0);
  t('recall range matching preserves different units',exposed('[Example] Range: {{c1::2 to 4 mg}}; reference 2–4 mL.').length===0);
  t('recall range matching preserves comparator direction',exposed('[Example] Range: {{c1::<2 to 4 units}}; reference >2–4 units.').length===0);
  t('recall exposure does not equate an unsigned value with a comparator threshold',exposed('[Example] Value: {{c1::5 units}}; reference > 5 units.').length===0);
  t('recall exposure does not match a suffix of a larger range endpoint',exposed('[Example] Range: {{c1::2 to 4 units}}; reference 12–4 units.').length===0);
  t('recall normalization does not turn a scalar range endpoint into an exact value match',exposed('[Example] Value: {{c1::4 units}}; reference 2-4 units.').length===0);
  t('recall exposure excludes Extra even for equivalent ranges',H.ankiAnswerExposure(note('extra','[Example] Range: {{c1::2 to 4 units}}.',{extra:'2–4 units.'})).length===0);
  t('recall range normalization leaves units and comparator text untouched',H.ankiRecallRangeText('>1.5 to 2 mg/dL')==='>1.5–2 mg/dL');
  t('recall numeric anchors normalize ranges without manufacturing a negative endpoint',H.ankiRecallNumbers('1.5-2 units').join(',')==='1.5,2');
  t('recall numeric anchors retain actual signed endpoints',H.ankiRecallNumbers('-5 to -2 units').join(',')==='-5,-2');
  t('recall numeric anchors ignore ordinals and embedded identifiers',H.ankiRecallNumbers('B12 marker, 1st review, code4').length===0);
  t('recall numeric anchors retain decimal and fraction tokens',H.ankiRecallNumbers('1,200.5 units and 1/2 portion').join(',')==='1200.5,1/2');
  t('recall numeric anchors preserve equivalent compound range slash spacing',H.ankiRecallNumbers('80-90/40-50 units').join(',')===H.ankiRecallNumbers('80-90 / 40-50 units').join(','));
  t('recall numeric slash spacing preserves the slash and numeric roles',H.ankiRecallNumbers('1 / 2 portion').join(',')==='1/2'&&H.ankiRecallNumbers('1 / 2 portion').join(',')!==H.ankiRecallNumbers('1 and 2 portions').join(','));

  const facts=[
    {id:'fact-1',text:'Use half after 7 minutes and half after 11 minutes.',tier:1,latteBucket:'Treat',sources:[]},
    {id:'fact-2',text:'Use a cool container. Keep lid sealed.',tier:1,latteBucket:'Treat',sources:[]},
    {id:'fact-3',text:'Mark alpha, beta, and gamma.',tier:1,latteBucket:'Look',sources:[]}
  ];
  const snapshot=H.ankiSourceSnapshot({conditions:[{name:'Example',facts}]}),batch={snapshot};
  const cards=[
    note('note-1','[Example] Interval: {{c1::half}} after 7 minutes; {{c2::half}} after 11 minutes.'),
    note('note-2','[Example] Handling: use a {{c1::cool}} container.',{factIds:['fact-2'],extra:'Keep lid sealed.'}),
    note('note-3','[Example] Markers: {{c1::alpha}}, {{c1::beta}}, {{c1::gamma}}.',{factIds:['fact-3']})
  ];
  const group={id:'synthetic-group',sourceFactIds:facts.map(f=>f.id),scopeNoteIds:cards.map(n=>n.id),facts:snapshot.facts.map(f=>({...f,inSelectedTier:true})),notes:cards.map(n=>({...n,eligible:true,structurallyValid:true,inSelectedTier:true,reviewTargets:H.parseAnkiClozes(n.text).indices.map(index=>({index}))}))};
  const target=(sourceSpan,status,noteId,clozeIndices=[])=>({sourceSpan,status,noteRefs:[{noteId,clozeIndices}]});
  const raw={factReviews:[
    {factId:'fact-1',targets:[target('7 minutes','tested','note-1',[1]),target('11 minutes','visible-only','note-1')]},
    {factId:'fact-2',targets:[target('cool container','tested','note-2',[1]),target('Keep lid sealed.','extra-only','note-2')]},
    {factId:'fact-3',targets:[target('alpha, beta, and gamma','tested','note-3',[1])]}
  ],noteReviews:cards.map(n=>({noteId:n.id,text:{status:'supported',evidence:[{factId:n.factIds[0],sourceSpan:group.facts.find(f=>f.id===n.factIds[0]).text}]},extra:n.extra?{status:'supported',evidence:[{factId:'fact-2',sourceSpan:'Keep lid sealed.'}]}:{status:'empty',evidence:[]}})),findings:[{code:'unsupported',factIds:['fact-2'],noteIds:['note-2'],message:'Inspect synthetic added wording.',suggestion:'Keep the supplied container wording.'}]};
  const result=H.ankiParseSourceAudit(JSON.stringify(raw),group),run={cards,batch,tier:'all',status:'complete',groups:[group],results:[result]};
  const receipt=raw.factReviews[0].targets[0],mismatch=H.ankiReceiptRecallIssues(receipt,'fact-1',run);
  t('recall numeric receipt check identifies the actual referenced index and missing value',mismatch.length===1&&mismatch[0].clozeIndices[0].index===1&&mismatch[0].message.includes('7'));
  t('recall numeric receipt warning retains exact supplied target and IDs',mismatch[0].sourceSpan==='7 minutes'&&mismatch[0].factIds[0]==='fact-1'&&mismatch[0].noteIds[0]==='note-1');
  t('recall numeric receipt warning states context and entailment limits',mismatch[0].message.includes('necessary context')&&mismatch[0].message.includes('do not prove recall'));
  const hiddenCards=[{...cards[0],text:'[Example] Interval: half after {{c1::7 minutes}}; half after {{c2::11 minutes}}.'},...cards.slice(1)],hiddenRun={...run,cards:hiddenCards};
  t('recall numeric receipt check clears when the cited answer hides the value',H.ankiReceiptRecallIssues(receipt,'fact-1',hiddenRun).length===0);
  t('recall numeric receipt check does not borrow a number hidden under another index',H.ankiReceiptRecallIssues({...receipt,noteRefs:[{noteId:'note-1',clozeIndices:[2]}]},'fact-1',hiddenRun).length===1);
  t('recall numeric receipt check uses all explicitly referenced clozes',H.ankiReceiptRecallIssues(target('7 minutes and half after 11 minutes','tested','note-1',[1,2]),'fact-1',hiddenRun).length===0);
  t('recall numeric receipt check does not promote visible-only records to tested',H.ankiReceiptRecallIssues({...receipt,status:'visible-only'},'fact-1',run).length===0);
  t('recall numeric receipt check rejects an invented source quotation',H.ankiReceiptRecallIssues({...receipt,sourceSpan:'12 minutes'},'fact-1',run).length===0);
  t('recall numeric receipt check skips invalid note references',H.ankiReceiptRecallIssues({...receipt,noteRefs:[{noteId:'unknown',clozeIndices:[1]}]},'fact-1',run).length===0);
  t('recall numeric receipt check skips invalid cloze references',H.ankiReceiptRecallIssues({...receipt,noteRefs:[{noteId:'note-1',clozeIndices:[3]}]},'fact-1',run).length===0);
  t('recall numeric receipt check makes no entailment claim when the same number has a different unit',H.ankiReceiptRecallIssues(receipt,'fact-1',{...hiddenRun,cards:[{...hiddenCards[0],text:'[Example] Value: {{c1::7 units}}.'},...cards.slice(1)]}).length===0);

  const foreign=note('foreign','[Example] Marker: {{c1::синий}}.');
  t('recall script check flags foreign script absent linked supplied context',codes(H.ankiRecallIssues(foreign,snapshot)).includes('unexpected-script'));
  t('recall script check also inspects Extra without rewriting it',codes(H.ankiRecallIssues({...cards[0],extra:'синий'},snapshot)).includes('unexpected-script'));
  const multilingual={facts:[{...snapshot.facts[0],text:'The marker is синий.'}],byId:{'fact-1':{...snapshot.facts[0],text:'The marker is синий.'}}};
  t('recall script check accepts multilingual text present in linked source',!codes(H.ankiRecallIssues(foreign,multilingual)).includes('unexpected-script'));
  const aliasSource={facts:[],byId:{'fact-1':{...snapshot.facts[0],aliases:['синий']}}};
  t('recall script check accepts supplied condition alias script',!codes(H.ankiRecallIssues(foreign,aliasSource)).includes('unexpected-script'));
  t('recall script check preserves Latin accents and Greek medical symbols',!codes(H.ankiRecallIssues(note('units','[Example] Label: {{c1::café μg β}}.'),snapshot)).includes('unexpected-script'));
  t('recall script check does not invent support comparisons for unmapped notes',!codes(H.ankiRecallIssues({...foreign,factIds:[]},snapshot)).includes('unexpected-script'));
  t('recall script check skips unresolved or unreliable source associations',!codes(H.ankiRecallIssues({...foreign,factIds:['missing']},snapshot)).includes('unexpected-script')&&!codes(H.ankiRecallIssues({...foreign,mappingIssues:[{code:'unresolved'}]},snapshot)).includes('unexpected-script'));
  t('recall script check does not use excluded sourceQuote evidence',codes(H.ankiRecallIssues(foreign,{byId:{'fact-1':{...snapshot.facts[0],sourceQuote:'синий'}}})).includes('unexpected-script'));

  const three=note('three','[Example] Values: {{c1::one}}, {{c2::two}}, {{c3::three}}.'),bundled=note('bundle','[Example] Markers: {{c1::red}}, {{c1::blue}}, {{c1::green}}.'),lower={...three,id:'lower',tags:'Tier::2'};
  const suggestionRun={cards:[three,bundled,lower],batch},finding=(suggestion,noteIds=['three'],code='missing-target')=>({code,noteIds,factIds:['fact-1'],message:'Synthetic review.',suggestion}),warn=f=>H.ankiSuggestionWarnings(f,suggestionRun);
  t('recall suggestion check flags unclosed cloze syntax before manual copying',codes(warn(finding('Add {{c1::four.'))).includes('suggestion-cloze-syntax'));
  t('recall suggestion check permits plain-language advice without cloze syntax',!codes(warn(finding('Review the supplied timing and split the target.'))).includes('suggestion-cloze-syntax'));
  t('recall suggestion check flags a fourth index added to existing c1-c3',codes(warn(finding('Add {{c4::four}}.'))).includes('suggestion-cloze-limit'));
  t('recall suggestion check flags a fifth index when an insertion exceeds the distinct-index limit',codes(warn(finding('Append {{c5::five}}.'))).includes('suggestion-cloze-limit'));
  t('recall suggestion check permits an explicitly complete replacement with three indices',!codes(warn(finding('[Example] Replacement: {{c1::a}}, {{c2::b}}, {{c4::d}}.'))).includes('suggestion-cloze-limit'));
  t('recall suggestion check flags four distinct indices in full replacement text',codes(warn(finding('[Example] Replacement: {{c1::a}}, {{c2::b}}, {{c3::c}}, {{c4::d}}.'))).includes('suggestion-cloze-limit'));
  t('recall suggestion check flags appending to an existing shared bundle',codes(warn(finding('Add {{c1::yellow}}.',['bundle']))).includes('suggestion-shared-bundle'));
  t('recall suggestion check flags larger replacement shared bundles',codes(warn(finding('[Example] Markers: {{c1::red}}, {{c1::blue}}, {{c1::green}}, {{c1::yellow}}.',['bundle']))).includes('suggestion-shared-bundle'));
  t('recall suggestion check does not flag an unchanged shared bundle',!codes(warn(finding(bundled.text,['bundle']))).includes('suggestion-shared-bundle'));
  t('recall suggestion check identifies a literal answer-bearing hint',codes(warn(finding('[Example] Color: {{c1::blue::blue}}.'))).includes('suggestion-answer-hint'));
  t('recall suggestion check retains choice hints as advisory cues',codes(warn(finding('[Example] Color: {{c1::blue::red or blue}}.'))).includes('suggestion-answer-hint'));
  t('recall suggestion check does not flag a neutral category hint',!codes(warn(finding('[Example] Color: {{c1::blue::color}}.'))).includes('suggestion-answer-hint'));
  t('recall suggestion check warns about mixed-tier duplicate deletion',codes(warn(finding('Remove the duplicate note.',['three','lower'],'duplicate-target'))).includes('suggestion-tier-loss'));
  t('recall suggestion check does not treat every mixed-tier finding as deletion',!codes(warn(finding('Compare the source wording.',['three','lower'],'duplicate-target'))).includes('suggestion-tier-loss'));
  t('recall empty suggestions remain empty and generate no warnings',warn(finding('')).length===0);

  freeze(run);const before=JSON.stringify(run),exportBefore=H.ankiExportText(cards,batch,true,'all',false,false),items=H.ankiAuditReviewItems(run,cards,batch,'all');
  t('recall queue combines validated findings, target records and local checks',new Set(items.map(i=>i.source)).size===3&&codes(items).includes('unsupported')&&codes(items).includes('extra-only')&&codes(items).includes('answer-visible'));
  t('recall queue includes visible-only targets as review decisions rather than failures',items.some(i=>i.code==='visible-only'&&i.message.includes('already tested elsewhere')&&i.suggestion===''));
  t('recall queue includes substantive or explanatory Extra targets without assuming which they are',items.some(i=>i.code==='extra-only'&&i.message.includes('useful explanation')&&i.sourceSpan==='Keep lid sealed.'));
  t('recall queue includes receipt-number mismatches with selected cloze evidence',items.some(i=>i.code==='receipt-number-mismatch'&&i.clozeIndices[0].noteId==='note-1'));
  t('recall queue includes shared-list review indices',items.some(i=>i.code==='list-recall'&&i.clozeIndices[0].index===1&&i.noteIds[0]==='note-3'));
  t('recall queue produces stable keys and signatures for unchanged inputs',JSON.stringify(items)===JSON.stringify(H.ankiAuditReviewItems(run,cards,batch,'all'))&&items.every(i=>typeof i.key==='string'&&typeof i.signature==='string'));
  const editedCards=cards.map(n=>n.id==='note-1'?{...n,text:n.text.replace('Interval:','Timing:')}:n),editedItems=H.ankiAuditReviewItems(run,editedCards,batch,'all');
  t('recall queue excludes stale audit claims after an edit',editedItems.every(i=>i.source==='local'));
  const originalLocal=items.find(i=>i.code==='answer-visible'),editedLocal=editedItems.find(i=>i.code==='answer-visible');
  t('recall queue preserves issue identity but changes signature when note wording changes',originalLocal.key===editedLocal.key&&originalLocal.signature!==editedLocal.signature);
  t('recall queue excludes stale audit claims after a batch or tier change',H.ankiAuditReviewItems(run,cards,{...batch},'all').every(i=>i.source==='local')&&H.ankiAuditReviewItems(run,cards,batch,'1').every(i=>i.source==='local'));
  t('recall queue still works locally before any audit is prepared',H.ankiAuditReviewItems(null,cards,batch,'all').length===2);
  t('recall queue omits manually excluded local warnings',H.ankiAuditReviewItems(null,cards.map(n=>({...n,keep:false})),batch,'all').length===0);
  t('recall queue honors selected tiers for local warnings',H.ankiAuditReviewItems(null,cards.map(n=>({...n,tags:'Tier::2'})),batch,'1').length===0);
  const changedSnapshot={...snapshot,facts:snapshot.facts.map(f=>f.id==='fact-1'?{...f,text:f.text+' Supplied extra context.'}:f)};
  const changedSource=H.ankiAuditReviewItems(null,cards,{snapshot:changedSnapshot},'all').find(i=>i.code==='answer-visible');
  t('recall queue signatures include linked source context',changedSource.key===originalLocal.key&&changedSource.signature!==originalLocal.signature);
  const duplicateRun={...run,results:[result,result]};
  t('recall queue coalesces repeated identical reported targets and findings',H.ankiAuditReviewItems(duplicateRun,cards,batch,'all').length===items.length);
  const twoClaims={...run,results:[{...result,findings:[...result.findings,{...result.findings[0],message:'A separate synthetic qualifier issue.'}]}]};
  t('recall queue keeps different findings about the same source and note separate',H.ankiAuditReviewItems(twoClaims,cards,batch,'all').filter(i=>i.source==='finding').length===2);
  const invalidResult={findings:[{...result.findings[0],noteIds:['unknown']}],factReviews:[{factId:'fact-1',targets:[target('7 minutes','visible-only','unknown')]}]};
  t('recall queue does not manufacture actionable references from unknown IDs',H.ankiAuditReviewItems({...run,results:[invalidResult]},cards,batch,'all').every(i=>i.source==='local'));
  const proposal=finding('Add {{c4::four}}.'),proposalRun={...suggestionRun,tier:'all',results:[{findings:[proposal],factReviews:[]}]};
  t('recall queue carries suggestion warnings without applying the proposed text',H.ankiAuditReviewItems(proposalRun,proposalRun.cards,batch,'all').some(i=>i.suggestion===proposal.suggestion&&i.suggestionWarnings.some(w=>w.code==='suggestion-cloze-limit'))&&three.text.includes('{{c3::three}}'));
  t('recall queue leaves cards, source facts and receipts immutable',JSON.stringify(run)===before);
  t('recall queue warnings preserve export bytes and structural eligibility',H.ankiExportText(cards,batch,true,'all',false,false)===exportBefore&&H.ankiSelection(cards).kept.length===cards.length);
  t('recall helper extraction reaches the live queue and currentness tail',source.includes('function ankiSourceAuditCurrent')&&H.ankiAuditReviewItems(null,[],batch,'all').length===0);
}

module.exports={runAnkiRecallReviewTests};
