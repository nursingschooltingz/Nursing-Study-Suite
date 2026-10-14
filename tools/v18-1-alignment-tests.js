'use strict';

// v18.1: one exam tier and one priority order across the tabs. Synthetic data only; no network.

module.exports=function run(S,t){
  const span=(a,b,from)=>{const base=from?S.indexOf(from):0;const x=S.indexOf(a,base),y=S.indexOf(b,x+a.length);if(base<0||x<0||y<0)throw Error('Missing v18.1 anchor '+a);return S.slice(x,y);};
  const count=(text,needle)=>text.split(needle).length-1;
  const rules=new Function(span('const PRIORITY_ORDER_RULES=','\n// ── Parsers ──')+';return PRIORITY_ORDER_RULES;')();
  const synth=new Function(span('function paBuildSynthPrompt(','\n// v15.8: was four independent regexes')+';return paBuildSynthPrompt;')();
  const synthPrompt=synth(['- **Synthetic item** [§ S] | QUALIFIER: NONE | FLAGS: NONE'],'');

  // The two lists are parsed from the live texts, so a renamed, reordered, added or dropped rule on either side fails.
  const ruleName=rest=>rest.split(/\s+\.+\s|\s{2,}/)[0].replace(/\s*\/\s*/g,'/').trim().toUpperCase();
  const cascade=[...synthPrompt.matchAll(/^R([1-8])\s+(\S.*)$/gm)].map(m=>[m[1],ruleName(m[2])]);
  const shared=[...rules.matchAll(/^\s{2}([1-8])\.\s+(\S.*)$/gm)].map(m=>[m[1],ruleName(m[2])]);
  t('v18.1: the Priority cascade parses to rules R1-R8 in order',cascade.length===8&&cascade.every(([n],i)=>n===String(i+1))&&cascade[0][1]==='ABC'&&cascade[7][1]==='NURSING PROCESS');
  t('v18.1: the shared priority order names the same eight rules in the same order as the Priority cascade',
    shared.length===8&&JSON.stringify(shared)===JSON.stringify(cascade));
  const norm=s=>s.replace(/\s+/g,' ').trim().toLowerCase();
  const b2=synthPrompt.match(/^B2\. ([\s\S]*?)\nB3\./m),ties=rules.match(/^Tiebreakers: ([\s\S]*?)\nGrounding/m);
  t('v18.1: the shared tiebreakers equal the Priority cascade B2 line, which now orders emergent > urgent > nonurgent',
    !!b2&&!!ties&&norm(b2[1])===norm(ties[1])&&norm(b2[1]).includes('emergent > urgent > nonurgent'));
  t('v18.1: the shared priority order keeps grounding first and names the deciding rule without values',
    rules.includes('the key and every distractor must trace to supplied facts')&&rules.includes('supplied fact states its own priority, follow the fact')
    &&rules.includes('do not write the item as a priority question')&&rules.includes('in words and without values')&&!rules.includes('${'));

  // Where it is sent: the NCLEX Generator after the batch block, the case prompt after the shared rules. Not the repair or audit prompts.
  t('v18.1: the NCLEX Generator sends the shared priority order between the batch block and the focus block',
    count(S,"let prompt=NCLEX_GEN_PROMPT+buildBatchBlock(b,numBatches,size)+'\\n'+PRIORITY_ORDER_RULES+'\\n'+buildFocusBlock()+")===1);
  const builder=name=>{const a=S.indexOf('function '+name+'('),b=S.indexOf('`;\n}',a);if(a<0||b<0)throw Error('Missing builder '+name);
    return new Function('CASE_QUESTION_RULES','PRIORITY_ORDER_RULES','caseRenderFactPacket','caseDifficultyBlock',S.slice(a,b+4)+';return '+name+';')('SHARED-RULES-MARK',rules,()=>'Synthetic fact packet',()=>'DIFFICULTY: exam');};
  const args={conditionName:'Synthetic',facts:[],difficulty:'exam',stages:1,questionsPerStage:1,includeTypes:{mcq:true,prioritization:true},stageNumber:1,q:{id:'q1'},criterion:'Stem clarity',visibleContext:'Synthetic context'};
  const casePrompt=builder('caseBuildPrompt')(args),repairPrompt=builder('caseBuildRepairPrompt')(args);
  const at=casePrompt.indexOf(rules);
  t('v18.1: the case prompt carries the shared priority order after the shared question rules and before the JSON shape',
    at>casePrompt.indexOf('SHARED-RULES-MARK')&&casePrompt.indexOf('SHARED-RULES-MARK')>0&&at<casePrompt.indexOf('═══ JSON SHAPE'));
  const audit=span('function itemBuildAuditPrompt(','\n}\n');
  t('v18.1: the case repair prompt and the grounding-blind item audit do not receive the priority order',
    !repairPrompt.includes('PRIORITY ORDER')&&!audit.includes('PRIORITY_ORDER_RULES')&&count(S,'+PRIORITY_ORDER_RULES+')===1&&count(S,'${PRIORITY_ORDER_RULES}')===1);

  // One exam tier: the generator copies each fact's KB tier, and focus matches keep it.
  const adapter=new Function(span('const NG_GROUNDING_ADAPTER=','\nfunction ngRenderAllocation(')+';return NG_GROUNDING_ADAPTER;')();
  t('v18.1: the NCLEX grounding adapter tells the model to copy the KB tier to PART 1 and the Tags line, never re-tiering',
    adapter.includes("TIER is the Knowledge Base's exam tier. Copy it unchanged to the concept's TIER in PART 1 and to the question's PART 4 Tags line")
    &&adapter.includes('Do not re-tier with the TIER RULES')&&adapter.includes('the lowest tier number among them'));
  const focus=span('  function buildFocusBlock(){\n    const parts=[];\n    if(outcomes.trim())parts.push(\'OUTCOMES','\n  function buildBatchBlock(');
  t('v18.1: generator focus matches go first in selection but keep the supplied KB tier',
    focus.includes('get Tier 1 priority for selection; their PART 1 and Tags tier stays the supplied KB tier.')&&!S.includes('are automatically Tier 1 priority for selection.'));

  // The Case Studies Tier 3 button no longer contradicts its help text.
  t('v18.1: the Case Studies Tier 3 button says background, matching the help text that distractors come from any tier',
    S.includes('<b>Tier 3</b> background</button>')&&!S.includes('<b>Tier 3</b> distractors')&&S.includes('Distractors are built from contextually plausible near-misses at any tier, not from Tier 3.'));
};
