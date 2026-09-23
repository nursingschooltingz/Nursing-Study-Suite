'use strict';
const {load,fixture,index}=require('./case-remediation-tests');
module.exports=function run(S,t){
  const builder=name=>{const a=S.indexOf('function '+name+'('),b=S.indexOf('`;\n}',a);if(a<0||b<0)throw Error('Missing builder '+name);return new Function('CASE_QUESTION_RULES','caseRenderFactPacket','caseDifficultyBlock',S.slice(a,b+4)+';return '+name+';')('Shared rules',()=> 'Synthetic fact packet',()=> 'Synthetic difficulty');};
  const args={conditionName:'Synthetic',facts:[],difficulty:'exam',stages:1,questionsPerStage:1,includeTypes:{mcq:true},stageNumber:1,q:{id:'q1'},criterion:'Stem clarity',visibleContext:'Synthetic context'};
  for(const name of ['caseBuildPrompt','caseBuildRepairPrompt']){
    const prompt=builder(name)(args);
    t(name+' separates rejected quantities from source evidence',prompt.includes('Those option values are NOT\nsource evidence for their rationales.'));
    t(name+' forbids invented alternative clinical contexts',prompt.includes('Never claim a rejected value belongs to another stage, condition or treatment unless\nthe cited fact explicitly establishes that association.'));
    t(name+' requires cited-rule explanation and rejects relabeling bypass',prompt.includes('This option does not match the cited assessment interval of 4 minutes.')&&prompt.includes('Do not relabel an unsupported\ndistractor number "instantiated" merely to clear numeric validation.'));
  }
  const C=load(S),cs=fixture(),q=cs.stages[0].questions[0];q.options[1].text='Assess every 12 minutes.';
  q.rationales[1].text='An interval of 12 minutes is used in an earlier phase.';
  const fi=index('Assess every 4 minutes.'),check=()=>C.validateCaseStudy(cs,fi,new Set(['f1']),'Synthetic');
  t('invented context for rejected option remains a grounding error',check().some(i=>i.sev==='error'&&i.msg.includes('rationale B')));
  q.rationales[1].text='This option does not match the cited assessment interval of 4 minutes.';
  t('source-based explanation validates without accepting rejected option as evidence',!check().some(i=>i.sev==='error')&&q.options[1].text==='Assess every 12 minutes.');
};
