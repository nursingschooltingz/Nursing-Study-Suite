'use strict';

// Scoped format checks use synthetic cards and the shipped parser, lint, edit, export
// and audit paths. A semantic condition discrepancy remains an advisory finding.
function runAnkiTagFormatTests({S,t,section}){
  if(section)section('Anki scoped hierarchical tag format');
  const extract=(start,end)=>{
    const a=S.indexOf(start),b=S.indexOf(end,a+start.length);
    if(a<0||b<0||S.indexOf(start,a+start.length)>=0||S.indexOf(end,b+end.length)>=0)throw new Error('Anki tag-format extraction missing or ambiguous: '+start);
    return S.slice(a,b);
  };
  let ids=0;
  const source=extract('function ankiParseCards(raw','function AnkiStyleBadges');
  const H=new Function('uid',source+';return {ankiParseCards,ankiTagFormatIssues,lintAnkiCard,LINT_LABEL,ankiSelection,ankiExportText,ankiDedupeCards,ankiNormalizeConditionTags,ankiConditionTagCheck,ankiSourceSnapshot,ankiStyleWarnings,ankiReviewFilter,ankiAuditGroups,ankiAuditPacket};')(()=> 'synthetic-tag-'+(++ids));
  const tags='Nursing::LATTE::BriefPatho Condition::PanicDisorder Tier::1';
  const row=tagText=>'[Synthetic] Finding: {{c1::answer}}.||'+tagText;
  const parse=(tagText=tags,contract='hierarchical-v1')=>H.ankiParseCards(row(tagText),1,contract).cards[0];
  const good=parse(),bad=parse('Nursing::LATTE::BriefPatho Condition::Panic Disorder Tier::1');
  t('tag extraction reaches the actual source-audit packet helper',typeof H.ankiAuditPacket==='function'&&typeof H.ankiTagFormatIssues==='function');
  t('the structured-KB generation call explicitly captures its format contract',S.includes("ankiParseCards(resp,i+1,'hierarchical-v1')"));
  t('scoped parser attaches the recognized format contract',good.tagFormatContract==='hierarchical-v1'&&bad.tagFormatContract==='hierarchical-v1');
  t('default parser does not infer contract from a LATTE namespace',!Object.hasOwn(H.ankiParseCards(row('Nursing::LATTE::Look Condition::Panic Disorder Tier::1')).cards[0],'tagFormatContract'));
  t('unknown parser contract does not accidentally authorize validation',!Object.hasOwn(parse(tags,'future-contract'),'tagFormatContract'));
  t('spaced Condition leaves one observable stray word',H.ankiTagFormatIssues(bad).join(',')==='Disorder');
  t('spaced Condition is structural only in its captured format scope',H.lintAnkiCard(bad).includes('tag-format')&&!H.lintAnkiCard({...bad,tagFormatContract:undefined}).includes('tag-format'));
  t('corrected Condition token passes without source-name inference',H.lintAnkiCard(good).length===0);
  t('format label describes repair without a namespace whitelist',H.LINT_LABEL['tag-format'].includes('::-separated')&&H.LINT_LABEL['tag-format'].includes('stray words'));
  const supported=[
    'Nursing::LATTE::Treatments::Meds Condition::X Tier::1',
    'AandP::Musculoskeletal::Structure Topic::LongBones Tier::2',
    'Bio::CellBiology::Mitosis Topic::CellDivision Tier::3',
    'Custom-Domain::Week_4::Part-2 Topic::ÉtatRénal Tier::1',
    '生物学::細胞 Topic::心不全 Tier::1',
    'Course::A&P::Revision-2 Topic::2026_notes Tier::1'
  ];
  for(const tagText of supported)t('hierarchical namespace remains valid: '+tagText,H.lintAnkiCard(parse(tagText)).length===0);
  t('tabs and multiple spaces remain valid separators between complete tags',H.lintAnkiCard(parse('  Nursing::LATTE::Look\tCondition::X   Tier::1  ')).length===0);
  for(const token of ['Condition:', 'Condition:::Panic', '::Panic', 'Condition::', 'Condition::Panic::', 'Condition::Panic:Disorder']){
    t('empty or single-colon hierarchy is rejected: '+token,H.lintAnkiCard(parse(token+' Tier::1')).includes('tag-format'));
  }
  t('bare custom tags remain valid on ungoverned manual cards',H.lintAnkiCard(parse('Tier::1 exam-week personal_note',null)).length===0);
  t('custom names and condition semantics are not structural lint',H.lintAnkiCard(parse('Custom::Anything Condition::UnrecognizedName Tier::1')).length===0);
  t('tag grammar does not promote missing condition metadata to structural lint',H.lintAnkiCard(parse('Nursing::LATTE::Look Tier::1')).length===0);
  t('multiple identical complete Tier tokens retain one effective tier',H.lintAnkiCard(parse(tags+' Tier::1')).length===0);
  t('existing conflicting Tier validation remains intact',H.lintAnkiCard(parse(tags+' Tier::2')).includes('no-tier'));
  t('existing newline exclusion remains intact independently of tag grammar',H.lintAnkiCard({...good,tags:good.tags+'\nCustom::Note'}).includes('pipe-format'));

  const prior=JSON.stringify(bad),selection=H.ankiSelection([bad,good]);
  t('invalid generated tag derives exclusion but preserves manual selection',selection.invalid===1&&selection.kept.length===1&&selection.kept[0].id===good.id&&bad.keep===true&&JSON.stringify(bad)===prior);
  t('plain export includes only eligible cards with their exact tag bytes',H.ankiExportText([bad,good],null,true,'all',false,false)===row(tags));
  t('headered export uses the same tag eligibility',H.ankiExportText([bad,good],null,true,'all',true,false).split('\n').filter(line=>line.includes('|')).length===1&&!H.ankiExportText([bad,good],null,true,'all',true,false).includes('Condition::Panic Disorder'));
  t('invalid scoped tags are preserved as separate inspectable notes during dedupe',H.ankiDedupeCards([bad,{...bad,id:'another-bad'}]).length===2);
  let cards=[bad,{...bad,id:'manually-excluded',keep:false}];
  const editSource=extract('  const updateField=useCallback(', '  const exportTxt=useCallback(');
  const update=new Function('useCallback','setCards','lintAnkiCard','ankiUnsafeAbbrevScan',editSource+';return updateField;')(fn=>fn,fn=>{cards=fn(cards);},H.lintAnkiCard,()=>{});
  update(bad.id,'tags',tags);
  update('manually-excluded','tags',tags);
  t('live Table repair clears the selected note format issue',cards[0].lint.length===0&&cards[0].keep&&H.ankiSelection(cards).kept[0]===cards[0]);
  t('live Table repair never reverses a manual exclusion',cards[1].lint.length===0&&!cards[1].keep&&H.ankiSelection(cards).kept.length===1);
  t('live Table edits retain the captured contract for subsequent validation',cards.every(c=>c.tagFormatContract==='hierarchical-v1'));
  update(bad.id,'tags','Condition::Panic Disorder Tier::1');
  t('later malformed edit removes eligibility without unchecking the note',cards[0].lint.includes('tag-format')&&cards[0].keep&&H.ankiSelection(cards).kept.length===0);
  const warned={...good,text:'[Synthetic] Set: {{c1::alpha}}, {{c1::beta}}, {{c1::gamma}}.'};
  t('shared-gap and list warnings remain advisory on scoped notes',H.ankiStyleWarnings(warned).some(x=>x.code==='list-recall')&&H.lintAnkiCard(warned).length===0&&H.ankiSelection([warned]).kept.length===1);
  t('warning filters preserve export and keep choices for scoped notes',H.ankiReviewFilter([warned],'all','list-recall')[0]===warned&&H.ankiExportText([warned],null,true,'all',false,false).endsWith(tags)&&warned.keep);

  const snapshot=H.ankiSourceSnapshot({conditions:[{name:'Panic Disorder',aliases:['PD'],facts:[{id:'fact-1',text:'Synthetic supplied fact.',tier:1,latteBucket:'BriefPatho',sources:[]}]}]});
  const mapped={...bad,factIds:['fact-1'],mappingIssues:[]};
  const normalized=H.ankiNormalizeConditionTags([mapped],snapshot);
  t('normalization does not silently join or delete a stray tag word',normalized.cards[0].tags===mapped.tags&&H.lintAnkiCard(normalized.cards[0]).includes('tag-format'));
  const alias={...good,tags:'Condition::PD Tier::1',factIds:['fact-1'],mappingIssues:[]};
  const repaired=H.ankiNormalizeConditionTags([alias],snapshot).cards[0];
  t('proven alias repair preserves format scope and valid hierarchy',repaired.tags==='Condition::PanicDisorder Tier::1'&&repaired.tagFormatContract==='hierarchical-v1'&&H.lintAnkiCard(repaired).length===0);
  const unknown={...alias,tags:'Condition::NotAnAlias Tier::1'};
  t('unknown alias remains an advisory condition finding rather than a tag-format error',H.ankiConditionTagCheck(unknown,snapshot).code==='non-alias-condition'&&H.lintAnkiCard(unknown).length===0);
  const batch={snapshot,chunkIds:[['fact-1']]};
  const auditGroups=H.ankiAuditGroups([mapped,{...good,factIds:['fact-1'],mappingIssues:[]}],batch,'all',4);
  const captured=auditGroups[0].notes.find(n=>n.id===mapped.id),wire=H.ankiAuditPacket(auditGroups[0]);
  t('audit capture retains format scope and structural exclusion',captured.tagFormatContract==='hierarchical-v1'&&!captured.structurallyValid&&!captured.eligible&&!auditGroups[0].scopeNoteIds.includes(mapped.id));
  t('audit capture retains the invalid note as visible source context',auditGroups[0].notes.some(n=>n.id===mapped.id)&&auditGroups[0].notes.length===2);
  t('wire packet retains the same captured contract and eligibility',wire.notes[0].tagFormatContract==='hierarchical-v1'&&wire.notes[0].eligible===false&&wire.notes[1].eligible===true);
  const evidenceAnchor='  const cards=(run.cards||Array.from(new Map(groups.flatMap(g=>g.notes).map(n=>[n.id,n])).values())).map(c=>';
  const evidenceAt=S.indexOf(evidenceAnchor),evidenceEnd=S.indexOf('\n',evidenceAt);
  if(evidenceAt<0||evidenceEnd<0||S.indexOf(evidenceAnchor,evidenceAt+evidenceAnchor.length)>=0)throw new Error('Anki evidence card projection anchor moved.');
  const evidenceSource=S.slice(evidenceAt,evidenceEnd);
  if(!evidenceSource.endsWith('));'))throw new Error('Anki evidence card projection is no longer a complete declaration.');
  const evidenceCards=new Function('run','groups',evidenceSource+';return cards;')({cards:[mapped]},auditGroups);
  t('private evidence note projection preserves the scope used for its hash',evidenceCards[0].tagFormatContract==='hierarchical-v1'&&evidenceCards[0].tags===mapped.tags&&evidenceCards[0].keep);
  const fallbackCards=new Function('run','groups',evidenceSource+';return cards;')({},auditGroups);
  t('private evidence fallback from captured groups preserves the scope',fallbackCards.every(c=>c.tagFormatContract==='hierarchical-v1'));
  t('scoped and ungoverned notes keep distinct contract evidence',new Function('run','groups',evidenceSource+';return cards;')({cards:[good,parse(tags,null)]},[]).map(c=>c.tagFormatContract).join(',')==='hierarchical-v1,');
}

module.exports={runAnkiTagFormatTests};
