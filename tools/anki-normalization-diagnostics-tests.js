'use strict';

// Synthetic, offline checks of generation history versus later read-only tag decisions.
async function runAnkiNormalizationDiagnosticsTests({S,t,section}){
  if(section)section('Anki per-note normalization diagnostics');
  const start=S.indexOf('function ankiParseCards(raw'),end=S.indexOf('function AnkiStyleBadges',start);
  if(start<0||end<=start)throw Error('Anki normalization evidence extraction anchors moved.');
  const {webcrypto}=require('crypto');
  const H=new Function('uid','globalThis','TextEncoder',S.slice(start,end)+';return {ankiNormalizeConditionTags,ankiConditionTagDiagnostic,ankiConditionTagDiagnostics,ankiSourceAuditEvidence};')(()=> 'synthetic',{crypto:webcrypto},TextEncoder);
  const facts=[{id:'fact-1',condition:'Heart Failure',aliases:['HF'],text:'Synthetic first target.',tier:1,bucket:'Look'},{id:'fact-2',condition:'Heart Failure',aliases:['HF'],text:'Synthetic second target.',tier:1,bucket:'Look'},{id:'fact-3',condition:'Renal Failure',aliases:['RF'],text:'Synthetic third target.',tier:1,bucket:'Look'}];
  const snapshot={facts,byId:Object.fromEntries(facts.map(f=>[f.id,f]))};
  const card=(id,tags,extra={})=>({id,chunk:2,sourceLine:7,text:'[Synthetic] Target: {{c1::answer}}.',extra:'',tags,keep:true,factIds:['fact-1'],mappingIssues:[],...extra});
  const originals=[card('alias','Condition::HF Tier::1'),card('canonical','Condition::HeartFailure Tier::1',{sourceLine:8,keep:false}),card('unknown','Condition::Unlisted Tier::1',{sourceLine:9})];
  const before=JSON.stringify(originals),normalized=H.ankiNormalizeConditionTags(originals,snapshot);
  t('normalization captures an outcome for each processed note in order',normalized.outcomes.length===3&&normalized.outcomes.map(x=>x.noteId).join(',')==='alias,canonical,unknown');
  const [repair,canonical,review]=normalized.outcomes;
  t('repaired outcome retains exact original and resulting tags',repair.status==='repaired'&&repair.code==='source-alias'&&repair.before===originals[0].tags&&repair.after===normalized.cards[0].tags&&repair.canonicalTag==='Condition::HeartFailure');
  t('canonical no-op has affirmative outcome and unchanged tag bytes',canonical.status==='canonical'&&canonical.code==='canonical'&&canonical.before===canonical.after&&canonical.message.length>0);
  t('unknown alias records its reason and known canonical candidate without a change',review.status==='review'&&review.code==='non-alias-condition'&&review.canonicalTag==='Condition::HeartFailure'&&review.before===review.after);
  t('outcomes retain the note location and mapped source IDs',repair.chunk===2&&repair.sourceLine===7&&repair.factIds.join(',')==='fact-1'&&review.sourceLine===9);
  t('new diagnostics preserve prior change and issue result contracts',normalized.changes.length===1&&normalized.issues.length===1&&normalized.issues[0].noteId==='unknown');
  t('capturing outcomes never mutates source cards or selection',JSON.stringify(originals)===before&&normalized.cards[1]===originals[1]&&!normalized.cards[1].keep&&normalized.cards[2]===originals[2]);
  repair.factIds.push('fact-999');repair.actualTags.push('Condition::Injected');
  t('diagnostic arrays do not alias card mappings or recorded edit arrays',originals[0].factIds.length===1&&normalized.changes[0].factIds.length===1&&normalized.cards[0].conditionTagNormalization.factIds.length===1);
  const twice=H.ankiNormalizeConditionTags(normalized.cards,snapshot);
  t('a later normalization records a current canonical no-op while preserving the first edit',twice.outcomes[0].status==='canonical'&&twice.changes.length===0&&twice.cards[0].conditionTagNormalization.before===originals[0].tags);
  const mixed=H.ankiNormalizeConditionTags([card('mixed','Condition::HF Tier::1',{factIds:['fact-1','fact-2','fact-3']})],snapshot);
  t('majority-linked conditions still produce a preserved mixed-condition review outcome',mixed.outcomes[0].code==='mixed-conditions'&&mixed.outcomes[0].canonicalTag===''&&mixed.outcomes[0].factIds.length===3&&mixed.changes.length===0);
  const unreliable=H.ankiNormalizeConditionTags([card('unmapped','Condition::HF Tier::1',{mappingIssues:[{code:'missing-id'}]})],snapshot);
  t('unreliable mappings record skipped repair rather than an absent normalization attempt',unreliable.outcomes[0].status==='review'&&unreliable.outcomes[0].code==='unreliable-mapping'&&unreliable.outcomes[0].before===unreliable.outcomes[0].after);
  const unavailable=H.ankiNormalizeConditionTags([originals[0]],null);
  t('unavailable source snapshot is an explicit per-note outcome',unavailable.outcomes[0].code==='source-unavailable'&&unavailable.outcomes[0].canonicalTag==='');
  const topic=H.ankiNormalizeConditionTags([card('topic','Topic::Circulation Bio::Circulation Tier::1')],snapshot);
  t('preserved topic notes remain represented in normalization diagnostics',topic.outcomes[0].code==='topic-tag'&&topic.outcomes[0].before===topic.outcomes[0].after&&topic.changes.length===0);
  t('an explicitly processed empty batch records an empty outcomes array',Array.isArray(H.ankiNormalizeConditionTags([],snapshot).outcomes)&&H.ankiNormalizeConditionTags([],snapshot).outcomes.length===0);
  const noLocation=H.ankiNormalizeConditionTags([card('legacy','Condition::HeartFailure Tier::1',{chunk:undefined,sourceLine:undefined})],snapshot);
  t('legacy missing locations are explicit nulls rather than invented line numbers',noLocation.outcomes[0].chunk===null&&noLocation.outcomes[0].sourceLine===null);

  const clean=H.ankiNormalizeConditionTags(originals,snapshot),batch={snapshot,conditionTagOutcomes:clean.outcomes,conditionTagChanges:clean.changes,apiKey:'BATCH_CREDENTIAL_SENTINEL'};
  const diagnostic=H.ankiConditionTagDiagnostics(clean.cards,batch);
  t('generation evidence identifies the original post-dedupe capture stage',diagnostic.generation.status==='captured'&&diagnostic.generation.stage.includes('before user edits')&&diagnostic.generation.outcomes[0].status==='repaired');
  t('audit-snapshot diagnostics independently show the already-repaired card is canonical',diagnostic.auditSnapshot.outcomes[0].status==='canonical'&&diagnostic.auditSnapshot.outcomes[0].before===clean.cards[0].tags);
  const available=H.ankiConditionTagDiagnostics([originals[0]],batch).auditSnapshot.outcomes[0];
  t('read-only audit checks describe available aliases without claiming to have repaired them',available.status==='alias-available'&&available.before===available.after&&available.canonicalTag==='Condition::HeartFailure'&&originals[0].tags==='Condition::HF Tier::1');
  const edited=H.ankiConditionTagDiagnostics([card('alias','Condition::Unlisted Tier::1',{factIds:['fact-3']})],batch);
  t('later tag and mapping edits cannot rewrite captured generation outcomes',edited.generation.outcomes[0].factIds[0]==='fact-1'&&edited.generation.outcomes[0].after==='Condition::HeartFailure Tier::1'&&edited.auditSnapshot.outcomes[0].factIds[0]==='fact-3'&&edited.auditSnapshot.outcomes[0].canonicalTag==='Condition::RenalFailure');
  diagnostic.generation.outcomes[0].factIds.push('fact-extra');
  t('exported generation diagnostics do not alias their saved batch history',batch.conditionTagOutcomes[0].factIds.length===1);
  const legacy=H.ankiConditionTagDiagnostics(clean.cards,{snapshot,conditionTagChanges:[]});
  t('legacy empty edit lists never imply normalization ran or did not run',legacy.generation.status==='unavailable'&&legacy.generation.outcomes.length===0&&legacy.auditSnapshot.outcomes.length===3);
  t('captured zero-note history is distinguished from missing legacy history',H.ankiConditionTagDiagnostics([],{snapshot,conditionTagOutcomes:[]}).generation.status==='captured');
  const polluted=H.ankiConditionTagDiagnostics([],{snapshot,conditionTagOutcomes:[{...clean.outcomes[0],apiKey:'OUTCOME_CREDENTIAL_SENTINEL',unrelated:{apiKey:'NESTED_CREDENTIAL_SENTINEL'}}]});
  t('new evidence fields whitelist diagnostic properties without runtime credentials',!/CREDENTIAL_SENTINEL|apiKey|unrelated/.test(JSON.stringify(polluted))&&Object.keys(polluted.generation.outcomes[0]).sort().join(',')==='actualTags,after,before,canonicalTag,chunk,code,condition,factIds,message,noteId,sourceLine,status');

  const completedStart=S.indexOf('      const completed={sourceKB,snapshot,chunkIds,'),completedEnd=S.indexOf('\n      const summary=',completedStart);
  if(completedStart<0||completedEnd<=completedStart)throw Error('Anki completed-batch extraction anchors moved.');
  const complete=new Function('sourceKB','snapshot','chunkIds','runState','all','deduped','mappingIssues','model','toolLevel','normalized',S.slice(completedStart,completedEnd)+';return completed;')({},snapshot,[['fact-1']],{context:{},rawResponses:[],startedAt:'synthetic-start',promptHashes:{}},originals,clean.cards,[],'synthetic-model','medium',clean);
  t('live generation completion retains all normalization decisions alongside existing edits',complete.conditionTagOutcomes===clean.outcomes&&complete.conditionTagChanges===clean.changes&&complete.conditionTagOutcomes.length===complete.postDedupeNotes);
  const saveStart=S.indexOf('JSON.stringify({suiteVersion:suiteVersion(),model:batch.model'),saveEnd=S.indexOf(',null,2)',saveStart);
  if(saveStart<0||saveEnd<=saveStart)throw Error('Anki batch diagnostic download extraction anchors moved.');
  const saved=JSON.parse(new Function('batch','diagnostics','suiteVersion','return '+S.slice(saveStart,saveEnd+8))(complete,{},()=> 'synthetic-version'));
  t('live Save diagnostics payload includes all captured normalization outcomes',saved.conditionTagOutcomes.length===3&&saved.conditionTagOutcomes[1].status==='canonical'&&saved.conditionTagOutcomes[2].code==='non-alias-condition');
  const oldSaved=JSON.parse(new Function('batch','diagnostics','suiteVersion','return '+S.slice(saveStart,saveEnd+8))({model:'legacy'}, {},()=> 'synthetic-version'));
  t('legacy batch downloads use null for uncaptured normalization outcomes',oldSaved.conditionTagOutcomes===null);

  const cleanCanonical=[originals[1]],generation=H.ankiNormalizeConditionTags(cleanCanonical,snapshot);
  const auditBatch={snapshot,conditionTagOutcomes:generation.outcomes};
  const run={cards:cleanCanonical,batch:auditBatch,groups:[],results:[],responses:[],status:'complete',tier:'all'};
  const report=await H.ankiSourceAuditEvidence(run,{current:true,cards:cleanCanonical,batch:auditBatch,tier:'all'},'synthetic-export');
  t('live source-audit download has affirmative canonical history even when noteEdits is empty',report.noteEdits.length===0&&report.conditionTagDiagnostics.generation.status==='captured'&&report.conditionTagDiagnostics.generation.outcomes[0].status==='canonical');
  t('audit download labels captured-note checks separately from generation outcomes',report.conditionTagDiagnostics.auditSnapshot.stage.includes('no tag edits applied')&&report.conditionTagDiagnostics.auditSnapshot.outcomes.length===1);
  const oldReport=await H.ankiSourceAuditEvidence({...run,batch:{snapshot}},{current:false,cards:cleanCanonical,batch:auditBatch,tier:'all'},'synthetic-export');
  t('outdated legacy audit evidence remains explicit about unavailable generation history',oldReport.status==='outdated'&&oldReport.conditionTagDiagnostics.generation.status==='unavailable'&&oldReport.conditionTagDiagnostics.auditSnapshot.outcomes[0].status==='canonical');
  const badCards=[card('unresolved','Condition::HF Tier::1',{unresolvedFactIds:['fact-999']})];
  const badRun={...run,cards:badCards};
  const badReport=await H.ankiSourceAuditEvidence(badRun,{current:true,cards:badCards,batch:auditBatch,tier:'all'},'synthetic-export');
  t('audit diagnostics inspect original unresolved mapping metadata rather than sanitized defaults',badReport.conditionTagDiagnostics.auditSnapshot.outcomes[0].code==='unreliable-mapping');
  t('normalization evidence extraction reaches the live source-audit filename tail',report.filename==='anki-source-report-complete.json'&&Object.hasOwn(report,'conditionTagDiagnostics'));
}

module.exports={runAnkiNormalizationDiagnosticsTests};
