'use strict';
module.exports=function neutralWeightTests(S,t){
  const a=S.indexOf('const CASE_CLINICAL_TOKEN_RE='),b=S.indexOf('// Every distinct fact id referenced anywhere in the case',a);
  if(a<0||b<0)throw Error('Neutral weight extraction anchors missing');
  const C=new Function(S.slice(a,b)+';return{caseNeutralCalculationValues,caseAuditDatumValues,caseAuditTextValues,validateCaseStudy};')();
  const index=(text='Calculate 2 mg/kg.',sourceQuote='')=>new Map([['fact-1',{fact:{text,sourceQuote}}]]);
  const datum=(label='Body weight',value='70 kg')=>({label,value,supportType:'neutral-framing',factIds:[]});
  const study=(data=[datum()],rationale='Use 70 kg in the supplied calculation.')=>({stages:[{stageNumber:1,data,questions:[{id:'calc',type:'Calculation',stem:'Calculate a dose.',options:[{label:'Answer',text:'____'}],correctAnswers:['140'],rationales:[{option:'Answer',text:rationale,supportType:'direct',factIds:['fact-1']}]}]}]});
  const errors=issues=>issues.filter(i=>i.sev==='error');
  const neutral=(cs,ix,allowed=new Set(ix.keys()))=>C.caseNeutralCalculationValues(cs,ix,allowed);
  const validate=(cs,ix,allowed=new Set(ix.keys()))=>C.validateCaseStudy(cs,ix,allowed);
  const baseline=index(),cs=study();
  t('formula per kg alone does not pretend a body weight was supplied',neutral(cs,baseline).has('70kg'));
  t('documented consistent neutral calculation weight remains valid',errors(validate(cs,baseline)).length===0);
  t('neutral calculation keeps missing availability at warning tier',validate(cs,baseline).some(i=>i.sev==='warn'&&i.msg.includes('missing availability')));
  for(const weight of ['154 lb','154 lbs','154 pounds','154 pound','154-pound','154.5 LB']){
    const ix=index('Calculate 2 mg/kg. Body weight is '+weight+'.');
    t('supplied pounds disables assumed weight without conversion: '+weight,neutral(cs,ix).size===0);
  }
  const quoted=index('Calculate 2 mg/kg.','Body weight is 154 lb.');
  t('a supplied pounds source quote also disables assumed weight',neutral(cs,quoted).size===0);
  t('a supplied pounds value results in a clinical datum error for assumed kg',errors(validate(cs,quoted)).some(i=>i.msg.includes('datum "Body weight"')));
  const scoped=index();scoped.set('fact-2',{fact:{text:'Body weight is 154 lb.',sourceQuote:''}});
  t('weight outside the immutable allowed packet does not alter the assumption contract',neutral(cs,scoped,new Set(['fact-1'])).has('70kg'));
  t('weight in an allowed second fact disables the assumption',neutral(cs,scoped).size===0);
  t('existing supplied kilogram guard remains effective',neutral(cs,index('Calculate 2 mg/kg. Body weight is 70 kg.')).size===0);
  t('a per-pound formula does not count as a supplied patient weight',neutral(cs,index('Calculate 2 mg/kg. The formula also mentions 1 mg/lb.')).has('70kg'));
  const repeated=study([datum(),datum('Weight')]);
  t('the same permitted assumed weight may appear under both recognized labels',errors(validate(repeated,baseline)).length===0);
  for(const label of ['Medication dose','Potassium','Target weight']){
    const issues=validate(study([datum(),datum(label)]),baseline);
    t('another neutral clinical datum cannot borrow the body-weight exemption: '+label,errors(issues).some(i=>i.msg.includes('datum "'+label+'"')&&i.msg.includes('neutral-framing')));
  }
  t('a rejected extra datum does not revoke legitimate weight and rationale use',!errors(validate(study([datum(),datum('Medication dose')]),baseline)).some(i=>i.msg.includes('datum "Body weight"')||i.msg.includes('rationale')));
  const direct=[];C.caseAuditTextValues('70 kg',['fact-1'],index('Body weight is 154 lb.'),'Synthetic',direct,'direct');
  t('the pounds guard does not invent a pounds-to-kilograms equivalence',errors(direct).length===1);
  t('inconsistent assumed weights still fail the preexisting exception',neutral(study([datum(),datum('Weight','80 kg')]),baseline).size===0);
  const noCalculation=study();noCalculation.stages[0].questions=[];
  t('the assumed weight still requires an actual Calculation question',neutral(noCalculation,baseline).size===0);
  const probe=[];C.caseAuditDatumValues(datum('Medication dose'),baseline,'Tail',probe,new Set(['70kg']));
  t('live datum audit tail rejects a directly supplied unrelated-label exemption',errors(probe).some(i=>i.msg.includes('neutral-framing')));
};
