'use strict';

// Synthetic checks of live reference decoding; no model or clinical judgments.
function runAnkiAuditV166Tests({S,t,section}){
  if(section)section('Anki v16.6 lossless audit reference normalization');
  const start='function ankiAuditSourceTokens(text){',end='// v16.2: complete fact coverage can coexist with an unmapped note.';
  const a=S.indexOf(start),b=S.indexOf(end,a+start.length);
  if(a<0||b<=a||S.indexOf(start,a+start.length)>=0)throw Error('Anki v16.6 parser extraction anchors moved or became ambiguous.');
  const source=S.slice(a,b),H=new Function(source+';return {ankiParseSourceAuditV4,ankiMergeSourceAuditResult};')();
  const copy=x=>JSON.parse(JSON.stringify(x));
  const facts=[{id:'fact-1',text:'Green and blue markers remain.',inSelectedTier:true},{id:'fact-2',text:'Square labels remain clearly visible.',inSelectedTier:true}];
  const notes=[{id:'uuid-a',text:'[Marker] {{c1::Green}} and {{c2::blue}} markers remain.',extra:'Green markers remain.',keep:true,structurallyValid:true,inSelectedTier:true,eligible:true,reviewTargets:[{index:1},{index:2}]},{id:'uuid-b',text:'[Label] {{c3::Square}} labels remain.',extra:'Green markers remain.',keep:true,structurallyValid:true,inSelectedTier:true,eligible:true,reviewTargets:[{index:3}]}];
  const group={id:'synthetic-v166',protocolVersion:4,facts,notes,sourceFactIds:facts.map(f=>f.id),scopeNoteIds:notes.map(n=>n.id)};
  const range={start:1,end:5},evidence=factId=>[{factId,sourceRef:{...range}}];
  const base={factReviews:facts.map((f,i)=>({factId:f.id,inventory:[{sourceRef:{...range},role:'target',reason:''}],targets:[{sourceRef:{...range},status:'tested',noteRefs:[{noteId:'n'+(i+1),clozeIndices:[i?3:1]}],contextRefs:[]}]})),noteReviews:facts.map((f,i)=>({noteId:'n'+(i+1),text:{status:'supported',evidence:evidence(f.id)},extra:{status:'supported',evidence:evidence(f.id)}})),findings:[]};
  const parse=(value=base,packet=group)=>H.ankiParseSourceAuditV4(JSON.stringify(value),packet);
  const change=(fn,packet=group)=>{const value=copy(base);fn(value);return parse(value,packet);};
  const target=value=>value.factReviews[0].targets[0];
  const contextual=(value,status='visible-only',refs=[{noteId:'n1',field:'text'},{noteId:'n2',field:'extra'}])=>Object.assign(target(value),{status,noteRefs:[],contextRefs:refs});
  const verdict=result=>result.factReviews.find(f=>f.factId==='fact-1')?.targets[0];
  const good=parse(),mixed=change(v=>contextual(v)),extraDeclared=change(v=>contextual(v,'extra-only'));
  t('v16.6 already canonical references need no recovery',good.complete&&good.referenceRecoveries.length===0&&good.citationRecoveries.length===0);
  t('v16.6 mixed Text and Extra preserve both exact locations',mixed.complete&&JSON.stringify(verdict(mixed).contextRefs)==='[{"noteId":"uuid-a","field":"text"},{"noteId":"uuid-b","field":"extra"}]');
  t('v16.6 mixed contextual locations remain visible-only with no hidden claims',verdict(mixed).status==='visible-only'&&verdict(mixed).noteRefs.length===0);
  t('v16.6 mixed acceptance is recorded separately from citation repair',mixed.referenceRecoveries.length===1&&mixed.referenceRecoveries[0].method==='mixed-context-status'&&mixed.citationRecoveries.length===0);
  t('v16.6 mixed diagnostics retain original handles and normalized locations',mixed.referenceRecoveries[0].before.contextRefs[0].noteId==='n1'&&mixed.referenceRecoveries[0].after.contextRefs[0].noteId==='uuid-a');
  t('v16.6 mixed Extra declaration normalizes to visible-only',extraDeclared.complete&&verdict(extraDeclared).status==='visible-only'&&extraDeclared.referenceRecoveries[0].before.status==='extra-only');
  const reverse=change(v=>contextual(v,'extra-only',[{noteId:'n2',field:'extra'},{noteId:'n1',field:'text'}]));
  t('v16.6 mixed label is independent of contextual-reference order',reverse.complete&&verdict(reverse).status==='visible-only'&&verdict(reverse).contextRefs[0].field==='extra');
  const oneNote=change(v=>contextual(v,'extra-only',[{noteId:'n1',field:'extra'},{noteId:'n1',field:'text'}]));
  t('v16.6 one note may retain distinct Text and Extra locations',oneNote.complete&&verdict(oneNote).contextRefs.length===2&&verdict(oneNote).status==='visible-only');
  const onlyExtra=change(v=>contextual(v,'visible-only',[{noteId:'n2',field:'extra'}]));
  t('v16.6 exclusively Extra locations normalize to extra-only',onlyExtra.complete&&verdict(onlyExtra).status==='extra-only'&&onlyExtra.referenceRecoveries[0].after.status==='extra-only');
  const onlyText=change(v=>contextual(v,'extra-only',[{noteId:'n1',field:'text'}]));
  t('v16.6 exclusively Text locations normalize to visible-only',onlyText.complete&&verdict(onlyText).status==='visible-only');
  const duplicate=change(v=>contextual(v,'visible-only',[{noteId:'n1',field:'text'},{noteId:'n1',field:'text'}]));
  t('v16.6 repeated identical contextual references remain rejected',!duplicate.complete&&!verdict(duplicate));
  t('v16.6 context-only declarations with hidden refs remain rejected',!change(v=>{target(v).status='extra-only';target(v).contextRefs=[{noteId:'n2',field:'extra'}];}).complete);
  t('v16.6 context-only declarations require at least one location',!change(v=>contextual(v,'visible-only',[])).complete);
  const empty=copy(group);empty.notes[1].extra='';
  t('v16.6 contextual references to empty fields remain rejected',!change(v=>contextual(v),empty).complete);
  t('v16.6 unknown context handles remain rejected',!change(v=>contextual(v,'extra-only',[{noteId:'n9',field:'extra'}])).complete);
  t('v16.6 unsupported context field names remain rejected',!change(v=>contextual(v,'visible-only',[{noteId:'n1',field:'front'}])).complete);
  const excluded=copy(group);excluded.notes[1].keep=false;excluded.notes[1].eligible=false;excluded.scopeNoteIds=['uuid-a'];
  const excludedResult=change(v=>{contextual(v);v.factReviews[1].targets[0].status='manual-excluded';v.noteReviews.pop();},excluded);
  t('v16.6 mixed contextual coverage cannot be claimed from an excluded note',!excludedResult.complete&&!verdict(excludedResult));
  const outTier=copy(excluded);outTier.notes[1].keep=true;outTier.notes[1].inSelectedTier=false;
  t('v16.6 mixed contextual coverage cannot be claimed from an out-of-tier note',!change(v=>{contextual(v);v.factReviews[1].targets[0].status='out-of-tier';v.noteReviews.pop();},outTier).complete);
  const offScope=copy(group);offScope.notes.push({...copy(notes[1]),id:'uuid-context',keep:false,eligible:false});
  const testedContext=change(v=>{target(v).contextRefs=[{noteId:'n3',field:'extra'}];},offScope);
  t('v16.6 tested targets can retain excluded context without using it as hidden evidence',testedContext.complete&&verdict(testedContext).status==='tested'&&verdict(testedContext).noteRefs[0].noteId==='uuid-a'&&verdict(testedContext).contextRefs[0].noteId==='uuid-context');
  t('v16.6 tested context refs do not trigger a contextual status recovery',testedContext.referenceRecoveries.length===0);

  const disjoint=change(v=>{target(v).noteRefs.push({noteId:'n1',clozeIndices:[2]});});
  t('v16.6 repeated exact note handles merge disjoint existing indices',disjoint.complete&&JSON.stringify(verdict(disjoint).noteRefs)==='[{"noteId":"uuid-a","clozeIndices":[1,2]}]');
  t('v16.6 disjoint-reference merge preserves the tested verdict',verdict(disjoint).status==='tested'&&verdict(disjoint).contextRefs.length===0);
  t('v16.6 disjoint-reference recovery retains lossless before and after evidence',disjoint.referenceRecoveries.length===1&&disjoint.referenceRecoveries[0].method==='merged-disjoint-cloze-references'&&disjoint.referenceRecoveries[0].before.length===2&&disjoint.referenceRecoveries[0].after.clozeIndices.join(',')==='1,2');
  const separate=change(v=>{target(v).noteRefs.push({noteId:'n2',clozeIndices:[3]});});
  t('v16.6 distinct note identities remain separate references',separate.complete&&verdict(separate).noteRefs.length===2&&separate.referenceRecoveries.length===0);
  const overlap=change(v=>{target(v).noteRefs.push({noteId:'n1',clozeIndices:[1,2]});});
  t('v16.6 repeated indices across same-note references stay unresolved',!overlap.complete&&!verdict(overlap)&&overlap.referenceRecoveries.length===0);
  t('v16.6 repeated indices inside one reference stay unresolved',!change(v=>{target(v).noteRefs[0].clozeIndices=[1,1];}).complete);
  t('v16.6 disjoint but absent cloze indices stay unresolved',!change(v=>{target(v).noteRefs.push({noteId:'n1',clozeIndices:[3]});}).complete);
  t('v16.6 noninteger cloze indices stay unresolved',!change(v=>{target(v).noteRefs.push({noteId:'n1',clozeIndices:['2']});}).complete);
  t('v16.6 unknown repeated note handles cannot be guessed',!change(v=>{target(v).noteRefs.push({noteId:'n01',clozeIndices:[2]});}).complete);
  t('v16.6 extra reference keys remain rejected',!change(v=>{target(v).noteRefs[0].status='tested';}).complete);
  const failLater=change(v=>{contextual(v);target(v).sourceRef.end=4;});
  t('v16.6 a malformed fact cannot publish reference recoveries',!failLater.complete&&failLater.referenceRecoveries.length===0&&failLater.factReviews.length===1);
  const failedHidden=change(v=>{target(v).noteRefs.push({noteId:'n1',clozeIndices:[2]});target(v).status='visible-only';});
  t('v16.6 merged refs cannot rescue an invalid target role or leak tentative diagnostics',!failedHidden.complete&&failedHidden.referenceRecoveries.length===0);

  const badEvidence=change(v=>{v.noteReviews[0].text.evidence[0].end=5;});
  t('v16.6 redundant outer evidence coordinates are not silently deleted',!badEvidence.complete&&badEvidence.noteReviews.length===1&&badEvidence.factReviews.length===2);
  t('v16.6 conflicting outer evidence coordinates remain unresolved',!change(v=>{v.noteReviews[0].text.evidence[0].end=4;}).complete);
  t('v16.6 out-of-range source tokens remain unresolved',!change(v=>{v.noteReviews[0].text.evidence[0].sourceRef.end=6;}).complete);
  t('v16.6 unsupported inventory roles remain unresolved',!change(v=>{v.factReviews[0].inventory[0].role='support';}).complete);
  let badJson=false;try{H.ankiParseSourceAuditV4('{"factReviews":',group);}catch{badJson=true;}
  t('v16.6 invalid JSON remains a whole-attempt rejection',badJson);
  const before=JSON.stringify(base),groupBefore=JSON.stringify(group);parse(base);
  t('v16.6 decoding preserves provider objects and captured source bytes',JSON.stringify(base)===before&&JSON.stringify(group)===groupBefore);
  const retained=H.ankiMergeSourceAuditResult(disjoint,overlap,group);
  t('v16.6 an invalid retry preserves prior valid refs and their recovery',retained.complete&&verdict(retained).noteRefs[0].clozeIndices.join(',')==='1,2'&&retained.referenceRecoveries.length===1);
  const twice=H.ankiMergeSourceAuditResult(disjoint,disjoint,group);
  t('v16.6 identical recovery diagnostics deduplicate across retries',twice.referenceRecoveries.length===1);
  const both=H.ankiMergeSourceAuditResult(disjoint,mixed,group);
  t('v16.6 recovery history retains distinct methods across changed valid receipts',both.complete&&verdict(both).status==='visible-only'&&both.referenceRecoveries.length===2);
  t('v16.6 reference normalization does not reclassify citation recovery',both.citationRecoveries.length===0);
  t('v16.6 extraction reaches merge completion and reference-recovery tail',source.includes('requiredFacts.every(id=>factIds.has(id))')&&source.includes('referenceRecoveries,unresolved,complete')&&both.complete);
}

module.exports={runAnkiAuditV166Tests};

if(require.main===module){
  const fs=require('fs'),{resolveSuiteFile}=require('./repo-checks');
  let total=0;
  runAnkiAuditV166Tests({S:fs.readFileSync(resolveSuiteFile(),'utf8'),t:(name,pass)=>{total++;if(!pass)throw Error(name);}});
  process.stdout.write('Anki v16.6 reference tests: '+total+' assertions passed.\n');
}
