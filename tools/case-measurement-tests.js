'use strict';
// Synthetic measurement coverage; clinical/private exports stay outside the repository.
const {load,fixture,index}=require('./case-remediation-tests');
function run(S,t){
  const C=load(S),audit=(value,source,type='direct')=>{const out=[];C.caseAuditTextValues(value,['f1'],index(source),'Synthetic',out,type);return out;};
  for(const [unit,aliases] of [['cm',['cm','centimeter','centimeters','centimetre','centimetres']],['mm',['mm','millimeter','millimeters','millimetre','millimetres']],['sec',['sec','secs','second','seconds']],['min',['min','mins','minute','minutes']],['hr',['hr','hrs','hour','hours']],['day',['day','days']],['week',['week','weeks','wk','wks']]]){
    for(const alias of aliases){
      const p=C.caseNumericTokens('4 '+alias);t('measurement alias '+alias,p.tokens.map(x=>x.key).join()==='4'+unit&&p.unsupported.length===0);
    }
    t('measurement in narrative is validated '+unit,audit('The measurement is 4 '+unit+'.','Use 5 '+unit+'.').some(i=>i.sev==='error'));
    t('measurement source synonym '+unit,audit('4 '+unit,'4 '+aliases.at(-1)).length===0);
    t('measurement unsupported denominator '+unit,C.caseNumericTokens('4 '+unit+'/banana').unsupported.length===1);
  }
  for(const text of ['stage 2 labor','4 minimal steps','3 secondary actions','2 weekly reviews','4 daytime visits','Room 204 at 09:30']){
    const p=C.caseNumericTokens(text);t('measurement parser leaves numbered prose alone '+text,p.tokens.length===0&&p.unsupported.length===0);
  }
  for(const text of ['4sec','4secs','4CM','4hrs'])t('joined measurement alias '+text,C.caseNumericTokens(text).tokens.length===1);
  for(const [value,source,expected] of [
    ['4 cm','Size 2 cm to 6 cm.','clean'],
    ['4 cm','Size 2–6 cm.','clean'],
    ['4 cm','Size 2 cm–6 mm.','error'],
    ['72 seconds','Repeat every 4–6 minutes; duration 70–80 seconds.','clean'],
    ['5 minutes','Repeat every 4–6 minutes; duration 70–80 seconds.','clean'],
    ['72 seconds','Duration 70–80 seconds; repeat every 4–6 minutes.','clean'],
    ['72 seconds','Duration below 80 seconds; repeat below 6 minutes.','clean'],
    ['72 seconds','Repeat below 6 minutes; duration below 80 seconds.','clean'],
    ['72 seconds','Repeat every 4–6 minutes.','error'],
    ['72 seconds','Observe duration without a numerical bound.','error'],
    ['72 seconds','Duration 70–80 seconds/banana.','error'],
    ['72 seconds','Duration 70–80 seconds².','error'],
    ['72 seconds','Duration 70–80 seconds/(kg min).','error'],
    ['72 seconds','Duration 70–80 seconds; later 5 mg/banana.','clean'],
    ['90 seconds','Repeat every 4–6 minutes; duration 70–80 seconds.','warn'],
    ['20 minutes','Measure 4–6 cm; recovery 10–30 minutes.','clean'],
    ['-2 cm','Offset -3 to -1 cm.','clean'],
    ['4 cm','Size 20–60 mm.','error'],
  ]){
    const issues=audit(value,source,'instantiated');
    t('measurement threshold '+value+' from '+source,expected==='clean'?issues.length===0:expected==='warn'?issues.some(i=>i.sev==='warn')&&!issues.some(i=>i.sev==='error'):issues.some(i=>i.sev==='error'));
  }
  t('duration range is not an interior direct value',audit('72 seconds','70–80 seconds.').some(i=>i.sev==='error'));
  t('no automatic time conversion',audit('60 sec','1 minute.').some(i=>i.sev==='error'));
  t('cm is not mmHg prefix',C.caseNumericTokens('90 mm Hg').tokens[0]?.key==='90mmhg');
  const cs=fixture();cs.stages[0].data=[{label:'Size',value:'4 cm',supportType:'instantiated',availability:'revealed',factIds:['f1']},{label:'Duration',value:'72 seconds',supportType:'instantiated',availability:'revealed',factIds:['f1']}];
  const source='Size 2–6 cm; duration 70–80 seconds.',fi=index(source);
  t('measurement fixtures validate through shipped case tail',!C.validateCaseStudy(cs,fi,new Set(['f1']),'Synthetic').some(i=>i.sev==='error')&&C.validateStageTiming(cs).length===0);
  cs.stages[0].data[1].value='72 seconds of observation';cs.stages[0].data[1].supportType='direct';
  t('unsupported measurement remains blocked when embedded in prose',C.validateCaseStudy(cs,fi,new Set(['f1']),'Synthetic').some(i=>i.sev==='error'&&i.msg.includes('Duration')));
}
module.exports={run};
if(require.main===module){const fs=require('fs'),{resolveSuiteFile}=require('./repo-checks');let pass=0,fail=0;run(fs.readFileSync(process.argv[2]||resolveSuiteFile({rootDir:process.cwd()}),'utf8'),(n,c)=>{if(!c)console.log('FAIL '+n);c?pass++:fail++;});console.log({pass,fail});process.exitCode=fail?1:0;}
