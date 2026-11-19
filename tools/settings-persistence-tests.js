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
  t('shipped model defaults are the documented ones',defaults.hydrogenModel==='gemini-4-hydrogen'&&defaults.neonModel==='gemini-4-neon'&&defaults.thinkingMode===false&&defaults.hydrogenLevel==='low'&&defaults.neonLevel==='high'&&Object.isFrozen(defaults)&&!('proModel' in defaults)&&!('proLevel' in defaults)&&!('argonModel' in defaults)&&!('argonLevel' in defaults)&&JSON.stringify(M.THINKING_LEVELS)==='["low","medium","high","xhigh"]');
  t('empty storage yields the defaults',JSON.stringify(M.loadModelSettings(storage(null)))===JSON.stringify(defaults));
  t('malformed storage yields the defaults',JSON.stringify(M.loadModelSettings(storage('{not json')))===JSON.stringify(defaults)&&JSON.stringify(M.loadModelSettings(storage('[1]')))===JSON.stringify(defaults));
  const saved=M.loadModelSettings(storage(JSON.stringify({schemaVersion:3,hydrogenModel:'gemini-9.0-hydrogen',neonModel:'gemini-9.0-neon',thinkingMode:true,hydrogenLevel:'xhigh',neonLevel:'xhigh'})));
  t('valid saved settings including Hydrogen xhigh and Neon xhigh are restored field by field',saved.hydrogenModel==='gemini-9.0-hydrogen'&&saved.neonModel==='gemini-9.0-neon'&&saved.thinkingMode===true&&saved.hydrogenLevel==='xhigh'&&saved.neonLevel==='xhigh');
  const clampedArgon=M.loadModelSettings(storage(JSON.stringify({schemaVersion:3,hydrogenModel:'gemini-4-hydrogen',neonModel:'gemini-4-argon',thinkingMode:false,hydrogenLevel:'medium',neonLevel:'xhigh'})));
  t('manual Argon model ID in the second slot clamps xhigh to high while Hydrogen keeps medium',clampedArgon.hydrogenModel==='gemini-4-hydrogen'&&clampedArgon.neonModel==='gemini-4-argon'&&clampedArgon.neonLevel==='high'&&clampedArgon.hydrogenLevel==='medium');
  // v21.10: schema v2 -> v3 migration upgrades untouched default 'gemini-4-argon' to 'gemini-4-neon' while preserving custom user-typed model IDs and explicit argonLevel.
  const v2Default=M.loadModelSettings(storage(JSON.stringify({schemaVersion:2,hydrogenModel:'gemini-4-hydrogen',argonModel:'gemini-4-argon',thinkingMode:true,hydrogenLevel:'low',argonLevel:'medium'})));
  const v2Custom=M.loadModelSettings(storage(JSON.stringify({schemaVersion:2,hydrogenModel:'gemini-4-hydrogen',argonModel:'gemini-custom-reasoning',thinkingMode:false,hydrogenLevel:'low',argonLevel:'low'})));
  t('v21.10: schema v2->v3 upgrades untouched gemini-4-argon to gemini-4-neon, preserves custom second-slot model IDs, and carries argonLevel',v2Default.neonModel==='gemini-4-neon'&&v2Default.neonLevel==='medium'&&v2Default.thinkingMode===true&&v2Custom.neonModel==='gemini-custom-reasoning'&&v2Custom.neonLevel==='low');
  const partial=M.loadModelSettings(storage(JSON.stringify({schemaVersion:3,hydrogenModel:'bad model name!',neonModel:42,thinkingMode:'yes',hydrogenLevel:'minimal',neonLevel:'high'})));
  t('invalid fields fall back individually',partial.hydrogenModel===defaults.hydrogenModel&&partial.neonModel===defaults.neonModel&&partial.thinkingMode===false&&partial.hydrogenLevel==='low'&&partial.neonLevel==='high');
  // v17.13 + v21.10: a pre-v17.13 save names the Pro slot. Its thinking level was an explicit choice for that slot and carries
  // over to Neon; its model ID names a Pro model and does not.
  const legacy=M.loadModelSettings(storage(JSON.stringify({proModel:'gemini-3.1-pro-preview',thinkingMode:true,proLevel:'medium'})));
  t('a pre-v17.13 save keeps its Pro thinking level for Neon, defaults Hydrogen, and drops Pro model ID',legacy.hydrogenModel==='gemini-4-hydrogen'&&legacy.neonModel==='gemini-4-neon'&&legacy.neonLevel==='medium'&&legacy.thinkingMode===true&&!('proModel' in legacy)&&!('proLevel' in legacy));
  const both=M.loadModelSettings(storage(JSON.stringify({neonLevel:'low',argonLevel:'medium',proLevel:'high'}))),badLegacy=M.loadModelSettings(storage(JSON.stringify({proLevel:'minimal'})));
  t('a saved Neon level wins over leftover Argon/Pro levels, and an invalid Pro level is not carried',both.neonLevel==='low'&&badLegacy.neonLevel==='high');
  t('a storage read failure yields the defaults',JSON.stringify(M.loadModelSettings({getItem(){throw Error('synthetic denied');}}))===JSON.stringify(defaults));

  const app=span(S,'function App(){','\n  );\n}\n');
  t('App hydrates every model setting from the validated snapshot',['hydrogenModel','neonModel','thinkingMode','hydrogenLevel','neonLevel'].every(key=>app.includes('useState(savedModels.'+key+')'))&&app.includes('loadModelSettings(localStorage)'));
  // v17.13 + v20.2 + v21.10: the student-facing slots are Hydrogen and Neon.
  t('the settings drawer and Anki checker name Hydrogen and Neon, not Pro',S.includes('Hydrogen model</label>')&&S.includes('Neon model</label>')&&S.includes('id="suite-hydrogen-model"')&&S.includes('id="suite-neon-model"')&&!S.includes('suite-pro-model')&&!S.includes('cfg.proModel')&&S.includes('<option value="hydrogen">Hydrogen</option>')&&S.includes('<option value="neon">Neon</option>')&&!S.includes('<option value="pro">')&&S.includes('.model-dot.neon,.model-dot.argon{'));
  t('settings controls expose Hydrogen element IDs without legacy fast-slot hooks',S.includes('suite-hydrogen-model-error')&&S.includes('cfg.hydrogenModel')&&S.includes('cfg.setHydrogenModel')&&!('flashModel' in defaults)&&!('flashLevel' in defaults)&&!S.includes('suite-flash-model')&&!('proModel' in defaults));
  t('App persists the five model settings together',app.includes('saveModelSettings(localStorage,{hydrogenModel,neonModel,thinkingMode,hydrogenLevel,neonLevel})'));

  // Profile rows: the same initializer extraction the Anki quality tests use.
  const defaultsTable=new Function(span(S,'const TOOL_PROFILE_DEFAULTS=','const PROFILE_ROWS=')+';return TOOL_PROFILE_DEFAULTS;')();
  const initializer=span(S,'  const [profiles,setProfiles]=useState(',"  // v21.10 (Phase 4): skip redundant localStorage write-backs");
  const loadProfiles=stored=>new Function('TOOL_PROFILE_DEFAULTS','localStorage','useState',initializer+';return profiles;')(defaultsTable,{getItem:()=>stored},fn=>[fn(),()=>{}]);
  const loaded=loadProfiles(JSON.stringify({anki:{m:'pro',lv:'minimal'},cases:'hydrogen',nclex:{m:'hydrogen',lv:'xhigh'},priority:{m:'neon',lv:'xhigh'},unknownTool:{m:'pro',lv:'high'},casesAudit:{m:'pro',lv:'medium'}}));
  t('a saved row with an unrecognized level falls back to its recommended row',loaded.anki.m===defaultsTable.anki.m&&loaded.anki.lv===defaultsTable.anki.lv);
  t('a non-object row falls back to its recommended row',loaded.cases.m===defaultsTable.cases.m&&loaded.cases.lv===defaultsTable.cases.lv);
  t('a complete recognized row including Hydrogen xhigh and Neon xhigh is kept',loaded.nclex.m==='hydrogen'&&loaded.nclex.lv==='xhigh'&&loaded.priority.m==='neon'&&loaded.priority.lv==='xhigh');
  t('unknown tool ids are dropped and the audit-key migration still applies',!Object.hasOwn(loaded,'unknownTool')&&!Object.hasOwn(loaded,'casesAudit')&&loaded.itemAudit.m==='neon'&&loaded.itemAudit.lv==='medium');
  t('every tool row survives with only recognized values',Object.keys(defaultsTable).every(id=>['hydrogen','neon'].includes(loaded[id].m)&&['low','medium','high','xhigh'].includes(loaded[id].lv)));
  // v17.13 + v21.10: rows saved as 'pro' or 'argon' chose the second slot, now Neon; without the shim they would fall back to Hydrogen.
  const legacyRows=loadProfiles(JSON.stringify({knowledge:{m:'pro',lv:'low'},nclexgen:{m:'argon',lv:'low'},nclex:{m:'neon',lv:'low'},priority:{m:'gpt',lv:'high'}}));
  t('profile rows saved as Pro or Argon load as Neon; an unknown family still falls back',defaultsTable.knowledge.m==='hydrogen'&&legacyRows.knowledge.m==='neon'&&legacyRows.knowledge.lv==='low'&&legacyRows.nclexgen.m==='neon'&&legacyRows.nclexgen.lv==='low'&&legacyRows.nclex.m==='neon'&&legacyRows.priority.m===defaultsTable.priority.m&&legacyRows.priority.lv===defaultsTable.priority.lv);

  // v17.14 + v19.2 + v20.2 + v21.9 + v21.10: the Auto profile ships Neon high for Priority synthesis, NCLEX generate, Case studies and the item audit; the other eight use Hydrogen.
  const shipped=Object.fromEntries(Object.entries(defaultsTable).map(([id,row])=>[id,row.m+'/'+row.lv]));
  t('the Auto profile ships Neon high for Priority synthesis, NCLEX generate, Case studies and the item audit, Hydrogen elsewhere',JSON.stringify(shipped)===JSON.stringify({courseAnalyzer:'hydrogen/medium',knowledge:'hydrogen/medium',knowledgeAudit:'hydrogen/medium',cardTranscribe:'hydrogen/low',priorityHarvest:'hydrogen/low',priority:'neon/high',anki:'hydrogen/medium',nclex:'hydrogen/medium',nclexgen:'neon/high',cases:'neon/high',itemAudit:'neon/high',gizmo:'hydrogen/low'}));
  t('NCLEX generate ships as Neon high while keeping a saved Hydrogen high override until Reset to recommended',defaultsTable.nclexgen.m==='neon'&&defaultsTable.nclexgen.lv==='high'&&loadProfiles(JSON.stringify({nclexgen:{m:'hydrogen',lv:'high'}})).nclexgen.m==='hydrogen'&&loadProfiles(JSON.stringify({nclexgen:{m:'hydrogen',lv:'high'}})).nclexgen.lv==='high');
  const savedHydrogen=loadProfiles(JSON.stringify({priority:{m:'hydrogen',lv:'high'},nclexgen:{m:'hydrogen',lv:'high'},cases:{m:'hydrogen',lv:'high'},itemAudit:{m:'hydrogen',lv:'high'}}));
  t('saved Hydrogen overrides on Neon-default rows are kept until Reset to recommended',['priority','nclexgen','cases','itemAudit'].every(id=>savedHydrogen[id].m==='hydrogen'&&savedHydrogen[id].lv===defaultsTable[id].lv));
}

module.exports=run;
