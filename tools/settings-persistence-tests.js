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
  t('shipped model defaults are the documented ones',defaults.flashModel==='gemini-3.8-flash'&&defaults.proModel==='gemini-3.1-pro-preview'&&defaults.thinkingMode===false&&defaults.flashLevel==='low'&&defaults.proLevel==='high'&&Object.isFrozen(defaults));
  t('empty storage yields the defaults',JSON.stringify(M.loadModelSettings(storage(null)))===JSON.stringify(defaults));
  t('malformed storage yields the defaults',JSON.stringify(M.loadModelSettings(storage('{not json')))===JSON.stringify(defaults)&&JSON.stringify(M.loadModelSettings(storage('[1]')))===JSON.stringify(defaults));
  const saved=M.loadModelSettings(storage(JSON.stringify({flashModel:'gemini-9.0-flash',proModel:'gemini-9.0-pro-preview',thinkingMode:true,flashLevel:'medium',proLevel:'low'})));
  t('valid saved settings are restored field by field',saved.flashModel==='gemini-9.0-flash'&&saved.proModel==='gemini-9.0-pro-preview'&&saved.thinkingMode===true&&saved.flashLevel==='medium'&&saved.proLevel==='low');
  const partial=M.loadModelSettings(storage(JSON.stringify({flashModel:'bad model name!',proModel:42,thinkingMode:'yes',flashLevel:'minimal',proLevel:'high'})));
  t('invalid fields fall back individually',partial.flashModel===defaults.flashModel&&partial.proModel===defaults.proModel&&partial.thinkingMode===false&&partial.flashLevel==='low'&&partial.proLevel==='high');
  t('a storage read failure yields the defaults',JSON.stringify(M.loadModelSettings({getItem(){throw Error('synthetic denied');}}))===JSON.stringify(defaults));

  const app=span(S,'function App(){','\n  );\n}\n');
  t('App hydrates every model setting from the validated snapshot',['flashModel','proModel','thinkingMode','flashLevel','proLevel'].every(key=>app.includes('useState(savedModels.'+key+')'))&&app.includes('loadModelSettings(localStorage)'));
  t('App persists the five model settings together',app.includes("localStorage.setItem(MODEL_SETTINGS_KEY,JSON.stringify({flashModel,proModel,thinkingMode,flashLevel,proLevel}))"));

  // Profile rows: the same initializer extraction the Anki quality tests use.
  const defaultsTable=new Function(span(S,'const TOOL_PROFILE_DEFAULTS=','const PROFILE_ROWS=')+';return TOOL_PROFILE_DEFAULTS;')();
  const initializer=span(S,'  const [profiles,setProfiles]=useState(',"  useEffect(()=>{try{localStorage.setItem('latte_auto_profile_v1'");
  const loadProfiles=stored=>new Function('TOOL_PROFILE_DEFAULTS','localStorage','useState',initializer+';return profiles;')(defaultsTable,{getItem:()=>stored},fn=>[fn(),()=>{}]);
  const loaded=loadProfiles(JSON.stringify({anki:{m:'pro',lv:'minimal'},cases:'flash',nclex:{m:'flash',lv:'low'},unknownTool:{m:'pro',lv:'high'},casesAudit:{m:'pro',lv:'medium'}}));
  t('a saved row with an unrecognized level falls back to its recommended row',loaded.anki.m===defaultsTable.anki.m&&loaded.anki.lv===defaultsTable.anki.lv);
  t('a non-object row falls back to its recommended row',loaded.cases.m===defaultsTable.cases.m&&loaded.cases.lv===defaultsTable.cases.lv);
  t('a complete recognized row is kept exactly',loaded.nclex.m==='flash'&&loaded.nclex.lv==='low');
  t('unknown tool ids are dropped and the audit-key migration still applies',!Object.hasOwn(loaded,'unknownTool')&&!Object.hasOwn(loaded,'casesAudit')&&loaded.itemAudit.m==='pro'&&loaded.itemAudit.lv==='medium');
  t('every tool row survives with only recognized values',Object.keys(defaultsTable).every(id=>['flash','pro'].includes(loaded[id].m)&&['low','medium','high'].includes(loaded[id].lv)));
}

module.exports=run;
