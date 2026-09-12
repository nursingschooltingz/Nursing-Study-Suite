#!/usr/bin/env node
'use strict';

// Reproduces the historical example diff, rejected after its live pilot.
// Retained for evidence and regression fixtures, not authorization to reapply it.
// Never writes the application or prompt baseline.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const {extractPromptLiteral}=require('./repo-checks');
function buildAnkiExampleProposal(source){
  const live=extractPromptLiteral(source,'ANKI_MASTER_PROMPT').declaration;
  const replacements=[[
    'For example, replace Characterized by an {{c1::erythematous plaque}} with Lesion type: {{c1::erythematous plaque}}.',
    'For a fictional format-only example, use [ExampleCondition-B] Lesion type: {{c1::an erythematous plaque}}||Nursing::LATTE::Look Condition::ExampleConditionB Tier::2. ExampleCondition-B is never source material for the generated deck.'
  ],[
    'Examples of desired compression:\n\n"The patient should report weight gain of 2 lb in 24 hours" -> Report weight gain of {{c1::2 lb in 24 hr}}\n"Aspirin should be avoided in children with viral illness because of the risk of Reye syndrome" -> [Aspirin] Avoid in children with viral illness -> risk of {{c1::Reye syndrome}}\n"Monitor potassium levels while taking loop diuretics" -> [Loop diuretics] Monitor {{c1::potassium}}',
    'Complete format examples (fictional; never source material for the generated deck):\n\n[ExampleMedication-A] Pre-dose pulse count duration: {{c1::one full minute}}||Nursing::LATTE::Assess Condition::ExampleMedicationA Tier::1\n[ExampleMedication-A] Hold parameter: pulse {{c1::<60 bpm}}||Nursing::LATTE::Treatments Condition::ExampleMedicationA Tier::1\n[ExampleCondition-B] Reportable weight gain: {{c1::2 lb in 24 hr}}||Nursing::LATTE::Educate Condition::ExampleConditionB Tier::1\n[ExampleMedication-A] Mechanism: {{c1::blocks Receptor-Z}}||Nursing::LATTE::Treatments Condition::ExampleMedicationA Tier::1'
  ]];
  const pending=replacements.every(([old,next])=>live.split(old).length===2&&!live.includes(next));
  const applied=replacements.every(([old,next])=>live.split(next).length===2&&!live.includes(old));
  if(pending===applied)throw Error('Prompt proposal anchors changed or are partially applied; review before regenerating.');
  let original=live,proposed=live;
  for(const [old,next] of replacements){
    if(pending)proposed=proposed.replace(old,()=>next);
    else original=original.replace(next,()=>old);
  }
  return {original,proposed,applied};
}
if(require.main===module){
  const root=path.join(__dirname,'..'),{original,proposed}=buildAnkiExampleProposal(fs.readFileSync(path.join(__dirname,'fixtures','anki-v15.16-prompt.txt'),'utf8'));
  const scratch=path.join(root,'scratch');fs.mkdirSync(scratch,{recursive:true});
  const before=path.join(scratch,'anki-example-before.txt'),after=path.join(scratch,'anki-example-after.txt');
  fs.writeFileSync(before,original+'\n');fs.writeFileSync(after,proposed+'\n');
  const result=spawnSync('git',['diff','--no-index','--',before,after],{encoding:'utf8'});
  if(result.status!==1)throw Error(result.error?.message||result.stderr||'Expected a non-empty proposal diff');
  const lines=result.stdout.split('\n');
  lines[0]='diff --git a/ANKI_MASTER_PROMPT b/ANKI_MASTER_PROMPT';
  for(let i=1;i<lines.length;i++){if(lines[i].startsWith('--- '))lines[i]='--- a/ANKI_MASTER_PROMPT';if(lines[i].startsWith('+++ '))lines[i]='+++ b/ANKI_MASTER_PROMPT';}
  fs.writeFileSync(path.join(root,'docs','history','ANKI-v15.17-example-proposal.diff'),lines.join('\n'));
  console.log('Reproduced historical docs/history/ANKI-v15.17-example-proposal.diff; rejected candidate, live prompt and baseline unchanged.');
}
module.exports={buildAnkiExampleProposal};
