'use strict';

// v18.5: the NCLEX Generator spreads a run's batches through the whole Knowledge Base. Synthetic pools only; no network.

module.exports=function run(S,t){
  const span=(a,b)=>{const x=S.indexOf(a),y=S.indexOf(b,x+a.length);if(x<0||y<0||S.indexOf(a,x+1)>=0)throw Error('Missing or ambiguous v18.5 anchor '+a);return S.slice(x,y);};
  const {ngBuildFactPool,ngAllocateBatch,ngBatchStart}=new Function('kbSourceText',span('function ngFactRow(','// v17.3: this text was duplicated')+';return {ngBuildFactPool,ngAllocateBatch,ngBatchStart};')(()=>'');
  const fact=(g,i,patch={})=>({id:'fact-'+g+'-'+i,text:'Synthetic fact '+i+' of group '+g+'.',tier:1,latteBucket:'Look',...patch});
  const group=(g,n,patch)=>({condition:'Group '+g,facts:Array.from({length:n},(_,i)=>fact(g,i,patch&&patch(i)))});
  const ids=a=>a.targets.map(f=>f.id).join();
  const groupsOf=a=>[...new Set(a.targets.map(f=>f.condition))];

  // ── the start option ──
  const five=Array.from({length:5},(_,g)=>group(g,2));
  t('v18.5: with no start the allocator keeps its old order (start 0, from the first group)',
    ids(ngAllocateBatch(five,new Set(),{want:6,perCondition:2,neighborCap:0}))===ids(ngAllocateBatch(five,new Set(),{want:6,perCondition:2,neighborCap:0,start:0}))
    &&groupsOf(ngAllocateBatch(five,new Set(),{want:6,perCondition:2,neighborCap:0})).join()==='Group 0,Group 1,Group 2');
  t('v18.5: a batch walks forward from its start group and wraps at the end of the pool',groupsOf(ngAllocateBatch(five,new Set(),{want:6,perCondition:2,neighborCap:0,start:3})).join()==='Group 3,Group 4,Group 0');
  t('v18.5: a start past the end, a negative start or a non-number still lands on a real group',
    ids(ngAllocateBatch(five,new Set(),{want:2,perCondition:2,start:7}))===ids(ngAllocateBatch(five,new Set(),{want:2,perCondition:2,start:2}))
    &&ids(ngAllocateBatch(five,new Set(),{want:2,perCondition:2,start:-1}))===ids(ngAllocateBatch(five,new Set(),{want:2,perCondition:2,start:4}))
    &&ids(ngAllocateBatch(five,new Set(),{want:2,perCondition:2,start:'x'}))===ids(ngAllocateBatch(five,new Set(),{want:2,perCondition:2}))
    &&ngAllocateBatch([],new Set(),{want:3,start:2}).targets.length===0);

  // ── ngBatchStart ──
  const even=Array.from({length:60},(_,g)=>group(g,10));
  t('v18.5: batch starts are evenly spaced through the pool by fact count',[1,2,3,4,5].map(b=>ngBatchStart(even,b,5)).join()==='0,12,24,36,48');
  const uneven=[group(0,40),...Array.from({length:6},(_,g)=>group(g+1,10))];
  t('v18.5: spacing follows fact count, so a long group gets more batch starts than a short one',[1,2,3,4].map(b=>ngBatchStart(uneven,b,4)).join()==='0,0,2,4');
  t('v18.5: a one-batch run, an empty pool and a batch number past the total all start safely',ngBatchStart(even,1,1)===0&&ngBatchStart([],3,5)===0&&ngBatchStart(even,6,5)===0&&ngBatchStart(even,7,5)===12);

  // ── a default run on a pool shaped like the Exam 1 KB: 62 long conditions, then 83 short entries ──
  const exam=[...Array.from({length:62},(_,g)=>group(g,10)),...Array.from({length:83},(_,g)=>group(62+g,3))];
  const simulate=(pool,{batches=5,want=30,spread=true}={})=>{
    const used=new Set(),batchList=[];
    for(let b=1;b<=batches;b++){const a=ngAllocateBatch(pool,used,{want,perCondition:4,neighborCap:2,start:spread?ngBatchStart(pool,b,batches):0});if(!a.targets.length)break;batchList.push(a);a.targets.forEach(f=>used.add(f.id));}
    return {used,batchList,groups:new Set(batchList.flatMap(a=>a.targets.map(f=>f.condition))),targets:batchList.reduce((n,a)=>n+a.targets.length,0)};
  };
  const before=simulate(exam,{spread:false}),after=simulate(exam);
  const entryHits=r=>[...r.groups].filter(g=>Number(g.slice(6))>=62).length;
  t('v18.5: a default 50-question run (5 batches of 30 targets) reaches far more groups than when every batch began at the first',
    before.groups.size===17&&after.groups.size>=2*before.groups.size&&after.targets===150&&before.targets===150);
  t('v18.5: the same run reaches the medication, diagnostic and scoring-tool entries listed after the conditions',entryHits(before)===0&&entryHits(after)>=5);
  t('v18.5: no fact is allocated twice in a run, and a run long enough uses every pool fact exactly once',
    after.used.size===after.targets&&(()=>{const r=simulate(exam,{batches:40});const total=exam.reduce((n,g)=>n+g.facts.length,0);return r.targets===total&&r.used.size===total;})());

  // ── a batch keeps its shape ──
  const shaped=after.batchList.every(a=>{
    const per=new Map();for(const f of a.targets)per.set(f.condition,(per.get(f.condition)||0)+1);
    const hit=new Set(per.keys()),targetIds=new Set(a.targets.map(f=>f.id)),ctx=new Map();for(const f of a.context)ctx.set(f.condition,(ctx.get(f.condition)||0)+1);
    return [...per.values()].every(n=>n<=4)&&a.context.every(f=>hit.has(f.condition)&&!targetIds.has(f.id))&&[...ctx.values()].every(n=>n<=2);
  });
  t('v18.5: each batch still takes at most 4 targets per group and at most 2 same-group context facts, never a target as context',shaped);
  const boxed=[group(0,4),group(1,4,i=>i===3?{sourceKind:'table'}:{}),group(2,4)].map(g=>({...g,facts:[...g.facts].sort((a,b)=>(b.sourceKind?1:0)-(a.sourceKind?1:0))}));
  t('v18.5: a batch that starts mid-pool still takes that group\'s box and table facts first',ngAllocateBatch(boxed,new Set(),{want:2,perCondition:2,neighborCap:0,start:1}).targets[0].id==='fact-1-3');

  // ── the generator passes each batch its start ──
  t('v18.5: the NCLEX Generator gives every batch its evenly spaced start',
    S.split('start:ngBatchStart(pool,b,numBatches)').length===2&&S.includes('alloc=ngAllocateBatch(pool,usedFactIds,{want:Math.max(1,Math.round(size*factsPerQ)),perCondition:4,neighborCap:2,start:ngBatchStart(pool,b,numBatches),first:focus.plan[b-1]});'));
};
