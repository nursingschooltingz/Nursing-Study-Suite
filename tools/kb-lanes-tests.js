#!/usr/bin/env node
'use strict';

// v17.3: bounded-lane chunk processing for the Knowledge Base build. These checks extract the
// shipped lane runner and order comparator and drive them with synthetic jobs: concurrency stays
// bounded, results assemble in chunk order whatever the completion order, halves pushed by a
// truncated chunk are picked up by an idle lane, and cancellation or a thrown error stops
// scheduling while in-flight work settles.

function span(S,start,end){
  const a=S.indexOf(start);if(a<0)throw Error('Lane anchor missing: '+start);
  const b=S.indexOf(end,a+start.length);if(b<0)throw Error('Lane end anchor missing after: '+start);
  return S.slice(a,b);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function run(S,t){
  const code=span(S,'function kbCompareOrder(','// Verify a model-supplied verbatim quote actually occurs in the source chunk.');
  const L=new Function(code+';return {kbCompareOrder,kbRunLanes};')();
  t('lane extraction reaches the runner tail',code.includes('if(fatal)throw fatal;')&&typeof L.kbRunLanes==='function');
  const sorted=[[2],[0,1],[1],[0,0],[0],[0,1,1],[0,1,0]].sort(L.kbCompareOrder).map(x=>x.join('.')).join(' ');
  t('order keys sort a parent before its halves and halves in sequence',sorted==='0 0.0 0.1 0.1.0 0.1.1 1 2');

  const jobs=n=>Array.from({length:n},(_,i)=>({order:[i],delay:(n-i)*5}));
  async function drive(width,queue,{onJob,signal}={}){
    const finished=[];let active=0,peak=0;
    await L.kbRunLanes(queue,width,async job=>{
      active++;peak=Math.max(peak,active);
      await sleep(job.delay);
      if(onJob)await onJob(job,queue);
      finished.push(job);active--;
    },signal);
    return {finished,peak};
  }
  let out=await drive(1,jobs(4));
  t('width 1 runs strictly in queue order',out.peak===1&&out.finished.map(j=>j.order[0]).join()==='0,1,2,3');
  out=await drive(2,jobs(6));
  t('width 2 overlaps work and never exceeds two lanes',out.peak===2&&out.finished.length===6);
  const assembled=out.finished.slice().sort((a,b)=>L.kbCompareOrder(a.order,b.order)).map(j=>j.order[0]).join();
  t('later-finishing chunks still assemble in chunk order',assembled==='0,1,2,3,4,5'&&out.finished.map(j=>j.order[0]).join()!==assembled);
  // A truncated chunk pushes its halves back while the other lane is idle and waiting.
  const split=[{order:[0],delay:20},{order:[1],delay:1}];
  out=await drive(2,split,{onJob:(job,queue)=>{if(job.order.length===1&&job.order[0]===0)queue.unshift({order:[0,0],delay:1},{order:[0,1],delay:1});}});
  t('halves pushed by a splitting chunk are processed by the waiting lane',out.finished.map(j=>j.order.join('.')).sort().join()==='0,0.0,0.1,1');
  const controller=new AbortController();let scheduled=0,aborted='';
  try{await L.kbRunLanes(jobs(6),2,async job=>{scheduled++;await sleep(5);if(job.order[0]===1)controller.abort();},controller.signal);}
  catch(e){aborted=e.name;}
  t('cancellation stops scheduling after in-flight lanes settle',aborted==='AbortError'&&scheduled<=3);
  let seen=0,failure='';
  try{await L.kbRunLanes(jobs(6),2,async job=>{seen++;await sleep(5);if(job.order[0]===0)throw Error('synthetic lane failure');});}
  catch(e){failure=e.message;}
  t('a thrown worker error propagates once in-flight work settles and no further jobs start',failure==='synthetic lane failure'&&seen===2);
  t('an empty queue completes without scheduling',(await drive(2,[])).finished.length===0);
  const timed=async width=>{const started=Date.now();await drive(width,Array.from({length:8},(_,i)=>({order:[i],delay:15})));return Date.now()-started;};
  const one=await timed(1),two=await timed(2);
  console.log('      lanes timing (synthetic 8×15 ms): width 1 '+one+' ms · width 2 '+two+' ms');
}

module.exports=run;
