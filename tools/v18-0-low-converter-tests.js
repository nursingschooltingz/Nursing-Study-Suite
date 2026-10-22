'use strict';

// v18.0: step 10 of the v17.14 production review, Low findings (converter group). Synthetic data only.
// L25 a bare CR in a card field; L26 U+FEFF and GUID parity with the Python scripts; L28 12-hour screenshot names;
// L29 a repeated answer-key number. L30 needed no change; n2aConvertSources/x2aConvertSources stay (see report).

const crypto=require('crypto');

function span(S,start,end){
  const a=S.indexOf(start);if(a<0||S.indexOf(start,a+start.length)>=0)throw Error('converter anchor missing or ambiguous: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('converter end anchor missing after: '+start);
  return S.slice(a,b);
}

// The scripts' GUID, computed here with Python's own semantics: lower(), re.sub(r'\s+',' ') and strip() over
// str.isspace() characters, which do not include U+FEFF.
const PY_WS=/[\t\n\v\f\r \x1c-\x1f\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;
function pyGuid(prefix,basis){
  const b=basis.toLowerCase().replace(PY_WS,' ').replace(/^ | $/g,'');
  return prefix+crypto.createHash('sha1').update(b,'utf8').digest('hex').slice(0,20);
}

module.exports=async function run(S,t){
  const core=span(S,'// ──── TOOL: NCLEX to Anki ────','async function i2aFileKey(');
  const M=new Function(core+';return {n2aEsc,n2aAnkiFileText,n2aConvertExports,n2aParseQuestion,i2aNormalizeTranscript,i2aAssemble,i2aBuildCards,i2aNaturalCompare};')();
  const T=items=>M.i2aNormalizeTranscript({items});
  const opts=[{label:'A',text:'one'},{label:'B',text:'two'},{label:'C',text:'three'}];

  // L25
  t('L25: n2aEsc turns CRLF and a bare CR into one <br> each',M.n2aEsc('a\r\nb\rc')==='a<br>b<br>c');
  const crQ=T([{kind:'question',number:'1',format:'multiple_choice',stem:'Line one\r\nline two\rthree?',options:opts,answer:'A',answer_evidence:'printed',rationale:'First.\r\nSecond.',legibility:'clean'}]);
  const crCards=M.i2aBuildCards(M.i2aAssemble([['p.png',crQ]]).questions,'s').cards,crFile=M.n2aAnkiFileText(crCards,'D',true);
  t('L25: a transcript with CR line breaks gives an Anki file with no CR and one row per card',
    crCards.length===1&&!/\r/.test(crFile)&&crFile.split('\n').length===8&&crCards[0].front.includes('Line one<br>line two<br>three?'));

  // L26
  const pq=M.n2aParseQuestion('Which food?\uFEFF\nA. Spin\uFEFFach\nB. Bananas\nC. Oranges\nD. Milk\uFEFF');
  t('L26: a parsed stem and its choices keep U+FEFF, as Python strip() does',
    pq.stem==='Which food?\uFEFF'&&pq.options.map(o=>o[1]).join('|')==='Spin\uFEFFach|Bananas|Oranges|Milk\uFEFF');
  const ws='# NCLEX Practice Questions\n\n## Questions\n\n1. Which food?\uFEFF\n     A. Spin\uFEFFach\n     B. Bananas\n     C. Oranges\n     D. Milk\n\n## Answer Key\n\n1. ANSWER: A\n';
  const wsCard=M.n2aConvertExports([{name:'w',text:ws}]).cards[0];
  t('L26: a worksheet stem and choice holding U+FEFF get the nclex2anki.py GUID',
    !!wsCard&&wsCard.guid===pyGuid('n2a','Which food?\uFEFF\x1fSpin\uFEFFach\x1fBananas\x1fOranges\x1fMilk\x1f'));
  const xmd='# NCLEX Practice Questions\n\n**1 questions** extracted from source material.\n\n## Questions\n\n**1.** Which food should stay consistent?\n\nA. Spinach\nB. Bananas\nC. Oranges\nD. Milk\uFEFF\n\n<div class="pagebreak"></div>\n\n## Answer Key\n\n**1.** A\n\nVitamin K.\n';
  const xCard=M.n2aConvertExports([{name:'x',text:xmd}]).cards[0];
  t('L26: an Extractor choice ending in U+FEFF gets the extract2anki.py GUID',
    !!xCard&&xCard.guid===pyGuid('x2a','Which food should stay consistent?\x1fSpinach\x1fBananas\x1fOranges\x1fMilk\uFEFF'));
  const joined=M.i2aAssemble([['s1.png',T([{kind:'question',number:'4',format:'multiple_choice',stem:'Part one',options:[],cut_off:true,legibility:'clean'}])],
    ['s2.png',T([{kind:'continuation',number:null,stem:'part two\uFEFF',options:opts,answer:'A',answer_evidence:'printed',legibility:'clean'}])]]);
  t('L26: a stem continued on the next image keeps a trailing U+FEFF, as img2anki.py does',
    joined.questions.length===1&&joined.questions[0].stem==='Part one part two\uFEFF');

  // L28
  const shots=['Screenshot 2026-10-13 at 1.02.03 PM.png','Screenshot 2026-10-13 at 9.05.12 AM.png','Screenshot 2026-10-13 at 12.10.00 PM.png',
    'Screenshot 2026-10-13 at 10.00.00\u202fAM.png','Screenshot 2026-10-13 at 12.01.00 AM.png','Screenshot 2026-10-12 at 11.59.59 PM.png'];
  t('L28: 12-hour macOS screenshot names sort by the time they were taken (12 AM first, PM after AM, narrow space too)',
    [...shots].sort(M.i2aNaturalCompare).map(n=>shots.indexOf(n)).join()==='5,4,1,3,2,0'&&
    ['shot 10.png','shot 2.png','Shot 1.png'].sort(M.i2aNaturalCompare).join()==='Shot 1.png,shot 2.png,shot 10.png');

  // L29
  const q=(n,stem)=>({kind:'question',number:String(n),format:'multiple_choice',stem,options:opts,legibility:'clean'});
  const k=(n,a)=>({kind:'answer_only',number:String(n),answer:a,answer_evidence:'printed',rationale:'Because '+a+'.',legibility:'clean'});
  const dup=M.i2aBuildCards(M.i2aAssemble([['q.png',T([q(1,'First?')])],['k1.png',T([k(1,'A')])],['k2.png',T([k(1,'C')])]]).questions,'s');
  const chapters=M.i2aBuildCards(M.i2aAssemble([['c1q.png',T([q(1,'Chapter one first?')])],['c1k.png',T([k(1,'A')])],['c2q.png',T([q(1,'Chapter two first?')])],['c2k.png',T([k(1,'B')])]]).questions,'s');
  t('L29: a question whose number the answer key repeats is marked NeedsReview; a restarted chapter is not',
    dup.cards.length===1&&dup.cards[0].tags.includes('NeedsReview')&&dup.warnings.includes('Q1 (q.png): 2 answer-key entries carry this number; used the one in k1.png.')&&
    chapters.cards.length===2&&chapters.cards.every(c=>!c.tags.includes('NeedsReview'))&&chapters.cards[1].back.includes('Answer: B'));
};
