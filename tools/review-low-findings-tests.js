#!/usr/bin/env node
'use strict';

// v17.3: the remaining 2026-09-23 review findings. Extracted shipped functions are exercised with
// synthetic data (JSON extraction fallbacks, recovery-archive pruning, the cached Anki numeric
// tokenizer); the rest are source contracts that keep consolidated code from drifting back.

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('Low-findings anchor missing: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('Low-findings end anchor missing after: '+start);
  return S.slice(a,b);
}
const count=(haystack,needle)=>haystack.split(needle).length-1;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function run(S,t){
  /* ── extractJSON: old behavior preserved, new fallbacks only after the old path fails ── */
  const {extractJSON}=new Function(span(S,'function extractJSON(text){','\n// PDF text extraction (shared)')+';return {extractJSON};')();
  const fails=(text,re)=>{try{extractJSON(text);return false;}catch(e){return re.test(e.message);}};
  t('plain objects, arrays and fenced JSON still parse',extractJSON('{"a":1}').a===1&&extractJSON('x [1,2] y').length===2&&extractJSON('```json\n{"b":2}\n```').b===2);
  t('the first brace still wins when it begins valid JSON',JSON.stringify(extractJSON('Result: {"a":1}\n[1,2]'))==='{"a":1}');
  t('no JSON, malformed JSON and truncated JSON keep their errors',fails('nothing here',/No JSON found/)&&fails('{"a":}',/Malformed JSON/)&&fails('{"a":1',/JSON truncated/));
  t('a brace inside prose no longer blocks the JSON that follows on its own line',extractJSON('Note {caution}: see below\n{"ok":true}').ok===true);
  t('a later fenced block is tried when the first one is broken',extractJSON('```json\n{bad\n```\ntext\n```json\n{"ok":2}\n```').ok===2);
  t('an unrecoverable input reports the original failure',fails('Note {caution}: {"a":}',/Malformed JSON/));

  /* ── recovery archives are pruned to the newest few, never at the expense of the new one ── */
  const persistence=span(S,'function kbRunTx(db,mode,body){','\nfunction validateLatteKnowledgeBase');
  const fakeDB=({breakPrune=false}={})=>{
    const data=new Map();
    const request=result=>{const req={};setTimeout(()=>{req.result=result;req.onsuccess?.({target:req});},0);return req;};
    const db={data,close(){},transaction(){
      const store={put:(value,key)=>{data.set(key,value);return request(key);},delete:key=>{data.delete(key);return request(undefined);},getAllKeys:()=>{if(breakPrune)throw Error('synthetic: getAllKeys unsupported');return request([...data.keys()]);}};
      const tx={objectStore:()=>store};setTimeout(()=>tx.oncomplete?.(),15);return tx;}};
    return db;
  };
  let db=fakeDB();
  // kbRunTx names the store constant declared just above the extracted span; inject it.
  const withDB=new Function('localStorage','kbOpenDB','KB_DB_STORE',persistence+';return {kbArchiveRecovery,KB_RECOVERY_ARCHIVES};')({setItem(){throw Error('unexpected fallback write');}},async()=>db,'knowledge');
  const keep=withDB.KB_RECOVERY_ARCHIVES;
  for(let i=0;i<keep+3;i++){await withDB.kbArchiveRecovery([{kb:{n:i}}]);await sleep(2);}
  let keys=[...db.data.keys()].filter(k=>k.startsWith('recovery-')).sort();
  t('IndexedDB keeps only the newest recovery archives',keep>=3&&keys.length===keep&&db.data.get(keys[keys.length-1])[0].kb.n===keep+2&&db.data.get(keys[0])[0].kb.n===3);
  db=fakeDB({breakPrune:true});
  await withDB.kbArchiveRecovery([{kb:{n:'kept'}}]);
  t('a pruning failure never loses the archive just written',[...db.data.values()].some(v=>v[0].kb.n==='kept'));
  const local=new Map();
  const localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k),key:i=>[...local.keys()][i],get length(){return local.size;}};
  const noDB=new Function('localStorage','kbOpenDB','KB_DB_STORE',persistence+';return {kbArchiveRecovery};')(localStorage,async()=>{throw Error('synthetic: no IndexedDB');},'knowledge');
  for(let i=0;i<keep+3;i++){await noDB.kbArchiveRecovery([{kb:{n:i}}]);await sleep(2);}
  const localKeys=[...local.keys()].filter(k=>k.startsWith('latte_recovery-')).sort();
  t('the browser fallback keeps only the newest recovery archives too',localKeys.length===keep&&JSON.parse(local.get(localKeys[keep-1]))[0].kb.n===keep+2);

  /* ── Anki numeric tokenizer: hoisted regexes, cached fact tokens, unchanged outcomes ── */
  const anki=new Function('uid',span(S,'function ankiParseCards(raw','function AnkiStyleBadges(')+';return {ankiNumericTokens,ankiFactTokens,ankiNumericAudit,ANKI_UNUSUAL_RE,ANKI_TOKEN_RE};')(()=>'synthetic-id');
  t('numeric token regexes are module-level globals',anki.ANKI_TOKEN_RE instanceof RegExp&&anki.ANKI_UNUSUAL_RE instanceof RegExp&&anki.ANKI_TOKEN_RE.global&&anki.ANKI_UNUSUAL_RE.global);
  t('tokenization is stable across repeated calls with the shared regexes',['5 mg, 10 mg.','60–100 bpm','1/2 mg','5 mg/kg2','−5 to −2 °C','1e3 mg then 4 mg'].every(text=>JSON.stringify(anki.ankiNumericTokens(text))===JSON.stringify(anki.ankiNumericTokens(text))));
  t('known token outcomes are unchanged',anki.ankiNumericTokens('5 mg, 10 mg.').tokens.map(x=>x.key).join(';')==='5 mg;10 mg'&&anki.ankiNumericTokens('5 mg/kg2').unsupported.length>0&&anki.ankiNumericTokens('60–100 bpm').tokens.length===2&&anki.ankiNumericTokens('1/2 mg').unsupported.length===1);
  const fact={id:'fact-1',text:'Hold if HR below 60 bpm.',sourceQuote:'below 60 bpm'};
  const first=anki.ankiFactTokens(fact,'text');
  t('fact tokens are cached per fact object and field',first===anki.ankiFactTokens(fact,'text')&&first.tokens[0].key==='60 bpm'&&anki.ankiFactTokens(fact,'sourceQuote')!==first);
  fact.text='Hold if HR below 50 bpm.';
  t('a changed fact text is re-tokenized',anki.ankiFactTokens(fact,'text').tokens[0].key==='50 bpm');
  const frozen=Object.freeze({id:'fact-2',text:'Give 5 mg.',sourceQuote:''});
  t('frozen snapshot facts cache without mutation',anki.ankiFactTokens(frozen,'text')===anki.ankiFactTokens(frozen,'text')&&Object.isFrozen(frozen)&&anki.ankiFactTokens(null,'text').tokens.length===0);
  const batch={snapshot:{byId:{'fact-2':frozen}}};
  const card={id:'n1',text:'[Demo] Dose: {{c1::5 mg}}',extra:'',tags:'Tier::1',pipeCount:2,factIds:['fact-2'],keep:true};
  t('numeric audit through the cache detects a match and a mismatch',anki.ankiNumericAudit(card,batch,true).status==='No numeric mismatch detected'&&anki.ankiNumericAudit({...card,text:'[Demo] Dose: {{c1::6 mg}}'},batch,true).status==='Numeric discrepancy');

  /* ── source contracts ── */
  const kbBuilder=span(S,'function KnowledgeBaseBuilder(){','\n// ──── TOOL: Priority Analyzer ────');
  t('card identity conflicts are keyed by file identity, not basename',kbBuilder.includes('{identityConflicts.map(([id,e])=><details key={id} className="error-banner">')&&kbBuilder.includes('Object.entries(transcripts).filter(([id,entry])=>ids.has(id)&&cardIdentityConflict(entry))'));
  const adapter=new Function(span(S,'const NG_GROUNDING_ADAPTER=','\nfunction ngRenderAllocation(')+';return NG_GROUNDING_ADAPTER;')();
  t('the NCLEX grounding adapter text exists once and feeds both packet forms',adapter.startsWith('GROUNDING ADAPTER — INPUT FORM ONLY:')&&adapter.split('\n').length===8&&count(S,'GROUNDING ADAPTER — INPUT FORM ONLY:')===1&&count(S,'${NG_GROUNDING_ADAPTER}')===2);
  const body=name=>{const m=S.match(new RegExp('function '+name+'\\(value\\)\\{([\\s\\S]*?)\\n\\}'));return m&&m[1].replace(/\bnormalized\b/g,'normal');};
  t('the Anki and case decimal normalizers stay byte-identical apart from a local name',!!body('ankiDecimal')&&body('ankiDecimal')===body('caseDecimal'));
  t('both unit vocabularies share the same denominator grammar',count(S,'const ANKI_SUPPORTED_UNIT=/^(?:')===1&&count(S,'const CASE_SUPPORTED_UNIT=/^(?:')===1&&count(S,'(?:\\/(?:kg|ml|l|dl|hr|min|sec|day|dose|m2))*$/;')===2);
  const css=S.slice(S.indexOf('<style>'),S.indexOf('</style>'));
  t('the unused stylesheet rules are gone and the shared selectors survive',['setup-stack','badge-req','action-row','retry-banner','ext-toggle','ext-viewer','format-opt','fo-head','fo-desc','output-toolbar-actions','priority-layout'].every(c=>!new RegExp('\\.'+c+'(?![\\w-])').test(css))&&css.includes('.badge-opt{')&&css.includes('.error-banner,.tip-banner{'));
  t('React and ReactDOM are pinned to 18.3.1 with fresh SRI',S.includes('react/18.3.1/umd/react.production.min.js" integrity="sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z"')&&S.includes('react-dom/18.3.1/umd/react-dom.production.min.js" integrity="sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1"')&&!S.includes('/18.2.0/'));
  const generator=span(S,'function AnkiGenerator(){','\n// ──── TOOL: NCLEX Extractor ────');
  t('batch diagnostics JSON is built only while its details element is open',generator.includes("{diagnosticsOpen&&<pre style={{fontSize:12,whiteSpace:'pre-wrap'}}>{JSON.stringify(diagnostics,null,2)}</pre>}")&&generator.includes('onToggle={e=>setDiagnosticsOpen(e.currentTarget.open)}'));
  const preJsx=generator.slice(0,generator.indexOf('  return <Workbench'));
  t('AnkiGenerator no longer writes refs during render',!/\n  currentKB\.current=K\.knowledgeBase;/.test(preJsx)&&!/\n  auditInputs\.current=\{/.test(preJsx)&&preJsx.includes('useEffect(()=>{auditInputs.current=auditInputsValue;currentKB.current=K.knowledgeBase;},[auditInputsValue,K.knowledgeBase]);')&&preJsx.indexOf('auditInputs.current=auditInputsValue')<preJsx.indexOf('if(run&&!ankiSourceAuditCurrent(run,auditInputs.current))'));
}

module.exports=run;
