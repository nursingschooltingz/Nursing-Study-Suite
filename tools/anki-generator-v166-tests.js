'use strict';

// Synthetic offline checks of the shipped packet, chunker and adapter. Prompt
// contracts do not establish that a model obeyed its internal target plan.
function runAnkiGeneratorV166Tests({S,t,section}){
  if(section)section('Anki v16.6 canonical source tags and generator fidelity');
  const span=(start,end)=>{
    const a=S.indexOf(start),b=S.indexOf(end,a+start.length);
    if(a<0||b<=a||S.indexOf(start,a+1)>=0)throw Error('Anki generator extraction anchor moved: '+start);
    return S.slice(a,b);
  };
  const helpers=span('function kbSourceText(f){','\n')+'\n'+
    span('function ankiConditionTagKey(','function ankiBatchSummary(')+
    span('function kbForAnki(kb){','// ── KB source chunking')+
    span('function splitOversizedConditionBlock(block,max){','function ankiParseCards(raw');
  const H=new Function(helpers+';return {kbForAnki,ankiChunkText,ankiConditionTagCheck,ankiNormalizeConditionTags};')();
  let sequence=0;
  const fact=(overrides={})=>({id:'fact-'+(++sequence),text:'Synthetic alpha target; beta remains conditional.',latteBucket:'Assess',tier:1,sources:[],...overrides});
  const condition=(name,aliases=[],facts=[fact()])=>({name,aliases,facts});
  const kb=conditions=>({conditions});
  const names=[
    ['Alpha in the Region (Group)','AlphaInTheRegionGroup'],
    ['Alpha, Beta, and Gamma','AlphaBetaAndGamma'],
    ['ABC Pattern','ABCPattern'],
    ["Maker's Pattern","MakersPattern"],
    ['État modèle','ÉtatModèle'],
    ['模型 条件','模型条件']
  ];
  const source=kb(names.map(([name])=>condition(name,['Short label']))),before=JSON.stringify(source),packet=H.kbForAnki(source);
  for(const [name,token] of names)t('source packet emits exact canonical spelling: '+name,packet.includes('=== CONDITION: '+name+' ===\nCANONICAL CONDITION TAG: Condition::'+token+'\n'));
  t('canonical serialization preserves source input and alias reading cues',JSON.stringify(source)===before&&packet.includes('ALIASES: Short label')&&!packet.includes('CANONICAL CONDITION TAG: Condition::ShortLabel'));
  const twoTiers=kb([condition('Mixed Priority',[],[fact({id:'fact-100',tier:1}),fact({id:'fact-101',tier:2})])]),twoPacket=H.kbForAnki(twoTiers);
  t('tag serialization preserves fact IDs, wording, buckets and independent tiers',twoPacket.includes('FACT fact-100 | LATTE: Assess | Tier: 1 | Synthetic alpha target; beta remains conditional. | Source: pointer unavailable')&&twoPacket.includes('FACT fact-101 | LATTE: Assess | Tier: 2 | Synthetic alpha target; beta remains conditional. | Source: pointer unavailable'));
  const unavailable='CANONICAL CONDITION TAG: unavailable — source condition name requires review';
  const collision=H.kbForAnki(kb([condition('A B'),condition('AB')]));
  t('colliding canonical identities remain unavailable instead of receiving authoritative tokens',collision.split(unavailable).length===3&&!collision.includes('CANONICAL CONDITION TAG: Condition::'));
  const aliasCollision=H.kbForAnki(kb([condition('Unique A'),condition('Unique B',['UniqueA'])]));
  t('a canonical token colliding with another source alias is withheld',aliasCollision.includes('=== CONDITION: Unique A ===\n'+unavailable)&&aliasCollision.includes('CANONICAL CONDITION TAG: Condition::UniqueB'));
  const sharedAlias=H.kbForAnki(kb([condition('Unique A',['Shared']),condition('Unique B',['Shared'])]));
  t('shared reading aliases do not invalidate distinct canonical tokens',sharedAlias.includes('CANONICAL CONDITION TAG: Condition::UniqueA')&&sharedAlias.includes('CANONICAL CONDITION TAG: Condition::UniqueB'));
  for(const name of [' / ','Hidden\u200bName','ß pattern'])t('unsafe source spelling never produces an invented token: '+JSON.stringify(name),H.kbForAnki(kb([condition(name)])).includes(unavailable));
  t('invalid alias metadata cannot authorize a canonical token',H.kbForAnki(kb([condition('Valid Name',[123])])).includes(unavailable));
  t('invalid fact identity keeps source token authorization unavailable',H.kbForAnki(kb([condition('Valid Name',[],[fact({id:''})])])).includes(unavailable));
  const splitFacts=Array.from({length:8},(_,i)=>fact({id:'fact-'+(200+i),text:('Synthetic part '+i+' ').repeat(45)}));
  const splitSource=kb([condition('Expanded in the Set (ABC)',['Short'],splitFacts)]),chunks=H.ankiChunkText(H.kbForAnki(splitSource),2300,2);
  t('every split condition fragment retains its exact canonical tag and aliases',chunks.length>1&&chunks.every(c=>c.includes('CANONICAL CONDITION TAG: Condition::ExpandedInTheSetABC\nALIASES: Short')));
  const factLines=chunks.join('\n').split('\n').filter(line=>/^FACT /.test(line));
  t('canonical prefixes neither duplicate nor lose facts when chunking',factLines.length===8&&new Set(factLines.map(line=>line.match(/^FACT (fact-\d+)/)[1])).size===8&&splitFacts.every(f=>factLines.some(line=>line.includes('FACT '+f.id+' |')&&line.includes(f.text))));
  const snapshot={facts:[{id:'fact-1',condition:'Alpha Region',aliases:['AR']},{id:'fact-2',condition:'Beta Region',aliases:['BR']}]};
  const note=(overrides={})=>({id:'synthetic',text:'[Synthetic] Target: {{c1::alpha}}.',extra:'',tags:'Custom::Group Topic::Alpha Tier::1',factIds:['fact-1'],mappingIssues:[],keep:false,...overrides});
  const guarded=[note(),note({id:'manual',tags:'Custom::Group Condition::ManualName Tier::1'}),note({id:'mixed',tags:'Condition::AR Tier::1',factIds:['fact-1','fact-2']}),note({id:'disputed',tags:'Condition::AR Tier::1',mappingIssues:[{code:'out-of-chunk'}]})],guardedBefore=JSON.stringify(guarded);
  const normalized=H.ankiNormalizeConditionTags(guarded,snapshot);
  t('upstream pinning leaves Topic/custom/manual/mixed/disputed normalization guards unchanged',JSON.stringify(guarded)===guardedBefore&&normalized.changes.length===0&&normalized.cards.every((c,i)=>c.tags===guarded[i].tags&&!c.keep)&&normalized.issues.map(i=>i.code).join(',')==='topic-tag,non-alias-condition,mixed-conditions,unreliable-mapping');
  const {extractPromptLiteral}=require('./repo-checks'),adapter=new Function(extractPromptLiteral(S,'kbAdapter').declaration+';return kbAdapter;')();
  t('adapter requests copying the supplied tag rather than deriving an abbreviation',adapter.includes('Copy the supplied CANONICAL CONDITION TAG verbatim')&&adapter.includes('aliases are reading cues, not replacement tag values')&&adapter.includes('If marked unavailable, retain source-faithful condition/topic labeling for review'));
  t('adapter preserves useful Extra while assigning substantive contents hidden destinations',adapter.includes('Keep Extra empty unless the supplied FACT text explicitly gives a useful supporting explanation or contrast.')&&adapter.includes('Source-supported symptoms, risk groups, actions and timing still need hidden destinations; Extra is not their substitute.'));
  t('adapter validates definitions and headings beyond matching the answer term',adapter.includes('A term listed without a definition must not become a definition card unless this input actually defines it')&&adapter.includes('Check the definition and heading themselves, not just whether the answer term occurs in a FACT.'));
  t('adapter preserves conditional actions and treatment availability without invented urgency',adapter.includes('Keep potential actions conditional; do not turn keeping a treatment available into immediate administration.')&&adapter.includes('AND/OR, preparation versus administration, or distinct eligibility criteria'));
  t('adapter reconciles hidden destinations after unbundling instead of dropping remaining targets',adapter.includes('Count independent items inside each cloze answer as well as separate gaps')&&adapter.includes('replacing a bundle with fewer targets must not displace the remaining targets')&&adapter.includes('add or restore notes when a target became only visible Text, Extra, or absent'));
  const spec=require('./anki-pilot-spec').makeAnkiPilotSpec(twoTiers,S);
  t('offline pilot uses the updated live serializer and canonical helper dependencies',spec.facts===2&&spec.chunkCount===1&&spec.additionalAuditCalls===0&&spec.packetSha256===require('./repo-checks').sha256(twoPacket));
  // Non-vacuous tail: invoke the final live normalization operation after serialization.
  const repaired=H.ankiNormalizeConditionTags([note({tags:'Custom::Group Condition::AR Tier::1'})],snapshot);
  t('final normalizer still repairs only a supplied alias while preserving manual selection',repaired.changes.length===1&&repaired.cards[0].tags==='Custom::Group Condition::AlphaRegion Tier::1'&&!repaired.cards[0].keep&&repaired.outcomes[0].status==='repaired');
}

module.exports={runAnkiGeneratorV166Tests};
