'use strict';

async function runAnkiIntegrityEvidenceTests({S,t,section}){
  if(section)section('Anki integrity: downloadable provenance and evidence limits');
  const span=(a,b)=>{if(S.split(a).length!==2||S.split(b).length!==2)throw Error('Evidence extraction anchors moved');const i=S.indexOf(a),j=S.indexOf(b,i+a.length);if(j<=i)throw Error('Evidence extraction tail moved');return S.slice(i,j);};
  const source=span('function ankiParseCards(raw','function AnkiStyleBadges');let seq=0;
  const H=new Function('uid','globalThis','TextEncoder',source+';return {ankiSourceSnapshot,ankiParseCards,attachCoverageToCards,ankiNormalizeConditionTags,ankiDedupeCards,ankiNoteProvenance,ankiSourceAuditEvidence,ankiNumericAudit,ankiBatchDiagnostics,ankiExportText,ankiReviewDecisionEvidence};')(()=> 'evidence-'+(++seq),{crypto:require('crypto').webcrypto},TextEncoder);
  const kb={conditions:[{name:'Alpha Group',aliases:['AG'],facts:[{id:'fact-1',text:'Use the blue marker.',latteBucket:'Assess',tier:1,sources:[{filename:'synthetic.pdf',location:'page 1'}]}]}]},snapshot=H.ankiSourceSnapshot(kb);
  const raw='```text\nUse {{c1::blue}}.|Supplied context.|Condition::AG Tier::1\nUse {{c1::blue}}.|Supplied context.|Condition::AlphaGroup Tier::1\n```\n```text\nfact-1 -> line #1\nfact-1 -> line #2\n```';
  const parsed=H.ankiParseCards(raw);H.attachCoverageToCards(parsed.cards,[{chunk:1,text:parsed.ledger}],snapshot,[['fact-1']]);
  const normalized=H.ankiNormalizeConditionTags(H.ankiDedupeCards(parsed.cards),snapshot),cards=H.ankiDedupeCards(normalized.cards),before=JSON.stringify(cards);
  t('final exact merge retains one note and both original identities',cards.length===1&&cards[0].mergedNoteIds.length===2);
  const evidence=H.ankiNoteProvenance(cards);
  t('note evidence preserves both original source locations',evidence[0].sourceLocations.length===2&&evidence[0].sourceLocations.every(x=>x.factIds[0]==='fact-1'));
  t('note evidence preserves both parse records and alias normalization',evidence[0].parseProvenance.length===2&&evidence[0].conditionTagNormalizations.some(x=>x.before.includes('Condition::AG')&&x.after.includes('Condition::AlphaGroup')));
  evidence[0].sourceLocations[0].factIds.push('fact-999');t('download projection does not alias live provenance',JSON.stringify(cards)===before);
  const polluted=JSON.parse(before);polluted[0].apiKey='CREDENTIAL_SENTINEL';polluted[0].parseProvenance[0].apiKey='CREDENTIAL_SENTINEL';
  t('download projection excludes unrelated runtime properties',!JSON.stringify(H.ankiNoteProvenance(polluted)).includes('CREDENTIAL_SENTINEL'));
  const batch={snapshot,sourceKB:kb,rawCards:parsed.cards,chunkIds:[['fact-1']],mappingIssues:[],conditionTagOutcomes:normalized.outcomes,conditionTagChanges:normalized.changes,rawResponses:[raw],truncated:false};
  const report=await H.ankiSourceAuditEvidence({cards,batch,groups:[],results:[],responses:[],status:'prepared',tier:'all'},{cards,batch,current:true,tier:'all'});
  t('source-check report serializes merge provenance',report.noteProvenance[0].sourceLocations.length===2&&report.noteProvenance[0].parseProvenance.length===2);
  const start='JSON.stringify({suiteVersion:suiteVersion(),model:batch.model';if(S.split(start).length!==2)throw Error('Diagnostic export anchor not unique');const a=S.indexOf(start),b=S.indexOf(',null,2)',a);if(b<0)throw Error('Diagnostic export tail missing');
  const save=new Function('batch','diagnostics','suiteVersion','cards','ankiNoteProvenance','return '+S.slice(a,b+8));
  const saved=JSON.parse(save(batch,{},()=> 'unreleased',cards,H.ankiNoteProvenance));
  t('actual batch download serializes final note locations and normalization history',saved.noteProvenance[0].sourceLocations.length===2&&saved.noteProvenance[0].conditionTagNormalizations.length===1);
  t('actual batch download preserves original normalization outcomes and responses',saved.conditionTagOutcomes.length===2&&saved.rawResponses[0]===raw);
  const hint=H.ankiParseCards('Use {{c1::blue::7 mg}}.||Tier::1').cards[0];hint.factIds=['fact-1'];hint.mappingIssues=[];
  const audited=H.ankiNumericAudit(hint,{snapshot},true),diag=H.ankiBatchDiagnostics([hint],{snapshot,rawCards:[hint]},true);
  t('hint-only number records its own checked count and advisory',audited.checked===0&&audited.hintChecked===1&&audited.findings.some(x=>x.code==='hint-numeric-discrepancy'));
  t('batch numeric totals include executed hint comparisons',diag.numeric.checkedNotes===1&&diag.numeric.checkedHintTokens===1&&diag.numeric.hintDiscrepancies===1);
  t('hint warning never blocks export',H.ankiExportText([hint],{snapshot},true,'all',false,false).includes('7 mg'));
  t('no-op manual decisions still reach the live extraction tail',H.ankiReviewDecisionEvidence([],[],{current:true,cards,batch,tier:'all'},null).length===0);
}
module.exports={runAnkiIntegrityEvidenceTests};
