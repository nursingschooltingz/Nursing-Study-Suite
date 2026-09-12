'use strict';
const fs=require('fs');
function extract(source){
  const a=source.indexOf('function kbStoredRecord('),b=source.indexOf('\nfunction validateLatteKnowledgeBase',a);
  if(a<0||b<0)throw Error('Persistence extraction anchors missing');
  return new Function(source.slice(a,b)+';return {kbStoredRecord,kbStoredKey,kbReconcileStored,kbCreateSaveQueue};')();
}
async function runTests(source,t){
  const H=extract(source),A={conditions:[{name:'A'}]},B={conditions:[{name:'B'}]},C={conditions:[{name:'C'}]};
  const raw=kb=>H.kbStoredRecord(kb);
  t('empty storage reconciles without inventing a snapshot',H.kbReconcileStored([]).record===null);
  t('either legacy store alone retains its KB',H.kbReconcileStored([raw(A)]).record.kb===A);
  t('identical legacy stores reconcile',H.kbReconcileStored([raw(A),raw(A)]).choices.length===0);
  t('different legacy stores retain both recovery choices',H.kbReconcileStored([raw(A),raw(B)]).choices.length===2);
  t('createdAt is never used to rank legacy copies',H.kbReconcileStored([raw({...A,metadata:{createdAt:'9999'}}),raw(B)]).choices.length===2);
  t('metadata mismatching snapshot bytes becomes unordered legacy data',H.kbStoredRecord(A,{bytes:JSON.stringify(B),sequence:999}).meta===null);
  function fixture(failures=[]){
    let durable=null,fallback=null,active=0,max=0;const events=[];
    const write=async(record,expected)=>{active++;max=Math.max(max,active);events.push(record.kb?.conditions[0].name||'delete');await Promise.resolve();active--;
      if(failures.shift())throw Error('quota/abort');
      if(H.kbStoredKey(durable)!==H.kbStoredKey(expected)){const e=Error('conflict');e.name='KBConflict';throw e;}durable=record;};
    const queue=H.kbCreateSaveQueue({write,remove:write,writeFallback:r=>{fallback=r;},captureFallbacks:()=>fallback,clearFallbacks:r=>{if(fallback===r)fallback=null;},writer:'test'});
    return {queue,events,get durable(){return durable;},get fallback(){return fallback;},get max(){return max;},setFallback:r=>fallback=r,setDurable:r=>durable=r};
  }
  let f=fixture([true,false]);await f.queue.save(A);await f.queue.save(B);
  t('failed A then durable B reloads B and clears old fallback',H.kbReconcileStored([f.durable,f.fallback]).record.kb.conditions[0].name==='B'&&!f.fallback);
  f=fixture([false,true]);await f.queue.save(A);await f.queue.save(B);
  t('durable A then fallback B reloads B',H.kbReconcileStored([f.durable,f.fallback]).record.kb.conditions[0].name==='B');
  f=fixture();const p=[f.queue.save(A),f.queue.save(B),f.queue.save(C)];await Promise.all(p);
  t('A B C writes cannot overtake each other',f.max===1&&f.events.join('')==='ABC'&&f.durable.kb.conditions[0].name==='C');
  f=fixture([false,true]);await f.queue.save(A);await f.queue.save(null);
  t('failed delete persists tombstone that wins over old durable KB',H.kbReconcileStored([f.durable,f.fallback]).record.kb===null);
  f=fixture();await f.queue.save(A);await f.queue.save(null);
  t('durable delete keeps ordered metadata',f.durable.kb===null&&f.durable.meta.deleted);
  const orig=JSON.stringify(A);f=fixture();const copying=f.queue.save(A);A.conditions[0].name='changed';await copying;A.conditions[0].name='A';
  t('queued snapshots do not alias caller mutations',JSON.stringify(f.durable.kb)===orig);
  let release;const newer={kb:C};let fallback=raw(A);
  const queue=H.kbCreateSaveQueue({write:()=>new Promise(r=>release=r),remove:()=>{},writeFallback:r=>fallback=r,captureFallbacks:()=>fallback,clearFallbacks:captured=>{if(fallback===captured)fallback=null;},writer:'old'});
  const saving=queue.save(B);await Promise.resolve();fallback=newer;release();let lateConflict='';try{await saving;}catch(e){lateConflict=e.name;}
  t('old successful callback preserves and reports newer fallback',fallback===newer&&lateConflict==='KBConflict');
  f=fixture();f.setDurable(raw(C));let conflict='';try{await f.queue.save(A);}catch(e){conflict=e.name;}
  t('concurrent durable writer is preserved and reported',conflict==='KBConflict'&&f.durable.kb===C);
  let blocked=false;try{await f.queue.save(B);}catch{blocked=true;}
  t('queue stops after concurrent writer conflict',blocked&&f.events.length===1);
  const failed=H.kbCreateSaveQueue({write:async()=>{throw Error('abort');},remove:async()=>{throw Error('abort');},writeFallback:()=>{throw Error('quota');},captureFallbacks:()=>null,clearFallbacks:()=>{},writer:'fail'});
  let msg='';try{await failed.save(A);}catch(e){msg=e.message;}
  t('quota in both stores never reports saved',msg.includes('Neither browser store saved'));
  t('persistence extraction reaches the queue tail',typeof H.kbCreateSaveQueue==='function'&&typeof f.queue.setHead==='function');
}
module.exports={runTests};
if(require.main===module){const {resolveSuiteFile}=require('./repo-checks');let count=0;runTests(fs.readFileSync(resolveSuiteFile({rootDir:process.cwd()}),'utf8'),(name,ok)=>{if(!ok)throw Error(name);count++;}).then(()=>console.log(count+' persistence assertions passed')).catch(e=>{console.error(e);process.exitCode=1;});}
