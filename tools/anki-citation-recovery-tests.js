'use strict';

// Synthetic protocol regressions. Recovery proves a source location, not entailment.
function runAnkiCitationRecoveryTests({S,t,section}){
  if(section)section('Anki conservative citation recovery and validation diagnostics');
  const start='function ankiMatchSourceSpan(factText,span){',end='// v16.2: complete fact coverage can coexist with an unmapped note.';
  const a=S.indexOf(start),b=S.indexOf(end,a+start.length);
  if(a<0||b<=a||S.indexOf(start,a+start.length)>=0)throw Error('Anki citation helper extraction anchors moved or became ambiguous.');
  const source=S.slice(a,b),H=new Function(source+';return {ankiMatchSourceSpan,ankiParseSourceAudit};')();
  const match=H.ankiMatchSourceSpan,copy=x=>JSON.parse(JSON.stringify(x));
  const checks=[
    ['exact citations need no recovery',()=>{const x=match('A marker remains stable.','marker');return x.ok&&x.sourceSpan==='marker'&&x.method===null;}],
    ['existing exact repeated citations retain the original contract',()=>match('marker and marker','marker').method===null],
    ['exact multilingual source words are retained',()=>match('A marker یا another marker.','یا').sourceSpan==='یا'],
    ['unique whitespace is restored to the original source bytes',()=>{const x=match('A blue\t\nmarker remains stable.','blue marker');return x.ok&&x.method==='whitespace'&&x.sourceSpan==='blue\t\nmarker';}],
    ['nonbreaking spaces are recovered without rewriting source facts',()=>match('A blue\u00a0marker.','blue marker').sourceSpan==='blue\u00a0marker'],
    ['whitespace source offsets remain correct after Unicode characters',()=>match('💠 A blue\tmarker.','blue marker').sourceSpan==='blue\tmarker'],
    ['blank citations stay invalid',()=>!match('A marker.','\t ').ok],
    ['non-string citations stay invalid',()=>!match('A marker.',42).ok],
    ['oversized citations stay invalid',()=>!match('x'.repeat(2001),'x'.repeat(2001)).ok],
    ['recovery cannot exceed the canonical source span limit',()=>!match('blue'+' '.repeat(2000)+'marker','blue marker').ok],
    ['ambiguous whitespace recovery is rejected',()=>match('blue\tmarker and blue\nmarker','blue marker').reason==='ambiguous-span'],
    ['inserted words are not normalized away',()=>!match('A blue marker.','A extra blue marker.').ok],
    ['inserted non-Latin text remains a citation failure',()=>!match('A blue marker.','A پر blue marker.').ok],
    ['zero-width inserted characters remain a citation failure',()=>!match('A blue marker.','A blue\u200b marker.').ok],
    ['punctuation substitutions stay invalid',()=>!match('A blue marker; report it.','blue marker, report it').ok],
    ['numeric changes stay invalid',()=>!match('Use 5 units.','Use 6 units.').ok],
    ['comparator changes stay invalid',()=>!match('Keep value <5.','value >5').ok],
    ['unit case is not broadly folded',()=>!match('Use 1 mg.','1 Mg').ok],
    ['short initial unit symbols are not treated as prose words',()=>!match('Mg is a synthetic symbol.','mg').ok],
    ['unit-like longer tokens are excluded from initial-case recovery',()=>!match('Mmol labels a synthetic unit.','mmol').ok],
    ['unlisted unit abbreviations cannot pass prose case recovery',()=>['Msec','Mbar','Mrem','Mrad'].every(unit=>!match(unit+' labels a synthetic unit.',unit.toLowerCase()).ok)],
    ['unlisted ordinary words remain strict rather than broadening case recovery',()=>!match('Unlisted prose begins here.','unlisted').ok],
    ['an explicitly supported directive can recover its initial case',()=>match('Monitor the synthetic marker.','monitor').sourceSpan==='Monitor'],
    ['range punctuation is not silently rewritten',()=>!match('Keep value 5–7.','5-7').ok],
    ['a unique fact-initial prose capital can recover',()=>{const x=match('Lanugo labels the synthetic marker.','lanugo');return x.ok&&x.sourceSpan==='Lanugo'&&x.method==='sentence-initial-case';}],
    ['initial-case and whitespace recovery retain both changes in provenance',()=>{const x=match('Lanugo\tlabels the synthetic marker.','lanugo labels');return x.ok&&x.sourceSpan==='Lanugo\tlabels'&&x.method==='whitespace-and-sentence-initial-case';}],
    ['interior capitalization is outside the narrow recovery exception',()=>!match('The Lanugo label is synthetic.','lanugo').ok],
    ['reverse initial capitalization is outside the exception',()=>!match('lanugo labels the synthetic marker.','Lanugo').ok],
    ['all-capital identifiers remain case-sensitive',()=>!match('MARKER labels a synthetic identifier.','marker').ok],
    ['only the first letter can change',()=>!match('Lanugo labels the marker.','lanugo Labels').ok],
    ['a partial first word is not recoverable',()=>!match('Lanugo labels the marker.','lanu').ok],
    ['a repeated capitalized source candidate is ambiguous',()=>match('Lanugo labels Lanugo.','lanugo').reason==='ambiguous-span']
  ];
  for(const [name,check] of checks)t('citation '+name,check());

  const note={id:'note-1',text:'[Synthetic] Marker label: {{c1::lanugo}}.',extra:'',keep:true,structurallyValid:true,inSelectedTier:true,eligible:true,factIds:['fact-1'],reviewTargets:[{index:1,front:'[Synthetic] Marker label: [...].',answers:['lanugo']}]};
  const group={id:'synthetic-group',sourceFactIds:['fact-1'],scopeNoteIds:['note-1'],facts:[{id:'fact-1',text:'Lanugo labels the synthetic marker.',inSelectedTier:true}],notes:[note]};
  const base={factReviews:[{factId:'fact-1',targets:[{sourceSpan:'Lanugo',status:'tested',noteRefs:[{noteId:'note-1',clozeIndices:[1]}]}]}],noteReviews:[{noteId:'note-1',text:{status:'supported',evidence:[{factId:'fact-1',sourceSpan:'Lanugo labels the synthetic marker.'}]},extra:{status:'empty',evidence:[]}}],findings:[]};
  const parse=(value,packet=group)=>H.ankiParseSourceAudit(JSON.stringify(value),packet);
  const errorOf=(value,packet=group)=>{try{parse(value,packet);return null;}catch(e){return e;}};
  t('exact audit receipts return an explicit empty recovery list',parse(base).citationRecoveries.length===0);
  const lower=copy(base);lower.factReviews[0].targets[0].sourceSpan='lanugo';
  const raw=JSON.stringify(lower),before=JSON.stringify(group),recovered=H.ankiParseSourceAudit(raw,group),recovery=recovered.citationRecoveries[0];
  t('parser canonicalizes a recoverable target span only in its returned receipt',recovered.factReviews[0].targets[0].sourceSpan==='Lanugo'&&lower.factReviews[0].targets[0].sourceSpan==='lanugo');
  t('recovery records exact receipt path and source/note identities',recovery.groupId==='synthetic-group'&&recovery.path==='factReviews[0].targets[0].sourceSpan'&&recovery.factId==='fact-1'&&recovery.noteId==='note-1');
  t('recovery retains the original citation and the proven source citation',recovery.originalSourceSpan==='lanugo'&&recovery.sourceSpan==='Lanugo'&&recovery.method==='sentence-initial-case');
  t('parser leaves raw response and source/card snapshot unchanged',raw===JSON.stringify(lower)&&before===JSON.stringify(group));
  const fieldPacket=copy(group);fieldPacket.facts[0].text='Lanugo\tlabels the synthetic marker.';fieldPacket.notes[0].extra='Synthetic context.';
  const fields=copy(base);fields.noteReviews[0].text.evidence[0].sourceSpan='lanugo labels the synthetic marker.';fields.noteReviews[0].extra={status:'supported',evidence:[{factId:'fact-1',sourceSpan:'Lanugo labels the synthetic marker.'}]};
  const fieldResult=parse(fields,fieldPacket);
  t('Text and Extra citations both use canonical source spans',fieldResult.noteReviews[0].text.evidence[0].sourceSpan===fieldPacket.facts[0].text&&fieldResult.noteReviews[0].extra.evidence[0].sourceSpan===fieldPacket.facts[0].text);
  t('field recoveries keep separate paths and recovery methods',fieldResult.citationRecoveries.length===2&&fieldResult.citationRecoveries[0].path==='noteReviews[0].text.evidence[0].sourceSpan'&&fieldResult.citationRecoveries[0].method==='whitespace-and-sentence-initial-case'&&fieldResult.citationRecoveries[1].path==='noteReviews[0].extra.evidence[0].sourceSpan'&&fieldResult.citationRecoveries[1].method==='whitespace');
  const corrupt=copy(base);corrupt.noteReviews[0].text.evidence[0].sourceSpan='Lanugo پر labels the synthetic marker.';
  const err=errorOf(corrupt);
  t('unrecoverable evidence yields a structured validation error',err instanceof Error&&err.code==='anki-audit-validation'&&err.detail.matchReason==='no-source-match');
  t('citation errors identify the precise group, field, source and note',err.detail.groupId==='synthetic-group'&&err.detail.path==='noteReviews[0].text.evidence[0].sourceSpan'&&err.detail.factId==='fact-1'&&err.detail.noteId==='note-1');
  t('citation errors preserve the offending quotation and explain rejection',err.detail.sourceSpan===corrupt.noteReviews[0].text.evidence[0].sourceSpan&&err.message.includes('not an exact or safely recoverable substring')&&err.message.includes('fact-1'));
  const unknown=copy(base);unknown.noteReviews[0].text.evidence[0].factId='fact-unknown';
  t('unknown evidence facts are not repaired to another source ID',errorOf(unknown).detail.factId==='fact-unknown'&&errorOf(unknown).message.includes('unknown source fact'));
  let jsonError;try{H.ankiParseSourceAudit('{bad',group);}catch(e){jsonError=e;}
  t('malformed JSON has the same structured validation category',jsonError?.code==='anki-audit-validation'&&jsonError.detail.path==='$'&&jsonError.message.includes('invalid JSON'));
  const modelMetadata=copy(base);modelMetadata.citationRecoveries=[];
  t('provider-supplied recovery metadata cannot bypass the strict model schema',errorOf(modelMetadata)?.code==='anki-audit-validation');
  const missing=copy(base);missing.factReviews=[];
  t('missing primary-fact coverage remains a validation failure',errorOf(missing)?.detail.path==='factReviews');
  const noNote=copy(base);noNote.noteReviews=[];
  t('missing scoped-note coverage remains a validation failure',errorOf(noNote)?.detail.path==='noteReviews');
  const unknownNote=copy(lower);unknownNote.factReviews[0].targets[0].noteRefs[0].noteId='other-note';
  t('a recovered citation cannot hide an unknown target note',errorOf(unknownNote)?.detail.path==='factReviews[0].targets[0].noteRefs[0]'&&errorOf(unknownNote).detail.noteId==='other-note');
  const unknownCloze=copy(lower);unknownCloze.factReviews[0].targets[0].noteRefs[0].clozeIndices=[3];
  t('a recovered citation cannot hide an unknown cloze index',errorOf(unknownCloze)?.detail.path==='factReviews[0].targets[0].noteRefs[0].clozeIndices');
  const duplicates=copy(lower);duplicates.factReviews[0].targets.push(copy(base.factReviews[0].targets[0]));
  t('two targets collapsing to one recovered source span are rejected',errorOf(duplicates)?.message.includes('repeats a source span after citation recovery'));
  const repeatedEvidence=copy(lower);repeatedEvidence.noteReviews[0].text.evidence.push({factId:'fact-1',sourceSpan:'lanugo labels the synthetic marker.'});
  t('duplicate evidence is checked after canonical recovery',errorOf(repeatedEvidence)?.message.includes('repeats a source citation after recovery'));
  const partlyBad=copy(lower);partlyBad.noteReviews[0].text.evidence[0].sourceSpan='Lanugo extra labels the synthetic marker.';const badBefore=JSON.stringify(partlyBad);
  t('a later invalid receipt prevents partial acceptance of recovered targets',errorOf(partlyBad)?.detail.path==='noteReviews[0].text.evidence[0].sourceSpan'&&JSON.stringify(partlyBad)===badBefore);
  const empty={id:'empty-group',facts:[],notes:[],sourceFactIds:[],scopeNoteIds:[]};
  t('an empty group still accepts empty receipts with no synthetic recovery',parse({factReviews:[],noteReviews:[],findings:[]},empty).citationRecoveries.length===0);
  t('citation extraction reaches the complete parser tail and preserves findings',source.includes('return {factReviews:parsed.factReviews,noteReviews:parsed.noteReviews,findings:parsed.findings.map')&&source.includes(')),citationRecoveries};')&&recovered.findings.length===0);
}

module.exports={runAnkiCitationRecoveryTests};
