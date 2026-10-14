'use strict';

// v18.0: step 10 of the v17.14 production review, Low findings (cases group). Synthetic data only.

module.exports=async function run(S,t){
  const span=(a,b)=>{const x=S.indexOf(a),y=S.indexOf(b,x+a.length);if(x<0||y<0)throw Error('Missing low-cases anchor '+a);return S.slice(x,y);};
  const W=new Function('neiaTerminologyScan','itemHeuristics',span('function ngSplitParts(','function ngRenumber(')+';return {ngCanonicalOrderingAnswers,ngSplitParts,validateNCLEXWorksheet};')(()=>{},()=>{});
  const C=new Function(span('const CASE_CLINICAL_TOKEN_RE=','function CaseStudyGenerator()')+';return {caseParseThresholds};')();
  const selectCaseFacts=new Function(span('function selectCaseFacts(','// Sufficiency check')+';return selectCaseFacts;')();
  const errors=issues=>issues.filter(i=>i.sev==='error').map(i=>i.msg);
  const why=(label,ok)=>'     Why '+label+' is '+(ok?'correct':'wrong')+': reason. (Source: C1)';
  const keyEntry=(n,answer,labels,right)=>'  '+n+'. ANSWER: '+answer+'\n'+labels.map(l=>why(l,right.includes(l))).join('\n')+'\n     Strategy: s.\n     Tags: Tier 1';
  const mcq=(n,stem)=>'  '+n+'. '+stem+'\n     A. One\n     B. Two\n     C. Three\n     D. Four';
  const batch=(p1,p3,p4,dist)=>'PART 1 — INVENTORY\n'+p1+'\nPART 2 — AUDIT\nQ1 cites C1\nPART 3 — QUESTIONS\n'+p3+'\nPART 4 — KEY\n'+p4+'\nDISTRIBUTION: '+dist;

  // v18.0 (review L32): an earlier pharmacology "Distribution:" line is not the DISTRIBUTION line.
  {
    const lying=batch('C1 | Synthetic drug [fact-1] |\nDistribution: highly protein bound',mcq(1,'Which action is first?'),keyEntry(1,'A',['A','B','C','D'],['A']),'Tier [1:1] | Types [SATA:1]');
    const issues=W.validateNCLEXWorksheet(lying,1,null),plain=batch('C1 | Synthetic drug [fact-1] |',mcq(1,'Which action is first?'),keyEntry(1,'A',['A','B','C','D'],['A']),'Tier [1:1] | Types [MCQ:1]');
    t('a "Distribution:" line earlier in the worksheet is not read as its DISTRIBUTION line, so a wrong count stays an error',
      W.ngSplitParts(lying).dist==='Tier [1:1] | Types [SATA:1]'&&errors(issues).some(m=>/DISTRIBUTION claims 1 SATA/.test(m))&&!issues.some(i=>/not in the required/.test(i.msg))&&W.ngSplitParts(plain).dist==='Tier [1:1] | Types [MCQ:1]'&&!errors(W.validateNCLEXWorksheet(plain,1,null)).length);
  }
  // v18.0 (review L33): the short last batch asks for target facts in proportion to its size.
  t('a short batch is allocated target facts for its own size, not a full batch',S.includes('alloc=ngAllocateBatch(pool,usedFactIds,{want:Math.max(1,Math.round(size*factsPerQ)),perCondition:4,neighborCap:2});')&&!S.includes('{want:wantPerBatch,'));
  // v18.0 (review L34): owned_log drops lines once the signal is aborted; "Cancelled." uses the raw log while the run owns its slot.
  t('both generators log "Cancelled." with the raw log while the cancelled run still owns its slot',S.split("if(e.name==='AbortError'){if(generatorSlot.current.owns(operation))log('Cancelled.','warn');}else owned_log('Error: ").length===3&&!S.includes("owned_log('Cancelled.'"));
  // v18.0 (review L35): a step text containing an arrow keeps a valid digit answer valid.
  {
    const ordQ='  1. Place the steps in the correct order.\n     ___ Alpha step\n     ___ Check the A -> B line\n     ___ Gamma step';
    const whyOrd='     Why step 1 (Gamma step): first. (Source: C1)\n     Why step 2 (Alpha step): second. (Source: C1)\n     Why step 3 (Check the A -> B line): third. (Source: C1)';
    const ord=(q,key)=>{const raw=batch('C1 | Synthetic concept [fact-1] |',q,key+'\n'+whyOrd.replace('Check the A -> B line',q.includes('->')?'Check the A -> B line':'Beta step')+'\n     Strategy: s.\n     Tags: Tier 1','Tier [1:1] | Types [Ordering:1]'),out=W.ngCanonicalOrderingAnswers(raw);return {raw,out,after:W.validateNCLEXWorksheet(out.text,1,null)};};
    const arrow=ord(ordQ,'  1. ANSWER: 3, 1, 2'),plain=ord(ordQ.replace('Check the A -> B line','Beta step'),'  1. ANSWER: 3, 1, 2');
    t('an ordering entry whose step text contains an arrow keeps its valid digit answer; other entries are still restated',
      !arrow.out.rewritten.length&&arrow.out.text===arrow.raw&&!errors(arrow.after).length&&plain.out.rewritten.join()==='1'&&W.ngSplitParts(plain.out.text).p4.includes('1. ANSWER: Gamma step → Alpha step → Beta step')&&!errors(plain.after).length);
  }
  // v18.0 (review L37): the case audit glyph and state.
  t('the case item-quality glyph follows auditUnresolved, so a skipped or unscored audit never shows ✓',S.includes("{auditTotals.fail?'⚠':auditUnresolved?'⚑':'✓'} Item quality:")&&!S.includes("auditState!=='complete'||auditTotals.review||auditTotals.repaired||auditTotals.error?'⚑':'✓'"));
  t('a case run that returns early does not leave its audit state running',S.includes("setAuditPhase('');setAuditState(s=>s==='running'?'failed':s);}}"));
  // v18.0 (review L39): no repairs after the audit stopped for quota.
  {
    const skip=S.indexOf('if(repairable.length&&auditInterrupted)owned_log(\'Repairs skipped'),repair=S.indexOf("owned_setAuditPhase('repair');");
    t('case repairs are skipped when the audit stopped for quota',skip>0&&repair>skip&&S.slice(skip,repair).includes('else if(repairable.length){'));
  }
  // v18.0 (review L41): audit error details are redacted before display and export.
  t('case and worksheet audit error details remove the API key',S.split("detail:cfg.apiKey?auditError.split(cfg.apiKey).join('[redacted]'):auditError,").length===3&&!S.includes("detail:e.message||String(e),warns:[]"));
  // v18.0 (review L42): the Calculation top-up adds numeric facts that are not already selected.
  {
    const facts=n=>Array.from({length:n},(_,i)=>({id:'f'+i,tier:1,latteBucket:'Look',text:'Synthetic value '+i+' mg'}));
    const ids=(n,calc)=>selectCaseFacts({facts:facts(n)},{includeCalculation:calc}).map(f=>f.id);
    t('the Calculation top-up adds up to four unselected numeric facts',ids(16,false).length===10&&ids(16,true).length===14&&ids(12,true).length===12&&ids(16,true).includes('f13')&&!ids(16,true).includes('f14')&&ids(8,true).length===8);
  }
  // v18.0 (review L43): negated comparators keep their meaning.
  {
    const th=s=>JSON.stringify(C.caseParseThresholds(s).map(x=>[x.op,x.value,x.unit]));
    t('"no less than" and "not less than" read as at least',th('SpO2 no less than 90%')==='[[">=",90,"%"]]'&&th('Urine output not less than 30 ml/hr')==='[[">=",30,"ml/hr"]]');
    t('"no greater than" and "not more than" read as at most; plain comparators are unchanged',th('Heart rate no greater than 100 bpm')==='[["<=",100,"bpm"]]'&&th('Not more than 2 l')==='[["<=",2,"l"]]'&&th('SpO2 less than 90%')==='[["<",90,"%"]]'&&th('Heart rate greater than 100 bpm')==='[[">",100,"bpm"]]'&&th('Urine no more than 30 ml')==='[["<=",30,"ml"]]');
  }
  // v18.0 (review, dead code): unreferenced helpers are gone.
  t('the unused ngParseFactIds and ITEM_AUDIT_STATUS are removed',!S.includes('function ngParseFactIds(')&&!S.includes('ITEM_AUDIT_STATUS='));
};
