'use strict';
module.exports=function numericBoundaryTests(S,t){
  const a=S.indexOf('const CASE_CLINICAL_TOKEN_RE='),b=S.indexOf('// Every distinct fact id referenced anywhere in the case',a);
  if(a<0||b<0)throw Error('Numeric boundary extraction anchors missing');
  const C=new Function(S.slice(a,b)+';return{caseNumericTokens,caseAuditTextValues,validateCaseStudy};')();
  const audit=(value,support)=>{const out=[];C.caseAuditTextValues(value,['fact-1'],new Map([['fact-1',{fact:{text:support,sourceQuote:''}}]]),'Synthetic',out,'direct');return out;};
  const error=x=>x.some(i=>i.sev==='error');
  for(const unsupported of ['5 mg·kg','5 mg/(kg min)','5 mg%','5 mg²','5 mg^','5 mg * kg']){
    t('unsupported output suffix cannot borrow a supported unit prefix: '+unsupported,error(audit(unsupported,'5 mg')));
    t('unsupported source suffix cannot donate a supported unit prefix: '+unsupported,error(audit('5 mg',unsupported)));
  }
  t('a complete supported compound still validates',!error(audit('5 mcg/kg/min','5 µg/kg/min')));
  t('a following arithmetic factor does not become an invented unit suffix',!error(audit('5 mg × 2','5 mg')));
  t('normal sentence punctuation after a unit remains usable',!error(audit('5 mg.','5 mg; monitor closely.')));
  t('a spaced prose dash after a dose is not mistaken for unit notation',!error(audit('5 mg - administer as prescribed.','5 mg')));
  const index=new Map([['fact-1',{fact:{text:'Hemoglobin 8 g/dL.',sourceQuote:''}}],['fact-2',{fact:{text:'Monitor closely.',sourceQuote:''}}]]);
  const datum={label:'Hemoglobin',value:'8 g/dL',factIds:['fact-1']};
  const question={id:'q1',type:'MCQ',stem:'Choose an action.',options:[{label:'A',text:'First'},{label:'B',text:'Second'}],correctAnswers:['A'],rationales:[{option:'A',text:'Hemoglobin is 8 g/dL.',supportType:'direct',factIds:['fact-2']},{option:'B',text:'Monitor closely.',supportType:'direct',factIds:['fact-2']}]};
  const run=data=>C.validateCaseStudy({stages:[{stageNumber:1,data:[data],questions:[question]}]},index,new Set(index.keys()));
  const missing=run(datum);
  t('missing supportType remains a warning when source evidence proves the datum',missing.some(i=>i.sev==='warn'&&i.msg.includes('missing supportType'))&&!error(missing));
  t('missing availability retains the established warning and default timing semantics',missing.some(i=>i.sev==='warn'&&i.msg.includes('missing availability')));
  t('present-invalid supportType still cannot donate rationale evidence',run({...datum,supportType:'Direct'}).some(i=>i.sev==='error'&&i.msg.includes('rationale')));
  const uncited=run({...datum,supportType:'direct',factIds:[]});
  t('uncited datum warning stays separate from independently unsupported rationale content',uncited.some(i=>i.sev==='warn'&&i.msg.includes('has no fact ID'))&&uncited.some(i=>i.sev==='error'&&i.msg.includes('rationale'))&&!uncited.some(i=>i.sev==='error'&&i.msg.includes('datum')));
  t('numeric extraction retains a non-vacuous token parser tail',C.caseNumericTokens('5 mg·kg').unsupported[0]==='5 mg·kg');
};
