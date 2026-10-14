'use strict';

// v18.0: step 10 of the v17.14 production review, Low findings (anki group). Synthetic data only.

module.exports=async function run(S,t){
  const span=(start,end)=>{
    const a=S.indexOf(start),b=S.indexOf(end,a+start.length);
    if(a<0||b<=a||S.indexOf(start,a+start.length)>=0)throw Error('v18.0 anki Low anchors moved or became ambiguous: '+start);
    return S.slice(a,b);
  };

  // L14: ankiParseSourceAuditV4 applies the hidden-coverage status rules to hidden references only.
  {
    const H=new Function(span('function ankiAuditSourceTokens(text){','// v16.2: complete fact coverage can coexist with an unmapped note.')+';return {ankiParseSourceAuditV4};')();
    const facts=[{id:'fact-1',text:'Never give potassium IV push.',inSelectedTier:true}];
    const note=(id,text,o)=>({id,text,extra:'',keep:true,structurallyValid:true,inSelectedTier:true,eligible:true,reviewTargets:[{index:1}],...o});
    const notes=[note('uuid-visible','[Hypokalemia] {{c1::Never}} give potassium IV push.'),
      note('uuid-tier2','[Hypokalemia] Potassium is never given {{c1::IV push}}.',{inSelectedTier:false,eligible:false}),
      note('uuid-unchecked','[Hypokalemia] Never give potassium {{c1::IV push}}.',{keep:false,eligible:false}),
      note('uuid-invalid','[Hypokalemia] Never give potassium {{c1::IV push}}.',{structurallyValid:false,eligible:false})];
    const group={id:'synthetic-l14',protocolVersion:4,facts,notes,sourceFactIds:['fact-1'],scopeNoteIds:['uuid-visible']};
    const parse=(status,noteRefs,contextRefs)=>H.ankiParseSourceAuditV4(JSON.stringify({factReviews:[{factId:'fact-1',
      inventory:[{sourceRef:{start:1,end:3},role:'context',reason:'Action frame for the route restriction.'},{sourceRef:{start:4,end:5},role:'target',reason:''}],
      targets:[{sourceRef:{start:4,end:5},status,noteRefs,contextRefs}]}],
      noteReviews:[{noteId:'n1',text:{status:'supported',evidence:[{factId:'fact-1',sourceRef:{start:1,end:5}}]},extra:{status:'empty',evidence:[]}}],findings:[]}),group);
    const verdict=r=>r.factReviews[0]&&r.factReviews[0].targets[0];
    const outTier=parse('out-of-tier',[{noteId:'n2',clozeIndices:[1]}],[{noteId:'n1',field:'text'}]);
    const wrongHidden=parse('out-of-tier',[{noteId:'n1',clozeIndices:[1]}],[]);
    t('v18.0 L14 out-of-tier hidden coverage may cite an eligible Text mention in contextRefs; a hidden ref in an in-tier note is still rejected',
      outTier.complete===true&&outTier.unresolved.length===0&&verdict(outTier).status==='out-of-tier'&&verdict(outTier).noteRefs[0].noteId==='uuid-tier2'&&verdict(outTier).contextRefs[0].noteId==='uuid-visible'&&wrongHidden.complete===false);
    const excluded=parse('manual-excluded',[{noteId:'n3',clozeIndices:[1]}],[{noteId:'n2',field:'text'}]);
    const contextOnlyKept=parse('manual-excluded',[],[{noteId:'n1',field:'text'}]),contextOnlyExcluded=parse('manual-excluded',[],[{noteId:'n3',field:'text'}]);
    t('v18.0 L14 manual-excluded hidden coverage may cite a kept note in contextRefs; context-only coverage is still judged by the status rule',
      excluded.complete===true&&verdict(excluded).contextRefs[0].noteId==='uuid-tier2'&&contextOnlyKept.complete===false&&contextOnlyExcluded.complete===true);
    const invalid=parse('invalid-note',[{noteId:'n4',clozeIndices:[1]}],[{noteId:'n1',field:'text'}]),invalidWrong=parse('invalid-note',[{noteId:'n2',clozeIndices:[1]}],[]);
    t('v18.0 L14 invalid-note hidden coverage may cite a valid note in contextRefs; a hidden ref in a valid note is still rejected',
      invalid.complete===true&&verdict(invalid).noteRefs[0].noteId==='uuid-invalid'&&invalidWrong.complete===false);
  }

  // L15: paParseTiers recognises bold and other-emoji tier headings; plain headings are unchanged.
  {
    const PA=new Function(span('function paParseTiers(','\nconst PA_SYNTH_PART_CHARS=')+'\n;return paParseTiers;')();
    const doc=a=>a.join('\n'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const plain=PA(doc(['## TIER 1 — Must Know','- a','## TIER 2 — Should Know','- b','## TIER 3 — Good to Know','- c','---','## Study Strategy','- s','*Audit: ok*']));
    const plainOk=same(plain,{tier1:'- a',tier2:'- b',tier3:'- c',strategy:'- s',audit:'ok'});
    const bold=PA(doc(['## TIER 1 — Must Know','- a','## **TIER 2 — Should Know**','- b','## TIER 3 — Good to Know','- c','## **Study Strategy**','- s']));
    t('v18.0 L15 a bold hashed Tier 2 heading no longer puts Tier 2 inside Tier 1, and the plain template parses as before',
      plainOk&&same(bold,{tier1:'- a',tier2:'- b',tier3:'- c',strategy:'- s',audit:''}));
    const bare=PA(doc(['## TIER 1','- a','**Tier 2**','- b','**TIER 3 — Good to Know**','- c','## Study Strategy','**Tier 1 first: drill the airway items.**','- s']));
    t('v18.0 L15 a wholly bold Tier heading counts, while a bold strategy sentence mentioning a tier stays in Study Strategy',
      same(bare,{tier1:'- a',tier2:'- b',tier3:'- c',strategy:'**Tier 1 first: drill the airway items.**\n- s',audit:''}));
    const emoji=PA(doc(['## 🔴 TIER 1','- a','## 🟠 TIER 2','- b','## ⚠️ TIER 3','- c']));
    const fiveHash=PA(doc(['## TIER 1','- a','##### TIER 2','- b']));
    t('v18.0 L15 other-emoji headings separate the tiers; five hashes are still not a heading',
      same(emoji,{tier1:'- a',tier2:'- b',tier3:'- c',strategy:'',audit:''})&&fiveHash.tier1==='- a\n##### TIER 2\n- b'&&fiveHash.tier2==='');
  }

  // Dead code: the duplicated v15.8 comment block above paParseTiers is gone; the fuller first copy remains.
  t('v18.0 dead code: the v15.8 paParseTiers comment block appears once',
    S.split('// v15.8: was four independent regexes').length===2&&S.includes('// A single line scan cannot over-run: a section ends where the next heading begins, and'));
};
