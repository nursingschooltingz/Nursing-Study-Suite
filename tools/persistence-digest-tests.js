#!/usr/bin/env node
'use strict';

// v17.3: the persistence metadata witness moved from a full copy of the serialized KB
// (meta.bytes) to a digest (meta.digest). These checks extract the shipped persistence span and
// prove: legacy bytes records still verify and order, digest records verify, mismatches of either
// kind are rejected, new saves write digest-only metadata at a fraction of the old size, and a
// tombstone carries a digest of the null snapshot. Lineage fixtures carry different KB content
// because the reconciler collapses byte-identical KBs into one choice before ordering them.

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('Persistence anchor missing: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('Persistence end anchor missing after: '+start);
  return S.slice(a,b);
}
const clone=v=>JSON.parse(JSON.stringify(v));

async function run(S,t){
  const persistence=span(S,"const KB_META_KEY='active-save-v2'",'\nfunction validateLatteKnowledgeBase');
  const data=new Map();
  const localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
  const P=new Function('localStorage','kbOpenDB',persistence+';return {KB_FALLBACK_KEY,kbDigest,kbMetaMatches,kbStoredRecord,kbStoredKey,kbReconcileStored,kbReadFallbacks,kbCreateSaveQueue};')(localStorage,async()=>{throw Error('synthetic: no IndexedDB');});
  const kb={metadata:{course:'Synthetic',exam:'',schemaVersion:'1.1',createdAt:'2026-09-23'},sources:[],conditions:Array.from({length:40},(_,c)=>({id:'condition-'+(c+1),name:'Synthetic condition '+(c+1),aliases:[],facts:Array.from({length:25},(_,f)=>({id:'fact-'+(c*25+f+1),text:'Fictional finding '+(c*25+f+1)+' with value '+(f+10)+' mg.',tier:1,latteBucket:'Look',subtype:null,factType:'other',safetyCritical:false,recovered:false,sourceQuote:'',sources:[{filename:'synthetic.pdf',location:'page '+(c+1)}]}))})),medications:[],diagnostics:[],scoringTools:[],formulas:[],contradictions:[]};
  const later=clone(kb);later.conditions[0].facts.push({...clone(later.conditions[0].facts[0]),id:'fact-1001',text:'Fictional finding 1001 with value 99 mg.'});
  const bytes=JSON.stringify(kb),digest=P.kbDigest(bytes),laterBytes=JSON.stringify(later),laterDigest=P.kbDigest(laterBytes);
  t('digest is deterministic, short and input-sensitive',digest===P.kbDigest(bytes)&&/^cyrb53:[0-9a-f]{28}$/.test(digest)&&digest!==laterDigest&&digest!==P.kbDigest(bytes+' ')&&P.kbDigest('null')!==P.kbDigest(''));
  const legacy={writer:'w',sequence:1,parent:'null',deleted:false,bytes};
  const modern={writer:'w',sequence:2,parent:P.kbStoredKey({kb,meta:legacy}),deleted:false,digest:laterDigest};
  t('a legacy bytes witness still verifies its KB',P.kbMetaMatches(legacy,bytes)&&P.kbStoredRecord(kb,legacy).meta===legacy);
  t('a digest witness verifies its KB',P.kbMetaMatches(modern,laterBytes)&&P.kbStoredRecord(later,modern).meta===modern);
  t('a mismatched witness of either kind is rejected',!P.kbMetaMatches({...legacy,bytes:bytes+' '},bytes)&&!P.kbMetaMatches({...modern,digest:P.kbDigest('x')},laterBytes)&&P.kbStoredRecord(later,{...modern,digest:'cyrb53:0'}).meta===null&&P.kbStoredRecord(kb,modern).meta===null&&!P.kbMetaMatches(null,bytes)&&!P.kbMetaMatches({writer:'w'},bytes));
  t('digest and legacy records of one lineage reconcile to the newer sequence',P.kbReconcileStored([{kb,meta:legacy},{kb:later,meta:modern}]).record.meta===modern);
  data.set(P.KB_FALLBACK_KEY,JSON.stringify({kb,meta:legacy}));
  let read=P.kbReadFallbacks();
  t('a legacy fallback record restores with ordered metadata',read.length===1&&!read[0].recoveryError&&read[0].meta.sequence===1);
  data.set(P.KB_FALLBACK_KEY,JSON.stringify({kb:later,meta:modern}));
  read=P.kbReadFallbacks();
  t('a digest fallback record restores with ordered metadata',read.length===1&&!read[0].recoveryError&&read[0].meta.sequence===2);
  const tampered=clone(later);tampered.conditions[0].facts[0].text='tampered';
  data.set(P.KB_FALLBACK_KEY,JSON.stringify({kb:tampered,meta:modern}));
  read=P.kbReadFallbacks();
  t('a fallback KB that no longer matches its digest stays raw recovery evidence',read.length===1&&/metadata/.test(read[0].recoveryError)&&typeof read[0].raw==='string');
  data.clear();
  let durable=null,fallback=null;
  const queue=P.kbCreateSaveQueue({write:async record=>{durable=record;},remove:async record=>{durable=record;},writeFallback:record=>{fallback=JSON.stringify(record);},captureFallbacks:()=>({}),clearFallbacks:()=>{},writer:'w'});
  queue.setHead({kb,meta:legacy},{});
  await queue.save(later);
  t('a save writes a digest witness and no serialized copy',typeof durable.meta.digest==='string'&&!('bytes' in durable.meta)&&durable.meta.digest===laterDigest&&durable.meta.parent===P.kbStoredKey({kb,meta:legacy}));
  t('a save is stored once, not twice',JSON.stringify(durable).length<laterBytes.length*1.05+400&&JSON.stringify({kb,meta:legacy}).length>bytes.length*2);
  t('the saved record verifies and reconciles as the newest lineage member',P.kbStoredRecord(durable.kb,durable.meta).meta===durable.meta&&P.kbReconcileStored([{kb,meta:legacy},durable]).record.meta===durable.meta);
  const failing=P.kbCreateSaveQueue({write:async()=>{throw Error('synthetic quota');},remove:async()=>{throw Error('synthetic quota');},writeFallback:record=>{fallback=JSON.stringify(record);},captureFallbacks:()=>({}),clearFallbacks:()=>{},writer:'w'});
  failing.setHead(null,{});
  const status=(await failing.save(kb)).status;
  t('the fallback record is also stored once',status==='fallback'&&fallback.length<bytes.length*1.05+400&&JSON.parse(fallback).meta.digest===digest);
  const deleteCode=span(S,'async function kbDeletePersisted(record,expected=null){','\nfunction kbReconcileStored(records){');
  let tombstone=null;
  const kbDeletePersisted=new Function('kbSavePersisted','kbDigest',deleteCode+';return kbDeletePersisted;')(async record=>{tombstone=record;},P.kbDigest);
  await kbDeletePersisted({kb:later,meta:{...durable.meta,bytes:'stale legacy copy'}});
  t('a tombstone carries a digest of the null snapshot and drops any legacy bytes',tombstone.kb===null&&tombstone.meta.deleted===true&&tombstone.meta.digest===P.kbDigest('null')&&!('bytes' in tombstone.meta)&&P.kbStoredRecord(null,tombstone.meta).meta===tombstone.meta);
}

module.exports=run;
