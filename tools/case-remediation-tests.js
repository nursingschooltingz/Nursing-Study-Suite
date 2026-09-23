'use strict';
// Synthetic cases only. Extract the shipped implementation, including its validation tail.
function load(S,transform=code=>code) {
  const span=(a,b)=>{const x=S.indexOf(a),y=S.indexOf(b,x+a.length);if(x<0||y<0)throw Error('Missing case anchor '+a);return S.slice(x,y);};
  return new Function(transform(span('const CASE_CLINICAL_TOKEN_RE=','function CaseStudyGenerator()')+
    ';return {caseNumericTokens,caseAuditTextValues,validateCaseStudy,validateStageTiming,caseToMarkdown,caseAuditPayload,caseValidationStamp,caseShapeIssues,caseCompletenessIssues,caseAllFactIds,caseGateItems,itemRunPool,itemParseAuditVerdict,itemAuditSummary,itemAuditIsAnswerAccuracy,itemBuildAuditPrompt,AUDIT_POOL_WIDTH,AUDIT_RETRIES,'+
    'repairContract:typeof caseRepairContract==="function"?caseRepairContract:null,shuffle:typeof caseShuffleQuestion==="function"?caseShuffleQuestion:null,rows:typeof caseReviewRows==="function"?caseReviewRows:null,appendix:typeof caseReviewAppendix==="function"?caseReviewAppendix:null,shuffleIssues:typeof caseShuffleIssues==="function"?caseShuffleIssues:null,progress:typeof caseAuditProgress==="function"?caseAuditProgress:null};'))();
}
const clone=x=>JSON.parse(JSON.stringify(x));
const question=()=>({id:'q1',type:'MCQ',stem:'Which action is appropriate?',options:['Assess','Report','Document','Observe'].map((text,i)=>({label:'ABCD'[i],text})),correctAnswers:['A'],rationales:['A','B','C','D'].map(option=>({option,text:'The synthetic marker supports this reasoning.',supportType:'direct',factIds:['f1']})),cjmmSkill:'Recognize Cues'});
const fixture=(q=question())=>({title:'Synthetic case',condition:'Synthetic',difficulty:'foundational',patient:{age:30,background:'Arrives for review.'},stages:[{stageNumber:1,title:'Stage 1 at 08:00',narrative:'The client arrives.',data:[],questions:[q]}],debrief:{notes:'Synthetic shortfall.'}});
const index=text=>new Map([['f1',{fact:{text,sourceQuote:''}}]]);
async function run(S,t){
  const C=load(S),errors=cs=>C.validateCaseStudy(cs,index('Monitor the synthetic marker.'),new Set(['f1']),'Synthetic').filter(i=>i.sev==='error');
  t('case remediation extraction reaches timing tail',C.validateStageTiming(fixture()).some(i=>i.msg.includes('never presented')));
  for(const [value,source,ok] of [['3.5 mEq/L','3.5–5 mEq/L',true],['5 mEq/L','3.5–5 mEq/L',true],['3.5–5 mEq/L','3.5–5 mEq/L',true],['2–5 mEq/L','3.5–5 mEq/L',false],['4 mEq/L','3.5–5 mEq/L',false],['5 mg','5 mg per protocol',true],['12 breaths/min','12 breaths per minute per shift',true],['5 mg','5 mg per banana',false],['5 mg/dose','5 mg per dose',true],['5 mcg/kg/min','5 mcg/kg/min',true],['5 mg','5 mg/(kg min)',false],['5 mg','5 mg²',false]]){
    const found=[];C.caseAuditTextValues(value,['f1'],index(source),'Synthetic',found,'direct');t('numeric pair '+value+' from '+source,found.every(i=>i.sev!=='error')===ok);
  }
  for(const sep of ['-','–',' to '])t('signed shared range '+sep,C.caseNumericTokens('-3.5'+sep+'-2.5 mEq/L').tokens.map(x=>x.key).join(',')==='-3.5meq/l,-2.5meq/l');
  for(const tail of ['/banana','/(kg min)','²','·kg',' × kg'])t('shared range rejects unsupported tail '+tail,C.caseNumericTokens('3–5 mg'+tail).tokens.length===0);
  t('shared compound range retains both complete values once',C.caseNumericTokens('0.1–0.5 mcg/kg/min').tokens.map(t=>t.key).join(',')==='0.1mcg/kg/min,0.5mcg/kg/min');
  t('later unknown unit cannot contaminate earlier shared range',C.caseNumericTokens('3–5 mg and 6 mg/banana').tokens.map(t=>t.key).join(',')==='3mg,5mg');
  let cs=fixture();cs.stages[0].questions[0].stem='What should be done for BP 82/50 mm Hg?';t('unsupported numeric stem rejected',errors(cs).some(x=>x.msg.includes('stem')));
  cs.stages[0].questions[0].rationales.forEach(r=>r.factIds=[]);t('numeric stem with no evidence still rejected',errors(cs).some(x=>x.msg.includes('stem')));
  cs=fixture();cs.stages[0].title='BP 82/50 mm Hg';t('numeric stage title rejected',errors(cs).some(x=>x.msg.includes('title')));
  t('numbered title age and time valid',errors(fixture()).length===0);
  cs=fixture();cs.stages[0].questions[0].options[1].text='Give 99 mg';t('incorrect option is not asserted patient data',errors(cs).length===0);
  const calc=(result='140 mg',expression='2 mg/kg × 70 kg = ')=>(Object.assign(fixture({id:'calc',type:'Calculation',stem:'Calculate the dose.',options:[],correctAnswers:[result],rationales:[{option:'Answer',text:expression+result,supportType:'direct',factIds:['f1']}]}),{}));
  const calcErrors=cs=>C.validateCaseStudy(cs,index('Dose is 2 mg/kg.'),new Set(['f1']),'Synthetic').filter(i=>i.sev==='error');
  const weighted=(result,expression)=>{const cs=calc(result,expression);cs.stages[0].data=[{label:'Weight',value:'70 kg',supportType:'neutral-framing',availability:'revealed',factIds:[]}];return cs;};
  const babelPath=process.env.NSS_BABEL_STANDALONE||require('path').join(require('os').tmpdir(),'nursing-study-suite-verify/node_modules/@babel/standalone/babel.js');
  const Babel=require(babelPath),browserCode=load(S,code=>Babel.transform(code,{presets:['env','react'],parserOpts:{allowReturnOutsideFunction:true}}).code);
  t('browser Babel transformed calculation executes exact BigInt arithmetic',!browserCode.validateCaseStudy(weighted(),index('Dose is 2 mg/kg.'),new Set(['f1']),'Synthetic').some(i=>i.sev==='error'));
  for(const expression of ['2 mg/kg × 70 kg = ','2 mg/kg multiplied by 70 kg gives '])t('verified dose calculation '+expression,calcErrors(weighted('140 mg',expression)).length===0);
  for(const result of ['150 mg','140 mL'])t('wrong calculation '+result+' rejected',calcErrors(weighted(result)).length>0);
  for(const answer of ['150','2 mg/kg','140 bananas']){const cs=weighted();cs.stages[0].questions[0].correctAnswers=[answer];t('answer must agree with derived result '+answer,calcErrors(cs).some(i=>i.msg.includes('answer')));}
  const bare=weighted();bare.stages[0].questions[0].correctAnswers=['140'];t('unitless numeric answer agrees with exact derivation',calcErrors(bare).length===0);
  const placeholder=weighted();placeholder.stages[0].questions[0].options=[{label:'Answer',text:'Enter dose'}];t('derived calculation placeholder option accepted',calcErrors(placeholder).length===0);
  t('changed calculation weight rejected',calcErrors(weighted('160 mg','2 mg/kg × 80 kg = ')).length>0);
  const neutral=weighted();neutral.stages[0].questions[0].rationales=[{option:'Answer',text:'999 mg',supportType:'neutral-framing',factIds:[]}];t('calculation cannot misuse neutral rationale to bypass grounding',calcErrors(neutral).some(i=>i.msg.includes('neutral-framing cannot exempt')));
  cs=weighted();cs.stages[0].data.push({label:'Other dose',value:'140 mg',supportType:'direct',availability:'revealed',factIds:['f1']});t('derived result cannot ground unrelated datum',calcErrors(cs).some(i=>i.msg.includes('Other dose')));
  t('assumed weight remains visible in markdown',C.caseToMarkdown(weighted()).includes('assumed for calculation'));
  const q=question();
  t('repair contract helper exists',!!C.repairContract);
  if(C.repairContract){
    for(const fixed of [clone(q),{...clone(q),repairNote:'Changed note'},Object.fromEntries(Object.entries(clone(q)).reverse())])t('no-op repair preserves FAIL',C.repairContract(q,fixed).includes('no substantive change'));
    for(const n of [1,3]){const fixed=clone(q);fixed.options.length=n;t('repair retains '+n+' option rejection',!!C.repairContract(q,fixed));}
    const renamed=clone(q);renamed.options[0].label='E';t('renamed repair label rejected',!!C.repairContract(q,renamed));
    const valid=clone(q);valid.stem='Which action is indicated now?';valid.rationales.reverse();t('text repair with reordered rationale array accepted',C.repairContract(q,valid)==='');
  }
  t('stable option transformation exists',!!C.shuffle);
  if(C.shuffle){
    for(const rand of [0,.25,.5,.99]){const x=C.shuffle(q,()=>rand);t('shuffle preserves correct content '+rand,x.options.find(o=>x.correctAnswers.includes(o.label)).text==='Assess');t('shuffle rationale mapping '+rand,x.options.every(o=>x.rationales.find(r=>r.option===o.label).text===q.rationales[q.options.findIndex(a=>a.text===o.text)].text));}
    t('all-A fixture no longer stays all A',C.shuffle(q,()=>0).correctAnswers[0]!=='A');
    for(const type of ['Ordering','Calculation'])t(type+' untouched',JSON.stringify(C.shuffle({...q,type},()=>0))===JSON.stringify({...q,type}));
    const sata={...clone(q),type:'SATA',correctAnswers:['A','C']};const shuffled=C.shuffle(sata,()=>0);t('SATA preserves correct content set',shuffled.options.filter(o=>shuffled.correctAnswers.includes(o.label)).map(o=>o.text).sort().join()===['Assess','Document'].sort().join());
    const ref=clone(q);ref.stem='Compare option A with option B.';t('explicit label reference remapped',C.shuffle(ref,()=>0).stem!==ref.stem);
    const unsafe=clone(q);unsafe.options[3].text='All of the above';const kept=C.shuffle(unsafe,()=>0);t('unsafe ordering retained with advisory',JSON.stringify(kept.options)===JSON.stringify(unsafe.options)&&!!kept.shuffleNotice);
    const broken=clone(q);broken.correctAnswers=['Z'];t('malformed item stays malformed',JSON.stringify(C.shuffle(broken,()=>0))===JSON.stringify(broken));
    const numbered=clone(q);numbered.options.forEach((o,i)=>o.label=String(i+1));numbered.rationales.forEach((r,i)=>r.option=String(i+1));numbered.correctAnswers=['1'];numbered.stem='Compare option 1 with option 2.';const numericLabels=C.shuffle(numbered,()=>0);t('nonstandard option references retain original labels with advisory',JSON.stringify(numericLabels.options)===JSON.stringify(numbered.options)&&numericLabels.stem===numbered.stem&&!!numericLabels.shuffleNotice);
  }
  t('case review appendix exists',!!C.appendix);
  if(C.appendix&&C.rows){
    for(const n of [14,23,19]){const issues=Array.from({length:n},(_,i)=>({sev:'warn',msg:'Synthetic warning '+i}));const md=C.appendix(fixture(),issues,[]);t(n+' warning-only messages retained',issues.every(i=>md.includes(i.msg)));}
    const pendingRows=C.rows(fixture(),{},'running');t('unreviewed MCQ pending',pendingRows[0].status==='PENDING');
    const md=C.appendix(fixture(),[],C.rows(fixture(),{'1:q1':{status:'FAIL',criterion:'Stem clarity',detail:'Synthetic detail',warns:[]}},'complete'));t('item findings map to worksheet numbers',md.includes('Q1.1')&&md.includes('Stem clarity')&&md.includes('Synthetic detail'));
    const a=S.indexOf('function artifactJsonExport('),b=S.indexOf('function FactTag(',a);const jsonExport=new Function(S.slice(a,b)+';return artifactJsonExport;')();
    const rows=C.rows(fixture(),{'1:q1':{status:'FAIL',criterion:'Stem clarity',detail:'Review this wording',warns:[{criterion:'Terminology',detail:'Use client'}],repairAttempt:'no substantive change'}},'complete');
    const json=JSON.parse(jsonExport(fixture(),'Captured notice',[{sev:'warn',msg:'Warning only'}],rows));
    t('JSON includes case item detail warnings and repair attempt',json._suiteReview.itemAudit[0].detail==='Review this wording'&&json._suiteReview.itemAudit[0].warns[0].detail==='Use client'&&json._suiteReview.itemAudit[0].repairAttempt==='no substantive change');
    t('JSON maps stable IDs to exported numbers compatibly',json._suiteReview.itemAudit[0].id==='1:q1'&&json._suiteReview.itemAudit[0].questionId==='q1'&&json._suiteReview.itemAudit[0].number==='Q1.1');
    const failed=[{sev:'error',msg:'Numeric error'},{sev:'warn',msg:'Timing warning'}],full=C.caseValidationStamp(failed)+C.caseToMarkdown(fixture())+C.appendix(fixture(),failed,rows);
    t('failed banner and complete warning details coexist after answer key',full.includes('FAILED VALIDATION')&&full.indexOf('Timing warning')>full.indexOf('## Answer Key'));
  }
  if(C.shuffle){
    const destinations=new Set();for(const value of [0,.3,.4,.99])destinations.add(C.shuffle(question(),()=>value).correctAnswers[0]);t('deterministic permutations reach every correct position',destinations.size===4);
    const ref=question();ref.rationales.forEach((r,i)=>{r.text='Option '+r.option+' explanation '+i;r.factIds=['f'+i];});const x=C.shuffle(ref,()=>0);t('rationale citations and explicit references follow content',x.options.every(o=>{const i=ref.options.findIndex(a=>a.text===o.text),r=x.rationales.find(r=>r.option===o.label);return r.text==='Option '+o.label+' explanation '+i&&r.factIds[0]==='f'+i;}));
    for(const text of ['A and B','Options A, B, and C','A is correct','Both (A) and (B)','The last option']){const item=question();item.stem=text;const result=C.shuffle(item,()=>0);t('ambiguous reference preserved '+text,!!result.shuffleNotice&&JSON.stringify(result.options)===JSON.stringify(item.options));}
    const initial=fixture(C.shuffle(question(),()=>0)),before=JSON.stringify(initial);C.caseToMarkdown(initial);C.caseToMarkdown(initial,{worksheetFactIds:false});C.caseAuditPayload(initial,1,initial.stages[0].questions[0]);t('export and audit builders never reshuffle',JSON.stringify(initial)===before);
  }
  let supported=fixture();supported.stages[0].questions[0].stem='BP is 82/50 mm Hg. Which action?';supported.stages[0].data=[{label:'BP',value:'82/50 mm Hg',supportType:'direct',availability:'revealed',factIds:['f2']}];const fi=index('Monitor the marker.');fi.set('f2',{fact:{text:'BP 82/50 mm Hg.'}});t('independently grounded stem passes',!C.validateCaseStudy(supported,fi,new Set(['f1','f2']),'Synthetic').some(i=>i.sev==='error'));
  supported.stages[0].data[0].supportType='instantiated';fi.get('f2').fact.text='SBP below 90 mm Hg';t('stem repeats instantiated value without new error',!C.validateCaseStudy(supported,fi,new Set(['f1','f2']),'Synthetic').some(i=>i.sev==='error'));
  const sourced=weighted();sourced.stages[0].data[0]={...sourced.stages[0].data[0],supportType:'direct',factIds:['f1']};t('sourced weight is not labeled assumed',!C.caseToMarkdown(sourced).includes('assumed for calculation'));
  for(const [text,source,ok] of [['0.1 mg/kg × 0.2 kg = 0.02 mg','0.1 mg/kg and 0.2 kg',true],['140 mg divided by 70 kg gives 2 mg/kg','140 mg and 70 kg',true],['140 mg divided by 0 kg gives 2 mg/kg','140 mg and 0 kg',false],['3 mg divided by 2 mL gives 1.5 mg/mL','3 mg and 2 mL',true],['2 mg/kg × 70 kg = 140 mg/kg','2 mg/kg and 70 kg',false],['2 mg/kg plus 70 kg = 140 mg','2 mg/kg and 70 kg',false],['Round upward: 2 mg/kg × 70 kg = 141 mg','2 mg/kg and 70 kg',false]]){
    const item={id:'q1',type:'Calculation',stem:'Calculate.',correctAnswers:[text.split(/ = | gives /).at(-1)],options:[],rationales:[{option:'Answer',text,factIds:['f1'],supportType:'direct'}]};const issues=C.validateCaseStudy(fixture(item),index(source),new Set(['f1']),'Synthetic');t('bounded arithmetic '+text,!issues.some(i=>i.sev==='error')===ok);
  }
  // The appendix is outside the student/answer-key cut used by the blind item auditor.
  const audited=C.caseAuditPayload(fixture(),1,question());t('auditor excludes rationale and appended review',!audited.includes('synthetic marker supports')&&!audited.includes('Review appendix')&&!audited.includes('[f1]'));
  if(C.progress){const cs=fixture();cs.stages[0].questions.push({...question(),id:'q2',type:'Ordering'});const rows=C.rows(cs,{},'running');t('pending plus N/A does not claim completed review',C.progress(cs,rows,'running','audit').includes('0 of 1')&&C.progress(cs,rows,'running','audit').includes('1 pending'));t('disabled run has no invented scores',C.rows(cs,{},'disabled').length===0);}
  await lifecycle(S,C,t);
}
async function lifecycle(S,C,t){
  const start=S.indexOf('  const run=useCallback(async()=>{',S.indexOf('function CaseStudyGenerator(){')),end=S.indexOf('\n\n  // v15.6: audit verdicts',start);if(start<0||end<0)throw Error('case handler anchors');
  const opStart=S.indexOf('function createOperationSlot(){'),opEnd=S.indexOf('function cardCurrentEntries(',opStart);const createOperationSlot=new Function(S.slice(opStart,opEnd)+';return createOperationSlot;')();
  const pump=async(predicate)=>{for(let i=0;i<200&&!predicate();i++)await Promise.resolve();if(!predicate())throw Error('Handler checkpoint not reached');};
  function setup({two=false,repair=x=>x,defer=false}={}){
    const cs=fixture();if(two)cs.stages[0].questions.push({...question(),id:'q2'});
    const state={calls:[],snapshots:[],logs:[],audit:null},kb={},pending=[];let active=kb;
    const set=key=>value=>{state[key]=typeof value==='function'?value(state[key]):value;if(key==='CaseStudy'&&value)state.snapshots.push(JSON.stringify(value));};
    const env={...C,caseRepairContract:C.repairContract,caseShuffleQuestion:q=>C.shuffle(q,()=>.99),caseShuffleIssues:C.shuffleIssues,useCallback:fn=>fn,cfg:{apiKey:'synthetic',forTool:()=>({model:'mock',level:'low'})},K:{knowledgeBase:kb,isCurrentSource:k=>k===active,registerArtifact:(kind,entries)=>state.registry=entries},generatorSlot:{current:createOperationSlot()},currentSourceKB:{current:kb},artifactSourceSnapshot:()=>({sourceKB:kb,factIndex:index('Monitor the marker.')}),activeCondition:{name:'Synthetic'},selectedFacts:[{id:'f1'}],sufficiency:{warnings:[]},difficulty:'foundational',stages:1,questionsPerStage:two?2:1,types:{mcq:true},runAudit:true,caseBuildPrompt:()=>'',caseBuildRepairPrompt:args=>JSON.stringify(args.q),extractJSON:JSON.parse,isQuotaError:()=>false,uid:()=> 'fixture',log:msg=>state.logs.push(msg)};
    for(const key of ['Busy','Logs','CaseStudy','Issues','Coverage','LiveKB','Audit','AuditPhase','Provenance','InvalidCaseRaw','AbortCtl','ArtifactSource','AuditState'])env['set'+key]=set(key);
    env.callGemini=async(key,model,parts)=>{const text=parts[0].text;state.calls.push(text);if(state.calls.length===1)return JSON.stringify(cs);if(text.includes('NCLEX ITEM QUALITY REVIEW'))return 'FAIL — Stem clarity';const q=JSON.parse(text);if(defer)return new Promise(resolve=>pending.push({q,resolve}));return JSON.stringify(repair(clone(q)));};
    const run=new Function('env','with(env){'+S.slice(start,end)+';return run;}')(env);
    const cancel=replace=>{if(replace){active={};env.currentSourceKB.current=active;}env.generatorSlot.current.cancel();state.AuditState='interrupted';};
    return{state,pending,run,cancel};
  }
  for(const repair of [q=>q,q=>({...q,repairNote:'Only note changed'}),q=>Object.fromEntries(Object.entries(q).reverse()),q=>({...q,options:q.options.slice(0,3)}),q=>({...q,options:q.options.slice(0,1)}),q=>({...q,options:q.options.map((o,i)=>({...o,label:i===0?'Z':o.label}))})]){const h=setup({repair});await h.run();t('live repair preserves original FAIL and item on no-op/contract failure',h.state.Audit['1:q1'].status==='FAIL'&&h.state.snapshots.length===1&&!!h.state.Audit['1:q1'].repairAttempt);}
  let h=setup({repair:q=>({...q,stem:'Which action is indicated now?'})});await h.run();t('live valid repair publishes immutable content and REPAIRED',h.state.snapshots.length===2&&h.state.Audit['1:q1'].status==='REPAIRED'&&JSON.parse(h.state.snapshots[0]).stages[0].questions[0].stem===question().stem);t('accepted repair findings match retained revision',JSON.stringify(h.state.Issues)===JSON.stringify([...C.validateCaseStudy(h.state.CaseStudy,index('Monitor the marker.'),new Set(['f1']),'Synthetic'),...C.validateStageTiming(h.state.CaseStudy)]));
  t('auditor saw first published labels',h.state.calls[1].includes('KEYED ANSWER: '+JSON.parse(h.state.snapshots[0]).stages[0].questions[0].correctAnswers[0]));
  for(const reverse of [false,true]){h=setup({two:true,defer:true});const work=h.run();await pump(()=>h.pending.length===2);const order=reverse?[1,0]:[0,1];for(const i of order){const p=h.pending[i];p.resolve(JSON.stringify({...p.q,stem:'Updated '+p.q.id}));await pump(()=>h.state.CaseStudy.stages[0].questions.some(q=>q.stem==='Updated '+p.q.id));}await work;t('concurrent repairs retain both completions '+reverse,h.state.CaseStudy.stages[0].questions.every(q=>q.stem==='Updated '+q.id)&&h.state.snapshots.length===3);}
  for(const replace of [false,true]){h=setup({two:true,defer:true});const work=h.run();await pump(()=>h.pending.length===2);h.pending[0].resolve(JSON.stringify({...h.pending[0].q,stem:'Updated first',rationales:h.pending[0].q.rationales.map(r=>({...r,text:'The patient marker supports reasoning.'}))}));await pump(()=>h.state.snapshots.length===2);const retained=JSON.stringify(h.state.CaseStudy),issues=JSON.stringify(h.state.Issues);t('current findings publish before another repair awaits '+replace,h.state.Issues.some(i=>i.msg.includes('terminology')));h.cancel(replace);h.pending[1].resolve(JSON.stringify({...h.pending[1].q,stem:'LATE'}));await work;t('cancel/source replacement prevents late repair '+replace,JSON.stringify(h.state.CaseStudy)===retained&&JSON.stringify(h.state.Issues)===issues&&h.state.AuditState==='interrupted');}
}
module.exports={run,load,fixture,question,index};
if(require.main===module){const fs=require('fs');const {resolveSuiteFile}=require('./repo-checks');let pass=0,fail=0;run(fs.readFileSync(process.argv[2]||resolveSuiteFile({rootDir:process.cwd()}),'utf8'),(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);c?pass++:fail++;}).then(()=>{console.log({pass,fail});process.exitCode=fail?1:0;});}
