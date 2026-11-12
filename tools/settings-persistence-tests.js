#!/usr/bin/env node
'use strict';

// v17.3: the model names and manual thinking settings persist across reloads and are validated
// field by field on read; saved per-tool profile rows are validated the same way. The App wiring
// is checked as a source contract; the loaders run against fake storage.

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('Settings persistence anchor missing: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('Settings persistence end anchor missing after: '+start);
  return S.slice(a,b);
}

function run(S,t){
  const code=span(S,"const MODEL_SETTINGS_KEY=",'const ConfigCtx=createContext();');
  const M=new Function(code+';return {MODEL_SETTINGS_KEY,MODEL_SETTINGS_DEFAULTS,THINKING_LEVELS,loadModelSettings};')();
  const storage=value=>({getItem:key=>key===M.MODEL_SETTINGS_KEY?value:null});
  const defaults=M.MODEL_SETTINGS_DEFAULTS;
  t('shipped model defaults are the documented ones',defaults.flashModel==='gemini-4-hydrogen'&&defaults.argonModel==='gemini-4-argon'&&defaults.thinkingMode===false&&defaults.flashLevel==='low'&&defaults.argonLevel==='high'&&Object.isFrozen(defaults)&&!('proModel' in defaults)&&!('proLevel' in defaults)&&JSON.stringify(M.THINKING_LEVELS)==='["low","medium","high","xhigh"]');
  t('empty storage yields the defaults',JSON.stringify(M.loadModelSettings(storage(null)))===JSON.stringify(defaults));
  t('malformed storage yields the defaults',JSON.stringify(M.loadModelSettings(storage('{not json')))===JSON.stringify(defaults)&&JSON.stringify(M.loadModelSettings(storage('[1]')))===JSON.stringify(defaults));
  const saved=M.loadModelSettings(storage(JSON.stringify({flashModel:'gemini-9.0-flash',argonModel:'gemini-9.0-argon',thinkingMode:true,flashLevel:'xhigh',argonLevel:'low'})));
  t('valid saved settings including Hydrogen xhigh are restored field by field',saved.flashModel==='gemini-9.0-flash'&&saved.argonModel==='gemini-9.0-argon'&&saved.thinkingMode===true&&saved.flashLevel==='xhigh'&&saved.argonLevel==='low');
  const clampedArgon=M.loadModelSettings(storage(JSON.stringify({flashModel:'gemini-3.8-flash',argonModel:'gemini-4-argon',thinkingMode:false,flashLevel:'medium',argonLevel:'xhigh'})));
  t('retired default Flash IDs auto-migrate to gemini-4-hydrogen and saved Argon xhigh clamps to high',clampedArgon.flashModel==='gemini-4-hydrogen'&&clampedArgon.argonLevel==='high'&&clampedArgon.flashLevel==='medium');
  const partial=M.loadModelSettings(storage(JSON.stringify({flashModel:'bad model name!',argonModel:42,thinkingMode:'yes',flashLevel:'minimal',argonLevel:'high'})));
  t('invalid fields fall back individually',partial.flashModel===defaults.flashModel&&partial.argonModel===defaults.argonModel&&partial.thinkingMode===false&&partial.flashLevel==='low'&&partial.argonLevel==='high');
  // v17.13: a pre-v17.13 save names the Pro slot. Its thinking level was an explicit choice for that slot and carries
  // over; its model ID names a Pro model and does not.
  const legacy=M.loadModelSettings(storage(JSON.stringify({flashModel:'gemini-3.8-flash',proModel:'gemini-3.1-pro-preview',thinkingMode:true,flashLevel:'low',proLevel:'medium'})));
  t('a pre-v17.13 save keeps its Pro thinking level for Argon, migrates Flash 3.8 to Hydrogen, and drops Pro model ID',legacy.flashModel==='gemini-4-hydrogen'&&legacy.argonModel==='gemini-4-argon'&&legacy.argonLevel==='medium'&&legacy.thinkingMode===true&&!('proModel' in legacy)&&!('proLevel' in legacy));
  const both=M.loadModelSettings(storage(JSON.stringify({argonLevel:'low',proLevel:'medium'}))),badLegacy=M.loadModelSettings(storage(JSON.stringify({proLevel:'minimal'})));
  t('a saved Argon level wins over a leftover Pro level, and an invalid Pro level is not carried',both.argonLevel==='low'&&badLegacy.argonLevel==='high');
  t('a storage read failure yields the defaults',JSON.stringify(M.loadModelSettings({getItem(){throw Error('synthetic denied');}}))===JSON.stringify(defaults));

  const app=span(S,'function App(){','\n  );\n}\n');
  t('App hydrates every model setting from the validated snapshot',['flashModel','argonModel','thinkingMode','flashLevel','argonLevel'].every(key=>app.includes('useState(savedModels.'+key+')'))&&app.includes('loadModelSettings(localStorage)'));
  // v17.13 + v20.2: the student-facing slots are Hydrogen and Argon.
  t('the settings drawer and Anki checker name Hydrogen and Argon, not Pro',S.includes('Hydrogen model</label>')&&S.includes('Argon model</label>')&&S.includes('id="suite-argon-model"')&&!S.includes('suite-pro-model')&&!S.includes('cfg.proModel')&&S.includes('<option value="flash">Hydrogen</option>')&&S.includes('<option value="argon">Argon</option>')&&!S.includes('<option value="pro">')&&S.includes('.model-dot.argon{'));
  t('App persists the five model settings together',app.includes("localStorage.setItem(MODEL_SETTINGS_KEY,JSON.stringify({flashModel,argonModel,thinkingMode,flashLevel,argonLevel}))"));

  // Profile rows: the same initializer extraction the Anki quality tests use.
  const defaultsTable=new Function(span(S,'const TOOL_PROFILE_DEFAULTS=','const PROFILE_ROWS=')+';return TOOL_PROFILE_DEFAULTS;')();
  const initializer=span(S,'  const [profiles,setProfiles]=useState(',"  useEffect(()=>{try{localStorage.setItem('latte_auto_profile_v1'");
  const loadProfiles=stored=>new Function('TOOL_PROFILE_DEFAULTS','localStorage','useState',initializer+';return profiles;')(defaultsTable,{getItem:()=>stored},fn=>[fn(),()=>{}]);
  const loaded=loadProfiles(JSON.stringify({anki:{m:'pro',lv:'minimal'},cases:'flash',nclex:{m:'flash',lv:'xhigh'},priority:{m:'argon',lv:'xhigh'},unknownTool:{m:'pro',lv:'high'},casesAudit:{m:'pro',lv:'medium'}}));
  t('a saved row with an unrecognized level falls back to its recommended row',loaded.anki.m===defaultsTable.anki.m&&loaded.anki.lv===defaultsTable.anki.lv);
  t('a non-object row falls back to its recommended row',loaded.cases.m===defaultsTable.cases.m&&loaded.cases.lv===defaultsTable.cases.lv);
  t('a complete recognized row including Hydrogen xhigh is kept, and Argon xhigh clamps to high',loaded.nclex.m==='flash'&&loaded.nclex.lv==='xhigh'&&loaded.priority.m==='argon'&&loaded.priority.lv==='high');
  t('unknown tool ids are dropped and the audit-key migration still applies',!Object.hasOwn(loaded,'unknownTool')&&!Object.hasOwn(loaded,'casesAudit')&&loaded.itemAudit.m==='argon'&&loaded.itemAudit.lv==='medium');
  t('every tool row survives with only recognized values',Object.keys(defaultsTable).every(id=>['flash','argon'].includes(loaded[id].m)&&['low','medium','high','xhigh'].includes(loaded[id].lv)));
  // v17.13: a row saved as 'pro' chose the second slot, now Argon; without the shim it would fall back to Flash.
  // v19.2: knowledge still ships as Flash/medium, so a Pro/low row loading as Argon/low can only come from the shim.
  const legacyRows=loadProfiles(JSON.stringify({knowledge:{m:'pro',lv:'low'},nclexgen:{m:'pro',lv:'low'},nclex:{m:'argon',lv:'low'},priority:{m:'gpt',lv:'high'}}));
  t('a profile row saved as Pro loads as Argon; an unknown family still falls back',defaultsTable.knowledge.m==='flash'&&legacyRows.knowledge.m==='argon'&&legacyRows.knowledge.lv==='low'&&legacyRows.nclexgen.m==='argon'&&legacyRows.nclexgen.lv==='low'&&legacyRows.nclex.m==='argon'&&legacyRows.priority.m===defaultsTable.priority.m&&legacyRows.priority.lv===defaultsTable.priority.lv);

  // v17.14 + v19.2: the Auto profile ships Argon for Priority synthesis, NCLEX generate, Case studies and the item audit; the other seven stay on Flash.
  const shipped=Object.fromEntries(Object.entries(defaultsTable).map(([id,row])=>[id,row.m+'/'+row.lv]));
  t('the Auto profile ships Argon for Priority synthesis, NCLEX generate, Case studies and the item audit, Flash elsewhere',JSON.stringify(shipped)===JSON.stringify({knowledge:'flash/medium',knowledgeAudit:'flash/medium',cardTranscribe:'flash/low',priorityHarvest:'flash/low',priority:'argon/medium',anki:'flash/medium',nclex:'flash/medium',nclexgen:'argon/high',cases:'argon/high',itemAudit:'argon/high',gizmo:'flash/low'}));
  t('NCLEX generate ships as Argon high while keeping a saved Flash high override until Reset to recommended',defaultsTable.nclexgen.m==='argon'&&defaultsTable.nclexgen.lv==='high'&&loadProfiles(JSON.stringify({nclexgen:{m:'flash',lv:'high'}})).nclexgen.m==='flash'&&loadProfiles(JSON.stringify({nclexgen:{m:'flash',lv:'high'}})).nclexgen.lv==='high');
  const savedFlash=loadProfiles(JSON.stringify({priority:{m:'flash',lv:'medium'},nclexgen:{m:'flash',lv:'high'},cases:{m:'flash',lv:'high'},itemAudit:{m:'flash',lv:'high'}}));
  t('saved Flash rows from before v17.14/v19.2 are kept until Reset to recommended',['priority','nclexgen','cases','itemAudit'].every(id=>savedFlash[id].m==='flash'&&savedFlash[id].lv===defaultsTable[id].lv));
}

module.exports=run;
