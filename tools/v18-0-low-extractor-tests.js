'use strict';

// v18.0: step 10 of the v17.14 production review, Low findings (extractor group). Synthetic data only.
// The NCLEX Extractor's pure helpers, both run loops (runInline, runSplit) and the window-merge block are extracted
// from the shipped HTML and run on synthetic text with stubbed model replies; the unmount cleanups are source contracts.

function span(S,start,end){
  const a=S.indexOf(start);if(a<0||S.indexOf(start,a+start.length)>=0)throw Error('Low-extractor anchor missing or ambiguous: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('Low-extractor end anchor missing after: '+start);
  return S.slice(a,b);
}
// Evaluates an extracted closure with its free names injected by name.
function inject(src,name,deps){const names=Object.keys(deps);return new Function(...names,src+';return '+name+';')(...names.map(k=>deps[k]));}
const ABC=(stem,n)=>stem+'\nA. Choice '+n+'a\nB. Choice '+n+'b\nC. Choice '+n+'c';

module.exports=async function run(S,t){
  const N=new Function(span(S,'const NCLEX_OPTION_GAP=','// Page range picker sub-component')+
    ';return {nclexSplitStemOptions,nclexRepairOptions,nclexMergePairs,nclexPairQA,nclexBatchPairs,nclexPairsToText};')();

  /* ── L18: the pairing-window merge never trades a matched row for an unmatched one ── */
  const windowBlock=span(S,'          for(const r of part){','\n          if(w<W-1)');
  const merge=part=>{const byNum=new Map();new Function('byNum','part',windowBlock)(byNum,part);return byNum;};
  const seam=merge([{number:3,question:'Which action is first?',answer:'B. Because airway comes first.'},{number:3,question:'Which action is first? A. one B. two (a longer seam copy with no answer)',answer:''}]).get(3);
  const fuller=merge([{number:4,question:'Short stem',answer:''},{number:4,question:'Short stem, longer copy',answer:''}]).get(4);
  const answered=merge([{number:5,question:'A longer copy without an answer',answer:''},{number:5,question:'Shorter',answer:'A'}]).get(5);
  const bothMatched=merge([{number:6,question:'Short',answer:'A'},{number:6,question:'Short and longer',answer:'B'}]).get(6);
  t('L18: a longer unanswered seam copy no longer replaces the matched copy; length still decides between equally matched copies',
    seam.matched===true&&seam.answer==='B. Because airway comes first.'&&fuller.question==='Short stem, longer copy'&&answered.matched===true&&answered.answer==='A'&&bothMatched.answer==='B');

  /* ── L19: the collision count ignores the printed question number ── */
  const qText=[ABC('1. A client with heart failure asks about sodium intake.',1),ABC('2. A client with asthma uses an inhaler.',2),ABC('3. A client with diabetes reports shakiness.',3)].join('\n\n');
  const regexPairs=N.nclexPairQA(qText,'1. Answer: A\n');
  const model=[{number:1,question:ABC('A client with heart failure asks about sodium intake.',1),answer:'A'},{number:2,question:ABC('2. A client with asthma uses an inhaler.',2),answer:'B'},{number:3,question:'A client recovering from hip surgery reports pain.',answer:'C'}];
  const merged=N.nclexMergePairs(regexPairs,model);
  const heading=N.nclexMergePairs([{number:5,question:'Question 5: A client with a new colostomy asks about diet.',answer:'',matched:false}],[{number:5,question:'A client with a new colostomy asks about diet.',answer:'D'}]);
  t('L19: a page text that keeps its printed number is not a collision; a different question under the same number still is',
    regexPairs[0].question.startsWith('1. ')&&merged.collisions===1&&merged.filled===2&&heading.collisions===0&&heading.filled===1);

  /* ── L20: a stray higher-ranked mark inside an inline choice no longer hides the choice list ── */
  const P=N.nclexSplitStemOptions;
  const inlineLetters=P('A client has a temperature of 101.3 F. Which action is first? A. Give acetaminophen B. Recheck the temperature in 101.3 F. units C. Notify the provider D. Apply ice');
  const inlineDigits=P('Which finding is reported first? 1. Temperature 101.3 F. at rest 2. Pulse 88 3. Respirations 18 4. BP 118/70');
  const endsOnUnit=P('Which action is first? A. Recheck: temperature is 101.3 F. B. Notify the provider C. Apply ice D. Give fluids');
  const lowerStillEnds=P('Pick: A. one B. two A. three C. four D. five').options.length===0;
  t('L20: an inline "101.3 F." inside an inline choice keeps the whole A-D (or 1-4) list, and a lower-ranked mark still ends a run',
    inlineLetters.options.map(o=>o.label).join('')==='ABCD'&&inlineLetters.options[1].text==='Recheck the temperature in 101.3 F. units'&&
    inlineLetters.stem==='A client has a temperature of 101.3 F. Which action is first?'&&
    inlineDigits.options.length===4&&inlineDigits.options[0].text==='Temperature 101.3 F. at rest'&&lowerStillEnds);
  t('L20: a choice that ends on "101.3 F." no longer hides the label right after it',
    endsOnUnit.options.map(o=>o.label).join('')==='ABCD'&&endsOnUnit.options[0].text==='Recheck: temperature is 101.3 F.'&&endsOnUnit.options[1].text==='Notify the provider');

  /* ── L21: choice repair checks the stem, not only the model's question number ── */
  const src7='7. Which lab is monitored with furosemide?\nA. Sodium\nB. Potassium\nC. Calcium\nD. Magnesium';
  const wrong={question_number:7,question:'Which position is best after a lumbar puncture?'};
  const plain=N.nclexRepairOptions({question_number:7,question:'Which lab is monitored with furosemide?'},src7);
  const numbered=N.nclexRepairOptions({question_number:7,question:'7. Which lab is monitored with furosemide?'},src7);
  const headed=N.nclexRepairOptions({question_number:7,question:'Which lab is monitored with furosemide?'},src7.replace('7. ','Question 7: '));
  t('L21: a misnumbered record gets no choices from another question, while a matching stem (numbered or not) is still repaired',
    N.nclexRepairOptions(wrong,src7)===wrong&&plain.options_repaired===true&&numbered.options_repaired===true&&headed.options_repaired===true&&/Magnesium/.test(plain.question));

  /* ── L23 (and L21 end to end): the two run loops, extracted and run against stubbed replies ── */
  const runSplitSrc=span(S,'  async function runSplit(file,existingQ,signal,track){','\n  const run=useCallback(async()=>{');
  const splitRun=async replies=>{
    const logs=[],kept=[];let call=0;
    const runSplit=inject(runSplitSrc,'runSplit',{
      addLog:m=>logs.push(m),qRanges:[{start:1,end:1}],aRanges:[{start:2,end:2}],
      nclexExtractPageRange:async(_f,start)=>start===1?qText:'1. Answer: A\n2. Answer: B\n3. Answer: C\n',
      nclexPairQA:N.nclexPairQA,nclexMergePairs:N.nclexMergePairs,nclexBatchPairs:N.nclexBatchPairs,nclexPairsToText:N.nclexPairsToText,nclexRepairOptions:N.nclexRepairOptions,
      nclexCallGemini:async()=>replies[call++],NCLEX_AI_PAIR_PROMPT:'',NCLEX_SPLIT_PROMPT:'',batchSize:8,model:'synthetic-model',
      _sleep:async()=>{},geminiHaltsBatch:()=>false,setProgress:()=>{},nclexKey:q=>String(q.question),
      admit:(_seen,allQ,records)=>{allQ.push(...records);kept.push(...records);},uid:()=>'synthetic-id'});
    const track={attempted:0,succeeded:0,failed:[],notes:[],review:0};
    await runSplit({name:'synthetic.pdf'},[],new AbortController().signal,track);
    return {track,kept,logs};
  };
  let split=await splitRun([{questions:[]}]);
  t('L23: split mode counts a non-array JSON reply as a failed batch, not a success',
    split.track.attempted===1&&split.track.succeeded===0&&split.track.failed.join()==='Batch 1');
  split=await splitRun([[{question_number:'Q1',question:'A client with heart failure asks about sodium intake.'},{question_number:3,question:'A client with asthma uses an inhaler.'}]]);
  t('L21: in a split run the misnumbered bare stem stays bare while the matching one gets its own choices back',
    split.track.succeeded===1&&split.kept.length===2&&split.kept[0].options_repaired===true&&/Choice 1c/.test(split.kept[0].question)&&
    !split.kept[1].options_repaired&&split.kept[1].question==='A client with asthma uses an inhaler.');

  const runInline=inject(span(S,'  async function runInline(file,existingQ,signal,track){','\n  // ── Split Q&A mode runner ──'),'runInline',{
    addLog:()=>{},iRangeOn:false,iRanges:[],nclexExtractPageRange:async()=>'',extractPdfTextSpaced:async()=>'synthetic text',
    nclexChunkText:()=>['chunk one','chunk two','chunk three'],chunkSize:3000,overlap:800,setProgress:()=>{},nclexKey:q=>String(q.question),
    nclexCallGemini:(()=>{const replies=[{questions:[{question:'Hidden?'}]},'not a list',[]];let call=0;return async()=>replies[call++];})(),
    NCLEX_INLINE_PROMPT:'',geminiHaltsBatch:()=>false,admit:(_seen,allQ,records)=>{allQ.push(...records);},uid:()=>'synthetic-id',_sleep:async()=>{}});
  const inlineTrack={attempted:0,succeeded:0,failed:[]};
  await runInline({name:'synthetic.pdf'},[],new AbortController().signal,inlineTrack);
  t('L23: inline mode counts object and string JSON replies as failed chunks, and an empty array as a success',
    inlineTrack.attempted===3&&inlineTrack.succeeded===1&&inlineTrack.failed.join()==='Chunk 1,Chunk 2');

  /* ── L22: both tools abort their run on unmount; the extractor's file × waits for the run ── */
  const extractor=span(S,'function NCLEXExtractor(){','// ──── TOOL: NCLEX to Anki ────');
  const toAnki=span(S,'function NCLEXToAnki(){','// ──── TOOL: NCLEX Question Generator ────');
  const cleanup='useEffect(()=>()=>{abortRef.current?.abort();abortRef.current=null;},[]);';
  t('L22: NCLEX Extractor and NCLEX to Anki abort the active run on unmount, and the extractor disables a file\u2019s \u00d7 mid-run',
    extractor.split(cleanup).length===2&&extractor.indexOf(cleanup)>extractor.indexOf('const abortRef=useRef(null);')&&
    toAnki.split(cleanup).length===2&&toAnki.indexOf(cleanup)>toAnki.indexOf('const abortRef=useRef(null),')&&
    extractor.includes("aria-label={'Remove PDF '+f.name} disabled={isProcessing} onClick=")&&toAnki.includes("aria-label={'Remove '+f.name} disabled={busy}"));

  /* ── L24: hard line breaks between printed choices ── */
  const toMd=filtered=>new Function('filtered','nclexSplitStemOptions','runSummary','nclexSummaryLine',span(S,'  const nclexToMd=()=>{','  const exportMd=')+';return nclexToMd();')(filtered,P,null,()=>'');
  const md=toMd([{question:'Which action is first?\nA. Give oxygen\nB. Call the provider\nC. Recheck vitals\nD. Document',correct_answer:'A. Give oxygen',rationale:'Airway comes first.'}]);
  const M=new Function(span(S,'// ──── TOOL: NCLEX to Anki ────','async function i2aFileKey(')+';return {x2aConvertSources};')();
  const cards=text=>M.x2aConvertSources([{name:'synthetic',text}]).cards.map(c=>[c.guid,c.front,c.back].join('|')).join('\n');
  const withBreaks=cards(md),withoutBreaks=cards(md.replace(/ {2}\n/g,'\n'));
  t('L24: extractor Markdown ends each lettered choice but the last with a hard break, and NCLEX to Anki reads identical cards from it',
    md.includes('\n\nA. Give oxygen  \nB. Call the provider  \nC. Recheck vitals  \nD. Document\n\n')&&withBreaks.length>0&&withBreaks===withoutBreaks&&withBreaks.split('\n').length===1);
  const caseMd=new Function(span(S,'function caseToMarkdown(','\n  return L.join(\'\\n\');\n}')+'\n  return L.join(\'\\n\');\n}'+
    span(S,'function itemAuditPayload(','function caseAuditPayload(')+span(S,'function caseAuditPayload(','\n// Criteria are stated')+';return {caseToMarkdown,caseAuditPayload};')();
  const cs={title:'Synthetic case',stages:[{stageNumber:1,title:'Arrival',questions:[{type:'MCQ',stem:'Which action is first?',options:[{label:'A',text:'One'},{label:'B',text:'Two'},{label:'C',text:'Three'}],correctAnswers:['A'],rationales:[{option:'A',text:'Because.'}]}]}]};
  const printed=caseMd.caseToMarkdown(cs,{worksheetFactIds:false}),payload=caseMd.caseAuditPayload(cs,1,cs.stages[0].questions[0]);
  t('L24: a printed case breaks the stem and each choice onto its own line, while the auditor payload keeps plain line ends',
    printed.includes('**Q1.1 (MCQ)** Which action is first?  \n   A. One  \n   B. Two  \n   C. Three\n')&&
    payload.includes('**Q1.1 (MCQ)** Which action is first?\n   A. One\n   B. Two\n   C. Three')&&!/ \n/.test(payload));

  /* ── Dead code: the post-await truncation checks are gone; the transport invariant that made them dead holds ── */
  const callSrc=span(S,'  async function nclexCallGemini(prompt,signal){','\n  // v17.4: one admission path');
  const imageSrc=span(S,'  const runImages=async()=>{','\n  const saveTranscripts=');
  const a=S.indexOf('function geminiSSEParser('),b=S.indexOf('\nasync function callGemini(',a);
  if(a<0||b<0)throw Error('Low-extractor transport anchor missing');
  const LEVELS=new Function(span(S,'const THINKING_LEVELS=','const MODEL_ID_RE=')+';return THINKING_LEVELS;')();
  const request=async finishReason=>{
    const metas=[];
    const geminiRequest=new Function('fetch','_sleep','geminiRetryDelayMs','SAFETY_SETTINGS','THINKING_LEVELS',S.slice(a,b)+';return geminiRequest;')(
      async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'[{"question":"Synthetic'}]},finishReason}]})}),async()=>{},()=>0,[],LEVELS);
    try{return {text:await geminiRequest('synthetic-key','synthetic-model',{contents:[],generationConfig:{responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'low'}}},{retries:2,onMeta:m=>metas.push(m)}),metas};}
    catch(e){return {error:e,metas};}
  };
  const cutOff=await request('MAX_TOKENS'),stopped=await request('STOP');
  t('dead code: nclexCallGemini and runImages drop truncation checks that a returned JSON reply can never trigger',
    !callSrc.includes('let cut=')&&!callSrc.includes('onMeta:')&&!callSrc.includes('cut?')&&!imageSrc.includes('if(last&&last.truncated)')&&!imageSrc.includes('onMeta:')&&
    cutOff.error&&cutOff.error.truncated===true&&cutOff.metas.every(m=>m.complete!==true)&&
    typeof stopped.text==='string'&&stopped.metas.length===1&&stopped.metas[0].truncated===false);
};
