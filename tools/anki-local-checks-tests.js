'use strict';

// The root harness passes the shipped HTML; no duplicated implementation or API calls.
function runAnkiLocalChecksTests({S,t,section}){
  if(section)section('Anki local review checks');
  const start='function ankiParseCards(raw',end='function AnkiStyleBadges';
  const a=S.indexOf(start),b=S.indexOf(end,a+start.length);
  if(a<0||b<0||S.indexOf(start,a+start.length)>=0||S.indexOf(end,b+end.length)>=0)throw Error('Anki local-check extraction anchors missing or ambiguous');
  const source=S.slice(a,b);
  const H=new Function('uid',source+';return {ankiAnswerExposure,ankiSourceConflicts,ankiReviewCandidates,ankiStyleWarnings,ankiReviewFilter,ankiSourceSnapshot,ankiBatchSummary,ankiSelection,ankiExportText,ankiDedupeCards,ankiCollisionGroups};')(()=> 'synthetic-note');
  const card=(id,text,extra='',factIds=['fact-1'],tags='Tier::1')=>({id,text,extra,tags,factIds,keep:true,pipeCount:2,mappingIssues:[]});
  const deepFreeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);Object.values(x).forEach(deepFreeze);}return x;};

  const repeated=card('repeat','[Example] Timing: repeat after {{c1::6 months}}; monitor for 6 months.');
  const exposure=H.ankiAnswerExposure(repeated);
  t('Anki exposure identifies the actual masked front and index',exposure.length===1&&exposure[0].index===1&&exposure[0].answer==='6 months'&&exposure[0].front.includes('[...]')&&!exposure[0].front.includes('{{'));
  const sibling=card('sibling','[Example] Schedule: {{c1::half}} now, {{c2::half}} later.');
  t('Anki exposure includes visible sibling clozes',H.ankiAnswerExposure(sibling).length===2);
  t('Anki exposure ignores same-index answers hidden together',H.ankiAnswerExposure(card('together','[Example] Schedule: {{c1::half}} now, {{c1::half}} later.')).length===0);
  t('Anki exposure excludes Extra',H.ankiAnswerExposure(card('extra','[Example] Action: {{c1::observe}}.','Observe or observe.')).length===0);
  t('Anki exposure includes an answer-bearing hint',H.ankiAnswerExposure(card('hint','[Example] Action: {{c1::observe::observe}}.')).length===1);
  t('Anki exposure preserves case rather than conflating distinct tokens',H.ankiAnswerExposure(card('case','[Example] Code: {{c1::AB}}; reference ab.')).length===0);
  t('Anki exposure accepts insignificant whitespace changes',H.ankiAnswerExposure(card('spaces','[Example] Timing: {{c1::6 months}}; repeat at 6   months.')).length===1);
  t('Anki exposure rejects word substrings',H.ankiAnswerExposure(card('word','[Example] Code: {{c1::art}}; heart.')).length===0);
  t('Anki exposure rejects numeric and unit substrings',H.ankiAnswerExposure(card('unit','[Example] Dose: {{c1::5 mg}}; compare 15 mg and 5 mg/kg.')).length===0);
  t('Anki exposure does not remove numeric signs or decimals',H.ankiAnswerExposure(card('signed','[Example] Dose: {{c1::5 mg}}; compare -5 mg and 1.5 mg.')).length===0);
  t('Anki exposure does not conflate comparator direction',H.ankiAnswerExposure(card('operator','[Example] Threshold: {{c1::<40 mg/dL}}; comparison >40 mg/dL.')).length===0);
  t('Anki exposure detects a complete value-unit occurrence with punctuation',H.ankiAnswerExposure(card('punctuation','[Example] Dose: {{c1::5 mg}}; reference (5 mg).')).length===1);
  t('Anki exposure deduplicates identical findings within a review',H.ankiAnswerExposure(card('same','[Example] Timing: {{c1::half}} then {{c1::half}}; half.')).length===1);
  t('Anki exposure never repairs malformed clozes',H.ankiAnswerExposure(card('broken','[Example] Dose: {{c1::5 mg}; 5 mg.')).length===0);

  const kb={conditions:[{name:'Synthetic condition',facts:[
    {id:'fact-1',text:'Temperature is 96.8° F (37° C) to 99° F (37.2° C).',sourceQuote:'98.6° F (37° C)',tier:1,latteBucket:'Tests',sources:[]},
    {id:'fact-2',text:'Temperature is 98.6°F (37°C); 38 C (100 F) is a rounded pair.',sourceQuote:'96.8°F (37°C)',tier:2,latteBucket:'Tests',sources:[]},
    {id:'fact-3',text:'Compare -40°C (-40°F) and 0°C (32°F).',sourceQuote:'',tier:2,latteBucket:'Tests',sources:[]}
  ]}]};
  const snapshot=deepFreeze(H.ankiSourceSnapshot(kb)),snapshotBefore=JSON.stringify(snapshot),conflicts=H.ankiSourceConflicts(snapshot);
  t('Anki source conflict identifies the inconsistent source fact',conflicts.length===1&&conflicts[0].factId==='fact-1'&&conflicts[0].msg.includes('96.8° F (37° C)'));
  t('Anki source conflict explains its limited arithmetic scope',conflicts[0].msg.includes('rounding')&&conflicts[0].msg.includes('Review the supplied source'));
  const conflictFor=text=>H.ankiSourceConflicts({facts:[{id:'fact-4',text,sourceQuote:''}]});
  t('Anki source conflict accepts valid reversed C(F) notation',conflictFor('37 C (98.6 F)').length===0);
  t('Anki source conflict catches inconsistent reversed C(F) notation',conflictFor('37 C (96.8 F)').length===1);
  t('Anki source conflict allows displayed rounding rather than exact decimal equality',conflictFor('100°F (38°C)').length===0);
  t('Anki source conflict respects more precise displayed values',conflictFor('100.0°F (38.0°C)').length===1);
  t('Anki source conflict supports negative temperatures and Unicode minus',conflictFor('−40°C (−40°F)').length===0);
  t('Anki source conflict ignores same-unit pairs and non-temperature equivalents',conflictFor('37°C (38°C); 5 mg (10 mg); 1 mg (1000 mcg).').length===0);
  t('Anki source conflict does not infer cross-sentence or range equivalence',conflictFor('96.8°F; another reading 37°C. Range: 95–99°F (35–37°C).').length===0);
  t('Anki source conflict does not treat a range suffix as a paired temperature',conflictFor('95–96.8°F (37°C); 95-96.8°F (37°C).').length===0);
  t('Anki source conflict never uses quote-only content',H.ankiSourceConflicts({facts:[{id:'fact-4',text:'Monitor temperature.',sourceQuote:'96.8°F (37°C)'}]}).length===0);
  t('Anki source conflict handles missing sources',H.ankiSourceConflicts(null).length===0);
  t('Anki source conflict emits one fact finding for multiple mismatched pairs',conflictFor('96.8°F (37°C), 90°F (37°C).').length===1);

  const one=card('one','[Example] Diagnostic threshold: blood glucose is below {{c1::40 mg/dL}} during the first 72 hours of life.');
  const two=card('two','[Example] Diagnostic cutoff: blood glucose is below {{c1::40 mg/dL}} during the first 72 hours of life.');
  const candidates=H.ankiReviewCandidates([one,two]);
  t('Anki review candidates catch reworded identical targets with shared source association',candidates.length===1&&candidates[0].members.length===2&&candidates[0].factIds[0]==='fact-1');
  t('Anki review candidates provide note index answers and actual front',candidates[0]?.members.every(m=>m.index===1&&m.answers[0]==='40 mg/dL'&&m.front.includes('[...]')));
  t('Anki review candidates require overlapping source associations',H.ankiReviewCandidates([one,{...two,factIds:['fact-2']}]).length===0);
  t('Anki review candidates reject unrelated contexts despite a shared fact',H.ankiReviewCandidates([one,card('other','[Example] Bottle contents: the labeled solution concentration stored inside the refrigerator is {{c1::40 mg/dL}}.')]).length===0);
  t('Anki review candidates preserve hidden answer units',H.ankiReviewCandidates([one,{...two,text:two.text.replace('40 mg/dL','40 mmol/L')}]).length===0);
  t('Anki review candidates preserve visible numeric context',H.ankiReviewCandidates([one,{...two,text:two.text.replace('72','24')}]).length===0);
  t('Anki review candidates preserve comparator wording',H.ankiReviewCandidates([one,{...two,text:two.text.replace('below','above')}]).length===0);
  t('Anki review candidates preserve visible numeric signs',H.ankiReviewCandidates([{...one,text:one.text.replace('72','-72')},two]).length===0);
  t('Anki review candidates preserve modality qualifiers',H.ankiReviewCandidates([{...one,text:one.text.replace('is below','may be below')},{...two,text:two.text.replace('is below','must be below')}]).length===0);
  t('Anki review candidates preserve visible timing units',H.ankiReviewCandidates([one,{...two,text:two.text.replace('hours','days')}]).length===0);
  t('Anki review candidates leave exact-front duplicates to existing diagnostics',H.ankiReviewCandidates([one,{...one,id:'duplicate'}]).length===0&&H.ankiCollisionGroups([one,{...one,id:'duplicate'}]).length===1);
  t('Anki review candidates skip structurally invalid notes',H.ankiReviewCandidates([one,{...two,extra:'bad|separator'}]).length===0);
  t('Anki review candidates skip unreliable mapping edges',H.ankiReviewCandidates([one,{...two,mappingIssues:[{code:'out-of-chunk'}]}]).length===0);
  const both=[{...one,factIds:['fact-1','fact-2']},{...two,factIds:['fact-2','fact-1']}];
  t('Anki review candidates merge repeated groups found through shared facts',H.ankiReviewCandidates(both).length===1&&H.ankiReviewCandidates(both)[0].factIds.length===2);
  t('Anki review candidates do not erase manual exclusions',H.ankiReviewCandidates([one,{...two,keep:false}]).length===1);

  const clean=card('clean','[Example] Action: {{c1::observe}}.','', ['fact-2'],'Tier::2');
  const rows=deepFreeze([repeated,one,two,clean]),before=JSON.stringify(rows);
  const batch={snapshot,sourceKB:kb},beforeExport=H.ankiExportText(rows,batch,true,'all',false,false);
  const warning=H.ankiStyleWarnings(repeated).find(x=>x.code==='answer-visible');
  t('Anki style warnings surface exposed answers with affected indices',warning&&warning.indices.length===1&&warning.indices[0]===1&&warning.msg.includes('6 months'));
  t('Anki review filter preserves false and all behavior',H.ankiReviewFilter(rows,'all',false).length===4&&H.ankiReviewFilter(rows,'all','all').length===4);
  t('Anki review filter preserves true and style behavior',H.ankiReviewFilter(rows,'all',true).length===H.ankiReviewFilter(rows,'all','style').length&&H.ankiReviewFilter(rows,'all',true).some(x=>x.id==='repeat'));
  t('Anki warning-code filter selects the exposed-answer note only',H.ankiReviewFilter(rows,'all','answer-visible').map(c=>c.id).join(',')==='repeat');
  t('Anki warning-code filters retain the selected tier boundary',H.ankiReviewFilter(rows,'2','answer-visible').length===0&&H.ankiReviewFilter(rows,'2',false).length===1);
  t('Anki unknown warning-code filter yields no matching notes',H.ankiReviewFilter(rows,'all','unknown-warning').length===0);
  H.ankiAnswerExposure(repeated);H.ankiReviewCandidates(rows);H.ankiSourceConflicts(snapshot);H.ankiStyleWarnings(repeated);
  t('Anki local checks do not mutate notes or source snapshots',JSON.stringify(rows)===before&&JSON.stringify(snapshot)===snapshotBefore);
  t('Anki warnings and filters leave export bytes unchanged',H.ankiExportText(rows,batch,true,'all',false,false)===beforeExport);
  t('Anki exposed-answer warnings never change structural eligibility or selection',H.ankiSelection(rows).kept.length===4&&H.ankiSelection(rows).reviews===4);
  t('Anki source conflicts never reduce linked-fact coverage',H.ankiBatchSummary(rows,batch,true).coveredCount===2);
  t('Anki local checks preserve stale export suppression',H.ankiExportText(rows,batch,false,'all',false,false)==='');
  t('Anki possible repeated targets do not change exact note dedupe',H.ankiDedupeCards([one,two]).length===2);
  t('Anki local-check extraction reaches the live warning-filter tail',H.ankiReviewFilter([repeated],'1','answer-visible')[0]===repeated&&source.includes('function ankiSourcePointers(card,batch,current)'));
}

module.exports={runAnkiLocalChecksTests};
