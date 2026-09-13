'use strict';

// Synthetic, offline tests of the shipped Anki audit helpers. No generator calls.
function runAnkiSourceAuditTests({S,t,section}){
  if(section)section('Anki optional source audit');
  const {validReceipt}=require('./fixtures/anki-audit-response');
  const start=S.indexOf('function ankiParseCards(raw'),end=S.indexOf('function AnkiStyleBadges',start);
  if(start<0||end<0)throw new Error('Anki source-audit extraction anchors moved.');
  const source=S.slice(start,end);
  const H=new Function('uid',source+';return {ankiAuditGroups,ankiBuildSourceAuditPrompt,ankiParseSourceAudit,ANKI_SOURCE_AUDIT_GROUP_CHARS};')(()=> 'synthetic');
  const fact=(id,text,tier=1)=>({id,text,tier,bucket:'Treatments',condition:'Synthetic condition',aliases:['Synthetic alias'],subtype:'independent',sourceQuote:'QUOTE_ONLY_SECRET'});
  const card=(id,factIds=[],changes={})=>({id,factIds,chunk:1,sourceLine:1,text:'[Synthetic] Action: {{c1::hold}} and {{c1::notify}} after {{c2::review}}',extra:'Supplied context.',tags:'Tier::1',keep:true,pipeCount:2,...changes});
  const facts=[fact('fact-1','Hold and notify after review.'),fact('fact-2','Supporting detail.',2),fact('fact-3','A separate context.'),fact('fact-4','Residual source detail.',3)];
  const rows=[card('one',['fact-1']),card('cross',['fact-1','fact-3']),card('unmapped',[],{factIds:['fact-999']}),card('excluded',['fact-3'],{chunk:2,keep:false}),card('broken',['fact-3'],{chunk:2,text:'{{c1::unfinished'}),card('orphan',[],{chunk:0}),card('other-tier',['fact-1'],{tags:'Tier::2'})];
  const batch={snapshot:{facts},chunkIds:[['fact-1','fact-2'],['fact-3']]};
  const before=JSON.stringify({rows,batch}),groups=H.ankiAuditGroups(rows,batch,'1'),first=groups.find(g=>g.chunk===1),second=groups.find(g=>g.chunk===2),residual=groups.find(g=>g.chunk===0);
  const throws=fn=>{try{fn();return false;}catch(e){return true;}};
  t('audit grouping leaves captured input and current notes unchanged',JSON.stringify({rows,batch})===before);
  t('audit groups retain captured source chunk order',groups.map(g=>g.chunk).join(',')==='1,2,0');
  t('unmapped source facts remain primary audit facts',first.sourceFactIds.includes('fact-2')&&first.facts.some(f=>f.id==='fact-2'));
  t('facts absent from captured chunk lists remain explicitly grouped',residual.sourceFactIds.includes('fact-4'));
  t('unmapped notes retain current text and unresolved links',first.notes.some(n=>n.id==='unmapped'&&n.unresolvedFactIds[0]==='fact-999'&&n.text===rows[2].text));
  t('notes without a source chunk are not silently lost',residual.notes.some(n=>n.id==='orphan'));
  t('cross-chunk note mappings appear with both support facts',second.notes.some(n=>n.id==='cross')&&second.facts.some(f=>f.id==='fact-1')&&first.facts.some(f=>f.id==='fact-3'));
  t('cross-chunk supporting facts do not become primary coverage obligations',!second.sourceFactIds.includes('fact-1'));
  t('audit facts preserve actual source aliases and subtype',first.facts[0].aliases[0]==='Synthetic alias'&&first.facts[0].subtype==='independent');
  t('audit packet excludes source quotes',!JSON.stringify(groups).includes('QUOTE_ONLY_SECRET')&&!Object.hasOwn(first.facts[0],'sourceQuote'));
  t('selected source-tier metadata is explicit',first.facts.find(f=>f.id==='fact-1').inSelectedTier&&!first.facts.find(f=>f.id==='fact-2').inSelectedTier);
  t('other-tier notes remain visible but ineligible for selected export',first.notes.some(n=>n.id==='other-tier'&&n.keep&&!n.inSelectedTier&&!n.eligible));
  t('manual exclusions remain visible and do not supply active scope',second.notes.some(n=>n.id==='excluded'&&!n.keep&&!n.eligible)&&!second.scopeNoteIds.includes('excluded'));
  t('structural failures remain visible but have no review targets',second.notes.some(n=>n.id==='broken'&&!n.structurallyValid&&!n.eligible&&n.reviewTargets.length===0));
  const target=first.notes.find(n=>n.id==='one').reviewTargets;
  t('same-index gaps remain one review with all hidden answers',target.length===2&&target[0].answers.join(',')==='hold,notify');
  t('review fronts expose visible sibling answers while masking the chosen target',target[0].front.includes('review')&&!target[0].front.includes('hold')&&target[1].front.includes('hold')&&!target[1].front.includes('after review'));
  t('all-tier audit includes otherwise eligible second-tier notes',H.ankiAuditGroups(rows,batch,'all')[0].scopeNoteIds.includes('other-tier'));
  const edited=H.ankiAuditGroups([{...rows[0],extra:'Edited explanation.',text:'[Synthetic] Updated {{c1::answer}}'}],batch,'1');
  t('audit uses edited Text and Extra rather than original batch responses',edited[0].notes[0].extra==='Edited explanation.'&&edited[0].notes[0].reviewTargets[0].answers[0]==='answer');
  t('audit needs a captured snapshot',throws(()=>H.ankiAuditGroups(rows,null)));
  t('invalid audit tier is rejected',throws(()=>H.ankiAuditGroups(rows,batch,'4')));
  t('duplicate fact identities are rejected before grouping',throws(()=>H.ankiAuditGroups(rows,{snapshot:{facts:[facts[0],facts[0]]},chunkIds:[]})));
  t('duplicate note identities cannot be silently merged',throws(()=>H.ankiAuditGroups([rows[0],rows[0]],batch)));
  t('unknown captured chunk facts are rejected',throws(()=>H.ankiAuditGroups(rows,{...batch,chunkIds:[['fact-999']]})));
  const manyFacts=Array.from({length:9},(_,i)=>fact('fact-'+(i+10),'Synthetic '+String(i)+' '+('detail '.repeat(340))));
  const manyNotes=manyFacts.map((f,i)=>card('note-'+i,[f.id],{text:'[Synthetic] {{c1::answer}} '+('context '.repeat(80))}));
  const split=H.ankiAuditGroups(manyNotes,{snapshot:{facts:manyFacts},chunkIds:[manyFacts.map(f=>f.id)]});
  t('large source chunks split into explicitly numbered bounded groups',split.length>1&&split.every((g,i)=>g.part===i+1&&g.parts===split.length&&g.sizeChars<=H.ANKI_SOURCE_AUDIT_GROUP_CHARS));
  t('bounded grouping preserves every primary fact',new Set(split.flatMap(g=>g.sourceFactIds)).size===manyFacts.length);
  t('bounded grouping preserves every current note',new Set(split.flatMap(g=>g.notes.map(n=>n.id))).size===manyNotes.length);
  t('oversized indivisible source is rejected without truncation',throws(()=>H.ankiAuditGroups([],{snapshot:{facts:[fact('fact-1','x'.repeat(25000))]},chunkIds:[['fact-1']]})));
  t('oversized unmapped note is rejected without truncation',throws(()=>H.ankiAuditGroups([card('large',[],{text:'{{c1::'+'x'.repeat(25000)+'}}'})],batch)));
  const unmappedFacts=manyFacts.map(f=>({...f,text:'Synthetic '+('detail '.repeat(130))}));
  const unmappedSplit=H.ankiAuditGroups([...manyNotes,card('unmapped-small',[])],{snapshot:{facts:unmappedFacts},chunkIds:[manyFacts.map(f=>f.id)]});
  t('unmapped chunk notes accompany each primary fact window',unmappedSplit.length>1&&unmappedSplit.every(g=>g.notes.some(n=>n.id==='unmapped-small')));
  t('unmapped notes receive their complete origin-chunk source evidence',unmappedSplit.every(g=>g.facts.length===manyFacts.length));
  const prompt=H.ankiBuildSourceAuditPrompt(first);
  t('audit prompt states the separate source boundary',prompt.includes('FACT.text is the sole clinical evidence')&&prompt.includes('Source quotes and side tables were not provided'));
  t('audit prompt distinguishes source conflict from invented card values',prompt.includes('copying a contradictory source is not an invented card value'));
  t('audit prompt distinguishes printed content from tested targets',prompt.includes('present only in Extra is not necessarily tested'));
  t('audit prompt respects manual selection',prompt.includes('excluded from the current export by manual selection')&&prompt.includes('Do not pressure the user'));
  t('audit prompt forbids automatic changes and certification',prompt.includes('not a clinical certification')&&prompt.includes('Do not apply edits, repair the source, delete content'));
  t('audit prompt requests source-supported suggestions while preserving originals',prompt.includes('propose concise revised wording or a retrieval-target change supported only by the supplied facts')&&prompt.includes('Keep the original note intact'));
  t('audit prompt permits an empty suggestion for unresolved source conflicts',prompt.includes('Use an empty suggestion when no source-supported correction can be established, including an unresolved source conflict'));
  t('audit prompt includes the exact grouped current packet',prompt.endsWith(JSON.stringify(first)));

  const finding=(code='changed-meaning',factIds=['fact-1'],noteIds=['one'],message='The supplied modifier was changed.',suggestion=code==='source-conflict'?'':'Preserve the supplied modifier.')=>({code,factIds,noteIds,message,suggestion});
  const parse=findings=>H.ankiParseSourceAudit(JSON.stringify(validReceipt(first,findings)),first);
  const valid=[finding(),finding('unsupported',[],['one']),finding('missing-target',['fact-1'],[]),finding('duplicate-target',[],['one','cross']),finding('priority-loss',['fact-1'],['other-tier']),finding('source-conflict',['fact-1'],[])];
  t('audit parser accepts all six defined finding categories',parse(valid).findings.length===6);
  t('audit parser accepts an explicit no-findings result',parse([]).findings.length===0);
  t('audit parser accepts exactly one optional JSON fence',H.ankiParseSourceAudit('```json\n'+JSON.stringify(validReceipt(first))+'\n```',first).findings.length===0);
  t('priority loss may cite an out-of-tier note containing a selected fact',parse([finding('priority-loss',['fact-1'],['other-tier'])]).findings[0].noteIds[0]==='other-tier');
  t('audit parser trims explanatory whitespace only',parse([finding('unsupported',[],['one'],'  Explain this.  ')]).findings[0].message==='Explain this.');
  t('audit parser retains a source-supported suggestion after trimming',parse([finding('changed-meaning',['fact-1'],['one'],'Explain this.','  Retain may in the note.  ')]).findings[0].suggestion==='Retain may in the note.');
  t('audit parser accepts an explicitly empty suggestion',parse([finding('source-conflict',['fact-1'],[],'The source conflicts.','')]).findings[0].suggestion==='');
  const literal='<img src=x onerror="throw new Error(1)"> {{c1::hold}} | literal ${notExecuted}';
  t('audit suggestions retain literal study text without execution or interpretation',parse([finding('changed-meaning',['fact-1'],['one'],'Explain this.',literal)]).findings[0].suggestion===literal);
  const rejected=[
    ['unknown code',finding('fatal')],
    ['unknown source ID',finding('changed-meaning',['fact-999'])],
    ['unknown note ID',finding('changed-meaning',['fact-1'],['unknown'])],
    ['duplicate fact references',finding('changed-meaning',['fact-1','fact-1'])],
    ['duplicate note references',finding('duplicate-target',[],['one','one'])],
    ['empty message',finding('unsupported',[],['one'],' ')],
    ['excessive message',finding('unsupported',[],['one'],'x'.repeat(2001))],
    ['non-string suggestion',{...finding(),suggestion:42}],
    ['null suggestion',{...finding(),suggestion:null}],
    ['missing suggestion',((f)=>{delete f.suggestion;return f;})(finding())],
    ['excessive suggestion',{...finding(),suggestion:'x'.repeat(2001)}],
    ['changed meaning without source',finding('changed-meaning',[],['one'])],
    ['unsupported without note',finding('unsupported',['fact-1'],[])],
    ['unsupported only on inactive notes',finding('unsupported',[],['other-tier'])],
    ['missing target only for unselected fact',finding('missing-target',['fact-2'],[])],
    ['missing target only for support fact',finding('missing-target',['fact-3'],[])],
    ['duplicate target with only one eligible note',finding('duplicate-target',[],['one','other-tier'])],
    ['priority loss without a selected primary fact',finding('priority-loss',['fact-2'],['other-tier'])],
    ['source conflict without source',finding('source-conflict',[],[])],
    ['non-array references',{...finding(),factIds:'fact-1'}],
    ['extra finding fields',{...finding(),repair:'Replace text'}],
    ['null finding',null]
  ];
  for(const [label,item] of rejected)t('audit parser rejects '+label,throws(()=>parse([item])));
  t('one malformed finding rejects the entire result without partial acceptance',throws(()=>parse([valid[0],finding('unknown')])));
  for(const raw of ['{}','[]','{"findings":null}','{"findings":[],"pass":true}','before {"findings":[]}','```json\n{"findings":[]}\n```\nafter','{"findings": [}'])t('audit parser rejects malformed response '+raw,throws(()=>H.ankiParseSourceAudit(raw,first)));
  t('audit helper extraction reaches the complete parser tail',source.includes('return {factReviews:parsed.factReviews,noteReviews:parsed.noteReviews,findings:parsed.findings.map')&&parse([finding('source-conflict',['fact-1'],[])]).findings[0].code==='source-conflict'&&parse([]).noteReviews.length===first.scopeNoteIds.length);
}

module.exports={runAnkiSourceAuditTests};
