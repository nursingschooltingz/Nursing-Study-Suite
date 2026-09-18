'use strict';

// Synthetic, offline acceptance of the shipped text-only Anki transforms.
// The CLI accepts --source <path> for reviewing an exact in-memory patch artifact.
function runAnkiIntegrityTransformRegression({S,t,section}){
  if(section)section('v16.7 Anki transform integrity');
  const span=(a,b)=>{const i=S.indexOf(a),j=S.indexOf(b,i+a.length);if(i<0||j<=i||S.indexOf(a,i+1)>=0)throw Error('Anki integrity extraction moved: '+a);return S.slice(i,j);};
  let sequence=0;
  const names=['ankiParseCards','attachCoverageToCards','ankiSourceSnapshot','ankiDedupeCards','ankiNormalizeConditionTags','lintAnkiCard','ankiSelection','ankiNumericTokens','ankiNumericAudit','ankiPreviewText','ankiExportText','ankiConditionTagDiagnostics','ankiReviewDecisionEvidence'];
  const H=new Function('uid',span('function ankiParseCards(raw','function AnkiStyleBadges')+';return {'+names.join(',')+'};')(()=> 'integrity-note-'+(++sequence));
  const tags='Nursing::LATTE::Treatments Condition::DiabetesMellitus Tier::1';
  const row=(text,extra='',tag=tags)=>text+'|'+extra+'|'+tag;
  const response=(lines,ledger='fact-1 -> line #1')=>'```text\n'+lines+'\n```\n```text\n'+ledger+'\n```';
  const kb={conditions:[{name:'Diabetes Mellitus',aliases:['DM'],facts:[{id:'fact-1',text:'Do not administer the synthetic intervention. Value -5°C; amount 5 mg; length 5 cm.',sourceQuote:'Amount 7 mg appears only here.',tier:1,latteBucket:'Treatments',sources:[{filename:'Synthetic.txt',location:'line 1'}]},{id:'fact-2',text:'Synthetic second fact.',sourceQuote:'Synthetic second fact.',tier:1,latteBucket:'Treatments',sources:[]}]}]};
  const snapshot=H.ankiSourceSnapshot(kb),batch={snapshot};
  function mapped(raw){const value=H.ankiParseCards(raw,1,'hierarchical-v1');value.mappingIssues=H.attachCoverageToCards(value.cards,[{chunk:1,text:value.ledger}],snapshot,[['fact-1','fact-2']]);return value;}
  const broken=mapped(response('Do not\n'+row('{{c1::administer the synthetic intervention}}.'),'fact-1 -> line #1'));
  t('A1 preserves the complete generated prohibition as two inspectable physical records',broken.cards.length===2&&broken.cards[0].text==='Do not'&&broken.cards[1].text==='{{c1::administer the synthetic intervention}}.');
  t('A1 physical addresses cannot silently move the first fact to its affirmative remainder',broken.cards[0].sourceLine===1&&broken.cards[1].sourceLine===2&&broken.cards[0].factIds.join()==='fact-1'&&broken.cards[1].factIds.length===0);
  t('A1 both sides of an unpiped boundary remain ineligible',broken.cards.every(c=>H.lintAnkiCard(c).includes('parse-boundary'))&&H.ankiSelection(broken.cards).kept.length===0);
  t('A1 export cannot drop a prohibition while retaining its affirmative remainder',H.ankiExportText(broken.cards,batch,true,'all',false,false)==='');
  t('A1 original raw lines and issues survive for manual source review',broken.cards[0].parseProvenance[0].rawText==='Do not'&&broken.cards[1].parseProvenance[0].parseIssues.includes('adjacent-unpiped-line'));
  const missing=mapped(response('{{c1::first unpiped note}}\n'+row('Second {{c1::note}}'),'fact-1 -> line #1\nfact-2 -> line #2'));
  t('A1 missing delimiters do not shift ledger associations',missing.cards.length===2&&missing.cards[0].factIds.join()==='fact-1'&&missing.cards[1].factIds.join()==='fact-2');
  const spaced=mapped(response(row('First {{c1::note}}')+'\n\n'+row('Second {{c1::note}}'),'fact-1 -> line #1\nfact-2 -> line #3'));
  t('A1 blank physical lines preserve raw ledger addresses',spaced.cards.length===2&&spaced.cards[1].sourceLine===3&&spaced.cards[1].factIds.join()==='fact-2');
  t('A1 blank separators do not create an ambiguous note boundary',spaced.cards.every(c=>H.lintAnkiCard(c).length===0));
  for(const separator of ['\n\n','\n \t \n','\r\n\r\n']){
    const separated=mapped(response('Do not'+separator+row('{{c1::administer the synthetic intervention}}.'),'fact-1 -> line #3'));
    t('A1 whitespace cannot detach a prohibition from its affirmative remainder: '+JSON.stringify(separator),separated.cards.length===2&&separated.cards[1].sourceLine===3&&separated.cards[1].factIds.join()==='fact-1'&&H.lintAnkiCard(separated.cards[1]).includes('parse-boundary'));
    t('A1 whitespace-separated prohibition never exports as an affirmative note: '+JSON.stringify(separator),H.ankiExportText(separated.cards,batch,true,'all',false,false)==='');
  }
  const suffix=mapped(response(row('Avoid {{c1::the synthetic intervention}}.')+'\n \t\nexcept under the supplied condition.','fact-1 -> line #1'));
  t('A1 whitespace cannot detach a trailing qualifier from its preceding note',suffix.cards.length===2&&suffix.cards[1].sourceLine===3&&H.ankiSelection(suffix.cards).kept.length===0);
  const unclosed=H.ankiParseCards('```text\nDo not\n\n'+row('{{c1::administer the synthetic intervention}}.')+'\n\nfact-1 -> line #3',1,'hierarchical-v1');
  t('A1 an unclosed fence retains its raw qualifier and ledger fragments without exporting a remainder',unclosed.cards.map(c=>c.sourceLine).join(',')==='1,3,5'&&unclosed.cards[2].text==='fact-1 -> line #3'&&H.ankiSelection(unclosed.cards).kept.length===0);
  const trailing=mapped(response(row('First {{c1::note}}')+'\n{{c1::truncated','fact-1 -> line #1\nfact-2 -> line #2'));
  t('A1 truncated trailing cloze remains visible and source-addressable',trailing.cards.length===2&&trailing.cards[1].text==='{{c1::truncated'&&trailing.cards[1].factIds.join()==='fact-2');
  t('A1 ambiguous suffix also prevents the preceding record exporting alone',H.ankiSelection(trailing.cards).kept.length===0);
  const controlled=mapped(response(row('Do not {{c1::administer the synthetic intervention}}.'),'fact-1 -> line #1'));
  t('A1 well-formed prohibition remains eligible and unchanged',H.ankiSelection(controlled.cards).kept.length===1&&H.ankiExportText(controlled.cards,batch,true,'all',false,false).startsWith('Do not {{c1::administer'));
  t('A9 non-note prose is not fabricated into a parsed card',H.ankiParseCards('I cannot provide cards for this content.').cards.length===0);
  const repaired={...broken.cards[1],text:'Do not {{c1::administer the synthetic intervention}}.',parseIssues:[],pipeCount:2,factIds:['fact-1']};
  t('A1 deliberate repaired text restores eligibility without discarding original evidence',!H.lintAnkiCard(repaired).length&&repaired.keep&&repaired.parseProvenance[0].text.startsWith('{{c1::administer'));
  t('A1 repair preserves a manual exclusion',H.ankiSelection([{...repaired,keep:false}]).kept.length===0);
  t('A1 changing only Tags cannot bypass an unresolved boundary',H.lintAnkiCard({...broken.cards[1],tags:'Tier::2'}).includes('parse-boundary'));
  const card=(text,extra='',changes={})=>({...H.ankiParseCards(row(text,extra)).cards[0],factIds:['fact-1'],mappingIssues:[],...changes});
  const audit=(text,extra='',changes={})=>H.ankiNumericAudit(card(text,extra,changes),batch,true);
  t('A3 Unicode minus and ASCII minus describe the same signed value',audit('Value {{c1::−5°C}}.').status==='No numeric mismatch detected');
  t('A3 positive versus Unicode-negative values disagree',H.ankiNumericAudit(card('Value {{c1::−5°C}}.'),{snapshot:H.ankiSourceSnapshot({conditions:[{name:'Synthetic',facts:[{id:'fact-1',text:'Value +5°C.',sources:[]}]}]})},true).status==='Numeric discrepancy');
  t('A3 removing a source minus sign causes an advisory discrepancy',audit('Value {{c1::5°C}}.').findings.some(f=>f.code==='numeric-discrepancy'));
  for(const unit of ['cm²','cm³','cm^2','cm^3','cm2','cm3','mg/kg²','mg/kg^2']){
    const result=audit('Value {{c1::5 '+unit+'}}.');
    t('A3 entire unsupported exponent unit requires review: '+unit,result.status==='Source review needed'&&result.findings.some(f=>f.code==='unsupported-form')&&H.ankiNumericTokens('5 '+unit).tokens.length===0);
  }
  t('A3 ordinary linear units remain supported',audit('Length {{c1::5 cm}}.').status==='No numeric mismatch detected');
  t('A3 fully captured known denominator m2 is not a linear m prefix',H.ankiNumericTokens('5 mg/m2').tokens[0]?.key==='5 mg/m2');
  t('A3 minus range endpoints preserve their signed identities',H.ankiNumericTokens('−5 to −2 °C').tokens.map(x=>x.key).join(',')==='-5 °c,-2 °c');
  for(const text of ['1/2 mg','1e2 mg','5 cmXYZ','5 mg/kg²/min'])t('A3 unsupported whole forms never donate supported suffix tokens: '+text,H.ankiNumericTokens(text).tokens.length===0&&H.ankiNumericTokens(text).unsupported.length>0);
  const hint=audit('Dose {{c1::5 mg::9 mg}}.');
  t('A4 unsupported visible hint value has its own advisory finding',hint.findings.some(x=>x.code==='hint-numeric-discrepancy')&&hint.status==='Source review needed'&&hint.checked===1&&hint.hintChecked===1);
  t('A4 hint-only mismatch does not become a revealed-answer mismatch',!hint.findings.some(x=>x.code==='numeric-discrepancy'));
  t('A4 hint warnings never change structural eligibility or Keep',H.ankiSelection([card('Dose {{c1::5 mg::9 mg}}.')]).kept.length===1);
  t('A4 supported visible hint remains advisory-clean',audit('Dose {{c1::5 mg::5 mg}}.').status==='No numeric mismatch detected');
  t('A4 quote-only hint is distinguished from fact support',audit('Dose {{c1::5 mg::7 mg}}.').findings.some(x=>x.code==='hint-quote-only'));
  t('A4 unsupported exponent in a hint requires source review',audit('Dose {{c1::5 mg::5 cm²}}.').findings.some(x=>x.code==='hint-unsupported-form'));
  t('A4 Extra-field hints receive the same separate inspection',audit('Dose {{c1::5 mg}}.','Context {{c1::5 mg::9 mg}}.').findings.some(x=>x.code==='hint-numeric-discrepancy'));
  t('A4 separate hints cannot manufacture a supported number-unit pair',audit('Dose {{c1::5 mg::9}} and {{c2::5 mg::mg}}.').findings.some(x=>x.code==='hint-unsupported-form'));
  t('A4 missing source links retain the established Not checked result',audit('Dose {{c1::5 mg::9 mg}}.','',{factIds:[]}).status==='Not checked');
  const left=card('Synthetic {{c1::same target}}.','',{tags:tags.replace('DiabetesMellitus','DM'),sourceLine:1}),right=card('Synthetic {{c1::same target}}.','',{factIds:['fact-2'],sourceLine:2});
  const originalBytes=JSON.stringify([left,right]),normalized=H.ankiNormalizeConditionTags(H.ankiDedupeCards([left,right]),snapshot),merged=H.ankiDedupeCards(normalized.cards);
  t('N1 pre-normalization exact dedupe preserves distinct alias tag bytes',H.ankiDedupeCards([left,right]).length===2);
  t('N1 final exact pass merges only after the proven alias normalized',normalized.cards.length===2&&merged.length===1&&merged[0].tags===tags);
  t('N1 final exact merge unions mapped facts',merged[0].factIds.join(',')==='fact-1,fact-2');
  t('N1 merged records retain every original id and address',merged[0].mergedNoteIds.join(',')===left.id+','+right.id&&merged[0].sourceLocations.map(x=>x.sourceLine).join(',')==='1,2');
  t('N1 original addresses retain their separate mapped-fact provenance',merged[0].sourceLocations[0].factIds.join()==='fact-1'&&merged[0].sourceLocations[1].factIds.join()==='fact-2');
  t('N1 merged records retain original parsed fields and alias normalization',merged[0].parseProvenance.length===2&&merged[0].conditionTagNormalizations.length===1&&merged[0].conditionTagNormalizations[0].before.includes('Condition::DM'));
  t('N1 generation normalization outcomes remain independent original-note evidence',normalized.outcomes.length===2&&normalized.outcomes[0].status==='repaired'&&normalized.outcomes[1].status==='canonical');
  t('N1 exact merge leaves the source cards unmodified',JSON.stringify([left,right])===originalBytes);
  merged[0].parseProvenance[0].rawText='Edited diagnostic';merged[0].conditionTagNormalizations[0].factIds.push('fact-999');
  t('N1 returned provenance arrays do not alias original parsed or normalized records',left.parseProvenance[0].rawText!=='Edited diagnostic'&&normalized.cards[0].conditionTagNormalization.factIds.join()==='fact-1');
  const final=H.ankiDedupeCards(normalized.cards);
  t('N1 exactly one final row is exported after alias normalization',H.ankiExportText(final,batch,true,'all',false,false).split('\n').length===1);
  t('N1 repeated exact merge preserves id and provenance inventories',H.ankiDedupeCards(final)[0].mergedNoteIds.length===2&&H.ankiDedupeCards(final)[0].parseProvenance.length===2);
  t('N1 manually different Keep choices remain separate',H.ankiDedupeCards([normalized.cards[0],{...normalized.cards[1],keep:false}]).length===2);
  t('N1 invalid parsed boundaries never collapse',H.ankiDedupeCards([broken.cards[1],{...broken.cards[1],id:'other'}]).length===2);
  t('N1 near duplicate Text and different Extra remain separate',H.ankiDedupeCards([right,{...right,id:'different-text',text:right.text+' '},{...right,id:'different-extra',extra:'Supplied context.'}]).length===3);
  t('N1 explicit merge retains source-link history and pending review',H.ankiDedupeCards([{...right,sourceLinkEdits:[{reason:'first'}]},{...right,id:'manual',sourceLinkEdits:[{reason:'second'}],sourceLinksNeedReview:true}])[0].sourceLinkEdits.length===2&&H.ankiDedupeCards([right,{...right,id:'manual',sourceLinksNeedReview:true}])[0].sourceLinksNeedReview===true);
  t('N1 actual generation runs final exact dedupe after alias normalization',S.includes('deduped=ankiDedupeCards(normalized.cards)'));
  const tail=H.ankiReviewDecisionEvidence([{key:'key',noteIds:[],factIds:[],disposition:'intentional-context',scope:{tier:'all'}}],[],{current:false},null);
  t('transform extraction reaches manual review decision evidence at its live tail',tail.length===1&&tail[0].current===false&&tail[0].tier==='all');
}
module.exports={runAnkiIntegrityTransformRegression};
if(require.main===module){
  const fs=require('fs'),path=require('path'),args=process.argv.slice(2),i=args.indexOf('--source');
  const filename=i>=0?args[i+1]:require('./repo-checks').resolveSuiteFile({rootDir:process.cwd()});
  if(!filename)throw Error('Missing source path');
  let pass=0,fail=0;
  runAnkiIntegrityTransformRegression({S:fs.readFileSync(path.resolve(filename),'utf8'),t:(name,ok)=>{if(ok)pass++;else fail++;console.log((ok?'PASS ':'FAIL ')+name);}});
  console.log('Anki transform integrity: '+pass+' passed, '+fail+' failed.');if(fail)process.exitCode=1;
}
