'use strict';

// v17.9: the NCLEX to Anki tab ports nclex2anki.py, img2anki.py and extract2anki.py into the suite.
// v17.10: the two text converters also read the Generator and Extractor PDF exports.
// v17.11: they are one option, and the PDF reader handles what two real worksheets showed.
// These assertions run the shipped converter functions on synthetic exports shaped like the
// suite's own NCLEX Generator and Extractor downloads, and on fake Gemini transcripts.

const crypto=require('crypto');

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('NCLEX to Anki anchor missing: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('NCLEX to Anki end anchor missing after: '+start);
  return S.slice(a,b);
}

const WORKSHEET=`# NCLEX Practice Questions

**2 questions** generated from source material.

---

## Questions

1. A client with heart failure has a potassium of 3.1 mEq/L. Which action should the nurse take first?
     A. Give the scheduled furosemide
     B. Hold digoxin and notify the provider
     C. Encourage oral fluids
     D. Recheck in the morning

2. Which findings indicate fluid overload? Select all that apply.
     A. Crackles in the lungs
     B. Weight gain of 2 kg in 2 days
     C. Poor skin turgor
     D. Jugular venous distension
     E. Concentrated urine

<div class="pagebreak"></div>

## Answer Key

1. ANSWER: B
     Why A is wrong: Furosemide lowers potassium further. (Source: C2)
     Why B is correct: Hypokalemia raises "digoxin" toxicity risk. (Source: C1 — "low potassium increases digoxin toxicity")
     Why C is wrong: Fluids do not correct potassium. (Source: C3)
     Why D is wrong: Delays care. (Source: C3)
     Strategy: Safety first.
     Tags: Tier 1 | Recognize Cues | Cardiac::HF

2. ANSWER: A, B, and D
     Why A is correct: Crackles mean fluid in alveoli. (Source: C4)
     Why B is correct: Rapid gain is fluid. (Source: C4)
     Why C is wrong: Poor turgor is deficit. (Source: C5)
     Why D is correct: JVD means overload. (Source: C4)
     Why E is wrong: Deficit. (Source: C5)
     Tags: Tier 2`;

const EXTRACT_MD=`# NCLEX Practice Questions

**2 questions** extracted from source material.

> Extraction status: complete

---

## Questions

**1.** The nurse is caring for a client after thyroidectomy. Which finding requires immediate action?

1. Hoarse voice
2. Tingling around the mouth
3. Incisional pain 4/10
4. Temperature 99.1 F.

**2.** A nurse is teaching about warfarin. Which food should the client keep consistent?

A. Spinach
B. Bananas
C. Oranges
D. Milk

<div class="pagebreak"></div>

## Answer Key

**1.** 2. Tingling around the mouth

Tingling signals hypocalcemia. TEST-TAKING HINT: Think airway and calcium.

> ⚡ **Tip:** Check Chvostek sign.

> 🧠 **CJ:** Recognize Cues

Conditions: Thyroidectomy, Hypocalcemia

---

**2.** A

Vitamin K intake should stay consistent.

---
`;

const EXTRACT_TXT=`NCLEX PRACTICE QUESTIONS

1 questions

1. Which client should the nurse see first?
   A. Client with COPD and SpO2 90%
   B. Client with chest pain 8/10
   C. Client needing discharge teaching
   D. Client with a stable fracture


============================
ANSWER KEY
============================

1. Answer: B. Client with chest pain 8/10
Rationale: Option A is incorrect; 90% is acceptable in COPD. Option B is correct; chest pain may be MI. Option C is incorrect; not urgent. Option D is incorrect; stable.
Strategy: ABCs.
Conditions: MI

---
`;

async function run(S,t){
  const tabs=span(S,'const TOOLS=[','];');
  t('NCLEX to Anki is a practice-stage tab',tabs.includes("{id:'nclex2anki',stage:'practice',label:'NCLEX to Anki',"));
  const components=S.match(/const TOOL_COMPONENTS=\{([^}]*)\}/);
  t('the NCLEX to Anki tab is a memoized tool component',!!components&&components[1].includes('nclex2anki:React.memo(NCLEXToAnki)'));
  const core=span(S,'// ──── TOOL: NCLEX to Anki ────','async function i2aFileKey(');
  const ui=span(S,'async function i2aFileKey(','/* ═══════════════════════════════════════════════════════\n   CONFIG SIDEBAR');
  const M=new Function(core+';return {n2aSha1Hex,n2aGuidBasis,n2aEsc,n2aConvertSources,n2aAnkiFileText,x2aConvertSources,x2aResolveAnswer,i2aNormalizeTranscript,i2aAssemble,i2aBuildCards,i2aConvert,i2aGuid,i2aNaturalCompare,i2aMergeCache,i2aEmptyCache,I2A_TRANSCRIBE_PROMPT,I2A_PROMPT_VERSION,n2aPdfPageLines,n2aPdfBlocks,n2aPdfChoiceLines,n2aPdfToWorksheetText,x2aPdfToExportText,n2aConvertExports,n2aExportKind,n2aConvertText,n2aKeyFit,n2aParseQuestion,n2aParseKey};')();

  t('the converter SHA-1 matches Node crypto on ASCII, Unicode and multi-block input',
    ['','abc','é ünïcode ✓ 🧠','x'.repeat(55),'y'.repeat(64),'z'.repeat(1000)].every(s=>M.n2aSha1Hex(s)===crypto.createHash('sha1').update(s,'utf8').digest('hex')));
  t('the GUID basis collapses the \\x1f field separator as Python whitespace',M.n2aGuidBasis(' Stem  Here\x1fA one\x1fB two\x1f')==='stem here a one b two');
  t('card text is escaped like html.escape(quote=True)',M.n2aEsc(`a<b>&"c"'d'\n\te`)==='a&lt;b&gt;&amp;&quot;c&quot;&#x27;d&#x27;<br> e');

  const ws=M.n2aConvertSources([{name:'worksheet',text:WORKSHEET}],['exam2']);
  t('a Generator worksheet converts every question with no warnings',ws.cards.length===2&&ws.warnings.length===0);
  t('worksheet tags carry Tier, CJMM, hierarchical tags, type, source and extra tags',
    ws.cards[0].tags.join(' ')==='Tier::1 CJMM::Recognize_Cues Cardiac::HF NCLEX_Type::MCQ Source::worksheet exam2'&&ws.cards[1].tags.includes('NCLEX_Type::SATA'));
  const back=ws.cards[0].back;
  t('the back marks every choice and keeps the anchor quote but drops C-numbers',
    back.includes('<b>✓ B.</b> Hold digoxin')&&(back.match(/<b>✗ /g)||[]).length===3&&back.includes('Source: “low potassium increases digoxin toxicity”')&&!/\(Source: C\d/.test(back));
  t('an Oxford-comma SATA answer keys all three choices',(ws.cards[1].back.match(/<b>✓ /g)||[]).length===3);
  const file=M.n2aAnkiFileText(ws.cards,'NCLEX::Cardiac',true),rows=file.split('\n');
  t('the Anki file presets separator, HTML, note type, deck, tags and GUID columns',
    rows.slice(0,6).join('|')==='#separator:tab|#html:true|#notetype:Basic|#deck:NCLEX::Cardiac|#tags column:3|#guid column:4'&&rows[6].split('\t').length===4&&file.endsWith('\n'));
  t('worksheet fields carry no raw double quote for Anki to parse as CSV quoting',!rows.slice(6).join('').includes('"'));
  t('worksheet GUIDs are stable n2a hashes',ws.cards.every(c=>/^n2a[0-9a-f]{20}$/.test(c.guid))&&M.n2aConvertSources([{name:'other',text:WORKSHEET}]).cards[0].guid===ws.cards[0].guid);
  const failed=M.n2aConvertSources([{name:'w',text:'> FAILED VALIDATION\n'+WORKSHEET}]);
  t('a FAILED VALIDATION stamp tags every card NeedsReview',failed.cards.every(c=>c.tags.includes('NeedsReview'))&&failed.warnings.some(w=>w.includes('FAILED VALIDATION')));
  const disagree=M.n2aConvertSources([{name:'w',text:WORKSHEET.replace('1. ANSWER: B','1. ANSWER: C')}]);
  t('a key that disagrees with its rationale lines is flagged',disagree.cards[0].tags.includes('NeedsReview')&&disagree.warnings.some(w=>w.includes('disagrees with ANSWER C')));
  const twice=M.n2aConvertSources([{name:'a',text:WORKSHEET},{name:'b',text:WORKSHEET}]);
  t('the same question in two inputs is kept once',twice.cards.length===2&&twice.warnings.some(w=>w.includes('2 duplicate question(s)')));
  t('a file with no Answer Key heading yields a warning, not cards',M.n2aConvertSources([{name:'x',text:'1. A question'}]).warnings[0].includes("no 'Answer Key' heading"));
  t('the worksheet converter also reads an Extractor export',M.n2aConvertSources([{name:'md',text:EXTRACT_MD}]).cards.length===2);

  const xmd=M.x2aConvertSources([{name:'nclex_questions',text:EXTRACT_MD}]);
  t('an Extractor .md converts with conditions and CJ as tags',xmd.cards.length===2&&xmd.warnings.length===0&&
    xmd.cards[0].tags.join(' ')==='Condition::Thyroidectomy Condition::Hypocalcemia CJMM::Recognize_Cues NCLEX_Type::MCQ Source::nclex_questions');
  t('the Extractor back keys the numbered choice and moves book metadata to the bottom',
    xmd.cards[0].back.includes('Answer: 2. Tingling around the mouth')&&xmd.cards[0].back.includes('⚡ Tip:</b> Check Chvostek sign.')&&
    xmd.cards[0].back.indexOf('TEST-TAKING HINT')>xmd.cards[0].back.indexOf('🧠 CJ:'));
  t('Extractor GUIDs use the x2a prefix and its file is not quote-rewritten',xmd.cards.every(c=>/^x2a[0-9a-f]{20}$/.test(c.guid))&&M.n2aAnkiFileText(xmd.cards,'D',false).includes("style='"));
  const xtxt=M.x2aConvertSources([{name:'q',text:EXTRACT_TXT}]);
  t('an Extractor .txt rationale written per option is split onto every choice',
    xtxt.cards.length===1&&(xtxt.cards[0].back.match(/<b>✗ /g)||[]).length===3&&xtxt.cards[0].back.includes('Option B is correct; chest pain may be MI.'));
  t('pasted Copy output converts like the .md download',M.x2aConvertSources([{name:'clipboard',text:EXTRACT_MD}]).cards.length===2);
  const opts=[['1','One'],['2','Two'],['3','Three'],['4','Four']];
  const mapped=M.x2aResolveAnswer('B',opts);
  t('a letter key on number-labelled choices is mapped but marked untrusted',mapped[0].join()==='2'&&mapped[2]===false&&mapped[1].includes('mapped to 2'));
  const textOnly=M.x2aResolveAnswer('The correct answer is Three',opts);
  t('an answer given as choice text resolves to its label',textOnly[0].join()==='3'&&textOnly[2]===true);
  const incomplete=M.x2aConvertSources([{name:'q',text:EXTRACT_MD.replace('Extraction status: complete','Extraction status: incomplete (2 of 5 chunks)')}]);
  t('an incomplete extraction status is reported',incomplete.warnings.some(w=>w.includes('was not complete')));

  const t1=M.i2aNormalizeTranscript({items:[{kind:'question',number:'Q12',format:'multiple_choice',stem:'Which is first?',options:[{label:'A.',text:'One'},{label:'B',text:'Two'},{label:'C',text:'Three'},{label:'D',text:'Four'}],answer:null,cut_off:true,legibility:'clean'}]});
  const t2=M.i2aNormalizeTranscript({items:[{kind:'continuation',answer:'B',answer_evidence:'printed',option_rationales:[{label:'B',verdict:'correct',text:'Because.'}],rationale:'Two wins.',legibility:'clean'},{kind:'question',number:'13',stem:'Calc?',format:'fill_in',legibility:'clean'},{kind:'answer_only',number:'13',answer:'12 mL',legibility:'clean'}]});
  t('transcript normalization strips label punctuation and printed-number prefixes',t1[0].options[0][0]==='A'&&t1[0].number==='12');
  const asm=M.i2aAssemble([['shot 1.png',t1],['shot 2.png',t2]]);
  t('a question cut off on one image is finished by the next image',asm.questions[0].answer==='B'&&asm.questions[0].images.join()==='shot 1.png,shot 2.png'&&asm.questions[0].cut_off===false);
  t('an answer-key entry is matched to its question by printed number',asm.questions[1].answer==='12 mL'&&asm.warnings.length===0);
  const built=M.i2aBuildCards(asm.questions,'Saunders',['x']);
  t('image cards carry type, source and extra tags, and an answer-only card is tagged NoRationale',
    built.cards[0].tags.join(' ')==='NCLEX_Type::MCQ Source::Saunders x'&&built.cards[1].tags.includes('NoRationale')&&built.cards[0].back.includes('From: shot 1.png, shot 2.png'));
  const unreadable=M.i2aBuildCards(M.i2aAssemble([['p.png',M.i2aNormalizeTranscript({items:[{kind:'question',stem:'Give [?] mg',format:'fill_in',answer:'5 mg',legibility:'clean'}]})]]).questions,'');
  t('an unreadable number marks the card NeedsReview',unreadable.cards[0].tags.includes('NeedsReview')&&unreadable.warnings.some(w=>w.includes('could not read everything')));
  const sameQ={stem:'A client with heart failure has a potassium of 3.1 mEq/L. Which action should the nurse take first?',options:[['A','Give the scheduled furosemide'],['B','Hold digoxin and notify the provider'],['C','Encourage oral fluids'],['D','Recheck in the morning']]};
  t('the same question imported from images and from a worksheet shares one GUID',M.i2aGuid(sameQ)===ws.cards[0].guid);
  t('images are read in natural file-name order',['shot 10.png','shot 2.png','Shot 1.png'].sort(M.i2aNaturalCompare).join()==='Shot 1.png,shot 2.png,shot 10.png');

  const cache=M.i2aEmptyCache();let calls=0;
  const gemini=async parts=>{calls++;if(parts.length===2)return {items:[{kind:'question',number:'1',stem:'Q one?',options:[{label:'A',text:'a1'},{label:'B',text:'b1'},{label:'C',text:'c1'}],legibility:'clean'}]};
    const id=parts[0].text.match(/id: (\w+)/)[1];return {answers:[{id,answer:'C',option_rationales:[{label:'A',verdict:'incorrect',text:'no'},{label:'B',verdict:'incorrect',text:'no'},{label:'C',verdict:'correct',text:'yes'}],rationale:'r',agrees_with_key:null}]};};
  const imgs=[{name:'a.png',key:'k1',payload:async()=>({mimeType:'image/png',data:'xx'})}];
  let res=await M.i2aConvert({images:imgs,gemini,halts:()=>false,model:'m',cache,deck:'NCLEX'});
  t('a question the images never answer is skipped unless AI answers are on',res.cards.length===0&&res.needsAi===1&&calls===1);
  res=await M.i2aConvert({images:imgs,gemini,halts:()=>false,model:'m',cache,deck:'NCLEX',aiAnswers:true});
  t('a cached image is not sent again and an AI answer is labelled and tagged',calls===2&&res.cards.length===1&&res.ai===1&&res.cards[0].tags.includes('AI_Answer')&&res.cards[0].back.includes('AI-generated answer'));
  const quota=Object.assign(new Error('quota'),{status:429});
  res=await M.i2aConvert({images:[...imgs,{name:'b.png',key:'k2',payload:async()=>({})}],gemini:async()=>{throw quota;},halts:e=>e.status===429,model:'m',cache,deck:'NCLEX',aiAnswers:true});
  t('a quota stop names the image it stopped at and keeps finished transcripts',/Stopped at b\.png; 1 image\(s\) left/.test(res.stopped||'')&&res.warnings[0]===res.stopped&&Object.keys(cache.images).length===1);
  const merged=M.i2aEmptyCache();
  t('a saved transcripts file loads back into the cache',M.i2aMergeCache(merged,JSON.parse(JSON.stringify(cache)))===1&&Object.keys(merged.ai).length===1);
  t('the transcription prompt is the script prompt, versioned for cache keys',M.I2A_PROMPT_VERSION==='t1'&&M.I2A_TRANSCRIBE_PROMPT.startsWith('You are transcribing NCLEX-style practice questions from ONE image')&&M.I2A_TRANSCRIBE_PROMPT.includes('2. NEVER GUESS A NUMBER.'));
  t('image runs reuse the shared Gemini transport, halt rule and JSON parser',ui.includes('callGemini(cfg.apiKey,model,parts,{')&&ui.includes('halts:geminiHaltsBatch')&&ui.includes('extractJSON(text)'));
  t('card previews are sanitized before rendering',(ui.match(/dangerouslySetInnerHTML/g)||[]).length===2&&(ui.match(/DOMPurify\.sanitize\(c\.(front|back),N2A_CARD_POLICY\)/g)||[]).length===2);

  // v17.10: PDF exports. The fixture is the line geometry pdf.js read from synthetic Generator and
  // Extractor exports printed by headless Chrome from the suite's own print document, with and
  // without the browser's header and footer. A PDF must give the same cards as its .md source.
  const FX=require('./fixtures/nclex-to-anki-pdf.json');
  const blocksOf=name=>M.n2aPdfBlocks(FX.pdfs[name].map(page=>page.map(([x,y,fs,text])=>({x,y,fs,text}))));
  const same=(a,b,loose=()=>false)=>a.cards.length===b.cards.length&&a.cards.every((c,i)=>{const o=b.cards[i];return c.guid===o.guid&&c.back===o.back&&c.tags.join(' ')===o.tags.join(' ')&&(c.front===o.front||loose(i,c,o));});
  const viaPdf=(name,adapter,conv)=>{const r=adapter(blocksOf(name),name);return {r,cards:conv([{name:'s',text:r.text}])};};
  const lines=M.n2aPdfPageLines([{str:'1.',transform:[10,0,0,10,42,700],width:8},{str:' A client',transform:[10,0,0,10,50,700],width:40},{str:'next line',transform:[10,0,0,10,53,685],width:40},{str:'',transform:[10,0,0,10,0,0]}]);
  t('pdf.js items on one baseline join into one line and a lower baseline starts the next',lines.length===2&&lines[0].text==='1. A client'&&lines[0].x===42&&lines[1].text==='next line');
  const hf=blocksOf('bigws-hf.pdf');
  t("the browser's date/title header and URL/page footer are dropped",hf.length>0&&!hf.some(b=>/127\.0\.0\.1|\d{1,2}:\d{2}\s*[AP]M|^\d+\/\d+$/.test(b.text))&&hf.some(b=>b.heading&&b.text==='Answer Key'));
  t('each worksheet question and key entry is one block, including two-digit numbers on a later page',
    [1,2,3,4,5,6,7,8,9,10,11,12].every(n=>hf.filter(b=>new RegExp('^'+n+'\\. (?!ANSWER)').test(b.text)).length===1&&hf.filter(b=>new RegExp('^'+n+'\\. ANSWER:').test(b.text)).length===1));
  const wsMd=M.n2aConvertSources([{name:'s',text:FX.md['bigws.md']}]);
  for(const name of ['bigws-hf.pdf','bigws-clean.pdf']){
    const {r,cards}=viaPdf(name,M.n2aPdfToWorksheetText,M.n2aConvertSources);
    t('a 12-question Generator PDF ('+name+') gives the same cards as its .md: choices, Why lines, ordering steps, calculations, tags and the FAILED VALIDATION flag',
      r.warnings.length===0&&cards.cards.length===12&&same(cards,wsMd)&&cards.cards.filter(c=>c.tags.includes('NeedsReview')).length===12&&cards.cards[2].back.includes('1. Aortic area')&&cards.cards[3].front.includes('Answer: ______ mL/hr'));
  }
  const small=viaPdf('ws-hf.pdf',M.n2aPdfToWorksheetText,M.n2aConvertSources).cards,smallMd=M.n2aConvertSources([{name:'s',text:FX.md['ws.md']}]);
  t('line breaks a PDF cannot carry (a lab list inside a stem) are the only front-side difference',
    same(small,smallMd,(i,c,o)=>i===3&&c.front===o.front.replace(/<br>/g,' '))&&small.cards[3].front!==smallMd.cards[3].front);
  const bxMd=FX.md['bigx.md'];
  const bx=viaPdf('bigx-hf.pdf',M.x2aPdfToExportText,M.x2aConvertSources);
  t('an Extractor PDF gives the same cards as its .md: numbered and inline choices, per-choice rationales, tips, CJ and conditions',
    bx.r.warnings.length===0&&bx.cards.warnings.length===0&&bx.cards.cards.length===10&&same(bx.cards,M.x2aConvertSources([{name:'s',text:bxMd}])));
  t('a paragraph split by a page break is read as one paragraph',same(bx.cards,M.x2aConvertSources([{name:'s',text:bxMd}]))&&!bx.cards.cards.some(c=>/finding<br>reflects/.test(c.back)));
  t('the Extractor .txt rebuilt from a PDF keeps its status line and question count',/^Extraction status: complete$/m.test(bx.r.text)&&/^10 questions$/m.test(bx.r.text));
  const bx1=viaPdf('bigx-hf.pdf',M.n2aPdfToWorksheetText,M.n2aConvertSources);
  t('an Extractor PDF given to the first converter reads as the Extractor layout',same(bx1.cards,M.n2aConvertSources([{name:'s',text:bxMd}])));
  t('an Extractor PDF numbers questions only at the left edge, so numbered choices stay choices',same(viaPdf('x-hf.pdf',M.x2aPdfToExportText,M.x2aConvertSources).cards,M.x2aConvertSources([{name:'s',text:FX.md['x.md']}])));
  const missing=M.n2aPdfToWorksheetText(hf.filter(b=>!/^7\. Place/.test(b.text)),'w.pdf');
  t("questions and answers that cannot be lined up fall back to printed numbers, and every card is marked for review",
    missing.reviewAll===true&&missing.warnings.some(w=>w.includes('11 questions and 12 answers'))&&missing.warnings.some(w=>w.includes('says 12 questions but 11 were found'))&&
    M.n2aConvertExports([{name:'w',text:missing.text,reviewAll:true}]).cards.every(c=>c.tags.includes('NeedsReview')));
  t('a PDF with no text layer is sent to the images option',M.n2aPdfToWorksheetText([],'scan.pdf').warnings[0].includes('no text layer')&&M.x2aPdfToExportText([],'scan.pdf').warnings[0].includes('NCLEX images option'));
  t('a choice-only paragraph splits into one choice per line, and a stem does not',
    (M.n2aPdfChoiceLines('A. Spinach B. Bananas C. Oranges D. Milk')||[]).join('|')==='A. Spinach|B. Bananas|C. Oranges|D. Milk'&&M.n2aPdfChoiceLines('A client needs vitamin A. B. C. D.')===null);

  // v17.11: what two real worksheets showed (reproduced here with synthetic content only).
  const old=viaPdf('old-hf.pdf',M.n2aPdfToWorksheetText,M.n2aConvertSources),oldMd=M.n2aConvertSources([{name:'s',text:FX.md['old.md']}]);
  const printed=blocksOf('old-hf.pdf').filter(b=>/^\d+\.\s/.test(b.text)).map(b=>+b.text.match(/^\d+/)[0]);
  t('a pre-v17.7 PDF whose numbered choices and steps printed as extra list numbers still pairs every question with its own answer',
    printed.join(',')==='1,2,3,4,5,6,7,8,9,1,2,3,4,5,6,7,8'&&/^8\. ANSWER/.test(blocksOf('old-hf.pdf').filter(b=>/ANSWER/.test(b.text)).pop().text)&&old.cards.cards.length===4&&same(old.cards,oldMd)&&!old.r.reviewAll&&old.r.warnings.some(w=>w.includes('exported before v17.7')));
  t('those printed list items come back as numbered choices and numbered ordering steps',
    /<b>✓ 1\.<\/b> Dry mucous membranes/.test(old.cards.cards[1].back)&&old.cards.cards[1].type==='SATA'&&/1\. Perform hand hygiene/.test(old.cards.cards[2].back));
  t('choices printed as a paragraph of their own are read, including one that ends in "by 2."',old.cards.cards[0].type==='MCQ'&&(old.cards.cards[0].front.match(/<b>[A-D]\.<\/b>/g)||[]).length===4);
  t('an older worksheet\'s "CORRECT SEQUENCE:" entry is read as that answer',/Answer: Perform hand hygiene →/.test(old.cards.cards[2].back));
  const page=FX.pdfs['bigws-clean.pdf'].map(p=>p.map(([x,y,fs,text])=>({x,y,fs,text})));
  const other=page.map((p,i)=>[...(i?[]:[{x:36,y:760,fs:9,text:'Generated note in small type'},{x:36,y:747,fs:9,text:'continues at a 9pt line pitch'}]),...p,{x:0,y:780,fs:10,text:'NCLEX-Practice-Questions-12-questions file:///C:/Users/x/suite.html'},{x:0,y:10,fs:10,text:(i+1)+' of '+page.length+' 10/6/2026, 10:01 PM'}]);
  t("another browser's left-edge footer in body-size type, and a small-type note with a tighter pitch, change nothing",
    same(M.n2aConvertSources([{name:'s',text:M.n2aPdfToWorksheetText(M.n2aPdfBlocks(other),'o').text}]),wsMd));
  const deep=page.map(p=>p.map(l=>/^1[0-2]\. /.test(l.text)?{...l,x:30.8,text:l.text.replace(/^1/,'10')}:l));
  t('three-digit list numbers set left of the margin do not move it',M.n2aPdfBlocks(deep).filter(b=>b.indent).length===M.n2aPdfBlocks(page).filter(b=>b.indent).length);

  // A key misnumbered by the Generator: a "not parsed" placeholder at 2, answers for 2-3 printed one
  // number late, and entry 4 printed twice. And an entry printed twice whose second copy is a placeholder.
  // Each question's choices have words of their own (heartant, heartbee...), as real choices do.
  const opt=w=>[w+'ant',w+'bee',w+'cat',w+'dog'];
  const q4=(n,w)=>n+'. Which '+w+' is correct?\n'+opt(w).map((o,i)=>'     '+'ABCD'[i]+'. '+o).join('\n');
  const k4=(n,w,right='A')=>n+'. ANSWER: '+right+'\n'+opt(w).map((o,i)=>'     Why '+'ABCD'[i]+' is '+('ABCD'[i]===right?'correct':'wrong')+': '+o+' explained.').join('\n');
  const words=['heart','lung','kidney','liver','brain'];
  const slip='## Questions\n\n'+words.map((w,i)=>q4(i+1,w)).join('\n\n')+'\n\n## Answer Key\n\n'+[k4(1,'heart'),'2. ANSWER: [not parsed — see Raw view]',k4(3,'lung'),k4(4,'kidney'),k4(4,'liver'),k4(5,'brain')].join('\n\n');
  const fixed=M.n2aConvertText(slip,'w');
  t('a Generator numbering slip (placeholder, answers one number late, a repeated number) is moved back when the rationales confirm it',
    fixed.cards.length===5&&fixed.cards.every((c,i)=>c.back.includes(words[i]+'ant explained'))&&fixed.warnings.some(w=>w.includes('Q2-Q3 were printed one number late'))&&
    [2,3].every(n=>fixed.cards[n-1].tags.includes('NeedsReview'))&&!fixed.cards[0].tags.includes('NeedsReview'));
  // The same shape, but the entries after the placeholder already fit their own questions.
  const noProof=M.n2aConvertText('## Questions\n\n'+words.map((w,i)=>q4(i+1,w)).join('\n\n')+'\n\n## Answer Key\n\n'+[k4(1,'heart'),'2. ANSWER: [not parsed — see Raw view]',k4(3,'kidney'),k4(4,'liver'),k4(4,'liver'),k4(5,'brain')].join('\n\n'),'w');
  t('without that evidence nothing is moved: the placeholder is skipped',noProof.warnings.some(w=>w.includes('Q2: SKIPPED'))&&!noProof.warnings.some(w=>w.includes('printed one number late')));
  const shiftOnly=M.n2aConvertText('## Questions\n\n'+[q4(1,'heart'),q4(2,'lung'),q4(3,'kidney')].join('\n\n')+'\n\n## Answer Key\n\n'+[k4(1,'heart'),k4(2,'kidney'),k4(3,'lung')].join('\n\n'),'w');
  t("an answer whose rationales describe a neighbour's choices is kept but named and marked for review",
    shiftOnly.warnings.some(w=>w.includes('Q2: its rationale lines describe the choices of answer entry 3'))&&shiftOnly.warnings.some(w=>w.includes('Q3: its rationale lines describe the choices of answer entry 2'))&&
    shiftOnly.cards[1].tags.includes('NeedsReview')&&shiftOnly.cards[2].tags.includes('NeedsReview')&&!shiftOnly.cards[0].tags.includes('NeedsReview'));
  const placeholderCopy=M.n2aConvertText('## Questions\n\n'+[q4(1,'heart'),q4(2,'lung')].join('\n\n')+'\n\n## Answer Key\n\n'+[k4(1,'heart'),'1. ANSWER: [not parsed — see Raw view]',k4(2,'lung')].join('\n\n'),'w');
  t('an entry printed twice never uses a "not parsed" copy over a real one',placeholderCopy.cards.length===2&&placeholderCopy.cards[0].back.includes('Answer: A')&&placeholderCopy.warnings.some(w=>w.includes('the copy that has an answer was used')));
  const gap=M.n2aConvertText('## Questions\n\n'+[q4(1,'heart'),q4(2,'lung'),q4(3,'kidney')].join('\n\n')+'\n\n## Answer Key\n\n'+[k4(1,'heart'),k4(3,'kidney')].join('\n\n'),'w');
  t('a missing answer number no longer hides every answer after it',gap.cards.length===2&&gap.cards[1].back.includes('kidneyant explained')&&gap.warnings.some(w=>w.includes('Q2: SKIPPED - no answer key entry')));
  t('an "Order:" line inside a rationale is not read as a new answer',M.n2aConvertText('## Questions\n\n'+q4(1,'heart')+'\n\n## Answer Key\n\n'+k4(1,'heart')+'\n     Order: give the drug after the assessment.','w').cards[0].back.includes('Answer: A'));

  // One converter for both exports.
  t('each export is routed by its own layout',M.n2aExportKind(WORKSHEET)==='worksheet'&&M.n2aExportKind(EXTRACT_MD)==='extract'&&M.n2aExportKind(EXTRACT_TXT)==='extract'&&M.n2aExportKind(blocksOf&&M.n2aPdfToWorksheetText(blocksOf('bigx-hf.pdf'),'x').text)==='extract');
  const mixed=M.n2aConvertExports([{name:'ws',text:WORKSHEET},{name:'x',text:EXTRACT_MD},{name:'t',text:EXTRACT_TXT}]);
  t('mixed Generator and Extractor exports convert together, each with its own card IDs',
    mixed.cards.length===5&&mixed.kinds.map(k=>k.kind+':'+k.cards).join(',')==='worksheet:2,extract:2,extract:1'&&
    mixed.cards.slice(0,2).every(c=>c.guid===ws.cards[mixed.cards.indexOf(c)].guid)&&mixed.cards.slice(2).every(c=>/^x2a/.test(c.guid)));
  t('merged worksheet cards carry no raw double quote, so one Anki file serves both kinds',!M.n2aAnkiFileText(mixed.cards,'D',false).split('\n').slice(6).join('').includes('"'));
  t('the tab offers one export option beside the image option, and reads PDFs through the shared page walk',
    /const N2A_MODES=\[\n  \{id:'export',/.test(ui.slice(0,0)+S)&&!S.includes("{id:'extract',icon:")&&ui.includes('accept=".md,.txt,.markdown,.pdf"')&&ui.includes('n2aConvertExports(sources,extraTags)')&&
    ui.includes("if(/\\.pdf$/i.test(f.name||'')){")&&core.includes('await pdfWalkPages(file,{onPage:async(text,i,pg)=>')&&core.includes('finally{destroyPdfDoc(file);}'));
}

module.exports=run;
